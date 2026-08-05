### Task 11: `stores/search.ts`

**Files:**
- Create: `src/photos/stores/search.ts` + `__tests__/search.test.ts`
- Read-only 参考: `photos.js:19-34`(SEARCH_PAGE_LIMIT + seq + searchStateMatchesQuery)、`:241-259`(state)、`:365-401`(4 个 mutation)、`:654-696`(3 个 action)、体例参照 `src/photos/stores/places.ts`

**Interfaces:**
- Produces:
  ```ts
  export const SEARCH_PAGE_LIMIT: 50
  export const usePhotosSearch: StoreDefinition<'photosSearch', {
    results: Ref<Photo[]>
    query: Ref<string>
    filtersPayload: Ref<Record<string, unknown>>
    offset: Ref<number>
    exhausted: Ref<boolean>
    loadingMore: Ref<boolean>
    ms: Ref<number>
    isSearchMode: Ref<boolean>
    matchesQuery: (q: string) => boolean
    smartSearch: (query: string, filters?: Record<string, unknown>) => Promise<void>
    loadMore: () => Promise<void>
    clear: () => void
    __resetForTest: () => void
  }>
  ```
  **`searchActive` 不迁** —— Vue2 用它表示「搜索面板打开但未必搜过」,New-UI 用路由承担(在 `/photos/search` 就是打开),**登记**。

**结构规格:**

1. **`SEARCH_PAGE_LIMIT = 50` 照搬 `photos.js:19-22` 连注释**(它同时是首页大小与 loadMore 的增量)。
2. **`smartSearch(query, filters)`** 照搬 `:654-672` + seq 守卫:
   ```ts
   let searchSeq = 0
   async function smartSearch(q: string, filters: Record<string, unknown> = {}): Promise<void> {
     const trimmed = (q || '').trim()
     if (!trimmed) { clear(); return }          // 照搬 Vue2 :655 的空查询即清空
     const mine = ++searchSeq
     const t0 = Date.now()
     try {
       const res = await service.photos.smartSearch(trimmed, SEARCH_PAGE_LIMIT, 0, filters)
       if (mine !== searchSeq) return           // 在途窗口:旧响应作废
       const list = ((res as unknown[]) ?? []).map(a => assetToPhoto(a as Record<string, unknown>))
       results.value = list
       query.value = trimmed
       filtersPayload.value = filters
       ms.value = Date.now() - t0
       offset.value = 0
       exhausted.value = list.length < SEARCH_PAGE_LIMIT
       loadingMore.value = false
       isSearchMode.value = true
     } catch (e) {
       console.error('[photos-search] smartSearch', e)
     }
   }
   ```
   - **`ms` 的口径**:Vue2 `:657-663` 在 action 里量 wall-clock 并塞进 mutation。照搬。
   - **失败不清空**(照搬 Vue2 的 catch —— 只 log)。**注意:失败时 `query` 不更新 ⇒ `matchesQuery(新词)` 为假 ⇒ 视图停在「在途」态**。Vue2 同病(搜索失败后界面永远显示「搜索中」)。**这是真缺陷:改法 = catch 里把 `isSearchMode` 置真 + `query` 置为 trimmed + `results` 置 `[]`,让视图显示空态而不是永久 loading。偏离登记(新增第 12 条 Vue2 缺陷,回填 spec §7e)。**
2b. 综上,catch 分支改为:
   ```ts
   } catch (e) {
     console.error('[photos-search] smartSearch', e)
     if (mine !== searchSeq) return
     // Vue2 失败时只 log,query 不更新 → searchStateMatchesQuery 恒假 → 视图永久停在
     // "搜索中"(§7e-12)。这里把状态推进到"这个词搜过了、零结果",视图落到空态。
     results.value = []; query.value = trimmed; filtersPayload.value = filters
     ms.value = Date.now() - t0; offset.value = 0
     exhausted.value = true; loadingMore.value = false; isSearchMode.value = true
   }
   ```
