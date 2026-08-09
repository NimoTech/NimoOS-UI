### Task 4: store 的服务端读写 + 预览/回滚

**Files:**
- Modify: `src/stores/wallpaper.ts`(加 Pinia store)
- Modify: `src/stores/wallpaper.test.ts`(追加 store 的 describe 块)

**Interfaces:**
- Consumes: Task 1 全部导出;Task 3 的 `service.users.uploadImage` / `setImageFromPath`
- Produces:
  ```ts
  export const useWallpaperStore: StoreDefinition  // id 'wallpaper'
  // state:   record: Ref<WallpaperRecord>   dialogOpen: Ref<boolean>   busy: Ref<boolean>
  // actions:
  //   openDialog(): void            // 顺带 beginPreview()
  //   closeDialog(): void
  //   preview(r: WallpaperRecord): void          // 只本地应用,不写缓存不落服务端
  //   beginPreview(): void                       // 快照 { record, theme }
  //   cancelPreview(): void                      // 连主题一起回滚
  //   commit(): Promise<void>                    // 落服务端 + 写缓存
  //   load(): Promise<void>
  //   setFromNasPath(path: string): Promise<void>   // PUT + 落服务端(文件区右键用)
  //   uploadAndPreview(file: File): Promise<void>   // 上传 + preview,不落服务端
  ```

- [ ] **Step 1: 写失败测试** —— 追加到 `src/stores/wallpaper.test.ts`:

