### Task 2: `appstore` store 加 `invalidate()`

**Files:**
- Modify: `src/apps/stores/appstore.ts`(在 `loadDetail` 之后、`isInstalled` 之前加函数;`return` 对象补导出)
- Test: `src/apps/stores/appstore.test.ts`(追加用例,沿用该文件既有 svc mock 形态)

**Interfaces:**
- Consumes: 现有 `categories`/`catalogLoaded` refs。
- Produces: `invalidate(): void` —— Task 3 的 sources store 在注册成功/注销成功后调用。

- [ ] **Step 1: 写失败测试**

在 `src/apps/stores/appstore.test.ts` 追加(沿用文件顶部既有的 `svc` mock;若其 `categories`/`listApps` mock 名不同,按实际适配,断言语义不变):

```ts
it('invalidate 清 categories 缓存:下次 loadCatalog 重拉分类', async () => {
  const store = useAppstoreStore()
  svc.appstore.categories.mockResolvedValue([{ name: 'Media', count: 2 }])
  svc.appstore.listApps.mockResolvedValue({ installed: [], list: {} })

  await store.loadCatalog()
  await store.loadCatalog()
  expect(svc.appstore.categories).toHaveBeenCalledTimes(1) // length 守卫命中

  store.invalidate()
  expect(store.catalogLoaded).toBe(false)
  await store.loadCatalog()
  expect(svc.appstore.categories).toHaveBeenCalledTimes(2) // 缓存已失效,重拉
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/apps/stores/appstore.test.ts`
Expected: FAIL(`store.invalidate is not a function`)

- [ ] **Step 3: 实现**

在 `src/apps/stores/appstore.ts` 的 `loadDetail` 函数后加:

```ts
  /** 商店源增删后目录已变:清 categories 缓存(loadCatalog 有 length 守卫,不清不会重拉)
   *  并复位 catalogLoaded,下次进商店页整体重拉。featured 每次 mounted 都重拉,无缓存守卫,不用清。 */
  function invalidate() {
    categories.value = []
    catalogLoaded.value = false
  }
```

`return` 对象的 actions 行改为:

```ts
    loadCatalog, retry, loadFeatured, loadDetail, isInstalled, invalidate,
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/apps/stores/appstore.test.ts`
Expected: PASS(既有用例 + 新用例全绿)

- [ ] **Step 5: Commit**

```bash
git add src/apps/stores/appstore.ts src/apps/stores/appstore.test.ts
git commit -m "P7: appstore store 加 invalidate(),源增删后目录缓存失效"
```

---

