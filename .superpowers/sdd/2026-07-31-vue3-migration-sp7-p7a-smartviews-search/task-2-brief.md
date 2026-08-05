### Task 2: `stores/smartViews.ts` —— 全套 CRUD + byId + 两把 seq 守卫 + 5 把重入锁

**Files:**
- Create: `src/photos/stores/smartViews.ts`
- Create: `src/photos/stores/__tests__/smartViews.test.ts`
- Read-only 参考: `NimoOS-UI/src/store/modules/photos.js:487-501`(5 个 mutation)、`:998-1075`(7 个 action)、`PhotosSmartViewsView.vue:366-382`(refreshPreview)、`PhotosSmartViewDetail.vue:409-423`(loadDetail)、`.sp7/NimoOS-Service/src/photos.ts:295-336`、`NimoOS-Photos/service/smartview.go:21-34`+`:729-733`、体例参照 `src/photos/stores/places.ts`

**Interfaces:**
- Consumes: `service.photos.*`(11 个智能视图方法)
- Produces:
  ```ts
  export interface SmartView {
    id: string; name: string; description: string
    conds: string[]; threshold: number; live: boolean; includeVideos: boolean
    count: number; addedThisWeek: number; seeds: string[]
    median: number; storageBytes: number; distribution: number[]; evaluatedAt: string
  }
  export interface SmartViewActivity {
    id: string; eventType: string; detail: string; assetIds: string[]; occurredAt: string
  }
  export interface SmartViewPreview { count: number; seeds: string[]; thresholdActive: boolean }
  export interface CreateSmartViewInput {
    name: string; description: string; conds: string[]
    threshold: number; live: boolean; includeVideos: boolean
  }
  export interface DeletedSmartView { sv: SmartView; index: number }

  export const usePhotosSmartViews: StoreDefinition<'photosSmartViews', {
    smartViews: Ref<SmartView[]>
    listLoaded: Ref<boolean>
    listLoading: Ref<boolean>
    matchedAssets: Ref<Photo[]>      // Photo 来自 util/assetToPhoto
    recentAssets: Ref<Photo[]>
    activity: Ref<SmartViewActivity[]>
    detailLoading: Ref<boolean>
    preview: Ref<SmartViewPreview>
    createBusy: Ref<boolean>; patchBusy: Ref<boolean>
    deleteBusy: Ref<boolean>; duplicateBusy: Ref<boolean>; exportBusy: Ref<boolean>
    byId: (id: string) => SmartView | null
    fetchSmartViews: () => Promise<void>
    createSmartView: (input: CreateSmartViewInput) => Promise<SmartView | null>
    updateSmartView: (id: string, patch: Partial<CreateSmartViewInput>) => Promise<void>
    deleteSmartView: (id: string) => Promise<DeletedSmartView | null>
    restoreSmartView: (payload: DeletedSmartView) => Promise<void>
    duplicateSmartView: (id: string) => Promise<void>
    loadDetail: (id: string) => Promise<void>
    refreshPreview: (input: Omit<CreateSmartViewInput, 'name' | 'live'>) => void
    exportAlbum: (id: string) => Promise<void>
    __resetForTest: () => void
  }>
  ```

**结构规格:**

