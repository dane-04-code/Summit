# Agent identity: avatar + accent color

**Status: BUILT 2026-08-02.** Phases 2 and 3 shipped as written. Phase 1 was **not** run —
Higgsfield was still at 0 credits, and rather than wait, Dane chose (2026-08-02) to replace the ten
raster pixel-art sprites with **ten code-drawn SVG glyphs**. See "What shipped" below for how that
changes the plan; the rest of this document is kept as the original brief.

## What shipped (deviation from Phase 1)

- **No image assets exist and none are needed.** `assets/images/agentAvatars/` was never created.
  The marks are authored SVG in `src/ui/agentIdentity/avatars.tsx`, drawn in the same 24-unit
  viewBox / round-cap / single-stroke-weight language as `lucide-react-native` so they sit natively
  beside the app's existing icons.
- **Ids are words, not `worker-NN`.** `AGENT_AVATAR_IDS` = ridge · orbit · stack · spark · dusk ·
  hex · prism · pulse · peak · relay. These strings are a **storage contract** (they're persisted in
  SQLite) — appending is safe, renaming silently drops existing users' marks.
- **The accent tints the glyph itself**, so avatar and color read as one identity rather than two
  settings. That also made the plan's separate 7×7 sidebar color dot redundant, so it was dropped —
  the tinted mark says the same thing once instead of twice.
- **`gold` was retuned** `#D9C36A` → `#D8CC63`: it was the closest pair to `amber` in the set
  (RGB distance 38 → 50) while also gaining contrast. All ten clear 4.5:1 against `bg`, `drawer`,
  `surface`, and `surface2` (worst case `rose` on `surface2`, 5.70:1) — measured, not eyeballed.
- **`azure` replaced the plan's `sky`.** The plan flagged the risk of a token too close to
  `colors.accent`; `#7FB2FF` is a deliberately lifted cousin, and a test asserts the palette never
  contains `colors.accent`, `colors.error`, or `colors.success`.
- **A schema migration was required and added.** The plan assumed adding columns to `SCHEMA` was
  enough, but `CREATE TABLE IF NOT EXISTS` is a no-op on a device that already paired — those
  installs would have kept the old column set and thrown on the first read. `AGENT_COLUMN_MIGRATIONS`
  + `SqliteRepository.migrateAgentColumns()` add whatever is missing, driven off `PRAGMA table_info`.
- **Clearing a pick is a second tap** on the chosen cell — no Reset control and no caption
  explaining it, per the app's no-scaffolding rule.

Still worth doing on a real device: confirm the picker grid holds five columns per row on the
smallest supported screen, and that the 28px sidebar marks are legible in hand (both verified only
by measurement and test so far — see the iOS build freeze noted in `docs/PROJECT_STATUS.md`).

**Scope, confirmed with Dane (2026-08-02):** identity-only. A small avatar + accent-color mark in
the agent profile screen and the sidebar agent switcher. **Not** a chat/message re-theme — the
message list, bubbles, and app-wide `colors.accent` stay untouched. This is a documented, narrow
exception to `DESIGN_SYSTEM.md`'s "no custom theming" / "no avatars" rules — see Phase 3.

---

## Phase 1 — Generate the 10 avatar images

**Model:** `nano_banana_pro` (Google, via the `mcp__claude_ai_higgsfield__generate_image` tool).
1:1 aspect, `1k` resolution. Confirmed cost: **2 credits/image, 20 credits for the set of 10**.
Use `get_cost:true` first if you want to reconfirm before spending.

**Style brief:** 16-bit pixel art, retro video-game sprite portraits, shoulders-up crop, square
composition, flat solid background (single flat color per image, no scene/environment), no text,
no logos, no brand marks — these must be original art, not Hermes/OpenClaw imagery. Keep a
consistent art style across all 10 (same pixel density, same rendering approach) so they read as
one matched set when shown side by side in a picker grid. Vary: hair, skin tone, outfit/role
accessory (hard hat, headset, apron, hoodie, etc.), color scheme per portrait — the goal is 10
visually distinct "workers," not 10 palette-swaps of the same figure.

**Prompt template** (adjust the bracketed part per image, keep the rest fixed for consistency):

```
16-bit pixel art avatar portrait of [a worker with distinct hair/outfit/accessory description],
retro video game sprite style, square icon crop, shoulders-up, limited retro color palette,
flat solid background, no text, no logos
```

**Output handling:**
- Save the 10 results as PNG to `assets/images/agentAvatars/`, named `worker-01.png` through
  `worker-10.png` (matches the `avatarId` values Phase 2 expects — see below).
- Keep file size reasonable (these render at small thumbnail sizes in the UI — no need to keep 4k).

If Higgsfield still has 0 credits when this phase runs, stop and tell Dane rather than
guessing at a substitute — don't downgrade silently to a different model/style without checking.

---

## Phase 2 — Wire the assets into the app

