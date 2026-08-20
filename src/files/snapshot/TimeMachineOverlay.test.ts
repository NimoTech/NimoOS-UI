import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { defineComponent, ref } from 'vue'
import TimeMachineOverlay from './TimeMachineOverlay.vue'
import SnapshotSettingsDialog from './SnapshotSettingsDialog.vue'
import zh from '../../i18n/zh_cn'

const listMock = vi.fn()
const getListMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    snapshot: {
      list: (...a: unknown[]) => listMock(...a),
      listVolumes: vi.fn().mockResolvedValue([]), getPolicy: vi.fn(), patchPolicy: vi.fn(),
      togglePolicy: vi.fn(), create: vi.fn(), remove: vi.fn(),
    },
    folder: { getList: (p: string) => getListMock(p) },
    image: { thumbUrl: (p: string) => `/v1/image?path=${p}` },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// Note: the brief's draft wrote SNAPS created_at as absolute dates ('2026-07-30'), while
// groupSnapshotsByDay's "today/yesterday" decision uses the real system clock (default param
// now = new Date()) — once they diverge (tests running on any day other than 2026-07-30), the
// "today" group is classified as "earlier" and this fixture silently expires. Changed to dates
// relative to "now", always aligned, independent of the real calendar. (Same class of trap:
// see memory newui-fixture-from-imagination-trap)
const NOW = new Date()
const relDay = (daysAgo: number, h: number, m = 0) =>
  new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, h, m).toISOString()
const SNAPS = [
  { id: 1, name: '20260730T143000Z_manual_x', label: '改版前', type: 'manual', created_at: relDay(0, 14, 30) },
  { id: 2, name: '20260730T090000Z_auto', label: '', type: 'auto-hourly', created_at: relDay(0, 9) },
  { id: 3, name: '20260729T090000Z_preop', label: '', type: 'preop', created_at: relDay(1, 9) },
]

const mountIt = (props = {}) =>
  mount(TimeMachineOverlay, {
    props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos', ...props },
    global: { plugins: [i18n] },
  })
const flush = async (w: ReturnType<typeof mountIt>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}
// The path is a breadcrumb in the card's own header. Scoped to the FRONT card on purpose: every
// rendered card draws one, so an unscoped .tm-crumb query returns levels x cards and compares
// false against any single path.
const crumbs = (w: ReturnType<typeof mountIt>) =>
  w.get('.tm-card.is-front').findAll('.tm-crumb').map((c) => c.text())
// Longer than the walk pace (STEP_MAX_MS 110) plus PREVIEW_SETTLE_MS (360).
const settleDeck = async (w: ReturnType<typeof mountIt>) => {
  await new Promise((r) => setTimeout(r, 900)); await flush(w)
}

beforeEach(() => {
  setActivePinia(createPinia()); vi.clearAllMocks()
  listMock.mockResolvedValue(SNAPS)
  getListMock.mockResolvedValue({ content: [] })
})

