import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8')

// Same fixture convention as settingsStyles.test.ts: strip comments before
// asserting, so a deleted rule whose class name survives in a comment cannot
// satisfy a `toContain` check.
function stripComments(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
}

describe('agent-styles.scss', () => {
  const css = stripComments(read('./agent-styles.scss'))

  // 2026-08-10 user report: buttons on /ai/settings rendered as "huge text in
  // tiny buttons". Root cause: the SettingsPage root carries BOTH `agent-app`
  // (token scope) and `set-app` (layout). The top-level button element reset in
  // this file compiles to `.agent-app button` (0,1,1) and overrides the flat
  // single-class button styles (0,1,0) in settings-styles.scss / sk-shared.scss,
  // stripping their padding/background/border. In Vue2 the two pages had
  // separate roots, so the reset never reached the settings page — the leak is
  // an artifact of stacking both classes on one root during the migration.
  // Fix: scope the reset with `:where(:not(.set-app))`. `:where()` adds zero
  // specificity, so the compiled selector stays at (0,1,1) and the Agent page
  // (root has only `agent-app`) is unaffected.
  it('button reset must exclude the settings page via :where(:not(.set-app)) (dual-class root leak guard)', () => {
    expect(css).toContain('&:where(:not(.set-app)) button')
  })

  it('button reset must not regress to a bare top-level nested `button {`', () => {
    // The top-level reset sits at 2-space indent; locally nested buttons like
    // `.term-foot button` are at 4+ spaces and are not matched.
    expect(css).not.toMatch(/^ {2}button\s*\{/m)
  })

  it('reset declarations must be kept (padding/border/background zeroing still applies on the Agent page)', () => {
    const at = css.indexOf('&:where(:not(.set-app)) button')
    if (at < 0) return // first test already fails; avoid duplicate noise
    const body = css.slice(at, css.indexOf('}', at))
    expect(body).toContain('padding: 0')
    expect(body).toContain('border: 0')
    expect(body).toContain('background: transparent')
  })
})
