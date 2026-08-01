import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import KvmPage from './KvmPage.vue'
import { i18n } from '../../i18n'

vi.mock('@nimotech/nimoos-service', () => ({
  service: { kvm: { getVMList: () => Promise.resolve({ data: [], total: 0 }) } },
}))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: () => () => {} }) }))

const mountPage = () => mount(KvmPage, { global: { plugins: [i18n] } })

describe('KvmPage 壳', () => {
  it('渲染左栏标题与右侧空态', () => {
    const w = mountPage()
    expect(w.text()).toContain('NIMO 虚拟机')
    // 注:brief 草稿此处断言"选择一台虚拟机",但核对 Vue2 zh_CN.json 后
    // "Select a Virtual Machine" 的官方译文是"选择虚拟机"(无"一台"),
    // 已按 i18n 核对结果改正断言,详见 task-2-report.md。
    expect(w.text()).toContain('选择虚拟机')
  })

  it('侧栏折叠按钮点一下加 collapsed 类,再点去掉', async () => {
    const w = mountPage()
    const btn = w.get('.kvm-sidebar-toggle')
    expect(w.get('.kvm-sidebar').classes()).not.toContain('collapsed')
    await btn.trigger('click')
    expect(w.get('.kvm-sidebar').classes()).toContain('collapsed')
    await btn.trigger('click')
    expect(w.get('.kvm-sidebar').classes()).not.toContain('collapsed')
  })

  it('折叠态下鼠标移入侧栏会临时展开(Vue2 isSidebarCollapsed = collapsed && !hover)', async () => {
    const w = mountPage()
    await w.get('.kvm-sidebar-toggle').trigger('click')
    await w.get('.kvm-sidebar').trigger('mouseenter')
    expect(w.get('.kvm-sidebar').classes()).not.toContain('collapsed')
    await w.get('.kvm-sidebar').trigger('mouseleave')
    expect(w.get('.kvm-sidebar').classes()).toContain('collapsed')
  })

  it('折叠按钮有 aria-label(图标按钮硬约束)', () => {
    expect(mountPage().get('.kvm-sidebar-toggle').attributes('aria-label')).toBeTruthy()
  })
})
