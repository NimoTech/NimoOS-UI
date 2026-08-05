### Task 6: `views/PhotosSmartViewDetail.vue` —— 详情页外壳 + header + 操作栏三菜单 + 删除确认

**Files:**
- Create: `src/views/PhotosSmartViewDetail.vue`
- Create: `src/views/__tests__/PhotosSmartViewDetail.test.ts`
- Create: `src/photos/util/formatBytes.ts` + `src/photos/util/__tests__/formatBytes.test.ts`(**T6 是第一个用到 `formatMB` 的任务,故建在这里;T8 的统计四格直接消费,不再重建** —— plan 自查修正 1)
- Modify: `src/router/index.ts`(**只追加** `/photos/smart-views/:id`,插在 `/photos/smart-views` 之后)
- Read-only 参考: `PhotosSmartViewDetail.vue:3-9`(bar)、`:12-130`(header + 操作栏)、`:239-253`(删除确认)、`:282-398`(data/computed/watch/mounted)、`:501-533`、`photos-smartview.scss:146-186`+`:210-457`

**Interfaces:**
- Consumes: T2 的 store(`byId` / `loadDetail` / `updateSmartView` / `deleteSmartView` / `restoreSmartView` / `duplicateSmartView` / `exportAlbum` / 5 把锁)、T1 的 `relTime`、T1 的键
- Produces(给 T8):`export function formatMB(bytes: number): string`(`src/photos/util/formatBytes.ts`)
- Produces:
  ```ts
  // 无 props(路由页);向 T7/T8 提供的插槽契约:
  //   <SmartViewConditionEditor :conds="sv.conds" @add="…" @remove="…" />        (T7)
  //   <SmartViewSidePanel :sv="sv" @patch="…" />                                 (T8)
  //   <SmartViewActivityFeed :activity="store.activity" />                        (T8)
  // 路由 name: 'photos-smart-view-detail',params.id
  ```

**结构规格:**

1. **数据源(本期核心修复)**:`const sv = computed(() => store.byId(String(route.params.id)))`。`onMounted`:若 `!store.listLoaded` 先 `await store.fetchSmartViews()`,再 `store.loadDetail(id)`。**`watch(() => route.params.id)`** → 重新 `loadDetail`(**并且要处理「id 变了但 detail 还没回来」** —— `loadDetail` 自带 seq 守卫与清空,T2 已做)。
   - **`sv` 为 `null` 的两种情形要分开**:`!store.listLoaded` → 骨架;`listLoaded && !sv` → 「找不到」空态 + 返回列表按钮(**New-UI 新增,Vue2 无此路径**:Vue2 详情页只在父级持有对象时渲染,不可能拿不到。手改地址栏或旧书签会走到。**偏离登记**)。新增自拟键 `photosSvNotFound`(zh「找不到这个智能视图」/ en `Smart View not found`)。
2. **`.sv-detail-bar`**:返回按钮(chevL 13px + `photosSvAllSmartViews`,`@click` → `router.push('/photos/smart-views')`)+ 撑开 + 右侧 `photosSvLastUpdatedTime`(`{time}` = `lastUpdated`)。
   - **`lastUpdated`**:`sv.evaluatedAt ? relTime(sv.evaluatedAt, Date.now(), t, locale) : '—'`(照搬 `:332` 的 `'—'` 兜底)。**`Date.now()` 在组件里可以用**(不是 workflow 脚本);但为可测,包一层 `const now = ref(Date.now())`,测试可覆写。
