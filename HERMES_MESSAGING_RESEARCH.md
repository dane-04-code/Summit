# Hermes Messaging Platform Research

Last researched: 2026-06-29

This explains how Hermes messaging platforms work: Telegram, Discord, Slack, Matrix, and the wider
gateway system.

## Short Answer

Hermes uses a single long-running messaging gateway process.

That gateway loads one adapter per messaging platform:

```text
Telegram adapter
Discord adapter
Slack adapter
Matrix adapter
...
```

Each adapter receives messages from its platform, normalizes them into a common Hermes message event,
hands them to the Hermes agent runner, then sends the response back through the same platform.

Simple shape:

```text
Telegram/Slack/Discord/Matrix
        |
        v
Hermes platform adapter
        |
        v
GatewayRunner
        |
        v
AIAgent + memory + tools + skills
        |
        v
GatewayRunner
        |
        v
Platform adapter sends reply
```

Official Hermes docs describe the gateway as a single background process that connects to all
configured platforms, handles sessions, runs cron jobs, and delivers voice messages.

Source: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/

## Core Gateway Architecture

Hermes' gateway has a shared backend path for every messaging app.

When a message arrives:

1. Platform adapter receives the raw platform event.
2. Adapter normalizes it into a `MessageEvent`.
3. Base adapter checks if the session already has a running agent.
4. Gateway resolves the session key.
5. Gateway checks authorization.
6. Gateway checks if the message is a slash command.
7. If not a command, Gateway creates/runs the `AIAgent`.
8. Response is delivered back through the platform adapter.

Hermes session keys encode the platform and chat context:

```text
agent:main:{platform}:{chat_type}:{chat_id}
```

Example:

```text
agent:main:telegram:private:123456789
```

Thread-aware platforms can include thread IDs in the session context.

Source: https://hermes-agent.nousresearch.com/docs/developer-guide/gateway-internals/

## Storage And Sessions

Hermes stores conversations in SQLite:

```text
~/.hermes/state.db
```

The session database stores:

- session id
- source platform
- user id
- session title
- model/config snapshot
- system prompt snapshot
- message history
- tool calls/results
- token counts
- timestamps

That means Telegram, Discord, Slack, Matrix, and CLI conversations all become Hermes sessions.

Source: https://hermes-agent.nousresearch.com/docs/user-guide/sessions/

## Authorization Model

Hermes does not let every random chat user control the agent by default.

The gateway checks authorization in layers:

1. Platform allow-all flag, such as `TELEGRAM_ALLOW_ALL_USERS`.
2. Platform allowlist, such as `TELEGRAM_ALLOWED_USERS`.
3. DM pairing code.
4. Global allow-all, `GATEWAY_ALLOW_ALL_USERS`.
5. Default: deny.

Hermes also has an internal DM pairing flow where an admin can generate a code and a new user can
send that code to become authorized.

This is different from Summit pairing. Hermes pairing authorizes a chat user inside an existing
messaging platform. Summit pairing binds a mobile app to a connector/agent through our relay.

Source: https://hermes-agent.nousresearch.com/docs/developer-guide/gateway-internals/

## Gateway Commands

Common setup and runtime commands:

```bash
hermes gateway setup
hermes gateway
hermes gateway install
hermes gateway start
hermes gateway stop
hermes gateway status
```

`hermes gateway setup` is the interactive wizard for configuring platform credentials.

`hermes gateway install` installs the gateway as a user service on Linux/macOS. Linux also supports
system service install.

Source: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/

## Platform Summary

| Platform | Backend Pattern | Library / API | Needs Public Inbound URL? | Main Notes |
|---|---|---|---|---|
| Telegram | Bot API polling by default, webhook optional | `python-telegram-bot` | No for polling, yes for webhook | Easiest mobile path; supports DMs, groups, topics, files, streaming edits |
| Discord | Discord bot gateway | `discord.py` | No | DMs, channels, threads, voice, slash commands, mention rules |
| Slack | Socket Mode WebSocket | `slack-bolt`, `slack_sdk` | No | Uses outbound WebSocket, bot token + app token, strong model for Summit |
| Matrix | Matrix homeserver client | `mautrix` | No | Self-hostable/federated, rooms, threads, optional E2EE |

## Telegram

### How It Works

Telegram uses a bot token from BotFather.

By default, Hermes connects using long polling:

```text
Hermes gateway -> Telegram servers
```

Telegram long polling is outbound from the Hermes machine, so it works from a laptop, VPS, or home
server without exposing Hermes publicly.

Telegram webhook mode is optional:

```text
Telegram servers -> public Hermes webhook URL
```

Webhook mode is better for cloud platforms that sleep when idle, because Telegram can wake the app by
calling an HTTPS URL.

