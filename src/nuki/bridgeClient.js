// -----------------------------------------------------------------------------
// Nuki Bridge HTTP API client (local channel).
//
// The Bridge is a small device: it serves ONE request at a time and answers
// 503 when busy. Every request goes through a queue, with a timeout, and the
// token is sent hashed by default (SHA-256 of "<ts>,<rnr>,<token>", Bridge
// firmware 1.13+), so it never travels in clear on the LAN.
// -----------------------------------------------------------------------------

import { createHash, randomInt } from 'node:crypto';

const DEFAULT_TIMEOUT_MS = 10_000;
// `/auth` waits for the user to press the Bridge button (30 s window).
const AUTH_TIMEOUT_MS = 35_000;

export class BridgeError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'BridgeError';
    this.status = status;
  }
}

export class BridgeClient {
  /**
   * @param {object} options
   * @param {string} options.host Bridge IP address or hostname
   * @param {number} [options.port] Bridge HTTP port (8080)
   * @param {string} [options.token] API token
   * @param {boolean} [options.hashedToken] send the token hashed (default true)
   * @param {typeof fetch} [options.fetch] injectable for the tests
   */
  constructor({ host, port = 8080, token, hashedToken = true, fetch: fetchImpl = fetch }) {
    this.baseUrl = `http://${host}:${port}`;
    this.token = token;
    this.hashedToken = hashedToken;
    this.fetch = fetchImpl;
    this.queue = Promise.resolve();
  }

  authParams() {
    if (!this.token) {
      return {};
    }
    if (!this.hashedToken) {
      return { token: this.token };
    }
    // Format required by the Bridge: YYYY-MM-DDTHH:MM:SSZ, UTC.
    const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const rnr = randomInt(0, 65535);
    const hash = createHash('sha256').update(`${ts},${rnr},${this.token}`).digest('hex');
    return { ts, rnr: String(rnr), hash };
  }

  /** Queue a GET request: the Bridge handles one request at a time. */
  request(path, params = {}, { auth = true, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const run = () => this.doRequest(path, params, { auth, timeoutMs });
    const result = this.queue.then(run, run);
    // Keep the chain alive whatever the outcome of this request.
    this.queue = result.catch(() => {});
    return result;
  }

  async doRequest(path, params, { auth, timeoutMs }) {
    const query = new URLSearchParams({ ...params, ...(auth ? this.authParams() : {}) });
    const url = `${this.baseUrl}${path}${query.size > 0 ? `?${query}` : ''}`;
    let response;
    try {
      response = await this.fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      throw new BridgeError(`Nuki Bridge unreachable at ${this.baseUrl} (${err.message})`);
    }
    if (response.status === 401) {
      throw new BridgeError('The Nuki Bridge refused the API token', 401);
    }
    if (!response.ok) {
      throw new BridgeError(`Nuki Bridge answered HTTP ${response.status}`, response.status);
    }
    return response.json();
  }

  /** Paired devices with their last known state (cached by the Bridge: fast). */
  list() {
    return this.request('/list');
  }

  /** Bridge information (firmware, Wi-Fi, server connection, uptime). */
  info() {
    return this.request('/info');
  }

  /**
   * Run a lock action. `nowait=1` answers as soon as the Bridge accepted the
   * command, the new state is read by the next refresh.
   */
  async lockAction(nukiIdDecimal, deviceType, actionCode) {
    const result = await this.request(
      '/lockAction',
      {
        nukiId: String(nukiIdDecimal),
        deviceType: String(deviceType),
        action: String(actionCode),
        nowait: '1',
      },
      { timeoutMs: 20_000 },
    );
    if (result && result.success === false) {
      throw new BridgeError('The Nuki Bridge could not run the action');
    }
    return result;
  }

  /**
   * Ask the Bridge for its API token: the user presses the Bridge button
   * within 30 seconds. Needs the HTTP API enabled in the Nuki app.
   */
  async auth() {
    const result = await this.request('/auth', {}, { auth: false, timeoutMs: AUTH_TIMEOUT_MS });
    if (!result?.success || !result.token) {
      throw new BridgeError('The Bridge button was not pressed in time');
    }
    return result.token;
  }
}

/** Public Nuki service listing the Bridges of the local network (by public IP). */
export async function discoverBridges({ fetch: fetchImpl = fetch } = {}) {
  const response = await fetchImpl('https://api.nuki.io/discover/bridges', {
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new BridgeError(
      `Nuki discovery service answered HTTP ${response.status}`,
      response.status,
    );
  }
  const body = await response.json();
  return (body.bridges ?? []).map((bridge) => ({
    id: bridge.bridgeId,
    ip: bridge.ip,
    port: bridge.port ?? 8080,
  }));
}
