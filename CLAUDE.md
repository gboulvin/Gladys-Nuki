# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

The **Nuki** external integration for Gladys Assistant: a Node.js service
(Node 22+, ESM, no build step) that runs in its own sandboxed Docker container
and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).
It drives the Nuki Smart Lock, Smart Door and Opener through three channels:
the Bridge HTTP API (local), the Smart Lock MQTT API (local, `mqtt` package)
and the Nuki Web API (cloud). It started from the official JavaScript
template.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/hub.test.js              # one file
node --test --test-name-pattern "MQTT"    # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI runs `format:check`, `lint` and `test` on Node 22 and 24, and builds
the Docker image: run the three commands before pushing.

## Architecture

```
index.js                  SDK bootstrap only
src/app.js                every SDK handler, registered before connect()
src/hub.js                channels -> effective snapshot per device, preference
                          and fallback, commands, publication, scene events
src/nuki/*.js             protocol: clients, codes, normalization to a snapshot
src/devices.js            snapshot -> Gladys device / states / commands
src/events.js             snapshot transitions -> scene triggers (pure)
src/scenes.js, src/widgets.js, src/actions.js   manifest capabilities
src/i18n.js               runtime texts, en / fr / de / es
test/helpers.js           fake Bridge / MQTT / Web clients and sample payloads
```

## Rules

- **External ids are forever.** Devices are `gladys.externalIds(kind, nukiId)`
  with `kind` `lock` or `opener` and `nukiId` the 8-hex-digit uppercase Nuki
  ID (`nukiIdFromBridge` / `nukiIdFromWeb` / MQTT topic). Feature keys
  (`FEATURES` in `src/devices.js`), manifest `config_schema`, `actions`,
  scene trigger / action keys, their option values (`LOCK_ACTIONS`,
  `OPENER_ACTIONS`, `TRIGGERS`, `LOCK_ERRORS`, `BATTERY_COMPONENTS`) and
  widget keys are stored by users: never rename one.
- **One snapshot format.** Every channel goes through `src/nuki/normalize.js`;
  nothing downstream may read a raw Bridge / MQTT / Web payload. Unknown
  values are `null`.
- **The Bridge is fragile.** One request at a time (the client queues them),
  no per-device polling: one `/list` per refresh. Nuki Web is never polled
  faster than every 30 s.
- **The container rootfs is read-only.** Write only under `/data` (the
  history). Never log tokens, passwords or API keys.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand — except on the README's hand-pushed tag path, which bumps all three
  together before tagging. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
- **Four languages.** Every user-facing text exists in English, French,
  German and Spanish: manifest texts (`test/manifest.test.js` enforces it),
  runtime messages (`src/i18n.js`) and `docs/en.md`, `fr.md`, `de.md`,
  `es.md`, kept in sync. The catalog `description` holds 10 to 100 characters
  per language.
- **Manifest ↔ code.** `test/manifest.test.js` ties the manifest to the code
  (handlers, trigger keys, filter options, defaults): change both sides
  together. `scene_triggers`, `scene_actions` and `widgets` need
  `gladys_version >= 5.1.0`.
- **Scene events**: one per transition, flat `data` with only the keys the
  trigger declares (`test/app.test.js` checks it). Never fire an event because
  of a received scene action; commands are attributed `trigger: gladys`.
- **Widgets**: `validateWidgetContent(content)` must be `[]` (tested in every
  language).
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network: use the fakes of
  `test/helpers.js` or an injected `fetch`.
