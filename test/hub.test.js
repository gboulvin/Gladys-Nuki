import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NukiHub } from '../src/hub.js';
import { normalizeConfig } from '../src/config.js';
import { detectEvents, SCENE_TRIGGERS } from '../src/events.js';
import { fromBridge } from '../src/nuki/normalize.js';
import {
  LOCK_ID,
  OPENER_ID,
  bridgeLock,
  bridgeOpener,
  factoriesFor,
  fakeBridge,
  fakeGladys,
  fakeMqtt,
  fakeWeb,
  memoryHistory,
  webLock,
} from './helpers.js';

const BRIDGE_CONFIG = { bridge_ip: '192.168.1.50', bridge_token: 'tok' };
const WEB_CONFIG = { web_api_token: 'web' };

async function startHub(t, { config = BRIDGE_CONFIG, ...channels } = {}) {
  const gladys = fakeGladys();
  await gladys.connect();
  const hub = new NukiHub({
    gladys,
    config: normalizeConfig(config),
    factories: factoriesFor(channels),
    history: memoryHistory(),
  });
  await hub.start();
  t.after(() => hub.stop());
  return { gladys, hub };
}

/** Create every discovered device in Gladys, as the user would. */
async function createAll(gladys, hub) {
  for (const device of hub.buildDiscoveredDevices()) {
    await gladys.fake.deviceCreated(device);
  }
}

const lockIds = (gladys) => gladys.externalIds('lock', LOCK_ID);
const openerIds = (gladys) => gladys.externalIds('opener', OPENER_ID);

test('the Bridge devices are discovered with their accessories', async (t) => {
  const bridge = fakeBridge([bridgeLock(), bridgeOpener()]);
  const { gladys, hub } = await startHub(t, { bridge });
  const devices = await hub.publishDiscoveredDevices();
  assert.deepEqual(gladys.fake.discoveredDevices, devices, 'the fake Gladys accepted the payload');
  const lock = devices.find((device) => device.external_id === lockIds(gladys).device);
  const keys = lock.features.map((feature) => feature.external_id.split(':').pop());
  assert.deepEqual(keys, [
    'lock',
    'state',
    'battery',
    'battery-low',
    'charging',
    'door',
    'door-sensor-battery-low',
    'keypad-battery-low',
  ]);
  assert.equal(lock.should_poll, false, 'refreshed by the integration timer');
  assert.deepEqual(lock.params[0], { name: 'NUKI_ID', value: LOCK_ID });
  const opener = devices.find((device) => device.external_id === openerIds(gladys).device);
  assert.deepEqual(
    opener.features.map((feature) => feature.external_id.split(':').pop()),
    ['ring-to-open', 'continuous-mode', 'battery-low', 'doorbell'],
  );
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
});

test('states are published for the created devices only', async (t) => {
  const bridge = fakeBridge([bridgeLock(), bridgeOpener()]);
  const { gladys, hub } = await startHub(t, { bridge });
  assert.equal(gladys.fake.states.length, 0, 'nothing created yet');
  await gladys.fake.deviceCreated(
    hub.buildDiscoveredDevices().find((d) => d.external_id === lockIds(gladys).device),
  );
  await hub.sync();
  const ids = lockIds(gladys);
  assert.equal(gladys.fake.lastState(ids.feature('lock')), 1);
  assert.equal(gladys.fake.lastState(ids.feature('state')), 1);
  assert.equal(gladys.fake.lastState(ids.feature('battery')), 85);
  assert.equal(gladys.fake.lastState(ids.feature('door')), 1, 'closed');
  assert.equal(gladys.fake.lastState(openerIds(gladys).feature('ring-to-open')), undefined);
  assert.deepEqual(gladys.fake.transports.at(-1), {
    device_external_id: ids.device,
    transport: 'local',
  });
});

test('only the changed states are published again', async (t) => {
  const bridge = fakeBridge([bridgeLock()]);
  const { gladys, hub } = await startHub(t, { bridge });
  await createAll(gladys, hub);
  await hub.refresh();
  const count = gladys.fake.states.length;
  await hub.refresh();
  assert.equal(gladys.fake.states.length, count, 'nothing changed');
  bridge.devices = [bridgeLock({ state: 3, doorsensorState: 3 })];
  await hub.refresh();
  assert.equal(gladys.fake.states.length, count + 3, 'lock, state and door');
  assert.equal(gladys.fake.lastState(lockIds(gladys).feature('lock')), 0);
  assert.equal(gladys.fake.lastState(lockIds(gladys).feature('door')), 0, 'open');
});

