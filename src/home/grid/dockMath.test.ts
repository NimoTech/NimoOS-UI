import { describe, it, expect } from 'vitest'
import { dropTarget, dropTargetIn, slotShifts, type DockGeometry, type DockSlot, type DropDecision } from './dockMath'

// The dock's fisheye magnification, switched off at the owner's request and kept
// rather than deleted so it can be restored. Its only caller was HomeDock's
// pointermove handler, which is commented out alongside it.
// import { magScale } from './dockMath'
// describe('magScale', () => {
//   it('peaks at distance 0 (1+0.55) and decays with distance', () => {
//     expect(magScale(0)).toBeCloseTo(1.55, 3)
//     expect(magScale(70)).toBeLessThan(magScale(0))
//     expect(magScale(70)).toBeGreaterThan(1)
//     expect(magScale(99999)).toBeCloseTo(1, 3)
//   })
// })

// Slots are (key, midX) pairs read from the DOM by HomeDock. Extracted here
// because jsdom reports every getBoundingClientRect as 0, so a component test
// cannot say anything about where a drop lands.
describe('dropTarget', () => {
  const fav = [{ key: 'files', midX: 100 }, { key: 'photos', midX: 200 }]
  const more = [{ key: 'settings', midX: 400 }, { key: 'kvm', midX: 500 }]

  it('picks the favourites zone left of the separator and more to its right', () => {
    expect(dropTarget(120, 300, fav, more).toZone).toBe('fav')
    expect(dropTarget(420, 300, fav, more).toZone).toBe('more')
  })
  it('inserts before the first slot the pointer has not passed', () => {
    expect(dropTarget(180, 300, fav, more).beforeKey).toBe('photos')
  })
  it('appends when dropped past every slot in the zone', () => {
    expect(dropTarget(230, 300, fav, more).beforeKey).toBeNull()
  })

  // Three slots, because two cannot tell the bug from the fix: with two, "right of
  // the last icon" and "the end of the zone" are the same place. Standing right of
  // a MIDDLE icon must insert one place further along, not jump to the end and
  // collapse everything in between a slot leftwards.
  const three = [{ key: 'a', midX: 100 }, { key: 'b', midX: 200 }, { key: 'c', midX: 300 }]
  it('walks the insertion point one slot at a time across a zone', () => {
    expect(dropTarget(50, 900, three, more).beforeKey).toBe('a')   // before all of them
    expect(dropTarget(150, 900, three, more).beforeKey).toBe('b')  // right of a, left of b
    expect(dropTarget(250, 900, three, more).beforeKey).toBe('c')  // right of b, left of c
    expect(dropTarget(350, 900, three, more).beforeKey).toBeNull() // past c: the end
  })
  it('does not jump to the end merely because the pointer is right of the nearest slot', () => {
    // 210 is nearest to b (200) and to its right. The end of the zone is one slot
    // further than that, and picking it would drag every icon after b leftwards.
    expect(dropTarget(210, 900, three, more).beforeKey).toBe('c')
  })
  it('appends into an empty zone', () => {
    expect(dropTarget(120, 300, [], more)).toEqual({ toZone: 'fav', beforeKey: null })
  })
  // The separator is rendered only on desktop (v-if="!isMobile"), and the
  // pre-existing behaviour without one is to target the more zone.
  it('targets the more zone when there is no separator', () => {
    expect(dropTarget(10, null, fav, more).toZone).toBe('more')
  })
})

// ── The insertion placeholder must not feed back into the geometry it measures ──
//
// Real numbers, measured in Chromium against the shipped dock CSS: --app-size
// 64px, five icons in the "more" zone, pitch 83.2px, slot midpoints
// 479 / 562 / 646 / 729 / 812.
const PITCH = 83.2
const BASE: DockGeometry = {
  sepMidX: 430,
  favSlots: [],
  moreSlots: [479, 562, 646, 729, 812].map((midX, i) => ({ key: 'm' + i, midX })),
}
const SAMPLES = [440, 470, 500, 530, 560, 590, 610, 640, 670, 690, 720, 750, 780, 810, 840]

