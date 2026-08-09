# Task 7 report — collapse paste's two guessed options into one, ask only on real collisions

## Files changed

- `src/files/composables/useFileOps.ts` — `paste()` no longer takes a `style` arg. It now
  pulls `useFileConflictsStore().resolvePaste(o.item, files.currentPath)`, toasts the skip
  count if any, and submits up to two `service.batch.task` calls (`style: 'overwrite'` for
  `overwriteItems`, `style: 'rename'` for `renameItems`), then clears the clipboard.
- `src/files/components/FileContextMenu.vue:62-65` — two `ContextMenuItem`s
  (`ctx-paste-overwrite` / `ctx-paste-skip`) collapsed into one `ctx-paste` firing action
  `paste`, labeled with the existing `filesPaste` key.
- `src/views/Files.vue:169` — `case 'paste-overwrite'` / `case 'paste-skip'` merged into
  `case 'paste': ops.paste(); break`. Line `:644` (toolbar chip) — `ops.paste('overwrite')`
  → `ops.paste()`.
- `src/i18n/zh_cn.base.ts`, `src/i18n/en_us.base.ts` — added `filesPasteSkipped`
  (`已跳过 {count} 项` / `Skipped {count} item(s)`), removed `filesCtxPasteOverwrite` and
  `filesCtxPasteSkip` from both files.
- Tests: `src/files/composables/useFileOps.test.ts`, `src/files/components/FileContextMenu.test.ts`.

## Step 2 — confirmed red

```
pnpm exec vitest run src/files/composables/useFileOps.test.ts src/files/components/FileContextMenu.test.ts
```
Result: 5 failed / 61 passed. Failures were exactly the new/changed assertions (single-task
`style` undefined because old `paste(style)` signature still required an arg that callers no
longer pass; "everything skipped" case still submitted a task; ctx-paste absent because the
old two-item markup was still in place). This confirms the tests exercise the new behavior,
not a typo.

## Step 4 — confirmed green

```
pnpm exec vitest run src/files/composables/useFileOps.test.ts src/files/components/FileContextMenu.test.ts src/views/Files.test.ts src/i18n/
```
Result: **11 test files passed, 279 tests passed.** (`src/i18n/` glob picked up
`messageSyntax.test.ts`, `parity.test.ts`, and any other i18n suites in that dir — all green.)

## Delete-before-self-check grep

Before deleting the two keys:
```
grep -rn "filesCtxPasteOverwrite\|filesCtxPasteSkip" src/
```
→ only `src/i18n/zh_cn.base.ts:83-84` and `src/i18n/en_us.base.ts:83-84` (the two locale
files themselves) plus, at the time of the check, the negative assertions already written in
`FileContextMenu.test.ts` referencing the class names `.ctx-paste-overwrite`/`.ctx-paste-skip`
(not the i18n key names — those don't match this grep pattern, confirmed separately that no
test file references the key strings as fixtures).

After deleting the keys from both locale files:
```
grep -rn "filesCtxPasteOverwrite\|filesCtxPasteSkip" src/
```
→ zero matches (exit code 1). Confirms the keys are fully orphaned and safe to delete.

Ran `messageSyntax.test.ts` explicitly as instructed (also covered by the Step 4 `src/i18n/`
glob run above) — passes.

## `vue-tsc --noEmit`

```
pnpm exec vue-tsc --noEmit
```
No output, exit clean. No type errors introduced.

## `clipboard.clear()` timing

Kept inside the same `try` block, after both conditional `service.batch.task` calls, exactly
as the brief's code specifies:

- If `resolvePaste` throws (e.g. a `listFolder` network hiccup during conflict detection),
  the `catch` fires, we toast `filesOpFailed`, and `clipboard.clear()` is **never reached** —
  the user's clipboard selection survives so they can retry paste without re-selecting.
- If everything is skipped (`overwriteItems`/`renameItems` both empty), no task is submitted
  but `clipboard.clear()` still runs — this matches Step 1's test
  ("paste clears the clipboard and submits nothing when every item was skipped") and the
  brief's stated behavior: a fully-skipped paste is still a completed decision, not a failure.
