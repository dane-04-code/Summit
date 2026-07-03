/**
 * Transient "Copied" confirmation — a small muted pill that fades in above the
 * composer after a long-press copy, then fades away on its own. Re-showing is
 * driven by a fresh `shownAt` timestamp, so back-to-back copies restart it.
 */

import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { colors, radius, space, typography } from '../../theme';

export function CopiedToast({ shownAt }: { shownAt: number }) {
  // useState lazy-init (not useRef.current) — reading a ref during render
  // trips react-hooks/refs; matches the StatusDot/Sidebar animation pattern.
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!shownAt) return;
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [shownAt, opacity]);

  if (!shownAt) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]}>
      <Text style={styles.label}>Copied</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 96, // clears the composer
    alignSelf: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  label: {
    ...typography.caption,
    color: colors.ink,
  },
});