3. **`.sv-header`**:
   - `<h1>`:`titleEdit` 为假 → 一个 `<span cursor:text :title="t('photosSvClickRename')">{{ sv.name }}</span>`(点击进编辑);为真 → `<input>`(`v-model="titleDraft"`,`@keydown.enter.prevent="commitTitle"`、`@keydown.esc.prevent="cancelTitle"`、`@blur="commitTitle"`,自动 focus + select)。**Vue2 `:22` 的一大串内联 style 改成 class,逐属性对照**(含 `font-size:28px` / `font-weight:600` / `letter-spacing:-0.02em` / `min-width:300px`)。
   - 紧随其后的 Live/Paused pill:`!paused` → `.live-pill`(`.live-dot` + `photosSvLive`,`title` = `photosSvPauseAutoUpdates`,点击暂停);`paused` → `.live-pill.paused-pill`(+ `photosSvResumeAutoUpdates`,点击恢复)。**两者都是 `role="button"`,New-UI 补 `tabindex="0"` 与键盘激活**(Vue2 只有 `role` 没有键盘可达性;**偏离登记**)。
   - `.sv-header-conds`:**由 T7 的 `SmartViewConditionEditor` 承担**。本任务只留挂载点 + 一条 TODO 注释,测试断言挂载点存在(用一个 stub)。
   - `.sv-header-stats`:4 项 —— `<b>{count 千分位}</b>` + `photosSvPhotosCount`;`v-if="newCount > 0"` → `<b class="delta">+{newCount}</b>` + `photosSvThisWeek`;`photosSvMedianMatch` + `<b>{median}%</b>`;`photosSvStorage` + `<b>{formatMB}</b>`。
     - **`newCount = sv.addedThisWeek || 0`**(照搬 `:314`)。**`formatMB` 照搬 `:424-428`**:`mb = bytes / 1048576`;`mb >= 1024` → `(mb/1024).toFixed(1) + ' GB'`;否则 `Math.round(mb) + ' MB'`。**单位串 `' GB'` / `' MB'` 不进 i18n**(国际通用,照 P6b `formatSpotCoords` 方向字母的先例;**注释登记**)。
4. **`.sv-actions`(4 个入口)**:
   - `.sv-action-btn` 暂停/恢复(play/pause 图标 12px + `photosSvResume` / `photosSvPause`)。
   - `.sv-action-btn` **「在搜索中细化」**(search 图标 12px + `photosSvRefineSearch`)。**T6 阶段搜索路由不存在** ⇒ 本任务渲染成 `disabled` + `title` 指向「搜索页待迁移」(复用 T4 新增的 `photosSvSettingsPending` 是不对的语义 —— **新增自拟键 `photosSvSearchPending`**,zh「搜索页待迁移(本期后半)」/ en `Search page coming later this phase`)。**T16 负责去掉 disabled 并接 `router.push('/photos/search?q=' + encodeURIComponent(sv.name))`**(Vue2 `:520` 的 payload 是 `{ q: sv.name, smartViewId: sv.id }`,New-UI 只用 `q` —— `smartViewId` 在 Vue2 全链路无消费方,**grep 实证后登记为死参数不迁**)。**代码注释登记 T16 接线点。**
   - **导出菜单**:`.sv-action-btn[data-primary="true"]`(download 图标 + `photosSvExport` + 一个 9px 的下拉 chevron `<svg>`)→ `.sv-export-menu` 两项:①`photosSvDownloadZip` + 描述 `photosSvNPhotosMbMb`(`{n}` = count 千分位、`{mb}` = `Math.round(count * 3.2)` 千分位 —— **这个 3.2 的魔法系数照搬**)②`photosSvSaveStaticAlbum` + 描述 `photosSvSnapshotCurrentMatchesStops`。
   - **more 菜单**:`.sv-action-btn`(more 图标 14px)→ `.sv-export-menu`(min-width 220px)三项:`photosSvRename`(+ 描述 `photosSvChangeSmartViewName`)/ `photosSvDuplicate`(+ `photosSvCopyQuerySv`)/ 分隔线 / `photosSvDeleteSmartView`(+ `photosSvPhotosStayLibrary`,**红色**)。红色走 `--danger` 家族 token,**Vue2 `:119-123` 的三处内联 `#FF6B5C` 全部改 token**。
   - **两个菜单 + 加条件弹层的点外部关闭**:一个 `mousedown` 监听同时处理(照 Vue2 `:375-391` 的两个独立 listener,New-UI 合成一个但**内部禁止早退**);Esc 关闭走 `document` 级 `keydown`,**多浮层同开时一次 Esc 全关**(硬约束)。
