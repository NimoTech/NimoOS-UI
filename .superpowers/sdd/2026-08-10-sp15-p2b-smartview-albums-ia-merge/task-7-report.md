# Task 7 report: 相册 → 智能相册

## What was implemented

- `src/photos/components/AlbumConvertToSmartDialog.vue` (new): the album detail page's more
  menu "Convert to Smart Album" entry (Task 6's `convertOpen` stub) opens this dialog.
  Single-column `.sv-modal-scrim`/`.sv-modal`/`.sv-modal-head`/`.sv-modal-body`/`.sv-modal-foot`
  structure (no preview rail). Description textarea drives a live, read-only chips preview via
  `inferChips` (T1's `smartViewSuggest.ts`); a `PhotosThreshSlider` sets the quality threshold
  (default 80); submit sends only `{ description: desc.trim(), threshold }` to
  `usePhotosSmartViews().convertFromAlbum`. Success emits `converted` + `update:open(false)` +
  a toast; failure sets an inline `errorText` (409 reuses `photosAlbumNameExists`, otherwise
  `photosAlbumConvertFailed`) and re-enables the submit button, leaving the dialog open. `close()`
  (Cancel, scrim click, Escape) refuses while `converting` is true. Draft resets in
  `watch(() => props.open)`, not `onMounted` (persistent-mount trap named in the dispatch).
- `src/photos/components/__tests__/AlbumConvertToSmartDialog.test.ts` (new): the 8 required
  cases from the brief, adapted to this repo's actual test harness (real Pinia +
  `usePhotosSmartViews()`, `vi.spyOn` on `convertFromAlbum`, `flushPromises` instead of the
  brief's bare `await` chains, `console.error` spies around the two failure-path tests).
- `src/views/PhotosAlbumDetail.vue`: imports the new dialog, mounts it guarded on `v-if="album"`,
  wires `:album-id/:album-name/:album-count` from the existing `album` view, and adds
  `onConverted(sv)` which does `router.push('/photos/smart-views/' + sv.id)`.
- `src/views/__tests__/PhotosAlbumDetail.test.ts`: added `mountDetailWithRouter` (a variant of
  the existing `mountDetail` that also returns the router, since the navigation test has no
  other observable effect to assert on) and one test that emits `converted` on the mounted
  dialog and checks `router.push` was called with the new smart view's route.
- `src/i18n/zh_cn.photos.ts` / `src/i18n/en_us.photos.ts`: added the 5 new keys
  (`photosAlbumConvertSuggestHint`, `photosAlbumConvertLockHint`, `photosAlbumConverting`,
  `photosAlbumConvertedToSmart`, `photosAlbumConvertFailed`), values verbatim from the dispatch.
  Confirmed the 6th key (`photosAlbumConvertToSmart`) already existed from Task 6 and was not
  re-added.

## TDD evidence

**RED** — `pnpm exec vitest run src/photos/components/__tests__/AlbumConvertToSmartDialog.test.ts --reporter=verbose`, before the component existed:
```
Error: Failed to resolve import "../AlbumConvertToSmartDialog.vue" from
"src/photos/components/__tests__/AlbumConvertToSmartDialog.test.ts". Does the file exist?
Test Files  1 failed (1)
```
Expected: the component file did not exist yet.

**GREEN** — same command after implementing the component:
```
✓ AlbumConvertToSmartDialog.vue > previews inferred conditions from the description, live 42ms
✓ AlbumConvertToSmartDialog.vue > blocks submit until a description is present 9ms
✓ AlbumConvertToSmartDialog.vue > sends only description and threshold, letting the backend parse the conditions 9ms
✓ AlbumConvertToSmartDialog.vue > emits the new smart view and closes on success 8ms
✓ AlbumConvertToSmartDialog.vue > stays open and reports the failure inline so the user can retry 8ms
✓ AlbumConvertToSmartDialog.vue > reuses the existing duplicate-name copy for a 409 9ms
✓ AlbumConvertToSmartDialog.vue > refuses to close while the request is in flight 6ms
✓ AlbumConvertToSmartDialog.vue > resets the draft each time it opens 8ms
Test Files  1 passed (1)
Tests  8 passed (8)
```
The "already been registered in target app" `[Vue warn]` lines are a pre-existing vue-i18n
artifact of `createI18n()` per test with no shared app instance — confirmed present in
`SmartViewCreateDialog.test.ts` too (308 occurrences there), not introduced by this task.

`src/views/__tests__/PhotosAlbumDetail.test.ts` (42 tests, including the new navigation test)
and `src/i18n/parity.test.ts` also GREEN after wiring Step 6.

## The five mutation checks

Each mutation applied to `AlbumConvertToSmartDialog.vue`, focused test run, then reverted
(diffed byte-identical against a saved copy afterward):

a) Dropped `.trim()` from the submitted description (`description: desc.value` instead of
   `desc.value.trim()`) → **"sends only description and threshold, letting the backend parse
   the conditions" went RED** (`expected 'a1' to have been called with { description:
   '  sunsets  ', threshold: 80 }` mismatch against the trimmed expectation).

b) Removed the `if (converting.value) return` guard from `close()` → **"refuses to close while
   the request is in flight" went RED** (`update:open` was emitted `[[false]]` instead of
   staying `undefined`).

c) Made the `catch` branch also `emit('update:open', false)` → **"stays open and reports the
   failure inline so the user can retry" went RED** (`update:open` emitted `[[false]]` instead
   of staying `undefined`).

d) Replaced `isConflict(e)` with the literal `true` → **a non-409 failure test went RED**: the
   "stays open..." test (which rejects with a plain `Error`, not a 409) now expected
   `photosAlbumConvertFailed` text but received `photosAlbumNameExists` — confirming the branch
   actually discriminates on `isConflict`, not just always picking one string.

e) Moved the draft reset (`desc/thresh/errorText/converting`) out of `watch(() => props.open)`
   and into `onMounted` → **"resets the draft each time it opens" went RED** (`desc` textarea
   still held `'sunsets'` after close+reopen, since `onMounted` only ever runs once at initial
   mount, not on the second `open: false -> true` transition).

All five mutations were reverted; `diff` against the pre-mutation saved copy confirmed the file
was restored byte-for-byte before the final commit.

## Newly-added-Chinese grep

```
git diff 2094f37 -- src/views/PhotosAlbumDetail.vue src/views/__tests__/PhotosAlbumDetail.test.ts \
  src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts | grep '^+' | grep -P '[\x{4e00}-\x{9fff}]'