Source: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram/

### Setup

Typical setup:

```text
1. Create bot with BotFather.
2. Get Telegram bot token.
3. Find numeric Telegram user ID.
4. Run hermes gateway setup.
5. Select Telegram.
6. Paste token and allowed user IDs.
7. Run hermes gateway.
```

Manual env values:

```text
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ALLOWED_USERS=...
```

### Behavior

- DMs work naturally.
- Groups can require mentions.
- Forum topics can be used as thread contexts.
- `/sethome` marks a chat as the home channel for cron/job delivery.
- Files can be delivered as native attachments.
- Tool/status updates can be edited into existing messages to reduce spam.
- Telegram can render interactive clarify prompts with inline keyboard buttons.

### Backend Detail

The Telegram adapter uses `python-telegram-bot`.

Source code: https://github.com/NousResearch/hermes-agent/blob/main/gateway/platforms/telegram.py

## Discord

### How It Works

Discord uses a Discord bot application.

Hermes connects through Discord's bot/gateway system using `discord.py`.

The user can talk to Hermes through:

- DMs
- server channels
- free-response channels
- threads
- voice channels

Source: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord

### Setup

Typical setup:

```text
1. Create Discord application.
2. Create bot.
3. Enable needed intents.
4. Invite bot to server.
5. Find Discord user ID.
6. Run hermes gateway setup.
7. Select Discord.
8. Paste bot token and allowed user IDs.
9. Run hermes gateway.
```

### Behavior

- DMs respond to every message.
- Server channels require `@mention` by default.
- Free-response channels can be configured.
- Threads stay isolated for session history.
- Shared channels isolate history per user by default.
- Slash commands work through Discord.
- Voice support exists for Discord-specific voice-channel use cases.

### Gateway Process

Hermes Discord is not a stateless webhook.

Each Discord message goes through:

1. authorization
2. mention/free-response checks
3. session lookup
4. transcript loading
5. normal Hermes agent execution
6. response delivery back to Discord

Source: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord

### Backend Detail

The Discord adapter uses `discord.py`.

Source code: https://github.com/NousResearch/hermes-agent/blob/main/gateway/platforms/discord.py

## Slack

### How It Works

Slack uses Socket Mode.

That means Hermes opens an outbound WebSocket connection to Slack:

```text
Hermes gateway -> Slack Socket Mode
```

This is important: Slack does not require a public webhook URL for Hermes.

Hermes can run behind a firewall, on a laptop, or on a private server and still receive Slack events
because it dials outward.

Source: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack/

### Setup

Slack requires:

- bot token: `xoxb-...`
- app-level token: `xapp-...`
- Socket Mode enabled
- app scopes
- event subscriptions
- slash commands

Hermes can generate a Slack app manifest:

```bash
hermes slack manifest --write
```

Then the user pastes that manifest into Slack's app creation flow.

After that:

```bash
hermes gateway setup
hermes gateway
```

### Behavior

- DMs and channels are supported.
- The bot must be invited into channels.
- Threads are supported.
- Slash commands are native Slack slash commands.
- Slack's own limitation means slash commands do not work inside thread replies, so Hermes supports
  alternative command patterns there.

### Backend Detail

The Slack adapter uses:

- `slack-bolt`
- `slack_sdk`
- Socket Mode async handler

Source code: https://github.com/NousResearch/hermes-agent/blob/main/gateway/platforms/slack.py

## Matrix

### How It Works

Matrix uses a Matrix bot/user account on a homeserver.

Hermes connects to that homeserver using the `mautrix` Python SDK:

```text
Hermes gateway -> Matrix homeserver
```

The homeserver can be self-hosted or public, such as matrix.org.

Source: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/matrix/

### Setup

Typical setup:

```text
1. Create Matrix bot account.
2. Get access token, or provide user/password.
3. Find Matrix user IDs for allowed users.
4. Run hermes gateway setup.
5. Select Matrix.
6. Enter homeserver URL, token, and allowed users.
7. Run hermes gateway.
```

Important env values include:

```text
MATRIX_HOMESERVER=...
MATRIX_ACCESS_TOKEN=...
MATRIX_USER_ID=...
MATRIX_PASSWORD=...
MATRIX_ALLOWED_USERS=...
MATRIX_ALLOWED_ROOMS=...
MATRIX_REQUIRE_MENTION=true
```

### Behavior

- DMs respond to every message.
- Rooms require `@mention` by default.
- Free-response rooms can be configured.
- Matrix threads are supported.
- Room invites can be auto-accepted.
- Optional E2EE is supported.
- Reactions can be used for approval/model-picker interactions.
- Tool activity can be shown as threaded/editable panes instead of flooding the room.

### Backend Detail

