# Final fix wave — dock-reflow-and-gpu-2x2 batch review

Branch: `worktree-home-widgets-batch`, working from `082f1b4c` (batch `3e959a44..082f1b4c`).
Three commits landed:

- `a33463b2` fix(home): stop the dock reflow from doubling its pitch mid-drag (findings 1 + 4)
- `7dc8434c` fix(home): suppress the reflow transition on the drop's commit frame (finding 2)
- `87058845` docs(home): correct the drop-void comment and two stale prototype references (findings 3, 5, 6, 7, 8)

## Finding 1 — pitchFor doubled the pitch (CRITICAL) — FIXED

**Change** (`src/home/components/HomeDock.vue`, `pitchFor`): instead of `slots[1].midX - slots[0].midX`,
the pitch is now derived from the zone's whole span, corrected for the physical index each collected
slot actually occupies:

```ts
function pitchFor(zone: 'fav' | 'more', g: DockGeometry | null = geom): number {
  const slots = zone === 'fav' ? g?.favSlots : g?.moreSlots
  if (slots && slots.length >= 2) {
    const hole = holeFor(zone)
    const phys = (j: number) => (j < hole ? j : j + 1)
    const last = slots.length - 1
    return (slots[last].midX - slots[0].midX) / (phys(last) - phys(0))
  }
  const src = root.value?.querySelector<HTMLElement>(`.dock-app[data-app="${drag.key}"]`)
  return (src?.getBoundingClientRect().width ?? 0) * 1.3
}
```

Verified the `onDragMove` call site `pitchFor(spareZone, preGeom)` is unaffected: `spareZone` is
always the *other* zone (no hole there), so `holeFor(spareZone)` returns `zoneKeys(spareZone).length`
— equal to `slots.length` — making `phys(j) === j` for every `j` and reducing the new formula to the
old (correct) one exactly.

**Covering test** (`src/home/components/HomeDock.test.ts`, new): `shifts a neighbour by exactly one
pitch when the dragged icon is the middle of its zone` — stubs three "more"-zone midpoints (storage,
knowledge, settings), drags the middle one (knowledge, holeIndex=1), and asserts storage's shift is
exactly one measured pitch (100px), not two (200px).

