### Task 1: i18n 115 键 + `smartViewSuggest.ts` + `relTime.ts`

**Files:**
- Create: `src/photos/util/smartViewSuggest.ts`
- Create: `src/photos/util/__tests__/smartViewSuggest.test.ts`
- Create: `src/photos/util/relTime.ts`
- Create: `src/photos/util/__tests__/relTime.test.ts`
- Modify: `src/i18n/zh_cn.ts`(在 `photosPlacesInsightHomeBase`(现 `:1134`)之后追加)
- Modify: `src/i18n/en_us.ts`(同位置追加,键序必须与 zh 逐字节一致)
- Read-only 参考: `PhotosSmartViewsView.vue:195-242`(POOL + TEMPLATES + inferChips)、`PhotosSmartViewDetail.vue:262-269`(relTime)、`:334-343`(condSuggestions)

**Interfaces:**
- Consumes: 无(本任务是叶子)
- Produces:
  ```ts
  // smartViewSuggest.ts
  export interface SuggestRow { kw: string[]; chips: string[] }
  export const SV_SUGGEST_POOL: readonly SuggestRow[]          // 20 行,逐字照搬
  export function inferChips(text: string): string[]           // 最多 8 条,去重,保序
  export interface QuickTemplate { labelKey: string; descKey: string; thresh: number }
  export const SV_QUICK_TEMPLATES: readonly QuickTemplate[]    // 5 行
  export const COND_SUGGESTIONS: readonly string[]             // 12 条
  export function condSuggestionsFor(existing: string[]): string[]  // 排掉已有,最多 8 条

  // relTime.ts
  export function relTime(
    iso: string | null | undefined,
    now: number,
    t: (key: string, params?: Record<string, unknown>) => string,
    locale: string,
  ): string
  ```

**结构规格:**

1. **`SV_SUGGEST_POOL` 逐字照搬 `PhotosSmartViewsView.vue:198-219`(20 行)。** 那段上方的注释「Every chip here must be executable by the backend parser (svparser.go): scene:/object: (CLIP semantic), ocr:, place:, person names, and date forms. Anything else gets silently dropped server-side — never suggest those.」**必须一起搬过来**(它是后端契约,不是废话)。**chips 的值不进 i18n**(`scene: sunset` / `place: Japan` / `Lily` 这些是要发给后端 parser 的字面量,翻译了后端就不认;`kw` 是匹配用户输入的英文关键词,同理)。**写一行注释登记这个判断。**
2. **`inferChips(text)` 照搬 `:229-242`**:空/假值 → `[]`;`text.toLowerCase()`;遍历 POOL,`row.kw.some(k => t.includes(k))` 命中则把该行 chips 逐条加入(`Set` 去重、保持首次出现顺序);末尾 `.slice(0, 8)`。
3. **`SV_QUICK_TEMPLATES` 照搬 `:221-227`,但 label/desc 换成 i18n 键名**(Vue2 存英文原文再 `$t(t.label)`,New-UI 直接存键):
   | labelKey | descKey | thresh |
   |---|---|---|
   | `photosSvFamilyWeekends` | `photosSvFamilyWeekendsPark` | 75 |
   | `photosSvBestLastMonth` | `photosSvBestPhotosLast30` | 88 |
   | `photosSvSunsetsRoad` | `photosSvSunsetsWhileTravelingNot` | 80 |
   | `photosSvReceiptsFile` | `photosSvReceiptsInvoicesAmount` | 65 |
   | `photosSvPetPortraits` | `photosSvSharpDogCatPortraits` | 85 |
   **⚠ 陷阱**:Vue2 `useTemplate(t)`(`:413-419`)拿 `t.desc`(**英文原文**)喂 `inferChips`。New-UI 存的是键,**不能拿键去 `inferChips`**。改法:`QuickTemplate` 再加一个 `descEn: string` 字段存英文原文专供 `inferChips`,并写注释说明「`descKey` 给界面显示、`descEn` 给 `inferChips` 匹配 —— POOL 的 `kw` 是英文,拿中文描述匹配恒不中」。**这是 T5 必须接住的契约,`Produces` 块里已列。**