5. **导出 ZIP(§7e-1 修 401)**:
   ```ts
   // exportSmartViewUrl 走的 /v1/photos/smart-views/:id/export 不在后端 mediaGetSkip
   // 豁免表里(只有 /favorites/export 后缀被豁免),且 Photos 的 JWT 中间件只从
   // Authorization 头取 token、没有 query 通路 —— 所以 Vue2 的 window.location.href
   // 必然 401。这里改成带 Authorization 的 fetch + blob 下载。
   async function downloadZip(): Promise<void> {
     exportMenuOpen.value = false
     try {
       const url = service.photos.exportSmartViewUrl(String(sv.value!.id), 'zip')
       // ⚠ 不要加 'Bearer ' 前缀 —— 本仓存的是裸 token:共享包拦截器是
       // `cfg.headers.Authorization = token`(NimoOS-Service/src/http.ts:59-60),
       // token 来自 `localStorage.getItem('access_token')`(main.ts:24 的 getToken 回调),
       // 全仓 grep 不到任何 'Bearer' 字面量。后端 `strings.TrimPrefix(auth, "Bearer ")`
       // (router.go:111-112)对裸 token 是恒等的,两种都能过,但这里与共享包保持同一口径。
       const res = await fetch(url, { headers: { Authorization: localStorage.getItem('access_token') ?? '' } })
       if (!res.ok) throw new Error(`export ${res.status}`)
       const blob = await res.blob()
       const href = URL.createObjectURL(blob)
       const a = document.createElement('a')
       a.href = href
       a.download = `${sv.value!.name || 'smart-view'}.zip`
       document.body.appendChild(a); a.click(); a.remove()
       URL.revokeObjectURL(href)
       showExportToast('download', t('photosSvPreparingZipNPhotos', { n: fmtNum(sv.value!.count) }))
     } catch (e) {
       console.error('[photos-smartviews] downloadZip', e)
       showExportToast('download', t('photosSvExportFailed'))
     }
   }
   ```
   **`getToken()` 不要自己实现** —— 先 `grep -rn "Authorization" src/ ../NimoOS-Service/src/http.ts` 找共享包的 token 取法,用同一个来源(可能是 `initService` 注入的回调或一个导出函数)。**若共享包没有导出可用的 getter,就在视图里读 `localStorage` 用的那个键名 —— 但必须先 grep 出键名,不许猜。**
6. **导出相册**:`store.exportAlbum(id)` → 成功 toast `photosSvNameSnapshotSavedAlbum`(`{name}`);失败 toast `photosSvExportFailed`(照搬 Vue2 `:484-489` 的分流)。
7. **`.sv-toast`**:`exportToast` 存在时渲染(图标 + 文本),**2800ms 后自清**(照搬 `:499`)。用本仓 `useToast` 吗?**不用** —— Vue2 这是页内定位的浮条(`scss:458-476`),与全局 toast 位置不同;**照 Vue2 自绘**,并在注释里说明为何不用 `useToast`(信息层级 1:1)。**但创建/删除失败的错误提示用全局 `useToast`**(那些 Vue2 根本没有,是新增)。
8. **改名 / 暂停 / 删除 / 复制**:
   - `commitTitle`:trim 后与 `sv.name` 不同才 `updateSmartView(id, { name })`;成功 → 全局 toast `photosSvSmartViewRenamed`;**失败 → toast + 保持编辑态**(偏离登记:Vue2 `:512-513` 无 catch)。无论成败,`titleEdit` 的退出照 P6b-T4 的裁定 —— **`watch(() => sv.value?.name)` 退出编辑态**(成功后 store 回写 name → prop 变 → 退出;失败 name 不变 → 保持编辑态,语义正确且不乐观撒谎)。
   - `paused` 是**派生量不是本地 state**:`const paused = computed(() => !sv.value?.live)`。切换 → `updateSmartView(id, { live: !paused })`。**Vue2 用本地 `paused` + `syncingSv` 标志 + 三个 watcher 的一整套同步机制(`:288-291`、`:345-371`)全部不需要** —— 那套机制的存在就是因为 Vue2 拿不到响应式的 store 数据。**这是 §7e-2 修复带来的最大简化,必须在注释里登记,否则评审会以为漏迁。**
   - `doDelete`:`store.deleteSmartView(id)` → 成功 `router.push('/photos/smart-views')` + 全局 toast `photosSvSmartViewNameDeleted`(`{name}`)**带撤销动作**。**已查实(控制器 pre-flight):`useToast.show(text, duration, action?)` 的第三参就是撤销 pill** —— `ToastAction = { label: string; onClick: () => void }`,`src/stores/toast.ts:13-19`,由 `AppToast.vue` 渲染成可点 pill,**正是 SP7-P3 回收站视图加的**。所以直接 `toast.show(t('photosSvSmartViewNameDeleted', { name }), 5000, { label: t('<撤销键>'), onClick: () => store.restoreSmartView(payload) })`。**撤销键先 grep 本仓既有的「撤销」键复用**(P3 回收站应该已经有);没有再新增。duration 取 5000(照 P5 「5 秒可撤销」的既有口径)。
   - `duplicateSv`:`store.duplicateSmartView(id)` → toast `photosSvDuplicatedNameOpenCopy`(`{name}`)。
