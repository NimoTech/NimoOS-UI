// SP15-P2a-T3: the manual asset interactions on the smart view detail page.
// Target is Vue 2 899af59b:src/views/Photos/PhotosSmartViewDetail.vue.
// Note the device reality this cannot cover: producing an excluded row requires
// removing an *automatically matched* asset, and every smart view on the test
// device is semantic, paused and never evaluated — see the design doc's §2.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string, size: string) => `mock://${id}/${size}`),
    listSmartViews: vi.fn(async () => []),
    getSmartView: vi.fn(async () => ({})),
    getSmartViewAssets: vi.fn(async () => []),
    getSmartViewActivity: vi.fn(async () => []),
    getSmartViewExcluded: vi.fn(async () => []),
    pinSmartViewAssets: vi.fn(async () => ({ added: 0 })),
    removeSmartViewAssets: vi.fn(async () => ({ unpinned: 0, excluded: 0 })),
    restoreSmartViewAssets: vi.fn(async () => ({ restored: 0 })),
    listAlbums: vi.fn(async () => []),
    // Not used by anything asserted here, but mounting this page brings up the sidebar's
    // settings store and opening the picker brings up the library timeline. Without these two
    // the mount still works — both stores swallow the failure — but every test prints a
    // caught TypeError, and a noisy baseline is how a real error goes unnoticed.
    getConfig: vi.fn(async () => ({})),
    getTimeline: vi.fn(async () => []),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

const lbMock = vi.hoisted(() => ({ openAt: vi.fn() }))
vi.mock('../photos/lightbox/useLightbox', () => ({ useLightbox: () => lbMock }))

import PhotosSmartViewDetail from './PhotosSmartViewDetail.vue'
import { usePhotosSmartViews } from '../photos/stores/smartViews'
import { useToast } from '../stores/toast'
// The toast assertions below compare against the real locale entry rather than
// `expect.any(String)`: a toast that fires with the wrong text, or with the wrong count in
// it, is exactly the failure these tests exist to catch (final review, coverage holes).
import zh from '../i18n/zh_cn'

const SV = {
  id: 'sv1', name: 'Hiking', description: '', conds: ['a'], threshold: 80,
  live: true, includeVideos: false, count: 3, addedThisWeek: 0, seeds: [],
  median: 0, storageBytes: 0, distribution: new Array(10).fill(0), evaluatedAt: '', createdAt: '',
}

async function mountPage(path = '/photos/smart-views/sv1') {
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
      { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: PhotosSmartViewDetail },
    ],
  })
  await router.push(path)
  await router.isReady()
  const w = mount(PhotosSmartViewDetail, { global: { plugins: [router] } })
  await new Promise((r) => setTimeout(r, 0))
  return { w, router }
}

// The store's list is seeded directly (mounting only fetches it when `listLoaded` is false),
// but the assets deliberately are not: the page loads them on mount, and `loadDetail` /
// `loadExcluded` both blank their target before awaiting, so anything written into the store
// ahead of mount is gone by the time the first assertion runs. Driving them through the
// service mocks instead is also the more honest fixture — it is the path the device takes.
function seed(opts: { matched?: unknown[]; excluded?: unknown[] } = {}) {
  const s = usePhotosSmartViews()
  s.smartViews = [{ ...SV }]
  s.listLoaded = true
  svc.photos.getSmartViewAssets.mockResolvedValue(
    (opts.matched ?? [{ id: 'a1', pinned: true }, { id: 'a2', pinned: false }]) as never,
  )
  svc.photos.getSmartViewExcluded.mockResolvedValue((opts.excluded ?? []) as never)
  return s
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  // clearAllMocks wipes recorded calls but keeps any mockResolvedValue a previous test set,
  // so the data mocks are put back to their defaults explicitly.
  svc.photos.getSmartViewAssets.mockReset().mockResolvedValue([] as never)
  svc.photos.getSmartViewActivity.mockReset().mockResolvedValue([] as never)
  svc.photos.getSmartViewExcluded.mockReset().mockResolvedValue([] as never)
  svc.photos.getSmartView.mockReset().mockResolvedValue({} as never)
  lbMock.openAt.mockReset()
})

describe('pin badge', () => {
  it('marks only the pinned tiles', async () => {
    seed()
    const { w } = await mountPage()
    expect(w.findAll('[data-test="sv-pin-tag"]')).toHaveLength(1)
  })
})

