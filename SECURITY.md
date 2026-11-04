# Security policy

This integration drives door locks: please treat any vulnerability seriously
and report it privately.

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- the channel involved (Nuki Bridge, MQTT, Nuki Web) and the Nuki models;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords, Nuki IDs and addresses
  first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## How the integration protects your access

- The Bridge API token, the MQTT password and the Nuki Web API token are
  `secret` configuration fields: Gladys never sends them back to the browser,
  and the integration never writes them to the logs.
- The Bridge token is sent **hashed** (SHA-256 with a timestamp and a random
  nonce) by default, never in clear on the network.
- Opening a door from a dashboard widget always asks for a confirmation.
- The container runs as a non-root user on a read-only filesystem; it only
  writes its activity history to `/data`.
- Nuki Web is only contacted when an API token is configured. Give the token
  the smallest set of rights the features need.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
the Nuki devices, apps, firmware and cloud (report those to
[Nuki](https://nuki.io/en/security/)), and your MQTT broker.
