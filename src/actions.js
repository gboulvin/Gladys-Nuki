// -----------------------------------------------------------------------------
// Manifest `actions`: the buttons of the Configuration screen.
//
//   - test_connection : check every configured channel and say what works;
//   - discover_bridge : find the Bridge through the Nuki discovery service
//                       and save its IP address;
//   - pair_bridge     : get the Bridge API token by pressing its button;
//   - refresh_devices : re-read everything now and refresh the Discovery tab.
//
// Each handler resolves the multi-language message shown under the button.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { BridgeClient, discoverBridges } from './nuki/bridgeClient.js';
import { LANGUAGES, t } from './i18n.js';

const logger = createLogger({ name: 'actions' });

/** Join several multi-language messages, one per line. */
export function joinMessages(messages) {
  return Object.fromEntries(
    LANGUAGES.map((lang) => [
      lang,
      messages.map((message) => message[lang] ?? message.en).join('\n'),
    ]),
  );
}

/**
 * @param {object} context
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} context.gladys
 * @param {() => import('./hub.js').NukiHub} context.getHub
 * @param {() => object} context.getConfig
 * @param {(patch: object) => Promise<void>} context.updateConfig save + apply a config change
 * @param {object} [context.factories] `bridge` client factory and `discover`, for the tests
 */
export function createActions({ getHub, getConfig, updateConfig, factories = {} }) {
  const newBridge = factories.bridge ?? ((options) => new BridgeClient(options));
  const discover = factories.discover ?? (() => discoverBridges());

  return {
    async test_connection() {
      const hub = getHub();
      const config = getConfig();
      const lines = [];
      const { health } = hub;
      if (!health.bridge?.configured && !health.mqtt?.configured && !health.web?.configured) {
        return t('not_configured');
      }
      if (health.bridge?.configured) {
        try {
          const bridge = newBridge({
            host: config.bridge_ip,
            port: config.bridge_port,
            token: config.bridge_token,
            hashedToken: config.bridge_hashed_token,
          });
          const info = await bridge.info();
          const list = await bridge.list();
          lines.push(
            t('test_bridge_ok', {
              count: Array.isArray(list) ? list.length : 0,
              firmware: info?.versions?.firmwareVersion ?? '?',
            }),
          );
        } catch (err) {
          lines.push(t('test_bridge_ko', { error: err.message }));
        }
      }
      if (health.mqtt?.configured) {
        lines.push(
          health.mqtt.ok
            ? t('test_mqtt_ok', { count: hub.sources.mqtt.size })
            : t('test_mqtt_ko', { error: health.mqtt.error ?? '?' }),
        );
      }
      if (health.web?.configured) {
        try {
          const list = await hub.clients.web.smartlocks();
          lines.push(t('test_web_ok', { count: Array.isArray(list) ? list.length : 0 }));
        } catch (err) {
          lines.push(t('test_web_ko', { error: err.message }));
        }
      }
      return joinMessages(lines);
    },

    async discover_bridge() {
      const bridges = await discover();
      if (bridges.length === 0) {
        return t('discover_none');
      }
      if (bridges.length > 1) {
        return t('discover_found_many', {
          list: bridges.map((bridge) => `${bridge.ip}:${bridge.port}`).join(', '),
        });
      }
      const [{ ip, port }] = bridges;
      logger.info(`Bridge found at ${ip}:${port}`);
      await updateConfig({ bridge_ip: ip, bridge_port: port });
      return t('discover_found', { ip, port });
    },

    async pair_bridge() {
      const config = getConfig();
      if (!config.bridge_ip) {
        return t('pair_no_ip');
      }
      try {
        const token = await newBridge({ host: config.bridge_ip, port: config.bridge_port }).auth();
        await updateConfig({ bridge_token: token });
        return t('pair_ok');
      } catch (err) {
        logger.warn(`Bridge pairing failed: ${err.message}`);
        return t('pair_ko', { error: err.message });
      }
    },

    async refresh_devices() {
      const hub = getHub();
      await hub.refresh({ forceWeb: true });
      const devices = await hub.publishDiscoveredDevices();
      return t('refresh_done', { count: devices.length });
    },
  };
}