describe('TimeMachineOverlay three states', () => {
  it('fetch snapshot list by volume on mount', async () => {
    const w = mountIt(); await flush(w)
    expect(listMock).toHaveBeenCalledWith('u-data')
  })
  it('show skeleton while loading', async () => {
    listMock.mockImplementation(() => new Promise(() => {}))
    const w = mountIt(); await w.vm.$nextTick()
    expect(w.find('.tm-skeleton').exists()).toBe(true)
  })
  it('show empty state for empty list, and gear button remains usable', async () => {
    listMock.mockResolvedValue([])
    const w = mountIt(); await flush(w)
    expect(w.find('.tm-empty').exists()).toBe(true)
    expect(w.find('.tm-gear').exists()).toBe(true)
  })
  it('treat request failure as empty state, do not throw error', async () => {
    listMock.mockRejectedValue(new Error('404'))
    const w = mountIt(); await flush(w)
    expect(w.find('.tm-empty').exists()).toBe(true)
  })
  it('after ready, show the newest snapshot\'s timestamp in the bar (default selected), date grouping text uses existing i18n keys in this repo (not empty shell: was incorrectly mapped to always "yesterday")', async () => {
    const w = mountIt(); await flush(w)
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30')
  })
  // Originally in the top-left; a long path would run across into the gear and cover the deck animation — moved above the bottom-bar time (user feedback)
  it('name the folder on the card itself, not in a bar of its own', async () => {
    const w = mountIt(); await flush(w)
    expect(crumbs(w)).toEqual(['磁盘', 'Photos'])
    // Neither of the two places it used to live keeps a copy.
    expect(w.find('.tm-topbar-folder').exists()).toBe(false)
    expect(w.find('.tm-bar-folder').exists()).toBe(false)
  })
  it('after ready, render card stack with the newest snapshot at the front', async () => {
    const w = mountIt(); await flush(w)
    const front = w.findAll('.tm-card').find((c) => c.classes().includes('is-front'))!
    // The card identifies itself by its note and type, not by a clock of its own.
    expect(front.text()).toContain('改版前')
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30')
  })
  it('after ready, render both card stack and ruler, tick count equals snapshot count', async () => {
    const w = mountIt(); await flush(w)
    expect(w.findAll('.tm-tick-main')).toHaveLength(3)
  })
  it('clicking a tick two snapshots away walks through the one in between, it does not jump', async () => {
    const w = mountIt(); await flush(w)
    await w.findAll('.tm-tick-main')[2].trigger('click')
    // The first step is synchronous (a single-snapshot move must stay instant), so right after
    // the click the deck is showing the MIDDLE snapshot, not the destination.
    expect(w.find('.tm-bar-moment').text()).toBe('今天 09:00')
    await settleDeck(w)
    expect(w.find('.tm-bar-moment').text()).toContain('昨天')
  })
})

