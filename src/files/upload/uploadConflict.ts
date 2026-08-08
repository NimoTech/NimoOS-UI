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
import { findConflicts, type ConflictCandidate, type ConflictResolution, type ConflictAction } from './fileConflict'

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

export interface AcceptedEntry {
  file: File
  relativePath: string
  conflictPolicy: '' | 'overwrite' | 'rename'
  /** Set by a Merge choice: this entry still needs a second, per-file
   *  conflict round against the target folder's actual contents. Never
   *  reaches the upload queue. */
  pendingInnerCheck?: boolean
}

export interface ApplyResult {
  accepted: AcceptedEntry[]
  skippedCount: number
  cancelledCount: number
}

/**
 * Directory-naming helper for Keep both on a FOLDER group: appends the
 * smallest "(n)" suffix not already taken. Files get the simpler 'rename'
 * policy instead and let the backend pick name(1).ext.
 */
export function nextAvailableName(name: string, existingNames: Set<string>): string {
  if (!existingNames.has(name)) return name
  let n = 1
  let candidate = `${name}(${n})`
  while (existingNames.has(candidate)) {
    n++
    candidate = `${name}(${n})`
  }
  return candidate
}

/**
 * Applies one resolution per GROUP back onto the FULL entry list, producing
 * the per-entry conflictPolicy the upload queue submits.
 *
 * `existingNames` is MUTATED: every folder group's newly picked name is added
 * immediately, so a second keep_both group with the same top name picks the
 * next free suffix instead of colliding. Callers must reuse ONE set across
 * every group of a batch.
 *
 * Skipped and cancelled groups are dropped HERE, before the batch manifest is
 * ever reported — so reconciliation never lists them and the interrupted-
 * upload badge cannot misreport them as missing.
 */
export function applyUploadResolutions(
  entries: UploadEntry[],
  resolutions: ConflictResolution[],
  existingNames: Set<string>,
): ApplyResult {
  const groups = groupByTopSegment(entries)
  // Carries the action AND the conflict's own mergeable flag, so the merge
  // branch can tell a real Merge choice from one that only arrived via
  // "apply to all" propagating onto a group the dialog never offered Merge for.
  const resolutionByGroup = new Map<string, { action: ConflictAction; mergeable: boolean }>()
  for (const { conflict, action } of resolutions || []) {
    resolutionByGroup.set(conflict.groupKey, { action, mergeable: !!conflict.mergeable })
  }

  const accepted: AcceptedEntry[] = []
  let skippedCount = 0
  let cancelledCount = 0

  for (const [topName, group] of groups) {
    const resolution = resolutionByGroup.get(topName)
    const action = resolution?.action

    if (!action) {
      for (const entry of group.entries) {
        accepted.push({ file: entry.file, relativePath: entry.relativePath, conflictPolicy: '' })
      }
      continue
    }
    if (action === 'skip') {
      skippedCount += group.entries.length
      continue
    }
    if (action === 'cancelled') {
      cancelledCount += group.entries.length
      continue
    }
    if (action === 'merge' && resolution!.mergeable) {
      for (const entry of group.entries) {
        accepted.push({ file: entry.file, relativePath: entry.relativePath, conflictPolicy: '', pendingInnerCheck: true })
      }
      continue
    }
    // A non-mergeable 'merge' falls through to keep_both below: it can only
    // arrive from "apply to all" propagating onto a type-mismatch collision,
    // which can be neither merged nor overwritten. Degrading to keep_both is
    // what the dialog would have produced had Merge simply not been offered.
    if (action === 'overwrite') {
      for (const entry of group.entries) {
        accepted.push({ file: entry.file, relativePath: entry.relativePath, conflictPolicy: 'overwrite' })
      }
      continue
    }

    // keep_both
    if (!group.isFolderGroup) {
      for (const entry of group.entries) {
        accepted.push({ file: entry.file, relativePath: entry.relativePath, conflictPolicy: 'rename' })
      }
      continue
    }
    // Folder: the front end picks the new top-level name, because the backend
    // has no concept of "this whole tree is one renamed unit" — every entry is
    // an independent tus upload with its own relativePath.
    const newTop = nextAvailableName(topName, existingNames)
    existingNames.add(newTop)
    for (const entry of group.entries) {
      const rel = entry.relativePath || ''
      const slashIdx = rel.indexOf('/')
      const rest = slashIdx !== -1 ? rel.slice(slashIdx) : ''
      accepted.push({ file: entry.file, relativePath: `${newTop}${rest}`, conflictPolicy: '' })
    }
  }

  return { accepted, skippedCount, cancelledCount }
}
