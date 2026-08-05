### Task 1: `placesCluster.ts` —— 重叠感知贪心聚类(照搬 + 全套新建单测)

**Files:**
- Create: `src/photos/util/placesCluster.ts`
- Create: `src/photos/util/__tests__/placesCluster.test.ts`
- Read-only 参考: `/home/nimo/NimoTech/NimoOS-UI/src/utils/placesCluster.js`(整个文件,101 行)

**Interfaces:**
- Produces:
  ```ts
  export interface ClusterItem { x: number, y: number, count: number }
  export interface Cluster<T extends ClusterItem> {
    x: number       // 按 count 加权的质心 x
    y: number       // 按 count 加权的质心 y
    count: number   // 成员 count 之和
    members: T[]    // 成员原对象(含 seed,seed 恒为 members[0])
    lead: T         // 播种成员(count 最大者,同 count 取原数组靠前者)
  }
  export function clusterByOverlap<T extends ClusterItem>(
    items: T[], scale: number, radiusFn: (count: number) => number, factor?: number
  ): Cluster<T>[]
  ```
- Consumes: 无(本任务是依赖链最底层)

**背景(实现者必读,决定测试怎么写):** 气泡以**恒定屏幕半径**渲染(与缩放无关),所以两个气泡在屏幕上重叠的条件是 `世界距离 × scale < (半径A + 半径B) × factor`。因此**放大(scale 变大)会把气泡拉开、缩小会让它们合并** —— 这正是 T2 的 `splitScaleFor` 能靠「抬高 scale 求裂点」工作的前提。播种顺序是 count 降序(最热闹的地方锚定每个簇),同 count 时按原数组下标升序(**决定性,不能改**)。一个 seed 反复吸收邻居直到一整轮没吸到人为止 —— **必须每吸一个就重新算半径**,因为 count 累加会让簇半径变大(`radiusFn(total)`)。

- [ ] **Step 1: 写失败测试**

```ts
// src/photos/util/__tests__/placesCluster.test.ts
import { describe, expect, it } from 'vitest'
import { clusterByOverlap, type ClusterItem } from '../placesCluster'

/* 测试用半径函数:与 T2 的 tierRadius 同形(三档)但在此就地定义,
   保持本模块单测不依赖 T2(纯函数模块间不互相耦合)。 */
function r3(count: number): number {
  if (count >= 100) return 16
  if (count >= 40) return 11
  return 7
}
/* 恒定半径,便于手算门槛 */
const r10 = () => 10

interface P extends ClusterItem { id: string }
function p(id: string, x: number, y: number, count: number): P {
  return { id, x, y, count }
}

describe('clusterByOverlap', () => {
  it('空输入与非数组返回空数组', () => {
    expect(clusterByOverlap([], 1, r10)).toEqual([])
    // 防御性:上游 ?? [] 兜底失效时不应抛
    expect(clusterByOverlap(undefined as unknown as P[], 1, r10)).toEqual([])
  })

  it('单点自成一簇,质心即该点,lead 与 members[0] 都是它', () => {
    const a = p('a', 100, 200, 5)
    const out = clusterByOverlap([a], 1, r10)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ x: 100, y: 200, count: 5 })
    expect(out[0].members).toEqual([a])
    expect(out[0].lead).toBe(a)
  })

  it('距离 >= 半径和时不合并', () => {
    // r10 恒 10,门槛 = (10+10)*1 = 20;scale=1 时世界距离 25 > 20
    const out = clusterByOverlap([p('a', 0, 0, 10), p('b', 25, 0, 10)], 1, r10)
    expect(out).toHaveLength(2)
  })

  it('距离 < 半径和时合并,质心按 count 加权', () => {
    // 距离 10 < 20 → 合并。count 30 与 10 → 质心 x = (0*30 + 20*10)/40 = 5
    const out = clusterByOverlap([p('a', 0, 0, 30), p('b', 10, 0, 10)], 1, r10)
    expect(out).toHaveLength(1)
    expect(out[0].count).toBe(40)
    expect(out[0].x).toBeCloseTo(2.5, 6)
    expect(out[0].y).toBeCloseTo(0, 6)
  })

  it('放大到足够 scale 后同一对点分开(这是 splitScaleFor 的前提)', () => {
    const pts = [p('a', 0, 0, 10), p('b', 10, 0, 10)]
    expect(clusterByOverlap(pts, 1, r10)).toHaveLength(1)
    // scale=3 → 10*3=30 > 20 → 分开
    expect(clusterByOverlap(pts, 3, r10)).toHaveLength(2)
  })

  it('按 count 降序播种:最大者是 lead', () => {
    const small = p('small', 0, 0, 5)
    const big = p('big', 8, 0, 500)
    const out = clusterByOverlap([small, big], 1, r10)
    expect(out).toHaveLength(1)
    expect(out[0].lead).toBe(big)
    expect(out[0].members[0]).toBe(big)
  })

  it('同 count 时按原数组下标升序播种(决定性)', () => {
    const first = p('first', 0, 0, 10)
    const second = p('second', 8, 0, 10)
    expect(clusterByOverlap([first, second], 1, r10)[0].lead).toBe(first)
    expect(clusterByOverlap([second, first], 1, r10)[0].lead).toBe(second)
  })

  it('簇半径随吸收增长,能拉进第一轮门槛外的点(吸收后必须重算半径)', () => {
    // r3 三档:seed count=39 → 半径 7;吸收一个 count=1 的邻居后 total=40 → 半径 11。
    // c 距质心约 17.x:对半径 7 的簇够不着((7+7)=14),对半径 11 的簇够得着((11+7)=18)。
    const a = p('a', 0, 0, 39)
    const b = p('b', 13, 0, 1)
    const c = p('c', 17.5, 0, 1)
    const out = clusterByOverlap([a, b, c], 1, r3)
    expect(out).toHaveLength(1)
    expect(out[0].members.map(m => m.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('factor 放大门槛:同一组点在 factor=2 下合并、factor=1 下不合并', () => {
    const pts = [p('a', 0, 0, 10), p('b', 25, 0, 10)]
    expect(clusterByOverlap(pts, 1, r10, 1)).toHaveLength(2)
    expect(clusterByOverlap(pts, 1, r10, 2)).toHaveLength(1)
  })

  it('count 缺失/为 0 时按权重 1 参与质心、按 0 参与总计', () => {
    const out = clusterByOverlap([p('a', 0, 0, 0), p('b', 10, 0, 0)], 1, r10)
    expect(out).toHaveLength(1)
    expect(out[0].count).toBe(0)
    // 两点权重都回落成 1 → 质心是几何中点
    expect(out[0].x).toBeCloseTo(5, 6)
  })

  it('每个点恰好归属一个簇(不重复、不遗漏)', () => {
    const pts = [
      p('a', 0, 0, 100), p('b', 5, 0, 90), p('c', 300, 300, 50),
      p('d', 305, 300, 10), p('e', 900, 100, 1),
    ]
    const out = clusterByOverlap(pts, 1, r3)
    const ids = out.flatMap(c => c.members.map(m => m.id)).sort()
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('不改动输入对象(members 里是原对象引用,但字段未被写过)', () => {
    const a = p('a', 0, 0, 10)
    const snapshot = { ...a }
    clusterByOverlap([a, p('b', 8, 0, 10)], 1, r10)
    expect(a).toEqual(snapshot)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI && pnpm exec vitest run src/photos/util/__tests__/placesCluster.test.ts`
