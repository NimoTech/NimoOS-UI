// SP8-P2a Task 8 —— SettingsPage 测试。brief Step 1 给的是 28 条用例清单
// (逐条编号 1-28,注释里保留编号方便和 brief 对账),按它逐条实现。
//
// mock 掉 `useSettingsStore` 的四个网络动作(brief 原话:"mock 掉
// useSettingsStore 的网络动作"),不 mock 底层 `service.ai.*` —— 那是
// settingsStore.test.ts(T5)自己的职责,这里只关心页面壳的接线是否正确。
// 仍然 mock 一层 `@nimotech/nimoos-service`(空壳)托底,防止漏 spy 的调用
// 意外落到真实网络请求上(onMounted 每个装载都 try/catch 吞错,真落网会
// reject 但不会让测试崩,只是可能拖慢/不确定,加这层是纯保险)。
//
// 路由用真实 `createMemoryHistory()`(不 mock vue-router)—— `?section=` 深链
// 契约(用例 13-18)需要真正响应式的 `route.query`,静态 mock 对象在这里不够
// (静态对象上的属性读取不会被 Vue 的依赖收集追踪到,watch 永远不会触发)。
//
// ⚠️ jsdom 没有 IntersectionObserver:多数用例根本不需要它 —— jsdom 环境下
// `typeof IntersectionObserver === 'undefined'`,`setupSpy()` 的守卫直接静默
// 跳过(与 Vue2 同款优雅降级,见 Settings.vue:216),不会报错。仅在文件末尾
// 「非清单要求」的补充测试里手动挂一个假的 IntersectionObserver 类,捕获
// 构造函数传入的回调,手动喂 entries 触发它,验证 scroll-spy 真的接上了线。

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory, RouterLink, type Router } from 'vue-router'
import zh from '../../i18n/zh_cn'

const ai = vi.hoisted(() => ({
  getServicesStatus: vi.fn(),
  listModels: vi.fn(),
  listProviders: vi.fn(),
  getPolicy: vi.fn(),
  getImportStatus: vi.fn(),
  cancelImport: vi.fn(),
  // SP8-P3a Task 7 —— skills 分区不再是占位,挂载真组件 SkillsSection 会在
  // onMounted 里调 service.ai.listSkills()。裸 vi.fn()(无 mockResolvedValue)
  // 调用返回 undefined,`await undefined` 合法且 SkillsSection 的
  // `Array.isArray(list)` 兜底把它当空列表处理,不抛错、不弹 toast —— 足够
  // 让本文件里与 skills 无关的用例（换到该分区只是路过）保持沉默；需要断言
  // 列表内容的用例会自己 `mockResolvedValue`。
  listSkills: vi.fn(),
  // SP8-P4 Task 9(收官)—— mcp 分区不再是占位,挂载真组件 McpSection 同样会在
  // onMounted 里调 service.ai.listMCPServers()。同上,裸 vi.fn() 让
  // `Array.isArray(list)` 兜底把它当空列表处理,本文件里与 mcp 无关的用例不受
  // 影响(⚠️ brief 明确点名:`stubNetworkActions` 只 mock 了 `useSettingsStore`
  // 的四个网络动作,不覆盖这里的 `service.ai.*`——必须单独在这个 hoisted 对象里
  // 补上,否则挂载 mcp 分区时 `listMCPServers` 会是 `undefined`,虽然
  // `Array.isArray` 兜底不会抛错,但补齐这个键是让「mock 齐全」这件事显式,
  // 不依赖兜底的隐性容错)。
  listMCPServers: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))

import SettingsPage from './SettingsPage.vue'
import { useSettingsStore } from '../stores/settingsStore'
import type { ImportJob } from '../stores/settingsStore'
import type { SectionId } from '../components/settings/sections'
import { useAiTheme } from '../stores/aiTheme'
import { useToast } from '../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

let pinia: Pinia

async function mountPage(initial = '/ai/settings') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/ai/settings', name: 'ai-settings', component: SettingsPage },
      { path: '/ai/agent', name: 'ai-agent', component: { template: '<div data-test="agent-page" />' } },
    ],
  })
  await router.push(initial)
  const w = mount(SettingsPage, { global: { plugins: [i18n, pinia, router] }, attachTo: document.body })
  return { w, router }
}

