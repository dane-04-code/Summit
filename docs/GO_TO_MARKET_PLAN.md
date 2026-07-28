# Summit — Beta, Launch, and Test-User Plan

_Started: 2026-07-22_  
_Owner: Summit team_  
_Status: working plan — private beta precedes public launch_

## 1. Objective

Launch Summit as an iOS mobile cockpit for people who already run a self-hosted **Hermes** agent.
The immediate job is not reach. It is to find a small number of technically capable users, prove
that they can pair and depend on the core mobile loop, and collect the language and evidence needed
for a truthful public launch.

### The beta promise

> Pair your Hermes agent once, then reach it from your phone: clear streamed chat, quiet safe
> activity, reliable recovery, and privacy-safe notifications when attention is useful.

Only claim a capability in recruiting or public copy after it has passed the release-build device
test. In particular, do not promise OpenClaw support, end-to-end encryption, arbitrary remote UI,
file uploads, native approval cards, or Cron management/results until each is released and proven.

## 2. Audience and offer

### Ideal first tester

- Runs Hermes on a machine they control and can install/enable the Summit plugin on.
- Uses an iPhone capable of running the TestFlight build.
- Has a real reason to check their agent away from a desktop: long-running work, periodic jobs, or
  decisions that may need attention.
- Is comfortable following a short setup guide and describing a failure without sharing credentials
  or sensitive agent content.

Do not recruit generic AI-chat users, people who only use hosted chatbots, or users whose first need
is unsupported framework compatibility. They will create noise rather than launch evidence.

### Offer

Invite testers to a private, no-cost TestFlight beta. Set expectations clearly:

- 20–30 minutes for first setup and the guided checks.
- Normal use for two to three days afterward.
- A short feedback form plus permission to request follow-up.
- Beta software may fail; never use it as the only path for an irreversible or high-risk action.

## 3. Staged tester programme

Recruit continuously, but admit people in small cohorts so each discovery can be fixed and retested.

| Cohort | Size | Purpose | Graduation condition |
|---|---:|---|---|
| Friendly technical alpha | 3 | Validate instructions, plugin install, pairing, and feedback flow. | All three can pair and complete a normal chat; onboarding issues have a clear fix or documented workaround. |
| Private beta | 5–8 | Validate the release build across real hosts, networks, and iPhone versions. | At least five active pairings; no unresolved P0/P1 privacy, pairing, recovery, or notification issue. |
| Release-candidate beta | 12–20 total | Confirm repeat use, copy clarity, and store readiness. | Core-loop success meets the release bar in §8 and feedback no longer reveals the same critical issue. |

Keep a reserve list rather than inviting everyone at once. A small, engaged cohort is more useful
than a large TestFlight list with no paired agents.

## 4. Recruitment plan

### Priority order

1. Personal and warm technical contacts who already run Hermes or adjacent self-hosted agents.
2. The Hermes community, using the early-feedback post in `docs/PUBLISHING_COPY.md` only after the
   plugin's public install path and the TestFlight invitation are ready.
3. Self-hosted-agent communities where project feedback is permitted; adapt the post to the
   community rules and lead with the beta request rather than a launch announcement.
4. A simple landing-page early-access form for everyone else. Collect only contact details and the
   screener fields below.

Do not use Product Hunt, Hacker News, or a broad Reddit launch to recruit the first cohort. Those
channels belong to the public launch, once the onboarding is reliable and support capacity exists.

### Screener fields

- Email or preferred contact method.
- Do you currently run Hermes? Which version and host OS?
- iPhone model and iOS version.
- Typical agent use case (one sentence; do not request prompts, logs, keys, or message content).
- Can you install/enable a plugin on the agent host?
- Can you spend 20–30 minutes on setup and use the app for the next two days?
- May we contact you about a setup issue? Yes/no.

### Outreach message

Use this short invitation for warm contacts and adapt it for community rules:

> I’m inviting a small group of Hermes users to test Summit, an iPhone companion for an agent you
> already run. The beta focuses on pairing by code, streamed chat, quiet activity, recovery after
> interruption, and privacy-safe notifications. It is not a general chatbot and Hermes is the only
> supported framework in this beta. If you run Hermes, have an iPhone, and can spend about 30 minutes
> setting up plus a couple of days using it normally, I’d value your feedback. Reply here and I’ll
> send the short setup and TestFlight invite.

## 5. Tester journey and feedback loop

### First-session script

1. Install from TestFlight and complete account/onboarding.
2. Enable/install the Hermes plugin and pair using the displayed six-digit code.
3. Send one normal request that produces a streamed response and safe activity.
4. Background the app before a reply completes; confirm the settled reply and, where enabled, the
   generic notification and correct tap-to-thread behaviour.
5. Cold-open Summit and confirm the correct session and settled transcript return without a duplicate.
6. If the tester already has a safe scheduled job, observe one result. This is optional until the
   production cron path is release-proven.
7. Ask the tester to use Summit normally for 48–72 hours.

### What to capture

Collect feedback in one tracker per tester:

