# Task 2 report: switch off the dock's fisheye magnification

## What I implemented

Exactly per brief, with the one specified deviation on the shared import:

1. **`src/home/components/HomeDock.test.ts`** — added the new test `no longer
   magnifies icons on hover` inside `describe('HomeDock', ...)`, verbatim from the
   brief, placed as the first test in the block.
2. **`src/home/components/HomeDock.vue`**:
   - Dropped `@pointermove="onMove" @pointerleave="reset"` from the `<nav>` tag,
     leaving `@pointerdown.capture="onDragStart"` untouched.
   - Removed `magScale` from the `dockMath` import list (kept `dropTargetIn`,
     `DockSlot`, `DockGeometry`, `DropDecision` live), and added the commented-out
     `// import { magScale } from '../grid/dockMath'` with the one-line reason
     above it.
   - Commented out `onMove` and `reset` function bodies in full, with the
     `// ── Magnification (switched off; ...) ──` header.
3. **`src/home/grid/dockMath.ts`** — replaced lines 1-5 (the live `MAG_AMP`,
   `MAG_SIGMA`, `magScale`) with the commented-out block and reason, verbatim
   from the brief.
4. **`src/home/grid/dockMath.test.ts`** — applied the resolution specified in my
   task message rather than a literal reading of the brief (which would have
   broken `dropTarget`/`dropTargetIn`): removed only the `magScale` name from the
   shared import line, keeping `dropTarget`, `dropTargetIn`, and the three types
   live; commented out only the `describe('magScale', ...)` block, with the
   commented import (`// import { magScale } from './dockMath'`) and the same
   one-line reason placed just above it. Left `describe('dropTarget', ...)` and
   `describe('dropTargetIn (placeholder feedback)', ...)` completely untouched.

`dropTarget`, `dropTargetIn`, `measureGeometry`, the `geom` snapshot, and
`onResize` in `HomeDock.vue` were not touched at all (confirmed by diff review).
`src/styles/theme.css` was not touched (confirmed empty `git diff master --
src/styles/theme.css`).

## TDD evidence

**RED** — `pnpm vitest run src/home/components/HomeDock.test.ts --reporter=verbose`
(run before Steps 3-4, with the new test added but `onMove`/`reset` still live):

```
 × src/home/components/HomeDock.test.ts > HomeDock > no longer magnifies icons on hover 38ms
   → expected 9 to be +0 // Object.is equality
 ...
 Tests  1 failed | 14 passed (15)
```

Failed exactly as expected: `onMove` was still wired to `@pointermove` and set
`--mag` on all 9 `.dock-ic` elements on the pointermove trigger, so
`styled.length` was 9, not 0.

**GREEN** — after Steps 3-4, `pnpm vitest run src/home/components/HomeDock.test.ts
src/home/grid/dockMath.test.ts --reporter=verbose`:

```
 Test Files  2 passed (2)
      Tests  25 passed (25)
```

All 25 tests pass, including the new test, the pre-existing drag/placeholder
tests in `HomeDock.test.ts`, and the pre-existing `dropTarget` /
`dropTargetIn (placeholder feedback)` suites in `dockMath.test.ts`. No stderr
output from any test (checked via `--reporter=verbose`).

**Build** — `pnpm build` (`vue-tsc --noEmit && vite build`): succeeded, `✓ built
in 18.40s`. No type errors — confirms no dangling reference to `onMove`,
`reset`, or `magScale` from the template or elsewhere (a plain grep afterwards
also confirms every remaining occurrence of those three names is inside a `//`
comment).

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch/src/home/components/HomeDock.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch/src/home/components/HomeDock.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch/src/home/grid/dockMath.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch/src/home/grid/dockMath.test.ts`

Commit: `6d7e3bc2` — `feat(home): switch off the dock's fisheye magnification`
(signed off via the repo's global sign-off hook; `git log` confirms
`Signed-off-by: Tiansanchuan <1312528051@qq.com>`).

## Self-review

- Diffs for all four files match the brief's exact snippets, with only the
  deliberate, task-message-directed deviation on the `dockMath.test.ts` import
  (kept `dropTarget`/`dropTargetIn` live rather than commenting the whole
  shared import line).
- No live code references to `onMove`, `reset`, or `magScale` remain outside
  comments — verified by grep and confirmed transitively by `vue-tsc` passing.
- `dropTarget`, `dropTargetIn`, `measureGeometry`, `geom`, `resolveDrop`,
  `onResize` in `HomeDock.vue`, and the `@pointerdown.capture="onDragStart"`
  binding plus the `if (!dock.expanded.value) return` gate at the top of
  `onDragStart`, are all untouched — confirmed by reading the diff (no hunks
  touch any of these).
- The pre-existing test `expanded: pointerdown alone does NOT capture the
  pointer; crossing the drag threshold does` still passes (visible in the
  GREEN run above).
- `git status --short` after commit is empty — nothing left uncommitted,
  nothing accidentally staged from elsewhere.
- `git diff master -- src/styles/theme.css` is empty — the barred file was not
  touched.
- Comments are English-only; the new test's assertion message area contains no
  hardcoded Chinese (none was needed here — no locale copy is asserted by this
  test).
- No `git add -A` / `git commit -a` used — staged the four named files
  explicitly.

## Concerns

None. The task is complete, scoped tests and build both pass, and the diff is
minimal and matches the brief plus the specified import resolution.
