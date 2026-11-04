// End-to-end: the real wiring (src/app.js) against the fake Gladys of the SDK.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createApp } from '../src/app.js';
import {
  LOCK_ID,
  OPENER_ID,
  bridgeLock,
  bridgeOpener,
  factoriesFor,
  fakeBridge,
  fakeGladys,
  fakeWeb,
  memoryHistory,
  webLock,
} from './helpers.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const declared = (list, key) => manifest[list].find((entry) => entry.key === key);
const declaredKeys = (list, key, part) =>
  (declared(list, key)[part] ?? []).map((entry) => entry.key);

const CONFIG = { bridge_ip: '192.168.1.50', bridge_token: 'tok', web_api_token: 'web' };

async function startApp(
  t,
  { config = CONFIG, bridgeDevices, webDevices = [webLock()], logs = [] } = {},
) {
  const bridge = fakeBridge(bridgeDevices ?? [bridgeLock(), bridgeOpener()]);
  const web = fakeWeb(webDevices, logs);
  const gladys = fakeGladys({ config });
  const discover = async () => [{ id: 1, ip: '192.168.1.77', port: 8080 }];
  const app = createApp(gladys, {
    factories: { ...factoriesFor({ bridge, web }), discover },
    history: memoryHistory(),
  });
  await gladys.connect();
  await app.ready();
  t.after(() => app.stop());
  for (const device of gladys.fake.discoveredDevices) {
    await gladys.fake.deviceCreated(device);
  }
  return { gladys, app, bridge, web };
}

const lockDevice = (gladys) =>
  gladys.fake.devices.find(
    (device) => device.external_id === gladys.externalIds('lock', LOCK_ID).device,
  );
const openerDevice = (gladys) =>
  gladys.fake.devices.find(
    (device) => device.external_id === gladys.externalIds('opener', OPENER_ID).device,
  );
const feature = (device, key) => device.features.find((f) => f.external_id.endsWith(`:${key}`));

test('on connection: devices discovered, connection reported', async (t) => {
  const { gladys } = await startApp(t);
  assert.equal(gladys.fake.discoveredDevices.length, 2);
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
  // Created devices get their states right away.
  assert.equal(gladys.fake.lastState(gladys.externalIds('lock', LOCK_ID).feature('battery')), 85);
});

test('the lock switch locks and unlocks through the Bridge', async (t) => {
  const { gladys, bridge } = await startApp(t);
  const lock = lockDevice(gladys);
  assert.deepEqual(await gladys.fake.setValue(lock, feature(lock, 'lock'), 0), { success: true });
  assert.equal(bridge.actions.at(-1).action, 1, 'unlock');
  await gladys.fake.setValue(lock, feature(lock, 'lock'), 1);
  assert.equal(bridge.actions.at(-1).action, 2, 'lock');
  const ack = await gladys.fake.setValue(lock, feature(lock, 'battery'), 1);
  assert.equal(ack.success, false, 'read-only feature');
});

test('the lock switch follows the unlock / lock options', async (t) => {
  const { gladys, bridge } = await startApp(t, {
    config: { ...CONFIG, unlock_action: 'unlatch', lock_action: 'full_lock' },
  });
  const lock = lockDevice(gladys);
  await gladys.fake.setValue(lock, feature(lock, 'lock'), 0);
  assert.equal(bridge.actions.at(-1).action, 3, 'unlatch');
  await gladys.fake.setValue(lock, feature(lock, 'lock'), 1);
  assert.equal(bridge.actions.at(-1).action, 6, 'full lock');
});

test('the Opener switches drive Ring to Open and the continuous mode', async (t) => {
  const { gladys, bridge } = await startApp(t);
  const opener = openerDevice(gladys);
  await gladys.fake.setValue(opener, feature(opener, 'ring-to-open'), 1);
  assert.deepEqual(bridge.actions.at(-1), {
    nukiId: parseInt(OPENER_ID, 16),
    deviceType: 2,
    action: 1,
  });
  await gladys.fake.setValue(opener, feature(opener, 'continuous-mode'), 0);
  assert.equal(bridge.actions.at(-1).action, 5);
});

