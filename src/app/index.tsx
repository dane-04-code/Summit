/**
 * Connect screen — entry point for Agent Messenger.
 * UI is fully built; networking is stubbed (see ponytail comment below).
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  LayoutAnimation,
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Eye, EyeOff, ChevronRight, ChevronDown } from 'lucide-react-native';

import { colors, space, radius, typography, screenPadding } from '../theme';
import { usePressAnim } from '../ui/usePressAnim';

// System monospace for the help / setup code block
const MONO_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' }) ?? 'monospace';

// ---------------------------------------------------------------------------
// Connect screen
// ---------------------------------------------------------------------------

export default function ConnectScreen() {
  const [host, setHost] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  const btnAnim = usePressAnim();

  // Track system "reduce motion" preference for the expand animation
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => { /* ignore — stays false */ });

    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  // Toggle the "Where do I find these?" help accordion
  function handleToggleHelp() {
    if (!reduceMotion) {
      LayoutAnimation.configureNext({
        duration: 200,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        delete: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
      });
    }
    setExpanded((v) => !v);
  }

  // Primary action — stub only
  async function handleConnect() {
    if (busy) return;
    setBusy(true);
    setError(null);

    // ponytail: wire real connect() here later
    //
    // Suggested error mapping (reference only — not wired):
    //   Can't reach host →
    //     `Couldn't reach \`${host}\`. Is the API server running? (\`hermes gateway\`)`
    //   401 / 403 →
    //     "Server's there, but the API key was rejected."
    //   Wrong shape →
    //     "Reached something, but it doesn't look like Hermes. Check host/port."

    await new Promise<void>((resolve) => setTimeout(resolve, 800));
    setBusy(false);
    router.replace('/agent');
  }

  return (
    <>
      {/* Hide the Stack header — we render our own title */}
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Title ─────────────────────────────────────── */}
            <Text style={styles.title}>Connect your agent</Text>

            {/* ── Host ──────────────────────────────────────── */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Host</Text>
              <TextInput
                style={styles.input}
                value={host}
                onChangeText={setHost}
                placeholder="my-hermes.home:8642"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                textContentType="URL"
                returnKeyType="next"
              />
            </View>

            {/* ── API Key ───────────────────────────────────── */}
            <View style={[styles.fieldGroup, styles.fieldGroupGap]}>
              <Text style={styles.label}>API Key</Text>
              <View style={styles.keyRow}>
                <TextInput
                  style={[styles.input, styles.keyInput]}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="your-secret-key"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showKey}
                  textContentType="password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                />
                <Pressable
                  onPress={() => setShowKey((v) => !v)}
                  hitSlop={12}
                  accessibilityLabel={showKey ? 'Hide API key' : 'Show API key'}
                  accessibilityRole="button"
                  style={styles.eyeBtn}
                >
                  {({ pressed }) =>
                    showKey ? (
                      <EyeOff size={20} color={pressed ? colors.ink : colors.muted} />
                    ) : (
                      <Eye size={20} color={pressed ? colors.ink : colors.muted} />
                    )
                  }
                </Pressable>
              </View>
            </View>

            {/* ── "Where do I find these?" accordion ───────── */}
            <View style={styles.helpContainer}>
              <Pressable
                onPress={handleToggleHelp}
                hitSlop={{ top: 8, bottom: 8, left: 0, right: 16 }}
                accessibilityLabel="Where do I find these?"
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={styles.helpToggle}
              >
                {({ pressed }) => (
                  <>
                    {expanded ? (
                      <ChevronDown
                        size={16}
                        color={pressed ? colors.ink : colors.accent}
                      />
                    ) : (
                      <ChevronRight
                        size={16}
                        color={pressed ? colors.ink : colors.accent}
                      />
                    )}
                    <Text style={[styles.helpToggleText, pressed && styles.helpToggleTextPressed]}>
                      Where do I find these?
                    </Text>
                  </>
                )}
              </Pressable>

              {expanded && (
                <View style={styles.helpPanel}>
                  <Text style={styles.helpHint}>In ~/.hermes/.env:</Text>
                  <View style={styles.codeBlock}>
                    <Text style={styles.code}>
                      {'API_SERVER_ENABLED=true\nAPI_SERVER_KEY=your-secret-key\nAPI_SERVER_PORT=8642'}
                    </Text>
                  </View>

                  <Text style={[styles.helpHint, styles.helpHintGap]}>Then start it:</Text>
                  <View style={styles.codeBlock}>
                    <Text style={styles.code}>{'hermes gateway'}</Text>
                  </View>
                </View>
              )}
            </View>

            {/* ── Test connection button ─────────────────────── */}
            <Pressable
              onPress={handleConnect}
              onPressIn={btnAnim.onPressIn}
              onPressOut={btnAnim.onPressOut}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Test connection"
              accessibilityState={{ busy, disabled: busy }}
            >
              <Animated.View
                style={[
                  styles.button,
                  busy && styles.buttonBusy,
                  btnAnim.animStyle,
                ]}
              >
                {busy ? (
                  <>
                    <ActivityIndicator
                      color={colors.bg}
                      size="small"
                      style={styles.spinner}
                    />
                    <Text style={styles.buttonText}>Connecting…</Text>
                  </>
                ) : (
                  <Text style={styles.buttonText}>Test connection</Text>
                )}
              </Animated.View>
            </Pressable>

            {/* ── Error line ────────────────────────────────── */}
            {error !== null && (
              <Text style={styles.errorText} accessibilityRole="alert">
                {error}
              </Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles — no raw hex or magic numbers; everything comes from theme tokens
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Layout
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: screenPadding,
    paddingTop: space.xxl,
    paddingBottom: space.xxl,
  },

  // Title
  title: {
    ...typography.title,
    color: colors.ink,
    marginBottom: space.xxl,
  },

  // Fields
  fieldGroup: {
    // base — no extra margin; title already has marginBottom
  },
  fieldGroupGap: {
    marginTop: space.lg,
  },
  label: {
    ...typography.small,
    color: colors.muted,
    marginBottom: space.xs,
  },
  input: {
    ...typography.body,
    color: colors.ink,
    height: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  keyInput: {
    flex: 1,
  },
  eyeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.xs,
  },

  // Help accordion
  helpContainer: {
    marginTop: space.xl,
  },
  helpToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  helpToggleText: {
    ...typography.small,
    color: colors.accent,
    marginLeft: space.xs,
  },
  helpToggleTextPressed: {
    color: colors.ink,
  },
  helpPanel: {
    backgroundColor: colors.bubble,
    borderRadius: radius.input,
    padding: space.lg,
    marginTop: space.sm,
  },
  helpHint: {
    ...typography.small,
    color: colors.ink,
    marginBottom: space.sm,
  },
  helpHintGap: {
    marginTop: space.md,
  },
  codeBlock: {
    backgroundColor: colors.codeBg,
    borderRadius: radius.code,
    padding: space.md,
  },
  code: {
    ...typography.mono,
    color: colors.ink,
    fontFamily: MONO_FONT,
  },

  // Button
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.input,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xxl,
    paddingHorizontal: space.lg,
  },
  buttonBusy: {
    opacity: 0.7,
  },
  buttonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.bg,
  },
  spinner: {
    marginRight: space.sm,
  },

  // Error
  errorText: {
    ...typography.small,
    color: colors.error,
    marginTop: space.md,
    textAlign: 'center',
  },
});
