# Fenced Markdown → File Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agent replies containing ` ```markdown `/` ```md ` fenced documents settle into the existing collapsed `MdFileCard` (tap → `MdReader`) instead of rendering as a numbered code block.

**Architecture:** All changes live in the pure post-stream settle step, `settleBlocks` in `src/ui/chat/streamReducer.ts`. A new fence-extraction pass runs first; if it extracts nothing, the existing raw-paste heuristic runs unchanged. No UI, adapter, or protocol changes — `{ kind: 'file' }` blocks already render, persist, and copy correctly.

**Tech Stack:** TypeScript (strict), Jest (`jest-expo` preset), path alias `@/*` → `src/*`.

## Global Constraints

- Green bar = `npx tsc --noEmit` AND `npm test` both passing (`.sdd/progress.md`).
- Spec: `docs/superpowers/specs/2026-07-05-fenced-md-file-detection-design.md`.
- Only ` ```markdown ` / ` ```md ` fences collapse; other language tags stay code blocks.
- Fenced floor: content must be ≥ 6 lines. No 1,500-char rule for fenced docs.
- Whole-reply raw-paste heuristic (front matter / early H1 + 1,500 chars) unchanged.
- Filename resolution order: `*.md` name in preceding prose → document H1 (`# Trip Plan` → `Trip Plan.md`) → `document.md`.

---

### Task 1: Regression tests for current `settleBlocks`

`settleBlocks` has no tests today. Lock its current behavior before touching it.

**Files:**
- Test: `__tests__/chat/settleBlocks.test.ts` (create)

**Interfaces:**
- Consumes: `settleBlocks(text: string): AgentBlock[]` from `@/ui/chat/streamReducer` (existing).
- Produces: the test file Task 2 appends to.

- [ ] **Step 1: Write the regression tests**

Create `__tests__/chat/settleBlocks.test.ts`:

```ts
import { settleBlocks } from '@/ui/chat/streamReducer';

/** A raw pasted document long enough (>1500 chars) to trip the heuristic. */
function longDoc(header: string): string {
  return `${header}\n\n${'Body paragraph line.\n'.repeat(100)}`;
}

describe('settleBlocks — raw-paste heuristic (existing behaviour)', () => {
  it('returns a single markdown block for a short plain reply', () => {
    expect(settleBlocks('Sure — done!')).toEqual([
      { kind: 'markdown', source: 'Sure — done!' },
    ]);
  });

  it('collapses a long front-mattered document into a file block', () => {
    const text = longDoc('---\ntitle: Research\n---\n\n# Research Notes');
    const blocks = settleBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('file');
  });

  it('collapses a long H1-led document, keeping intro text separate', () => {
    const text = `Here is the report.\n${longDoc('# Weekly Report')}`;
    const blocks = settleBlocks(text);
    expect(blocks.map((b) => b.kind)).toEqual(['markdown', 'file']);
    if (blocks[1].kind !== 'file') throw new Error('expected file block');
    expect(blocks[1].file.name).toBe('Weekly Report.md');
  });

  it('leaves a long reply without front matter or an early H1 as markdown', () => {
    const text = 'Line one.\n'.repeat(200);
    expect(settleBlocks(text)).toEqual([{ kind: 'markdown', source: text }]);
  });
});
```

- [ ] **Step 2: Run the tests — they must pass immediately (behaviour is pre-existing)**

Run: `npx jest __tests__/chat/settleBlocks.test.ts`
Expected: PASS, 4 tests.

If any fail, the test encodes the current behaviour wrongly — fix the test, not `settleBlocks`.

- [ ] **Step 3: Commit**

```bash
git add __tests__/chat/settleBlocks.test.ts
git commit -m "test(chat): lock current settleBlocks document heuristic"
```

---

### Task 2: Extract fenced markdown documents into file blocks

**Files:**
- Modify: `src/ui/chat/streamReducer.ts` (add fence extraction; `settleBlocks` runs it first)
- Test: `__tests__/chat/settleBlocks.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `buildFileBlock(name, source)` and `H1_RE` (both already in `streamReducer.ts`, module-private — the new code lives in the same file).
- Produces: `settleBlocks` (same signature) now returns `{ kind: 'file' }` blocks for qualifying fences. No caller changes.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/chat/settleBlocks.test.ts`:

```ts
/** ≥6 content lines, the floor for a fenced doc to collapse. */
const FENCED_DOC = [
  '# Trip Plan',
  '',
  '## Day 1',
  '- Arrive',
  '## Day 2',
  '- Explore',
].join('\n');

const fence = (lang: string, content: string) => `\`\`\`${lang}\n${content}\n\`\`\``;

