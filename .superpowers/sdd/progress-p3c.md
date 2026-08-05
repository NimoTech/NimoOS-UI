# SP4-P3c — server-task sync + upload cleanup — SDD Progress Ledger

Plan: NimoOS-UI/docs/superpowers/plans/2026-07-04-vue3-migration-sp4-p3c-server-sync-cleanup.md
Base: NimoOS-New-UI master@6159be7

## Tasks
- [x] Task 1: serverSync.ts (contentKey + planServerSync)
- [x] Task 2: uploads.syncServerTasks() + wire into initUploads
- [x] Task 3: resolveTusId cancel fallback
- [x] Task 4: i18n zh_cn audit
- [x] Task 5: mixed-batch problem-zone buttons
- [x] Task 6: retryBatch via patch
- [x] Task 7: 0-byte oversize fix
- [x] Task 8: commitSelectedFiles DRY + onReselect slash strip
- [x] Task 9: reattach re-persist blob (OPTIONAL — pause for user decision)
- [x] Task 10: cleanup cluster (trampoline/tus any/rename/comment)
- [x] Task 11: test coverage backfill
- [x] Task 12: verify + deploy + ledger + acceptance

## Minor findings (roll up to final review)

## Log
Task 1: complete (commit 2232ec3, review clean spec+quality). 394 passing.
Task 2: complete (commit 47f79c8, review clean spec+quality). 397 passing, tsc clean.
Task 3: complete (commit b218e19, review clean; renamed 3 pre-existing test fixture ids to fq_ — verified legit, fq_ is code-enforced invariant). 404 passing, tsc clean.
Task 4: complete (commit d01fb9a, review clean). i18n audit passed + fixed 1 real leak (aria-label="close" -> filesUploadClose). tsc clean.
Task 5: complete (commit 8c66360, review clean). Independent reselect/retry/resume in problem zone. 408 passing, tsc clean.
Task 6: complete (commit 272135d, review clean; scheduler no-op mock verified load-bearing for the assertion). 409 passing, tsc clean.
Task 7: complete (commit e9a5a46, review clean; canStoreBlob(0)=false confirmed real bug). 410 passing, tsc clean.
Task 8: complete (commit 9933702, review clean; pure-helper route toSelectedFiles). 415 passing, tsc clean.
MINOR (roll up to final): no dedicated regression test for onReselect leading-slash strip (UploadPanel.test.ts does not cover reattach/onReselect flow — pre-existing gap).
Task 9: complete (commit eb30770, review clean; user-approved behavior change). reattach re-persists blob. 417 passing, tsc clean.
Task 10: complete (commits 0da6b2e + 3f6eb61, review clean). trampoline revert (+test-mock fix), tus HttpRequest/DetailedError types, reselectNoticeDismissed rename; item4 scheduler comment already correct. 417 passing, tsc 0.
Task 11: complete (commit 59dc605, review clean). +5 tests: budget cumulative, drop hidden/media, reattach auto-start, pause-uploading. 422 passing, tsc 0.

## Final whole-branch review (opus, 6159be7..59dc605): Ready to merge = YES
- All 4 cross-task risks clean (init ordering race-safe; resolveTusId consistent 3 sites; content-key dedup no dup/clobber; problem-zone buttons + empty-batchId ok).
- Binding constraints upheld: shared pkg untouched, one refresh path, dual path-safety, server appends not IDB-persisted, no Vue2 deletion.
- Suite 422/422, tsc 0, build ok.

## Minor findings roll-up (deferred, non-blocking)
- No regression test for onReselect leading-slash strip (pre-existing UploadPanel test gap).
- Low-sev: empty-batchId server tasks (legacy/foreign) collapse into one visual "files" batch in groupByBatch; cancelBatch('') deletes all at once. Pre-existing groupByBatch semantic, unreachable for New-UI uploads (always send real batch_id). Awareness only.
Task 12: complete. Deployed /app/ (HTTP 200, sync code in bundle). Suite 422/422, tsc 0, build ok. Awaiting user real-device acceptance (incl cross-device).
