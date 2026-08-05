### Task 16: `PhotosSearchBar.vue` + `views/PhotosSearch.vue` 容器接线 + 灯箱 OCR 激活

**Files:**
- Create: `src/photos/components/PhotosSearchBar.vue` + `__tests__/PhotosSearchBar.test.ts`
- Create: `src/views/PhotosSearch.vue` + `src/views/__tests__/PhotosSearch.test.ts`
- Modify: `src/router/index.ts`(**只追加** `/photos/search`)
- Modify: `src/views/Photos.vue` + `src/views/__tests__/Photos.test.ts`(顶部挂搜索框)
- Modify: `src/views/PhotosSmartViewDetail.vue` + 其测试(**兑现 T6 的「在搜索中细化」接线,去掉 disabled 与 `photosSvSearchPending`,并把 T6 那条断言与代码注释一并改掉**)
- Read-only 参考: `PhotosSearchView.vue` 全文、`PhotosTopbar.vue:14-24`+`:52-70`、`PhotosTimeline.vue:208-215`(searchActive/history)、`:650-668`(onSearch + 历史写入)、`:1116`(lightboxSearchQuery)

**Interfaces:**
- Consumes: T9-T15 全部;T2 的 store(保存弹层用);`useLightbox`
- Produces:
  ```ts
  // PhotosSearchBar.vue
  { value?: string; autofocus?: boolean }
  (e: 'submit', q: string): void
  (e: 'exit'): void            // searchMode 下的返回键
  // 路由 name: 'photos-search'
  ```

**结构规格:**

**A. `PhotosSearchBar.vue`(D13)**

1. 根 `.photos-search-bar` → `.search`(圆角输入框容器)含 search 图标 14px + `<input>`(`v-model="text"`,占位 `photosSearchSearchYourLibrary`?**回 T9 表核对键名**,`@keydown.enter` → `submit`)。
2. **`value` prop 回流**:`watch(() => props.value, v => { if (v !== text.value) text.value = v || '' })`(照搬 `PhotosTopbar.vue:57` 的口径:**不在打字时打断用户**)。
3. `submit`:`const q = text.value.trim()`;**照搬 Vue2 `:66-69`:空串也 emit**(`onSearch('')` 在 Vue2 等价于退出搜索)。
4. `autofocus: true` → `onMounted` focus。
5. **不做**「返回键」:Vue2 的 `searchMode` 返回键(`PhotosTopbar.vue:6-8`)在 New-UI 由路由承担(`/photos/search` → 浏览器后退 / 侧栏切换)。**登记不建。**

**B. `views/PhotosSearch.vue`**

6. 外壳照本区形态(`AreaShell` + `PhotosSidebar` + `main`)。顶部第一行是 `<PhotosSearchBar :value="query" autofocus @submit="onSubmit" />`。
7. **`query` 从路由读**(§7e-3 / 偏离登记 5):`const query = computed(() => String(route.query.q ?? ''))`。`onSubmit(q)`:写历史 → `router.replace({ path: '/photos/search', query: q ? { q } : {} })`。**`watch(query, …, { immediate: true })`** → `q` 非空则 `store.smartSearch(q, filtersPayload)`;为空则 `store.clear()`。
   - **`filters` 与后端的关系**:Vue2 把 chip 过滤**全部在前端做**(`filteredResults`,`:357-373`),`smartSearch` 的 `filters` 入参在 Vue2 的 `onSearch` 里**从来没传过**(`:651` 只传 `{ query }`)。**照搬:`smartSearch(q)` 不传 filters,过滤全在前端。** `store.filtersPayload` 因此恒为 `{}`(它存在只为 `loadMore` 复用同一份入参)。**注释登记这个事实**,否则会有人以为漏传。
