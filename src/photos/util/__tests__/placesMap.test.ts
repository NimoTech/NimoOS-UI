// P6a-T2: 地点地图几何/过滤谓词/日期解析的测试。
// 高危用例节选照 brief 逐字落地(parsePlaceLast/filterPlaces/buildPins/
// splitScaleFor/declutterPins/regionLabelKey/toPlace 各描述块),其余 13 条
// 实现约束按常规 TDD 补齐(MAX_SCALE 字面量、parsePlaceLast 溢出回读、
// 单成员 Pin 不带 members/places 键)。
import { describe, expect, it } from 'vitest'
import { clusterByOverlap } from '../placesCluster'
import {
  MAX_SCALE, buildPins, declutterPins, extraFilterCount, filterPlaces,
  groupByRegion, parsePlaceLast, regionLabelKey, searchPlaces, splitScaleFor,
  tierRadius, toPlace, visitedDots, type Place, type Pin,
} from '../placesMap'
import { project } from '../worldMap'

function place(over: Partial<Place> = {}): Place {
  return {
    id: '1', key: 1, region: 'asia', country: 'China', city: 'Hangzhou',
    lon: 120.2, lat: 30.3, count: 10, recent: false,
    last: 'Mar 7, 2026', lastDate: new Date(2026, 2, 7),
    trips: 1, home: false, thumbs: [], coverAssetId: '', ...over,
  }
}

describe('MAX_SCALE', () => {
  it('照 Vue2 PhotosPlacesView.vue:11 定为 16', () => {
    expect(MAX_SCALE).toBe(16)
  })
})

describe('parsePlaceLast', () => {
  it('解析 Go "Jan 2, 2006" 布局(不走宿主 locale)', () => {
    const d = parsePlaceLast('Mar 7, 2026')!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2) // 0-based
    expect(d.getDate()).toBe(7)
  })
  it('单位数日与十二月都能解', () => {
    expect(parsePlaceLast('Jan 1, 2025')!.getMonth()).toBe(0)
    expect(parsePlaceLast('Dec 31, 2025')!.getMonth()).toBe(11)
  })
  it('空串 / 异常格式 / 未知月份 → null(不抛)', () => {
    expect(parsePlaceLast('')).toBeNull()
    expect(parsePlaceLast(null)).toBeNull()
    expect(parsePlaceLast(undefined)).toBeNull()
    expect(parsePlaceLast('2026-03-07')).toBeNull()
    expect(parsePlaceLast('Foo 7, 2026')).toBeNull()
  })
  it('溢出日期(Feb 31)回读校验失败 → null,不允许被 Date 自动进位成 3 月 3 日', () => {
    expect(parsePlaceLast('Feb 31, 2026')).toBeNull()
  })
})