- If the first `batch.task` call (overwrite) succeeds but the second (rename) throws, the
  `catch` fires and `clipboard.clear()` is skipped — the already-submitted overwrite items
  are already in flight server-side, but the clipboard is left intact rather than silently
  losing track of the not-yet-submitted rename batch. I flagged this as an asymmetric edge
  case worth being aware of but did not change the design for it in this round.

**CORRECTION (fix-round-1, F2): the parenthetical above about what happens on retry was
backwards and is retracted.** I had written that re-pasting after this partial failure would
be safe because "resolvePaste will simply not find [the already-moved items] as conflicts."
That is wrong on both counts the reviewer named: (1) for a **copy**, the already-landed items
are sitting at the destination with the same name, so a retry's conflict check finds them
again and re-asks the user — not a silent no-op; (2) for a **move/cut**, the already-moved
items' source path no longer exists, so a retry would try to move a path that isn't there
anymore. Neither of those is "no problem on retry." See the "Fix round 1" section below for
what actually changed in response (F2): the two batches are now submitted independently with
tracked per-batch outcomes, so a partial failure gets its own distinguishable toast instead of
being silently retried as if nothing had happened, and the user is told a batch may need
manual follow-up rather than being invited to just paste again.

No case in the original round seemed bad enough to warrant stopping and asking — the
try/catch degraded to "toast a failure, keep the clipboard" uniformly, which never discarded
the user's copy/cut selection. That much was correct; only the retry-safety claim above was not.

## Commit

`7b8f966` — "feat(files): detect paste collisions instead of pre-choosing a policy"
(message text taken verbatim from the brief).

## Concerns / things I'm not fully sure about

- Per control point 3, `computePasteConflicts` failure inside `resolvePaste` is *not* handled
  with graceful degradation the way the upload path's `run()` is — it propagates and the
  outer `try/catch` in `paste()` turns it into a single `filesOpFailed` toast for the whole
  batch. I judged this doesn't rise to "worse than a toast" (clipboard isn't cleared, no data
  loss, user can just retry), so I implemented exactly what the brief specified rather than
  changing the design. Flagging per the controller's instruction, not asking for a redesign.
- I translated the pre-existing Chinese test description "paste 无剪贴板内容时不发请求" to
  English ("paste does nothing when the clipboard is empty") since I was already touching
  that exact line to drop the `'overwrite'` argument — a one-line, in-place rename, not a
  broader sweep of the file's other (untouched) Chinese descriptions.

---

## Fix round 1

Review came back: spec check passed, and the reviewer's own mutation test passed (deleting
`renameItems` from the return produced two real red tests). Five open findings came back
(F1-F3 upgraded to Important by the controller, F4/F5 Minor). All five addressed below.
Commit: `0f45fec` — "fix(files): pin paste's destination, don't clear on cancel, report
partial failure".

### F1 — destination read twice, could drift mid-await

