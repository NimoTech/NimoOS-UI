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

  it('paints behind the app content, not on top of it', () => {
    // body::after is `position: fixed; z-index: 0` (the shared rule earlier in this
    // file), while #app is a plain non-positioned block. Per CSS painting order, a
    // positioned z-index:0 element paints ABOVE all non-positioned content -- so
    // without a negative z-index here, the scrim fogs the whole UI (cards, buttons,
    // text) instead of just the wallpaper photo underneath it. jsdom cannot compute
    // paint order, so this guard is deliberately structural: pin the declaration
    // that makes the difference, not the visual result.
    const rule = /:root\[data-wallpaper\]\s+body::after\s*\{([^}]*)\}/.exec(CSS)?.[1]
    expect(rule, ':root[data-wallpaper] body::after block must exist').toBeTruthy()
    expect(rule as string).toMatch(/background\s*:\s*var\(--wallpaper-scrim\)/)
    expect(rule as string).toMatch(/z-index\s*:\s*-\d/)
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
