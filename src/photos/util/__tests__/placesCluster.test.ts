import { describe, expect, it } from 'vitest'
import { clusterByOverlap, type ClusterItem } from '../placesCluster'

/* Test radius function: same shape as T2's tierRadius (three tiers) but defined locally
   here, so this module's unit tests don't depend on T2 (pure-function modules stay
   decoupled from each other). */
function r3(count: number): number {
  if (count >= 100) return 16
  if (count >= 40) return 11
  return 7
}
/* Constant radius, to make the threshold easy to compute by hand */
const r10 = () => 10

interface P extends ClusterItem { id: string }
function p(id: string, x: number, y: number, count: number): P {
  return { id, x, y, count }
}

describe('clusterByOverlap', () => {
  it('empty input and a non-array both return an empty array', () => {
    expect(clusterByOverlap([], 1, r10)).toEqual([])
    // Defensive: should not throw if the upstream ?? [] fallback ever fails
    expect(clusterByOverlap(undefined as unknown as P[], 1, r10)).toEqual([])
  })

  it('a single point forms its own cluster; the centroid is that point, and lead and members[0] are both it', () => {
    const a = p('a', 100, 200, 5)
    const out = clusterByOverlap([a], 1, r10)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ x: 100, y: 200, count: 5 })
    expect(out[0].members).toEqual([a])
    expect(out[0].lead).toBe(a)
  })

  it('does not merge when distance >= sum of radii', () => {
    // r10 is always 10, so threshold = (10+10)*1 = 20; at scale=1 the world distance 25 > 20
    const out = clusterByOverlap([p('a', 0, 0, 10), p('b', 25, 0, 10)], 1, r10)
    expect(out).toHaveLength(2)
  })

  it('merges when distance < sum of radii, centroid weighted by count', () => {
    // distance 10 < 20 -> merges. count 30 and 10 -> centroid x = (0*30 + 20*10)/40 = 5
    const out = clusterByOverlap([p('a', 0, 0, 30), p('b', 10, 0, 10)], 1, r10)
    expect(out).toHaveLength(1)
    expect(out[0].count).toBe(40)
    expect(out[0].x).toBeCloseTo(2.5, 6)
    expect(out[0].y).toBeCloseTo(0, 6)
  })

  it('the same pair of points splits apart once scale is large enough (the premise splitScaleFor relies on)', () => {
    const pts = [p('a', 0, 0, 10), p('b', 10, 0, 10)]
    expect(clusterByOverlap(pts, 1, r10)).toHaveLength(1)
    // scale=3 -> 10*3=30 > 20 -> splits apart
    expect(clusterByOverlap(pts, 3, r10)).toHaveLength(2)
  })

  it('seeds in descending count order: the largest is the lead', () => {
    const small = p('small', 0, 0, 5)
    const big = p('big', 8, 0, 500)
    const out = clusterByOverlap([small, big], 1, r10)
    expect(out).toHaveLength(1)
    expect(out[0].lead).toBe(big)
    expect(out[0].members[0]).toBe(big)
  })

  it('with equal count, seeds in ascending original-array-index order (deterministic)', () => {
    const first = p('first', 0, 0, 10)
    const second = p('second', 8, 0, 10)
    expect(clusterByOverlap([first, second], 1, r10)[0].lead).toBe(first)
    expect(clusterByOverlap([second, first], 1, r10)[0].lead).toBe(second)
  })

  it('with three mixed counts the tie-break actually takes effect: the two equal-count items go by ascending index, and the largest seeds', () => {
    // a is at index 0 but has the smallest count; b and c have equal, largest counts.
    // All three points are pairwise within the merge threshold (r10 is always 10 -> threshold
    // 20; spacing 8), so they end up in a single cluster.
    //   correct implementation (count descending + equal-count index ascending) -> order =
    //     [1, 2, 0] -> seed = b
    //   sort callback mutated to () => 0    -> order = [0, 1, 2] -> seed = a (mutant, wrong)
    //   tie-break flipped to b - a          -> order = [2, 1, 0] -> seed = c (mutant, wrong)
    const a = p('a', 0, 0, 5)
    const b = p('b', 8, 0, 10)
    const c = p('c', 16, 0, 10)
    const out = clusterByOverlap([a, b, c], 1, r10)
    expect(out).toHaveLength(1)
    expect(out[0].lead).toBe(b)
    expect(out[0].members[0]).toBe(b)
  })

  it('cluster radius grows as it absorbs neighbors, pulling in a point that was outside the first-round threshold (radius must be recomputed after absorbing)', () => {
    // r3 has three tiers: seed count=39 -> radius 7; after absorbing a neighbor with count=1,
    // total=40 -> radius 11.
    // c sits about 17.x from the centroid: out of reach for a radius-7 cluster ((7+7)=14), but
    // within reach for a radius-11 cluster ((11+7)=18).
    const a = p('a', 0, 0, 39)
    const b = p('b', 13, 0, 1)
    const c = p('c', 17.5, 0, 1)
    const out = clusterByOverlap([a, b, c], 1, r3)
    expect(out).toHaveLength(1)
    expect(out[0].members.map(m => m.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('factor scales up the threshold: the same set of points merges at factor=2 but not at factor=1', () => {
    const pts = [p('a', 0, 0, 10), p('b', 25, 0, 10)]
    expect(clusterByOverlap(pts, 1, r10, 1)).toHaveLength(2)
    expect(clusterByOverlap(pts, 1, r10, 2)).toHaveLength(1)
  })

  it('when count is 0, it contributes weight 1 to the centroid but 0 to the total', () => {
    const out = clusterByOverlap([p('a', 0, 0, 0), p('b', 10, 0, 0)], 1, r10)
    expect(out).toHaveLength(1)
    expect(out[0].count).toBe(0)
    // both points fall back to weight 1 -> the centroid is the geometric midpoint
    expect(out[0].x).toBeCloseTo(5, 6)
  })

  it('every point belongs to exactly one cluster (no duplicates, none missing)', () => {
    const pts = [
      p('a', 0, 0, 100), p('b', 5, 0, 90), p('c', 300, 300, 50),
      p('d', 305, 300, 10), p('e', 900, 100, 1),
    ]
    const out = clusterByOverlap(pts, 1, r3)
    const ids = out.flatMap(c => c.members.map(m => m.id)).sort()
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('does not mutate input objects (members holds references to the originals, but their fields are never written)', () => {
    const a = p('a', 0, 0, 10)
    const snapshot = { ...a }
    clusterByOverlap([a, p('b', 8, 0, 10)], 1, r10)
    expect(a).toEqual(snapshot)
  })
})
