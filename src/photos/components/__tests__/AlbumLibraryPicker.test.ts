// Task 6 (SP7-P4 相册): AlbumLibraryPicker.vue —— 从图库挑照片加入本相册(T7「手动挑选」/
// T8「添加照片」按钮共用)。
// 挂 Pinia + i18n(真实 zh_cn 词条);mock 共享包 @nimotech/nimoos-service,经由真实
// useTimelineStore()/usePhotosAlbums()/useToast() 端到端验证——瓦片来源、已在相册判定、
// 添加动作都走真实 store,不是纯白盒断言。
//
// 铁律交叉验证:相册资产用数字 id(经 fetchAlbumAssets→assetToPhoto 真实转换管线得到
// Photo.id 为 number),时间线照片用字符串 id(同样走 assetToPhoto),existingIds 必须
// String() 归一才能命中——这是本任务的核心断言。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    getTimeline: vi.fn(),
    getAlbum: vi.fn(),
    batchAddToAlbum: vi.fn(),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import AlbumLibraryPicker from '../AlbumLibraryPicker.vue'
import { useToast } from '../../../stores/toast'
import { usePhotosAlbums } from '../../stores/albums'
import { useTimelineStore } from '../../stores/timeline'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountPicker(props: { open: boolean; albumId: string | number; albumName: string }) {
  return mount(AlbumLibraryPicker, { props, global: { plugins: [i18n] } })
}

// 三张时间线照片,takenAt 乱序摆放,验证展平后按 takenAt 降序重排(不是原始顺序、不按月分组)。
function seedTimeline() {
  const timeline = useTimelineStore()
  timeline.timelineGroups = [
    {
      year: 2026, month: 7,
      assets: [
        { id: 't-mid', takenAt: '2026-07-10T00:00:00Z', mimeType: 'image/jpeg' },
        { id: 't-newest', takenAt: '2026-07-20T00:00:00Z', mimeType: 'image/jpeg' },
      ],
    },
    {
      year: 2026, month: 6,
      assets: [
        { id: 't-oldest', takenAt: '2026-06-01T00:00:00Z', mimeType: 'image/jpeg' },
      ],
    },
  ]
  return timeline
}

beforeEach(() => {
  setActivePinia(createPinia())
  svc.photos.getTimeline.mockReset()
  svc.photos.getAlbum.mockReset().mockResolvedValue({ assets: [] })
  svc.photos.batchAddToAlbum.mockReset().mockResolvedValue(undefined)
  svc.photos.thumbnailUrl.mockClear()
})

