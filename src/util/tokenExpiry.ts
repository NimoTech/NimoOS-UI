// token 过期预判:iframe 下载 / WS 握手这类 fire-and-forget 通道吃不到 axios 401 拦截器,
// 只能连/发之前先判快过期就刷。P2c 下载首创,P7 Drop、P6 终端复用。

const REFRESH_BUFFER_MS = 60_000

// 下载(fire-and-forget iframe,无法反应式重试)前的条件式预刷新判定。
// expiresAt 为后端下发的 unix 秒;缺失(null)保守刷新;已过期或 ≤60s 内过期则刷新。
export function shouldRefreshToken(expiresAt: number | null, now: number): boolean {
  if (expiresAt == null || !Number.isFinite(expiresAt)) return true
  return now > expiresAt * 1000 - REFRESH_BUFFER_MS
}
