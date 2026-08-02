/** Canonical relay protocol frame types. Relay imports from here directly. */

/** Optional connector feature flags, negotiated at hello and echoed on pair.
 *  Absent means an older connector — the app must keep the feature's UI dark.
 *  `code_rotation`: this connector honours `expiresAt` on the code frame and
 *  will fetch a fresh code when the window closes. Relays give connectors
 *  without it the old, longer code TTL, since they would otherwise strand the
 *  user on a dead code until they restarted it by hand. */
export type ConnectorCapability = 'model_picker' | 'code_rotation';
/** Which agent-side process sent this hello: the Go connector (fallback/compat) or
 *  a native framework plugin. Absent means an older connector — treat as 'connector'. */
export type ConnectionVia   = 'connector' | 'plugin';
export type HelloFrame      = { t: 'hello'; framework: string; agentName: string; agentVersion: string; capabilities?: ConnectorCapability[]; via?: ConnectionVia };
/** `expiresAt` (epoch ms) is when this code stops being pairable; absent means
 *  the relay is not asking for rotation. `paired` marks a channel that is
 *  already claimed, so the connector shows a status line instead of reprinting
 *  a code that can never be used again. */
export type CodeFrame       = { t: 'code'; code: string; connectorToken: string; expiresAt?: number; paired?: boolean };
/** Relay → connector once a phone has claimed the channel: stop the rotation
 *  timer, the code's job is done. */
export type PairOkFrame     = { t: 'pair_ok' };
export type PairFrame       = { t: 'pair'; code: string };
// Reconnect with the durable session token issued at pair time — the code is
// single-use and short-lived, so the token (not the code) is the credential
// the app keeps.
export type ResumeFrame     = { t: 'resume'; token: string };
export type PairedFrame     = { t: 'paired'; framework: string; agentName: string; agentVersion: string; sessionToken: string; capabilities?: ConnectorCapability[]; via?: ConnectionVia };
export type PairErrorFrame  = { t: 'pair_error'; reason: 'not_found' | 'expired' | 'already_paired' | 'locked' };
export type PeerGoneFrame   = { t: 'peer_gone' };
export type PingFrame       = { t: 'ping' };
export type PongFrame       = { t: 'pong' };
export type ChatMessage     = { role: 'user' | 'assistant' | 'system'; content: string };
export type ChatFrame       = { t: 'chat'; reqId: string; messages: ChatMessage[]; sessionId?: string; sessionKey?: string };
export type ChunkFrame      = { t: 'chunk'; reqId: string; delta: string; sessionId?: string };
/** Ephemeral operational status. Never persisted or included in notifications. */
export type ActivityFrame   = { t: 'activity'; reqId: string; label: string; sessionId?: string };
/** `content` is optional authoritative final text for transports that can revise drafts. */
export type DoneFrame       = { t: 'done'; reqId: string; sessionId?: string; eventId?: string; content?: string };
export type ErrorFrame      = { t: 'error'; reqId?: string; message: string; sessionId?: string; eventId?: string };
// Durable background delivery. The connector keeps settled replies in a
// bounded local outbox until the app has persisted and acknowledged them. The
// relay only forwards these frames; it never stores transcript content.
export type SettledReply = {
  id: string;
  reqId: string;
  sessionId: string;
  status: 'done' | 'error';
  content: string;
  error?: string;
  createdAt: number;
};
export type SyncReqFrame     = { t: 'sync_req'; reqId: string };
export type SyncReplyFrame   = { t: 'sync_reply'; reqId: string; reply: SettledReply };
export type SyncDoneFrame    = { t: 'sync_done'; reqId: string };
export type AckRepliesFrame  = { t: 'ack_replies'; ids: string[] };
// Allow-listed request/response proxy: the app asks the connector to make a
// specific Hermes REST call (jobs, runs approval/stop). The connector enforces
// the allow-list — see connector/hermes.go. `body` is a JSON string.
export type ApiReqFrame     = { t: 'api_req'; reqId: string; method: string; path: string; body?: string };
export type ApiResFrame     = { t: 'api_res'; reqId: string; status: number; body: string };
// Push notifications. `register_push` (app → relay) stores the device's Expo
// push token in the pairing channel. `notify` (connector → relay) is the
// agent-initiated nudge: pushed to the phone when the app is away, forwarded
// as a frame when it's connected.
/** `all` includes completed replies; `attention` is approvals/errors/nudges only. */
export type NotificationMode = 'all' | 'attention' | 'off';
export type RegisterPushFrame = { t: 'register_push'; token?: string; mode: NotificationMode };
export type NotifyFrame       = { t: 'notify'; title?: string; body?: string };
// Push approvals (OpenClaw): the Gateway pushes exec approvals over the
// connector's persistent WS; the connector forwards them as `approval_req`
// and the app answers with `approval_resolve` (approve maps to the Gateway's
// allow-once). Hermes approvals stay on the api_req REST proxy.
export type ApprovalReqFrame     = { t: 'approval_req'; approvalId: string; command: string };
export type ApprovalResolveFrame = { t: 'approval_resolve'; approvalId: string; decision: 'approve' | 'deny' };
// Native model picker. The connector never enumerates or validates models
// itself — it asks Hermes for its own `/model` picker payload and hands back
// whatever Hermes offers, which is only the providers the host has credentials
// for. Selection goes back through Hermes' own switch callback.
/** One provider row exactly as Hermes' picker supplies it. */
export type ModelProvider = {
  slug: string;
  name: string;
  isCurrent: boolean;
  models: string[];
};
/** Where a pick sticks: this thread only, or persisted as the host default. */
export type ModelScope = 'session' | 'default';
export type ModelsReqFrame    = { t: 'models_req'; reqId: string; sessionId: string; scope: ModelScope };
export type ModelsFrame       = { t: 'models'; reqId: string; sessionId?: string; currentModel: string; currentProvider: string; providers: ModelProvider[] };
export type ModelSelectFrame  = { t: 'model_select'; reqId: string; sessionId: string; provider: string; model: string };
export type ModelResultFrame  = { t: 'model_result'; reqId: string; sessionId?: string; model: string; provider: string; message: string };

export type AnyFrame =
  | HelloFrame | CodeFrame | PairOkFrame | PairFrame | ResumeFrame | PairedFrame | PairErrorFrame
  | PeerGoneFrame | PingFrame | PongFrame | ChatFrame | ChunkFrame | ActivityFrame | DoneFrame | ErrorFrame
  | SyncReqFrame | SyncReplyFrame | SyncDoneFrame | AckRepliesFrame
  | ApiReqFrame | ApiResFrame | RegisterPushFrame | NotifyFrame
  | ApprovalReqFrame | ApprovalResolveFrame
  | ModelsReqFrame | ModelsFrame | ModelSelectFrame | ModelResultFrame;
