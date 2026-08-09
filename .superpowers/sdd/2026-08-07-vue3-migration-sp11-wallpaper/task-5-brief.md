### Task 5: 弹窗骨架 —— 四个预设 + 实时预览 + 取消/应用

**Files:**
- Create: `src/components/WallpaperDialog.vue`
- Create: `src/components/WallpaperDialog.test.ts`
- Modify: `src/i18n/zh_cn.base.ts` · `src/i18n/en_us.base.ts`(加键)

**Interfaces:**
- Consumes: Task 4 的 store 全部 action;`useThemeStore().setTheme`
- Produces: `WallpaperDialog.vue` 默认导出;DOM 契约 `[data-test="wp-preset-blue|light|w01|w02"]`、`[data-test="wp-apply"]`、`[data-test="wp-cancel"]`、`[data-test="wp-error"]`

**新增 i18n 键(zh / en 各一份,键名相同):**

| 键 | zh_cn | en_us |
|---|---|---|
| `wpTitle` | 更换壁纸 | Change wallpaper |
| `wpPresetBlue` | 蓝色底板 | Blue base |
| `wpPresetLight` | 白色底板 | White base |
| `wpBuiltin1` | 内置壁纸 1 | Built-in 1 |
| `wpBuiltin2` | 内置壁纸 2 | Built-in 2 |
| `wpUpload` | 上传图片 | Upload image |
| `wpFromNas` | 从 NAS 选择 | Choose from NAS |
| `wpApply` | 应用 | Apply |
| `wpCancel` | 取消 | Cancel |
| `wpSaveFailed` | 保存失败,请重试 | Save failed, please try again |
| `wpTooLarge` | 图片不能超过 10 MB | Image must be 10 MB or smaller |
| `wpUploadFailed` | 上传失败,请重试 | Upload failed, please try again |
| `wpSetOk` | 已设为壁纸 | Wallpaper updated |
| `themePhoto` | 照片… | Photo… |

- [ ] **Step 1: 加 i18n 键** —— 往 `src/i18n/zh_cn.base.ts` 与 `src/i18n/en_us.base.ts` 各追加上表对应的一段(键名完全一致,值取对应列)。

- [ ] **Step 2: 写失败测试 `src/components/WallpaperDialog.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../i18n/zh_cn'
import zhSp9 from '../i18n/zh_cn.sp9'

const setCustomStorage = vi.fn(async () => undefined)
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => '',
      setCustomStorage: (...a: unknown[]) => setCustomStorage(...(a as [])),
      uploadImage: async () => ({ path: '/d/1/wallpaper.jpg', file_name: 'wallpaper.jpg', online_path: 'x' }),
      setImageFromPath: async () => ({ path: '/d/1/wallpaper.png', file_name: 'wallpaper.png', online_path: 'x' }),
    },
    image: { imageUrl: (p: string) => `/v1/image?path=${p}` },
    storage: { list: async () => [] },
    raid: { list: async () => [] },
    folder: { getList: async () => ({ items: [] }) },
  },
}))

import WallpaperDialog from './WallpaperDialog.vue'
import { useWallpaperStore } from '../stores/wallpaper'
import { useThemeStore } from '../stores/theme'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

function mountOpen() {
  const wp = useWallpaperStore()
  wp.openDialog()
  return mount(WallpaperDialog, { global: { plugins: [i18n] } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  delete document.documentElement.dataset.wallpaper
  delete document.documentElement.dataset.theme
  setCustomStorage.mockClear()
})

describe('WallpaperDialog presets', () => {
  it('renders four presets plus upload and nas entries', () => {
    const w = mountOpen()
    for (const id of ['blue', 'light', 'w01', 'w02']) {
      expect(w.find(`[data-test="wp-preset-${id}"]`).exists(), id).toBe(true)
    }
    expect(w.find('[data-test="wp-upload"]').exists()).toBe(true)
    expect(w.find('[data-test="wp-nas"]').exists()).toBe(true)
  })

  it('has no "restore default" button -- the blue base preset IS the default', () => {
    expect(mountOpen().find('[data-test="wp-restore"]').exists()).toBe(false)
  })

  it('picking a builtin previews live without persisting', async () => {
    const w = mountOpen()
    await w.find('[data-test="wp-preset-w01"]').trigger('click')
    expect(document.documentElement.dataset.wallpaper).toBe('')
    expect(setCustomStorage).not.toHaveBeenCalled()
  })

  it('picking a builtin leaves the theme alone', async () => {
    const theme = useThemeStore()
    theme.setTheme('light')
    const w = mountOpen()
    await w.find('[data-test="wp-preset-w01"]').trigger('click')
    expect(theme.theme).toBe('light')
  })

  it('picking the white base clears the wallpaper and switches the theme', async () => {
    const theme = useThemeStore()
    const w = mountOpen()
    await w.find('[data-test="wp-preset-w01"]').trigger('click')
    await w.find('[data-test="wp-preset-light"]').trigger('click')
    expect(document.documentElement.dataset.wallpaper).toBeUndefined()
    expect(theme.theme).toBe('light')
  })

  it('marks the active preset', async () => {
    const w = mountOpen()
    await w.find('[data-test="wp-preset-w02"]').trigger('click')
    expect(w.find('[data-test="wp-preset-w02"]').classes()).toContain('on')
    expect(w.find('[data-test="wp-preset-blue"]').classes()).not.toContain('on')
  })
})

describe('WallpaperDialog apply / cancel', () => {
  it('apply persists and closes', async () => {
    const wp = useWallpaperStore()
    const w = mountOpen()
    await w.find('[data-test="wp-preset-w01"]').trigger('click')
    await w.find('[data-test="wp-apply"]').trigger('click')
    await flushPromises()
    expect(setCustomStorage).toHaveBeenCalledWith('wallpaper_v3', { kind: 'builtin', id: 'w01' })
    expect(wp.dialogOpen).toBe(false)
  })

  it('cancel rolls back the record and the theme, and closes', async () => {
    const theme = useThemeStore()
    theme.setTheme('blue')
    const w = mountOpen()
    await w.find('[data-test="wp-preset-light"]').trigger('click')
    await w.find('[data-test="wp-cancel"]').trigger('click')
    expect(theme.theme).toBe('blue')
    expect(useWallpaperStore().dialogOpen).toBe(false)
  })

  it('a failed apply shows an inline error and keeps the dialog open', async () => {
    // Inline, not a toast: the toast layer is z-index 60 and a dialog overlay sits
    // above it, so a toast fired from inside a dialog is covered and blurred.
    setCustomStorage.mockRejectedValueOnce(new Error('boom'))
    const w = mountOpen()
    await w.find('[data-test="wp-preset-w01"]').trigger('click')
    await w.find('[data-test="wp-apply"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="wp-error"]').text()).toBe('保存失败,请重试')
    expect(useWallpaperStore().dialogOpen).toBe(true)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm vitest run src/components/WallpaperDialog.test.ts`
