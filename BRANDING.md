# Summit Branding

Last updated: 2026-07-01

This is the working brand template for Summit. It should guide app UI, website copy, screenshots,
store listings, docs, and launch materials. Keep it practical: if a brand choice does not help the
product feel clearer, calmer, or more trustworthy to technical self-hosters, it probably does not
belong in v1.

## Brand Core

### Product Name

**Summit**

Use `Summit` in product UI, docs, app store copy, support, and website language.

Avoid returning to older names such as `Agent Messenger` except when referring to legacy code,
bundle identifiers, or historical filenames.

### One-Line Description

The mobile cockpit for your self-hosted AI agent.

### Short Pitch

Summit lets you pair with your self-hosted agent, chat from anywhere, read rich output cleanly, and
act on blocking decisions from your phone.

### Positioning Thesis

We sell the flow, not a feature.

Markdown rendering is visible, but it is not the headline. The headline is the whole experience:
pair quickly, stay connected, stream smoothly, see status, and approve or stop work without opening
a desktop dashboard.

### Brand Promise

Your agent stays reachable, readable, and under control.

## Audience

### Primary Audience

Technical self-hosters running personal or business agents on Hermes today, OpenClaw later.

They are comfortable with:

- Self-hosted servers
- API keys
- Tunnels, relays, and sidecars
- Logs and diagnostics
- Privacy tradeoffs
- Tools that respect technical competence

### Not For

- Mainstream consumers with no self-hosted agent
- Social chat users looking for group messaging
- Enterprise/team buyers in v1
- Users who want file upload promises Hermes cannot support
- Privacy-maximalists who reject any relay surface by principle

## Brand Personality

Summit should feel like:

- Calm
- Technical
- Trustworthy
- Direct
- Quietly premium
- Operator-focused
- Precise without being cold

Summit should not feel like:

- Cute
- Consumer-social
- Crypto/security-theatre
- SaaS-marketing loud
- Overexplained
- Overanimated
- Generic AI assistant branding

## Voice And Tone

### Voice

Plain, capable, and specific.

Write like a serious tool made by someone who understands the user already knows what a relay,
connector, key, and server are. Do not talk down. Do not hide technical facts behind vague product
copy.

### Tone By Context

**App UI:** short, calm, action-oriented.

**Errors:** specific and useful.

**Website:** confident, concise, flow-led.

**Docs:** direct and inspectable.

**Support:** practical, honest, no canned warmth.

## Copy Rules

### Say This

- Pair your agent
- Connect through the relay
- Your API key stays on your server
- Enter the 6-digit code
- Agent disconnected
- Could not reach the relay
- Cron jobs unavailable over relay yet
- Remove local agent data
- Display name

### Avoid This

- Magical AI companion
- Secure by design without details
- Military-grade anything
- Effortless automation
- Social chat language
- Always-on intelligence
- One app for every AI agent
- Upload files to Hermes

### Error Copy Pattern

Use:

`What happened. What to try.`

Examples:

- `Pairing code not found. Check that the connector is still running and try again.`
- `Agent disconnected. Restart the connector, then send again.`
- `Cron jobs unavailable over relay yet. Direct Hermes connections can load jobs now.`

## Visual Direction

### Overall Feel

Dark, clean, and quiet. The UI should recede so the agent output and control moments are the focus.

Reference feeling:

- Claude/ChatGPT fluency
- Linear-like operator calm
- A control surface, not a social chatroom

### Color Direction

Current app tokens live in `src/theme.ts` and `DESIGN_SYSTEM.md`.

Core palette:

| Role | Hex | Notes |
|---|---|---|
| Background | `#0F1012` | near-black, slightly cool |
| Surface | `#1A1B1E` | inputs, panels |
| Raised surface | `#232428` | pressed/higher elevation |
| Primary text | `#F4F4F5` | clear on dark |
| Muted text | `#8B8B92` | secondary/status |
| Hairline | `#2A2B2F` | borders/dividers |
| Accent | `#5B9DFF` | focus, links, running state |
| Error | `#FF6B6B` | errors only |

Rules:

- Dark by default.
- Use grayscale for most UI.
- Use one accent sparingly.
- Avoid gradients, decorative blobs, and loud color systems.
- Do not make the app feel purple/blue-gradient SaaS.

### Typography

Use system fonts.

Use monospace only for:

- Code blocks
- Commands
- Pairing/install snippets
- Technical tokens

Do not make brand typography a project until the product flow is stable.

### Shape And Layout

- Rounded but not bubbly.
- Cards only where they frame a real repeated item or tool.
- Agent output is full width, not bubbled.
- User messages can use quiet right-aligned bubbles.
- Controls should feel dense enough for repeated use, not landing-page decorative.

