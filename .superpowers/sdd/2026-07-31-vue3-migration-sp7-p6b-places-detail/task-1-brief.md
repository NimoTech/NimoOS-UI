### Task 1: i18n 45 键 + `placesInsight.ts` 后端 key 映射

**Files:**
- Modify: `src/i18n/zh_cn.ts`(photos 段末尾追加)、`src/i18n/en_us.ts`(同位置追加)
- Create: `src/photos/util/placesInsight.ts`
- Create: `src/photos/util/__tests__/placesInsight.test.ts`
- Read-only 参考: `NimoOS-UI/src/assets/lang/zh_CN.json`、`en_US.json`、`NimoOS-Photos/service/places.go:526-560`

**Interfaces:**
- Consumes: 无
- Produces:
  ```ts
  // src/photos/util/placesInsight.ts
  export const INSIGHT_KEY_MAP: Readonly<Record<string, string>>
  /** 后端 key → New-UI i18n 键;未知 key 返回 null(调用方跳过该卡片 + console.warn)。 */
  export function insightKey(backendKey: string): string | null
  /** params.names 是 Go []string;数组用 ' · ' 拼,字符串原样,其它返回 ''。 */
  export function joinCompanionNames(names: unknown): string
  ```
  以及 45 个 `photosPlaces*` 键(下表),T3-T9 全部消费。

**键表(zh 取 `zh_CN.json` 原文,en 取 `en_US.json` 原文;标「自拟」的三条 Vue2 无对应键)**

| New-UI 键 | zh_cn | en_us | 来源 |
|---|---|---|---|
| `photosPlacesHomeBase` | `常驻地` | `Home base` | `'Home base'` |
| `photosPlacesTrip` | `次旅行` | `trip` | `'trip'` |
| `photosPlacesTrips` | `次旅行` | `trips` | `'trips'`(zh 两条同值,**照 json 各留一键**) |
| `photosPlacesSpotsLabel` | `地点` | `spots` | `'spots'` |
| `photosPlacesPhotosShotHere` | `张照片拍摄于此` | `photos shot here` | `'photos shot here'` |
| `photosPlacesSpotsInCity` | `{city} 的地点` | `Spots in {city}` | `'Spots in {city}'` |
| `photosPlacesViewAll` | `查看全部` | `View all` | `'View all'` |
| `photosPlacesNimoNoticed` | `Nimo 发现` | `Nimo noticed` | `'Nimo noticed'` |
| `photosPlacesRecentPhotos` | `最近的照片` | `Recent photos` | `'Recent photos'` |
| `photosPlacesSeeAll` | `查看全部 {n} 张` | `See all {n}` | `'See all {n}'` |
| `photosPlacesVisitHistory` | `到访记录` | `Visit history` | `'Visit history'` |
| `photosPlacesDays` | `{n} 天` | `{n} days` | `'{n} days'` |
| `photosPlacesWith` | `与` | `with` | `'with'` |
| `photosPlacesSpotsCount` | `{n} 个地点` | `{n} spots` | `'{n} spots'` |
| `photosPlacesSaveTrip` | `保存旅行` | `Save trip` | `'Save trip'` |
| `photosPlacesSaveTripTitle` | `将这次旅行保存为相册` | `Save this trip as an album` | `'Save this trip as an album'` |
| `photosPlacesOpenInLibrary` | `在图库中打开` | `Open in Library` | `'Open in Library'` |
| `photosPlacesSaveAsAlbum` | `保存为相册` | `Save as Album` | `'Save as Album'` |
| `photosPlacesAlbumCreated` | `已创建相册「{name}」· {count} 张照片` | `Album "{name}" created · {count} photos` | 同名 json 键 |
| `photosPlacesAlbumCreateFailed` | `相册创建失败` | `Could not create album` | `'Could not create album'` |
| `photosPlacesToastOpen` | `打开` | `Open` | `'Open'`(本仓无通用 `photosOpen`,已 grep) |
| `photosPlacesShowWholeCity` | `只看整个城市` | `Show whole city` | `'Show whole city'` |
| `photosPlacesSpotRename` | `重命名` | `Rename` | `photos.places.spot.rename` |
| `photosPlacesSpotNamePlaceholder` | `地点名称` | `Spot name` | `photos.places.spot.namePlaceholder` |
| `photosPlacesSpotSave` | `保存` | `Save` | `photos.places.spot.save`(本仓无通用 `photosSave`,已 grep) |
| `photosPlacesSpotViewInLibrary` | `在 Library 中查看这个 spot 的全部照片` | `View all photos of this spot in Library` | `photos.places.spot.viewInLibrary` |
| `photosPlacesSpotResetName` | `恢复默认名` | `Reset to default name` | **自拟(D8)** |
| `photosPlacesSpotRenameFailed` | `地点重命名失败` | `Could not rename spot` | **自拟(偏离 6)** |
| `photosPlacesCoverFailed` | `封面更新失败` | `Could not update cover` | **自拟(偏离 6)** |
| `photosPlacesCoverSet` | `设置主图` | `Set cover` | `photos.places.cover.set` |
| `photosPlacesCoverTitle` | `设置 {city} 主图` | `Set {city} cover` | `photos.places.cover.title` |
| `photosPlacesCoverSubtitle` | `从 {count} 张照片里选一张作为封面` | `Pick one of {count} photos as the cover` | `…cover.subtitle` |
| `photosPlacesCoverSearchPlaceholder` | `搜索场景 / 人 / 标签…` | `Search scenes / people / tags…` | `…cover.searchPlaceholder` |
| `photosPlacesCoverNoMatch` | `没有匹配"{q}"的照片` | `No photos matching "{q}"` | `…cover.noMatch`(**直角双引号照 json**) |
| `photosPlacesCoverResetDefault` | `恢复默认` | `Reset to default` | `…cover.resetDefault` |
| `photosPlacesCoverPageInfo` | `{total} 张可选 · 第 {page} / {pages} 页` | `{total} candidates · page {page} / {pages}` | `…cover.pageInfo` |
| `photosPlacesCoverTabRecent` | `近期` | `Recent` | `photos.places.coverTab.recent` |
| `photosPlacesCoverTabTop` | `最高分` | `Top rated` | `…coverTab.top` |
| `photosPlacesCoverTabFav` | `已收藏` | `Favorited` | `…coverTab.fav` |
| `photosPlacesCoverTabAll` | `全部` | `All` | `…coverTab.all`(与既有 `photosPlacesAll` 同值不同语义域,**各留一键**) |
| `photosPlacesInsightMostPhotographed` | `你拍得最多的地方——共 {count} 张。` | `Your most photographed place — {count} photos.` | `…insight.mostPhotographed` |
| `photosPlacesInsightTopSpot` | `{spot} 是主要拍摄点——{count} 张。` | `{spot} is the dominant spot — {count} photos.` | `…insight.topSpot`(去掉 `<b>` 标签,`{spot}` 成插槽) |
| `photosPlacesInsightCompanions` | `在这里和 {names} 同框。` | `Spotted with {names} here.` | `…insight.companions`(同上) |
| `photosPlacesInsightHome` | `你的{base}——{trips} 次行程共 {count} 张。` | `Your {base} — {count} photos across {trips} trips.` | `…insight.home`(**偏离 10**:加粗静态词换成 `{base}` 插槽) |
| `photosPlacesInsightHomeBase` | `大本营` | `home base` | `…insight.home` 里的加粗词(**偏离 10**;注意与 `photosPlacesHomeBase`「常驻地」是 Vue2 对同一概念的两种说法,**不统一**,两处键旁都要注释登记) |

