# P2b Task 4 Report — BlacklistSection(文件系统)+ apiErrorMessage

## Commit
`8a55456d319515ab99133de63b80e8b31ebe8ba2` (branch `sp8-ai`)
6 files changed, 388 insertions: `src/ai/util/apiError.ts`, `src/ai/util/apiError.test.ts`,
`src/ai/components/settings/sections/BlacklistSection.vue`,
`src/ai/components/settings/sections/BlacklistSection.test.ts`, `src/i18n/zh_cn.ts`,
`src/i18n/en_us.ts`. Confirmed via `git show --stat HEAD` — no other files present.

## Per-file summary

- **`src/ai/util/apiError.ts`** — `apiErrorMessage(e, fallback)`: extracts backend error
  messages with priority `response.data.message` (string, non-empty) → `response.data`
  (string used directly, object JSON-serialized) → `error.message` → caller-supplied
  fallback. Consolidates a pattern duplicated across Vue2's 7 settings sections (cited:
  `BlacklistSection.vue:80-84`, `McpTokensSection.vue:186`, `ChannelsSection.vue:210`).
- **`src/ai/util/apiError.test.ts`** — 6 cases from the brief verbatim, covering priority
  order, string vs object `response.data`, no-response fallback to `error.message`, total
  fallback, and empty-string-is-not-valid-message edge cases.
