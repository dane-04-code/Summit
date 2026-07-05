import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius } from '@/theme';

/** The Summit mountain-peak glyph (the rounded Λ from the app icon). */
export function PeakGlyph({ size = 32, color = colors.bg }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path
        d="M3.4 14.2 9 3.8l5.6 10.4"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The glyph in the rounded-square ink tile used at the top of auth screens. */
export function BrandMark({ size = 60 }: { size?: number }) {
  return (
    <View style={[styles.tile, { width: size, height: size }]}>
      <PeakGlyph size={Math.round(size * 0.53)} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.bubble,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
