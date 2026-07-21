import { highlightCode } from '../src/ui/chat/syntaxHighlight';
import { parseMath } from '../src/ui/chat/mathRender';
import { SEED_THREAD } from '../src/ui/chat/seed';
import type { AgentBlock } from '../src/ui/chat/types';
import {
  boundMarkdownSource,
  MAX_MARKDOWN_CHARS,
  MAX_MARKDOWN_LINE_CHARS,
  MAX_MARKDOWN_LINES,
  normalizeMarkdownSource,
} from '../src/ui/chat/richMarkdown';

type MarkdownBlock = Extract<AgentBlock, { kind: 'markdown' }>;

describe('highlightCode', () => {
  it('splits into one token line per source line', () => {
    const lines = highlightCode('a = 1\nb = 2', 'python');
    expect(lines).toHaveLength(2);
  });

  it('classifies python keywords, def names, builtins, strings, numbers, comments', () => {
    const [line] = highlightCode("def fib(n):  # go", 'python');
    const kindOf = (text: string) => line.find((t) => t.text === text)?.kind;
    expect(kindOf('def')).toBe('keyword');
    expect(kindOf('fib')).toBe('func');

    const call = highlightCode("print('hi', 42)", 'python')[0];
    const callKind = (text: string) => call.find((t) => t.text === text)?.kind;
    expect(callKind('print')).toBe('builtin');
    expect(callKind("'hi'")).toBe('string');
    expect(callKind('42')).toBe('number');

    const comment = highlightCode('x = 1  # note', 'python')[0];
    expect(comment.find((t) => t.kind === 'comment')?.text).toBe('# note');
  });

  it('leaves unknown languages mostly plain (no keyword colouring)', () => {
    const [line] = highlightCode('def fib', 'unknownlang');
    expect(line.every((t) => t.kind !== 'keyword')).toBe(true);
  });

  it('keeps strings spanning to the closing quote', () => {
    const [line] = highlightCode('s = "a, b, c"', 'python');
    expect(line.find((t) => t.kind === 'string')?.text).toBe('"a, b, c"');
  });
});

describe('parseMath', () => {
  it('substitutes symbol macros into text', () => {
    expect(parseMath('a \\times b')).toEqual([{ t: 'text', value: 'a × b' }]);
  });

  it('parses a simple fraction into stacked nodes', () => {
    expect(parseMath('\\frac{-b}{2a}')).toEqual([
      { t: 'frac', num: [{ t: 'text', value: '-b' }], den: [{ t: 'text', value: '2a' }] },
    ]);
  });

  it('nests a root inside a fraction numerator (the quadratic)', () => {
    const nodes = parseMath('\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
    const frac = nodes[0];
    if (frac.t !== 'frac') throw new Error('expected a frac node');
    expect(frac.num.some((n) => n.t === 'sqrt')).toBe(true);
    expect(frac.den).toEqual([{ t: 'text', value: '2a' }]);
  });
});

describe('seed rich-rendering showcases', () => {
  const sources = SEED_THREAD.flatMap((m) =>
    m.role === 'agent'
      ? m.blocks.filter((b): b is MarkdownBlock => b.kind === 'markdown').map((b) => b.source)
      : [],
  );

  it('seeds four non-empty markdown showcases', () => {
    expect(sources).toHaveLength(4);
    sources.forEach((src) => expect(src.length).toBeGreaterThan(0));
  });

  it('covers code, math, tables, and a quote across the showcases', () => {
    const all = sources.join('\n\n');
    expect(all).toContain('```python');
    expect(all).toContain('$$');
    expect(all).toContain('| Trade |');
    expect(all).toMatch(/^> /m);
    expect(all).toContain('- [x]');
  });
});

describe('boundMarkdownSource', () => {
  it('leaves normal markdown unchanged', () => {
    expect(boundMarkdownSource('# Title\n\nA short reply.')).toBe('# Title\n\nA short reply.');
  });

  it('truncates pathological long lines before markdown-it parses them', () => {
    const bounded = boundMarkdownSource('a'.repeat(MAX_MARKDOWN_LINE_CHARS + 10));
    expect(bounded.length).toBeLessThan(MAX_MARKDOWN_LINE_CHARS + 80);
    expect(bounded).toContain('[Line truncated for safety]');
    expect(bounded).toContain('[Output truncated for safety]');
  });

  it('caps very large markdown responses', () => {
    const bounded = boundMarkdownSource(`${'x\n'.repeat(MAX_MARKDOWN_LINES + 10)}${'y'.repeat(MAX_MARKDOWN_CHARS)}`);
    expect(bounded.length).toBeLessThanOrEqual(MAX_MARKDOWN_CHARS + 32);
    expect(bounded).toContain('[Output truncated for safety]');
  });

  it('closes a truncated code fence so its safety notice remains readable', () => {
    const bounded = boundMarkdownSource(`\`\`\`text\n${'x'.repeat(MAX_MARKDOWN_LINE_CHARS + 1)}`);
    expect(bounded).toContain('\n```\n\n[Output truncated for safety]');
  });
});

describe('normalizeMarkdownSource', () => {
  it('normalizes line endings and removes terminal control sequences', () => {
    expect(normalizeMarkdownSource('\u001b[32mDone\u001b[0m\r\nNext\u0000')).toBe('Done\nNext');
  });

  it('leaves ordinary markdown content untouched', () => {
    expect(normalizeMarkdownSource('Use `npm test` and **ship it**.')).toBe(
      'Use `npm test` and **ship it**.',
    );
  });
});
