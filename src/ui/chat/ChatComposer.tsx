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
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowUp, Mic, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

import { colors, radius, space, typography } from '@/theme';
import { usePressAnim } from '@/ui/usePressAnim';
import {
  COMPOSER_MAX_HEIGHT,
  COMPOSER_MIN_HEIGHT,
  composerHeightFor,
} from '@/ui/chat/composerHeight';

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

type ChatComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  bottomInset: number;
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
}: ChatComposerProps, ref) {
  const [height, setHeight] = useState(COMPOSER_MIN_HEIGHT);
  const [listening, setListening] = useState(false);
  const [dictationNote, setDictationNote] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const valueRef = useRef(value);
  const dictationPrefixRef = useRef('');
  const sendAnim = usePressAnim({ scale: 0.9 });
  const micAnim = usePressAnim({ scale: 0.9 });
  const [focusAnim] = useState(() => new Animated.Value(0));

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  useEffect(() => {
    valueRef.current = value;
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

  const canSend = value.trim().length > 0 && !streaming;
  const displayedHeight = height;
  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.line, colors.lineFocus],
  });

  return (
    <View style={[styles.inputBar, { paddingBottom: Math.max(bottomInset, space.md) }]}>
      <Animated.View style={[styles.shell, { borderColor }]}>
        {listening || dictationNote ? (
          <View style={styles.dictationStatus} accessibilityLiveRegion="polite">
            {listening ? <ListeningBars /> : <Mic size={13} color={colors.error} strokeWidth={2} />}
            <Text style={[styles.dictationText, dictationNote && styles.dictationError]}>
              {listening ? 'Listening — tap the microphone when finished' : dictationNote}
            </Text>
          </View>
        ) : null}

        <View style={styles.row}>
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
            scrollEnabled={displayedHeight >= COMPOSER_MAX_HEIGHT}
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
            // Keep the resting prompt centred beside the controls. Once the
            // message wraps and genuinely grows, switch to top alignment so
            // the first line stays anchored as the field expands downward.
            textAlignVertical={
              displayedHeight === COMPOSER_MIN_HEIGHT ? 'center' : 'top'
            }
            accessibilityLabel="Message input"
          />

          <Pressable
            style={styles.control}
            onPress={toggleDictation}
            onPressIn={micAnim.onPressIn}
            onPressOut={micAnim.onPressOut}
            disabled={streaming}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Stop dictation' : 'Dictate message'}
            accessibilityState={{ disabled: streaming, selected: listening }}
          >
            <Animated.View
              style={[
                styles.iconButton,
                micAnim.animStyle,
                listening && styles.micButtonActive,
                streaming && styles.controlDisabled,
              ]}
            >
              {listening ? <ListeningBars /> : <Mic size={19} color={colors.ink2} strokeWidth={2} />}
            </Animated.View>
          </Pressable>

          <Pressable
            style={styles.control}
            onPress={streaming ? onStop : onSend}
            onPressIn={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              sendAnim.onPressIn();
            }}
            onPressOut={sendAnim.onPressOut}
            disabled={!streaming && !canSend}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={streaming ? 'Stop reply' : 'Send message'}
            accessibilityState={{ disabled: !streaming && !canSend }}
          >
            <Animated.View
              style={[
                styles.sendButton,
                sendAnim.animStyle,
                !streaming && !canSend && styles.controlDisabled,
              ]}
            >
              {streaming ? (
                <Square size={13} color={colors.onAccentBtn} fill={colors.onAccentBtn} strokeWidth={2} />
              ) : (
                <ArrowUp size={19} color={colors.onAccentBtn} strokeWidth={2.5} />
              )}
            </Animated.View>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  inputBar: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    backgroundColor: colors.bg,
  },
  shell: {
    borderWidth: 1,
    borderRadius: 20,
    paddingLeft: space.md + 2,
    paddingRight: 5,
    paddingVertical: 5,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  textField: {
    ...typography.body,
    flex: 1,
    minWidth: 0,
    minHeight: COMPOSER_MIN_HEIGHT,
    maxHeight: COMPOSER_MAX_HEIGHT,
    color: colors.ink,
    textAlign: 'left',
    padding: 0,
    includeFontPadding: false,
  },
  control: {
    alignSelf: 'flex-end',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.control + 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.accentLine,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDisabled: {
    opacity: 0.36,
  },
  dictationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 25,
    paddingTop: 3,
    paddingBottom: 2,
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
