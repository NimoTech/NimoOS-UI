import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConsoleStage from './ConsoleStage.vue'
import { i18n } from '../../i18n'
import type { KvmVM } from '@nimotech/nimoos-service'

const VM = (state: string) => ({ id: 'v', name: 'x', state } as KvmVM)
const mk = (p: Record<string, unknown> = {}) =>
  mount(ConsoleStage, { props: { vm: VM('running'), connected: false, errorKey: '', processing: false, ...p },
    global: { plugins: [i18n] } })

describe('ConsoleStage 占位层', () => {
  it('未连接时显示占位层,连上后隐藏', () => {
    expect(mk().find('.console-placeholder').exists()).toBe(true)
    expect(mk({ connected: true }).find('.console-placeholder').exists()).toBe(false)
  })
  it('stopped 时显示开机大按钮,点了 emit start', async () => {
    const w = mk({ vm: VM('stopped') })
    const b = w.get('.start-vm-btn')
    await b.trigger('click')
    expect(w.emitted('start')).toHaveLength(1)
  })
  it('paused 时显示继续大按钮,点了 emit resume', async () => {
    const w = mk({ vm: VM('paused') })
    await w.get('.start-vm-btn').trigger('click')
    expect(w.emitted('resume')).toHaveLength(1)
  })
  it('running 但没连上时不显示大按钮(照 Vue2 :168-190 的 v-if 条件)', () => {
    expect(mk().find('.start-vm-btn').exists()).toBe(false)
  })
  it('processing 时大按钮禁用', () => {
    expect(mk({ vm: VM('stopped'), processing: true }).get('.start-vm-btn').attributes('disabled')).toBeDefined()
  })
  it('有错误时显示红色错误文案,且不显示大按钮(Vue2 的 v-if/else)', () => {
    const w = mk({ vm: VM('stopped'), errorKey: 'kvmVncFetchFailed' })
    expect(w.get('.console-hint').classes()).toContain('is-error')
    expect(w.text()).toContain('获取 VNC 信息失败')
    expect(w.find('.start-vm-btn').exists()).toBe(false)
  })
  it('暴露 hostEl 供 composable 挂 RFB', () => {
    const w = mk()
    expect((w.vm as unknown as { hostEl: HTMLElement }).hostEl).toBeTruthy()
  })
  it('大按钮有 aria-label', () => {
    expect(mk({ vm: VM('stopped') }).get('.start-vm-btn').attributes('aria-label')).toBeTruthy()
  })
  // 评审 Minor:硬约束 4(禁占位符号,须用真图)目前全靠人工核对 <script setup> 里
  // 有没有 import 真的 .svg。补一条能自动判别的用例——Vite 把 .svg 静态资源解析成
  // `data:image/svg+xml,...` 内联 URL(已用探针脚本核实过,不是猜的),真图片的 src
  // 会是这个前缀且两个按钮不同;换成占位符号(emoji/unicode 字符)或者两个按钮共用
  // 同一张图都会让这条用例失败。
  it('开机/恢复大按钮用的是真实 svg 图标,不是占位符号(硬约束 4)', () => {
    const powerSrc = mk({ vm: VM('stopped') }).get('.power-svg').attributes('src')
    const playSrc = mk({ vm: VM('paused') }).get('.power-svg').attributes('src')
    expect(powerSrc).toMatch(/^data:image\/svg\+xml/)
    expect(playSrc).toMatch(/^data:image\/svg\+xml/)
    expect(powerSrc).not.toBe(playSrc) // 开机图标与恢复图标不是同一张
  })

  // Task 7 评审订正:SendKeyToolbar 不再靠 Teleport + 父组件手写 addEventListener 挂进
  // `.console-display`,改成本组件转发 console-enter/console-leave/console-move 三个
  // 鼠标事件 + 一个 <slot />,由父组件(KvmPage)把工具条作为 slot 内容传入。这里补两条
  // 用例验证转发本身没接错——KvmPage.test.ts 的全量挂载测试只能间接证明"整体接线通了",
  // 不足以定位"是 ConsoleStage 转发错了还是 KvmPage 接错了"。
  it('转发 console-enter/console-leave/console-move 三个鼠标事件(Task 7)', async () => {
    const w = mk()
    const display = w.get('.console-display')
    await display.trigger('mouseenter')
    expect(w.emitted('console-enter')).toHaveLength(1)
    await display.trigger('mouseleave')
    expect(w.emitted('console-leave')).toHaveLength(1)
    await display.trigger('mousemove', { clientX: 42 })
    expect(w.emitted('console-move')).toHaveLength(1)
    expect((w.emitted('console-move')![0][0] as MouseEvent).clientX).toBe(42) // 原生事件对象透传,不是空壳
  })

  it('slot 内容渲染进 .console-display 内部(供 SendKeyToolbar 挂载,Task 7)', () => {
    const w = mount(ConsoleStage, {
      props: { vm: VM('running'), connected: false, errorKey: '', processing: false },
      slots: { default: '<div class="probe-slot-content">x</div>' },
      global: { plugins: [i18n] },
    })
    expect(w.find('.console-display .probe-slot-content').exists()).toBe(true)
  })
})
