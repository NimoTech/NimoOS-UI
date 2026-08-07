# SP11 壁纸 —— 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 New-UI 加壁纸系统 —— 四个入口(顶栏 / 设置页 / 桌面右键 / 文件区右键)、四个预设(蓝色底板 / 白色底板 / 内置图 ×2)、上传与从 NAS 选图,收掉审计 X3 = 设置区 D5。

**Architecture:** 壁纸是 `<html>` 上多出的一层 `background` 图,`--app-bg` 垫在图下面当 404 兜底;`body` 在有壁纸时置透明、关掉散景光斑、把 `body::after` 换成随主题的 scrim。状态在应用级 Pinia store,服务端存 `custom/wallpaper_v3`(与 Vue2 的 `custom/wallpaper` 完全隔离),本地缓存复用已有的 `localStorage.wallpaper`。弹窗是挂在 `App.vue` 的应用级单例,无遮罩、底部贴边,选中即真换背景(未落盘),取消回滚。

**Tech Stack:** Vue 3 + TypeScript + Pinia + vue-i18n + reka-ui + vitest/@vue/test-utils + 仓内共享包 `packages/service`(axios)

**依据 spec:** `docs/superpowers/specs/2026-08-07-vue3-migration-sp11-wallpaper-design.md`(commit `7112401`)。**每个任务开工前先读 spec 对应小节。**

## Global Constraints

- **中文注释禁令**:代码注释、日志、测试断言消息**一律英文**(顶层 `CLAUDE.md` 语言规则)。**commit message 也一律英文**。台账/spec/本计划保持中文。
- **颜色一律走 token**:`color-guard.test.ts` 扫所有 `.vue` 的 `<style>` 与 `.css`,裸 `#hex`/`rgb()`/`rgba()`/`hsl()` 即失败。唯一例外是 `src/styles/theme.css`(token 定义处,被守卫显式排除)。新增颜色**只能**落 theme.css 的两个主题块。
- **测试里读 `.css` 一律用 `node:fs`** —— `import.meta.glob(..., {as:'raw'})` 对 `.css` 在 vitest 下恒为空串,曾让守卫整半边空转。`.vue` 的 `?raw` 正常。
- **新增 i18n 键落 `src/i18n/zh_cn.base.ts` + `src/i18n/en_us.base.ts` 两份**,不新建分片 —— `src/i18n/__tests__/shardDisjoint.test.ts` 把「4 片」写死了,加第 5 片要同时改守卫和 `index.ts`,不值得。`i18n/parity.test.ts` 会强制 en↔zh 键集一致,漏一边当场变红。
- **界面照 Vue2 1:1、逻辑照正确** —— Vue2 的 bug/死代码不照抄,每处在代码里留英文注释登记(清单见 spec §7)。
- **本工作树永不 `checkout`/`stash`**,`git commit` **必须带 pathspec** —— 工作树里常驻 3 个 `design-export/*.html` 的 staged 删除,裸 commit 会把它们一起提交。
- **服务端 custom storage key 固定 `wallpaper_v3`**;图片 key 固定 `wallpaper`(后端 `image/:key` 的那个 key)。
- **上传前端上限 10 MB**(`MAX_UPLOAD_BYTES`)。
- 每个任务收尾跑 `pnpm vitest run <本任务测试文件>`;T11 跑全量门。

---

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

### Task 2: CSS 图层 + scrim token + 冷启动接线 + 位置守卫

**Files:**
- Modify: `src/styles/theme.css`(深色块 `:root` 内加 1 个 token · 浅色块 `:root[data-theme="light"]` 内加 1 个 token · 文件**末尾**加壁纸规则块)
- Modify: `src/main.ts:43`(在 `applyTheme(initialTheme())` 之后加一行)
- Test: `src/styles/wallpaper.css.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `applyWallpaper`、`initialWallpaper`
- Produces: CSS 契约 —— `:root[data-wallpaper]` 生效、`--wallpaper-scrim` 两套主题都有值

- [ ] **Step 1: 写失败测试 `src/styles/wallpaper.css.test.ts`**

```ts
// Reads theme.css with node:fs on purpose: `?raw` / import.meta.glob resolve to
// an empty string for .css under vitest, which once made a whole guard no-op.
/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const CSS = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'theme.css'),
  'utf8',
)

describe('wallpaper layer', () => {
  it('paints the image on <html> with --app-bg underneath as the 404 fallback', () => {
    const rule = /:root\[data-wallpaper\]\s*\{[^}]*\}/.exec(CSS)?.[0]
    expect(rule, ':root[data-wallpaper] block must exist').toBeTruthy()
    expect(rule).toContain('var(--wallpaper-img)')
    // --app-bg must be the LAST layer: in the light theme it is a bare colour
    // (#f7f5ef), and a colour is only legal in the final background layer.
    expect(rule).toMatch(/var\(--wallpaper-img\)[\s\S]*var\(--app-bg\)/)
    // background-image would be invalid in the light theme; the shorthand is required.
    expect(rule).not.toMatch(/background-image\s*:/)
  })

  it('makes body transparent so the html layer shows through', () => {
    expect(CSS).toMatch(/:root\[data-wallpaper\]\s+body\s*\{[^}]*background\s*:\s*transparent/)
  })

  it('kills the bokeh layer, which would smear coloured fog over a photo', () => {
    expect(CSS).toMatch(/:root\[data-wallpaper\]\s+body::before\s*\{[^}]*display\s*:\s*none/)
  })
})