9. **删除确认弹窗**(`:239-253`):**先 grep 本仓有没有等价的 `Dialog` / 确认弹窗组件**(`PhotosPlaces` 系用过、`ClusterActionDialog` / `MergeReviewDialog` 是同族)。有则复用,无则自绘 `.lb-confirm` 系。内容:trash 图标 22px(红)+ 标题 `photosSvDeleteName`(`{name}`)+ 正文 `photosSvSmartViewRemovedStops`(`{n}` = count 千分位)+ 两钮(`photosSvCancel` / `photosSvDelete` 红)。
10. **两段照片网格挂载点**:`.sv-section-head` + `.sv-grid-photos` 两组由**本任务**渲染(它们结构简单、无独立组件),但 tile 的点击要 `openAt`:
    - 「最近添加」段 `v-if="newCount > 0"`:head 文案 `photosSvRecentlyAdded` + pill `photosSvNNewThisWeek`(`{n}`);tile 走 `store.recentAssets`,`p.isNew` 时加 `.recent` class 与 `.new-tag`(`photosSvNew`)。
    - 「全部匹配」段:head `photosSvAllMatches` + pill(count 千分位);tile 走 `store.matchedAssets`。
    - **点 tile → `lb.openAt(photo, store.matchedAssets, 0)`**(**翻页集是 matchedAssets 全集,照搬 Vue2 `:404-408` 的 `this.$emit('open-photo', p, this.matchedAssets)`;不传 query ⇒ 不激活 OCR 高亮,与 Vue2 一致**)。
    - **`p.isNew` 的乐观清除照搬 `:405-406`**:点开时若该项在 `recentAssets` 里且 `isNew` 为真,就地置假(后端记浏览后 New 角标会永久消失,这里做即时反馈)。**注意 `recentAssets` 是 store 里的 ref,视图直接改它的元素属性是可以的(同一对象),但要写注释说明这是刻意的就地改。**
    - **`isNew` 字段是否存在于 `assetToPhoto` 的输出?先 grep 确认**;若 `assetToPhoto` 丢了它,在 T10 一起补(那里已经要动这个文件)——**本任务发现即登记,不要静默让 `.new-tag` 恒不出现**。
11. **右栏与活动流挂载点**:留给 T8,本任务只放 `<aside class="sv-detail-side">` 空壳 + TODO 注释。
12. **token 映射与 hover 硬约束**:`.sv-action-btn` 基类有 hover、`[data-primary="true"]` 是变体 ⇒ 变体自带 `:hover`,cssCascade 断言。`.sv-export-item:hover` 与那条红色删除项会撞(红色是内联/变体)⇒ 同样处理。

- [ ] **Step 1: 写失败测试**

