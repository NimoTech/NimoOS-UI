import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import CreateVmDialog from './CreateVmDialog.vue'
import { i18n } from '../../i18n'
import type { SelectedOs } from './OsSelector.vue'
import type { KvmISO } from '@nimotech/nimoos-service'

const HOST = { cpuCores: 6, availableMemoryMB: 9234, availableDiskGB: 263, networkInterfaces: ['enp2s0', 'wlp1s0'], defaultDiskSize: 20 }
const DEFAULTS = { storagePath: '/DATA/KVM', defaultVcpu: 2, defaultMemory: 2048, autostart: false }
const OS = (over: Partial<SelectedOs> = {}): SelectedOs => ({
  isLocal: false, id: 'alpine-319', name: 'Alpine', path: '/DATA/KVM/isos/alpine-319.iso',
  recommendedVcpu: 1, recommendedMemory: 512, minMemory: 256, minDisk: 2, ...over,
})
// 修复(fixture 缺字段,见组件顶部注释「brief 测试代码问题」#2):alpine-319 是 OS()
// 默认工厂产出的 SelectedOs.id,真实链路里这个 id 一定能在页面级 isos 列表里查到同一条
// 记录(OsSelector 的 SelectedOs.id 本来就是从 isos 里选出来的那一条)——watch(osTemplate)
// 靠这条记录才能把 osType/firmware/os 显示名重新推导一致。brief 原稿两处用 OS() 却把
// isos 留空,导致 osTemplate 联动查不到模板、被迫走「找不到就整段 no-op」分支(1:1 照抄
// Vue2 :731 的行为),form.os/osType 会停在别处设的值——众测试里只有下面这条按值全等
// (toEqual)断言到 os/osType,必须补全这条 fixture 才有意义。
const ISO_ALPINE: KvmISO = {
  id: 'alpine-319', name: 'Alpine', version: '3.19', category: 'linux', size: '60 MB',
  status: 'downloaded', progress: 0, path: '/DATA/KVM/isos/alpine-319.iso',
  recommendedVcpu: 1, recommendedMemory: 512, minMemory: 256, minDisk: 2,
}

let w: VueWrapper | null = null
// 修复(brief 测试代码缺陷 #3,已申报):brief 原稿 `mk` 是同步函数,挂载后立刻同步查
// document.body。本仓库 reka-ui 2.10 的 DialogPortal/DialogContent 首次挂载要等下一个
// microtask(nextTick)才把内容真正落地到 document.body——Task 1(KvmDialog.test.ts)/
// Task 2(KvmGlobalSettingsDialog.test.ts)/Task 5(OsSelector.test.ts)都踩过这同一个坑
// 并改成了 async mk + await nextTick(),这里照同样的写法改,断言内容一个不减、不因此
// 削弱任何检查。
const mk = async (props: Record<string, unknown> = {}) => {
  w = mount(CreateVmDialog, {
    props: { open: true, host: HOST, defaults: DEFAULTS, isos: [], selectedOs: null, creating: false, submitError: '', ...props },
    global: { plugins: [i18n] }, attachTo: document.body,
  })
  await nextTick()
  return w
}
afterEach(() => { w?.unmount(); w = null; document.body.innerHTML = '' })
const q = (s: string) => document.body.querySelector(s) as HTMLElement
const qa = (s: string) => [...document.body.querySelectorAll(s)] as HTMLElement[]
const setVal = async (wr: VueWrapper, sel: string, v: string) => {
  const el = q(sel) as HTMLInputElement
  el.value = v; el.dispatchEvent(new Event('input')); await wr.vm.$nextTick()
}

