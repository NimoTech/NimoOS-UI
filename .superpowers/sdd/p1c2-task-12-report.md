# P1c2 Task 12 — ResourcesTab report

## Commit note (transient race, self-resolved)
Working in this shared worktree, a concurrent agent's commit (`a319476`,
unrelated `toStoragePayload`/`SystemTab.test.ts`/`AgentPage.test.ts` fix)
briefly landed between my `git add` and `git commit` and swept up my staged
files too (likely `git add -A`). I verified byte-for-byte that my files were
present, untouched, inside that commit. Before I took any corrective action,
the other agent amended their own commit (`a319476` → `2e1562d`) to drop my
files back out, restoring them to untracked/modified in the working tree.
I re-verified tests + tsc still green and committed cleanly as **`4c65cfc`**
("SP8-P1c2: ResourcesTab (authorized / attachments / staged changes)").

## Pure module: `src/ai/util/stagedGroups.ts`

```ts
groupStagedChanges(groups: StagedGroup[]): GroupedStagedGroup[]  // { ...group, batches: StagedBatch[], looseItems: StagedItem[] }
badgeFor(op: string): 'MOD' | 'DEL' | 'MKD' | 'REN'
formatStagedPath(it: StagedItem): string
formatStagedSize(n?: number): string
relativeTime(unixSec: number): { key: string; params?: Record<string, unknown> }
attachmentKindIcon(kind?: string): string
pluralWord(n: number): '' | 's'   // bonus helper, not in the brief's 5, used for EN "file(s)"/"turn(s)"
```
`StagedBatch = { batchId: string|number; items: StagedItem[]; summary: { mkdir: number; rename: number; delete: number } }`.
Types (`StagedGroup`/`StagedItem`) reused from `src/ai/stores/agentStore.ts`, not redefined.

## Ported Vue2 test → new test mapping (`ResourcesTab.test.ts`)

| Vue2 (`tests/resourcesTabBatch.test.js`) | New test | Notes |
|---|---|---|
| `.rt-batch` container renders | `renders a .rt-batch container for a batch sub-group` | verbatim |
| batch shows 2 items | `shows two items in the batch` | verbatim |
| click 整批撤销 → emits `revert-batch` | `clicking 整批撤销 emits revert-batch with the batchId` | verbatim |
| loose items outside `.rt-batch` | `loose items (no batch_id) are rendered outside any .rt-batch` | verbatim |
| per-item revert buttons after expand | `renders per-item revert buttons when batch is expanded` | verbatim |
| click per-item revert → emits `revert-item` | `clicking per-item revert emits revert-item with staged_id` | verbatim |
| C1: delete_file/delete_dir → summary.delete | `counts delete_file and delete_dir as delete in the summary` | assertion text changed from JSON-stringified `$t` mock output to real zh_cn `aiResBatchSummary` substrings (`'新建 1'`/`'移动 0'`/`'删除 2'`) since the mock `$t` is gone |
| C1: DEL badges rendered for both ops | `items show DEL badge for delete_file and delete_dir ops` | verbatim |
| I1: batch revert disabled while reverting | `disables batch revert button when reverting[batchId] is true` | `.element.disabled` → `.attributes('disabled')` (VTU3 idiom); text assertion now checks real `zh.aiResReverting` string instead of literal `'Reverting…'` |
| I1: item revert disabled while reverting | `disables per-item revert button when reverting["item:<stagedId>"] is true` | verbatim |

All 9 Vue2 assertions ported; none dropped. `propsData`→`props`, `w.destroy()`→`w.unmount()`, the `$t` stub mock → real `zh_cn` messages via `createI18n({ legacy: false, ... })`, matching this repo's `ActivityTab.test.ts`/`SystemTab.test.ts` convention.

**6 new test groups added** (per brief Step 1): authorized-section emit+busy-disable; attachment sent-not-removable/draft-removable; download-link href via `service.ai.attachmentRawUrl`; turn-level revert hard-disabled by `snapshot_missing`; commit-all disabled states (busy/committing) + emit; three-section empty states (authorized `<code>@</code>` inline + attachments empty text + pending section entirely absent).

## 8 raw colour literals → tokens (all pre-existing, none added)

| Vue2 literal | Token used |
|---|---|
| `.rt-tag-draft { background: rgba(255,149,0,0.12) }` | `--warning-soft` |
| `.rt-tag-draft { color: var(--warning, #ff9500) }` | `--warning` (fallback dropped — token already real) |
| `.badge-NEW { background: rgba(52,199,89,0.12) }` | `--success-soft` |
| `.badge-DEL { background: rgba(255,59,48,0.12) }` | `--danger-soft` |
| `.badge-REN { background: rgba(48,176,199,0.14) }` | `--teal-soft` |
| `.badge-MKD { background: rgba(48,176,199,0.14) }` | `--teal-soft` |
| `.rt-orphan-tag { background: rgba(255,59,48,0.1) }` | `--danger-soft` |
| `.rt-commit { color: white }` | `--text-on-accent` |

`--teal-soft` was flagged by the brief as possibly missing — it was already in `tokens.scss` (both light/dark blocks), so no token was added.

