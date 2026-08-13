// SP7-P7a-T6: PhotosSmartViewDetail.vue —— 智能视图详情页外壳(byId 数据源 + header +
// 三菜单 + 删除确认 + 导出修 401 + 两段网格)。逐条对应 task-6-brief.md「必含用例」清单。
//
// 测试策略:store(usePhotosSmartViews)用真实实现,只 mock 共享包 service —— byId 的
// "改 store 后视图自动跟着变"是 §7e-2 本期核心修复的主守卫,必须走真实 store 才有意义。
// useLightbox 是模块级单例(同 PhotosAlbumDetail.test.ts 的既有手法),这里 spy 掉
// openAt 本体(mockImplementation 空函数),只断言调用参数,不放真实 hydrate 链路进来
// (那需要额外 mock getAsset/getAssetOcr/favorites,与本任务无关)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import { readFileSync } from 'node:fs'
import zh from '../../i18n/zh_cn'
import en from '../../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    listSmartViews: vi.fn(),
    getSmartViewAssets: vi.fn(),
    getSmartViewActivity: vi.fn(),
    updateSmartView: vi.fn(),
    deleteSmartView: vi.fn(),
    createSmartView: vi.fn(), // restoreSmartView 的底层调用
    duplicateSmartView: vi.fn(),
    exportSmartViewAlbum: vi.fn(),
    exportSmartViewUrl: vi.fn((id: string | number, format: string) => `/v1/photos/smart-views/${id}/export?format=${format}&token=tok`),
    thumbnailUrl: vi.fn((id: string | number, size = 'large') => `mock://thumb/${id}/${size}`),
    // Task 7, folded-in finding (d): the page's own onMounted/route watcher calls
    // store.loadExcluded, which hits this endpoint. `loadExcluded` catches and leaves
    // `excluded` empty (smartViews.ts:534-547) -- exactly the end state a `[]` mock produces --
    // so this carries none of getConfig's coupling risk (see the comment on that one below) and
    // was simply missing. Adding it removes 77 caught-TypeError console.error lines per run.
    getSmartViewExcluded: vi.fn(),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// useLightbox 是模块级单例:每次调用 useLightbox() 都会返回一个**新的对象字面量**,但其
// `openAt` 属性指向同一个模块顶层函数——在这个新字面量上 `vi.spyOn(obj, 'openAt')` 只会
// 影子这一个对象自身的属性,不会影响组件内部另一次 `useLightbox()` 调用拿到的另一份对象
// (它的 `openAt` 仍指向未被拦截的真实函数)。本组件只用到 `lb.openAt` 这一个方法,直接
// mock 整个模块最简单也最可靠——测试文件与组件内部拿到的是同一个 `lbMock.openAt`。
const lbMock = vi.hoisted(() => ({ openAt: vi.fn() }))
vi.mock('../../photos/lightbox/useLightbox', () => ({ useLightbox: () => lbMock }))

import PhotosSmartViewDetail from '../PhotosSmartViewDetail.vue'
import photosSmartViewDetailRaw from '../PhotosSmartViewDetail.vue?raw'
import { usePhotosSmartViews, type SmartView } from '../../photos/stores/smartViews'
import { usePhotosAlbums } from '../../photos/stores/albums'
import { useToast } from '../../stores/toast'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from '../../photos/components/__tests__/cssCascade'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh, en_us: en } })

function makeRouter(initial = '/photos/smart-views/7') {
  const router = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
      { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: PhotosSmartViewDetail },
      // SP15-P2b Task 5: smart albums moved into Albums (Tasks 3/4) -- this page's back
      // links (not-found, detail bar, post-delete) all now land here instead.
      { path: '/photos/albums', name: 'photos-albums-stub', component: { template: '<div/>' } },
    ],
  })
  router.push(initial)
  return router
}

interface RawSv {
  id: number | string
  name: string
  description?: string
  conds?: string[]
  threshold?: number
  live?: boolean
  includeVideos?: boolean
  count?: number
  addedThisWeek?: number
  seeds?: string[]
  median?: number
  storageBytes?: number
  distribution?: number[]
  evaluatedAt?: string
}

function makeSv(overrides: Partial<RawSv> = {}): RawSv {
  return {
    id: 7,
    name: 'Sunsets',
    description: '',
    conds: ['scene: sunset'],
    threshold: 72,
    live: true,
    includeVideos: false,
    count: 1000,
    addedThisWeek: 3,
    seeds: [],
    median: 0,
    storageBytes: 0,
    distribution: [],
    evaluatedAt: '',
    ...overrides,
  }
}

function asset(id: string | number, overrides: Record<string, unknown> = {}) {
  return { id, takenAt: '2026-05-01T10:00:00Z', mimeType: 'image/jpeg', originalName: `${id}.jpg`, ...overrides }
}

async function mountView(id = '7', svList: RawSv[] = [makeSv({ id: 7 })]) {
  svc.photos.listSmartViews.mockResolvedValue(svList)
  const router = makeRouter(`/photos/smart-views/${id}`)
  await router.isReady()
  const w = mount(PhotosSmartViewDetail, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('access_token', 'tok-123')
  setActivePinia(createPinia())
  svc.photos.listSmartViews.mockReset()
  svc.photos.getSmartViewAssets.mockReset().mockResolvedValue([])
  svc.photos.getSmartViewActivity.mockReset().mockResolvedValue([])
  svc.photos.updateSmartView.mockReset()
  svc.photos.deleteSmartView.mockReset()
  svc.photos.createSmartView.mockReset()
  svc.photos.duplicateSmartView.mockReset()
  svc.photos.exportSmartViewAlbum.mockReset()
  svc.photos.exportSmartViewUrl.mockClear()
  svc.photos.thumbnailUrl.mockClear()
  svc.photos.getSmartViewExcluded.mockReset().mockResolvedValue([])
  lbMock.openAt.mockClear()
})
afterEach(() => {
  usePhotosSmartViews().__resetForTest()
  vi.restoreAllMocks()
})

// ── 数据源三态(§7e-2 结构规格 1)────────────────────────────────────────────
describe('数据源三态', () => {
  it('listLoaded 假(请求未 resolve)→ 骨架,不渲染 header', async () => {
    let resolveFn: ((v: RawSv[]) => void) | undefined
    svc.photos.listSmartViews.mockImplementation(() => new Promise((res) => { resolveFn = res }))
    const router = makeRouter('/photos/smart-views/7')
    await router.isReady()
    const w = mount(PhotosSmartViewDetail, { global: { plugins: [i18n, router] } })
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-skeleton"]').exists()).toBe(true)
    expect(w.find('.sv-header').exists()).toBe(false)
    resolveFn?.([makeSv({ id: 7 })])
    await flushPromises()
  })

  it('listLoaded 真 + byId 命中 → 正常渲染 header', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    expect(w.find('[data-test="sv-skeleton"]').exists()).toBe(false)
    expect(w.find('.sv-header').exists()).toBe(true)
    expect(w.find('[data-test="sv-title-view"]').text()).toBe('Sunsets')
  })

  it('listLoaded 真 + byId 返 null →「找不到」空态 + 返回按钮', async () => {
    const { w } = await mountView('999', [makeSv({ id: 7 })])
    expect(w.find('[data-test="sv-not-found"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-not-found"]').text()).toContain(zh.photosSvNotFound)
    expect(w.find('[data-test="sv-not-found-back"]').exists()).toBe(true)
  })

  // SP15-P2b Task 5: smart albums now live in Albums (Tasks 3/4) -- this button's
  // destination and label both changed (label: photosSvAllSmartViews → photosAlbumBack,
  // see the deviation comment above PhotosSmartViewDetail.vue's detail-bar back button).
  it('返回按钮 → router.push 到相册页', async () => {
    const { w, router } = await mountView('999', [makeSv({ id: 7 })])
    const pushSpy = vi.spyOn(router, 'push')
    await w.find('[data-test="sv-not-found-back"]').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/photos/albums')
  })

  it('byId 用 String 归一:store 里 id 是数字 7,route.params.id = "7" → 命中', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })]) // makeSv 的 id 字面量就是数字
    expect(w.find('[data-test="sv-not-found"]').exists()).toBe(false)
    expect(w.find('.sv-header').exists()).toBe(true)
  })
})

