import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Mail, LogOut, Trash2 } from 'lucide-react-native';

import { useAuth } from '@/context/AuthContext';
import { useAgents } from '@/agents/AgentProvider';
import { supabase } from '@/lib/supabase';
import { accountName, accountInitial, authProvider, providerLabel } from '@/lib/account';
import { SettingsScreen, SectionLabel, Card, Row } from '@/ui/settings';
import { colors, space, typography } from '@/theme';

export default function Account() {
  const { user, signOut } = useAuth();
  const { agents, removeAgent } = useAgents();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = accountName(user);
  const email = user?.email ?? '';
  const provider = providerLabel(authProvider(user));

  // Best-effort local wipe: drop every agent (cascades its sessions + messages)
  // and its Keychain secret. Runs before the remote delete so nothing sensitive
  // is left on the device.
  async function wipeLocal() {
    for (const a of agents) {
      await removeAgent(a.id);
    }
  }

  async function doDelete() {
    setError(null);
    setBusy(true);
    try {
      const { error: fnError } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
      });
      if (fnError) throw fnError;
      await wipeLocal();
      await signOut(); // clears the session → root guard sends the user to sign-in
    } catch (e) {
      setBusy(false);
      setError(
        e instanceof Error
          ? e.message
          : 'Could not delete your account. Please try again or contact support.',
      );
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete account',
      'This permanently deletes your Summit account and removes all data stored on this device. Your agent server is not affected. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: () => void doDelete() },
      ],
    );
  }

  function confirmSignOut() {
    Alert.alert('Sign out', 'Sign out of Summit on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <SettingsScreen title="Account">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{accountInitial(name)}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            Signed in with {provider}
          </Text>
        </View>

        <View style={styles.group}>
          <SectionLabel>Account</SectionLabel>
          <Card>
            <Row
              icon={<Mail size={17} color={colors.ink} strokeWidth={1.5} />}
              label="Email"
              value={email || undefined}
            />
            <Row
              icon={<LogOut size={17} color={colors.ink} strokeWidth={1.5} />}
              label="Sign out"
              onPress={confirmSignOut}
              right={<View />}
            />
          </Card>
        </View>

        <View style={styles.group}>
          <SectionLabel>Danger zone</SectionLabel>
          <Card>
            <Row
              icon={<Trash2 size={17} color={colors.error} strokeWidth={1.5} />}
              label="Delete account"
              danger
              onPress={busy ? undefined : confirmDelete}
              right={busy ? <ActivityIndicator color={colors.error} /> : <View />}
            />
          </Card>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.hint}>
            Deleting your account removes it from Summit permanently. It does not touch your
            self-hosted agent or its data.
          </Text>
        </View>
      </ScrollView>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 24 },

  identity: { alignItems: 'center', paddingVertical: space.lg, gap: 4 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 9999,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  avatarText: { fontSize: 24, fontWeight: '600', color: colors.ink },
  name: { ...typography.h, color: colors.ink },
  sub: { ...typography.small, color: colors.muted },

  group: { gap: 0 },
  error: { ...typography.caption, color: colors.error, marginTop: space.sm, paddingHorizontal: 4 },
  hint: {
    ...typography.caption,
    color: colors.faint,
    marginTop: space.sm,
    paddingHorizontal: 4,
    lineHeight: 17,
  },
});
