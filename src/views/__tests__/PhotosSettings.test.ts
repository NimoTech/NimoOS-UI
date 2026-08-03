// SP7-P8a-T5: PhotosSettings.vue —— 设置页容器,接 T3(存储卡)/T4(AI 卡)+ 真路由
// `/photos/settings` + 侧栏入口。回源坐标见 task-5-brief.md 头部与组件文件头注释。
//
// 两张卡各自已有专属单测(PhotosStorageCard.test.ts/PhotosAiCard.test.ts)覆盖卡内部
// 逻辑,这里用 global.stubs 顶替成两个最小 stub(各自带 #storage/#ai 锚点 + 一个能
// emit('toast', ...) 的触发器),只验证容器自己的接线,不重复测卡内部行为——照
// PhotosSearch.test.ts:1056-1060 的既定 stub 写法。
//
// 测试基建偏离登记(brief 与本仓实际不符,以本仓实测为准,详见 task-5-report.md):
// 1. brief Step1 的守卫用例断言"不挂第二份侧栏"写的是
//    `wrapper.findComponent(PhotosSidebar).exists()` 应为 false——但 AreaShell.vue 本身
//    没有侧栏概念(已读源码确认,只有 header/slot),侧栏是每个 /photos/* 视图自己在壳内挂
//    一份(PhotosAlbums.vue:187 的既定先例,本组件同构照抄)。若真按 `false` 断言,等于要求
//    本页完全不挂侧栏——那是实打实的 UX 回归(用户进设置页看不到导航),且直接违反本任务
//    dispatch 明确要求的"照 PhotosAlbums.vue 结构复制"。改为断言"恰好一份"
//    (`findAllComponents(...).length === 1`),这才是"不重复挂"这条不变量真正要守住的东西。
// 2. brief Step1 的"挂载时拉齐五项数据"与 Interface Debt 段("你的容器必须且只能调用这四个,
//    fetchStorage 归 StorageCard 自己")矛盾——本文件以后者为准(更具体、更权威),断言四个
//    显式 action + 一条"fetchStorage 未被容器调用"的反向锁定(防止日后有人加回去造成双取数)。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

vi.mock('@nimotech/nimoos-service', () => ({ service: { photos: {} } }))

import PhotosSettings from '../PhotosSettings.vue'
import PhotosSidebar from '../../photos/components/PhotosSidebar.vue'
import { usePhotosSettingsStore } from '../../photos/stores/settings'

const StorageStub = {
  template:
    '<section id="storage" data-test="storage-card-stub" @click="$emit(\'toast\', { icon: \'trash\', text: \'toast-from-storage\' })"></section>',
}
const AiStub = {
  template:
    '<section id="ai" data-test="ai-card-stub" @click="$emit(\'toast\', { icon: \'sparkles\', text: \'toast-from-ai\' })"></section>',
}

function makeRouter(path: string) {
  const router = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/photos/settings', name: 'photos-settings', component: PhotosSettings },
    ],
  })
  router.push(path)
  return router
}

async function mountView(path = '/photos/settings') {
  const router = makeRouter(path)
  await router.isReady()
  const w = mount(PhotosSettings, {
    global: {
      plugins: [router],
      stubs: { PhotosStorageCard: StorageStub, PhotosAiCard: AiStub },
    },
  })
  await flushPromises()
  await w.vm.$nextTick()
  return w
}

// 同 mountView,但把 router 一并交回去——评审 Important 1 的两条用例需要在挂载*之后*
// 再 router.push 同一路由只改 query,验证"用户已经停留在本页"这条路径(watch,不是
// mounted 那次)。不改 mountView 本身的返回形状,避免动到上面所有既有用例的解构写法。
async function mountViewWithRouter(path = '/photos/settings') {
  const router = makeRouter(path)
  await router.isReady()
  const w = mount(PhotosSettings, {
    global: {
      plugins: [router],
      stubs: { PhotosStorageCard: StorageStub, PhotosAiCard: AiStub },
    },
  })
  await flushPromises()
  await w.vm.$nextTick()
  return { w, router }
}

