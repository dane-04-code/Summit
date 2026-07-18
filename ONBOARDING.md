# Onboarding

The goal is **paired and in chat in under two minutes**. First-run connection has one primary path:
the agent installs its connector and gives the user a six-digit code.

## The flow

```text
Welcome → account → Pair your agent → chat
                         │
                         ├─ 1. Copy one prompt into the agent
                         └─ 2. Enter the returned six-digit code
```

The advanced host + API-key connection implementation is retained for development, but it is hidden
from onboarding during the beta. Pairing has no back route into that form.

## The pairing screen

The screen shows the exact prompt the user should send:

```text
Connect this agent to my Summit mobile app.

Run this exact command on the machine where you are running:

curl -fsSL https://get.summitapp.dev/connect | sh

When it finishes, reply with only the 6-digit pairing code. If it fails, send me the full error
output instead.
```

The user can copy the whole agent prompt or just the terminal command. The prompt and command share
one compact card; there is no nested scrolling or duplicated installer content.

The connector runs beside the agent, finds its local credentials, dials the Summit relay, and prints
a single-use six-digit code. The user enters that code and Summit opens chat immediately.

## Security and persistence

- The agent API key stays on the server; it never reaches the phone or relay.
- Pairing codes are short-lived and single-use. They must not be shared.
- Successful pairing stores only the relay credential in the iOS Keychain.
- The connector runs in the background and reconnects automatically.
