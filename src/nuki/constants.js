// -----------------------------------------------------------------------------
// Nuki protocol constants, shared by the three backends (Bridge HTTP API,
// Smart Lock MQTT API, Nuki Web API) and normalized into one vocabulary.
//
// References:
//   - Bridge HTTP API 1.13: https://developer.nuki.io/page/nuki-bridge-http-api-1-13/4
//   - MQTT API 1.5:         https://developer.nuki.io/page/nuki-smart-lock-mqtt-api/2
//   - Web API:              https://api.nuki.io (Swagger)
// -----------------------------------------------------------------------------

// Device types, as reported by the Bridge (`deviceType`), the MQTT API
// (`deviceType` topic) and the Web API (`type`). The values agree, except
// that the Web API also knows the Box (1), which has no lock to drive.
export const NUKI_DEVICE_TYPES = {
  SMARTLOCK: 0, // Smart Lock 1.0 / 2.0
  BOX: 1,
  OPENER: 2,
  SMARTDOOR: 3,
  SMARTLOCK_3: 4, // Smart Lock 3.0 / 3.0 Pro / 4th generation
  SMARTLOCK_ULTRA: 5, // Smart Lock Ultra / 5th generation
};

export const DEVICE_KINDS = {
  LOCK: 'lock',
  OPENER: 'opener',
};

const MODEL_NAMES = {
  [NUKI_DEVICE_TYPES.SMARTLOCK]: 'Nuki Smart Lock',
  [NUKI_DEVICE_TYPES.OPENER]: 'Nuki Opener',
  [NUKI_DEVICE_TYPES.SMARTDOOR]: 'Nuki Smart Door',
  [NUKI_DEVICE_TYPES.SMARTLOCK_3]: 'Nuki Smart Lock 3.0 / 4.0',
  [NUKI_DEVICE_TYPES.SMARTLOCK_ULTRA]: 'Nuki Smart Lock Ultra',
};

/** Kind of a Nuki device type, `null` when Gladys has nothing to drive (Box). */
export function kindOf(deviceType) {
  if (deviceType === NUKI_DEVICE_TYPES.OPENER) {
    return DEVICE_KINDS.OPENER;
  }
  if (deviceType === NUKI_DEVICE_TYPES.BOX) {
    return null;
  }
  return DEVICE_KINDS.LOCK;
}

export function modelName(deviceType) {
  return MODEL_NAMES[deviceType] ?? 'Nuki Smart Lock';
}

/** Rechargeable models report their charging state (power pack). */
export function canCharge(deviceType) {
  return (
    deviceType === NUKI_DEVICE_TYPES.SMARTLOCK_3 || deviceType === NUKI_DEVICE_TYPES.SMARTLOCK_ULTRA
  );
}

/** The "full lock" (two turns) action exists from the Smart Lock 3.0 on. */
export function canFullLock(deviceType) {
  return canCharge(deviceType);
}

// Smart Lock states (Bridge `state`, MQTT `state`, Web `state.state`).
export const LOCK_STATES = {
  UNCALIBRATED: 0,
  LOCKED: 1,
  UNLOCKING: 2,
  UNLOCKED: 3,
  LOCKING: 4,
  UNLATCHED: 5,
  UNLOCKED_LOCK_N_GO: 6,
  UNLATCHING: 7,
  BOOT_RUN: 253,
  MOTOR_BLOCKED: 254,
  UNDEFINED: 255,
};

export const LOCK_STATE_NAMES = {
  0: 'uncalibrated',
  1: 'locked',
  2: 'unlocking',
  3: 'unlocked',
  4: 'locking',
  5: 'unlatched',
  6: 'unlocked_lock_n_go',
  7: 'unlatching',
  253: 'boot_run',
  254: 'motor_blocked',
  255: 'undefined',
};

// Opener states.
export const OPENER_STATES = {
  UNTRAINED: 0,
  ONLINE: 1,
  RTO_ACTIVE: 3,
  OPEN: 5,
  OPENING: 7,
  BOOT_RUN: 253,
  UNDEFINED: 255,
};

