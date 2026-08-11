# Task 6 report: drag-to-reorder for the Moments band

## Status: DONE

## What was implemented

1. **`src/photos/composables/useAlbumDragSort.ts`** — added three optional fields to the
   options object: `itemSelector?`, `ghostClass?`, `chosenClass?`. Defaults inside
   `refresh()` are exactly today's hardcoded values (`.tile[data-id]`, `'tile-drag-ghost'`,
   no `chosenClass` key at all — Sortable treats an absent key differently from an
   explicit `undefined`, so `chosenClass` is spread in conditionally, only when the
   caller passes one). The album page (`PhotosAlbumDetail.vue`) calls this composable
   with zero new arguments, so it gets the old behavior byte-for-byte.

2. **`src/views/PhotosSmartViews.vue`** — wired `useAlbumDragSort` onto the Moments band:
   - `container: moGrid`, `enabled: () => showMoments.value`
   - `itemSelector: '.mo-card[data-id]'`, `ghostClass: 'mo-drag-ghost'`, `chosenClass: 'mo-drag-chosen'`
   - `onOrder` calls `persistOrder(ids)`, which awaits `moments.reorder(ids)` and toasts
     `photosMoOrderSaveFailed` (tier `'danger'`, 2500ms) on failure.
   - A single `watch(showMoments, ..., { immediate: true })` rebinds Sortable when the
     band goes from hidden to shown (`.mo-grid` is a freshly mounted DOM node in that
     case) and destroys it when the band hides. `onBeforeUnmount` destroys it too.
   - Deliberately **not** ported: Vue2's two watchers for an inline detail view
     collapsing back to the list (899af59b:PhotosSmartViewsView.vue:480-497) — the detail
     page is its own route here, so leaving this page unmounts the whole component and
     returning remounts it. There is no "same instance, detail state collapsed" case to
     watch for; copying those two watchers would add dead code that can never fire. This
     is called out in a code comment at the wiring site.
   - Added `.mo-drag-ghost` / `.mo-drag-chosen` drag-state styles (Vue2
     `photos-smartview.scss:292-299`), using `color-mix(in srgb, var(--accent) …)` instead
     of Vue2's inline purple literal — token-based, no `theme-exception` needed.

3. **i18n**: added `photosMoOrderSaveFailed` to both `src/i18n/zh_cn.photos.ts`
   (`'排序保存失败'`) and `src/i18n/en_us.photos.ts` (`'Failed to save order'`). Did not
   touch any `*.base.ts` file.

## TDD evidence

### RED

Command:
```
pnpm exec vitest run src/photos/composables/__tests__/useAlbumDragSort.test.ts \
  src/views/PhotosSmartViews.moments.test.ts --reporter=verbose
```
Result (before implementation): **4 failed / 17 passed** (21 total). Failures for the
expected reasons:
- `useAlbumDragSort` new "passes overrides through" case: `ghostClass`/`chosenClass`
  not yet honored (`toMatchObject` mismatch, actual still `tile-drag-ghost`).
- All three new `PhotosSmartViews.moments.test.ts` "drag-to-reorder" cases:
  `sortableCreate.mock.calls` was empty (`Cannot read properties of undefined` /
  `expected 0 to be greater than 0`) — the page had no Sortable wiring at all yet.

(First RED attempt hit an unrelated scoping bug in the composable test — the new
sibling `describe` couldn't see the outer `describe`'s `makeContainer` helper and
`beforeEach` mock setup; fixed by nesting the new describe inside the existing one,
which is also the natural place for it since it reuses the same `mockCreate` spy.)

### GREEN

Command:
```
pnpm exec vitest run src/photos/composables/__tests__/useAlbumDragSort.test.ts \
  src/views/PhotosSmartViews.moments.test.ts src/photos/components/__tests__ \
  src/views/__tests__/PhotosAlbumDetail.test.ts --reporter=verbose
```
Result: **47 test files passed, 1017 tests passed**, 0 failed.

