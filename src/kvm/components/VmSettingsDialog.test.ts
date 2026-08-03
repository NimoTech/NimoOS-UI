import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import VmSettingsDialog from './VmSettingsDialog.vue'
import { i18n } from '../../i18n'
import type { SelectedOs } from './OsSelector.vue'
import type { KvmVM } from '@nimotech/nimoos-service'

// 真机 2026-08-03 curl 数据(brief 指定,fixture 不手编)。
const HOST = { cpuCores: 6, availableMemoryMB: 9234, availableDiskGB: 263, networkInterfaces: ['enp2s0', 'enp4s0', 'wlp1s0'], defaultDiskSize: 20 }
const VM = (over: Partial<KvmVM> = {}): KvmVM => ({
  id: 'e939191c-2bd2-4f14-88c9-0bf05d3b4d40', name: 'sp9-alpine-test', uuid: 'u',
  state: 'running', vcpu: 2, memory: 1024, disk: 8, diskUsedPercent: 0, diskPath: '/d',
  iso: '/DATA/KVM/isos/alpine-319.iso', os: 'linux', networkMode: 'nat', networkInterface: 'virbr0',
  firmware: 'bios', bootFromDisk: false, vncPort: 5900, vncWebsocketPort: 5700,
  spicePort: 0, spiceTlsPort: 0, autostart: false, createdAt: '', updatedAt: '', ...over,
})
const OS = (over: Partial<SelectedOs> = {}): SelectedOs => ({
  isLocal: false, id: 'alpine-319', name: 'Alpine', path: '/DATA/KVM/isos/alpine-319.iso',
  recommendedVcpu: 1, recommendedMemory: 512, minMemory: 256, minDisk: 2, ...over,
})

