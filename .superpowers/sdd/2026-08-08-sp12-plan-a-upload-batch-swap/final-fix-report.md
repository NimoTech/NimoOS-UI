# SP12 Plan A — final whole-branch fix wave report

Base: `master` @ `6468a54`. All work done directly on `master` (main worktree, no worktree/branch created), per instructions.

Commits produced (5, each with an explicit pathspec):

1. `853909b` — fix(files): fix illegible torn-upload badge contrast in both themes
2. `e32e01f` — test(files): cover the badge-to-dialog open-batch forwarding chain
3. `fbfafe8` — fix(files): align activeBatchIds' pending guard with hasActiveUploads
4. `39fe9cf` — docs(files): correct stale and false comments left by the upload rewrite
5. `d9ff7c2` — docs(plan): fix the unreachable step in the real-machine acceptance script

---

## Item 1 — MERGE GATE: invisible badge glyph

**Files:** `src/files/components/FileTile.vue`, `src/files/components/FileRow.vue`

**Root cause confirmed:** `background: var(--remove-bg); color: var(--remove-fg)`. Both tokens are near-identical reddish hues in both theme blocks — `--remove-bg` is a *solid-fill* token meant to pair with white text (see `.grid-item .remove` in `theme.css`, which pairs it with literal `#fff`), not with `--remove-fg`.

**Precedent adopted:** `src/apps/views/AppSettingsPage.vue` (lines ~188-193), `.set-conflict`, already hit and fixed this exact mistake: `background: var(--drop-bad); color: var(--remove-fg); border: 1px solid var(--remove-fg)`.

**Contrast figures** (relative-luminance / WCAG contrast ratio, composited against `--bg` as the representative backdrop, since the badge is absolutely positioned over the tile/row which itself sits on the page background):

| Theme | Before (`--remove-bg` bg / `--remove-fg` text) | After (`--drop-bad` bg / `--remove-fg` text+border) |
|---|---|---|
| Dark | `#ff708a` vs `#ff8a8a` → **≈1.16:1** | `rgba(255,80,100,.12)` over `#1a2138` vs `#ff8a8a` → **≈6.1:1** |
| Light | `#e0466a` vs `#c0392b` → **≈1.36:1** | `rgba(224,70,106,.12)` over `#f7f5ef` vs `#c0392b` → **≈4.3:1** |

Both tokens (`--drop-bad`, `--remove-fg`) already exist with values in both the dark `:root` block and the `:root[data-theme="light"]` block of `theme.css` (verified: lines 149/281/402/493 area) — no new token was needed.

**Hover direction fix:** the old hover rule replaced the (already-too-faint) solid fill with an even fainter translucent one — backwards from "hover should be a stronger signal." New hover keeps the same legible resting fill/text/border and layers a `box-shadow` ring on top (`color-mix(in srgb, var(--remove-fg) 30%, transparent)`), which is strictly additive emphasis, not a legibility trade-off.

---

## Item 2 — MERGE GATE: no test for badge → dialog forwarding

**File:** `src/views/Files.upload.test.ts` (added to the existing describe block; also added `uploadBatches: { getBatch, interruptBatch, abandonBatch }` to the file's `@nimotech/nimoos-service` mock, and a `body()` / `afterEach` DOM-cleanup pair mirroring `UploadBatchModal.test.ts`, since `UploadBatchModal`'s Dialog teleports to `document.body`).

Two new tests: seed `service.folder.getList` to return one entry (`Trip`, a folder) carrying `extensions.upload = { broken: true, batchId: 'b1' }`, mount `Files.vue`, force `files.setView('grid')` / `files.setView('list')`, click `.upload-broken-badge`, and assert `service.uploadBatches.getBatch` was called with `'b1'` and that `.ubm-missing-title` / `Trip/a.jpg` actually render in `document.body`.

**Deliberate RED/GREEN proof (all four outputs):**

1. Removed `@open-batch="emit('open-batch', $event)"` from `FileGridView.vue` → ran `pnpm exec vitest run src/views/Files.upload.test.ts -t "grid view"`:
   ```
   FAIL  ... grid view: clicking the torn badge opens the batch dialog (open-batch forwarding)
   AssertionError: expected "vi.fn()" to be called with arguments: [ 'b1' ]
   Number of calls: 0
   ```
   **RED confirmed.**
2. Restored the line in `FileGridView.vue` → re-ran the same command:
   ```
   Test Files  1 passed (1)
   Tests  1 passed | 7 skipped (8)
   ```
   **GREEN confirmed.**
3. Removed `@open-batch="emit('open-batch', $event)"` from `FileListView.vue` → ran `pnpm exec vitest run src/views/Files.upload.test.ts -t "list view"`:
   ```
   FAIL  ... list view: clicking the torn badge opens the batch dialog (open-batch forwarding)
   AssertionError: expected "vi.fn()" to be called with arguments: [ 'b1' ]
   Number of calls: 0
   ```
   **RED confirmed.**
