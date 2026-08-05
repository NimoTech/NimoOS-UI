### Task 9: i18n 54 键 + `dateRange.ts`

**Files:**
- Create: `src/photos/util/dateRange.ts`
- Create: `src/photos/util/__tests__/dateRange.test.ts`
- Modify: `src/i18n/zh_cn.ts` / `en_us.ts`(在 T1/T8 追加的键之后继续追加,不重排)
- Read-only 参考: `PhotosSearchView.vue:615-655`(isoDate / dateInRange / quickRange / rangeLabel)、`:518-544`(calMonthLabel / calCells / calDows)

**Interfaces:**
- Consumes: 无(叶子)
- Produces:
  ```ts
  export interface DateRange { label: string; start: string; end: string | null }  // 'YYYY-MM-DD'
  export function isoDate(d: Date): string
  export function dateInRange(takenAt: string | null | undefined, range: DateRange | null): boolean
  export type QuickKey = 'today' | 'last7' | 'last30' | 'thisYear' | 'lastYear'
  export const QUICK_KEYS: readonly QuickKey[]
  export const QUICK_LABEL_KEYS: Record<QuickKey, string>       // → i18n 键
  export function quickRange(key: QuickKey, now: Date, label: string): DateRange
  export function yearRange(year: number, label: string): DateRange
  export function rangeLabel(start: string, end: string, locale: string): string
  export interface CalCell { blank: boolean; d?: number; date?: string; in?: boolean; start?: boolean; end?: boolean }
  export function calCells(year: number, month: number, range: DateRange | null): CalCell[]
  export function calDowLabels(locale: string): string[]         // 7 个,周日起
  export function calMonthLabel(year: number, month: number, locale: string): string
  ```

**结构规格:**

