import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  GLADYS_LOCK_STATE,
  LOCK_ACTIONS,
  OPENER_ACTIONS,
  TRIGGERS,
  actionFromCode,
  actionFromLockState,
  kindOf,
  localActionCode,
  mqttTrigger,
  nukiIdFromBridge,
  nukiIdFromWeb,
  toGladysDoorState,
  toGladysLockBinary,
  toGladysLockState,
  webActionBody,
  webSmartlockId,
  webTrigger,
} from '../src/nuki/constants.js';
import {
  foldMqtt,
  formatWebFirmware,
  fromBridge,
  fromWeb,
  parseLockActionEvent,
} from '../src/nuki/normalize.js';
import { BridgeClient, BridgeError, discoverBridges } from '../src/nuki/bridgeClient.js';
import { WebClient, WebApiError } from '../src/nuki/webClient.js';
import { LOCK_ID, OPENER_ID, bridgeLock, bridgeOpener, webLock } from './helpers.js';

test('the three channels agree on the Nuki ID', () => {
  assert.equal(nukiIdFromBridge(parseInt(LOCK_ID, 16)), LOCK_ID);
  assert.equal(nukiIdFromWeb(parseInt(`4${LOCK_ID}`, 16)), LOCK_ID);
  assert.equal(nukiIdFromWeb(parseInt(`2${OPENER_ID}`, 16)), OPENER_ID);
  assert.equal(nukiIdFromBridge(255), '000000FF', 'padded to 8 digits');
  assert.equal(webSmartlockId(LOCK_ID, 4), parseInt(`4${LOCK_ID}`, 16));
  assert.equal(webSmartlockId(LOCK_ID, 0), parseInt(LOCK_ID, 16), 'Smart Lock 1.0/2.0: no prefix');
});

test('device kinds', () => {
  assert.equal(kindOf(0), 'lock');
  assert.equal(kindOf(4), 'lock');
  assert.equal(kindOf(3), 'lock');
  assert.equal(kindOf(2), 'opener');
  assert.equal(kindOf(1), null, 'the Box has nothing to drive');
});

test('lock states map to the Gladys lock features', () => {
  assert.equal(toGladysLockState(1), GLADYS_LOCK_STATE.LOCKED);
  assert.equal(toGladysLockState(3), GLADYS_LOCK_STATE.UNLOCKED);
  assert.equal(toGladysLockState(5), GLADYS_LOCK_STATE.UNLOCKED);
  assert.equal(toGladysLockState(2), GLADYS_LOCK_STATE.ACTIVITY);
  assert.equal(toGladysLockState(254), GLADYS_LOCK_STATE.ERROR);
  assert.equal(toGladysLockState(42), GLADYS_LOCK_STATE.ERROR);
  assert.equal(toGladysLockBinary(1), 1);
  assert.equal(toGladysLockBinary(4), 1);
  assert.equal(toGladysLockBinary(3), 0);
  assert.equal(toGladysLockBinary(6), 0);
  assert.equal(toGladysLockBinary(254), null, 'no binary value for an error');
  assert.equal(toGladysDoorState(2), 1, 'closed');
  assert.equal(toGladysDoorState(3), 0, 'open');
  assert.equal(toGladysDoorState(4), null);
});

test('action codes per channel', () => {
  assert.equal(localActionCode('lock', LOCK_ACTIONS.UNLOCK), 1);
  assert.equal(localActionCode('lock', LOCK_ACTIONS.LOCK), 2);
  assert.equal(localActionCode('lock', LOCK_ACTIONS.UNLATCH), 3);
  assert.equal(localActionCode('lock', LOCK_ACTIONS.FULL_LOCK), 6);
  assert.equal(localActionCode('opener', OPENER_ACTIONS.ELECTRIC_STRIKE), 3);
  assert.throws(() => localActionCode('opener', LOCK_ACTIONS.LOCK));
  assert.deepEqual(webActionBody('lock', LOCK_ACTIONS.FULL_LOCK), { action: 2, option: 4 });
  assert.deepEqual(webActionBody('lock', LOCK_ACTIONS.UNLOCK), { action: 1 });
  assert.deepEqual(webActionBody('opener', OPENER_ACTIONS.ACTIVATE_RTO), { action: 1 });
  assert.equal(actionFromCode('lock', 3), LOCK_ACTIONS.UNLATCH);
  assert.equal(actionFromCode('opener', 3), OPENER_ACTIONS.ELECTRIC_STRIKE);
  assert.equal(actionFromCode('lock', 240), null, 'door events are not operations');
  assert.equal(actionFromLockState(1), LOCK_ACTIONS.LOCK);
  assert.equal(actionFromLockState(2), null, 'a moving bolt is not a result');
});

