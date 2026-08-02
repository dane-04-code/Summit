import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Trash2 } from 'lucide-react-native';

import { useAgents } from '@/agents/AgentProvider';
import { SettingsScreen, SectionLabel, Card, Row } from '@/ui/settings';
import { colors, space, typography } from '@/theme';

export default function Data() {
  const { agents, repo } = useAgents();
  const [count, setCount] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  // Count stored conversations on mount (SQLite is the external system here).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let total = 0;
      for (const a of agents) {
        const sessions = await repo.listSessions(a.id);
        total += sessions.length;
      }
      if (!cancelled) setCount(total);
    })();
    return () => {
      cancelled = true;
    };
  }, [agents, repo]);

  async function clearHistory() {
    setClearing(true);
    try {
      for (const a of agents) {
        const sessions = await repo.listSessions(a.id);
        for (const s of sessions) {
          await repo.deleteSession(s.id);
        }
      }
      setCount(0);
    } finally {
      setClearing(false);
    }
  }

  function confirmClear() {
    Alert.alert(
      'Delete chat history',
      'Delete every stored conversation on this device? Your account and agent connection stay intact. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void clearHistory() },
      ],
    );
  }

  const label =
    count === null ? 'Counting…' : count === 0 ? 'No conversations stored' : `${count} stored`;

  return (
    <SettingsScreen title="History & data">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.group}>
          <SectionLabel>On this device</SectionLabel>
          <Card>
            <Row label="Conversations" value={label} />
          </Card>
          <Text style={styles.hint}>
            Chats are stored only on this device. Nothing is uploaded — signing out or deleting your
            account also removes them.
          </Text>
        </View>

        <View style={styles.group}>
          <SectionLabel>Danger zone</SectionLabel>
          <Card>
            <Row
              icon={<Trash2 size={19} color={colors.error} strokeWidth={1.75} />}
              label="Delete chat history"
              danger
              onPress={clearing || count === 0 ? undefined : confirmClear}
              disabled={clearing || count === 0}
              right={clearing ? <ActivityIndicator color={colors.error} /> : <View />}
            />
          </Card>
        </View>
      </ScrollView>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 24 },
  group: { gap: 0 },
  hint: {
    ...typography.caption,
    color: colors.faint,
    marginTop: space.sm,
    paddingHorizontal: 14,
    lineHeight: 17,
  },
});