```ts
import { setActivePinia, createPinia } from 'pinia'
import { vi } from 'vitest'
import { useWallpaperStore } from './wallpaper'
import { useThemeStore } from './theme'

const getCustomStorage = vi.fn<[string], Promise<unknown>>()
const setCustomStorage = vi.fn<[string, unknown], Promise<unknown>>()
const uploadImage = vi.fn()
const setImageFromPath = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: (...a: unknown[]) => getCustomStorage(...(a as [string])),
      setCustomStorage: (...a: unknown[]) => setCustomStorage(...(a as [string, unknown])),
      uploadImage: (...a: unknown[]) => uploadImage(...a),
      setImageFromPath: (...a: unknown[]) => setImageFromPath(...a),
    },
  },
}))

describe('wallpaper store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    delete document.documentElement.dataset.wallpaper
    delete document.documentElement.dataset.theme
    getCustomStorage.mockReset()
    setCustomStorage.mockReset().mockResolvedValue(undefined)
    uploadImage.mockReset()
    setImageFromPath.mockReset()
  })

  it('load reads wallpaper_v3 and applies it', async () => {
    getCustomStorage.mockResolvedValue({ kind: 'builtin', id: 'w02' })
    const s = useWallpaperStore()
    await s.load()
    expect(getCustomStorage).toHaveBeenCalledWith('wallpaper_v3')
    expect(s.record).toEqual({ kind: 'builtin', id: 'w02' })
    expect(document.documentElement.dataset.wallpaper).toBe('')
  })

  it('load degrades a rejected read to none without throwing', async () => {
    // Vue2's getWallpaperConfig had no catch at all (Home.vue:208-217).
    getCustomStorage.mockRejectedValue(new Error('offline'))
    const s = useWallpaperStore()
    await expect(s.load()).resolves.toBeUndefined()
    expect(s.record).toEqual(NONE)
  })

  it('load treats the empty-string blob the backend returns for an unset key as none', async () => {
    getCustomStorage.mockResolvedValue('')
    const s = useWallpaperStore()
    await s.load()
    expect(s.record).toEqual(NONE)
  })

  it('preview applies live but writes neither cache nor server', () => {
    const s = useWallpaperStore()
    s.preview({ kind: 'builtin', id: 'w01' })
    expect(document.documentElement.dataset.wallpaper).toBe('')
    expect(localStorage.getItem(WALLPAPER_CACHE_KEY)).toBeNull()
    expect(setCustomStorage).not.toHaveBeenCalled()
  })

  it('cancelPreview rolls back BOTH the record and the theme', () => {
    // Picking "white base" previews a theme switch as well as clearing the
    // wallpaper. Snapshotting only the record leaves the palette on light while
    // the background returns to blue -- the mismatch this test exists to pin.
    const theme = useThemeStore()
    const s = useWallpaperStore()

    // Starting point the user would be rolled back to: blue theme + builtin w01.
    theme.setTheme('blue')
    s.preview({ kind: 'builtin', id: 'w01' })

    s.beginPreview()
    s.preview(NONE)
    theme.setTheme('light')

    s.cancelPreview()
    expect(s.record).toEqual({ kind: 'builtin', id: 'w01' })
    expect(theme.theme).toBe('blue')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(document.documentElement.dataset.wallpaper).toBe('')
  })

  it('commit persists to wallpaper_v3 and caches locally', async () => {
    const s = useWallpaperStore()
    s.preview({ kind: 'builtin', id: 'w02' })
    await s.commit()
    expect(setCustomStorage).toHaveBeenCalledWith('wallpaper_v3', { kind: 'builtin', id: 'w02' })
    expect(JSON.parse(localStorage.getItem(WALLPAPER_CACHE_KEY) as string))
      .toEqual({ kind: 'builtin', id: 'w02' })
  })

  it('commit propagates a failed save so the dialog can stay open', async () => {
    setCustomStorage.mockRejectedValue(new Error('save failed'))
    const s = useWallpaperStore()
    s.preview({ kind: 'builtin', id: 'w02' })
    await expect(s.commit()).rejects.toThrow('save failed')
  })

  it('uploadAndPreview rejects an oversized file before touching the network', async () => {
    // The backend POST has no size limit of its own (spec section 8 item 2).
    const s = useWallpaperStore()
    const big = new File([new Uint8Array(1)], 'big.jpg')
    Object.defineProperty(big, 'size', { value: MAX_UPLOAD_BYTES + 1 })
    await expect(s.uploadAndPreview(big)).rejects.toThrow('too large')
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('uploadAndPreview stamps the record so the browser refetches the overwritten file', async () => {
    uploadImage.mockResolvedValue({ path: '/d/1/wallpaper.jpg', file_name: 'wallpaper.jpg', online_path: 'x' })
    const s = useWallpaperStore()
    const before = Date.now()
    const small = new File([new Uint8Array([1])], 'a.jpg')
    await s.uploadAndPreview(small)
    expect(uploadImage).toHaveBeenCalledWith('wallpaper', small)
    expect(s.record.kind).toBe('image')
    const r = s.record as { kind: 'image'; path: string; stamp: number }
    expect(r.path).toBe('/d/1/wallpaper.jpg')
    expect(r.stamp).toBeGreaterThanOrEqual(before)
    expect(setCustomStorage).not.toHaveBeenCalled()   // preview only
  })

  it('setFromNasPath goes through PUT and persists immediately (files context menu)', async () => {
    setImageFromPath.mockResolvedValue({ path: '/d/1/wallpaper.png', file_name: 'wallpaper.png', online_path: 'x' })
    const s = useWallpaperStore()
    await s.setFromNasPath('/DATA/Gallery/a.png')
    expect(setImageFromPath).toHaveBeenCalledWith('wallpaper', '/DATA/Gallery/a.png')
    expect(setCustomStorage).toHaveBeenCalledWith('wallpaper_v3', expect.objectContaining({ kind: 'image', path: '/d/1/wallpaper.png' }))
  })

  it('setFromNasPath propagates the backend rejection (e.g. image too large)', async () => {
    setImageFromPath.mockRejectedValue(new Error('Image too large'))
    const s = useWallpaperStore()
    await expect(s.setFromNasPath('/DATA/huge.jpg')).rejects.toThrow('Image too large')
    expect(setCustomStorage).not.toHaveBeenCalled()
  })

  it('openDialog snapshots, closeDialog does not roll back', () => {
    const s = useWallpaperStore()
    s.openDialog()
    expect(s.dialogOpen).toBe(true)
    s.closeDialog()
    expect(s.dialogOpen).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/stores/wallpaper.test.ts`
