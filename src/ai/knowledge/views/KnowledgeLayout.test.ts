// SP8-P5a Task 10 —— KnowledgeLayout 外壳测试。
// 测试骨架逐字取自任务 brief(`.superpowers/sdd/p5a-task-10-brief.md` Step 2），
// 按治理文件 §9「测试质量」与协调者追加要求补强了三类断言（见每处注释标注
// 「补强」）：
//   1) rail 的 [data-active] 断言从「只查当前项+一项对照」扩到「当前项 true、
//      其余全部 8 项 false」——只测一项对照抓不到「全都 active」的回归。
//   2) 移动端 tabs 补了前 4 项文案与 NAV 前 4 项一致的断言（brief 原版只测数量
//      与 data-active）。
//   3) K8 rail 页脚用户名补了 4 种 localStorage 形态的独立用例（brief 原版没有
//      覆盖这块——K8 是本任务在治理文件里被单独点名的写法，必须有回归钉子）。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

// 【测试脚手架 bug,已修正】brief Step 2 原文没有 mock `@nimotech/nimoos-service`。
// `onMounted` 会真的调用 `store.loadOverview()`/`refreshNotesDraftCount()`,在没
// spy 掉这两个 action 的用例里(比如「unreachable 时出警示条」),jsdom 环境下的
// 真实网络请求会失败并把 `unreachable` 提前置 true,导致「初始不出警示条」断言
// 假红——这是网络竞态,不是实现的 bug。照 T6 `knowledgeStore.parser.test.ts`
// 已确立的 `vi.hoisted` + `vi.mock('@nimotech/nimoos-service', …)` 写法补上,
// 让未显式 spy loadOverview 的用例也能拿到确定性的空结果。
const ai = vi.hoisted(() => ({
  parserStats: vi.fn().mockResolvedValue({
    queue_depth: { pending: 0, running: 0, failed: 0, done: 0 },
    indexed_files: 0,
    total_vectors_text: 0,
    total_vectors_visual: 0,
    last_cursor_ms: 0,
  }),
  parserState: vi.fn().mockResolvedValue({
    paused: false,
    concurrency: 2,
    device: 'auto',
    resolved_device: 'cpu',
    ocr_enabled: false,
  }),
}))
const notes = vi.hoisted(() => ({ list: vi.fn().mockResolvedValue([]) }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai, notes } }))

import { i18n } from '../../../i18n'
import KnowledgeLayout from './KnowledgeLayout.vue'
import { useKnowledgeStore } from '../stores/knowledgeStore'

// 真实 i18n(不许手写子集 —— P1c2 记账 minor:手写子集会让键名拼错抓不到)
//
// 【测试脚手架 bug,已修正】brief Step 2 原文把顶层路由 `/ai/knowledge` 的
// `component` 也设成 `KnowledgeLayout`,同时又把 `KnowledgeLayout` 直接
// mount 成测试根组件。这会导致 KnowledgeLayout 模板里那唯一一个
// `<router-view/>` 在渲染树里没有任何「外层 router-view」注入 depth,于是它
// 自己就是 depth 0——而 depth 0 匹配到的恰好还是 `KnowledgeLayout` 自身,
// 于是它把自己再渲染一遍(第二遍里 depth 1 才真正匹配到 Stub)。实测过:
// `w.findAll('.knowledge-app')` 长度为 2、`.k-rail-item` 从 9 变 18、
// `loadOverview` 因 onMounted 触发两次而被记两次——全部指向同一个根因,不是
// 实现的 bug。生产环境不会有这个问题:真正挂载 KnowledgeLayout 的是
// App.vue 自己的最外层 `<router-view/>`(depth 0 在那一层被吃掉),
// KnowledgeLayout 内部的 `<router-view/>` 因此天然是 depth 1,匹配到的是
// 子页面而不是自己。这里改成扁平路由(顶层路径直接指向 Stub,不再让
// KnowledgeLayout 出现在路由表里),单测里 KnowledgeLayout 的
// `<router-view/>` 就是 depth 0,直接匹配到 Stub,行为与生产环境（只是深度
// 平移了一层）等价,且不再自我递归。
const Stub = { template: '<div class="stub-child"/>' }
function makeRouter(path = '/ai/knowledge') {
  const router = createRouter({
    history: createWebHashHistory('/app/'),
    routes: [
      { path: '/ai/knowledge', name: 'KnowledgeDashboard', component: Stub },
      { path: '/ai/knowledge/wiki', name: 'KnowledgeWiki', component: Stub },
      { path: '/ai/knowledge/queue', name: 'KnowledgeQueue', component: Stub },
      { path: '/ai/knowledge/notes', name: 'KnowledgeNotes', component: Stub },
      { path: '/ai/knowledge/settings', name: 'KnowledgeSettings', component: Stub },
    ],
  })
  router.push(path)
  return router
}
async function mountLayout(path?: string) {
  const router = makeRouter(path)
  await router.isReady()
  const w = mount(KnowledgeLayout, { global: { plugins: [router, i18n] } } as never)
  await flushPromises()
  return { w, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  localStorage.clear()
})

