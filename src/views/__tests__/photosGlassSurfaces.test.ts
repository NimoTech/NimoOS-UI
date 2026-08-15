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
  it('search page filter bar paints no background (glass shell shows through, consistent with the rows above and below)', () => {
    const body = ruleBody(read('views/PhotosSearch.vue'), '.filterbar {')
    // Not "don't use --bg" but "this bar shouldn't paint a background at all" — the .search-hero
    // above it and the sort row below it are both transparent, so any fill here would leave a
    // colored band on the glass shell.
    expect(body, `.filterbar has a background painted again: ${body.trim()}`).not.toMatch(/background\s*:/)
  })

  it('search page filter bar still keeps its divider and stacking (only the background was removed, nothing else)', () => {
    const body = ruleBody(read('views/PhotosSearch.vue'), '.filterbar {')
    // border-bottom is the only visual boundary between it and the sort row — removing the
    // background makes keeping this even more important.
    expect(body).toMatch(/border-bottom\s*:\s*1px solid var\(--divider\)/)
    // position/z-index aren't decorative: the filter popover (.fpop) is a descendant of this
    // element, and these two properties are what let it render above the grid below.
    // Removing them would let it get covered by tiles — unrelated to this "remove background"
    // change, so they must be kept.
    expect(body).toMatch(/position\s*:\s*sticky/)
    expect(body).toMatch(/z-index\s*:\s*6/)
  })

  it('smart view detail right sidebar uses the glass background (consistent with PhotosSidebar / PlacesRail in the same section)', () => {
    const body = ruleBody(read('views/PhotosSmartViewDetail.vue'), '.sv-detail-side {')
    expect(body).toMatch(/background\s*:\s*var\(--panel-bg\)/)
    expect(body, 'nothing behind the right sidebar is a map, so it has no need for an opaque solid fill').not.toMatch(/var\(--panel-bg-solid\)/)
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
