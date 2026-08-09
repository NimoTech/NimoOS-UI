// SP7-P7a-T4: PhotosSmartViews.vue —— 智能视图列表页测试。逐条对应 task-4-brief.md
// 「必含用例」清单。挂 Pinia + i18n + 真实 router(spy push 前先真 resolve 一次,
// AreaShell/PhotosSidebar 都用 useRouter(),照 PhotosPeople.test.ts 的既有挂载套路),
// mock 共享包 photos 方法。SmartViewCard 不 mock 掉——用它的真实实现,只 mock
// service.photos.thumbnailUrl(照 SmartViewCard.test.ts 的既有手法)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  photos: {
    listSmartViews: vi.fn().mockResolvedValue([]),
    getConfig: vi.fn().mockResolvedValue({}),
    thumbnailUrl: vi.fn((id: string, size: string) => `mock://thumb/${id}/${size}`),
    // T5:创建弹窗接线后,打开弹窗会触发 store.refreshPreview() → service.photos.
    // previewSmartView(300ms 防抖后才真的调用)。不 mock 会在某条测试之后的宏任务里
    // 抛"not a function"、污染下一条测试——照 smartViews.test.ts 的既有 mock 补齐,
    // 即便本文件的用例都不等那 300ms。
    previewSmartView: vi.fn().mockResolvedValue({ count: 0, seeds: [], thresholdActive: true }),
    // SP15-P1-T5 fix round 1: PhotosSmartViews.vue's onMounted now also unconditionally
    // calls moments.fetchMoments(); without this mock it throws "not a function" on every
    // mount here (caught and console.error'd by the store by design, but still noisy).
    listMoments: vi.fn(async () => []),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosSmartViews from '../PhotosSmartViews.vue'
