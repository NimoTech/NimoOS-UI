# Task 3 report: moments store

## What was implemented

- `src/photos/stores/moments.ts` — the `usePhotosMoments` Pinia store, transcribed from the
  brief's Step 3 code block with comments and JSDoc translated to English (source references
  and line numbers preserved verbatim). One brief-vs-reality fix was needed beyond translation:
  `loadDetail`'s bare-array branch typed `d.assets` as `unknown[]`, which does not satisfy
  `assetToPhoto`'s `Record<string, unknown>` parameter under `vue-tsc --noEmit` — narrowed the
  local type to `Record<string, unknown>[]` instead. No logic changed.
- `src/photos/stores/__tests__/moments.test.ts` — the brief's test file, `describe`/`it` titles
  and comments translated to English; all asserted data (ids, field names, values) left as
  written in the brief since none of it is Chinese-language *data*.

## What was tested and the results

### TDD evidence

**RED** — before `moments.ts` existed:

```
$ pnpm exec vitest run src/photos/stores/__tests__/moments.test.ts --reporter=verbose
FAIL  src/photos/stores/__tests__/moments.test.ts [ src/photos/stores/__tests__/moments.test.ts ]
Error: Failed to resolve import "../moments" from "src/photos/stores/__tests__/moments.test.ts".
Does the file exist?
...
 Test Files  1 failed (1)
      Tests  no tests
```

Expected failure reason confirmed: the test imports `usePhotosMoments` from `../moments`,
which did not exist yet — a module-resolution failure, not a logic failure. This is the
correct RED for "write the test before the implementation."

**GREEN** — after writing `moments.ts`:

```
$ pnpm exec vitest run src/photos/stores/__tests__/moments.test.ts --reporter=verbose
 ✓ normalisation > converts snake_case fields to camelCase field by field
 ✓ normalisation > defaults absent omitempty fields instead of leaving them undefined
 ✓ normalisation > normalises id to String unconditionally (a numeric backend id must not blow up)
 ✓ list and sizeMap > sizeMap tracks moments and is the result of assignMomentSizes
 ✓ list and sizeMap > keeps the old list and still sets listLoaded when fetchMoments fails, instead of clearing the view
 ✓ list and sizeMap > ensureLoaded only fetches once; byId returns undefined before load
 ✓ reordering > applies the optimistic reorder up front and keeps it on success
 ✓ reordering > refetches the list to fully revert on failure, and returns false
 ✓ reordering > bails out conservatively when ids do not match the current list, sending no request and dropping no entries
 ✓ detail assets > loadDetail parses {assets,members,places} and camel-cases members
 ✓ detail assets > tolerates the older backend bare-array shape (members/places default to empty arrays)
 ✓ detail assets > loadAll requests without featured/withMembers and returns a flat Photo array
 ✓ write operations > pin writes the returned asset_count back onto the list item on success
 ✓ write operations > exclude behaves the same way
 ✓ write operations > keeps the previous value instead of writing undefined when the backend omits asset_count
 ✓ write operations > remove drops the entry from the list on success, and sizeMap recomputes accordingly
 ✓ write operations > remove throws and leaves the list untouched on failure
 ✓ write operations > exportAlbum passes {albumId,name,count} through unchanged
 ✓ staleness guard under concurrency > when two fetchMoments calls interleave, the later call wins (the late-arriving earlier response is discarded)

 Test Files  1 passed (1)
      Tests  19 passed (19)
```

**Real case count: 19**, not the brief's estimated 18. All 19 map one-to-one onto the brief's
Step-1 test cases (nothing added, nothing removed) — the brief's own count was simply off by one.

