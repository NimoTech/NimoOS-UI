# Task 4 report: store 的服务端读写 + 预览/回滚

## Fix round 1 (review: Approved-with-findings, 3 Important)

Commit: `8a186a2` — "fix(wallpaper): close two async staleness races in the store (review round 1)"

Controller ruling: all three findings are plan-silent (the brief's reference code was copied
verbatim, which is not held against the implementer), the repo has a standing convention that
async writes to shared state must carry a staleness guard, and fixing these does not contradict
the plan. Fixed all three.

### Finding 1 — `commit()` stale-write (Important)

`commit()` read `record.value` twice across an `await` (once for the server write, again for
the cache). If `preview()` ran while the save was in flight, the cache ended up holding a
record that was never sent to the server.

**Fix** (`src/stores/wallpaper.ts`, `commit()`): capture `record.value` into a local `toSave`
once, before the `await`, and use that same local for both `setCustomStorage` and
`cacheRecord`.

**Covering test** (`src/stores/wallpaper.test.ts`, "commit caches the record it actually sent,
not a later preview that landed while the save was in flight"): makes `setCustomStorage` return
a controllable promise, calls `preview(w01)`, starts `commit()`, calls `preview(w02)` while the
save is still pending, resolves the save, then asserts both the server call and the cache hold
`w01` — not `w02`.

RED (test written against the pre-fix code, via a temporary revert to verify the test actually
pins the bug — see "Mutation verification" below): failed with
`expected { kind: 'builtin', id: 'w02' } to deeply equal { kind: 'builtin', id: 'w01' }`.

GREEN (post-fix): passes.

### Finding 2 — `load()` can clobber a live preview (Important)

`load()` applied the server value unconditionally once its read resolved, with no check that
the user had acted in the meantime — a slow server read could stomp a preview the user had
already made.

**Fix** (`src/stores/wallpaper.ts`): added a store-scoped `epoch` counter, bumped by every
`preview()` call. `load()` captures `epoch` into `startEpoch` before its `await`; when the read
resolves, if `epoch !== startEpoch` it returns without applying or caching — the user's more
recent action wins. The existing catch-and-degrade block for a rejected read is untouched. Per
the coordinator's instruction, this guard is inlined at the one call site, not extracted into a
shared helper (single-use).

**Covering test** ("load does not clobber a live preview that happened while the read was in
flight"): makes `getCustomStorage` return a controllable promise, starts `load()`, calls
`preview(w01)` while the read is still pending, resolves the read with `w02`, then asserts
`s.record` is still `w01`, `data-wallpaper` reflects the preview, and — since neither `preview()`
nor the now-discarded `load()` wrote it — `localStorage` was never touched.

RED: failed with `expected { kind: 'builtin', id: 'w02' } to deeply equal { kind: 'builtin', id: 'w01' }`.

GREEN (post-fix): passes.

### Finding 3 — openDialog/closeDialog test under-specified (Important)

The old test only asserted `dialogOpen` toggling, which would pass even if `openDialog` forgot
its `beginPreview()` call or `closeDialog` were accidentally wired to `cancelPreview()`.

**Fix**: rewrote the test (same `it` block, new body) to: `preview(w01)` before opening (the
record the dialog should roll back to); `openDialog()`; `preview(w02)` inside the dialog;
`cancelPreview()`; assert `record` is back to `w01` and `data-wallpaper` reflects it. Then
re-open, `preview(w02)` again, and this time just `closeDialog()` — assert `dialogOpen` is
false but `record` and `data-wallpaper` are left exactly as the preview set them (i.e.
`closeDialog` did not roll back).

No production-code change was needed for this finding — `openDialog`/`closeDialog` were already
correct; the fix is test-only, strengthening the assertion to actually pin the behaviour the
name claims.

### Mutation verification (Findings 1 & 2)

To confirm the two new tests were not accidentally vacuous, temporarily reverted `commit()` and
`load()` to their pre-fix bodies (comment marker `MUTATION-VERIFICATION-TEMP`) and re-ran:

```
pnpm vitest run src/stores/wallpaper.test.ts -t "commit caches the record it actually sent|load does not clobber" --reporter=verbose
```
Both failed as shown above (RED sections). Reverted the temporary changes back to the fixed
version and re-ran the full file — all green (see below).

### Full re-run after the fix

```
pnpm vitest run src/stores/wallpaper.test.ts --reporter=verbose
```
```
 Test Files  1 passed (1)
      Tests  27 passed (27)
```
All 27 tests pass (25 from the original Task-4 work + 2 new), verbose output clean (no stray
Vue warnings).

```
pnpm exec vue-tsc --noEmit
```
Exit 0, no errors.

### Minor findings deliberately NOT fixed (per coordinator instruction, for the ledger)

- **(a)** No test pins that `cancelPreview` avoids writing `localStorage.theme`. Left
  unaddressed — flagging here so a later reviewer doesn't re-raise it as new.
- **(b)** `setFromNasPath`'s partial-failure path (server copy succeeds, the subsequent
  `commit()` rejects) leaves an applied-but-unpersisted wallpaper on screen. Left unaddressed —
  flagging here so a later reviewer doesn't re-raise it as new.

### Files changed (fix round 1)

- `src/stores/wallpaper.ts` — `commit()` local-capture fix; `epoch` counter + guard in
  `preview()`/`load()`.
- `src/stores/wallpaper.test.ts` — 2 new tests (Findings 1 & 2); rewrote the
  openDialog/closeDialog test (Finding 3).

---

## What was implemented

Added `useWallpaperStore` (Pinia, id `'wallpaper'`) to `src/stores/wallpaper.ts`, exactly as
specified in the brief:

- **state**: `record: Ref<WallpaperRecord>` (seeded from `initialWallpaper()`), `dialogOpen: Ref<boolean>`, `busy: Ref<boolean>`.
- **actions** (verbatim names, no additions): `preview`, `beginPreview`, `cancelPreview`, `commit`, `load`, `uploadAndPreview`, `setFromNasPath`, `openDialog`, `closeDialog`.
- Internal `Snapshot { record, theme }` captured by `beginPreview()` and restored by `cancelPreview()`, covering the "base preset also switches theme" case.

Appended the corresponding `describe('wallpaper store', ...)` block (12 tests) to
`src/stores/wallpaper.test.ts`, with a `vi.mock('@nimotech/nimoos-service', ...)` mocking
`getCustomStorage` / `setCustomStorage` / `uploadImage` / `setImageFromPath`.

## Deviations from the brief's literal code

1. **Vitest generic form (`vi.fn`)**: the brief's `vi.fn<[string], Promise<unknown>>()` /
   `vi.fn<[string, unknown], Promise<unknown>>()` (two-argument tuple form) does not type-check
   under this repo's Vitest 4.1.9 (`TS2558: Expected 0-1 type arguments, but got 2`, confirmed
   with a throwaway probe file before touching the real test file). Used the single
   function-type form instead:
   ```ts
   const getCustomStorage = vi.fn<(key: string) => Promise<unknown>>()
   const setCustomStorage = vi.fn<(key: string, data: unknown) => Promise<unknown>>()
   ```
   Everything downstream (the `vi.mock` factory, call sites) is unchanged from the brief.

