### Task 2: `placesMap.ts` —— 图钉几何 / 过滤谓词 / 日期解析 + `worldMap` 补测

**Files:**
- Create: `src/photos/util/placesMap.ts`
- Create: `src/photos/util/__tests__/placesMap.test.ts`
- Modify: `src/photos/util/__tests__/worldMap.test.ts`(**只追加** describe 块,补 P5-T4 parked 的 viewBox 钳制边界测试)
- Read-only 参考: `PhotosPlacesView.vue:9-62`(MAX_SCALE / tierRadius / declutterPins)、`:152-186`(过滤)、`:187-195`(统计与搜索)、`:196-203`(分组)、`:228-278`(visitedDots / pins)、`:644-660`(splitScaleFor);`NimoOS-Photos/service/places.go:76`(Last 格式)、`places_types.go:5-19`(Place 契约)

**Interfaces:**
- Consumes: `clusterByOverlap`, `Cluster`, `ClusterItem`(T1);`project`, `WORLD_DOTS`, `type WorldDot`(既有 `util/worldMap.ts`)
- Produces:
  ```ts
  export const MAX_SCALE = 16

  export interface Place {
    id: string            // String(key) 归一后的 id(铁律:后端 key 是 int32)
    key: number | string  // 后端原值,回传接口时用
    region: string
    country: string
    city: string
    lon: number
    lat: number
    count: number
    recent: boolean
    last: string          // 后端 "Jan 2, 2006" 英文显示串
    lastDate: Date | null // parsePlaceLast(last) 的结果,过滤只看这个
    trips: number
    home: boolean
    thumbs: string[]
    coverAssetId: string
  }

  export interface RegionCount { id: string, label: string, count: number }
  export interface PlacesStats { cities: number, countries: number, photos: number }

  export type TimeFilterId = 'all' | 'year' | 'trip' | 'custom'
  export interface PlacesFilter {
    timeFilter: TimeFilterId
    customStart: string     // 'YYYY-MM-DD' 或 ''
    customEnd: string
    minCount: number
    regionFilter: string | null
    recentOnly: boolean
  }

  export interface Pin {
    id: string
    x: number
    y: number
    r: number
    hitR: number
    count: number
    city: string
    country: string
    thumbs: string[]
    coverAssetId: string
    recent: boolean
    cluster: boolean
    active: boolean
    members?: Place[]
    places?: number
  }

  export function toPlace(raw: unknown): Place
  export function parsePlaceLast(last: string | null | undefined): Date | null
  export function tierRadius(count: number): number
  export function declutterPins(pins: Pin[], minSep: number): void
  export function splitScaleFor(members: Place[], currentScale: number): number
  export function buildPins(places: Place[], scale: number, activeId: string | null): Pin[]
  export function visitedDots(places: Place[]): Array<WorldDot & { visited: boolean }>
  export function filterPlaces(places: Place[], f: PlacesFilter, now?: Date): Place[]
  export function searchPlaces(places: Place[], query: string): Place[]
  export function groupByRegion(places: Place[]): Record<string, Place[]>
  export function regionLabelKey(id: string): string | null
  export function countPhotos(places: Place[]): number
  export function countCountries(places: Place[]): number
  export function extraFilterCount(f: PlacesFilter): number
  ```

**关键实现约束(每条都有对应测试,不许含糊):**

