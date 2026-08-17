// WS signaling client. Fixes two bugs vs Vue2 (spec §5):
// 1) Token hardcoded in URL — changed to read-on-demand in each connect() +
//    refresh before connecting (WS handshake cannot receive 401, must prevent
//    upfront);
// 2) Reconnect _connect() with no args was a no-op — changed to use the same
//    full connect() path for reconnection.
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

const RECONNECT_DELAY_MS = 5000 // align with Vue2 message "reconnect in 5 seconds"

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
      // Refresh before connect: reuse the check from P2c download shouldRefreshBeforeDownload (same check, no duplication)
      if (shouldRefreshBeforeDownload(this.deps.getExpiresAt(), this.deps.now())) {
        try { await this.deps.refresh() } catch { return } // refresh failed: shared package onAuthFail already redirects to login
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
      ws.onerror = () => {} // close event fires next, reconnect happens in handleDisconnect
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

  // Non-permanent disconnect (spec §5): for pagehide, not destroy() — pagehide
  // fires on bfcache navigation too, and destroy()'s destroyed flag is permanent,
  // which would break the page after bfcache restore. Do not set destroyed;
  // existing visibilitychange → connect() path naturally revives when page
  // restores (same as Vue2 _disconnect()).
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
