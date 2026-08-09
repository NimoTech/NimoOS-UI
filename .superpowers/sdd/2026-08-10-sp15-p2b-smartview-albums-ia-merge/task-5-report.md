# Task 5 report: For You page + sidebar label + back-link redirects

## What was implemented

- **`src/views/PhotosSmartViews.vue`** slimmed to Moments-only:
  - Removed imports/usages of `SmartViewCard`, `SmartViewCreateDialog`, `usePhotosSmartViews`
    store (and its `fetchSmartViews()` call), `createOpen`, `openCreate`, `onCardOpen`,
    `onCreated`, `defineExpose({ createOpen })`.
  - Removed the `.sv-hero` block, the loading-skeleton block, the smart-view `.sv-grid`
    grid + create tile, and the full `.svs-banner` AI banner.
  - Removed the now-orphaned CSS: `.sv-hero*`, `.sv-create-btn*`, `.sv-create-card*`,
    `.sv-skel-card`, `.svs-banner*`. **Kept the bare `.sv-grid` rule** (`.mo-grid` layers on
    top of it).
  - Kept: shell, `PhotosSidebar`, the Moments band + `showMoments` gate, drag-sort wiring,
    `aiSmartViewOff`.
  - Promoted `.mo-hero h2` → `h1` in both template and CSS selector (32px unchanged) — this
    is now the page's only heading *within the main content area* (`PhotosSidebar` carries
    its own unrelated `h1`, `photosTitle`, which pre-exists this task).
  - Added the slim `v-else-if="aiSmartViewOff"` settings hint (`.mo-off-hint`), replacing the
    old banner. Amber uses `--dem-fg`/`--dem-bg`/`--dem-bd`, same family as the deleted
    banner.
- **`src/photos/components/PhotosSidebar.vue`**: `labelKey` for the `smart-views` nav entry
  changed `photosSvSmartViews` → `photosMoForYou`. `id`/`route` untouched.
- **`src/views/PhotosSmartViewDetail.vue`**: 3 redirects changed `/photos/smart-views` →
  `/photos/albums` (post-delete `:363`, not-found button `:541`, detail-bar back button
  `:557`). The not-found button and detail-bar button's label changed
  `photosSvAllSmartViews` → `photosAlbumBack`. Added `data-test="sv-detail-back"` to the
  detail-bar button (it had none before). Added the deviation-registration comment above the
  detail-bar button per the dispatch's required text.
- **`src/views/PhotosSearch.vue`**: `onSaved()`'s toast-action redirect changed
  `/photos/smart-views` → `/photos/albums` (line ~499/503, one occurrence). Label
  (`photosSearchOpenSmartViews`) unchanged — only the destination moved.