**Root cause:** `paste()` called `conflicts.resolvePaste(o.item, files.currentPath)` once,
then read `files.currentPath` again (live) in each `buildPastePayload(...)` call after the
`await`. Between those two reads, `resolvePaste` has to await a directory listing (and may
queue behind an in-flight upload's own conflict chain) with no modal blocking the UI — the
user can navigate to a different folder in that window. The conflict answers gathered for
directory A would then get submitted against whatever directory the user is looking at when
the promise resolves.

**Fix:** `const dest = files.currentPath` captured once at the top of `paste()`, before the
first `await`, and reused for the conflict check and both submissions. See
`src/files/composables/useFileOps.ts:126`.

**Side question the controller raised:** should `blockedInSnapshot()` also be re-checked
after the await? I judged no, and left a comment explaining why:
`blockedBySnapshotView()` (in `src/files/util/snapshotRestore.ts`) only inspects the boolean
`browse.isSnapshotView` — it is not parameterized by path at all. Re-running it after the
await would answer "is the view the user is CURRENTLY looking at a snapshot", which has
nothing to do with `dest` (now frozen to the directory paste actually started in). A
directory's snapshot-ness doesn't change retroactively while `dest` sits still, so the single
check at the top — made while `files.currentPath === dest` — already correctly gates the
actual write target. Re-checking would be asking the right-sounding question about the wrong
directory.

**Mutation test (required):** reverted the fix by changing the `submit` closure's
`buildPastePayload({ ...o, item: items }, dest, style)` back to
`buildPastePayload({ ...o, item: items }, files.currentPath, style)`, then ran:
```
pnpm exec vitest run src/files/composables/useFileOps.test.ts -t "paste submits to the directory it started in"
```
Result: **1 failed** — `to: '/DATA/dirB'` (live, wrong) instead of the expected
`to: '/DATA/dirA'` (frozen, correct). Reverted the mutation; full file re-run afterward: 35/35
passed at that point (38/38 after the F2 tests were added later in this round).

### F2 — partial-failure cleanup was wrong, and my earlier justification for it was backwards

**Root cause:** the two `service.batch.task` calls ran under one `try` — if the overwrite
batch's request succeeded and the rename batch's then threw, the `catch` produced a single
generic "operation failed" toast, even though the backend had already accepted the first
batch. My original report defended the "don't clear on any exception" fallback with a claim
that retrying would be harmless; the controller correctly called that claim backwards (see the
correction inserted above in the original report body).

**Fix (chose option (a), not a plain debt ticket):** the two batches are now submitted
independently via a `submit()` helper returning a three-way outcome — `'empty'` (nothing to
send), `'ok'`, or `'failed'` — for each of the overwrite/rename groups. The three-way return
matters: a first draft used a plain boolean (`true` meaning "ok or nothing to send"), and that
version misclassified "the only non-empty batch failed" as a **partial** failure (because the
empty batch trivially counted as "ok"), when it should read as a **total** failure since there
was never a second batch to partially succeed. Decision table on the two outcomes:
- no `'failed'` in the pair → success path; clipboard clears unless `cancelledCount > 0` (F3).
- `'failed'` present and no `'ok'` present → total failure, `filesOpFailed` toast, clipboard
  kept.
- `'failed'` present and `'ok'` present → partial failure, new `filesPastePartialFailure`
  toast, clipboard kept (so the un-submitted/failed batch isn't silently discarded).

New i18n key `filesPastePartialFailure`: zh `部分粘贴失败,请检查目标目录后重试` / en
`Part of the paste failed — check the destination and try again`. Added to both
`zh_cn.base.ts` and `en_us.base.ts`.

**Residual limitation, stated plainly (not hidden this time):** on a partial failure the
clipboard is left holding the FULL original item list, including the items that already
landed successfully. If the user pastes again, the successful batch's items will be
re-evaluated for conflicts against a destination that now already contains them (for copy,
this re-triggers the conflict dialog for something already handled; for move/cut, the source
of the successful items no longer exists and a retry attempt on those specific items would
fail server-side). This is a known trade-off of choosing "never silently discard clipboard
state on any failure" over "always compute the exact still-pending remainder" — the latter
would need to persist per-item completion state across a failed batch, which felt like more
mechanism than this ticket's scope. Flagging it as a real limitation rather than asserting
retries are safe.

**Tests added:** `useFileOps.test.ts` — "paste reports a partial failure when one batch
submits and the other does not, and keeps the clipboard", "paste reports a plain failure when
the only batch it needed to submit fails" (the one that would have caught the boolean-based
first draft), "paste reports a plain failure when both batches fail".

**Mutation check (self-imposed, not required by the controller for F2, but the three-way
outcome fix was itself a bug I found while testing my own first draft):** reverted `'empty'`
to `return 'ok'` in the `submit` helper (recreating the boolean-style bug) and ran:
```
pnpm exec vitest run src/files/composables/useFileOps.test.ts -t "reports a plain failure when the only batch"
```
Result: **1 failed** — toast was `filesPastePartialFailure` instead of the expected
`filesOpFailed`. Reverted the mutation.

### F3 — Esc-to-cancel cleared the clipboard

**Root cause:** `resolveConflictQueue` marks a cancelled conflict (and everything queued
behind it) with action `'cancelled'`, and `splitPasteItems` folded that into the same
`skippedCount` bucket as an explicit `'skip'`. When every item ended up cancelled, both
`overwriteItems` and `renameItems` came back empty — indistinguishable from "the user
explicitly chose to skip everything" — and `paste()` cleared the clipboard either way. Esc
means "not now", not "discard what I copied".

**Fix:** `splitPasteItems` (in `src/files/upload/pasteConflict.ts`) now also returns
`cancelledCount`, counting only `'cancelled'` resolutions (kept as a strict subset that is
also still folded into `skippedCount`, per the controller's note that the toast count itself
was fine as-is). `paste()` only calls `clipboard.clear()` when the success path is reached
AND `cancelledCount === 0`.

**Mutation test (required):** reverted the fix by changing `if (cancelledCount === 0)
clipboard.clear()` back to an unconditional `clipboard.clear()`, then ran:
```
pnpm exec vitest run src/files/composables/useFileOps.test.ts -t "paste does not clear the clipboard when the user cancels"
```
Result: **1 failed** — `expected null not to be null` (clipboard had been cleared). Reverted
the mutation.

### F4 — no test on the FileContextMenu → Files.vue wiring seam

Added two tests to `src/views/Files.test.ts`:
- "toolbar Paste button reaches ops.paste() and submits the clipboard contents" — clicks the
  real `.tb-paste` button.
- "context menu 'paste' action reaches ops.paste(), not a stale paste-overwrite/paste-skip
  handler" — calls `w.findComponent(FileContextMenu).vm.$emit('action', 'paste', null)`
  directly on the real (non-stubbed) `FileContextMenu` instance, so it exercises Files.vue's
  actual `case 'paste':` dispatch without needing to drive reka-ui's real popover positioning
  through jsdom. Combined with FileContextMenu.test.ts's existing assertion that the real menu
  item fires `action === 'paste'`, the two together close the gap: one proves the menu emits
  the string, the other proves the dispatcher still listens for it.

Both required adding `batch: { task: vi.fn().mockResolvedValue(undefined) }` to the
`@nimotech/nimoos-service` mock at the top of `Files.test.ts` (it wasn't there before — no
prior test in that file needed it) and importing `service` directly so the tests can assert
against the same mock function object.

### F5 — one remaining Chinese test description in the same file

`FileContextMenu.test.ts:161` — `'空白区:无剪贴板内容时无粘贴项'` → `'blank area: no Paste
entry when the clipboard is empty'`.

### Test runs this round (all in foreground, per instructions)

```
pnpm exec vitest run src/files/upload/pasteConflict.test.ts                      # 7 passed
pnpm exec vitest run src/files/composables/useFileOps.test.ts                    # 38 passed
pnpm exec vitest run src/views/Files.test.ts                                     # 26 passed
pnpm exec vitest run src/files/composables/useFileOps.test.ts \
  src/files/components/FileContextMenu.test.ts src/views/Files.test.ts \
  src/i18n/ src/files/upload/pasteConflict.test.ts \
  src/files/composables/useFileConflicts.test.ts                                # 13 files / 316 passed
pnpm exec vue-tsc --noEmit                                                       # clean, no output
```

### Commit

`0f45fec` — "fix(files): pin paste's destination, don't clear on cancel, report partial
failure"

---

## Fix round 2

Re-review came back on the round-1 diff: F1/F2/F3/F5 all ADDRESSED (mutation tests re-run by
the reviewer, both directions genuinely red/green). F2's stated residual limitation (a retry
after partial failure can re-trigger a conflict prompt or hit a vanished source path) was
judged "honestly disclosed, acceptable as a tracked debt." But the round-1 diff introduced two
new Important findings (N1, N2) plus one Minor (N3). All three addressed below. Commit:
`19840e5` — "fix(files): make the FileContextMenu wiring test real, keep backend error text".