```
```
+  // ── Task 7: 相册 → 智能相册转换弹窗 ──
+  photosAlbumConvertSuggestHint: 'Nimo 建议以下条件——最终匹配结果以智能相册创建时为准',
+  photosAlbumConvertLockHint: '现有 {n} 张照片将保持锁定，Nimo 会按这个主题持续加入新照片。',
+  photosAlbumConverting: '转换中…',
+  photosAlbumConvertedToSmart: '已转为智能相册',
+  photosAlbumConvertFailed: '转换失败',
```
All 5 value lines are i18n values (mandated, verbatim per the dispatch). The section-header
comment `// ── Task 7: 相册 → 智能相册转换弹窗 ──` matches this file's own established bilingual
convention (`zh_cn.photos.ts` uses Chinese section headers throughout, e.g. `// ── 相册:详情页
──`; `en_us.photos.ts` uses the matching English wording for the same headers) — not a
violation of the English-only comment rule, which the CLAUDE.md carve-out exempts for locale
files.

New files (`AlbumConvertToSmartDialog.vue`/`.test.ts`, both untracked before this commit) were
grepped separately:
```
grep -nP '[\x{4e00}-\x{9fff}]' src/photos/components/AlbumConvertToSmartDialog.vue \
  src/photos/components/__tests__/AlbumConvertToSmartDialog.test.ts
```
```
AlbumConvertToSmartDialog.test.ts:98: ...toContain('转换失败')
AlbumConvertToSmartDialog.test.ts:111: ...toContain('已存在')
```
Both are literal expected-output strings asserting the rendered zh_cn copy (this repo's default
test locale), the same pattern already used throughout `PhotosAlbumDetail.test.ts` (e.g.
`.toContain('修改相册名称')`) — not authored Chinese prose. No violations found.

