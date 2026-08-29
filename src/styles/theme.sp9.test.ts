// Guards a New-UI hard constraint (docs/THEMING.md):
// every token in theme.sp9.css must have a value in both :root and :root[data-theme="light"].
// theme.css itself has no such guard (for historical reasons); the shard is a new file, so the
// guard is in place from day one.
/// <reference types="node" />
// Reference node types only in this file, without touching tsconfig's global types array (see
// color-guard.test.ts for the reasoning).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

// Must be read with node:fs: `?raw` is always an empty string for .css under vitest (CSS goes
// through the side-effect module pipeline), so neither a static import nor import.meta.glob can
// get its content — the same pitfall fixed in color-guard.test.ts.
const src = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'theme.sp9.css'),
  'utf8',
)

function bodyOf(selector: string): string {
  const i = src.indexOf(selector)
  expect(i, `selector not found: ${selector}`).toBeGreaterThanOrEqual(0)
  const open = src.indexOf('{', i)
  const close = src.indexOf('}', open)
  return src.slice(open + 1, close)
}

function tokensOf(selector: string): string[] {
  return [...bodyOf(selector).matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]).sort()
}

// name -> declared value (leading/trailing whitespace trimmed, trailing semicolon excluded).
// Used to compare whether the same token takes the same literal value in both theme blocks.
function tokenMapOf(selector: string): Record<string, string> {
  const body = bodyOf(selector)
  const map: Record<string, string> = {}
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    map[m[1]] = m[2].trim()
  }
  return map
}

describe('theme.sp9.css tokens are complete across both themes', () => {
  it(':root and :root[data-theme="light"] have the same set of token names', () => {
    expect(tokensOf(":root[data-theme='light']")).toEqual(tokensOf(':root {'))
  })

  it('at least one token is defined (wired up and effective, not an empty file)', () => {
    expect(tokensOf(':root {').length).toBeGreaterThan(0)
  })
})

describe('P6 KVM dialog/snapshot tokens are complete (Task 0 baseline of 23 + Task 11 wrap-up addition of 1 = 24)', () => {
  const P6_TOKENS = [
    '--kvm-modal-bg', '--kvm-modal-fg', '--kvm-field-bg', '--kvm-field-border',
    '--kvm-field-elev', '--kvm-accent-light', '--kvm-accent-hover', '--kvm-accent-hover-alt',
    '--kvm-accent-ring', '--kvm-accent-faint', '--kvm-accent-muted', '--kvm-ok-hover',
    '--kvm-ok-faint', '--kvm-overlay-strong', '--kvm-shadow-mid', '--kvm-snapshot-bg',
    '--kvm-snapshot-hover', '--kvm-snapshot-desc-fg', '--kvm-snapshot-date-fg',
    '--kvm-restore-bg', '--kvm-restore-bg-hover', '--kvm-restore-disabled-bg',
    '--kvm-delete-bg-hover',
    // Task 11 wrap-up addition (disposition of review Minor b): .cv-snapshot-name's text-color
    // semantic token, see theme.sp9.css's definition site and the comment on kvm.css's
    // .cv-snapshot-name rule for details.
    '--kvm-snapshot-name-fg',
  ]

  it(`this round's 24 tokens are all declared in :root (actual count: ${P6_TOKENS.length})`, () => {
    expect(P6_TOKENS.length).toBe(24)
    const root = tokensOf(':root {')
    const missing = P6_TOKENS.filter((t) => !root.includes(t))
    expect(missing, `:root is missing tokens: ${missing.join(', ')}`).toEqual([])
  })

  it("this round's 23 tokens are all declared in :root[data-theme=\"light\"]", () => {
    const light = tokensOf(":root[data-theme='light']")
    const missing = P6_TOKENS.filter((t) => !light.includes(t))
    expect(missing, `the light block is missing tokens: ${missing.join(', ')}`).toEqual([])
  })
})

describe('--kvm-* tokens must take the same value in both themes (P5 hard constraint: the KVM area is fixed dark and does not follow the global theme)', () => {
  it('every token with the --kvm- prefix has the same literal value in :root and :root[data-theme="light"], one by one', () => {
    const root = tokenMapOf(':root {')
    const light = tokenMapOf(":root[data-theme='light']")
    // Only compare the --kvm- prefix; tokens without that prefix (e.g. --set-*) are the settings
    // area's semantic tokens, which are supposed to take different values across themes and are
    // not governed by this assertion.
    const kvmKeys = Object.keys(root).filter((k) => k.startsWith('--kvm-'))
    expect(kvmKeys.length, 'found no --kvm- tokens at all — the guard itself may be broken').toBeGreaterThan(0)
    const mismatched = kvmKeys.filter((k) => root[k] !== light[k])
    expect(
      mismatched,
      `the following --kvm-* tokens take different values across the two theme blocks (violates the fixed-dark constraint):\n${mismatched
        .map((k) => `  ${k}: root=${root[k]} light=${light[k]}`)
        .join('\n')}`,
    ).toEqual([])
  })
})
