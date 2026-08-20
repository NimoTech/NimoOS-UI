## Task 5: Share the pointer-to-cell helper

**Files:**
- Modify: `src/home/grid/pointerMath.ts`
- Modify: `src/home/grid/pointerMath.test.ts`
- Modify: `src/home/components/AddPanel.vue` (replace the local `targetCellAt`, lines 155-169)

**Interfaces:**
- Produces, consumed by Task 6:
  ```ts
  export function cellAtPointer(
    clientX: number, clientY: number,
    rect: { left: number; top: number; right: number; bottom: number },
    size: { w: number; h: number },
    grid: { cell: number; gap: number; cols: number; rows: number },
  ): { tc: number; tr: number } | null
  ```
  Returns null when the pointer is outside `rect`.

**This is a pure refactor. `AddPanel`'s behaviour must not change** — it is the flow the owner already relies on, and Task 6 depends on it staying correct.

- [ ] **Step 1: Write the failing tests**

Append to `src/home/grid/pointerMath.test.ts`:

```ts
import { cellAtPointer } from './pointerMath'

// Extracted from AddPanel so the dock can use the same hit-test. A pointer outside
// the grid must be null rather than a clamped edge cell: the caller distinguishes
// "dropped on the desktop" from "dropped somewhere else", and a clamped answer
// would place an item the user was trying not to place.
describe('cellAtPointer', () => {
  const rect = { left: 100, top: 50, right: 100 + 12 * 76, bottom: 50 + 8 * 76 }
  const grid = { cell: 60, gap: 16, cols: 12, rows: 8 }
  const one = { w: 1, h: 1 }

  it('returns null when the pointer is outside the grid', () => {
    expect(cellAtPointer(99, 60, rect, one, grid)).toBeNull()
    expect(cellAtPointer(200, 49, rect, one, grid)).toBeNull()
    expect(cellAtPointer(rect.right + 1, 60, rect, one, grid)).toBeNull()
    expect(cellAtPointer(200, rect.bottom + 1, rect, one, grid)).toBeNull()
  })

  it('maps the grid origin to cell 1,1', () => {
    expect(cellAtPointer(130, 80, rect, one, grid)).toEqual({ tc: 1, tr: 1 })
  })

  it('advances one column per step', () => {
    expect(cellAtPointer(130 + 76, 80, rect, one, grid)).toEqual({ tc: 2, tr: 1 })
    expect(cellAtPointer(130, 80 + 76, rect, one, grid)).toEqual({ tc: 1, tr: 2 })
  })

  // A wide item cannot start so far right that it would hang off the grid.
  it('clamps so the item fits inside the grid', () => {
    expect(cellAtPointer(rect.right - 1, rect.bottom - 1, rect, { w: 4, h: 2 }, grid))
      .toEqual({ tc: 9, tr: 7 })
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

```
pnpm vitest run src/home/grid/pointerMath.test.ts --reporter=verbose
```

Expected: FAIL — `cellAtPointer` is not exported.

- [ ] **Step 3: Implement it**

Append to `src/home/grid/pointerMath.ts`:

```ts
/**
 * Pointer position to grid cell, or null when the pointer is not over the grid.
 *
 * Shared by the add-panel's spawn drag and the dock's drag-onto-the-desktop, which
 * must agree: both use the answer to decide whether a release counts as a
 * placement at all, and null is what "not over the grid" means. Clamping keeps a
 * multi-cell item from starting where it would hang off the edge.
 */
export function cellAtPointer(
  clientX: number, clientY: number,
  rect: { left: number; top: number; right: number; bottom: number },
  size: { w: number; h: number },
  grid: { cell: number; gap: number; cols: number; rows: number },
): { tc: number; tr: number } | null {
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null
  const step = grid.cell + grid.gap
  return {
    tc: clamp(Math.round((clientX - rect.left - grid.cell / 2) / step) + 1, 1, grid.cols - size.w + 1),
    tr: clamp(Math.round((clientY - rect.top - grid.cell / 2) / step) + 1, 1, grid.rows - size.h + 1),
  }
}
```

`clamp` already exists at the top of that file.

- [ ] **Step 4: Run them and confirm they pass**

```
pnpm vitest run src/home/grid/pointerMath.test.ts --reporter=verbose
```

Expected: all PASS.

- [ ] **Step 5: Point AddPanel at the shared helper**

In `src/home/components/AddPanel.vue`, add `cellAtPointer` to the imports from `../grid/pointerMath` (create the import if the file has none), then replace the body of the local `targetCellAt` (lines 155-169) with a thin adapter, keeping its name and signature so the two call sites are untouched:

```ts
// Pointer → grid cell, shared with the dock via pointerMath so both agree on what
// counts as "over the grid". Returns null when it is not.
function targetCellAt(ev: PointerEvent, desc: SpawnDesc): { tc: number; tr: number } | null {
  const grid = props.gridEl
  if (!grid) return null
  return cellAtPointer(ev.clientX, ev.clientY, grid.getBoundingClientRect(), desc, {
    cell: props.cell ?? 60,
    gap: props.gap ?? 16,
    cols: props.cols ?? 12,
    rows: props.rows ?? 8,
  })
}
```

- [ ] **Step 6: Confirm AddPanel is unchanged in behaviour**

```
pnpm vitest run src/home/components/AddPanel.test.ts src/home/components/AddPanel.spawn.test.ts src/home/components/AddPanel.spawn-place.test.ts --reporter=verbose
```

Expected: PASS with no edits to those files. If any needs changing, the refactor altered behaviour — stop and report rather than adjusting the test.

- [ ] **Step 7: Build**

```
pnpm build
```

Expected: success.

- [ ] **Step 8: Commit**

```
git add src/home/grid/pointerMath.ts src/home/grid/pointerMath.test.ts src/home/components/AddPanel.vue
```
```
git commit -s -m "refactor(home): share the pointer-to-grid-cell hit test

The dock is about to need the same answer the add panel already computes, and the
two must agree: both use it to decide whether a release counts as a placement, and
null is how "not over the grid" is expressed. A second implementation would be a
second chance to disagree.

Pure move plus a thin adapter; the add panel's own tests pass untouched, which is
the point of doing it as its own commit."
```

---

