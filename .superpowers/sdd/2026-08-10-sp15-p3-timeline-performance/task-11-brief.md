## Task 11: 收藏页分页 + 精确总数 + 已加载提示

**Files:**
- Modify: `src/photos/stores/favorites.ts`
- Modify: `src/views/PhotosFavorites.vue`
- Modify: `src/i18n/zh_cn.photos.ts` / `src/i18n/en_us.photos.ts`（`photosLoadMore`、`photosLoadedSubsetHint`）
- Test: `src/photos/stores/__tests__/favorites.test.ts`、`src/views/__tests__/PhotosFavorites.test.ts`

**Interfaces:**
- Produces（favorites store）：
  - `favoritesExhausted: Ref<boolean>`、`loadingMore: Ref<boolean>`
  - `favoritesTotal: ComputedRef<number>`
  - `loadMoreFavorites(): Promise<void>`
  - `fetchFavorites()` 语义变为「取第一页并复位游标」
  - 常量 `FAVORITES_PAGE_SIZE = 500`

- [ ] **Step 1: 写失败测试（store）**

```ts
  const A = (id: string) => ({ id, mimeType: 'image/jpeg' })
  const page = (n: number, from = 0) => Array.from({ length: n }, (_, i) => A(`f${from + i}`))

  it('fetchFavorites asks for one page and reports exhaustion on a short page', async () => {
    const s = usePhotosFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(3))
    await s.fetchFavorites()
    expect(svc.photos.listFavorites).toHaveBeenCalledWith(500, 0)
    expect(s.favoritesExhausted).toBe(true)
  })

  it('loadMoreFavorites appends the next page and advances the offset', async () => {
    const s = usePhotosFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(500))
    await s.fetchFavorites()
    expect(s.favoritesExhausted).toBe(false)
    svc.photos.listFavorites.mockResolvedValueOnce(page(2, 500))
    await s.loadMoreFavorites()
    expect(svc.photos.listFavorites).toHaveBeenLastCalledWith(500, 500)
    expect(s.favoritesList).toHaveLength(502)
    expect(s.favoritesExhausted).toBe(true)
  })

  it('refuses to page past the end', async () => {
    const s = usePhotosFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(3))
    await s.fetchFavorites()
    await s.loadMoreFavorites()
    expect(svc.photos.listFavorites).toHaveBeenCalledTimes(1)
  })

  it('does not run two loadMore requests at once', async () => {
    const s = usePhotosFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(500))
    await s.fetchFavorites()
    svc.photos.listFavorites.mockResolvedValue(page(500, 500))
    await Promise.all([s.loadMoreFavorites(), s.loadMoreFavorites()])
    expect(svc.photos.listFavorites).toHaveBeenCalledTimes(2) // first page + one loadMore
  })

  it('discards a stale in-flight page after a refresh (interleaved)', async () => {
    const s = usePhotosFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(500))
    await s.fetchFavorites()
    let release: (v: unknown) => void = () => {}
    svc.photos.listFavorites.mockImplementationOnce(() => new Promise((r) => { release = r }))
    const slow = s.loadMoreFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(1))
    await s.fetchFavorites()          // generation bumps here
    release(page(500, 500))           // the slow page comes back afterwards
    await slow
    expect(s.favoritesList).toHaveLength(1)
    expect(s.loadingMore).toBe(false)
  })

  it('resets the cursor on a failed page so the next attempt does not skip rows', async () => {
    const s = usePhotosFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(500))
    await s.fetchFavorites()
    svc.photos.listFavorites.mockRejectedValueOnce(new Error('boom'))
    await s.loadMoreFavorites()
    expect(s.loadingMore).toBe(false)
    svc.photos.listFavorites.mockResolvedValueOnce(page(1, 500))
    await s.loadMoreFavorites()
    expect(svc.photos.listFavorites).toHaveBeenLastCalledWith(500, 500)
  })

  it('reports the exact total from the id list, and the loaded length before ids land', async () => {
    const s = usePhotosFavorites()
    svc.photos.listFavorites.mockResolvedValueOnce(page(500))
    await s.fetchFavorites()
    expect(s.favoritesTotal).toBe(500)          // favIds not loaded yet: no flash of 0
    svc.photos.listFavoriteIds.mockResolvedValueOnce(Array.from({ length: 1234 }, (_, i) => `f${i}`))
    await s.reconcileFavIds()
    expect(s.favoritesTotal).toBe(1234)
  })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/photos/stores/__tests__/favorites.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现（store）**

```ts
// NimoOS-Photos#54 turned an absent limit from "everything" into 500, so this
// list has to be paged or it silently truncates. A generation counter guards the
// shared state: a slow page that lands after a refresh must be dropped whole
// rather than appended to a list it no longer belongs to.
const FAVORITES_PAGE_SIZE = 500

  const favoritesExhausted = ref(false)
  const loadingMore = ref(false)
  let _offset = 0
  let _generation = 0

  // Exact count from the server's full id list. favoritesList.length is only the
  // pages fetched so far, and favIds lands independently — falling back to the
  // loaded length keeps the header from flashing 0 while ids are in flight.
  const favoritesTotal = computed(() =>
    favIdsLoaded.value ? favIds.value.size : (favoritesList.value?.length ?? 0),
  )
