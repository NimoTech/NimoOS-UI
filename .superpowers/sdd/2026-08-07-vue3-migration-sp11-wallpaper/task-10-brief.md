### Task 10: 文件区右键「设为壁纸」

**Files:**
- Create: `src/files/util/wallpaperExt.ts`
- Create: `src/files/util/wallpaperExt.test.ts`
- Modify: `src/files/components/FileContextMenu.vue`
- Modify: `src/files/components/FileContextMenu.test.ts`
- Modify: `src/views/Files.vue`(action 分发加一支)
- Modify: `src/i18n/zh_cn.base.ts` · `src/i18n/en_us.base.ts`(加 `filesCtxSetWallpaper`)

**Interfaces:**
- Consumes: Task 4 的 `wp.setFromNasPath`;`useToast().show`
- Produces:
  ```ts
  export const WALLPAPER_EXT: readonly string[]                  // ['png','jpg','jpeg','bmp','gif','svg']
  export function canBeWallpaper(entry: { name: string; is_dir: boolean } | null): boolean
  ```
  DOM 契约:`.ctx-set-wallpaper`;action 名 `'set-wallpaper'`

**新增 i18n 键:** `filesCtxSetWallpaper` → zh `设为壁纸` / en `Set as wallpaper`

- [ ] **Step 1: 写失败测试 `src/files/util/wallpaperExt.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { WALLPAPER_EXT, canBeWallpaper } from './wallpaperExt'

describe('canBeWallpaper', () => {
  it('mirrors Vue2 mixins/mixin.js:52 exactly', () => {
    expect([...WALLPAPER_EXT]).toEqual(['png', 'jpg', 'jpeg', 'bmp', 'gif', 'svg'])
  })
  it('accepts every listed extension, case-insensitively', () => {
    for (const ext of WALLPAPER_EXT) {
      expect(canBeWallpaper({ name: `a.${ext}`, is_dir: false }), ext).toBe(true)
      expect(canBeWallpaper({ name: `a.${ext.toUpperCase()}`, is_dir: false }), ext).toBe(true)
    }
  })
  it('rejects directories even when named like an image', () => {
    // Vue2 short-circuited on is_dir before looking at the extension (ContextMenu.vue:164).
    expect(canBeWallpaper({ name: 'photos.jpg', is_dir: true })).toBe(false)
  })
  it('rejects other extensions, extensionless names and null', () => {
    expect(canBeWallpaper({ name: 'a.webp', is_dir: false })).toBe(false)
    expect(canBeWallpaper({ name: 'a.mp4', is_dir: false })).toBe(false)
    expect(canBeWallpaper({ name: 'README', is_dir: false })).toBe(false)
    expect(canBeWallpaper({ name: '.jpg', is_dir: false })).toBe(true)
    expect(canBeWallpaper(null)).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/files/util/wallpaperExt.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 写实现 `src/files/util/wallpaperExt.ts`**

```ts
/** Extensions the "Set as wallpaper" item is offered for. Ported verbatim from
 *  Vue2 mixins/mixin.js:52 -- note it includes svg and gif but not webp, which
 *  matches what the backend's GetImageExt accepts. */
export const WALLPAPER_EXT = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'svg'] as const