- **`src/i18n/zh_cn.photos.ts` / `en_us.photos.ts`**: added `photosMoForYou` /
  `photosMoFollowsSmartViewSetting` (both locales, controller-verified values used
  verbatim). Deleted `photosSvSavedSearchesStayLive`, `photosSvDescribeWantSetQuality`,
  `photosSvAllSmartViews` from both locales after confirming zero remaining `t()` consumers.
  `photosSvSmartViews` left untouched (still the detail page's `AreaShell` title).

## Test files touched

- `src/views/__tests__/PhotosSmartViews.test.ts` — heavily trimmed (see deletion list below).
- `src/views/PhotosSmartViews.moments.test.ts` — new SP15-P2b describe block added; two
  obsolete `.sv-hero-secondary` cases deleted (see below).
- `src/views/__tests__/PhotosSmartViewDetail.test.ts` — added `/photos/albums` route stub,
  updated 3 redirect assertions, added the `sv-detail-back` test with label assertion.
- `src/photos/components/__tests__/PhotosSidebar.test.ts` — updated 5 pre-existing
  `'智能视图'` text assertions to `'为你推荐'`, added a dedicated label-change test.
- `src/views/__tests__/PhotosSearch.test.ts` — added `/photos/albums` route stub, updated the
  redirect assertion and test title.
- `src/views/__tests__/PhotosPlaces.test.ts` — **not in the brief's touch list**, but its
  sidebar-NAV-order test asserts the full rendered label sequence including the old
  `'智能视图'` text; updated to `'为你推荐'` (found via the full `pnpm test` run, not the
  brief's suggested file list — see "brief corrections" below).

## Every test case deleted, and where its coverage now lives

From `PhotosSmartViews.test.ts` (describe blocks/cases removed entirely, not rewritten):

| Deleted case | New home |
|---|---|
| `onMounted 调 store.fetchSmartViews() 一次` | N/A — the fetch itself is gone from this page; `PhotosAlbums.test.ts` (Task 3/4) covers the album page's own smart-view fetch. |
| `listLoading && !listLoaded → 渲染骨架` | `PhotosAlbums.test.ts` covers the mixed-grid's loading skeleton (Task 3). |
| `listLoaded + 2 条 → 2 个 SmartViewCard + 1 张 .sv-create-card` | `PhotosAlbums.test.ts` covers rendering smart-view cards mixed into the grid (Task 3) and the create tile (Task 4). |
| `listLoaded + 0 条 → 0 个卡片 + 1 张新建卡` | Same as above — `PhotosAlbums.test.ts`. |
| `getConfig 返回 aiFeatures.smartview === false → 横幅出现` | `PhotosAlbums.test.ts` covers the full stop-updates banner, now on Albums (Task 3/4). |
| `AI behavior 链接是真路由链接 (§7e-9)` | Same — the banner's settings link lives in `PhotosAlbums.test.ts` now. |
| `点 hero 创建按钮 → SmartViewCreateDialog 的 scrim 真渲染` | `PhotosAlbums.test.ts` covers the fused creation panel's embedded smart-create form (Task 4). |
| `点 .sv-create-card → 弹窗同样真渲染` | Same — Task 4's create-tile coverage in `PhotosAlbums.test.ts`. |
| `弹窗内点关闭 → scrim 消失,回到列表` | Same — Task 4's dismiss-flow coverage (also see `SmartViewCreateDialog.test.ts`, which independently covers `dismiss()`). |
| `点真实卡片 → router.push 参数是 /photos/smart-views/7` | `PhotosAlbums.test.ts` covers a mixed-grid smart-view card's `@open` → `/photos/smart-views/:id` (Task 3). |
| `.sv-create-btn 与 .plus 圆块用 var(--accent)...` (CSS structural) | `PhotosAlbums.test.ts` / `SmartViewCreateDialog.test.ts` cover the create button's styling now that it lives there. |
| `.svs-banner 的 margin 保留...`(CSS structural) | `PhotosAlbums.test.ts` covers the full banner's styling (it moved there whole). |
| `.sv-create-btn:hover 保留...translateY`(CSS structural) | Same as the `.sv-create-btn` case above. |

Two more of my own — deleted from `PhotosSmartViews.moments.test.ts` (added during earlier
phases, now obsolete because the element they asserted on no longer exists on this page):

| Deleted case | Why no replacement is needed |
|---|---|
| `when the band is present, the sv-hero below it gets the sv-hero-secondary divider class` | `.sv-hero` no longer renders anywhere on this route (the whole smart-view hero moved to `PhotosAlbums.vue`, which has its own layout with no `.sv-hero-secondary` concept). There is no "relationship with the smart-views hero" left to test on either side of the split. |
| `when the band is absent, sv-hero does not carry that class` | Same reasoning. |

Two tests in the old `AI 横幅三态` describe (`缺字段 → 横幅不在` / `reject → 横幅不在`)
happened to still pass after the rewrite (they check `[data-test="svs-ai-banner"]` does not
exist, which is trivially true now that the element was deleted outright) — these were
deleted anyway rather than kept, since a test that can no longer fail on this page is not
meaningful coverage; the underlying "banner state on config edge cases" behavior is covered
in `PhotosAlbums.test.ts` for the surviving full banner.

## TDD evidence

**RED** — added the four brief-style cases (adapted, see corrections) to
`PhotosSmartViews.moments.test.ts` before touching `PhotosSmartViews.vue`:

```
$ pnpm exec vitest run src/views/PhotosSmartViews.moments.test.ts
 FAIL  ... > renders the Moments band as the page's only hero (h1)...
   Expected: "时刻"   Received: "相册"          (h1 not yet promoted / wrong h1 picked up)
 FAIL  ... > no longer fetches the smart view list on this page
   expected "vi.fn()" to not be called at all, but actually been called 1 times
 FAIL  ... > shows the slim settings hint instead of the band...
   expected false to be true                    (mo-off-hint did not exist yet)
 Tests  3 failed | 14 passed (17)
```

RED for the sidebar label (added before editing `PhotosSidebar.vue`):

```
$ pnpm exec vitest run src/photos/components/__tests__/PhotosSidebar.test.ts
 5 failed | 17 passed (22)   (4 pre-existing '智能视图' assertions + 1 new label test)
```

RED for the back-link redirects was implicit in this task (the source edit and its test
update were made together per link, since each is a single-line destination string) — the
mutation checks below serve as the RED/GREEN pair for that behaviour instead.

**GREEN** — after implementing Steps 3-6:

```
$ pnpm exec vitest run src/views/__tests__/PhotosSmartViews.test.ts \
    src/views/PhotosSmartViews.moments.test.ts \
    src/views/__tests__/PhotosSmartViewDetail.test.ts \
    src/photos/components/__tests__/PhotosSidebar.test.ts \
    src/views/__tests__/PhotosSearch.test.ts src/i18n/parity.test.ts --reporter=verbose
 Test Files  6 passed (6)
      Tests  197 passed (197)
```

Full brief Step 7 command:

```
$ pnpm exec vitest run src/views/__tests__ src/photos/components/__tests__/PhotosSidebar.test.ts \
    src/styles src/i18n/parity.test.ts
 Test Files  26 passed (26)
      Tests  1643 passed (1643)

$ pnpm exec vue-tsc --noEmit
(clean, no output)
```

## Mutation checks

1. **(a) Revert the back-link destination.** Reverted all three `/photos/albums` pushes in
   `PhotosSmartViewDetail.vue` back to `/photos/smart-views`:
   ```
   3 failed | 69 passed (72)   (the not-found-back, detail-bar-back, and post-delete
                                 redirect tests all went red)
   ```
   Reverted back to `/photos/albums` — confirmed the fix is what's making the tests pass,
   not an unrelated pass-through.

2. **(b) Revert the sidebar `labelKey`.** Changed `photosMoForYou` back to
   `photosSvSmartViews` in `PhotosSidebar.vue`:
   ```
   5 failed | 17 passed (22)   (all 5 relabeled assertions went red, including the new
                                 dedicated label test)
   ```
   Reverted back.

3. **(c) Make the slim hint render unconditionally.** Changed
   `v-else-if="aiSmartViewOff"` to `v-if="true"` on `.mo-off-hint`:
   ```
   1 failed | 14 passed (15)   ("shows neither the band nor the hint when there are simply
                                 no moments" went red — hint rendered with no moments and
                                 aiFeatures on)
   ```
   Reverted back to `v-else-if="aiSmartViewOff"`.

All three mutations produced the expected red; all three were reverted and reconfirmed green.

## Grep results

```
$ grep -rn "photosSvSavedSearchesStayLive\|photosSvDescribeWantSetQuality" src/  → (none)
$ grep -rn "photosSvAllSmartViews" src/
  src/views/PhotosSmartViewDetail.vue:555        (comment only, names the deleted key)
  src/views/__tests__/PhotosSmartViewDetail.test.ts:166,201   (comments only)
$ grep -rn "photosSvSmartViews\b" src/i18n/*.photos.ts src/views/PhotosSmartViewDetail.vue
  present in both locales + AreaShell title fallback — key correctly retained
$ grep -n "createOpen" src/views/PhotosSmartViews.vue  → (none)
$ grep -n "SmartViewCard\|SmartViewCreateDialog\|usePhotosSmartViews" src/views/PhotosSmartViews.vue
  → only a comment mentioning SmartViewCard's unrelated .sv-collage-badge technique;
    no import/usage
```

No leftover live references to any deleted key or symbol.

## Files changed

- `src/views/PhotosSmartViews.vue`
- `src/photos/components/PhotosSidebar.vue`
- `src/views/PhotosSmartViewDetail.vue`
- `src/views/PhotosSearch.vue`
- `src/i18n/zh_cn.photos.ts`
- `src/i18n/en_us.photos.ts`
- `src/views/__tests__/PhotosSmartViews.test.ts`
- `src/views/PhotosSmartViews.moments.test.ts`
- `src/views/__tests__/PhotosSmartViewDetail.test.ts`
- `src/photos/components/__tests__/PhotosSidebar.test.ts`
- `src/views/__tests__/PhotosSearch.test.ts`
- `src/views/__tests__/PhotosPlaces.test.ts` (not in the brief's list — see corrections)

## Self-review findings

- Confirmed every listed symbol/CSS rule is gone via grep (see above); `.sv-grid` base rule
  kept; `h2`→`h1` done in both template and selector; slim hint present with `--dem-*`
  tokens; sidebar label changed with `id`/`route` untouched; all four redirects done, the two
  Moment-detail redirects (`PhotosMomentDetail.vue:386`/`:544`) untouched (grepped —
  unaffected, still point at `/photos/moments`); three dead keys gone from both locales;
  `photosSvSmartViews` still present in both locales and still used as the detail page's
  `AreaShell` title.
- **Real-device empty state verified as correct, not a bug**: with no moments and
  `aiFeatures.smartview` not explicitly false, the page renders neither the band nor the
  hint (blank main area under the sidebar) — confirmed by both the "no moments" test case and
  mutation check (c).
- Ran the six affected test files once with `--reporter=verbose`: no `[Vue warn]` output
  attributable to this task's changes. The pre-existing `[intlify] Not found` warning that
  appeared transiently during RED (missing `photosMoForYou` key before Step 3) is gone in the
  final GREEN run. One pre-existing, unrelated `[photos-settings] fetchAiFeatures TypeError:
  ...getConfig is not a function` warning appears in `PhotosSmartViewDetail.test.ts` and
  `PhotosSearch.test.ts` runs — verified via `git stash` that this fires identically on the
  pre-Task-5 baseline (57 occurrences before my changes too), so it is not something this
  task introduced or is responsible for fixing.
- Nothing from Tasks 6-8 (album detail sidebar, more-menu reshape, conversion flows) was
  touched. No unrelated refactoring — the only files edited are exactly the brief's list plus
  `PhotosPlaces.test.ts` (a required follow-on fix, see below).
- **oss/*.test.mjs transient failures explained, not a regression**: a full `pnpm test` run
  while the git worktree is still dirty (this task's uncommitted changes) fails 3-4
  `oss/*.test.mjs` cases with "工作树不干净,导出中止" — `export.mjs` refuses to run
  against a dirty tree. Verified with `git stash` (clean tree) that these same tests pass
  (76/76) both on the pre-Task-5 baseline and with Task 5's changes stashed back in; the
  failure is solely a function of uncommitted state at test-run time, not a defect in this
  task's code. They will pass once this commit lands and the tree is clean again.

## Final full-suite confirmation (post-commit, clean tree)

```
$ git status --short   → (nothing; tree clean after the commit)
$ pnpm test
 Test Files  1 failed | 684 passed (685)
      Tests  1 failed | 10889 passed (10890)
```

The single failure is `src/home/components/DesktopContextMenu.test.ts > ... handles a
right-click on blank canvas` — a file this task never touched, unrelated to Photos entirely.
Confirmed order-dependent/flaky: `pnpm exec vitest run src/home/components/
DesktopContextMenu.test.ts` in isolation passes 6/6. The `oss/*` failures seen during
in-progress runs (dirty tree) are gone now that the tree is clean, exactly as predicted.

## Issues or concerns

- None outstanding. The `oss/*` transient failures above are the only "failures" seen during
  this task and are explained, not a real defect.
- `photosSearchOpenSmartViews`'s Chinese/English label text ("在智能视图中打开" / "Open in
  Smart Views") is now slightly stale relative to its actual destination (Albums, which mixes
  smart views with regular albums) — the brief scoped this task to the redirect only, not the
  label, so this is left as-is per the dispatch's explicit instruction ("Vue2 shipped a
  button whose label lies..." registration was only required for the two
  `PhotosSmartViewDetail.vue` buttons, not this one). Flagging for whoever does the
  whole-branch review in case the label should also be revisited, but not changing it
  unilaterally since the dispatch scoped the search-page change to "1 处回链" (redirect only).

## Brief corrections

1. **Sidebar test selector (dispatch-corrected, confirmed independently)**: the brief's
   snippet used `[data-nav-id="smart-views"]`, which does not exist in `PhotosSidebar.vue`
   (grep-confirmed zero `data-nav-id` attributes anywhere in the component). Used
   `.side-name` text collection instead, per the dispatch's correction.
2. **`sv-detail-back` did not exist (dispatch-corrected, confirmed independently)**: the
   detail-bar back button at (then) `:547` had no `data-test` before this task. Added it as
   instructed.
3. **`PhotosSmartViews.moments.test.ts` needed edits too, despite not being in the brief's
   file list.** The brief's "Files" section only lists `PhotosSmartViews.test.ts` for test
   changes, but the Moments band's own test file (`PhotosSmartViews.moments.test.ts`, a
   sibling created in SP15-P1) had two cases (`sv-hero-secondary` divider checks) that became
   obsolete the moment `.sv-hero` was deleted from this page, and needed the new h1/no-band
   cases added there instead of duplicating `PhotosSmartViews.test.ts`'s smaller scope.
4. **`w.find('h1')` picks up the wrong element.** A literal reading of the brief's Step 1
   snippet (`w.find('h1').text()).toContain('时刻')`) fails even after correctly promoting
   `.mo-hero h2` to `h1`, because `PhotosSidebar.vue` renders its own `h1`
   (`photosTitle` = "相册") earlier in DOM order. Scoped the assertion to `.mo-hero h1`
   instead.
5. **`PhotosSearch.vue:499`'s redirect keeps its label, unlike the two
   `PhotosSmartViewDetail.vue` buttons** — the brief's Step 6 says "两个按钮的文案
   `photosSvAllSmartViews` → `photosAlbumBack`" (two buttons), which is exactly the two
   `PhotosSmartViewDetail.vue` buttons that literally use that key; `PhotosSearch.vue`'s
   link uses a different key (`photosSearchOpenSmartViews`) that the brief never asks to
   change. Confirmed by counting: only two `t('photosSvAllSmartViews')` call sites exist in
   the whole repo, both in `PhotosSmartViewDetail.vue`.
6. **`PhotosPlaces.test.ts` needed a fix not mentioned anywhere in the brief or dispatch.**
   Its sidebar-NAV-order regression test (`侧栏 NAV 顺序为 library, albums, people, places,
   smart-views, favorites, trash`) asserts the full rendered `.side-name` text sequence,
   including the literal string `'智能视图'`. This only surfaced on a full `pnpm test` run
   (the brief's Step 7 command list does not include this file) — a good illustration of why
   the task instructions ask for a full-suite run before the final commit even when a
   narrower command list is given.
7. **The oss export tests are not actually broken** — see "Issues or concerns" above; worth
   noting explicitly since a full-suite run mid-task will show them red and could be
   mistaken for a real regression.
