import { describe, it, expect } from 'vitest'
import {
  fisheyeScale,
  computeFisheyeScales,
  buildRailNodes,
  resolveDollySlots,
  resolveSlotPose,
  clampStepIndex,
  computeVisibleStripCap,
  FISHEYE_RADIUS,
  FISHEYE_MIN_SCALE,
  FISHEYE_MAX_SCALE,
  TM_WINDOW_SCALE,
  TM_RAIL_WIDTH,
  TM_STEPPER_BAND,
  TM_DEPTH_STEP,
} from './timeMachineMath'

// --- Kept-for-compat exports (colleague's card-deck mockup). DECK_WINDOW /
// buildVisibleStack / StackEntry / stepSelectedIndex were removed from
// timeMachineMath.ts (and their own tests below) in Task 6 (Ruling P2)
// alongside TimeMachineDeck.vue/TimeMachineOverlay.vue, their only
// consumers. computeFisheyeScales/buildRailNodes stay: TimeMachineRail.vue
// (not deleted yet -- Task 7 rebuilds the rail) still imports them.

describe('computeFisheyeScales (kept for compat)', () => {
  it('batch compute by distance of each tick center to cursor', () => {
    const out = computeFisheyeScales([100, 140, 300], 100)
    expect(out).toHaveLength(3)
    expect(out[0]).toBeCloseTo(2.2, 5)
    expect(out[2]).toBe(1)
  })
  it('empty input returns empty array', () => {
    expect(computeFisheyeScales([], 0)).toEqual([])
  })
})