4. Restored the line in `FileListView.vue` → re-ran the full file:
   ```
   Test Files  1 passed (1)
   Tests  8 passed (8)
   ```
   **GREEN confirmed.**

No changes were needed to `FileGridView.vue`/`FileListView.vue` themselves — the forwards were already correctly wired; the gap was purely test coverage. `git diff` for those two files is empty in the final state.

---

## Item 3 — stale comments

- **`src/views/Files.vue`** (`initUploads()` call site): rewritten. New comment states cross-refresh resume is gone, and that `resumePending()` cannot find work even on a same-session re-mount, because `addFilesToQueue()` starts the scheduler itself and drains every pending-with-file item before returning — so the call is a no-op today, kept as a latch for a possible future recovery path (not deleted, per instructions).
- **`src/files/upload/tusClient.ts`** (~22-25): rewritten to say the resume URL is held in-memory on the queue item for the tab's lifetime only, not "persisted by the caller."
- **`src/files/upload/scheduler.ts`** (the `resumed:` expression comment) and **`src/files/upload/scheduler.test.ts`** (the two `resumed`-related test docblocks): rewritten to state that `addFilesToQueue` is the only source of queue items today and always mints an `fq_` id, so the `true` branch is unreachable in production and the tests pin the wire-format contract rather than a reachable state. **The expression and both tests were left unchanged** — confirmed via `pnpm exec vitest run src/files/upload/scheduler.test.ts` (part of the item-1/2/5-adjacent verification pass, all passing).
- **`src/files/stores/uploads.ts`, `initUploads()`**: checked directly — there is no misleading comment attached to `initUploads()` or `resumePending()` themselves (the only nearby comment, on the `initialized` latch, is accurate: "once per page load, not once per mount"). The overclaiming comment the reviewer was pointing at lived at the Files.vue call site and is fixed there. No edit was needed in `uploads.ts` itself; function and latch left untouched as instructed.

---

## Item 4 — false provenance citations

**Grep run:** `grep -rn "extensions.upload\|upload-batches\|uploadBatchId\|isUploadBroken\|torn badge\|裂开的" --exclude-dir=docs /home/nimo/NimoTech/NimoOS-UI` (repo checked out on local branch `docs/vue3-migration-sp3`, HEAD `7016f575`).

**Result — this is a correction to the task's premise, not a confirmation of it:**

