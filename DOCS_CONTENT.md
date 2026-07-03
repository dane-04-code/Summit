# Docs Content — Summit
*Source content for the `/docs` page. Write this into MDX and render it.*
*Technical details sourced from [`FRAMEWORKS.md`](../../FRAMEWORKS.md).*

---

# Documentation

## Getting started

Summit is an iOS app for [Hermes](https://github.com/NousResearch/hermes-agent) — a
self-hosted AI agent by Nous Research. It gives you a proper mobile interface: markdown rendering,
approve/stop controls, and status at a glance.

**What you need before you begin:**
- A machine running Hermes (Linux, macOS, or WSL2)
- Hermes installed and working in your terminal
- The Summit app installed on your iPhone

OpenClaw support is coming. Hermes is the only supported framework in v1.

---

## Setting up Hermes

Hermes ships with an API server that's off by default. You need to enable it.

Open (or create) `~/.hermes/.env` and add:

```bash
API_SERVER_ENABLED=true
API_SERVER_KEY=your-secret-key
```

Replace `your-secret-key` with a strong random string. This is the key the app uses to
authenticate with your agent — treat it like a password.

Then start the server:

```bash
hermes gateway
```

The API server listens on port `8642` by default. You'll see a line like:
```
API server listening on 0.0.0.0:8642
```

That's it. Hermes is ready.

---

## Connecting the app

There are two ways to connect. **Relay mode** (the default) works from anywhere — cellular, WiFi,
away from home. **Direct mode** (advanced) works only when your phone can reach your server directly,
e.g. via Tailscale or a public URL.

### Relay mode (recommended)

Relay mode uses a small connector that runs next to Hermes. The connector dials out to our relay,
so Hermes never needs to be exposed to the internet. Your API key stays on your server.

**Step 1 — Install the connector**

Ask your agent to do it. Open the app, and on the pair screen you'll see a copyable prompt.
Paste it to your agent anywhere you currently chat with it (desktop, terminal, Telegram). Your
agent will run the installer, start the connector, and read back a **6-digit code**.

If you'd rather do it yourself, run the one-liner shown on the pair screen directly on your server.

**Step 2 — Enter the code**

Type the 6-digit code into the app. The relay binds your device to your agent. You'll see
`Connected to Hermes` and land in the chat view.

The code is single-use and expires after a few minutes.

**Step 3 — Done**

The connector runs in the background and reconnects automatically. You don't need to touch it again.

---

### Direct mode (advanced)

Use this if you already expose Hermes on a reachable URL (Tailscale, reverse proxy, ngrok, etc.)
and you'd rather not use the relay.

On the pair screen, tap **Connect manually**. Enter:
- **Host URL** — the full URL to your Hermes server, e.g. `https://hermes.yourdomain.com` or `http://100.x.x.x:8642`
- **API key** — the `API_SERVER_KEY` value from your `.env`

The app calls `GET /v1/capabilities` to verify the connection and detect what your Hermes version
supports.

**Note:** In direct mode, your API key is stored on-device in the iOS Keychain. The key is never
transmitted anywhere except directly to your server.

---

## Approve & stop

Some agent tasks ask for your confirmation before proceeding — for example, running a shell command
or modifying a file. When Hermes hits one of these points, the app shows an **Approve** / **Stop**
card.

- **Approve** — the agent continues with the action
- **Stop** — the agent halts at the next safe interruption point

This requires Hermes to advertise `run_approval` support in its capabilities response. If your
Hermes version doesn't support it, the approve/stop controls won't appear.

Push notifications for approval requests are coming in v2 — for now, you'll see the pending state
when you open the app.

---

## FAQ

**The connector installed but the app won't connect.**
Check that the connector process is still running (`ps aux | grep summit-connector`).
The connector needs outbound internet access on port 443. If your server is behind a firewall,
make sure outbound WebSocket connections are allowed.

**I get "Couldn't reach host" in direct mode.**
The app can't reach your Hermes server. Confirm:
1. `hermes gateway` is running
2. The host URL is correct and reachable from your phone's network
3. `API_SERVER_ENABLED=true` is in your `.env`

**My API key stopped working.**
You may have changed `API_SERVER_KEY` in `.env` without restarting Hermes. Restart with
`hermes gateway` and re-enter the key in the app (Settings → Connection).

**Markdown isn't rendering correctly.**
The app renders markdown incrementally as the agent streams tokens. Complex nested structures
(tables inside blockquotes, etc.) may render awkwardly mid-stream and settle correctly when
the turn finishes. If a completed message still looks wrong, open an issue on GitHub.

**OpenClaw support?**
Coming in v2. OpenClaw has a different API surface — particularly around approve/stop controls,
which are WebSocket-based rather than REST. We'll add it after the Hermes version is stable.

**Can I self-host the relay?**
Not yet, but it's planned. The relay is designed to be open-source and self-hostable (open-core
model). If this matters to you, reach out at [support@domain] — knowing demand helps prioritise it.

---

## Support

Email: `support@[domain]`

For bugs or feature requests, open an issue on GitHub (link available when the repo is public).

For questions about Hermes itself, the [Hermes Discord](https://hermes-agent.nousresearch.com/docs)
and the Nous Research community are the right place.