// 评审既有先例(PhotosPeople.test.ts):`?raw` 只用于对 <style> 原文做结构断言,不用于
// 行为断言。
import photosSmartViewsRaw from '../PhotosSmartViews.vue?raw'
import { usePhotosSmartViews } from '../../photos/stores/smartViews'
import { usePhotosSettingsStore } from '../../photos/stores/settings'
// fix round 1 · I1/I2:先锚定规则体、再断言属性(全文件级 toContain 不算断言)。
// parseCssRules/extractStyleBlock 是本区既有的样式块结构断言工具(SmartViewCard.test.ts
// 已用过),不重新发明。
import { extractStyleBlock, parseCssRules } from '../../photos/components/__tests__/cssCascade'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function makeRouter() {
  return createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/photos/smart-views', name: 'photos-smart-views', component: PhotosSmartViews },
      // T4 尚不建详情路由(归后续任务),这里放一个桩路由让 router.push 的目标路径真实可解析。
      { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail-stub', component: { template: '<div/>' } },
      // P8a-T6(§7e-9):AI 横幅里的设置链接指向 /photos/settings?section=ai——桩路由让
      // RouterLink 真的能解析出 href,不然 vue-router 会警告"no match"。
      { path: '/photos/settings', name: 'photos-settings-stub', component: { template: '<div/>' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/photos/smart-views')
  await router.isReady()
  const w = mount(PhotosSmartViews, { global: { plugins: [i18n, router] } })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

interface RawSv {
  id: number | string
  name: string
  description: string
  conds: string[]
  threshold: number
  live: boolean
  includeVideos: boolean
  count: number
  addedThisWeek: number
  seeds: string[]
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
    count: 10,
    addedThisWeek: 2,
    seeds: ['seed-a', 'seed-b', 'seed-c'],
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  svc.photos.listSmartViews.mockClear().mockResolvedValue([])
  svc.photos.getConfig.mockClear().mockResolvedValue({})
  svc.photos.thumbnailUrl.mockClear()
  svc.photos.previewSmartView.mockClear().mockResolvedValue({ count: 0, seeds: [], thresholdActive: true })
})
afterEach(() => {
  usePhotosSmartViews().__resetForTest()
})

describe('PhotosSmartViews.vue — 拉取', () => {
  it('onMounted 调 store.fetchSmartViews() 一次(即 service.photos.listSmartViews 被调一次)', async () => {
    await mountView()
    expect(svc.photos.listSmartViews).toHaveBeenCalledTimes(1)
  })

  // P8a-T6(§7e-10):aiSmartViewOff 折进 photosSettings store,本页不再自己直读 getConfig
  // —— onMounted 走 settings.fetchAiFeatures(),同 PhotosPeople.vue 的收编先例。
  //
  // review fix(take-along,收紧断言):原来是 `toHaveBeenCalled()`,改紧到
  // `toHaveBeenCalledTimes(...)` 之前先手动验证了真实次数——`mountView()` 挂的是完整
  // `PhotosSmartViews`(模板里含 `<PhotosSidebar />`,T6 也给侧栏接了 fetchAiFeatures),
  // 挂载后 spy 记录的是**两次** action 调用(本页自身 + 它挂的那份侧栏各一次),不是 1 次
  // ——同 PhotosPeople.test.ts:104-112、PhotosSettings.test.ts 的既有先例(那两处也是 2,
  // 理由相同)。曾经临时改成 `toHaveBeenCalledTimes(1)` 手动跑过,确认会失败(got 2 times)
  // 才定的这个数字,不是照抄评审建议的字面值。
  it('aiSmartViewOff 读 store 而非自己调 getConfig(onMounted 走 settings.fetchAiFeatures,含它挂的侧栏共 2 次 action 调用)', async () => {
    const settings = usePhotosSettingsStore()
    const spy = vi.spyOn(settings, 'fetchAiFeatures')
    await mountView()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  // review fix(Important 1):上一条 spy 的是 store 的 action,不是网络层——这里不 spy
  // fetchAiFeatures,让真实实现跑起来,直接在 HTTP 层(`svc.photos.getConfig`)数调用次数,
  // 证明"页面自身 + 它挂的侧栏同帧各调一次 action"最终只落地一次真实请求(§7e-15 需要的
  // 那条不变量,settings.ts 的 aiFeaturesInFlight 去重)。
  it('§7e-15 网络级去重证明:PhotosSmartViews 自身 + 它挂的 PhotosSidebar 同帧各调一次 fetchAiFeatures,真实 getConfig 只发一次', async () => {
    await mountView()
    expect(svc.photos.getConfig).toHaveBeenCalledTimes(1)
  })
})

describe('PhotosSmartViews.vue — 三态渲染', () => {
  it('listLoading && !listLoaded → 渲染骨架,不渲染网格卡片(首帧断言,绕开 flushPromises)', async () => {
    let resolveFn: ((v: unknown[]) => void) | undefined
    svc.photos.listSmartViews.mockImplementation(() => new Promise((res) => { resolveFn = res }))
    const router = makeRouter()
    router.push('/photos/smart-views')
    await router.isReady()
    const w = mount(PhotosSmartViews, { global: { plugins: [i18n, router] } })
    // 只 flush 一次 microtask(不 flushPromises):足够让 onMounted 里同步置真的
    // listLoading 触发一次重渲染,但请求 promise 本身仍未 resolve(resolveFn 还没调用)。
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-skeleton"]').exists()).toBe(true)
    expect(w.findAllComponents({ name: 'SmartViewCard' })).toHaveLength(0)
    expect(w.find('[data-test="sv-create-card"]').exists()).toBe(false)
    resolveFn?.([])
    await flushPromises()
  })

  it('listLoaded + 2 条 → 2 个 SmartViewCard + 1 张 .sv-create-card,骨架消失', async () => {
    svc.photos.listSmartViews.mockResolvedValue([makeSv({ id: 1, name: 'A' }), makeSv({ id: 2, name: 'B' })])
    const { w } = await mountView()
    expect(w.find('[data-test="sv-skeleton"]').exists()).toBe(false)
    expect(w.findAllComponents({ name: 'SmartViewCard' })).toHaveLength(2)
    expect(w.findAll('[data-test="sv-create-card"]')).toHaveLength(1)
  })

  it('listLoaded + 0 条 → 0 个卡片 + 1 张新建卡,且无独立空态元素', async () => {
    svc.photos.listSmartViews.mockResolvedValue([])
    const { w } = await mountView()
    expect(w.find('[data-test="sv-skeleton"]').exists()).toBe(false)
    expect(w.findAllComponents({ name: 'SmartViewCard' })).toHaveLength(0)
    expect(w.findAll('[data-test="sv-create-card"]')).toHaveLength(1)
    // 登记(brief 结构规格第 5 条):Vue2 没有独立空态,New-UI 也不加——那张新建卡本身就是空态。
    expect(w.find('[data-test="sv-empty"]').exists()).toBe(false)
  })
})

describe('PhotosSmartViews.vue — AI 横幅三态', () => {
  it('getConfig 返回 aiFeatures.smartview === false → 横幅出现', async () => {
    svc.photos.getConfig.mockResolvedValue({ aiFeatures: { smartview: false } })
    const { w } = await mountView()
    expect(w.find('[data-test="svs-ai-banner"]').exists()).toBe(true)
  })

  it('getConfig 返回 aiFeatures: {}(缺字段)→ 横幅不在,不吓用户', async () => {
    svc.photos.getConfig.mockResolvedValue({ aiFeatures: {} })
    const { w } = await mountView()
    expect(w.find('[data-test="svs-ai-banner"]').exists()).toBe(false)
  })

  it('getConfig reject → 横幅不在,不吓用户', async () => {
    svc.photos.getConfig.mockRejectedValue(new Error('boom'))
    const { w } = await mountView()
    expect(w.find('[data-test="svs-ai-banner"]').exists()).toBe(false)
  })

  // P8a-T6(§7e-9):原来的不可点 <span aria-disabled="true"> 换成真实的 <RouterLink>,指向
  // /photos/settings?section=ai(T5 建的设置页深链入口)。brief 给的断言用的 data-test id
  // 是 `sv-ai-settings-link`,与本文件/组件既有的 `svs-settings-link` 命名不一致——沿用本文件
  // 已建立的既有命名,不为了字面对齐 brief 而改 data-test id(已在任务报告里登记这处
  // brief-vs-既有约定冲突)。
  it('AI behavior 链接是真路由链接,指向 /photos/settings?section=ai(§7e-9)', async () => {
    svc.photos.getConfig.mockResolvedValue({ aiFeatures: { smartview: false } })
    const { w, router } = await mountView()
    const link = w.get('[data-test="svs-settings-link"]')
    expect(link.attributes('aria-disabled')).toBeUndefined()
    expect(link.attributes('href')).toContain('/photos/settings')
    await link.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/photos/settings')
    expect(router.currentRoute.value.query.section).toBe('ai')
  })
})

// T5 升级(brief 明确要求):T4 只能断言内部 createOpen state(弹窗组件当时还不存在);
// SmartViewCreateDialog.vue 接线后,断言升级为「弹窗真渲染」——两个入口点击后
// .sv-modal-scrim 真的出现在 DOM 里,而不只是读一个内部 ref。
describe('PhotosSmartViews.vue — 创建入口(T5:弹窗真渲染)', () => {
  it('点 hero 创建按钮 → SmartViewCreateDialog 的 scrim 真渲染', async () => {
    const { w } = await mountView()
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(false)
    await w.find('[data-test="sv-hero-create"]').trigger('click')
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(true)
  })

  it('点 .sv-create-card → 弹窗同样真渲染', async () => {
    const { w } = await mountView()
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(false)
    await w.find('[data-test="sv-create-card"]').trigger('click')
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(true)
  })

  it('弹窗内点关闭 → scrim 消失,回到列表(createOpen 回落为 false)', async () => {
    const { w } = await mountView()
    await w.find('[data-test="sv-hero-create"]').trigger('click')
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(true)
    await w.find('[data-test="sv-close-btn"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="sv-modal-scrim"]').exists()).toBe(false)
  })
})

describe('PhotosSmartViews.vue — 卡片 @open → 路由跳转', () => {
  // 真点击(不是手动 $emit)——让后端数字 id(7)真的走一遍 SmartViewCard 内部的
  // `emit('open', String(props.sv.id))` 再到这里的 onCardOpen,端到端核实数字 id
  // 拼接成字符串路径这条链路真的接上了(铁律:数字/字符串 id 混用回归)。
  it('点真实卡片 → router.push 参数是 /photos/smart-views/7(后端数字 id 7 拼接成字符串)', async () => {
    svc.photos.listSmartViews.mockResolvedValue([makeSv({ id: 7 })])
    const { w, router } = await mountView()
    const pushSpy = vi.spyOn(router, 'push')
    const card = w.findComponent({ name: 'SmartViewCard' })
    expect(card.exists()).toBe(true)
    await card.find('.sv-card').trigger('click')
    await flushPromises()
    expect(pushSpy).toHaveBeenCalledWith('/photos/smart-views/7')
  })
})

// ── 样式块结构断言(?raw,照 color-guard / PersonAssetGrid.test.ts 的既有先例)──
describe('PhotosSmartViews.vue — 样式块结构核对', () => {
  it('.photos-layout 在 ≤768px 媒体查询里把 gap 收成 0(照本区既定形态)', () => {
    const m = /@media \(max-width: 768px\)\s*\{([^}]*\{[^}]*\})*[^}]*\}/.exec(photosSmartViewsRaw)
    expect(m).not.toBeNull()
    expect(photosSmartViewsRaw).toContain('.photos-layout { gap: 0; }')
  })

  it('.sv-create-btn 与 .plus 圆块用 var(--accent) 实底 + var(--on-accent) 前景(不是裸色)', () => {
    expect(photosSmartViewsRaw).toContain('background: var(--accent); color: var(--on-accent);')
  })

  // fix round 1 · I1:AI 横幅的 margin 必须保留"比 hero/网格多缩进一层"的相对关系
  // (Vue2 24px 上 / 32px 左右 / 0 下,本仓取额外缩进量 32px 而非字面照抄,详见样式块内
  // 对应注释)。先锚定 .svs-banner 的规则体、再断言 margin 值——全文件级 toContain 恒真,
  // 不算断言。
  it('.svs-banner 的 margin 保留 Vue2 的横向额外缩进(32px)与上边距(24px)', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewsRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.svs-banner')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('margin: 24px 32px 20px;')
  })

  // fix round 1 · I2:.sv-create-btn:hover 必须同时保留 Vue2 的上浮效果(translateY)与本仓
  // primary 按钮 hover 的既定变亮写法(filter: brightness),两者可共存。先锚定
  // .sv-create-btn:hover 的规则体、再断言含 translateY。
  it('.sv-create-btn:hover 保留 Vue2 的上浮效果(translateY(-1px))', () => {
    const rules = parseCssRules(extractStyleBlock(photosSmartViewsRaw))
    const rule = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === '.sv-create-btn:hover')
    expect(rule).toBeDefined()
    expect(rule?.body).toContain('translateY(-1px)')
  })
})
