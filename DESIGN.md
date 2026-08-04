---
name: Summit
description: The mobile cockpit for your self-hosted AI agent.
colors:
  bg: "#0F1012"
  surface: "#1A1B1E"
  surface2: "#232428"
  drawer: "#161719"
  hover: "#1F2023"
  ink: "#F4F4F5"
  ink2: "#C9C9CE"
  muted: "#8B8B92"
  faint: "#5B5B62"
  bubble: "#1A1B1E"
  codeBg: "#1A1B1E"
  codeBlockBg: "#141519"
  line: "#2A2B2F"
  lineFocus: "#3E3F45"
  raised: "#1C1D20"
  accent: "#5B9DFF"
  accentLine: "#2F3A4A"
  onAccentBtn: "#0F1012"
  error: "#FF6B6B"
  errorSurface: "#1B1617"
  errorLine: "#3A2526"
  success: "#7BD88F"
  scrim: "#000000"
  fileGlyph: "#202127"
  frontmatterBg: "#15161A"
  mdString: "#7BD88F"
  mdDate: "#E0A37E"
  codeFunc: "#C9A6F0"
  codeBuiltin: "#6FC8D6"
  highlightBg: "#2C3A55"
typography:
  title:
    fontFamily: "System"
    fontSize: 28
    fontWeight: 600
    lineHeight: 34
  h:
    fontFamily: "System"
    fontSize: 20
    fontWeight: 600
    lineHeight: 26
  body:
    fontFamily: "System"
    fontSize: 17
    fontWeight: 400
    lineHeight: 24
  small:
    fontFamily: "System"
    fontSize: 15
    fontWeight: 400
    lineHeight: 20
  mono:
    fontFamily: "System Mono"
    fontSize: 14
    fontWeight: 400
    lineHeight: 20
  caption:
    fontFamily: "System"
    fontSize: 13
    fontWeight: 400
    lineHeight: 16
rounded:
  control: "10px"
  code: "10px"
  input: "14px"
  appMark: "16px"
  bubble: "18px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.control}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
  bubble-user:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.bubble}"
  code-block:
    backgroundColor: "{colors.codeBlockBg}"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.code}"
---

# Design System: Summit

## Overview

**Creative North Star: "The Quiet Cockpit"**

Summit is dark, instrument-panel calm — near-black surfaces, one restrained signal color, and
nothing decorative. The interface behaves like a cockpit readout, not a storefront: it exists to
let you read status and act on it fast, then get out of the way. Every screen defaults to
greyscale; color is spent only on the single thing that matters most (a link, a focus ring, the
one primary action), never as texture.

The system carries almost no visual flourish on purpose — no gradients, no heavy shadows, no
custom theming, no animation beyond standard list/keyboard motion. Whitespace (rendered as dark
space, not white space) is the primary design material: when a screen feels crowded, the fix is
more room, never a rule or a box. This is confirmed anti-reference: it explicitly rejects
glassmorphism, card-stack dashboards, and any chrome that competes with the conversation or
output for attention.

**Key Characteristics:**
- Dark-by-default, near-black base (`#0F1012`), never stark white
- One accent color (`#5B9DFF`) used sparingly — links, focus, and the single most important
  action per screen
- Flat, tonal-layer depth (bg → surface → surface2) instead of shadows
- System font everywhere; monospace confined strictly to code blocks
- Full-bleed, chrome-light layout: no name labels, timestamps, or avatars in chat

## Colors

Near-black greyscale carries almost the entire interface; one blue accent is the only saturated
color, and it is rationed deliberately.

### Primary
- **Signal Blue** (`#5B9DFF`, `colors.accent`): The one accent — links, focus rings, and key
  interactive affordances. Not used for decoration or emphasis outside those roles.
- **Paper White** (`#F4F4F5`, `colors.ink`): Primary text, and — inverted — the fill for the
  primary button (`onAccentBtn` `#0F1012` as its text), giving the app's one high-contrast action
  without spending the accent color on it.

### Neutral
- **Near-Black** (`#0F1012`, `colors.bg`): App background. Slightly cool, never true black.
- **Raised Charcoal** (`#1A1B1E`, `colors.surface`): Inputs, the user message bubble, panels,
  code fill.
- **Pressed Charcoal** (`#232428`, `colors.surface2`): Pressed state / one step higher elevation
  than `surface`.
- **Drawer Charcoal** (`#161719`, `colors.drawer`): Navigation drawer panel — sits between `bg`
  and `surface`.
- **Hover Row** (`#1F2023`, `colors.hover`): Pressed/active row background in lists (sidebar
  recents).
- **Lifted Card** (`#1C1D20`, `colors.raised`): A card lifted just above `surface` (e.g. the cron
  "drop" artifact).
- **Quiet Ink** (`#C9C9CE`, `colors.ink2`): Secondary text — quieter than primary `ink` (mono
  call text, completed nodes).
- **Faint Grey** (`#5B5B62`, `colors.faint`): The dimmest legible grey — cron pills, durations,
  glyphs, separators.
