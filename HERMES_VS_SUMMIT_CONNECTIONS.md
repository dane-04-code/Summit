# Hermes Messaging vs Summit Relay

This is a clean comparison between how Hermes messaging platforms work and how Summit works.

## The Big Picture

Hermes messaging platforms and Summit use the same basic connection idea:

```text
Run something near Hermes that connects outward.
```

That avoids asking the user to expose their Hermes server publicly.

## Simple Comparison

| System | What Connects Outward? | What Is In The Middle? | Where Does The User Talk? |
|---|---|---|---|
| Telegram | Hermes gateway | Telegram cloud | Telegram app |
| Slack | Hermes gateway | Slack Socket Mode | Slack app |
| Discord | Hermes gateway | Discord gateway | Discord app |
| Matrix | Hermes gateway | Matrix homeserver | Matrix client |
| Summit | Summit connector | Summit relay | Summit app |

## Message Flow

### Telegram / Slack / Discord / Matrix

```text
User sends message in chat app
  -> platform cloud/homeserver
  -> Hermes gateway adapter
  -> Hermes agent
  -> Hermes gateway adapter
  -> platform cloud/homeserver
  -> user sees reply in chat app
```

### Summit

```text
User sends message in Summit app
  -> Summit relay
  -> Summit connector
  -> Hermes local API
  -> Summit connector
  -> Summit relay
  -> user sees reply in Summit app
```

## Backend Process

### Hermes Messaging Platforms

Hermes runs one gateway process:

```text
hermes gateway
```

That gateway loads adapters:

```text
telegram.py
slack.py
discord.py
matrix.py
```

Each adapter knows how to speak its platform.

### Summit

Summit runs a connector process beside Hermes:

```text
summit-connector
```

The connector speaks:

```text
Summit relay WebSocket <-> Hermes local HTTP API
```

## What Each Backend Is Responsible For

| Responsibility | Hermes Gateway | Summit Connector / Relay |
|---|---|---|
| Receive user message | Platform adapter | Summit relay receives app frame |
| Identify user/chat/session | Hermes gateway/session key | Relay pairing + app/connector binding |
| Authorize user | Platform allowlist / pairing | Relay pairing token/code |
| Run agent | Hermes gateway directly invokes agent | Connector calls Hermes API |
| Stream/send reply | Platform adapter sends to chat app | Connector -> relay -> app |
| Store session history | Hermes session database | Summit local SQLite plus Hermes state |
| Handle platform quirks | Adapter-specific code | App-owned UI, fewer platform limits |

## Pairing And Auth

### Hermes Messaging

Hermes auth is about allowing a person inside a chat platform to use the agent.

Examples:

```text
TELEGRAM_ALLOWED_USERS=123456789
SLACK_ALLOWED_USERS=...
DISCORD_ALLOWED_USERS=...
MATRIX_ALLOWED_USERS=...
```

Hermes also has DM pairing codes for authorizing platform users.

### Summit

Summit pairing is about binding a phone app to a connector.

Flow:

```text
1. Connector connects to Summit relay.
2. Connector gets/prints a 6-digit code.
3. User enters code in Summit app.
4. Relay binds phone <-> connector.
```

Hermes API key stays on the server. The phone gets a relay token/secret.

## Inbound vs Outbound

### Direct Hermes API

Bad default mobile experience:

```text
Phone -> user's Hermes server
```

This requires the user to expose Hermes, use Tailscale, set up a tunnel, or be on the same LAN.

### Hermes Messaging Platforms

Better:

```text
Hermes gateway -> platform cloud
```

Hermes reaches outward. The platform cloud is the meeting point.

### Summit

Same idea:

```text
Summit connector -> Summit relay
Summit app -> Summit relay
```

Both sides connect outward. The relay joins them.

## Platform By Platform

### Telegram

Hermes:

```text
Hermes gateway -> Telegram Bot API polling
```

Summit equivalent:

```text
Summit connector -> Summit relay WebSocket
```

Similarity:

Both avoid public inbound networking.

Difference:

Telegram owns the user interface. Summit owns the user interface.

### Slack

Hermes:

```text
Hermes gateway -> Slack Socket Mode WebSocket
```

Summit equivalent:

```text
Summit connector -> Summit relay WebSocket
```

Similarity:

Slack Socket Mode is the closest mental model for Summit. The backend process keeps an outbound
WebSocket open.

Difference:

Slack events are Slack-shaped. Summit frames are product-specific and can be designed around agent
status, markdown, approve/stop, and streaming.

### Discord

Hermes:

```text
Hermes gateway -> Discord bot gateway
```

Similarity:

Persistent bot connection, message events, replies, threads.

Difference:

Discord has server/channel/thread/mention rules. Summit can use a simpler model: one user, one
agent, one app-owned session surface.

### Matrix

Hermes:

```text
Hermes gateway -> Matrix homeserver
```

Similarity:

Private/self-hostable relay-like middle layer.

Difference:

Matrix is a full federated chat system. Summit relay is intentionally thinner: pair and forward
frames.

## What Hermes Platforms Do Better Today

Hermes messaging platforms already have mature patterns for:

- user authorization
- chat/session identity
- slash commands
- file/media delivery
- platform-specific threading
- long-running gateway process
- setup commands
- service install
- retries and reconnects

Summit should learn from these.

## What Summit Can Do Better

Summit owns the mobile UI, so it can do things chat platforms cannot do cleanly:

- proper markdown layout
- code blocks and tables
- agent status
- approve/stop buttons
- pairing diagnostics
- clean reconnect states
- quieter notifications
- purpose-built history
- connection management

Hermes platforms make the agent available in existing chat apps.

Summit makes the agent feel like a first-class mobile product.

## Key Architectural Difference

Hermes messaging gateway runs the agent directly inside Hermes:

```text
Platform event -> Hermes gateway -> AIAgent
```

Summit connector calls Hermes through its API:

```text
Summit app -> relay -> connector -> Hermes HTTP API
```

That means Summit should respect the Hermes API boundary:

- `/v1/capabilities`
- `/v1/chat/completions`
- Runs API for approve/stop
- streaming response events

## What Summit Should Borrow

From Hermes Telegram:

- simple setup
- reliable outbound connection
- good handling for long replies

From Hermes Slack:

- outbound WebSocket mental model
- app manifest/install clarity
- command and event separation

From Hermes Discord:

- session/thread isolation
- clear rules for when the agent responds

From Hermes Matrix:

- self-hostable mindset
- privacy-conscious deployment
- optional encryption thinking later

From all Hermes platforms:

- specific connection errors
- authorization before agent execution
- session identity as a first-class concept
- background service install
- reconnect behavior

## Clean Summary

Hermes messaging platforms:

```text
Hermes gateway connects outward to existing chat platforms.
The user talks inside those chat platforms.
```

Summit:

```text
Summit connector connects outward to Summit relay.
The user talks inside the Summit app.
```

The connection architecture is similar.

The product experience is different.

Hermes platforms are bridges into other apps.

Summit is the dedicated mobile cockpit.
