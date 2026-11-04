# Nuki for Gladys Assistant

Control your **Nuki** devices from Gladys: Smart Lock (all generations, 3.0 Pro, 4th
generation, Ultra), Smart Door and Opener — lock, unlock, open the door, follow the
batteries, the door sensor and the keypad, and react to every operation in your scenes.

## Choose how Gladys talks to your Nuki devices

The integration supports three channels. Configure **at least one**; you can combine them.

| Channel         | Type              | Devices                                      | What it brings                                                               |
| --------------- | ----------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| **Nuki Bridge** | Local (HTTP)      | Every Smart Lock, Smart Door and Opener      | Works without internet, Opener doorbell detection                            |
| **MQTT**        | Local (real time) | Smart Lock 3.0 Pro, 4th generation, Ultra    | Instant updates without polling, who/how of each operation (button, keypad…) |
| **Nuki Web**    | Cloud             | Every device linked to your Nuki Web account | Who operated the lock (user name, keypad, fingerprint), activity log         |

When several channels reach a device, Gladys uses the **local** one first (MQTT, then the
Bridge) and falls back to the other if it fails. Turn off **Prefer the local connection**
in the configuration screen to use Nuki Web first. The badge on each device card shows the
channel in use: _Local_, _Cloud_ or _Unreachable_; an orange dot means Gladys had to fall
back (for example: Bridge offline, Nuki Web used instead).

## Setup

### Nuki Bridge (local)

1. In the **Nuki app**, open _Manage Bridge_ and enable the **HTTP API**.
2. In Gladys, open the Nuki integration configuration and click **Find my Bridge**: the IP
   address is filled in for you (or type it by hand: it is shown in the Nuki app).
3. Click **Pair the Bridge**, then **press the button of the Bridge** within 30 seconds:
   the API token is saved automatically. You can also copy the token shown in the app.
4. Keep **Send the token hashed** enabled (Bridge firmware 1.13 or later): the token never
   travels in clear on your network.

> Give your Bridge a fixed IP address in your router: if it changes, run **Find my
> Bridge** again.

### MQTT (local, Smart Lock 3.0 Pro / 4.0 / Ultra)

1. You need an MQTT broker (Mosquitto…). The one of the Gladys MQTT integration works.
2. In the **Nuki app**, open the lock settings → _Features & Configuration_ → **MQTT**,
   enable it and enter the broker **IP address**, port, user and password.
3. In Gladys, fill in **MQTT broker URL** (e.g. `mqtt://192.168.1.10:1883`), user and
   password. The locks appear within seconds.

### Nuki Web (cloud)

1. Enable **Nuki Web** for your devices in the Nuki app.
2. On [web.nuki.io](https://web.nuki.io/), open **API** and generate an **API token**
   with at least the rights _Smartlock_, _Smartlock action_ and _Smartlock log_.
3. Paste it in **Nuki Web API token**.

### Create the devices

Open the **Discovery** tab of the integration and create the devices you want. If you
later pair a door sensor or a keypad, the Discovery tab offers to update the device.

## Options

- **Refresh interval**: how often the Bridge is read (10 s minimum, 30 s by default).
  Nuki Web is read at most every 30 seconds, and only when needed. MQTT needs no polling.
- **When Gladys unlocks**: _Unlock only_ (default) or _Unlock and open the door_ (unlatch).
- **When Gladys locks**: _Lock_ (default) or _Full lock_ (two turns, Smart Lock 3.0 and
  later; a plain lock on older models).

## Devices and features

**Smart Lock / Smart Door**

| Feature                 | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| Lock                    | Switch: 1 = locked, 0 = unlocked (controls the lock) |
| Lock state              | Locked / unlocked / moving / error                   |
| Battery                 | Charge level in %                                    |
| Battery low             | Critical battery alert                               |
| Charging                | Power pack charging (3.0 and later)                  |
| Door                    | Open / closed (if a door sensor is paired)           |
| Door sensor battery low | (if a door sensor is paired)                         |
| Keypad battery low      | (if a keypad is paired)                              |

**Opener**: _Ring to Open_ and _Continuous mode_ switches, _Battery low_, and _Doorbell_
(ring detection, through the Bridge).

## Scenes

### Triggers

- **Nuki lock operated** — a lock was locked, unlocked, opened or used Lock 'n' Go. Filter
  on the lock, the operation, **how** it was operated (app, by hand, button, keypad,
  fingerprint, auto lock, Nuki Web, HomeKit, MQTT, Gladys…) and the **Nuki user** (with
  Nuki Web). Variables: `action`, `trigger`, `user`, `device_name`.
  _Example: "when Alice unlocks the front door with the keypad, turn off the alarm"._
- **Nuki Opener: doorbell rang** — someone rang the intercom (Opener with a Bridge).
- **Nuki lock problem** — motor blocked, lock uncalibrated, or a command refused.
- **Nuki battery critical** — the battery of a lock, Opener, keypad or door sensor is low.

Operations started by Gladys itself are reported with the trigger `gladys`: exclude it in
the filter to avoid a scene reacting to its own actions.

### Actions

- **Operate a Nuki lock** — lock, unlock, open the door, Lock 'n' Go, full lock.
  Output: `success`.
- **Operate a Nuki Opener** — buzz the door, Ring to Open on/off, continuous mode on/off.
  Output: `success`.
- **Read a Nuki device** — outputs `locked`, `state`, `door_open`, `battery`,
  `battery_critical`, `reachable`, to use in the following actions (e.g. send a message
  "the door is still unlocked").
- **Lock every Nuki lock** — outputs `locked_count` and `failed_count`.

The standard Gladys "device state" trigger also works on every feature (door opened,
battery below 20 %…).

## Dashboard widgets

- **Nuki lock** — one lock or Opener: state, live battery, door, accessories, channel, last
  activity, and _Lock_ / _Unlock_ / _Open door_ buttons (the door opening asks for
  confirmation). For an Opener: _Open_ and _Ring to Open_.
- **Nuki overview** — every Nuki device at a glance and a **Lock all** button.
- **Nuki activity** — the latest operations: who, how and when (from Nuki Web when
  configured, otherwise from what the integration saw).

## Troubleshooting

- **"Nuki Bridge refused the API token"**: pair the Bridge again, or turn off _Send the
  token hashed_ if your Bridge firmware is older than 1.13.
- **"Nuki Bridge unreachable"**: check the IP address, and that the HTTP API is enabled.
  The Bridge handles one request at a time: avoid other software polling it too often.
- **MQTT: no lock appears**: check in the Nuki app that MQTT is connected, that the lock
  uses the broker **IP address**, and that Gladys uses the same broker.
- **No user name in the triggers**: user names come from Nuki Web; add an API token.
- The **Test the connection** button checks every configured channel and tells what works.

## Privacy and security

Tokens and passwords are stored by Gladys as secrets and never written to the logs. The
Bridge token is sent hashed by default. Nuki Web is only contacted when you configure an
API token. The activity history is kept in the integration's own data volume.
