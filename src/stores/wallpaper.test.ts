import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { vi } from 'vitest'
import {
  BUILTIN_IDS, MAX_UPLOAD_BYTES, NONE, WALLPAPER_CACHE_KEY, WALLPAPER_CUSTOM_KEY,
  applyWallpaper, builtinUrl, cacheRecord, initialWallpaper, parseRecord, recordUrl,
  useWallpaperStore,
} from './wallpaper'
import { useThemeStore } from './theme'

// Vitest 4 dropped the two-argument `vi.fn<[Args], Return>()` generic form used
// in the plan; the single function-type form below is what actually type-checks.
const getCustomStorage = vi.fn<(key: string) => Promise<unknown>>()
const setCustomStorage = vi.fn<(key: string, data: unknown) => Promise<unknown>>()
const uploadImage = vi.fn()
const setImageFromPath = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: (...a: unknown[]) => getCustomStorage(...(a as [string])),
      setCustomStorage: (...a: unknown[]) => setCustomStorage(...(a as [string, unknown])),
      uploadImage: (...a: unknown[]) => uploadImage(...a),
      setImageFromPath: (...a: unknown[]) => setImageFromPath(...a),
    },
  },
}))

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

describe('wallpaper store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    delete document.documentElement.dataset.wallpaper
    delete document.documentElement.dataset.theme
    getCustomStorage.mockReset()
    setCustomStorage.mockReset().mockResolvedValue(undefined)
    uploadImage.mockReset()
    setImageFromPath.mockReset()
  })

  it('load reads wallpaper_v3 and applies it', async () => {
    getCustomStorage.mockResolvedValue({ kind: 'builtin', id: 'w02' })
    const s = useWallpaperStore()
    await s.load()
    expect(getCustomStorage).toHaveBeenCalledWith('wallpaper_v3')
    expect(s.record).toEqual({ kind: 'builtin', id: 'w02' })
    expect(document.documentElement.dataset.wallpaper).toBe('')
  })

  it('load degrades a rejected read to none without throwing', async () => {
    // Vue2's getWallpaperConfig had no catch at all (Home.vue:208-217).
    getCustomStorage.mockRejectedValue(new Error('offline'))
    const s = useWallpaperStore()
    await expect(s.load()).resolves.toBeUndefined()
    expect(s.record).toEqual(NONE)
  })

  it('load treats the empty-string blob the backend returns for an unset key as none', async () => {
    getCustomStorage.mockResolvedValue('')
    const s = useWallpaperStore()
    await s.load()
    expect(s.record).toEqual(NONE)
  })

  it('preview applies live but writes neither cache nor server', () => {
    const s = useWallpaperStore()
    s.preview({ kind: 'builtin', id: 'w01' })
    expect(document.documentElement.dataset.wallpaper).toBe('')
    expect(localStorage.getItem(WALLPAPER_CACHE_KEY)).toBeNull()
    expect(setCustomStorage).not.toHaveBeenCalled()
  })

  it('cancelPreview rolls back BOTH the record and the theme', () => {
    // Picking "white base" previews a theme switch as well as clearing the
    // wallpaper. Snapshotting only the record leaves the palette on light while
    // the background returns to blue -- the mismatch this test exists to pin.
    const theme = useThemeStore()
    const s = useWallpaperStore()

    // Starting point the user would be rolled back to: blue theme + builtin w01.
    theme.setTheme('blue')
    s.preview({ kind: 'builtin', id: 'w01' })

    s.beginPreview()
    s.preview(NONE)
    theme.setTheme('light')

    s.cancelPreview()
    expect(s.record).toEqual({ kind: 'builtin', id: 'w01' })
    expect(theme.theme).toBe('blue')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(document.documentElement.dataset.wallpaper).toBe('')
  })

  it('commit persists to wallpaper_v3 and caches locally', async () => {
    const s = useWallpaperStore()
    s.preview({ kind: 'builtin', id: 'w02' })
    await s.commit()
    expect(setCustomStorage).toHaveBeenCalledWith('wallpaper_v3', { kind: 'builtin', id: 'w02' })
    expect(JSON.parse(localStorage.getItem(WALLPAPER_CACHE_KEY) as string))
      .toEqual({ kind: 'builtin', id: 'w02' })
  })

  it('commit propagates a failed save so the dialog can stay open', async () => {
    setCustomStorage.mockRejectedValue(new Error('save failed'))
    const s = useWallpaperStore()
    s.preview({ kind: 'builtin', id: 'w02' })
    await expect(s.commit()).rejects.toThrow('save failed')
  })

  it('uploadAndPreview rejects an oversized file before touching the network', async () => {
    // The backend POST has no size limit of its own (spec section 8 item 2).
    const s = useWallpaperStore()
    const big = new File([new Uint8Array(1)], 'big.jpg')
    Object.defineProperty(big, 'size', { value: MAX_UPLOAD_BYTES + 1 })
    await expect(s.uploadAndPreview(big)).rejects.toThrow('too large')
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('uploadAndPreview stamps the record so the browser refetches the overwritten file', async () => {
    uploadImage.mockResolvedValue({ path: '/d/1/wallpaper.jpg', file_name: 'wallpaper.jpg', online_path: 'x' })
    const s = useWallpaperStore()
    const before = Date.now()
    const small = new File([new Uint8Array([1])], 'a.jpg')
    await s.uploadAndPreview(small)
    expect(uploadImage).toHaveBeenCalledWith('wallpaper', small)
    expect(s.record.kind).toBe('image')
    const r = s.record as { kind: 'image'; path: string; stamp: number }
    expect(r.path).toBe('/d/1/wallpaper.jpg')
    expect(r.stamp).toBeGreaterThanOrEqual(before)
    expect(setCustomStorage).not.toHaveBeenCalled()   // preview only
  })

  it('setFromNasPath goes through PUT and persists immediately (files context menu)', async () => {
    setImageFromPath.mockResolvedValue({ path: '/d/1/wallpaper.png', file_name: 'wallpaper.png', online_path: 'x' })
    const s = useWallpaperStore()
    await s.setFromNasPath('/DATA/Gallery/a.png')
    expect(setImageFromPath).toHaveBeenCalledWith('wallpaper', '/DATA/Gallery/a.png')
    expect(setCustomStorage).toHaveBeenCalledWith('wallpaper_v3', expect.objectContaining({ kind: 'image', path: '/d/1/wallpaper.png' }))
  })

  it('setFromNasPath propagates the backend rejection (e.g. image too large)', async () => {
    setImageFromPath.mockRejectedValue(new Error('Image too large'))
    const s = useWallpaperStore()
    await expect(s.setFromNasPath('/DATA/huge.jpg')).rejects.toThrow('Image too large')
    expect(setCustomStorage).not.toHaveBeenCalled()
  })

  it('openDialog snapshots, closeDialog does not roll back', () => {
    const s = useWallpaperStore()
    s.openDialog()
    expect(s.dialogOpen).toBe(true)
    s.closeDialog()
    expect(s.dialogOpen).toBe(false)
  })
})