describe('buildRailNodes (kept for compat)', () => {
  const groups = [
    { dayKey: '2026-07-30', labelText: '今天', items: [{ flatIndex: 0 }, { flatIndex: 1 }] },
    { dayKey: '2026-07-29', labelText: '昨天', items: [{ flatIndex: 2 }] },
  ]
  it('insert date header node before each group', () => {
    const nodes = buildRailNodes(groups)
    expect(nodes.filter((n) => n.type === 'day').map((n) => n.label)).toEqual(['今天', '昨天'])
  })
  it('main tick per snapshot, flatIndex passed through', () => {
    expect(buildRailNodes(groups).filter((n) => n.type === 'main').map((n) => n.flatIndex)).toEqual([0, 1, 2])
  })
  it('insert 2 sub ticks between adjacent main ticks, anchored to upper main tick', () => {
    const nodes = buildRailNodes(groups)
    const subs = nodes.filter((n) => n.type === 'sub')
    expect(subs).toHaveLength(4)
    expect(subs.slice(0, 2).every((n) => n.anchorIndex === 0)).toBe(true)
  })
  it('no sub ticks after last main tick', () => {
    const nodes = buildRailNodes(groups)
    expect(nodes[nodes.length - 1].type).toBe('main')
  })
  it('key globally unique (v-for will not collide)', () => {
    const keys = buildRailNodes(groups).map((n) => n.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('subPerGap can be configured to 0', () => {
    expect(buildRailNodes(groups, 0).filter((n) => n.type === 'sub')).toEqual([])
  })
  it('empty groups return empty', () => {
    expect(buildRailNodes([])).toEqual([])
  })
})

// --- Vue2-parity math (this task's real deliverable) -------------------
// Behavior assertions mined from Vue2's tests/timeMachineMath.test.js
// (fisheyeScale / resolveDollySlots / resolveSlotPose describe blocks),
// adapted to the new signatures (see timeMachineMath.ts's own header
// comment for the exact deviations: no options bag, `names: string[]`,
// `depth` instead of `slot`, `{x,y,scale,dim,z}` pose shape, no pinNames/
// stageHeight). compensateMenuPosition/compensateFixedPosition and
// resolveStepperBoundaries are intentionally not ported here -- see the
// controller ruling in this task's brief (menu compensation deferred to a
// later task, empirically) and clampStepIndex below (which fuses
// resolveStepperBoundaries' boolean pair into one call).

// Mirrors the module's private DEFAULT_MAX_SLOTS -- used only to pass the
// default maxSlots through explicitly when a test needs to supply a 4th
// (pinNames) argument without changing the window size.
const DEFAULT_MAX_SLOTS_FOR_TEST = 10

describe('constants', () => {
  it('exposes the exact numeric contract downstream tasks rely on', () => {
    expect(FISHEYE_RADIUS).toBe(70)
    expect(FISHEYE_MIN_SCALE).toBe(1)
    expect(FISHEYE_MAX_SCALE).toBe(2.2)
    expect(TM_WINDOW_SCALE).toBe(0.82)
    expect(TM_RAIL_WIDTH).toBe(220)
    expect(TM_STEPPER_BAND).toBe(60)
    expect(TM_DEPTH_STEP).toBe(30)
  })
})

describe('fisheyeScale — cursor-distance -> continuous magnification curve', () => {
  it('is maxScale exactly at the cursor (distance 0)', () => {
    expect(fisheyeScale(0)).toBeCloseTo(2.2, 5)
  })

  it('is minScale at and beyond the radius', () => {
    expect(fisheyeScale(70)).toBe(1)
    expect(fisheyeScale(140)).toBe(1)
  })

  it('is symmetric -- same distance on either side of the cursor gives the same scale', () => {
    expect(fisheyeScale(-30)).toBeCloseTo(fisheyeScale(30), 10)
  })

  it('is monotonically non-increasing as distance grows (a continuous falloff, not a step function)', () => {
    const samples = Array.from({ length: 15 }, (_, i) => fisheyeScale(i * 5))
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1] + 1e-9)
    }
  })

  it('eases in/out (raised-cosine) -- the midpoint (distance = radius/2) is exactly halfway between min and max', () => {
    expect(fisheyeScale(35)).toBeCloseTo((FISHEYE_MIN_SCALE + FISHEYE_MAX_SCALE) / 2, 5) // (1+2.2)/2
  })

  it('zero slope at both ends -- delta right next to the cursor is far smaller than the same-spacing delta midway out', () => {
    const nearCenter = fisheyeScale(0) - fisheyeScale(2)
    const midway = fisheyeScale(34) - fisheyeScale(36)
    expect(nearCenter).toBeLessThan(midway)
  })

  it('treats non-finite distance defensively as "far" (minScale), never throws/NaNs', () => {
    expect(fisheyeScale(NaN)).toBe(1)
    expect(fisheyeScale(Infinity)).toBe(1)
  })

  it('accepts an options override for the kept-for-compat computeFisheyeScales caller', () => {
    expect(fisheyeScale(0, { maxScale: 3, minScale: 1.5 })).toBeCloseTo(3, 5)
    expect(fisheyeScale(10, { radius: 10 })).toBe(1)
  })
})

