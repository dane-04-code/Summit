# Website PRD — Summit
**Version 0.1 | June 2026**

Companion document to the [mobile app PRD](../../PRD.md). This covers the web presence only —
a lightweight site that exists to explain the product, provide documentation, and host user accounts.
The mobile app is the product; the website serves it.

---

## What the website is

A small, static-first site. Three pages in v1, one page coming later.

| Page | Path | Purpose |
|------|------|---------|
| Landing | `/` | Explain what Summit is and why it exists. Invite early access. |
| Docs | `/docs` | Help users set up Hermes and connect the app. |
| Login | `/login` | Sign in / sign up (Supabase Auth). Required for relay pairing. |
| *(future)* Web chat | `/chat` | Full conversation view in the browser. **Not v1.** |

The site is not a SaaS dashboard, not a marketing funnel, not a blog. It is a product explanation
page + documentation + the auth surface for the relay account. Keep it small.

---

## Audience

Technical self-hosters — the same people as the mobile app (see mobile PRD §3). They arrived from
r/openclaw or the Hermes Discord. They read documentation willingly. They do not need hand-holding,
they need clarity.

Do not write for mainstream consumers. Do not add explainer videos, feature carousels, or
"how it works in 3 steps" marketing scaffolding. This audience will bounce from that immediately.

---

## Page 1: Landing (`/`)

### What it needs to do
Someone lands here from Discord or Reddit. In 10 seconds they should understand:
- What Summit is
- Whether it's for them
- How to get it / join the waitlist

### Content outline

**Nav** (minimal, fixed top)
- Wordmark left: `Summit`
- Links right: `Docs` · `Log in`
- No hamburger menu, no mega-menu

**Hero section**
- Headline: **"Your AI agent on mobile. Properly."**
- Subheading (1–2 sentences): "A first-class iOS app for Hermes and OpenClaw. Markdown that
  actually renders, approve/stop from your pocket, status at a glance — not a Telegram bot."
- CTA: `Join early access` (email capture or TestFlight link, TBD). Secondary: `Read the docs`
- No hero image or screenshot in v1 — ship the copy first, add a screenshot once the UI is polished.

**Problem section** (short — 3–4 sentences, no icons or cards)
Hermes and OpenClaw ship with Telegram/Discord bots for mobile use. Those bots work but feel
degraded: markdown tables render as raw text, approve/stop decisions are awkward, and there's no
real status. Summit is the mobile client that those frameworks deserve.

**What it does** (3 features, minimal — a short list, not a feature grid)
- Proper markdown — tables, headings, and code blocks rendered correctly, including while streaming
- Approve / stop — one tap on blocking agent decisions, push notification on the way
- Status — idle, running, error, at a glance

Keep this section short. The audience knows what they want; you're confirming you built it.

**Supported frameworks**
- Hermes (v1) — Nous Research
- OpenClaw (coming) — indicate clearly it's not in v1

**Footer**
- Support: `support@[domain]` (email, no ticket system in v1)
- GitHub link (when repo is public)
- Privacy policy link
- `© 2026 Summit`

### Tone
Calm, direct, technical. No exclamation marks. No "revolutionary" or "powerful". Write the way the
Hermes docs are written — inform, don't pitch. The audience respects products that don't oversell.

---

## Page 2: Docs (`/docs`)

### Structure
Single scrollable page (not a sidebar nav) for v1. When the docs outgrow one page, add a sidebar.
Full content is in [`DOCS_CONTENT.md`](DOCS_CONTENT.md) — write that file and render it here.

**Sections:**
1. Getting started — what you need before you begin
2. Hermes setup — enabling the API server
3. Connecting the app — relay pairing (primary) + direct mode (advanced)
4. Approve & stop — what the runs API does and when you see these controls
5. FAQ — common issues

### Design notes
- Render from markdown (MDX or plain MD)
- Code blocks must have copy buttons
- No sidebar in v1 — one long scrollable page with anchor links in a sticky mini-nav or TOC at top

---

## Page 3: Login (`/login`)

### Purpose
Users need an account to pair the app with the relay. The login page is the web surface for
Supabase Auth. The same auth backs the mobile app (Apple Sign-In, Google Sign-In, email).

### Content
- No marketing copy on this page — just the auth form
- Options: `Continue with Apple` · `Continue with Google` · email/password
- After login: redirect to `/dashboard` or a simple "account" page (TBD — very minimal for v1,
  just confirming you're signed in and showing your paired agents if any)

### Note
The `/login` page is primarily used as a fallback. Most users will authenticate through the mobile
app directly (Apple/Google Sign-In). The web login exists for account management and future web chat.

---

## Out of scope for v1

- Web chat (`/chat`) — future
- Agent dashboard / management UI
- Billing / subscription pages
- Blog / changelog
- Dark/light toggle (dark is the product's look — see design system)
- Localization

---

## Stack recommendation

**Next.js 14+ (App Router)** — best for a mix of static pages (landing, docs) and auth-backed
dynamic pages (login, future chat). Deploys trivially to Vercel.

| Concern | Choice |
|---------|--------|
| Framework | Next.js 14, App Router |
| Styling | Tailwind CSS (with CSS custom properties from design system) |
| Auth | Supabase Auth (`@supabase/ssr`) — same Supabase project as mobile |
| Docs | MDX rendered by `@next/mdx` or `contentlayer` |
| Hosting | Vercel |
| Analytics | None in v1 |

---

## Open decisions

| # | Decision | Status |
|---|----------|--------|
| 1 | Early access mechanism — email list vs. TestFlight link | Open |
| 2 | Domain name | Open |
| 3 | When to make the GitHub repo public | Open — gate on MVP quality |
| 4 | `/dashboard` after login — how much to show? | Minimal for v1: just "you're connected" |

---

*Last updated: June 2026*
