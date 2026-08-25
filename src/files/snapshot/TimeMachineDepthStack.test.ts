// Task 7 (Files Time Machine Vue2-parity line): TimeMachineDepthStack.vue's own component test --
// slot windowing/keying stability, switch-driven re-slotting, pin-during-travel presence,
// reduced-motion synchronous completion, and gsap context cleanup on unmount. See
// TimeMachineDepthStack.vue's own header comment for the full mechanism this exercises, and
// timeMachineMath.test.ts / timeMachineChoreo.test.ts for the pure-function layer this component
// wires together (not re-tested here).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import gsap from 'gsap'
import TimeMachineDepthStack from './TimeMachineDepthStack.vue'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import { useFilesStore } from '../stores/files'
import { resolveDollySlots } from '../util/timeMachineMath'
import * as choreo from '../util/timeMachineChoreo'
import { getSnapshotPreview, type SnapshotPreviewEntry } from '../util/snapshotPreviewCache'

const listVolumesMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { snapshot: { listVolumes: () => listVolumesMock(), list: vi.fn(), restore: vi.fn() }, folder: { getList: vi.fn() } },
}))
vi.mock('../../router', () => ({ router: { push: vi.fn(), replace: vi.fn() } }))
// SnapshotPreviewWindow (mounted once per visible strip) fetches its own listing -- stub it so this
// suite exercises slot wiring only, not that component's own already-tested fetch behavior (see
// SnapshotPreviewWindow.test.ts for that contract). The SAME mock backs the reveal-gate's own
// `getSnapshotPreview` call (this component's own header comment: it reuses the identical cache
// key), so per-test control over ITS resolution timing is what the reveal-gate describe block
// below exercises.
vi.mock('../util/snapshotPreviewCache', () => ({ getSnapshotPreview: vi.fn().mockResolvedValue({ entries: [], error: false }) }))
const getSnapshotPreviewMock = vi.mocked(getSnapshotPreview)

const MOUNT = '/media/RAID_0'

