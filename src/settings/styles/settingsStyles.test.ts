/// <reference types="node" />
// Source-text guard for settings.css.
// ⚠️ Must read the file with node:fs -- `import.meta.glob(..., { query: '?raw' })` always
//    returns an empty string for .css under vitest (CSS goes through the side-effect
//    module pipeline), which would make every assertion here a no-op (color-guard.test.ts
//    has the same comment at the top).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const CSS = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'settings.css'),
  'utf8',
)

// Strip comments per CSS semantics (the first */ closes the block) before asserting --
// otherwise example text inside comments would be treated as a rule.
const CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

describe('the native <select> popup list must stay readable (2026-08-05 P8 acceptance: default theme text and background nearly matched)', () => {
  // Incident: `.set-select` sets its own `background: var(--chip-bg)` (a translucent
  // glass tint, 8%-26% opacity, on the light end of the palette).
  // Once the author gives <select> an explicit background, Chrome carries it over to the
  // **popup list** as well -- that translucent tint layered on the popup's own light-end
  // default background ends up nearly solid at that same light end, while `color` uses
  // `--fg`, which sits near that same end too ⇒ text and background become practically
  // indistinguishable, and the whole list is unreadable.
  // The root's `color-scheme: dark` cannot rescue it (the author-specified background wins).
  it('explicitly sets a background and text color for option/optgroup', () => {
    const rule = CODE.match(/\.set-select\s+option[^{]*\{[^}]*\}/)
    expect(rule, 'cannot find the .set-select option rule -- the popup list would fall back to the browser default background').not.toBeNull()
    expect(rule![0]).toMatch(/background-color:\s*var\(--[a-z0-9-]+\)/)
    expect(rule![0]).toMatch(/\bcolor:\s*var\(--[a-z0-9-]+\)/)
  })

  it('optgroup is covered together with option (the group heading would suffer the same unreadable overlap)', () => {
    const rule = CODE.match(/\.set-select\s+option[^{]*\{[^}]*\}/)
    expect(rule![0]).toContain('optgroup')
  })

  // Native option only honors a **solid** background-color, it does not render gradients --
  // so it can't just reuse --chip-bg / --card-bg / --popup-bg / --panel-bg-solid for
  // convenience (they're all gradients).
  it('the background token used is solid in both themes, not a gradient', () => {
    const rule = CODE.match(/\.set-select\s+option[^{]*\{[^}]*\}/)![0]
    const token = rule.match(/background-color:\s*var\((--[a-z0-9-]+)\)/)![1]
    const sp9 = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../styles/theme.sp9.css'),
      'utf8',
    )
    const defs = [...sp9.matchAll(new RegExp(`${token}:\\s*([^;]+);`, 'g'))].map((m) => m[1].trim())
    expect(defs.length, `${token} must have a value in both the :root and :root[data-theme='light'] blocks`).toBe(2)
    for (const v of defs) {
      expect(v, `${token} = ${v} -- native option does not render gradients, it must be a solid color`).not.toMatch(/gradient|rgba?\([^)]*,\s*0?\.\d+\s*\)/)
    }
  })
})