// fix round 1 · M5(结构规格 2:.sv-detail-bar 之前全无用例)────────────────────
describe('.sv-detail-bar —— 返回入口 + 最近更新时间', () => {
  it('evaluatedAt 非空 → photosSvLastUpdatedTime 渲染出 relTime 结果', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, evaluatedAt: '2026-07-31T00:00:00Z' })])
    const bar = w.find('.sv-detail-bar')
    // 用中文文案的固定前缀断言(值本身由 relTime,一个已单测过的纯函数负责,这里只钉住
    // "确实套用了 photosSvLastUpdatedTime 这个键、不是恒定的 '—'")。
    expect(bar.text()).toContain(zh.photosSvLastUpdatedTime.split('{time}')[0].trim())
    expect(bar.find('.sv-last-updated').text()).not.toBe(zh.photosSvLastUpdatedTime.replace('{time}', '—'))
  })

  it('evaluatedAt 为空 → 兜底显示 "—"(照搬 Vue2 :332 的兜底)', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, evaluatedAt: '' })])
    expect(w.find('.sv-last-updated').text()).toBe(zh.photosSvLastUpdatedTime.replace('{time}', '—'))
  })

  // SP15-P2b Task 5: the back button had no data-test before this task (dispatch-corrected
  // brief fact 3 -- the brief's original snippet assumed `sv-detail-back` already existed).
  // Destination changed to Albums (smart albums moved there in Tasks 3/4) and the label
  // changed from photosSvAllSmartViews to photosAlbumBack -- see the deviation comment
  // above this button in PhotosSmartViewDetail.vue.
  it('sends the back button to Albums, where smart albums now live', async () => {
    const { w, router } = await mountView('7', [makeSv({ id: 7 })])
    const pushSpy = vi.spyOn(router, 'push')
    const back = w.find('[data-test="sv-detail-back"]')
    expect(back.exists()).toBe(true)
    expect(back.text()).toContain(zh.photosAlbumBack)
    await back.trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/photos/albums')
  })
})

// fix round 1 · M5(brief §3 明文要求的挂载点断言,原版 grep 0 命中)──────────────
// P7a-T7 originally mounted a dedicated SmartViewConditionEditor component here (chips +
// an "Add condition" popover). Task 8 (SP15-P2c, ported from Vue2 NimoOS-UI 33b05636
// PhotosSmartViewDetail.vue:26-30/:700-710, "用户追加需求") removes the add entry as a
// deliberate product decision -- only removable chips survive. Once `add` was gone the
// component was down to a bare v-for with no local state, so it no longer earned its own
// file (see task-8-report.md for the full call) and folded back into this page. These
// tests were re-homed accordingly; the popover/suggestion/busy-forwarding tests that only
// exercised the add path had no capability left to cover and were deleted, not silently
// dropped (disposition table in the report).
describe('T7/T8: condition chips (remove-only, add entry removed)', () => {
  it('renders one removable chip per sv.conds entry', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, conds: ['scene: sunset', 'place: Japan'] })])
    const mountEl = w.find('[data-test="sv-header-conds"]')
    expect(mountEl.exists()).toBe(true)
    expect(mountEl.findAll('[data-test="sv-cond-chip"]').length).toBe(2)
  })

  it('no longer offers an add-condition entry (button and popover both gone)', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, conds: ['scene: sunset'] })])
    expect(w.find('[data-test="sv-cond-add-btn"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-cond-pop"]').exists()).toBe(false)
  })

  it('clicking a chip → store.updateSmartView receives the filtered conds (condsRaw), and the chip is actually gone once the round trip resolves', async () => {
    svc.photos.updateSmartView.mockResolvedValue(null)
    const { w } = await mountView('7', [makeSv({ id: 7, conds: ['scene: sunset', 'place: Japan'] })])
    await w.findAll('[data-test="sv-cond-chip"]')[0].trigger('click')
    await flushPromises()
    expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', { condsRaw: ['place: Japan'] })
    // End-to-end, not just "the call was made with the right args": the store's local merge
    // (smartViews.ts's `splice(i, 1, { ...old, ...patch })` fallback for a null response)
    // updates `sv.conds`, the page's `sv` computed follows it, and the chip actually
    // disappears from the DOM -- not merely still present with a stale click handler.
    await w.vm.$nextTick()
    const remaining = w.findAll('[data-test="sv-cond-chip"]')
    expect(remaining.length).toBe(1)
    expect(remaining[0].text()).toContain('place: Japan')
  })

  // SP15-P2c Task 8, coordinator review fix: re-homes the deleted
  // SmartViewConditionEditor.test.ts's "点叉(.sv-cond-x)→同样触发remove(冒泡到整个chip)".
  // The first pass of this task's disposition table claimed this was "covered structurally"
  // by the whole-chip click test above on the strength of the DOM being unchanged -- that
  // claim was never actually exercised by a test (clicking the parent span directly never
  // dispatches a click on the nested `.sv-cond-x`, so a future `@click.stop` added to the X
  // icon would silently break click-to-remove-via-X with nothing here to catch it). Fixed by
  // adding this test rather than just softening the prose.
  it('clicking the ✕ icon specifically (not just the chip body) still fires removeCond via bubbling', async () => {
    svc.photos.updateSmartView.mockResolvedValue(null)
    const { w } = await mountView('7', [makeSv({ id: 7, conds: ['scene: sunset', 'place: Japan'] })])
    await w.find('.sv-cond-x').trigger('click')
    await flushPromises()
    expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', { condsRaw: ['place: Japan'] })
  })

  it('store.patchBusy blocks a second click on the same chip from firing another PATCH', async () => {
    let resolveFn: ((v: unknown) => void) | undefined
    svc.photos.updateSmartView.mockImplementation(() => new Promise((res) => { resolveFn = res }))
    const { w } = await mountView('7', [makeSv({ id: 7, conds: ['scene: sunset', 'place: Japan'] })])
    const chip = w.findAll('[data-test="sv-cond-chip"]')[0]
    await chip.trigger('click')
    expect(svc.photos.updateSmartView).toHaveBeenCalledTimes(1)
    expect(chip.attributes('data-busy')).toBe('true')
    await chip.trigger('click')
    expect(svc.photos.updateSmartView).toHaveBeenCalledTimes(1)
    resolveFn?.(null)
    await flushPromises()
  })

  it('leaves no orphaned add-condition identifiers behind in the page source', () => {
    for (const ident of [
      'openAddCond', 'closeAddCond', 'submitCond', 'addCondSuggestion', 'addCond',
      'SmartViewConditionEditor',
    ]) {
      expect(photosSmartViewDetailRaw).not.toContain(ident)
    }
  })
})

// P7a-T8:sv-side-mount 的 stub 断言("空壳,children.length===0")在这里升级成真组件
// 断言——SmartViewSidePanel/SmartViewActivityFeed 自己的结构/交互/样式覆盖已在
// 各自的 __tests__ 文件里,这里只钉住"宿主接线对不对":两个组件都真的挂进去了、
// sv/busy/activity 三个 prop 来源对不对、patch emit 翻译成 store.updateSmartView(id, patch)
// 的正确形状(不需要额外 .then(loadDetail),同 addCond/removeCond 的道理)。
describe('T8:右栏(挂载点兑现为真组件)', () => {
  it('sv-side-mount 下渲染 SmartViewSidePanel(3 段)+ SmartViewActivityFeed(1 段)', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    const mountEl = w.find('[data-test="sv-side-mount"]')
    expect(mountEl.exists()).toBe(true)
    const sections = mountEl.findAll('.sv-side-section')
    expect(sections).toHaveLength(4)
    expect(mountEl.text()).toContain(zh.photosSvQualityThreshold)
    expect(mountEl.text()).toContain(zh.photosSvSettingsSection)
    expect(mountEl.text()).toContain(zh.photosSvStats)
    expect(mountEl.text()).toContain(zh.photosSvActivity)
  })

  it('活动流拿到 store.activity(getSmartViewActivity 的响应)', async () => {
    svc.photos.getSmartViewActivity.mockResolvedValue([
      { id: 'a1', eventType: 'created', detail: '', assetIds: [], occurredAt: '2026-07-31T00:00:00Z' },
    ])
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    const mountEl = w.find('[data-test="sv-side-mount"]')
    expect(mountEl.text()).toContain(zh.photosSvSmartViewCreated)
  })

  describe('阈值 patch → store.updateSmartView(300ms debounce)', () => {
    // fix round 1 · M5:useRealTimers 挪到 afterEach(此前写在 it 末尾,断言先失败时假
    // 时钟会漏给同文件后续用例)。
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('拖动阈值滑块 → 300ms 后 store.updateSmartView 收到 { threshold }', async () => {
      svc.photos.updateSmartView.mockResolvedValue(null)
      const { w } = await mountView('7', [makeSv({ id: 7, threshold: 72 })])
      const range = w.find('[data-test="pts-range"]')
      await range.setValue('92')
      await vi.advanceTimersByTimeAsync(300)
      expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', { threshold: 92 })
    })

    // fix round 1 · I2 补充:宿主 `:busy="store.patchBusy"` 这条 prop 来源此前零用例。
    // updateSmartView 挂起期间 store.patchBusy=true,应该转发进 SmartViewSidePanel,
    // 反映到两个开关的 data-busy 属性上。
    it('store.patchBusy=true 期间 → SmartViewSidePanel 的两个开关都带 data-busy="true"', async () => {
      let resolveFn: ((v: unknown) => void) | undefined
      svc.photos.updateSmartView.mockImplementation(() => new Promise((res) => { resolveFn = res }))
      const { w } = await mountView('7', [makeSv({ id: 7, threshold: 72 })])
      const range = w.find('[data-test="pts-range"]')
      await range.setValue('92')
      await vi.advanceTimersByTimeAsync(300) // 触发 onSidePatch → store.updateSmartView(挂起)
      await flushPromises()
      expect(w.find('[data-test="sv-switch-live"]').attributes('data-busy')).toBe('true')
      expect(w.find('[data-test="sv-switch-videos"]').attributes('data-busy')).toBe('true')
      resolveFn?.(null)
      await flushPromises()
      expect(w.find('[data-test="sv-switch-live"]').attributes('data-busy')).toBe('false')
    })
  })

  it('点「自动添加新匹配」开关 → store.updateSmartView 收到 { live: true }(sv.live=false)', async () => {
    svc.photos.updateSmartView.mockResolvedValue(null)
    const { w } = await mountView('7', [makeSv({ id: 7, live: false })])
    await w.find('[data-test="sv-switch-live"]').trigger('click')
    await flushPromises()
    expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', { live: true })
  })
})

