// Acceptance Fix-4 (owner ruling, screenshot-verified, Plans G+H):
//
// 1. Confirm CTAs are PURPLE in BOTH themes -- overrides Vue2's own literal colors:
//    - Favorites "Save as Album" dialog's Create-album button (`.fav-btn-primary`) was Vue2's
//      literal amber gradient (#FFD60A/#FFAA00) + dark text (#29240B) -- now this file's own
//      theme-invariant `--accent`/`--accent-hi`/`--accent-glow`/`--accent-soft` family, white text.
//    - Trash confirm modals' primary CTA (`.trash-btn-cta`, base/non-danger case -- covers the
//      restore-all confirm) was Vue2's literal blue gradient (#7aa7ff/#5e94ff) -- now the same
//      purple family. `.trash-btn-cta-danger` (empty-trash / delete-forever confirms) is
//      DELIBERATELY left red -- see this suite's own comment below and photos.scss's own Fix-4
//      comment on that rule for the interpretation flagged for the owner to re-judge.
//    - The non-danger confirm-modal icon (`--trash-confirm-fg` token + `.trash-modal-icon`'s base
//      circle background) is realigned from Vue2's literal blue to the same purple family, for
//      coherence with the now-purple CTA sitting right next to it. The danger icon/token/circle
//      stay red, same "keep destructive red" interpretation.
//
// 2. Light-theme legibility sweep across the `.fav-modal*`/`.trash-modal*` families: every
//    text-bearing rule in these two families was audited (title/subtitle/label/hint/input/body) --
//    all of them already resolve `color` through `var(--text-1/2/3)` (or inherit `.photos-root`'s
//    own base `color: var(--text-1)`, itself correctly re-themed under `.photos-root.is-light`),
//    with NO bare white/dark-theme-only literal found anywhere in either family. This suite pins
//    that state down as a regression guard, so a future edit can't silently reintroduce a
//    hardcoded literal on these selectors without failing a test.
//
// Follow-up (controller diagnosis, 2026-08-18): the "inherit .photos-root's own base color"
// premise above was actually FALSE at the time this file was first written -- only
// `.photos-root .app` declared a `color`, the bare `.photos-root` rule never did. Every overlay
// that renders as a SIBLING of `.app` (not a descendant) -- `.fav-modal-scrim`/
// `.trash-modal-scrim`/AlbumPickerDialog/the slideshow -- therefore inherited past `.photos-root`
// to <body>'s GLOBAL app-wide theme color instead, which is white in the New-UI global-dark
// default. In the owner's screenshot combo (Photos set to its own LIGHT theme, global New-UI
// theme left on its dark default), that produced white titles on these overlays' near-white
// `--surface-1` modal background -- exactly the reported bug, invisible to the grep-only sweep
// above because no LITERAL was involved, only a missing declaration. Fixed by adding
// `color: var(--text-1);` to the bare `.photos-root` rule itself (both theme blocks already
// define `--text-1`, so one declaration covers both) -- see that rule's own comment in
// photos.scss. The two tests below guard this directly.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const PHOTOS_SCSS = readFileSync('src/photos/styles/vue2-parity/photos.scss', 'utf8')

// Same brace-depth-matched rule-body extractor as placesPinTokens.test.ts (that file's own
// comment documents the "why": a naive `indexOf('}')` would stop at the first nested `}` inside
// a rule, e.g. the `.photos-root.is-light { ... }` token block below has no nesting itself, but
// this keeps the helper identical/copy-pastable across both guard files rather than diverging).
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

