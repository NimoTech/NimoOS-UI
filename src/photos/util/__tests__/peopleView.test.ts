import { describe, it, expect } from 'vitest'
import {
  toPerson, personInitial, namedOf, unnamedOf, visibleUnnamedOf,
  hiddenSingletonCountOf, unnamedCountAt, sortNamed, monthKeyLabel, mergeConfidencePct,
  mergeReasonKey, nimoReadParts,
  PLACE_PALETTE, groupPlaces, colorPoints,
  topPersons, topPlaces, byYear, resolvePersonByName,
  type Person, type PersonPlace, type PlaceGroup,
} from '../peopleView'
import type { Photo } from '../assetToPhoto'

const P = (over: Partial<Person>): Person => ({
  id: 'x', name: '', confidence: 1, count: 5, favorite: false, relation: '',
  coverFaceId: null, heroAssetId: null, firstSeen: null, lastSeen: null, placesCount: 0, ...over,
})

describe('toPerson', () => {
  it('缺字段全部落到安全缺省', () => {
    expect(toPerson({ id: 7 })).toMatchObject({
      id: 7, name: '', confidence: 0, count: 0, favorite: false, relation: '',
      coverFaceId: null, heroAssetId: null, firstSeen: null, lastSeen: null, placesCount: 0,
    })
  })
  it('保留数字 id 不做字符串化', () => { expect(toPerson({ id: 12 }).id).toBe(12) })
  it('confidence/count 走 Number 归一', () => {
    expect(toPerson({ id: 1, confidence: 0.82, count: 3 })).toMatchObject({ confidence: 0.82, count: 3 })
  })
})

describe('personInitial', () => {
  it('取 trim 后首字母大写', () => { expect(personInitial(' sara')).toBe('S') })
  it('空/纯空白/非字符串 → 空串', () => {
    expect(personInitial('')).toBe(''); expect(personInitial('   ')).toBe(''); expect(personInitial(null)).toBe('')
  })
})

describe('namedOf / unnamedOf', () => {
  const list = [P({ id: 1, name: '小明' }), P({ id: 2, name: '' }), P({ id: 3, name: '   ' })]
  it('已命名 = name 非空白', () => { expect(namedOf(list).map((p) => p.id)).toEqual([1]) })
  it('未命名 = 已命名的补集,两者并集等于全集', () => {
    expect(unnamedOf(list).map((p) => p.id)).toEqual([2, 3])
    expect(namedOf(list).length + unnamedOf(list).length).toBe(list.length)
  })
  it('不改变原顺序、不原地修改入参', () => {
    const src = [...list]; namedOf(src); expect(src.map((p) => p.id)).toEqual([1, 2, 3])
  })
})

describe('visibleUnnamedOf', () => {
  const un = [
    P({ id: 'a', confidence: 0.8, count: 5 }),   // 恰好等于阈值 80
    P({ id: 'b', confidence: 0.79, count: 5 }),  // 低于阈值
    P({ id: 'c', confidence: 0.95, count: 1 }),  // 单照片
  ]
  it('阈值是闭区间 >=(0.8*100 === 80 要保留)', () => {
    expect(visibleUnnamedOf(un, { confidence: 80, showSingletons: false }).map((p) => p.id)).toEqual(['a'])
  })
  it('showSingletons 打开时放行单照片', () => {
    expect(visibleUnnamedOf(un, { confidence: 80, showSingletons: true }).map((p) => p.id)).toEqual(['a', 'c'])
  })
  it('与 hiddenSingletonCountOf 严格互补', () => {
    const f = { confidence: 80, showSingletons: false }
    const atThreshold = un.filter((p) => p.confidence * 100 >= f.confidence).length
    expect(visibleUnnamedOf(un, f).length + hiddenSingletonCountOf(un, f)).toBe(atThreshold)
  })
  it('showSingletons 打开时 hidden 恒为 0', () => {
    expect(hiddenSingletonCountOf(un, { confidence: 50, showSingletons: true })).toBe(0)
  })
})

