import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Animated, Easing, AccessibilityInfo } from 'react-native';
import { colors } from '@/theme';

const PEAK = require('../../assets/images/summit-peak.png');

/**
 * Geometry measured from the alpha channel of the source mark (1604 x 1077):
 * the summit point sits at 50.87% across, 4.46% down. Rings originate there,
 * not at the box centre, so the signal leaves the antenna rather than the art.
 * These values are shared with the marketing site's `mark-geometry.ts`.
 */
const PEAK_POINT = { x: 0.5087, y: 0.0446 };
const PEAK_ASPECT = 1604 / 1077;

/** Rings read as ground-plane circles seen near-edge-on, not as flat halos. */
const RING_FLATTEN = 0.3;
const RING_COUNT = 3;
const SWEEP_MS = 2600;
const STAGGER_MS = 620;
/** Two passes, then the screen goes still. Ambient looping is not the point. */
const SWEEPS = 2;

function Ring({ index, diameter }: { index: number; diameter: number }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let cancelled = false;
    const animation = Animated.sequence([
      Animated.delay(index * STAGGER_MS),
      Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration: SWEEP_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        { iterations: SWEEPS },
      ),
    ]);

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (cancelled || reduceMotion) return;
        animation.start();
      })
      .catch(() => {
        /* Motion preference unavailable — leave the rings at rest. */
      });

    return () => {
      cancelled = true;
      animation.stop();
    };
  }, [index, progress]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          marginLeft: -diameter / 2,
          marginTop: -diameter / 2,
          // Fades up as it leaves the antenna, thins out as it runs to the edge.
          opacity: progress.interpolate({
            inputRange: [0, 0.09, 0.55, 1],
            outputRange: [0, 0.7, 0.26, 0],
          }),
          transform: [
            { scaleY: RING_FLATTEN },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.06, 1],
              }),
            },
          ],
        },
      ]}
    />
  );
}

/**
 * The Summit mark with propagation rings leaving its antenna — the one
 * authored moment on the welcome screen. The rings are drawn beneath the mark
 * so the mountain occludes their near half: the signal comes from behind the
 * peak rather than across it.
 */
export function SignalPeak({ width = 128, tint = colors.ink }: { width?: number; tint?: string }) {
  const height = Math.round(width / PEAK_ASPECT);
  const ringDiameter = Math.round(width * 2.1);

  return (
    <View
      style={[styles.frame, { width, height }]}
      accessibilityRole="image"
      accessibilityLabel="Summit"
    >
      <View
        pointerEvents="none"
        style={[styles.origin, { left: width * PEAK_POINT.x, top: height * PEAK_POINT.y }]}
      >
        {Array.from({ length: RING_COUNT }, (_, i) => (
          <Ring key={i} index={i} diameter={ringDiameter} />
        ))}
      </View>
      <Image source={PEAK} style={{ width, height }} resizeMode="contain" tintColor={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center' },
  origin: { position: 'absolute', width: 0, height: 0 },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.accent,
  },
});