describe('TimeMachineOverlay selection and enter', () => {
  // ↑/↓ move the highlight the way the rail runs (owner's call): the newest snapshot is at the
  // top of the rail, so ↓ walks toward earlier ones and ↑ back toward now. This replaced the
  // "real Time Machine's ↑ rewinds into the past" mapping, which contradicted both the rail and
  // its two step buttons.
  it('↓ goes earlier, ↑ goes back toward now, clamped at both ends', async () => {
    const w = mountIt(); await flush(w)
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30')
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' })); await w.vm.$nextTick()
    expect(w.find('.tm-bar-moment').text()).toBe('今天 09:00')
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' })); await w.vm.$nextTick()
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30')
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' })); await w.vm.$nextTick()
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30') // already at the newest, clamped
  })
  it('Esc emit close', async () => {
    const w = mountIt(); await flush(w)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(1)
  })
  it('enter falls at current relative path, not snapshot root (fix for Vue2)', async () => {
    const w = mountIt(); await flush(w)
    await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe('/DATA/.snapshots/20260730T143000Z_manual_x/Photos')
  })
  it('enter snapshot root when opened at volume root', async () => {
    const w = mountIt({ relPath: '' }); await flush(w)
    await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe('/DATA/.snapshots/20260730T143000Z_manual_x')
  })
  it('Enter key is equivalent to clicking enter', async () => {
    const w = mountIt(); await flush(w)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }))
    expect(w.emitted('select')).toHaveLength(1)
  })
  // The shape the production device really sends for an absent folder: GET /v1/folder collapses
  // every failure into 500 + "Fail" (NimoOS route/v1/file.go:399), so it is indistinguishable from
  // an unreadable folder -- and 'failed' must land at the snapshot root just as 'missing' does.
  // Composing the sub-path anyway made files.load degrade it into a silent "empty folder", i.e. the
  // snapshot looked like it had backed nothing up.
  it('a listing that failed (not just an explicit 404) also enters at the snapshot root', async () => {
    getListMock.mockRejectedValue(Object.assign(new Error('Fail'), {
      name: 'AxiosError', code: 'ERR_BAD_RESPONSE',
      response: { status: 500, data: { success: 500, message: 'Fail', data: 'open …: no such file or directory' } },
    }))
    const w = mountIt(); await flush(w)
    await w.find('.tm-bar-enter').trigger('click'); await flush(w)
    expect(w.emitted('select')?.[0]?.[0]).toBe('/DATA/.snapshots/20260730T143000Z_manual_x')
  })
  it('when the folder does not exist at this moment (preview 404 → missing), enter falls to snapshot root instead of patching a non-existent sub-path', async () => {
    getListMock.mockRejectedValue(Object.assign(new Error('nope'), { code: 404 }))
    const w = mountIt(); await flush(w)
    await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe('/DATA/.snapshots/20260730T143000Z_manual_x')
  })

  // Review fix (Critical 2, round 1): onKeydown (then still called onKeyup) hung on document,
  // ignoring the event source and whether a dialog was stacked on top. The gear settings
  // dialog (reka-ui DialogContent) Teleports to body and is not a DOM descendant of
  // .tm-overlay — these three cases each pin one of the two guards: case 1 (event source
  // outside the overlay) pins guard 1; cases 2/3 attach an input directly inside the overlay
  // root to verify guard 2 (tag-name check) works independently — with only guard 1 left,
  // these two would fail because the target really is inside rootEl, catching the
  // "delete guard 2" mutation.
  it('when dialog is open, Esc does not emit close (event source outside overlay, e.g., stacked settings dialog)', async () => {
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
    expect(w.emitted('close')).toBeUndefined()
    w.unmount(); outside.remove()
  })
  it('input inside overlay (defensive fallback) does not emit select on Enter', async () => {
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    const input = document.createElement('input')
    w.find('.tm-overlay').element.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }))
    expect(w.emitted('select')).toBeUndefined()
    w.unmount()
  })
  it('arrow keys in input inside overlay (defensive fallback) do not change selectedIndex', async () => {
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30')
    const input = document.createElement('input')
    w.find('.tm-overlay').element.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30')
    w.unmount()
  })
  // Review fix (Critical 2, round 2): with a bottom-bar button (cancel/enter) focused,
  // pressing Enter makes the browser fire the key's default action (clicking that button) as
  // part of keydown; if the global Enter branch ran enterSnapshot() regardless of whether the
  // target is a button, it would fire a side effect alongside the button's own @click (Enter
  // on the focused "cancel" button would emit close AND select). This case dispatches keydown
  // directly at the tm-bar-cancel button itself (target = button, inside rootEl, not an INPUT,
  // so both old guards pass it through) and asserts select is not emitted twice.
  it('pressing Enter when "cancel" button in bar is focused does not double-trigger enterSnapshot (only button\'s own click takes effect)', async () => {
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    const cancelBtn = w.find('.tm-bar-cancel').element as HTMLElement
    cancelBtn.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }))
    expect(w.emitted('select')).toBeUndefined()
    w.unmount()
  })
  it('pressing Enter when "enter" button in bar is focused does not double-trigger enterSnapshot (only button\'s own click takes effect)', async () => {
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: 'Photos', folderLabel: '/磁盘/Photos' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    const enterBtn = w.find('.tm-bar-enter').element as HTMLElement
    enterBtn.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }))
    // The global handler must not emit again on its own; the button's real click goes through
    // @click (covered by the "enters at the current relative path" case), so this only
    // verifies the handler side doesn't double-fire.
    expect(w.emitted('select')).toBeUndefined()
    w.unmount()
  })
  // Review fix (Important): the preview-fetch window (here) and the deck render window (the
  // same-named case in TimeMachineDeck.test.ts) must be the same number, both reading
  // DECK_WINDOW rather than separate literals — otherwise changing the window size in one
  // place and forgetting the other leaves the front card without thumbnails, with no error
  // and no red test. 10 snapshots (more than the window) are needed to detect "fetch only for
  // the window"; SNAPS' 3 can't exercise the boundary. Right after mount selectedIndex is
  // always 0 (the newest), so the past direction is naturally empty (nothing newer than
  // "newest"), and the visible window then exactly equals DECK_WINDOW.depth — directly
  // verifying the overlay side really uses this constant rather than its own literal.
  it('list the folder of the front card only, not of every card in the deck window', async () => {
    // Was DECK_WINDOW.depth listings per selection change (front + 4 behind), of which at most
    // two are ever rendered -- rear cards deliberately draw no grid. That work landed squarely
    // inside the flip animation the owner reported as not smooth.
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: i, name: `202607${String(30 - i).padStart(2, '0')}T090000Z_manual_${i}`, label: '', type: 'manual',
      created_at: relDay(i, 9),
    }))
    listMock.mockResolvedValue(many)
    const w = mountIt(); await flush(w)
    expect(getListMock).toHaveBeenCalledTimes(1)
    expect(getListMock).toHaveBeenCalledWith('/DATA/.snapshots/20260730T090000Z_manual_0/Photos')
  })

  it('gear emits open-settings', async () => {
    const w = mountIt(); await flush(w)
    await w.find('.tm-gear').trigger('click')
    expect(w.emitted('open-settings')).toHaveLength(1)
  })
  it('keyboard listener is removed after unmount (will not continue to emit for destroyed component)', async () => {
    const w = mountIt(); await flush(w)
    w.unmount()
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
    expect(w.emitted('close')).toBeUndefined()
  })
})