/** brief:"mock 掉 useSettingsStore 的网络动作" —— 四个装载动作变成无副作用的 no-op,
 *  返回各自的 spy 供调用序/调用次数断言用。 */
function stubNetworkActions(store: ReturnType<typeof useSettingsStore>) {
  return {
    services: vi.spyOn(store, 'loadServicesStatus').mockResolvedValue(undefined),
    models: vi.spyOn(store, 'loadModels').mockResolvedValue(undefined),
    providers: vi.spyOn(store, 'loadProviders').mockResolvedValue(undefined),
    policy: vi.spyOn(store, 'loadPolicy').mockResolvedValue(undefined),
  }
}

function makeImportJob(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    repo: 'org/model-a',
    filename: 'model-a.gguf',
    status: 'downloading',
    completed: 10,
    total: 100,
    error: '',
    speed: 0,
    etaSecs: null,
    _prevCompleted: 0,
    _prevTime: Date.now(),
    _timer: null,
    ...overrides,
  }
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  Object.values(ai).forEach((fn) => fn.mockReset())
  localStorage.clear()
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
  delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver
})

describe('SettingsPage — ① 根元素与主题', () => {
  it('1. 根元素同时带 agent-app 与 set-app 两个 class', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    const root = w.find('.set-app')
    expect(root.classes()).toContain('agent-app')
    expect(root.classes()).toContain('set-app')
    w.unmount()
  })

  it('2. data-theme 跟随 useAiTheme().theme;toggleTheme 后变化', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    const aiTheme = useAiTheme()
    expect(w.find('.set-app').attributes('data-theme')).toBe('light')
    aiTheme.toggleTheme()
    await flushPromises()
    expect(w.find('.set-app').attributes('data-theme')).toBe('dark')
    w.unmount()
  })
})

describe('SettingsPage — ② 顶栏', () => {
  it('3. 顶栏渲染 5 个 .set-pill', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    expect(w.findAll('.set-pill')).toHaveLength(5)
    w.unmount()
  })

  it('4. pillState 三态:true→ok,false→off,null/undefined→""(三条分别断言)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    const ollamaPill = () => w.findAll('.set-pill')[0]

    store.servicesStatus.ollama = true
    await flushPromises()
    expect(ollamaPill().attributes('data-s')).toBe('ok')

    store.servicesStatus.ollama = false
    await flushPromises()
    expect(ollamaPill().attributes('data-s')).toBe('off')

    store.servicesStatus.ollama = null
    await flushPromises()
    expect(ollamaPill().attributes('data-s')).toBe('')
    w.unmount()
  })

  it('5. Parser 灯三态:不跑→off,跑且暂停→warn,跑且未暂停→ok', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    const parserPill = () => w.findAll('.set-pill')[4]

    store.parserStatus.running = false
    await flushPromises()
    expect(parserPill().attributes('data-s')).toBe('off')

    store.parserStatus.running = true
    store.parserStatus.paused = true
    await flushPromises()
    expect(parserPill().attributes('data-s')).toBe('warn')

    store.parserStatus.paused = false
    await flushPromises()
    expect(parserPill().attributes('data-s')).toBe('ok')
    w.unmount()
  })

  it('6. Parser 待处理 > 0 时渲染 .badge-count 且文本是数字;为 0 时不渲染(对照组)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()

    store.parserStatus.pending = 3
    await flushPromises()
    expect(w.find('.badge-count').exists()).toBe(true)
    expect(w.find('.badge-count').text()).toBe('3')

    store.parserStatus.pending = 0
    await flushPromises()
    expect(w.find('.badge-count').exists()).toBe(false)
    w.unmount()
  })

  it('7. Parser 暂停时渲染 .badge-pause;未暂停时不渲染(对照组)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()

    store.parserStatus.paused = true
    await flushPromises()
    expect(w.find('.badge-pause').exists()).toBe(true)

    store.parserStatus.paused = false
    await flushPromises()
    expect(w.find('.badge-pause').exists()).toBe(false)
    w.unmount()
  })

  // SP8-P5d Task 9(票 1,治理 §15.1)—— 反转:上面「8.」原断言「点击不 push、只
  // 弹 toast」钉住的正是那个占位契约,占位入口已反转回真正的 router-link,旧断言
  // 必须跟着反转,否则会精确报红(与 `knowledgeRoutes.test.ts` 那套「反转不删」
  // 先例同款做法)。改前(SP8-P2a 原文,反转前):
  //   it('8. 「详情」按钮点击不调 router.push,只弹 toast(P5 前占位契约)', async () => {
  //     const store = useSettingsStore()
  //     stubNetworkActions(store)
  //     const { w, router } = await mountPage()
  //     await flushPromises()
  //     const pushSpy = vi.spyOn(router, 'push')
  //     const toast = useToast()
  //     const showSpy = vi.spyOn(toast, 'show')
  //     await w.find('.set-detail-link').trigger('click')
  //     expect(pushSpy).not.toHaveBeenCalled()
  //     expect(showSpy).toHaveBeenCalledWith('知识库详情页将在后续阶段开启')
  //     w.unmount()
  //   })
  // 改后:`.set-detail-link` 现在是一个真正指向 `/ai/knowledge` 的 RouterLink——
  // 判据钉在元素身份(RouterLink 组件实例 + `to` prop),不是渲染出的 DOM 标签,
  // 因为 <router-link> 在测试路由未注册目标时仍会渲染成 <a>,裸比 tag 名判别力
  // 不够。RED 探针:把产品代码改回占位 `<button>` + toast → 这条必须报红(见任务
  // 报告)。
  it('8. 「详情」是指向 /ai/knowledge 的 RouterLink,不再是弹 toast 的占位按钮(票 1 反转,治理 §15.1)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    const link = w.findComponent(RouterLink)
    expect(link.exists()).toBe(true)
    expect(link.props('to')).toBe('/ai/knowledge')
    expect(link.classes()).toContain('set-detail-link')
    w.unmount()
  })

  it('9. 刷新按钮调用 store.loadServicesStatus', async () => {
    const store = useSettingsStore()
    const spies = stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    const base = spies.services.mock.calls.length
    await w.find('[title="刷新"]').trigger('click')
    expect(spies.services.mock.calls.length).toBe(base + 1)
    w.unmount()
  })
})

