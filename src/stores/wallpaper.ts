import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useThemeStore, type Theme } from './theme'
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

interface Snapshot { record: WallpaperRecord; theme: Theme }

export const useWallpaperStore = defineStore('wallpaper', () => {
  const record = ref<WallpaperRecord>(initialWallpaper())
  const dialogOpen = ref(false)
  const busy = ref(false)
  let snapshot: Snapshot | null = null
  // Bumped by every preview() so an in-flight load() can tell whether the user
  // acted while its read was pending. Store-scoped, not module-scoped: each
  // store instance (i.e. each Pinia app) tracks its own interaction history.
  let epoch = 0

  /** Live-apply without persisting: the dialog previews against the real desktop. */
  function preview(r: WallpaperRecord): void {
    epoch += 1
    record.value = r
    applyWallpaper(r)
  }

  /** Snapshot MUST include the theme: the "blue base" / "white base" presets switch
   *  the theme as well as clearing the wallpaper, so a record-only snapshot leaves
   *  the palette on one theme and the background on the other after Cancel. */
  function beginPreview(): void {
    snapshot = { record: record.value, theme: useThemeStore().theme }
  }

  function cancelPreview(): void {
    if (!snapshot) return
    preview(snapshot.record)
    // I2 (final review): this used to write snapshot.theme back through
    // useThemeStore().theme + applyTheme() directly, reasoning that going
    // through setTheme() would "rewrite localStorage with a value the user
    // never confirmed". That had it backwards: theme.previewTheme() (see
    // WallpaperDialog pickBase) is what actually applies a preset's theme
    // switch, and it is preview-only by construction (in-memory + DOM, no
    // localStorage write) -- so by the time Cancel runs here, localStorage
    // still holds the last *confirmed* theme, never the unconfirmed pick.
    // Restoring through previewTheme() (rather than poking the ref directly)
    // keeps this store from reaching into theme's internals.
    useThemeStore().previewTheme(snapshot.theme)
    snapshot = null
  }

  async function commit(): Promise<void> {
    // Capture once: if the user previews something else while this await is in
    // flight, record.value moves on, but the save (and the cache) must stay
    // consistent with the value that was actually sent to the server.
    const toSave = record.value
    await service.users.setCustomStorage(WALLPAPER_CUSTOM_KEY, toSave)
    cacheRecord(toSave)
    // I2 follow-up (final review round 2): this function used to also call
    // themeStore.setTheme(themeStore.theme) here, reasoning that commit() was
    // "the one point every caller shares". That reasoning broke on a caller
    // this store already has: setFromNasPath() calls commit() as a one-shot
    // (files-area context menu with NO dialog at all, and also reachable
    // *inside* an open WallpaperDialog session via onNasPick -- pick a base
    // preset, which now only previews via theme.previewTheme(), then change
    // your mind and choose "from NAS" instead). Neither caller ever asked to
    // confirm a theme; commit() confirming one anyway silently persisted
    // whatever theme happened to be live, undercutting the exact "preview,
    // Apply confirms" invariant I2 exists to protect. commit() is now back to
    // being purely about the wallpaper record. Confirming a previewed theme
    // is WallpaperDialog's apply()'s job (see pickBase's comment) -- it is the
    // only caller that ever offers a theme preview to confirm in the first
    // place.
    snapshot = null
  }

  async function load(): Promise<void> {
    const startEpoch = epoch
    try {
      const raw = await service.users.getCustomStorage(WALLPAPER_CUSTOM_KEY)
      // If the user previewed something while this read was in flight, their
      // choice wins over the slower server read: don't apply, don't cache.
      if (epoch !== startEpoch) return
      // An unset key comes back as '' from the backend, which parseRecord maps to none.
      preview(parseRecord(raw))
      cacheRecord(record.value)
    } catch {
      // Never let a cold-start read failure blank the screen: keep whatever the
      // cache already applied. Vue2 swallowed this silently with no catch at all.
    }
  }

  async function uploadAndPreview(file: File): Promise<void> {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(`Wallpaper file is too large (max ${MAX_UPLOAD_BYTES} bytes)`)
    }
    busy.value = true
    try {
      const res = await service.users.uploadImage(WALLPAPER_IMAGE_KEY, file)
      preview({ kind: 'image', path: res.path, stamp: Date.now() })
    } finally {
      busy.value = false
    }
  }

  /** Files context menu: one shot, persists straight away (no dialog to confirm in). */
  async function setFromNasPath(path: string): Promise<void> {
    busy.value = true
    try {
      const res = await service.users.setImageFromPath(WALLPAPER_IMAGE_KEY, path)
      preview({ kind: 'image', path: res.path, stamp: Date.now() })
      await commit()
    } finally {
      busy.value = false
    }
  }

  function openDialog(): void {
    // M7 (final review): a second entry point opening an already-open sheet must
    // not re-snapshot -- that would make the rollback target the current
    // unconfirmed preview instead of the value the user actually confirmed last.
    if (!dialogOpen.value) beginPreview()
    dialogOpen.value = true
  }
  function closeDialog(): void { dialogOpen.value = false }

  /** I1 (final review): logout must not leave the previous user's photo painted
   *  through the login screen. GET /v1/users/image is unauthenticated by
   *  backend design, so nothing server-side stops it rendering; session.clear()
   *  only drops localStorage keys, it never touches <html data-wallpaper> or
   *  --wallpaper-img. Called from App.vue's watcher on the authed->false
   *  transition. cacheRecord(NONE) duplicates what session.clear() already does
   *  to the shared 'wallpaper' key (see WALLPAPER_CACHE_KEY above), so this
   *  store stays correct even if it is ever called from somewhere other than
   *  that exact logout path. */
  function reset(): void {
    dialogOpen.value = false
    snapshot = null
    preview(NONE)
    cacheRecord(NONE)
  }

  return {
    record, dialogOpen, busy,
    preview, beginPreview, cancelPreview, commit, load,
    uploadAndPreview, setFromNasPath, openDialog, closeDialog, reset,
  }
})
