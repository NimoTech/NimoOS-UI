# Task 6 report: 相册详情统计侧栏 + 更多菜单对齐

Commit: `2094f37` "align the album detail page with the smart view layout"

## What was implemented

`src/views/PhotosAlbumDetail.vue`:

- Added `locale` to the `useI18n()` destructure and a `localeTag` computed
  (`locale.value.replace('_', '-')`), following `PhotosMomentDetail.vue`'s own form —
  this file previously had no `localeTag`.
- Four new computeds: `spanLabel` (reuses `album.dateRange`), `videoCountLabel`
  (`(album.value?.videoCount ?? 0).toLocaleString(...)`, 0 is a real answer not a
  missing-data sentinel), `createdLabel` (dash on missing/invalid `createdAt`), plus
  `monthBuckets`/`distMax`/`distStyle` ported verbatim from
  `PhotosMomentDetail.vue:341-364` with `allAssets.value` swapped for this page's
  `photos.value`.
- New two-column body: `.album-photos-wrap` is now wrapped inside a new
  `.album-detail-body` grid (`1fr 320px`, `overflow: hidden`), with a new
  `<aside class="sv-detail-side">` holding the stats grid (4 cells, `data-test="album-stat-cell"`)
  and the by-month histogram (`data-test="album-dist"`/`album-dist-bar"`, absent when
  `monthBuckets` is empty).
- More menu reshaped from the old two-item `.album-more-item` rows to the
  `sv-export-item` icon+title+hint idiom (rename / **convert** / separator / delete).
  Convert is `:disabled="smartViewDisabled"` with a `:title` hint when disabled.
- New `smartViewDisabled` computed (`settings.aiFeatures.smartview === false`), a
  `convertOpen` ref, and an `openConvertModal()` stub that closes the menu and flips
  `convertOpen` (body deferred to Task 7). `usePhotosSettingsStore` imported;
  `void settings.fetchAiFeatures()` added to `onMounted`.
- Step 1 registered comment above `.album-hero-actions .bar-btn` explaining why it is
  **not** renamed to `.sv-action-btn` (cites Vue2 `photos.scss:3533-3538`).
- CSS-selector fix (not in the brief, see "wrong in the brief" below): the two
  `.album-toolbar[data-edit="true"] ~ .album-photos-wrap ...` sibling-combinator rules
  had to be repointed to `~ .album-detail-body ...` because the new wrapper div breaks
  the old direct-sibling relationship.

`src/i18n/zh_cn.photos.ts` / `en_us.photos.ts`: added `photosAlbumRenameHint`,
`photosAlbumConvertToSmart`, `photosAlbumConvertToSmartHint`, `photosAlbumStatVideos`,
`photosAlbumStatCreated` (5 keys, both files, values verbatim from the dispatch).
Confirmed via grep before adding: `photosMoStats`/`photosMoPhotos`/`photosMoSpan`/
`photosMoByMonth`/`photosSvSmartViewsOffCreateHint` already existed — reused, not
duplicated.

`src/views/__tests__/PhotosAlbumDetail.test.ts`: added `getConfig` to the `svc.photos`
mock (+ `beforeEach` clear), a `mountDetail({ album, assets, aiFeatures })` helper that
mounts with fixtures passed straight through (deliberately bypassing `rawAlbum()`/
`asset()`'s own field defaults, since several new tests rely on an absent field staying
absent), and the 8 tests from the brief's Step 2 (added `await w.vm.$nextTick()` after
each menu-open click, which the brief's snippet omitted — needed because `menuOpen`
flips via a `ref` and the menu's `v-if` needs a tick to render).

## TDD evidence

RED (stashed only `PhotosAlbumDetail.vue`, kept the new tests + i18n keys):
```
git stash push -- src/views/PhotosAlbumDetail.vue
pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts --reporter=verbose
...
Tests  8 failed | 33 passed (41)
```
All 8 new tests failed (missing `data-test` hooks / computeds / disabled attribute);
all 33 pre-existing tests still passed. Then `git stash pop` restored the implementation.

GREEN (after restoring the implementation):
```
pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts src/styles src/i18n/parity.test.ts --reporter=verbose
...
Test Files  6 passed (6)
Tests  1125 passed (1125)
```

## Mutation checks

a) `videoCountLabel`: changed `(album.value?.videoCount ?? 0).toLocaleString(...)` to
   `album.value?.videoCount ? ... : DASH` (dash on 0) → "reports zero videos rather than
   a dash" went red (`Expected: "0"`, `Received: "—视频"`). Reverted.

b) `.album-detail-body`: changed `overflow: hidden` → `overflow: auto` → "keeps the
   rail out of the photo grid's scroll container" went red (regex no longer matched).
   Reverted.

