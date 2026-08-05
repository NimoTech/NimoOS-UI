## Task 9: 两处错误态收口(P3 / P4 遗留)

**Files:**
- Modify: `src/photos/stores/favorites.ts`、`src/views/PhotosFavorites.vue`
- Modify: `src/photos/stores/albums.ts`、`src/views/PhotosAlbumDetail.vue`
- Test: 四个文件各自的既有测试

**Interfaces:**
- Produces: 两个 store 各新增一个 `loadError: Ref<boolean>`;两个视图各新增一个失败态分支(文案 + 重试按钮,用 T2 的 `photosFavoritesLoadFailed` / `photosAlbumLoadFailed` / `photosRetry`)。

**回源实证(缺口的精确形态)**

- **P3 收藏静默空网格**:`favorites.ts:38-53` 的 `fetchFavorites` catch 里把 `favoritesList` 清空、**但不置任何失败标志**;而 `PhotosFavorites.vue:47` 的 `isEmpty = favoritesLoaded && len === 0` 在失败时为**假**(因为 `favoritesLoaded` 只在成功路径置真)⇒ 落进 `v-else` 分支渲染**网格**,而列表是空的 ⇒ **一片空白,没有空态文案也没有错误提示**。
- **P4 相册详情永久骨架**:`albums.ts:56-64` 的 `fetchAlbums` catch 只 `console.error`、**不置 `albumsLoaded`** ⇒ `PhotosAlbumDetail.vue:357` 的 `v-if="!album && !albums.albumsLoaded"` **恒真** ⇒ 永久停在骨架屏。

⚠️ **`favoritesLoaded` / `albumsLoaded` 的「仅成功路径置真」是刻意的**(两处都有注释说明:一次取数失败必须与「确认为空」可区分)。**不要改这个语义** —— 正确修法是**新增**一个失败标志,让视图能落到第三个分支,而不是把 loaded 在失败时也置真。

**逐条契约**

1. 两个 store 各加 `loadError`:进 `try` 前置 `false`,catch 里置 `true`,成功路径置 `false`。
2. 两个视图各加失败态分支,**优先级在骨架之前**(失败已确定,就不该再显示"正在加载")。
3. 失败态里的「重试」按钮重新调对应的 fetch。
4. **重试成功后失败态要消失**(有用例)。

- [ ] **Step 1: 写失败测试**

```ts
// favorites.test.ts
it('fetchFavorites 失败:loadError 置真,favoritesLoaded 保持假(两者语义不同)', async () => { /* … */ })
it('重试成功后 loadError 归假', async () => { /* … */ })

// PhotosFavorites.test.ts
it('加载失败时渲染失败态而非空网格(P3 遗留)', async () => {
  // 断言出现 [data-test="fav-load-error"],且不出现空的网格容器
})
it('失败态的重试按钮重新调 fetchFavorites', async () => { /* … */ })
it('确认为零收藏(成功但列表空)仍走空态,不走失败态', async () => { /* 关键区分 */ })

// albums.test.ts
it('fetchAlbums 失败:loadError 置真,albumsLoaded 保持假', async () => { /* … */ })

// PhotosAlbumDetail.test.ts
it('相册列表加载失败时渲染失败态而非永久骨架(P4 遗留)', async () => { /* … */ })
it('失败态优先于骨架态', async () => { /* loadError 真 + albumsLoaded 假 ⇒ 出失败态,不出骨架 */ })
it('正在加载(未失败)仍走骨架态', async () => { /* 关键区分 */ })
```

- [ ] **Step 2–4: 运行确认失败 → 实现 → 确认通过**

- [ ] **Step 5: 变异验证 + Commit**

变异验证:①把失败态分支的优先级放到骨架之后 → 「失败态优先于骨架」应变红 ②把 `loadError` 在成功路径也置真 → 「确认为零/正在加载」两条区分用例应变红。

```bash
git add src/photos/stores/favorites.ts src/views/PhotosFavorites.vue \
        src/photos/stores/albums.ts src/views/PhotosAlbumDetail.vue
git commit -m "fix(photos): 收藏静默空网格 / 相册详情永久骨架 两处错误态收口(P8a-T9)

P3 与 P4 遗留。新增 loadError 标志走第三分支,不动「loaded 仅成功路径置真」的既有语义
(那是刻意的:一次取数失败必须与「确认为空」可区分)。"
```

---

