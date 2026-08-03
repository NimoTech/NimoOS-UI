import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import KvmGlobalSettingsDialog from './KvmGlobalSettingsDialog.vue'
import { i18n } from '../../i18n'

const api = { getSettings: vi.fn(), updateSettings: vi.fn() }
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))

// 评审 Important #2:需要在组件外部观察 useKvmHostInfo() 返回的 settings ref 有没有被
// 污染——但组件不通过 props/emit 暴露这个内部 composable 实例。这里用 vi.mock 包一层
// "转发到真实实现,但把每次调用的返回值记下来"的薄壳(不是替换行为,是真实的
// useKvmHostInfo 逻辑本身,只是多了一个可供测试断言的"旁路观察点"),不需要改动
// 生产代码(不新增 defineExpose 之类的测试专用钩子)。
type HostInfoModule = typeof import('../composables/useKvmHostInfo')
let lastHostInfo: ReturnType<HostInfoModule['useKvmHostInfo']> | null = null
vi.mock('../composables/useKvmHostInfo', async (importOriginal) => {
  const actual = await importOriginal<HostInfoModule>()
  return {
    ...actual,
    useKvmHostInfo: (...args: Parameters<HostInfoModule['useKvmHostInfo']>) => {
      const instance = actual.useKvmHostInfo(...args)
      lastHostInfo = instance
      return instance
    },
  }
})

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

  // 评审 Important #1:上面「打开即拉设置并回填四个字段」那条断言的是 autostart:false,
  // 而 checkbox 在完全没有 v-model 接线时默认就是 unchecked——那条断言区分不出「接对了」
  // 和「根本没接」。这里用 autostart:true 的 fixture,断言开关真的翻成 checked。
  it('评审 Important #1:autostart:true 时开关回填为 checked(区分"接对了"与"根本没接线")', async () => {
    api.getSettings.mockResolvedValue({ ...REAL, autostart: true })
    const wr = await mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    expect((q('.cv-switch input') as HTMLInputElement).checked).toBe(true)
  })

  // 评审 Important #2:brief Step 5 明确要求"表单编辑用本地副本,不要直接双向绑
  // useKvmHostInfo() 的 settings ref"——理由是 Task 7(创建弹窗)要拿 settings 当默认值,
  // 这里改了值又取消,脏值不该污染共享 state。之前只实现了隔离,没有测试证明它;这里补上:
  // 编辑输入框 → 点关闭(不点保存)→ 断言 useKvmHostInfo() 返回的 settings ref 仍是
  // fetch 回来的原值,没有被这次编辑污染。
  it('评审 Important #2:改了值但取消(不保存)不污染共享 settings state', async () => {
    const wr = await mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()

    const input = q('input[name="storagePath"]') as HTMLInputElement
    input.value = '/tmp/somewhere-else'
    input.dispatchEvent(new Event('input'))
    await wr.vm.$nextTick()
    expect(input.value).toBe('/tmp/somewhere-else') // 确认编辑确实生效,排除"根本没改上"的假阳性

    ;(q('.create-vm-close') as HTMLButtonElement).click() // 触发关闭,不经过保存
    await wr.vm.$nextTick()

    expect(lastHostInfo?.settings.value.storagePath).toBe('/DATA/KVM')
  })
})
