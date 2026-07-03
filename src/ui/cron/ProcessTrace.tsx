/**
 * The live process trace: a vertical rail of trace nodes, one per step. Each
 * node's colour/shape comes from `stepStyle`; the running node animates a halo
 * ring (the design's `amRing`). Steps are derived from the run's tool events —
 * available only while a run streams live (Hermes doesn't persist them).
 */

import React from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';

import { colors, space, typography } from '../../theme';
import { usePulse } from './StatusDot';
import { stepStyle, type CronStep } from './types';

const RAIL_WIDTH = 18;
const LINE_WIDTH = 2;

// ── Rail node (the dot on the timeline) ─────────────────────────────────────

function RailNode({
  nodeBg,
  nodeBorder,
  nodeSize,
  showCheck,
  pulse,
  isLast,
}: {
  nodeBg: string;
  nodeBorder: string;
  nodeSize: number;
  showCheck: boolean;
  pulse: boolean;
  /** Last step: stop the connecting line at the node instead of running on. */
  isLast: boolean;
}) {
  const v = usePulse(pulse);
  const ringStyle = {
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
  };

  return (
    <View style={styles.rail}>
      <View style={[styles.line, isLast ? styles.lineStub : styles.lineFull]} />
      <View style={styles.nodeWrap}>
        {pulse && (
          <Animated.View
            style={[
              styles.ring,
              { width: nodeSize, height: nodeSize, borderRadius: nodeSize / 2 },
              ringStyle,
            ]}
          />
        )}
        <View
          style={[
            styles.node,
            {
              width: nodeSize,
              height: nodeSize,
              borderRadius: nodeSize / 2,
              backgroundColor: nodeBg,
              borderColor: nodeBorder,
            },
          ]}
        >
          {showCheck && <Check size={9} color={colors.bg} strokeWidth={3} />}
        </View>
      </View>
    </View>
  );
}

// ── One step row ────────────────────────────────────────────────────────────

function StepRow({ step, isLast }: { step: CronStep; isLast: boolean }) {
  const s = stepStyle(step.kind);

  return (
    <View style={styles.row}>
      <RailNode
        nodeBg={s.nodeBg}
        nodeBorder={s.nodeBorder}
        nodeSize={s.nodeSize}
        showCheck={s.showCheck}
        pulse={s.pulse}
        isLast={isLast}
      />

      <View style={[styles.cardCol, isLast && styles.cardColLast]}>
        <View style={[styles.card, { backgroundColor: s.cardBg, borderColor: s.cardBorder }]}>
          <View style={styles.titleRow}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            {step.dur ? <Text style={styles.dur}>{step.dur}</Text> : null}
          </View>

          {step.call ? (
            <View style={styles.callBox}>
              <Text style={styles.callTag}>{step.callTag ?? 'CALL'}</Text>
              <Text style={styles.call} numberOfLines={1}>
                {step.call}
              </Text>
            </View>
          ) : null}

          {step.error ? <Text style={styles.error}>{step.error}</Text> : null}
        </View>
      </View>
    </View>
  );
}

export function ProcessTrace({ steps }: { steps: CronStep[] }) {
  return (
    <View>
      {steps.map((step, i) => (
        <StepRow key={i} step={step} isLast={i === steps.length - 1} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.md + 2,
  },

  // rail
  rail: {
    width: RAIL_WIDTH,
    flexShrink: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    position: 'relative',
  },
  line: {
    position: 'absolute',
    left: (RAIL_WIDTH - LINE_WIDTH) / 2,
    width: LINE_WIDTH,
    backgroundColor: colors.surface2,
  },
  lineFull: {
    top: 0,
    bottom: 0,
  },
  lineStub: {
    top: 0,
    height: 21, // reaches the node centre, then stops
  },
  nodeWrap: {
    marginTop: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  node: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    backgroundColor: colors.accent,
  },

  // step card
  cardCol: {
    flex: 1,
    minWidth: 0,
    paddingBottom: space.lg + 2,
  },
  cardColLast: {
    paddingBottom: 0,
  },
  card: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: space.md + 1,
    paddingVertical: space.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  stepTitle: {
    ...typography.small,
    fontWeight: '600',
    lineHeight: 19,
    color: colors.ink,
    flex: 1,
    minWidth: 0,
  },
  dur: {
    fontSize: 12,
    color: colors.faint,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },

  // call box
  callBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: 9,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.surface2,
    borderRadius: 8,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 7,
  },
  callTag: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    flexShrink: 0,
  },
  call: {
    ...typography.mono,
    fontSize: 13,
    color: colors.ink2,
    flex: 1,
  },
  error: {
    ...typography.mono,
    fontSize: 12,
    color: colors.error,
    lineHeight: 17,
    marginTop: 9,
  },
});
