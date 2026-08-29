import type { AxiosInstance } from 'axios'
import type { ComposeAppWithStoreInfo } from './types.js'
import { v2Data } from './v2.js'

export interface ComposeContainerSummary { ID: string; Name?: string; State?: string }
export interface ComposeContainersInfo { main?: string; containers: Record<string, ComposeContainerSummary> }

const BASE = '/v2/app_management/compose'
const idPath = (id: string) => `${BASE}/${encodeURIComponent(id)}`

export function createCompose(http: AxiosInstance) {
  return {
    async list(): Promise<Record<string, ComposeAppWithStoreInfo>> {
      const res = await http.get(BASE)
      // Check the raw envelope, not the unwrapped object's keys — a store app that happens to be named "message" must not be mistaken for an error envelope.
      const body = res.data as { data?: unknown } | null
      const d = body && typeof body === 'object' && 'data' in body ? body.data : undefined
      return d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, ComposeAppWithStoreInfo>) : {}
    },

    async get(id: string): Promise<ComposeAppWithStoreInfo | undefined> {
      // 404 (app not found) returns undefined by contract instead of throwing — callers (e.g. the installProgress watchdog)
      // must distinguish "definitely absent" from "network error"; throwing on 404 gets retried forever as network jitter (ghost progress card).
      try {
        const res = await http.get(idPath(id))
        return v2Data<ComposeAppWithStoreInfo>(res.data)
      } catch (e) {
        if ((e as { response?: { status?: number } })?.response?.status === 404) return undefined
        throw e
      }
    },

    /** Raw compose YAML of an installed app (Accept: application/yaml, bare text, no envelope).
     *  YAML is the native round-trip format for PUT, and it returns reliably even for apps with no extension block (a JSON GET 500s on apps without x-nimoos);
     *  YAML also fully preserves service-level nested extensions (JSON keeps only top-level x-nimoos/x-casaos, dropping in-service envs/ports/volumes descriptions) —
     *  the settings panel editor must use this path.
     *  transformResponse is cleared: axios by default parses text that looks like JSON (same as getAppCompose). */
    async getYaml(id: string): Promise<string> {
      const res = await http.get(idPath(id), {
        headers: { Accept: 'application/yaml' },
        responseType: 'text',
        transformResponse: [(d: unknown) => d],
      })
      return typeof res.data === 'string' ? res.data : ''
    },

    /** Install. yaml = raw compose text; dryRun=true validates without executing (pre-install validation).
     *  Install is an async task: 2xx only means accepted; progress/completion arrive via MessageBus app:install-* (consumed by P3). */
    async install(yaml: string, opts?: { dryRun?: boolean; checkPortConflict?: boolean }): Promise<void> {
      await http.post(BASE, yaml, {
        headers: { 'Content-Type': 'application/yaml' },
        params: { dry_run: opts?.dryRun, check_port_conflict: opts?.checkPortConflict },
      })
    },

    /** Update an installed app's settings (PUT the whole compose YAML, supports dryRun pre-validation). */
    async applySettings(id: string, yaml: string, opts?: { dryRun?: boolean; checkPortConflict?: boolean }): Promise<void> {
      await http.put(idPath(id), yaml, {
        headers: { 'Content-Type': 'application/yaml' },
        params: { dry_run: opts?.dryRun, check_port_conflict: opts?.checkPortConflict },
      })
    },

    /** Update to the store version. The 200 message is a human-readable result ("already latest" / "updating asynchronously");
     *  Vue2 toasts it directly, so it is passed through; when an update is actually running, app:update-begin/-end/-error events follow. */
    async update(id: string, opts?: { force?: boolean }): Promise<string> {
      const res = await http.patch(idPath(id), undefined, { params: { force: opts?.force } })
      const body = res.data as { message?: unknown } | null
      return body && typeof body === 'object' && typeof body.message === 'string' ? body.message : ''
    },

    /** Uninstall. deleteConfigFolder defaults to true on the backend (deletes the data directory too);
     *  the UI's "keep data" option passes false. Async; completion arrives via app:uninstall-end/-error. */
    async uninstall(id: string, opts?: { deleteConfigFolder?: boolean }): Promise<void> {
      await http.delete(idPath(id), { params: { delete_config_folder: opts?.deleteConfigFolder } })
    },

    /** Start/stop/restart. The body is a bare JSON string ("start"); passing the literal directly makes axios
     *  send it as text/plain and echo's Bind fails to parse — same pitfall as apps.start. */
    async setStatus(id: string, action: 'start' | 'stop' | 'restart'): Promise<void> {
      await http.put(`${idPath(id)}/status`, JSON.stringify(action), {
        headers: { 'Content-Type': 'application/json' },
      })
    },

    /** Logs (data is one whole string). lines=-1 fetches all; backend default is 1000. */
    async logs(id: string, opts?: { lines?: number }): Promise<string> {
      const res = await http.get(`${idPath(id)}/logs`, { params: { lines: opts?.lines } })
      return v2Data<string>(res.data) ?? ''
    },

    /** Running container per compose service (backend workaround: only the first container per service is returned).
     *  404 (app not found) returns undefined instead of throwing — same contract as get() (see its comment). */
    async containers(id: string): Promise<ComposeContainersInfo | undefined> {
      try {
        const res = await http.get(`${idPath(id)}/containers`)
        const d = v2Data<{ main?: string; containers?: Record<string, ComposeContainerSummary> }>(res.data)
        if (!d) return undefined
        return { main: d.main, containers: d.containers ?? {} }
      } catch (e) {
        if ((e as { response?: { status?: number } })?.response?.status === 404) return undefined
        throw e
      }
    },

    /** Health check: 2xx→true, any failure→false (AppLauncherCheck semantics). */
    async healthcheck(id: string): Promise<boolean> {
      try {
        await http.get(`${idPath(id)}/healthcheck`)
        return true
      } catch {
        return false
      }
    },
  }
}