The Matrix adapter uses `mautrix`.

Source code: https://github.com/NousResearch/hermes-agent/blob/main/gateway/platforms/matrix.py

## Attachments And Media

Hermes has a cross-platform `MEDIA:/path/to/file` convention.

When the agent replies with a `MEDIA:` tag, the gateway extracts it and sends the referenced file as
a native attachment on platforms that support native files.

Supported attachment types include:

- images
- audio
- video
- documents
- office files
- archives

Telegram, Discord, Slack, Signal, WhatsApp, Feishu, and Matrix are listed as platforms where native
attachment delivery is supported.

Source: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram/

## One-Shot Sending

Hermes also has `hermes send`.

This is different from a live chat turn.

`hermes send` is a CLI command that sends a message to a configured platform target using the same
credentials and adapters. For bot-token platforms, it usually does not need the gateway running; it
can call the platform REST endpoint directly and exit.

Examples:

```bash
hermes send --to telegram "deploy finished"
echo "RAM 92%" | hermes send --to slack:#ops
hermes send --to discord:#builds --file build.log
```

Source: https://hermes-agent.nousresearch.com/docs/guides/pipe-script-output

## Experimental Hermes Relay Adapter

Hermes docs also mention an experimental connector-backed relay platform.

When `GATEWAY_RELAY_URL` or `gateway.relay_url` is configured, the Hermes gateway can register a
generic `relay` platform and dial a connector over outbound WebSocket frames.

This is conceptually close to Summit's direction:

```text
Hermes gateway -> outbound WebSocket -> relay/connector
```

However, Summit's current plan is:

```text
Summit app -> Summit relay -> Summit connector -> Hermes local API
```

The Hermes relay adapter is worth investigating later because it might let Summit integrate more
natively with Hermes' gateway path instead of only the REST API path.

Source: https://hermes-agent.nousresearch.com/docs/developer-guide/gateway-internals/

## What This Means For Summit

Hermes' own messaging platforms all prove the same basic pattern:

```text
Run something near Hermes that connects outward to a platform.
```

Telegram:

```text
Hermes gateway -> Telegram
```

Slack:

```text
Hermes gateway -> Slack Socket Mode
```

Discord:

```text
Hermes gateway -> Discord bot gateway
```

Matrix:

```text
Hermes gateway -> Matrix homeserver
```

Summit:

```text
Summit connector -> Summit relay
```

So Summit is not inventing a strange connection model. It is copying the successful shape Hermes
already uses for messaging platforms: outbound connector/gateway, platform in the middle, no need to
expose the user's private Hermes server.

## Important Difference Between Hermes Gateway And Summit

Hermes messaging gateway is a chat-platform bridge.

It makes Hermes available inside existing apps:

```text
Telegram, Discord, Slack, Matrix, etc.
```

Summit is trying to be the dedicated mobile app.

That means Summit needs things those platforms do not provide cleanly:

- native mobile pairing
- readable markdown
- agent status
- clean approve/stop controls
- quieter notifications
- connection diagnostics
- a product-owned UI instead of chat-app formatting limits

## Practical Takeaways

1. Hermes' proven backend pattern is a persistent gateway process with adapters.
2. Most platforms avoid public inbound networking by using outbound polling/WebSockets.
3. Slack Socket Mode is the closest mental model for Summit relay.
4. Telegram long polling is the simplest mental model for "why outbound works."
5. Discord and Matrix show how important session/thread isolation is.
6. Hermes already has authorization, pairing, commands, sessions, and media handling patterns we can
   learn from.
7. Summit should keep its relay simple, but borrow Hermes' proven ideas:
   - per-session routing
   - explicit pairing
   - clear authorization
   - thread/session identity
   - good interruption handling
   - specific connection errors

## Sources

- Hermes Messaging Gateway: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/
- Hermes Gateway Internals: https://hermes-agent.nousresearch.com/docs/developer-guide/gateway-internals/
- Hermes Sessions: https://hermes-agent.nousresearch.com/docs/user-guide/sessions/
- Telegram setup: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram/
- Discord setup: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord
- Slack setup: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack/
- Matrix setup: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/matrix/
- `hermes send`: https://hermes-agent.nousresearch.com/docs/guides/pipe-script-output
- Telegram adapter source: https://github.com/NousResearch/hermes-agent/blob/main/gateway/platforms/telegram.py
- Discord adapter source: https://github.com/NousResearch/hermes-agent/blob/main/gateway/platforms/discord.py
- Slack adapter source: https://github.com/NousResearch/hermes-agent/blob/main/gateway/platforms/slack.py
- Matrix adapter source: https://github.com/NousResearch/hermes-agent/blob/main/gateway/platforms/matrix.py
