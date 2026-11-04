// -----------------------------------------------------------------------------
// Nuki Smart Lock MQTT API client (local, real-time channel).
//
// The Smart Lock 3.0 Pro / 4.0 / Ultra publish their state on the user's own
// broker under `nuki/<NukiID>/<topic>` (retained), and listen to
// `nuki/<NukiID>/lockAction`. The integration subscribes to `nuki/#`: the
// retained messages discover the locks on connection, then every change is
// pushed — no polling.
// -----------------------------------------------------------------------------

import mqtt from 'mqtt';

const TOPIC_PREFIX = 'nuki';

export class MqttClient {
  /**
   * @param {object} options
   * @param {string} options.url broker URL, e.g. mqtt://192.168.1.10:1883
   * @param {string} [options.username]
   * @param {string} [options.password]
   * @param {(nukiId: string, topic: string, payload: string) => void} options.onMessage
   * @param {(connected: boolean, error?: Error) => void} [options.onStatus]
   * @param {typeof mqtt.connect} [options.connect] injectable for the tests
   */
  constructor({ url, username, password, onMessage, onStatus = () => {}, connect = mqtt.connect }) {
    this.url = url;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.connected = false;
    this.lastError = null;
    this.client = connect(url, {
      username: username || undefined,
      password: password || undefined,
      clientId: `gladys-nuki-${Math.random().toString(16).slice(2, 10)}`,
      reconnectPeriod: 10_000,
      connectTimeout: 10_000,
    });
    this.client.on('connect', () => {
      this.connected = true;
      this.lastError = null;
      this.client.subscribe(`${TOPIC_PREFIX}/#`);
      this.onStatus(true);
    });
    this.client.on('close', () => {
      if (this.connected) {
        this.connected = false;
        this.onStatus(false);
      }
    });
    this.client.on('error', (err) => {
      this.lastError = err;
      this.onStatus(false, err);
    });
    this.client.on('message', (topic, payload) => {
      const [prefix, nukiId, ...rest] = topic.split('/');
      if (prefix !== TOPIC_PREFIX || !nukiId || rest.length === 0) {
        return;
      }
      this.onMessage(nukiId.toUpperCase(), rest.join('/'), payload.toString());
    });
  }

  /** Send a lock action code to `nuki/<id>/lockAction`. */
  async lockAction(nukiId, actionCode) {
    if (!this.connected) {
      throw new Error('MQTT broker not connected');
    }
    await this.client.publishAsync(`${TOPIC_PREFIX}/${nukiId}/lockAction`, String(actionCode));
  }

  async close() {
    await this.client.endAsync(true).catch(() => {});
  }
}
