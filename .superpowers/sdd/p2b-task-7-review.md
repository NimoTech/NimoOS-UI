# SP8-P2b Task 7 — SearchSection review

Commit reviewed: `7c086ea` (parent `3760271`). Read `p2b-common-constraints.md`, `p2b-task-7-brief.md`,
`p2b-task-7-report.md`, `p2b-review-task7.diff`, Vue2 blueprint `NimoOS-UI/src/views/AI/Settings/sections/SearchSection.vue`
(230 lines, read in full), and the reused-package utilities (`apiError.ts`, `files/util/clipboard.ts`).

## Verdicts

- **Spec compliance: PASS.** UI structure, class names, order, disabled/loading conditions, and the
  32 i18n values all match Vue2 (see detail below). `SettingsPage.vue` correctly untouched (deferred
  wiring skipped per §2, confirmed via `git show 7c086ea -- src/ai/views/SettingsPage.vue` = empty).
- **Task quality: Approved, with one Minor undeclared-deviation note.**

## Structural / class-name comparison (New-UI vs Vue2, section by section)

- Head: `.set-page-head/.set-h1/.set-desc` — matches. `.set-page-head` has no rule in
  `settings-styles.scss`/`sk-shared.scss` (grepped, confirmed absent), but this is inherited from
  every already-approved sibling (Blacklist/Execution/Memory/Models/Providers/Privacy/Thinking all
  use it identically) — pre-existing, not introduced by Task 7, not counted against it.
- Retrieval params: `.sk-section(-head/-title/-hint/-body)`, `.set-banner`, `.set-chips`/`.set-chip[data-on]`,
  `.set-input.num` × 4, `.set-actions`/`.sk-btn.primary`/`.hint` — 1:1, all classes grepped present in scss.
- Filename index: `SetSwitch` (`:model-value` correctly used instead of Vue2 `:value`), scan-interval
  input, `.dir-row`/`.dir-del`/`.dir-add` loop, two buttons + `.hint` — 1:1, disabled conditions
  (`saving`/`rescanning`) match Vue2 exactly.
- Diagnostics: `.diag/.diag-row/.diag-dot/.k/.v/.rec`, conditional inotify block, `.set-copy`/`.set-copybtn`,
  `p.warn` — 1:1, including the two independent triggers for the copy-box (`watch_degraded ||
  max_user_watches < recommended`), which Vue2 also OR's.
- Zero `<style>` block, matching sibling precedent.

## i18n verification (all 32 new keys + 7 reused, byte-for-byte)

Ran `python3` against `NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json` for all 32 new-key source strings
used as lookup keys (Vue2 `$t('<literal>')`) — every zh/en value in the New-UI commit matches the
production lang pack **exactly**, including the leading space in the English
`aiCfgInotifyRecommended` (`' (recommended: {n})'`) vs. no leading space in Chinese, and the `⚠`
character in `aiCfgWatchDegraded`. Grepped `zh_cn.ts`/`en_us.ts` at HEAD: no duplicate key definitions
in either file; all 7 reused keys (`aiCfgSearch`/`aiCfgSave`/`aiCopy`/`aiCopied`/`aiCfgDelete`/
`aiCfgSaved`/`aiCfgSaveFailed`) exist once each with correct values. Minor nit: the en_us.ts comment
block also lists `aiFailed` as "reused," but the component never calls `t('aiFailed')` — harmless
(no duplicate, no missing key), just an inaccurate comment.

## putSearchSettings payload audit

`saveParams` → exactly 5 keys (`default_sources/semantic_top_k/filename_top_k/image_top_k/max_total_results`);
`saveFileindex` → exactly 3 keys (`fileindex_enabled/fileindex_roots/fileindex_scan_interval_h`, roots
filtered of blank entries). Matches Vue2's two separate calls field-for-field — no extra/missing keys,
no blanking of untouched fields (Vue2 has the same two-call split, so 1:1 wins).

## getFileindexStatus / rescan timer

`rescan()` sets a 1500ms `setTimeout` calling `loadStatus()`, same as Vue2 `:217`. Vue2 never clears it
(no unmount hook exists in the Vue2 component at all) — genuine leak. New code stores it in `rescanTimer`
and clears it in `onUnmounted`. Test 18b proves this (see RED probe below).

## Four declared deviations — individually verdicted

1. **Missing catch on save/rescan** — CONFIRMED. Read Vue2 `saveParams`/`saveFileindex`/`rescan`
   (`:188-219`): all three are `try { … } finally { … }` with no `catch`, so failures silently reset
   the spinner with no feedback. Declared in the component header + report. Test 12/17 cover
   saveParams/saveFileindex; the rescan catch path has no dedicated unit test (report admits this:
   "rescan 的 catch 未单独出用例但代码路径一致") — acceptable since the code path is textually identical
   across all three functions and two of the three are directly tested, but worth noting as a small
   coverage gap.
2. **Un-cleaned rescan timer** — CONFIRMED leak in Vue2 (no unmount hook exists in the Vue2 component
   source at all). New code clears via `onUnmounted`; test 18b (`vi.useFakeTimers`, unmount, advance
   1500ms, assert `getFileindexStatus` not called again) proves it. RED-verified (see below).
