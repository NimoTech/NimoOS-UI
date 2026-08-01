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
})
