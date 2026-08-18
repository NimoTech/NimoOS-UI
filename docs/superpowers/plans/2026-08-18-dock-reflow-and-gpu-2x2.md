# Dock Live Reflow and 2x2 GPU Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dock's icons slide aside for real while an icon is dragged, let an icon be dragged from the dock onto the desktop to add a copy there, switch off the dock's fisheye, and reduce the 2x2 GPU card to its ring alone.

**Architecture:** The reflow is expressed as one pure function in `src/home/grid/dockMath.ts` that maps a hole index and an insertion index to a per-icon shift of -1, 0 or +1 slots; `HomeDock.vue` converts those to `translateX` and animates them. Dragging onto the desktop reuses the add-to-desktop flow that `AddPanel.vue` already implements, with its shared pointer-to-cell helper lifted into `src/home/grid/pointerMath.ts`.

**Tech Stack:** Vue 3 + TypeScript + vitest + @vue/test-utils + pinia; pnpm@9.0.6; headless Chromium for visual evidence.

**Spec:** `docs/superpowers/specs/2026-08-18-dock-reflow-and-gpu-2x2-design.md` — read it before Task 1. It records why the dock request is new work rather than reuse, and why the GPU change reverses an earlier fix.

## Where you are working

This plan is executed **in a fresh session** by the repo owner's instruction, so nothing about the environment can be assumed from conversation history. Everything you need is here.

- **Working directory:** `/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/home-widgets-batch`
- **Branch:** `worktree-home-widgets-batch`, which already carries 19 commits of a preceding batch. Do not create a new branch; this work continues here because it rewrites code that batch just landed.
- **This is a git worktree.** Run everything from the directory above. Never `cd` to `/home/nimo/NimoTech/NimoOS-New-UI` — that is the owner's own checkout and another session is actively editing it.
- **A dev server is already running on port 5273** for the owner's visual acceptance (`http://192.168.1.143:5273/app/`). Leave it running. If you need to restart it after editing `packages/service`, say so in your report rather than killing it silently.
- **Do not push.** The owner pushes.

## Global Constraints

- **Code comments and commit messages: English only.** Doc comments, test assertion messages, log lines and error text included.
- **Every commit uses `-s`.** A DCO bot blocks any non-merge commit without a `Signed-off-by:` trailer.
- **`src/styles/theme.css` must not be modified, at all.** Another checkout has uncommitted work in that file; touching it here tangles the two. `git diff master -- src/styles/theme.css` must stay empty. This binds Task 2 in particular, where the tempting fix is to edit the `.dock-ic` transform.
- **Never `git add -A` or `git commit -a`.** Stage named files only.
- **Scoped tests only.** The full suite takes ~295s and the owner has stopped it before. Run the files you touch.
- **Always pass `--reporter=verbose`** to vitest. The default reporter hides stderr from passing tests, so warnings go unseen.
- **`pnpm build` must pass before each commit.** It is `vue-tsc --noEmit && vite build` and is the only gate that compiles CSS. This batch already shipped one defect that every test passed and only the build caught.
- **Package manager is pnpm@9.0.6.** Never npm or yarn. If you edit anything under `packages/service`, run `pnpm install` afterwards — pnpm hard-copies that `file:` dependency and a stale copy silently broke a feature earlier on this branch while every test stayed green.
- **Bash commands must be single plain invocations** — no `cd`, no `&&`, no `;`, no output redirection, no subshells. A worktree-isolated session refuses commands it cannot verify stay inside the worktree. Run them one at a time.
- **Never use `git stash`.** The stash stack is shared with the owner's checkout, where another session is working; a bare `pop` can take their entry.
- **Test environment:** vitest runs with `TZ=UTC` and the i18n locale pinned to `zh_cn`, so assert Chinese copy (`温度`, `显存`, `频率`, `使用率`).
- **Chromium** is at `~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`. The Playwright packages are **not** installed — drive the binary directly:
  `chrome --headless=new --no-sandbox --hide-scrollbars --force-device-scale-factor=3 --window-size=900,500 --virtual-time-budget=2500 --screenshot=/abs/out.png "file:///abs/page.html"`
  Put throwaway files under `/tmp/claude-1000/-home-nimo-NimoTech/30777c28-04dd-4494-866d-88701c163be5/scratchpad/` and never commit them.