- On the *checked-out* branch, the grep is empty (matches the task's claim).
- But `NimoOS-UI`'s `main` branch (not currently checked out, but present as a local branch and reachable) contains real, on-point history:
  - **PR #75** (`155162f0`, "移除断点续传，改批次对账 + 裂开角标（前端）") is the *exact* Vue 2 counterpart of this whole SP12 Plan A branch — same architecture (drop IDB cross-refresh resume, keep tus same-session reconnect, report a batch manifest, `pagehide` interrupt signal, `extensions.upload`-driven torn badge, reconcile dialog with abandon/refill).
  - It added to `src/mixins/IconContainerMixin.js`, **at line 71 on `main`** (confirmed with `git show main:src/mixins/IconContainerMixin.js | grep -n uploadBroken`):
    ```js
    uploadBroken() {
        const ex = this.item && this.item.extensions
        return !!(ex && ex.upload && (ex.upload.broken === true || ex.upload.broken === 'true'))
    },
    ```
    This is **byte-for-byte the same boolean/string leniency logic** New-UI's `uploadBadge.ts` cites. **Verdict: `uploadBadge.ts`'s "ported from Vue2 IconContainerMixin.js:71" citation is accurate. Left untouched, per the task's own instruction to leave it alone if the precedent checks out.**
  - **PR #91** (`796110a3`, "裂开角标点不了——卡片 pointer-events:none 吞掉点击 + 回归测试") is also real and about the same badge. But its actual bug was **different** from what `FileTile.badge.test.ts`'s comment claimed: #91's regression was that the grid card's CSS set `pointer-events:none` on every inner `<span>` (for click-through-to-select), so the badge — rendered as a `<span>`-based icon — **never received the click event at all**; the fix was `pointer-events:auto` on the icon, not a stopPropagation fix. New-UI's guard (`@click.stop.prevent`) solves an unrelated, New-UI-specific problem: the badge `<button>` is nested inside the card's own `@click` handler, so without `.stop` the click would *bubble up and double-fire* `open`/`select` — the opposite failure mode (extra events, not missing ones). **Verdict: the citation is misattributed — #91 is real but doesn't establish "that exact regression." Corrected** (see item 3/4 commit `39fe9cf`) to describe the actual reason for the guard and explicitly note #91's different mechanism, rather than either leaving a wrong citation or fabricating a new one.

---

## Item 5 — cheap hardening

- **`src/files/upload/unloadGuard.ts`**, `activeBatchIds()`: `'pending'` branch now requires `it.file` too, matching `hasActiveUploads()`'s same-status check. Dead today (every item is created with a file attached) but now the two guards read the same event flow identically.
- **`src/files/upload/unloadGuard.test.ts`**: added `removes the pagehide listener on unsubscribe too`, symmetric to the existing `beforeunload` removal assertion.
- **`FileTile.vue` / `FileRow.vue`**: badge `v-if` now requires `isUploadBroken(props.entry) && uploadBatchIdOf(props.entry)` — a badge that could never open its dialog (empty batchId) is no longer drawn.

---

## Item 6 — unreachable acceptance-script step

`docs/superpowers/plans/2026-08-08-sp12-plan-a-upload-batch-swap.md`, real-machine acceptance section (was lines ~1549-1553): step 2 rewritten to upload a **folder** of ~5 files and close the tab after 1-2 complete, with an inline explanation of why a single flat file can never carry a badge (no listing entry / no parent folder for the backend to annotate; `route/v1/file.go:431-443` looks up `broken[info[i].Name]` against entries that already exist). Step 5's "重复 2" back-reference was updated to spell out "upload a new folder, close mid-transfer" and "select the same **folder**" instead of "the same file." Kept in Chinese, matching the rest of the plan document (the English-only rule covers code comments, not this doc).

---

## Verification (all four, run in the foreground, full output)

1. **`pnpm test`** (full suite, ~154s):
   ```
   Test Files  645 passed (645)
        Tests  10413 passed (10413)
   ```
   Baseline was 645 files / 10410 tests; +3 here are the two new `Files.upload.test.ts` integration tests and the one new `unloadGuard.test.ts` pagehide-cleanup test. The two documented non-findings reproduced exactly as expected (jsdom "Not implemented: navigation" noise from unrelated `src/photos/stores/__tests__/favorites.test.ts`, and an unrelated `/tmp/nimoos-www-*` permission warning from the same file) — nothing related to this branch's changes.

   Mid-session note: running `pnpm test` once *while* fix commits were still uncommitted showed 4 failing test files (`oss/cli-args.test.mjs`, `oss/export-rsync.test.mjs`) — these assert the OSS export tool's clean-working-tree guard succeeds, and failed only because our then-uncommitted `src/**` edits added dirty files beyond what `--allow-dirty-oss` tolerates. This was not a real regression: after committing (returning the tree to the same pre-existing dirty state as the task's stated baseline — only `design-export/*` deletions and `oss/*` modifications, both explicitly out of scope), the full re-run above shows all 645 files green, including those two.

2. **`pnpm exec vue-tsc --noEmit`** — no output, clean.

3. **`pnpm exec vitest run src/i18n/parity.test.ts`**:
   ```
   Test Files  1 passed (1)
        Tests  9 passed (9)
   ```

4. **`pnpm build`** — succeeded (`✓ built in 16.55s`), same large-chunk warnings as baseline (pdf.worker, wallpaper images, main bundle), unrelated to this change.

---

## Files changed

- `src/files/components/FileTile.vue`
- `src/files/components/FileRow.vue`
- `src/views/Files.upload.test.ts`
- `src/files/upload/unloadGuard.ts`
- `src/files/upload/unloadGuard.test.ts`
- `src/views/Files.vue`
- `src/files/upload/tusClient.ts`
- `src/files/upload/scheduler.ts`
- `src/files/upload/scheduler.test.ts`
- `src/files/components/FileTile.badge.test.ts`
- `docs/superpowers/plans/2026-08-08-sp12-plan-a-upload-batch-swap.md`

`src/files/components/FileGridView.vue` and `src/files/components/FileListView.vue` were touched only transiently for the RED/GREEN proof and are unchanged in the final diff (confirmed by the passing full-suite state and their being absent from the commit list above).

## Not done / left alone (explicitly out of scope, per the task)

Everything listed under "Not in scope" in the task brief was left untouched: `installUnloadGuard` app-scope move, `tusUploadUrl` clearing on retry, collapsing `resumed` to `false`, deleting `initUploads`/`hasActive`, badge/star stacking positions, `FileRow`'s chip-vs-overlay affordance, `noPersistence.test.ts`'s scan directory, the `getBatch` 404 message wording, the post-refill listing-reload race, and badge ARIA.

`src/files/stores/uploads.ts` itself was not edited (see item 3 above — verified no misleading comment exists there to fix).

`uploadBadge.ts`'s Vue 2 citation was verified accurate and left untouched, per instructions.
