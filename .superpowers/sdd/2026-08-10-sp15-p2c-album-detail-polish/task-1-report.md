# Task 1 report: `useFixedMenuPosition` composable

## What was implemented

- `src/photos/composables/useFixedMenuPosition.ts` — Vue 3 composable port of Vue2's
  `fixedMoreMenu.js` Options-API mixin (`33b05636:src/views/Photos/fixedMoreMenu.js`).
  Signature matches the brief exactly:
  `useFixedMenuPosition(open: Ref<boolean>, btnRef: Ref<HTMLElement | null>): { menuStyle: Ref<...> }`.
  - `ESTIMATED_MENU_HEIGHT = 340` (five-entry menu estimate, unchanged from Vue2).
  - Right-edge alignment: `right = (window.innerWidth - rect.right) + 'px'`.
  - `zIndex: 260`.
  - Downward by default: `top = rect.bottom + 6`; flips to `bottom = window.innerHeight - rect.top + 6`
    only when space below is short **and** space above is larger (`spaceBelow < 340 && rect.top > spaceBelow`).
  - scroll listener registered with `capture: true` so it also catches scrolls inside
    `.sv-detail-side`'s internal scroll container, which don't bubble to `window`.
  - `watch(open, ...)` binds/places on open, unbinds on close; `onBeforeUnmount(unbind)` cleans
    up if the host unmounts while the menu is still open (Vue3 rename from Vue2's `beforeDestroy`).
  - No-op (`menuStyle` stays `{}`) when `btnRef.value` is null.
- `src/photos/composables/__tests__/useFixedMenuPosition.test.ts` — 8 tests, written verbatim
  from the brief (no deviations needed; the repo's existing composable tests under
  `src/photos/composables/__tests__/` use the same `@vue/test-utils` `mount`-a-host-component
  pattern for testing lifecycle hooks, so the brief's fixture matched house style as-is).

Both files are 100% English (comments, test titles, commit message) per the phase's global
constraint. `git diff --cached | grep -nP '^\+.*[\x{4e00}-\x{9fff}]'` on the staged diff found
no CJK characters. No hardcoded colours (pure TypeScript, no CSS in this task).

## TDD evidence

**RED** — `pnpm exec vitest run src/photos/composables/__tests__/useFixedMenuPosition.test.ts`
(test file written, implementation file did not yet exist):

```
FAIL  src/photos/composables/__tests__/useFixedMenuPosition.test.ts [ ... ]
Error: Failed to resolve import "../useFixedMenuPosition" from
"src/photos/composables/__tests__/useFixedMenuPosition.test.ts". Does the file exist?
```

Expected failure per the brief (Step 2) — confirmed verbatim.

**GREEN** — same command, after writing `useFixedMenuPosition.ts`:

```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

Also ran with `--reporter=verbose` to surface any hidden `[Vue warn]` noise from passing
tests (per this repo's known vitest-reporter gap) — output was pristine, all 8 tests listed
individually with no warnings.

## Mutation verification (Step 5) — all three confirmed load-bearing

1. **Removed `true` (capture) from `addEventListener('scroll', ...)`.**
   Result: exactly 1 test failed — `closes the menu on a scroll anywhere in the page,
   including inside a scroll container` (assertion `expected true to be false`, i.e. the
   inner-node scroll no longer closed the menu). All 7 other tests still passed. Reverted;
   suite back to 8/8 green.

2. **Removed `&& rect.top > spaceBelow` from the flip condition** (left bare
   `if (spaceBelow < ESTIMATED_MENU_HEIGHT)`).
   Result: exactly 1 test failed — `does not flip when the space below is short but the space
   above is even shorter` (expected `top` to be `'306px'`, got `undefined` because it flipped
   to `bottom` instead). All 7 other tests still passed. Reverted; suite back to 8/8 green.

3. **Removed `onBeforeUnmount(unbind)`.**
   Result: exactly 1 test failed — `removes its listeners on unmount while still open`
   (`removeEventListener` mock: 0 calls, expected a call with `('scroll', fn, true)`). All 7
   other tests still passed. Reverted; suite back to 8/8 green.

All three named tests are confirmed to actually test what their titles claim — no test needed
fixing.

## Type check

`pnpm exec vue-tsc --noEmit` — clean, no output, exit 0.

## Files changed

- `src/photos/composables/useFixedMenuPosition.ts` (new)
- `src/photos/composables/__tests__/useFixedMenuPosition.test.ts` (new)

Commit: `d639dfc` — `feat(photos): add the shared fixed-position menu composable`.

## Self-review

- **Completeness:** every brief requirement met — exact signature, exact constants (340, 260,
  +6 offsets), capture-phase scroll listener, flip condition with both halves, null-ref no-op,
  onBeforeUnmount cleanup, watcher wiring open/close through place()/unbind().
- **Quality:** names (`bind`/`unbind`/`place`/`onScrollOrResize`) match the brief's own
  implementation; comments explain *why* (capture phase, estimate-not-measure, teardown
  ownership) not just *what*.
- **Discipline (YAGNI):** nothing beyond the brief was added — no shared component, no shared
  stylesheet, no extra options/config surface. Matches the owner ruling to share logic only.
- **Testing:** all 8 tests exercise real DOM behaviour (`getBoundingClientRect` overrides,
  real `dispatchEvent`, real `@vue/test-utils` mount/unmount) rather than mocking the unit
  under test; mutation testing confirms each assertion is load-bearing, not vacuously true.

## Concerns

None. The brief's test fixture matched this repo's existing composable-test conventions
without modification, so no deviation to report.

## Review round 1 — fixes applied

Review returned 1 Important + 1 Minor, both fixed in this round.

### Important — return type deviated from the frozen signature

`useFixedMenuPosition.ts` returned `Ref<Record<string, string | number>>`, but the brief's
Interfaces section (line 10) freezes the contract as `Ref<Record<string, string>>`, and two
later tasks (T5, T7) consume it verbatim. Root cause: the brief's own implementation code
block (Step 3) had `zIndex: 260` as a bare number, which forced the type to widen — a defect
in the plan, not an implementation error, per the controller's ruling that the Interfaces
section governs.

Fix:
- `useFixedMenuPosition.ts`: `zIndex: 260` → `zIndex: '260'`; narrowed both the ref's type
  parameter and the function's return type from `Record<string, string | number>` to
  `Record<string, string>`.
- `useFixedMenuPosition.test.ts`: `expect(h1.style.zIndex).toBe(260)` → `.toBe('260')` to stay
  honest with the new type.

Vue's style patcher (`patchStyle`) coerces numeric and string CSS custom values identically
when applied via `:style`, so this is a type-only change with no runtime behaviour
difference.

### Minor — stale comment contradicted its own fixture

`useFixedMenuPosition.test.ts`'s third test ("does not flip when the space below is short but
the space above is even shorter") had a comment reading "rect.top (270) > 100 -> flips" while
the fixture two lines below used `top: 50` — leftover text from an earlier draft, and it told
the reader the opposite of what the fixture does. That test is exactly the one that gives
mutation 2 (dropping `&& rect.top > spaceBelow`) its discriminating power, so a misleading
comment there matters.

Fix: rewrote the comment to state the actual numbers — spaceBelow is 100 (< the 340
estimate, first half holds), rect.top is 50 which is NOT greater than 100 (second half
fails), so the menu must still open downward — and to spell out why a mutant dropping the
second half would flip here and fail the assertions.

### Verification after fixes

Ran in the foreground:

```
pnpm exec vitest run src/photos/composables/__tests__/useFixedMenuPosition.test.ts
```
```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

```
pnpm exec vue-tsc --noEmit
```
Clean, no output, exit 0.

Both commands cover the fixed code directly: the vitest run re-executes the updated
`zIndex: '260'` assertion (which would fail if the type/value mismatch were still present),
and `vue-tsc` confirms the narrowed `Record<string, string>` type-checks cleanly against its
only two callers so far (the composable itself and the test file) — the frozen contract that
T5/T7 will build against.

### Files changed (this round)

- `src/photos/composables/useFixedMenuPosition.ts` — type narrowing + `zIndex` string fix
- `src/photos/composables/__tests__/useFixedMenuPosition.test.ts` — assertion + comment fix

Commit: `946560a` — `fix(photos): narrow menuStyle to Record<string, string> per frozen interface`
