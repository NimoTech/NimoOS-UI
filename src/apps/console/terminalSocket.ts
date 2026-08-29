// Terminal WS connection management (pure logic, no xterm/DOM dependencies, Vue layer injects deps).
// Protocol fact: backend resize message is dead code (NimoOS-Common ssh/helper.go:408 commented out),
// PTY size only recognizes ?cols=&rows= at connection time — so this module doesn't provide resize, size is fixed at connect.
// Disconnect doesn't auto-reconnect (spec §178: under terminal semantics auto-reconnect loses session context), UI provides manual reconnect button.
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
  // Generation counter: close() increments generation, connect() checks at each resume point (after await)
  // whether generation has been superseded. Superseded means "already cancelled" — no longer build socket,
  // no longer flip state (close() has already pinned state to closed), just resolve null.
  // Goal: prevent "close() during unmount lands on refresh() suspension, refresh resolves and resurrects connection" race.
  private generation = 0

  constructor(private deps: TerminalSocketDeps) {}

  async connect(containerId: string, cols: number, rows: number): Promise<WebSocket | null> {
    const myGeneration = this.generation
    this.deps.onStatus('connecting')
    if (shouldRefreshToken(this.deps.getExpiresAt(), this.deps.now())) {
      try { await this.deps.refresh() } catch { this.deps.onStatus('closed'); return null }
      if (myGeneration !== this.generation) return null // While waiting for refresh, close() cancelled, don't build connection
    }
    const token = this.deps.getToken()
    if (!token) { this.deps.onStatus('closed'); return null }
    const ws = this.deps.makeSocket(buildTerminalWsUrl(this.deps.wsBase(), containerId, token, cols, rows))
    this.socket = ws
    return new Promise((resolve) => {
      ws.onopen = () => {
        if (myGeneration !== this.generation) return // Already cancelled by close(), swallow late onopen, don't flip back to open
        this.deps.onStatus('open'); resolve(ws)
      }
      ws.onclose = () => { this.socket = null; this.deps.onStatus('closed'); resolve(null) }
      ws.onerror = () => {} // close fires shortly after
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