describe('resolveDollySlots — name-keyed dolly-slot assignment for a newest-first list', () => {
  it('includes ONLY the selection itself (depth 0) at the newest snapshot (index 0)', () => {
    expect(resolveDollySlots(['a'], 0)).toEqual([{ name: 'a', depth: 0 }])
  })

  it('one slot per snapshot strictly older than the selection, plus the selection itself, plus depth -1 when a more-recent snapshot exists', () => {
    expect(resolveDollySlots(['a', 'b', 'c', 'd'], 0)).toHaveLength(4) // 3 older + depth 0, nothing more recent
    expect(resolveDollySlots(['a', 'b', 'c', 'd'], 2)).toHaveLength(3) // 1 older + depth 0 + depth -1 ('b')
  })

  it('includes depth -1 (the one snapshot more recent than the selection) whenever one exists', () => {
    const slots = resolveDollySlots(['a', 'b', 'c'], 1) // 'b' selected, 'a' is more recent
    expect(slots.find((s) => s.name === 'a')).toEqual({ name: 'a', depth: -1 })
  })

  it('never includes a depth -1 entry at the newest snapshot (nothing more recent to occupy it)', () => {
    const slots = resolveDollySlots(['a', 'b', 'c'], 0)
    expect(slots.some((s) => s.depth === -1)).toBe(false)
  })

  it('is the selection (depth 0) plus depth -1 at the oldest snapshot (nothing older, but a more-recent neighbor still exists)', () => {
    expect(resolveDollySlots(['a', 'b', 'c', 'd'], 3)).toEqual([
      { name: 'd', depth: 0 },
      { name: 'c', depth: -1 },
    ])
  })

  it('caps the OLDER cascade at 10 slots by default regardless of how many older snapshots exist (depth 0/-1 never counted against the cap)', () => {
    const many = Array.from({ length: 11 }, (_, i) => 's' + i)
    expect(resolveDollySlots(many, 0).filter((s) => s.depth >= 1)).toHaveLength(10)
    const huge = Array.from({ length: 500 }, (_, i) => 's' + i)
    expect(resolveDollySlots(huge, 0).filter((s) => s.depth >= 1)).toHaveLength(10)
  })

  it('is empty when there is no current selection yet (currentIndex -1, e.g. mid-fetch)', () => {
    expect(resolveDollySlots(['a', 'b', 'c'], -1)).toEqual([])
  })

  it('is empty defensively for non-integer/missing/out-of-range inputs (no crash)', () => {
    expect(resolveDollySlots(['a', 'b'], null as unknown as number)).toEqual([])
    expect(resolveDollySlots(null as unknown as string[], 0)).toEqual([])
    expect(resolveDollySlots(['a', 'b'], 1.5)).toEqual([])
    expect(resolveDollySlots(['a', 'b'], 5)).toEqual([])
  })

  it('carries the ACTUAL snapshot name at each depth (not a synthetic position label)', () => {
    expect(resolveDollySlots(['a', 'b', 'c', 'd'], 0)).toEqual([
      { name: 'd', depth: 3 },
      { name: 'c', depth: 2 },
      { name: 'b', depth: 1 },
      { name: 'a', depth: 0 },
    ])
  })

  it('is returned FARTHEST-first -- the nearest slot (including -1, when present) is the last array element', () => {
    const slots = resolveDollySlots(['a', 'b', 'c'], 1) // 'b' selected: 'a' at -1, 'b' at 0, 'c' at 1
    expect(slots.map((s) => s.depth)).toEqual([1, 0, -1])
  })

  it('the SAME snapshot name lands at a DIFFERENT depth after the selection moves by one -- the persistence hook a keyed v-for relies on', () => {
    const flat = ['a', 'b', 'c', 'd']
    const before = resolveDollySlots(flat, 0).find((s) => s.name === 'c')
    const after = resolveDollySlots(flat, 1).find((s) => s.name === 'c')
    expect(before?.depth).toBe(2)
    expect(after?.depth).toBe(1)
  })

  it('a snapshot that becomes the NEW selection re-slots to 0; the OLD selection re-slots to -1 or +1 depending on direction, never dropped mid-travel', () => {
    const flat = ['a', 'b', 'c', 'd']
    expect(resolveDollySlots(flat, 0).find((s) => s.name === 'b')?.depth).toBe(1)

    const afterEarlier = resolveDollySlots(flat, 1) // switched to 'b' (earlier)
    expect(afterEarlier.find((s) => s.name === 'b')?.depth).toBe(0)
    expect(afterEarlier.find((s) => s.name === 'a')?.depth).toBe(-1)

    const afterLater = resolveDollySlots(flat, 0) // switched back to 'a' (later)
    expect(afterLater.find((s) => s.name === 'a')?.depth).toBe(0)
    expect(afterLater.find((s) => s.name === 'b')?.depth).toBe(1)
  })

  it('maxSlots is overridable, still pure/deterministic (bounds only the older cascade, not depth 0/-1)', () => {
    const many = Array.from({ length: 20 }, (_, i) => 's' + i)
    expect(resolveDollySlots(many, 0, 4).map((s) => s.depth)).toEqual([4, 3, 2, 1, 0])
  })

  // Fix Round 11 (M2-F15, ported): pinNames is what fixes the "a multi-step
  // jump beyond the visible window hard-cuts instead of animating" defect --
  // a real, previously-fixed Vue2 regression the fisheye rail encourages
  // (clicking a tick far from the current selection).
  describe('pinNames (ported from Vue2 Fix Round 11/M2-F15): force-including specific names beyond the [-1, maxSlots] window', () => {
    it('force-includes a name far beyond maxSlots, at its OWN real (unclamped) depth', () => {
      const many = Array.from({ length: 20 }, (_, i) => 's' + i) // s0 newest .. s19 oldest
      const slots = resolveDollySlots(many, 0, 3, ['s15'])
      expect(slots.map((s) => s.depth).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 15])
      expect(slots.find((s) => s.name === 's15')).toEqual({ name: 's15', depth: 15 })
    })

    it('force-includes a name on the negative ("more recent than selection") side beyond the bare -1 depth', () => {
      const flat = ['a', 'b', 'c', 'd', 'e'] // newest-first
      // Selection is 'd' (index 3); 'a' (index 0) is 3 steps more recent -- its real depth is -3.
      const slots = resolveDollySlots(flat, 3, DEFAULT_MAX_SLOTS_FOR_TEST, ['a'])
      expect(slots.find((s) => s.name === 'a')).toEqual({ name: 'a', depth: -3 })
      // 'b' (index 1, real depth -2) is NOT pinned and stays excluded -- pinning is per-name.
      expect(slots.some((s) => s.name === 'b')).toBe(false)
    })

    it('is a no-op when the pinned name would already be included by the normal window (no duplicate entry)', () => {
      const flat = ['a', 'b', 'c']
      const slots = resolveDollySlots(flat, 1, DEFAULT_MAX_SLOTS_FOR_TEST, ['a', 'b']) // both already in-range
      expect(slots.filter((s) => s.name === 'a').length).toBe(1)
      expect(slots.filter((s) => s.name === 'b').length).toBe(1)
    })

    it('defaults to [] (identical output to omitting the argument entirely)', () => {
      const flat = ['a', 'b', 'c', 'd']
      expect(resolveDollySlots(flat, 1, DEFAULT_MAX_SLOTS_FOR_TEST, [])).toEqual(resolveDollySlots(flat, 1))
    })

    it('ignores pin names that do not exist in names (defensive, no crash)', () => {
      const flat = ['a', 'b', 'c']
      expect(() => resolveDollySlots(flat, 0, DEFAULT_MAX_SLOTS_FOR_TEST, ['does-not-exist'])).not.toThrow()
      expect(resolveDollySlots(flat, 0, DEFAULT_MAX_SLOTS_FOR_TEST, ['does-not-exist']).some((s) => s.name === 'does-not-exist')).toBe(false)
    })

    it('a pinned far name still sorts farthest-first alongside the normal cascade (DOM-order/paint-order invariant preserved)', () => {
      const many = Array.from({ length: 20 }, (_, i) => 's' + i)
      const slots = resolveDollySlots(many, 0, 3, ['s15'])
      expect(slots.map((s) => s.depth)).toEqual([15, 3, 2, 1, 0])
    })
  })
})

