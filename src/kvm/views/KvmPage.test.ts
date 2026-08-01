import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import KvmPage from './KvmPage.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

// Task 5 起需要电源动作接线,mock 补全 service.kvm 的全部方法(仿 useVmList.test.ts
// 的 getter 写法,好让 beforeEach 里 mockReset 生效)。
const api = {
  getVMList: vi.fn(), getVM: vi.fn(), startVM: vi.fn(), stopVM: vi.fn(),
  restartVM: vi.fn(), pauseVM: vi.fn(), resumeVM: vi.fn(), wakeupVM: vi.fn(),
  deleteVM: vi.fn(), setAutostart: vi.fn(), setBootFromDisk: vi.fn(),
}
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: () => () => {} }) }))

const VM = (over: Partial<KvmVM> = {}): KvmVM => ({
  id: 'vm-1', name: 'sp9-alpine-test', uuid: 'u', state: 'running', vcpu: 2, memory: 1024,
  disk: 8, diskUsedPercent: 0, diskPath: '/d', iso: '', os: 'linux',
  networkMode: 'nat', networkInterface: 'virbr0', firmware: 'bios', bootFromDisk: true,
  vncPort: 5900, vncWebsocketPort: 5700, spicePort: 0, spiceTlsPort: 0, autostart: false,
  createdAt: '', updatedAt: '', ...over,
})

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  api.getVMList.mockResolvedValue({ data: [], total: 0 })
  api.getVM.mockResolvedValue(VM())
})

const mountPage = () => mount(KvmPage, { global: { plugins: [i18n] } })
const flush = () => new Promise((r) => setTimeout(r, 0))

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

describe('KvmPage 电源动作接线(Task 5)', () => {
  it('自动选中的 VM 渲染出 ConsoleHeader,一次点击的动作(开机)直接调用、不经过进度遮罩', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.startVM.mockResolvedValue(undefined)
    const w = mountPage()
    await flush()
    expect(w.find('.console-header').exists()).toBe(true)

    await w.findAll('.action-btn')[1].trigger('click') // ⋮
    const item = w.findAll('.dropdown-item').find((b) => b.text().includes('开机'))!
    await item.trigger('click')
    await flush()

    expect(api.startVM).toHaveBeenCalledWith('vm-1')
    expect(document.body.querySelector('.kvm-progress-overlay')).toBeNull()
    expect(w.get('.console-status .status-dot').classes()).toContain('running')
  })

  it('stop 二次确认通过后显示进度遮罩,动作完成后遮罩消失(标题=kvmStopping,正文=vm 名)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    let resolveStop: () => void = () => {}
    api.stopVM.mockImplementation(() => new Promise<void>((r) => { resolveStop = () => r(undefined) }))
    const w = mountPage()
    await flush()

    await w.findAll('.action-btn')[1].trigger('click')
    const stopBtn = w.findAll('.dropdown-item').find((b) => b.text().includes('强制关机'))!
    await stopBtn.trigger('click') // 第一次:只变确认文字
    await w.findAll('.dropdown-item').find((b) => b.text().includes('你确定吗？'))!.trigger('click') // 第二次:真正触发

    // 此刻 stopVM 的 promise 还没 resolve,遮罩应该已经挂上了(Teleport 到 body,
    // 只能从 document 查,wrapper.find 找不到 teleport 出去的内容——已用探针脚本验证过)。
    const overlay = document.body.querySelector('.kvm-progress-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay!.textContent).toContain('正在停止虚拟机')
    expect(overlay!.textContent).toContain('sp9-alpine-test')

    resolveStop()
    await flush()
    expect(document.body.querySelector('.kvm-progress-overlay')).toBeNull()
    expect(api.stopVM).toHaveBeenCalledWith('vm-1')
  })

  it('非确认动作(暂停)在途时不显示进度遮罩', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    let resolvePause: () => void = () => {}
    api.pauseVM.mockImplementation(() => new Promise<void>((r) => { resolvePause = () => r(undefined) }))
    const w = mountPage()
    await flush()

    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('暂停'))!.trigger('click')

    expect(document.body.querySelector('.kvm-progress-overlay')).toBeNull()
    resolvePause()
    await flush()
    expect(document.body.querySelector('.kvm-progress-overlay')).toBeNull()
  })

  it('动作失败时 lastError 内联显示在控制台占位区(不弹 toast)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.startVM.mockRejectedValue(new Error('domain is not running'))
    const w = mountPage()
    await flush()

    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('开机'))!.trigger('click')
    await flush()

    const hint = w.get('.console-hint.is-error')
    expect(hint.text()).toBe('domain is not running')
  })
})
