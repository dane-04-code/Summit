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