8. **`query` 变化时重置 chip 过滤**(照搬 `:582-588` 的 watcher 语义):`old !== undefined && q !== old` → `clearAll()` + `moreExpanded = false`;然后 `applyUnderstood()`。**`immediate` 首帧 old 是 undefined ⇒ 不清(照搬注释)。**
9. **本地 state**:`sort`(默认 `'relevance'`)、`filters`(`{ date: null, people: [], place: [], type: null, album: null }` —— **`src` 不迁**)、`draft`(同形)、`openPop`(chip key 或 null)、`moreExpanded`、`saveOpen`、`saved`、`albumAssetIds`。
10. **5 个 chip 的定义**(照搬 `:564-572`,顺序不变):
    | key | 键 | 图标 | 弹层 | items |
    |---|---|---|---|---|
    | `date` | `photosSearchDate` | `clock` | `SearchDatePopover` | — |
    | `people` | `photosSearchPeople`(**复用 T1/既有 `photosInfoPeople`?回表核**) | `person` | `SearchPeoplePopover` | `people` store |
    | `place` | `photosSearchPlaces` | `map` | `PhotosFilterPopover` | `realPlaceItems` |
    | `album` | `photosSearchAlbums` | `album` | `PhotosFilterPopover`(**单选**) | `realAlbumItems` |
    | `type` | `photosSearchFileType` | `video` | `PhotosFilterPopover`(**单选** + `labelFor = t`) | `['Photos','OCR','Videos']` |
11. **数据源三处**(照搬 `:435-470`):
    - `realPeopleList`:从 people store 取(**先 grep `stores/people.ts` 的导出**),`.filter(name 非空).map(→ PersonOption).sort((a,b) => b.count - a.count)`。**`onMounted` 若 people 未加载则拉一次**(照搬 `:817`)。
    - `realAlbumItems`:从 albums store 取 name 列表(照搬 `:449-451`);**`onMounted` 若未加载则拉一次**(照搬 `:818`)。
    - `realPlaceItems`:从**当前搜索结果**(`store.results`,**过滤前**)统计 `place.split(',')[0].trim()` 的频次,按频次降序(照搬 `:452-465` 连注释)。
12. **`filteredResults` 照搬 `:357-373`**:type 三分支(`Photos` → `!isVideo && !hasOcr`;`OCR` → `hasOcr`;`Videos` → `isVideo`)、people(`faces` 数组含任一选中人名)、date(`dateInRange(takenAt, filters.date)`)、place(`place.split(',')[0].trim()` 在选中列表里)、album(`albumAssetIds` 有值时按 id 命中)。
13. **`filters.album` watcher**(§7e-7 + seq 守卫):选中 → 查 `albumIdByName`;查不到 → `albumAssetIds = new Set()`;否则 `getAlbum(id)` → `new Set(assets.map(a => String(a.id)))`(**`String()` 归一**);**加 seq 守卫**;清空选择 → `albumAssetIds = null`。
14. **`applyUnderstood()` 照搬 `:659-672`**:`understood(query, realPeopleList)`;people 合并去重(**只加不减**);`time` 且 `filters.date` 为空 → 用 `quickRange`/`yearRange`(按 `token.quick` 的类型分流)填上;`type` 且为空 → 填上。**`peopleLoaded` 变真时重跑一次**(照搬 `:591`)。
15. **渲染分支**:`!query` → 预搜索态;否则 hero + chip 栏 + 排序栏 + (空态 | 结果)。
    - **`searching` 判据照搬 `:350-353`**:`!!query && !store.matchesQuery(query)` → 抑制空态文案(显示为在途)。
    - 预搜索态:`.search-prestate`(`.nimo-orb` + `<h2>` + `<p>` + `v-if="history.length"` 的 recent chips)。**`.nimo-orb` 本仓没有 ⇒ 自绘**(accent 家族 + 径向渐变 + `filter: drop-shadow`;**颜色全走 token**)。
    - hero:`.search-query`(`v-for` 出 `queryParts(query, understoodKeywords)`,`hl` 的加 `.kw` class)+ `v-if="!searching"` 的 `.search-meta`(`photosSearchCountResultsSeconds`,`{count}` = `filteredResults.length`、`{seconds}` = `(store.ms / 1000).toFixed(2)`)+ `v-if="history.length > 1"` 的 `.search-history`(排除当前词)+ `v-if="understood.length"` 的 `.understood`(orb + 前缀 + `v-for` 出 `· {t(k)}` + `<b>{v}</b>`)。
      - **`understood` 行的 `t(t.k)`**:`k` 是 `'person'|'type'|'time'` ⇒ 映射到三个键(`photosSearchTokPerson` 等,**回表核对**)。
      - **`v` 的显示**:person → 人名原样;type → `t('photosSearchType' + v)`(**Vue2 `:44` 是 `<b>{{ t.v }}</b>` 直出英文 `Videos`** ⇒ 中文界面出英文。**这是第 13 条 Vue2 缺陷:改成 `t()` 映射,回填 spec §7e**);time → 五个快捷键映射到键、年份原样。
    - 排序栏:`photosSearchSortBy` + 三个按钮(`:data-active`)+ 右侧 `v-if="!searching"` 的计数(`photosSearchCountMatches`)与 `v-if="topScore"` 的 `photosSearchTopScoreScore`。
      - **`topScore` 照搬 `:513-517`**:`sortedResults[0]` 的 `matchPct` + `'%'`;为空则 null。
    - 空态:`filteredResults.length === 0 && !searching` → `.empty-search`(orb + h2 + p + 条件 chips)。**Ask Nimo 按钮不建(D1)。**
    - 结果:`<PhotosSearchGrid :best :more :moreExpanded :showSentinel :loadingMore @open @update:moreExpanded @load-more>`。
      - `best`/`more` = `splitTiers(sortResults(scored, sort), sort)`,`scored` = `filteredResults.map(p => ({ p, score: p.matchScore ?? null }))`。
        - **⚠ 顺序**:Vue2 是「results → filteredResults → sortedResults → 双档」(`:339-404`)。逐字照这个顺序,**双档切分在排序之后**(注释 `:392-396` 明说不重算 belowCut)。
      - `showSentinel` 照搬 `:413-415`:`moreExpanded && !store.exhausted && more.length > 0`。
      - `@load-more` → `store.loadMore()`(**store 自带三重短路,视图不再判**;Vue2 `:697-700` 视图也判了一遍,**照搬那层守卫无害但冗余 —— 不迁,注释登记**)。
      - `@open` → **`lb.openAt(photo, sortedResults.map(r => r.p), 0, query)`**(**第四参传 query = 激活 OCR 高亮**;翻页集是 `sortedResults` 而非 `filteredResults`,照搬 `:725`)。