### N1 — the F4 wiring test was a false positive (the most serious one)

**Two independent bugs stacked on top of each other here**, and fixing only one would have
left the test still not proving what it claimed to prove.

**Bug 1 — no mock isolation.** `Files.test.ts`'s `beforeEach` never called
`vi.clearAllMocks()`, while `service.batch.task` is a module-level `vi.fn()` shared across
every test in the file. The "toolbar Paste button" test (which runs first in file order) left
a real `{ style: 'rename', to: '/DATA' }` call in that mock's history. The "context menu
paste action" test's `toHaveBeenCalledWith(...)` assertion then matched that leftover call
regardless of whether the test's own trigger did anything at all. The reviewer's own
mutation evidence: changing `Files.vue`'s `case 'paste':` to `case 'paste-overwrite':` and
running with `-t "paste"` (both tests together) stayed green; only running the single test in
isolation went red. **That is precisely backwards from what the test exists to catch** — in a
real `pnpm test` run, every test in the file executes together, so the regression this test
was added for would have shipped silently.

Fix: added `vi.clearAllMocks()` to the outer `beforeEach` (`src/views/Files.test.ts:48`),
matching the existing convention already in `useFileOps.test.ts:49`.

**Bug 2 — once isolated, the test's own trigger mechanism turned out not to work at all.**
With mocks properly cleared, the "context menu paste action" test started failing outright
(0 calls to `service.batch.task`) — not because of a real bug in `Files.vue`, but because the
test's own technique was broken. I had driven the event via
`w.findComponent(FileContextMenu).vm.$emit('action', 'paste', null)`. Debugging (instrumenting
both `ops.paste()` and a control `ops.refresh()` with temporary `console.log`s, since neither
function is exposed for a spy) showed:
- `menu.emitted('action')` DID record the call — Vue Test Utils' own tracking layer saw it.
- `vnode.props.onAction` WAS present, typed `function`, and correctly resolved.
- Neither `ops.paste()` NOR `ops.refresh()` ever actually ran when triggered this way — no
  `console.log` output, no `service.folder.getList` call from `ops.refresh()`'s `files.load()`.

