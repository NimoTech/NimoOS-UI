import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import type { KvmVM } from '@nimotech/nimoos-service'

const api = {
  getVMList: vi.fn(), getVM: vi.fn(), startVM: vi.fn(), stopVM: vi.fn(),
  restartVM: vi.fn(), pauseVM: vi.fn(), resumeVM: vi.fn(), wakeupVM: vi.fn(),
  deleteVM: vi.fn(), setAutostart: vi.fn(), setBootFromDisk: vi.fn(),
}
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))

// 可控的 MessageBus 桩:测试里手动 emit
const handlers: Record<string, ((p: unknown) => void)[]> = {}
vi.mock('../../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on(ev: string, cb: (p: unknown) => void) {
      ;(handlers[ev] ||= []).push(cb)
      return () => { handlers[ev] = handlers[ev].filter((h) => h !== cb) }
    },
  }),
}))
const emit = (ev: string, props: unknown) => (handlers[ev] || []).forEach((h) => h(props))

import { useVmList } from './useVmList'

const VM = (over: Partial<KvmVM> = {}): KvmVM => ({
  id: 'vm-1', name: 'sp9-alpine-test', uuid: 'u', state: 'running', vcpu: 2, memory: 1024,
  disk: 8, diskUsedPercent: 0, diskPath: '/d', iso: '/DATA/KVM/isos/alpine-319.iso', os: 'linux',
  networkMode: 'nat', networkInterface: 'virbr0', firmware: 'bios', bootFromDisk: false,
  vncPort: 5900, vncWebsocketPort: 5700, spicePort: 0, spiceTlsPort: 0, autostart: false,
  createdAt: '', updatedAt: '', ...over,
})

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  Object.keys(handlers).forEach((k) => delete handlers[k])
  api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
  api.getVM.mockResolvedValue(VM())
  ;['startVM','stopVM','restartVM','pauseVM','resumeVM','wakeupVM','deleteVM'].forEach(
    (k) => (api as Record<string, ReturnType<typeof vi.fn>>)[k].mockResolvedValue(undefined))
  api.setAutostart.mockImplementation((_id: string, v: boolean) => Promise.resolve(v))
  api.setBootFromDisk.mockResolvedValue(undefined)
})

describe('fetchVMs', () => {
  it('首次拉取后自动选中第一台(Vue2 :900)', async () => {
    const s = useVmList()
    await s.fetchVMs()
    expect(s.vms.value).toHaveLength(1)
    expect(s.selectedVM.value?.id).toBe('vm-1')
  })

  it('空列表时 selectedVM 保持 null(P5 无创建弹窗,走空态;Vue2 这里自动弹创建框,P6 补)', async () => {
    api.getVMList.mockResolvedValue({ data: [], total: 0 })
    const s = useVmList()
    await s.fetchVMs()
    expect(s.selectedVM.value).toBeNull()
  })

  it('刷新后原选中项仍在 → 换成新对象且保持选中', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockResolvedValue({ data: [VM({ state: 'stopped' })], total: 1 })
    await s.fetchVMs()
    expect(s.selectedVM.value?.state).toBe('stopped')
  })

  it('刷新后原选中项消失 → selectedVM 置空', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'other' })], total: 1 })
    await s.fetchVMs()
    expect(s.selectedVM.value).toBeNull()
  })

  it('刷新时保活 spicePort(列表接口不返回,只有 /vnc 返回)', async () => {
    const s = useVmList()
    await s.fetchVMs()
    s.selectedVM.value!.spicePort = 5901
    s.selectedVM.value!.spiceTlsPort = 5902
    // 评审修正(critical 1):原来这里复用了 beforeEach 的 mockResolvedValue,但
    // vi.fn().mockResolvedValue(v) 只在调用时求值一次、之后每次调用都返回同一个对象
    // 引用——上面对 selectedVM 的直接赋值改的就是这个被共享的对象,导致第二次
    // fetchVMs() 拿到的“新数据”其实还是那个已经被改过的旧对象,preserveSpice 删不删都
    // 测不出来。这里显式 mockImplementation 成每次都新构造对象、spicePort 显式为 0,
    // 才是真的模拟“后端吐一份全新的、不含 spicePort 的响应”。
    api.getVMList.mockImplementation(() =>
      Promise.resolve({ data: [VM({ spicePort: 0, spiceTlsPort: 0 })], total: 1 }))
    await s.fetchVMs()  // 新数据 spicePort=0
    expect(s.selectedVM.value?.spicePort).toBe(5901)
    expect(s.selectedVM.value?.spiceTlsPort).toBe(5902)
  })

  it('请求失败时列表清空、不抛', async () => {
    api.getVMList.mockRejectedValue(new Error('libvirt down'))
    const s = useVmList()
    await s.fetchVMs()
    expect(s.vms.value).toEqual([])
  })

  it('runningCount 只数 running', async () => {
    api.getVMList.mockResolvedValue({ data: [VM(), VM({ id: 'b', state: 'stopped' })], total: 2 })
    const s = useVmList()
    await s.fetchVMs()
    expect(s.runningCount.value).toBe(1)
  })
})

