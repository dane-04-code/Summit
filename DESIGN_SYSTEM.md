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
  list/keyboard motion. (One documented exception: the **agent identity mark** — see below.)

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
- **Radii:** user bubble `18` · input `14` · code block `10` · app mark `16`.
- **Screen padding:** `24` horizontal (generous).
- **Hairline:** `1px` in `line`. Use rarely.

---

## Components

### App mark
A small rounded-square mark (light `ink` fill, dark glyph) at the top of the Connect
screen, with the wordmark "Summit" (muted, uppercase, tracked) — basic identity,
not branding theatre.

### Message rows (hybrid layout)
- User: right-aligned bubble, `surface` background, `radius.bubble`, max 80%, `ink` text.
- Agent: full width, no bubble, `ink` body text.
- No name labels, timestamps, or avatars.

### Agent identity mark (documented exception)

Each paired agent may carry one **mark** — a glyph from a fixed set of ten (`AGENT_AVATAR_IDS`)
and an accent from a fixed palette of ten (`agentAccentPalette`) — chosen by the user. Both halves
are optional and independent; an agent with neither renders the neutral default it always had.

This is the only place the app shows more than one accent color, and it is deliberately narrow:

- **Where it appears:** the agent profile hero, the profile's identity picker, and the sidebar
  agent-switcher row. Nowhere else.
- **Where it does not:** the chat transcript. The "no avatars" rule above still holds absolutely —
  message rows never carry a mark, a name, or a color.
- **It never becomes a theme.** The mark tints a glyph, a hairline, and a wash (`accentAlpha`);
  it never fills a surface, a button, or a bubble. `colors.accent` remains the app's single accent
  and is not a pickable value, so an agent mark can never be mistaken for a link or focus ring.
- Glyphs are authored SVG in one stroke language matching `lucide-react-native`, not raster art —
  they scale from 28px to 58px and take the accent color directly.

Rationale: with multiple agents paired, "which agent am I talking to" is a real question the
switcher has to answer at a glance, and name text alone answers it slowly. The mark is identity,
not decoration — which is why it stops at the switcher and the profile.

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
