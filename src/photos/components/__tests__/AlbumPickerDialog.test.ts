// Task 5 (SP7-P4 albums): AlbumPickerDialog.vue — "add to album" picker.
// Mount Pinia + i18n (use real zh_cn entries, not hand-written mini locale — this component's core
// behavior is interpolating message itself). Mock shared package @nimotech/nimoos-service, verify end-to-end
// via real usePhotosAlbums()/useToast() stores: click album item → assert underlying service.photos.batchAddToAlbum
// is actually called (not mock out store itself), this way we can test actual wiring between T2 store and
// this component, not pure white-box assertions.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    listAlbums: vi.fn(),
    createAlbum: vi.fn(),
    getAlbum: vi.fn(),
    batchAddToAlbum: vi.fn(),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import AlbumPickerDialog from '../AlbumPickerDialog.vue'
import { useToast } from '../../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountDialog(props: { open: boolean; assetIds: Array<string | number> }) {
  return mount(AlbumPickerDialog, { props, global: { plugins: [i18n] } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  svc.photos.listAlbums.mockReset().mockResolvedValue([
    { id: 1, name: 'Trip', assetCount: 3 },
    { id: 2, name: 'Family', assetCount: 10 },
  ])
  svc.photos.createAlbum.mockReset()
  svc.photos.getAlbum.mockReset().mockResolvedValue({ assets: [] })
  svc.photos.batchAddToAlbum.mockReset().mockResolvedValue(undefined)
  svc.photos.thumbnailUrl.mockClear()
})

