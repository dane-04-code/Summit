/**
 * Cron job detail — header (back · name · pause/resume · Run), a last/next-run
 * strip, the skills it uses, the delivered result, and the live process trace.
 *
 * The trace shows only when the run carries `steps` (live or witnessed); a
 * finished run that wasn't witnessed shows its result with a note that per-step
 * detail isn't retained. Metadata + result always render from durable data.
 */

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play, Pause } from 'lucide-react-native';

import { ScreenHeader } from '../ScreenHeader';
import { colors, radius, space, typography } from '../../theme';
import { StatusDot } from './StatusDot';
import { ProcessTrace } from './ProcessTrace';
import { JobLadder } from './JobLadder';
import { DropResultCard } from './DropResultCard';
import {
  displayStatus,
  formatNext,
  formatRelative,
  jobLadder,
  STATUS_META,
  type CronJob,
  type CronRun,
} from './types';

export function CronDetail({
  job,
  run,
  onBack,
  onRun,
  onToggle,
}: {
  job: CronJob;
  run: CronRun | null;
  onBack: () => void;
  onRun: () => void;
  onToggle: () => void;
}) {
  const insets = useSafeAreaInsets();
  const status = displayStatus(job);
  const meta = STATUS_META[status];

  const hasSteps = !!run?.steps?.length;
  const hasResult = !!run?.result;
  const finishedUnwitnessed = !!run && !hasSteps && run.status !== null;

  return (
    <View style={styles.flex}>
      {/* header */}
      <ScreenHeader
        title={job.name}
        subtitle={job.schedule.display}
        onBack={onBack}
        right={
          <View style={styles.headerActions}>
            {job.state !== 'running' && (
              <Pressable
                onPress={onToggle}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={job.state === 'paused' ? 'Resume job' : 'Pause job'}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.pressedSurface]}
              >
                {job.state === 'paused' ? (
                  <Play size={15} color={colors.muted} fill={colors.muted} strokeWidth={1.5} />
                ) : (
                  <Pause size={15} color={colors.muted} fill={colors.muted} strokeWidth={1.5} />
                )}
              </Pressable>
            )}

            <Pressable
              onPress={onRun}
              accessibilityRole="button"
              accessibilityLabel="Run now"
              style={({ pressed }) => [styles.runBtn, pressed && styles.pressedBorder]}
            >
              <Play size={11} color={colors.ink} fill={colors.ink} strokeWidth={1.5} />
              <Text style={styles.runText}>Run</Text>
            </Pressable>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* summary strip */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.cardLabel}>Last run</Text>
            <View style={styles.lastRunRow}>
              <StatusDot color={meta.color} pulse={status === 'running'} />
              <Text style={styles.summaryValue}>{formatRelative(job.last_run_at)}</Text>
            </View>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.cardLabel}>Next run</Text>
            <Text style={[styles.summaryValue, styles.nextRun]}>
              {job.state === 'paused' ? 'Paused' : formatNext(job.next_run_at)}
            </Text>
          </View>
        </View>

        {/* structure ladder — what the job is made of */}
        <View style={styles.structure}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Structure</Text>
            <View style={styles.sectionLine} />
          </View>
          <JobLadder nodes={jobLadder(job)} />
        </View>

        {/* live process trace */}
        {hasSteps && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Process</Text>
              <View style={styles.sectionLine} />
              {run?.status === null && <Text style={styles.live}>live</Text>}
            </View>
            <ProcessTrace steps={run!.steps!} />
          </>
        )}

        {/* delivered result */}
        {hasResult && (
          <View style={hasSteps && styles.resultSpacer}>
            <DropResultCard job={job} run={run!} />
          </View>
        )}

        {/* graceful fallbacks */}
        {finishedUnwitnessed && (
          <Text style={styles.note}>
            Step-by-step detail isn’t kept after a run finishes — only while it runs live.
          </Text>
        )}
        {!run && (
          <Text style={styles.note}>This job hasn’t run yet. Tap Run to start it now.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  // header
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedSurface: {
    backgroundColor: colors.surface,
  },
  pressedBorder: {
    backgroundColor: colors.surface,
    borderColor: colors.lineFocus,
  },
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    height: 32,
    paddingHorizontal: space.md + 1,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.line,
    flexShrink: 0,
  },
  runText: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.ink,
  },

  // body
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },

  // summary strip
  summaryRow: {
    flexDirection: 'row',
    gap: space.sm + 2,
    marginBottom: space.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.code + 2,
    paddingHorizontal: space.md + 1,
    paddingVertical: space.md - 1,
  },
  cardLabel: {
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  lastRunRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    marginTop: 5,
  },
  summaryValue: {
    ...typography.small,
    fontWeight: '500',
    color: colors.ink,
  },
  nextRun: {
    marginTop: 6,
  },

  // structure ladder
  structure: {
    marginBottom: space.xl - 4,
  },

  // process section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md + 2,
    paddingLeft: 2,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surface2,
  },
  live: {
    ...typography.caption,
    fontSize: 12,
    color: colors.accent,
  },
  resultSpacer: {
    marginTop: space.lg,
  },
  note: {
    ...typography.caption,
    color: colors.faint,
    lineHeight: 18,
    marginTop: space.lg,
    paddingHorizontal: 2,
  },
});
