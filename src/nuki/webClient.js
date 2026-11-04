// -----------------------------------------------------------------------------
// Nuki Web API client (cloud channel). Authenticated with an API token
// generated in Nuki Web (web.nuki.io -> API -> API tokens).
// -----------------------------------------------------------------------------

const BASE_URL = 'https://api.nuki.io';
const TIMEOUT_MS = 15_000;

export class WebApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'WebApiError';
    this.status = status;
  }
}

export class WebClient {
  /**
   * @param {object} options
   * @param {string} options.token Nuki Web API token
   * @param {typeof fetch} [options.fetch] injectable for the tests
   */
  constructor({ token, fetch: fetchImpl = fetch }) {
    this.token = token;
    this.fetch = fetchImpl;
  }

  async request(method, path, body) {
    let response;
    try {
      response = await this.fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new WebApiError(`Nuki Web API unreachable (${err.message})`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new WebApiError('Nuki Web refused the API token', response.status);
    }
    if (response.status === 429) {
      throw new WebApiError('Nuki Web rate limit reached, retrying later', 429);
    }
    if (!response.ok) {
      throw new WebApiError(`Nuki Web API answered HTTP ${response.status}`, response.status);
    }
    if (response.status === 204) {
      return null;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  /** Every device of the account, with its state and configuration. */
  smartlocks() {
    return this.request('GET', '/smartlock');
  }

  /** Run an action (`{ action, option? }`, see webActionBody). */
  action(smartlockId, body) {
    return this.request('POST', `/smartlock/${smartlockId}/action`, body);
  }

  /** Latest activity log entries of the account, newest first. */
  logs(limit = 20) {
    return this.request('GET', `/smartlock/log?limit=${limit}`);
  }
}
