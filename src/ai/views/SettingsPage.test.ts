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
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import zh from '../../i18n/zh_cn'

const ai = vi.hoisted(() => ({
  getServicesStatus: vi.fn(),
  listModels: vi.fn(),
  listProviders: vi.fn(),
  getPolicy: vi.fn(),
  getImportStatus: vi.fn(),
  cancelImport: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))

import SettingsPage, { SECTION_COMPONENTS } from './SettingsPage.vue'
import SectionPlaceholder from '../components/settings/SectionPlaceholder.vue'
import { useSettingsStore } from '../stores/settingsStore'
import type { ImportJob } from '../stores/settingsStore'
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

  it('8. 「详情」按钮点击不调 router.push,只弹 toast(P5 前占位契约)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w, router } = await mountPage()
    await flushPromises()
    const pushSpy = vi.spyOn(router, 'push')
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    await w.find('.set-detail-link').trigger('click')
    expect(pushSpy).not.toHaveBeenCalled()
    expect(showSpy).toHaveBeenCalledWith('知识库详情页将在后续阶段开启')
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

  it('19. 选中 skills → 弹一条 toast(DEFERRED_SECTIONS 契约)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    const item = w.findAll('.set-nav-item').find((n) => n.text().includes('技能'))!
    await item.trigger('click')
    expect(showSpy).toHaveBeenCalledWith('该分区将在后续阶段开启', 3000)
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

  it('SP8-P2b 收口 —— 11 个已实现分区都不是占位，skills/mcp 仍是占位', () => {
    const implemented: (keyof typeof SECTION_COMPONENTS)[] = [
      'models', 'providers', 'privacy', 'thinking',
      'blacklist', 'execution', 'search', 'memory', 'observability', 'mcptokens', 'channels',
    ]
    for (const id of implemented) {
      expect(SECTION_COMPONENTS[id]).toBeDefined()
      expect(SECTION_COMPONENTS[id]).not.toBe(SectionPlaceholder)
    }
    expect(SECTION_COMPONENTS.skills).toBe(SectionPlaceholder)
    expect(SECTION_COMPONENTS.mcp).toBe(SectionPlaceholder)
  })
})
