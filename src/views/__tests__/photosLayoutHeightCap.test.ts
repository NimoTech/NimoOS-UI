// Bidirectional regression gate for the photos section `.photos-layout` height cap.
//
// Background: all 13 pages in the photos section each copy-pasted the same `.photos-layout` rule
// (deliberately "not deduplicated" at the time). During the port, this rule was written as
// `min-height: 100%` (at least one screen tall, unbounded height) instead of Vue2's
// `height: 100vh; overflow: hidden` (photos.scss:109) — as a result the photo grid stretched the
// whole page taller, and the sidebar and the month scrubber on the right scrolled away along with
// the photos. Measured with 785 photos: the sidebar's Settings button ended up 83580px from the
// top of the page, and the scrubber was stretched to 83508px tall (all its ticks crammed at the
// very top — unreachable once you scroll down).
//
// Why this gate is bidirectional: the SP9-T9 check only did a one-way "everything on the
// allowlist is present" check, so an entire block of CSS that got missed during the port sailed
// through with all three gates green. So this file checks both "everything that should be capped
// is capped" and "no photos page still has the old min-height:100%" — the latter is what actually
// blocks the real recurrence path of "copy-pasting the old rule into a newly created photos page".
//
// jsdom can't measure layout height (getBoundingClientRect is always 0), so whether the layout
// actually works is verified on real devices; this gate only locks down the source text, to guard
// against regressions. Always read files via node:fs — `?raw` is always empty in this repo's test
// environment (historical trap: color-guard once spun idle because of this).
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

const VIEWS_DIR = 'src/views'

// Capped: inner scroll chain is complete (`.photos-main` flex:1 + min-height:0 → a self-contained
// overflow-y:auto scroll container), so after capping the inner container takes over scrolling.
const CAPPED = [
  // Since Task 3 (shell + sidebar rebuild), Photos.vue no longer has a `.photos-layout` rule
  // string — the shell was replaced with a Vue2-structure `.app` CSS Grid
  // (`height: 100vh; overflow: hidden`, parity scss photos.scss:116-128), and height-cap
  // responsibility was taken over by that rule, so it's no longer related to the `.photos-layout`
  // rule string this file locks. The reverse check (the second `it` below) won't false-positive on
  // it: `allPhotosLayoutViews()` only collects pages whose source still literally contains
  // `.photos-layout {` — Photos.vue no longer does, so it's automatically excluded and doesn't
  // need to be moved into EXEMPT.
  // As of Plan C Task 2 (shared re-shell), five more pages — PhotosAlbums.vue /
  // PhotosAlbumDetail.vue / PhotosSmartViews.vue (see the EXEMPT removal below) /
  // PhotosSmartViewDetail.vue / PhotosMomentDetail.vue — switched to the same `.app` grid shell
  // and likewise no longer contain a literal `.photos-layout {`; the same automatic-exclusion
  // rule covers them, and they have been dropped from the CAPPED list below (the height cap is
  // now the `.app` grid's job, not the `.photos-layout` rule string this file locks).
  // As of Fix-3 item 7 (owner acceptance, 2026-08-13, Plan F pull-forward), PhotosSearch.vue
  // switched to the `.app` grid shell too and is dropped below for the same reason — it no
  // longer contains a literal `.photos-layout {`, so `allPhotosLayoutViews()` excludes it
  // automatically and it does not need to move into EXEMPT.
  // As of Plan D Task 2 (People re-shell), PhotosPeople.vue has likewise switched to the `.app`
  // grid shell, so it's dropped from below the same way (`.people-body` still takes over the
  // inner scroll responsibility, unchanged) — it no longer contains a literal `.photos-layout {`,
  // so `allPhotosLayoutViews()` excludes it automatically; no need to move it into EXEMPT.
  // As of Plan D Task 3 (detail-page re-shell), PhotosPersonDetail.vue has likewise switched to
  // the `.app` grid shell, so it's dropped from below the same way (`.detail-body` still takes
  // over the inner scroll responsibility, unchanged) — it no longer contains a literal
  // `.photos-layout {`, so `allPhotosLayoutViews()` excludes it automatically; no need to move it
  // into EXEMPT.
  'PhotosFavorites.vue',        // .photos-wrap of PhotosGrid
  'PhotosPlaceAssets.vue',      // .photos-wrap of PhotosGrid
  'PhotosTrash.vue',            // .trash-scroll
  'PhotosSettings.vue',         // .ps-scroll
]

