/**
 * Cron Drops — the scheduled-job viewer.
 *
 * Loads the active agent's real Hermes Jobs API data through the adapter. No
 * seed data belongs on this screen: if jobs are unavailable, empty, or failing,
 * the UI says that directly.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useAgents } from '@/agents/AgentProvider';
import { colors, space, typography } from '@/theme';
import { DropCard } from '@/ui/cron/DropCard';
import { CronDetail } from '@/ui/cron/CronDetail';
import { formatNext, type CronJob, type CronRun } from '@/ui/cron/types';

export default function CronScreen() {
  const { activeAgent, adapterFor } = useAgents();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [runs, setRuns] = useState<Record<string, CronRun | null>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const selected = selectedId ? jobs.find((j) => j.id === selectedId) ?? null : null;
  const selectedRun = selectedId ? runs[selectedId] ?? null : null;

  const summary = useMemo(() => {
    const active = jobs.filter((j) => j.state !== 'paused');
    const soonest = active
      .map((j) => j.next_run_at)
      .filter((t): t is string => !!t)
      .sort()[0];
    return {
      count: active.length,
      due: soonest ? `next due ${formatNext(soonest)}` : 'none due',
    };
  }, [jobs]);

  // `silent` skips the full-screen spinner — used on refocus, pull-to-refresh,
  // and after a toggle/run so the list updates in place instead of flashing.
  const loadJobs = useCallback(
    async (silent = false) => {
      if (!activeAgent) return;
      setError(null);
      if (!silent) setLoading(true);
      try {
        const adapter = adapterFor(activeAgent);
        const nextJobs = await adapter.listJobs();
        setJobs(nextJobs);
        setSelectedId((id) => (id && nextJobs.some((job) => job.id === id) ? id : null));
      } catch (e) {
        setJobs([]);
        setSelectedId(null);
        setError(e instanceof Error ? e.message : 'Could not load cron jobs.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeAgent, adapterFor],
  );

  // Reload whenever the screen gains focus — spinner on the first load, silent
  // refresh on every return so the running/paused state is current.
  useFocusEffect(
    useCallback(() => {
      void loadJobs(!firstLoad.current);
      firstLoad.current = false;
    }, [loadJobs]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadJobs(true);
  }, [loadJobs]);

  const loadRun = useCallback(
    async (jobId: string) => {
      if (!activeAgent) return;
      try {
        const run = await adapterFor(activeAgent).getJobRun(jobId);
        setRuns((prev) => ({ ...prev, [jobId]: run }));
      } catch {
        setRuns((prev) => ({ ...prev, [jobId]: null }));
      }
    },
    [activeAgent, adapterFor],
  );

  const handleLeave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)' as '/');
  }, []);

  const handleOpen = useCallback(
    (job: CronJob) => {
      Haptics.selectionAsync().catch(() => {});
      setSelectedId(job.id);
      void loadRun(job.id);
    },
    [loadRun],
  );

  const handleToggle = useCallback(
    async (id: string) => {
      if (!activeAgent) return;
      const job = jobs.find((j) => j.id === id);
      if (!job || job.state === 'running') return;
      Haptics.selectionAsync().catch(() => {});
      setBusyId(id);
      setError(null);
      try {
        const adapter = adapterFor(activeAgent);
        if (job.state === 'paused') await adapter.resumeJob(id);
        else await adapter.pauseJob(id);
        await loadJobs(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update cron job.');
      } finally {
        setBusyId(null);
      }
    },
    [activeAgent, adapterFor, jobs, loadJobs],
  );

  const handleRun = useCallback(async () => {
    if (!activeAgent || !selected) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBusyId(selected.id);
    setError(null);
    try {
      await adapterFor(activeAgent).triggerJob(selected.id);
      await Promise.all([loadJobs(true), loadRun(selected.id)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not run cron job.');
    } finally {
      setBusyId(null);
    }
  }, [activeAgent, adapterFor, loadJobs, loadRun, selected]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {selected ? (
          <CronDetail
            job={selected}
            run={selectedRun}
            onBack={() => setSelectedId(null)}
            onRun={handleRun}
            onToggle={() => handleToggle(selected.id)}
          />
        ) : (
          <View style={styles.flex}>
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Pressable
                  onPress={handleLeave}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
                >
                  <ChevronLeft size={22} color={colors.muted} strokeWidth={1.9} />
                </Pressable>
                <Text style={styles.title}>Cron Drops</Text>
              </View>
              <View style={styles.subtitleRow}>
                <View style={styles.summaryDot} />
                <Text style={styles.subtitle}>
                  {loading ? 'loading schedules' : `${summary.count} active schedules · ${summary.due}`}
                </Text>
              </View>
            </View>

            {loading ? (
              <StateMessage title="Loading cron jobs" body="Checking the active agent." loading />
            ) : error ? (
              <StateMessage
                title="Cron jobs unavailable"
                body={error}
                action="Try again"
                onPress={() => loadJobs()}
              />
            ) : jobs.length === 0 ? (
              <StateMessage
                title="No cron jobs"
                body="This agent did not return any scheduled jobs."
                action="Refresh"
                onPress={() => loadJobs()}
              />
            ) : (
              <FlashList<CronJob>
                data={jobs}
                renderItem={({ item }) => (
                  <DropCard
                    job={item}
                    onPress={() => handleOpen(item)}
                    onToggle={() => busyId !== item.id && handleToggle(item.id)}
                  />
                )}
                keyExtractor={(item) => item.id}
                ItemSeparatorComponent={Separator}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                onRefresh={onRefresh}
                refreshing={refreshing}
              />
            )}
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

function StateMessage({
  title,
  body,
  action,
  loading,
  onPress,
}: {
  title: string;
  body: string;
  action?: string;
  loading?: boolean;
  onPress?: () => void;
}) {
  return (
    <View style={styles.state}>
      {loading ? <ActivityIndicator color={colors.muted} /> : null}
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
      {action ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.stateBtn, pressed && styles.pressed]}
        >
          <Text style={styles.stateBtnText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: space.lg + 2,
    paddingTop: space.sm,
    paddingBottom: space.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
  },
  backBtn: {
    width: 34,
    height: 34,
    marginLeft: -6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
    color: colors.ink,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    marginTop: space.sm,
    paddingLeft: 28,
  },
  summaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  subtitle: {
    ...typography.caption,
    color: colors.muted,
  },
  listContent: {
    paddingHorizontal: space.lg,
    paddingTop: space.md + 2,
    paddingBottom: space.xl + 4,
  },
  separator: {
    height: space.md,
  },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    gap: space.sm,
  },
  stateTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
  },
  stateBody: {
    ...typography.small,
    color: colors.muted,
    textAlign: 'center',
  },
  stateBtn: {
    marginTop: space.sm,
    paddingHorizontal: space.lg,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBtnText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.ink,
  },
});
