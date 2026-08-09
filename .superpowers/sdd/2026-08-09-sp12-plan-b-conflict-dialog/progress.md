# SDD ledger — plan: docs/superpowers/plans/2026-08-09-sp12-plan-b-conflict-dialog.md

Worktree: NimoOS-New-UI/.claude/worktrees/sp12-plan-b (branch sp12-plan-b)
Branch base (MERGE_BASE): a365b7e

## Pre-flight rulings

- Task 8 guard test `not.toContain('文件已存在')` was tautological (passes before and
  after the change; `filesUploadErrDuplicate` also contains that substring).
  User ruling 2026-08-09: **strengthen the assertion** — assert against something that
  is genuinely red before the removal (e.g. UploadPanel.vue source no longer imports
  Dialog / no longer references filesUploadConflict* keys, or seed a case that used to
  render the old dialog). Plan text is superseded for that one assertion only.
- Task 5 deletes `filesUploadConflictTitle`/`filesUploadConflictMsg` while
  `UploadPanel.vue` still references them until Task 8. Expected interim state:
  vue-i18n logs key-not-found, no test goes red. Not a defect; do not "fix" it in Task 5.

## Progress

Task 1: complete (commits a365b7e..27f4229, review clean)
  - Reviewer ⚠️ resolved by controller: no Vue2 behaviour deviation to register (the port
    is faithful; nothing to annotate). Test-count reconciliation deferred to a controller
    full-suite run.
