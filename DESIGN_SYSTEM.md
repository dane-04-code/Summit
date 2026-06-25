# Design System — Agent Messenger

**Goal: invisible.** A clean, simple chat. White, near-black text, lots of whitespace,
one accent color used sparingly. The app disappears; the conversation is all you see.
Think Apple Notes / Things — nothing decorative, nothing to notice.

## Rules of thumb

- Whitespace does the design work. When in doubt, add space, not a line or a box.
- One accent color, and only on things you tap (send, links, focus). Everything else is
  greyscale.
- System font everywhere. Monospace only *inside* code blocks (built-in system mono — we
  bundle nothing).
- No gradients, no shadows beyond a hairline, no custom theming, no animation beyond the
  standard list/keyboard motion.

---

## Color

| Token | Hex | Use |
|---|---|---|
| `bg` | `#FFFFFF` | Background |
| `ink` | `#111114` | Primary text |
| `muted` | `#8A8A8E` | Secondary text, placeholder, idle dot |
| `bubble` | `#F2F2F7` | User message bubble (barely there) |
| `code-bg` | `#F6F6F6` | Code block background |
| `line` | `#E5E5E7` | Hairlines, input border |
| `accent` | `#0A7AFF` | Send, links, focus — the only color |
| `error` | `#E5484D` | Error text + error status (kept colored: it's functional) |

**Status dot** (one small dot): idle `muted` · running `accent` · error `error`. No pulse —
the color is the signal.

---

## Type

System font for everything. Built-in monospace only inside code blocks.

| Name | Size | Weight | LH | Use |
|---|---|---|---|---|
| `title` | 28 | 600 | 34 | Connect screen title |
| `h` | 20 | 600 | 26 | Markdown headings |
| `body` | 17 | 400 | 24 | Messages, default |
| `small` | 15 | 400 | 20 | Secondary |
| `mono` | 14 | 400 | 20 | Code blocks only (system mono) |
| `caption` | 13 | 400 | 16 | Status label, captions |

---

## Spacing & shape

- **Spacing scale:** `4 · 8 · 12 · 16 · 24 · 32`.
- **Radii:** user bubble `18` · code block `10` · input field `12`.
- **Screen padding:** `16` horizontal.
- **Hairline:** `1px` in `line`. Use rarely.

---

## Components

### Message rows (hybrid layout)
```
                    │ show me a table │    user: bubble, right, max 80%
                                              (#F2F2F7, radius 18)

  Here's the data:                          agent: full width, plain text
  Qty   Item
  3     Pen
```
No name labels, no timestamps, no avatars. Just the messages.

### Code block
Light `code-bg` rounded box (radius 10, padding 12), system mono text, optional copy
control. No border — the faint fill is enough.

### Status
A small dot (idle/running/error color) + a quiet `caption` label. That's the whole status
UI. Tool progress appends a short label: `searching the web…`.

### Input bar
Pinned above the keyboard. Rounded field (radius 12, `line` border) with a send arrow in
`accent`. Light haptic on send. Placeholder `Message…`.

### Connect screen
`title` heading, two fields (host, key), an expandable `Where do I find these?` help (on a
faint `bubble` panel), one `accent` button. Errors in `error`, plain and specific.

---

## Quality floor (just do it, don't announce it)

- Contrast meets WCAG AA. Visible focus state in `accent`.
- Respects reduced motion (we have almost none anyway).
- Works down to small phones; input never hidden by the keyboard.
- Copy is active and specific: "Couldn't reach <host>", "Save changes" — never vague.

## Deferred (not v1)

- Dark mode (tokens are semantic, so it's a later swap).
- Syntax highlighting inside code blocks (plain monospace ships first).
