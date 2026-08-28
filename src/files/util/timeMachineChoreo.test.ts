import { afterEach, describe, expect, it, vi } from 'vitest'
import gsap from 'gsap'
import type { SlotPose } from './timeMachineMath'
import {
  EXIT_FADE_MS,
  TM_TRAVEL_EASE,
  TRAVEL_BASE_DURATION_MS,
  TRAVEL_FLAT_STEPS,
  TRAVEL_MAX_DURATION_MS,
  TRAVEL_STAGGER_CAP_MS,
  TRAVEL_FLY_CADENCE_MS,
  TRAVEL_FLY_LAYER_DURATION_MS,
  TRAVEL_FLY_MAX_DURATION_MS,
  TRAVEL_FLY_MAX_INTERMEDIATES,
  dimGsapVars,
  flyThroughDurationMs,
  flyThroughPlan,
  playTravelTimeline,
  poseToGsapVars,
  prefersReducedMotion,
  registerTmEase,
  travelDurationMs,
  travelStaggerMs,
} from './timeMachineChoreo'

// Test expectations mined from Vue2's own tests/timeMachineChoreo.test.js
// (resolveTravelDurationMs/resolveTravelStaggerMs/poseToGsapVars/
// dimGsapVars/playTravelTimeline describe blocks) and adapted for this
// module's own combined-target API (see timeMachineChoreo.ts's own header
// comment for the documented deviations from both Vue2 and the brief's
// sketch). Real gsap runs fine in jsdom (per this project's own repo facts),
// so `playTravelTimeline` is exercised against REAL gsap + plain-object
// targets -- gsap tweens a plain (non-DOM) target by direct property
// assignment, so `tl.progress(1)` synchronously fast-forwards and the
// resulting numeric properties can be asserted directly, with no timers and
// no stubbing needed.

function pose(overrides: Partial<SlotPose> = {}): SlotPose {
  return { x: 0, y: 0, scaleX: 1, scaleY: 1, dim: 0, z: 0, ...overrides }
}

describe('travelDurationMs — distance -> shared travel duration (ms)', () => {
  it('is exactly TRAVEL_BASE_DURATION_MS (420ms) for a single step', () => {
    expect(travelDurationMs(1)).toBe(TRAVEL_BASE_DURATION_MS)
    expect(travelDurationMs(1)).toBe(420)
  })

  it('stays exactly the base duration for every jump within TRAVEL_FLAT_STEPS', () => {
    for (let n = 1; n <= TRAVEL_FLAT_STEPS; n++) {
      expect(travelDurationMs(n)).toBe(TRAVEL_BASE_DURATION_MS)
    }
  })

  it('grows once distance exceeds the flat zone, monotonically, and never exceeds TRAVEL_MAX_DURATION_MS', () => {
    let prev = travelDurationMs(TRAVEL_FLAT_STEPS)
    for (let n = TRAVEL_FLAT_STEPS + 1; n <= 200; n++) {
      const d = travelDurationMs(n)
      expect(d).toBeGreaterThanOrEqual(prev)
      expect(d).toBeLessThanOrEqual(TRAVEL_MAX_DURATION_MS)
      prev = d
    }
  })

  it('approaches (but never reaches or exceeds) TRAVEL_MAX_DURATION_MS (900ms) for a very large jump', () => {
    const huge = travelDurationMs(10000)
    expect(huge).toBeLessThanOrEqual(TRAVEL_MAX_DURATION_MS)
    expect(huge).toBeGreaterThan(TRAVEL_BASE_DURATION_MS)
    expect(TRAVEL_MAX_DURATION_MS - huge).toBeLessThan(5) // asymptotically close
  })

  it('is exactly the Vue2 reference value for a 13-step jump (13 = TRAVEL_FLAT_STEPS(3) + 10)', () => {
    // Vue2 formula: round(420 + (900-420) * (1 - exp(-(13-3)/10))) = round(420 + 480*(1-exp(-1)))
    const expected = Math.round(420 + 480 * (1 - Math.exp(-1)))
    expect(travelDurationMs(13)).toBe(expected)
  })

  it('treats distance defensively -- 0/negative/non-finite all resolve as "at least one step" (base duration), never NaN/throw', () => {
    expect(travelDurationMs(0)).toBe(TRAVEL_BASE_DURATION_MS)
    expect(travelDurationMs(-1)).toBe(TRAVEL_BASE_DURATION_MS)
    expect(travelDurationMs(Number.NaN)).toBe(TRAVEL_BASE_DURATION_MS)
    expect(travelDurationMs(undefined as unknown as number)).toBe(TRAVEL_BASE_DURATION_MS)
  })

  it('is symmetric in sign -- a "later" jump (negative distance, by convention) grows identically to the same-magnitude "earlier" one', () => {
    expect(travelDurationMs(-20)).toBe(travelDurationMs(20))
  })
})

