import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import type { KvmVM, KvmCreateVMRequest, KvmUpdateVMRequest } from '@nimotech/nimoos-service'

const api = {
  getVMList: vi.fn(), getVM: vi.fn(), startVM: vi.fn(), stopVM: vi.fn(),
  restartVM: vi.fn(), pauseVM: vi.fn(), resumeVM: vi.fn(), wakeupVM: vi.fn(),
  deleteVM: vi.fn(), setAutostart: vi.fn(), setBootFromDisk: vi.fn(), createVM: vi.fn(),
  updateVM: vi.fn(),
}
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))

// Controllable MessageBus stub: manually emit in tests
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

// P6 Task 8: payload matches exactly the output of the "validation passes emit submit" test case in CreateVmDialog.test.ts
// (alpine-319 official template + recommended specs); not a random literal.
const PAYLOAD: KvmCreateVMRequest = {
  name: 'p6-throwaway', vcpu: 1, memory: 512, disk: 8,
  iso: '/DATA/KVM/isos/alpine-319.iso', os: 'Alpine', osType: 'linux',
  networkMode: 'nat', networkInterface: '', firmware: 'bios',
}

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
  it('On first fetch, auto-select the first VM (Vue2 :900)', async () => {
    const s = useVmList()
    await s.fetchVMs()
    expect(s.vms.value).toHaveLength(1)
    expect(s.selectedVM.value?.id).toBe('vm-1')
  })

  it('Empty list: selectedVM stays null (P5 has no create dialog, shows empty state; Vue2 auto-pops create modal here, P6 adds it)', async () => {
    api.getVMList.mockResolvedValue({ data: [], total: 0 })
    const s = useVmList()
    await s.fetchVMs()
    expect(s.selectedVM.value).toBeNull()
  })

  it('After refresh, previously selected item still exists → swap to new object and keep it selected', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockResolvedValue({ data: [VM({ state: 'stopped' })], total: 1 })
    await s.fetchVMs()
    expect(s.selectedVM.value?.state).toBe('stopped')
  })

  it('After refresh, previously selected item is gone → selectedVM set to null', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'other' })], total: 1 })
    await s.fetchVMs()
    expect(s.selectedVM.value).toBeNull()
  })

  it('Preserve spicePort during refresh (list endpoint does not return it, only /vnc does)', async () => {
    const s = useVmList()
    await s.fetchVMs()
    s.selectedVM.value!.spicePort = 5901
    s.selectedVM.value!.spiceTlsPort = 5902
    // Review fix (critical 1): originally reused beforeEach's mockResolvedValue, but
    // vi.fn().mockResolvedValue(v) evaluates once and returns the same object reference on every call —
    // the direct assignment to selectedVM above mutates this shared object, so when fetchVMs()
    // is called the second time, the “new data” is actually the already-mutated old object; preserveSpice's presence/absence
    // cannot be tested. Here we explicitly mockImplementation to create a fresh object each time, with spicePort explicitly 0,
    // truly simulating “backend returns fresh data without spicePort”.
    api.getVMList.mockImplementation(() =>
      Promise.resolve({ data: [VM({ spicePort: 0, spiceTlsPort: 0 })], total: 1 }))
    await s.fetchVMs()  // new data spicePort=0
    expect(s.selectedVM.value?.spicePort).toBe(5901)
    expect(s.selectedVM.value?.spiceTlsPort).toBe(5902)
  })

  it('On request failure, clear list and do not throw', async () => {
    api.getVMList.mockRejectedValue(new Error('libvirt down'))
    const s = useVmList()
    await s.fetchVMs()
    expect(s.vms.value).toEqual([])
  })

  it('runningCount counts only running VMs', async () => {
    api.getVMList.mockResolvedValue({ data: [VM(), VM({ id: 'b', state: 'stopped' })], total: 2 })
    const s = useVmList()
    await s.fetchVMs()
    expect(s.runningCount.value).toBe(1)
  })
})

