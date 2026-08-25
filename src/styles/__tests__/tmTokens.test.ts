// Guards the Time Machine (Files snapshot browser) design tokens defined in theme.css.
// Owner ruling: Time Machine looks the same in dark and light themes, so every --tm-* token
// introduced here (unlike most theme.css tokens) must carry the SAME literal value in both
// the dark :root block and the :root[data-theme="light"] block.
//
// vitest returns an empty string for CSS `?raw` imports (CSS goes through the side-effect
// module pipeline, not the raw-text one) -- theme.css must be read with node:fs instead. Same
// pitfall already documented in src/styles/theme.sp9.test.ts.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const css = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../theme.css'),
  'utf8',
)

// theme.css has exactly one dark :root { } block and one :root[data-theme="light"] { } block
// (unlike theme.sp9.css's guard, there is only one occurrence of each selector to find).
//
// Braces are matched by depth, with comments stripped first: theme.css's :root block contains
// header comments that themselves mention OTHER selectors' braces (e.g. ".photos-root { }"),
// and a naive "first '}' after the opening brace" scan (theme.sp9.test.ts's approach, safe there
// because theme.sp9.css has no such comments) stops at that in-comment '}' instead of the
// block's real end.
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
}
const codeOnly = stripComments(css)

function blockOf(selector: string): string {
  const i = codeOnly.indexOf(selector)
  expect(i, `selector not found: ${selector}`).toBeGreaterThanOrEqual(0)
  const open = codeOnly.indexOf('{', i)
  let depth = 1
  let pos = open + 1
  while (depth > 0) {
    const nextOpen = codeOnly.indexOf('{', pos)
    const nextClose = codeOnly.indexOf('}', pos)
    expect(nextClose, `unbalanced braces after selector: ${selector}`).toBeGreaterThanOrEqual(0)
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      pos = nextOpen + 1
    } else {
      depth -= 1
      pos = nextClose + 1
    }
  }
  return codeOnly.slice(open + 1, pos - 1)
}

const dark = blockOf(':root {')
const light = blockOf(':root[data-theme="light"] {')

function valueIn(block: string, name: string): string {
  const m = block.match(new RegExp(`${name}:\\s*([^;]+);`))
  expect(m, `${name} missing`).toBeTruthy()
  return m![1].trim()
}

function countIn(block: string, name: string): number {
  return (block.match(new RegExp(`${name}:`, 'g')) ?? []).length
}

// Task 1's full token set -- every later Time Machine component task is only allowed to
// reference these names (see task-1-brief.md's Interfaces section).
const TOKENS = [
  '--tm-glass-bg',
  '--tm-glass-blur',
  '--tm-rail-text',
  '--tm-rail-text-dim',
  '--tm-accent',
  '--tm-accent-hover',
  '--tm-accent-glow',
  '--tm-bar-scrim',
  '--tm-panel-bg',
  '--tm-panel-bg-solid',
  '--tm-panel-border',
  '--tm-hairline',
  '--tm-text',
  '--tm-text-dim',
  '--tm-ghost-border',
  '--tm-ghost-hover-bg',
  '--tm-ghost-border-hover',
  '--tm-control-radius',
  '--tm-panel-blur',
  // Task 8 fix round: restored per controller ruling (pixel 1:1 to Vue2's own `.tm-tick:hover`
  // and `.tm-tick__badge` literal colors -- see theme.css's own comment on these two for the
  // exact Vue2 CSS rules each one pins).
  '--tm-rail-tick-hover',
  '--tm-rail-tick-manual',
]

describe('Time Machine --tm-* tokens (Task 1)', () => {
  it('each token appears exactly once in the dark block and once in the light block', () => {
    for (const t of TOKENS) {
      expect(countIn(dark, t), `${t} should appear exactly once in :root`).toBe(1)
      expect(countIn(light, t), `${t} should appear exactly once in :root[data-theme="light"]`).toBe(1)
    }
  })

  it('defines every --tm-* token identically in both themes (owner ruling: same look in both themes)', () => {
    for (const t of TOKENS) {
      expect(valueIn(dark, t), `${t} differs between dark and light`).toBe(valueIn(light, t))
    }
  })

  it('pins the exact Vue2 values for the load-bearing tokens', () => {
    expect(valueIn(dark, '--tm-glass-bg')).toBe('rgba(8, 10, 22, 0.35)')
    expect(valueIn(dark, '--tm-glass-blur')).toBe('blur(24px) saturate(1.05)')
    expect(valueIn(dark, '--tm-accent')).toBe('#7c3aed')
    expect(valueIn(dark, '--tm-accent-hover')).toBe('#6d28d9')
    expect(valueIn(dark, '--tm-accent-glow')).toBe('rgba(124, 58, 237, 0.9)')
    expect(valueIn(dark, '--tm-bar-scrim')).toBe(
      'linear-gradient(to top, rgba(6, 9, 26, 0.75), rgba(6, 9, 26, 0.25), transparent)',
    )
    expect(valueIn(dark, '--tm-panel-bg')).toBe('rgba(255, 255, 255, 0.9)')
    expect(valueIn(dark, '--tm-panel-bg-solid')).toBe('#ffffff')
    expect(valueIn(dark, '--tm-panel-border')).toBe('rgba(0, 0, 0, 0.06)')
    expect(valueIn(dark, '--tm-hairline')).toBe('rgba(0, 0, 0, 0.06)')
    expect(valueIn(dark, '--tm-text')).toBe('#1f2430')
    expect(valueIn(dark, '--tm-text-dim')).toBe('#6b7280')
    expect(valueIn(dark, '--tm-ghost-border')).toBe('rgba(0, 0, 0, 0.15)')
    expect(valueIn(dark, '--tm-ghost-hover-bg')).toBe('rgba(0, 0, 0, 0.05)')
    expect(valueIn(dark, '--tm-ghost-border-hover')).toBe('rgba(0, 0, 0, 0.25)')
    expect(valueIn(dark, '--tm-control-radius')).toBe('10px')
    expect(valueIn(dark, '--tm-panel-blur')).toBe('blur(20px) saturate(1.2)')
    expect(valueIn(dark, '--tm-rail-tick-hover')).toBe('#ffffff')
    expect(valueIn(dark, '--tm-rail-tick-manual')).toBe('#f6c760')
  })
})
