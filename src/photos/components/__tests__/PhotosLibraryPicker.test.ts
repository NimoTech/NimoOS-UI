// Task 6 (SP7-P4 相册): PhotosLibraryPicker.vue —— 从图库挑照片加入本相册(T7「手动挑选」/
// T8「添加照片」按钮共用)。
// 挂 Pinia + i18n(真实 zh_cn 词条);mock 共享包 @nimotech/nimoos-service,经由真实
// useTimelineStore()/usePhotosAlbums()/useToast() 端到端验证——瓦片来源、已在相册判定、
// 添加动作都走真实 store,不是纯白盒断言。
// [T9] Superseded in part by the Step 0 note below: the add action itself is no longer issued by
// this component, so the toast store is no longer involved here.
//
// 铁律交叉验证:相册资产用数字 id(经 fetchAlbumAssets→assetToPhoto 真实转换管线得到
// Photo.id 为 number),时间线照片用字符串 id(同样走 assetToPhoto),existingIds 必须
// String() 归一才能命中——这是本任务的核心断言。
//
// SP15-P1-T9 · Step 0 (generalisation): the component's props moved from the album-specific
// {open, albumId, albumName} to the generic {open, title, existingIds, existingLabel,
// submitLabel, submitting}, and submitting no longer writes to the album store — it emits
// `confirm` and the caller writes. Every case below therefore mounts with the props the album
// pages now pass (albumProps(), which builds the exact same strings from the same zh keys, and
// derives existingIds through the same real store pipeline), so what these cases assert is still
// what the album pages render. The write / success toast / failure toast / post-add refresh that
// left this component are asserted at their new home, in PhotosAlbums.test.ts and
// PhotosAlbumDetail.test.ts.
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
    // Task 8b: fetchTimeline() probes this before falling back to getTimeline(). Defaulted
    // to a 404 rejection in beforeEach below so every pre-existing test here keeps exercising
    // the legacy path unchanged; only the bucket-mode tests override it.
    getTimelineBuckets: vi.fn(),
    getTimelineBucket: vi.fn(),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosLibraryPicker from '../PhotosLibraryPicker.vue'
import { usePhotosAlbums } from '../../stores/albums'
import { useTimelineStore, __resetBucketProbeForTest } from '../../stores/timeline'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// Task 8b: models "this backend predates the bucket endpoints" for fetchTimeline()'s probe --
// see timeline.test.ts's own notFound() for the same rationale.
function notFound() {
  return Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } })
}

interface PickerProps {
  open: boolean
  title: string
  existingIds: Set<string>
  existingLabel: string
  submitLabel: string | ((count: number) => string)
  submitting?: boolean
}

/** The props both album pages pass — same i18n keys, same String()-normalised existingIds
 *  expression — so these cases keep asserting what the album pages actually render. */
function albumProps(over: Partial<PickerProps> = {}): PickerProps {
  const albums = usePhotosAlbums()
  return {
    open: true,
    title: zh.photosAlbumPickerTitle.replace('{name}', 'Trip'),
    existingIds: new Set(albums.assetsOf('a1').map((p) => String(p.id))),
    existingLabel: zh.photosAlbumPickerAlready,
    submitLabel: (count: number) => zh.photosAlbumPickerAdd.replace('{count}', String(count)),
    ...over,
  }
}

function mountPicker(props: PickerProps) {
  return mount(PhotosLibraryPicker, { props, global: { plugins: [i18n] } })
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
  // Task 8b: the bucket probe's 404 backoff is a module-level timestamp, not store state --
  // it survives across tests in this file unless explicitly cleared, which would silently
  // skip the probe (and thus never enter bucket mode) for whichever bucket-mode test runs
  // after an earlier 404 has already set the backoff window.
  __resetBucketProbeForTest()
  svc.photos.getTimeline.mockReset()
  svc.photos.getAlbum.mockReset().mockResolvedValue({ assets: [] })
  svc.photos.batchAddToAlbum.mockReset().mockResolvedValue(undefined)
  svc.photos.getTimelineBuckets.mockReset().mockRejectedValue(notFound())
  svc.photos.getTimelineBucket.mockReset()
  svc.photos.thumbnailUrl.mockClear()
})

