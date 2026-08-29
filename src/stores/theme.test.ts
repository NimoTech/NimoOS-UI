import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore, applyTheme, initialTheme, isTheme, THEMES } from './theme'

describe('theme store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('THEMES and isTheme', () => {
    expect(THEMES).toEqual(['blue', 'light'])
    expect(isTheme('light')).toBe(true)
    expect(isTheme('green')).toBe(false)
    expect(isTheme(null)).toBe(false)
  })

  it('applyTheme: light sets the attribute, blue removes it', () => {
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    applyTheme('blue')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('initialTheme: reads localStorage, falls back to blue when invalid', () => {
    expect(initialTheme()).toBe('blue')
    localStorage.setItem('theme', 'light')
    expect(initialTheme()).toBe('light')
    localStorage.setItem('theme', 'nope')
    expect(initialTheme()).toBe('blue')
  })

  it('setTheme: updates state + data-theme + localStorage', () => {
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

  it('previewTheme (I2): updates state + data-theme but never touches localStorage', () => {
    // This is the mechanism the I2 fix relies on: WallpaperDialog's preset
    // tiles call this instead of setTheme() during preview, so Cancel can
    // discard the pick without a localStorage write ever having happened.
    // Pins it directly against the store this bug actually lived in.
    const store = useThemeStore()
    store.setTheme('blue') // confirmed baseline, persisted
    store.previewTheme('light')
    expect(store.theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('blue') // still the confirmed value, not 'light'
  })
})
