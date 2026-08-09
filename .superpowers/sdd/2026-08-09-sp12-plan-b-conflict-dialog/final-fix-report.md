# SP12 Plan B — final fix wave report

Branch `sp12-plan-b`, worktree `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/sp12-plan-b`.
Start HEAD `9a16076`, end HEAD `8aecf73`. Four commits, working tree clean.

| Commit | Subject | Findings |
|---|---|---|
| `dacdc3c` | fix(files): stop leaking a stripped-feature word, use the real hover token | A, F |
| `64dc045` | fix(files): settle an open conflict prompt when the owning scope goes away | E |
| `774b4c3` | fix(files): make a cancel in the file queue suppress the merge second round | D |
| `8aecf73` | fix(files): merge a refill into the folder it is refilling, never prompt | C |

Commits are ordered E → D → C rather than C → D → E purely so that each one is a
self-contained diff: C changes `run()`'s signature, so putting E's insertion (which sits
immediately above that line) first kept every hunk attributable to exactly one finding.

---

## A — OSS leak guard false positives (gate failure)

**Changed.** Reworded, not whitelisted, exactly as instructed.

- `src/files/upload/uploadConflict.ts:8` — the header comment now reads
  *"Prompting per entry would ask about every single file inside \"Trip\"."* The
  explanation is unchanged in substance: a picked/dragged folder flattens to one entry
  per file, so per-entry prompting would ask about every file in the folder; hence the
  conflict is judged on the relativePath's TOP segment and the whole group resolves as
  one unit.
- `src/views/__tests__/Files.uploadConflict.test.ts:265` — fixture renamed
  `photo.jpg` → `snap.jpg` (both the `name` and the `webkitRelativePath`).

I deliberately did **not** take the whitelist route the guard's own failure message
offers. `oss/forbidden.mjs` already carries ~20 `exactLine` whitelist entries for the
word; each one is a permanent hole that a future edit to that line silently re-opens.
Neither of these two occurrences carries any meaning that the reworded version loses.

**GREEN evidence** — `pnpm exec vitest run src/files/ src/views/ oss/` (clean tree):

```
 Test Files  143 passed (143)
      Tests  1536 passed (1536)
```

Note: `oss/*.test.mjs` shell out to `oss/export.mjs`, which refuses to run against a dirty
working tree (`[oss] 失败:… 工作树不干净,导出中止`). The oss gate is therefore only
meaningful **after** committing — an intermediate run against uncommitted edits fails for
that reason and not for a leak.

---

## F — `--chip-bg-hover` does not exist

**Changed.** `src/files/components/FileConflictDialog.vue:143`

```diff
-.fc-btn:hover:not(:disabled) { background: var(--chip-bg-hover, var(--chip-border)); }
+.fc-btn:hover:not(:disabled) { background: var(--chip-bg-hi); }
```

Verified `--chip-bg-hover` appears nowhere in the repo, so the fallback always fired and
the hover colour came from a *border* token. `--chip-bg-hi` is the codebase's real hover
token and is defined in **both** theme blocks of `src/styles/theme.css`
(`:root` line 217, `:root[data-theme="light"]` line 344), satisfying the
"every colour token has a value in both blocks" rule. It is what `.bar-btn:hover`
(theme.css:580) already uses. Dead fallback dropped.

---

## B — `DesktopContextMenu.test.ts` failing in the full suite

**Verdict: PRE-EXISTING. Not introduced by this branch. Nothing changed.**

It is *not* state pollution from this branch's new `attachTo: document.body` /
`App.vue`-mounting tests. Four independent lines of evidence:

**1. The file and everything that configures it are byte-identical at the branch point.**

```
$ git diff --name-only a365b7e HEAD | grep -i "DesktopContextMenu\|reka\|vitest.setup\|vite.config"
(no output)

$ git -C <worktree-at-a365b7e> diff --stat HEAD -- \
      src/home/components/DesktopContextMenu.test.ts src/home/components/DesktopContextMenu.vue
(no output — identical)
```

**2. Vitest runs with per-file isolation, so cross-file DOM leakage is architecturally
impossible.** `vite.config.ts`'s `test` block sets only `environment`, `globals`,
`exclude` and `setupFiles` — no `isolate: false`, no `pool` override. Each test file gets
a fresh jsdom in a fresh fork. Another file's leftover `document.body` content cannot
reach this one.

