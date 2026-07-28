import React from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LockKeyhole } from 'lucide-react-native';
import { SIGNUP_ENABLED } from '@/config';
import { colors, space, radius, typography, screenPadding } from '@/theme';

const SUMMIT_MARK = require('../../../assets/images/splash-icon.png');

export default function WelcomeScreen() {
  const router = useRouter();

  function start() {
    router.push(SIGNUP_ENABLED ? '/(auth)/sign-up' : '/(auth)/sign-in');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image source={SUMMIT_MARK} style={styles.mark} resizeMode="contain" />
            <Text style={styles.wordmark}>Summit</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(auth)/sign-in')}
            hitSlop={10}
            style={({ pressed }) => [styles.signInButton, pressed && styles.pressed]}
          >
            <Text style={styles.signInText}>Sign in</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>YOUR AGENT. ANYWHERE.</Text>
          <Text style={styles.title}>Stay close to the work.</Text>
          <Text style={styles.subtitle}>
            Pair your self-hosted agent once. Chat, follow progress, and approve actions wherever
            you are.
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.privacyRow}>
            <LockKeyhole size={14} color={colors.faint} strokeWidth={1.8} />
            <Text style={styles.privacyText}>Your agent key stays on your server</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={start}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}
          >
            <Text style={styles.primaryText}>Connect your agent</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: screenPadding,
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },

  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 25, height: 24 },
  wordmark: {
    ...typography.body,
    color: colors.ink,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  signInButton: { paddingHorizontal: space.sm, paddingVertical: space.sm },
  signInText: { ...typography.small, color: colors.ink2, fontWeight: '500' },
  pressed: { opacity: 0.55 },

  hero: { paddingTop: 46, paddingBottom: space.xxl },
  eyebrow: {
    ...typography.caption,
    color: colors.faint,
    fontWeight: '600',
    letterSpacing: 1.8,
  },
  title: {
    color: colors.ink,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '600',
    letterSpacing: -1.5,
    maxWidth: 330,
    marginTop: space.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    maxWidth: 340,
    marginTop: space.lg,
  },

  footer: { flex: 1, justifyContent: 'flex-end', paddingTop: space.xxl },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginBottom: space.md,
  },
  privacyText: { ...typography.caption, color: colors.faint },
  primaryButton: {
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: { backgroundColor: colors.ink2 },
  primaryText: { ...typography.body, color: colors.bg, fontWeight: '600' },
});
