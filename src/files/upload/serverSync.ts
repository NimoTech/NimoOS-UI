import type { ServerUploadTask } from '@nimotech/nimoos-service'
import type { UploadItem } from './types'

// Content identity of an upload item/task: target dir + relative path + size.
// Server tasks are keyed by their tus hex id, IDB-restored items by fq_ ids —
// different id spaces, so id-dedup alone double-lists the same file. Dedup by
// content instead: a content match merges the server resume point into the
// local row; only genuinely server-only tasks become new rows.
export function contentKey(targetPath: string, relativePath: string, size: number): string {
  return `${targetPath || ''} ${relativePath || ''} ${size || 0}`
}

export interface ServerSyncPlan {
  merges: Array<{ id: string; patch: Partial<UploadItem> }>
  appends: UploadItem[]
}

// Reconcile the server's active upload tasks against the local queue.
// Ported verbatim from Vue2 store/modules/fileUpload.js:189-245.
// - task.id already present locally → skip (already tracked).
// - content match with a local item → merge resume point (upload_url + max offset).
// - otherwise → append as a needs_file row (byte stream can't be recovered
//   cross-device, only the server offset; user re-picks the file to resume).
export function planServerSync(queue: UploadItem[], tasks: ServerUploadTask[]): ServerSyncPlan {
  const localIds = new Set(queue.map((i) => i.id))
  const byContent = new Map<string, UploadItem>()
  for (const i of queue) byContent.set(contentKey(i.targetPath, i.relativePath || i.fileName, i.size), i)

  const merges: ServerSyncPlan['merges'] = []
  const appends: UploadItem[] = []
  for (const t of tasks) {
    if (localIds.has(t.id)) continue
    const rp = t.relative_path || t.filename
    const local = byContent.get(contentKey(t.target_path, rp, t.size || 0))
    if (local) {
      merges.push({
        id: local.id,
        patch: {
          tusUploadUrl: local.tusUploadUrl || t.upload_url || '',
          bytesSent: Math.max(local.bytesSent || 0, t.offset || 0),
        },
      })
      continue
    }
    appends.push({
      id: t.id,
      file: null,
      fileName: t.filename,
      fileType: t.mime || '',
      size: t.size || 0,
      targetPath: t.target_path,
      relativePath: rp,
      status: 'needs_file',
      progress: 0,
      bytesSent: t.offset || 0,
      speed: 0,
      tusUploadUrl: t.upload_url || '',
      retryCount: t.retry_count || 0,
      error: '',
      createdAt: (t.created_at || 0) * 1000,
      batchId: t.batch_id || '',
      batchTotal: 1,
      conflictPolicy: '',
    })
  }
  return { merges, appends }
}