describe('add photos', () => {
  it('opens the picker, pins what it confirms, and reports the count it was told', async () => {
    const s = seed()
    const pin = vi.spyOn(s, 'pinAssets').mockResolvedValue(2)
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountPage()

    await w.find('[data-test="sv-add-photos"]').trigger('click')
    w.findComponent({ name: 'PhotosLibraryPicker' }).vm.$emit('confirm', ['x', 'y'])
    await new Promise((r) => setTimeout(r, 0))

    expect(pin).toHaveBeenCalledWith('sv1', ['x', 'y'])
    // Not just "a toast fired": the success toast, exactly once, carrying the count the
    // store reported (2 — not the 3 ids picked, and not a hardcoded number).
    expect(show).toHaveBeenCalledTimes(1)
    expect(show).toHaveBeenCalledWith(zh.photosSvPinnedNToView.replace('{n}', '2'))
    expect(w.findComponent({ name: 'PhotosLibraryPicker' }).props('open')).toBe(false)
  })

  // Finding 5: `pinAssets` answers null when it drops the call because another write is in
  // flight. Nothing was sent, so nothing may be claimed — and above all the picker must keep
  // the user's selection instead of closing on a write that never happened.
  it('reports nothing and keeps the picker open when the store drops the call as busy', async () => {
    const s = seed()
    vi.spyOn(s, 'pinAssets').mockResolvedValue(null)
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountPage()

    await w.find('[data-test="sv-add-photos"]').trigger('click')
    w.findComponent({ name: 'PhotosLibraryPicker' }).vm.$emit('confirm', ['x'])
    await new Promise((r) => setTimeout(r, 0))

    expect(show).not.toHaveBeenCalled()
    expect(w.findComponent({ name: 'PhotosLibraryPicker' }).props('open')).toBe(true)
  })

  it('reports a failure and keeps the picker open so the user can retry', async () => {
    const s = seed()
    vi.spyOn(s, 'pinAssets').mockRejectedValue(new Error('nope'))
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountPage()
    await w.find('[data-test="sv-add-photos"]').trigger('click')
    w.findComponent({ name: 'PhotosLibraryPicker' }).vm.$emit('confirm', ['x'])
    await new Promise((r) => setTimeout(r, 0))
    expect(show).toHaveBeenCalledWith(expect.any(String), expect.anything(), 'danger')
    expect(w.findComponent({ name: 'PhotosLibraryPicker' }).props('open')).toBe(true)
  })

  it('hands the picker the ids already in the view, String()-normalised', async () => {
    seed({ matched: [{ id: 5 }] })
    const { w } = await mountPage()
    await w.find('[data-test="sv-add-photos"]').trigger('click')
    const ids = w.findComponent({ name: 'PhotosLibraryPicker' }).props('existingIds') as Set<string>
    expect([...ids]).toContain('5')
  })

  // Final review, finding 3: Vue2 :288 hands this picker a *static* `$t('Add selected')`,
  // while the album pages hand it their counting `Add ({count})` label. This screen shipped
  // with the album pages' counting label, deferring to PhotosLibraryPicker's deviation (b) —
  // but that deviation only justifies leaving the existing album consumers alone; it says
  // nothing about a new one. The prop accepts either shape, so this asserts the one Vue2
  // actually passes here.
  it('passes the static "Add selected" submit label Vue2 gives this picker, not the counting one', async () => {
    seed()
    const { w } = await mountPage()
    await w.find('[data-test="sv-add-photos"]').trigger('click')
    const label = w.findComponent({ name: 'PhotosLibraryPicker' }).props('submitLabel')
    expect(label).toBe(zh.photosMoAddSelected)
    // Belt and braces against a regression back to the album label, which is a function.
    expect(typeof label).toBe('string')
  })
})