Per-file breakdown (via `--reporter=verbose` line count):
- `src/photos/composables/__tests__/useAlbumDragSort.test.ts`: **9** passed (7 baseline + 2 new)
- `src/views/PhotosSmartViews.moments.test.ts`: **12** passed (9 baseline + 3 new)
- `src/views/__tests__/PhotosAlbumDetail.test.ts`: **31** passed (unchanged from baseline)

## Album-path regression proof (before/after)

Baseline run (before any code change), same two files:
```
pnpm exec vitest run src/photos/composables/__tests__/useAlbumDragSort.test.ts \
  src/views/__tests__/PhotosAlbumDetail.test.ts --reporter=verbose
```
→ **2 test files passed, 38 tests passed** (7 + 31).

After implementation, same two files: **38 tests passed** (7 baseline-unchanged +
2 new T6 cases in useAlbumDragSort.test.ts... — counting just the pre-existing tests:
`useAlbumDragSort` still shows its original 7 green, and `PhotosAlbumDetail.test.ts`
still shows exactly its original 31 green, byte-identical titles and count).
No regressions, no behavior change on the default path.

## Gate results

- `pnpm exec vue-tsc --noEmit` → **clean**, no errors. (Had to fix two test-file typing
  issues along the way: `sortableCreate` needed a variadic call signature so
  `.mock.calls[i][1]` type-checks, and the captured Sortable options needed an explicit
  `CapturedSortableOptions` cast — both are test-file-only fixes, no production code
  affected.)
- `pnpm exec vitest run src/i18n/parity.test.ts` → **9 passed**, 0 failed.
- `pnpm exec vitest run src/styles` → **1072 passed** (matches the stated baseline
  exactly), 0 failed.

## Files changed

- `src/photos/composables/useAlbumDragSort.ts`
- `src/photos/composables/__tests__/useAlbumDragSort.test.ts`
- `src/views/PhotosSmartViews.vue`
- `src/views/PhotosSmartViews.moments.test.ts`
- `src/i18n/zh_cn.photos.ts`
- `src/i18n/en_us.photos.ts`

Commit: `d9fe4c1` — "feat(photos): let moments be reordered by dragging" (message
verbatim from the brief).

## Self-review

- **Would the new tests fail if the option pass-through were removed?** Yes — verified
  directly: before implementing, the composable's "passes overrides through" case failed
  with the actual options still showing `ghostClass: 'tile-drag-ghost'` (the default),
  and the moments-page tests failed because `sortableCreate` was never called at all.
- **Does the rebind watcher fire on hidden→shown?** Yes — the "rebinds Sortable when the
  band goes from hidden to shown" test passed, showing `sortableCreate.mock.calls.length`
  increases after `s.moments` goes from empty to non-empty.
- **Is the Sortable instance destroyed on unmount and on shown→hidden?** Wired via
  `onBeforeUnmount(() => drag.destroy())` and the `watch`'s `else` branch, mirroring
  `PhotosAlbumDetail.vue`'s established pattern exactly. Not given its own dedicated test
  in this task (the brief's Step 1 snippet doesn't ask for one, and the underlying
  destroy-on-refresh/destroy-idempotency behavior is already covered by
  `useAlbumDragSort.test.ts`'s existing cases, which apply unchanged to this caller too).
- **Did I add anything not asked for?** No — scope matches the brief's file list and
  interface changes exactly; no unrelated refactoring.
- **Is the test output pristine?** Yes for the files touched in this task — grepped the
  verbose output of `useAlbumDragSort.test.ts` and `PhotosSmartViews.moments.test.ts` for
  `warn`/`unhandled`/`error` and found nothing beyond ANSI noise. The `[Vue warn]`
  "already registered" and `[photos-settings] fetchAiFeatures TypeError: getConfig is not
  a function` lines that appear in `PhotosAlbumDetail.test.ts`'s stderr are pre-existing —
  confirmed present identically in the baseline run before any change, unrelated to this
  task, and not touched.

## Concerns

None. Both risk areas called out in the assignment were the main design decisions here
(default-preserving optional options; only the third Vue2 watcher has a real
counterpart), and both are directly tested and green.