// ── onMounted 加载顺序 ───────────────────────────────────────────────────
describe('onMounted 加载顺序', () => {
  it('listLoaded 为假时:先 fetchSmartViews(listSmartViews)再 loadDetail(getSmartViewAssets)', async () => {
    const order: string[] = []
    svc.photos.listSmartViews.mockImplementation(async () => { order.push('list'); return [makeSv({ id: 7 })] })
    svc.photos.getSmartViewAssets.mockImplementation(async () => { order.push('assets'); return [] })
    const router = makeRouter('/photos/smart-views/7')
    await router.isReady()
    mount(PhotosSmartViewDetail, { global: { plugins: [i18n, router] } })
    await flushPromises()
    expect(order[0]).toBe('list')
    expect(order).toContain('assets')
  })

  it('listLoaded 为真时(已有另一实例预热过 store):只 loadDetail,不重新 fetchSmartViews', async () => {
    const store = usePhotosSmartViews()
    svc.photos.listSmartViews.mockResolvedValue([makeSv({ id: 7 })])
    await store.fetchSmartViews()
    svc.photos.listSmartViews.mockClear()
    const router = makeRouter('/photos/smart-views/7')
    await router.isReady()
    mount(PhotosSmartViewDetail, { global: { plugins: [i18n, router] } })
    await flushPromises()
    expect(svc.photos.listSmartViews).not.toHaveBeenCalled()
    expect(svc.photos.getSmartViewAssets).toHaveBeenCalled()
  })
})

// ── watch route.params.id ────────────────────────────────────────────────
describe('watch route.params.id', () => {
  it('id 从 7 变成 8 → loadDetail("8") 被调(getSmartViewAssets 带上新 id)', async () => {
    const { w, router } = await mountView('7', [makeSv({ id: 7 }), makeSv({ id: 8, name: 'Food' })])
    svc.photos.getSmartViewAssets.mockClear()
    await router.push('/photos/smart-views/8')
    await flushPromises()
    expect(svc.photos.getSmartViewAssets).toHaveBeenCalled()
    const calledIds = svc.photos.getSmartViewAssets.mock.calls.map((c) => c[0])
    expect(calledIds.every((id) => id === '8')).toBe(true)
    expect(w.find('[data-test="sv-title-view"]').text()).toBe('Food')
  })
})

// ── 改名 ──────────────────────────────────────────────────────────────────
describe('改名', () => {
  it('点标题 → 出现 input 且 titleDraft 预填当前名', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    await w.find('[data-test="sv-title-view"]').trigger('click')
    const input = w.find('[data-test="sv-title-input"]')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('Sunsets')
  })

  it('Enter 提交新名 → updateSmartView(id, {name}) 被调;store 回写后编辑态退出', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    svc.photos.updateSmartView.mockResolvedValue({ ...makeSv({ id: 7, name: '日落时分' }) })
    await w.find('[data-test="sv-title-view"]').trigger('click')
    const input = w.find('[data-test="sv-title-input"]')
    await input.setValue('日落时分')
    await input.trigger('keydown.enter')
    await flushPromises()
    await w.vm.$nextTick()
    expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', expect.objectContaining({ name: '日落时分' }))
    expect(w.find('[data-test="sv-title-input"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-title-view"]').text()).toBe('日落时分')
  })

  it('updateSmartView reject → 编辑态保持(input 仍在)', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    svc.photos.updateSmartView.mockRejectedValue(new Error('500'))
    await w.find('[data-test="sv-title-view"]').trigger('click')
    const input = w.find('[data-test="sv-title-input"]')
    await input.setValue('日落时分')
    await input.trigger('keydown.enter')
    await flushPromises()
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-title-input"]').exists()).toBe(true)
    expect(useToast().msg).toBe(zh.photosSvRenameFailed)
  })

  it('名字未变(trim 后相同)→ updateSmartView 未被调,且退出编辑态', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    await w.find('[data-test="sv-title-view"]').trigger('click')
    const input = w.find('[data-test="sv-title-input"]')
    await input.setValue('  Sunsets  ')
    await input.trigger('keydown.enter')
    await flushPromises()
    expect(svc.photos.updateSmartView).not.toHaveBeenCalled()
    expect(w.find('[data-test="sv-title-input"]').exists()).toBe(false)
  })

  it('Esc → 退出编辑态且不提交', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    await w.find('[data-test="sv-title-view"]').trigger('click')
    const input = w.find('[data-test="sv-title-input"]')
    await input.setValue('乱改的名字')
    await input.trigger('keydown.esc')
    expect(svc.photos.updateSmartView).not.toHaveBeenCalled()
    expect(w.find('[data-test="sv-title-input"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-title-view"]').text()).toBe('Sunsets')
  })
})

// ── paused 派生量(§7e-2 主守卫)─────────────────────────────────────────────
describe('paused 是派生量', () => {
  it('store 里 live:false → pill 显示 photosSvPaused', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, live: false })])
    expect(w.find('[data-test="sv-live-pill"]').text()).toContain(zh.photosSvPaused)
  })

  it('点 pill → updateSmartView(id, {live:true})', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, live: false })])
    svc.photos.updateSmartView.mockResolvedValue(null)
    await w.find('[data-test="sv-live-pill"]').trigger('click')
    expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', { live: true })
  })

  it('§7e-2 主守卫:store 更新后(不重新 mount)pill 文案自动跟着变', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, live: false })])
    expect(w.find('[data-test="sv-live-pill"]').text()).toContain(zh.photosSvPaused)
    // 直接改 store 里那条 sv 的 live 字段,不重新 mount、不经过组件的 updateSmartView 调用——
    // 模拟"另一路径(如轮询/其它标签页)已经把后端状态改了"。Vue2 做不到这一点(它靠 prop
    // 对象引用 + 一整套本地同步机制),New-UI 因为 sv 是 computed(byId(id)) 现取,天然响应。
    const store = usePhotosSmartViews()
    const idx = store.smartViews.findIndex((s) => s.id === '7')
    store.smartViews[idx] = { ...store.smartViews[idx], live: true }
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-live-pill"]').text()).toContain(zh.photosSvLive)
  })

  it('pill 键盘可达:tabindex="0" 存在,keydown.enter 触发同一个 handler', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, live: false })])
    svc.photos.updateSmartView.mockResolvedValue(null)
    const pill = w.find('[data-test="sv-live-pill"]')
    expect(pill.attributes('tabindex')).toBe('0')
    // VTU 的 `.trigger('keydown.enter')` 修饰符简写会把 `.key` 设成小写 'enter'(只有
    // `.code` 才是大写 'Enter'),与真实浏览器的 KeyboardEvent.key === 'Enter' 不符——这里
    // 显式传 key 字段,拿到与真实浏览器一致的大写值,不依赖 VTU 修饰符简写的大小写行为。
    await pill.trigger('keydown', { key: 'Enter' })
    expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', { live: true })
  })

  it('updateSmartView reject → 更新失败 toast', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, live: false })])
    svc.photos.updateSmartView.mockRejectedValue(new Error('500'))
    await w.find('[data-test="sv-live-pill"]').trigger('click')
    await flushPromises()
    expect(useToast().msg).toBe(zh.photosSvUpdateFailed)
  })
})