describe('PhotosLibraryPicker.vue', () => {
  it('展平时间线照片按 takenAt 降序渲染瓦片(首个为最新的 t-newest)', async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
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

    const w = mountPicker(albumProps())
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

  // Step 0: the submit button's label still counts up with the selection (the album pages pass a
  // (count) => string label for exactly that), and pressing it hands the raw ids to the caller.
  it('two tiles selected → the submit label reads 2; pressing it emits confirm([id1, id2]) with the ids unconverted', async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
    await flushPromises()

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

    expect(w.emitted('confirm')).toEqual([[['t-newest', 't-mid']]])
  })

  // Step 0 · the brief's new case: submitting must not reach the album store any more — the write
  // belongs to the caller now. Spying on the real store instance (not the service mock) is what
  // makes this fail if any half of the old album-specific behaviour is left behind.
  it('SP15-P1-T9 generalisation: submitting only emits confirm — it neither writes to the store nor closes itself', async () => {
    seedTimeline()
    const albums = usePhotosAlbums()
    const spy = vi.spyOn(albums, 'addAssetsToAlbum')
    const w = mountPicker(albumProps())
    await flushPromises()

    await w.findAll('[data-test="lib-picker-tile"]')[0]!.trigger('click') // t-newest
    await w.get('[data-test="lib-picker-add"]').trigger('click')
    await flushPromises()

    expect(spy).not.toHaveBeenCalled()
    expect(svc.photos.batchAddToAlbum).not.toHaveBeenCalled()
    expect(w.emitted('confirm')?.[0]?.[0]).toEqual(['t-newest'])
    // Closing is the caller's call too — it is the one that knows whether the write succeeded.
    expect(w.emitted('update:open')).toBeUndefined()
  })

  // Step 0 · the failure path, from the component's side. The write and its failure toast now
  // live in the album pages (asserted there); what this component still owes the user is that a
  // caller which leaves the panel open finds the selection exactly as it was, and can resubmit.
  //
  // fix round 1 · finding 1: this deliberately replays the caller's whole lifecycle — submitting
  // goes true while the write is in flight and back to false in the caller's `finally`. The
  // earlier version of this case never turned submitting on at all, so "the button recovered"
  // was true before the click as well and proved nothing. (That the callers really do reset the
  // flag is asserted in their own tests; here it is the premise.)
  it("the caller's write fails and it keeps the panel open → the selection survives, the button recovers and a second submit is sent", async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
    await flushPromises()

    await w.findAll('[data-test="lib-picker-tile"]')[0]!.trigger('click')
    await w.get('[data-test="lib-picker-add"]').trigger('click')
    await w.setProps({ submitting: true })   // caller's write is in flight
    await w.setProps({ submitting: false })  // …and it failed; the caller's finally clears it
    await flushPromises()

    // The selection is still there (the panel still reads "1 selected", it was not cleared).
    expect(w.text()).toContain(zh.photosSelectedCount.replace('{count}', '1'))
    // The button is usable again, not stuck in the submitting state.
    expect(w.get<HTMLButtonElement>('[data-test="lib-picker-add"]').element.disabled).toBe(false)

    await w.get('[data-test="lib-picker-add"]').trigger('click')
    expect(w.emitted('confirm')).toHaveLength(2)
  })

  // Step 0 · submitting comes from the caller (Vue 3's emit cannot hand back the parent's
  // promise — see deviation a in the component's header): while the write is in flight the
  // button is disabled and reads "Adding…", and clicking it again emits nothing.
  it('submitting=true (the caller\'s write is in flight) → the button is disabled, reads "Adding…", and a repeat click emits no second confirm', async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
    await flushPromises()
    await w.findAll('[data-test="lib-picker-tile"]')[0]!.trigger('click')

    await w.setProps({ submitting: true })
    expect(w.get<HTMLButtonElement>('[data-test="lib-picker-add"]').element.disabled).toBe(true)
    expect(w.text()).toContain(zh.photosAlbumPickerAdding)

    await w.get('[data-test="lib-picker-add"]').trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
  })

  // Step 0 · a caller with a fixed label (the moment page passes photosMoAddSelected, a plain
  // string) — the button shows it as is, with no count appended. Both usages of the one
  // component have to hold.
  it('a plain-string submitLabel is rendered verbatim, with no selected count appended', async () => {
    seedTimeline()
    const w = mountPicker(albumProps({ submitLabel: '添加所选' }))
    await flushPromises()
    await w.findAll('[data-test="lib-picker-tile"]')[0]!.trigger('click')

    const addBtn = w.get('[data-test="lib-picker-add"]')
    expect(addBtn.text()).toBe('添加所选')
    expect(addBtn.text()).not.toContain('1')
  })

  it('有选择时点取消 → 出确认条;再确认才关闭;无选择时点取消直接关闭', async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
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
    const w = mountPicker(albumProps())
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
    const w = mountPicker(albumProps())
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
    const w = mountPicker(albumProps())
    await flushPromises()
    expect(w.find('[data-test="lib-picker-empty"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.photosAlbumPickerEmpty)
  })

  it('open 由 false→true 时:months 为空则触发 fetchTimeline(从相册详情页直接进来图库未加载的情况)', async () => {
    svc.photos.getTimeline.mockResolvedValueOnce([
      { year: 2026, month: 7, assets: [{ id: 'x1', takenAt: '2026-07-01T00:00:00Z', mimeType: 'image/jpeg' }] },
    ])
    const w = mountPicker(albumProps({ open: false }))
    expect(svc.photos.getTimeline).not.toHaveBeenCalled()
    await w.setProps({ open: true })
    await flushPromises()
    expect(svc.photos.getTimeline).toHaveBeenCalledTimes(1)
    expect(w.findAll('[data-test="lib-picker-tile"]')).toHaveLength(1)
  })

  it('open 由 false→true 时清空本地 selected(上次未提交的选择不残留到下次打开)', async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
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
    const w = mountPicker(albumProps())
    await flushPromises()
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('t-newest', 'small')
    const img = w.get('[data-asset-id="t-newest"] img')
    expect(img.attributes('src')).toBe('mock://thumb/t-newest/small')
  })

  it('Esc 分层(document 级派发):确认条展开时先收起确认条(面板仍 open);无选择时 Esc 直接关闭', async () => {
    seedTimeline()
    const w = mountPicker(albumProps())
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

  // Task 8b (owner ruling): in bucket mode `months` arriving does not mean any photos are in
  // hand -- this grid is `timeline.allPhotos` flattened, so without fetchNewestBuckets the
  // picker would render empty even though the directory says the library has photos.
  it('打开时(分桶模式)调用 fetchNewestBuckets 拉最新几个月,而不是只等目录到达', async () => {
    svc.photos.getTimelineBuckets.mockReset().mockResolvedValueOnce([
      { year: 2026, month: 8, count: 1, videoCount: 0 },
      { year: 2026, month: 7, count: 1, videoCount: 0 },
      { year: 2026, month: 6, count: 1, videoCount: 0 },
    ])
    svc.photos.getTimelineBucket.mockReset().mockResolvedValue([{ id: 'a1', mimeType: 'image/jpeg' }])
    const timeline = useTimelineStore()
    const fetchSpy = vi.spyOn(timeline, 'fetchNewestBuckets')
    const w = mountPicker(albumProps({ open: false }))
    await flushPromises()
    expect(svc.photos.getTimelineBucket).not.toHaveBeenCalled()

    await w.setProps({ open: true })
    await flushPromises()

    expect(fetchSpy).toHaveBeenCalledWith(3)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 8, 500, 0)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 7, 500, 0)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 6, 500, 0)
  })

  // Task 8b (owner ruling, second half): scrolling near the bottom pages in the next
  // unloaded dated bucket. Two scroll events fired back to back (before the first bucket's
  // photos have landed) must not fire two requests for that same month.
  it('滚到接近底部时拉下一个未加载的有日期桶;连续两次滚动不重复请求同一个桶', async () => {
    svc.photos.getTimelineBuckets.mockReset().mockResolvedValueOnce([
      { year: 2026, month: 8, count: 1, videoCount: 0 },
      { year: 2026, month: 7, count: 1, videoCount: 0 },
      { year: 2026, month: 6, count: 1, videoCount: 0 },
      { year: 2026, month: 5, count: 1, videoCount: 0 },
    ])
    svc.photos.getTimelineBucket.mockReset().mockResolvedValue([{ id: 'a1', mimeType: 'image/jpeg' }])
    const w = mountPicker(albumProps())
    await flushPromises()
    // open watch's immediate fetchNewestBuckets(3) already loaded 08/07/06, leaving 05
    // the only unloaded dated bucket.
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(3)

    const body = w.get('.lib-picker-body')
    Object.defineProperty(body.element, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(body.element, 'clientHeight', { value: 500, configurable: true })
    body.element.scrollTop = 550 // 1000 - 550 - 500 = -50 < 200 → near the bottom

    await body.trigger('scroll')
    await body.trigger('scroll') // fired again before the first request settles
    await flushPromises()

    expect(svc.photos.getTimelineBucket).toHaveBeenCalledTimes(4)
    expect(svc.photos.getTimelineBucket).toHaveBeenCalledWith(2026, 5, 500, 0)
  })
})