- **A standalone test page must copy the app's global `box-sizing: border-box` reset.** Omitting it produced a false-positive overflow earlier in this batch.

## What must survive from the preceding batch

Task 4 deletes a lot of recently-added code. These three things are **not** to be removed, because each fixes a defect a final review caught:

1. **The one-measurement-per-drag geometry snapshot** (`measureGeometry()`, the `geom` variable, `resolveDrop()`, `onResize()`). Measuring on every pointermove fed the insertion placeholder back into its own input; driven against real Chromium layout the decision oscillated on 12 of 38 sampled pointer positions and the drop landed on the opposite of the preview. The new gap is also a layout change, so this hazard is unchanged.
2. **`dropTarget` / `dropTargetIn` in `dockMath.ts`** and their tests. The insertion index still comes from them.
3. **`draggable="false"` plus `-webkit-user-drag: none` and `user-select: none` in `DockApp.vue`**, and the source guard in `src/home/components/style-guard.test.ts` that asserts them. Without all three the browser's native image drag steals the gesture — the original bug was "the icons cannot be moved and the cursor turns into a circle-slash".
4. **The `expanded` gate at the top of `onDragStart`** (`if (!dock.expanded.value) return`) and the dragged source's `opacity: 0`. The gate is deliberate: dragging is an expanded-dock gesture and the collapsed dock stays clickable. The pre-existing test `expanded: pointerdown alone does NOT capture the pointer; crossing the drag threshold does` guards a related invariant — during pointer capture the browser dispatches `click` to the capture element rather than the icon, so capturing on press would kill every expanded-mode click. If your change breaks that test, the change is wrong.

---

## File Structure

- Modify `src/home/components/widgets/GpuWidget.vue` — drop the 2x2 pill branch (Task 1).
- Modify `src/home/components/widgets/GpuWidget.test.ts` — two existing assertions pin the removed behaviour (Task 1).
- Modify `src/home/grid/dockMath.ts` — comment out `magScale` (Task 2); add `slotShifts` (Task 3).
- Modify `src/home/grid/dockMath.test.ts` — comment out the `magScale` block (Task 2); test `slotShifts` (Task 3).
- Modify `src/home/components/HomeDock.vue` — comment out the fisheye handlers (Task 2); replace the placeholder with the reflow (Task 4); add the desktop branch (Task 6).
- Modify `src/home/components/HomeDock.test.ts` — placeholder tests become reflow tests (Task 4); spawn tests (Task 6).
- Modify `src/home/grid/pointerMath.ts` — gains the shared `cellAtPointer` (Task 5).
- Modify `src/home/grid/pointerMath.test.ts` — tests for it (Task 5).
- Modify `src/home/components/AddPanel.vue` — uses the shared helper (Task 5).
- Modify `src/views/Home.vue` — passes grid props to `HomeDock` (Task 6).

---

## Task 1: The 2x2 GPU card shows only its ring

**Files:**
- Modify: `src/home/components/widgets/GpuWidget.vue` (template lines 2-11, and the `.pill*` rules at lines 78-83)
- Modify: `src/home/components/widgets/GpuWidget.test.ts`

**Interfaces:**
- Produces: nothing other tasks consume. Independent of Tasks 2-6; may be done first or last.

**Why this reverses an earlier commit.** A commit on this same branch added a frequency pill at 2x2, so the one field integrated graphics reports would be visible at the default size. The owner then looked at the rendered card and found the pills do not fit at 2x2 at all — they are clipped mid-glyph, so the substitution only changed which clipped label was unreadable. The frequency stays available by widening the card. **Say this in the commit body**, or the diff reads as undoing a fix for no reason.

- [ ] **Step 1: Update the two tests that pin the removed behaviour**

In `src/home/components/widgets/GpuWidget.test.ts`:

