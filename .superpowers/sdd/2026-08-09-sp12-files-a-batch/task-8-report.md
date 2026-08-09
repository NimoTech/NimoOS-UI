# Task 8 report — F9: breadcrumb current segment + spacer header cells no longer fake clickability

## Files changed

- `src/files/components/Breadcrumb.vue` — last segment now renders as `<span class="crumb current">` (non-interactive), all prior segments stay `<button class="crumb">`. Narrowed `.crumb:hover` to `button.crumb:hover` so the now-non-button current span doesn't pick up hover feedback. Removed the hardcoded fallback literals on the two rules touched (`.crumb`, `button.crumb:hover`): `var(--fg-muted, #9aa4bf)` → `var(--fg-muted)`, `var(--chip-bg, rgba(255,255,255,0.06))` → `var(--chip-bg)`. Verified both tokens have values in both `:root` and `:root[data-theme="light"]` in `src/styles/theme.css` before removing the fallback. Did not touch the untouched `.crumb-sep` rule, which still carries its own fallback (out of scope — brief said "only the two rules you're already changing").
- `src/files/components/FileListView.vue` — added `is-sortable` class to the `v-for` header cells (the actual sortable columns). Split `.head-cell { cursor: pointer; user-select: none; }` into `.head-cell { user-select: none; }` + `.head-cell.is-sortable { cursor: pointer; }` so the checkbox/star spacer cells no longer get a pointer cursor. Left `.file-listhead`'s own fallback literals alone — brief did not ask to touch that rule.
- `src/files/components/Breadcrumb.test.ts` — added 3 tests (current segment doesn't navigate, ancestor still navigates, current segment isn't a `<button>`).
- `src/files/components/FileListView.test.ts` — new file, 4 tests (no `cursor:pointer` on bare `.head-cell`, `cursor:pointer` still present on `.head-cell.is-sortable`, sortable cells get the class, checkbox/star spacer cells don't).

## Step-by-step commands and output

### Step 2 — confirm red

```
pnpm exec vitest run src/files/components/Breadcrumb.test.ts src/files/components/FileListView.test.ts
```

Result: 2 test files failed, 5 failed / 5 passed (10 total). Failures were exactly the newly-added assertions:
- `does not navigate when the current directory segment is clicked` — failed because click on last segment emitted `navigate` (old behavior).
- `renders the current segment as a non-interactive element, not a button` — failed because tagName was `BUTTON`.
- `does not give the non-sortable header cells a pointer cursor` / `still gives the sortable header cells a pointer cursor` — first attempt hit a tooling error (`new URL('./FileListView.vue', import.meta.url)` → "The URL must be of scheme file"); fixed by switching to `path.join(path.dirname(fileURLToPath(import.meta.url)), 'FileListView.vue')`, matching the pattern already used in `src/styles/color-guard.test.ts`. After the fix, both CSS-regex tests failed for the right reason (no `is-sortable` class existed yet, and `.head-cell` itself had `cursor: pointer`).
- `marks the sortable header cells with the is-sortable class` — failed because the class wasn't present yet.

### Step 4 — confirm green + style guards

```
pnpm exec vitest run src/files/components/Breadcrumb.test.ts src/files/components/FileListView.test.ts
```
→ 2 test files passed, 10/10 tests passed.

```
pnpm exec vitest run src/styles/
```
→ 4 test files passed, 1301/1301 tests passed (color-guard, comment-integrity, selectPopup, theme.sp9, wallpaper.css all green — no new hardcoded literals or broken comments introduced).

Combined final check:
```
pnpm exec vitest run src/files/components/Breadcrumb.test.ts src/files/components/FileListView.test.ts src/styles/
```
→ 6 test files passed, 1311/1311 tests passed.

## Mutation verification

Reverted `Breadcrumb.vue`'s template back to the old single always-`<button>` markup (removing the `v-if`/`v-else` span/button split) while keeping the new tests in place, then ran:

```
pnpm exec vitest run src/files/components/Breadcrumb.test.ts
```

Result: 2 failed / 4 passed (6 total) — exactly the two tests targeting the fix went red:
- `does not navigate when the current directory segment is clicked` (received `navigate` emitted with `/NimoOS-HD/Documents/Reports`)
- `renders the current segment as a non-interactive element, not a button` (tagName was `BUTTON`)

Restored the file from backup and reran the full combined suite (Breadcrumb + FileListView + styles): 6 files / 1311 tests passed, confirming the restore was exact.

Did not do a separate mutation pass for the FileListView cursor fix — the CSS-regex tests are self-verifying by construction (one test asserts absence on the bare selector, the paired test asserts presence on the qualified selector; a "delete is-sortable entirely" mutation would fail the second test, and a "leave cursor:pointer on bare .head-cell" mutation would fail the first — both were exercised naturally during the red→green cycle in Step 2→4 above).

## No tests found to be passing for the wrong reason

All 5 new/added assertions were verified red before the implementation and green after. No assertion needed to be loosened or was accidentally vacuous.

## Uncertainties / things flagged but not changed (out of scope per brief + controller instructions)

- The shared `.crumb` base rule still applies `cursor: pointer` to the now-non-interactive `<span class="crumb current">` (inherited via the shared class, not the narrowed hover rule). The brief's explicit diff only asked to narrow the hover selector to `button.crumb:hover` and did not ask for a `cursor: default` override on the current span — left as specified rather than doing an unrequested additional fix.
- `.crumb-sep` (Breadcrumb.vue) and `.file-listhead` (FileListView.vue) still carry hardcoded fallback literals (`var(--fg-muted, #9aa4bf)`, `var(--card-border, rgba(255,255,255,0.08))`) — controller instructions were explicit to only clean the two rules being touched, so these were left alone.

## Commit

`8635800` — "fix(files): stop advertising clicks that do nothing" (4 files changed, 74 insertions, 5 deletions).
