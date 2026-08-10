// Peer transfer state machine + RTCPeer. The wire protocol (message shapes,
// 64 KB chunks, 1 MB partitions, the header/partition/ack/complete sequence) is
// a faithful port of Vue2 Network.js and MUST stay compatible -- old and new
// pages transfer to each other. The reliability layer around it is NOT a port
// and has no Vue2 counterpart: a single disconnect trunk (handleDisconnect) that
// reports only when something was in flight, ACK_TIMEOUT_MS bounds on both of
// the sender's waits with per-partition ack matching, user-initiated
// cancellation, chunker aborts on reset, and a transient-vs-terminal split of
// the ICE connection states. Also differs from Vue2: global $EventBus ->
// injected callbacks; sdpSemantics dropped (spec D6); TS types.
import { FileChunker } from './chunker'
import { FileDigester } from './digester'
import {
  encodeText, decodeText, PROGRESS_NOTIFY_STEP, ACK_TIMEOUT_MS,
  type ChannelMessage, type ReceivedFile, type TransferBrokenReason,
} from './protocol'

export interface PeerEvents {
  onFileProgress: (e: { sender: string; progress: number; filesQueue: number; files: File[] }) => void
  onFileReceived: (e: { file: ReceivedFile; from: string }) => void
  onTextReceived: (e: { text: string; sender: string }) => void
  onTransferComplete: () => void
  onTransferBroken: (e: { peerId: string; reason: TransferBrokenReason }) => void
}
export interface SignalChannel { send(message: object): void }

export class Peer {
  protected _peerId: string
  private filesQueue: { file: File; from: string }[] = []
  private files: File[] = []
  private busy = false
  private chunker: FileChunker | null = null
  private digester: FileDigester | null = null
  private lastProgress = 0
  private incomingFrom = ''
  private ackTimer: ReturnType<typeof setTimeout> | null = null
  // Offset of the partition whose acknowledgement we are currently waiting for,
  // or null when we are waiting for none. An ack that does not match it belongs
  // to a partition that is already history and must be ignored -- see the
  // `partition-received` branch.
  private pendingAckOffset: number | null = null

  constructor(protected signal: SignalChannel, peerId: string | null, protected events: PeerEvents) {
    this._peerId = peerId ?? ''
  }

  get peerId(): string { return this._peerId }

  sendJSON(message: ChannelMessage): void { this.sendRaw(JSON.stringify(message)) }

  sendFiles(files: File[], from: string): void {
    this.files = files
    for (const f of files) this.filesQueue.push({ file: f, from })
    if (this.busy) return
    this.dequeueFile()
  }

  private dequeueFile(): void {
    if (!this.filesQueue.length) return
    this.busy = true
    const next = this.filesQueue.shift()!
    this.sendFile(next.file, next.from)
  }

  private sendFile(file: File, from: string): void {
    this.sendJSON({ type: 'header', name: file.name, mime: file.type, size: file.size, from })
    this.chunker = new FileChunker(
      file,
      (chunk) => this.sendRaw(chunk),
      (offset) => {
        this.sendJSON({ type: 'partition', offset })
        this.pendingAckOffset = offset
        this.armAck()
      },
    )
    this.chunker.nextPartition()
  }

  sendText(text: string): void { this.sendJSON({ type: 'text', text: encodeText(text) }) }