- **Hairline** (`#2A2B2F`, `colors.line`): Borders and dividers. Used rarely, 1px.
- **Focused Hairline** (`#3E3F45`, `colors.lineFocus`): Input border on focus — a gentle lift,
  still grey, not the accent.

### Semantic
- **Error Red** (`#FF6B6B`, `colors.error`): Error text and error status dot.
- **Error Fill** (`#1B1617`, `colors.errorSurface`) / **Error Hairline** (`#3A2526`,
  `colors.errorLine`): Error-tinted card fill and border (a failed run).
- **Success Green** (`#7BD88F`, `colors.success`): Confirmation moments ("Copied", paired) —
  same green family as markdown string syntax color.

### Code & Document Syntax
- **Code Block Fill** (`#141519`, `colors.codeBlockBg`): A touch below `surface`.
- **Front-matter Card** (`#15161A`, `colors.frontmatterBg`): YAML front-matter card fill in the
  doc reader.
- **String Green** (`#7BD88F`, `colors.mdString`), **Number Amber** (`#E0A37E`, `colors.mdDate`),
  **Function Violet** (`#C9A6F0`, `colors.codeFunc`), **Built-in Cyan** (`#6FC8D6`,
  `colors.codeBuiltin`): Syntax roles inside code blocks and front-matter cards.
- **Highlight Wash** (`#2C3A55`, `colors.highlightBg`): `==highlight==` mark background,
  accent-tinted.

### Named Rules
**The One Accent Rule.** `accent` appears only on links, focus, and the single primary
interactive affordance on a screen. It is never used for decoration, and the primary button uses
inverted `ink`/`bg`, not `accent`, precisely so the accent stays rare enough to mean something.

**The Dark-Space Rule.** Whitespace is rendered as dark space, not white space. When a screen
feels crowded or unclear, add space — never a line, box, or shadow.

## Typography

**Body Font:** System (San Francisco on iOS)
**Label/Mono Font:** Built-in system monospace, confined to code blocks

**Character:** A single system-font voice throughout, no display or brand typeface — quiet and
functional, so typography never competes with the conversation content it's rendering.

### Hierarchy
- **Title** (600, 28px, 34 line-height, `typography.title`): Screen titles.
- **Heading** (600, 20px, 26 line-height, `typography.h`): Markdown headings inside rendered
  agent output.
- **Body** (400, 17px, 24 line-height, `typography.body`): Messages and default UI text.
- **Small** (400, 15px, 20 line-height, `typography.small`): Secondary text.
- **Mono** (400, 14px, 20 line-height, `typography.mono`): Code blocks only, system monospace.
- **Caption** (400, 13px, 16 line-height, `typography.caption`): Status labels and captions.

### Named Rules
**The Code-Only-Mono Rule.** Monospace is scoped strictly to code blocks. Everywhere else in the
app — including numbers, IDs, and technical text — uses the system body font.

## Layout

Full-bleed, single-column layout with generous, consistent screen padding (`24px`,
`screenPadding`) rather than a multi-column grid — this is a chat-first mobile app, not a
dashboard. The spacing rhythm runs on a six-step scale (`4 · 8 · 12 · 16 · 24 · 32`,
`space.xs` through `space.xxl`); components pick a step from this scale rather than arbitrary
values. Density stays low: the chat surface prioritizes reading room over packing in more per
screen.

## Elevation & Depth

Flat and quiet. Summit uses no shadows anywhere in the codebase — depth is conveyed entirely
through tonal layering across three greyscale steps (`bg` → `surface` → `surface2`, with
`drawer`, `raised`, and `hover` as situational in-between steps). A component reads as "above"
another purely by being one tone lighter, never by a cast shadow or blur.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest and stay flat under interaction. A
pressed or active state shifts tone (e.g. `surface` → `surface2`, or `hover`), never adds a
shadow.

## Shapes

Soft, moderate corner radii scaled to the size of the element rather than one global radius:
small controls and code fill use `10px` (`radius.control` / `radius.code`), inputs use `14px`
(`radius.input`), the cron drop card uses `16px` (`radius.appMark`), and the user message bubble — the
largest and most prominent rounded shape on screen — uses `18px` (`radius.bubble`). No sharp
corners; fully rounded chrome is confined to the composer tray's own controls, where every
control is a `36px` circle or a pill of the same height. Borders are limited to rare
1px hairlines (`colors.line`); most separation comes from tonal contrast, not a drawn edge.

## Components

Buttons, fields, and cards are flat, quiet, and use tonal contrast rather than shape or shadow to
signal hierarchy — nothing in the system reaches for visual weight it hasn't earned.

### Buttons
- **Shape:** `10px` radius (`radius.control`).
- **Primary:** Inverted fill — `ink` background, `bg` text (`onAccentBtn`) — for a clean
  high-contrast action. The accent color is deliberately *not* used here; it stays reserved for
  links and focus.
- **Pressed:** Tonal shift only (no shadow, no scale/lift animation beyond standard system
  feedback); a light haptic accompanies the composer's send action specifically.

