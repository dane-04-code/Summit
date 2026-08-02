/**
 * Deciding whether the chat screen should honour a notification's session id.
 *
 * The tap is a route param, and a route param outlives the tap: it survives
 * re-renders and agent switches. Without a per-tap marker, a manual switch to
 * another agent would be dragged straight back to the notification's agent —
 * and with a naive "consume by session id", a second push for that same thread
 * would then be ignored. So each tap carries a nonce, and the screen consumes
 * the tap, not the session.
 */

export type PushRouteParams = {
  sessionId?: string | string[];
  /** Per-tap nonce set by the notification handler in `src/app/_layout.tsx`. */
  n?: string | string[];
};

export type PendingPush = {
  sessionId: string;
  /** Opaque marker to store once the tap has been acted on. */
  tap: string;
};

const first = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' ? value : Array.isArray(value) ? (value[0] ?? null) : null;

/**
 * The tap still waiting to be honoured, or null when there is none (no param,
 * or this exact tap was already consumed).
 */
export function pendingPush(params: PushRouteParams, consumedTap: string | null): PendingPush | null {
  const sessionId = first(params.sessionId);
  if (!sessionId) return null;
  const tap = `${first(params.n) ?? ''}:${sessionId}`;
  if (tap === consumedTap) return null;
  return { sessionId, tap };
}
