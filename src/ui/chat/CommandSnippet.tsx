import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, typography } from '@/theme';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export function CommandSnippet({ command }: { command: string }) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator
        testID="command-snippet-scroll"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.command} selectable numberOfLines={1}>
          {command}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: '100%',
    borderRadius: radius.code,
    backgroundColor: colors.codeBlockBg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  content: {
    minWidth: '100%',
    paddingHorizontal: space.md + 1,
    paddingVertical: space.md - 1,
  },
  command: {
    ...typography.mono,
    fontFamily: MONO,
    color: colors.ink,
  },
});