// ── 4 统计 ────────────────────────────────────────────────────────────────
describe('header 统计四格', () => {
  it('addedThisWeek === 0 → delta 那项不渲染', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    expect(w.find('[data-test="sv-stat-delta"]').exists()).toBe(false)
  })

  it('addedThisWeek > 0 → delta 项渲染 +n', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 5 })])
    expect(w.find('[data-test="sv-stat-delta"]').text()).toContain('+5')
  })

  it('median 缺(0)→ 显示 0%', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, median: 0 })])
    expect(w.find('[data-test="sv-stat-median"]').text()).toContain('0%')
  })

  it('formatMB 三档:0 → "0 MB"', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, storageBytes: 0 })])
    expect(w.find('[data-test="sv-stat-storage"]').text()).toContain('0 MB')
  })

  it('formatMB 三档:1572864 → 四舍五入 "2 MB"', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, storageBytes: 1572864 })])
    expect(w.find('[data-test="sv-stat-storage"]').text()).toContain('2 MB')
  })

  it('formatMB 三档:2147483648 → "2.0 GB"', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, storageBytes: 2147483648 })])
    expect(w.find('[data-test="sv-stat-storage"]').text()).toContain('2.0 GB')
  })
})

// ── SP15-P2c Task 6: header action row (sort capsule / pause / edit / density) ────────────
// Target: 33b05636:src/views/Photos/PhotosSmartViewDetail.vue:49-90. Sort and density are new
// construction on this page -- it never had either control -- so these tests describe the
// target's row, not a rearrangement of what was here.
describe('SP15-P2c Task 6: header action row', () => {
  /** Opens the sort menu and returns the option button carrying `sortId`. */
  async function pickSortOption(w: ReturnType<typeof mount>, sortId: string) {
    await w.find('[data-test="sv-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    const item = w.findAll('[data-test="sv-sort-item"]').find((n) => n.attributes('data-sort-id') === sortId)!
    await item.trigger('click')
    await w.vm.$nextTick()
  }

  it('renders sort and density in the header outside edit mode', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    expect(w.find('.sv-actions .group').text()).toBe(zh.photosAlbumSort)
    expect(w.find('[data-test="sv-sort-btn"]').text()).toContain(zh.photosSortScore)
    expect(w.findAll('.density button')).toHaveLength(2)
    // The target's order, element by element: Sort label -> capsule -> separator -> Pause ->
    // Edit -> separator -> density. Asserting the sequence is the only way a reordering is
    // caught; each element existing on its own says nothing about where it sits.
    const row = w.findAll('.sv-actions > *').map((n) => {
      const cls = n.classes()
      return n.attributes('data-test') ?? (cls.includes('group') ? 'group' : cls[0])
    })
    expect(row.slice(0, 7)).toEqual([
      'group',
      'sv-sort-wrap',
      'album-detail-actions-sep',
      'sv-action-pause',
      'sv-edit-toggle',
      'album-detail-actions-sep',
      'density',
    ])
  })

  it('offers match score and date taken as the two sort options', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    const items = w.findAll('[data-test="sv-sort-item"]')
    expect(items.map((n) => n.attributes('data-sort-id'))).toEqual(['score', 'taken'])
    expect(items.map((n) => n.text())).toEqual([zh.photosSortScore, zh.photosAlbumSortTaken])
    // Score is the default (the backend already returns match_score DESC), so it is the one
    // marked active before anything is picked.
    expect(items[0].attributes('data-active')).toBe('true')
    expect(items[1].attributes('data-active')).toBe('false')
  })

  // Whole-branch review, Minor 7: nothing guarded the check glyph / empty-spacer pair on either
  // detail page, and the album page's copy had already drifted from the target once. The spacer
  // is the half a future edit drops, and dropping it shifts every label between the active and
  // inactive rows -- so assert both halves: every option carries exactly one slot, and only the
  // active one holds a glyph. Mirror of the album page's own assertion.
  it('gives every sort option a check slot and the glyph only to the active one', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-sort-btn"]').trigger('click')
    await w.vm.$nextTick()

    const items = w.findAll('[data-test="sv-sort-item"]')
    expect(items.length).toBeGreaterThan(1)
    for (const item of items) {
      expect(item.findAll('.sv-sort-check')).toHaveLength(1)
      const hasGlyph = item.find('.sv-sort-check').element.tagName.toLowerCase() === 'svg'
      expect(hasGlyph).toBe(item.attributes('data-active') === 'true')
    }
    expect(items.filter((n) => n.attributes('data-active') === 'true')).toHaveLength(1)
  })

  it('re-sorts both grids by taken date when that option is picked, and relabels the capsule', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      // Deliberately handed back in the backend's own (match score) order, oldest first, so
      // "sorted by taken date desc" is a different sequence from "left alone".
      const rows = [
        asset('old', { takenAt: '2026-01-01T00:00:00Z' }),
        asset('new', { takenAt: '2026-06-01T00:00:00Z' }),
      ]
      return opts?.recent ? rows : rows
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 2 })])
    const ids = (sel: string) => w.findAll(sel).map((n) => n.find('img').attributes('src'))
    expect(ids('[data-test="sv-all-tile"]')).toEqual(['mock://thumb/old/large', 'mock://thumb/new/large'])

    await pickSortOption(w, 'taken')

    expect(ids('[data-test="sv-all-tile"]')).toEqual(['mock://thumb/new/large', 'mock://thumb/old/large'])
    expect(ids('[data-test="sv-recent-tile"]')).toEqual(['mock://thumb/new/large', 'mock://thumb/old/large'])
    expect(w.find('[data-test="sv-sort-btn"]').text()).toContain(zh.photosAlbumSortTaken)
    // Picking closes the menu (Vue2 pickSort).
    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(false)
  })

  // SP15-P2c Task 9 (target :96/:107 -- onTileClick(p, list), photoSet/recentSet passed from
  // the template). Before this task, both grids' tiles shared one handler that always handed
  // the lightbox `store.matchedAssets` -- the backend's match-score order -- regardless of
  // what Sort was showing. The fixture below is built so the two orders genuinely diverge:
  // "all matches" comes back m1/m2/m3 (score order) but taken-date-desc reorders it to
  // m2/m3/m1, so a lightbox handed the stale order would open on the wrong photo.
  it('hands the lightbox the order the "all matches" grid is showing, not the backend order', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      const matched = [
        asset('m1', { takenAt: '2026-01-10T00:00:00Z' }),
        asset('m2', { takenAt: '2026-03-05T00:00:00Z' }),
        asset('m3', { takenAt: '2026-02-01T00:00:00Z' }),
      ]
      return opts?.recent ? [] : matched
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    await pickSortOption(w, 'taken')
    // Sorted (taken desc): m2, m3, m1 -- the third tile is m1, not m3.
    await w.findAll('[data-test="sv-all-tile"]')[2].trigger('click')

    expect(lbMock.openAt).toHaveBeenCalledTimes(1)
    const call = lbMock.openAt.mock.calls[0]
    expect((call[0] as { id: string }).id).toBe('m1')
    expect((call[1] as Array<{ id: string }>).map((p) => p.id)).toEqual(['m2', 'm3', 'm1'])
    // startMs, not an index -- untouched by this task (useLightbox.openAt computes the index
    // itself from the list and the photo).
    expect(call[2]).toBe(0)
  })

  // The "recently added" band has its own Sort-applied order (recentSet), independent of the
  // "all matches" band's (matchedSet). A fix that wires both grids' clicks to the same list --
  // e.g. always matchedSet -- would pass this test's sibling above but fail here, because the
  // two lists are built to have no assets in common.
  it('keeps the "recently added" grid on its own sorted list, not the all-matches one', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      const matched = [
        asset('m1', { takenAt: '2026-01-10T00:00:00Z' }),
        asset('m2', { takenAt: '2026-03-05T00:00:00Z' }),
        asset('m3', { takenAt: '2026-02-01T00:00:00Z' }),
      ]
      const recent = [
        asset('r2', { takenAt: '2026-01-01T00:00:00Z' }),
        asset('r1', { takenAt: '2026-04-01T00:00:00Z' }),
      ]
      return opts?.recent ? recent : matched
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 2 })])
    await pickSortOption(w, 'taken')
    // Sorted (taken desc): r1, r2 -- the backend handed them back the other way round.
    await w.findAll('[data-test="sv-recent-tile"]')[0].trigger('click')

    expect(lbMock.openAt).toHaveBeenCalledTimes(1)
    const call = lbMock.openAt.mock.calls[0]
    expect((call[0] as { id: string }).id).toBe('r1')
    expect((call[1] as Array<{ id: string }>).map((p) => p.id)).toEqual(['r1', 'r2'])
  })

  it('switches both grids to the compact density', async () => {
    svc.photos.getSmartViewAssets.mockResolvedValue([asset('a1')])
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 1 })])
    expect(w.find('[data-test="sv-all-grid"]').classes()).not.toContain('is-compact')
    expect(w.find('[data-test="sv-density-comfortable"]').attributes('data-active')).toBe('true')

    await w.find('[data-test="sv-density-compact"]').trigger('click')
    await w.vm.$nextTick()

    expect(w.find('[data-test="sv-all-grid"]').classes()).toContain('is-compact')
    expect(w.find('[data-test="sv-recent-grid"]').classes()).toContain('is-compact')
    expect(w.find('[data-test="sv-density-compact"]').attributes('data-active')).toBe('true')
    expect(w.find('[data-test="sv-density-comfortable"]').attributes('data-active')).toBe('false')
  })

  it('keeps pause and edit visible in edit mode while sort and density disappear', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    expect(w.find('[data-test="sv-sort-btn"]').exists()).toBe(true)
    expect(w.find('.density').exists()).toBe(true)

    await w.find('[data-test="sv-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()

    expect(w.find('[data-test="sv-sort-btn"]').exists()).toBe(false)
    expect(w.find('.density').exists()).toBe(false)
    expect(w.find('[data-test="sv-action-pause"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-edit-toggle"]').exists()).toBe(true)
    // Each separator travels with the group it parts, so neither is left dangling.
    expect(w.findAll('.album-detail-actions-sep')).toHaveLength(0)
  })

  it('enters and leaves edit mode from the single edit toggle', async () => {
    svc.photos.getSmartViewAssets.mockResolvedValue([asset('a1')])
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    const toggle = () => w.find('[data-test="sv-edit-toggle"]')
    expect(toggle().text()).toBe(zh.photosAlbumEdit)
    expect(toggle().attributes('data-open')).toBe('false')
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(false)

    await toggle().trigger('click')
    await w.vm.$nextTick()
    expect(toggle().text()).toBe(zh.photosAlbumDone)
    expect(toggle().attributes('data-open')).toBe('true')
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(true)

    await toggle().trigger('click')
    await w.vm.$nextTick()
    expect(toggle().text()).toBe(zh.photosAlbumEdit)
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(false)
  })

  it('shows add-photos in the bottom select bar rather than the header', async () => {
    svc.photos.getSmartViewAssets.mockResolvedValue([asset('a1')])
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    expect(w.find('.sv-actions [data-test="sv-add-photos"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-add-photos"]').exists()).toBe(false)

    await w.find('[data-test="sv-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()

    // In the bar, and nowhere else -- and reachable with nothing selected, which is the whole
    // reason the bar is gated on edit alone (target :318).
    expect(w.find('[data-test="sv-select-bar"] [data-test="sv-add-photos"]').exists()).toBe(true)
    expect(w.findAll('[data-test="sv-add-photos"]')).toHaveLength(1)
    expect(w.find('[data-test="sv-select-bar"]').text()).toContain(zh.photosSvClickToSelect)

    await w.find('[data-test="sv-add-photos"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'PhotosLibraryPicker' }).props('open')).toBe(true)
  })

  it('disables Remove until something is selected', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => (opts?.recent ? [] : [asset('a1')]))
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    await w.find('[data-test="sv-edit-toggle"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-remove-selected"]').attributes('disabled')).toBeDefined()

    await w.find('[data-test="sv-all-tile"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-remove-selected"]').attributes('disabled')).toBeUndefined()
    expect(w.find('[data-test="sv-select-bar"]').text()).toContain(zh.photosSelectedCount.replace('{count}', '1'))
  })

  it('closes the sort menu on an outside mousedown and on Escape', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(true)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(false)

    await w.find('[data-test="sv-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(false)
  })
})