16. **搜索历史**:
    ```ts
    const HISTORY_KEY = 'nimo_search_history'   // 与 Vue2 同键:同源共享 localStorage,
    // cutover 期间两边历史互通是好事(与 places 的 mapTheme 情形相反 —— 那里结构变了
    // 才必须换 key,这里是同结构的字符串数组)。
    ```
    读:`JSON.parse(...)` + `Array.isArray` + `.map(String)` + `.slice(0, 6)`,整体 try/catch → `[]`。写(照搬 `:652-658`):`[q, ...prev.filter(h => h !== q)].slice(0, 6)`,try/catch 吞。**写在 `onSubmit` 里且只在 `q` 非空时写。** 历史存 `ref` 并在写后刷新(否则同页不更新)。
17. **`defaultSaveName` 照搬 `:550-559`**:query trim 去首尾引号;`< 40` 直接用;否则拼 `filters.people[0]` + `filters.place[0].split(',')[0]` + (`query` 含 `'sunset'` → `t('photosSvSunsets')`?**Vue2 `:557` 是 `$t('sunsets')`,回 T9/T1 表核对该键**);都没有 → `photosSvNewSmartView`。**`ql.includes('sunset')` 这条英文硬编码启发式照搬**(偏离登记 13-⑤)。
18. **`activeConditions` 照搬 `:498-508`**:date → `label`;people/place 逐条;type → `'type: ' + v`;album → `'album: ' + v`。**`src` 分支不迁。** **这些串要发给后端 parser ⇒ `'type: '` / `'album: '` 前缀不进 i18n**(注释登记)。
19. **浮层统一治理**(硬约束):一个 `mousedown` 监听 —— `openPop` 非空且点击落在 chip 栏之外 → 关(照搬 `:824-831` 的 `.filterbar` 容器判定);`saveOpen` 且点击落在保存弹层与按钮之外 → 关。一个 `keydown` 监听 —— Esc **不早退**,`openPop` 与 `saveOpen` **两者都关**。
    - **Vue2 的 Esc 是 `exitSearch()`(退出搜索)**(`:834`),且用 `lightboxOpen` prop 抑制。**New-UI 不迁这个语义**:Esc 用于关浮层(与本仓其余页面一致);退出搜索走侧栏/后退键。**偏离登记**(顺带消掉了 `lightboxOpen` 这个 prop 的必要性)。