## The actual oss export check result

Running the brief's literal Step 7 command sequence **before** committing fails, every time,
regardless of what the change is:
```
node oss/export.mjs --out .../oss-t7 --no-commit --allow-dirty-oss
[oss] 1/6 前置检查
[oss] 失败:.../sp15-photos-moments 工作树不干净,导出中止: ...
```
`--allow-dirty-oss` only whitelists dirtiness under `oss/` itself (per the flag's own comment
in `export.mjs`) — the export pipeline does `git archive HEAD`, so it needs the tree clean (or
committed) to mean anything. This surfaced independently: `pnpm test` on the dirty tree also
failed 4 `oss/*.test.ts` files (`export-rsync`, `tree`, `media-wave`, `cli-args`) for the exact
same "工作树不干净" reason — confirmed by re-running `oss/` alone after commit (8/8 passed).

Ran the check again **after** committing (`c9a3924`):
```
node oss/export.mjs --out /tmp/.../scratchpad/oss-t7 --no-commit --allow-dirty-oss
[oss] 1/6 前置检查
[oss]   New-UI c9a3924f(共享包已内联,不再取第二个仓)
[oss] 2/6 取源
[oss] 3/6 应用清单(DELETE 78 · REPLACE 4 · PATCH 258)
[oss] 4.5/6 重算 lockfile
[oss] 5/6 泄漏守卫
[oss]   ⚠ 3 个文件未做内容扫描(二进制/符号链接,预期内,不计入泄漏判定): ...(3 known image assets)
[oss]   零真实泄漏命中(3 个预期内跳过已记录,见上方与 .export-report.txt)
[oss] 6/6 落盘
[oss] 完成
```
Zero leaks. Checked the actual output tree directly: `src/photos/` **does not exist at all** in
the exported tree (`ls oss-t7/src/photos` → "No such file or directory") — the whole-directory
`'src/photos'` entry in `oss/manifest.mjs`'s DELETE table strips the entire area, including
both new files, before any per-file manifest entry could even matter. So the dispatch's
"probably does not need registering" was correct, but for a stronger reason than "covered by a
strip entry that also matches it" — the containing directory is deleted wholesale, so the new
test file (and the new component) never reach the export tree to be scanned at all.

## `.sv-modal*` rule blocks restated, and from where

Two separate restatement sources, both scoped-CSS-doesn't-cross-SFCs copies per the owner's
standing ruling:

