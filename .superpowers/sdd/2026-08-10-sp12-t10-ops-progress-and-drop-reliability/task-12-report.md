# Task 12 report — DropItem progress watchdog

## What changed

- `src/files/drop/components/DropItem.vue`:
  - `defineEmits` extended (not replaced) with `'transfer-stalled': []`, alongside the
    existing `'select-files'` and `'cancel-transfer'` from Task 11.
  - New watchdog, exactly per the brief's Step 3 implementation:
    - `STALL_CHECK_MS = 5000`, `STALL_LIMIT_MS = 15000`.
    - A `watch(() => props.transfer?.progress, ...)` resets `lastMovedAt` whenever
      progress changes.
    - `startWatchdog()` / `stopWatchdog()` manage a single `setInterval` handle; the
      interval callback no-ops when there is no transfer or progress is at 0/100, and
      otherwise fires `emit('transfer-stalled')` (and stops itself) once
      `Date.now() - lastMovedAt >= STALL_LIMIT_MS`.
    - A `watch(() => !!props.transfer, ..., { immediate: true })` starts/stops the
      watchdog as the transfer prop appears/disappears.
    - `onBeforeUnmount(stopWatchdog)` clears the interval on teardown.
  - No redeclaration of `props` — reused the existing `const props = defineProps<...>()`
    from Task 11 as instructed.
- `src/files/drop/components/DropPage.vue`: added
  `@transfer-stalled="drop.cancelTransfer(p.peer.id)"` beside the existing
  `@cancel-transfer` binding on `<DropItem>`.
- `src/files/drop/components/DropItem.test.ts`: added the brief's
  `describe('DropItem stall watchdog', ...)` block with its four tests, but **strengthened
  two of them** beyond the brief's literal text after the mutation check revealed they
  were not actually killable as written (see below). No other file in the block was
  changed from the brief's text.

## Timer-mechanics checks called out in the task context

- Confirmed empirically (not just assumed) that `vi.useFakeTimers({ shouldAdvanceTime:
  true })` also fakes `Date.now()`, and that it advances in step with
  `vi.advanceTimersByTime`: the "reports a stall" test only passes because
  `Date.now() - lastMovedAt` inside the interval callback reaches 15000 after
  `vi.advanceTimersByTime(20000)`. Verified with an instrumented throwaway test
  (deleted afterward) that printed `Date.now()` and `lastMovedAt` on each tick.
- Confirmed the interval survives across `vi.advanceTimersByTime` boundaries and fires
  at every 5000ms tick as configured (`STALL_CHECK_MS`), not just once.

## A real finding: the brief's own "stops on unmount" test doesn't kill the mutation it names

Running the brief's Step 5 mutation exactly as written — deleting
`onBeforeUnmount(stopWatchdog)` and rerunning the suite — left **all 12 tests green**,
including "stops its timer on unmount so a torn-down card cannot fire". Investigated with
an instrumented throwaway test file (`__mutdebug.test.ts`, created under
`src/files/drop/components/` for the investigation and deleted before committing):

- Instrumenting the interval callback showed it **does** keep firing after `w.unmount()`
  once `onBeforeUnmount` is removed — the timer leaks exactly as expected from a missing
  cleanup.
- `emit('transfer-stalled')` **is** called from that leaked interval.
- But `w.emitted('transfer-stalled')` after the mutation still came back `{}` (nothing
  recorded), because Vue's own runtime guards `emit()` with
  `if (instance.isUnmounted) return;` (confirmed by reading
  `node_modules/.pnpm/vue@3.5.39_typescript@5.9.3/.../vue.runtime.esm-browser.js` around
  line 6678). Any emit call made after the component instance is marked unmounted is
  silently swallowed by Vue itself, regardless of whether the interval that triggered it
  was ever cleared.

So the brief's assertion (`expect(w.emitted('transfer-stalled')).toBeFalsy()`) is true
*unconditionally* once the component is unmounted — it can never distinguish "watchdog
correctly stopped" from "watchdog leaked but Vue silently dropped its emit." It is not a
real regression test for the described mutation; per the task's constraint to flag a test
that "cannot be killed by any mutation" rather than leave it looking like coverage, I am
reporting this plainly and additionally fixing it (see below) rather than leaving it as
dead-weight coverage while still committing the code the brief specified.

**Fix applied:** added `expect(vi.getTimerCount()).toBe(0)` right after `w.unmount()`,
before the emit assertion, in the "stops its timer on unmount" test. `vi.getTimerCount()`
reports pending fake timers directly — it isn't filtered by Vue's unmount guard — so it
distinguishes "interval was actually cleared" from "interval leaked but its emit got
swallowed." Verified empirically: with the correct implementation, timer count goes from
1 (before unmount) to 0 (after); with `onBeforeUnmount` removed, it stays at 1.

I applied the identical strengthening to "does not run at all when no transfer is in
flight" for the same reason: as originally written it only proved the watchdog never
*emits* when there's no transfer, which would also be true of a mutant that starts the
interval unconditionally on mount (the interval's own internal `!t` guard already
suppresses the emit in that case, so the emitted-event assertion alone can't see the
leak). Added `expect(vi.getTimerCount()).toBe(0)` right after mounting with no transfer.
Verified this closes the gap: a mutation replacing the `() => !!props.transfer` watch
source with `() => true` (always active) is caught by this assertion (timer count goes
to 1) but was previously invisible to the test.

