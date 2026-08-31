// AlbumConvertToSmartDialog.vue -- the more menu's "Convert to Smart
// Album" entry opens this. Ported from Vue2 939a7d3a:PhotosAlbumDetail.vue:142-206
// (modal markup), :294-298 (convertChips), :310-345 (openConvertModal/closeConvert/
// confirmConvert). Structure follows SmartViewCreateDialog.vue's .sv-modal-* idiom
// (single column here -- this dialog has no preview rail).
//
// Mounts with a real Pinia + usePhotosSmartViews() store (same pattern as
// SmartViewCreateDialog.test.ts): convertFromAlbum is controlled with vi.spyOn rather than
// mocking the whole service layer, since the store method itself is the only collaborator
// this component talks to.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import en from '../../../i18n/en_us'

import AlbumConvertToSmartDialog from '../AlbumConvertToSmartDialog.vue'
import { usePhotosSmartViews, type SmartView } from '../../stores/smartViews'

function makeI18n(locale: 'zh_cn' | 'en_us' = 'zh_cn') {
  return createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
}

function mountConvert(
  props: { open: boolean; albumId: string | number; albumName: string; albumCount: number },
  i18n = makeI18n(),
) {
  return mount(AlbumConvertToSmartDialog, {
    props,
    global: { plugins: [i18n] },
  })
}

function fullSv(overrides: Partial<SmartView> = {}): SmartView {
  return {
    id: 'sv-new', name: 'A', description: '', conds: [], threshold: 80, live: true, includeVideos: false,
    count: 0, addedThisWeek: 0, seeds: [], median: 0, storageBytes: 0, distribution: new Array(10).fill(0),
    evaluatedAt: '', createdAt: '', ...overrides,
  }
}

let convertFromAlbum: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  setActivePinia(createPinia())
  convertFromAlbum = vi.spyOn(usePhotosSmartViews(), 'convertFromAlbum')
})
afterEach(() => {
  usePhotosSmartViews().__resetForTest()
  vi.restoreAllMocks()
})

describe('AlbumConvertToSmartDialog.vue', () => {
  it('previews inferred conditions from the description, live', async () => {
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    expect(w.find('[data-test="convert-chips"]').exists()).toBe(false)
    await w.find('[data-test="convert-desc"]').setValue('sunsets in tokyo')
    expect(w.findAll('[data-test="convert-chip"]').length).toBeGreaterThan(0)
  })

  it('blocks submit until a description is present', async () => {
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    expect(w.find('[data-test="convert-submit"]').attributes('disabled')).toBeDefined()
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    expect(w.find('[data-test="convert-submit"]').attributes('disabled')).toBeUndefined()
    // Whitespace is not a description.
    await w.find('[data-test="convert-desc"]').setValue('   ')
    expect(w.find('[data-test="convert-submit"]').attributes('disabled')).toBeDefined()
  })

  it('sends only description and threshold, letting the backend parse the conditions', async () => {
    convertFromAlbum.mockResolvedValue(fullSv())
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('  sunsets  ')
    await w.find('[data-test="convert-submit"]').trigger('click')
    expect(convertFromAlbum).toHaveBeenCalledWith('a1', { description: 'sunsets', threshold: 80 })
  })

  it('emits the new smart view and closes on success', async () => {
    convertFromAlbum.mockResolvedValue(fullSv({ id: 'sv-new' }))
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.find('[data-test="convert-submit"]').trigger('click')
    await flushPromises()
    expect(w.emitted('converted')?.[0]?.[0]).toMatchObject({ id: 'sv-new' })
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('stays open and reports the failure inline so the user can retry', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    convertFromAlbum.mockRejectedValue(new Error('boom'))
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.find('[data-test="convert-submit"]').trigger('click')
    await flushPromises()
    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.find('[data-test="convert-error"]').text()).toContain('转换失败')
    // Retry must be possible immediately -- the busy flag has to be cleared.
    expect(w.find('[data-test="convert-submit"]').attributes('disabled')).toBeUndefined()
    errSpy.mockRestore()
  })

  it('reuses the existing duplicate-name copy for a 409', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    convertFromAlbum.mockRejectedValue({ response: { status: 409 } })
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.find('[data-test="convert-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="convert-error"]').text()).toContain('已存在')
    errSpy.mockRestore()
  })

  it('refuses to close while the request is in flight', async () => {
    // Vue2 :317-320 guards closeConvert the same way.
    let release: (v: unknown) => void = () => {}
    convertFromAlbum.mockReturnValue(new Promise((r) => { release = r as (v: unknown) => void }))
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.find('[data-test="convert-submit"]').trigger('click')
    await w.find('[data-test="convert-cancel"]').trigger('click')
    expect(w.emitted('update:open')).toBeUndefined()
    release(fullSv())
    await w.vm.$nextTick()
  })

  // Escape had no test that could fail. Deleting the
  // `document.addEventListener('keydown', onDocumentKeydown)` line inside watch(open) left the
  // whole suite green -- nothing here dispatched a keydown, and no host test reaches this
  // dialog's keyboard path. Same pair PhotosSmartViewDetail.test.ts already has for its own
  // inline confirmation.
  it('dismisses on Escape while open', async () => {
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('ignores Escape while the request is in flight', async () => {
    // Escape must be refused exactly the way the Cancel button is -- it routes through close()'s
    // busy guard rather than poking the flag itself.
    let release: (v: unknown) => void = () => {}
    convertFromAlbum.mockReturnValue(new Promise((r) => { release = r as (v: unknown) => void }))
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.find('[data-test="convert-submit"]').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
    release(fullSv())
    await flushPromises()
  })

  it('stops listening for Escape once closed', async () => {
    const w = mountConvert({ open: true, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.setProps({ open: false })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('resets the draft each time it opens', async () => {
    // Persistent mount + prop-driven visibility: reset belongs in watch(open), not
    // onMounted (this area's recurring trap).
    const w = mountConvert({ open: false, albumId: 'a1', albumName: 'A', albumCount: 12 })
    await w.setProps({ open: true })
    await w.find('[data-test="convert-desc"]').setValue('sunsets')
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.find('[data-test="convert-desc"]').element as HTMLTextAreaElement).value).toBe('')
  })
})
