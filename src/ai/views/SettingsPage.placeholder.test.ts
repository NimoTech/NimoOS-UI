// Placeholder contract behavior coverage.
//
// Background: after `DEFERRED_SECTIONS` empties, two branches in `SettingsPage.vue` have no
// test cases reaching them: ① `placeholderProps(id)` valid return path where
// `SECTION_COMPONENTS[id] === SectionPlaceholder` is true; ② `onSelect()` branch
// `if (DEFERRED_SECTIONS.includes(id)) toast.show(...)`. `sections.test.ts` "mechanism still
// present" only asserts the constant itself is array, never touches behavior of these two
// branches — final review RED probe B confirmed this (removing both branches, src/ai full
// 85 files/1403 cases still all green). User 2026-07-31 explicit "reverse not delete",
// intent is keeping mechanism as future-usable **capability**, not dead code nobody watches.
//
// 【Why single file instead of SettingsPage.test.ts】
// `SECTION_COMPONENTS` (SettingsPage.vue internal literal, not exported — a fix round
// already ruled no extra `<script>` block for testability to widen public surface)
// and `DEFERRED_SECTIONS` (sections.ts export) are two independent mechanisms, currently
// no runtime auto-sync: `SECTION_COMPONENTS` is hardcoded id→component literal, unchanged
// by `DEFERRED_SECTIONS` array contents. `SettingsPage.vue` header comment "restore
// placeholder behavior" step is already "change mapping back to `SectionPlaceholder`, re-add
// id to `DEFERRED_SECTIONS`" both done together. To drive both branches without touching
// production code, must simulate both changes — use `vi.mock` to redirect `McpSection.vue`
// import to `SectionPlaceholder.vue` body (both import paths resolve to same absolute path
// relative to test file dir, same module singleton, so `SECTION_COMPONENTS.mcp === SectionPlaceholder`
// identity check is true), and also set `sections.ts` `DEFERRED_SECTIONS` to `['mcp']`
// (other exports preserved via `vi.importActual`). These two `vi.mock`s are file-level,
// affect all cases in this file — so separate file, doesn't affect remaining 46+ cases in
// `SettingsPage.test.ts` keep getting real `McpSection` + real empty `DEFERRED_SECTIONS`.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import zh from '../../i18n/zh_cn'

// Same insurance as SettingsPage.test.ts: mock `@nimotech/nimoos-service`, prevent
// accidental un-stubbed calls in this file reaching real network (four loads in onMounted
// each try/catch swallow errors, real network won't crash test, just slow/flaky).
const ai = vi.hoisted(() => ({
  getServicesStatus: vi.fn(),
  listModels: vi.fn(),
  listProviders: vi.fn(),
  getPolicy: vi.fn(),
  listSkills: vi.fn(),
  listMCPServers: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))

// Simulate "re-add id to DEFERRED_SECTIONS" half of the change — other exports (GROUPS/ALL_ITEMS/
// VALID_SECTIONS/SPLIT_SECTIONS/groupOf) keep real implementation, override only this constant.
vi.mock('../components/settings/sections', async () => {
  const actual = await vi.importActual<typeof import('../components/settings/sections')>(
    '../components/settings/sections',
  )
  return { ...actual, DEFERRED_SECTIONS: ['mcp'] }
})

// Simulate "change SECTION_COMPONENTS mapping back to SectionPlaceholder" half of change —
// redirect McpSection.vue import to SectionPlaceholder.vue body (same module singleton),
// make SettingsPage.vue internal `SECTION_COMPONENTS['mcp'] !== SectionPlaceholder` identity
// check false, thus trigger `placeholderProps()` valid return branch.
vi.mock('../components/settings/sections/McpSection.vue', async () => {
  return await vi.importActual('../components/settings/SectionPlaceholder.vue')
})

import SettingsPage from './SettingsPage.vue'
import { useSettingsStore } from '../stores/settingsStore'
import { useToast } from '../../stores/toast'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

let pinia: Pinia

async function mountPage(): Promise<{ w: ReturnType<typeof mount>; router: Router }> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/ai/settings', name: 'ai-settings', component: SettingsPage }],
  })
  await router.push('/ai/settings')
  const w = mount(SettingsPage, { global: { plugins: [i18n, pinia, router] }, attachTo: document.body })
  return { w, router }
}

function stubNetworkActions(store: ReturnType<typeof useSettingsStore>) {
  vi.spyOn(store, 'loadServicesStatus').mockResolvedValue(undefined)
  vi.spyOn(store, 'loadModels').mockResolvedValue(undefined)
  vi.spyOn(store, 'loadProviders').mockResolvedValue(undefined)
  vi.spyOn(store, 'loadPolicy').mockResolvedValue(undefined)
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  Object.values(ai).forEach((fn) => fn.mockReset())
  document.body.innerHTML = ''
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SettingsPage — placeholder contract mechanism is capability, not dead code (I2)', () => {
  it('when mcp marked deferred: renders SectionPlaceholder (correct titleKey/bodyKey) and pops deferred toast', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()

    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    const item = w.findAll('.set-nav-item').find((n) => n.text().includes('MCP 连接'))!
    await item.trigger('click')
    await flushPromises()

    // ① placeholderProps() valid return branch: renders SectionPlaceholder — detection method
    // same as existing case in SettingsPage.test.ts: page text contains
    // aiCfgPlaceholderBody, this copy is unique to placeholder panel.
    expect(w.text()).toContain(zh.aiCfgPlaceholderBody)
    // titleKey uses source section's own navigation text (sections.ts ALL_ITEMS mcp's
    // labelKey is aiCfgMcpConnections, value "MCP 连接") — not empty string fallback.
    expect(w.find('.set-h1').text()).toBe(zh.aiCfgMcpConnections)
    expect(w.find('.set-desc').text()).toBe(zh.aiCfgPlaceholderBody)

    // ② onSelect() deferred toast branch.
    expect(showSpy).toHaveBeenCalledWith(zh.aiCfgSectionDeferred, 3000)

    w.unmount()
  })
})
