# Task 4 report: the dock's icons move aside for real

## Status: DONE_WITH_CONCERNS

Implemented per the brief, all named tests pass, `pnpm build` passes, and browser
evidence confirms the reflow. Two things surfaced during the work that the brief
didn't anticipate and that I'm flagging rather than silently smoothing over — see
"Concerns" below. Neither required deviating from the brief's verbatim code; both
are findings about its behaviour.

## What was implemented

- `src/home/components/HomeDock.vue`:
  - Template: both zones replace the `.dock-ph` placeholder markup with plain
    `DockApp v-for` lists, each icon carrying `:style="shiftStyle(zone, k)"`.
  - `DragState` gained `fromZone` and `holeIndex`, set in `onDragStart` right
    after `drag.key`, cleared in `resetDragState`.
  - New functions `zoneKeys`, `holeFor`, `pitchFor`, `shiftStyle`, replacing the
    deleted `showPh`. `shiftStyle` calls `slotShifts` (imported from
    `../grid/dockMath`, added Task 3) and turns the result into a
    `transform: translateX(...)` inline style, or `undefined` at rest.
  - Scoped CSS: the `.dock-ph` rules are replaced with a `transition: transform`
    rule on `.dock-zone :deep(.dock-app)`, respecting `prefers-reduced-motion`.
  - `measureGeometry`, `geom`, `resolveDrop`, `onResize` (the one-measurement-
    per-drag snapshot) are untouched in logic; only their doc comments were
    updated to stop referring to the now-deleted `.dock-ph` element (they now
    describe the hazard in terms of `shiftStyle`'s transform instead — a CSS
    transform leaves layout flow untouched but still changes what
    `getBoundingClientRect` reports, so the measurement-feedback hazard the
    snapshot exists to break is unchanged).
  - `DockApp.vue`'s `draggable="false"` / `-webkit-user-drag` / `user-select`
    guards were not touched (not in scope for this task); the pre-existing
    `expanded: pointerdown alone does NOT capture the pointer...` test and the
    `onDragStart` `if (!dock.expanded.value) return` gate / dragged-source
    `opacity: 0` are all untouched.

- `src/home/components/HomeDock.test.ts`: see "Adapted tests" below.

## TDD evidence

**RED** — `pnpm vitest run src/home/components/HomeDock.test.ts --reporter=verbose`
(after writing the tests, before touching `HomeDock.vue`):

```
 × HomeDock > offsets icons while dragging and clears the offsets afterwards
   → expected 0 to be greater than 0
 × HomeDock > drops where the reflow was previewed even after the reflow itself shifts the dock
   → expected +0 to be 100 // Object.is equality
 × HomeDock > re-measures on resize, and does so with no offset left over from the stale snapshot
   → expected +0 to be 100 // Object.is equality

 Tests  3 failed | 12 passed (15)
```

Expected and correct: nothing writes a `transform` yet (old template still
renders `.dock-ph`, `shiftStyle` doesn't exist), so every offset reads 0.

**GREEN** — `pnpm vitest run src/home/components/HomeDock.test.ts src/home/grid/dockMath.test.ts src/home/components/style-guard.test.ts --reporter=verbose`
(after the `HomeDock.vue` implementation):

```
 Test Files  3 passed (3)
      Tests  40 passed (40)
```

All pass, including the pre-existing `expanded: pointerdown alone does NOT
capture the pointer...` test (the invariant item 4 in the brief calls out) and
the native-drag-suppression `style-guard.test.ts` (item 3).

`pnpm build` (`vue-tsc --noEmit && vite build`): succeeded, `✓ built in 18.52s`.
The only warning is the pre-existing "chunks larger than 500 kB" advisory,
unrelated to this change.

## Adapted tests — the required resolution, plus one more I had to make myself

The brief's Step 1 gave two new tests verbatim (`offsets icons while dragging...`,
`offsets nothing for a plain click`) and correctly flagged that two more
pre-existing tests assert `.dock-ph` and need adapting rather than deleting. I
adapted both, renamed so neither says "placeholder", keeping the setup and (for
the first) the final `dock.moreKeys.value` assertion exactly as specified.

