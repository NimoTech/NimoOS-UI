### Task 7: `Files.vue` 布局集成 + i18n + 全量 + build

**Files:**
- Modify: `src/views/Files.vue`(侧栏 + 面包屑 + 视图切换 布局;挂载时 `favorites.load()`)
- Modify: `src/i18n/zh_cn.ts`(加 3 个 key)
- Modify: `src/views/Files.test.ts`(service mock 加 users/image + IO fake;补侧栏/面包屑断言)

**Interfaces:**
- Consumes:`FilesSidebar`(Task6)、`Breadcrumb`(Task5)、`useFavoritesStore`(Task3)、`FileGridView`/`FileListView`、`pathUtils`。

- [ ] **Step 1: 加 i18n key**

在 `src/i18n/zh_cn.ts` 的 `zh_cn` 对象内(`filesColSize` 之后)加:
```ts
    filesFavorites: '收藏',
    filesDisks: '磁盘',
    filesNoFavorites: '暂无收藏',
```

- [ ] **Step 2: 写失败测试**(在 `src/views/Files.test.ts` describe 内新增一个用例 + 扩展 service mock)

先把顶部 `vi.mock('@nimotech/nimoos-service', ...)` 扩为(加 `users` 与 `image`,保留 `folder`/`getHttp`):
```ts
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: {
      getList: vi.fn(async (path: string) => ({
        content: [
          { name: 'Documents', path: (path === '/DATA' ? '/DATA' : path) + '/Documents', is_dir: true },
          { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
        ],
      })),
    },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}&type=thumbnail` },
  },
  getHttp: () => ({ get: vi.fn(async () => ({ data: { data: [] } })) }),
}))
```
在 `describe('Files.vue browse pipe', ...)` 里新增 `beforeEach` 之外的顶层 IO fake(放在 describe 内首行,或与现有 beforeEach 合并):
```ts
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })
```
(替换现有的 `beforeEach(() => { setActivePinia(createPinia()) })`。)

新增用例(放在 describe 末尾):
```ts
  it('renders the sidebar (disks) and breadcrumb for the current folder', async () => {
    const folders = useFoldersStore()
    folders.loadDisks = vi.fn(async () => { folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any })
    const router = makeRouter()
    router.push('/files/NimoOS-HD/Documents'); await router.isReady()
    const w = mount(Files, { global: { plugins: [router, i18n] } })
    await flushPromises()
    // sidebar shows the disk root
    expect(w.find('.files-sidebar').exists()).toBe(true)
    expect(w.find('.files-sidebar').text()).toContain('NimoOS-HD')
    // breadcrumb shows virtual segments, never the real path
    const crumbs = w.findAll('.crumb').map((c) => c.text())
    expect(crumbs).toContain('NimoOS-HD')
    expect(crumbs).toContain('Documents')
    expect(w.find('.breadcrumb').text()).not.toContain('/DATA')
  })
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/views/Files.test.ts`
Expected: FAIL(找不到 `.files-sidebar` / `.crumb` —— Files.vue 尚未接入侧栏/面包屑)

- [ ] **Step 4: 写实现**(整体替换 `src/views/Files.vue`)

```vue
<script setup lang="ts">
import { watch, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import FilesShell from '../files/components/FilesShell.vue'
import FilesSidebar from '../files/components/FilesSidebar.vue'
import Breadcrumb from '../files/components/Breadcrumb.vue'
import FileListView from '../files/components/FileListView.vue'
import FileGridView from '../files/components/FileGridView.vue'
import { useFilesStore, type FileEntry } from '../files/stores/files'
import { useFavoritesStore } from '../files/stores/favorites'
import {
  toRealPath, toVirtualPath, virtualPathToRouteParam, routeParamToVirtualPath,
} from '../files/util/pathUtils'

const route = useRoute()
const router = useRouter()
const files = useFilesStore()
const favorites = useFavoritesStore()
const { t } = useI18n()

const currentVirtual = computed(() => toVirtualPath(files.currentPath, files.displayNames))

function goVirtual(vp: string) {
  router.push('/files/' + virtualPathToRouteParam(vp))
}
async function sync() {
  const vp = routeParamToVirtualPath(route.params.path as string | string[] | undefined)
  if (vp === '/') {
    const rootReal = files.defaultRootReal()
    if (!rootReal) return
    router.replace('/files/' + virtualPathToRouteParam(toVirtualPath(rootReal, files.displayNames)))
    return
  }
  await files.load(toRealPath(vp, files.displayNames))
}
function openEntry(entry: FileEntry) {
  if (!entry.is_dir) return
  goVirtual(toVirtualPath(entry.path, files.displayNames))
}
onMounted(async () => {
  await files.loadRoots()
  favorites.load()
  await sync()
})
watch(() => route.params.path, () => { sync().catch((e) => console.warn('[files] route sync failed', e)) })
</script>

<template>
  <FilesShell>
    <div class="files-layout">
      <FilesSidebar @navigate="goVirtual" />
      <div class="files-main">
        <div class="files-topbar">
          <Breadcrumb :virtual-path="currentVirtual" :current-real-path="files.currentPath" @navigate="goVirtual" />
          <div class="files-viewtoggle">
            <button class="chip view-toggle-grid" :class="{ active: files.viewMode === 'grid' }" @click="files.setView('grid')">{{ t('filesViewGrid') }}</button>
            <button class="chip view-toggle-list" :class="{ active: files.viewMode === 'list' }" @click="files.setView('list')">{{ t('filesViewList') }}</button>
          </div>
        </div>
        <FileGridView v-if="files.viewMode === 'grid'" :entries="files.sortedEntries" @open="openEntry" />
        <FileListView v-else :entries="files.sortedEntries" :sort="files.sort" :order="files.order" @open="openEntry" @reorder="files.setSort" />
      </div>
    </div>
  </FilesShell>
</template>

<style scoped>
.files-layout { display: flex; gap: 16px; align-items: flex-start; }
.files-main { flex: 1 1 auto; min-width: 0; }
.files-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0 14px; }
.files-viewtoggle { display: flex; gap: 8px; flex: 0 0 auto; }
.chip { padding: 6px 14px; border-radius: 999px; border: 1px solid var(--chip-border, rgba(255,255,255,0.12)); background: var(--chip-bg, rgba(255,255,255,0.05)); color: var(--fg); cursor: pointer; font-size: 13px; }
.chip.active { background: var(--chip-bg-hi, rgba(255,255,255,0.16)); }
</style>
```

- [ ] **Step 5: 跑 Files 测试 + 全量 + 构建**

Run: `cd /home/nimo/NimoTech/NimoOS-New-UI && npx vitest run src/views/Files.test.ts && npm test && npm run build`
Expected: Files 测试全绿(P1b 4 用例 + 新 1);全量绿(≥159);build 成功(vue-tsc 干净)。

- [ ] **Step 6: 提交**

```bash
cd /home/nimo/NimoTech/NimoOS-New-UI && git add src/views/Files.vue src/i18n/zh_cn.ts src/views/Files.test.ts
git commit -m "feat(files): P1c layout — sidebar + breadcrumb + view toggle in Files.vue; favorites load; i18n"
```

---

