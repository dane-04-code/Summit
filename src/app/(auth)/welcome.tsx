import React from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LockKeyhole } from 'lucide-react-native';
import { SIGNUP_ENABLED } from '@/config';
import { colors, space, radius, typography, screenPadding } from '@/theme';
import { BRAND_DISPLAY_FONT, useBrandFont } from '@/ui/brandFont';
import { SignalPeak } from '@/ui/SignalPeak';
import { SUMMIT_MARK } from '@/ui/BrandMark';

export default function WelcomeScreen() {
  const router = useRouter();
  // The screen renders immediately in the system font and swaps up to the
  // display face when it lands, rather than holding the first frame hostage.
  const brandFont = useBrandFont();
  const display = brandFont ? { fontFamily: BRAND_DISPLAY_FONT } : styles.displayFallback;

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
            <Image source={SUMMIT_MARK} style={styles.mark} resizeMode="contain" tintColor={colors.ink} />
            <Text style={[styles.wordmark, display]}>SUMMIT</Text>
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
          <Text style={[styles.title, display]}>Your agent,{'\n'}within range</Text>
          <Text style={styles.subtitle}>
            Pair your self-hosted agent once. Chat, follow progress, and approve actions wherever
            you are.
          </Text>
        </View>

        <View style={styles.signal}>
          <SignalPeak width={132} tint={colors.ink2} />
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
  mark: { width: 26, height: 18 },
  wordmark: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  signInButton: { paddingHorizontal: space.sm, paddingVertical: space.sm },
  signInText: { ...typography.small, color: colors.ink2, fontWeight: '500' },
  pressed: { opacity: 0.55 },

  hero: { paddingTop: 46 },
  title: {
    color: colors.ink,
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  /** Until the display face lands, the system font stands in at its own metrics. */
  displayFallback: { fontWeight: '700', letterSpacing: -0.5 },
  subtitle: {
    ...typography.body,
    color: colors.muted,
    maxWidth: 340,
    marginTop: space.lg,
  },

  signal: {
    flex: 1,
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xl,
  },

  footer: { paddingTop: space.xl },
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
    borderRadius: radius.control,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: { backgroundColor: colors.ink2 },
  primaryText: { ...typography.body, color: colors.bg, fontWeight: '600' },
});
