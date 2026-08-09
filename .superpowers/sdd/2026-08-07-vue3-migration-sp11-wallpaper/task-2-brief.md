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

