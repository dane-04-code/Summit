import React from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, LockKeyhole, Terminal } from 'lucide-react-native';
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

        <View style={styles.cockpit}>
          <View style={styles.cockpitHeader}>
            <View style={styles.agentIdentity}>
              <View style={styles.agentMark}>
                <Image source={SUMMIT_MARK} style={styles.agentMarkImage} resizeMode="contain" />
              </View>
              <View>
                <Text style={styles.agentName}>Hermes</Text>
                <View style={styles.statusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Connected</Text>
                </View>
              </View>
            </View>
            <Text style={styles.time}>now</Text>
          </View>

          <View style={styles.rule} />

          <View style={styles.message}>
            <View style={styles.terminalIcon}>
              <Terminal size={15} color={colors.ink2} strokeWidth={1.8} />
            </View>
            <View style={styles.messageCopy}>
              <Text style={styles.messageLabel}>RUN COMPLETE</Text>
              <Text style={styles.messageTitle}>Production checks passed</Text>
              <Text style={styles.messageBody}>12 tests passed · build ready to deploy</Text>
            </View>
          </View>

          <View style={styles.approval}>
            <View style={styles.approvalCopy}>
              <Text style={styles.approvalLabel}>ACTION REQUEST</Text>
              <Text style={styles.approvalText}>Deploy the new release?</Text>
            </View>
            <View style={styles.approveButton}>
              <Check size={15} color={colors.bg} strokeWidth={2.4} />
              <Text style={styles.approveText}>Approve</Text>
            </View>
          </View>
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
          <Text style={styles.supportText}>Hermes today · OpenClaw support in progress</Text>
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

  cockpit: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.bubble,
    padding: space.lg,
  },
  cockpitHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  agentIdentity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  agentMark: {
    width: 38,
    height: 38,
    borderRadius: radius.control,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentMarkImage: { width: 18, height: 17 },
  agentName: { ...typography.small, color: colors.ink, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  statusText: { ...typography.caption, color: colors.muted },
  time: { ...typography.caption, color: colors.faint, marginTop: 2 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: space.lg },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  terminalIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.control,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageCopy: { flex: 1 },
  messageLabel: {
    ...typography.caption,
    color: colors.faint,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  messageTitle: { ...typography.small, color: colors.ink, fontWeight: '500', marginTop: 5 },
  messageBody: { ...typography.caption, color: colors.muted, marginTop: 3 },
  approval: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    backgroundColor: colors.raised,
    borderRadius: radius.input,
    marginTop: space.lg,
    padding: space.md,
    paddingLeft: space.lg,
  },
  approvalCopy: { flex: 1 },
  approvalLabel: {
    ...typography.caption,
    color: colors.faint,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  approvalText: { ...typography.caption, color: colors.ink2, marginTop: 3 },
  approveButton: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.ink,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
  },
  approveText: { ...typography.caption, color: colors.bg, fontWeight: '600' },

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
    borderRadius: radius.input,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: { backgroundColor: colors.ink2 },
  primaryText: { ...typography.body, color: colors.bg, fontWeight: '600' },
  supportText: {
    ...typography.caption,
    color: colors.faint,
    textAlign: 'center',
    marginTop: space.md,
  },
});
