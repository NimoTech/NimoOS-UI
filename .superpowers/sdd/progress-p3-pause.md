# SP4-P3 上传暂停/继续 — SDD Progress Ledger

Plan: NimoOS-UI/docs/superpowers/plans/2026-07-04-vue3-migration-sp4-p3-upload-pause.md
Spec: NimoOS-UI/docs/superpowers/specs/2026-07-04-vue3-migration-sp4-p3-upload-pause-design.md
Start: NimoOS-New-UI master @ ab9b64a (P3b done)
Shared pkg: NimoOS-Service — NOT modified this phase.
NOTE: working tree has parallel auth WIP (src/main.ts + src/router/onAuthFail.*) — never `git add -A`; add only named files.

## Tasks
- [x] Task 1: types 'paused' + tusClient pause() handle
- [x] Task 2: scheduler pause(id) + isPause→paused
- [x] Task 3: store pauseItem/resumeItem/pauseBatch/resumeBatch/pauseAll/resumeAll
- [x] Task 4: persist restoreFromIDB keeps paused
- [x] Task 5: uploadBatches pausedCount + paused→active zone
- [x] Task 6: UploadPanel global bar + per-batch pause/resume + i18n
- [x] Task 7: UploadPanel expand → per-file pause/resume/cancel
- [x] Task 8: build/deploy/verify + ledger

## ✅ FULLY COMPLETE + USER-ACCEPTED (2026-07-04). FINAL HEAD = 6159be7 (start ab9b64a, 13 commits: 8 pause tasks + 5 acceptance follow-ups). 387/387, tsc 0, build ok, deployed /app/. User tested pause/resume/delete — good. Ready for next part.

## POST-ACCEPTANCE FOLLOW-UPS (all user-requested, all deployed):
- d2be9f8: 取消→删除 relabel (filesUploadCancel value '取消'→'删除') + `cancelAll()` store method + 顶部「删除全部」button + TDD test.
- 7f4c82f: enlarge panel (360→460px, 60→74vh, bigger fonts) + red delete + **fix overlap** — OperationStatusBar shared the exact same corner+z-index (right:24 bottom:24 z60) as UploadPanel → moved op-bar to bottom-LEFT, upload panel z70.
- 466df2e: delete buttons actually red — CSS specificity bug (`.up-del`/`.up-delete-all` single-class lost to later `.up-link-btn` accent) → compound selectors `.up-link-btn.up-del`.
- b8fec80: delete-confirm AlertDialog (per-file/batch/删除全部 all route through one confirm; mirrors file-delete).
- 6159be7: **fix delete-confirm not deleting** — reka-ui AlertDialogAction fires update:open(false) on the SAME click as confirm, often FIRST; original code nulled the pending action in @update:open → confirm found nothing → closed but didn't delete. Fix: @update:open only toggles visibility, confirmDelete captures+runs the closure (order-independent). **LESSON: reka-ui close/confirm event-ordering races (like P2a ContextMenu) only surface on real machine, not jsdom — never clear the payload a confirm handler needs in the close/update:open handler.**

## COMPLETE + DEPLOYED (2026-07-04). New-UI master HEAD = 78cec39 (start ab9b64a, 8 commits). Shared pkg NOT touched. /app/ HTTP 200, pause i18n in bundle, no debug residue. Full suite 386/386, tsc 0, build ok.

