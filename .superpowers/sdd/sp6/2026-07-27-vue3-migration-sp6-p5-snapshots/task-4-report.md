# Task 4 Report: 保留策略高级表单 + 手动创建快照

## Status: Done

## TDD evidence

### RED (Step 2)

Command: `pnpm exec vitest run src/storage/components/SnapshotPanel.test.ts`

After appending the brief's Step 1 test suites (`SnapshotPanel 高级策略表单` /
`SnapshotPanel 手动创建快照`) and switching the top-of-file mock for
`patchPolicy`/`create` to named forwarding mocks (`patchPolicy`, `createSnap`)
with default `beforeEach` resolutions, ran against the still-unmodified `.vue`
(placeholders only):

```
Test Files  1 failed (1)
     Tests  8 failed | 11 passed (19)
```

Failures were all `Cannot call trigger/setValue on an empty DOMWrapper` for
`.sp-advanced-btn`, `.sp-in-hourly`, `.sp-label-input`, `.sp-create` etc. — the
existing 11 三态/开关 tests all still passed, confirming the mock-signature
change didn't regress them.

### GREEN (Step 4)

Implemented the component per brief Step 3 (verbatim `<script setup>` additions,
template block, and CSS block). Re-ran:

```
pnpm exec vitest run src/storage/components/SnapshotPanel.test.ts
 Test Files  1 passed (1)
      Tests  19 passed (19)

pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts
 Test Files  2 passed (2)
      Tests  122 passed (122)

pnpm exec vue-tsc --noEmit
(no output — zero errors)

pnpm test
 Test Files  244 passed (244)
      Tests  1476 passed (1476)
```

Note: one full-suite run produced a single transient failure in the unrelated
`src/files/upload/persist.test.ts` (IndexedDB queue-item cleanup assertion).
Verified this is pre-existing/order-flaky and not caused by this task:
(a) it passes in isolation both before and after my changes, (b) `git stash`
+ isolated run on the unmodified tree also passes, (c) a clean rerun of the
full `pnpm test` suite afterward passed 244/244 files, 1476/1476 tests with no
failures. No files under `src/files/**` were touched by this task.

## Files changed

- `/home/nimo/NimoTech/.sp6/NimoOS-New-UI/src/storage/components/SnapshotPanel.vue` —
  added `advancedOpen`/`policyForm`/`fieldErrors`/`manualLabel` refs,
  `openAdvanced`/`cancelAdvanced`/`onSavePolicy`/`onCreateSnapshot`; replaced the
  two T4 placeholder comments with the advanced-form/manual-create template
  blocks; appended scoped CSS (all `var(--…)` tokens, verified `--num-font`,
  `--chip-bg-hi`, `--remove-fg`, `--chip-border`, `--chip-bg`, `--on-accent`
  all already exist in both theme blocks of `theme.css`).
- `/home/nimo/NimoTech/.sp6/NimoOS-New-UI/src/storage/components/SnapshotPanel.test.ts` —
  changed `patchPolicy: vi.fn()` / `create: vi.fn()` to named forwarding mocks
  (`patchPolicy`, `createSnap`), added default `beforeEach` resolutions
  (`patchPolicy.mockResolvedValue(null)`, `createSnap.mockResolvedValue(undefined)`),
  appended the two new `describe` blocks from brief Step 1 verbatim (8 new
  tests). All 11 pre-existing tests' assertions were left untouched.
- `/home/nimo/NimoTech/.sp6/NimoOS-New-UI/src/i18n/zh_cn.ts` — added 10 T4 keys
  (see below) before the closing brace, right after `snapPolicySummary`.
- `/home/nimo/NimoTech/.sp6/NimoOS-New-UI/src/i18n/en_us.ts` — same 10 keys,
  English copy from appendix A, in the same position.

## i18n keys added (verbatim from 附录 A, "T4" rows)

`snapAdvanced`, `snapHourlyKeep`, `snapDailyKeep`, `snapWeeklyKeep`,
`snapPauseThreshold`, `snapErrPositiveInt`, `snapErrPercent`, `snapSave`,
`snapCreateNow`, `snapLabelPlaceholder`.

**Count deviation note**: the task-4-brief.md header text says "9 个键" but
the actual appendix-A table (`docs/superpowers/plans/2026-07-27-vue3-migration-sp6-p5-snapshots.md`,
§附录 A) lists **10** rows tagged `T4`. Since none of the 10 existed yet in
either locale file (verified by grep before editing) and the brief itself
says the appendix table is authoritative ("完整文案表见「附录 A」"), all 10
were added. `storageCancel` (already existing, used for the "取消" button) was
reused, not duplicated — consistent with the global constraint.

## Self-review / deviations from Vue2

Compared against `NimoOS-UI/src/components/Storage/raid/SnapshotPanel.vue:46-85`
(template) and `:209-254` (script) line by line:

1. `openAdvanced` — reads `store.policy`, falls back to `24/7/4/90` via `??`,
   wraps each in `Number(...)` (Vue2 relies on the numbers already being
   numbers from the API; New-UI store's `policy` type is looser so `Number()`
   is a defensive no-op, not a behavior change), clears `fieldErrors`, opens.
   Matches Vue2 exactly.
2. `cancelAdvanced` — collapses + clears errors, does **not** touch
   `policyForm` (no revert-to-server-values write-back) — matches Vue2 exactly
   (test "取消 → 收起表单、错误清空、不发请求" verifies no `patchPolicy` call
   and no stale error on reopen).
3. `onSavePolicy` — validates locally first; on invalid, only sets
   `fieldErrors` and returns (no request sent, form stays open) — matches
   Vue2's `savePolicy` exactly. On valid, delegates to `store.savePolicy`
   (which owns the `policySaving` guard/toast/patchPolicy call — per Task 2's
   contract, not duplicated in the component) and only collapses the form if
   the store reports success. Vue2 does the guard/toast/request/collapse all
   inline in the component since there's no shared store there; New-UI's
   split is the same store-consolidation deviation already disclosed and
   pre-approved in the plan doc ("有意偏离 2").
4. `onCreateSnapshot` — delegates to `store.createSnapshot`, clears
   `manualLabel` only on success ("Vue2 同款:只有成功才清备注" — matches
   Vue2's `createSnapshot` where `this.manualLabel = ""` runs only inside the
   try block before the toast, i.e. only on success).
5. Numeric inputs — native `<input type="number" min=... [max=...]>` +
   `v-model.number` replacing `b-numberinput`; min/max values copied verbatim
   (hourly/daily/weekly `min=1`; pct `min=1 max=100`). This is the pre-approved
   "no new dependency" substitution (plan doc, Global Constraints), not a
   logic deviation.
6. Validation-error values are i18n keys (`snapErrPositiveInt`/`snapErrPercent`)
   instead of Vue2's raw English strings-as-keys — this is T1's pre-existing,
   pre-disclosed deviation (already committed in `snapshotView.ts`); T4 just
   consumes it via `t(fieldErrors.hourly_keep)` etc.
7. No Vue2 bugs found in the `:209-254` range that needed correcting for this
   task (the one known bug in this file — `savePolicy`'s `res.data?.data ||
   res.data` producing `undefined` in the summary — lives in T2's
   `store.savePolicy`, already fixed and disclosed in that task's commit).

No unrelated refactors were made; the three-state conditions, `.sp-switch`,
status/paused/kept rows, and the `<!-- 快照历史时间线:P5 T5 -->` placeholder
were left untouched.

## Commits

- `5114ed3` — `feat(storage): 快照保留策略高级表单+手动创建快照(P5 T4)`