describe('resolveSlotPose — unified per-depth pose, T(-1) through T(cap)', () => {
  it('depth 1 (nearest of the older cascade) is close to full scale/brightness with a small, non-zero offset', () => {
    const p = resolveSlotPose(1)
    expect(p.y).toBeLessThan(0)
    expect(p.scaleX).toBeLessThan(1)
    expect(p.scaleX).toBeGreaterThan(0.9)
    expect(p.scaleY).toBe(1) // narrows X only -- the "thin peeking sliver" look
    expect(p.dim).toBeGreaterThan(0)
    expect(p.dim).toBeLessThan(0.1)
  })

  it('is progressively higher (more negative y), narrower (smaller scaleX), and dimmer (higher dim) as depth grows, for the older cascade', () => {
    for (let depth = 1; depth < 10; depth++) {
      const near = resolveSlotPose(depth)
      const far = resolveSlotPose(depth + 1)
      expect(far.y).toBeLessThan(near.y) // more negative = higher
      expect(far.scaleX).toBeLessThanOrEqual(near.scaleX)
      expect(far.scaleY).toBe(1)
      expect(far.dim).toBeGreaterThanOrEqual(near.dim)
    }
  })

  it('never lets scaleX go below its floor, nor dim exceed its ceiling, even at a deep depth', () => {
    const p = resolveSlotPose(30)
    expect(p.scaleX).toBeGreaterThanOrEqual(0.78)
    expect(p.dim).toBeLessThanOrEqual(0.55)
  })

  it('the per-depth offset step is exactly TM_DEPTH_STEP', () => {
    expect(resolveSlotPose(1).y).toBe(-TM_DEPTH_STEP)
    expect(resolveSlotPose(3).y).toBe(-3 * TM_DEPTH_STEP)
  })

  it('T(0) is the identity pose -- no offset, uniform 1x scale, never dimmed', () => {
    expect(resolveSlotPose(0)).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1, dim: 0, z: 0 })
  })

  it('T(-1) grows UNIFORMLY past 1x (not the older cascade\'s scaleX-only narrowing), translates well past a typical viewport, and is never dimmed', () => {
    const p = resolveSlotPose(-1)
    expect(p.scaleX).toBeGreaterThan(1)
    expect(p.scaleX).toBe(p.scaleY) // uniform, not a narrowing-only scaleX
    expect(p.y).toBeGreaterThan(900) // clears a typical viewport height (fallback)
    expect(p.dim).toBe(0)
  })

  it('every depth <= -1 collapses to the SAME T(-1) pose when stageHeight is omitted (there is only ever one "past the camera" slot rendered at a time)', () => {
    expect(resolveSlotPose(-1)).toEqual(resolveSlotPose(-2))
    expect(resolveSlotPose(-1)).toEqual(resolveSlotPose(-100))
  })

  it('nearer depths get a higher z than farther ones, so paint order does not depend on array/DOM order', () => {
    expect(resolveSlotPose(-1).z).toBeGreaterThan(resolveSlotPose(0).z)
    expect(resolveSlotPose(0).z).toBeGreaterThan(resolveSlotPose(1).z)
    expect(resolveSlotPose(1).z).toBeGreaterThan(resolveSlotPose(2).z)
  })

  // Ported from Vue2's resolveSlotPose stageHeight option: the production
  // path measures the real stage height and derives the T(-1) exit offset
  // from it (`stageHeight * 1.4`) rather than always using the fixed
  // pre-mount/test fallback (1600), which under-throws on any stage taller
  // than ~1143px.
  describe('stageHeight (ported from Vue2): T(-1) exit offset derived from the real measured stage', () => {
    it('derives the exit offset as stageHeight * 1.4 when stageHeight is known', () => {
      expect(resolveSlotPose(-1, 1400).y).toBeCloseTo(1960, 9) // 1400 * 1.4
    })

    it('scales with stageHeight, not a fixed number', () => {
      const short = resolveSlotPose(-1, 600)
      const tall = resolveSlotPose(-1, 1800)
      expect(tall.y).toBeGreaterThan(short.y)
      expect(short.y).toBeGreaterThan(600) // still clears its own (shorter) stage
    })

    it('falls back to the fixed 1600 constant when stageHeight is unknown/non-finite/non-positive', () => {
      const unmeasured = resolveSlotPose(-1)
      expect(unmeasured.y).toBe(1600)
      expect(resolveSlotPose(-1, NaN).y).toBe(1600)
      expect(resolveSlotPose(-1, 0).y).toBe(1600)
      expect(resolveSlotPose(-1, -100).y).toBe(1600)
    })

    it('every depth <= -1 still collapses to the SAME pose for a given stageHeight', () => {
      expect(resolveSlotPose(-1, 1000)).toEqual(resolveSlotPose(-5, 1000))
    })
  })
})

