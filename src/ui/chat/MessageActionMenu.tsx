/**
 * The long-press action menu — a small floating pill anchored to the message
 * that was pressed.
 *
 * Deliberately not `ActionSheetIOS`: every other affordance in this app is
 * bespoke and dark-only, and a system sheet arrives light/adaptive, breaks the
 * design lock, and detaches the actions from the message they belong to. This
 * one opens *at* the message, on the message's own side of the thread, which is
 * also what makes it obvious which message you are acting on once the thread is
 * dimmed behind it.
 */

import React, { useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Copy, Reply } from 'lucide-react-native';

import { colors, radius, space, typography, withAlpha } from '../../theme';

/** Where the pressed message sits in window coordinates, and which edge it hangs from. */
export type MessageAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** User bubbles hang from their right edge, full-width agent replies from the left. */
  align: 'left' | 'right';
};

export const MENU_WIDTH = 176;
const ROW_HEIGHT = 44; // HIG minimum, and the menu is exactly two of them
export const MENU_HEIGHT = ROW_HEIGHT * 2;
/** Breathing room between the menu and both the message and the screen edge. */
const GAP = space.sm;
const MARGIN = space.md;

/**
 * Place the menu under the message, flipping above it when the message sits low
 * enough that the menu would run off the bottom — and clamped so neither the
 * flip nor a wide bubble can push it past a screen edge.
 *
 * Pure and exported so the geometry is testable without a render.
 */
export function menuPosition(
  anchor: MessageAnchor,
  screen: { width: number; height: number },
): { left: number; top: number } {
  const rawLeft = anchor.align === 'right' ? anchor.x + anchor.width - MENU_WIDTH : anchor.x;
  const maxLeft = Math.max(MARGIN, screen.width - MENU_WIDTH - MARGIN);
  const left = Math.min(Math.max(rawLeft, MARGIN), maxLeft);

  const below = anchor.y + anchor.height + GAP;
  const fitsBelow = below + MENU_HEIGHT + MARGIN <= screen.height;
  const rawTop = fitsBelow ? below : anchor.y - MENU_HEIGHT - GAP;
  const maxTop = Math.max(MARGIN, screen.height - MENU_HEIGHT - MARGIN);
  const top = Math.min(Math.max(rawTop, MARGIN), maxTop);

  return { left, top };
}

/**
 * A settle-in that starts *almost* arrived — 120ms, a hair of scale — so the
 * menu reads as attached to the press rather than as a panel being presented.
 */
function useEntrance() {
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  }, [anim]);
  return {
    opacity: anim,
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
  };
}

export function MessageActionMenu({
  anchor,
  onReply,
  onCopy,
  onDismiss,
}: {
  anchor: MessageAnchor;
  onReply: () => void;
  onCopy: () => void;
  onDismiss: () => void;
}) {
  const screen = useWindowDimensions();
  const { left, top } = menuPosition(anchor, screen);
  const entrance = useEntrance();

  return (
    <Modal transparent animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onDismiss} accessibilityLabel="Dismiss menu" />
      <Animated.View style={[styles.menu, { left, top }, entrance]}>
        <MenuRow icon={<Reply size={17} color={colors.ink} strokeWidth={2} />} label="Reply" onPress={onReply} />
        <View style={styles.divider} />
        <MenuRow icon={<Copy size={17} color={colors.ink} strokeWidth={2} />} label="Copy" onPress={onCopy} />
      </Animated.View>
    </Modal>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon}
      <Text style={styles.rowLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Enough to push the thread back without blacking it out — the message you
  // pressed stays readable behind the menu.
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: withAlpha(colors.scrim, '59'),
  },
  // One tonal step above `surface`, which is what the thread behind it uses:
  // depth without a shadow, exactly like the composer's send control.
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    borderRadius: radius.input,
    backgroundColor: colors.surface2,
    overflow: 'hidden',
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  rowPressed: {
    backgroundColor: colors.hover,
  },
  rowLabel: {
    ...typography.small,
    color: colors.ink,
  },
  divider: {
    height: 1,
    marginLeft: space.lg,
    backgroundColor: colors.line,
  },
});