**But the brief's own worked arithmetic for both adapted assertions was wrong**,
and I want to be explicit about why, since the instructions were clear not to
silently paper over a mismatch. I verified the actual initial order with a
temporary `console.log(dock.moreKeys.value)` inside the test (removed before
finishing — `git diff --stat` on the test file confirms no leftover debug code):

```
DEBUG moreKeys before drag ["storage","knowledge","settings"]
```

The brief assumed `settings` sits *between* `storage` and `knowledge`
(`holeIndex === 1`). It actually sits *last* (`holeIndex === 2`) — `settings` is
after `knowledge` in `SYSTEM_APPS`, and `moreKeys` is `apps.order` filtered by
fav membership, which preserves that relative order. This is a pre-existing,
unrelated-to-Task-4 fact about `useDock`'s default ordering, not a bug in the
new `slotShifts`/`holeFor`/`shiftStyle` code (which is exactly as specified,
verbatim).

Recomputing `slotShifts` with the *real* `holeIndex = 2`:

- **Test 1** (`drops where the reflow was previewed...`): preview targets
  `insertAt = 1` (before "knowledge"). With `holeIndex = 2` this is **not**
  "the hole is already at the insertion point" — it's one slot short, so
  `knowledge` has to slide right by one pitch (100px, from the test's stubbed
  storage=100/knowledge=200 mids) to open the gap in front of it; `storage`
  doesn't move. I asserted `shiftPx(storage) === 0` and
  `shiftPx(knowledge) === 100` (a helper I added that reads the pixel number out
  of the inline `translateX(...)`) instead of the brief's predicted "both 0".
- **Test 2** (`re-measures on resize...`): after resize the mids become
  storage=150/knowledge=250 (unchanged pitch, 100). x=190 is now nearest
  "storage" and to its right, so the drop appends at the end: `insertAt = 2`.
  With the real `holeIndex = 2`, `insertAt === holeIndex` exactly, so **both**
  shifts are 0 — the opposite of the brief's predicted "knowledge shifts -100px".
  I asserted both are 0, with a comment noting that a stale (pre-resize)
  geometry would instead have shown `knowledge` shifted +100px here — so the
  test still proves the re-measurement happened, just via the opposite sign
  from what the brief expected.

Both corrected assertions are internally consistent (verified by hand-deriving
`slotShifts`'s output for the real `keys`/`holeIndex`/`insertAt` in each case)
and both pass. I did not "adjust the assertion to match the code" blindly —
I independently re-derived the correct numbers from the actual, verified input
data and from `slotShifts`'s own published semantics, and the mismatch traces
to the brief's assumed test data, not to a bug in the implementation.

## Browser evidence

jsdom's zero rects hide all of this (pitch reads 0, every transform is
`translateX(0px)`), so a standalone page was needed.

**Page**: `/tmp/claude-1000/-home-nimo-NimoTech/30777c28-04dd-4494-866d-88701c163be5/scratchpad/task4-dock-reflow-demo.html`
(base template) plus three scene variants (`task4-scene1-rest.html`,
`task4-scene2-fav-to-more.html`, `task4-scene3-more-to-fav.html`), each copying
`.dock`/`.dock-main`/`.dock-zone`/`.dock-sep` from `HomeDock.vue`'s scoped
styles and `.dock-app`/`.dock-ic`/`.dock-label` from `theme.css:874-890`,
`--app-size: 64px`, the global `box-sizing: border-box` reset, and a hand-ported
4-line `slotShifts`. Not committed (scratch only).

Screenshots (headless Chromium, `--force-device-scale-factor=3 --window-size=900,500`):

1. `task4-scene1-rest.png` — at rest. 3 favourites, separator, 4 "more" icons,
   no gaps, no transforms. Matches expectation.