3. **Silent clipboard failure on plain HTTP** — CONFIRMED Vue2 `copyCmd` (`:220-222`) is exactly
   `navigator.clipboard?.writeText(...)` with no fallback and no user feedback either way. The new
   `copyText` utility (pre-existing shared helper, execCommand fallback) only *adds* toast feedback on
   both success and failure paths — it does not remove or alter any visible Vue2 element (the button/
   input markup is unchanged). This is the common case on this LAN-HTTP product, so the fix is
   justified and the added feedback is a pure addition, not a visual regression. Tested by 22a/22b;
   RED-verified.
4. **Vue2 dead field `_active`** — CONFIRMED dead: grepped the entire Vue2 `NimoOS-UI` repo for
   `_active`, found only the two occurrences inside `SearchSection.vue` itself (one write in `data()`,
   one write in `mounted()`) — never read anywhere. Dropping it changes no behavior. Correctly
   declared and omitted.

## Undeclared deviation found (not in the four)

Vue2 `savedAt` is set via `this.savedAt = Date.now()` on both save paths and **never reset** —
the "已保存/Saved" hint (`v-if="savedAt"`) stays on screen forever once triggered (confirmed: grepped
the whole Vue2 file, no code path clears it). New-UI's `markSaved()` starts a 2000ms timer that resets
`savedAt.value = 0`, so the hint disappears after 2s — a real, visible interaction change from Vue2.
This is the exact same underlying Vue2 bug that `ExecutionSection.vue`/`ThinkingDefaultsSection.vue`
(prior, already-reviewed tasks) fixed and *explicitly declared* with a header comment citing the Vue2
bug. **Task 7 applies the identical fix but declares neither in the component header comment nor in
the report's deviation list** — an undeclared deviation, which per §7/§10 is itself a defect, even
though the fix is consistent with accepted precedent and low-risk. Severity: Minor (correct fix,
missing paperwork only).

## Helper-extraction question (src/ai/util/)

No non-trivial pure logic here is DOM-only-reachable. `statusLabel`'s map lookup (3 entries + fallback)
and `toggleSource`'s array toggle are trivial one-liners, tested adequately via DOM assertions (test 19
covers all 4 states including the unknown-value fallback). This mirrors the sibling precedent
(`ExecutionSection`/`ThinkingDefaultsSection` also keep equivalently-trivial maps inline, un-extracted).
No helper extraction was warranted; coverage is not weakened by the DOM-only test style here.

## Test vacuousness spot-check (6 of 27)

- #1 (full backfill): observes 4 numeric inputs + switch + roots via real DOM values — not vacuous,
  would fail if backfill logic were removed.
- #4 (getSearchSettings reject still calls getFileindexStatus): asserts the mock call directly —
  removing the "outside try/catch" placement of `loadStatus()` would fail this. Not vacuous.
- #9 (exactly 5 keys, no fileindex keys): asserts `Object.keys(payload)` — would fail if any extra key
  leaked in. Not vacuous.
- #18a/18b (timer set + timer cleared): uses fake timers and asserts real call counts pre/post-unmount.
  Not vacuous — RED-verified directly (see below).
- #20 (inotify null vs. populated, row count + text): asserts row count and text content, has a
  positive control case. Not vacuous.
- #22a/22b (copy success/fail paths): asserts `copyText` args + toast content on both branches. Not
  vacuous — RED-verified directly.

No vacuous or weakened tests found among those checked.

## RED probes (all reverted, `git status`/`diff` confirmed clean afterward)

1. Removed the `catch` block from `saveParams` (restoring Vue2's no-catch bug) → test **12** failed
   with an unhandled promise rejection, as expected. Restored byte-identically (verified with `diff`).
2. Removed the `if (rescanTimer) clearTimeout(rescanTimer)` line from `onUnmounted` (restoring Vue2's
   leak) → test **18b** failed (`getFileindexStatus` called once after unmount instead of never).
   Restored byte-identically.
3. Replaced `copyCmd`'s body with a no-op (removing the `copyText`/toast fallback, i.e. reverting to
   Vue2-shaped silent behavior) → tests **22a** and **22b** both failed as expected. Restored
   byte-identically (`diff` against backup showed zero differences; `git status` clean).

## Test numbers observed personally

- `pnpm test src/ai/components/settings/sections/SearchSection.test.ts` → **27 passed (27)**.
- `pnpm test` (full suite) → **279 files passed / 2200 tests passed**, zero red. Matches report; no
  red attributable to Task 7 or to the concurrent P2a session at this snapshot.
- `pnpm exec vue-tsc --noEmit` → no output, no errors.
- `pnpm build` → succeeded; only pre-existing third-party `/* #__PURE__ */`/eval warnings and
  >500KB chunk-size warnings (unrelated to this task).

## Commit hygiene

`git show --stat 7c086ea` → exactly 4 files (`SearchSection.vue`, `SearchSection.test.ts`,
`src/i18n/en_us.ts`, `src/i18n/en_us.ts`/`zh_cn.ts`). The i18n hunks contain only the Task 7 marker
block plus a harmless reposition of the pre-existing "SP8-P2a Task 11" marker block (an artifact of
`p2b-stage-i18n.sh` moving marker blocks to the HEAD ordering) — no P2a content was altered or
authored by this commit. `SettingsPage.vue` untouched. No concurrent-session files touched.
