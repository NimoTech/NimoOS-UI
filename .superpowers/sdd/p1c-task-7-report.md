# Task 7 Report: Files.vue Layout Integration + i18n + Full Suite + Build

## Files Changed

1. **`src/i18n/zh_cn.ts`** — Added 3 keys after `filesColSize`: `filesFavorites: '收藏'`, `filesDisks: '磁盘'`, `filesNoFavorites: '暂无收藏'`.

2. **`src/views/Files.test.ts`** — Extended `@nimotech/nimoos-service` mock to add `users` (getCustomStorage/setCustomStorage) and `image` (thumbUrl). Replaced `beforeEach` to also inject an `IntersectionObserver` fake that immediately fires `isIntersecting: true`. Added import for `useFavoritesStore`. Added new test case: "renders the sidebar (disks) and breadcrumb for the current folder".

3. **`src/views/Files.vue`** — Full replacement. New layout: `FilesShell > .files-layout [ FilesSidebar | .files-main [ .files-topbar(Breadcrumb + view-toggle chips) + grid/list ] ]`. Added `currentVirtual` computed, `goVirtual(vp)`, `favorites.load()` in `onMounted`.

## P1a Logic Preservation

All P1a browse-pipe logic was preserved verbatim:
- `sync()`: reads route param via `routeParamToVirtualPath`, redirects bare `/files` to default disk root, calls `files.load(toRealPath(...))`.
- `openEntry(entry)`: calls `goVirtual(toVirtualPath(entry.path, ...))` — tile/row click navigation unchanged.
- Route-param `watch`: calls `sync()` on every `route.params.path` change.
- `files.loadRoots()` still called first in `onMounted`, then `favorites.load()`, then `sync()`.

## TDD RED/GREEN Evidence

- **RED** (before Files.vue change): `1 failed | 4 passed (5)` — new test failed at `.files-sidebar` not existing.
- **GREEN** (after Files.vue change): `5 passed (5)` — all Files tests pass including the 4 original P1b ones.

## Full Suite + Build

- **Files suite**: 5 passed (5) ✓
- **Full suite**: 177 passed (177) ✓ (≥159 threshold met)
- **Build**: `vue-tsc --noEmit` clean + `vite build` succeeded (332 modules, dist/assets/index-*.js 396 kB) ✓

## Self-Review

- No existing P1a/P1b tests were broken — all 4 original assertions (`.file-tile`, `.view-toggle-list`, `.col-name`, virtual-path nav) still pass.
- New test correctly validates `.files-sidebar` existence, disk name display, `.crumb` segments for virtual path, and absence of `/DATA` in breadcrumb text.
- The `currentVirtual` computed correctly feeds `Breadcrumb` with the virtual path derived from `files.currentPath`.
- `FilesSidebar` and `Breadcrumb` are wired to `goVirtual` for consistent navigation through the router.
- Commit: `06d285c feat(files): P1c layout — sidebar + breadcrumb + view toggle in Files.vue; favorites load; i18n`