2. `task4-scene2-fav-to-more.png` — dragging the first favourite (F1),
   inserting between the 2nd and 3rd "more" icon. F1 is invisible, F2/F3 stay
   put (a hole shows at the front of favourites, matching the brief's
   description). In "more": M1/M2 stay, M3 and M4 both slide right by one
   pitch, opening a one-slot gap between M2 and M3. **Measured pitch: 83.2px**
   (`64 * 1.3`, matching `slots[1].midX - slots[0].midX` for adjacent icons —
   confirmed directly in the image by the M1→M2 spacing). The separator did not
   move. No icon crossed the separator in this scene.
3. `task4-scene3-more-to-fav.png` — mirror: dragging the last "more" icon (M4),
   inserting at the front of favourites. "More" (M1-M3) stays in place (hole at
   the end, where M4 used to be). All three favourites shift right by one pitch
   to open a gap at the very front — **but see the concern below: in this
   scene the shifted "F3" icon visually overlaps the separator and "M1"** (their
   labels render on top of each other in the screenshot).

## Concerns

**1. (Resolved, documented above)** The brief's worked arithmetic for the two
adapted tests assumed the wrong initial `moreKeys` order. Verified against the
running singleton store; corrected the assertions; both are internally
consistent with `slotShifts`'s actual, unmodified semantics.

**2. (Not resolved — a real finding from the required browser evidence, not a
test failure).** For a **cross-zone** drag, the receiving zone's "appended
spare" hole (`holeFor` returning `zoneKeys(zone).length`) has no real DOM
element reserving its width — unlike a same-zone drag, where the dragged icon
itself (opacity 0, but still in flow) naturally reserves that space. A CSS
`transform` doesn't grow the flex box it lives in, so whenever a cross-zone
insertion point is *not already at the true end* of the target zone, the
icon(s) pushed toward that phantom slot visually move **past the zone's own
untransformed width** — and since `.dock` and `.dock-more` don't clip
(`overflow: visible` when expanded, by design, for the drag ghost), those icons
render detached from the dock's rounded pill rather than clipped:

- In scene 2, this is mild: M4 (the last "more" icon) pokes out past the right
  edge of the pill, floating in open space — visible in
  `task4-scene2-fav-to-more.png`.
- In scene 3, this is severe: dragging into the **front** of a small zone
  requires *every* icon in that zone to shift together, so the whole 3-icon
  favourites group moves as a block one pitch to the right of where the
  favourites zone's own box ends — landing on top of the separator and the
  first "more" icon. This is directly visible in `task4-scene3-more-to-fav.png`
  as overlapping "F3"/"M1" label text, and it means the brief's own confirmable
  property "no icon has crossed [the separator]" **does not hold** for that
  scene.

I did not change `shiftStyle`/`holeFor`/`slotShifts` to compensate (the brief
says use them verbatim, and any fix looks like it would need either a real
DOM-reserved spare slot in the receiving zone — which is close to reintroducing
what `.dock-ph` did — or capping/clamping the animation, which isn't specified
here). This reproduces with the real default dock sizes (5 favourites by
default), and the *reachable* trigger is ordinary: drag any "more" app and drop
it as the very first favourite (or generally, any cross-zone drop whose
insertion point isn't already at the target zone's true end). The old
`.dock-ph`-based implementation didn't have this problem, because inserting a
real flex child naturally grew the zone's own flow width to make room.

I'm flagging this for the owner/reviewer rather than silently shipping it,
per the brief's own instruction that browser evidence is not optional and this
batch has already shipped defects that only a browser caught. It may be
acceptable as a known trade-off of the transform-only approach (smoother
same-zone animation, no DOM churn), may need a follow-up task, or may need
reconsidering before merge — that's a product call, not something I should
decide unilaterally by deviating from the brief's specified code.

**3.** I could not drive an interactive hover against the running dev server
(`http://192.168.1.143:5273/app/`) to visually reconfirm the fisheye is gone —
I have no interactive browser-automation tool available in this session, and
the dev server's address is not reachable from this sandboxed bash environment
(`curl` to it failed to connect). Per the brief, I'm leaving that specific
confirmation for the owner's own visual acceptance. (Task 2's removal of the
`onMove`/`reset` handlers and the `@pointermove`/`@pointerleave` bindings from
the `<nav>` is untouched by this task, and the existing `no longer magnifies
icons on hover` jsdom test still passes.)

