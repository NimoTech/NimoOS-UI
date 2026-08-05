# Task 3 Report: 快照面板三态骨架 + 保护开关(`SnapshotPanel.vue`)

## Files changed

- Create: `src/storage/components/SnapshotPanel.vue`
- Create: `src/storage/components/SnapshotPanel.test.ts`
- Modify: `src/i18n/zh_cn.ts` (+9 lines: 8 new keys + trailing brace context)
- Modify: `src/i18n/en_us.ts` (+9 lines, same)

## TDD evidence

### RED (Step 2)

Wrote `src/storage/components/SnapshotPanel.test.ts` verbatim from brief Step 1 (before creating the component).

```
$ pnpm exec vitest run src/storage/components/SnapshotPanel.test.ts
FAIL  src/storage/components/SnapshotPanel.test.ts [ src/storage/components/SnapshotPanel.test.ts ]
Error: Failed to resolve import "./SnapshotPanel.vue" from "src/storage/components/SnapshotPanel.test.ts". Does the file exist?
Test Files  1 failed (1)
```

Confirmed FAIL for the expected reason (component not yet created).

### GREEN (Step 4)

Implemented `SnapshotPanel.vue` per brief Step 3 (one deviation, see below), added the 8 i18n keys to both locale files (verbatim from task-7-brief.md 附录 A, T3 rows).

```
$ pnpm exec vitest run src/storage/components/SnapshotPanel.test.ts
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

```
$ pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts
 Test Files  2 passed (2)
      Tests  122 passed (122)
```

```
$ pnpm exec vue-tsc --noEmit
(no output — zero errors)
```

### Full suite (pre-commit)

```
$ pnpm test
 Test Files  244 passed (244)
      Tests  1467 passed (1467)
```

## Deviation from brief / Vue2

**1. `aria-checked` binding: `:aria-checked="store.volume?.enabled === true"` instead of the brief's `:aria-checked="String(store.volume?.enabled === true)"`.**

Justification: `pnpm exec vue-tsc --noEmit` failed on the brief's literal code with:
```
src/storage/components/SnapshotPanel.vue(63,12): error TS2322: Type 'string' is not assignable to type 'Booleanish | "mixed" | undefined'.
```
Vue's DOM attribute types for ARIA `aria-checked` require `Booleanish` (`boolean | 'true' | 'false'`), not an arbitrary `string`. Wrapping the boolean in `String(...)` produces a `string`-typed value that TS strict rejects. Binding the boolean expression directly is both type-correct and behaviorally identical: Vue serializes a bound boolean attribute to the literal DOM attribute string `"true"`/`"false"` (confirmed by the existing house pattern `src/home/components/ThemeToggle.vue:18` — `:aria-checked="theme.theme === opt"` with no `String()` wrapper — and by the test asserting `.attributes('aria-checked')).toBe('true'|'false')`, which passes unchanged). No semantic difference; pure type-strictness fix, not a logic change or a "task interpretation" deviation.

No other deviations. 三态可见性条件、状态文案取值分支(`count===0 && !last_at` → 暂无快照;否则 n/time,`last_at` 空时「从未」)、暂停行前缀 ⚠️、保留承诺行的两处触发条件(`enabled` 恒出;`disabled && count>0` 追加一次)、策略摘要格式、state watcher(仅在转为 `enabled` 且原值非 `enabled` 时拉一次策略,`mounted` 只调 `loadVolume`)均逐字对照 Vue2 `NimoOS-UI/src/components/Storage/raid/SnapshotPanel.vue:1-105,107-257` 实现,未发现需要"不照抄"的 Vue2 bug。

T4/T5 占位注释（高级设置按钮+表单、手动创建快照行、快照历史时间线）已按 brief 原样保留在模板中。

## Self-review

- Class contract: `.sp-card` `.sp-switch` `.sp-unsupported` `.sp-status` `.sp-paused` `.sp-kept` `.sp-policy-summary` all present verbatim; `.sp-advanced-btn` correctly deferred to T4 (not yet rendered).
- No `#hex`/`rgb()`/named colors introduced — all colors via existing tokens (`--card-bg`, `--card-border`, `--radius-sm`, `--fg-muted`, `--fg`, `--dem-fg`, `--chip-border`, `--chip-bg`, `--accent`, `--on-accent`, `--ease`), all of which already exist in `src/styles/theme.css` with both light/dark values — `color-guard.test.ts` passes.
- No new toast/`console.warn` in the component — all error handling and toasting remain in the T2 store, per constraint.
- `defineOptions({ name: 'SnapshotPanel' })` present for future `findComponent({ name })` lookups (T5/T7).
- No third-party switch primitive — hand-rolled `<button role="switch">` with `aria-checked`, no new dependency.
- `src/storage/stores/snapshot.ts` untouched.
- No `Array.prototype.at()` used.
- i18n keys added to both `zh_cn.ts` and `en_us.ts`, copied verbatim from task-7-brief.md 附录 A T3 rows (double-checked character-for-character against the table, including the `·` separators and punctuation).