describe('filterPlaces —— This year 不再写死年份(偏离登记 1)', () => {
  const now = new Date(2030, 5, 1) // 显式注入「现在」,不依赖系统时钟
  const base = { timeFilter: 'all' as const, customStart: '', customEnd: '', minCount: 0, regionFilter: null, recentOnly: false }

  it('year 分支按注入的当前年份判定,2030 年能筛到 2030 的地点', () => {
    const in2030 = place({ id: 'a', last: 'Feb 2, 2030', lastDate: parsePlaceLast('Feb 2, 2030') })
    const in2026 = place({ id: 'b', last: 'Mar 7, 2026', lastDate: parsePlaceLast('Mar 7, 2026') })
    const out = filterPlaces([in2030, in2026], { ...base, timeFilter: 'year' }, now)
    expect(out.map(p => p.id)).toEqual(['a'])
  })

  it('lastDate 为 null 的地点在 year 分支被排除,在 all 分支保留', () => {
    const broken = place({ id: 'x', last: '', lastDate: null })
    expect(filterPlaces([broken], { ...base, timeFilter: 'year' }, now)).toHaveLength(0)
    expect(filterPlaces([broken], base, now)).toHaveLength(1)
  })

  it('custom 区间按整日闭区间,customEnd 当天的地点不被排除', () => {
    const onEnd = place({ id: 'e', last: 'Mar 7, 2026', lastDate: parsePlaceLast('Mar 7, 2026') })
    const out = filterPlaces([onEnd], { ...base, timeFilter: 'custom', customStart: '2026-03-01', customEnd: '2026-03-07' }, now)
    expect(out.map(p => p.id)).toEqual(['e'])
  })

  it('custom 只有一头填了时整条时间过滤不生效(照 Vue2 :160)', () => {
    const p1 = place({ id: 'a', lastDate: parsePlaceLast('Mar 7, 2026') })
    expect(filterPlaces([p1], { ...base, timeFilter: 'custom', customStart: '2030-01-01', customEnd: '' }, now)).toHaveLength(1)
  })

  it('四种过滤叠加时按 Vue2 顺序全部生效', () => {
    const hit = place({ id: 'hit', region: 'asia', count: 50, recent: true })
    const missCount = place({ id: 'mc', region: 'asia', count: 5, recent: true })
    const missRegion = place({ id: 'mr', region: 'europe', count: 50, recent: true })
    const missRecent = place({ id: 'mrc', region: 'asia', count: 50, recent: false })
    const out = filterPlaces([hit, missCount, missRegion, missRecent],
      { ...base, minCount: 10, regionFilter: 'asia', recentOnly: true }, now)
    expect(out.map(p => p.id)).toEqual(['hit'])
  })
})

describe('buildPins', () => {
  it('scale >= MAX_SCALE 时每个城市自成一钉(绝不留裂不开的簇)', () => {
    // 两个坐标完全相同的城市:任何 scale 下 clusterByOverlap 都会合并
    const a = place({ id: 'a', lon: 120, lat: 30, count: 10 })
    const b = place({ id: 'b', lon: 120, lat: 30, count: 10 })
    expect(buildPins([a, b], 1, null).filter(p => p.cluster)).toHaveLength(1)
    const atMax = buildPins([a, b], MAX_SCALE, null)
    expect(atMax).toHaveLength(2)
    expect(atMax.every(p => !p.cluster)).toBe(true)
  })

  it('满缩放下共点的两钉被 declutter 推开(各自留一个可点位置)', () => {
    const a = place({ id: 'a', lon: 120, lat: 30 })
    const b = place({ id: 'b', lon: 120, lat: 30 })
    const [pa, pb] = buildPins([a, b], MAX_SCALE, null)
    expect(Math.hypot(pb.x - pa.x, pb.y - pa.y)).toBeGreaterThan(0)
  })

  it('hitR 不小于 9/scale(小钉也好点)', () => {
    const pins = buildPins([place({ count: 1 })], 8, null)
    expect(pins[0].hitR).toBeGreaterThanOrEqual(9 / 8)
  })

  it('active 用 String() 归一:数字 key 的地点被字符串 activeId 命中(铁律)', () => {
    const p1 = place({ id: '7', key: 7 })
    expect(buildPins([p1], MAX_SCALE, '7')[0].active).toBe(true)
  })
  it('active 对运行时类型违规(activeId 实际是 number)仍靠 String() 归一命中', () => {
    // Place.id 类型上恒为 string,brief 给的用例两侧本就都是字符串,删掉 String()
    // 归一并不会让它变红(删码验证 #4 的真实观察,已记入报告)。这条用非法穿透
    // TS 的运行时类型(activeId 传数字)真正钉住 String() 归一这行代码本身。
    const p1 = place({ id: '7', key: 7 })
    const runtimeNumericActiveId = 7 as unknown as string
    expect(buildPins([p1], MAX_SCALE, runtimeNumericActiveId)[0].active).toBe(true)
  })

  it('簇的 active 在任一成员命中时为真,id 为 cluster:<lead.id>', () => {
    const big = place({ id: 'big', lon: 120, lat: 30, count: 500 })
    const small = place({ id: 'small', lon: 120.05, lat: 30, count: 5 })
    const [pin] = buildPins([big, small], 1, 'small')
    expect(pin.cluster).toBe(true)
    expect(pin.id).toBe('cluster:big')
    expect(pin.active).toBe(true)
  })

  it('单成员图钉不带 members/places 键(不是显式 undefined)', () => {
    const p1 = place({ id: 'solo' })
    const [pin] = buildPins([p1], 1, null) as unknown as Array<Record<string, unknown>>
    expect(pin.cluster).toBe(false)
    expect('members' in pin).toBe(false)
    expect('places' in pin).toBe(false)
  })
})