- Setup started / paired / first message / background recovery / notification / day-two use.
- Where they got stuck, exact visible error, iPhone/iOS, Hermes/plugin version, and network context.
- One clarity question: “What did you expect this screen or state to mean?”
- One value question: “When did Summit save you from returning to your desktop?”
- Severity: P0 privacy/security, P1 cannot pair/chat/recover, P2 confusing or degraded, P3 polish.

Never request API keys, pairing codes, message transcripts, screenshots containing sensitive content,
or raw tool output. Ask for redacted screenshots only when the visible UI is necessary to diagnose an
issue. Use content-free operational logs only with explicit consent.

### Feedback cadence

- **Same day:** acknowledge every setup report and resolve P0/P1 issues before inviting more users.
- **After first session:** send the short check-in based on the questions above.
- **Day 3:** request a short retrospective and one sentence of permissioned testimonial feedback.
- **Weekly while beta runs:** publish a concise “fixed / investigating / next” note to active testers.

## 6. Launch assets and workstream

### Must exist before broad recruiting

- A landing page or concise hosted page that states the Hermes-first beta, who it is for, how to
  request access, documentation, privacy policy, and a support contact.
- A tested plugin installation/pairing guide that mirrors the current build exactly.
- TestFlight invite flow and a private tester tracker.
- A lightweight support path with a response owner and a visible expected-response-time note.

### Must exist before public launch

- Final App Store metadata, privacy answers, support URL, marketing URL, and review notes.
- Five real-device screenshots following the story in `docs/PUBLISHING_COPY.md`, updated to show
  only shipped features.
- A 30–60 second silent-or-captioned demo: pair → send a real request → see quiet activity → receive
  a settled result after backgrounding → reopen the correct conversation.
- Landing page, docs, privacy policy, support contact, and App Store link live.
- One polished announcement each for the Hermes community, relevant self-hosted community, X, and
  the chosen launch channel. Product Hunt/Hacker News are optional, not launch gates.

### Copy integrity pass

Before publishing, update `WEBSITE_PRD.md` and `docs/PUBLISHING_COPY.md` to match the verified
release capability set. Their older language currently describes Hermes and OpenClaw together and
foregrounds approval/Cron behaviour too broadly. The current beta should lead with Hermes, relay
pairing, chat, safe activity, recovery, and notifications only where proven.

## 7. Seven-day operating cadence

| Day | Main outcome | Concrete work |
|---|---|---|
| 0 | Beta is recruitable | Freeze the beta promise, choose support contact/tracker, create screener, and audit existing copy for unsupported claims. |
| 1 | First cohort invited | Publish the minimum landing/access page, finalize plugin setup instructions, send 10–15 warm invitations, schedule three first sessions. |
| 2 | Onboarding truth | Guide the friendly alpha through pairing and recovery; fix only core-loop failures; rewrite setup instructions from observed friction. |
| 3 | Private beta opens | Invite the next 5–8 qualified testers only if the first cohort clears the pairing/recovery gate. |
| 4–5 | Repeat-use evidence | Triage feedback daily, run one release-build notification/recovery check across each supported environment, capture candidate screenshots/demo. |
| 6 | Release decision | Review metrics and defects, select the final release build, freeze store copy/screenshots/review notes, and decide whether to widen or hold. |

If the friendly alpha uncovers a P0/P1, repeat Days 1–2 after the fix rather than advancing the
cohort. Shipping a dependable narrow beta is more valuable than maintaining the calendar.

## 8. Metrics and launch gates

These figures are decision aids, not vanity metrics. With a small beta, read individual failures as
carefully as the aggregate.

| Measure | Beta target | Public-launch interpretation |
|---|---:|---|
| Qualified invitees who accept TestFlight | ≥70% | Confirms the audience and invitation are specific enough. |
| TestFlight users who pair unaided or with documented instructions | ≥80% | Below this: improve onboarding before broad promotion. |
| Paired users who send a first real message | ≥80% | Below this: inspect connection and first-value friction. |
| Tested background/restart recoveries with one correct settled reply | 100% of guided tests | Any duplicate/lost reply is a release blocker. |
| Eligible notification tests delivered and opening the intended thread | 100% of guided tests | Privacy, routing, or delivery failures are release blockers. |
| Testers reporting a concrete away-from-desk value moment | ≥5 users | Supply quotes and evidence for public positioning. |

**Do not publicly launch** with an unresolved P0/P1, an unverified release-build pairing path, a
missing privacy/support page, or copy that promises an unproven feature. A low tester count alone
is not a blocker if the cohort is qualified and the core loop is repeatedly proven.

## 9. Immediate next actions

1. Choose the beta support contact and where the private tester tracker lives.
2. Create the screener and send the warm invitation to 10–15 qualified contacts.
3. Confirm TestFlight build 13 is installable and schedule three first-session tests.
4. Run the copy integrity pass before posting any recruitment message.
5. After the first cohort, revise this plan with actual pairing friction, support load, and the
   release capability set.

## 10. Scope boundary

Marketing must amplify proven value; it must not create product commitments. During beta, record
requests for OpenClaw, team workflows, richer cards, dashboards, attachments, and monetisation as
post-launch research. Prioritize only work that makes pairing, reading the answer, understanding
safe progress, recovering a result, or acting on a timely notification more dependable.
