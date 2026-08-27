import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useFilesStore } from './files'
import {
  parseSnapshotBrowsePath, shouldGuardSnapshotView, findVolumeForPath, parseSnapshotsContainerPath,
  snapshotBrowsePath, relPathUnderMount, resolveExitTarget,
  type SnapshotVolumeLike, type VolumesState,
} from '../util/snapshotPath'
import { executeRestoreBatch, buildRestoreToasts, type RestoreItem } from '../util/snapshotRestore'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'
import { router } from '../../router'
import { toVirtualPath, virtualPathToRouteParam } from '../util/pathUtils'
import { useFileConflictsStore } from './fileConflicts'
import type { SnapshotRaw } from '../../storage/util/snapshotView'
import {
  EXIT_CHROME_HOLD_SAFETY_TIMEOUT_MS, TRAVEL_MAX_DURATION_MS, TRAVEL_FLY_MAX_DURATION_MS,
  TRAVEL_SAFETY_EXTRA_MS, TRAVEL_STORE_SAFETY_MARGIN_MS,
} from '../util/timeMachineChoreo'
import { tmDebugLog } from '../util/tmDebug'

// Time Machine's own snapshot-list item — a straight alias of the /v2/snapshot list's raw shape
// (not the storage area's mapped SnapshotItemView): keeping `created_at` (not `createdAt`) lets a
// future consumer (Task 7's rail) hand this array straight to the already-accepted
// storage/util/snapshotView.groupSnapshotsByDay without a second field-renaming map in between.
export type SnapshotVM = SnapshotRaw