describe('过期守卫', () => {
  it('后发的 fetchVMs 先返回时,先发的迟到结果不得覆盖(交错路径)', async () => {
    let resolveSlow: (v: unknown) => void = () => {}
    api.getVMList
      .mockImplementationOnce(() => new Promise((r) => { resolveSlow = r }))       // 慢的,先发
      .mockResolvedValueOnce({ data: [VM({ name: 'fresh' })], total: 1 })          // 快的,后发
    const s = useVmList()
    const slow = s.fetchVMs()
    await s.fetchVMs()                       // 后发先至
    expect(s.vms.value[0].name).toBe('fresh')
    resolveSlow({ data: [VM({ name: 'stale' })], total: 1 })
    await slow
    expect(s.vms.value[0].name).toBe('fresh')  // 迟到的旧结果被丢弃
  })

  it('dispose 之后到达的结果不再写入', async () => {
    let resolveIt: (v: unknown) => void = () => {}
    api.getVMList.mockImplementationOnce(() => new Promise((r) => { resolveIt = r }))
    const s = useVmList()
    const p = s.fetchVMs()
    s.dispose()
    resolveIt({ data: [VM({ name: 'late' })], total: 1 })
    await p
    expect(s.vms.value).toEqual([])
  })

  it('dispose 后,在途的电源动作迟到结果不再写 state、不触发 VNC 回调(评审 3)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ state: 'stopped' })], total: 1 })
    let resolveStart: () => void = () => {}
    api.startVM.mockImplementation(() => new Promise<void>((r) => { resolveStart = () => r(undefined) }))
    const s = useVmList()
    await s.fetchVMs()
    const onC = vi.fn()
    s.onVncShouldConnect(onC)
    const p = s.start(s.selectedVM.value!)
    s.dispose()
    resolveStart()
    await p
    expect(s.selectedVM.value?.state).toBe('stopped')
    expect(onC).not.toHaveBeenCalled()
  })

  it('fetchVM 过期守卫:连点两台 VM,先发但迟到的详情响应不覆盖后发已经写入的数据', async () => {
    api.getVMList.mockResolvedValue({ data: [VM(), VM({ id: 'b', state: 'stopped' })], total: 2 })
    let resolveSlow: (v: unknown) => void = () => {}
    api.getVM
      .mockImplementationOnce(() => new Promise((r) => { resolveSlow = r })) // 选 vm-1,慢,先发
      .mockResolvedValueOnce(VM({ id: 'b', state: 'stopped', name: 'b-detail' })) // 选 b,快,后发
    const s = useVmList()
    await s.fetchVMs()
    const p1 = s.selectVM(s.vms.value[0]) // 触发 fetchVM('vm-1'),挂起
    await s.selectVM(s.vms.value[1])      // 触发 fetchVM('b'),先完成
    expect(s.vms.value[1].name).toBe('b-detail')
    resolveSlow(VM({ id: 'vm-1', name: 'stale-a-detail' }))
    await p1
    // 迟到的 vm-1 详情被丢弃,列表项不应该被这份过期数据覆盖
    expect(s.vms.value[0].name).not.toBe('stale-a-detail')
  })
})

