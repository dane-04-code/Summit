/**
 * Code block for rich agent replies (Rich Rendering design, frame 2): a header
 * with a language label and Copy, a line-number gutter, and a horizontally
 * scrollable, syntax-highlighted body. Highlighting is approximate and
 * dependency-free (see syntaxHighlight.ts).
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { colors, space, typography } from '../../theme';
import { highlightCode, type CodeTokenKind } from './syntaxHighlight';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const TOKEN_COLOR: Record<CodeTokenKind, string> = {
  plain: colors.ink,
  keyword: colors.accent,
  func: colors.codeFunc,
  builtin: colors.codeBuiltin,
  number: colors.mdDate,
  string: colors.mdString,
  comment: colors.faint,
};

export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const source = code.replace(/\n$/, ''); // parser appends a trailing newline
  const lines = highlightCode(source, language);

  // Plain handler — the React Compiler handles memoization (see CLAUDE.md).
  const onCopy = () => {
    Clipboard.setStringAsync(source).catch(() => {});
    Haptics.selectionAsync().catch(() => {});
    setCopied(true);
  };

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.langDot} />
        <Text style={styles.lang}>{(language || 'text').toLowerCase()}</Text>
        <View style={styles.spacer} />
        <Pressable
          onPress={onCopy}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Copy code"
          style={styles.copyBtn}
        >
          {copied ? (
            <Check size={12} color={colors.muted} strokeWidth={1.8} />
          ) : (
            <Copy size={12} color={colors.muted} strokeWidth={1.4} />
          )}
          <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.gutter}>
          {lines.map((_, i) => (
            <Text key={i} style={styles.gutterNum} selectable={false}>
              {i + 1}
            </Text>
          ))}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.codeScroll}
        >
          <View>
            {lines.map((tokens, i) => (
              <Text key={i} style={styles.codeLine}>
                {tokens.length === 0
                  ? ' '
                  : tokens.map((t, j) => (
                      <Text key={j} style={{ color: TOKEN_COLOR[t.kind] }}>
                        {t.text}
                      </Text>
                    ))}
              </Text>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const CODE_LINE_HEIGHT = 22;

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.codeBlockBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm + 1,
    paddingHorizontal: space.md + 1,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  langDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.mdString,
  },
  lang: {
    ...typography.caption,
    fontSize: 12,
    letterSpacing: 0.3,
    color: colors.muted,
  },
  spacer: {
    flex: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 1,
  },
  copyText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.muted,
  },

  body: {
    flexDirection: 'row',
    paddingVertical: space.md,
  },
  gutter: {
    paddingHorizontal: space.md,
  },
  gutterNum: {
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: CODE_LINE_HEIGHT,
    color: colors.lineFocus,
    textAlign: 'right',
  },
  codeScroll: {
    paddingRight: space.md,
  },
  codeLine: {
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: CODE_LINE_HEIGHT,
    color: colors.ink,
  },
});