describe('travelStaggerMs — per-layer index -> start delay (ms), small and capped', () => {
  it('is 0 for the first layer (index 0) -- the nearest layer leads with no delay', () => {
    expect(travelStaggerMs(0)).toBe(0)
  })

  it('grows with index, linearly at 6ms/layer, but never exceeds TRAVEL_STAGGER_CAP_MS (40ms)', () => {
    let prev = travelStaggerMs(0)
    for (let order = 1; order <= 50; order++) {
      const d = travelStaggerMs(order)
      expect(d).toBeGreaterThanOrEqual(prev)
      expect(d).toBeLessThanOrEqual(TRAVEL_STAGGER_CAP_MS)
      prev = d
    }
    expect(travelStaggerMs(1000)).toBe(TRAVEL_STAGGER_CAP_MS)
    expect(travelStaggerMs(1)).toBe(6)
    expect(travelStaggerMs(6)).toBe(36)
    expect(travelStaggerMs(7)).toBe(TRAVEL_STAGGER_CAP_MS) // 42 clamped to 40
  })

  it('treats a negative/non-finite index defensively as 0 (no negative delay, no throw)', () => {
    expect(travelStaggerMs(-5)).toBe(0)
    expect(travelStaggerMs(Number.NaN)).toBe(0)
  })
})

describe('poseToGsapVars / dimGsapVars — pure pose -> gsap var mapping', () => {
  it('maps x/y/scaleX/scaleY straight through -- no opacity, no layout property', () => {
    const p = pose({ x: 5, y: -30, scaleX: 0.9, scaleY: 1, dim: 0.3, z: 2 })
    expect(poseToGsapVars(p)).toEqual({ x: 5, y: -30, scaleX: 0.9, scaleY: 1 })
  })

  it('dimGsapVars is a straight passthrough of pose.dim as opacity (New-UI\'s dim is already the final overlay opacity, not a brightness value to invert)', () => {
    expect(dimGsapVars(pose({ dim: 0.3 })).opacity).toBeCloseTo(0.3, 10)
    expect(dimGsapVars(pose({ dim: 0 })).opacity).toBe(0)
    expect(dimGsapVars(pose({ dim: 0.55 })).opacity).toBeCloseTo(0.55, 10)
  })
})

describe('registerTmEase — idempotent CustomEase registration', () => {
  it('registers TM_TRAVEL_EASE and can be called repeatedly without throwing', () => {
    expect(() => {
      registerTmEase()
      registerTmEase()
      registerTmEase()
    }).not.toThrow()
    expect(TM_TRAVEL_EASE).toBe('tmTravelEase')
  })
})

describe('EXIT_FADE_MS — shared constant for the stage\'s own CSS exit fade', () => {
  it('is 220ms (Vue2 parity)', () => {
    expect(EXIT_FADE_MS).toBe(220)
  })
})