test('scene actions resolve their declared outputs', async (t) => {
  const { gladys, bridge } = await startApp(t);
  const lockId = gladys.externalIds('lock', LOCK_ID).device;
  const openerId = gladys.externalIds('opener', OPENER_ID).device;

  let ack = await gladys.fake.sceneAction('operate_lock', { device: lockId, action: 'unlatch' });
  assert.deepEqual(ack.data?.outputs ?? ack.data, { success: true });
  assert.equal(bridge.actions.at(-1).action, 3);

  ack = await gladys.fake.sceneAction('operate_opener', {
    device: openerId,
    action: 'electric_strike',
  });
  assert.deepEqual(ack.data?.outputs ?? ack.data, { success: true });

  ack = await gladys.fake.sceneAction('operate_lock', { device: openerId, action: 'lock' });
  assert.deepEqual(ack.data?.outputs ?? ack.data, { success: false }, 'an Opener is not a lock');

  ack = await gladys.fake.sceneAction('get_lock_status', { device: lockId });
  const status = ack.data?.outputs ?? ack.data;
  assert.deepEqual(status, {
    reachable: true,
    state: 'locked',
    battery_critical: false,
    locked: true,
    battery: 85,
    door_open: false,
  });
  for (const key of Object.keys(status)) {
    assert.ok(declaredKeys('scene_actions', 'get_lock_status', 'outputs').includes(key), key);
  }

  ack = await gladys.fake.sceneAction('lock_all', {});
  assert.deepEqual(ack.data?.outputs ?? ack.data, { locked_count: 1, failed_count: 0 });
});

test('scene events only carry declared keys', async (t) => {
  const { gladys, app, bridge } = await startApp(t);
  bridge.devices = [
    bridgeLock({ state: 3, batteryCritical: true }),
    bridgeOpener({ ringactionState: true, ringactionTimestamp: '2026-11-04T11:00:00+00:00' }),
  ];
  await app.hub.refresh();
  assert.ok(gladys.fake.sceneEvents.length >= 3);
  for (const { key, data } of gladys.fake.sceneEvents) {
    const allowed = [
      ...declaredKeys('scene_triggers', key, 'fields'),
      ...declaredKeys('scene_triggers', key, 'variables'),
    ];
    for (const [name, value] of Object.entries(data)) {
      assert.ok(allowed.includes(name), `${key}: data.${name} is not declared`);
      assert.ok(
        value === null || typeof value !== 'object',
        `${key}: data.${name} must be a primitive`,
      );
    }
  }
});

test('the widgets are rendered exactly as sent', async (t) => {
  const { gladys, app, bridge } = await startApp(t);
  // Some activity for the activity widget and the "last activity" rows.
  bridge.devices = [bridgeLock({ state: 3 }), bridgeOpener()];
  await app.hub.refresh();
  const lockId = gladys.externalIds('lock', LOCK_ID).device;
  const openerId = gladys.externalIds('opener', OPENER_ID).device;
  const requests = [
    ['nuki_lock', { device: lockId }],
    ['nuki_lock', { device: openerId }],
    ['nuki_lock', {}],
    ['nuki_lock', { device: 'ext:test-integration:lock:00000000' }],
    ['nuki_overview', {}],
    ['nuki_activity', {}],
  ];
  for (const [key, settings] of requests) {
    for (const language of ['en', 'fr', 'de', 'es']) {
      const content = await app.widgets[key].get({ settings, language, units: 'metric' });
      assert.deepEqual(
        validateWidgetContent(content),
        [],
        `${key} ${JSON.stringify(settings)} ${language}`,
      );
    }
  }
});