// Function the picker's real call site (RestoreDestinationModal, mounted once by Files.vue per T13)
// is handed in as — the store cannot hold a component ref itself, so `restoreItems` below takes it
// as a parameter instead, the same "store owns state/orchestration, caller supplies the one piece
// it can't" split T6's own `navigateReal`/router-singleton precedent already set.
export type OpenRestorePicker = (mount: string, defaultDir: string) => Promise<{ destDir: string; withMarker: boolean } | null>

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
  // Final review (Important 5, Ruling F-2): the "held chrome" flag -- Vue2's own
  // isTimeMachineChromeVisible (FilePanel.vue). Entering flips it true in lockstep with tmActive
  // (nothing to wait for), but EXITING does NOT drop it in lockstep -- it stays true until the
  // exit navigation's target directory listing has actually landed (isExitTargetReady below),
  // capped by a safety timer, so the un-shrinking real window never flashes the OLD snapshot
  // listing + banner while the navigation is still in flight. This is what TimeMachineStage.vue's
  // own `active` prop and Files.vue's own banner-hide gate (bannerInfo) are driven by -- NOT
  // tmActive directly -- see the watchers below for the full token+timer mechanism, ported from
  // FilePanel.vue's own isTimeMachineMode/isExitTargetReady watcher pair.
  const tmChromeVisible = ref(false)
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

  // Task 10 (deep-link auto-enter): mirrors Vue2 FilePanel.vue's own shouldAutoEnterTimeMachine
  // computed verbatim. `parsed.value` (not isSnapshotView) is the path-shape check deliberately —
  // isSnapshotView is a broader FAIL-SAFE flag (also true while status is idle/loading/error, or
  // while the volume match is merely unconfirmed), which is correct for the write-lock but wrong
  // here: this computed must stay false until the volume is POSITIVELY confirmed supported, never
  // guess. parsed.value is also null for the bare `<mount>/.snapshots` container path (no snapshot
  // name to land on), which correctly excludes that level from auto-entering, same as Vue2's own
  // parseSnapshotBrowsePath returning null there.
  //
  // Loop-avoidance note (see Files.vue's own watcher comment for the full mechanism): this
  // computed is deliberately NOT also gated on `!tmActive` — exitTimeMachine() flips tmActive
  // false SYNCHRONOUSLY, one statement before its own (async) navigation away actually lands, and
  // during that gap files.currentPath (hence parsed) is still the OLD `.snapshots/...` path, so
  // this would still evaluate true. Had it depended on tmActive too, the watcher would see the
  // value flip false->true->false->true and could re-fire; by leaving tmActive out entirely, the
  // value simply stays true, unchanged, across the whole exit gap — nothing for a change-triggered
  // watcher to react to. Vue2's own shouldAutoEnterTimeMachine computed carries the identical
  // omission for the identical reason (see its own header comment).
  const shouldAutoEnter = computed(
    () => !!parsed.value
      && status.value === 'ready'
      && !!currentVolume.value
      && currentVolume.value.supported === true,
  )

  // Final review (Important 5, Ruling F-2): Vue2's own isExitTargetReady computed (FilePanel.vue)
  // -- true once it is actually safe to drop the Time Machine chrome: no longer inside guarded
  // snapshot content (isSnapshotView) AND the newly-targeted directory's own listing has actually
  // finished loading (files.loading false). Depending on isSnapshotView alone would release too
  // early on a fresh network round trip (the OLD snapshot rows would still be on screen while the
  // new ones are still in flight) -- files.load() flips currentPath/entries and loading together,
  // in the same synchronous burst (see that store's own load(), the success/failure branches both
  // set currentPath before the `finally` clears loading), so both conditions settle atomically.
  const isExitTargetReady = computed(() => !isSnapshotView.value && !files.loading)

  // The exit-hold token+timer pair -- ported from Vue2's own exitHoldToken/exitHoldSafetyTimer
  // (FilePanel.vue). `token` guards against a stale timer (from an exit that has since been
  // superseded by a re-entry, or by isExitTargetReady itself already settling the hold) still
  // firing and clobbering a NEWER hold's own in-progress wait.
  let exitHoldToken = 0
  let exitHoldSafetyTimer: ReturnType<typeof setTimeout> | null = null
  function clearExitHoldSafetyTimer() {
    if (exitHoldSafetyTimer !== null) { clearTimeout(exitHoldSafetyTimer); exitHoldSafetyTimer = null }
  }

  // Ported verbatim from Vue2's own `isTimeMachineMode(val) { ... }` watcher (FilePanel.vue,
  // "the exit-hold itself"). `flush: 'sync'` so tmChromeVisible updates in the SAME synchronous
  // burst tmActive itself does -- TimeMachineStage.vue's own `active` computed and Files.vue's own
  // bannerInfo/bannerIsContainer computeds read tmChromeVisible, not tmActive, and must never lag
  // a render behind it (mirrors this same file's TimeMachineStage.vue precedent for its own
  // `active` watcher).
  watch(tmActive, (val) => {
    exitHoldToken += 1
    const token = exitHoldToken
    clearExitHoldSafetyTimer()
    if (val) {
      // Entering: nothing to wait for -- release (raise) immediately, and drop any hold a just-
      // superseded exit might still have had pending (a rapid exit-then-reenter).
      tmChromeVisible.value = true
      return
    }
    if (isExitTargetReady.value) {
      // The common already-settled case -- nothing to hold for, drop immediately.
      tmChromeVisible.value = false
      return
    }
    // Hold tmChromeVisible at its current `true` value (do NOT flip it here) until the
    // isExitTargetReady watcher below settles it, capped by this safety timer so a hung
    // navigation can never wedge the chrome open forever.
    exitHoldSafetyTimer = setTimeout(() => {
      exitHoldSafetyTimer = null
      if (token !== exitHoldToken) return
      tmChromeVisible.value = false
    }, EXIT_CHROME_HOLD_SAFETY_TIMEOUT_MS)
  }, { flush: 'sync' })

  // Ported verbatim from Vue2's own `isExitTargetReady(val) { ... }` watcher -- the OTHER half of
  // the hold above, fires once the navigation genuinely lands. Guarded so it can only ever settle
  // a hold that is actually pending (tmActive already false AND the chrome is still up) --
  // otherwise this would also fire (harmlessly redundantly) on every ordinary navigation while
  // STILL inside Time Machine mode, or while not in it at all.
  watch(isExitTargetReady, (val) => {
    if (val && !tmActive.value && tmChromeVisible.value) {
      exitHoldToken += 1
      clearExitHoldSafetyTimer()
      tmChromeVisible.value = false
    }
  }, { flush: 'sync' })

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

  // Task 10: deep-link / bookmark / Storage-timeline-browse auto-enter. UNLIKE enterTimeMachine
  // above, this never navigates — by the time shouldAutoEnter is true, files.currentPath is
  // ALREADY sitting on the exact `.snapshots/<name>/<rel>` path the caller asked for (a pasted
  // URL, a bookmark, or SnapshotTimeline.vue's own browse() link via Files.vue's sync()), so
  // there is nothing to land the window on that it isn't already standing on — only the snapshot
  // LIST needs fetching (rail/stepper read browse.snapshotList, populated so far only by
  // enterTimeMachine/switchTo/refreshSnapshotList, none of which run on a fresh deep-linked
  // mount). Idempotent by construction: called from Files.vue's `watch(shouldAutoEnter, ...)`,
  // which (per shouldAutoEnter's own comment) does not re-fire while already active, but this
  // guard is kept as a second, defensive line — safe to call redundantly, matching Vue2's own
  // `if (val) this.isTimeMachineMode = true` being a no-op when already true.
  async function autoEnterTimeMachine(): Promise<void> {
    if (tmActive.value) return
    const vol = currentVolume.value
    if (!vol?.volume_uuid) return
    tmActive.value = true
    tmLoading.value = true
    try {
      await fetchSnapshotList(vol.volume_uuid)
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
  // Folded minor #7 (final review, Ruling F-3): a store-side safety ceiling for tmTravelActive,
  // independent of TimeMachineDepthStack.vue's own reveal-gate safety timer. That component's own
  // timer only exists while the component itself is mounted (active/fadingOut) -- if it were ever
  // torn down mid-travel some other way (before calling settleTravel()), tmTravelActive would stay
  // stuck true forever, hard-hiding the real window (`.tm-fwin--traveling`) permanently. This
  // backstop reuses the SAME constants the depth-stack's own timer is built from
  // (timeMachineChoreo.ts) as a flat worst-case ceiling (switchTo has no step-count of its own to
  // compute a tighter duration from), token-guarded the same way the exit-hold above is: a later
  // switchTo, or a legitimate settleTravel(), invalidates any still-pending earlier timer.
  //
  // Fix wave J (owner acceptance 2026-08-26, found during a direction/root-cause audit of a
  // reported stuck-strip defect): this ceiling used to be `TRAVEL_MAX_DURATION_MS +
  // TRAVEL_SAFETY_EXTRA_MS` (900 + 800 = 1700ms) -- the OLD, pre-wave-H "single uniform stack
  // slide" duration's own worst case. Wave H's own long-jump fly-through introduced a SEPARATE,
  // LARGER worst-case duration (`TRAVEL_FLY_MAX_DURATION_MS` = 1400ms, TimeMachineDepthStack.vue's
  // own `armReveal` safety timer already uses `flyThroughDurationMs(plan) + TRAVEL_SAFETY_EXTRA_MS`,
  // up to 1400 + 800 = 2200ms) but this store-side backstop was never updated to match -- for a
  // maximally-long fly-through, THIS timer could fire (forcing `tmTravelActive = false`, revealing
  // the real window) up to 500ms BEFORE the depth-stack's own reveal-gate would naturally settle.
  // `Math.max(...)` keeps this the genuine worst case across BOTH travel models, present and future,
  // rather than silently falling behind again the next time either duration changes.
  //
  // Fix wave J follow-up (re-review finding (a), owner acceptance 2026-08-26): this timer is armed
  // SYNCHRONOUSLY right here, at click time -- STRICTLY EARLIER than `armReveal`'s own timer, which
  // only arms once `currentSnapshotName` has actually changed and a further `nextTick()` has run.
  // Sharing the IDENTICAL nominal worst-case duration with something armed strictly later is a
  // latent tie: an integration test driving a maximal fly-through through this exact function
  // found a comfortable ~450ms margin under TODAY's real constants (see this wave's own
  // final-fix-report.md for the measured numbers and the test itself), but nothing structurally
  // guarantees that margin survives a future change to the fly-through duration formula's own
  // constants. `TRAVEL_STORE_SAFETY_MARGIN_MS` (timeMachineChoreo.ts) closes the tie outright,
  // independent of today's specific headroom.
  let travelSafetyToken = 0
  let travelSafetyTimer: ReturnType<typeof setTimeout> | null = null
  function clearTravelSafetyTimer() {
    if (travelSafetyTimer !== null) { clearTimeout(travelSafetyTimer); travelSafetyTimer = null }
  }

  async function switchTo(name: string): Promise<void> {
    if (!name) return
    const vol = currentVolume.value
    if (!vol?.mount) return
    const from = currentSnapshotName.value
    if (from === name) return
    const rel = browseInfo.value?.relPath ?? ''
    tmDebugLog('store switchTo:', from, '->', name)
    tmTravel.value = { from, to: name }
    tmTravelActive.value = true
    travelSafetyToken += 1
    const safetyToken = travelSafetyToken
    clearTravelSafetyTimer()
    travelSafetyTimer = setTimeout(() => {
      travelSafetyTimer = null
      if (safetyToken !== travelSafetyToken) return
      tmDebugLog('settle (path: store-safety ) -- switchTo() own flat ceiling fired, tmTravelActive forced false')
      tmTravelActive.value = false
    }, Math.max(TRAVEL_MAX_DURATION_MS, TRAVEL_FLY_MAX_DURATION_MS) + TRAVEL_SAFETY_EXTRA_MS + TRAVEL_STORE_SAFETY_MARGIN_MS)
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
  // opinion on WHICH travel is being settled, only "the real window may reveal now". Also
  // invalidates/clears this store's own safety backstop above -- the legitimate settle already
  // happened, so that timer (if still pending) must not fire again later.
  function settleTravel(): void {
    travelSafetyToken += 1
    clearTravelSafetyTimer()
    tmTravelActive.value = false
  }

  // Full Vue2-parity restore orchestration (Task 14) — the single funnel every entry point (context-menu
  // single item, banner/bottom-bar selection, whole-folder confirm) converges into after computing its
  // own `items`/`defaultDir`: destination picker -> (skipped when withMarker is on) same-name-conflict
  // queue via the shared FileConflictDialog -> serial execution -> aggregate toast(s). `restoring` is
  // held true for the WHOLE sequence (Vue2's own runRestoreWithConflictCheck: the picker/conflict-queue
  // phase must disable the other two entry points too, not just the network calls), and the three entry
  // points still share this one flag — any in-flight one disables the other two.
  //
  // `opts.singleItemFlow` (controller ruling, fix round 1): purely a pass-through to
  // buildRestoreToasts (see that function's own comment) so the CALLER (Files.vue's
  // `restoreSingleItem`, the context-menu entry point) decides the success-toast copy, not this
  // function inferring it from `items.length` — a selection of exactly one item (banner/bottom bar)
  // must still show Vue2's `tmRestoredCount` copy, not the context-menu-only `snapBrowseRestored` one.
  async function restoreItems(
    items: RestoreItem[],
    defaultDir: string,
    openPicker: OpenRestorePicker,
    opts: { singleItemFlow?: boolean } = {},
  ): Promise<void> {
    if (restoring.value) return
    const info = browseInfo.value
    if (!info || !items.length) return
    const toast = useToast()
    const t = i18n.global.t
    restoring.value = true
    try {
      const choice = await openPicker(info.mount, defaultDir)
      if (!choice) return // Cancel/Esc/close on the picker — true no-op, no restore call ever made.

      // Review fix (Important, kept from the pre-Task-14 version): volumes.value is the same ready
      // data (reaching here means we're already in a snapshot view), so there's no need to refire
      // GET /v2/snapshot/volumes for every selected item — inject a function that reads volumes.value
      // synchronously instead; if it really hasn't loaded yet (defensive fallback), fetch once first.
      if (!volumes.value.length) await ensureVolumes()

      const conflicts = useFileConflictsStore()
      const { entries, skippedCount } = await conflicts.resolveRestore(items, choice.destDir, choice.withMarker)
      if (entries.length === 0) {
        if (skippedCount > 0) toast.show(t('filesUploadSkipped', { count: skippedCount }))
        return
      }

      restoreProgress.value = { done: 0, total: entries.length }
      const outcomes = await executeRestoreBatch({
        entries,
        info,
        destDir: choice.destDir,
        withMarker: choice.withMarker,
        listVolumes: async () => volumes.value,
        restore: (body) => service.snapshot.restore(body),
        onProgress: (done, total) => { restoreProgress.value = { done, total } },
      })
      for (const msg of buildRestoreToasts(outcomes, skippedCount, { singleItemFlow: opts.singleItemFlow })) {
        toast.show(t(msg.key, msg.params ?? {}), undefined, msg.tier)
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
    parsed, isSnapshotView, browseInfo, currentVolume, canShowEntry, shouldAutoEnter,
    tmActive, tmChromeVisible, snapshotList, currentSnapshotName, tmLoading, tmTravel, tmTravelActive,
    ensureVolumes, reset, restoreItems,
    enterTimeMachine, autoEnterTimeMachine, exitTimeMachine, switchTo, refreshSnapshotList, settleTravel,
  }
})
