/**
 * Full-screen markdown reader (MD File design, frame 2). Slides up over the
 * thread; dismisses with the header chevron. Header carries the file name +
 * meta and download / more actions; the footer offers Copy (clipboard) and
 * Download (writes the file and opens the share sheet — Save to Files etc.).
 *
 * Driven by `file`: a non-null value opens it, null animates it closed.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, MoreVertical, Download, Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import { colors, radius, space, typography } from '../../theme';
import { MarkdownDoc } from './markdownDoc';
import type { MarkdownFile } from './types';

/** Write the file to the cache and open the OS share sheet. Best-effort. */
async function shareFile(file: MarkdownFile): Promise<void> {
  try {
    const out = new File(Paths.cache, file.name);
    out.create({ overwrite: true });
    out.write(file.source);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(out.uri, {
        mimeType: 'text/markdown',
        UTI: 'net.daringfireball.markdown',
        dialogTitle: file.name,
      });
    }
  } catch {
    // best-effort — a failed/cancelled share shouldn't surface an error
  }
}

function IconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
    >
      {children}
    </Pressable>
  );
}

export function MdReader({
  file,
  onClose,
}: {
  file: MarkdownFile | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));

  // Keep the last file mounted through the close animation, then unmount.
  const [shown, setShown] = useState<MarkdownFile | null>(file);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (file) {
      setShown(file);
      setCopied(false);
      Animated.timing(progress, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: 210,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShown(null);
      });
    }
  }, [file, progress]);

  const onCopy = useCallback(() => {
    if (!shown) return;
    Clipboard.setStringAsync(shown.source).catch(() => {});
    Haptics.selectionAsync().catch(() => {});
    setCopied(true);
  }, [shown]);

  // Clear the "Copied" affordance shortly after it shows.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const onDownload = useCallback(() => {
    if (!shown) return;
    Haptics.selectionAsync().catch(() => {});
    shareFile(shown);
  }, [shown]);

  if (!shown) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  return (
    <Animated.View
      style={[styles.panel, { transform: [{ translateY }] }]}
      // The thread sits behind; this cover owns all touches while open.
    >
      {/* header */}
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <IconButton label="Close" onPress={onClose}>
          <ChevronDown size={22} color={colors.muted} strokeWidth={1.9} />
        </IconButton>
        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={1}>
            {shown.name}
          </Text>
          <Text style={styles.meta}>Markdown · {shown.sizeLabel}</Text>
        </View>
        <IconButton label="Download" onPress={onDownload}>
          <Download size={19} color={colors.muted} strokeWidth={1.7} />
        </IconButton>
        <IconButton label="More options" onPress={onDownload}>
          <MoreVertical size={19} color={colors.muted} strokeWidth={1.7} />
        </IconButton>
      </View>

      {/* document */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <MarkdownDoc source={shown.source} />
      </ScrollView>

      {/* footer actions */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Pressable
          onPress={onCopy}
          accessibilityRole="button"
          accessibilityLabel="Copy markdown"
          style={({ pressed }) => [styles.action, styles.copy, pressed && styles.copyPressed]}
        >
          {copied ? (
            <Check size={15} color={colors.ink} strokeWidth={2} />
          ) : (
            <Copy size={15} color={colors.ink} strokeWidth={1.6} />
          )}
          <Text style={styles.copyLabel}>{copied ? 'Copied' : 'Copy'}</Text>
        </Pressable>

        <Pressable
          onPress={onDownload}
          accessibilityRole="button"
          accessibilityLabel="Download file"
          style={({ pressed }) => [styles.action, styles.download, pressed && styles.downloadPressed]}
        >
          <Download size={15} color={colors.onAccentBtn} strokeWidth={1.8} />
          <Text style={styles.downloadLabel}>Download</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },

  // header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.sm + 2,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.code,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    backgroundColor: colors.surface,
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  title: {
    ...typography.small,
    fontWeight: '600',
    color: colors.ink,
    lineHeight: 18,
  },
  meta: {
    ...typography.caption,
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },

  // document body
  body: {
    paddingHorizontal: space.lg + 2,
    paddingTop: space.lg + 4,
    paddingBottom: space.xl,
  },

  // footer
  footer: {
    flexDirection: 'row',
    gap: space.sm + 2,
    paddingHorizontal: space.lg,
    paddingTop: space.md - 1,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  action: {
    flex: 1,
    height: 44,
    borderRadius: radius.input - 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm - 1,
  },
  copy: {
    borderWidth: 1,
    borderColor: colors.line,
  },
  copyPressed: {
    backgroundColor: colors.surface,
    borderColor: colors.lineFocus,
  },
  copyLabel: {
    ...typography.small,
    fontWeight: '500',
    color: colors.ink,
  },
  download: {
    backgroundColor: colors.ink,
  },
  downloadPressed: {
    opacity: 0.9,
  },
  downloadLabel: {
    ...typography.small,
    fontWeight: '600',
    color: colors.onAccentBtn,
  },
});
