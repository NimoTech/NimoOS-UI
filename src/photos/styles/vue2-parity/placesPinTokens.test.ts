// Fix-5 (owner acceptance, 2026-08-17): P6a formally overturned. This file used to guard Review
// I3's fix (Plan E final-fix) — which moved the seven `--pin-*` geo-pin tokens from the global
// `src/styles/theme.css` into this file's own `.photos-root`/`.photos-root.is-light` blocks so
// pins would follow Photos' *private* theme instead of the app's *global* one. That relocation
// was correct, but the VALUES it carried over (blue, copied byte-for-byte from theme.css) were
// themselves a standing deviation from Vue2 — flagged at the time as "P6a", left for the owner to
// judge at acceptance. The owner has now overturned it: Vue2 paints map pins with the PURPLE
// `--accent`/`--accent-rgb` family directly (photos-places.scss:367-437), theme-constant with NO
// light-mode override at all (grep-verified against the Vue 2 panel's real source — confirmed before
// assuming). PlacesMap.vue's own `<style scoped>` rules that consumed the seven `--pin-*` tokens
// (and so shadowed parity's already-correct, byte-transcribed purple rules at a cascade tie) have
// been deleted/trimmed — see that file's own Fix-5 comment. With that done, the seven tokens have
// ZERO remaining consumers anywhere in this repo, so they were removed entirely rather than kept
// dormant (grep-confirmed: only this file and photos.scss's own removal-comment still mention
// their names in prose).
//
// This test file is rewritten (not deleted) to guard the new end state honestly: the seven tokens
// are GONE from photos.scss (both theme blocks) and from theme.css (unchanged from before — they
// never lived there again after Review I3's original migration), and parity's own geo-pin rules
// read the purple `--accent`/`--accent-rgb` family directly, with no `.photos-root.is-light`
// override at all (matching Vue2's theme-constant behavior). Same raw-source-read idiom as before
// (see gridMetricsCssParity.test.ts) — simple and honest, per the brief.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { extractStyleBlock } from '../../components/__tests__/cssCascade'

const PHOTOS_SCSS = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')
const PLACES_SCSS = readFileSync('src/photos/styles/vue2-parity/photos-places.scss', 'utf8')
const THEME_CSS = readFileSync('src/styles/theme.css', 'utf8')
// `extractStyleBlock` strips CSS comments -- this file's own Fix-5 prose comments (in PlacesMap.vue's
// `<style scoped>`) quote the OLD `var(--pin-*)` references verbatim to document what was removed,
// which would otherwise false-positive a naive whole-file text scan for those exact strings.
const PLACES_MAP_STYLE = extractStyleBlock(readFileSync('src/photos/components/PlacesMap.vue', 'utf8'))

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
// (brace-depth matched, so nested `{}` inside the block can't prematurely close it).
function ruleBody(src: string, header: string): string {
  const start = src.indexOf(header)
  expect(start, `could not find "${header}" in source`).toBeGreaterThanOrEqual(0)
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

describe('Fix-5: geo-pin tokens removed, parity purple governs directly (P6a overturned)', () => {
  it('none of the seven --pin-* tokens are DEFINED anywhere in photos.scss any more', () => {
    for (const name of PIN_TOKENS) {
      expect(PHOTOS_SCSS, `${name} should no longer be defined in photos.scss`).not.toMatch(new RegExp(`${name}:\\s`))
    }
  })

  it('theme.css still does not define any --pin-* token (unchanged from before — never migrated back)', () => {
    for (const name of PIN_TOKENS) {
      expect(THEME_CSS, `${name} should not be defined in theme.css`).not.toMatch(new RegExp(`${name}:`))
    }
  })

  it('PlacesMap.vue no longer CONSUMES any --pin-* token (its local color rules were deleted/trimmed)', () => {
    for (const name of PIN_TOKENS) {
      expect(PLACES_MAP_STYLE, `PlacesMap.vue should no longer reference var(${name})`).not.toMatch(new RegExp(`var\\(${name}`))
    }
  })

  it('parity\'s base .geo-pin rules use the purple rgba(var(--accent-rgb), …)/var(--accent) family directly, byte-exact to Vue2', () => {
    const hoverBody = ruleBody(PLACES_SCSS, '.geo-pin:hover {')
    expect(hoverBody).toMatch(/filter:\s*drop-shadow\(0 0 14px rgba\(var\(--accent-rgb\), 0\.7\)\)/)

    const bgBody = ruleBody(PLACES_SCSS, '.geo-pin .pin-bg {')
    expect(bgBody).toMatch(/fill:\s*rgba\(var\(--accent-rgb\), 0\.16\)/)
    expect(bgBody).toMatch(/stroke:\s*rgba\(var\(--accent-rgb\), 0\.55\)/)

    const activeBody = ruleBody(PLACES_SCSS, '.geo-pin.is-active .pin-bg {')
    expect(activeBody).toMatch(/fill:\s*rgba\(var\(--accent-rgb\), 0\.30\)/)
    expect(activeBody).toMatch(/stroke:\s*var\(--accent\)/)

    const clusterBody = ruleBody(PLACES_SCSS, '.geo-pin.is-cluster .pin-bg {')
    expect(clusterBody).toMatch(/fill:\s*rgba\(var\(--accent-rgb\), 0\.30\)/)
    // Vue2's own cluster stroke is a literal lavender, not an --accent-rgb expression — matches
    // photos-places.scss:404 byte-exact (not a token at all, same as Vue2).
    expect(clusterBody).toMatch(/stroke:\s*rgba\(196,\s*184,\s*255,\s*0\.85\)/)

    const clusterHoverBody = ruleBody(PLACES_SCSS, '.geo-pin.is-cluster:hover .pin-bg {')
    expect(clusterHoverBody).toMatch(/fill:\s*rgba\(var\(--accent-rgb\), 0\.42\)/)

    const pulseBody = ruleBody(PLACES_SCSS, '.geo-pin .pin-pulse {')
    expect(pulseBody).toMatch(/fill:\s*rgba\(var\(--accent-rgb\), 0\.25\)/)
  })

  it('none of these purple pin rules are re-scoped under .photos-root.is-light — Vue2 has no light-mode override for pins at all', () => {
    // The `.photos-root.is-light { … }` block in photos.scss (not photos-places.scss) is the
    // one and only place Photos' private light-theme overrides live; asserting it, not
    // photos-places.scss, is the right target file for "no light-specific pin override exists".
    const lightBlock = ruleBody(PHOTOS_SCSS, '.photos-root.is-light {')
    expect(lightBlock).not.toMatch(/\.geo-pin/)
    for (const name of PIN_TOKENS) {
      expect(lightBlock).not.toMatch(new RegExp(`${name}:`))
    }
  })
})
