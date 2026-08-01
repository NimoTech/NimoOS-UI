import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import KvmPage from './KvmPage.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

// Task 6 起需要真的走一遍 useVncConsole 的 connect/disconnect 接线(不再只是 stub),
// 所以补一个假 RFB 类挡住 @novnc/novnc——原因同 useVncConsole.test.ts 顶部注释:
// 不挡住的话 connect() 成功路径会用真实 novnc 包去 `new WebSocket(...)`,jsdom 环境
// 没有 WebSocket 全局,而且本来也不该在单测里真建连接(硬约束:不要真的建立 WebSocket)。
// 用 vi.hoisted 是必须的——vi.mock 工厂会被提升到文件最顶部,直接引用后面才声明的
// class 会撞 TDZ(同 useVncConsole.test.ts 已经踩过并修过的坑)。
const { instances: rfbInstances, FakeRFB } = vi.hoisted(() => {
  class FakeRFB {
    handlers: Record<string, (() => void)[]> = {}
    disconnected = false
    constructor(public el: unknown, public url: string, public opts: unknown) { instances.push(this) }
    addEventListener(ev: string, cb: () => void) { (this.handlers[ev] ||= []).push(cb) }
    fire(ev: string) { (this.handlers[ev] || []).forEach((h) => h()) }
    disconnect() { this.disconnected = true }
    sendKey() {}
    sendCtrlAltDel() {}
  }
  const instances: InstanceType<typeof FakeRFB>[] = []
  return { instances, FakeRFB }
})
vi.mock('@novnc/novnc', () => ({ default: FakeRFB }))

// Task 5 起需要电源动作接线,mock 补全 service.kvm 的全部方法(仿 useVmList.test.ts
// 的 getter 写法,好让 beforeEach 里 mockReset 生效)。Task 6 补 getVNC(控制台接线需要)。
const api = {
  getVMList: vi.fn(), getVM: vi.fn(), startVM: vi.fn(), stopVM: vi.fn(),
  restartVM: vi.fn(), pauseVM: vi.fn(), resumeVM: vi.fn(), wakeupVM: vi.fn(),
  deleteVM: vi.fn(), setAutostart: vi.fn(), setBootFromDisk: vi.fn(), getVNC: vi.fn(),
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
  rfbInstances.length = 0
  Object.values(api).forEach((f) => f.mockReset())
  api.getVMList.mockResolvedValue({ data: [], total: 0 })
  api.getVM.mockResolvedValue(VM())
  api.getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 5700, spicePort: 0, spiceTlsPort: 0 })
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
    // 评审 Important #2:正文不能只有 vm 名,必须是 Vue2 `${vm.name} ${$t('stopping')}...`
    // 逐字对应的 "sp9-alpine-test 停止中...";用精确匹配而不是 toContain('sp9-alpine-test'),
    // 否则漏掉 "停止中..." 这半截也测不出来(上一轮就是这么漏测的)。
    const overlay = document.body.querySelector('.kvm-progress-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay!.querySelector('.kvm-progress-title')?.textContent).toContain('正在停止虚拟机')
    expect(overlay!.querySelector('.kvm-progress-msg')?.textContent).toBe('sp9-alpine-test 停止中...')

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

  it('动作失败时 lastError 内联显示在控制台占位区(不弹 toast),有后端 message 就原样显示', async () => {
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

  it('评审 Important #1:rejection 没有 message 时,界面显示翻译后的中文,不是 kvmFailedToStart 这种键名', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    // 非 Error 值(或空 message 的 Error)会让 useVmList 的 errText() 落到 fallback 键
    // 字符串本身('kvmFailedToStart'),渲染层必须把它当 i18n key 过一遍 t()。
    api.startVM.mockRejectedValue(new Error(''))
    const w = mountPage()
    await flush()

    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('开机'))!.trigger('click')
    await flush()

    const hint = w.get('.console-hint.is-error')
    expect(hint.text()).toBe('启动虚拟机失败')
    expect(hint.text()).not.toContain('kvmFailedToStart')
  })
})