// jsdom 不实现 scrollIntoView(brief ruling #2)——手动记录调用在哪个元素上,不依赖
// vitest mock 的 this-context API 版本差异。
let scrollCalls: Element[]
// 同时记录每次 querySelector 的参数字符串——"?section= 非法值不滚动"这条不变量,如果只
// 靠 scrollIntoView 是否被调来判断会失真:页面里唯一存在的两个 id 就是 storage/ai,任何
// "非法" 取值(如 Vue2 settings=1 场景的 '1')天然查不到元素,scrollIntoView 不会被调,
// 不管白名单守卫在不在都一样——这条不变量测不出变异。真正要锁住的是"scrollTo 有没有被
// 调用过",用 querySelector 的调用参数直接证明,不依赖它是否命中真实元素。另外
// '#1' 是不合法的 CSS id 选择器(数字开头),jsdom 真实 querySelector 会抛 SyntaxError——
// 这里转发给真实实现但吞掉该错误,不让它变成未处理的 rejection 污染其它用例。
let queryCalls: string[]
beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  scrollCalls = []
  queryCalls = []
  const realQuerySelector = Element.prototype.querySelector
  Element.prototype.querySelector = function (this: Element, selectors: string) {
    queryCalls.push(selectors)
    try {
      return realQuerySelector.call(this, selectors)
    } catch {
      return null
    }
  }
  Element.prototype.scrollIntoView = function (this: Element) { scrollCalls.push(this) }
})
afterEach(() => {
  // 防御性收尾:若某条用例中途抛错,不让 fake timers 状态漏到下一条用例。
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('PhotosSettings 容器', () => {
  it('挂载时调用 fetchAbout/fetchRetention/fetchScanInterval/fetchAiFeatures 四项,不重复调用 fetchStorage', async () => {
    const store = usePhotosSettingsStore()
    const fetchAbout = vi.spyOn(store, 'fetchAbout').mockResolvedValue(undefined)
    const fetchRetention = vi.spyOn(store, 'fetchRetention').mockResolvedValue(undefined)
    const fetchScanInterval = vi.spyOn(store, 'fetchScanInterval').mockResolvedValue(undefined)
    const fetchAiFeatures = vi.spyOn(store, 'fetchAiFeatures').mockResolvedValue(store.aiFeatures)
    const fetchStorage = vi.spyOn(store, 'fetchStorage').mockResolvedValue(undefined)

    await mountView()

    expect(fetchAbout).toHaveBeenCalledTimes(1)
    expect(fetchRetention).toHaveBeenCalledTimes(1)
    expect(fetchScanInterval).toHaveBeenCalledTimes(1)
    expect(fetchAiFeatures).toHaveBeenCalledTimes(1)
    expect(fetchStorage).not.toHaveBeenCalled()
  })

  it('承接卡片的 toast 事件并在 2800ms 后消失', async () => {
    // 先用真实定时器完成挂载(mountView 内部的 flushPromises 靠 setTimeout(0) 落地,
    // 若先开 fake timers 会卡死——挂载稳定后才切 fake timers,只接管 toast 计时这一段)。
    const w = await mountView()
    vi.useFakeTimers()

    await w.get('[data-test="storage-card-stub"]').trigger('click')
    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)
    expect(w.get('[data-test="settings-toast"]').text()).toBe('toast-from-storage')

    await vi.advanceTimersByTimeAsync(2799)
    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(2)
    expect(w.find('[data-test="settings-toast"]').exists()).toBe(false)
    vi.useRealTimers()
  })

  it('连续两次 toast:第二次重置计时,不被第一次的定时器提前掐掉', async () => {
    const w = await mountView()
    vi.useFakeTimers()

    await w.get('[data-test="storage-card-stub"]').trigger('click') // t=0,text=toast-from-storage
    await vi.advanceTimersByTimeAsync(2000) // t=2000,仍在第一条的 2800ms 窗口内
    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)

    await w.get('[data-test="ai-card-stub"]').trigger('click') // t=2000,重置为 text=toast-from-ai
    await vi.advanceTimersByTimeAsync(800) // t=2800(相对第一条的原计时器到点)
    // 若 clearTimeout 没生效,第一条的旧定时器会在这一刻把 toast 提前清掉——这里必须仍可见,
    // 且文本是第二条(证明真的重置了,不是凑巧还没到期)。
    expect(w.find('[data-test="settings-toast"]').exists()).toBe(true)
    expect(w.get('[data-test="settings-toast"]').text()).toBe('toast-from-ai')

    await vi.advanceTimersByTimeAsync(2000) // t=4800,相对第二条(t=2000 起 2800ms)到点
    expect(w.find('[data-test="settings-toast"]').exists()).toBe(false)
    vi.useRealTimers()
  })

  it('?section=ai 挂载后滚到 AI 卡', async () => {
    const w = await mountView('/photos/settings?section=ai')
    expect(scrollCalls).toHaveLength(1)
    expect(scrollCalls[0]).toBe(w.get('#ai').element)
  })

  it('?section=storage 挂载后滚到存储卡', async () => {
    const w = await mountView('/photos/settings?section=storage')
    expect(scrollCalls).toHaveLength(1)
    expect(scrollCalls[0]).toBe(w.get('#storage').element)
  })

  it('?section= 缺失时不滚动', async () => {
    await mountView('/photos/settings')
    expect(scrollCalls).toHaveLength(0)
    expect(queryCalls).not.toContain('#storage')
    expect(queryCalls).not.toContain('#ai')
  })

  // 不能只靠 scrollCalls 判定:页面里唯一存在的两个 id 就是 storage/ai,任何"非法"取值
  // (如 Vue2 settings=1 场景的字符串 '1')天然查不到元素、scrollIntoView 天然不会被调——
  // 不管白名单守卫在不在都一样,这条不变量单靠 scrollCalls 测不出变异(已实测验证,见
  // task-5-report.md 变异验证记录)。真正要锁住的是"scrollTo(非法值) 有没有被调用过",
  // 用 querySelector 的调用参数直接证明——若白名单被去掉,scrollTo('1') 会被调,进而触发
  // 一次 `querySelector('#1')`,即便查不到元素依然会留下这条调用记录。
  it('?section= 非法值(如 "1",Vue2 里 settings=1 只表示"打开"而非目标 id)时不滚动', async () => {
    await mountView('/photos/settings?section=1')
    expect(scrollCalls).toHaveLength(0)
    expect(queryCalls).not.toContain('#1')
  })

  // 评审 Important 1(2026-08-04):vue-router 4 对同一路由组件只 query 变化不重新
  // mount——用户已经停留在 /photos/settings(无 section)时,若 query 变成
  // ?section=ai(手改地址栏,或未来页面内某个指向本页的链接),onMounted 不会重触发,
  // 必须靠 watch 补上这条路径。
  it('已停留在本页时 query 才变为 ?section=ai——watch 路径补上滚动(不靠重新 mount)', async () => {
    const { w, router } = await mountViewWithRouter('/photos/settings')
    expect(scrollCalls).toHaveLength(0) // mounted 时没有 section,先确认起点确实没滚

    await router.push('/photos/settings?section=ai') // 只改 query,同一路由组件不重新 mount
    await flushPromises()
    await w.vm.$nextTick()

    expect(scrollCalls).toHaveLength(1)
    expect(scrollCalls[0]).toBe(w.get('#ai').element)
  })

  // 同一条路径上白名单依旧生效——不能因为补了 watch 就把非法值放过去。
  it('已停留在本页时 query 才变为 ?section=1(非法值)——watch 路径同样不滚动', async () => {
    const { w, router } = await mountViewWithRouter('/photos/settings')

    await router.push('/photos/settings?section=1')
    await flushPromises()
    await w.vm.$nextTick()

    expect(scrollCalls).toHaveLength(0)
    expect(queryCalls).not.toContain('#1')
  })

  it('页脚:version 缺失时不渲染 "· v" 片段', async () => {
    const store = usePhotosSettingsStore()
    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
      store.about = { version: '', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
    })
    const w = await mountView()
    expect(w.find('.ps-footer-app').text()).not.toMatch(/·\s*v/)
  })

  it('页脚:version 存在时渲染 "· v{version}"', async () => {
    const store = usePhotosSettingsStore()
    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
      store.about = { version: '2.3.0', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
    })
    const w = await mountView()
    expect(w.get('.ps-footer-app').text()).toContain('v2.3.0')
  })

  it('页脚:librarySince 缺失时整段不渲染', async () => {
    const store = usePhotosSettingsStore()
    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
      store.about = { version: '1.0.0', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '' }
    })
    const w = await mountView()
    expect(w.get('.ps-footer-host').text()).not.toContain('建库于')
  })

  it('页脚:librarySince 存在时渲染 "· 建库于 {date}"', async () => {
    const store = usePhotosSettingsStore()
    vi.spyOn(store, 'fetchAbout').mockImplementation(async () => {
      store.about = { version: '1.0.0', deviceName: 'MyNAS', indexCoverage: 0, indexLastBuilt: '', librarySince: '2026-01-15T00:00:00Z' }
    })
    const w = await mountView()
    expect(w.get('.ps-footer-host').text()).toContain('建库于')
  })

  it('页脚:运行于 {deviceName},about 缺失时兜底 NAS', async () => {
    const w = await mountView()
    expect(w.get('.ps-footer-host').text()).toContain('运行于')
    expect(w.get('.ps-footer-host').text()).toContain('NAS')
  })

  // 架构偏离守卫 1/2(见文件头 + 组件头注释四条登记)。
  it('侧栏只挂一份(不是"AreaShell 自动生成"、也不是重复挂两份)', async () => {
    const w = await mountView()
    expect(w.findAllComponents(PhotosSidebar)).toHaveLength(1)
  })

  it('不渲染登出入口(D22)', async () => {
    const w = await mountView()
    expect(w.text()).not.toMatch(/登出|Sign out/)
  })

  it('快速导航:点击锚点滚动到对应卡片', async () => {
    const w = await mountView()
    await w.get('.ps-quicknav a[href="#ai"]').trigger('click')
    expect(scrollCalls).toHaveLength(1)
    expect(scrollCalls[0]).toBe(w.get('#ai').element)
    await w.get('.ps-quicknav a[href="#storage"]').trigger('click')
    expect(scrollCalls).toHaveLength(2)
    expect(scrollCalls[1]).toBe(w.get('#storage').element)
  })
})

describe('路由:/photos/settings 只追加,不重排', () => {
  it('/photos/settings 出现在源文本里最后一条既有 /photos/* 路由(/photos/search)之后', () => {
    // ⚠️ 用 node:fs 读源文本行序断言,不用 router.getRoutes()——vue-router 4 的
    // getRoutes() 会把动态段路由排到静态之前(P6b 已查实,global-constraints.md 记录)。
    const src = readFileSync('src/router/index.ts', 'utf8')
    expect(src.length).toBeGreaterThan(0)
    const idxSettings = src.indexOf("'/photos/settings'")
    const idxSearch = src.indexOf("'/photos/search'")
    expect(idxSettings).toBeGreaterThan(-1)
    expect(idxSearch).toBeGreaterThan(-1)
    expect(idxSettings).toBeGreaterThan(idxSearch)
  })
})