4. **`COND_SUGGESTIONS` 照搬 `PhotosSmartViewDetail.vue:336-341` 的 12 条** `['year: 2026','year: 2025','captured: last 30 days','place: Japan','scene: sunset','scene: landscape','scene: food','scene: portrait','object: dog','ocr: receipt','scene: travel','scene: city at night']`,连上方注释「只推荐后端 svparser 真实支持的条件」。`condSuggestionsFor(existing)` = `COND_SUGGESTIONS.filter(c => !existing.includes(c)).slice(0, 8)`。**`year: 2026` / `year: 2025` 是写死年份 —— 与 §7c-1 的 `This year` 同类问题,但这里是「建议列表」不是「过滤判据」**:一个 2027 年的用户看到「year: 2026」只是个不那么有用的建议,不会算错结果。**照搬 + 注释登记为已知瑕疵,不改**(改成动态年份会让 `COND_SUGGESTIONS` 从常量变成函数,牵动 T7 的契约,收益不抵成本)。
5. **`relTime` 照搬 `PhotosSmartViewDetail.vue:262-269` 的三档,但修两处**:
   - Vue2 用 `Date.now()`,New-UI 把 `now` 作参数传入(**可测,不用 fake timer**)。
   - Vue2 第三档 `d.toLocaleDateString()` 无 locale 参数 ⇒ 跟浏览器 locale。改成 `new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(d)`(**§7e-4 / 偏离登记 6**)。
   - 三档判据照搬:`diff < 3600` → `t('photosSvRelMinutes', { n: Math.max(1, Math.round(diff / 60)) })`;`diff < 86400` → `t('photosSvRelHours', { n: Math.round(diff / 3600) })`;否则绝对日期。`diff` 单位是秒:`(now - d.getTime()) / 1000`。
   - `!iso` → `''`(照搬)。**`iso` 是坏串(`new Date('x')` → `Invalid Date`)时 Vue2 会渲染 `Invalid Date` 给用户** —— 加 `Number.isNaN(d.getTime())` → 返 `''`(**新增守卫,注释登记**)。
6. **i18n 键表**(**由脚本从 `zh_CN.json` / `en_US.json` 抽取生成,动手前逐条回源核**):

T1 —— 共 **115** 键

