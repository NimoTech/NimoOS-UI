// Paste's own same-name precheck and resolution-splitting. Ported from Vue2
// src/components/filebrowser/pasteConflict.js, which drives the SAME
// fileConflict.ts machinery (fetchExistingNames / findConflicts /
// resolveConflictQueue) and the SAME FileConflictDialog as the upload flow --
// only the item shape differs.
//
// Adaptation note: New-UI's ConflictCandidate carries no `item` field (Vue2's
// did), so the source path doubles as `groupKey` and splitPasteItems matches
// resolutions back to items through it. Paths in one clipboard batch are
// unique, which is what makes that safe.
import { fetchExistingNames, findConflicts, type ConflictCandidate, type ConflictResolution } from './fileConflict'
import type { OperateItem } from '../stores/clipboard'

/** Last path segment: "/a/b/c.txt" -> "c.txt", "/a/b/" -> "b", "" -> "". */
export function baseName(path: string): string {
  if (!path) return ''
  const parts = String(path).split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : String(path)
}

export async function computePasteConflicts(args: {
  items: OperateItem[]
  destDir: string
  listFolder: (p: string) => Promise<{ content?: { name: string; is_dir: boolean }[] } | null>
}): Promise<ConflictCandidate[]> {
  const existing = await fetchExistingNames(args.destDir, args.listFolder)
  const candidates: ConflictCandidate[] = (args.items || []).map((item) => ({
    name: baseName(item.from),
    isDir: !!item.is_dir,
    groupKey: item.from,
  }))
  return findConflicts(candidates, existing)
}

/**
 * Splits the FULL item list into the two batches the backend's per-batch
 * `style` needs.
 *
 * Items the user never saw a conflict for fall through to the rename group by
 * the same default as an explicit 'keep_both': `style` only ever triggers ON an
 * actual collision, so a conflict-free item submitted with style='rename' is
 * byte-for-byte the old silent default. There is nothing to distinguish the two
 * by once both mean "just land it, renaming only if it turns out to collide".
 */
export function splitPasteItems(
  items: OperateItem[],
  resolutions: ConflictResolution[],
): { overwriteItems: OperateItem[]; renameItems: OperateItem[]; skippedCount: number } {
  const skipped = new Set<string>()
  const overwriteSet = new Set<string>()
  for (const { conflict, action } of resolutions || []) {
    if (action === 'skip' || action === 'cancelled') skipped.add(conflict.groupKey)
    else if (action === 'overwrite') overwriteSet.add(conflict.groupKey)
    // 'keep_both' (and 'merge', which paste never offers) need no bookkeeping:
    // they are the renameItems default below.
  }

  const overwriteItems: OperateItem[] = []
  const renameItems: OperateItem[] = []
  let skippedCount = 0
  for (const item of items || []) {
    if (skipped.has(item.from)) { skippedCount++; continue }
    if (overwriteSet.has(item.from)) overwriteItems.push(item)
    else renameItems.push(item)
  }
  return { overwriteItems, renameItems, skippedCount }
}