describe('Staleness guard', () => {
  it('When later fetchVMs returns first, earlier late-arriving result does not overwrite (interleaved path)', async () => {
    let resolveSlow: (v: unknown) => void = () => {}
    api.getVMList
      .mockImplementationOnce(() => new Promise((r) => { resolveSlow = r }))       // slow, sent first
      .mockResolvedValueOnce({ data: [VM({ name: 'fresh' })], total: 1 })          // fast, sent later
    const s = useVmList()
    const slow = s.fetchVMs()
    await s.fetchVMs()                       // later one arrives first
    expect(s.vms.value[0].name).toBe('fresh')
    resolveSlow({ data: [VM({ name: 'stale' })], total: 1 })
    await slow
    expect(s.vms.value[0].name).toBe('fresh')  // late old result discarded
  })

  it('Results arriving after dispose are not written', async () => {
    let resolveIt: (v: unknown) => void = () => {}
    api.getVMList.mockImplementationOnce(() => new Promise((r) => { resolveIt = r }))
    const s = useVmList()
    const p = s.fetchVMs()
    s.dispose()
    resolveIt({ data: [VM({ name: 'late' })], total: 1 })
    await p
    expect(s.vms.value).toEqual([])
  })

  it('After dispose, in-flight power action late results no longer write state or trigger VNC callbacks (review 3)', async () => {
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

  it('fetchVM staleness guard: rapid clicks on two VMs, early-sent but late-arriving detail response does not overwrite later-sent already-written data', async () => {
    api.getVMList.mockResolvedValue({ data: [VM(), VM({ id: 'b', state: 'stopped' })], total: 2 })
    let resolveSlow: (v: unknown) => void = () => {}
    api.getVM
      .mockImplementationOnce(() => new Promise((r) => { resolveSlow = r })) // select vm-1, slow, sent first
      .mockResolvedValueOnce(VM({ id: 'b', state: 'stopped', name: 'b-detail' })) // select b, fast, sent later
    const s = useVmList()
    await s.fetchVMs()
    const p1 = s.selectVM(s.vms.value[0]) // trigger fetchVM('vm-1'), hang
    await s.selectVM(s.vms.value[1])      // trigger fetchVM('b'), completes first
    expect(s.vms.value[1].name).toBe('b-detail')
    resolveSlow(VM({ id: 'vm-1', name: 'stale-a-detail' }))
    await p1
    // Late vm-1 detail discarded; list item should not be overwritten by this stale data
    expect(s.vms.value[0].name).not.toBe('stale-a-detail')
  })
})

describe('MessageBus events (mirrors Vue2 :766-826)', () => {
  it('vm_started changes the VM to running and triggers VNC connect callback', async () => {
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

  it('vm_stopped changes state and triggers disconnect callback', async () => {
    const s = useVmList()
    await s.fetchVMs()
    const onDisconnect = vi.fn()
    s.onVncShouldDisconnect(onDisconnect)
    emit('kvm:vm_stopped', { vm_id: 'vm-1' })
    await nextTick()
    expect(s.selectedVM.value?.state).toBe('stopped')
    expect(onDisconnect).toHaveBeenCalledOnce()
  })

  it('vm_paused → paused and disconnect; vm_resumed → running and connect', async () => {
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

  it('When event lacks vm_id, degrade to full list refresh (Vue2 else branch)', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockClear()
    emit('kvm:vm_started', {})
    await nextTick()
    expect(api.getVMList).toHaveBeenCalledOnce()
  })

  it('vm_deleted removes from list; if deleted item was selected, clear selection', async () => {
    const s = useVmList()
    await s.fetchVMs()
    emit('kvm:vm_deleted', { vm_id: 'vm-1' })
    await nextTick()
    expect(s.vms.value).toHaveLength(0)
    expect(s.selectedVM.value).toBeNull()
  })

  it('vm_created / vm_autostart_changed trigger full list refresh', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockClear()
    emit('kvm:vm_created', { vm_id: 'x' })
    emit('kvm:vm_autostart_changed', { vm_id: 'vm-1' })
    await nextTick()
    expect(api.getVMList).toHaveBeenCalledTimes(2)
  })

  it('When event targets a different VM, do not touch the currently selected VM's VNC', async () => {
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

  it('After dispose, stop responding to events', async () => {
    const s = useVmList()
    await s.fetchVMs()
    s.dispose()
    emit('kvm:vm_stopped', { vm_id: 'vm-1' })
    await nextTick()
    expect(s.selectedVM.value?.state).toBe('running')
  })
})

describe('Power actions', () => {
  it('start optimistically changes state to running and requests VNC connection', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ state: 'stopped' })], total: 1 })
    const s = useVmList()
    await s.fetchVMs()
    const onC = vi.fn(); s.onVncShouldConnect(onC)
    await s.start(s.selectedVM.value!)
    expect(api.startVM).toHaveBeenCalledWith('vm-1')
    expect(s.selectedVM.value?.state).toBe('running')
    expect(onC).toHaveBeenCalledOnce()
  })

  it('On start failure, do not change state and write lastError', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ state: 'stopped' })], total: 1 })
    api.startVM.mockRejectedValue(new Error('boom'))
    const s = useVmList()
    await s.fetchVMs()
    await s.start(s.selectedVM.value!)
    expect(s.selectedVM.value?.state).toBe('stopped')
    expect(s.lastError.value).toBeTruthy()
  })

  it('restart only disconnects, does not immediately reconnect (fixes Vue2 race, relies on vm_started event fallback)', async () => {
    const s = useVmList()
    await s.fetchVMs()
    const onC = vi.fn(); const onD = vi.fn()
    s.onVncShouldConnect(onC); s.onVncShouldDisconnect(onD)
    await s.restart(s.selectedVM.value!)
    expect(onD).toHaveBeenCalledOnce()
    expect(onC).not.toHaveBeenCalled()      // ← Deviation from Vue2; already logged
    emit('kvm:vm_started', { vm_id: 'vm-1' })
    await nextTick()
    expect(onC).toHaveBeenCalledOnce()
  })

  // Mandatory ② (full-branch final review): final review checked backend NimoOS-KVM/service/vm_service.go:575-583;
  // RestartVMWithForce = StopVM + StartVM; each publishes events asynchronously; kvm:vm_started and
  // restart's HTTP response emit nearly simultaneously, order undefined. The test above covers only "HTTP response arrives first";
  // here we add the other interleaved-path order — event arrives first, HTTP response later. Under the old implementation,
  // the event builds the connection first (connectCb), then restart's onSuccess would unconditionally disconnectCb()
  // tearing down the just-built connection; vm_started fires only once, no future event triggers reconnection, permanent black screen.
  it('Mandatory ② regression: when kvm:vm_started arrives ahead of restart's HTTP response, onSuccess must not tear it down (real interleaved path)', async () => {
    const s = useVmList()
    await s.fetchVMs()
    const onC = vi.fn(); const onD = vi.fn()
    s.onVncShouldConnect(onC); s.onVncShouldDisconnect(onD)
    let resolveRestart: () => void = () => {}
    api.restartVM.mockImplementation(() => new Promise<void>((r) => { resolveRestart = () => r(undefined) }))

    const p = s.restart(s.selectedVM.value!) // HTTP hung, restart not complete yet

    // Event arrives first (backend StopVM/StartVM each publish asynchronously, order undefined; here we simulate "first" scenario).
    emit('kvm:vm_started', { vm_id: 'vm-1' })
    await nextTick()
    expect(onC).toHaveBeenCalledOnce() // event has already built connection

    // HTTP response arrives later: onSuccess must not tear down the just-built connection above.
    resolveRestart()
    await p
    expect(onD).not.toHaveBeenCalled() // Before fix: this assertion would fail (onSuccess unconditionally disconnects)
  })

  it('pause changes to paused and disconnects; resume/wakeup change to running and connect', async () => {
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

  it('While action in flight, processing contains its id; after completion, remove it', async () => {
    let done: () => void = () => {}
    api.stopVM.mockImplementation(() => new Promise<void>((r) => { done = r }))
    const s = useVmList()
    await s.fetchVMs()
    const p = s.stop(s.selectedVM.value!)
    expect(s.processing.value.has('vm-1')).toBe(true)
    done(); await p
    expect(s.processing.value.has('vm-1')).toBe(false)
  })

  it('toggleAutostart flips on success, maintains original on failure and writes lastError (Vue2 “rollback” unreachable in this write order, dead code removed)', async () => {
    const s = useVmList()
    await s.fetchVMs()
    await s.toggleAutostart(s.selectedVM.value!)
    expect(s.selectedVM.value?.autostart).toBe(true)
    api.setAutostart.mockRejectedValue(new Error('nope'))
    await s.toggleAutostart(s.selectedVM.value!)
    // Note: it's true here not because “rollback” works — on failure autostart was never written the new value,
    // it was already true. The assertion with real discriminating power is lastError below.
    expect(s.selectedVM.value?.autostart).toBe(true)
    expect(s.lastError.value).toBeTruthy()
  })

  it('remove succeeds: remove from list and clear selection', async () => {
    const s = useVmList()
    await s.fetchVMs()
    await s.remove(s.selectedVM.value!)
    expect(api.deleteVM).toHaveBeenCalledWith('vm-1')
    expect(s.vms.value).toHaveLength(0)
    expect(s.selectedVM.value).toBeNull()
  })

  it('ejectInstallMedia calls setBootFromDisk(true), refreshes entire list, returns empty string on success', async () => {
    const s = useVmList()
    await s.fetchVMs()
    api.getVMList.mockClear()
    const result = await s.ejectInstallMedia(s.selectedVM.value!)
    expect(api.setBootFromDisk).toHaveBeenCalledWith('vm-1', true)
    expect(api.getVMList).toHaveBeenCalledOnce()
    expect(result).toBe('') // Review re-review: return value contract — success is empty string
  })

  it('ejectInstallMedia on failure returns error message (no longer writes only to shared lastError)', async () => {
    api.setBootFromDisk.mockRejectedValue(new Error('disk busy'))
    const s = useVmList()
    await s.fetchVMs()
    const result = await s.ejectInstallMedia(s.selectedVM.value!)
    expect(result).toBe('disk busy')
    expect(s.lastError.value).toBe('disk busy') // Still write shared ref for other fallback paths to consume
  })

  it('ejectInstallMedia re-entrancy guard: clicking again while in-flight does not send second request (mirrors Vue2 :862-864 finishingInstall), blocked call returns empty string', async () => {
    let resolveIt: () => void = () => {}
    api.setBootFromDisk.mockImplementation(() => new Promise<void>((r) => { resolveIt = () => r(undefined) }))
    const s = useVmList()
    await s.fetchVMs()
    const p1 = s.ejectInstallMedia(s.selectedVM.value!)
    const p2 = s.ejectInstallMedia(s.selectedVM.value!) // click again while in-flight, should be blocked
    expect(api.setBootFromDisk).toHaveBeenCalledTimes(1)
    resolveIt()
    const [r1, r2] = await Promise.all([p1, p2])
    expect(api.setBootFromDisk).toHaveBeenCalledTimes(1)
    expect(r1).toBe('') // the one actually running: success
    expect(r2).toBe('') // Blocked by re-entrancy guard: return value contract — '' = did nothing, not an error
  })

  it('ejectInstallMedia results arriving after dispose no longer write state, return empty string (review re-review added test: dispose branch of return value contract)', async () => {
    let resolveIt: () => void = () => {}
    api.setBootFromDisk.mockImplementation(() => new Promise<void>((r) => { resolveIt = () => r(undefined) }))
    const s = useVmList()
    await s.fetchVMs()
    const p = s.ejectInstallMedia(s.selectedVM.value!)
    s.dispose()
    resolveIt()
    const result = await p
    expect(result).toBe('') // After dispose, stop worrying "is this an error", just short-circuit return empty
    expect(api.getVMList).toHaveBeenCalledTimes(1) // Only the initial fetchVMs call; after dispose no full list refresh (review 3, behavior unchanged)
  })

  it('ejectInstallMedia does not reuse processing: calling while power action in-flight, setBootFromDisk still called normally (no cross-action mis-block)', async () => {
    let resolveStop: () => void = () => {}
    api.stopVM.mockImplementation(() => new Promise<void>((r) => { resolveStop = () => r(undefined) }))
    const s = useVmList()
    await s.fetchVMs()
    const pStop = s.stop(s.selectedVM.value!) // processing already has this VM's id
    await s.ejectInstallMedia(s.selectedVM.value!)
    expect(api.setBootFromDisk).toHaveBeenCalledWith('vm-1', true)
    resolveStop()
    await pStop
  })

  it('ejectInstallMedia does not reuse processing: while eject in-flight, power action completes and clears processing, eject re-entrancy guard still works', async () => {
    let resolveEject: () => void = () => {}
    api.setBootFromDisk.mockImplementation(() => new Promise<void>((r) => { resolveEject = () => r(undefined) }))
    const s = useVmList()
    await s.fetchVMs()
    const pEject = s.ejectInstallMedia(s.selectedVM.value!) // in-flight
    await s.stop(s.selectedVM.value!) // power action completes, finally will clear processing.delete('vm-1')
    await s.ejectInstallMedia(s.selectedVM.value!) // click again: if guard still works independently, should be blocked
    expect(api.setBootFromDisk).toHaveBeenCalledTimes(1)
    resolveEject()
    await pEject
    expect(api.setBootFromDisk).toHaveBeenCalledTimes(1)
  })

  it('lastError takes backend message verbatim, not hardcoded text', async () => {
    api.stopVM.mockRejectedValue(new Error('[KVM] domain is not running'))
    const s = useVmList()
    await s.fetchVMs()
    await s.stop(s.selectedVM.value!)
    // Vue2 getErrMsg strips the leading [xxx] prefix
    expect(s.lastError.value).toBe('domain is not running')
  })
})