Expected: FAIL —— 找不到 `./WallpaperDialog.vue`。

- [ ] **Step 4: 写实现 `src/components/WallpaperDialog.vue`**

```vue
<script setup lang="ts">
// SP11 wallpaper picker. Opened from four places (topbar theme menu, settings
// general row, desktop context menu, and indirectly the files context menu),
// so it is an app-level singleton mounted in App.vue next to AppToast.
//
// Deliberately NOT built on components/ui/Dialog.vue: that wrapper's overlay
// carries `backdrop-filter: var(--overlay-blur)`, which would blur the very
// wallpaper this dialog previews. Following SearchDialog.vue:308 instead --
// reka-ui DialogRoot with :modal="false", anchored to the bottom, no overlay,
// so the top of the screen keeps showing the real desktop.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogRoot, DialogPortal, DialogContent, DialogTitle } from 'reka-ui'
import { useWallpaperStore } from '../stores/wallpaper'
import { useThemeStore, type Theme } from '../stores/theme'
import { BUILTIN_IDS, NONE, builtinUrl, type BuiltinId } from '../stores/wallpaper'

const { t } = useI18n()
const wp = useWallpaperStore()
const theme = useThemeStore()
const error = ref('')
const saving = ref(false)

const activeId = computed<string>(() => {
  const r = wp.record
  if (r.kind === 'builtin') return r.id
  if (r.kind === 'image') return 'image'
  return theme.theme === 'light' ? 'light' : 'blue'
})

function pickBase(which: Theme) {
  error.value = ''
  wp.preview(NONE)
  theme.setTheme(which)
}

function pickBuiltin(id: BuiltinId) {
  error.value = ''
  wp.preview({ kind: 'builtin', id })   // theme untouched on purpose
}

async function apply() {
  error.value = ''
  saving.value = true
  try {
    await wp.commit()
    wp.closeDialog()
  } catch {
    error.value = t('wpSaveFailed')
  } finally {
    saving.value = false
  }
}

function cancel() {
  error.value = ''
  wp.cancelPreview()
  wp.closeDialog()
}

function onOpenChange(open: boolean) {
  // Esc / outside-dismiss must behave like Cancel, not like silently keeping an
  // unconfirmed preview.
  if (!open) cancel()
}
</script>

<template>
  <DialogRoot :open="wp.dialogOpen" :modal="false" @update:open="onOpenChange">
    <DialogPortal>
      <DialogContent class="wp-sheet" :aria-describedby="undefined">
        <DialogTitle class="wp-title">{{ t('wpTitle') }}</DialogTitle>

        <div class="wp-grid">
          <button type="button" class="wp-tile wp-tile-blue" :class="{ on: activeId === 'blue' }"
            data-test="wp-preset-blue" @click="pickBase('blue')">
            <span class="wp-tile-label">{{ t('wpPresetBlue') }}</span>
          </button>
          <button type="button" class="wp-tile wp-tile-light" :class="{ on: activeId === 'light' }"
            data-test="wp-preset-light" @click="pickBase('light')">
            <span class="wp-tile-label">{{ t('wpPresetLight') }}</span>
          </button>
          <button v-for="(id, i) in BUILTIN_IDS" :key="id" type="button" class="wp-tile"
            :class="{ on: activeId === id }" :data-test="`wp-preset-${id}`"
            :style="{ backgroundImage: `url(${builtinUrl(id)})` }" @click="pickBuiltin(id)">
            <span class="wp-tile-label">{{ t(i === 0 ? 'wpBuiltin1' : 'wpBuiltin2') }}</span>
          </button>
        </div>

        <div class="wp-actions">
          <slot name="sources" />
        </div>

        <p v-if="error" class="wp-error" data-test="wp-error">{{ error }}</p>

        <div class="wp-foot">
          <button type="button" class="bar-btn" data-test="wp-cancel" @click="cancel">{{ t('wpCancel') }}</button>
          <button type="button" class="bar-btn wp-primary" data-test="wp-apply" :disabled="saving"
            @click="apply">{{ t('wpApply') }}</button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/* Bottom sheet, no overlay: the upper half of the viewport must keep showing the
   live desktop so the preview is meaningful. */
.wp-sheet {
  position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 1001;
  width: min(760px, 94vw); padding: 18px 20px 16px;
  border: 1px solid var(--card-border); border-radius: var(--radius-sm);
  background: var(--popup-bg); backdrop-filter: var(--blur);
  box-shadow: var(--card-shadow-hi); color: var(--fg);
}
.wp-title { margin: 0 0 14px; font-size: 16px; font-weight: 600; }
.wp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.wp-tile {
  position: relative; aspect-ratio: 16 / 10; padding: 0; overflow: hidden; cursor: pointer;
  border: 2px solid transparent; border-radius: var(--radius-xs);
  background-color: var(--card); background-size: cover; background-position: center;
  transition: border-color 0.2s var(--ease);
}
.wp-tile:hover { border-color: var(--accent-soft-bd); }
.wp-tile.on { border-color: var(--accent); }
.wp-tile-blue { background-image: var(--app-bg-preview-blue); }
.wp-tile-light { background-image: var(--app-bg-preview-light); }
.wp-tile-label {
  position: absolute; inset: auto 0 0 0; padding: 4px 6px; font-size: 11px;
  background: var(--wallpaper-tile-label-bg); color: var(--wallpaper-tile-label-fg);
}
.wp-actions { display: flex; gap: 10px; margin-top: 14px; }
.wp-error { margin: 12px 0 0; font-size: 13px; color: var(--remove-fg); }
.wp-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
.wp-primary { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.wp-primary:hover:not(:disabled) { background: var(--accent); filter: brightness(1.08); }
</style>
```

