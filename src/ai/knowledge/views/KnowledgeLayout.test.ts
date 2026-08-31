// KnowledgeLayout shell test.
// Test skeleton is copied verbatim from the task brief (a captured device response Step 2),
// with three classes of assertions strengthened per governance doc §9 "Test Quality" and
// coordinator requests (marked "strengthened" at each location):
//   1) rail [data-active] assertion expanded from "check current item + one reference" to
//      "current item true, all other 8 items false" — checking only one reference misses
//      the "all active" regression.
//   2) mobile tabs gained assertion that first 4 labels match NAV's first 4 items (original
//      brief only tested count and data-active).
//   3) K8 rail footer username gained 4 independent test cases for different localStorage states
//      (original brief had no coverage — K8 is the write pattern explicitly named in the
//      governance doc, so it needs a regression hook).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

// [Test scaffolding bug, fixed] The original brief Step 2 did not mock
// `@nimotech/nimoos-service`. `onMounted` will actually call
// `store.loadOverview()`/`refreshNotesDraftCount()`. In test cases that don't spy on
// these two actions (e.g., "warning banner appears when unreachable"), real network
// requests in the jsdom environment fail and prematurely set `unreachable` to true,
// causing the "no warning banner initially" assertion to false-positive — this is a
// network race condition, not an implementation bug. Following the established
// `vi.hoisted` + `vi.mock('@nimotech/nimoos-service', …)` pattern in T6's
// `knowledgeStore.parser.test.ts`, we add the mock so test cases that don't explicitly
// spy on loadOverview also get deterministic empty results.
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

