# Task 9 report: smart-view detail lightbox navigates in grid order

## What was implemented

`src/views/PhotosSmartViewDetail.vue`:

- `onTileClick(p: Photo)` -> `onTileClick(p: Photo, list: Photo[])`. The function now forwards
  whatever list its caller hands it (`lb.openAt(p, list, 0)`) instead of always reaching for
  `store.matchedAssets`.
- Both grid template call sites updated: the "Recently added" band's tile now calls
  `onTileClick(p, recentSet)`, the "All matches" band's tile calls `onTileClick(p, matchedSet)` --
  `recentSet`/`matchedSet` are the existing Task 6 computeds that apply the current `sortBy`.
- Comments at the `matchedSet`/`recentSet` declaration and above `onTileClick` updated to describe
  the new data flow instead of the old "Task 9's job, not done yet" placeholder language.
- The third argument to `lb.openAt` stays `0`, unchanged. See "Vue2 vs brief" below -- this is not
  an index, and the brief's framing on this point was wrong.

## TDD evidence

**RED** (before implementation, only the fixture/test file changed):
```
pnpm exec vitest run src/views/__tests__/PhotosSmartViewDetail.test.ts src/views/PhotosSmartViewDetail.assets.test.ts src/i18n/parity.test.ts src/styles
```
```
FAIL  ... > SP15-P2c Task 6: header action row > hands the lightbox the order the "all matches" grid is showing, not the backend order
  AssertionError: expected [ 'm1', 'm2', 'm3' ] to deeply equal [ 'm2', 'm3', 'm1' ]
FAIL  ... > SP15-P2c Task 6: header action row > keeps the "recently added" grid on its own sorted list, not the all-matches one
  AssertionError: expected [ 'm1', 'm2', 'm3' ] to deeply equal [ 'r1', 'r2' ]
FAIL  ... > 两段照片网格 > 点 tile → lb.openAt 被调 ...
  AssertionError: expected [ {...} ] not to be [ {...} ]  // Object.is equality
Test Files  1 failed | 6 passed (7)
Tests  3 failed | 1199 passed (1202)
```
All three failed for the expected reason: the component was still handing the lightbox the
unsorted `store.matchedAssets` array (identical content, wrong order for two of them; wrong
reference-vs-content expectation for the third).

**GREEN** (after implementation):
```
pnpm exec vitest run src/views/__tests__/PhotosSmartViewDetail.test.ts src/views/PhotosSmartViewDetail.assets.test.ts src/i18n/parity.test.ts src/styles
Test Files  7 passed (7)
Tests  1202 passed (1202)
```
Ran with `--reporter=verbose` too; the only stderr lines are two `Error: Not implemented:
navigation (except hash changes)` jsdom warnings. Confirmed pre-existing and unrelated: `git
stash` (reverting both my files) and rerunning the same command reproduces the identical 2
occurrences, so this is baseline jsdom noise from an unrelated history/navigation call elsewhere
in the suite, not something this change introduced.

`pnpm exec vue-tsc --noEmit`: clean, no output.

## Mutation check

Changed `lb.openAt(p, list, 0)` back to `lb.openAt(p, store.matchedAssets, 0)` (one-line revert,
temporary, reverted immediately after). Reran the same three targeted test files:

```
FAIL  ... hands the lightbox the order the "all matches" grid is showing, not the backend order
  expected [ 'm1', 'm2', 'm3' ] to deeply equal [ 'm2', 'm3', 'm1' ]
FAIL  ... keeps the "recently added" grid on its own sorted list, not the all-matches one
  expected [ 'm1', 'm2', 'm3' ] to deeply equal [ 'r1', 'r2' ]
FAIL  ... tile click still calls lb.openAt with content matching store.matchedAssets ...
  expected [ {...} ] not to be [ {...} ]
Test Files  1 failed | 1 passed (2)
Tests  3 failed | 115 passed (118)
```
All three reddened. Reverted the mutation; reran the full command above to confirm GREEN again
(1202/1202).

**How the fixture guarantees the sorted and unsorted orders genuinely differ:** the "all matches"
fixture returns `m1` (takenAt 2026-01-10), `m2` (2026-03-05), `m3` (2026-02-01) in that literal
array order -- this *is* what `store.matchedAssets` holds (the mocked backend/score order). After
picking Sort = "Date taken", `sortAlbumPhotos` reorders by `takenAt` descending to `m2, m3, m1` --
a full derangement of the original order (no element stays in the same position, so no possible
click position could look "coincidentally correct" if the array had leaked through unsorted). The
test also clicks the *third* rendered tile specifically, which is `m1` post-sort vs. `m3`
pre-sort -- the strongest single point of divergence. The second test goes further and checks
`recentSet` is not merely "sorted" but *the recent grid's own list, containing entirely different
ids* (`r1`/`r2`, disjoint from `m1`/`m2`/`m3`) -- this is the risk a coincidental-order fixture
cannot expose: a fix that wires both grids to the same sorted `matchedSet` would pass the first
test and still be wrong, and this second test catches exactly that.

## Tests updated (original -> new assertion)

One pre-existing test pinned the old (wrong) contract and had to change, per the brief's warning:

