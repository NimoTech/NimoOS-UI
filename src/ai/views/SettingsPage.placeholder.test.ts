// SP8-P4 修复轮(终审 Important I2)—— 占位契约机制的行为覆盖。
//
// 背景:`DEFERRED_SECTIONS` 清空后,`SettingsPage.vue` 里两条分支再没有任何用例
// 走到过:①`placeholderProps(id)` 的 `SECTION_COMPONENTS[id] === SectionPlaceholder`
// 为真那条返回路径;②`onSelect()` 里 `if (DEFERRED_SECTIONS.includes(id))
// toast.show(...)` 那条分支。`sections.test.ts` 的「DEFERRED_SECTIONS 机制仍在」
// 只断言了常量本身是数组,不碰这两条分支的行为——终审 RED 探针 B 证实了这一点
// (摘掉两条分支,src/ai 全域 85 文件/1403 例仍然全绿)。用户 2026-07-31 明示
// 「反转不删」,意图是把机制留成将来可用的**能力**,不是留一段没人看着的代码。
//
// 【为什么单开一个文件,不塞进 SettingsPage.test.ts】
// `SECTION_COMPONENTS`(SettingsPage.vue 内部字面量,不导出——SP8-P2b Task 14
// 修复轮已裁定不为了可测性拆出额外 <script> 块扩张公开面)与 `DEFERRED_SECTIONS`
// (sections.ts 导出)是两个独立机制,当前没有运行时自动联动:`SECTION_COMPONENTS`
// 是写死的 id→组件字面量,不会因为 `DEFERRED_SECTIONS` 数组的内容而改变。
// `SettingsPage.vue` 文件头注释写的「恢复占位行为」步骤,本就是「把映射改回
// `SectionPlaceholder`、把 id 加回 `DEFERRED_SECTIONS`」两处手动改动一起做。
// 要在不碰一行生产代码的前提下驱动这两条分支,必须同时模拟这两处改动——用
// `vi.mock` 把 `McpSection.vue` 的导入重定向到 `SectionPlaceholder.vue` 本体
// (两处 import 路径相对同一个测试文件目录解析到同一个绝对路径,模块单例相同,
// 故 `SECTION_COMPONENTS.mcp === SectionPlaceholder` 的恒等判断为真),同时把
// `sections.ts` 的 `DEFERRED_SECTIONS` 打成 `['mcp']`(其余导出用
// `vi.importActual` 保留真实实现)。这两个 `vi.mock` 是文件级、会作用于本文件
// 里的全部用例——所以单开一个文件,不影响 `SettingsPage.test.ts` 其余 46+ 条
// 用例继续吃真实的 `McpSection` + 真实的空 `DEFERRED_SECTIONS`。
//
// RED→GREEN 证据见任务报告(.superpowers/sdd/p4-FINAL-fix-report.md §I2)。

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import zh from '../../i18n/zh_cn'

// 与 SettingsPage.test.ts 同款保险:mock 掉 `@nimotech/nimoos-service`,防止本
// 文件里意外未 stub 到的调用落到真实网络请求上(onMounted 的四个装载各自
// try/catch 吞错,真落网不会让测试崩,只是拖慢/不确定)。
const ai = vi.hoisted(() => ({
  getServicesStatus: vi.fn(),
  listModels: vi.fn(),
  listProviders: vi.fn(),
  getPolicy: vi.fn(),
  listSkills: vi.fn(),
  listMCPServers: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { ai } }))

// 模拟「把 id 加回 DEFERRED_SECTIONS」这半步改动——其余导出(GROUPS/ALL_ITEMS/
// VALID_SECTIONS/SPLIT_SECTIONS/groupOf)保持真实实现,只覆盖这一个常量。
vi.mock('../components/settings/sections', async () => {
  const actual = await vi.importActual<typeof import('../components/settings/sections')>(
    '../components/settings/sections',
  )
  return { ...actual, DEFERRED_SECTIONS: ['mcp'] }
})

// 模拟「把 SECTION_COMPONENTS 里的映射改回 SectionPlaceholder」这半步改动——
// 把 McpSection.vue 的导入重定向到 SectionPlaceholder.vue 本体(同一个模块
// 单例),让 SettingsPage.vue 内部 `SECTION_COMPONENTS['mcp'] !== SectionPlaceholder`
// 的恒等判断为假,从而触发 `placeholderProps()` 的有效返回分支。
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

describe('SettingsPage — 占位契约机制仍是能力,不是死代码(I2)', () => {
  it('mcp 被标记 deferred 时:渲染 SectionPlaceholder(正确 titleKey/bodyKey)且弹一条 deferred toast', async () => {
    const store = useSettingsStore()
    stubNetworkActions(store)
    const { w } = await mountPage()
    await flushPromises()

    const toast = useToast()
    const showSpy = vi.spyOn(toast, 'show')

    const item = w.findAll('.set-nav-item').find((n) => n.text().includes('MCP 连接'))!
    await item.trigger('click')
    await flushPromises()

    // ① placeholderProps() 的有效返回分支:渲染出 SectionPlaceholder——判别依据
    // 与既有用例(SettingsPage.test.ts「SP8-P4 收口」)同款:页面文本含
    // aiCfgPlaceholderBody,这段文案是占位面板独有的。
    expect(w.text()).toContain(zh.aiCfgPlaceholderBody)
    // titleKey 用来源分区自己的导航文案(sections.ts ALL_ITEMS 里 mcp 的
    // labelKey 是 aiCfgMcpConnections,值「MCP 连接」)——不是空字符串兜底。
    expect(w.find('.set-h1').text()).toBe(zh.aiCfgMcpConnections)
    expect(w.find('.set-desc').text()).toBe(zh.aiCfgPlaceholderBody)

    // ② onSelect() 的 deferred toast 分支。
    expect(showSpy).toHaveBeenCalledWith(zh.aiCfgSectionDeferred, 3000)

    w.unmount()
  })
})