describe('MessageBus 事件(照 Vue2 :766-826)', () => {
  it('vm_started 把该 VM 改成 running 并触发 VNC 连接回调', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ state: 'stopped' })], total: 1 })
    const s = useVmList()
    await s.fetchVMs()
    const onConnect = vi.fn()
    s.onVncShouldConnect(onConnect)
    emit('kvm:vm_started', { vm_id: 'vm-1' })
    await nextTick()
    expect(s.vms.value[0].state).toBe('running')
    expect(onConnect).toHaveBeenCalledOnce()
  })

  it('vm_stopped 改状态并触发断开回调', async () => {
    const s = useVmList()
    await s.fetchVMs()
    const onDisconnect = vi.fn()
    s.onVncShouldDisconnect(onDisconnect)
    emit('kvm:vm_stopped', { vm_id: 'vm-1' })
    await nextTick()
    expect(s.selectedVM.value?.state).toBe('stopped')
    expect(onDisconnect).toHaveBeenCalledOnce()
  })

  it('vm_paused → paused 且断开;vm_resumed → running 且连接', async () => {
    const s = useVmList()
    await s.fetchVMs()
    const onC = vi.fn(); const onD = vi.fn()
    s.onVncShouldConnect(onC); s.onVncShouldDisconnect(onD)
    emit('kvm:vm_paused', { vm_id: 'vm-1' }); await nextTick()
    expect(s.selectedVM.value?.state).toBe('paused')
    expect(onD).toHaveBeenCalledOnce()
    emit('kvm:vm_resumed', { vm_id: 'vm-1' }); await nextTick()
    expect(s.selectedVM.value?.state).toBe('running')
    expect(onC).toHaveBeenCalledOnce()
  })

  it('事件里没有 vm_id 时退化成整表刷新(Vue2 的 else 分支)', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockClear()
    emit('kvm:vm_started', {})
    await nextTick()
    expect(api.getVMList).toHaveBeenCalledOnce()
  })

  it('vm_deleted 从列表移除;若删的是选中项则清空选中', async () => {
    const s = useVmList()
    await s.fetchVMs()
    emit('kvm:vm_deleted', { vm_id: 'vm-1' })
    await nextTick()
    expect(s.vms.value).toHaveLength(0)
    expect(s.selectedVM.value).toBeNull()
  })

  it('vm_created / vm_autostart_changed 触发整表刷新', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockClear()
    emit('kvm:vm_created', { vm_id: 'x' })
    emit('kvm:vm_autostart_changed', { vm_id: 'vm-1' })
    await nextTick()
    expect(api.getVMList).toHaveBeenCalledTimes(2)
  })

  it('事件针对的是别的 VM 时,不动当前选中项的 VNC', async () => {
    api.getVMList.mockResolvedValue({ data: [VM(), VM({ id: 'other', state: 'stopped' })], total: 2 })
    const s = useVmList()
    await s.fetchVMs()
    const onC = vi.fn()
    s.onVncShouldConnect(onC)
    emit('kvm:vm_started', { vm_id: 'other' })
    await nextTick()
    expect(s.vms.value[1].state).toBe('running')
    expect(onC).not.toHaveBeenCalled()
  })

  it('dispose 后不再响应事件', async () => {
    const s = useVmList()
    await s.fetchVMs()
    s.dispose()
    emit('kvm:vm_stopped', { vm_id: 'vm-1' })
    await nextTick()
    expect(s.selectedVM.value?.state).toBe('running')
  })
})

