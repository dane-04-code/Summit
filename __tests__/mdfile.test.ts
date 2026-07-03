import {
  splitFrontMatter,
  parseFrontMatter,
  isDateLike,
  mdPreviewLines,
} from '../src/ui/chat/types';
import { RESEARCH_FILE, SEED_THREAD } from '../src/ui/chat/seed';

const DOC = `---
title: Trades Market Research
author: Hermes
date: 2026-06-28
---

# Trades Market Research

First body line.
`;

describe('splitFrontMatter', () => {
  it('separates a leading YAML block from the body', () => {
    const { frontMatter, body } = splitFrontMatter(DOC);
    expect(frontMatter).toContain('title: Trades Market Research');
    expect(frontMatter).not.toContain('---');
    expect(body.startsWith('# Trades Market Research')).toBe(true);
  });

  it('returns null front matter when there is none', () => {
    const plain = '# Just a heading\n\nbody';
    const { frontMatter, body } = splitFrontMatter(plain);
    expect(frontMatter).toBeNull();
    expect(body).toBe(plain);
  });

  it('does not treat a mid-document --- (hr) as front matter', () => {
    const src = '# Heading\n\n---\n\nmore';
    expect(splitFrontMatter(src).frontMatter).toBeNull();
  });
});

describe('parseFrontMatter', () => {
  it('parses and trims key/value pairs, skipping non-pairs', () => {
    const fm = splitFrontMatter(DOC).frontMatter as string;
    const entries = parseFrontMatter(fm);
    expect(entries).toEqual([
      { key: 'title', value: 'Trades Market Research' },
      { key: 'author', value: 'Hermes' },
      { key: 'date', value: '2026-06-28' },
    ]);
  });

  it('ignores blank and colon-less lines', () => {
    expect(parseFrontMatter('\njust text\nkey: value\n')).toEqual([
      { key: 'key', value: 'value' },
    ]);
  });
});

describe('isDateLike', () => {
  it('flags ISO dates and nothing else', () => {
    expect(isDateLike('2026-06-28')).toBe(true);
    expect(isDateLike('Hermes')).toBe(false);
    expect(isDateLike('12 KB')).toBe(false);
  });
});

describe('mdPreviewLines', () => {
  it('returns the first non-blank body lines, front matter stripped', () => {
    expect(mdPreviewLines(DOC, 2)).toEqual(['# Trades Market Research', 'First body line.']);
  });

  it('defaults to two lines', () => {
    expect(mdPreviewLines(DOC)).toHaveLength(2);
  });
});

describe('seed integrity', () => {
  it('the research file is a well-formed .md with front matter', () => {
    expect(RESEARCH_FILE.name.endsWith('.md')).toBe(true);
    expect(RESEARCH_FILE.source.length).toBeGreaterThan(0);
    expect(RESEARCH_FILE.lineCount).toBeGreaterThan(0);
    expect(splitFrontMatter(RESEARCH_FILE.source).frontMatter).not.toBeNull();
  });

  it("the file card's preview leads with the document's H1", () => {
    expect(mdPreviewLines(RESEARCH_FILE.source)[0]).toMatch(/^# /);
  });

  it('the seeded thread attaches the research file via a file block', () => {
    const fileBlocks = SEED_THREAD.flatMap((m) =>
      m.role === 'agent' ? m.blocks.filter((b) => b.kind === 'file') : [],
    );
    expect(fileBlocks).toHaveLength(1);
    expect(fileBlocks[0]).toEqual({ kind: 'file', file: RESEARCH_FILE });
  });
});
