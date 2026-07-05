import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageCircle, Zap, BadgeCheck, Lock } from 'lucide-react-native';
import { SIGNUP_ENABLED } from '@/config';
import { PeakGlyph } from '@/ui/BrandMark';
import { colors, space, radius, typography, screenPadding } from '@/theme';

const GLOW = require('../../../assets/images/logo-glow.png');

const FEATURES = [
  {
    icon: MessageCircle,
    title: 'Talk to it anywhere',
    body: 'A real chat with your self-hosted agent — wherever you are.',
  },
  {
    icon: Zap,
    title: 'Watch it work',
    body: 'Replies stream in live, with proper markdown and code.',
  },
  {
    icon: BadgeCheck,
    title: 'Stay in control',
    body: 'Approve or stop runs from your phone the moment it asks.',
  },
  {
    icon: Lock,
    title: 'Private by design',
    body: 'Keys stay in your keychain. Messages go only to your own server.',
  },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const intro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [intro]);

  function onPagerEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  const introStyle = {
    opacity: intro,
    transform: [
      { translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
    ],
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.flex, introStyle]}>
        {/* hero */}
        <View style={styles.hero}>
          <View style={styles.markWrap}>
            <Image source={GLOW} style={styles.glow} />
            <PeakGlyph size={64} color={colors.ink} />
          </View>
          <Text style={styles.wordmark}>Summit</Text>
          <Text style={styles.tagline}>Your agent, in your pocket.</Text>
        </View>

        {/* what's included — swipeable */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onPagerEnd}
          style={styles.pager}
        >
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <View key={title} style={[styles.slide, { width }]}>
              <View style={styles.slideIcon}>
                <Icon size={20} color={colors.accent} strokeWidth={1.7} />
              </View>
              <Text style={styles.slideTitle}>{title}</Text>
              <Text style={styles.slideBody}>{body}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.dots}>
          {FEATURES.map((f, i) => (
            <View key={f.title} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>

        {/* actions */}
        <View style={styles.actions}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push(SIGNUP_ENABLED ? '/(auth)/sign-up' : '/(auth)/sign-in')}
          >
            <Text style={styles.primaryBtnText}>Get started</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.push('/(auth)/sign-in')}
            hitSlop={8}
          >
            <Text style={styles.secondaryText}>
              Already have an account? <Text style={styles.secondaryLink}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markWrap: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 200, height: 200, opacity: 0.55 },
  wordmark: {
    ...typography.title,
    color: colors.ink,
    letterSpacing: -0.5,
    marginTop: space.sm,
  },
  tagline: { ...typography.body, color: colors.muted, marginTop: space.sm },

  pager: { flexGrow: 0 },
  slide: { alignItems: 'center', paddingHorizontal: screenPadding * 2, gap: space.sm },
  slideIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  slideTitle: { ...typography.h, color: colors.ink, textAlign: 'center' },
  slideBody: { ...typography.small, color: colors.muted, textAlign: 'center', maxWidth: 300 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, marginTop: space.lg },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotActive: { backgroundColor: colors.accent },

  actions: {
    paddingHorizontal: screenPadding,
    marginTop: space.xl,
    marginBottom: space.lg,
    gap: space.md,
  },
  primaryBtn: {
    height: 52,
    borderRadius: radius.input,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { ...typography.body, fontWeight: '600', color: colors.bg },
  secondaryBtn: { alignItems: 'center', paddingVertical: space.sm },
  secondaryText: { ...typography.small, color: colors.muted },
  secondaryLink: { color: colors.accent, fontWeight: '500' },
});