describe('KvmPage VNC 控制台接线(Task 6)', () => {
  it('开机成功后真的建立 VNC 连接(getVNC 被调用、RFB 被构造)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.startVM.mockResolvedValue(undefined)
    const w = mountPage()
    await flush()

    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('开机'))!.trigger('click')
    await flush()

    expect(api.getVNC).toHaveBeenCalledWith('vm-1')
    expect(rfbInstances).toHaveLength(1)
    expect(rfbInstances[0].url).toBe(`ws://${window.location.hostname}:5700`)
  })

  it('初始自动选中一台运行中的 VM 就直接建连(watch selectedVM 接线,不只是电源动作回调)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    mountPage()
    await flush()

    expect(api.getVNC).toHaveBeenCalledWith('vm-1')
    expect(rfbInstances).toHaveLength(1)
  })

  it('强制关机确认通过后,已建立的 RFB 被断开', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    api.stopVM.mockResolvedValue(undefined)
    const w = mountPage()
    await flush()
    expect(rfbInstances).toHaveLength(1) // 初始 running 自动连接

    await w.findAll('.action-btn')[1].trigger('click')
    const stopBtn = w.findAll('.dropdown-item').find((b) => b.text().includes('强制关机'))!
    await stopBtn.trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('你确定吗？'))!.trigger('click')
    await flush()

    expect(rfbInstances[0].disconnected).toBe(true)
  })

  it('切换到另一台运行中的 VM 时对新 VM 建立连接(照 Vue2 watch selectedVM :747-758)', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', state: 'running' }), VM({ id: 'vm-2', name: 'vm-two', state: 'running' })],
      total: 2,
    })
    const w = mountPage()
    await flush()
    expect(api.getVNC).toHaveBeenCalledWith('vm-1')

    const items = w.findAll('.vm-list-item')
    await items[1].trigger('click')
    await flush()

    expect(api.getVNC).toHaveBeenCalledWith('vm-2')
  })

  // 评审 Minor:consoleErrorKey 的优先级(`vnc.errorKey.value || s.lastError.value`,
  // KvmPage.vue :81 附近)之前没有一条测试真的让两个来源**同时为真**再断言谁赢——
  // 单是"lastError 非空时显示 lastError"这种用例即便把优先级颠倒过来也照样能过。
  // 这里先制造一个残留的 lastError(开机失败),再切到另一台 VM 触发 connect() 失败
  // 产生 vnc.errorKey,此时两者同时为真,断言显示的是 vnc 那一个。
  it('VNC 连接错误优先于电源动作遗留的 lastError(consoleErrorKey 优先级)', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', state: 'stopped' }), VM({ id: 'vm-2', name: 'vm-two', state: 'running' })],
      total: 2,
    })
    api.startVM.mockRejectedValue(new Error('domain busy')) // 制造一个残留的 lastError
    api.getVNC.mockRejectedValue(new Error('irrelevant')) // 任何 connect() 都会失败
    const w = mountPage()
    await flush()

    // 初始自动选中 vm-1(stopped),开机失败 → lastError = 'domain busy'
    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('开机'))!.trigger('click')
    await flush()
    expect(w.get('.console-hint.is-error').text()).toBe('domain busy')

    // 切到 vm-2(running)→ watch selectedVM 触发 connect(),getVNC 失败 →
    // vnc.errorKey = 'kvmVncFetchFailed'。lastError 此时仍是 'domain busy'(没人清过),
    // 两者同时为真,应该显示 vnc 那一个。
    const items = w.findAll('.vm-list-item')
    await items[1].trigger('click')
    await flush()

    expect(w.get('.console-hint.is-error').text()).toBe('获取 VNC 信息失败')
  })
})

// Task 7:SendKey 悬浮工具条(照 Vue2 `.console-display` 上的 @mouseenter/@mouseleave/
// @mousemove,:154、:1140-1153)+ 全屏(:1120-1133)。
describe('KvmPage SendKey 悬浮工具条 + 全屏(Task 7)', () => {
  // jsdom 的 getBoundingClientRect 恒为全零(left/width 都是 0),80px 边缘判定必须真实
  // 桩出容器的宽度/左偏移才测得出来——只断言 onConsoleMove 被调用过是空测试(本期已栽过
  // 好几次同类坑,见任务说明)。
  const stubRect = (el: HTMLElement, width = 400) => {
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width, height: 300, right: width, bottom: 300, x: 0, y: 0, toJSON() {} }) as DOMRect
  }

  it('鼠标进入控制台区显示工具条,离开隐藏', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    const w = mountPage()
    await flush()

    expect(w.find('.sendkey-toolbar').exists()).toBe(false)
    await w.get('.console-display').trigger('mouseenter')
    expect(w.find('.sendkey-toolbar').exists()).toBe(true)
    await w.get('.console-display').trigger('mouseleave')
    expect(w.find('.sendkey-toolbar').exists()).toBe(false)
  })

  it('鼠标停在工具条上时,离开控制台区不隐藏', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    const w = mountPage()
    await flush()

    await w.get('.console-display').trigger('mouseenter')
    await w.get('.sendkey-toolbar').trigger('mouseenter') // sendKeyToolbarHover = true
    await w.get('.console-display').trigger('mouseleave')
    expect(w.find('.sendkey-toolbar').exists()).toBe(true) // 没被隐藏
  })

  it('mousemove 到右侧 80px 内显示,移回左侧隐藏', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    const w = mountPage()
    await flush()

    const display = w.get('.console-display')
    stubRect(display.element as HTMLElement) // width=400 → 右侧 80px 阈值是 x>=320

    await display.trigger('mousemove', { clientX: 350 })
    expect(w.find('.sendkey-toolbar').exists()).toBe(true)

    await display.trigger('mousemove', { clientX: 100 })
    expect(w.find('.sendkey-toolbar').exists()).toBe(false)
  })

  it('VM 不是 running 时,鼠标怎么动都不显示工具条', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    const w = mountPage()
    await flush()

    const display = w.get('.console-display')
    stubRect(display.element as HTMLElement)

    await display.trigger('mouseenter')
    expect(w.find('.sendkey-toolbar').exists()).toBe(false)
    await display.trigger('mousemove', { clientX: 350 }) // 右侧 80px 内,但非 running
    expect(w.find('.sendkey-toolbar').exists()).toBe(false)
    await display.trigger('mouseleave')
    expect(w.find('.sendkey-toolbar').exists()).toBe(false)
  })

  // 硬约束(任务说明明确点名):onUnmounted 摘 fullscreenchange 监听必须用
  // vi.spyOn(document, 'removeEventListener') 断言事件名,不能写成占位断言。
  // 照抄 ConsoleHeader.test.ts「卸载时摘掉 document 监听」同款写法(:58-67)。
  it('卸载时摘掉 document 的 fullscreenchange 监听(不泄漏)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()

    const spy = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    expect(spy).toHaveBeenCalledWith('fullscreenchange', expect.any(Function))
    spy.mockRestore()
  })
})
