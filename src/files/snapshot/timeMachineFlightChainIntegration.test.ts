// A long fly-through was reported freezing ENTIRELY mid-flight --
// strips parked at intermediate poses (one mid-screen, one at the camera-mouth pose), static
// until a safety net finally reveals the real window. Frozen-at-intermediate-poses across ALL
// strips is the signature of the GSAP timeline being `.kill()`ed mid-flight, with the strips it
// had already started tweening never getting a second tween to replace it.
//
// Every EXISTING depth-stack test (TimeMachineDepthStack.test.ts) drives `browse.currentPath`
// by hand-setting `files.currentPath` directly, or mounts ONLY TimeMachineDepthStack.vue with
// the app router singleton mocked to a bare no-op `{ push: vi.fn(), replace: vi.fn() }` (see
// that file's own "flight integrity"/"store safety ceiling" describe blocks, and Files.test.ts's
// own explicit comment on case ⑤: "exitTimeMachine's own navigation goes through the app router
// SINGLETON (mocked to a no-op push/replace ...), so files.currentPath never actually moves off
// the .snapshots path here"). That mock is exactly why the real production bridge --
// switchTo() -> router.replace() -> Files.vue's own route watcher -> sync() -> files.load() ->
// files.currentPath flips -> parsed/currentSnapshotName recompute -- had never actually run
// end-to-end in this test suite before. This file closes that gap: it mounts the REAL Files.vue
// against a REAL vue-router instance, and rewires the app router SINGLETON (which
// snapshotBrowse.ts's own `navigateReal` imports) to be the exact SAME instance -- exactly how
// `main.ts`'s single `app.use(router)` call makes them identical in production. Router
// navigation and the target directory's own listing fetch are both given a REAL, independently
// controllable async delay (not a same-tick mock resolution), so the same asynchronous
// interleaving production has (and any transient intermediate state that interleaving can create)
// has a real chance to happen here too.
//
// WORKING HYPOTHESIS, AND WHAT ACTUALLY HAPPENED WHEN VERIFIED:
//
// The initial hypothesis was a SPURIOUS second fire of the `currentSnapshotName` watcher
// (TimeMachineDepthStack.vue) during ONE logical `switchTo()` -- e.g. a transient null, or a late
// re-fire once the real window's own files-store load lands -- bumping `travelRunToken` a second
// time and killing an in-flight timeline for nothing. The describe block below,
// 'flight -- exactly one runTravel per switchTo (hypothesis verification)', drives that exact
// chain through 12 different router-delay/listing-delay combinations (both directions, several
// orders of magnitude of relative timing) and found ZERO reproductions -- `playTravelTimeline` is
// called exactly once in every configuration. Reading the code explains why: the watcher already
// guards `if (!pendingTravel || newName !== pendingTravel.to) return` BEFORE ever touching
// `travelRunToken` -- a transient/mismatched value is already a safe no-op, structurally, not
// something that needed a new guard. This hypothesis, as literally stated, is
// DISPROVEN for this codebase as it stands.
//
// What full-chain testing DID surface -- the actual root cause -- is a DIFFERENT, real race:
// `src/files/stores/files.ts`'s own `load()` had NO epoch/generation guard (unlike its sibling
// `ensureVolumes()` in this same store, or `useFolderSizesStore()`, which already carry one for
// exactly this reason). Two `switchTo()` calls fired close together (a rapid rail re-click before
// the first one's own directory listing has resolved -- not an exotic timing coincidence, an
// ordinary fast double-click) race two `service.folder.getList()` calls with no cancellation and
// no epoch check; whichever RESPONSE happens to arrive last wins, regardless of which call was
// STARTED last. If the FIRST (now-stale) call's response is merely the slower of the two, it
// lands AFTER the second, correct one and silently overwrites `files.currentPath` back to the
// stale target -- with the route/rail still showing the (correct) second target. By the time this
// stale flip reaches TimeMachineDepthStack.vue's own `currentSnapshotName` watcher,
// `pendingTravel` has ALREADY been consumed by the second (legitimate) travel, so the watcher's
// own existing guard correctly ignores it -- no `runTravel()` call, no tween, nothing. But
// `currentIndex`/`dollySlots` still reactively recompute against the now-wrong selection, and
// because Vue's `v-tm-pose` directive only applies a pose on INSERT (never on update), every
// STILL-MOUNTED strip from the second (correct) travel is simply never told to move again --
// permanently frozen exactly where that travel's own tween last left it, which is exactly the
// reported symptom (strips parked mid-transition, static, until an unrelated safety net
// eventually reveals the real window over the now also-wrong content underneath).
//
// See the 'files.ts load() out-of-order race' describe block below for the RED (pre-fix) /
// GREEN (post-fix) evidence, and files.ts's own `load()` for the fix (an epoch counter, same
// pattern `ensureVolumes()`/`useFolderSizesStore()` already established).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory, type Router } from 'vue-router'
import zh from '../../i18n/zh_cn'
import Files from '../../views/Files.vue'
import { useFoldersStore } from '../../home/stores/folders'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import * as choreo from '../util/timeMachineChoreo'

