// -----------------------------------------------------------------------------
// Gladys devices of the Nuki range, built from a snapshot (src/nuki/normalize.js).
//
// External ids are forever: `gladys.externalIds(kind, nukiId)`, the Nuki ID
// being the 8-hex-digit id every backend agrees on, and the feature keys
// below never change. A device found through the Bridge, MQTT or Nuki Web is
// the SAME Gladys device: switching channel keeps its history and scenes.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';
import {
  DEVICE_KINDS,
  LOCK_ACTIONS,
  OPENER_ACTIONS,
  OPENER_MODES,
  OPENER_STATES,
  canCharge,
  hasDoorSensor,
  toGladysDoorState,
  toGladysLockBinary,
  toGladysLockState,
} from './nuki/constants.js';

// Feature keys (the last segment of the feature external_id). Forever.
export const FEATURES = {
  LOCK: 'lock',
  STATE: 'state',
  BATTERY: 'battery',
  BATTERY_LOW: 'battery-low',
  CHARGING: 'charging',
  DOOR: 'door',
  DOOR_SENSOR_BATTERY_LOW: 'door-sensor-battery-low',
  KEYPAD_BATTERY_LOW: 'keypad-battery-low',
  RING_TO_OPEN: 'ring-to-open',
  CONTINUOUS_MODE: 'continuous-mode',
  DOORBELL: 'doorbell',
};

export function deviceIds(gladys, snapshot) {
  return gladys.externalIds(snapshot.kind, snapshot.nukiId);
}

/** `{ kind, nukiId }` of a device external_id of this integration, or null. */
export function parseDeviceExternalId(gladys, externalId) {
  const prefix = gladys.externalId('');
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return null;
  }
  const [kind, nukiId] = externalId.slice(prefix.length).split(':');
  if (!Object.values(DEVICE_KINDS).includes(kind) || !/^[0-9A-F]{8}$/.test(nukiId ?? '')) {
    return null;
  }
  return { kind, nukiId };
}

const binarySensor = (name, externalId, category, type = T.SENSOR.BINARY) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 0,
  max: 1,
});

function lockFeatures(ids, snapshot) {
  const features = [
    {
      name: 'Lock',
      external_id: ids.feature(FEATURES.LOCK),
      category: C.LOCK,
      type: T.LOCK.BINARY,
      read_only: false,
      has_feedback: true,
      keep_history: true,
      min: 0,
      max: 1,
    },
    {
      name: 'Lock state',
      external_id: ids.feature(FEATURES.STATE),
      category: C.LOCK,
      type: T.LOCK.STATE,
      read_only: true,
      has_feedback: false,
      keep_history: true,
      min: 0,
      max: 3,
    },
  ];
  if (snapshot.batteryCharge !== null) {
    features.push({
      name: 'Battery',
      external_id: ids.feature(FEATURES.BATTERY),
      category: C.BATTERY,
      type: T.BATTERY.INTEGER,
      unit: U.PERCENT,
      read_only: true,
      has_feedback: false,
      keep_history: true,
      min: 0,
      max: 100,
    });
  }
  features.push(
    binarySensor(
      'Battery low',
      ids.feature(FEATURES.BATTERY_LOW),
      C.BATTERY_LOW,
      T.BATTERY_LOW.BINARY,
    ),
  );
  if (canCharge(snapshot.deviceType)) {
    features.push(
      binarySensor('Charging', ids.feature(FEATURES.CHARGING), C.BATTERY, T.BATTERY.CHARGING),
    );
  }
  if (hasDoorSensor(snapshot.doorState)) {
    features.push(
      binarySensor('Door', ids.feature(FEATURES.DOOR), C.OPENING_SENSOR),
      binarySensor(
        'Door sensor battery low',
        ids.feature(FEATURES.DOOR_SENSOR_BATTERY_LOW),
        C.BATTERY_LOW,
        T.BATTERY_LOW.BINARY,
      ),
    );
  }
  if (snapshot.hasKeypad) {
    features.push(
      binarySensor(
        'Keypad battery low',
        ids.feature(FEATURES.KEYPAD_BATTERY_LOW),
        C.BATTERY_LOW,
        T.BATTERY_LOW.BINARY,
      ),
    );
  }
  return features;
}

function openerFeatures(ids, snapshot) {
  const switchFeature = (name, key) => ({
    name,
    external_id: ids.feature(key),
    category: C.SWITCH,
    type: T.SWITCH.BINARY,
    read_only: false,
    has_feedback: true,
    keep_history: true,
    min: 0,
    max: 1,
  });
  const features = [
    switchFeature('Ring to Open', FEATURES.RING_TO_OPEN),
    switchFeature('Continuous mode', FEATURES.CONTINUOUS_MODE),
    binarySensor(
      'Battery low',
      ids.feature(FEATURES.BATTERY_LOW),
      C.BATTERY_LOW,
      T.BATTERY_LOW.BINARY,
    ),
  ];
  // Ring detection is only reported by the Bridge.
  if (snapshot.source === 'bridge') {
    features.push({
      name: 'Doorbell',
      external_id: ids.feature(FEATURES.DOORBELL),
      category: C.DOORBELL,
      type: T.DOORBELL.RING,
      read_only: true,
      has_feedback: false,
      keep_history: true,
      min: 0,
      max: 1,
    });
  }
  return features;
}