```
pnpm vitest run src/home/components/HomeDock.test.ts --reporter=verbose
...
 ✓ HomeDock > shifts a neighbour by exactly one pitch when the dragged icon is the middle of its zone 35ms
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

I confirmed this test actually catches the regression by mutation: temporarily reverted `pitchFor`'s
body to the old `return slots[1].midX - slots[0].midX`, reran the test, and it failed exactly as
predicted:

```
FAIL  HomeDock > shifts a neighbour by exactly one pitch when the dragged icon is the middle of its zone
AssertionError: expected 200 to be 100 // Object.is equality
```

Then restored the fix (`git diff --stat` empty afterward, confirming an exact restoration) and reran
— all 19 tests in the file green again.

**Browser evidence (real Chromium, not jsdom)**: built a scratch, gitignored harness
(`scripts/tmlab/harness.html` + `harness.ts`, deleted after use — `scripts/tmlab/` is already
gitignored) that mounts `HomeDock.vue` directly with Pinia + i18n (no router/auth needed —
`useAppsStore()` calls `setApps([])` at construction, populating the real `SYSTEM_APPS` list with no
backend). Drove headless Chromium (`~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`) via
a hand-rolled pure-Node CDP client (no `ws`/puppeteer package available, no network access to install
one — `/tmp/.../scratchpad/cdp.mjs` implements just enough of RFC6455 to talk to `/json/new` and
dispatch `Input.dispatchMouseEvent`/`Runtime.evaluate`/`Page.captureScreenshot`).

Expanded the dock (fav = files/photos/ai/vm/appstore, more = storage/knowledge/settings — matches the
shipped `DEFAULT_FAV`), dragged "knowledge" (the middle of the 3-item more-zone) toward "storage",
and read the **real, live DOM** after the preview settled:

```
storage inline transform = 83.1953px   (one measured pitch)
settings inline transform = 0px
measured single pitch (post-reservation span / 2) = 83.1953125px
```

`storage`'s inline `transform` is exactly one measured pitch (83.2px, matching the CLAUDE.md-cited
`--app-size: 64px` → 83.2px pitch), not two (166.4px) — the real `pitchFor()`, unmodified, driven by
a real drag gesture, in a real browser. Screenshot: `dock-mid-drag.png` (saved locally, not
committed) shows storage sitting one slot over from its start, in knowledge's old slot, with the
drag ghost floating near the pointer.

## Finding 2 — one-slot overshoot on every drop (IMPORTANT) — FIXED

**Change**: a `suppressReflowAnim` ref, bound through the template's `:class` (not a direct
`classList.add`/`remove` — Vue's class-patching sets `el.className` wholesale from the `:class`
binding on every patch, which would silently wipe a class added outside that binding before the
DOM ever reflected it, since `dock.reorder()`/`resetDragState()` right after also trigger a re-render
of the same element). Set to `true` right before `dock.reorder()`, cleared on the next
`requestAnimationFrame`. Drives a new CSS rule:

```css
.dock-no-reflow-anim .dock-zone :deep(.dock-app) { transition: none; }
```

Also defensively cleared in `onDragCancel` so nothing racing it can leave the suppression stuck on.

**Browser evidence — the release frame specifically**, captured with the fix ON and then with it
temporarily reverted (comment-only revert, HMR picked it up, then restored — confirmed clean via
`grep -n "TEMP-REVERT"` returning nothing afterward):

*Fixed (current HEAD), immediately after `mouseReleased`, same JS turn, before any `requestAnimationFrame`:*
```json
{
  "left": 839.890625,          // already at the FINAL resting position
  "transitionDuration": "0s",  // suppressed
  "anims": [],                 // nothing running
  "navClasses": "dock expanded dock-no-reflow-anim"
}
```
300ms later (`SETTLED`): `navClasses` back to `"dock expanded"` (class removed by the rAF),
`transitionDuration` back to `"0.18s"` (restored for the next drag).

*Broken (fix reverted), same instant:*
```json
{
  "left": 923.0859375,                              // a FULL PITCH away from where it ends up (839.89)
  "computedTransform": "matrix(1, 0, 0, 1, 83.1953, 0)",
  "transitionDuration": "0.18s",
  "anims": [ { "playState": "running", "currentTime": 0 } ]
}
```
+60ms later it had already animated down to `left: 839.89` — a visible, measured one-pitch overshoot
exactly as the finding described, present without the fix and absent with it.

Screenshots (local only): `dock-release-frame.png` (fixed, icons already sharp/settled, no visible
overshoot), `BROKEN-dock-release-frame.png` / `BROKEN-dock-tween-60ms.png` (broken variant, captured
for comparison, not meaningfully different to the eye at a single frame — the numeric
`getAnimations()`/rect proof above is what actually demonstrates the defect, per the finding's own
framing that this is invisible to a plain screenshot).

## Finding 3 — comment overclaimed a "void" region — FIXED (comment only, no behaviour change)

Reworded the `onDragEnd` comment: it now states that `gridCellAt` is the only gate on the
drag-to-desktop branch (fires solely over the grid), and that `resolveDrop`/`dropTargetIn` decide
purely from `clientX` — a release above the dock but off the grid still reorders, and a Y-bounded
"void" region is deliberately deferred (new behaviour, a call for the repo owner, and would break the
existing `clientY: 0` release test). No behavioural change — confirmed via finding 7 below, whose
release still resolves a reorder from `clientX: 100`.

## Finding 4 — onResize never recomputed drag.sparePx — FIXED (same commit as finding 1)

`onResize`'s `nextTick` callback now also re-derives `drag.sparePx` from the freshly measured
geometry, for the same (`spareZone`) the `onDragMove` activation path uses:

```ts
void nextTick(() => {
  if (!drag.active) return
  geom = measureGeometry()
  const spareZone: 'fav' | 'more' = drag.fromZone === 'fav' ? 'more' : 'fav'
  drag.sparePx = pitchFor(spareZone, geom)
})
```

Covered by the existing `re-measures on resize...` test (already asserts post-resize shift values;
passed unchanged, confirming the new `sparePx` line doesn't disturb the reservation sizing that test
checks indirectly through the more-zone icons' shift values).

## Finding 5 — silent wrong-preview fallback — FIXED

`shiftStyle`'s `insertAt` computation:
```ts
let insertAt: number | null = null
if (drag.toZone === zone) {
  if (drag.beforeKey == null) insertAt = keys.length
  else {
    const i = keys.indexOf(drag.beforeKey)
    insertAt = i < 0 ? keys.length : i
  }
}
```
now matches `dock.reorder`'s own `idx < 0 ? length : idx` convention instead of silently defaulting
to "insert at the front" via `Math.max(0, ...)`. Unreachable today (confirmed by the full suite
staying green), but a correct failure mode if it ever becomes reachable.

## Finding 6 — two stale comments — FIXED

- `GpuWidget.vue`: provenance comment no longer names the deleted `.pill-grid` selector.
- `HomeDock.vue`: `.dock-ghost` comment now says it names the prototype's own element (`.dock-ph`),
  not anything in this file.

## Finding 7 — test title promised more than it checked — FIXED (rename only)

`does nothing when released outside the grid` → `does not place a copy when released outside the
grid`. No new assertion added — the stronger one (dock order untouched) would be red, since a release
off the grid still resolves a reorder (see finding 3). Confirmed by running the renamed test: green,
unchanged assertions.

## Finding 8 — duplicate-refusal coverage (bonus, attempted and kept — cheap)

Added `src/home/components/HomeDock.dragDuplicate.test.ts`, a **separate file** (own module registry,
own `vi.mock` scope) that mounts `HomeDock` with the **real** `useAddPanel`/`useLayoutStore` (seeds
the layout with `settings` already placed, drags `settings` from the dock onto a stubbed grid, and
asserts the `addPanelAppExists` toast fires and no second copy is pinned). This did **not** require
touching `HomeDock.test.ts`'s existing narrow mock or any of its assertions — the bounded instruction's
stop condition never triggered, so it's included.

```
pnpm vitest run src/home/components/HomeDock.dragDuplicate.test.ts --reporter=verbose
 ✓ HomeDock drag-to-desktop — duplicate refusal (real useAddPanel) > raises the "already on the desktop" toast instead of placing a second copy
