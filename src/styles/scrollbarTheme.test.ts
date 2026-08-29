// Scrollbar theme guard (regression test for the 2026-08-13 light-theme
// invisible-scrollbar bug).
//
// Root cause: the top of theme.css had `* { scrollbar-color: <literal thumb colour> transparent }`,
// which put the thumb colour **explicitly** on every single element; the
// light-theme override was only written on the single `:root[data-theme="light"]`
// element. `scrollbar-color` is inheritable, but an element's own explicit
// declaration always wins over inheriting from root, so every inner scroll
// container (the file list, etc.) other than the outermost page element kept
// the non-light-theme thumb colour against a light background. On top of
// that, once an element sets `scrollbar-color`, Chrome 121+ ignores its
// `::-webkit-scrollbar-*` pseudo-elements entirely, so the webkit light-theme
// rule block at lines 561-564 never took effect at all.
//
// Correct shape: the thumb colour is collapsed into tokens
// (--scrollbar-thumb / --scrollbar-thumb-hover), given a value in both theme
// blocks; the `*` rule references var(--…) — custom properties inherit
// normally, so every element resolves to whatever the current theme's value is.
//
// This guard only looks at source text (a known limitation — see
// newui-css-invisible-failure-guards): it enforces the two mechanically
// checkable conventions "declarations must be tokenized" and "the token must
// have a value in both theme blocks". Rendering-level verification against
// real browser computed style still needs a final pass before shipping.
/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const themeCss = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'theme.css'),
  'utf8',
)

// Extract the declaration block for a selector (first match), balancing braces.
function blockOf(selectorRe: RegExp): string {
  const m = selectorRe.exec(themeCss)
  if (!m) return ''
  const start = themeCss.indexOf('{', m.index)
  let depth = 0
  for (let i = start; i < themeCss.length; i++) {
    if (themeCss[i] === '{') depth++
    else if (themeCss[i] === '}') {
      depth--
      if (depth === 0) return themeCss.slice(start + 1, i)
    }
  }
  return ''
}

describe('scrollbar thumb colour must be tokenized (light-theme invisible-scrollbar regression)', () => {
  it('every scrollbar-color declaration references var(--scrollbar-thumb), never a literal', () => {
    const decls = [...themeCss.matchAll(/scrollbar-color\s*:\s*([^;]+);/g)].map((m) => m[1].trim())
    expect(decls.length, 'theme.css should have a scrollbar-color declaration').toBeGreaterThan(0)
    for (const v of decls) {
      expect(v, `scrollbar-color's value must go through a token (so it inherits to every element) — it must not hardcode a single-theme literal: ${v}`)
        .toMatch(/var\(--scrollbar-thumb\)/)
    }
  })

  it('every ::-webkit-scrollbar-thumb background references a --scrollbar-thumb token', () => {
    const re = /::-webkit-scrollbar-thumb[^{]*\{([^}]*)\}/g
    const blocks = [...themeCss.matchAll(re)].map((m) => m[1])
    expect(blocks.length, 'theme.css should have a ::-webkit-scrollbar-thumb rule').toBeGreaterThan(0)
    for (const b of blocks) {
      const bg = /background\s*:\s*([^;]+);/.exec(b)?.[1].trim() ?? ''
      expect(bg, `::-webkit-scrollbar-thumb's background must go through a token: ${bg}`)
        .toMatch(/var\(--scrollbar-thumb(-hover)?\)/)
    }
  })

  it('--scrollbar-thumb / --scrollbar-thumb-hover are defined in both theme blocks', () => {
    const blue = blockOf(/(^|\n):root\s*\{/)
    const light = blockOf(/(^|\n):root\[data-theme="light"\]\s*\{/)
    for (const token of ['--scrollbar-thumb:', '--scrollbar-thumb-hover:']) {
      expect(blue, `the :root (default theme) block is missing ${token}`).toContain(token)
      expect(light, `the :root[data-theme="light"] block is missing ${token}`).toContain(token)
    }
  })
})