20. **chip 的 draft 语义**(照搬 `:783-797`):`togglePop(key)` → 若已开则关;否则开并 `draft[key] = clone(filters[key])`。`applyPop(key)` → `filters[key] = clone(draft[key])` + 关。`cancelPop()` → 只关(丢弃 draft)。`clearFilter(key)` → 数组置 `[]`、单值置 `null`。`clearAll()` → 全复位。
21. **`saved` 状态**:保存成功后 `saved = true` → 保存按钮变「已保存」+ disabled(照搬 `:153-158`)。**`query` 变化时 `saved` 复位**(Vue2 没做 ⇒ 换了查询词按钮还显示「已保存」。**第 14 条 Vue2 缺陷,修 + 回填 spec §7e**)。
22. **`Photos.vue` 挂搜索框**:在 `.photos-summary` 之前插 `<PhotosSearchBar @submit="q => router.push({ path: '/photos/search', query: q ? { q } : {} })" />`。**`v-if` 条件:无**(时间线页恒显示,对应 Vue2 `show-search = isLibraryView`)。
23. **`PhotosSmartViewDetail.vue` 接线**:「在搜索中细化」去掉 `disabled`,`@click` → `router.push({ path: '/photos/search', query: { q: sv.name } })`;删掉 `photosSvSearchPending` 的 `title` **与那条 TODO 注释**(硬约束:改结论要 grep 所有出现处);**T6 那条断言改成「可点 + push 参数正确」**。`photosSvSearchPending` 键随之成为死键 ⇒ **从两个 locale 删掉**(parity 仍绿)。

- [ ] **Step 1: 写失败测试**

`PhotosSearchBar.test.ts`:
- 结构:图标 + input;`value` 渲染进 input。
- Enter → `submit` 带 trim 后的值;空串也 emit(照搬)。
- `value` prop 变化 → input 跟着变;**但 input 里已有用户输入且与 value 不同时,value 未变则不覆盖**(watch 的 `!==` 守卫)。
- `autofocus` → `document.activeElement` 是 input。

`PhotosSearch.test.ts`(大用例集,分 describe 组织):
- **路由 query 驱动**:挂载时 `route.query.q = 'abc'` → `smartSearch('abc')` 被调;`q` 改成 `'def'` → 再调一次且 `clearAll` 生效(chip 过滤被清);`q` 变空 → `store.clear()` 被调。
- **不给 prop 赋值**(§7e-3):源文本不含对 `query` 的赋值(它是 computed)。
- **`smartSearch` 不传 filters**:断言第二参是 `undefined` 或未传(照搬语义的守卫)。
- 预搜索态:`q` 为空 → `.search-prestate` 在、hero 不在;`history` 有 3 条 → 3 个 `.prestate-chip`;点一个 → `router.replace` 带那个词。
- hero:`queryParts` 生效(有 `.kw` 元素);`searching` 为真时 `.search-meta` **不在**;为假时在且 `{seconds}` 是 `(ms/1000).toFixed(2)`。
- **`understood` 行的 type 值本地化**(第 13 条缺陷的守卫):query `'my videos'` → `<b>` 里的文本是 `photosSearchTypeVideos` 的**中文值**,**不是** `'Videos'`。
- 5 个 chip 按顺序渲染;点 chip → 对应弹层出现(每种一条);再点 → 关。
- draft 语义:开 place 弹层 → 勾一项 → **`filteredResults` 未变**(未提交);点 Apply → 变;开弹层勾选后点 Cancel → `filters` 未变;**点弹层外部** → 同样丢弃。
- `filteredResults` 五种过滤各一条 + 组合一条(people + date 同时)。
- `filters.album`:选中 → `getAlbum` 被调、`albumAssetIds` 就绪后结果收窄;**快速切两个相册的 seq 守卫**(旧响应不覆盖新);相册名查不到 id → 结果为空集(不是不过滤)。
- `applyUnderstood`:query 含已命名人名 → people chip 预选上;含 `'last week'` 且 date 空 → date 预填 last7;**date 已有用户选择 → 不覆盖**;`peopleLoaded` 从假变真 → 重跑一次。
- 排序:三个按钮切换 → `sortResults` 结果顺序变;`relevance` 下双档切分生效(`more` 非空);切到 `newest` → `more` 为空、`best` 全量。
- 空态:`filteredResults` 为空 + `searching` 假 → `.empty-search` 在且列出 `activeConditions`;`searching` 真 → **不在**;**Ask Nimo 按钮不存在**(D1 反向断言)。
- `@load-more` → `store.loadMore()` 被调。
- **`@open` → `openAt` 第四参是 query**(**OCR 激活的主守卫**),第二参是 `sortedResults` 映射出的 photo 数组。
- 历史写入:`onSubmit('abc')` → localStorage 里是 `['abc']`;再 `onSubmit('def')` → `['def','abc']`;重复 `'abc'` → `['abc','def']`(去重提前);超过 6 条 → 只留 6;**localStorage 抛错(mock `setItem` throw)→ 不崩**。
- 保存弹层:点「存为智能视图」→ 弹层开;`defaultName` 在 query 短于 40 时是 query 本身、长于 40 时按拼接规则;保存成功 → 按钮变「已保存」+ disabled;**`q` 变化 → `saved` 复位**(第 14 条缺陷的守卫)。
- 浮层:chip 弹层与保存弹层同开时一次 Esc 两者都关;**Esc 不触发「退出搜索」**(反向断言:`router.push`/`replace` 未被调)。
- 路由:`?raw` 断言 `/photos/search` 行在 `/photos/smart-views/:id` 之后;`resolve('/photos/search')` 的 name 是 `photos-search`。

