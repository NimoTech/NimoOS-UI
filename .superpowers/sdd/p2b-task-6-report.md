# SP8-P2b Task 6 report — MemorySection (AI 记忆) + D5

## Files

New-UI (branch `sp8-ai`, commit `e8f8564`):
- `src/ai/components/settings/sections/MemorySection.vue` (new, 205 lines)
- `src/ai/components/settings/sections/MemorySection.test.ts` (new, 24 tests)
- `src/ai/util/memoryLabels.ts` (new — extracted pure fns, see deviation note below)
- `src/ai/util/memoryLabels.test.ts` (new, 4 tests)
- `src/i18n/zh_cn.ts`, `src/i18n/en_us.ts` (append-only, staged via `p2b-stage-i18n.sh`)

Service (branch `sp8-ai`, commit `c8f1919`):
- `src/ai.ts` — `putMemorySettings` payload type: `context_window?: number` → `context_window?: number | null`

**Deviation from the literal "commit must contain exactly 4 files" instruction:** I included
`src/ai/util/memoryLabels.ts` + `.test.ts` in the commit (6 files total, not 4). Reason: the
brief's Step 2 (#14) explicitly requires extracting `kindLabel`/`sourceLabel` into a separate
module ("选后者" — chose the util-file option over an inline non-setup `<script>` block) and
explicitly says to add it to "本任务文件清单" (this task's file list). `MemorySection.vue`
imports from it — omitting it would leave an unbuildable component. Declaring this explicitly
as requested.

Skipped per standing order: `SettingsPage.vue` / `SettingsPage.test.ts` wiring — not opened,
not touched.

## Vue2 → New-UI mapping

| Vue2 (`MemorySection.vue`) | New-UI |
|---|---|
| `:1-70` template | `<template>` block, same structure/classes (`set-inner` → `sk-section` ×2 → `set-rows`/`set-row`, `mem-row`/`mem-body`/`mem-tags`) |
| `:78-79` `KIND_LABELS`/`SOURCE_LABELS` | `src/ai/util/memoryLabels.ts` `KIND_LABEL_KEYS`/`SOURCE_LABEL_KEYS` (values are now i18n keys, not literal English strings) |
| `:84-93` `data()` | component-local `ref`s (D2: no Pinia store, matches Vue2's local-data scope) |
| `:98-99` `kindLabel`/`sourceLabel` | `memoryLabels.ts` exported functions |
| `:100-114` `load()` | `load()`, `!!s.enabled` added (logic fix 1, declared) |
| `:115-125` `saveEnabled()` | `saveEnabled()` + danger toast on failure (logic fix 2, declared) |
| `:126-136` `saveCompaction()` | `saveCompaction()` + danger toast on failure (logic fix 2) |
| `:137-148` `saveContextWindow()` | `saveContextWindow()`, snapshot-before-await preserved verbatim, + danger toast (logic fix 2) |
| `:149-156` `remove()` | `remove()`, "keep on failure" behavior preserved, + danger toast (logic fix 2) |

No `<style>` block added — all classes used (`set-banner.warn`, `set-note`, `mem-row`,
`mem-body`, `mem-text`, `mem-tags`, `mem-tag`, `mem-tag.recall`, `mem-tag[data-k]`,
`mem-del`, `sk-section-hint`, `set-rows`, `set-row`, `set-input.num`, `set-actions`)
already existed in `src/ai/styles/settings-styles.scss` / `sk-shared.scss` — grepped and
confirmed before use.

## Payload shape per save path

All three save paths (`saveEnabled`, `saveCompaction`, `saveContextWindow`) call the shared
`payload()` helper and send **all three keys every time**:
```
{ enabled: <bool>, compaction_enabled: <bool>, context_window: <number|null> }
```
This matches Vue2 (`MemorySection.vue:117-121/128-132/140-144` — three near-identical
literal object bodies) and is required by the verified fact that `putMemorySettings` always
sends all three keys server-side (unset → `undefined`). No read-then-merge was needed
because the component already tracks all three fields as local state at all times.

## Vue2 test carry-over (13 assertions, 0 dropped)

Driven by `mount()` + `vi.hoisted()` service mock instead of `Methods.x.call(ctx)` (no
`methods` object in `<script setup>`).

| # | Vue2 assertion | New-UI test |
|---|---|---|
| 1 | load fills settings+memories | `'load() 用后端数据填充设置与记忆列表'` |
| 2 | load fills compaction/context_window | `'load() 填充 compaction_enabled 与 context_window'` |
| 3 | load defaults false/empty when absent | `'load() 缺 compaction_enabled/context_window 时归一为关闭/空串'` |
| 4 | load sets error on failure | `'load() 失败时显示「加载记忆失败。」且无 loading'` |
| 5 | remove deletes + drops item | `'remove() 调 deleteUserMemory 并从列表移除该行'` |
| 6 | remove keeps item on failure | `'remove() 失败时保留该行'` |
| 7 | saveEnabled reverts on failure | `'saveEnabled() 失败时把开关翻回去'` |
| 8 | saveEnabled sends 3 fields | `'saveEnabled() 调 putMemorySettings 时三个字段齐全'` |
| 9 | saveCompaction payload incl. context_window:null | `'saveCompaction() 调 putMemorySettings 时 payload 含 compaction_enabled 与 context_window:null'` |
| 10 | saveCompaction reverts on failure | `'saveCompaction() 失败时把压缩开关翻回去'` |
| 11 | saveContextWindow sends number | `'saveContextWindow() 把输入值当数字发送'` |
| 12 | saveContextWindow sends null when blank (**the D5 origin**) | `'saveContextWindow() 留空时发送 context_window:null'` |
| 13 | saveContextWindow reverts to pre-await snapshot | `'saveContextWindow() 失败时回到发请求前的快照值(而不是当前值)'` |
| 14 | kindLabel/sourceLabel map + passthrough | moved to `memoryLabels.test.ts` (3 tests, values now i18n keys not literal English) |

New tests (6, this period's new behavior): off-banner shown/hidden (2 tests, #15 + control),
saveEnabled/saveCompaction/saveContextWindow/remove failure → danger toast (4 tests, #16-19),
localized tag rendering incl. `recall_count` missing → 0 (#20). Total: 20 tests in
`MemorySection.test.ts` + 4 in `memoryLabels.test.ts` = 24.

## Declared deviations (logic fixes)

1. **`enabled.value = !!s.enabled`** (component, `load()`) vs. Vue2's bare `this.enabled =
   s.enabled` (`MemorySection.vue:105`). If the backend omits `enabled`, Vue2 stores
   `undefined` — `SetSwitch` renders it as off, but the next save round-trips `undefined`
   back to the server, which then treats it as "unchanged" — a reproducible correctness bug.
   Normalized with `!!`. Vue2 test #1 mocks `{enabled:false}`, so this doesn't change that
   assertion's outcome.
2. **danger toast added to `saveEnabled`/`saveCompaction`/`saveContextWindow`/`remove`
   failure paths.** Vue2 (`:122-124`, `:133-135`, `:145-147`, `:153-155`) silently reverts
   (or, for `remove`, silently keeps the item) with no user feedback. Unlike
   `BlacklistSection`'s mount-time silent catch (justified there because 5 sections mount
   concurrently and would flood toasts), these are single, user-initiated save/delete
   actions — silent failure would make the user believe the action succeeded when it did
   not. Declared per migration-discipline rule; ledger note is the human's to add.

## D5 — Service change, rebuild, resync evidence

`src/ai.ts:518-529` (NimoOS-Service, commit `c8f1919`):
```ts
async putMemorySettings(payload: {
  enabled?: boolean
  compaction_enabled?: boolean
  /** null = automatic (backend infers from the model's limit). ... */
  context_window?: number | null
}): Promise<unknown> { ... }
```
No cast added at any call site (component's `payload()` returns `context_window:
<number|null>` natively — no `as unknown as number` laundering).

- `cd NimoOS-Service && pnpm build` → `tsc -p tsconfig.json` succeeded, no errors.
- Committed alone: `git status --porcelain` before commit showed only `M src/ai.ts`;
  `dist/` confirmed **not tracked** (`git ls-files dist/` empty) — nothing added for it.
- Back in New-UI: `pnpm install` re-synced the `file:` link (resolved 446, added 1 pkg).
  **Note per instructions: this `pnpm install` run can perturb a concurrently-running
  session's in-progress test runs — recorded as required, no corrective action taken.**
- Verified: `grep -n "context_window" node_modules/@nimotech/nimoos-service/dist/ai.d.ts`
  → `context_window?: number | null;` (line 122).

## i18n keys — reused vs added

Reused (values already present and identical, confirmed via `git show HEAD:src/i18n/*.ts`
+ working-tree grep before writing):
- `aiCfgMemory` ('记忆' / 'AI memory') — brief explicitly says reuse (P2a's SettingsPage nav key)
- `aiCfgSaveFailed` ('保存失败' / 'Save failed') — used for all toast fallbacks, already added by Task 5 (ExecutionSection)
- `aiCfgLoadingEllipsis` ('加载中…' / 'Loading…') — found already present (not flagged as "existing" in the brief's table, but a duplicate grep hit — reused instead of re-adding to avoid a TS duplicate-property error)

Added (19 new keys, wrapped in `// >>> SP8-P2b Task 6 —— MemorySection(AI 记忆)` … `// <<<
SP8-P2b Task 6`, appended at the very end of both files before the closing `}`):
`aiCfgMemoryDesc`, `aiCfgCrossSessionMemory`, `aiCfgMemoryOffBanner`, `aiCfgEnableMemory`,
`aiCfgEnableMemorySub`, `aiCfgContextCompaction`, `aiCfgContextWindow`,
`aiCfgAutoPlaceholder`, `aiCfgSavedMemories`, `aiCfgMemoryLoadFailed`, `aiCfgNoMemories`,
`aiCfgRecalledTimes`, `aiCfgDeleteMemory`, `aiCfgMemKindPreference`, `aiCfgMemKindFact`,
`aiCfgMemKindGoal`, `aiCfgMemSourceAuto`, `aiCfgMemSourceTool`, `aiCfgMemSourceUser`.

All values copied verbatim from the brief's table (zh_cn / en_us columns), no
re-translation. `aiCfgMemSourceTool` ('已保存'/'Saved') kept as a separate key from
`aiCfgSaved` ('已保存'/'Saved') per the brief's explicit warning — not merged; a
one-line comment in both files documents why.

No literal `@` appears in any added value — `messageSyntax.test.ts` escape rule not
triggered.

Every `t('…')` key the component uses was confirmed present either in `git show
HEAD:src/i18n/{zh_cn,en_us}.ts` (pre-existing: `aiCfgMemory`, `aiCfgSaveFailed`,
`aiCfgLoadingEllipsis`) or inside my own Task 6 marker block, before committing.

## How i18n was staged

Ran `.superpowers/sdd/p2b-stage-i18n.sh --check` first — confirmed the diff it would stage
was *exactly* my new Task 6 block on top of current `HEAD` (nothing from the other session's
in-flight edits leaked in). Then ran `.superpowers/sdd/p2b-stage-i18n.sh` (no args) to write
the index. Never ran `git add` on the i18n files. After the commit, `git status --porcelain`
was clean — this is because, by commit time, the concurrent P2a session had already landed
its own in-flight edits as real commits (`7a1c71f`, `fe235b0`) ahead of where I started, so
there was no residual to leave dirty; this is expected/benign, not something I caused or need
to revert.

## RED → GREEN evidence

RED: `pnpm test src/ai/util/memoryLabels.test.ts src/ai/components/settings/sections/MemorySection.test.ts`
before `MemorySection.vue` existed →
`Error: Failed to resolve import "./MemorySection.vue" ... Does the file exist?`
(memoryLabels.test.ts: 4 passed; MemorySection.test.ts: 0 tests, suite failed to load).

GREEN: after implementing `MemorySection.vue`, same command → `Test Files 2 passed (2)`,
`Tests 24 passed (24)`.

## Final full-suite numbers (post-commit, at HEAD `e8f8564`)

- `pnpm test`: **276 files / 2148 tests passed**, 0 failed. No `persist.test.ts` IndexedDB
  flake observed this run (ran once, all green — noting per instructions in case it
  recurs for a reviewer).
- `pnpm exec vue-tsc --noEmit`: clean, no output/errors.
- `pnpm build`: succeeded (`✓ built in 22.15s`), only the pre-existing "chunks larger than
  500kB" advisory (unrelated to this task, pre-existing in the build).

All 2148 tests / 276 files are attributable either to this task (24 new: 20 + 4) or to
prior committed work (BlacklistSection/ExecutionSection/ModelsSection/ProvidersSection/etc.
from Tasks 1-5 and the concurrent P2a session, all pre-existing and unmodified by me).

## Commits

- New-UI (`sp8-ai`): `e8f8564` — "SP8-P2b Task 6: MemorySection(AI 记忆,承接 Vue2 13 例 + 补失败提示)"
- NimoOS-Service (`sp8-ai`): `c8f1919` — "fix(ai): putMemorySettings 的 context_window 接受 null(自动)"
