// 设备连接管理:移植 Vue2 PeersManager。差异:WSPeer 兜底不移植(Vue2 即空壳)——
// 不支持 RTC 的 peer 不建连接,sendFiles 返回 false 由 store 弹提示。
import { isRtcSupported, type ServerMessage, type TransferBrokenReason } from './protocol'
import { RTCPeer, type PeerEvents, type SignalChannel } from './rtcPeer'

type MakePeer = (signal: SignalChannel, peerId: string | null, events: PeerEvents) => RTCPeer

/** Why a send could not go out. 'not-ready' is the recoverable one: the
 *  connection is being (re)established, so the user retries in a moment. */
export type SendResult = 'ok' | 'unsupported' | 'not-ready'

export class PeersManager {
  private peers: Record<string, RTCPeer> = {}
  // What the server said about each peer's RTC support, kept so a send to a
  // peer we have no connection for can tell "genuinely cannot" from "not
  // connected yet" -- reporting the wrong one of those sent this bug hunt
  // down the wrong path once already.
  private rtcSupportedById: Record<string, boolean> = {}
  // Peers whose SIGNALING session changed since we built our connection to them
  // -- they left, or (re)joined under an id we already hold a peer for. Either
  // means the page on the other end may be a new one, so the connection we hold
  // can be a corpse no matter what its channel claims. Consulted only when an
  // offer arrives; see the 'signal' branch for why that combination is the
  // exact signal and an offer on its own is not.
  private signalingRestarted: Record<string, boolean> = {}
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
        // 'peers' only ever arrives right after OUR ws (re)connected. A peer
        // whose channel survived the signaling blip is kept as-is; anything
        // else is stale -- a callee left over from a previous round would
        // wait forever to be dialled (the other side dropped us on
        // peer-left and peer-joined dials nobody), which is the #90
        // phone<->desktop deadlock. Replace it with a fresh caller: only the
        // reconnecting side receives 'peers', so only one side dials.
        for (const peer of msg.peers) {
          this.rtcSupportedById[peer.id] = peer.rtcSupported
          const existing = this.peers[peer.id]
          if (existing) {
            if (existing.hasOpenChannel()) { existing.refresh(); continue }
            existing.close()
            delete this.peers[peer.id]
          }
          if (this.rtcSupported && peer.rtcSupported) {
            this.peers[peer.id] = this.makePeer(this.signal, peer.id, this.events)
            delete this.signalingRestarted[peer.id]
          }
          // 不支持 RTC:不建连接(Vue2 WSPeer 兜底本就是不能传的空壳)
        }
        break
      case 'signal': {
        // A fresh offer aimed at a peer with no open channel means the other
        // side re-dialled from scratch (it reconnected and rebuilt its peer);
        // answering from our stale conn state would fail, so rebuild as a
        // fresh callee. An offer on an OPEN channel is normally renegotiation
        // (the peer re-dialling over an ICE blip on the SAME page) and goes to
        // the existing peer untouched -- that is what lets a half-received
        // multi-GB file survive a two-second network hiccup.
        //
        // But 'open' is not proof of life: when the other page closes, Chrome
        // leaves our end of the channel in 'open' for tens of seconds, and
        // once the connection is repurposed it may never close at all. If that
        // corpse is handed the new page's offer, it answers on the dead
        // RTCPeerConnection, keeps `busy`/`filesQueue` from the transfer that
        // died with the old page, and every later send queues behind a
        // transfer that can never finish -- silently, since the send reports
        // 'ok'. That is #90 acceptance steps 7/8: close the receiver's tab
        // mid-transfer, reopen it, and the sender is wedged for good.
        // `signalingRestarted` is the missing evidence: the server told us the
        // session on the other end changed, so an offer after it is a new page
        // dialling, not a renegotiation.
        //
        // Known gap (unchanged): if both sides re-dial in the same instant
        // (e.g. server restart) the crossed offers still deadlock -- as in
        // Vue2/Snapdrop; the next reconnect converges it.
        const existing = this.peers[msg.sender]
        if (existing && msg.sdp?.type === 'offer'
          && (!existing.hasOpenChannel() || this.signalingRestarted[msg.sender])) {
          // Report before close(): the transfer that died with the other page
          // is still live state here, and close()'s own resetTransferState()
          // would make it look idle and swallow the message. Same ordering as
          // the 'peer-left' branch, for the same reason.
          existing.handleDisconnect('disconnected')
          existing.close()
          delete this.peers[msg.sender]
        }
        if (!this.peers[msg.sender]) {
          this.peers[msg.sender] = this.makePeer(this.signal, null, this.events) // 被叫
          delete this.signalingRestarted[msg.sender]
        }
        this.peers[msg.sender].onServerMessage(msg)
        break
      }
      case 'peer-left': {
        const peer = this.peers[msg.peerId]
        // peer-left is a signaling-layer event; an open data channel is
        // independent of the ws and may be mid-transfer (mobile browsers
        // drop the ws on screen-lock/app-switch while RTC survives). Keep
        // it -- a genuinely departed peer closes the channel by itself
        // moments later and onChannelClosed reports/cleans up. Vue2 behaved
        // this way by accident: its _onPeerLeft close was a dead branch.
        if (peer?.hasOpenChannel()) {
          // Kept alive on purpose, but no longer trustworthy: remember that
          // this peer's page may be gone, so a later offer rebuilds instead of
          // being answered by a corpse (see the 'signal' branch).
          this.signalingRestarted[msg.peerId] = true
          break
        }
        delete this.peers[msg.peerId]
        delete this.signalingRestarted[msg.peerId]
        // The other device vanished while the user may still be watching an
        // in-flight transfer -- report it (and let the store clear the
        // stale progress card) while transfer state is still live, so
        // hasActiveTransfer() is accurate. Must run before close(), whose
        // own resetTransferState() would otherwise make this look idle.
        // Deliberately not routed through the old sendRaw-detects-null-
        // channel path: that also called refresh(), which re-dialled a peer
        // that had just left.
        peer?.handleDisconnect('disconnected')
        peer?.close()
        break
      }
      case 'peer-joined':
        this.rtcSupportedById[msg.peer.id] = msg.peer.rtcSupported
        // A join for an id we already hold a connection to means that page
        // started a new signaling session -- a reopened tab, or a phone whose
        // ws came back. Harmless for the phone (its surviving channel needs no
        // offer, so the flag is never consulted); decisive for the reopened
        // tab, whose offer must not land on the old connection.
        if (this.peers[msg.peer.id]) this.signalingRestarted[msg.peer.id] = true
        break
      default: break // peers 列表/身份由 store 处理
    }
  }

  /** Send, or say precisely why not. Sending into a peer whose channel is not
   *  open used to look like success and then do nothing at all -- the send
   *  landed on a null channel and the failure was swallowed. Now an
   *  unestablished connection re-dials and reports 'not-ready' so the user
   *  knows to retry rather than pressing send into a void. */
  sendFiles(peerId: string, files: File[], from: string): SendResult {
    if (this.rtcSupportedById[peerId] === false || !this.rtcSupported) return 'unsupported'
    const peer = this.peers[peerId]
    if (!peer) {
      // No connection at all: dial now so the retry a second later works.
      this.peers[peerId] = this.makePeer(this.signal, peerId, this.events)
      delete this.signalingRestarted[peerId]
      return 'not-ready'
    }
    if (!peer.hasOpenChannel()) { peer.refresh(); return 'not-ready' }
    peer.sendText(String(files.length)) // Vue2 顺序:先计数文本,对端气泡显示「接收 N 个文件」
    peer.sendFiles(files, from)
    return 'ok'
  }

  destroy(): void {
    for (const id of Object.keys(this.peers)) this.peers[id].close()
    this.peers = {}
  }

  hasActiveTransfers(): boolean {
    return Object.values(this.peers).some((p) => p.hasActiveTransfer())
  }

  cancelTransfer(peerId: string, reason?: TransferBrokenReason): void {
    this.peers[peerId]?.cancelTransfer(reason)
  }
}
