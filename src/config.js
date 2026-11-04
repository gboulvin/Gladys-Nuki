// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of
// `gladys-assistant-integration.json`. Three channels, each optional, at least
// one needed:
//   - Nuki Bridge HTTP API (local): bridge_ip + bridge_token;
//   - MQTT (local, Smart Lock 3.0 Pro / 4.0 / Ultra): mqtt_url;
//   - Nuki Web API (cloud): web_api_token.
// This module provides the defaults and normalizes the received object, so the
// rest of the code never deals with `undefined` or strings from a form.
// -----------------------------------------------------------------------------

// Defaults: they MUST match the `default` values of the manifest config_schema.
export const DEFAULT_CONFIG = {
  bridge_ip: '',
  bridge_port: 8080,
  bridge_token: '',
  bridge_hashed_token: true,
  mqtt_url: '',
  mqtt_username: '',
  mqtt_password: '',
  web_api_token: '',
  // Seconds between two reads of the Bridge / Nuki Web.
  poll_frequency: 30,
  // What the Gladys lock switch does: 'unlock' or 'unlatch' (open the door).
  unlock_action: 'unlock',
  // What the Gladys lock switch does: 'lock' or 'full_lock' (two turns).
  lock_action: 'lock',
  // Reserved key (NOT in config_schema): the manifest declares both 'local'
  // and 'cloud' in `transports`, so Gladys shows a "Prefer the local
  // connection" toggle and sends the user's choice here. Default true.
  GLADYS_PREFER_LOCAL: true,
};

export const POLL_FREQUENCY_MIN = 10;
export const POLL_FREQUENCY_MAX = 3600;
// Nuki asks API clients not to hammer its cloud: never poll it faster.
export const WEB_POLL_MIN_SECONDS = 30;

const str = (value, fallback = '') =>
  value === undefined || value === null ? fallback : String(value).trim();

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const pollFrequency = Number(raw.poll_frequency ?? DEFAULT_CONFIG.poll_frequency);
  const port = Number(raw.bridge_port ?? DEFAULT_CONFIG.bridge_port);
  return {
    ...DEFAULT_CONFIG,
    bridge_ip: str(raw.bridge_ip)
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, ''),
    bridge_port:
      Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_CONFIG.bridge_port,
    bridge_token: str(raw.bridge_token),
    bridge_hashed_token: raw.bridge_hashed_token !== false,
    mqtt_url: str(raw.mqtt_url),
    mqtt_username: str(raw.mqtt_username),
    mqtt_password: str(raw.mqtt_password),
    web_api_token: str(raw.web_api_token),
    poll_frequency: Number.isFinite(pollFrequency)
      ? Math.min(POLL_FREQUENCY_MAX, Math.max(POLL_FREQUENCY_MIN, pollFrequency))
      : DEFAULT_CONFIG.poll_frequency,
    unlock_action: raw.unlock_action === 'unlatch' ? 'unlatch' : 'unlock',
    lock_action: raw.lock_action === 'full_lock' ? 'full_lock' : 'lock',
    GLADYS_PREFER_LOCAL: raw.GLADYS_PREFER_LOCAL !== false,
  };
}

/** Which channels the user configured. */
export function configuredBackends(config) {
  return {
    bridge: Boolean(config.bridge_ip && config.bridge_token),
    mqtt: Boolean(config.mqtt_url),
    web: Boolean(config.web_api_token),
  };
}

/** The MQTT URL with a scheme (users often type a bare host:port). */
export function mqttUrl(config) {
  return /^(mqtts?|wss?|tcp|ssl):\/\//.test(config.mqtt_url)
    ? config.mqtt_url
    : `mqtt://${config.mqtt_url}`;
}