describe('AlbumLibraryPicker.vue', () => {
  it('展平时间线照片按 takenAt 降序渲染瓦片(首个为最新的 t-newest)', async () => {
    seedTimeline()
    const w = mountPicker({ open: true, albumId: 'a1', albumName: 'Trip' })
    await flushPromises()

    const tiles = w.findAll('[data-test="lib-picker-tile"]')
    expect(tiles).toHaveLength(3)
    expect(tiles[0]!.attributes('data-asset-id')).toBe('t-newest')
    expect(tiles[1]!.attributes('data-asset-id')).toBe('t-mid')
    expect(tiles[2]!.attributes('data-asset-id')).toBe('t-oldest')
    // 标题带相册名 + 初始已选计数 0
    expect(w.text()).toContain('Trip')
    expect(w.text()).toContain(zh.photosSelectedCount.replace('{count}', '0'))
  })

  it('已在相册中的项渲染 photosAlbumPickerAlready 且点击不进 selected;跨类型 String 归一(相册资产数字 id,时间线照片字符串 id)', async () => {
    const timeline = seedTimeline()
    // 相册资产:后端原始 id 为数字 5,经 fetchAlbumAssets 真实转换管线得到 Photo.id === 5 (number)。
    // t-newest 的时间线 id 是字符串 't-newest'——两者不重叠,另外单独插入一张数字 5 对应的
    // 字符串形态 '5' 到时间线里,制造跨类型命中。
    svc.photos.getAlbum.mockResolvedValueOnce({ assets: [{ id: 5, takenAt: null, mimeType: 'image/jpeg' }] })
    timeline.timelineGroups = [
      {
        year: 2026, month: 7,
        assets: [
          { id: '5', takenAt: '2026-07-15T00:00:00Z', mimeType: 'image/jpeg' }, // 字符串 '5',命中数字 5
          { id: 't-other', takenAt: '2026-07-01T00:00:00Z', mimeType: 'image/jpeg' },
        ],
      },
    ]
    const albums = usePhotosAlbums()
    await albums.fetchAlbumAssets('a1')
    expect(albums.assetsOf('a1').map((p) => p.id)).toEqual([5]) // 确认真实转换得到 number

    const w = mountPicker({ open: true, albumId: 'a1', albumName: 'Trip' })
    await flushPromises()

    const tileFive = w.get('[data-asset-id="5"]')
    expect(tileFive.attributes('data-disabled')).toBe('true')
    expect(tileFive.text()).toContain(zh.photosAlbumPickerAlready)

    const tileOther = w.get('[data-asset-id="t-other"]')
    expect(tileOther.attributes('data-disabled')).toBe('false')

    await tileFive.trigger('click')
    // 点击已在相册中的瓦片不进 selected —— 主按钮计数应仍为 0(禁用)
    expect(w.text()).toContain(zh.photosSelectedCount.replace('{count}', '0'))
    const addBtn = w.get<HTMLButtonElement>('[data-test="lib-picker-add"]')
    expect(addBtn.element.disabled).toBe(true)
  })

  it('选中两张 → 主按钮文案含 2;点击 → addAssetsToAlbum(albumId,[id1,id2]) 被调 → emit added(2) + update:open(false) + toast', async () => {
    seedTimeline()
    const w = mountPicker({ open: true, albumId: 'a1', albumName: 'Trip' })
    await flushPromises()
    const toast = useToast()

    const tiles = w.findAll('[data-test="lib-picker-tile"]')
    await tiles[0]!.trigger('click') // t-newest
    await tiles[1]!.trigger('click') // t-mid
    await flushPromises()

    expect(w.text()).toContain(zh.photosAlbumPickerAdd.replace('{count}', '2'))
    expect(w.text()).toContain(zh.photosSelectedCount.replace('{count}', '2'))

    const addBtn = w.get<HTMLButtonElement>('[data-test="lib-picker-add"]')
    expect(addBtn.element.disabled).toBe(false)
    await addBtn.trigger('click')
    await flushPromises()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith('a1', ['t-newest', 't-mid'])
    expect(w.emitted('added')).toEqual([[2]])
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(toast.toasts.length).toBe(1)
    expect(toast.toasts[0]!.text).toContain('Trip')
    expect(toast.toasts[0]!.text).toContain('2')
  })

  it('store 抛错(addAssetsToAlbum 失败)→ 面板仍 open,失败 toast,按钮恢复可用,已选中项保留', async () => {
    svc.photos.batchAddToAlbum.mockRejectedValueOnce(new Error('boom'))
    seedTimeline()
    const w = mountPicker({ open: true, albumId: 'a1', albumName: 'Trip' })
    await flushPromises()
    const toast = useToast()

    const tiles = w.findAll('[data-test="lib-picker-tile"]')
    await tiles[0]!.trigger('click')
    const addBtn = w.get<HTMLButtonElement>('[data-test="lib-picker-add"]')
    await addBtn.trigger('click')
    await flushPromises()

    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.emitted('added')).toBeUndefined()
    expect(toast.toasts[0]!.text).toBe(zh.photosAlbumAddFailed)
    // 按钮恢复可用(不是卡在 adding 态)
    expect(w.get<HTMLButtonElement>('[data-test="lib-picker-add"]').element.disabled).toBe(false)
    // 已选中的项保留(仍显示"已选择 1 项"文案,而不是被清空)
    expect(w.text()).toContain(zh.photosSelectedCount.replace('{count}', '1'))
  })

  it('有选择时点取消 → 出确认条;再确认才关闭;无选择时点取消直接关闭', async () => {
    seedTimeline()
    const w = mountPicker({ open: true, albumId: 'a1', albumName: 'Trip' })
    await flushPromises()

    // 无选择 → 直接关闭
    await w.get('[data-test="lib-picker-cancel"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])

    // 重新开启,选中一张后点取消 → 出确认条,不关闭
    await w.setProps({ open: true })
    await flushPromises()
    const tiles = w.findAll('[data-test="lib-picker-tile"]')
    await tiles[0]!.trigger('click')
    await w.get('[data-test="lib-picker-cancel"]').trigger('click')
    expect(w.find('[data-test="lib-picker-discard-bar"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.photosAlbumPickerDiscard)
    // update:open 仍只有第一次那一条(false),没有新增
    expect(w.emitted('update:open')).toEqual([[false]])

    // 确认放弃 → 才真正关闭
    await w.get('[data-test="lib-picker-discard-confirm"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false], [false]])
  })

  it('确认条里点"返回"(取消放弃)→ 确认条收起,面板仍 open,已选内容保留', async () => {
    seedTimeline()
    const w = mountPicker({ open: true, albumId: 'a1', albumName: 'Trip' })
    await flushPromises()
    const tiles = w.findAll('[data-test="lib-picker-tile"]')
    await tiles[0]!.trigger('click')
    await w.get('[data-test="lib-picker-cancel"]').trigger('click')
    expect(w.find('[data-test="lib-picker-discard-bar"]').exists()).toBe(true)

    await w.get('[data-test="lib-picker-discard-cancel"]').trigger('click')
    expect(w.find('[data-test="lib-picker-discard-bar"]').exists()).toBe(false)
    expect(w.emitted('update:open')).toBeUndefined()
    expect(w.text()).toContain(zh.photosSelectedCount.replace('{count}', '1'))
  })

  // 评审补漏:Vue2 源(PhotosAlbumLibraryPicker.vue:10-12)头部确有一个 X 关闭按钮
  // (@click="onScrimClose"),行为与点遮罩/点取消同一套「有未保存选择先确认」的分层逻辑。
  // brief 结构清单没列出它,但本期「界面严格 1:1 照 Vue2」的纪律要求补上。
  it('头部 X 关闭按钮:有选中时点击 → 出确认条,update:open 未 emit;无选中时点击 → 直接关闭', async () => {
    seedTimeline()
    const w = mountPicker({ open: true, albumId: 'a1', albumName: 'Trip' })
    await flushPromises()

    // 有选中 → 出确认条,不直接关
    const tiles = w.findAll('[data-test="lib-picker-tile"]')
    await tiles[0]!.trigger('click')
    await w.get('[data-test="lib-picker-close"]').trigger('click')
    expect(w.find('[data-test="lib-picker-discard-bar"]').exists()).toBe(true)
    expect(w.emitted('update:open')).toBeUndefined()

    // 确认放弃后关闭(模拟宿主真实响应 update:open,把 prop 真的翻回 false 再重新打开——
    // 否则 open 停在 true,false→true 的 watch 不会触发,selected 不会被清空)
    await w.get('[data-test="lib-picker-discard-confirm"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false]])

    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await flushPromises()
    await w.get('[data-test="lib-picker-close"]').trigger('click')
    expect(w.emitted('update:open')).toEqual([[false], [false]])
  })

  it('无可添加照片(时间线为空)→ 渲染 photosAlbumPickerEmpty', async () => {
    svc.photos.getTimeline.mockResolvedValue([])
    const w = mountPicker({ open: true, albumId: 'a1', albumName: 'Trip' })
    await flushPromises()
    expect(w.find('[data-test="lib-picker-empty"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.photosAlbumPickerEmpty)
  })

  it('open 由 false→true 时:months 为空则触发 fetchTimeline(从相册详情页直接进来图库未加载的情况)', async () => {
    svc.photos.getTimeline.mockResolvedValueOnce([
      { year: 2026, month: 7, assets: [{ id: 'x1', takenAt: '2026-07-01T00:00:00Z', mimeType: 'image/jpeg' }] },
    ])
    const w = mountPicker({ open: false, albumId: 'a1', albumName: 'Trip' })
    expect(svc.photos.getTimeline).not.toHaveBeenCalled()
    await w.setProps({ open: true })
    await flushPromises()
    expect(svc.photos.getTimeline).toHaveBeenCalledTimes(1)
    expect(w.findAll('[data-test="lib-picker-tile"]')).toHaveLength(1)
  })

  it('open 由 false→true 时清空本地 selected(上次未提交的选择不残留到下次打开)', async () => {
    seedTimeline()
    const w = mountPicker({ open: true, albumId: 'a1', albumName: 'Trip' })
    await flushPromises()
    const tiles = w.findAll('[data-test="lib-picker-tile"]')
    await tiles[0]!.trigger('click')
    expect(w.text()).toContain(zh.photosSelectedCount.replace('{count}', '1'))

    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await flushPromises()
    expect(w.text()).toContain(zh.photosSelectedCount.replace('{count}', '0'))
  })

  it('瓦片缩略图用共享包 thumbnailUrl 生成(不手拼 /v1/photos/... URL)', async () => {
    seedTimeline()
    const w = mountPicker({ open: true, albumId: 'a1', albumName: 'Trip' })
    await flushPromises()
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('t-newest', 'small')
    const img = w.get('[data-asset-id="t-newest"] img')
    expect(img.attributes('src')).toBe('mock://thumb/t-newest/small')
  })

  it('Esc 分层(document 级派发):确认条展开时先收起确认条(面板仍 open);无选择时 Esc 直接关闭', async () => {
    seedTimeline()
    const w = mountPicker({ open: true, albumId: 'a1', albumName: 'Trip' })
    await flushPromises()
    const tiles = w.findAll('[data-test="lib-picker-tile"]')
    await tiles[0]!.trigger('click')
    await w.get('[data-test="lib-picker-cancel"]').trigger('click')
    expect(w.find('[data-test="lib-picker-discard-bar"]').exists()).toBe(true)

    // 第一次 Esc:只收起确认条,面板仍 open
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.find('[data-test="lib-picker-discard-bar"]').exists()).toBe(false)
    expect(w.emitted('update:open')).toBeUndefined()

    // 重新打开一个全新面板(无选择)验证 Esc 直接关闭
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await flushPromises()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.emitted('update:open')).toContainEqual([false])
  })
})