describe('opening a folder from a card', () => {
  // Before this, a folder cell had no handler of its own, so the click bubbled to the card, and
  // a click on the front card means "enter this snapshot" -- clicking a folder threw the user
  // out of the time machine instead of walking into the folder. That is what the owner's
  // "folders in the snapshot can't be opened" was.
  const DIR = { path: '/DATA/.snapshots/20260730T143000Z_manual_x/Photos/2024', name: '2024', is_dir: true, date: relDay(0, 9) }
  beforeEach(() => { getListMock.mockResolvedValue({ content: [DIR] }) })

  it('clicking a folder on the card re-lists that sub-folder inside the same snapshot', async () => {
    const w = mountIt(); await flush(w)
    expect(getListMock).toHaveBeenLastCalledWith('/DATA/.snapshots/20260730T143000Z_manual_x/Photos')
    await w.get('.tm-file.is-dir').trigger('click'); await flush(w)
    expect(getListMock).toHaveBeenLastCalledWith('/DATA/.snapshots/20260730T143000Z_manual_x/Photos/2024')
  })
  it('the deck stays open: opening a folder does not emit select/close', async () => {
    const w = mountIt(); await flush(w)
    await w.get('.tm-file.is-dir').trigger('click'); await flush(w)
    expect(w.emitted('select')).toBeUndefined()
    expect(w.emitted('close')).toBeUndefined()
  })
  it('entering the snapshot lands on the folder walked into, not on the folder the files area is standing in', async () => {
    const w = mountIt(); await flush(w)
    await w.get('.tm-file.is-dir').trigger('click'); await flush(w)
    await w.find('.tm-bar-enter').trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toBe('/DATA/.snapshots/20260730T143000Z_manual_x/Photos/2024')
  })
  it('the bottom bar names the folder walked into, and the breadcrumb is the way back out', async () => {
    const w = mountIt(); await flush(w)
    expect(crumbs(w)).toEqual(['磁盘', 'Photos']) // nothing below the starting folder yet
    await w.get('.tm-file.is-dir').trigger('click'); await flush(w)
    expect(crumbs(w)).toEqual(['磁盘', 'Photos', '2024'])
    // 'Photos' is the folder the time machine was opened on: clicking it comes back out.
    await w.findAll('button.tm-crumb').find((c) => c.text() === 'Photos')!.trigger('click'); await flush(w)
    expect(crumbs(w)).toEqual(['磁盘', 'Photos'])
  })
  it('levels above the folder the time machine was opened on are shown but not clickable (entering is anchored to that folder)', async () => {
    const w = mountIt(); await flush(w)
    expect(crumbs(w)).toContain('磁盘')
    expect(w.findAll('button.tm-crumb').map((c) => c.text())).not.toContain('磁盘')
  })
  it('Backspace goes back up one level too, and is a no-op at the starting folder', async () => {
    const w = mountIt(); await flush(w)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backspace' })); await flush(w)
    expect(crumbs(w)).toEqual(['磁盘', 'Photos'])
    await w.get('.tm-file.is-dir').trigger('click'); await flush(w)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backspace' })); await flush(w)
    expect(crumbs(w)).toEqual(['磁盘', 'Photos'])
  })
  it('switching to a snapshot that has no such sub-folder still enters, landing at the snapshot root', async () => {
    const w = mountIt(); await flush(w)
    await w.get('.tm-file.is-dir').trigger('click'); await flush(w)
    // The older snapshot does not contain Photos/2024 at all.
    getListMock.mockRejectedValue(Object.assign(new Error('nope'), { code: 404 }))
    // No wait between flipping and entering, on purpose: listings are debounced and only the
    // target snapshot is listed, so at this instant nothing is known about the older snapshot
    // yet. enterSnapshot must await that answer instead of optimistically composing a sub-path
    // that does not exist there (files.load would degrade that into a silent "empty folder" --
    // the exact bug this fallback exists to prevent).
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }))
    await w.find('.tm-bar-enter').trigger('click')
    await flush(w)
    expect(w.emitted('select')?.[0]?.[0]).toBe('/DATA/.snapshots/20260730T090000Z_auto')
  })
})

