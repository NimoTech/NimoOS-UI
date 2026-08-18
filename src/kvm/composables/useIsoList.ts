import { ref } from 'vue'
import type { Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { KvmISO } from '@nimotech/nimoos-service'
import { useMessageBus } from '../../composables/useMessageBus'

// ISO template list + download progress. **Must be created by KvmPage, lives with page lifecycle**,
// can't hang in OsSelector component — Vue2's OSSelector is permanently mounted
// (`v-if="visible"` on its own root node, component instance always alive), so its sockets
// keep receiving download progress: close dialog, download still progresses. New-UI if written
// intuitively with `v-if="showOSSelector"` unmounting component, progress breaks. Also consolidates
// Vue2's wasteful "GET /isos twice" (mounted once feeding osTemplates, open dialog fetch again
// feeding osList) — already declared deviation, spec §6.2.5 point 2.

export interface IsoRow extends KvmISO {
  _downloading: boolean
  _downloaded: boolean
  _progress: number
  _downloadedBytes: number
}

const EVT_PROGRESS = 'kvm:iso_download_progress'
const EVT_COMPLETE = 'kvm:iso_download_complete'
const EVT_FAILED = 'kvm:iso_download_failed'

function isoIdOf(props: unknown): string | undefined {
  if (props && typeof props === 'object') {
    const v = (props as Record<string, unknown>).iso_id
    if (typeof v === 'string' && v) return v
  }
  return undefined
}

export function useIsoList() {
  const isos: Ref<IsoRow[]> = ref([])
  const isLoading = ref(false)

  // In-place stale guard (hard constraint 2: don't extract common guard tool). Two different
  // mechanism layers, don't conflate:
  //
  // 1) `alive` check in `fetch()` is **load-bearing** — real `await` yield point there, dispose()
  //    can happen mid-request, must double-check `alive` at response settlement else write stale state.
  //
  // 2) `alive` checks in three event callbacks (`bus.on(...)`) are **depth defense, currently unreachable** —
  //    real blocker for "events don't write state after dispose" is **synchronous**
  //    `unsubs.forEach(off)` in dispose(): after unsubscribe, MessageBus won't call this callback at all,
  //    callback's `alive` check doesn't matter (verified by deleting: remove these three checks, existing
  //    "events arrive after dispose" case still all green, because it tests unsubscribe works, not
  //    this check). Keep it because once unsubscribe fails (e.g. future callback becomes async, does
  //    await refetch inside, or dispose() forgets an off()), this check flips from "ornament" to
  //    "last-ditch lifeline" — this repo's history has four times review caught "async writes shared
  //    state without stale guard" bugs. One test specifically disables this layer's main mechanism
  //    to verify this defense really blocks independently (see .test.ts "unsubscribe ineffective" +
  //    corresponding mutation check).
  let alive = true

  function findIso(id: string): IsoRow | undefined {
    return isos.value.find((o) => o.id === id)
  }

  // Single callback slot, same pattern as useVmList's onVncShouldConnect — only one consumer (KvmPage) for this task.
  let doneCb: ((row: IsoRow) => void) | null = null
  let failedCb: ((row: IsoRow) => void) | null = null
  function onDownloadDone(cb: (row: IsoRow) => void) { doneCb = cb }
  function onDownloadFailed(cb: (row: IsoRow) => void) { failedCb = cb }

  async function fetch(): Promise<void> {
    isLoading.value = true
    try {
      const list = await service.kvm.getISOList()
      if (!alive) return // stale guard: responses arriving after dispose don't write state
      // Follow Vue2 fetchOSList's status→flag mapping (OSSelector.vue:236-241).
      isos.value = list.map((item) => {
        const row: IsoRow = {
          ...item,
          _downloading: false,
          _downloaded: false,
          _progress: 0,
          _downloadedBytes: 0,
        }
        if (item.status === 'downloaded') {
          row._downloaded = true
        } else if (item.status === 'downloading') {
          row._downloading = true
          row._progress = item.progress || 0
        }
        return row
      })
    } catch {
      // Follow Vue2 fetchOSList's catch (:246-248): only console.error, don't clear existing list, no lastError.
      console.error('[useIsoList] Fetch ISO list failed')
    } finally {
      if (alive) isLoading.value = false
    }
  }

  async function download(id: string): Promise<void> {
    // Follow Vue2 downloadOS (:277-285): optimistically set _downloading/_progress first, then send request.
    const row = findIso(id)
    if (!row) return
    row._downloading = true
    row._progress = 0
    try {
      await service.kvm.downloadISO(id)
    } catch (e) {
      // ⚠️ Intentionally copies Vue2 (:282-284), not oversight: Vue2 treats download as backend async task,
      // POST failure might just be lost response while task actually started, so don't rollback optimistic
      // state, just log.
      console.warn('[useIsoList] downloadISO POST failed:', e instanceof Error ? e.message : e)
    }
    // Note: alive guard intentionally not short-circuit here — even arriving after dispose, this call
    // itself has no further shared state to write (optimistic state already written before request),
    // no additional pollution possible.
  }

  // ===================== MessageBus events (follow Vue2 sockets:146-175) =====================
  const bus = useMessageBus()
  const unsubs: (() => void)[] = []

  unsubs.push(bus.on(EVT_PROGRESS, (props) => {
    if (!alive) return // stale guard: events arriving after dispose don't write state
    const isoId = isoIdOf(props)
    const p = props as Record<string, unknown>
    const progress = parseFloat(String(p?.progress))
    const downloaded = parseFloat(String(p?.downloaded))
    if (!isoId || Number.isNaN(progress)) return
    const row = findIso(isoId)
    if (!row || !row._downloading) return
    row._progress = progress
    row._downloadedBytes = downloaded
  }))

  unsubs.push(bus.on(EVT_COMPLETE, (props) => {
    if (!alive) return
    const isoId = isoIdOf(props)
    if (!isoId) return
    const row = findIso(isoId)
    if (!row) return
    row._downloading = false
    row._downloaded = true
    row._progress = 100
    doneCb?.(row)
  }))

  unsubs.push(bus.on(EVT_FAILED, (props) => {
    if (!alive) return
    const isoId = isoIdOf(props)
    if (!isoId) return
    const row = findIso(isoId)
    if (!row) return
    row._downloading = false
    failedCb?.(row)
  }))

  function dispose(): void {
    alive = false
    unsubs.forEach((off) => off())
    unsubs.length = 0
  }

  return {
    isos,
    isLoading,
    fetch,
    download,
    onDownloadDone,
    onDownloadFailed,
    dispose,
  }
}
