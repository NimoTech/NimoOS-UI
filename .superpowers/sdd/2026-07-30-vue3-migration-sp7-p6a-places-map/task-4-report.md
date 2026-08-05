# Task 4 报告 —— i18n:P6a 地点域键(zh_cn + en_us,过 parity)

## 新增键清单(47 个,`photosPlaces` 前缀,两文件段末追加,键序逐字节一致)

```
photosPlaces
photosPlacesCities
photosPlacesCountries
photosPlacesPhotos
photosPlacesSearchPlaceholder
photosPlacesCityCount
photosPlacesPhotoCount
photosPlacesFilters
photosPlacesTimeRange
photosPlacesStartDate
photosPlacesEndDate
photosPlacesMinPhotos
photosPlacesRegion
photosPlacesCurrentTripOnly
photosPlacesFilterReset
photosPlacesFilterDone
photosPlacesAny
photosPlacesAtLeast
photosPlacesAll
photosPlacesMapTheme
photosPlacesMapThemePresets
photosPlacesMapThemeCustom
photosPlacesLandDotColor
photosPlacesCityLightColor
photosPlacesThemeDefault
photosPlacesThemeOcean
photosPlacesThemeSand
photosPlacesThemeMono
photosPlacesThemeDescDefault
photosPlacesThemeDescOcean
photosPlacesThemeDescSand
photosPlacesThemeDescMono
photosPlacesZoomIn
photosPlacesZoomOut
photosPlacesResetView
photosPlacesCurrentTrip
photosPlacesRegionAsia
photosPlacesRegionAmericas
photosPlacesRegionEurope
photosPlacesRegionAfrica
photosPlacesRegionOceania
photosPlacesRegionAntarctica
photosPlacesEmpty
photosPlacesEmptyHint
photosPlacesSearchEmpty
photosPlacesLoadFailed
photosPlacesRetry
```

开工前确认:`grep -n "photosPlaces" src/i18n/zh_cn.ts` 现存 0 个(符合预期)。落地后 `grep -c "photosPlaces[A-Za-z]*:" src/i18n/zh_cn.ts` = 47,两文件相同。

## 回源核对结果(brief 表格 vs `zh_CN.json`/`en_US.json` 实际值)

方法:直接用 Python 加载 `/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json`,查 brief 表格里标注的每一个「旧键」路径(含 `photos.places.*` 嵌套路径),并用 `grep -n "\$t(\|pt("` 回查 `PhotosPlacesView.vue` 确认实际调用参数(排除有 `$t('...')` 字面被我看错前后引号转义漏配的假阴性)。

**发现 6 处出入,均已按 json 实际值改正(en 侵一致,均未改):**

| 键 | brief 给的 zh | json 实际 zh | 处理 |
|---|---|---|---|
| `photosPlacesCities` | 座城市 | **城市**(`zh_CN.json:1990` bare `"cities"` 键,用法是 `{{n}} {{$t('cities')}}` 拼句,不含"座") | 按 json 改为「城市」 |
| `photosPlacesCountries` | 个国家 | **国家**(`:2002` bare `"countries"`,同样拼句用法) | 按 json 改为「国家」 |
| `photosPlacesCityCount` | {n} 座城市 | **{n} 个城市**(`:2084` `"{n} cities"`,`PhotosPlacesView.vue:791` 实际调用点) | 按 json 改为「{n} 个城市」 |
| `photosPlacesThemeSand` | 沙色(brief 标"zh 自拟") | **沙滩**(json 确有 `"Sand": "沙滩"` 词条,并非缺失) | 按 json 改为「沙滩」,brief 的"自拟"标注有误 |
| `photosPlacesThemeMono` | 黑白(brief 标"zh 自拟") | **单色**(json 确有 `"Mono": "单色"` 词条,并非缺失) | 按 json 改为「单色」,brief 的"自拟"标注有误 |
| `photosPlacesResetView` | 复位视图 | **重置视图**(`"Reset view": "重置视图"`) | 按 json 改为「重置视图」 |

