// SP7 fix: two spots in the photos section where an "opaque dark panel sits on top of the glass shell".
//
// The root cause is a class of porting defect — **copying the token name, while the two
// same-named tokens carry different context**:
//   · Vue2's photos section is one whole **opaque dark page** (`photos.scss:3` `--bg: #0A0A0C`),
//     so any element inside the page painting `var(--bg)` blends seamlessly with the page background;
//   · New-UI's photos section lives inside AreaShell's **glass shell** (semi-transparent, with the
//     wallpaper/gradient showing through), so painting the same `var(--bg)` (`#1a2138`) turns into
//     a solid slab — the band running the full width in the real-device screenshot is exactly that.
//
// In this repo, the **legitimate use of `--bg`** is for a shell that "fills the viewport and is
// itself the page background" (StorageShell / SettingsShell / MediaViewer / SearchDialog), plus the
// gap color in SmartViewCard's collage image; rows/bars/panels embedded inside an area shell must
// always use the glass token (`--panel-bg`) — precedent in this same section: PhotosSidebar /
// PlacesRail / PhotoInfoPanel / PersonPlacesTab all use `var(--panel-bg)`.
//
// `--panel-bg-solid` (an opaque gradient fill in dark mode) was **introduced specifically for the
// map**: PlaceDetailPanel sits on top of the PlacesMap canvas, and translucency would let the map's
// grid dots show through (P6b real-device acceptance feedback). There is no second legitimate use
// case beyond that — so the third group below pins down its set of consumers with an **allowlist**;
// one more consumer than that and it goes red.
//
// jsdom doesn't compute cascade or do layout, so this class of defect isn't caught by unit tests
// (5952 passing tests didn't catch it either), so — same approach as color-guard.test.ts /
// photosLayoutHeightCap.test.ts — this asserts against the raw style-block text. Always read files
// via node:fs — `?raw` is always empty in this repo's test environment (color-guard once spun idle
// because of this).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../..')

function read(rel: string): string {
  const text = fs.readFileSync(path.join(SRC, rel), 'utf8')
  expect(text.length, `${rel} read back empty — the read helper is broken`).toBeGreaterThan(0)
  return text
}

/** Grab a selector's rule body (first occurrence only — good enough since each of these classes has only one rule in its own SFC). */
function ruleBody(text: string, selector: string): string {
  const i = text.indexOf(selector)
  expect(i, `couldn't find selector ${selector}`).toBeGreaterThan(-1)
  const open = text.indexOf('{', i)
  const close = text.indexOf('}', open)
  expect(open, `${selector} has no { after it`).toBeGreaterThan(-1)
  expect(close, `${selector}'s rule body has no }`).toBeGreaterThan(open)
  return text.slice(open + 1, close)
}

