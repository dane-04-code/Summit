/**
 * One row in the Cron Drops list, backed by a real `CronJob` record: name +
 * schedule (cron pill / interval label), a hairline, then the last-run status
 * and delivery target. A pause/resume control sits top-right; tapping the card
 * body opens the job's detail. Paused jobs read dimmed.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Clock, ArrowDownToLine, Pause, Play } from 'lucide-react-native';

import { colors, radius, space, typography } from '../../theme';
import { StatusDot } from './StatusDot';
import { displayStatus, formatDeliver, STATUS_META, type CronJob } from './types';

export function DropCard({
  job,
  onPress,
  onToggle,
}: {
  job: CronJob;
  onPress: () => void;
  onToggle: () => void;
}) {
  const status = displayStatus(job);
  const meta = STATUS_META[status];
  const isCron = job.schedule.kind === 'cron';
  const extraSkills = job.skills.length - 1;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${job.name}, ${meta.label}`}
      style={({ pressed }) => [styles.card, job.state === 'paused' && styles.cardPaused, pressed && styles.cardPressed]}
    >
      {/* name + schedule + pause/resume */}
      <View style={styles.topRow}>
        <View style={styles.grow}>
          <Text style={styles.name} numberOfLines={1}>
            {job.name}
          </Text>
          <View style={styles.scheduleRow}>
            <Clock size={13} color={colors.muted} strokeWidth={1.6} />
            {isCron ? (
              <Text style={styles.cronPill}>{job.schedule.expr}</Text>
            ) : (
              <Text style={styles.schedule}>{job.schedule.display}</Text>
            )}
          </View>
        </View>

        {job.state !== 'running' && (
          <Pressable
            onPress={onToggle}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={job.state === 'paused' ? 'Resume job' : 'Pause job'}
            style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
          >
            {job.state === 'paused' ? (
              <Play size={15} color={colors.muted} fill={colors.muted} strokeWidth={1.5} />
            ) : (
              <Pause size={15} color={colors.muted} fill={colors.muted} strokeWidth={1.5} />
            )}
          </Pressable>
        )}
      </View>

      <View style={styles.divider} />

      {/* status · destination + skills */}
      <View style={styles.bottomRow}>
        <View style={styles.statusGroup}>
          <StatusDot color={meta.color} pulse={status === 'running'} />
          <Text style={[styles.statusText, { color: meta.color }]} numberOfLines={1}>
            {meta.label}
          </Text>
          <Text style={styles.sep}>·</Text>
          <View style={styles.destGroup}>
            <ArrowDownToLine size={12} color={colors.muted} strokeWidth={1.4} />
            <Text style={styles.dest} numberOfLines={1}>
              {formatDeliver(job.deliver, job.origin)}
            </Text>
          </View>
        </View>

        {job.skills.length > 0 && (
          <View style={styles.skillPill}>
            <Text style={styles.skillText}>{job.skills[0]}</Text>
            {extraSkills > 0 && <Text style={styles.skillMore}>+{extraSkills}</Text>}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.appMark,
    paddingHorizontal: space.lg - 1,
    paddingTop: space.lg - 1,
    paddingBottom: space.md + 1,
  },
  cardPaused: {
    opacity: 0.6,
  },
  cardPressed: {
    backgroundColor: colors.surface,
    borderColor: colors.lineFocus,
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },

  // top
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm + 2,
  },
  name: {
    ...typography.body,
    fontWeight: '600',
    lineHeight: 21,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 3,
    marginTop: 5,
  },
  schedule: {
    ...typography.caption,
    color: colors.muted,
  },
  cronPill: {
    ...typography.mono,
    fontSize: 11,
    color: colors.faint,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  toggle: {
    width: 30,
    height: 30,
    marginTop: -2,
    marginRight: -4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  togglePressed: {
    backgroundColor: colors.surface2,
  },

  // divider
  divider: {
    height: 1,
    backgroundColor: colors.surface2,
    marginTop: space.md,
    marginBottom: space.md - 1,
  },

  // bottom
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
  },
  statusGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 3,
  },
  statusText: {
    ...typography.caption,
  },
  sep: {
    ...typography.caption,
    color: colors.faint,
  },
  destGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minWidth: 0,
    flexShrink: 1,
  },
  dest: {
    ...typography.caption,
    color: colors.muted,
    flexShrink: 1,
  },

  // skills
  skillPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    flexShrink: 0,
    backgroundColor: colors.surface2,
    borderRadius: 6,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  skillText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.muted,
  },
  skillMore: {
    ...typography.caption,
    fontSize: 12,
    color: colors.faint,
  },
});