Conclusion: calling `.vm.$emit(...)` directly on a `<script setup>` child component's public
instance gets recorded by VTU's own `emitted()` bookkeeping but, in this Vue 3.4 /
`@vue/test-utils` 2.x combination, does **not** actually invoke the parent's `onXxx` listener
prop the way a real emitted event does. I could not find this documented anywhere and did not
chase down why in Vue's internals — I'm flagging it here as an empirically-confirmed technique
that doesn't do what it looks like it does, in case it resurfaces elsewhere in this codebase's
tests. `grep -rn "vm\.\$emit" src/` currently returns nothing else, so this was the only place
using it.

**Fix:** rewrote the test to stub reka-ui's `ContextMenu`/`ContextMenuItem` primitives —
the exact same `ContextMenuStub`/`ContextMenuItemStub` pattern `FileContextMenu.test.ts`
already uses for the reason documented there (the real `ContextMenuItem` injects a
`MenuRootContext` that only a real `ContextMenuRoot` provides, and throws without one) — then
drive an actual DOM `click` on the real (stub-rendered) `.ctx-paste` element. This goes through
`FileContextMenu.vue`'s own real `fire()` → real `emit('action', ...)` → real `onAction` prop,
with nothing manually simulated.

**A second wiring wrinkle surfaced immediately**: `FilesSidebar.vue` also renders its own
`FileContextMenu` (for the favourites list), so the stub produces **two** `.ctx-paste`
elements in the tree once both are stubbed. `w.get('.ctx-paste')` picks the first DOM match,
which turned out to be the sidebar's — wired to `FilesSidebar.vue`'s `onFavoriteAction`, which
intentionally no-ops for a null entry (`if (entry) emit('ctx-action', action, entry)` — blank-
area actions like 'paste' are never forwarded from there by design). The test now
disambiguates by picking the `.ctx-paste` whose sibling in the stub's rendered tree is
`.files-listwrap` — the actual trigger content `Files.vue` passes into its own
`<FileContextMenu>` — rather than relying on DOM order.

**Mutation test (required, whole file, not `-t`):**
```
# mutated: case 'paste': -> case 'paste-overwrite': in src/views/Files.vue:169
pnpm exec vitest run src/views/Files.test.ts
```
Result: **1 failed, 25 passed** — `context menu "paste" action reaches ops.paste()...` failed
with `Number of calls: 0`, while every other test (including the toolbar-button test that
previously propped this one up) still passed independently. This is the key confirmation: the
false-positive coupling from Bug 1 is gone, since the toolbar test's own successful call no
longer leaks into this test's assertion.
```
# reverted
pnpm exec vitest run src/views/Files.test.ts
```
Result: **26 passed**.

### N2 — `submit()` discarded the caught error, forcing every failure through the generic toast

