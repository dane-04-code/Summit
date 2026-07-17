/** App-side relay protocol types. Mirror of /protocol/protocol.ts — keep in sync. */

export type HelloFrame      = { t: 'hello'; framework: string; agentName: string; agentVersion: string };
export type CodeFrame       = { t: 'code'; code: string; connectorToken: string };
export type PairFrame       = { t: 'pair'; code: string };
export type ResumeFrame     = { t: 'resume'; token: string };
export type PairedFrame     = { t: 'paired'; framework: string; agentName: string; agentVersion: string; sessionToken: string };
export type PairErrorFrame  = { t: 'pair_error'; reason: 'not_found' | 'expired' | 'already_paired' | 'locked' };
export type PeerGoneFrame   = { t: 'peer_gone' };
export type PingFrame       = { t: 'ping' };
export type PongFrame       = { t: 'pong' };
export type ChatMessage     = { role: 'user' | 'assistant' | 'system'; content: string };
export type ChatFrame       = { t: 'chat'; reqId: string; messages: ChatMessage[]; sessionId?: string; sessionKey?: string };
export type ChunkFrame      = { t: 'chunk'; reqId: string; delta: string };
export type DoneFrame       = { t: 'done'; reqId: string };
export type ErrorFrame      = { t: 'error'; reqId?: string; message: string };
// Allow-listed REST proxy over the relay (jobs, run approval/stop). `body` is a
// JSON string. The connector enforces which method+path pairs are permitted.
export type ApiReqFrame     = { t: 'api_req'; reqId: string; method: string; path: string; body?: string };
export type ApiResFrame     = { t: 'api_res'; reqId: string; status: number; body: string };
// Push notifications. `register_push` (app → relay) stores the device's Expo
// push token in the pairing channel. `notify` (connector → relay) is the
// agent-initiated nudge: pushed to the phone when the app is away, forwarded
// as a frame when it's connected.
export type RegisterPushFrame = { t: 'register_push'; token: string };
export type NotifyFrame       = { t: 'notify'; title?: string; body?: string };
// Push approvals (OpenClaw): the connector forwards Gateway-pushed exec
// approvals as `approval_req`; the app answers with `approval_resolve`.
// Hermes approvals stay on the api_req REST proxy.
export type ApprovalReqFrame     = { t: 'approval_req'; approvalId: string; command: string };
export type ApprovalResolveFrame = { t: 'approval_resolve'; approvalId: string; decision: 'approve' | 'deny' };

export type AnyFrame =
  | HelloFrame | CodeFrame | PairFrame | ResumeFrame | PairedFrame | PairErrorFrame
  | PeerGoneFrame | PingFrame | PongFrame | ChatFrame | ChunkFrame | DoneFrame | ErrorFrame
  | ApiReqFrame | ApiResFrame | RegisterPushFrame | NotifyFrame
  | ApprovalReqFrame | ApprovalResolveFrame;
