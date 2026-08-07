## Task 2: sambaPath 纯工具 + shares store

**Files:**
- Create: `NimoOS-New-UI/src/files/util/sambaPath.ts`
- Test: `NimoOS-New-UI/src/files/util/sambaPath.test.ts`
- Create: `NimoOS-New-UI/src/files/stores/shares.ts`
- Test: `NimoOS-New-UI/src/files/stores/shares.test.ts`

**Interfaces:**
- Consumes: `service.samba.listShares/createShare/deleteShare`(Task 1)、`useToast`(`src/stores/toast.ts`,`show(text,duration?)`)、`i18n.global.t`。
- Produces:
  - `buildSmbPaths(host: string, name: string): { windows: string; mac: string }`
  - `getShareHost(): string`(`window.location.hostname`)
  - `shareName(path: string): string`(末段)
  - `useSharesStore` → `{ items: ShareRow[], loading, load(): Promise<void>, create(paths: string[]): Promise<boolean>, remove(id: number): Promise<boolean> }`;`interface ShareRow { id: number; path: string; name: string }`

- [ ] **Step 1: Write failing test for sambaPath** — `src/files/util/sambaPath.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildSmbPaths, shareName } from './sambaPath'

describe('sambaPath', () => {
  it('buildSmbPaths → Windows UNC + Mac smb', () => {
    expect(buildSmbPaths('192.168.1.9', 'Documents')).toEqual({
      windows: '\\\\192.168.1.9\\Documents',
      mac: 'smb://192.168.1.9/Documents',
    })
  })
  it('shareName 取路径末段', () => {
    expect(shareName('/DATA/Documents')).toBe('Documents')
    expect(shareName('/DATA/Media/Movies/')).toBe('Movies')
    expect(shareName('Solo')).toBe('Solo')
  })
})
```

- [ ] **Step 2: Run → fail**

Run: `pnpm exec vitest run src/files/util/sambaPath.test.ts`
Expected: FAIL(Cannot find module './sambaPath')

- [ ] **Step 3: Implement `src/files/util/sambaPath.ts`**

```ts
export interface SmbPaths { windows: string; mac: string }

export function buildSmbPaths(host: string, name: string): SmbPaths {
  return { windows: `\\\\${host}\\${name}`, mac: `smb://${host}/${name}` }
}

export function getShareHost(): string {
  return window.location.hostname
}

export function shareName(path: string): string {
  return path.replace(/\/+$/, '').split('/').pop() || path
}
```

- [ ] **Step 4: Run → pass**

Run: `pnpm exec vitest run src/files/util/sambaPath.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing test for shares store** — `src/files/stores/shares.test.ts`(mock 模式对齐 `src/home/stores/folders.test.ts`):

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const listShares = vi.fn()
const createShare = vi.fn(async () => {})
const deleteShare = vi.fn(async () => {})
vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return { ...actual, service: { samba: { listShares, createShare, deleteShare } } }
})
import { useSharesStore } from './shares'

describe('useSharesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    listShares.mockReset(); createShare.mockReset(); deleteShare.mockReset()
    createShare.mockResolvedValue(undefined); deleteShare.mockResolvedValue(undefined)
  })

  it('load 把 {id,path} 映射成含末段 name 的行', async () => {
    listShares.mockResolvedValue([{ id: 1, path: '/DATA/Documents' }])
    const s = useSharesStore()
    await s.load()
    expect(s.items).toEqual([{ id: 1, path: '/DATA/Documents', name: 'Documents' }])
  })

  it('create 用原始 realPath 数组调 createShare 并回 true', async () => {
    listShares.mockResolvedValue([])
    const s = useSharesStore()
    const ok = await s.create(['/DATA/a', '/DATA/b'])
    expect(createShare).toHaveBeenCalledWith(['/DATA/a', '/DATA/b'])
    expect(ok).toBe(true)
  })

  it('create 空数组不打网络、回 false', async () => {
    const s = useSharesStore()
    expect(await s.create([])).toBe(false)
    expect(createShare).not.toHaveBeenCalled()
  })

  it('remove 调 deleteShare(id) 并重载', async () => {
    listShares.mockResolvedValue([])
    const s = useSharesStore()
    await s.remove(7)
    expect(deleteShare).toHaveBeenCalledWith(7)
  })
})
```

- [ ] **Step 6: Run → fail**

Run: `pnpm exec vitest run src/files/stores/shares.test.ts`
Expected: FAIL(Cannot find module './shares')

- [ ] **Step 7: Implement `src/files/stores/shares.ts`**

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'
import { shareName } from '../util/sambaPath'

export interface ShareRow { id: number; path: string; name: string }

export const useSharesStore = defineStore('shares', () => {
  const items = ref<ShareRow[]>([])
  const loading = ref(false)
  const toast = useToast()
  const t = i18n.global.t

  async function load(): Promise<void> {
    loading.value = true
    try {
      const raw = await service.samba.listShares()
      items.value = raw.map((s) => ({ id: s.id, path: s.path, name: shareName(s.path) }))
    } catch (e) {
      items.value = []
      console.warn('[shares] load failed', e)
    } finally {
      loading.value = false
    }
  }

  async function create(paths: string[]): Promise<boolean> {
    if (!paths.length) return false
    try {
      await service.samba.createShare(paths)
      await load()
      toast.show(paths.length > 1 ? t('filesShareBatchDone', { count: paths.length }) : t('filesShareDone'))
      return true
    } catch {
      toast.show(t('filesShareFailed'))
      return false
    }
  }

  async function remove(id: number): Promise<boolean> {
    try {
      await service.samba.deleteShare(id)
      await load()
      toast.show(t('filesUnshareDone'))
      return true
    } catch {
      toast.show(t('filesShareFailed'))
      return false
    }
  }

  return { items, loading, load, create, remove }
})
```

- [ ] **Step 8: Add i18n keys** — 在 `src/i18n/zh_cn.ts` 的 `zh_cn: { ... }` 里加(放在 `filesXxx` 附近):

```ts
    filesSharesTitle: '本地网络分享',
    filesSharesNav: '共享',
    filesSharesEmpty: '还没有共享。右键任意文件夹即可共享到局域网。',
    filesShareToLan: '共享到局域网',
    filesShareDone: '已共享',
    filesShareBatchDone: '已共享 {count} 个文件夹',
    filesShareFailed: '操作失败',
    filesUnshareDone: '已取消共享',
    filesShareGetLink: '获取链接',
    filesShareGoto: '前往',
    filesUnshare: '取消共享',
    filesUnshareConfirmTitle: '取消共享',
    filesUnshareConfirmMsg: '确定取消共享「{name}」吗?局域网将无法再访问它。',
    filesShareLinkTitle: '文件夹已共享',
    filesShareLinkHint: '在下列地址访问共享文件夹(Samba)。',
    filesShareWindows: 'PC(Windows 资源管理器)',
    filesShareMac: 'Mac(访达)',
    filesShareCopy: '复制',
    filesShareCopied: '已复制',
    filesGotIt: '我知道了',
```

- [ ] **Step 9: Run → pass + typecheck**

Run: `pnpm exec vitest run src/files/stores/shares.test.ts src/files/util/sambaPath.test.ts && pnpm exec vue-tsc --noEmit`
Expected: PASS + 0 类型错误

- [ ] **Step 10: Commit**

```bash
git add src/files/util/sambaPath.ts src/files/util/sambaPath.test.ts src/files/stores/shares.ts src/files/stores/shares.test.ts src/i18n/zh_cn.ts
git commit -m "feat(files-p6): sambaPath util + shares store + zh_cn keys"
```

---

