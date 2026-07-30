import { describe, it, expect } from 'vitest'
import { fisheyeScale, computeFisheyeScales, buildVisibleStack, stepSelectedIndex, buildRailNodes } from './timeMachineMath'

describe('fisheyeScale', () => {
  it('光标正中时到达最大缩放', () => {
    expect(fisheyeScale(0)).toBeCloseTo(2.2, 5)
  })
  it('超出半径回到最小缩放', () => {
    expect(fisheyeScale(70)).toBe(1)
    expect(fisheyeScale(999)).toBe(1)
  })
  it('左右对称(只看距离绝对值)', () => {
    expect(fisheyeScale(-30)).toBeCloseTo(fisheyeScale(30), 10)
  })
  it('半径内单调递减', () => {
    const xs = [0, 10, 20, 30, 40, 50, 60, 69]
    const ys = xs.map((x) => fisheyeScale(x))
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThan(ys[i - 1])
  })
  it('两端斜率为 0(升余弦缓动,不出现折角)', () => {
    // 紧挨光标处相邻两点的差,应远小于中段同样间距的差
    const nearCenter = fisheyeScale(0) - fisheyeScale(2)
    const midway = fisheyeScale(34) - fisheyeScale(36)
    expect(nearCenter).toBeLessThan(midway)
  })
  it('非有限输入退回最小缩放', () => {
    expect(fisheyeScale(NaN)).toBe(1)
  })
  it('可覆盖参数', () => {
    expect(fisheyeScale(0, { maxScale: 3, minScale: 1.5 })).toBeCloseTo(3, 5)
    expect(fisheyeScale(10, { radius: 10 })).toBe(1)
  })
})

describe('computeFisheyeScales', () => {
  it('按每条刻度中心与光标的距离批量算', () => {
    const out = computeFisheyeScales([100, 140, 300], 100)
    expect(out).toHaveLength(3)
    expect(out[0]).toBeCloseTo(2.2, 5)
    expect(out[2]).toBe(1)
  })
  it('空输入返回空数组', () => {
    expect(computeFisheyeScales([], 0)).toEqual([])
  })
})

describe('buildVisibleStack', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  it('选中项是 front,后面的更老快照依次 behind', () => {
    const st = buildVisibleStack(items, 2, 5, 2)
    const behind = st.filter((e) => e.state !== 'past')
    expect(behind.map((e) => e.item)).toEqual(['c', 'd', 'e', 'f', 'g'])
    expect(behind[0]).toMatchObject({ state: 'front', depth: 0, index: 2 })
    expect(behind[4]).toMatchObject({ state: 'behind', depth: 4, index: 6 })
  })
  it('比选中更新的快照进入 past 态(朝观众飞走),最多 pastDepth 张', () => {
    const past = buildVisibleStack(items, 4, 5, 2).filter((e) => e.state === 'past')
    expect(past.map((e) => e.item)).toEqual(['d', 'c'])
    expect(past.map((e) => e.depth)).toEqual([1, 2])
  })
  it('选中最新一张时没有 past 卡', () => {
    expect(buildVisibleStack(items, 0, 5, 2).filter((e) => e.state === 'past')).toEqual([])
  })
  it('选中最老一张时 behind 只有它自己', () => {
    const st = buildVisibleStack(items, 7, 5, 2).filter((e) => e.state !== 'past')
    expect(st.map((e) => e.item)).toEqual(['h'])
  })
  it('索引越界被夹紧', () => {
    expect(buildVisibleStack(items, -3, 5, 2)[0]).toMatchObject({ index: 0, state: 'front' })
    expect(buildVisibleStack(items, 99, 5, 2)[0]).toMatchObject({ index: 7, state: 'front' })
  })
  it('空列表返回空', () => {
    expect(buildVisibleStack([], 0)).toEqual([])
  })
  it('每个 entry 的 index 是在原列表里的下标(供点选回填)', () => {
    const st = buildVisibleStack(items, 3, 3, 1)
    expect(st.map((e) => e.index).sort((a, b) => a - b)).toEqual([2, 3, 4, 5])
  })
})

describe('stepSelectedIndex', () => {
  it('两端夹紧', () => {
    expect(stepSelectedIndex(0, -1, 5)).toBe(0)
    expect(stepSelectedIndex(4, 1, 5)).toBe(4)
  })
  it('正常步进', () => {
    expect(stepSelectedIndex(2, 1, 5)).toBe(3)
    expect(stepSelectedIndex(2, -1, 5)).toBe(1)
  })
  it('空列表恒为 0', () => {
    expect(stepSelectedIndex(3, 1, 0)).toBe(0)
  })
})

describe('buildRailNodes', () => {
  const groups = [
    { dayKey: '2026-07-30', labelText: '今天', items: [{ flatIndex: 0 }, { flatIndex: 1 }] },
    { dayKey: '2026-07-29', labelText: '昨天', items: [{ flatIndex: 2 }] },
  ]
  it('每组前面插一个日期标题节点', () => {
    const nodes = buildRailNodes(groups)
    expect(nodes.filter((n) => n.type === 'day').map((n) => n.label)).toEqual(['今天', '昨天'])
  })
  it('每个快照一个主刻度,flatIndex 透传', () => {
    expect(buildRailNodes(groups).filter((n) => n.type === 'main').map((n) => n.flatIndex)).toEqual([0, 1, 2])
  })
  it('相邻两个主刻度之间插 2 个装饰子刻度,吸附到上面那个主刻度', () => {
    const nodes = buildRailNodes(groups)
    const subs = nodes.filter((n) => n.type === 'sub')
    expect(subs).toHaveLength(4) // 0-1 之间 2 个,1-2 之间 2 个
    expect(subs.slice(0, 2).every((n) => n.anchorIndex === 0)).toBe(true)
  })
  it('最后一个主刻度后面不再挂子刻度', () => {
    const nodes = buildRailNodes(groups)
    expect(nodes[nodes.length - 1].type).toBe('main')
  })
  it('key 全局唯一(v-for 不会撞 key)', () => {
    const keys = buildRailNodes(groups).map((n) => n.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('subPerGap 可配为 0', () => {
    expect(buildRailNodes(groups, 0).filter((n) => n.type === 'sub')).toEqual([])
  })
  it('空分组返回空', () => {
    expect(buildRailNodes([])).toEqual([])
  })
})
