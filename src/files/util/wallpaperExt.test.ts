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
    expect(canBeWallpaper(null)).toBe(false)
  })
  it('accepts a dotfile literally named ".jpg" -- lastIndexOf(".") finds the leading dot, so the "extension" is the whole name minus that dot, which is a listed extension', () => {
    // M5 (final review): this was previously buried as a same-signed assertion
    // inside the "rejects ..." case above (name/behaviour mismatch). Documented
    // here rather than silently fixed, because it is arguably correct given the
    // implementation (lastIndexOf, not a real basename/extension parse) -- a
    // policy call, not a bug this fix wave is asked to change.
    expect(canBeWallpaper({ name: '.jpg', is_dir: false })).toBe(true)
  })
})
