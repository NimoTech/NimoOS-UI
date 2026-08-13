// Drop P2P 协议常量与消息形状:与 Vue2 Network.js 逐字对齐。
// 硬约束:P8 翻 strangler 前新旧页面并存互传,任何形状/数值改动都会破坏兼容。

export const CHUNK_SIZE = 64000 // 64 KB(Vue2 _chunkSize)
export const MAX_PARTITION_SIZE = 1e6 // 1 MB(Vue2 _maxPartitionSize)
export const PROGRESS_NOTIFY_STEP = 0.01 // 进度变化 ≥1% 才通知对端

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
  model: string // 后端 UA 解析:desktop | mobile | tablet
  deviceName: string
  displayName: string
}
export interface PeerInfo {
  id: string
  name: PeerName
  rtcSupported: boolean
  offline?: boolean
}

// WS 信令(服务器 → 客户端)
export type ServerMessage =
  | { type: 'peers'; peers: PeerInfo[] }
  | { type: 'peer-joined'; peer: PeerInfo }
  | { type: 'peer-left'; peerId: string }
  | { type: 'signal'; sender: string; sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit }
  | { type: 'ping' }
  | { type: 'display-name'; message: { id: string; deviceName: string; displayName: string } }

// DataChannel 内 JSON 控制消息(文件字节是二进制帧,不在此列)
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

// 文本 base64(UTF-8):逐字对齐 Vue2(deprecated unescape/escape 是故意的,为 wire 兼容)
export function encodeText(text: string): string {
  return btoa(unescape(encodeURIComponent(text)))
}
export function decodeText(encoded: string): string {
  return decodeURIComponent(escape(atob(encoded)))
}

export function isRtcSupported(): boolean {
  return typeof RTCPeerConnection !== 'undefined'
}
