# Task 6 report: drag an app from the dock onto the desktop

## What was implemented

- `src/views/Home.vue`: `<HomeDock>` now receives the same five grid-geometry
  props (`cell`, `gap`, `cols`, `rows`, `grid-el`) that `<AddPanel>` already
  receives on the next line.
- `src/home/components/HomeDock.vue`:
  - `defineProps<{ cell?; gap?; cols?; rows?; gridEl? }>()`.
  - `useHomeUiStore()` and `useAddPanel({ cols, rows })` alongside the other
    composable calls.
  - `gridCellAt(clientX, clientY)`: wraps `cellAtPointer` from
    `src/home/grid/pointerMath.ts` with the same geometry shape `AddPanel.vue`
    already builds, returning `null` when the pointer is off the grid.
  - `onDragMove`: when `gridCellAt` returns a cell, the dock's own
    `toZone`/`beforeKey` preview is cleared (`null`/`null`) and
    `homeUi.spawnGhost` is set to preview that cell; otherwise `spawnGhost` is
    cleared and the pre-existing `if (geom) { resolveDrop... }` block runs
    unchanged.
  - `onDragEnd`: after restoring the dragged icon's opacity,
    `homeUi.spawnGhost = null` runs unconditionally, then a new branch —
    if `gridCellAt` returns a cell, `addPanel.spawnPlace({ kind: 'app', key:
    drag.key, w: 1, h: 1 }, cell.tc, cell.tr)` is called, the click-suppression
    (`dock.justDragged`) still fires, `resetDragState()` runs, and the function
    returns before reaching the existing `dock.reorder(...)` call.
  - `onDragCancel` and `resetDragState` also clear `homeUi.spawnGhost`, so an
    interrupted gesture leaves no stale ghost.
- `src/home/components/HomeDock.test.ts`: added the `vi.hoisted` mock of
  `useAddPanel` and the three tests from the brief verbatim, with one
  necessary type fix (below).

## Reconciling the brief's `onDragMove` sketch with the two-pass measurement / `if (geom)` gate

The brief's sketch replaces the tail of `onDragMove` with a single `if (cell)
{...} else { ...resolveDrop... }` shape, which would have removed the existing
`if (geom)` gate outright. That gate exists so the dock never flashes a wrong
zone/beforeKey preview during the one frame between drag-activation and the
post-reservation geometry snapshot landing (see the pre-existing comment
directly above it). `cellAtPointer` does not depend on that per-drag dock
snapshot at all — it only needs the grid's own (constant, already-measured)
rect and cell size — so it doesn't need to wait on `geom`.

I kept both gates, nested rather than merged:

```ts
const cell = gridCellAt(e.clientX, e.clientY)
if (cell) {
  drag.toZone = null
  drag.beforeKey = null
  homeUi.spawnGhost = { c: cell.tc, r: cell.tr, w: 1, h: 1, ok: true }
  return
}
homeUi.spawnGhost = null

// ...existing comment...
if (geom) {
  const target = resolveDrop(e.clientX)
  drag.toZone = target.toZone
  drag.beforeKey = target.beforeKey
}
```

The grid-ghost branch runs regardless of `geom` (it never needed it); the
dock-reflow branch still runs only once `geom` has landed, exactly as before.
This preserves the "no wrong preview for one frame" invariant the two
pre-existing snapshot tests (`drops where the reflow was previewed...`,
`re-measures on resize...`) depend on — both still pass unmodified.

`onDragEnd`'s branch is a plain early-return before the existing
`dock.reorder(...)` call, as the brief sketched; that part needed no
reconciliation since `onDragEnd` doesn't touch `geom` at all.

## One necessary deviation from the brief's verbatim test code

The brief's exact mock line:

```ts
const { spawnPlace } = vi.hoisted(() => ({ spawnPlace: vi.fn(() => true) }))
```

fails `vue-tsc` (`pnpm build`) with `TS2493: Tuple type '[]' of length '0' has
no element at index '0'.` at `spawnPlace.mock.calls[0][0]` — vitest 4 infers
`spawnPlace`'s call-tuple type from the zero-argument arrow function literal,
so `.mock.calls[0]` types as an empty tuple. Fixed by giving the mock an
explicit 3-argument signature (same runtime behaviour, `-> true` unconditionally):

```ts
const { spawnPlace } = vi.hoisted(() => ({ spawnPlace: vi.fn((_desc: unknown, _tc: number, _tr: number) => true) }))
```

No other test code was changed from the brief's verbatim listing.

## Tests

TDD evidence:

**RED** — `pnpm vitest run src/home/components/HomeDock.test.ts --reporter=verbose`
(after Step 1, before Step 3/4 implementation):
```
✓ ...12 pre-existing tests...
× HomeDock > adds a copy to the desktop when released over the grid
   → expected "vi.fn()" to be called 1 times, but got 0 times
