/**
 * 换 WebUI 端口后的新端口探活。对位 Vue2 SettingsPanel.vue 的
 * validatePort(L1387) / savePort(L1396) / checkUpdate(L1424)。
 *
 * spec §5.1 明确 checkUiPort 不进共享包 —— 它打的是**任意绝对 URL**
 * (跨端口、跨源),而共享包的 axios 实例带 baseURL、认证头与 401 刷新拦截器,
 * 拿它打别的源既没必要也会把拦截器逻辑牵进来。这里用裸 fetch。
 * 网关对所有响应都带 Access-Control-Allow-Origin: *(2026-07-31 curl 实证),
 * 所以跨源 fetch 可行。
 */
export const PROBE_INTERVAL_MS = 1500
/** 移植纪律 #4:Vue2 只在成功时 clearInterval,失败会一直探到组件销毁。这里给上限 40 次 ≈ 60s。 */
export const PROBE_MAX_TRIES = 40

/**
 * Vue2 用 `parseInt(this.port)` 校验 —— `'80.5'` 会被吃成 80、`'8o80'` 会被吃成 8。
 * 这是它的 bug,不照抄:这里要求整个字符串就是十进制整数。
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
 * 移植纪律 #5:Vue2 跳 `${protocol}//${host}:${port}`(根路径 = 旧 Vue2 应用)。
 * New-UI 挂在 /app/ 下,照抄会把用户甩出新 UI,所以保留当前 pathname + hash。
 */
export function buildRedirectUrl(port: string, loc: FullLoc = window.location): string {
  return `${loc.protocol}//${loc.hostname}:${port}${loc.pathname}${loc.hash}`
}

/** 单次探活。通了返回后端报的端口字符串,否则 null。**任何异常都吞掉** —— 切换期间连不上是常态。 */
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