Task 2: complete (commits 27f4229..84eb4cc, review clean)
  - Controller baseline fact: full suite at 84eb4cc's parent is **645 files / 10418 tests
    passing** (10408 + Task 1's 10). Task 1's report said "10347" — that figure was wrong;
    the tree is green. Do not treat 10347 as a baseline.
  - CARRY INTO TASK 7/9 (reviewer ⚠️, controller-confirmed real): `toSelectedFiles`
    (src/files/upload/selectedFiles.ts) strips leading slashes from relativePath, and its
    comment says why (the protected-dir check reads split('/')[0]). The new flow resolves
    conflicts BEFORE that normalization, so a '/Docs/a.txt' entry would group under the
    empty top segment and silently miss its conflict. Task 9 must normalize BEFORE
    calling resolveEntries, not after.
Task 3: complete (commits 84eb4cc..21ff569, review clean)
  - minor (deferred): duplicated "split relativePath at first slash" logic in
    groupByTopSegment vs applyUploadResolutions' folder-rename loop (uploadConflict.ts).
  - minor (deferred): uploadConflict.ts now carries 3 concerns (~220 lines); Task 4 adds a
    4th. Plan-mandated placement; revisit only if it grows much further.
  - minor (deferred): no exhaustiveness guard on the ConflictAction branch chain — a 6th
    action would silently be treated as keep_both.
Task 4: complete (commits 21ff569..26198b4, review clean)
  - minor (deferred): round-2 fallthrough comment mentions only keep_both, not a stray
    'merge'; round 1 is more explicit. One-line comment would close it.
  - NOT a defect (controller): reviewer called InnerPrecheckResult.is_dir "dead surface".
    Task 7 consumes it (innerConflicts' isDir). size_match stays unused by design.
  - report sloppiness only: implementers' per-file test-count breakdowns disagree across
    tasks; totals reconcile. Controller-verified suite total is the authority.
Task 5: complete (commits 26198b4..23cbce0, review clean)
  - Implementer reported DONE_WITH_CONCERNS: rewrote the brief's verbatim test file
    (reka-ui async Teleport, DOM leakage, `Array.prototype.at` not in this tsconfig's lib).
    Reviewer audited all 12 cases one by one and confirmed none weakened or vacuous;
    ran the file itself, 12/12. Concern resolved in the implementer's favour.
  - minor (deferred, PLAN-MANDATED, for final-review triage): FileConflictDialog.vue's
    `.fc-btn:hover` uses `var(--chip-bg-hover, var(--chip-border))` but `--chip-bg-hover`
    is defined nowhere in the repo — the fallback always fires. The codebase's real hover
    token is `--chip-bg-hi` (theme.css, used by .bar-btn:hover). Came verbatim from the
    brief. No current visible defect; one-word fix if triaged in.
  - minor (deferred): `[Vue warn]: Plugin has already been applied` on every test in this
    file. Verified repo-wide (all 24 files importing the i18n singleton also pass it as a
    mount plugin, while vitest.setup.ts already auto-installs it). Pre-existing infra debt,
    not introduced here.
Task 6: complete (commits 23cbce0..1e472c1, review clean after adjudication)
  - Important/plan-mandated finding, USER RULING 2026-08-09 = keep as-is: the added test
    verifies only the TypeScript annotation, not runtime behaviour. uploadPrecheck
    (packages/service/src/file.ts:29-38) blind-casts the whole results array, so nothing
    at runtime could have failed. The brief's "Step 2 expects vitest FAIL" is wrong —
    vitest strips types via esbuild and does not typecheck; the implementer got a real RED
    with `tsc --noEmit` instead, which was the right call.
  - The test's residual value: a guard against a future narrowing of that cast. It is NOT
    evidence about the backend contract. Final review: do not re-raise, this is adjudicated.
Task 7: fix round 1/5 dispatched (1 open: cancel does not span the two round-1 queues —
  Esc on the folder prompt re-opens for the file conflict, violating the plan's own
  acceptance item 8 and FileConflictDialog.vue's documented cancel semantics).
  - Deviation UPHELD by review: settle() only toggles `open`, full CLOSED reset in a
    finally around run(). The brief mandates BOTH an eager full reset in settle() AND a
    test asserting a field survives it — self-contradictory. The `open` false->true flip is
    a real component contract (FileConflictDialog.vue:49 resets applyToAll on that edge),
    not a test artifact. No user-visible consequence: Dialog.vue unmounts closed content
    and ask() writes all fields atomically.
  - minor (deferred): the deviation's own comment (useUploadConflicts.ts:68-71) justifies
    the open-flip with the tests' busy-wait pattern instead of the real production reason
    (FileConflictDialog.vue:49's applyToAll reset). A maintainer could read it as
    "test-only" and simplify the flip away, silently breaking the checkbox.
  - minor (deferred): `if (!entries.length)` returns before the try, the one exit that
    skips the finally reset. Harmless today; asymmetric.
  - minor (deferred): finally writes a fresh CLOSED object even for batches that never
    opened the dialog — one wasted reactive update per batch.
Task 7: fix round 1/5 (1 addressed, 0 open; commits 84569f6..8b8550c)
Task 7: complete (commits 1e472c1..8b8550c, review clean)
  - deferred design question (for final-review triage, NOT a defect in this task): a cancel
    in the FILE queue does not retroactively suppress round 2 for a group already resolved
    as `merge` in the folder queue. Consistent with resolveConflictQueue's documented
    "earlier decisions are never rolled back", but the plan's acceptance item 8 language
    (「本次及剩余全部取消」) is ambiguous about whether it spans rounds.
Task 8: complete (commits 8b8550c..654c46b, review clean)
  - The tautological guard was replaced per the user's ruling: it now reads UploadPanel.vue
    with node:fs (NOT ?raw) and asserts the Dialog import / conflictItem / resolveConflict
    are gone. Reviewer independently judged it genuinely falsifiable; RED/GREEN was proven.
  - minor (deferred): the rewritten clearDone test dropped the old test's negative
    assertion `expect(h.showSpy).not.toHaveBeenCalled()` (no success toast for a
    progress-0 done item). Narrow coverage loss, named.
  - minor (deferred): filesUploadSkip / filesUploadRename / filesUploadOverwrite are now
    unreferenced i18n keys in both locales. Correctly out of Task 8's scope (parity.test
    only checks key-set equality, not liveness). Follow-up: i18n dead-key sweep.
  - minor (deferred): the guard is source-text based, so a refactor keeping the same
    identifiers while reintroducing equivalent UI would not trip it.
Task 9: fix round 1/5 dispatched (2 open: forwarding guard leaves :allow-merge /
  :queue-index / :queue-total unguarded by BOTH test and type system — deleting
  :allow-merge silently kills the whole round-2 merge flow, deleting :queue-total silently
  removes the apply-to-all checkbox; plus a Chinese comment on Files.vue:233, a line this
  task rewrote, violating the English-comments global constraint).
  - Wiring itself verified correct: all 9 bindings match FileConflictDialog's declarations,
    both branches converge on one resolveEntries pipeline, protected-dir gate and snapshot
    guard survived byte-identical.
  - Controller-mandated normalization fix landed on all 4 counts and its test was verified
    (against groupByTopSegment's real slicing) to fail fast if the ordering were reverted.
  - Files.upload.test.ts edits judged minimal; the 4 added `conflictPolicy: ''` STRENGTHEN
    exact-match assertions. No test previously exercised a collision path, so the fixture
    rename retired nothing.
  - minor (deferred): Files.vue:230 refill filter matches pending.missing against the raw
    un-normalized relativePath — pre-existing, same ordering as the code it replaced.
  - minor (deferred): Files.upload.test.ts:21 comment says "several tests below upload
    themselves"; exactly one does.
  - minor (deferred): the cancel test asserts the same two things as the skip test (correct
    per spec, since skipped+cancelled collapse into one count) — its only distinguishing
    power is proving @cancel forwards. Not coverage of cancel-vs-skip semantics.
Task 9: fix round 1/5 (2 addressed, 0 open; commits e85fa52..10636f8)
Task 9: complete (commits 654c46b..10636f8, review clean)
  - Both forced-RED proofs are genuine assertion failures, not timeouts. @choose/@cancel
    detection now polls with a NAMED error instead of a 6s timeout.
  - minor (deferred): `:queue-index` remains unprovable-by-deletion — its real value on the
    FIRST prompt (0) equals its default. Closing it needs an assertion on the SECOND
    prompt (queueIndex === 1). Failure mode is purely cosmetic (wrong "Item N of M"),
    materially below the two bindings whose loss kills a feature. Reviewer's call and mine:
    deferred, not another round.
Task 10: complete (commits 10636f8..ba24ee3, review clean)
  - Verified against source, not the report: single install site (grep), the App-level test's
    router registers only a placeholder (never Files.vue) so it genuinely proves the
    "Files not mounted" path, `win=undefined` falls through to the real window
    (unloadGuard.ts:53), the Files.vue guard reads via node:fs and would genuinely fail on
    regression, and Files.vue's `service` import is still live (used at :353).
  - minor (deferred): App.vue:69 passes an inline arrow instead of a stable reference;
    App.unloadGuard.test.ts duplicates its mount instead of a beforeEach.
Task 11: fix round 1/5 dispatched (2 open, both USER-ADJUDICATED plan conflicts).
  - Verified by controller against source, not the report:
    * isRetryableTusError(404) === false (tusClient.ts:105-112) => after the new branch the
      code always falls into `!retryable` and returns. The plan's stated reason for
      `item.tusUploadUrl = null` ("the next attempt reads item in memory") is FALSE.
    * store patch() does Object.assign(item, p) on the same object (uploads.ts:55-63), so
      the direct assignment is redundant in production and untested (all 3 new tests assert
      only against the mocked patches array).
    * resumeItem/resumeBatch do NOT clear tusUploadUrl — and must not unconditionally, or
      every ordinary pause/resume would restart from byte 0 and destroy resumability.
  - USER RULING 1 (2026-08-09): delete `item.tusUploadUrl = null`; comment that the store's
    patch mutates the queue item in place.
  - USER RULING 2 (2026-08-09): make ONE press of 继续 succeed — after clearing the dead
    URL, take another turn of the loop (no resumeUrl => fresh upload) instead of erroring
    out. Bounded by the existing attempt counter; isRetryableTusError's global semantics
    unchanged; 409/401/5xx paths untouched. This is beyond the plan's prescribed change and
    exists to satisfy the plan's OWN acceptance item 12.
  - USER RULING 3: do NOT change humanize(404)'s 'network' label.
  - minor (deferred): humanize(404/410) still reads as a network problem on a genuine
    failure — the exact mislabeling the ticket describes. Follow-up ticket.
  - minor (deferred): mk()/mkItem() item-factory boilerplate duplicated across
    uploads.retryBatch.test.ts and scheduler.test.ts. Pre-existing.
Task 11: fix round 1/5 (2 addressed, 0 open; commits 59e4f7c..9a16076)
Task 11: complete (commits ba24ee3..9a16076, review clean)
  - Boundedness verified by re-review: a permanently-404ing item now makes exactly 4
    upload() calls (attempt 0..3), the same bound every other terminal path uses. No spin.
  - deferred observation (needs a nod if it ever resurfaces): the 404/410 continue path
    deliberately SKIPS sleepFn(BACKOFF_MS[attempt]) — 404/410 is a permanent condition of
    that URL, not a network problem, and the ticket's goal is that one press just works
    rather than waits ~13s. Explained in-code. Bounded either way.
  - The success test asserts calls[1].resumeUrl === undefined, i.e. it proves the
    fresh-upload mechanism, not merely that the item ended 'done'.
  - isRetryableTusError, humanize, and the 409/401/5xx paths verified byte-identical.

ALL 11 TASKS COMPLETE. Branch a365b7e..9a16076.

## Final whole-branch review + single fix wave

Final review (opus, a365b7e..9a16076): 0 Critical, 3 Important, 1 must-fix minor.
Closing gates additionally caught 2 red test files the per-task scoped runs could not see.

Fix wave commits:
  dacdc3c fix(files): stop leaking a stripped-feature word, use the real hover token (A+F)
  64dc045 fix(files): settle an open conflict prompt when the owning scope goes away (E)
  774b4c3 fix(files): make a cancel in the file queue suppress the merge second round (D)
  8aecf73 fix(files): merge a refill into the folder it is refilling, never prompt (C)

Scoped re-review (opus, 9a16076..8aecf73): all 6 ADDRESSED, no new breakage, ready to merge.

CONTROLLER-RUN CLOSING GATES (not relayed from any implementer), tree clean at 8aecf73:
  pnpm exec vitest run   -> 652 files / 10498 tests passed
  pnpm exec vue-tsc      -> clean
  pnpm build             -> built in 16.87s (only the pre-existing chunk-size advisory)
  parity.test.ts         -> 9/9
  oss/export.mjs --out <scratchpad> --no-commit --allow-dirty-oss -> zero real leaks
  grep hex/rgb in FileConflictDialog.vue -> none
Branch point a365b7e was 644 files / 10408 tests. Net +8 files / +90 tests.

DEFERRED (open tickets, none blocking merge):
  1. Finding E is contained, not cured. onScopeDispose settles the IN-FLIGHT prompt, but a
     batch queued behind it on `chain`, or one whose listFolder await is still pending at
     teardown, still hangs. Real fix = hoist the dialog to App.vue, same reasoning as the
     unload guard (ticket A). Explicitly out of scope for the fix wave.
  2. Refill + non-mergeable folder collision now degrades silently: on the refill branch a
     folder group whose name is occupied by a FILE is synthesized as merge, falls through
     applyUploadResolutions' non-mergeable path and becomes keep-both into Trip(1)/ with no
     dialog. Rare (something outside the app replaced the directory); documented in-code.
  3. Suite-wide async-boundary fragility: DesktopContextMenu.test.ts and
     i18n/__tests__/photosSlice.test.ts cross an async boundary on a single flushPromises()
     and fail under CPU load. PRE-EXISTING — proven by reproducing it with the file run
     ALONE under load, and by the file's module graph containing none of this branch's code.
     The repo already has the bounded-poll idiom (waitForDialogOpen) to convert them to.
  4. All per-task deferred minors above.

WORKSPACE NOT DELETED. `.superpowers/sdd/.gitignore` in this worktree is a bare `*`, so this
ledger and the 15 task/fix reports are NOT in git. Deleting the workspace would destroy the
only copy. (This contradicts the note that the bare-`*` ignore was fixed on 2026-08-07 —
verified false here on 2026-08-09.)

CORRECTION to deferred item 3 (controller, after the fix wave):
  The fix wave's diagnosis of the DesktopContextMenu failure — "load-sensitive race on a
  single flushPromises()" — is WRONG, though its "pre-existing, not introduced" verdict is
  right. The real root cause was already found by the parallel Plan C line: this file's
  `afterEach` does `document.body.innerHTML = ''`, which rips the still-open reka-ui portal
  out from under reka-ui's global layer state, so the NEXT mount refuses to open.
  Evidence: master (ff5be58) already carries the fix —
      afterEach: dispatch Escape -> await flushPromises() -> unmount, and do NOT wipe body
  while our branch point a365b7e still has the body wipe. "Reproduces when run alone" is
  therefore evidence of INTRA-file pollution (the wipe hits the next test in the same file),
  not of a load race; load only shifted the timing enough to expose it.
  DISPOSITION: no ticket. Merging sp12-plan-b into master resolves it automatically.
  Lesson (already in memory, re-earned here): "timing" is the too-convenient explanation.
