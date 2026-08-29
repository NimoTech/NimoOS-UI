import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from '../stores/apps'
import { useDock, __resetDockForTest } from '../composables/useDock'
import HomeDock from './HomeDock.vue'

// The dock's files icon uses in-app router.push, need to mock router singleton (vi.mock is hoisted before imports).
vi.mock('../../router', () => ({ router: { push: vi.fn() } }))
import { router } from '../../router'

// vi.hoisted, not a bare const: vi.mock is hoisted above top-level declarations, so
// a plain const would be read before initialisation.
const { spawnPlace } = vi.hoisted(() => ({ spawnPlace: vi.fn((_desc: unknown, _tc: number, _tr: number) => true) }))
// A narrow mock on purpose. Calling the real useAddPanel inside the factory would
// run at module-eval time, before any pinia is active, and it reaches for
// useLayoutStore()/useHomeUiStore() immediately. HomeDock only ever calls
// spawnPlace, so that is all the mock needs to provide.
vi.mock('../composables/useAddPanel', () => ({ useAddPanel: () => ({ spawnPlace }) }))

beforeEach(() => {
  setActivePinia(createPinia()); localStorage.clear(); __resetDockForTest()
  Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'h', set href(_v: string) {}, get href() { return '' } } })
  vi.mocked(router.push).mockClear()
})

