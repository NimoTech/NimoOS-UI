// Drop P2P protocol constants and message shapes: word-for-word aligned with Vue2 Network.js.
// Hard constraint: before P8 strangler flip, old and new pages coexist and interoperate;
// any shape/value changes break compatibility.

export const CHUNK_SIZE = 64000 // 64 KB(Vue2 _chunkSize)
export const MAX_PARTITION_SIZE = 1e6 // 1 MB(Vue2 _maxPartitionSize)
export const PROGRESS_NOTIFY_STEP = 0.01 // only notify peer when progress changes by ≥1%

// A sender that has shipped a partition waits for the peer's acknowledgement.
// Without a bound, a peer that simply vanished leaves the queue wedged for the
// lifetime of the tab.
export const ACK_TIMEOUT_MS = 30000

// A dial that never produces an open data channel. ICE on a LAN settles in
// well under this; anything slower is a peer we cannot reach (blocked UDP
// between the two devices, no TURN configured). Bounding it is what turns a
// silent nothing-happens into a message the user can act on.
export const HANDSHAKE_TIMEOUT_MS = 15000

export interface PeerName {
  model: string // backend UA parsing: desktop | mobile | tablet
  deviceName: string
  displayName: string
}
export interface PeerInfo {
  id: string
  name: PeerName
  rtcSupported: boolean
  offline?: boolean
}

// WS signaling (server → client)
export type ServerMessage =
  | { type: 'peers'; peers: PeerInfo[] }
  | { type: 'peer-joined'; peer: PeerInfo }
  | { type: 'peer-left'; peerId: string }
  | { type: 'signal'; sender: string; sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit }
  | { type: 'ping' }
  | { type: 'display-name'; message: { id: string; deviceName: string; displayName: string } }

// JSON control messages inside DataChannel (file bytes are binary frames, not listed here)
export type ChannelMessage =
  | { type: 'header'; name: string; mime: string; size: number; from: string }
  | { type: 'partition'; offset: number }
  | { type: 'partition-received'; offset: number }
  | { type: 'progress'; progress: number }
  | { type: 'transfer-complete' }
  | { type: 'text'; text: string }
  | { type: 'transfer-cancel' }

export type TransferBrokenReason = 'disconnected' | 'timeout' | 'cancelled'

export interface ReceivedFile { name: string; mime: string; size: number; blob: Blob }

// Text base64 (UTF-8): word-for-word aligned with Vue2 (deprecated unescape/escape intentional for wire compatibility)
export function encodeText(text: string): string {
  return btoa(unescape(encodeURIComponent(text)))
}
export function decodeText(encoded: string): string {
  return decodeURIComponent(escape(atob(encoded)))
}

export function isRtcSupported(): boolean {
  return typeof RTCPeerConnection !== 'undefined'
}
