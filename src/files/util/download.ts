// Download pure logic: endpoint selection + expiry pre-refresh determination. DOM side effects see iframeDownload.ts.

export type DownloadPlan = { kind: 'file'; path: string } | { kind: 'batch'; files: string }

// Port from Vue2 getFileUrl: single non-directory → /v3/file; single directory or
// multi-select → /v1/batch(zip), files comma-separated.
// Passed-in path must be a real path (including /DATA), consistent with backend contract.
export function planDownload(entries: { path: string; is_dir: boolean }[]): DownloadPlan {
  if (entries.length === 1 && !entries[0].is_dir) {
    return { kind: 'file', path: entries[0].path }
  }
  return { kind: 'batch', files: entries.map((e) => e.path).join(',') }
}

export { shouldRefreshToken as shouldRefreshBeforeDownload } from '../../util/tokenExpiry'
