import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, typography } from '@/theme';

/**
 * Not yet published — github.com/SummitAI-app/Summit-Hermes doesn't have a
 * tagged release. Matches the `hermes plugins install` form documented in
 * docs/PLUGIN_CONNECTION_PLAN.md's stable distribution stage. Update this
 * once a real tag exists.
 */
export const PLUGIN_INSTALL_PROMPT =
  'Install the Summit native plugin and reconnect it to this pairing: hermes plugins install SummitAI-app/Summit-Hermes --enable';

type PluginNudgeBannerProps = {
  onInstall: () => void;
  onDismiss: () => void;
};

/**
 * Nudges connector users toward the native plugin. Fills the composer with
 * the install prompt rather than sending it directly — the send tap stays
 * the user's own action, same as the pairing prompt in pair.tsx.
 */
export function PluginNudgeBanner({ onInstall, onDismiss }: PluginNudgeBannerProps) {
  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.title}>Faster connection available</Text>
        <Text style={styles.body}>
          Hermes now supports a native plugin — skips the separate connector. Early, but working
          well in testing.
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onInstall} style={styles.installButton}>
          <Text style={styles.installText}>Send install prompt to agent</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radius.control,
    backgroundColor: colors.raised,
    padding: space.md,
    gap: space.sm,
  },
  copy: { gap: 2 },
  title: { ...typography.small, color: colors.ink, fontWeight: '500' },
  body: { ...typography.caption, color: colors.ink2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  installButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  installText: { ...typography.caption, color: colors.bg, fontWeight: '600' },
  dismissButton: { paddingHorizontal: space.sm, paddingVertical: space.sm },
  dismissText: { ...typography.caption, color: colors.ink2 },
});