describe('clampStepIndex — step target clamped into [0, count-1], null at a boundary', () => {
  it('steps normally from a middle position in either direction', () => {
    expect(clampStepIndex(1, 1, 3)).toBe(2)
    expect(clampStepIndex(1, -1, 3)).toBe(0)
  })

  it('returns null stepping "earlier" (delta +1) past the oldest snapshot (the last index)', () => {
    expect(clampStepIndex(2, 1, 3)).toBeNull()
  })

  it('returns null stepping "later" (delta -1) past the newest snapshot (index 0)', () => {
    expect(clampStepIndex(0, -1, 3)).toBeNull()
  })

  it('returns null in both directions when there is only a single snapshot (simultaneously oldest and newest)', () => {
    expect(clampStepIndex(0, 1, 1)).toBeNull()
    expect(clampStepIndex(0, -1, 1)).toBeNull()
  })

  it('returns null when there is no current selection yet (current -1, e.g. mid-fetch)', () => {
    expect(clampStepIndex(-1, 1, 3)).toBeNull()
    expect(clampStepIndex(-1, -1, 3)).toBeNull()
  })

  it('returns null defensively for a zero/missing/non-integer count or current (no crash)', () => {
    expect(clampStepIndex(0, 1, 0)).toBeNull()
    expect(clampStepIndex(0, 1, NaN)).toBeNull()
    expect(clampStepIndex(1.5, 1, 3)).toBeNull()
  })
})

