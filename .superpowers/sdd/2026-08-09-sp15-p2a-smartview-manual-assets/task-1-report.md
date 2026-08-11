# Task 1 Report — SP15-P2a data layer (smart view manual asset actions)

## Summary

Implemented the four service methods, the four store actions, and the `pinned`
field exactly as specified in the brief's Interfaces block, following TDD
(failing test → implementation → passing test) at both the service layer and
the store layer. One deviation from the brief's literal implementation snippet
was required to make the brief's own test pass (see "Deviation" below). Commit:
`e702f2c` — `feat(photos): add the smart view manual asset actions` (message
verbatim from the brief).

## Files changed

- `packages/service/src/photos.ts` — added `pinSmartViewAssets`,
  `removeSmartViewAssets`, `restoreSmartViewAssets`, `getSmartViewExcluded`.
- `packages/service/src/photos.smartviewAssets.test.ts` (new) — 5 tests.
- `src/photos/util/assetToPhoto.ts` — added `pinned: boolean` to `Photo` and
  `pinned: !!asset.pinned` to `assetToPhoto`.
- `src/photos/stores/smartViews.ts` — added `excluded`, `excludedLoading`,
  `assetBusy` state; `refreshStats` (private helper), `pinAssets`,
  `removeAssets`, `restoreAssets`, `loadExcluded` actions; wired into
  `__resetForTest` and the store's return block.
- `src/photos/stores/__tests__/smartViews.assets.test.ts` (new) — 11 tests.
- `src/photos/composables/__tests__/usePersonDetail.test.ts` — added
  `pinned: false` to the local `Photo` fixture builder `P()`, required by
  `vue-tsc` once `pinned` became a mandatory field on `Photo`. This is the
  only file touched outside the brief's explicit list; it is a pure fixture
  fix, no logic changed.

All of the store file's pre-existing Chinese comments were left untouched;
only newly-added code carries comments, and those are in English.

## TDD evidence

### Step 1–4: service layer