2. **`./theme` API**: checked `src/stores/theme.ts` before writing the implementation. It
   matches the brief's assumptions exactly — `theme` is a writable `Ref<Theme>` returned from
   the setup store, and `applyTheme('blue')` does `delete document.documentElement.dataset.theme`
   (removes the attribute) rather than setting it. No adaptation was needed; the brief's
   implementation code was used as-is for the theme interaction.

3. **Broken hardlink surfaced by `vue-tsc`** (not a brief deviation, but worth flagging):
   `pnpm exec vue-tsc --noEmit` initially failed with `Property 'uploadImage' does not exist on
   type ...` / same for `setImageFromPath`, even though both methods are present in
   `packages/service/src/users.ts` (added in Task 3). `stat -c '%i'` showed the repo file and
   the `node_modules/.pnpm/.../src/users.ts` hardlink target had **different inodes** — the
   exact "硬链接陷阱" documented in this repo's `CLAUDE.md` (Task 3's atomic-write edit broke
   the hardlink). Ran `pnpm install` (no `--force`, no cache clear) to relink; inodes matched
   afterward and `vue-tsc --noEmit` came back clean. No source-code change was needed — this
   was a workspace-state issue, not a code issue.

## TDD evidence

**RED** — `pnpm vitest run src/stores/wallpaper.test.ts` (before adding the store implementation):
```
FAIL  src/stores/wallpaper.test.ts > wallpaper store > ... (12 failures)
TypeError: useWallpaperStore is not a function
...
 Test Files  1 failed (1)
      Tests  12 failed | 13 passed (25)
```
All 12 new store tests failed with `useWallpaperStore is not a function` (module had no such
export yet); the 13 pre-existing Task 1 tests in the same file passed unaffected — confirming
the added `vi.mock` didn't disturb them.

