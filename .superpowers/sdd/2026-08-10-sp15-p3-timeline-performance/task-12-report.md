# Task 12 report: 回收站分页 + 清空文案降级

Commit: `ae32fb6` — fix(photos): page the trash list and stop promising a size it cannot know

## What was implemented

### `src/photos/stores/trash.ts`
Mirrored Task 11's favorites pagination shape exactly:
- `TRASH_PAGE_SIZE = 500` module constant.
- New state: `trashExhausted`, `loadingMore`; new closure-local `_offset`, `_generation`,
  `_loadMoreSeq` (all reset in `__resetForTest()`).
- `fetchTrash()` now calls `service.photos.listTrash(500, 0)`, always resets the cursor,
  guards against stale responses via `_generation`, and forces `loadingMore` false + bumps
  `_loadMoreSeq` on every call (a full reset revokes any in-flight `loadMoreTrash()`'s claim
  on the flag). Only flips `loaded = true` on success (preserved, per the brief).
- New `loadMoreTrash()`: appends the next page at `_offset`, advances the cursor only on
  success, discards a response whole if `_generation` moved on since the call started, and
  clears `loadingMore` in `finally` only if this call's `seq` still matches `_loadMoreSeq`
  (the ownership split from Task 11 round 2).
- `restore/restoreAll/purge/empty/undoRestore` were left untouched — each already ends with
  `await fetchTrash()`, which is now correctly "go back to page one".
- Both `fetchTrash` and `loadMoreTrash` map rows through the existing
  `trashAssetToPhoto(asset, retentionDays.value)` — unchanged mapping, just applied per-page.

### `src/views/PhotosTrash.vue`
- `emptyTrash()`: captures `const exact = trash.trashExhausted` once at confirm-build time (so
  the choice observed by the user matches what the toast reports even if trash state changes
  before they click through); confirm body is `photosTrashEmptyBodyPartial` when `!exact`,
  `photosTrashEmptyBody({size})` when `exact`; success toast follows the same split between
  `photosTrashEmptiedToastPartial` / `photosTrashEmptiedToast({size})`.
- `restoreAll()` / its confirm and toast: untouched, per the brief — those copies never quoted
  a size.
- Hero sub-line: appended a conditional `<span data-test="trash-loaded-hint">` after the
  `{{ totalSize }} MB` figure, shown while `!trash.trashExhausted`, rendering
  `photosLoadedSubsetHint` (reused from Task 11, no new key).
- New "load more" button/section (`data-test="trash-load-more"`) below the bucketed grid,
  visible while `!trash.trashExhausted`, disabled while `trash.loadingMore`, calling
  `trash.loadMoreTrash()` — same shape as `PhotosFavorites.vue`'s `.fav-load-more`.
- New CSS: `.trash-hero-sub [data-test="trash-loaded-hint"]` (reuses `--fg-muted`, same as the
  rest of that line) and `.trash-load-more` / `.trash-load-more .bar-btn:disabled` (reuses
  `.bar-btn` + `--fg-muted`-style disabled treatment, same as `.fav-load-more`). No new tokens,
  no hex/rgb/named colors.

### i18n
Added exactly two keys to both `src/i18n/zh_cn.photos.ts` and `src/i18n/en_us.photos.ts`,
placed directly after `photosTrashEmptiedToast` (the local cluster of trash toast/body keys),
values verbatim from the brief:
- `photosTrashEmptiedToastPartial`
- `photosTrashEmptyBodyPartial`

## Tests

### Store (`src/photos/stores/__tests__/trash.test.ts`)
Added a new `describe('photosTrash store — pagination (Task 12)')` block with the same seven
shapes as Task 11's favorites suite, plus the ownership-race case:
1. `fetchTrash asks for one page and reports exhaustion on a short page`
2. `loadMoreTrash appends the next page and advances the offset`
3. `refuses to page past the end`
4. `does not run two loadMore requests at once`
5. `discards a stale in-flight page after a refresh (interleaved)`
6. `resets the cursor on a failed page so the next attempt does not skip rows`
7. `fetchTrash resets the cursor so a later refresh starts from page one`
8. `a restore-triggered fetchTrash landing mid-flight does not let the stale loadMoreTrash
   call clear a newer one's loadingMore` (the ownership-sequence case)