test('an operation fires lock_action, attributed to Gladys after a command', async (t) => {
  const bridge = fakeBridge([bridgeLock()]);
  const { gladys, hub } = await startHub(t, { bridge });
  await createAll(gladys, hub);

  bridge.devices = [bridgeLock({ state: 3 })];
  await hub.refresh();
  assert.deepEqual(gladys.fake.sceneEvents.at(-1), {
    key: SCENE_TRIGGERS.LOCK_ACTION,
    data: {
      device: lockIds(gladys).device,
      device_name: 'Front door',
      action: 'unlock',
      trigger: 'unknown',
      user: '',
    },
  });

  await hub.runAction(LOCK_ID, 'lock');
  assert.deepEqual(bridge.actions.at(-1), {
    nukiId: parseInt(LOCK_ID, 16),
    deviceType: 4,
    action: 2,
  });
  assert.equal(gladys.fake.lastState(lockIds(gladys).feature('state')), 2, 'activity while moving');
  bridge.devices = [bridgeLock({ state: 1 })];
  await hub.refresh();
  assert.equal(gladys.fake.sceneEvents.at(-1).data.trigger, 'gladys');
  assert.equal(gladys.fake.sceneEvents.length, 2);
  assert.equal(hub.history.latest(1)[0].action, 'lock');
});

test('Nuki Web logs tell who operated the lock', async (t) => {
  const bridge = fakeBridge([bridgeLock()]);
  const web = fakeWeb([webLock()], []);
  const { gladys, hub } = await startHub(t, {
    bridge,
    web,
    config: { ...BRIDGE_CONFIG, ...WEB_CONFIG },
  });
  await createAll(gladys, hub);
  web.logData.unshift({
    smartlockId: parseInt(`4${LOCK_ID}`, 16),
    deviceType: 4,
    name: 'Alice',
    action: 1,
    trigger: 0,
    source: 2,
    date: new Date().toISOString(),
  });
  bridge.devices = [bridgeLock({ state: 3 })];
  await hub.refresh();
  const { data } = gladys.fake.sceneEvents.at(-1);
  assert.equal(data.user, 'Alice');
  assert.equal(data.trigger, 'fingerprint');
  assert.equal(data.action, 'unlock');
});

test('unlatch is one operation, not unlatch then unlock', () => {
  const memory = {};
  const states = [1, 7, 5, 3, 3];
  const events = [];
  let previous;
  for (const state of states) {
    const next = fromBridge(bridgeLock({ state }));
    events.push(...detectEvents(previous, next, memory));
    previous = next;
  }
  assert.deepEqual(events, [{ key: SCENE_TRIGGERS.LOCK_ACTION, action: 'unlatch' }]);
});

test('motor blocked, battery critical and doorbell fire their triggers', async (t) => {
  const bridge = fakeBridge([bridgeLock(), bridgeOpener()]);
  const { gladys, hub } = await startHub(t, { bridge });
  bridge.devices = [
    bridgeLock({ state: 254, keypadBatteryCritical: true }),
    bridgeOpener({ ringactionState: true, ringactionTimestamp: '2026-11-04T10:05:00+00:00' }),
  ];
  await hub.refresh();
  const keys = gladys.fake.sceneEvents.map(
    (event) => `${event.key}:${event.data.error ?? event.data.component ?? ''}`,
  );
  assert.deepEqual(keys.sort(), [
    'battery_critical:keypad',
    'doorbell_ring:',
    'lock_error:motor_blocked',
  ]);
  // The same ring seen again is not a new ring.
  await hub.refresh();
  assert.equal(gladys.fake.sceneEvents.length, 3);
});

test('falls back to Nuki Web when the Bridge is down, flagged degraded', async (t) => {
  const bridge = fakeBridge([bridgeLock()]);
  const web = fakeWeb([webLock()]);
  const { gladys, hub } = await startHub(t, {
    bridge,
    web,
    config: { ...BRIDGE_CONFIG, ...WEB_CONFIG },
  });
  await createAll(gladys, hub);
  await hub.publishTransports();
  assert.equal(gladys.fake.transports.at(-1).transport, 'local');

  bridge.fail = true;
  hub.lastWebPoll = 0;
  await hub.refresh();
  const entry = gladys.fake.transports.at(-1);
  assert.equal(entry.transport, 'cloud');
  assert.equal(entry.degraded, true);
  assert.ok(entry.message.en && entry.message.fr && entry.message.de && entry.message.es);
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true }, 'Nuki Web still works');

  await hub.runAction(LOCK_ID, 'unlock');
  assert.deepEqual(web.actions.at(-1), {
    smartlockId: parseInt(`4${LOCK_ID}`, 16),
    body: { action: 1 },
  });
});

test('the cloud first when the user does not prefer local', async (t) => {
  const bridge = fakeBridge([bridgeLock()]);
  const web = fakeWeb([webLock()]);
  const { gladys, hub } = await startHub(t, {
    bridge,
    web,
    config: { ...BRIDGE_CONFIG, ...WEB_CONFIG, GLADYS_PREFER_LOCAL: false },
  });
  await createAll(gladys, hub);
  await hub.runAction(LOCK_ID, 'full_lock');
  assert.deepEqual(web.actions.at(-1).body, { action: 2, option: 4 }, 'full lock through Nuki Web');
  assert.equal(bridge.actions.length, 0);
  assert.equal(hub.transportOf(LOCK_ID).transport, 'cloud');
  assert.equal(hub.transportOf(LOCK_ID).degraded, undefined);
});