describe('CreateVmDialog', () => {
  it('标题「创建新虚拟机」,ISO 行未选时显示占位文案', async () => {
    await mk()
    expect(q('.create-vm-title').textContent).toContain('创建新虚拟机')
    expect(q('.cv-iso-btn').textContent).toContain('选择 ISO 镜像')
  })

  it('CPU 核心格子数 = host.cpuCores(真机 6 个),n<=vcpu 的高亮', async () => {
    const wr = await mk()
    const cells = qa('.cv-cpu-btn')
    expect(cells).toHaveLength(6)
    expect(cells.filter((c) => c.classList.contains('active')).length).toBe(2) // defaultVcpu=2
    cells[3].click(); await wr.vm.$nextTick()
    expect(qa('.cv-cpu-btn').filter((c) => c.classList.contains('active')).length).toBe(4)
  })

  it('host.cpuCores=0(settings 还没回来)时不渲染格子(spec §12 #6,不闪 16 个)', async () => {
    await mk({ host: { ...HOST, cpuCores: 0 } })
    expect(qa('.cv-cpu-btn')).toHaveLength(0)
  })

  it('网络下拉 = NAT + 每张网卡一项「桥接到 xxx」', async () => {
    await mk()
    const opts = qa('.cv-select-native option').map((o) => o.textContent?.trim())
    expect(opts).toEqual(['NAT', '桥接到 enp2s0', '桥接到 wlp1s0'])
  })

  it('打开时按全局默认预填 vcpu/memory,磁盘用 defaultDiskSize(照 Vue2 :1155-1188)', async () => {
    await mk()
    expect((q('input[name="memory"]') as HTMLInputElement).value).toBe('2048')
    expect((q('input[name="disk"]') as HTMLInputElement).value).toBe('20')
  })

  it('点 ISO 行 emit open-os-selector', async () => {
    const wr = await mk(); q('.cv-iso-btn').click(); await wr.vm.$nextTick()
    expect(wr.emitted('open-os-selector')).toHaveLength(1)
  })

  it('选中 OS 后 ISO 行显示 path,并按推荐规格联动 vcpu/memory', async () => {
    const wr = await mk()
    await wr.setProps({ selectedOs: OS({ recommendedVcpu: 4, recommendedMemory: 4096 }) })
    expect(q('.cv-iso-btn').textContent).toContain('/DATA/KVM/isos/alpine-319.iso')
    expect((q('input[name="memory"]') as HTMLInputElement).value).toBe('4096')
    expect(qa('.cv-cpu-btn').filter((c) => c.classList.contains('active')).length).toBe(4)
  })

  it('固件两按钮可切换(与 VM 设置弹窗里的 disabled 版不同)', async () => {
    const wr = await mk()
    const [uefi, bios] = qa('.cv-firmware-btn')
    expect(bios.classList.contains('active')).toBe(true)
    uefi.click(); await wr.vm.$nextTick()
    expect(qa('.cv-firmware-btn')[0].classList.contains('active')).toBe(true)
  })

  it('「系统版本」下拉只在本地 ISO 时出现(照 Vue2 :476)', async () => {
    const wr = await mk()
    expect(qa('select[name="osTemplate"]')).toHaveLength(0)
    await wr.setProps({ selectedOs: OS({ isLocal: true, id: 'local', name: 'custom.iso' }) })
    expect(qa('select[name="osTemplate"]')).toHaveLength(1)
  })

  // 修复(brief 测试代码缺陷 #1,已申报):原稿只 setVal 了 disk,从没填过虚拟机名称——
  // validateCreateVm 的校验顺序是「名字 → OS → 磁盘下限 → …」(createVmValidate.ts 逐字
  // 照 Vue2 :1451 起的顺序),名字空着必然先报 kvmErrNoName,断言里期待的磁盘错误文案永远
  // 到不了、这条用例实际在断言一个从未发生的分支——手误式的「漏了一步 setVal」,补上名字。
  it('校验失败时内联 .cv-error 显示文案 + 参数,不 emit submit(硬约束 7)', async () => {
    const wr = await mk({ selectedOs: OS({ minDisk: 2 }) })
    await setVal(wr, 'input[name="name"]', 'x')
    await setVal(wr, 'input[name="disk"]', '4')
    q('.cv-primary-btn').click(); await wr.vm.$nextTick()
    expect(q('.cv-error').textContent).toContain('磁盘大小必须至少为 8 GB')
    expect(wr.emitted('submit')).toBeUndefined()
  })

  // 修复(brief 测试代码缺陷 #2,已申报,见文件头 ISO_ALPINE 注释):补 isos 里的匹配记录,
  // 且把 vcpu 的期望值从 2 改成 1——OS() 出厂值 recommendedVcpu:1,「选中 OS 后有推荐值
  // 就覆盖 vcpu/memory」这条规则(watch(selectedOs) 直接读 os.recommendedVcpu)对 vcpu
  // 和 memory 一视同仁,原稿 memory 按推荐值算对了(512)、vcpu 却手误留了 defaults 的 2,
  // 两个字段本该同一条规则同一个结果,数值不该不一致。
  it('校验通过 emit submit,payload 不含 osTemplate / autostart(后端不认,spec §1.15)', async () => {
    const wr = await mk({ selectedOs: OS(), isos: [ISO_ALPINE] })
    await setVal(wr, 'input[name="name"]', 'p6-throwaway')
    await setVal(wr, 'input[name="disk"]', '8')
    q('.cv-primary-btn').click(); await wr.vm.$nextTick()
    const payload = wr.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload).toEqual({
      name: 'p6-throwaway', vcpu: 1, memory: 512, disk: 8,
      iso: '/DATA/KVM/isos/alpine-319.iso', os: 'Alpine', osType: 'linux',
      networkMode: 'nat', networkInterface: '', firmware: 'bios',
    })
    expect(payload).not.toHaveProperty('osTemplate')
    expect(payload).not.toHaveProperty('autostart')
  })

  it('选了桥接网卡时 networkMode=bridge、networkInterface=网卡名(照 Vue2 :1478-1479)', async () => {
    const wr = await mk({ selectedOs: OS(), isos: [ISO_ALPINE] })
    await setVal(wr, 'input[name="name"]', 'x')
    await setVal(wr, 'input[name="disk"]', '8')
    const sel = q('.cv-select-native') as HTMLSelectElement
    sel.value = 'enp2s0'; sel.dispatchEvent(new Event('change')); await wr.vm.$nextTick()
    q('.cv-primary-btn').click(); await wr.vm.$nextTick()
    expect(wr.emitted('submit')![0][0]).toMatchObject({ networkMode: 'bridge', networkInterface: 'enp2s0' })
  })

  // 修复(评审 Important,brief 带来的第 4 处缺陷,已申报):原稿挂载时表单是空的
  // (从没填过 name),`creating` 守卫整行删掉后 validateCreateVm 也会因为「名字为空」
  // 独立拒绝、同样不 emit submit——`expect(...).toBeUndefined()` 在「守卫存在」和
  // 「守卫被删」两种情况下都通过,没有判别力,只有 is-loading 那句断言是真有效的。
  // 改法:先证明同一份合法表单在 creating=false 下确实能提交(排除「表单本身不合法」
  // 这个混淆因素),再证明 creating=true 时同一份合法表单不提交——此时不提交才能唯一
  // 归因于这个防重复提交守卫本身。
  it('creating=true 时主按钮 is-loading 且点不动(防重复提交,用合法表单排除校验失败的混淆)', async () => {
    const ok = await mk({ selectedOs: OS(), isos: [ISO_ALPINE], creating: false })
    await setVal(ok, 'input[name="name"]', 'x')
    await setVal(ok, 'input[name="disk"]', '8')
    q('.cv-primary-btn').click(); await ok.vm.$nextTick()
    expect(ok.emitted('submit')).toHaveLength(1)
    ok.unmount()

    const busy = await mk({ selectedOs: OS(), isos: [ISO_ALPINE], creating: true })
    await setVal(busy, 'input[name="name"]', 'x')
    await setVal(busy, 'input[name="disk"]', '8')
    const btn = q('.cv-primary-btn') as HTMLButtonElement
    expect(btn.classList.contains('is-loading')).toBe(true)
    // 用 dispatchEvent 而不是 `.click()`——原生 `disabled` 属性本身就会挡掉
    // `.click()`(jsdom 与真实浏览器一致的行为,已用最小复现脚本验证),这条守卫
    // 测的是 `onSubmit()` 内部 `if (props.creating) return` 这道防线,不是
    // `disabled` 属性本身;必须用能绕开原生拦截的方式触发,才能让这道内部守卫
    // 真正被测到(评审要求的变异验证见任务报告)。
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await busy.vm.$nextTick()
    expect(busy.emitted('submit')).toBeUndefined()
  })

  it('submitError 由父组件传下来,显示在同一个 .cv-error 位', async () => {
    await mk({ submitError: 'domain name already exists' })
    expect(q('.cv-error').textContent).toContain('domain name already exists')
  })

  it('重新打开时表单复位(照 Vue2 showCreateVM 每次重建 newVM)', async () => {
    const wr = await mk()
    await setVal(wr, 'input[name="name"]', 'dirty')
    await wr.setProps({ open: false }); await wr.setProps({ open: true })
    expect((q('input[name="name"]') as HTMLInputElement).value).toBe('')
  })
})
