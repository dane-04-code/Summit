# Summit Connection Explained Simply

This is the short version of how Summit connects a phone to a self-hosted agent.

## The Problem

Hermes runs on someone's own server, usually at home or on a VPS.

The phone cannot always reach that server directly. If the user is away from home, behind NAT, or on
cellular, a local Hermes address like `localhost:8642` or `192.168.x.x:8642` is useless to the phone.

So if Summit only asked for a server URL, the user would have to set up networking themselves:
Tailscale, Cloudflare Tunnel, port forwarding, ngrok, or a public domain.

That is too much friction for the main product.

## The Simple Idea

Summit uses a relay.

Instead of the phone trying to reach into the user's private server, a small connector runs next to
Hermes and connects outward to Summit's relay.

```text
Phone app -> Summit relay <- connector -> Hermes
```

The important part is that the connector makes an outbound connection. Outbound connections usually
work from home networks, VPSs, Docker containers, and locked-down servers.

## The Pieces

### 1. Summit App

The iPhone app the user uses.

It sends messages, receives replies, shows status, and handles actions like approve or stop.

### 2. Summit Relay

Our online bridge.

It sits at something like:

```text
relay.summitapp.dev
```

It does not run the agent. It just connects the phone and the user's connector.

### 3. Connector

A small background process installed next to Hermes.

It talks to Hermes locally:

```text
localhost:8642
```

And it talks outward to the Summit relay:

```text
relay.summitapp.dev
```

### 4. Hermes

The user's actual agent server.

Hermes stays private. It does not need to be publicly exposed for relay mode.

## First-Time Setup

The user opens Summit and sees a pairing screen.

Summit gives them a command or prompt to run on the Hermes machine:

```text
curl -fsSL https://get.summitapp.dev/connect | sh
```

That installs the connector.

The connector starts, connects to the relay, and prints a 6-digit code.

The user enters that code in the app.

Summit then knows:

```text
this phone belongs to this connector
```

After that, the user is connected.

## Normal Messaging

Once setup is done, every message in relay mode flows like this:

```text
1. User sends a message in the Summit app.
2. The app sends it to the Summit relay.
3. The relay forwards it to the user's connector.
4. The connector sends it to Hermes on localhost:8642.
5. Hermes replies.
6. The connector sends the reply back to the relay.
7. The relay streams the reply back to the app.
```

Short version:

```text
App -> Relay -> Connector -> Hermes -> Connector -> Relay -> App
```

## What Happens To The API Key?

In relay mode, the Hermes API key stays on the server.

The phone does not need the Hermes API key.

The connector uses the key locally when talking to Hermes.

The phone only gets a pairing token for the relay.

## Why Not Just Connect Directly?

Direct connection is still useful for advanced users.

That path is:

```text
Phone app -> public/Tailscale/tunnel Hermes URL
```

But the user has to make Hermes reachable themselves.

Relay mode is the default because it works without asking the user to become a networking admin.

## The One-Sentence Explanation

Summit works by installing a small connector beside Hermes; that connector dials out to Summit's
relay, the phone pairs with it using a short code, and messages pass through the relay to reach
Hermes without exposing the user's server publicly.