3. **`loadMore()`** 照搬 `:677-692` + query 比对守卫:入口短路 `if (loadingMore || exhausted || !query) return`;`nextOffset = offset + SEARCH_PAGE_LIMIT`;`loadingMore = true`;请求用 `filtersPayload`(**照搬「复用同一份 filters」的语义**);回来后 `if (query.value !== capturedQuery) return`(照搬 Vue2 `:686` 的比对);**去重后 concat**(照搬 `:385-387`:用已有 id 的 Set 过滤新页);`offset = nextOffset`;`exhausted = results.length < LIMIT || fresh.length === 0`(**照搬 `:390` 的双条件**);`finally` 复位 `loadingMore`。
4. **`clear()`** 照搬 `:392-401`:全部复位(`results=[]`、`query=''`、`filtersPayload={}`、`offset=0`、`exhausted=false`、`loadingMore=false`、`ms=0`、`isSearchMode=false`)。**`searchSeq` 也要 bump**(否则在途响应会在 clear 之后回填 —— Vue2 没防,**新增,注释登记**)。
5. **`matchesQuery(q)`** = `searchStateMatchesQuery({ isSearchMode: isSearchMode.value, searchQuery: query.value }, q)`(用 T10 的纯函数)。
6. **`Date.now()` 在 store 里可用**;但为可测,把 `now = () => Date.now()` 提成模块级可覆写的内部函数,或在测试里 `vi.spyOn(Date, 'now')`。**选后者(不改生产码形状)。**

- [ ] **Step 1: 写失败测试**

必含用例:
- 空/全空格 query → `clear()` 语义(底层 `smartSearch` **未被调**)。
- 首页成功:`results` 长度 = 返回长度;`isSearchMode` 真;`query` 是 trim 后的;`offset` 0;返回 50 条 → `exhausted` 假;返回 49 条 → 真;`ms` > 0(`Date.now` spy 控制成固定差值,断言精确值)。
- **失败(§7e-12 守卫)**:reject → `isSearchMode` **真**、`results` `[]`、`query` 是新词、`exhausted` 真 ⇒ `matchesQuery(新词)` 为 **真**(视图会落空态而非永久 loading)。**这条是新增修复的主守卫。**
- 竞态两方向:
  - 后发先回:搜 A(慢)→ 搜 B(快)→ B 先回填 → A 回来被丢弃 → 最终 `query === 'B'`。
  - 先发先回:A 快 B 慢 → 最终仍是 B。
  - **`clear()` 后在途响应不回填**:发起搜索 → `clear()` → 让响应 resolve → `results` 仍 `[]`、`isSearchMode` 仍假(**新增 seq bump 的主守卫**)。
- `loadMore`:未搜过(`query` 空)→ 底层未被调;`exhausted` 真 → 未被调;`loadingMore` 真 → 未被调;正常 → 参数是 `(query, 50, 50, filtersPayload)`(**offset 是 50 不是 1**);去重:新页含一条与首页重复的 id → 结果长度只 +（新页长度-1)；`fresh.length === 0` → `exhausted` 真;新页返 30 条(<50)→ `exhausted` 真;新页返 50 条全新 → `exhausted` 假、`offset` 变 50。
- `loadMore` 期间 query 变了(模拟用户改搜索词)→ 旧页响应**不 concat**。
- `loadMore` 失败 → `loadingMore` 复位为假(**`finally` 守卫**)。
- `clear()` 复位全部 8 个字段。
- `matchesQuery`:搜过 `'abc'` → `matchesQuery('abc')` 真、`matchesQuery(' abc ')` 真(trim)、`matchesQuery('abd')` 假;未搜过 → 恒假。

- [ ] **Step 2: 跑测试确认失败** — `pnpm exec vitest run src/photos/stores/__tests__/search.test.ts`

- [ ] **Step 3: 实现**

- [ ] **Step 4: 跑全量 + tsc,逐个删码验证**

删码清单:①`smartSearch` 的 `if (mine !== searchSeq) return` → 后发先回用例红;②catch 里的状态推进(§7e-12)→ 失败用例红;③`clear()` 里的 `searchSeq` bump → 「clear 后不回填」用例红;④`loadMore` 的 query 比对 → 「query 变了不 concat」用例红;⑤去重的 Set → 重复 id 用例红;⑥`exhausted` 的 `fresh.length === 0` 那半 → 对应用例红;⑦`finally` 的 `loadingMore` 复位 → 失败复位用例红。

- [ ] **Step 5: Commit**

```bash
git add src/photos/stores/search.ts src/photos/stores/__tests__/search.test.ts
git commit -m "feat(photos): P7a-T11 搜索 store —— seq 守卫 + 分页去重 + 失败落空态(修 Vue2 永久 loading)"
```

---

