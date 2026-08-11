# Task 2 report: 混排模型与全局排序（纯函数）

## What was implemented

- Created `src/photos/util/mixedAlbums.ts` (verbatim from brief Step 3): `MixedSortId`,
  `MixedAlbumItem`, `buildMixedAlbums`, `sortMixed`. Comparators read `title`/`count` per
  kind, `createdAt` per kind (smart falls back through its own `createdAt`), and `date`
  reads `dateStart` for manual albums / falls back to `createdAt` for smart albums. A
  missing timestamp sorts FIRST (not last), per Vue2 939a7d3a:PhotosAlbumsView.vue:686-693.
- Created `src/photos/util/__tests__/mixedAlbums.test.ts` (from brief Step 1, with two
  corrected expectations — see "Ordering expectations hand-computed" below).
- Deleted `sortAlbums` and its whole `describe` block from `src/photos/util/albumView.ts`
  / `albumView.test.ts`, added the header note about the deletion.
- Deleted `photosAlbumSortUpdated` / `photosAlbumSortUpdatedHint` from both
  `src/i18n/zh_cn.photos.ts` and `src/i18n/en_us.photos.ts`.
- `src/views/PhotosAlbums.vue`: removed the `'updated'` entry from `sortOptions`, removed
  `'updated'` from the local `SortId` union, changed `sort`'s initial value to `'created'`.
  Additionally fixed the type-check break this caused (see "Files fixed for type-checking"
  below) by adding a temporary, unexported, private `sortAlbums` copy in the file itself —
  not by wiring in `mixedAlbums.ts`/`sortMixed` (explicitly out of scope for T2; that is
  Task 3's job).
- `src/views/__tests__/PhotosAlbums.test.ts`: rewrote the one test that asserted the old
  default (`updated` passthrough) with a new English description and distinct `createdAt`
  fixtures so it actually proves the `created`-descending default, then that switching to
  `name` re-sorts alphabetically.

## TDD evidence

**RED** — module didn't exist yet (test file written first, `mixedAlbums.ts` moved aside):
```
$ mv src/photos/util/mixedAlbums.ts /tmp/.../mixedAlbums.ts.bak
$ pnpm exec vitest run src/photos/util/__tests__/mixedAlbums.test.ts
 FAIL  src/photos/util/__tests__/mixedAlbums.test.ts [ src/photos/util/__tests__/mixedAlbums.test.ts ]
Error: Failed to resolve import "../mixedAlbums" from "src/photos/util/__tests__/mixedAlbums.test.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```
Expected failure: the module doesn't exist yet.

**RED (second pass)** — after restoring the module (implemented verbatim from the brief),
two assertions failed because the brief's own fixture expectations were wrong (see next
section):
```
$ pnpm exec vitest run src/photos/util/__tests__/mixedAlbums.test.ts
 × sorts by name across both kinds, not smart-first
   AssertionError: expected [ 's1','u1','u2','s2' ] to deeply equal [ 's1','u1','s2','u2' ]
 × ranks a missing date FIRST too, and reads dateStart for manual albums
   AssertionError: expected [ 's2','s1','u2','u1' ] to deeply equal [ 's2','u2','s1','u1' ]
 Test Files  1 failed (1)
      Tests  2 failed | 6 passed (8)
```

