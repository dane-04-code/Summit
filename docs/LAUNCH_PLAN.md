# Summit — Launch Plan

_The one list. Open this before you open anything else. When you're tempted to start a
second track, look here instead._

_Set 2026-07-04._

---

## What Summit is

**Summit is the messaging platform for agents** — Slack, Discord, and Telegram are for
talking to people; Summit is for talking to your AI agents. You make an account, connect
your agent, and start messaging. Everything lives in a thread.

The test for every decision from here: **does this make Summit a better messaging platform
for agents?** If not, cut it.

## The finish line

A stranger downloads Summit from the App Store, creates an account, connects their agent in
seconds, and has a genuinely good time using it. That's done. Everything below serves that
one sentence.

## How we work now

One track. One thing in flight at a time. A stop isn't finished until **`npx tsc --noEmit`
and `npm test` are both green**. No parallel Claudes, no second terminal. When you wonder
"where am I" — it's the next unchecked box below.

---

## The straight path

Worked top to bottom. **De-risk before we decorate** — prove the whole thing runs on a real
phone before polishing pixels.

- [ ] **0 — Flatten.** One branch, this doc, one track. Parallel work stops here.

- [ ] **1 — Walk the cold path on a real iPhone.** Fresh install → create account → pair
      with a real agent → chat → receive a push, exactly as a stranger would, on real
      hardware. Everything is unit-green, but the full end-to-end has never been walked start
      to finish. Fix whatever this surfaces. *This is where the real surprises live — that's
      why it's first.*

- [ ] **2 — Nail the first thirty seconds.** Account → paired → first message should feel
      inevitable. No tutorial, no scaffolding — just a path so clear a stranger never has to
      think about it.

- [ ] **3 — The smoothness pass.** Transitions, the moments of waiting, and every empty /
      loading / error state a stranger will actually hit. One focused pass, not endless
      fiddling.

- [ ] **4 — Make it store-ready.** App icon, name, screenshots, description, Apple privacy
      labels, and a production build that reliably produces a working binary.

- [ ] **5 — TestFlight → real hands.** Put it in front of a few people who actually run
      agents. Watch them use it. Fix the top 3 things that trip them. This is the only real
      proof the finish line is met.

- [ ] **6 — Submit & launch.**

## Cut for launch

Kept off the track on purpose, so the line stays straight:

- **OpenClaw native integration** — Hermes + the generic OpenAI-compatible connection already
  cover the audience.
- **Any new features.** Nothing that isn't a stop above.
- Dashboards, metrics panels, tab bars, anything heavier than a messaging app.