## Files changed

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch/src/home/components/HomeDock.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch/src/home/components/HomeDock.test.ts`

Not committed (scratch, browser-evidence only):
- `/tmp/claude-1000/-home-nimo-NimoTech/30777c28-04dd-4494-866d-88701c163be5/scratchpad/task4-dock-reflow-demo.html`
- `/tmp/claude-1000/-home-nimo-NimoTech/30777c28-04dd-4494-866d-88701c163be5/scratchpad/task4-scene1-rest.html` (+ `.png`)
- `/tmp/claude-1000/-home-nimo-NimoTech/30777c28-04dd-4494-866d-88701c163be5/scratchpad/task4-scene2-fav-to-more.html` (+ `.png`)
- `/tmp/claude-1000/-home-nimo-NimoTech/30777c28-04dd-4494-866d-88701c163be5/scratchpad/task4-scene3-more-to-fav.html` (+ `.png`)

## Commit

`508311c0` — `feat(home): make dock icons move aside while one is dragged`
(signed off; brief's commit message used verbatim).

## Self-review notes

- Diff is scoped to exactly the two named files; nothing else touched.
- No hardcoded colors introduced in `HomeDock.vue` (the new CSS rule is
  transition-only, no color values).
- `theme.css` not touched.
- Stale comments referencing the deleted `.dock-ph` element were updated in
  three more places beyond what the brief listed verbatim (the `measureGeometry`
  doc comment, and two one-line comments in `onDragMove`/`onDragEnd`/`onResize`)
  so no comment in the surviving code refers to a DOM class that no longer
  exists — a test-hygiene / correctness-of-comments concern, not a behavior
  change.
- No leftover debug code (the temporary `console.log` used to verify the real
  `moreKeys` order was removed; confirmed via `git diff` showing zero diff on
  the test file before starting the real edits).
- Test output is clean (verbose reporter, no stray console/stderr noise).

---

# Fix round 1 of 5

## What the coordinator resolved

- My correction of the brief's arithmetic (real `moreKeys` order, `holeIndex=2`) was confirmed independently and stands. No action.
- The dev-server hover check stays with the owner. Not chased.
- **Confirmed Critical**: the cross-zone overflow (icon escaping the pill / crossing the separator) from the original report. Must fix.

## What I implemented (per the coordinator's explicit ruling, not the reviewer's alternative)

`src/home/components/HomeDock.vue`:

- **`DragState` gained `sparePx: number`** — pixels of `padding-inline-end` reserved
  on the non-source zone, for the whole drag.
- **`onDragMove`'s activation block now does a genuine two-pass measurement**:
  1. `preGeom = measureGeometry()` — the at-rest layout, used only to size the
     reservation.
  2. `drag.sparePx = pitchFor(spareZone, preGeom)`, where `spareZone` is the zone
     the drag did *not* start in (`fromZone === 'fav' ? 'more' : 'fav'`).
  3. `void nextTick(() => { if (drag.active) geom = measureGeometry() })` — once
     Vue has rendered the reservation (see below), this becomes the canonical
     snapshot `resolveDrop` uses for the rest of the gesture. This is the exact
     shape `onResize` already used (drop the preview, `nextTick`, re-measure),
     applied at activation instead of at resize.
- **`reserveStyle(zone)`** (new): returns `{ paddingInlineEnd: '${drag.sparePx}px' }`
  when `drag.active && zone !== drag.fromZone`, else `undefined`. Bound in the
  template as `:style="reserveStyle('fav')"` / `:style="reserveStyle('more')"` on
  the two `.dock-zone` divs. No new DOM node — a plain CSS property on the
  existing zone element, so it doesn't show up in `measureGeometry`'s
  `[data-zone] .dock-app[data-app]` query and isn't an inserted element.
- **`pitchFor` gained an optional second parameter** (`g: DockGeometry | null =
  geom`), defaulting to the module-level snapshot for its existing call site in
  `shiftStyle`, but letting the activation code pass `preGeom` explicitly —
  needed because sizing the reservation happens *before* the canonical `geom`
  exists yet.
- **The preview is gated on the snapshot existing**: `onDragMove` now only calls
  `resolveDrop`/writes `toZone`/`beforeKey` `if (geom)`. Per the ruling's item 4,
  this replaces `resolveDrop`'s own null-geom fallback (which would otherwise
  guess `'more'` for the one frame between activation and the snapshot landing)
  with "leave the preview at rest for that one frame"; the ghost still tracks
  the pointer every frame via `ghostStyle`, unaffected by this gating.
- **`resetDragState`** now also zeroes `drag.sparePx`.

`src/home/components/HomeDock.test.ts`: `startShiftedDrag` now dispatches a
*second* `pointermove` (same coordinates) after the first one's `nextTick`,
with a comment explaining why — the first pointermove that crosses the
threshold only activates the drag and sizes/applies the reservation; it never
resolves a preview itself (per the gating above), so a second pointermove,
once the post-reservation snapshot has landed, is what actually produces a
resolved `toZone`/`beforeKey`. This mirrors exactly how the pre-existing
"re-measures on resize" test already needed a follow-up pointermove after a
resize.

## Covering tests

```
pnpm vitest run src/home/components/HomeDock.test.ts src/home/grid/dockMath.test.ts src/home/components/style-guard.test.ts --reporter=verbose
```

```
 Test Files  3 passed (3)
      Tests  40 passed (40)
