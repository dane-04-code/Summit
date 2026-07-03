/**
 * The delivered "drop" — a run's final artifact. Unlike the step trace, a run's
 * result is durable (Hermes saves each run's output to disk), so this renders
 * for past runs too, with or without a live step timeline above it.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArrowDownToLine } from 'lucide-react-native';

import { colors, radius, space, typography } from '../../theme';
import { formatDeliver, type CronJob, type CronRun } from './types';

function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function DropResultCard({ job, run }: { job: CronJob; run: CronRun }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>Drop delivered</Text>
        <View style={styles.grow} />
        <Text style={styles.at}>{clockTime(run.at)}</Text>
      </View>
      <Text style={styles.title}>{run.result}</Text>
      <View style={styles.footer}>
        <ArrowDownToLine size={14} color={colors.muted} strokeWidth={1.4} />
        <Text style={styles.sentTo}>Sent to</Text>
        <Text style={styles.dest}>{formatDeliver(job.deliver, job.origin)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.lineFocus,
    borderRadius: radius.input,
    padding: space.md + 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  grow: {
    flex: 1,
  },
  at: {
    fontSize: 12,
    color: colors.faint,
    fontVariant: ['tabular-nums'],
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    lineHeight: 22,
    color: colors.ink,
    marginTop: space.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 3,
    marginTop: 10,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  sentTo: {
    ...typography.small,
    color: colors.muted,
  },
  dest: {
    ...typography.small,
    fontWeight: '500',
    color: colors.ink,
  },
});