describe('KnowledgeLayout — rail', () => {
  it('渲染 9 个导航项,顺序与 Vue2 一致', async () => {
    const { w } = await mountLayout()
    const items = w.findAll('.k-rail-item')
    expect(items).toHaveLength(9)
    expect(items.map((i) => i.find('.k-rail-item-en').text())).toEqual([
      'Dashboard',
      'Search',
      'Wiki',
      'Notes',
      'Indexed Files',
      'Queue',
      'Index Roots',
      'Allowlist',
      'Settings',
    ])
  })

  it('每项 href 是 hash 深链,dashboard 不带子路径', async () => {
    const { w } = await mountLayout()
    const hrefs = w.findAll('.k-rail-item').map((i) => i.attributes('href'))
    expect(hrefs[0]).toBe('#/ai/knowledge')
    expect(hrefs[1]).toBe('#/ai/knowledge/search')
    expect(hrefs[8]).toBe('#/ai/knowledge/settings')
  })

  it('当前 tab 的 data-active 为 "true",其余全部 8 项为 "false"(补强:原版只对照两项,抓不到「全都 active」的回归)', async () => {
    const { w } = await mountLayout('/ai/knowledge/queue')
    const items = w.findAll('.k-rail-item')
    items.forEach((item, idx) => {
      expect(item.attributes('data-active')).toBe(idx === 5 ? 'true' : 'false')
    })
  })

  it('点导航项走 router.push,已在当前页则不 push', async () => {
    const { w, router } = await mountLayout('/ai/knowledge/queue')
    const push = vi.spyOn(router, 'push')
    await w.findAll('.k-rail-item')[5].trigger('click')
    expect(push).not.toHaveBeenCalled()
    await w.findAll('.k-rail-item')[3].trigger('click')
    expect(push).toHaveBeenCalledWith('/ai/knowledge/notes')
  })

  // 【评审 Important 开放发现 3,2026-08-01 补】rail 9 项与移动端 5 项的图标名
  // (NAV[].icon)跟 KIcon.PATHS 之间没有任何断言绑定——KIcon.test.ts 那份 22 项
  // 硬编码数组与 NAV 完全解耦,如果 NAV 里某个图标名手滑写错(比如 KIcon 内部改名
  // 后 NAV 忘了同步),KIcon 会静默渲染一个空 `<svg></svg>`(可见的空白图标),但
  // 现有用例(渲染 9 个导航项/href/data-active)全都不看 svg 内容,抓不到。
  // RED 探针实测:把 `NAV[0].icon` 从 'home' 改成 'homez' → 全量全绿。
  it('rail 9 项与移动端 5 项渲染出的 svg 图标内容非空(防 NAV 图标名手滑成不存在的 glyph)', async () => {
    const { w } = await mountLayout()
    const railSvgs = w.findAll('.k-rail-item svg')
    expect(railSvgs).toHaveLength(9)
    railSvgs.forEach((svg, idx) => {
      expect(svg.element.innerHTML, `rail item #${idx} 的图标渲染为空`).not.toBe('')
    })
    const mobileSvgs = w.findAll('.k-mobile-tab svg')
    expect(mobileSvgs).toHaveLength(5)
    mobileSvgs.forEach((svg, idx) => {
      expect(svg.element.innerHTML, `移动端 tab #${idx} 的图标渲染为空`).not.toBe('')
    })
  })
})

describe('KnowledgeLayout — router-view 出口', () => {
  // 【评审 Minor,2026-08-01 补】`<router-view/>` 渲染出的子页面(测试里是 Stub)
  // 之前没有任何用例查过,补一条最基础的存在性断言。
  it('渲染当前路由匹配的子组件', async () => {
    const { w } = await mountLayout()
    expect(w.find('.stub-child').exists()).toBe(true)
  })
})

describe('KnowledgeLayout — 徽标', () => {
  it('failed > 0 时 queue 出数字徽标,=0 时不出', async () => {
    const { w } = await mountLayout()
    const s = useKnowledgeStore()
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 3, done: 0 } }
    await flushPromises()
    const queueItem = w.findAll('.k-rail-item')[5]
    expect(queueItem.find('.k-badge').text()).toBe('3')
    s.stats = { ...s.stats, queue_depth: { pending: 0, running: 0, failed: 0, done: 0 } }
    await flushPromises()
    expect(w.findAll('.k-rail-item')[5].find('.k-badge').exists()).toBe(false)
  })

  it('草稿 > 0 时 notes 徽标带 data-tone="warn"', async () => {
    const { w } = await mountLayout()
    useKnowledgeStore().setNotesDraftCount(2)
    await flushPromises()
    const badge = w.findAll('.k-rail-item')[3].find('.k-badge')
    expect(badge.text()).toBe('2')
    expect(badge.attributes('data-tone')).toBe('warn')
  })
})