**顺带核实但无出入(brief 表格标"自拟"但 json 实际已有词条,值恰好与 brief 相同,值不用改,仅纠正"自拟"标注)：**
- `photosPlacesThemeOcean`:json 确有 `"Ocean": "海洋"`,与 brief 给的「海洋」文字相同,值不改,只是这条不属于"自拟"。

**一条有意保留的分歧(不是回源纠正,是术语一致性决定,已在代码注释里写明理由)：**
- `photosPlacesCurrentTrip`:json 里裸 `"Current trip"` 的原译是「本次旅行」,但同页 `photos.places.mapFilter.currentTripOnly` 的译文是「只看**当前行程**」——旧仓这两句本身用词不统一。本期 Global Constraints 明文把「当前行程」列为本期术语表的四个词之一,因此按术语条目统一用「当前行程」,不回退成 json 的「本次旅行」(否则同一页面会同时出现"当前行程"/"本次旅行"两种说法)。已在 `zh_cn.ts` 内联注释登记这条不是疏漏。

**确认为真自拟(json 里确实查无该英文原文,brief 标注准确)：**
- 六个大洲键(`photosPlacesRegionAsia/Americas/Europe/Africa/Oceania/Antarctica`):对 `Asia`/`Americas`/`Europe`/`Africa`/`Oceania`/`Antarctica` 逐一查 `zh_CN.json`/`en_US.json`,zh/en 均 `MISSING`。且 `PhotosPlacesView.vue` 未搜到这几个继承自后端 `regionLabels` 的字面调用点(后端字段,前端没走 i18n)。brief"偏离登记 3 / zh 自拟"准确,直接采用给定文案。
- `photosPlacesEmpty` / `photosPlacesEmptyHint` / `photosPlacesSearchEmpty` / `photosPlacesLoadFailed` / `photosPlacesRetry`:Vue2 里查无这五句(空态/加载失败/重试均只有裸 UI 没有文案,或该功能 New-UI 才补的错误态),brief"New-UI 补齐"准确,直接采用给定文案。

**其余全部条目**(`photosPlaces`/`Filters`/`TimeRange`/`StartDate`/`EndDate`/`MinPhotos`/`Region`/`CurrentTripOnly`/`FilterReset`/`FilterDone`/`Any`/`AtLeast`/`All`/`MapTheme`/`MapThemePresets`/`MapThemeCustom`/`LandDotColor`/`CityLightColor`/`ThemeDefault`/`ThemeDescDefault/Ocean/Sand/Mono`/`ZoomIn`/`ZoomOut`/`Photos`/`PhotoCount`/`SearchPlaceholder`)逐条比对 json,与 brief 给定文案**完全一致**,未改动。

## 可复用键的 grep 结果与决定

- `grep -n "photosReset\|photosPeoplePhotosCount\|photosCancel\|photosClose" src/i18n/zh_cn.ts`:
  - `photosCancel: '取消'`(zh_cn.ts:555)/ `Cancel`
  - `photosClose: '关闭'`(:569)/ `Close`
  - `photosReset: '复位'`(:573)/ `Reset` —— 用于 `PhotoImageViewer.vue` 的图片查看器"复位变换"按钮,与地图"复位/重置视图"是完全不同的功能域(图片平移缩放 vs 地图相机),**不复用**;地点域另开 `photosPlacesResetView`。
  - `photosPeoplePhotosCount: '{n} 张照片'`(:800)/ `{n} photos` —— 文案字面与新增 `photosPlacesPhotoCount` 相同,但按任务书 Ambiguity #3 与 P5 惯例(地点/人物域刻意分键,便于各自改文案不互相牵连),**不复用**,新开 `photosPlacesPhotoCount`。
  - `photosCancel`/`photosClose` 在本任务的键表(mapFilter/mapTheme 两组)里**没有对应的取消/关闭按钮场景**——filter 面板用的是各自的 `photosPlacesFilterReset`(重置)/`photosPlacesFilterDone`(完成),不是通用 Cancel/Close。这两个键留给后续 T9/T10(cover/spot 嵌套组,brief 提到但本任务不覆盖)按各自场景判断是否复用,不属于本任务需要处理的范围。
