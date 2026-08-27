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
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import TimeMachineDepthStack from './TimeMachineDepthStack.vue'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import { useFilesStore } from '../stores/files'
import { resolveDollySlots, travelStackPlan } from '../util/timeMachineMath'
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

  // Fix wave H (Ruling H-1, owner acceptance 2026-08-26): explicit regression pin -- a travel at or
  // under TRAVEL_FLAT_STEPS (3) must call playTravelTimeline EXACTLY the way it always did, with
  // none of the fly-through-specific options populated. The test above already proves this
  // indirectly (unchanged since before wave H, still green); this one asserts it directly so a
  // future change to the fly-through gating cannot silently start passing these for a short
  // travel too. Fix wave I (Ruling I-1, owner acceptance 2026-08-26) SUPERSEDES the ORIGINAL
  // version of this test's own `presetPoses` assertion: `delayOverridesMs`/`durationMsOverride`
  // stay wave-H/fly-through-only (this wave's own explicit "1-position cascade is what it always
  // did" contract), but `presetPoses` is no longer fly-through-exclusive -- ANY travel (short
  // included) now presets strips newly entering the visible window to their edge-clamped implied
  // pre-travel pose (see TimeMachineDepthStack.vue's own `tmTravel` watcher and `runTravel`
  // comments for the full root-cause trace: without this, a newly-mounted entering strip's own
  // `v-tm-pose` `mounted` hook already set it to its FINAL pose, making its own tween a no-op --
  // exactly the "pops in place" defect the owner's screenshot caught).
  it('(fix wave H/I) a <= TRAVEL_FLAT_STEPS travel passes NO delayOverridesMs/durationMsOverride (fly-through-only, unchanged) but DOES preset entering strips (wave I, generalized)', async () => {
    const spy = vi.spyOn(choreo, 'playTravelTimeline')
    // 15 names, well past the default 10-slot cap (stageHeight stays unmeasured/0 in jsdom, which
    // computeVisibleStripCap treats as "assume the uncapped ceiling", i.e. 10 -- same convention
    // this file's own other tests already rely on) so a 3-step jump genuinely pushes some deep
    // names outside the OLD window while pulling new ones into the NEW window.
    const names = Array.from({ length: 15 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's0')
    mount(TimeMachineDepthStack)
    await flushPromises()

    browse.tmTravel = { from: 's0', to: 's3' } // exactly TRAVEL_FLAT_STEPS
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s3`
    browse.tmTravel = null
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    const opts = spy.mock.calls[0][1]
    expect(opts.steps).toBe(3)
    expect(opts.delayOverridesMs).toBeUndefined()
    expect(opts.durationMsOverride).toBeUndefined()
    // s11/s12/s13 are newly-entering deepest strips for this jump (real old depth 11/12/13 > the
    // 10-slot cap, so NOT in the old window; real new depth 8/9/10 <= cap, so they ARE in the new
    // one) -- they must carry a preset, not sit unset.
    expect(opts.presetPoses).toBeDefined()
    for (const name of ['s11', 's12', 's13']) expect(opts.presetPoses![name]).toBeDefined()
  })
})

// Fix wave H (Ruling H-1, owner acceptance 2026-08-26): the long-jump fly-through's own wiring --
// see TimeMachineDepthStack.vue's own header comment on the `tmTravel` watcher (pin timing) and
// `buildFlyThroughOverrides` (delay/preset derivation) for the full mechanism this exercises.
// timeMachineChoreo.test.ts covers flyThroughPlan/flyThroughDurationMs as PURE functions
// exhaustively -- not re-proven here; this suite is scoped to "does the component actually wire a
// plan into real strips/pins/GSAP calls/the reveal-gate correctly."
describe('TimeMachineDepthStack — long-jump fly-through wiring (Fix wave H, Ruling H-1)', () => {
  it('mounts (pins) every sampled intermediate from the plan as a real depth-stack strip, not just the two endpoints', async () => {
    const names = Array.from({ length: 30 }, (_, i) => `s${i}`) // s0 newest .. s29 oldest
    const { browse, files } = await setup(names, 's0')
    const w = mount(TimeMachineDepthStack)
    await flushPromises()

    const expectedPlan = choreo.flyThroughPlan(names, 0, 20, { maxIntermediates: choreo.TRAVEL_FLY_MAX_INTERMEDIATES })
    expect(expectedPlan.length).toBeGreaterThan(1) // sanity: a real plan with intermediates

    browse.tmTravel = { from: 's0', to: 's20' } // 20 steps, well past TRAVEL_FLAT_STEPS
    await nextTick()
    for (const step of expectedPlan) {
      expect(w.find(`[data-snapshot="${step.name}"]`).exists(), `${step.name} (${step.role}) should be pinned/rendered`).toBe(true)
    }
  })

  it('a >TRAVEL_FLAT_STEPS travel calls playTravelTimeline with delayOverridesMs (per-name sequential cadence) and durationMsOverride (flat per-layer duration, not the growth curve)', async () => {
    const spy = vi.spyOn(choreo, 'playTravelTimeline')
    const names = Array.from({ length: 30 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's0')
    mount(TimeMachineDepthStack)
    await flushPromises()

    browse.tmTravel = { from: 's0', to: 's20' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s20`
    browse.tmTravel = null
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    const opts = spy.mock.calls[0][1]
    expect(opts.steps).toBe(20)
    expect(opts.durationMsOverride).toBe(choreo.TRAVEL_FLY_LAYER_DURATION_MS)
    expect(opts.delayOverridesMs).toBeDefined()
    const expectedPlan = choreo.flyThroughPlan(names, 0, 20, { maxIntermediates: choreo.TRAVEL_FLY_MAX_INTERMEDIATES })
    // Every plan member (intermediates + target) has its own delay override, monotonically
    // matching the plan's own launchDelayMs values.
    for (const step of expectedPlan) {
      expect(opts.delayOverridesMs![step.name]).toBe(step.launchDelayMs)
    }
    // The target itself (s20) is the LAST to launch -- the largest delay of the whole set.
    const target = expectedPlan[expectedPlan.length - 1]
    expect(target.role).toBe('target')
    expect(Math.max(...Object.values(opts.delayOverridesMs!))).toBe(target.launchDelayMs)
  })

  it('BACKWARD (older target): every intermediate gets a preset pose, and they are NOT all identical (each one\'s own real pre-travel position)', async () => {
    const spy = vi.spyOn(choreo, 'playTravelTimeline')
    const names = Array.from({ length: 30 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's0')
    mount(TimeMachineDepthStack)
    await flushPromises()

    browse.tmTravel = { from: 's0', to: 's20' } // backward: toIdx(20) > fromIdx(0)
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s20`
    browse.tmTravel = null
    await flushPromises()

    const opts = spy.mock.calls[0][1]
    const expectedPlan = choreo.flyThroughPlan(names, 0, 20, { maxIntermediates: choreo.TRAVEL_FLY_MAX_INTERMEDIATES })
    const intermediates = expectedPlan.filter((s) => s.role === 'intermediate')
    expect(intermediates.length).toBeGreaterThan(1)
    for (const step of intermediates) expect(opts.presetPoses![step.name]).toBeDefined()
    // Different intermediates sit at different original depths relative to s0 -- their own preset
    // Y offsets must differ (not every intermediate collapsed onto one shared pose).
    const ys = intermediates.map((s) => opts.presetPoses![s.name].y)
    expect(new Set(ys).size).toBeGreaterThan(1)
    // Fix wave I (Ruling I-1, owner acceptance 2026-08-26) SUPERSEDES wave H's own "the target
    // gets no preset" assumption: s20 (the target) was ALSO not naturally in the old window for
    // this big a jump, so it is ALSO a newly-mounted "entering" strip whose own v-tm-pose mounted
    // hook already set it to its final (identity) pose -- without a preset its own tween would be
    // a no-op too, the exact "target pops in instead of decelerating into depth 0" gap wave I's
    // own generic travelStackPlan-driven preset now closes (wave H's own buildFlyThroughOverrides
    // deliberately never set one for the target -- travelStackPlan's more general pass does).
    const targetName = expectedPlan[expectedPlan.length - 1].name
    expect(opts.presetPoses![targetName]).toBeDefined()
  })

  it('FORWARD (more-recent target): every NEW-ENTRANT intermediate\'s preset is the SAME exit pose (arriving from the camera)', async () => {
    const spy = vi.spyOn(choreo, 'playTravelTimeline')
    const names = Array.from({ length: 30 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's20')
    mount(TimeMachineDepthStack)
    await flushPromises()

    browse.tmTravel = { from: 's20', to: 's0' } // forward: toIdx(0) < fromIdx(20)
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s0`
    browse.tmTravel = null
    await flushPromises()

    const opts = spy.mock.calls[0][1]
    const expectedPlan = choreo.flyThroughPlan(names, 20, 0, { maxIntermediates: choreo.TRAVEL_FLY_MAX_INTERMEDIATES })
    const intermediates = expectedPlan.filter((s) => s.role === 'intermediate')
    expect(intermediates.length).toBeGreaterThan(1)
    // Fix wave I follow-up (re-review, 2026-08-26): NOT every intermediate gets the exit-pose
    // preset any more -- only ones that were genuinely NOT in the old window (role 'entering'/
    // 'pinned' per travelStackPlan). This jump's own geometry has exactly one intermediate (s19)
    // that WAS a real old-window member (role 'leaving') -- see below for why skipping its preset
    // is still correct/harmless.
    const stackPlan = travelStackPlan(names, 20, 0, { maxSlots: 10, extraNames: expectedPlan.map((s) => s.name) })
    const roleByName = new Map(stackPlan.map((e) => [e.name, e.role]))
    const newEntrants = intermediates.filter((s) => { const r = roleByName.get(s.name); return r !== 'resident' && r !== 'leaving' })
    const alreadyResident = intermediates.filter((s) => { const r = roleByName.get(s.name); return r === 'resident' || r === 'leaving' })
    expect(newEntrants.length).toBeGreaterThan(1)
    expect(alreadyResident.length).toBeGreaterThan(0) // sanity: this geometry genuinely exercises both branches

    const presets = newEntrants.map((s) => opts.presetPoses![s.name])
    for (const p of presets) {
      expect(p).toBeDefined()
      expect(p.y).toBeCloseTo(presets[0].y)
      expect(p.scaleX).toBeCloseTo(presets[0].scaleX)
    }
    expect(presets[0].scaleX).toBeGreaterThan(1) // the exit pose's own uniform grow (EXIT_SCALE, timeMachineMath.ts)

    // The already-resident/leaving intermediate (s19) gets NO preset -- its own current pose is
    // already correct. Harmless precisely because its real old depth (-1) is ALSO already
    // exit-pose-equivalent (resolveSlotPose collapses every depth <= -1 identically) -- so even
    // though it is exempted from the preset, it was never visually distinguishable from the exit
    // pose to begin with.
    for (const s of alreadyResident) {
      expect(opts.presetPoses![s.name]).toBeUndefined()
    }
  })

  // Fix wave I follow-up (re-review, 2026-08-26): the exact regression the re-review flagged --
  // a forward jump just PAST TRAVEL_FLAT_STEPS (steps=5, default window) where a sampled
  // intermediate is a genuine, already-visible OLD-window RESIDENT (role 'resident'/'leaving' per
  // travelStackPlan), not a new entrant. Every forward intermediate's own raw OLD depth is
  // structurally negative (it lies between the target and the departure point, always on the
  // "shallower than departure" side) -- old-window residency for a negative depth only ever occurs
  // at EXACTLY depth -1 (resolveDollySlots' own "-1 always included" rule), which happens to
  // already be numerically exit-pose-equivalent, so this specific geometry cannot demonstrate a
  // VISIBLE pop on its own -- but the CODE-LEVEL regression (the preset being applied
  // unconditionally, ignoring travelStackPlan's own membership) is exactly what this test pins:
  // the fix must skip the preset for a resident/leaving intermediate regardless of whether that
  // particular case happens to be visually distinguishable, the same defensive discipline the
  // BACKWARD branch already gets "for free" from recomputing the real pose directly.
  it('FORWARD, steps just past TRAVEL_FLAT_STEPS: a sampled intermediate that is a genuine old-window resident gets NO preset (no pop) -- its tween runs from its own current position', async () => {
    const spy = vi.spyOn(choreo, 'playTravelTimeline')
    const names = Array.from({ length: 10 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's5')
    mount(TimeMachineDepthStack)
    await flushPromises()

    browse.tmTravel = { from: 's5', to: 's0' } // forward, 5 steps -- just past TRAVEL_FLAT_STEPS(3)
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s0`
    browse.tmTravel = null
    await flushPromises()

    const opts = spy.mock.calls[0][1]
    const plan = choreo.flyThroughPlan(names, 5, 0, { maxIntermediates: choreo.TRAVEL_FLY_MAX_INTERMEDIATES })
    expect(plan.some((s) => s.role === 'intermediate')).toBe(true)
    const stackPlan = travelStackPlan(names, 5, 0, { maxSlots: 10, extraNames: plan.map((s) => s.name) })
    const roleByName = new Map(stackPlan.map((e) => [e.name, e.role]))

    for (const step of plan.filter((s) => s.role === 'intermediate')) {
      const role = roleByName.get(step.name)
      if (role === 'resident' || role === 'leaving') {
        // The regression this test guards: must NOT be snapped to the fixed exit pose.
        expect(opts.presetPoses?.[step.name]).toBeUndefined()
      }
      else {
        expect(opts.presetPoses?.[step.name]).toBeDefined()
      }
    }
  })

  it('≤3-step and >3-step gating is exact: a 4-step travel already produces a non-empty plan', async () => {
    const spy = vi.spyOn(choreo, 'playTravelTimeline')
    const names = Array.from({ length: 10 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's0')
    mount(TimeMachineDepthStack)
    await flushPromises()

    browse.tmTravel = { from: 's0', to: 's4' } // TRAVEL_FLAT_STEPS + 1
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s4`
    browse.tmTravel = null
    await flushPromises()

    const opts = spy.mock.calls[0][1]
    expect(opts.durationMsOverride).toBe(choreo.TRAVEL_FLY_LAYER_DURATION_MS)
    expect(Object.keys(opts.delayOverridesMs ?? {})).toHaveLength(4) // 3 intermediates + target
  })
})

describe('TimeMachineDepthStack — long-jump fly-through: reveal-gate uses the PLAN\'s own total duration (Fix wave H, Ruling H-1)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('does not settle before the plan\'s own total duration elapses, even though that is LONGER than travelDurationMs(steps) would have been', async () => {
    let resolvePreview: (() => void) | undefined
    getSnapshotPreviewMock.mockImplementation(
      () => new Promise<SnapshotPreviewEntry>((resolve) => { resolvePreview = () => resolve({ entries: [], error: false }) }),
    )
    const names = Array.from({ length: 30 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's0')
    mount(TimeMachineDepthStack)
    await flushPromises()
    const settleSpy = vi.spyOn(browse, 'settleTravel')

    browse.tmTravel = { from: 's0', to: 's20' } // 20 steps -- fly-through
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s20`
    browse.tmTravel = null
    await nextTick()

    const plan = choreo.flyThroughPlan(names, 0, 20, { maxIntermediates: choreo.TRAVEL_FLY_MAX_INTERMEDIATES })
    const planDurationMs = choreo.flyThroughDurationMs(plan)
    const oldStyleDurationMs = choreo.travelDurationMs(20) // what it WOULD have been pre-wave-H
    expect(planDurationMs).toBeGreaterThan(oldStyleDurationMs) // sanity: the fly-through genuinely takes longer

    // Advance PAST where the old (pre-wave-H) duration would have fired, but still short of the
    // plan's own real total -- must NOT have settled yet (proves the gate is using the plan's own
    // duration, not the old growth-curve one).
    await vi.advanceTimersByTimeAsync(oldStyleDurationMs + 50)
    expect(settleSpy).not.toHaveBeenCalled()

    // Now advance the rest of the way past the plan's own real total duration.
    await vi.advanceTimersByTimeAsync(planDurationMs - oldStyleDurationMs + 10)
    resolvePreview?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(settleSpy).toHaveBeenCalledTimes(1)
  })

  it('the safety ceiling is planDurationMs + TRAVEL_SAFETY_EXTRA_MS -- reveals regardless if the preview never settles', async () => {
    getSnapshotPreviewMock.mockReturnValue(new Promise(() => {})) // never settles
    const names = Array.from({ length: 30 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's0')
    mount(TimeMachineDepthStack)
    await flushPromises()
    const settleSpy = vi.spyOn(browse, 'settleTravel')

    browse.tmTravel = { from: 's0', to: 's20' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s20`
    browse.tmTravel = null
    await nextTick()

    const plan = choreo.flyThroughPlan(names, 0, 20, { maxIntermediates: choreo.TRAVEL_FLY_MAX_INTERMEDIATES })
    const planDurationMs = choreo.flyThroughDurationMs(plan)

    await vi.advanceTimersByTimeAsync(planDurationMs + 50)
    expect(settleSpy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(choreo.TRAVEL_SAFETY_EXTRA_MS)
    expect(settleSpy).toHaveBeenCalledTimes(1)
  })
})

describe('TimeMachineDepthStack — long-jump fly-through: superseding kills cleanly (Fix wave H, Ruling H-1)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('a fly-through superseded by a SECOND travel before it settles: timeline killed, sampled intermediates unpinned, settles exactly once', async () => {
    const names = Array.from({ length: 30 }, (_, i) => `s${i}`) // s0 newest .. s29 oldest
    const { browse, files } = await setup(names, 's0')
    const w = mount(TimeMachineDepthStack)
    await flushPromises()
    const settleSpy = vi.spyOn(browse, 'settleTravel')

    // First: a fly-through jump s0 -> s20 (well past TRAVEL_FLAT_STEPS).
    const planA = choreo.flyThroughPlan(names, 0, 20, { maxIntermediates: choreo.TRAVEL_FLY_MAX_INTERMEDIATES })
    // A MIDDLE intermediate, not one that could coincidentally coincide with the second travel's
    // own endpoints or land inside its normal window by chance -- same "pick a name whose final
    // depth is nowhere near the surviving travel's own window" discipline the existing "pin leak
    // on superseded travel" suite above already documents (its own re-review comment explains
    // exactly this pitfall: a leaked name too close to the final selection can't prove a real
    // pin-clear happened, since it would render anyway).
    const someIntermediateA = planA.filter((s) => s.role === 'intermediate')[4].name // s11

    browse.tmTravel = { from: 's0', to: 's20' }
    await nextTick()
    expect(w.find(`[data-snapshot="${someIntermediateA}"]`).exists()).toBe(true)

    files.currentPath = `${MOUNT}/.snapshots/s20`
    browse.tmTravel = null
    await nextTick()

    // Before travel A's own gate can ever fire, a SECOND fly-through supersedes it: s20 -> s25
    // (also well past TRAVEL_FLAT_STEPS, so a real second plan/timeline gets built too) -- chosen
    // to share NO names with planA's own sampled set, and to land `someIntermediateA` (s11) far
    // outside s25's own normal window (depth 11-25 = -14, nowhere near the unconditional -1 slot).
    await vi.advanceTimersByTimeAsync(50)
    browse.tmTravel = { from: 's20', to: 's25' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s25`
    browse.tmTravel = null
    await nextTick()

    // Let everything settle: both the surviving travel's own timers and preview promises.
    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()

    // Travel A's own sampled intermediate must not still be pinned/rendered -- its real depth
    // relative to the FINAL selection (s1) is far outside the normal window, so only an actual
    // pin-clear (not incidental in-window membership) makes it disappear, same geometry discipline
    // TimeMachineDepthStack.test.ts's own "pin leak on superseded travel" suite already documents.
    expect(w.find(`[data-snapshot="${someIntermediateA}"]`).exists()).toBe(false)
    // Exactly one settle -- the superseded travel's own (never-firing, in this test) timers must
    // not double-fire once the surviving one's own gate lands.
    expect(settleSpy).toHaveBeenCalledTimes(1)
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

// Fix wave D (D2, owner acceptance 2026-08-26 -- reveal-time scale stutter): regression coverage
// for the exact race the fix addresses -- see TimeMachineDepthStack.vue's own `travelRunToken`
// comment for the full mechanism and the Vue2 "Fix Round 15" precedent this ports. Wall-clock
// (`Date.now()`) cannot distinguish the buggy ordering from the fixed one here: under fake timers
// the virtual clock does not advance across a bare microtask/nextTick boundary, so a `setTimeout`
// call made "one tick early" resolves to the SAME simulated fire time as one made "on time" --
// exactly why the bug was invisible to naive timing assertions and only showed up as a real-browser
// visual pop. The provable, deterministic distinction is PROGRAM ORDER: under the pre-fix code,
// `armReveal` ran synchronously inside the `currentSnapshotName` watcher -- its own `setTimeout`
// registration necessarily happened BEFORE `runTravel`'s nextTick-deferred call to
// `playTravelTimeline` even ran (a `nextTick`-deferred callback can never execute before the
// synchronous code that scheduled it finishes). Post-fix, both calls happen from the SAME deferred
// callback with `runTravel` (and therefore `playTravelTimeline`) called FIRST. Vitest's mock
// functions share one global `invocationCallOrder` counter across every mock, so comparing the two
// calls' own order numbers proves which one actually ran first -- independent of any faked/real
// wall-clock value.
describe('TimeMachineDepthStack — reveal-gate timer starts from the same tick as the GSAP travel timeline (fix wave D, D2)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('registers the reveal-gate timer AFTER playTravelTimeline has already been called, never before', async () => {
    const names = Array.from({ length: 6 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's1')
    mount(TimeMachineDepthStack)
    await flushPromises()

    const playSpy = vi.spyOn(choreo, 'playTravelTimeline')
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    browse.tmTravel = { from: 's1', to: 's2' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s2`
    browse.tmTravel = null
    // Flushes the currentSnapshotName watcher, its own nextTick-deferred runTravel+armReveal
    // callback, and any further microtask hop either one triggers -- how many actual ticks that
    // takes is an implementation detail this test does not care about; the invocation-order
    // comparison below is what proves the fix, not the tick count.
    await nextTick()
    await nextTick()

    expect(playSpy).toHaveBeenCalledTimes(1)
    const durationMs = choreo.travelDurationMs(1) // |idx(s2) - idx(s1)| === 1 -> TRAVEL_BASE_DURATION_MS
    const travelTimerCallIndex = setTimeoutSpy.mock.calls.findIndex(([, delay]) => delay === durationMs)
    expect(travelTimerCallIndex).toBeGreaterThanOrEqual(0) // sanity: the reveal-gate timer was armed at all
    const travelTimerOrder = setTimeoutSpy.mock.invocationCallOrder[travelTimerCallIndex]
    const playOrder = playSpy.mock.invocationCallOrder[0]
    expect(travelTimerOrder).toBeGreaterThan(playOrder)
  })
})

