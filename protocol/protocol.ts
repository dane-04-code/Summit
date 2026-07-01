/** Canonical relay protocol frame types. Relay imports from here directly. */

export type HelloFrame      = { t: 'hello'; framework: string; agentName: string; agentVersion: string };
export type CodeFrame       = { t: 'code'; code: string };
export type PairFrame       = { t: 'pair'; code: string };
export type PairedFrame     = { t: 'paired'; framework: string; agentName: string; agentVersion: string };
export type PairErrorFrame  = { t: 'pair_error'; reason: 'not_found' | 'expired' | 'already_paired' };
export type PeerGoneFrame   = { t: 'peer_gone' };
export type PingFrame       = { t: 'ping' };
export type PongFrame       = { t: 'pong' };
export type ChatMessage     = { role: 'user' | 'assistant' | 'system'; content: string };
export type ChatFrame       = { t: 'chat'; reqId: string; messages: ChatMessage[]; sessionId?: string; sessionKey?: string };
export type ChunkFrame      = { t: 'chunk'; reqId: string; delta: string };
export type DoneFrame       = { t: 'done'; reqId: string };
export type ErrorFrame      = { t: 'error'; reqId?: string; message: string };
// Allow-listed request/response proxy: the app asks the connector to make a
// specific Hermes REST call (jobs, runs approval/stop). The connector enforces
// the allow-list — see connector/hermes.go. `body` is a JSON string.
export type ApiReqFrame     = { t: 'api_req'; reqId: string; method: string; path: string; body?: string };
export type ApiResFrame     = { t: 'api_res'; reqId: string; status: number; body: string };

export type AnyFrame =
  | HelloFrame | CodeFrame | PairFrame | PairedFrame | PairErrorFrame
  | PeerGoneFrame | PingFrame | PongFrame | ChatFrame | ChunkFrame | DoneFrame | ErrorFrame
  | ApiReqFrame | ApiResFrame;
