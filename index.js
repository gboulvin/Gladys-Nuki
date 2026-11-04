// -----------------------------------------------------------------------------
// Entry point of the Nuki external integration for Gladys Assistant.
//
// Environment variables provided by the Gladys supervisor to the container
// (read by the SDK): GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN,
// GLADYS_INTEGRATION_SELECTOR. All the logic lives in src/: this file only
// creates the client, wires it (src/app.js) and connects.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const gladys = new GladysIntegration();
const app = createApp(gladys);

// Graceful shutdown: close the MQTT session and the timers, then the SDK
// disconnects cleanly and exits with code 0 (SIGTERM/SIGINT).
gladys.handleShutdown(async (signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  await app.stop();
});

logger.info('Starting the Nuki integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
