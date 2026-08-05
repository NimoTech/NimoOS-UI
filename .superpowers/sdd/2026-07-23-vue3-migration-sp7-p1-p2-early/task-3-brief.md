### Task 3: `useLightbox` 明细水合 + 收藏

**Files:**
- Modify: `src/photos/lightbox/useLightbox.ts`
- Test: `src/photos/lightbox/__tests__/useLightbox.test.ts`(追加 describe)

**Interfaces:**
- Consumes:`service.photos.getAsset(id)`(裸体 `PhotoAsset`)、`service.photos.getAssetOcr(id,q)`(裸体,仅当 `searchQuery` 非空)、`service.photos.listFavoriteIds()`(裸体数组,`?? []`)、`service.photos.favorite(id)`/`unfavorite(id)`;`assetToPhoto`(`src/photos/util/assetToPhoto.ts`);Task 1 无。
- Produces(在 T2 返回对象上追加):
  - state:`detail: Ref<Photo | null>`(当前项 EXIF 水合结果;未水合前 = `current`)、`ocrLines: Ref<Array<{box:number[]}>>`、`favIds: Ref<Set<string>>`
  - getters:`isFav: ComputedRef<boolean>`(`current && favIds.has(String(current.id))`)
  - actions:`hydrateDetail(): Promise<void>`(seq 守卫:`getAsset` → `assetToPhoto` → 若仍是当前项才写 `detail`;顺带若 `searchQuery && !current.isVideo` 则 `getAssetOcr` 写 `ocrLines`,否则清空)、`reconcileFav(): Promise<void>`(`listFavoriteIds` → `favIds = new Set(ids.map(String))`)、`toggleFav(): Promise<void>`(乐观翻转 `favIds`、按翻转后状态调 `favorite`/`unfavorite`、失败回滚)
  - **openAt / goTo / prev / next 增补**:每次当前项变化后 `detail = current`(立即)、bump `_hydrateSeq`、`void hydrateDetail()`;`openAt` 额外 `void reconcileFav()`。
- **seq 守卫**(P1 铁律):`hydrateDetail` await 前捕获 `const seq = ++_hydrateSeq` 与 `const id = current.value?.id`,await 后 `if (seq !== _hydrateSeq || current.value?.id !== id) return`——过期结果绝不回写(翻页快过网络时不串图)。

- [ ] **Step 1: 写失败测试**(追加)
```ts
describe('useLightbox 水合+收藏', () => {
  // service mock 扩展:getAsset/getAssetOcr/listFavoriteIds/favorite/unfavorite/recordView
  it('openAt 后 detail 先等于当前项、getAsset 到达后合并', async () => { /* mock getAsset 返 {id,make:'Nikon'} → detail.camera 反映 */ })
  it('翻页时过期 getAsset 结果被 seq 守卫丢弃(先解析旧的、当前已是新项 → detail 不被旧值覆盖)', async () => { /* 两个延迟不同的 getAsset,断言 detail 是最后一项 */ })
  it('searchQuery 为空不发 getAssetOcr;非空且非视频才发', async () => {})
  it('reconcileFav 播种 favIds、isFav 反映当前项', async () => {})
  it('toggleFav 乐观翻转并调 favorite/unfavorite;失败回滚', async () => { /* unfavorite reject → favIds 恢复含该 id */ })
})
```
> 实现者按上述行为补全断言体(mock 用裸体形状:`getAsset` 返裸对象、`listFavoriteIds` 返裸数组)。
- [ ] **Step 2: RED**;**Step 3: 实现**(seq 守卫见上;`favIds` 用 `new Set` 重新赋值触发响应式);**Step 4: GREEN + 全量 + tsc**。
- [ ] **Step 5: Commit** — `feat(photos): useLightbox 明细水合(seq 守卫)+ 收藏播种/乐观 toggle`

---

