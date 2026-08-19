## Task 4: The dock's icons move aside for real

**Files:**
- Modify: `src/home/components/HomeDock.vue` (template zones, the drag state, `showPh`, and the scoped styles)
- Modify: `src/home/components/HomeDock.test.ts`

**Interfaces:**
- Consumes from Task 3: `slotShifts(keys, holeIndex, insertAt)` returning `DockShift[]`.
- Consumes, already present: `dropTargetIn(clientX, geom)` returning `{ toZone, beforeKey }`; `measureGeometry()`; the `geom` snapshot.
- Produces: nothing later tasks consume, but Task 6 adds a branch to the same `onDragMove`, so leave that function readable.

**What this replaces.** The `.dock-ph` placeholder element, the four blocks that render it in the template, and `showPh()` all go. **The geometry snapshot stays** — see "What must survive" at the top. The new gap is also an in-flow layout change, so re-measuring mid-drag would reintroduce the oscillation the snapshot exists to prevent.

**Deriving `insertAt` from what already exists.** `dropTargetIn` returns `beforeKey`. For the target zone, `insertAt` is that key's index in the zone's remaining-icon list, or the list's length when `beforeKey` is null. No new geometry logic is needed.

**Pixels from the measured pitch, not a constant.** `.dock-app` is `var(--app-size, 64px)` wide and `.dock-zone` has `gap: calc(var(--app-size, 64px) * 0.3)`, so the pitch is `app-size * 1.3` — but the `<= 720px` media query overrides the gap to `8px`, so a hardcoded pitch would be wrong on a narrow window. Derive it from the snapshot: the distance between the first two slot midpoints in the zone, falling back to the dragged icon's own width times 1.3 when a zone has fewer than two slots.

- [ ] **Step 1: Write the failing tests**

Replace the two placeholder tests in `src/home/components/HomeDock.test.ts` (`shows an insertion placeholder while dragging and clears it afterwards` and `shows no placeholder for a plain click`) with:

```ts
  // jsdom reports every rect as zero, so the pitch is 0 here and the transforms all
  // read "translateX(0px)". What these tests can prove is that the reflow is driven
  // at all, that it is cleared afterwards, and that the placeholder element is gone.
  it('offsets icons while dragging and clears the offsets afterwards', async () => {
    useAppsStore()
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click') // drag needs the expanded dock
    const nav = w.get('nav').element as HTMLElement
    nav.setPointerCapture = (() => {}) as never

    expect(w.find('.dock-ph').exists()).toBe(false) // the placeholder is gone for good

    await w.get('.dock-app[data-app="settings"]').trigger('pointerdown', { pointerId: 3, clientX: 100, clientY: 100 })
    const move = new Event('pointermove') as PointerEvent
    Object.assign(move, { pointerId: 3, clientX: 140, clientY: 100 }) // crosses the 5px threshold
    window.dispatchEvent(move)
    await w.vm.$nextTick()
    const offset = w.findAll('.dock-app[data-app]').filter((b) => (b.element as HTMLElement).style.transform !== '')
    expect(offset.length).toBeGreaterThan(0)

    const up = new Event('pointerup') as PointerEvent
    Object.assign(up, { pointerId: 3, clientX: 140, clientY: 100 })
    window.dispatchEvent(up)
    await w.vm.$nextTick()
    const after = w.findAll('.dock-app[data-app]').filter((b) => (b.element as HTMLElement).style.transform !== '')
    expect(after.length).toBe(0)
  })

  it('offsets nothing for a plain click', async () => {
    useAppsStore()
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    await w.get('.dock-app[data-app="settings"]').trigger('pointerdown', { pointerId: 4, clientX: 100, clientY: 100 })
    const move = new Event('pointermove') as PointerEvent
    Object.assign(move, { pointerId: 4, clientX: 102, clientY: 100 }) // under the threshold
    window.dispatchEvent(move)
    await w.vm.$nextTick()
    const offset = w.findAll('.dock-app[data-app]').filter((b) => (b.element as HTMLElement).style.transform !== '')
    expect(offset.length).toBe(0)
  })
```

