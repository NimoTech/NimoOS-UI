// Orchestrates the upload same-name-conflict flow: fetches the target
// directory's current names, works out which top-level groups collide, walks
// the user through the dialog, and turns the answers into per-entry upload
// policies. Ported from Vue2 FilePanel.vue's _enqueueUploadEntriesNow.
import { ref, getCurrentScope, onScopeDispose, type Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { fetchExistingNames, resolveConflictQueue, type ConflictChoice, type ConflictCandidate } from '../upload/fileConflict'
import {
  computeUploadConflicts, splitConflictsByKind, applyUploadResolutions, applyInnerResolutions,
  type UploadEntry, type AcceptedEntry, type InnerPrecheckResult,
} from '../upload/uploadConflict'

export interface ConflictDialogState {
  open: boolean
  name: string
  targetPath: string
  isDir: boolean
  allowMerge: boolean
  queueIndex: number
  queueTotal: number
}

export interface ResolvedBatch {
  accepted: AcceptedEntry[]
  skippedCount: number
  cancelledCount: number
}

const CLOSED: ConflictDialogState = {
  open: false, name: '', targetPath: '', isDir: false, allowMerge: false, queueIndex: 0, queueTotal: 1,
}

export interface ResolveOptions {
  /**
   * Refill mode: resolve every folder-group collision as an implicit `merge`
   * without ever opening the dialog.
   *
   * A refill re-uploads the MISSING files of a partially-interrupted batch into
   * that batch's own target_path, so a folder upload's top segment ("Trip") is
   * already on disk — the interrupted batch created it. The collision is
   * self-inflicted by construction and there is exactly one correct answer:
   * merge back into the folder being refilled. Asking would put the user in
   * front of a question they cannot answer well, and a perfectly reasonable
   * "Keep both" would drop the remaining files into "Trip(1)/" while the
   * already-uploaded ones stay in "Trip/" — splitting one folder across two
   * directories and leaving the batch permanently incomplete.
   *
   * Only the FOLDER queue is short-circuited. Plain file-vs-file collisions
   * still prompt (those are real questions), and the merge's second round still
   * runs the per-path precheck, so inner files that genuinely collide are still
   * asked about one by one.
   */
  assumeMergeForFolders?: boolean
}

export interface UploadConflictDeps {
  listFolder?: (p: string) => Promise<{ content?: { name: string; is_dir: boolean }[] } | null>
  precheck?: (
    targetPath: string,
    files: { relativePath: string; size: number }[],
  ) => Promise<{ results: InnerPrecheckResult[] }>
}

export function useUploadConflicts(deps: UploadConflictDeps = {}) {
  const listFolder = deps.listFolder || ((p: string) => service.folder.getList(p))
  const precheck = deps.precheck || ((t: string, f: { relativePath: string; size: number }[]) => service.file.uploadPrecheck(t, f))

  const dialog: Ref<ConflictDialogState> = ref({ ...CLOSED })
  let resolver: ((c: ConflictChoice | null) => void) | null = null

  // Batches are resolved strictly one after another. The dialog state and its
  // resolver are singletons: two concurrent batches would overwrite the
  // resolver and leave the first batch awaiting forever, silently losing its
  // upload. `.then(run, run)` keeps the chain alive even if a batch throws.
  let chain: Promise<unknown> = Promise.resolve()

  function ask(conflict: ConflictCandidate, targetPath: string, ctx: { index: number; total: number }): Promise<ConflictChoice | null> {
    dialog.value = {
      open: true,
      name: conflict.name,
      targetPath,
      isDir: !!conflict.isDir,
      allowMerge: !!conflict.mergeable,
      queueIndex: ctx.index,
      queueTotal: ctx.total,
    }
    return new Promise<ConflictChoice | null>((res) => { resolver = res })
  }

  // Only toggles `open` off — the rest of the just-answered conflict's fields
  // (name/targetPath/isDir/...) are left in place. This matters for the
  // busy-wait pattern callers use to detect the NEXT conflict opening (round
  // 1 -> round 2 of a merge): `open` genuinely has to go false->true again so
  // that wait is not skipped, while a caller that reads `dialog.value` in the
  // same tick right after answering (before any next conflict exists) still
  // sees the conflict it just decided on, not a blanked-out shell. The full
  // reset to CLOSED happens once, at the very end of a batch, in `run()`.
  function settle(choice: ConflictChoice | null) {
    const r = resolver
    resolver = null
    dialog.value = { ...dialog.value, open: false }
    r?.(choice)
  }

  function onChoose(choice: ConflictChoice) { settle(choice) }
  function onCancel() { settle(null) }

  // The dialog lives inside whichever component owns this composable (today
  // Files.vue), but the batch it gates does not: navigating away mid-prompt
  // tears the dialog down while `run()` is still awaiting the answer. Without
  // this, `ask()`'s promise would never settle — `run()` never returns, the
  // caller never enqueues and never toasts, and the user's drop silently does
  // nothing at all. Settling as `null` routes it through the normal cancelled
  // path instead, so the caller reports it like any other cancel.
  // `getCurrentScope()` guard: this composable is also called directly in tests
  // (and could be called at module level), where onScopeDispose has no scope to
  // attach to and warns.
  if (getCurrentScope()) {
    onScopeDispose(() => { if (resolver) settle(null) })
  }

  async function run(entries: UploadEntry[], targetPath: string, opts: ResolveOptions): Promise<ResolvedBatch> {
    const passthrough = (): ResolvedBatch => ({
      accepted: entries.map((entry) => ({ file: entry.file, relativePath: entry.relativePath, conflictPolicy: '' as const })),
      skippedCount: 0,
      cancelledCount: 0,
    })
    if (!entries.length) return { accepted: [], skippedCount: 0, cancelledCount: 0 }

    // The dialog is only closed once, right when this batch is fully done
    // (every round, including a possible second merge round). Between two
    // asks in the SAME batch (round 1 -> round 2), `ask()` itself overwrites
    // the still-open dialog with the next conflict's fields — there is no
    // intermediate close, so a caller reading `dialog.value` right after
    // answering the current conflict still sees that conflict's own data
    // until either the next one replaces it or the batch finishes.
    try {
      // Only the network call is guarded. The pure functions below are
      // deliberately outside the try: an error there means an actual bug, and
      // swallowing it would quietly degrade into a bare enqueue.
      let existing: Map<string, boolean> | null = null
      try {
        existing = await fetchExistingNames(targetPath, listFolder)
      } catch (err) {
        console.warn('[upload] listing the target directory failed — conflict detection degraded, everything enqueued as-is', err)
      }
      if (!existing) return passthrough()

      const conflicts = computeUploadConflicts(entries, existing)
      if (!conflicts.length) return passthrough()

      // Round 1: two independent queues, each with its own apply-to-all —
      // that independence is only about applyToAll, not about Cancel.
      // FileConflictDialog.vue documents Cancel (Esc / outside click) as
      // "stop asking about the rest of THIS BATCH", and resolveConflictQueue
      // only cancels the rest of the one queue it was given. So a Cancel in
      // the folder queue must not let the file queue re-open the dialog for
      // an unrelated conflict — the folder queue runs first, so checking its
      // outcome before ever touching the file queue is enough to cover the
      // whole batch. The file conflicts are synthesized as 'cancelled'
      // resolutions rather than skipped over, so applyUploadResolutions still
      // folds them into cancelledCount instead of silently dropping them (and
      // they must not be miscounted as skipped either).
      const { folderConflicts, fileConflicts } = splitConflictsByKind(conflicts, entries, existing)
      // Refill mode answers the folder queue for the user — see the comment on
      // ResolveOptions.assumeMergeForFolders for why "merge" is the only correct
      // answer there. A non-mergeable folder conflict (the target holds a FILE of
      // that name) cannot be merged at all; applyUploadResolutions degrades those
      // to keep-both exactly as it would if the dialog had never offered Merge.
      const folderResolutions = !folderConflicts.length
        ? []
        : opts.assumeMergeForFolders
          ? folderConflicts.map((conflict) => ({ conflict, action: 'merge' as const }))
          : await resolveConflictQueue(folderConflicts, (c, ctx) => ask(c, targetPath, ctx))
      const folderCancelled = folderResolutions.some((r) => r.action === 'cancelled')
      const fileResolutions = !fileConflicts.length
        ? []
        : folderCancelled
          ? fileConflicts.map((conflict) => ({ conflict, action: 'cancelled' as const }))
          : await resolveConflictQueue(fileConflicts, (c, ctx) => ask(c, targetPath, ctx))

      const existingNames = new Set(existing.keys())
      const applied = applyUploadResolutions(entries, [...folderResolutions, ...fileResolutions], existingNames)
      let skippedCount = applied.skippedCount
      let cancelledCount = applied.cancelledCount

      const mergeEntries = applied.accepted.filter((entry) => entry.pendingInnerCheck)
      let settled = applied.accepted.filter((entry) => !entry.pendingInnerCheck)

      // Same rule as the folder->file guard above, applied to round 2: Cancel
      // means "stop asking about the rest of THIS BATCH", and round 2 is still
      // this batch. Without it, cancelling the a.txt prompt closes the dialog
      // and it immediately reopens for Trip/1.jpg — the inner files of a folder
      // merged in round 1. The entries fold into cancelledCount rather than
      // skippedCount: the two are reported separately and mean different things
      // (the user chose to skip vs. the user stopped answering).
      const batchCancelled = folderCancelled || fileResolutions.some((r) => r.action === 'cancelled')

      if (mergeEntries.length && batchCancelled) {
        cancelledCount += mergeEntries.length
      } else if (mergeEntries.length) {
        let innerResults: InnerPrecheckResult[] | null = null
        try {
          const res = await precheck(targetPath, mergeEntries.map((entry) => ({ relativePath: entry.relativePath, size: entry.file.size })))
          innerResults = res?.results ?? []
        } catch (err) {
          console.warn('[upload] inner precheck failed — merged-folder conflict detection degraded, entries enqueued as-is', err)
        }

        if (!innerResults) {
          settled = settled.concat(mergeEntries.map((entry) => ({ file: entry.file, relativePath: entry.relativePath, conflictPolicy: '' as const })))
        } else {
          // Round 2: only the paths the backend reports as existing become a
          // second queue. The displayed name is the relativePath itself so the
          // user can tell which inner file this is.
          const resultByPath = new Map(innerResults.map((r) => [r.relativePath, r]))
          const innerConflicts: ConflictCandidate[] = mergeEntries
            .filter((entry) => resultByPath.get(entry.relativePath)?.exists)
            .map((entry) => ({ name: entry.relativePath, isDir: !!resultByPath.get(entry.relativePath)!.is_dir, groupKey: entry.relativePath }))

          const innerResolutions = innerConflicts.length
            ? await resolveConflictQueue(innerConflicts, (c, ctx) => ask(c, targetPath, ctx))
            : []

          const innerApplied = applyInnerResolutions(mergeEntries, innerResults, innerResolutions)
          settled = settled.concat(innerApplied.accepted)
          skippedCount += innerApplied.skippedCount
          cancelledCount += innerApplied.cancelledCount
        }
      }

      return { accepted: settled, skippedCount, cancelledCount }
    } finally {
      dialog.value = { ...CLOSED }
    }
  }

  function resolveEntries(entries: UploadEntry[], targetPath: string, opts: ResolveOptions = {}): Promise<ResolvedBatch> {
    const next = chain.then(() => run(entries, targetPath, opts), () => run(entries, targetPath, opts))
    // Swallow on the CHAIN copy only, so a rejected batch never breaks the
    // queue; the caller's own promise still rejects normally.
    chain = next.then(() => undefined, () => undefined)
    return next
  }

  return { dialog, onChoose, onCancel, resolveEntries }
}
