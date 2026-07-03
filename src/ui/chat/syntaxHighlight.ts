/**
 * Tiny, dependency-free syntax highlighter for the chat code block.
 *
 * It is deliberately approximate — a regex-free hand scanner that colours the
 * things that matter at a glance (keywords, strings, numbers, comments, def
 * names, built-ins) for the languages agents emit most. Unknown languages fall
 * back to a minimal string/number/comment pass, and anything it can't classify
 * stays plain. It is not a parser; it trades correctness on edge cases for
 * being small, fast, and good enough for a snippet in a message.
 *
 * Returns lines of tokens so the renderer can lay out gutter line numbers.
 */

export type CodeTokenKind =
  | 'plain'
  | 'keyword'
  | 'func'
  | 'builtin'
  | 'number'
  | 'string'
  | 'comment';

export type CodeToken = { text: string; kind: CodeTokenKind };

type LangSpec = {
  lineComment: string[];
  blockComment: [string, string][];
  quotes: string[];
  triples: string[];
  keywords: Set<string>;
  builtins: Set<string>;
  /** Keywords after which the next identifier is a definition name. */
  defKeywords: Set<string>;
};

const set = (...xs: string[]) => new Set(xs);

const PYTHON: LangSpec = {
  lineComment: ['#'],
  blockComment: [],
  quotes: ["'", '"'],
  triples: ["'''", '"""'],
  keywords: set(
    'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not',
    'and', 'or', 'is', 'None', 'True', 'False', 'import', 'from', 'as', 'with',
    'try', 'except', 'finally', 'raise', 'lambda', 'yield', 'pass', 'break',
    'continue', 'global', 'nonlocal', 'assert', 'del', 'await', 'async',
  ),
  builtins: set(
    'print', 'len', 'range', 'int', 'str', 'float', 'list', 'dict', 'set',
    'tuple', 'bool', 'enumerate', 'zip', 'map', 'filter', 'sum', 'min', 'max',
    'abs', 'open', 'type', 'isinstance', 'sorted', 'reversed', 'round',
  ),
  defKeywords: set('def', 'class'),
};

const JS: LangSpec = {
  lineComment: ['//'],
  blockComment: [['/*', '*/']],
  quotes: ["'", '"', '`'],
  triples: [],
  keywords: set(
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
    'do', 'switch', 'case', 'break', 'continue', 'class', 'extends', 'new',
    'this', 'super', 'import', 'export', 'from', 'default', 'try', 'catch',
    'finally', 'throw', 'async', 'await', 'yield', 'typeof', 'instanceof', 'in',
    'of', 'delete', 'void', 'null', 'undefined', 'true', 'false', 'interface',
    'type', 'enum', 'as',
  ),
  builtins: set(
    'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean',
    'Promise', 'Map', 'Set', 'Symbol', 'document', 'window', 'require',
  ),
  defKeywords: set('function', 'class'),
};

const BASH: LangSpec = {
  lineComment: ['#'],
  blockComment: [],
  quotes: ["'", '"'],
  triples: [],
  keywords: set(
    'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case',
    'esac', 'in', 'function', 'return', 'export', 'local', 'source',
  ),
  builtins: set(
    'echo', 'cd', 'ls', 'cat', 'grep', 'sed', 'awk', 'curl', 'npm', 'npx',
    'git', 'sudo', 'mkdir', 'rm', 'cp', 'mv', 'chmod', 'docker', 'node',
  ),
  defKeywords: set('function'),
};

const JSON_SPEC: LangSpec = {
  lineComment: [],
  blockComment: [],
  quotes: ['"'],
  triples: [],
  keywords: set('true', 'false', 'null'),
  builtins: set(),
  defKeywords: set(),
};

const DEFAULT: LangSpec = {
  lineComment: ['#', '//'],
  blockComment: [['/*', '*/']],
  quotes: ["'", '"', '`'],
  triples: [],
  keywords: set(),
  builtins: set(),
  defKeywords: set(),
};

const ALIASES: Record<string, LangSpec> = {
  python: PYTHON,
  py: PYTHON,
  javascript: JS,
  js: JS,
  jsx: JS,
  typescript: JS,
  ts: JS,
  tsx: JS,
  bash: BASH,
  sh: BASH,
  shell: BASH,
  zsh: BASH,
  json: JSON_SPEC,
};