export const OPENER_STATE_NAMES = {
  0: 'untrained',
  1: 'online',
  3: 'rto_active',
  5: 'open',
  7: 'opening',
  253: 'boot_run',
  255: 'undefined',
};

// Opener modes: 2 = door mode, 3 = continuous mode.
export const OPENER_MODES = {
  DOOR: 2,
  CONTINUOUS: 3,
};

// Door sensor states (Bridge `doorsensorState`, MQTT `doorsensorState`, Web
// `state.doorState`).
export const DOOR_STATES = {
  UNAVAILABLE: 0,
  DEACTIVATED: 1,
  CLOSED: 2,
  OPENED: 3,
  UNKNOWN: 4,
  CALIBRATING: 5,
  UNCALIBRATED: 16,
  TAMPERED: 240,
  UNDEFINED: 255,
};

/** A door sensor is paired and active (the feature is worth publishing). */
export function hasDoorSensor(doorState) {
  return (
    typeof doorState === 'number' &&
    doorState !== DOOR_STATES.UNAVAILABLE &&
    doorState !== DOOR_STATES.DEACTIVATED
  );
}

// Gladys LOCK.STATE values (server/utils/constants.js).
export const GLADYS_LOCK_STATE = {
  UNLOCKED: 0,
  LOCKED: 1,
  ACTIVITY: 2,
  ERROR: 3,
};

// Gladys OPENING_SENSOR_STATE values: 1 = closed, 0 = open.
export const GLADYS_OPENING_STATE = {
  OPEN: 0,
  CLOSED: 1,
};

const LOCK_STATE_TO_GLADYS = {
  0: GLADYS_LOCK_STATE.ERROR,
  1: GLADYS_LOCK_STATE.LOCKED,
  2: GLADYS_LOCK_STATE.ACTIVITY,
  3: GLADYS_LOCK_STATE.UNLOCKED,
  4: GLADYS_LOCK_STATE.ACTIVITY,
  5: GLADYS_LOCK_STATE.UNLOCKED,
  6: GLADYS_LOCK_STATE.UNLOCKED,
  7: GLADYS_LOCK_STATE.ACTIVITY,
  253: GLADYS_LOCK_STATE.ERROR,
  254: GLADYS_LOCK_STATE.ERROR,
  255: GLADYS_LOCK_STATE.ERROR,
};

/** Nuki lock state -> Gladys LOCK.STATE (the read-only `state` feature). */
export function toGladysLockState(nukiState) {
  return LOCK_STATE_TO_GLADYS[nukiState] ?? GLADYS_LOCK_STATE.ERROR;
}

/**
 * Nuki lock state -> the binary `lock` feature (1 = locked), or `null` when
 * the state says nothing about the bolt (error, boot run): a binary feature
 * has no "error" value, so nothing is published.
 */
export function toGladysLockBinary(nukiState) {
  switch (nukiState) {
    case LOCK_STATES.LOCKED:
    case LOCK_STATES.LOCKING:
      return 1;
    case LOCK_STATES.UNLOCKED:
    case LOCK_STATES.UNLOCKING:
    case LOCK_STATES.UNLATCHED:
    case LOCK_STATES.UNLATCHING:
    case LOCK_STATES.UNLOCKED_LOCK_N_GO:
      return 0;
    default:
      return null;
  }
}

/** Door sensor state -> Gladys opening sensor (1 closed, 0 open), `null` if unknown. */
export function toGladysDoorState(doorState) {
  if (doorState === DOOR_STATES.CLOSED) {
    return GLADYS_OPENING_STATE.CLOSED;
  }
  if (doorState === DOOR_STATES.OPENED) {
    return GLADYS_OPENING_STATE.OPEN;
  }
  return null;
}