describe('SettingsPage — ③ 内容区两种渲染模式', () => {
  it('10. stack 组(model)渲染组内 4 个 .set-stack-item,data-section-id 依次是 models/providers/privacy/thinking', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    const items = w.findAll('.set-stack-item')
    expect(items).toHaveLength(4)
    expect(items.map((i) => i.attributes('data-section-id'))).toEqual([
      'models',
      'providers',
      'privacy',
      'thinking',
    ])
    w.unmount()
  })

  it('11. swap 组(channel)只渲染 1 个分区,没有 .set-stack-item', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    store.setActiveSection('channels')
    await flushPromises()
    expect(w.findAll('.set-stack-item')).toHaveLength(0)
    // 换页确实渲染了别的内容(占位面板),不是空白
    expect(w.find('.sk-section').exists()).toBe(true)
    w.unmount()
  })

  it('12. activeSection=skills 时 .set-body 带 set-body-split 类;activeSection=mcptokens(同组但非 split)时不带', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()

    store.setActiveSection('skills')
    await flushPromises()
    expect(w.find('.set-body').classes()).toContain('set-body-split')

    store.setActiveSection('mcptokens')
    await flushPromises()
    expect(w.find('.set-body').classes()).not.toContain('set-body-split')
    w.unmount()
  })

  // SP8-P2b Task 14 修复轮 1 —— 收口守卫,取代原先直接断言内部常量
  // `SECTION_COMPONENTS` 的写法(协调者裁定:`export` 会让 `<script setup>`
  // 编译失败,而为了可测去拆额外 `<script>` 块是不必要的公开面扩张;改成断言
  // *渲染结果*,不碰组件内部实现)。
  //
  // 判别依据:`SectionPlaceholder.vue` 把 `bodyKey` prop 渲染成
  // `<p class="set-desc">{{ t(props.bodyKey) }}</p>`,而 `SettingsPage.vue`
  // 的 `placeholderProps()` 对占位分区永远传 `bodyKey: 'aiCfgPlaceholderBody'`
  // ——这段文案(`zh.aiCfgPlaceholderBody`)是占位面板独有的,真分区各自
  // 用的是自己的 `aiCfgXxxDesc` 文案键(逐一核对过 `sections/*.vue` 源码,没有
  // 一个真分区复用这个键),所以「页面渲染文本里是否出现这段占位文案」可以
  // 精确区分「真组件」与「SectionPlaceholder」,不需要拿到 `SECTION_COMPONENTS`
  // 本身。
  //
  // agent 组(blacklist/execution/search/memory/observability)是 stack 组,
  // 一次 setActiveSection 会把组内 5 个分区一起渲染出来,断言力度比逐个切更强
  // (5 个分区的真实现只要有 1 个不小心留了占位就会被抓到)。
  //
  // SP8-P3a Task 7 —— `skills` 已接入真组件 `SkillsSection`,从「仍含占位文案」
  // 的 deferred 列表移到「已实现」列表。
  // SP8-P4 Task 9(收官)—— `mcp` 是最后一个占位分区,本任务把它也接入真组件
  // `McpSection`,同样从 deferred 移到 implemented——**13 个分区全部实现**,
  // `deferred` 列表就此清空(与 `sections.ts` 的 `DEFERRED_SECTIONS: SectionId[]
  // = []` 同步)。原本的 deferred 循环(断言「仍含占位文案」)整段删掉:空数组的
  // `for` 循环体永远不执行,留着就是空转断言,不如直接删除,机制层面的钉子已经
  // 由 `sections.test.ts` 的两条新用例(`DEFERRED_SECTIONS` 为空 / 机制仍在)
  // 覆盖,不需要在这里重复一份等价空转的写法。
  it('SP8-P4 收口 —— 13 个已实现分区渲染后页面不含占位文案(无一分区仍是 SectionPlaceholder）', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()

    const implemented: SectionId[] = [
      'models', 'providers', 'privacy', 'thinking',
      'blacklist', 'execution', 'search', 'memory', 'observability', 'skills', 'mcp', 'mcptokens', 'channels',
    ]
    for (const id of implemented) {
      store.setActiveSection(id)
      await flushPromises()
      expect(w.text()).not.toContain(zh.aiCfgPlaceholderBody)
    }

    w.unmount()
  })
})