// Fix wave B (B3b, owner acceptance 2026-08-26): the reveal-gate used to wait only for the preview
// cache promise (feeding the decorative depth-stack layers) and the travel duration -- never for
// the REAL window's own `files.load()` of the target path. In production `browse.currentSnapshotName`
// (this suite's own `files.currentPath = ...` lines above already simulate its post-load value) is
// itself derived from `files.currentPath`, so the condition is normally already true the instant
// armReveal runs -- these tests exercise the GATE FUNCTION's own behavior directly (via `files.
// loading`) rather than that coincidental ordering, so a future refactor that decouples the two
// cannot silently reopen this gap without turning these red. See TimeMachineDepthStack.vue's own
// `waitForFilesLoad` comment for the full rationale.
describe('TimeMachineDepthStack — reveal-gate also waits for the real window\'s files-store load (fix wave B, B3b)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('holds the reveal while files.loading is still true for the target path, releasing once it flips false', async () => {
    const names = Array.from({ length: 6 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's1')
    mount(TimeMachineDepthStack)
    await flushPromises()
    const settleSpy = vi.spyOn(browse, 'settleTravel')

    browse.tmTravel = { from: 's1', to: 's2' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s2`
    files.loading = true // the real window's own listing fetch for the target is still in flight
    browse.tmTravel = null
    await nextTick() // currentSnapshotName watcher fires here, arming the gate

    // Both the 420ms travel duration and the (default-resolved) preview promise elapse/settle,
    // but files.loading is still true -- the gate must not release.
    await vi.advanceTimersByTimeAsync(500)
    expect(settleSpy).not.toHaveBeenCalled()

    // The real window's own listing fetch completes.
    files.loading = false
    await vi.advanceTimersByTimeAsync(0)
    expect(settleSpy).toHaveBeenCalledTimes(1)
  })

  it('the safety ceiling still fires even if files.loading never flips back false (a hung load cannot wedge the stage)', async () => {
    const names = Array.from({ length: 6 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's1')
    mount(TimeMachineDepthStack)
    await flushPromises()
    const settleSpy = vi.spyOn(browse, 'settleTravel')

    browse.tmTravel = { from: 's1', to: 's2' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s2`
    files.loading = true // never flips back false in this test
    browse.tmTravel = null
    await nextTick()

    await vi.advanceTimersByTimeAsync(500) // past the 420ms travel duration, files.loading still true
    expect(settleSpy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(800) // TRAVEL_SAFETY_EXTRA_MS
    expect(settleSpy).toHaveBeenCalledTimes(1)
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

  // Fix round 2 (re-review, finding 3 remained open): the test above (s0->s15->s1) happens to
  // land back close to s0's own original position -- s0's REAL depth relative to the FINAL
  // selection (s1, index 1) is -1, which is unconditionally in-window anyway (see
  // resolveDollySlots' own "depth -1 always included" rule), so it can't tell a real pin-clear
  // apart from "would have rendered regardless of any pin". This test's own geometry keeps the
  // leaked name FAR from the final selection's own normal window, so only an actual pin-clear
  // (not incidental in-window membership) makes it disappear -- this is the exact repro the
  // re-reviewer used to catch fix round 1's own filter()-only-the-winning-pair mistake (see
  // settle()'s own comment in TimeMachineDepthStack.vue for the full account).
  it('a three-hop supersede (s0->s15 superseded by s15->s29) does not leave s0 pinned forever', async () => {
    const names = Array.from({ length: 30 }, (_, i) => `s${i}`) // s0 newest .. s29 oldest
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

    // Before that travel's own gate can ever fire, a SECOND rapid switch supersedes it -- an
    // even more distant jump to s29. pinNames is now the union {s0, s15, s29}.
    await vi.advanceTimersByTimeAsync(50)
    browse.tmTravel = { from: 's15', to: 's29' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s29`
    browse.tmTravel = null
    await nextTick()

    // Let everything settle: both timers and both preview promises.
    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()

    // s0's real depth relative to the final selection (s29, index 29) is -29 -- nowhere near the
    // normal window. Only settle()'s own pinNames reset (fix round 2) clears it; the fix round 1
    // version (filter out only {s15,s29}, the WINNING travel's own pair) left s0 stuck here.
    expect(w.find('[data-snapshot="s0"]').exists()).toBe(false)
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

// Fix wave B (B1, owner acceptance 2026-08-26, real-browser dark-theme screenshot): this strip
// hosts a real, full-size preview window whose content paints text in New-UI's theme tokens -- a
// permanently-white background (TM chrome's own `--tm-panel-bg-solid`) made every label invisible
// in dark theme. See TimeMachineStage.vue's own `.tm-fwin--active` <style> comment (Ruling B-1)
// for the full rationale this mirrors. jsdom applies no CSS at all, so the only way to pin this is
// reading the component's own source text, same technique this app's other TM components already
// use for their own CSS-literal regression guards.
describe('TimeMachineDepthStack — strip background follows the app theme (fix wave B, B1)', () => {
  it('.tm-depth-strip uses the global, theme-following --panel-bg-solid, not TM chrome\'s fixed-white --tm-panel-bg-solid', () => {
    const src = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), './TimeMachineDepthStack.vue'),
      'utf8',
    )
    const styleBlock = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)![1]
    const rule = /\.tm-depth-strip\s*\{([^}]*)\}/.exec(styleBlock)
    expect(rule, 'no .tm-depth-strip rule found').toBeTruthy()
    // Strip comments before the "must not use the old token" assertion below -- this rule's own
    // sibling comment (TimeMachineDepthStack.vue, above) mentions --tm-panel-bg-solid by name to
    // explain what changed, which would otherwise false-fail a naive substring check.
    const decls = rule![1].replace(/\/\*[\s\S]*?\*\//g, '')
    expect(decls).toMatch(/background:\s*var\(--panel-bg-solid\)/)
    expect(decls).not.toMatch(/--tm-panel-bg-solid/)
  })
})

// Fix wave I (Ruling I-1, owner acceptance 2026-08-26): linked-cascade travel -- see
// TimeMachineDepthStack.vue's own `tmTravel` watcher and `runTravel` comments for the full
// root-cause trace and wiring, and timeMachineMath.test.ts's own `travelStackPlan` describe block
// for that pure function's own exhaustive coverage (not re-proven here). This suite is scoped to
// "does the component actually pin/preset/animate the WHOLE visible stack, not just the
// travel's own endpoints or a fly-through's own intermediates."
describe('TimeMachineDepthStack — linked-cascade travel (Fix wave I, Ruling I-1)', () => {
  it('a short (1-step) travel: the entering deep-edge strip is pinned immediately and presets to travelStackPlan\'s own edge-clamped pose; the leaving shallow-edge strip is pinned with NO preset (its current position is already correct); a genuine resident also gets no preset', async () => {
    const spy = vi.spyOn(choreo, 'playTravelTimeline')
    const names = Array.from({ length: 30 }, (_, i) => `s${i}`) // s0 newest .. s29 oldest
    const { browse, files } = await setup(names, 's15')
    const w = mount(TimeMachineDepthStack)
    await flushPromises()

    browse.tmTravel = { from: 's15', to: 's16' } // 1 step older
    await nextTick()
    // Pinned immediately at click time (dispatch point 3) -- both edge strips already exist so
    // they have something real to animate from/to, not pop in/out later mid-travel.
    expect(w.find('[data-snapshot="s14"]').exists()).toBe(true) // leaving (old depth -1 -> new depth -2)
    expect(w.find('[data-snapshot="s26"]').exists()).toBe(true) // entering (old depth 11, clamps to just past the cap)

    files.currentPath = `${MOUNT}/.snapshots/s16`
    browse.tmTravel = null
    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    const opts = spy.mock.calls[0][1]
    expect(opts.steps).toBe(1)
    expect(opts.delayOverridesMs).toBeUndefined() // unchanged, fly-through-only mechanism (wave H)
    expect(opts.durationMsOverride).toBeUndefined()

    const stackPlan = travelStackPlan(names, 15, 16, { maxSlots: 10 })
    const entering = stackPlan.find((e) => e.name === 's26')!
    expect(entering.role).toBe('entering')
    expect(opts.presetPoses!.s26).toEqual(entering.fromPose)

    const leaving = stackPlan.find((e) => e.name === 's14')!
    expect(leaving.role).toBe('leaving')
    expect(opts.presetPoses!.s14).toBeUndefined()
    expect(opts.presetPoses!.s20).toBeUndefined() // a genuine, unremarkable resident

    const targetNames = spy.mock.calls[0][0].map((t) => t.el.getAttribute('data-snapshot'))
    expect(targetNames).toEqual(expect.arrayContaining(['s14', 's15', 's16', 's20', 's26']))
  })

  it('the leaving strip stays mounted through the travel (no pop/vanish) and unmounts only once settle() clears its pin', async () => {
    vi.useFakeTimers()
    try {
      const names = Array.from({ length: 30 }, (_, i) => `s${i}`)
      const { browse, files } = await setup(names, 's15')
      const w = mount(TimeMachineDepthStack)
      await flushPromises()

      browse.tmTravel = { from: 's15', to: 's16' }
      await nextTick()
      files.currentPath = `${MOUNT}/.snapshots/s16`
      browse.tmTravel = null
      await nextTick()
      await nextTick() // let the currentSnapshotName watcher's own nextTick-deferred runTravel/armReveal actually run

      expect(w.find('[data-snapshot="s14"]').exists()).toBe(true) // still mounted, animating out

      await vi.advanceTimersByTimeAsync(2000)
      await flushPromises()

      expect(w.find('[data-snapshot="s14"]').exists()).toBe(false) // gone once settle() unpins it, tween long finished
    } finally {
      vi.useRealTimers()
    }
  })

  it('fly-through: resident strips OUTSIDE the plan coexist with the plan\'s own intermediates in the SAME targets array -- only plan members carry delayOverridesMs, everyone else uses the default position-based stagger', async () => {
    const spy = vi.spyOn(choreo, 'playTravelTimeline')
    const names = Array.from({ length: 30 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's0')
    mount(TimeMachineDepthStack)
    await flushPromises()

    browse.tmTravel = { from: 's0', to: 's20' } // fly-through
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s20`
    browse.tmTravel = null
    await flushPromises()

    const opts = spy.mock.calls[0][1]
    const plan = choreo.flyThroughPlan(names, 0, 20, { maxIntermediates: choreo.TRAVEL_FLY_MAX_INTERMEDIATES })
    const planNames = new Set(plan.map((s) => s.name))
    const targetNames = spy.mock.calls[0][0].map((t) => t.el.getAttribute('data-snapshot')!)

    const residentCandidate = targetNames.find((n) => !planNames.has(n))
    expect(residentCandidate, 'expected at least one non-plan resident in the same travel').toBeTruthy()
    expect(opts.delayOverridesMs![residentCandidate!]).toBeUndefined()
    for (const step of plan) expect(opts.delayOverridesMs![step.name]).toBe(step.launchDelayMs)
  })

  it('supersede: a superseded travel\'s own old/new-WINDOW pins (not just its fly-through intermediates) are fully cleared once the surviving travel settles', async () => {
    vi.useFakeTimers()
    try {
      const names = Array.from({ length: 30 }, (_, i) => `s${i}`)
      const { browse, files } = await setup(names, 's15')
      const w = mount(TimeMachineDepthStack)
      await flushPromises()

      // First: a short 1-step travel s15 -> s16, pinning s14 as a leaving-edge resident.
      browse.tmTravel = { from: 's15', to: 's16' }
      await nextTick()
      expect(w.find('[data-snapshot="s14"]').exists()).toBe(true)
      files.currentPath = `${MOUNT}/.snapshots/s16`
      browse.tmTravel = null
      await nextTick()

      // Before its own gate can ever fire, a second, unrelated travel supersedes it, landing far away.
      await vi.advanceTimersByTimeAsync(50)
      browse.tmTravel = { from: 's16', to: 's1' }
      await nextTick()
      files.currentPath = `${MOUNT}/.snapshots/s1`
      browse.tmTravel = null
      await nextTick()

      await vi.advanceTimersByTimeAsync(3000)
      await flushPromises()

      // s14's real depth relative to the FINAL selection (s1) is far outside any normal window --
      // only an actual pin-clear (settle()'s own unconditional reset) makes it disappear.
      expect(w.find('[data-snapshot="s14"]').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('≤1-step keyboard step: every persisting strip shifts by exactly one depth -- the SAME "1-position cascade" this always visually was, now provably so (data-depth before/after)', async () => {
    const names = Array.from({ length: 10 }, (_, i) => `s${i}`) // small on purpose: with cap 10, everything persists, isolating the "shift by 1" arithmetic from entering/leaving (covered above)
    const { browse, files } = await setup(names, 's3')
    const w = mount(TimeMachineDepthStack)
    await flushPromises()

    const before: Record<string, string> = {}
    for (const el of w.findAll('.tm-depth-strip')) before[el.attributes('data-snapshot')!] = el.attributes('data-depth')!
    expect(Object.keys(before).length).toBeGreaterThan(3) // sanity: a real, multi-strip cascade

    browse.tmTravel = { from: 's3', to: 's4' }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s4`
    browse.tmTravel = null
    await nextTick()

    for (const [name, depthBefore] of Object.entries(before)) {
      const el = w.find(`[data-snapshot="${name}"]`)
      expect(el.exists(), `${name} should still be mounted (nothing left the tiny/uncapped window here)`).toBe(true)
      expect(Number(el.attributes('data-depth'))).toBe(Number(depthBefore) - 1)
    }
  })

})

// Fix wave J (owner acceptance 2026-08-26): "flight integrity" -- required per the dispatch after
// an owner screenshot of a far jump to a MUCH OLDER snapshot showed two hard defects (a giant
// blank-chrome strip parked mid-screen never moving until settle, and the target appearing to fly
// in from the camera side instead of from depth). This suite exists because those are exactly the
// class of bug prior unit tests (pure-function-level, or single-name spot checks) could miss --
// see this file's own "Fix wave J" section in final-fix-report.md for the full root-cause
// narrative, including the extensive empirical probing (both directions, steps 4/8/40/100, maxSlots
// 2/3/10, and a supersede scenario) that did NOT reproduce a structural name-set mismatch in THIS
// jsdom environment before the fix below landed -- documented there honestly rather than
// fabricated, alongside the real, confirmed issue this investigation DID find and fix (see
// snapshotBrowse.ts's own switchTo() comment on its safety-ceiling duration).
//
// TRUTH TABLE (names newest-first; index increasing = OLDER; see the report's own fuller
// derivation):
// - Target OLDER (toIdx > fromIdx): the old current AND every fly-through intermediate END at the
//   EXIT pose (toPose.scaleX > 1, toPose.y > 0 -- "exit past the camera"); their own START (when
//   they have a preset at all) is a receding, depth-side pose (fromPose.scaleX <= 1, fromPose.y <=
//   0). The TARGET ends at the IDENTITY pose; when it has a preset, that preset is ALSO a
//   depth-side pose (fromPose.scaleX <= 1) -- "arrives from depth, small -> 1".
// - Target NEWER (toIdx < fromIdx): the mirror image. Every fly-through intermediate STARTS at the
//   EXIT pose (fromPose.scaleX > 1, "drops in from the camera") and ENDS at a normal receding,
//   depth-side pose (toPose.scaleX <= 1, "settles into the stack"). The TARGET ends at IDENTITY;
//   when it has a preset, that preset is a CAMERA-side pose (fromPose.scaleX > 1) -- "arrives from
//   the camera side".
// `scaleX` is the unambiguous sign carrier used below (receding poses are always < 1, the exit
// pose is always exactly `EXIT_SCALE` = 1.2, identity is exactly 1 -- `y` can coincidentally be 0
// at more than one pose, `scaleX` cannot).
describe('TimeMachineDepthStack — flight integrity (Fix wave J)', () => {
  const N = 150
  const BASE = 50

  async function mountAndTravel(steps: number, forward: boolean) {
    const names = Array.from({ length: N }, (_, i) => `s${i}`)
    const fromIdx = forward ? BASE + steps : BASE
    const toIdx = forward ? BASE : BASE + steps
    const spy = vi.spyOn(choreo, 'playTravelTimeline')
    const { browse, files } = await setup(names, `s${fromIdx}`)
    const w = mount(TimeMachineDepthStack)
    await flushPromises()

    browse.tmTravel = { from: `s${fromIdx}`, to: `s${toIdx}` }
    await nextTick()
    files.currentPath = `${MOUNT}/.snapshots/s${toIdx}`
    browse.tmTravel = null
    await flushPromises()

    return { w, browse, files, spy, names, fromIdx, toIdx }
  }

  for (const steps of [4, 8, 40]) {
    for (const forward of [false, true]) {
      const dirLabel = forward ? 'NEWER target (forward)' : 'OLDER target (backward)'

      it(`${dirLabel}, steps=${steps}: (a) every mounted strip has a real tween in the built timeline -- no stuck strips`, async () => {
        const { w, spy } = await mountAndTravel(steps, forward)
        expect(spy).toHaveBeenCalledTimes(1)
        const targets = spy.mock.calls[0][0]
        const targetNames = new Set(targets.map((t) => t.el.getAttribute('data-snapshot')))
        const mountedNames = w.findAll('.tm-depth-strip').map((el) => el.attributes('data-snapshot')!)
        expect(mountedNames.length).toBeGreaterThan(0)
        for (const name of mountedNames) {
          expect(targetNames.has(name), `${name} is mounted but has no tween in the built timeline (stuck strip)`).toBe(true)
        }
      })

      it(`${dirLabel}, steps=${steps}: (b) fly-through intermediates' preset/final poses land on the CORRECT trajectory side per the truth table`, async () => {
        const { spy, names, fromIdx, toIdx } = await mountAndTravel(steps, forward)
        const opts = spy.mock.calls[0][1]
        const targets = spy.mock.calls[0][0]
        const poseByName = new Map(targets.map((t) => [t.el.getAttribute('data-snapshot'), t.pose]))
        const plan = choreo.flyThroughPlan(names, fromIdx, toIdx, { maxIntermediates: choreo.TRAVEL_FLY_MAX_INTERMEDIATES })
        expect(plan.some((s) => s.role === 'intermediate')).toBe(true) // sanity: a real fly-through with real intermediates

        for (const step of plan.filter((s) => s.role === 'intermediate')) {
          const toPose = poseByName.get(step.name)
          expect(toPose, `${step.name} has no target/final pose at all`).toBeDefined()
          if (!toPose) continue
          if (forward) {
            // Ends at a receding, depth-side pose ("settles into the stack").
            expect(toPose.scaleX, `${step.name} (forward intermediate) should END receding (scaleX <= 1)`).toBeLessThanOrEqual(1)
          }
          else {
            // Ends at the exit pose ("exits past the camera").
            expect(toPose.scaleX, `${step.name} (backward intermediate) should END at the exit pose (scaleX > 1)`).toBeGreaterThan(1)
          }
          const preset = opts.presetPoses?.[step.name]
          if (!preset) continue // a genuine old-window resident/leaving intermediate legitimately gets none (fix wave I follow-up)
          if (forward) {
            expect(preset.scaleX, `${step.name} (forward intermediate) should START at the camera (scaleX > 1)`).toBeGreaterThan(1)
          }
          else {
            expect(preset.scaleX, `${step.name} (backward intermediate) should START receding (scaleX <= 1)`).toBeLessThanOrEqual(1)
          }
        }
      })

      it(`${dirLabel}, steps=${steps}: (b) the TARGET's own preset (when it has one) lands on the CORRECT trajectory side, and it always ENDS at the identity pose`, async () => {
        const { spy, toIdx } = await mountAndTravel(steps, forward)
        const opts = spy.mock.calls[0][1]
        const targets = spy.mock.calls[0][0]
        const targetName = `s${toIdx}`
        const targetPose = targets.find((t) => t.el.getAttribute('data-snapshot') === targetName)?.pose
        expect(targetPose).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1, dim: 0, z: 0 }) // always identity

        const preset = opts.presetPoses?.[targetName]
        if (!preset) return // a small jump can leave the target a genuine old-window resident -- no preset needed, covered elsewhere
        if (forward) {
          expect(preset.scaleX, 'the target (forward/newer jump) should arrive FROM THE CAMERA (scaleX > 1), not from depth').toBeGreaterThan(1)
        }
        else {
          expect(preset.scaleX, 'the target (backward/older jump) should arrive FROM DEPTH (scaleX <= 1), not from the camera').toBeLessThanOrEqual(1)
        }
      })

      it(`${dirLabel}, steps=${steps}: (c) after the timeline fully progresses and the travel settles, no element remains at a preset pose, and the mounted set equals the natural window`, async () => {
        vi.useFakeTimers()
        try {
          const { w, browse, spy, names, toIdx } = await mountAndTravel(steps, forward)
          const tl = spy.mock.results[0].value as ReturnType<typeof choreo.playTravelTimeline>
          const targets = spy.mock.calls[0][0]
          tl.progress(1)

          // Every animated element's own rendered pose now matches its OWN final `target.pose` --
          // none is left stranded at a preset value (real gsap + jsdom, same technique
          // timeMachineChoreo.test.ts already uses for reading back x/y/scaleX/scaleY).
          for (const target of targets) {
            expect(gsap.getProperty(target.el, 'y')).toBeCloseTo(target.pose.y, 0)
            expect(gsap.getProperty(target.el, 'scaleX')).toBeCloseTo(target.pose.scaleX, 5)
          }

          // Let the reveal-gate's own timers run to completion so settle() fires and pins clear.
          await vi.advanceTimersByTimeAsync(choreo.TRAVEL_SAFETY_EXTRA_MS + choreo.TRAVEL_FLY_MAX_DURATION_MS + 100)
          await flushPromises()

          const mountedNames = w.findAll('.tm-depth-strip').map((el) => el.attributes('data-snapshot')!).sort()
          const naturalWindow = resolveDollySlots(names, toIdx, 10).map((s) => s.name).sort() // jsdom's own unmeasured-stageHeight cap (10)
          expect(mountedNames).toEqual(naturalWindow)
          expect(browse.tmTravelActive).toBe(false)
        }
        finally {
          vi.useRealTimers()
        }
      })
    }
  }
})

// Fix wave J follow-up (re-review finding (a), owner acceptance 2026-08-26): the store's OWN
// safety-ceiling timer (snapshotBrowse.ts's own `switchTo`, fixed in fix wave J to
// `Math.max(TRAVEL_MAX_DURATION_MS, TRAVEL_FLY_MAX_DURATION_MS) + TRAVEL_SAFETY_EXTRA_MS`) is
// ARMED SYNCHRONOUSLY at click time, BEFORE the async navigation even starts. The depth-stack's
// own LEGITIMATE reveal-gate (`armReveal`) is armed LATER -- only once `currentSnapshotName` has
// actually changed AND its own `nextTick()`-deferred callback has run. Both timers were built from
// the SAME nominal worst-case constant (`TRAVEL_FLY_MAX_DURATION_MS`) -- an "identical bound, one
// side armed earlier" shape is EXACTLY how a same-millisecond tie (the store's ceiling firing
// microtask-before the depth-stack's own legitimate settle, even though both target "2200ms from
// their own arm time") could produce a PREMATURE reveal. This suite proves (or disproves) that
// empirically by driving a REAL travel through `browse.switchTo()` itself (not by hand-setting
// `browse.tmTravel`, which bypasses the store's own timer-arming code entirely) with BOTH timers
// running through their real production paths.
describe('TimeMachineDepthStack — store safety ceiling vs. legitimate settle race (Fix wave J follow-up)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('a MAXIMAL fly-through driven through browse.switchTo() (the real production path for BOTH timers): the legitimate settle wins, and the store\'s own ceiling then no-ops', async () => {
    const names = Array.from({ length: 150 }, (_, i) => `s${i}`)
    const { browse, files } = await setup(names, 's0')
    mount(TimeMachineDepthStack)
    await flushPromises()
    const settleSpy = vi.spyOn(browse, 'settleTravel')

    // The REAL entry point -- arms the STORE's own safety timer synchronously, right here, before
    // `navigateReal`'s own (mocked, near-instant) promise even settles. `s100` (100 steps, well
    // past TRAVEL_FLAT_STEPS) samples the maximum TRAVEL_FLY_MAX_INTERMEDIATES(10) intermediates,
    // the largest `flyThroughDurationMs` this codebase's own real `computeFlyThroughPlan` call site
    // can EVER produce (see this describe block's own header comment, and final-fix-report.md's
    // own "Fix wave J follow-up" section, for the exact math: 10*65 + 300 = 950ms -- notably BELOW
    // `flyThroughDurationMs`'s own theoretical 1400ms cap, which the production code path can never
    // actually reach given today's TRAVEL_FLY_MAX_INTERMEDIATES/cadence/layer-duration constants).
    const switchPromise = browse.switchTo('s100')
    await vi.advanceTimersByTimeAsync(0) // let the mocked router.replace()'s own promise settle
    await switchPromise

    // This test suite mounts ONLY TimeMachineDepthStack -- there is no Files.vue route watcher
    // here to bridge the (mocked) navigation back to `files.currentPath` the way production does;
    // every other reveal-gate test in this file already sets it directly for the same reason.
    files.currentPath = `${MOUNT}/.snapshots/s100`
    await nextTick() // currentSnapshotName watcher fires
    await nextTick() // its own nextTick-deferred callback runs -- runTravel() + armReveal() actually execute here

    expect(browse.tmTravelActive).toBe(true) // still traveling -- neither gate has fired yet
    expect(settleSpy).not.toHaveBeenCalled()

    // Advance to the shared nominal worst-case duration (2200ms) -- the store's own flat ceiling's
    // own target, measured from ITS OWN arm time (click, i.e. effectively t=0 here).
    await vi.advanceTimersByTimeAsync(2200)

    // The LEGITIMATE settle (armReveal's own gate, armed a couple of ticks after t=0 but with a
    // SHORTER real duration -- 950 + 800 = 1750ms from ITS OWN arm time) must already have fired by
    // now, calling `browse.settleTravel()` itself -- not the store's own flat ceiling taking over.
    expect(settleSpy).toHaveBeenCalledTimes(1)
    expect(browse.tmTravelActive).toBe(false)

    // Advance well past BOTH timers' own absolute deadlines. settleTravel() must still have been
    // called EXACTLY once -- the store's own ceiling, even if it were technically still pending,
    // was already cancelled by the legitimate settle() (which calls `clearTravelSafetyTimer()`,
    // snapshotBrowse.ts's own settleTravel), so it can never fire a second, redundant flip.
    await vi.advanceTimersByTimeAsync(2000)
    expect(settleSpy).toHaveBeenCalledTimes(1)
  })
})