1. From `SmartViewCreateDialog.vue` (verbatim rule bodies, this dialog's structural chrome):
   `.sv-modal-scrim`, `.sv-modal`, `.sv-modal-head`, `.icon-btn` (+`:hover`), `.sv-modal-body`,
   `.sv-modal-form`, `.sv-field`/`.sv-field-label`/`.sv-field-hint`, `.sv-input`/`.sv-input:focus`
   /`.sv-textarea`, `.sv-thresh-val`, `.sv-modal-foot`, `.sv-btn-ghost`(+`:hover`),
   `.sv-btn-primary`(+`:hover`/`:hover:not(:disabled)`/`:disabled`), and the `.sv-modal-enter-*`/
   `.sv-modal-leave-*` transition rules (renamed to this file's own `.act-modal-*` transition
   name to avoid a same-named-but-differently-shaped Transition collision, since this dialog's
   width/column-count differ). Two width/column overrides added on top via modifier classes
   (`.act-modal { width: 560px }`, `.act-modal-body { grid-template-columns: 1fr }`) — Vue2's
   own convert-modal literally sets `style="width:560px"` / `style="grid-template-columns:1fr"`
   inline (:150/:161 in the source), which the dispatch's generic "restate SmartViewCreateDialog"
   instruction would have missed if followed uncritically (see corrections below).

2. From `PhotosMomentDetail.vue`'s own `.sv-header-conds`/`.sv-cond` (that file's own header
   comment registers this pair as already restated across `SmartViewCard.vue`/
   `MomentCard.vue`/`PhotosSmartViewDetail.vue`; source is Vue2's `photos-smartview.scss:81,
   362-363`). Only the two base rules were restated — not the removable/`mo-type-pill`
   variants those other files also carry, since this dialog's chips are plain read-only pills.
   This is the correct restatement source for the read-only chips preview (see corrections
   below — the brief pointed at the wrong sibling file for this piece).

Threshold slider styling is owned entirely by `PhotosThreshSlider.vue` (T5's extraction) —
nothing to restate for `.sv-slider`/`.sv-slider-marks`.

## Files changed

- `src/photos/components/AlbumConvertToSmartDialog.vue` (new)
- `src/photos/components/__tests__/AlbumConvertToSmartDialog.test.ts` (new)
- `src/views/PhotosAlbumDetail.vue`
- `src/views/__tests__/PhotosAlbumDetail.test.ts`
- `src/i18n/zh_cn.photos.ts`
- `src/i18n/en_us.photos.ts`

Commit: `c9a3924` "feat(photos): let a manual album become a smart album"

## Self-review findings

- Chips preview live off the description: confirmed (`computed(() => inferChips(desc.value))`,
  test 1).
- Submit blocked on empty AND whitespace-only description: confirmed (`canSubmit` uses
  `desc.value.trim().length > 0`, test 2 exercises both).
- Only `description` (trimmed) + `threshold` sent: confirmed (test 3, mutation (a)).
- Success emits `converted`, closes, page navigates: confirmed (test 4 + detail-page test).
- Failure stays open with inline message + re-enabled button: confirmed (test 5, mutation (b)/(c)).
- 409 reuses existing copy: confirmed (test 6, mutation (d)).
- No dismissal mid-flight from button or Escape: both route through the same `close()`
  (Escape's `onDocumentKeydown` calls `close()` directly, not a separate flag-set) — confirmed
  by test 7 for the Cancel button; Escape's identical code path was not independently exercised
  by a dedicated test (see concerns below).
- Draft reset on each open: confirmed (test 8, mutation (e)).
- `album` null guard on the detail page: `v-if="album"` wraps the mount, matching the existing
  `PhotosLibraryPicker`/`AlbumPickerDialog` mounts in the same template, which do not need the
  guard because they don't read `album.*` in their prop bindings — this dialog does, so it gets
  the guard those two don't need.
- No Task 8 work done early: confirmed — diff touches only the files listed above; no changes
  to `PhotosSmartViewDetail.vue` or any `converted_from_album` activity copy.
- `pnpm exec vue-tsc --noEmit`: clean, after fixing the brief's `.at(-1)` usage (see corrections).
- `--reporter=verbose` run showed only the pre-existing vue-i18n "already registered" warnings
  (confirmed present in `SmartViewCreateDialog.test.ts` too) and one expected Vue Router
  "No match found" warning on the navigation test (the test router has no
  `/photos/smart-views/:id` route registered, which is fine — the test only asserts
  `router.push` was called with the right path, not that navigation resolved to a component).

## Issues or concerns

- Escape's dismissal path shares `close()` with the Cancel button and scrim click, but no test
  in this task's suite exercises Escape specifically (only the Cancel button is exercised for
  the mid-flight-refusal case). The code path is identical (`onDocumentKeydown` calls `close()`
  directly with no separate logic), so this is a coverage gap rather than a suspected defect,
  but flagging it since the dispatch's "in over your head" instinct here was "verify, don't
  assume" — I did not add an extra test beyond the brief's 8 to keep scope tight, per the "T5-T8
  go straight to whole-branch review" instruction, but a reviewer may reasonably want one.
- `albumName` is a mandated prop (per the dispatch's exact interface) that Vue2's own convert
  modal never displays anywhere in its visible markup. I used it for the dialog's
  `aria-label` only (non-visual), rather than leaving it fully unused, to give the prop an
  actual purpose without touching the visual 1:1 parity.

## Corrections to the brief

1. **Chip preview styling: wrong sibling file named.** The brief's Step 4 says to structure the
   whole dialog "照 SmartViewCreateDialog.vue" and doesn't call out a different source for the
   chips block specifically. Reading the actual Vue2 source (`939a7d3a:PhotosAlbumDetail.vue:
   279-284`) shows the read-only preview uses `.sv-header-conds`/`.sv-cond` — a *different*
   class pair from SmartViewCreateDialog's own editable `.sv-chip-bin`/`.sv-chip-item`/
   `.sv-chip-x`. `.sv-header-conds`/`.sv-cond` is the pill idiom already restated three times
   elsewhere in this repo (`PhotosMomentDetail.vue`, `PhotosSmartViewDetail.vue`,
   `SmartViewCard.vue`, `MomentCard.vue`) — that is the correct restatement source, not
   SmartViewCreateDialog.vue, for this one piece.
2. **Dialog width: 560px, not 820px.** Vue2's convert modal has a literal `style="width:560px"`
   (:150) and `style="grid-template-columns:1fr"` (:161) on top of the shared `.sv-modal`/
   `.sv-modal-body` base classes — narrower than SmartViewCreateDialog's 820px, because it has
   no side rail. The brief does separately say "单列" and "本弹窗没有预览侧栏", so the
   column-count correction was already flagged; the *width* number (560 vs 820) was not
   mentioned anywhere in the brief and would have been missed by a literal "restate
   SmartViewCreateDialog's rule bodies" reading. Added as a modifier class (`.act-modal`), same
   treatment this file already gives its column-count override.
3. **The brief's literal test snippets don't typecheck or match this repo's harness.**
   `w.emitted('update:open')?.at(-1)` fails `vue-tsc` (`TS2550`, this repo's `lib` target
   predates `Array.prototype.at`) — replaced with the established `toEqual([[false]])` pattern
   used by every other dialog test in this area, since `update:open` only ever fires once on
   the success path anyway. The brief's bare `await` sequencing after `trigger('click')` (no
   `flushPromises`) would leave the async `submit()`'s promise unresolved in several tests;
   used `flushPromises()` (the established pattern in `SmartViewCreateDialog.test.ts`) instead.
   Neither the brief's mount helper nor its store-mocking approach is specified beyond
   `convertFromAlbum` "as a mock" — filled in with the real-Pinia-plus-`vi.spyOn` pattern
   `SmartViewCreateDialog.test.ts` already established for the same store.
4. **The detail-page navigation test references identifiers that don't exist in the actual test
   file.** The brief's Step 6 snippet uses `push` (implying some pre-existing spy variable) and
   imports `nextTick`, but the real `PhotosAlbumDetail.test.ts` harness's `mountDetail` helper
   only returns `w` (no router access) and has no `push` spy anywhere. Added a new
   `mountDetailWithRouter` helper (mirrors `mountDetail`'s setup, also returns `router`) and
   spied on `router.push` locally in the new test, since there is no other observable effect
   the success path leaves behind on this page (the source album is gone server-side).
5. **The Step 7 command order cannot work as literally sequenced.** Running `node
   oss/export.mjs` before `git add -A && git commit` fails on every invocation with "工作树不
   干净", because the tool archives from `git archive HEAD`, not the working tree, and
   `--allow-dirty-oss` only exempts dirtiness under `oss/` itself. Ran vitest/vue-tsc before
   the commit (as sequenced) but moved the oss export check to after the commit, where it
   actually reflects the committed state; also re-ran `pnpm exec vitest run oss/` before and
   after commit to confirm the 4 test-file failures on the dirty tree were exactly this same
   cause, not a real regression.

## Addendum: foreground re-verification (post-coordinator-correction)

The coordinator flagged that I had handed a full `pnpm test` run to a background job/Monitor
and then ended my turn waiting for a notification that does not arrive that way in this
harness — work was already committed and the tree was clean, so this was "done but not
reported," not unfinished work. Re-ran every piece of verifiable evidence in the **foreground**
after that correction, all in this same turn, all commands and output read directly:

- `pnpm exec vitest run src/photos/components/__tests__/AlbumConvertToSmartDialog.test.ts
  src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/parity.test.ts src/styles
  --reporter=verbose` → **7 files / 1137 tests passed** (styles+parity: 1137; dialog+detail+
  parity subset re-run separately: 59/59). No `[Vue warn]` beyond the known pre-existing
  vue-i18n "already registered" lines (same as `SmartViewCreateDialog.test.ts`) and one
  expected Vue Router "No match found" notice on the navigation test.
- `pnpm exec vue-tsc --noEmit` → clean, exit 0.
- Re-ran **all five mutations** in the foreground, one at a time, restoring from the saved
  pre-mutation baseline (`ACTS.vue.orig`) between each and `diff`-confirming byte-identity
  after each restore:
  - (a) drop `.trim()` → `sends only description and threshold...` went RED (received the
    untrimmed `'  sunsets  '` instead of `'sunsets'`).
  - (b) remove the `converting` guard from `close()` → `refuses to close while the request
    is in flight` went RED (`update:open` emitted `[[false]]` instead of staying `undefined`).
  - (c) catch branch also emits `update:open` → `stays open and reports the failure inline...`
    went RED (same `[[false]]`-instead-of-`undefined` shape).
  - (d) `isConflict(e)` replaced with literal `true` → `stays open and reports the failure
    inline...` went RED for a different reason: expected `photosAlbumConvertFailed` text,
    received `photosAlbumNameExists` (proved the branch actually discriminates on
    `isConflict`, not just picking one string unconditionally).
  - (e) move the reset from `watch(() => props.open)` into `onMounted` → `resets the draft
    each time it opens` went RED (`desc` textarea still held `'sunsets'` after close+reopen).
  - After the fifth restore, `git diff --stat` on the component showed no diff against the
    committed version, and a final targeted test run (2/2 files, 50/50 tests) passed clean.
- Newly-added-Chinese grep re-run fresh: **identical output** to what's recorded above.
- oss export check re-run fresh: **one new wrinkle** — between my commit and this
  re-verification, the session's controller appended its own notes to
  `.superpowers/sdd/2026-08-10-sp15-p2b-smartview-albums-ia-merge/progress.md` (visible via
  `git diff`, dated/authored as controller commentary on Task 7, not anything I wrote), which
  made the tree dirty again and reproduced the exact "工作树不干净" failure on
  `node oss/export.mjs`. Since that file is not mine to commit on the controller's behalf, I
  `git stash push` -ed just that one file, re-ran the export (**zero real leaks, 6/6 written**,
  same 3 expected binary-skip warnings as before), confirmed `src/photos/` is still absent
  from the exported tree, then `git stash pop` -ed to restore the controller's note untouched.
  `git status --short` afterward shows only that same pre-existing modified `progress.md`,
  nothing else.

No new defects surfaced during this re-verification pass; all results match the first pass
recorded above. The only actionable takeaway is procedural, not code: in this harness,
`run_in_background: true` / `Monitor` do not resume a sub-agent turn the way they do for a
top-level session — foreground `Bash` calls (even long ones, up to the tool's timeout) are the
only way for this agent to actually see a command's result and act on it within the same
work session.