// Normalized action names, the vocabulary of the scene actions and triggers.
// Keys are forever: scenes store them.
export const LOCK_ACTIONS = {
  UNLOCK: 'unlock',
  LOCK: 'lock',
  UNLATCH: 'unlatch',
  LOCK_N_GO: 'lock_n_go',
  LOCK_N_GO_UNLATCH: 'lock_n_go_unlatch',
  FULL_LOCK: 'full_lock',
};

export const OPENER_ACTIONS = {
  ACTIVATE_RTO: 'activate_rto',
  DEACTIVATE_RTO: 'deactivate_rto',
  ELECTRIC_STRIKE: 'electric_strike',
  ACTIVATE_CONTINUOUS: 'activate_continuous',
  DEACTIVATE_CONTINUOUS: 'deactivate_continuous',
};

// Numeric codes of the Bridge `/lockAction` and the MQTT `lockAction` topic.
const LOCAL_LOCK_ACTION_CODES = {
  [LOCK_ACTIONS.UNLOCK]: 1,
  [LOCK_ACTIONS.LOCK]: 2,
  [LOCK_ACTIONS.UNLATCH]: 3,
  [LOCK_ACTIONS.LOCK_N_GO]: 4,
  [LOCK_ACTIONS.LOCK_N_GO_UNLATCH]: 5,
  [LOCK_ACTIONS.FULL_LOCK]: 6,
};

const OPENER_ACTION_CODES = {
  [OPENER_ACTIONS.ACTIVATE_RTO]: 1,
  [OPENER_ACTIONS.DEACTIVATE_RTO]: 2,
  [OPENER_ACTIONS.ELECTRIC_STRIKE]: 3,
  [OPENER_ACTIONS.ACTIVATE_CONTINUOUS]: 4,
  [OPENER_ACTIONS.DEACTIVATE_CONTINUOUS]: 5,
};

/**
 * Numeric code of a normalized action, for the Bridge and the MQTT API.
 * Throws on an action the device kind does not know.
 */
export function localActionCode(kind, action) {
  const table = kind === DEVICE_KINDS.OPENER ? OPENER_ACTION_CODES : LOCAL_LOCK_ACTION_CODES;
  const code = table[action];
  if (code === undefined) {
    throw new Error(`Action "${action}" is not supported by a Nuki ${kind}`);
  }
  return code;
}

/**
 * Body of the Web API `POST /smartlock/{id}/action`. The Web API has no
 * dedicated "full lock" code: it is a lock with the option mask 4.
 */
export function webActionBody(kind, action) {
  if (kind !== DEVICE_KINDS.OPENER && action === LOCK_ACTIONS.FULL_LOCK) {
    return { action: LOCAL_LOCK_ACTION_CODES[LOCK_ACTIONS.LOCK], option: 4 };
  }
  return { action: localActionCode(kind, action) };
}

/** Normalized action of a Web log / MQTT lockActionEvent code, `null` if unknown. */
export function actionFromCode(kind, code) {
  const table = kind === DEVICE_KINDS.OPENER ? OPENER_ACTION_CODES : LOCAL_LOCK_ACTION_CODES;
  const entry = Object.entries(table).find(([, value]) => value === Number(code));
  return entry ? entry[0] : null;
}

/**
 * Normalized action a lock state transition stands for, `null` when the new
 * state is not a resting one (locking, unlocking...) or not a bolt state.
 */
export function actionFromLockState(nukiState) {
  switch (nukiState) {
    case LOCK_STATES.LOCKED:
      return LOCK_ACTIONS.LOCK;
    case LOCK_STATES.UNLOCKED:
      return LOCK_ACTIONS.UNLOCK;
    case LOCK_STATES.UNLATCHED:
      return LOCK_ACTIONS.UNLATCH;
    case LOCK_STATES.UNLOCKED_LOCK_N_GO:
      return LOCK_ACTIONS.LOCK_N_GO;
    default:
      return null;
  }
}