let w: VueWrapper | null = null
// 同 CreateVmDialog.test.ts / KvmGlobalSettingsDialog.test.ts 的既有写法:reka-ui 2.10
// 的 DialogPortal/DialogContent 首次挂载要等下一个 microtask(nextTick)才把内容真正
// 落地到 document.body。
const mk = async (props: Record<string, unknown> = {}) => {
  w = mount(VmSettingsDialog, {
    props: { open: true, vm: VM(), host: HOST, selectedOs: null, saving: false, submitError: '', ...props },
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

describe('VmSettingsDialog', () => {
  // 覆盖点 1:标题
  it('标题是「虚拟机设置 - <vm.name>」', async () => {
    await mk({ vm: VM({ name: 'sp9-alpine-test' }) })
    expect(q('.create-vm-title').textContent).toContain('虚拟机设置 - sp9-alpine-test')
  })

  // 覆盖点 2:两个 tab,默认 general 高亮;点快照 emit tab-change 并渲染 snapshots 插槽
  it('两个 tab 按钮,默认 general 高亮;点快照 emit tab-change 并渲染 snapshots 插槽内容', async () => {
    const wr = mount(VmSettingsDialog, {
      props: { open: true, vm: VM(), host: HOST, selectedOs: null, saving: false, submitError: '' },
      slots: { snapshots: '<div class="probe-snapshots">快照占位内容</div>' },
      global: { plugins: [i18n] }, attachTo: document.body,
    })
    await nextTick()
    const tabs = qa('.settings-tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].textContent).toContain('通用')
    expect(tabs[1].textContent).toContain('快照')
    expect(tabs[0].classList.contains('active')).toBe(true)
    expect(tabs[1].classList.contains('active')).toBe(false)
    // v-show 不会把元素从 DOM 里摘掉,只切 display——用 style.display 断言可见性,
    // 不能用"查得到/查不到"(querySelector 对 display:none 元素照样查得到)。
    expect((q('.snapshots-body') as HTMLElement).style.display).toBe('none')

    tabs[1].click()
    await wr.vm.$nextTick()
    expect(wr.emitted('tab-change')).toEqual([['snapshots']])
    expect(qa('.settings-tab')[1].classList.contains('active')).toBe(true)
    expect(qa('.settings-tab')[0].classList.contains('active')).toBe(false)
    expect((q('.snapshots-body') as HTMLElement).style.display).not.toBe('none')
    expect(q('.probe-snapshots')).not.toBeNull()
    expect(q('.probe-snapshots')!.textContent).toContain('快照占位内容')
    wr.unmount()
  })

  // 覆盖点 3:General 回填(name/disk/memory/vcpu/networkMode/firmware),networkMode 映射
  it('General 回填:name/disk/memory/vcpu 格子/firmware 来自 props.vm', async () => {
    await mk({ vm: VM({ name: 'my-vm', disk: 16, memory: 2048, vcpu: 3, firmware: 'uefi' }) })
    expect((q('input[name="name"]') as HTMLInputElement).value).toBe('my-vm')
    expect((q('input[name="disk"]') as HTMLInputElement).value).toBe('16')
    expect((q('input[name="memory"]') as HTMLInputElement).value).toBe('2048')
    // 断言总格子数(=host.cpuCores=6)而不仅是 active 数——与下面「cpuCores=0 时不渲染
    // 格子」那条搭配起来,才能真正区分"正确按 host.cpuCores 渲染"与"格子数量写死"两种
    // 实现(否则那条 cpuCores=0 用例在任何一个恒渲染 0 个格子的坏实现下都会假阳性通过)。
    expect(qa('.cv-cpu-btn')).toHaveLength(6)
    expect(qa('.cv-cpu-btn').filter((c) => c.classList.contains('active')).length).toBe(3)
    // 固件断言取 uefi(非默认值 bios)——避免"默认就是 bios"的永真断言(硬约束 15)。
    const [uefiBtn, biosBtn] = qa('.cv-firmware-btn')
    expect(uefiBtn.classList.contains('active')).toBe(true)
    expect(biosBtn.classList.contains('active')).toBe(false)
  })

  it('networkMode 映射:bridge+networkInterface → 回填网卡名;bridge+空 networkInterface → 回填 nat;nat → 回填 nat(照 Vue2 :1215)', async () => {
    const bridged = await mk({ vm: VM({ networkMode: 'bridge', networkInterface: 'enp2s0' }) })
    expect((q('.cv-select-native') as HTMLSelectElement).value).toBe('enp2s0')
    bridged.unmount()

    const bridgedNoIface = await mk({ vm: VM({ networkMode: 'bridge', networkInterface: '' }) })
    expect((q('.cv-select-native') as HTMLSelectElement).value).toBe('nat')
    bridgedNoIface.unmount()

    await mk({ vm: VM({ networkMode: 'nat', networkInterface: 'virbr0' }) })
    expect((q('.cv-select-native') as HTMLSelectElement).value).toBe('nat')
  })

  // 覆盖点 4:磁盘输入框 disabled,label 旁显示已使用百分比;0 与非 0 两种取值
  it('磁盘输入框 disabled,旁边显示 Math.round(diskUsedPercent)% 已使用', async () => {
    const wr = await mk({ vm: VM({ diskUsedPercent: 0 }) })
    expect((q('input[name="disk"]') as HTMLInputElement).disabled).toBe(true)
    expect(q('.cv-hint').textContent).toContain('0% 已使用')
    wr.unmount()

    await mk({ vm: VM({ diskUsedPercent: 42.6 }) })
    expect(q('.cv-hint').textContent).toContain('43% 已使用')
  })

  // 覆盖点 5:ISO 行显示路径/占位文案,点击 emit open-os-selector
  it('ISO 行:有值显示路径,空显示占位文案;点击 emit open-os-selector', async () => {
    const withIso = await mk({ vm: VM({ iso: '/DATA/KVM/isos/alpine-319.iso' }) })
    expect(q('.cv-iso-btn').textContent).toContain('/DATA/KVM/isos/alpine-319.iso')
    withIso.unmount()

    const noIso = await mk({ vm: VM({ iso: '', bootFromDisk: true }) })
    expect(q('.cv-iso-btn').textContent).toContain('未挂载 ISO')
    q('.cv-iso-btn').click()
    await noIso.vm.$nextTick()
    expect(noIso.emitted('open-os-selector')).toHaveLength(1)
  })

  // 覆盖点 6:弹出/挂载双态按钮
  it('bootFromDisk=false 显示"弹出"按钮,点击后切到硬盘引导并清空 iso', async () => {
    const wr = await mk({ vm: VM({ bootFromDisk: false, iso: '/DATA/KVM/isos/alpine-319.iso' }) })
    const eject = q('.cv-iso-eject')
    expect(eject.getAttribute('aria-label')).toBe('弹出 ISO')
    eject.click()
    await wr.vm.$nextTick()
    // bootFromDisk 翻转后按钮应变成"挂载"态,且 ISO 行显示回占位文案(iso 已清空)——
    // 这两个可观察效果合起来才能证明 `bootFromDisk=true; iso=''` 真的都执行了。
    expect(q('.cv-iso-eject').getAttribute('aria-label')).toBe('挂载 ISO')
    expect(q('.cv-iso-btn').textContent).toContain('未挂载 ISO')
  })

  it('bootFromDisk=true 显示"挂载"按钮,点击 emit open-os-selector', async () => {
    const wr = await mk({ vm: VM({ bootFromDisk: true, iso: '' }) })
    const mountBtn = q('.cv-iso-eject')
    expect(mountBtn.getAttribute('aria-label')).toBe('挂载 ISO')
    mountBtn.click()
    await wr.vm.$nextTick()
    expect(wr.emitted('open-os-selector')).toHaveLength(1)
  })

  // 覆盖点 7:选中 OS 后 iso 变新 path、bootFromDisk 变 false
  it('选中 OS 后 iso 变成新 path,bootFromDisk 变 false(照 Vue2 :1380-1381)', async () => {
    const wr = await mk({ vm: VM({ bootFromDisk: true, iso: '' }) })
    expect(q('.cv-iso-eject').getAttribute('aria-label')).toBe('挂载 ISO') // 起点:硬盘引导态
    await wr.setProps({ selectedOs: OS({ path: '/DATA/KVM/isos/debian-13.iso' }) })
    expect(q('.cv-iso-btn').textContent).toContain('/DATA/KVM/isos/debian-13.iso')
    expect(q('.cv-iso-eject').getAttribute('aria-label')).toBe('弹出 ISO') // bootFromDisk 变回 false
  })

  // 覆盖点 8:固件两按钮都 disabled,active 类正确反映 vm.firmware
  it('固件两按钮都 disabled,active 正确反映 vm.firmware(取非默认值 uefi,避免永真断言)', async () => {
    await mk({ vm: VM({ firmware: 'uefi' }) })
    const [uefiBtn, biosBtn] = qa('.cv-firmware-btn')
    expect(uefiBtn.hasAttribute('disabled')).toBe(true)
    expect(biosBtn.hasAttribute('disabled')).toBe(true)
    expect(uefiBtn.classList.contains('active')).toBe(true)
    expect(biosBtn.classList.contains('active')).toBe(false)
  })

  // 覆盖点 9:提交 payload
  it('提交 emit submit,payload 含 8 个可写字段,networkMode 折算照 Vue2 :1499-1500', async () => {
    const wr = await mk({ vm: VM({
      name: 'sp9-alpine-test', vcpu: 2, memory: 1024, disk: 8,
      iso: '/DATA/KVM/isos/alpine-319.iso', bootFromDisk: false, firmware: 'bios',
      networkMode: 'nat', networkInterface: 'virbr0',
    }) })
    await setVal(wr, 'input[name="name"]', 'renamed-vm')
    const sel = q('.cv-select-native') as HTMLSelectElement
    sel.value = 'enp4s0'; sel.dispatchEvent(new Event('change')); await wr.vm.$nextTick()
    q('.cv-primary-btn').click()
    await wr.vm.$nextTick()
    const payload = wr.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload).toEqual({
      name: 'renamed-vm', vcpu: 2, memory: 1024, disk: 8,
      iso: '/DATA/KVM/isos/alpine-319.iso', bootFromDisk: false, firmware: 'bios',
      networkMode: 'bridge', networkInterface: 'enp4s0',
    })
    expect(payload).not.toHaveProperty('os')
    expect(payload).not.toHaveProperty('osType')
    expect(payload).not.toHaveProperty('diskUsedPercent')
  })

  // 覆盖点 10:saving=true 时保存按钮 is-loading 且点不动(用合法表单排除校验失败的混淆——
  // 本组件没有校验失败分支,但同样先证明 saving=false 时确实能提交,排除"表单本身有问题"
  // 这个混淆因素,再证明 saving=true 时同一份表单不提交,唯一归因于这个守卫本身)。
  it('saving=true 时主按钮 is-loading 且点不动(防重复提交)', async () => {
    const ok = await mk({ saving: false })
    q('.cv-primary-btn').click()
    await ok.vm.$nextTick()
    expect(ok.emitted('submit')).toHaveLength(1)
    ok.unmount()

    const busy = await mk({ saving: true })
    const btn = q('.cv-primary-btn') as HTMLButtonElement
    expect(btn.classList.contains('is-loading')).toBe(true)
    // 原生 disabled 本身就会挡掉 `.click()`——用 dispatchEvent 绕开原生拦截,
    // 才能测到 onSubmit() 内部 `if (props.saving) return` 这道 JS 层守卫本身。
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await busy.vm.$nextTick()
    expect(busy.emitted('submit')).toBeUndefined()
  })

  // 覆盖点 11:submitError 内联显示,弹窗不关
  it('submitError 显示在 .cv-error,弹窗不关(硬约束 7)', async () => {
    const wr = await mk({ submitError: 'domain name already exists' })
    expect(q('.cv-error').textContent).toContain('domain name already exists')
    expect(wr.emitted('update:open')).toBeUndefined()
  })

  // 覆盖点 12:重新打开时表单从 props.vm 重新回填,不保留脏值
  it('重新打开时表单从 props.vm 重新回填(不保留上次的脏值)', async () => {
    const wr = await mk({ vm: VM({ name: 'original-name' }) })
    await setVal(wr, 'input[name="name"]', 'dirty-value')
    await wr.setProps({ open: false })
    await wr.setProps({ open: true })
    expect((q('input[name="name"]') as HTMLInputElement).value).toBe('original-name')
  })

  // 覆盖点 13:host.cpuCores=0 时不渲染 CPU 格子
  it('host.cpuCores=0 时不渲染 CPU 格子', async () => {
    await mk({ host: { ...HOST, cpuCores: 0 } })
    expect(qa('.cv-cpu-btn')).toHaveLength(0)
  })

  // Global Constraint #16:本组件持有本地编辑副本(form),而 useVmList.update 成功后会
  // 写回选中的 VM 对象——所以"改值→取消(不提交)"绝不能污染 props.vm。
  it('Global Constraint #16:改了值但点 ✕ 取消,不污染 props.vm', async () => {
    const vm = VM({ name: 'untouched-name', memory: 1024 })
    const wr = await mk({ vm })
    await setVal(wr, 'input[name="name"]', 'edited-but-cancelled')
    expect((q('input[name="name"]') as HTMLInputElement).value).toBe('edited-but-cancelled') // 确认编辑确实生效
    q('.create-vm-close').click() // 触发 ✕ 关闭,不经过保存
    await wr.vm.$nextTick()
    expect(vm.name).toBe('untouched-name') // 共享对象未被污染
    expect(vm.memory).toBe(1024)
  })

  // 评审 Important 惯例(本仓库既有约定):foot 只在 general tab 显示(照 Vue2 :387)。
  it('切到快照 tab 时脚部按钮消失', async () => {
    const wr = await mk()
    expect(q('.cv-primary-btn')).not.toBeNull()
    qa('.settings-tab')[1].click()
    await wr.vm.$nextTick()
    expect(q('.cv-primary-btn')).toBeNull()
  })
})
