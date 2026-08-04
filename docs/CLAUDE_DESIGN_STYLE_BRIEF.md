# Summit — Style Brief for Claude Design

Paste this at the start of a Claude Design session before asking it to build any Summit screen.
It has no real component code to bind to (Summit is React Native/Expo, not a web component
library), so treat every design produced from this brief as a **style-accurate mockup**, not
shippable code — an engineer still translates it into React Native by hand.

## What this product is

Summit is a dark, clean, quiet mobile chat app for talking to AI coding agents (Hermes/OpenClaw)
from your phone. The UI recedes so the conversation is the focus. Not stark, not busy, not
themed — one restrained accent color, lots of breathing room, system font everywhere.

**Not white.** Dark by default, always. No gradients, no heavy shadows, no custom theming, no
animation beyond standard list/keyboard motion.

## Color tokens (exact hex — use these, not approximations)

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0F1012` | App background |
| `surface` | `#1A1B1E` | Raised: inputs, message bubble, panels, code blocks |
| `surface2` | `#232428` | Pressed / higher elevation |
| `drawer` | `#161719` | Navigation drawer panel |
| `hover` | `#1F2023` | Pressed/active list row (sidebar recents) |
| `raised` | `#1C1D20` | A card lifted just above `surface` |
| `ink` | `#F4F4F5` | Primary text |
| `ink2` | `#C9C9CE` | Secondary ink — quieter than `ink` |
| `muted` | `#8B8B92` | Secondary text, placeholder, idle status dot |
| `faint` | `#5B5B62` | Dimmest legible grey — pills, durations, separators |
| `line` | `#2A2B2F` | Hairlines, borders |
| `lineFocus` | `#3E3F45` | Input border when focused |
| `accent` | `#5B9DFF` | THE one accent — links, focus, key actions only |
| `accentLine` | `#2F3A4A` | Accent-tinted hairline (credential/auth steps) |
| `onAccentBtn` | `#0F1012` | Text on a light/primary button |
| `error` | `#FF6B6B` | Error text + error status |
| `errorSurface` | `#1B1617` | Error-tinted card fill |
| `errorLine` | `#3A2526` | Error-tinted card hairline |
| `success` | `#7BD88F` | Confirmation moments ("Copied", paired) |
| `highlightBg` | `#2C3A55` | Text highlight mark background |
| `scrim` | `#000000` | Overlay behind drawer/modals (partial opacity) |

**Primary button is light** (`ink` fill, `bg` text) — high contrast, calm. `accent` is reserved
for links/focus/the one thing that matters most on a screen, never used broadly.

## Type — system font everywhere, monospace only in code

| Token | Size | Weight | Line height | Use |
|---|---|---|---|---|
| `title` | 28 | 600 | 34 | Screen titles |
| `h` | 20 | 600 | 26 | Markdown headings |
| `body` | 17 | 400 | 24 | Messages, default |
| `small` | 15 | 400 | 20 | Secondary text |
| `mono` | 14 | 400 | 20 | Code blocks only (system mono) |
| `caption` | 13 | 400 | 16 | Status label, captions |

## Spacing, radii, layout

- Spacing scale (px): `4 · 8 · 12 · 16 · 24 · 32`
- Radii: bubble `18` · input `14` · code block `10` · small controls `10` · cron drop card `16`
- Screen padding: `24` horizontal, generous
- Hairlines: `1px` in `line`, used rarely

## Component patterns

- **Message rows (hybrid):** user messages are right-aligned bubbles, `surface` fill, bubble
  radius, max 80% width, `ink` text. Agent messages are full-width, no bubble, `ink` body text.
  No avatars, no name labels, no timestamps.
- **Code block:** `surface`/`codeBlockBg` rounded box, radius 10, system mono, optional copy
  affordance, no border. Syntax colors when relevant: strings/dates `mdString`/`mdDate`
  (green/amber), functions `codeFunc` (violet), built-ins `codeBuiltin` (cyan).
- **Status:** small dot in `muted` (idle) / `accent` (running) / `error` (error) + a quiet
  `caption` label. Color is the signal — no pulsing/animation. Tool progress appends a short
  muted label like "searching the web…".
- **Input bar:** pinned above keyboard, `surface` rounded field (radius 14) + circular send
  button in `ink` (light fill) with a dark (`onAccentBtn`) arrow glyph.
- **Connect screen:** app mark (the Summit mountain, `ink`-tinted, bare on `bg`) + uppercase tracked
  "Summit" wordmark, `title` heading, one-line `muted` subtitle, two `surface` filled fields,
  an expandable mono-on-surface help disclosure, one light primary button. Errors in `error`,
  plain and specific. Vertically composed, not crammed at the top.

## Rules of thumb

- Whitespace (dark space) does the work — when in doubt, add space, not a line or a box.
- Greyscale on dark for almost everything; `accent` appears on one thing per screen, max.
- Never invent a new accent color, gradient, or shadow style.
- Contrast: primary text ≥4.5:1, secondary text ≥3:1 against `bg`/`surface`.
