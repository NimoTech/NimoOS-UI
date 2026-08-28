// Task 1 (SP7-P6a Places): Overlap-aware greedy clustering for places map.
// Line-by-line copy of the Vue 2 panel src/utils/placesCluster.js, only adding TS types
// and generics — algorithm unchanged. Vue2 module has zero tests; this file's __tests__ are brand new.
// (Not listing specific line numbers: they drift with upstream changes, file paths don't.)
//
// Why "raising scale can find the split point" (T2 splitScaleFor depends on this invariant):
// Bubbles render at constant screen radius (independent of zoom), the condition for two bubbles to overlap on screen is
//   world distance × scale < (radiusA + radiusB) × factor
// So zooming in (larger scale) pulls bubbles apart, zooming out merges them; monotonic and binary-searchable.
//
// Seeding order is descending by count (busiest places anchor each cluster), ties broken by original array index ascending
// — this tie-break determines who is lead, and thus the synthesized id `cluster:${lead.id}`,
// which is part of the render key, **not casual code, cannot be changed to unstable sorting**.
//
// Cluster radius must be recalculated on each member absorption: count accumulation makes radiusFn(total) grow,
// so points too far in round one may be reachable in round two (test "cluster radius grows with absorption" pins this).

export interface ClusterItem {
  x: number
  y: number
  count: number
}

export interface Cluster<T extends ClusterItem> {
  x: number
  y: number
  count: number
  members: T[]
  lead: T
}

/**
 * @param items    projected points (viewBox units)
 * @param scale    current map zoom
 * @param radiusFn screen-space bubble radius for a given photo count
 * @param factor   overlap slack coefficient; 1 = merge when circles are tangent
 * @returns one item per cluster, in seeding order (largest first)
 */
export function clusterByOverlap<T extends ClusterItem>(
  items: T[],
  scale: number,
  radiusFn: (count: number) => number,
  factor = 1,
): Cluster<T>[] {
  if (!Array.isArray(items) || items.length === 0)
    return []

  const order = items.map((_, i) => i).sort((a, b) => {
    const d = (items[b].count || 0) - (items[a].count || 0)
    return d !== 0 ? d : a - b
  })

  const taken = Array.from({ length: items.length }, () => false)
  const clusters: Cluster<T>[] = []

  for (const i of order) {
    if (taken[i])
      continue
    const seed = items[i]
    taken[i] = true

    const members: T[] = [seed]
    const seedW = seed.count || 1
    let sx = seed.x * seedW
    let sy = seed.y * seedW
    let sw = seedW
    let total = seed.count || 0
    let cx = seed.x
    let cy = seed.y

    // Repeatedly full-scan until a round absorbs nobody — cluster radius grows as members (and total) accumulate.
    let absorbed = true
    while (absorbed) {
      absorbed = false
      const R = radiusFn(total)
      for (const j of order) {
        if (taken[j])
          continue
        const o = items[j]
        const dx = o.x - cx
        const dy = o.y - cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist * scale < (R + radiusFn(o.count || 0)) * factor) {
          taken[j] = true
          members.push(o)
          const w = o.count || 1
          sx += o.x * w
          sy += o.y * w
          sw += w
          total += o.count || 0
          cx = sx / sw
          cy = sy / sw
          absorbed = true
        }
      }
    }

    clusters.push({ x: cx, y: cy, count: total, members, lead: seed })
  }

  return clusters
}
