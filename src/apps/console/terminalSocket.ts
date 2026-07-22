// 终端 WS 连接管理(纯逻辑,无 xterm/DOM 依赖,Vue 层注入 deps)。
// 协议事实:后端 resize 消息是死代码(NimoOS-Common ssh/helper.go:408 注释掉了),
// PTY 尺寸只认连接时的 ?cols=&rows= —— 所以本模块不提供 resize,尺寸在 connect 时定死。
// 断连不自动重连(spec §178:终端语义下自动重连丢会话上下文),由 UI 给手动重连按钮。
import { shouldRefreshToken } from '../../util/tokenExpiry'

export type TerminalStatus = 'idle' | 'connecting' | 'open' | 'closed'

export interface TerminalSocketDeps {
  getToken: () => string | null
  getExpiresAt: () => number | null
  refresh: () => Promise<unknown>
  now: () => number
  wsBase: () => string
  makeSocket: (url: string) => WebSocket
  onStatus: (s: TerminalStatus) => void
}

export function buildTerminalWsUrl(base: string, containerId: string, token: string, cols: number, rows: number): string {
  return `${base}/v1/container/${encodeURIComponent(containerId)}/terminal?token=${encodeURIComponent(token)}&cols=${cols}&rows=${rows}`
}

export class TerminalSocket {
  private socket: WebSocket | null = null
  constructor(private deps: TerminalSocketDeps) {}

  async connect(containerId: string, cols: number, rows: number): Promise<WebSocket | null> {
    this.deps.onStatus('connecting')
    if (shouldRefreshToken(this.deps.getExpiresAt(), this.deps.now())) {
      try { await this.deps.refresh() } catch { this.deps.onStatus('closed'); return null }
    }
    const token = this.deps.getToken()
    if (!token) { this.deps.onStatus('closed'); return null }
    const ws = this.deps.makeSocket(buildTerminalWsUrl(this.deps.wsBase(), containerId, token, cols, rows))
    this.socket = ws
    return new Promise((resolve) => {
      ws.onopen = () => { this.deps.onStatus('open'); resolve(ws) }
      ws.onclose = () => { this.socket = null; this.deps.onStatus('closed'); resolve(null) }
      ws.onerror = () => {} // close 随后触发
    })
  }

  close(): void {
    const s = this.socket
    this.socket = null
    if (s) s.close()
    this.deps.onStatus('closed')
  }
}
