import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useFilesStore } from './files'
import {
  parseSnapshotBrowsePath, shouldGuardSnapshotView, findVolumeForPath, parseSnapshotsContainerPath,
  snapshotBrowsePath, relPathUnderMount, resolveExitTarget,
  type SnapshotVolumeLike, type VolumesState,
} from '../util/snapshotPath'
import { performSnapshotRestore } from '../util/snapshotRestore'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'
import { router } from '../../router'
import { toVirtualPath, virtualPathToRouteParam } from '../util/pathUtils'
import type { SnapshotRaw } from '../../storage/util/snapshotView'

// Time Machine's own snapshot-list item — a straight alias of the /v2/snapshot list's raw shape
// (not the storage area's mapped SnapshotItemView): keeping `created_at` (not `createdAt`) lets a
// future consumer (Task 7's rail) hand this array straight to the already-accepted
// storage/util/snapshotView.groupSnapshotsByDay without a second field-renaming map in between.
export type SnapshotVM = SnapshotRaw

// Shared state for snapshot browsing in the Files area: volume-list cache + read-only lock derived
// from currentPath + time-machine toggle. Corresponds to the snapshotVolumesState / isSnapshotView /
// currentSnapshotVolume / canShowSnapshotEntry / isSnapshotWheelOpen group of data + computed in
// Vue2 FilePanel.vue — in Vue2 they were scattered across a 3000-line component; gathering them
// into one store lets the write guard (useFileOps) and the context menu read the same verdict
// directly, without threading props through layers.
export const useSnapshotBrowseStore = defineStore('snapshotBrowse', () => {
  const status = ref<VolumesState['status']>('idle')
  const volumes = ref<SnapshotVolumeLike[]>([])
  const restoring = ref(false)
  // Time Machine mode (Vue2-parity stage, Task 6+). tmActive drives TimeMachineStage.vue's own
  // decorative shell (glass/clone/depth-stack/rail/bottom-bar); tmLoading covers the initial
  // snapshot-list fetch on entry; tmTravel is non-null exactly while switchTo() is navigating
  // between two snapshots (a pure "is a navigation in flight" signal — see switchTo's own
  // comment for why its lifecycle is deliberately narrower than tmTravelActive below).
  const tmActive = ref(false)
  const snapshotList = ref<SnapshotVM[]>([])
  const tmLoading = ref(false)
  const tmTravel = ref<{ from: string | null; to: string | null } | null>(null)
  // Task 7 fix round (review finding 1, Vue2's own travelActive, ported): whether the real,
  // interactive window should stay hard-hidden (`.tm-fwin--traveling`, TimeMachineStage.vue) for
  // a switch currently in flight. Deliberately a SEPARATE flag from tmTravel, not a rename of it
  // — tmTravel's own "clears once the navigation settles" lifecycle (unchanged, still exactly
  // what switchTo's own router.replace await tracks) fires in single-digit milliseconds, long
  // before the depth-stack's own GSAP dolly sweep (420-900ms) or the target snapshot's own
  // preview listing have actually finished — releasing the hard-hide on THAT signal would reveal
  // the real window mid-animation on essentially every switch (the exact defect this fix round
  // addresses). tmTravelActive instead stays true until TimeMachineDepthStack.vue's own
  // reveal-gate (armReveal/settle, ported from Vue2's own armReveal/reveal — see that
  // component's own header comment) calls settleTravel() below, which happens only once BOTH the
  // travel's own duration has elapsed AND the target's own preview promise has settled (or a
  // safety ceiling elapses regardless) — see that component's own header comment for the full
  // mechanism this store only exposes the on/off switch for.
  const tmTravelActive = ref(false)
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

  /** Which snapshot the window is currently standing in, or null when not in a snapshot view at
   *  all — derived straight from browseInfo (already gated by isSnapshotView), never independently
   *  computed, so the two can never disagree about "are we in a snapshot right now". */
  const currentSnapshotName = computed(() => browseInfo.value?.snapshotName || null)

  // Push/replace the file browser to a REAL path, going through the same virtual-path route
  // encoding Files.vue's own goVirtual() uses (toVirtualPath + virtualPathToRouteParam) — the
  // route param is what the router (and Files.vue's route watcher) actually acts on; there is no
  // direct "set currentPath" shortcut. `replace` is used for in-session snapshot-to-snapshot
  // switching (switchTo) so a whole Time Machine session costs exactly one history entry no
  // matter how many snapshots get flipped through, matching Vue2's handleTimeMachineSwitch
  // push-vs-replace rule; entering/exiting Time Machine itself is a `push`, so the browser's
  // physical Back still returns to the folder the user came from.
  function navigateReal(realPath: string, opts: { replace?: boolean } = {}) {
    const to = '/files/' + virtualPathToRouteParam(toVirtualPath(realPath, files.displayNames))
    return opts.replace ? router.replace(to) : router.push(to)
  }

  // Fetches the flat, newest-first snapshot list for one volume (shared by enterTimeMachine and
  // refreshSnapshotList — the settings dialog calling the latter after creating a manual snapshot
  // is what makes the new tick appear without closing/reopening anything, Vue2 parity).
  async function fetchSnapshotList(uuid: string): Promise<void> {
    let raw: unknown
    try {
      raw = await service.snapshot.list(uuid)
    } catch (e) {
      console.warn('[snapshot-browse] load snapshot list failed', (e as Error)?.message)
      snapshotList.value = []
      return
    }
    const list = Array.isArray(raw) ? (raw as SnapshotVM[]) : []
    snapshotList.value = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  /** Re-fetch the current volume's snapshot list without touching tmActive/navigation — for the
   *  settings dialog's "a manual snapshot was just created" callback. */
  async function refreshSnapshotList(): Promise<void> {
    const uuid = currentVolume.value?.volume_uuid
    if (!uuid) return
    await fetchSnapshotList(uuid)
  }

  // Enter Time Machine: fetch this volume's snapshot list, then land the SAME window on the
  // newest snapshot at the CURRENT relative path (deliberate correction over Vue2 — see
  // TimeMachineOverlay.vue's own enterSnapshot comment for the same call: a user opening Time
  // Machine at /Photos/2024 should not be dumped back at the volume root). tmActive flips true
  // up front (not after the fetch) so the stage mounts immediately and shows its own loading
  // state, matching Vue2's isTimeMachineMode-set-on-click-then-fetch ordering.
  async function enterTimeMachine(): Promise<void> {
    if (!canShowEntry.value) return
    const vol = currentVolume.value
    if (!vol?.volume_uuid || !vol.mount) return
    tmActive.value = true
    tmLoading.value = true
    try {
      await fetchSnapshotList(vol.volume_uuid)
      const newest = snapshotList.value[0]
      if (newest) {
        const rel = relPathUnderMount(vol.mount, files.currentPath)
        const root = snapshotBrowsePath(vol.mount, newest.name)
        await navigateReal(rel ? `${root}/${rel}` : root)
      }
    } finally {
      tmLoading.value = false
    }
  }

  // Exit Time Machine: tmActive (and every live side effect gated on it, e.g. TimeMachineStage's
  // own keydown listener) drops SYNCHRONOUSLY — never wait on the navigation below to do that,
  // same "every live side effect stops immediately" posture as Vue2's isTimeMachineMode watcher.
  // The landing spot itself is Vue2's resolveSnapshotExitTarget semantics (ported as
  // resolveExitTarget in snapshotPath.ts): the same-named directory back on the live volume,
  // falling back to the volume root if it no longer exists there. browseInfo is read BEFORE
  // tmActive flips (isSnapshotView / browseInfo are only meaningful while still standing inside
  // the snapshot path) — fire-and-forget is fine here (exitTimeMachine itself stays synchronous,
  // per the store's own produced interface) since there is nothing left for the caller to await.
  function exitTimeMachine(): void {
    const info = browseInfo.value
    tmActive.value = false
    tmTravel.value = null
    // Task 7 fix round: a stuck-true tmTravelActive (e.g. the depth-stack component was
    // unmounted mid-travel, so nothing was ever going to call settleTravel()) must not survive
    // past leaving Time Machine mode entirely — the next entry starts clean.
    tmTravelActive.value = false
    if (!info) return
    resolveExitTarget(info, async (p) => {
      try { await service.folder.getList(p); return true } catch { return false }
    }).then((target) => {
      if (target) navigateReal(target)
    })
  }

  // Switch the SAME window to another snapshot, preserving the current relative path inside it
  // (Vue2's handleTimeMachineSwitch/M2-F6 "tick switching preserves the current relative path").
  // tmTravel is set BEFORE navigating and cleared once the navigation settles — a pure
  // "navigation in flight" signal, unchanged since Task 6. tmTravelActive (Task 7 fix round) is
  // set true at the SAME instant (mirroring Vue2's own beginTravel, called synchronously at
  // click time, before the async navigation) but is NOT cleared here — TimeMachineStage.vue
  // reads it (not tmTravel) to hard-cut `.tm-fwin--traveling`, and only settleTravel() below
  // (called by TimeMachineDepthStack.vue's own reveal-gate, once the travel has actually finished
  // animating AND the target's own preview is ready) clears it. See tmTravelActive's own comment
  // (above, in this store) for why the two flags' lifecycles are deliberately different.
  async function switchTo(name: string): Promise<void> {
    if (!name) return
    const vol = currentVolume.value
    if (!vol?.mount) return
    const from = currentSnapshotName.value
    if (from === name) return
    const rel = browseInfo.value?.relPath ?? ''
    tmTravel.value = { from, to: name }
    tmTravelActive.value = true
    try {
      const root = snapshotBrowsePath(vol.mount, name)
      await navigateReal(rel ? `${root}/${rel}` : root, { replace: true })
    } finally {
      tmTravel.value = null
    }
  }

  // Called by TimeMachineDepthStack.vue's own reveal-gate once a travel has actually settled
  // (Vue2's own reveal(token) — see that component's own header comment for the full
  // armReveal/reveal mechanism this store only exposes the on/off switch for). Idempotent/safe
  // to call after the gate's own superseded-travel check already no-oped — this store has no
  // opinion on WHICH travel is being settled, only "the real window may reveal now".
  function settleTravel(): void {
    tmTravelActive.value = false
  }

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
    inflight = null
    epoch += 1 // supersede any still-in-flight old request so it can't land later and clobber newer results with stale data / a stale error
    tmActive.value = false
    snapshotList.value = []
    tmLoading.value = false
    tmTravel.value = null
    tmTravelActive.value = false
  }

  return {
    status, volumes, restoring, restoreProgress,
    parsed, isSnapshotView, browseInfo, currentVolume, canShowEntry,
    tmActive, snapshotList, currentSnapshotName, tmLoading, tmTravel, tmTravelActive,
    ensureVolumes, reset, restore,
    enterTimeMachine, exitTimeMachine, switchTo, refreshSnapshotList, settleTravel,
  }
})
