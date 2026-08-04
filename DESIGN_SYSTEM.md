# Design System — Summit

**Dark, clean, and quiet.** A dark chat app that feels calm and premium — not stark, not
busy. Lots of breathing room, system font, one restrained accent. The UI recedes so the
conversation is the focus.

> **Not white.** The app is dark by default. (Light mode is a possible later option, but
> dark is the product's look.)

## Rules of thumb

- Whitespace (dark space) does the work. When in doubt, add space, not a line or a box.
- Greyscale on dark for almost everything; the accent appears only on the one thing that
  matters most on a screen.
- System font everywhere. Monospace only inside code blocks (built-in system mono).
- No gradients, no heavy shadows, no custom theming, no animation beyond standard
  list/keyboard motion. (Two documented exceptions: the **agent mark** and the
  **pre-auth welcome screen** — see below.)

---

## Color (dark)

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0F1012` | App background (near-black, slightly cool) |
| `surface` | `#1A1B1E` | Raised: inputs, user bubble, panels |
| `surface2` | `#232428` | Pressed / higher elevation |
| `ink` | `#F4F4F5` | Primary text |
| `muted` | `#8B8B92` | Secondary text, placeholder, idle dot |
| `line` | `#2A2B2F` | Hairlines, borders |
| `accent` | `#5B9DFF` | The one accent — links, focus, key actions |
| `onAccentBtn` | `#0F1012` | Text on a light/primary button |
| `error` | `#FF6B6B` | Error text + error status |

**Primary button** is light (`ink` fill, `bg` text) for a clean high-contrast action;
the `accent` is reserved for links/focus. **Status dot:** idle `muted` · running `accent`
· error `error` (color is the signal, no pulse).

---

## Type

System font for everything. Built-in monospace only inside code blocks.

| Name | Size | Weight | LH | Use |
|---|---|---|---|---|
| `title` | 28 | 600 | 34 | Screen titles |
| `h` | 20 | 600 | 26 | Markdown headings |
| `body` | 17 | 400 | 24 | Messages, default |
| `small` | 15 | 400 | 20 | Secondary |
| `mono` | 14 | 400 | 20 | Code blocks only (system mono) |
| `caption` | 13 | 400 | 16 | Status label, captions |

---

## Spacing & shape

- **Spacing scale:** `4 · 8 · 12 · 16 · 24 · 32`.
- **Radii:** user bubble `18` · input `14` · code block `10` · cron drop card `16`.
- **Screen padding:** `24` horizontal (generous).
- **Hairline:** `1px` in `line`. Use rarely.

---

## Components

### App mark
The Summit mountain — the website's own logo art (`assets/images/summit-peak.png`),
shipped white on transparent and tinted from `colors` at every size. `BrandMark`
(`src/ui/BrandMark.tsx`) is the only place the asset is required; everything else
imports from there. It sits bare on the background, never in a tile or badge: the
art is the identity, and a container around it is chrome the screen hasn't earned.
Paired with the wordmark "Summit" (muted, uppercase, tracked) where a wordmark is
wanted — basic identity, not branding theatre.

The same mark is the app icon, the splash art, and the Android adaptive/monochrome
layers, always white on `bg` — so the icon, the launch frame, and the first screen
are one continuous surface.

### Message rows (hybrid layout)
- User: right-aligned bubble, `surface` background, `radius.bubble`, max 80%, `ink` text.
- Agent: full width, no bubble, `ink` body text.
- No name labels, timestamps, or avatars.

### Agent mark (documented exception)

Each paired agent shows one **mark**: the connected harness's official logo (Hermes, OpenClaw —
`assets/images/harness-*.png`) on a tile tinted with an accent from a fixed palette of ten
(`agentAccentPalette`), chosen by the user. The mark itself identifies the harness and is not
user-chosen; only the tint is. A framework without an official mark yet falls back to a neutral
`Bot` icon. An agent with no accent chosen renders the neutral default it always had.

This is the only place the app shows more than one accent color, and it is deliberately narrow:

- **Where it appears:** the agent profile hero, the profile's accent picker, and the sidebar
  agent-switcher row. Nowhere else.
- **Where it does not:** the chat transcript. The "no avatars" rule above still holds absolutely —
  message rows never carry a mark, a name, or a color.
- **It never becomes a theme.** The accent tints a tile background, a hairline, and a wash
  (`accentAlpha`); it never fills a surface, a button, or a bubble. `colors.accent` remains the
  app's single accent and is not a pickable value, so an agent's accent can never be mistaken for
  a link or focus ring.

Rationale: with multiple agents paired, "which agent am I talking to" is a real question the
switcher has to answer at a glance, and name text alone answers it slowly. The official harness
logo answers "what is this" faster than a name does; the accent answers "which one of several" —
which is why the mark stops at the switcher and the profile.

### Pre-auth welcome screen (documented exception)

The one screen a user sees before they have an agent is a brand surface, not product UI, and it
is deliberately aligned with the marketing site rather than with the chat app. Two rules bend
here and nowhere else:

- **Display face.** `ArchivoExpanded-Bold` (`src/ui/brandFont.ts`) sets the `SUMMIT` wordmark and
  the headline. It is Archivo pinned to the exact axes the website uses (`wght 700`, `wdth 118`),
  instanced to a static TTF so it needs no variable-font support on device. It is scoped to this
  screen: everything from sign-in onward stays on the system font, and the **code-only-mono** rule
  is untouched.
- **One authored motion moment.** `SignalPeak` (`src/ui/SignalPeak.tsx`) draws propagation rings
  leaving the summit of the mark — flattened to `scaleY 0.3` so they read as ground-plane circles
  seen near-edge-on, drawn *beneath* the mark so the mountain occludes their near half. They run
  **two passes and then stop**; this is an arrival, not an ambient loop. It honours Reduce Motion
  (`AccessibilityInfo.isReduceMotionEnabled`) by never starting, and uses RN's built-in `Animated`
  with `useNativeDriver` — Reanimated is not wired into this project's Babel config.

The mark itself (`assets/images/summit-peak.png`) is the website's own logo art, tinted from
`colors` rather than shipped pre-coloured. The accent stays `colors.accent` — the site's amber
lamp colour deliberately does **not** cross over, so the app keeps exactly one accent.

Rationale: this screen has to look like the thing the user just read about. Past sign-in, the
quiet cockpit resumes.

### Code block
`surface` (slightly off-bg) rounded box, radius 10, system mono, optional copy. No border.

### Status
A small dot (idle/running/error color) + a quiet `caption` label. Tool progress appends a
short muted label: `searching the web…`.

### Input bar
Pinned above the keyboard. `surface` rounded field (radius 14) + a circular send button in
`ink` (light) with a dark arrow. Light haptic on send. Placeholder `Message…`.

### Connect screen
App mark + wordmark, `title` heading + one-line muted subtitle, two filled `surface` fields
(host, key), an expandable `Where do I find these?` help (mono on `surface`), one light
primary button. Errors in `error`, plain and specific. Vertically composed (not crammed at
the top).

---

## Quality floor (just do it, don't announce it)

- Text contrast meets WCAG AA on dark (primary ≥4.5:1, secondary ≥3:1).
- Visible focus state in `accent`. Borders/dividers stay visible on dark.
- Respects reduced motion (we have almost none anyway).
- Works down to small phones; input never hidden by the keyboard; safe areas respected.
- Copy is active and specific: "Couldn't reach <host>", "Save changes" — never vague.

## Deferred (not v1)

- Light mode (tokens are semantic, so it's a later swap).
- Syntax highlighting inside code blocks (plain monospace ships first).