// ── 「在搜索中细化」——T16 兑现:去 disabled,接 router.push ─────────────────
describe('「在搜索中细化」按钮(T16 已接线)', () => {
  it('不再 disabled,也没有 photosSvSearchPending 的 title', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    const btn = w.find('[data-test="sv-action-refine"]')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.attributes('title')).toBeUndefined()
  })

  it('点击 → router.push({ path: "/photos/search", query: { q: sv.name } })', async () => {
    const { w, router } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    const pushSpy = vi.spyOn(router, 'push')
    await w.find('[data-test="sv-action-refine"]').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith({ path: '/photos/search', query: { q: 'Sunsets' } })
  })

  it('photosSvSearchPending 键已从两个 locale 删除(死键随 T16 一并清理)', () => {
    expect('photosSvSearchPending' in zh).toBe(false)
    expect('photosSvSearchPending' in en).toBe(false)
  })
})

// ── more menu (unified into five entries as of Task 7; the Export button/menu is folded in
//    entirely, see the "SP15-P2c Task 7" describe block below) ─────────────────────────────
describe('more menu', () => {
  // Re-homed (Task 7): the old "菜单出现三项(重命名/复制/删除)" case is now a strict subset
  // of "renders exactly five menu entries in the target order" below, which also pins the
  // order -- this one stays only because it predates Convert/ZIP and is still true unchanged.
  it('opens the more menu and shows at least three entries (rename / duplicate / delete)', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-more-rename"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-more-duplicate"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-more-delete"]').exists()).toBe(true)
  })

  // Re-homed (Task 7): was '点导出按钮...' + 'photosSvNPhotosMbMb...', reading
  // sv-export-toggle/sv-export-zip. The export button is gone; ZIP is now the third entry of
  // the unified menu, reached through sv-more-toggle, and its data-test is sv-more-zip.
  it('photosSvNPhotosMbMb 的 {mb} 在 count=1000 时是千分位 "3,200"', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, count: 1000 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-more-zip"]').text()).toContain('3,200')
  })
})

