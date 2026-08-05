# Task 9 Report — StorageRaidDetail.vue 详情视图 + RaidMemberList.vue + 详情路由

## Implemented

- `src/storage/components/RaidMemberList.vue` — read-only member-disk list. `level===10` groups via `mirrorPairs()` into `.rml-pair` blocks (each containing `.rml-row`s); other levels render flat `.rml-row`s. Each row: `memberSquare(state)`-colored dot (inline `var(--token)`), `path`, `t(labelKey)` with fallback to the raw `state` string when `labelKey` is empty (unknown kind), and an optional `{rebuild_pct}%` badge. Locally widens the shared `RaidMemberDisk` type with an optional `rebuild_pct` field (`RaidMember = RaidMemberDisk & { rebuild_pct?: number }`) since the shared `@nimotech/nimoos-service` package doesn't declare it yet — done without touching that package.
- `src/views/StorageRaidDetail.vue` — wraps `<StorageShell>`. On mount: `store.loadRaid().then(() => store.loadRaidDetail(id))` (list first so name/level are known even on a fresh page load/deep link). 5000ms `useGuardedPoll` re-pulls `loadRaidDetail(id)`, gated on `flags.value.isRebuilding`. Renders:
  - Header: local "‹ RAID" back button (`router.push('/storage/raid')`), array name, `RAID {level}` pill, status pill reusing the `rc-badge`/severity class convention (duplicated locally since Vue scoped CSS doesn't leak across components).
  - Left column: usage donut (`conic-gradient(var(--accent) {pct}%, var(--nrm-bg) {pct}%)`, built as an inline style binding) + used/free legend, and a RAID-level-info card (`levelInfo(level)` → type/tolerance/read/write via `t(info.*Key)`; card omitted entirely when `levelInfo` returns `null`).
  - Right column: array-info table (device path, mount point, filesystem, UUID, chunk size, colored state, conditional rebuild finish/speed rows, conditional btrfs free-estimate + cached-at rows) and the member-disk card (title `raidMembers (n)` + `<RaidMemberList>`).
  - `<!-- 快照面板 P5 -->` boundary comment where Vue2 mounted `<snapshot-panel>` — no snapshot UI ported.
- `src/router/index.ts` — added `import StorageRaidDetail from '../views/StorageRaidDetail.vue'` and `{ path: '/storage/raid/:id', name: 'storage-raid-detail', component: StorageRaidDetail }` immediately after the `/storage/raid` list route.
- `src/i18n/zh_cn.ts` + `src/i18n/en_us.ts` — added all keys listed in the brief (see below), double-written.

## TDD evidence

**Step 1/2 — RaidMemberList**

RED:
```
$ pnpm exec vitest run src/storage/components/RaidMemberList.test.ts
Error: Failed to resolve import "./RaidMemberList.vue" ... Does the file exist?
Test Files  1 failed (1)
```

GREEN (after implementing `RaidMemberList.vue`):
```
$ pnpm exec vitest run src/storage/components/RaidMemberList.test.ts
Test Files  1 passed (1)
      Tests  3 passed (3)
```

**Step 4/5 — StorageRaidDetail**

RED:
```
$ pnpm exec vitest run src/views/StorageRaidDetail.test.ts
Error: Failed to resolve import "./StorageRaidDetail.vue" ... Does the file exist?
Test Files  1 failed (1)
```

GREEN (after implementing `StorageRaidDetail.vue` + router entry + i18n keys):
```
$ pnpm exec vitest run src/views/StorageRaidDetail.test.ts
Test Files  1 passed (1)
      Tests  2 passed (2)
```

**Step 6 — combined + parity + color-guard + tsc**
```
$ pnpm exec vitest run src/views/StorageRaidDetail.test.ts src/storage/components/RaidMemberList.test.ts src/i18n/parity.test.ts src/styles/color-guard.test.ts
Test Files  4 passed (4)
      Tests  120 passed (120)

$ pnpm exec vue-tsc --noEmit
(no output — zero type errors)
```

**Full suite (before commit)**
```
$ pnpm test
Test Files  234 passed (234)
      Tests  1360 passed (1360)
```

## Files changed

- Created: `src/views/StorageRaidDetail.vue`, `src/views/StorageRaidDetail.test.ts`
- Created: `src/storage/components/RaidMemberList.vue`, `src/storage/components/RaidMemberList.test.ts`
- Modified: `src/router/index.ts` (import + route), `src/i18n/zh_cn.ts`, `src/i18n/en_us.ts`

Commit: `86b4b29` — `feat(storage): RAID 详情视图(用量/级别/阵列信息/成员,无写操作+无快照)+ 详情路由` (branch `sp6-storage`).

## New i18n keys added (both locales)

Table/labels: `raidDetailDevicePath`, `raidDetailMountPoint`, `raidDetailFilesystem`, `raidDetailUuid`, `raidDetailChunk`, `raidDetailState`, `raidUsageUsed`, `raidUsageFree`, `raidLevelType`, `raidLevelTolerance`, `raidLevelRead`, `raidLevelWrite`, `raidMembers`, `raidBtrfsFreeEst`, `raidBtrfsCachedAt`.

Level-info keys (T2 placeholders, filled here): `raidLevel{0,1,5,6,10}{Tolerance,Read,Write,Desc}` — 20 keys total.

### Transcription sourcing (self-review requirement)

- `raidLevel{0,1,5,6}{Tolerance,Read,Write}` — verbatim from `NimoOS-UI/src/components/Storage/raid/RaidDetailPanel.vue` L267-290 (`levelFaultTolerance`/`levelReadSpeed`/`levelWriteSpeed` computed getters). English values used as-authored: `'None (0 disks)'`, `'n-1 disks'`, `'1 disk'`, `'2 disks'`, `'Excellent'`, `'Good'`, `'Moderate'`.
- `raidLevel10{Tolerance,Read,Write}` — RaidDetailPanel.vue has **no** level-10 branch (falls through to `'—'` there), so per the brief these were filled from `NimoOS-UI/src/utils/raidUtils.js` `RAID_LEVELS` (`id:10` entry, `tolerance:'half', read:5, write:4`):
  - `raidLevel10Tolerance`: `'Up to half the disks (1 per mirror pair)'` — this is a paraphrase of `toleranceText()`'s `'half'` branch template (`` `up to ${Math.floor(n/2)} (1 per pair)` ``) with the disk-count variable `n` dropped, since our i18n key is static (non-parametrized) unlike the per-array Vue2 computed text. Flagging this as a judgment call, not a literal string transcription — the raw template couldn't be transcribed verbatim because it requires a runtime `n`.
  - `raidLevel10Read` / `raidLevel10Write`: `'5 / 5'` / `'4 / 5'` — the raidUtils entry's `read`/`write` fields are themselves just 1–5 numeric ratings (rendered as dot/pip bars elsewhere in Vue2, e.g. `RaidCreateWizard.vue`/`RaidMatrix.vue` — there is no textual "Excellent/Good/Moderate" equivalent for level 10 anywhere in the Vue2 source), so these are transcribed as literal `"{n} / 5"` rating text rather than invented adjectives.
- `raidLevel{0,1,5,6,10}Desc` — `raidUtils.js`'s `desc` field is **itself** a placeholder string in the upstream source (e.g. `desc: 'RAID 0 Description'`), not real copy. Transcribed verbatim as `'RAID {n} Description'` for English; zh mirrors the same placeholder pattern as `'RAID {n} 说明'`. Not rendered anywhere in the UI (the level-info card only shows type/tolerance/read/write per the brief), kept only to satisfy `RAID_LEVEL_INFO.descKey` (T2) + i18n parity.

## Self-review

- **No write buttons**: `RaidMemberList.vue`/`StorageRaidDetail.vue` contain no recover/delete/replace-disk controls. Regression test (`不渲染写操作按钮…P4 边界`) asserts `.rd-recover`/`.rd-delete`/`.rd-replace` are absent — passing.
- **No snapshot panel**: only the `<!-- 快照面板 P5 -->` boundary comment is present in the left column where Vue2 mounted `<snapshot-panel>`; no snapshot markup/logic ported.
- **Zero color literals**: verified via `pnpm exec vitest run src/styles/color-guard.test.ts` (passing, scans both new `.vue` files) and a manual `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\('` over both new files (no matches). The donut uses `conic-gradient(var(--accent) {pct}%, var(--nrm-bg) {pct}%)` built as a JS template string bound via `:style`, so it's outside the guard's `<style>`-block scan but still 100% token-driven (no literal ever appears). Status/dot colors are all `var(--token)` via inline `:style` bindings (same pattern already used by `RaidCard.vue`/`RaidMemberList.vue`'s own dot).
- **i18n parity**: `pnpm exec vitest run src/i18n/parity.test.ts` passes — zh_cn/en_us key sets are identical, all en values non-empty strings.
- **Level-info values**: transcribed from the two named Vue2 sources per above; the two exceptions (level-10 tolerance's static paraphrase, and the read/write "x / 5" rating format) are explicitly documented above with the reasoning, since neither source had a verbatim string usable as-is for level 10.
- **Types**: `pnpm exec vue-tsc --noEmit` — zero errors. `RaidMemberDisk` was locally widened (not modified in the shared package) to carry an optional `rebuild_pct` field consumed by both the flat-row and mirror-pair branches.
- **Scope discipline**: no changes to `src/storage/stores/storage.ts`, `src/storage/util/raidView.ts`, `src/storage/components/StorageShell.vue`, `src/storage/components/RaidCard.vue`, or the shared `@nimotech/nimoos-service` package. Only the files listed in the brief's Scope section were touched.

## Concerns

- The `rc-badge`/severity CSS rules are duplicated (not shared) between `RaidCard.vue` and `StorageRaidDetail.vue`, because Vue `<style scoped>` doesn't cross component boundaries and the task scope forbade introducing a shared stylesheet/component change. If a future task wants a single source of truth for badge styling, extracting a small shared class (e.g. in `theme.css` or a tiny shared partial) would be a reasonable follow-up — flagging, not doing, since it's outside this task's scope.
- `raidLevel10{Tolerance,Read,Write}` and all five `*Desc` keys required judgment calls (documented above) because the two named Vue2 sources don't have literal, directly-portable strings for RAID 10 speed/tolerance text or for any level's description — the brief's own fallback instructions anticipated this gap.
- Per-task instructions, I did not run `pnpm build` / the 5273 visual acceptance pass / update `progress.md` or the long-term memory note — those are called out in the brief as the **post-all-9-tasks** wrap-up section, outside "Steps 1–7" which is what I was asked to execute for this task.

## Review fix (post-commit, 2026-07-23)

**Problem**: in the RAID Level Info card, `raidLevel10Read`/`raidLevel10Write` rendered raw numeric ratings (`'5 / 5'` / `'4 / 5'`, sourced from Vue2's `raidUtils.js`) while levels 0/1/5/6 rendered qualitative words (`Excellent`/`Good`/`Moderate`, sourced from Vue2's `RaidDetailPanel.vue`) — two vocabularies in the same table column. Vue2's `RaidDetailPanel.vue` itself has no level-10 branch in `levelReadSpeed`/`levelWriteSpeed` (falls through to blank), so blank/em-dash is the faithful behavior, not a numeric rating.

**Fix**: changed only the two *values* (keys unchanged) in both locale files:
- `src/i18n/zh_cn.ts`: `raidLevel10Read: '5 / 5'` → `'—'`, `raidLevel10Write: '4 / 5'` → `'—'`
- `src/i18n/en_us.ts`: same two values → `'—'`
`raidLevel10Tolerance`, `raidLevel10Desc`, and all other levels left untouched.

**Covering tests**:
```
$ pnpm exec vitest run src/i18n/parity.test.ts src/views/StorageRaidDetail.test.ts
Test Files  2 passed (2)
      Tests  5 passed (5)
```

**Type check**:
```
$ pnpm exec vue-tsc --noEmit
(no output — zero type errors)
```

Commit: `fix(storage): RAID10 读写速度显示 —(与其余级别定性文案列一致,对齐 Vue2 空值)` (branch `sp6-storage`).

## Whole-branch review fixes (post-commit, 2026-07-23)

Four small fixes applied per the final review pass.

**Fix 1 (Important) — hardened the P4 read-only boundary test**
`src/views/StorageRaidDetail.test.ts` previously asserted `.rd-recover`/`.rd-delete`/`.rd-replace` are absent — those class names never existed in the component, so the assertion was tautological (would never catch a future write button added under any other class/markup). Replaced with an observable invariant: total `<button>` count on the mounted detail view.

Empirically determined baseline: `StorageShell` renders `.st-home` (back-to-home) and `StorageRaidDetail` renders its own `.rd-back` (back-to-list); `RaidMemberList` renders no buttons — so the count is **2**. Confirmed by running the test (see below) before finalizing the assertion.

Replaced:
```ts
expect(w.find('.rd-recover').exists()).toBe(false)
expect(w.find('.rd-delete').exists()).toBe(false)
expect(w.find('.rd-replace').exists()).toBe(false)
```
with:
```ts
// P4 边界守卫:只读页只应有 2 个按钮(StorageShell 回主页 + rd-back 返回列表);新增任何写操作按钮(recover/delete/replace)会使计数上升而红
expect(w.findAll('button').length).toBe(2)
expect(w.find('.rd-back').exists()).toBe(true)
```

**Fix 2 (Minor) — removed dead i18n key**
`grep -rn "raidCapacity" src/` confirmed the key was referenced only inside `src/i18n/zh_cn.ts` and `src/i18n/en_us.ts` themselves (zero real usages). Removed the `raidCapacity` line from both files, keeping key-set parity.

**Fix 3 (Minor) — a11y parity on RaidCard usage bar**
`src/storage/components/RaidCard.vue`'s `.rc-track` lacked the ARIA attributes present on the mirrored `VolumeCard.vue`'s `.vc-track` (`role="progressbar" :aria-valuenow="..." aria-valuemin="0" aria-valuemax="100"`). Added the same attributes to `.rc-track`, wired to RaidCard's existing `pct` computed (the same value already driving the fill width). No test changes were needed — `RaidCard.test.ts`'s existing assertions still pass unmodified.

**Fix 4 (Minor) — documented the merge asymmetry**
`src/storage/stores/storage.ts`, `pollCreateTaskOnce`: added a one-line comment above the `mapTask({...})` merge call explaining that `name/level/filesystem/diskCount` are preserved from the prior task state across a sparse `getTask` payload, while `step/progress/error/elapsedSeconds` always take the backend's latest values (fall to `mapTask` defaults from `raw`, never held back). No logic change.

### Verification

Focused suite:
```
$ pnpm exec vitest run src/views/StorageRaidDetail.test.ts src/storage/components/RaidCard.test.ts src/i18n/parity.test.ts src/storage/stores/storage.test.ts src/styles/color-guard.test.ts
Test Files  5 passed (5)
      Tests  154 passed (154)
```

Type check:
```
$ pnpm exec vue-tsc --noEmit
(no output — zero type errors)
```

Full suite:
```
$ pnpm test   # first run
Test Files  1 failed | 233 passed (234)
      Tests  1 failed | 1359 passed (1360)
# failure: src/files/upload/persist.test.ts (unrelated IndexedDB test, not among the 6 files touched by this task)

$ pnpm exec vitest run src/files/upload/persist.test.ts   # isolation check
Test Files  1 passed (1)   # passes standalone

$ pnpm test   # rerun
Test Files  234 passed (234)
      Tests  1360 passed (1360)
```
The `persist.test.ts` failure was a pre-existing flaky test unrelated to the touched files (confirmed passing both in isolation and on a clean rerun of the full suite) — not a regression from these fixes.

Commit: `402ea6d` — `fix(storage): P3 终审修正(硬化只读边界按钮计数守卫 + 删 dead raidCapacity 键 + RaidCard 进度条 a11y + 合并注释)` (branch `sp6-storage`).
