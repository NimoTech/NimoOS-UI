import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from '../../stores/theme'
import ThemeToggle from './ThemeToggle.vue'

describe('ThemeToggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('点击按钮展开菜单,选白色切到 light', async () => {
    const store = useThemeStore()
    const w = mount(ThemeToggle)
    expect(w.find('.theme-menu').exists()).toBe(false)
    await w.get('.theme-btn').trigger('click')
    expect(w.find('.theme-menu').exists()).toBe(true)
    const light = w.findAll('.theme-opt').find((b) => b.text().includes('白色'))!
    await light.trigger('click')
    expect(store.theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(w.find('.theme-menu').exists()).toBe(false) // 选完关闭
  })

  it('当前主题项打勾', async () => {
    useThemeStore().setTheme('light')
    const w = mount(ThemeToggle)
    await w.get('.theme-btn').trigger('click')
    const on = w.findAll('.theme-opt').find((b) => b.classes().includes('on'))!
    expect(on.text()).toContain('白色')
  })
})