**Root cause:** the round-1 `submit()` helper returned a bare `'empty' | 'ok' | 'failed'`
string, catching the batch-task error only to throw it away (`catch { return 'failed' }`).
Every failure — regardless of cause — surfaced as the hardcoded `filesOpFailed` /
`filesPastePartialFailure` text. The code this replaced (`resolvePaste`'s own `catch (e) {
toast.show(errMsg(e, t('filesOpFailed'))) }`, still present a few lines above, unchanged)
correctly showed the backend's own message when there was one. Concrete scenario named by the
reviewer: pasting into a read-only mount used to tell the user why; the round-1 version just
said "operation failed".

**Fix:** `SubmitOutcome` is now a discriminated object (`{ status: 'empty' }` /
`{ status: 'ok' }` / `{ status: 'failed'; error: unknown }`) so the caught error travels
alongside the outcome instead of being dropped. Both the total-failure and partial-failure
toasts now run through `errMsg(failures[0].error, ...)` — the same helper `resolvePaste`'s
catch uses — so the two error-reporting paths in this one function are consistent again
instead of diverging (one showing real backend text, the other always generic). The three-way
`'empty'/'ok'/'failed'` classification logic from F2 is otherwise untouched: `failures.length`
replaces the old `outcomes.includes('failed')` boolean, `succeeded` is computed the same way,
and both failure branches still leave the clipboard uncleared.

**Test changes:** the three round-1 tests that asserted the hardcoded fallback text
(`paste reports a partial failure...`, `...only batch it needed to submit fails`, `...both
batches fail`) were rejecting with `new Error('network blip')` / `new Error('a')` /
`new Error('b')` — real messages that the N2 fix now surfaces verbatim, so those exact
assertions would have gone red against the FIXED code (they were pinning the bug, not the
fix). Replaced with five tests that pin both halves of the corrected behavior:
- "shows the backend's own reason when one batch submits and the other fails" (partial,
  message present)
- "falls back to the generic partial-failure message when the backend gives no reason"
  (partial, `new Error()` with no message)
- "shows the backend's own reason when the only batch it needed to submit fails" (total
  failure, message present — this is literally the read-only-mount scenario)
- "falls back to the generic failure message when both batches fail without a specific
  reason" (total failure, no message)
- "shows the backend's own reason when both batches fail for the same reason" (total failure,
  message present, both rejects carry it)

**Mutation test (self-imposed, matching the pattern from round 1's F2 self-check):** reverted
both toast lines to the hardcoded `t('filesOpFailed')` / `t('filesPastePartialFailure')` (no
`errMsg`), then ran:
```
pnpm exec vitest run src/files/composables/useFileOps.test.ts
```
Result: **3 failed, 37 passed** — the three "shows the backend's own reason..." tests failed,
each showing the fallback text instead of the specific message (`"read-only filesystem"` /
`"disk full"` expected, hardcoded Chinese fallback text received). Reverted the mutation; full
file re-run: 40/40 passed.

### N3 — partial-failure message invited a retry into a known bad outcome (Minor)

`filesPastePartialFailure` said "check the destination and **try again**" /
"请检查目标目录后**重试**" — but the round-1 report's own disclosed F2 limitation is that a
retry after a partial failure re-triggers the conflict dialog for a copy's already-landed half,
or targets a vanished source path for a cut's already-moved half. The message was steering the
user toward exactly the rough edge being disclosed as a known limitation.

**Fix:** dropped the "try again" / "重试" wording from both locales.
- zh: `部分粘贴失败,请检查目标目录后重试` → `部分粘贴失败,请检查目标目录`
- en: `Part of the paste failed — check the destination and try again` →
  `Part of the paste failed — check the destination`

Tests reference `zh.filesPastePartialFailure` dynamically (not a hardcoded literal), so no
test needed updating for the wording change itself.

### Test runs this round (all in foreground, per instructions)

```
pnpm exec vitest run src/views/Files.test.ts                                     # 26 passed
pnpm exec vitest run src/views/Files.test.ts   # mutation: case 'paste-overwrite' # 1 failed / 25 passed
pnpm exec vitest run src/views/Files.test.ts   # reverted                        # 26 passed
pnpm exec vitest run src/files/composables/useFileOps.test.ts                    # 40 passed
pnpm exec vitest run src/files/composables/useFileOps.test.ts  # mutation: no errMsg # 3 failed / 37 passed
pnpm exec vitest run src/files/composables/useFileOps.test.ts  # reverted        # 40 passed
pnpm exec vitest run src/files/composables/useFileOps.test.ts \
  src/files/components/FileContextMenu.test.ts src/views/Files.test.ts \
  src/i18n/ src/files/upload/pasteConflict.test.ts \
  src/files/composables/useFileConflicts.test.ts                                # 13 files / 318 passed
