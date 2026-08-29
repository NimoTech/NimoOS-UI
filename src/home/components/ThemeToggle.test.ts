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
import { useToast } from '../../stores/toast'

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

  it('toasts a failure instead of leaving the user with a silently unsaved base', async () => {
    // Controller override (task-8 brief): pickBase must not fire-and-forget
    // commit() — a rejected save must surface, or the wallpaper appears to
    // vanish with no explanation and reappears after a reload.
    const wp = useWallpaperStore()
    vi.spyOn(wp, 'commit').mockRejectedValueOnce(new Error('network down'))
    const w = await openMenu()
    await w.find('[data-test="tt-blue"]').trigger('click')
    await vi.waitFor(() => {
      expect(useToast().toasts.some((t) => t.text === zh.wpSaveFailed)).toBe(true)
    })
  })
})