```

`fetchFavorites` 改成取第一页并复位：

```ts
  async function fetchFavorites(): Promise<void> {
    const gen = ++_generation
    loadingMore.value = false
    try {
      const list = (await service.photos.listFavorites(FAVORITES_PAGE_SIZE, 0)) as unknown[]
      if (gen !== _generation) return
      const rows = list ?? []
      favoritesList.value = rows.map((a) => assetToPhoto(a as Record<string, unknown>))
      _offset = rows.length
      favoritesExhausted.value = rows.length < FAVORITES_PAGE_SIZE
      favoritesLoaded.value = true
      loadError.value = false
    } catch (e) {
      if (gen !== _generation) return
      favoritesList.value = []
      _offset = 0
      favoritesExhausted.value = false
      loadError.value = true
      console.error('[photos-favorites] fetchFavorites', e)
    }
  }

  async function loadMoreFavorites(): Promise<void> {
    if (favoritesExhausted.value || loadingMore.value) return
    const gen = _generation
    loadingMore.value = true
    try {
      const list = (await service.photos.listFavorites(FAVORITES_PAGE_SIZE, _offset)) as unknown[]
      // A refresh happened while this page was in flight: drop it entirely.
      if (gen !== _generation) return
      const rows = list ?? []
      favoritesList.value = [
        ...(favoritesList.value ?? []),
        ...rows.map((a) => assetToPhoto(a as Record<string, unknown>)),
      ]
      _offset += rows.length
      if (rows.length < FAVORITES_PAGE_SIZE) favoritesExhausted.value = true
    } catch (e) {
      // Leave the cursor where it was so the retry asks for the same page again
      // rather than skipping it.
      console.error('[photos-favorites] loadMoreFavorites', e)
    } finally {
      if (gen === _generation) loadingMore.value = false
    }
  }
```

`toggle()` 里 `favoritesLoaded.value = false` 之外，**同时**把 `_offset` / `favoritesExhausted`
复位（下次进页面重新从第一页取），并在 `__resetForTest` 里清 `_offset` / `_generation` /
`favoritesExhausted` / `loadingMore`。return 里补四个新导出。

- [ ] **Step 4: 改视图**

`src/views/PhotosFavorites.vue`：
- 「全部 N」那个计数（`:205` 的 `photosFavCount`）改用 `fav.favoritesTotal`
- 网格下方加「加载更多」按钮：`v-if="!fav.favoritesExhausted"`，
  `:disabled="fav.loadingMore"`，文案 `t('photosLoadMore')`
- 统计卡/筛选下拉上方加提示行：`v-if="!fav.favoritesExhausted"`，
  `t('photosLoadedSubsetHint', { n: fav.favoritesList?.length ?? 0 })`，
  样式复用既有 `--fg-muted` 小字，不新增颜色 token
- 按钮/提示行的类名沿用本文件既有小字/次要按钮类，**不新造视觉**

追加视图测试（`src/views/__tests__/PhotosFavorites.test.ts`）：

```ts
  it('shows the load-more button only while pages remain', async () => { /* … */ })
  it('shows the loaded-subset hint with the loaded count', async () => { /* … */ })
  it('shows the exact total in the All chip, not the loaded length', async () => { /* … */ })
```
三例写完整代码，照该文件现有 mount 方式。

- [ ] **Step 5: 加 i18n 两键**

`src/i18n/zh_cn.photos.ts` / `en_us.photos.ts` 按字母序插：

```ts
  photosLoadedSubsetHint: '统计基于已加载的前 {n} 项',
  photosLoadMore: '加载更多',
```
```ts
  photosLoadedSubsetHint: 'Stats reflect the first {n} loaded items',
  photosLoadMore: 'Load more',
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm test src/photos/stores/__tests__/favorites.test.ts src/views/__tests__/PhotosFavorites.test.ts src/i18n && pnpm exec vue-tsc --noEmit`
Expected: 全绿（含 `parity.test.ts`）。

- [ ] **Step 7: 提交**

```bash
git add src/photos/stores/favorites.ts src/views/PhotosFavorites.vue src/views/__tests__/PhotosFavorites.test.ts src/photos/stores/__tests__/favorites.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "fix(photos): page the favorites list instead of asking for everything

An absent limit stopped meaning \"all rows\" on the backend, so this page would
silently show only the first 500 favorites with nothing on screen saying so.
Pages are appended behind a load-more button, the count comes from the full id
list so it stays exact while pagination catches up, and the derived stats say
out loud that they only cover what is loaded. A generation counter drops a page
that lands after a refresh, which would otherwise append rows to a list they no
longer belong to."
```

---