async function setup(names: string[], currentName: string, relPath = '') {
  const browse = useSnapshotBrowseStore()
  const files = useFilesStore()
  listVolumesMock.mockResolvedValue([{ volume_uuid: 'u1', mount: MOUNT, supported: true }])
  await browse.ensureVolumes()
  // Bypasses fetchSnapshotList (network) -- snapshotList is a plain writable ref, same convention
  // snapshotBrowse.test.ts itself uses for state not under test here.
  browse.snapshotList = names.map((n, i) => ({ name: n, created_at: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z` }))
  files.currentPath = relPath ? `${MOUNT}/.snapshots/${currentName}/${relPath}` : `${MOUNT}/.snapshots/${currentName}`
  return { browse, files }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  // `vi.clearAllMocks()` wipes call history but NOT a custom `mockImplementation`/`mockReturnValue`
  // a test further down installs on `getSnapshotPreviewMock` to control the reveal-gate's own
  // timing -- reset it back to the default resolved behavior every test starts with.
  getSnapshotPreviewMock.mockReset()
  getSnapshotPreviewMock.mockResolvedValue({ entries: [], error: false })
})

afterEach(() => {
  // @ts-expect-error -- test-only cleanup of a stubbed global (T3's own convention, timeMachineChoreo.test.ts)
  delete window.matchMedia
})

describe('TimeMachineDepthStack — slot windowing/keying', () => {
  it('renders exactly one strip per resolveDollySlots entry, keyed by snapshot name', async () => {
    const names = Array.from({ length: 15 }, (_, i) => `s${i}`) // s0 newest .. s14 oldest
    await setup(names, 's5')
    const w = mount(TimeMachineDepthStack)
    await flushPromises()
    // stageHeight is unmeasured in jsdom (clientHeight stays 0) -- computeVisibleStripCap treats
    // that as "assume the uncapped ceiling" (see that function's own header comment), same
    // convention timeMachineMath.test.ts itself documents for its own pure-function suite.
    const expected = resolveDollySlots(names, 5)
    const strips = w.findAll('.tm-depth-strip')
    expect(strips).toHaveLength(expected.length)
    expect(strips.map((s) => s.attributes('data-snapshot')).sort()).toEqual(expected.map((s) => s.name).sort())
    // One real SnapshotPreviewWindow per strip -- the "real Finder-window" behind the real window.
    expect(w.findAll('.tm-preview-window')).toHaveLength(expected.length)
  })

  it('keeps the SAME DOM node for a persisting snapshot across a switch (identity, not tear-down/rebuild)', async () => {
    const names = Array.from({ length: 6 }, (_, i) => `s${i}`)
    const { files } = await setup(names, 's3')
    const w = mount(TimeMachineDepthStack)
    await flushPromises()
    // s4 sits on the OLDER side of the selection both before and after a one-step "more recent"
    // switch (s3 -> s2) -- depth 1, then depth 2, both well within the default cascade window (the
    // OTHER direction would drop it: a snapshot on the depth -1 side falls out of the window
    // entirely once it becomes depth -2, per resolveDollySlots' own "only ONE more-recent
    // neighbour, unconditionally" rule -- see timeMachineMath.test.ts's own coverage of that).
    const before = w.get('[data-snapshot="s4"]').element
    expect(w.get('[data-snapshot="s4"]').attributes('data-depth')).toBe('1')
    files.currentPath = `${MOUNT}/.snapshots/s2`
    await nextTick()
    const after = w.get('[data-snapshot="s4"]').element
    expect(after).toBe(before)
    expect(w.get('[data-snapshot="s4"]').attributes('data-depth')).toBe('2')
  })

  it('mounts cleanly (no rendered strips) when there is no current selection yet', async () => {
    const browse = useSnapshotBrowseStore()
    const files = useFilesStore()
    listVolumesMock.mockResolvedValue([{ volume_uuid: 'u1', mount: MOUNT, supported: true }])
    await browse.ensureVolumes()
    files.currentPath = '/media/RAID_0/Photos' // not a snapshot view at all -- currentSnapshotName is null
    const w = mount(TimeMachineDepthStack)
    await flushPromises()
    expect(w.findAll('.tm-depth-strip')).toHaveLength(0)
  })
})

describe('TimeMachineDepthStack — switching re-derives the visible slot set', () => {
  it('the selection re-slots to depth 0; the old selection re-slots to a non-zero depth per resolveDollySlots', async () => {
    const names = Array.from({ length: 6 }, (_, i) => `s${i}`)
    const { files } = await setup(names, 's2')
    const w = mount(TimeMachineDepthStack)
    await flushPromises()
    expect(w.get('[data-snapshot="s2"]').attributes('data-depth')).toBe('0')

    files.currentPath = `${MOUNT}/.snapshots/s3`
    await nextTick()
    expect(w.get('[data-snapshot="s3"]').attributes('data-depth')).toBe('0')
    expect(w.get('[data-snapshot="s2"]').attributes('data-depth')).toBe('-1')
  })

  it('passes mount/relPath/viewMode/volumeLabel through to every SnapshotPreviewWindow, and updates relPath live', async () => {
    const names = ['s0', 's1']
    const { files } = await setup(names, 's0', 'Documents')
    const filesStore = useFilesStore()
    filesStore.displayNames = { [MOUNT]: 'My RAID' }
    filesStore.setView('list')
    const w = mount(TimeMachineDepthStack)
    await flushPromises()
    const crumbs = w.get('[data-snapshot="s1"]').findAll('.tm-preview-window__crumb').map((c) => c.text())
    expect(crumbs).toEqual(['My RAID', '.snapshots', 's1', 'Documents'])
    expect(w.get('[data-snapshot="s1"]').find('.tm-preview-window__list').exists()).toBe(true)

    files.currentPath = `${MOUNT}/.snapshots/s0/Documents/Q3`
    await flushPromises()
    const updated = w.get('[data-snapshot="s1"]').findAll('.tm-preview-window__crumb').map((c) => c.text())
    expect(updated).toEqual(['My RAID', '.snapshots', 's1', 'Documents', 'Q3'])
  })
})

describe('TimeMachineDepthStack — pin-during-travel presence', () => {
  it('force-renders the travel target even when it lies outside the normal [-1, cap] window, the instant tmTravel is set', async () => {
    const names = Array.from({ length: 20 }, (_, i) => `s${i}`) // s0 newest .. s19 oldest
    const { browse } = await setup(names, 's0')
    const w = mount(TimeMachineDepthStack)
    await flushPromises()
    expect(w.find('[data-snapshot="s15"]').exists()).toBe(false) // s15 is far outside the default cap (10)

    browse.tmTravel = { from: 's0', to: 's15' }
    await nextTick()
    expect(w.find('[data-snapshot="s15"]').exists()).toBe(true) // pinned in at its own real (far) depth
    expect(w.get('[data-snapshot="s15"]').attributes('data-depth')).toBe('15')
  })
})

describe('TimeMachineDepthStack — travel playback (mocked choreography, real gsap underneath)', () => {
  it('plays a travel timeline once the target snapshot actually becomes current, with steps = index distance', async () => {
    const spy = vi.spyOn(choreo, 'playTravelTimeline')
    const names = Array.from({ length: 6 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's1')
    const w = mount(TimeMachineDepthStack)
    await flushPromises()

    browse.tmTravel = { from: 's1', to: 's4' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s4`
    browse.tmTravel = null
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][1].steps).toBe(3) // |4-1|
    // The travel's own endpoints must be among the animated targets.
    const targetNames = spy.mock.calls[0][0].map((t) => t.el.getAttribute('data-snapshot'))
    expect(targetNames).toEqual(expect.arrayContaining(['s1', 's4']))
  })

})