describe('selectVM', () => {
  it('After selection, fetch detail once and merge into list', async () => {
    api.getVMList.mockResolvedValue({ data: [VM(), VM({ id: 'b', state: 'stopped' })], total: 2 })
    api.getVM.mockResolvedValue(VM({ id: 'b', state: 'stopped', name: 'detailed' }))
    const s = useVmList()
    await s.fetchVMs()
    await s.selectVM(s.vms.value[1])
    expect(api.getVM).toHaveBeenCalledWith('b')
    expect(s.selectedVM.value?.name).toBe('detailed')
    expect(s.vms.value[1].name).toBe('detailed')
  })

  it('Detail request failure does not clear selection (Vue2 only console.warn)', async () => {
    api.getVM.mockRejectedValue(new Error('404'))
    const s = useVmList()
    await s.fetchVMs()
    await s.selectVM(s.vms.value[0])
    expect(s.selectedVM.value?.id).toBe('vm-1')
  })
})

// P6 Task 8: create() return value contract mirrors remove/toggleAutostart ('' = success, non-empty = message), but
// ⚠️ one key difference (logged in create() top comment) — create() deliberately does not write shared
// `lastError`, so unlike the `it('lastError takes backend message verbatim…')` test we don't assert
// `s.lastError` here, only the return value itself.
describe('create', () => {
  it('On success, refresh list and return empty string', async () => {
    api.createVM.mockResolvedValue({ id: 'new-1' })
    api.getVMList.mockResolvedValue({ data: [], total: 0 })
    const s = useVmList()
    expect(await s.create(PAYLOAD)).toBe('')
    expect(api.createVM).toHaveBeenCalledWith(PAYLOAD)
    expect(api.getVMList).toHaveBeenCalled()
  })

  it('On failure, return backend message and do not refresh list', async () => {
    api.createVM.mockRejectedValue(new Error('domain name already exists'))
    const s = useVmList()
    expect(await s.create(PAYLOAD)).toBe('domain name already exists')
    expect(api.getVMList).not.toHaveBeenCalled()
  })

  it('After dispose, completed call does not refresh list (staleness guard)', async () => {
    let release: (v: unknown) => void = () => {}
    api.createVM.mockReturnValue(new Promise((r) => { release = r }))
    const s = useVmList()
    const p = s.create(PAYLOAD)
    s.dispose(); release({ id: 'x' }); await p
    expect(api.getVMList).not.toHaveBeenCalled()
  })
})

