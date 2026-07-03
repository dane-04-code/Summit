/**
 * Renders a markdown document for the file reader: a syntax-highlighted YAML
 * front-matter card (doc-specific), then the body through the shared
 * `RichMarkdown` renderer (same engine as the chat thread).
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

import { colors, space } from '../../theme';
import { RichMarkdown } from './richMarkdown';
import { splitFrontMatter, parseFrontMatter, isDateLike } from './types';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export function MarkdownDoc({ source }: { source: string }) {
  const { frontMatter, body } = splitFrontMatter(source);
  const entries = frontMatter ? parseFrontMatter(frontMatter) : [];

  return (
    <View>
      {entries.length > 0 && (
        <View style={styles.frontMatter}>
          <Text style={styles.fmRule} selectable={false}>
            ---
          </Text>
          {entries.map((e) => (
            <Text key={e.key} style={styles.fmKey}>
              {e.key}:{' '}
              <Text style={isDateLike(e.value) ? styles.fmDate : styles.fmString}>{e.value}</Text>
            </Text>
          ))}
          <Text style={styles.fmRule} selectable={false}>
            ---
          </Text>
        </View>
      )}

      <RichMarkdown source={body} />
    </View>
  );
}

const styles = StyleSheet.create({
  frontMatter: {
    backgroundColor: colors.frontmatterBg,
    borderWidth: 1,
    borderColor: colors.surface2,
    borderRadius: 9,
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.md,
    marginBottom: space.lg,
  },
  fmRule: { fontFamily: MONO, fontSize: 12, lineHeight: 19, color: colors.faint },
  fmKey: { fontFamily: MONO, fontSize: 12, lineHeight: 19, color: colors.muted },
  fmString: { color: colors.mdString },
  fmDate: { color: colors.mdDate },
});
