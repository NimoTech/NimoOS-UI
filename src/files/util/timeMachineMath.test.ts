import { describe, it, expect } from 'vitest'
import { fisheyeScale, computeFisheyeScales, buildVisibleStack, stepSelectedIndex, buildRailNodes } from './timeMachineMath'

describe('fisheyeScale', () => {
  it('cursor at center reaches max scale', () => {
    expect(fisheyeScale(0)).toBeCloseTo(2.2, 5)
  })
  it('beyond radius falls back to min scale', () => {
    expect(fisheyeScale(70)).toBe(1)
    expect(fisheyeScale(999)).toBe(1)
  })
  it('left-right symmetric (absolute distance only)', () => {
    expect(fisheyeScale(-30)).toBeCloseTo(fisheyeScale(30), 10)
  })
  it('monotonically decreasing within radius', () => {
    const xs = [0, 10, 20, 30, 40, 50, 60, 69]
    const ys = xs.map((x) => fisheyeScale(x))
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThan(ys[i - 1])
  })
  it('zero slope at ends (raised cosine easing, no corners)', () => {
    // The delta between two adjacent points right next to the cursor should be far smaller than the same-spacing delta midway out
    const nearCenter = fisheyeScale(0) - fisheyeScale(2)
    const midway = fisheyeScale(34) - fisheyeScale(36)
    expect(nearCenter).toBeLessThan(midway)
  })
  it('non-finite input falls back to min scale', () => {
    expect(fisheyeScale(NaN)).toBe(1)
  })
  it('parameters can be overridden', () => {
    expect(fisheyeScale(0, { maxScale: 3, minScale: 1.5 })).toBeCloseTo(3, 5)
    expect(fisheyeScale(10, { radius: 10 })).toBe(1)
  })
})

describe('computeFisheyeScales', () => {
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

describe('buildVisibleStack', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  it('selected item is front, older snapshots behind in order', () => {
    const st = buildVisibleStack(items, 2, 5, 2)
    const behind = st.filter((e) => e.state !== 'past')
    expect(behind.map((e) => e.item)).toEqual(['c', 'd', 'e', 'f', 'g'])
    expect(behind[0]).toMatchObject({ state: 'front', depth: 0, index: 2 })
    expect(behind[4]).toMatchObject({ state: 'behind', depth: 4, index: 6 })
  })
  it('newer snapshots than selected enter past state (fly toward viewer), max pastDepth cards', () => {
    const past = buildVisibleStack(items, 4, 5, 2).filter((e) => e.state === 'past')
    expect(past.map((e) => e.item)).toEqual(['d', 'c'])
    expect(past.map((e) => e.depth)).toEqual([1, 2])
  })
  it('no past cards when newest selected', () => {
    expect(buildVisibleStack(items, 0, 5, 2).filter((e) => e.state === 'past')).toEqual([])
  })
  it('only itself in behind when oldest selected', () => {
    const st = buildVisibleStack(items, 7, 5, 2).filter((e) => e.state !== 'past')
    expect(st.map((e) => e.item)).toEqual(['h'])
  })
  it('out-of-bounds index is clamped', () => {
    expect(buildVisibleStack(items, -3, 5, 2)[0]).toMatchObject({ index: 0, state: 'front' })
    expect(buildVisibleStack(items, 99, 5, 2)[0]).toMatchObject({ index: 7, state: 'front' })
  })
  it('empty list returns empty', () => {
    expect(buildVisibleStack([], 0)).toEqual([])
  })
  it('each entry index is original list subscript (for click callback)', () => {
    const st = buildVisibleStack(items, 3, 3, 1)
    expect(st.map((e) => e.index).sort((a, b) => a - b)).toEqual([2, 3, 4, 5])
  })
})

describe('stepSelectedIndex', () => {
  it('clamp at both ends', () => {
    expect(stepSelectedIndex(0, -1, 5)).toBe(0)
    expect(stepSelectedIndex(4, 1, 5)).toBe(4)
  })
  it('normal step', () => {
    expect(stepSelectedIndex(2, 1, 5)).toBe(3)
    expect(stepSelectedIndex(2, -1, 5)).toBe(1)
  })
  it('empty list always returns 0', () => {
    expect(stepSelectedIndex(3, 1, 0)).toBe(0)
  })
})

describe('buildRailNodes', () => {
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
    expect(subs).toHaveLength(4) // 2 between 0-1, 2 between 1-2
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
