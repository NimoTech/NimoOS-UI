// Generic same-name-conflict detection + queue resolution (the Windows-style
// "this already exists — overwrite / keep both / skip, apply to all" flow).
// Dependency-injected on purpose: nothing here knows about uploads, paste or
// snapshot restore, so all three can reuse it (upload is the first and, as of
// SP12, the only caller — paste/restore wiring is a separate ticket).
// Ported from Vue2 src/components/filebrowser/fileConflict.js.

export type ConflictAction = 'overwrite' | 'keep_both' | 'skip' | 'merge' | 'cancelled'

/** One thing that might collide. `mergeable` is only set by the upload layer's
 *  splitConflictsByKind and is absent for plain file conflicts. */
export interface ConflictCandidate {
  name: string
  isDir: boolean
  groupKey: string
  mergeable?: boolean
}

/** What the dialog emits for the CURRENT conflict. */
export interface ConflictChoice {
  action: Exclude<ConflictAction, 'cancelled'>
  applyToAll?: boolean
}

export interface ConflictResolution {
  conflict: ConflictCandidate
  action: ConflictAction
}

/** A directory listing reduced to name -> is_dir. Hidden entries are kept on
 *  purpose: a dotfile the file list filters out still occupies the name. */
export async function fetchExistingNames(
  path: string,
  listFolder: (p: string) => Promise<{ content?: { name: string; is_dir: boolean }[] } | null>,
): Promise<Map<string, boolean>> {
  const res = await listFolder(path)
  const content = res?.content ?? []
  const map = new Map<string, boolean>()
  for (const entry of content) map.set(entry.name, !!entry.is_dir)
  return map
}

/** Filters candidates down to the ones whose name is already taken. */
export function findConflicts<T extends { name: string }>(
  candidates: T[],
  existingByName: Map<string, boolean>,
): T[] {
  return (candidates || []).filter((c) => existingByName.has(c.name))
}

/**
 * Walks a conflict queue one at a time through `decide` (typically wired to
 * opening FileConflictDialog and awaiting the user's choice), honouring the
 * "apply to all" checkbox the instant it is set: every remaining conflict
 * reuses that action and `decide` is never called again.
 *
 * A null/undefined choice means "stop asking" (Esc / close): this conflict and
 * every remaining one are marked 'cancelled'. Earlier decisions are never
 * rolled back — the caller surfaces that distinction to the user.
 */
export async function resolveConflictQueue(
  conflicts: ConflictCandidate[],
  decide: (
    conflict: ConflictCandidate,
    ctx: { index: number; total: number },
  ) => Promise<ConflictChoice | null | undefined>,
): Promise<ConflictResolution[]> {
  const results: ConflictResolution[] = []
  let forcedAction: ConflictAction | null = null
  for (let i = 0; i < conflicts.length; i++) {
    const conflict = conflicts[i]
    if (forcedAction) {
      results.push({ conflict, action: forcedAction })
      continue
    }
    const choice = await decide(conflict, { index: i, total: conflicts.length })
    if (!choice) {
      for (let j = i; j < conflicts.length; j++) results.push({ conflict: conflicts[j], action: 'cancelled' })
      break
    }
    results.push({ conflict, action: choice.action })
    if (choice.applyToAll) forcedAction = choice.action
  }
  return results
}
