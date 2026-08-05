# SP8-P2b Task 6 review — MemorySection + D5

## Verdicts
- Spec compliance: PASS
- Task quality: Approved (0 Critical, 0 Important, 2 Minor)

## Findings
- Minor — `src/ai/components/settings/sections/MemorySection.vue:75` adds `|| []` fallback after `listUserMemory()` that Vue2 (`MemorySection.vue:108`) does not have; harmless defensive addition, undeclared as a deviation (no comment/report note), does not change any tested behaviour.
- Minor — Logic fix 1 (`!!s.enabled`) has no dedicated test that mocks a settings response omitting `enabled`; carried-over test 1 mocks `{enabled:false}` so it cannot distinguish `!!` from bare assignment. Fix is declared (comment + report) and I confirmed the described bug is real (undefined → payload key dropped by JSON.stringify → backend treats as "unchanged"), but its correctness is unverified by any test.

## Markup / 1:1 check
Compared byte-by-byte against Vue2 `sections/MemorySection.vue` (159 lines): class names (`set-inner`, `sk-section*`, `set-banner.warn`, `set-rows/set-row`, `lbl/sub`, `val.end`, `set-input.num`, `mem-row/mem-body/mem-text/mem-tags/mem-tag[.recall][data-k]`, `mem-del`, `set-note`) all match and all exist in `settings-styles.scss`/`sk-shared.scss` (grepped each individually, including compound `.val.end`). Section root is exactly `set-inner` → `sk-section` ×2, no extra wrapper. No `<style>` block added, matching claim. `SkillIcon` → `AgentIcon` substitution for the delete button's `x` icon verified geometrically equivalent (Feather 24-unit coords ×0.8333 = AgentIcon's 20-unit path), same pattern used by sibling sections. `SetSwitch` semantics identical (Vue2 `value`/`input`+`change` ↔ New-UI `modelValue`/`update:modelValue`+`change`, framework-API-only difference, already reviewed-clean).

## Vue2 test carry-over: 13/13 present, 0 dropped
All 13 Vue2 assertions (load fills settings+memories, load fills compaction/context_window, load defaults on absent fields, load error, remove success/failure, saveEnabled revert+3-field payload, saveCompaction payload+revert, saveContextWindow number/null/snapshot-revert, kindLabel/sourceLabel map+passthrough) have a 1:1 counterpart, driven by `mount()`+service spy instead of `methods.x.call(ctx)`. The critical case (#12, blank → `null`) is asserted and I verified both the assertion and the component logic (`contextWindow.value !== '' ? Number(...) : null` — real `null`, not `undefined`/`0`/omitted).

## Scope expansion (memoryLabels.ts + .test.ts, 6 files not 4)
Justified and properly declared. Brief Step 2 #14 explicitly mandates extracting `kindLabel`/`sourceLabel` into a separate module (`<script setup>` has no `methods` object to borrow for unit testing) and explicitly instructs adding it to the task's file list. `MemorySection.vue` genuinely imports both functions; omitting the util file would make the component unbuildable. Not gratuitous.

## Two declared logic fixes
1. `!!s.enabled` normalisation — real bug: if backend omits `enabled`, Vue2's bare assignment leaves `undefined`; `JSON.stringify` drops `undefined` keys, so the next `putMemorySettings` payload silently omits `enabled` and backend treats it as unchanged. Confirmed reproducible. Declared via header comment + report. Not tested directly (see Minor finding above).
2. Danger toasts on 4 failure paths — confirmed Vue2 is genuinely silent on all four (`:122-124`/`:133-135`/`:145-147`/`:153-155`, the last with an explicit "keep on failure" comment). New toasts use house style (`apiErrorMessage(e, t('aiCfgSaveFailed'))`, tier `'danger'`, 3000ms) matching reviewed-clean siblings.

## D5 service change
`NimoOS-Service` commit `c8f1919`, `src/ai.ts` — exactly `context_window?: number | null` on `putMemorySettings`'s payload type, nothing else changed (`git show --stat`: 1 file, 5+/1-). `dist/` confirmed untracked (`git ls-files dist/` empty). `git status` clean at HEAD. `node_modules/@nimotech/nimoos-service` in New-UI is a **symlink** into the pnpm store which itself resolves back to the Service repo's own `dist/`, confirmed byte-identical (`diff` = no output) — so the consumer's `dist/ai.d.ts` is live, not a stale copy; `vue-tsc` green is meaningful. No `as unknown as number` cast at any call site — `payload()` returns `number | null` natively.

## Payload-shape claim
All three save paths (`saveEnabled`/`saveCompaction`/`saveContextWindow`) call the same `payload()` and always send all three keys — matches Vue2's three near-identical literal object bodies (`:117-121`/`:128-132`/`:140-144`). No single-field-save-blanks-another-field risk introduced; Vue2 had the same all-three-keys behaviour, so 1:1 wins.

## D2 / attention lens
No Pinia store for memory/settings state — all local `ref`s; only `useToast()` used (allowed, toast infra, not app state). Header comment declares D2 compliance explicitly. `SettingsPage.vue` untouched (confirmed via `git show --stat e8f8564`: 6 files, no `SettingsPage.*`) — wiring correctly deferred per standing order.

## Commit hygiene
New-UI `e8f8564`: exactly the 6 files claimed, i18n hunks contain only the `SP8-P2b Task 6` marker block (verified via diff — no P2a/other-session content leaked in). Service `c8f1919`: exactly `src/ai.ts`, `git status` clean at HEAD in both repos before/after my probes.

## RED probes (all reverted, `git diff`/`diff` confirmed byte-identical after each)
1. Changed `payload()`'s blank-context_window branch from `null` → `undefined`: 2 tests failed (the #12 blank-sends-null case and #9 saveCompaction's `context_window:null` assertion), 18 passed. Restored.
2. Removed the `toast.show(...)` call from `saveEnabled`'s catch block: exactly 1 test failed (`saveEnabled() 失败弹 danger toast`), 19 passed — precisely targeted, no collateral. Restored.
3. Removed the `enabled.value = !enabled.value` revert line from `saveEnabled`'s catch: exactly 1 test failed (`saveEnabled() 失败时把开关翻回去`, expected 'false' got 'true') — confirms the switch-revert test is not vacuous. Restored.

## Test numbers observed (attribution)
- `pnpm test MemorySection.test.ts memoryLabels.test.ts`: 2 files / 24 tests passed (matches report: 20+4).
- `pnpm test` (full suite): 276 files / 2150 tests passed, 0 failed. (Report claimed 2148 — the +2 delta is attributable to the concurrent P2a session's commits landing after the report was written, not to Task 6; no red observed anywhere, so no attribution dispute.)
- `pnpm exec vue-tsc --noEmit`: clean, no output.
- `pnpm build`: succeeded, only the pre-existing "chunks >500kB" advisory (unrelated, pre-existing).
- Note: a `RangeError: Maximum call stack size exceeded` / "Exception in PromiseRejectCallback" line appears in `MemorySection.test.ts` runs (both baseline and my RED runs) alongside all-green results — cosmetic Vitest/Node unhandled-rejection-tracking noise from the intentionally-thrown mock errors, not a test failure (0 failed reported every green run). Not attributed as a defect; noting for visibility only.