1. **`MAX_SCALE = 16`** —— 照 Vue2 `:11`。注释照搬理由:「高到点一个簇能一层层裂开,直到同城市都能分开」。
2. **`tierRadius`** 三档 `>=100 → 16` / `>=40 → 11` / else `7`,照 Vue2 `:15-21`。**上方必须写一行注释**:这三个门槛(40/100)与图例的 `< 40`/`40–100`/`100+` 三个字面量(`PhotosPlacesView.vue:1032-1039`)耦合,改此处必须同步改图例(偏离登记 11-③)。
3. **`declutterPins`** 照 Vue2 `:28-62`:8 轮迭代、`Math.hypot`、`d < 1e-6` 时用 `j * 2.399963`(黄金角)派生稳定方向、每次推开 `(minSep - d) / 2`、**原地修改 pins**、一轮没动就 break。
4. **`splitScaleFor(members, currentScale)`** 照 Vue2 `:644-660`:`members.length < 2` → `MAX_SCALE`;在 `MAX_SCALE` 都裂不开(共点)→ `MAX_SCALE`;否则 `lo = currentScale, hi = MAX_SCALE`,22 步二分找「首次 >= 2 簇」的 scale,返回 `Math.min(MAX_SCALE, hi * 1.04)`(**越过门槛一点点,让裂开可见而不是临界**)。
5. **`buildPins(places, scale, activeId)`** 照 Vue2 `:235-278`:先 `project(lon, lat)`;`scale >= MAX_SCALE` 时**每个城市自成一簇**(不留无法再裂的簇),否则 `clusterByOverlap(projected, scale, tierRadius)`;`r = tierRadius(cl.count) / scale`;`hitR = Math.max(r, 9 / scale)`(屏幕恒定点击靶);单成员簇沿用该地点全部字段 + `cluster: false`;多成员簇 id 为 `` `cluster:${cl.lead.id}` ``、`city`/`country`/`thumbs`/`coverAssetId` 取 lead、`recent` 为任一成员 recent、`places` 为成员数、`cluster: true`;`active` 一律 `String()` 归一比较(单成员比自身 id、多成员看是否有成员命中);**`atMax` 时最后跑一次 `declutterPins(out, (2 * tierRadius(0) + 4) / scale)`**。
6. **`visitedDots(places)`** 照 Vue2 `:228-234`:对每个 `WORLD_DOTS` 项判 `places.some(p => Math.abs(p.lon - d.lon) < 3.5 && Math.abs(p.lat - d.lat) < 3.5)`。**照搬 O(点数 × 地点数) 全扫,不做空间索引**(偏离登记 11-①)。
7. **`parsePlaceLast`(偏离登记 2)** —— 后端 `Last` 是 Go `"Jan 2, 2006"` 布局,例:`"Mar 7, 2026"`。**不用 `new Date(str)`**(依赖宿主 locale 解析,Safari/旧内核会返 Invalid Date):自己按 `/^([A-Za-z]{3}) (\d{1,2}), (\d{4})$/` 匹配 + 三字母月份表,构造**本地时区**的 `new Date(y, mIdx, d)`。匹配不上或月份表查不到 → `null`。
8. **`filterPlaces(places, f, now = new Date())`(偏离登记 1、2)**:顺序照 Vue2 `:152-175` —— 先时间(`trip` → `recent === true`;`year` → **`lastDate` 的年份 === `now.getFullYear()`**,不再正则 `202(?:5|6)`;`custom` 且 `customStart && customEnd` 都非空 → `lastDate` 落在 `[start, end]` 闭区间),再 `minCount > 0` → `count >= minCount`,再 `regionFilter` → `region === regionFilter`,再 `recentOnly` → `recent`。**`lastDate === null` 的地点在 `year` / `custom` 分支被过滤掉,在 `all` / `trip` 分支不受影响**。`custom` 的边界用「按日」比较:start 取当日 00:00、end 取当日 23:59:59.999,避免 `customEnd` 那天的照片被排除。
9. **`searchPlaces`** 照 Vue2 `:189-195`:query trim + 小写后为空 → 原数组直返;否则 `city` 或 `country` 小写 `includes`。
10. **`groupByRegion`** 照 Vue2 `:196-203`:按 `region` 分桶,**每桶内按 `count` 降序**。
11. **`regionLabelKey`(偏离登记 3)**:`asia|americas|europe|africa|oceania|antarctica` → `photosPlacesRegionAsia` 等六个键;**未知 id 返回 `null`**(调用方回落到后端 `label`)。
12. **`extraFilterCount`** 照 Vue2 `:177-186`:`minCount > 0` / `regionFilter` / `recentOnly` 三者各算 1。
13. **`toPlace(raw)`**:`id: String(raw.key)`、`key` 原样保留、`thumbs: raw.thumbs ?? []`、`coverAssetId: raw.coverAssetId ?? ''`、`recent`/`home` 强制布尔、`lastDate: parsePlaceLast(raw.last)`。