describe('Fix-4: Favorites/Trash confirm CTAs are purple in both themes', () => {
  it('.fav-btn-primary uses the theme-invariant --accent family (purple), not Vue2\'s literal amber', () => {
    const body = ruleBody(PHOTOS_SCSS, '.fav-btn-primary {')
    expect(body).toMatch(/background:\s*linear-gradient\(135deg,\s*var\(--accent-hi\),\s*var\(--accent\)\)/)
    expect(body).toMatch(/color:\s*white/)
    expect(body).toMatch(/box-shadow:\s*0 4px 14px -4px var\(--accent-glow\)/)
    expect(body).not.toMatch(/#FFD60A|#FFAA00|#29240B/i)
  })

  it('.fav-btn-primary:disabled uses --accent-soft/--text-3, not the old literal amber-tinted disabled state', () => {
    const body = ruleBody(PHOTOS_SCSS, '.fav-btn-primary:disabled {')
    expect(body).toMatch(/background:\s*var\(--accent-soft\)/)
    expect(body).toMatch(/color:\s*var\(--text-3\)/)
    expect(body).not.toMatch(/rgba\(255,\s*214,\s*10/)
  })

  it('.trash-btn-cta (base, non-danger) uses the same purple --accent family, not Vue2\'s literal blue', () => {
    // Leading "\n" disambiguates the top-level (PhotosTrash.vue confirm modal) rule from the
    // unrelated, indented `.lb-confirm-foot .trash-btn-cta` copy that lives earlier in this same
    // file (a different confirm-dialog scope, out of this task's scope -- see PhotosTrash.vue's
    // own header comment on why `.lb-confirm` isn't touched here).
    const body = ruleBody(PHOTOS_SCSS, '\n.trash-btn-cta {')
    expect(body).toMatch(/background:\s*linear-gradient\(135deg,\s*var\(--accent-hi\),\s*var\(--accent\)\)/)
    expect(body).toMatch(/color:\s*white/)
    expect(body).toMatch(/box-shadow:\s*0 6px 18px -3px var\(--accent-glow\)/)
    expect(body).not.toMatch(/#7aa7ff|#5e94ff/i)
  })

  // Interpretation flagged for the owner to re-judge (see photos.scss's own Fix-4 comment on this
  // rule): destructive confirms (empty-trash / delete-forever) keep the red danger variant rather
  // than also turning purple, on the reading that red-for-destructive is an intentional,
  // pre-existing safety signal distinct from "the confirm key is purple".
  it('.trash-btn-cta-danger is UNCHANGED (still Vue2\'s literal red) -- deliberate, not an oversight', () => {
    // Same disambiguation as the base-CTA test above: the top-level rule, not `.lb-confirm`'s own copy.
    const body = ruleBody(PHOTOS_SCSS, '\n.trash-btn-cta-danger {')
    expect(body).toMatch(/#FF7B6D|#E0463A/i)
    expect(body).not.toMatch(/var\(--accent/)
  })

  it('--trash-confirm-fg is repointed to the same purple hex as --accent, identically in both theme blocks', () => {
    const darkBlock = ruleBody(PHOTOS_SCSS, '.photos-root {')
    const lightBlock = ruleBody(PHOTOS_SCSS, '.photos-root.is-light {')
    expect(darkBlock).toMatch(/--accent:\s*#6E5BFF;/)
    expect(darkBlock).toMatch(/--trash-confirm-fg:\s*#6E5BFF;/)
    expect(lightBlock).toMatch(/--trash-confirm-fg:\s*#6E5BFF;/)
    // --trash-danger-fg (destructive icon color) is untouched in both blocks -- same
    // "keep destructive red" interpretation as the CTA above.
    expect(darkBlock).toMatch(/--trash-danger-fg:\s*#FF6B5C;/)
    expect(lightBlock).toMatch(/--trash-danger-fg:\s*#FF6B5C;/)
  })

  it('.trash-modal-icon\'s base (non-danger) circle background is --accent-soft; the danger override stays literal red', () => {
    const baseBody = ruleBody(PHOTOS_SCSS, '.trash-modal-icon {')
    expect(baseBody).toMatch(/background:\s*var\(--accent-soft\)/)
    expect(baseBody).not.toMatch(/rgba\(94,\s*148,\s*255/)

    const dangerBody = ruleBody(PHOTOS_SCSS, '.trash-modal[data-danger="true"] .trash-modal-icon {')
    expect(dangerBody).toMatch(/rgba\(255,\s*107,\s*92,\s*0\.14\)/)
  })
})

describe('Fix-4: light-theme legibility sweep -- .fav-modal*/.trash-modal* text rules are token-driven, no bare literal color', () => {
  // Any `color:` declaration on these selectors must route through var(--text-*) (or be entirely
  // absent, i.e. inherit .photos-root's own themed base color) -- never a bare white/black/hex
  // literal that would only read correctly in one theme.
  const TEXT_BEARING_SELECTORS = [
    '.fav-modal-title {',
    '.fav-modal-sub {',
    '.fav-modal-label {',
    '.fav-modal-input {',
    '.fav-modal-note {',
    '.fav-btn-ghost {',
    '.trash-modal-title {',
    '.trash-modal-body {',
    // Leading "\n" disambiguates from the unrelated, indented `.lb-confirm-foot .trash-btn-ghost`
    // copy earlier in this same file (a different confirm-dialog scope, out of this task's scope).
    '\n.trash-btn-ghost {',
  ]

  for (const header of TEXT_BEARING_SELECTORS) {
    const label = header.replace(/^\n/, '')
    it(`${label} -- if it declares "color:", it must be a var(--text-*) token, not a bare literal`, () => {
      const body = ruleBody(PHOTOS_SCSS, header)
      const colorDecl = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(body)
      if (colorDecl) {
        expect(colorDecl[1].trim(), `${header} color declaration must be var(--text-N), found: ${colorDecl[1]}`)
          .toMatch(/^var\(--text-\d\)$/)
      }
      // Never a bare hex/rgb/white/black literal anywhere else in the rule body either (covers a
      // future edit adding e.g. a `text-shadow` or second `color` on a pseudo-variant of the same
      // block -- this file is otherwise exempt from the app-wide color-guard.test.ts scan, see
      // that file's own registered exemption comment, so this is the one place these specific
      // selectors are pinned down).
      expect(body).not.toMatch(/color:\s*(white|#fff|#000|black)\b/i)
    })
  }
})

describe('Fix-4 follow-up: .photos-root itself is color-self-contained (guards the inheritance-leak fix)', () => {
  it('the bare .photos-root rule declares color: var(--text-1), not just .photos-root .app', () => {
    // Header string is exactly ".photos-root {" (period, selector, space, brace) -- does not
    // match ".photos-root.is-light {" (no space before the brace there) or ".photos-root .app {"
    // (an extra " .app" before the brace), so this isolates the bare base rule only.
    const body = ruleBody(PHOTOS_SCSS, '.photos-root {')
    expect(body).toMatch(/[^-]color\s*:\s*var\(--text-1\)\s*;/)
  })

  it('.photos-root .app still declares its own color: var(--text-1) too (unchanged -- in-page content was never the bug)', () => {
    const body = ruleBody(PHOTOS_SCSS, '.photos-root .app {')
    expect(body).toMatch(/[^-]color\s*:\s*var\(--text-1\)\s*;/)
  })

  it('.photos-root.is-light still redefines --text-1 (the fix rides the existing per-theme token, no new one added)', () => {
    const lightBlock = ruleBody(PHOTOS_SCSS, '.photos-root.is-light {')
    expect(lightBlock).toMatch(/--text-1:\s*oklch\(/)
  })
})
