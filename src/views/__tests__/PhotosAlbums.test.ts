// Task 7 (SP7-P4 相册): PhotosAlbums.vue —— 相册列表视图(卡片网格 + 排序 + 新建三种填充
// 方式 + 空态)。挂 Pinia + i18n + 真实 router(spy push,不 mock 整个 vue-router 模块——
// AreaShell/PhotosSidebar 都用 useRouter(),照 PhotosFavorites.test.ts/PhotosTrash.test.ts
// 的既有挂载套路),mock 共享包 albums/timeline 方法。覆盖 brief Step 1 的 8 条行为清单
// + 一条 Esc 关模态(硬约束:document 级监听,不是模板 @keydown.esc,值得单独断言真实生效)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    listAlbums: vi.fn().mockResolvedValue([]),
    createAlbum: vi.fn(),
    getAlbum: vi.fn().mockResolvedValue({ assets: [] }),
    deleteAlbum: vi.fn().mockResolvedValue(undefined),
    updateAlbum: vi.fn().mockResolvedValue({}),
    batchAddToAlbum: vi.fn().mockResolvedValue(undefined),
    removeFromAlbum: vi.fn().mockResolvedValue(undefined),
    reorderAlbumAssets: vi.fn().mockResolvedValue(undefined),
    getTimeline: vi.fn().mockResolvedValue([]),
    thumbnailUrl: vi.fn((id: string | number, size: string) => `mock://thumb/${id}/${size}`),
    // SP15-P2b Task 3: the page now also fetches the smart-view list and the AI
    // feature flags (for the smart-views-off banner) alongside albums.
    listSmartViews: vi.fn().mockResolvedValue([]),
    getConfig: vi.fn().mockResolvedValue({}),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosAlbums from '../PhotosAlbums.vue'