c) Removed `v-if="monthBuckets.length"` from the by-month `<div class="sv-side-section"
   data-test="album-dist">` → "buckets members by month and omits the histogram..." went
   red — the "without" half of the test now throws (accessing
   `monthBuckets[monthBuckets.length - 1]` on an empty array inside the template),
   propagating out of `flushJobs` and failing the test with an uncaught render error
   rather than a clean assertion failure. Either way the test does not pass with the
   guard removed. Reverted.

d) Removed `:disabled="smartViewDisabled"` from the Convert button → "disables Convert
   to Smart Album when smart views are off" went red (`expected undefined to be
   defined`). Reverted.

## New-Chinese grep

```
git diff HEAD~1 HEAD -- src/views/PhotosAlbumDetail.vue src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts | grep '^+' | grep -P '[\x{4e00}-\x{9fff}]'
```
Output (all expected — locale data or a relocated pre-existing comment line, not new
authored prose):
```
+  photosAlbumRenameHint: '修改相册名称',
+  photosAlbumConvertToSmart: '转为智能相册',
+  photosAlbumConvertToSmartHint: 'Nimo 会自动持续加入匹配的新照片',
+  photosAlbumStatVideos: '视频',
+  photosAlbumStatCreated: '创建时间',
+   勾选"的封面瓦片仍然显示徽章,与选择圈重叠)。
+    expect(w.find('[data-test="album-menu-rename"]').text()).toContain('修改相册名称')
```
The `勾选"的...重叠)。` line is the tail of a pre-existing Chinese block comment whose
closing `*/` I moved down two lines (to append the selector-fix note after it in
English) — git shows it as removed+re-added because the hunk boundary shifted, not
because I authored new prose there. I did catch and fix one real violation during
self-review: an earlier draft of that same comment ("T6 补记: ...") was Chinese; it is
now English ("T6 note: ..."). The `toContain('修改相册名称')` assertion is a literal
match against rendered UI text (the same pattern this file already uses at dozens of
existing assertions, e.g. `toContain('已存在同名相册')`), not authored narration —
consistent with the existing convention in this file.

One CSS-comment defect caught and fixed during self-review: my registered comment for
the danger-menu-item styling originally spelled out the Vue2 literal as
`` `style="color:#FF6B5C"` `` — the color-guard scans comments too and flagged the bare
hex. Reworded to "inline coral color literal" (matching how `PhotosSmartViewDetail.vue`
phrases the same fact at its own :699/:955). Re-ran color-guard after the fix: green.

A second defect from the same self-review pass: a sidebar-summary comment read
`.sv-side-section/.sv-stat-*/.sv-distribution/.sv-dist-*` — the `*` in `.sv-stat-*`
sits immediately before the `/` of the next class name, which prematurely closes the
CSS comment (exactly the class of bug the dispatch warned about). Verified with
`grep -noP '\S\*/' src/views/PhotosAlbumDetail.vue` (empty after the fix). Reworded to
use commas instead of slashes between the class-name fragments.

## CSS rule blocks copied, and orphan removal

- `.sv-side-section`, `.sv-side-section h3`, `.sv-stat-grid`, `.sv-stat-cell`/`.v`/`.l`,
  `.sv-distribution`, `.sv-dist-bar`, `.sv-dist-x` — copied verbatim from
  `PhotosMomentDetail.vue:1059-1090`.
- `.sv-detail-side` — copied verbatim from `PhotosMomentDetail.vue:890-893`
  (`border-left`, `background: var(--panel-bg)`, `overflow-y: auto`,
  `padding: 20px 18px 40px`, `min-height: 4px`). Not in the brief's own snippet (which
  only listed `.album-detail-body` verbatim) — I sourced it from the same file per the
  brief's instruction to copy the "seven rule groups" including `.sv-detail-side`.
- `.sv-export-menu`, `.sv-export-item`, `.sv-export-item:hover`, `.sv-export-icon`,
  `.sv-export-title`, `.sv-export-desc`, `.sv-export-sep`, `.sv-export-item-danger`,
  `.sv-export-icon-danger`, `.sv-export-item.sv-export-item-danger:hover` — copied
  verbatim from `PhotosSmartViewDetail.vue:937-960`.
- One rule added that has **no** counterpart in either source file:
  `.sv-export-item:disabled { opacity: 0.45; cursor: not-allowed; }`. Neither
  `PhotosMomentDetail.vue` nor `PhotosSmartViewDetail.vue` ever disables an
  `.sv-export-item`, so there was nothing to copy; this follows the same treatment this
  file already gives `.bar-btn:disabled`.
- ≤768px media query: added `.album-detail-body { grid-template-columns: 1fr; }` and
  `.sv-detail-side { border-left: 0; border-top: 1px solid var(--divider); }`, copied
  from `PhotosMomentDetail.vue`'s own `@media (max-width: 768px)` block.
- Removed (orphaned, no remaining reference in the file): `.album-more-menu`,
  `.album-more-item`, `.album-more-item:hover`, `.album-more-item.danger`,
  `.album-more-item-hint`, `.album-more-sep`. Confirmed with
  `grep -n "album-more" src/views/PhotosAlbumDetail.vue` after the edit — only
  `.album-more-wrap` (still used, still styled) and `.album-more-btn` (marker class, no
  dedicated rule, pre-existing) remain.

