# Task 4 Report: SourcesPage.vue + 路由 + 侧栏入口 + i18n 键

## Status: DONE

## Commit
- `4c0ab8c` — "P7: /apps/sources 商店源管理页 + 路由 + 侧栏入口 + i18n"

## Implemented

- `src/apps/views/SourcesPage.vue` (new): consumes `useSourcesStore()` (Task 3),
  `sourceDisplayName`/`isOfficialSource` (Task 1), and `components/ui/AlertDialog.vue`.
  Renders source list (official badge, no remove button for official sources; remove
  button for third-party), add form with client-side http(s) validation, pending/
  registering row with spinner, loading/error/empty states, and a remove confirmation
  dialog. Confirm-dialog target is stored separately from the open flag to survive
  reka-ui's `update:open(false)`-before-`confirm` emit ordering (documented inline in
  the component, matching the brief's comment verbatim).
- `src/apps/views/SourcesPage.test.ts` (new): brief's test verbatim (4 cases — list
  render/badge/remove-button, invalid-URL disables add, submit trims+clears+shows
  sync error inline, remove-confirm calls `unregister(id)`). `findComponent({ name:
  'AlertDialog' })` worked as-is; the brief's fallback (import-based lookup) was not
  needed.
- `src/router/index.ts`: imported `SourcesPage`, added
  `{ path: '/apps/sources', name: 'apps-sources', component: SourcesPage }` between
  `apps-custom` and `apps-settings` (static-before-param route convention).
- `src/apps/components/AppsSidebar.vue`: removed the `// P7 增补` placeholder comment,
  appended the `apps-sources` nav entry (labelKey `appsNavSources`, to `/apps/sources`).
  No `isActive` change needed (exact-match default already correct — no sub-routes).
- `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts`: consolidated the `appsSources*` block per
  the task's deviation instructions:
  1. Replaced the 4 existing Task-3 keys' wording with the brief's exact text
     (`appsSourcesRegisterOk/RegisterFail/RemoveOk/RemoveFail` — note `RemoveFail`
     changed from "移除商店源失败:{msg}" to "移除失败:{msg}" / "Failed to remove
     source: {msg}" to "Failed to remove: {msg}" per the plan).
  2. Kept `appsSourcesBusy` (not in the brief's block) and moved it into the same
     consolidated block, right after `appsSourcesRemoveFail`.
  3. Appended the remaining 15 new keys (`appsNavSources`, `appsSourcesTitle/Desc/
     More/AddPlaceholder/Add/Adding/InvalidUrl/Official/Remove/RemoveTitle/RemoveMsg/
     Loading/LoadFailed/Retry/Empty`).
  End state: one `// ── 商店源(/apps/sources) ──` / `// ── App sources (/apps/sources)
  ──` block per file, no duplicate keys, parity preserved.
- `src/apps/components/AppsSidebar.test.ts` (not listed in the brief's file list, but
  required — see Concerns): the new nav entry pushed the sidebar's item count from
  3 to 4, breaking two existing hardcoded `toHaveLength(3)` assertions (the store-
  detail-highlight and custom-apps-highlight tests). Bumped both to 4, and added a new
  4th test case for the `apps-sources` entry itself (highlight-when-current +
  click → `push('/apps/sources')`), mirroring the existing per-entry test pattern.

## TDD evidence

RED (Step 2, before creating SourcesPage.vue):
```
$ pnpm exec vitest run src/apps/views/SourcesPage.test.ts
FAIL  src/apps/views/SourcesPage.test.ts [ src/apps/views/SourcesPage.test.ts ]
Error: Failed to resolve import "./SourcesPage.vue" from "src/apps/views/SourcesPage.test.ts".
Test Files  1 failed (1)
```

GREEN (Step 7, after i18n + page + route + sidebar):
```
$ pnpm exec vitest run src/apps/views/SourcesPage.test.ts src/i18n/parity.test.ts src/i18n/i18n.test.ts
Test Files  3 passed (3)
     Tests  8 passed (8)
```

Sidebar regression fixed, full suite green:
```
$ pnpm exec vitest run src/apps/components/AppsSidebar.test.ts
Test Files  1 passed (1)
     Tests  4 passed (4)

$ pnpm test
Test Files  214 passed (214)
     Tests  1189 passed (1189)
```

Type check:
```
$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

## Files changed

- `src/apps/views/SourcesPage.vue` (new)
- `src/apps/views/SourcesPage.test.ts` (new)
- `src/router/index.ts`
- `src/apps/components/AppsSidebar.vue`
- `src/apps/components/AppsSidebar.test.ts`
- `src/i18n/zh_cn.ts`
- `src/i18n/en_us.ts`

Note: `src/apps/views/AppSettingsPage.vue` had a pre-existing uncommitted, unrelated
change (a YAML-tab CSS margin tweak) already sitting in the working tree before this
task started. It was intentionally left unstaged/uncommitted — not part of Task 4,
and not included in this commit.

## Self-review

- **Color literals**: `grep -nE "#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\("
  src/apps/views/SourcesPage.vue` → no matches. All colors go through existing theme
  tokens (`--fg`, `--fg-muted`, `--accent`, `--accent-text`, `--accent-soft`,
  `--accent-soft-bd`, `--card-bg`, `--card-border`, `--chip-bg`, `--chip-border`,
  `--remove-fg`), all defined in both the dark `:root` and `:root[data-theme="light"]`
  blocks of `src/styles/theme.css`.
- **`--font-mono` fallback deviation**: the brief's snippet used bare
  `var(--font-mono)`, but `--font-mono` is not actually defined as a token anywhere in
  `theme.css` — it's only ever used ad hoc with a `monospace` fallback in one other
  file (`CustomAppsPage.vue`). Changed to `var(--font-mono, monospace)` to match that
  existing repo convention rather than leave an unresolved custom property.
- **reka `update:open`-before-`confirm` timing**: `confirmRemove()` reads
  `delTarget.value` into a local `s` *before* setting `delOpen.value = false` and
  clearing `delTarget.value = null`, exactly per the brief's guidance/comment, so a
  DialogClose-triggered `update:open(false)` firing before `confirm` cannot race-clear
  the target first. Test case 4 exercises this path via `dialog.vm.$emit('confirm')`
  and passes.
- **i18n parity**: `src/i18n/parity.test.ts` passes — both locale files end with the
  same key set after consolidation, no duplicate keys in either file.

## Concerns

None blocking. One judgment call: `AppsSidebar.test.ts` was not listed as a file to
modify in the brief, but adding the sidebar nav entry mechanically breaks its two
hardcoded `toHaveLength(3)` assertions. Updated them to 4 and added a same-pattern
test for the new entry — consistent with the task's "mechanical adaptation to the
repo's actual test conventions is fine" guidance.
