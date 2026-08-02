/**
 * App-owned detail surface for the currently paired agent. The first version
 * intentionally reads the persisted pairing/capability data only; a future
 * native profile snapshot can add verified skills and tools without changing
 * the screen's rendering contract.
 */

import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Check, CircleAlert, Wrench } from 'lucide-react-native';

import { useAgents } from '@/agents/AgentProvider';
import { frameworkLabel } from '@/agents/frameworks';
import { colors, radius, space, typography } from '@/theme';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Card, Row, SectionLabel } from '@/ui/settings';
import { agentProfileSubtitle, profileCapabilities } from '@/ui/agentProfile/profile';
import { AgentAvatar } from '@/ui/agentIdentity/avatars';
import { IdentityPicker } from '@/ui/agentIdentity/IdentityPicker';

function StatusMark({ available }: { available: boolean }) {
  return available ? (
    <View style={styles.availableMark}>
      <Check size={12} color={colors.bg} strokeWidth={2.5} />
    </View>
  ) : (
    <CircleAlert size={17} color={colors.faint} strokeWidth={1.5} />
  );
}

export default function AgentProfileScreen() {
  const { activeAgent, setAgentIdentity } = useAgents();

  if (!activeAgent) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          <ScreenHeader title="Agent profile" />
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No agent selected</Text>
            <Text style={styles.emptyCopy}>Pair an agent to view its profile.</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const agent = activeAgent;
  const capabilities = profileCapabilities(agent);
  const version = agent.capabilities?.serverVersion ?? 'Not reported';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScreenHeader
          title="Agent profile"
          subtitle={agentProfileSubtitle(agent)}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/(app)' as '/'))}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <AgentAvatar
              avatarId={agent.avatarId}
              accent={agent.accentColor}
              size={58}
            />
            <View style={styles.heroCopy}>
              <Text style={styles.name}>{agent.name}</Text>
              <View style={styles.connectedRow}>
                <View style={styles.connectedDot} />
                <Text style={styles.connectedText}>Paired and ready</Text>
              </View>
            </View>
          </View>

          <View style={styles.group}>
            <SectionLabel>Identity</SectionLabel>
            <IdentityPicker
              avatarId={agent.avatarId ?? null}
              accentColor={agent.accentColor ?? null}
              onChange={(identity) => {
                void setAgentIdentity(agent.id, identity);
              }}
            />
          </View>

          <View style={styles.group}>
            <SectionLabel>Agent abilities</SectionLabel>
            <Card>
              {capabilities.map((capability) => (
                <Row
                  key={capability.id}
                  icon={<StatusMark available={capability.available} />}
                  label={capability.label}
                  sublabel={capability.detail}
                  value={capability.available ? 'Available' : 'Unavailable'}
                />
              ))}
            </Card>
          </View>

          <View style={styles.group}>
            <SectionLabel>Skills & tools</SectionLabel>
            <View style={styles.profilePending}>
              <View style={styles.pendingIcon}>
                <Wrench size={18} color={colors.muted} strokeWidth={1.5} />
              </View>
              <View style={styles.pendingCopy}>
                <Text style={styles.pendingTitle}>Profile details aren’t available yet</Text>
                <Text style={styles.pendingBody}>
                  Your connected plugin currently shares its identity and capabilities. Verified skills and tools will appear here when profile snapshots are supported.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.group}>
            <SectionLabel>Connection</SectionLabel>
            <Card>
              <Row label="Framework" value={frameworkLabel(agent.framework)} />
              <Row label="Transport" value={agent.transport === 'relay' ? 'Relay' : 'Direct'} />
              <Row label="Agent version" value={version} />
            </Card>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.xl },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  heroCopy: { flex: 1, minWidth: 0, gap: space.xs },
  name: { ...typography.h, color: colors.ink },
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  connectedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  connectedText: { ...typography.small, color: colors.ink2 },
  group: { gap: space.sm },
  availableMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  profilePending: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.drawer,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.code + 4,
  },
  pendingIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
  },
  pendingCopy: { flex: 1, gap: space.xs },
  pendingTitle: { ...typography.small, color: colors.ink },
  pendingBody: { ...typography.caption, color: colors.muted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.xs },
  emptyTitle: { ...typography.h, color: colors.ink },
  emptyCopy: { ...typography.small, color: colors.muted, textAlign: 'center' },
});
