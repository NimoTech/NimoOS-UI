import type { AxiosInstance, AxiosRequestConfig } from 'axios'

// terminal domain = NimoOS-Terminal (ttyd + tmux + thin Go integration).
//
// ⚠️ Envelope: NONE. This service returns bare JSON on every route (Vue2 reads
//    r.data.mode / e.response.data.password_required directly) — never unwrap().
// ⚠️ Error bodies carry semantics the page needs:
//    POST /session  → 401 {password_required, mode, idle_minutes} = step-up needed;
//                     401 without password_required = wrong password; 403 = not admin;
//                     429 {retry_after_seconds} = frozen (5 failures / 15 min / username).
// The auth ticket is an HttpOnly cookie scoped to /v1/terminal — the page embeds
// ttyd via iframe; the frontend never talks to the WebSocket itself.

export type TerminalMode = 'off' | 'on_open' | 'idle'
export interface TerminalSessionInfo { mode: TerminalMode; idle_minutes: number }
export interface TerminalSettings { mode: TerminalMode; idle_minutes: number }
export interface TerminalWindow { index: number; name: string; active: boolean }

// Password-carrying requests opt out of the shared 401 refresh-replay: the
// backend freezes the account after 5 failed attempts per 15 minutes, and an
// interceptor replay would burn two attempts per typo (SP18 spec §4-6).
const NO_AUTH_RETRY = { _noAuthRetry: true } as AxiosRequestConfig

export function createTerminal(http: AxiosInstance) {
  return {
    async createSession(password?: string): Promise<TerminalSessionInfo> {
      if (password === undefined) return (await http.post('/terminal/session')).data as TerminalSessionInfo
      return (await http.post('/terminal/session', { password }, NO_AUTH_RETRY)).data as TerminalSessionInfo
    },
    /** Clears the ticket cookie only — tmux keeps running, ttyd stays up. */
    async deleteSession(): Promise<void> { await http.delete('/terminal/session') },
    async keepalive(): Promise<void> { await http.post('/terminal/keepalive') },
    async getSettings(): Promise<TerminalSettings> {
      return (await http.get('/terminal/settings')).data as TerminalSettings
    },
    async putSettings(body: { mode: TerminalMode; idle_minutes: number; password: string }): Promise<void> {
      await http.put('/terminal/settings', body, NO_AUTH_RETRY)
    },
    async listWindows(): Promise<TerminalWindow[]> {
      return (await http.get('/terminal/windows')).data as TerminalWindow[]
    },
    async newWindow(): Promise<void> { await http.post('/terminal/windows') },
    async selectWindow(i: number): Promise<void> { await http.post(`/terminal/windows/${i}/select`) },
    /** Closing the last remaining window returns 409 — callers ignore it (1:1 Vue2). */
    async closeWindow(i: number): Promise<void> { await http.delete(`/terminal/windows/${i}`) },
    async renameWindow(i: number, name: string): Promise<void> { await http.put(`/terminal/windows/${i}`, { name }) },
  }
}
