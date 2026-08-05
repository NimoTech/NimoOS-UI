### Task 4: i18n —— P6a 地点键(zh_cn + en_us,过 parity)

**Files:**
- Modify: `src/i18n/zh_cn.ts`(**photos 段末尾追加,绝不重排既有键**)
- Modify: `src/i18n/en_us.ts`(同上,键序必须与 zh_cn 逐字节一致)
- Read-only 参考: `/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/zh_CN.json` 与 `en_US.json` 的 `photos.places.*` 嵌套块(**译文一律取旧文件原文,不要自拟**);`PhotosPlacesView.vue` 全文的 `$t(...)` / `pt(...)` 调用点

**Interfaces:**
- Produces:P6a 视图与组件用到的全部 `photosPlaces*` 键。T5/T6/T8/T9/T10/T11 直接消费,**键名以本任务落地的为准**。

**开工前必做:** `grep -n "photosPlaces" src/i18n/zh_cn.ts` 确认现存**零个**;`grep -n "photosReset\|photosPeoplePhotosCount\|photosCancel\|photosClose" src/i18n/zh_cn.ts` 确认可复用键的实际文案再决定复不复用。

**键表(zh 文案取自旧 `zh_CN.json`,en 取自 `en_US.json`;两处都没有的标「自拟」并在 report 里列出)**

| 键 | zh | en | 来源 |
|---|---|---|---|
| `photosPlaces` | 地点 | Places | 侧栏 + AreaShell title;旧 `Places` 键 |
| `photosPlacesCities` | 座城市 | cities | 旧 `cities` |
| `photosPlacesCountries` | 个国家 | countries | 旧 `countries` |
| `photosPlacesPhotos` | 张照片 | photos | 旧 `photos_count` |
| `photosPlacesSearchPlaceholder` | 搜索城市或国家 | Search cities or countries | 旧 `Search cities or countries` |
| `photosPlacesCityCount` | {n} 座城市 | {n} cities | 旧 `{n} cities` |
| `photosPlacesPhotoCount` | {n} 张照片 | {n} photos | 旧 `{n} photos`(悬停卡片用;**与既有 `photosPeoplePhotosCount` 文案相同但语义域不同,按 P5 惯例各自留键**) |
| `photosPlacesFilters` | 筛选 | Filters | 旧 `Filters` |
| `photosPlacesTimeRange` | 时间范围 | Time range | `photos.places.mapFilter.timeRange` |
| `photosPlacesStartDate` | 起始日期 | Start date | `…startDate` |
| `photosPlacesEndDate` | 结束日期 | End date | `…endDate` |
| `photosPlacesMinPhotos` | 最少照片数 | Min photos | `…minPhotos` |
| `photosPlacesRegion` | 区域 | Region | `…region` |
| `photosPlacesCurrentTripOnly` | 只看当前行程 | Current trip only | `…currentTripOnly` |
| `photosPlacesFilterReset` | 重置 | Reset | `…reset` |
| `photosPlacesFilterDone` | 完成 | Done | `…done` |
| `photosPlacesAny` | 不限 | Any | 旧 `Any` |
| `photosPlacesAtLeast` | ≥ {n} | ≥ {n} | 旧 `≥ {n}` |
| `photosPlacesAll` | 全部 | All | 旧 `All` |
| `photosPlacesMapTheme` | 地图主题 | Map theme | `photos.places.mapTheme.title` |
| `photosPlacesMapThemePresets` | 预设主题 | Presets | `…presets` |
| `photosPlacesMapThemeCustom` | 自定义 | Custom | `…custom` |
| `photosPlacesLandDotColor` | 地面点颜色 | Land dot color | `…landDotColor` |
| `photosPlacesCityLightColor` | 城市灯颜色 | City light color | `…cityLightColor` |
| `photosPlacesThemeDefault` | 默认 | Default | 旧 `Default`(预设名) |
| `photosPlacesThemeOcean` | 海洋 | Ocean | 旧 `Ocean`;**zh 自拟**(旧 json 无中文预设名) |
| `photosPlacesThemeSand` | 沙色 | Sand | 同上,**zh 自拟** |
| `photosPlacesThemeMono` | 黑白 | Mono | 同上,**zh 自拟** |
| `photosPlacesThemeDescDefault` | 紫色点 + 黑色背景 | Purple dots on black | `…mapTheme.desc.default` |
| `photosPlacesThemeDescOcean` | 青绿调 + 深色背景 | Teal on deep blue | `…desc.ocean` |
| `photosPlacesThemeDescSand` | 暖黄 + 浅调背景 | Warm amber on dark | `…desc.sand` |
| `photosPlacesThemeDescMono` | 黑白灰 | Black & white | `…desc.mono` |
| `photosPlacesZoomIn` | 放大 | Zoom in | 旧 `Zoom in` |
| `photosPlacesZoomOut` | 缩小 | Zoom out | 旧 `Zoom out` |
| `photosPlacesResetView` | 复位视图 | Reset view | 旧 `Reset view` |
| `photosPlacesCurrentTrip` | 当前行程 | Current trip | 旧 `Current trip` |
| `photosPlacesRegionAsia` | 亚洲 | Asia | **偏离登记 3**;后端 `regionLabels`,zh 自拟 |
| `photosPlacesRegionAmericas` | 美洲 | Americas | 同上 |
| `photosPlacesRegionEurope` | 欧洲 | Europe | 同上 |
| `photosPlacesRegionAfrica` | 非洲 | Africa | 同上 |
| `photosPlacesRegionOceania` | 大洋洲 | Oceania | 同上 |
| `photosPlacesRegionAntarctica` | 南极洲 | Antarctica | 同上 |
| `photosPlacesEmpty` | 还没有带位置信息的照片 | No photos with location data yet | **New-UI 补齐**(偏离登记 9) |
| `photosPlacesEmptyHint` | 相册会在索引照片时读取 GPS 信息 | Nimo reads GPS data while indexing your photos | 同上,**自拟** |
| `photosPlacesSearchEmpty` | 没有匹配「{q}」的城市 | No cities matching "{q}" | 同上,**自拟** |
| `photosPlacesLoadFailed` | 地点加载失败 | Could not load places | 同上,照 P5-T14 的 `photosPersonLoadFailed` 先例 |
| `photosPlacesRetry` | 重试 | Retry | 同上;**先 grep 是否已有 `photosRetry` 可复用** |