describe('HomeDock', () => {
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
  it('renders favorite dock apps with labels', () => {
    useAppsStore()
    const w = mount(HomeDock)
    const labels = w.findAll('.dock-app').map((b) => b.text())
    expect(labels.join(' ')).toContain('文件')
    expect(w.findAll('.dock-app').length).toBeGreaterThanOrEqual(5)
  })
  it('clicking allApps toggles expanded (more zone shows settings)', async () => {
    useAppsStore()
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    expect(w.text()).toContain('设置') // settings in more zone
  })

  // ── Expanded state click opens directly (spec 2026-07-17-dock-expanded-click-open) ──
  // During capture, browser dispatches click to capture element, not icon button,
  // so "capture on press" = expanded clicks all dead. Lock down invariant "only capture after crossing drag threshold".
  it('expanded: pointerdown alone does NOT capture the pointer; crossing the drag threshold does', async () => {
    useAppsStore()
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    const nav = w.get('nav').element as HTMLElement
    const captured: number[] = []
    nav.setPointerCapture = ((id: number) => { captured.push(id) }) as never
    await w.get('.dock-app[data-app="settings"]').trigger('pointerdown', { pointerId: 7, clientX: 100, clientY: 100 })
    expect(captured.length).toBe(0) // pure click not hijacked
    const move = new Event('pointermove') as PointerEvent
    Object.assign(move, { pointerId: 7, clientX: 120, clientY: 100 }) // crosses 5px threshold
    window.dispatchEvent(move)
    expect(captured).toEqual([7]) // real drag takes over
    const up = new Event('pointerup') as PointerEvent
    Object.assign(up, { pointerId: 7, clientX: 120, clientY: 100 })
    window.dispatchEvent(up)
  })

  // Settings navigates in-app via router.push('/settings').
  // Assertion pattern same as useOpenAction.test.ts (that's unit level, this is dock click flow level).
  it('expanded: clicking an app opens it and auto-collapses the dock', async () => {
    useAppsStore()
    const hrefs: string[] = []
    Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'h', set href(v: string) { hrefs.push(v) }, get href() { return '' } } })
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    expect(w.get('.dock-toggle').attributes('aria-expanded')).toBe('true')
    await w.get('.dock-app[data-app="settings"]').trigger('click')
    expect(router.push).toHaveBeenCalledWith('/settings')
    expect(hrefs.length).toBe(0)
    expect(w.get('.dock-toggle').attributes('aria-expanded')).toBe('false')
  })

  it('collapsed: clicking a fav app opens it without toggling expanded', async () => {
    useAppsStore()
    const hrefs: string[] = []
    const opens: string[] = []
    Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'h', origin: 'http://h', set href(v: string) { hrefs.push(v) }, get href() { return '' } } })
    vi.stubGlobal('open', (u: string) => { opens.push(u); return null })
    const w = mount(HomeDock)
    await w.get('.dock-app[data-app="files"]').trigger('click')
    // Workspace apps open in a new tab (useOpenAction.openInNewTab), not in place.
    expect(opens).toEqual([`http://h${import.meta.env.BASE_URL}#/files`])
    expect(router.push).not.toHaveBeenCalled()
    expect(hrefs.length).toBe(0)
    expect(w.get('.dock-toggle').attributes('aria-expanded')).toBe('false')
  })

  // The reported symptom -- a no-drop cursor, and dropping on a browser tab
  // opening the icon image -- is the browser's own image drag, not this code.
  // PhotoImageViewer.vue:221 records that draggable="false" alone is not enough,
  // because a text selection re-enables the native drag.
  it('suppresses the browser\'s native image drag on dock icons', () => {
    useAppsStore()
    const w = mount(HomeDock)
    const imgs = w.findAll('.dock-app img')
    expect(imgs.length).toBeGreaterThan(0)
    for (const img of imgs) expect(img.attributes('draggable')).toBe('false')
  })

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

  // ── The reflow must not feed back into the geometry the drag measures ──
  // .dock is centred with a shrink-to-fit width, and a CSS transform still moves
  // the rect getBoundingClientRect() reports even though it leaves layout flow
  // untouched -- so live icon offsets shift every slot midpoint exactly like the
  // old in-flow placeholder did. jsdom does no layout, so the shift is injected by
  // hand: the rects change the moment the drag activates, exactly as the
  // browser's would. Both the preview and the drop must keep using the geometry
  // measured before any offset existed.
  const stubMids = (w: ReturnType<typeof mount>, mids: Record<string, () => number>) => {
    for (const [sel, mid] of Object.entries(mids)) {
      const el = w.get(sel).element
      Object.defineProperty(el, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: mid() - 10, right: mid() + 10, width: 20, top: 0, bottom: 20, height: 20, x: mid() - 10, y: 0, toJSON: () => ({}) }),
      })
    }
  }

  // Base mids put the pointer at 190 just left of "knowledge" (200), so the
  // insertion previews before it. The shift then moves both more-zone slots
  // right by half a pitch, which would flip a re-measuring drop to "append".
  const startShiftedDrag = async (w: ReturnType<typeof mount>, shift: { v: number }) => {
    const nav = w.get('nav').element as HTMLElement
    nav.setPointerCapture = (() => {}) as never
    stubMids(w, {
      '.dock-sep': () => 50,
      '.dock-app[data-app="storage"]': () => 100 + shift.v,
      '.dock-app[data-app="knowledge"]': () => 200 + shift.v,
    })
    await w.get('.dock-app[data-app="settings"]').trigger('pointerdown', { pointerId: 9, clientX: 180, clientY: 0 })
    const move = new Event('pointermove') as PointerEvent
    Object.assign(move, { pointerId: 9, clientX: 190, clientY: 0 }) // crosses the 5px threshold
    window.dispatchEvent(move)
    await w.vm.$nextTick()
    // Activation sizes and applies the spare-slot reservation, then re-measures
    // the resulting geometry inside nextTick -- so the pointermove that crosses
    // the threshold never resolves a preview itself, only positions the ghost.
    // A second pointermove at the same spot, once that snapshot has landed, is
    // what actually resolves toZone/beforeKey (same shape onResize already uses
    // to get a fresh preview after it re-measures).
    const move2 = new Event('pointermove') as PointerEvent
    Object.assign(move2, { pointerId: 9, clientX: 190, clientY: 0 })
    window.dispatchEvent(move2)
    await w.vm.$nextTick()
  }

  // Reads the pixel shift out of an icon's inline transform, or 0 when it carries none.
  const shiftPx = (el: Element): number => {
    const tr = (el as HTMLElement).style.transform
    const m = tr.match(/translateX\((-?[\d.]+)px\)/)
    return m ? Number(m[1]) : 0
  }

  // Regression: measureGeometry skips the dragged icon, but the icon still
  // occupies its slot (hidden with opacity, not removed from flow) -- so when
  // the dragged icon is the *middle* of its zone, the two remaining slots
  // collected are not physical neighbours. pitchFor used to take
  // `slots[1].midX - slots[0].midX` unconditionally, which read the full span
  // across the hole as if it were a single pitch, doubling it -- so a
  // one-slot shift rendered as a two-slot jump onto the neighbour.
  it('shifts a neighbour by exactly one pitch when the dragged icon is the middle of its zone', async () => {
    useAppsStore()
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    const nav = w.get('nav').element as HTMLElement
    nav.setPointerCapture = (() => {}) as never
    stubMids(w, {
      '.dock-sep': () => 50,
      '.dock-app[data-app="storage"]': () => 100,
      '.dock-app[data-app="settings"]': () => 300,
    })

    // Drag "knowledge" -- the middle of the three-item more-zone
    // (storage, knowledge, settings) -- so its holeIndex is 1.
    await w.get('.dock-app[data-app="knowledge"]').trigger('pointerdown', { pointerId: 11, clientX: 200, clientY: 0 })
    const move = new Event('pointermove') as PointerEvent
    Object.assign(move, { pointerId: 11, clientX: 90, clientY: 0 }) // crosses the 5px threshold
    window.dispatchEvent(move)
    await w.vm.$nextTick()
    // Second pointermove at the same spot resolves the preview against the
    // now-measured snapshot, same shape startShiftedDrag uses below.
    const move2 = new Event('pointermove') as PointerEvent
    Object.assign(move2, { pointerId: 11, clientX: 90, clientY: 0 })
    window.dispatchEvent(move2)
    await w.vm.$nextTick()

    // clientX=90 is nearest "storage" (100) and to its left, so the preview
    // targets insertAt=0 (before "storage") -- one slot short of the hole at
    // index 1, so "storage" slides right by exactly one pitch (100px, the
    // stubbed storage/settings gap spread over two physical slots). The old,
    // doubled pitch would have shown 200px here.
    expect(shiftPx(w.get('.dock-app[data-app="storage"]').element)).toBe(100)
    expect(shiftPx(w.get('.dock-app[data-app="settings"]').element)).toBe(0)

    const up = new Event('pointerup') as PointerEvent
    Object.assign(up, { pointerId: 11, clientX: 90, clientY: 0 })
    window.dispatchEvent(up)
  })

  it('drops where the reflow was previewed even after the reflow itself shifts the dock', async () => {
    useAppsStore()
    const dock = useDock()
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    const shift = { v: 0 }
    await startShiftedDrag(w, shift)

    // "settings" is dragged out of ['storage', 'knowledge', 'settings'], so its
    // holeIndex is 2 (the end of the more-zone list), not the middle -- it does
    // not sit between "storage" and "knowledge" before the drag. The preview
    // targets insertAt=1 (before "knowledge"), one slot short of where the hole
    // already is, so "knowledge" is the one that has to slide right by a pitch
    // (100px, the stubbed storage/knowledge gap) to open the gap in front of it;
    // "storage" is already on the correct side of the gap and does not move.
    expect(shiftPx(w.get('.dock-app[data-app="storage"]').element)).toBe(0)
    expect(shiftPx(w.get('.dock-app[data-app="knowledge"]').element)).toBe(100)

    shift.v = 50 // the layout the icon offset itself produced
    const up = new Event('pointerup') as PointerEvent
    Object.assign(up, { pointerId: 9, clientX: 190, clientY: 0 })
    window.dispatchEvent(up)
    await w.vm.$nextTick()

    // Re-measuring here would nearest-match the shifted "storage" (150) and append
    // instead: ['storage', 'knowledge', 'settings'].
    expect(dock.moreKeys.value).toEqual(['storage', 'settings', 'knowledge'])
  })

  // A resize is the one event that legitimately invalidates the snapshot, so it
  // must re-measure -- but only after dropping the preview, or it would measure
  // the icon offsets' own displacement.
  it('re-measures on resize, and does so with no offset left over from the stale snapshot', async () => {
    useAppsStore()
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    const shift = { v: 0 }
    await startShiftedDrag(w, shift)
    expect(shiftPx(w.get('.dock-app[data-app="knowledge"]').element)).toBe(100)

    shift.v = 50 // the viewport changed; slots really are somewhere else now
    window.dispatchEvent(new Event('resize'))
    await w.vm.$nextTick()
    // onResize clears drag.toZone immediately, before the re-measure lands, so
    // every icon's shift collapses to 0 no matter which zone it is in.
    for (const b of w.findAll('.dock-app[data-app]')) expect(shiftPx(b.element)).toBe(0)
    await w.vm.$nextTick()

    const move = new Event('pointermove') as PointerEvent
    // 220, not the 190 this test used to probe with. Under "insert before the
    // first slot the pointer has not passed", x=190 lands before "knowledge" on
    // BOTH the stale mids (100/200) and the fresh ones (150/250), so it can no
    // longer tell a re-measure from a missing one. 220 sits between the two
    // geometries: past everything on the stale mids, still short of "knowledge"
    // on the fresh ones.
    Object.assign(move, { pointerId: 9, clientX: 220, clientY: 0 })
    window.dispatchEvent(move)
    await w.vm.$nextTick()
    // Against the new geometry (storage 150, knowledge 250) x=220 is short of
    // "knowledge", so the icon inserts before it: holeIndex=2, insertAt=1, which
    // moves "knowledge" one 100px slot along. Had onResize kept the stale
    // pre-resize geometry, 220 would be past both slots, the insertion point
    // would be the end of the zone -- where the hole already is -- and nothing
    // would move at all.
    expect(shiftPx(w.get('.dock-app[data-app="storage"]').element)).toBe(0)
    expect(shiftPx(w.get('.dock-app[data-app="knowledge"]').element)).toBe(100)

    const up = new Event('pointerup') as PointerEvent
    Object.assign(up, { pointerId: 9, clientX: 220, clientY: 0 })
    window.dispatchEvent(up)
  })

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

  it('does not place a copy when released outside the grid', async () => {
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
})