// Exempt: this page has no inner scroll container anywhere, so capping would clip content out of
// reach — it needs a scroll container built first before it can be capped, already tracked
// separately. Its staying on min-height:100% is current behavior (the sidebar scrolls along with
// the content), not a regression, but it IS a known defect; once a scroll container is added,
// move it from this list to CAPPED.
//
// PhotosSmartViews.vue got its scroll container in Plan C Task 2 (`.mo-section` promoted to
// flex:1 + overflow-y:auto) and was capped along with the re-shell, so it is removed from this
// list (it no longer contains a literal `.photos-layout {` either, so `allPhotosLayoutViews()`
// already excludes it).
const EXEMPT: Record<string, string> = {
  'PhotosPlaces.vue': 'Places map page has no inner scroll container and juggles map canvas sizing; capping is high-risk — pending a separate ticket',
}

const CAPPED_RULE = '.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }'
const UNCAPPED_RULE = '.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }'

function read(name: string): string {
  return readFileSync(`${VIEWS_DIR}/${name}`, 'utf8')
}

/** Every photos-section view with a `.photos-layout` shell — found via directory scan rather than a hardcoded list, so new pages are picked up automatically. */
function allPhotosLayoutViews(): string[] {
  return readdirSync(VIEWS_DIR)
    .filter((f) => f.endsWith('.vue'))
    .filter((f) => read(f).includes('.photos-layout {'))
    .sort()
}

describe('Photos section .photos-layout height cap', () => {
  it('Forward: every page in the CAPPED list has height: 100% (not min-height)', () => {
    for (const name of CAPPED) {
      const src = read(name)
      expect(src, `${name} is missing the capped .photos-layout rule`).toContain(CAPPED_RULE)
    }
  })

  it('Reverse: no photos page still has the old min-height: 100% (except the exempt list)', () => {
    const offenders = allPhotosLayoutViews()
      .filter((name) => read(name).includes(UNCAPPED_RULE))
      .filter((name) => !(name in EXEMPT))
    expect(
      offenders,
      `These photos pages still have .photos-layout as min-height:100% — the sidebar and month scrubber will scroll away with the content. ` +
        `Either change it to height:100% (the inner scroll chain is already complete), or add it to this file's EXEMPT list with a stated reason.`,
    ).toEqual([])
  })

  it('Reverse: every page in the directory with .photos-layout is covered by this file (CAPPED ∪ EXEMPT, none slip through)', () => {
    const covered = new Set([...CAPPED, ...Object.keys(EXEMPT)])
    const uncovered = allPhotosLayoutViews().filter((name) => !covered.has(name))
    expect(
      uncovered,
      `A newly added photos page isn't registered: check whether its inner scroll chain is complete — if so, cap it and add it to CAPPED, otherwise add it to EXEMPT.`,
    ).toEqual([])
  })

  it('Every entry in the exempt list has a reason and is genuinely not yet capped (once capped, it should move out of exempt)', () => {
    for (const [name, reason] of Object.entries(EXEMPT)) {
      expect(reason.length, `the exempt reason for ${name} must not be empty`).toBeGreaterThan(10)
      expect(read(name), `${name} has already been capped and should be moved from EXEMPT to CAPPED`).not.toContain(CAPPED_RULE)
    }
  })
})

describe('PhotosGrid photo grid scrollbar is hidden (Vue2 photos.scss:103 / :301 contract)', () => {
  // If not hidden, the global 10px scrollbar from theme.css:4-16 would sit right on top of the
  // .scrubber (a right:0, 56px-wide overlay with tick labels at right:6px) tick labels.
  const grid = readFileSync('src/photos/components/PhotosGrid.vue', 'utf8')

  it('.photos-wrap turns off the Firefox-side scrollbar', () => {
    expect(grid).toContain('scrollbar-width: none')
  })

  it('.photos-wrap turns off the WebKit-side scrollbar', () => {
    expect(grid).toContain('.photos-wrap::-webkit-scrollbar { display: none; }')
  })

  it('PhotosSearchGrid matches (contract is consistent across both grid components)', () => {
    const searchGrid = readFileSync('src/photos/components/PhotosSearchGrid.vue', 'utf8')
    expect(searchGrid).toContain('scrollbar-width: none')
  })
})