Also added one `beforeEach` line in this block: `(service.photos.listTrash as any).mockClear()`
— needed because the pre-existing top-level `beforeEach` in this file never cleared
`listTrash`'s call history (the older tests only used `toHaveBeenCalled()`, which doesn't
care), and my new tests assert exact call counts / `toHaveBeenLastCalledWith`, which do.

### View (`src/views/__tests__/PhotosTrash.test.ts`)
Added three tests as complete runnable code (not left as brief comments):
1. `uses the size-less empty copy while pages remain` — seeds a full 500-row page, asserts
   `trash.trashExhausted === false`, opens the empty-trash confirm, asserts the modal body is
   exactly the Partial copy and contains no "MB".
2. `uses the exact copy with the freed size once everything is loaded` — seeds a 1-row (short)
   page, asserts `trashExhausted === true`, asserts the modal body contains "MB" and is not the
   Partial string.
3. `shows the load-more button only while pages remain` — asserts the button and the hint span
   both exist with a full page and both are absent with a short page.

## TDD evidence

**RED**: stashed only `src/photos/stores/trash.ts` (kept the new tests), ran
`pnpm test src/photos/stores/__tests__/trash.test.ts`:

```
FAIL … refuses to page past the end
TypeError: s.loadMoreTrash is not a function
FAIL … does not run two loadMore requests at once
TypeError: s.loadMoreTrash is not a function
FAIL … discards a stale in-flight page after a refresh (interleaved)
TypeError: s.loadMoreTrash is not a function
FAIL … resets the cursor on a failed page so the next attempt does not skip rows
Error: Test timed out in 5000ms.
FAIL … fetchTrash resets the cursor so a later refresh starts from page one
TypeError: s.loadMoreTrash is not a function
FAIL … a restore-triggered fetchTrash landing mid-flight …
TypeError: s.loadMoreTrash is not a function

Test Files  1 failed (1)
     Tests  8 failed | 16 passed (24)
```

Expected: without `loadMoreTrash`/`trashExhausted`/`loadingMore` on the store, every test that
calls `loadMoreTrash()` throws `TypeError`, and the one that mocks a rejection with no timeout
guard hangs because the old `fetchTrash()` (no limit/offset args, no generation guard) doesn't
match what the test expects to observe — confirms the tests actually exercise the new surface
before it exists.

Restored the store (`git stash pop`), fixed one accumulated-call-count bug the RED run
surfaced (the block's own `beforeEach` didn't clear `listTrash`'s history, so two count-based
assertions saw stale counts from earlier tests in the same file) by adding the `mockClear()`
line, then reran.

**GREEN**:
```
pnpm test src/photos/stores/__tests__/trash.test.ts
 Test Files  1 passed (1)
      Tests  24 passed (24)

pnpm test src/views/__tests__/PhotosTrash.test.ts
 Test Files  1 passed (1)
      Tests  12 passed (12)

pnpm test src/photos/stores/__tests__/trash.test.ts src/views/__tests__/PhotosTrash.test.ts src/i18n
 Test Files  9 passed (9)
      Tests  225 passed (225)

pnpm exec vue-tsc --noEmit
(clean, no output)
```

Also ran the full suite (`pnpm test`, foreground, ~193s):
```
Test Files  4 failed | 685 passed (689)
     Tests  3 failed | 11009 passed | 70 skipped (11082)
```
The 3 failures were all in `oss/cli-args.test.mjs` / `oss/export-rsync.test.mjs`, and all for
the same reason: those tests actually invoke `export.mjs`, which refuses to run against a dirty
working tree — and my changes were still uncommitted at that point. Verified by stashing my
diff and rerunning just those two files against the clean tree: both passed (6/6). Reran again
after committing: 6/6 green. Not a regression from this task.

Ran with `--reporter=verbose` and grepped for warnings — none found (no `[Vue warn]` noise, no
hidden failures behind the compact reporter).

## Self-review (against the brief's checklist)

