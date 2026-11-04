// -----------------------------------------------------------------------------
// SDK wiring: registers every handler on the Gladys client, before connect().
// Kept apart from index.js so the tests run the real wiring against the fake
// Gladys of the SDK (`createFakeGladys`).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { NukiHub } from './hub.js';
import { History } from './history.js';
import { createActions } from './actions.js';
import { SCENE_ACTIONS } from './scenes.js';
import { createWidgets, refreshWidgets } from './widgets.js';
import { actionForCommand, parseDeviceExternalId } from './devices.js';
import { t } from './i18n.js';

const logger = createLogger({ name: 'app' });

/**
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {object} [options]
 * @param {object} [options.factories] client factories (tests)
 * @param {History} [options.history]
 */
export function createApp(gladys, { factories = {}, history = new History() } = {}) {
  let config = normalizeConfig();
  let hub = null;
  // Serializes the (re)starts: a config update during a start waits for it.
  let lifecycle = Promise.resolve();

  const widgets = createWidgets(() => hub);
  const nudgeWidgets = () => refreshWidgets(gladys, widgets);

  function newHub() {
    return new NukiHub({ gladys, config, factories, history, onChange: nudgeWidgets });
  }

  function restart(newConfig) {
    lifecycle = lifecycle
      .catch(() => {})
      .then(async () => {
        await hub?.stop();
        config = normalizeConfig(newConfig);
        hub = newHub();
        await hub.start();
        await hub.publishDiscoveredDevices();
        await hub.publishTransports();
        nudgeWidgets();
      });
    return lifecycle;
  }

  // Before the first connection, handlers can still be called on a hub that
  // knows nothing (no config yet): give them an empty one.
  hub = newHub();

  // --- Discovery ---------------------------------------------------------------
  gladys.onScanRequest(async () => {
    await lifecycle;
    await hub.refresh({ forceWeb: true });
    await hub.publishDiscoveredDevices();
  });

  // --- Commands ----------------------------------------------------------------
  gladys.onSetValue(async (device, feature, value) => {
    logger.info(`onSetValue <- ${feature.external_id} = ${value}`);
    const parsed = parseDeviceExternalId(gladys, device.external_id);
    if (!parsed) {
      throw new Error(`Unknown Nuki device ${device.external_id}`);
    }
    const featureKey = feature.external_id.split(':').pop();
    const action = actionForCommand(parsed.kind, featureKey, value, config);
    await hub.runAction(parsed.nukiId, action);
  });

  // A created device gets its states right away, and its transport badge.
  gladys.onDeviceCreated(async () => {
    hub.transportSignature = null;
    await hub.sync();
  });

  // --- Manifest actions --------------------------------------------------------
  const actions = createActions({
    gladys,
    getHub: () => hub,
    getConfig: () => config,
    updateConfig: async (patch) => {
      await gladys.setConfig(patch);
      await restart({ ...config, ...patch });
    },
    factories,
  });
  for (const [key, handler] of Object.entries(actions)) {
    gladys.onAction(key, async (fields) => {
      await lifecycle;
      return handler(fields);
    });
  }

  // --- Scene actions -----------------------------------------------------------
  for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
    gladys.onSceneAction(key, async (fields) => {
      await lifecycle;
      return handler(hub, { fields, config });
    });
  }

  // --- Dashboard widgets -------------------------------------------------------
  for (const [key, widget] of Object.entries(widgets)) {
    gladys.onWidgetGet(key, (request) => widget.get(request));
    if (typeof widget.action === 'function') {
      gladys.onWidgetAction(key, (actionKey, params, { settings }) =>
        widget.action({ actionKey, params, settings }),
      );
    }
  }

  // --- Configuration -----------------------------------------------------------
  gladys.onConfigUpdated(async (newConfig) => {
    logger.info('onConfigUpdated -> restarting the Nuki channels');
    await restart(newConfig);
  });

  // --- Connection lifecycle ----------------------------------------------------
  gladys.on('connected', async () => {
    try {
      await restart(await gladys.getConfig());
    } catch (err) {
      logger.error('Post-connection initialization failed', err);
      await gladys.setConnectionStatus(false, t('init_failed')).catch(() => {});
    }
  });

  gladys.on('disconnected', () => {
    lifecycle = lifecycle.catch(() => {}).then(() => hub?.stop());
  });

  return {
    get hub() {
      return hub;
    },
    get config() {
      return config;
    },
    widgets,
    ready: () => lifecycle,
    async stop() {
      await lifecycle.catch(() => {});
      await hub?.stop();
    },
  };
}
