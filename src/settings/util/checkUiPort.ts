/**
 * Liveness probe of the new port after changing the WebUI port. Maps to Vue2
 * SettingsPanel.vue's validatePort (L1387) / savePort (L1396) / checkUpdate (L1424).
 *
 * spec §5.1 states checkUiPort does not go into the shared package -- it hits
 * **arbitrary absolute URLs** (cross-port, cross-origin), while the shared package's
 * axios instance carries baseURL, auth headers, and the 401 refresh interceptor; using
 * it against another origin is both unnecessary and drags the interceptor logic in.
 * Bare fetch is used here.
 * The gateway sends Access-Control-Allow-Origin: * on all responses (verified via curl
 * 2026-07-31), so cross-origin fetch works.
 */
export const PROBE_INTERVAL_MS = 1500
/** Porting discipline #4: Vue2 only clearInterval's on success; on failure it probes until the component is destroyed. Here we cap at 40 tries, about 60s. */
export const PROBE_MAX_TRIES = 40

/**
 * Vue2 validates with `parseInt(this.port)` -- `'80.5'` gets swallowed as 80 and
 * `'8o80'` as 8. That's its bug, not copied: here the whole string must be a decimal
 * integer.
 */
export function validatePort(raw: string): { ok: true; port: number } | { ok: false } {
  const s = raw.trim()
  if (!/^\d+$/.test(s)) return { ok: false }
  const port = Number(s)
  if (port < 80 || port > 65535) return { ok: false }
  return { ok: true, port }
}

type Loc = { protocol: string; hostname: string }
type FullLoc = Loc & { pathname: string; hash: string }

export function buildProbeUrl(port: string, loc: Loc = window.location): string {
  return `${loc.protocol}//${loc.hostname}:${port}/v1/gateway/port`
}

/**
 * Porting discipline #5: Vue2 redirects to `${protocol}//${host}:${port}` (bare root path).
 * This app owns the site root and uses hash routing, so a bare root redirect would drop
 * the user's current in-app route; keep the current pathname + hash instead.
 */
export function buildRedirectUrl(port: string, loc: FullLoc = window.location): string {
  return `${loc.protocol}//${loc.hostname}:${port}${loc.pathname}${loc.hash}`
}

/** Single probe. Returns the port string reported by the backend when reachable, else null. **All exceptions are swallowed** -- being unreachable during the switchover is normal. */
export async function probeUiPort(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    const body = (await res.json()) as { success?: number; data?: unknown } | null
    if (body?.success === 200 && typeof body.data === 'string') return body.data
    return null
  } catch {
    return null
  }
}
