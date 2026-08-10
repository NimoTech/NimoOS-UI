# Task 6 report: `resolvePaste` on `useFileConflicts`

## Step 1 — failing tests written

Added a `describe('resolvePaste', ...)` block with the four tests from the brief to
`src/files/composables/useFileConflicts.test.ts`.

Adapted two things to match this file's existing conventions instead of the brief's
literal snippet (per the brief's own instruction to follow existing method names):

- The file has no `c.answer(...)` method and no `flushPromises()` import. It already has
  a module-level `answer(c, choice)` helper built on a manual microtask-flush loop
  (`for (let i = 0; i < 50 && !c.dialog.value.open; i++) await Promise.resolve()`), and
  several tests inline that same loop directly when they need to inspect dialog fields
  *before* answering (e.g. the existing "passes the conflicting name..." test). I used
  the inline loop form throughout the new tests (rather than the `answer()` helper) so
  each test could assert `dialog.value.name` / `allowMerge` / `isDir` / `targetPath`
  before calling `c.onChoose(...)`.
- For the "runs on the same serial chain" test's second wait (after answering the first
  batch, waiting for the second batch's dialog to open), I used the same unconditional
  `for (let i = 0; i < 50; i++) await Promise.resolve()` loop the file already uses
  elsewhere for "give it every chance to (wrongly) do X" assertions.

## Step 2 — confirmed red

```
pnpm exec vitest run src/files/composables/useFileConflicts.test.ts
```

Result: 4 failed / 19 passed. All 4 failures were `TypeError: c.resolvePaste is not a
function` — the right reason (method doesn't exist yet).

## Step 3 — implementation

Added `resolvePaste` to `src/files/composables/useFileConflicts.ts`, verbatim per the
brief:

```ts
async function resolvePaste(items: OperateItem[], destDir: string) {
  const task = async () => {
    const conflicts = await computePasteConflicts({ items, destDir, listFolder })
    const resolutions = conflicts.length
      ? await resolveConflictQueue(conflicts, (conflict, ctx) => ask(conflict, destDir, ctx))
      : []
    return splitPasteItems(items, resolutions)
  }
  const p = chain.then(task, task)
  chain = p.then(() => undefined, () => undefined)
  return p
}
```

Added imports for `computePasteConflicts`/`splitPasteItems` from `../upload/pasteConflict`
and `OperateItem` from `../stores/clipboard`. Added `resolvePaste` to the composable's
return object; no existing export was touched.

## Step 4 — confirmed green

```
pnpm exec vitest run src/files/composables/useFileConflicts.test.ts
```

Result: 23 passed (23). Full file, not just the new block.

## Step 5 — mutation verification (the `chain` two lines)

Temporarily replaced:

```ts
const p = chain.then(task, task)
chain = p.then(() => undefined, () => undefined)
return p
```

with:

```ts
return task()
```

Reran the same command. Result: **1 failed / 22 passed** — and the one failure was
exactly `resolvePaste > runs on the same serial chain as upload batches`:

```
AssertionError: expected false to be true // Object.is equality
 ❯ src/files/composables/useFileConflicts.test.ts:310:33
    (expect(c.dialog.value.open).toBe(true))
```

All 3 other `resolvePaste` tests, plus all 19 pre-existing `useFileConflicts` tests,
stayed green under the mutation — confirming the "same serial chain" test is the only
one pinning that behavior, for the right reason. Reverted immediately back to the two
`chain` lines; reran once more to confirm 23/23 green again before moving on.

## `allowMerge` reasoning check

Confirmed in `src/files/upload/fileConflict.ts`:

```ts
export interface ConflictCandidate {
  ...
  mergeable?: boolean
}
```

`ask()` in `useFileConflicts.ts` sets `allowMerge: !!conflict.mergeable`.
`computePasteConflicts` (`src/files/upload/pasteConflict.ts`) builds its
`ConflictCandidate[]` as `{ name, isDir, groupKey }` — `mergeable` is never set on a
paste candidate, so `conflict.mergeable` is `undefined` there and `!!undefined` is
`false`. The reasoning in the brief holds as written; `ask()` did not need to change.
The "never offers Merge for a paste collision" test (a folder-vs-folder collision, which
IS mergeable in the upload path) passing with `allowMerge === false` is direct
confirmation of this at the paste call site.

## vue-tsc

```
pnpm exec vue-tsc --noEmit
```

No output — clean, no type errors.

## Notes / things to flag

- No test in this batch turned out to pass "for the wrong reason" as far as I could
  verify — the one place that risk is highest (test 3, "never offers Merge") is exactly
  the one covered by the `allowMerge`/`mergeable` chain of reasoning above, and it
  exercises a real branch (`isDir: true`, folder collision) that would be mergeable in
  the upload path, so a bug in either `ask()` or `computePasteConflicts` would show up
  here.
- Left `resolvePaste` without a `finally { dialog.value = { ...CLOSED } }` reset, matching
  the brief's implementation exactly (unlike `run()`, which does reset in `finally`).
  This is fine for the tests here (none of them assert the fully-closed shape after a
  successful paste resolution), but is worth the next task's author noting when they wire
  this into `useFileOps`/the UI — if they need the dialog to fully reset after a paste
  resolves without any conflict, that behavior is not present. Not fixing it here since
  it wasn't asked for and doing so wasn't in the brief.
- Did not modify `ask`, `pasteConflict.ts`, `fileConflict.ts`, `useFileOps.ts`, or any
  `.vue` file, per the task's hard constraints.