test('triggers are normalized', () => {
  assert.equal(webTrigger(5, 0), TRIGGERS.APP);
  assert.equal(webTrigger(1, 0), TRIGGERS.MANUAL);
  assert.equal(webTrigger(0, 1), TRIGGERS.KEYPAD);
  assert.equal(webTrigger(0, 2), TRIGGERS.FINGERPRINT);
  assert.equal(webTrigger(99, 0), TRIGGERS.UNKNOWN);
  assert.equal(mqttTrigger(172, 0), TRIGGERS.MQTT);
  assert.equal(mqttTrigger(0, 12), TRIGGERS.KEYPAD);
  assert.equal(mqttTrigger(6, 0), TRIGGERS.AUTO_LOCK);
});

test('a Bridge entry becomes a snapshot', () => {
  const snapshot = fromBridge(bridgeLock(), 1);
  assert.equal(snapshot.nukiId, LOCK_ID);
  assert.equal(snapshot.kind, 'lock');
  assert.equal(snapshot.name, 'Front door');
  assert.equal(snapshot.state, 1);
  assert.equal(snapshot.batteryCharge, 85);
  assert.equal(snapshot.hasKeypad, true);
  assert.equal(snapshot.doorState, 2);
  assert.equal(snapshot.source, 'bridge');
  const opener = fromBridge(bridgeOpener());
  assert.equal(opener.kind, 'opener');
  assert.equal(opener.batteryCharge, null);
  assert.equal(opener.hasKeypad, false);
  assert.equal(opener.ringActive, false);
  assert.equal(fromBridge({ deviceType: 1, nukiId: 1 }), null);
});

test('a Nuki Web entry becomes the same snapshot', () => {
  const web = fromWeb(webLock(), 1);
  const bridge = fromBridge(bridgeLock(), 1);
  for (const key of [
    'nukiId',
    'deviceType',
    'kind',
    'name',
    'state',
    'batteryCharge',
    'doorState',
    'hasKeypad',
  ]) {
    assert.deepEqual(web[key], bridge[key], key);
  }
  assert.equal(web.firmware, '3.10.7');
  assert.equal(formatWebFirmware(undefined), null);
});

test('MQTT messages fold into a snapshot', () => {
  let snapshot = foldMqtt(undefined, LOCK_ID, 'state', '3');
  assert.equal(snapshot.state, 3);
  snapshot = foldMqtt(snapshot, LOCK_ID, 'name', 'Front door');
  snapshot = foldMqtt(snapshot, LOCK_ID, 'deviceType', '4');
  assert.equal(snapshot.name, 'Front door', 'the deviceType topic keeps a received name');
  snapshot = foldMqtt(snapshot, LOCK_ID, 'batteryCritical', 'true');
  snapshot = foldMqtt(snapshot, LOCK_ID, 'batteryChargeState', '42');
  snapshot = foldMqtt(snapshot, LOCK_ID, 'keypadBatteryCritical', 'false');
  assert.equal(snapshot.batteryCritical, true);
  assert.equal(snapshot.batteryCharge, 42);
  assert.equal(snapshot.hasKeypad, true);
  assert.equal(foldMqtt(snapshot, LOCK_ID, 'serverConnected', 'true'), snapshot, 'ignored topic');
  assert.deepEqual(parseLockActionEvent('1,172,0,0,0'), {
    action: 1,
    trigger: 172,
    authId: 0,
    codeId: 0,
    extra: 0,
  });
});

function fakeFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('the Bridge token is sent hashed by default', async () => {
  const fetchImpl = fakeFetch(() => json([]));
  const bridge = new BridgeClient({ host: '192.168.1.50', token: 'secret', fetch: fetchImpl });
  await bridge.list();
  const url = new URL(fetchImpl.calls[0].url);
  assert.equal(url.origin, 'http://192.168.1.50:8080');
  assert.equal(url.pathname, '/list');
  assert.equal(url.searchParams.get('token'), null, 'never in clear');
  const ts = url.searchParams.get('ts');
  const rnr = url.searchParams.get('rnr');
  assert.match(ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  const expected = createHash('sha256').update(`${ts},${rnr},secret`).digest('hex');
  assert.equal(url.searchParams.get('hash'), expected);
});

test('the plain token is sent when hashing is off', async () => {
  const fetchImpl = fakeFetch(() => json([]));
  const bridge = new BridgeClient({
    host: 'b',
    port: 8081,
    token: 'secret',
    hashedToken: false,
    fetch: fetchImpl,
  });
  await bridge.list();
  assert.equal(new URL(fetchImpl.calls[0].url).searchParams.get('token'), 'secret');
});

test('Bridge requests are serialized, errors are explicit', async () => {
  let running = 0;
  let maxRunning = 0;
  const fetchImpl = fakeFetch(async (url) => {
    running += 1;
    maxRunning = Math.max(maxRunning, running);
    await new Promise((resolve) => setImmediate(resolve));
    running -= 1;
    if (url.includes('/info')) {
      return json({}, 401);
    }
    return json({ success: true });
  });
  const bridge = new BridgeClient({ host: 'b', token: 't', fetch: fetchImpl });
  const results = await Promise.allSettled([
    bridge.lockAction(1, 4, 2),
    bridge.info(),
    bridge.lockAction(1, 4, 1),
  ]);
  assert.equal(maxRunning, 1, 'one request at a time');
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.ok(results[1].reason instanceof BridgeError);
  assert.equal(results[1].reason.status, 401);
  assert.equal(results[2].status, 'fulfilled', 'a failure does not block the queue');
  const action = new URL(fetchImpl.calls[0].url);
  assert.equal(action.searchParams.get('action'), '2');
  assert.equal(action.searchParams.get('nowait'), '1');
});

test('an unreachable Bridge raises a BridgeError', async () => {
  const bridge = new BridgeClient({
    host: 'b',
    token: 't',
    fetch: async () => {
      throw new Error('ECONNREFUSED');
    },
  });
  await assert.rejects(
    bridge.list(),
    (err) => err instanceof BridgeError && /unreachable/.test(err.message),
  );
});

test('Bridge pairing returns the token', async () => {
  const fetchImpl = fakeFetch(() => json({ token: 'abc123', success: true }));
  const bridge = new BridgeClient({ host: 'b', fetch: fetchImpl });
  assert.equal(await bridge.auth(), 'abc123');
  assert.equal(new URL(fetchImpl.calls[0].url).search, '', 'no token to authenticate /auth');
  const refused = new BridgeClient({ host: 'b', fetch: fakeFetch(() => json({ success: false })) });
  await assert.rejects(refused.auth(), /not pressed/);
});

test('Bridge discovery through the Nuki service', async () => {
  const fetchImpl = fakeFetch(() =>
    json({ bridges: [{ bridgeId: 1, ip: '192.168.1.50', port: 8080 }], errorCode: 0 }),
  );
  assert.deepEqual(await discoverBridges({ fetch: fetchImpl }), [
    { id: 1, ip: '192.168.1.50', port: 8080 },
  ]);
  assert.equal(fetchImpl.calls[0].url, 'https://api.nuki.io/discover/bridges');
});

test('the Web client sends the bearer token and the action body', async () => {
  const fetchImpl = fakeFetch((url, init) =>
    init.method === 'POST' ? new Response(null, { status: 204 }) : json([webLock()]),
  );
  const web = new WebClient({ token: 'tok', fetch: fetchImpl });
  assert.equal((await web.smartlocks()).length, 1);
  assert.equal(await web.action(123, { action: 2 }), null);
  assert.equal(fetchImpl.calls[0].url, 'https://api.nuki.io/smartlock');
  assert.equal(fetchImpl.calls[0].init.headers.Authorization, 'Bearer tok');
  assert.equal(fetchImpl.calls[1].url, 'https://api.nuki.io/smartlock/123/action');
  assert.equal(fetchImpl.calls[1].init.body, '{"action":2}');
  const refused = new WebClient({ token: 'bad', fetch: fakeFetch(() => json({}, 401)) });
  await assert.rejects(
    refused.smartlocks(),
    (err) => err instanceof WebApiError && err.status === 401,
  );
});