Expected: FAIL —— `Failed to resolve import "../placesCluster"`

- [ ] **Step 3: 实现(逐行照搬 Vue2,只加 TS 类型)**

```ts
// src/photos/util/placesCluster.ts
// Task 1 (SP7-P6a 地点): 地点地图的重叠感知贪心聚类。
// 逐行照搬 Vue2 NimoOS-UI src/utils/placesCluster.js(整文件 101 行),只加 TS 类型
// 与泛型 —— 算法一个字不改。Vue2 侧该模块零测试,本文件的 __tests__ 是全新建。
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
```

- [ ] **Step 4: 跑测试确认通过 + 删码验证**

Run: `pnpm exec vitest run src/photos/util/__tests__/placesCluster.test.ts`
Expected: PASS(13 例)

**逐个删码验证(必做,一次只删一处、验完还原):**
1. 把 `order` 的 sort 回调改成 `() => 0` → 「按 count 降序播种」与「同 count 下标升序」两条必须红。
2. 把 `while (absorbed)` 循环体改成只跑一轮(`absorbed` 末尾强制 `false`)→ 「簇半径随吸收增长」必须红。
3. 把 `const R = radiusFn(total)` 提到 `while` 外面 → 同上那条必须红(这一条与第 2 条测的是同一不变量的两个不同破坏方式,都要能红)。
4. 把加权质心 `sx += o.x * w` 的 `* w` 删掉 → 「质心按 count 加权」必须红。
5. 把 `factor` 默认值改成 2 → 「距离 >= 半径和时不合并」必须红。

- [ ] **Step 5: Commit**

```bash
cd /home/nimo/NimoTech/.sp7/NimoOS-New-UI
git add src/photos/util/placesCluster.ts src/photos/util/__tests__/placesCluster.test.ts
git commit -m "feat(photos): P6a-T1 地点地图重叠聚类纯函数照搬 + 全套单测(Vue2 侧零测试)"
```

---