/** Discovery payload of one Nuki device. */
export function buildDevice(gladys, snapshot) {
  const ids = deviceIds(gladys, snapshot);
  return {
    name: snapshot.name,
    external_id: ids.device,
    model: snapshot.model,
    // The integration refreshes the devices with its own timer and the MQTT
    // push: Gladys must not poll them.
    should_poll: false,
    params: [
      { name: 'NUKI_ID', value: snapshot.nukiId },
      { name: 'NUKI_DEVICE_TYPE', value: String(snapshot.deviceType) },
      ...(snapshot.firmware ? [{ name: 'FIRMWARE', value: String(snapshot.firmware) }] : []),
    ],
    features:
      snapshot.kind === DEVICE_KINDS.OPENER
        ? openerFeatures(ids, snapshot)
        : lockFeatures(ids, snapshot),
  };
}

const asBinary = (value) => (value === null ? null : value ? 1 : 0);

/**
 * States of one device, as `publishChangedStates` entries. Values the
 * snapshot does not know are skipped, never published as 0.
 */
export function buildStates(gladys, snapshot) {
  const ids = deviceIds(gladys, snapshot);
  const values = {};
  if (snapshot.kind === DEVICE_KINDS.OPENER) {
    if (snapshot.state !== null) {
      values[FEATURES.RING_TO_OPEN] = snapshot.state === OPENER_STATES.RTO_ACTIVE ? 1 : 0;
    }
    if (snapshot.mode !== null) {
      values[FEATURES.CONTINUOUS_MODE] = snapshot.mode === OPENER_MODES.CONTINUOUS ? 1 : 0;
    }
    values[FEATURES.BATTERY_LOW] = asBinary(snapshot.batteryCritical);
    if (snapshot.source === 'bridge') {
      values[FEATURES.DOORBELL] = asBinary(snapshot.ringActive);
    }
  } else {
    if (snapshot.state !== null) {
      values[FEATURES.LOCK] = toGladysLockBinary(snapshot.state);
      values[FEATURES.STATE] = toGladysLockState(snapshot.state);
    }
    if (snapshot.batteryCharge !== null) {
      values[FEATURES.BATTERY] = Math.round(snapshot.batteryCharge);
    }
    values[FEATURES.BATTERY_LOW] = asBinary(snapshot.batteryCritical);
    if (canCharge(snapshot.deviceType)) {
      values[FEATURES.CHARGING] = asBinary(snapshot.batteryCharging);
    }
    if (hasDoorSensor(snapshot.doorState)) {
      values[FEATURES.DOOR] = toGladysDoorState(snapshot.doorState);
      values[FEATURES.DOOR_SENSOR_BATTERY_LOW] = asBinary(snapshot.doorsensorBatteryCritical);
    }
    if (snapshot.hasKeypad) {
      values[FEATURES.KEYPAD_BATTERY_LOW] = asBinary(snapshot.keypadBatteryCritical);
    }
  }
  return Object.entries(values)
    .filter(([, state]) => state !== null && state !== undefined)
    .map(([key, state]) => ({ device_feature_external_id: ids.feature(key), state }));
}

/**
 * Nuki action behind a Gladys command (`onSetValue`): the feature key and
 * the value the user set. Throws for a read-only feature.
 */
export function actionForCommand(kind, featureKey, value, config) {
  const on = Number(value) === 1;
  if (kind === DEVICE_KINDS.OPENER) {
    if (featureKey === FEATURES.RING_TO_OPEN) {
      return on ? OPENER_ACTIONS.ACTIVATE_RTO : OPENER_ACTIONS.DEACTIVATE_RTO;
    }
    if (featureKey === FEATURES.CONTINUOUS_MODE) {
      return on ? OPENER_ACTIONS.ACTIVATE_CONTINUOUS : OPENER_ACTIONS.DEACTIVATE_CONTINUOUS;
    }
  } else if (featureKey === FEATURES.LOCK) {
    if (on) {
      return config.lock_action === 'full_lock' ? LOCK_ACTIONS.FULL_LOCK : LOCK_ACTIONS.LOCK;
    }
    return config.unlock_action === 'unlatch' ? LOCK_ACTIONS.UNLATCH : LOCK_ACTIONS.UNLOCK;
  }
  throw new Error(`Feature "${featureKey}" cannot be controlled`);
}
