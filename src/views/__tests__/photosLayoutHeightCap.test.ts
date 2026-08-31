// The Photos area's `.photos-layout` height-cap regression guard -- bidirectional.
//
// Background: all 13 Photos-area pages each copy-pasted the same `.photos-layout` rule
// (deliberately not factored into a shared one at the time).
//
// During migration this rule was written as `min-height: 100%` (at least one screen, unbounded
// growth) instead of Vue2's `height: 100vh; overflow: hidden` (photos.scss:109) -- as a result
// the photo area stretched the whole page tall, and the sidebar and the month-scrubber on the
// right scrolled away along with the photos. Measured at 785 photos, the sidebar's "Settings"
// button ended up 83580px from the top of the page, and the scrubber was stretched to 83508px
// tall (all its ticks crammed at the very top, unreachable once you scroll down).
//
// Why this guard is **bidirectional**: an earlier version only did a one-way check ("everything
// on the whitelist is present"), so a whole CSS block that got missed during the port could
// sail through all three gates green. So this guard checks both "every page that should be
// capped is capped" and "no Photos page still has the old min-height:100%" -- it's the second
// check that actually blocks the real failure path of a newly created Photos page copy-pasting
// the old rule.
//
// jsdom can't measure real layout height (getBoundingClientRect is always 0), so whether the
// layout actually works is verified on a real device; this guard only locks down the source
// text to prevent regressions. Always read files via node:fs -- `?raw` is always empty in this
// repo's test environment (a past pitfall: color-guard once silently no-op'd because of this).
//
// After the Settings page's re-shell (the last entry this file ever removed), both the
// CAPPED and EXEMPT lists are empty -- all 13 Photos-area pages have been switched to the `.app`
// CSS Grid shell, so none of them carry a literal `.photos-layout {` rule anymore. This file's
// real gatekeeping duty now lives in the two "reverse" directory-scan assertions below
// (`allPhotosLayoutViews()`, which auto-discovers pages by walking src/views): they guard
// against a future new Photos page copy-pasting the old min-height:100% rule back in, and make
// sure a new page can't bypass registration in this file. The CAPPED/EXEMPT lists themselves are
// fine left empty -- no need to invent an excuse for the empty arrays.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

const VIEWS_DIR = 'src/views'

// Capped: the inner scroll chain is complete (`.photos-main` flex:1 + min-height:0 -> a scroll
// container with its own overflow-y:auto), so once capped, the inner container takes over
// scrolling.
const CAPPED: string[] = [
  // Since the shell-and-sidebar rebuild, Photos.vue no longer has a `.photos-layout` rule
  // string -- its shell switched to Vue2's `.app` CSS Grid structure (`height: 100vh;
  // overflow: hidden`, parity scss photos.scss:116-128), and height-capping duty was taken
  // over by that rule, no longer related to this file's `.photos-layout` rule string. The
  // reverse check (the second `it` below) won't false-positive on it: `allPhotosLayoutViews()`
  // only collects pages whose source still contains a literal `.photos-layout {`; Photos.vue
  // no longer does, so it's automatically excluded and doesn't need to move into EXEMPT. Since
  // the shared re-shell, PhotosAlbums.vue / PhotosAlbumDetail.vue / PhotosSmartViews.vue (see
  // the EXEMPT removal below) / PhotosSmartViewDetail.vue / PhotosMomentDetail.vue likewise
  // switched to the `.app` grid shell and likewise no longer contain a literal
  // `.photos-layout {`, covered by the same automatic exclusion rule -- already dropped from
  // the CAPPED list below (height-capping duty moved to the `.app` grid, no longer this file's
  // `.photos-layout` rule string).
  // PhotosSearch.vue likewise switched to the `.app` grid shell, and for the same reason is
  // dropped from below -- it no longer contains a `.photos-layout {` literal,
  // `allPhotosLayoutViews()` excludes it automatically, no need to move it into EXEMPT.
  // After the People re-shell, PhotosPeople.vue has likewise switched to the `.app`
  // grid shell, so it's dropped from below the same way (`.people-body` still takes over the
  // inner scroll responsibility, unchanged) — it no longer contains a literal `.photos-layout {`,
  // so `allPhotosLayoutViews()` excludes it automatically; no need to move it into EXEMPT.
  // After the detail-page re-shell, PhotosPersonDetail.vue has likewise switched to
  // the `.app` grid shell, so it's dropped from below the same way (`.detail-body` still takes
  // over the inner scroll responsibility, unchanged) — it no longer contains a literal
  // `.photos-layout {`, so `allPhotosLayoutViews()` excludes it automatically; no need to move it
  // into EXEMPT.
  // After the Places re-shell, PhotosPlaceAssets.vue has likewise switched to the
  // `.app` grid shell, so it's dropped from below the same way (PhotosGrid's own `.photos-wrap`
  // still takes over the inner scroll responsibility, unchanged) — it no longer contains a
  // literal `.photos-layout {`, so `allPhotosLayoutViews()` excludes it automatically; no need to
  // move it into EXEMPT.
  // After the Favorites re-shell, PhotosFavorites.vue has likewise switched to the
  // `.app` grid shell, so it's dropped from below the same way (PhotosGrid's own `.photos-wrap`
  // still takes over the inner scroll responsibility, unchanged) — it no longer contains a
  // literal `.photos-layout {`, so `allPhotosLayoutViews()` excludes it automatically; no need to
  // move it into EXEMPT.
  // After the Trash re-shell, PhotosTrash.vue has likewise switched to the `.app`
  // grid shell, so it's dropped from below the same way (`.trash-scroll` still takes over the
  // inner scroll responsibility, unchanged) — it no longer contains a literal `.photos-layout {`,
  // so `allPhotosLayoutViews()` excludes it automatically; no need to move it into EXEMPT.
  // After the Settings re-shell, PhotosSettings.vue has likewise switched to the
  // `.app` grid shell, so it's dropped from below the same way (`.ps-scroll` still takes over the
  // inner scroll responsibility, unchanged) — it no longer contains a literal `.photos-layout {`,
  // so `allPhotosLayoutViews()` excludes it automatically; no need to move it into EXEMPT.
]