export function canBeWallpaper(entry: { name: string; is_dir: boolean } | null): boolean {
  if (!entry || entry.is_dir) return false
  const dot = entry.name.lastIndexOf('.')
  if (dot < 0) return false
  const ext = entry.name.slice(dot + 1).toLowerCase()
  return (WALLPAPER_EXT as readonly string[]).includes(ext)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/files/util/wallpaperExt.test.ts`
Expected: PASS。

- [ ] **Step 5: 写菜单项的失败测试** —— 追加到 `src/files/components/FileContextMenu.test.ts`:

```ts
describe('set as wallpaper (SP11)', () => {
  const img = { name: 'a.jpg', path: '/DATA/Gallery/a.jpg', is_dir: false } as never

  it('appears for a single image outside snapshot view', () => {
    const w = mountMenu({ entry: img, selectedCount: 1 })
    expect(w.find('.ctx-set-wallpaper').exists()).toBe(true)
  })
  it('hides for a non-image', () => {
    const w = mountMenu({ entry: { name: 'a.mp4', path: '/DATA/a.mp4', is_dir: false } as never, selectedCount: 1 })
    expect(w.find('.ctx-set-wallpaper').exists()).toBe(false)
  })
  it('hides for a folder', () => {
    const w = mountMenu({ entry: { name: 'Gallery', path: '/DATA/Gallery', is_dir: true } as never, selectedCount: 1 })
    expect(w.find('.ctx-set-wallpaper').exists()).toBe(false)
  })
  it('hides on multi-select, like Copy Path and Rename', () => {
    const w = mountMenu({ entry: img, selectedCount: 3 })
    expect(w.find('.ctx-set-wallpaper').exists()).toBe(false)
  })
  it('hides in snapshot view, which is read-only', () => {
    useSnapshotBrowseStore().$patch({ /* set whatever makes isSnapshotView true in this suite */ })
    const w = mountMenu({ entry: img, selectedCount: 1 })
    expect(w.find('.ctx-set-wallpaper').exists()).toBe(false)
  })
  it('emits the set-wallpaper action with the entry', async () => {
    const w = mountMenu({ entry: img, selectedCount: 1 })
    await w.find('.ctx-set-wallpaper').trigger('click')
    expect(w.emitted('action')?.[0]).toEqual(['set-wallpaper', img])
  })
})
```

> 开工时照该文件既有的 `mountMenu` helper 与「进入快照态」的既有写法对齐(现有用例里已有让 `inSnapshot` 为真的做法,直接复用,不要新造)。

- [ ] **Step 6: 跑测试确认失败**

Run: `pnpm vitest run src/files/components/FileContextMenu.test.ts`
Expected: 新用例 FAIL。

- [ ] **Step 7: 改 `FileContextMenu.vue`** —— script 段:

```ts
import { canBeWallpaper } from '../util/wallpaperExt'

// Same gating as Vue2 ContextMenu.vue:96 -- single selection, image file, and
// hidden in the read-only snapshot view.
const showSetWallpaper = computed(() => single.value && !inSnapshot.value && canBeWallpaper(props.entry))
```
模板 —— 放在 `ctx-share` 之后、`showSeparator` 分割线之前:
```vue
        <ContextMenuItem v-if="showSetWallpaper" class="ui-ctx-item ctx-set-wallpaper" @select="fire('set-wallpaper')">{{ t('filesCtxSetWallpaper') }}</ContextMenuItem>
```
并把 `showSeparator` 的条件补上这一项,避免只剩删除时出现悬空分割线:
```ts
const showSeparator = computed(
  () => showDelete.value && (showCopyPath.value || showRename.value || showFavorite.value || showShare.value || showSetWallpaper.value),
)
```

- [ ] **Step 8: 接 `src/views/Files.vue` 的 action 分发** —— 在既有 `switch`/映射里加一支:

```ts
    case 'set-wallpaper': {
      if (!entry) return
      try {
        await useWallpaperStore().setFromNasPath(entry.path)
        toast.show(t('wpSetOk'))
      } catch (e) {
        // The backend caps this path at 10 MB and reports failures as HTTP 200
        // with success != 200; surface its message rather than failing silently
        // the way Vue2's error branches did.
        toast.show(String((e as Error)?.message || t('wpUploadFailed')), 5000, 'danger')
      }
      return
    }
```
(照该文件既有的 `toast` / `t` / `await` 写法对齐;`useWallpaperStore` 顶部 import。)

- [ ] **Step 9: 跑测试确认通过**

Run: `pnpm vitest run src/files && pnpm vue-tsc --noEmit`
Expected: 全绿 + exit 0。

- [ ] **Step 10: Commit**

```bash
git add src/files/util/wallpaperExt.ts src/files/util/wallpaperExt.test.ts src/files/components/FileContextMenu.vue src/files/components/FileContextMenu.test.ts src/views/Files.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -o src/files/util/wallpaperExt.ts src/files/util/wallpaperExt.test.ts src/files/components/FileContextMenu.vue src/files/components/FileContextMenu.test.ts src/views/Files.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts -m "feat(wallpaper): add Set as wallpaper to the files context menu

Extension whitelist and gating are ported verbatim from Vue2, including the
snapshot-view exclusion. Failures surface the backend's own message -- its
10 MB cap on this path arrives as HTTP 200 with a non-200 success field, so a
silent branch would look like success.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

