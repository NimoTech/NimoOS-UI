import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore, applyTheme, initialTheme, isTheme, THEMES } from './theme'

describe('theme store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('THEMES 与 isTheme', () => {
    expect(THEMES).toEqual(['blue', 'light'])
    expect(isTheme('light')).toBe(true)
    expect(isTheme('green')).toBe(false)
    expect(isTheme(null)).toBe(false)
  })

  it('applyTheme: light 置属性, blue 移除属性', () => {
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    applyTheme('blue')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('initialTheme: 读 localStorage, 非法回 blue', () => {
    expect(initialTheme()).toBe('blue')
    localStorage.setItem('theme', 'light')
    expect(initialTheme()).toBe('light')
    localStorage.setItem('theme', 'nope')
    expect(initialTheme()).toBe('blue')
  })

  it('setTheme: 改 state + data-theme + localStorage', () => {
    const store = useThemeStore()
    store.setTheme('light')
    expect(store.theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
    store.setTheme('blue')
    expect(store.theme).toBe('blue')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem('theme')).toBe('blue')
  })
})