## Logo And Mark

### Current Status

Logo is not final.

### Direction

The mark should suggest:

- A summit / peak / signal point
- A command surface
- Reachability
- Calm technical confidence

It should not suggest:

- A chatbot face
- A generic robot
- A speech bubble as the main symbol
- A mountain travel brand
- Consumer wellness/productivity

### App Icon Requirements

The icon should:

- Read clearly at small iOS sizes
- Work on dark and light system surfaces
- Avoid tiny detail
- Avoid text inside the icon
- Be recognizable as Summit, not Hermes/OpenClaw

## Product Surfaces

### App Header

Show the user-chosen agent display name.

Subtitle or secondary labels may show framework only:

- `Hermes`
- `OpenClaw`

Avoid showing transport noise such as `Hermes · Relay` in primary UI unless the user is in a
connection detail/debug screen.

### Pairing

Pairing is part of the brand.

It should feel:

- Inspectable
- Low-drama
- Fast
- Technical but not messy

Core message:

`Paste this prompt to your agent. It will install the connector and return a 6-digit code.`

### Relay Trust Copy

Say clearly:

- The connector runs next to the agent.
- The connector dials outbound to the relay.
- The app connects to the relay.
- The Hermes API key stays on the server.
- The phone stores only the relay pairing/device token.

Do not imply end-to-end encryption unless implemented.

## Privacy And Analytics

Privacy is a brand feature for this audience.

### Telemetry Principle

Operational telemetry only. No behavioral surveillance.

Allowed:

- Pair started/succeeded/failed
- Chat stream completed/failed
- Relay disconnected/reconnected
- Cron load succeeded/failed
- Framework and transport labels
- Error categories
- Duration metrics

Never collect:

- Message text
- Agent replies
- Markdown/code output
- Cron output
- Host URLs
- API keys
- Pairing codes
- Emails
- Session replay
- Screenshots

Suggested privacy copy:

> Summit collects minimal operational telemetry to understand pairing, relay reliability, crashes,
> and feature failures. We do not collect message content, agent responses, API keys, pairing codes,
> host URLs, cron output, or session replays.

## Naming System

### Product

Summit

### Infrastructure

Use plain technical names:

- Summit relay
- Summit connector
- Pairing code
- Device token
- Direct mode
- Relay mode

### Features

Prefer functional names over branded feature names.

Good:

- Cron Drops
- Recent chats
- Display name
- Pair agent
- Connected agent

Questionable:

- Agentverse
- SuperRelay
- Magic Pair
- CommandCloud

## Website And Store Copy

### Hero Options

Option A:

`The mobile cockpit for your self-hosted AI agent.`

Option B:

`Reach your agent from anywhere.`

Option C:

`A first-class mobile client for Hermes.`

### Supporting Copy

`Pair by code, chat with rich markdown, monitor status, and approve or stop work from your phone.`

### App Store Subtitle Ideas

- `Mobile client for AI agents`
- `Pair, chat, approve, stop`
- `Self-hosted agent cockpit`

### Screenshot Story

1. Pair with a 6-digit code.
2. Chat with rich markdown and code.
3. See status while work runs.
4. Approve or stop an action.
5. Open recent sessions and cron jobs.

## Launch Message

Use the flow:

1. You already run an agent.
2. Summit gives it a real mobile surface.
3. The connector dials out, so the phone can reach it.
4. The API key stays on your server.
5. Pair once, then work from your phone.

Avoid leading with:

- Generic AI assistant claims
- Markdown-only differentiation
- Enterprise productivity framing
- Multi-agent promises before v2

## Brand Checklist

Before shipping a screen, screenshot, page, or store asset, check:

- Does it feel like a cockpit, not a chatroom?
- Does it respect technical users?
- Is it honest about relay/direct mode?
- Does it avoid collecting or exposing sensitive agent content?
- Is the copy specific enough to debug the next action?
- Is the accent reserved for important moments?
- Does the visual style stay dark, quiet, and focused?
- Does it avoid promising OpenClaw/Hermes capabilities we have not implemented?

## Open Brand Decisions

- Final logo and app icon
- Final app store subtitle
- Whether the website leads with Hermes specifically or self-hosted agents generally
- Whether hosted relay is framed as paid infrastructure or included beta service
- Whether direct mode is visible in onboarding or tucked into advanced setup

## Source Of Truth

Brand decisions should stay aligned with:

- `plan to production.md`
- `PRD.md`
- `DESIGN_SYSTEM.md`
- `CONNECTION.md`
- `FRAMEWORKS.md`
