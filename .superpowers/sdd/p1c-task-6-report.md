# Task 6: FilesSidebar.vue — Implementation Report

## Summary
Task 6 completed successfully: implemented `FilesSidebar.vue` and `FilesSidebar.test.ts` following TDD approach (RED → GREEN → COMMIT). All 3 tests pass. Component renders a two-section sidebar with favorites (with native HTML5 drag-to-reorder + remove buttons) and read-only disk roots. Every `navigate` emit uses `toVirtualPath()` to convert real paths to virtual paths (without `/DATA`).

## Files Created
1. **`src/files/components/FilesSidebar.vue`** — 142 lines (script + template + style)
2. **`src/files/components/FilesSidebar.test.ts`** — 70 lines (3 test cases)

## TDD Sequence

### Step 1: Write failing test (RED)
```bash
$ npx vitest run src/files/components/FilesSidebar.test.ts
❌ FAIL: Error: Failed to resolve import "./FilesSidebar.vue"
Test Files: 1 failed (1)
Tests: no tests
```

### Step 2: Write implementation (GREEN)
Transcribed exact code from brief:
- **Component setup:** imports `useFilesStore`, `useFavoritesStore`, `useI18n`, `iconUrl`, `toVirtualPath`
- **Favorites section:** renders list with click-to-navigate, hover-reveal remove button (×), native draggable=true with drag-start/drop handlers
- **Disks section:** read-only list (no drag, no remove), uses `diskIcon()` to select folder-hdd vs folder-usb icons
- **Navigation:** all `go()` calls use `toVirtualPath(realPath, files.displayNames)` to emit virtual paths
- **Active state:** both sections highlight the current path with `.active` class
- **Styling:** flexbox sidebar (220px), muted section titles, hover/active states on items

### Step 3: Confirm tests pass (GREEN)
```bash
$ npx vitest run src/files/components/FilesSidebar.test.ts
✅ PASS
Test Files: 1 passed (1)
Tests: 3 passed (3)
```

### Step 4: Commit
```bash
$ git add src/files/components/FilesSidebar.vue src/files/components/FilesSidebar.test.ts
$ git commit -m "feat(files): FilesSidebar (favorites + read-only disk roots, virtual-path navigate)"
[master 70b25d3]
```

## Test Coverage

All 3 tests pass:

1. **`renders disks and an empty-favorites hint`**
   - Seeds files store: 1 disk (NimoOS-HD at /DATA)
   - Seeds favorites store: empty
   - Assertion: renders "暂无收藏" + "NimoOS-HD"
   - ✅ PASS

2. **`clicking a disk emits navigate with the virtual path (not /DATA)`**
   - Clicks the disk item
   - Assertion: emitted navigate event contains `/NimoOS-HD` (virtual path), NOT `/DATA` (real path)
   - ✅ PASS

3. **`clicking a favorite emits its virtual path; remove mutates the store`**
   - Seeds 1 favorite: { name: 'Docs', path: '/DATA/Documents' }
   - Clicks the favorite item
   - Assertion: emits `/NimoOS-HD/Documents` (virtual path conversion via toVirtualPath)
   - Clicks remove button (×)
   - Assertion: favorite is removed from store
   - ✅ PASS

## Key Invariants Verified

- **Virtual path emit:** Every `navigate` event emits a virtual path via `toVirtualPath()`, verified in test 2 + 3 (assertions confirm `/NimoOS-HD` and no `/DATA`)
- **Favorites drag-reorder:** `draggable="true"` + `@dragstart`/`@drop` handlers call `favorites.reorder(fromIndex, toIndex)` (wired but not tested for drag UX; would need jsdom drag event support)
- **Remove button:** `.side-remove` button with `@click.stop="favorites.remove(fav.path)"` correctly mutates store (test 3)
- **Active state:** `isActive()` checks `files.currentPath === realPath` and applies `.active` class (CSS ready for highlighting)

## Code Quality

- **Follows brief exactly:** TypeScript setup, defineEmits signature, i18n messages keys, Pinia store integrations
- **No external changes:** Did not modify shared packages, stores, or utilities — only created the two new files
- **Imports verified:** All imports (`useFilesStore`, `useFavoritesStore`, `iconUrl`, `toVirtualPath`, `useI18n`) exist in the codebase and are mocked/provided correctly in tests
- **Mock coverage:** `@nimotech/nimoos-service` mocked in test setup to avoid external API calls

## Concerns

None. Implementation matches brief exactly, all tests pass, virtual-path invariant confirmed.
