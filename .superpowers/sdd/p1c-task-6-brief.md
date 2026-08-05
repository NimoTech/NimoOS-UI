### Task 6: `FilesSidebar.vue`(收藏区 + 磁盘区)

**Files:**
- Create: `src/files/components/FilesSidebar.vue`
- Create: `src/files/components/FilesSidebar.test.ts`

**Interfaces:**
- Consumes:`useFilesStore`(`disks`/`displayNames`/`currentPath`)、`useFavoritesStore`(`list`/`remove`/`reorder`)、`iconUrl`、`pathUtils.toVirtualPath`、i18n。
- Produces:`FilesSidebar.vue`(无 props),emit `navigate(virtualPath)`。

- [ ] **Step 1: 写失败测试**

`src/files/components/FilesSidebar.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import FilesSidebar from './FilesSidebar.vue'
import { useFilesStore } from '../stores/files'
import { useFavoritesStore } from '../stores/favorites'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    folder: { getList: vi.fn() },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { filesFavorites: '收藏', filesDisks: '磁盘', filesNoFavorites: '暂无收藏' } } })

function seedFiles() {
  const files = useFilesStore()
  files.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any
  files.displayNames = { '/DATA': 'NimoOS-HD' }
  files.currentPath = '/DATA'
  return files
}

describe('FilesSidebar', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders disks and an empty-favorites hint', () => {
    seedFiles()
    const w = mount(FilesSidebar, { global: { plugins: [i18n] } })
    expect(w.text()).toContain('暂无收藏')
    expect(w.text()).toContain('NimoOS-HD')
  })

  it('clicking a disk emits navigate with the virtual path (not /DATA)', async () => {
    seedFiles()
    const w = mount(FilesSidebar, { global: { plugins: [i18n] } })
    await w.findAll('.side-item')[0].trigger('click')
    const ev = w.emitted('navigate')
    expect(ev![0][0]).toBe('/NimoOS-HD')
    expect(ev![0][0]).not.toContain('/DATA')
  })

  it('clicking a favorite emits its virtual path; remove mutates the store', async () => {
    seedFiles()
    const fav = useFavoritesStore()
    fav.list = [{ name: 'Docs', path: '/DATA/Documents' }] as any
    const w = mount(FilesSidebar, { global: { plugins: [i18n] } })
    const favItem = w.findAll('.side-item').find((li) => li.text().includes('Docs'))!
    await favItem.trigger('click')
    expect(w.emitted('navigate')!.some((e) => e[0] === '/NimoOS-HD/Documents')).toBe(true)
    await favItem.get('.side-remove').trigger('click')
    expect(fav.list.find((f) => f.path === '/DATA/Documents')).toBeUndefined()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/components/FilesSidebar.test.ts`
Expected: FAIL(`Cannot find module './FilesSidebar.vue'`)

- [ ] **Step 3: 写实现**

`src/files/components/FilesSidebar.vue`:
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFilesStore } from '../stores/files'
import { useFavoritesStore } from '../stores/favorites'
import { iconUrl } from '../util/icons'
import { toVirtualPath } from '../util/pathUtils'

const emit = defineEmits<{ (e: 'navigate', virtualPath: string): void }>()
const files = useFilesStore()
const favorites = useFavoritesStore()
const { t } = useI18n()

function go(realPath: string) {
  emit('navigate', toVirtualPath(realPath, files.displayNames))
}
function isActive(realPath: string): boolean {
  return files.currentPath === realPath
}
function diskIcon(usb: boolean): string {
  return iconUrl(usb ? 'folder-usb' : 'folder-hdd')
}

const dragIndex = ref<number | null>(null)
function onDragStart(i: number) { dragIndex.value = i }
function onDrop(i: number) {
  if (dragIndex.value !== null && dragIndex.value !== i) favorites.reorder(dragIndex.value, i)
  dragIndex.value = null
}
</script>

<template>
  <aside class="files-sidebar">
    <section class="side-section">
      <h4 class="side-title">{{ t('filesFavorites') }}</h4>
      <p v-if="!favorites.list.length" class="side-empty">{{ t('filesNoFavorites') }}</p>
      <ul class="side-list">
        <li
          v-for="(fav, i) in favorites.list"
          :key="fav.path"
          class="side-item"
          :class="{ active: isActive(fav.path) }"
          draggable="true"
          @click="go(fav.path)"
          @dragstart="onDragStart(i)"
          @dragover.prevent
          @drop="onDrop(i)"
        >
          <img class="side-icon" :src="iconUrl('folder-default')" alt="" />
          <span class="side-name">{{ fav.name }}</span>
          <button class="side-remove" @click.stop="favorites.remove(fav.path)">×</button>
        </li>
      </ul>
    </section>
    <section class="side-section">
      <h4 class="side-title">{{ t('filesDisks') }}</h4>
      <ul class="side-list">
        <li
          v-for="disk in files.disks"
          :key="disk.path"
          class="side-item"
          :class="{ active: isActive(disk.path) }"
          @click="go(disk.path)"
        >
          <img class="side-icon" :src="diskIcon(disk.usb)" alt="" />
          <span class="side-name">{{ disk.name }}</span>
        </li>
      </ul>
    </section>
  </aside>
</template>

<style scoped>
.files-sidebar { flex: 0 0 220px; display: flex; flex-direction: column; gap: 18px; padding: 4px 12px 4px 0; overflow-y: auto; }
.side-section { min-width: 0; }
.side-title { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--fg-muted, #9aa4bf); margin: 0 0 6px; }
.side-empty { font-size: 12px; color: var(--fg-muted, #9aa4bf); padding: 4px 8px; }
.side-list { list-style: none; margin: 0; padding: 0; }
.side-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; cursor: pointer; color: var(--fg); }
.side-item:hover { background: var(--chip-bg, rgba(255,255,255,0.06)); }
.side-item.active { background: var(--chip-bg-hi, rgba(255,255,255,0.14)); }
.side-icon { width: 20px; height: 20px; flex: 0 0 auto; }
.side-name { flex: 1 1 auto; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.side-remove { opacity: 0; background: none; border: none; color: var(--fg-muted, #9aa4bf); cursor: pointer; font-size: 14px; }
.side-item:hover .side-remove { opacity: 1; }
</style>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/files/components/FilesSidebar.test.ts`
Expected: PASS(3 用例)

- [ ] **Step 5: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && git add src/files/components/FilesSidebar.vue src/files/components/FilesSidebar.test.ts
git commit -m "feat(files): FilesSidebar (favorites + read-only disk roots, virtual-path navigate)"
```

---