- [ ] **Step 1: 写失败测试**

测试文件必须覆盖上面 13 条。每条至少一个断言;下列几条是**必须逐字包含**的高危用例(其余按常规 TDD 补齐):

```ts
// src/photos/util/__tests__/placesMap.test.ts —— 高危用例节选(其余照上面 13 条补齐)
import { describe, expect, it } from 'vitest'
import {
  MAX_SCALE, buildPins, declutterPins, extraFilterCount, filterPlaces,
  groupByRegion, parsePlaceLast, regionLabelKey, searchPlaces, splitScaleFor,
  tierRadius, toPlace, visitedDots, type Place, type Pin,
} from '../placesMap'

function place(over: Partial<Place> = {}): Place {
  return {
    id: '1', key: 1, region: 'asia', country: 'China', city: 'Hangzhou',
    lon: 120.2, lat: 30.3, count: 10, recent: false,
    last: 'Mar 7, 2026', lastDate: new Date(2026, 2, 7),
    trips: 1, home: false, thumbs: [], coverAssetId: '', ...over,
  }
}

describe('parsePlaceLast', () => {
  it('解析 Go "Jan 2, 2006" 布局(不走宿主 locale)', () => {
    const d = parsePlaceLast('Mar 7, 2026')!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2)   // 0-based
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
})

describe('filterPlaces —— This year 不再写死年份(偏离登记 1)', () => {
  const now = new Date(2030, 5, 1)   // 显式注入「现在」,不依赖系统时钟
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

  it('簇的 active 在任一成员命中时为真,id 为 cluster:<lead.id>', () => {
    const big = place({ id: 'big', lon: 120, lat: 30, count: 500 })
    const small = place({ id: 'small', lon: 120.05, lat: 30, count: 5 })
    const [pin] = buildPins([big, small], 1, 'small')
    expect(pin.cluster).toBe(true)
    expect(pin.id).toBe('cluster:big')
    expect(pin.active).toBe(true)
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
```

追加到 `src/photos/util/__tests__/worldMap.test.ts` 末尾(**只追加,不动既有 describe**):

```ts
/* P6a-T2:补 P5-T4 parked 的 viewBox 最小跨度钳制分支。
   钳制条件是 padding 后的跨度仍小于 MIN_LON_SPAN(40) / MIN_LAT_SPAN(30);
   因 LON_PAD*2 === MIN_LON_SPAN、LAT_PAD*2 === MIN_LAT_SPAN,单点情形下
   padding 后恰好等于阈值(不触发),**只有贴近 ±180 / ±90 被裁掉一侧
   padding 时才真正可达** —— 这就是 P5 当时判定「继承自 Vue2 的测试盲区」的原因。 */
describe('PhotosMiniMap viewBox 最小跨度钳制(边界点位)', () => {
  it('经度贴近 +180 时右侧 padding 被裁,触发 lon 钳制并把窗口拉回 40 度宽', () => {
    /* 实现者:用 mount(PhotosMiniMap, { props: { points: [{ latitude: 0, longitude: 179 }] } })
       读 svg 的 viewBox attribute,断言宽度对应 40 经度(= MAP_W * 40 / 360),
       且左边界未越过 -180(project(-180) → x=0)。 */
  })
  it('纬度贴近 +90 时上侧 padding 被裁,触发 lat 钳制并把窗口拉回 30 度高', () => {
    /* 同上,points: [{ latitude: 89, longitude: 0 }],断言高度对应 30 纬度。 */
  })
  it('贴近 -180 / -90 的对侧同样触发钳制', () => {
    /* points: [{ latitude: -89, longitude: -179 }] */
  })
})
```

