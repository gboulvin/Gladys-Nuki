// -----------------------------------------------------------------------------
// The Nuki hub: one place that knows every Nuki device, through every
// configured channel, and decides which one to use.
//
//   Bridge HTTP API (local)  ─┐
//   MQTT, Smart Lock 3.0+ (local, push) ─┼─> snapshots per channel ─> effective snapshot
//   Nuki Web API (cloud)     ─┘                                   per device
//
// - Reads: the Bridge and Nuki Web are polled with the integration's own
//   timer (one request for all devices, not one per device); MQTT pushes.
//   The effective snapshot of a device comes from the first healthy channel
//   in the preference order: local first (MQTT, then Bridge) unless the user
//   turned off "Prefer the local connection", in which case Nuki Web first.
// - Commands follow the same order and fall back to the next channel when
//   one fails, so a Bridge outage does not stop "lock the door".
// - Each refresh publishes the changed states, the transport badge of every
//   device (local / cloud / unreachable, degraded when the preferred channel
//   is down), the scene events and the connection status.
// -----------------------------------------------------------------------------

import { createLogger, DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { BridgeClient } from './nuki/bridgeClient.js';
import { WebClient } from './nuki/webClient.js';
import { MqttClient } from './nuki/mqttClient.js';
import { foldMqtt, fromBridge, fromWeb, parseLockActionEvent } from './nuki/normalize.js';
import {
  DEVICE_KINDS,
  LOCK_ACTIONS,
  LOCK_ERRORS,
  GLADYS_LOCK_STATE,
  actionFromCode,
  canFullLock,
  localActionCode,
  mqttTrigger,
  nukiIdFromWeb,
  TRIGGERS,
  webActionBody,
  webSmartlockId,
  webTrigger,
} from './nuki/constants.js';
import { WEB_POLL_MIN_SECONDS, configuredBackends, mqttUrl } from './config.js';
import { FEATURES, buildDevice, buildStates, deviceIds } from './devices.js';
import { SCENE_TRIGGERS, detectEvents } from './events.js';
import { History } from './history.js';
import { t } from './i18n.js';

const logger = createLogger({ name: 'hub' });

const LOCAL_SOURCES = ['mqtt', 'bridge'];
const CLOUD_SOURCES = ['web'];
const SOURCE_TRANSPORT = {
  mqtt: DEVICE_TRANSPORTS.LOCAL,
  bridge: DEVICE_TRANSPORTS.LOCAL,
  web: DEVICE_TRANSPORTS.CLOUD,
};

// An operation seen within this window is attributed to the command or the
// MQTT event that caused it.
const ATTRIBUTION_WINDOW_MS = 60_000;
// Nuki Web logs lag a little behind the lock: accept entries this old.
const WEB_LOG_WINDOW_MS = 3 * 60_000;
// Re-read the state shortly after a command (the Bridge answers `nowait`).
const FOLLOW_UP_DELAYS_MS = [3_000, 10_000];
const STATE_HEARTBEAT_MS = 30 * 60_000;
const WEB_LOG_CACHE_MS = 60_000;

const defaultFactories = {
  bridge: (options) => new BridgeClient(options),
  web: (options) => new WebClient(options),
  mqtt: (options) => new MqttClient(options),
};

export class NukiHub {
  /**
   * @param {object} options
   * @param {import('@gladysassistant/integration-sdk').GladysIntegration} options.gladys
   * @param {object} options.config normalized config (src/config.js)
   * @param {object} [options.factories] client factories, injectable for the tests
   * @param {History} [options.history]
   * @param {() => void} [options.onChange] called when the published data changed (widgets)
   */
  constructor({ gladys, config, factories = {}, history = new History(), onChange = () => {} }) {
    this.gladys = gladys;
    this.config = config;
    this.factories = { ...defaultFactories, ...factories };
    this.history = history;
    this.onChange = onChange;
    this.clients = {};
    this.sources = { bridge: new Map(), mqtt: new Map(), web: new Map() };
    this.health = {};
    this.current = new Map(); // nukiId -> last effective snapshot
    this.memory = new Map(); // nukiId -> event detection memory
    this.lastCommands = new Map(); // nukiId -> { action, at }
    this.lastMqttEvents = new Map(); // nukiId -> { action, trigger, at }
    this.lastWebPoll = 0;
    this.webLogCache = { at: 0, entries: [] };
    this.timers = new Set();
    this.interval = null;
    this.refreshing = null;
    this.discoverySignature = null;
    this.transportSignature = null;
    this.statusSignature = null;
  }

  // --- Lifecycle ---------------------------------------------------------------

  async start() {
    await this.history.load();
    const backends = configuredBackends(this.config);
    this.health = Object.fromEntries(
      Object.entries(backends).map(([name, configured]) => [
        name,
        { configured, ok: false, error: configured ? null : 'not configured' },
      ]),
    );
    if (backends.bridge) {
      this.clients.bridge = this.factories.bridge({
        host: this.config.bridge_ip,
        port: this.config.bridge_port,
        token: this.config.bridge_token,
        hashedToken: this.config.bridge_hashed_token,
      });
    }
    if (backends.web) {
      this.clients.web = this.factories.web({ token: this.config.web_api_token });
    }
    if (backends.mqtt) {
      this.clients.mqtt = this.factories.mqtt({
        url: mqttUrl(this.config),
        username: this.config.mqtt_username,
        password: this.config.mqtt_password,
        onMessage: (nukiId, topic, payload) => this.handleMqttMessage(nukiId, topic, payload),
        onStatus: (connected, error) => this.handleMqttStatus(connected, error),
      });
    }
    await this.refresh({ forceWeb: true });
    this.interval = setInterval(() => {
      this.refresh().catch((err) => logger.error('Refresh failed', err));
    }, this.config.poll_frequency * 1000);
  }

  async stop() {
    clearInterval(this.interval);
    this.interval = null;
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    await this.clients.mqtt?.close();
    this.clients = {};
  }

  later(delayMs, fn) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, delayMs);
    this.timers.add(timer);
  }

  // --- Reads -------------------------------------------------------------------

  /**
   * Poll the Bridge and Nuki Web (when due), then publish what changed.
   * Concurrent calls share the same run.
   */
  refresh(options = {}) {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh(options).finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  async doRefresh({ forceWeb = false } = {}) {
    if (this.clients.bridge) {
      await this.poll('bridge', async () => {
        const list = await this.clients.bridge.list();
        return (Array.isArray(list) ? list : []).map((item) => fromBridge(item)).filter(Boolean);
      });
    }
    if (this.clients.web && (forceWeb || this.isWebDue())) {
      this.lastWebPoll = Date.now();
      await this.poll('web', async () => {
        const list = await this.clients.web.smartlocks();
        return (Array.isArray(list) ? list : []).map((item) => fromWeb(item)).filter(Boolean);
      });
    }
    await this.sync();
  }

  async poll(source, read) {
    try {
      const snapshots = await read();
      this.sources[source] = new Map(snapshots.map((snapshot) => [snapshot.nukiId, snapshot]));
      this.setHealth(source, true);
    } catch (err) {
      logger.warn(`${source} read failed: ${err.message}`);
      this.setHealth(source, false, err.message);
    }
  }

  setHealth(source, ok, error = null) {
    this.health[source] = { ...this.health[source], ok, error };
  }

  /**
   * Nuki Web is polled when the cloud is the preferred channel, or when a
   * device is not covered by a healthy local channel — never faster than
   * every 30 seconds.
   */
  isWebDue() {
    const interval = Math.max(this.config.poll_frequency, WEB_POLL_MIN_SECONDS) * 1000;
    if (Date.now() - this.lastWebPoll < interval) {
      return false;
    }
    if (!this.config.GLADYS_PREFER_LOCAL) {
      return true;
    }
    const known = new Set([...this.current.keys(), ...this.sources.web.keys()]);
    if (known.size === 0) {
      return true;
    }
    return [...known].some(
      (nukiId) =>
        !LOCAL_SOURCES.some(
          (source) => this.health[source]?.ok && this.sources[source].has(nukiId),
        ),
    );
  }

  sourceOrder() {
    return this.config.GLADYS_PREFER_LOCAL
      ? [...LOCAL_SOURCES, ...CLOUD_SOURCES]
      : [...CLOUD_SOURCES, ...LOCAL_SOURCES];
  }

  knownIds() {
    return new Set([
      ...this.sources.bridge.keys(),
      ...this.sources.mqtt.keys(),
      ...this.sources.web.keys(),
    ]);
  }

  /**
   * The snapshot of a device from the first healthy channel that knows its
   * state, in the preference order. `{ snapshot, source }`, or the last
   * known snapshot with `source: null` when no channel reaches it.
   */
  resolve(nukiId) {
    const order = this.sourceOrder();
    const candidates = order.filter(
      (source) => this.health[source]?.ok && this.sources[source].has(nukiId),
    );
    const withState = candidates.find((source) => this.sources[source].get(nukiId).state !== null);
    const source = withState ?? candidates[0];
    if (source) {
      const snapshot = { ...this.sources[source].get(nukiId) };
      // A device first seen through Nuki Web keeps the smartlockId it needs.
      const web = this.sources.web.get(nukiId);
      if (web?.smartlockId) {
        snapshot.smartlockId = web.smartlockId;
      }
      return { snapshot, source };
    }
    const fallback =
      this.current.get(nukiId) ??
      order.map((name) => this.sources[name].get(nukiId)).find(Boolean) ??
      null;
    return { snapshot: fallback, source: null };
  }

  /** Transport badge entry of one device. */
  transportOf(nukiId) {
    const { source } = this.resolve(nukiId);
    if (!source) {
      return { transport: DEVICE_TRANSPORTS.UNREACHABLE };
    }
    const transport = SOURCE_TRANSPORT[source];
    const preferred = this.config.GLADYS_PREFER_LOCAL ? LOCAL_SOURCES : CLOUD_SOURCES;
    const preferredConfigured = preferred.some((name) => this.health[name]?.configured);
    if (preferredConfigured && !preferred.includes(source)) {
      return {
        transport,
        degraded: true,
        message: this.config.GLADYS_PREFER_LOCAL
          ? t('degraded_local_down')
          : t('degraded_cloud_down'),
      };
    }
    return { transport };
  }

  // --- Publication ---------------------------------------------------------------

  createdDeviceIds() {
    return new Set((this.gladys.devices ?? []).map((device) => device.external_id));
  }

  /** Discovery payload of every known device. */
  buildDiscoveredDevices() {
    return [...this.knownIds()]
      .map((nukiId) => this.resolve(nukiId).snapshot)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((snapshot) => buildDevice(this.gladys, snapshot));
  }

  async publishDiscoveredDevices() {
    const devices = this.buildDiscoveredDevices();
    this.discoverySignature = JSON.stringify(devices);
    await this.gladys.publishDiscoveredDevices(devices);
    return devices;
  }

  /**
   * Compare the effective snapshots with the published ones: scene events,
   * states, transports, discovery list and connection status.
   */
  async sync() {
    const created = this.createdDeviceIds();
    const states = [];
    const events = [];
    let changed = false;
    for (const nukiId of this.knownIds()) {
      const { snapshot, source } = this.resolve(nukiId);
      if (!snapshot || !source) {
        continue;
      }
      const previous = this.current.get(nukiId);
      if (!this.memory.has(nukiId)) {
        this.memory.set(nukiId, {});
      }
      for (const event of detectEvents(previous, snapshot, this.memory.get(nukiId))) {
        events.push({ ...event, snapshot });
      }
      if (
        !previous ||
        JSON.stringify(stripVolatile(previous)) !== JSON.stringify(stripVolatile(snapshot))
      ) {
        changed = true;
      }
      this.current.set(nukiId, snapshot);
      if (created.has(deviceIds(this.gladys, snapshot).device)) {
        states.push(...buildStates(this.gladys, snapshot));
      }
    }

    if (states.length > 0) {
      await this.gladys
        .publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS })
        .catch((err) => logger.error('State publication failed', err));
    }
    await this.publishTransports(created);

    const devices = this.buildDiscoveredDevices();
    const signature = JSON.stringify(devices);
    if (this.discoverySignature !== null && signature !== this.discoverySignature) {
      // A new device, or a new accessory (door sensor, keypad): refresh the
      // Discovery tab, Gladys offers to update the created device.
      this.discoverySignature = signature;
      await this.gladys
        .publishDiscoveredDevices(devices)
        .catch((err) => logger.error('Discovery publication failed', err));
    }

    for (const event of events) {
      await this.emitEvent(event).catch((err) => logger.error('Scene event failed', err));
    }
    await this.publishConnectionStatus();
    if (changed || events.length > 0) {
      this.onChange();
    }
  }

  async publishTransports(created = this.createdDeviceIds()) {
    const entries = [...this.knownIds()]
      .map((nukiId) => {
        const snapshot = this.resolve(nukiId).snapshot;
        return (
          snapshot && {
            external_id: deviceIds(this.gladys, snapshot).device,
            ...this.transportOf(nukiId),
          }
        );
      })
      .filter((entry) => entry && created.has(entry.external_id));
    const signature = JSON.stringify(entries);
    if (entries.length === 0 || signature === this.transportSignature) {
      return;
    }
    this.transportSignature = signature;
    await this.gladys
      .publishTransports(entries)
      .catch((err) => logger.error('Transport publication failed', err));
  }

  connectionStatus() {
    const configured = Object.entries(this.health).filter(([, health]) => health.configured);
    if (configured.length === 0) {
      return { connected: false, message: t('not_configured') };
    }
    if (configured.some(([, health]) => health.ok)) {
      return { connected: true };
    }
    const errors = configured.map(([name, health]) => `${name}: ${health.error ?? '?'}`).join(', ');
    return { connected: false, message: t('all_backends_down', { errors }) };
  }

  async publishConnectionStatus() {
    const { connected, message } = this.connectionStatus();
    const signature = JSON.stringify({ connected, message });
    if (signature === this.statusSignature) {
      return;
    }
    this.statusSignature = signature;
    await this.gladys
      .setConnectionStatus(connected, message)
      .catch((err) => logger.error('Connection status publication failed', err));
  }

  // --- Scene events --------------------------------------------------------------

  async emitEvent({ key, snapshot, ...details }) {
    const device = deviceIds(this.gladys, snapshot).device;
    const base = { device, device_name: snapshot.name };
    let data;
    if (key === SCENE_TRIGGERS.LOCK_ACTION) {
      const { action, trigger, user } = await this.describeLockAction(snapshot, details.action);
      data = { ...base, action, trigger, user: user ?? '' };
      this.history.add({ ...base, type: 'lock_action', action, trigger, user });
    } else if (key === SCENE_TRIGGERS.LOCK_ERROR) {
      data = { ...base, error: details.error };
      this.history.add({ ...base, type: 'error', detail: details.error });
    } else if (key === SCENE_TRIGGERS.BATTERY_CRITICAL) {
      data = { ...base, component: details.component };
      this.history.add({ ...base, type: 'battery', detail: details.component });
    } else {
      data = base;
      this.history.add({ ...base, type: 'doorbell' });
    }
    logger.info(`Scene event ${key} <- ${snapshot.name} ${JSON.stringify(details)}`);
    await this.gladys.publishSceneEvent(key, data);
  }

  /**
   * Who / what operated a lock: a command of this integration, the MQTT
   * lockActionEvent, or the Nuki Web activity log (which knows the user).
   */
  async describeLockAction(snapshot, action) {
    const now = Date.now();
    const command = this.lastCommands.get(snapshot.nukiId);
    if (command && now - command.at < ATTRIBUTION_WINDOW_MS) {
      return { action, trigger: TRIGGERS.GLADYS, user: null };
    }
    let trigger = TRIGGERS.UNKNOWN;
    let precise = action;
    const mqttEvent = this.lastMqttEvents.get(snapshot.nukiId);
    if (mqttEvent && now - mqttEvent.at < ATTRIBUTION_WINDOW_MS) {
      trigger = mqttEvent.trigger;
      precise = mqttEvent.action ?? action;
    }
    if (this.clients.web && this.health.web?.ok !== false) {
      const entry = (await this.webLogs().catch(() => [])).find(
        (log) =>
          nukiIdFromWeb(log.smartlockId) === snapshot.nukiId &&
          now - new Date(log.date).getTime() < WEB_LOG_WINDOW_MS,
      );
      if (entry) {
        return {
          action: actionFromCode(snapshot.kind, entry.action) ?? precise,
          trigger: webTrigger(entry.trigger, entry.source),
          user: entry.name || null,
        };
      }
    }
    return { action: precise, trigger, user: null };
  }

  /** Nuki Web activity log, cached a minute (widget + attribution). */
  async webLogs({ maxAgeMs = WEB_LOG_CACHE_MS } = {}) {
    if (!this.clients.web) {
      return [];
    }
    if (Date.now() - this.webLogCache.at > maxAgeMs) {
      const entries = await this.clients.web.logs(30);
      this.webLogCache = { at: Date.now(), entries: Array.isArray(entries) ? entries : [] };
    }
    return this.webLogCache.entries;
  }

  // --- MQTT push -----------------------------------------------------------------

  handleMqttStatus(connected, error) {
    this.setHealth('mqtt', connected, connected ? null : (error?.message ?? 'disconnected'));
    this.sync().catch((err) => logger.error('Sync after MQTT status failed', err));
  }

  handleMqttMessage(nukiId, topic, payload) {
    if (topic === 'lockActionEvent') {
      const event = parseLockActionEvent(payload);
      const kind = this.sources.mqtt.get(nukiId)?.kind ?? DEVICE_KINDS.LOCK;
      this.lastMqttEvents.set(nukiId, {
        action: actionFromCode(kind, event.action),
        trigger: mqttTrigger(event.trigger, event.codeId),
        at: Date.now(),
      });
      return;
    }
    if (topic === 'commandResponse') {
      const snapshot = this.sources.mqtt.get(nukiId);
      if (Number(payload) !== 0 && snapshot) {
        this.emitEvent({
          key: SCENE_TRIGGERS.LOCK_ERROR,
          snapshot,
          error: LOCK_ERRORS.COMMAND_FAILED,
        }).catch((err) => logger.error('Scene event failed', err));
      }
      return;
    }
    const previous = this.sources.mqtt.get(nukiId);
    const next = foldMqtt(previous, nukiId, topic, payload);
    if (!next || next === previous) {
      return;
    }
    this.sources.mqtt.set(nukiId, next);
    if (!previous && this.discoverySignature !== null) {
      logger.info(`MQTT: new Nuki device ${nukiId}`);
    }
    // Coalesce the burst of retained messages received on subscription.
    if (!this.mqttSyncPending) {
      this.mqttSyncPending = true;
      this.later(200, () => {
        this.mqttSyncPending = false;
        this.sync().catch((err) => logger.error('Sync after MQTT message failed', err));
      });
    }
  }

  // --- Commands --------------------------------------------------------------------

  /**
   * Run a Nuki action on a device, through the first channel that works in
   * the preference order. Resolves `{ source }`, throws when every channel
   * failed.
   */
  async runAction(nukiId, requestedAction) {
    const { snapshot } = this.resolve(nukiId);
    if (!snapshot) {
      throw new Error(`Unknown Nuki device ${nukiId}`);
    }
    // "Full lock" only exists from the Smart Lock 3.0 on: a plain lock elsewhere.
    const action =
      requestedAction === LOCK_ACTIONS.FULL_LOCK && !canFullLock(snapshot.deviceType)
        ? LOCK_ACTIONS.LOCK
        : requestedAction;
    const errors = [];
    for (const source of this.sourceOrder()) {
      if (!this.clients[source] || !this.sources[source].has(nukiId)) {
        continue;
      }
      if (source === 'mqtt' && !this.health.mqtt?.ok) {
        continue;
      }
      try {
        await this.sendAction(source, snapshot, action);
        logger.info(`Action ${action} -> ${snapshot.name} via ${source}`);
        this.lastCommands.set(nukiId, { action, at: Date.now() });
        await this.afterCommand(snapshot, source);
        return { source, action };
      } catch (err) {
        logger.warn(`Action ${action} via ${source} failed: ${err.message}`);
        errors.push(`${source}: ${err.message}`);
      }
    }
    throw new Error(
      errors.length > 0
        ? `Nuki action failed (${errors.join('; ')})`
        : `No channel reaches the Nuki device ${snapshot.name}`,
    );
  }

  async sendAction(source, snapshot, action) {
    if (source === 'bridge') {
      await this.clients.bridge.lockAction(
        parseInt(snapshot.nukiId, 16),
        snapshot.deviceType,
        localActionCode(snapshot.kind, action),
      );
    } else if (source === 'mqtt') {
      await this.clients.mqtt.lockAction(snapshot.nukiId, localActionCode(snapshot.kind, action));
    } else {
      const smartlockId =
        this.sources.web.get(snapshot.nukiId)?.smartlockId ??
        webSmartlockId(snapshot.nukiId, snapshot.deviceType);
      await this.clients.web.action(smartlockId, webActionBody(snapshot.kind, action));
    }
  }

  async afterCommand(snapshot, source) {
    if (snapshot.kind === DEVICE_KINDS.LOCK) {
      // The bolt is moving: show it until the real state comes back.
      await this.gladys
        .publishState(
          deviceIds(this.gladys, snapshot).feature(FEATURES.STATE),
          GLADYS_LOCK_STATE.ACTIVITY,
        )
        .catch(() => {});
    }
    if (source !== 'mqtt') {
      for (const delay of FOLLOW_UP_DELAYS_MS) {
        this.later(delay, () => {
          // The cloud state follows the lock with a delay: re-read it too.
          this.refresh({ forceWeb: source === 'web' }).catch((err) =>
            logger.error('Follow-up refresh failed', err),
          );
        });
      }
    }
  }

  // --- Views (widgets, scene actions) ---------------------------------------------

  /** Everything the widgets need about one device, by external_id. */
  view(externalId) {
    for (const nukiId of this.knownIds()) {
      const { snapshot } = this.resolve(nukiId);
      if (snapshot && deviceIds(this.gladys, snapshot).device === externalId) {
        return this.viewOf(nukiId);
      }
    }
    return null;
  }

  viewOf(nukiId) {
    const { snapshot, source } = this.resolve(nukiId);
    return {
      nukiId,
      snapshot,
      source,
      externalId: deviceIds(this.gladys, snapshot).device,
      ids: deviceIds(this.gladys, snapshot),
      transport: this.transportOf(nukiId),
      lastActivity: this.history.latest(1, deviceIds(this.gladys, snapshot).device)[0] ?? null,
    };
  }

  /** Views of every known device, sorted by name. */
  views() {
    return [...this.knownIds()]
      .filter((nukiId) => this.resolve(nukiId).snapshot)
      .map((nukiId) => this.viewOf(nukiId))
      .sort((a, b) => a.snapshot.name.localeCompare(b.snapshot.name));
  }
}

// Fields that change without the device changing (timestamps).
function stripVolatile(snapshot) {
  const { receivedAt: _receivedAt, ...rest } = snapshot;
  return rest;
}
