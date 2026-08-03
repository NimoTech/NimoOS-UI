import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import KvmGlobalSettingsDialog from './KvmGlobalSettingsDialog.vue'
import { i18n } from '../../i18n'

const api = { getSettings: vi.fn(), updateSettings: vi.fn() }
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))

const REAL = {
  autostart: false, availableDiskGB: 263, availableMemoryMB: 9234, cpuCores: 6,
  defaultDiskSize: 20, defaultMemory: 2048, defaultVcpu: 2,
  networkInterfaces: ['enp2s0', 'enp4s0', 'wlp1s0'], storagePath: '/DATA/KVM',
}

let w: VueWrapper | null = null
// 硬约束 5:brief 逐字稿的 `mk` 是同步函数。实测 reka-ui 2.10(本仓库既有版本)的
// DialogPortal/DialogContent 首次挂载要等下一个 microtask(nextTick)才把内容真正落地到
// document.body——与 KvmDialog.test.ts / src/components/ui/Dialog.test.ts 已确立的写法
// 一致。这里把 `mk` 改成 async 并在 mount 之后 `await nextTick()`,断言内容一个不减。
const mk = async () => {
  w = mount(KvmGlobalSettingsDialog, {
    props: { open: true }, global: { plugins: [i18n] }, attachTo: document.body,
  })
  await nextTick()
  return w
}
beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(api).forEach((f) => f.mockReset())
  api.getSettings.mockResolvedValue(REAL)
  api.updateSettings.mockResolvedValue({})
})
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = '' })

const q = (sel: string) => document.body.querySelector(sel) as HTMLElement

describe('KvmGlobalSettingsDialog', () => {
  it('打开即拉设置并回填四个字段', async () => {
    const wr = await mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    expect(api.getSettings).toHaveBeenCalledTimes(1)
    expect((q('input[name="storagePath"]') as HTMLInputElement).value).toBe('/DATA/KVM')
    expect((q('input[name="defaultVcpu"]') as HTMLInputElement).value).toBe('2')
    expect((q('input[name="defaultMemory"]') as HTMLInputElement).value).toBe('2048')
    expect(q('.cv-switch input')!.hasAttribute('checked') ||
      (q('.cv-switch input') as HTMLInputElement).checked).toBe(false)
  })

  it('标题是「系统设置」(Vue2 那个 key 是 Settings,zh_CN.json 译作系统设置)', async () => {
    await mk(); await new Promise((r) => setTimeout(r))
    expect(q('.create-vm-title').textContent).toContain('系统设置')
  })

  it('点保存 → 只发 4 个可写字段 → emit update:open=false', async () => {
    const wr = await mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    ;(q('.cv-primary-btn') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    expect(api.updateSettings).toHaveBeenCalledWith({
      storagePath: '/DATA/KVM', defaultVcpu: 2, defaultMemory: 2048, autostart: false,
    })
    expect(wr.emitted('update:open')).toEqual([[false]])
  })

  it('保存失败 → 弹窗内联 .cv-error 显示后端 message,弹窗不关(硬约束 7)', async () => {
    api.updateSettings.mockRejectedValue(new Error('storage path not writable'))
    const wr = await mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    ;(q('.cv-primary-btn') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    expect(q('.cv-error').textContent).toContain('storage path not writable')
    expect(wr.emitted('update:open')).toBeUndefined()
  })

  it('保存成功弹全局 toast「设置已保存」', async () => {
    const { useToast } = await import('../../stores/toast')
    const wr = await mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    ;(q('.cv-primary-btn') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    expect(useToast().toasts.map((x) => x.text)).toContain('设置已保存')
  })
})
