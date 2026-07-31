/**
 * The model sheet: a bottom sheet listing what the connected agent will
 * actually switch to, grouped by provider.
 *
 * Presentational only. The list, the current selection and the outcome of a
 * switch all come from the host through `useModelPicker` — this file decides
 * nothing about models, it only renders and reports taps.
 */

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { colors, radius, space, typography } from '@/theme';
import type { ModelScope } from '@/agents/adapters/types';
import type { ModelPicker } from './useModelPicker';
import { ProviderMark } from './providerMarks';

const SCOPES: { value: ModelScope; label: string; hint: string }[] = [
  { value: 'session', label: 'This chat', hint: 'Only this thread switches.' },
  { value: 'default', label: 'Default', hint: 'Saved on the agent for every chat.' },
];

/** Model ids arrive vendor-prefixed (`anthropic/claude-opus-5`); the provider
 *  row already says who made it, so the row shows only the distinctive part. */
export function shortModelName(model: string): string {
  const tail = model.split('/').pop() ?? model;
  return tail.trim() || model;
}

export function ModelPickerSheet({ picker }: { picker: ModelPicker }) {
  const { catalogue, currentModel } = picker;

  const providers = useMemo(() => {
    if (!catalogue) return [];
    // Whichever provider is serving the current model leads the list — it is
    // the one the user is reasoning about when they open the sheet.
    return [...catalogue.providers].sort(
      (a, b) => Number(b.isCurrent) - Number(a.isCurrent),
    );
  }, [catalogue]);

  const active = currentModel ?? catalogue?.currentModel ?? null;

  return (
    <Modal
      visible={picker.open}
      transparent
      animationType="slide"
      onRequestClose={picker.closePicker}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.scrim}
          onPress={picker.closePicker}
          accessibilityRole="button"
          accessibilityLabel="Close model picker"
        />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Model</Text>

          <View style={styles.scopeRow}>
            {SCOPES.map((scope) => {
              const selected = picker.scope === scope.value;
              return (
                <Pressable
                  key={scope.value}
                  onPress={() => {
                    if (selected) return;
                    Haptics.selectionAsync().catch(() => {});
                    picker.chooseScope(scope.value);
                  }}
                  style={[styles.scopeTab, selected && styles.scopeTabOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${scope.label} — ${scope.hint}`}
                >
                  <Text style={[styles.scopeText, selected && styles.scopeTextOn]}>
                    {scope.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.scopeHint}>
            {SCOPES.find((scope) => scope.value === picker.scope)?.hint}
          </Text>

          {picker.error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{picker.error}</Text>
            </View>
          ) : null}

          {picker.loading && !catalogue ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.muted} />
              <Text style={styles.centeredText}>Asking your agent…</Text>
            </View>
          ) : null}

          {!picker.loading && catalogue && providers.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.centeredText}>
                This agent has no switchable providers configured.
              </Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {providers.map((provider) => (
              <View key={provider.slug} style={styles.group}>
                <View style={styles.groupHeader}>
                  <ProviderMark slug={provider.slug} name={provider.name} />
                  <Text style={styles.groupName}>{provider.name}</Text>
                </View>
                {provider.models.map((model) => {
                  const selected = model === active;
                  const busy = picker.pending === model;
                  return (
                    <Pressable
                      key={`${provider.slug}:${model}`}
                      onPress={() => {
                        if (selected || picker.pending) return;
                        Haptics.selectionAsync().catch(() => {});
                        picker.chooseModel(provider.slug, model);
                      }}
                      disabled={picker.pending !== null}
                      style={({ pressed }) => [
                        styles.modelRow,
                        pressed && styles.modelRowPressed,
                        picker.pending !== null && !busy && styles.modelRowMuted,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: picker.pending !== null }}
                      accessibilityLabel={`${shortModelName(model)} from ${provider.name}`}
                    >
                      <Text
                        style={[styles.modelName, selected && styles.modelNameOn]}
                        numberOfLines={1}
                      >
                        {shortModelName(model)}
                      </Text>
                      {busy ? <ActivityIndicator size="small" color={colors.muted} /> : null}
                      {selected && !busy ? (
                        <Check size={16} color={colors.accent} strokeWidth={2.4} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
    opacity: 0.55,
  },
  sheet: {
    maxHeight: '78%',
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    marginTop: space.md,
    borderRadius: 2,
    backgroundColor: colors.line,
  },
  title: {
    ...typography.h,
    marginTop: space.lg,
    color: colors.ink,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: space.xs,
    marginTop: space.md,
    padding: 3,
    borderRadius: radius.control + 2,
    backgroundColor: colors.surface2,
  },
  scopeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.control,
  },
  scopeTabOn: {
    backgroundColor: colors.raised,
  },
  scopeText: {
    ...typography.small,
    color: colors.muted,
  },
  scopeTextOn: {
    color: colors.ink,
    fontWeight: '600',
  },
  scopeHint: {
    ...typography.caption,
    marginTop: space.sm,
    color: colors.faint,
  },
  errorBox: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.errorLine,
    backgroundColor: colors.errorSurface,
  },
  errorText: {
    ...typography.small,
    color: colors.error,
  },
  centered: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xl,
  },
  centeredText: {
    ...typography.small,
    textAlign: 'center',
    color: colors.muted,
  },
  list: {
    marginTop: space.md,
  },
  listContent: {
    paddingBottom: space.lg,
  },
  group: {
    marginBottom: space.lg,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xs,
  },
  groupName: {
    ...typography.small,
    fontWeight: '600',
    color: colors.ink2,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md - 1,
    paddingHorizontal: space.sm,
    borderRadius: radius.control,
  },
  modelRowPressed: {
    backgroundColor: colors.hover,
  },
  modelRowMuted: {
    opacity: 0.4,
  },
  modelName: {
    ...typography.body,
    flex: 1,
    color: colors.ink2,
  },
  modelNameOn: {
    color: colors.ink,
    fontWeight: '600',
  },
});
