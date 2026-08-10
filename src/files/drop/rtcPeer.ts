// Peer 传输状态机 + RTCPeer:逐字移植 Vue2 Network.js。
// 差异仅:全局 $EventBus → 注入回调;sdpSemantics 删除(spec D6);TS 类型化。
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
      (offset) => { this.sendJSON({ type: 'partition', offset }); this.armAck() },
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
        this.clearAck()
        if (this.chunker && !this.chunker.isFileEnd()) this.chunker.nextPartition()
        // Last partition acknowledged: now we are waiting for the receiver to
        // finish assembling and say transfer-complete. Same bound applies --
        // but only when there is actually a chunker: a stray/duplicate ack
        // (post-reset re-dial, or a chunker whose abort() raced onPartitionEnd)
        // must not arm a timer that later kills an unrelated transfer.
        else if (this.chunker) this.armAck()
        break
      case 'progress': this.onDownloadProgress(msg.progress); break
      case 'transfer-complete': this.clearAck(); this.onTransferCompleted(); break
      case 'text': this.events.onTextReceived({ text: decodeText(msg.text), sender: this._peerId }); break
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

  private onChannelClosed(): void {
    // Both roles must surface the break; only the caller re-dials. The old
    // code returned early for the callee, which meant a receiver whose sender
    // vanished got no signal at all.
    this.handleDisconnect('disconnected')
    if (!this.isCaller) return
    this.connectRtc(this._peerId, true) // 重开通道(Vue2 同)
  }

  private onConnectionStateChange(): void {
    if (!this.conn) return
    switch (this.conn.connectionState) {
      case 'disconnected': this.onChannelClosed(); break
      case 'closed': this.onChannelClosed(); break
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