`Photos.test.ts` 增补:搜索框存在;`submit` → `router.push` 到 `/photos/search?q=…`;空串 → push 时 query 为空对象。

`PhotosSmartViewDetail.test.ts` 改:「在搜索中细化」**不再 disabled**;点它 → `router.push({ path: '/photos/search', query: { q: sv.name } })`;`photosSvSearchPending` 在两个 locale 里**都已删除**(读 locale 对象断言键不存在)。

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现**

- [ ] **Step 4: 跑全量四道门 + tsc,逐个删码验证**

Run: `pnpm exec vitest run && pnpm exec vue-tsc --noEmit`

删码清单:①`watch(query)` 里的 `clearAll()` → 「改 q 清 chip」用例红;②首帧 `old === undefined` 的不清守卫 → 首帧用例红(会把 `applyUnderstood` 预填的清掉);③`applyUnderstood` 的「date 已有则不覆盖」→ 对应用例红;④`filters.album` 的 seq 守卫 → 快速切相册用例红;⑤`openAt` 第四参 → OCR 激活用例红;⑥`understood` type 值的 `t()` 映射 → 本地化用例红;⑦`saved` 的 query 复位 watch → 第 14 条守卫红;⑧Esc handler 里加早退 → 「一次 Esc 全关」用例红;⑨历史写入的 `filter(h => h !== q)` → 去重用例红;⑩`splitTiers` 调用挪到排序之前 → 双档顺序用例红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/components/PhotosSearchBar.vue src/views/PhotosSearch.vue src/router/index.ts src/views/Photos.vue src/views/PhotosSmartViewDetail.vue src/photos/components/__tests__/PhotosSearchBar.test.ts src/views/__tests__/ src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): P7a-T16 搜索容器接线 + 搜索框 + 灯箱 OCR 高亮激活 + 细化入口接通"
```

---

## Self-Review 记录(控制器写完 plan 后自查,2026-07-31)

**1. Spec 覆盖核对(spec §7d P7a 行逐项)**

| spec 要求 | 落点 | ✓ |
|---|---|---|
| `stores/smartViews.ts`(含 byId / preview seq / detail seq / 重入锁) | T2 | ✓ |
| `stores/search.ts`(seq / loadMore / clear) | T11 | ✓ |
| `smartViewSuggest.ts` | T1 | ✓ |
| `searchUnderstood.ts`(修 `\b`) | T10 | ✓ |
| `searchQueryParts.ts` | T10 | ✓ |
| `dateRange.ts`(跟 locale) | T9 | ✓ |
| `searchSort.ts`(byTakenAt + 双档) | T10 | ✓ |
| `searchStateMatchesQuery.ts` | T10(并入 `searchSort.ts`,**spec 列的是独立文件 —— 已合并,理由:它只有 2 行且与排序/分档同属「搜索结果推导」一族,单独一个文件不值。登记这处与 spec 的偏差**) | ✓ |
| `PhotosSearchBar.vue`(D13) | T16 | ✓ |
| `PhotosFilterChip` + `PhotosFilterPopover`(D14) | T12 | ✓ |
| `SearchDatePopover.vue` | T13 | ✓ |
| `SearchPeoplePopover.vue` | T14 | ✓ |
| `SearchSaveSmartView.vue`(D12) | T14 | ✓ |
| `PhotosSearchGrid.vue` | T15 | ✓ |
| `SmartViewCard.vue`(D15) | T3 | ✓ |
| `SmartViewCreateDialog.vue` | T5 | ✓ |
| `SmartViewConditionEditor.vue` | T7 | ✓ |
| `SmartViewSidePanel.vue` | T8 | ✓ |
| `SmartViewActivityFeed.vue` | T8 | ✓ |
| 3 视图 + 3 路由 + 侧栏第 5 条目 | T4 / T6 / T16 | ✓ |
| 灯箱传 query 激活 OCR | T16 | ✓ |
| 搜索徽标读 `current` 不读 `detail` | **T15/T16 都不需要读 `detail`** —— 徽标数据(`matchScore`/`matchedBy`/`fav`)全在 `ScoredPhoto.p`(来自 `store.results`)上,灯箱内部的 `detail` 只服务信息面板。**故这条 spec 要求在 P7a 自动满足,无需专门代码。已在此登记,免得终审以为漏做。** | ✓ |
| 导出修 401 | T6 | ✓ |
| i18n ≈165 键 | T1(**实际 107** —— 表里 8 行与既有键 zh 值逐字相同、改为复用,见 ledger)+ T9(54)= **161**(spec 写 ≈165;**T14 可能再减 1**(`Unnamed` 不可达)、T8 加 1(`ActOneMatchedBold`)、T4 加 2(`SettingsPending` / `NotFound`)、T6 加 1(`SearchPending`,T16 再删)。**最终数以任务报告为准** | ✓ |
| 既有 Vue2 测试可迁 646 行 | T1/T2/T10/T11 各自吸收(`photosSmartViewsView.test.js` 86 / `photos-smartview.test.js` 58 → T2;`photosSearchFlash.test.js` 185 / `photosSearchTiering.test.js` 317 → T10+T11)。**每个任务的实现者要去读对应的 Vue2 测试文件,把里面的行为断言吸收进新测试** —— plan 已在各任务的 Read-only 参考里列出坐标。 | ✓ |

**2. 占位符扫描** —— 无 TBD / TODO / 「类似 Task N」/ 「适当处理错误」。所有「先 grep 确认」都是**明确的动作指令 + 明确的判断标准**(如「有则复用,无则自绘并在报告里说明为何」),不是含糊其辞。

**3. 类型一致性核对**

- `SmartView` / `SmartViewActivity` / `SmartViewPreview` / `CreateSmartViewInput` / `DeletedSmartView` —— T2 定义,T3/T5/T6/T7/T8/T14 消费,名字与字段全对齐。
- `DateRange` —— T9 定义,**T13 要加 `key?: QuickKey | number` 字段**(plan 已在 T13 结构规格第 2 条明确要求回改 T9 并补测试,不是隐式漂移)。
- `QuickKey` / `QUICK_KEYS` / `QUICK_LABEL_KEYS` —— T9 定义,T13/T16 消费。
- `PersonOption` —— T10 定义,T14/T16 消费。
- `ScoredPhoto` / `SortKey` —— T10 定义,T15/T16 消费。
- `CalCell` —— T9 定义,T13 消费。
- `Photo` —— 既有 `util/assetToPhoto.ts`,T10 可能扩四个字段。
- `formatMB` —— T8 提到 `util/formatBytes.ts`,**T6 也要用** ⇒ **T6 在 T8 之前**,故 T6 阶段要么自己内联一份、要么把该 util 提前建。**修正:已把 `formatBytes.ts` 的创建挪到 T6**(T6 是第一个用它的),T8 直接消费 —— T6/T8 的 Files 与 Interfaces 段落均已就地改好。

**4. plan 自查发现并已修正的问题**

1. **`formatBytes.ts` 的归属**:原写在 T8 的 Files 里,但 T6 的统计行先用到 ⇒ **已改成建在 T6、T8 消费**(两个任务的 Files / Interfaces / commit 命令均已同步)。
2. **`searchStateMatchesQuery` 从独立文件合并进 `searchSort.ts`** —— 与 spec §7d 的文件清单有一处偏差,已在覆盖表登记。
3. **`Unnamed` 键在 T14 不可达** ⇒ T9 的 54 键可能要减 1。plan 已让 T14 负责回改 T9 的表与键数,并在报告里登记。
4. **T6 的「在搜索中细化」是临时 disabled 态** ⇒ T16 要连注释、断言、i18n 键三处一起改。已在 T16 的 Files 与 Step 3 明确。
5. **T4 的创建弹窗挂载点是临时的** ⇒ T5 兑现并升级断言。已在两边明确。
6. **T6 的右栏与条件编辑器挂载点是临时的** ⇒ T7 / T8 兑现。已在三边明确。
7. **本 plan 新查实 3 条 Vue2 缺陷**(§7e 目前到 10):**§7e-11**(`Settings` 键渲染成「系统设置」,T8)、**§7e-12**(搜索失败后视图永久停在「搜索中」,T11)、**§7e-13**(`understood` 行的 type 值直出英文,T16)、**§7e-14**(换查询词后「已保存」按钮不复位,T16)。**共 4 条 —— 实施期间要回填 spec §7e(编号 11-14),并在 roadmap 登记。**

**5. 未在本 plan 解决、留给实施者用「先 grep 再定」的开放点(每条都给了判断标准与登记要求)**

| # | 开放点 | 任务 | 判断标准 |
|---|---|---|---|
| 1 | ~~token 取法(导出 ZIP 的 `Authorization`)~~ **控制器 pre-flight 已查实并写进 T6 代码块** | T6 | 裸 token、无 `Bearer` 前缀:`localStorage.getItem('access_token')`;依据 `NimoOS-Service/src/http.ts:59-60` + `main.ts:24`,全仓零 `Bearer` 字面量 |
| 2 | 本仓是否已有确认弹窗组件可复用 | T6 | 有则复用,无则自绘 `.lb-confirm` 系 |
| 3 | ~~`useToast` 是否支持撤销动作~~ **控制器 pre-flight 已查实:支持** | T6 | `show(text, duration, action?)` 第三参 = `{ label, onClick }` 撤销 pill(`src/stores/toast.ts:13-19`,SP7-P3 为回收站加的)。**撤销能力必须做,不得挂账。** 只剩「撤销」文案键要 grep 复用 |
| 4 | 本仓是否已有字节格式化 util | T6 | 有则复用**但要核对四舍五入口径与 Vue2 一致** |
| 5 | `PhotosIcon.vue` 的 glyph 覆盖 | T12 | 缺则照 Vue2 逐字符补 + `?raw` 正则断言(P6b 终审抓过 4 处漏抄) |
| 6 | `PersonAvatar.vue` 能否复用 | T14 | 能则复用,不能则自绘并说明为何 |
| 7 | `assetToPhoto` 是否已透传 4 个字段 | T10 | 缺则补,新增字段一律可选 + 有默认 + 加旧 fixture 回归断言 |
| 8 | `PhotosGrid` 的 density 列宽数值 | T15 | 优先复用同区既有数值,注释说明取自哪里 |
| 9 | `--dem-fg` 及配套软底/边框 token 是否齐全 | T4 | 缺则新增并两套主题给值 + THEMING.md |
| 10 | 本仓绿色(正向)token | T3 | grep 现成的,没有再新增 |
| 11 | 收藏星黄色 token | T15 | 复用 `PhotosGrid` 里星标已用的那个 |
| 12 | `stores/people.ts` / `albums.ts` 的导出形状 | T16 | 直接读文件,按其真实 API 接 |

---

## 文末:真机验收清单(:5277,T16 完成后 —— 搜索那半)

**中途验收点(T8 后)的 16 条见上方「⏸ D16 中途验收点」段。以下是搜索那半的 24 条:**

1. 时间线页顶部出现搜索框(D13 的落点),位置与 Vue2 的 topbar 搜索框在**视觉高度上**是否可比。
2. 输入词按 Enter → 跳到 `/photos/search?q=…`,浏览器地址栏能看到 q;刷新页面结果还在;**后退键回到时间线**。
3. **预搜索态**:直接进 `/photos/search`(不带 q)→ orb + 文案 + 最近搜索 chips;点一个 chip 直接搜。
4. orb 的发光在**两套主题**下都不突兀(本仓自绘,Vue2 是紫色系,New-UI 是 accent 蓝)。
5. hero 的查询词高亮:搜「小明的照片」应把「小明」高亮(**这是 §7e-5 修 CJK 人名的真机验证 —— Vue2 在这里不高亮也不出 understood token**)。
6. **「Nimo 理解为」行**:搜 `my videos` 应出「类型 · 视频」,**「视频」必须是中文**(§7e-13 的验证);搜 `last week` 出时间 token。
7. 结果数与耗时(`{count} 条结果 · {seconds}s`)是否合理(秒数是真实往返时间,不是 Vue2 那个写死的 0.41)。
8. 5 个 chip 依次点开:**Date 弹层的日历**(上下月、点两天选区间、区间高亮的圆角在首尾两端)、**People 弹层的人脸网格**(头像是否真的出图)、Places / Albums / File type 三个 list 弹层。
9. **draft 语义**:在弹层里勾选后点 Cancel 或点弹层外部 → 结果**不应**变;点 Apply 才变。
10. chip 上的清除叉:出现条件、点它只清这一个 chip **而不打开弹层**。
11. 「清除全部」按钮。
12. 三种排序切换;**relevance 下才有「更多结果 (N)」折叠条**,newest/oldest 下应消失。
13. 展开「更多结果」→ **滚到底应自动加载下一页**(sentinel + IO 的真机验证,jsdom 完全测不到);加载中应看到「加载更多…」。
14. 结果 tile 上的四种徽标:类型(照片/视频/OCR **三个颜色要能区分**)、匹配百分比 或「文字匹配」、收藏星。**两套主题下都要看得清**(全部压在照片上)。
15. 点结果 tile 打开灯箱 → **OCR 高亮**:搜一个 OCR 能命中的词(如小票上的字),灯箱里那些字上应有高亮框。**这是本期激活 P2 休眠功能的核心验证,必须眼验几何对齐**(框的位置是否套准文字)。
16. 灯箱翻页应只在搜索结果内翻,不会翻到无关照片。
17. 灯箱里的人脸 chip / 匹配分徽标是否还在(**搜索上下文徽标读 `current` 不读 `detail` 的验证** —— 若翻页后徽标消失就是回归)。
18. **空态**:搜一个肯定没有的词 → orb + 「没有匹配」+ 条件 chips;**不应有 Ask Nimo 按钮**(D1)。
19. **搜索失败后不应永久转圈**(§7e-12):可断网或搜一个超长词试;应落到空态而不是一直「搜索中」。
20. **「存为智能视图」真的建出来了**(D12 的核心验证 —— Vue2 在这里是假的):点它 → 填名 → 创建 → **去智能视图列表看是否真出现了那条**。
21. 换一个查询词后,「存为智能视图」按钮应从「已保存」复位成可点(§7e-14)。
22. 智能视图详情页的「在搜索中细化」现在应可点,点了跳到搜索页并用该智能视图的名字作查询词。
23. 一次 Esc 关掉所有开着的浮层;Esc **不应**把你踢出搜索页(偏离登记 19)。
24. **窄屏(≤768px)**:搜索框、chip 栏(会换行吗)、结果网格列数、日历弹层是否溢出屏幕。

**用户报反馈后,控制器一律先按「Vue2 缺陷 / 本期回归 / 非缺陷(数据不足或 Vue2 原样行为)」三类定性,再决定改法。**
