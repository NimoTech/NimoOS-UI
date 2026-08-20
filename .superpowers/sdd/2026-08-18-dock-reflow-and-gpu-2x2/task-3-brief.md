## Task 3: The reflow's arithmetic

**Files:**
- Modify: `src/home/grid/dockMath.ts` (add at the end)
- Modify: `src/home/grid/dockMath.test.ts` (add at the end)

**Interfaces:**
- Produces, consumed by Task 4:
  - `export interface DockShift { key: string; slots: -1 | 0 | 1 }`
  - `export function slotShifts(keys: string[], holeIndex: number, insertAt: number | null): DockShift[]`

**The model, which the owner confirmed.** While an icon is dragged, **each zone has `keys.length + 1` slots**, where `keys` is that zone's remaining icons. One slot is empty:

- in the zone the icon came from, the empty slot is the icon's own former index;
- in the other zone, one spare slot is appended, so the empty slot is at index `keys.length`.

That uniformity is the point: a hole at the end *is* an appended spare, so both zones use one formula. Each zone reflows independently and nothing ever crosses the divider.

Moving the hole from `holeIndex` to `insertAt` shifts icon `keys[j]` by:

```
(j < insertAt ? j : j + 1) - (j < holeIndex ? j : j + 1)
```

which is only ever -1, 0 or +1. `insertAt === null` means the pointer is not in this zone, so the hole stays put and every shift is 0.

- [ ] **Step 1: Write the failing tests**

Append to `src/home/grid/dockMath.test.ts`:

```ts
import { slotShifts } from './dockMath'

// Each zone has keys.length + 1 slots while a drag is live: the dragged icon's own
// slot in the zone it came from, or an appended spare in the other zone. Moving the
// hole from holeIndex to insertAt is what opens a gap under the pointer.
describe('slotShifts', () => {
  const keys = ['a', 'b', 'c', 'd']
  const shifts = (hole: number, at: number | null) =>
    slotShifts(keys, hole, at).map((s) => s.slots)

  it('shifts nothing when the hole is already at the insertion point', () => {
    expect(shifts(2, 2)).toEqual([0, 0, 0, 0])
  })

  it('shifts nothing when the pointer is in the other zone', () => {
    expect(shifts(0, null)).toEqual([0, 0, 0, 0])
  })

  // Hole at the front, inserting further back: the icons in between close up
  // leftwards behind the pointer.
  it('pulls icons back when the hole moves forward', () => {
    expect(shifts(0, 3)).toEqual([-1, -1, -1, 0])
  })

  // Hole at the end (an appended spare), inserting near the front: everything from
  // the insertion point onward slides forward into the spare.
  it('pushes icons forward when the hole moves back', () => {
    expect(shifts(4, 1)).toEqual([0, 1, 1, 1])
  })

  it('handles the two ends as ordinary insertion points', () => {
    expect(shifts(4, 0)).toEqual([1, 1, 1, 1])
    expect(shifts(0, 4)).toEqual([-1, -1, -1, -1])
  })

  it('never reports a shift outside -1..1', () => {
    for (let hole = 0; hole <= keys.length; hole++) {
      for (let at = 0; at <= keys.length; at++) {
        for (const s of shifts(hole, at)) expect(Math.abs(s)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('keeps every key, in order', () => {
    expect(slotShifts(keys, 1, 3).map((s) => s.key)).toEqual(keys)
  })

  it('returns nothing for an empty zone', () => {
    expect(slotShifts([], 0, 0)).toEqual([])
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

```
pnpm vitest run src/home/grid/dockMath.test.ts --reporter=verbose
```

Expected: FAIL — `slotShifts` is not exported.

- [ ] **Step 3: Implement `slotShifts`**

Append to `src/home/grid/dockMath.ts`:

```ts
export interface DockShift { key: string; slots: -1 | 0 | 1 }

/**
 * How far each icon in one dock zone must move so a gap opens at `insertAt`.
 *
 * While a drag is live each zone has `keys.length + 1` slots and exactly one of
 * them is empty: the dragged icon's own former index in the zone it came from, or
 * an appended spare in the other zone. A hole at the end is the same thing as an
 * appended spare, which is why one formula serves both zones — and why the zones
 * can reflow independently, with nothing ever pushed across the divider.
 *
 * `insertAt` of null means the pointer is in the other zone: the hole stays where
 * it is and nothing moves. The result is a shift in whole slots, never more than
 * one, which the caller turns into pixels using the measured slot pitch.
 */
export function slotShifts(keys: string[], holeIndex: number, insertAt: number | null): DockShift[] {
  return keys.map((key, j) => {
    if (insertAt == null) return { key, slots: 0 as const }
    const to = j < insertAt ? j : j + 1
    const from = j < holeIndex ? j : j + 1
    return { key, slots: (to - from) as -1 | 0 | 1 }
  })
}
```

- [ ] **Step 4: Run them and confirm they pass**

```
pnpm vitest run src/home/grid/dockMath.test.ts --reporter=verbose
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```
git add src/home/grid/dockMath.ts src/home/grid/dockMath.test.ts
```
```
git commit -s -m "feat(home): compute how far each dock icon moves to open a gap

The model is the owner's and it is more economical than it looks. During a drag
each zone has one more slot than it has icons: the dragged icon's own slot in the
zone it came from, and one appended spare in the other. Since a hole at the end is
the same thing as an appended spare, both zones share a single formula, and each
can reflow without anything ever crossing the divider.

Kept as a pure function because jsdom reports every rect as zero and cannot
observe a transform, so this arithmetic is the only part of the reflow a unit test
can hold."
```

---