| New-UI 键 | Vue2 键(= en 值) | zh 值 |
|---|---|---|
| `photosSvNameSnapshotSavedAlbum` | `"{name}" snapshot saved as a new album` | 「{name}」的快照已保存为新相册 |
| `photosSvAddedThisWeek` | `+{n} this week` | 本周 +{n} |
| `photosSvActOneMatched` | `<b>1 new photo</b> auto-added` | <b>1 张新照片</b> 已自动添加 |
| `photosSvActNMatched` | `<b>{n} new photos</b> auto-added` | <b>{n} 张新照片</b> 已自动添加 |
| `photosSvActivity` | `Activity` | 活动 |
| `photosSvAdd` | `Add` | 添加 |
| `photosSvAddAnother` | `Add another…` | 添加另一个… |
| `photosSvAddCondition` | `Add condition` | 添加条件 |
| `photosSvAllMatches` | `All matches` | 全部匹配 |
| `photosSvAllSmartViews` | `All Smart Views` | 所有智能视图 |
| `photosSvThreshHelp` | `At {pct}%, expect ~<b>{n}</b> new photos per week.` | 阈值 {pct}% 时，预计每周新增约 <b>{n}</b> 张照片。 |
| `photosSvAutoAddMatches` | `Auto-add new matches` | 自动添加新匹配 |
| `photosSvAutoAddMatchesPhotos` | `Auto-add new matches as photos arrive` | 有新照片匹配时自动加入 |
| `photosSvAutoAddWhenScore` | `Auto-add when score ≥` | 匹配分 ≥ 时自动添加 |
| `photosSvBalanced` | `Balanced` | 平衡 |
| `photosSvBalancedHealthyMixCertainty` | `Balanced — a healthy mix of certainty and recall.` | 均衡 —— 准确率与召回率兼顾。 |
| `photosSvBestLastMonth` | `Best of last month` | 上月精选 |
| `photosSvBestPhotosLast30` | `Best photos from the last 30 days` | 最近 30 天的最佳照片 |
| `photosSvCancel` | `Cancel` | 取消 |
| `photosSvCandidatesThreshold` | `candidates at this threshold` | 在此阈值下的候选 |
| `photosSvChangeSmartViewName` | `Change the Smart View name` | 修改智能视图名称 |
| `photosSvClickRename` | `Click to rename` | 点击重命名 |
| `photosSvClose` | `Close` | 关闭 |
| `photosSvConditions` | `Conditions` | 条件 |
| `photosSvConditionsSettingsUpdated` | `Conditions or settings updated` | 条件或设置已更新 |
| `photosSvCopyQuerySv` | `Copy the query as a new SV` | 将查询复制为新的智能视图 |
| `photosSvCreateSmartView` | `Create Smart View` | 创建智能视图 |
| `photosSvDelete` | `Delete` | 删除 |
| `photosSvDeleteName` | `Delete "{name}"?` | 删除「{name}」？ |
| `photosSvDeleteSmartView` | `Delete Smart View` | 删除智能视图 |
| `photosSvDescribePlainEnglishConditions` | `Describe it in plain English — conditions are inferred below` | 用自然语言描述——下方会自动推断出条件 |
| `photosSvDescribeWantSetQuality` | `Describe what you want, set a quality threshold, and Nimo keeps it filled.` | 描述你想要的内容，设置质量阈值，Nimo 会持续为你填充。 |
| `photosSvDone` | `Done` | 完成 |
| `photosSvDownloadZip` | `Download as ZIP` | 下载为 ZIP |
| `photosSvDuplicate` | `Duplicate` | 复制 |
| `photosSvDuplicatedNameOpenCopy` | `Duplicated "{name}" — open the new copy from the list` | 已复制「{name}」——可在列表中打开新副本 |
| `photosSvEGSaraTokyo` | `e.g. Sara · Tokyo · sunsets` | 例如:Sara · 东京 · 日落 |
| `photosSvEGSceneSunset` | `e.g. scene: sunset` | 如 scene: sunset |
| `photosSvExport` | `Export` | 导出 |
| `photosSvExportFailed` | `Export failed` | 导出失败 |
| `photosSvExportedDetail` | `Exported as {detail}` | 已导出为 {detail} |
| `photosSvFamilyWeekends` | `Family weekends` | 家庭周末 |
| `photosSvFamilyWeekendsPark` | `Family weekends in the park` | 在公园度过的家庭周末 |
| `photosSvExportFile` | `file` | 文件 |
| `photosSvIncludeVideos` | `Include videos` | 包含视频 |
| `photosSvKeepLive` | `Keep it live` | 保持实时更新 |
| `photosSvLastUpdate` | `Last update` | 最近更新 |
| `photosSvLastUpdatedTime` | `Last updated {time}` | 最近更新 {time} |
| `photosSvLive` | `Live` | 即时生效 |
| `photosSvLivePreview` | `Live preview` | 实时预览 |
| `photosSvLoose` | `Loose` | 宽松 |
| `photosSvLooseExpectSomeFalse` | `Loose — expect some false positives.` | 宽松 —— 可能出现一些误判。 |
| `photosSvMatchAgainstVideoKeyframes` | `Match against video keyframes` | 匹配视频关键帧 |
| `photosSvMatchScoreDistribution` | `Match score distribution` | 匹配分数分布 |
| `photosSvMayIncludeFalsePositives` | `May include false positives.` | 可能包含误判。 |
| `photosSvMayMissBorderlineMatches` | `May miss borderline matches.` | 可能漏掉边缘匹配。 |
| `photosSvMedianMatch` | `Median match` | 匹配中位数 |
| `photosSvName` | `Name` | 名称 |
| `photosSvNew` | `New` | 新 |
| `photosSvNewCondition` | `New condition` | 新条件 |
| `photosSvNewSmartView` | `New Smart View` | 新建智能视图 |
| `photosSvNimoSuggests` | `Nimo suggests` | Nimo 建议 |
| `photosSvStartTemplate` | `Or start from a template` | 或从模板开始 |
| `photosSvPause` | `Pause` | 暂停 |
| `photosSvPauseAutoUpdates` | `Pause auto-updates` | 暂停自动更新 |
| `photosSvPaused` | `Paused` | 已暂停 |
| `photosSvPausedUploadsNotAdded` | `Paused — new uploads will not be added` | 已暂停 —— 新上传的照片不会被添加 |
| `photosSvPetPortraits` | `Pet portraits` | 宠物写真 |
| `photosSvPhotosStayLibrary` | `Photos stay in your library` | 照片仍保留在你的图库中 |
| `photosSvPhotosCount` | `photos_count` | 张照片 |
| `photosSvPreparingZipNPhotos` | `Preparing ZIP — {n} photos` | 正在打包 ZIP —— {n} 张照片 |
| `photosSvPressEnterAddPick` | `Press {enter} to add. Or pick a suggestion above.` | 按 {enter} 添加。或从上方选择一个建议。 |
| `photosSvQualityThreshold` | `Quality threshold` | 质量阈值 |
| `photosSvReceiptsInvoicesAmount` | `Receipts and invoices with an amount` | 带金额的收据和发票 |
| `photosSvReceiptsFile` | `Receipts to file` | 待归档的收据 |
| `photosSvRecentlyAdded` | `Recently added` | 最近添加 |
| `photosSvRefineSearch` | `Refine in Search` | 在搜索中细化 |
| `photosSvRemoveCondition` | `Remove condition` | 移除条件 |
| `photosSvRemoveC` | `Remove: {c}` | 移除：{c} |
| `photosSvRename` | `Rename` | 重命名 |
| `photosSvResume` | `Resume` | 恢复 |
| `photosSvResumeAutoUpdates` | `Resume auto-updates` | 恢复自动更新 |
| `photosSvRunEveryUpload` | `Run on every new upload` | 每次新上传都运行 |
| `photosSvSaveStaticAlbum` | `Save as static Album` | 保存为静态相册 |
| `photosSvSavedSearchKeepsItself` | `Saved search that keeps itself up to date` | 已保存的搜索会自动保持最新 |
| `photosSvSavedSearchesStayLive` | `Saved searches that stay live. Nimo continuously evaluates new photos and adds matches that score above your threshold.` | 持续生效的保存搜索。Nimo 会不断评估新照片，把分数超过阈值的都加进来。 |
| `photosSvSettingsSection` | `Settings` | 设置 |
| `photosSvSettingsAiBehavior` | `Settings · AI behavior` | 设置 · AI 行为 |
| `photosSvSharpDogCatPortraits` | `Sharp dog and cat portraits` | 清晰的猫狗写真 |
| `photosSvBadgeSmartView` | `Smart View` | 智能视图 |
| `photosSvSmartViewNameDeleted` | `Smart View "{name}" deleted` | 智能视图「{name}」已删除 |
| `photosSvSmartViewCreated` | `Smart View created` | 智能视图已创建 |
| `photosSvSmartViewRenamed` | `Smart View renamed` | 智能视图已重命名 |
| `photosSvSmartViews` | `Smart Views` | 智能视图 |
| `photosSvSmartViewsAutoUpdate` | `Smart Views auto-update is off` | 智能视图自动更新已关闭 |
| `photosSvSnapshotCurrentMatchesStops` | `Snapshot the current matches — stops updating` | 快照当前匹配 —— 停止更新 |
| `photosSvStats` | `Stats` | 统计 |
| `photosSvStorage` | `Storage` | 存储空间 |
| `photosSvStrict` | `Strict` | 严格 |
| `photosSvStrictOnlyHighestConfidence` | `Strict — only the highest-confidence matches.` | 严格 —— 只保留置信度最高的匹配。 |
| `photosSvSuggestions` | `Suggestions` | 建议 |
| `photosSvSunsetsRoad` | `Sunsets on the road` | 旅途中的日落 |
| `photosSvSunsetsWhileTravelingNot` | `Sunsets while traveling, not at home` | 旅行途中而非在家看到的日落 |
| `photosSvSunsetsSaraOurTokyo` | `Sunsets with Sara from our Tokyo trip last spring` | 去年春天在东京和 Sara 一起看的日落 |
| `photosSvSmartViewRemovedStops` | `The Smart View is removed and stops watching for new matches. The {n} photos in your library are untouched.` | 智能视图会被删除，不再监视新的匹配。图库中的 {n} 张照片不受影响。 |
| `photosSvTheseSavedSearchesStay` | `These saved searches stay visible but won't pick up new matches. Re-enable in` | 这些保存的搜索仍会显示，但不会再匹配新内容。可在以下位置重新开启 |
| `photosSvThisWeek` | `this week` | 本周 |
| `photosSvTotal` | `Total` | 总计 |
| `photosSvTypeConditionEG` | `Type a condition, e.g. scene: sunset` | 输入一个条件，如 scene: sunset |
| `photosSvNimoMatch` | `What should Nimo match?` | Nimo 应该匹配什么？ |
| `photosSvCurrentConditionsMatchExactly` | `Your current conditions match exactly — the threshold will kick in once you add a scene / object / free-text condition.` | 你当前的条件是精确匹配 —— 添加场景/物体/自由文本条件后阈值才会生效。 |
| `photosSvNNewThisWeek` | `{n} new this week` | 本周新增 {n} 个 |
| `photosSvNPhotosMbMb` | `{n} photos · ~{mb} MB` | {n} 张照片 · 约 {mb} MB |
| `photosSvRelHours` | `{n}h ago` | {n} 小时前 |
| `photosSvRelMinutes` | `{n}m ago` | {n} 分钟前 |

