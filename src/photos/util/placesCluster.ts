// Task 1 (SP7-P6a 地点): 地点地图的重叠感知贪心聚类。
// 逐行照搬 Vue2 NimoOS-UI src/utils/placesCluster.js,只加 TS 类型
// 与泛型 —— 算法一个字不改。Vue2 侧该模块零测试,本文件的 __tests__ 是全新建。
// (不写具体行数:行数会随上游变动再次失准,文件路径不会。)
//
// 为什么「抬高 scale 就能求裂点」(T2 splitScaleFor 依赖这条不变量):
// 气泡以恒定屏幕半径渲染(与缩放无关),两气泡在屏幕上重叠的条件是
//   世界距离 × scale < (半径A + 半径B) × factor
// 所以放大(scale 变大)会把气泡拉开、缩小会让它们合并,单调可二分。
//
// 播种顺序是 count 降序(最热闹的地方锚定每个簇),同 count 时按原数组下标升序
// —— 这个 tie-break 决定 lead 是谁、进而决定合成 id `cluster:${lead.id}`,
// 是渲染 key 的一部分,**不是随手写的,不能改成不稳定排序**。
//
// 每吸收一个成员就要重算簇半径:count 累加会让 radiusFn(total) 变大,
// 于是第一轮够不着的点在第二轮可能够得着(测试「簇半径随吸收增长」钉住了这条)。

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
 * @param items    已投影的点(viewBox 单位)
 * @param scale    当前地图缩放
 * @param radiusFn 给定照片数对应的屏幕空间气泡半径
 * @param factor   重叠松弛系数;1 = 圆刚好相切时才合并
 * @returns 每簇一项,按播种顺序(最大在前)
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

    // 反复整轮重扫直到一轮没吸到人 —— 簇半径随成员(与 total)累加而增长。
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