// Normalized triggers (who / what operated the lock). Keys are forever.
export const TRIGGERS = {
  APP: 'app',
  MANUAL: 'manual',
  BUTTON: 'button',
  AUTOMATIC: 'automatic',
  WEB: 'web',
  AUTO_LOCK: 'auto_lock',
  ACCESSORY: 'accessory',
  KEYPAD: 'keypad',
  FINGERPRINT: 'fingerprint',
  HOMEKIT: 'homekit',
  MQTT: 'mqtt',
  GLADYS: 'gladys',
  UNKNOWN: 'unknown',
};

// Web API log `trigger` codes.
const WEB_TRIGGERS = {
  0: TRIGGERS.APP, // system (Bluetooth command of the app)
  1: TRIGGERS.MANUAL,
  2: TRIGGERS.BUTTON,
  3: TRIGGERS.AUTOMATIC,
  4: TRIGGERS.WEB,
  5: TRIGGERS.APP,
  6: TRIGGERS.AUTO_LOCK,
  7: TRIGGERS.ACCESSORY,
  255: TRIGGERS.KEYPAD,
};

// MQTT `lockActionEvent` trigger codes (MQTT API 3.7).
const MQTT_TRIGGERS = {
  0: TRIGGERS.APP, // system / Bluetooth command
  2: TRIGGERS.BUTTON,
  3: TRIGGERS.AUTOMATIC,
  6: TRIGGERS.AUTO_LOCK,
  171: TRIGGERS.HOMEKIT,
  172: TRIGGERS.MQTT,
  255: TRIGGERS.KEYPAD,
};

/** Normalized trigger of a Web API log entry (`source` 1 = keypad code, 2 = fingerprint). */
export function webTrigger(trigger, source) {
  if (Number(source) === 2) {
    return TRIGGERS.FINGERPRINT;
  }
  if (Number(source) === 1) {
    return TRIGGERS.KEYPAD;
  }
  return WEB_TRIGGERS[Number(trigger)] ?? TRIGGERS.UNKNOWN;
}

/** Normalized trigger of an MQTT lockActionEvent (a code id means the keypad). */
export function mqttTrigger(trigger, codeId) {
  if (Number(codeId) > 0) {
    return TRIGGERS.KEYPAD;
  }
  return MQTT_TRIGGERS[Number(trigger)] ?? TRIGGERS.UNKNOWN;
}

// Errors the `lock_error` scene trigger reports. Keys are forever.
export const LOCK_ERRORS = {
  MOTOR_BLOCKED: 'motor_blocked',
  UNCALIBRATED: 'uncalibrated',
  COMMAND_FAILED: 'command_failed',
};

/** Error a lock state stands for, `null` for a healthy state. */
export function errorFromLockState(nukiState) {
  if (nukiState === LOCK_STATES.MOTOR_BLOCKED) {
    return LOCK_ERRORS.MOTOR_BLOCKED;
  }
  if (nukiState === LOCK_STATES.UNCALIBRATED) {
    return LOCK_ERRORS.UNCALIBRATED;
  }
  return null;
}

// Components whose battery can run critical (`battery_critical` trigger).
export const BATTERY_COMPONENTS = {
  DEVICE: 'device',
  KEYPAD: 'keypad',
  DOOR_SENSOR: 'door_sensor',
};

/**
 * Convert the platform ids into the one stable id of a device: the 8-digit
 * uppercase hexadecimal Nuki ID, the one MQTT topics carry (`nuki/398172F4`).
 * The Bridge reports it in decimal; the Web API `smartlockId` prefixes it
 * with the device type (`4` + `398172F4`, read as hexadecimal).
 */
export function nukiIdFromBridge(nukiId) {
  return Number(nukiId).toString(16).toUpperCase().padStart(8, '0');
}

export function nukiIdFromWeb(smartlockId) {
  return (Number(smartlockId) % 2 ** 32).toString(16).toUpperCase().padStart(8, '0');
}

export function webSmartlockId(nukiId, deviceType) {
  return parseInt(`${Number(deviceType).toString(16)}${nukiId}`, 16);
}
