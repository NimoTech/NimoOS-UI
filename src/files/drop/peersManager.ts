// 设备连接管理:移植 Vue2 PeersManager。差异:WSPeer 兜底不移植(Vue2 即空壳)——
// 不支持 RTC 的 peer 不建连接,sendFiles 返回 false 由 store 弹提示。
import { isRtcSupported, type ServerMessage } from './protocol'
import { RTCPeer, type PeerEvents, type SignalChannel } from './rtcPeer'

type MakePeer = (signal: SignalChannel, peerId: string | null, events: PeerEvents) => RTCPeer

export class PeersManager {
  private peers: Record<string, RTCPeer> = {}
  private rtcSupported: boolean
  private makePeer: MakePeer

  constructor(
    private signal: SignalChannel,
    private events: PeerEvents,
    opts: { rtcSupported?: boolean; makePeer?: MakePeer } = {},
  ) {
    this.rtcSupported = opts.rtcSupported ?? isRtcSupported()
    this.makePeer = opts.makePeer ?? ((s, id, ev) => new RTCPeer(s, id, ev))
  }

  handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'peers':
        for (const peer of msg.peers) {
          if (this.peers[peer.id]) { this.peers[peer.id].refresh(); continue }
          if (this.rtcSupported && peer.rtcSupported) {
            this.peers[peer.id] = this.makePeer(this.signal, peer.id, this.events)
          }
          // 不支持 RTC:不建连接(Vue2 WSPeer 兜底本就是不能传的空壳)
        }
        break
      case 'signal': {
        if (!this.peers[msg.sender]) {
          this.peers[msg.sender] = this.makePeer(this.signal, null, this.events) // 被叫
        }
        this.peers[msg.sender].onServerMessage(msg)
        break
      }
      case 'peer-left': {
        const peer = this.peers[msg.peerId]
        delete this.peers[msg.peerId]
        peer?.close()
        break
      }
      default: break // peers 列表/身份由 store 处理
    }
  }

  sendFiles(peerId: string, files: File[], from: string): boolean {
    const peer = this.peers[peerId]
    if (!peer) return false
    peer.sendText(String(files.length)) // Vue2 顺序:先计数文本,对端气泡显示「接收 N 个文件」
    peer.sendFiles(files, from)
    return true
  }

  destroy(): void {
    for (const id of Object.keys(this.peers)) this.peers[id].close()
    this.peers = {}
  }
}
