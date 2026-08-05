# Task 3 Report: FileRow/FileTile Checkbox + Modifier-Click + View Forwarding

## Files Changed
- `src/files/components/FileRow.vue` — full replacement: added `selected` prop, `onClick` handler with modifier key logic, `.file-check`/`.row-check` checkbox, `:data-path`, `.selected` class binding, `.file-row.selected` CSS
- `src/files/components/FileTile.vue` — full replacement: same pattern as FileRow (tile-check, tile-check-box, selected prop, onClick, data-path)
- `src/files/components/FileListView.vue` — modified: added `selectedPaths?: Set<string>` prop, `select` emit, leading `.col-check` header span, `:selected` + `@select` on FileRow loop, `.col-check { flex: 0 0 28px }` CSS
- `src/files/components/FileGridView.vue` — full replacement: added `selectedPaths?` prop, `select` emit, `:selected` + `@select` on FileTile loop
- `src/files/components/FileRow.test.ts` — full replacement per brief: 5 tests (open, dir-size-cell, ctrl/shift-click, checkbox-select, selected-class)

## TDD Evidence

### Step 2 — RED
```
npx vitest run src/files/components/FileRow.test.ts
Test Files  1 failed (1)
      Tests  3 failed | 2 passed (5)
```
Failures: `ctrl/meta click emits select toggle`, `checkbox click emits select toggle`, `adds .selected class and checks the box when selected`
— as expected: `input.row-check` not found, `select` not emitted, `.selected` class missing.

### Step 7 — GREEN (batch)
```
npx vitest run src/files/components/FileRow.test.ts src/views/Files.test.ts
Test Files  2 passed (2)
      Tests  10 passed (10)
```
- FileRow: 5/5 green
- Files.test: 5/5 green (Files.vue doesn't pass `selectedPaths` yet; `?.has` safe; plain click still navigates)

## Commit
`b721ab8 feat(files): row/tile checkbox + modifier-click select + data-path; views forward select`
5 files changed, 108 insertions(+), 21 deletions(-)

## Self-Review
- Checkbox `@click.stop` prevents row navigation on checkbox click; `@change` emits `select toggle` — correct.
- `.file-check { flex: 0 0 28px }` in FileRow + `.col-check { flex: 0 0 28px }` in FileListView — column alignment maintained.
- `.col-name { margin-left: 40px }` unchanged — P1b/P1c alignment not regressed.
- `selectedPaths?.has(...)` optional chaining safe when prop is undefined.
- FileThumb + FavoriteStar imports preserved in both FileRow and FileTile.
- No shared package changes; no pnpm install required.
- Base files matched brief's expected state exactly — no divergence detected.