- 另确认 `photosRetry`(无域前缀的泛用重试键)**不存在**;本仓惯例是每个功能域各开一个 `<Domain>Retry` 键(`filesUploadRetry`/`appWidgetRetry`/`appsStoreRetry`/`appsSourcesRetry`/`photosPersonRetry` 均如此),因此新增 `photosPlacesRetry`,不引入违反惯例的泛用键。

## 追加的 parity 断言

`src/i18n/parity.test.ts` 末尾追加 `describe('photosPlaces 键(SP7-P6a)', …)`,含两条:
1. `regionLabelKey` 返回的六个大洲键在 `zh`/`en`(该文件实际的默认导出变量名,不是 brief 示例里错写的 `zh_cn`/`en_us`)里都存在。动态 `await import('../photos/util/placesMap')` 在本仓 vitest(v4.1.9,Vite 原生 ESM)下正常工作,测试实跑通过,未改用静态 import。
2. 扫描所有 `photosPlaces*` 前缀的中文文案,断言不含「簇」「聚类」「气泡」。

两条断言在 `pnpm exec vitest run src/i18n/parity.test.ts` 下均 PASS。

## 键序一致性与去重自检(程序化输出)

```
$ diff <(grep -o "photosPlaces[A-Za-z]*:" src/i18n/zh_cn.ts) <(grep -o "photosPlaces[A-Za-z]*:" src/i18n/en_us.ts) && echo "键序一致"
键序一致

$ grep -o "photosPlaces[A-Za-z]*:" src/i18n/zh_cn.ts | sort | uniq -d
(空,无重复)

$ grep -o "photosPlaces[A-Za-z]*:" src/i18n/en_us.ts | sort | uniq -d
(空,无重复)

$ grep -c "photosPlaces[A-Za-z]*:" src/i18n/zh_cn.ts
47
```

## 测试结果

- `pnpm exec vitest run src/i18n/` → 3 files / 18 tests,全 PASS(含新增两条断言)。
- `pnpm exec vue-tsc --noEmit` → exit 0,无输出。
- `pnpm exec vitest run`(全量)→ **272 files / 2322 tests,全 PASS**(基线 272 文件/2320 测试 + 本次新增 2 条断言 = 2322,吻合,无既有测试被弄红)。控制台里出现的两条 `Error: Not implemented: navigation (except hash changes)` 是 `src/photos/stores/__tests__/favorites.test.ts` 里既有的 jsdom 噪音(`location.href =` 在 jsdom 下的已知限制),与本任务改动无关,测试本身仍标记为通过。

## 改动的文件

- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/i18n/zh_cn.ts`(段末追加 47 键 + 说明注释)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/i18n/en_us.ts`(同上,英文注释)
- `/home/nimo/NimoTech/.sp7/NimoOS-New-UI/src/i18n/parity.test.ts`(末尾追加 P6a 专用 describe 块)

## Fix 追加(协调者裁定:`photosPlacesCurrentTrip` 改回 json 原文)

协调者对 6 处回源纠正逐条核过 `zh_CN.json`,确认全部正确。同时裁定报告里标为"有意保留"的
`photosPlacesCurrentTrip` 待决项**不成立**——那是协调者本人在 brief 里凭印象写的术语表条目,
没有回源核对,是与"Sand/Mono 误标自拟"同类的第四处错误(T1/T2/T3 各纠正过一处同类错误)。
本项目"界面严格 1:1"的用户约定权威高于 brief 的术语表,裁定按 json 原文办:

1. **`photosPlacesCurrentTrip` 的 zh 从「当前行程」改回「本次旅行」**(`zh_CN.json` 裸键
   `Current trip` 的原译),`en` 不受影响(`Current trip`)。
2. `photosPlacesCurrentTripOnly` 保持不变仍是 json 原文「只看当前行程」(mapFilter 嵌套键,
   本来就没被这条术语表污染过)。