1. **`toSmartView(raw)` 归一函数**(照 `places.ts:102-119` 的 `toPlaceDetail` 体例):`id: String(r.id)`、`conds: Array.isArray(r.conds) ? r.conds : []`、`seeds` 同、`distribution: Array.isArray(r.distribution) && r.distribution.length ? r.distribution : new Array(10).fill(0)`(**照搬 Vue2 `:316` 的兜底**)、`median: Number(r.median ?? 0)`、`storageBytes: Number(r.storageBytes ?? 0)`、`evaluatedAt: String(r.evaluatedAt ?? '')`、`count`/`addedThisWeek` 直接 `Number(r.x ?? 0)`、`description: String(r.description ?? '')`、布尔 `Boolean(...)`。
2. **`byId(id)` 是本期的核心修复(§7e-2 / 偏离登记 4)**:`smartViews.value.find(s => String(s.id) === String(id)) ?? null`。**详情页只通过它拿数据,不许持有对象引用。** 写注释说明 Vue2 的 bug 与这里为什么是结构性修复。
3. **`fetchSmartViews`**:`listSmartViews()` → `?? []` → `.map(toSmartView)`;成功才置 `listLoaded = true`(照 `places.ts` 的 `placesLoaded` 手法,失败留 false 可重试);`finally` 复位 `listLoading`。
4. **`createSmartView(input)`**:`createBusy` 短路 + `finally` 复位。**id 由后端给,不再像 Vue2 `:422` 那样前端自造 `'sv-' + Date.now().toString(36)`**(偏离登记:`Date.now()` 造 id 在两个客户端同毫秒建会撞,且后端 `createSmartView` 的响应就带 id;Vue2 传 id 进去是让后端沿用,New-UI 不传、由后端生成)。请求体字段名照共享包:`{ name, description, condsRaw: conds, threshold, live, includeVideos }`(**注意是 `condsRaw` 不是 `conds`** —— 后端 `SmartViewCreate` 的 json tag 是 `condsRaw`,见 `smartview.go:41`)。成功 → `smartViews.value.unshift(created)` 并 `return created`。**Vue2 `:1018-1021` 的 catch 里还 `commit('ADD_SMART_VIEW', sv)`(失败也往列表塞一个本地对象)—— 不照搬**(那是「乐观撒谎」:界面出现一个后端上不存在的智能视图,刷新就没了)。改为 rethrow,视图层 catch → toast。**偏离登记。**
5. **`updateSmartView(id, patch)`**:`patchBusy` 短路。请求体 `conds` → `condsRaw` 改名(照 Vue2 `:1027-1028`)。响应有 body 则用 `toSmartView(res)` 整体替换列表项,无 body 则就地合并 `patch`。**替换必须 `splice(i, 1, next)`**(保持数组顺序),`i` 用 `String()` 归一查找。**Vue2 `:1032-1033` 的 catch 里仍 commit 本地 patch —— 不照搬**(同上,乐观撒谎),rethrow。
6. **`deleteSmartView(id)`**:`deleteBusy` 短路。先 `index = findIndex(String 归一)`,`index < 0` → 返 `null`(照搬 Vue2 `:1037-1038`);`await deleteSmartView(id)` 成功后从数组移除并返 `{ sv, index }` 供撤销;失败 rethrow(Vue2 `:1042-1043` 是 catch 后 `return null`,**吞掉了错误** —— 不照搬,rethrow 让视图层能弹 toast。偏离登记)。
7. **`restoreSmartView(payload)`**:`deleteBusy` 共用(同一份资源的互斥写)。`createSmartView({ ...payload.sv, condsRaw: payload.sv.conds })` **带上原 id**(这里**要**传 id —— 撤销的语义是恢复同一个智能视图,与 `createSmartView` 不传 id 是两回事,**写注释区分**);成功后 `splice(Math.max(0, Math.min(payload.index, len)), 0, payload.sv)`(照搬 Vue2 `:497-498` 的钳制)。
8. **`duplicateSmartView(id)`**:`duplicateBusy` 短路;调包内 `duplicateSmartView`,成功后把返回对象 `unshift` 进列表(**Vue2 `:1060` 的 mutation 只重新 fetch 或 unshift,回源确认后照做**)。
9. **`loadDetail(id)`** —— 三请求并行 + **seq 守卫**(§7e-7 / 偏离登记 9):
   ```ts
   let detailSeq = 0
   async function loadDetail(id: string): Promise<void> {
     const mine = ++detailSeq
     detailLoading.value = true
     // 成功路径也要先清旧数据 —— 否则第二次加载时骨架门控已过,会继续渲染上一个
     // 智能视图的照片与活动流(P6b 终审 I2 的同型缺陷,清空必须在 await 之前)。
     matchedAssets.value = []; recentAssets.value = []; activity.value = []
     try {
       const [all, recent, act] = await Promise.all([
         service.photos.getSmartViewAssets(id, { limit: 60, offset: 0 }),
         service.photos.getSmartViewAssets(id, { limit: 12, offset: 0, recent: true }),
         service.photos.getSmartViewActivity(id, 10),
       ])
       if (mine !== detailSeq) return
       matchedAssets.value = ((all as unknown[]) ?? []).map(a => assetToPhoto(a as Record<string, unknown>))
       recentAssets.value = ((recent as unknown[]) ?? []).map(a => assetToPhoto(a as Record<string, unknown>))
       activity.value = ((act as unknown[]) ?? []).map(toActivity)
     } catch (e) {
       console.error('[photos-smartviews] loadDetail', e)
     } finally {
       if (mine === detailSeq) detailLoading.value = false
     }
   }
   ```
   **`limit: 60 / 12 / 10` 三个数字逐字照搬 Vue2 `:413-415`,不要改。**
10. **`refreshPreview(input)`** —— 300ms debounce **+ seq 守卫**(节奏照搬,守卫新增):模块级 `let previewTimer: ReturnType<typeof setTimeout> | null`、`let previewSeq = 0`。每次调用先 `clearTimeout`,再 `setTimeout(async () => { const mine = ++previewSeq; … if (mine !== previewSeq) return; … }, 300)`。**`thresholdActive` 的判据照搬 Vue2 `:378`:`!res || res.thresholdActive !== false`**(即缺字段视为生效)。失败只 `console.error`,**不清空 preview**(照搬 Vue2 的 catch 行为 —— 预览失败时保留上一次的计数比闪成 0 好)。
11. **`exportAlbum(id)`**:`exportBusy` 短路;调 `exportSmartViewAlbum(id)`;rethrow 让视图层分流 toast 文案。**注意导出 ZIP 不进 store**(它是纯浏览器下载行为,由 T8 在视图层做带 `Authorization` 的 fetch + blob,见 Global Constraints)。
12. **`__resetForTest()`** 复位所有 ref + 两个 seq + 清 timer(照 `places.ts` 的既有实现)。
13. **`toActivity(raw)`**:`id: String(r.id)`、`eventType: String(r.eventType ?? '')`、`detail: String(r.detail ?? '')`、`assetIds: Array.isArray(r.assetIds) ? r.assetIds.map(String) : []`、`occurredAt: String(r.occurredAt ?? '')`。

