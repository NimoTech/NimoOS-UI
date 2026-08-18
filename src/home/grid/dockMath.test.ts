import { describe, it, expect } from 'vitest'
import { magScale, dropTarget, dropTargetIn, type DockGeometry, type DockSlot, type DropDecision } from './dockMath'

describe('magScale', () => {
  it('peaks at distance 0 (1+0.55) and decays with distance', () => {
    expect(magScale(0)).toBeCloseTo(1.55, 3)
    expect(magScale(70)).toBeLessThan(magScale(0))
    expect(magScale(70)).toBeGreaterThan(1)
    expect(magScale(99999)).toBeCloseTo(1, 3)
  })
})

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
  it('inserts before the nearest slot when dropped to its left', () => {
    expect(dropTarget(180, 300, fav, more).beforeKey).toBe('photos')
  })
  it('appends when dropped to the right of the nearest slot', () => {
    expect(dropTarget(230, 300, fav, more).beforeKey).toBeNull()
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
  // Negative control. If this ever goes green the shift model has become a no-op
  // and the fixed-point assertions below would prove nothing.
  it('re-measuring the placeholder-shifted dock never settles', () => {
    const oscillating = SAMPLES.filter((x) => {
      const keys = simulateDrag(x, true, 'clamped').previews.map((d) => String(d.beforeKey))
      return new Set(keys).size > 1
    })
    expect(oscillating.length).toBeGreaterThan(0)
    // The three positions the review measured in Chromium, each alternating
    // between "insert before this icon" and "append".
    for (const [x, key] of [[610, 'm2'], [690, 'm3'], [780, 'm4']] as const) {
      expect(simulateDrag(x, true, 'clamped').previews.map((d) => d.beforeKey))
        .toEqual([key, null, key, null])
    }
  })

  // And re-measuring is not merely jittery: the drop resolves while the
  // placeholder is still in the DOM, so it lands on the opposite of the preview.
  it('re-measuring lets the drop disagree with the preview it just showed', () => {
    const disagreeing = SAMPLES.filter((x) => {
      const { previews, drop } = simulateDrag(x, true, 'clamped')
      return drop.beforeKey !== previews[previews.length - 1].beforeKey
    })
    expect(disagreeing.length).toBeGreaterThan(0)
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
