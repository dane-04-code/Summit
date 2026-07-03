import MarkdownIt from 'markdown-it';
import markdownItMark from 'markdown-it-mark';

import { richPlugins } from '../src/ui/chat/markdownItPlugins';

const md = MarkdownIt({ typographer: false, linkify: true }).use(markdownItMark).use(richPlugins);

function tokenTypes(src: string): string[] {
  return md.parse(src, {}).map((t: { type: string }) => t.type);
}

describe('math plugin', () => {
  it('emits an inline math token for $…$', () => {
    const inline = md.parse('energy $E = mc^2$ here', {})[1];
    const child = inline.children.find((c: { type: string }) => c.type === 'math_inline');
    expect(child).toBeTruthy();
    expect(child.content).toBe('E = mc^2');
  });

  it('does not treat $$ as inline math', () => {
    const inline = md.parse('the roots of $$x$$', {})[1];
    expect(inline.children.some((c: { type: string }) => c.type === 'math_inline')).toBe(false);
  });

  it('emits a block math token for a $$…$$ line', () => {
    const tokens = md.parse('$$x = \\frac{-b}{2a}$$', {});
    const block = tokens.find((t: { type: string }) => t.type === 'math_block');
    expect(block).toBeTruthy();
    expect(block.content).toBe('x = \\frac{-b}{2a}');
  });

  it('leaves ordinary text untouched', () => {
    expect(tokenTypes('just a sentence.')).toContain('paragraph_open');
  });
});

describe('task-list plugin', () => {
  const tokens = md.parse('- [x] done\n- [ ] open\n- [!] blocked', {});
  const items = tokens.filter((t: { type: string }) => t.type === 'list_item_open');

  it('tags each item with its task state and strips the marker', () => {
    const states = items.map((t: { attrGet: (n: string) => string | null }) => t.attrGet('data-task'));
    expect(states).toEqual(['done', 'open', 'blocked']);

    const inlines = tokens.filter((t: { type: string }) => t.type === 'inline');
    expect(inlines[0].content).toBe('done');
    expect(inlines[1].content).toBe('open');
    expect(inlines[2].content).toBe('blocked');
  });

  it('wraps a done item in strikethrough', () => {
    const inlines = tokens.filter((t: { type: string }) => t.type === 'inline');
    const childTypes = inlines[0].children.map((c: { type: string }) => c.type);
    expect(childTypes[0]).toBe('s_open');
    expect(childTypes[childTypes.length - 1]).toBe('s_close');
  });

  it('does not tag a normal list item', () => {
    const plain = md.parse('- just an item', {});
    const item = plain.find((t: { type: string }) => t.type === 'list_item_open');
    expect(item.attrGet('data-task')).toBeNull();
  });
});

describe('highlight plugin (markdown-it-mark)', () => {
  it('parses ==highlight== into mark tokens', () => {
    const inline = md.parse('a ==b== c', {})[1];
    expect(inline.children.some((c: { type: string }) => c.type === 'mark_open')).toBe(true);
  });
});