// ── SP15-P2c Task 7: sidebar action section + unified five-entry "..." menu ────────────────
// Target: 33b05636:src/views/Photos/PhotosSmartViewDetail.vue:127-225. Refine in Search and
// the "..." menu move from the header row (where Task 6 parked them) into a new
// `.sv-side-actions` container at the top of the sidebar, matching PhotosAlbumDetail.vue's own
// (Task 5). The Export button/menu is gone entirely: ZIP folds into the unified menu as its
// third entry, and "Save as static album" (sv-export-album / exportAlbumAction) is deleted --
// the target's own history (933a7d3a comment, restated in PhotosSmartViewDetail.vue's header)
// records that Vue2 killed this same button in the same commit range and kept only the backend
// capability, which is exactly the call made here too (see the component's own comment on the
// deletion for the full trail).
describe('SP15-P2c Task 7: sidebar action section + unified menu', () => {
  it('renders the sidebar action section with refine and the more button', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    const side = w.find('[data-test="sv-side-mount"]')
    const actions = side.find('.sv-side-actions')
    expect(actions.exists()).toBe(true)
    expect(actions.find('[data-test="sv-action-refine"]').exists()).toBe(true)
    expect(actions.find('[data-test="sv-more-toggle"]').exists()).toBe(true)
  })

  it('renders exactly five menu entries in the target order', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.vm.$nextTick()
    const items = w.find('[data-test="sv-more-menu"]').findAll('.sv-export-item')
    expect(items).toHaveLength(5)
    expect(items.map((i) => i.attributes('data-test'))).toEqual([
      'sv-more-rename',
      'sv-more-duplicate',
      'sv-more-zip',
      'sv-more-convert',
      'sv-more-delete',
    ])
    // Review fix: the previous version of this test only pinned the `data-test` order, which
    // says nothing about the rendered copy -- exactly how the Convert/Delete titles drifted
    // from the target's own shortened copy (33b05636 :143-147's own "shortened so the two
    // pages read the same" comment) without any gate catching it, until a human read the diff.
    // Titles here must match the target's short-form copy (verified against
    // 33b05636:src/assets/lang/zh_CN.json's `Convert`/`Delete` entries: 转换/删除); descs are
    // deliberately excluded -- only the titles were shortened in the target's own change.
    expect(items.map((i) => i.find('.sv-export-title').text())).toEqual([
      zh.photosSvRename,
      zh.photosSvDuplicate,
      zh.photosFavExport,
      zh.photosAlbumMenuConvert,
      zh.photosDelete,
    ])
  })

  it('no longer renders a separate export section in the menu', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    expect(w.find('[data-test="sv-export-toggle"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-export-menu"]').exists()).toBe(false)
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    // "Save as static album" is a deleted capability, not something that moved -- see the
    // describe block's own header comment.
    expect(w.find('[data-test="sv-export-album"]').exists()).toBe(false)
  })

  it('applies the fixed position style when the menu opens', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.vm.$nextTick()
    const style = w.find('[data-test="sv-more-menu"]').attributes('style') ?? ''
    expect(style).toContain('position: fixed')
  })

  // Re-homed (Task 7): was '点菜单外部(mousedown,bubbles:true)→ 关闭' in the export-menu
  // describe block, reading sv-export-toggle/sv-export-menu -- both gone. Same behaviour, new
  // trigger.
  it('still closes the menu on an outside click', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-more-menu"]').exists()).toBe(true)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-more-menu"]').exists()).toBe(false)
  })

  // Regression guard against E10 recurring (SP15-P2b's Important finding: the convert
  // confirmation's primary-action colour and its Escape guard). The full flow (colour, Escape
  // mid-flight, 409 copy, navigation) is already covered end-to-end by the "convert to regular
  // album" describe block below Task 6's edit; this test's job is narrower and specific to
  // Task 7's relocation -- proving the *new* sidebar entry point still reaches that flow at all.
  it('keeps the convert-to-album confirmation flow working from the new entry', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-convert"]').trigger('click')
    await w.vm.$nextTick()
    const confirm = w.find('[data-test="sv-convert-confirm"]')
    expect(confirm.exists()).toBe(true)
    const ok = confirm.find('[data-test="sv-convert-ok"]')
    expect(ok.classes()).toContain('primary')
    expect(ok.classes()).not.toContain('danger')
  })

  // Folded-in finding (b): a keyboard activation of Edit/Done (Space/Enter on a focused
  // button) fires a `click` without a `mousedown` -- the event onDocumentMouseDown listens
  // for to close the sort menu. VTU's own `.trigger('click')` has the identical shape (no
  // synthetic mousedown either), so this reproduces the real bug without any extra event
  // plumbing: open the sort menu, flip edit mode on and back off through the toggle alone, and
  // check the sort popup does not silently reappear.
  it('does not leave the sort menu stuck open after toggling edit mode via the Edit button', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-sort-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(true)

    await w.find('[data-test="sv-edit-toggle"]').trigger('click') // enter edit mode
    await w.vm.$nextTick()
    await w.find('[data-test="sv-edit-toggle"]').trigger('click') // leave edit mode again
    await w.vm.$nextTick()

    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(false)
  })
})

// ── 导出 ZIP(§7e-1 修 401)───────────────────────────────────────────────
describe('导出 ZIP', () => {
  function mockFetchOk() {
    const blob = new Blob(['zipdata'])
    return vi.fn().mockResolvedValue({ ok: true, status: 200, blob: () => Promise.resolve(blob) })
  }

  it('走 fetch 带 Authorization 头,不走 window.location.href', async () => {
    const fetchSpy = mockFetchOk()
    vi.stubGlobal('fetch', fetchSpy)
    const createObjectURL = vi.fn(() => 'blob://x')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const hrefSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, set href(v: string) { hrefSpy(v) }, get href() { return 'unchanged' } },
      writable: true,
    })

    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets', count: 1000 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-zip"]').trigger('click')
    await flushPromises()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain('/export')
    // fix round 1 · C1(Critical):这个端点只注册了 POST(route/v1/smartviews.go:34),
    // 默认 GET 会被 Echo 拒成 405——不带这条断言,方法写错也测不出来(评审的反向变异实测过)。
    expect((opts as { method?: string }).method).toBe('POST')
    expect((opts as { headers: Record<string, string> }).headers.Authorization).toBe('tok-123')
    expect(hrefSpy).not.toHaveBeenCalled()
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })

  it('<a download> 的 download 属性含 .zip', async () => {
    const fetchSpy = mockFetchOk()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob://x'), revokeObjectURL: vi.fn() })
    const appendSpy = vi.spyOn(document.body, 'appendChild')

    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-zip"]').trigger('click')
    await flushPromises()

    const anchor = appendSpy.mock.calls.map((c) => c[0]).find((n) => (n as HTMLElement).tagName === 'A') as HTMLAnchorElement
    expect(anchor).toBeDefined()
    expect(anchor.download).toContain('.zip')

    vi.unstubAllGlobals()
  })

  it('fetch 返 401(!ok)→ toast 是 photosSvExportFailed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-zip"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sv-export-toast"]').text()).toContain(zh.photosFavExportFailed)
    vi.unstubAllGlobals()
  })
})

// SP15-P2c Task 7: the '导出相册' describe block (Save as static album, exportAlbumAction/
// sv-export-album) is deleted here, not re-homed -- the capability itself is gone. The Vue2
// target's own history records the same deletion in the same commit range (see
// PhotosSmartViewDetail.vue's comment on `exportAlbumAction`'s removal for the full trail);
// this page's Convert entry already does the equivalent job (freezing the current matches
// into a regular album), so nothing the user could do is lost.

