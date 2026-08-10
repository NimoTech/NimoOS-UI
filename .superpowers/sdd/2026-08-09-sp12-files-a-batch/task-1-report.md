# Task 1 report: marquee teardown on unmount

## Status: DONE (with one noted discrepancy from the brief, see "Mutation verification")

## Files changed

- `src/views/Files.vue`
  - Added `data-marquee-surface` attribute to the `.files-main` div (the element with
    `@mousedown="onMarqueeDown"`), lines ~610-616.
  - Extracted `teardownMarquee()` (removes `mousemove`/`mouseup` on `window` and
    `selectstart` on `document`) and call it from `onMarqueeUp` instead of the inline
    three `removeEventListener` calls.
  - Added `onUnmounted(() => { armed = false; dragging = false; teardownMarquee() })`
    right after `onMarqueeUp`'s definition.
- `src/views/Files.marqueeTeardown.test.ts` (new): two tests, mounting `Files.vue` with
  the same router/i18n/service-mock/IntersectionObserver-stub scaffolding used in
  `src/views/Files.test.ts` (`mountFiles()` helper mirrors that file's per-test setup:
  `folders.loadDisks` stub, `router.push('/files/NimoOS-HD')`, `mount(Files, { global:
  { plugins: [router, i18n] }, attachTo: document.body })`).

## Step-by-step results

**Step 2 — confirm red (before implementation):**
```
pnpm exec vitest run src/views/Files.marqueeTeardown.test.ts
```
Result: 1 failed / 1 passed, as predicted by the brief.
- `stops suppressing text selection after the view unmounts mid-drag` FAILED at
  `expect(dispatchSelectStart()).toBe(false)` — actual `true` (selectstart still
  suppressed after unmount, matching the described bug).