describe('SettingsPage — ⑤+⑥ 深链契约与生命周期', () => {
  it('13. onMounted 先调 resetTransientUi 再读 ?section=(调用序:resetTransientUi < setActiveSection)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const resetSpy = vi.spyOn(store, 'resetTransientUi')
    const setSpy = vi.spyOn(store, 'setActiveSection')
    const { w } = await mountPage('/ai/settings?section=providers')
    await flushPromises()
    expect(resetSpy).toHaveBeenCalled()
    expect(setSpy).toHaveBeenCalledWith('providers')
    expect(resetSpy.mock.invocationCallOrder[0]).toBeLessThan(setSpy.mock.invocationCallOrder[0])
    w.unmount()
  })

  it('14. 挂载时 ?section=providers 被采纳', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage('/ai/settings?section=providers')
    await flushPromises()
    expect(store.activeSection).toBe('providers')
    w.unmount()
  })

  it('15. 挂载时 ?section=bogus(非法值)被忽略,停在 models(对照组)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage('/ai/settings?section=bogus')
    await flushPromises()
    expect(store.activeSection).toBe('models')
    w.unmount()
  })

  it('16. route.query.section 变化 → 调用 setActiveSection', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w, router } = await mountPage()
    await flushPromises()
    const setSpy = vi.spyOn(store, 'setActiveSection')
    await router.push({ path: '/ai/settings', query: { section: 'memory' } })
    await flushPromises()
    expect(setSpy).toHaveBeenCalledWith('memory')
    expect(store.activeSection).toBe('memory')
    w.unmount()
  })

  it('17. 点导航 emit select → setActiveSection + router.replace 带上新 query', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w, router } = await mountPage()
    await flushPromises()
    const replaceSpy = vi.spyOn(router, 'replace')
    const item = w.findAll('.set-nav-item').find((n) => n.text().includes('隐私与云端'))!
    await item.trigger('click')
    await flushPromises()
    expect(store.activeSection).toBe('privacy')
    expect(replaceSpy).toHaveBeenCalledWith({ path: '/ai/settings', query: { section: 'privacy' } })
    w.unmount()
  })

  it('18. 点导航时若 URL 里已是同一个 section → 不调 router.replace(Vue2 Settings.vue:194 的守卫)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w, router } = await mountPage('/ai/settings?section=privacy')
    await flushPromises()
    const replaceSpy = vi.spyOn(router, 'replace')
    const item = w.findAll('.set-nav-item').find((n) => n.text().includes('隐私与云端'))!
    await item.trigger('click')
    await flushPromises()
    expect(replaceSpy).not.toHaveBeenCalled()
    expect(store.activeSection).toBe('privacy')
    w.unmount()
  })

  // SP8-P3a Task 7 —— skills 已接入真组件 SkillsSection,不再属于
  // DEFERRED_SECTIONS,这条原本断言「弹一条占位 toast」的用例改为断言反面:
  // 渲染出 SkillsSection 真实内容(`.sk-list`,来自 SkillsSection.vue:135,
  // `SectionPlaceholder.vue` 没有这个 class)、页面不含占位文案、且不弹任何
  // toast。
  it('19. 选中 skills → 渲染 SkillsSection 真实内容,不弹 toast(不再是占位)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    const item = w.findAll('.set-nav-item').find((n) => n.text().includes('技能'))!
    await item.trigger('click')
    await flushPromises()
    expect(w.find('.sk-list').exists()).toBe(true)
    expect(w.text()).not.toContain(zh.aiCfgPlaceholderBody)
    expect(showSpy).not.toHaveBeenCalled()
    w.unmount()
  })

  // SP8-P4 Task 9(收官)—— mcp 是最后一个占位分区,本任务接入真组件 McpSection
  // 后不再属于 DEFERRED_SECTIONS。这条原本('19b')断言「仍弹一条占位 toast,
  // DEFERRED_SECTIONS 契约仍在」的用例反转成断言反面:渲染出 McpSection 真实内容
  // (`.sk-col-search`,McpSection 左列的搜索框,来自 McpSection.vue,
  // `SectionPlaceholder.vue` 没有这个 class)、页面不含占位文案、且不弹任何 toast
  // ——与上面 19 条 skills 的写法完全同构。
  it('19b. 选中 mcp → 渲染 McpSection 真实内容,不弹 toast(不再是占位)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    const item = w.findAll('.set-nav-item').find((n) => n.text().includes('MCP 连接'))!
    await item.trigger('click')
    await flushPromises()
    expect(w.find('.sk-col-search').exists()).toBe(true) // McpSection 的左列搜索框
    expect(w.text()).not.toContain(zh.aiCfgPlaceholderBody)
    expect(showSpy).not.toHaveBeenCalled()
    w.unmount()
  })

  it('20. 选中 providers(非 deferred)→ 不弹 toast(对照组)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    const item = w.findAll('.set-nav-item').find((n) => n.text().includes('云端提供商'))!
    await item.trigger('click')
    expect(showSpy).not.toHaveBeenCalled()
    w.unmount()
  })

  it('21. onMounted 依次调用 loadServicesStatus / loadModels / loadProviders / loadPolicy', async () => {
    const store = useSettingsStore()
    const spies = stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    expect(spies.services).toHaveBeenCalledTimes(1)
    expect(spies.models).toHaveBeenCalledTimes(1)
    expect(spies.providers).toHaveBeenCalledTimes(1)
    expect(spies.policy).toHaveBeenCalledTimes(1)
    expect(spies.services.mock.invocationCallOrder[0]).toBeLessThan(spies.models.mock.invocationCallOrder[0])
    expect(spies.models.mock.invocationCallOrder[0]).toBeLessThan(spies.providers.mock.invocationCallOrder[0])
    expect(spies.providers.mock.invocationCallOrder[0]).toBeLessThan(spies.policy.mock.invocationCallOrder[0])
    w.unmount()
  })

  it('22. 其中任一 reject 不阻断后面几个(loadModels reject,loadProviders 仍被调用)', async () => {
    const store = useSettingsStore()
    const spies = stubNetworkActions(store)
    spies.models.mockRejectedValue(new Error('boom'))
    const { w } = await mountPage()
    await flushPromises()
    expect(spies.providers).toHaveBeenCalledTimes(1)
    expect(spies.policy).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('23. 15s 轮询:推进 15000ms → loadServicesStatus 多调一次', async () => {
    vi.useFakeTimers()
    const store = useSettingsStore()
    const spies = stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    const base = spies.services.mock.calls.length
    await vi.advanceTimersByTimeAsync(15000)
    expect(spies.services.mock.calls.length).toBe(base + 1)
    w.unmount()
  })

  it('24. onUnmounted 后再推进 15000ms → 不再新增调用(定时器被清了)', async () => {
    vi.useFakeTimers()
    const store = useSettingsStore()
    const spies = stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    w.unmount()
    const base = spies.services.mock.calls.length
    await vi.advanceTimersByTimeAsync(15000)
    expect(spies.services.mock.calls.length).toBe(base)
  })

  it('25. 返回按钮 → router.push("/ai/agent")', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w, router } = await mountPage()
    await flushPromises()
    const pushSpy = vi.spyOn(router, 'push')
    await w.find('.set-rail-back').trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/ai/agent')
    w.unmount()
  })
})