describe('selection and removal', () => {
  it('suppresses the lightbox while selecting, and shows the count', async () => {
    seed()
    const { w } = await mountPage()
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    expect(w.find('[data-test="sv-select-bar"]').text()).toContain('1')
    expect(lbMock.openAt).not.toHaveBeenCalled()
  })

  it('still opens the lightbox when not selecting', async () => {
    seed()
    const { w } = await mountPage()
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    expect(lbMock.openAt).toHaveBeenCalled()
  })

  it('removes the selection, then leaves selection mode', async () => {
    const s = seed()
    const remove = vi.spyOn(s, 'removeAssets').mockResolvedValue({ unpinned: 1, excluded: 0 })
    const { w } = await mountPage()
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    await w.find('[data-test="sv-remove-selected"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(remove).toHaveBeenCalledWith('sv1', ['a1'])
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(false)
  })

  // Removal is tiered on the backend: a pinned row is deleted (`unpinned`), an automatically
  // matched one is flagged excluded (`excluded`). Reporting their *sum* is the defining
  // behaviour of this action, and it had no assertion anywhere — dropping either term from
  // the expression left the whole suite green. Both tiers are non-zero and distinct here, so
  // reporting only one of them, or the wrong one, fails.
  it('confirms with both removal tiers added together', async () => {
    const s = seed()
    vi.spyOn(s, 'removeAssets').mockResolvedValue({ unpinned: 2, excluded: 3 })
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountPage()
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    await w.find('[data-test="sv-remove-selected"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(show).toHaveBeenCalledWith(zh.photosSvRemovedNFromView.replace('{n}', '5'))
  })

  // Finding 5, the removal side: a call the store dropped as busy must not be confirmed, and
  // must leave the selection alone so the user can press the button again.
  it('reports nothing and keeps the selection when the store drops the removal as busy', async () => {
    const s = seed()
    vi.spyOn(s, 'removeAssets').mockResolvedValue(null)
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountPage()
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    await w.find('[data-test="sv-remove-selected"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(show).not.toHaveBeenCalled()
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(true)
  })

  it('keeps the selection on failure so the user can retry', async () => {
    const s = seed()
    vi.spyOn(s, 'removeAssets').mockRejectedValue(new Error('nope'))
    const { w } = await mountPage()
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    await w.find('[data-test="sv-remove-selected"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(true)
  })

  it('leaving selection mode clears what was selected', async () => {
    seed()
    const { w } = await mountPage()
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(false)
  })

  // A selection surviving an :id change would send view A's asset ids to view B's remove
  // endpoint, under a bar counting photos that are no longer on screen.
  //
  // Final review, finding 1: checking only that the bar disappears does NOT test the reset.
  // The bar's `v-if` is `selecting && selectedIds.length`, so clearing `selecting` alone
  // hides it — deleting `selectedIds.value = []` from the route watcher left this green.
  // The failure it hides: sv1 selection survives into sv2, `toggleSelecting` only clears on
  // *exit* so pressing Select on sv2 brings the bar back holding sv1's id, and Remove then
  // posts view A's asset to view B. Re-entering selection mode after the navigation is what
  // makes the stale ids observable, so that is what is asserted.
  it('drops the selection and closes the picker when the route id changes', async () => {
    const s = seed()
    s.smartViews = [{ ...SV }, { ...SV, id: 'sv2', name: 'Beach' }]
    const { w, router } = await mountPage()
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    await w.find('[data-test="sv-add-photos"]').trigger('click')
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(true)

    await router.push('/photos/smart-views/sv2')
    await new Promise((r) => setTimeout(r, 0))

    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(false)
    expect(w.findComponent({ name: 'PhotosLibraryPicker' }).props('open')).toBe(false)

    // The real assertion: enter selection mode on sv2 without picking anything. If the ids
    // were not cleared, the bar reappears immediately carrying sv1's selection.
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(false)
  })
})

describe('excluded section', () => {
  it('stays hidden when nothing is excluded', async () => {
    seed()
    const { w } = await mountPage()
    expect(w.find('[data-test="sv-excluded-head"]').exists()).toBe(false)
  })

  it('appears with a count once there are excluded assets, collapsed by default', async () => {
    seed({ excluded: [{ id: 'e1' }, { id: 'e2' }] })
    const { w } = await mountPage()
    expect(w.find('[data-test="sv-excluded-head"]').text()).toContain('2')
    expect(w.find('[data-test="sv-excluded-grid"]').exists()).toBe(false)
  })

  it('expands on click and restores a photo when one is clicked', async () => {
    const s = seed({ excluded: [{ id: 'e1' }] })
    const restore = vi.spyOn(s, 'restoreAssets').mockResolvedValue(1)
    const { w } = await mountPage()
    await w.find('[data-test="sv-excluded-head"]').trigger('click')
    await w.find('[data-test="sv-excluded-tile"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(restore).toHaveBeenCalledWith('sv1', ['e1'])
  })

  // Final review, finding 4 (file-header deviation 6): every other tile on this page toggles
  // selection while selecting; an excluded one used to restore instead — an unconfirmed
  // server write with no toast and no undo, in response to a click meant to tick a checkbox.
  // Vue2 :167 has the same hole; this branch fixes and registers Vue2 defects rather than
  // copying them. Excluded assets are not removal candidates either, so the tile is simply
  // inert: no write, and no selection.
  it('an excluded tile does nothing while in selection mode', async () => {
    const s = seed({ excluded: [{ id: 'e1' }] })
    const restore = vi.spyOn(s, 'restoreAssets').mockResolvedValue(1)
    const { w } = await mountPage()
    await w.find('[data-test="sv-excluded-head"]').trigger('click')
    await w.find('[data-test="sv-select-toggle"]').trigger('click')

    await w.find('[data-test="sv-excluded-tile"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))

    expect(restore).not.toHaveBeenCalled()
    // Nor does it become selectable — the select bar needs a selection to exist at all.
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(false)
  })

  it('reports a failed restore', async () => {
    const s = seed({ excluded: [{ id: 'e1' }] })
    vi.spyOn(s, 'restoreAssets').mockRejectedValue(new Error('nope'))
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountPage()
    await w.find('[data-test="sv-excluded-head"]').trigger('click')
    await w.find('[data-test="sv-excluded-tile"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(show).toHaveBeenCalledWith(expect.any(String), expect.anything(), 'danger')
  })

  // The list is fetched by the page rather than left to whoever navigated here — the store
  // owns it, but nothing else on this route asks for it.
  it('loads the excluded list on mount and again when the route id changes', async () => {
    const s = seed()
    s.smartViews = [{ ...SV }, { ...SV, id: 'sv2', name: 'Beach' }]
    const load = vi.spyOn(s, 'loadExcluded')
    const { router } = await mountPage()
    expect(load).toHaveBeenCalledWith('sv1')
    await router.push('/photos/smart-views/sv2')
    await new Promise((r) => setTimeout(r, 0))
    expect(load).toHaveBeenCalledWith('sv2')
  })
})