/**
 * Models what showing the placeholder does to the numbers a live measurement
 * would read back.
 *
 * `clamped` reproduces the sequences measured in Chromium (x=610 alternating
 * m2 / append, x=690 m3 / append, x=780 m4 / append): the dock is already at its
 * width cap, so the placeholder cannot widen it and simply pushes every slot from
 * the insertion point onwards right by a full pitch.
 *
 * `recentred` is the same event on a dock still free to grow: it widens by one
 * pitch, and because `.dock` is `left: 50%` + `translateX(-50%)` the extra width
 * is split, so slots before the insertion point move left by half a pitch and the
 * rest move right by half.
 */
function withPlaceholder(geom: DockGeometry, d: DropDecision, mode: 'clamped' | 'recentred'): DockGeometry {
  const [beforeDx, afterDx] = mode === 'clamped' ? [0, PITCH] : [-PITCH / 2, PITCH / 2]
  const zone = d.toZone === 'fav' ? geom.favSlots : geom.moreSlots
  const at = d.beforeKey == null ? zone.length : zone.findIndex((s) => s.key === d.beforeKey)
  const around = (slots: DockSlot[]) => slots.map((s, i) => ({ ...s, midX: s.midX + (i < at ? beforeDx : afterDx) }))
  const all = (slots: DockSlot[], dx: number) => slots.map((s) => ({ ...s, midX: s.midX + dx }))
  // 'fav' precedes the separator, which precedes 'more', so an insertion in one
  // zone is wholly after or wholly before everything in the other.
  const favSlots = d.toZone === 'fav' ? around(geom.favSlots) : all(geom.favSlots, beforeDx)
  const moreSlots = d.toZone === 'more' ? around(geom.moreSlots) : all(geom.moreSlots, afterDx)
  const sepDx = d.toZone === 'more' ? beforeDx : afterDx
  return { sepMidX: geom.sepMidX == null ? null : geom.sepMidX + sepDx, favSlots, moreSlots }
}

/**
 * One drag held still at `clientX`, ticked several times.
 *
 * `remeasure: true` is the shipped-before-this-fix wiring — every pointermove and
 * the drop itself re-read the DOM the previous tick produced. `false` is the fix:
 * one snapshot, taken before any placeholder existed, feeds every decision.
 */
function simulateDrag(clientX: number, remeasure: boolean, mode: 'clamped' | 'recentred', ticks = 4) {
  const snapshot = BASE
  let live = BASE
  const previews: DropDecision[] = []
  for (let i = 0; i < ticks; i++) {
    const preview = dropTargetIn(clientX, remeasure ? live : snapshot)
    previews.push(preview)
    live = withPlaceholder(BASE, preview, mode) // the DOM this preview produces
  }
  // pointerup: the placeholder from the last preview is still in the DOM.
  const drop = dropTargetIn(clientX, remeasure ? live : snapshot)
  return { previews, drop }
}

