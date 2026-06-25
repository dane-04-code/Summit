/**
 * Shared press-animation hook — opacity + scale, 150 ms.
 * Used by any tappable surface that needs subtle press feedback.
 */

import { useRef } from 'react';
import { Animated } from 'react-native';

export function usePressAnim() {
  const anim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.timing(anim, { toValue: 0.97, duration: 150, useNativeDriver: true }).start();

  const onPressOut = () =>
    Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: true }).start();

  const animStyle = {
    transform: [{ scale: anim }],
    opacity: anim,
  } as const;

  return { onPressIn, onPressOut, animStyle };
}