describe('SettingsPage — D3 下载恢复循环(!job._timer 守卫)', () => {
  it('26. hfImportJobs 里有 downloading 且 _timer:null 的条目 → 挂载后 startImportJob 被调用', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const startSpy = vi.spyOn(store, 'startImportJob').mockImplementation(() => {})
    store.hfImportJobs['model-a.gguf'] = makeImportJob({ status: 'downloading', _timer: null })
    const { w } = await mountPage()
    await flushPromises()
    expect(startSpy).toHaveBeenCalledWith('org/model-a', 'model-a.gguf')
    w.unmount()
  })

  it('27. 同上但 _timer 非 null → 不调用(D3 的守卫,对照组)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const startSpy = vi.spyOn(store, 'startImportJob').mockImplementation(() => {})
    store.hfImportJobs['model-a.gguf'] = makeImportJob({
      status: 'downloading',
      _timer: 999 as unknown as ReturnType<typeof setInterval>,
    })
    const { w } = await mountPage()
    await flushPromises()
    expect(startSpy).not.toHaveBeenCalled()
    w.unmount()
  })

  it('28. 同上但 status:"error" → 不调用(对照组)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const startSpy = vi.spyOn(store, 'startImportJob').mockImplementation(() => {})
    store.hfImportJobs['model-a.gguf'] = makeImportJob({ status: 'error', _timer: null })
    const { w } = await mountPage()
    await flushPromises()
    expect(startSpy).not.toHaveBeenCalled()
    w.unmount()
  })
})