// Exempt: this page has no inner scroll container at all -- capping it would clip content out
// of reach -- it must get a scroll container built first before it can be capped; tracked
// separately. Leaving it at min-height:100% is current behavior (the sidebar scrolls along with
// it), not a regression, but **is a known defect** -- once the scroll container is built it
// should move from this list to CAPPED.
//
// PhotosSmartViews.vue has since had a scroll container built for it (`.mo-section` promoted to
// flex:1+overflow-y:auto) and was capped along with its re-shell, so it's removed from this list
// (it also no longer contains a `.photos-layout {` literal, `allPhotosLayoutViews()` already
// excludes it automatically).
//
// PhotosPlaces.vue has since been re-shelled (`.app` CSS Grid) and is likewise removed from this
// list -- it also no longer contains a `.photos-layout {` literal, `allPhotosLayoutViews()`
// already excludes it automatically. The map canvas itself still has no inner scroll container,
// but after the re-shell, height-capping duty transferred to the `.app` grid (same as
// PhotosPeople.vue and other pages), so the previously flagged "needs its own follow-up" risk no
// longer exists.
const EXEMPT: Record<string, string> = {}

const CAPPED_RULE = '.photos-layout { display: flex; gap: 16px; align-items: flex-start; height: 100%; }'
const UNCAPPED_RULE = '.photos-layout { display: flex; gap: 16px; align-items: flex-start; min-height: 100%; }'

function read(name: string): string {
  return readFileSync(`${VIEWS_DIR}/${name}`, 'utf8')
}

/** All Photos-area views with a `.photos-layout` shell -- found via directory scan rather than a hardcoded list, so new pages are picked up automatically. */
function allPhotosLayoutViews(): string[] {
  return readdirSync(VIEWS_DIR)
    .filter((f) => f.endsWith('.vue'))
    .filter((f) => read(f).includes('.photos-layout {'))
    .sort()
}

describe('photos area .photos-layout height cap', () => {
  it('positive: every page on the CAPPED list has height: 100% (not min-height)', () => {
    for (const name of CAPPED) {
      const src = read(name)
      expect(src, `${name} 缺少已封顶的 .photos-layout 规则`).toContain(CAPPED_RULE)
    }
  })

  it('negative: no photos page still has the old min-height: 100% (except the exempt list)', () => {
    const offenders = allPhotosLayoutViews()
      .filter((name) => read(name).includes(UNCAPPED_RULE))
      .filter((name) => !(name in EXEMPT))
    expect(
      offenders,
      `这些相册页的 .photos-layout 仍是 min-height:100%,侧栏与月份刻度尺会跟着内容滚走。` +
        `要么改成 height:100%(内层滚动链已完整),要么加进本文件的 EXEMPT 并写明理由。`,
    ).toEqual([])
  })

  it('negative: every page in the directory with .photos-layout is covered by this file (CAPPED ∪ EXEMPT, none slip through)', () => {
    const covered = new Set([...CAPPED, ...Object.keys(EXEMPT)])
    const uncovered = allPhotosLayoutViews().filter((name) => !covered.has(name))
    expect(
      uncovered,
      `新增的相册页未登记:请判断内层滚动链是否完整,完整则封顶后加进 CAPPED,否则加进 EXEMPT。`,
    ).toEqual([])
  })

  it('every exempt entry carries a reason and is genuinely still uncapped (once capped it should move out of EXEMPT)', () => {
    for (const [name, reason] of Object.entries(EXEMPT)) {
      expect(reason.length, `${name} 的豁免理由不能为空`).toBeGreaterThan(10)
      expect(read(name), `${name} 已经封顶了,应从 EXEMPT 移到 CAPPED`).not.toContain(CAPPED_RULE)
    }
  })
})

describe('PhotosGrid photo area scrollbar is hidden (Vue2 photos.scss:103 / :301 contract)', () => {
  // If not hidden, theme.css:4-16's global 10px scrollbar would sit right on top of
  // .scrubber's tick-mark text (a right:0, 56px overlay with its tick text pinned to right:6px).
  const grid = readFileSync('src/photos/components/PhotosGrid.vue', 'utf8')

  it('.photos-wrap turns off the Firefox scrollbar', () => {
    expect(grid).toContain('scrollbar-width: none')
  })

  it('.photos-wrap turns off the WebKit scrollbar', () => {
    expect(grid).toContain('.photos-wrap::-webkit-scrollbar { display: none; }')
  })

  it('PhotosSearchGrid matches (both grid components share the same contract)', () => {
    const searchGrid = readFileSync('src/photos/components/PhotosSearchGrid.vue', 'utf8')
    expect(searchGrid).toContain('scrollbar-width: none')
  })
})
