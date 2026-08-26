// Guards the `--purple-accent`/`--purple-accent-hover` pair (Files toolbar redesign, fix wave C
// re-review): a dedicated app-level purple accent for the "New" dropdown button and its
// dependents (select-all fill, view-capsule active half, dropdown-item hover tint) -- the owner
// approved this exact purple in the mockup (`--accent: #7c3aed` / `--accent-hover: #6d28d9`),
// distinct from BOTH this app's own generic blue `--accent` (other surfaces depend on that
// staying blue) AND Time Machine's own scoped `--tm-accent`/`--tm-accent-hover` (same literal
// hex, different subsystem -- see theme.css's own comment on `--purple-accent` for why reusing
// `--tm-accent` on a non-TM surface would blur that boundary). Theme-invariant by owner ruling:
// same purple in both themes, same convention `src/styles/__tests__/tmTokens.test.ts` already
// pins for `--tm-accent`.
//
// vitest returns an empty string for CSS `?raw` imports (CSS goes through the side-effect module
// pipeline, not the raw-text one) -- theme.css must be read with node:fs instead. Same pattern as
// tmTokens.test.ts / theme.sp9.test.ts.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const css = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../theme.css'),
  'utf8',
)

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

describe('--purple-accent / --purple-accent-hover / --on-purple-accent (Files "New" dropdown + dependents)', () => {
  it('is defined in both theme blocks with the owner-approved literal hex', () => {
    expect(valueIn(dark, '--purple-accent')).toBe('#7c3aed')
    expect(valueIn(dark, '--purple-accent-hover')).toBe('#6d28d9')
    expect(valueIn(dark, '--on-purple-accent')).toBe('#ffffff')
    expect(valueIn(light, '--purple-accent')).toBe('#7c3aed')
    expect(valueIn(light, '--purple-accent-hover')).toBe('#6d28d9')
    expect(valueIn(light, '--on-purple-accent')).toBe('#ffffff')
  })

  it('is theme-invariant: identical value in both theme blocks (owner ruling: same purple in both themes)', () => {
    expect(valueIn(dark, '--purple-accent')).toBe(valueIn(light, '--purple-accent'))
    expect(valueIn(dark, '--purple-accent-hover')).toBe(valueIn(light, '--purple-accent-hover'))
    expect(valueIn(dark, '--on-purple-accent')).toBe(valueIn(light, '--on-purple-accent'))
  })

  // Guards against silently drifting back onto --tm-accent (same hex, wrong subsystem) or the
  // generic --accent (wrong hue) in the consuming components -- a quick source-grep pin, not a
  // rendered-DOM assertion (color-guard.test.ts already forbids bare literals in those files).
  it('the Files "New" dropdown + content-area header + preview mirror consume --purple-accent, not --tm-accent or the generic --accent, for this specific affordance', () => {
    const read = (p: string) => readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), p), 'utf8')
    const newMenu = read('../../files/components/FilesNewMenu.vue')
    const filesVue = read('../../views/Files.vue')
    const preview = read('../../files/snapshot/SnapshotPreviewWindow.vue')

    expect(newMenu).toContain('var(--purple-accent)')
    expect(newMenu).toContain('var(--on-purple-accent)')
    expect(filesVue).toContain('var(--purple-accent)')
    expect(filesVue).toContain('var(--on-purple-accent)')
    expect(preview).toContain('var(--purple-accent)')
  })
})