  handleChannelMessage(message: string | ArrayBuffer): void {
    if (typeof message !== 'string') { this.onChunkReceived(message); return }
    let msg: ChannelMessage
    try { msg = JSON.parse(message) as ChannelMessage } catch { return }
    switch (msg.type) {
      case 'header': this.onFileHeader(msg); break
      case 'partition': this.sendJSON({ type: 'partition-received', offset: msg.offset }); break
      case 'partition-received':
        // An ack only counts for the partition we are actually waiting on.
        // "A non-null chunker means a send is in flight" was the earlier guard
        // and it is false: the wire order at the end of a file is always
        // transfer-complete FIRST (the receiver completes on the last chunk),
        // trailing partition-received SECOND, so every successful send used to
        // be followed by a stray ack. That ack then either armed a 30s timer on
        // an idle peer (which later killed the next INCOMING transfer) or, when
        // a second queued file had already started, drove nextPartition() on
        // the WRONG chunker mid-read (InvalidStateError + broken flow control).
        // Matching the offset makes the ack belong to a specific partition, so
        // both go away.
        if (this.pendingAckOffset === null || msg.offset !== this.pendingAckOffset) break
        this.pendingAckOffset = null
        this.clearAck()
        if (this.chunker && !this.chunker.isFileEnd()) this.chunker.nextPartition()
        // Last partition acknowledged: now we are waiting for the receiver to
        // finish assembling and say transfer-complete. Same bound applies.
        else this.armAck()
        break
      case 'progress': this.onDownloadProgress(msg.progress); break
      case 'transfer-complete': this.clearAck(); this.onTransferCompleted(); break
      case 'text': this.events.onTextReceived({ text: decodeText(msg.text), sender: this._peerId }); break
      case 'transfer-cancel':
        // The other side gave up. Drop whatever we were assembling; a later
        // transfer must not inherit these bytes. Routed through
        // handleDisconnect so the wasActive guard applies here too -- a
        // stray/late transfer-cancel (already-finished receive, or a message
        // surviving a reconnect) must not report a broken transfer that from
        // this side never existed or already succeeded.
        this.handleDisconnect('cancelled')
        break
    }
  }

  private onFileHeader(header: { name: string; mime: string; size: number; from: string }): void {
    this.lastProgress = 0
    this.incomingFrom = header.from
    this.digester = new FileDigester(
      { name: header.name, mime: header.mime, size: header.size },
      (file) => this.onFileReceived(file),
    )
  }

  private onChunkReceived(chunk: ArrayBuffer): void {
    // Captured locally: on the final chunk, unchunk() synchronously invokes
    // onFileReceived, which now clears this.digester (Fix Round 1 / Critical
    // 1). Reading through `this.digester` after that call would crash.
    const digester = this.digester
    if (!chunk.byteLength || !digester) return
    digester.unchunk(chunk)
    const progress = digester.progress
    this.onDownloadProgress(progress)
    if (progress - this.lastProgress < PROGRESS_NOTIFY_STEP) return
    this.lastProgress = progress
    this.sendJSON({ type: 'progress', progress })
  }

  private onDownloadProgress(progress: number): void {
    this.events.onFileProgress({
      sender: this._peerId,
      progress,
      filesQueue: this.filesQueue.length + 1,
      files: this.files,
    })
  }

  private onFileReceived(file: ReceivedFile): void {
    this.events.onFileReceived({ file, from: this.incomingFrom })
    this.sendJSON({ type: 'transfer-complete' })
    // Clear receive state on success -- otherwise `digester !== null` keeps
    // reporting "active" forever after a completed receive, and the next
    // idle disconnect wrongly looks like a broken transfer.
    this.digester = null
    this.lastProgress = 0
    this.incomingFrom = ''
  }

  private onTransferCompleted(): void {
    this.onDownloadProgress(1)
    this.busy = false
    // The finished file's chunker (and the ack offset it was waiting on) must go
    // before dequeueFile() installs the next one -- otherwise the trailing
    // partition-received of the file that just completed lands on state
    // belonging to the file that just started.
    this.chunker = null
    this.pendingAckOffset = null
    // `files` is what stores/drop.ts reads to decide `sending`, so it must stop
    // describing a send that is over. A stale non-empty list made the NEXT
    // incoming transfer from this peer look outgoing: the card claimed "sending",
    // and DropItem.vue's stall watchdog (receive-side only) never started, so a
    // dead receive had nothing bounding it at all -- there is no ack timer on the
    // receive path. Checked BEFORE dequeueFile() and only once the queue has
    // drained: a multi-file send must keep reporting `sending: true` between its
    // files, and dequeueFile() would have already refilled `busy` by then.
    if (!this.filesQueue.length) this.files = []
    this.dequeueFile()
    this.events.onTransferComplete()
  }

  // 子类实现真实发送;基类抛错防误用
  protected sendRaw(_data: string | ArrayBuffer): void {
    throw new Error('Peer.sendRaw must be overridden')
  }

  /** True while this peer is sending or assembling something. */
  hasActiveTransfer(): boolean {
    return this.busy || this.digester !== null
  }

