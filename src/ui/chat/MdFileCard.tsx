/**
 * Collapsed `.md` attachment card shown inside an agent reply (MD File design,
 * frame 1): a file glyph with an MD badge, the name + meta, a two-line mono
 * preview of the source, and an "Open file" affordance. Tapping opens the
 * reader.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ExternalLink } from 'lucide-react-native';

import { colors, radius, space, typography } from '../../theme';
import { usePressAnim } from '../usePressAnim';
import { mdPreviewLines, type MarkdownFile } from './types';

function FileGlyph() {
  return (
    <View style={styles.glyph}>
      <Svg width={44} height={44} viewBox="0 0 44 44" fill="none">
        <Path
          d="M10 6h16l8 8v22a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
          fill={colors.fileGlyph}
          stroke={colors.lineFocus}
          strokeWidth={1.3}
        />
        <Path
          d="M26 6v6a2 2 0 0 0 2 2h6"
          stroke={colors.lineFocus}
          strokeWidth={1.3}
          strokeLinejoin="round"
        />
      </Svg>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>MD</Text>
      </View>
    </View>
  );
}

export function MdFileCard({
  file,
  onOpen,
}: {
  file: MarkdownFile;
  onOpen: () => void;
}) {
  const press = usePressAnim({ scale: 0.985 });
  const preview = mdPreviewLines(file.source, 2);

  return (
    <Pressable
      onPress={onOpen}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`Open ${file.name}`}
    >
      {({ pressed }) => (
        <Animated.View
          style={[styles.card, press.animStyle, pressed && styles.cardPressed]}
        >
          <View style={styles.top}>
            <FileGlyph />
            <View style={styles.meta}>
              <Text style={styles.name} numberOfLines={1}>
                {file.name}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                Markdown · {file.sizeLabel} · {file.lineCount} lines
              </Text>
            </View>
          </View>

          <View style={styles.preview}>
            {preview.map((line, i) => (
              <Text key={i} style={styles.previewLine} numberOfLines={1}>
                {line}
              </Text>
            ))}
            <View style={styles.openRow}>
              <ExternalLink size={14} color={colors.accent} strokeWidth={1.6} />
              <Text style={styles.openText}>Open file</Text>
            </View>
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'flex-start',
    maxWidth: 300,
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    overflow: 'hidden',
  },
  cardPressed: {
    borderColor: colors.lineFocus,
  },

  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md + 1,
  },
  glyph: {
    width: 44,
    height: 44,
  },
  badge: {
    position: 'absolute',
    left: 7,
    bottom: 8,
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.onAccentBtn,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.small,
    fontWeight: '600',
    color: colors.ink,
    lineHeight: 19,
  },
  sub: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 2,
  },

  preview: {
    borderTopWidth: 1,
    borderTopColor: colors.surface2,
    paddingHorizontal: space.md + 1,
    paddingTop: space.sm + 3,
    paddingBottom: space.md,
  },
  previewLine: {
    fontFamily: 'monospace',
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.faint,
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    marginTop: space.sm + 1,
  },
  openText: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.accent,
  },
});