The test `shows rounded usage and temperature` mounts at `item(2)` and asserts `'61℃'`. Temperature lives only in the `w > 2` branch, so it will no longer render at 2x2. Change that test to mount at `item(4)`, keeping both assertions:

```ts
  it('shows rounded usage and temperature', () => {
    const s = useLiveStatsStore()
    s.ingest({ cpu: null, mem: null, disk: null, net: null, gpu: [{ utilization_gpu: 33.4, temperature: 61, utilization_memory: 20, memory_total: 8e9, name: 'NV' }] } as any)
    // Mounted wide: at the default 2x2 the card is the ring alone, so temperature
    // is only on the page from three columns up.
    const w = mount(GpuWidget, { props: { item: item(4) } })
    expect(w.text()).toContain('33%')
    expect(w.text()).toContain('61℃')
  })
```

Delete the test `shows the frequency at the default 2x2 size, in place of the empty VRAM pill` entirely — it asserts exactly the behaviour being removed — and add in its place:

```ts
  // The 2x2 card is the ring alone. Pills do not fit at that size: the reference
  // screenshot showed them clipped through the middle of the word "Frequency",
  // which is why substituting one pill for another did not help. Everything the
  // pills carried is on the wide card.
  it('renders only the ring at the default 2x2 size, with no pills', () => {
    const w = mountWith(IGPU, 2)
    expect(w.find('.ring').exists()).toBe(true)
    expect(w.findAll('.pill').length).toBe(0)
    expect(w.get('.ring').text()).toContain('0.7%')
  })

  it('still shows temperature, VRAM and frequency once the card is widened', () => {
    const w = mountWith(IGPU, 4)
    const rows = w.findAll('.stat').map((r) => r.text())
    expect(rows.some((r) => r.includes('温度') && r.includes('—'))).toBe(true)
    expect(rows.some((r) => r.includes('频率') && r.includes('1000'))).toBe(true)
  })
```

- [ ] **Step 2: Run the tests and confirm they fail**

```
pnpm vitest run src/home/components/widgets/GpuWidget.test.ts --reporter=verbose
```

Expected: `renders only the ring at the default 2x2 size, with no pills` FAILS because `.pill` elements are still present. The reworked `shows rounded usage and temperature` should already pass at `item(4)`.

- [ ] **Step 3: Remove the pill branch**

In `src/home/components/widgets/GpuWidget.vue`, delete the comment block and the whole `<div v-if="item.w <= 2" class="pill-grid">` element (template lines 3-11), and change the `v-else` on the stats block to `v-if="item.w > 2"`. The `.ring-row.solo` line above stays exactly as it is, so the ring renders at every size:

```html
<template>
  <div class="ring-row solo"><RingGauge :percent="usage" :label="t('widgetUsage')" :color="col" /></div>
  <!-- At 2x2 — the card's default size (registry.ts:27) — the ring is the whole
       card. Pills were tried there and do not fit: they render clipped through the
       middle of their own labels. Temperature, VRAM and frequency are on the wide
       card below. -->
  <div v-if="item.w > 2" class="stats">
```

Then delete the six now-unused `.pill*` rules (lines 78-83 of the `<style scoped>` block): `.pill-grid`, `.card-in > .pill-grid`, `.card-in > .pill-grid .pill`, `.pill`, `.pill s`, `.pill b`.

Leave every computed alone — `temp`, `vram`, `memUse` and `freq` are all still used by the stats branch, and `col` still feeds the ring.

- [ ] **Step 4: Run the tests and confirm they pass**

```
pnpm vitest run src/home/components/widgets/GpuWidget.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 5: Check nothing else asserted the pills**

```
pnpm vitest run src/home/components/widgets/ --reporter=verbose
```

Expected: PASS. If another widget test referenced `.pill`, update it and say so in the commit body.

- [ ] **Step 6: Build**

```
pnpm build
```

Expected: success. This catches an orphaned CSS selector or a template typo that vitest can miss.

- [ ] **Step 7: Commit**

```
git add src/home/components/widgets/GpuWidget.vue src/home/components/widgets/GpuWidget.test.ts
```
```
git commit -s -m "fix(home): make the 2x2 GPU card the ring alone

