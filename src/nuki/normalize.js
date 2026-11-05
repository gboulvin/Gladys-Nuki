// -----------------------------------------------------------------------------
// One snapshot format for the three backends. Everything downstream (device
// payloads, states, scene events, widgets) reads a snapshot and never knows
// whether it came from the Bridge, the MQTT broker or Nuki Web:
//
// {
//   nukiId: '398172F4',          // 8 uppercase hex digits, the stable id
//   deviceType: 4, kind: 'lock' | 'opener',
//   name, model, firmware,
//   state, mode,                 // Nuki codes (see constants.js)
//   batteryCritical, batteryCharge, batteryCharging,
//   hasKeypad, keypadBatteryCritical,
//   doorState, doorsensorBatteryCritical,
//   ringActive, ringTimestamp,   // Opener: ring detected (Bridge only)
//   source: 'bridge' | 'mqtt' | 'web', receivedAt
// }
//
// Unknown values are `null`, never `undefined`, so a snapshot can be compared
// and merged without guards.
// -----------------------------------------------------------------------------

import { kindOf, modelName, nukiIdFromBridge, nukiIdFromWeb } from './constants.js';

const bool = (value) => (value === undefined || value === null ? null : Boolean(value));
const num = (value) =>
  value === undefined || value === null || value === '' ? null : Number(value);

/** Web API firmware as an integer (0x030A07) -> "3.10.7". */
export function formatWebFirmware(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].join('.');
}

/** One entry of the Bridge `/list` answer. `null` for a Box. */
export function fromBridge(item, receivedAt = Date.now()) {
  const deviceType = Number(item.deviceType ?? 0);
  const kind = kindOf(deviceType);
  if (!kind) {
    return null;
  }
  const last = item.lastKnownState ?? {};
  return {
    nukiId: nukiIdFromBridge(item.nukiId),
    deviceType,
    kind,
    name: item.name || modelName(deviceType),
    model: modelName(deviceType),
    firmware: item.firmwareVersion ?? null,
    state: num(last.state),
    mode: num(last.mode),
    batteryCritical: bool(last.batteryCritical),
    batteryCharge: num(last.batteryChargeState),
    batteryCharging: bool(last.batteryCharging),
    // The Bridge only reports the keypad battery when a keypad is paired.
    hasKeypad: 'keypadBatteryCritical' in last,
    keypadBatteryCritical: bool(last.keypadBatteryCritical),
    doorState: num(last.doorsensorState),
    doorsensorBatteryCritical: bool(last.doorsensorBatteryCritical),
    ringActive: bool(last.ringactionState),
    ringTimestamp: last.ringactionTimestamp ?? null,
    source: 'bridge',
    receivedAt,
  };
}

/** One entry of the Web API `GET /smartlock` answer. `null` for a Box. */
export function fromWeb(item, receivedAt = Date.now()) {
  const deviceType = Number(item.type ?? 0);
  const kind = kindOf(deviceType);
  if (!kind) {
    return null;
  }
  const state = item.state ?? {};
  const config = item.config ?? {};
  return {
    nukiId: nukiIdFromWeb(item.smartlockId),
    deviceType,
    kind,
    name: item.name || config.name || modelName(deviceType),
    model: modelName(deviceType),
    firmware: formatWebFirmware(item.firmwareVersion),
    state: num(state.state),
    mode: num(state.mode),
    batteryCritical: bool(state.batteryCritical),
    // The Opener runs on AAA batteries and reports no charge level.
    batteryCharge: kind === 'opener' ? null : num(state.batteryCharge),
    batteryCharging: bool(state.batteryCharging),
    hasKeypad: Boolean(config.keypadPaired || config.keypad2Paired),
    keypadBatteryCritical: bool(state.keypadBatteryCritical),
    doorState: num(state.doorState),
    doorsensorBatteryCritical: bool(state.doorsensorBatteryCritical),
    ringActive: null,
    ringTimestamp: null,
    source: 'web',
    receivedAt,
    // Web-only: the smartlockId the actions need, kept as is.
    smartlockId: item.smartlockId,
  };
}

const MQTT_BOOL = (value) => value === 'true' || value === '1';

/**
 * Fold one MQTT message (`nuki/<id>/<topic>`, payload as a string) into the
 * snapshot of that lock. Returns the new snapshot, or the previous one
 * untouched when the topic carries nothing the snapshot holds.
 */
export function foldMqtt(previous, nukiId, topic, payload, receivedAt = Date.now()) {
  const base = previous ?? {
    nukiId,
    // Only the Smart Locks 3.0+ speak MQTT: the deviceType topic confirms it.
    deviceType: 4,
    kind: 'lock',
    name: modelName(4),
    model: modelName(4),
    firmware: null,
    state: null,
    mode: null,
    batteryCritical: null,
    batteryCharge: null,
    batteryCharging: null,
    hasKeypad: false,
    keypadBatteryCritical: null,
    doorState: null,
    doorsensorBatteryCritical: null,
    ringActive: null,
    ringTimestamp: null,
    source: 'mqtt',
  };
  const next = { ...base, receivedAt };
  switch (topic) {
    case 'deviceType': {
      const deviceType = Number(payload);
      next.deviceType = deviceType;
      next.kind = kindOf(deviceType) ?? 'lock';
      next.model = modelName(deviceType);
      if (!previous?.nameFromTopic) {
        next.name = modelName(deviceType);
      }
      break;
    }
    case 'name':
      next.name = payload || next.name;
      next.nameFromTopic = true;
      break;
    case 'firmware':
      next.firmware = payload || null;
      break;
    case 'state':
      next.state = num(payload);
      break;
    case 'mode':
      next.mode = num(payload);
      break;
    case 'batteryCritical':
      next.batteryCritical = MQTT_BOOL(payload);
      break;
    case 'batteryChargeState':
      next.batteryCharge = num(payload);
      break;
    case 'batteryCharging':
      next.batteryCharging = MQTT_BOOL(payload);
      break;
    case 'keypadBatteryCritical':
      next.keypadBatteryCritical = MQTT_BOOL(payload);
      // The lock publishes this topic with or without a paired keypad: only
      // a critical alert proves there is one. The Bridge and Nuki Web know
      // for sure (see NukiHub.resolve).
      next.hasKeypad = next.hasKeypad || next.keypadBatteryCritical;
      break;
    case 'doorsensorState':
      next.doorState = num(payload);
      break;
    case 'doorsensorBatteryCritical':
      next.doorsensorBatteryCritical = MQTT_BOOL(payload);
      break;
    default:
      return previous ?? null;
  }
  return next;
}

/** Parse an MQTT `lockActionEvent` payload: "action,trigger,authId,codeId,autoUnlock". */
export function parseLockActionEvent(payload) {
  const [action, trigger, authId, codeId, extra] = String(payload).split(',').map(Number);
  return { action, trigger, authId, codeId, extra };
}
