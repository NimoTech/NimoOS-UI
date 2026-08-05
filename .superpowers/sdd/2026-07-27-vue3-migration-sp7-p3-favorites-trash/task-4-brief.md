### Task 4: useLightbox 重构 — 收藏态委托 `photosFavorites` store

**Files:**
- Modify: `src/photos/lightbox/useLightbox.ts`
- Test: `src/photos/lightbox/__tests__/useLightbox.test.ts`（改收藏相关用例;`recordView` 现走 store 节流)

**Interfaces:**
- Consumes:Task 1 `usePhotosFavorites`。
- 变更(**对外契约保持** `isFav`/`toggleFav`/`reconcileFav`——PhotoLightbox.vue 无需改;`favIds` 从公共返回对象**移除**,住 store):
  1. 删模块级 `const favIds = ref<Set<string>>(new Set())`(现 `:14`)。
  2. `isFav`(现 `:20`)改:`computed(() => { const fav = usePhotosFavorites(); return !!(current.value && fav.isFav(current.value.id)) })`（`usePhotosFavorites()` 在 computed 内惰性调用,求值时 pinia 已激活)。
  3. `reconcileFav`(现 `:121-128`)改为薄委托:`async function reconcileFav() { await usePhotosFavorites().reconcileFavIds() }`。
  4. `toggleFav`(现 `:130-149`)改为薄委托:`async function toggleFav() { const item = current.value; if (item) await usePhotosFavorites().toggle(item.id) }`。
  5. `openAt` 里 `recordView`(现 `:61` `void service.photos.recordView(...)`)改走 store 节流:`usePhotosFavorites().recordView(photo.id)`(删除对 `service.photos.recordView` 的直接调用与 import 若不再他用)。`:63` `void reconcileFav()` 保留(现委托 store)。
  6. 从公共返回对象与类型签名删 `favIds`(现 `:167,190`);`__resetForTest`(现 `:151-157`)删 `favIds.value = new Set()` 行(favIds 已不在此)。
- **history/翻页/水合逻辑不动**(P2 已验收)。

- [ ] **Step 1: 改测试**（`useLightbox.test.ts`:加 `setActivePinia(createPinia())` 于 `beforeEach`;删/迁移「useLightbox 自持 favIds」的直接断言,改为断言委托 store —— 收藏契约的核心单测已在 Task 1 `favorites.test.ts` 覆盖,此处只验「灯箱 toggleFav → store.toggle 被调」「openAt → store.recordView 被调(节流)」「isFav 反映 store」）。示例:
```ts
import { setActivePinia, createPinia } from 'pinia'
import { usePhotosFavorites } from '../../stores/favorites'
// beforeEach: setActivePinia(createPinia()); useLightbox().__resetForTest()

it('openAt 走 store.recordView(节流),reconcile 播种', async () => {
  const fav = usePhotosFavorites()
  const spy = vi.spyOn(fav, 'recordView')
  useLightbox().openAt(P('b'), [P('a'), P('b')])
  expect(spy).toHaveBeenCalledWith('b')
})
it('toggleFav 委托 store.toggle;isFav 反映 store', async () => {
  const fav = usePhotosFavorites()
  const spy = vi.spyOn(fav, 'toggle').mockResolvedValue()
  const lb = useLightbox(); lb.openAt(P('a'), [P('a')])
  await lb.toggleFav()
  expect(spy).toHaveBeenCalledWith('a')
})
```
> **注意**:此前 `useLightbox.test.ts` 里 mock `@nimotech/nimoos-service` 时需保留 `favorite`/`unfavorite`/`listFavoriteIds`/`recordView` mock(store 内部用);或改为不 spy service、直接 spy store 方法(推荐,解耦)。改测试必须先 **RED 验证**:还原一处生产修复(如把 `usePhotosFavorites().recordView` 换回 `service.photos.recordView`)→ 对应用例失败 → 恢复 → 绿。

- [ ] **Step 2: RED**（先跑改后的测试,确认对未改的生产码失败)；**Step 3: 实现重构**；**Step 4: GREEN + 全量 + tsc**（`PhotoLightbox.test.ts` 应仍绿——契约未变;若因 pinia 未挂而红,给其测试补 `setActivePinia`）。
- [ ] **Step 5: Commit** — `refactor(photos): useLightbox 收藏态委托 photosFavorites store(三处同源)`

---

