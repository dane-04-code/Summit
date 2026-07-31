/** App-side relay protocol types. Mirror of /protocol/protocol.ts — keep in sync. */

/** Connector feature flags, negotiated at hello and echoed on pair. Absent
 *  means an older connector — the app keeps that feature's UI dark. */
export type ConnectorCapability = 'model_picker';
export type HelloFrame      = { t: 'hello'; framework: string; agentName: string; agentVersion: string; capabilities?: ConnectorCapability[] };
export type CodeFrame       = { t: 'code'; code: string; connectorToken: string };
export type PairFrame       = { t: 'pair'; code: string };
export type ResumeFrame     = { t: 'resume'; token: string };
export type PairedFrame     = { t: 'paired'; framework: string; agentName: string; agentVersion: string; sessionToken: string; capabilities?: ConnectorCapability[] };
export type PairErrorFrame  = { t: 'pair_error'; reason: 'not_found' | 'expired' | 'already_paired' | 'locked' };
export type PeerGoneFrame   = { t: 'peer_gone' };
/** Client-local sentinel; never sent over the relay protocol. */
export type SocketClosedFrame = { t: 'socket_closed' };
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
// Allow-listed REST proxy over the relay (jobs, run approval/stop). `body` is a
// JSON string. The connector enforces which method+path pairs are permitted.
export type ApiReqFrame     = { t: 'api_req'; reqId: string; method: string; path: string; body?: string };
export type ApiResFrame     = { t: 'api_res'; reqId: string; status: number; body: string };
// Push notifications. `register_push` (app → relay) stores the device's Expo
// push token in the pairing channel. `notify` (connector → relay) is the
// agent-initiated nudge: pushed to the phone when the app is away, forwarded
// as a frame when it's connected.
export type NotificationMode = 'all' | 'attention' | 'off';
export type RegisterPushFrame = { t: 'register_push'; token?: string; mode: NotificationMode };
export type NotifyFrame       = { t: 'notify'; title?: string; body?: string };
// Push approvals (OpenClaw): the connector forwards Gateway-pushed exec
// approvals as `approval_req`; the app answers with `approval_resolve`.
// Hermes approvals stay on the api_req REST proxy.
export type ApprovalReqFrame     = { t: 'approval_req'; approvalId: string; command: string };
export type ApprovalResolveFrame = { t: 'approval_resolve'; approvalId: string; decision: 'approve' | 'deny' };
// Native model picker. The connector asks Hermes for its own `/model` picker
// payload — only providers the host has credentials for — and routes the pick
// back through Hermes' switch callback. Failures come back as `error`.
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
  | HelloFrame | CodeFrame | PairFrame | ResumeFrame | PairedFrame | PairErrorFrame
  | PeerGoneFrame | SocketClosedFrame | PingFrame | PongFrame | ChatFrame | ChunkFrame | ActivityFrame | DoneFrame | ErrorFrame
  | SyncReqFrame | SyncReplyFrame | SyncDoneFrame | AckRepliesFrame
  | ApiReqFrame | ApiResFrame | RegisterPushFrame | NotifyFrame
  | ApprovalReqFrame | ApprovalResolveFrame
  | ModelsReqFrame | ModelsFrame | ModelSelectFrame | ModelResultFrame;
