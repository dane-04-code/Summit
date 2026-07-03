/**
 * markdown-it plugins for rich agent rendering, kept free of any imports so
 * they can be unit-tested against a plain markdown-it instance (the app wires
 * them into react-native-markdown-display's MarkdownIt in richMarkdown.tsx).
 *
 *   • math_inline  — `$…$`   → a leaf token carrying the raw math
 *   • math_block   — `$$…$$` → a block token carrying the raw math
 *   • tasks        — `[ ] / [x] / [!]` list items → a `data-task` attr on the
 *                    item, marker stripped, done items wrapped in ~~strike~~
 *
 * Typed loosely (`any`) against the markdown-it state/instance API on purpose.
 */

export function mathInlineRule(state: any, silent: boolean): boolean {
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x24 /* $ */) return false;
  if (state.src.charCodeAt(start + 1) === 0x24) return false; // opening $$ → block rule
  if (start > 0 && state.src.charCodeAt(start - 1) === 0x24) return false; // closing $ of a $$
  let pos = start + 1;
  while (pos < state.posMax) {
    if (state.src.charCodeAt(pos) === 0x24 && state.src.charCodeAt(pos - 1) !== 0x5c) break;
    pos += 1;
  }
  if (pos >= state.posMax || state.src.charCodeAt(pos) !== 0x24) return false;
  const content = state.src.slice(start + 1, pos);
  if (content.trim() === '') return false;
  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.markup = '$';
    token.content = content;
  }
  state.pos = pos + 1;
  return true;
}

export function mathBlockRule(
  state: any,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  const begin = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  if (begin + 2 > max) return false;
  if (state.src.slice(begin, begin + 2) !== '$$') return false;
  if (silent) return true;

  const firstLine = state.src.slice(begin + 2, max);
  const buf: string[] = [];
  let found = false;
  let lastLine = startLine;

  if (firstLine.trim().endsWith('$$')) {
    buf.push(firstLine.trim().replace(/\$\$\s*$/, ''));
    found = true;
  } else {
    buf.push(firstLine);
    let nextLine = startLine;
    while (!found) {
      nextLine += 1;
      if (nextLine >= endLine) break;
      const pos = state.bMarks[nextLine] + state.tShift[nextLine];
      const line = state.src.slice(pos, state.eMarks[nextLine]);
      if (line.trim().endsWith('$$')) {
        buf.push(line.replace(/\$\$\s*$/, ''));
        found = true;
        lastLine = nextLine;
      } else {
        buf.push(line);
      }
    }
  }
  if (!found) return false;
  state.line = lastLine + 1;
  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.content = buf.join('\n').trim();
  token.markup = '$$';
  token.map = [startLine, state.line];
  return true;
}

/** `[ ]` / `[x]` / `[!]` at the start of a list item → a tagged, marker-stripped task. */
export function taskListRule(state: any): void {
  const tokens = state.tokens;
  for (let i = 2; i < tokens.length; i++) {
    if (tokens[i].type !== 'inline') continue;
    if (tokens[i - 1].type !== 'paragraph_open') continue;
    if (tokens[i - 2].type !== 'list_item_open') continue;
    const m = /^\[([ xX!])\]\s+/.exec(tokens[i].content);
    if (!m) continue;
    const mark = m[1].toLowerCase();
    const taskState = mark === ' ' ? 'open' : mark === '!' ? 'blocked' : 'done';
    tokens[i - 2].attrSet('data-task', taskState);
    tokens[i].content = tokens[i].content.slice(m[0].length);
    const children = tokens[i].children || [];
    if (children[0] && children[0].type === 'text') {
      children[0].content = children[0].content.replace(/^\[([ xX!])\]\s+/, '');
    }
    if (taskState === 'done') {
      const Token = state.Token;
      tokens[i].children = [
        new Token('s_open', 's', 1),
        ...children,
        new Token('s_close', 's', -1),
      ];
    }
  }
}

/** Register all rich plugins on a markdown-it instance. */
export function richPlugins(md: any): void {
  md.inline.ruler.after('escape', 'math_inline', mathInlineRule);
  md.block.ruler.before('fence', 'math_block', mathBlockRule, {
    alt: ['paragraph', 'blockquote', 'list'],
  });
  md.core.ruler.after('inline', 'tasks', taskListRule);
}