import PhotosLibraryPicker from '../../photos/components/PhotosLibraryPicker.vue'
import { usePhotosAlbums } from '../../photos/stores/albums'
import { useTimelineStore } from '../../photos/stores/timeline'
import { useToast } from '../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/albums', name: 'photos-albums', component: PhotosAlbums },
      { path: '/photos/albums/:id', name: 'photos-album-detail', component: { template: '<div/>' } },
      // SP15-P2b Task 3: smart-card clicks route here now that the grid is mixed.
      { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail-stub', component: { template: '<div/>' } },
      // The AI-off banner's settings link resolves to this path (?section=ai query) -- a stub
      // route lets RouterLink resolve a real href instead of vue-router warning "no match"
      // (same fix PhotosSmartViews.test.ts already applies for its own copy of this banner).
      { path: '/photos/settings', name: 'photos-settings-stub', component: { template: '<div/>' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/photos/albums')
  await router.isReady()
  const w = mount(PhotosAlbums, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

// SP15-P2b Task 3: shared spy for the mixed-grid test block below, reassigned on every
// mountAlbums() call so each test's assertion reads the router instance it actually mounted
// against (mirrors the existing mountView()/router pattern, just hoisted to module scope so
// the brief's test bodies -- which reference a bare `push` -- can call it without destructuring).
let push: ReturnType<typeof vi.fn>

/**
 * Mount PhotosAlbums with albums + smart views + AI-feature fixtures seeded in one call.
 * `aiFeatures`, when provided, is nested under `getConfig()`'s `aiFeatures` field (the shape
 * `usePhotosSettingsStore().fetchAiFeatures()` actually reads via readAiFeatures() in
 * settings.ts); omitting it (as most tests do) leaves getConfig() resolving `{}`, which
 * readAiFeatures() treats as "all features on" -- the same default the store assumes on any
 * other real page.
 */
async function mountAlbums(opts: {
  albums?: Array<Record<string, unknown>>
  smartViews?: Array<Record<string, unknown>>
  aiFeatures?: Record<string, unknown>
  smartViewsFails?: boolean
} = {}) {
  svc.photos.listAlbums.mockResolvedValue(opts.albums ?? [])
  if (opts.smartViewsFails) {
    svc.photos.listSmartViews.mockRejectedValueOnce(new Error('smart views failed'))
  } else {
    svc.photos.listSmartViews.mockResolvedValue(opts.smartViews ?? [])
  }
  svc.photos.getConfig.mockResolvedValue(opts.aiFeatures !== undefined ? { aiFeatures: opts.aiFeatures } : {})

  const router = makeRouter()
  router.push('/photos/albums')
  await router.isReady()
  push = vi.spyOn(router, 'push')
  const w = mount(PhotosAlbums, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return w
}

function rawAlbum(id: string | number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: overrides.name ?? `Album ${id}`,
    coverAssetId: overrides.coverAssetId ?? null,
    assetCount: overrides.assetCount ?? 3,
    dateStart: overrides.dateStart ?? '2026-05-01',
    dateEnd: overrides.dateEnd ?? '2026-05-10',
    createdAt: overrides.createdAt ?? '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  svc.photos.listAlbums.mockClear().mockResolvedValue([])
  svc.photos.createAlbum.mockClear()
  svc.photos.getAlbum.mockClear().mockResolvedValue({ assets: [] })
  svc.photos.batchAddToAlbum.mockClear().mockResolvedValue(undefined)
  svc.photos.getTimeline.mockClear().mockResolvedValue([])
  svc.photos.thumbnailUrl.mockClear()
  svc.photos.listSmartViews.mockClear().mockResolvedValue([])
  svc.photos.getConfig.mockClear().mockResolvedValue({})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PhotosAlbums.vue', () => {
  // fix round 1 (Important 3): the standalone [data-test="albums-empty"] panel this test used
  // to assert on is gone -- the section subtitle carries the empty state now (see
  // PhotosAlbums.vue's comment above the subtitle span). Assert on that instead.
  it('albumsLoaded 且列表空 → 分区副标题显示空态文案,「新建」占位卡仍在', async () => {
    const { w } = await mountView()
    const albums = usePhotosAlbums()
    expect(albums.albumsLoaded).toBe(true)
    expect(w.text()).toContain('还没有相册')
    expect(w.find('[data-test="album-create-tile"]').exists()).toBe(true)
  })

  it('有相册 → 渲染卡片:标题/计数/封面 img src=thumbnailUrl(cover,"large");无封面项渲染 fallback 而非 <img>', async () => {
    svc.photos.listAlbums.mockResolvedValue([
      rawAlbum(1, { name: 'Tokyo', coverAssetId: 'cover-1', assetCount: 5 }),
      rawAlbum(2, { name: 'No Cover', coverAssetId: null, assetCount: 0 }),
    ])
    const { w } = await mountView()

    const cards = w.findAll('[data-test="album-card"]')
    expect(cards).toHaveLength(2)

    const tokyo = cards.find((c) => c.text().includes('Tokyo'))!
    expect(tokyo.text()).toContain('5')
    const img = tokyo.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('mock://thumb/cover-1/large')
    expect(svc.photos.thumbnailUrl).toHaveBeenCalledWith('cover-1', 'large')

    const noCover = cards.find((c) => c.text().includes('No Cover'))!
    expect(noCover.find('img').exists()).toBe(false)
    expect(noCover.find('[data-test="album-cover-fallback"]').exists()).toBe(true)
  })

  it('点卡片 → router.push 收到 /photos/albums/<id>(数字 id 验证 URL 拼接正确)', async () => {
    svc.photos.listAlbums.mockResolvedValue([rawAlbum(42, { name: 'NumericId' })])
    const { w, router } = await mountView()
    const pushSpy = vi.spyOn(router, 'push')

    await w.find('[data-test="album-card"]').trigger('click')
    await flushPromises()

    expect(pushSpy).toHaveBeenCalledWith('/photos/albums/42')
  })

  it('defaults to created (createdAt descending), then switching to name re-sorts alphabetically', async () => {
    svc.photos.listAlbums.mockResolvedValue([
      rawAlbum(1, { name: 'Zebra', createdAt: '2026-05-03T00:00:00Z' }),
      rawAlbum(2, { name: 'Apple', createdAt: '2026-05-01T00:00:00Z' }),
      rawAlbum(3, { name: 'Mango', createdAt: '2026-05-02T00:00:00Z' }),
    ])
    const { w } = await mountView()

    // Default sort is 'created': newest createdAt first (Zebra 05-03 > Mango 05-02 >
    // Apple 05-01) -- proves the default is no longer the dead 'updated' passthrough.
    let titles = w.findAll('[data-test="album-card"] .album-title').map((n) => n.text())
    expect(titles).toEqual(['Zebra', 'Mango', 'Apple'])

    await w.find('[data-test="albums-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    const nameItem = w.findAll('[data-test="albums-sort-item"]').find((n) => n.attributes('data-sort-id') === 'name')!
    await nameItem.trigger('click')
    await w.vm.$nextTick()

    titles = w.findAll('[data-test="album-card"] .album-title').map((n) => n.text())
    expect(titles).toEqual(['Apple', 'Mango', 'Zebra'])
  })

  // Regression for the T2 fix-round finding: the page's `views` computed used to carry a
  // private, byte-for-byte copy of the deleted albumView.sortAlbums, which coerced a
  // missing createdAt to epoch 0 (sorts LAST) -- the opposite of the rule
  // util/mixedAlbums.ts's sortMixed implements (sorts FIRST). `views` now delegates to
  // buildMixedAlbums/sortMixed directly, so this asserts the page a user can actually
  // reach gets the corrected ordering, not just the not-yet-wired module.
  it('ranks an album with a missing createdAt FIRST under the default created sort', async () => {
    svc.photos.listAlbums.mockResolvedValue([
      rawAlbum(1, { name: 'Has Date', createdAt: '2026-05-01T00:00:00Z' }),
      rawAlbum(2, { name: 'No Date', createdAt: null }),
    ])
    const { w } = await mountView()

    const titles = w.findAll('[data-test="album-card"] .album-title').map((n) => n.text())
    expect(titles).toEqual(['No Date', 'Has Date'])
  })

  it('点「新建」→ 模态出现;名称空时主按钮 disabled;填名+empty 提交 → createAlbum 被调 + 成功 toast + 模态关闭', async () => {
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'Trip' })
    const { w } = await mountView()
    const albums = usePhotosAlbums()
    const toast = useToast()
    const createSpy = vi.spyOn(albums, 'createAlbum')
    const showSpy = vi.spyOn(toast, 'show')

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(true)

    const confirmBtn = w.find('[data-test="albums-confirm-create"]')
    expect(confirmBtn.attributes('disabled')).toBeDefined()

    await w.find('[data-test="albums-name-input"]').setValue('Trip')
    await w.vm.$nextTick()
    expect(w.find('[data-test="albums-confirm-create"]').attributes('disabled')).toBeUndefined()

    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(createSpy).toHaveBeenCalledWith('Trip')
    expect(showSpy).toHaveBeenCalledWith(expect.stringContaining('Trip'))
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(false)
  })

  it("source==='recent' → createAlbum 后 addAssetsToAlbum 被调,传入 id 集只含近 30 天照片(fake timers 固定 now)", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T00:00:00Z'))
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'Recent' })
    svc.photos.getTimeline.mockResolvedValue([
      {
        year: 2026,
        month: 7,
        assets: [
          { id: 'recent1', takenAt: '2026-07-20T00:00:00Z', mimeType: 'image/jpeg' },
          { id: 'old1', takenAt: '2026-05-01T00:00:00Z', mimeType: 'image/jpeg' },
        ],
      },
    ])
    const { w } = await mountView()
    const timeline = useTimelineStore()
    await timeline.fetchTimeline()
    const albums = usePhotosAlbums()
    const addSpy = vi.spyOn(albums, 'addAssetsToAlbum')

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-name-input"]').setValue('Recent')
    await w.find('[data-test="source-recent"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(addSpy).toHaveBeenCalledWith('new1', ['recent1'])
  })

  // 评审 Important:恰好 30 天前的边界项——Vue2 :321 的逐字语义是 `t >= cutoff`(闭区间,
  // 含边界),这里单独断言,不要在实现里改成 `>`。
  it("source==='recent' 边界:恰好 30 天前(cutoff 本身)按 >= 语义被包含", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T00:00:00Z'))
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'Boundary' })
    svc.photos.getTimeline.mockResolvedValue([
      {
        year: 2026,
        month: 6,
        // now - 30*86400000 == 2026-06-27T00:00:00Z 的时间戳,与 cutoff 完全相等。
        assets: [{ id: 'boundary1', takenAt: '2026-06-27T00:00:00Z', mimeType: 'image/jpeg' }],
      },
    ])
    const { w } = await mountView()
    const timeline = useTimelineStore()
    await timeline.fetchTimeline()
    const albums = usePhotosAlbums()
    const addSpy = vi.spyOn(albums, 'addAssetsToAlbum')

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-name-input"]').setValue('Boundary')
    await w.find('[data-test="source-recent"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(addSpy).toHaveBeenCalledWith('new1', ['boundary1'])
  })

  // 评审 Important(裁定为新缺陷,非照抄 Vue2):Vue2 的相册列表从来不是独立路由——它是
  // PhotosTimeline.vue 内部按 activeNav 切换的子块,时间线数据由父组件 PhotosTimeline.mounted()
  // 无条件预热。New-UI 把相册做成了独立真路由 /photos/albums,用户可能直链/刷新进来、
  // 从未访问过 /photos,此时 timeline store 是全新的(allPhotos===[])。修复前:'recent' 分支
  // 会静默算出空 id 集,addAssetsToAlbum 被跳过,但仍然弹"已创建"成功 toast——用户拿到一个
  // 空相册和一条假成功提示,零错误信号。断言:timeline 全新时,选 recent 提交 → 组件自己补一次
  // fetchTimeline,addAssetsToAlbum 最终收到非空 id 集(而不是被静默跳过)。
  it("source==='recent' 且 timeline store 全新(未预热)→ 组件自己补 fetchTimeline,addAssetsToAlbum 收到非空 id 集", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-27T00:00:00Z'))
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'ColdStart' })
    svc.photos.getTimeline.mockResolvedValue([
      {
        year: 2026,
        month: 7,
        assets: [{ id: 'warm1', takenAt: '2026-07-20T00:00:00Z', mimeType: 'image/jpeg' }],
      },
    ])
    // 关键:与其它 'recent' 用例不同,这里刻意不预先调用 timeline.fetchTimeline() ——
    // 模拟用户从未访问过 /photos、timeline store 仍是初始空状态。
    const { w } = await mountView()
    const timeline = useTimelineStore()
    expect(timeline.allPhotos).toHaveLength(0) // 前置条件:确实是冷启动
    const fetchSpy = vi.spyOn(timeline, 'fetchTimeline')
    const albums = usePhotosAlbums()
    const addSpy = vi.spyOn(albums, 'addAssetsToAlbum')

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-name-input"]').setValue('ColdStart')
    await w.find('[data-test="source-recent"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(addSpy).toHaveBeenCalledWith('new1', ['warm1']) // 非空 id 集,不是被静默跳过
  })

  it("source==='select' → 提交后 PhotosLibraryPicker 渲染(open===true)", async () => {
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'Picked' })
    const { w } = await mountView()

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-name-input"]').setValue('Picked')
    await w.find('[data-test="source-select"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.getAlbum).toHaveBeenCalledWith('new1')
    expect(w.find('[data-test="lib-picker-overlay"]').exists()).toBe(true)
  })

  // SP15-P1-T9 · Step 0: the picker was generalised and no longer writes to the album store
  // itself — it emits `confirm(ids)` and this page performs the write, the success toast, the
  // close and the fetchAlbums refresh that `@added` used to trigger. All four used to be
  // asserted inside PhotosLibraryPicker.test.ts; they are asserted here now, at their new home.
  /** Runs the create → "select" flow up to the point where the picker is on screen. */
  async function openPickerViaCreate(w: ReturnType<typeof mount>) {
    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-name-input"]').setValue('Picked')
    await w.find('[data-test="source-select"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    return w.findComponent(PhotosLibraryPicker)
  }

  it("source==='select', photos picked → @confirm runs addAssetsToAlbum, the success toast, closes the panel and refreshes with fetchAlbums", async () => {
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'Picked' })
    const { w } = await mountView()
    const albums = usePhotosAlbums()
    const toast = useToast()

    const picker = await openPickerViaCreate(w)
    // The spy goes on after the create step so the "album created" toast is not in the way and
    // the count below really is "how many toasts did the add produce".
    const showSpy = vi.spyOn(toast, 'show')
    const fetchAlbumsSpy = vi.spyOn(albums, 'fetchAlbums')
    picker.vm.$emit('confirm', ['p1', 'p2'])
    await flushPromises()
    await w.vm.$nextTick()

    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledWith('new1', ['p1', 'p2'])
    // fix round 1 · finding 4: exactly one toast, and it is the success one with the album name
    // and the count — a duplicate, or a stray danger toast alongside it, has to fail here.
    expect(showSpy).toHaveBeenCalledTimes(1)
    expect(showSpy).toHaveBeenCalledWith(
      zh.photosAlbumAddedToast.replace('{count}', '2').replace('{name}', 'Picked'),
    )
    expect(fetchAlbumsSpy).toHaveBeenCalled()
    expect(w.find('[data-test="lib-picker-overlay"]').exists()).toBe(false)
  })

  // A failed write: the failure toast, and the panel stays up with the user's selection still in
  // it so they can retry. Same behaviour, moved out of the component.
  it("source==='select', a failed write → failure toast, the panel stays open, and the busy flag is released so a retry is possible", async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'Picked' })
    svc.photos.batchAddToAlbum.mockRejectedValueOnce(new Error('boom'))
    const { w } = await mountView()
    const toast = useToast()

    const picker = await openPickerViaCreate(w)
    const showSpy = vi.spyOn(toast, 'show')
    picker.vm.$emit('confirm', ['p1'])
    await flushPromises()
    await w.vm.$nextTick()

    // fix round 1 · finding 4: only the danger toast, nothing else — a success toast leaking onto
    // the failure path would be caught by the count.
    expect(showSpy).toHaveBeenCalledTimes(1)
    expect(showSpy).toHaveBeenCalledWith(zh.photosAlbumAddFailed)
    expect(w.find('[data-test="lib-picker-overlay"]').exists()).toBe(true)

    // fix round 1 · finding 1: the busy flag must come back down in the handler's `finally`.
    // Without it the panel is left with a permanently disabled button reading "Adding…" and the
    // user has no way to retry — which is exactly what the assertions below rule out.
    expect(picker.props('submitting')).toBe(false)
    picker.vm.$emit('confirm', ['p1'])
    await flushPromises()
    expect(svc.photos.batchAddToAlbum).toHaveBeenCalledTimes(2)

    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  // fix round 1 · finding 2: before Step 0 the picker computed existingIds itself and its own
  // cross-type test proved the String() normalisation. The expression moved here, so the proof
  // has to move with it: album assets come back from the API with **numeric** ids while timeline
  // photos carry strings, and without String() not one already-in photo would be recognised.
  it('the existingIds handed to the picker are String()-normalised (a numeric album asset id arrives as a string)', async () => {
    svc.photos.createAlbum.mockResolvedValue({ id: 'new1', name: 'Picked' })
    svc.photos.getAlbum.mockResolvedValue({
      assets: [{ id: 5, takenAt: '2026-05-01T00:00:00Z', mimeType: 'image/jpeg' }],
    })
    const { w } = await mountView()
    const picker = await openPickerViaCreate(w)

    const ids = picker.props('existingIds') as Set<string>
    expect([...ids]).toEqual(['5'])
    expect(ids.has('5')).toBe(true)
  })

  it('createAlbum 抛 409 → 渲染重名 toast,模态关闭(照 Vue2 finally 语义)', async () => {
    const err = Object.assign(new Error('conflict'), { response: { status: 409 } })
    svc.photos.createAlbum.mockRejectedValue(err)
    const { w } = await mountView()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    await w.find('[data-test="albums-name-input"]').setValue('Dup')
    await w.find('[data-test="albums-confirm-create"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(showSpy).toHaveBeenCalledWith('已存在同名相册')
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(false)
  })

  // 终审必修 3:Vue2 PhotosAlbumsView.vue:52-58 在网格之上无条件渲染「我的相册 / 你创建的
  // 相册」分区头,New-UI 从 banner 直接落到 .album-grid,整段分区头丢失——两个专为它准备的
  // i18n 键(photosAlbumsMine/photosAlbumsMineHint)因此成了死码。界面严格 1:1 照 Vue2,这是
  // 纯视觉删减,必须补。
  it('必修3回归:网格之上渲染「我的相册 / 你创建的相册」分区标题(Vue2 :52-58 对应,New-UI 曾漏渲染)', async () => {
    svc.photos.listAlbums.mockResolvedValue([rawAlbum(1, { name: 'Tokyo' })])
    const { w } = await mountView()
    expect(w.text()).toContain(zh.photosAlbumsMine)
    expect(w.text()).toContain(zh.photosAlbumsMineHint)
  })

  // 终审 Important 1(全支收尾):fetchAlbums 失败时 albumsLoaded 保持假(见 albums.ts
  // 注释),旧实现下 isEmpty 因此恒假 → 落进网格分支渲染"我的相册"分区头 + 光秃秃的新建卡片,
  // 没有任何失败提示。新增 loadError 分支必须拦在最前面——同 PhotosFavorites.test.ts 的三条
  // 挡门用例(失败态渲染 / 重试成功 / 重试仍失败的 in-flight 与结束后都持续可见)+ 两条
  // "仍能区分"的挡门用例(确认空 vs 还在加载中)。
  it('加载失败时渲染失败态而非空网格(P4 遗留同款缺陷)', async () => {
    svc.photos.listAlbums.mockRejectedValueOnce(new Error('network'))
    const { w } = await mountView()
    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(true)
    expect(w.text()).toContain('相册加载失败')
    // fix round 1 (Important 3): albumsLoaded stays false on a failed fetch (albums.ts), so
    // the subtitle's `albumsLoaded &&` gate must keep it on photosAlbumsMineHint rather than
    // flashing the "none yet" copy alongside the error panel above.
    expect(w.find('.albums-section-hint').text()).toBe(zh.photosAlbumsMineHint)
    expect(w.find('[data-test="album-card"]').exists()).toBe(false)
  })

  it('失败态的重试按钮重新调 fetchAlbums,成功后失败态消失', async () => {
    svc.photos.listAlbums.mockRejectedValueOnce(new Error('network'))
    const { w } = await mountView()
    const albums = usePhotosAlbums()
    expect(albums.loadError).toBe(true)
    const fetchSpy = vi.spyOn(albums, 'fetchAlbums')

    svc.photos.listAlbums.mockResolvedValueOnce([rawAlbum(1, { name: 'Tokyo' })])
    await w.find('[data-test="albums-retry"]').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(fetchSpy).toHaveBeenCalled()
    expect(albums.loadError).toBe(false)
    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(false)
    expect(w.find('[data-test="album-card"]').exists()).toBe(true)
  })

  it('失败态重试仍失败(reject→retry→reject)→ in-flight 期间与结束后失败态都持续可见,不出现网格分区头', async () => {
    svc.photos.listAlbums.mockRejectedValueOnce(new Error('e1'))
    const { w } = await mountView()
    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(true)

    let rejectRetry: (e: Error) => void = () => {}
    svc.photos.listAlbums.mockImplementationOnce(
      () => new Promise((_resolve, reject) => { rejectRetry = reject }),
    )
    await w.find('[data-test="albums-retry"]').trigger('click')
    await w.vm.$nextTick()

    // in-flight:重试还没落定,失败态必须继续可见,不能落到空态分支。
    // fix round 1 (Important 3): asserted on the subtitle now, not a standalone panel --
    // see the same rationale in the "加载失败时渲染失败态而非空网格" test above.
    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(true)
    expect(w.find('.albums-section-hint').text()).toBe(zh.photosAlbumsMineHint)

    rejectRetry(new Error('e2'))
    await flushPromises()
    await w.vm.$nextTick()

    // 落定后(仍失败):失败态持续可见。
    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(true)
    expect(w.find('.albums-section-hint').text()).toBe(zh.photosAlbumsMineHint)
  })

  // 关键区分(挡门用例 1):成功但列表为空 —— 必须仍走空态,不能被 loadError 分支误吞。
  // fix round 1 (Important 3): asserted on the subtitle now, not a standalone panel.
  it('确认为零相册(成功但列表空)仍走空态,不走失败态', async () => {
    const { w } = await mountView()
    const albums = usePhotosAlbums()
    expect(albums.loadError).toBe(false)
    expect(albums.albumsLoaded).toBe(true)
    expect(w.find('.albums-section-hint').text()).toBe(zh.photosAlbumsNoneYetHint)
    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(false)
  })

  // 关键区分(挡门用例 2):首次加载飞行中(既未失败也未加载完成)—— 不该出现失败态。
  it('首次加载飞行中(未落定)→ 不出现失败态', async () => {
    let resolveList: ((v: unknown[]) => void) | undefined
    svc.photos.listAlbums.mockImplementationOnce(
      () => new Promise((resolve) => { resolveList = resolve }),
    )
    const router = makeRouter()
    router.push('/photos/albums')
    await router.isReady()
    const w = mount(PhotosAlbums, { global: { plugins: [i18n, router] } })
    await w.vm.$nextTick()

    expect(w.find('[data-test="albums-load-error"]').exists()).toBe(false)

    resolveList?.([])
    await flushPromises()
    await w.vm.$nextTick()
  })

  it('Esc(document 级)关闭新建模态', async () => {
    const { w } = await mountView()

    await w.find('[data-test="albums-new-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="albums-create-modal"]').exists()).toBe(false)
  })
})