describe('scrim', () => {
  it('body::after becomes the scrim', () => {
    expect(CSS).toMatch(
      /:root\[data-wallpaper\]\s+body::after\s*\{[^}]*background\s*:\s*var\(--wallpaper-scrim\)/,
    )
  })

  it('the scrim rule is ordered AFTER the light theme zeroes body::after', () => {
    // Both selectors have specificity (0,2,1), so source order decides. Placed
    // earlier, the light theme's `background: none` wins and near-black paper-theme
    // text loses its white veil over a dark photo -- invisible to tsc, build,
    // color-guard and jsdom alike, hence a positional assertion.
    const lightKill = CSS.indexOf(':root[data-theme="light"] body::after')
    const scrim = CSS.indexOf(':root[data-wallpaper] body::after')
    expect(lightKill).toBeGreaterThan(-1)
    expect(scrim).toBeGreaterThan(lightKill)
  })

  it('--wallpaper-scrim is defined in both themes', () => {
    // Scoped by theme block: a token defined only in one block reads as "present"
    // to a naive count while one theme silently falls back to nothing.
    const lightBlockStart = CSS.indexOf(':root[data-theme="light"] {')
    expect(lightBlockStart).toBeGreaterThan(-1)
    const defs = [...CSS.matchAll(/--wallpaper-scrim\s*:/g)].map((m) => m.index as number)
    expect(defs.filter((i) => i < lightBlockStart).length, 'dark theme').toBeGreaterThanOrEqual(1)
    expect(defs.filter((i) => i > lightBlockStart).length, 'light theme').toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/styles/wallpaper.css.test.ts`
Expected: FAIL —— 第一条即报 `:root[data-wallpaper] block must exist`。

- [ ] **Step 3: 深色块加 token** —— 在 `src/styles/theme.css` 的 `--app-bg:` 多行定义之后(约 `:301` 那个 `linear-gradient(180deg, #2a3354 ...)` 行的下一行)插入:

```css
  /* SP11: overlay for body::after when a wallpaper is on. Dark theme keeps the
     existing sheen + vignette shape so white text stays readable on any photo. */
  --wallpaper-scrim:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 20%),
    radial-gradient(130% 90% at 50% 118%, rgba(0, 0, 0, 0.5), transparent 58%);
```

- [ ] **Step 4: 浅色块加 token** —— 在 `:root[data-theme="light"]` 块内 `--app-bg: #f7f5ef;` 那行之后插入:

```css
  /* SP11: the paper theme's text is near-black (#1c1b19); over a dark photo it
     disappears. A white veil, not a dark vignette, is what keeps it legible.
     This is a readability floor, not polish. */
  --wallpaper-scrim: linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.55));
```

- [ ] **Step 5: 文件末尾加壁纸规则块** —— 追加到 `src/styles/theme.css` **最末**(必须晚于 `:522-523` 那条浅色主题的 `body::before, body::after { background: none }`,理由见测试注释):

```css
/* ══ SP11 wallpaper layer ══════════════════════════════════════════════════
   Painted on <html>, not on a self-drawn element: the html background is always
   the bottom-most paint (no z-index reasoning against body's pseudo-elements),
   and listing --app-bg as the final background layer means a 404 image simply
   is not painted and the theme gradient shows through -- a free fallback that
   needs no JS onerror handler.
   The shorthand (not background-image) is mandatory: --app-bg is a bare colour
   in the light theme, and a colour is only legal in the last layer.
   MUST stay after the light-theme `body::after { background: none }` rule above
   -- equal specificity, source order decides. See styles/wallpaper.css.test.ts. */
:root[data-wallpaper] {
  background: var(--wallpaper-img) center / cover no-repeat, var(--app-bg);
}
:root[data-wallpaper] body { background: transparent; }
:root[data-wallpaper] body::before { display: none; }
:root[data-wallpaper] body::after { background: var(--wallpaper-scrim); }
```

- [ ] **Step 6: 接线冷启动** —— `src/main.ts`,把 import 与调用各加一行:

```ts
// 与已有的 applyTheme import 并列
import { applyWallpaper, initialWallpaper } from './stores/wallpaper'
```
```ts
// 冷启动:mount 前先把 data-theme 贴到 <html>,避免先渲染默认蓝再跳白的闪烁。
applyTheme(initialTheme())
// Same reason for the wallpaper: without this the first paint is the gradient
// and the photo snaps in a frame later.
applyWallpaper(initialWallpaper())
app.mount('#app')
```

- [ ] **Step 7: 跑测试确认通过 + 类型门**

Run: `pnpm vitest run src/styles/wallpaper.css.test.ts src/styles/color-guard.test.ts && pnpm vue-tsc --noEmit`
Expected: 两个测试文件全绿(color-guard 必须一起跑 —— theme.css 虽被排除,但要确认没顺手把裸色写进别处),`vue-tsc` exit 0。

- [ ] **Step 8: 变异验证(必做,证明位置守卫不是空转)**

把 Step 5 那个规则块**临时**剪到 `theme.css` 的 `:522` 之前,重跑 `pnpm vitest run src/styles/wallpaper.css.test.ts`。
Expected: 「the scrim rule is ordered AFTER…」这一条**必须变红**。确认后把块移回文件末尾并重跑至全绿。

- [ ] **Step 9: Commit**

```bash
git add src/styles/theme.css src/styles/wallpaper.css.test.ts src/main.ts
git commit -o src/styles/theme.css src/styles/wallpaper.css.test.ts src/main.ts -m "feat(wallpaper): paint the wallpaper layer on <html> and apply it before mount

The image is listed above --app-bg in one background shorthand, so a broken
image URL falls through to the theme gradient with no JS fallback path. The
scrim rule must follow the light theme's body::after reset -- equal specificity
means source order decides, and getting it wrong hides paper-theme text over a
dark photo without tripping tsc, build, color-guard or jsdom. A positional
guard pins the ordering.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 共享包补 `uploadImage` / `setImageFromPath`

**Files:**
- Modify: `packages/service/src/users.ts`(加 2 个方法;改写文件末尾那条「不进包」注释)
- Test: `packages/service/src/users.test.ts`(追加 describe 块)

**Interfaces:**
- Consumes: 无
- Produces:
  ```ts
  interface UserImageResult { path: string; file_name: string; online_path: string }
  service.users.uploadImage(key: string, file: File): Promise<UserImageResult>
  service.users.setImageFromPath(key: string, path: string): Promise<UserImageResult>
  ```

- [ ] **Step 1: 写失败测试** —— 追加到 `packages/service/src/users.test.ts` 末尾(照该文件既有的 axios mock 写法):

```ts
describe('user image (SP11 wallpaper)', () => {
  it('uploadImage posts multipart with the file under `file`', async () => {
    const calls: { url: string; body: unknown }[] = []
    const http = {
      post: async (url: string, body: unknown) => {
        calls.push({ url, body })
        return { data: { success: 200, message: 'ok', data: { path: '/d/1/wallpaper.jpg', file_name: 'wallpaper.jpg', online_path: '/v1/users/image?path=/d/1/wallpaper.jpg' } } }
      },
    }
    const users = createUsers(http as never)
    const file = new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' })
    const res = await users.uploadImage('wallpaper', file)

    expect(calls[0].url).toBe('/users/current/image/wallpaper')
    expect(calls[0].body).toBeInstanceOf(FormData)
    expect((calls[0].body as FormData).get('file')).toBe(file)
    expect(res.online_path).toContain('/v1/users/image?path=')
  })

  it('setImageFromPath puts the nas path as json', async () => {
    const calls: { url: string; body: unknown }[] = []
    const http = {
      put: async (url: string, body: unknown) => {
        calls.push({ url, body })
        return { data: { success: 200, message: 'ok', data: { path: '/d/1/wallpaper.png', file_name: 'wallpaper.png', online_path: '/v1/users/image?path=/d/1/wallpaper.png' } } }
      },
    }
    const users = createUsers(http as never)
    await users.setImageFromPath('wallpaper', '/DATA/Gallery/a.png')

    expect(calls[0].url).toBe('/users/current/image/wallpaper')
    expect(calls[0].body).toEqual({ path: '/DATA/Gallery/a.png' })
  })

  it.each([
    [60001, 'File does not exist'],
    [10017, 'Not an image'],
    [10018, 'Image too large'],
  ])('setImageFromPath rejects on success=%i even though the status is 200', async (code, msg) => {
    // PutUserImage returns http.StatusOK for every failure (user.go:880-916), so a
    // caller reading res.data directly would treat "image too large" as success.
    const http = { put: async () => ({ data: { success: code, message: msg, data: null } }) }
    const users = createUsers(http as never)
    await expect(users.setImageFromPath('wallpaper', '/DATA/huge.jpg')).rejects.toThrow(msg)
  })
})
```

> 说明:三个错误码的**数值**照 `NimoOS-Common` 的 `common_err` 常量填。开工时用
> `grep -rn "FILE_DOES_NOT_EXIST\|NOT_IMAGE\|IMAGE_TOO_LARGE" ../NimoOS-Common/model/common_err/` 取真实值替换上面的占位数字;测试断言的是 `message`,数值只是让 `it.each` 三行有区分度,取错不影响断言成立,但**仍要填真值**。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run packages/service/src/users.test.ts`
Expected: FAIL —— `users.uploadImage is not a function`。

- [ ] **Step 3: 写实现** —— `packages/service/src/users.ts`,在 `revokeMemberFolder` 之后插入:

```ts
    // ── SP11 wallpaper: user image endpoints ────────────────────────────────
    // These two were explicitly kept out of the package during SP9-P4 ("not part
    // of the account tab"); SP11 is the consumer that pays that debt off.

    /** POST /v1/users/current/image/{key} -- multipart upload.
     *  Standard envelope. Writes to {UserDataPath}/{userId}/{key}{ext}, so it
     *  ALWAYS overwrites one fixed filename per user: the URL never changes and
     *  callers must add their own cache-busting stamp.
     *  WARNING the backend enforces NO size limit here (user.go:928-961 has no
     *  size check, unlike the PUT below) -- callers must cap it themselves. */
    async uploadImage(key: string, file: File): Promise<UserImageResult> {
      const form = new FormData()
      form.append('file', file)
      const res = await http.post(`/users/current/image/${key}`, form)
      return unwrap<UserImageResult>(res.data)
    },

    /** PUT /v1/users/current/image/{key} -- copy an existing on-disk file into
     *  the user's image slot. body is { path }.
     *  Same fixed-filename overwrite as uploadImage.
     *  WARNING every failure returns HTTP 200 with success != 200
     *  (user.go:888/891/896/905): FILE_DOES_NOT_EXIST, NOT_IMAGE and
     *  IMAGE_TOO_LARGE (hard 10 MB cap at user.go:904). unwrap turns those into
     *  thrown errors -- never read res.data directly here. */
    async setImageFromPath(key: string, path: string): Promise<UserImageResult> {
      const res = await http.put(`/users/current/image/${key}`, { path })
      return unwrap<UserImageResult>(res.data)
    },
```

在 `packages/service/src/types.ts` 加类型:

```ts
/** Result of POST/PUT /v1/users/current/image/{key}. */
export interface UserImageResult { path: string; file_name: string; online_path: string }
```

并在 `users.ts` 顶部的 type import 列表里加上 `UserImageResult`。

- [ ] **Step 4: 改写文件末尾那条过期注释** —— `packages/service/src/users.ts` 最后那段:

```ts
    // Kept out of the package: deleteAllUser() (DELETE /users -- the nuclear
    // button, zero call sites in Vue2's AccountPanel) and deleteUserImage()
    // (no consumer in either UI).
    // uploadImage / setImageFromPath used to sit on this list as "not part of the
    // account tab"; SP11's wallpaper picker is their consumer, so they moved in.
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm vitest run packages/service/src/users.test.ts && pnpm vue-tsc --noEmit`
Expected: PASS + exit 0。

- [ ] **Step 6: Commit**

```bash
git add packages/service/src/users.ts packages/service/src/users.test.ts packages/service/src/types.ts
git commit -o packages/service/src/users.ts packages/service/src/users.test.ts packages/service/src/types.ts -m "feat(service): add user image upload and set-from-path

Both endpoints overwrite one fixed filename per user, so the URL is stable and
callers need their own cache-busting stamp. The PUT reports every failure as
HTTP 200 with a non-200 success field, including its hard 10 MB cap, so both go
through unwrap rather than reading the body directly.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: store 的服务端读写 + 预览/回滚

**Files:**
- Modify: `src/stores/wallpaper.ts`(加 Pinia store)
- Modify: `src/stores/wallpaper.test.ts`(追加 store 的 describe 块)

**Interfaces:**
- Consumes: Task 1 全部导出;Task 3 的 `service.users.uploadImage` / `setImageFromPath`
- Produces:
  ```ts
  export const useWallpaperStore: StoreDefinition  // id 'wallpaper'
  // state:   record: Ref<WallpaperRecord>   dialogOpen: Ref<boolean>   busy: Ref<boolean>
  // actions:
  //   openDialog(): void            // 顺带 beginPreview()
  //   closeDialog(): void
  //   preview(r: WallpaperRecord): void          // 只本地应用,不写缓存不落服务端
  //   beginPreview(): void                       // 快照 { record, theme }
  //   cancelPreview(): void                      // 连主题一起回滚
  //   commit(): Promise<void>                    // 落服务端 + 写缓存
  //   load(): Promise<void>
  //   setFromNasPath(path: string): Promise<void>   // PUT + 落服务端(文件区右键用)
  //   uploadAndPreview(file: File): Promise<void>   // 上传 + preview,不落服务端
  ```

- [ ] **Step 1: 写失败测试** —— 追加到 `src/stores/wallpaper.test.ts`:

```ts
import { setActivePinia, createPinia } from 'pinia'
import { vi } from 'vitest'
import { useWallpaperStore } from './wallpaper'
import { useThemeStore } from './theme'

const getCustomStorage = vi.fn<[string], Promise<unknown>>()
const setCustomStorage = vi.fn<[string, unknown], Promise<unknown>>()
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/stores/wallpaper.test.ts`
Expected: FAIL —— `useWallpaperStore is not exported`。

- [ ] **Step 3: 写实现** —— 追加到 `src/stores/wallpaper.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useThemeStore, applyTheme, type Theme } from './theme'

interface Snapshot { record: WallpaperRecord; theme: Theme }

export const useWallpaperStore = defineStore('wallpaper', () => {
  const record = ref<WallpaperRecord>(initialWallpaper())
  const dialogOpen = ref(false)
  const busy = ref(false)
  let snapshot: Snapshot | null = null

  /** Live-apply without persisting: the dialog previews against the real desktop. */
  function preview(r: WallpaperRecord): void {
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
    // applyTheme directly rather than setTheme: rolling back must not rewrite
    // localStorage with a value the user never confirmed.
    useThemeStore().theme = snapshot.theme
    applyTheme(snapshot.theme)
    snapshot = null
  }

  async function commit(): Promise<void> {
    await service.users.setCustomStorage(WALLPAPER_CUSTOM_KEY, record.value)
    cacheRecord(record.value)
    snapshot = null
  }

  async function load(): Promise<void> {
    try {
      const raw = await service.users.getCustomStorage(WALLPAPER_CUSTOM_KEY)
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

  function openDialog(): void { beginPreview(); dialogOpen.value = true }
  function closeDialog(): void { dialogOpen.value = false }

  return {
    record, dialogOpen, busy,
    preview, beginPreview, cancelPreview, commit, load,
    uploadAndPreview, setFromNasPath, openDialog, closeDialog,
  }
})
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/stores/wallpaper.test.ts && pnpm vue-tsc --noEmit`
Expected: PASS + exit 0。

- [ ] **Step 5: 变异验证(证明回滚快照那条不是空转)**

把 `beginPreview` 临时改成只存 record(`snapshot = { record: record.value, theme: 'blue' }`),重跑测试。
Expected: 「cancelPreview rolls back BOTH…」**必须变红**。改回后重跑至全绿。

- [ ] **Step 6: Commit**

```bash
git add src/stores/wallpaper.ts src/stores/wallpaper.test.ts
git commit -o src/stores/wallpaper.ts src/stores/wallpaper.test.ts -m "feat(wallpaper): add server persistence, live preview and rollback

The rollback snapshot carries the theme as well as the record because the base
presets switch the theme too; a record-only snapshot would leave the palette
and the background on different choices after Cancel. Cold-start read failures
keep whatever the local cache already painted instead of blanking the screen.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 弹窗骨架 —— 四个预设 + 实时预览 + 取消/应用

**Files:**
- Create: `src/components/WallpaperDialog.vue`
- Create: `src/components/WallpaperDialog.test.ts`
- Modify: `src/i18n/zh_cn.base.ts` · `src/i18n/en_us.base.ts`(加键)

**Interfaces:**
- Consumes: Task 4 的 store 全部 action;`useThemeStore().setTheme`
- Produces: `WallpaperDialog.vue` 默认导出;DOM 契约 `[data-test="wp-preset-blue|light|w01|w02"]`、`[data-test="wp-apply"]`、`[data-test="wp-cancel"]`、`[data-test="wp-error"]`

**新增 i18n 键(zh / en 各一份,键名相同):**

| 键 | zh_cn | en_us |
|---|---|---|
| `wpTitle` | 更换壁纸 | Change wallpaper |
| `wpPresetBlue` | 蓝色底板 | Blue base |
| `wpPresetLight` | 白色底板 | White base |
| `wpBuiltin1` | 内置壁纸 1 | Built-in 1 |
| `wpBuiltin2` | 内置壁纸 2 | Built-in 2 |
| `wpUpload` | 上传图片 | Upload image |
| `wpFromNas` | 从 NAS 选择 | Choose from NAS |
| `wpApply` | 应用 | Apply |
| `wpCancel` | 取消 | Cancel |
| `wpSaveFailed` | 保存失败,请重试 | Save failed, please try again |
| `wpTooLarge` | 图片不能超过 10 MB | Image must be 10 MB or smaller |
| `wpUploadFailed` | 上传失败,请重试 | Upload failed, please try again |
| `wpSetOk` | 已设为壁纸 | Wallpaper updated |
| `themePhoto` | 照片… | Photo… |

- [ ] **Step 1: 加 i18n 键** —— 往 `src/i18n/zh_cn.base.ts` 与 `src/i18n/en_us.base.ts` 各追加上表对应的一段(键名完全一致,值取对应列)。

- [ ] **Step 2: 写失败测试 `src/components/WallpaperDialog.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../i18n/zh_cn'
import zhSp9 from '../i18n/zh_cn.sp9'

const setCustomStorage = vi.fn(async () => undefined)
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => '',
      setCustomStorage: (...a: unknown[]) => setCustomStorage(...(a as [])),
      uploadImage: async () => ({ path: '/d/1/wallpaper.jpg', file_name: 'wallpaper.jpg', online_path: 'x' }),
      setImageFromPath: async () => ({ path: '/d/1/wallpaper.png', file_name: 'wallpaper.png', online_path: 'x' }),
    },
    image: { imageUrl: (p: string) => `/v1/image?path=${p}` },
    storage: { list: async () => [] },
    raid: { list: async () => [] },
    folder: { getList: async () => ({ items: [] }) },
  },
}))

import WallpaperDialog from './WallpaperDialog.vue'
import { useWallpaperStore } from '../stores/wallpaper'
import { useThemeStore } from '../stores/theme'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

function mountOpen() {
  const wp = useWallpaperStore()
  wp.openDialog()
  return mount(WallpaperDialog, { global: { plugins: [i18n] } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  delete document.documentElement.dataset.wallpaper
  delete document.documentElement.dataset.theme
  setCustomStorage.mockClear()
})

describe('WallpaperDialog presets', () => {
  it('renders four presets plus upload and nas entries', () => {
    const w = mountOpen()
    for (const id of ['blue', 'light', 'w01', 'w02']) {
      expect(w.find(`[data-test="wp-preset-${id}"]`).exists(), id).toBe(true)
    }
    expect(w.find('[data-test="wp-upload"]').exists()).toBe(true)
    expect(w.find('[data-test="wp-nas"]').exists()).toBe(true)
  })

  it('has no "restore default" button -- the blue base preset IS the default', () => {
    expect(mountOpen().find('[data-test="wp-restore"]').exists()).toBe(false)
  })

  it('picking a builtin previews live without persisting', async () => {
    const w = mountOpen()
    await w.find('[data-test="wp-preset-w01"]').trigger('click')
    expect(document.documentElement.dataset.wallpaper).toBe('')
    expect(setCustomStorage).not.toHaveBeenCalled()
  })

  it('picking a builtin leaves the theme alone', async () => {
    const theme = useThemeStore()
    theme.setTheme('light')
    const w = mountOpen()
    await w.find('[data-test="wp-preset-w01"]').trigger('click')
    expect(theme.theme).toBe('light')
  })

  it('picking the white base clears the wallpaper and switches the theme', async () => {
    const theme = useThemeStore()
    const w = mountOpen()
    await w.find('[data-test="wp-preset-w01"]').trigger('click')
    await w.find('[data-test="wp-preset-light"]').trigger('click')
    expect(document.documentElement.dataset.wallpaper).toBeUndefined()
    expect(theme.theme).toBe('light')
  })

  it('marks the active preset', async () => {
    const w = mountOpen()
    await w.find('[data-test="wp-preset-w02"]').trigger('click')
    expect(w.find('[data-test="wp-preset-w02"]').classes()).toContain('on')
    expect(w.find('[data-test="wp-preset-blue"]').classes()).not.toContain('on')
  })
})

describe('WallpaperDialog apply / cancel', () => {
  it('apply persists and closes', async () => {
    const wp = useWallpaperStore()
    const w = mountOpen()
    await w.find('[data-test="wp-preset-w01"]').trigger('click')
    await w.find('[data-test="wp-apply"]').trigger('click')
    await flushPromises()
    expect(setCustomStorage).toHaveBeenCalledWith('wallpaper_v3', { kind: 'builtin', id: 'w01' })
    expect(wp.dialogOpen).toBe(false)
  })

  it('cancel rolls back the record and the theme, and closes', async () => {
    const theme = useThemeStore()
    theme.setTheme('blue')
    const w = mountOpen()
    await w.find('[data-test="wp-preset-light"]').trigger('click')
    await w.find('[data-test="wp-cancel"]').trigger('click')
    expect(theme.theme).toBe('blue')
    expect(useWallpaperStore().dialogOpen).toBe(false)
  })

  it('a failed apply shows an inline error and keeps the dialog open', async () => {
    // Inline, not a toast: the toast layer is z-index 60 and a dialog overlay sits
    // above it, so a toast fired from inside a dialog is covered and blurred.
    setCustomStorage.mockRejectedValueOnce(new Error('boom'))
    const w = mountOpen()
    await w.find('[data-test="wp-preset-w01"]').trigger('click')
    await w.find('[data-test="wp-apply"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="wp-error"]').text()).toBe('保存失败,请重试')
    expect(useWallpaperStore().dialogOpen).toBe(true)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm vitest run src/components/WallpaperDialog.test.ts`
Expected: FAIL —— 找不到 `./WallpaperDialog.vue`。

- [ ] **Step 4: 写实现 `src/components/WallpaperDialog.vue`**

```vue
<script setup lang="ts">
// SP11 wallpaper picker. Opened from four places (topbar theme menu, settings
// general row, desktop context menu, and indirectly the files context menu),
// so it is an app-level singleton mounted in App.vue next to AppToast.
//
// Deliberately NOT built on components/ui/Dialog.vue: that wrapper's overlay
// carries `backdrop-filter: var(--overlay-blur)`, which would blur the very
// wallpaper this dialog previews. Following SearchDialog.vue:308 instead --
// reka-ui DialogRoot with :modal="false", anchored to the bottom, no overlay,
// so the top of the screen keeps showing the real desktop.
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogRoot, DialogPortal, DialogContent, DialogTitle } from 'reka-ui'
import { useWallpaperStore } from '../stores/wallpaper'
import { useThemeStore, type Theme } from '../stores/theme'
import { BUILTIN_IDS, NONE, builtinUrl, type BuiltinId } from '../stores/wallpaper'

const { t } = useI18n()
const wp = useWallpaperStore()
const theme = useThemeStore()
const error = ref('')
const saving = ref(false)

const activeId = computed<string>(() => {
  const r = wp.record
  if (r.kind === 'builtin') return r.id
  if (r.kind === 'image') return 'image'
  return theme.theme === 'light' ? 'light' : 'blue'
})

function pickBase(which: Theme) {
  error.value = ''
  wp.preview(NONE)
  theme.setTheme(which)
}

function pickBuiltin(id: BuiltinId) {
  error.value = ''
  wp.preview({ kind: 'builtin', id })   // theme untouched on purpose
}

async function apply() {
  error.value = ''
  saving.value = true
  try {
    await wp.commit()
    wp.closeDialog()
  } catch {
    error.value = t('wpSaveFailed')
  } finally {
    saving.value = false
  }
}

function cancel() {
  error.value = ''
  wp.cancelPreview()
  wp.closeDialog()
}

function onOpenChange(open: boolean) {
  // Esc / outside-dismiss must behave like Cancel, not like silently keeping an
  // unconfirmed preview.
  if (!open) cancel()
}
</script>

<template>
  <DialogRoot :open="wp.dialogOpen" :modal="false" @update:open="onOpenChange">
    <DialogPortal>
      <DialogContent class="wp-sheet" :aria-describedby="undefined">
        <DialogTitle class="wp-title">{{ t('wpTitle') }}</DialogTitle>

        <div class="wp-grid">
          <button type="button" class="wp-tile wp-tile-blue" :class="{ on: activeId === 'blue' }"
            data-test="wp-preset-blue" @click="pickBase('blue')">
            <span class="wp-tile-label">{{ t('wpPresetBlue') }}</span>
          </button>
          <button type="button" class="wp-tile wp-tile-light" :class="{ on: activeId === 'light' }"
            data-test="wp-preset-light" @click="pickBase('light')">
            <span class="wp-tile-label">{{ t('wpPresetLight') }}</span>
          </button>
          <button v-for="(id, i) in BUILTIN_IDS" :key="id" type="button" class="wp-tile"
            :class="{ on: activeId === id }" :data-test="`wp-preset-${id}`"
            :style="{ backgroundImage: `url(${builtinUrl(id)})` }" @click="pickBuiltin(id)">
            <span class="wp-tile-label">{{ t(i === 0 ? 'wpBuiltin1' : 'wpBuiltin2') }}</span>
          </button>
        </div>

        <div class="wp-actions">
          <slot name="sources" />
        </div>

        <p v-if="error" class="wp-error" data-test="wp-error">{{ error }}</p>

        <div class="wp-foot">
          <button type="button" class="bar-btn" data-test="wp-cancel" @click="cancel">{{ t('wpCancel') }}</button>
          <button type="button" class="bar-btn wp-primary" data-test="wp-apply" :disabled="saving"
            @click="apply">{{ t('wpApply') }}</button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/* Bottom sheet, no overlay: the upper half of the viewport must keep showing the
   live desktop so the preview is meaningful. */
.wp-sheet {
  position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 1001;
  width: min(760px, 94vw); padding: 18px 20px 16px;
  border: 1px solid var(--card-border); border-radius: var(--radius-sm);
  background: var(--popup-bg); backdrop-filter: var(--blur);
  box-shadow: var(--card-shadow-hi); color: var(--fg);
}
.wp-title { margin: 0 0 14px; font-size: 16px; font-weight: 600; }
.wp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.wp-tile {
  position: relative; aspect-ratio: 16 / 10; padding: 0; overflow: hidden; cursor: pointer;
  border: 2px solid transparent; border-radius: var(--radius-xs);
  background-color: var(--card); background-size: cover; background-position: center;
  transition: border-color 0.2s var(--ease);
}
.wp-tile:hover { border-color: var(--accent-soft-bd); }
.wp-tile.on { border-color: var(--accent); }
.wp-tile-blue { background-image: var(--app-bg-preview-blue); }
.wp-tile-light { background-image: var(--app-bg-preview-light); }
.wp-tile-label {
  position: absolute; inset: auto 0 0 0; padding: 4px 6px; font-size: 11px;
  background: var(--wallpaper-tile-label-bg); color: var(--wallpaper-tile-label-fg);
}
.wp-actions { display: flex; gap: 10px; margin-top: 14px; }
.wp-error { margin: 12px 0 0; font-size: 13px; color: var(--remove-fg); }
.wp-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
.wp-primary { background: var(--accent); color: var(--on-accent); border-color: transparent; }
.wp-primary:hover:not(:disabled) { background: var(--accent); filter: brightness(1.08); }
</style>
```

- [ ] **Step 5: 补 4 个新 token 到 `src/styles/theme.css`** —— 上面样式里用到 4 个不存在的 token,必须在**两套主题块**都给值,否则 `wallpaper.css.test.ts` 的同类守卫思路失效、且 color-guard 逼着我们不能写裸色:

深色 `:root` 块内(紧跟 `--wallpaper-scrim` 之后):
```css
  /* SP11: preset tiles in the wallpaper picker must show each base's REAL look
     regardless of the theme in effect, so they cannot read --app-bg. */
  --app-bg-preview-blue: linear-gradient(160deg, #4a5d92, #2a3354 55%, #141a2b);
  --app-bg-preview-light: linear-gradient(160deg, #ffffff, #f7f5ef);
  --wallpaper-tile-label-bg: rgba(0, 0, 0, 0.45);
  --wallpaper-tile-label-fg: #ffffff;
```
浅色 `:root[data-theme="light"]` 块内(紧跟它的 `--wallpaper-scrim` 之后)——**前两个值刻意与深色块完全相同**(预览块画的是"那套主题长什么样",与当前主题无关),后两个换成纸感取值:
```css
  --app-bg-preview-blue: linear-gradient(160deg, #4a5d92, #2a3354 55%, #141a2b);
  --app-bg-preview-light: linear-gradient(160deg, #ffffff, #f7f5ef);
  --wallpaper-tile-label-bg: rgba(255, 255, 255, 0.72);
  --wallpaper-tile-label-fg: #1c1b19;
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm vitest run src/components/WallpaperDialog.test.ts src/styles/color-guard.test.ts src/i18n && pnpm vue-tsc --noEmit`
Expected: 全绿(`src/i18n` 那批包含 parity 与分片守卫,确认新键双语齐全且没撞车)+ exit 0。

- [ ] **Step 7: Commit**

```bash
git add src/components/WallpaperDialog.vue src/components/WallpaperDialog.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/styles/theme.css
git commit -o src/components/WallpaperDialog.vue src/components/WallpaperDialog.test.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/styles/theme.css -m "feat(wallpaper): add the picker sheet with four presets

Built directly on reka-ui rather than the shared Dialog wrapper, whose overlay
blurs its own backdrop and would defeat the point of previewing a wallpaper.
Anchored to the bottom with no overlay so the live desktop stays visible.
Preset tiles paint each base's real look from dedicated tokens instead of
--app-bg, which would always show whichever theme is currently active.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 弹窗接上传与「从 NAS 选择」

**Files:**
- Modify: `src/components/WallpaperDialog.vue`(把 `<slot name="sources" />` 换成真实两个入口 + NAS 子视图)
- Modify: `src/settings/panels/account/NasImagePicker.vue:129`(`pick` 载荷改成 `{ path, src }`)
- Modify: `src/settings/panels/AccountPanel.vue:100`(唯一调用点跟着改)
- Modify: `src/components/WallpaperDialog.test.ts`(追加用例)
- Modify: `src/settings/panels/AccountPanel.test.ts`(既有「从 NAS 选中图片」那条用例的 emit 载荷跟着改)
- Modify: `src/settings/panels/account/OwnerCard.test.ts`(若断言了 pick 载荷则同改;只断言 `choose-from-nas` 的话不用动)

**Interfaces:**
- Consumes: Task 4 的 `wp.uploadAndPreview`;`NasImagePicker` 的新 `pick` 载荷
- Produces: `NasImagePicker` 的 `pick` 事件签名变为 `[{ path: string; src: string }]`

- [ ] **Step 1: 改 `NasImagePicker` 的 emit 契约**

`src/settings/panels/account/NasImagePicker.vue` —— 声明处:
```ts
// SP11: the payload carries both halves because the two consumers need different
// ones -- the avatar cropper wants a displayable URL, the wallpaper picker needs
// the on-disk NAS path to hand to PUT /users/current/image/wallpaper.
const emit = defineEmits<{ pick: [{ path: string; src: string }] }>()
```
`:129`:
```ts
  else emit('pick', { path: item.path, src: service.image.imageUrl(item.path, 'original') })
```

`src/settings/panels/AccountPanel.vue:100`:
```ts
function onNasPick(picked: { path: string; src: string }) {
  // NAS picks are /v1/image URLs, not objectURLs, so no revoke is needed (second arg false).
  setPickedImage(picked.src, false)
  goto(4)
}
```

- [ ] **Step 2: 跑既有测试,看它红在哪**

Run: `pnpm vitest run src/settings/panels/AccountPanel.test.ts src/settings/panels/account`
Expected: 「从 NAS 选中图片 → 进 state 4」那条 FAIL(它 emit 的还是裸字符串)。按新载荷改测试里的 `emit('pick', …)` 调用,再跑至全绿。这是**契约变更驱动的测试更新**,不是放宽断言。

- [ ] **Step 3: 写弹窗新用例** —— 追加到 `src/components/WallpaperDialog.test.ts`:

```ts
describe('WallpaperDialog sources', () => {
  it('rejects an oversized upload inline without hitting the network', async () => {
    const w = mountOpen()
    const input = w.find('[data-test="wp-file"]')
    const big = new File([new Uint8Array(1)], 'big.jpg')
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
    Object.defineProperty(input.element, 'files', { value: [big] })
    await input.trigger('change')
    await flushPromises()
    expect(w.find('[data-test="wp-error"]').text()).toBe('图片不能超过 10 MB')
  })

  it('a successful upload previews the uploaded image without persisting', async () => {
    const w = mountOpen()
    const input = w.find('[data-test="wp-file"]')
    const small = new File([new Uint8Array([1])], 'a.jpg')
    Object.defineProperty(input.element, 'files', { value: [small] })
    await input.trigger('change')
    await flushPromises()
    expect(useWallpaperStore().record).toMatchObject({ kind: 'image', path: '/d/1/wallpaper.jpg' })
    expect(setCustomStorage).not.toHaveBeenCalled()
  })

  it('the nas button swaps in the picker, and a pick previews then returns to the grid', async () => {
    const w = mountOpen()
    await w.find('[data-test="wp-nas"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="wp-nas-picker"]').exists()).toBe(true)

    await w.findComponent({ name: 'NasImagePicker' })
      .vm.$emit('pick', { path: '/DATA/Gallery/a.png', src: '/v1/image?path=/DATA/Gallery/a.png' })
    await flushPromises()
    expect(useWallpaperStore().record).toMatchObject({ kind: 'image', path: '/d/1/wallpaper.png' })
    expect(w.find('[data-test="wp-nas-picker"]').exists()).toBe(false)
    expect(w.find('[data-test="wp-preset-w01"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 4: 跑测试确认失败**

Run: `pnpm vitest run src/components/WallpaperDialog.test.ts`
Expected: 新三条 FAIL(`wp-file` / `wp-nas-picker` 不存在)。

- [ ] **Step 5: 实现两个来源入口** —— 把 `WallpaperDialog.vue` 里的 `<div class="wp-actions"><slot name="sources" /></div>` 替换为:

```vue
        <div v-if="!nasOpen" class="wp-actions">
          <button type="button" class="bar-btn" data-test="wp-upload" :disabled="wp.busy"
            @click="fileEl?.click()">{{ t('wpUpload') }}</button>
          <!-- Hidden native input rather than a drop zone: mirrors Vue2's single
               "pick a file" affordance, and needs no new dependency. -->
          <input ref="fileEl" class="wp-file" type="file" data-test="wp-file"
            accept="image/png,image/jpeg,image/bmp,image/gif,image/svg+xml" @change="onFile" />
          <button type="button" class="bar-btn" data-test="wp-nas"
            @click="nasOpen = true">{{ t('wpFromNas') }}</button>
        </div>
        <div v-else class="wp-nas" data-test="wp-nas-picker">
          <NasImagePicker @pick="onNasPick" />
        </div>
```

script 段补:
```ts
// Cross-area import, registered in spec section 4.5: NasImagePicker stays under
// settings/ because it depends on settings.css, and dragging that stylesheet into
// the global bundle would cost more than this one import.
import NasImagePicker from '../settings/panels/account/NasImagePicker.vue'

const fileEl = ref<HTMLInputElement | null>(null)
const nasOpen = ref(false)

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  error.value = ''
  try {
    await wp.uploadAndPreview(file)
  } catch (err) {
    // The size check throws before any request; anything else is a real upload failure.
    error.value = /too large/i.test(String(err)) ? t('wpTooLarge') : t('wpUploadFailed')
  } finally {
    input.value = ''   // allow re-picking the same file after a failure
  }
}

async function onNasPick(picked: { path: string; src: string }) {
  error.value = ''
  try {
    await wp.setFromNasPath(picked.path)
    nasOpen.value = false
  } catch (err) {
    // The backend caps this path at 10 MB and reports it as HTTP 200 + success!=200;
    // show its message rather than a generic one.
    error.value = String((err as Error)?.message || t('wpUploadFailed'))
  }
}
```

样式补:
```css
.wp-file { display: none; }
.wp-nas { max-height: 46vh; overflow: auto; }
```

> **注意** `setFromNasPath` 会**立即落服务端**(它同时服务文件区右键那条无弹窗路径)。在弹窗里这意味着从 NAS 选图不需要再点「应用」—— 这是刻意的:图已经被后端拷进用户目录了,回滚也删不掉它,再让「取消」假装能撤销是骗人。**在 `onNasPick` 成功后调 `wp.beginPreview()` 重置快照**,这样随后的「取消」不会把已落盘的选择又回滚掉。

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm vitest run src/components/WallpaperDialog.test.ts src/settings && pnpm vue-tsc --noEmit`
Expected: 全绿 + exit 0。

- [ ] **Step 7: Commit**

```bash
git add src/components/WallpaperDialog.vue src/components/WallpaperDialog.test.ts src/settings
git commit -o src/components/WallpaperDialog.vue src/components/WallpaperDialog.test.ts src/settings -m "feat(wallpaper): wire upload and choose-from-NAS into the picker

NasImagePicker now emits both the on-disk path and a displayable URL, because
the wallpaper flow needs the path for the backend copy while the avatar cropper
needs the URL. A NAS pick persists immediately and resets the rollback
snapshot: the backend has already copied the file, so letting Cancel pretend to
undo it would be a lie.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 挂 `App.vue` + 解禁设置页那一行

**Files:**
- Modify: `src/App.vue`
- Modify: `src/settings/panels/general/WallpaperRow.vue`(整体重写)
- Modify: `src/settings/panels/general/rows.test.ts`(替换 `WallpaperRow` 那个 describe 块)
- Modify: `src/i18n/zh_cn.sp9.ts` · `src/i18n/en_us.sp9.ts`(删 `settingsWallpaperNa`)

**Interfaces:**
- Consumes: Task 5/6 的 `WallpaperDialog.vue`;Task 4 的 `wp.openDialog` / `wp.load`
- Produces: 全应用任何路由下都能 `useWallpaperStore().openDialog()`

- [ ] **Step 1: 写失败测试** —— 用下面这段**替换** `src/settings/panels/general/rows.test.ts` 里现有的 `describe('WallpaperRow(债务 D5…)')` 整块:

```ts
describe('WallpaperRow (SP11: debt D5 paid off)', () => {
  it('renders the label with an enabled change button', () => {
    const w = mountRow(WallpaperRow)
    expect(w.find('.set-row-label').text()).toBe('壁纸')
    expect(w.find('.set-btn').attributes('disabled')).toBeUndefined()
  })
  it('no longer explains why it is unavailable', () => {
    expect(mountRow(WallpaperRow).find('.set-row-hint').exists()).toBe(false)
  })
  it('opens the app-level picker', async () => {
    const w = mountRow(WallpaperRow)
    await w.find('.set-btn').trigger('click')
    expect(useWallpaperStore().dialogOpen).toBe(true)
  })
})
```
文件顶部补 `import { useWallpaperStore } from '../../../stores/wallpaper'`,并把该文件的 `vi.mock('@nimotech/nimoos-service', …)` 工厂里的 `users` 补上 `uploadImage` / `setImageFromPath` / `getCustomStorage` 三个桩(store 会 import 到它们)。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/settings/panels/general/rows.test.ts`
Expected: FAIL —— 按钮仍 `disabled`、hint 仍存在。

- [ ] **Step 3: 重写 `WallpaperRow.vue`**

```vue
<script setup lang="ts">
// Settings > General > Wallpaper. Mirrors Vue2 SettingsPanel.vue L102-116.
// SP11 pays off debt D5: the button used to be disabled with a hint saying the
// new UI had no wallpaper system. It now opens the app-level picker, which is
// mounted in App.vue because settings is its own route and the desktop entries
// live under a different one.
import { useI18n } from 'vue-i18n'
import SettingsRow from '../../components/SettingsRow.vue'
import { useWallpaperStore } from '../../../stores/wallpaper'
const { t } = useI18n()
const wp = useWallpaperStore()
</script>

<template>
  <SettingsRow :label="t('settingsWallpaper')">
    <template #control>
      <button class="set-btn" type="button" @click="wp.openDialog()">{{ t('settingsWallpaperChange') }}</button>
    </template>
  </SettingsRow>
</template>
```

- [ ] **Step 4: 删掉那条死文案** —— 从 `src/i18n/zh_cn.sp9.ts:23` 与 `src/i18n/en_us.sp9.ts:21` 各删一行 `settingsWallpaperNa`。`settingsWallpaper` 与 `settingsWallpaperChange` **保留原位不动**(仍在用)。

- [ ] **Step 5: 挂弹窗到 `App.vue`**

```vue
<template>
  <router-view />
  <WallpaperDialog />
  <AppToast />
</template>
```
```ts
import { defineAsyncComponent, onMounted } from 'vue'
import AppToast from './components/AppToast.vue'
import { useSessionStore } from './stores/session'
import { useLocaleStore } from './stores/locale'
import { useWallpaperStore } from './stores/wallpaper'

// Async on purpose: the two built-in JPEGs total ~3 MB, and this keeps them out
// of the first-paint bundle -- they download only when the picker is opened.
const WallpaperDialog = defineAsyncComponent(() => import('./components/WallpaperDialog.vue'))

onMounted(() => {
  const session = useSessionStore()
  if (session.isAuthed) {
    void useLocaleStore().loadFromServer()
    // main.ts already painted the cached wallpaper before mount; this reconciles
    // it with the server so a change made on another device shows up.
    void useWallpaperStore().load()
  }
})
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm vitest run src/settings/panels/general/rows.test.ts src/i18n && pnpm vue-tsc --noEmit`
Expected: 全绿(`src/i18n` 确认删键后 parity 仍一致)+ exit 0。

- [ ] **Step 7: 确认 3MB 真的没进首屏 chunk**

Run: `pnpm build && ls -la dist/assets/ | grep -i wallpaper`
Expected: 两个 wallpaper 资源存在,且 `dist/assets/index-*.js` 里**不含**它们的引用 —— 用
`grep -c "wallpaper0" dist/assets/index-*.js` 应得 `0`,而某个懒加载 chunk 里能 grep 到。

- [ ] **Step 8: Commit**

```bash
git add src/App.vue src/settings/panels/general/WallpaperRow.vue src/settings/panels/general/rows.test.ts src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts
git commit -o src/App.vue src/settings/panels/general/WallpaperRow.vue src/settings/panels/general/rows.test.ts src/i18n/zh_cn.sp9.ts src/i18n/en_us.sp9.ts -m "feat(wallpaper): mount the picker app-wide and enable the settings row

The picker has to be an App.vue singleton because settings is its own route
while the desktop entries live under another, so no route-scoped store can
reach both. Loading it asynchronously keeps the ~3 MB of built-in imagery out
of the first-paint bundle. Debt D5 and its explanatory hint string are gone.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 顶栏三档(蓝色 / 白色 / 照片…)

**Files:**
- Modify: `src/home/components/ThemeToggle.vue`
- Modify: `src/home/components/ThemeToggle.test.ts`

**Interfaces:**
- Consumes: Task 4 的 `wp.openDialog`、`wp.record`、`wp.preview`;`theme.setTheme`
- Produces: DOM 契约 `[data-test="tt-blue"]` / `[data-test="tt-light"]` / `[data-test="tt-photo"]`

- [ ] **Step 1: 写失败测试** —— 替换 `src/home/components/ThemeToggle.test.ts` 全文:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => '',
      setCustomStorage: async () => undefined,
      uploadImage: async () => ({ path: '/d/1/wallpaper.jpg', file_name: 'w.jpg', online_path: 'x' }),
      setImageFromPath: async () => ({ path: '/d/1/wallpaper.png', file_name: 'w.png', online_path: 'x' }),
    },
  },
}))

import ThemeToggle from './ThemeToggle.vue'
import { useThemeStore } from '../../stores/theme'
import { useWallpaperStore } from '../../stores/wallpaper'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

async function openMenu() {
  const w = mount(ThemeToggle, { global: { plugins: [i18n] } })
  await w.find('.theme-btn').trigger('click')
  return w
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  delete document.documentElement.dataset.theme
  delete document.documentElement.dataset.wallpaper
})

describe('ThemeToggle', () => {
  it('offers three entries', async () => {
    const w = await openMenu()
    expect(w.find('[data-test="tt-blue"]').exists()).toBe(true)
    expect(w.find('[data-test="tt-light"]').exists()).toBe(true)
    expect(w.find('[data-test="tt-photo"]').exists()).toBe(true)
  })

  it('picking a base clears any wallpaper and switches the theme in one step', async () => {
    useWallpaperStore().preview({ kind: 'builtin', id: 'w01' })
    const w = await openMenu()
    await w.find('[data-test="tt-light"]').trigger('click')
    expect(useThemeStore().theme).toBe('light')
    expect(document.documentElement.dataset.wallpaper).toBeUndefined()
  })

  it('checks the base matching the active theme when no wallpaper is set', async () => {
    useThemeStore().setTheme('light')
    const w = await openMenu()
    expect(w.find('[data-test="tt-light"]').attributes('aria-checked')).toBe('true')
    expect(w.find('[data-test="tt-blue"]').attributes('aria-checked')).toBe('false')
    expect(w.find('[data-test="tt-photo"]').attributes('aria-checked')).toBe('false')
  })

  it('checks Photo whenever any image is set, regardless of theme', async () => {
    useThemeStore().setTheme('light')
    useWallpaperStore().preview({ kind: 'builtin', id: 'w02' })
    const w = await openMenu()
    expect(w.find('[data-test="tt-photo"]').attributes('aria-checked')).toBe('true')
    expect(w.find('[data-test="tt-light"]').attributes('aria-checked')).toBe('false')
  })

  it('Photo opens the picker rather than applying anything itself', async () => {
    // The menu is min-width 148px; four thumbnails there would be unreadable, so
    // fine-grained choice lives in the sheet (owner call, 2026-08-07).
    const w = await openMenu()
    await w.find('[data-test="tt-photo"]').trigger('click')
    expect(useWallpaperStore().dialogOpen).toBe(true)
  })

  it('closes the menu after any pick', async () => {
    const w = await openMenu()
    await w.find('[data-test="tt-blue"]').trigger('click')
    expect(w.find('.theme-menu').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/home/components/ThemeToggle.test.ts`
Expected: FAIL —— 找不到 `[data-test="tt-photo"]`。

- [ ] **Step 3: 改 `ThemeToggle.vue`** —— 模板里的 `v-for="opt in THEMES"` 那块换成三个显式项:

```vue
      <div class="theme-menu" role="menu">
        <button class="theme-opt" role="menuitemradio" data-test="tt-blue"
          :class="{ on: active === 'blue' }" :aria-checked="active === 'blue'" @click="pickBase('blue')">
          <span class="sw sw-blue" />
          <span class="lbl">{{ t('themeBlue') }}</span>
          <span v-if="active === 'blue'" class="ck">✓</span>
        </button>
        <button class="theme-opt" role="menuitemradio" data-test="tt-light"
          :class="{ on: active === 'light' }" :aria-checked="active === 'light'" @click="pickBase('light')">
          <span class="sw sw-light" />
          <span class="lbl">{{ t('themeLight') }}</span>
          <span v-if="active === 'light'" class="ck">✓</span>
        </button>
        <button class="theme-opt" role="menuitemradio" data-test="tt-photo"
          :class="{ on: active === 'photo' }" :aria-checked="active === 'photo'" @click="pickPhoto()">
          <span class="sw sw-photo" />
          <span class="lbl">{{ t('themePhoto') }}</span>
          <span v-if="active === 'photo'" class="ck">✓</span>
        </button>
      </div>
```

script 段:
```ts
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore, type Theme } from '../../stores/theme'
import { useWallpaperStore, NONE } from '../../stores/wallpaper'

const { t } = useI18n()
const theme = useThemeStore()
const wp = useWallpaperStore()
const open = ref(false)

// Three entries, not two themes plus a wallpaper toggle: from the user's side
// this menu answers "what is behind everything", and an image answers it too.
const active = computed<'blue' | 'light' | 'photo'>(() =>
  wp.record.kind !== 'none' ? 'photo' : theme.theme === 'light' ? 'light' : 'blue',
)

function pickBase(v: Theme) {
  wp.preview(NONE)
  void wp.commit()      // one-step from the topbar: no confirm step to defer to
  theme.setTheme(v)
  open.value = false
}

function pickPhoto() {
  open.value = false
  wp.openDialog()
}
```

样式加第三个色块(`theme-exception` 注释必须保留形态,理由与既有两块相同):
```css
/* theme-exception: preview swatch shows what the photo option looks like, not
   the active theme's colours. */
.sw-photo { background: linear-gradient(135deg, #7a8ea8, #3c4a5e); }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/home/components/ThemeToggle.test.ts src/styles/color-guard.test.ts && pnpm vue-tsc --noEmit`
Expected: 全绿 + exit 0。

- [ ] **Step 5: Commit**

```bash
git add src/home/components/ThemeToggle.vue src/home/components/ThemeToggle.test.ts
git commit -o src/home/components/ThemeToggle.vue src/home/components/ThemeToggle.test.ts -m "feat(wallpaper): give the topbar picker a third Photo entry

From the user's side this menu answers what sits behind everything, and an
image answers it as much as a gradient does. The two bases stay one-step; Photo
defers to the sheet because a 148px menu cannot show four legible thumbnails.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: 桌面空白处右键菜单

**Files:**
- Create: `src/home/components/DesktopContextMenu.vue`
- Create: `src/home/components/DesktopContextMenu.test.ts`
- Modify: `src/views/Home.vue`(用它包住 `GridCanvas`)
- Modify: `src/i18n/zh_cn.base.ts` · `src/i18n/en_us.base.ts`(加 `wpChangeWallpaper`)

**Interfaces:**
- Consumes: `src/components/ui/ContextMenu.vue`;Task 4 的 `wp.openDialog`
- Produces: `DesktopContextMenu.vue` 默认导出(默认插槽包住被右击区域)

**新增 i18n 键:** `wpChangeWallpaper` → zh `更换壁纸` / en `Change wallpaper`

- [ ] **Step 1: 写失败测试 `src/home/components/DesktopContextMenu.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { h } from 'vue'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => '', setCustomStorage: async () => undefined,
      uploadImage: async () => ({ path: 'p', file_name: 'f', online_path: 'x' }),
      setImageFromPath: async () => ({ path: 'p', file_name: 'f', online_path: 'x' }),
    },
  },
}))

import DesktopContextMenu from './DesktopContextMenu.vue'
import { useWallpaperStore } from '../../stores/wallpaper'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })

describe('DesktopContextMenu', () => {
  it('renders its slot content unchanged', () => {
    const w = mount(DesktopContextMenu, {
      global: { plugins: [i18n] },
      slots: { default: () => h('div', { class: 'canvas-stub' }, 'grid') },
    })
    expect(w.find('.canvas-stub').text()).toBe('grid')
  })

  it('lets a right-click on a tile through to the browser instead of opening the menu', async () => {
    // Vue2 gated this the same way (wallpaper/ContextMenu.vue:50 checked for the
    // contextmenu-canvas class): a right-click on a tile is not a desktop click.
    const w = mount(DesktopContextMenu, {
      global: { plugins: [i18n] },
      slots: { default: () => h('div', { class: 'grid' }, [h('div', { class: 'grid-item' }, 'tile')]) },
    })
    const tile = w.find('.grid-item')
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    tile.element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false)
  })

  it('handles a right-click on blank canvas', async () => {
    const w = mount(DesktopContextMenu, {
      global: { plugins: [i18n] },
      slots: { default: () => h('div', { class: 'grid' }, 'blank') },
    })
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    w.find('.grid').element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('exposes a wallpaper action that opens the picker', async () => {
    const w = mount(DesktopContextMenu, {
      global: { plugins: [i18n] },
      slots: { default: () => h('div', { class: 'grid' }) },
    })
    // The menu content is portalled; call the handler the item is bound to.
    ;(w.vm as unknown as { onChangeWallpaper: () => void }).onChangeWallpaper()
    expect(useWallpaperStore().dialogOpen).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/home/components/DesktopContextMenu.test.ts`
Expected: FAIL —— 组件不存在。

- [ ] **Step 3: 写实现 `src/home/components/DesktopContextMenu.vue`**

```vue
<script setup lang="ts">
// Right-click on empty desktop -> Change wallpaper. Ports Vue2
// components/wallpaper/ContextMenu.vue, including its gate: a right-click that
// landed on a tile is not a desktop click and must fall through to the browser
// (Vue2 checked for the `contextmenu-canvas` class at :50; New-UI's equivalent
// signal is "the target is inside a .grid-item").
import { ContextMenuItem } from 'reka-ui'
import { useI18n } from 'vue-i18n'
import ContextMenu from '../../components/ui/ContextMenu.vue'
import { useWallpaperStore } from '../../stores/wallpaper'

const { t } = useI18n()
const wp = useWallpaperStore()

function onContextMenu(e: MouseEvent) {
  const el = e.target as HTMLElement | null
  if (el?.closest('.grid-item')) {
    // Stop reka-ui's trigger from seeing it; the browser menu stays available.
    e.stopPropagation()
  }
}

function onChangeWallpaper() {
  wp.openDialog()
}

defineExpose({ onChangeWallpaper })
</script>

<template>
  <ContextMenu>
    <div class="desktop-ctx-host" @contextmenu.capture="onContextMenu">
      <slot />
    </div>
    <template #menu>
      <ContextMenuItem class="ui-ctx-item ctx-change-wallpaper" @select="onChangeWallpaper">
        {{ t('wpChangeWallpaper') }}
      </ContextMenuItem>
    </template>
  </ContextMenu>
</template>

<style scoped>
/* Must not introduce a new box: GridCanvas measures itself and the dock offset. */
.desktop-ctx-host { display: contents; }
</style>
```

> `display: contents` 是刻意的:`useGridMeasure` 量的是 `GridCanvas` 根元素与 dock 的位置,插一个有盒模型的包裹层会改布局。若 `@vue/test-utils` 下 `closest` 因 `display:contents` 行为异常,改成把 `@contextmenu.capture` 直接绑在 `ContextMenu` 的 trigger 上并去掉包裹 div。

- [ ] **Step 4: 接进 `src/views/Home.vue`** —— 把
```vue
    <GridCanvas v-else ref="canvas" :cell="cell" :gap="gap" :cols="cols" :rows="rows" />
```
换成
```vue
    <DesktopContextMenu v-else>
      <GridCanvas ref="canvas" :cell="cell" :gap="gap" :cols="cols" :rows="rows" />
    </DesktopContextMenu>
```
并 `import DesktopContextMenu from '../home/components/DesktopContextMenu.vue'`。
**不给手机端(`MobileHome`)加** —— 它是只读启动器(spec §9)。

- [ ] **Step 5: 跑测试确认通过 + 主页回归**

Run: `pnpm vitest run src/home src/views/Home.integration.test.ts && pnpm vue-tsc --noEmit`
Expected: 全绿。**若 `Home.integration.test.ts` 因多一层包裹而红,修测试的选择器,不要退回去删包裹层** —— 但必须确认 `useGridMeasure` 相关断言(cols/rows/cell)数值未变,变了说明 `display: contents` 没生效,那才是真回归。

- [ ] **Step 6: Commit**

```bash
git add src/home/components/DesktopContextMenu.vue src/home/components/DesktopContextMenu.test.ts src/views/Home.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -o src/home/components/DesktopContextMenu.vue src/home/components/DesktopContextMenu.test.ts src/views/Home.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts -m "feat(wallpaper): add the desktop right-click entry

Ports Vue2's desktop context menu including its gate: a right-click that landed
on a tile is not a desktop click and falls through to the browser. The host
element uses display:contents so the grid measurement, which reads the canvas
and dock geometry, is unaffected.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: 文件区右键「设为壁纸」

**Files:**
- Create: `src/files/util/wallpaperExt.ts`
- Create: `src/files/util/wallpaperExt.test.ts`
- Modify: `src/files/components/FileContextMenu.vue`
- Modify: `src/files/components/FileContextMenu.test.ts`
- Modify: `src/views/Files.vue`(action 分发加一支)
- Modify: `src/i18n/zh_cn.base.ts` · `src/i18n/en_us.base.ts`(加 `filesCtxSetWallpaper`)

**Interfaces:**
- Consumes: Task 4 的 `wp.setFromNasPath`;`useToast().show`
- Produces:
  ```ts
  export const WALLPAPER_EXT: readonly string[]                  // ['png','jpg','jpeg','bmp','gif','svg']
  export function canBeWallpaper(entry: { name: string; is_dir: boolean } | null): boolean
  ```
  DOM 契约:`.ctx-set-wallpaper`;action 名 `'set-wallpaper'`

**新增 i18n 键:** `filesCtxSetWallpaper` → zh `设为壁纸` / en `Set as wallpaper`

- [ ] **Step 1: 写失败测试 `src/files/util/wallpaperExt.test.ts`**

```ts
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
    expect(canBeWallpaper({ name: '.jpg', is_dir: false })).toBe(true)
    expect(canBeWallpaper(null)).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/files/util/wallpaperExt.test.ts`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 写实现 `src/files/util/wallpaperExt.ts`**

```ts
/** Extensions the "Set as wallpaper" item is offered for. Ported verbatim from
 *  Vue2 mixins/mixin.js:52 -- note it includes svg and gif but not webp, which
 *  matches what the backend's GetImageExt accepts. */
export const WALLPAPER_EXT = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'svg'] as const

export function canBeWallpaper(entry: { name: string; is_dir: boolean } | null): boolean {
  if (!entry || entry.is_dir) return false
  const dot = entry.name.lastIndexOf('.')
  if (dot < 0) return false
  const ext = entry.name.slice(dot + 1).toLowerCase()
  return (WALLPAPER_EXT as readonly string[]).includes(ext)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/files/util/wallpaperExt.test.ts`
Expected: PASS。

- [ ] **Step 5: 写菜单项的失败测试** —— 追加到 `src/files/components/FileContextMenu.test.ts`:

```ts
describe('set as wallpaper (SP11)', () => {
  const img = { name: 'a.jpg', path: '/DATA/Gallery/a.jpg', is_dir: false } as never

  it('appears for a single image outside snapshot view', () => {
    const w = mountMenu({ entry: img, selectedCount: 1 })
    expect(w.find('.ctx-set-wallpaper').exists()).toBe(true)
  })
  it('hides for a non-image', () => {
    const w = mountMenu({ entry: { name: 'a.mp4', path: '/DATA/a.mp4', is_dir: false } as never, selectedCount: 1 })
    expect(w.find('.ctx-set-wallpaper').exists()).toBe(false)
  })
  it('hides for a folder', () => {
    const w = mountMenu({ entry: { name: 'Gallery', path: '/DATA/Gallery', is_dir: true } as never, selectedCount: 1 })
    expect(w.find('.ctx-set-wallpaper').exists()).toBe(false)
  })
  it('hides on multi-select, like Copy Path and Rename', () => {
    const w = mountMenu({ entry: img, selectedCount: 3 })
    expect(w.find('.ctx-set-wallpaper').exists()).toBe(false)
  })
  it('hides in snapshot view, which is read-only', () => {
    useSnapshotBrowseStore().$patch({ /* set whatever makes isSnapshotView true in this suite */ })
    const w = mountMenu({ entry: img, selectedCount: 1 })
    expect(w.find('.ctx-set-wallpaper').exists()).toBe(false)
  })
  it('emits the set-wallpaper action with the entry', async () => {
    const w = mountMenu({ entry: img, selectedCount: 1 })
    await w.find('.ctx-set-wallpaper').trigger('click')
    expect(w.emitted('action')?.[0]).toEqual(['set-wallpaper', img])
  })
})
```

> 开工时照该文件既有的 `mountMenu` helper 与「进入快照态」的既有写法对齐(现有用例里已有让 `inSnapshot` 为真的做法,直接复用,不要新造)。

- [ ] **Step 6: 跑测试确认失败**

Run: `pnpm vitest run src/files/components/FileContextMenu.test.ts`
Expected: 新用例 FAIL。

- [ ] **Step 7: 改 `FileContextMenu.vue`** —— script 段:

```ts
import { canBeWallpaper } from '../util/wallpaperExt'

// Same gating as Vue2 ContextMenu.vue:96 -- single selection, image file, and
// hidden in the read-only snapshot view.
const showSetWallpaper = computed(() => single.value && !inSnapshot.value && canBeWallpaper(props.entry))
```
模板 —— 放在 `ctx-share` 之后、`showSeparator` 分割线之前:
```vue
        <ContextMenuItem v-if="showSetWallpaper" class="ui-ctx-item ctx-set-wallpaper" @select="fire('set-wallpaper')">{{ t('filesCtxSetWallpaper') }}</ContextMenuItem>
```
并把 `showSeparator` 的条件补上这一项,避免只剩删除时出现悬空分割线:
```ts
const showSeparator = computed(
  () => showDelete.value && (showCopyPath.value || showRename.value || showFavorite.value || showShare.value || showSetWallpaper.value),
)
```

- [ ] **Step 8: 接 `src/views/Files.vue` 的 action 分发** —— 在既有 `switch`/映射里加一支:

```ts
    case 'set-wallpaper': {
      if (!entry) return
      try {
        await useWallpaperStore().setFromNasPath(entry.path)
        toast.show(t('wpSetOk'))
      } catch (e) {
        // The backend caps this path at 10 MB and reports failures as HTTP 200
        // with success != 200; surface its message rather than failing silently
        // the way Vue2's error branches did.
        toast.show(String((e as Error)?.message || t('wpUploadFailed')), 5000, 'danger')
      }
      return
    }
```
(照该文件既有的 `toast` / `t` / `await` 写法对齐;`useWallpaperStore` 顶部 import。)

- [ ] **Step 9: 跑测试确认通过**

Run: `pnpm vitest run src/files && pnpm vue-tsc --noEmit`
Expected: 全绿 + exit 0。

- [ ] **Step 10: Commit**

```bash
git add src/files/util/wallpaperExt.ts src/files/util/wallpaperExt.test.ts src/files/components/FileContextMenu.vue src/files/components/FileContextMenu.test.ts src/views/Files.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts
git commit -o src/files/util/wallpaperExt.ts src/files/util/wallpaperExt.test.ts src/files/components/FileContextMenu.vue src/files/components/FileContextMenu.test.ts src/views/Files.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts -m "feat(wallpaper): add Set as wallpaper to the files context menu

Extension whitelist and gating are ported verbatim from Vue2, including the
snapshot-view exclusion. Failures surface the backend's own message -- its
10 MB cap on this path arrives as HTTP 200 with a non-200 success field, so a
silent branch would look like success.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: 收尾门 + 台账与 roadmap 关账

**Files:**
- Modify: `NimoOS-UI/docs/vue3-migration-roadmap.md`(§4 SP11 勾选 + 关账段)
- Modify: `NimoOS-UI/docs/vue3-pending/05-设置与KVM与搜索-SP9.md`(A1 / D5 标已修)
- Modify: `NimoOS-UI/docs/vue3-pending/06-跨区与大外壳.md`(X3 标已修;Q3 移出待拍板)
- Create: `NimoOS-New-UI/.superpowers/sdd/2026-08-07-vue3-migration-sp11-wallpaper/ledger.md`

- [ ] **Step 1: 跑全量门**

Run:
```bash
pnpm vitest run 2>&1 | tail -20
pnpm vue-tsc --noEmit
pnpm build
node oss/export.mjs --dry-run   # 确认导出产物树仍能构建;不带 --out,别写真实公开仓
```
Expected: 测试 0 失败(**记录实际用例数**,别抄旧数字——master 已被另一条会话推进过)· tsc exit 0 · build 成功 · oss dry-run 通过。
**任何一门红都不许往下走。**

- [ ] **Step 2: 手工核对首屏体积**

Run: `grep -c "wallpaper0" dist/assets/index-*.js`
Expected: `0` —— 3MB 内置图必须在懒加载 chunk 里,不在首屏。

- [ ] **Step 3: 写执行台账** `NimoOS-New-UI/.superpowers/sdd/2026-08-07-vue3-migration-sp11-wallpaper/ledger.md`

至少记:11 个任务各自的 commit hash · Step 1 实测的用例数/门结果 · 两次变异验证(T2 Step 8 的 CSS 位置守卫、T4 Step 5 的回滚快照)的实际输出 · Task 3 里三个错误码填的真实数值及其来源文件 · 遇到的与 spec 不符之处(spec 是设计意图,实测为准)。

- [ ] **Step 4: roadmap 关账** —— `NimoOS-UI/docs/vue3-migration-roadmap.md`:
- §4 阶段表里 SP11 那行状态 `⬜` → `✅`
- SP11 段落里「壁纸 / 主题选择器」那条 `- [ ]` → `- [x]`,并补一段关账记录:实现形态(`<html>` 层 + `custom/wallpaper_v3` 独立 key)· 四个入口 · 三个判断(全应用可见 / 10MB 上限 / async chunk)· 已知限制(主题不跨设备同步)· 两处守卫的存在理由 · 未部署未推 origin
- 审计文档两处(`05-…-SP9.md` 的 A1/D5、`06-跨区与大外壳.md` 的 X3)标已修,并把 `06` 里 Q3「壁纸选择器排哪一期」从待拍板清单移走

- [ ] **Step 5: Commit(两个仓分别提交,都带 pathspec)**

```bash
# New-UI:台账(gitignore 不进 git 的话跳过 add,只记录路径)
cd /home/nimo/NimoTech/NimoOS-New-UI
git status --short .superpowers   # 若被 gitignore 排除则无需提交

# 文档仓
cd /home/nimo/NimoTech/NimoOS-UI
git add docs/vue3-migration-roadmap.md docs/vue3-pending/05-设置与KVM与搜索-SP9.md docs/vue3-pending/06-跨区与大外壳.md
git commit -o docs/vue3-migration-roadmap.md docs/vue3-pending/05-设置与KVM与搜索-SP9.md docs/vue3-pending/06-跨区与大外壳.md -m "docs(sp11): close out the wallpaper stage

Records the shipped shape -- an <html> background layer with the theme gradient
as its fallback, a storage key independent of Vue2's, and four entry points --
plus the two guards that exist because their failure modes are invisible to
tsc, build and jsdom. Debt D5 / audit X3 are paid off. Theme choice still does
not sync across devices; that limitation is logged, not fixed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: 报交付状态,等机主验收**

明确报出:**未部署、未推 origin**(与 SP9/SP10/SP13 惯例一致)。验收方式按机主既有约定 —— 起 dev server:`pnpm dev --host --port 5273`,**不跑 `deploy.sh`**(本期不是 cutover 期,没有跨应用绞杀行为要验)。

**验收清单(每条都写出点击路径):**
1. 主页顶栏点半圆图标 → 菜单**三项**:蓝色 / 白色 / 照片…;当前应打勾在「蓝色」
2. 点「白色」→ 整个界面变纸感白;再点「蓝色」→ 变回深蓝玻璃
3. 顶栏 → 照片… → 弹窗从底部升起,**上半屏仍看得见桌面磁贴**
4. 弹窗里点「内置壁纸 1」→ 背景**立即**变照片,磁贴浮在照片上;点「取消」→ 背景回到点开前的样子
5. 重复 4,这次点「应用」→ 弹窗关闭,背景保持照片;**刷新页面**(F5)→ 照片仍在(且不闪一下渐变)
6. 此时顶栏菜单打勾应在「照片」;点「白色」→ 照片消失、变纸感白
7. 照片壁纸下切到「白色」纸感:**文字必须看得清**(这是 scrim 那条守卫要保的东西,肉眼确认)
8. 进设置 → 通用 → 壁纸行:「更改」按钮**可点**、行下方**没有**「暂未提供」那句话;点它开同一个弹窗
9. 桌面**空白处**右键 → 出现「更换壁纸」一项;点它开弹窗
10. 桌面**磁贴上**右键 → 出现**浏览器自己的**菜单(不是我们的),说明门控生效
11. 弹窗 →「上传图片」→ 选一张 <10MB 的图 → 背景变成它;点「应用」→ 刷新后仍在
12. 弹窗 →「上传图片」→ 选一张 >10MB 的图 → 弹窗内出现「图片不能超过 10 MB」,背景不变
13. 弹窗 →「从 NAS 选择」→ 选一张 NAS 上的图 → 背景变成它(这条**不需要**再点应用,已落盘)
14. 文件区找一张 jpg/png → 右键 → 有「设为壁纸」→ 点它 → toast「已设为壁纸」,回主页背景已换
15. 文件区右键一个**文件夹**或一个 .mp4 → **没有**「设为壁纸」这一项
16. 进文件区 / 相册区 / 应用区 → 壁纸**都在**(不是只有主页有)
17. 登出 → 登录页是主题渐变(不是壁纸);重新登录 → 壁纸回来

---

## Self-Review

**Spec 覆盖核对**

| spec 小节 | 覆盖任务 |
|---|---|
| §2.1 CSS 图层(含坑 A 简写、坑 B 顺序) | T2(含位置守卫 + 变异验证) |
| §2.2 `--wallpaper-scrim` 两套主题 | T2 |
| §2.3 数据模型(id / path / stamp) | T1 |
| §2.4 本地缓存 + mount 前应用 | T1(缓存)+ T2(接线) |
| §3 后端端点与 `unwrap` | T3 |
| §4.1 四个入口 | T7(设置)· T8(顶栏)· T9(桌面)· T10(文件区) |
| §4.2 弹窗挂 App.vue / 不用 ui/Dialog / async chunk | T5(自绘)+ T7(挂载 + async + 首屏体积核对) |
| §4.3 实时预览 + 回滚含主题 | T4(store + 变异验证)+ T5(UI) |
| §4.4 文件区门控 + 10MB 失败可读 | T10 |
| §4.5 NasImagePicker 复用与 emit 扩展 | T6 |
| §4.6 内置图原样拷贝 | T1 |
| §5 共享包两方法 + 注释改写 | T3 |
| §6 测试与守卫 | 各任务内 + T11 全量门 |
| §7 移植纪律登记 | T1(SERVER_URL/parseUrl)· T4(无 catch)· T3(simple-uploader)· T5(不做预览卡)· T9(showBackground 不移植) |
| §8 三个判断 + 已知限制 | T4(10MB)· T7(async chunk + 全应用)· T11(限制写进 roadmap) |
| §9 不做清单 | T9 Step 4 明确不给 MobileHome 加 |

**执行时需就地取值 / 就地对齐的三处(不是占位符,都给了取值命令或既有范式)**

1. T3 三个错误码数值需从 `NimoOS-Common/model/common_err/` grep 真值填入,命令已给;断言钉的是 `message`,数值只为让 `it.each` 三行可区分。
2. T10 Step 5 的「进入快照态」写法复用 `FileContextMenu.test.ts` 既有 helper,不要新造。
3. T9 的 `display: contents` + `closest` 在 jsdom 下若行为异常,已给替代接法(改绑在 trigger 上、去掉包裹 div)。

**类型一致性核对**:`WallpaperRecord` / `BuiltinId` / `UserImageResult` 三个类型在 T1/T3/T4/T5/T6 中签名一致;store action 名(`preview` / `beginPreview` / `cancelPreview` / `commit` / `load` / `uploadAndPreview` / `setFromNasPath` / `openDialog` / `closeDialog`)在 T4 定义、T5/T6/T7/T8/T9/T10 引用,无别名漂移;`canBeWallpaper` 只在 T10 内部。
