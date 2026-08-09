# Task 8 Report: remove the old per-file conflict path

## Commit

`654c46b` — `refactor(files): resolve upload conflicts before enqueue, not in the queue`
9 files changed, 52 insertions(+), 172 deletions(-).

## What was removed

- **`src/files/upload/conflict.ts` + `conflict.test.ts`** — deleted (`git rm`). This was the
  old per-file precheck/decide module: `precheckExisting`, `conflictKey`, `decideConflictPolicy`.
- **`src/files/upload/types.ts`**:
  - `UploadStatus` — dropped `'conflict'`.
  - `UploadItem.conflictPolicy` — dropped `'skip'` from the union (skip never reaches the
    queue now — it's decided before enqueue). Added a doc comment pointing at
    `composables/useUploadConflicts.ts`.
  - `SelectedFile` — gained an optional `conflictPolicy?: '' | 'overwrite' | 'rename'` field
    (already-resolved, set by the conflict dialog flow upstream).
- **`src/files/stores/uploads.ts`**:
  - Removed the `conflict.ts` import.
  - `addFilesToQueue`'s per-item `conflictPolicy: ''` became `conflictPolicy: f.conflictPolicy || ''`
    — reads the already-resolved policy straight from the incoming `SelectedFile`.
  - Deleted the whole `try { precheckExisting(...) } catch {...}` block that used to flip
    items to `'conflict'` status.
  - Deleted the `resolveConflict(id, choice)` action entirely, and its entry in the store's
    `return { ... }`.
- **`src/files/upload/uploadBatches.ts`**:
  - Removed `conflictCount` from `BatchView` and from `groupByBatch`'s computation.
  - `zone` computation no longer ORs in `conflictCount > 0`.
  - Updated `isBatchSettled`'s doc comment (no longer mentions "awaiting a conflict decision").
- **`src/files/components/UploadPanel.vue`**:
  - Removed `import Dialog from '../../components/ui/Dialog.vue'` (no longer referenced
    anywhere in the file — verified with `grep -n "<Dialog" UploadPanel.vue` before deleting).
  - Removed the `conflictItem` computed.
  - Removed the `resolve(choice)` function.
  - Removed the entire `<Dialog :open="!!conflictItem" ...>...</Dialog>` template block
    (the skip/rename/overwrite buttons and the two now-missing i18n keys
    `filesUploadConflictTitle`/`filesUploadConflictMsg` it referenced).
  - Removed the now-orphaned `.ui-btn` / `.ui-btn.primary` CSS rules — those classes were
    used *only* inside the deleted Dialog block (confirmed with
    `grep -n "ui-btn" UploadPanel.vue` before and after: only the Dialog markup and the CSS
    rules referenced them). No color literals were introduced or left behind; the removed
    rules used `var(--chip-border, ...)` / `var(--accent, ...)` tokens, consistent with the
    rest of the file's existing fallback-literal pattern (unchanged elsewhere).
  - Removed a stray trailing blank line left before `</script>` after the function deletion.

Did **not** touch `Files.vue` (Task 9's job) — `addFilesToQueue` genuinely reads
`f.conflictPolicy` now, and since nothing upstream sets it yet, it's simply `undefined` →
`''`, exactly the documented intermediate state.

## i18n

- `filesUploadConflictTitle` / `filesUploadConflictMsg` were already deleted from both
  `zh_cn.base.ts` and `en_us.base.ts` by Task 5 — confirmed still absent, not re-added.
- Left `filesUploadSkip` / `filesUploadRename` / `filesUploadOverwrite` in place in both
  locale files. They are now unreferenced by any component (the new `FileConflictDialog.vue`
  uses its own, differently-named `filesConflict*` key family), but the brief's Global
  Constraints only mandate that *deleted* keys stay gone from both files — it does not ask
  for a dead-key sweep, and there is no repo test enforcing "every locale key must be
  referenced" (checked `src/i18n/i18n.test.ts`, `parity.test.ts`, `messageSyntax.test.ts` —
  none of them do this). Flagging as a minor cleanup opportunity rather than doing an
  unrequested deletion.

## TDD evidence

### Step 1 → Step 2: RED (before implementation changes)

Command: `pnpm exec vitest run src/files/stores/uploads.test.ts src/files/components/UploadPanel.test.ts src/files/upload/uploadBatches.test.ts`

Result: 3 failed / 28 passed (31 total). Relevant failures:

```
FAIL src/files/stores/uploads.test.ts > uploads store > carries a per-entry conflictPolicy straight into the queue
AssertionError: expected '' to be 'overwrite'

FAIL src/files/stores/uploads.test.ts > uploads store > does not precheck on its own — conflict resolution happens before enqueue
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 3 times

FAIL src/files/components/UploadPanel.test.ts > UploadPanel > no longer imports the per-file conflict Dialog or references its resolveConflict path
TypeError: The URL must be of scheme file
```

The third failure was a bug in my own test code (a `fileURLToPath(new URL(...))` construction
that doesn't resolve correctly under this Vite/vitest transform), not evidence about the guard
itself — fixed to `path.join(__dirname, 'UploadPanel.vue')` and reran (see guard-specific
RED/GREEN proof below) to get a genuine RED against the real source content.

### Step 3 → Step 4: GREEN (after implementation changes)

```
$ pnpm exec vitest run src/files/
 Test Files  106 passed (106)
      Tests  769 passed (769)

$ pnpm exec vue-tsc --noEmit
(no output — clean)

$ pnpm exec vitest run src/i18n/parity.test.ts
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

One extra fix needed to reach GREEN under `vue-tsc`: my added assertion
`expect(s.queue.every((i) => i.status !== 'conflict')).toBe(true)` triggered
`TS2367: This comparison appears to be unintentional because the types 'UploadStatus' and
'"conflict"' have no overlap` — correct, since `UploadStatus` no longer includes `'conflict'`
at all. Changed to `(i.status as string) !== 'conflict'` with a comment explaining it's now a
belt-and-suspenders runtime check on top of a type-level guarantee. Reran `vue-tsc --noEmit`
after — clean.

## Guard test: RED/GREEN proof (per the user's ruling)

**Guard style chosen:** read the component's source with `node:fs` (not `?raw` — the brief's
own warning that `?raw` returns empty under this repo's vitest setup was independently
verified true in a prior task per the brief; sidestepped rather than re-verified since the
warning is explicit) and assert it no longer imports `Dialog` or references
`resolveConflict`/`conflictItem`. Chose this over "seed the state that used to make the old
dialog render" because that old state (`status: 'conflict'`) no longer exists in the
`UploadStatus` type at all post-removal — a rendering-based version would either fail to
compile or degrade into a test that can't express "this state doesn't exist anymore" as
cleanly as a source-text assertion can.

Final guard test (`src/files/components/UploadPanel.test.ts`):

```ts
it('no longer imports the per-file conflict Dialog or references its resolveConflict path', () => {
  const source = readFileSync(path.join(__dirname, 'UploadPanel.vue'), 'utf-8')
  expect(source).not.toMatch(/import\s+Dialog\s+from/)
  expect(source).not.toContain('resolveConflict')
  expect(source).not.toContain('conflictItem')
})
```

**RED proof** (ran against the *unmodified* `UploadPanel.vue`, before any of Step 3's
implementation edits — this is the file exactly as it existed when Task 7 handed off):

```
$ pnpm exec vitest run src/files/components/UploadPanel.test.ts
 FAIL  src/files/components/UploadPanel.test.ts > UploadPanel > no longer imports the per-file conflict Dialog or references its resolveConflict path
AssertionError: expected '<!-- src/files/components/UploadPanel.vue -->\n<scri…' not to match /import\s+Dialog\s+from/

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
```

(First attempt hit a `TypeError: The URL must be of scheme file` from a `fileURLToPath`
construction bug in the test itself; fixed to `path.join(__dirname, ...)`, then reran to get
the genuine content-based RED shown above — confirming the assertion fails specifically
because `Dialog` is still imported and `resolveConflict`/`conflictItem` are still present in
the real, unmodified source.)

**GREEN proof** (ran after all of Step 3's edits to `UploadPanel.vue` — Dialog import,
`conflictItem` computed, `resolve()` function, and the template block all removed):

```
$ pnpm exec vitest run src/files/components/UploadPanel.test.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

This satisfies the "prove it can fail" requirement: the guard was observed failing against
the actual pre-removal source, then observed passing against the actual post-removal source
— not a tautology like the brief's original `seed('error')` version (which never touches
`conflictItem` either way).

## Mechanical checks (caution 2)

```
$ grep -rn conflictCount src/
(no output)

$ grep -rn "status === 'conflict'\|status: 'conflict'" src/
src/ai/stores/agentStore.p1c.test.ts:312:    svc.revertStagedBatch.mockResolvedValue({ status: 'conflict' })
```

The one remaining hit is an unrelated AI-store test mocking an HTTP response `status` field
(not the upload queue's `UploadStatus`) — out of scope, left untouched.

## `git status --short` before staging (caution 1)

```
 M src/files/components/UploadPanel.test.ts
 M src/files/components/UploadPanel.vue
 M src/files/stores/uploads.test.ts
 M src/files/stores/uploads.ts
D  src/files/upload/conflict.test.ts
D  src/files/upload/conflict.ts
 M src/files/upload/types.ts
 M src/files/upload/uploadBatches.test.ts
 M src/files/upload/uploadBatches.ts
```

Exactly the 9 files this task touched (7 modified, 2 deleted). `packages/service` had zero
changes — confirmed by its absence from this list. Staged each path explicitly (not `-A`);
the first `git add` invocation errored on the already-`git rm`'d deletion paths (git refuses
a pathspec for a file that no longer exists on disk even though the deletion is already
staged) — re-ran without those two paths, which were already staged from the earlier
`git rm`. Final staged set matched this list exactly before commit.

## Files changed / deleted

Modified:
- `src/files/components/UploadPanel.test.ts`
- `src/files/components/UploadPanel.vue`
- `src/files/stores/uploads.test.ts`
- `src/files/stores/uploads.ts`
- `src/files/upload/types.ts`
- `src/files/upload/uploadBatches.test.ts`
- `src/files/upload/uploadBatches.ts`

Deleted:
- `src/files/upload/conflict.ts`
- `src/files/upload/conflict.test.ts`

## Test-file changes beyond the brief's literal text (and why)

The brief's Step 1 for `uploads.test.ts` said to delete "that one entire example" (singular)
about precheck hits — but two more existing tests also called the now-removed
`s.resolveConflict(...)`, which would have thrown at runtime once the function was deleted:
- `'resolveConflict skip marks done (lingers for clearDone); overwrite re-queues with policy'`
  — deleted outright (redundant with the new "carries a per-entry conflictPolicy" test; its
  only remaining unique behavior, "skip → done", is a policy that's now decided upstream by
  `useUploadConflicts`/`Files.vue`, not by this store).
- `'clearDone removes lingering (skip-done) items'` — rewritten to seed a `status: 'done',
  progress: 0` item directly via `store.queue.push(...)` instead of via
  `resolveConflict(id, 'skip')`, preserving the regression coverage for `clearDone`'s sweep
  behavior without depending on the deleted action.

This matches the brief's own instruction to "verify each [reference] against the current
file before editing — earlier tasks may have shifted them."

## Self-review findings

- Confirmed no lingering import of `Dialog` in `UploadPanel.vue` (grep before/after).
- Confirmed `.ui-btn`/`.ui-btn.primary` CSS had no other consumers before deleting.
- Confirmed `addFilesToQueue` reads `f.conflictPolicy || ''` (not a leftover hardcoded `''`).
- Confirmed `resolveConflict`, `conflictItem`, `conflictCount`, and the `'conflict'` status
  value are gone from every file this task touched, via grep across all of `src/`.
- Confirmed `conflict.ts`/`conflict.test.ts` have zero remaining importers anywhere in `src/`.
- Fixed one thing beyond the literal brief text: the type error from comparing against a
  status value that's no longer part of the type (see TDD evidence above) — cast rather than
  drop the runtime assertion, to keep the belt-and-suspenders check without fighting the type
  system.
- Removed a stray blank line left in `UploadPanel.vue`'s `<script>` block after deleting
  `resolve()`.

## Concerns

- `filesUploadSkip`/`filesUploadRename`/`filesUploadOverwrite` i18n keys are now unreferenced
  by any component (see i18n section above). Left in place since the brief didn't ask for
  their removal and no test enforces dead-key absence — flagging for whoever next does an
  i18n cleanup sweep, not blocking this task.
- Did not run the full `pnpm test` suite per the explicit instruction not to — only
  `src/files/`, `vue-tsc --noEmit`, and `src/i18n/parity.test.ts`, all green.
