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
import { useToast } from '../../stores/toast'
import { extractStyleBlock, parseCssRules, winningHoverBackground } from '../../photos/components/__tests__/cssCascade'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh, en_us: en } })

function makeRouter(initial = '/photos/smart-views/7') {
  const router = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
      { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: PhotosSmartViewDetail },
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

  it('返回按钮 → router.push 到列表页', async () => {
    const { w, router } = await mountView('999', [makeSv({ id: 7 })])
    const pushSpy = vi.spyOn(router, 'push')
    await w.find('[data-test="sv-not-found-back"]').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/photos/smart-views')
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
})

// fix round 1 · M5(brief §3 明文要求的挂载点断言,原版 grep 0 命中)──────────────
// P7a-T7:sv-cond-editor-mount 的 stub 断言("空壳,children.length===0")在这里升级成
// 真组件断言——SmartViewConditionEditor 自己的结构/交互/cssCascade 覆盖已在
// SmartViewConditionEditor.test.ts,这里只钉住"宿主接线对不对":conds 从 sv.conds 来、
// add/remove 翻译成 store.updateSmartView(id, { conds: [...] }) 的正确形状、busy 转发
// store.patchBusy。
describe('T7:加条件弹层 + 条件 chip(挂载点兑现为真组件)', () => {
  it('sv-cond-editor-mount 渲染 SmartViewConditionEditor,chip 数量与 sv.conds 一致', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, conds: ['scene: sunset', 'place: Japan'] })])
    const mountEl = w.find('[data-test="sv-cond-editor-mount"]')
    expect(mountEl.exists()).toBe(true)
    expect(mountEl.findAll('[data-test="sv-cond-chip"]').length).toBe(2)
  })

  it('点 chip 删除 → store.updateSmartView 收到过滤后的 conds(condsRaw)', async () => {
    svc.photos.updateSmartView.mockResolvedValue(null)
    const { w } = await mountView('7', [makeSv({ id: 7, conds: ['scene: sunset', 'place: Japan'] })])
    await w.findAll('[data-test="sv-cond-chip"]')[0].trigger('click')
    await flushPromises()
    expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', { condsRaw: ['place: Japan'] })
  })

  it('弹层输入 + Enter → store.updateSmartView 收到追加后的 conds(condsRaw)', async () => {
    svc.photos.updateSmartView.mockResolvedValue(null)
    const { w } = await mountView('7', [makeSv({ id: 7, conds: ['scene: sunset'] })])
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    const input = w.find<HTMLInputElement>('[data-test="sv-cond-pop-input"]')
    await input.setValue('object: dog')
    await input.trigger('keydown.enter')
    await flushPromises()
    expect(svc.photos.updateSmartView).toHaveBeenCalledWith('7', { condsRaw: ['scene: sunset', 'object: dog'] })
  })

  it('store.patchBusy 期间转发为 SmartViewConditionEditor 的 busy=true(primary 按钮禁用)', async () => {
    let resolveFn: ((v: unknown) => void) | undefined
    svc.photos.updateSmartView.mockImplementation(() => new Promise((res) => { resolveFn = res }))
    const { w } = await mountView('7', [makeSv({ id: 7, conds: ['scene: sunset'] })])
    await w.find('[data-test="sv-cond-add-btn"]').trigger('click')
    const input = w.find<HTMLInputElement>('[data-test="sv-cond-pop-input"]')
    await input.setValue('object: dog')
    await input.trigger('keydown.enter')
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-cond-submit"]').attributes('disabled')).toBeDefined()
    resolveFn?.(null)
    await flushPromises()
  })
})

