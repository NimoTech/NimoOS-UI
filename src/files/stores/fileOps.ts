import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { parseFileOperate, filterActive, shouldReload, type FileTask } from '../util/fileOps'
import { useFilesStore } from './files'

// How a destination watch ended. 'finished' is the ONLY outcome meaning the
// backend actually carried the task out. 'aborted' covers CANCELLED, any other
// non-FINISHED terminal status, and a caller that stopped waiting; 'timeout'
// means no completion event ever arrived.
export type DestSettleOutcome = 'finished' | 'aborted' | 'timeout'

// Moving a large tree can run for minutes, so the wait has to be generous: this
// bound exists to stop registrations leaking, not to bound the operation.
const DEFAULT_SETTLE_TIMEOUT_MS = 5 * 60_000

// Every event repeats the whole task list, so a task that finished long ago
// keeps arriving. Remembering which ids were already reported finished lets a
// watch registered afterwards ignore them; the cap keeps that memory bounded in
// a long session.
const FINISHED_ID_MEMORY = 200

interface DestWatch {
  dest: string
  knownFinished: Set<string>
  resolve: (outcome: DestSettleOutcome) => void
  timer: ReturnType<typeof setTimeout>
}

export const useFileOpsStore = defineStore('files-ops', () => {
  const active = ref<FileTask[]>([])
  // Settable so a caller (or a test) can wait on a different budget.
  const settleTimeoutMs = ref(DEFAULT_SETTLE_TIMEOUT_MS)

  // Keyed by a per-registration id, and the id IS the guard: settle() removes
  // the entry before resolving, so a timer that fires after the event already
  // settled its watch -- or after cancel() -- finds nothing and does nothing.
  // No watch can be resolved twice, and none outlives its timer.
  let nextWatchId = 0
  const watches = new Map<number, DestWatch>()
  const finishedIds = new Set<string>()
  const finishedOrder: string[] = []

  function rememberFinished(id: string) {
    if (finishedIds.has(id)) return
    finishedIds.add(id)
    finishedOrder.push(id)
    while (finishedOrder.length > FINISHED_ID_MEMORY) {
      const dropped = finishedOrder.shift()
      if (dropped !== undefined) finishedIds.delete(dropped)
    }
  }

  function settle(id: number, outcome: DestSettleOutcome) {
    const w = watches.get(id)
    if (!w) return
    watches.delete(id)
    clearTimeout(w.timer)
    w.resolve(outcome)
  }

  // Wait until a file task that targets `dest` reports completion.
  //
  // `POST /v1/batch/task` only means the request was ACCEPTED -- the operation
  // itself runs as an async task and reports back over MessageBus. Its response
  // body carries no task id (measured on the device: a 43-byte standard
  // envelope with data:null), so `to` is the only correlation key there is; a
  // watch therefore reports on "a task that landed in this directory", not
  // strictly on the caller's own submission. Callers must treat the outcome as
  // permission to CHECK, not as proof.
  //
  // Register BEFORE submitting, or a fast completion slips through the gap.
  // Every returned watch must be settled: await `settled`, or call `cancel()`
  // when it turns out there is nothing to wait for.
  function watchDest(dest: string, timeoutMs = settleTimeoutMs.value) {
    const id = ++nextWatchId
    let resolve!: (outcome: DestSettleOutcome) => void
    const settled = new Promise<DestSettleOutcome>((res) => { resolve = res })
    const timer = setTimeout(() => settle(id, 'timeout'), timeoutMs)
    watches.set(id, { dest, knownFinished: new Set(finishedIds), resolve, timer })
    return { settled, cancel: () => settle(id, 'aborted') }
  }

  function settleWatches(tasks: FileTask[]) {
    const done = tasks.filter((t) => t.finished)
    if (!done.length) return
    // Snapshot the entries: settle() mutates the map while this iterates.
    for (const [id, w] of [...watches]) {
      const hit = done.find((t) => t.to === w.dest && !w.knownFinished.has(t.id))
      if (hit) settle(id, hit.status === 'FINISHED' ? 'finished' : 'aborted')
    }
    // After matching, never before: a watch registered by THIS event's handlers
    // must still see these ids as new, while later ones must not.
    for (const t of done) rememberFinished(t.id)
  }

  // socket 原始 props → 活动任务;完成且落当前目录则 reload(移植 Vue2 两个 socket handler 合一)
  function ingest(props: unknown) {
    const tasks = parseFileOperate(props)
    active.value = filterActive(tasks)
    const files = useFilesStore()
    if (shouldReload(tasks, files.currentPath)) files.load(files.currentPath)
    settleWatches(tasks)
  }

  async function cancelAll() {
    await service.batch.deleteTask(0) // 0 = 全部
  }

  return { active, settleTimeoutMs, ingest, cancelAll, watchDest }
})