// ── 非清单要求,自选补充 ───────────────────────────────────────────────
// 28 条清单里没有一条真正驱动 IntersectionObserver 回调(jsdom 默认没有这个
// API,setupSpy() 的守卫会直接跳过,这本身已经是清单要求的全部行为)。但
// brief 特别提醒要自己 stub 一个假的验证 scroll-spy 真的接上了线,这里补一条:
// 手动挂一个能捕获构造回调的假 IntersectionObserver,喂 entries,验证(a)高亮
// 切到 boundingClientRect.top 最小的可见分区,(b)不触碰 URL query(Vue2
// Settings.vue:234 的注释)。
describe('SettingsPage — scroll-spy(非清单要求,自选补充覆盖)', () => {
  it('EXTRA. IntersectionObserver 回调高亮视口最上分区,但不改 URL query', async () => {
    let capturedCb: ((entries: unknown[]) => void) | null = null
    class FakeIO {
      constructor(cb: (entries: unknown[]) => void) {
        capturedCb = cb
      }
      observe() {
        /* no-op: 手动喂 entries,不依赖真实布局 */
      }
      disconnect() {
        /* no-op */
      }
    }
    ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIO

    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w, router } = await mountPage()
    await flushPromises()

    expect(capturedCb).not.toBeNull()
    const providersEl = w.find('[data-section-id="providers"]').element
    const modelsEl = w.find('[data-section-id="models"]').element
    capturedCb!([
      { target: providersEl, isIntersecting: true, boundingClientRect: { top: 40 } },
      { target: modelsEl, isIntersecting: true, boundingClientRect: { top: 120 } },
    ])
    await flushPromises()

    expect(store.activeSection).toBe('providers')
    expect(router.currentRoute.value.query.section).toBeUndefined()
    w.unmount()
  })
})
