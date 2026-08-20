# Dock live reflow, drag-to-desktop, and the 2x2 GPU widget

Date: 2026-08-18
Branch: `worktree-home-widgets-batch` (continues the home-widgets batch; see Risks)
Follows on from: `2026-08-18-home-widgets-batch-design.md`

## Scope

Five changes, all in `NimoOS-New-UI`. Four concern the dock; one is the GPU widget
at its default size.

1. The 2x2 GPU widget renders the ring only — no pills.
2. The dock's fisheye magnification is commented out.
3. Dragging inside the dock makes the other icons **move aside for real**, opening
   a gap under the pointer, instead of showing a dashed frame.
4. An icon dragged from the dock onto the desktop adds a copy there, reusing the
   existing add-to-desktop flow including its no-duplicate rule.
5. The ends of each dock zone are valid drop positions, which falls out of (3)
   rather than needing its own mechanism.

## Evidence

### The 2x2 GPU widget overflows today

The repo owner supplied a screenshot (`/DATA/Documents/test_folder/Pasted image
2026-08-18 01-23-41.png`, light theme, English locale). It shows the card at 2x2
with the title `GPU`, a single ring reading `0.4% / Usage`, and beneath it **two
pills clipped by the card's bottom edge** — the word `Frequency` is cut through
horizontally.

`GpuWidget.vue:3-6` renders `.pill-grid` with two pills whenever `item.w <= 2`,
and `src/home/widgets/registry.ts:27` gives the widget `default: [2, 2]`, so the
clipped state is what every user sees until they widen the card. The pills predate
this batch; only their content changed recently.

Decision: at `w <= 2`, render the ring alone. The `.stats` branch for `w > 2` keeps
temperature, VRAM and frequency unchanged.

### What the desktop's move logic actually does

The owner asked for the dock to "reuse the desktop's move logic so the new
arrangement can be previewed". The desktop does not do that today, and the
distinction matters:

- `useDragResize.onPointerMove` (`src/home/composables/useDragResize.ts:36-53`)
  calls `planMove` only for its truthiness — `ok: !!planMove(...)` — and renders a
  single dashed `GridGhost`. Other items do not move.
- `planFootprint` (`src/home/grid/gridMath.ts:48-70`) genuinely displaces
  overlapping items to the first free cell, but that runs only in `commit()`
  (`useDragResize.ts:55-68`), i.e. on release.
- `GridItem.vue` has no `transition`, so the post-drop rearrangement is instant,
  not animated.

So neither surface previews a rearrangement. The owner chose the behaviour that
neither has: **icons slide aside during the drag.** This is new work, not reuse,
and the spec says so plainly because the request was phrased as reuse.

### The drag-to-desktop flow already exists

`AddPanel.vue:174-215` (`onSpawnDown`) is the complete pattern:

- a 6px movement threshold before the gesture counts as a drag;
- on move, `targetCellAt(ev, desc)` returns the target cell or `null` when the
  pointer is off the grid, and the result is written to `homeUi.spawnGhost`
  (`src/home/stores/homeUi.ts:11`), which `GridCanvas.vue:17` already renders;
- on release over the grid, `useAddPanel.spawnPlace(desc, tc, tr)`
  (`useAddPanel.ts:61-70`) displaces overlapping items via `planFootprint`,
  refuses duplicates via `isDuplicate`, and raises one of three toasts
  (`addPanelAppExists` / `addPanelNoRoom` / `addPanelAddedToast`);
- on release **off** the grid it does nothing, and the code carries an explicit
  comment warning that falling through to `pinToFree` would wrongly add the item
  at the first free cell.

`isDuplicate` already covers apps by key (`appUsed`), which is exactly the "must
not appear twice" rule the owner asked for. So item (4) is wiring, not new
behaviour.

`targetCellAt` is currently a closure inside `AddPanel.vue` reading `props.cell`,
`props.gap`, `props.cols`, `props.rows` and `props.gridEl`. `Home.vue:9-10` shows
`AddPanel` already receives all five from the view, while `HomeDock` receives no
props at all.

## Design

### 1. GPU widget at 2x2

`GpuWidget.vue`: when `item.w <= 2`, render only the `.ring-row.solo` block. Delete
the `.pill-grid` branch and the `.pill*` scoped rules nothing else uses.

The computeds stay — `temp`, `vram`, `memUse` and `freq` are still needed by the
`w > 2` branch, and `col` still feeds the ring's colour.