describe('splitScaleFor', () => {
  it('成员少于 2 → MAX_SCALE', () => {
    expect(splitScaleFor([place()], 1)).toBe(MAX_SCALE)
    expect(splitScaleFor([], 1)).toBe(MAX_SCALE)
  })
  it('坐标完全相同(裂不开)→ MAX_SCALE', () => {
    const a = place({ id: 'a', lon: 120, lat: 30 })
    const b = place({ id: 'b', lon: 120, lat: 30 })
    expect(splitScaleFor([a, b], 1)).toBe(MAX_SCALE)
  })
  it('能裂开时返回值 > 当前 scale 且 <= MAX_SCALE,且在该 scale 下确实裂成 >= 2', () => {
    const a = place({ id: 'a', lon: 120, lat: 30, count: 10 })
    const b = place({ id: 'b', lon: 120.4, lat: 30, count: 10 })
    const s = splitScaleFor([a, b], 1)
    expect(s).toBeGreaterThan(1)
    expect(s).toBeLessThanOrEqual(MAX_SCALE)
    expect(buildPins([a, b], s, null).length).toBeGreaterThanOrEqual(2)
  })
  it('返回值确实是二分临界 hi 的 1.04 倍,不是裸 hi(钉住 `hi * 1.04`,删码验证 #7)', () => {
    // 上一条用例的断言(s 下 >=2 簇)不足以钉住 `hi * 1.04`——把它删成 `hi`,
    // 二分本身收敛到的 hi 满足不变量 clusters(hi) >= 2(二分循环只在验证
    // >=2 时才把 hi 收窄到 mid),所以哪怕删掉 *1.04,`s` 下仍 >= 2 簇,
    // 测试还是绿的(已实测确认,报告里记了这条真实观察)。
    // 直接断言 `s / 1.04` 下 < 2 簇也不成立:s / 1.04 就是 hi 本身(乘除
    // 互逆),而 clusters(hi) >= 2 恒成立,所以这条断言对着"正确实现"也会
    // 失败(已实测验证,不是我瞎猜)。
    // 真正能钉住这一行的办法:用同样受信的 clusterByOverlap + tierRadius
    // + project 在测试里独立复现同一个二分(不是导入 splitScaleFor 内部),
    // 求出 hi,再直接断言返回值等于 hi * 1.04 —— 数值相等,不依赖簇数量
    // 在浮点边界上的偶然翻转。
    const a = place({ id: 'a', lon: 120, lat: 30, count: 10 })
    const b = place({ id: 'b', lon: 120.4, lat: 30, count: 10 })
    const currentScale = 1
    const projected = [a, b].map(m => ({ ...m, ...project(m.lon, m.lat) }))
    let lo = currentScale
    let hi = MAX_SCALE
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2
      if (clusterByOverlap(projected, mid, tierRadius).length >= 2)
        hi = mid
      else
        lo = mid
    }
    const expected = Math.min(MAX_SCALE, hi * 1.04)
    const s = splitScaleFor([a, b], currentScale)
    expect(s).toBeCloseTo(expected, 9)
    // 且确实比裸 hi 大了实打实的 4%,不是巧合般接近
    expect(s).toBeGreaterThan(hi * 1.03)
  })
})