function specFor(language?: string): LangSpec {
  if (!language) return DEFAULT;
  return ALIASES[language.trim().toLowerCase()] ?? DEFAULT;
}

const isIdentStart = (c: string) => /[A-Za-z_$]/.test(c);
const isIdent = (c: string) => /[A-Za-z0-9_$]/.test(c);
const isDigit = (c: string) => c >= '0' && c <= '9';

/** Tokenise `code` into a flat token list (newlines become their own tokens). */
function tokenize(code: string, spec: LangSpec): CodeToken[] {
  const out: CodeToken[] = [];
  let i = 0;
  let prevWord = ''; // last identifier/keyword seen, to spot def names

  const push = (text: string, kind: CodeTokenKind) => {
    if (text) out.push({ text, kind });
  };

  const startsWith = (s: string) => code.startsWith(s, i);

  while (i < code.length) {
    const c = code[i];

    if (c === '\n') {
      out.push({ text: '\n', kind: 'plain' });
      i += 1;
      continue;
    }

    // line comment
    const lc = spec.lineComment.find(startsWith);
    if (lc) {
      const end = code.indexOf('\n', i);
      const stop = end === -1 ? code.length : end;
      push(code.slice(i, stop), 'comment');
      i = stop;
      continue;
    }

    // block comment (may span lines)
    const bc = spec.blockComment.find(([open]) => startsWith(open));
    if (bc) {
      const close = code.indexOf(bc[1], i + bc[0].length);
      const stop = close === -1 ? code.length : close + bc[1].length;
      pushMaybeMultiline(out, code.slice(i, stop), 'comment');
      i = stop;
      continue;
    }

    // triple-quoted string (python)
    const tr = spec.triples.find(startsWith);
    if (tr) {
      const close = code.indexOf(tr, i + tr.length);
      const stop = close === -1 ? code.length : close + tr.length;
      pushMaybeMultiline(out, code.slice(i, stop), 'string');
      i = stop;
      continue;
    }

    // single-line string
    if (spec.quotes.includes(c)) {
      let j = i + 1;
      while (j < code.length && code[j] !== c && code[j] !== '\n') {
        if (code[j] === '\\') j += 1; // skip escape
        j += 1;
      }
      if (j < code.length && code[j] === c) j += 1; // include closing quote
      push(code.slice(i, j), 'string');
      i = j;
      continue;
    }

    // number
    if (isDigit(c) || (c === '.' && isDigit(code[i + 1] ?? ''))) {
      let j = i + 1;
      while (j < code.length && /[0-9a-fA-FxX._]/.test(code[j])) j += 1;
      push(code.slice(i, j), 'number');
      i = j;
      continue;
    }

    // identifier / keyword
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < code.length && isIdent(code[j])) j += 1;
      const word = code.slice(i, j);
      let kind: CodeTokenKind = 'plain';
      if (spec.defKeywords.has(prevWord)) kind = 'func';
      else if (spec.keywords.has(word)) kind = 'keyword';
      else if (spec.builtins.has(word)) kind = 'builtin';
      push(word, kind);
      prevWord = word;
      i = j;
      continue;
    }

    // whitespace run (not newline) or single other char
    if (c === ' ' || c === '\t') {
      let j = i;
      while (j < code.length && (code[j] === ' ' || code[j] === '\t')) j += 1;
      push(code.slice(i, j), 'plain');
      i = j;
      continue;
    }

    push(c, 'plain');
    prevWord = ''; // punctuation breaks a def-name run
    i += 1;
  }

  return out;
}

/** Split a multi-line chunk into per-line tokens of one kind, preserving newlines. */
function pushMaybeMultiline(out: CodeToken[], text: string, kind: CodeTokenKind) {
  const parts = text.split('\n');
  parts.forEach((part, idx) => {
    if (part) out.push({ text: part, kind });
    if (idx < parts.length - 1) out.push({ text: '\n', kind: 'plain' });
  });
}

/** Highlight `code` into lines of tokens. */
export function highlightCode(code: string, language?: string): CodeToken[][] {
  const flat = tokenize(code, specFor(language));
  const lines: CodeToken[][] = [];
  let current: CodeToken[] = [];
  for (const tok of flat) {
    if (tok.text === '\n' && tok.kind === 'plain') {
      lines.push(current);
      current = [];
    } else {
      current.push(tok);
    }
  }
  lines.push(current);
  return lines;
}