**This deliberately reverses a fix made earlier in this same batch, and the
reversal is informed rather than a regression.** The previous spec's item 3
("the frequency row is unreachable at the GPU card's default size") had the
frequency pill substituted for the VRAM pill at `w <= 2`, precisely so the one
field integrated graphics fills in would be visible at the default size. The owner
has since looked at the rendered result and decided the 2x2 card should carry no
pills at all — the screenshot above shows why: at that size the pills do not fit
and are clipped mid-glyph, so the substitution made a clipped pill say `Frequency`
instead of `VRAM` rather than making the frequency readable. The frequency remains
available by widening the card. Commit messages for this change must say so, or a
later reader will read the diff as undoing a fix for no reason.

Two existing tests encode the behaviour being removed and must be updated in the
same commit — this is the third time in this batch that a pre-existing assertion
has pinned behaviour a later decision reverses, so it is called out rather than
discovered:

- `GpuWidget.test.ts:32-38` (`shows rounded usage and temperature`) mounts at
  `item(2)` and asserts `61℃`. Temperature lives only in the `w > 2` branch, so
  after this change it is not rendered at 2x2. Move that assertion to a `w > 2`
  mount, or drop it and keep the usage assertion, which is what the test is really
  about.
- `GpuWidget.test.ts:72-77` (`shows the frequency at the default 2x2 size, in place
  of the empty VRAM pill`) tests exactly the removed behaviour and is deleted. Its
  replacement asserts the 2x2 card renders the ring and **no** `.pill`.

### 2. Fisheye magnification

Comment out, do not delete — the owner asked for it switched off, not removed, and
may want it back:

- `HomeDock.vue`: the bodies of `onMove` and `reset`, the `@pointermove` /
  `@pointerleave` bindings that call them, and the `magScale` import.
- `dockMath.ts`: `magScale` and its `MAG_AMP` / `MAG_SIGMA` constants.
- `dockMath.test.ts`: the `magScale` describe block.

Each commented block gets a one-line header saying it is the dock's fisheye,
switched off on request, kept so it can be restored.

`theme.css:888` applies `transform: translateY(calc((var(--mag,1) - 1) * -12px))
scale(var(--mag,1))` to `.dock-ic`. **That file must not be touched** — a standing
constraint of this batch, because another checkout has uncommitted work in it. With
nothing writing `--mag`, the fallback `1` makes both terms identity, so the effect
is off without editing the rule.

### 3. Live reflow inside the dock

**The slot model.** This is the core of the change. The owner confirmed it
explicitly, including the two-zone case, after correcting an earlier reading of
mine that treated the dock as one continuous list.

The expanded dock is two ordered zones separated by a divider:

```
Files  Photos  AI  │  Store  Settings  KVM
└─── favourites ──┘   └──── more apps ────┘
```

When a drag becomes active:

- the dragged icon lifts, and **its own slot stays open as a hole** in its source
  zone;
- **one** spare slot is appended to the *other* zone.

```
[hole] Photos  AI  │  Store  Settings  KVM  [spare]
```

Both zones now hold one free slot, which is the whole point: **each zone reflows
independently and nothing is ever pushed across the divider.** In the owner's
words: 分割线左右两边各自挤压,两边的位置都是够的,这是我为什么设计空位的原因.

**Precondition.** All of items (3), (4) and (5) apply only while the dock is
expanded. `onDragStart`'s existing `if (!dock.expanded.value) return` gate stays —
the collapsed dock remains non-draggable, as it is today. The owner's phrasing
("点击 all apps 拖动时…", "点击 allapps 后…") assumes the expanded dock throughout.

**Which zone the pointer is in** continues to use the rule already implemented in
`dropTarget`: left of the separator's midpoint is favourites, otherwise more apps.
That covers the pointer being over the divider itself, and no new rule is needed.
When the pointer is over the "All apps" toggle button — which sits outside both
zones, to the right of them — the midpoint rule puts it in more apps, which is the
sensible answer and needs no special case.

Given a pointer position, the zone under it, and an insertion index `i` within that
zone's list `L` of remaining icons, that zone renders as `L[0..i-1]`, a gap, then
`L[i..]`. The other zone renders unchanged, still carrying its own free slot.

```
dropping into favourites:   Photos [gap] AI  │  Store  Settings  KVM  [spare]
dropping into more apps:    [hole] Photos AI  │  Store [gap] Settings  KVM
```