7. **明确复用不重加(zh 值逐字相同且语义一致)**:`photosCancel`(`zh_cn.ts:555` 取消)、`photosClose`(`:569` 关闭)、`photosDelete`(`:554` 删除)、`photosStorage`(存储空间)、`photosAlbumClickToRename`(点击重命名)、`photosFavExport`(下载为 ZIP)、`photosFavExportFailed`(导出失败)、`photosPeopleFacesOffLink`(设置 · AI 行为)。**上表已把这 8 条排除在外**;若发现表里仍有重复,以「复用既有键」为准并在报告里登记。
8. **⚠ 值相同但语义不同的三个陷阱,禁止复用**:①`'Albums'`(相册)**绝不能**复用 `photosTitle` —— 那是**相册区的区名**,值恰好也是「相册」;②`'Unnamed'`(未命名)不复用 `photosAlbumUntitled`(那是「未命名相册」语境);③`'Recently added'`(最近添加)不复用 `photosAlbumSortCreated`(那是排序选项标签)。这三条各自新增键。
9. **`photosSvSettingsSection` 的 zh 值刻意不取 json 原值**(偏离登记 10):`zh_CN.json['Settings']` 是「系统设置」,Vue2 右栏段标题直接用它 ⇒ 智能视图里出现「系统设置」= Vue2 文案 bug。本键 zh 取「设置」、en 取 `Settings`。**上表已按此给值。**
10. **`photosSvThreshHelp` 与两条活动流 matched 键含 `<b>`,本任务只负责把值原样写入两个 locale**;拆成 `<i18n-t>` 插槽的结构由 T8 决定(`{n}` 是插值位、`<b>` 正好包住它,可直接开槽,**不需要拆键**;`photosSvActOneMatched` 的 `<b>1 new photo</b>` 里 `1` 是静态的 ⇒ **这一条必须拆成主句 + 加粗词两个键**,T8 按需再加,本任务不预加)。

