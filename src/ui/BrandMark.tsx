import React from 'react';
import { Image } from 'react-native';
import { colors } from '@/theme';

/**
 * The Summit mark — the website's own mountain logo art, shipped white on
 * transparent and tinted at runtime so one file serves every surface. This is
 * the single source of the mark in the app; anything drawing it imports from
 * here rather than reaching for the asset directly.
 */
export const SUMMIT_MARK = require('../../assets/images/summit-peak.png');

/** Intrinsic aspect of the mark art. Shared with the marketing site. */
export const MARK_ASPECT = 540 / 363;

/**
 * The mark at the head of the auth screens. It sits bare on the background
 * rather than inside a tile: the art is the identity, and a container around
 * it would be chrome the screen hasn't earned.
 */
export function BrandMark({ width = 76, tint = colors.ink }: { width?: number; tint?: string }) {
  return (
    <Image
      source={SUMMIT_MARK}
      style={{ width, height: Math.round(width / MARK_ASPECT) }}
      resizeMode="contain"
      tintColor={tint}
      accessibilityRole="image"
      accessibilityLabel="Summit"
    />
  );
}