This reverses the frequency pill added earlier on this branch, knowingly. That
change put the frequency where the VRAM pill had been so the one field integrated
graphics reports would be visible at the card's default size. Looking at the
rendered card shows why it did not work: at 2x2 the pills do not fit at all and
are clipped through the middle of their own labels, so the substitution only
changed which unreadable label was on screen.

The ring is what fits at that size, so that is what the card shows. Temperature,
VRAM and frequency are unchanged on the wide card, one column up.

The test that pinned the pill behaviour is gone; the one asserting temperature at
2x2 now mounts wide, where temperature actually lives."
```

---

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

## Task 3: The reflow's arithmetic

**Files:**
- Modify: `src/home/grid/dockMath.ts` (add at the end)
- Modify: `src/home/grid/dockMath.test.ts` (add at the end)

**Interfaces:**
- Produces, consumed by Task 4:
  - `export interface DockShift { key: string; slots: -1 | 0 | 1 }`
  - `export function slotShifts(keys: string[], holeIndex: number, insertAt: number | null): DockShift[]`

**The model, which the owner confirmed.** While an icon is dragged, **each zone has `keys.length + 1` slots**, where `keys` is that zone's remaining icons. One slot is empty:

- in the zone the icon came from, the empty slot is the icon's own former index;
- in the other zone, one spare slot is appended, so the empty slot is at index `keys.length`.

That uniformity is the point: a hole at the end *is* an appended spare, so both zones use one formula. Each zone reflows independently and nothing ever crosses the divider.

Moving the hole from `holeIndex` to `insertAt` shifts icon `keys[j]` by:

```
(j < insertAt ? j : j + 1) - (j < holeIndex ? j : j + 1)
```

which is only ever -1, 0 or +1. `insertAt === null` means the pointer is not in this zone, so the hole stays put and every shift is 0.

- [ ] **Step 1: Write the failing tests**

Append to `src/home/grid/dockMath.test.ts`:

```ts
import { slotShifts } from './dockMath'

