/**
 * Shared press-animation hook — a spring-driven scale that reads as a tactile
 * "click": a quick, non-bouncy press-down and a softly springing release.
 * Used by any tappable surface that needs subtle, satisfying press feedback.
 */

import { useRef } from 'react';
import { Animated } from 'react-native';

type PressAnimOptions = {
  /** Target scale while pressed. Lower = punchier. Default 0.96. */
  scale?: number;
};

export function usePressAnim({ scale = 0.96 }: PressAnimOptions = {}) {
  // 0 = at rest, 1 = fully pressed.
  const anim = useRef(new Animated.Value(0)).current;

  const onPressIn = () =>
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50, // snap down fast
      bounciness: 0, // no overshoot on the way in
    }).start();

  const onPressOut = () =>
    Animated.spring(anim, {
      toValue: 0,
      useNativeDriver: true,
      speed: 28,
      bounciness: 7, // a small, satisfying pop on release
    }).start();

  const animStyle = {
    transform: [
      {
        scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, scale] }),
      },
    ],
  } as const;

  return { onPressIn, onPressOut, animStyle };
}
