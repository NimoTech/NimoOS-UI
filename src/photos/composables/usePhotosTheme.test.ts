import { describe, it, expect, beforeEach } from 'vitest'
import { usePhotosTheme, __resetPhotosThemeForTests } from './usePhotosTheme'

describe('usePhotosTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetPhotosThemeForTests()
  })

  it('defaults to dark when nothing is stored', () => {
    const { theme, themeClass } = usePhotosTheme()
    expect(theme.value).toBe('dark')
    expect(themeClass.value).toBe('')
  })

  it('migrates the Vue2 legacy key once and writes the new key', () => {
    localStorage.setItem('nimoos.photos.theme', 'light')
    const { theme } = usePhotosTheme()
    expect(theme.value).toBe('light')
    expect(localStorage.getItem('nimo_photos_theme')).toBe('light')
  })

  it('prefers the new key over the legacy key', () => {
    localStorage.setItem('nimoos.photos.theme', 'light')
    localStorage.setItem('nimo_photos_theme', 'dark')
    const { theme } = usePhotosTheme()
    expect(theme.value).toBe('dark')
  })

  it('set() persists and themeClass follows', () => {
    const { set, themeClass } = usePhotosTheme()
    set('light')
    expect(localStorage.getItem('nimo_photos_theme')).toBe('light')
    expect(themeClass.value).toBe('is-light')
  })

  it('ignores garbage stored values and falls back to dark', () => {
    localStorage.setItem('nimo_photos_theme', 'sparkly')
    const { theme } = usePhotosTheme()
    expect(theme.value).toBe('dark')
  })

  it('two consumers share one themeClass instance and see each other\'s set()', () => {
    const a = usePhotosTheme()
    const b = usePhotosTheme()
    expect(a.themeClass).toBe(b.themeClass)
    a.set('light')
    expect(b.themeClass.value).toBe('is-light')
  })
})
