import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert, TextInput } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Bell, Bot, Clock, LogOut, ChevronRight, Plus } from 'lucide-react-native';

import { useAuth } from '@/context/AuthContext';
import { useAgents } from '@/agents/AgentProvider';
import { accountName, accountInitial } from '@/lib/account';
import { SettingsScreen, SectionLabel, Card, Row } from '@/ui/settings';
import { colors, space, typography } from '@/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const ICON = { size: 19, strokeWidth: 1.75 } as const;

export default function Settings() {
  const { user, signOut } = useAuth();
  const { agents, activeAgent, renameAgent } = useAgents();
  const [agentName, setAgentName] = useState(activeAgent?.name ?? '');

  const name = accountName(user);
  const email = user?.email ?? '';

  useEffect(() => {
    setAgentName(activeAgent?.name ?? '');
  }, [activeAgent?.id, activeAgent?.name]);

  const saveAgentName = () => {
    if (!activeAgent) return;
    const trimmed = agentName.trim();
    if (!trimmed || trimmed === activeAgent.name) return;
    void renameAgent(activeAgent.id, trimmed);
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Sign out of Summit on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <SettingsScreen title="Settings">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Account — the one lit element on the screen: an inverted ink mark,
            the same treatment the app mark uses, so the page has an anchor. */}
        <Pressable
          onPress={() => router.push('/(app)/account' as '/')}
          style={({ pressed }) => [styles.accountCard, pressed && styles.accountPressed]}
          accessibilityRole="button"
          accessibilityLabel={`${name}, account settings`}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{accountInitial(name)}</Text>
          </View>
          <View style={styles.accountText}>
            <Text style={styles.accountName} numberOfLines={1}>
              {name}
            </Text>
            {email ? (
              <Text style={styles.accountEmail} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
          </View>
          <ChevronRight size={17} color={colors.faint} strokeWidth={2} />
        </Pressable>

        {/* Agent */}
        <View style={styles.group}>
          <SectionLabel>Agent</SectionLabel>
          <Card>
            <Row
              icon={<Bot size={ICON.size} color={colors.ink2} strokeWidth={ICON.strokeWidth} />}
              label="Connected agent"
              value={activeAgent ? activeAgent.name : 'None'}
              onPress={() =>
                router.push((activeAgent ? '/(app)/connection' : '/(app)/pair') as '/')
              }
            />
            {activeAgent ? (
              <View style={styles.nameRow}>
                <Text style={styles.nameLabel}>Display name</Text>
                <TextInput
                  style={styles.nameInput}
                  value={agentName}
                  onChangeText={setAgentName}
                  placeholder="Hermes"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={saveAgentName}
                  onBlur={saveAgentName}
                  accessibilityLabel="Agent display name"
                />
              </View>
            ) : null}
            {activeAgent ? (
              <Row
                icon={<Plus size={ICON.size} color={colors.ink2} strokeWidth={ICON.strokeWidth} />}
                label="Add another agent"
                sublabel="Pair a second Hermes or OpenClaw instance"
                onPress={() => router.push('/(app)/pair' as '/')}
              />
            ) : null}
          </Card>
          {activeAgent ? (
            <Text style={styles.hint}>
              {agents.length > 1
                ? 'Switch agents from the name at the top of the sidebar.'
                : 'Shown in the chat header and the agent switcher.'}
            </Text>
          ) : null}
        </View>

        {/* Device */}
        <View style={styles.group}>
          <SectionLabel>On this device</SectionLabel>
          <Card>
            <Row
              icon={<Bell size={ICON.size} color={colors.ink2} strokeWidth={ICON.strokeWidth} />}
              label="Notifications"
              sublabel="What this agent can send while you're away"
              onPress={() => router.push('/(app)/notifications' as '/')}
            />
            <Row
              icon={<Clock size={ICON.size} color={colors.ink2} strokeWidth={ICON.strokeWidth} />}
              label="History & data"
              sublabel="Conversations stored on this phone"
              onPress={() => router.push('/(app)/data' as '/')}
            />
          </Card>
        </View>

        {/* Sign out */}
        <Card>
          <Row
            icon={<LogOut size={ICON.size} color={colors.error} strokeWidth={ICON.strokeWidth} />}
            label="Sign out"
            danger
            onPress={confirmSignOut}
            right={<View />}
          />
        </Card>

        <Text style={styles.version}>Summit · v{APP_VERSION}</Text>
      </ScrollView>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    gap: space.xl,
  },

  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: space.lg,
  },
  accountPressed: { backgroundColor: colors.hover },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 9999,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 19, fontWeight: '600', color: colors.bg },
  accountText: { flex: 1, minWidth: 0 },
  accountName: { fontSize: 17, fontWeight: '600', color: colors.ink, letterSpacing: -0.2 },
  accountEmail: { ...typography.caption, color: colors.muted, marginTop: 2 },

  group: { gap: 0 },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  nameLabel: { fontSize: 16, color: colors.ink, letterSpacing: -0.1 },
  nameInput: {
    flex: 1,
    ...typography.small,
    color: colors.ink,
    textAlign: 'left',
    padding: 0,
  },

  hint: {
    ...typography.caption,
    color: colors.faint,
    marginTop: space.sm,
    paddingHorizontal: space.lg - 2,
    lineHeight: 17,
  },

  version: { ...typography.caption, color: colors.faint, textAlign: 'center' },
});
