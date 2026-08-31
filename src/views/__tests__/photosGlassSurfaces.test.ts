// Fix: two places in the Photos area where an opaque dark panel sat on top of the glass shell.
//
// Root cause is a class of migration defect -- **the token name was copied verbatim, but the
// two same-named tokens have different contexts**:
//   · Vue2's Photos area is one whole **opaque dark page** (`photos.scss:3` `--bg: #0A0A0C`), so
//     any element inside it painting `var(--bg)` blends seamlessly with the page background;
//   · New-UI's Photos area lives inside AreaShell's **glass shell** (translucent, with
//     wallpaper/gradient showing through), so painting the same `var(--bg)` (`#1a2138`) there
//     becomes a solid dark panel -- the band spanning the full width in the real-device
//     screenshot is exactly this.
//
// In this repo, `--bg`'s **legitimate use is a shell that fills the viewport and is itself the
// page background** (StorageShell / SettingsShell / MediaViewer / SearchDialog) and the gap
// color between tiles in SmartViewCard's collage; any row/bar/panel nested inside an area shell
// always uses the glass token (`--panel-bg`) instead -- existing precedent in this same area:
// PhotosSidebar / PlacesRail / PhotoInfoPanel / PersonPlacesTab all use `var(--panel-bg)`.
//
// `--panel-bg-solid` (dark theme is an opaque gradient fill) was **introduced specifically for
// the map**: PlaceDetailPanel sits on top of PlacesMap's canvas, and translucency let the map's
// grid dots show through (found via real-device verification). Beyond that there is no other
// legitimate scenario -- so the third group below pins its set of consumers with a
// **whitelist**; one more consumer turns it red.
//
// Correction: the original reasoning that "translucency would let the grid dots show through"
// doesn't actually hold up -- `--surface-1` (this repo's Photos-private token) is **fully
// opaque** in both Photos themes (`#131318` dark / `oklch(0.975 0.004 80)` light, neither has an
// alpha channel), it was never translucent. `--panel-bg-solid` is instead a *global* token that
// only follows the site-wide `[data-theme]` attribute, not Photos' own private
// `.photos-root.is-light` toggle -- the real consequence: after switching to Photos' private
// light theme, this panel's background stays stuck in dark (the real-device finding of "the
// right-side detail panel doesn't follow the light theme"). PlaceDetailPanel.vue's
// `.map-detail` has been changed back to `--surface-1` (parity `photos-places.scss`'s own
// `.map-detail` rule was already this value; the component's local override had been shadowing
// it) -- `--panel-bg-solid` now has no legitimate consumers at all, the whitelist below has been
// changed to an empty set, not because a new consumer was found.
//
// jsdom doesn't compute cascade or do layout, so unit tests can't catch this class of defect
// (all 5952 cases green didn't catch it either), so same approach as color-guard.test.ts /
// photosLayoutHeightCap.test.ts: assert against the raw style-block text.
// Always read files via node:fs -- this repo's `?raw` is always empty in the test environment
// (color-guard once silently no-op'd because of this).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { extractStyleBlock } from '../../photos/components/__tests__/cssCascade'

const SRC = path.resolve(__dirname, '../..')

function read(rel: string): string {
  const text = fs.readFileSync(path.join(SRC, rel), 'utf8')
  expect(text.length, `${rel} 读到空内容,取数方式失效了`).toBeGreaterThan(0)
  return text
}

/** Get a selector's rule body (only the first occurrence, which is enough: each of these classes has only one rule in its own SFC). */
function ruleBody(text: string, selector: string): string {
  const i = text.indexOf(selector)
  expect(i, `找不到选择器 ${selector}`).toBeGreaterThan(-1)
  const open = text.indexOf('{', i)
  const close = text.indexOf('}', open)
  expect(open, `${selector} 后面没有 {`).toBeGreaterThan(-1)
  expect(close, `${selector} 的规则体没有 }`).toBeGreaterThan(open)
  return text.slice(open + 1, close)
}