1. **`isoDate` 照搬 `:617-619`**(本地时区、零填充);连注释一起搬(「calendar/range comparisons stay in the user's timezone, matching how dates are displayed」)。
2. **`dateInRange` 照搬 `:622-629`**:无 range 或无 `start` → `true`(不过滤);`takenAt` 缺或 `isNaN` → **`false`**(照搬 —— 有日期过滤时,没有拍摄时间的资产被排除);`hi = range.end || range.start`;字符串字典序比较(`'YYYY-MM-DD'` 定长,字典序 == 日期先后,**注释写明这点,同 P6a 的 timeFilter 结论**)。
3. **`quickRange` 重构自 `:632-648`**:Vue2 用英文 label 字符串当分支判据(`case 'Today'`),i18n 化后那个字符串会变中文 ⇒ **必须改成枚举 key 分支**。签名 `quickRange(key, now, label)`:`label` 由调用方用 `t(QUICK_LABEL_KEYS[key])` 算好传进来(**纯函数不依赖 i18n**)。五个分支的算术逐字照搬:
   - `today`:`[today, today]`
   - `last7`:`start = today - 6 天`(**是 6 不是 7**,含今天共 7 天)
   - `last30`:`start = today - 29 天`
   - `thisYear`:`[当年 1 月 1 日, today]`(**结束是今天不是 12/31**)
   - `lastYear`:`[去年 1/1, 去年 12/31]`
   - `today` 的定义是 `new Date(now.getFullYear(), now.getMonth(), now.getDate())`(抹掉时分秒)。
4. **`yearRange(year, label)`**:Vue2 `:636-639` 把「纯 4 位数字 label」这一路混在 `quickRange` 里(`understood` 抽出年份 token 时会传 `'2026'`)。**拆成独立函数**,`[y/1/1, y/12/31]`。**偏离登记**(拆分是为了让 `quickRange` 的 key 类型收紧成 5 个枚举)。
5. **`rangeLabel` 重构自 `:650-655`**:Vue2 写死 `toLocaleDateString('en', { month: 'short', day: 'numeric' })`(§7e-4)。改 `Intl.DateTimeFormat(localeTag, { month: 'short', day: 'numeric' })`。
   **⚠ locale 必须转 BCP-47(T3 实施查实,plan 初稿漏了这层)**:本仓 i18n locale 标识是 `zh_cn` / `en_us`(**下划线**),不是合法 BCP-47 标签 ⇒ 直接把 `locale.value` 喂给 `Intl.DateTimeFormat()` / `Intl.NumberFormat()` / `toLocaleString()` 会抛 **`RangeError: Incorrect locale information provided`**。既定写法 `locale.value.replace('_', '-')`,**已有 5 处先例**:`relTime.ts:21`、`PlacesRail.vue:84`、`PersonHero.vue:113`、`PhotosPeople.vue:157`、`SmartViewCard.vue:38`。**并且要有测试钉住**,否则后人「清理」掉又抛。逻辑照搬:`start === end` → `` `${fmt(start)}, ${start.slice(0,4)}` ``;同年 → `` `${fmt(start)} – ${fmt(end)}, ${year}` ``;跨年 → `` `${fmt(start)} – ${fmt(end)}` ``(**跨年时 Vue2 确实不带年份 —— 这是 Vue2 的小瑕疵(跨年区间看不出年份),但改了会动视觉;照搬 + 注释登记**)。分隔符是 **en dash `–`** 不是 hyphen,逐字核。
6. **`calCells` 照搬 `:525-543`**:`firstDow = new Date(y, m, 1).getDay()`;前面填 `firstDow` 个 `{ blank: true }`;`daysInMonth = new Date(y, m+1, 0).getDate()`;每天算 `date = isoDate(...)`,`lo = range.start`、`hi = range.end || range.start`,`isStart = date === lo`、`isEnd = date === hi`、`inRange = date >= lo && date <= hi`。**`range` 为 null 或无 `start` 时三者全 false。**
7. **`calDowLabels(locale)`**(§7e-4 / 偏离登记 6):Vue2 写死 `['S','M','T','W','T','F','S']`。改成用 `Intl.DateTimeFormat(localeTag, { weekday: 'narrow' })` 对 1970-01-04(星期日)起的连续 7 天取值。**`locale` 入参同样要先过 `replace('_','-')`(见第 5 条的 BCP-47 说明)—— 三个跟 locale 的函数(`rangeLabel`/`calDowLabels`/`calMonthLabel`)统一在函数内部转,调用方传原始 locale 即可。****周首日仍固定周日**(与 `calCells` 的 `getDay()` 口径一致;**不引入 locale 的 firstDay 概念** —— 那会牵动 `calCells` 的填充算法,超出本期范围。**注释登记这个取舍**)。
8. **`calMonthLabel(y, m, locale)`**:`Intl.DateTimeFormat(localeTag, { year: 'numeric', month: 'long' })` 格式化 `new Date(y, m, 1)`(`localeTag` 同上,函数内部转)。
9. **i18n 键表**(**脚本生成,动手前逐条回源核**):

T9 —— 共 **54** 键

| New-UI 键 | Vue2 键(= en 值) | zh 值 |
|---|---|---|
| `photosSearchAlbums` | `Albums` | 相册 |
| `photosSearchApply` | `Apply` | 提交 |
| `photosSearchAskNimoSearchDifferently` | `Ask Nimo to search differently` | 让 Nimo 换个方式搜索 |
| `photosSearchClearAll` | `Clear all` | 清除全部 |
| `photosSearchDate` | `Date` | 日期 |
| `photosSearchDescribeReLookingPeople` | `Describe what you're looking for — people, places, scenes, or a whole sentence. Press ↵ to search.` | 描述你要找的内容——人物、地点、场景，或者一整句话。按 ↵ 搜索。 |
| `photosSearchFileType` | `File type` | 文件类型 |
| `photosSearchFindPhotos` | `Find photos: ` | 查找照片： |
| `photosSearchCouldnTFindPhotos` | `I couldn't find photos matching all your conditions. Try removing a filter, or describe what you're looking for in plain language and I'll search more broadly.` | 我没有找到符合所有条件的照片。可以尝试移除一个过滤条件，或者用自然语言描述你要找的内容，我会扩大搜索范围。 |
| `photosSearchLast30Days` | `Last 30 days` | 最近30天 |
| `photosSearchLast7Days` | `Last 7 days` | 最近7天 |
| `photosSearchLastYear` | `Last year` | 去年 |
| `photosSearchLoading` | `Loading more…` | 正在加载更多… |
| `photosSearchResultsCount` | `More results ({count})` | 更多结果（{count}） |
| `photosSearchNewest` | `Newest` | 最新 |
| `photosSearchNextMonth` | `Next month` | 下个月 |
| `photosSearchNimoUnderstood` | `Nimo understood:` | Nimo 理解为： |
| `photosSearchNoActiveFiltersSaves` | `No active filters — saves the raw query.` | 没有启用的过滤条件——将保存原始查询。 |
| `photosSearchNoLocationDataYet` | `No location data yet` | 暂无位置数据 |
| `photosSearchNoMatches` | `No matches` | 没有匹配结果 |
| `photosSearchNoPeopleDetectedYet` | `No people detected yet` | 尚未检测到人物 |
| `photosSearchNothingHereYet` | `Nothing here yet` | 暂无内容 |
| `photosSearchTypeOcr` | `OCR` | OCR |
| `photosSearchOldest` | `Oldest` | 最早 |
| `photosSearchOpenSmartViews` | `Open in Smart Views →` | 在智能视图中打开 → |
| `photosSearchPeople` | `People` | 人物 |
| `photosSearchTokPerson` | `person` | 人物 |
| `photosSearchBadgePhoto` | `Photo` | 照片 |
| `photosSearchTypePhotos` | `Photos` | 照片 |
| `photosSearchPlaces` | `Places` | 地点 |
| `photosSearchPreviousMonth` | `Previous month` | 上个月 |
| `photosSearchQuickRange` | `Quick range` | 快速范围 |
| `photosSearchRecentSearches` | `Recent searches` | 最近搜索 |
| `photosSearchRecent` | `Recent:` | 最近： |
| `photosSearchRelevance` | `Relevance` | 相关度 |
| `photosSearchSaveSmartView` | `Save as Smart View` | 保存为智能视图 |
| `photosSearchSaved` | `Saved` | 已保存 |
| `photosSearchSearchPeople` | `Search people…` | 搜索人物… |
| `photosSearchSearchLibrary` | `Search your library` | 搜索你的资料库 |
| `photosSearchSearchLabel` | `Search {label}…` | 搜索{label}… |
| `photosSearchSort` | `Sort by` | 排序 |
| `photosSearchSunsets` | `sunsets` | 日落 |
| `photosSearchTextMatch` | `Text match` | 文本匹配 |
| `photosSearchYear` | `This year` | 今年 |
| `photosSearchTokTime` | `time` | 时间 |
| `photosSearchToday` | `Today` | 今天 |
| `photosSearchTopScoreScore` | `top score {score}` | 最高分 {score} |
| `photosSearchTokType` | `type` | 类型 |
| `photosSearchUnnamed` | `Unnamed` | 未命名 |
| `photosSearchBadgeVideo` | `Video` | 视频 |
| `photosSearchTypeVideos` | `Videos` | 视频 |
| `photosSearchCountMatches` | `{count} matches` | {count} 条匹配 |
| `photosSearchCountResultsSecondsS` | `{count} results · {seconds}s` | {count} 条结果 · {seconds}秒 |
| `photosSearchNameSavedSmartView` | `“{name}” saved as a Smart View` | “{name}”已保存为智能视图 |

10. **`QUICK_LABEL_KEYS` 映射**:`today` → `photosSearchToday`、`last7` → `photosSearchLast7Days`、`last30` → `photosSearchLast30Days`、`thisYear` → `photosSearchThisYear`、`lastYear` → `photosSearchLastYear`。**动手前用上表核对这 5 个键名的真实拼写**(脚本生成的名字可能与此处不同,**以表为准并改这里**)。
11. **复用不重加**:`photosCancel`(取消)、`photosClose`(关闭)、T1 已加的 `photosSvCancel` 等 —— **搜索侧凡与 T1 已加的键 zh 值相同且语义一致,直接复用 T1 的键,不再新增**(上表已排除 T1 已覆盖的)。

- [ ] **Step 1: 写失败测试**

必含用例:
- `isoDate(new Date(2026, 0, 5))` → `'2026-01-05'`(零填充两处)。
- `dateInRange`:range 为 null → true;range 无 start → true;`takenAt` 为 null → **false**;`takenAt` 是坏串 → **false**;单日区间(`end: null`)命中当天 / 不命中前后一天;跨日区间的两个端点都算命中(闭区间)。
- `quickRange('today', new Date(2026,6,31,15,30), 'X')` → `{ start: '2026-07-31', end: '2026-07-31' }`(**时分秒被抹掉**)。
- `quickRange('last7', new Date(2026,6,31), 'X')` → start `'2026-07-25'`(**31-6=25,不是 24**)。
- `quickRange('last30', …)` → start `'2026-07-02'`(**31-29=2**)。
- `quickRange('thisYear', new Date(2026,6,31), 'X')` → `{ start: '2026-01-01', end: '2026-07-31' }`(**end 是今天**)。
- `quickRange('lastYear', new Date(2026,6,31), 'X')` → `{ start: '2025-01-01', end: '2025-12-31' }`。
- **跨月/跨年边界**:`last7` 在 `new Date(2026,0,3)`(1月3日)→ start `'2025-12-28'`。
- `yearRange(2025, 'X')` → `{ start: '2025-01-01', end: '2025-12-31' }`。
- `rangeLabel('2026-03-14','2026-03-14','en_us')` → 含 `'2026'` 且**不含** `'–'`;`('2026-03-14','2026-03-22','en_us')` → 含 `'–'` 且含 `'2026'`;`('2025-12-30','2026-01-02','en_us')` → 含 `'–'` 且**不含** `'2026'`(跨年不带年份,照搬的瑕疵);`locale` 传 `'zh_cn'` 与 `'en_us'` 结果**不同**(§7e-4 守卫)。
- `calCells(2026, 6, null)`(2026 年 7 月,1 日是周三)→ 前 3 个 blank,之后 31 个非 blank,总 34;所有 `in`/`start`/`end` 都 falsy。
- `calCells(2026, 6, { start:'2026-07-10', end:'2026-07-12', label:'' })` → `2026-07-10` 的 cell `start` 真、`in` 真;`07-11` 只有 `in` 真;`07-12` `end` 真、`in` 真;`07-09` 三者全假。
- 单日区间(`end: null`)→ 该天 `start` 与 `end` **都真**(Vue2 `hi = end || start` 的结果,**这条钉住 `.cal-cell.start.end` 那条 CSS 的触发条件**)。
- 二月闰年:`calCells(2024, 1, null)` 的非 blank 数为 29;`calCells(2026, 1, null)` 为 28。
- `calDowLabels('en_us')` 长度 7、首项是周日的窄标签;`calDowLabels('zh_cn')` 与 `en_us` **不同**(§7e-4 守卫)。
- `calMonthLabel(2026, 6, 'en_us')` 含 `'2026'`;`zh_cn` 与 `en_us` 结果不同。

- [ ] **Step 2: 跑测试确认失败** — `pnpm exec vitest run src/photos/util/__tests__/dateRange.test.ts`

- [ ] **Step 3: 实现 + 追加 54×2 个 i18n 键**

- [ ] **Step 4: 跑测试 + parity + tsc,逐个删码验证**

Run: `pnpm exec vitest run src/photos/util/__tests__/dateRange.test.ts src/i18n/parity.test.ts && pnpm exec vue-tsc --noEmit`

删码清单:①`last7` 的 `- 6` 改成 `- 7` → last7 用例红;②`thisYear` 的 end 改成 12/31 → thisYear 用例红;③`today` 的抹时分秒 → today 用例红;④`dateInRange` 的 `isNaN` 分支 → 坏串用例红;⑤`hi = end || start` 的 `|| start` → 单日区间用例红;⑥`rangeLabel` / `calDowLabels` / `calMonthLabel` 的 `locale` 参数换成写死 `'en'` → 三条 locale 用例红;⑦`calCells` 的 blank 填充 → 前 3 个 blank 用例红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/util/dateRange.ts src/photos/util/__tests__/dateRange.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): P7a-T9 搜索 54 i18n 键 + 日期区间/日历纯函数(跟 locale)"
```

---