test('the live tiles and buttons reference published features', async (t) => {
  const { gladys, app } = await startApp(t);
  const featureIds = new Set(
    gladys.fake.discoveredDevices.flatMap((d) => d.features.map((f) => f.external_id)),
  );
  for (const device of [
    gladys.externalIds('lock', LOCK_ID).device,
    gladys.externalIds('opener', OPENER_ID).device,
  ]) {
    const content = await app.widgets.nuki_lock.get({ settings: { device } });
    for (const component of content.components.filter((c) => c.device_feature)) {
      assert.ok(featureIds.has(component.device_feature), component.device_feature);
    }
  }
});

test('the widget buttons run their actions and answer a toast', async (t) => {
  const { gladys, app, bridge } = await startApp(t);
  for (const [key, device] of [
    ['nuki_lock', gladys.externalIds('lock', LOCK_ID).device],
    ['nuki_lock', gladys.externalIds('opener', OPENER_ID).device],
    ['nuki_overview', null],
  ]) {
    const content = await app.widgets[key].get({ settings: { device } });
    for (const { action } of content.components.filter((c) => c.type === 'button' && c.action)) {
      const ack = await gladys.fake.widgetAction(key, action.key, action.params ?? {}, {
        settings: { device },
      });
      assert.equal(ack.success, true, `${key}.${action.key}: ${ack.error}`);
      assert.ok(JSON.stringify(ack.data).length > 0);
    }
  }
  assert.ok(
    bridge.actions.some((a) => a.action === 3 && a.deviceType === 4),
    'door opened',
  );
  assert.ok(
    bridge.actions.some((a) => a.action === 3 && a.deviceType === 2),
    'buzzer',
  );
  const ack = await gladys.fake.widgetAction('nuki_lock', 'nope', {}, { settings: {} });
  assert.equal(ack.success, false);
});

test('the activity widget shows the Nuki Web log with the users', async (t) => {
  const logs = [
    {
      smartlockId: parseInt(`4${LOCK_ID}`, 16),
      deviceType: 4,
      name: 'Alice',
      action: 1,
      trigger: 0,
      source: 1,
      date: '2026-11-04T08:00:00.000Z',
    },
    {
      smartlockId: parseInt(`4${LOCK_ID}`, 16),
      deviceType: 4,
      name: '',
      action: 240,
      trigger: 0,
      source: 0,
      date: '2026-11-04T07:59:00.000Z',
    },
  ];
  const { app } = await startApp(t, { logs });
  const content = await app.widgets.nuki_activity.get({ settings: {} });
  const [list] = content.components;
  assert.equal(list.type, 'card-list');
  assert.equal(list.items.length, 1, 'door events are not operations');
  assert.equal(list.items[0].title.fr, 'Déverrouillage par Alice');
  assert.equal(list.items[0].subtitle.en, 'Front door');
});

test('manifest actions: test, find and pair the Bridge, refresh', async (t) => {
  const { gladys } = await startApp(t);
  let ack = await gladys.fake.action('test_connection', {});
  assert.equal(ack.success, true);
  assert.match(
    ack.data.en ?? ack.data.message?.en ?? JSON.stringify(ack.data),
    /Bridge OK: 2 device/,
  );
  assert.match(JSON.stringify(ack.data), /Nuki Web OK/);

  ack = await gladys.fake.action('discover_bridge', {});
  assert.match(JSON.stringify(ack.data), /192\.168\.1\.77/);
  assert.equal(gladys.fake.config.bridge_ip, '192.168.1.77', 'saved in the configuration');

  ack = await gladys.fake.action('pair_bridge', {});
  assert.match(JSON.stringify(ack.data), /API token is saved/);
  assert.equal(gladys.fake.config.bridge_token, 'new-token');

  ack = await gladys.fake.action('refresh_devices', {});
  assert.match(JSON.stringify(ack.data), /Refreshed: 2 device/);
});

test('a config update restarts the channels', async (t) => {
  const { gladys, app } = await startApp(t);
  await gladys.fake.configUpdated({ web_api_token: 'web' });
  await app.ready();
  assert.equal(app.config.bridge_ip, '');
  assert.equal(app.hub.health.bridge.configured, false);
  assert.equal(app.hub.transportOf(LOCK_ID).transport, 'cloud');
});