**3. The failure reproduces with the file run COMPLETELY ALONE, under CPU load.** This is
the decisive one: with no other test file in the run at all, no test of this branch can be
the cause. Three runs of just that file with six CPU-hog processes running:

```
      Tests  6 passed (6)
      Tests  1 failed | 5 passed (6)
      Tests  6 passed (6)
FAILS=1 (under 6x CPU hog)
```

```
 FAIL  src/home/components/DesktopContextMenu.test.ts > DesktopContextMenu > handles a right-click on blank canvas
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false
```

Note it was a *different* test in the same file that lost the race that time. The whole
file is load-sensitive, because every test in it relies on a single `flushPromises()` to
cross reka-ui's async open boundary (the file's own comments document that
`ContextMenuTrigger` acts only after an internal `await nextTick()`). Under load that
boundary is not reliably crossed — sometimes `preventDefault` has not run yet (assertion
fails), sometimes the portal content is not in `document.body` yet (`Cannot call trigger
on an empty DOMWrapper`, the shape the controller saw).

**4. Interleaved A/B at identical load shows no branch effect.** Eight iterations each,
alternating between the branch-point worktree and this one, same 8× CPU hog throughout:

```
RESULT under identical 8x CPU load, file run ALONE, 8 iterations each:
  baseline a365b7e : 0/8 failed
  branch sp12-plan-b: 1/8 failed
```

1/8 vs 0/8 on a byte-identical file is noise, not signal.

**5. Full-suite runs, both sides, are green.**

- branch point `a365b7e`, full suite: `Test Files 644 passed (644)` / `Tests 10408 passed (10408)`, exit 0.
- branch HEAD, full suite, clean tree: `Test Files 652 passed (652)` / `Tests 10498 passed (10498)`, exit 0.
- One earlier branch full-suite run (against a *dirty* tree, so the three `oss/*.test.mjs`
  files were additionally spawning `export.mjs` child processes) did fail — but on a
  different file, `src/i18n/__tests__/photosSlice.test.ts`, with `Test timed out in 5000ms`.
  Same load-sensitive shape, different victim. `DesktopContextMenu.test.ts` passed in that
  same run.

