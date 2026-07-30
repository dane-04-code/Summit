---
name: summit-notion-writer
description: Operate and organize Summit's business workspace in Dane’s Space on Notion. Use when creating, updating, reviewing, or structuring Summit plans, product evidence, roadmap, launch work, operations, research, metrics, decisions, or business records in Notion.
---

# Summit Notion Writer

Maintain Summit as a clear, accurate business area within Dane’s Space. Treat the Notion workspace as a durable operating system, not a dumping ground.

## Workspace anchors

- Workspace: **Dane’s Space**.
- Parent dashboard: [⚡ Dashboard](https://app.notion.com/p/3854dfeca1ef81099555e798c80415dc).
- Summit home: find the child page titled **Summit — Command Centre** (icon: 🍎) under the dashboard. If it is missing, create it there before adding material.
- Keep Summit content inside the Summit home or its children unless the user explicitly requests a cross-business change.

## Safe operating workflow

1. Fetch the target page or database before acting. For updates, fetch it again immediately before the write.
2. Preserve all unrelated content, properties, children, and recent collaborator edits.
3. Use Notion-flavored Markdown. Use page mentions and child pages for navigation; do not paste raw URLs when a useful page mention is available.
4. State what is known, sourced, and verified. Label assumptions, proposals, and unknowns. Never convert an idea, roadmap item, or unproven capability into a fact.
5. Make the smallest coherent change. Create a new page rather than forcing unrelated material into an existing one.
6. Fetch newly created or materially updated pages to verify the result, then report their links.

## Page design standard

- Start pages with a one-sentence purpose or status line, then use a small number of clear sections.
- Use emoji sparingly and consistently: 🍎 home, 🧭 strategy, 🗺️ roadmap, 🚀 launch, 📊 metrics, 🧪 research, 🛠️ operations, 📚 knowledge, 📝 decisions.
- Prefer a concise overview plus linked detail pages. Keep headings scannable and prose short.
- Use tables only for comparisons, owners/statuses, or compact registers. Use pages for narrative and durable knowledge.
- Put action items in a task database only when dates, ownership, or repeated filtering are useful; otherwise use a short checklist on the relevant page.
- Avoid duplicate sources of truth. Link to the canonical page and record a last-updated date where freshness matters.

## Summit information architecture

Maintain these child pages under Summit home. Create only the pages the user needs now; the standard home may link to the full set.

| Page | Purpose |
| --- | --- |
| 🧭 Strategy & Positioning | Vision, target user, problem, positioning, principles, strategic bets, and risks. |
| 🗺️ Product & Roadmap | Now/next/later priorities, validated needs, scope boundaries, and release decisions. |
| 🚀 Launch & Growth | Launch plan, channels, campaigns, tester recruitment, messaging, and outcomes. |
| 📊 Metrics & Reviews | North-star metric, activation/retention/quality metrics, targets, review notes, and metric definitions. |
| 🧪 Research & Feedback | Interview notes, tester feedback, evidence, insights, and follow-up decisions. |
| 🛠️ Operations | Runbooks, release checklist, support process, suppliers/tools, and recurring operating cadence. |
| 📚 Product & Technical Knowledge | Architecture, integrations, privacy/security decisions, setup, and canonical technical references. |
| 📝 Decisions & Meeting Notes | Dated decisions with context, owner, decision, rationale, and review date. |

## Current-product truth guardrails

Use the repository evidence before recording product claims. Present Summit as a mobile operator cockpit for a self-hosted agent, not a generic chat client. Current proven areas include account onboarding, relay pairing, persisted sessions and chat, streamed chat, markdown, activity/status, settings, notification plumbing, and a Hermes-first native-plugin alpha under real-device validation.

Do not claim without proof: OpenClaw live-chat parity, end-to-end encryption, uploads, arbitrary plugin UI, chain-of-thought or raw tool output, native Hermes approval cards, or cron management. Mark the Hermes plugin's real-device flow and proactive cron delivery as validation work until evidence says otherwise.

When publishing claims, read the current evidence sources first, especially `AGENTS.md`, `docs/GO_TO_MARKET_PLAN.md`, `docs/PUBLISHING_COPY.md`, and relevant test or release evidence.

## Common operations

### Record an update

Add the update to the most specific existing page. Include date, source or evidence, outcome, and a next action only when it is real. Update the dashboard summary only when the change affects the overall picture.

### Create a business breakdown

Start with the Summit home and the eight-page structure above. Add databases only for recurring records:

- **Tasks**: title, status, owner, priority, due date, linked area/project.
- **Experiments**: hypothesis, audience, method, metric, result, decision.
- **Feedback**: source, date, persona, insight, severity, linked decision.
- **Decision log**: date, decision, owner, rationale, evidence, review date.

Fetch any existing database first and reuse it when its schema fits. Never create a second database just because a page already has a related list.

### Update the Dashboard

Keep the Summit row in the Dashboard Areas table linked to Summit home. Do not change other areas or dashboard sections unless explicitly asked.

## Completion standard

Leave pages readable on mobile, accurately labeled, and easy to navigate from Summit home and the Dashboard. Return a concise list of what changed, what remains unknown, and direct links to the pages created or updated.
