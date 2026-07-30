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

  it('三项混合 count 时 tie-break 真正生效:等 count 的两项按下标升序,最大者播种', () => {
    // a 在下标 0 但 count 最小;b、c 等 count 且都是最大。
    // 三点两两在合并门槛内(r10 恒 10 → 门槛 20;间距 8),最终并成一簇。
    //   正确实现(count 降序 + 同 count 下标升序)→ order = [1, 2, 0] → seed = b
    //   sort 回调被改成 () => 0            → order = [0, 1, 2] → seed = a(红)
    //   tie-break 写反成 b - a              → order = [2, 1, 0] → seed = c(红)
    const a = p('a', 0, 0, 5)
    const b = p('b', 8, 0, 10)
    const c = p('c', 16, 0, 10)
    const out = clusterByOverlap([a, b, c], 1, r10)
    expect(out).toHaveLength(1)
    expect(out[0].lead).toBe(b)
    expect(out[0].members[0]).toBe(b)
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

  it('count 为 0 时按权重 1 参与质心、按 0 参与总计', () => {
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
