## Task 6: Drag an icon from the dock onto the desktop

**Files:**
- Modify: `src/views/Home.vue` (line 9, the `<HomeDock>` tag)
- Modify: `src/home/components/HomeDock.vue` (props, `onDragMove`, `onDragEnd`)
- Modify: `src/home/components/HomeDock.test.ts`

**Interfaces:**
- Consumes from Task 5: `cellAtPointer(clientX, clientY, rect, size, grid)`.
- Consumes, already present: `useAddPanel(dims).spawnPlace(desc, tc, tr)` from `src/home/composables/useAddPanel.ts:61`, and `homeUi.spawnGhost` from `src/home/stores/homeUi.ts:11`, which `GridCanvas.vue:17` already renders.

**Most of this exists.** `AddPanel.vue:174-215` already implements the whole flow — threshold, live cell ghost, displacement of overlapping items via `planFootprint`, refusal of duplicates via `isDuplicate`, and the three toasts (`addPanelAppExists` / `addPanelNoRoom` / `addPanelAddedToast`). `spawnPlace` is where all of that lives, so this task is a branch in the dock's existing handlers, not new behaviour.

**A copy, not a move.** The dock keeps the icon. When the pointer leaves the dock for the grid, the dock's reflow clears and it looks as it does at rest.

**Released off the grid, nothing happens.** `AddPanel` carries an explicit comment about this: falling through to `pinToFree` would add the item at the first free cell, which is not what a user dragging into empty space asked for.

- [ ] **Step 1: Write the failing tests**

Append to `src/home/components/HomeDock.test.ts`. Mock the composable so the test asserts the dock's wiring rather than re-testing placement, which `AddPanel.spawn-place.test.ts` already covers:

```ts
// vi.hoisted, not a bare const: vi.mock is hoisted above top-level declarations, so
// a plain const would be read before initialisation.
const { spawnPlace } = vi.hoisted(() => ({ spawnPlace: vi.fn(() => true) }))
// A narrow mock on purpose. Calling the real useAddPanel inside the factory would
// run at module-eval time, before any pinia is active, and it reaches for
// useLayoutStore()/useHomeUiStore() immediately. HomeDock only ever calls
// spawnPlace, so that is all the mock needs to provide.
vi.mock('../composables/useAddPanel', () => ({ useAddPanel: () => ({ spawnPlace }) }))
```

and inside `describe('HomeDock')`:

```ts
  // Dragging a dock icon onto the desktop adds a copy there. The placement itself
  // (displacement, duplicate refusal, toasts) belongs to spawnPlace and is covered
  // by the add-panel's own tests; what matters here is that the dock calls it with
  // the cell under the pointer, and only when the release is over the grid.
  const gridStub = () => {
    const el = document.createElement('div')
    el.getBoundingClientRect = () => ({ left: 200, top: 100, right: 200 + 12 * 76, bottom: 100 + 8 * 76, width: 12 * 76, height: 8 * 76, x: 200, y: 100, toJSON: () => ({}) })
    return el
  }

  const dragOnto = async (clientX: number, clientY: number) => {
    useAppsStore()
    const w = mount(HomeDock, { props: { cell: 60, gap: 16, cols: 12, rows: 8, gridEl: gridStub() } })
    await w.get('.dock-toggle').trigger('click')
    ;(w.get('nav').element as HTMLElement).setPointerCapture = (() => {}) as never
    await w.get('.dock-app[data-app="settings"]').trigger('pointerdown', { pointerId: 9, clientX: 100, clientY: 500 })
    const move = new Event('pointermove') as PointerEvent
    Object.assign(move, { pointerId: 9, clientX, clientY })
    window.dispatchEvent(move)
    await w.vm.$nextTick()
    const up = new Event('pointerup') as PointerEvent
    Object.assign(up, { pointerId: 9, clientX, clientY })
    window.dispatchEvent(up)
    await w.vm.$nextTick()
    return w
  }

  it('adds a copy to the desktop when released over the grid', async () => {
    spawnPlace.mockClear()
    await dragOnto(230, 130)
    expect(spawnPlace).toHaveBeenCalledTimes(1)
    expect(spawnPlace.mock.calls[0][0]).toMatchObject({ kind: 'app', key: 'settings', w: 1, h: 1 })
    expect(spawnPlace.mock.calls[0].slice(1)).toEqual([1, 1])
  })

  it('does nothing when released outside the grid', async () => {
    spawnPlace.mockClear()
    await dragOnto(100, 560) // still down by the dock, nowhere near the grid
    expect(spawnPlace).not.toHaveBeenCalled()
  })

  it('leaves the dock untouched — this is a copy, not a move', async () => {
    spawnPlace.mockClear()
    const w = await dragOnto(230, 130)
    expect(w.findAll('.dock-app[data-app]').some((b) => b.attributes('data-app') === 'settings')).toBe(true)
    const offset = w.findAll('.dock-app[data-app]').filter((b) => (b.element as HTMLElement).style.transform !== '')
    expect(offset.length).toBe(0)
  })
```

