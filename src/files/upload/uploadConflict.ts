// Upload's own same-name-conflict detection + resolution, layered on top of
// fileConflict.ts's generic machinery. Ported from Vue2
// src/components/filebrowser/upload/uploadConflict.js.
//
// Why upload needs grouping at all (paste/restore don't): a picked or dragged
// folder flattens to one entry per file inside it, so an entry can carry a
// multi-level relativePath like "Trip/Day1/1.jpg". Prompting per entry would
// ask about every photo inside "Trip". Instead the conflict is judged on the
// relativePath's TOP segment — the thing that actually lands as a sibling of
// an existing name — and every entry sharing that top segment is resolved as
// one unit.
import { findConflicts, type ConflictCandidate } from './fileConflict'

export interface UploadEntry {
  file: File
  relativePath: string
}

export interface UploadGroup {
  entries: UploadEntry[]
  isFolderGroup: boolean
}

/**
 * Groups entries by the FIRST segment of relativePath. "Trip/Day1/1.jpg" and
 * "Trip/Day2/2.jpg" both land under "Trip"; a bare "a.txt" is its own group.
 * `isFolderGroup` flips true the instant ANY entry in the group has a nested
 * path — that is what lets computeUploadConflicts force isDir even when the
 * target currently holds a same-named FILE.
 */
export function groupByTopSegment(entries: UploadEntry[]): Map<string, UploadGroup> {
  const groups = new Map<string, UploadGroup>()
  for (const entry of entries || []) {
    const rel = entry.relativePath || ''
    const slashIdx = rel.indexOf('/')
    const isNested = slashIdx !== -1
    const topName = isNested ? rel.slice(0, slashIdx) : rel
    if (!groups.has(topName)) groups.set(topName, { entries: [], isFolderGroup: false })
    const group = groups.get(topName)!
    group.entries.push(entry)
    if (isNested) group.isFolderGroup = true
  }
  return groups
}

/**
 * One conflict candidate per group whose top name collides with something
 * already in the target directory. `isDir` is true if EITHER side is a
 * directory, because the dialog disables Overwrite whenever a folder is
 * involved.
 */
export function computeUploadConflicts(
  entries: UploadEntry[],
  existing: Map<string, boolean>,
): ConflictCandidate[] {
  const groups = groupByTopSegment(entries)
  const candidates: ConflictCandidate[] = []
  for (const [topName, group] of groups) {
    candidates.push({
      name: topName,
      isDir: !!existing.get(topName) || group.isFolderGroup,
      groupKey: topName,
    })
  }
  return findConflicts(candidates, existing)
}

/**
 * Splits the conflicts into two independently-resolved queues. `fileConflicts`
 * is the plain file-vs-file case (overwrite / keep both / skip, never merge).
 * `folderConflicts` is everything with a directory on either side, each
 * carrying `mergeable` — true ONLY when both sides are actually folders. A
 * type mismatch (folder group onto an existing file, or a lone file onto an
 * existing folder) sorts into folderConflicts with `mergeable: false`, so the
 * dialog falls back to keep-both / skip.
 *
 * The input conflicts are not mutated — `mergeable` is added onto copies so
 * computeUploadConflicts' own output shape stays untouched.
 */
export function splitConflictsByKind(
  conflicts: ConflictCandidate[],
  entries: UploadEntry[],
  existing: Map<string, boolean>,
): { folderConflicts: ConflictCandidate[]; fileConflicts: ConflictCandidate[] } {
  const groups = groupByTopSegment(entries)
  const folderConflicts: ConflictCandidate[] = []
  const fileConflicts: ConflictCandidate[] = []
  for (const conflict of conflicts || []) {
    const group = groups.get(conflict.groupKey)
    const isFolderGroup = !!group?.isFolderGroup
    const existingIsDir = !!existing?.get(conflict.name)
    if (isFolderGroup || existingIsDir) {
      folderConflicts.push({ ...conflict, mergeable: isFolderGroup && existingIsDir })
    } else {
      fileConflicts.push(conflict)
    }
  }
  return { folderConflicts, fileConflicts }
}
