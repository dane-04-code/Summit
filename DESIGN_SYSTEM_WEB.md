# Design System — Summit Web
*Adapted from [`DESIGN_SYSTEM.md`](../../DESIGN_SYSTEM.md) (mobile) for the web.*

The visual identity is identical. The product is dark, calm, and quiet. Same colors, same type
scale, same spacing — expressed as CSS custom properties and Tailwind config instead of React
Native StyleSheet tokens.

---

## CSS custom properties

Put these on `:root` (or `html[data-theme]` if you later add light mode — the tokens are semantic).

```css
:root {
  /* Color */
  --bg:           #0F1012;  /* App background — near-black, slightly cool */
  --surface:      #1A1B1E;  /* Cards, inputs, nav, code blocks */
  --surface2:     #232428;  /* Hover, pressed, higher elevation */
  --ink:          #F4F4F5;  /* Primary text */
  --muted:        #8B8B92;  /* Secondary text, placeholders, labels */
  --line:         #2A2B2F;  /* Hairlines, borders, dividers */
  --accent:       #5B9DFF;  /* Links, focus rings, key actions */
  --error:        #FF6B6B;  /* Error states */

  /* Typography */
  --font-sans:    -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono:    ui-monospace, "SF Mono", "Fira Code", monospace;

  /* Spacing scale (px) */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-6:  24px;
  --space-8:  32px;
  --space-12: 48px;
  --space-16: 64px;

  /* Radius */
  --radius-sm:  8px;   /* Tags, badges */
  --radius-md:  12px;  /* Buttons, inputs */
  --radius-lg:  16px;  /* Cards */
  --radius-xl:  24px;  /* Large surfaces */

  /* Content width */
  --content-max: 720px;   /* Body copy, docs */
  --wide-max:    1024px;  /* Landing hero, nav */
}
```

---

## Tailwind config (tailwind.config.ts)

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0F1012',
        surface:  '#1A1B1E',
        surface2: '#232428',
        ink:      '#F4F4F5',
        muted:    '#8B8B92',
        line:     '#2A2B2F',
        accent:   '#5B9DFF',
        error:    '#FF6B6B',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', '"Fira Code"', 'monospace'],
      },
      fontSize: {
        'xs':  ['13px', { lineHeight: '16px' }],  /* caption */
        'sm':  ['15px', { lineHeight: '20px' }],  /* small */
        'base':['17px', { lineHeight: '24px' }],  /* body */
        'lg':  ['20px', { lineHeight: '26px' }],  /* h3/section heading */
        'xl':  ['24px', { lineHeight: '30px' }],  /* h2 */
        '2xl': ['28px', { lineHeight: '34px' }],  /* h1/page title */
        '3xl': ['36px', { lineHeight: '42px' }],  /* hero headline */
      },
      spacing: {
        /* Use Tailwind defaults (4px base) — they map cleanly to our 4·8·12·16·24·32 scale */
      },
      borderColor: {
        DEFAULT: '#2A2B2F',
      },
      maxWidth: {
        content: '720px',
        wide:    '1024px',
      },
    },
  },
  plugins: [],
} satisfies Config
```

---

## Typography

System font everywhere. Monospace only in code blocks. Do not import Google Fonts or custom fonts.

| Role | Size | Weight | Line height | Tailwind class |
|------|------|--------|-------------|----------------|
| Hero headline | 36px | 600 | 42px | `text-3xl font-semibold` |
| Page title / H1 | 28px | 600 | 34px | `text-2xl font-semibold` |
| Section heading / H2 | 24px | 600 | 30px | `text-xl font-semibold` |
| Sub-heading / H3 | 20px | 600 | 26px | `text-lg font-semibold` |
| Body | 17px | 400 | 24px | `text-base` |
| Secondary / small | 15px | 400 | 20px | `text-sm` |
| Caption / label | 13px | 400 | 16px | `text-xs` |
| Code | 14px mono | 400 | 20px | `font-mono text-sm` |

---

## Components

### Global body styles
```css
body {
  background-color: var(--bg);
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 17px;
  line-height: 24px;
  -webkit-font-smoothing: antialiased;
}
```

### Nav
Fixed top, full width. `var(--bg)` background with a `1px` bottom border in `var(--line)`.

```html
<nav class="fixed top-0 inset-x-0 border-b border-line bg-bg z-50">
  <div class="max-w-wide mx-auto px-6 h-14 flex items-center justify-between">
    <span class="text-ink font-semibold tracking-tight">Summit</span>
    <div class="flex gap-6 text-sm text-muted">
      <a href="/docs" class="hover:text-ink transition-colors">Docs</a>
      <a href="/login" class="hover:text-ink transition-colors">Log in</a>
    </div>
  </div>
</nav>
```

### Buttons

**Primary** (light, high contrast — same as mobile):
```html
<button class="px-5 py-2.5 rounded-xl bg-ink text-bg text-sm font-medium hover:opacity-90 transition-opacity">
  Join early access
</button>
```

**Secondary** (ghost):
```html
<button class="px-5 py-2.5 rounded-xl border border-line text-ink text-sm font-medium hover:bg-surface transition-colors">
  Read the docs
</button>
```

Do not use `var(--accent)` as a button fill. Accent is for links and focus rings only.

### Links
```css
a {
  color: var(--accent);
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
}
```

### Focus ring
```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}
```

### Code block (docs)
```html
<pre class="bg-surface rounded-xl p-4 overflow-x-auto relative group">
  <code class="font-mono text-sm text-ink">...</code>
  <button class="absolute top-3 right-3 text-xs text-muted opacity-0 group-hover:opacity-100 transition-opacity">
    Copy
  </button>
</pre>
```

### Inline code
```html
<code class="bg-surface px-1.5 py-0.5 rounded font-mono text-sm text-ink">...</code>
```

### Input field (login page)
```html
<input class="w-full bg-surface border border-line rounded-xl px-4 py-3 text-ink placeholder:text-muted
              focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors">
```

### Divider
```html
<hr class="border-0 border-t border-line">
```

---

## Layout

**Content pages (docs, login):** `max-w-content mx-auto px-6` — centered column, generous side padding.

**Wide pages (landing):** `max-w-wide mx-auto px-6` — same padding, wider max-width.

**Section spacing:** `py-16` or `py-24` between sections. Generous. When in doubt, add space.

**No sidebar in v1.** Single-column everything.

---

## Rules

- No gradients, no heavy shadows, no custom animations beyond `transition-colors` / `transition-opacity`.
- Whitespace does the work — use it aggressively.
- The accent (`#5B9DFF`) appears once per view on the element that matters most. Links are fine;
  multiple accent-colored buttons on the same screen is wrong.
- All text must meet WCAG AA contrast on dark: primary ink `#F4F4F5` on `#0F1012` is ~15:1.
  Secondary `#8B8B92` on `#0F1012` is ~4.8:1. Don't go dimmer than muted for body text.
- No emojis in UI copy (documentation code examples are fine).
- Mobile-responsive from day one. `px-6` stays. Use `flex-col` → `flex-row` breakpoints where needed.

---

## What's deferred

- Light mode (tokens are semantic — when ready, add a `[data-theme="light"]` block and swap values)
- Syntax highlighting in code blocks (plain monospace first)
- Animations / transitions beyond hover states
