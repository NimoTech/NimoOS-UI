// Review I3 (Plan E final-fix): the seven `--pin-*` geo-pin tokens used to live ONLY in the
// global `src/styles/theme.css`, so pins followed this app's *global* light/dark theme while the
// map canvas/dots they sit on top of followed Photos' own *private* theme (`.photos-root`/
// `.photos-root.is-light`) — a dual-signal split, and "global light + photos-private dark" is the
// DEFAULT combination for a light-app user (Photos defaults to dark). The fix moved the seven
// token definitions into this file's own `.photos-root`/`.photos-root.is-light` blocks (see
// photos.scss's own comment on them) and deleted them from theme.css.
//
// This test follows the repo's established idiom for guarding parity-stylesheet facts (see
// gridMetricsCssParity.test.ts): read the raw source text and assert against it directly, rather
// than attempting to resolve CSS custom properties through jsdom's cascade (which
// placesMapPerf.test.ts's own var-flow assertions deliberately avoid too, reading imperatively
// written `svg.style` values instead of computed style) — simple and honest, per the brief.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const PHOTOS_SCSS = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
const THEME_CSS = readFileSync('src/styles/theme.css', 'utf8')

const PIN_TOKENS = [
  '--pin-bg',
  '--pin-stroke',
  '--pin-active-bg',
  '--pin-pulse',
  '--pin-cluster-hover-bg',
  '--pin-glow',
  '--pin-cluster-stroke',
] as const

// Extracts the `{ ... }` body of the first rule whose selector text starts with `header`
// (brace-depth matched, so nested `{}` inside the block — e.g. the `.lb-confirm` SCSS nesting
// elsewhere in this file — can't prematurely close it).
function ruleBody(src: string, header: string): string {
  const start = src.indexOf(header)
  expect(start, `could not find "${header}" in photos.scss`).toBeGreaterThanOrEqual(0)
  const braceStart = src.indexOf('{', start)
  let depth = 0
  let i = braceStart
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) { i++; break }
    }
  }
  return src.slice(braceStart, i)
}

function tokenValue(body: string, name: string): string {
  const re = new RegExp(`${name}:\\s*([^;]+);`)
  const m = re.exec(body)
  expect(m, `${name} not found in block`).toBeTruthy()
  return (m as RegExpExecArray)[1].trim()
}

describe('Review I3: geo-pin tokens live on the photos-private theme, not the global app theme', () => {
  // Both lookups are exact-substring searches for their own full selector text
  // (`.photos-root {` vs `.photos-root.is-light {`), so neither can accidentally match inside
  // the other's longer selector.
  const lightBlock = ruleBody(PHOTOS_SCSS, '.photos-root.is-light {')
  const darkBlock = ruleBody(PHOTOS_SCSS, '.photos-root {')

  it('all seven --pin-* tokens are defined in both .photos-root and .photos-root.is-light', () => {
    for (const name of PIN_TOKENS) {
      expect(darkBlock, `${name} missing from .photos-root`).toMatch(new RegExp(`${name}:`))
      expect(lightBlock, `${name} missing from .photos-root.is-light`).toMatch(new RegExp(`${name}:`))
    }
  })

  it('flipping the photos-private theme actually changes the effective --pin-bg value (not just present in both, genuinely different)', () => {
    const dark = tokenValue(darkBlock, '--pin-bg')
    const light = tokenValue(lightBlock, '--pin-bg')
    expect(dark).toBe('rgba(138, 180, 255, 0.16)')
    expect(light).toBe('rgba(59, 91, 219, 0.16)')
    expect(light).not.toBe(dark)
  })

  it('theme.css no longer defines any --pin-* token (migrated here so pins follow the photos-private theme, not the global app theme)', () => {
    for (const name of PIN_TOKENS) {
      expect(THEME_CSS, `${name} should no longer be defined in theme.css`).not.toMatch(new RegExp(`${name}:`))
    }
  })
})
