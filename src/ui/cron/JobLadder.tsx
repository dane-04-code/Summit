/**
 * Static composition ladder — the parts a cron job is made of
 * (trigger → context → task → deliver), drawn from its stored definition by
 * `jobLadder()`. Unlike `ProcessTrace` this is calm: no live state, no
 * animation. It shares the rail visual (line + node) but nothing else.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { colors, space, typography } from '../../theme';
import type { LadderNode } from './types';

const RAIL_WIDTH = 18;
const LINE_WIDTH = 2;
const NODE_SIZE = 12;

function Rail({ isLast }: { isLast: boolean }) {
  return (
    <View style={styles.rail}>
      <View style={[styles.line, isLast ? styles.lineStub : styles.lineFull]} />
      <View style={styles.node} />
    </View>
  );
}

function LadderRow({ node, isLast }: { node: LadderNode; isLast: boolean }) {
  return (
    <View style={styles.row}>
      <Rail isLast={isLast} />
      <View style={[styles.content, isLast && styles.contentLast]}>
        <Text style={styles.title}>{node.title}</Text>
        <Text style={styles.detail}>{node.detail}</Text>
        {node.skills && node.skills.length > 0 ? (
          <View style={styles.chips}>
            {node.skills.map((skill) => (
              <View key={skill} style={styles.chip}>
                <Text style={styles.chipText}>{skill}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function JobLadder({ nodes }: { nodes: LadderNode[] }) {
  return (
    <View>
      {nodes.map((node, i) => (
        <LadderRow key={i} node={node} isLast={i === nodes.length - 1} />
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
    position: 'relative',
  },
  line: {
    position: 'absolute',
    left: (RAIL_WIDTH - LINE_WIDTH) / 2,
    width: LINE_WIDTH,
    backgroundColor: colors.surface2,
  },
  lineFull: { top: 0, bottom: 0 },
  lineStub: { top: 0, height: 10 }, // reaches the node centre, then stops
  node: {
    marginTop: 4,
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.faint,
  },

  // content
  content: {
    flex: 1,
    minWidth: 0,
    paddingBottom: space.lg + 2,
  },
  contentLast: { paddingBottom: 0 },
  title: {
    ...typography.caption,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  detail: {
    ...typography.small,
    color: colors.ink,
    marginTop: 2,
  },

  // skill chips (task node only)
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.sm,
  },
  chip: {
    backgroundColor: colors.surface2,
    borderRadius: 9999,
    paddingHorizontal: space.md - 2,
    paddingVertical: 4,
  },
  chipText: {
    ...typography.caption,
    color: colors.ink,
  },
});