describe('电源动作', () => {
  it('start 乐观改状态为 running 并请求连接 VNC', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ state: 'stopped' })], total: 1 })
    const s = useVmList()
    await s.fetchVMs()
    const onC = vi.fn(); s.onVncShouldConnect(onC)
    await s.start(s.selectedVM.value!)
    expect(api.startVM).toHaveBeenCalledWith('vm-1')
    expect(s.selectedVM.value?.state).toBe('running')
    expect(onC).toHaveBeenCalledOnce()
  })

  it('start 失败时不改状态、写 lastError', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ state: 'stopped' })], total: 1 })
    api.startVM.mockRejectedValue(new Error('boom'))
    const s = useVmList()
    await s.fetchVMs()
    await s.start(s.selectedVM.value!)
    expect(s.selectedVM.value?.state).toBe('stopped')
    expect(s.lastError.value).toBeTruthy()
  })

  it('restart 只断开、不立刻重连(修 Vue2 竞态,靠 vm_started 事件兜底)', async () => {
    const s = useVmList()
    await s.fetchVMs()
    const onC = vi.fn(); const onD = vi.fn()
    s.onVncShouldConnect(onC); s.onVncShouldDisconnect(onD)
    await s.restart(s.selectedVM.value!)
    expect(onD).toHaveBeenCalledOnce()
    expect(onC).not.toHaveBeenCalled()      // ← 与 Vue2 的偏离点,已登记
    emit('kvm:vm_started', { vm_id: 'vm-1' })
    await nextTick()
    expect(onC).toHaveBeenCalledOnce()
  })

  it('pause 改 paused 并断开;resume/wakeup 改 running 并连接', async () => {
    const s = useVmList()
    await s.fetchVMs()
    const onC = vi.fn(); const onD = vi.fn()
    s.onVncShouldConnect(onC); s.onVncShouldDisconnect(onD)
    await s.pause(s.selectedVM.value!)
    expect(s.selectedVM.value?.state).toBe('paused')
    expect(onD).toHaveBeenCalledOnce()
    await s.resume(s.selectedVM.value!)
    expect(s.selectedVM.value?.state).toBe('running')
    expect(onC).toHaveBeenCalledOnce()
  })

  it('动作进行中 processing 含该 id,结束后移除', async () => {
    let done: () => void = () => {}
    api.stopVM.mockImplementation(() => new Promise<void>((r) => { done = r }))
    const s = useVmList()
    await s.fetchVMs()
    const p = s.stop(s.selectedVM.value!)
    expect(s.processing.value.has('vm-1')).toBe(true)
    done(); await p
    expect(s.processing.value.has('vm-1')).toBe(false)
  })

  it('toggleAutostart 成功后翻转,失败时维持原值并写 lastError(Vue2 的“回滚”在这个写入顺序下不可达,已移除死代码)', async () => {
    const s = useVmList()
    await s.fetchVMs()
    await s.toggleAutostart(s.selectedVM.value!)
    expect(s.selectedVM.value?.autostart).toBe(true)
    api.setAutostart.mockRejectedValue(new Error('nope'))
    await s.toggleAutostart(s.selectedVM.value!)
    // 注意:这里为 true 不是因为“回滚”生效——失败时 autostart 压根没被写过新值,
    // 本来就还是 true。真正需要判别力的断言是下面的 lastError。
    expect(s.selectedVM.value?.autostart).toBe(true)
    expect(s.lastError.value).toBeTruthy()
  })

  it('remove 成功后从列表移除并清空选中', async () => {
    const s = useVmList()
    await s.fetchVMs()
    await s.remove(s.selectedVM.value!)
    expect(api.deleteVM).toHaveBeenCalledWith('vm-1')
    expect(s.vms.value).toHaveLength(0)
    expect(s.selectedVM.value).toBeNull()
  })

  it('ejectInstallMedia 调 setBootFromDisk(true) 并整表刷新,成功返回空字符串', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockClear()
    const result = await s.ejectInstallMedia(s.selectedVM.value!)
    expect(api.setBootFromDisk).toHaveBeenCalledWith('vm-1', true)
    expect(api.getVMList).toHaveBeenCalledOnce()
    expect(result).toBe('') // 评审二轮:返回值契约——成功是空字符串
  })

  it('ejectInstallMedia 失败时返回错误文案(不再只写共享的 lastError)', async () => {
    api.setBootFromDisk.mockRejectedValue(new Error('disk busy'))
    const s = useVmList()
    await s.fetchVMs()
    const result = await s.ejectInstallMedia(s.selectedVM.value!)
    expect(result).toBe('disk busy')
    expect(s.lastError.value).toBe('disk busy') // 仍然保留写共享 ref,供其它兜底路径消费
  })

  it('ejectInstallMedia 重入守卫:在途时再点一次不会发第二次请求(照 Vue2 :862-864 finishingInstall),被挡的那次返回空字符串', async () => {
    let resolveIt: () => void = () => {}
    api.setBootFromDisk.mockImplementation(() => new Promise<void>((r) => { resolveIt = () => r(undefined) }))
    const s = useVmList()
    await s.fetchVMs()
    const p1 = s.ejectInstallMedia(s.selectedVM.value!)
    const p2 = s.ejectInstallMedia(s.selectedVM.value!) // 在途时再点一次,应被挡下
    expect(api.setBootFromDisk).toHaveBeenCalledTimes(1)
    resolveIt()
    const [r1, r2] = await Promise.all([p1, p2])
    expect(api.setBootFromDisk).toHaveBeenCalledTimes(1)
    expect(r1).toBe('') // 真正跑的那次:成功
    expect(r2).toBe('') // 被重入守卫挡下的那次:返回值契约——''=没有做任何事,不是错误
  })

  it('ejectInstallMedia dispose 之后到达的结果不再写 state,返回空字符串(评审二轮补测:返回值契约的 dispose 分支)', async () => {
    let resolveIt: () => void = () => {}
    api.setBootFromDisk.mockImplementation(() => new Promise<void>((r) => { resolveIt = () => r(undefined) }))
    const s = useVmList()
    await s.fetchVMs()
    const p = s.ejectInstallMedia(s.selectedVM.value!)
    s.dispose()
    resolveIt()
    const result = await p
    expect(result).toBe('') // dispose 后不再纠结"算不算错误",直接短路返回空
    expect(api.getVMList).toHaveBeenCalledTimes(1) // 只有初始 fetchVMs 那一次,dispose 后不再补打整表刷新(评审 3,行为不变)
  })

  it('ejectInstallMedia 不复用 processing:电源动作在途时调用,setBootFromDisk 照常被调用(不跨动作误拦)', async () => {
    let resolveStop: () => void = () => {}
    api.stopVM.mockImplementation(() => new Promise<void>((r) => { resolveStop = () => r(undefined) }))
    const s = useVmList()
    await s.fetchVMs()
    const pStop = s.stop(s.selectedVM.value!) // processing 里已经有这台 VM 的 id 了
    await s.ejectInstallMedia(s.selectedVM.value!)
    expect(api.setBootFromDisk).toHaveBeenCalledWith('vm-1', true)
    resolveStop()
    await pStop
  })

  it('ejectInstallMedia 不复用 processing:eject 在途时电源动作走完清了 processing,eject 的重入守卫依旧生效', async () => {
    let resolveEject: () => void = () => {}
    api.setBootFromDisk.mockImplementation(() => new Promise<void>((r) => { resolveEject = () => r(undefined) }))
    const s = useVmList()
    await s.fetchVMs()
    const pEject = s.ejectInstallMedia(s.selectedVM.value!) // 在途
    await s.stop(s.selectedVM.value!) // 电源动作走完,finally 会清 processing.delete('vm-1')
    await s.ejectInstallMedia(s.selectedVM.value!) // 再点一次:若守卫仍然独立生效,应被拦下
    expect(api.setBootFromDisk).toHaveBeenCalledTimes(1)
    resolveEject()
    await pEject
    expect(api.setBootFromDisk).toHaveBeenCalledTimes(1)
  })

  it('lastError 取后端 message 原文,而不是写死文案', async () => {
    api.stopVM.mockRejectedValue(new Error('[KVM] domain is not running'))
    const s = useVmList()
    await s.fetchVMs()
    await s.stop(s.selectedVM.value!)
    // Vue2 getErrMsg 会剥掉开头的 [xxx] 前缀
    expect(s.lastError.value).toBe('domain is not running')
  })
})

describe('selectVM', () => {
  it('选中后单独拉一次详情合并进列表', async () => {
    api.getVMList.mockResolvedValue({ data: [VM(), VM({ id: 'b', state: 'stopped' })], total: 2 })
    api.getVM.mockResolvedValue(VM({ id: 'b', state: 'stopped', name: 'detailed' }))
    const s = useVmList()
    await s.fetchVMs()
    await s.selectVM(s.vms.value[1])
    expect(api.getVM).toHaveBeenCalledWith('b')
    expect(s.selectedVM.value?.name).toBe('detailed')
    expect(s.vms.value[1].name).toBe('detailed')
  })

  it('详情请求失败不清空选中(Vue2 只 console.warn)', async () => {
    api.getVM.mockRejectedValue(new Error('404'))
    const s = useVmList()
    await s.fetchVMs()
    await s.selectVM(s.vms.value[0])
    expect(s.selectedVM.value?.id).toBe('vm-1')
  })
})
