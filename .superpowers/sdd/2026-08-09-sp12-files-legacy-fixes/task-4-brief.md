## Task 4: 批量共享门控接线 + i18n

**Files:**
- Modify: `src/views/Files.vue`（`onShare`）
- Modify: `src/files/components/FileContextMenu.vue:22`
- Modify: `src/i18n/zh_cn.base.ts`、`src/i18n/en_us.base.ts`
- Test: `src/views/Files.share.test.ts`（新建）

**Interfaces:**
- Consumes: `isAlreadyShared` / `shareableFolders`（Task 3）、`ctxTargets`（Task 2）
- Produces: 无新导出。新 i18n 键 `filesShareSkippedShared`、`filesShareAllAlreadyShared`

- [ ] **Step 1: 加 i18n 键**

`src/i18n/zh_cn.base.ts`，紧跟 `filesShareBatchDone`（`:182`）之后：

```ts
  filesShareSkippedShared: '已跳过 {count} 个已共享项',
  filesShareAllAlreadyShared: '所选文件夹都已共享',
```

`src/i18n/en_us.base.ts`，同样位置（`:182` 之后）：

```ts
  filesShareSkippedShared: 'Skipped {count} already-shared item(s)',
  filesShareAllAlreadyShared: 'All selected folders are already shared',
```

- [ ] **Step 2: 跑 parity 闸确认两边对齐**

Run: `pnpm exec vitest run src/i18n/parity.test.ts`
Expected: PASS，9/9。（漏加一边这里会红。）

- [ ] **Step 3: 写失败的端到端测试**

创建 `src/views/Files.share.test.ts`：

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
import { useToast } from '../stores/toast'