```

No assertion had to change — only the `startShiftedDrag` helper gained the
second dispatch. I verified beforehand, by hand-tracing Vue's `nextTick`
ordering (the callback the activation code queues via `nextTick()` is
registered before the test's own `await w.vm.$nextTick()` in the same
synchronous tick, so it flushes first), that this was the expected, minimal
adaptation — and the test run confirms it on the first try, no iteration
needed.

`pnpm build` (`vue-tsc --noEmit && vite build`): `✓ built in 18.29s`, no new
warnings beyond the pre-existing chunk-size advisory.

## Browser evidence — and a second, more precise finding

New scratch page: `task4-fixround-demo.html`, extending the round-1 demo with
the reservation logic (`favEl.style.paddingInlineEnd` / `moreEl.style.
paddingInlineEnd`, ported by hand from `reserveStyle`) and an on-page,
JS-measured readout of the separator's own `getBoundingClientRect()` midpoint,
plus a viewport-fixed red ruler line drawn at the *at-rest* separator position
(measured once, before any scene renders) — so the screenshot itself proves or
disproves "the separator hasn't moved" with an exact pixel number, not just an
eyeballed comparison.

Screenshots (same Chromium invocation as round 1):

1. `task4-fix-scene1-rest.png` — at rest. Measured separator midX = 408.4px,
   matching the ruler (itself taken from this same measurement) by definition.
2. `task4-fix-scene2-fav-to-more.png` — dragging F1 (fav→more), inserting
   between M2 and M3. **The original Critical is fixed**: M3 and M4 both slide
   right by one pitch and stay fully inside the pill — no icon escapes the
   dock's rounded border any more (contrast with the original
   `task4-scene2-fav-to-more.png`, where M4 floated outside it). Gap is one
   slot wide, M1/M2 unmoved, nothing crosses into the fav side. **But: measured
   separator midX = 366.8px — 41.6px (exactly half of the 83.2px pitch) to the
   left of the ruler.** The separator visibly moved.
3. `task4-fix-scene3-more-to-fav.png` — dragging M4 (more→fav), inserting at
   the front of favourites. **Also fixed**: F1/F2/F3 all slide right by one
   pitch and land cleanly before the separator — no more overlapping "F3"/"M1"
   labels (contrast with the original `task4-scene3-more-to-fav.png`). Gap is
   one slot wide, M1-M3 unmoved. **But: measured separator midX = 450.0px —
   41.6px (again exactly half a pitch) to the *right* of the ruler.**

**So the specified fix (padding-based reservation, unconditional for the whole
drag) does eliminate the escaping/overlapping-icon defect in both directions,
but it introduces a smaller, different defect: the separator itself shifts by
exactly half a pitch, in both drag directions (left when the "more" zone
reserves, right when the "fav" zone reserves) — which fails the spec's "the
divider never moves" in both scenes, not just the "more→fav" one I originally
flagged.**

### Why this happens, precisely

`.dock` is a shrink-to-fit box, horizontally centred (`left: 50%; transform:
translateX(-50%)` in the real component; flex `justify-content: center` in the
demo — mechanically equivalent). Reserving `pitch` px of `padding-inline-end`
on *either* zone grows `.dock`'s own total content width by `pitch`. Because
`.dock` recentres around its own width:

- Everything inside it shifts by `-pitch/2` (recentring alone), and
- everything that sits **after** the zone that grew shifts by a further
  `+pitch` (an ordinary flex "later sibling gets pushed by an earlier
  sibling's growth" effect), for a net `+pitch/2`; everything **before** the
  grown zone only gets the `-pitch/2` recentring term.

The separator sits after "fav" and before "more":

- Reserve in "more" (drag from fav): separator is *before* the grown zone →
  net `-pitch/2` = **-41.6px**. Matches scene 2 exactly.
- Reserve in "fav" (drag from more): separator is *after* the grown zone → net
  `+pitch - pitch/2` = `+pitch/2` = **+41.6px**. Matches scene 3 exactly.

This is a structural consequence of using a real, layout-affecting CSS
property (`padding`) to reserve space inside a shrink-to-fit, self-centred
container — not a mistake in applying the ruling's instructions. It is also
*not* something the original (pre-fix-round) icon-only `transform` approach
ever had: a `transform` doesn't participate in layout sizing at all, so
`.dock`'s own width — and hence its centred position — was never affected by
the icon shifts themselves. The reservation is what introduces this.

I checked whether compensating for the recentring (e.g. trimming `.dock`'s own
outer padding by `pitch` on the side that grew, to hold its total width, and
hence its centred position, constant) would fix this, since it looked promising
for scene 2 specifically. It does cancel scene 2's shift (which was pure
recentring, no local push) — but it does *not* fix scene 3: recentring is only
one of its two components, and the other (the separator being *locally* pushed
by "fav" zone's own growth, a plain flex-neighbour effect independent of the
container's total width) is untouched by any outer-padding compensation, so
scene 3 would still show a shift (this time the *undiminished* local-push
component, arguably worse, not better). I did not find a padding-only
adjustment that zeroes the shift in *both* directions at once.

Per the ruling — "If while doing this you conclude the reservation genuinely
cannot be made to work without an inserted element, stop and report rather
than inventing a third design" — I'm stopping here rather than trying a fourth
variant (e.g. giving `.dock` a non-shrink-to-fit width so it stops recentring
on content changes, which would be a materially bigger change to the dock's
whole layout model than this fix round's scope). My finding is adjacent to,
but more specific than, the literal trigger sentence: the reservation *can* be
built without an inserted element (that part works, and fixes the original
overflow/overlap defect cleanly in both scenes), but it cannot — with a
padding-only reservation inside this specific self-centred shrink-to-fit shell
— also hold the separator perfectly still in both directions at once. That
distinction is the ruling's to make, not mine.

## Files changed (this round)

- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch/src/home/components/HomeDock.vue`
- `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch/src/home/components/HomeDock.test.ts`

Not committed (scratch, browser-evidence only):
- `/tmp/claude-1000/-home-nimo-NimoTech/30777c28-04dd-4494-866d-88701c163be5/scratchpad/task4-fixround-demo.html`
- `task4-fix-scene1-rest.html` / `.png`
- `task4-fix-scene2-fav-to-more.html` / `.png`
- `task4-fix-scene3-more-to-fav.html` / `.png`
- `task4-fixround1.diff` (saved diff for reference)

## Commit

Committed as a genuine, tested improvement over round 0 (it does eliminate the
original escaping/overlapping-icon defect cleanly in both directions) even
though the newly-surfaced separator-shift finding means the Critical is not
*fully* closed against the letter of "the divider never moves" — see status
below.