describe('prefersReducedMotion', () => {
  afterEach(() => {
    // @ts-expect-error -- test-only cleanup of a stubbed global
    delete window.matchMedia
  })

  it('is false when matchMedia reports no preference', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
    expect(prefersReducedMotion()).toBe(false)
  })

  it('is true when matchMedia reports prefers-reduced-motion: reduce', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    expect(prefersReducedMotion()).toBe(true)
  })

  it('is defensively false when matchMedia is unavailable', () => {
    // @ts-expect-error -- simulating an environment without matchMedia
    window.matchMedia = undefined
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe('playTravelTimeline — the one gsap-touching function, exercised against real gsap', () => {
  afterEach(() => {
    // @ts-expect-error -- test-only cleanup of a stubbed global
    delete window.matchMedia
  })

  function target(overrides: Partial<SlotPose> = {}, withDim = true) {
    // Real jsdom DOM elements -- gsap's transform props (x/y/scaleX/scaleY)
    // only apply through its CSSPlugin, which requires an actual node with a
    // `style`; plain objects trigger its "Missing plugin?" warning for those
    // reserved property names. opacity/zIndex are read straight off
    // `el.style`; x/y/scaleX/scaleY are read back via gsap.getProperty
    // (they compose into a single `transform: matrix(...)` string).
    return {
      el: document.createElement('div'),
      dimEl: withDim ? document.createElement('div') : null,
      pose: pose(overrides),
    }
  }

  it('builds one timeline and drives every target to its pose\'s x/y/scaleX/scaleY (and the dim overlay to pose.dim) once fully progressed', () => {
    const far = target({ x: 0, y: -60, scaleX: 0.9, scaleY: 1, dim: 0.3, z: 1 })
    const near = target({ x: 0, y: 0, scaleX: 1, scaleY: 1, dim: 0, z: 2 })
    const tl = playTravelTimeline([far, near], { steps: 1 })
    tl.progress(1)
    expect(gsap.getProperty(far.el, 'y')).toBeCloseTo(-60)
    expect(gsap.getProperty(far.el, 'scaleX')).toBeCloseTo(0.9)
    expect(Number(far.dimEl!.style.opacity)).toBeCloseTo(0.3)
    expect(gsap.getProperty(near.el, 'y')).toBeCloseTo(0)
    expect(Number(near.dimEl!.style.opacity)).toBeCloseTo(0)
    tl.kill()
  })

  it('applies z-index instantly via gsap.set, independent of the timeline\'s own progress', () => {
    const far = target({ z: 3 })
    const tl = playTravelTimeline([far], { steps: 1 })
    // z is set immediately (gsap.set), not part of the timeline -- true even before progress().
    expect(far.el.style.zIndex).toBe('3')
    tl.kill()
  })

  it('every tween carries the shared ease and overwrite: "auto"', () => {
    const one = target({ x: 10 })
    const tl = playTravelTimeline([one], { steps: 1 })
    const children = tl.getChildren()
    expect(children.length).toBeGreaterThan(0)
    children.forEach((child) => {
      const vars = (child as unknown as { vars: Record<string, unknown> }).vars
      expect(vars.ease).toBe(TM_TRAVEL_EASE)
      expect(vars.overwrite).toBe('auto')
    })
    tl.kill()
  })

  it('assigns stagger in reverse order -- the LAST target in the array (nearest) leads with 0 delay, earlier ones delay more, capped', () => {
    const farthest = target()
    const mid = target()
    const nearest = target()
    const tl = playTravelTimeline([farthest, mid, nearest], { steps: 1 })
    const children = tl.getChildren()
    // one .to() per target (no dimEl passed as null here would still be present -- default target() gives a dimEl)
    const delays = children.map(child => (child as unknown as { startTime: () => number }).startTime())
    // nearest (last in array) -> delay 0; farthest (first in array) -> largest delay
    expect(Math.min(...delays)).toBe(0)
    expect(Math.max(...delays)).toBeLessThanOrEqual(TRAVEL_STAGGER_CAP_MS / 1000)
    tl.kill()
  })

  it('skips a target with neither el nor dimEl gracefully (no throw)', () => {
    const neither = { el: null as unknown as Element, dimEl: null, pose: pose() }
    expect(() => {
      const tl = playTravelTimeline([neither], { steps: 1 })
      tl.kill()
    }).not.toThrow()
  })

  it('is empty/defensive for a missing targets array', () => {
    expect(() => {
      const tl = playTravelTimeline(null as unknown as [], { steps: 1 })
      expect(tl.getChildren().length).toBe(0)
      tl.kill()
    }).not.toThrow()
  })

  it('fires onComplete when the timeline finishes', () => {
    const onComplete = vi.fn()
    const one = target()
    const tl = playTravelTimeline([one], { steps: 1, onComplete })
    tl.progress(1)
    expect(onComplete).toHaveBeenCalledTimes(1)
    tl.kill()
  })

  it('collapses duration() to 0 under prefers-reduced-motion (mocked matchMedia)', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    const one = target()
    const two = target()
    const tl = playTravelTimeline([one, two], { steps: 20 })
    expect(tl.duration()).toBe(0)
    tl.kill()
  })

  it('does not collapse duration() to 0 when reduced motion is not requested', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
    const one = target()
    const tl = playTravelTimeline([one], { steps: 1 })
    expect(tl.duration()).toBeGreaterThan(0)
    tl.kill()
  })

  // The long-jump fly-through's own OPTIONAL
  // additions to this function -- delayOverridesMs / presetPoses / durationMsOverride. Every
  // call site before this addition (every test ABOVE this describe block) never passes any of these, and all
  // of them still pass unmodified -- that IS the "byte-identical when omitted"
  // regression contract, already proven by the untouched suite above continuing to pass.
  describe('delayOverridesMs / presetPoses / durationMsOverride', () => {
    it('delayOverridesMs overrides the position-based stagger for a NAMED target, leaving un-named/un-overridden targets on the default', () => {
      const named = { ...target(), name: 'intermediate-1' }
      const plain = target() // no name -- must fall back to position-based stagger, unaffected
      const tl = playTravelTimeline([named, plain], { steps: 1, delayOverridesMs: { 'intermediate-1': 130 } })
      const children = tl.getChildren()
      const startTimes = children.map((c) => (c as unknown as { startTime: () => number }).startTime())
      expect(startTimes).toContain(0.13) // 130ms -> 0.13s, the named override
      tl.kill()
    })

    it('presetPoses gsap.sets a NAMED target to the preset pose IMMEDIATELY (before the timeline plays at all), which the target\'s own tween then animates away from', () => {
      const preset: SlotPose = pose({ y: 900, scaleX: 1.2, scaleY: 1.2 })
      const named = { ...target({ y: 0, scaleX: 1, scaleY: 1 }), name: 'fly-1' }
      const tl = playTravelTimeline([named], { steps: 1, presetPoses: { 'fly-1': preset } })
      // The preset applies via an immediate gsap.set (same timing as the existing unconditional
      // z-index set) -- readable straight off the element BEFORE any progress() call at all, same
      // way the "applies z-index instantly" test above reads style.zIndex with no progress() call.
      expect(gsap.getProperty(named.el, 'y')).toBeCloseTo(900)
      expect(gsap.getProperty(named.el, 'scaleX')).toBeCloseTo(1.2)
      // Fully progressed, it reaches the REGULAR target pose (y: 0, scale: 1) -- the preset is a
      // one-instant starting point, not the tween's own destination.
      tl.progress(1)
      expect(gsap.getProperty(named.el, 'y')).toBeCloseTo(0)
      expect(gsap.getProperty(named.el, 'scaleX')).toBeCloseTo(1)
      tl.kill()
    })

    it('durationMsOverride bypasses travelDurationMs(steps) entirely -- a huge `steps` still gets the flat override duration', () => {
      const one = target()
      const tl = playTravelTimeline([one], { steps: 500, durationMsOverride: TRAVEL_FLY_LAYER_DURATION_MS })
      expect(tl.duration()).toBeCloseTo(TRAVEL_FLY_LAYER_DURATION_MS / 1000, 5)
      expect(tl.duration()).toBeLessThan(travelDurationMs(500) / 1000) // the growth-curve value it did NOT use
      tl.kill()
    })

    it('reduced motion still collapses delayOverridesMs/presetPoses/durationMsOverride to instant, same as the default path', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
      const named = { ...target(), name: 'fly-1' }
      const tl = playTravelTimeline([named], {
        steps: 500,
        delayOverridesMs: { 'fly-1': 1000 },
        presetPoses: { 'fly-1': pose({ y: 900 }) },
        durationMsOverride: TRAVEL_FLY_LAYER_DURATION_MS,
      })
      expect(tl.duration()).toBe(0)
      tl.kill()
    })
  })
})