```

## What must survive — re-verified

Ran the full targeted set together at final HEAD:
```
pnpm vitest run src/home/components/HomeDock.test.ts src/home/components/HomeDock.dragDuplicate.test.ts \
  src/home/grid/dockMath.test.ts src/home/components/style-guard.test.ts \
  src/home/components/widgets/GpuWidget.test.ts --reporter=verbose

Test Files  5 passed (5)
     Tests  57 passed (57)
```
Including, unchanged: the spare-slot reservation tests, the two adapted snapshot tests (`shiftPx`
100px assertions), `expanded: pointerdown alone does NOT capture...`, the native-drag-suppression
guard, the RingGauge centring guard, and all `dockMath.test.ts` unit tests. No assertion was relaxed.

`pnpm build` (`vue-tsc --noEmit && vite build`) passed at every commit checkpoint (after commit 1,
after commit 2, and at final HEAD).

`git diff master -- src/styles/theme.css` stayed empty throughout.

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch/src/home/components/HomeDock.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch/src/home/components/HomeDock.test.ts`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch/src/home/components/HomeDock.dragDuplicate.test.ts` (new)
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch/src/home/components/widgets/GpuWidget.vue`

## What I could not do / caveats

- The dev server on port 5273 died on its own partway through the session (not killed by me); I
  restarted it (`pnpm dev`, backgrounded) since the browser evidence required it. It was left running
  per instructions.
- The scratch Chromium-driving harness (`scripts/tmlab/harness.html`/`.ts`) and all screenshots/logs
  were written under `scripts/tmlab/` (already gitignored, matches an established convention in this
  repo for exactly this purpose) and under `/tmp/claude-1000/.../scratchpad/`. Both were cleaned up
  (`scripts/tmlab/` deleted) after evidence capture; nothing scratch was committed.
- I did not attempt to log into the real backend behind the dev proxy (port 80) with real
  credentials — not available/appropriate — and instead used the harness-mounts-the-component
  approach, which exercises the exact same production code path without needing auth.
- Nothing else outstanding. Finding 1's mutation-testing verification (see above) and finding 2's
  broken-vs-fixed browser comparison are both included with actual command output, not just
  reasoning.
