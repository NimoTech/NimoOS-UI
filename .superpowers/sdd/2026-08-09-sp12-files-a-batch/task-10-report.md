# Task 10 report — rail scrolls the selected tick into view

## Files changed

- `src/files/snapshot/TimeMachineRail.vue` — added `watch(() => props.selectedIndex, ...)` that scrolls the newly-selected tick into view with `scrollIntoView({ block: 'nearest' })`. Added `nextTick` and `watch` to the `vue` import list (previously `computed, onUnmounted, ref`).
- `src/files/snapshot/TimeMachineRail.test.ts` — added a `manyGroups()` helper (50 items, enough to overflow the rail's scroll container) and two new tests: `scrolls the newly selected tick into view` and `does not scroll when the selection did not change`. Added `nextTick` import from `vue`.

No other files touched. No colors changed. No i18n keys added (no new user-facing text).

## Step 2: confirm red

Command: `pnpm exec vitest run src/files/snapshot/TimeMachineRail.test.ts`

Output (before implementing the watch):

```
❯ src/files/snapshot/TimeMachineRail.test.ts (17 tests | 1 failed) 113ms
     × scrolls the newly selected tick into view 20ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/files/snapshot/TimeMachineRail.test.ts > TimeMachineRail > scrolls the newly selected tick into view
AssertionError: expected "vi.fn()" to be called at least once
 ❯ src/files/snapshot/TimeMachineRail.test.ts:178:17
    176|     await w.setProps({ selectedIndex: 40 })
    177|     await nextTick()
    178|     expect(spy).toHaveBeenCalled()
       |                 ^
    179|   })

 Test Files  1 failed (1)
      Tests  1 failed | 16 passed (17)
```

Note: the second new test (`does not scroll when the selection did not change`) was green even before the implementation existed — that's expected and correct, since it asserts the *absence* of a call, and there's nothing to call it yet. The meaningful red/green signal is entirely on the first test. This is called out explicitly per the "report honestly if a test passes for the wrong reason" instruction — it is not a false-positive here, just a test whose assertion direction happens to be satisfied trivially in the pre-implementation state, which is the correct/expected behavior for that assertion.

## Step 4: confirm green

Command: `pnpm exec vitest run src/files/snapshot/TimeMachineRail.test.ts`

Output (after implementing the watch):

```
 Test Files  1 passed (1)
      Tests  17 passed (17)
   Start at  00:14:47
   Duration  858ms
```

All 17 tests (15 pre-existing + 2 new) pass.

## Mutation verification

Commented out the entire `watch(...)` block in `TimeMachineRail.vue` (replaced with a single-line `// MUTATION TEST: temporarily disabled...` comment, no other change), then re-ran:

Command: `pnpm exec vitest run src/files/snapshot/TimeMachineRail.test.ts`

Output (watch disabled):

```
❯ src/files/snapshot/TimeMachineRail.test.ts (17 tests | 1 failed) 114ms
     × scrolls the newly selected tick into view 20ms

 FAIL  src/files/snapshot/TimeMachineRail.test.ts > TimeMachineRail > scrolls the newly selected tick into view
AssertionError: expected "vi.fn()" to be called at least once
 ❯ src/files/snapshot/TimeMachineRail.test.ts:178:17

 Test Files  1 failed (1)
      Tests  1 failed | 16 passed (17)
```

Restored the `watch` block (copied back from a pre-mutation backup), re-ran:

```
 Test Files  1 passed (1)
      Tests  17 passed (17)
```

The mutation confirms `scrolls the newly selected tick into view` is load-bearing on the new `watch`: red without it, green with it. `does not scroll when the selection did not change` stayed green in both directions, as expected for a negative assertion (it doesn't independently prove the watch exists, but it does guard against a future implementation that scrolls unconditionally on every prop update, e.g. inside a `computed`/render-triggered scroll rather than a `selectedIndex`-keyed watch).

## Concerns / things I'm not 100% certain about

- The "does not scroll" test only proves the scroll isn't wired to *unrelated* prop changes (`groups` changing while `selectedIndex` stays put); it would not catch an implementation that scrolls on every render tick regardless of cause. This is inherent to a negative assertion and matches what the brief's Step 1 code specified verbatim — flagging it rather than silently accepting it as a complete guarantee.
- Did not run `pnpm exec vue-tsc --noEmit` or the full `pnpm test` suite per the task's explicit instruction to only run the single test file with `vitest run` and not the full suite.

## Commit

```
git add src/files/snapshot/TimeMachineRail.vue src/files/snapshot/TimeMachineRail.test.ts
git commit -m "fix(files): keep the selected tick in view on the time machine rail

With a hundred snapshots the rail scrolls, and stepping past the visible
range moved the deck and the bar but left the rail looking frozen."
```

---

## Follow-up: regression fix (unhandled rejection from scrollIntoView)

Reported by the coordinator after Task 13 ran the wider `src/files/snapshot/` suite and
surfaced 31 "Unhandled Rejection" errors that Task 13 (incorrectly) treated as a pre-existing
issue. Confirmed the regression is mine: `git show 71f8aae:src/files/snapshot/TimeMachineRail.vue
| grep -c scrollIntoView` returns 0, i.e. the call did not exist before this task's commit.

### Root cause

jsdom does not implement `Element.prototype.scrollIntoView`. My own test file
(`TimeMachineRail.test.ts`) stubs it per-test with `Element.prototype.scrollIntoView = spy`,
so it never saw the gap. But `TimeMachineOverlay.test.ts` (and other tests in the same
directory) also mount `TimeMachineRail` without that stub, and every one of those mounts
now hits the new `watch` and throws `TypeError: el?.scrollIntoView is not a function`. Because
the throw happens inside an `async` watch callback (`await nextTick()` before the call), it
surfaces as an *unhandled promise rejection* rather than a synchronous test failure — so the
affected tests still reported green, but the suite run printed 31 error blocks.

### Fix chosen: (a) global no-op stub in `vitest.setup.ts`

Went with the coordinator's preferred option: added a no-op stub for
`Element.prototype.scrollIntoView` to `vitest.setup.ts`, with a comment explaining the jsdom
gap and why the throw manifested as an unhandled rejection rather than a normal failure.

Reasoning for (a) over (b) (`el?.scrollIntoView?.(...)` in production code): the missing
capability lives in the test environment, not in production robustness — real browsers all
implement `scrollIntoView`, so an optional-call guard in production code would only ever
protect against a jsdom-only gap while silently masking a genuine "element not found" bug in
production (the `el?.` check already handles "no element", which is the real defensive case).
Fixing the environment gap once, globally, benefits every current and future test that mounts
`TimeMachineRail` (or any future component that scrolls), rather than special-casing one
call site.

Confirmed the global stub coexists correctly with the per-test spy in
`TimeMachineRail.test.ts`: the setup file's `Element.prototype.scrollIntoView = () => {}` runs
once when the test file's module graph loads (before any test body runs), and each test in
`TimeMachineRail.test.ts` that needs to observe calls does `Element.prototype.scrollIntoView =
spy` inside the test body, which simply reassigns the same prototype property and overwrites
the default for that test — no ordering conflict, evidenced by all 17 tests in that file
staying green after the setup change (see below).

### File changed

- `vitest.setup.ts` — added `Element.prototype.scrollIntoView = () => {}` with an explanatory
  comment. No other file touched (`TimeMachineRail.vue` and `TimeMachineRail.test.ts` are
  unchanged from the original Task 10 commit).

### Verification: before the fix

Command: `pnpm exec vitest run src/files/snapshot/`

```
 Test Files  8 passed (8)
      Tests  100 passed (100)
     Errors  31 errors
   Start at  00:35:53
```

(31 "Unhandled Rejection — TypeError: el?.scrollIntoView is not a function" blocks printed,
all attributed to `TimeMachineOverlay.test.ts` mounting the rail without a stub.)

### Verification: after the fix

Command: `pnpm exec vitest run src/files/snapshot/`

```
 Test Files  8 passed (8)
      Tests  100 passed (100)
   Start at  00:36:10
   Duration  2.45s (transform 2.72s, setup 2.15s, import 3.38s, tests 1.44s, environment 3.02s)
```

No `Errors` line at all — vitest only prints that line when the count is nonzero, so its
absence here means **Errors: 0** (confirmed by full untruncated output, not just tail).

Command: `pnpm exec vitest run src/files/snapshot/TimeMachineRail.test.ts`

```
 Test Files  1 passed (1)
      Tests  17 passed (17)
   Start at  00:36:19
   Duration  827ms (transform 270ms, setup 293ms, import 94ms, tests 116ms, environment 217ms)
```

Also zero errors, and the original two Task 10 tests still pass alongside the other 15.

### Mutation verification re-run (with the global stub now in place)

Re-commented out the entire `watch(...)` block in `TimeMachineRail.vue` (same single-line
`// MUTATION TEST: ...` replacement as before) and re-ran:

Command: `pnpm exec vitest run src/files/snapshot/TimeMachineRail.test.ts`

```
❯ src/files/snapshot/TimeMachineRail.test.ts (17 tests | 1 failed) 142ms
     × scrolls the newly selected tick into view 24ms

 FAIL  src/files/snapshot/TimeMachineRail.test.ts > TimeMachineRail > scrolls the newly selected tick into view
AssertionError: expected "vi.fn()" to be called at least once
 ❯ src/files/snapshot/TimeMachineRail.test.ts:178:17

 Test Files  1 failed (1)
      Tests  1 failed | 16 passed (17)
```

Confirms the global stub did not neuter the mutation test: the first new test still goes red
when the `watch` is removed, because the per-test spy still overrides the global no-op and
still observes zero calls. Restored the `watch` block and re-ran both suites (results shown
above under "after the fix") — all green, zero errors.

### Commit

```
git add vitest.setup.ts
git commit -m "fix(test): stub scrollIntoView globally to stop unhandled rejections

jsdom does not implement Element.prototype.scrollIntoView. TimeMachineRail's
new "keep the selected tick in view" watch (introduced in 4960cd2) calls it
from an async callback, so any other test that mounts the rail without its
own spy -- e.g. TimeMachineOverlay.test.ts -- throws inside an unhandled
promise rejection rather than a normal assertion failure. The affected tests
still passed, but the suite printed 31 "Unhandled Rejection" errors that
could bury a real failure. Stub the method as a no-op in the global test
setup; per-test spies (TimeMachineRail.test.ts) still work by reassigning
the same prototype property for the duration of that test."
```

Commit hash: `e2883de`.

### Concerns

- Did not run the full repo-wide `pnpm test` (only `src/files/snapshot/` and the single rail
  test file), per the coordinator's explicit instructions for this follow-up.
- **Correction to my own earlier reasoning**: while drafting the "(a) vs (b)" justification I
  claimed "no other production code path uses it" — that's wrong, and I want to flag it rather
  than let it stand uncorrected. A grep of `src/` turns up two different existing conventions
  for this same jsdom gap:
  - `src/ai/components/shell/MentionPopover.vue:282`, `SlashPopover.vue:179`,
    `src/apps/views/AppSettingsPage.vue:71`, and `src/views/PhotosSettings.vue:87` already call
    it defensively as `el?.scrollIntoView?.(...)`, with comments explicitly saying this is
    because "jsdom doesn't implement scrollIntoView".
  - `src/views/Files.vue:457` and `src/files/viewers/MediaViewer.vue:205` call it unguarded
    (`el.scrollIntoView(...)` / `el?.scrollIntoView(...)`, guarding only element existence, not
    method existence) — the same shape my `TimeMachineRail.vue` code uses, and presumably relying
    on per-test stubs the way `TimeMachineRail.test.ts` originally did before this regression
    surfaced.
  So the codebase is split, not uniformly (b). Given that split, I kept the global stub (a)
  rather than switching my call site to double-optional-chaining, because (a) fixes the actual
  proximate cause (an environment gap, not a defensive-coding gap) for every current and future
  caller in the unguarded-style camp at once, matches the coordinator's stated preference, and
  is what I already verified end-to-end. I'm flagging the mixed precedent rather than silently
  picking a side — a reasonable case exists for retrofitting `?.scrollIntoView?.()` onto
  `Files.vue`/`MediaViewer.vue`/`TimeMachineRail.vue` for consistency with the other four call
  sites, but that's a separate, pre-existing inconsistency this task did not introduce and is
  out of this task's scope to unify.
