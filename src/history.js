// -----------------------------------------------------------------------------
// Activity history: the last lock operations, rings, errors and battery
// alerts the integration saw, for the "Nuki activity" widget and the "last
// activity" row of the lock widget. Kept in memory and saved to /data (the
// only writable volume of the container) so it survives a restart. Losing
// it is harmless: a write failure is logged, never thrown.
// -----------------------------------------------------------------------------

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'history' });

export const HISTORY_SIZE = 50;

export class History {
  /**
   * @param {object} [options]
   * @param {string|null} [options.file] JSON file, `null` to keep it in memory only
   */
  constructor({ file = join(process.env.DATA_DIR ?? '/data', 'history.json') } = {}) {
    this.file = file;
    this.entries = [];
    this.saving = Promise.resolve();
  }

  async load() {
    if (!this.file) {
      return;
    }
    try {
      const entries = JSON.parse(await readFile(this.file, 'utf8'));
      if (Array.isArray(entries)) {
        this.entries = entries.slice(0, HISTORY_SIZE);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn(`Could not read the activity history: ${err.message}`);
      }
    }
  }

  /**
   * Record one entry, newest first:
   * `{ date, device, device_name, type, action?, trigger?, user?, detail? }`.
   */
  add(entry) {
    this.entries.unshift({ date: new Date().toISOString(), ...entry });
    this.entries.length = Math.min(this.entries.length, HISTORY_SIZE);
    this.save();
  }

  /** Newest entries, optionally of one device external_id. */
  latest(limit = 8, device) {
    return this.entries.filter((entry) => !device || entry.device === device).slice(0, limit);
  }

  save() {
    if (!this.file) {
      return this.saving;
    }
    const snapshot = JSON.stringify(this.entries);
    this.saving = this.saving
      .then(async () => {
        await mkdir(dirname(this.file), { recursive: true });
        await writeFile(this.file, snapshot);
      })
      .catch((err) => logger.warn(`Could not save the activity history: ${err.message}`));
    return this.saving;
  }
}
