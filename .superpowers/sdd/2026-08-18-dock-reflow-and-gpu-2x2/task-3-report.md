# Task 3 Report: The reflow's arithmetic

## Implementation Summary

Implemented the `slotShifts` pure function in `src/home/grid/dockMath.ts` that computes how far each dock icon must move to open a gap when dragging. The implementation follows the owner's economical model: during a drag, each zone has `keys.length + 1` slots with exactly one empty slot. A hole at the end is the same as an appended spare, allowing both zones to share a single formula and reflow independently.

The function returns an array of `DockShift` objects, each containing a key and a slot count (-1, 0, or +1), which Task 4 will convert to pixels using the measured slot pitch.

## Tests Added

Added 8 new test cases in `src/home/grid/dockMath.test.ts` covering:
1. **No shift when hole is at insertion point** — no movement needed
2. **No shift when pointer is in other zone** — `insertAt === null` means hole stays put
3. **Pull icons back** — hole moves forward, icons in between compress leftward
4. **Push icons forward** — hole moves backward, icons slide right into spare
5. **Edge cases** — properly handles insertion at both ends (0 and 4)
6. **Bounds check** — all shifts are constrained to [-1, 0, +1] across all combinations
7. **Key preservation** — output maintains input key order unchanged
8. **Empty zone** — gracefully handles empty icon array

## TDD Evidence

### RED: Tests Fail (Expected)

```bash
pnpm vitest run src/home/grid/dockMath.test.ts --reporter=verbose
```

**Result:** 8 failed tests
- All `slotShifts` tests reported `TypeError: slotShifts is not a function`
- This was the expected failure before implementation
- Pre-existing `dropTarget` and `dropTargetIn` tests all passed (10/10)

**Example failure:**
```
× src/home/grid/dockMath.test.ts > slotShifts > shifts nothing when the hole is already at the insertion point
  → slotShifts is not a function
```

### GREEN: Tests Pass (After Implementation)

```bash
pnpm vitest run src/home/grid/dockMath.test.ts --reporter=verbose
```

**Result:** All 18 tests pass
```
 Test Files  1 passed (1)
      Tests  18 passed (18)
   Start at  10:18:45
   Duration  686ms (transform 211ms, setup 320ms, import 18ms, tests 12ms, environment 225ms)
```

- All 10 pre-existing tests remain green
- All 8 new `slotShifts` tests now pass
- Zero failures, zero warnings, clean verbose output

## Files Changed

### `src/home/grid/dockMath.ts`
- Added `DockShift` interface: `{ key: string; slots: -1 | 0 | 1 }`
- Added `slotShifts` function (24 lines)
- Doc comment explaining the model and the `insertAt === null` behavior

### `src/home/grid/dockMath.test.ts`
- Updated import to include `slotShifts`
- Added 8 test cases in `describe('slotShifts', ...)` block (52 lines)
- Tests include edge cases, bounds checking, and invariant preservation

## Self-Review Findings

**Completeness:** ✓
- All 8 test cases from the brief included verbatim
- Implementation exactly matches the brief's code
- Doc comment and interface definition copied precisely
- No cherry-picking; all specs met

**Correctness of Implementation:** ✓
- Logic correctly computes slot shifts using the formula: `(j < insertAt ? j : j + 1) - (j < holeIndex ? j : j + 1)`
- Handles `insertAt === null` by returning all zeros
- Type-safe: slot shifts cast to `-1 | 0 | 1` with `as const`
- Edge case: empty zone (`keys.length === 0`) returns `[]` naturally via `map` on empty array

**Test Hygiene:** ✓
- Test helper function `shifts(hole, at)` cleanly extracts `.slots` for readability
- Eight distinct test cases each cover one behavior
- Comprehensive bounds test uses nested loops to verify all combinations of `hole` and `at` (0 to 4)
- No redundant assertions; each test is focused

**Commit Quality:** ✓
- Message follows imperative style: "compute how far each dock icon moves to open a gap"
- DCO `Signed-off-by:` trailer present (verified with `-s` flag)
- Commit message body explains the economical model and why jsdom forces this to be a pure function
- Exactly two files staged: `dockMath.ts` and `dockMath.test.ts`

**Pristine Test Output:** ✓
- All tests run with `--reporter=verbose` as specified
- No stderr warnings or spurious output
- 18/18 tests pass with consistent timing (~1ms per test)

## Concerns

None. The implementation is complete, correct, and ready for Task 4 consumption.