## FINAL whole-branch review (opus, ab9b64a..92a00b7): "With fixes" → 1 Important fixed.
IMPORTANT (fixed, 78cec39): cancel-after-pause left orphaned server staging — cancelItem/cancelBatch called scheduler.abort(id) which no-ops for paused items (no active handle) → no tus DELETE. Fix: on cancel, if item has tusUploadUrl, also fire service.file.cancelUpload(tusIdFromUrl(url)) (shared pkg method, no pkg change); mirrors Vue2. User chose "fix now".
MINOR also fixed (78cec39, user opted in): pause click lost during retry-backoff/401-refresh gap — scheduler.pause(id) fallback patches paused when no active handle + uploadOne loop-top guard `if(item.status==='paused'){active.delete;return}` stops the retry loop re-uploading. Re-review Approved (386/386).
Cross-cutting confirmed by final review: pause=abort(false) distinct from cancel=abort(true) DELETE; resume reuses P3b resumeUrl/offset (no restart, no double-upload); claimNext atomic (no double-claim); refresh keeps paused + non-paused auto-resumes; path-safe (per-file rows basename only); ONE refresh path (401 via shared refresh unchanged).
Minors DEFERRED: (a) scheduler.ts pause() comment says "abort" — reviewer deemed accurate (does call abort(false)), no action; (b) mixed paused+error batch → per-batch Resume button hidden (batch in problem zone), but global 全部继续 still resumes them — minor UX edge.

## Manual browser checklist handed to user (jsdom can't cover):
1. Single-file upload → 暂停 → stops, progress frozen, NO server DELETE; 继续 → resumes from offset (not 0).
2. Folder batch → 批级 暂停/继续.
3. Expand folder batch (▸) → per-file 暂停/继续/取消.
4. Top 全部暂停/全部继续.
5. Pause one → refresh → still paused (not auto-resumed); non-paused ones auto-resume.
6. Pause a queued (not-yet-started) item.
7. Pause then Cancel → server staging cleaned (cancelUpload fired).

## Log
Task 7: complete (258607a..92a00b7, review Approved no issues; reviewer reran tsc0/build/382 + confirmed path safety). UploadPanel multi-batch expand ▸/▾ → per-file rows (basename only, never /DATA) with pauseItem/resumeItem/cancelItem; single-file batches no toggle. tsc 0, build ok, 382/382.
  PROCESS NOTE: task-7-brief.md was stale (held P3b dropEntries content) due to a shell-cwd error leaving task-brief unrun + task-number collision (both plans write task-7-brief.md); implementer used explicit dispatch prompt (correct), brief regenerated before review. Lesson: verify brief CONTENT (not just existence) after generating, esp. on task-number collisions.
Task 6: complete (c6fac2f..258607a, review Approved no issues; reviewer reran tsc0/build/382). UploadPanel global 全部暂停/继续 bar + per-batch 暂停/继续 (batchRunning=activeCount>0; batchPaused=pausedCount>0&&activeCount===0) + 已暂停 label + 5 i18n keys. Additive, existing behavior preserved. tsc 0, build ok, 382/382.
Task 5: complete (806b000..c6fac2f, review Approved no issues). pausedCount + paused→active zone (problem>active>done precedence kept); isBatchSettled untouched. 382/382, tsc 0.
Task 4: complete (9fd7b60..806b000, review Approved no issues). restoreFromIDB keeps paused (status='paused' when persisted paused, else pending); resumedCount excludes paused. 380/380, tsc 0.
Task 3: complete (90e67c7..9fd7b60, review Approved; reviewer reran 379/379). 6 store actions; resumeBatch/resumeAll call startUpload once (not per-item); test uses observable uploading flag not spy. 379/379, tsc 0.
  MINOR for final: no direct test for pauseItem-on-uploading→scheduler.pause (brief flagged optional; covered by Task 2).
Task 2: complete (826ffd4..90e67c7, review Approved; reviewer reran 375/375). scheduler pause(id) mirrors abort(id); isPause→patch paused (no error/retry, keeps progress/offset/url). 375/375, tsc 0.
  MINOR for final: scheduler.ts:159 pause() comment copy-paste says "abort" (should say "pause") — doc typo only.
Task 1: complete (ab9b64a..826ffd4, review Approved no issues, reviewer reran 4/4). types 'paused' + tusClient onStart handle pause() = abort(false) no DELETE + isPause err (distinct from abort/isAbort). 372/372, tsc 0.
</content>