// SP15-P2b Task 3: Albums page renders manual albums and smart albums in one grid, ranked
// by the single Sort control, plus the AI-off banner ported over from the smart-views page.
describe('PhotosAlbums.vue — mixed grid (SP15-P2b)', () => {
  it('renders smart albums and manual albums in one grid', async () => {
    // 2 manual + 1 smart => 3 cards plus the create tile.
    const w = await mountAlbums({
      albums: [{ id: 'u1', name: 'A' }, { id: 'u2', name: 'B' }],
      smartViews: [{ id: 's1', name: 'S', seeds: ['x'], conds: [], count: 4 }],
    })
    expect(w.findAll('[data-test="album-card"]')).toHaveLength(2)
    expect(w.findAll('[data-test="sv-card"]')).toHaveLength(1)
  })

  it('counts both kinds in the header total', async () => {
    const w = await mountAlbums({ albums: [{ id: 'u1', name: 'A' }], smartViews: [{ id: 's1', name: 'S' }] })
    expect(w.text()).toContain('2')
  })

  it('opens the smart view detail route when a smart card is clicked', async () => {
    const w = await mountAlbums({ albums: [], smartViews: [{ id: 's1', name: 'S' }] })
    await w.find('[data-test="sv-card"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/photos/smart-views/s1')
  })

  it('shows the smart-views-off banner only when the backend says it is off', async () => {
    const off = await mountAlbums({ albums: [], aiFeatures: { smartview: false } })
    expect(off.find('[data-test="albums-ai-banner"]').exists()).toBe(true)
    // Missing field and fetch failure both mean "on" -- never scare the user.
    const unknown = await mountAlbums({ albums: [], aiFeatures: {} })
    expect(unknown.find('[data-test="albums-ai-banner"]').exists()).toBe(false)
  })

  it('swaps the section subtitle for the nothing-yet copy when both kinds are empty', async () => {
    const empty = await mountAlbums({ albums: [], smartViews: [] })
    expect(empty.text()).toContain('还没有相册')
    const some = await mountAlbums({ albums: [{ id: 'u1', name: 'A' }], smartViews: [] })
    expect(some.text()).not.toContain('还没有相册')
  })

  // fix round 1 (Important 3): before this task's fix, this exact assertion would already
  // pass by accident -- the standalone [data-test="albums-empty"] panel this replaced had no
  // load gate of its own, but neither did it flash, because mountAlbums() always awaits
  // flushPromises before returning. This test deliberately does NOT await resolution, so it
  // exercises the render that happens *before* the two fetches land -- the case the
  // `albums.albumsLoaded &&` guard on the subtitle exists to cover: mixedItems.length is 0
  // for any library while listAlbums()/listSmartViews() are in flight, full or not.
  it('does not flash the none-yet copy before the fetches resolve', async () => {
    let resolveAlbums: ((v: unknown[]) => void) | undefined
    svc.photos.listAlbums.mockImplementationOnce(
      () => new Promise((resolve) => { resolveAlbums = resolve }),
    )
    const router = makeRouter()
    router.push('/photos/albums')
    await router.isReady()
    const w = mount(PhotosAlbums, { global: { plugins: [i18n, router] } })
    await w.vm.$nextTick()

    // Pre-resolution: albumsLoaded is still false, so the subtitle must read the normal
    // "your albums" copy, not the empty one -- even though mixedItems.length is 0 right now.
    expect(w.find('.albums-section-hint').text()).toBe(zh.photosAlbumsMineHint)

    resolveAlbums?.([{ id: 'u1', name: 'A' }])
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.find('.albums-section-hint').text()).toBe(zh.photosAlbumsMineHint)
  })

  it('keeps the manual grid alive when the smart view fetch fails', async () => {
    // fetchSmartViews swallows its own errors (store contract); the page must not gate
    // the manual half on it.
    const w = await mountAlbums({ albums: [{ id: 'u1', name: 'A' }], smartViewsFails: true })
    expect(w.findAll('[data-test="album-card"]')).toHaveLength(1)
  })

  // fix round 1 (Minor 1): the mutation check in the original task report showed that
  // dropping the `item.kind + '-'` prefix from :key was caught by NOTHING in the suite --
  // every fixture up to now used ids that could never collide across kinds. This one gives
  // a manual album and a smart view the identical raw id so a future edit that drops the
  // prefix has something to break.
  it('renders both a manual album and a smart view that share the same raw id', async () => {
    const w = await mountAlbums({
      albums: [{ id: '1', name: 'Manual One' }],
      smartViews: [{ id: '1', name: 'Smart One' }],
    })
    const cards = w.findAll('[data-test="album-card"]')
    expect(cards).toHaveLength(1)
    expect(cards[0].text()).toContain('Manual One')
    expect(w.findAll('[data-test="sv-card"]')).toHaveLength(1)
  })
})