- [ ] **Step 1: 写失败测试**

```ts
// src/photos/util/__tests__/placesInsight.test.ts
import { describe, expect, it, vi } from 'vitest'
import { INSIGHT_KEY_MAP, insightKey, joinCompanionNames } from '../placesInsight'

describe('insightKey', () => {
  it('四个后端 key 各映射到对应 New-UI 键', () => {
    expect(insightKey('photos.places.insight.mostPhotographed')).toBe('photosPlacesInsightMostPhotographed')
    expect(insightKey('photos.places.insight.topSpot')).toBe('photosPlacesInsightTopSpot')
    expect(insightKey('photos.places.insight.companions')).toBe('photosPlacesInsightCompanions')
    expect(insightKey('photos.places.insight.home')).toBe('photosPlacesInsightHome')
  })
  it('未知 key 返回 null(调用方据此跳过卡片,不把后端 key 渲染给用户)', () => {
    expect(insightKey('photos.places.insight.whatever')).toBeNull()
    expect(insightKey('')).toBeNull()
  })
  it('映射表恰好四条,与后端 places.go 的 insights() 一一对应', () => {
    expect(Object.keys(INSIGHT_KEY_MAP)).toHaveLength(4)
  })
})

describe('joinCompanionNames', () => {
  it('数组用 " · " 拼接(与到访记录里 faces 的拼法同口径)', () => {
    expect(joinCompanionNames(['小明', '小红'])).toBe('小明 · 小红')
  })
  it('单元素数组不带分隔符', () => {
    expect(joinCompanionNames(['小明'])).toBe('小明')
  })
  it('字符串原样返回(后端某天改成单字符串也不炸)', () => {
    expect(joinCompanionNames('小明')).toBe('小明')
  })
  it('null / undefined / 数字 → 空串', () => {
    expect(joinCompanionNames(null)).toBe('')
    expect(joinCompanionNames(undefined)).toBe('')
    expect(joinCompanionNames(42)).toBe('')
  })
  it('数组元素非字符串时按 String() 归一,空元素被剔除', () => {
    expect(joinCompanionNames(['小明', '', null, 7])).toBe('小明 · 7')
  })
})
```

