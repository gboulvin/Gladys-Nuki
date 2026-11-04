// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createActions } from '../src/actions.js';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { SCENE_TRIGGER_KEYS } from '../src/events.js';
import { createWidgets } from '../src/widgets.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  BATTERY_COMPONENTS,
  LOCK_ACTIONS,
  LOCK_ERRORS,
  OPENER_ACTIONS,
  TRIGGERS,
} from '../src/nuki/constants.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const ACTIONS = createActions({ getHub: () => null, getConfig: () => DEFAULT_CONFIG });
const WIDGETS = createWidgets(() => null);

// Every list of form fields the manifest can declare (same field grammar).
const allFields = [
  ...(manifest.config_schema ?? []),
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

const CAPABILITY_MIN_GLADYS_VERSION = [5, 1, 0];

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const optionsOf = (list, key, field) =>
  manifest[list]
    .find((entry) => entry.key === key)
    .fields.find((f) => f.key === field)
    .options.map((o) => o.value);

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

function isAtLeast(version, required) {
  for (let i = 0; i < required.length; i += 1) {
    if (version[i] !== required[i]) {
      return version[i] > required[i];
    }
  }
  return true;
}

/** Every multi-language object of the manifest, with its path. */
function multiLanguageTexts(node, path = 'manifest', found = []) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => multiLanguageTexts(item, `${path}[${index}]`, found));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (
        ['label', 'description', 'placeholder'].includes(key) &&
        value &&
        typeof value === 'object'
      ) {
        found.push({ path: `${path}.${key}`, value });
      } else {
        multiLanguageTexts(value, `${path}.${key}`, found);
      }
    }
  }
  return found;
}

test('every manifest text exists in English, French, German and Spanish', () => {
  const texts = multiLanguageTexts(manifest);
  assert.ok(texts.length > 50);
  for (const { path, value } of texts) {
    assert.deepEqual(Object.keys(value).sort(), [...LANGUAGES].sort(), `${path} languages`);
    for (const lang of LANGUAGES) {
      assert.ok(
        typeof value[lang] === 'string' && value[lang].trim().length > 0,
        `${path}.${lang}`,
      );
    }
  }
});

test('every manifest action has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions).sort(), Object.keys(ACTIONS).sort());
});

test('every scene_actions key has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_actions).sort(), Object.keys(SCENE_ACTIONS).sort());
});

test('every widgets key has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.widgets).sort(), Object.keys(WIDGETS).sort());
  assert.ok(manifest.widgets.length <= 5, 'at most 5 widgets');
});

test('every scene trigger the code fires is declared, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), [...SCENE_TRIGGER_KEYS].sort());
});

test('the filter options are the values the code produces', () => {
  const lockActions = optionsOf('scene_triggers', 'lock_action', 'action');
  for (const value of lockActions) {
    assert.ok(Object.values(LOCK_ACTIONS).includes(value), value);
  }
  assert.deepEqual(
    optionsOf('scene_triggers', 'lock_action', 'trigger').sort(),
    Object.values(TRIGGERS).sort(),
  );
  assert.deepEqual(
    optionsOf('scene_triggers', 'lock_error', 'error').sort(),
    Object.values(LOCK_ERRORS).sort(),
  );
  assert.deepEqual(
    optionsOf('scene_triggers', 'battery_critical', 'component').sort(),
    Object.values(BATTERY_COMPONENTS).sort(),
  );
  assert.deepEqual(
    optionsOf('scene_actions', 'operate_lock', 'action').sort(),
    Object.values(LOCK_ACTIONS).sort(),
  );
  assert.deepEqual(
    optionsOf('scene_actions', 'operate_opener', 'action').sort(),
    Object.values(OPENER_ACTIONS).sort(),
  );
});

test('scene triggers, scene actions and widgets require Gladys >= 5.1.0', () => {
  assert.ok(
    isAtLeast(minGladysVersion(), CAPABILITY_MIN_GLADYS_VERSION),
    `requires gladys_version >= 5.1.0, got "${manifest.gladys_version}"`,
  );
  assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
});

test('the manifest declares both transports (local Bridge/MQTT, cloud Nuki Web)', () => {
  assert.deepEqual([...manifest.transports].sort(), ['cloud', 'local']);
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  const keys = manifest.config_schema.filter((f) => f.type !== 'section').map((f) => f.key);
  for (const field of manifest.config_schema) {
    if (field.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[field.key], field.default, `DEFAULT_CONFIG.${field.key}`);
    }
    if (field.type === 'secret') {
      assert.equal(field.default, undefined, `secret "${field.key}" cannot have a default`);
    }
  }
  for (const key of keys) {
    assert.ok(key in DEFAULT_CONFIG, `DEFAULT_CONFIG misses "${key}"`);
  }
});

test('section fields are purely presentational', () => {
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    assert.equal(section.placeholder, undefined);
    assert.ok(!(section.key in DEFAULT_CONFIG));
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//, 'section links must be https');
    }
  }
});

test('dynamic selects declare a source and no static options', () => {
  const dynamicSelects = allFields.filter((f) => f.source !== undefined);
  assert.ok(dynamicSelects.length > 0);
  for (const field of dynamicSelects) {
    assert.equal(field.source, 'devices');
    assert.equal(field.options, undefined, `field "${field.key}"`);
  }
});

test('scene trigger filters use the types a filter allows', () => {
  for (const trigger of manifest.scene_triggers) {
    for (const field of trigger.fields ?? []) {
      assert.ok(
        ['string', 'number', 'select', 'multi_select', 'section'].includes(field.type),
        field.key,
      );
    }
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version, 'manifest version must match package.json');
  assert.ok(
    manifest.docker_image.endsWith(`:${manifest.version}`),
    `docker_image must be tagged :${manifest.version}, got "${manifest.docker_image}"`,
  );
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});

test('widget labels hold 3 to 30 characters and descriptions 100 at most', () => {
  for (const widget of manifest.widgets) {
    for (const [lang, text] of Object.entries(widget.label)) {
      assert.ok(text.length >= 3 && text.length <= 30, `${widget.key}.label.${lang}`);
    }
    for (const [lang, text] of Object.entries(widget.description)) {
      assert.ok(text.length <= 100, `${widget.key}.description.${lang}`);
    }
  }
});

test('section descriptions hold 1000 characters at most', () => {
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    for (const [lang, text] of Object.entries(section.description ?? {})) {
      assert.ok(text.length <= 1000, `${section.key}.description.${lang}`);
    }
  }
});

test('field placeholders are multi-language objects', () => {
  for (const field of allFields.filter((f) => f.placeholder !== undefined)) {
    assert.equal(typeof field.placeholder, 'object', `field "${field.key}": placeholder`);
    assert.ok(field.placeholder.en);
  }
});
