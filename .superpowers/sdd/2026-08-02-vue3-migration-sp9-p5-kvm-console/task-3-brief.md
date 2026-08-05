## Task 3: `useVmList` 数据层

**Files:**
- Create: `src/kvm/composables/useVmList.ts` + `useVmList.test.ts`

**Interfaces:**
- Consumes: `service.kvm`(T0)· `preserveSpice`(T1)· `useMessageBus`(既有 `src/composables/useMessageBus.ts`)
- Produces:
```ts
useVmList(): {
  vms: Ref<KvmVM[]>
  selectedVM: Ref<KvmVM | null>
  isLoading: Ref<boolean>
  runningCount: ComputedRef<number>
  processing: Ref<Set<string>>          // 正在执行动作的 vm id
  lastError: Ref<string>                 // 最近一次动作的错误文案(i18n key 或后端原文)
  fetchVMs(): Promise<void>
  fetchVM(id: string): Promise<void>
  selectVM(vm: KvmVM): Promise<void>
  start(vm) / stop(vm) / restart(vm) / pause(vm) / resume(vm) / wakeup(vm): Promise<void>
  toggleAutostart(vm): Promise<void>
  remove(vm): Promise<void>              // deleteVM
  ejectInstallMedia(vm): Promise<void>   // setBootFromDisk(true)
  onVncShouldConnect(cb: (vm: KvmVM) => void): void   // 需要建立 VNC 连接时回调
  onVncShouldDisconnect(cb: () => void): void
  dispose(): void
}
```

- [ ] **Step 1: 写 `useVmList.test.ts`(失败)**

```ts
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

  it('toggleAutostart 成功后翻转,失败后回滚', async () => {
    const s = useVmList()
    await s.fetchVMs()
    await s.toggleAutostart(s.selectedVM.value!)
    expect(s.selectedVM.value?.autostart).toBe(true)
    api.setAutostart.mockRejectedValue(new Error('nope'))
    await s.toggleAutostart(s.selectedVM.value!)
    expect(s.selectedVM.value?.autostart).toBe(true)   // 回滚到 true
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

  it('ejectInstallMedia 调 setBootFromDisk(true) 并整表刷新', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockClear()
    await s.ejectInstallMedia(s.selectedVM.value!)
    expect(api.setBootFromDisk).toHaveBeenCalledWith('vm-1', true)
    expect(api.getVMList).toHaveBeenCalledOnce()
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/kvm/composables/useVmList.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `src/kvm/composables/useVmList.ts`**

要点(实现者照此写,不要自由发挥):
- 用 `ref` + 一个模块内 `let epoch = 0` 风格的**就地代际守卫**:每次 `fetchVMs` 自增 `listEpoch`,回写前比对;`dispose()` 把 `alive=false`。**不要抽公共 guard**(记忆:过早抽象已被评审逮过)。
- 事件订阅在 composable 创建时一次性 `on()` 七个事件,把 7 个 unsubscribe 存进数组,`dispose()` 里全调一遍。
- `setVMState(id, state)` 同时改 `vms` 里的那一项与 `selectedVM`(两者是**同一个对象引用**时也要保证响应式:实现里 `vms` 存对象数组,`selectedVM` 指向数组里的同一个对象)。
- 电源动作模板:`processing.add(id)` → `await service.kvm.xxx(id)` → 乐观改 state + 触发 VNC 回调 → `catch` 写 `lastError` → `finally processing.delete(id)`。
- `errText(e)`:取 `e.message`,**剥掉开头的 `[xxx] ` 前缀**(照 Vue2 `getErrMsg` `:836-839` 的 `replace(/^\[.*?\]\s*/, '')`),空则回退传入的 i18n key。
- **`restart` 的偏离必须写注释**:
```ts
// ⚠️ 与 Vue2 的偏离(SP9-P5 登记):Vue2 restartVM(:1567-1583)在请求返回后立刻
// disconnectVNC() + connectVNC()。VM 刚重启,VNC 端口大概率还没监听,connect 必失败,
// 于是 vncError 被永久写死在屏上、且不会自愈。这里只断开,重连交给 kvm:vm_started
// 事件兜底(后端确实会发,constants.go:17)。界面表现不变,只是不再卡在错误态。
```
- `onVncShouldConnect` / `onVncShouldDisconnect` 用单个回调槽(`let connectCb`),不是数组 —— 只有 ConsoleStage 一个消费方。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/kvm/composables/useVmList.test.ts`
Expected: PASS

- [ ] **Step 5: 变异验证(证明测试有判别力)**

依次做这 3 处破坏,各确认有测试翻红,然后**改回来**:
1. 把 `preserveSpice` 调用删掉 → 「刷新时保活 spicePort」必红
2. 把过期守卫的 `if (myEpoch !== listEpoch) return` 删掉 → 「后发先至」必红
3. 把 `restart` 里补一句 `connectCb?.(vm)` → 「restart 只断开不立刻重连」必红

- [ ] **Step 6: 全量 + 提交**

```bash
pnpm test && pnpm vue-tsc --noEmit
git add src/kvm/composables/useVmList.ts src/kvm/composables/useVmList.test.ts
git commit -m "feat(kvm): useVmList 数据层(事件驱动/spice 保活/电源动作/过期守卫)"
```

---

