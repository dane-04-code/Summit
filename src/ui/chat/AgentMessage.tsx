/**
 * Renders a full-width agent reply from its block list (no bubble, per the
 * hybrid message layout). Sub-renderers cover the design's rich content:
 * heading, paragraphs with inline code, a service-status table, a code block
 * with copy, and a tool-status chip.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { colors, radius, space, typography } from '../../theme';
import { MdFileCard } from './MdFileCard';
import { RichMarkdown } from './richMarkdown';
import { ApprovalCommandGrid } from './ApprovalCommandGrid';
import { parseApprovalPrompt, type ApprovalCommand } from './approvalPrompt';
import {
  type AgentBlock,
  type RunState,
  type ServiceRow,
  type Span,
  type CodeLine,
  type MarkdownFile,
  codeToText,
} from './types';

const DOT: Record<RunState, string> = {
  running: colors.accent,
  idle: colors.muted,
  error: colors.error,
};

// ── Inline spans (text + inline code) ───────────────────────────────────────

function Paragraph({
  spans,
  tone = 'default',
}: {
  spans: Span[];
  tone?: 'default' | 'muted' | 'error';
}) {
  return (
    <Text
      style={tone === 'muted' ? styles.textMuted : tone === 'error' ? styles.textError : styles.text}
    >
      {spans.map((s, i) =>
        s.code ? (
          <Text key={i} style={styles.inlineCode}>
            {s.text}
          </Text>
        ) : (
          <Text key={i}>{s.text}</Text>
        ),
      )}
    </Text>
  );
}

// ── Service-status table ────────────────────────────────────────────────────

function StatusTable({ rows }: { rows: ServiceRow[] }) {
  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeadRow]}>
        <Text style={[styles.th, styles.colService]}>Service</Text>
        <Text style={[styles.th, styles.colStatus]}>Status</Text>
        <Text style={[styles.th, styles.colP95, styles.right]}>p95</Text>
      </View>
      {rows.map((r, i) => (
        <View
          key={r.service}
          style={[styles.tableRow, i < rows.length - 1 && styles.tableRowDivider]}
        >
          <Text style={[styles.td, styles.colService]}>{r.service}</Text>
          <View style={[styles.colStatus, styles.statusCell]}>
            <View style={[styles.dot, { backgroundColor: DOT[r.state] }]} />
            <Text style={[styles.td, r.state === 'error' && styles.errorText, r.state === 'idle' && styles.mutedText]}>
              {r.statusLabel}
            </Text>
          </View>
          <Text
            style={[
              styles.td,
              styles.colP95,
              styles.right,
              styles.tabular,
              r.p95 === '—' && styles.mutedText,
            ]}
          >
            {r.p95}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Code block with copy ────────────────────────────────────────────────────

function CodeBlock({ lines }: { lines: CodeLine[] }) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    Clipboard.setStringAsync(codeToText(lines)).catch(() => {});
    Haptics.selectionAsync().catch(() => {});
    setCopied(true);
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [lines]);

  return (
    <View style={styles.code}>
      <Pressable
        onPress={onCopy}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Copy code"
        style={styles.copyBtn}
      >
        <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
      </Pressable>
      {lines.map((line, i) => (
        <Text key={i} style={styles.codeLine}>
          {line.segments.map((seg, j) => (
            <Text key={j} style={seg.tone === 'error' ? styles.errorText : undefined}>
              {seg.text}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}

// ── Tool-status chip ────────────────────────────────────────────────────────

function ToolChip({ state, label }: { state: RunState; label: string }) {
  return (
    <View style={styles.chipWrap}>
      <View style={styles.chip}>
        <View style={[styles.chipDot, { backgroundColor: DOT[state] }]} />
        <Text style={styles.chipLabel}>{label}</Text>
      </View>
    </View>
  );
}

// ── Thought status (safe operational state, never hidden model reasoning) ────

function ThoughtStatus({ label }: { label?: string }) {
  const [pulse] = useState(() => new Animated.Value(0.4));
  const visibleLabel = label?.trim() || 'Thinking…';

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View
      style={styles.thoughtStatus}
      accessibilityLabel={`Agent status: ${visibleLabel}`}
      accessibilityLiveRegion="polite"
    >
      <Animated.View
        style={[styles.thoughtPulse, { opacity: pulse, transform: [{ scale: pulse }] }]}
      />
      <Text style={styles.thoughtLabel}>{visibleLabel}</Text>
    </View>
  );
}

// ── Block dispatcher ────────────────────────────────────────────────────────

export function AgentMessage({
  blocks,
  onOpenFile,
  onApprovalCommand,
  resolvedApprovalCommand,
}: {
  blocks: AgentBlock[];
  onOpenFile?: (file: MarkdownFile) => void;
  onApprovalCommand?: (command: ApprovalCommand) => void;
  resolvedApprovalCommand?: ApprovalCommand;
}) {
  return (
    <View style={styles.message}>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'heading':
            return (
              <Text key={i} style={styles.heading}>
                {block.text}
              </Text>
            );
          case 'text':
            return <Paragraph key={i} spans={block.spans} tone={block.tone} />;
          case 'activity':
            return <ThoughtStatus key={i} label={block.label} />;
          case 'table':
            return <StatusTable key={i} rows={block.rows} />;
          case 'code':
            return <CodeBlock key={i} lines={block.lines} />;
          case 'chip':
            return <ToolChip key={i} state={block.state} label={block.label} />;
          case 'file':
            return (
              <MdFileCard key={i} file={block.file} onOpen={() => onOpenFile?.(block.file)} />
            );
          case 'markdown': {
            if (block.source.trim() === '') return <ThoughtStatus key={i} />;
            const selectApproval = onApprovalCommand;
            if (selectApproval) {
              const approval = parseApprovalPrompt(block.source);
              if (approval) {
                return (
                  <View key={i}>
                    {approval.body ? (
                      <RichMarkdown source={approval.body} onOpenMdFile={onOpenFile} />
                    ) : null}
                    <ApprovalCommandGrid
                      options={approval.options}
                      onSelect={selectApproval}
                      resolvedCommand={resolvedApprovalCommand}
                      command={approval.command}
                    />
                  </View>
                );
              }
            }
            return <RichMarkdown key={i} source={block.source} onOpenMdFile={onOpenFile} />;
          }
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    gap: space.md,
  },

  heading: {
    ...typography.h,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  text: {
    ...typography.body,
    color: colors.ink,
  },
  textMuted: {
    ...typography.small,
    color: colors.muted,
  },
  textError: {
    ...typography.small,
    color: colors.error,
  },
  inlineCode: {
    ...typography.mono,
    fontSize: typography.small.fontSize,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  mutedText: {
    color: colors.muted,
  },
  errorText: {
    color: colors.error,
  },

  // Table
  table: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.code,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md - 1,
  },
  tableHeadRow: {
    paddingVertical: space.sm + 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tableRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  th: {
    ...typography.caption,
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  td: {
    ...typography.small,
    color: colors.ink,
  },
  colService: {
    flex: 1,
  },
  colStatus: {
    width: 96,
  },
  colP95: {
    width: 64,
  },
  right: {
    textAlign: 'right',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  statusCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm - 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  // Code block
  code: {
    backgroundColor: colors.surface,
    borderRadius: radius.code,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md + 1,
  },
  copyBtn: {
    position: 'absolute',
    top: space.sm + 2,
    right: space.md,
    zIndex: 1,
  },
  copyText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.muted,
  },
  codeLine: {
    ...typography.mono,
    color: colors.ink,
  },

  // Thought / operational status
  thoughtStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.sm,
    minHeight: 30,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  thoughtPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  thoughtLabel: {
    ...typography.caption,
    color: colors.ink2,
  },

  // Chip
  chipWrap: {
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 9999,
    paddingVertical: space.xs + 2,
    paddingLeft: space.md - 1,
    paddingRight: space.md + 1,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipLabel: {
    ...typography.caption,
    color: colors.muted,
  },
});