const createShare = vi.fn().mockResolvedValue(undefined)

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    folder: {
      getList: vi.fn(async () => ({
        content: [
          { name: 'plain', path: '/DATA/plain', is_dir: true, extensions: null },
          { name: 'shared', path: '/DATA/shared', is_dir: true, extensions: { share: { shared: 'true' } } },
          { name: 'plain2', path: '/DATA/plain2', is_dir: true, extensions: null },
        ],
      })),
    },
    users: { getCustomStorage: vi.fn().mockResolvedValue([]), setCustomStorage: vi.fn().mockResolvedValue(undefined) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${encodeURIComponent(p)}` },
    samba: {
      listConnections: vi.fn().mockResolvedValue([]),
      listShares: vi.fn().mockResolvedValue([]),
      createShare,
    },
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

describe('Files.vue batch share gating (F12)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    createShare.mockClear()
    ;(globalThis as any).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void
      constructor(cb: any) { this.cb = cb }
      observe() { this.cb([{ isIntersecting: true }]) }
      disconnect() {}
    }
  })

  it('Selection with already-shared mixed in → only share the unshareable, do not send already-shared to backend', async () => {
    const w = await mountFiles()
    useFilesStore().setSelection(['/DATA/plain', '/DATA/shared', '/DATA/plain2'])

    await (w.vm as any).onShare(null)
    await flushPromises()

    expect(createShare).toHaveBeenCalledTimes(1)
    expect(createShare.mock.calls[0][0]).toEqual(['/DATA/plain', '/DATA/plain2'])
  })

  it('Selection with already-shared mixed in → toast says how many were skipped', async () => {
    const w = await mountFiles()
    useFilesStore().setSelection(['/DATA/plain', '/DATA/shared'])

    await (w.vm as any).onShare(null)
    await flushPromises()

    // Toasts stack (the `toasts` array in stores/toast.ts:31), so the success and skipped notices
    // are on screen at the same time — assert the whole stack contains this one, not just "the last one".
    expect(useToast().toasts.map((x) => x.text)).toContain('已跳过 1 个已共享项')
  })

  it('Selection with all already-shared → send no request, explain why directly', async () => {
    const w = await mountFiles()
    useFilesStore().setSelection(['/DATA/shared'])

    await (w.vm as any).onShare(null)
    await flushPromises()

    expect(createShare).not.toHaveBeenCalled()
    expect(useToast().toasts.map((x) => x.text)).toEqual(['所选文件夹都已共享'])
  })

  it('Selection with no already-shared → behavior same as before, no skipped notice', async () => {
    const w = await mountFiles()
    useFilesStore().setSelection(['/DATA/plain', '/DATA/plain2'])

    await (w.vm as any).onShare(null)
    await flushPromises()

    expect(createShare.mock.calls[0][0]).toEqual(['/DATA/plain', '/DATA/plain2'])
    expect(useToast().toasts.map((x) => x.text).join('|')).not.toContain('已跳过')
  })
})
```

> **Toast 形态已查证**（`src/stores/toast.ts:30-44`）：`show()` **push 进 `toasts` 数组**、各自计时移除，`msg` 只是「最后一条」的向后兼容 computed。所以「共享成功」与「已跳过 N 个」是**两条同时在屏的 toast**，不是后者覆盖前者。
>
> 本期**有意选择两条 toast**而不是合成一句：合成需要给 `shares.create` 加参数或让它不发 toast，而它是通用入口（共享列表页也在用），为一个调用点改它的签名不划算。堆叠设计本就支持这种叠加，两条都读得到。

- [ ] **Step 4: 跑测试确认它红**

Run: `pnpm exec vitest run src/views/Files.share.test.ts`
Expected: FAIL —— 第 1 例 `createShare` 收到三条路径（含已共享的）；第 3 例 `createShare` 被调用了

- [ ] **Step 5: 改 `Files.vue` 的 `onShare`**

加导入：

```ts
import { shareableFolders } from '../files/util/shareGate'
```

把整个 `onShare`（约 `:105-115`）换成：

```ts
// Initiate sharing: right-click single folder (entry non-null, outside selection) → show link dialog after creation;
// batch multi-select (entry null) → only share unshared folders in batch, do not show link dialog (multiple names to display to user).
// Already-shared members are filtered here — backend returns SHARE_ALREADY_EXISTS for them and the whole batch fails,
// but the single-item context menu already hides the action for already-shared items (FileContextMenu's showShare),
// so batch must follow the same logic to keep the semantics consistent.
async function onShare(entry: FileEntry | null) {
  const { targets, skipped } = shareableFolders(ctxTargets(entry))
  if (!targets.length) {
    // The selection really is all folders, just all already shared — explain why so user doesn't think the button is broken
    if (skipped) toast.show(t('filesShareAllAlreadyShared'))
    return
  }
  const ok = await shares.create(targets.map((f) => f.path))
  if (!ok) return
  ops.refresh() // Refresh the listing so shared folders get their extensions.share.shared updated (else context menu still shows "Share to LAN")
  if (skipped) toast.show(t('filesShareSkippedShared', { count: skipped }))
  if (targets.length === 1) shareDlg.value = { open: true, name: shareName(targets[0].path) }
}
```

> `shares.create` 成功时自己会弹一条 toast（`stores/shares.ts:39`），跳过提示是在它之后**再弹一条**，两条同时在屏（见上方 Step 3 的说明）。
>
> `toast` 与 `t` 在 `Files.vue` 里**已经有了**（`:65` `const toast = useToast()`、`:67` `const { t } = useI18n()`），别重复声明。

- [ ] **Step 6: 消掉 `FileContextMenu` 里的第二处判定**

`src/files/components/FileContextMenu.vue`：加导入

```ts
import { isAlreadyShared } from '../util/shareGate'
```

把 `:22` 换成：

```ts
const alreadyShared = computed(() => (props.entry ? isAlreadyShared(props.entry) : false))
```

- [ ] **Step 7: 跑测试确认它绿**

Run: `pnpm exec vitest run src/views/Files.share.test.ts src/files/util/shareGate.test.ts src/files/components/FileContextMenu.test.ts`
Expected: 全 PASS

- [ ] **Step 8: 提交**

```bash
git add src/views/Files.vue src/files/components/FileContextMenu.vue src/views/Files.share.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -m "fix(files): skip already-shared folders in a batch share

A batch containing an already-shared folder used to fail as a whole on the
backend's SHARE_ALREADY_EXISTS. Share what can be shared, say how many were
skipped, and send nothing at all when every folder is already shared."
```

---

