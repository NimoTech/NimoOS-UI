import type { FileEntry } from '../stores/files'
import { isAlreadyShared } from './shareGate'

// Vue2 把这份列表抄在 mixin/ContextMenu/FilePanel 共 5 处;New-UI 收拢一处。
export const PROTECTED = ['AppData', 'Documents', 'Downloads', 'Gallery', 'Media']

// Splits an upload batch into the entries the queue will actually accept and
// the relative paths it would refuse. `uploads.addFilesToQueue` applies the
// same rule as its own last line of defence; this function exists so callers
// can drop the doomed entries BEFORE anything asks the user a question about
// them. Dropping a folder named after a protected directory used to walk the
// user through the whole same-name conflict prompt first and only then report
// that it was refused — deciding the fate of something already destined for the
// bin (SP12 Plan B outstanding item 7).
export function splitProtectedUploads<T extends { relativePath: string }>(
  entries: T[],
): { accepted: T[]; rejected: string[] } {
  const accepted: T[] = []
  const rejected: string[] = []
  for (const entry of entries) {
    if (PROTECTED.includes(entry.relativePath.split('/')[0])) rejected.push(entry.relativePath)
    else accepted.push(entry)
  }
  return { accepted, rejected }
}

// Split a selection into what a destructive batch may actually touch and a
// count of what it must leave alone.
//
// Both delete and cut used to be all-or-nothing: one protected member -- a
// system folder, a shared folder, a mount point -- and the whole batch was
// refused, so selecting everything in /DATA and pressing delete removed
// nothing at all (pending-ledger F10). Filtering lets the rest through and
// leaves the caller to say how many were skipped, in its own wording: delete
// and cut are different verbs and cannot share one message.
export function operableEntries(entries: FileEntry[]): { targets: FileEntry[]; skipped: number } {
  const targets = entries.filter((e) => canOperate(e))
  return { targets, skipped: entries.length - targets.length }
}

// 可否对该项做重命名/删除/剪切等破坏性操作。复制/下载/收藏不走这里。
export function canOperate(entry: FileEntry): boolean {
  if (entry.is_dir && PROTECTED.includes(entry.name)) return false // 系统默认文件夹
  if (isAlreadyShared(entry)) return false // 已分享
  if ((entry.extensions as { mounted?: boolean } | null | undefined)?.mounted) return false // 挂载点
  return true
}
