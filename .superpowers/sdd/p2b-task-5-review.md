# P2b Task 5 Review — ExecutionSection

## Verdicts

- **Spec compliance: PASS (✅)**
- **Task quality: Approved**

## Method

Read Vue2 blueprint `NimoOS-UI/src/views/AI/Settings/sections/ExecutionSection.vue` (80 lines) directly, diffed template structure line-by-line against the new `ExecutionSection.vue` (114 lines). Compared against sibling `BlacklistSection.vue` for house style. Grepped every CSS class used (`set-inner`, `set-page-head`, `set-h1`, `set-desc`, `sk-section*`, `set-banner`, `.ico`, `set-rows`, `set-row`, `.lbl`, `.val.end`, `set-input.num`, `set-actions`, `.hint`) against `settings-styles.scss`/`sk-shared.scss` — all exist, none invented. Checked `SetSwitch.vue` prop contract (`modelValue`/`update:modelValue`+`change`, `.sw[data-on]`) — component uses `:model-value` correctly (Vue2 used `:value`, a documented Vue2→3 v-model mechanical difference, not a deviation). Verified i18n values against production `zh_CN.json`/`en_US.json` word-for-word (all 6 sampled + the brief's other keys match exactly). Confirmed `getMaxTurns()`/`putMaxTurns(maxTurns: number)` signatures in `.sp8/NimoOS-Service/dist/ai.d.ts:106-107` and that the call site passes a plain `number`, matching.

## Four claims

1. **`putMaxTurns` vs `setMaxTurns`**: CONFIRMED. `ai.d.ts:107` is `putMaxTurns(maxTurns: number): Promise<unknown>`; brief's `setMaxTurns` doesn't exist. Component/test use `putMaxTurns` correctly, call-site argument is a bare `number` (not wrapped in an object) — correct shape.
2. **Logic fix A (missing catch)**: CONFIRMED real defect, not cosmetic. Vue2 `save()` (`:63-77`) has try/finally but no catch — on `ai.putMaxTurns` rejection, "保存中…" resets via `finally` with zero user feedback and no persisted value; user believes it saved. Comment names Vue2 `ExecutionSection.vue:66-79`/`:73`, states the problem, and is declared in both the header comment and the report. Test 11/12 cover it.
3. **Logic fix B (savedAt never clears)**: CONFIRMED real defect (permanent stale "已保存" after later unsaved edits). Comment cites Vue2 line, declared in header + report, covered by test 10 (1999ms-still-shown / 2000ms-cleared) and test 13 (unmount clears timer, no post-unmount toast).
4. **Test-8 substitution (`0`→`0.3`)**: Correct call. Traced the formula `Math.max(1, Math.floor(Number(steps.value) || 10))`: literal `0` → `Number(0)||10` = `10` (same falsy-zero branch as empty string, not the clamp) → `putMaxTurns(10)`, not `1` as the brief's table claimed — the brief's own case is internally inconsistent with its adjacent explanation of the empty-input fallback. `0.3` → `Math.floor(0.3)=0` → `Math.max(1,0)=1`, correctly exercising the clamp branch alone. Substitution is right and is documented inline in the test file and report. Minor gap: no dedicated test asserts literal `"0"` input still resolves to `10` (it's implicitly covered since it's the same branch as the "empty input" test, but an explicit assertion would remove any doubt) — Minor, not blocking.

## RED probes (both reverted, `git diff`/`git status` confirmed clean, both files byte-identical afterward)

1. Removed the `catch (e) { toast.show(...) }` block (logic fix A), replaced with silent swallow. Result: exactly the two targeted tests failed — "保存失败弹 danger toast，且「保存中…」复位" and "保存失败且无消息 → toast 兜底文案「保存失败」" (13/15 passed). Confirms these two tests genuinely pin the added catch, not the mock.
2. Removed the `setTimeout(... , 2000)` clear from `markSaved()` (logic fix B). Result: exactly "「已保存」2 秒后自动消失" failed (`expected '已保存' to be ''`), 14/15 passed. Confirms this test pins the auto-clear behavior, not just observing state that was set once.

## Findings

None at Critical or Important severity.

- Minor — no dedicated unit test for literal input `"0"` (brief's original case 8-a) even after the substitution to `0.3`; behavior is implicitly covered by the "empty input" test hitting the identical `||10` branch, but an explicit assertion would be more defensive documentation of the brief's own table error. Not blocking.

## Commit hygiene

`git show --stat cc67ff1`: exactly `ExecutionSection.vue` (+114), `ExecutionSection.test.ts` (+211), `src/i18n/en_us.ts` (+10), `src/i18n/zh_cn.ts` (+10). i18n hunks are pure additions inside `// >>> SP8-P2b Task 5` / `// <<< SP8-P2b Task 5` markers, no other lines touched. `SettingsPage.vue` is untouched by this commit (confirmed absent from the commit's file list) — deferred wiring correctly honored per standing instruction.

## D2 / state discipline

Header comment explicitly declares D2: all four pieces of state (`steps`, `unlimited`, `saving`, `savedAt`) live in component-local `ref`s, no Pinia store touched, matching the human's 2026-07-28 ruling that only `blacklist` uses the store. No `settingsStore`/`agentStore` changes in this diff.

## Other checks

- `service.ai.*` return value handling: New-UI reads `d?.max_turns` directly (no extra `.data` unwrap), matching Vue2's `d.max_turns`; New-UI's optional chaining is strictly more defensive (handles `null`/`undefined` payload) than Vue2's direct property access — not a removal of any Vue2 defensive fallback.
- No color literals in this component (no `<style>` block at all).
- No `any` / `as unknown as` laundering — the one type assertion (`d as { max_turns?: unknown } | null`) is a normal narrowing cast on an untyped SDK return, not laundering.
- Committed i18n keys have exactly one definition each for `aiCfgSaving`/`aiCfgSaved`/`aiCfgSaveFailed` in HEAD — no duplicate landed despite the reported cross-session naming collision with in-flight (uncommitted) P2a `ProvidersSection`.

## Test runs I personally observed

- `pnpm test src/ai/components/settings/sections/ExecutionSection.test.ts` → **15/15 passed**.
- `pnpm test` (full suite, current worktree state, which now includes the previously-reported-failing P2a `ProvidersSection.test.ts` as it has since been fixed/staged by the concurrent session) → **274 files / 2122 tests, all passed**. No red attributable to Task 4/5 files; no red observed at all in this run (the previously reported 24 `ProvidersSection` failures are stale — that file passes now, and regardless belongs to the concurrent P2a session, not this task).
- `pnpm exec vue-tsc --noEmit` → no output, 0 errors.
- `pnpm build` → succeeded, `dist/` produced, only standard chunk-size advisory warnings (not errors).