describe('unnamedCountAt', () => {
  const un = [P({ id: 'a', confidence: 0.9, count: 4 }), P({ id: 'b', confidence: 0.6, count: 4 }), P({ id: 'c', confidence: 0.9, count: 1 })]
  it('按传入阈值预览,不受当前阈值影响', () => {
    expect(unnamedCountAt(un, 50, false)).toBe(2)
    expect(unnamedCountAt(un, 90, false)).toBe(1)
  })
  it('showSingletons 参与判定', () => { expect(unnamedCountAt(un, 90, true)).toBe(2) })
})

describe('sortNamed', () => {
  const NOW = Date.parse('2026-07-28T00:00:00Z')
  const day = (n: number) => new Date(NOW - n * 864e5).toISOString()
  const list = [
    P({ id: 'a', name: 'Beta', relation: 'family', lastSeen: day(10), firstSeen: day(400) }),
    P({ id: 'b', name: 'Alpha', relation: 'work', lastSeen: day(200), firstSeen: day(30) }),
    P({ id: 'c', name: 'Gamma', relation: 'family', lastSeen: null, firstSeen: null }),
  ]
  it('all + freq → 原序(信任后端顺序)', () => {
    expect(sortNamed(list, 'all', 'freq', NOW).map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })
  it('按关系分组过滤', () => {
    expect(sortNamed(list, 'family', 'freq', NOW).map((p) => p.id)).toEqual(['a', 'c'])
  })
  it('recent 过滤 = 90 天内且 lastSeen 存在', () => {
    expect(sortNamed(list, 'recent', 'freq', NOW).map((p) => p.id)).toEqual(['a'])
  })
  it('recent 的 90 天是闭区间(整 90 天前仍保留)', () => {
    const edge = [P({ id: 'e', name: 'E', lastSeen: new Date(NOW - 90 * 864e5).toISOString() })]
    expect(sortNamed(edge, 'recent', 'freq', NOW).map((p) => p.id)).toEqual(['e'])
  })
  it('name 字母序 / recent 最近优先 / oldest 最早优先', () => {
    expect(sortNamed(list, 'all', 'name', NOW).map((p) => p.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(sortNamed(list, 'all', 'recent', NOW).map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(sortNamed(list, 'all', 'oldest', NOW).map((p) => p.id)).toEqual(['c', 'a', 'b'])
  })
  it('不原地修改入参数组', () => {
    const src = [...list]; sortNamed(src, 'all', 'name', NOW); expect(src.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('monthKeyLabel', () => {
  it('YYYY-MM → 英文全称月份 + 年', () => { expect(monthKeyLabel('2026-03')).toBe('March 2026') })
  it('非法月份原样返回 key', () => {
    expect(monthKeyLabel('2026-13')).toBe('2026-13')
    expect(monthKeyLabel('unknown')).toBe('unknown')
  })
  it('空/非字符串 → 空串', () => { expect(monthKeyLabel('')).toBe(''); expect(monthKeyLabel(null)).toBe('') })
})

describe('mergeConfidencePct', () => {
  it('0~1 → 整数百分比,缺失记 0', () => {
    expect(mergeConfidencePct(0.876)).toBe(88); expect(mergeConfidencePct(undefined)).toBe(0)
  })
})

const UNKNOWN = '未知'
const PL = (over: Partial<PersonPlace>): PersonPlace => ({ placeName: null, latitude: null, longitude: null, ...over })

describe('groupPlaces (PhotosPersonDetail.vue:537-551)', () => {
  it('placeName 优先,不查坐标', () => {
    const g = groupPlaces([PL({ placeName: 'Paris', latitude: 999, longitude: 999 })], UNKNOWN)
    expect(g).toEqual([{ name: 'Paris', count: 1, color: PLACE_PALETTE[0] }])
  })

  it('缺 placeName 但有坐标 → 走 countryFromCoords 反查', () => {
    // 46.6N,2.4E 是法国本土中心,France 边界框在 assetToPhoto.ts 的 COUNTRIES 表里已验证命中。
    const g = groupPlaces([PL({ latitude: 46.6, longitude: 2.4 })], UNKNOWN)
    expect(g).toEqual([{ name: 'France', count: 1, color: PLACE_PALETTE[0] }])
  })

  it('既无 placeName 也无坐标命中 → unknownLabel(纯函数,标签由调用方传入,不依赖 i18n)', () => {
    // -20,-140 落在南太平洋公海,assetToPhoto.ts 的国家边界框表里已验证不命中任何国家。
    const g1 = groupPlaces([PL({})], UNKNOWN)
    const g2 = groupPlaces([PL({ latitude: -20, longitude: -140 })], UNKNOWN)
    expect(g1).toEqual([{ name: UNKNOWN, count: 1, color: PLACE_PALETTE[0] }])
    expect(g2).toEqual([{ name: UNKNOWN, count: 1, color: PLACE_PALETTE[0] }])
  })

  it('按 count 降序', () => {
    const places = [
      PL({ placeName: 'A' }), PL({ placeName: 'B' }),
      PL({ placeName: 'A' }), PL({ placeName: 'A' }),
    ]
    const g = groupPlaces(places, UNKNOWN)
    expect(g.map((x) => [x.name, x.count])).toEqual([['A', 3], ['B', 1]])
  })

  it('7 色循环边界:第 8 个不同地点的颜色回到 PLACE_PALETTE[0]', () => {
    const places = Array.from({ length: 8 }, (_, i) => PL({ placeName: `P${i}` }))
    const g = groupPlaces(places, UNKNOWN)
    expect(g).toHaveLength(8)
    expect(g[0].color).toBe(PLACE_PALETTE[0])
    expect(g[6].color).toBe(PLACE_PALETTE[6])
    expect(g[7].color).toBe(PLACE_PALETTE[0]) // idx 7 % 7 === 0,与 idx 0 撞色
  })
})

describe('colorPoints (PhotosPersonDetail.vue:552-570)', () => {
  it('只保留 typeof lat/lon 均为 number 的点', () => {
    const places: PersonPlace[] = [
      PL({ placeName: 'A', latitude: 1, longitude: 2 }),
      PL({ placeName: 'B', latitude: null, longitude: 2 }),
      PL({ placeName: 'C', latitude: '3' as unknown as number, longitude: 4 }),
    ]
    const groups = groupPlaces(places, UNKNOWN)
    const pts = colorPoints(places, groups, UNKNOWN)
    expect(pts).toEqual([{ latitude: 1, longitude: 2, color: groups.find((g) => g.name === 'A')!.color }])
  })

  it('颜色与所属分组一致', () => {
    const places = [
      PL({ placeName: 'A', latitude: 1, longitude: 1 }),
      PL({ placeName: 'A', latitude: 2, longitude: 2 }),
      PL({ placeName: 'B', latitude: 3, longitude: 3 }),
    ]
    const groups = groupPlaces(places, UNKNOWN) // A count=2 → idx0,B count=1 → idx1
    const pts = colorPoints(places, groups, UNKNOWN)
    expect(pts[0].color).toBe(PLACE_PALETTE[0])
    expect(pts[1].color).toBe(PLACE_PALETTE[0])
    expect(pts[2].color).toBe(PLACE_PALETTE[1])
  })

  it('分组里查不到名字(如传入了不匹配的 groups)时回落 PALETTE[0]', () => {
    const places = [PL({ placeName: 'Ghost', latitude: 5, longitude: 5 })]
    const pts = colorPoints(places, [], UNKNOWN)
    expect(pts).toEqual([{ latitude: 5, longitude: 5, color: PLACE_PALETTE[0] }])
  })
})

describe('mergeReasonKey', () => {
  it('s 为空 → unnamed key,pct 为 0', () => {
    expect(mergeReasonKey(null)).toEqual({ key: 'photosPeopleMergeReasonUnnamed', params: { pct: 0 } })
    expect(mergeReasonKey(undefined)).toEqual({ key: 'photosPeopleMergeReasonUnnamed', params: { pct: 0 } })
  })
  it('intoName 非空 → named key,带 name 与 pct', () => {
    expect(mergeReasonKey({ confidence: 0.876, intoName: '小明' })).toEqual({
      key: 'photosPeopleMergeReasonNamed', params: { pct: 88, name: '小明' },
    })
  })
  it('无 intoName → unnamed key,带 pct', () => {
    expect(mergeReasonKey({ confidence: 0.5 })).toEqual({
      key: 'photosPeopleMergeReasonUnnamed', params: { pct: 50 },
    })
  })
})

// Task 13 (SP7-P5 人物): nimoReadParts —— 照 Vue2 PhotosPersonDetail.vue:571-585
// (nimoRead computed)的拼句规则,搬成不依赖 i18n 的纯函数,返回 {key, params}[]
// 供视图层各自 t() 后拼接。
describe('nimoReadParts (PhotosPersonDetail.vue:571-585)', () => {
  const PG = (name: string, count = 1): PlaceGroup => ({ name, count, color: PLACE_PALETTE[0] })

  it('有具名关系 + 两个地点 → With + Places2 两段', () => {
    const parts = nimoReadParts('小明', [{ name: '小红' }], [PG('北京'), PG('上海')])
    expect(parts).toEqual([
      { key: 'photosPersonInsightWith', params: { name: '小明', other: '小红' } },
      { key: 'photosPersonInsightPlaces2', params: { place1: '北京', place2: '上海' } },
    ])
  })

  it('有具名关系 + 一个地点 → With + Place1 两段', () => {
    const parts = nimoReadParts('小明', [{ name: '小红' }], [PG('北京')])
    expect(parts).toEqual([
      { key: 'photosPersonInsightWith', params: { name: '小明', other: '小红' } },
      { key: 'photosPersonInsightPlace1', params: { place: '北京' } },
    ])
  })

  it('无关系、无地点 → 单条 InsightNone', () => {
    expect(nimoReadParts('小明', [], [])).toEqual([
      { key: 'photosPersonInsightNone', params: { name: '小明' } },
    ])
  })

  it('关系存在但 name 为空/缺失 → WithUnnamed(不带 other)', () => {
    const parts = nimoReadParts('小明', [{ name: '' }], [])
    expect(parts).toEqual([
      { key: 'photosPersonInsightWithUnnamed', params: { name: '小明' } },
    ])
    // name 字段整个缺失(undefined)同样落这一支。
    const parts2 = nimoReadParts('小明', [{}], [])
    expect(parts2).toEqual([
      { key: 'photosPersonInsightWithUnnamed', params: { name: '小明' } },
    ])
  })

  // 关键回归(brief 硬约束的易错点):Vue2 :573 用的是 `this.relations[0]`——
  // 原始顺序的第一个,不是按 count 排序后的第一个。这里故意把「count 更大」的
  // 关系放在数组第二位,断言取到的仍是数组第一位那个人。
  //
  // 证伪验证(已做,过程见任务报告):把实现临时改成
  // `[...relations].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0]` 后重跑,
  // 本用例从绿变红(取到了 count 更大的"小刚"而不是数组第一位的"小红")——
  // 说明这条断言真的在守着"原始顺序"这个行为,不是摆设。已改回 relations[0]。
  it('取 relations[0] 而非按 count 排序后的第一个', () => {
    const parts = nimoReadParts(
      '小明',
      [{ name: '小红', count: 1 } as { name: string; count: number }, { name: '小刚', count: 100 } as { name: string; count: number }],
      [],
    )
    expect(parts[0]).toEqual({ key: 'photosPersonInsightWith', params: { name: '小明', other: '小红' } })
  })
})

// Task 15A (SP7-P5): topPersons/topPlaces/byYear —— 照 Vue2
// PhotosFavoritesView.vue:369-385(byPersonAll/byPlaceAll/byYearAll)。
function ph(over: Partial<Photo> = {}): Photo {
  return {
    id: 'x', title: 'x', file: '', date: '', time: '', takenAt: null, indexedAt: null,
    mimeType: 'image/jpeg', fileSize: 0, isVideo: false, hasOcr: false, isNew: false,
    isLivePhoto: false, livePhotoVideoId: null, duration: null, durationMs: 0, fav: false,
    status: undefined, filePath: '', width: null, height: null, dim: null, size: '',
    latitude: null, longitude: null, coords: null, place: null, camera: null, iso: null,
    shutter: null, aperture: null, focal: null, orientation: null, videoCodec: null,
    audioCodec: null, frameRate: null, bitRate: null, rotation: 0, matchScore: null,
    matchedBy: null, belowCut: false, tags: [], scene: null, faces: [], ...over,
  } as Photo
}

describe('topPersons (PhotosFavoritesView.vue:369-372)', () => {
  it('按出现次数降序', () => {
    const photos = [
      ph({ faces: ['Alice', 'Bob'] }),
      ph({ faces: ['Alice'] }),
      ph({ faces: ['Bob', 'Alice'] }),
    ]
    expect(topPersons(photos)).toEqual([['Alice', 3], ['Bob', 2]])
  })
  it('faces 缺失/为空不炸,直接跳过', () => {
    expect(topPersons([ph({ faces: undefined as unknown as string[] }), ph({ faces: [] })])).toEqual([])
  })
})

describe('topPlaces (PhotosFavoritesView.vue:373-377)', () => {
  it('falsy place 跳过,按出现次数降序', () => {
    const photos = [
      ph({ place: 'Paris, France' }), ph({ place: null }), ph({ place: 'Paris, France' }), ph({ place: 'Tokyo' }),
    ]
    expect(topPlaces(photos)).toEqual([['Paris, France', 2], ['Tokyo', 1]])
  })
})

describe('byYear (PhotosFavoritesView.vue:378-385)', () => {
  it('空 takenAt 跳过,按年份字符串降序 —— 不是按 count', () => {
    // 2024 只出现 1 次、2025 出现 2 次:若误按 count 排序,2025 会排在最前;
    // 正确实现按年份字符串降序,2025 仍然在前但原因不同——用第三个年份来把两条规则的
    // 结果彻底分岔:2023 出现 3 次(count 最多)但年份最小,必须排在最后。
    const photos = [
      ph({ takenAt: '2023-01-01' }), ph({ takenAt: '2023-06-01' }), ph({ takenAt: '2023-12-01' }),
      ph({ takenAt: '2024-01-01' }),
      ph({ takenAt: '2025-01-01' }), ph({ takenAt: '2025-06-01' }),
      ph({ takenAt: null }), ph({ takenAt: '' }),
    ]
    expect(byYear(photos)).toEqual([['2025', 2], ['2024', 1], ['2023', 3]])
  })

  // 删码验证①(见任务报告):把排序键临时改成按 count 降序(`b[1] - a[1]`)重跑此用例,
  // 断言从绿变红(2023 count=3 会跑到最前而不是排在 2025/2024 之后)——证明上面的断言
  // 真的在守着"按年份不是按 count"这条规则,不是摆设。已改回按年份字符串降序。
})

describe('resolvePersonByName (Task 15B, PhotosLightbox.vue:125-129 前置事实纠正)', () => {
  const P = (over: Partial<Person>): Person => ({
    id: 'x', name: '', confidence: 1, count: 5, favorite: false, relation: '',
    coverFaceId: null, heroAssetId: null, firstSeen: null, lastSeen: null, placesCount: 0, ...over,
  })
  it('唯一命中返回该人', () => {
    const people = [P({ id: 1, name: 'Alice' }), P({ id: 2, name: 'Bob' })]
    expect(resolvePersonByName(people, 'Alice')).toEqual(people[0])
  })
  it('重名两个 → null(宁可退回首字母,也不显示错的人脸)', () => {
    const people = [P({ id: 1, name: 'Alice' }), P({ id: 2, name: 'Alice' })]
    expect(resolvePersonByName(people, 'Alice')).toBeNull()
  })
  it('无匹配 → null', () => {
    expect(resolvePersonByName([P({ id: 1, name: 'Alice' })], 'Zoe')).toBeNull()
  })
  it('两侧 trim,大小写敏感精确比较', () => {
    const people = [P({ id: 1, name: ' Alice ' })]
    expect(resolvePersonByName(people, 'Alice')).toEqual(people[0])
    expect(resolvePersonByName(people, '  Alice')).toEqual(people[0])
    expect(resolvePersonByName(people, 'alice')).toBeNull() // 大小写敏感,不做模糊匹配
  })
})