## Commit

```
git add src/storage/components/SnapshotPanel.vue src/storage/components/SnapshotPanel.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(storage): 快照面板三态骨架+保护开关(P5 T3)"
```

## Fix round 1/5 — a11y regression (Important finding)

**Finding**: `<button role="switch">` at `SnapshotPanel.vue:59-67` had no accessible name. Vue2's `b-switch` wraps its label text so it's inherently associated with the control; the New-UI hand-rolled switch only has `<span class="sp-key">{{ t('snapTitle') }}</span>` as a sibling with no ARIA relationship — a functional a11y regression versus Vue2 (screen reader would announce "switch, not checked" with no label).

**Fix chosen**: added `:aria-label="t('snapTitle')"` directly on the `<button>` (the minimal-change option from the two offered), rather than `aria-labelledby` + `id` on `.sp-key`.

**Reasoning for choosing `aria-label` over `aria-labelledby`**: the visible sibling `.sp-key` text and the accessible name need to say the exact same thing (`snapTitle`, "快照保护") in every state this switch appears in — there's no case where they'd diverge, so wiring an `id`/`aria-labelledby` indirection buys nothing here and adds a stable-`id` surface that later tasks (T4's advanced form sits in the same card) would need to keep unique. A direct `aria-label` with the same i18n key is simpler, has an identical accessible-name result, and doesn't introduce a new DOM id contract. This also keeps the diff to the single line the coordinator asked to isolate — no other lines in the template/class contract changed.

**Test added** (`SnapshotPanel.test.ts`, in `SnapshotPanel 三态` describe block, right after the "已关闭态" test):
```ts
it('开关有可访问名称(aria-label),不依赖旁边 .sp-key 的兄弟节点关系', async () => {
  listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
  const w = mountPanel(); await flush(w)
  expect(w.find('.sp-switch').attributes('aria-label')).toBe(zh.snapTitle)
})
```
Verified this is a real regression-catching assertion, not tautological: temporarily removed the `:aria-label` binding from the component and reran — the new test failed as expected (`expected undefined to be '快照保护'`), all 10 other tests still passed. Then restored the fix and reran — 11/11 pass.

**Commands run**:
```
$ pnpm exec vitest run src/storage/components/SnapshotPanel.test.ts   # before fix (aria-label removed)
 Tests  1 failed | 10 passed (11)
 FAIL  ... 开关有可访问名称... AssertionError: expected undefined to be '快照保护'

$ pnpm exec vitest run src/storage/components/SnapshotPanel.test.ts   # after fix restored
 Test Files  1 passed (1)
      Tests  11 passed (11)

$ pnpm exec vue-tsc --noEmit
(no output — zero errors)
```

No other files touched (class contract, three-state conditions, i18n copy all untouched, per coordinator's instruction).

**Deferred (Minor, tracked by coordinator, not addressed this round)**: no dedicated test exercises the `disabled → enabled` toggle path triggering `loadPolicy` (only the initial-mount-already-`enabled` path is covered by the existing "已启用态" test's `getPolicy` assertion).