✓ does nothing when released outside the grid   (vacuously true pre-implementation)
✓ leaves the dock untouched                     (vacuously true pre-implementation)
 Test Files  1 failed (1)
      Tests  1 failed | 17 passed (18)
```
Expected failure, matching the brief ("HomeDock accepts no props and never
calls spawnPlace") — the one test that actually exercises the new call site
fails; the other two pass only because nothing happens yet, which is
indistinguishable from correct at this stage.

**GREEN** — same command after Step 3/4 implementation:
```
Test Files  1 passed (1)
      Tests  18 passed (18)
```
All 18 tests pass, including the pre-existing `expanded: pointerdown alone
does NOT capture...` test and the two snapshot tests
(`drops where the reflow was previewed...`, `re-measures on resize...`).

Broader area — `pnpm vitest run src/home --reporter=verbose`:
`Test Files 65 passed (65)`, `Tests 413 passed (413)`.

Final-verification range — `pnpm vitest run src/home src/settings
src/stores/locale.test.ts src/i18n packages/service/src/sys.test.ts
--reporter=verbose`: `Test Files 140 passed (140)`, `Tests 1453 passed (1453)`.
`DesktopContextMenu.test.ts` did not flake in this run. The known 58
pre-existing `src/ai/knowledge` failures are outside this range and were not
run.

`pnpm build`: succeeds (`vue-tsc --noEmit && vite build`, `✓ built in ~18s`).

## Dev-server evidence (Step 8) — all four behaviours observed

The dev server described as "already up on port 5273" was not actually
running in this sandbox (nothing listened on 5273; `ss -tlnp` showed only an
unrelated `vite.config.tmlab.ts` server on 5277). I started
`pnpm dev` myself from this worktree (confirmed bound to `0.0.0.0:5273`,
proxying `/v1/*` to the real on-device Gateway at `127.0.0.1:80`) and left it
running per the instructions.

Driven via a headless Chromium (`~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome
--headless=new --remote-debugging-port=9333`), controlled directly over the
CDP websocket with the transitively-installed `ws@8.21.0` package (Playwright
itself isn't installed) — driver script at
`/tmp/claude-1000/-home-nimo-NimoTech-NimoOS-New-UI--claude-worktrees-home-widgets-batch/97f281b1-42b4-46e8-ab48-2545dc49e5e6/scratchpad/cdp.mjs`,
not committed. Screenshots in the same scratchpad directory:
`01-initial.png`, `02-expanded.png`, `03-mid-drag-over-grid.png`,
`04-after-drop.png`, `05-duplicate-toast.png`, `06-mid-void.png`,
`07-after-void-release.png`.

Two auth obstacles hit and worked around (both pre-existing, outside this
task's files):
1. `localStorage` needs `access_token`/`refresh_token`/`version`/`user`
   (`version` specifically, per `src/router/guard.ts`), seeded via
   `Runtime.evaluate` after one `Page.navigate`, then a second fresh
   `Page.navigate` (different query string, never `Page.reload`) so the
   session store re-reads it at module load.
2. The seeded token is well-formed-but-unsigned. Endpoints that legitimately
   need to decode real identity from it (e.g. `/v1/photos/assets`) 401 — that
   alone is harmless, the shared http client retries once and gives up
   quietly. What is *not* harmless is `/v1/users/refresh` itself 401ing: that
   specific failure is what the client treats as fatal (`onAuthFail` → clear
   tokens → bounce to `/login`), since the refresh endpoint verifies the
   refresh token's signature outright and can't be routed around via the
   localhost JWT-skip. Fixed by intercepting exactly that one endpoint via
   CDP `Fetch.requestPaused`/`Fetch.fulfillRequest` and returning a synthetic
   `{success:200, data:{access_token, refresh_token, expires_at}}`, keeping the
   session alive for the rest of the probe. (`/v1/terminal/settings` was also
   pre-emptively stubbed as a safety net, following this repo's own prior
   CDP-probe memory, though this page never actually hit it.)

I used the `storage` app for the drag target rather than `settings`: the
default desktop layout (`src/home/grid/defaultLayout.ts`) already seeds
`settings` onto the grid, which would have made "added" and "already exists"
indistinguishable. `storage` is a dock app the default layout does not
pre-place.

All four behaviours from the brief were observed, with a 1600×1000 viewport
(the default headless window was small enough that the dashed grid-ghost sat
behind the topbar in some target cells — a viewport artifact, not a defect;
re-running at 1600×1000 shows it cleanly):

1. **Ghost appears, dock reflow clears** — `03-mid-drag-over-grid.png` shows
   the dashed `.drop-ghost` box on the grid at the exact targeted cell, with
   the floating dock-drag icon hovering over it. Confirmed programmatically
   too: `dropGhostPresent: true`, `dropGhostStyle: "grid-area: 1 / 9 / span 1
   / span 1"` matching the pointer position, and `dockOffsetsNonZero: []` (no
   dock icon has a nonzero `translateX` — the reflow preview is at rest).
2. **Release over an empty cell adds it; dock keeps its icon** —
   `04-after-drop.png` shows a toast "Added: storage", a new Storage tile on
   the grid, and Storage still present in the dock's own list (now sorted
   into the "more" zone). Tile list before: `["Files","Photos","Nimo
   AI","Settings","Knowledge","App Store","KVM"]`; after: same list plus
   `"Storage"`.
3. **Dragging the same app out again and releasing on the grid → "already
   exists" toast, nothing added** — `05-duplicate-toast.png` shows "This app
   is already on the home screen"; the tile list is unchanged (still exactly
   one "Storage" tile).
4. **Releasing neither over the grid nor the dock → nothing happens** —
   `07-after-void-release.png`, released at a point above the grid's own top
   edge (outside `cellAtPointer`'s rect) and away from the dock (which sits
   near the viewport bottom): no toast, tile list unchanged, dock order
   unchanged.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch/src/views/Home.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch/src/home/components/HomeDock.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch/src/home/components/HomeDock.test.ts`

Commit: `082f1b4c feat(home): drag an app from the dock onto the desktop to add a copy`

## Self-review

- Re-read the full diff (`git show HEAD`): no stray debug code, no leftover
  console output, no theme.css touch, comments in English throughout
  (Chinese only in test-assertion locale strings, e.g. `data-app="settings"`
  labels and the toast text under test).
- `homeUi.spawnGhost = null` appears in four places (the dock-reflow branch
  of `onDragMove`, the top of `onDragEnd`, `onDragCancel`, and
  `resetDragState`). This looks redundant at first glance but each guards a
  different exit path from the drag (normal grid-branch, normal
  reorder-branch, cancel, and the shared reset helper); the brief calls for
  exactly this belt-and-suspenders clearing so an interrupted gesture can't
  leave the ghost on screen. Confirmed harmless where redundant (setting an
  already-null ref to null is a no-op).
- Verified constraints: `git diff master -- src/styles/theme.css` is empty;
  `measureGeometry`/`dropTargetIn`/`onResize` still present in HomeDock.vue;
  `draggable="false"` still present in DockApp.vue; `git status --short` is
  clean after the commit (only the three intended files touched, nothing
  staged with `-A`).
- No subagents were used; all work, testing, and browser verification were
  done directly.

## Concerns

None. All required tests pass, `pnpm build` succeeds, and all four dev-server
behaviours were directly observed (not inferred). The one deviation from the
brief's verbatim test code (the `vi.fn` type annotation) is a mechanical
TS-strictness fix with no behavioural difference, documented above.