## `reverting` three key namespaces (as implemented)
```ts
isReverting(runId)                 → !!props.reverting[runId]                 // bare run id
isRevertingBatch(batchId)          → !!props.reverting[batchId]               // bare batch id
isRevertingItem(stagedId)          → !!props.reverting['item:' + stagedId]    // 'item:'-prefixed
```
Matches `agentStore.ts`'s `revertStagedRun`/`revertStagedBatch`/`revertStagedItem` write keys exactly.

## i18n keys added (zh_cn.ts + en_us.ts, parity-tested)
`aiResAuthorized`, `aiResAttachments`, `aiResPending`, `aiResEmptyAuthorized` (`{at}` named slot for `<i18n-t>`, filled with `<code>@</code>` in the template — no bare `@` in the message itself, so no `{'@'}` escape needed), `aiResEmptyAttachments`, `aiResSent`, `aiResSentTitle`, `aiResDraft`, `aiResDownload`, `aiResRemoveAuth`, `aiResRemoveAttachment`, `aiResAgentRunning`, `aiResRevert`, `aiResRevertTurnTitle`, `aiResReverting`, `aiResSnapshotMissing`, `aiResOrphan`, `aiResOrphanTitle`, `aiResTurn` (`{time,n,s}`), `aiResFilesInTurns` (`{files,turns,s}`), `aiResCollapse`, `aiResExpand`, `aiResBatchSummary` (`{mkdir,rename,delete}` — zh copied verbatim from `zh_CN.json:970`, en from `en_US.json:878`), `aiResRevertBatch` (= `en_US.json:879`), `aiResRevertItem` (= `en_US.json:880`), `aiResCommitAll`, `aiResCommitTitle`, `aiResCommitting`, `aiResJustNow`, `aiResMinutesAgo`, `aiResHoursAgo`, `aiResDaysAgo`. 32 keys, all in both files.

`{s}` param (via `pluralWord()`) is an English-only plural suffix passed to both locales' messages; the zh strings simply don't reference `{s}`, which vue-i18n tolerates.

## Test commands + output tails (original task-12 run)
```
$ pnpm exec vitest run src/ai/components/tabs/ResourcesTab.test.ts src/ai/util/stagedGroups.test.ts src/i18n/
 Test Files  5 passed (5)
      Tests  54 passed (54)

$ pnpm test -- src/ai/ src/i18n/
 Test Files  46 passed (46)
      Tests  598 passed (598)

$ pnpm exec vue-tsc --noEmit
(no output — 0 errors)

$ grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(' src/ai/components/tabs/ResourcesTab.vue | grep -v '// '
(no output — only appears inside explanatory comments citing the Vue2 originals)
```

See `p1c2-fix-t12-report.md` for the follow-up fix-pass gate re-runs (56/600 tests, includes the
3 new F1/F2 tests) and the F2 RED/GREEN evidence.

## Judgment calls / left alone
- `agent.md` badge text kept as a literal (not i18n'd) — it's a filename convention, not user-facing prose; translating it would be wrong.
- `.badge-NEW` CSS rule ported even though `badgeFor()` never returns `'NEW'` — this is dead code in Vue2 too (not a bug to fix, just an unreachable style rule kept for 1:1 parity).
- Per-item revert button text stays the literal glyph `↩` even while reverting (Vue2 never swaps it for "Reverting…" text there, only the title tooltip changes) — verified against Vue2 source, not an oversight.
- No new `.rt-icon` CSS rule added — Vue2 doesn't style that class either (bare emoji, no rule in its own `<style>` block).
- Not wiring `<ResourcesTab>` into `AgentRightPanel.vue` (still shows the placeholder div) — per the brief, that wiring is explicitly a later task.
- **Declared deviation (P1c2 fix pass, F1):** Vue2 `ResourcesTab.vue:99`/`:117` render staged-item
  size with a template-level short-circuit — `it.size_bytes ? formatSize(it.size_bytes) : '—'` —
  so a 0-byte staged file shows `'—'` there, even though Vue2's own `formatSize` (line ~205)
  explicitly starts with `if (!n && n !== 0) return '—'`, i.e. `formatSize` itself deliberately
  maps `0 → '0 B'`. Vue2's attachment row (`:40`) calls `formatSize(a.size_bytes)` directly with
  no short-circuit, so a 0-byte *attachment* already shows `'0 B'` in Vue2 while a 0-byte *staged
  item* shows `'—'` — Vue2 is self-inconsistent, and the staged-item short-circuit defeats
  `formatSize`'s own stated intent. Our `ResourcesTab.vue:237`/`:257` (staged-item size cells,
  both the batch-items and loose-items lists) call `formatStagedSize(it.size_bytes)` directly, with
  no short-circuit, so `0 → '0 B'` for staged items too — matching both `formatStagedSize`'s own
  `n !== 0` branch and Vue2's attachment row. This is a **deliberate departure from Vue2's staged-item
  template, not parity** — ruled by the coordinator (same resolution class as the T11 F1
  `toStoragePayload` null-guard). Declared in code comments at both render sites and pinned by a
  regression test (`ResourcesTab — staged item size 0-byte deviation (new, F1)` in
  `ResourcesTab.test.ts`) that asserts `size_bytes: 0` → `'0 B'` and `size_bytes` absent → `'—'`
  in the same assertion, so the test can't pass vacuously.