// P6 Task 9 (VM settings dialog wiring): update() return value contract mirrors create ('' = success, non-empty = message),
// likewise does not write shared lastError (reasoning in update() top comment).
const UPDATE_PATCH: KvmUpdateVMRequest = {
  name: 'renamed', vcpu: 4, memory: 2048, disk: 8, iso: '/DATA/KVM/isos/debian-13.iso',
  bootFromDisk: false, firmware: 'uefi', networkMode: 'bridge', networkInterface: 'enp2s0',
}

describe('update', () => {
  it('On success, call updateVM(id, patch) and write back visible fields (mirrors Vue2 saveSettings :1503-1508, excludes disk)', async () => {
    api.updateVM.mockResolvedValue({})
    const s = useVmList()
    await s.fetchVMs()
    const vm = s.selectedVM.value!
    const originalDisk = vm.disk
    expect(await s.update(vm, UPDATE_PATCH)).toBe('')
    expect(api.updateVM).toHaveBeenCalledWith('vm-1', UPDATE_PATCH)
    expect(vm.name).toBe('renamed')
    expect(vm.vcpu).toBe(4)
    expect(vm.memory).toBe(2048)
    expect(vm.iso).toBe('/DATA/KVM/isos/debian-13.iso')
    expect(vm.bootFromDisk).toBe(false)
    expect(vm.firmware).toBe('uefi')
    expect(vm.networkMode).toBe('bridge')
    expect(vm.networkInterface).toBe('enp2s0')
    // disk field not in write-back set — disk input in dialog is already disabled, value unchanged,
    // Vue2 saveSettings's Object.assign statement also doesn't include this field (:1503-1508).
    expect(vm.disk).toBe(originalDisk)
    expect(s.lastError.value).toBe('') // Does not write shared lastError (reasoning same as create())
  })

  it('When passed object is not the same reference as list item, vms list and selectedVM still sync on write-back', async () => {
    api.updateVM.mockResolvedValue({})
    const s = useVmList()
    await s.fetchVMs()
    const listItem = s.vms.value[0]
    const detached = { ...listItem } // Simulate "caller's passed vm param is not the list's object reference"
    await s.update(detached, UPDATE_PATCH)
    expect(listItem.name).toBe('renamed')
    expect(s.selectedVM.value?.name).toBe('renamed')
  })

  it('On failure, return backend message and do not write any vm field', async () => {
    api.updateVM.mockRejectedValue(new Error('name already exists'))
    const s = useVmList()
    await s.fetchVMs()
    const vm = s.selectedVM.value!
    const before = { ...vm }
    expect(await s.update(vm, UPDATE_PATCH)).toBe('name already exists')
    expect(vm).toEqual(before)
  })

  it('After dispose, completed call no longer writes state (staleness guard)', async () => {
    let release: (v: unknown) => void = () => {}
    api.updateVM.mockReturnValue(new Promise((r) => { release = r }))
    const s = useVmList()
    await s.fetchVMs()
    const vm = s.selectedVM.value!
    const before = { ...vm }
    const p = s.update(vm, UPDATE_PATCH)
    s.dispose(); release({})
    expect(await p).toBe('')
    expect(vm).toEqual(before)
  })
})

