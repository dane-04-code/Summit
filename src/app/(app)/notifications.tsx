import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bell, BellOff, Check, CircleAlert } from 'lucide-react-native';

import { useAgents } from '@/agents/AgentProvider';
import {
  DEFAULT_NOTIFICATION_MODE,
  getNotificationMode,
  setNotificationMode,
  type NotificationMode,
} from '@/notifications/preferences';
import { SettingsScreen, SectionLabel, Card, Row } from '@/ui/settings';
import { colors, space, typography } from '@/theme';

const OPTIONS: Array<{
  mode: NotificationMode;
  label: string;
  sublabel: string;
}> = [
  {
    mode: 'all',
    label: 'All activity',
    sublabel: 'Replies, errors, and approval requests',
  },
  {
    mode: 'attention',
    label: 'Needs attention',
    sublabel: 'Errors and approval requests only',
  },
  {
    mode: 'off',
    label: 'Off',
    sublabel: 'Do not send notifications for this agent',
  },
];

export default function Notifications() {
  const { activeAgent, adapterFor, repo } = useAgents();
  const [mode, setMode] = useState<NotificationMode>(DEFAULT_NOTIFICATION_MODE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isRelay = activeAgent?.transport === 'relay';

  useEffect(() => {
    let cancelled = false;
    if (!activeAgent) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void getNotificationMode(repo, activeAgent.id)
      .then((savedMode) => {
        if (!cancelled) setMode(savedMode);
      })
      .catch(() => {
        if (!cancelled) setMode(DEFAULT_NOTIFICATION_MODE);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeAgent?.id, repo]);

  async function selectMode(nextMode: NotificationMode) {
    if (!activeAgent || !isRelay || saving || nextMode === mode) return;
    setSaving(true);
    try {
      await setNotificationMode(repo, activeAgent.id, nextMode);
      setMode(nextMode);
      // RelayAdapter reads the preference while registering the push token.
      // Refresh now so the choice applies without waiting for a cold restart.
      try {
        await adapterFor(activeAgent).retryConnection();
      } catch {
        // The saved preference applies on the next reconnect if the agent is
        // currently offline.
      }
    } catch {
      // Keep the existing UI selection if the on-device store is unavailable.
    } finally {
      setSaving(false);
    }
  }

  if (!activeAgent) {
    return (
      <SettingsScreen title="Notifications">
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Pair an agent to manage its notifications.</Text>
        </View>
      </SettingsScreen>
    );
  }

  return (
    <SettingsScreen title="Notifications">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.group}>
          <SectionLabel>{activeAgent.name}</SectionLabel>
          {isRelay ? (
            <>
              <Card>
                {OPTIONS.map((option) => (
                  <Row
                    key={option.mode}
                    icon={
                      option.mode === 'off' ? (
                        <BellOff size={17} color={colors.ink} strokeWidth={1.5} />
                      ) : (
                        <Bell size={17} color={colors.ink} strokeWidth={1.5} />
                      )
                    }
                    label={option.label}
                    sublabel={option.sublabel}
                    onPress={() => void selectMode(option.mode)}
                    disabled={loading || saving}
                    right={
                      loading ? (
                        <ActivityIndicator size="small" color={colors.muted} />
                      ) : mode === option.mode ? (
                        <Check size={18} color={colors.ink} strokeWidth={2} />
                      ) : (
                        <View style={styles.selectionSpace} />
                      )
                    }
                  />
                ))}
              </Card>
              <Text style={styles.hint}>
                Notifications arrive only while Summit is away. Your phone’s notification permission
                must also be enabled.
              </Text>
            </>
          ) : (
            <>
              <Card>
                <Row
                  icon={<CircleAlert size={17} color={colors.muted} strokeWidth={1.5} />}
                  label="Unavailable for direct connections"
                  sublabel="Direct agents cannot reach your phone after Summit is closed."
                />
              </Card>
              <Text style={styles.hint}>
                Pair this agent through the Summit relay to receive reply, error, and approval
                notifications while you are away.
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 24 },
  group: { gap: 0 },
  selectionSpace: { width: 18, height: 18 },
  hint: {
    ...typography.caption,
    color: colors.faint,
    marginTop: space.sm,
    paddingHorizontal: 4,
    lineHeight: 17,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { ...typography.small, color: colors.muted, textAlign: 'center' },
});
