// WS 信令客户端。相对 Vue2 修两个 bug(spec §5):
// 1) token 焊死在 URL —— 改为每次 connect() 现读现构 + 连前预刷新(WS 握手拿不到 401,只能事前防);
// 2) 断线重连 _connect() 空参 no-op —— 改为重连走同一条完整 connect() 路径。
import type { ServerMessage } from './protocol'
import { shouldRefreshBeforeDownload } from '../util/download'

export interface ServerConnectionDeps {
  getToken: () => string | null
  getPeerId: () => string
  getExpiresAt: () => number | null
  refresh: () => Promise<unknown>
  now: () => number
  makeSocket: (url: string) => WebSocket
  wsBase: () => string
  onMessage: (msg: ServerMessage) => void
  onConnectionChange: (connected: boolean) => void
  onReconnectScheduled: () => void
}

const RECONNECT_DELAY_MS = 5000 // 对齐 Vue2 提示语「5 秒后重连」

export class ServerConnection {
  private socket: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false
  private connecting = false

  constructor(private deps: ServerConnectionDeps) {}

  async connect(): Promise<void> {
    if (this.destroyed || this.isConnected() || this.isConnecting() || this.connecting) return
    this.connecting = true
    try {
      if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
      // 连前预刷新:判定复用 P2c 下载的 shouldRefreshBeforeDownload(同一判定不复制)
      if (shouldRefreshBeforeDownload(this.deps.getExpiresAt(), this.deps.now())) {
        try { await this.deps.refresh() } catch { return } // 刷新失败:共享包 onAuthFail 已跳登录
      }
      if (this.destroyed) return
      const token = this.deps.getToken()
      if (!token) return
      const url = `${this.deps.wsBase()}/v1/file/ws?token=${token}&peer=${this.deps.getPeerId()}`
      const ws = this.deps.makeSocket(url)
      ws.binaryType = 'arraybuffer'
      ws.onopen = () => this.deps.onConnectionChange(true)
      ws.onmessage = (e) => this.handleMessage(e.data as string)
      ws.onclose = () => this.handleDisconnect()
      ws.onerror = () => {} // close 事件随后触发,重连在 handleDisconnect
      this.socket = ws
    } finally {
      this.connecting = false
    }
  }

  private handleMessage(raw: string): void {
    let msg: ServerMessage
    try { msg = JSON.parse(raw) as ServerMessage } catch { return }
    if (msg.type === 'ping') { this.send({ type: 'pong' }); return }
    this.deps.onMessage(msg)
  }

  private handleDisconnect(): void {
    this.deps.onConnectionChange(false)
    this.socket = null
    if (this.destroyed) return
    this.deps.onReconnectScheduled()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => { void this.connect() }, RECONNECT_DELAY_MS)
  }

  send(message: object): void {
    if (!this.isConnected()) return
    this.socket!.send(JSON.stringify(message))
  }

  destroy(): void {
    this.destroyed = true
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    if (!this.socket) return
    this.send({ type: 'disconnect' })
    this.socket.onclose = null
    this.socket.close()
    this.socket = null
  }

  // 非永久断开(spec §5):pagehide 用,别用 destroy() —— pagehide 也在 bfcache 导航时触发,
  // destroy() 的 destroyed 标记是永久的,会让 bfcache 恢复后的页面连不回来。
  // 不设 destroyed;既有的 visibilitychange → connect() 路径会在页面恢复时自然复活连接(同 Vue2 _disconnect())。
  suspend(): void {
    if (!this.socket) return
    this.send({ type: 'disconnect' })
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    this.socket.onclose = null
    this.socket.close()
    this.socket = null
  }

  private isConnected(): boolean {
    return !!this.socket && this.socket.readyState === this.socket.OPEN
  }
  private isConnecting(): boolean {
    return !!this.socket && this.socket.readyState === this.socket.CONNECTING
  }
}