- [ ] **Step 1: 写失败测试**

`smartViewSuggest.test.ts` 必含用例:
- `SV_SUGGEST_POOL.length === 20`;每行 `kw` 与 `chips` 都非空数组。
- `inferChips('')` / `inferChips(undefined as unknown as string)` → `[]`。
- `inferChips('Sunsets with Sara in Tokyo')` → 依 POOL 顺序命中 `['scene: sunset','place: Japan','Sara']`(**按 POOL 定义顺序,不是查询里的出现顺序** —— 这条钉住「遍历 POOL 而非遍历 token」)。
- 大小写不敏感:`inferChips('SUNSET')` 与 `inferChips('sunset')` 同结果。
- 去重:构造一个能命中两行且两行有共同 chip 的输入,断言结果里该 chip 只一次。
- `.slice(0, 8)`:构造能命中 ≥9 条 chip 的输入(如把多行关键词串起来),断言长度恰为 8。
- `SV_QUICK_TEMPLATES.length === 5`;5 行的 `labelKey`/`descKey` 都能在 `zh_cn` 与 `en_us` 里查到(**导入两个 locale 对象直接查键存在**,这条能挡住键名笔误);`thresh` 依次为 `[75,88,80,65,85]`。
- **`descEn` 喂 `inferChips` 有效**:`inferChips(SV_QUICK_TEMPLATES[0].descEn)` 非空(家庭周末那条应命中 `scene: family gathering`);而 `inferChips(SV_QUICK_TEMPLATES[0].descKey)` 为空(**反向断言,钉住「不能拿键去匹配」这个陷阱**)。
- `COND_SUGGESTIONS.length === 12`;`condSuggestionsFor(['scene: sunset'])` 不含 `'scene: sunset'` 且长度 8;`condSuggestionsFor([])` 长度 8;`condSuggestionsFor(COND_SUGGESTIONS.slice(0,10) as string[])` 长度 2。