This is the part of the original plan (`2026-08-02` architect session) that doesn't depend on the
images existing yet — the code can be written against placeholder/fallback state and will pick up
real files once Phase 1 lands them in `assets/images/agentAvatars/`.

### Data model
- `src/db/schema.ts` — add nullable columns to `agents`:
  ```sql
  avatar_id    TEXT,
  accent_color TEXT,
  ```
- `src/agents/types.ts` — add to `Agent` and `NewAgentInput`:
  ```ts
  avatarId?: string | null;    // one of 'worker-01' .. 'worker-10'
  accentColor?: string | null; // one of the agentAccentPalette keys, see below
  ```
- `src/agents/registry.ts` — `buildAgent` defaults both to `null`. No other logic changes; keep
  this file pure per its existing header comment.
- Wherever agents are read/written from SQLite (the repo layer near `src/db/sqlite.ts`) — thread
  the two new columns through the existing row ↔ `Agent` mapping.

### Theme tokens
- `src/theme.ts` — add a named, fixed palette (do not let components use raw hex):
  ```ts
  export const agentAccentPalette = {
    coral: '#FF8A65',
    amber: '#E0A37E',
    gold:  '#D9C36A',
    lime:  '#9CCB6E',
    teal:  '#6FC8D6',
    sky:   '#5B9DFF',   // note: same family as colors.accent but a distinct token —
                        // do not reuse colors.accent itself for an agent pick
    violet:'#C9A6F0',
    pink:  '#E890C4',
    slate: '#8B93A8',
    rose:  '#E67E8A',
  } as const;
  ```
  (Exact hex values are a starting point — sanity-check contrast against `colors.bg`/`colors.drawer`
  at small-dot size before finalizing; they just need to be visually distinct from each other and
  from `colors.error`/`colors.success` which already carry meaning.)
- Add an avatar asset map, e.g. in `src/theme.ts` or a new `src/ui/agentProfile/avatars.ts`:
  ```ts
  export const agentAvatars: Record<string, ReturnType<typeof require>> = {
    'worker-01': require('../../assets/images/agentAvatars/worker-01.png'),
    // … worker-02 through worker-10
  };
  ```

### Agent profile screen (`src/app/(app)/agent-profile.tsx`, `src/ui/agentProfile/profile.ts`)
- Replace the hero's static `Bot` icon box with: the chosen `agentAvatars[avatarId]` image if set,
  else the current `Bot` icon fallback (unset stays unset — no forced default).
- Add a picker: a 10-cell grid of avatar thumbnails + a 10-swatch color row, editable from the
  profile screen. On pick, persist via the same repo path used for renames/other agent field
  updates today (check how `AgentProvider` currently persists agent edits — likely already has an
  update path from settings; reuse it, don't invent a parallel write path).
- If `accentColor` is set, ring the avatar box in that color (thin border, not a fill — keep it a
  mark, not a re-skin).

### Sidebar (`src/ui/chat/Sidebar.tsx`)
- `AgentOption` type gains `avatarId?: string | null` and `accentColor?: string | null`.
- `AgentRow` renders the avatar thumbnail (small, ~28px) to the left of the name/framework text,
  falling back to today's blank space if unset. Add a small color dot (reuse the sizing pattern
  from `styles.rowDot` — 7×7, `radius: 4`) next to it if `accentColor` is set.
- Trace where `Agent[]` becomes `AgentOption[]` (likely `src/app/(app)/index.tsx`) and pass the two
  new fields through — don't let them get dropped in that mapping.

### `DESIGN_SYSTEM.md`
Add a short, explicit carve-out near the "No gradients, no heavy shadows, no custom theming" rule
and the message-row "No name labels, timestamps, or avatars" line, something like:

> **Exception — agent identity mark:** each paired agent may carry one avatar (from a fixed matched
> set) and one accent color (from a fixed palette), shown only in the agent profile screen and the
> sidebar agent switcher row. This does not extend to the chat transcript, bubbles, or the app's
> single `accent` token — those rules still hold everywhere else.

---

## Done means
- An agent can have an avatar + color picked from the profile screen; the pick survives app restart
  (persisted in SQLite).
- The sidebar switcher (`AgentRow`) visually distinguishes agents that have picks, and degrades
  cleanly (no crash, no broken image) for agents that don't.
- No changes touch message/bubble rendering — diff should show zero edits to the chat transcript
  components.
- `DESIGN_SYSTEM.md` carries the documented exception so this doesn't read as an unexplained rule
  violation to a future reader.

## Test coverage to add
- Registry/schema round-trip: save `avatarId`/`accentColor`, reload from SQLite, values persist.
- `Sidebar` `AgentRow` render test: 0/1/2+ agents, mixed picked/unpicked, no crash on missing asset
  key.
- Manual: pair two agents, assign different avatars/colors, confirm switcher and profile both
  reflect the pick per `docs/TESTING.md`'s general loop.
