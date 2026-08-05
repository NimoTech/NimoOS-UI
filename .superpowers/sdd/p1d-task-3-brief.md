### Task 3: `FileRow`/`FileTile` 复选框 + 修饰键点击;视图转发 `select`

**Files:**
- Modify: `src/files/components/FileRow.vue`
- Modify: `src/files/components/FileTile.vue`
- Modify: `src/files/components/FileListView.vue`(前导 `.col-check` 表头格 + `selectedPaths` prop + 转发)
- Modify: `src/files/components/FileGridView.vue`(`selectedPaths` prop + 转发)
- Modify: `src/files/components/FileRow.test.ts`(补选中相关断言)

**Interfaces:**
- Produces(FileRow/FileTile):
  ```ts
  props: { entry: FileEntry; selected?: boolean }
  emit 'open'(entry)                                          // 普通单击(导航)
  emit 'select'({ entry: FileEntry; mode: 'toggle' | 'range' }) // 修饰键/复选框
  // 根元素带 :data-path="entry.path"(框选用),已选加 .selected 类
  ```
- FileListView/FileGridView:`props.selectedPaths: Set<string>`(默认空 Set),向子件传 `:selected`,转发 `select`。

- [ ] **Step 1: 写失败测试**(整体替换 `src/files/components/FileRow.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FileRow from './FileRow.vue'

const mountOpts = { global: { stubs: { FileThumb: true, FavoriteStar: true } } }
const fileEntry = { name: 'a.txt', path: '/DATA/a.txt', is_dir: false, size: 1536, date: '2026-01-02T10:00:00Z' }

describe('FileRow', () => {
  it('renders name, a FileThumb, size; plain click emits open', async () => {
    const w = mount(FileRow, { props: { entry: fileEntry }, ...mountOpts })
    expect(w.text()).toContain('a.txt')
    expect(w.find('.file-icon').exists()).toBe(true)
    expect(w.text()).toContain('1.5 KB')
    await w.trigger('click')
    expect(w.emitted('open')).toBeTruthy()
    expect(w.emitted('select')).toBeFalsy()
  })

  it('keeps an empty size cell for directories (column alignment)', () => {
    const w = mount(FileRow, { props: { entry: { name: 'Docs', path: '/DATA/Docs', is_dir: true } }, ...mountOpts })
    expect(w.find('.file-size').exists()).toBe(true)
    expect(w.find('.file-size').text()).toBe('')
  })

  it('ctrl/meta click emits select toggle; shift click emits select range; no open', async () => {
    const w = mount(FileRow, { props: { entry: fileEntry }, ...mountOpts })
    await w.trigger('click', { ctrlKey: true })
    expect(w.emitted('select')![0][0]).toEqual({ entry: fileEntry, mode: 'toggle' })
    await w.trigger('click', { shiftKey: true })
    expect(w.emitted('select')![1][0]).toEqual({ entry: fileEntry, mode: 'range' })
    expect(w.emitted('open')).toBeFalsy()
  })

  it('checkbox click emits select toggle and does NOT emit open', async () => {
    const w = mount(FileRow, { props: { entry: fileEntry }, ...mountOpts })
    await w.get('input.row-check').trigger('change')
    expect(w.emitted('select')![0][0]).toEqual({ entry: fileEntry, mode: 'toggle' })
    expect(w.emitted('open')).toBeFalsy()
  })

  it('adds .selected class and checks the box when selected', () => {
    const w = mount(FileRow, { props: { entry: fileEntry, selected: true }, ...mountOpts })
    expect(w.classes()).toContain('selected')
    expect((w.get('input.row-check').element as HTMLInputElement).checked).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/components/FileRow.test.ts`
Expected: FAIL(`input.row-check` 不存在 / select 未发)

- [ ] **Step 3: 改 `FileRow.vue`**

整体替换 `src/files/components/FileRow.vue`:
```vue
<script setup lang="ts">
import type { FileEntry } from '../stores/files'
import { renderSize, dateFmt } from '../util/format'
import { fileExt } from '../util/ext'
import FileThumb from './FileThumb.vue'
import FavoriteStar from './FavoriteStar.vue'

const props = defineProps<{ entry: FileEntry; selected?: boolean }>()
const emit = defineEmits<{
  (e: 'open', entry: FileEntry): void
  (e: 'select', payload: { entry: FileEntry; mode: 'toggle' | 'range' }): void
}>()

function onClick(e: MouseEvent) {
  if (e.shiftKey) emit('select', { entry: props.entry, mode: 'range' })
  else if (e.ctrlKey || e.metaKey) emit('select', { entry: props.entry, mode: 'toggle' })
  else emit('open', props.entry)
}
</script>

<template>
  <div class="file-row" :class="{ selected: props.selected }" :data-path="props.entry.path" @click="onClick">
    <span class="file-check">
      <input
        type="checkbox"
        class="row-check"
        :checked="props.selected"
        @click.stop
        @change="emit('select', { entry: props.entry, mode: 'toggle' })"
      />
    </span>
    <FileThumb class="file-icon" :entry="props.entry" />
    <span class="file-name">{{ props.entry.name }}</span>
    <span class="file-format">{{ props.entry.is_dir ? '' : fileExt(props.entry.name) }}</span>
    <span class="file-date">{{ dateFmt(props.entry.date || '') }}</span>
    <span class="file-size">{{ props.entry.is_dir ? '' : renderSize(props.entry.size ?? 0) }}</span>
    <span class="file-star"><FavoriteStar :path="props.entry.path" :name="props.entry.name" /></span>
  </div>
</template>

<style scoped>
.file-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 12px; cursor: pointer; color: var(--fg); }
.file-row:hover { background: var(--chip-bg, rgba(255,255,255,0.06)); }
.file-row.selected { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
.file-check { flex: 0 0 28px; display: flex; justify-content: center; }
.row-check { opacity: 0; cursor: pointer; }
.file-row:hover .row-check, .file-row.selected .row-check { opacity: 1; }
.file-icon { width: 28px; height: 28px; flex: 0 0 auto; }
.file-name { flex: 1 1 auto; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-format { flex: 0 0 48px; font-size: 12px; color: var(--fg-muted, #9aa4bf); text-transform: uppercase; }
.file-date { flex: 0 0 160px; font-size: 12px; color: var(--fg-muted, #9aa4bf); }
.file-size { flex: 0 0 80px; font-size: 12px; color: var(--fg-muted, #9aa4bf); text-align: right; }
.file-star { flex: 0 0 32px; display: flex; justify-content: center; }
.file-row :deep(.favorite-star) { opacity: 0; transition: opacity .12s; }
.file-row:hover :deep(.favorite-star), .file-row :deep(.favorite-star.active) { opacity: 1; }
</style>
```

- [ ] **Step 4: 改 `FileTile.vue`**

整体替换 `src/files/components/FileTile.vue`:
```vue
<script setup lang="ts">
import type { FileEntry } from '../stores/files'
import { dateFmt } from '../util/format'
import FileThumb from './FileThumb.vue'
import FavoriteStar from './FavoriteStar.vue'

const props = defineProps<{ entry: FileEntry; selected?: boolean }>()
const emit = defineEmits<{
  (e: 'open', entry: FileEntry): void
  (e: 'select', payload: { entry: FileEntry; mode: 'toggle' | 'range' }): void
}>()

function onClick(e: MouseEvent) {
  if (e.shiftKey) emit('select', { entry: props.entry, mode: 'range' })
  else if (e.ctrlKey || e.metaKey) emit('select', { entry: props.entry, mode: 'toggle' })
  else emit('open', props.entry)
}
</script>

<template>
  <div class="file-tile" :class="{ selected: props.selected }" :data-path="props.entry.path" @click="onClick">
    <span class="tile-check">
      <input
        type="checkbox"
        class="tile-check-box"
        :checked="props.selected"
        @click.stop
        @change="emit('select', { entry: props.entry, mode: 'toggle' })"
      />
    </span>
    <FavoriteStar class="tile-star" :path="props.entry.path" :name="props.entry.name" />
    <FileThumb class="tile-icon" :entry="props.entry" />
    <span class="tile-name">{{ props.entry.name }}</span>
    <span class="tile-date">{{ dateFmt(props.entry.date || '') }}</span>
  </div>
</template>

<style scoped>
.file-tile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 8px; border-radius: 16px; cursor: pointer; color: var(--fg); background: transparent; border: 1px solid transparent; }
.file-tile:hover { background: var(--chip-bg, rgba(255,255,255,0.08)); }
.file-tile.selected { background: var(--chip-bg-hi, rgba(255,255,255,0.16)); }
.tile-icon { width: var(--app-size, 64px); height: var(--app-size, 64px); }
.tile-name { font-size: 13px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.tile-date { font-size: 11px; color: var(--fg-muted, #9aa4bf); }
.tile-star { position: absolute; top: 6px; right: 6px; }
.tile-check { position: absolute; top: 6px; left: 6px; }
.tile-check-box { opacity: 0; cursor: pointer; }
.file-tile:hover .tile-check-box, .file-tile.selected .tile-check-box { opacity: 1; }
.file-tile :deep(.favorite-star) { opacity: 0; transition: opacity .12s; }
.file-tile:hover :deep(.favorite-star), .file-tile :deep(.favorite-star.active) { opacity: 1; }
</style>
```

- [ ] **Step 5: 改 `FileListView.vue`(前导表头格 + selectedPaths + 转发)**

在 `src/files/components/FileListView.vue`:
props 加 `selectedPaths`(默认空 Set),emit 加 `select`。把 `defineProps`/`defineEmits` 改为:
```ts
const props = defineProps<{ entries: FileEntry[]; sort: string; order: string; selectedPaths?: Set<string> }>()
const emit = defineEmits<{
  (e: 'open', entry: FileEntry): void
  (e: 'reorder', sort: string): void
  (e: 'select', payload: { entry: FileEntry; mode: 'toggle' | 'range' }): void
}>()
```
表头在 `v-for` 那个 span **之前**加前导复选框对齐格:
```html
    <div class="file-listhead">
      <span class="head-cell col-check"></span>
      <span
        v-for="c in COLS"
```
FileRow 循环传 `:selected` + 转发 `select`:
```html
    <FileRow
      v-for="entry in props.entries"
      :key="entry.path"
      :entry="entry"
      :selected="props.selectedPaths?.has(entry.path)"
      @open="emit('open', $event)"
      @select="emit('select', $event)"
    />
```
`<style scoped>` 里 `.col-name` 的 `margin-left: 40px` **保持不变**(前导 col-check 28 + gap 让复选框对齐行内复选框,col-name 的 ml:40 仍对齐图标后的名字),追加:
```css
.col-check { flex: 0 0 28px; }
```

- [ ] **Step 6: 改 `FileGridView.vue`(selectedPaths + 转发)**

整体替换 `src/files/components/FileGridView.vue`:
```vue
<script setup lang="ts">
import type { FileEntry } from '../stores/files'
import FileTile from './FileTile.vue'
const props = defineProps<{ entries: FileEntry[]; selectedPaths?: Set<string> }>()
const emit = defineEmits<{
  (e: 'open', entry: FileEntry): void
  (e: 'select', payload: { entry: FileEntry; mode: 'toggle' | 'range' }): void
}>()
</script>

<template>
  <div class="file-grid">
    <FileTile
      v-for="entry in props.entries"
      :key="entry.path"
      :entry="entry"
      :selected="props.selectedPaths?.has(entry.path)"
      @open="emit('open', $event)"
      @select="emit('select', $event)"
    />
  </div>
</template>

<style scoped>
.file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 14px; }
</style>
```

- [ ] **Step 7: 跑受影响测试确认全绿**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/components/FileRow.test.ts src/views/Files.test.ts`
Expected: FileRow 5 用例全绿;Files.test 仍绿(Files.vue 尚未传 selectedPaths,子件 prop 可选默认 undefined,`?.has` 安全;普通点击仍 emit open→导航,现有断言不变)。

- [ ] **Step 8: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && git add src/files/components/FileRow.vue src/files/components/FileTile.vue src/files/components/FileListView.vue src/files/components/FileGridView.vue src/files/components/FileRow.test.ts
git commit -m "feat(files): row/tile checkbox + modifier-click select + data-path; views forward select"
```

---

