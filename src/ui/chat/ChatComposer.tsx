import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowUp, ChevronDown, Mic, Plus, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { colors, space, typography } from '@/theme';
import { usePressAnim } from '@/ui/usePressAnim';
import {
  COMPOSER_MAX_HEIGHT,
  COMPOSER_MIN_HEIGHT,
  composerHeightFor,
} from '@/ui/chat/composerHeight';
import { ProviderMark } from '@/ui/chat/providerMarks';
import { ComposerQuotedReply } from '@/ui/chat/QuotedReply';
import type { ReplyRef } from '@/ui/chat/types';

/**
 * The composer is a two-row tray: the draft owns the full width on top, and a
 * control row sits beneath it. Every control is a recessed well — one tonal
 * step below the page, inside a shell one step above it — except send, which is
 * the shell's single high-contrast element and only lights up once there is
 * something to send.
 */

/** Well diameter. 36pt of paint, 44pt of touch target via hitSlop. */
const CONTROL_SIZE = 36;
/** Touch padding that lifts a 36pt control to the 44pt HIG minimum without
 *  overlapping its 8pt-away neighbour. */
const CONTROL_HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 } as const;

/**
 * The model control, when the connected agent has one. Absent for agents that
 * never advertised a picker, which is why the whole row is optional rather
 * than a disabled button.
 */
export type ComposerModel = {
  /** What to call the current model; a neutral word until the host says. */
  label: string;
  /** Hermes provider slug, for the mark. Empty until a catalogue has loaded. */
  providerSlug: string;
  onPress: () => void;
};

export function mergeDictation(prefix: string, transcript: string): string {
  const before = prefix.trimEnd();
  const spoken = transcript.trim();
  if (!before) return spoken;
  if (!spoken) return before;
  return `${before} ${spoken}`;
}

function ListeningBars() {
  const [bars] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.4)));

  useEffect(() => {
    const loops = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 90),
          Animated.timing(bar, { toValue: 1, duration: 240, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.4, duration: 240, useNativeDriver: true }),
          Animated.delay((2 - index) * 90),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [bars]);

  return (
    <View style={styles.listeningBars} accessibilityElementsHidden>
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[styles.listeningBar, { transform: [{ scaleY: bar }] }]}
        />
      ))}
    </View>
  );
}

/**
 * The bottom inset the tray should carry. The home-indicator inset only applies
 * while the keyboard is down — once it is up, `KeyboardAvoidingView` has already
 * lifted the tray past the safe area, and paying the inset a second time leaves
 * the composer floating a thumb's width above the keys.
 */