- [ ] **Step 2: Run them and confirm they fail**

```
pnpm vitest run src/home/components/HomeDock.test.ts --reporter=verbose
```

Expected: FAIL — `HomeDock` accepts no props and never calls `spawnPlace`.

- [ ] **Step 3: Give HomeDock the grid's dimensions**

In `src/views/Home.vue`, line 9 becomes:

```html
    <HomeDock ref="dock" :cell="cell" :gap="gap" :cols="cols" :rows="rows" :grid-el="gridEl" />
```

Those five are already in scope — line 10 passes the same set to `AddPanel`.

In `HomeDock.vue`, declare them (the component currently has no `defineProps`):

```ts
// The grid's geometry, passed in exactly as Home.vue already passes it to
// AddPanel: dragging an icon out of the dock and onto the desktop needs the same
// pointer-to-cell answer the add panel computes.
const props = defineProps<{ cell?: number; gap?: number; cols?: number; rows?: number; gridEl?: HTMLElement | null }>()
```

- [ ] **Step 4: Add the desktop branch**

In `HomeDock.vue`, add the imports:

```ts
import { cellAtPointer } from '../grid/pointerMath'
import { useAddPanel } from '../composables/useAddPanel'
import { useHomeUiStore } from '../stores/homeUi'
```

and near the other composable calls:

```ts
const homeUi = useHomeUiStore()
const addPanel = useAddPanel({ cols: props.cols ?? 12, rows: props.rows ?? 8 })

/** The cell a dock icon would land on, or null when the pointer is off the grid. */
function gridCellAt(clientX: number, clientY: number): { tc: number; tr: number } | null {
  const el = props.gridEl
  if (!el) return null
  return cellAtPointer(clientX, clientY, el.getBoundingClientRect(), { w: 1, h: 1 }, {
    cell: props.cell ?? 60,
    gap: props.gap ?? 16,
    cols: props.cols ?? 12,
    rows: props.rows ?? 8,
  })
}
```

At the end of `onDragMove`, replace the two lines that set `drag.toZone` / `drag.beforeKey` with a branch:

```ts
  // Over the desktop: preview the cell instead of the dock's reflow. Over the dock:
  // the reverse. The two previews are mutually exclusive, so whichever is not in
  // play must be cleared or it lingers.
  const cell = gridCellAt(e.clientX, e.clientY)
  if (cell) {
    drag.toZone = null
    drag.beforeKey = null
    homeUi.spawnGhost = { c: cell.tc, r: cell.tr, w: 1, h: 1, ok: true }
  } else {
    homeUi.spawnGhost = null
    const target = resolveDrop(e.clientX)
    drag.toZone = target.toZone
    drag.beforeKey = target.beforeKey
  }
```

In `onDragEnd`, after restoring the source's opacity, branch before the existing `dock.reorder` call:

```ts
  homeUi.spawnGhost = null

  // Released over the desktop: add a copy there and leave the dock alone.
  // spawnPlace displaces whatever it overlaps, refuses an app already on the
  // desktop, and raises the toast for each outcome. Released anywhere that is
  // neither the grid nor the dock, nothing happens at all — falling through to a
  // reorder or to pinToFree would act on a gesture the user aborted.
  const cell = gridCellAt(e.clientX, e.clientY)
  if (cell) {
    addPanel.spawnPlace({ kind: 'app', key: drag.key, w: 1, h: 1 }, cell.tc, cell.tr)
    dock.justDragged.value = true
    setTimeout(() => { dock.justDragged.value = false }, 0)
    resetDragState()
    return
  }
```

Also clear the ghost in `onDragCancel` and `resetDragState` so an interrupted gesture leaves nothing behind:

```ts
  homeUi.spawnGhost = null
```

