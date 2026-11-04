// -----------------------------------------------------------------------------
// Scene actions (SDK v0.14+, Gladys 5.1+): what a scene can ask a Nuki device.
//
//   - operate_lock    : lock, unlock, open the door, Lock 'n' Go, full lock;
//   - operate_opener  : buzz the door, Ring to Open, continuous mode;
//   - get_lock_status : read a lock (locked? door open? battery?) for the
//                       following actions of the scene;
//   - lock_all        : lock every Nuki lock ("leaving home" scenes).
//
// Rules: `fields` arrive RESOLVED (a `"source": "devices"` field is the
// device external_id); the handler resolves the declared `outputs`, scalars
// only. A device that cannot be reached is an output (`success: false`), not
// a thrown error: the scene author gates the next actions on it. Never fire a
// scene event as a consequence of an action (loops): the lock operations a
// command causes are attributed to `trigger: gladys`, which the trigger
// filters can exclude.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import {
  DEVICE_KINDS,
  LOCK_ACTIONS,
  LOCK_STATE_NAMES,
  OPENER_ACTIONS,
  OPENER_STATE_NAMES,
  hasDoorSensor,
  toGladysLockBinary,
  toGladysDoorState,
  GLADYS_OPENING_STATE,
} from './nuki/constants.js';

const logger = createLogger({ name: 'scenes' });

export const SCENE_ACTION_KEYS = {
  OPERATE_LOCK: 'operate_lock',
  OPERATE_OPENER: 'operate_opener',
  GET_LOCK_STATUS: 'get_lock_status',
  LOCK_ALL: 'lock_all',
};

/** Normalized state name of a snapshot (`locked`, `rto_active`...). */
export function stateName(snapshot) {
  if (!snapshot || snapshot.state === null) {
    return 'undefined';
  }
  const names = snapshot.kind === DEVICE_KINDS.OPENER ? OPENER_STATE_NAMES : LOCK_STATE_NAMES;
  return names[snapshot.state] ?? 'undefined';
}

async function operate(hub, deviceExternalId, kind, action) {
  const view = hub.view(deviceExternalId);
  if (!view || view.snapshot.kind !== kind) {
    logger.warn(`Scene action: ${deviceExternalId} is not a Nuki ${kind}`);
    return { success: false };
  }
  try {
    await hub.runAction(view.nukiId, action);
    return { success: true };
  } catch (err) {
    logger.error(`Scene action ${action} on ${view.snapshot.name} failed`, err);
    return { success: false };
  }
}

export const SCENE_ACTIONS = {
  async [SCENE_ACTION_KEYS.OPERATE_LOCK](hub, { fields }) {
    const action = Object.values(LOCK_ACTIONS).includes(fields.action)
      ? fields.action
      : LOCK_ACTIONS.LOCK;
    logger.info(`Scene action operate_lock <- ${fields.device} (${action})`);
    return operate(hub, fields.device, DEVICE_KINDS.LOCK, action);
  },

  async [SCENE_ACTION_KEYS.OPERATE_OPENER](hub, { fields }) {
    const action = Object.values(OPENER_ACTIONS).includes(fields.action)
      ? fields.action
      : OPENER_ACTIONS.ELECTRIC_STRIKE;
    logger.info(`Scene action operate_opener <- ${fields.device} (${action})`);
    return operate(hub, fields.device, DEVICE_KINDS.OPENER, action);
  },

  async [SCENE_ACTION_KEYS.GET_LOCK_STATUS](hub, { fields }) {
    const view = hub.view(fields.device);
    if (!view) {
      return { reachable: false, state: 'undefined' };
    }
    const { snapshot } = view;
    const outputs = {
      reachable: view.source !== null,
      state: stateName(snapshot),
      battery_critical: snapshot.batteryCritical === true,
    };
    if (snapshot.kind === DEVICE_KINDS.LOCK) {
      outputs.locked = toGladysLockBinary(snapshot.state) === 1;
    }
    if (snapshot.batteryCharge !== null) {
      outputs.battery = snapshot.batteryCharge;
    }
    if (hasDoorSensor(snapshot.doorState)) {
      outputs.door_open = toGladysDoorState(snapshot.doorState) === GLADYS_OPENING_STATE.OPEN;
    }
    return outputs;
  },

  async [SCENE_ACTION_KEYS.LOCK_ALL](hub) {
    const locks = hub.views().filter((view) => view.snapshot.kind === DEVICE_KINDS.LOCK);
    let locked = 0;
    let failed = 0;
    for (const view of locks) {
      try {
        await hub.runAction(view.nukiId, LOCK_ACTIONS.LOCK);
        locked += 1;
      } catch (err) {
        logger.error(`lock_all: ${view.snapshot.name} failed`, err);
        failed += 1;
      }
    }
    return { locked_count: locked, failed_count: failed };
  },
};