**GREEN** — after implementing the store, `pnpm vitest run src/stores/wallpaper.test.ts`:
```
 Test Files  1 passed (1)
      Tests  25 passed (25)
```
`pnpm exec vue-tsc --noEmit` — exit 0, no errors.

Re-ran with `--reporter=verbose` to check for stray stderr/Vue warnings on passing tests:
all 25 lines printed clean `✓` with no warning output.

## Mutation-verification evidence (Step 5, mandatory)

**Note on the brief's literal mutation**: the brief suggests weakening `beginPreview` to
`snapshot = { record: record.value, theme: 'blue' }`. I tried this literally first — it did
**not** turn the test red, because the test's own scenario starts with `theme.setTheme('blue')`,
so the hardcoded `'blue'` coincidentally matches the test's expected final value. This would
have been a false-positive mutation check (the test could pass even with an inert theme
snapshot). To actually exercise the guard, I instead disabled the theme-rollback statements in
`cancelPreview` (the equivalent of the snapshot's theme field being present but unused —
functionally "snapshot only the record"):

```ts
function cancelPreview(): void {
  if (!snapshot) return
  preview(snapshot.record)
  // MUTATION-VERIFICATION-TEMP: theme rollback disabled to prove the guard is not a no-op.
  // useThemeStore().theme = snapshot.theme
  // applyTheme(snapshot.theme)
  snapshot = null
}
```

Command: `pnpm vitest run src/stores/wallpaper.test.ts -t "cancelPreview rolls back BOTH" --reporter=verbose`

Actual failing output while mutated:
```
× src/stores/wallpaper.test.ts > wallpaper store > cancelPreview rolls back BOTH the record and the theme 13ms
  → expected 'light' to be 'blue' // Object.is equality

AssertionError: expected 'light' to be 'blue'
Expected: "blue"
Received: "light"
 ❯ src/stores/wallpaper.test.ts:193:25
   expect(theme.theme).toBe('blue')
```

Reverted the two commented lines, re-ran the full file:
```
pnpm vitest run src/stores/wallpaper.test.ts --reporter=verbose
 Test Files  1 passed (1)
      Tests  25 passed (25)
```
All 25 green again, verbose output clean.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/src/stores/wallpaper.ts` — added `useWallpaperStore` and its imports.
- `/home/nimo/NimoTech/NimoOS-New-UI/src/stores/wallpaper.test.ts` — added the `wallpaper store` describe block and its `vi.mock`.

Commit: `5d9b549` — `feat(wallpaper): add server persistence, live preview and rollback`
(committed with `git commit -o src/stores/wallpaper.ts src/stores/wallpaper.test.ts` per the
brief; the three permanently-staged `design-export/*.html` deletions were left untouched —
verified via `git status` before and after).

## Self-review findings

- Action set matches the brief's contract exactly: `preview` / `beginPreview` / `cancelPreview` /
  `commit` / `load` / `uploadAndPreview` / `setFromNasPath` / `openDialog` / `closeDialog`. No
  extra actions added (checked against YAGNI — e.g. no separate `reset`/`clear` action was
  added even though it would have been easy to justify).
- Tests exercise real behaviour, not the mock: assertions check `document.documentElement`
  dataset/style state, `localStorage` contents, and thrown/rejected error messages — the mock
  functions (`getCustomStorage` etc.) are only asserted on for call arguments, never treated as
  the source of truth for the outcome.
- `commit()` and `setFromNasPath()` both go through `WALLPAPER_CUSTOM_KEY` for the server write
  and `cacheRecord` (which internally uses `WALLPAPER_CACHE_KEY`) for the local cache — no
  string literals reused, matching the "use Task 1 constants" constraint.
- `load()`'s catch-all swallow is intentionally silent (matches the brief's comment about
  Vue2's unguarded behavior) — confirmed by the "load degrades a rejected read to none without
  throwing" test.
- Ran `git diff --stat` after commit: only the two intended files changed, 239 insertions, 0
  deletions — no accidental edits to `theme.ts` or elsewhere.

## Concerns

- None blocking. The one thing worth flagging to whoever reviews Task 4 against the brief: the
  brief's own Step 5 mutation snippet is a weak/false-passing test for this specific scenario
  (documented above) — future maintainers re-running "mutation verification" against that exact
  snippet may be misled into thinking the guard doesn't matter. I used a mutation that actually
  disables the rollback behavior instead, and both are documented here for the record.
