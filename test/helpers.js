// -----------------------------------------------------------------------------
// Test doubles of the three Nuki channels, and sample payloads taken from the
// Nuki API documentations. Tests never touch the network.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { History } from '../src/history.js';

// Smart Lock 3.0 Pro "Front door", Nuki ID 0x398172F4, with a door sensor
// and a keypad. Opener "Intercom", Nuki ID 0x2A3B4C5D.
export const LOCK_ID = '398172F4';
export const OPENER_ID = '2A3B4C5D';

export function bridgeLock(overrides = {}) {
  return {
    deviceType: 4,
    nukiId: parseInt(LOCK_ID, 16),
    name: 'Front door',
    firmwareVersion: '3.10.7',
    lastKnownState: {
      mode: 2,
      state: 1,
      stateName: 'locked',
      batteryCritical: false,
      batteryCharging: false,
      batteryChargeState: 85,
      keypadBatteryCritical: false,
      doorsensorState: 2,
      doorsensorStateName: 'door closed',
      doorsensorBatteryCritical: false,
      timestamp: '2026-11-04T10:00:00+00:00',
      ...overrides,
    },
  };
}

export function bridgeOpener(overrides = {}) {
  return {
    deviceType: 2,
    nukiId: parseInt(OPENER_ID, 16),
    name: 'Intercom',
    firmwareVersion: '1.8.1',
    lastKnownState: {
      mode: 2,
      state: 1,
      stateName: 'online',
      batteryCritical: false,
      ringactionTimestamp: '2026-11-04T09:00:00+00:00',
      ringactionState: false,
      timestamp: '2026-11-04T10:00:00+00:00',
      ...overrides,
    },
  };
}

export function webLock(stateOverrides = {}) {
  return {
    smartlockId: parseInt(`4${LOCK_ID}`, 16),
    accountId: 1,
    type: 4,
    name: 'Front door',
    config: { name: 'Front door', keypadPaired: true, keypad2Paired: false },
    state: {
      mode: 2,
      state: 1,
      trigger: 3,
      lastAction: 2,
      batteryCritical: false,
      batteryCharging: false,
      batteryCharge: 85,
      keypadBatteryCritical: false,
      doorsensorBatteryCritical: false,
      doorState: 2,
      ringToOpenTimer: 0,
      nightMode: false,
      ...stateOverrides,
    },
    firmwareVersion: 0x030a07,
  };
}

/** A fake Bridge client: `list` answers `devices`, actions are recorded. */
export function fakeBridge(devices) {
  const bridge = {
    devices,
    fail: false,
    actions: [],
    async list() {
      if (bridge.fail) {
        throw new Error('Nuki Bridge unreachable');
      }
      return bridge.devices;
    },
    async info() {
      return { versions: { firmwareVersion: '2.17.0' } };
    },
    async lockAction(nukiId, deviceType, action) {
      if (bridge.fail) {
        throw new Error('Nuki Bridge unreachable');
      }
      bridge.actions.push({ nukiId, deviceType, action });
      return { success: true };
    },
    async auth() {
      return 'new-token';
    },
  };
  return bridge;
}

export function fakeWeb(devices, logs = []) {
  const web = {
    devices,
    logData: logs,
    fail: false,
    actions: [],
    async smartlocks() {
      if (web.fail) {
        throw new Error('Nuki Web API unreachable');
      }
      return web.devices;
    },
    async action(smartlockId, body) {
      web.actions.push({ smartlockId, body });
      return null;
    },
    async logs(limit = 20) {
      return web.logData.slice(0, limit);
    },
  };
  return web;
}

/** A fake MQTT client: `emit(id, topic, payload)` plays the broker. */
export function fakeMqtt() {
  const mqtt = {
    published: [],
    options: null,
    connected: true,
    emit(nukiId, topic, payload) {
      mqtt.options.onMessage(nukiId, topic, String(payload));
    },
    setConnected(connected) {
      mqtt.connected = connected;
      mqtt.options.onStatus(connected, connected ? undefined : new Error('broker down'));
    },
    async lockAction(nukiId, code) {
      mqtt.published.push({ nukiId, code });
    },
    async close() {},
  };
  return mqtt;
}

/** Factories handing the same fakes to the hub. */
export function factoriesFor({ bridge, web, mqtt } = {}) {
  return {
    bridge: () => bridge,
    web: () => web,
    mqtt: (options) => {
      mqtt.options = options;
      // The real client reports the connection asynchronously.
      queueMicrotask(() => options.onStatus(mqtt.connected));
      return mqtt;
    },
  };
}

export function memoryHistory() {
  return new History({ file: null });
}

/** A fake Gladys whose devices are already created (states are published for them). */
export function fakeGladys(options = {}) {
  return createFakeGladys(options);
}