// ── Mobile: fixed 5 slots + all-apps drawer (spec 2026-07-18-mobile-home-launcher increment) ──
describe('HomeDock mobile (≤720px)', () => {
  const stubMobile = () =>
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {},
    }))
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = '' })

  it('caps the dock at 5 slots (4 favs + all-apps) and drops the more-zone', () => {
    stubMobile(); useAppsStore()
    const w = mount(HomeDock)
    expect(w.findAll('.dock-app')).toHaveLength(5)
    expect(w.find('.dock-more').exists()).toBe(false)
    expect(w.find('.dock-sep').exists()).toBe(false)
    w.unmount()
  })

  it('tapping all-apps opens a multi-row sheet with every app; tapping one closes it', async () => {
    stubMobile(); useAppsStore()
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    const sheet = document.body.querySelector('.allapps-sheet')
    expect(sheet).not.toBeNull()
    // Full set = fav(5) + more(≥1, includes settings), more than 4+1 on dock bar
    expect(sheet!.querySelectorAll('.dock-app').length).toBeGreaterThanOrEqual(6)
    ;(sheet!.querySelector('.dock-app') as HTMLElement).click()
    await w.vm.$nextTick()
    expect(document.body.querySelector('.allapps-sheet')).toBeNull()
    w.unmount()
  })

  it('desktop keeps the horizontal expand behavior (no sheet)', async () => {
    useAppsStore() // no matchMedia stub → isMobile=false
    const w = mount(HomeDock)
    await w.get('.dock-toggle').trigger('click')
    expect(document.body.querySelector('.allapps-sheet')).toBeNull()
    expect(w.find('.dock-more').exists()).toBe(true)
    w.unmount()
  })
})