## Files changed

- `src/views/PhotosAlbumDetail.vue`
- `src/views/__tests__/PhotosAlbumDetail.test.ts`
- `src/i18n/zh_cn.photos.ts`
- `src/i18n/en_us.photos.ts`

## Self-review findings (all fixed before commit)

1. New Chinese comment in a CSS block ("T6 补记") — translated to English.
2. Color-guard tripped on a bare hex literal quoted inside my own comment
   (`#FF6B5C`) — reworded to avoid spelling the hex value, matching this repo's own
   established phrasing for the same fact.
3. `*` immediately before `/` inside a summary comment
   (`.sv-stat-*/.sv-distribution`) — the exact CSS-comment-truncation trap the dispatch
   warned about; would have silently swallowed the rest of that comment block plus
   whatever followed it, undetected by any of the six gates. Fixed by using commas
   instead of slashes; verified with a repo-wide `\S\*/` grep afterward (no matches).
4. A CSS-selector break I found by reading the file, not by a listed instruction: the
   pre-existing `.album-toolbar[data-edit="true"] ~ .album-photos-wrap ...` sibling
   rules relied on `.album-photos-wrap` being a *direct* sibling of `.album-toolbar`.
   Wrapping it in `.album-detail-body` (as Step 6 requires) breaks that relationship
   silently — no test would have caught it, since none of this file's existing tests
   assert on that particular hover/edit-mode CSS behavior in a way jsdom can see. Fixed
   by repointing both selectors to `~ .album-detail-body ...` (safe because
   `.album-photos-wrap` is the only `.tile`-bearing branch inside it).
5. Confirmed the disabled-Convert-button visual state needed its own CSS (browser
   default `disabled` styling is inconsistent and this button already overrides
   background/color) — added `.sv-export-item:disabled` (see "no counterpart" note
   above).

## Issues or concerns

- None outstanding. `pnpm exec vue-tsc --noEmit` is clean.
- Full `pnpm test` (post-commit, run twice):
  - With the pre-existing (not mine — present before this task started) dirty
    `progress.md`: `Test Files 4 failed | 681 passed (685)`, `Tests 3 failed | 10825
    passed | 70 skipped (10898)`. All 4 failed files are `oss/*.test.mjs`, all failing
    on the same "工作树不干净" (dirty tree) guard inside `oss/export.mjs`.
  - Stashing that one pre-existing file and rerunning just `oss/`: `Test Files 8 passed
    (8)`, `Tests 149 passed (149)`. Confirms the 3 failures are 100% attributable to the
    pre-existing dirty `progress.md`, not to anything this task touched — this task's
    own commit left the tree clean for every file it changed.

## Wrong in the brief

1. **A CSS side-effect the brief never mentioned**: wrapping `.album-photos-wrap` in
   the new `.album-detail-body` div silently breaks the two pre-existing
   `.album-toolbar[data-edit="true"] ~ .album-photos-wrap ...` sibling-combinator rules
   (they stop matching because the wrapper is now between them). The brief's Step 6
   only says to wrap the grid and add the aside; it does not flag that this changes the
   DOM sibling structure the edit-mode cover-badge/outline rules depend on. Fixed by
   repointing both selectors through `.album-detail-body`.
2. **`.sv-detail-side`'s rule body**: the brief says to copy seven rule groups from
   `PhotosMomentDetail.vue:1059-1090` including `.sv-detail-side`, but that exact line
   range (1059-1090) is the stats/distribution block only — `.sv-detail-side` itself
   lives earlier, at `PhotosMomentDetail.vue:890-893`, as part of the two-column
   skeleton block, not the sidebar-sections block. Not a wrong value, just a line-range
   pointer that undershoots by ~170 lines; copied the correct rule body from its actual
   location.
3. **Test snippet omits a required tick**: the brief's Step 2 test bodies click
   `[data-test="album-more-btn"]` and then immediately assert on `[data-test=
   "album-menu-*"]` without an intervening `await w.vm.$nextTick()`. `menuOpen` is a
   plain `ref` flipped synchronously in the click handler, but Vue's reactive re-render
   is still async — without the tick the three "more menu" tests are flaky-to-failing
   depending on scheduling. Added `await w.vm.$nextTick()` after each such click in the
   implemented tests (this repo's own convention elsewhere in the same file already
   does this after every `menuOpen`-toggling click).
4. **Danger-literal citation in the dispatch itself** (not the brief, the dispatch's
   Global Constraints section) spells out `` `color:#FF6B5C` `` as literal text to
   contrast against. That's fine in a dispatch/report (not scanned by color-guard), but
   copying it verbatim into a **code comment** — which I initially did — trips the
   guard, since it scans comments too. Worth flagging so a future dispatch phrases such
   citations without a literal hex value if the intent is for the phrasing to be quoted
   into code.
