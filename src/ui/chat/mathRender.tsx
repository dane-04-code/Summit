/**
 * Minimal math rendering for agent replies (Rich Rendering design, frame 2).
 *
 * Not a TeX engine — a tiny parser that handles the constructs that show up in
 * practice: symbol macros (\times, \pm, \sqrt …), super/subscripts, and a
 * single level of \frac, rendered in a serif face. Inline math stays in the
 * text flow (so fractions degrade to a/b); block math lays fractions and roots
 * out as stacked views. Deep/exotic TeX won't be perfectly typeset — by design.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

import { colors } from '../../theme';

const SERIF = Platform.select({ ios: 'Georgia', default: 'serif' });

const SYMBOLS: Record<string, string> = {
  times: '×', cdot: '·', pm: '±', mp: '∓', div: '÷', leq: '≤', geq: '≥',
  neq: '≠', approx: '≈', infty: '∞', pi: 'π', alpha: 'α', beta: 'β',
  gamma: 'γ', theta: 'θ', lambda: 'λ', mu: 'μ', sigma: 'σ', sum: '∑',
  int: '∫', to: '→', rightarrow: '→', cdots: '⋯', ldots: '…', le: '≤', ge: '≥',
};

export type MathNode =
  | { t: 'text'; value: string }
  | { t: 'frac'; num: MathNode[]; den: MathNode[] }
  | { t: 'sqrt'; inner: MathNode[] };

/** Read one argument after a macro: a `{…}` group or the next single token. */
function readArg(src: string, i: number): { content: string; next: number } {
  while (src[i] === ' ') i += 1;
  if (src[i] === '{') {
    let depth = 1;
    let j = i + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') depth -= 1;
      if (depth === 0) break;
      j += 1;
    }
    return { content: src.slice(i + 1, j), next: j + 1 };
  }
  if (src[i] === '\\') {
    let j = i + 1;
    while (j < src.length && /[a-zA-Z]/.test(src[j])) j += 1;
    return { content: src.slice(i, j), next: j };
  }
  return { content: src[i] ?? '', next: i + 1 };
}

/** Parse a math string into a shallow node tree (text / frac / sqrt). */
export function parseMath(src: string): MathNode[] {
  const nodes: MathNode[] = [];
  let text = '';
  let i = 0;
  const flush = () => {
    if (text) nodes.push({ t: 'text', value: text });
    text = '';
  };

  while (i < src.length) {
    if (src.startsWith('\\frac', i)) {
      flush();
      const a = readArg(src, i + 5);
      const b = readArg(src, a.next);
      nodes.push({ t: 'frac', num: parseMath(a.content), den: parseMath(b.content) });
      i = b.next;
      continue;
    }
    if (src.startsWith('\\sqrt', i)) {
      flush();
      const a = readArg(src, i + 5);
      nodes.push({ t: 'sqrt', inner: parseMath(a.content) });
      i = a.next;
      continue;
    }
    if (src[i] === '\\') {
      let j = i + 1;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j += 1;
      const cmd = src.slice(i + 1, j);
      text += SYMBOLS[cmd] ?? cmd;
      i = j;
      continue;
    }
    text += src[i];
    i += 1;
  }
  flush();
  return nodes;
}

// ── Text run with super/subscripts ──────────────────────────────────────────

function MathText({ value, size }: { value: string; size: number }) {
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < value.length) {
    const c = value[i];
    if (c === '^' || c === '_') {
      const { content, next } = readArg(value, i + 1);
      parts.push(
        <Text key={key++} style={{ fontSize: size * 0.7 }}>
          {content}
        </Text>,
      );
      i = next;
    } else {
      let j = i;
      while (j < value.length && value[j] !== '^' && value[j] !== '_') j += 1;
      parts.push(value.slice(i, j));
      i = j;
    }
  }
  return <Text style={[styles.serif, { fontSize: size }]}>{parts}</Text>;
}

/** Flatten nodes to inline text (fractions degrade to a/b, roots to √(x)). */
function nodesToText(nodes: MathNode[]): string {
  return nodes
    .map((n) => {
      if (n.t === 'text') return n.value;
      if (n.t === 'frac') return `${nodesToText(n.num)}/${nodesToText(n.den)}`;
      return `√(${nodesToText(n.inner)})`;
    })
    .join('');
}

export function MathInline({ value }: { value: string }) {
  return <MathText value={nodesToText(parseMath(value))} size={16} />;
}

// ── Block layout (stacked fractions, roots with vinculum) ────────────────────

function Row({ nodes, size }: { nodes: MathNode[]; size: number }) {
  return (
    <View style={styles.row}>
      {nodes.map((n, i) => {
        if (n.t === 'text') return <MathText key={i} value={n.value} size={size} />;
        if (n.t === 'frac') {
          return (
            <View key={i} style={styles.frac}>
              <Row nodes={n.num} size={size * 0.9} />
              <View style={styles.fracBar} />
              <Row nodes={n.den} size={size * 0.9} />
            </View>
          );
        }
        return (
          <View key={i} style={styles.sqrt}>
            <Text style={[styles.serif, { fontSize: size }]}>√</Text>
            <View style={styles.vinculum}>
              <Row nodes={n.inner} size={size} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function MathBlock({ value }: { value: string }) {
  return (
    <View style={styles.block}>
      <Row nodes={parseMath(value)} size={22} />
    </View>
  );
}

const styles = StyleSheet.create({
  serif: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    color: colors.ink,
  },
  block: {
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  frac: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  fracBar: {
    height: 1.5,
    alignSelf: 'stretch',
    backgroundColor: colors.ink,
    marginVertical: 3,
  },
  sqrt: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  vinculum: {
    borderTopWidth: 1.5,
    borderTopColor: colors.ink,
    paddingTop: 3,
    marginTop: 2,
  },
});