**GREEN** — after correcting the two expected arrays (implementation left untouched):
```
$ pnpm exec vitest run src/photos/util/__tests__/mixedAlbums.test.ts
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

## Ordering expectations hand-computed (brief errors found)

The implementation is a direct, verified match of Vue2 939a7d3a:PhotosAlbumsView.vue:670-700
(re-read the actual source, not just the brief's paraphrase, to confirm). Two of the brief's
test-fixture expected arrays are internally inconsistent with that implementation:

1. **`sortMixed(items, 'name')` / `'name-r'`.** Titles: s1=Alpha, s2=Gamma, u1=Beta,
   u2=Delta. Alphabetical ascending order is Alpha, Beta, **Delta**, **Gamma** ('D' < 'G'),
   i.e. `['s1','u1','u2','s2']`, not the brief's `['s1','u1','s2','u2']` (which put Gamma
   before Delta). Descending is the reverse: `['s2','u2','u1','s1']`, not the brief's
   `['u2','s2','u1','s1']`. Verified with `Array.prototype.sort` + `localeCompare` directly
   in node — the brief had s2/u2 transposed in both arrays.
2. **`sortMixed(items, 'date')`.** s1 (smart) falls back to its own `createdAt` =
   `2026-06-01T00:00:00Z` (ms 1780272000000). u2 (manual) uses `dateStart` =
   `2026-01-01` (ms 1767225600000). `1780272000000 > 1767225600000`, so s1 outranks u2 in
   the ms-descending sort. Correct order (nulls first): `['s2','s1','u2','u1']`, not the
   brief's `['s2','u2','s1','u1']` (which had s1/u2 transposed). Verified with
   `node -e "Date.parse(...)"` before touching the test.

Both corrections are documented inline in the test file with the arithmetic reasoning, so
a future reader who "fixes" them back to the brief's values will see why not to.

No implementation change was made to chase these — the module's logic was left exactly as
given in the brief (and matches Vue2 verbatim), only the test's expected arrays were
corrected.

## Null-first mutation check

Flipped `byMsDesc`'s null-handling branches (swapped `-1`/`1`, so a missing timestamp
sorts LAST instead of FIRST) and re-ran the test file:
```
 × ranks a missing createdAt FIRST, not last
   AssertionError: expected [ 's1','u1','u2','s2' ] to deeply equal [ 's2','s1','u1','u2' ]
 × ranks a missing date FIRST too, and reads dateStart for manual albums
   AssertionError: expected [ 's1','u2','u1','s2' ] to deeply equal [ 's2','s1','u2','u1' ]
 Test Files  1 failed (1)
      Tests  2 failed | 6 passed (8)
