# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- Nuki Smart Lock (1.0 to 4th generation, 3.0 Pro, Ultra), Smart Door and Opener
  support.
- Three channels, combinable: Nuki Bridge HTTP API (local), Smart Lock MQTT API
  (local, real time) and Nuki Web API (cloud). Local first with automatic
  fallback, following the "Prefer the local connection" setting; the transport
  badge of each device shows the channel in use, flagged degraded on a fallback.
- Bridge token sent hashed by default, Bridge requests queued one at a time.
- "Find my Bridge" (Nuki discovery service), "Pair the Bridge" (press the
  button, the token is saved), "Test the connection" and "Refresh now" buttons.
- Smart Lock features: lock, lock state, battery level, battery low, charging,
  door sensor state and battery, keypad battery.
- Opener features: Ring to Open, continuous mode, battery low, doorbell ring.
- Options: what unlocking does (unlock or open the door) and locking does (lock
  or full lock), refresh interval.
- Scene triggers: lock operated (operation, how — app, by hand, button,
  keypad, fingerprint, auto lock, Nuki Web, HomeKit, MQTT, Gladys — and the
  Nuki user from Nuki Web), Opener doorbell rang, lock problem (motor blocked,
  uncalibrated, command refused), battery critical (lock, keypad, door sensor).
- Scene actions: operate a lock, operate an Opener, read a device, lock every
  lock.
- Dashboard widgets: lock card, overview with "Lock all", activity log.
- Activity history saved to `/data`.
- English, French, German and Spanish for the manifest, the messages, the
  widgets and the documentation.

[Unreleased]: https://github.com/gboulvin/Gladys-Nuki/commits/main