Expected: FAIL —— `useWallpaperStore is not exported`。

- [ ] **Step 3: 写实现** —— 追加到 `src/stores/wallpaper.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useThemeStore, applyTheme, type Theme } from './theme'

interface Snapshot { record: WallpaperRecord; theme: Theme }

export const useWallpaperStore = defineStore('wallpaper', () => {
  const record = ref<WallpaperRecord>(initialWallpaper())
  const dialogOpen = ref(false)
  const busy = ref(false)
  let snapshot: Snapshot | null = null

  /** Live-apply without persisting: the dialog previews against the real desktop. */
  function preview(r: WallpaperRecord): void {
    record.value = r
    applyWallpaper(r)
  }

  /** Snapshot MUST include the theme: the "blue base" / "white base" presets switch
   *  the theme as well as clearing the wallpaper, so a record-only snapshot leaves
   *  the palette on one theme and the background on the other after Cancel. */
  function beginPreview(): void {
    snapshot = { record: record.value, theme: useThemeStore().theme }
  }

  function cancelPreview(): void {
    if (!snapshot) return
    preview(snapshot.record)
    // applyTheme directly rather than setTheme: rolling back must not rewrite
    // localStorage with a value the user never confirmed.
    useThemeStore().theme = snapshot.theme
    applyTheme(snapshot.theme)
    snapshot = null
  }

  async function commit(): Promise<void> {
    await service.users.setCustomStorage(WALLPAPER_CUSTOM_KEY, record.value)
    cacheRecord(record.value)
    snapshot = null
  }

  async function load(): Promise<void> {
    try {
      const raw = await service.users.getCustomStorage(WALLPAPER_CUSTOM_KEY)
      // An unset key comes back as '' from the backend, which parseRecord maps to none.
      preview(parseRecord(raw))
      cacheRecord(record.value)
    } catch {
      // Never let a cold-start read failure blank the screen: keep whatever the
      // cache already applied. Vue2 swallowed this silently with no catch at all.
    }
  }

  async function uploadAndPreview(file: File): Promise<void> {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(`Wallpaper file is too large (max ${MAX_UPLOAD_BYTES} bytes)`)
    }
    busy.value = true
    try {
      const res = await service.users.uploadImage(WALLPAPER_IMAGE_KEY, file)
      preview({ kind: 'image', path: res.path, stamp: Date.now() })
    } finally {
      busy.value = false
    }
  }

  /** Files context menu: one shot, persists straight away (no dialog to confirm in). */
  async function setFromNasPath(path: string): Promise<void> {
    busy.value = true
    try {
      const res = await service.users.setImageFromPath(WALLPAPER_IMAGE_KEY, path)
      preview({ kind: 'image', path: res.path, stamp: Date.now() })
      await commit()
    } finally {
      busy.value = false
    }
  }

  function openDialog(): void { beginPreview(); dialogOpen.value = true }
  function closeDialog(): void { dialogOpen.value = false }

  return {
    record, dialogOpen, busy,
    preview, beginPreview, cancelPreview, commit, load,
    uploadAndPreview, setFromNasPath, openDialog, closeDialog,
  }
})
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/stores/wallpaper.test.ts && pnpm vue-tsc --noEmit`
Expected: PASS + exit 0。

- [ ] **Step 5: 变异验证(证明回滚快照那条不是空转)**

把 `beginPreview` 临时改成只存 record(`snapshot = { record: record.value, theme: 'blue' }`),重跑测试。
Expected: 「cancelPreview rolls back BOTH…」**必须变红**。改回后重跑至全绿。

- [ ] **Step 6: Commit**

```bash
git add src/stores/wallpaper.ts src/stores/wallpaper.test.ts
git commit -o src/stores/wallpaper.ts src/stores/wallpaper.test.ts -m "feat(wallpaper): add server persistence, live preview and rollback

The rollback snapshot carries the theme as well as the record because the base
presets switch the theme too; a record-only snapshot would leave the palette
and the background on different choices after Cancel. Cold-start read failures
keep whatever the local cache already painted instead of blanking the screen.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

