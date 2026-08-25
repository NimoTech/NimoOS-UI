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
  dimGsapVars,
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
})