describe('dropTargetIn (placeholder feedback)', () => {
  // These two tests used to be negative controls asserting that re-measuring
  // NEVER settles — 12 of 38 sampled positions alternated between "insert before
  // this icon" and "append", and the three sequences measured in Chromium were
  // pinned literally ([610, m2], [690, m3], [780, m4], each flipping every tick).
  //
  // Fixing dropTarget turned them green, which is worth recording rather than
  // deleting: that oscillation was a symptom of the nearest-slot rule, not of
  // re-measuring as such. Under "insert before the first slot the pointer has not
  // passed" the decision is a fixed point of the shift it causes — the slots from
  // the insertion point onward move further away from the pointer and the ones
  // before it do not move past it, so no shift can change which gap the pointer
  // is in. The old rule had no such guarantee, because moving a slot could make a
  // different slot the nearest one.
  //
  // The snapshot stays regardless, and the tests below still pin it. A transform
  // is included in getBoundingClientRect, so a live measurement mid-drag reads the
  // reflow's own displacement; being one bug away from a feedback loop is not a
  // reason to stand in it.
  it('no longer diverges even when every tick re-reads the shifted dock', () => {
    for (const mode of ['clamped', 'recentred'] as const) {
      for (const x of SAMPLES) {
        const { previews, drop } = simulateDrag(x, true, mode)
        const first = previews[0]
        for (const p of previews) expect(p, `preview flickered at x=${x} (${mode})`).toEqual(first)
        expect(drop, `drop disagreed with the preview at x=${x} (${mode})`).toEqual(first)
      }
    }
  })

  // The shift model is not a no-op — the guard the old negative control gave us.
  // If this goes red the simulation has stopped moving anything and neither this
  // test nor the snapshot ones below prove a thing.
  it('still models a dock whose slots really move', () => {
    const moved = SAMPLES.filter((x) => {
      const d = dropTargetIn(x, BASE)
      const shifted = withPlaceholder(BASE, d, 'clamped')
      return shifted.moreSlots.some((s, i) => s.midX !== BASE.moreSlots[i].midX)
    })
    expect(moved.length).toBeGreaterThan(0)
  })

  // The property that matters: a decision taken from the snapshot is a fixed
  // point of the shift its own placeholder causes. Holding the pointer still
  // cannot change it, and the drop cannot contradict it.
  for (const mode of ['clamped', 'recentred'] as const) {
    it(`a snapshot-driven decision is stable and matches the drop (${mode} dock)`, () => {
      for (const x of SAMPLES) {
        const { previews, drop } = simulateDrag(x, false, mode)
        const first = previews[0]
        for (const p of previews) expect(p, `preview flickered at x=${x}`).toEqual(first)
        expect(drop, `drop disagreed with the preview at x=${x}`).toEqual(first)
      }
    })
  }

  it('reads the same numbers dropTarget would from the same geometry', () => {
    expect(dropTargetIn(610, BASE)).toEqual(dropTarget(610, BASE.sepMidX, BASE.favSlots, BASE.moreSlots))
  })
})

// Each zone has keys.length + 1 slots while a drag is live: the dragged icon's own
// slot in the zone it came from, or an appended spare in the other zone. Moving the
// hole from holeIndex to insertAt is what opens a gap under the pointer.
describe('slotShifts', () => {
  const keys = ['a', 'b', 'c', 'd']
  const shifts = (hole: number, at: number | null) =>
    slotShifts(keys, hole, at).map((s) => s.slots)

  it('shifts nothing when the hole is already at the insertion point', () => {
    expect(shifts(2, 2)).toEqual([0, 0, 0, 0])
  })

  it('shifts nothing when the pointer is in the other zone', () => {
    expect(shifts(0, null)).toEqual([0, 0, 0, 0])
  })

  // Hole at the front, inserting further back: the icons in between close up
  // leftwards behind the pointer.
  it('pulls icons back when the hole moves forward', () => {
    expect(shifts(0, 3)).toEqual([-1, -1, -1, 0])
  })

  // Hole at the end (an appended spare), inserting near the front: everything from
  // the insertion point onward slides forward into the spare.
  it('pushes icons forward when the hole moves back', () => {
    expect(shifts(4, 1)).toEqual([0, 1, 1, 1])
  })

  it('handles the two ends as ordinary insertion points', () => {
    expect(shifts(4, 0)).toEqual([1, 1, 1, 1])
    expect(shifts(0, 4)).toEqual([-1, -1, -1, -1])
  })

  it('never reports a shift outside -1..1', () => {
    for (let hole = 0; hole <= keys.length; hole++) {
      for (let at = 0; at <= keys.length; at++) {
        for (const s of shifts(hole, at)) expect(Math.abs(s)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('keeps every key, in order', () => {
    expect(slotShifts(keys, 1, 3).map((s) => s.key)).toEqual(keys)
  })

  it('returns nothing for an empty zone', () => {
    expect(slotShifts([], 0, 0)).toEqual([])
  })
})