Keep the existing `suppresses the browser's native image drag on dock icons` test and the pre-existing `expanded: pointerdown alone does NOT capture the pointer` test untouched — the second guards expanded-mode clicks and breaking it means the change is wrong.

- [ ] **Step 2: Run them and confirm they fail**

```
pnpm vitest run src/home/components/HomeDock.test.ts --reporter=verbose
```

Expected: the first new test FAILS at the `offset.length` assertion — nothing writes a transform yet. `.dock-ph` still exists, so that assertion fails too.

- [ ] **Step 3: Replace the placeholder markup with plain icon lists**

In `src/home/components/HomeDock.vue`, the two zones become:

```html
      <div class="dock-zone" data-zone="fav">
        <DockApp v-for="k in favVisible" :key="k" :app-key="k" :style="shiftStyle('fav', k)" />
      </div>
      <span v-if="!isMobile" class="dock-sep" />
      <div v-if="!isMobile" class="dock-zone dock-more" data-zone="more" :inert="!dock.expanded.value || undefined">
        <DockApp v-for="k in dock.moreKeys.value" :key="k" :app-key="k" :style="shiftStyle('more', k)" />
      </div>
```

`DockApp`'s root is a `<button class="dock-app">`, so a `:style` binding lands on it without any change to that component.

- [ ] **Step 4: Compute the offsets**

In `HomeDock.vue`, import `slotShifts` alongside the existing imports:

```ts
import { dropTargetIn, slotShifts, type DockSlot, type DockGeometry, type DropDecision } from '../grid/dockMath'
```

Add to the `DragState` interface and its initialiser:

```ts
  fromZone: 'fav' | 'more' | null
  holeIndex: number
```
```ts
  fromZone: null,
  holeIndex: 0,
```

Record where the icon came from, in `onDragStart`, right after `drag.key` is set:

```ts
  // The icon's own slot is the hole its zone reflows around; the other zone gets an
  // appended spare, which slotShifts models as a hole at the end.
  drag.fromZone = dock.favKeys.value.includes(key) ? 'fav' : 'more'
  drag.holeIndex = (drag.fromZone === 'fav' ? dock.favKeys.value : dock.moreKeys.value).indexOf(key)
```

Delete `showPh` and add, next to `resolveDrop`:

```ts
/** The icons still on the ground in a zone: everything but the one being dragged. */
function zoneKeys(zone: 'fav' | 'more'): string[] {
  const all = zone === 'fav' ? favVisible.value : dock.moreKeys.value
  return all.filter((k) => k !== drag.key)
}

/**
 * The hole this zone reflows around. In the zone the icon came from it is the
 * icon's own former index; in the other zone it is the appended spare at the end.
 */
function holeFor(zone: 'fav' | 'more'): number {
  return zone === drag.fromZone ? drag.holeIndex : zoneKeys(zone).length
}

/**
 * Slot pitch in pixels, read from the snapshot rather than recomputed from
 * --app-size: the <= 720px media query overrides the zone's gap to 8px, so the
 * app-size * 1.3 that holds on a wide window is wrong on a narrow one.
 */
function pitchFor(zone: 'fav' | 'more'): number {
  const slots = zone === 'fav' ? geom?.favSlots : geom?.moreSlots
  if (slots && slots.length >= 2) return slots[1].midX - slots[0].midX
  const src = root.value?.querySelector<HTMLElement>(`.dock-app[data-app="${drag.key}"]`)
  return (src?.getBoundingClientRect().width ?? 0) * 1.3
}

/**
 * The transform that moves one icon aside. Returns undefined when no drag is live
 * so the element carries no inline style at rest.
 */
function shiftStyle(zone: 'fav' | 'more', key: string): Record<string, string> | undefined {
  if (!drag.active) return undefined
  const keys = zoneKeys(zone)
  const insertAt = drag.toZone !== zone
    ? null
    : drag.beforeKey == null ? keys.length : Math.max(0, keys.indexOf(drag.beforeKey))
  const shift = slotShifts(keys, holeFor(zone), insertAt).find((s) => s.key === key)
  if (!shift) return undefined
  return { transform: `translateX(${shift.slots * pitchFor(zone)}px)` }
}
```

