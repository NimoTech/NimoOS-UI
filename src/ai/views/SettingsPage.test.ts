// SP8-P2a Task 8 — SettingsPage test. The brief's Step 1 provides a checklist of 28 test cases
// (numbered 1-28 sequentially; numbers are kept in comments for alignment with brief),
// implemented according to that checklist.
//
// Mock the four network actions of `useSettingsStore` (brief original wording: "mock out the
// network actions of useSettingsStore"), but don't mock the underlying `service.ai.*` — that is
// the responsibility of settingsStore.test.ts (T5) itself; here we only care whether the page
// shell's wiring is correct. Still mock one layer of `@nimotech/nimoos-service` (shell) as
// a safety net, to prevent spy calls that get missed from accidentally falling through to
// real network requests (onMounted try/catch swallows all errors on each mount; if it does
// reach the network, reject will occur but won't crash the test, just might slow it down/add
// non-determinism; this layer is purely defensive).
//
// Router uses real `createMemoryHistory()` (don't mock vue-router) — the `?section=` deep-link
// contract (test cases 13-18) requires a truly reactive `route.query`; a static mock object
// is insufficient here (property reads on static objects won't be picked up by Vue's
// dependency tracking, watch will never fire).
//
// ⚠️ jsdom has no IntersectionObserver: most test cases don't need it at all — in jsdom
// `typeof IntersectionObserver === 'undefined'`, and `setupSpy()`'s guard silently skips it
// (graceful degradation same as Vue2, see Settings.vue:216), no error. Only in the supplementary
// tests at the end marked "not in checklist" do we manually attach a fake IntersectionObserver
// class, capture the callback passed to the constructor, manually feed entries to trigger it,
// and verify that scroll-spy is actually wired up.

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
  // SP8-P3a Task 7 — skills section is no longer a placeholder; mounting the real
  // SkillsSection component will call service.ai.listSkills() in onMounted. A bare vi.fn()
  // (without mockResolvedValue) returns undefined when called; `await undefined` is legal,
  // and SkillsSection's `Array.isArray(list)` safety net treats it as an empty list, with no
  // error or toast — enough to keep test cases in this file unrelated to skills (cases that
  // just pass through that section) silent; test cases that need to assert on list contents
  // will provide their own `mockResolvedValue`.
  listSkills: vi.fn(),
  // SP8-P4 Task 9 (final) — mcp section is no longer a placeholder; mounting the real
  // McpSection component will similarly call service.ai.listMCPServers() in onMounted. Same as
  // above, bare vi.fn() lets `Array.isArray(list)` safety net treat it as empty list, test
  // cases in this file unrelated to mcp are unaffected (⚠️ the brief explicitly calls out:
  // `stubNetworkActions` only mocks the four network actions of `useSettingsStore`, not the
  // `service.ai.*` calls here — must separately add them to this hoisted object, otherwise
  // when mounting the mcp section, `listMCPServers` will be `undefined`; while `Array.isArray`
  // safety net won't throw, adding this key makes "mocks are complete" explicit, rather than
  // relying on the safety net's silent fallback).
  listMCPServers: vi.fn(),
  // Task 21 (mcp-progressive-disclosure) —— mcpapprovals 分区挂载真组件
  // McpApprovalsSection,onMounted 里调 service.ai.listMCPApprovals()。同上,
  // 补上这个键让「mock 齐全」显式,不依赖 Array.isArray 兜底的隐性容错。
  listMCPApprovals: vi.fn(),
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

/** brief: "mock out the network actions of useSettingsStore" — the four load actions become
 *  side-effect-free no-ops, returning their respective spies for call order / call count assertions. */
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