- **`src/ai/components/settings/sections/BlacklistSection.vue`** — Vue3 `<script setup>`
  port. Zero props, consumes `useSettingsStore()` directly (only section in P2b to do so —
  D2 declared in header comment, matching Vue2's `settingsStore.js` state ownership).
- **`src/ai/components/settings/sections/BlacklistSection.test.ts`** — 14 cases from the
  brief verbatim (mount load, silent failure on mount, builtin chip count/content, empty/
  populated custom pattern list, add-button disabled state, trim-on-add, enter-to-add,
  whitespace-only no-op, add-failure toast with backend message / fallback, in-flight
  "Adding…" state, delete-by-id, delete-failure toast).

## Vue2 → New-UI mapping

| Vue2 (`src/views/AI/Settings/sections/BlacklistSection.vue`) | New-UI |
|---|---|
| `:1-52` template structure (`.set-inner` > `.set-page-head`/`.sk-section`×2) | Identical markup, `$t()` → `t()` from `useI18n()` |
| `:16` `<SkillIcon name="lock" :size="11" />` | `<AgentIcon name="lock" :size="11" />` (icon exists at `AgentIcon.vue:61`) |
| `:46` `<SkillIcon name="trash" :size="14" />` | `<AgentIcon name="trash" :size="14" />` (exists at `AgentIcon.vue:27`) |
| `:57-64` `BUILTIN` const (27 entries) | Copied verbatim, same order |
| `:69` `inject: ['settingsStore']` / `:74` `store` computed | `useSettingsStore()` direct call |
| `:75-77` `mounted()` → `try/catch(e){}` silent | `onMounted(() => { void store.loadBlacklist().catch(() => {}) })` — same silent-swallow behavior, declared in header comment |
| `:79-96` `add()` | `add()` — same trim/guard/adding-flag/try-catch-finally structure |
| `:87-91` inline error-extraction + `$buefy.toast.open` | `apiErrorMessage(e, t('aiCfgAddFailed'))` + `toast.show(msg, 3000, 'danger')` |
| `:97-102` `remove(id)` | `remove(id)` — same try/catch; fallback text changed (see deviation below) |

## RED → GREEN evidence

1. `apiError.test.ts`: ran before `apiError.ts` existed →
   `Error: Failed to resolve import "./apiError"` (RED, correct failure — file missing).
   After implementing: `Test Files 1 passed (1)`, `Tests 6 passed (6)` (GREEN).
2. `BlacklistSection.test.ts`: ran before `BlacklistSection.vue` existed →
   `Failed to resolve import "./BlacklistSection.vue"` (RED, correct failure).
   After implementing: `Test Files 1 passed (1)`, `Tests 14 passed (14)` (GREEN).

## Final full-suite numbers

- `pnpm test`: **272 files / 2063 tests passed** (baseline was 268/2005; the delta includes
  a concurrent session's untracked `ModelsSection`/`formatModelSize` work plus this task's
  20 new tests — all green, no flakes observed).
- `pnpm exec vue-tsc --noEmit`: clean, no output.
- `pnpm build`: clean — only the pre-existing 3rd-party + ">500 kB chunk" warnings
  (`ExcelViewer`, `index-DV-3r6h3.js`, `PdfViewer`), same as baseline.

## i18n keys added

9 keys listed in the brief; **2 already existed** (added earlier by the concurrent P2a
session working on `ModelsSection` in the same worktree) so were *not* re-added:
`aiCfgFilesystem` (existed at `zh_cn.ts:589`/`en_us.ts:588`) and `aiCfgDelete` (existed at
`zh_cn.ts:655`/`en_us.ts:647`) — both reused as-is, values match the brief's table exactly.

The 7 genuinely new keys added (verbatim from the brief) inside
`// >>> SP8-P2b Task 4 —— BlacklistSection(文件系统)` / `// <<< SP8-P2b Task 4` markers at
the very end of both files, before the closing `}`:

- `aiCfgBlacklistDesc`
- `aiCfgBuiltinReadonly`
- `aiCfgYourPatterns`
- `aiCfgPatternPlaceholder`
- `aiCfgAddPattern`
- `aiCfgAddingPattern`
- `aiCfgNoCustomPatterns`
- `aiCfgAddFailed`

(That's 8 new + 2 reused = 10 rows in the brief's table = 9 nominally "new" per the brief's
count, but since `aiCfgDelete` had already landed via the other session before I got to
Step 7, only 8 were actually new by the time I wrote them — no duplicate key was added.)

## i18n staging confirmation

Ran `.superpowers/sdd/p2b-stage-i18n.sh --check` first — printed exactly my two marker
blocks as the only delta vs `HEAD` for both files (verified diff output, no P2a in-flight
keys included). Then ran `.superpowers/sdd/p2b-stage-i18n.sh` (no args) to write the
HEAD+marker-blocks version into the index. `git add` was **never** run on `src/i18n/*.ts`.
Post-commit `git status` shows `src/i18n/en_us.ts` and `src/i18n/zh_cn.ts` as still
"modified" in the working tree (the other session's residual uncommitted keys) — this is
correct and expected per the brief; not touched further.

## Deviations declared

1. **Deferred `SettingsPage.vue` wiring (Step 10 skipped entirely).** Per explicit
   instruction, did not open, edit, or commit `src/ai/views/SettingsPage.vue` or
   `SettingsPage.test.ts` — that file is being actively edited by a concurrent P2a session
   in the same worktree. `BlacklistSection` is verified standalone by its own test mounting
   it directly. The wiring (import + `SECTION_COMPONENTS['blacklist']` entry) is deferred to
   a later integration step after P2a lands.
2. **Delete-failure fallback text differs from Vue2.** Vue2 `BlacklistSection.vue:100` uses
   bare `e.message` with no fallback string — if `e.message` is empty/undefined it shows
   an empty toast (a reproducible Vue2 defect). New-UI's `remove()` catch uses
   `apiErrorMessage(e, t('aiCfgDelete'))`, i.e. falls back to the localized word "Delete"
   ("删除") when there's no usable message, per the brief's explicit instruction (brief
   Step 8 annotation, point ②). This is a **declared, brief-mandated deviation**, not one I
   introduced independently — flagging it here per the ledger requirement.
3. **`BlacklistEntry.id` type matches store exactly** (`string | number`) — no deviation
   needed; Task 0's reconciliation of the store signature was accurate, confirmed by reading
   `src/ai/stores/settingsStore.ts:132-136` directly.
4. No other logic deviations from Vue2. Markup, CSS classes (`.fs-chips`/`.fs-chip`/
   `.fs-empty`/`.fs-userrow`/`.set-addrow`/`.set-addbtn`/`.pat`/`.lk`/`.dir-del`, all
   pre-existing in `settings-styles.scss`), and interaction sequencing are 1:1.
5. No `<style>` block was added (color-guard not implicated) — all visuals come from
   pre-existing shared classes, per the brief's explicit note that these already exist in
   `settings-styles.scss` (confirmed by grep before writing the component).
