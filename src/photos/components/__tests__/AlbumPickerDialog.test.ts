// Task 5 (SP7-P4 相册): AlbumPickerDialog.vue —— 「加入相册」选择器。
// 挂 Pinia + i18n(用真实 zh_cn 词条,不用手写迷你 locale——本组件的核心行为就是插值文案本身)。
// mock 共享包 @nimotech/nimoos-service,经由真实 usePhotosAlbums()/useToast() store 端到端验证:
// 点相册项 → 断言底层 service.photos.batchAddToAlbum 真的被调(而不是 mock 掉 store 本身),
// 这样能测出 T2 store 与本组件的实际接线,不是纯白盒断言。
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
  it('open false→true → 拉取相册列表,渲染相册项(标题+计数)与「+ 新建相册」行', async () => {
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

  it('点某相册项 → addAssetsToAlbum(该id, assetIds) 被调 → emit added + update:open(false) + toast', async () => {
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

  it('store 抛错(addAssetsToAlbum 失败)→ 面板仍 open,toast 为失败文案', async () => {
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

  it('点「+ 新建相册」→ 出现输入框;输入名+回车 → createAlbum 然后 addAssetsToAlbum 依次被调', async () => {
    svc.photos.createAlbum.mockResolvedValueOnce({ id: 99, name: 'New Trip' })
    // createAlbum 内部会 fetchAlbums 一次(store 行为),让新相册出现在列表里
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
    // 断言调用顺序:createAlbum 先于 batchAddToAlbum
    expect(svc.photos.createAlbum).toHaveBeenCalledWith('New Trip')
    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith(99, ['a1'])
    const createOrder = svc.photos.createAlbum.mock.invocationCallOrder[0]!
    const addOrder = svc.photos.batchAddToAlbum.mock.invocationCallOrder[0]!
    expect(createOrder).toBeLessThan(addOrder)
    void callOrder
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('createAlbum 抛 409 → 显示重名提示,addAssetsToAlbum 未被调,输入内容仍在', async () => {
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
    // 面板未关,输入框还在且内容保留
    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.get<HTMLInputElement>('[data-test="album-picker-new-input"]').element.value).toBe('Trip')
  })

  it('createAlbum 抛非409错误 → 显示创建失败提示', async () => {
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

  it('相册列表为空 → 渲染 photosAddToAlbumEmpty,「新建」行仍在', async () => {
    svc.photos.listAlbums.mockResolvedValue([])
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()

    expect(w.findAll('[data-test="album-picker-item"]')).toHaveLength(0)
    expect(w.text()).toContain(zh.photosAddToAlbumEmpty)
    expect(w.find('[data-test="album-picker-new"]').exists()).toBe(true)
  })

  it('assetIds 为空 → 相册项 disabled,点击不触发 store', async () => {
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
  })

  it('Esc 分层:输入展开时先收起输入行,再次 Esc 才关闭面板', async () => {
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    await w.get('[data-test="album-picker-new"]').trigger('click')
    expect(w.find('[data-test="album-picker-new-input"]').exists()).toBe(true)

    const input = w.get('[data-test="album-picker-new-input"]')
    await input.trigger('keydown', { key: 'Escape' })
    expect(w.find('[data-test="album-picker-new-input"]').exists()).toBe(false)
    expect(w.emitted('update:open')).toBeUndefined()

    await w.get('[data-test="album-picker-overlay"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('封面缺失时不调用 thumbnailUrl(渲染渐变占位而非拼 URL)', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 5, name: 'NoCover', assetCount: 0 }])
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    expect(svc.photos.thumbnailUrl).not.toHaveBeenCalled()
    expect(w.find('[data-test="album-picker-cover-empty"]').exists()).toBe(true)
  })

  it('有封面时通过 service.photos.thumbnailUrl 生成图片 URL(不手拼)', async () => {
    svc.photos.listAlbums.mockResolvedValue([{ id: 6, name: 'Cover', assetCount: 1, coverAssetId: 'asset-77' }])
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('asset-77', 'small')
    const img = w.get('[data-test="album-picker-item"] img')
    expect(img.attributes('src')).toBe('mock://thumb/asset-77/small')
  })

  it('点击遮罩(非面板本体)关闭整个面板', async () => {
    const w = mountDialog({ open: true, assetIds: ['a1'] })
    await flushPromises()
    await w.get('[data-test="album-picker-overlay"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])
  })
})