describe('T8 挂载点存在(本任务只留空壳,断言"占位存在"而非内容)', () => {
  it('sv-side-mount(T8:右栏阈值/设置/统计/活动流)存在且为空壳', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    const mount = w.find('[data-test="sv-side-mount"]')
    expect(mount.exists()).toBe(true)
    expect(mount.element.children.length).toBe(0)
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

// ── 「在搜索中细化」——T6 阶段临时禁用态 ────────────────────────────────────
describe('「在搜索中细化」按钮(T16 前临时禁用)', () => {
  it('disabled 且 title 是 photosSvSearchPending', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    const btn = w.find('[data-test="sv-action-refine"]')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('title')).toBe(zh.photosSvSearchPending)
  })
})

// ── 导出菜单 / more 菜单 ─────────────────────────────────────────────────
describe('导出菜单与 more 菜单', () => {
  it('点导出按钮 → 菜单出现两项(ZIP / 静态相册)', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-export-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-export-zip"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-export-album"]').exists()).toBe(true)
  })

  it('点 more 按钮 → 菜单出现三项(重命名 / 复制 / 删除)', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-more-rename"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-more-duplicate"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-more-delete"]').exists()).toBe(true)
  })

  it('photosSvNPhotosMbMb 的 {mb} 在 count=1000 时是千分位 "3,200"', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7, count: 1000 })])
    await w.find('[data-test="sv-export-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-export-zip"]').text()).toContain('3,200')
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
    await w.find('[data-test="sv-export-toggle"]').trigger('click')
    await w.find('[data-test="sv-export-zip"]').trigger('click')
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
    await w.find('[data-test="sv-export-toggle"]').trigger('click')
    await w.find('[data-test="sv-export-zip"]').trigger('click')
    await flushPromises()

    const anchor = appendSpy.mock.calls.map((c) => c[0]).find((n) => (n as HTMLElement).tagName === 'A') as HTMLAnchorElement
    expect(anchor).toBeDefined()
    expect(anchor.download).toContain('.zip')

    vi.unstubAllGlobals()
  })

  it('fetch 返 401(!ok)→ toast 是 photosSvExportFailed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-export-toggle"]').trigger('click')
    await w.find('[data-test="sv-export-zip"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sv-export-toast"]').text()).toContain(zh.photosFavExportFailed)
    vi.unstubAllGlobals()
  })
})

// ── 导出相册 ─────────────────────────────────────────────────────────────
describe('导出相册', () => {
  it('成功 → toast 文案含 name', async () => {
    svc.photos.exportSmartViewAlbum.mockResolvedValue({})
    const { w } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    await w.find('[data-test="sv-export-toggle"]').trigger('click')
    await w.find('[data-test="sv-export-album"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sv-export-toast"]').text()).toContain('Sunsets')
  })

  it('失败 → toast 是 photosSvExportFailed(照搬 photosFavExportFailed 复用)', async () => {
    svc.photos.exportSmartViewAlbum.mockRejectedValue(new Error('500'))
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-export-toggle"]').trigger('click')
    await w.find('[data-test="sv-export-album"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="sv-export-toast"]').text()).toContain(zh.photosFavExportFailed)
  })
})

