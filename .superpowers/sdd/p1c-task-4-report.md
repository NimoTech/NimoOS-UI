# P1c Task 4 Report: FavoriteStar + FileRow/FileTile hover integration + ListHead alignment

## Files Created
- `src/files/components/FavoriteStar.vue` — button toggle component, reads `useFavoritesStore().isFavorite(path)`, `@click.stop` calls `add`/`remove`
- `src/files/components/FavoriteStar.test.ts` — 2 TDD tests (☆→★ on add, ★→☆ on remove)

## Files Modified
- `src/files/components/FileRow.vue` — added `FavoriteStar` import + `.file-star` trailing span + `:deep(.favorite-star)` hover/active CSS
- `src/files/components/FileTile.vue` — added `FavoriteStar` import + `.tile-star` absolute overlay + `position: relative` on `.file-tile` + `:deep(.favorite-star)` hover/active CSS
- `src/files/components/FileListView.vue` — added `<span class="head-cell col-star"></span>` after v-for columns + `.col-star { flex: 0 0 32px; }` to match FileRow's `.file-star`
- `src/files/components/FileRow.test.ts` — updated `stubs` from `{ FileThumb: true }` to `{ FileThumb: true, FavoriteStar: true }`

## TDD Evidence

### Step 2: RED
```
FAIL src/files/components/FavoriteStar.test.ts
Error: Failed to resolve import "./FavoriteStar.vue" — Does the file exist?
```

### Step 4: GREEN (after creating FavoriteStar.vue)
```
Test Files  1 passed (1)
Tests  2 passed (2)
```

## Step 9 Batch Result
```
npx vitest run src/files/components/FavoriteStar.test.ts src/files/components/FileRow.test.ts src/views/Files.test.ts

Test Files  3 passed (3)
Tests  8 passed (8)
Duration  938ms
```
All green. Files.test mounts real FavoriteStar which only reads `isFavorite` on empty list — no service call triggered.

## Self-Review

- `.file-star { flex: 0 0 32px; }` in FileRow and `.col-star { flex: 0 0 32px; }` in FileListView — aligned exactly.
- `position: relative` added to `.file-tile` before existing `display: flex` declaration.
- FavoriteStar uses `@click.stop` to prevent propagating to the parent row/tile open handler.
- FileRow.test now stubs both `FileThumb` and `FavoriteStar`, so the test has no Pinia dependency.
- Files.test uses `setActivePinia(createPinia())` (confirmed in its beforeEach), so mounting real FavoriteStar works without error.

## Commit
```
81f456b feat(files): FavoriteStar (hover on row/tile + active), aligned list star column
6 files changed, 69 insertions(+), 2 deletions(-)
```