```
Both null-first tests went red as expected, confirming they actually exercise the
null-first rule and are not vacuously true. Reverted the mutation immediately after.

## OSS export check (Step 8) — actual result

Ran after committing (the export tool requires a clean tree; `--allow-dirty-oss` only
permits dirt inside `oss/` itself, not the whole source tree):
```
$ node oss/export.mjs --out .../oss-t2 --no-commit --allow-dirty-oss
[oss] 1/6 前置检查
[oss]   New-UI e85dec44(共享包已内联,不再取第二个仓)
[oss] 2/6 取源
[oss] 3/6 应用清单(DELETE 78 · REPLACE 4 · PATCH 258)
[oss] 4.5/6 重算 lockfile(...)
[oss] 5/6 泄漏守卫
[oss]   ⚠ 3 个文件未做内容扫描(二进制/符号链接,预期内,不计入泄漏判定): ...(wallpaper jpgs, settings.png)
[oss]   零真实泄漏命中(3 个预期内跳过已记录,见上方与 .export-report.txt)
[oss] 6/6 落盘
[oss] 完成
```
Zero real leakage. Confirmed `src/photos/` (including the new `mixedAlbums.ts` and its
test) is entirely absent from the exported tree — `ls oss-t2/src/photos` → "No such file
or directory". The brief's assumption that the whole-directory strip covers this without a
manifest edit holds.

## Files changed

- `src/photos/util/mixedAlbums.ts` — new
- `src/photos/util/__tests__/mixedAlbums.test.ts` — new
- `src/photos/util/albumView.ts` — deleted `sortAlbums`, added header note
- `src/photos/util/__tests__/albumView.test.ts` — deleted `sortAlbums` describe + import
- `src/i18n/zh_cn.photos.ts`, `src/i18n/en_us.photos.ts` — deleted 2 dead keys each
- `src/views/PhotosAlbums.vue` — removed `'updated'` sort option/SortId member, changed
  default to `'created'`, **and** (fix for type-checking, see below) added a temporary
  private `sortAlbums` copy so the file keeps compiling without pulling in
  `mixedAlbums.ts`/a smart-view store early
- `src/views/__tests__/PhotosAlbums.test.ts` — rewrote one test (new English description,
  distinct `createdAt` fixtures, new expected orders)

### Files fixed for type-checking (brief correction)

`src/views/PhotosAlbums.vue` imported and called `sortAlbums` from `albumView.ts`
(`views` computed, line 68 pre-edit). Deleting `sortAlbums` per Step 5 breaks this import
with a genuine `vue-tsc` error ("has no exported member 'sortAlbums'") — this is a real
compile break, not merely the i18n-key issue the brief's Step 6 note attributes it to
(this repo's `t()` calls are not strictly typed against the message-key schema, so
removing i18n keys alone does not fail `vue-tsc`; only the broken import does).
Per the task's ambiguity item #4, fixed this minimally: dropped `sortAlbums` from the
import and added a private, unexported, byte-for-byte copy of the old function body
directly in `PhotosAlbums.vue`, documented as a temporary duplicate that Task 3 deletes
wholesale when it rewires the view onto `buildMixedAlbums`/`sortMixed`. This keeps the
diff to "dead option removed" without pulling `mixedAlbums.ts`, a smart-view store, or
template changes into T2 (all explicitly reserved for Task 3).

## Self-review findings

- Completeness: module + tests created; `sortAlbums` and its whole `describe` gone with
  the import removed; both locale files' dead keys removed; `albumView.ts` header note
  added. Confirmed via `grep -rn "sortAlbums" src/` — only the local, documented,
  interim copy in `PhotosAlbums.vue` remains (see next task's job to remove it).
- Quality: exported names checked character-for-character against the Interfaces list —
  `MixedSortId`, `MixedAlbumItem`, `buildMixedAlbums`, `sortMixed` all match.
- Discipline: `PhotosAlbums.vue` diff has no `mixedItems`, no smart-view store import, no
  template change — confirmed by re-reading the staged diff before committing.
- Testing: null-first mutation check performed and reported above (both tests go red).
- Test output: `pnpm exec vitest run src/photos/util src/views/__tests__/PhotosAlbums.test.ts src/i18n/parity.test.ts`
  → 29 files / 369 tests, no stray console/`[Vue warn]` output.
- Full-suite run: `pnpm exec vitest run` (no filter) → 4 failed test files / 3 failed
  tests, all under `oss/*.test.mjs`, identical (same test names) to a baseline run taken
  on the pre-Task-2 commit (`git stash` then re-run) — these are pre-existing, unrelated
  to this task. One earlier full-suite run showed 5 failed/4 failed (an extra
  `DesktopContextMenu` wallpaper-picker failure plus an extra `export-rsync` failure);
  re-running cleanly reproduced exactly the 4-file/3-test baseline, so that extra failure
  was flaky/order-dependent, not caused by this change.
- `vue-tsc --noEmit` — clean, exit 0.
- `.superpowers/sdd/.gitignore`: found present on disk (regenerated by the sdd tooling,
  matching the standing memory note) but **not showing in plain `git status`** — it
  self-ignores via its own `*` rule inside the same directory, so it only appears with
  `git status --ignored`. Removed it with `rm -f` before `git add -A` per the task's
  instruction #5, so this task's ledger files (`task-1-brief.md`, `task-1-report.md`,
  `progress.md`, `task-2-brief.md`) are now tracked in git, consistent with the standing
  "ledger is tracked in git" policy. This task's own report (`task-2-report.md`) is
  written after the commit, per the same pattern `task-1-report.md` followed relative to
  commit `85efc7d` (it also postdated its commit and was swept in by this task's
  `git add -A` instead).

## Issues or concerns

None blocking. The one thing worth flagging for whoever plans Task 3: `PhotosAlbums.vue`
now carries a private, unexported `sortAlbums` duplicate (documented as interim) that
Task 3 must delete in its entirety when it rewires the view onto
`buildMixedAlbums`/`sortMixed` — it is not a leftover to preserve.

## Corrections to the brief

1. **Step 4's warning materialized for real, in two of the eight tests** (`name`/`name-r`
   and `date`), not hypothetically. Both were arithmetic errors in the brief's own fixture
   (title alphabetization and a cross-kind timestamp comparison), not implementation bugs.
   Corrected with inline arithmetic comments; see "Ordering expectations hand-computed"
   above for the full computation.
2. **Step 6's claim that deleting the two i18n keys is what "would otherwise break that
   view" is imprecise.** This repo's `t()` calls are not schema-typed, so a missing i18n
   key does not fail `vue-tsc` — it only affects runtime label/hint text. The actual
   compile break is `sortAlbums` disappearing from `albumView.ts` while `PhotosAlbums.vue`
   still imports and calls it. Step 6's three listed edits (remove `'updated'` option,
   remove from `SortId`, change default) do not by themselves fix this; a fourth edit
   (documented above) was required to keep the tree compiling without pulling `mixedAlbums.ts`
   into this task, which the "ambiguity already resolved" item #4 anticipated in general
   terms but the specific Step 6 prose did not call out for this particular file.
3. **Step 8's premise held, but only after Step 9 (commit).** `--allow-dirty-oss` does not
   let `oss/export.mjs` run against a dirty *source* tree — it only tolerates dirt inside
   `oss/` itself. Running the Step 8 command before committing (as its position in the
   brief's step order implies) fails with "工作树不干净,导出中止". Ran it after the
   commit instead; result unchanged in substance (zero real leakage, `src/photos` absent
   from the export).
4. **`.superpowers/sdd/.gitignore` did not show up in a plain `git status` despite being
   present on disk** — it self-ignores via its own `*` rule, so checking "did it reappear
   in `git status`" (the task's literal instruction #5 phrasing) would have missed it. Had
   to check with `git status --ignored=matching` / `git check-ignore` to find it.

## Commit

`e85dec4` — "feat(photos): rank manual and smart albums with one comparator" (12 files
changed: the 8 code/i18n files from this task plus 4 pre-existing untracked ledger files
that `.superpowers/sdd/.gitignore`'s removal unblocked).

---

# Fix round (review response)

The review found one Important and one Minor. Both are fixed below.

## Important 1 — interim private `sortAlbums` copy retained the OLD (wrong) semantics

**Root cause, as the coordinator diagnosed:** plan Step 6 asked for two things that can't
both hold — delete the shared `sortAlbums`, and leave `PhotosAlbums.vue` rendering through
its old `views` computed unchanged. My fix-for-type-checking in the original round (a
private, unexported, byte-for-byte copy of the deleted function) kept the tree compiling
but silently reintroduced the exact bug this task exists to invert: that copy's `ts()`
helper coerced a missing/unparseable timestamp to epoch `0`, sorting it LAST, on the one
page a user can actually reach today. `sortMixed` (the new, correct module) sorts a
missing timestamp FIRST. Two comparators with opposite missing-value semantics were
coexisting in the same feature — the precise failure mode Task 2 was built to prevent —
and nothing would have failed if Task 3 forgot to delete the private copy.

**Fix applied**, scoped to Task 2 only (no Task 3 work pulled forward):

- `src/views/PhotosAlbums.vue`: deleted the private `sortAlbums` function entirely.
  Imported `buildMixedAlbums`/`sortMixed` from `../photos/util/mixedAlbums`. The interim
  `views` computed now runs the user albums through `buildMixedAlbums(userViews, [])` (no
  smart-view store — that's still Task 3's job) → `sortMixed(..., sort.value)` → unwraps
  back to `AlbumView[]` by filtering to `kind === 'user'` items:

  ```ts
  const views = computed<AlbumView[]>(() => {
    const userViews = albums.albums.map((a) => albumToView(a, t('photosAlbumUntitled')))
    const mixed = sortMixed(buildMixedAlbums(userViews, []), sort.value)
    return mixed
      .map((item): AlbumView | null => (item.kind === 'user' ? item.view : null))
      .filter((v): v is AlbumView => v !== null)
  })
  ```
  There is now exactly one implementation of the missing-timestamp rule in the codebase,
  and the live page already gets the corrected "missing sorts first" ordering — not just
  the not-yet-wired `mixedAlbums.ts` module in isolation.
- Updated the stale top-of-file comment ("排序:接 T1 sortAlbums") to point at
  `util/mixedAlbums.ts`'s `sortMixed`.
- Added a regression test to `src/views/__tests__/PhotosAlbums.test.ts`: two albums, one
  with `createdAt: null`, mounted through the real component (not the module in
  isolation); asserts the null-`createdAt` album renders FIRST under the default
  `created` sort. This is what makes the fix load-bearing rather than a promise about
  Task 3 — it fails if anyone reintroduces a "missing sorts last" comparator anywhere in
  this view's render path.

**Mutation check (live-page regression test):** flipped `byMsDesc`'s null-handling
branches in `mixedAlbums.ts` (swap `-1`/`1`, missing sorts LAST) and re-ran the new
PhotosAlbums test:
```
$ pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts -t "missing createdAt FIRST"
 × ranks an album with a missing createdAt FIRST under the default created sort
   AssertionError: expected [ 'Has Date', 'No Date' ] to deeply equal [ 'No Date', 'Has Date' ]
 Test Files  1 failed (1)
      Tests  1 failed | 20 skipped (21)
```
Went red as expected — confirms the test actually exercises the live wiring, not just the
module. Reverted the mutation immediately after and re-ran to confirm green.

## Minor 1 — untested `isNaN` branch in `msOf`

Added a fixture to `src/photos/util/__tests__/mixedAlbums.test.ts` with a non-empty but
unparseable `createdAt` (`'not-a-date'`), distinct from the pre-existing `''`-empty-string
fixture (which short-circuits on `msOf`'s `!raw` check before `Date.parse` ever runs, so it
cannot exercise the `isNaN` branch at all).

First attempt at this fixture was itself a near-miss: I initially put the "garbage" item on
the smart side and the "valid" item on the user side, which happened to make
`buildMixedAlbums`'s pre-sort order (smart-first concatenation) coincide with the expected
post-sort order. Running the mutation check below against that version showed **zero
failures** — a broken `isNaN` check (returning raw `NaN` instead of `null`) makes the
comparator's `bv - av` evaluate to `NaN`, which V8's sort treats as "no swap," silently
preserving pre-sort order. Since pre-sort and expected-post-sort order were identical by
construction, the test passed for the wrong reason. Caught this via the mandated mutation
check, not by inspection. Fixed by swapping which item is smart vs. user so the two orders
differ, making the assertion sensitive to the mutation.

**Mutation check (isNaN branch), on the corrected fixture:**
```
$ # msOf: changed `return isNaN(t) ? null : t` to `return t`
$ pnpm exec vitest run src/photos/util/__tests__/mixedAlbums.test.ts
 × treats an unparseable createdAt as missing, same as an absent one
   AssertionError: expected [ 'valid', 'garbage' ] to deeply equal [ 'garbage', 'valid' ]
 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)
```
Exactly one test failed (the new one) — confirms isolation from the other eight. Reverted
the mutation and re-ran to confirm green.

## Commands run and output

```
$ pnpm exec vitest run src/photos/util/__tests__/mixedAlbums.test.ts src/views/__tests__/PhotosAlbums.test.ts
 Test Files  2 passed (2)
      Tests  30 passed (30)

$ pnpm exec vue-tsc --noEmit
(no output, exit 0)
```

## On the "pre-existing oss failures" note

Acknowledged — the coordinator's explanation (that suite asserts a clean working tree,
and my own untracked `task-2-report.md` was what made it red) is correct and matches what
I independently observed structurally (same failing test names appeared on a stashed
"baseline" run too, which I now understand was *also* dirty, just with different
untracked files at that moment). Nothing further to fix here per the coordinator's
instruction.

## `.superpowers/sdd/.gitignore` reappeared again

Confirmed present again on disk after the fix round (regenerated by the sdd tooling, as
expected per the standing memory note) and this time it did show up under
`git status --ignored=matching` (labeled `!!`). Removed with `rm -f` before `git add -A`,
consistent with instruction #5 from the original task and the coordinator's note that the
ledger should be committed before gates run.

## Files changed (fix round)

- `src/views/PhotosAlbums.vue` — removed the private `sortAlbums` copy; `views` computed
  now delegates to `buildMixedAlbums`/`sortMixed`; updated header comment
- `src/views/__tests__/PhotosAlbums.test.ts` — added the live-page null-first regression
  test
- `src/photos/util/__tests__/mixedAlbums.test.ts` — added the unparseable-`createdAt`
  fixture/test
- `src/photos/util/mixedAlbums.ts` — unchanged (no implementation bug; both mutation
  checks were against the already-correct code, to validate the new tests)