- First page asks `500, 0`: yes (`fetchTrash` test #1: `expect(service.photos.listTrash).toHaveBeenCalledWith(500, 0)`).
- Exhaustion detected: yes (short-page test, and the pre-existing 1-row fixtures in the view
  test file now naturally land in the exhausted branch too).
- Append + advance: yes (`loadMoreTrash` test asserts `toHaveBeenLastCalledWith(500, 500)` and
  `items` length 502).
- No double-request: yes (`does not run two loadMore requests at once` asserts exactly 2 total
  calls across `fetchTrash` + both concurrent `loadMoreTrash()` attempts).
- Interleaved stale page discarded whole: yes (`discards a stale in-flight page after a refresh`
  asserts `items` length stays at 1, not 501).
- Failed page keeps the cursor: yes (`resets the cursor on a failed page…` — after a rejected
  `loadMoreTrash()`, the next successful call is still asked for offset 500, not skipped).
- Ownership split present and tested: yes — `_loadMoreSeq` in the store, and the dedicated
  ownership-race test (`a restore-triggered fetchTrash landing mid-flight…`) passes.
- Empty-trash confirm/toast drop the size while pages remain, quote it once exhausted: yes,
  both in the store-level logic and the two new view tests.
- Restore-all path untouched: confirmed via `git diff` — no changes to `restoreAll()`,
  `photosTrashRestoreAllTitle`/`Body`, or `photosTrashRestoredToast` usage.
- Hero's size line carries the subset hint while pages remain: yes
  (`data-test="trash-loaded-hint"`, `photosLoadedSubsetHint` reused, no new key).
- Every mutating action still returns to page one: yes — `restore/restoreAll/purge/empty/
  undoRestore` all still end with `await fetchTrash()`, which now always resets `_offset` to 0
  and re-asks page one.
- Test output pristine: yes, verbose reporter shows no warnings across the three targeted
  suites.

## Files changed
- `src/photos/stores/trash.ts`
- `src/views/PhotosTrash.vue`
- `src/photos/stores/__tests__/trash.test.ts`
- `src/views/__tests__/PhotosTrash.test.ts`
- `src/i18n/zh_cn.photos.ts`
- `src/i18n/en_us.photos.ts`

## Concerns

None outstanding. One judgment call worth flagging: in `emptyTrash()` I capture
`const exact = trash.trashExhausted` once when the confirm dialog is built (not re-read at
`onConfirm` time), so the copy the user reads in the confirm and the copy in the resulting
toast are guaranteed consistent with each other even if a background `loadMoreTrash()`
completes between opening the dialog and clicking through. This wasn't explicitly specified in
the brief but follows directly from "answer the question the user is looking at, not a
different one by the time they click" — the same reasoning documented for
`newui-dialog-error-not-toast` conventions in this codebase. Not committed as a test case
(would require racing a real load-more against dialog confirmation in the view test, which felt
like scope creep beyond the brief's three named cases) — flagging for awareness only.

## Fix round 2 (coordinator review)

Commit: `7c59096` — fix(photos): page in the rest before trash's bulk actions decide what to say

### Findings addressed

**Important 1 — empty-trash confirmation quoted a count smaller than what is actually
destroyed.** `count = trash.items.length` fed `photosTrashEmptyTitle2` unconditionally,
gated only on `!trash.items.length` for the button's disabled state — with more than 500
items (`TRASH_PAGE_SIZE`), the announced count was smaller than what `service.photos
.emptyTrash()` actually destroys server-side (the entire trash, unconditionally).

**Important 2 — restore-all's Undo silently reverted only part of what it restored.**
`count`/`ids` both came from the loaded page, but `restoreAllTrash()` restores everything
server-side. With pages remaining, `undoIds` held only a subset — clicking Undo moved that
subset back to trash while the rest stayed restored with no way back, undetectable to the
user. The confirm title and success toast understated the count for the same root cause.

### Fix shape

Both findings share one root cause (client-side `trash.items` != server-side "everything"),
so both are fixed with the same mechanism, applied on click of either hero action, before the
confirm dialog is built:

- New `loadRemainingTrashForBulkAction()` in `PhotosTrash.vue` — pages in the rest via
  `trash.loadMoreTrash()` in a loop until `trashExhausted`, detecting a stuck page the same
  way `loadRemainingFavoritesForSave` in `PhotosFavorites.vue` does (list-length growth; no
  growth and not yet exhausted ⇒ stop rather than spin), without the store exposing its
  private offset.
- New `preparingBulkAction` ref guards both hero buttons (`:disabled="!trash.items.length ||
  preparingBulkAction"`) so the button isn't a dead click during the paging step, and so the
  two bulk actions can't race each other.
- `restoreAll()` and `emptyTrash()` are now `async`. Each: bails early if already exhausted or
  already preparing; otherwise awaits the paging helper; then captures `const exact =
  trash.trashExhausted` **after** the paging attempt (not before) — this is what keeps the
  confirm body and the eventual toast in agreement with what actually happened, per the
  reviewer's specific ask to preserve that property from round 1.
  - `exact === true` (paging succeeded, or was already exhausted): exact copy
    (`photosTrashEmptyBody`/`photosTrashEmptiedToast` with `{size}`, real `{count}` in both
    titles), and for restore-all, `undoIds` legitimately covers every restored id.
  - `exact === false` (paging got stuck): `photosTrashEmptyBodyPartial` /
    `photosTrashEmptiedToastPartial` for empty-trash (already existed, exactly the case they
    were built for); for both actions' confirm **title**, reused the existing bare
    action-label key already on the corresponding hero button — `photosTrashEmpty` ("Empty
    trash") and `photosTrashRestoreAll` ("Restore all") — since neither quotes a count and no
    dedicated count-less title key existed. No new i18n keys were added this round; every
    existing key was checked for fit first, per the reviewer's explicit instruction to report
    NEEDS_CONTEXT rather than invent one if none fit — one did fit in both cases (the button's
    own label), so no such report was needed.
  - For restore-all specifically when stuck: `undoIds = null` and the success toast is shown
    with **no action** (omits the `{ label, onClick }` third argument entirely) rather than
    offering an undo known to cover only part of what was restored. Left the toast's own count
    text (`photosTrashRestoredToast`) as-is in this branch — no existing count-less variant of
    that toast fits, and the reviewer's explicit fix instructions for restore-all's stuck path
    named only "omit the Undo action" (not a toast-copy split), so I did not invent a matching
    `photosTrashRestoredToastPartial` key. Flagging this as a residual, out-of-scope-per-brief
    imprecision below.
- Per-selection paths (`restore`, `restoreSelected`, `deleteSelected`/`purge`, `undoRestore`
  with explicit ids) were **not touched** — verified via `git diff` that only `restoreAll()`
  and `emptyTrash()` changed.

### Tests added (`src/views/__tests__/PhotosTrash.test.ts`)

New `describe('bulk hero actions page in the rest before acting (Task 12 fix round 2)')`
block with the four cases the reviewer specified, all complete runnable code:
1. `empty-trash with pages remaining pages in the rest first and then quotes the full count
   and size` — seeds a full 500-row page + a 2-row tail page, clicks Empty, asserts
   `trashExhausted` flips to `true`, `items` reaches 502, `listTrash` was last called with
   `(500, 500)`, and the confirm title/body quote `502`/`MB`.
2. `empty-trash when a page gets stuck shows the count-less/size-less copy and still lets the
   action proceed` — seeds a full page then a rejected tail page, asserts the confirm still
   opens (`.trash-modal-scrim` exists) with the bare title (`'清空最近删除'`) and the exact
   Partial body string, then confirms through and asserts `emptyTrash()` still gets called and
   the toast shows the Partial text.
3. `restore-all with pages remaining restores and offers an Undo whose id set covers
   everything that was restored` — seeds a full page + 1-row tail, confirms, asserts
   `trash.restoreAll` was called, the toast's Undo button exists, and clicking it calls
   `trash.undoRestore` with an id array of length 501 (not 500).
4. `restore-all when a page gets stuck offers no Undo action` — seeds a full page then a
   rejected tail page, asserts the bare title (`'恢复全部'`), confirms through, and asserts no
   `.toast-action` element exists in the resulting toast.

Also updated the two pre-existing round-1 tests (`uses the size-less empty copy while pages
remain`, and implicitly verified `uses the exact copy…` needed no change): the size-less-copy
test previously seeded every `listTrash` call with the same full 500-row page via
`mockResolvedValue` (not `Once`) — under the round-2 behavior this makes
`loadRemainingTrashForBulkAction()`'s while-loop keep receiving fresh full pages forever
(never short, so `trashExhausted` never flips, and "before === after" never triggers either
since `items.length` keeps growing by 500 each iteration) — an actual infinite loop that
manifested as `Cannot call text on empty DOMWrapper` (the confirm dialog never got a chance to
render within the awaited flushes). Fixed by making its load-more call reject instead, so it
exercises the same "stuck" path as the new test 2 above, and added the missing
`flushPromises()`/console.error spy this scenario now requires.

### TDD evidence (fix round 2)

**RED**: ran `pnpm test src/views/__tests__/PhotosTrash.test.ts` immediately after adding the
four new tests but before touching `PhotosTrash.vue`'s `restoreAll()`/`emptyTrash()`:
```
FAIL … empty-trash with pages remaining pages in the rest first and then quotes the full count and size
FAIL … empty-trash when a page gets stuck shows the count-less/size-less copy and still lets the action proceed
FAIL … restore-all with pages remaining restores and offers an Undo whose id set covers everything that was restored
FAIL … restore-all when a page gets stuck offers no Undo action
```
(all four failed on assertions like the title not containing the expected count, or
`svc.photos.listTrash` never being called with `(500, 500)` — since the pre-fix
`restoreAll()`/`emptyTrash()` never paged at all.) The pre-existing `uses the size-less empty
copy while pages remain` test also started failing/hanging at this point once its mock was
left unchanged against the new expectations, which is what led to discovering and fixing the
infinite-loop mock issue described above, before implementation.

**GREEN**, after implementing the fix:
```
pnpm test src/views/__tests__/PhotosTrash.test.ts
 Test Files  1 passed (1)
      Tests  16 passed (16)

pnpm test src/photos/stores/__tests__/trash.test.ts src/views/__tests__/PhotosTrash.test.ts
 Test Files  2 passed (2)
      Tests  40 passed (40)

pnpm test src/i18n
 Test Files  7 passed (7)
      Tests  189 passed (189)

pnpm exec vue-tsc --noEmit
(clean, no output)
```
Also ran `pnpm test src/views/__tests__/PhotosTrash.test.ts --reporter=verbose` and grepped
for warnings — none found beyond the pre-existing benign `i18n-t` re-registration notice that
was already present before this round (harness artifact of mounting the same `createI18n`
instance across test files in one run, unrelated to this change).

### Self-review

- Important 1 fixed: empty-trash title/body/toast all use the exact count/size only after a
  successful full page-in; the stuck path never quotes a smaller-than-reality number.
- Important 2 fixed: restore-all's Undo id set is verified (test 3) to cover every restored
  item, not just the first page; the stuck path (test 4) offers no Undo at all.
- `exact` captured after the paging attempt, not before, in both actions.
- No new i18n keys added; existing keys re-checked for fit before reuse, per instruction.
- Per-selection paths untouched (confirmed via diff).
- All four specified tests present as complete runnable code, plus the pre-existing tests
  repaired rather than left flaky/hanging.

### Residual concern

Restore-all's success toast, in the rare "paging got stuck" branch, still quotes
`photosTrashRestoredToast`'s `{count}` using the loaded (possibly partial) length — only the
Undo action is omitted, per the reviewer's literal instruction for that branch. Since
`restoreAllTrash()` restores everything server-side regardless, this count can still
understate reality in that specific edge case (a mid-operation network failure while forcing a
full page-in, which itself only happens when the user had more than 500 trashed items and
paging broke partway through). No existing i18n key fit a count-less "restored" toast, and the
reviewer's explicit fix instructions for this branch named only the Undo removal — so rather
than invent a `photosTrashRestoredToastPartial` key unprompted, I left the count as-is and am
flagging the gap here for a decision, consistent with how the reviewer wants unfit-key
situations handled elsewhere in this task.