### Cards / Containers
- **Corner Style:** `10px`–`18px` depending on element size (see Shapes).
- **Background:** One step lighter than its parent surface (`surface` on `bg`, `surface2` on
  `surface`, or the situational `raised` / `errorSurface` variants).
- **Shadow Strategy:** None — see Elevation & Depth. Depth is tonal only.
- **Border:** Rare 1px hairline in `line` (or `errorLine` / `accentLine` for tinted contexts),
  used sparingly, never as the primary separator.

### Inputs / Fields
- **Style:** `surface` fill, `14px` radius (`radius.input`), no visible border at rest.
- **Focus:** Border shifts to `lineFocus` — a gentle grey lift, not the accent color, keeping the
  accent rationed for links/focus-ring contexts elsewhere.
- **Error:** `errorSurface` fill with `errorLine` border where a field-level error state applies.

### Message Rows (signature layout)
Chat uses a deliberately asymmetric hybrid layout rather than the two-bubble pattern most chat
UIs default to:
- **User:** Right-aligned bubble, `surface` background, `18px` radius (`radius.bubble`), max 80%
  width, `ink` text.
- **Agent:** Full width, no bubble at all — plain `ink` body text, so long-form agent output
  (markdown, code, tables) reads like a document rather than being boxed into chat-bubble width.
- No name labels, timestamps, or avatars on either side — the identity of the speaker is implied
  by alignment/bubble alone.

### Code Block
`codeBlockBg` (a touch below `surface`) fill, `10px` radius, system mono type, optional copy
affordance. No border — separation comes from the tonal step down from the surrounding surface.

### Status Indicator
A small dot in `muted` (idle), `accent` (running), or `error` (error state), paired with a quiet
`caption`-weight label. Color alone carries the state signal — no pulse or motion. Tool progress
appends a short muted sub-label (e.g. "searching the web…") rather than a separate progress
component.

### Composer Tray (signature component)
Pinned above the keyboard, two rows inside one `surface` shell at `24px` radius with a 1px `line`
hairline that lifts to `lineFocus` on focus. The draft field owns the full width of the top row
(body type, one line at rest, growing to five before it scrolls); a control row sits beneath it —
commands and the model pill on the left, dictation and send on the right, all `36px` and spaced
`8px`.

The tray reads as depth without a shadow by running three tonal steps in both directions from the
shell: the commands, model, and dictation controls are **wells** filled `bg` (recessed below the
page), while send sits **above** the shell in `surface2` so the tray keeps an anchor at rest. A
well lifts to `hover` while pressed or live; send is the one control that goes fully lit —
inverted `ink` fill with a dark glyph — and only once there is a draft to send or a run to stop.

The shell's `24px` radius less its `6px` padding lands exactly on the `18px` radius of the
controls inside, so the tray's corners stay concentric with them. Light haptic feedback on send.
Placeholder copy stays low-key ("Message your agent").

The tray pays the home-indicator inset only while the keyboard is down — once it is up, the
keyboard-avoiding view has already cleared the safe area and the tray sits `12px` above the keys.

### App Mark
The Summit mountain — the website's own logo art, shipped white on transparent and tinted from
`colors` at every size, so one file serves every surface. `BrandMark` (`src/ui/BrandMark.tsx`) is
the single source of the mark; nothing else requires the asset directly. It sits bare on the
background at the head of the auth screens (`76pt` wide), never inside a tile or badge — the art
is the identity, and a container around it is chrome the screen hasn't earned. Paired with the
"Summit" wordmark (muted, uppercase, tracked) where a wordmark is wanted.

The same mark is the app icon, the splash art, and the Android adaptive/monochrome layers — always
white on `bg` (`#0F1012`), so icon, launch frame, and first screen read as one continuous surface
rather than three different brands.

## Do's and Don'ts

### Do:
- **Do** spend the accent color (`#5B9DFF`) only on links, focus states, and the one most
  important interactive element per screen.
- **Do** signal elevation with a tonal step (`bg` → `surface` → `surface2` → `raised`), never a
  shadow.
- **Do** keep monospace strictly inside code blocks; body text always uses the system font.
- **Do** add space rather than a line, box, or shadow when a layout feels crowded or unclear.
- **Do** write copy that is active and specific ("Couldn't reach `<host>`", "Save changes") —
  never vague placeholder language.

### Don't:
- **Don't** use gradients, heavy shadows, glassmorphism, or custom theming anywhere in the app.
- **Don't** add animation beyond standard list/keyboard motion — the app has almost none on
  purpose.
- **Don't** add name labels, timestamps, or avatars to chat message rows.
- **Don't** use the primary accent color for the primary button fill — the primary button is
  inverted `ink`/`bg`; the accent stays reserved for links and focus.
- **Don't** introduce a second accent color or a multi-color palette; the system is greyscale
  plus exactly one signal color (with narrowly-scoped semantic error/success colors and
  code-syntax colors as the only exceptions).