describe('KnowledgeLayout — 索引器状态块', () => {
  it('三态:unreachable → error/离线;paused → paused/已暂停;否则 running/已收录数', async () => {
    const { w } = await mountLayout()
    const s = useKnowledgeStore()
    s.unreachable = true
    await flushPromises()
    expect(w.find('.k-rail-svc-dot').attributes('data-state')).toBe('error')
    expect(w.find('.k-rail-svc-meta').text()).toBe('离线')

    s.unreachable = false
    s.controlState = { ...s.controlState, paused: true }
    await flushPromises()
    expect(w.find('.k-rail-svc-dot').attributes('data-state')).toBe('paused')
    expect(w.find('.k-rail-svc-meta').text()).toBe('已暂停')

    s.controlState = { ...s.controlState, paused: false }
    s.stats = { ...s.stats, indexed_files: 1234 }
    await flushPromises()
    expect(w.find('.k-rail-svc-dot').attributes('data-state')).toBe('running')
    // 【终审 Minor,收紧】原 toContain('1,234') 是弱断言——'11,234'.includes('1,234')
    // 为真,读错字段拿到 11234 这类错抓不到。改成整串精确匹配(toLocaleString 输出）。
    expect(w.find('.k-rail-svc-meta').text()).toBe('运行中 · 1,234 已收录')
  })
})

describe('KnowledgeLayout — topbar / banner', () => {
  it('标题与副标题按当前 tab 取 TITLES,dashboard 的副标题不带子路径', async () => {
    const { w } = await mountLayout()
    expect(w.find('.k-topbar-title').text()).toBe('概览')
    expect(w.find('.k-topbar-sub').text()).toBe('Dashboard · /ai/knowledge')
  })

  it('N8:rail 第 9 项是「系统设置」而 topbar 标题是「高级设置」', async () => {
    const { w } = await mountLayout('/ai/knowledge/settings')
    expect(w.findAll('.k-rail-item')[8].find('.k-rail-item-cn').text()).toBe('系统设置')
    expect(w.find('.k-topbar-title').text()).toBe('高级设置')
    // 补强:显式断言两者不相等,防止未来有人把两个键合并成一个(N8 的直接回归钉子)。
    expect(w.findAll('.k-rail-item')[8].find('.k-rail-item-cn').text()).not.toBe(
      w.find('.k-topbar-title').text(),
    )
  })

  // 【评审 Important 开放发现 4,2026-08-01 补】TITLES 9 项原来只钉住 dashboard(默认档)
  // 与 settings(N8)两项,wiki/queue 两项跟 N8 同性质的「titleKey 与 nav 短语不同」
  // 刻意差异(Wiki vs Wiki map、Queue vs Job Queue)零覆盖;`.k-topbar-sub` 也只测过
  // dashboard 那条「不带子路径」分支,`'/' + currentTab` 那条分支从没有对照用例
  // (治理文件 §9:「A 与 B 二选一必须两边都有对照用例」)。
  // RED 探针实测:把 `TITLES.queue.titleKey` 从 'aiKbTitleJobQueue' 改成
  // 'aiKbNavQueue'(与 nav 键合并)→ queue 用例精确报红。
  it('wiki:标题取 aiKbTitleWikiMap,副标题带 /wiki 子路径', async () => {
    const { w } = await mountLayout('/ai/knowledge/wiki')
    expect(w.find('.k-topbar-title').text()).toBe('Wiki 导航')
    expect(w.find('.k-topbar-sub').text()).toBe('Wiki · /ai/knowledge/wiki')
  })

  it('queue:标题取 aiKbTitleJobQueue(≠ nav 的「任务」),副标题带 /queue 子路径(主钉子,判别力强于 wiki)', async () => {
    const { w } = await mountLayout('/ai/knowledge/queue')
    expect(w.find('.k-topbar-title').text()).toBe('任务队列')
    expect(w.find('.k-topbar-sub').text()).toBe('Job Queue · /ai/knowledge/queue')
    // wiki 与 nav 中文值恰好都是「Wiki 导航」(N8 说明栏已注),判别力天然弱;
    // queue 的 nav 中文是「任务」、title 中文是「任务队列」,两者不同,才是真正的钉子。
    expect(w.find('.k-topbar-title').text()).not.toBe('任务')
  })

  it('unreachable 时出警示条,否则不出', async () => {
    const { w } = await mountLayout()
    expect(w.find('.k-banner').exists()).toBe(false)
    useKnowledgeStore().unreachable = true
    await flushPromises()
    expect(w.find('.k-banner').attributes('data-tone')).toBe('warn')
  })

  it('刷新按钮重载 overview 并 toast', async () => {
    const { w } = await mountLayout()
    const s = useKnowledgeStore()
    const load = vi.spyOn(s, 'loadOverview').mockResolvedValue()
    const toast = vi.spyOn(s, 'toast')
    await w.find('.k-topbar .k-btn.ghost').trigger('click')
    await flushPromises()
    expect(load).toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('已刷新')
  })
})