- [ ] **Step 5: 补 4 个新 token 到 `src/styles/theme.css`** —— 上面样式里用到 4 个不存在的 token,必须在**两套主题块**都给值,否则 `wallpaper.css.test.ts` 的同类守卫思路失效、且 color-guard 逼着我们不能写裸色:

深色 `:root` 块内(紧跟 `--wallpaper-scrim` 之后):
```css
  /* SP11: preset tiles in the wallpaper picker must show each base's REAL look
     regardless of the theme in effect, so they cannot read --app-bg. */
  --app-bg-preview-blue: linear-gradient(160deg, #4a5d92, #2a3354 55%, #141a2b);
  --app-bg-preview-light: linear-gradient(160deg, #ffffff, #f7f5ef);
  --wallpaper-tile-label-bg: rgba(0, 0, 0, 0.45);
  --wallpaper-tile-label-fg: #ffffff;
```
浅色 `:root[data-theme="light"]` 块内(紧跟它的 `--wallpaper-scrim` 之后)——**前两个值刻意与深色块完全相同**(预览块画的是"那套主题长什么样",与当前主题无关),后两个换成纸感取值:
```css
  --app-bg-preview-blue: linear-gradient(160deg, #4a5d92, #2a3354 55%, #141a2b);
  --app-bg-preview-light: linear-gradient(160deg, #ffffff, #f7f5ef);
  --wallpaper-tile-label-bg: rgba(255, 255, 255, 0.72);
  --wallpaper-tile-label-fg: #1c1b19;
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm vitest run src/components/WallpaperDialog.test.ts src/styles/color-guard.test.ts src/i18n && pnpm vue-tsc --noEmit`
Expected: 全绿(`src/i18n` 那批包含 parity 与分片守卫,确认新键双语齐全且没撞车)+ exit 0。

- [ ] **Step 7: Commit**

```bash
git add src/components/WallpaperDialog.vue src/components/WallpaperDialog.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/styles/theme.css
git commit -o src/components/WallpaperDialog.vue src/components/WallpaperDialog.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/styles/theme.css -m "feat(wallpaper): add the picker sheet with four presets

Built directly on reka-ui rather than the shared Dialog wrapper, whose overlay
blurs its own backdrop and would defeat the point of previewing a wallpaper.
Anchored to the bottom with no overlay so the live desktop stays visible.
Preset tiles paint each base's real look from dedicated tokens instead of
--app-bg, which would always show whichever theme is currently active.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