describe('declutterPins', () => {
  it('原地修改,共点两钉被推开到 >= minSep(黄金角方向,决定性)', () => {
    const pins = [
      { x: 100, y: 100 }, { x: 100, y: 100 },
    ] as unknown as Pin[]
    declutterPins(pins, 10)
    expect(Math.hypot(pins[1].x - pins[0].x, pins[1].y - pins[0].y)).toBeGreaterThanOrEqual(9.9)
  })
  it('少于 2 个钉时直接返回(不抛)', () => {
    const one = [{ x: 1, y: 1 }] as unknown as Pin[]
    expect(() => declutterPins(one, 10)).not.toThrow()
    expect(one[0]).toEqual({ x: 1, y: 1 })
  })
  it('两次调用同一输入结果一致(决定性,不含随机)', () => {
    const mk = () => ([{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }] as unknown as Pin[])
    const a = mk(); declutterPins(a, 8)
    const b = mk(); declutterPins(b, 8)
    expect(a).toEqual(b)
  })
})

describe('regionLabelKey(偏离登记 3)', () => {
  it('六个已知大洲各有键', () => {
    for (const id of ['asia', 'americas', 'europe', 'africa', 'oceania', 'antarctica'])
      expect(regionLabelKey(id)).toMatch(/^photosPlacesRegion/)
  })
  it('未知 id → null(调用方回落后端 label)', () => {
    expect(regionLabelKey('atlantis')).toBeNull()
    expect(regionLabelKey('')).toBeNull()
  })
})

describe('toPlace', () => {
  it('后端数字 key 归一成字符串 id,原 key 保留', () => {
    const p1 = toPlace({ key: 42, city: 'X', country: 'Y', region: 'asia', lon: 1, lat: 2, count: 3, last: 'Mar 7, 2026' })
    expect(p1.id).toBe('42')
    expect(p1.key).toBe(42)
    expect(p1.lastDate?.getFullYear()).toBe(2026)
  })
  it('null slice 与缺席字段被兜底(Go nil slice → null)', () => {
    const p1 = toPlace({ key: 1, thumbs: null, coverAssetId: undefined, recent: undefined })
    expect(p1.thumbs).toEqual([])
    expect(p1.coverAssetId).toBe('')
    expect(p1.recent).toBe(false)
  })
})

describe('visitedDots / groupByRegion / searchPlaces / tierRadius / extraFilterCount', () => {
  it('tierRadius 三档门槛', () => {
    expect(tierRadius(39)).toBe(7)
    expect(tierRadius(40)).toBe(11)
    expect(tierRadius(99)).toBe(11)
    expect(tierRadius(100)).toBe(16)
  })
  it('visitedDots 用 3.5 度方窗判定', () => {
    const near = place({ lon: 120, lat: 30 })
    const dots = visitedDots([near])
    expect(dots.some(d => d.visited)).toBe(true)
    expect(dots.filter(d => d.visited).every(d => Math.abs(d.lon - 120) < 3.5 && Math.abs(d.lat - 30) < 3.5)).toBe(true)
  })
  it('groupByRegion 每桶内按 count 降序', () => {
    const g = groupByRegion([place({ id: 'a', count: 5 }), place({ id: 'b', count: 50 })])
    expect(g.asia.map(p => p.id)).toEqual(['b', 'a'])
  })
  it('searchPlaces 空查询原样返回,命中 city 或 country,大小写不敏感', () => {
    const all = [place({ id: 'a', city: 'Hangzhou', country: 'China' }), place({ id: 'b', city: 'Paris', country: 'France' })]
    expect(searchPlaces(all, '   ')).toBe(all)
    expect(searchPlaces(all, 'HANG').map(p => p.id)).toEqual(['a'])
    expect(searchPlaces(all, 'france').map(p => p.id)).toEqual(['b'])
  })
  it('extraFilterCount 三项各计一分', () => {
    expect(extraFilterCount({ timeFilter: 'all', customStart: '', customEnd: '', minCount: 10, regionFilter: 'asia', recentOnly: true })).toBe(3)
    expect(extraFilterCount({ timeFilter: 'year', customStart: '', customEnd: '', minCount: 0, regionFilter: null, recentOnly: false })).toBe(0)
  })
})