- **File:** `src/views/__tests__/PhotosSmartViewDetail.test.ts`
- **Original:** `it('点 tile → lb.openAt 被调,第二参是 store.matchedAssets 全集、第三参 0、第四参 undefined', ...)` asserting `expect(call[1]).toBe(store.matchedAssets)` (reference equality to the raw store array).
- **New:** `it('tile click still calls lb.openAt with content matching store.matchedAssets (now a separate sorted snapshot, not the same reference), startMs 0, no query', ...)` asserting `expect(call[1]).toEqual(store.matchedAssets)` (same content -- there is only one asset in this fixture, so score-order content is indistinguishable from taken-order content) **and** `expect(call[1]).not.toBe(store.matchedAssets)` (now documented as a different reference, because `sortAlbumPhotos` always returns a fresh `[...photos]` copy, even under the default `'score'` mode -- see `src/photos/util/albumView.ts`'s `sortAlbumPhotos`).

No other tests in either target file pinned the unsorted order; grepped both files for
`matchedAssets`/`recentAssets`/`openAt` occurrences to confirm before editing.

I also translated this test's `it(...)` title from Chinese to English while touching it. The
surrounding file's convention (this file predates SP12's "test descriptions English from here on"
decision) still uses Chinese titles elsewhere, and I left every *untouched* title as-is -- but
because I was rewriting this specific title's content, the phase's global constraint 2 ("anything
you newly author must be English") applies to it, so the new wording is English even though its
unmodified neighbours are not. Confirmed no other newly-authored Chinese slipped in:
`git diff -- src/views/PhotosSmartViewDetail.vue src/views/__tests__/PhotosSmartViewDetail.test.ts | grep -nP '^\+.*[\x{4e00}-\x{9fff}]'` returns nothing.

## Vue2 source vs. brief -- where they disagreed

Fetched `git -C NimoOS-UI show 33b05636:src/views/Photos/PhotosSmartViewDetail.vue`. Two points
where the target and the brief's prose disagreed; target won both times, per the phase rule:

1. **The list argument.** The brief said to swap the second argument of the existing single
   `lb.openAt(p, store.matchedAssets, 0)` call for "the same sorted list the grid uses" -- framed
   as a one-line value swap inside one function. Vue2's actual fix is structural: `onTileClick(p,
   list)` gained a *second parameter*, and the two `v-for` templates changed from
   `@click="onTileClick(p)"` to `@click="onTileClick(p, recentSet)"` /
   `@click="onTileClick(p, photoSet)"` respectively (Vue2 lines 96/107; `photoSet` is this
   codebase's `matchedSet`). This matters because the page has *two* grids with independently
   sorted views (`recentSet` vs. `matchedSet`/`photoSet`) sharing one handler -- a single computed
   swapped in for "the" sorted list would have wired both grids to the same list, which is exactly
   the bug the second new test (`keeps the "recently added" grid on its own sorted list`) is built
   to catch. Followed the target: added the parameter, updated both call sites.

2. **The third argument / "starting index".** The brief explicitly flagged this as something to
   verify and warned it might not be a constant 0: *"起始下标要用该照片在排序后列表里的位置(不是恒定
   0)"*. Reading `useLightbox.ts`'s `openAt(photo, entryList, startMsArg?, query?)` (lines 55-59)
   shows the third parameter is `startMs`, used only when `photo.isVideo && startMsArg > 0` --
   `openAt` computes `index` itself internally via `photoIndexById(list.value, photo)` (line 57),
   which is *always* correct once the second argument (the list) is right, regardless of what the
   third argument holds. The brief's own citation of the signature (`startMs?`) already
   contradicted its later sentence about "starting index" -- the two clauses of that one paragraph
   disagreed with each other, and the signature (and the code) is the tie-breaker. Kept the third
   argument at the literal `0` it already had; documented why in a new comment at the call site so
   a future reader doesn't reintroduce an index-shaped value there.

No other target-vs-brief conflicts found; the "Interfaces: Consumes T6's sortBy" note matched what
was already wired up by Task 6.

## Files changed

- `src/views/PhotosSmartViewDetail.vue` -- `onTileClick` signature + both template call sites +
  three comments (all newly-authored portions in English; untouched pre-existing Chinese comments
  in the same function left as-is).
- `src/views/__tests__/PhotosSmartViewDetail.test.ts` -- two new tests in the "SP15-P2c Task 6:
  header action row" describe block (reusing its existing `pickSortOption` helper and `asset()`
  fixture builder verbatim), plus the one updated pre-existing test described above.
- No changes to `src/views/PhotosSmartViewDetail.assets.test.ts` -- grepped it for
  `store.matchedAssets`/order-pinning assertions on `openAt`'s second argument; its two lightbox
  tests (`suppresses the lightbox while in edit mode` / `still opens the lightbox outside edit
  mode`) only assert whether `openAt` was called at all, never inspect the list argument, so
  neither needed updating for this task.

## Self-review

- Completeness: both grids fixed, both new tests exercise a real divergent-order fixture (not a
  coincidental one), the one stale-pinning test found by grep was updated not deleted, mutation
  check passed for the correct reason, tsc clean, test count/file count matched expectations (7
  files, 1202 tests, matching the pre-mutation baseline exactly).
- No newly authored Chinese: verified with the grep command from the global constraints, clean.
- No hardcoded color literals: this change touches no CSS and no `<style>` block; verified with a
  regex sweep over the diff for hex/rgb/named colors on added lines -- no hits.
- No `*/ ` adjacency issue: no CSS comments were touched.
- Start-entry parameter: confirmed it is `startMs`, not an index, by reading `useLightbox.ts`
  directly rather than trusting the brief's framing; left it at `0` and documented why.
- Every test that pinned the old behaviour was updated, not deleted (the one found, listed above
  with original -> new assertion).
- pnpm used throughout (`pnpm exec vitest`, `pnpm exec vue-tsc`), tests run in the foreground with
  no backgrounding/Monitor, per the global constraints.

## Concerns

None. This was a small, well-scoped fix once the target was read; the only friction was the
brief's internally-contradictory sentence about the third argument, resolved by reading
`useLightbox.ts` directly as instructed.
