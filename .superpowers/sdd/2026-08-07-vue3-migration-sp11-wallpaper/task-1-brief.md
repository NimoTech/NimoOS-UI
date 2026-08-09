### Task 1: 壁纸 store 核心(纯逻辑 + 内置图资源)

**Files:**
- Create: `src/assets/wallpaper/wallpaper01.jpg`(从 `../NimoOS-UI/src/assets/background/wallpaper01.jpg` 原样拷贝,2.2MB)
- Create: `src/assets/wallpaper/wallpaper02.jpg`(从 `../NimoOS-UI/src/assets/background/wallpaper02.jpg` 原样拷贝,848KB)
- Create: `src/stores/wallpaper.ts`
- Test: `src/stores/wallpaper.test.ts`

**Interfaces:**
- Consumes: 无(本任务是根)
- Produces:
  ```ts
  export type BuiltinId = 'w01' | 'w02'
  export type WallpaperRecord =
    | { kind: 'none' }
    | { kind: 'builtin'; id: BuiltinId }
    | { kind: 'image'; path: string; stamp: number }
  export const BUILTIN_IDS: readonly BuiltinId[]        // ['w01','w02']
  export const NONE: WallpaperRecord                    // { kind: 'none' }
  export const WALLPAPER_CUSTOM_KEY: string             // 'wallpaper_v3'
  export const WALLPAPER_IMAGE_KEY: string              // 'wallpaper'
  export const WALLPAPER_CACHE_KEY: string              // 'wallpaper'
  export const MAX_UPLOAD_BYTES: number                 // 10485760
  export function builtinUrl(id: BuiltinId): string
  export function recordUrl(r: WallpaperRecord): string | null
  export function parseRecord(v: unknown): WallpaperRecord
  export function applyWallpaper(r: WallpaperRecord): void
  export function initialWallpaper(): WallpaperRecord
  export function cacheRecord(r: WallpaperRecord): void
  ```

- [ ] **Step 1: 拷内置图资源**

```bash
mkdir -p src/assets/wallpaper
cp ../NimoOS-UI/src/assets/background/wallpaper01.jpg src/assets/wallpaper/wallpaper01.jpg
cp ../NimoOS-UI/src/assets/background/wallpaper02.jpg src/assets/wallpaper/wallpaper02.jpg
ls -l src/assets/wallpaper/
```
Expected: 两个文件,约 2.2M 与 848K。**原样拷贝,不转码不压缩**(用户 2026-08-07 拍板,代价已在 spec §4.6 声明)。

- [ ] **Step 2: 写失败测试 `src/stores/wallpaper.test.ts`**

```ts
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
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm vitest run src/stores/wallpaper.test.ts`
Expected: FAIL —— `Failed to resolve import "./wallpaper"`。

- [ ] **Step 4: 写实现 `src/stores/wallpaper.ts`**

```ts
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
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm vitest run src/stores/wallpaper.test.ts`
Expected: PASS,全部用例绿。

- [ ] **Step 6: Commit**

```bash
git add src/assets/wallpaper src/stores/wallpaper.ts src/stores/wallpaper.test.ts
git commit -o src/assets/wallpaper src/stores/wallpaper.ts src/stores/wallpaper.test.ts -m "feat(wallpaper): add record model, url derivation and dom application

Builtin wallpapers store a stable id rather than a build-hashed URL so a
redeploy cannot break an existing selection, and image records carry a stamp
because the backend overwrites one fixed filename per user.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