describe('KnowledgeLayout — 移动端 tabs', () => {
  it('只渲染前 4 项 + More,More 在后 5 个 tab 任一激活时高亮', async () => {
    const { w } = await mountLayout('/ai/knowledge/queue')
    const tabs = w.findAll('.k-mobile-tab')
    expect(tabs).toHaveLength(5)
    expect(tabs[4].attributes('data-active')).toBe('true')
    expect(tabs[0].attributes('data-active')).toBe('false')
  })

  it('前 4 项文案与 NAV 前 4 项一致(补强:brief 原版没测内容,只测了数量)', async () => {
    const { w } = await mountLayout()
    const tabs = w.findAll('.k-mobile-tab')
    expect(tabs.slice(0, 4).map((t) => t.find('span').text())).toEqual([
      '概览',
      '搜索',
      'Wiki 导航',
      '笔记',
    ])
    expect(tabs[4].find('span').text()).toBe('浏览更多')
  })

  it('More 跳到 allowlist(照抄 Vue2)', async () => {
    const { w, router } = await mountLayout()
    const push = vi.spyOn(router, 'push')
    await w.findAll('.k-mobile-tab')[4].trigger('click')
    expect(push).toHaveBeenCalledWith('/ai/knowledge/allowlist')
  })
})

describe('KnowledgeLayout — K8 rail 页脚用户名', () => {
  // 补强(brief 原版没有覆盖):K8 是治理文件单独点名、逐字复用
  // SettingsRail.vue:75-86 的写法,必须有独立回归钉子,四种 localStorage 形态各一条。
  it('localStorage 里有 nickname 时优先显示 nickname', async () => {
    localStorage.setItem('user', JSON.stringify({ nickname: '阿囧', username: 'jiong' }))
    const { w } = await mountLayout()
    expect(w.find('.k-rail-foot').text()).toBe('NimoOS · 阿囧')
  })

  it('只有 username 时回落到 username', async () => {
    localStorage.setItem('user', JSON.stringify({ username: 'jiong' }))
    const { w } = await mountLayout()
    expect(w.find('.k-rail-foot').text()).toBe('NimoOS · jiong')
  })

  it('localStorage 里的 JSON 损坏时回落到「你」', async () => {
    localStorage.setItem('user', '{not valid json')
    const { w } = await mountLayout()
    expect(w.find('.k-rail-foot').text()).toBe('NimoOS · 你')
  })

  it('localStorage 没有 user 键时回落到「你」', async () => {
    const { w } = await mountLayout()
    expect(w.find('.k-rail-foot').text()).toBe('NimoOS · 你')
  })
})

describe('KnowledgeLayout — 生命周期', () => {
  it('挂载时拉一次 overview 与草稿数', async () => {
    setActivePinia(createPinia())
    const s = useKnowledgeStore()
    const load = vi.spyOn(s, 'loadOverview').mockResolvedValue()
    const draft = vi.spyOn(s, 'refreshNotesDraftCount').mockResolvedValue()
    await mountLayout()
    expect(load).toHaveBeenCalledTimes(1)
    expect(draft).toHaveBeenCalledTimes(1)
  })

  it('10 秒轮询;document.hidden 时跳过;卸载时清定时器', async () => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    const s = useKnowledgeStore()
    const load = vi.spyOn(s, 'loadOverview').mockResolvedValue()
    vi.spyOn(s, 'refreshNotesDraftCount').mockResolvedValue()
    const router = makeRouter()
    await router.isReady()
    const w = mount(KnowledgeLayout, { global: { plugins: [router, i18n] } } as never)
    expect(load).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10000)
    expect(load).toHaveBeenCalledTimes(2)
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    vi.advanceTimersByTime(10000)
    expect(load).toHaveBeenCalledTimes(2) // 跳过
    hidden.mockReturnValue(false)
    vi.advanceTimersByTime(10000)
    expect(load).toHaveBeenCalledTimes(3)
    w.unmount()
    vi.advanceTimersByTime(30000)
    expect(load).toHaveBeenCalledTimes(3) // 已清
    vi.useRealTimers()
  })
})
