import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, typography } from '@/theme';
import type { RecoveredReply } from './recoverReplies';

type EventDisclosureProps = {
  receipt: RecoveredReply;
  onOpen: () => void;
  onDismiss: () => void;
};

function displayTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * A Summit-owned disclosure for bounded operational facts. The transcript
 * remains ordinary markdown; this is intentionally transient context.
 */
export function EventDisclosure({ receipt, onOpen, onDismiss }: EventDisclosureProps) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [receipt.sessionId, receipt.createdAt]);

  const title = receipt.scheduledWork ? 'Scheduled work finished' : 'Agent reply recovered';
  const detail = receipt.scheduledWork
    ? 'Delivered to Scheduled work'
    : 'Finished while you were away';

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? `Hide ${title}` : `Show ${title}`}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
      >
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{expanded ? 'Hide details' : 'View details'}</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.details}>
          <Text style={styles.detail}>{detail}</Text>
          <Text style={styles.time}>Completed at {displayTime(receipt.createdAt)}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onOpen} style={styles.openButton}>
              <Text style={styles.openText}>Open conversation</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.dismissButton}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentLine,
    borderRadius: radius.control,
    backgroundColor: colors.raised,
    overflow: 'hidden',
  },
  summary: {
    minHeight: 48,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  pressed: { backgroundColor: colors.hover },
  copy: { flex: 1, gap: 1 },
  title: { ...typography.small, color: colors.ink, fontWeight: '500' },
  hint: { ...typography.caption, color: colors.muted },
  chevron: { ...typography.small, color: colors.ink2 },
  details: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    padding: space.md,
    gap: space.xs,
  },
  detail: { ...typography.small, color: colors.ink2 },
  time: { ...typography.caption, color: colors.muted },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  openButton: { backgroundColor: colors.ink, borderRadius: radius.control, paddingHorizontal: space.md, paddingVertical: space.sm },
  openText: { ...typography.caption, color: colors.bg, fontWeight: '600' },
  dismissButton: { paddingHorizontal: space.sm, paddingVertical: space.sm },
  dismissText: { ...typography.caption, color: colors.ink2 },
});