describe('settleBlocks — fenced markdown documents', () => {
  it('extracts a ```markdown fence into a file block, keeping surrounding prose', () => {
    const text = `Here you go:\n\n${fence('markdown', FENCED_DOC)}\n\nAnything else?`;
    const blocks = settleBlocks(text);
    expect(blocks.map((b) => b.kind)).toEqual(['markdown', 'file', 'markdown']);
    if (blocks[1].kind !== 'file') throw new Error('expected file block');
    expect(blocks[1].file.source).toBe(FENCED_DOC);
    expect(blocks[1].file.lineCount).toBe(6);
  });

  it('accepts the ```md alias regardless of case', () => {
    const blocks = settleBlocks(fence('MD', FENCED_DOC));
    expect(blocks.map((b) => b.kind)).toEqual(['file']);
  });

  it('names the file from a mention in the preceding prose', () => {
    const text = `I saved this as \`trip-plan.md\`:\n\n${fence('markdown', FENCED_DOC)}`;
    const blocks = settleBlocks(text);
    if (blocks[1]?.kind !== 'file') throw new Error('expected file block');
    expect(blocks[1].file.name).toBe('trip-plan.md');
  });

  it('falls back to the document H1, then to document.md', () => {
    const withH1 = settleBlocks(fence('markdown', FENCED_DOC));
    if (withH1[0].kind !== 'file') throw new Error('expected file block');
    expect(withH1[0].file.name).toBe('Trip Plan.md');

    const noH1 = fence('markdown', 'alpha\nbeta\ngamma\ndelta\nepsilon\nzeta');
    const blocks = settleBlocks(noH1);
    if (blocks[0].kind !== 'file') throw new Error('expected file block');
    expect(blocks[0].file.name).toBe('document.md');
  });

  it('leaves a fence under the 6-line floor as ordinary markdown', () => {
    const text = `Example:\n\n${fence('markdown', '# Tiny\n- one\n- two')}`;
    expect(settleBlocks(text)).toEqual([{ kind: 'markdown', source: text }]);
  });

  it('leaves non-markdown fences untouched', () => {
    const text = fence('python', 'a\nb\nc\nd\ne\nf\ng');
    expect(settleBlocks(text)).toEqual([{ kind: 'markdown', source: text }]);
  });

  it('extracts multiple fenced documents in order', () => {
    const other = FENCED_DOC.replace('# Trip Plan', '# Packing List');
    const text = `First:\n${fence('markdown', FENCED_DOC)}\nSecond:\n${fence('md', other)}`;
    const blocks = settleBlocks(text);
    expect(blocks.map((b) => b.kind)).toEqual([
      'markdown', 'file', 'markdown', 'file',
    ]);
    const names = blocks.flatMap((b) => (b.kind === 'file' ? [b.file.name] : []));
    expect(names).toEqual(['Trip Plan.md', 'Packing List.md']);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx jest __tests__/chat/settleBlocks.test.ts`
Expected: the four Task 1 tests PASS; the new describe block FAILS (fences currently settle as plain markdown).

- [ ] **Step 3: Implement fence extraction in `src/ui/chat/streamReducer.ts`**

Add below `buildFileBlock` (before `settleBlocks`):

```ts
// A ```markdown / ```md fence is an explicit "here's a file" signal from the
// agent, so no length threshold applies — only a small floor so inline
// markdown *examples* aren't hidden behind a card.
const MD_FENCE_RE = /^```(?:markdown|md)[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*\r?$/gim;
const FENCE_MIN_LINES = 6;
/** A bare `name.md` filename mentioned in prose (no spaces). */
const MD_NAME_RE = /[\w][\w.-]*\.md\b/gi;

function fenceFileName(preceding: string, content: string): string {
  const mentioned = preceding.match(MD_NAME_RE);
  if (mentioned?.length) return mentioned[mentioned.length - 1];
  const h1 = content.match(H1_RE)?.[2]?.trim();
  if (h1) return /\.\w{1,6}$/.test(h1) ? h1 : `${h1}.md`;
  return 'document.md';
}

/**
 * Extract ```markdown / ```md fenced documents into file blocks, keeping the
 * surrounding text as markdown blocks. Returns null when no fence qualifies,
 * so `settleBlocks` falls through to the raw-paste heuristic.
 */
function extractFencedFiles(text: string): AgentBlock[] | null {
  const blocks: AgentBlock[] = [];
  let cursor = 0;
  for (const match of text.matchAll(MD_FENCE_RE)) {
    const content = match[1];
    if (content.split('\n').length < FENCE_MIN_LINES) continue;
    const start = match.index ?? 0;
    const before = text.slice(cursor, start);
    if (before.trim()) blocks.push({ kind: 'markdown', source: before.trim() });
    blocks.push(buildFileBlock(fenceFileName(before, content), content));
    cursor = start + match[0].length;
  }
  if (cursor === 0) return null;
  const rest = text.slice(cursor);
  if (rest.trim()) blocks.push({ kind: 'markdown', source: rest.trim() });
  return blocks;
}
```

Then make `settleBlocks` try fences first — change its opening to:

```ts
export function settleBlocks(text: string): AgentBlock[] {
  const fenced = extractFencedFiles(text);
  if (fenced) return fenced;

  if (text.length < DOCUMENT_MIN_CHARS) {
    return [{ kind: 'markdown', source: text }];
  }
  // …rest unchanged
```

Also update the `settleBlocks` doc comment to mention the fenced path, e.g. append: "Fenced ```markdown blocks are an explicit signal and are extracted first, with no length threshold."

- [ ] **Step 4: Run the full test file to verify everything passes**

Run: `npx jest __tests__/chat/settleBlocks.test.ts`
Expected: PASS, 11 tests (4 regression + 7 new).

- [ ] **Step 5: Green bar — typecheck and full suite**

Run: `npx tsc --noEmit` → no errors.
Run: `npm test` → all suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/chat/streamReducer.ts __tests__/chat/settleBlocks.test.ts
git commit -m "feat(chat): settle fenced markdown documents into file cards"
```