// ── 删除 ──────────────────────────────────────────────────────────────────
describe('删除智能视图', () => {
  it('点 more → 删除项 → 确认弹窗出现', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-delete"]').trigger('click')
    expect(w.find('[data-test="sv-confirm-scrim"]').exists()).toBe(true)
  })

  // SP15-P2b Task 5: after deletion the user lands on Albums, not the now-Moments-only
  // smart-views route (smart albums moved to Albums in Tasks 3/4).
  it('点确认 → deleteSmartView 被调 → router.push 到相册页 + 带撤销的 toast', async () => {
    svc.photos.deleteSmartView.mockResolvedValue({})
    const { w, router } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    const pushSpy = vi.spyOn(router, 'push')
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-delete"]').trigger('click')
    await w.find('[data-test="sv-confirm-ok"]').trigger('click')
    await flushPromises()
    expect(svc.photos.deleteSmartView).toHaveBeenCalledWith('7')
    expect(pushSpy).toHaveBeenCalledWith('/photos/albums')
    expect(useToast().msg).toContain('Sunsets')
    const last = useToast().toasts[useToast().toasts.length - 1]
    expect(last.action?.label).toBe(zh.photosTrashUndo)
    expect(typeof last.action?.onClick).toBe('function')
  })

  // fix 波 F3(终审必修项):撤销回调此前是 `void store.restoreSmartView(...)`——底层
  // service.photos.createSmartView reject 时,store 的 restoreSmartView 会 throw
  // (smartViews.ts:303-304),`void` 调用完全不接这个 throw,界面上什么反馈都没有,
  // 变成未处理的 promise rejection。这里钉住:点撤销 → 底层调用失败 → console.error 记录
  // + 弹出失败 toast(复用 P3 回收站的 photosTrashRestoreFailed),不抛出未处理 rejection。
  it('撤销失败(restoreSmartView reject)→ console.error 记录 + 弹失败 toast,不抛未处理 rejection', async () => {
    svc.photos.deleteSmartView.mockResolvedValue({})
    svc.photos.createSmartView.mockRejectedValue(new Error('500'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-delete"]').trigger('click')
    await w.find('[data-test="sv-confirm-ok"]').trigger('click')
    await flushPromises()
    const last = useToast().toasts[useToast().toasts.length - 1]
    expect(last.action).toBeDefined()

    await expect(
      Promise.resolve().then(() => last.action?.onClick()),
    ).resolves.not.toThrow()
    await flushPromises()

    expect(errSpy).toHaveBeenCalledWith('[photos-smartviews] undo delete', expect.any(Error))
    expect(useToast().msg).toBe(zh.photosTrashRestoreFailed)
  })

  it('deleteSmartView reject → 不跳转 + toast', async () => {
    svc.photos.deleteSmartView.mockRejectedValue(new Error('500'))
    const { w, router } = await mountView('7', [makeSv({ id: 7 })])
    const pushSpy = vi.spyOn(router, 'push')
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-delete"]').trigger('click')
    await w.find('[data-test="sv-confirm-ok"]').trigger('click')
    await flushPromises()
    expect(pushSpy).not.toHaveBeenCalledWith('/photos/albums')
    expect(useToast().msg).toBe(zh.photosSvDeleteFailed)
  })
})

// ── 复制 ──────────────────────────────────────────────────────────────────
describe('复制', () => {
  it('duplicateSmartView 被调 + toast', async () => {
    svc.photos.duplicateSmartView.mockResolvedValue(makeSv({ id: 9, name: 'Sunsets copy' }))
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-duplicate"]').trigger('click')
    await flushPromises()
    expect(svc.photos.duplicateSmartView).toHaveBeenCalledWith('7')
    expect(useToast().msg).toContain('Sunsets')
  })

  it('duplicateSmartView reject → toast 失败文案', async () => {
    svc.photos.duplicateSmartView.mockRejectedValue(new Error('500'))
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-duplicate"]').trigger('click')
    await flushPromises()
    expect(useToast().msg).toBe(zh.photosSvDuplicateFailed)
  })
})

// ── SP15-P2b Task 8: smart album → regular album (reverse of Task 7's convertFromAlbum) ──
describe('convert to regular album', () => {
  let convertFromSmartView: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    convertFromSmartView = vi.spyOn(usePhotosAlbums(), 'convertFromSmartView')
  })

  async function openConvertConfirm(w: Awaited<ReturnType<typeof mountView>>['w']) {
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-convert"]').trigger('click')
  }

  it('offers Convert to regular album above the destructive separator', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    const menu = w.find('[data-test="sv-more-menu"]')
    const html = menu.html()
    expect(menu.find('[data-test="sv-more-convert"]').exists()).toBe(true)
    // Grouped with rename/duplicate, i.e. before the separator, not next to Delete.
    expect(html.indexOf('sv-more-convert')).toBeLessThan(html.indexOf('sv-export-sep'))
  })

  it('asks for confirmation and spells out that the theme is discarded', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await openConvertConfirm(w)
    expect(w.find('[data-test="sv-more-menu"]').exists()).toBe(false)
    const body = w.find('[data-test="sv-convert-confirm"]').text()
    expect(body).toContain('12')
    expect(body).toContain(zh.photosSvConvertToAlbumBody.replace('{n}', '12'))
  })

  it('navigates to the new album on success', async () => {
    convertFromSmartView.mockResolvedValue({ id: 'al-new' } as never)
    const { w, router } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    const push = vi.spyOn(router, 'push')
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await flushPromises()
    expect(push).toHaveBeenCalledWith('/photos/albums/al-new')
  })

  it('keeps the confirmation open with an inline message when it fails', async () => {
    convertFromSmartView.mockRejectedValue(new Error('boom'))
    const { w, router } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    const push = vi.spyOn(router, 'push')
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sv-convert-confirm"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-convert-error"]').text()).toContain(zh.photosAlbumConvertFailed)
    expect(push).not.toHaveBeenCalledWith(expect.stringContaining('/photos/albums/'))
  })

  it('reuses the duplicate-name copy for a 409', async () => {
    convertFromSmartView.mockRejectedValue({ response: { status: 409 } })
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sv-convert-error"]').text()).toContain(zh.photosAlbumNameExists)
  })

  it('closes the convert confirmation on Escape', async () => {
    // Retitled in the final fix wave: the old title claimed this covered "along with any
    // other open overlay", but askConvertToAlbum closes the more menu on its way in, so no
    // second overlay is ever open here. The multi-overlay invariant (independent ifs, never
    // an early return) is covered by the existing export-menu + more-menu case.
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await openConvertConfirm(w)
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-convert-confirm"]').exists()).toBe(false)
  })

  it('dresses the confirm button as the filled primary CTA, not a second Cancel', async () => {
    // Vue2 uses trash-btn-cta here (939a7d3a:photos.scss:2203-2213) and reserves the danger
    // variant for the delete dialog. Without the modifier this button rendered with the base
    // ghost rule -- pixel-identical to the Cancel beside it, and with no hover at all.
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await openConvertConfirm(w)
    const ok = w.find('[data-test="sv-convert-ok"]')
    expect(ok.classes()).toContain('primary')
    expect(ok.classes()).not.toContain('danger')
    const css = readFileSync('src/views/PhotosSmartViewDetail.vue', 'utf8')
    expect(css).toMatch(/\.sv-confirm-ok\.primary\s*\{[^}]*background:\s*var\(--accent\)/)
    expect(css).toMatch(/\.sv-confirm-ok\.primary:hover:not\(:disabled\)\s*\{/)
  })

  it('tints the convert dialog icon with the accent, not the delete red', async () => {
    // Vue2 :298 passes var(--accent-hi) for this album glyph; only :279's trash glyph is red.
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await openConvertConfirm(w)
    expect(w.find('[data-test="sv-convert-confirm"] .sv-confirm-icon').classes()).toContain('accent')
    // The delete dialog keeps the red disc (no .accent).
    await w.find('[data-test="sv-convert-cancel"]').trigger('click')
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-delete"]').trigger('click')
    expect(w.find('[data-test="sv-confirm-scrim"] .sv-confirm-icon').classes()).not.toContain('accent')
    const css = readFileSync('src/views/PhotosSmartViewDetail.vue', 'utf8')
    expect(css).toMatch(/\.sv-confirm-icon\.accent\s*\{[^}]*background:\s*var\(--accent-soft\)/)
  })

  it('does not dismiss the confirmation mid-flight', async () => {
    let release: (v: unknown) => void = () => {}
    convertFromSmartView.mockReturnValue(new Promise((r) => { release = r as (v: unknown) => void }))
    const { w } = await mountView('7', [makeSv({ id: 7, count: 12 })])
    await openConvertConfirm(w)
    await w.find('[data-test="sv-convert-ok"]').trigger('click')
    await w.find('[data-test="sv-convert-cancel"]').trigger('click')
    expect(w.find('[data-test="sv-convert-confirm"]').exists()).toBe(true)
    // Escape must be refused the same way the Cancel button is -- both route through
    // closeConvertToAlbum's busy guard rather than one of them poking the flag directly.
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-convert-confirm"]').exists()).toBe(true)
    release({ id: 'al-new' })
    await flushPromises()
  })
})

// ── 两段网格 ─────────────────────────────────────────────────────────────
describe('两段照片网格', () => {
  it('newCount > 0 →「最近添加」段在;=== 0 → 不在', async () => {
    svc.photos.getSmartViewAssets.mockResolvedValue([])
    const { w: w1 } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 2 })])
    expect(w1.find('[data-test="sv-recent-head"]').exists()).toBe(true)
    const { w: w2 } = await mountView('8', [makeSv({ id: 8, addedThisWeek: 0 })])
    expect(w2.find('[data-test="sv-recent-head"]').exists()).toBe(false)
  })

  it('tile 数等于对应数组长度(matched 3 张 / recent 2 张)', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      return opts?.recent ? [asset('r1'), asset('r2')] : [asset('a1'), asset('a2'), asset('a3')]
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 2 })])
    expect(w.findAll('[data-test="sv-recent-tile"]')).toHaveLength(2)
    expect(w.findAll('[data-test="sv-all-tile"]')).toHaveLength(3)
  })

  // SP15-P2c Task 9: this used to assert `call[1]).toBe(store.matchedAssets)` -- the raw store
  // array, by reference. Task 9 hands the lightbox `matchedSet` (the Sort-applied view) instead,
  // and `sortAlbumPhotos` always returns a fresh `[...photos]` copy (util/albumView.ts) even in
  // the default 'score' ordering, so the reference check would now fail even though the content
  // is identical. Content is what matters here (there is only one asset, so score-order content
  // is indistinguishable from taken-order content) -- the ordering divergence is covered by the
  // two tests above.
  it('tile click still calls lb.openAt with content matching store.matchedAssets (now a separate sorted snapshot, not the same reference), startMs 0, no query', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      return opts?.recent ? [] : [asset('a1')]
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    await w.find('[data-test="sv-all-tile"]').trigger('click')
    const store = usePhotosSmartViews()
    expect(lbMock.openAt).toHaveBeenCalledTimes(1)
    const call = lbMock.openAt.mock.calls[0]
    expect(call[1]).toEqual(store.matchedAssets)
    expect(call[1]).not.toBe(store.matchedAssets)
    expect(call[2]).toBe(0)
    expect(call[3]).toBeUndefined()
  })

  it('isNew: true 的项被点后 .new-tag 消失(就地乐观清除)', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      return opts?.recent ? [asset('r1', { isNew: true })] : [asset('r1', { isNew: true })]
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 1 })])
    const tile = w.find('[data-test="sv-recent-tile"]')
    expect(tile.find('.new-tag').exists()).toBe(true)
    await tile.trigger('click')
    await w.vm.$nextTick()
    expect(tile.find('.new-tag').exists()).toBe(false)
  })
})