// Real i18n (don't hand-write a subset — P1c2 entry: hand-writing subsets causes key
// name typos to go undetected)
//
// [Test scaffolding bug, fixed] The original brief Step 2 set the top-level route
// `/ai/knowledge`'s `component` to `KnowledgeLayout` while also directly mounting
// `KnowledgeLayout` as the test root component. This causes the single `<router-view/>`
// in KnowledgeLayout's template to have no "outer router-view" injected depth in the
// render tree, so it becomes depth 0 itself — and depth 0 happens to match
// `KnowledgeLayout` itself, so it re-renders itself (depth 1 in the second render
// finally matches the Stub). Empirically observed: `w.findAll('.knowledge-app')` length
// is 2, `.k-rail-item` goes from 9 to 18, `loadOverview` is counted twice because
// onMounted fires twice — all point to the same root cause, not an implementation bug.
// Production has no such issue: the real parent of KnowledgeLayout is App.vue's
// outermost `<router-view/>` (depth 0 is consumed there), so KnowledgeLayout's inner
// `<router-view/>` is naturally depth 1, matching child pages not itself. Here we
// flatten the routes (top-level path points directly to Stub, KnowledgeLayout no
// longer appears in the route table). Now in unit tests KnowledgeLayout's
// `<router-view/>` is depth 0, matches Stub directly, behaves equivalently to
// production (just shifted one level deeper) and doesn't self-recurse.
const Stub = { template: '<div class="stub-child"/>' }
function makeRouter(path = '/ai/knowledge') {
  const router = createRouter({
    history: createWebHashHistory('/'),
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
  it('renders 9 nav items in the same order as Vue2', async () => {
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

  it('each item has a hash deep link, dashboard has no subpath', async () => {
    const { w } = await mountLayout()
    const hrefs = w.findAll('.k-rail-item').map((i) => i.attributes('href'))
    expect(hrefs[0]).toBe('#/ai/knowledge')
    expect(hrefs[1]).toBe('#/ai/knowledge/search')
    expect(hrefs[8]).toBe('#/ai/knowledge/settings')
  })

  it('current tab has data-active="true", other 8 items have "false" (strengthened: original only compared two, misses "all active" regression)', async () => {
    const { w } = await mountLayout('/ai/knowledge/queue')
    const items = w.findAll('.k-rail-item')
    items.forEach((item, idx) => {
      expect(item.attributes('data-active')).toBe(idx === 5 ? 'true' : 'false')
    })
  })

  it('clicking nav items calls router.push, no push if already on current page', async () => {
    const { w, router } = await mountLayout('/ai/knowledge/queue')
    const push = vi.spyOn(router, 'push')
    await w.findAll('.k-rail-item')[5].trigger('click')
    expect(push).not.toHaveBeenCalled()
    await w.findAll('.k-rail-item')[3].trigger('click')
    expect(push).toHaveBeenCalledWith('/ai/knowledge/notes')
  })

  // [Review Important finding 3, added 2026-08-01] Icon names (NAV[].icon) and
  // KIcon.PATHS have no assertion binding — KIcon.test.ts's hardcoded 22-item array is
  // completely decoupled from NAV. If an icon name in NAV has a typo (e.g., NAV forgets
  // to sync after KIcon renames internally), KIcon silently renders an empty `<svg></svg>`
  // (visible blank icon), but existing test cases (render 9 nav items / href / data-active)
  // never inspect svg content, so they miss it. RED probe confirmed: changing
  // `NAV[0].icon` from 'home' to 'homez' → all tests still pass.
  it('rail 9 items and mobile 5 items render non-empty svg icons (guard against NAV icon name typos becoming non-existent glyphs)', async () => {
    const { w } = await mountLayout()
    const railSvgs = w.findAll('.k-rail-item svg')
    expect(railSvgs).toHaveLength(9)
    railSvgs.forEach((svg, idx) => {
      expect(svg.element.innerHTML, `rail item #${idx} icon renders empty`).not.toBe('')
    })
    const mobileSvgs = w.findAll('.k-mobile-tab svg')
    expect(mobileSvgs).toHaveLength(5)
    mobileSvgs.forEach((svg, idx) => {
      expect(svg.element.innerHTML, `mobile tab #${idx} icon renders empty`).not.toBe('')
    })
  })
})

describe('KnowledgeLayout — rail back button (replaces the former title / "RAG · NimoOS" head)', () => {
  it('the rail head holds only the back button; the old title/sub text is gone', async () => {
    const { w } = await mountLayout()
    expect(w.find('.k-rail-title').exists()).toBe(false)
    expect(w.find('.k-rail-sub').exists()).toBe(false)
    expect(w.find('.k-rail').text()).not.toContain('RAG · NimoOS')
    const back = w.find('.k-rail-head [data-test="back"]')
    expect(back.exists()).toBe(true)
    expect(back.text()).toBe('返回')
    // First thing in the rail = top-left of the page.
    expect(w.find('.k-rail > *').element).toBe(w.find('.k-rail-head').element)
  })

  it('click → router.push("/") when the tab has history', async () => {
    const historySpy = vi.spyOn(window.history, 'length', 'get').mockReturnValue(2)
    const { w, router } = await mountLayout('/ai/knowledge/queue')
    const push = vi.spyOn(router, 'push').mockResolvedValue(undefined)
    await w.find('[data-test="back"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/')
    historySpy.mockRestore()
  })

  it('click → hard-navigates to / when the tab has no history (opened fresh from the launcher)', async () => {
    const historySpy = vi.spyOn(window.history, 'length', 'get').mockReturnValue(1)
    const original = window.location
    const loc = { ...original, href: '' } as unknown as Location
    Object.defineProperty(window, 'location', { value: loc, writable: true, configurable: true })
    try {
      const { w, router } = await mountLayout()
      const push = vi.spyOn(router, 'push')
      await w.find('[data-test="back"]').trigger('click')
      expect(push).not.toHaveBeenCalled()
      expect(loc.href).toBe('/')
    } finally {
      Object.defineProperty(window, 'location', { value: original, writable: true, configurable: true })
      historySpy.mockRestore()
    }
  })
})

describe('KnowledgeLayout — router-view outlet', () => {
  // [Review Minor, added 2026-08-01] The child page rendered by `<router-view/>`
  // (Stub in tests) was never tested before. Adding a basic existence assertion.
  it('renders the child component matched by the current route', async () => {
    const { w } = await mountLayout()
    expect(w.find('.stub-child').exists()).toBe(true)
  })
})

describe('KnowledgeLayout — badges', () => {
  it('queue shows numeric badge when failed > 0, no badge when =0', async () => {
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

  it('notes badge has data-tone="warn" when draft count > 0', async () => {
    const { w } = await mountLayout()
    useKnowledgeStore().setNotesDraftCount(2)
    await flushPromises()
    const badge = w.findAll('.k-rail-item')[3].find('.k-badge')
    expect(badge.text()).toBe('2')
    expect(badge.attributes('data-tone')).toBe('warn')
  })
})

describe('KnowledgeLayout — indexer status block', () => {
  it('three states: unreachable → error/offline; paused → paused/paused; else running/indexed count', async () => {
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
    // [Final review Minor, tightened] Original toContain('1,234') was weak assertion — '11,234'.includes('1,234')
    // is true, misses errors like reading wrong field and getting 11234. Changed to exact
    // full-string match (toLocaleString output).
    expect(w.find('.k-rail-svc-meta').text()).toBe('运行中 · 1,234 已收录')
  })
})

describe('KnowledgeLayout — topbar / banner', () => {
  it('title and subtitle are taken from TITLES for current tab, dashboard subtitle has no subpath', async () => {
    const { w } = await mountLayout()
    expect(w.find('.k-topbar-title').text()).toBe('概览')
    expect(w.find('.k-topbar-sub').text()).toBe('Dashboard · /ai/knowledge')
  })

  it('N8: rail item 9 is "System Settings" while topbar title is "Advanced Settings"', async () => {
    const { w } = await mountLayout('/ai/knowledge/settings')
    expect(w.findAll('.k-rail-item')[8].find('.k-rail-item-cn').text()).toBe('系统设置')
    expect(w.find('.k-topbar-title').text()).toBe('高级设置')
    // Strengthened: explicitly assert they are not equal, prevent future merging of the two
    // keys into one (direct regression hook for N8).
    expect(w.findAll('.k-rail-item')[8].find('.k-rail-item-cn').text()).not.toBe(
      w.find('.k-topbar-title').text(),
    )
  })

  // [Review Important finding 4, added 2026-08-01] TITLES originally only pinned
  // dashboard (default) and settings (N8). wiki/queue have the same nature as N8
  // ("titleKey differs from nav phrase"; Wiki vs Wiki map, Queue vs Job Queue) but had
  // zero coverage. `.k-topbar-sub` also only tested the dashboard "no subpath" branch;
  // the `'/' + currentTab` branch never had a reference case (governance §9: "A vs B
  // binary choice must have reference cases on both sides"). RED probe confirmed: changing
  // `TITLES.queue.titleKey` from 'aiKbTitleJobQueue' to 'aiKbNavQueue' (merge with nav
  // key) → queue test fails precisely.
  it('wiki: title from aiKbTitleWikiMap, subtitle includes /wiki subpath', async () => {
    const { w } = await mountLayout('/ai/knowledge/wiki')
    expect(w.find('.k-topbar-title').text()).toBe('Wiki 导航')
    expect(w.find('.k-topbar-sub').text()).toBe('Wiki · /ai/knowledge/wiki')
  })

  it('queue: title from aiKbTitleJobQueue (≠ nav "Task"), subtitle includes /queue subpath (main hook, stronger discrimination than wiki)', async () => {
    const { w } = await mountLayout('/ai/knowledge/queue')
    expect(w.find('.k-topbar-title').text()).toBe('任务队列')
    expect(w.find('.k-topbar-sub').text()).toBe('Job Queue · /ai/knowledge/queue')
    // wiki's nav and title both happen to be "Wiki Navigation" (noted in N8 description),
    // so discrimination is naturally weak. queue's nav is "Task", title is "Task Queue",
    // they differ — that's the real hook.
    expect(w.find('.k-topbar-title').text()).not.toBe('任务')
  })

  it('shows warning banner when unreachable, else no banner', async () => {
    const { w } = await mountLayout()
    expect(w.find('.k-banner').exists()).toBe(false)
    useKnowledgeStore().unreachable = true
    await flushPromises()
    expect(w.find('.k-banner').attributes('data-tone')).toBe('warn')
  })

  it('refresh button reloads overview and toasts', async () => {
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

describe('KnowledgeLayout — mobile tabs', () => {
  it('renders only first 4 items + More, More highlights when any of last 5 tabs active', async () => {
    const { w } = await mountLayout('/ai/knowledge/queue')
    const tabs = w.findAll('.k-mobile-tab')
    expect(tabs).toHaveLength(5)
    expect(tabs[4].attributes('data-active')).toBe('true')
    expect(tabs[0].attributes('data-active')).toBe('false')
  })

  it('first 4 items match NAV first 4 items (strengthened: original only tested count)', async () => {
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

  it('More navigates to allowlist (copied from Vue2)', async () => {
    const { w, router } = await mountLayout()
    const push = vi.spyOn(router, 'push')
    await w.findAll('.k-mobile-tab')[4].trigger('click')
    expect(push).toHaveBeenCalledWith('/ai/knowledge/allowlist')
  })
})

describe('KnowledgeLayout — K8 rail footer username', () => {
  // Strengthened (original brief had no coverage): K8 is the write pattern explicitly
  // named in the governance doc, verbatim reuse of SettingsRail.vue:75-86. Needs
  // independent regression hooks — one test case per localStorage state variant.
  it('prioritize nickname when present in localStorage', async () => {
    localStorage.setItem('user', JSON.stringify({ nickname: '阿囧', username: 'jiong' }))
    const { w } = await mountLayout()
    expect(w.find('.k-rail-foot').text()).toBe('NimoOS · 阿囧')
  })

  it('fall back to username when only username present', async () => {
    localStorage.setItem('user', JSON.stringify({ username: 'jiong' }))
    const { w } = await mountLayout()
    expect(w.find('.k-rail-foot').text()).toBe('NimoOS · jiong')
  })

  it('fall back to "you" when JSON in localStorage is corrupted', async () => {
    localStorage.setItem('user', '{not valid json')
    const { w } = await mountLayout()
    expect(w.find('.k-rail-foot').text()).toBe('NimoOS · 你')
  })

  it('fall back to "you" when localStorage has no user key', async () => {
    const { w } = await mountLayout()
    expect(w.find('.k-rail-foot').text()).toBe('NimoOS · 你')
  })
})

describe('KnowledgeLayout — lifecycle', () => {
  it('fetch overview and draft count once on mount', async () => {
    setActivePinia(createPinia())
    const s = useKnowledgeStore()
    const load = vi.spyOn(s, 'loadOverview').mockResolvedValue()
    const draft = vi.spyOn(s, 'refreshNotesDraftCount').mockResolvedValue()
    await mountLayout()
    expect(load).toHaveBeenCalledTimes(1)
    expect(draft).toHaveBeenCalledTimes(1)
  })

  it('polls every 10 seconds; skips when document.hidden; clears timer on unmount', async () => {
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
    expect(load).toHaveBeenCalledTimes(2) // skipped
    hidden.mockReturnValue(false)
    vi.advanceTimersByTime(10000)
    expect(load).toHaveBeenCalledTimes(3)
    w.unmount()
    vi.advanceTimersByTime(30000)
    expect(load).toHaveBeenCalledTimes(3) // cleared
    vi.useRealTimers()
  })
})