describe('photos area surfaces use glass tokens, not the app background paint', () => {
  // Correction: this case's own
  // premise -- "this page still lives inside AreaShell's glass shell, so any background paints a
  // visible band" -- is no longer true, same class of correction as the next case below did for
  // PhotosSmartViewDetail.vue's `.sv-detail-side`. PhotosSearch.vue was un-wrapped from its
  // old flex-row `.photos-layout` shell into the SAME opaque `.photos-root > .app` grid every
  // other migrated page uses (`--bg: #0A0A0C`, a solid near-black page, not a translucent
  // wallpaper backdrop) -- the exact problem this case originally guarded against cannot recur
  // here. PhotosSearch.vue no longer carries its own local `.filterbar` rule at all: the
  // rollback (see PhotosSearch.vue's own style-block header comment) deleted it along
  // with every other selector name already covered by vue2-parity/photos.scss, letting THAT rule
  // (which does paint `background: var(--bg)`, matching Vue2 1:1, photos.scss:2610-2616) govern
  // directly.
  it('search page no longer carries its own local .filterbar rule (handed off to parity via rollback)', () => {
    const src = read('views/PhotosSearch.vue')
    expect(src, '搜索页仍留着一份本地 .filterbar 规则,应已随回退删除').not.toMatch(/\n\.filterbar\s*\{/)
  })

  it("parity's own .filterbar paints the background (no longer inside AreaShell's glass shell under Plan C, so it no longer causes banding), and still keeps the divider and stacking", () => {
    const body = ruleBody(read('photos/styles/vue2-parity/photos.scss'), '.filterbar {')
    expect(body).toMatch(/background\s*:\s*var\(--bg\)/)
    // border-bottom is the only visual divider between it and the sort row.
    expect(body).toMatch(/border-bottom\s*:\s*1px solid var\(--line\)/)
    // position/z-index aren't decorative: the filter popover (.fpop) is its descendant, and these two properties are what let it paint above the grid below.
    expect(body).toMatch(/position\s*:\s*sticky/)
    expect(body).toMatch(/z-index\s*:\s*6/)
  })

  // Correction: this case's own premise -- "this
  // page still lives inside AreaShell's glass shell, same as PhotosSidebar/PlacesRail" -- is no
  // longer true (see PhotosSmartViewDetail.vue's own header comment): it was un-wrapped
  // from AreaShell into Vue2's own single opaque `.photos-root > .app` shell
  // (`--bg: #0A0A0C`, a solid near-black page, not a glass wallpaper backdrop) -- the same
  // migration Photos.vue's own shell went through earlier. PhotosSidebar, cited here as the
  // same-precedent glass surface, in fact no longer uses `--panel-bg` either: its real parity
  // rule (`vue2-parity/photos.scss:134-139` `.sidebar { background: var(--surface-1); ... }`)
  // is the same flat, opaque, `.photos-root`-scoped token this fix gives `.sv-detail-side`.
  // `--surface-1` is also correctly shadowed under `.photos-root.is-light` (unlike the global
  // `--panel-bg`, which was not, and stayed a barely-visible glass tint in photos light mode --
  // the actual bug this correction fixes, on top of restoring the pre-Plan-C premise this test
  // case itself no longer describes).
  it("smart view detail's right sidebar uses parity's own opaque panel background (no longer inside AreaShell's glass shell, consistent with PhotosSidebar)", () => {
    const body = ruleBody(read('views/PhotosSmartViewDetail.vue'), '.sv-detail-side {')
    expect(body).toMatch(/background\s*:\s*var\(--surface-1\)/)
    expect(body, '右侧栏底下没有地图,用不着不透明实底(且早已不是 --panel-bg-solid 消费方)').not.toMatch(/var\(--panel-bg-solid\)/)
    expect(body, '不应再回退到未随 photos-is-light 切换的全局玻璃 token').not.toMatch(/var\(--panel-bg\)/)
  })
})

describe('--panel-bg-solid consumer whitelist (reverse gate)', () => {
  // The previously-sole "legitimate scenario" (PlaceDetailPanel.vue,
  // stacked over the map canvas) has been fixed to use `--surface-1` instead (see this file's
  // header comment for the full account) — `--surface-1` is already fully opaque in both
  // Photos themes, so there was never a real translucency problem to solve with a second,
  // is-light-blind token. The whitelist was empty for a while: any future consumer must justify
  // itself from scratch, not point back at a precedent that turned out to be a bug.
  //
  // Files Time Machine added a genuine new legitimate
  // scenario. TimeMachineStage.vue's `.tm-fwin--active` (the real, scaled-down Files window) and
  // its preview clones (SnapshotPreviewWindow.vue's `.tm-preview-window`,
  // TimeMachineDepthStack.vue's `.tm-depth-strip`) all need a background that is (a) fully OPAQUE
  // regardless of theme (so ~10 stacked preview layers each occlude the one behind, and the real
  // window never shows the blurred clone/glass backdrop through it) and (b) follows the APP'S OWN
  // theme (dark in dark theme, white in light theme) -- these are real New-UI windows whose
  // cloned/slotted content paints text in New-UI's own `--fg`/`--fg-muted` tokens, unlike TM's own
  // chrome (glass/rail/stepper/bars/white-glass modals), which stays pinned to the SAME literal in
  // both themes via its own `--tm-panel-bg-solid` token (unchanged, still used by the white-glass
  // modals). `--panel-bg-solid` is exactly this: a global, already-themed, always-opaque token --
  // see this file's own header comment for its dark-gradient/white values.
  const ALLOW = new Set<string>([
    'files/snapshot/TimeMachineStage.vue',
    'files/snapshot/SnapshotPreviewWindow.vue',
    'files/snapshot/TimeMachineDepthStack.vue',
  ])

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

  it('data fetch is valid (found .vue files)', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('only whitelisted components use --panel-bg-solid', () => {
    const users = files
      .filter((p) => fs.readFileSync(p, 'utf8').includes('var(--panel-bg-solid)'))
      .map((p) => path.relative(SRC, p).replace(/\\/g, '/'))
    expect(users.slice().sort(), `--panel-bg-solid 的消费方变了`).toEqual([...ALLOW].sort())
  })
})

// Global body::before/after (theme.css) paint a
// fixed, viewport-covering "aurora" wash at z-index:0, meant to glow through AreaShell's own
// glass shells. Photos opted out of that glass aesthetic entirely (`.photos-root .app` paints
// its own fully opaque `--bg`, matching Vue2 1:1) -- but a plain, non-positioned block element
// is painted *before* a `position: fixed; z-index: 0` sibling in the standard CSS paint order
// regardless of how opaque its own background is, so the aurora painted on top of `.app` all
// along. It read as a plausible ambient glow in Photos' own dark theme and was never reported;
// `.photos-root.is-light`'s near-white `--bg` makes the exact same bleed-through glaringly
// visible (a colourful gradient wash over a light page), which is the reported symptom.
// Fix: `position: relative; z-index: 1` on `.app` promotes it into the positioned/
// z-index layer above the aurora's `z-index: 0` -- theme-invariant (fixes both of
// `.photos-root`'s own themes at once, not a per-theme override), same recipe already used by
// ViewerShell.vue's own opaque shell over its own z-index:0 bokeh layer. jsdom does not compute
// paint order/cascade, so (same as this file's other cases) this is a raw-source assertion, not
// a rendered-DOM one; real-device verification is still the authority for the visual result.
describe('.app establishes its own stacking context, above the global aurora (z-index:0)', () => {
  it('.photos-root .app has position:relative + z-index:1 (shared across both dark and light themes)', () => {
    const body = ruleBody(read('photos/styles/vue2-parity/photos.scss'), '.photos-root .app {')
    expect(body).toMatch(/position\s*:\s*relative/)
    expect(body).toMatch(/z-index\s*:\s*1\b/)
    // The opaque background is still retained -- the two things are independent of each other, both must hold.
    expect(body).toMatch(/background\s*:\s*var\(--bg\)/)
  })
})

// The topbar's `.search`
// box is a GLASS exception (PhotosTopbar.vue's own scoped style) that
// deliberately consumes the app's GLOBAL --chip-bg/--chip-border tokens (src/styles/theme.css)
// instead of this file's own `.photos-root`-scoped parity tokens. Root cause of the reported
// "light-top dark-band" glitch: `.photos-root.is-light` never redefined
// those two token NAMES, so in the very common "photos-light + app-global-dark" combination
// (Photos has its own light/dark toggle, independent of theme.css's app-wide toggle — dark is
// theme.css's default, no `data-theme="light"` attribute needed to hit it) the glass box fell
// straight through to theme.css's DARK values — a translucent white gradient designed to glow
// on a dark AreaShell page — painted on top of THIS page's own near-white `--bg`. This guard
// closes the blind spot: it was possible to regress the dark-band fix by deleting the
// `.photos-root.is-light` override below without any existing test in this file catching it.
describe('search box glass exception (topbar .search) dark-band fix: --chip-bg/--chip-border have light-context values under is-light', () => {
  it("photos-root.is-light overrides --chip-bg/--chip-border (photos-private, doesn't touch global theme.css)", () => {
    const body = ruleBody(read('photos/styles/vue2-parity/photos.scss'), '.photos-root.is-light {')
    expect(body).toMatch(/--chip-bg\s*:/)
    expect(body).toMatch(/--chip-border\s*:/)
    // Not just copying theme.css's dark glass values verbatim -- these are genuinely different light-context values, not just for show.
    expect(body).not.toMatch(/rgba\(255,\s*255,\s*255,\s*0\.26\)/)
  })

  it(".photos-root (dark block) doesn't redefine --chip-bg/--chip-border — the dark glass look stays byte-identical, still falling through to theme.css's dark values", () => {
    const body = ruleBody(read('photos/styles/vue2-parity/photos.scss'), '.photos-root {')
    expect(body).not.toMatch(/--chip-bg\s*:/)
    expect(body).not.toMatch(/--chip-border\s*:/)
  })

  it('global src/styles/theme.css is untouched by this fix (dark-band fix is strictly scoped to photos-private)', () => {
    const themeCss = read('styles/theme.css')
    // Only a coarse existence/count guard: the dark and light themes' respective --chip-bg
    // declarations should stay at exactly one each (:root once + :root[data-theme="light"] once),
    // and shouldn't be accidentally changed to a different value or have one added/removed by
    // this fix -- that would mean someone mistakenly wrote a Photos-private override back into the
    // global file. Matched at line-start (leading whitespace allowed), excluding lines in the
    // file that mention the word `--chip-bg` only in prose comments (e.g. the line "doesn't
    // reuse --chip-bg: it's pure white in the paper theme...", which isn't a real declaration).
    const chipBgCount = themeCss.split('\n').filter((line) => /^\s*--chip-bg\s*:/.test(line)).length
    expect(chipBgCount).toBe(2)
  })
})

// Audit of the lightbox's own is-light chain, closing the same class of blind
// spot the search-topbar guard above closes for --chip-bg/--chip-border. --lb-bg (canvas) /
// --lb-chrome (top bar + filmstrip bottom bar) are photos-private tokens (not global theme.css
// ones) declared in BOTH of `.photos-root`'s own theme blocks — unlike --chip-bg/--chip-border,
// which the dark block deliberately leaves undefined to fall through to theme.css, --lb-bg/
// --lb-chrome are redefined in the dark block too (Vue2 parity's own literal values), so the
// guard here is the mirror shape: assert BOTH blocks declare them, and that light's values are
// a real different value (not dark's literals copy-pasted under the light selector).
describe('lightbox: --lb-bg/--lb-chrome have values under both themes, and light genuinely switches to different context values', () => {
  it(".photos-root (dark block) declares --lb-bg/--lb-chrome as Vue2's original literal values (verified against photos.scss:62-89)", () => {
    const body = ruleBody(read('photos/styles/vue2-parity/photos.scss'), '.photos-root {')
    expect(body).toMatch(/--lb-bg\s*:\s*#000\s*;/)
    expect(body).toMatch(/--lb-chrome\s*:\s*rgba\(0,\s*0,\s*0,\s*0\.6\)\s*;/)
  })

  it('.photos-root.is-light overrides --lb-bg/--lb-chrome — near-white oklch canvas + white-glass top/bottom bars, not a dark copy-paste', () => {
    const body = ruleBody(read('photos/styles/vue2-parity/photos.scss'), '.photos-root.is-light {')
    expect(body).toMatch(/--lb-bg\s*:\s*oklch\(0\.975 0\.004 80\)/)
    expect(body).toMatch(/--lb-chrome\s*:\s*rgba\(255,\s*255,\s*255,\s*0\.8\)/)
    // Real values changed, not the dark block's #000/rgba(0,0,0,0.6) copied verbatim into the is-light block.
    expect(body).not.toMatch(/--lb-bg\s*:\s*#000/)
    expect(body).not.toMatch(/--lb-chrome\s*:\s*rgba\(0,\s*0,\s*0/)
  })

  it('lightbox canvas/top bar/filmstrip bottom bar all consume --lb-bg/--lb-chrome (not some other token or literal) — now that `.lightbox` is remounted inside `.photos-root`, these two rules actually take effect', () => {
    const scss = read('photos/styles/vue2-parity/photos.scss')
    expect(ruleBody(scss, '.photos-root .lightbox {')).toMatch(/background\s*:\s*var\(--lb-bg\)/)
    expect(ruleBody(scss, '.photos-root .lb-top {')).toMatch(/background\s*:\s*var\(--lb-chrome\)/)
    expect(ruleBody(scss, '.photos-root .lb-strip {')).toMatch(/background\s*:\s*var\(--lb-chrome\)/)
  })
})

// Sweep the lightbox's own 4 component files for a *bare* color
// literal (no `var(--token…)` wrapper at all, fallback or otherwise) on any surface that should
// be following `.photos-root.is-light` — the exact "dark-literal fallback that would defeat
// is-light" defect class this guards against. A `var(--lb-chrome, rgba(0,0,0,0.6))`-style
// fallback is explicitly FINE (the token resolves for real once nested inside `.photos-root`,
// per the case above) — this guard only fires on literals with no token wrapper at all.
//
// The two survivors below are pre-existing, individually-commented `theme-exception`s in their
// own files: a video-duration badge overlaid on an arbitrary photo thumbnail (PhotoFilmstrip.vue,
// same established precedent as PhotosGrid.vue's own `.tile-vid`, photos.scss:467-472 — fixed
// white text needs to read over ANY photo, in either theme) and a map-attribution caption
// overlaid on an arbitrary OSM tile (PhotoInfoPanel.vue, same precedent as PlacesRail.vue's own
// map-credit handling) — neither was ever theme-tokenized in Vue2 either, so this isn't a
// regression of is-light, it's an unrelated, pre-existing, correctly-commented exception. A
// whitelist (not a blanket "no rgba" ban) is the right shape here — same idiom as this file's
// own `--panel-bg-solid` consumer whitelist above: any new bare literal must be explicitly added
// here, forcing a reviewer to ask "is this really a fixed-contrast-over-arbitrary-content case,
// or did someone just forget the token?"
describe('lightbox 4 component files: bare color literal whitelist — no new hardcoded colors that bypass is-light', () => {
  const LIGHTBOX_FILES = [
    'photos/lightbox/PhotoLightbox.vue',
    'photos/lightbox/PhotoFilmstrip.vue',
    'photos/lightbox/PhotoImageViewer.vue',
    'photos/lightbox/PhotoInfoPanel.vue',
  ]

  const ALLOWED_BARE_LITERALS = new Set([
    'photos/lightbox/PhotoFilmstrip.vue::background: rgba(0, 0, 0, 0.55); color: #fff;',
    'photos/lightbox/PhotoInfoPanel.vue::color: rgba(255, 255, 255, 0.72);',
    'photos/lightbox/PhotoInfoPanel.vue::text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);',
    // The delete-confirm dialog's trash-icon color matches Vue2
    // PhotosLightbox.vue:154's own hardcoded literal exactly (see this line's own theme-exception
    // comment in PhotoLightbox.vue) -- a deliberate one-off parity match, not a drift back toward
    // hardcoded colors generally.
    'photos/lightbox/PhotoLightbox.vue::<div class="lb-confirm-icon" style="color: #FF6B5C"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></div>',
    // The solid-gold favorite star is a fixed
    // semantic color across themes, matching Vue2's own inline hex literal
    // (PhotosLightbox.vue:11, `:color="photo.fav ? '#FFD60A' : 'currentColor'"`) -- same
    // one-off-parity-match precedent as the confirm-icon entry above.
    'photos/lightbox/PhotoLightbox.vue::.lb-fav.is-fav { color: #ffd60a; }',
  ])

  // A line counts as "bare" only if it has a color literal (rgba()/hex) with NO `var(--…)`
  // anywhere on the same line — `var(--lb-chrome, rgba(0,0,0,0.6))`-style fallbacks (token
  // present, literal only as the fallback arm) are correctly excluded by this same check.
  function bareColorLiteralLines(rel: string): string[] {
    return read(rel)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /rgba?\(|#[0-9a-fA-F]{3,8}\b/.test(l) && !/var\(--/.test(l))
      .map((l) => `${rel}::${l}`)
  }

  it('the full list of bare color literals across the 4 files exactly matches the registered whitelist (one extra entry fails)', () => {
    const found = new Set(LIGHTBOX_FILES.flatMap(bareColorLiteralLines))
    expect(found).toEqual(ALLOWED_BARE_LITERALS)
  })
})

// A dark-theme light frame around `.map-shell`
// and light-theme popovers/detail-panel staying dark traced to the same root
// cause across the whole Places area — rules using *global* New-UI tokens (`--fg`/`--fg-muted`/
// `--fg-subtle`/`--card-border`/`--panel-bg`/`--panel-bg-solid`/`--popup-bg`/`--card-shadow-hi`/
// `--chip-bg`/`--chip-bg-hi`/`--on-accent`/`--skeleton-bg`/`--accent-text`) instead of this
// area's own Photos-local, is-light-aware equivalents (`--text-1/2/3`/`--line`/`--line-strong`/
// `--surface-1/2/3`/`--accent-hi`/literal Vue2 box-shadows). Global tokens only follow the
// app-wide `[data-theme]` attribute; Photos has its own PRIVATE theme toggle
// (`usePhotosTheme()`/`.photos-root.is-light`, independent of the global one) — so in the very
// common "Photos-light + app-global-dark" combination, every rule below stayed stuck in its
// dark/glass appearance regardless of Photos' own switch. This is a whitelist-style sweep (same
// idiom as this file's other two describe blocks above): every one of these token names should
// have ZERO occurrences left in the places area's own component/parity files; any future
// reintroduction is exactly the class of regression this fix corrects.
describe("places area no longer consumes global glass/text tokens (follows only the site-wide theme, not Photos' private is-light)", () => {
  // .vue files: scan only the `<style>` block (via `extractStyleBlock`, which also strips CSS
  // `/* … */` comments) — this file's own `<style>` header comments cite these exact banned
  // token names in prose (documenting the fix), which would otherwise false-positive this
  // guard; `extractStyleBlock` is the same "raw source, comments stripped" idiom PlacesThemeMenu.
  // test.ts/PlacesFilterMenu.test.ts already use for their own `winningHoverBackground` reads.
  // PlaceCoverPicker.vue/PlaceInsights.vue/PlacesZoomBar.vue are deliberately excluded — none
  // has a `<style>` block of its own at all (fully governed by the shared parity scss below;
  // `extractStyleBlock` would throw on any of them, grep-verified).
  const VUE_FILES = [
    'views/PhotosPlaces.vue',
    'photos/components/PlaceDetailPanel.vue',
    'photos/components/PlaceSpotDialog.vue',
    'photos/components/PlaceVisitHistory.vue',
    'photos/components/PlacesRail.vue',
    'photos/components/PlacesFilterMenu.vue',
    'photos/components/PlacesThemeMenu.vue',
  ]
  // The one non-.vue file: a bare .scss, no `<style>` wrapper to extract — strip CSS block
  // comments directly instead.
  const SCSS_FILES = ['photos/styles/vue2-parity/photos-places.scss']

  const BANNED_TOKENS = [
    '--fg\\b', '--fg-muted', '--fg-subtle', '--card-border', '--panel-bg\\b', '--panel-bg-solid',
    '--popup-bg', '--card-shadow-hi', '--chip-bg\\b', '--chip-bg-hi', '--on-accent',
    '--skeleton-bg', '--accent-text',
  ]
  const BANNED_RE = new RegExp(`var\\((${BANNED_TOKENS.join('|')})\\)`)

  function bannedTokenUsages(rel: string, styleText: string): string[] {
    return styleText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => BANNED_RE.test(l))
      .map((l) => `${rel}::${l}`)
  }

  it('across Places components + parity scss, the above global tokens have exactly 0 var(...) consumers', () => {
    const fromVue = VUE_FILES.flatMap((rel) => bannedTokenUsages(rel, extractStyleBlock(read(rel))))
    const fromScss = SCSS_FILES.flatMap((rel) => bannedTokenUsages(rel, read(rel).replace(/\/\*[\s\S]*?\*\//g, '')))
    expect([...fromVue, ...fromScss]).toEqual([])
  })

  // PlaceSpotDialog.vue's banned-icon-color fix (`--accent-text` → `--accent-hi`) is an inline
  // `style="…"` attribute in its TEMPLATE, not its `<style>` block — the sweep above can't see
  // it (extractStyleBlock only reads `<style>…</style>`). Separate raw-source check for that
  // one template-level occurrence.
  it("PlaceSpotDialog.vue's map pin icon inline style no longer uses --accent-text", () => {
    const raw = read('photos/components/PlaceSpotDialog.vue')
    expect(raw).not.toMatch(/var\(--accent-text\)/)
    expect(raw).toContain('color: var(--accent-hi); flex: none')
  })
})

// Same defect class as the Places sweep above,
// found independently in the lightbox family ("light-mode lightbox illegible -- buttons,
// text, arrows all washed out"). Root
// cause identical: rules consuming *global* New-UI theme.css tokens instead of this area's own
// `.photos-root`/`.photos-root.is-light`-scoped equivalents. Global tokens only follow the
// app-wide `[data-theme]` attribute; Photos has its own PRIVATE toggle
// (`usePhotosTheme()`/`.photos-root.is-light`), so in the common "Photos-light + app-global-dark"
// combination every rule below stayed stuck in its dark appearance. This guard is the lightbox
// counterpart of the Places whitelist sweep: every one of these token names should have ZERO
// `var(...)` occurrences left in the 4 lightbox-family component files' `<style>` blocks.
describe("lightbox family no longer consumes global glass/text tokens (follows only the site-wide theme, not Photos' private is-light)", () => {
  const LIGHTBOX_FILES = [
    'photos/lightbox/PhotoLightbox.vue',
    'photos/lightbox/PhotoInfoPanel.vue',
    'photos/lightbox/PhotoImageViewer.vue',
    'photos/lightbox/PhotoFilmstrip.vue',
  ]

  // `--blur` is deliberately NOT banned here -- it's a shared structural token (blur radius, not a
  // color), consistent with this codebase's "structural values stay shared across themes"
  // convention; `.lb-live-btn`'s own comment explains this
  // choice for its one remaining consumer.
  const BANNED_TOKENS = [
    '--fg\\b', '--fg-muted', '--fg-subtle', '--card-border', '--tool-bg-hi', '--star-fg',
    '--remove-fg', '--popup-bg', '--chip-bg-hi', '--chip-bg\\b',
  ]
  const BANNED_RE = new RegExp(`var\\((${BANNED_TOKENS.join('|')})\\)`)

  function bannedTokenUsages(rel: string): string[] {
    return extractStyleBlock(read(rel))
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => BANNED_RE.test(l))
      .map((l) => `${rel}::${l}`)
  }

  it('across the 4 lightbox component files, the above global tokens have exactly 0 var(...) consumers', () => {
    expect(LIGHTBOX_FILES.flatMap(bannedTokenUsages)).toEqual([])
  })
})