**图例的 `< 40` / `40–100` / `100+` 三个字面量不进 i18n**(纯数字符号,照 Vue2 `:1032-1039` 直接写在模板里;它们与 `tierRadius` 门槛耦合,已在 T2 注释登记)。

- [ ] **Step 1: 写失败测试**

parity 测试(`src/i18n/parity.test.ts`)已存在且会自动覆盖新键。**额外加一条本期专用断言**,追加到 `parity.test.ts` 末尾:

```ts
/* P6a-T4:地点域键的完整性与术语守卫。 */
describe('photosPlaces 键(SP7-P6a)', () => {
  it('六个大洲键齐备,且 regionLabelKey 的返回值全部有译文', async () => {
    const { regionLabelKey } = await import('../photos/util/placesMap')
    for (const id of ['asia', 'americas', 'europe', 'africa', 'oceania', 'antarctica']) {
      const k = regionLabelKey(id)!
      expect(zh_cn).toHaveProperty(k)
      expect(en_us).toHaveProperty(k)
    }
  })

  it('中文文案不含工程词「簇」「聚类」「气泡」', () => {
    const bad = Object.entries(zh_cn)
      .filter(([k]) => k.startsWith('photosPlaces'))
      .filter(([, v]) => typeof v === 'string' && /簇|聚类|气泡/.test(v))
    expect(bad).toEqual([])
  })
})
```

> 实现者:`parity.test.ts` 现有的 import 形状要先读一遍再照它写(zh_cn / en_us 的导入名以该文件实际为准)。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/i18n/parity.test.ts`
Expected: FAIL —— 六个大洲键缺失(`toHaveProperty` 红)

- [ ] **Step 3: 实现(两个 locale 文件 photos 段末尾追加,键序完全一致)**

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/i18n/ && pnpm exec vue-tsc --noEmit`
Expected: PASS + tsc exit 0

额外自检(照 P5 终审的程序化扫描):
```bash
# 两 locale 的 photosPlaces 键序必须逐字节相同
diff <(grep -o "photosPlaces[A-Za-z]*:" src/i18n/zh_cn.ts) <(grep -o "photosPlaces[A-Za-z]*:" src/i18n/en_us.ts) && echo "键序一致"
# 无重复键
grep -o "photosPlaces[A-Za-z]*:" src/i18n/zh_cn.ts | sort | uniq -d
```

- [ ] **Step 5: Commit**

```bash
git add src/i18n/zh_cn.ts src/i18n/en_us.ts src/i18n/parity.test.ts
git commit -m "feat(photos): P6a-T4 地点域 i18n 键双写(含大洲标签中文化,偏离登记 3)"
```

---