describe('Photos section surfaces use the glass token, not the app background color', () => {
  // Fix-3 item 7 (owner acceptance, 2026-08-13, Plan F pull-forward) correction: this case's own
  // premise -- "this page still lives inside AreaShell's glass shell, so any background paints a
  // visible band" -- is no longer true, same class of correction as Fix-2 item 6 below did for
  // PhotosSmartViewDetail.vue's `.sv-detail-side`. This task un-wrapped PhotosSearch.vue from its
  // old flex-row `.photos-layout` shell into the SAME opaque `.photos-root > .app` grid every
  // other migrated page uses (`--bg: #0A0A0C`, a solid near-black page, not a translucent
  // wallpaper backdrop) -- the exact problem this case originally guarded against cannot recur
  // here. PhotosSearch.vue no longer carries its own local `.filterbar` rule at all: the
  // 2026-08-13 rollback (see PhotosSearch.vue's own style-block header comment) deleted it along
  // with every other selector name already covered by vue2-parity/photos.scss, letting THAT rule
  // (which does paint `background: var(--bg)`, matching Vue2 1:1, photos.scss:2610-2616) govern
  // directly.
  it('the search page no longer carries a local .filterbar rule (handed over to parity by the 2026-08-13 rollback)', () => {
    const src = read('views/PhotosSearch.vue')
    expect(src, 'the search page still keeps a local .filterbar rule; the rollback should have removed it').not.toMatch(/\n\.filterbar\s*\{/)
  })

  it('parity own .filterbar does paint a background (Plan C left the AreaShell glass shell, so a fill no longer leaves a band) and still keeps its divider and stacking', () => {
    const body = ruleBody(read('photos/styles/vue2-parity/photos.scss'), '.filterbar {')
    expect(body).toMatch(/background\s*:\s*var\(--bg\)/)
    // border-bottom is the only visual boundary between it and the sort row.
    expect(body).toMatch(/border-bottom\s*:\s*1px solid var\(--line\)/)
    // position/z-index aren't decorative: the filter popover (.fpop) is a descendant of this
    // element, and these two properties are what let it render above the grid below.
    expect(body).toMatch(/position\s*:\s*sticky/)
    expect(body).toMatch(/z-index\s*:\s*6/)
  })

  // Fix-2 item 6 (owner acceptance, 2026-08-13) correction: this case's own premise -- "this
  // page still lives inside AreaShell's glass shell, same as PhotosSidebar/PlacesRail" -- is no
  // longer true. Plan C Task 2 (see PhotosSmartViewDetail.vue's own header comment) un-wrapped
  // this exact page from AreaShell into Vue2's own single opaque `.photos-root > .app` shell
  // (`--bg: #0A0A0C`, a solid near-black page, not a glass wallpaper backdrop) -- the same
  // migration Photos.vue's own shell went through earlier. PhotosSidebar, cited here as the
  // same-precedent glass surface, in fact no longer uses `--panel-bg` either: its real parity
  // rule (`vue2-parity/photos.scss:134-139` `.sidebar { background: var(--surface-1); ... }`)
  // is the same flat, opaque, `.photos-root`-scoped token this fix gives `.sv-detail-side`.
  // `--surface-1` is also correctly shadowed under `.photos-root.is-light` (unlike the global
  // `--panel-bg`, which was not, and stayed a barely-visible glass tint in photos light mode --
  // the actual bug this correction fixes, on top of restoring the pre-Plan-C premise this test
  // case itself no longer describes).
  it('the smart view detail right sidebar uses parity own opaque panel background (Plan C left the AreaShell glass shell, matching what PhotosSidebar does now)', () => {
    const body = ruleBody(read('views/PhotosSmartViewDetail.vue'), '.sv-detail-side {')
    expect(body).toMatch(/background\s*:\s*var\(--surface-1\)/)
    expect(body, 'nothing behind the right sidebar is a map, so it has no need for an opaque solid fill (and it stopped consuming --panel-bg-solid long ago)').not.toMatch(/var\(--panel-bg-solid\)/)
    expect(body, 'it must not fall back to the global glass token that never followed the photos-is-light switch').not.toMatch(/var\(--panel-bg\)/)
  })
})

describe('--panel-bg-solid consumer allowlist (reverse gate)', () => {
  // The one legitimate use case: the place detail panel that sits on top of the PlacesMap canvas
  // (translucency would let the map's grid dots show through).
  // Every new addition must first answer "is there really a map underneath it?" — if not, it
  // should use --panel-bg instead.
  const ALLOW = new Set(['photos/components/PlaceDetailPanel.vue'])

  function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '__tests__') continue
        walk(p, out)
      } else if (e.name.endsWith('.vue')) {
        out.push(p)
      }
    }
    return out
  }

  const files = walk(SRC)

  it('the scan actually found something (picked up .vue files)', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('only the components on the allowlist use --panel-bg-solid', () => {
    const users = files
      .filter((p) => fs.readFileSync(p, 'utf8').includes('var(--panel-bg-solid)'))
      .map((p) => path.relative(SRC, p).replace(/\\/g, '/'))
    expect(users.slice().sort(), `the set of --panel-bg-solid consumers has changed`).toEqual([...ALLOW].sort())
  })
})

// Fix-2 item 6b (owner acceptance, 2026-08-13): global body::before/after (theme.css) paint a
// fixed, viewport-covering "aurora" wash at z-index:0, meant to glow through AreaShell's own
// glass shells. Photos opted out of that glass aesthetic entirely (`.photos-root .app` paints
// its own fully opaque `--bg`, matching Vue2 1:1) -- but a plain, non-positioned block element
// is painted *before* a `position: fixed; z-index: 0` sibling in the standard CSS paint order
// regardless of how opaque its own background is, so the aurora painted on top of `.app` all
// along. It read as a plausible ambient glow in Photos' own dark theme and was never reported;
// `.photos-root.is-light`'s near-white `--bg` makes the exact same bleed-through glaringly
// visible (a colourful gradient wash over a light page), which is what the owner's screenshot
// shows. Fix: `position: relative; z-index: 1` on `.app` promotes it into the positioned/
// z-index layer above the aurora's `z-index: 0` -- theme-invariant (fixes both of
// `.photos-root`'s own themes at once, not a per-theme override), same recipe already used by
// ViewerShell.vue's own opaque shell over its own z-index:0 bokeh layer. jsdom does not compute
// paint order/cascade, so (same as this file's other cases) this is a raw-source assertion, not
// a rendered-DOM one; real-device verification is still the authority for the visual result.
describe('Fix-2 item 6b: .app establishes its own stacking context, sitting above the global aurora (z-index:0)', () => {
  it('.photos-root .app carries position:relative + z-index:1 (shared by both themes, not split light/dark)', () => {
    const body = ruleBody(read('photos/styles/vue2-parity/photos.scss'), '.photos-root .app {')
    expect(body).toMatch(/position\s*:\s*relative/)
    expect(body).toMatch(/z-index\s*:\s*1\b/)
    // The opaque background stays as well -- the two are independent and both must hold.
    expect(body).toMatch(/background\s*:\s*var\(--bg\)/)
  })
})
