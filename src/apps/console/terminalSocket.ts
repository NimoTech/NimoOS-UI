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
  // 代际计数器:close() 递增代际,connect() 在每个恢复点(await 之后)核对代际是否被换代,
  // 换代即视为"已被取消"—— 不再建 socket、不再翻状态(close() 已经把状态钉在 closed 了),直接 resolve null。
  // 目的是堵住"卸载期间 close() 打在 refresh() 挂起时,refresh 落定后仍复活连接"的竞态。
  private generation = 0

  constructor(private deps: TerminalSocketDeps) {}

  async connect(containerId: string, cols: number, rows: number): Promise<WebSocket | null> {
    const myGeneration = this.generation
    this.deps.onStatus('connecting')
    if (shouldRefreshToken(this.deps.getExpiresAt(), this.deps.now())) {
      try { await this.deps.refresh() } catch { this.deps.onStatus('closed'); return null }
      if (myGeneration !== this.generation) return null // 等 refresh 的当口被 close() 取消,不再建连
    }
    const token = this.deps.getToken()
    if (!token) { this.deps.onStatus('closed'); return null }
    const ws = this.deps.makeSocket(buildTerminalWsUrl(this.deps.wsBase(), containerId, token, cols, rows))
    this.socket = ws
    return new Promise((resolve) => {
      ws.onopen = () => {
        if (myGeneration !== this.generation) return // 已被 close() 取消,吞掉迟到的 onopen,不翻回 open
        this.deps.onStatus('open'); resolve(ws)
      }
      ws.onclose = () => { this.socket = null; this.deps.onStatus('closed'); resolve(null) }
      ws.onerror = () => {} // close 随后触发
    })
  }

  close(): void {
    this.generation++
    const s = this.socket
    this.socket = null
    if (s) s.close()
    this.deps.onStatus('closed')
  }
}