`relTime.test.ts` 必含用例(`t` 用 `(k, p) => k + JSON.stringify(p ?? {})` 这类可断言的假实现):
- `relTime('', 0, t, 'zh_cn')` → `''`;`relTime(null, …)` → `''`。
- **坏串** `relTime('not-a-date', Date.parse('2026-07-31'), t, 'zh_cn')` → `''`(新增守卫)。
- 30 秒前 → `photosSvRelMinutes` 且 `n === 1`(`Math.max(1, …)` 下界)。
- 90 分钟前 → `photosSvRelHours` 且 `n === 2`(`Math.round(5400/3600) = 2`)。
- 59 分钟前 → 还是 `photosSvRelMinutes`(`diff < 3600` 边界,3599 秒);3600 秒整 → `photosSvRelHours`(**边界两侧各一条**)。
- 86400 秒整 → 走绝对日期档(结果**不含** `photosSvRel`)。
- **locale 生效**:同一个 iso 传 `'zh_cn'` 与 `'en_us'` 得到**不同**字符串(月份表示不同)。这条钉住 §7e-4 的修复;**注意 jsdom 的 Intl 数据是完整的,这条能跑**。

`parity` 与 tsc 由全量门覆盖,本任务不额外写 i18n 测试。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/photos/util/__tests__/smartViewSuggest.test.ts src/photos/util/__tests__/relTime.test.ts`
Expected: FAIL(模块不存在)

- [ ] **Step 3: 实现两个 util + 追加 115×2 个 i18n 键**

- [ ] **Step 4: 跑测试 + parity + tsc,并逐个删码验证**

Run: `pnpm exec vitest run src/photos/util/__tests__/smartViewSuggest.test.ts src/photos/util/__tests__/relTime.test.ts src/i18n/parity.test.ts && pnpm exec vue-tsc --noEmit`

删码清单(一次只删一处,验完用 Edit 手工还原):①`inferChips` 的 `.slice(0, 8)` → 长度用例红;②`Set` 去重 → 去重用例红;③`relTime` 的 `Math.max(1, …)` → 30 秒用例红(会变 `n: 1` → `n: 0`);④`relTime` 的 `Number.isNaN` 守卫 → 坏串用例红;⑤`Intl.DateTimeFormat` 的 `locale` 参数换成写死 `'en'` → locale 用例红;⑥`condSuggestionsFor` 的 `filter` → 排除用例红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/util/smartViewSuggest.ts src/photos/util/relTime.ts src/photos/util/__tests__/ src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): P7a-T1 智能视图 115 i18n 键 + 建议池/模板/相对时间纯函数"
```

---

