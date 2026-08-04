/**
 * The quoted-reply strip — one line of frozen context attached to a message.
 *
 * Two placements, one shape: a thin vertical rule, who was quoted, and a single
 * collapsed line of what they said. The rule is the whole container — no box,
 * no fill, no border around it, per the dark-space rule.
 *
 * The tones differ because the states differ. In the composer the strip is the
 * live thing you are about to act on, so its rule and label take the accent. In
 * the thread it is settled history and drops to grey, which also keeps the one
 * accent from repeating down the whole conversation.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

import { colors, space, typography } from '../../theme';
import type { ReplyRef } from './types';

/** 44pt of touch on a 28pt glyph, without crowding the field above it. */
const DISMISS_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 8 } as const;

/**
 * Chat rows carry no name labels anywhere else in the app — a quote is the one
 * place attribution is load-bearing, since "you said" and "it said" are the
 * difference between two readings of the same reply.
 */
export function replyAuthorLabel(reply: ReplyRef, agentName: string): string {
  return reply.author === 'user' ? 'You' : agentName;
}

/** The settled quote above a message in the thread. */
export function QuotedReply({ reply, agentName }: { reply: ReplyRef; agentName: string }) {
  const author = replyAuthorLabel(reply, agentName);
  return (
    <View style={styles.thread} accessibilityLabel={`Replying to ${author}: ${reply.preview}`}>
      <View style={styles.threadRule} />
      <View style={styles.body}>
        <Text style={styles.threadAuthor}>{author}</Text>
        <Text style={styles.threadPreview} numberOfLines={1}>
          {reply.preview}
        </Text>
      </View>
    </View>
  );
}

/** The live quote attached to the composer while a reply is being written. */
export function ComposerQuotedReply({
  reply,
  agentName,
  onDismiss,
}: {
  reply: ReplyRef;
  agentName: string;
  onDismiss: () => void;
}) {
  const author = replyAuthorLabel(reply, agentName);
  return (
    <View style={styles.composer}>
      <View style={styles.composerRule} />
      <View style={styles.body}>
        <Text style={styles.composerAuthor}>Replying to {author}</Text>
        <Text style={styles.composerPreview} numberOfLines={1}>
          {reply.preview}
        </Text>
      </View>
      <Pressable
        onPress={onDismiss}
        hitSlop={DISMISS_HIT_SLOP}
        style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
        accessibilityRole="button"
        accessibilityLabel="Cancel reply"
      >
        <X size={15} color={colors.muted} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const RULE_WIDTH = 2;

const styles = StyleSheet.create({
  thread: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.sm,
  },
  // The rule stretches to the text it marks rather than taking a fixed height,
  // so a one-line quote reads as tight as it is.
  threadRule: {
    width: RULE_WIDTH,
    borderRadius: RULE_WIDTH,
    backgroundColor: colors.faint,
  },
  // The two caption lines already carry their own leading; this is a hairline
  // nudge to keep them from reading as a single wrapped line, not a spacing step.
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  threadAuthor: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.muted,
  },
  threadPreview: {
    ...typography.caption,
    color: colors.faint,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.sm,
    paddingRight: space.xs,
    paddingBottom: space.md,
  },
  composerRule: {
    alignSelf: 'stretch',
    width: RULE_WIDTH,
    borderRadius: RULE_WIDTH,
    backgroundColor: colors.accent,
  },
  composerAuthor: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.accent,
  },
  composerPreview: {
    ...typography.caption,
    color: colors.ink2,
  },
  dismiss: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissPressed: {
    backgroundColor: colors.hover,
  },
});
