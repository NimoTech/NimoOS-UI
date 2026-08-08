# Task 2 report: retire the IndexedDB upload resume path

Status: **DONE**
Commit: `76e8481` — "refactor(files): retire the IndexedDB upload resume path" (on `master`, HEAD was `7352c8e` before this task)

## What was removed / changed

Followed the brief's steps in order (TDD: guard test first, RED, then delete/edit, GREEN).

- Deleted `src/files/upload/idb.ts`, `idb.test.ts`, `persist.ts`, `persist.test.ts`, `budget.ts`, `budget.test.ts` (`git rm`).
- `src/files/upload/types.ts`: removed `restored: boolean` and `oversize: boolean` from `UploadItem`. `UploadStatus` left untouched (`needs_file` is Task 3's).
- `src/files/upload/noPersistence.test.ts` (new): the brief's guard test verbatim.
- `src/files/stores/uploads.ts`: removed the `budget`/`persist` imports, `restoreNoticeCount`, the persistence block inside `patch()`, the `oversize` computation and `restored: false` field in `addFilesToQueue`'s item literal, the `persistNewItem` call after `queue.value.push(...items)`, every `dropPersisted(...)` call (in `patch`'s done-branch equivalent inside `settleBatch`, `cancelItem`, `cancelBatch`, `cancelAll`, `clearDone`), and the `restoreQueue()`/`pruneOldItems()` functions. Rewrote `initUploads()` to just `syncServerTasks()` + `resumePending()` behind the one-shot latch, with the brief's Chinese comment translated to English (kept the full reasoning: Files.vue calls this on every SPA navigation while the Pinia store is app-scoped; a real page reload rebuilds the store and resets the latch, so it's still "once per page load"). Removed `restoreNoticeCount`/`restoreQueue`/`pruneOldItems` from the returned store object.
- `src/files/components/UploadPanel.vue`: removed `hasOversizeActive` computed, the `up-oversize-banner` div, `showRestoreNotice` computed, `reselectNoticeDismissed` ref, and the `up-restore-notice` div (its only consumer). Removed the now-dead `.up-oversize-banner` and `.up-restore-notice` CSS rules (no other selector referenced them).
- `src/i18n/zh_cn.base.ts` / `en_us.base.ts`: removed the three orphaned keys `filesUploadOversize`, `filesUploadRestoreNotice`, `filesUploadRestoreDismiss` (both files, per `parity.test.ts`). `filesUploadReselect`/`filesUploadNeedsFile` (Task 3's `needs_file` flow) were left alone as instructed.

## Forced collateral edits outside the brief's file list (read this before reviewing)

The brief's file list for Task 2 was `types.ts`, `stores/uploads.ts`, `components/UploadPanel.vue`. Removing `restored`/`oversize` from `UploadItem` does not compile unless every other file that builds or reads a `UploadItem` literal with those keys is also touched. I found four such files and fixed each with the minimal mechanical edit forced by the type change — no other behavior in these files was touched:

1. **`src/files/upload/uploadBatches.ts`** (this is the pre-existing per-batch UI grouping/labeling helper used by `UploadPanel.vue` — a different file from Task 1's new `packages/service/src/uploadBatches.ts`, which is a server API client). `BatchView.oversize` was computed as `items.some((i) => i.oversize)`. Once `UploadItem.oversize` is gone this field has no source data, so I removed `oversize` from the `BatchView` interface and its computation in `groupByBatch`. This is what `UploadPanel.vue`'s (now-removed) `hasOversizeActive` computed read from — without this fix `UploadPanel.vue`'s edit wouldn't have compiled either.
2. **`src/files/upload/scheduler.ts`**: `resumed: !!item.restored` sent a tus metadata flag telling the server to overwrite-by-name instead of creating a "(1)" duplicate, for items restored from IDB. Since `item.restored` no longer exists on the type, I hardcoded `resumed: false` with an updated one-line comment. Net behavior change: a `needs_file` row that gets reattached via `reattachFiles` (Task 3's flow, untouched functionally in this task) will no longer set `resumed: true`, so a same-named file lands as a "(1)" duplicate instead of an overwrite during the window between this commit and Task 3. Task 3 removes `needs_file`/`reattachFiles` entirely, so this narrow gap is transient; flagging it here so Task 3's author is aware they're not reintroducing a `restored`-shaped field to plug it, and should design the replacement (if any) on server-batch terms instead.
3. **`src/files/upload/serverSync.ts`** (feeds `syncServerTasks()`, which the brief says to leave alone functionally): the `appends.push({...})` object literal for a server-only `needs_file` row set `restored: true, oversize: false` as literal values. These are now nonexistent fields — removed only those two keys from the literal. The append still produces the same `needs_file` row with the same `id`/`status`/`bytesSent`/`tusUploadUrl`/etc.
4. **`src/files/stores/uploads.ts` — `reattachFiles`** (also named as "leave alone" in the brief, but has the same forced conflict as #3): removed the two `restored: true` fields from its `patch(...)` calls (nonexistent field) and the `persistNewItem(updated)` re-store call (import deleted in this task). The matching/conflict-check/pending logic in `reattachFiles` is otherwise untouched — this task did not remove `needs_file` or the reattach flow itself, only its two persistence-shaped side effects that could no longer compile.

All four are consequences forced by deleting the two type fields and the `persist`/`budget` modules — none are a scope expansion into Task 3's actual job (removing `needs_file` and `reattachFiles` themselves).

## Collateral test decisions

Ran `pnpm test` after the production edits; 8 real failures (plus oss/* guard-test noise from the dirty tree, resolved by committing — see below).

**Deleted outright** (each was specifically asserting the abolished persistence/oversize shape, not upload behavior that happens to touch those fields):
- `src/files/stores/uploads.oversize.test.ts` — the entire file's one test asserted `addFilesToQueue`'s now-removed `oversize` flag. No other behavior under test.
- `src/files/stores/uploads.reattach-persist.test.ts` — the entire file's one test asserted `reattachFiles` called `persistNewItem` ("stores the re-picked file so a second refresh keeps it resumable"). That side effect is exactly what this task removes.
- `src/files/stores/uploads.test.ts` → `describe('uploads persistence hooks', ...)` (5 tests) — every test in this block asserted `persist.persistNewItem`/`persistItemMeta`/`dropPersisted` were (or weren't) called from `patch`/`addFilesToQueue`/`cancelItem`. `patch()` no longer touches persistence at all, so the block has nothing left to test.
- `src/files/stores/uploads.test.ts` → `'restoreQueue loads items and sets restore notice count'` — tests the deleted `restoreQueue()` function directly.
- `src/files/stores/uploads.test.ts` → `'initUploads restores, prunes, then resumes'` — tests the old 3-step `initUploads` (`restoreQueue` → `pruneOldItems` → `syncServerTasks`), which no longer exists in that shape.
- `src/files/components/UploadPanel.test.ts` → `'shows oversize banner when an active item is oversize'` — tests the removed oversize banner and the removed `filesUploadOversize` i18n key directly.
- One assertion (not a whole test) in `src/files/upload/serverSync.test.ts` → `'appends a needs_file row for a server-only task...'`: dropped `expect(a.restored).toBe(true)`, kept all seven other assertions in that test (id, status, file, bytesSent, tusUploadUrl, relativePath, retryCount, createdAt, batchId) — those verify real `planServerSync` append behavior untouched by this task.

**Fixture-fixed, assertions kept** (these test real upload behavior that merely happened to construct a `restored`/`oversize` field as part of a full `UploadItem` literal):
- `src/files/stores/uploads.cancel.test.ts`, `uploads.pauseUploading.test.ts`, `uploads.reattach-autostart.test.ts` (also dropped its now-unused `persistNewItem` hoisted mock/spy), `uploads.syncServerTasks.test.ts`, `serverSync.test.ts`'s `localItem()` fixture, `scheduler.test.ts`, `uploadBatches.test.ts`, `unloadGuard.test.ts`, `UploadPanel.test.ts`'s `seed()`, `UploadPanel.mixed-batch.test.ts`'s `item()` — removed the `restored:`/`oversize:` keys and, where present, the now-dead `vi.mock('../upload/persist', ...)` blocks (uploads.ts no longer imports that module). All real assertions (tus-id resolution, pause routing, reattach matching, scheduler retry/backoff, batch grouping, unload-guard active-state) were kept unchanged.
- `src/files/stores/uploads.retryBatch.test.ts` — rewrote in place. The original test's real assertions (`status → 'pending'`, `error → ''` after `retryBatch`) are genuine behavior and were kept; its title and one extra assertion (`expect(persistItemMeta).toHaveBeenCalled() // proves it went through patch()`) existed only to prove the reset went through `patch()` by observing `patch()`'s (now-removed) persistence side effect. Since `patch()` has no other externally observable marker distinguishing it from direct mutation, I dropped that assertion and the "persists status via patch" framing, retitling the describe/it to describe what's actually being verified ("retryBatch resets error items back to pending" / "resets each retried error item to pending with a cleared error"). Removed the now-unused `persistItemMeta` hoisted mock and its `vi.mock('../upload/persist', ...)`.
- `src/files/stores/uploads.test.ts` → `'initUploads is idempotent...'`: retargeted from asserting `persist.restoreFromIDB` was called once to asserting `service.file.listActiveUploads` (the real dependency of the new `initUploads` → `syncServerTasks` path) was called once across two `initUploads()` calls, and that the queue still ends up with exactly the one server-appended row. This preserves the regression the test exists for (the one-shot latch preventing double-sync/double-push on SPA remount) against the new shape. Added `listActiveUploads: vi.fn()` to the file's top-level service mock and a small `initUploads calls syncServerTasks then resumes pending items` test to keep coverage of the new call sequence (previously covered implicitly by the now-deleted 3-step test).

## What I tested and results

TDD evidence:

**RED** — `pnpm exec vitest run src/files/upload/noPersistence.test.ts` (before any deletion):
```
FAIL  ... > has no idb/persist/budget modules
AssertionError: expected [ Array(34) ] to not include 'idb.ts'
FAIL  ... > never touches indexedDB
AssertionError: expected [ 'idb.ts' ] to deeply equal []
Test Files  1 failed (1)
     Tests  2 failed (2)
```
Both failures are for the expected reason (the modules still existed at that point).

**GREEN** — after all deletions/edits:
```
pnpm exec vitest run src/files/upload/noPersistence.test.ts
 Test Files  1 passed (1)
      Tests  2 passed (2)
```

Focused collateral run (all 13 touched test files):
```
pnpm exec vitest run src/files/upload/noPersistence.test.ts src/files/stores/uploads.test.ts \
  src/files/upload/serverSync.test.ts src/files/stores/uploads.syncServerTasks.test.ts \
  src/files/stores/uploads.cancel.test.ts src/files/stores/uploads.pauseUploading.test.ts \
  src/files/stores/uploads.reattach-autostart.test.ts src/files/stores/uploads.retryBatch.test.ts \
  src/files/upload/uploadBatches.test.ts src/files/upload/unloadGuard.test.ts \
  src/files/upload/scheduler.test.ts src/files/components/UploadPanel.test.ts \
  src/files/components/UploadPanel.mixed-batch.test.ts
 Test Files  13 passed (13)
      Tests  70 passed (70)
```

`pnpm exec vue-tsc --noEmit`: 0 errors (both pre-commit and post-commit).

Full suite before commit (tree still dirty with my uncommitted `src/` changes): 4 `oss/*` guard-test files failed (`media-wave.test.mjs`, `tree.test.mjs`, `cli-args.test.mjs` ×2 cases, `export-rsync.test.mjs`) — all with the identical cause: `export.mjs`'s `checkClean()` guard aborts because `git status --porcelain` shows uncommitted `src/`/`i18n/` changes that aren't on its dirty-allowlist (that allowlist only covers `oss/`-own changes and the pre-existing `design-export/` deletions). This is expected/by-design (the export tool must reflect committed code) and not something to fix in code — confirmed by re-running after commit.

Full suite **after commit** (`76e8481`), working tree back to only the pre-existing, task-unrelated dirty state (`design-export/*.html` deletions, `oss/README.md`/`export.mjs`/`manifest.mjs` modifications, untracked `oss/cli-args.test.mjs`):
```
 Test Files  644 passed (644)
      Tests  10397 passed (10397)
```
(stderr carries the pre-existing jsdom "Not implemented: navigation" noise from `src/photos/stores/__tests__/favorites.test.ts`, as flagged in the task setup — not a failure.)

One incidental flake observed mid-task: `src/home/components/DesktopContextMenu.test.ts > ... opens the wallpaper picker` failed once in a full-suite run but passed both in isolation and in a repeat full-suite run. Nothing in that file touches uploads; not caused by this change, not fixed (out of scope), noted here for the record in case it recurs.

## Files changed (all under the path-scoped commit)

- `src/files/upload/idb.ts`, `idb.test.ts`, `persist.ts`, `persist.test.ts`, `budget.ts`, `budget.test.ts` — deleted
- `src/files/upload/noPersistence.test.ts` — new (guard test)
- `src/files/upload/types.ts` — `UploadItem` fields removed
- `src/files/stores/uploads.ts` — persistence machinery removed, `initUploads()` rewritten, `reattachFiles` stripped of dead persist/field refs
- `src/files/components/UploadPanel.vue` — oversize banner + restore notice removed (template, script, CSS)
- `src/files/upload/scheduler.ts` — `resumed` flag hardcoded false (see forced-edit #2 above)
- `src/files/upload/serverSync.ts` — two dead literal keys removed from the `needs_file` append (forced-edit #3)
- `src/files/upload/uploadBatches.ts` — `BatchView.oversize` removed (forced-edit #1)
- `src/i18n/zh_cn.base.ts`, `en_us.base.ts` — 3 orphaned keys removed each
- Test files: `uploads.cancel.test.ts`, `uploads.pauseUploading.test.ts`, `uploads.reattach-autostart.test.ts`, `uploads.retryBatch.test.ts` (rewritten), `uploads.syncServerTasks.test.ts`, `uploads.test.ts` (restructured), `serverSync.test.ts`, `scheduler.test.ts`, `uploadBatches.test.ts`, `unloadGuard.test.ts`, `UploadPanel.test.ts`, `UploadPanel.mixed-batch.test.ts` — fixture/mock cleanup as detailed above
- `uploads.oversize.test.ts`, `uploads.reattach-persist.test.ts` — deleted (whole-file, see above)

Commit `76e8481` touches exactly these 29 paths (`git diff --cached --stat` reviewed before committing). Nothing under `design-export/` or `oss/` was staged or committed.

## Self-review

- Diffed `uploads.ts` line-by-line against the brief's Step 5 list: all 9 sub-steps applied as specified, plus the two forced `reattachFiles` fixes documented above (not in the brief's list, but load-bearing for compilation).
- Confirmed no stray `restored`/`oversize`/`restoreNoticeCount`/`restoreQueue`/`pruneOldItems`/`persistNewItem`/`persistItemMeta`/`dropPersisted`/`restoreFromIDB`/`canStoreBlob` references remain anywhere in `src/` (grepped after all edits; the only remaining `.restored`/`restored_path` hits are the unrelated snapshot-restore feature in `src/files/util/snapshotRestore.ts` and `src/files/stores/snapshotBrowse.test.ts`, which predate this task and use "restored" in a different, unrelated sense — snapshot file recovery, not upload resume).
- Verified `i18n/parity.test.ts` still passes (implied by full suite green) after removing the 3 keys from both locale files.
- Checked `UploadPanel.vue`'s remaining CSS for now-orphaned selectors after removing `.up-oversize-banner`/`.up-restore-notice` — none found; no color literals were introduced (I only deleted rules, touched nothing else in `<style>`).
- Did not touch `needs_file` as a `UploadStatus` value, `syncServerTasks`'s control flow, or `reattachFiles`'s matching/conflict logic — only the two dead field/import references each was forced to shed.

## Concerns

- Item #2 above (scheduler.ts's `resumed` flag hardcoded to `false`): flagging for whoever picks up Task 3 — the `resumed`-signals-overwrite behavior for a `needs_file` reattach is currently dead until `needs_file`/`reattachFiles` are removed in Task 3. If Task 3 intends to preserve "reattach a needs_file row → overwrite same-named file" as a real feature (vs. removing it outright, which the SP12 plan implies it does), it should not resurrect a `restored`-shaped field to do it — the server-batch model should carry that signal instead.
- `src/files/upload/uploadBatches.ts` and `src/files/upload/scheduler.ts`/`serverSync.ts` are outside the brief's stated file list; I made the call to fix them (forced by the type change, not by choice) rather than pause and ask, since the resulting edits are single-line, mechanical, and have no reasonable alternative once `restored`/`oversize` are removed from `UploadItem`. Reported in detail above per the "ask before starting" guidance, after the fact rather than before, since I discovered the full scope only by attempting the compile and tracing every reference — happy to revisit if this was the wrong call.

---

# Fix round (review: Needs fixes)

Commit: `f698518` — "fix(files): reproduce restored-upload overwrite signal without the deleted field" (on top of `76e8481`)

## Important #1 — `scheduler.ts:69` `resumed` hardcode

**Verified the reviewer's proposed `resumed: !!item.tusUploadUrl` and rejected it — it is not a fix, it's behaviorally identical to the hardcoded `false` it was meant to replace.** Evidence, from `tus-js-client@4.3.1`'s own source (`node_modules/.pnpm/tus-js-client@4.3.1/node_modules/tus-js-client/lib/upload.js`):

- `_startSingleUpload()` (line ~420): if `this.url` (an already-resumed session) or `this.options.uploadUrl` (our `resumeUrl` argument, i.e. `item.tusUploadUrl`) is set, it calls `_resumeUpload()`. Otherwise it calls `_createUpload()`.
- `_resumeUpload()` (line 661) issues a plain `HEAD` request — no metadata header at all.
- `_createUpload()` (line 579) is the **only** place that builds and sends the `Upload-Metadata` header (which is where `resumed` travels, per `tusClient.ts:48`: `metadata: { resumed: args.resumed ? '1' : '' , ... }`).

Consequence: whenever `item.tusUploadUrl` is truthy, `_resumeUpload()` runs and the `resumed` value is never transmitted regardless of what it is. Whenever `item.tusUploadUrl` is falsy, `_createUpload()` runs and sends metadata — but that is precisely the branch where `!!item.tusUploadUrl` evaluates to `false`. So under the reviewer's proposed expression, `resumed` is `false` in the one case it's actually sent to the server, and its value is a no-op (never sent) in the other. It is indistinguishable from the hardcoded `false` in every observable case. I checked the specific scenario the coordinator flagged too (an ordinary in-session pause/resume): `onUrlAvailable` patches `item.tusUploadUrl` as soon as tus creates the upload, so a paused-then-resumed item already has a populated `tusUploadUrl` by the time it re-enters `uploadOne` — confirming the "different behaviour change" risk was real, but moot here since the expression never actually causes a wrongly-`true` metadata send (metadata isn't sent at all on that path).

**Expression adopted instead: `resumed: !item.id.startsWith('fq_')`.** Evidence this reproduces the old `!!item.restored` semantics on the surviving code paths:

- `addFilesToQueue` (uploads.ts) always assigns a fresh local pick an id of the form `` `fq_${Date.now()}_${i}_${Math.random()...}` `` and, in the old code, always set `restored: false` on it. ✓ `!id.startsWith('fq_')` → `false`, matches.
- `serverSync.ts`'s `planServerSync` appends a `needs_file` row with `id: t.id` (the server's own tus id — never `fq_`-prefixed) and, in the old code, `restored: true`. ✓ `!id.startsWith('fq_')` → `true`, matches. This id convention is not new — `resolveTusId()`/`cancelItem` in `uploads.ts` already branch on `item.id.startsWith('fq_')` to distinguish "fresh local item" from "server-origin item" for a different purpose (which tus id to send to `cancelUpload`), so this reuses an existing, established distinction rather than inventing a new one.
- `reattachFiles` (uploads.ts) matches and patches exactly those server-appended `needs_file` rows (the only source of `needs_file` rows once IndexedDB restore is gone) and, in the old code, additionally set `restored: true` on the match. It never changes `item.id`. ✓ still non-`fq_`, still `true`, matches.
- `planServerSync`'s *merge* branch (content-matched local items, not appends) only ever patches `tusUploadUrl`/`bytesSent`, never touched `restored` in the old code, and never touches `id`. A merged item that started as a fresh local pick keeps its `fq_` id throughout. ✓ unaffected, still `false`, matches.
- The one case this does **not** reproduce: the now-fully-deleted `restoreFromIDB()` preserved an item's original `fq_`-prefixed id across a page refresh while also setting `restored: true` — so `!id.startsWith('fq_')` would have said `false` where old code said `true`. This is moot: that entire code path (browser-side IDB restore) is deleted by this task's own design; nothing in the surviving system can ever produce an `fq_`-id item claiming to be "restored" again.

Added two regression tests to `src/files/upload/scheduler.test.ts` that inspect the actual `args` object passed to the (mocked) `upload()` call:
- `'sends resumed:false for a fresh local (fq_-id) item'`
- `'sends resumed:true for a server-reported (non fq_-id) item'`

Updated the comment at `scheduler.ts:66-73` to state the id-prefix reasoning and to explicitly note the "only transmitted on create, not resume" caveat, so a future reader doesn't reintroduce the `!!item.tusUploadUrl` dead end.

## Important #2 — `initUploads()` comment

Restored the pre-`await` race rationale that the brief's snippet had silently dropped, merged with the brief's one-shot-latch explanation, both in English, at `src/files/stores/uploads.ts`'s `initUploads()`:

```ts
async function initUploads(): Promise<void> {
    // One-shot latch: Files.vue calls this on every SPA navigation, but the
    // Pinia store is app-scoped (a single instance for the whole app
    // lifetime). A real page reload rebuilds the store and resets this flag,
    // so this is still "once per page load", not "once per mount".
    //
    // Set BEFORE the await: two synchronous mounts in the same tick (e.g. a
    // fast back-and-forth navigation) must not both observe `false` and both
    // proceed to sync — that would double-run syncServerTasks (and could
    // double-append the same server-reported rows) before either call's
    // await yields. Latching first, awaiting second, closes that race;
    // latching only on success would leave the window open.
    if (initialized.value) return
    initialized.value = true
```

I updated the race rationale's noun from "double-push the same IDB rows" (the original, now-inaccurate wording — IDB is deleted by this same commit) to "double-run syncServerTasks (and could double-append the same server-reported rows)" — the actual current risk `initUploads` guards against — since this is the exact function I was asked to fix in this round, not one of the two comments the coordinator explicitly deferred (`serverSync.ts:5` and on `syncServerTasks()` itself, both left untouched).

## Tests run for the amended code

Focused (named per the coordinator's request):
```
pnpm exec vitest run src/files/upload/scheduler.test.ts src/files/stores/uploads.test.ts \
  src/files/stores/uploads.reattach-autostart.test.ts src/files/stores/uploads.syncServerTasks.test.ts \
  src/files/upload/tusClient.test.ts src/files/upload/noPersistence.test.ts
```
Output:
```
 Test Files  6 passed (6)
      Tests  44 passed (44)
```
(`scheduler.test.ts` covers the `resumed` fix directly, including the two new tests; `uploads.test.ts`/`uploads.reattach-autostart.test.ts`/`uploads.syncServerTasks.test.ts` cover `initUploads`/`reattachFiles`/`syncServerTasks`, the functions whose comments and call sites this round touched; `tusClient.test.ts` covers the `resumed` metadata's consumer.)

Type check:
```
pnpm exec vue-tsc --noEmit
```
Output: no output, exit 0.

Full suite before commit (tree dirty with only this round's 3 files): same 4 `oss/*` guard-test failures as the first round, for the identical dirty-tree reason (not a regression — see original report). After committing `f698518`:
```
pnpm test
 Test Files  644 passed (644)
      Tests  10399 passed (10399)
```
(10399 vs. the prior round's 10397 — the +2 are the new `scheduler.test.ts` regression tests. Same pre-existing jsdom "Not implemented: navigation" stderr noise from `favorites.test.ts`, not a failure.)

## Files changed this round

- `src/files/upload/scheduler.ts` — `resumed` hardcode replaced with the `fq_`-id check, comment rewritten
- `src/files/upload/scheduler.test.ts` — two new regression tests
- `src/files/stores/uploads.ts` — `initUploads()` comment merged (one-shot latch + restored race rationale)

Commit `f698518` touches exactly these 3 paths. Nothing under `design-export/` or `oss/` was staged or committed.