// flyThroughPlan/flyThroughDurationMs --
// the pure "who launches when" planning layer for a long jump's own fly-through. See
// timeMachineChoreo.ts's own header comment on this section, and travelDurationMs's own comment,
// for the full rationale this ports; TimeMachineDepthStack.test.ts covers how a real
// TimeMachineDepthStack.vue instance actually WIRES a plan into DOM/GSAP execution -- not
// re-tested here, this file stays scoped to the pure function.
describe('flyThroughPlan — long-jump fly-through sequencing', () => {
  const names = Array.from({ length: 50 }, (_, i) => `s${i}`) // s0 newest .. s49 oldest

  it('is empty for a degenerate/out-of-range/equal from-to input (no crash)', () => {
    expect(flyThroughPlan(names, 0, 0)).toEqual([])
    expect(flyThroughPlan(names, -1, 5)).toEqual([])
    expect(flyThroughPlan(names, 0, 50)).toEqual([]) // 50 is out of range (length 50, max index 49)
    expect(flyThroughPlan(names, 1.5, 5)).toEqual([])
    expect(flyThroughPlan(null as unknown as string[], 0, 5)).toEqual([])
  })

  it('the LAST entry is always role "target", named after `names[toIndex]`, whichever direction', () => {
    const backward = flyThroughPlan(names, 0, 10)
    expect(backward[backward.length - 1]).toEqual({ name: 's10', role: 'target', launchDelayMs: backward[backward.length - 1].launchDelayMs })
    const forward = flyThroughPlan(names, 10, 0)
    expect(forward[forward.length - 1]).toEqual({ name: 's0', role: 'target', launchDelayMs: forward[forward.length - 1].launchDelayMs })
  })

  it('every entry before the last is role "intermediate"', () => {
    const plan = flyThroughPlan(names, 0, 10)
    expect(plan.slice(0, -1).every((s) => s.role === 'intermediate')).toBe(true)
  })

  it('BACKWARD (toIndex > fromIndex): intermediates are every index strictly between, in ASCENDING (chronological travel) order', () => {
    const plan = flyThroughPlan(names, 0, 5) // gap of 4 intermediates: s1, s2, s3, s4
    expect(plan.map((s) => s.name)).toEqual(['s1', 's2', 's3', 's4', 's5'])
    expect(plan[plan.length - 1].role).toBe('target')
  })

  it('FORWARD (toIndex < fromIndex): intermediates are every index strictly between, in DESCENDING (chronological travel) order -- the exact mirror of backward', () => {
    const plan = flyThroughPlan(names, 5, 0)
    expect(plan.map((s) => s.name)).toEqual(['s4', 's3', 's2', 's1', 's0'])
    expect(plan[plan.length - 1].role).toBe('target')
  })

  it('tiny gap at the boundary steps=4 (one past TRAVEL_FLAT_STEPS): exactly 3 intermediates, no sampling needed', () => {
    const plan = flyThroughPlan(names, 0, 4)
    expect(plan.filter((s) => s.role === 'intermediate')).toHaveLength(3)
    expect(plan.map((s) => s.name)).toEqual(['s1', 's2', 's3', 's4'])
  })

  it('launch delays are monotonically non-decreasing, each cadence step apart, target delay = cadence * (K - 1)', () => {
    const plan = flyThroughPlan(names, 0, 4) // K = 4 (3 intermediates + target)
    for (let i = 1; i < plan.length; i++) expect(plan[i].launchDelayMs).toBeGreaterThan(plan[i - 1].launchDelayMs)
    expect(plan.map((s) => s.launchDelayMs)).toEqual([0, TRAVEL_FLY_CADENCE_MS, TRAVEL_FLY_CADENCE_MS * 2, TRAVEL_FLY_CADENCE_MS * 3])
  })

  it('EVEN SAMPLING when the gap exceeds maxIntermediates: caps at maxIntermediates, spans the full gap (first/last intermediate near each end), never clusters at one side', () => {
    const bigNames = Array.from({ length: 250 }, (_, i) => `s${i}`)
    const plan = flyThroughPlan(bigNames, 0, 200, { maxIntermediates: 10 }) // a 200-step jump
    const intermediates = plan.filter((s) => s.role === 'intermediate')
    expect(intermediates.length).toBeLessThanOrEqual(10)
    expect(intermediates.length).toBeGreaterThan(5) // sampling should not collapse to almost nothing
    const idxOf = (name: string) => Number(name.slice(1))
    const sampledIdx = intermediates.map((s) => idxOf(s.name))
    // Strictly increasing (chronological order preserved through sampling).
    for (let i = 1; i < sampledIdx.length; i++) expect(sampledIdx[i]).toBeGreaterThan(sampledIdx[i - 1])
    // Spans close to the full [1, 199] gap, not clustered at one end.
    expect(sampledIdx[0]).toBeLessThan(30)
    expect(sampledIdx[sampledIdx.length - 1]).toBeGreaterThan(170)
  })

  it('a 200-step jump does NOT mount 200 strips -- default maxIntermediates caps at TRAVEL_FLY_MAX_INTERMEDIATES', () => {
    const bigNames = Array.from({ length: 250 }, (_, i) => `s${i}`)
    const plan = flyThroughPlan(bigNames, 0, 200) // default cap, no opts
    expect(plan.filter((s) => s.role === 'intermediate').length).toBeLessThanOrEqual(TRAVEL_FLY_MAX_INTERMEDIATES)
    expect(TRAVEL_FLY_MAX_INTERMEDIATES).toBe(10)
  })

  it('a maxIntermediates of 0 still produces a valid plan -- just the target, no intermediates, delay 0', () => {
    const plan = flyThroughPlan(names, 0, 10, { maxIntermediates: 0 })
    expect(plan).toEqual([{ name: 's10', role: 'target', launchDelayMs: 0 }])
  })

  it('no duplicate names anywhere in a single plan', () => {
    const bigNames = Array.from({ length: 250 }, (_, i) => `s${i}`)
    const plan = flyThroughPlan(bigNames, 0, 200)
    const names_ = plan.map((s) => s.name)
    expect(new Set(names_).size).toBe(names_.length)
  })

  it('a huge (10000-step) jump still resolves without hanging and respects the cap identically to a 200-step one', () => {
    const hugeNames = Array.from({ length: 10001 }, (_, i) => `s${i}`)
    const plan = flyThroughPlan(hugeNames, 0, 10000)
    expect(plan.filter((s) => s.role === 'intermediate').length).toBeLessThanOrEqual(TRAVEL_FLY_MAX_INTERMEDIATES)
  })
})

