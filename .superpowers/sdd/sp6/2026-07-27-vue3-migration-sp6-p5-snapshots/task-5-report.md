# Task 5 Report: SnapshotTimeline.vue + 嵌入面板

## TDD evidence

### RED (Step 2)

Command:
```
pnpm exec vitest run src/storage/components/SnapshotTimeline.test.ts src/storage/components/SnapshotPanel.test.ts
```
Result: `SnapshotTimeline.test.ts` failed to resolve (`SnapshotTimeline.vue` did not exist yet — `Failed to resolve import "./SnapshotTimeline.vue"`), and 2 new `SnapshotPanel.test.ts` assertions failed (`findComponent({ name: 'SnapshotTimeline' })` → `false` in both the "enabled" and "disabled-with-history" cases). 20 pre-existing SnapshotPanel tests still passed untouched.

### GREEN (Step 4)

```
pnpm exec vitest run src/storage/components/
```
→ 17 files / 106 tests passed.

```
pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts
```
→ 2 files / 123 tests passed.

```
pnpm exec vue-tsc --noEmit
```
→ zero errors (no output).

### Full suite (pre-commit)

```
pnpm test
```
→ 245 files / 1488 tests passed, including `src/files/upload/persist.test.ts` (no flake this run — nothing needed a separate rerun).

## Files changed

- Created: `src/storage/components/SnapshotTimeline.vue`
- Created: `src/storage/components/SnapshotTimeline.test.ts`
- Modified: `src/storage/components/SnapshotPanel.vue` (import + mount `<SnapshotTimeline>` behind the 1:1 visibility condition, replacing the `<!-- 快照历史时间线:P5 T5 -->` placeholder)
- Modified: `src/storage/components/SnapshotPanel.test.ts` (appended the 3-test visibility `describe` block from the brief, verbatim)
- Modified: `src/i18n/zh_cn.ts`, `src/i18n/en_us.ts` (added the T5-tagged i18n keys)

## Implementation notes

Implemented exactly the code given in the brief's Step 3 (both `SnapshotTimeline.vue` and the `SnapshotPanel.vue` splice), which is itself a byte-for-byte port of Vue2 `NimoOS-UI/src/components/Storage/raid/SnapshotTimeline.vue` template/logic (`:1-50`, `:52-179`) minus the `[Browse]`/`[Delete]` action buttons (left as a placeholder comment, per this task's scope and the recorded decision) and with literal colors replaced by theme tokens per the mapping table in Global Constraints:

- `auto` → `--nrm-fg` (dot/text) / `--nrm-bg` (badge bg)
- `manual` → `--accent` (dot/text) / `--accent-soft` (badge bg)
- `preop` → `--dem-fg` (dot/text) / `--dem-bg` (badge bg)
- skeleton shimmer gradient → `--skeleton-bg` / `--nrm-bg`
- structural colors (`--card-border`, `--card-bg`, `--fg`, `--fg-muted`, `--hover`, `--ease`, `--num-font`) reused from the existing theme, same as `SnapshotPanel.vue`.

Class contract implemented verbatim: `.st`, `.st-skeleton`, `.st-empty`, `.st-group-header`, `.st-group-label`, `.st-group-count`, `.st-item`, `.st-dot` (+ `.auto|.manual|.preop`), `.st-badge`, `.st-time`, `.st-label`. `defineOptions({ name: 'SnapshotTimeline' })` present so `SnapshotPanel.test.ts` can locate it via `findComponent({ name })`.

Vue2 1:1 alignment points preserved:
- `mounted` fetch; `volumeUuid` watcher resets `expandInitialized`/`expandedKeys` and refetches (Vue2 `:92-104`).
- `expandInitialized` gate: default-expand keys are computed from `defaultExpandedDayKeys` only the first time the `groups` computed becomes non-empty; later refreshes never overwrite the user's manual collapse/expand choices (Vue2 `:111-114`).
- Group header: chevron (rotates 90° open) + name (`i18nKey ? t(key) : text`) + right-aligned count.
- Item `:key` = `item.id != null ? item.id : item.name` (Vue2 `:26`).
- `.st-actions` hover-reveal uses `opacity`/`pointer-events` transition, never `display: none`, so the (currently empty) action area stays tabbable (Vue2 comment `:339-341`).
- Panel visibility condition: `state === 'enabled' || (state === 'disabled' && (store.volume?.count ?? 0) > 0)` — copied 1:1 from Vue2 `SnapshotPanel.vue:99-102` semantics (also matches the pre-existing `.sp-kept` row's own condition in this codebase's `SnapshotPanel.vue:163`).