- `stops tracking pointer movement after the view unmounts mid-drag` PASSED even
  before the fix (see "Mutation verification" below for why — it's a weak assertion).

**Step 4 — confirm green (after implementation):**
```
pnpm exec vitest run src/views/Files.marqueeTeardown.test.ts src/views/Files.test.ts
```
Result: 2 files passed, 26 tests passed, 0 failed. No regression in the existing
`Files.test.ts` suite.

Also ran `pnpm exec vue-tsc --noEmit` — clean, no errors.

## Mutation verification (Step 5)

Brief instructed: comment out only the `teardownMarquee()` line inside the new
`onUnmounted`, rerun, expect **both** tests to go red.

Actual result with only that one line commented out (leaving `armed = false` /
`dragging = false` in place):
```
pnpm exec vitest run src/views/Files.marqueeTeardown.test.ts
```
→ 1 failed / 1 passed:
- `stops suppressing text selection after the view unmounts mid-drag` → FAILED (red,
  as expected).
- `stops tracking pointer movement after the view unmounts mid-drag` → still PASSED
  (not red).

To make sure this wasn't specific to a partial mutation, I also tried commenting out
the **entire** `onUnmounted` block (including `armed = false` / `dragging = false`) —
i.e. reverting fully to the pre-fix behavior for teardown. Same result: still 1
failed / 1 passed; the pointer-tracking test never goes red.

**Why**: that second test only asserts `expect(() => window.dispatchEvent(...)).not
.toThrow()`. Inspecting `onMarqueeMove`/`collectSelection`, nothing in the code path
throws when the component has unmounted, regardless of whether the listener is still
attached — `listwrap.value` and `gridRef.value` are Vue template refs that become
`null` after unmount and are always accessed with optional chaining
(`listwrap.value?.querySelectorAll`, `gridRef.value?.itemRects`), and the Pinia store
references held in the closure remain valid objects (no throw on writing to a store
whose owning component has unmounted). So the "does not throw" assertion is true both
with and without the fix — it does not actually detect the leak described in the
brief for this codebase's implementation. I did not alter or drop this test since the
brief specifies it verbatim as one of the two required cases; I'm flagging the
discrepancy rather than fabricating a passing mutation result.

The first test (`selectstart` suppression) does correctly and robustly catch the
regression, which is the one described as "最难缠的" (nastiest) in the brief, so the
core bug is covered by real red/green evidence.

After verification, the mutation was reverted; `git diff` after revert showed no
change vs. the committed implementation (confirmed via `pnpm exec vitest run` green
again before committing).

## Commit

```
722ca7b fix(files): release marquee listeners when the view unmounts mid-drag
```
2 files changed (`src/views/Files.vue`, `src/views/Files.marqueeTeardown.test.ts`),
118 insertions, 3 deletions.

## Concerns / things I'm not fully certain about

1. The second test in the brief (`stops tracking pointer movement after the view
   unmounts mid-drag`) is not actually a strong regression guard for this codebase —
   see "Mutation verification" above. It still passes independent of the fix. I kept
   it as specified rather than modifying it, since the brief gives it as literal
   content to copy, but wanted this surfaced rather than silently reporting a clean
   mutation-test outcome that didn't happen.
2. No other files were touched. No visual/theme changes were made (none were in
   scope for this task).

---

## Fix round 1/5 (review finding on the weak second test)

**Status: BLOCKED — reporting findings for the coordinator to rule on, per explicit
instruction not to fabricate a passing mutation result.**

### What changed

Only `src/views/Files.marqueeTeardown.test.ts` was touched (per constraint 3,
`Files.vue` was not touched — confirmed with `git diff src/views/Files.vue` showing
no diff against the committed state, both before and after this round's experiments).

Replaced the second test (`stops tracking pointer movement after the view unmounts
mid-drag`, which asserted only `.not.toThrow()`) with an assertion on observable
store state, per the reviewer's suggested direction:

```ts
it('does not let a mousemove after unmount overwrite the selection', async () => {
  const wrapper = await mountFiles()
  const files = useFilesStore()

  const surface = wrapper.find('[data-marquee-surface]').element as HTMLElement
  surface.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 10, bubbles: true }))
  // Under jsdom every element reports a zero-width getBoundingClientRect, so the
  // grid view's virtualized geometry falls back to a single 120x130 column
  // (see gridVirtual.ts columnsFor(0, ...) === 1). A drag to (100, 100) deterministically
  // overlaps the first tile's rect {0,0,120,130} and produces a real, non-empty selection.
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }))
  const selectionWhileDragging = new Set(files.selected)
  expect(selectionWhileDragging.size).toBeGreaterThan(0) // sanity: the drag actually selected something

  wrapper.unmount()

  // On the leaking path this listener is still attached and still "dragging": it
  // re-runs collectSelection() against a view whose grid/list template refs are now
  // null, which measures zero item rects and overwrites the selection to empty.
  // A `.not.toThrow()` assertion cannot see this -- nothing throws, the store is
  // just silently wiped. Asserting on the store's observable selection can.
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 300 }))
  expect(new Set(files.selected)).toEqual(selectionWhileDragging)
})
```

Also added the `useFilesStore` import needed by the new test.

### Commands run and actual output (all foreground, `vitest run`)

**With the current fix in place (`Files.vue` unmodified, both `onUnmounted` lines and
`teardownMarquee()` intact):**
```
pnpm exec vitest run src/views/Files.marqueeTeardown.test.ts
```
→ `Test Files 1 passed (1)`, `Tests 2 passed (2)`. Both the `selectstart` test and the
new selection test pass.

```
pnpm exec vitest run src/views/Files.test.ts
```
→ `Test Files 1 passed (1)`, `Tests 24 passed (24)`. No regression in the existing
suite.

### Mutation verification — two variants tried, only one turns the new test red

**Mutation A (exactly as instructed): comment out only the `teardownMarquee()` call
inside `onUnmounted`, leaving `armed = false` / `dragging = false` in place.**
```ts
onUnmounted(() => {
  armed = false
  dragging = false
  // teardownMarquee()
})
```
Result:
```
pnpm exec vitest run src/views/Files.marqueeTeardown.test.ts
```
→ 1 failed / 1 passed. The `selectstart` test correctly goes red (unchanged from
round 1). **The new selection test still PASSES — it does not turn red under this
exact mutation.**

**Why, mechanically:** `onMarqueeMove` starts with `if (!armed) return`. Under
Mutation A, `armed = false` still executes inside `onUnmounted` (only the
`teardownMarquee()` line was commented out), so even though the `mousemove` listener
is still attached to `window` after unmount, every invocation of `onMarqueeMove`
returns immediately on that guard and never reaches `collectSelection()`. The
selection-corruption failure mode the new test targets is gated by the `armed`
flag, not by whether the listener was removed — so disabling only
`teardownMarquee()` cannot reproduce it. This is structurally different from the
`selectstart` test, whose failure mode (document listener firing
`preventDefault()`) has no `armed` guard at all and is gated purely by listener
removal, which is why that one test does correctly catch Mutation A.

**Mutation B (the reviewer's own repro, and the shape of the actual historical bug):
comment out the entire `onUnmounted` hook, including the `armed`/`dragging` resets.**
```ts
// onUnmounted(() => {
//   armed = false
//   dragging = false
//   teardownMarquee()
// })
```
Result:
```
pnpm exec vitest run src/views/Files.marqueeTeardown.test.ts
```
→ 2 failed / 2 passed → both tests fail. The new test's actual failure output:
```
AssertionError: expected Set{} to deeply equal Set{ '/DATA/Documents' }
- Expected: Set { "/DATA/Documents" }
+ Received: Set {}
```
This is exactly the corruption the reviewer described: the leaked listener re-runs
`collectSelection()` against null `gridRef`/`listwrap` refs, measures zero item
rects, and calls `files.setSelection([])`, wiping a real selection to empty. This
matches Mutation B because Mutation B is the actual shape of the pre-Task-1 bug —
there was no `onUnmounted` for marquee at all, so `armed`/`dragging` were never
reset either.

After both experiments, `Files.vue` was restored and reconfirmed via
`git diff src/views/Files.vue` (no output — clean, matches the already-reviewed
committed state) and by rerunning both test files green (see above).

### Why I'm not just picking Mutation B and calling it done

The coordinator's instruction was specific: comment out `teardownMarquee()` in
`onUnmounted` (Mutation A) and expect both tests to go red; if that doesn't hold,
report rather than substitute a different mutation on my own authority. I found
exactly that non-holding case, so per that instruction I'm surfacing it instead of
quietly validating the test against Mutation B and declaring compliance.

For what it's worth, my own read: the new test is not fake — it does catch the real,
historical bug shape (Mutation B), which is the only shape that shipped without any
`Files.vue` change at all before Task 1. Mutation A is a synthetic middle state that
doesn't correspond to any bug that has existed or is a de-fix. But that's a judgment
call about which mutation is the "correct" one to gate on, and the coordinator asked
to make that call themselves if this happened.

### Coordinator's ruling (received)

The coordinator confirmed the analysis above and ruled: **the mutation gate for this
test is "delete the whole `onUnmounted` hook" (Mutation B), not the single-line
mutation (Mutation A) originally specified.** Reasoning given:

1. Under Mutation A, the leaked `mousemove`/`mouseup` listeners early-return on
   `armed === false` regardless of attachment — their only remaining consequence is a
   memory leak (dangling window listeners across mount/unmount cycles), which is
   internal implementation state, not observable behavior. Asserting on listener
   counts to catch that would violate the same "don't assert on implementation
   details" principle the brief already established for this file.
2. The `teardownMarquee()` line has its own dedicated coverage already: the
   `selectstart` test (test 1) goes red on exactly that single-line mutation, as
   verified in round 1 and reconfirmed above.
3. Together the two tests cover both failure surfaces completely: delete the single
   line → test 1 goes red; delete the whole hook → both tests go red.

No further mutation experiments were required — the two variants and outputs
recorded above already demonstrate this split. A scoped English comment was added
directly above the second test explaining what it does and does not catch, so a
future reader doesn't have to rediscover this reasoning by re-running mutations.

### Final verification (foreground, before commit)

```
pnpm exec vitest run src/views/Files.marqueeTeardown.test.ts src/views/Files.test.ts
```
→ `Test Files 2 passed (2)`, `Tests 26 passed (26)`.

### Commit

```
49f9d44 test(files): scope the marquee-teardown selection test to its real mutation gate
```
Only `src/views/Files.marqueeTeardown.test.ts` changed in this round; `src/views/Files.vue`
remains exactly as committed in round 1 (`722ca7b`).