Clear the new state in `resetDragState`:

```ts
  drag.fromZone = null
  drag.holeIndex = 0
```

- [ ] **Step 5: Animate the offsets**

In `HomeDock.vue`'s scoped styles, replace the `.dock-ph` rules with:

```css
/* The reflow's animation. The transform is written inline per icon by shiftStyle;
   this only supplies the easing. Icons keep their DOM order and slide — reordering
   the DOM mid-gesture would make Vue rebuild the nodes and lose the animation. */
.dock-zone :deep(.dock-app) { transition: transform .18s var(--ease, ease); }
@media (prefers-reduced-motion: reduce) {
  .dock-zone :deep(.dock-app) { transition: none; }
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

```
pnpm vitest run src/home/components/HomeDock.test.ts src/home/grid/dockMath.test.ts --reporter=verbose
```

Expected: all PASS, including the two pre-existing drag tests.

- [ ] **Step 7: Build**

```
pnpm build
```

Expected: success.

- [ ] **Step 8: See the reflow in a real browser**

jsdom cannot show this: its rects are zero, so the pitch is zero and every transform is `translateX(0px)`. The animation and the gap only exist in a browser.

Build a standalone page reproducing the expanded dock — copy `.dock`, `.dock-main`, `.dock-zone`, `.dock-sep` from `HomeDock.vue`'s scoped styles and `.dock-app`, `.dock-ic`, `.dock-label` from `theme.css:882-898`, set `--app-size: 64px`, include the global `box-sizing: border-box` reset, and lay out three icons, a separator, and four more. Import `slotShifts` logic by hand into the page (it is four lines) and apply transforms for a chosen `holeIndex` / `insertAt`. Screenshot at least:

1. at rest — no gaps, no transforms;
2. dragging the first favourite, inserting between the second and third "more" icon — the favourites show a hole at the front, and the "more" icons after the insertion point have slid one pitch right;
3. the same with the drag starting from the last "more" icon and inserting at the front of favourites — mirror image.

Confirm from the images that the gap is exactly one slot wide, that the two zones move independently, that the separator has not moved, and that no icon has crossed it. Report the screenshot paths and the pitch you measured.

Also confirm the fisheye from Task 2 is gone: hover a dock icon in the running dev server on port 5273 and check the icon does not grow. If you cannot drive a hover, state that and leave it for the owner's acceptance.

- [ ] **Step 9: Commit**

```
git add src/home/components/HomeDock.vue src/home/components/HomeDock.test.ts
```
```
git commit -s -m "feat(home): make dock icons move aside while one is dragged

Replaces the dashed insertion placeholder with the real thing: the icons in the
target zone slide one slot to open a gap under the pointer, and the zone the icon
came from keeps its own slot open. Each zone reflows independently, so nothing is
ever pushed across the separator.

Icons keep their DOM order and move by transform. Reordering the DOM mid-gesture
would make Vue tear the nodes down and rebuild them, which loses the animation and
risks flicker, so the gap is an absence of offset rather than an inserted element —
which is also why the .dock-ph element is gone.

The one-measurement-per-drag geometry snapshot stays, and matters more than
before: the gap is itself an in-flow layout change, so measuring per pointermove
would feed the reflow back into the input that produced it. That is the oscillation
the snapshot was introduced to stop.

The slot pitch comes from the snapshot rather than from --app-size, because the
narrow-window media query overrides the zone gap and app-size * 1.3 stops holding."
```

---

