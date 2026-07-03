import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert, TextInput } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Bot, Clock, ChevronRight } from 'lucide-react-native';

import { useAuth } from '@/context/AuthContext';
import { useAgents } from '@/agents/AgentProvider';
import { accountName, accountInitial } from '@/lib/account';
import { SettingsScreen, SectionLabel, Card, Row } from '@/ui/settings';
import { colors, radius, typography } from '@/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { activeAgent, renameAgent } = useAgents();
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
      >
        {/* Account card */}
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
          <ChevronRight size={18} color={colors.muted} strokeWidth={1.5} />
        </Pressable>

        {/* Agent */}
        <View style={styles.group}>
          <SectionLabel>Agent</SectionLabel>
          <Card>
            {activeAgent ? (
              <View style={styles.nameRow}>
                <View style={styles.nameMain}>
                  <Text style={styles.nameLabel}>Display name</Text>
                  <Text style={styles.nameSub}>Shown in the chat header and sidebar</Text>
                </View>
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
                />
              </View>
            ) : null}
            <Row
              icon={<Bot size={17} color={colors.ink} strokeWidth={1.5} />}
              label="Connected agent"
              value={activeAgent ? activeAgent.name : 'None'}
              onPress={() =>
                router.push((activeAgent ? '/(app)/connection' : '/(app)/pair') as '/')
              }
            />
          </Card>
        </View>

        {/* Data */}
        <View style={styles.group}>
          <SectionLabel>Data</SectionLabel>
          <Card>
            <Row
              icon={<Clock size={17} color={colors.ink} strokeWidth={1.5} />}
              label="History & data"
              onPress={() => router.push('/(app)/data' as '/')}
            />
          </Card>
        </View>

        {/* Sign out */}
        <Pressable
          onPress={confirmSignOut}
          style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <Text style={styles.version}>Summit · v{APP_VERSION}</Text>
      </ScrollView>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 24 },

  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
  },
  accountPressed: { backgroundColor: colors.surface },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 19, fontWeight: '600', color: colors.ink },
  accountText: { flex: 1, minWidth: 0 },
  accountName: { fontSize: 17, fontWeight: '600', color: colors.ink, lineHeight: 21 },
  accountEmail: { ...typography.small, color: colors.muted, marginTop: 1 },

  group: { gap: 0 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  nameMain: { flex: 1, minWidth: 0 },
  nameLabel: { fontSize: 16, color: colors.ink },
  nameSub: { ...typography.caption, color: colors.muted, marginTop: 1 },
  nameInput: {
    flex: 1,
    maxWidth: 190,
    height: 38,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.control,
    paddingHorizontal: 10,
    color: colors.ink,
    backgroundColor: colors.bg,
    textAlign: 'right',
  },

  signOut: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
  },
  signOutPressed: { backgroundColor: colors.surface },
  signOutText: { fontSize: 16, fontWeight: '500', color: colors.error },

  version: { ...typography.caption, color: colors.faint, textAlign: 'center' },
});
