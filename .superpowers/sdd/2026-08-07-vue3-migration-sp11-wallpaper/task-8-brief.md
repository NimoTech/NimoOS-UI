### Task 8: 顶栏三档(蓝色 / 白色 / 照片…)

**Files:**
- Modify: `src/home/components/ThemeToggle.vue`
- Modify: `src/home/components/ThemeToggle.test.ts`

**Interfaces:**
- Consumes: Task 4 的 `wp.openDialog`、`wp.record`、`wp.preview`;`theme.setTheme`
- Produces: DOM 契约 `[data-test="tt-blue"]` / `[data-test="tt-light"]` / `[data-test="tt-photo"]`

- [ ] **Step 1: 写失败测试** —— 替换 `src/home/components/ThemeToggle.test.ts` 全文:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => '',
      setCustomStorage: async () => undefined,
      uploadImage: async () => ({ path: '/d/1/wallpaper.jpg', file_name: 'w.jpg', online_path: 'x' }),
      setImageFromPath: async () => ({ path: '/d/1/wallpaper.png', file_name: 'w.png', online_path: 'x' }),
    },
  },
}))

import ThemeToggle from './ThemeToggle.vue'
import { useThemeStore } from '../../stores/theme'
import { useWallpaperStore } from '../../stores/wallpaper'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

async function openMenu() {
  const w = mount(ThemeToggle, { global: { plugins: [i18n] } })
  await w.find('.theme-btn').trigger('click')
  return w
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  delete document.documentElement.dataset.theme
  delete document.documentElement.dataset.wallpaper
})

describe('ThemeToggle', () => {
  it('offers three entries', async () => {
    const w = await openMenu()
    expect(w.find('[data-test="tt-blue"]').exists()).toBe(true)
    expect(w.find('[data-test="tt-light"]').exists()).toBe(true)
    expect(w.find('[data-test="tt-photo"]').exists()).toBe(true)
  })

  it('picking a base clears any wallpaper and switches the theme in one step', async () => {
    useWallpaperStore().preview({ kind: 'builtin', id: 'w01' })
    const w = await openMenu()
    await w.find('[data-test="tt-light"]').trigger('click')
    expect(useThemeStore().theme).toBe('light')
    expect(document.documentElement.dataset.wallpaper).toBeUndefined()
  })

  it('checks the base matching the active theme when no wallpaper is set', async () => {
    useThemeStore().setTheme('light')
    const w = await openMenu()
    expect(w.find('[data-test="tt-light"]').attributes('aria-checked')).toBe('true')
    expect(w.find('[data-test="tt-blue"]').attributes('aria-checked')).toBe('false')
    expect(w.find('[data-test="tt-photo"]').attributes('aria-checked')).toBe('false')
  })

  it('checks Photo whenever any image is set, regardless of theme', async () => {
    useThemeStore().setTheme('light')
    useWallpaperStore().preview({ kind: 'builtin', id: 'w02' })
    const w = await openMenu()
    expect(w.find('[data-test="tt-photo"]').attributes('aria-checked')).toBe('true')
    expect(w.find('[data-test="tt-light"]').attributes('aria-checked')).toBe('false')
  })

  it('Photo opens the picker rather than applying anything itself', async () => {
    // The menu is min-width 148px; four thumbnails there would be unreadable, so
    // fine-grained choice lives in the sheet (owner call, 2026-08-07).
    const w = await openMenu()
    await w.find('[data-test="tt-photo"]').trigger('click')
    expect(useWallpaperStore().dialogOpen).toBe(true)
  })

  it('closes the menu after any pick', async () => {
    const w = await openMenu()
    await w.find('[data-test="tt-blue"]').trigger('click')
    expect(w.find('.theme-menu').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/home/components/ThemeToggle.test.ts`
Expected: FAIL —— 找不到 `[data-test="tt-photo"]`。

- [ ] **Step 3: 改 `ThemeToggle.vue`** —— 模板里的 `v-for="opt in THEMES"` 那块换成三个显式项:

```vue
      <div class="theme-menu" role="menu">
        <button class="theme-opt" role="menuitemradio" data-test="tt-blue"
          :class="{ on: active === 'blue' }" :aria-checked="active === 'blue'" @click="pickBase('blue')">
          <span class="sw sw-blue" />
          <span class="lbl">{{ t('themeBlue') }}</span>
          <span v-if="active === 'blue'" class="ck">✓</span>
        </button>
        <button class="theme-opt" role="menuitemradio" data-test="tt-light"
          :class="{ on: active === 'light' }" :aria-checked="active === 'light'" @click="pickBase('light')">
          <span class="sw sw-light" />
          <span class="lbl">{{ t('themeLight') }}</span>
          <span v-if="active === 'light'" class="ck">✓</span>
        </button>
        <button class="theme-opt" role="menuitemradio" data-test="tt-photo"
          :class="{ on: active === 'photo' }" :aria-checked="active === 'photo'" @click="pickPhoto()">
          <span class="sw sw-photo" />
          <span class="lbl">{{ t('themePhoto') }}</span>
          <span v-if="active === 'photo'" class="ck">✓</span>
        </button>
      </div>
```

script 段:
```ts
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore, type Theme } from '../../stores/theme'
import { useWallpaperStore, NONE } from '../../stores/wallpaper'

const { t } = useI18n()
const theme = useThemeStore()
const wp = useWallpaperStore()
const open = ref(false)

// Three entries, not two themes plus a wallpaper toggle: from the user's side
// this menu answers "what is behind everything", and an image answers it too.
const active = computed<'blue' | 'light' | 'photo'>(() =>
  wp.record.kind !== 'none' ? 'photo' : theme.theme === 'light' ? 'light' : 'blue',
)

function pickBase(v: Theme) {
  wp.preview(NONE)
  void wp.commit()      // one-step from the topbar: no confirm step to defer to
  theme.setTheme(v)
  open.value = false
}

function pickPhoto() {
  open.value = false
  wp.openDialog()
}
```

样式加第三个色块(`theme-exception` 注释必须保留形态,理由与既有两块相同):
```css
/* theme-exception: preview swatch shows what the photo option looks like, not
   the active theme's colours. */
.sw-photo { background: linear-gradient(135deg, #7a8ea8, #3c4a5e); }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/home/components/ThemeToggle.test.ts src/styles/color-guard.test.ts && pnpm vue-tsc --noEmit`
Expected: 全绿 + exit 0。

- [ ] **Step 5: Commit**

```bash
git add src/home/components/ThemeToggle.vue src/home/components/ThemeToggle.test.ts
git commit -o src/home/components/ThemeToggle.vue src/home/components/ThemeToggle.test.ts -m "feat(wallpaper): give the topbar picker a third Photo entry

From the user's side this menu answers what sits behind everything, and an
image answers it as much as a gradient does. The two bases stay one-step; Photo
defers to the sheet because a 148px menu cannot show four legible thumbnails.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