function useTrayBottomInset(bottomInset: number): number {
  const [keyboardUp, setKeyboardUp] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardUp(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardUp(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return keyboardUp ? space.md : Math.max(bottomInset, space.md);
}

/**
 * A 0→1 value that follows a boolean, starting settled on its initial state so
 * a fresh mount renders the end state instead of animating into it.
 */
function useSettledTransition(on: boolean, duration: number, native: boolean) {
  const [anim] = useState(() => new Animated.Value(on ? 1 : 0));
  const settledOn = useRef(on);

  useEffect(() => {
    if (settledOn.current === on) return;
    settledOn.current = on;
    Animated.timing(anim, {
      toValue: on ? 1 : 0,
      duration,
      useNativeDriver: native,
    }).start();
  }, [on, anim, duration, native]);

  return anim;
}

type ChatComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  bottomInset: number;
  model?: ComposerModel | null;
  /** Opens (or closes) the command menu the parent renders above the tray. */
  onCommands?: () => void;
  commandsOpen?: boolean;
  /** The message this draft is answering, if the user tapped Reply. */
  reply?: ReplyRef | null;
  /** What to call the agent in the reply strip's attribution. */
  agentName?: string;
  onClearReply?: () => void;
};

export type ChatComposerHandle = {
  focus: () => void;
};

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer({
  value,
  onChangeText,
  onSend,
  onStop,
  streaming,
  bottomInset,
  model,
  onCommands,
  commandsOpen = false,
  reply = null,
  agentName = 'your agent',
  onClearReply,
}: ChatComposerProps, ref) {
  const [height, setHeight] = useState(COMPOSER_MIN_HEIGHT);
  const [listening, setListening] = useState(false);
  const [dictationNote, setDictationNote] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const valueRef = useRef(value);
  const dictationPrefixRef = useRef('');
  const sendAnim = usePressAnim({ scale: 0.9 });
  const micAnim = usePressAnim({ scale: 0.9 });
  const commandsPressAnim = usePressAnim({ scale: 0.9 });
  const [focusAnim] = useState(() => new Animated.Value(0));
  const trayBottomInset = useTrayBottomInset(bottomInset);

  const canSend = value.trim().length > 0 && !streaming;
  // Send is the one lit surface in the tray, and it earns that only when there
  // is a draft to send or a run to stop.
  const armed = canSend || streaming;

  // Both of these start settled at whatever the first render already shows —
  // a composer that mounts mid-stream is armed, not animating into armed.
  const armAnim = useSettledTransition(armed, 140, false);
  const commandsAnim = useSettledTransition(commandsOpen, 160, true);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  useEffect(() => {
    valueRef.current = value;
    // A send clears the draft from the parent without going through
    // `onChangeText`, so the tray has to collapse on its own rather than
    // waiting for a measurement that may never come.
    if (!value) setHeight(COMPOSER_MIN_HEIGHT);
  }, [value]);

  useEffect(() => {
    return () => ExpoSpeechRecognitionModule.abort();
  }, []);

  useSpeechRecognitionEvent('start', () => {
    setListening(true);
    setDictationNote(null);
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    onChangeText(mergeDictation(dictationPrefixRef.current, transcript));
  });
  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    if (event.error !== 'aborted' && event.error !== 'no-speech') {
      setDictationNote('Dictation unavailable');
    }
  });

  const animateFocus = useCallback(
    (toValue: number) => {
      Animated.timing(focusAnim, {
        toValue,
        duration: 160,
        useNativeDriver: false,
      }).start();
    },
    [focusAnim],
  );

  const handleTextChange = useCallback(
    (text: string) => {
      // Reset at the edit boundary. The first character after a cleared draft
      // must start at one line, never at the previous draft's measured height.
      if (!text || !valueRef.current) setHeight(COMPOSER_MIN_HEIGHT);
      valueRef.current = text;
      onChangeText(text);
      if (Platform.OS !== 'web') return;
      const node = inputRef.current as unknown as HTMLTextAreaElement | null;
      if (!node) return;
      const appliedHeight = node.style.height;
      node.style.height = '0px';
      setHeight(composerHeightFor(node.scrollHeight, text.length > 0));
      node.style.height = appliedHeight;
    },
    [onChangeText],
  );

  const toggleDictation = useCallback(async () => {
    Haptics.selectionAsync().catch(() => {});
    setDictationNote(null);
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      Alert.alert('Dictation unavailable', 'Speech recognition is not available on this device.');
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Allow dictation',
        'Enable Microphone and Speech Recognition for Summit in Settings to dictate messages.',
      );
      return;
    }
    dictationPrefixRef.current = valueRef.current;
    ExpoSpeechRecognitionModule.start({
      lang: Intl.DateTimeFormat().resolvedOptions().locale || 'en-US',
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
      iosTaskHint: 'dictation',
      requiresOnDeviceRecognition: ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
    });
  }, [listening]);

  const displayedHeight = height;
  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.line, colors.lineFocus],
  });
  // Send is the only control that sits *above* the shell rather than recessed
  // into it, so the tray keeps an anchor at rest — then it goes fully lit the
  // moment there is a draft.
  const sendFill = armAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surface2, colors.ink],
  });
  const restingGlyphOpacity = armAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const commandsSpin = commandsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <View style={[styles.inputBar, { paddingBottom: trayBottomInset }]}>
      <Animated.View style={[styles.shell, { borderColor }]}>
        {reply && onClearReply ? (
          <ComposerQuotedReply reply={reply} agentName={agentName} onDismiss={onClearReply} />
        ) : null}

        {listening || dictationNote ? (
          <View style={styles.dictationStatus} accessibilityLiveRegion="polite">
            {listening ? <ListeningBars /> : <Mic size={13} color={colors.error} strokeWidth={2} />}
            <Text style={[styles.dictationText, dictationNote && styles.dictationError]}>
              {listening ? 'Listening — tap the microphone when finished' : dictationNote}
            </Text>
          </View>
        ) : null}

        <TextInput
          ref={inputRef}
          style={[styles.textField, { height: displayedHeight }]}
          value={value}
          onChangeText={handleTextChange}
          placeholder="Message your agent"
          placeholderTextColor={colors.muted}
          onFocus={() => animateFocus(1)}
          onBlur={() => animateFocus(0)}
          autoCorrect
          multiline
          // Scrolling stays enabled at every height. iOS pins a UITextView's
          // contentSize to its frame while scrolling is off, so disabling it
          // makes `onContentSizeChange` report the height the field already
          // has — the field never learns it needs to grow, and the wrapped
          // line is clipped with no way to reach it. There is nothing to
          // scroll below the maximum anyway, because the frame is the
          // content.
          scrollEnabled
          onContentSizeChange={
            Platform.OS === 'web'
              ? undefined
              : (event) => {
                  // Apply the native intrinsic measurement exactly. Adding
                  // padding here makes the measured height feed back into the
                  // explicit height, causing the composer to resize repeatedly.
                  const contentHeight = event.nativeEvent.contentSize.height;
                  const nextHeight = composerHeightFor(
                    contentHeight,
                    valueRef.current.length > 0 || contentHeight > COMPOSER_MIN_HEIGHT,
                  );
                  setHeight((currentHeight) =>
                    currentHeight === nextHeight ? currentHeight : nextHeight,
                  );
                }
          }
          // The field owns its own row now, so the first line stays anchored to
          // the top and the box grows downward into the tray.
          textAlignVertical="top"
          accessibilityLabel="Message input"
        />

        <View style={styles.controls}>
          <View style={styles.controlsLeft}>
            {onCommands ? (
              <Pressable
                onPress={onCommands}
                onPressIn={commandsPressAnim.onPressIn}
                onPressOut={commandsPressAnim.onPressOut}
                hitSlop={CONTROL_HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel="Commands"
                accessibilityState={{ expanded: commandsOpen }}
              >
                <Animated.View
                  style={[
                    styles.well,
                    commandsPressAnim.animStyle,
                    commandsOpen && styles.wellActive,
                  ]}
                >
                  <Animated.View style={{ transform: [{ rotate: commandsSpin }] }}>
                    <Plus size={20} color={colors.ink2} strokeWidth={2} />
                  </Animated.View>
                </Animated.View>
              </Pressable>
            ) : null}

            {model ? (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  model.onPress();
                }}
                hitSlop={CONTROL_HIT_SLOP}
                style={({ pressed }) => [
                  styles.modelPill,
                  !model.providerSlug && styles.modelPillNoMark,
                  pressed && styles.wellActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Model: ${model.label}. Change model.`}
              >
                {model.providerSlug ? (
                  <ProviderMark slug={model.providerSlug} size={16} />
                ) : null}
                <Text style={styles.modelPillText} numberOfLines={1}>
                  {model.label}
                </Text>
                <ChevronDown size={14} color={colors.muted} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.controlsRight}>
            <Pressable
              onPress={toggleDictation}
              onPressIn={micAnim.onPressIn}
              onPressOut={micAnim.onPressOut}
              disabled={streaming}
              hitSlop={CONTROL_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={listening ? 'Stop dictation' : 'Dictate message'}
              accessibilityState={{ disabled: streaming, selected: listening }}
            >
              <Animated.View
                style={[
                  styles.well,
                  micAnim.animStyle,
                  listening && styles.wellActive,
                  streaming && styles.controlDisabled,
                ]}
              >
                {listening ? <ListeningBars /> : <Mic size={19} color={colors.ink2} strokeWidth={2} />}
              </Animated.View>
            </Pressable>

            <Pressable
              onPress={streaming ? onStop : onSend}
              onPressIn={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                sendAnim.onPressIn();
              }}
              onPressOut={sendAnim.onPressOut}
              disabled={!armed}
              hitSlop={CONTROL_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={streaming ? 'Stop reply' : 'Send message'}
              accessibilityState={{ disabled: !armed }}
            >
              {/* Press scale runs on the native driver and the fill on the JS
                  one, so they need separate nodes. */}
              <Animated.View style={[styles.sendPress, sendAnim.animStyle]}>
                <Animated.View style={[styles.sendButton, { backgroundColor: sendFill }]}>
                  <Animated.View style={[styles.glyphLayer, { opacity: restingGlyphOpacity }]}>
                    <ArrowUp size={19} color={colors.ink2} strokeWidth={2.5} />
                  </Animated.View>
                  <Animated.View style={[styles.glyphLayer, { opacity: armAnim }]}>
                    {streaming ? (
                      <Square
                        size={13}
                        color={colors.onAccentBtn}
                        fill={colors.onAccentBtn}
                        strokeWidth={2}
                      />
                    ) : (
                      <ArrowUp size={19} color={colors.onAccentBtn} strokeWidth={2.5} />
                    )}
                  </Animated.View>
                </Animated.View>
              </Animated.View>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  inputBar: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    backgroundColor: colors.bg,
  },
  shell: {
    borderWidth: 1,
    // 24 outer − 6 padding = 18, exactly the radius of the wells inside, so the
    // tray's corners stay concentric with its controls.
    borderRadius: 24,
    paddingTop: space.lg,
    paddingHorizontal: 6,
    paddingBottom: 6,
    backgroundColor: colors.surface,
  },
  textField: {
    ...typography.body,
    minHeight: COMPOSER_MIN_HEIGHT,
    maxHeight: COMPOSER_MAX_HEIGHT,
    color: colors.ink,
    textAlign: 'left',
    // Vertical padding has to stay at zero: it feeds back into the measured
    // content height and makes the field resize against itself.
    padding: 0,
    paddingLeft: space.sm,
    paddingRight: space.sm,
    includeFontPadding: false,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.md,
  },
  controlsLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  controlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },

  // Recessed control: one tonal step below the page, inside a shell one step
  // above it. Depth without a shadow.
  well: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: CONTROL_SIZE / 2,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A well lifts toward the shell when pressed or live. It stops short of the
  // send button's tone so the two never read as the same state.
  wellActive: {
    backgroundColor: colors.hover,
  },
  controlDisabled: {
    opacity: 0.36,
  },

  modelPill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: CONTROL_SIZE,
    paddingLeft: space.sm,
    paddingRight: 10,
    borderRadius: CONTROL_SIZE / 2,
    backgroundColor: colors.bg,
  },
  modelPillNoMark: {
    paddingLeft: space.md,
  },
  modelPillText: {
    ...typography.small,
    flexShrink: 1,
    color: colors.ink2,
  },

  sendPress: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
  },
  sendButton: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    borderRadius: CONTROL_SIZE / 2,
  },
  // Both glyphs occupy the same circle and cross-fade, so the arrow lands as
  // the button lights rather than snapping colour mid-fill.
  glyphLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dictationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
  },
  dictationText: {
    ...typography.caption,
    flex: 1,
    color: colors.ink2,
  },
  dictationError: {
    color: colors.error,
  },
  listeningBars: {
    height: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  listeningBar: {
    width: 2,
    height: 11,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});
