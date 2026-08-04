# Summit — App Store Listing Context

Working reference for `summit-app-store`. Field budgets are a **baseline, not the authority** — Apple
changes them; confirm against the live App Store Connect form before finalizing anything.

- App Store Connect app ID: `6792136519` (`eas.json`)
- Bundle ID: `com.dane04code.agentmessenger` (`app.json`)
- App name in config: `Summit` (slug is still `agent-messenger` — internal only, never user-facing)
- Version at last check: `1.0.0`

---

## Field budgets (baseline)

| Field | Limit | Indexed for search? | Notes |
|---|---|---|---|
| App name | 30 | **Yes — heaviest weight** | Every character here is prime keyword real estate |
| Subtitle | 30 | **Yes — second heaviest** | Also the highest-read line after the icon |
| Keyword field | 100 | **Yes** | Private; comma-separated, no spaces after commas |
| Promotional text | 170 | No | Editable without a build; use for timely messaging |
| Description | 4,000 | No | Only first ~3 lines visible before "more" |
| What's new | 4,000 | No | Per release |
| Support URL / Marketing URL | — | No | Support URL is required |
| Screenshots | up to 10 per device size | No | 6.9" iPhone set covers modern iPhone sizes |
| App previews | up to 3 per size | No | Autoplays muted — must read without audio |

**Keyword field rules that actually matter:**
- No spaces after commas — a space burns a character.
- Never repeat a word already in the app name or subtitle; those are indexed separately.
- Don't include plurals of a word already present, or the category name.
- Apple auto-combines terms across the field, so single words beat phrases (`self,hosted,agent`
  covers "self hosted agent").

---

## Positioning inputs

- **Primary one-liner:** The mobile cockpit for your self-hosted AI agent.
- **Core promise:** Your agent stays reachable, readable, and under control.
- **Audience (current, per `summit-cbo/brand-context.md`, resolved 2026-07-30):** casual-to-semi-
  technical Hermes/OpenClaw users already running a personal-assistant agent, messaging it through a
  raw Telegram bridge today, and tired of Telegram as the interface. **Not** the hardcore infra
  self-hoster.
- ⚠️ `docs/PUBLISHING_COPY.md` (dated 2026-07-04) still says "technical self-hosters running personal
  or business agents." That framing is superseded. Fix it when next editing that file.
- **Voice calibration:** clear and technical-literate without over-explaining, but warm, approachable,
  not self-serious. Between Buzz's confident-accessible voice and Claude's calm clarity, warmer than
  Claude.

---

## Category

- Primary: **Developer Tools**
- Secondary: **Productivity**

Primary category affects both browse placement and search weight. Developer Tools is a small, low-
competition pond that matches the actual audience — reconsider only if the audience call moves toward
general productivity users, which it currently has not.

---

## Seed keyword pool

Grouped by intent. An imported ASO skill should score these for volume/difficulty; this list defines
what's *allowed to be considered*, not final selections.

**Platform-intent (highest value — qualifies the exact user):**
`hermes`, `openclaw`, `self hosted`, `selfhosted`, `agent`, `agents`, `pair`, `relay`, `connector`

**Job-to-be-done:**
`remote`, `mobile client`, `terminal`, `cockpit`, `control`, `approve`, `approvals`, `status`,
`monitor`, `session`, `sessions`

**Adjacent-tool intent (people who'd want this):**
`homelab`, `automation`, `workflow`, `devtools`, `developer tools`, `ssh`, `dashboard`, `cli`,
`markdown`, `open source`

**Naming / brand:**
`summit`

### Rejected — do not use
Broad consumer AI terms Summit cannot rank for and that attract the wrong installs (which then
uninstall, which hurts ranking): `ai chat`, `chatbot`, `ai assistant`, `gpt`, `chatgpt`, `claude`,
`ai`, `bot`, `virtual assistant`, `productivity app`.

Competitor brand names other than platforms Summit genuinely integrates with — using a competitor's
trademark in metadata is an Apple rejection risk. `hermes` and `openclaw` are integrations, not
competitors, and describe real functionality; that's the line.

### Current keyword field (from `docs/PUBLISHING_COPY.md`, needs rework)
```
AI agent, self hosted, Hermes, automation, developer tools, markdown, remote agent, mobile client, open source, assistant, workflow
```
Problems: 121 chars (over budget), spaces after commas, `assistant` and `AI agent` are wrong-audience
head terms, `developer tools` duplicates the category, `agent` repeated across phrases. Rework before
submission.

---

## Banned terms (claim safety)

From `docs/PUBLISHING_COPY.md` "Avoid saying" — these are not sayable anywhere in the listing:

- "A general AI assistant"
- "Works with every agent"
- "End-to-end encrypted"
- "File upload support"
- "Secure by design" / "military-grade security"
- "Fully autonomous mobile agent"
- OpenClaw support presented as shipped v1 parity

Anything else asserting a capability must be checked against `summit-release-evidence`'s ledger
before it goes in a field. "Implemented but unproven" does not qualify.

---

## Current listing copy (as of `docs/PUBLISHING_COPY.md`, 2026-07-04)

**Subtitle (recommended):** `Self-hosted agent cockpit` (25 chars)
Alternates: `Pair, chat, approve, stop` / `Mobile client for AI agents`

**Promotional text:** "Pair with your self-hosted agent and keep it reachable from your phone. Summit
gives Hermes a clean mobile surface for chat, markdown, status, and approvals."

**Description:** full text lives in `docs/PUBLISHING_COPY.md` under "Full description" — treat that
file as the copy of record and keep it in sync with what's actually entered in App Store Connect.

**Support URL copy:** "Get setup help, connection notes, and privacy details for Summit."
**Marketing URL copy:** "The mobile cockpit for your self-hosted AI agent."

---

## Screenshot plan

Real app screens, dark UI, short specific captions, no explainer clutter inside the frame. Order
matters most — screenshots 1 and 2 are seen in search results before anyone taps through.

| # | Caption | Screen |
|---|---|---|
| 1 | Pair your agent with a short code. | Pair screen: install prompt + code input |
| 2 | Message your agent from your phone. | Main chat, user turn + streaming/complete agent reply |
| 3 | Markdown, code, and tables stay readable. | Agent response with heading, code block, table |
| 4 | Handle blocking decisions without opening the desktop. | Action request card, approve/stop |
| 5 | Pick up where you left off. | Drawer / recent sessions list |
| 6 | Your API key stays on your server. | Connection detail / trust screen showing relay-direct status |

Screenshot 4 depends on approval controls being proven on the target agent — check the evidence
ledger before shipping it (see the run-approval caveat in project memory: plumbing is wired and
tested app-side but doesn't fire on real Hermes until the send path moves to the Runs API).

---

## Privacy nutrition labels

Answer from actual behavior, not defaults. Facts to check against `summit-cto`'s `tech-context.md`
before filling the form:

- Credentials stored in Keychain only; the phone holds a relay device token, not the agent API key.
- Push notifications are content-free.
- Verify whether analytics (PostHog) is active in the shipped build and, if so, what it collects and
  whether it's linked to identity — this determines several label answers and is the most likely
  place to get it wrong.

App review notes should explain the pairing requirement plainly: Summit is useless without a paired
agent, so reviewers need a working demo path or they will reject for "incomplete functionality."
Preparing that demo path is a real prerequisite, not paperwork — flag it early to `summit-release`.
