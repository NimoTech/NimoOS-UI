# P1c Task 3 Report: `stores/favorites.ts`

## Summary
Implemented the favorites Pinia store with full test coverage (7 tests, all passing). The store persists user favorites via the shared package `service.users.getCustomStorage/setCustomStorage` API, maintaining Vue2 compatibility by storing real paths (not virtual paths).

## TDD Workflow Evidence

### Step 1: Write Failing Test (RED)
Created `src/files/stores/favorites.test.ts` with the exact specification from the brief:
- 2 tests for the pure `moveItem` helper function
- 5 tests for the store (`load`, `add`, `isFavorite`+`remove`, `reorder`)
- Mocked `@nimotech/nimoos-service` for isolation

### Step 2: Confirm Test Failure
```bash
npx vitest run src/files/stores/favorites.test.ts
```
Output: `FAIL  src/files/stores/favorites.test.ts`
Error: `Cannot find module './favorites'` ✓ Expected RED state

### Step 3: Write Implementation
Created `src/files/stores/favorites.ts` with:
- `Favorite` interface (`name: string`, `path: string`)
- Pure `moveItem<T>` helper function (validates indices, creates new array)
- `useFavoritesStore` Pinia setup store with:
  - `list`: ref of Favorite[]
  - `load()`: fetch from custom storage, fallback to empty array
  - `isFavorite(realPath)`: check by path equality
  - `add(fav)`: deduplicate by path, persist
  - `remove(realPath)`: filter, persist
  - `reorder(from, to)`: use moveItem, persist
  - `persist()`: private helper with error logging

### Step 4: Confirm Test Success (GREEN)
```bash
npx vitest run src/files/stores/favorites.test.ts
```
Output:
```
 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  14:11:35
   Duration  406ms
```
✓ All 7 tests passing

### Step 5: Commit
```bash
git commit -m "feat(files): favorites store (Vue2-compatible real-path blob via users custom storage)"
```
Commit: `dea748b`

## Files Created
1. **`src/files/stores/favorites.ts`** (60 lines)
   - Core store implementation with Vue2-compatible real-path storage
   
2. **`src/files/stores/favorites.test.ts`** (71 lines)
   - Full test suite with mocked service layer

## Self-Review Checklist
- ✓ Transcribed implementation EXACTLY as given in brief
- ✓ Transcribed test EXACTLY as given in brief  
- ✓ `moveItem` correctly handles edge cases (out-of-range indices are no-op)
- ✓ `add()` deduplicates by path (prevents duplicate favorites)
- ✓ `load()` handles null/non-array gracefully (empty list)
- ✓ `isFavorite()` checks real path (not virtual)
- ✓ All mutations call `persist()` to sync to storage
- ✓ Error handling in `load()` and `persist()` with console.warn
- ✓ No changes to shared package (uses existing `service.users` API)
- ✓ Commit message matches exact specification
- ✓ No other files modified or affected

## Test Coverage
```
moveItem
  ✓ moves an element and returns a new array
  ✓ is a no-op for out-of-range indices

favorites store
  ✓ load: null / non-array yields empty list
  ✓ load: reads the favorites array
  ✓ add: appends real-path entry, persists, dedupes by path
  ✓ isFavorite + remove persist
  ✓ reorder moves items and persists
```

## Concerns
None. Task completed successfully following TDD (RED → GREEN → Commit) with exact specifications met.