  /**
   * The single place a transfer dies. Resets the peer so the next send starts
   * clean, then tells the UI -- but only when something was actually in
   * flight. Channels close routinely during idle reconnects; reporting those
   * would train the user to ignore the message that matters.
   */
  handleDisconnect(reason: TransferBrokenReason): void {
    const wasActive = this.hasActiveTransfer()
    this.resetTransferState()
    if (wasActive) this.events.onTransferBroken({ peerId: this._peerId, reason })
  }

  /** User-initiated stop. Silent when nothing is running so a stray click
   *  cannot spam the peer with cancel messages. `resetTransferState()`
   *  already aborts the chunker, so there is nothing left to do here beyond
   *  telling the other side and reporting locally.
   *
   *  Order matters: reset and report FIRST, put the message on the wire LAST.
   *  sendJSON on a dead channel routes into handleDisconnect(), which reports
   *  and resets on its own -- doing that while this transfer still looked
   *  active produced two "transfer broken" toasts for one click. Sending last
   *  means handleDisconnect finds nothing in flight and stays quiet.
   *
   *  `reason` only changes what this side reports; the wire message is the same
   *  either way. The stall watchdog uses this same path but is not the user
   *  choosing to stop, so it passes 'timeout' and gets the interrupted wording. */
  cancelTransfer(reason: TransferBrokenReason = 'cancelled'): void {
    if (!this.hasActiveTransfer()) return
    this.resetTransferState()
    this.events.onTransferBroken({ peerId: this._peerId, reason })
    this.sendJSON({ type: 'transfer-cancel' })
  }

  private armAck(): void {
    this.clearAck()
    this.ackTimer = setTimeout(() => this.handleDisconnect('timeout'), ACK_TIMEOUT_MS)
  }

  private clearAck(): void {
    if (this.ackTimer === null) return
    clearTimeout(this.ackTimer)
    this.ackTimer = null
  }

  protected resetTransferState(): void {
    this.clearAck()
    this.busy = false
    // Stop the chunker's read loop before dropping the reference: its
    // FileReader 'load' callback closes over `this` directly and is not
    // gated on `this.chunker` still pointing at it, so nulling the field
    // alone does not stop stale chunks from continuing onto the wire.
    this.chunker?.abort()
    this.chunker = null
    this.pendingAckOffset = null
    this.digester = null
    this.filesQueue = []
    this.files = []
    this.lastProgress = 0
    this.incomingFrom = ''
  }
}

// 仅公网 STUN,无 TURN(Vue2 同,局域网定位)
export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

type SignalPayload = { sender: string; sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit }

export class RTCPeer extends Peer {
  private conn: RTCPeerConnection | null = null
  private channel: RTCDataChannel | null = null
  private isCaller = false

  constructor(signal: SignalChannel, peerId: string | null, events: PeerEvents) {
    super(signal, peerId, events)
    if (!peerId) return // 等对方主叫(signal 消息到达时 onServerMessage 里补 connect)
    this.connectRtc(peerId, true)
  }

  private connectRtc(peerId: string, isCaller: boolean): void {
    if (!this.conn) this.openConnection(peerId, isCaller)
    if (isCaller) this.openChannel()
    else this.conn!.ondatachannel = (e) => this.onChannelOpened(e.channel)
  }

  private openConnection(peerId: string, isCaller: boolean): void {
    this.isCaller = isCaller
    this._peerId = peerId
    this.conn = new RTCPeerConnection(RTC_CONFIG)
    this.conn.onicecandidate = (e) => { if (e.candidate) this.sendSignal({ ice: e.candidate.toJSON() }) }
    this.conn.onconnectionstatechange = () => this.onConnectionStateChange()
  }

  private openChannel(): void {
    const channel = this.conn!.createDataChannel('data-channel', { ordered: true })
    channel.onopen = () => this.onChannelOpened(channel)
    this.conn!.createOffer()
      .then((d) => this.onDescription(d))
      .catch((e) => console.error('[drop] createOffer', e))
  }

  private onDescription(description: RTCSessionDescriptionInit): void {
    this.conn!.setLocalDescription(description)
      .then(() => this.sendSignal({ sdp: description }))
      .catch((e) => console.error('[drop] setLocalDescription', e))
  }

