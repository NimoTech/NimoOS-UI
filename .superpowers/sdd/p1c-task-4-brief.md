### Task 4: `FavoriteStar.vue` + 悬停接入 FileRow/FileTile(+ 列表头对齐)

**Files:**
- Create: `src/files/components/FavoriteStar.vue`
- Create: `src/files/components/FavoriteStar.test.ts`
- Modify: `src/files/components/FileRow.vue`(尾部加星标格)
- Modify: `src/files/components/FileTile.vue`(右上角叠加星标)
- Modify: `src/files/components/FileListView.vue`(表头加对齐用空星标列)
- Modify: `src/files/components/FileRow.test.ts`(stubs 加 FavoriteStar)

**Interfaces:**
- Consumes:`useFavoritesStore`(Task3)。
- Produces:`FavoriteStar.vue` props `{ path: string; name: string }`(path=真实路径),根 `<button class="favorite-star">`,`@click.stop` 切换收藏。

- [ ] **Step 1: 写失败测试**

`src/files/components/FavoriteStar.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import FavoriteStar from './FavoriteStar.vue'
import { useFavoritesStore } from '../stores/favorites'

vi.mock('@nimotech/nimoos-service', () => ({
  service: { users: {
    getCustomStorage: vi.fn().mockResolvedValue([]),
    setCustomStorage: vi.fn().mockResolvedValue(undefined),
  } },
}))

describe('FavoriteStar', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('shows ☆ when not favorited, adds and flips to ★ on click', async () => {
    const w = mount(FavoriteStar, { props: { path: '/DATA/Docs', name: 'Docs' } })
    expect(w.text()).toBe('☆')
    await w.trigger('click')
    const fav = useFavoritesStore()
    expect(fav.isFavorite('/DATA/Docs')).toBe(true)
    expect(w.text()).toBe('★')
  })

  it('shows ★ when already favorited and removes on click', async () => {
    const fav = useFavoritesStore()
    await fav.add({ name: 'Docs', path: '/DATA/Docs' })
    const w = mount(FavoriteStar, { props: { path: '/DATA/Docs', name: 'Docs' } })
    expect(w.text()).toBe('★')
    await w.trigger('click')
    expect(fav.isFavorite('/DATA/Docs')).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/components/FavoriteStar.test.ts`
Expected: FAIL(`Cannot find module './FavoriteStar.vue'`)

- [ ] **Step 3: 写 `FavoriteStar` 实现**

`src/files/components/FavoriteStar.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useFavoritesStore } from '../stores/favorites'

const props = defineProps<{ path: string; name: string }>()
const favorites = useFavoritesStore()
const active = computed(() => favorites.isFavorite(props.path))
function toggle() {
  if (active.value) favorites.remove(props.path)
  else favorites.add({ name: props.name, path: props.path })
}
</script>

<template>
  <button class="favorite-star" :class="{ active }" :aria-pressed="active" @click.stop="toggle">{{ active ? '★' : '☆' }}</button>
</template>

<style scoped>
.favorite-star { background: none; border: none; cursor: pointer; color: var(--fg-muted, #9aa4bf); font-size: 15px; line-height: 1; padding: 2px 4px; }
.favorite-star.active { color: var(--accent, #f5c451); }
</style>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/components/FavoriteStar.test.ts`
Expected: PASS(2 用例)

- [ ] **Step 5: 接入 `FileRow.vue`(尾部星标格,悬停/激活显)**

在 `src/files/components/FileRow.vue` import 区加:
```ts
import FavoriteStar from './FavoriteStar.vue'
```
在 `<span class="file-size">...</span>` 之后、`</div>` 之前加一格:
```html
    <span class="file-star"><FavoriteStar :path="props.entry.path" :name="props.entry.name" /></span>
```
在 `<style scoped>` 内追加(星标平时隐藏,行悬停或已收藏时显;`:deep` 穿透子组件根类):
```css
.file-star { flex: 0 0 32px; display: flex; justify-content: center; }
.file-row :deep(.favorite-star) { opacity: 0; transition: opacity .12s; }
.file-row:hover :deep(.favorite-star), .file-row :deep(.favorite-star.active) { opacity: 1; }
```

- [ ] **Step 6: 接入 `FileTile.vue`(右上角叠加星标)**

在 `src/files/components/FileTile.vue` import 区加:
```ts
import FavoriteStar from './FavoriteStar.vue'
```
把根 `<div class="file-tile" ...>` 内首行之前加叠加星标(放在 `<FileThumb>` 之前即可):
```html
    <FavoriteStar class="tile-star" :path="props.entry.path" :name="props.entry.name" />
```
`.file-tile` 样式加 `position: relative;`,并在 `<style scoped>` 追加:
```css
.tile-star { position: absolute; top: 6px; right: 6px; }
.file-tile :deep(.favorite-star) { opacity: 0; transition: opacity .12s; }
.file-tile:hover :deep(.favorite-star), .file-tile :deep(.favorite-star.active) { opacity: 1; }
```
(把 `.file-tile { ... }` 那行的 `background: transparent;` 前加 `position: relative;`。)

- [ ] **Step 7: `FileListView.vue` 表头加对齐用空星标列**

在 `src/files/components/FileListView.vue` 的 `.file-listhead` 里,`v-for` 那个 `<span>` 之后加一个空表头格:
```html
      <span class="head-cell col-star"></span>
```
`<style scoped>` 追加:
```css
.col-star { flex: 0 0 32px; }
```
(与 FileRow 的 `.file-star`(flex 0 0 32px)对齐,保 P1b 已修的列对齐不被星标格破坏。)

- [ ] **Step 8: 更新 `FileRow.test.ts`(stubs 加 FavoriteStar)**

把 `src/files/components/FileRow.test.ts` 里的:
```ts
const mountOpts = { global: { stubs: { FileThumb: true } } }
```
改为:
```ts
const mountOpts = { global: { stubs: { FileThumb: true, FavoriteStar: true } } }
```
(其余断言不变;stub 后 FileRow 无需 Pinia。)

- [ ] **Step 9: 跑受影响测试确认全绿**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/components/FavoriteStar.test.ts src/files/components/FileRow.test.ts src/views/Files.test.ts`
Expected: 全绿。(Files.test 中 FileRow/FileTile 挂载真实 FavoriteStar,渲染只调 `isFavorite`(读空 list),不触发 service;Pinia 已 setActivePinia。)

- [ ] **Step 10: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && git add src/files/components/FavoriteStar.vue src/files/components/FavoriteStar.test.ts src/files/components/FileRow.vue src/files/components/FileTile.vue src/files/components/FileListView.vue src/files/components/FileRow.test.ts
git commit -m "feat(files): FavoriteStar (hover on row/tile + active), aligned list star column"
```

---