On release the icon takes the gap and **the unused free slot collapses**, so the
dock returns to its original slot count: 最终拖动完成后根据排列删掉多余的格子.

Consequences that follow from the model rather than needing their own rules:

- The two ends of each zone are ordinary insertion indices (`0` and `L.length`), so
  item (5) needs no extra mechanism.
- The divider never moves and no icon crosses it during a drag. Zone membership
  changes only when the icon is released on the other side of it.
- Dragging back to the origin hole is a no-op.

**Rendering.** Icons keep their DOM order; each is offset with
`transform: translateX()` plus a transition. Reordering the DOM instead would make
Vue tear down and rebuild nodes mid-gesture, losing the animation and risking
flicker. The gap is therefore an *absence of offset*, not an inserted element — so
the `.dock-ph` element added earlier in this batch is removed.

**Pure functions.** `dockMath.ts` gains a function mapping (zone list length,
insertion index) to a per-icon offset in slot counts. That is the part jsdom can
test; the animation is not. `dropTarget` / `dropTargetIn` stay — the insertion index
still comes from the same measured geometry.

**Keep the fix from the previous batch.** Slot geometry is measured **once** when
the drag activates and reused by both preview and drop, invalidated only on resize.
Measuring per pointer-move is what caused the oscillation the last final review
caught, and the new gap is also a layout change that would feed back into a
per-tick measurement.

### 4. Dragging from the dock onto the desktop

Extract `targetCellAt` from `AddPanel.vue` into `src/home/grid/pointerMath.ts`
(which already holds `dragCell` and `resizeSize`), taking the grid rect and
dimensions as arguments so both callers share one implementation. `AddPanel.vue`
then calls the shared version; its behaviour must not change.

`Home.vue` passes `cell`, `gap`, `cols`, `rows` and `gridEl` to `HomeDock` exactly
as it already does to `AddPanel`.

`HomeDock`'s pointer-move handler gains a branch:

- pointer over the grid → clear the dock's reflow, set `homeUi.spawnGhost` for the
  target cell;
- pointer over the dock → clear `spawnGhost`, run the reflow of item (3).

On release over the grid, call
`useAddPanel(...).spawnPlace({ kind: 'app', key, w: 1, h: 1 }, tc, tr)`.
Duplicates, "no room", and the success toast are all handled inside it. Released
anywhere else, nothing happens.

**The dock itself does not change.** This is a copy: the icon stays where it was,
the spare slot and the origin hole collapse, and the dock returns to its resting
state as soon as the pointer leaves it. The owner chose this over holding the hole
open, on the grounds that the icon is not actually leaving.

## Testing

vitest covers what it can:

- the slot-offset function: both zones, every insertion index, the ends, the
  origin-hole no-op, and that an offset never crosses the divider;
- the shared `targetCellAt`: on-grid, off-grid `null`, and clamping at the edges;
- `spawnPlace` reached from a dock drag, including the duplicate refusal — that
  path has a user-visible consequence and no coverage today;
- the 2x2 GPU widget rendering the ring and no pills.

**jsdom cannot observe the reflow.** Every rect is zero there and the animation is
a CSS transform. Items (2), (3) and (5) therefore need real-Chromium evidence: a
screenshot mid-drag showing the gap open with neighbours displaced, and one
confirming icons no longer magnify on hover. This batch has already produced two
defects that every test passed and only a browser caught, so this is not optional.

Scoped test runs only — the full suite takes ~295s and the repo owner has stopped
it before. `pnpm build` must pass; it is the only gate that compiles CSS.

## Risks

**Item (3) replaces work that just passed a final review.** The `.dock-ph`
placeholder, `showPh()` and the dashed-frame preview were built, reviewed and
approved earlier in this batch. Most of that is deleted here. The geometry snapshot
and `dropTarget` survive; the rendering does not. Doing this on the same branch is
deliberate — a separate branch would conflict on `HomeDock.vue` immediately.

**The reflow is this batch's first real animation.** Transform-based sliding under
a pointer gesture is where jank and off-by-one-slot errors live, and jsdom offers
no protection. Expect the browser check to find something.

## Known constraints carried forward

- `src/styles/theme.css` must not be modified.
- Commits stage named files only, every commit is signed off, and comments and
  commit messages are English.
- `@nimotech/nimoos-service` is a pnpm `file:` dependency that pnpm hard-copies;
  editing it requires `pnpm install` before the app sees the change.