No `useToast()` or `console.warn` added inside the component — `loadSnapshots` (store, T2) already owns all error handling/logging for this data path.

## i18n

Added the 7 rows tagged `T5` in task-7-brief.md's Appendix A (`snapHistory`, `snapEmptyHint`, `snapToday`, `snapYesterday`, `snapTypeAuto`, `snapTypeManual`, `snapTypePreop`) to both `zh_cn.ts` and `en_us.ts`, copied character-for-character from the table. `snapNoneYet` (used in the empty state) already existed from Task 3/4 and was not touched.

**Deviation/note**: this task's brief text says "附录 A 标「T5」的 6 个键", but the actual Appendix A table in `task-7-brief.md` has 7 rows tagged `T5`. Per the precedent set in Task 4's report (which found the same off-by-N discrepancy and treated the appendix table as authoritative), I added all 7 rows rather than guessing which one to drop — omitting any one of them would have broken either the empty-state hint, the day labels, or the badge labels, all of which the Step 1 tests exercise. `parity.test.ts` and `color-guard.test.ts` both still pass with all 7 present.

## Self-review

- Confirmed no `#hex`/`rgb(`/`rgba(` literals were added in `SnapshotTimeline.vue` (`grep` clean).
- Confirmed no `console.*` or `useToast()` calls added in `SnapshotTimeline.vue`.
- Confirmed `.st-browse` does not exist anywhere in the new component or its render output (locked by the dedicated negative test, which passes).
- Confirmed none of the 19 pre-existing `SnapshotPanel.test.ts` assertions were weakened — only a new `describe` block was appended; the file's prior 19 tests are unchanged and still pass (now 22 tests total including the 3 new ones).
- No unrelated refactors were made to `SnapshotPanel.vue` beyond the single import line and the placeholder-comment replacement.

## Deviations from Vue2

1. **`[Browse]`/`[Delete]` action buttons omitted, `.st-actions` left empty with an explanatory comment.** Per the plan's binding decision (see task brief + P5 ledger): `[Browse]` jumps into the Files-area read-only snapshot browsing suite (banner/write-disable/exit), which was never migrated in SP4 and is deferred to its own future period; `[Delete]` is explicitly scoped to Task 6. This is the task's stated scope, not an unplanned cut.
2. **Colors converted from Vue2 hex literals to theme tokens** per the Global Constraints' mandatory mapping table (`auto`→`--nrm-fg`/`--nrm-bg`, `manual`→`--accent`/`--accent-soft`, `preop`→`--dem-fg`/`--dem-bg`, skeleton→`--skeleton-bg`/`--nrm-bg`). Required by this repo's theming rule, not a discretionary change.
3. **No `<transition name="snapshot-timeline-collapse">` wrapper around the expanded `<ul>`.** Vue2 wraps the list in a Vue-transition for a fade/slide-up on expand/collapse. The brief's Step 3 code (which is the authoritative implementation spec for this task) omits it, and none of the Step 1 tests assert on it. Kept as specified — flagging in case a follow-up task wants the enter/leave animation added back.
4. **7 i18n keys added instead of the "6" stated in this task's brief prose** — see the i18n section above; the Appendix A table (marked authoritative in Task 4's precedent) lists 7 `T5` rows and all are used by the component/tests.

No other deviations. Implementation follows the brief's Step 3 code and the Vue2 source 1:1 for everything in scope.

---

## Fix round 1/5 (quality review)

Two items came back from review; both addressed.

### 1. Hardened the "换卷" regression test (test gap)

**Problem**: the original test only asserted `listMock` was called with the new uuid — it never checked that the expand state actually reset, so deleting `expandInitialized = false` / `expandedKeys.value = []` from the implementation would not turn it red.

