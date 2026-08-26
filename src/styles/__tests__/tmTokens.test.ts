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
  // Final review (C2): the rail's resting main/sub tick colors, replacing the deleted
  // colleague-era --tm-rail/--tm-rail-sub tokens (whose light-block values were dark ink,
  // near-invisible against the always-dark TM glass backdrop). --tm-rail-tick is Vue2's own
  // exact resting `.tm-tick__line` literal; --tm-rail-tick-sub has no Vue2 counterpart (Vue2
  // renders no sub-ticks) and is derived proportionally from it -- see theme.css's own comment
  // on these two for the full account.
  '--tm-rail-tick',
  '--tm-rail-tick-sub',
  // Task 9 (stepper + bottom bar): pixel-pinned to Vue2's `.tm-stepper__btn`/`.tm-stepper__time`/
  // `.tm-bottom-bar__exit` literal colors -- see theme.css's own comment on these six for the full
  // per-token Vue2 provenance. `.tm-bottom-bar__restore` reuses --tm-accent/--tm-accent-hover
  // above (already approved), so no new token was needed for it.
  '--tm-stepper-btn-bg',
  '--tm-stepper-btn-hover-bg',
  '--tm-chrome-text',
  '--tm-stepper-time-shadow',
  '--tm-bottom-bar-exit-bg',
  '--tm-bottom-bar-exit-hover-bg',
  // Task 10 (entry pill): pixel-pinned to Vue2's Buefy `is-success` entry button -- see
  // theme.css's own comment on these three for the full color-pipeline derivation.
  '--tm-entry-bg',
  '--tm-entry-fg',
  '--tm-entry-hover-bg',
  // Task 11 (SnapshotSettingsModal): pixel-pinned to Vue2's own $tm-chip-bg / paused-row+preop
  // amber / history-dot / danger-button literal SCSS values -- see theme.css's own comment on
  // these eight tokens for the full per-token Vue2 provenance.
  '--tm-chip-bg',
  '--tm-warn-text',
  '--tm-warn-bg',
  '--tm-warn-dot',
  '--tm-dot-auto',
  '--tm-danger',
  '--tm-danger-hover',
  '--tm-switch-off-bg',
  '--tm-panel-shadow',
  '--tm-switch-thumb-shadow',
  '--tm-placeholder-text',
  // Final review (Important 4, SnapshotActionBar rebuild): pixel-pinned to Vue2's own
  // `.operation-toolbar`/`.toolbar-item:hover` literal SCSS colors -- see theme.css's own
  // comment on these two for the full provenance.
  '--tm-action-bar-bg',
  '--tm-action-bar-item-hover-bg',
  // Fix wave A2 (audit-stage.md #5/#6/#4/#10/#12): pixel-pinned to Vue2's own single-layer
  // `.tm-stage__depth-strip`/`.tm-fwin--active` box-shadow, `.tm-stage__depth-strip__dim`'s pure
  // black, `.tm-stage__gear`'s resting color, and `.tm-tick-skeleton`'s own distinct alpha -- see
  // theme.css's own comment on these five for the full per-token Vue2 provenance.
  '--tm-depth-shadow',
  '--tm-fwin-shadow',
  '--tm-depth-dim',
  '--tm-gear-text',
  '--tm-rail-skeleton',
  '--tm-rail-text-shadow',
  '--tm-empty-title',
  '--tm-empty-sub',
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
    expect(valueIn(dark, '--tm-rail-tick')).toBe('rgba(255, 255, 255, 0.4)')
    expect(valueIn(dark, '--tm-rail-tick-sub')).toBe('rgba(255, 255, 255, 0.2)')
    expect(valueIn(dark, '--tm-stepper-btn-bg')).toBe('rgba(255, 255, 255, 0.16)')
    expect(valueIn(dark, '--tm-stepper-btn-hover-bg')).toBe('rgba(255, 255, 255, 0.28)')
    expect(valueIn(dark, '--tm-chrome-text')).toBe('#ffffff')
    expect(valueIn(dark, '--tm-stepper-time-shadow')).toBe('0 1px 6px rgba(0, 0, 0, 0.65)')
    expect(valueIn(dark, '--tm-bottom-bar-exit-bg')).toBe('rgba(255, 255, 255, 0.14)')
    expect(valueIn(dark, '--tm-bottom-bar-exit-hover-bg')).toBe('rgba(255, 255, 255, 0.24)')
    expect(valueIn(dark, '--tm-entry-bg')).toBe('#28c322')
    expect(valueIn(dark, '--tm-entry-fg')).toBe('#ffffff')
    expect(valueIn(dark, '--tm-entry-hover-bg')).toBe('#26b821')
    expect(valueIn(dark, '--tm-chip-bg')).toBe('rgba(0, 0, 0, 0.05)')
    expect(valueIn(dark, '--tm-warn-text')).toBe('#92400e')
    expect(valueIn(dark, '--tm-warn-bg')).toBe('rgba(245, 158, 11, 0.14)')
    expect(valueIn(dark, '--tm-warn-dot')).toBe('#f59e0b')
    expect(valueIn(dark, '--tm-dot-auto')).toBe('#9ca3af')
    expect(valueIn(dark, '--tm-danger')).toBe('#dc2626')
    expect(valueIn(dark, '--tm-danger-hover')).toBe('#b91c1c')
    expect(valueIn(dark, '--tm-switch-off-bg')).toBe('rgba(0, 0, 0, 0.18)')
    expect(valueIn(dark, '--tm-panel-shadow')).toBe('0 24px 80px rgba(15, 20, 40, 0.28)')
    expect(valueIn(dark, '--tm-switch-thumb-shadow')).toBe('0 1px 3px rgba(0, 0, 0, 0.25)')
    expect(valueIn(dark, '--tm-placeholder-text')).toBe('#9ca3af')
    expect(valueIn(dark, '--tm-action-bar-bg')).toBe('rgb(49, 49, 54)')
    expect(valueIn(dark, '--tm-action-bar-item-hover-bg')).toBe('rgb(86, 86, 90)')
    expect(valueIn(dark, '--tm-depth-shadow')).toBe('0 6px 18px rgba(5, 8, 30, 0.3)')
    expect(valueIn(dark, '--tm-fwin-shadow')).toBe('0 18px 50px rgba(5, 8, 30, 0.45)')
    expect(valueIn(dark, '--tm-depth-dim')).toBe('#000')
    expect(valueIn(dark, '--tm-gear-text')).toBe('rgba(241, 245, 249, 0.75)')
    expect(valueIn(dark, '--tm-rail-skeleton')).toBe('rgba(255, 255, 255, 0.28)')
    expect(valueIn(dark, '--tm-rail-text-shadow')).toBe('0 1px 6px rgba(0, 0, 0, 0.55)')
    expect(valueIn(dark, '--tm-empty-title')).toBe('#f1f5f9')
    expect(valueIn(dark, '--tm-empty-sub')).toBe('rgba(241, 245, 249, 0.7)')
  })
})
