## Task 2: Switch off the fisheye

**Files:**
- Modify: `src/home/components/HomeDock.vue` (the `magScale` import on line 59, the `onMove` / `reset` functions, and the `@pointermove` / `@pointerleave` bindings on line 3)
- Modify: `src/home/grid/dockMath.ts` (lines 1-5)
- Modify: `src/home/grid/dockMath.test.ts` (the `magScale` describe block)

**Interfaces:**
- Produces: `magScale` is no longer imported anywhere. Task 3 adds a new export to the same file and must not disturb the commented block.

**Comment out; do not delete.** The owner's instruction was "先注释掉吧,全部注释掉" — switched off, kept so it can be restored.

**Do not touch `theme.css`.** It is a standing constraint, and it is also unnecessary: `theme.css:888` reads `transform: translateY(calc((var(--mag, 1) - 1) * -12px)) scale(var(--mag, 1))`. With nothing writing `--mag`, the fallback `1` makes the translate `0` and the scale `1`, so the effect is off with the rule untouched.

- [ ] **Step 1: Write the failing test**

Add to `src/home/components/HomeDock.test.ts`, inside `describe('HomeDock')`:

```ts
  // The fisheye is switched off on request. Nothing may write --mag any more; the
  // theme.css rule that consumes it falls back to 1, which is identity, so the
  // effect is gone without that file being edited.
  it('no longer magnifies icons on hover', async () => {
    useAppsStore()
    const w = mount(HomeDock)
    await w.get('nav').trigger('pointermove', { clientX: 100, clientY: 10 })
    const styled = w.findAll('.dock-ic').filter((ic) => (ic.element as HTMLElement).style.getPropertyValue('--mag') !== '')
    expect(styled.length).toBe(0)
  })
```

- [ ] **Step 2: Run it and confirm it fails**

```
pnpm vitest run src/home/components/HomeDock.test.ts --reporter=verbose
```

Expected: FAIL — `onMove` sets `--mag` on every `.dock-ic`, so `styled.length` is greater than 0.

- [ ] **Step 3: Comment out the dock's handlers**

In `src/home/components/HomeDock.vue`, change the `<nav>` opening tag to drop the two bindings, leaving a note:

```html
  <nav ref="root" class="dock" :class="{ expanded: dock.expanded.value }" :aria-label="t('dockAria')"
    @pointerdown.capture="onDragStart"
  >
```

Comment out the import on line 59 and the two functions, keeping the rest of the import list working:

```ts
import { dropTargetIn, type DockSlot, type DockGeometry, type DropDecision } from '../grid/dockMath'
// The dock's fisheye magnification, switched off at the owner's request and kept
// rather than deleted so it can be restored. theme.css still carries the rule that
// consumes --mag; with nothing writing it the fallback of 1 is identity, so the
// effect is off without that file being touched.
// import { magScale } from '../grid/dockMath'
```

and

```ts
// ── Magnification (switched off; see the note on the magScale import) ─────────
// function onMove(e: PointerEvent) {
//   if (drag.active) return // skip mag while dragging
//   root.value?.querySelectorAll<HTMLElement>('.dock-app:not(.dock-dragging) .dock-ic').forEach((ic) => {
//     const r = ic.getBoundingClientRect()
//     ic.style.setProperty('--mag', magScale(e.clientX - (r.left + r.width / 2)).toFixed(3))
//   })
// }
// function reset() { root.value?.querySelectorAll<HTMLElement>('.dock-ic').forEach((ic) => ic.style.setProperty('--mag', '1')) }
```

- [ ] **Step 4: Comment out `magScale` and its test**

In `src/home/grid/dockMath.ts`, replace lines 1-5 with:

```ts
// The dock's fisheye magnification, switched off at the owner's request and kept
// rather than deleted so it can be restored. Its only caller was HomeDock's
// pointermove handler, which is commented out alongside it.
// const MAG_AMP = 0.55, MAG_SIGMA = 70
// // engine.js 1142-1148
// export function magScale(distance: number): number {
//   return 1 + MAG_AMP * Math.exp(-(distance * distance) / (2 * MAG_SIGMA * MAG_SIGMA))
// }
```

In `src/home/grid/dockMath.test.ts`, comment out the whole `describe('magScale', ...)` block and its `magScale` import, with the same one-line reason above it. Leave the `dropTarget` describe untouched.

- [ ] **Step 5: Run the tests and confirm they pass**

```
pnpm vitest run src/home/components/HomeDock.test.ts src/home/grid/dockMath.test.ts --reporter=verbose
```

Expected: PASS, including the pre-existing drag tests.

- [ ] **Step 6: Build**

```
pnpm build
```

Expected: success. `vue-tsc` is what catches an `onMove` still referenced from the template after the function is commented out.

- [ ] **Step 7: Commit**

```
git add src/home/components/HomeDock.vue src/home/components/HomeDock.test.ts src/home/grid/dockMath.ts src/home/grid/dockMath.test.ts
```
```
git commit -s -m "feat(home): switch off the dock's fisheye magnification

Commented out rather than deleted, as asked, so it can come back.

theme.css is deliberately untouched: its .dock-ic rule reads var(--mag, 1) for
both a translate and a scale, so with nothing writing the property the fallback
makes each term identity. Editing that file is barred while another checkout has
uncommitted work in it, and it turns out not to be needed."
```

---

