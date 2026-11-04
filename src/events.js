// -----------------------------------------------------------------------------
// Scene triggers (SDK v0.14+, Gladys 5.1+): what HAPPENED to a Nuki device,
// detected by comparing two snapshots of it. Pure functions: the hub
// (src/hub.js) enriches the lock operations (who, how) and publishes them.
//
// State vs event: the lock state, the door, the batteries stay device
// features (they drive the standard "device state" trigger). These events say
// "this happened, with these details" — who unlocked, the doorbell rang, the
// motor jammed — one event per transition, never one per poll.
// -----------------------------------------------------------------------------

import {
  BATTERY_COMPONENTS,
  DEVICE_KINDS,
  LOCK_ACTIONS,
  actionFromLockState,
  errorFromLockState,
} from './nuki/constants.js';

// Scene trigger keys, as declared in the manifest `scene_triggers`. Forever.
export const SCENE_TRIGGERS = {
  LOCK_ACTION: 'lock_action',
  DOORBELL_RING: 'doorbell_ring',
  LOCK_ERROR: 'lock_error',
  BATTERY_CRITICAL: 'battery_critical',
};

export const SCENE_TRIGGER_KEYS = Object.values(SCENE_TRIGGERS);

const BATTERY_FIELDS = {
  [BATTERY_COMPONENTS.DEVICE]: 'batteryCritical',
  [BATTERY_COMPONENTS.KEYPAD]: 'keypadBatteryCritical',
  [BATTERY_COMPONENTS.DOOR_SENSOR]: 'doorsensorBatteryCritical',
};

/**
 * Events between two snapshots of the same device.
 *
 * `memory` is the per-device state the detection keeps between calls
 * (`{ lastAction }`): a lock goes locked -> unlocking -> unlocked over two
 * polls, and the operation is only known once it rests. Returns
 * `[{ key, ...details }]` (details completed by the hub).
 *
 * @param {object|undefined} previous snapshot, undefined on the first sight
 * @param {object} next snapshot
 * @param {{ lastAction?: string|null }} memory mutated
 */
export function detectEvents(previous, next, memory) {
  const events = [];
  if (next.kind === DEVICE_KINDS.LOCK) {
    const action = actionFromLockState(next.state);
    if (action) {
      const isFollowUp =
        // After an unlatch the lock rests in "unlocked": same operation.
        (memory.lastAction === LOCK_ACTIONS.UNLATCH && action === LOCK_ACTIONS.UNLOCK) ||
        // Lock 'n' Go ends locked: same operation.
        (memory.lastAction === LOCK_ACTIONS.LOCK_N_GO && action === LOCK_ACTIONS.LOCK);
      if (
        previous &&
        memory.lastAction !== undefined &&
        action !== memory.lastAction &&
        !isFollowUp
      ) {
        events.push({ key: SCENE_TRIGGERS.LOCK_ACTION, action });
      }
      memory.lastAction = action;
    }
    const error = errorFromLockState(next.state);
    if (previous && error && error !== errorFromLockState(previous.state)) {
      events.push({ key: SCENE_TRIGGERS.LOCK_ERROR, error });
    }
  }
  if (
    previous &&
    next.kind === DEVICE_KINDS.OPENER &&
    next.ringActive === true &&
    (next.ringTimestamp !== previous.ringTimestamp || previous.ringActive === false)
  ) {
    events.push({ key: SCENE_TRIGGERS.DOORBELL_RING });
  }
  if (previous) {
    for (const [component, field] of Object.entries(BATTERY_FIELDS)) {
      if (next[field] === true && previous[field] === false) {
        events.push({ key: SCENE_TRIGGERS.BATTERY_CRITICAL, component });
      }
    }
  }
  return events;
}
