## Task 2: 把有效目标集接进动作分发与菜单形态

**Files:**
- Modify: `src/views/Files.vue`（`selectedOr` 及其 5 个调用点、delete 分支、`FileContextMenu` 的 prop）
- Test: `src/views/Files.contextTarget.test.ts`（新建）

**Interfaces:**
- Consumes: `contextTargets` from Task 1
- Produces: 无新导出。`FileContextMenu` 的 `selected-count` prop 语义从「原始选区条数」变为「有效目标集条数」

- [ ] **Step 1: 写失败的端到端测试**

`contextTargets` 单测绿**不代表** `onCtxAction` 每个分支都接对了 —— 这是 SP12 Plan A 终审总结过的「手工转发链」盲区（三跳转发，少写一行功能静默死掉而全套测试照绿）。所以必须有一条走真实组件的断言。

创建 `src/views/Files.contextTarget.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'
import Files from './Files.vue'
import { useFilesStore } from '../files/stores/files'
import { useFoldersStore } from '../home/stores/folders'
import { useClipboardStore } from '../files/stores/clipboard'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: {
      getList: vi.fn(async () => ({
        content: [
          { name: 'a.txt', path: '/DATA/a.txt', is_dir: false },
          { name: 'b.txt', path: '/DATA/b.txt', is_dir: false },
          { name: 'c.txt', path: '/DATA/c.txt', is_dir: false },
        ],
      })),
    },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}` },
    samba: { listConnections: vi.fn().mockResolvedValue([]) },
    cloud: { list: vi.fn().mockResolvedValue([]), umount: vi.fn().mockResolvedValue(undefined) },
    snapshot: {
      listVolumes: vi.fn().mockResolvedValue([{ volume_uuid: 'u-data', mount: '/DATA', supported: true }]),
      list: vi.fn().mockResolvedValue([]),
    },
  },
  getHttp: () => ({ get: vi.fn(async () => ({ data: { data: [] } })) }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/files', name: 'files', component: Files },
      { path: '/files/:path(.*)*', name: 'files-path', component: Files },
    ],
  })
}

async function mountFiles() {
  const folders = useFoldersStore()
  folders.loadDisks = vi.fn(async () => {
    folders.disks = [{ name: 'NimoOS-HD', path: '/DATA', usb: false }] as any
  })
  const router = makeRouter()
  router.push('/files/NimoOS-HD')
  await router.isReady()
  const w = mount(Files, { global: { plugins: [router, i18n] } })
  await flushPromises()
  return w
}

describe('Files.vue context-menu target (F11)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  it('Copy on unselected a when b,c are selected → clipboard contains only a', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/b.txt', '/DATA/c.txt'])
    const a = files.entries.find((e) => e.path === '/DATA/a.txt')!

    ;(w.vm as any).ctxEntry = a
    ;(w.vm as any).onCtxAction('copy', a)

    const clip = useClipboardStore()
    expect(clip.operateObject).toEqual({ type: 'copy', item: [{ from: '/DATA/a.txt' }] })
  })

  it('Copy on selected b when b,c are selected → clipboard contains b,c', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/b.txt', '/DATA/c.txt'])
    const b = files.entries.find((e) => e.path === '/DATA/b.txt')!

    ;(w.vm as any).ctxEntry = b
    ;(w.vm as any).onCtxAction('copy', b)

    const clip = useClipboardStore()
    expect(clip.operateObject!.item.map((i) => i.from)).toEqual(['/DATA/b.txt', '/DATA/c.txt'])
  })

  it('Delete branch also acts on clicked entry only (delete was once a second inline implementation)', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/b.txt', '/DATA/c.txt'])
    const a = files.entries.find((e) => e.path === '/DATA/a.txt')!

    ;(w.vm as any).ctxEntry = a
    ;(w.vm as any).onCtxAction('delete', a)

    expect((w.vm as any).deleteDlg.entries.map((e: any) => e.path)).toEqual(['/DATA/a.txt'])
  })

  it('Menu prop reflects the effective target set, not the original selection count', async () => {
    const w = await mountFiles()
    const files = useFilesStore()
    files.setSelection(['/DATA/b.txt', '/DATA/c.txt'])
    const a = files.entries.find((e) => e.path === '/DATA/a.txt')!

    ;(w.vm as any).ctxEntry = a
    await w.vm.$nextTick()

    // The menu shown for a must render as single-item shape — otherwise the UI lies:
    // showing multi-select shape while only acting on a
    expect((w.vm as any).ctxTargetCount).toBe(1)
  })
})
```

- [ ] **Step 2: 跑测试确认它红**

Run: `pnpm exec vitest run src/views/Files.contextTarget.test.ts`
Expected: FAIL —— 第 1 例剪贴板里是 b、c 而非 a；第 4 例 `ctxTargetCount` is undefined

- [ ] **Step 3: 改 `Files.vue` 的 script**

① 加导入（挨着已有的 `../files/util/...` 导入放）：

```ts
import { contextTargets } from '../files/util/contextTarget'
```

② 把现有的 `selectedOr`（约 `:93-96`）整块换掉：

```ts
// Current selection (in listing order), shared by context-menu target set and batch entry points
const selectedEntries = computed(() => files.entries.filter((e) => files.isSelected(e.path)))