i18n 侧另加两条 parity 专用断言(追加到 `src/i18n/parity.test.ts` 已有 describe 内,**不新建文件**):

```ts
it('P6b 地点键在两个 locale 都存在且无空值', () => {
  const keys = ['photosPlacesHomeBase', 'photosPlacesSpotResetName', 'photosPlacesCoverPageInfo',
    'photosPlacesInsightHome', 'photosPlacesInsightHomeBase', 'photosPlacesVisitHistory']
  for (const k of keys) {
    expect(String((zh as Record<string, unknown>)[k] ?? '')).not.toBe('')
    expect(String((en as Record<string, unknown>)[k] ?? '')).not.toBe('')
  }
})
it('insight 键的插值占位符两个 locale 完全一致(漏一个槽 <i18n-t> 会静默丢内容)', () => {
  const slots = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort()
  for (const k of ['photosPlacesInsightMostPhotographed', 'photosPlacesInsightTopSpot',
    'photosPlacesInsightCompanions', 'photosPlacesInsightHome']) {
    expect(slots(String((zh as Record<string, string>)[k]))).toEqual(slots(String((en as Record<string, string>)[k])))
  }
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/photos/util/__tests__/placesInsight.test.ts src/i18n/parity.test.ts`
Expected: FAIL — `Cannot find module '../placesInsight'` + parity 两条新断言红。

- [ ] **Step 3: 实现**

```ts
// src/photos/util/placesInsight.ts
// 后端 insights 的 i18n key 是 Vue2 时代的点分嵌套键(NimoOS-Photos/service/places.go:526-560
// 恰好四条),New-UI 用扁平驼峰键,故需一张映射表(照 P6a regionLabelKey 的先例)。
// 偏离登记 8:Vue2 `pt(ins.key)` 对未知 key 会把 key 原文渲染给用户;这里返回 null,
// 由调用方跳过该卡片并 console.warn —— 后端加了新 insight 时界面不会漏出内部 key。
export const INSIGHT_KEY_MAP: Readonly<Record<string, string>> = Object.freeze({
  'photos.places.insight.mostPhotographed': 'photosPlacesInsightMostPhotographed',
  'photos.places.insight.topSpot': 'photosPlacesInsightTopSpot',
  'photos.places.insight.companions': 'photosPlacesInsightCompanions',
  'photos.places.insight.home': 'photosPlacesInsightHome',
})

export function insightKey(backendKey: string): string | null {
  return INSIGHT_KEY_MAP[backendKey] ?? null
}

// 偏离登记 9:后端 params.names 是 Go []string(places.go:550-551),Vue2 直接插值 →
// 渲染成逗号无空格连接。这里显式用 ' · ' 拼,与同页到访记录 faces 的拼法(Vue2 :1229
// `(v.faces || []).join(' · ')`)同口径。
export function joinCompanionNames(names: unknown): string {
  if (Array.isArray(names)) {
    return names.map((n) => String(n ?? '')).filter((s) => s !== '').join(' · ')
  }
  return typeof names === 'string' ? names : ''
}
```

i18n:两个 locale 各在 photos 段**末尾**追加上表 45 键,**键序逐字节一致**;`photosPlacesTrip`/`photosPlacesTrips`、`photosPlacesHomeBase`/`photosPlacesInsightHomeBase`、`photosPlacesCoverTabAll`/`photosPlacesAll` 三组「同值或近义但各留一键」处各写一行注释说明理由(照 P6a `photosPlacesCurrentTrip` / `photosPlacesCurrentTripOnly` 的双说法登记体例)。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/photos/util/__tests__/placesInsight.test.ts src/i18n/ && pnpm exec vue-tsc --noEmit`
Expected: 全绿。

删码清单(一次只删一处,用 Edit 手工还原):①`insightKey` 的 `?? null` 改成 `?? backendKey` → 未知 key 用例红;②`joinCompanionNames` 的 `.filter((s) => s !== '')` 删掉 → 「空元素被剔除」红;③`Object.freeze` 里删掉 `home` 一条 → 映射四条 + 逐条断言红;④en_us 里删掉 `photosPlacesInsightHome` 的 `{base}` 槽 → parity 占位符断言红。

- [ ] **Step 5: Commit**

```bash
git add src/i18n/zh_cn.ts src/i18n/en_us.ts src/i18n/parity.test.ts src/photos/util/placesInsight.ts src/photos/util/__tests__/placesInsight.test.ts
git commit -m "feat(photos): P6b-T1 地点详情 i18n 45 键 + insight 后端 key 映射

- 42 条取 Vue2 zh_CN/en_US json 原文,3 条自拟(D8 恢复默认名 + 两条失败 toast)
- insight.home 拆主句键 + 加粗词键(<i18n-t> 只能对插值位开槽,偏离登记 10)
- 未知 insight key 返 null 由调用方跳过,不把后端 key 渲染给用户(偏离登记 8)"
```

---