必含用例:
- **数据源三态**:`listLoaded` 假 → 骨架;`listLoaded` 真 + `byId` 命中 → 正常渲染;`listLoaded` 真 + `byId` 返 null → 「找不到」空态 + 返回按钮(**新增路径的主守卫**)。
- **`byId` 用 String 归一**:store 里 id 是数字 `7`,`route.params.id = '7'` → 命中。
- `onMounted` 在 `listLoaded` 为假时先 `fetchSmartViews` 再 `loadDetail`;为真时只 `loadDetail`。
- `watch(route.params.id)`:id 从 `'1'` 变 `'2'` → `loadDetail('2')` 被调。
- **改名**:点标题 → 出现 input 且 `titleDraft` 预填当前名;Enter → `updateSmartView(id, { name: '新名' })`;**store 回写 name 后编辑态退出**;**`updateSmartView` reject → 编辑态保持**(两条方向都要);名字未变(trim 后相同)→ `updateSmartView` **未被调**且退出编辑态;Esc → 退出且不提交。
- **`paused` 是派生量**:store 里 `live: false` → pill 显示 `photosSvPaused`;点 pill → `updateSmartView(id, { live: true })`;**store 更新后 pill 自动变** —— 用一条「直接改 store 里那条 sv 的 live 字段,不重新 mount,断言 pill 文案跟着变」的用例钉住(**这条是 §7e-2 修复的主守卫,Vue2 做不到**)。
- pill 键盘可达:`tabindex="0"` 存在,`keydown.enter` 触发同一个 handler。
- 4 统计:`addedThisWeek === 0` → delta 那项不渲染;`median` 缺 → 显示 `0%`;`formatMB` 三档(0 → `0 MB`、`1572864` → `2 MB`(四舍五入)、`2147483648` → `2.0 GB`)。**这三个值手算过:1572864/1048576 = 1.5 → Math.round → 2;2147483648/1048576 = 2048 → /1024 = 2 → toFixed(1) = '2.0'。**
- **「在搜索中细化」按钮是 `disabled` 且 `title` 是 `photosSvSearchPending`**(中途验收点的状态;T16 会把这条改掉,**改的时候要连注释一起改**)。
- 导出菜单两项、more 菜单三项各存在;`photosSvNPhotosMbMb` 的 `{mb}` 在 `count = 1000` 时是 `3,200`(`Math.round(1000*3.2)` = 3200 → 千分位)。
- **导出 ZIP 走 fetch 不走 location**:mock `fetch` 返 200 + blob;断言 `fetch` 被调且第二参含 `Authorization` 头;断言 `window.location.href` **未被赋值**(用 spy 或断言 `location.href` 不变);断言 `URL.createObjectURL` 与 `revokeObjectURL` 各被调一次;`<a download>` 的 `download` 属性含 `.zip`。**`fetch` 返 401 → toast 是 `photosSvExportFailed`。**
- 导出相册:成功 → toast 文案含 name;失败 → `photosSvExportFailed`。
- 删除:点 more → 删除项 → 确认弹窗出现;点确认 → `deleteSmartView` 被调 → `router.push('/photos/smart-views')`;`deleteSmartView` reject → 不跳转 + toast。
- 复制:`duplicateSmartView` 被调 + toast。
- **两段网格**:`newCount > 0` → 「最近添加」段在;`=== 0` → 不在;tile 数等于对应数组长度;点 tile → `openAt` 被调,**第二参是 `matchedAssets` 全集、第三参 0、第四参 `undefined`**(不传 query 的反向断言);`isNew: true` 的项被点后 `.new-tag` 消失。
- 浮层:两个菜单同开时(**构造:先开 export 再开 more**)一次 Esc 两者都关;点菜单外部(`mousedown`,`bubbles: true`)关闭。
- `cssCascade.ts`:`.sv-action-btn[data-primary="true"]` 与 `.sv-export-item` 的红色删除变体,hover 胜出规则含 `:hover` 且归属变体。
- 路由:`?raw` 断言 `/photos/smart-views/:id` 的行在 `/photos/smart-views` **之后**;`resolve('/photos/smart-views/7')` 的 `name === 'photos-smart-view-detail'` 且 `params.id === '7'`。
- 红色不含字面色值:样式块里 `--danger` 家族在,`grep` 不到 `#FF6B5C`(color-guard 会兜,但这条显式钉一下 Vue2 那三处内联的迁移)。

- [ ] **Step 2: 跑测试确认失败** — `pnpm exec vitest run src/views/__tests__/PhotosSmartViewDetail.test.ts`

- [ ] **Step 3: 实现**

- [ ] **Step 4: 跑全量 + tsc + color-guard,逐个删码验证**

Run: `pnpm exec vitest run && pnpm exec vue-tsc --noEmit`

删码清单:①`byId` 换成把 sv 存进本地 `ref`(模拟 Vue2 的对象引用)→ 「改 store 后 pill 自动变」用例红;②`watch(() => sv.value?.name)` 退出编辑态 → 「失败保持编辑态」或「成功退出」用例红;③`listLoaded && !sv` 的空态分支 → 「找不到」用例红;④`formatMB` 的 `>= 1024` 分支 → GB 用例红;⑤`downloadZip` 的 `Authorization` 头 → fetch 头断言红;⑥`revokeObjectURL` → 对应用例红;⑦`openAt` 第四参误传 query → 「不传 query」反向断言红;⑧Esc handler 里加一个早退(`if (exportMenuOpen) { close; return }`)→ 「一次 Esc 全关」用例红;⑨路由行插到 `/photos/smart-views` 之前 → 行序用例红。

- [ ] **Step 5: Commit**

```bash
git add src/views/PhotosSmartViewDetail.vue src/views/__tests__/PhotosSmartViewDetail.test.ts src/photos/util/formatBytes.ts src/photos/util/__tests__/formatBytes.test.ts src/router/index.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): P7a-T6 智能视图详情页外壳 —— byId 数据源 + 三菜单 + 导出修 401"
```

---