// Effective target set for context-menu actions — the determination logic is in util/contextTarget.ts,
// and both menu shape and all actions read the same set to avoid "menu shows multi-select, action acts on one item" mismatches.
function ctxTargets(entry: FileEntry | null): FileEntry[] {
  return contextTargets(entry, selectedEntries.value)
}

// Menu prop: must be the count of the effective target set, not the original selection count
const ctxTargetCount = computed(() => ctxTargets(ctxEntry.value).length)
```

③ 把 `onCtxAction` 里 `delete` 分支的内联逻辑（约 `:136-137`）换成走同一条路：

```ts
    case 'delete': deleteDlg.value = { open: true, entries: ctxTargets(entry) }; break
```

④ `copy` / `cut` / `download` 三个分支（约 `:140-142`）：

```ts
    case 'copy': ops.copy(ctxTargets(entry)); break
    case 'cut': ops.cut(ctxTargets(entry)); break
    case 'download': ops.download(ctxTargets(entry)); break
```

⑤ `onShare`（约 `:106`）里的 `selectedOr(entry)` 换成 `ctxTargets(entry)`：

```ts
  const folders = ctxTargets(entry).filter((e) => e.is_dir)
```

⑥ `selectionHasFolder`（约 `:99`）改用 `selectedEntries`，消掉重复的 filter：

```ts
const selectionHasFolder = computed(() => selectedEntries.value.some((e) => e.is_dir))
```

⑦ `snapshotSelection`（约 `:102`）同样改用 `selectedEntries`：

```ts
const snapshotSelection = computed(() => selectedEntries.value)
```

⑧ 确认 `selectedOr` 已无引用后删掉它。

Run 自查：`grep -n "selectedOr" src/views/Files.vue` 必须无输出。

- [ ] **Step 4: 改模板的 prop**

`src/views/Files.vue:598`：

```
        <FileContextMenu :entry="ctxEntry" :selected-count="ctxTargetCount" @action="onCtxAction">
```

- [ ] **Step 5: 跑测试确认它绿**

Run: `pnpm exec vitest run src/views/Files.contextTarget.test.ts src/files/util/contextTarget.test.ts`
Expected: PASS，11 例

- [ ] **Step 6: 强制 RED 自证(必做)**

把 Step 4 改的 prop 临时改回 `:selected-count="files.selectedCount"`，重跑：

Run: `pnpm exec vitest run src/views/Files.contextTarget.test.ts`
Expected: 第 4 例 FAIL

确认红了之后**改回来**再跑一次确认绿。这一步是在证明这条测试真的守着接线，而不是碰巧通过。

- [ ] **Step 7: 跑既有的 Files 测试确认没打破**

Run: `pnpm exec vitest run src/views/Files.test.ts src/views/Files.openEntry.test.ts src/files/components/FileContextMenu.test.ts`
Expected: 全 PASS。（`FileContextMenu.test.ts` 直接传 `selectedCount` prop，不经 `Files.vue`，语义未变，应当不受影响。）

- [ ] **Step 8: 提交**

```bash
git add src/views/Files.vue src/views/Files.contextTarget.test.ts
git commit -m "fix(files): act on the clicked entry when it is outside the selection

Right-clicking an unselected file and choosing Copy/Cut/Download/Delete used
to operate on the previous selection, with the menu still rendering its
multi-select shape. Both the dispatch and the menu prop now read the same
effective target set."
```

---