// ── 删除 ──────────────────────────────────────────────────────────────────
describe('删除智能视图', () => {
  it('点 more → 删除项 → 确认弹窗出现', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-delete"]').trigger('click')
    expect(w.find('[data-test="sv-confirm-scrim"]').exists()).toBe(true)
  })

  it('点确认 → deleteSmartView 被调 → router.push 到列表页 + 带撤销的 toast', async () => {
    svc.photos.deleteSmartView.mockResolvedValue({})
    const { w, router } = await mountView('7', [makeSv({ id: 7, name: 'Sunsets' })])
    const pushSpy = vi.spyOn(router, 'push')
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-delete"]').trigger('click')
    await w.find('[data-test="sv-confirm-ok"]').trigger('click')
    await flushPromises()
    expect(svc.photos.deleteSmartView).toHaveBeenCalledWith('7')
    expect(pushSpy).toHaveBeenCalledWith('/photos/smart-views')
    expect(useToast().msg).toContain('Sunsets')
    const last = useToast().toasts[useToast().toasts.length - 1]
    expect(last.action?.label).toBe(zh.photosTrashUndo)
    expect(typeof last.action?.onClick).toBe('function')
  })

  it('deleteSmartView reject → 不跳转 + toast', async () => {
    svc.photos.deleteSmartView.mockRejectedValue(new Error('500'))
    const { w, router } = await mountView('7', [makeSv({ id: 7 })])
    const pushSpy = vi.spyOn(router, 'push')
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-delete"]').trigger('click')
    await w.find('[data-test="sv-confirm-ok"]').trigger('click')
    await flushPromises()
    expect(pushSpy).not.toHaveBeenCalledWith('/photos/smart-views')
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

  it('点 tile → lb.openAt 被调,第二参是 store.matchedAssets 全集、第三参 0、第四参 undefined', async () => {
    svc.photos.getSmartViewAssets.mockImplementation(async (_id: string, opts: { recent?: boolean }) => {
      return opts?.recent ? [] : [asset('a1')]
    })
    const { w } = await mountView('7', [makeSv({ id: 7, addedThisWeek: 0 })])
    await w.find('[data-test="sv-all-tile"]').trigger('click')
    const store = usePhotosSmartViews()
    expect(lbMock.openAt).toHaveBeenCalledTimes(1)
    const call = lbMock.openAt.mock.calls[0]
    expect(call[1]).toBe(store.matchedAssets)
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
  it('先开 export 再开 more,一次 Esc 两者都关', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-export-toggle"]').trigger('click')
    await w.find('[data-test="sv-more-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-export-menu"]').exists()).toBe(true)
    expect(w.find('[data-test="sv-more-menu"]').exists()).toBe(true)
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-export-menu"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-more-menu"]').exists()).toBe(false)
  })

  it('点菜单外部(mousedown,bubbles:true)→ 关闭', async () => {
    const { w } = await mountView('7', [makeSv({ id: 7 })])
    await w.find('[data-test="sv-export-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-export-menu"]').exists()).toBe(true)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-export-menu"]').exists()).toBe(false)
  })
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

  it('.sv-action-btn-icon 保留 Vue2 :99 内联的 padding/min-width/justify-content 三件套', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewDetailRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-action-btn-icon')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('padding: 0 10px')
    expect(rule?.body).toContain('min-width: 32px')
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
  it('导出菜单 / more 菜单 的 data-test 标记都出现在 <Transition name="sv-menu"> 与其配对的 </Transition> 之间', () => {
    // 用配对计数而不是简单 indexOf 区间——模板里有两个 sv-menu Transition,分别包导出菜单与
    // more 菜单,逐个核对各自的 data-test 落在“离它最近的那对 sv-menu 开闭标签”之间。
    const menuBlocks = [...photosSmartViewDetailRaw.matchAll(/<Transition name="sv-menu">([\s\S]*?)<\/Transition>/g)]
    expect(menuBlocks.length).toBe(2)
    const combined = menuBlocks.map((m) => m[1]).join('\n')
    expect(combined).toContain('data-test="sv-export-menu"')
    expect(combined).toContain('data-test="sv-more-menu"')
  })

  it('删除确认弹窗的 sv-confirm-scrim 出现在 <Transition name="sv-confirm"> 内', () => {
    const m = /<Transition name="sv-confirm">([\s\S]*?)<\/Transition>/.exec(photosSmartViewDetailRaw)
    expect(m).not.toBeNull()
    expect(m![1]).toContain('data-test="sv-confirm-scrim"')
  })
})

// ── cssCascade:hover 归属变体 ─────────────────────────────────────────────
describe('样式:hover 级联归属变体', () => {
  it('.sv-action-btn / .sv-action-btn-primary(导出主按钮)hover 胜出规则含 :hover 且归属变体', () => {
    const style = extractStyleBlock(photosSmartViewDetailRaw)
    const win = winningHoverBackground(style, ['sv-action-btn', 'sv-action-btn-primary'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('sv-action-btn-primary')
    // fix round 1(评审折中方案):必须是真实优先级 3(复合选择器 `.a.b:hover`)取胜,不是
    // 优先级打平后靠源码顺序苟活——specificity===3 才说明两个类都算进了同一条选择器里
    // (单类 `.sv-action-btn-primary:hover` 只会算出 2,与基类同级)。
    expect(win.specificity).toBe(3)
  })

  it('.sv-export-item / .sv-export-item-danger(删除项)hover 胜出规则含 :hover 且归属变体', () => {
    const style = extractStyleBlock(photosSmartViewDetailRaw)
    const win = winningHoverBackground(style, ['sv-export-item', 'sv-export-item-danger'])
    expect(win.selector).toContain(':hover')
    expect(win.selector).toContain('sv-export-item-danger')
    expect(win.specificity).toBe(3)
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