describe('AlbumPickerDialog.vue', () => {
  it('open false→true → fetch album list, render album items (title+count) and "+ new album" row', async () => {
    const w = mountDialog({ open: false, assetIds: ['a1'] })
    expect(svc.photos.listAlbums).not.toHaveBeenCalled()
    await w.setProps({ open: true })
    await flushPromises()
    expect(svc.photos.listAlbums).toHaveBeenCalledTimes(1)
    const items = w.findAll('[data-test="album-picker-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Trip')
    expect(items[0]!.text()).toContain('3')
    expect(items[1]!.text()).toContain('Family')
    expect(items[1]!.text()).toContain('10')
    expect(w.find('[data-test="album-picker-new"]').exists()).toBe(true)
    expect(w.text()).toContain('新建相册')
  })

  it('Click an album item → addAssetsToAlbum(its id, assetIds) is called → emit added + update:open(false) + toast', async () => {
    const w = mountDialog({ open: true, assetIds: ['a1', 'a2'] })
    await flushPromises()
    const toast = useToast()
    const items = w.findAll('[data-test="album-picker-item"]')
    await items[1]!.trigger('click') // Family, id=2
    await flushPromises()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith(2, ['a1', 'a2'])
    expect(w.emitted('added')).toEqual([[2, 2]])
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(toast.toasts.length).toBe(1)
    expect(toast.toasts[0]!.text).toContain('Family')
    expect(toast.toasts[0]!.text).toContain('2')
  })

  it('store throws (addAssetsToAlbum fails) → panel still open, toast is failure message', async () => {
    svc.photos.batchAddToAlbum.mockRejectedValueOnce(new Error('boom'))
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    const toast = useToast()
    const items = w.findAll('[data-test="album-picker-item"]')
    await items[0]!.trigger('click')
    await flushPromises()

    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.emitted('added')).toBeUndefined()
    expect(toast.toasts.length).toBe(1)
    expect(toast.toasts[0]!.text).toBe(zh.photosAlbumAddFailed)
  })

  it('Click "+ new album" → input box appears; type name+enter → createAlbum then addAssetsToAlbum called in sequence', async () => {
    svc.photos.createAlbum.mockResolvedValueOnce({ id: 99, name: 'New Trip' })
    // createAlbum internally calls fetchAlbums once (store behavior), lets new album appear in list
    svc.photos.listAlbums
      .mockResolvedValueOnce([{ id: 1, name: 'Trip', assetCount: 3 }])
      .mockResolvedValueOnce([
        { id: 1, name: 'Trip', assetCount: 3 },
        { id: 99, name: 'New Trip', assetCount: 0 },
      ])
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()

    await w.get('[data-test="album-picker-new"]').trigger('click')
    const input = w.get('[data-test="album-picker-new-input"]')
    await input.setValue('New Trip')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    const callOrder: string[] = []
    // Assert call order: createAlbum before batchAddToAlbum
    expect(svc.photos.createAlbum).toHaveBeenCalledWith('New Trip')
    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith(99, ['a1'])
    const createOrder = svc.photos.createAlbum.mock.invocationCallOrder[0]!
    const addOrder = svc.photos.batchAddToAlbum.mock.invocationCallOrder[0]!
    expect(createOrder).toBeLessThan(addOrder)
    void callOrder
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('createAlbum throws 409 → show duplicate name hint, addAssetsToAlbum not called, input content remains', async () => {
    const err = Object.assign(new Error('conflict'), { response: { status: 409 } })
    svc.photos.createAlbum.mockRejectedValueOnce(err)
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    const toast = useToast()

    await w.get('[data-test="album-picker-new"]').trigger('click')
    const input = w.get('[data-test="album-picker-new-input"]')
    await input.setValue('Trip')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(svc.photos.batchAddToAlbum).not.toHaveBeenCalled()
    expect(toast.toasts[0]!.text).toBe(zh.photosAlbumNameExists)
    // Panel still open, input box remains with content preserved
    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.get<HTMLInputElement>('[data-test="album-picker-new-input"]').element.value).toBe('Trip')
  })

  it('createAlbum throws non-409 error → show creation failed message', async () => {
    svc.photos.createAlbum.mockRejectedValueOnce(new Error('server error'))
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    const toast = useToast()

    await w.get('[data-test="album-picker-new"]').trigger('click')
    const input = w.get('[data-test="album-picker-new-input"]')
    await input.setValue('Trip')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(toast.toasts[0]!.text).toBe(zh.photosAlbumCreateFailed)
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('createAlbum throws error with no response field but message contains 409 → still treat as duplicate (brief\'s message fallback)', async () => {
    svc.photos.createAlbum.mockRejectedValueOnce(new Error('request failed with status code 409'))
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    const toast = useToast()

    await w.get('[data-test="album-picker-new"]').trigger('click')
    const input = w.get('[data-test="album-picker-new-input"]')
    await input.setValue('Trip')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(toast.toasts[0]!.text).toBe(zh.photosAlbumNameExists)
    expect(toast.toasts[0]!.text).not.toBe(zh.photosAlbumCreateFailed)
  })

  it('Album list is empty → render photosAddToAlbumEmpty, "+ new" row still present', async () => {
    svc.photos.listAlbums.mockResolvedValue([])
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()

    expect(w.findAll('[data-test="album-picker-item"]')).toHaveLength(0)
    expect(w.text()).toContain(zh.photosAddToAlbumEmpty)
    expect(w.find('[data-test="album-picker-new"]').exists()).toBe(true)
  })

  it('assetIds is empty → album items disabled, clicking doesn\'t trigger store; "+ new album" entry also disabled (avoid creating album with no feedback)', async () => {
    const w = mountDialog({ open: true, assetIds: [] })
    await flushPromises()

    const items = w.findAll('[data-test="album-picker-item"]')
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect((item.element as HTMLButtonElement).disabled).toBe(true)
    }
    await items[0]!.trigger('click')
    await flushPromises()
    expect(svc.photos.batchAddToAlbum).not.toHaveBeenCalled()

    const newBtn = w.get<HTMLButtonElement>('[data-test="album-picker-new"]')
    expect(newBtn.element.disabled).toBe(true)
    await newBtn.trigger('click')
    await flushPromises()
    expect(svc.photos.createAlbum).not.toHaveBeenCalled()
    expect(w.find('[data-test="album-picker-new-input"]').exists()).toBe(false)
  })

  // In real usage, focus most likely doesn't land in panel DOM subtree (user opens panel from trigger
  // button, doesn't click inside panel and press Esc directly), so dispatching keydown on document is
  // the real scenario — never on overlay/input element .trigger('keydown'), that only tests the false
  // premise that "element happens to hold focus".
  it('Esc hierarchy (document-level dispatch, doesn\'t rely on real focus): when input is open, first close input row, Esc again to close panel', async () => {
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    await w.get('[data-test="album-picker-new"]').trigger('click')
    expect(w.find('[data-test="album-picker-new-input"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.find('[data-test="album-picker-new-input"]').exists()).toBe(false)
    expect(w.emitted('update:open')).toBeUndefined()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('After panel closes (open===false), Esc has no effect (listener removed)', async () => {
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    await w.setProps({ open: false })
    await flushPromises()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('When cover is missing, don\'t call thumbnailUrl (render gradient placeholder not construct URL)', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 5, name: 'NoCover', assetCount: 0 }])
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    expect(svc.photos.thumbnailUrl).not.toHaveBeenCalled()
    expect(w.find('[data-test="album-picker-cover-empty"]').exists()).toBe(true)
  })

  it('When cover exists, generate image URL via service.photos.thumbnailUrl (don\'t construct manually)', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 6, name: 'Cover', assetCount: 1, coverAssetId: 'asset-77' }])
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('asset-77', 'small')
    const img = w.get('[data-test="album-picker-item"] img')
    expect(img.attributes('src')).toBe('mock://thumb/asset-77/small')
  })

  it('Click overlay (not panel itself) closes entire panel', async () => {
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    await w.get('[data-test="album-picker-overlay"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  // Final review required 2: submitCreate bound to @keydown.enter, `creating` is only a display flag for
  // "whether input row is open", not an in-flight guard — long-press/repeated Enter sends createAlbum multiple
  // times. This is the third occurrence of this type of bug this cycle (T7 PhotosAlbums.vue `creating`,
  // T10 PhotosFavorites.vue `saveAlbumSaving` both already patched with guards), inline album creation in
  // AlbumPickerDialog is the only one of four entry points not yet patched.
  it('Required 2 regression: press Enter twice to create album (second press before first resolves) → createAlbum called only once', async () => {
    let resolveCreate: ((v: { id: number; name: string }) => void) | undefined
    svc.photos.createAlbum.mockImplementation(
      () => new Promise((resolve) => { resolveCreate = resolve }),
    )
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()

    await w.get('[data-test="album-picker-new"]').trigger('click')
    const input = w.get('[data-test="album-picker-new-input"]')
    await input.setValue('Dup Trip')
    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('keydown', { key: 'Enter' }) // Second Enter before first resolves
    await flushPromises()

    expect(svc.photos.createAlbum).toHaveBeenCalledTimes(1)
    resolveCreate?.({ id: 101, name: 'Dup Trip' })
    await flushPromises()
  })

  // Final review required 2 (the other half of the same type of guard): pick() itself also has no in-flight
  // guard, clicking the same album item multiple times sends addAssetsToAlbum repeatedly for same assetIds.
  it('Required 2 regression: click same album item twice (second click before first resolves) → addAssetsToAlbum called only once', async () => {
    let resolveAdd: (() => void) | undefined
    svc.photos.batchAddToAlbum.mockImplementation(
      () => new Promise((resolve) => { resolveAdd = () => resolve(undefined) }),
    )
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    const items = w.findAll('[data-test="album-picker-item"]')

    await items[0]!.trigger('click')
    await items[0]!.trigger('click') // Second click before first resolves
    await flushPromises()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledTimes(1)
    resolveAdd?.()
    await flushPromises()
  })
})
