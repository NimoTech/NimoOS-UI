# SP4-P3b 上传持久化/刷新自动续传 — SDD Progress Ledger

Plan: NimoOS-UI/docs/superpowers/plans/2026-07-04-vue3-migration-sp4-p3b-persist-resume.md
Start: NimoOS-New-UI master @ 244258a
Shared pkg: NimoOS-Service sp3-shared-http @ 5481ae8 (NOT modified this phase)

## Tasks
- [x] Task 1: idb.ts + fake-indexeddb dev dep
- [x] Task 2: persist.ts (blob-budgeted persist/restore)
- [x] Task 3: uploads store persistence hooks (new/meta/drop)
- [x] Task 4: uploads store restore/resume/prune/initUploads
- [x] Task 5: uploads store reattachFiles
- [x] Task 6: uploadBatches needs_file → problem zone
- [x] Task 7: dropEntries.ts folder drag-drop
- [x] Task 8: Files.vue onDrop entries + initUploads on mount
- [x] Task 9: UploadPanel needs_file reselect + restore notice
- [x] Task 10: delete dead uploadListGroups
- [x] Task 11: build/deploy/verify + ledger

## P3b COMPLETE + DEPLOYED (2026-07-04). New-UI master HEAD = ab9b64a (start 244258a, 13 commits). NimoOS-Service NOT touched (sp3-shared-http @ 5481ae8). Both local, no remote — user pushes GitHub.
Deploy: NimoOS-New-UI/scripts/deploy.sh → /var/lib/nimoos/www/app/ (pnpm build + rsync dist/). /app/ HTTP 200; bundle contains nimo_files_upload + 重选文件/已恢复 i18n. Note: deploy built current working tree which included user's uncommitted parallel auth WIP (main.ts + onAuthFail.*) — user OK'd via directing to the ready deploy script.
Final full suite 368/368, tsc 0, build ok.

### Manual browser checklist handed to user (jsdom can't cover):
1. Upload in progress → refresh page → small/medium files auto-resume (no re-pick).
2. Close tab, reopen files area → unfinished uploads restored + restore-notice banner shows.
3. >200MB / >3GB-budget file after refresh → shows needs_file + 「重选文件」; reselect same file (size matches) → continues.
4. Reselect a DIFFERENT-size same-name file → no match (stays needs_file).
5. Drag a whole folder (with subdirs) → recursively expanded, aggregated into one batch.
6. Drag folder into a protected dir first-segment → rejected toast.
7. NAV TEST (the Critical fix): navigate away from files & back repeatedly during/after an upload → NO duplicate rows, NO double upload, needs_file rows don't multiply.
8. pruneOld: >30-day-old records gone (hard to verify immediately; long-term).

## FINAL whole-branch review (opus, 244258a..291924d): "With fixes" → 1 CRITICAL fixed.
CRITICAL (fixed, ab9b64a): initUploads ran on every Files.vue remount (no keep-alive + singleton store), restoreQueue push-without-guard → duplicate rows / double upload / unbounded needs_file growth on every nav revisit. Fix: `initialized` ref set BEFORE first await in initUploads, early-return on re-entry (singleton keeps it set across nav; page refresh recreates store → restores once) + regression test (double-init → restoreFromIDB once, queue.length 1). Re-review Approved. 368/368, tsc 0, build ok.
Cross-cutting confirmed by final review: end-to-end persist loop sound; budget accounting correct (increment/decrement/rebuild); ONE refresh path (no new token/refresh copy); path safety clean (no /DATA in any rendered string); global Blob override blast radius contained.
Minors ALL triaged defer-P3c (see per-task entries): T2 budget-total test gap + zero-byte design; T3 retryBatch-not-persisted (resume unaffected, cosmetic) + drop-path test gaps + empty-patch; T5 inert spy; T7 inert trampoline + inaccurate report note; T8 redundant strip + near-dup; T9 onReselect strip + mixed error+needs_file batch hides retry. Plus final-review new Minors (defer-P3c): reattach doesn't re-persist blob (2nd refresh → needs_file again); reselectDismissed misleading name.

