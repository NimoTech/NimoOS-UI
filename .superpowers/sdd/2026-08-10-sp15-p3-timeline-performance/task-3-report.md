# Task 3 report: gridMetrics.ts pure functions + CSS parity guard

## What was implemented

- `src/photos/util/gridMetrics.ts` — new pure module exporting `GRID_METRICS`,
  `CONTENT_INSET`, `FALLBACK_CONTAINER_WIDTH`, `MONTH_HEAD_HEIGHT`, `columnsFor`,
  `tileEdge`, `estimateSectionBodyHeight`, `skeletonItemCount`. Implemented verbatim
  from the brief's Step 3 code block (no deviation).
- `src/photos/util/__tests__/gridMetrics.test.ts` — verbatim from the brief's Step 1.
- `src/photos/util/__tests__/gridMetricsCssParity.test.ts` — verbatim from the
  brief's Step 5. Reads `src/photos/components/PhotosGrid.vue` via
  `readFileSync(..., 'utf8')` (repo-relative path, no `?raw` import).

`PhotosGrid.vue` was NOT modified in the committed state — it was only mutated
transiently for Step 6 verification, then reverted (confirmed via `git diff --stat`
showing no diff before staging/commit).

## TDD evidence

### RED (Step 2) — module does not exist yet

```
FAIL  src/photos/util/__tests__/gridMetrics.test.ts [ src/photos/util/__tests__/gridMetrics.test.ts ]
Error: Failed to resolve import "../gridMetrics" from "src/photos/util/__tests__/gridMetrics.test.ts". Does the file exist?
...
 Test Files  1 failed (1)
      Tests  no tests
```

### GREEN (Step 4) — after writing gridMetrics.ts

```
 Test Files  1 passed (1)
      Tests  16 passed (16)
   Duration  638ms
```

### Guard passes (Step 6, before mutation)

```
pnpm test src/photos/util/__tests__/gridMetricsCssParity.test.ts

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

## Mutation verification (Step 6, required — actually run, not just claimed)

### Mutation 1: `GRID_METRICS.compact.gap` 2 → 3

```
pnpm test src/photos/util/__tests__/gridMetricsCssParity.test.ts

 ❯ src/photos/util/__tests__/gridMetricsCssParity.test.ts (4 tests | 1 failed) 12ms
     × compact: minmax floor and gap agree with the CSS 6ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/photos/util/__tests__/gridMetricsCssParity.test.ts > gridMetrics matches PhotosGrid.vue CSS > compact: minmax floor and gap agree with the CSS
AssertionError: expected 2 to be 3 // Object.is equality

- Expected
+ Received

- 3
+ 2

 ❯ src/photos/util/__tests__/gridMetricsCssParity.test.ts:34:51

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

Failed exactly on the `compact` case, as expected. Reverted `gap: 3` back to `gap: 2`
in `src/photos/util/gridMetrics.ts`.

### Mutation 2: `PhotosGrid.vue`'s `.grid[data-density="loose"]` `minmax(200px` → `minmax(180px`

```
pnpm test src/photos/util/__tests__/gridMetricsCssParity.test.ts

 ❯ src/photos/util/__tests__/gridMetricsCssParity.test.ts (4 tests | 1 failed) 13ms
     × loose: minmax floor and gap agree with the CSS 7ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/photos/util/__tests__/gridMetricsCssParity.test.ts > gridMetrics matches PhotosGrid.vue CSS > loose: minmax floor and gap agree with the CSS
AssertionError: expected 180 to be 200 // Object.is equality

- Expected
+ Received

- 200
+ 180

 ❯ src/photos/util/__tests__/gridMetricsCssParity.test.ts:33:52

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

Failed exactly on the `loose` case, as expected. Reverted `minmax(180px` back to
`minmax(200px` in `src/photos/components/PhotosGrid.vue`.

### Confirming the revert

```
git status --short
 M docs/superpowers/specs/2026-08-10-sp15-p3-timeline-performance-design.md   (pre-existing, unrelated)
?? src/photos/util/__tests__/gridMetrics.test.ts
?? src/photos/util/__tests__/gridMetricsCssParity.test.ts
?? src/photos/util/gridMetrics.ts

git diff --stat src/photos/components/PhotosGrid.vue
(no output — zero diff)
```

`PhotosGrid.vue` was clean of the mutation before staging/commit.

## Final combined run (post-revert)

```
pnpm test src/photos/util/__tests__/gridMetrics.test.ts src/photos/util/__tests__/gridMetricsCssParity.test.ts

 Test Files  2 passed (2)
      Tests  20 passed (20)
   Duration  688ms
```

```
pnpm exec vue-tsc --noEmit
(no output, exit 0)
```

## Self-review: arithmetic check

Hand-verified every expected number in the brief's test file against the
implementation before treating them as ground truth:

- `columnsFor(868, 'comfortable')`: usableWidth = 868 − 68 = 800;
  floor((800+4)/144) = floor(804/144) = 5 ✓
- `columnsFor(868, 'compact')`: floor((800+2)/98) = floor(802/98) = 8 ✓
- `columnsFor(868, 'loose')`: floor((800+10)/210) = floor(810/210) = 3 ✓
- `columnsFor(10, 'loose')`: usableWidth = max(1, 10−68) = 1;
  floor((1+10)/210) = 0 → clamped to 1 ✓
- `tileEdge(868, 'comfortable')`: cols=5, w=800; (800−4×4)/5 = 784/5 = 156.8 ✓
- `estimateSectionBodyHeight(itemCount=12)`: rows=ceil(12/5)=3;
  3×156.8 + 2×4 = 470.4+8 = 478.4 ✓
- `estimateSectionBodyHeight(itemCount=1)` vs `itemCount=5`: both round up to
  rows=1 → both 156.8, so `one ≈ five` holds ✓
- `skeletonItemCount(photo, count=100, videoCount=12)`: 100−12 = 88 ✓
- `skeletonItemCount(photo, count=2, videoCount=5)`: max(0, 2−5) = 0 ✓
- `skeletonItemCount(photo, loaded=true, loadedLength=7, count=undefined)`:
  `count == null` branch, `loaded !== false` → returns `loadedLength` = 7 ✓

No disagreement found between the brief's hand-computed expected values and the
implementation's actual arithmetic — all 20 assertions passed on the real run,
not just by inspection.

## Files changed

- `src/photos/util/gridMetrics.ts` (new)
- `src/photos/util/__tests__/gridMetrics.test.ts` (new)
- `src/photos/util/__tests__/gridMetricsCssParity.test.ts` (new)

Commit: `1ab9c8c` — "feat(photos): add grid geometry helpers and a CSS parity guard"

## Concerns

None. `PhotosGrid.vue` was not touched in the committed diff (only transiently
mutated and reverted for Step 6, verified via `git diff --stat` showing empty
before staging). vue-tsc is clean. Nothing else consumes this module yet, per
the task context (Tasks 6/7 wire it into `PhotosGrid.vue`).
