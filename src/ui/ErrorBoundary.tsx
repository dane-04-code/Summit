/**
 * Root error boundary. A render crash anywhere below this shows a calm
 * recovery screen instead of a dead white app — and reports itself, since a
 * render failure is precisely the kind of thing we'd otherwise never see.
 *
 * Error boundaries must be class components; there is no hook equivalent.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { colors, space, radius, typography, screenPadding } from '@/theme';
import { captureError } from '@/lib/errorReporting';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    captureError(error, { where: 'render', fatal: true });
  }

  private reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The app hit an unexpected error. Your chats are safe.
        </Text>
        <Pressable style={styles.button} onPress={this.reset} accessibilityRole="button">
          <Text style={styles.buttonLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: screenPadding,
  },
  title: {
    ...typography.h,
    color: colors.ink,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
    marginTop: space.sm,
    marginBottom: space.xl,
    maxWidth: 320,
  },
  button: {
    backgroundColor: colors.ink,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.control,
  },
  buttonLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.onAccentBtn,
  },
});
