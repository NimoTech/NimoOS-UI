import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import PhotosThemeToggle from './PhotosThemeToggle.vue'
import { __resetPhotosThemeForTests } from '../composables/usePhotosTheme'

const i18n = createI18n({
  legacy: false,
  locale: 'en_us',
  messages: { en_us: {
    photosSettingsAppearance: 'Appearance',
    photosSettingsThemeDark: 'Dark',
    photosSettingsThemeLight: 'Light',
  } },
})

function mountToggle() {
  return mount(PhotosThemeToggle, { global: { plugins: [i18n] } })
}

describe('PhotosThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetPhotosThemeForTests()
  })

  it('renders both options with dark active by default', () => {
    const w = mountToggle()
    const active = w.find('[data-active="true"]')
    expect(active.attributes('data-theme-option')).toBe('dark')
  })

  it('clicking Light persists the new key and flips the active state', async () => {
    const w = mountToggle()
    await w.find('[data-theme-option="light"]').trigger('click')
    expect(localStorage.getItem('nimo_photos_theme')).toBe('light')
    expect(w.find('[data-active="true"]').attributes('data-theme-option')).toBe('light')
  })
})