3. 在两个键各自的位置追加注释,登记"Vue2 对同一概念(当前行程)在扁平键与嵌套键之间本身就有
   两种不同中文说法(本次旅行 / 只看当前行程),按 1:1 铁律两处照原样保留,不擅自统一;若产品
   决定统一措辞,两处需一起改"——防止后来人误判成漏改。`en_us.ts` 同位置也加了一条简短英文
   注释指回这条(英文两处本来就一致,不受影响,加注释只是留档)。

**第 3 步自查结果(逐一比对本任务全部 47 个 json 有源键与 `zh_CN.json`/`en_US.json` 实际值,
程序化核对,不靠人工目测)：**

写了一个脚本,对本次新增的、有 json 对应词条的全部 34 个键(除 6 个自拟大洲键 + 5 个 New-UI
补齐键 + `photosPlacesCurrentTrip` 单独已处理外),逐一从 `zh_CN.json`/`en_US.json` 按 brief
标注的路径取值,与 `zh_cn.ts`/`en_us.ts` 里的实际字面量做逐字比较。结果:

```
no mismatches -- all json-sourced keys match json exactly
```

即:除已处理的 `photosPlacesCurrentTrip` 外,**没有发现第二处"照 brief 术语表而非 json 原文"
的键**——包括协调者点名怀疑的「地点」「城市」「大洲」几个词:
- `photosPlaces`("地点")、`photosPlacesCities`("城市")、`photosPlacesCountries`("国家")、
  `photosPlacesRegion`("区域")均已在第一版核对中改到与 json 逐字一致,复查无误。
- 「大洲」本身不是键值而是中文词汇描述,六个大洲标签键(`photosPlacesRegionAsia` 等)在
  `zh_CN.json`/`en_US.json` 里确认两侧都无 `Asia`/`Americas`/... 任何词条(第一版报告已列出
  查证结果),不存在"json 原文被术语表覆盖"的可能,自拟成立不用改。
- 「拍摄点」一词未出现在本任务(T4)新增的任何键里——它属于 `photos.places.spot.*` 嵌套组,
  在 brief 的范围声明里明确是 T4 不覆盖的六组之一(spot/cover/coverTab/insight 留给后续
  T5-T11),T4 没有引用这个词,无需处理。

## 顾虑

1. ~~`photosPlacesCurrentTrip` 的中文文案有意不等于 json 原文~~ —— **已由协调者裁定推翻并修复(见上面"Fix 追加"一节)**:改回 json 原文「本次旅行」,不再是待决顾虑。
2. Brief 里 6 处"自拟"标注经核实有误(`Sand`/`Mono`/`Ocean` json 里其实都有词条),已按 json 实际值改正并在代码注释与本报告标出,供后续任务(T5-T11)复核 brief 其余表格时参考——这类"标了自拟但其实有原文"的错误连同 fix 里的 `Current trip` 术语表错误,一共在本份 brief 里出现了至少 7 处"未回源凭印象写"的情况,建议 T5-T11 的实现者对各自 brief 表格逐条独立核对,不要预设 brief 是权威。
3. `photosPlacesCities`/`photosPlacesCountries`/`photosPlacesCityCount` 三处的纠正依赖对 `PhotosPlacesView.vue` 里 `$t('cities')`/`$t('countries')`/`$t('{n} cities')` 具体调用点(:766-767, :791, :1048, :1051)的回查——纯查 json 键值本身不够,因为同一个词根在旧仓存在"裸词"(`cities`→"城市")与"整句模板"(`{n} cities`→"{n} 个城市")两种不同键,brief 表格把两者的文案弄混了(裸词条目错填了整句模板该有的"座/个"量词)。T5/T6 等消费方引用 `photosPlacesCities` 时注意它是**不带量词的裸名词**("城市"),需要配合外部的数字一起渲染成"12 城市"这种格式,不要预期它自带"座"字。
4. `photosPlacesCurrentTrip`("本次旅行")与 `photosPlacesCurrentTripOnly`("只看当前行程")两个键字面上都含"当前行程/本次旅行"这个概念但措辞不统一,是 Vue2 的真实现状,已照 1:1 铁律原样保留并加注释登记,不是本任务遗留的不一致。T5-T11 消费这两个键时按各自出现位置对应取用,不要把两者当作同义词互换。