Two tests deliberately exercise a failure path and print `console.error('[photos-moments]
listMoments', Error: boom)` / `...reorderMoments Error: nope` to stderr — this is the store's
intentional error logging (matching the existing `favorites.ts` store's established pattern,
and matching Vue 2's own `console.error`-only handling), not test noise. No `[Vue warn]`, no
unhandled-rejection warnings, and no other stderr output appeared in the run.

### vue-tsc

```
$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

One real type error surfaced along the way (`loadDetail`'s bare-array branch, described above)
and was fixed before this final clean run.

**Unrelated hardlink trap hit during this task**: the first `vue-tsc` run failed with "Property
'listMoments' does not exist" etc. on `service.photos.*` — not because Task 1's HTTP methods
were missing from `packages/service/src/photos.ts` (they were present and committed), but
because the `file:` dependency's hardlink into `node_modules/.pnpm/...` had gone stale, per the
"硬链接陷阱" documented in this repo's `CLAUDE.md`. Confirmed via `stat -c '%i %n'` on both
paths (different inodes), fixed with `pnpm install` (no lockfile change, no `--force`, no `.vite`
cache clear needed), re-confirmed matching inodes afterward. This was pre-existing repo state,
not something this task's own edits caused.

### Full suite

`pnpm test` was run twice: once before committing (dirty tree, to sanity-check my two new files
didn't break anything else) and once after. Before commit: 671/675 test files, 10636/10709 tests
passed; the 3 failures were all the OSS export guard (`oss/cli-args.test.mjs`,
`oss/export-rsync.test.mjs`) refusing to run against an uncommitted working tree — expected
mid-TDD state, not a real failure. After commit, running the `oss/` suite in isolation
(`pnpm exec vitest run oss/`) showed 145/146 passing with one remaining failure — see Concerns.

## Files changed

- `src/photos/stores/moments.ts` (new)
- `src/photos/stores/__tests__/moments.test.ts` (new)

No other files were touched. `src/files/**`, `src/i18n/*.base.ts` untouched. `pnpm-lock.yaml`
unchanged (the `pnpm install` run only re-linked an already-stale `node_modules` hardlink; `git
status` confirms no lockfile diff).

## Self-review findings

- Every method in the brief's Interfaces line is present with the brief's signature:
  `moments`, `listLoading`, `listLoaded`, `sizeMap`, `fetchMoments()`, `byId(id)`,
  `ensureLoaded()`, `setOrder(ids)`, `reorder(ids)`, `loadDetail(id)`, `loadAll(id)`,
  `pin(id, ids)`, `exclude(id, ids)`, `remove(id)`, `exportAlbum(id)`, `applyAssetCount(id, n)`.
  Nothing renamed, nothing dropped.
- No test asserts only that a mock was called with no accompanying behavioral assertion — every
  `toHaveBeenCalledWith` in the test file is paired with an assertion on real store state or a
  real return value in the same test.
- Nothing added beyond what the brief specifies — no extra exports, no extra store fields, no
  extra test cases.
- Test output is pristine apart from the two intentional `console.error` lines described above.

## Concerns

- The brief's plan said "18 个用例"; the actual, correct count is 19. Reported per instruction
   3 (report what was observed, don't force the number).
- The stale-hardlink issue was pre-existing (from Task 1/2's commits, made via atomic-write
  tooling per this repo's documented trap) and unrelated to this task's own code — flagging it
  here only because `vue-tsc` failed until `pnpm install` was run; future tasks in this worktree
  may hit the same false-negative if they run `vue-tsc` without first checking hardlink health.
- **Pre-existing, out-of-scope OSS leak-guard gap (not introduced by this task):**
  `pnpm exec vitest run oss/` fails one test, `oss/tree.test.mjs > 泄漏守卫 > 不带 --skip-guard
  也能跑通`, because the OSS export's forbidden-word/leak guard flags 24 lines in
  `packages/service/src/photos.moments.test.ts` — every line containing the word "photo" in a
  file that Task 1 (commit `732eb2f`) added before this task started. I never touched that file;
  `git log --oneline --all -- packages/service/src/photos.moments.test.ts` shows only `732eb2f`
  and `f44c44b`, both pre-Task-3. This looks like the Photos feature's HTTP layer was landed
  without a corresponding update to the OSS strip-list/forbidden-word allowlist (this workspace's
  memory confirms Photos is one of the areas the public export tree deliberately excludes). It is
  outside this task's named files and outside its brief, so I did not touch `forbidden.mjs` or
  any OSS export config — flagging it here so it gets picked up, likely by whichever task owns
  the OSS export's Photos strip-list.

---

## Fix round 1 (post-review)

Review findings addressed, all confined to `src/photos/stores/moments.ts` and its test file —
no other files touched.

### Finding 1 (Important) — `setOrder` silently dropped an entry on a duplicate id

**Root cause**: `setOrder` validated only `next.length === moments.value.length`. With
`moments.value = [m1, m2]` and `ids = ['m1', 'm1']`, `byIdMap.get('m1')` succeeds twice, `next =
[m1, m1]`, the length check passes, and `m2` silently vanishes from state — with no error and no
way for the caller to notice. This was carried over verbatim from Vue 2's weaker check
(`899af59b:PhotosSmartViewsView.vue:586`), which the repo's 2026-07-27 porting rule explicitly
says not to do: port the UI 1:1, but implement correct logic and register the deviation.

**Fix**: `setOrder` now walks `ids` and rejects (returns `false`, no mutation, no request) unless
the array is a true permutation of the current list — same length, every id resolves to a known
moment, and no id repeats (tracked via a `Set`). Every existing rejection case (wrong length,
unknown id) keeps the same conservative "reject cleanly" behavior; only the acceptance condition
got stricter.

**Regression test added** (`reordering > rejects a duplicate id instead of silently dropping the
entry it displaces`): `moments = [m1, m2]`, `reorder(['m1', 'm1'])` must return `false`, must not
call `reorderMoments`, and must leave `moments` as `['m1', 'm2']`. Verified by hand that this
fails against the pre-fix code: `ids.length` (2) equals `moments.value.length` (2), so the old
length-only check would return `true` and silently reorder to `[m1]`-effectively — the new test
would catch that regression.

**Deviation registered**: added as file-header item 3 ("Four deliberate differences from Vue 2"),
same tone as items 1–2, naming the exact Vue 2 source line (`PhotosSmartViewsView.vue:586`) and
the mechanism of the data loss.

### Finding 2 (Minor) — unregistered throw-through divergence

Added file-header item 4: `pin` / `exclude` / `remove` / `loadDetail` / `loadAll` throw through on
failure, where Vue 2's equivalents (`899af59b:PhotosMomentDetail.vue:376-400,427-428`)
caught-swallowed-and-toasted internally. No code change — this design is correct (UI feedback is
the view layer's job, handled in later tasks) and was already implemented this way; only the
documentation gap is fixed.

### Finding 3 (Minor) — redundant cast on `sizeMap`

Removed `as Record<string, { size: MomentSize; template: MomentTemplate }>` from the `sizeMap`
computed — `assignMomentSizes`'s return type already matches exactly. Also dropped the now-unused
`MomentSize` / `MomentTemplate` type-only imports from `../util/momentLayout` (nothing else in the
file referenced them after the cast was removed).

### Verification

```
$ pnpm exec vitest run src/photos/stores/__tests__/moments.test.ts --reporter=verbose
...
 Test Files  1 passed (1)
      Tests  20 passed (20)
```

20 cases (19 from the original implementation + 1 new regression test for Finding 1). All pass,
including the new duplicate-id case. The two intentional `console.error` stderr lines from the
pre-existing failure-path tests (`listMoments`/`reorderMoments` rejection tests) are unchanged and
still the only stderr output — no new noise introduced by this round.

```
$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

### Commit

`30dc0fe` — "fix(photos): reject duplicate ids in moments setOrder" (2 files changed, 45
insertions, 6 deletions — `src/photos/stores/moments.ts` and its test file only).

### Concerns carried forward

Same two pre-existing, out-of-scope items noted above (stale-hardlink trap; the OSS leak-guard gap
in `packages/service/src/photos.moments.test.ts` from Task 1) — unaffected by this fix round.
