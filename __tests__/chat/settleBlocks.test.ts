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