// ── 浮层 ──────────────────────────────────────────────────────────────────
describe('浮层:菜单同开 + Esc + 点外部关闭', () => {
  // Re-homed (Task 7): was '先开 export 再开 more,一次 Esc 两者都关'. The export menu no
  // longer exists as an independent overlay -- ZIP is now inside the unified more menu. The
  // invariant this test guards (multiple independent `if`s in onDocumentKeydown, never an
  // early return, so one Escape closes every open overlay) still needs two *independent*
  // overlays to be meaningful; the sort menu and the more menu are the pair left on this page.
  it('opens the sort menu then the more menu, and one Escape closes both', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-sort-btn"]').trigger('click')
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-more-menu"]').exists()).toBe(true)
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-sort-menu"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-more-menu"]').exists()).toBe(false)
  })

  // '点菜单外部(mousedown,bubbles:true)→ 关闭' (used to read sv-export-toggle/sv-export-menu)
  // is superseded by "SP15-P2c Task 7" describe block's own "still closes the menu on an
  // outside click" -- identical mechanism, same assertion, sv-more-toggle/sv-more-menu instead.
})

// ── 非颜色视觉属性:先锚定规则体、再断言属性(全文件级 toContain 恒真,不算断言)──
describe('样式:非颜色视觉属性 1:1(Vue2 内联 style 逐属性对照)', () => {
  it('.sv-grid-photos-recent 保留 Vue2 :136 内联的 padding-bottom:18px(全部匹配段没有这条)', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewDetailRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-grid-photos-recent')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('padding-bottom: 18px')
  })

  it('.sv-more-menu 保留 Vue2 :103 内联的 min-width:220px', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewDetailRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-more-menu')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('min-width: 220px')
  })

  // Plan C Task 5 re-skin fix: Vue2's own inline style on this button (:180) is
  // `min-width:36px`, not 32px -- a 4px drift this task's shadowing pass caught and corrected;
  // this guard now locks the right value.
  it('.sv-action-btn-icon 保留 Vue2 :180 内联的 padding/min-width/justify-content 三件套', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewDetailRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-action-btn-icon')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('padding: 0 10px')
    expect(rule?.body).toContain('min-width: 36px')
    expect(rule?.body).toContain('justify-content: center')
  })

  // fix round 1 · M2:两列布局容器(scss:161-166)。
  it('.sv-detail-layout 是 grid-template-columns: 1fr 320px(Vue2 两列布局)', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewDetailRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-detail-layout')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('grid-template-columns: 1fr 320px')
  })

  it('≤768px 媒体查询里 .sv-detail-layout 塌成单列(grid-template-columns: 1fr)', () => {
    const style = extractStyleBlock(photosSmartViewDetailRaw)
    const m = /@media \(max-width: 768px\)\s*\{([\s\S]*)\}\s*$/.exec(style)
    expect(m).not.toBeNull()
    const rules = parseCssRules(m![1])
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-detail-layout')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('grid-template-columns: 1fr')
  })

  // fix round 1 · I2:两个菜单 + 删除确认弹窗的 transition,Vue3 用 `-enter-from`(不是
  // Vue2 的 `-enter`)。
  it('.sv-menu-enter-from / .sv-menu-leave-to 保留 Vue2 scss:454-455 的 opacity+translateY+scale', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewDetailRaw))
    const rule = rules.find((r) => r.selectors.includes('.sv-menu-enter-from') && r.selectors.includes('.sv-menu-leave-to'))
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('opacity: 0')
    expect(rule?.body).toContain('translateY(-4px) scale(0.97)')
  })

  it('.sv-confirm-enter-from / .sv-confirm-leave-to 保留 Vue2 photos.scss:705-707 的 opacity+scale', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewDetailRaw))
    const rule = rules.find((r) => r.selectors.includes('.sv-confirm-enter-from') && r.selectors.includes('.sv-confirm-leave-to'))
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('opacity: 0')
    expect(rule?.body).toContain('scale(0.95)')
  })

  // fix round 1 · I3:浅色照片上的 accent 环内侧内阴影(scss:506-513)。
  it('.sv-grid-photos .tile.recent::after 保留 Vue2 的 inset box-shadow', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewDetailRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-grid-photos .tile.recent::after')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('box-shadow: inset 0 0 0 2px')
  })
})

// fix round 1 · I2(菜单/弹窗真的套了 <Transition>,不是样式定义了但模板没用上)────
describe('浮层的 <Transition> 包裹是真的接上了(源文本回源,不是样式块躺尸)', () => {
  // Re-homed (Task 7): the export menu's own <Transition name="sv-menu"> is gone along with
  // the button that opened it, leaving exactly one -- the unified more menu's. The target
  // (33b05636 :78) wraps its own merged menu in <transition name="sv-menu"> too, so the wrapper
  // itself is 1:1 with Vue2; only the *count* here (one, not two) is New-UI-specific fallout
  // from Task 6 having parked two separate menus that Task 7 then merged into one.
  it('the more menu\'s data-test marker sits inside its <Transition name="sv-menu"> pair', () => {
    const menuBlocks = [...photosSmartViewDetailRaw.matchAll(/<Transition name="sv-menu">([\s\S]*?)<\/Transition>/g)]
    expect(menuBlocks.length).toBe(1)
    expect(menuBlocks[0][1]).toContain('data-test="sv-more-menu"')
  })

  it('删除确认弹窗的 sv-confirm-scrim 出现在 <Transition name="sv-confirm"> 内', () => {
    const m = /<Transition name="sv-confirm">([\s\S]*?)<\/Transition>/.exec(photosSmartViewDetailRaw)
    expect(m).not.toBeNull()
    expect(m![1]).toContain('data-test="sv-confirm-scrim"')
  })
})

// ── cssCascade:hover 归属变体 ─────────────────────────────────────────────
describe('样式:hover 级联归属变体', () => {
  // Task 11 (c): the `.sv-action-btn-primary` cascade regression that used to open this block is
  // gone with the rule it guarded -- Task 7 folded the Export button (the class's only consumer)
  // into the unified "..." menu, so the selector this test queried no longer exists on the page.
  // The same variant, and the same regression, still live on PhotosMomentDetail.test.ts:874-880.

  it('.sv-export-item / .sv-export-item-danger(删除项)hover 胜出规则含 :hover 且归属变体', () => {
    const style = extractStyleBlock(photosSmartViewDetailRaw)
    const win = winningHoverBackground(style, ['sv-export-item', 'sv-export-item-danger'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('sv-export-item-danger')
    expect(win.specificity).toBe(3)
  })

  // SP15-P2c Task 8, coordinator review fix round 2: this rehomes the deleted
  // SmartViewConditionEditor.test.ts's cssCascade assertion for the condition chip's own
  // hover rule, moved in from that component along with the markup. Query with the SAME
  // two-class form the two sibling tests above use (base + variant), not a single-class
  // query -- a single-class query silently drops any base `.sv-cond:hover` rule from
  // consideration before the cascade comparison ever runs (the helper filters candidates by
  // class-membership against the list passed in), which would make this test blind to the
  // exact base-beats-variant regression it exists to catch. `.sv-cond` has no `:hover` rule
  // today, but the query still has to include it so the test would actually fail if one were
  // ever added with equal-or-higher specificity than `.sv-cond-removable:hover` -- see the
  // mutation check in task-8-report.md for proof this form (not the single-class form tried
  // first) actually reddens on that scenario.
  it('.sv-cond / .sv-cond-removable (condition chip) hover-winning rule contains :hover and belongs to the variant', () => {
    const style = extractStyleBlock(photosSmartViewDetailRaw)
    const win = winningHoverBackground(style, ['sv-cond', 'sv-cond-removable'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('sv-cond-removable')
  })
})

// ── 红色不含字面色值 ────────────────────────────────────────────────────
describe('红色走 token,不写死字面量', () => {
  it('样式块含 --remove-fg 家族,不含字面 #FF6B5C', () => {
    const style = extractStyleBlock(photosSmartViewDetailRaw)
    expect(style).toContain('--remove-fg')
    expect(style).not.toContain('#FF6B5C')
    expect(style.toUpperCase()).not.toContain('#FF6B5C')
  })
})
