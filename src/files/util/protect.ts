import type { FileEntry } from '../stores/files'

// Vue2 copied this list to 5 places: mixin/ContextMenu/FilePanel; New-UI consolidates into one place.
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

// Whether the item can be renamed/deleted/cut and other destructive operations. Copy/download/favorite don't go through here.
export function canOperate(entry: FileEntry): boolean {
  if (entry.is_dir && PROTECTED.includes(entry.name)) return false // system default folder
  // Shared ≠ protected (bug.txt #7): backend cleans up shares during deletion (DeleteShareByPath),
  // rename has RewriteSharePathPrefix; Vue2 only hides the entry in the right-click menu, never blocks the operation.
  // Used to include it in this gate, which caused shared folders on RAID to be mysteriously unable to be deleted.
  if ((entry.extensions as { mounted?: boolean } | null | undefined)?.mounted) return false // mount point
  return true
}