// Task 7 fix round (review finding 1 -- Vue2's own armReveal/reveal, ported): the reveal-gate is a
// plain, independent `setTimeout` mechanism (deliberately NOT hooked to the GSAP timeline's own
// onComplete -- see TimeMachineDepthStack.vue's own header comment), so it is exercised here with
// fake timers rather than `tl.progress(1)` (the technique the OLD onComplete-driven design used,
// and which timeMachineChoreo.test.ts still uses for the choreography module's own, unrelated
// contract). `browse.settleTravel` is the ONE observable side effect the gate produces (it is
// what TimeMachineStage.vue's own `.tm-fwin--traveling` ultimately reads via `tmTravelActive` --
// see that component's own test for the DOM-level assertion; this suite spies on the store action
// directly since it is this component's own, more precise contract boundary).
describe('TimeMachineDepthStack — reveal-gate (review finding 1: does not settle before the travel finishes)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('does not settle before BOTH the travel duration elapses AND the target preview resolves', async () => {
    let resolvePreview: (() => void) | undefined
    getSnapshotPreviewMock.mockImplementation(
      () => new Promise<SnapshotPreviewEntry>((resolve) => { resolvePreview = () => resolve({ entries: [], error: false }) }),
    )
    const names = Array.from({ length: 6 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's1')
    mount(TimeMachineDepthStack)
    await flushPromises()
    const settleSpy = vi.spyOn(browse, 'settleTravel')

    browse.tmTravel = { from: 's1', to: 's2' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s2`
    browse.tmTravel = null
    await nextTick() // the currentSnapshotName watcher fires here, arming the gate

    // A 1-step switch's own travel duration is TRAVEL_BASE_DURATION_MS (420ms, timeMachineChoreo.ts)
    // -- advance well past it while the preview promise is still pending.
    await vi.advanceTimersByTimeAsync(500)
    expect(settleSpy).not.toHaveBeenCalled()

    resolvePreview?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(settleSpy).toHaveBeenCalledTimes(1)
  })

  it('reveals regardless once the safety ceiling elapses, even if the preview promise never settles', async () => {
    getSnapshotPreviewMock.mockReturnValue(new Promise(() => {})) // never settles
    const names = Array.from({ length: 6 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's1')
    mount(TimeMachineDepthStack)
    await flushPromises()
    const settleSpy = vi.spyOn(browse, 'settleTravel')

    browse.tmTravel = { from: 's1', to: 's2' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s2`
    browse.tmTravel = null
    await nextTick()

    await vi.advanceTimersByTimeAsync(500) // past the 420ms travel duration, promise still pending
    expect(settleSpy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(800) // TRAVEL_SAFETY_EXTRA_MS, ported from Vue2
    expect(settleSpy).toHaveBeenCalledTimes(1)
  })

  it('does not settle early even when reduced motion collapses the GSAP timeline itself to zero duration (Vue2\'s own explicit choice: the readiness gate is unaffected)', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    let resolvePreview: (() => void) | undefined
    getSnapshotPreviewMock.mockImplementation(
      () => new Promise<SnapshotPreviewEntry>((resolve) => { resolvePreview = () => resolve({ entries: [], error: false }) }),
    )
    const names = Array.from({ length: 6 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's1')
    mount(TimeMachineDepthStack)
    await flushPromises()
    const settleSpy = vi.spyOn(browse, 'settleTravel')

    browse.tmTravel = { from: 's1', to: 's2' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s2`
    browse.tmTravel = null
    await nextTick()

    // The GSAP side is instant under reduced motion (see the separate "reduced motion" describe
    // block below), but the reveal-gate's own timer is NOT reduced-motion-aware -- it still waits
    // the full, un-reduced travelDurationMs before even CALLING getSnapshotPreview (so
    // `resolvePreview` is not assigned, and calling it earlier would be a no-op on a promise that
    // does not exist yet).
    await vi.advanceTimersByTimeAsync(100)
    expect(settleSpy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(400) // crosses the 420ms floor -- getSnapshotPreview now called
    expect(settleSpy).not.toHaveBeenCalled() // preview still pending
    resolvePreview?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(settleSpy).toHaveBeenCalledTimes(1)
  })

  it('a superseded switch re-arms the gate for the NEW target -- the earlier travel settles exactly once, not twice', async () => {
    const names = Array.from({ length: 6 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's1')
    mount(TimeMachineDepthStack)
    await flushPromises()
    const settleSpy = vi.spyOn(browse, 'settleTravel')

    // First travel: s1 -> s2 (1 step, base duration).
    browse.tmTravel = { from: 's1', to: 's2' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s2`
    browse.tmTravel = null
    await nextTick()

    // Before it settles, a SECOND switch supersedes it: s2 -> s4 (2 steps, still base duration --
    // both <= TRAVEL_FLAT_STEPS).
    await vi.advanceTimersByTimeAsync(100)
    browse.tmTravel = { from: 's2', to: 's4' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s4`
    browse.tmTravel = null
    await nextTick()

    // Advance past where the FIRST travel's own gate would have fired (420ms from ITS OWN arm
    // point, ~320ms from here) -- must not have settled from the stale one.
    await vi.advanceTimersByTimeAsync(350)
    expect(settleSpy).not.toHaveBeenCalled()

    // Advance past the SECOND (surviving) travel's own full gate.
    await vi.advanceTimersByTimeAsync(1000)
    expect(settleSpy).toHaveBeenCalledTimes(1) // exactly once -- no stale double-settle
  })
})

describe('TimeMachineDepthStack — pin leak on superseded travel (review finding 3)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  // Fix round: pin-clearing moved OFF the GSAP timeline's own onComplete (which never fires for a
  // `.kill()`ed, superseded timeline -- see TimeMachineDepthStack.vue's own header comment) and
  // onto the reveal-gate's own `settle()`, which fires for every travel exactly once (including a
  // superseded one, via the token-guard, as a safe no-op that still ran ITS OWN pin-cleanup path
  // for whichever travel's callback actually wins) -- see the describe block above for the
  // "settles exactly once" half of this same mechanism.
  it('a rapid double-switch leaves no stale pinned strip once the surviving travel settles', async () => {
    const names = Array.from({ length: 20 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's0')
    const w = mount(TimeMachineDepthStack)
    await flushPromises()

    // First: a distant jump to s15 (pinned in at its own real, far-outside-the-window depth).
    browse.tmTravel = { from: 's0', to: 's15' }
    await nextTick()
    expect(w.find('[data-snapshot="s15"]').exists()).toBe(true)

    files.currentPath = `${MOUNT}/.snapshots/s15`
    browse.tmTravel = null
    await nextTick()

    // Before that travel's own gate can ever fire, a SECOND rapid switch supersedes it -- back to s1.
    await vi.advanceTimersByTimeAsync(50)
    browse.tmTravel = { from: 's15', to: 's1' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s1`
    browse.tmTravel = null
    await nextTick()

    // Let everything settle: both timers and both preview promises.
    await vi.advanceTimersByTimeAsync(2000)
    await flushPromises()

    // s15 is 14 slots away from s1's own normal window -- its pin must have been cleared once the
    // SURVIVING (second) travel's own gate settled, not left stuck rendered forever.
    expect(w.find('[data-snapshot="s15"]').exists()).toBe(false)
  })
})

describe('TimeMachineDepthStack — reduced motion (GSAP timeline itself, separate from the reveal-gate above)', () => {
  it('collapses the travel timeline to zero duration under prefers-reduced-motion, still reaching the final pose', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    const spy = vi.spyOn(choreo, 'playTravelTimeline')
    const names = Array.from({ length: 6 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's1')
    mount(TimeMachineDepthStack)
    await flushPromises()

    browse.tmTravel = { from: 's1', to: 's2' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s2`
    browse.tmTravel = null
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    const tl = spy.mock.results[0].value
    expect(tl.duration()).toBe(0)
    tl.progress(1)
  })
})

describe('TimeMachineDepthStack — gsap context cleanup', () => {
  it('reverts its own gsap context on unmount', async () => {
    const contextSpy = vi.spyOn(gsap, 'context')
    await setup(['s0', 's1'], 's0')
    const w = mount(TimeMachineDepthStack)
    await flushPromises()
    expect(contextSpy).toHaveBeenCalledTimes(1)
    const ctx = contextSpy.mock.results[0].value
    const revertSpy = vi.spyOn(ctx, 'revert')
    w.unmount()
    expect(revertSpy).toHaveBeenCalledTimes(1)
  })
})
