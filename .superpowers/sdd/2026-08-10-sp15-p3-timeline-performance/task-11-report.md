# Task 11 report: 收藏页分页 + 精确总数 + 已加载提示

## Summary

Implemented pagination for `GET /photos/favorites` in the favorites store and view, matching
the brief exactly. The backend (NimoOS-Photos#54) turned an absent `limit` from "everything"
into 500, so the favorites page was silently truncating to the first 500 favorites with no
on-screen indication. This closes that gap:

- `favorites.ts`: `fetchFavorites()` now always requests page one (`listFavorites(500, 0)`) and
  resets the pagination cursor; a new `loadMoreFavorites()` appends subsequent pages behind a
  cursor (`_offset`); `favoritesExhausted` flips true once a page comes back shorter than 500;
  `favoritesTotal` is a computed that prefers the exact `favIds.size` once `favIdsLoaded` is
  true, falling back to the loaded-list length beforehand (no flash of 0); a generation counter
  (`_generation`) guards against a slow `loadMoreFavorites()` page landing after a
  `fetchFavorites()` refresh — it is dropped whole, not appended.
- `PhotosFavorites.vue`: the "All N" chip now reads `fav.favoritesTotal` instead of
  `favoritesList?.length`; a load-more button (`.bar-btn`, disabled while `fav.loadingMore`)
  appears below the grid while `!fav.favoritesExhausted`; a muted hint line
  (`photosLoadedSubsetHint`, reusing the `--fg-muted`/13px treatment already used by
  `.fav-count`) appears above the hero stats while pages remain, saying the derived
  stats/facets only cover what's loaded so far.
- Two new i18n keys (`photosLoadedSubsetHint`, `photosLoadMore`) added verbatim to both
  `zh_cn.photos.ts` and `en_us.photos.ts`, placed together right after the existing
  New-UI-only failure-state cluster (`photosFavoritesLoadFailed`/`photosAlbumLoadFailed`/
  `photosRetry`), just before the `── SP15-P1 Moments ──` section header. That cluster is
  the natural home: it's the file's existing home for New-UI-only additions with no Vue2
  equivalent, and the two keys are ordered relative to each other per the brief's own
  (case-insensitive alphabetical) ordering — "Loaded" before "LoadMore". The file as a whole
  is not globally alphabetized (its top section preserves Vue2's original json order verbatim
  for an equivalence guarantee that predates this task), so a literal "insert at the true
  alphabetical position among all ~700 keys" reading would have meant splicing into that
  preserved block for no functional benefit; I judged the New-UI-only cluster to be the
  intended target of "insert alphabetically among the existing photos* keys" instruction.
- `toggle()` now also resets `favoritesExhausted`/`_offset` on success, so the next
  `fetchFavorites()` (which the Favorites view always calls after a toggle-driven refresh)
  starts clean instead of carrying over a stale exhaustion flag from before the toggle.
- `__resetForTest()` clears the four new pieces of state (`favoritesExhausted`, `loadingMore`,
  `_offset`, `_generation`).

## TDD evidence

**RED** — added the brief's 7 store test cases (interleaved-stale-page test included verbatim)
plus one extra (`toggling a favorite resets the cursor...`) to
`src/photos/stores/__tests__/favorites.test.ts`, then ran:

```
pnpm test src/photos/stores/__tests__/favorites.test.ts
```

Result: 8 failed / 13 passed. Failures were exactly the new cases —
`TypeError: s.loadMoreFavorites is not a function` (interface didn't exist yet),
`expected undefined to be 500` (`favoritesTotal` didn't exist), a 5s timeout on the
failed-page-cursor case (no `loadingMore` reset path existed to let the test's awaited
promise settle in the old single-fetch shape), confirming the tests were exercising code
that didn't exist yet, not passing vacuously.

**GREEN** — implemented `favoritesExhausted`, `loadingMore`, `favoritesTotal`,
`loadMoreFavorites()`, the rewritten `fetchFavorites()`, the `toggle()` cursor reset, and the
`__resetForTest()`/return-object updates, then:

```
pnpm test src/photos/stores/__tests__/favorites.test.ts
```
→ 21 passed (21).

Then implemented the view changes (chip, hint line, load-more button, CSS) and wrote the
brief's three sketched view tests in full against
`src/views/__tests__/PhotosFavorites.test.ts`'s existing mount harness:

```
pnpm test src/views/__tests__/PhotosFavorites.test.ts
```
→ 32 passed (32).

**Correction (flagged in review):** the breakdown originally given here — "23 pre-existing +
9 new" — was wrong. The file had 29 pre-existing `it(...)` blocks, and this round's diff adds
exactly the 3 `it(...)` blocks the brief sketched (inside the new `describe('pagination (Task
11)', ...)` block), landing at 29 + 3 = 32. The 32/32 total was right; the arithmetic behind
it was not.

## Full verification run

```
pnpm test src/photos/stores/__tests__/favorites.test.ts src/views/__tests__/PhotosFavorites.test.ts
```
→ store 21/21, view 32/32.

```
pnpm test src/i18n
```
→ 189/189 (includes `parity.test.ts` — zh/en key sets match).

```
pnpm exec vue-tsc --noEmit
```
→ clean, no errors.

```
pnpm test src/photos src/views/__tests__/PhotosFavorites.test.ts
```
→ 2094/2094 (broader photos-area regression check).

Full suite before committing (`pnpm test`) surfaced 3 pre-existing failures in
`oss/cli-args.test.mjs` / `oss/export-rsync.test.mjs` — these assert the OSS export tool
refuses to run against a dirty working tree, and my uncommitted changes *were* that dirty
tree. Verified with `git stash` that these 2 files (6 tests) pass cleanly against the
unmodified base branch, confirming this was a tree-state artifact, not a regression.

After committing (`748d79e`), reran the full suite on the clean tree:

```
pnpm test
```
→ **689 test files / 11067 tests, all passed.** (One stderr line about `/tmp/nimoos-www-*`
not being writable is unrelated pre-existing noise from an unrelated OSS test path, not a
failure — exit was clean.)

```
pnpm exec vue-tsc --noEmit
```
→ clean (exit 0) on the committed tree too.

Test output otherwise pristine apart from the documented known non-defects: jsdom
`Not implemented: navigation` (from `exportZip`'s `window.location.href = url` in jsdom,
triggered whenever a test calls `exportZip`/`toggle` — pre-existing, not introduced by this
task).

## Self-review (per the task's checklist)

- First page asks for exactly 500 at offset 0 — `listFavorites(FAVORITES_PAGE_SIZE, 0)` in
  `fetchFavorites()`; asserted directly in the test.
- Exhaustion detected from a short page — `favoritesExhausted.value = rows.length < FAVORITES_PAGE_SIZE`
  in both `fetchFavorites()` and `loadMoreFavorites()`.
- Load-more appends and advances — `favoritesList.value = [...prev, ...newRows]`;
  `_offset += rows.length`.
- A second concurrent load-more does nothing — `loadingMore.value` is set synchronously
  before the first `await`, so the second call's guard (`if (favoritesExhausted.value ||
  loadingMore.value) return`) short-circuits it; verified by the "does not run two loadMore
  requests at once" test (exactly 2 total calls: 1 initial fetch + 1 loadMore).
- An interleaved stale page is discarded whole — the generation captured before the request
  is compared against the live counter after it resolves; on mismatch the function returns
  before touching `favoritesList`/`_offset`/`favoritesExhausted`. Verified with the brief's
  own interleaved test (a controlled promise that resolves *after* a refresh bumps the
  generation).
- A failed page leaves the cursor where it was — the `catch` block in `loadMoreFavorites()`
  only logs, does not touch `_offset`; verified the retry re-asks for the same offset (500).
- The total is exact once ids land and never flashes 0 before that — `favoritesTotal` falls
  back to `favoritesList.value?.length` while `favIdsLoaded` is false; verified 500 (loaded
  count) before `reconcileFavIds()`, 1234 (exact) after.
- `favoritesLoaded`/`loadError` semantics preserved — untouched by this task's changes;
  all 13 pre-existing store tests covering that behavior still pass unmodified.
- Toggling a favorite resets the cursor — added `favoritesExhausted.value = false; _offset = 0`
  to `toggle()`'s success path, with a dedicated regression test.
- Test output pristine — confirmed above; only documented known non-defects present.

## Files changed

- `src/photos/stores/favorites.ts` — `FAVORITES_PAGE_SIZE`, `favoritesExhausted`,
  `loadingMore`, `favoritesTotal`, `loadMoreFavorites()`, rewritten `fetchFavorites()`,
  `toggle()` cursor reset, `__resetForTest()` and return-object updates.
- `src/views/PhotosFavorites.vue` — "All N" chip now uses `favoritesTotal`; load-more button;
  loaded-subset hint line; three new scoped CSS rules (all token-based, no new colors).
- `src/photos/stores/__tests__/favorites.test.ts` — added the brief's 7 pagination test cases
  plus one extra (toggle cursor reset), inside a new `describe('pagination (Task 11)', ...)`
  block.
- `src/views/__tests__/PhotosFavorites.test.ts` — added the brief's 3 sketched view cases in
  full, inside a new `describe('pagination (Task 11)', ...)` block.
- `src/i18n/zh_cn.photos.ts` / `src/i18n/en_us.photos.ts` — added `photosLoadedSubsetHint`
  and `photosLoadMore`, verbatim values from the brief.

## Concerns

- The "insert alphabetically" placement decision (see Summary above) is a judgment call —
  the file is not globally alphabetized and I placed the two keys at what I judged to be the
  semantically-correct existing New-UI-only-additions cluster rather than literally the true
  alphabetical position among all ~700 keys in the file. If the plan intended a stricter
  reading, this is a one-line relocation, not a design change.
- No new files were created and scope stayed within the six files the brief named.

## Commit

`748d79e` — "fix(photos): page the favorites list instead of asking for everything" (message
verbatim from the brief's Step 7).

---

## Fix round (coordinator review)

The coordinator's review approved the pagination core (generation guard, cursor-on-failure,
exact total, the interleaved race test, i18n, styling, export path, timeline star state
unaffected) and raised two Important findings, both fixed on top of `748d79e` in commit
`7418075`.

### Important 1 — save-as-album silently saved a truncated set

`confirmSaveAlbum()` built `assetIds` straight from `fav.favoritesList` and the modal's
subtitle showed `fav.favoritesList?.length`. Before Task 11 that list *was* everything; after
Task 11 it is at most one page (500 rows). A user with 1,300 favorites who opened the page and
clicked "存为相册" without ever pressing "加载更多" would get an album silently capped at 500
photos, with a modal that agreed with the wrong number — the exact defect this task exists to
remove, recreated one screen over.

**Fix** (`src/views/PhotosFavorites.vue`):
- Added `loadRemainingFavoritesForSave()`: loops `fav.loadMoreFavorites()` while
  `!fav.favoritesExhausted`. Progress is detected by list-length growth rather than a new
  store-exposed flag: a successful page always either appends rows or reaches exhaustion, so
  `after === before && !favoritesExhausted` after a call means the page made no progress at
  all — the store's documented failure behavior (cursor left where it was) — and the loop
  stops instead of spinning forever.
- `confirmSaveAlbum()` now calls this before building `assetIds`, whenever
  `!fav.favoritesExhausted`. If the pagination loop reports a stuck page, it shows the same
  `photosFavSaveFailed` toast this view already uses for `saveAsAlbum` errors, leaves the
  modal open (matching the existing failure-path convention of not clearing the input or
  closing), and does not call `saveAsAlbum` — no knowingly-partial album is ever created.
- The existing `saveAlbumSaving` in-flight guard already covers this: it is set to `true`
  before the pagination loop starts and only cleared in the `finally`, so the confirm button
  stays disabled for the whole page-in-the-rest window — no new state was needed to avoid a
  dead-looking button.
- The modal's subtitle (`photosFavSaveAlbumSub`) now reads `fav.favoritesTotal` instead of
  `fav.favoritesList?.length`, so the number shown before confirming is the number that ends
  up in the album.
- Left the lightbox navigation set (`onOpenTile`, built from the same `favoritesList`) alone,
  per the coordinator's explicit note — it should track what's on screen, not the full set.

### Important 2 — `toggle()` reset the cursor without bumping the generation

`toggle()`'s success path reset `favoritesExhausted`/`_offset` but never touched
`_generation`. Reachable from every grid tile's star and the lightbox. Concrete race: 500
loaded (`_offset = 500`) → user clicks "加载更多" (request in flight, captures generation G) →
before it resolves, the user un-favorites a visible tile → `toggle()` rewinds `_offset` to 0
but leaves the generation at G → the in-flight response is judged fresh (`gen === G` still
holds), appends its 500 rows on top of the already-loaded set, and computes
`_offset = 0 + 500 = 500` — the list now has duplicate rows and the cursor understates the
true position by 500.

**Fix** (`src/photos/stores/favorites.ts`):
- `toggle()`'s success path now does `_generation++` alongside `favoritesExhausted.value =
  false; _offset = 0`, so any load-more already in flight from before the toggle is
  recognized as stale and dropped whole by the existing generation check in
  `loadMoreFavorites()`.
- Follow-up fix to a bug this exposed: `loadMoreFavorites()`'s `finally` block previously only
  reset `loadingMore.value = false` `if (gen === _generation)`. Once `toggle()` bumps the
  generation as part of this fix, a load-more that was in flight when the toggle landed would
  be correctly recognized as stale (so its page is dropped) but would *never* clear
  `loadingMore` — since nothing else resets that flag — permanently disabling the load-more
  button after that interleaving. Changed the reset to unconditional: the reentrancy guard at
  the top of `loadMoreFavorites()` (`if (favoritesExhausted.value || loadingMore.value)
  return`) already guarantees at most one such call is ever in flight, so there is never a
  second, still-current in-flight call whose `loadingMore` an unconditional reset could
  incorrectly clear.

### New regression tests

- `src/photos/stores/__tests__/favorites.test.ts` — added `'a toggle landing while
  loadMoreFavorites is in flight does not corrupt the cursor'`: holds a `loadMoreFavorites()`
  promise open, runs a successful `toggle()` (which bumps the generation), then releases the
  held page and asserts `favoritesList` did not grow to 1000, `loadingMore` is `false`, and —
  the load-bearing assertion — the *next* `loadMoreFavorites()` call requests offset 0 (not
  500), proving the cursor was not corrupted.
- `src/views/__tests__/PhotosFavorites.test.ts` — added two cases inside the existing "存为
  相册" `describe` block:
  - `'submitting with more than one page of favorites pages in the rest first, then saves
    with the exact total'` — first page 500 rows, second (short) page 300 rows, `favIds`
    reconciled to 800; asserts the modal subtitle shows 800 before confirming, confirming
    triggers a `listFavorites(500, 500)` call, `favoritesExhausted` ends `true`, and
    `saveAsAlbum` is called once with all 800 ids.
  - `'a pagination failure during submit does not create a partial album, shows the
    save-failed toast, and leaves the modal open'` — second page rejects; asserts
    `saveAsAlbum` is never called, the `photosFavSaveFailed` toast fires, and the modal stays
    open.
  - Also fixed a pre-existing test ("点击「存为相册」→模态出现...") whose fixture only mocked
    `listFavorites` (2 rows) and relied on the default empty `listFavoriteIds` mock; once the
    subtitle switched to `favoritesTotal`, that combination now correctly reads 0 instead of
    2. Added `svc.photos.listFavoriteIds.mockResolvedValue(['a', 'b'])` to keep the fixture
    honest rather than changing the assertion.

### Mutation verification (both findings)

Before committing, both fixes were verified to actually be load-bearing by reverting each in
turn and confirming the new test(s) go red:

- Reverted `_generation++` in `toggle()`: the new store test failed with
  `expected [ …(1000) ] to have a length of 500 but got 1000` — the exact duplicate-append
  the finding described.
- Reverted the pagination loop in `confirmSaveAlbum()` (called `saveAsAlbum` directly from
  `favoritesList` again): both new view tests failed — `saveSpy` was called with only the
  first 500 ids / was called at all in the failure case, instead of being skipped.

Both reverts were restored immediately after confirming red, and the full targeted suite was
re-run green afterward.

### Test evidence (fix round)

```
pnpm test src/photos/stores/__tests__/favorites.test.ts src/views/__tests__/PhotosFavorites.test.ts
```
→ store 22/22 (21 + 1 new), view 34/34 (32 + 2 new).

```
pnpm exec vue-tsc --noEmit
```
→ clean, no errors.

```
pnpm test src/photos src/views/__tests__/PhotosFavorites.test.ts src/i18n
```
→ 118 test files / 2286 tests, all passed (broader photos-area + i18n regression check).

Full suite on the clean, committed tree (`pnpm test`):
→ **689 test files / 11070 tests, all passed.** vue-tsc clean.

Also re-verified all six Task 11 self-review checklist items and the two new Important
findings hold simultaneously — e.g. the interleaved-stale-page test from the original round
and the new toggle/loadMore interleaving test both pass together, confirming the generation
guard now correctly serializes *every* source of generation bumps (`fetchFavorites`,
`toggle`), not just refreshes.

### Files changed (fix round, on top of `748d79e`)

- `src/photos/stores/favorites.ts` — `toggle()` bumps `_generation`; `loadMoreFavorites()`'s
  `finally` resets `loadingMore` unconditionally.
- `src/views/PhotosFavorites.vue` — `loadRemainingFavoritesForSave()`; `confirmSaveAlbum()`
  pages in the rest before saving and bails out to a failure toast on a stuck page; modal
  subtitle uses `favoritesTotal`.
- `src/photos/stores/__tests__/favorites.test.ts` — one new interleaved regression test.
- `src/views/__tests__/PhotosFavorites.test.ts` — two new tests plus a `pageAssets()` helper;
  one pre-existing test's fixture updated to keep `listFavoriteIds` in sync with the loaded
  page now that the subtitle reads the exact total.

### Concerns (fix round)

None outstanding. Both findings were reproduced via mutation-check before being accepted as
fixed, and the full test suite (including the OSS export gate, which needs a clean tree) is
green on the committed state.

### Commit (fix round)

`7418075` — "fix(photos): page in the rest of favorites before saving as an album".

---

## Fix round 2 (coordinator re-review)

The re-reviewer verified both round-1 findings as ADDRESSED — the save-as-album path pages in
the rest with a stuck-page bail, the modal shows the exact total, and the toggle/loadMore
interleaved test is load-bearing (removing the `_generation` bump reproduces the duplicate-row
corruption). One new Important came in with round 1's own fix, on top of `7418075`, fixed in
commit `13a5e95`.

### New Important — the unconditional `loadingMore` reset could clear a newer call's flag

Round 1's fix to `loadMoreFavorites()`'s `finally` block reset `loadingMore.value = false`
unconditionally, justified by "the reentrancy guard means only one such call is ever in
flight." That justification missed `fetchFavorites()`: it forces `loadingMore.value = false`
synchronously at its own start, independent of any pending `loadMoreFavorites()` call — so the
reentrancy guard's "only one in flight" invariant does not hold across a `fetchFavorites()`
reset. Concrete sequence (all reachable from this page, e.g. via a lightbox/batch delete
refresh):

1. User clicks "加载更多" → call A in flight, `loadingMore = true`.
2. User deletes a favorited photo → `onLightboxDelete`/`onBatchDelete` call `fetchFavorites()`,
   which bumps `_generation` and forces `loadingMore = false` while A is still awaiting the
   network.
3. The button is enabled again; a click starts call B with the new generation,
   `loadingMore = true`.
4. A resolves. It correctly discards its stale page (generation mismatch), but its `finally`
   unconditionally set `loadingMore = false` — clobbering B's flag while B was genuinely still
   in flight. The button would re-enable mid-request, inviting a third overlapping call.

### Fix (`src/photos/stores/favorites.ts`)

Gave `loadingMore` an explicit owner, separate from `_generation` — `_generation` answers "is
this page's data still current"; `loadingMore` answers "does this call still own the button",
and round 1 conflated the two.

- Added `let _loadMoreSeq = 0`, declared inside the store's setup closure next to `_offset` and
  `_generation` (not truly module-level outside `defineStore`) so it resets per store instance
  exactly like those two do, rather than leaking across Pinia instances between tests.
- `loadMoreFavorites()`: `const seq = ++_loadMoreSeq` at the top (this call's claim); its
  `finally` now only clears the flag `if (seq === _loadMoreSeq) loadingMore.value = false` —
  if a newer call (or a `fetchFavorites()` reset) has since bumped the sequence, this call has
  lost ownership and must not touch `loadingMore` at all.
- `fetchFavorites()`: bumps `_loadMoreSeq` alongside `_generation` when it forces the reset, so
  any load-more in flight from before it loses ownership immediately — its later `finally`
  cannot clobber whatever a subsequent `loadMoreFavorites()` call sets.
- `__resetForTest()`: clears `_loadMoreSeq` alongside `_offset`/`_generation`.

Walking the coordinator's trace against the fixed implementation: at step 2, `fetchFavorites()`
bumps `_loadMoreSeq` (say from 1 to 2) while A still holds `seq = 1`. At step 3, B's
`loadMoreFavorites()` bumps it again (`seq = 3`) and sets `loadingMore = true`. At step 4, A's
`finally` checks `seq(1) === _loadMoreSeq(3)` → false → does not touch `loadingMore`, which
stays `true` under B's ownership, exactly as required.

### New regression test

Added to `src/photos/stores/__tests__/favorites.test.ts`:
`'a delete-triggered fetchFavorites landing mid-flight does not let the stale
loadMoreFavorites call clear a newer one's loadingMore'`. It reproduces the coordinator's
exact trace: an initial `fetchFavorites()`, then call A (`loadMoreFavorites()`) held open via
a controlled promise, then a full `fetchFavorites()` (simulating the delete-triggered
refresh) run to completion while A is still pending, then call B (`loadMoreFavorites()`) also
held open, asserting `loadingMore === true` (B's ownership) immediately after starting B, then
releasing A's stale page and asserting `loadingMore` is *still* `true` (not clobbered by A's
`finally`), then releasing B and asserting the flag finally clears to `false`.

### Mutation verification

Before committing, reverted the fix to confirm the new test is load-bearing:

**RED** (unconditional `loadingMore.value = false` in `finally`, no ownership check):
```
pnpm test src/photos/stores/__tests__/favorites.test.ts
```
```
 FAIL  src/photos/stores/__tests__/favorites.test.ts > photosFavorites store > pagination (Task 11) > a delete-triggered fetchFavorites landing mid-flight does not let the stale loadMoreFavorites call clear a newer one's loadingMore
AssertionError: expected false to be true // Object.is equality
- Expected: true
+ Received: false
 ❯ src/photos/stores/__tests__/favorites.test.ts:304:29
    302|       releaseA(page(1, 900))
    303|       await a
    304|       expect(s.loadingMore).toBe(true) // still B's flag, not reset by…

 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)
```
This is exactly the clobbering the finding described: A's stale `finally` reset `loadingMore`
to `false` even though B still legitimately owned it.

**GREEN** (fix restored — ownership-gated reset):
```
pnpm test src/photos/stores/__tests__/favorites.test.ts
```
```
 Test Files  1 passed (1)
      Tests  23 passed (23)
```

### Test evidence (fix round 2)

```
pnpm test src/photos/stores/__tests__/favorites.test.ts src/views/__tests__/PhotosFavorites.test.ts
```
→ store 23/23 (22 + 1 new), view 34/34 (unchanged this round).

```
pnpm exec vue-tsc --noEmit
```
→ clean, no errors.

```
pnpm test src/photos src/views/__tests__/PhotosFavorites.test.ts src/i18n
```
→ 118 test files / 2287 tests, all passed.

Full suite on the clean, committed tree (`pnpm test`):
→ **689 test files / 11071 tests, all passed.**

### Files changed (fix round 2, on top of `7418075`)

- `src/photos/stores/favorites.ts` — added `_loadMoreSeq`; `loadMoreFavorites()`'s `finally`
  gates the `loadingMore` reset on sequence ownership instead of resetting unconditionally;
  `fetchFavorites()` bumps `_loadMoreSeq` alongside `_generation`; `__resetForTest()` clears
  the new counter.
- `src/photos/stores/__tests__/favorites.test.ts` — one new interleaved regression test
  (delete-triggered `fetchFavorites()` racing a `loadMoreFavorites()` while a second
  `loadMoreFavorites()` is also in flight).

### Concerns (fix round 2)

None outstanding. The new finding was mutation-verified (RED without the fix, GREEN with it),
and the full suite — including the OSS export gate, which needs a clean tree — is green on
the committed state. `loadRemainingFavoritesForSave`'s stuck-page detector was left untouched
per the coordinator's explicit instruction (deferred minor, fails safe).

### Commit (fix round 2)

`13a5e95` — "fix(photos): give loadingMore its own ownership sequence".
