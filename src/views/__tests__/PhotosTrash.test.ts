// Task 9 (SP7-P3): PhotosTrash.vue — mounts Pinia + i18n + a router stub, mocks the shared
// package's trash methods (following trash.test.ts's mock shape) + thumbnailUrl. Covers the
// brief's 7 test points: empty-state gating + hero button disabled, bucketed rendering +
// thumbnails via the generator + countdown badge, tapping the select circle + bulk bar appearing,
// restore-selected skips confirmation and executes directly + success toast with Undo, clicking
// Undo calls undoRestore, empty-trash goes through a second confirmation, ESC closes the confirm
// modal.
//
// Undo is mounted alongside the real AppToast.vue (not just a spied callback) — the two share the
// same Pinia toast store instance, so "click Undo" tests the end-to-end wiring (the action
// PhotosTrash hands to toast.show is genuinely rendered by AppToast as a button, and clicking it
// genuinely invokes it), not a purely white-box assertion.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'
import en from '../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    listTrash: vi.fn().mockResolvedValue([]),
    restoreTrashBatch: vi.fn().mockResolvedValue(undefined),
    restoreAllTrash: vi.fn().mockResolvedValue(undefined),
    purgeTrash: vi.fn().mockResolvedValue(undefined),
    emptyTrash: vi.fn().mockResolvedValue(undefined),
    deleteAsset: vi.fn().mockResolvedValue(undefined),
    getConfig: vi.fn().mockResolvedValue({ watchDirs: ['/DATA/Gallery'], retentionDays: 30 }),
    updateConfig: vi.fn().mockResolvedValue(undefined),
    getTimeline: vi.fn().mockResolvedValue([]),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    // Task 9: tile-click now opens the lightbox against the bucketed flat list, so the mock
    // needs to cover everything useLightbox().openAt() and the mounted PhotoLightbox touch —
    // recordView/reconcileFav's listFavoriteIds (both fire on every openAt), hydrateDetail's
    // getAsset/getAssetOcr, and the lightbox's own image/live URL builders.
    recordView: vi.fn().mockResolvedValue(undefined),
    listFavoriteIds: vi.fn().mockResolvedValue([]),
    getAsset: vi.fn().mockRejectedValue(new Error('no hydrate in test')),
    getAssetOcr: vi.fn().mockResolvedValue({ lines: [] }),
    originalUrl: vi.fn((id: string | number) => `mock://original/${id}`),
    liveUrl: vi.fn((id: string | number) => `mock://live/${id}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosTrash from '../PhotosTrash.vue'
import AppToast from '../../components/AppToast.vue'
import { usePhotosTrash } from '../../photos/stores/trash'
import { useToast } from '../../stores/toast'
import { useLightbox } from '../../photos/lightbox/useLightbox'

const lb = useLightbox()

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
// Owner-acceptance Fix-5: a couple of the regressions this fix covers (the sort-label copy,
// the bucket subtitle's singular/plural word) render identical text in zh (photosItemSingular
// and photosItemsCount share the same zh value, Chinese has no plural form) -- an English-locale
// mount is needed to actually distinguish "1 item" from "N items" in an assertion.
const i18nEn = createI18n({ legacy: false, locale: 'en_us', messages: { en_us: en } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [{ path: '/photos/trash', name: 'photos-trash', component: PhotosTrash }],
  })
}

// Mount PhotosTrash + AppToast in the same tree, sharing the same Pinia toast store instance — see the file header comment.
async function mountView() {
  const router = makeRouter()
  router.push('/photos/trash')
  await router.isReady()
  const w = mount(
    { components: { PhotosTrash, AppToast }, template: '<div><PhotosTrash /><AppToast /></div>' },
    { global: { plugins: [i18n, router] } },
  )
  await flushPromises()
  await w.vm.$nextTick()
  return w
}

// Owner-acceptance Fix-5: English-locale variant of mountView(), see the i18nEn comment above.
async function mountViewEn() {
  const router = makeRouter()
  router.push('/photos/trash')
  await router.isReady()
  const w = mount(
    { components: { PhotosTrash, AppToast }, template: '<div><PhotosTrash /><AppToast /></div>' },
    { global: { plugins: [i18nEn, router] } },
  )
  await flushPromises()
  await w.vm.$nextTick()
  return w
}

// Pin system time so the daysLeft computed by trashAssetToPhoto is predictable (retentionDays=30):
// - 'a' was deleted on 2026-06-30, 27 days ago from today (2026-07-27) -> daysLeft=3 -> urgent bucket (1-7)
// - 'b' was deleted on 2026-07-26, 1 day ago -> daysLeft=29 -> fresh bucket (22-Infinity)
function asset(id: string, deletedAt: string, opts: Partial<{ mimeType: string; fileSize: number; originalName: string; originalPath: string }> = {}) {
  return {
    id,
    mimeType: opts.mimeType || 'image/jpeg',
    deletedAt,
    fileSize: opts.fileSize ?? 1048576,
    originalName: opts.originalName || `${id}.jpg`,
    originalPath: opts.originalPath || `/DATA/Gallery/${id}.jpg`,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-27T00:00:00Z'))
  svc.photos.listTrash.mockClear().mockResolvedValue([])
  svc.photos.restoreTrashBatch.mockClear().mockResolvedValue(undefined)
  svc.photos.restoreAllTrash.mockClear().mockResolvedValue(undefined)
  svc.photos.purgeTrash.mockClear().mockResolvedValue(undefined)
  svc.photos.emptyTrash.mockClear().mockResolvedValue(undefined)
  svc.photos.deleteAsset.mockClear().mockResolvedValue(undefined)
  svc.photos.getConfig.mockClear().mockResolvedValue({ watchDirs: ['/DATA/Gallery'], retentionDays: 30 })
  svc.photos.getTimeline.mockClear().mockResolvedValue([])
  svc.photos.recordView.mockClear().mockResolvedValue(undefined)
  svc.photos.listFavoriteIds.mockClear().mockResolvedValue([])
  svc.photos.getAsset.mockClear().mockRejectedValue(new Error('no hydrate in test'))
  svc.photos.getAssetOcr.mockClear().mockResolvedValue({ lines: [] })
  lb.__resetForTest()
})

afterEach(() => {
  vi.useRealTimers()
  lb.__resetForTest()
})

describe('PhotosTrash.vue', () => {
  // Task 8 (Plan H re-shell): mounts the shared `.app` grid shell + the real PhotosTopbar,
  // wired to the real Ask Nimo drawer entry (F-5/X-2, same as PhotosFavorites.vue).
  it('mounts the .app shell with PhotosTopbar (Trash title, search hidden) and wires Ask Nimo + AskNimoHost', async () => {
    const w = await mountView()
    expect(w.find('.photos-root .app').exists()).toBe(true)
    const topbar = w.findComponent({ name: 'PhotosTopbar' })
    expect(topbar.exists()).toBe(true)
    expect(topbar.props('showSearch')).toBe(false)
    expect(topbar.props('showAskNimo')).toBe(true)
    expect(w.findComponent({ name: 'AskNimoHost' }).exists()).toBe(true)
  })

  // Fix wave (post-final-review): the topbar's `sub` used to be left unbound entirely, which
  // falls back to PhotosTopbar's own default -- the library-wide photo/video count summary
  // (photosCountSummary), not this view's trash item count. Asserts the real trash.items.length
  // + trash.retentionDays render here instead (Vue2 PhotosTimeline.vue:231 navMap.trash shape).
  it('topbar sub renders the trash item count + retention days, not the library-wide photo/video summary', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z'), asset('b', '2026-07-26T00:00:00Z')])
    const w = await mountView()
    const topbar = w.findComponent({ name: 'PhotosTopbar' })
    expect(topbar.props('sub')).toBe('2 项 · 30 天后自动删除')
    const subEl = w.find('.topbar-sub')
    expect(subEl.exists()).toBe(true)
    expect(subEl.text()).toContain('2')
    expect(subEl.text()).toContain('30')
    // Must NOT be the library-wide "{photos} photos · {videos} videos" fallback shape.
    expect(subEl.text()).not.toMatch(/张照片.*视频|photos.*videos/)
  })

  it('loaded and empty -> renders the empty state, hero buttons disabled', async () => {
    const w = await mountView()
    const trash = usePhotosTrash()
    expect(trash.loaded).toBe(true)
    expect(w.find('[data-test="trash-empty"]').exists()).toBe(true)
    expect(w.text()).toContain('最近删除是空的')
    expect(w.text()).toContain('30') // retentionDays interpolated into the hint
    expect(w.find('[data-test="trash-restore-all"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="trash-empty-btn"]').attributes('disabled')).toBeDefined()
  })

  it('has items -> renders buckets (by daysLeft), tile img src = thumbnailUrl(id, \'small\'), countdown badge contains {days}', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z'), asset('b', '2026-07-26T00:00:00Z')])
    const w = await mountView()

    expect(w.find('[data-test="trash-empty"]').exists()).toBe(false)
    // Owner-acceptance Fix-5: bucket wrapper renamed .trash-bucket -> .arc-section (Vue2 :63
    // reuses the archive view's shared `.arc-section` class, not a page-local reinvention).
    const buckets = w.findAll('.arc-section')
    expect(buckets).toHaveLength(2) // urgent(daysLeft=3) + fresh(daysLeft=29)

    const tiles = w.findAll('.trash-tile')
    expect(tiles).toHaveLength(2)
    const imgs = w.findAll('.trash-tile img')
    expect(imgs.map((i) => i.attributes('src')).sort()).toEqual(['mock://thumb/a/small', 'mock://thumb/b/small'])

    const countdowns = w.findAll('.trash-countdown').map((c) => c.text())
    expect(countdowns.some((t) => t.includes('3'))).toBe(true)
    expect(countdowns.some((t) => t.includes('29'))).toBe(true)
  })

  // Owner-acceptance Fix-5 (screenshot review vs Vue2 PhotosTrashView.vue): Vue2 :55 renders a
  // leading `Sort` label span before the two sort buttons -- it was missing from this view
  // entirely (parity's own `.lib-sort-label` rule sat unused).
  it('the sort control has a leading "Sort" label, matching Vue2 :55', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountViewEn()
    expect(w.find('.lib-sort-label').text()).toBe('Sort')
  })

  // Owner-acceptance Fix-5 (screenshot review): the bucket header used to read "1 items ·
  // Recently deleted items" for a single freshly-deleted photo -- wrong pluralization (Vue2 :68
  // singularizes) and wrong subtitle copy (Vue2's 'fresh' bucket desc is "Auto-deletes after the
  // retention period", :136, not "Recently deleted items"). Also asserts the bucket header now
  // uses the shared `.arc-section-head` anchor (carries parity's own separator rule), not the
  // page's former bespoke `.trash-bucket-head`.
  it('bucket subtitle: singular "item" wording + Vue2\'s actual "fresh" bucket copy + shared .arc-section-head anchor', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('b', '2026-07-26T00:00:00Z')]) // daysLeft=29 -> 'fresh' bucket, 1 item
    const w = await mountViewEn()

    expect(w.find('.arc-section-head').exists()).toBe(true)
    const sub = w.find('.arc-section-sub').text()
    expect(sub).toBe('1 item · Auto-deletes after the retention period')
  })

  it('bucket subtitle: plural "items" wording for more than one item in the same bucket', async () => {
    svc.photos.listTrash.mockResolvedValue([
      asset('b', '2026-07-26T00:00:00Z'),
      asset('c', '2026-07-25T00:00:00Z'),
    ]) // both land in the 'fresh' bucket (daysLeft 29/28)
    const w = await mountViewEn()

    const sub = w.find('.arc-section-sub').text()
    expect(sub).toBe('2 items · Auto-deletes after the retention period')
  })

  // Owner-acceptance Fix-5 (REAL BUG, delete-chain diagnosis follow-up): the hero used to show
  // "0.0 MB can be freed" for an item whose real fileSize is 0/absent. Root cause: this isn't a
  // field-name or bytes-vs-MB mismatch in trashAssetToPhoto (verified correct, see that file's
  // own tests) -- it's that Vue2 PhotosTrashView.vue:180 sums `Number(p.sizeMb) || 4.2` per item
  // (a literal placeholder fallback), not `|| 0`. This pins the aggregate at the Vue2-matching
  // non-zero value instead of the honest-but-diverging 0.0.
  it('hero total MB: falls back to Vue2\'s 4.2-per-item placeholder when the real size is zero (not 0.0)', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z', { fileSize: 0 })])
    const w = await mountViewEn()
    const sub = w.find('.lib-hero-sub').text()
    expect(sub).toContain('4.2 MB')
    expect(sub).not.toContain('0.0 MB')
  })

  it('clicking the select circle -> the item enters selected, bulk bar appears', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()

    expect(w.find('.trash-bulk-bar').exists()).toBe(false)
    await w.find('.trash-tile-check').trigger('click')
    await w.vm.$nextTick()

    const bar = w.find('.trash-bulk-bar')
    expect(bar.exists()).toBe(true)
    expect(bar.text()).toContain('1')
    expect(w.find('.trash-tile').attributes('data-selected')).toBe('true')
  })

  it('clicking "Restore selected" -> skips confirmation, calls trash.restore(ids) directly + a restored toast with Undo; clicking Undo -> trash.undoRestore(ids)', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()
    const trash = usePhotosTrash()
    const restoreSpy = vi.spyOn(trash, 'restore')
    const undoSpy = vi.spyOn(trash, 'undoRestore')

    await w.find('.trash-tile-check').trigger('click')
    await w.vm.$nextTick()

    await w.find('[data-test="trash-bulk-restore"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    // Vue2's restore-selected has no second confirmation, it executes directly — this view should likewise not pop the confirm modal.
    expect(w.find('.trash-modal-scrim').exists()).toBe(false)
    expect(restoreSpy).toHaveBeenCalledWith(['a'])
    expect(w.find('.trash-bulk-bar').exists()).toBe(false) // selection has been cleared

    const undoBtn = w.get('.toast-action')
    expect(undoBtn.text()).toBe('撤销')
    await undoBtn.trigger('click')
    await flushPromises()

    expect(undoSpy).toHaveBeenCalledWith(['a'])
  })

  it('clicking "Empty trash" -> opens the confirm modal -> confirm -> trash.empty() is called', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()
    const trash = usePhotosTrash()
    const emptySpy = vi.spyOn(trash, 'empty')

    await w.find('[data-test="trash-empty-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.trash-modal-scrim').exists()).toBe(true)

    await w.find('.trash-btn-cta').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(emptySpy).toHaveBeenCalledTimes(1)
    expect(w.find('.trash-modal-scrim').exists()).toBe(false)
  })

  it('ESC closes the confirm modal', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()

    await w.find('[data-test="trash-empty-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.trash-modal-scrim').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.find('.trash-modal-scrim').exists()).toBe(false)
  })

  it('permanently deleting the selection -> goes through the confirm modal (danger) -> confirm -> trash.purge(ids)', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()
    const trash = usePhotosTrash()
    const purgeSpy = vi.spyOn(trash, 'purge')

    await w.find('.trash-tile-check').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="trash-bulk-delete"]').trigger('click')
    await w.vm.$nextTick()

    const modal = w.get('.trash-modal')
    expect(modal.attributes('data-danger')).toBe('true')
    await w.find('.trash-btn-cta').trigger('click')
    await flushPromises()

    expect(purgeSpy).toHaveBeenCalledWith(['a'])
  })

  // Owner-acceptance Fix-3 (delete-chain diagnosis): the toast used to unconditionally quote
  // the click-time selection size, regardless of how many purgeTrash() calls actually
  // succeeded -- trash.purge() now reports the real count and this view must show a distinct
  // "N of M failed" toast for the partial case, not the exact-count success wording.
  it('permanently deleting a selection with a partial backend failure shows the honest "N of M failed" toast, not the full-count success one', async () => {
    svc.photos.listTrash.mockResolvedValue([
      asset('a', '2026-06-30T00:00:00Z'),
      asset('b', '2026-06-30T00:00:00Z'),
    ])
    svc.photos.purgeTrash
      .mockImplementationOnce(() => Promise.resolve()) // 'a' succeeds
      .mockImplementationOnce(() => Promise.reject(new Error('boom'))) // 'b' fails
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const w = await mountView()

    const checks = w.findAll('.trash-tile-check')
    await checks[0]!.trigger('click')
    await checks[1]!.trigger('click')
    await w.vm.$nextTick()

    await w.find('[data-test="trash-bulk-delete"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('.trash-btn-cta').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    const toastEl = w.find('.toast')
    expect(toastEl.exists()).toBe(true)
    expect(toastEl.text()).toBe('已永久删除 1 项，1 项失败')
    spy.mockRestore()
  })

  it('permanently deleting a selection where every backend purge fails shows an error toast, not a fabricated success one', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    svc.photos.purgeTrash.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const w = await mountView()

    await w.find('.trash-tile-check').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="trash-bulk-delete"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('.trash-btn-cta').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    const toastEl = w.find('.toast')
    expect(toastEl.exists()).toBe(true)
    expect(toastEl.text()).toBe('删除失败')
    spy.mockRestore()
  })

  // Owner-acceptance Fix-3: the lightbox's "delete" is remapped to permanent purge for
  // already-trashed assets (onLightboxDelete) -- it used to show the success toast
  // unconditionally, ignoring whether the backend purge actually succeeded.
  it('lightbox permanent-delete shows an error toast (not the purged-success toast) when the backend purge actually fails', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    svc.photos.purgeTrash.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const w = await mountView()

    await w.find('.trash-tile').trigger('click') // nothing selected yet -> opens the lightbox
    await w.vm.$nextTick()
    expect(lb.open.value).toBe(true)

    await w.find('.lb-delete').trigger('click')
    await w.vm.$nextTick()
    await w.find('.trash-btn-cta-danger').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    const toastEl = w.find('.toast')
    expect(toastEl.exists()).toBe(true)
    expect(toastEl.text()).toBe('删除失败')
    spy.mockRestore()
  })

  it('canceling selection (bulk bar "Cancel") -> selected is cleared, bulk bar disappears', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()

    await w.find('.trash-tile-check').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.trash-bulk-bar').exists()).toBe(true)

    await w.find('[data-test="trash-bulk-cancel"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('.trash-bulk-bar').exists()).toBe(false)
  })

  // Task 9 (F-6): flips Task 8's bare-click-selects placeholder to Vue2 PhotosTrashView.vue's real
  // onTileClick semantics (:211-216) -- with nothing selected, a plain tile click opens the
  // lightbox against the bucketed flat list; once anything is selected, every further click
  // (including on a different tile) toggles selection instead.
  it('clicking a tile with nothing selected opens the lightbox against the bucketed flat list; clicking with a selection active toggles selection instead', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z'), asset('b', '2026-07-26T00:00:00Z')])
    const w = await mountView()

    await w.find('.trash-tile').trigger('click')
    expect(lb.open.value).toBe(true)

    lb.close()
    await w.find('.trash-tile-check').trigger('click') // manually check one first
    expect(w.find('.trash-tile[data-selected="true"]').exists()).toBe(true)
    await w.findAll('.trash-tile')[1]!.trigger('click') // with selection active, clicking a second tile = toggle selection, not open lightbox
    expect(lb.open.value).toBe(false)
  })

  // Task 9 (coordinator review fix): Vue2 PhotosTrashView.vue onTileClick(:211-212, template :72
  // passes $event) guards `e.shiftKey || selected.size > 0` -- shift-clicking an unselected tile
  // starts multi-select from zero, it must never open the lightbox.
  it('shift-clicking a tile with nothing selected toggles selection instead of opening the lightbox', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()

    await w.find('.trash-tile').trigger('click', { shiftKey: true })
    expect(w.find('.trash-tile[data-selected="true"]').exists()).toBe(true)
    expect(lb.open.value).toBe(false)
  })

  // Task 12 (SP15-P3): while pages remain, the freeable-size figure is only a sum over the
  // loaded subset — the empty-trash confirmation must not present it as the whole truth.
  const fullPage = () => Array.from({ length: 500 }, (_, i) => asset(`p${i}`, '2026-06-30T00:00:00Z'))

  it('uses the size-less empty copy while pages remain', async () => {
    // Task 12 fix round 2: emptyTrash() now pages in the rest before opening the confirm —
    // this test's mock must let that attempt get stuck (not simply keep returning full pages
    // forever, which would loop until trashExhausted flips true and never show the partial
    // copy at all). See "empty-trash when a page gets stuck…" below for the fuller scenario.
    svc.photos.listTrash.mockResolvedValueOnce(fullPage()) // initial mount fetch
    svc.photos.listTrash.mockRejectedValueOnce(new Error('network')) // stuck load-more page
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const w = await mountView()
    const trash = usePhotosTrash()
    expect(trash.trashExhausted).toBe(false)

    await w.find('[data-test="trash-empty-btn"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    const body = w.find('.trash-modal-body').text()
    expect(body).toBe('这将释放 NAS 上的空间，原始文件将无法恢复。')
    expect(body).not.toMatch(/MB/)
    spy.mockRestore()
  })

  it('uses the exact copy with the freed size once everything is loaded', async () => {
    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w = await mountView()
    const trash = usePhotosTrash()
    expect(trash.trashExhausted).toBe(true)

    await w.find('[data-test="trash-empty-btn"]').trigger('click')
    await w.vm.$nextTick()

    const body = w.find('.trash-modal-body').text()
    expect(body).toContain('MB')
    expect(body).not.toBe('这将释放 NAS 上的空间，原始文件将无法恢复。')
  })

  it('shows the load-more button only while pages remain', async () => {
    svc.photos.listTrash.mockResolvedValue(fullPage())
    const w = await mountView()
    expect(w.find('[data-test="trash-load-more"]').exists()).toBe(true)
    expect(w.find('[data-test="trash-loaded-hint"]').exists()).toBe(true)

    svc.photos.listTrash.mockResolvedValue([asset('a', '2026-06-30T00:00:00Z')])
    const w2 = await mountView()
    expect(w2.find('[data-test="trash-load-more"]').exists()).toBe(false)
    expect(w2.find('[data-test="trash-loaded-hint"]').exists()).toBe(false)
  })

  // Task 12 fix round 2 (Important 1 & 2, coordinator review): both bulk hero actions
  // (restore all / empty trash) act on the ENTIRE trash server-side, not just the loaded
  // page — the confirm dialogs and undo must page in the rest first rather than understate
  // what will actually happen.
  describe('bulk hero actions page in the rest before acting (Task 12 fix round 2)', () => {
    it('empty-trash with pages remaining pages in the rest first and then quotes the full count and size', async () => {
      const rest = [asset('extra1', '2026-06-30T00:00:00Z'), asset('extra2', '2026-06-30T00:00:00Z')]
      svc.photos.listTrash.mockResolvedValueOnce(fullPage()) // initial mount fetch: page one, 500 rows
      svc.photos.listTrash.mockResolvedValueOnce(rest) // load-more triggered by the click below
      const w = await mountView()
      const trash = usePhotosTrash()
      expect(trash.trashExhausted).toBe(false)

      await w.find('[data-test="trash-empty-btn"]').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(trash.trashExhausted).toBe(true)
      expect(trash.items).toHaveLength(502)
      expect(svc.photos.listTrash).toHaveBeenLastCalledWith(500, 500)

      const title = w.find('.trash-modal-title').text()
      expect(title).toContain('502')
      const body = w.find('.trash-modal-body').text()
      expect(body).toContain('MB')
      expect(body).not.toBe('这将释放 NAS 上的空间，原始文件将无法恢复。')
    })

    it('empty-trash when a page gets stuck shows the count-less/size-less copy and still lets the action proceed', async () => {
      svc.photos.listTrash.mockResolvedValueOnce(fullPage()) // initial mount fetch
      svc.photos.listTrash.mockRejectedValueOnce(new Error('network')) // stuck load-more page
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const w = await mountView()
      const trash = usePhotosTrash()
      expect(trash.trashExhausted).toBe(false)

      await w.find('[data-test="trash-empty-btn"]').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      // Still stuck: the failed page must not have been silently treated as "done".
      expect(trash.trashExhausted).toBe(false)
      expect(w.find('.trash-modal-scrim').exists()).toBe(true) // action still proceeds

      const title = w.find('.trash-modal-title').text()
      expect(title).toBe('清空最近删除') // bare action-label title, no invented/stale count
      const body = w.find('.trash-modal-body').text()
      expect(body).toBe('这将释放 NAS 上的空间，原始文件将无法恢复。')

      // Confirming still works even though the true count/size is unknown.
      svc.photos.listTrash.mockResolvedValueOnce([]) // fetchTrash() re-fetch after empty()
      await w.find('.trash-btn-cta').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(svc.photos.emptyTrash).toHaveBeenCalledTimes(1)
      const toastEl = w.find('.toast')
      expect(toastEl.exists()).toBe(true)
      expect(toastEl.text()).toBe('最近删除已清空')
      spy.mockRestore()
    })

    it('restore-all with pages remaining restores and offers an Undo whose id set covers everything that was restored', async () => {
      const rest = [asset('extra1', '2026-06-30T00:00:00Z')]
      svc.photos.listTrash.mockResolvedValueOnce(fullPage()) // initial mount fetch
      svc.photos.listTrash.mockResolvedValueOnce(rest) // load-more triggered by the click below
      const w = await mountView()
      const trash = usePhotosTrash()
      const restoreAllSpy = vi.spyOn(trash, 'restoreAll')
      const undoSpy = vi.spyOn(trash, 'undoRestore')

      await w.find('[data-test="trash-restore-all"]').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(trash.trashExhausted).toBe(true)
      expect(trash.items).toHaveLength(501)
      const title = w.find('.trash-modal-title').text()
      expect(title).toContain('501')

      svc.photos.listTrash.mockResolvedValueOnce([]) // fetchTrash() re-fetch after restoreAll()
      await w.find('.trash-btn-cta').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(restoreAllSpy).toHaveBeenCalledTimes(1)
      const undoBtn = w.get('.toast-action')
      expect(undoBtn.text()).toBe('撤销')

      await undoBtn.trigger('click')
      await flushPromises()
      expect(undoSpy).toHaveBeenCalledTimes(1)
      // The id set handed to undo must cover every restored item, not just the first page.
      expect(undoSpy.mock.calls[0][0]).toHaveLength(501)
    })

    it('restore-all when a page gets stuck offers no Undo action', async () => {
      svc.photos.listTrash.mockResolvedValueOnce(fullPage()) // initial mount fetch
      svc.photos.listTrash.mockRejectedValueOnce(new Error('network')) // stuck load-more page
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const w = await mountView()
      const trash = usePhotosTrash()

      await w.find('[data-test="trash-restore-all"]').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(trash.trashExhausted).toBe(false)
      const title = w.find('.trash-modal-title').text()
      expect(title).toBe('恢复全部') // bare action-label title, no invented/stale count

      svc.photos.listTrash.mockResolvedValueOnce([]) // fetchTrash() re-fetch after restoreAll()
      await w.find('.trash-btn-cta').trigger('click')
      await flushPromises()
      await w.vm.$nextTick()

      expect(svc.photos.restoreAllTrash).toHaveBeenCalledTimes(1)
      // No Undo action offered — the loaded id set here would only be a partial subset of
      // what restoreAllTrash() actually restored server-side, so offering Undo would let the
      // user silently revert part of it while the rest stays restored with no path back.
      expect(w.find('.toast-action').exists()).toBe(false)
      spy.mockRestore()
    })
  })
})