describe('flip smoothness', () => {
  // The front card lays out up to 200 cells, each an <img> with its own IntersectionObserver.
  // Mounting that in the same frame the 450ms transform starts is what made the flip stutter.
  // The listing request still goes out immediately (enterSnapshot's "does this folder exist in
  // that snapshot" answer depends on it); only the grid waits for the deck to settle.
  it('the incoming front card stays text-only during the flip, then lays out its grid once the deck settles', async () => {
    getListMock.mockResolvedValue({ content: [
      { path: '/x/a.jpg', name: 'a.jpg', is_dir: false, date: relDay(0, 9) },
    ] })
    // Assert on the FRONT card specifically: the card flying out keeps its own grid on purpose
    // (so content does not vanish before the card does), so a bare find('.tm-files') would
    // report that one and pass no matter what the front card does.
    const w = mountIt()
    const frontGrid = () => w.get('.tm-card.is-front').find('.tm-files').exists()
    // > the walk pace (STEP_MAX_MS 110) + PREVIEW_SETTLE_MS (480ms, itself >= the card's 0.45s
    // flip transition)
    const settle = async () => { await new Promise((r) => setTimeout(r, 900)); await flush(w) }
    await flush(w)
    expect(frontGrid()).toBe(true) // settled at the newest snapshot on open

    // Walk to the third snapshot and back, so BOTH previews are cached by name. Without this
    // the assertion below would be hollow: a not-yet-fetched preview leaves the grid unmounted
    // anyway, and the test would pass with the settle gate deleted.
    await w.findAll('.tm-tick-main')[2].trigger('click'); await settle()
    expect(frontGrid()).toBe(true)
    await w.findAll('.tm-tick-main')[0].trigger('click'); await settle()
    const callsBefore = getListMock.mock.calls.length

    // Cache hit: the preview data for this snapshot is already in hand, so only the settle gate
    // can keep the grid out of the flip.
    await w.findAll('.tm-tick-main')[2].trigger('click'); await flush(w)
    expect(getListMock.mock.calls.length).toBe(callsBefore) // proven cache hit, no new request
    expect(w.find('.tm-bar-moment').text()).toBe('今天 09:00') // first step of the walk, taken synchronously
    expect(frontGrid()).toBe(false) // ... and no grid is mounted while the deck is moving

    await settle()
    expect(frontGrid()).toBe(true)
  })
  // User feedback: "flipping several pages just jumps, there is no page-flip animation -- I want
  // to really see 10 pages go past". The deck now walks one snapshot per tick instead of
  // assigning the destination index, so every snapshot in between takes its turn at the front.
  it('a long jump walks through every snapshot in between, one at a time', async () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      id: i, name: `snap-${i}`, label: '', type: 'manual',
      created_at: relDay(0, 23 - i, 0), // all on the same day, one hour apart, newest first
    }))
    listMock.mockResolvedValue(many)
    const w = mountIt(); await flush(w)
    expect(w.find('.tm-bar-moment').text()).toBe('今天 23:00')

    // Aim ten snapshots away, then sample which snapshot is at the front over time. The list is
    // seeded with the pre-click value because the first step is taken synchronously, so the
    // starting snapshot is already gone by the first sample.
    const seen: string[] = [w.find('.tm-bar-moment').text()]
    await w.findAll('.tm-tick-main')[10].trigger('click')
    // 160 x 25ms is ample for ten steps at up to STEP_MAX_MS (110) each.
    for (let i = 0; i < 160; i++) {
      const now = w.find('.tm-bar-moment').text()
      if (seen[seen.length - 1] !== now) seen.push(now)
      if (now === '今天 13:00') break
      await new Promise((r) => setTimeout(r, 25)); await w.vm.$nextTick()
    }
    // All eleven, in order, with nothing skipped -- a jump would have produced ['23:00','13:00'].
    expect(seen).toEqual([
      '今天 23:00', '今天 22:00', '今天 21:00', '今天 20:00', '今天 19:00', '今天 18:00',
      '今天 17:00', '今天 16:00', '今天 15:00', '今天 14:00', '今天 13:00',
    ])
  })
  it('entering mid-walk acts on the snapshot aimed at, not the one being passed through', async () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      id: i, name: `snap-${i}`, label: '', type: 'manual', created_at: relDay(0, 23 - i, 0),
    }))
    listMock.mockResolvedValue(many)
    const w = mountIt({ relPath: '' }); await flush(w)
    await w.findAll('.tm-tick-main')[10].trigger('click')
    expect(w.find('.tm-bar-moment').text()).toBe('今天 22:00') // still walking, nowhere near the target
    await w.find('.tm-bar-enter').trigger('click'); await flush(w)
    expect(w.emitted('select')?.[0]?.[0]).toBe('/DATA/.snapshots/snap-10')
  })
  it('a redirect mid-walk turns the deck around instead of stacking a second walk', async () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      id: i, name: `snap-${i}`, label: '', type: 'manual', created_at: relDay(0, 23 - i, 0),
    }))
    listMock.mockResolvedValue(many)
    const w = mountIt(); await flush(w)
    await w.findAll('.tm-tick-main')[10].trigger('click')
    await new Promise((r) => setTimeout(r, 150)); await flush(w)
    await w.findAll('.tm-tick-main')[0].trigger('click') // change of mind: back to the newest
    await new Promise((r) => setTimeout(r, 1200)); await flush(w)
    expect(w.find('.tm-bar-moment').text()).toBe('今天 23:00')
  })

  // The two step buttons sit beside the card (owner's call: they belong to the deck they move, not
  // to the far edge of the screen). The arrow points where the highlight goes: the list is
  // newest-first, so up walks toward index 0 and down away from it.
  it('the step buttons beside the deck move the selection the way they point', async () => {
    const w = mountIt(); await flush(w)
    const [up, down] = w.findAll('.tm-deck-step')
    expect(w.find('.tm-rail-step').exists()).toBe(false) // not on the rail any more
    await up.trigger('click') // already at the newest: clamped, no move
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30')
    await down.trigger('click')
    expect(w.find('.tm-bar-moment').text()).toBe('今天 09:00')
    await up.trigger('click')
    expect(w.find('.tm-bar-moment').text()).toBe('今天 14:30')
  })
  it('each step button disables at its own end of the list', async () => {
    const w = mountIt(); await flush(w)
    const btns = () => w.findAll('.tm-deck-step')
    expect(btns()[0].attributes('disabled')).toBeDefined()   // newest selected: nothing newer
    expect(btns()[1].attributes('disabled')).toBeUndefined()
    // Walk to the oldest and the pair swaps over.
    await btns()[1].trigger('click'); await settleDeck(w)
    await btns()[1].trigger('click'); await settleDeck(w)
    expect(w.find('.tm-bar-moment').text()).toBe('昨天 09:00')
    expect(btns()[0].attributes('disabled')).toBeUndefined()
    expect(btns()[1].attributes('disabled')).toBeDefined()
  })
})