describe('SettingsPage — ① Root element and theme', () => {
  it('1. Root element carries both agent-app and set-app classes', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    const root = w.find('.set-app')
    expect(root.classes()).toContain('agent-app')
    expect(root.classes()).toContain('set-app')
    w.unmount()
  })

  it('2. data-theme follows useAiTheme().theme; changes after toggleTheme', async () => {
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

describe('SettingsPage — ② Top bar', () => {
  it('3. Top bar renders 5 .set-pill elements', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    expect(w.findAll('.set-pill')).toHaveLength(5)
    w.unmount()
  })

  it('4. pillState three states: true→ok, false→off, null/undefined→"" (three separate assertions)', async () => {
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

  it('5. Parser light three states: not running→off, running and paused→warn, running and not paused→ok', async () => {
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

  it('6. When Parser pending > 0, render .badge-count with numeric text; when 0, don\'t render (control)', async () => {
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

  it('7. When Parser paused, render .badge-pause; when not paused, don\'t render (control)', async () => {
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

  // SP8-P5d Task 9 (ticket 1, governance §15.1) — reversal: the original assertion above at "8."
  // ("click doesn't call push, only shows toast") was pinning exactly that placeholder contract;
  // the placeholder entry has now been reversed back to a true router-link; the old assertion must
  // reverse with it, or it will fail exactly (same approach as the "reverse don't delete" pattern
  // in `knowledgeRoutes.test.ts`). Before change (SP8-P2a original, before reversal):
  //   it('8. "Details" button click doesn\'t call router.push, only shows toast (placeholder contract before P5)', async () => {
  //     const store = useSettingsStore()
  //     stubNetworkActions(store)
  //     const { w, router } = await mountPage()
  //     await flushPromises()
  //     const pushSpy = vi.spyOn(router, 'push')
  //     const toast = useToast()
  //     const showSpy = vi.spyOn(toast, 'show')
  //     await w.find('.set-detail-link').trigger('click')
  //     expect(pushSpy).not.toHaveBeenCalled()
  //     expect(showSpy).toHaveBeenCalledWith('Knowledge library details page will open in a later phase')
  //     w.unmount()
  //   })
  // After change: `.set-detail-link` is now a true RouterLink pointing to `/ai/knowledge` —
  // assertion is anchored to element identity (RouterLink component instance + `to` prop), not the
  // rendered DOM tag, because <router-link> still renders as <a> when test route doesn't register
  // the target, so bare tag name comparison has insufficient discriminating power. RED probe: change
  // product code back to placeholder `<button>` + toast → this test must fail red (see task report).
  it('8. "Details" is a RouterLink pointing to /ai/knowledge, not a placeholder button that shows toast (ticket 1 reversal, governance §15.1)', async () => {
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

  it('9. Refresh button calls store.loadServicesStatus', async () => {
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

describe('SettingsPage — ③ Content area: two render modes', () => {
  it('10. stack group (model) renders 5 .set-stack-item inside, data-section-id in order: models/providers/privacy/thinking/background', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    const items = w.findAll('.set-stack-item')
    // 5th = 'background' (settings parity 2026-08-24, Vue2 sections.js:23).
    expect(items).toHaveLength(5)
    expect(items.map((i) => i.attributes('data-section-id'))).toEqual([
      'models',
      'providers',
      'privacy',
      'thinking',
      'background',
    ])
    w.unmount()
  })

  it('11. swap group (channel) renders only 1 section, no .set-stack-item', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    store.setActiveSection('channels')
    await flushPromises()
    expect(w.findAll('.set-stack-item')).toHaveLength(0)
    // Switching pages does render other content (placeholder panel), not blank
    expect(w.find('.sk-section').exists()).toBe(true)
    w.unmount()
  })

  it('12. When activeSection=skills, .set-body has set-body-split class; when activeSection=mcptokens (same group but not split), it doesn\'t', async () => {
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

  // SP8-P2b Task 14 Fix round 1 — closure guard, replacing the original direct assertion of
  // internal constant `SECTION_COMPONENTS` (coordinator ruling: `export` breaks `<script setup>`
  // compilation, and splitting out a separate `<script>` block just for testability is unnecessary
  // API surface expansion; changed to assert *render output* instead, don't touch component
  // internals).
  //
  // Discrimination basis: `SectionPlaceholder.vue` renders the `bodyKey` prop as
  // `<p class="set-desc">{{ t(props.bodyKey) }}</p>`, and SettingsPage.vue's `placeholderProps()`
  // always passes `bodyKey: 'aiCfgPlaceholderBody'` for placeholder sections — this text
  // (`zh.aiCfgPlaceholderBody`) is unique to the placeholder panel; real sections each use their
  // own `aiCfgXxxDesc` text keys (verified each `sections/*.vue` source, no real section reuses
  // this key), so "whether the page render contains this placeholder text" precisely distinguishes
  // "real component" from "SectionPlaceholder", no need to access `SECTION_COMPONENTS` itself.
  //
  // agent group (blacklist/execution/search/memory/observability) is a stack group; one
  // setActiveSection call renders all 5 sections in the group together, assertion power is
  // stronger than switching one by one (only takes one real section accidentally left as
  // placeholder to get caught among the 5).
  //
  // SP8-P3a Task 7 — `skills` now connected to real component `SkillsSection`, moved from
  // "still contains placeholder text" deferred list to "implemented" list.
  // SP8-P4 Task 9 (final) — `mcp` is the last placeholder section; this task connects it to real
  // component `McpSection`, similarly moving from deferred to implemented — **all 13 sections
  // now implemented**, `deferred` list is now empty (synchronized with `sections.ts`'s
  // `DEFERRED_SECTIONS: SectionId[] = []`). The original deferred loop (asserting "still contains
  // placeholder text") is deleted entirely: an empty array's `for` loop body never executes,
  // leaving it is just empty assertion spinning, better to delete it directly; mechanism-level
  // anchoring is already covered by two new test cases in `sections.test.ts` (DEFERRED_SECTIONS
  // is empty / mechanism still works), no need to duplicate an equivalent empty-spinning assertion here.
  // Task 21 (mcp-progressive-disclosure) added 'mcpapprovals' on top of those,
  // so the implemented count is 14 now, not 13.
  it('SP8-P4 closure + Task 21 — 14 implemented sections render without placeholder text in page (no section still a SectionPlaceholder)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()

    const implemented: SectionId[] = [
      'models', 'providers', 'privacy', 'thinking',
      'blacklist', 'execution', 'search', 'memory', 'observability', 'skills', 'mcp',
      'mcpapprovals', 'mcptokens', 'channels',
    ]
    for (const id of implemented) {
      store.setActiveSection(id)
      await flushPromises()
      expect(w.text()).not.toContain(zh.aiCfgPlaceholderBody)
    }

    w.unmount()
  })
})

describe('SettingsPage — ⑤+⑥ Deep-link contract and lifecycle', () => {
  it('13. onMounted calls resetTransientUi before reading ?section= (call order: resetTransientUi < setActiveSection)', async () => {
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

  it('14. ?section=providers is adopted on mount', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage('/ai/settings?section=providers')
    await flushPromises()
    expect(store.activeSection).toBe('providers')
    w.unmount()
  })

  it('15. On mount, ?section=bogus (invalid value) is ignored, stays at models (control)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage('/ai/settings?section=bogus')
    await flushPromises()
    expect(store.activeSection).toBe('models')
    w.unmount()
  })

  it('16. route.query.section change → calls setActiveSection', async () => {
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

  it('17. Click nav emit select → setActiveSection + router.replace with new query', async () => {
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

  it('18. When clicking nav with same section already in URL → don\'t call router.replace (Vue2 Settings.vue:194 guard)', async () => {
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

  // SP8-P3a Task 7 — skills now connected to real component SkillsSection, no longer in
  // DEFERRED_SECTIONS; this test case originally asserted "shows placeholder toast" is now
  // reversed to assert the opposite: SkillsSection's real content is rendered (`.sk-list`,
  // from SkillsSection.vue:135, not present in `SectionPlaceholder.vue`), page contains no
  // placeholder text, and no toast is shown.
  it('19. Select skills → render SkillsSection real content, no toast (no longer placeholder)', async () => {
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

  // SP8-P4 Task 9 (final) — mcp is the last placeholder section; after this task connects it to
  // real component McpSection, it no longer belongs to DEFERRED_SECTIONS. This test case
  // originally (as '19b') asserted "still shows placeholder toast, DEFERRED_SECTIONS contract
  // remains" is now reversed to assert the opposite: McpSection's real content is rendered
  // (`.sk-col-search`, McpSection's left column search box, from McpSection.vue, not present
  // in `SectionPlaceholder.vue`), page contains no placeholder text, and no toast is shown
  // — structure mirrors the skills test 19 above exactly.
  it('19b. Select mcp → render McpSection real content, no toast (no longer placeholder)', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()
    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')
    const item = w.findAll('.set-nav-item').find((n) => n.text().includes('MCP 连接'))!
    await item.trigger('click')
    await flushPromises()
    expect(w.find('.sk-col-search').exists()).toBe(true) // McpSection's left column search box
    expect(w.text()).not.toContain(zh.aiCfgPlaceholderBody)
    expect(showSpy).not.toHaveBeenCalled()
    w.unmount()
  })

  it('20. Select providers (non-deferred) → no toast (control)', async () => {
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

  it('21. onMounted calls loadServicesStatus / loadModels / loadProviders / loadPolicy in order', async () => {
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

  it('22. If any rejects, doesn\'t block subsequent ones (loadModels rejects, loadProviders still called)', async () => {
    const store = useSettingsStore()
    const spies = stubNetworkActions(store)
    spies.models.mockRejectedValue(new Error('boom'))
    const { w } = await mountPage()
    await flushPromises()
    expect(spies.providers).toHaveBeenCalledTimes(1)
    expect(spies.policy).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('23. 15s polling: advance 15000ms → loadServicesStatus called one more time', async () => {
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

  it('24. After onUnmounted, advance 15000ms → no new calls (timer cleaned up)', async () => {
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

  it('25. Back button → router.push("/ai/agent")', async () => {
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

describe('SettingsPage — D3 Download resume loop (!job._timer guard)', () => {
  it('26. When hfImportJobs has downloading entry with _timer:null → startImportJob called on mount', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const startSpy = vi.spyOn(store, 'startImportJob').mockImplementation(() => {})
    store.hfImportJobs['model-a.gguf'] = makeImportJob({ status: 'downloading', _timer: null })
    const { w } = await mountPage()
    await flushPromises()
    expect(startSpy).toHaveBeenCalledWith('org/model-a', 'model-a.gguf')
    w.unmount()
  })

  it('27. Same as above but _timer non-null → don\'t call (D3 guard, control)', async () => {
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

  it('28. Same as above but status:"error" → don\'t call (control)', async () => {
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

// — Not in checklist, supplementary coverage by choice —
// None of the 28 checklist cases actually drive IntersectionObserver callbacks (jsdom has no
// this API by default; setupSpy()'s guard skips it directly, which is already the full extent
// of checklist requirements). But the brief specifically reminds to stub a fake one to verify
// scroll-spy is actually wired up; one supplementary test added here: manually attach a fake
// IntersectionObserver that captures the constructor callback, feed entries, and verify (a) highlight
// switches to the visible section with the smallest boundingClientRect.top, (b) doesn't touch
// URL query (Vue2 Settings.vue:234 note).
describe('SettingsPage — scroll-spy (not in checklist, supplementary coverage by choice)', () => {
  it('EXTRA. IntersectionObserver callback highlights topmost visible section, doesn\'t change URL query', async () => {
    let capturedCb: ((entries: unknown[]) => void) | null = null
    class FakeIO {
      constructor(cb: (entries: unknown[]) => void) {
        capturedCb = cb
      }
      observe() {
        /* no-op: manually feed entries, don't rely on real layout */
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