**Fix**: rewrote `src/storage/components/SnapshotTimeline.test.ts`'s "换卷" test (renamed to `换卷 → 重置展开态并重拉(不沿用旧卷的展开集合)`):
- Old volume (`u1`) gets a single snapshot dated `2026-07-15` (a day key that cannot coincide with the new volume's dates), which the component auto-expands.
- New volume (`u2`) gets a 4-item / 3-day-group list (2 + 1 + 1 items), identical in shape to the existing grouping test, so "default-expand top 2 groups" has an unambiguous, checkable result: 3 visible `.st-item` (2 from the newest group + 1 from the second), third group collapsed.
- After `setProps({ volumeUuid: 'u2' })`, asserts `.st-group-header` length is 3 and `.st-item` length is exactly 3 — i.e., the new volume renders its own default-expand result, not the old volume's stale expand set.

Why this is a real regression lock: if the reset lines are removed, `expandInitialized` stays `true` and `expandedKeys` stays `['2026-07-15']` from the old volume. That key does not exist in the new volume's day groups (`2026-07-27`/`2026-07-26`/`2026-07-20`), so every new group would render collapsed (0 visible items) instead of the new volume's own default-expand result (3 items) — a clean, unambiguous failure signature, not a coincidental pass.

**Self-check performed per instructions**: commented out both reset lines (`expandInitialized = false` / `expandedKeys.value = []`) in `SnapshotTimeline.vue`'s `volumeUuid` watcher, reran `pnpm exec vitest run src/storage/components/SnapshotTimeline.test.ts`:

```
❯ src/storage/components/SnapshotTimeline.test.ts (8 tests | 1 failed)
  × 换卷 → 重置展开态并重拉(不沿用旧卷的展开集合)
AssertionError: expected [] to have a length of 3 but got +0
```

Confirmed the new test goes red exactly as expected (0 items instead of 3) — the other 7 tests were unaffected. Then restored both lines; reran the same command → all 8 tests pass again.

### 2. Restored the Vue2 collapse/expand `<transition>` (1:1 gap)

**Problem**: Vue2 `SnapshotTimeline.vue:24,46,353-361` wraps the expanded `<ul>` in `<transition name="snapshot-timeline-collapse">` (0.15s opacity + `translateY(-4px)` enter/leave). The brief's Step 3 sample code omitted this, and per the plan's top-priority "界面严格 1:1 照 Vue2" constraint, review asked for it to be restored (not treated as an accepted Vue2 omission).

**Fix**: in `SnapshotTimeline.vue`:
- Wrapped the `<ul class="st-list">` in `<transition name="st-collapse">` (kept the `.st-` component-prefix naming convention already used throughout this file for non-contract classes; the transition name is implementation detail, not part of the stable class contract).
- Added the enter/leave CSS, **written in Vue 3 transition-class semantics, not Vue 2's**: Vue 2 uses `-enter`/`-leave-to`; Vue 3 renamed the "starting" class to `-enter-from` (leave direction `-leave-to` and both `-active` classes are unchanged between versions). Used `.st-collapse-enter-active`/`.st-collapse-leave-active` for the transition property, and `.st-collapse-enter-from`/`.st-collapse-leave-to` for the offset state — duration (0.15s) and displacement (opacity 0 + `translateY(-4px)`) copied verbatim from Vue2, no color values involved so no token substitution was needed.

**Regression check**: reran `src/storage/components/SnapshotTimeline.test.ts` and `src/storage/components/SnapshotPanel.test.ts` after adding the transition — all pre-existing tests (including "点组头折叠/展开切换", which toggles the group open/closed and asserts `.st-item` counts synchronously after `trigger('click')`) passed with **no extra `await nextTick()` needed** — jsdom resolves Vue's zero-duration CSS transition synchronously within the existing `await` in the test, so no assertion had to be weakened or additional waits inserted.

### Commands run (this fix round)

```
pnpm exec vitest run src/storage/components/SnapshotTimeline.test.ts src/storage/components/SnapshotPanel.test.ts
# → 2 files / 30 tests passed

pnpm exec vitest run src/styles/color-guard.test.ts src/i18n/parity.test.ts
# → 2 files / 123 tests passed

pnpm exec vue-tsc --noEmit
# → zero errors

pnpm test
# → 245 files / 1488 tests passed (full suite, no flake)
```

### Files touched (this fix round)

- `src/storage/components/SnapshotTimeline.vue` — added `<transition name="st-collapse">` wrapper + enter/leave CSS.
- `src/storage/components/SnapshotTimeline.test.ts` — hardened the "换卷" test into a real regression assertion (renders + counts, not just the mock call).

### Items deferred (per coordinator's ledger, not touched this round)

1. `.st-browse` negative assertion considered weak — logged, out of scope for this round.
2. Group-header `<button>` has no `aria-expanded` — Vue2 doesn't have it either, kept 1:1.
3. Appendix A actually lists 7 `T5` keys, not the "6" in the brief prose — brief typo, already handled correctly in the original implementation.
