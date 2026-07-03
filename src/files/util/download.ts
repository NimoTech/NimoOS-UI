// 下载纯逻辑:端点选择 + 过期预刷新判定。DOM 副作用见 iframeDownload.ts。

export type DownloadPlan = { kind: 'file'; path: string } | { kind: 'batch'; files: string }

// 移植 Vue2 getFileUrl:单个非目录 → /v3/file;单目录 或 多选 → /v1/batch(zip),files 逗号连接。
// 传入的 path 必须是真实路径(含 /DATA),与后端契约一致。
export function planDownload(entries: { path: string; is_dir: boolean }[]): DownloadPlan {
  if (entries.length === 1 && !entries[0].is_dir) {
    return { kind: 'file', path: entries[0].path }
  }
  return { kind: 'batch', files: entries.map((e) => e.path).join(',') }
}

const REFRESH_BUFFER_MS = 60_000

// 下载(fire-and-forget iframe,无法反应式重试)前的条件式预刷新判定。
// expiresAt 为后端下发的 unix 秒;缺失(null)保守刷新;已过期或 ≤60s 内过期则刷新。
export function shouldRefreshBeforeDownload(expiresAt: number | null, now: number): boolean {
  if (expiresAt == null) return true
  return now > expiresAt * 1000 - REFRESH_BUFFER_MS
}
