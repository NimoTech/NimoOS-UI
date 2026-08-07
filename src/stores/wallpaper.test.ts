import { describe, it, expect, beforeEach } from 'vitest'
import {
  BUILTIN_IDS, MAX_UPLOAD_BYTES, NONE, WALLPAPER_CACHE_KEY, WALLPAPER_CUSTOM_KEY,
  applyWallpaper, builtinUrl, cacheRecord, initialWallpaper, parseRecord, recordUrl,
} from './wallpaper'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.wallpaper
  document.documentElement.style.removeProperty('--wallpaper-img')
})

describe('constants', () => {
  it('keys and limits are pinned', () => {
    // The server key MUST stay wallpaper_v3: sharing Vue2's `wallpaper` key would
    // hand Vue2 a builtin id it cannot resolve (spec section 2.3).
    expect(WALLPAPER_CUSTOM_KEY).toBe('wallpaper_v3')
    expect(WALLPAPER_CACHE_KEY).toBe('wallpaper')
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024)
    expect(BUILTIN_IDS).toEqual(['w01', 'w02'])
  })
})

describe('builtinUrl', () => {
  it('resolves both builtins to distinct non-empty urls', () => {
    const a = builtinUrl('w01')
    const b = builtinUrl('w02')
    expect(a).toContain('wallpaper01')
    expect(b).toContain('wallpaper02')
    expect(a).not.toBe(b)
  })
})

describe('recordUrl', () => {
  it('none has no url', () => {
    expect(recordUrl(NONE)).toBeNull()
  })
  it('builtin resolves through builtinUrl', () => {
    expect(recordUrl({ kind: 'builtin', id: 'w01' })).toBe(builtinUrl('w01'))
  })
  it('image url is same-origin, percent-encoded and stamped', () => {
    const url = recordUrl({ kind: 'image', path: '/DATA/my pics/a b.jpg', stamp: 1700 })
    // Relative on purpose: Vue2's SERVER_URL placeholder and its /ui + /user/
    // rewrites are not ported (spec section 7).
    expect(url).toBe('/v1/users/image?path=%2FDATA%2Fmy%20pics%2Fa%20b.jpg&t=1700')
  })
  it('stamp busts the browser cache because the backend always overwrites one filename', () => {
    const a = recordUrl({ kind: 'image', path: '/DATA/a.jpg', stamp: 1 })
    const b = recordUrl({ kind: 'image', path: '/DATA/a.jpg', stamp: 2 })
    expect(a).not.toBe(b)
  })
})

describe('parseRecord', () => {
  it('accepts the three valid shapes', () => {
    expect(parseRecord({ kind: 'none' })).toEqual(NONE)
    expect(parseRecord({ kind: 'builtin', id: 'w02' })).toEqual({ kind: 'builtin', id: 'w02' })
    expect(parseRecord({ kind: 'image', path: '/DATA/a.jpg', stamp: 7 }))
      .toEqual({ kind: 'image', path: '/DATA/a.jpg', stamp: 7 })
  })
  it('degrades every malformed value to none instead of throwing', () => {
    // Vue2's getWallpaperConfig had no catch and failed silently (spec section 7);
    // here every bad shape has one defined outcome.
    for (const bad of [
      null, undefined, 42, 'none', {}, { kind: 'nope' },
      { kind: 'builtin' }, { kind: 'builtin', id: 'w99' },
      { kind: 'image' }, { kind: 'image', path: '' },
      { kind: 'image', path: '/DATA/a.jpg' },
      { kind: 'image', path: '/DATA/a.jpg', stamp: 'x' },
    ]) {
      expect(parseRecord(bad), JSON.stringify(bad)).toEqual(NONE)
    }
  })
})

describe('applyWallpaper', () => {
  it('sets data-wallpaper and --wallpaper-img for a builtin', () => {
    applyWallpaper({ kind: 'builtin', id: 'w01' })
    expect(document.documentElement.dataset.wallpaper).toBe('')
    expect(document.documentElement.style.getPropertyValue('--wallpaper-img'))
      .toBe(`url("${builtinUrl('w01')}")`)
  })
  it('none removes both, so the CSS block stops matching entirely', () => {
    applyWallpaper({ kind: 'builtin', id: 'w01' })
    applyWallpaper(NONE)
    expect(document.documentElement.dataset.wallpaper).toBeUndefined()
    expect(document.documentElement.style.getPropertyValue('--wallpaper-img')).toBe('')
  })
})

describe('cacheRecord / initialWallpaper', () => {
  it('round-trips through localStorage', () => {
    cacheRecord({ kind: 'builtin', id: 'w02' })
    expect(initialWallpaper()).toEqual({ kind: 'builtin', id: 'w02' })
  })
  it('none clears the cache key rather than storing a none blob', () => {
    cacheRecord({ kind: 'builtin', id: 'w02' })
    cacheRecord(NONE)
    expect(localStorage.getItem(WALLPAPER_CACHE_KEY)).toBeNull()
  })
  it('missing or corrupt cache yields none and never throws', () => {
    expect(initialWallpaper()).toEqual(NONE)
    localStorage.setItem(WALLPAPER_CACHE_KEY, '{not json')
    expect(initialWallpaper()).toEqual(NONE)
    localStorage.setItem(WALLPAPER_CACHE_KEY, '"a string"')
    expect(initialWallpaper()).toEqual(NONE)
  })
})