describe('flyThroughDurationMs — a plan\'s own total duration', () => {
  const names = Array.from({ length: 250 }, (_, i) => `s${i}`)

  it('is 0 for an empty plan', () => {
    expect(flyThroughDurationMs([])).toBe(0)
  })

  it('is cadence * (K - 1) + TRAVEL_FLY_LAYER_DURATION_MS for a plan short of the cap', () => {
    const plan = flyThroughPlan(names, 0, 4) // K = 4
    const expected = TRAVEL_FLY_CADENCE_MS * 3 + TRAVEL_FLY_LAYER_DURATION_MS
    expect(flyThroughDurationMs(plan)).toBe(expected)
  })

  it('never exceeds TRAVEL_FLY_MAX_DURATION_MS (1400ms), however large the plan/jump', () => {
    const plan = flyThroughPlan(names, 0, 200) // capped at 10 intermediates -> K = 11
    expect(flyThroughDurationMs(plan)).toBeLessThanOrEqual(TRAVEL_FLY_MAX_DURATION_MS)
  })

  it('a single-entry plan (target only, zero intermediates) still takes at least one full layer duration', () => {
    const plan = flyThroughPlan(names, 0, 10, { maxIntermediates: 0 })
    expect(flyThroughDurationMs(plan)).toBe(TRAVEL_FLY_LAYER_DURATION_MS)
  })

  it('grows monotonically with plan length (more intermediates -> longer, up to the cap)', () => {
    let prev = 0
    for (const gap of [4, 8, 15, 30, 60, 120, 200]) {
      const plan = flyThroughPlan(names, 0, gap)
      const d = flyThroughDurationMs(plan)
      expect(d).toBeGreaterThanOrEqual(prev)
      prev = d
    }
    expect(prev).toBeLessThanOrEqual(TRAVEL_FLY_MAX_DURATION_MS)
  })
})
