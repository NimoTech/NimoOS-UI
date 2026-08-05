# Task 5 报告:PhotosGrid 恢复 per-tile 收藏星标

## 变更

- `src/photos/components/PhotosGrid.vue`
  - `<script setup>` 新增 `import { usePhotosFavorites } from '../stores/favorites'` + `const fav = usePhotosFavorites()`。
  - 磁贴内(`.tile-check` 之后)新增 `<button class="tile-fav">`:
    - `:class="{ 'is-fav': fav.isFav(p.id) }"` —— 值比较,不用对象引用。
    - `:aria-label="fav.isFav(p.id) ? t('photosUnfavorite') : t('photosFavorite')"`。
    - `@click.stop="fav.toggle(p.id)"` —— 阻止冒泡到 `onTileClick`(open/toggle-select)。
    - SVG 五角星图标(与 `PhotoLightbox.vue` 的 `.lb-fav` 同一份 path,保持三处视觉同源:时间线/收藏视图/灯箱)。
  - 未新增 emit —— 收藏是全局横切态,grid 直接调 store,与 `open`/`toggle-select` 的视图级 emit 分工不变。
  - CSS:`.tile-fav` 绝对定位右上角(`.tile-check` 在左上,不冲突);`background: var(--overlay-bg)`,`color: var(--fg)`;`.tile-fav.is-fav` 恒显(`opacity:1`),未收藏项仅 `.tile:hover .tile-fav` 时显(描边星,`fill:none`);已收藏用 `var(--star-fg, #ffd60a)` 金色(与 `PhotoLightbox.vue:327` 的 `.lb-fav.is-fav` 同一 fallback-token 写法 —— `--star-fg` 两套主题均未定义具体值,fallback 恒生效,color-guard 因 `var(...)` 整段被剥离而合规)。

- `src/photos/components/__tests__/PhotosGrid.test.ts`
  - 新增 `import { createPinia, setActivePinia } from 'pinia'` + `import { usePhotosFavorites } from '../../stores/favorites'`。
  - `svc.photos` mock 补 `listFavoriteIds`/`favorite`/`unfavorite`。
  - 顶层 `beforeEach` 补 `setActivePinia(createPinia())`(PhotosGrid 现在无条件调用 `usePhotosFavorites()`,任何挂载都需要激活的 pinia,即使该用例不碰收藏)。
  - 新增 `describe('per-tile favorite star (SP7-P3 Task 5...)')` 5 条用例:已收藏显 `is-fav`、未收藏不显、点击调 `fav.toggle(id)` 且不冒泡 `open`/`toggle-select`(含 selecting 态下同样只切收藏不切选择)、aria-label 随态切换。

## i18n

**未新增任何键。** `photosFavorite`/`photosUnfavorite` 在 `src/i18n/zh_cn.ts:564-565` 和 `src/i18n/en_us.ts:565-566` 已存在 —— 由更早的 `PhotoLightbox.vue`(P2 灯箱收藏按钮)落地时加入,本任务直接复用,无需再加、也未与 Task 7 产生键冲突。

## TDD 证据

1. **RED**:先加 5 条新测试(星标存在性/is-fav/click.stop/selecting 态/aria-label),`pnpm exec vitest run src/photos/components/__tests__/PhotosGrid.test.ts` → 5 failed(`.tile-fav` 不存在)、19 pre-existing passed(证明未破坏既有行为)。
2. **实现**:上述 PhotosGrid.vue 改动。
3. **GREEN**:同文件重跑 → 24 passed。
4. **全量**:`pnpm test` → **241 files / 1472 tests all passed**(含 `src/styles/color-guard.test.ts` 与 `src/i18n/parity.test.ts`,单独重跑确认 111 passed)。
5. **类型检查**:`pnpm exec vue-tsc --noEmit` 初次报 2 处 `Type 'string' is not assignable to type 'never'`(`listFavoriteIds` mock 未标注返回类型,推断为 `Promise<never[]>`),补 `vi.fn<() => Promise<Array<string | number>>>(...)` 泛型标注(与 `PhotoLightbox.test.ts` 同款写法)后 **tsc 无输出、全绿**。

## 自审

- `@click.stop` 已用测试断言验证不触发 `open`/`toggle-select`,含 selecting 态。
- `fav.isFav(p.id)` 全程值比较(store 内部用 `Set<string>` + `String(id)` 键控),未引入对象引用比较。
- 颜色全部 token 化:`var(--overlay-bg)`、`var(--fg)`、`var(--star-fg, #ffd60a)`(fallback 写法与 P2 灯箱同precedent,color-guard 已跑绿确认合规)。
- 删除路径未动(仍走父层 selection toolbar / 灯箱)。

## Commit

`feat(photos): PhotosGrid 恢复 per-tile 收藏星标(消费 photosFavorites store)`