pnpm exec vue-tsc --noEmit                                                       # clean, no output
```

### Commit

`19840e5` — "fix(files): make the FileContextMenu wiring test real, keep backend error text"

### Concerns going into round 3

**CORRECTION (fix-round-3, M1): the paragraph above about `.vm.$emit()` not invoking the real
parent listener is wrong and is retracted.** Round 3's re-review ran a minimal
`defineComponent` parent/child repro (`child.vm.$emit('action')` against a plain `onAction`
spy) and got exactly one call — the technique works fine in general. The actual root cause,
confirmed by testing both `FileContextMenu` instances individually via
`findAllComponents(FileContextMenu)` (which returns **two** matches in `Files.vue`'s tree):
`all[1]` (the main listing's instance) responds to `.vm.$emit('action', 'paste', null)` with a
real `service.batch.task` call; `all[0]` (FilesSidebar.vue's own instance, for the favourites
list) does not, because `findComponent`/`findAll()` resolve to it first and its
`onFavoriteAction` deliberately no-ops for a null entry. The event was never silently dropped
by the test framework — it reached a real listener, just the wrong component's. This is the
exact same root cause as the "two `.ctx-paste` DOM elements" issue found later in the same
debugging session, not a second, independent bug. See the "Fix round 3" section below for the
corrected permanent code comment. No broader grep for `.vm.$emit()` elsewhere in the codebase
is warranted by this — the technique itself is not the problem.

- No new limitations introduced by N1/N2/N3 beyond what round 1 already disclosed for F2.

---

## Fix round 3

Re-review found N1/N2/N3 all ADDRESSED (reviewer re-ran both mutation directions on N1: whole
file, 1 failed/25 passed → reverted, 26 passed). This round's re-review used live probes
against the actual `mount(Files)` tree rather than static reading, and surfaced one Important
finding that falsifies round 2's own stated root cause (M1), one Important finding that
undoes half of F2's original fix (M2), and one Minor (M3). Commit: `637c345` — "fix(files):
correct N1's root cause, interpolate partial-failure reason".

### M1 — round 2's root-cause diagnosis for N1 was wrong (Important — corrected above and in code)

Addressed in full in the "CORRECTION" paragraph immediately above this section, and in the
rewritten comment at `src/views/Files.test.ts:212-226` (the test itself did not need to
change — the DOM-based fix from round 2 was already exercising the right code path via the
`.files-listwrap`-sibling disambiguation; only the explanation of WHY the earlier
`.vm.$emit()` draft failed was incorrect and needed correcting in the permanent comment, plus
the equivalent paragraph in this report). No test changes were required for M1 itself.

### M2 — the round-2 fix for N2 undid half of the original F2 fix

**Root cause:** `errMsg(error, fallback)` picks the backend's `.message` over the fallback
whenever one exists. Round 2's fix (`toast.show(errMsg(failures[0].error,
t('filesPastePartialFailure')))`) used `filesPastePartialFailure` purely as errMsg's
*fallback* argument — meaning it only ever appeared when the backend gave NO message at all.
In the realistic case (a read-only mount genuinely returns "read-only filesystem"), the
partial-failure toast showed **only** that raw backend text, with zero indication that half
the paste had already landed. That made it byte-for-byte identical to the total-failure toast
one line above it (`errMsg(failures[0].error, t('filesOpFailed'))` with the same error) —
exactly the ambiguity F2 was introduced to eliminate in round 1. Compounding it: round 2's own
new test pinned this as the expected behavior
(`expect(toastSpy).not.toHaveBeenCalledWith(zh.filesPastePartialFailure)`), so nothing would
have caught the regression.

**Fix:** `filesPastePartialFailure` now takes a `{reason}` placeholder in both locales:
- zh: `部分粘贴失败,请检查目标目录` → `部分文件已粘贴,另一部分失败({reason}),请检查目标目录`
- en: `Part of the paste failed — check the destination` →
  `Part of the paste landed, the rest failed ({reason}) — check the destination`

`useFileOps.ts`'s partial-failure branch now interpolates rather than replaces:
`toast.show(t('filesPastePartialFailure', { reason: errMsg(failures[0].error,
t('filesOpFailed')) }))`. The reason is still computed via `errMsg` (backend message if
present, else the generic fallback text) — only the OUTER wrapping changed from "swap in
errMsg's result for the whole toast" to "always keep the part-landed framing, drop the reason
into it." This keeps the total-failure and partial-failure toasts distinguishable regardless
of whether the backend supplies a message: the partial one always carries the "part landed"
wording as a prefix/suffix around the same reason text the total-failure toast would show
bare.

**Tests changed:** the two round-2 tests that pinned the wrong (replace-not-interpolate)
behavior were rewritten:
- "paste keeps the 'part landed' framing while including the backend's own reason" (was:
  "shows the backend's own reason when one batch submits and the other fails") — now asserts
  `zh.filesPastePartialFailure.replace('{reason}', 'read-only filesystem')` was shown, AND
  that the bare reason alone (`'read-only filesystem'`) was NOT shown (the previous, wrong
  behavior).
- "paste falls back to the generic reason inside the partial-failure template when the
  backend gives no reason" (was: "falls back to the generic partial-failure message...") —
  now asserts `zh.filesPastePartialFailure.replace('{reason}', zh.filesOpFailed)` (the
  fallback text now appears INSIDE the template, not standing alone).

**Mutation test (required):** reverted the interpolation back to a pure `errMsg`-replace call
(`toast.show(errMsg(failures[0].error, t('filesPastePartialFailure')))`), then ran:
```
pnpm exec vitest run src/files/composables/useFileOps.test.ts
```
Result: **2 failed, 38 passed.** The two tests above failed as expected — one showed the bare
`'read-only filesystem'` instead of the templated string; the other showed
`部分文件已粘贴,另一部分失败(),请检查目标目录` (empty parens — `t()` called with no
interpolation args left the literal `{reason}` placeholder resolving to nothing) instead of
the fallback-filled template. Reverted the mutation:
```
pnpm exec vitest run src/files/composables/useFileOps.test.ts
```
Result: **40 passed** (at that point in the round, before M3's test was added; 41 passed
after).

### M3 — both-batches-fail only ever showed the first failure's reason (Minor, fixed)

Judged worth fixing rather than just disclosing: the change was small and low-risk. When
BOTH the overwrite and rename batches fail for genuinely different reasons (e.g. one hits a
permissions error, the other a disk-space error), `failures[0].error` silently dropped the
second one. Now collects every failure's message via `errMsg`, dedups with a `Set` (so the
common case — both fail identically, e.g. the whole destination went read-only — still reads
as one reason, not "X; X"), and joins the distinct ones with `; `. Added a test ("paste shows
both reasons when the two batches fail differently") asserting the shown toast contains both
`'permission denied'` and `'disk full'` when the two batches reject with different messages.
The existing "both batches fail for the same reason" test (`'disk full'` / `'disk full'`)
still passes unchanged, confirming the dedup path.

### Test runs this round (all in foreground, per instructions)

```
pnpm exec vitest run src/files/composables/useFileOps.test.ts                     # 40 passed (pre-M3 test)
pnpm exec vitest run src/files/composables/useFileOps.test.ts  # mutation: M2 reverted to replace # 2 failed / 38 passed
pnpm exec vitest run src/files/composables/useFileOps.test.ts  # reverted                          # 40 passed
pnpm exec vitest run src/files/composables/useFileOps.test.ts                     # 41 passed (M3 test added)
pnpm exec vitest run src/files/composables/useFileOps.test.ts src/files/components/FileContextMenu.test.ts \
  src/views/Files.test.ts src/i18n/ src/files/upload/pasteConflict.test.ts \
  src/files/composables/useFileConflicts.test.ts                                  # 13 files / 319 passed
pnpm exec vue-tsc --noEmit                                                        # clean, no output
```

### Commit

`637c345` — "fix(files): correct N1's root cause, interpolate partial-failure reason"