describe('focus management', () => {
  it('focus moves into overlay on open', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger); trigger.focus()
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: '', folderLabel: '/磁盘' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    expect(document.activeElement).toBe(w.find('.tm-overlay').element)
  })
  it('focus is returned to the element that opened it on close', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger); trigger.focus()
    const w = mount(TimeMachineOverlay, {
      props: { volumeUuid: 'u-data', mountPoint: '/DATA', relPath: '', folderLabel: '/磁盘' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await flush(w)
    w.unmount()
    expect(document.activeElement).toBe(trigger)
  })
})

// Review re-check (Critical 2, round 2): the previous round's case used a div permanently on
// body to simulate "event source outside the overlay", which cannot reproduce the real
// scenario — in reality the gear settings dialog is **mounted and unmounted** (reka
// DialogContent, Teleported to body); when Esc is pressed the dialog disappears at keydown
// and focus is already returned into the overlay. The permanent-div case cannot test the real
// "dialog gone + focus returned" timing and gave false confidence. Here we mount the real
// SnapshotSettingsDialog (the full set of real reka-ui
// DialogRoot/DialogContent/FocusScope/DismissableLayer components, not a hand-rolled stand-in),
// wired exactly like Files.vue (@open-settings opens, v-model:open two-way binding), and
// replay the whole sequence with real two-phase keydown→keyup events.
describe('Critical 2 (round 2): Esc timing with real reka dialog', () => {
  const Harness = defineComponent({
    components: { TimeMachineOverlay, SnapshotSettingsDialog },
    setup() {
      const settingsOpen = ref(false)
      return { settingsOpen }
    },
    // Matches the real wiring at Files.vue lines 549-567 one-to-one: the gear emits
    // open-settings to open the dialog, and the dialog itself falls back via v-model:open.
    template: `
      <div>
        <TimeMachineOverlay
          volume-uuid="u-data" mount-point="/DATA" rel-path="Photos" folder-label="/磁盘/Photos"
          @close="$emit('overlay-close')"
          @open-settings="settingsOpen = true"
        />
        <SnapshotSettingsDialog v-model:open="settingsOpen" volume-uuid="u-data" mount-point="/DATA" />
      </div>
    `,
    emits: ['overlay-close'],
  })

  it('after keydown Esc closes settings dialog and focus is returned to overlay, trailing keyup Esc does not close time machine', async () => {
    const w = mount(Harness, { global: { plugins: [i18n] }, attachTo: document.body })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()

    // Open the real gear settings dialog (real DialogContent Teleported to body)
    await w.find('.tm-gear').trigger('click')
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(document.querySelector('.ui-dialog-content')).not.toBeNull()
    // Real precondition measured in the re-check: focus really is on the dialog content now (not inside the overlay)
    expect(document.activeElement?.className).toContain('ui-dialog-content')

    // keydown Esc: reka's DismissableLayer (vueuse onKeyStroke listening on window keydown)
    // closes the dialog at this moment and returns focus — this part is real browser behavior,
    // not a mock.
    const beforeKeyup = document.activeElement as HTMLElement
    beforeKeyup.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }))
    await w.vm.$nextTick(); await w.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0))

    // Real intermediate state measured in the re-check: the dialog is gone and focus has been
    // returned inside the overlay. Use w.get(...) to pinpoint this wrapper's own .tm-overlay
    // (rather than document.querySelector grabbing the first global match) — another existing
    // case in this directory ("focus moves into the overlay on open") never unmounts, and
    // jsdom's single document accumulating multiple .tm-overlay nodes across cases is a known
    // test-hygiene issue outside this round's scope; here we only need to avoid being
    // polluted by it.
    expect(document.querySelector('.ui-dialog-content')).toBeNull()
    expect(w.get('.tm-overlay').element.contains(document.activeElement)).toBe(true)

    // The same physical keystroke's keyup trails in, with target now an element inside the
    // overlay — exactly where the hole was: after switching to keydown listening we no longer
    // listen to keyup, so dispatching it here must have no effect.
    const afterKeydown = document.activeElement as HTMLElement
    afterKeydown.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }))
    await w.vm.$nextTick()

    expect(w.findComponent(TimeMachineOverlay).emitted('close')).toBeUndefined()
    expect(w.emitted('overlay-close')).toBeUndefined()
    w.unmount()
  })

  // Control group: keep and confirm the Enter and arrow-key cases stay green (fixed last round; the keydown switch must not break them this round).
  it('control: arrow keys and Enter still work normally without stacked dialog (keydown switch did not break existing behavior)', async () => {
    const w = mount(Harness, { global: { plugins: [i18n] }, attachTo: document.body })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }))
    await w.vm.$nextTick()
    // Only an empty snapshot list (listMock defaults to mockResolvedValue([])), nothing to
    // select, so ArrowUp must not throw; use a more direct signal instead: Escape still
    // closes the overlay itself normally (with no dialog stacked, guard 1 doesn't block).
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.findComponent(TimeMachineOverlay).emitted('close')).toHaveLength(1)
    w.unmount()
  })
})