> **实现者注意**:上面三个用例的注释是「要断言什么」的规格,**必须替换成真实的 mount + attributes('viewBox') 断言**,不许留空壳 `it`。数值先用 `MAP_W`/`MAP_H` 与 `project()` 算出期望值再写死,不要反过来拿实现输出填期望(否则测试恒绿)。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/photos/util/__tests__/placesMap.test.ts src/photos/util/__tests__/worldMap.test.ts`
Expected: FAIL —— placesMap 全红(模块不存在);worldMap 三个新用例红。

- [ ] **Step 3: 实现 `placesMap.ts`**

按上面「关键实现约束」13 条实现。**每个从 Vue2 搬来的函数头部都要注明 Vue2 行号**(体例照 `util/peopleView.ts`)。`parsePlaceLast` 的月份表:

```ts
// Go time 布局 "Jan 2, 2006" 的三字母月份(后端 places.go:76 用的就是这个布局)。
// 不用 new Date(str):那走宿主 locale 解析,Safari / 旧内核会返 Invalid Date。
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const LAST_RE = /^([A-Za-z]{3}) (\d{1,2}), (\d{4})$/

export function parsePlaceLast(last: string | null | undefined): Date | null {
  if (!last)
    return null
  const m = LAST_RE.exec(last.trim())
  if (!m)
    return null
  const mi = MONTHS.findIndex(x => x.toLowerCase() === m[1].toLowerCase())
  if (mi < 0)
    return null
  const day = Number(m[2])
  const year = Number(m[3])
  const d = new Date(year, mi, day)
  // 防 'Feb 31, 2026' 之类溢出成 3 月 3 日:回读校验。
  if (d.getFullYear() !== year || d.getMonth() !== mi || d.getDate() !== day)
    return null
  return d
}
```

- [ ] **Step 4: 跑测试确认通过 + 删码验证**

Run: `pnpm exec vitest run src/photos/util/__tests__/placesMap.test.ts src/photos/util/__tests__/worldMap.test.ts`
Expected: PASS

**逐个删码验证(必做,一次只删一处):**
1. `buildPins` 里删掉 `atMax` 分支(恒走 `clusterByOverlap`)→「scale >= MAX_SCALE 时每个城市自成一钉」必须红。
2. 删掉 `atMax` 时的 `declutterPins` 调用 →「满缩放下共点两钉被推开」必须红。
3. `hitR` 改成 `r`(去掉 `Math.max(r, 9 / scale)`)→「hitR 不小于 9/scale」必须红。
4. `active` 比较去掉 `String()` 归一 →「数字 key 被字符串 activeId 命中」必须红。
5. `filterPlaces` 的 `year` 分支改回 `/202(?:5|6)/.test(p.last)` →「2030 年能筛到 2030」必须红(**这条就是偏离登记 1 的回归守卫**)。
6. `parsePlaceLast` 的回读校验两行删掉 → `'Feb 31, 2026'` 用例必须红(若测试没覆盖这条,先补)。
7. `splitScaleFor` 的 `hi * 1.04` 改成 `hi` →「在该 scale 下确实裂成 >= 2」可能变红(临界);**若不红,说明这条不变量没被真正钉住,要把断言改成在 `s` 下必须 >= 2 簇且在 `s / 1.04` 下 < 2 簇**。
8. `groupByRegion` 的桶内 sort 删掉 →「每桶内按 count 降序」必须红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/util/placesMap.ts src/photos/util/__tests__/placesMap.test.ts src/photos/util/__tests__/worldMap.test.ts
git commit -m "feat(photos): P6a-T2 图钉几何/过滤谓词/日期解析纯函数 + worldMap 钳制边界补测

- This year 过滤不再写死 202(5|6),改按注入的当前年份(偏离登记 1)
- Place.Last 显示串解析一次成 Date,过滤只看 Date(偏离登记 2)
- 大洲标签改 i18n 键映射,未知 id 回落后端 label(偏离登记 3)
- Place.Key 是 int32,id 全链路 String() 归一(偏离登记 4)
- 补 P5-T4 parked 的 viewBox 最小跨度钳制边界点位测试"
```

---