// Task 7 addition: ported from Vue2's own computeVisibleStripCap
// (timeMachineMath.js) -- see timeMachineMath.ts's own header comment on
// this function for the full geometry derivation and the Vue2 defect
// (Fix Round 7b) it fixes.
describe('computeVisibleStripCap — how many depth-stack strips fit above the stage\'s own clip line', () => {
  it('assumes the historical, viewport-uncapped ceiling (maxSlots) when stageHeight is unmeasured/non-finite/non-positive', () => {
    expect(computeVisibleStripCap(0)).toBe(10)
    expect(computeVisibleStripCap(Number.NaN)).toBe(10)
    expect(computeVisibleStripCap(-100)).toBe(10)
    expect(computeVisibleStripCap(undefined as unknown as number)).toBe(10)
  })

  it('matches the exact Vue2 reference value for an 800px-tall stage (default geometry)', () => {
    // unscaledHeight = 800-80 = 720; windowTopY = 0.58*(1-0.82)*720 = 75.168;
    // perSlotOnScreen = 30*0.82 = 24.6; cap = floor((75.168-12)/24.6) = 2
    expect(computeVisibleStripCap(800)).toBe(2)
  })

  it('grows monotonically with stage height', () => {
    let prev = computeVisibleStripCap(400)
    for (const h of [500, 700, 900, 1200, 1600, 2400]) {
      const cap = computeVisibleStripCap(h)
      expect(cap).toBeGreaterThanOrEqual(prev)
      prev = cap
    }
  })

  it('never exceeds the provided maxSlots, however tall the stage', () => {
    expect(computeVisibleStripCap(100000)).toBe(10)
    expect(computeVisibleStripCap(100000, 4)).toBe(4)
  })

  it('never goes below 0 (a very short stage clips the entire cascade, not a negative count)', () => {
    expect(computeVisibleStripCap(50)).toBe(0)
    expect(computeVisibleStripCap(1)).toBe(0)
  })

  it('is 0 once the stage is shorter than the bottom gap alone (no room left to derive a positive window top)', () => {
    expect(computeVisibleStripCap(80)).toBe(0)
    expect(computeVisibleStripCap(79)).toBe(0)
  })

  it('honors a custom maxSlots ceiling for a tall stage that would otherwise derive a larger cap', () => {
    expect(computeVisibleStripCap(4000, 3)).toBe(3)
  })
})