test('everything down: unreachable, and a clear connection status', async (t) => {
  const bridge = fakeBridge([bridgeLock()]);
  const { gladys, hub } = await startHub(t, { bridge });
  await createAll(gladys, hub);
  bridge.fail = true;
  await hub.refresh();
  assert.equal(gladys.fake.transports.at(-1).transport, 'unreachable');
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /bridge: Nuki Bridge unreachable/);
  await assert.rejects(hub.runAction(LOCK_ID, 'lock'), /failed/);
});

test('no channel configured: the status says what to do', async (t) => {
  const { gladys } = await startHub(t, { config: {} });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /Configurez/);
});

test('MQTT discovers the locks and pushes their states', async (t) => {
  const mqtt = fakeMqtt();
  const { gladys, hub } = await startHub(t, { mqtt, config: { mqtt_url: '192.168.1.10' } });
  assert.equal(mqtt.options.url, 'mqtt://192.168.1.10', 'scheme added');
  mqtt.emit(LOCK_ID, 'deviceType', 4);
  mqtt.emit(LOCK_ID, 'name', 'Back door');
  mqtt.emit(LOCK_ID, 'state', 1);
  mqtt.emit(LOCK_ID, 'batteryChargeState', 64);
  mqtt.emit(LOCK_ID, 'batteryCritical', 'false');
  await hub.sync();
  await createAll(gladys, hub);
  await hub.sync();
  assert.equal(gladys.fake.lastState(lockIds(gladys).feature('battery')), 64);
  assert.equal(hub.transportOf(LOCK_ID).transport, 'local');

  // An operation reported by the lock, with its trigger.
  mqtt.emit(LOCK_ID, 'lockActionEvent', '1,2,0,0,1');
  mqtt.emit(LOCK_ID, 'state', 3);
  await hub.sync();
  const { data } = gladys.fake.sceneEvents.at(-1);
  assert.equal(data.action, 'unlock');
  assert.equal(data.trigger, 'button');

  await hub.runAction(LOCK_ID, 'lock');
  assert.deepEqual(mqtt.published.at(-1), { nukiId: LOCK_ID, code: 2 });

  mqtt.emit(LOCK_ID, 'commandResponse', '1');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(gladys.fake.sceneEvents.at(-1).key, 'lock_error');
  assert.equal(gladys.fake.sceneEvents.at(-1).data.error, 'command_failed');

  mqtt.setConnected(false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(hub.transportOf(LOCK_ID).transport, 'unreachable');
});

test('full lock falls back to lock on a Smart Lock 2.0', async (t) => {
  const bridge = fakeBridge([{ ...bridgeLock(), deviceType: 0 }]);
  const { hub } = await startHub(t, { bridge });
  await hub.runAction(LOCK_ID, 'full_lock');
  assert.equal(bridge.actions.at(-1).action, 2);
});

test('a new accessory refreshes the Discovery tab', async (t) => {
  const bridge = fakeBridge([bridgeLock({ doorsensorState: 1 })]);
  const { gladys, hub } = await startHub(t, { bridge });
  await hub.publishDiscoveredDevices();
  const before = gladys.fake.discoveredDevices[0].features.length;
  bridge.devices = [bridgeLock({ doorsensorState: 2 })];
  await hub.refresh();
  assert.equal(gladys.fake.discoveredDevices[0].features.length, before + 2, 'door + its battery');
});

test('MQTT alone: no keypad feature unless a keypad is known', async (t) => {
  // Field report: an MQTT lock without keypad showed "Battery low" twice.
  const mqtt = fakeMqtt();
  const { hub } = await startHub(t, { mqtt, config: { mqtt_url: '192.168.1.10' } });
  for (const [topic, payload] of [
    ['deviceType', 4],
    ['name', 'Maison'],
    ['state', 1],
    ['batteryChargeState', 80],
    ['batteryCritical', 'false'],
    ['batteryCharging', 'false'],
    ['keypadBatteryCritical', 'false'],
    ['doorsensorState', 1],
    ['doorsensorBatteryCritical', 'false'],
  ]) {
    mqtt.emit(LOCK_ID, topic, payload);
  }
  await hub.sync();
  const [device] = hub.buildDiscoveredDevices();
  const keys = device.features.map((feature) => feature.external_id.split(':').pop());
  assert.deepEqual(keys, ['lock', 'state', 'battery', 'battery-low', 'charging']);
  const categories = device.features.map((feature) => `${feature.category}/${feature.type}`);
  assert.equal(new Set(categories).size, categories.length, 'no two features look alike');
});

test('MQTT with a Bridge that reports a keypad keeps the keypad feature', async (t) => {
  const mqtt = fakeMqtt();
  const bridge = fakeBridge([bridgeLock()]);
  const { hub } = await startHub(t, {
    mqtt,
    bridge,
    config: { ...BRIDGE_CONFIG, mqtt_url: '192.168.1.10' },
  });
  mqtt.emit(LOCK_ID, 'state', 1);
  mqtt.emit(LOCK_ID, 'keypadBatteryCritical', 'false');
  await hub.sync();
  assert.equal(hub.resolve(LOCK_ID).source, 'mqtt');
  const [device] = hub.buildDiscoveredDevices();
  assert.ok(device.features.some((feature) => feature.external_id.endsWith(':keypad-battery-low')));
});
