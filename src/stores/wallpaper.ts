import wallpaper01 from '../assets/wallpaper/wallpaper01.jpg'
import wallpaper02 from '../assets/wallpaper/wallpaper02.jpg'

export type BuiltinId = 'w01' | 'w02'

export type WallpaperRecord =
  | { kind: 'none' }
  | { kind: 'builtin'; id: BuiltinId }
  | { kind: 'image'; path: string; stamp: number }

export const BUILTIN_IDS = ['w01', 'w02'] as const satisfies readonly BuiltinId[]
export const NONE: WallpaperRecord = { kind: 'none' }

/** Server-side custom-storage key. Deliberately NOT Vue2's `wallpaper`: the two
 *  UIs keep independent wallpapers (owner decision 2026-08-07, spec section 2.3). */
export const WALLPAPER_CUSTOM_KEY = 'wallpaper_v3'
/** Backend image key in `/v1/users/current/image/:key`. Shared with Vue2 on purpose:
 *  it is only a filename on disk, and both UIs overwriting it is harmless. */
export const WALLPAPER_IMAGE_KEY = 'wallpaper'
/** Reuses the localStorage key session.clear() already wipes on logout
 *  (stores/session.ts:9 / :67) so no new state needs a teardown path. */
export const WALLPAPER_CACHE_KEY = 'wallpaper'
/** The backend caps `PUT image/:key` at 10 MB (user.go:904) but leaves the
 *  multipart POST unbounded. We cap both here so a 200 MB RAW cannot be stored
 *  as a wallpaper. Deliberate deviation from Vue2, see spec section 8 item 2. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const BUILTIN_URLS: Record<BuiltinId, string> = { w01: wallpaper01, w02: wallpaper02 }

export function builtinUrl(id: BuiltinId): string {
  return BUILTIN_URLS[id]
}

export function recordUrl(r: WallpaperRecord): string | null {
  if (r.kind === 'none') return null
  if (r.kind === 'builtin') return builtinUrl(r.id)
  return `/v1/users/image?path=${encodeURIComponent(r.path)}&t=${r.stamp}`
}

function isBuiltinId(v: unknown): v is BuiltinId {
  return typeof v === 'string' && (BUILTIN_IDS as readonly string[]).includes(v)
}

export function parseRecord(v: unknown): WallpaperRecord {
  if (!v || typeof v !== 'object') return NONE
  const o = v as Record<string, unknown>
  if (o.kind === 'none') return NONE
  if (o.kind === 'builtin' && isBuiltinId(o.id)) return { kind: 'builtin', id: o.id }
  if (
    o.kind === 'image' && typeof o.path === 'string' && o.path.length > 0
    && typeof o.stamp === 'number' && Number.isFinite(o.stamp)
  ) {
    return { kind: 'image', path: o.path, stamp: o.stamp }
  }
  return NONE
}

/** Writes <html data-wallpaper> + --wallpaper-img. The CSS block in theme.css
 *  keys off the attribute, so removing it restores the theme gradient exactly. */
export function applyWallpaper(r: WallpaperRecord): void {
  const el = document.documentElement
  const url = recordUrl(r)
  if (!url) {
    delete el.dataset.wallpaper
    el.style.removeProperty('--wallpaper-img')
    return
  }
  el.style.setProperty('--wallpaper-img', `url("${url}")`)
  el.dataset.wallpaper = ''
}

export function cacheRecord(r: WallpaperRecord): void {
  if (r.kind === 'none') localStorage.removeItem(WALLPAPER_CACHE_KEY)
  else localStorage.setItem(WALLPAPER_CACHE_KEY, JSON.stringify(r))
}

export function initialWallpaper(): WallpaperRecord {
  try {
    const raw = localStorage.getItem(WALLPAPER_CACHE_KEY)
    return raw ? parseRecord(JSON.parse(raw)) : NONE
  } catch {
    return NONE
  }
}
