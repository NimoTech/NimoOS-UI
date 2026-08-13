import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useFilesStore } from './files'
import {
  parseSnapshotBrowsePath, shouldGuardSnapshotView, findVolumeForPath, parseSnapshotsContainerPath,
  type SnapshotVolumeLike, type VolumesState,
} from '../util/snapshotPath'
import { performSnapshotRestore } from '../util/snapshotRestore'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'

// Shared state for snapshot browsing in the Files area: volume-list cache + read-only lock derived
// from currentPath + time-machine toggle. Corresponds to the snapshotVolumesState / isSnapshotView /
// currentSnapshotVolume / canShowSnapshotEntry / isSnapshotWheelOpen group of data + computed in
// Vue2 FilePanel.vue — in Vue2 they were scattered across a 3000-line component; gathering them
// into one store lets the write guard (useFileOps) and the context menu read the same verdict
// directly, without threading props through layers.
export const useSnapshotBrowseStore = defineStore('snapshotBrowse', () => {
  const status = ref<VolumesState['status']>('idle')
  const volumes = ref<SnapshotVolumeLike[]>([])
  const wheelOpen = ref(false)
  const restoring = ref(false)
  // The backend takes one path per call, so the loop below stays serial. What
  // it cannot stay is silent: picking forty files meant a disabled button and
  // no sign of life until every one of them had come back.
  const restoreProgress = ref<{ done: number; total: number } | null>(null)
  const files = useFilesStore()

  // Concurrent calls within one session share this single in-flight Promise, so Files-area mount and deep-link resolution don't each fire a request
  let inflight: Promise<void> | null = null

  // Stale-response guard (follows the volumeRequestUuid/snapshotsRequestUuid precedent in
  // src/storage/stores/snapshot.ts, style and naming copied; there staleness is judged by uuid, but
  // ensureVolumes here has no natural call argument to use as an identity, so an incrementing
  // generation counter is used instead): reset() bumps it by one. If a new ensureVolumes() call is
  // started after reset(), the old call — whenever it lands, success or failure — would silently
  // overwrite the new call's already-written state with stale data / a stale error. So before writing
  // state, confirm this generation hasn't been superseded; if it has, discard everything: don't write
  // state, don't touch inflight.
  let epoch = 0

  // Fetch once per session (same semantics as Vue2 ensureSnapshotVolumesLoaded). error is the session's
  // terminal state: snapshots are an optional feature (old backends 404 on all of /v2/snapshot/*), and
  // retrying after failure would just waste a request on every navigation; the error state already keeps
  // the read-only lock in shouldGuardSnapshotView, which is the safe side.
  async function ensureVolumes(): Promise<void> {
    if (status.value === 'ready' || status.value === 'error') return
    if (inflight) return inflight
    status.value = 'loading'
    const myEpoch = (epoch += 1)
    inflight = (async () => {
      try {
        const list = await service.snapshot.listVolumes()
        if (myEpoch !== epoch) return // stale response: superseded by reset() in the meantime, discard entirely
        volumes.value = Array.isArray(list) ? (list as SnapshotVolumeLike[]) : []
        status.value = 'ready'
      } catch (e) {
        if (myEpoch !== epoch) return
        console.warn('[snapshot-browse] load volumes failed', (e as Error)?.message)
        volumes.value = []
        status.value = 'error'
      } finally {
        if (myEpoch === epoch) inflight = null
      }
    })()
    return inflight
  }

  const parsed = computed(() => parseSnapshotBrowsePath(files.currentPath))
  const volumesState = computed<VolumesState>(() => ({ status: status.value, volumes: volumes.value }))

  // Review fix (Critical 1, round 2): the `<mount>/.snapshots` container directory itself — parseSnapshotBrowsePath
  // returns null for it (semantics unchanged; restore orchestration and others still depend on that null), so
  // shouldGuardSnapshotView(parsed) alone can't tell this level should lock too. Round 1's isSnapshotsContainerPath
  // rolled its own `volumes.some(...)` check, always false while volumes is empty (idle/loading/error) — all three
  // states leaked the lock, and error is ensureVolumes()'s terminal state for the session, so the leak persists for
  // the whole session (confirmed on recheck with a real probe). No second three-state check here: synthesize a
  // parsed object with snapshotName:'' for the container path and feed it to the same shouldGuardSnapshotView —
  // idle/loading/error stay locked automatically, the confirmed supported:false exemption is inherited too, and the
  // fail-safe direction can no longer diverge from the "a concrete snapshot is selected" path.
  const containerParsed = computed(() => parseSnapshotsContainerPath(files.currentPath))
  const isSnapshotsContainer = computed(() => shouldGuardSnapshotView(containerParsed.value, volumesState.value))
  /** Whether the read-only lock is active — dual check of path shape + volume confirmation; see snapshotPath.ts comments for the fail-safe direction */
  const isSnapshotView = computed(() => shouldGuardSnapshotView(parsed.value, volumesState.value) || isSnapshotsContainer.value)
  /** Hand the parse result to the banner/exit/restore consumers only when the lock is actually active */
  const browseInfo = computed(() => (isSnapshotView.value ? parsed.value : null))
  /** Which snapshot volume the current path falls under (longest mount prefix) — both the entry button and the time machine need its uuid/mount */
  const currentVolume = computed(() => findVolumeForPath(volumes.value, files.currentPath))

  const canShowEntry = computed(
    () => status.value === 'ready'
      && !!currentVolume.value
      && currentVolume.value.supported === true
      && !isSnapshotView.value,
  )

  function openWheel() { wheelOpen.value = true }
  function closeWheel() { wheelOpen.value = false }

  // Restore the selected entries. Multiple entries are submitted one by one (the backend accepts a
  // single path per call); restoring stays true throughout. The three entry points (banner / selection
  // toolbar / context menu) share this one flag — any in-flight one disables the other two.
  async function restore(entries: { path: string }[]): Promise<void> {
    if (restoring.value) return
    const list = entries || []
    if (!list.length) return
    const toast = useToast()
    const t = i18n.global.t
    restoring.value = true
    try {
      // Review fix (Important): volumes.value is the same ready data (reaching here means we're
      // already in a snapshot view — shouldGuardSnapshotView only confirms a real snapshot when
      // status==='ready', and all three restore entry points render only in that state), so there's
      // no need to refire GET /v2/snapshot/volumes for every selected item. Inject a function that
      // reads volumes.value synchronously instead; if (theoretically impossible, defensive fallback)
      // it really hasn't loaded, fetch once first, to avoid misreporting "no data yet" as every item
      // failing to restore.
      if (!volumes.value.length) await ensureVolumes()
      const results = []
      restoreProgress.value = { done: 0, total: list.length }
      for (const item of list) {
        results.push(await performSnapshotRestore({
          item,
          info: browseInfo.value,
          listVolumes: async () => volumes.value,
          restore: (body) => service.snapshot.restore(body),
        }))
        restoreProgress.value = { done: results.length, total: list.length }
      }
      const ok = results.filter((r) => r.ok) as { ok: true; restoredPath: string }[]
      const failed = results.filter((r) => !r.ok) as { ok: false; reason: string }[]
      // Review fix: mixed results (some succeed, some fail) must not report only the failures — the
      // entries that actually restored would be silently swallowed. Three outcomes, three paths: all
      // succeed uses the original copy; all fail uses the specific-reason copy; mixed results get one
      // new combined message — human decision: drop the specific failure reasons (no more stacking
      // 404/400/other copy), report only the success/failure counts.
      if (failed.length === 0) {
        if (ok.length === 1) toast.show(t('snapBrowseRestored', { path: ok[0].restoredPath }))
        else if (ok.length > 1) toast.show(t('snapBrowseRestoredN', { n: ok.length }))
      } else if (ok.length > 0) {
        toast.show(t('snapBrowseRestoredPartial', { ok: ok.length, fail: failed.length }))
      } else {
        const reason = failed[0].reason
        toast.show(
          reason === 'not-found' ? t('snapBrowseRestoreNotFound')
            : reason === 'invalid' ? t('snapBrowseRestoreInvalid')
              : t('snapBrowseRestoreFailed'),
        )
      }
    } finally {
      restoring.value = false
      restoreProgress.value = null
    }
  }

  function reset() {
    status.value = 'idle'
    volumes.value = []
    wheelOpen.value = false
    inflight = null
    epoch += 1 // supersede any still-in-flight old request so it can't land later and clobber newer results with stale data / a stale error
  }

  return {
    status, volumes, wheelOpen, restoring, restoreProgress,
    parsed, isSnapshotView, browseInfo, currentVolume, canShowEntry,
    ensureVolumes, openWheel, closeWheel, reset, restore,
  }
})