The other two tests ("reports a stall...", "keeps quiet...") were checked and found to be
real, killable tests as originally written — see the per-test mutation results below.

## Exact test commands and output

Step 2 (before implementation, confirm red):
```
$ pnpm exec vitest run src/files/drop/components/DropItem.test.ts
 × DropItem stall watchdog > reports a stall when progress stops moving for long enough
   AssertionError: expected undefined to be truthy
 Test Files  1 failed (1)
      Tests  1 failed | 11 passed (12)
```
(The other three new tests were trivially green pre-implementation, since they assert
*absence* of an emit that nothing could produce yet — expected, matches the brief's
"第一条 FAIL" expectation exactly.)

Step 4 (after implementation):
```
$ pnpm exec vitest run src/files/drop/components/DropItem.test.ts
 Test Files  1 passed (1)
      Tests  12 passed (12)
```

Step 5 — brief's named mutation (`onBeforeUnmount(stopWatchdog)` deleted), rerun with the
**strengthened** test in place:
```
$ pnpm exec vitest run src/files/drop/components/DropItem.test.ts
 ❯ src/files/drop/components/DropItem.test.ts (12 tests | 1 failed)
     × stops its timer on unmount so a torn-down card cannot fire
AssertionError: expected 1 to be +0 // Object.is equality
- Expected: 0
+ Received: 1
 ❯ src/files/drop/components/DropItem.test.ts:145:34
 Test Files  1 failed (1)
      Tests  1 failed | 11 passed (12)
```
Restored `onBeforeUnmount(stopWatchdog)` → back to 12/12 green.

Additional mutation checks performed (not required by the brief, done per the task's
"consider whether each of your four tests has a mutation that kills it" instruction):

1. **"reports a stall..."** — mutation: replaced `emit('transfer-stalled')` with a no-op
   comment.
   ```
   × reports a stall when progress stops moving for long enough
     AssertionError: expected undefined to be truthy
   Tests  1 failed | 11 passed (12)
   ```
   Killed correctly, and only that one test failed. Restored, back to 12/12.

2. **"keeps quiet while progress is still advancing"** — mutation: removed the
   `watch(() => props.transfer?.progress, () => { lastMovedAt = Date.now() })` block
   entirely.
   ```
   × keeps quiet while progress is still advancing
     AssertionError: expected [ [] ] to be falsy
   Tests  1 failed | 11 passed (12)
   ```
   Killed correctly, and only that one test failed. Restored, back to 12/12.

3. **"does not run at all when no transfer is in flight"** (post-strengthening) —
   mutation: changed the immediate-watch source from `() => !!props.transfer` to
   `() => true`.
   ```
   × does not run at all when no transfer is in flight
   AssertionError: expected 1 to be +0 // Object.is equality
   Tests  1 failed | 11 passed (12)
   ```
   Killed correctly (this mutation was **not** caught before the strengthening — the
   pre-strengthening version of this test passed unchanged under the same mutation).
   Restored, back to 12/12.

4. **"stops its timer on unmount..."** (post-strengthening) — the brief's own named
   mutation, shown above under Step 5. Killed correctly after strengthening; was **not**
   killed before strengthening (12/12 green under the mutation, the false-negative
   documented above).

Final verification after restoring the clean implementation:
```
$ pnpm exec vitest run src/files/drop/
 Test Files  12 passed (12)
      Tests  85 passed (85)

$ pnpm exec vue-tsc --noEmit
(no output — clean)
```

## Per-test mutation assessment (summary)

| Test | Mutation that kills it | Verified |
|---|---|---|
| reports a stall when progress stops moving | remove `emit('transfer-stalled')` | yes |
| keeps quiet while progress is still advancing | remove the progress-reset `watch` | yes |
| does not run at all when no transfer is in flight | change active-gate to `() => true` (requires the added `vi.getTimerCount()` assertion — the original emit-only assertion does not catch this) | yes |
| stops its timer on unmount | remove `onBeforeUnmount(stopWatchdog)` (requires the added `vi.getTimerCount()` assertion — the original emit-only assertion does not catch this, because Vue's `emit()` silently no-ops post-unmount regardless of whether the interval was cleared) | yes |

All four tests, as committed, are real and independently killable. Two of them required
strengthening beyond the brief's literal text to make that true.

## Concerns

- The brief's literal test text for the last two `describe` cases would have shipped as
  non-functional coverage (would pass whether or not the underlying bug it describes is
  present). I did not treat "matches the brief" as sufficient and instead verified and
  fixed this before committing, per the task's explicit instruction to say so plainly
  rather than leave it looking like coverage. This is a note for whoever wrote/reviews
  this plan template — the `onBeforeUnmount`-removal mutation recipe for Vue emit-based
  components needs a timer-count or spy-based assertion, not an emitted-event assertion,
  because Vue's runtime itself suppresses post-unmount emits.
- No hardcoded colours introduced (none applicable to this change).
- `git diff --stat`: `DropItem.vue` +44/-2, `DropItem.test.ts` +63, `DropPage.vue` +1.
