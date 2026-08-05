# SP4-P3a Core Upload — SDD Progress Ledger

Plan: NimoOS-UI/docs/superpowers/plans/2026-07-03-vue3-migration-sp4-p3a-core-upload.md
Start: NimoOS-New-UI master @ 148093a
Shared pkg: NimoOS-Service sp3-shared-http

## Tasks
- [x] Task 1: shared file-domain upload REST + endpoint const
- [x] Task 2: pure helpers (types/clientId/budget/list-groups/visibility)
- [x] Task 3: tusClient port
- [x] Task 4: scheduler (callback-driven)
- [x] Task 5: conflict precheck + policy
- [x] Task 6: Pinia uploads store
- [x] Task 7: unloadGuard
- [x] Task 8: UploadPanel + status i18n
- [x] Task 9: Files.vue wiring + context-menu items
- [x] Task 10: build/deploy/verify

## Log
Task 1: complete (NimoOS-Service 0b1055d..5481ae8, review clean: spec ✅ + quality approved)
Task 2: complete (148093a..e690379, review clean: spec ✅ + quality approved, 289/289)
Task 3: complete (e690379..41744fd, review clean: spec ✅ + quality approved, 292/292)
  Minor (defer to final review): (1) tusClient uses `any` at tus-js-client interop boundary (onBeforeRequest req, err.originalResponse) — tus-js-client ships HttpRequest/DetailedError types; (2) test doesn't exercise onProgress/onSuccess/onError or repeated onAfterResponse (originates from brief's prescribed test).
Task 4: complete (41744fd..c78eb7c, review clean: spec ✅ + quality approved, 298/298)
  Minor (defer): scheduler `item.file as File|Blob` cast defeats null type guarantee (safe by claimNext contract, latent if it drifts).
  Note: humanize codes = no_space/protected/bad_name/expired/server/network (+ 'duplicate' for 409). Task 8 uploadErrorKey MUST map all 7.
Task 5: complete (c78eb7c..9fc5d54, review clean: spec ✅ + quality approved, 301/301)
Task 6: complete (9fc5d54..895c50c, review clean: spec ✅ + quality approved, 305/305)
  Minor (defer): (1) resolveConflict calls startUpload even on skip -> harmless extra reload; (2) getScheduler().run() has no .catch (safe by scheduler swallow-all invariant); (3) batchId per-call (documented, correct).
  ⚠️ resolved: protected check split('/')[0] would bypass on leading-slash relativePath, but Task9 producer (webkitRelativePath||name) never emits leading slash. Task9: defensively strip leading slash.
Task 7: complete (895c50c..b051d7f, review clean: spec ✅ + quality approved, 307/307)
Task 8: complete (b051d7f..7539faa, review clean: spec ✅ + quality approved, 315/315; reviewer re-ran 8/8)
  Minor (cosmetic): itemDir() suppresses display when toVirtualPath returns input unchanged (only if displayName==basename edge; errs toward under-display, not a /DATA leak).
Task 9: complete (7539faa..a3d01a0, review clean: spec ✅ + quality approved, 320/320)
  Minor (defer): toolbar upload chips reuse filesCtx* keys (naming); drop-leave 50ms debounce (may flicker); upload menu only in blank-area branch (by design, targets currentPath).

## Final whole-branch review (opus, 148093a..a3d01a0): READY TO MERGE
No Critical/Important. All 4 invariants hold (code↔i18n mapping, path safety both directions, single refresh path, protected guard both halves). YAGNI clean (no IDB leak).
Minor (defer to P3b): (a) dead exports store.hasActive/restoreNoticeCount (unused); (b) oversize banner fires on 0-byte files (canStoreBlob(0)=false); (c) P3b/c scaffolding (needs_file/restored/tusUploadUrl) unexercised by design; (d) prior minors (any casts, file cast, 50ms debounce, toolbar keys, skip extra reload) — all non-blocking.
Task 10: automated gate done — 320/320, vue-tsc 0, build ok, deployed /app/ (HTTP 200), bundle contains upload-tus/filesUploadOversize/filesCtxUploadFolder/webkitdirectory. Manual browser checklist handed to user (jsdom can't cover TUS/drag-drop/webkitdirectory/beforeunload).

## P3a COMPLETE — Ready to merge (opus). Awaiting user real-machine acceptance.
Coordinates: NimoOS-New-UI master @ a3d01a0 (8 commits e690379..a3d01a0). NimoOS-Service sp3-shared-http @ 5481ae8 (upload REST). Both local, no remote — user pushes GitHub.
Next: P3b (IDB persistence + refresh auto-resume + needs_file reattach).

## 真机 bug 修复 (d20cb82) — crypto.randomUUID 非安全上下文
症状:点上传选文件后无进度面板、不上传、刷新无。根因:uploads.ts:64 `crypto.randomUUID()` 在 push 前裸调,非安全上下文(http://<LAN-IP>/app/)下 undefined→抛错→addFilesToQueue reject 前不 push。Vue2 clientId.js 有 fallback(移植时丢了)。修:新增 upload/uuid.ts safeRandomUUID()(crypto.randomUUID 不可用→时间戳+random 降级),clientId.ts + uploads.ts 改用之。回归测试:randomUUID undefined 时仍入队。323/323, tsc 0, 部署 /app/ 200,fallback 码在 bundle。教训:移植边缘处理(非安全上下文/降级路径)易丢;jsdom 是安全上下文测不出。