**Judgement call:** per the brief ("if it fails at the branch point too, it is pre-existing
— say so with the evidence and change nothing") I left the test alone. It *is* fragile and
would be worth hardening with the polling idiom this repo already uses elsewhere
(`waitForDialogOpen`/`waitForDialogClose` in `Files.uploadConflict.test.ts` poll in a
bounded loop instead of assuming one flush is enough) — but that is a separate ticket, not
this fix wave, and touching it here would have been unrelated refactoring.

---

## C — refill prompts against its own folder; "Keep both" misroutes it

**Changed.**

- `src/files/composables/useUploadConflicts.ts` — new exported `ResolveOptions` with
  `assumeMergeForFolders?: boolean`, threaded through
  `resolveEntries(entries, targetPath, opts = {})` → `run(entries, targetPath, opts)`.
  When set, the folder queue is answered as `merge` without ever calling
  `resolveConflictQueue`, i.e. no dialog. The reasoning is registered in a long English
  doc comment on the option plus a shorter one at the branch site.
- `src/views/Files.vue` — the single call site becomes
  `conflicts.resolveEntries(normalized, targetPath, { assumeMergeForFolders: !!pending })`,
  with an English comment pointing at the option's doc. `pending` is already the
  refill-branch flag, so the normal branch passes `false` and is untouched.

The rule lives in the orchestration composable, not in the pure functions (which have no
concept of a refill) and not duplicated in the view — as instructed.

Only the FOLDER queue is short-circuited. Plain file-vs-file collisions on the refill
branch still prompt, and the merge's second round still runs the per-path precheck, so
inner files that genuinely collide are still asked about one at a time.

**Judgement call — non-mergeable folder collisions on the refill branch.** A synthesized
`'merge'` for a conflict whose `mergeable` is false (the target holds a *file* of that
name, not a folder) falls through `applyUploadResolutions`' existing degradation path to
keep-both. That is unavoidable — such a collision cannot be merged at all — and it is
exactly what the dialog would have produced had Merge simply not been offered. I chose
this over adding a partial-prompt path (auto-merge the mergeable ones, still prompt the
rest), because the brief says not to prompt about a folder group on that branch and
because a refill hitting a *file* of the folder's name means something outside this app
replaced the directory. Registered in the comment at the branch site.

**RED evidence** (test applied before the fix):

```
 FAIL  src/files/composables/useUploadConflicts.test.ts > useUploadConflicts > assumeMergeForFolders resolves a folder collision as merge without opening the dialog
Error: Test timed out in 5000ms.
 ❯ src/files/composables/useUploadConflicts.test.ts:191:3

 FAIL  src/views/__tests__/Files.uploadConflict.test.ts > Files.vue upload-conflict wiring > a refill merges into the folder it is refilling instead of prompting
Error: Test timed out in 5000ms.
 ❯ src/views/__tests__/Files.uploadConflict.test.ts:168:3
```

(Both time out rather than assert-fail because, unfixed, the dialog opens and nothing ever
answers it — which is precisely the user-visible symptom.)

**Tests added / changed:**

- `useUploadConflicts.test.ts`: `assumeMergeForFolders resolves a folder collision as merge
  without opening the dialog` — folder `Trip` present in the target, dialog must stay
  closed, precheck must have run once, and the entry must come back as `Trip/1.jpg` with
  an empty policy (explicitly *not* `Trip(1)/1.jpg`).
- `useUploadConflicts.test.ts`: `assumeMergeForFolders still runs the inner round for
  genuinely colliding files` — proves the short-circuit is scoped to round 1.
- `useUploadConflicts.test.ts`: `assumeMergeForFolders leaves plain file-vs-file conflicts
  prompting` — proves the file queue is untouched.
- `Files.uploadConflict.test.ts`: the existing refill test was rewritten as instructed. It
  previously listed `/DATA/Elsewhere` as **empty** specifically so it never had to drive
  the dialog; it now lists the colliding `Trip` folder as present (the real-world shape,
  since the interrupted batch created it) and asserts the conflict dialog's `open` prop is
  `false` and that the entry is enqueued as `Trip/a.jpg` into `/DATA/Elsewhere`. The
  service mock gained `file: { uploadPrecheck }`, which the merge path now reaches.

**GREEN evidence:**

```
 Test Files  2 passed (2)
      Tests  26 passed (26)
```
(`useUploadConflicts.test.ts` + `Files.uploadConflict.test.ts` after the fix.)

---

## D — a cancel in the file queue does not suppress round 2

**Changed.** `src/files/composables/useUploadConflicts.ts`

```ts
const batchCancelled = folderCancelled || fileResolutions.some((r) => r.action === 'cancelled')

if (mergeEntries.length && batchCancelled) {
  cancelledCount += mergeEntries.length
} else if (mergeEntries.length) {
  … existing precheck / round-2 block, unchanged …
}
```

This mirrors the existing folder→file guard and covers both ways a round-1 cancel can
happen: a cancel in the file queue, and a cancel partway through the folder queue that
still left earlier merge entries behind. The inner precheck is skipped entirely, so no
network call is made for a batch the user has already abandoned. `mergeEntries.length`
folds into `cancelledCount`, **not** `skippedCount` — the caller reports the two
separately and "the user stopped answering" is not "the user chose to skip". Reason
recorded in an English comment.

**RED evidence:**

```
 FAIL  src/files/composables/useUploadConflicts.test.ts > useUploadConflicts > cancel in the file queue also suppresses the merged folder second round
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ src/files/composables/useUploadConflicts.test.ts:178:33
    177|     for (let i = 0; i < 50; i++) await Promise.resolve()
    178|     expect(c.dialog.value.open).toBe(false)
       |                                 ^
```

That is the reported bug verbatim: the dialog reopened for `Trip/1.jpg`.

**Test added** — `cancel in the file queue also suppresses the merged folder second round`,
driving exactly the described scenario (drop `Trip/` colliding with an existing folder plus
`a.txt` colliding with an existing file; answer **Merge**, then cancel the `a.txt` prompt).
Asserts the dialog stays closed, `precheck` was never called, `accepted` is empty,
`cancelledCount === 2` and `skippedCount === 0`.

**GREEN evidence:** `Test Files 1 passed (1)` / `Tests 16 passed (16)`.

---

## E — dialog is view-scoped while the batch is app-scoped

**Changed.** `src/files/composables/useUploadConflicts.ts` — imports `getCurrentScope`
and `onScopeDispose` from `vue`, and registers, during synchronous setup:

```ts
if (getCurrentScope()) {
  onScopeDispose(() => { if (resolver) settle(null) })
}
```

`settle(null)` is the existing cancel path, so a torn-down scope resolves the batch as
cancelled and the caller's normal cancelled-count toast runs, instead of `run()` hanging
forever and the user's drop silently doing nothing.

I did **not** hoist the dialog to `App.vue` — that is the structural fix and is explicitly
out of scope for this wave. The commit body records that.

**Judgement call — the `getCurrentScope()` guard.** `onScopeDispose` warns when called with
no active effect scope, and `useUploadConflicts` is called directly (outside any component)
by its own unit tests. Guarding the registration is the clean handling: inside a component
the scope always exists, so behaviour there is unaffected; outside one there is nothing to
dispose and nothing to warn about. A regression test pins this down so the warning cannot
creep back in.

**RED evidence:**

```
 FAIL  src/files/composables/useUploadConflicts.test.ts > useUploadConflicts > tearing down the owning scope settles an open prompt as cancelled instead of hanging
Error: Test timed out in 5000ms.
 ❯ src/files/composables/useUploadConflicts.test.ts:222:3
```

The timeout *is* the bug — the batch promise never settled.

**Tests added:**

- `tearing down the owning scope settles an open prompt as cancelled instead of hanging` —
  creates a real `effectScope()`, runs the composable inside it, starts a batch, waits for
  the prompt to open, calls `scope.stop()`, then asserts the batch resolves with
  `accepted: []`, `cancelledCount: 1` and a closed dialog.
- `can be created outside any effect scope without warning` — asserts no `console.warn`
  when the composable is constructed with no active scope, guarding the
  `getCurrentScope()` branch.

**GREEN evidence:** `Test Files 1 passed (1)` / `Tests 15 passed (15)` (E alone),
`16 passed` after D, `26 passed` across both files after C.

---

## Verification — all four gates, clean working tree, at HEAD `8aecf73`

### 1. `pnpm exec vitest run src/files/ src/views/ oss/`

```
 Test Files  143 passed (143)
      Tests  1536 passed (1536)
   Duration  84.80s
```

### 2. `pnpm exec vue-tsc --noEmit`

```
TSC_EXIT=0
```
(no diagnostics printed)

### 3. `pnpm test` — FULL suite, foreground

```
 Test Files  652 passed (652)
      Tests  10498 passed (10498)
EXIT=0
```

No failures. `DesktopContextMenu.test.ts` passed. For comparison, the same command at the
branch point `a365b7e` gave `Test Files 644 passed (644)` / `Tests 10408 passed (10408)`,
exit 0 — so this wave adds 8 test files and 90 test cases, all green.

### 4. `pnpm build`

```
✓ built in 19.17s
BUILD_EXIT=0
```
Only the pre-existing "chunks larger than 500 kB" advisory, unchanged.

---

## Cleanup

The throwaway `a365b7e` worktree used for finding B was removed
(`git worktree remove --force`); `git worktree list` no longer lists it, and the branch
worktree is clean.

## Not re-opened

Per instruction, none of the already-adjudicated items were touched: Task 6's
annotation-only test, `humanize(404)`'s `'network'` label, the 404/410 retry path skipping
the backoff sleep, `settle()`'s shape, and the repo-wide `Plugin has already been applied`
warning.

## Open concerns

1. **`DesktopContextMenu.test.ts` is a genuine load-sensitive flake**, pre-existing and
   untouched here (finding B). It reproduces at roughly 1-in-8 under heavy CPU load even
   when run alone. Worth its own ticket: replace the single `flushPromises()` with the
   bounded polling idiom already used in `Files.uploadConflict.test.ts`. The same
   fragility bit `src/i18n/__tests__/photosSlice.test.ts` (5000ms timeout) once during
   this session, so it is a suite-wide pattern rather than one bad file.
2. **Finding E is contained, not cured.** The dialog is still owned by `Files.vue`. A
   batch interrupted by navigation now reports itself as cancelled instead of vanishing,
   which is honest but still not what the user wanted. Hoisting the conflict dialog to
   `App.vue`, the way the unload guard was hoisted, remains the real fix.
