/**
 * Status dot + the pulse animation that drives "running" affordances.
 *
 * `usePulse` is a looping 0→1→0 driver (≈1.6s, matching the design's `amPulse`/
 * `amRing` keyframes). `StatusDot` is the small coloured dot used in the list,
 * the header, and the detail summary; it gently pulses while a run is live.
 */

import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

/** A looping pulse driver. Idle (0) and inert while `enabled` is false. */
export function usePulse(enabled: boolean) {
  // useState lazy-init (not useRef.current) keeps the value stable without
  // reading a ref during render — matches Sidebar's animation pattern.
  const [v] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!enabled) {
      v.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, v]);

  return v;
}

export function StatusDot({
  color,
  pulse,
  size = 7,
}: {
  color: string;
  pulse: boolean;
  size?: number;
}) {
  const v = usePulse(pulse);
  const style = pulse
    ? {
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }),
        transform: [
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }) },
        ],
      }
    : undefined;

  return (
    <Animated.View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    flexShrink: 0,
  },
});
