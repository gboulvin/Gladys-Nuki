// -----------------------------------------------------------------------------
// Dashboard widgets (SDK v0.14+, Gladys 5.1+). Declarative contents rendered
// by the core with its own theme, dark mode and translations.
//
//   - nuki_lock     : one lock or Opener — state, battery (live tile), door,
//                     accessories, channel, last activity, and the buttons
//                     (lock / unlock through the standard device command,
//                     "open the door" behind a confirmation);
//   - nuki_overview : every Nuki device at a glance, plus "Lock all";
//   - nuki_activity : the latest operations (who, how, when), from Nuki Web
//                     when configured, else from the integration's history.
// -----------------------------------------------------------------------------

import { createLogger, DEVICE_TRANSPORTS, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import {
  DEVICE_KINDS,
  LOCK_ACTIONS,
  OPENER_ACTIONS,
  OPENER_MODES,
  OPENER_STATES,
  hasDoorSensor,
  nukiIdFromWeb,
  toGladysDoorState,
  toGladysLockState,
  GLADYS_LOCK_STATE,
  GLADYS_OPENING_STATE,
  actionFromCode,
  webTrigger,
} from './nuki/constants.js';
import { FEATURES } from './devices.js';
import { SCENE_ACTIONS, SCENE_ACTION_KEYS, stateName } from './scenes.js';
import { label, t, truncate } from './i18n.js';

const logger = createLogger({ name: 'widgets' });

// Widget keys, as declared in the manifest `widgets`. Forever.
export const WIDGET_KEYS = {
  LOCK: 'nuki_lock',
  OVERVIEW: 'nuki_overview',
  ACTIVITY: 'nuki_activity',
};

// Keys of the `button` actions the contents declare.
export const WIDGET_ACTIONS = {
  UNLATCH: 'unlatch',
  ELECTRIC_STRIKE: 'electric_strike',
  LOCK_ALL: 'lock_all',
};

const LOCK_STATE_COLORS = {
  [GLADYS_LOCK_STATE.LOCKED]: WIDGET_COLORS.SUCCESS,
  [GLADYS_LOCK_STATE.UNLOCKED]: WIDGET_COLORS.WARNING,
  [GLADYS_LOCK_STATE.ACTIVITY]: WIDGET_COLORS.INFO,
  [GLADYS_LOCK_STATE.ERROR]: WIDGET_COLORS.DANGER,
};

const TRANSPORT_STATUS = {
  [DEVICE_TRANSPORTS.LOCAL]: { key: 'transport_local', color: WIDGET_COLORS.SUCCESS },
  [DEVICE_TRANSPORTS.CLOUD]: { key: 'transport_cloud', color: WIDGET_COLORS.INFO },
  [DEVICE_TRANSPORTS.UNREACHABLE]: { key: 'transport_unreachable', color: WIDGET_COLORS.DANGER },
};

function stateRow(view) {
  const { snapshot } = view;
  let color = WIDGET_COLORS.NEUTRAL;
  if (view.source === null) {
    color = WIDGET_COLORS.DANGER;
  } else if (snapshot.kind === DEVICE_KINDS.LOCK) {
    color = LOCK_STATE_COLORS[toGladysLockState(snapshot.state)];
  } else if (
    snapshot.state === OPENER_STATES.RTO_ACTIVE ||
    snapshot.mode === OPENER_MODES.CONTINUOUS
  ) {
    color = WIDGET_COLORS.WARNING;
  }
  return {
    label: t('w_state'),
    icon: snapshot.kind === DEVICE_KINDS.LOCK ? 'lock' : 'bell',
    value: view.source === null ? t('transport_unreachable') : label('state', stateName(snapshot)),
    color,
  };
}

function batteryRow(key, critical) {
  return {
    label: t(key),
    icon: 'battery',
    value: critical ? t('critical') : t('ok'),
    color: critical ? WIDGET_COLORS.DANGER : WIDGET_COLORS.SUCCESS,
  };
}

/** "Unlock by Alice" / "Lock (keypad)" — a history entry in one short line. */
export function activityText(entry) {
  if (entry.type === 'lock_action') {
    const action = label('action', entry.action);
    if (entry.user) {
      return t('by_user', { action, user: entry.user });
    }
    return t('via_trigger', { action, trigger: label('trigger', entry.trigger) });
  }
  if (entry.type === 'error') {
    return label('error', entry.detail);
  }
  if (entry.type === 'battery') {
    return label('action', 'battery');
  }
  return label('action', 'doorbell');
}

function lockContent(view) {
  const { snapshot, ids } = view;
  const components = [];
  if (snapshot.batteryCharge !== null) {
    components.push({
      type: 'value',
      label: t('w_battery'),
      icon: 'battery-charging',
      device_feature: ids.feature(FEATURES.BATTERY),
    });
  }
  const items = [stateRow(view)];
  if (hasDoorSensor(snapshot.doorState)) {
    const door = toGladysDoorState(snapshot.doorState);
    items.push({
      label: t('w_door'),
      icon: 'log-in',
      value:
        door === null
          ? t('door_unknown')
          : door === GLADYS_OPENING_STATE.OPEN
            ? t('door_open')
            : t('door_closed'),
      color: door === GLADYS_OPENING_STATE.OPEN ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
    });
  }
  if (snapshot.batteryCharge === null || snapshot.batteryCritical) {
    items.push(batteryRow('w_battery', snapshot.batteryCritical));
  }
  if (snapshot.hasKeypad) {
    items.push(batteryRow('w_keypad', snapshot.keypadBatteryCritical));
  }
  if (hasDoorSensor(snapshot.doorState)) {
    items.push(batteryRow('w_door_sensor', snapshot.doorsensorBatteryCritical));
  }
  const transport = TRANSPORT_STATUS[view.transport.transport];
  items.push({
    label: t('w_connection'),
    icon: 'wifi',
    value: t(transport.key),
    color: view.transport.degraded ? WIDGET_COLORS.WARNING : transport.color,
  });
  if (view.lastActivity) {
    items.push({
      label: t('w_last_activity'),
      icon: 'clock',
      value: truncate(activityText(view.lastActivity), 40),
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  components.push({ type: 'status', items });
  components.push(
    {
      type: 'button',
      label: t('w_lock'),
      icon: 'lock',
      style: 'primary',
      device_feature: ids.feature(FEATURES.LOCK),
      value: 1,
    },
    {
      type: 'button',
      label: t('w_unlock'),
      icon: 'unlock',
      style: 'secondary',
      device_feature: ids.feature(FEATURES.LOCK),
      value: 0,
    },
    {
      type: 'button',
      label: t('w_unlatch'),
      icon: 'log-in',
      style: 'danger',
      action: { key: WIDGET_ACTIONS.UNLATCH, params: { device: view.externalId }, confirm: true },
    },
  );
  return components;
}

function openerContent(view) {
  const { snapshot, ids } = view;
  const rto = snapshot.state === OPENER_STATES.RTO_ACTIVE;
  const continuous = snapshot.mode === OPENER_MODES.CONTINUOUS;
  const transport = TRANSPORT_STATUS[view.transport.transport];
  const items = [
    stateRow(view),
    {
      label: t('w_ring_to_open'),
      icon: 'bell',
      value: rto ? t('on') : t('off'),
      color: rto ? WIDGET_COLORS.WARNING : WIDGET_COLORS.NEUTRAL,
    },
    {
      label: t('w_continuous'),
      icon: 'repeat',
      value: continuous ? t('on') : t('off'),
      color: continuous ? WIDGET_COLORS.WARNING : WIDGET_COLORS.NEUTRAL,
    },
    batteryRow('w_battery', snapshot.batteryCritical),
    {
      label: t('w_connection'),
      icon: 'wifi',
      value: t(transport.key),
      color: view.transport.degraded ? WIDGET_COLORS.WARNING : transport.color,
    },
  ];
  if (view.lastActivity) {
    items.push({
      label: t('w_last_activity'),
      icon: 'clock',
      value: truncate(activityText(view.lastActivity), 40),
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  return [
    { type: 'status', items },
    {
      type: 'button',
      label: t('w_open'),
      icon: 'log-in',
      style: 'primary',
      action: {
        key: WIDGET_ACTIONS.ELECTRIC_STRIKE,
        params: { device: view.externalId },
        confirm: true,
      },
    },
    {
      type: 'button',
      label: rto ? t('w_rto_off') : t('w_rto_on'),
      icon: 'bell',
      style: 'secondary',
      device_feature: ids.feature(FEATURES.RING_TO_OPEN),
      value: rto ? 0 : 1,
    },
  ];
}

const text = (message) => ({ type: 'text', text: message, variant: 'body' });

async function runWidgetAction(hub, deviceExternalId, action) {
  const view = hub.view(deviceExternalId);
  if (!view) {
    throw new Error(t('unknown_device').en);
  }
  await hub.runAction(view.nukiId, action);
  return t('action_sent', { device: view.snapshot.name, action: label('action', action) });
}

/** Activity entries from the Nuki Web log (richer: users, offline events). */
async function webActivity(hub) {
  const logs = await hub.webLogs();
  const names = new Map(hub.views().map((view) => [view.nukiId, view]));
  return logs
    .map((log) => {
      const view = names.get(nukiIdFromWeb(log.smartlockId));
      const kind =
        view?.snapshot.kind ??
        (Number(log.deviceType) === 2 ? DEVICE_KINDS.OPENER : DEVICE_KINDS.LOCK);
      const action = actionFromCode(kind, log.action);
      if (!action) {
        return null;
      }
      return {
        date: log.date,
        device_name: view?.snapshot.name ?? 'Nuki',
        type: 'lock_action',
        action,
        trigger: webTrigger(log.trigger, log.source),
        user: log.name || null,
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

export function createWidgets(getHub) {
  return {
    [WIDGET_KEYS.LOCK]: {
      async get({ settings }) {
        const hub = getHub();
        if (!settings?.device) {
          return { ttl_seconds: 60, components: [text(t('w_choose_device'))] };
        }
        const view = hub.view(settings.device);
        if (!view) {
          return { ttl_seconds: 60, components: [text(t('w_unavailable'))] };
        }
        return {
          // States change through the live tile; the computed rows are
          // refreshed by a nudge on every change (see index.js): the TTL
          // is a safety net.
          ttl_seconds: 60,
          components:
            view.snapshot.kind === DEVICE_KINDS.OPENER ? openerContent(view) : lockContent(view),
        };
      },
      async action({ actionKey, params }) {
        logger.info(`Widget ${WIDGET_KEYS.LOCK}.${actionKey} <- ${params.device}`);
        if (actionKey === WIDGET_ACTIONS.UNLATCH) {
          return runWidgetAction(getHub(), params.device, LOCK_ACTIONS.UNLATCH);
        }
        if (actionKey === WIDGET_ACTIONS.ELECTRIC_STRIKE) {
          return runWidgetAction(getHub(), params.device, OPENER_ACTIONS.ELECTRIC_STRIKE);
        }
        throw new Error(`Unknown widget action: ${actionKey}`);
      },
    },

    [WIDGET_KEYS.OVERVIEW]: {
      async get() {
        const views = getHub().views();
        if (views.length === 0) {
          return { ttl_seconds: 300, components: [text(t('w_no_device'))] };
        }
        const items = views.slice(0, 10).map((view) => ({
          ...stateRow(view),
          label: truncate({ en: view.snapshot.name }, 40),
        }));
        const components = [{ type: 'status', items }];
        if (views.some((view) => view.snapshot.kind === DEVICE_KINDS.LOCK)) {
          components.push({
            type: 'button',
            label: t('w_lock_all'),
            icon: 'lock',
            style: 'primary',
            action: { key: WIDGET_ACTIONS.LOCK_ALL, confirm: true },
          });
        }
        return { ttl_seconds: 60, components };
      },
      async action({ actionKey }) {
        if (actionKey !== WIDGET_ACTIONS.LOCK_ALL) {
          throw new Error(`Unknown widget action: ${actionKey}`);
        }
        const outputs = await SCENE_ACTIONS[SCENE_ACTION_KEYS.LOCK_ALL](getHub(), { fields: {} });
        return t('lock_all_done', { count: outputs.locked_count, failed: outputs.failed_count });
      },
    },

    [WIDGET_KEYS.ACTIVITY]: {
      async get() {
        const hub = getHub();
        let entries = [];
        if (hub.clients.web) {
          entries = await webActivity(hub).catch((err) => {
            logger.warn(`Nuki Web log unavailable: ${err.message}`);
            return [];
          });
        }
        if (entries.length === 0) {
          entries = hub.history.latest(8);
        }
        if (entries.length === 0) {
          return { ttl_seconds: 120, components: [text(t('w_no_activity'))] };
        }
        return {
          ttl_seconds: 120,
          components: [
            {
              type: 'card-list',
              display: 'list',
              items: entries.map((entry) => ({
                title: truncate(activityText(entry), 60),
                subtitle: truncate({ en: entry.device_name ?? 'Nuki' }, 60),
                date: entry.date,
                ...(entry.trigger
                  ? {
                      badge: {
                        text: truncate(label('trigger', entry.trigger), 16),
                        color: WIDGET_COLORS.NEUTRAL,
                      },
                    }
                  : {}),
              })),
            },
          ],
        };
      },
    },
  };
}

/** Ask the core to re-pull every widget (rate-limited core-side, 1 per 10 s). */
export function refreshWidgets(gladys, widgets) {
  for (const key of Object.keys(widgets)) {
    gladys.requestWidgetRefresh(key);
  }
}