RED — `pnpm exec vitest run packages/service/src/photos.smartviewAssets.test.ts --reporter=verbose`
(before implementing the four methods):
```
FAIL … pinSmartViewAssets posts {assetIds} and returns the change count
TypeError: a.photos.pinSmartViewAssets is not a function
FAIL … removeSmartViewAssets hits the /remove suffix and returns both tiers
TypeError: a.photos.removeSmartViewAssets is not a function
FAIL … restoreSmartViewAssets hits the /restore suffix
TypeError: a.photos.restoreSmartViewAssets is not a function
FAIL … the three write methods fall back to an empty object when the body is absent
TypeError: a.photos.pinSmartViewAssets is not a function
FAIL … getSmartViewExcluded reads the bare array, defaulting to empty
TypeError: a.photos.getSmartViewExcluded is not a function

Test Files  1 failed (1)
     Tests  5 failed (5)
```
Failed for the expected reason (method doesn't exist yet).

GREEN — same command after implementing the four methods per the brief's Step 3
snippet, **with one adjustment** (see Deviation below):
```
✓ pinSmartViewAssets posts {assetIds} and returns the change count
✓ removeSmartViewAssets hits the /remove suffix and returns both tiers
✓ restoreSmartViewAssets hits the /restore suffix
✓ the three write methods fall back to an empty object when the body is absent
✓ getSmartViewExcluded reads the bare array, defaulting to empty

Test Files  1 passed (1)
     Tests  5 passed (5)
```

### Deviation from the brief's literal service snippet

The brief's Step 3 code for `getSmartViewExcluded` is:
```ts
return body<unknown[]>(res.data) ?? []
```
Running the brief's own Step 1 test against this literal implementation
**fails**: `harness(undefined)` (used in `getSmartViewExcluded`'s second
sub-case) doesn't produce `reply === undefined` — JS default-parameter
substitution kicks in on an explicit `undefined` argument
(`function harness(reply = {}) {}`; confirmed with `node -e "function f(x={foo:1}){return x} console.log(f(undefined))"` → `{ foo: 1 }`), so `reply` becomes
`{}`. `body({})` returns `{}` unchanged (it's not null/''), and `{} ?? []`
does not fire because `{}` is not nullish — so the brief's snippet returns
`{}`, not `[]`, and the assertion `toEqual([])` fails.

This is an internal inconsistency between the brief's test and its
implementation snippet, not a case of the brief contradicting the existing
codebase. I resolved it by guarding on `Array.isArray` instead of nullish
coalescing alone:
```ts
async getSmartViewExcluded(id: string | number): Promise<unknown[]> {
  const res = await http.get(`/photos/smart-views/${id}/excluded`)
  const b = body<unknown>(res.data)
  return Array.isArray(b) ? b : []
}
```
This is a strict superset of the brief's intent (defends against any
non-array response, not just null/undefined/''), makes the given test pass
without weakening any assertion, and required no change to the test file
itself. Documented inline in `photos.ts` at the call site.

### Step 6–9: store layer

RED — `pnpm exec vitest run src/photos/stores/__tests__/smartViews.assets.test.ts --reporter=verbose`
(before implementing the four actions), all 11 failed for the expected reason:
```
TypeError: s.pinAssets is not a function
TypeError: s.removeAssets is not a function      (×3, one per removeAssets test)
TypeError: s.restoreAssets is not a function
TypeError: s.loadExcluded is not a function       (×3, one per loadExcluded test)

Test Files  1 failed (1)
     Tests  11 failed (11)
```

GREEN — same command after implementing the store changes exactly per the
brief's Step 8 snippet (no deviation needed here):
```
✓ pinAssets > returns the added count and refetches the view so the header and card both follow
✓ pinAssets > sends no request for an empty list — the backend answers 400 for one
✓ pinAssets > rethrows on failure and leaves the stored view untouched
✓ pinAssets > a failing refetch does not turn a successful write into a failure
✓ removeAssets > returns both tiers and refetches the view
✓ removeAssets > defaults both counters to 0 when the backend omits them
✓ removeAssets > sends no request for an empty list
✓ restoreAssets > returns the restored count and refetches the view
✓ loadExcluded > normalises the bare array through assetToPhoto
✓ loadExcluded > leaves the list empty and does not throw when the request fails
✓ loadExcluded > carries a staleness guard: when two loads interleave, the later one wins

Test Files  1 passed (1)
     Tests  11 passed (11)
```

One quality fix on top of the brief's verbatim test file: three sub-tests
deliberately trigger a `console.error` inside the action (failure paths).
The sibling file `smartViews.test.ts` establishes the repo convention of
`vi.spyOn(console, 'error').mockImplementation(() => {})` around such cases
to keep test stderr clean; I applied the same pattern to the 3 affected
`it()` blocks (pin-rethrow, pin-failing-refetch, loadExcluded-fails). This
does not change what is asserted — only suppresses expected console noise —
and was done as part of the self-review's "pristine output" check (item 8).

## Staleness-guard mutation check

Per the brief's constraint 5 and the self-review instructions, I verified the
`loadExcluded` staleness guard is load-bearing by actually deleting it and
watching the test go red, then restoring it:

1. Backed up `smartViews.ts`.
2. Removed the `if (mine !== excludedSeq) return` line inside `loadExcluded`.
3. Ran `pnpm exec vitest run src/photos/stores/__tests__/smartViews.assets.test.ts -t "staleness guard"`:
   ```
   FAIL … carries a staleness guard: when two loads interleave, the later one wins
   AssertionError: expected [ 'first' ] to deeply equal [ 'second' ]
   - Expected: ["second"]
   + Received: ["first"]

   Test Files  1 failed (1)
        Tests  1 failed | 10 skipped (11)
   ```
   Confirmed: without the guard, the late-landing first request clobbers the
   second (correct) result — the exact regression the test is meant to catch.
4. Restored `smartViews.ts` from the backup, re-verified the guard line is
   back (`grep -n "if (mine !== excludedSeq) return"` → present at the
   correct location), and re-ran the full test file to confirm all 11 pass
   again (see GREEN block above, taken after restoration).

## Existing store tests — before/after count

`src/photos/stores/__tests__/smartViews.test.ts` was not touched.
- Before and after this task: **52 passed / 52 passed** (unchanged file,
  unchanged count — ran standalone: `Test Files 1 passed (1); Tests 52
  passed (52)`).

## Full-suite and vue-tsc results

- `pnpm exec vue-tsc --noEmit` — **clean, no errors**, after two fixes:
  1. A broken pnpm hardlink between `packages/service/src/photos.ts` and its
     `node_modules/.pnpm/.../src/photos.ts` mirror (the documented "硬链接陷阱"
     in this repo's CLAUDE.md — Edit tool's atomic write breaks the hardlink
     pnpm relies on for the inlined service package). Fixed with `pnpm
     install` (confirmed via `stat -c '%i %n'` on both paths before/after —
     inodes matched after re-link).
  2. `src/photos/composables/__tests__/usePersonDetail.test.ts`'s local
     `Photo` fixture builder was missing the now-mandatory `pinned` field —
     added `pinned: false`.
- Full suite (`pnpm test`, pre-commit): **10758 passed | 70 skipped, 3
  failed** — all 3 failures (plus one more file-level failure, 4 files total)
  are in `oss/*.test.mjs`, and all fail with the identical reason: the
  `oss/export.mjs` pre-flight guard refuses to run against a dirty git
  working tree, and my uncommitted new/changed files (plus, independently,
  the controller's own untracked `.superpowers/sdd/2026-08-09-sp15-p2a-…/`
  ledger directory, which predates this session — its files carry an
  Aug 9 21:45 mtime, before I started) triggered that guard. This is a
  pre-existing environmental condition, not a regression: re-running the
  same 4 `oss/*.test.mjs` files after my commit still fails for the same
  reason, now solely because of the still-untracked ledger directory
  (`task-1-brief.md`, `progress.md`) — confirmed by inspecting the guard's
  own error message, which lists only that directory as the dirty-tree
  cause post-commit. I did not commit that directory myself: the brief's
  `git add` list is scoped to the five implementation/test files plus the
  fixture fix, and `progress.md` is the controller's file (constraint 11
  says never `git stash` it — I extended that caution to not committing it
  on the controller's behalf either).
- Targeted re-run post-commit of the three relevant files together:
  `packages/service/src/photos.smartviewAssets.test.ts` +
  `src/photos/stores/__tests__/smartViews.assets.test.ts` +
  `src/photos/stores/__tests__/smartViews.test.ts` → **68 passed (68)**,
  clean stderr (`--reporter=verbose`, no `[Vue warn]`, no unhandled
  rejections).

## Self-review (brief's item 8)

- **Every Interfaces-block member present with the right signature?** Yes —
  checked one by one against the brief's list:
  `pinSmartViewAssets(id, assetIds) → Promise<{added?}>`,
  `removeSmartViewAssets(id, assetIds) → Promise<{unpinned?, excluded?}>`,
  `restoreSmartViewAssets(id, assetIds) → Promise<{restored?}>`,
  `getSmartViewExcluded(id) → Promise<unknown[]>`, `Photo.pinned: boolean`,
  and on the store: `excluded: Ref<Photo[]>`, `excludedLoading: Ref<boolean>`,
  `assetBusy: Ref<boolean>`, `pinAssets(id, ids): Promise<number>`,
  `removeAssets(id, ids): Promise<{unpinned, excluded}>`,
  `restoreAssets(id, ids): Promise<number>`, `loadExcluded(id): Promise<void>`.
  All present, all returned from the store's setup function.
- **Does any test assert only that a mock was called, rather than real store
  behavior?** No — every `pinAssets`/`removeAssets`/`restoreAssets` test
  asserts the *returned value* and/or the resulting `byId(id)` state after
  the refetch, not just call presence. The one `toHaveBeenCalledWith`
  assertion (in the first `pinAssets` test) is paired with a real-behavior
  assertion (`s.byId('sv1')?.count`) in the same test, not standing alone.
- **Would the staleness test fail if the guard were deleted?** Verified by
  actually deleting it — see the mutation-check section above. Yes, it goes
  red for the correct reason, and I restored the guard afterward.
- **Is the test output pristine?** Yes, after adding the three `console.error`
  spies noted above; verified with a final verbose run showing no stray
  stderr lines.

## Concerns

1. One implementation deviation from the brief's literal code (the
   `Array.isArray` guard in `getSmartViewExcluded` instead of `?? []` alone)
   was necessary to make the brief's own given test pass — flagged per
   constraint 12 rather than silently "fixed", documented inline in
   `photos.ts` and above.
2. `usePersonDetail.test.ts` needed a one-line fixture fix outside the
   brief's file list, purely because `pinned` became a required field on
   `Photo`. No logic in that file changed.
3. The `oss/*.test.mjs` dirty-tree gate still fails post-commit, solely
   because of the controller's own untracked ledger directory for this task
   (predates my session). Not something Task 1's scope covers; flagged for
   the controller/next task rather than acted on unilaterally.