- [ ] **Step 1: 写失败测试**

`smartViews.test.ts` 必含用例(mock 手法照 `places.test.ts:1-27`;fixture 形状照 `smartview.go:21-34` 逐字段核对,**不要凭想象编**):
- `fetchSmartViews`:后端返 `null` → `smartViews` 为 `[]` 且 `listLoaded === true`;返两条 → 长度 2、`id` 已 `String()` 化;抛错 → `smartViews` 保持原值(不清空)、`listLoaded` 仍 `false`、`console.error` 被调。
- `toSmartView` 兜底:后端省略 `median`/`storageBytes`/`distribution`/`evaluatedAt` → 分别得 `0`/`0`/长度 10 全 0 的数组/`''`;`conds: null` → `[]`;`seeds` 缺 → `[]`。
- `byId`:后端 id 是数字 `7` 时 `byId('7')` 命中(**String 归一主守卫**);不存在 → `null`。
- `createSmartView`:请求体第一个参数含 `condsRaw` 且**不含** `conds`(`expect(createApi).toHaveBeenCalledWith(expect.objectContaining({ condsRaw: ['a'] }))`;并断言 `expect(arg).not.toHaveProperty('conds')`);**不含 `id`**(偏离登记 4);成功 → 新项在数组**首位**;`createBusy` 期间二次调用直接返 `null` 且底层只被调一次;失败 → **rethrow** 且数组长度不变(**反向断言 Vue2 的乐观撒谎没被照抄**)。
- `updateSmartView`:`patch.conds` 被改名成 `condsRaw` 发出;响应带 body → 列表项被整体替换且**位置不变**(原位在 index 1 的项改完仍在 index 1);响应无 body → 就地合并;失败 → rethrow 且列表项**未被本地改动**。
- `deleteSmartView` / `restoreSmartView`:删不存在的 id → `null` 且底层未被调;删成功 → 返 `{ sv, index }` 且数组移除;`restore` 把它插回**原 index**;`index` 超界(如 99)→ 插到末尾(钳制);restore 请求体**带 id**。
- `loadDetail` 竞态两条(**必须两个方向都有**):
  - 「后发先回」:A(id=1)慢、B(id=2)快 → B 先回填,A 回来时被丢弃 → 最终是 B 的数据。
  - 「先发先回」:A 快、B 慢 → A 回填后被 B 覆盖 → 最终是 B 的数据,且 `detailLoading` 最终为 `false`(**这条钉住 `finally` 里的 `mine === detailSeq` 门控**)。
  - **清旧数据**:先 `loadDetail('1')` 成功(有 3 条 matched),再发 `loadDetail('2')`,在其 await 未 resolve 时断言 `matchedAssets` 已是 `[]`(**清空发生在 await 之前**)。
  - 三个请求的参数逐字断言:`getSmartViewAssets(id, { limit: 60, offset: 0 })`、`(id, { limit: 12, offset: 0, recent: true })`、`getSmartViewActivity(id, 10)`。
- `refreshPreview`:用 `vi.useFakeTimers()`;连续调 3 次只发 1 个请求(debounce);两次相隔超过 300ms 且**前一次响应更慢**时,旧响应不覆盖新结果(seq 守卫 —— 这条要手动控制两个 promise 的 resolve 顺序);响应缺 `thresholdActive` → `thresholdActive === true`;显式 `false` → `false`;失败 → preview **保留上一次的值**。
- 5 把重入锁各一条:busy 期间二次调用底层只被调一次,且 `finally` 后 busy 复位为 `false`(**失败路径也要复位** —— 各写一条抛错用例)。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/photos/stores/__tests__/smartViews.test.ts`
Expected: FAIL(模块不存在)

- [ ] **Step 3: 实现 store**

- [ ] **Step 4: 跑测试 + tsc,逐个删码验证**

Run: `pnpm exec vitest run src/photos/stores/__tests__/smartViews.test.ts && pnpm exec vue-tsc --noEmit`

删码清单:①`loadDetail` 的 `if (mine !== detailSeq) return` → 「后发先回」用例红;②`finally` 里的 `mine === detailSeq` 门控 → 「先发先回」的 `detailLoading` 断言红;③await 前的三行清空 → 「清旧数据」用例红;④`byId` 的 `String()` → 数字 id 用例红;⑤`refreshPreview` 的 seq 守卫 → 慢响应覆盖用例红;⑥`restoreSmartView` 的 `Math.min` 钳制 → 超界 index 用例红;⑦任一 busy 的入口短路 → 对应重入用例红;⑧`distribution` 的长度兜底 → 兜底用例红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/stores/smartViews.ts src/photos/stores/__tests__/smartViews.test.ts
git commit -m "feat(photos): P7a-T2 智能视图 store —— byId 结构性修复 + 两把 seq 守卫 + 5 把重入锁"
```

---