// Each zone has keys.length + 1 slots while a drag is live: the dragged icon's own
// slot in the zone it came from, or an appended spare in the other zone. Moving the
// hole from holeIndex to insertAt is what opens a gap under the pointer.
describe('slotShifts', () => {
  const keys = ['a', 'b', 'c', 'd']
  const shifts = (hole: number, at: number | null) =>
    slotShifts(keys, hole, at).map((s) => s.slots)

  it('shifts nothing when the hole is already at the insertion point', () => {
    expect(shifts(2, 2)).toEqual([0, 0, 0, 0])
  })

  it('shifts nothing when the pointer is in the other zone', () => {
    expect(shifts(0, null)).toEqual([0, 0, 0, 0])
  })

  // Hole at the front, inserting further back: the icons in between close up
  // leftwards behind the pointer.
  it('pulls icons back when the hole moves forward', () => {
    expect(shifts(0, 3)).toEqual([-1, -1, -1, 0])
  })

  // Hole at the end (an appended spare), inserting near the front: everything from
  // the insertion point onward slides forward into the spare.
  it('pushes icons forward when the hole moves back', () => {
    expect(shifts(4, 1)).toEqual([0, 1, 1, 1])
  })

  it('handles the two ends as ordinary insertion points', () => {
    expect(shifts(4, 0)).toEqual([1, 1, 1, 1])
    expect(shifts(0, 4)).toEqual([-1, -1, -1, -1])
  })

  it('never reports a shift outside -1..1', () => {
    for (let hole = 0; hole <= keys.length; hole++) {
      for (let at = 0; at <= keys.length; at++) {
        for (const s of shifts(hole, at)) expect(Math.abs(s)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('keeps every key, in order', () => {
    expect(slotShifts(keys, 1, 3).map((s) => s.key)).toEqual(keys)
  })

  it('returns nothing for an empty zone', () => {
    expect(slotShifts([], 0, 0)).toEqual([])
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

```
pnpm vitest run src/home/grid/dockMath.test.ts --reporter=verbose
```

Expected: FAIL — `slotShifts` is not exported.

- [ ] **Step 3: Implement `slotShifts`**

Append to `src/home/grid/dockMath.ts`:

```ts
export interface DockShift { key: string; slots: -1 | 0 | 1 }

/**
 * How far each icon in one dock zone must move so a gap opens at `insertAt`.
 *
 * While a drag is live each zone has `keys.length + 1` slots and exactly one of
 * them is empty: the dragged icon's own former index in the zone it came from, or
 * an appended spare in the other zone. A hole at the end is the same thing as an
 * appended spare, which is why one formula serves both zones — and why the zones
 * can reflow independently, with nothing ever pushed across the divider.
 *
 * `insertAt` of null means the pointer is in the other zone: the hole stays where
 * it is and nothing moves. The result is a shift in whole slots, never more than
 * one, which the caller turns into pixels using the measured slot pitch.
 */
export function slotShifts(keys: string[], holeIndex: number, insertAt: number | null): DockShift[] {
  return keys.map((key, j) => {
    if (insertAt == null) return { key, slots: 0 as const }
    const to = j < insertAt ? j : j + 1
    const from = j < holeIndex ? j : j + 1
    return { key, slots: (to - from) as -1 | 0 | 1 }
  })
}
```

- [ ] **Step 4: Run them and confirm they pass**

```
pnpm vitest run src/home/grid/dockMath.test.ts --reporter=verbose
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```
git add src/home/grid/dockMath.ts src/home/grid/dockMath.test.ts
```
```
git commit -s -m "feat(home): compute how far each dock icon moves to open a gap

The model is the owner's and it is more economical than it looks. During a drag
each zone has one more slot than it has icons: the dragged icon's own slot in the
zone it came from, and one appended spare in the other. Since a hole at the end is
the same thing as an appended spare, both zones share a single formula, and each
can reflow without anything ever crossing the divider.

Kept as a pure function because jsdom reports every rect as zero and cannot
observe a transform, so this arithmetic is the only part of the reflow a unit test
can hold."
```

---

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

## Task 5: Share the pointer-to-cell helper

**Files:**
- Modify: `src/home/grid/pointerMath.ts`
- Modify: `src/home/grid/pointerMath.test.ts`
- Modify: `src/home/components/AddPanel.vue` (replace the local `targetCellAt`, lines 155-169)

**Interfaces:**
- Produces, consumed by Task 6:
  ```ts
  export function cellAtPointer(
    clientX: number, clientY: number,
    rect: { left: number; top: number; right: number; bottom: number },
    size: { w: number; h: number },
    grid: { cell: number; gap: number; cols: number; rows: number },
  ): { tc: number; tr: number } | null
  ```
  Returns null when the pointer is outside `rect`.

**This is a pure refactor. `AddPanel`'s behaviour must not change** — it is the flow the owner already relies on, and Task 6 depends on it staying correct.

- [ ] **Step 1: Write the failing tests**

Append to `src/home/grid/pointerMath.test.ts`:

```ts
import { cellAtPointer } from './pointerMath'

// Extracted from AddPanel so the dock can use the same hit-test. A pointer outside
// the grid must be null rather than a clamped edge cell: the caller distinguishes
// "dropped on the desktop" from "dropped somewhere else", and a clamped answer
// would place an item the user was trying not to place.
describe('cellAtPointer', () => {
  const rect = { left: 100, top: 50, right: 100 + 12 * 76, bottom: 50 + 8 * 76 }
  const grid = { cell: 60, gap: 16, cols: 12, rows: 8 }
  const one = { w: 1, h: 1 }

  it('returns null when the pointer is outside the grid', () => {
    expect(cellAtPointer(99, 60, rect, one, grid)).toBeNull()
    expect(cellAtPointer(200, 49, rect, one, grid)).toBeNull()
    expect(cellAtPointer(rect.right + 1, 60, rect, one, grid)).toBeNull()
    expect(cellAtPointer(200, rect.bottom + 1, rect, one, grid)).toBeNull()
  })

  it('maps the grid origin to cell 1,1', () => {
    expect(cellAtPointer(130, 80, rect, one, grid)).toEqual({ tc: 1, tr: 1 })
  })

  it('advances one column per step', () => {
    expect(cellAtPointer(130 + 76, 80, rect, one, grid)).toEqual({ tc: 2, tr: 1 })
    expect(cellAtPointer(130, 80 + 76, rect, one, grid)).toEqual({ tc: 1, tr: 2 })
  })

  // A wide item cannot start so far right that it would hang off the grid.
  it('clamps so the item fits inside the grid', () => {
    expect(cellAtPointer(rect.right - 1, rect.bottom - 1, rect, { w: 4, h: 2 }, grid))
      .toEqual({ tc: 9, tr: 7 })
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

```
pnpm vitest run src/home/grid/pointerMath.test.ts --reporter=verbose
```

Expected: FAIL — `cellAtPointer` is not exported.

- [ ] **Step 3: Implement it**

Append to `src/home/grid/pointerMath.ts`:

```ts
/**
 * Pointer position to grid cell, or null when the pointer is not over the grid.
 *
 * Shared by the add-panel's spawn drag and the dock's drag-onto-the-desktop, which
 * must agree: both use the answer to decide whether a release counts as a
 * placement at all, and null is what "not over the grid" means. Clamping keeps a
 * multi-cell item from starting where it would hang off the edge.
 */
export function cellAtPointer(
  clientX: number, clientY: number,
  rect: { left: number; top: number; right: number; bottom: number },
  size: { w: number; h: number },
  grid: { cell: number; gap: number; cols: number; rows: number },
): { tc: number; tr: number } | null {
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null
  const step = grid.cell + grid.gap
  return {
    tc: clamp(Math.round((clientX - rect.left - grid.cell / 2) / step) + 1, 1, grid.cols - size.w + 1),
    tr: clamp(Math.round((clientY - rect.top - grid.cell / 2) / step) + 1, 1, grid.rows - size.h + 1),
  }
}
```

`clamp` already exists at the top of that file.

- [ ] **Step 4: Run them and confirm they pass**

```
pnpm vitest run src/home/grid/pointerMath.test.ts --reporter=verbose
```

Expected: all PASS.

- [ ] **Step 5: Point AddPanel at the shared helper**

In `src/home/components/AddPanel.vue`, add `cellAtPointer` to the imports from `../grid/pointerMath` (create the import if the file has none), then replace the body of the local `targetCellAt` (lines 155-169) with a thin adapter, keeping its name and signature so the two call sites are untouched:

```ts
// Pointer → grid cell, shared with the dock via pointerMath so both agree on what
// counts as "over the grid". Returns null when it is not.
function targetCellAt(ev: PointerEvent, desc: SpawnDesc): { tc: number; tr: number } | null {
  const grid = props.gridEl
  if (!grid) return null
  return cellAtPointer(ev.clientX, ev.clientY, grid.getBoundingClientRect(), desc, {
    cell: props.cell ?? 60,
    gap: props.gap ?? 16,
    cols: props.cols ?? 12,
    rows: props.rows ?? 8,
  })
}
```

- [ ] **Step 6: Confirm AddPanel is unchanged in behaviour**

```
pnpm vitest run src/home/components/AddPanel.test.ts src/home/components/AddPanel.spawn.test.ts src/home/components/AddPanel.spawn-place.test.ts --reporter=verbose
```

Expected: PASS with no edits to those files. If any needs changing, the refactor altered behaviour — stop and report rather than adjusting the test.

- [ ] **Step 7: Build**

```
pnpm build
```

Expected: success.

- [ ] **Step 8: Commit**

```
git add src/home/grid/pointerMath.ts src/home/grid/pointerMath.test.ts src/home/components/AddPanel.vue
```
```
git commit -s -m "refactor(home): share the pointer-to-grid-cell hit test

The dock is about to need the same answer the add panel already computes, and the
two must agree: both use it to decide whether a release counts as a placement, and
null is how "not over the grid" is expressed. A second implementation would be a
second chance to disagree.

Pure move plus a thin adapter; the add panel's own tests pass untouched, which is
the point of doing it as its own commit."
```

---

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