// Holds the ONE router instance both the mocked singleton (below) and this file's own
// `global.plugins` mount option point at -- see this file's own header comment for why identity,
// not just behavioral equivalence, is what makes this repro faithful to production.
const routerHolder = vi.hoisted(() => ({ current: null as unknown as Router }))
vi.mock('../../router', () => ({
  get router() { return routerHolder.current },
}))

const listVolumesMock = vi.fn()
const snapshotListMock = vi.fn()
const getListMock = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: { getList: (...args: unknown[]) => getListMock(...args) },
    batch: { task: vi.fn().mockResolvedValue(undefined) },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}&type=thumbnail` },
    samba: { listConnections: vi.fn().mockResolvedValue([]) },
    cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
    snapshot: {
      listVolumes: () => listVolumesMock(),
      list: () => snapshotListMock(),
      restore: vi.fn(),
      getPolicy: vi.fn().mockResolvedValue({ hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 }),
    },
  },
  getHttp: () => ({ get: vi.fn(async () => ({ data: { data: [] } })) }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

const MOUNT = '/DATA'
const N = 60
const names = Array.from({ length: N }, (_, i) => `2026${String(1 + Math.floor(i / 28)).padStart(2, '0')}${String(1 + (i % 28)).padStart(2, '0')}T000000Z_auto`)

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// A REAL async delay before a navigation guard lets the navigation through (router delay) and
// before the folder listing fetch resolves (network delay) -- independently controllable, real
// timers (not fake), so this exercises the actual JS microtask/macrotask ordering production has,
// not an ordering only fake-timer bookkeeping happens to produce.
function makeRouter(routerDelayMs: number) {
  const r = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/files', name: 'files', component: Files },
      { path: '/files/:path(.*)*', name: 'files-path', component: Files },
    ],
  })
  r.beforeEach(async (_to, _from, next) => {
    if (routerDelayMs > 0) await sleep(routerDelayMs)
    next()
  })
  return r
}

let getListDelay = 15
const perPathDelay = new Map<string, number>()

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  getListDelay = 15
  perPathDelay.clear()
  ;(globalThis as any).IntersectionObserver = class {
    cb: (e: { isIntersecting: boolean }[]) => void
    constructor(cb: any) { this.cb = cb }
    observe() { this.cb([{ isIntersecting: true }]) }
    disconnect() {}
  }
  listVolumesMock.mockResolvedValue([{ volume_uuid: 'u1', mount: MOUNT, supported: true }])
  snapshotListMock.mockResolvedValue(names.map((n, i) => ({ name: n, created_at: `2026-01-${String(1 + (i % 28)).padStart(2, '0')}T00:00:00Z` })))
  // A real, independently controllable network delay per target path -- defaults to `getListDelay`
  // (module-level, changed per test), overridable per exact path via `perPathDelay` (used by the
  // out-of-order race suite below to make ONE specific call slower than another).
  getListMock.mockImplementation(async (path: string) => {
    await sleep(perPathDelay.get(path) ?? getListDelay)
    return { content: [{ name: 'x.txt', path: `${path}/x.txt`, is_dir: false }] }
  })
})

async function mountAtSnapshot(name: string, routerDelayMs: number = 0) {
  const folders = useFoldersStore()
  folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: MOUNT, usb: false }] as any })
  const router = makeRouter(routerDelayMs)
  routerHolder.current = router
  router.push(`/files/NimoOS-HD/.snapshots/${name}`)
  await router.isReady()
  const w = mount(Files, { global: { plugins: [router, i18n] }, attachTo: document.body })
  await flushPromises()
  await sleep(getListDelay + 20) // let the initial directory listing land
  await flushPromises()
  return { w, router }
}

describe('Time Machine flight -- exactly one runTravel per switchTo (hypothesis verification)', () => {
  // Router resolves quickly (5ms), the target listing arrives later (15ms, the module default) --
  // mirrors production's real ordering (route lands, THEN the new directory's own fetch resolves).
  for (const [label, fromIdx, toIdx] of [
    ['far OLDER jump (backward fly-through)', 10, 40] as const,
    ['far NEWER jump (forward fly-through)', 40, 10] as const,
  ]) {
    it(`${label}: exactly ONE runTravel/playTravelTimeline call, the timeline is never killed before it settles`, async () => {
      const spy = vi.spyOn(choreo, 'playTravelTimeline')
      const { w } = await mountAtSnapshot(names[fromIdx as number], 5)
      const browse = useSnapshotBrowseStore()
      expect(browse.tmActive).toBe(true) // sanity: auto-entered
      expect(browse.snapshotList.length).toBe(N) // sanity: the full list landed
      expect(Math.abs((toIdx as number) - (fromIdx as number))).toBeGreaterThan(choreo.TRAVEL_FLAT_STEPS) // sanity: a real fly-through

      spy.mockClear()
      const switchPromise = browse.switchTo(names[toIdx as number])

      // Interleave real waits across the whole travel -- long enough to cover the router's own
      // 5ms resolve, the listing's own 15ms fetch, AND the fly-through's own multi-hundred-ms GSAP
      // timeline, polling in small increments so a transient double-fire anywhere along the way
      // has every opportunity to actually happen (not just at one hand-picked instant).
      for (let i = 0; i < 40; i++) {
        await sleep(20)
        await flushPromises()
      }
      await switchPromise
      await sleep(choreo.TRAVEL_SAFETY_EXTRA_MS + choreo.TRAVEL_FLY_MAX_DURATION_MS)
      await flushPromises()

      expect(browse.currentSnapshotName).toBe(names[toIdx as number]) // sanity: the travel actually landed
      expect(browse.tmTravelActive).toBe(false) // sanity: settled, not still stuck mid-flight
      expect(spy).toHaveBeenCalledTimes(1)

      w.unmount()
    }, 15000)
  }

  // A dozen router-delay/listing-delay combinations, several orders of magnitude apart in both
  // directions (router slower than listing, listing slower than router, both near-instant, both
  // slow) -- the timing sweep that actually went looking for the hypothesized double-fire
  // (see this file's own header comment). None of these reproduce it.
  const combos: [number, number][] = [[0, 0], [0, 30], [30, 0], [50, 5], [5, 50], [1, 1], [100, 1], [1, 100], [10, 200], [200, 10]]
  for (const [routerDelay, listDelay] of combos) {
    it(`timing sweep router=${routerDelay}ms list=${listDelay}ms: still exactly ONE runTravel call`, async () => {
      getListDelay = listDelay
      const spy = vi.spyOn(choreo, 'playTravelTimeline')
      const { w } = await mountAtSnapshot(names[10], routerDelay)
      const browse = useSnapshotBrowseStore()
      spy.mockClear()
      const p = browse.switchTo(names[45])
      for (let i = 0; i < 60; i++) { await sleep(20); await flushPromises() }
      await p
      await sleep(choreo.TRAVEL_SAFETY_EXTRA_MS + choreo.TRAVEL_FLY_MAX_DURATION_MS)
      await flushPromises()
      expect(browse.currentSnapshotName).toBe(names[45])
      expect(spy).toHaveBeenCalledTimes(1)
      w.unmount()
    }, 20000)
  }
})

describe('files.ts load() out-of-order race during rapid re-supersede (the actual bug)', () => {
  // RED pre-fix / GREEN post-fix (files.ts's own load() epoch guard). Two switchTo() calls fired
  // in quick succession -- the SECOND before the FIRST's own directory listing has resolved (an
  // ordinary fast double rail-click, not a contrived timing coincidence). The first call's own
  // response is made the SLOWER of the two; without an epoch guard it lands last and silently
  // overwrites `files.currentPath`/`browse.currentSnapshotName` back to the stale first target --
  // exactly the state divergence that leaves the depth-stack's already-tweened strips frozen (see
  // this file's own header comment for the full mechanism).
  it('a SLOW first switchTo whose response lands AFTER a FAST second switchTo does not clobber currentSnapshotName back to the stale target', async () => {
    const { w } = await mountAtSnapshot(names[10])
    const browse = useSnapshotBrowseStore()

    const staleTargetPath = `${MOUNT}/.snapshots/${names[40]}`
    const freshTargetPath = `${MOUNT}/.snapshots/${names[45]}`
    perPathDelay.set(staleTargetPath, 300) // the FIRST click's own listing takes a while
    perPathDelay.set(freshTargetPath, 5) // the SECOND click's own listing lands quickly

    const pStale = browse.switchTo(names[40]) // clicked first
    await sleep(10) // its own router.replace() has landed, but getList() is still in flight (300ms)
    const pFresh = browse.switchTo(names[45]) // clicked second, before the first has resolved at all
    await Promise.allSettled([pStale, pFresh])

    await sleep(400) // let both getList() calls resolve, whichever order
    await flushPromises()
    await sleep(choreo.TRAVEL_SAFETY_EXTRA_MS + choreo.TRAVEL_FLY_MAX_DURATION_MS)
    await flushPromises()

    // The user's LAST action was clicking names[45] -- the route/rail reflect it, and the real
    // window (and the depth-stack's own currentSnapshotName) must land there, not silently revert
    // to the stale, late-arriving first response.
    //
    // RED (pre-fix, files.ts's own load() with no epoch guard):
    //   AssertionError: expected '20260213T000000Z_auto' to be '20260218T000000Z_auto'
    //   (i.e. currentSnapshotName reverted to names[40], the stale/slow first target, even though
    //   names[45] -- the fast, second, actually-intended target -- had already landed correctly)
    expect(browse.currentSnapshotName).toBe(names[45])
    w.unmount()
  }, 15000)
})