## Log
Task 10: complete (commit 4c0e04f..291924d, review Approved). Deleted uploadListGroups.ts+test (zero refs confirmed). 367/367, tsc 0, build ok.
Task 9: complete (commit a7e5655..4c0e04f, review Approved; all Minor; reviewer reproduced 368/368+tsc0). UploadPanel needs_file→重选文件 (reattachFiles) + restore notice banner (dismiss client-only) + 4 i18n keys; error/needs_file branches mutually exclusive; zones/Dialog preserved. tsc 0, build ok, 368/368.
  MINORS for final: (a) onReselect relativePath not leading-slash-stripped (low risk, reattach byName fallback); (b) SPEC edge case — a batch mixing error + needs_file items shows only 重选文件, hides 重试, so errored items in that batch have only cancel (predicate needsFileCount>0 from my brief; consider P3c refinement).
Task 8: complete (commit 5868256..a7e5655, review Approved; all Minor). Files.vue onDrop async→readDroppedEntries (folder drag-drop), new onMounted→initUploads (resume in files view); existing wiring preserved. tsc 0, build ok, 368/368.
  MINOR for final: onDrop's leading-slash strip redundant (dropEntries already strips); onDrop/handleSelectedFiles near-duplicate (could share a commitSelectedFiles helper).
Task 7: complete (commit b13bb05..5868256, review Approved; all Minor). dropEntries.ts recursive webkitGetAsEntry reader, sync snapshot preserved, no media/hidden filter. 368/368, tsc 0.
  MINOR for final review: readAllEntries wraps recursive read() in Promise.resolve().then(read) — inert trampoline (mock is finite, no real overflow; harmless in prod since real readEntries is async). Consider reverting to plain read() to match brief + fix report's inaccurate "stack overflow" claim.
Task 6: complete (commit f26ccc2..b13bb05, review Approved, no issues). needsFileCount + needs_file→problem zone; isBatchSettled untouched. 364/364, tsc 0.
Task 5: complete (commit f83a80e..f26ccc2, review Approved; all Minor). reattachFiles matches needs_file by relativePath→fileName + size, precheck→conflict/pending, uses patch (persists). Test changed brief's toBeInstanceOf(Blob)→toBe(f) (jsdom File not instanceof node Blob from vitest.setup; stronger assertion). 363/363, tsc 0.
  MINOR for final review: inert vi.spyOn(store,'startUpload') in reattach test doesn't intercept internal call (Pinia setup-store limitation, same smell as Task 4) → auto-start branch unasserted. Drop spy or assert scheduler-run.
Task 4: complete (commits c24b675..f83a80e, review Approved after 1 fix). Added restoreQueue/resumePending/pruneOldItems/initUploads. Fix: implementer had reshaped resumePending to useUploadsStore().startUpload() for a spy → reverted to bare startUpload(), test now asserts observable uploading flag; dropped redundant cast. 360/360, tsc 0. NOTE: initUploads not yet wired to a mount (that's Task 8).
Task 3: complete (commit 397b9a7..c24b675, review Approved; all findings Minor). Surgical hooks: patch persist branch (volatile-skip), addFilesToQueue persistNewItem, dropPersisted at cancelItem/cancelBatch/clearDone/settleBatch-cleanup, patch exposed. 357/357, tsc 0.
  MINORS for final review: (a) retryBatch bypasses patch → status change not persisted; resume unaffected (restoreFromIDB forces pending for blob-backed) but restored row can briefly show stale progress/error until first tick (cosmetic, out-of-scope); (b) mixed volatile+non-volatile patch case & cancelBatch/clearDone/settleBatch drop paths verified by code-inspection only, no direct test; (c) patch(id,{}) empty-object would persist (theoretical, no call site).
Task 2: complete (commits d0db4f3..397b9a7, review Approved; faithful 1:1 port of persistBridge.js into explicit functions). Fix: added persistItemMeta + budget-freeing test coverage (Important coverage gap, TDD constraint). 352/352, tsc 0.
  MINORS for final review: (a) cumulative TOTAL_BLOB_BUDGET integration path not tested (budget.ts unit covers pure math); (b) zero-byte file can't be blob-persisted → always needs_file (inherited verbatim from Vue2, by design, not a defect).
Task 1: complete (commits 244258a..d0db4f3, review Approved after 1 fix). Fix: implementer added Base64 Blob workaround (production-costly); reverted to brief's direct store.put({id,blob}) + moved jsdom-Blob workaround to test env via vitest.setup.ts (globalThis.Blob=node Blob, wired setupFiles). 340/340, tsc 0. NOTE: stray uncommitted files src/main.ts + src/router/onAuthFail.* are parallel auth work — leave untouched, exclude from all P3b commits.
</content>