  onServerMessage(message: SignalPayload): void {
    if (!this.conn) this.connectRtc(message.sender, false)
    if (message.sdp) {
      this.conn!.setRemoteDescription(message.sdp)
        .then(() => {
          if (message.sdp!.type === 'offer') {
            return this.conn!.createAnswer().then((d) => this.onDescription(d))
          }
        })
        .catch((e) => console.error('[drop] setRemoteDescription', e))
    } else if (message.ice) {
      void this.conn!.addIceCandidate(message.ice).catch((e) => console.error('[drop] addIceCandidate', e))
    }
  }

  private onChannelOpened(channel: RTCDataChannel): void {
    channel.binaryType = 'arraybuffer'
    channel.onmessage = (e) => this.handleChannelMessage(e.data as string | ArrayBuffer)
    channel.onclose = () => this.onChannelClosed()
    this.channel = channel
  }

  /** A real termination: both roles surface the break, then the caller re-dials.
   *  The old code returned early for the callee, which meant a receiver whose
   *  sender vanished got no signal at all. */
  private onChannelClosed(): void {
    this.handleDisconnect('disconnected')
    this.redialIfCaller()
  }

  /** Re-open the channel. Only the caller dials; the callee waits to be dialled
   *  (same as Vue2). Separate from onChannelClosed() because a transient ICE
   *  state needs the re-dial WITHOUT the break report -- see
   *  onConnectionStateChange. */
  private redialIfCaller(): void {
    if (!this.isCaller) return
    this.connectRtc(this._peerId, true)
  }

  private onConnectionStateChange(): void {
    if (!this.conn) return
    switch (this.conn.connectionState) {
      case 'disconnected':
        // NOT a termination. Chrome enters 'disconnected' after a few seconds of
        // failed consent checks and routinely returns to 'connected' (Wi-Fi
        // roam, interface flap); the SCTP association and the data channel
        // survive it. Reporting here threw away a receiver's half-assembled
        // multi-GB file over a 2-second blip. Re-dial, say nothing: if it never
        // recovers, a send is still bounded by ACK_TIMEOUT_MS and a receive that
        // has got far enough to show a progress card by DropItem.vue's stall
        // watchdog. Two pre-existing gaps in that second bound (both ticketed,
        // not fixed here): the watchdog returns early while the rounded percent
        // is still 0, and a header whose first chunk never arrives creates no
        // card at all -- so a receive that dies in its first moments is still
        // unbounded.
        this.redialIfCaller()
        break
      // Terminal states. 'closed' nulls conn for the same reason 'failed' does:
      // the re-dial must build a fresh RTCPeerConnection, because
      // createDataChannel on a closed one throws.
      case 'closed': this.conn = null; this.onChannelClosed(); break
      case 'failed': this.conn = null; this.onChannelClosed(); break
    }
  }

  refresh(): void {
    if (this.isChannelOpen() || this.isChannelConnecting()) return
    this.connectRtc(this._peerId, this.isCaller)
  }

  close(): void {
    if (this.conn) { this.conn.close(); this.conn = null }
    this.channel = null
    // RTCPeerConnection.close() does not fire connectionstatechange, so
    // nothing else routes into the disconnect trunk here. Without this, an
    // in-flight ackTimer survives the user leaving the page and fires 30s
    // later against a Peer nobody is looking at anymore.
    this.resetTransferState()
  }

  protected sendRaw(data: string | ArrayBuffer): void {
    if (!this.channel) {
      // Previously this dropped the chunk and called refresh(), so the
      // transfer stalled with nobody told. Treat a missing channel as what it
      // is -- the transfer cannot continue.
      this.handleDisconnect('disconnected')
      this.refresh()
      return
    }
    // TS 的 send 重载不接受联合类型,按实际类型分派
    if (typeof data === 'string') this.channel.send(data)
    else this.channel.send(data)
  }

  private sendSignal(payload: { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit }): void {
    this.signal.send({ ...payload, type: 'signal', to: this._peerId })
  }

  private isChannelOpen(): boolean { return !!this.channel && this.channel.readyState === 'open' }
  private isChannelConnecting(): boolean { return !!this.channel && this.channel.readyState === 'connecting' }
}