- [ ] **Step 5: Run the tests and confirm they pass**

```
pnpm vitest run src/home/components/HomeDock.test.ts --reporter=verbose
```

Expected: all PASS, the earlier reflow and native-drag tests included.

- [ ] **Step 6: Check the surrounding area**

```
pnpm vitest run src/home --reporter=verbose
```

Expected: PASS. `Home.vue` gained props on a child, and `GridCanvas.test.ts` / `MobileHome.test.ts` mount that area.

- [ ] **Step 7: Build**

```
pnpm build
```

Expected: success. `vue-tsc` is what catches a `props` field name that does not match `Home.vue`'s binding.

- [ ] **Step 8: Verify on the running dev server**

A dev server is already up on port 5273 (`http://192.168.1.143:5273/app/`). This gesture crosses two components and cannot be proven in jsdom.

Confirm, by driving the page or by reporting precisely how far you got:

1. expand the dock, drag an icon up onto the desktop — a drop ghost appears on the grid and the dock's own reflow clears;
2. release over an empty cell — the app appears there and **the dock still has its icon**;
3. drag the same app out again and release on the grid — the "already exists" toast appears and nothing is added;
4. release halfway between the dock and the grid — nothing happens anywhere.

Reaching the real page needs `access_token`, `refresh_token`, **`version`** and `user` in `localStorage`; omitting `version` makes `src/router/guard.ts` clear the token and bounce to `/login` **with no visible error**. Navigate with a fresh `Page.navigate` to `…/app/?probe=1#/`, never `Page.reload` — the session store snapshots `localStorage` at module load, so a reload lands on the login page, which clears the token.

If you cannot drive it, report DONE_WITH_CONCERNS naming which of the four you could not observe. Do not claim a behaviour you have not seen.

- [ ] **Step 9: Commit**

```
git add src/views/Home.vue src/home/components/HomeDock.vue src/home/components/HomeDock.test.ts
```
```
git commit -s -m "feat(home): drag an app from the dock onto the desktop to add a copy

Almost all of this already existed. The add panel's spawn drag does the threshold,
the live cell ghost, displacement of whatever the item overlaps, refusal of an app
already on the desktop, and a toast for each outcome — all inside spawnPlace. The
dock now takes the same route, so there is one placement path rather than two that
can drift apart.

It is a copy: the dock keeps its icon, and the dock's own reflow clears as soon as
the pointer crosses onto the grid, so the two previews are never both on screen.

Released over neither the grid nor the dock, nothing happens. The add panel already
carried a comment warning that falling through to pinToFree would add the item at
the first free cell, which is precisely not what someone who dragged into empty
space asked for; the same reasoning applies to falling through to a reorder."
```

---

## Final verification

- [ ] **Step 1: Run every touched area**

```
pnpm vitest run src/home src/settings src/stores/locale.test.ts src/i18n packages/service/src/sys.test.ts --reporter=verbose
```

Expected: PASS. Note two things about this range, so neither is mistaken for your regression:

- `src/home/components/DesktopContextMenu.test.ts` is **intermittently flaky** under parallel load. It waits on reka-ui's internal `nextTick` with a bare `setTimeout(r, 10)`, which is not always enough when ~140 files run at once. It is untouched by this batch. If it fails, re-run it alone to confirm.
- `src/ai/knowledge` carries **58 pre-existing failures** (`ParserTest.test.ts`, `SettingsView.test.ts`) — English-copy assertions from an unrelated sweep. They are outside this range; do not add them to it.

- [ ] **Step 2: Build**

```
pnpm build
```

Expected: success.

- [ ] **Step 3: Confirm the constraints held**

```
git status --short
```
Expected: empty.

```
git diff master -- src/styles/theme.css
```
Expected: empty. If not, revert that hunk — the file is off-limits for this batch.

- [ ] **Step 4: Confirm what had to survive is still there**

```
grep -n "measureGeometry\|dropTargetIn\|onResize" src/home/components/HomeDock.vue
```
Expected: all three present. The geometry snapshot is what stops the drop landing on the opposite of the preview.

```
grep -n "draggable" src/home/components/DockApp.vue
```
Expected: `draggable="false"` present. Without it the browser's native image drag takes the gesture back.

- [ ] **Step 5: Report**

Per task: what changed, the test command and result, and for Tasks 4 and 6 the browser evidence with screenshot paths. Name anything you could not verify. **Do not push** — the owner pushes.