// SP16 Task 8: after restart succeeds, **deliberately** hand reconnection to kvm:vm_started (immediate reconnect fails because
// VNC port not up yet). When MessageBus goes offline that event never arrives, so after disconnect no one reconnects —
// console black, interface silent. Here we guard the "at least say something" fallback.
describe('VNC reconnect fallback after restart', () => {
  it('When kvm:vm_started does not arrive, notify caller (rather than silent black screen)', async () => {
    vi.useFakeTimers()
    const s = useVmList()
    const stalled = vi.fn()
    s.onVncReconnectStalled(stalled)
    await s.fetchVMs()                       // auto-select vm-1

    await s.restart(s.selectedVM.value!)
    expect(stalled).not.toHaveBeenCalled()   // Just after disconnect should not report yet

    await vi.advanceTimersByTimeAsync(20_000)
    expect(stalled).toHaveBeenCalledTimes(1)
    s.dispose()
    vi.useRealTimers()
  })

  it('When kvm:vm_started arrives on time, do not report', async () => {
    vi.useFakeTimers()
    const s = useVmList()
    const stalled = vi.fn()
    s.onVncReconnectStalled(stalled)
    await s.fetchVMs()

    await s.restart(s.selectedVM.value!)
    emit('kvm:vm_started', { vm_id: 'vm-1' })

    await vi.advanceTimersByTimeAsync(20_000)
    expect(stalled).not.toHaveBeenCalled()
    s.dispose()
    vi.useRealTimers()
  })

  it('After dispose, timer no longer calls back', async () => {
    vi.useFakeTimers()
    const s = useVmList()
    const stalled = vi.fn()
    s.onVncReconnectStalled(stalled)
    await s.fetchVMs()

    await s.restart(s.selectedVM.value!)
    s.dispose()

    await vi.advanceTimersByTimeAsync(20_000)
    expect(stalled).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
