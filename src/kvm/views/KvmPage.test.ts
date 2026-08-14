import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import KvmPage from './KvmPage.vue'
import { i18n } from '../../i18n'
import { useToast } from '../../stores/toast'
import type { KvmVM, KvmISO } from '@nimotech/nimoos-service'

// Task 6: Must now actually wire the connect/disconnect flow of useVncConsole (no longer just stubs),
// so we need to stub the @novnc/novnc with a fake RFB class — reason: same as the top comment in useVncConsole.test.ts:
// without stubbing, the connect() success path would use the real novnc package to `new WebSocket(...)`,
// but jsdom has no global WebSocket, and we shouldn't establish real connections in unit tests anyway
// (hard constraint: do not actually establish WebSocket).
// Using vi.hoisted is necessary — vi.mock factories are hoisted to the file top, and directly referencing
// a class declared later causes TDZ (same pit already hit and fixed in useVncConsole.test.ts).
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

// Task 5: Power action wiring needs service.kvm methods mocked completely (following useVmList.test.ts
// getter pattern so mockReset works in beforeEach). Task 6 adds getVNC (for console wiring).
// P6 Task 8 adds createVM/getISOList/downloadISO (for create flow wiring).
const api = {
  getVMList: vi.fn(), getVM: vi.fn(), startVM: vi.fn(), stopVM: vi.fn(),
  restartVM: vi.fn(), pauseVM: vi.fn(), resumeVM: vi.fn(), wakeupVM: vi.fn(),
  deleteVM: vi.fn(), setAutostart: vi.fn(), setBootFromDisk: vi.fn(), getVNC: vi.fn(),
  // Task 2: KvmGlobalSettingsDialog is permanently mounted at the bottom of KvmPage template,
  // and even without opening it won't actually call anything outside beforeEach — only getSettings
  // is called when the gear icon is opened. Still need to mock it completely, otherwise accessing
  // undefined methods in the vi.mock factory will throw when opening the dialog.
  getSettings: vi.fn(), updateSettings: vi.fn(),
  createVM: vi.fn(), getISOList: vi.fn(), downloadISO: vi.fn(),
  // P6 Task 9:VM 设置弹窗接线需要的 updateVM。
  updateVM: vi.fn(),
  // P6 Task 10:快照 tab 接线需要的四个。
  getSnapshots: vi.fn(), createSnapshot: vi.fn(), deleteSnapshot: vi.fn(), restoreSnapshot: vi.fn(),
}
// IsoBrowser (OsSelector's custom section subcomponent, truly rendered, not mocked) calls
// service.folder.getList when expanded — even though most test cases here don't open it,
// we need to mock this getter to avoid errors accessing undefined properties (following same getter pattern).
const folderApi = { getList: vi.fn() }
vi.mock('@nimotech/nimoos-service', () => ({
  service: { get kvm() { return api }, get folder() { return folderApi } },
}))
// P6 Task 8 onward: need to actually trigger ISO download three events (kvm:iso_download_complete/_failed),
// the previous `on: () => () => {}` was just a placeholder and tests couldn't manually emit. Changed to
// controlled stub like useVmList.test.ts: register callbacks by event name, provide emitBus() for manual
// triggering — event names don't conflict (useVmList subscribes kvm:vm_* family, useIsoList subscribes
// kvm:iso_download_* family), sharing same handlers dict won't interfere.
const busHandlers: Record<string, ((p: unknown) => void)[]> = {}
vi.mock('../../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on(ev: string, cb: (p: unknown) => void) {
      ;(busHandlers[ev] ||= []).push(cb)
      return () => { busHandlers[ev] = (busHandlers[ev] || []).filter((h) => h !== cb) }
    },
  }),
}))
const emitBus = (ev: string, props: unknown) => (busHandlers[ev] || []).forEach((h) => h(props))

const VM = (over: Partial<KvmVM> = {}): KvmVM => ({
  id: 'vm-1', name: 'sp9-alpine-test', uuid: 'u', state: 'running', vcpu: 2, memory: 1024,
  disk: 8, diskUsedPercent: 0, diskPath: '/d', iso: '', os: 'linux',
  networkMode: 'nat', networkInterface: 'virbr0', firmware: 'bios', bootFromDisk: true,
  vncPort: 5900, vncWebsocketPort: 5700, spicePort: 0, spiceTlsPort: 0, autostart: false,
  createdAt: '', updatedAt: '', ...over,
})

// P6 Task 8: Official template ISOs — two entries; alpine-319 is the only one with
// `status:"downloaded"` on real device (2026-08-03 curl), fields match ISO_ALPINE in CreateVmDialog.test.ts exactly;
// Debian is for "downloading/download complete/download failed" three toast test cases, doesn't require
// exact match to real device data (real device data only gives alpine-319's complete fields, other 7 only known as "not downloaded").
const ISO_ALPINE: KvmISO = {
  id: 'alpine-319', name: 'Alpine', version: '3.19', category: 'linux', size: '60 MB',
  status: 'downloaded', progress: 0, path: '/DATA/KVM/isos/alpine-319.iso',
  recommendedVcpu: 1, recommendedMemory: 512, minMemory: 256, minDisk: 2,
}
const ISO_DEBIAN = (over: Partial<KvmISO> = {}): KvmISO => ({
  id: 'debian-13', name: 'Debian', version: '13 (Trixie)', category: 'linux', size: '676 MB',
  status: 'available', progress: 0,
  recommendedVcpu: 2, recommendedMemory: 2048, minMemory: 512, minDisk: 8, ...over,
})

beforeEach(() => {
  // Required ①: toast goes through useToast() (Pinia store). This file never had Pinia plugin
  // installed before — no component ever used store on this path before, but now that toast consumption
  // is added, we need an active Pinia instance first, otherwise useToast() throws
  // "getActivePinia() was called but there was no active Pinia". Following repo precedent
  // (GoogleDriveAuthDialog.test.ts etc.) we setActivePinia in beforeEach, no need to separately
  // stuff createPinia() into mount()'s global.plugins.
  setActivePinia(createPinia())
  rfbInstances.length = 0
  Object.values(api).forEach((f) => f.mockReset())
  folderApi.getList.mockReset()
  folderApi.getList.mockResolvedValue({ content: [] })
  Object.keys(busHandlers).forEach((k) => delete busHandlers[k])
  api.getVMList.mockResolvedValue({ data: [], total: 0 })
  api.getVM.mockResolvedValue(VM())
  api.getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 5700, spicePort: 0, spiceTlsPort: 0 })
  api.getSettings.mockResolvedValue({
    autostart: false, availableDiskGB: 263, availableMemoryMB: 9234, cpuCores: 6,
    defaultDiskSize: 20, defaultMemory: 2048, defaultVcpu: 2,
    networkInterfaces: ['enp2s0', 'enp4s0', 'wlp1s0'], storagePath: '/DATA/KVM',
  })
  api.updateSettings.mockResolvedValue({})
  api.createVM.mockResolvedValue(VM())
  api.getISOList.mockResolvedValue([])
  api.downloadISO.mockResolvedValue(undefined)
  api.updateVM.mockResolvedValue(VM())
  api.getSnapshots.mockResolvedValue([])
  api.createSnapshot.mockResolvedValue({ id: 'snap-x', vmId: 'vm-1', name: '', description: '', state: 'complete', createdAt: '' })
  api.deleteSnapshot.mockResolvedValue(undefined)
  api.restoreSnapshot.mockResolvedValue(undefined)
})

const mountPage = () => mount(KvmPage, { global: { plugins: [i18n] } })
const flush = () => new Promise((r) => setTimeout(r, 0))

// P6 Task 8: Create flow involves three layers of Teleport dialogs (create dialog/OsSelector/global settings dialog
// are all reka-ui DialogPortal, uniformly mounted to real document.body, not affected by `attachTo` — see existing
// comments in other describe blocks in this file). This task's new "auto-open create dialog on empty list" means
// **any** KvmPage instance mounted with default getVMList(empty) and not manually closed/unmounted will
// asynchronously insert a `.create-vm-modal` into real document.body and won't clean itself up — if we don't
// clear body after each test, this residue will pollute subsequent tests' assertions like
// "document.body.querySelector('.create-vm-modal') should be null" (verified: without this afterEach,
// Task 2's "click gear to open global settings dialog" test would fail due to leftover create dialog from
// earlier tests in this describe block). Clearing document.body doesn't affect any test's assertions themselves —
// their checked content is completed after their own triggered action and before clearing.
afterEach(() => {
  document.body.innerHTML = ''
})

describe('KvmPage shell', () => {
  it('renders left sidebar title and right-side empty state', () => {
    const w = mountPage()
    expect(w.text()).toContain('NIMO 虚拟机')
    // Note: brief draft had "Select one virtual machine" here, but after checking Vue2 zh_CN.json,
    // the official translation of "Select a Virtual Machine" is "选择虚拟机" (without "one"),
    // so I corrected the assertion per i18n, see task-2-report.md for details.
    expect(w.text()).toContain('选择虚拟机')
  })

  it('sidebar collapse button adds collapsed class on click, removes it on second click', async () => {
    const w = mountPage()
    const btn = w.get('.kvm-sidebar-toggle')
    expect(w.get('.kvm-sidebar').classes()).not.toContain('collapsed')
    await btn.trigger('click')
    expect(w.get('.kvm-sidebar').classes()).toContain('collapsed')
    await btn.trigger('click')
    expect(w.get('.kvm-sidebar').classes()).not.toContain('collapsed')
  })

  it('in collapsed state, mouse entering sidebar temporarily expands it (Vue2 isSidebarCollapsed = collapsed && !hover)', async () => {
    const w = mountPage()
    await w.get('.kvm-sidebar-toggle').trigger('click')
    await w.get('.kvm-sidebar').trigger('mouseenter')
    expect(w.get('.kvm-sidebar').classes()).not.toContain('collapsed')
    await w.get('.kvm-sidebar').trigger('mouseleave')
    expect(w.get('.kvm-sidebar').classes()).toContain('collapsed')
  })

  it('collapse button has aria-label (icon button hard constraint)', () => {
    expect(mountPage().get('.kvm-sidebar-toggle').attributes('aria-label')).toBeTruthy()
  })
})

// Task 2: First end-to-end flow testable on real device — left gear icon → global settings dialog → change values → save.
describe('KvmPage global settings dialog (Task 2)', () => {
  it('click gear to open global settings dialog, settings fetched are pre-filled into form', async () => {
    // P6 Task 8: Empty list auto-opens create dialog (see new describe block below), unrelated to testing
    // "click gear" here — feed one VM to avoid that unrelated auto-popup, otherwise the "create-vm-modal
    // should be null before clicking gear" assertion below gets falsely hit by the auto-opened create dialog
    // (both share the same .create-vm-modal class name from the same KvmDialog wrapper).
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    expect(document.body.querySelector('.create-vm-modal')).toBeNull()

    await w.get('.kvm-settings-btn').trigger('click')
    await flush()
    await w.vm.$nextTick()

    // P6 Task 8 introduced a known duplicate request (reported, not a bug in this test):
    // KvmPage itself keeps a page-level `useKvmHostInfo()` for the create dialog (fetch once on mounted),
    // while KvmGlobalSettingsDialog has its own independent `useKvmHostInfo()` instance (Task 2 wrote it this way,
    // fetches again when dialog opens) — the two instances are unaware of each other, so GET /kvm/settings
    // gets called twice. Refactoring KvmGlobalSettingsDialog to receive page-level injection is outside
    // this task's file list (only KvmPage.vue/VmSidebar.vue/useVmList.ts listed), left for future debt cleanup,
    // here we just update the assertion to accurately reflect this "twice" fact.
    expect(api.getSettings).toHaveBeenCalledTimes(2)
    const modal = document.body.querySelector('.create-vm-modal')
    expect(modal).not.toBeNull()
    expect(modal!.querySelector('.create-vm-title')?.textContent).toContain('系统设置')
    expect((modal!.querySelector('input[name="storagePath"]') as HTMLInputElement).value).toBe('/DATA/KVM')

    w.unmount()
  })
})

describe('KvmPage power action wiring (Task 5)', () => {
  it('auto-selected VM renders ConsoleHeader, one-click action (power on) calls directly without progress overlay', async () => {
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

  it('after stop double confirmation passed, show progress overlay, disappears after action completes (title=kvmStopping, body=vm name)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    let resolveStop: () => void = () => {}
    api.stopVM.mockImplementation(() => new Promise<void>((r) => { resolveStop = () => r(undefined) }))
    const w = mountPage()
    await flush()

    await w.findAll('.action-btn')[1].trigger('click')
    const stopBtn = w.findAll('.dropdown-item').find((b) => b.text().includes('强制关机'))!
    await stopBtn.trigger('click') // 第一次:只变确认文字
    await w.findAll('.dropdown-item').find((b) => b.text().includes('你确定吗？'))!.trigger('click') // 第二次:真正触发

    // At this moment stopVM promise hasn't resolved yet, overlay should already be mounted
    // (Teleport to body, can only query from document, wrapper.find can't find teleported content
    // — already verified with probe scripts).
    // Review Important #2: body text can't be just vm name, must be Vue2 `${vm.name} ${$t('stopping')}...`
    // exact match "sp9-alpine-test 停止中..."; use exact match not toContain('sp9-alpine-test'),
    // otherwise misses "停止中..." half and won't catch the bug (last round missed this).
    const overlay = document.body.querySelector('.kvm-progress-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay!.querySelector('.kvm-progress-title')?.textContent).toContain('正在停止虚拟机')
    expect(overlay!.querySelector('.kvm-progress-msg')?.textContent).toBe('sp9-alpine-test 停止中...')

    resolveStop()
    await flush()
    expect(document.body.querySelector('.kvm-progress-overlay')).toBeNull()
    expect(api.stopVM).toHaveBeenCalledWith('vm-1')
  })

  it('non-confirmation action (pause) in progress doesn\'t show progress overlay', async () => {
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

  it('on action failure, lastError displays inline in console placeholder area (no toast), shows backend message as-is if present', async () => {
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

  it('review Important #1: when rejection has no message, show translated Chinese, not key name like kvmFailedToStart', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    // Non-Error value (or Error with empty message) makes useVmList errText() fall to fallback key string
    // itself ('kvmFailedToStart'), render layer must pass it through t() as i18n key.
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

describe('KvmPage VNC console wiring (Task 6)', () => {
  it('after power-on succeeds, actually establish VNC connection (getVNC called, RFB constructed)', async () => {
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

  it('initially auto-selecting a running VM connects directly (watch selectedVM wiring, not just power action callback)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    mountPage()
    await flush()

    expect(api.getVNC).toHaveBeenCalledWith('vm-1')
    expect(rfbInstances).toHaveLength(1)
  })

  it('after force shutdown confirmation passed, established RFB is disconnected', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    api.stopVM.mockResolvedValue(undefined)
    const w = mountPage()
    await flush()
    expect(rfbInstances).toHaveLength(1) // initially running auto-connects

    await w.findAll('.action-btn')[1].trigger('click')
    const stopBtn = w.findAll('.dropdown-item').find((b) => b.text().includes('强制关机'))!
    await stopBtn.trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('你确定吗？'))!.trigger('click')
    await flush()

    expect(rfbInstances[0].disconnected).toBe(true)
  })

  it('when switching to another running VM, establish connection for new VM (per Vue2 watch selectedVM :747-758)', async () => {
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

  // Review Minor: consoleErrorKey priority (`vnc.errorKey.value || s.lastError.value`,
  // near KvmPage.vue :81) didn't have a test making both sources **simultaneously true** to assert winner —
  // just "show lastError when non-empty" tests would pass even if we flip priority.
  // Here we first create a residual lastError (power-on failure), then switch to another VM triggering
  // connect() failure producing vnc.errorKey, now both are true, assert showing vnc's one.
  it('VNC connection error takes priority over leftover lastError from power action (consoleErrorKey priority)', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', state: 'stopped' }), VM({ id: 'vm-2', name: 'vm-two', state: 'running' })],
      total: 2,
    })
    api.startVM.mockRejectedValue(new Error('domain busy')) // 制造一个残留的 lastError
    api.getVNC.mockRejectedValue(new Error('irrelevant')) // 任何 connect() 都会失败
    const w = mountPage()
    await flush()

    // Initially auto-select vm-1 (stopped), power-on fails → lastError = 'domain busy'
    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('开机'))!.trigger('click')
    await flush()
    expect(w.get('.console-hint.is-error').text()).toBe('domain busy')

    // Switch to vm-2 (running) → watch selectedVM triggers connect(), getVNC fails →
    // vnc.errorKey = 'kvmVncFetchFailed'. lastError is still 'domain busy' at this point (no one cleared it),
    // both true simultaneously, should show vnc's one.
    const items = w.findAll('.vm-list-item')
    await items[1].trigger('click')
    await flush()

    expect(w.get('.console-hint.is-error').text()).toBe('获取 VNC 信息失败')
  })
})

// Task 7: SendKey floating toolbar (per Vue2 `.console-display` @mouseenter/@mouseleave/@mousemove, :154, :1140-1153)
// + fullscreen (:1120-1133).
describe('KvmPage SendKey floating toolbar + fullscreen (Task 7)', () => {
  // jsdom's getBoundingClientRect is always zero (left/width both 0), 80px edge detection
  // needs real stub of container width/left offset to test — just asserting onConsoleMove was called
  // is an empty test (this period has hit this kind of pit several times, see task notes).
  const stubRect = (el: HTMLElement, width = 400) => {
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width, height: 300, right: width, bottom: 300, x: 0, y: 0, toJSON() {} }) as DOMRect
  }

  it('mouse entering console area shows toolbar, leaving hides it', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    const w = mountPage()
    await flush()

    expect(w.find('.sendkey-toolbar').exists()).toBe(false)
    await w.get('.console-display').trigger('mouseenter')
    expect(w.find('.sendkey-toolbar').exists()).toBe(true)
    await w.get('.console-display').trigger('mouseleave')
    expect(w.find('.sendkey-toolbar').exists()).toBe(false)
  })

  it('when mouse is on toolbar, leaving console area doesn\'t hide it', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    const w = mountPage()
    await flush()

    await w.get('.console-display').trigger('mouseenter')
    await w.get('.sendkey-toolbar').trigger('mouseenter') // sendKeyToolbarHover = true
    await w.get('.console-display').trigger('mouseleave')
    expect(w.find('.sendkey-toolbar').exists()).toBe(true) // not hidden
  })

  it('mousemove within right 80px shows, move back to left hides', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    const w = mountPage()
    await flush()

    const display = w.get('.console-display')
    stubRect(display.element as HTMLElement) // width=400 → right 80px threshold is x>=320

    await display.trigger('mousemove', { clientX: 350 })
    expect(w.find('.sendkey-toolbar').exists()).toBe(true)

    await display.trigger('mousemove', { clientX: 100 })
    expect(w.find('.sendkey-toolbar').exists()).toBe(false)
  })

  it('when VM is not running, toolbar never shows no matter how mouse moves', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    const w = mountPage()
    await flush()

    const display = w.get('.console-display')
    stubRect(display.element as HTMLElement)

    await display.trigger('mouseenter')
    expect(w.find('.sendkey-toolbar').exists()).toBe(false)
    await display.trigger('mousemove', { clientX: 350 }) // within right 80px, but not running
    expect(w.find('.sendkey-toolbar').exists()).toBe(false)
    await display.trigger('mouseleave')
    expect(w.find('.sendkey-toolbar').exists()).toBe(false)
  })

  // Hard constraint (task notes explicitly named): onUnmounted removing fullscreenchange listener
  // must use vi.spyOn(document, 'removeEventListener') to assert event name, can't be placeholder assertion.
  // Copy ConsoleHeader.test.ts same style "remove document listener on unmount" (:58-67).
  it('on unmount, remove document fullscreenchange listener (no leak)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()

    const spy = vi.spyOn(document, 'removeEventListener')
    w.unmount()
    expect(spy).toHaveBeenCalledWith('fullscreenchange', expect.any(Function))
    spy.mockRestore()
  })

  // Review Important #2: jsdom has no Fullscreen API at all (verified with probe scripts:
  // `'requestFullscreen' in Element.prototype` is false, `document.exitFullscreen` is undefined,
  // `'fullscreenElement' in document` is false) — can't use vi.spyOn (requires method to already exist),
  // must directly assign/defineProperty to stub the whole API.
  describe('fullscreen (review test addition — previous 5 tests never touched fullscreen button)', () => {
    const stubFullscreenAPI = () => {
      const requestFullscreen = vi.fn().mockResolvedValue(undefined)
      Element.prototype.requestFullscreen = requestFullscreen as unknown as () => Promise<void>
      const exitFullscreen = vi.fn().mockResolvedValue(undefined)
      ;(document as unknown as { exitFullscreen: () => Promise<void> }).exitFullscreen = exitFullscreen
      return { requestFullscreen, exitFullscreen }
    }
    const setFullscreenElement = (el: Element | null) => {
      Object.defineProperty(document, 'fullscreenElement', { value: el, configurable: true })
    }
    afterEach(() => {
      delete (Element.prototype as { requestFullscreen?: unknown }).requestFullscreen
      delete (document as { exitFullscreen?: unknown }).exitFullscreen
      delete (document as { fullscreenElement?: unknown }).fullscreenElement
    })

    it('(a) when not fullscreen, clicking fullscreen button: calls requestFullscreen; after success isFullscreen true and toolbar forcibly shown', async () => {
      const { requestFullscreen } = stubFullscreenAPI()
      setFullscreenElement(null)
      // Use controlled Promise: verify "mouse leaves mid-request hides toolbar, success callback still forces it back"
      // — this is exactly why `sendKeyVisible.value = true` exists in toggleFullscreen success callback,
      // if only checked "right after click" we'd miss the difference of deleting that line (because toolbar
      // must be showing before click to be clickable).
      let resolveRequest: () => void = () => {}
      requestFullscreen.mockImplementation(() => new Promise<void>((r) => { resolveRequest = () => r(undefined) }))

      api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
      const w = mountPage()
      await flush()

      await w.get('.console-display').trigger('mouseenter')
      await w.get('.sendkey-btn--fullscreen').trigger('click')
      expect(requestFullscreen).toHaveBeenCalledTimes(1)

      await w.get('.console-display').trigger('mouseleave') // request hasn't resolved yet, mouse leaves first
      expect(w.find('.sendkey-toolbar').exists()).toBe(false)

      resolveRequest()
      await flush()
      expect(w.find('.sendkey-toolbar').exists()).toBe(true) // success callback forces display, reappears
      expect(w.get('.sendkey-btn--fullscreen').attributes('aria-label')).toBe('退出全屏')
    })

    it('(b) when already fullscreen, clicking fullscreen button: calls exitFullscreen', async () => {
      const { exitFullscreen } = stubFullscreenAPI()
      setFullscreenElement(document.createElement('div'))

      api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
      const w = mountPage()
      await flush()

      await w.get('.console-display').trigger('mouseenter')
      await w.get('.sendkey-btn--fullscreen').trigger('click')
      expect(exitFullscreen).toHaveBeenCalledTimes(1)
    })

    it('fullscreenchange event (non-button triggered, like system-level Esc/F11) syncs isFullscreen, toolbar forcibly shown when VM running', async () => {
      stubFullscreenAPI()
      setFullscreenElement(null)

      api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
      const w = mountPage()
      await flush()
      expect(w.find('.sendkey-toolbar').exists()).toBe(false) // haven't touched mouse yet, initially hidden

      setFullscreenElement(document.createElement('div'))
      document.dispatchEvent(new Event('fullscreenchange'))
      await flush()

      expect(w.find('.sendkey-toolbar').exists()).toBe(true)
    })
  })
})

// Task 8: Installation banner (per Vue2 :142) + SPICE info bar (per Vue2 :157, auto-hide after 180s :748-752).
describe('KvmPage installation banner + SPICE info bar (Task 8)', () => {
  it('running + not booting from disk + has iso → show installation banner', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: false, iso: '/data/alpine.iso' })],
      total: 1,
    })
    const w = mountPage()
    await flush()
    expect(w.find('.installation-banner').exists()).toBe(true)
  })

  it('booting from disk → don\'t show installation banner', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: true, iso: '/data/alpine.iso' })],
      total: 1,
    })
    const w = mountPage()
    await flush()
    expect(w.find('.installation-banner').exists()).toBe(false)
  })

  it('no iso → don\'t show installation banner (even if not booting from disk)', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: false, iso: '' })],
      total: 1,
    })
    const w = mountPage()
    await flush()
    expect(w.find('.installation-banner').exists()).toBe(false)
  })

  it('click installation banner button calls setBootFromDisk(id, true), after success banner disappears (bootFromDisk becomes true)', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: false, iso: '/data/alpine.iso' })],
      total: 1,
    })
    api.setBootFromDisk.mockResolvedValue(undefined)
    const w = mountPage()
    await flush()
    expect(w.find('.installation-banner').exists()).toBe(true)

    // ejectInstallMedia after success calls fetchVMs() for full table refresh — second getVMList returns
    // bootFromDisk:true, banner display condition becomes false, this is the "banner disappearing as success feedback" mechanism
    // (explained in KvmPage.vue: no separate toast, banner disappearing itself is state-driven confirmation).
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: true, iso: '/data/alpine.iso' })],
      total: 1,
    })
    await w.get('.banner-btn').trigger('click')
    await flush()

    expect(api.setBootFromDisk).toHaveBeenCalledWith('vm-1', true)
    expect(w.find('.installation-banner').exists()).toBe(false)
  })

  // Review Important #1: eject failure was completely silent before — lastError is written, but the only inline error display
  // location (ConsoleStage's console-placeholder) only renders when !connected, while banner display condition requires
  // state==='running', by then Task 6 already auto-connected VNC, placeholder layer doesn't render at all, user sees no feedback.
  // After adding banner's own inline error display, these two tests lock down "error actually displays".
  describe('Review Important #1: eject failure shows banner inline error (was completely silent before)', () => {
    it('backend returns message → display as-is on banner', async () => {
      api.getVMList.mockResolvedValue({
        data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: false, iso: '/data/alpine.iso' })],
        total: 1,
      })
      api.setBootFromDisk.mockRejectedValue(new Error('disk is busy'))
      const w = mountPage()
      await flush()

      await w.get('.banner-btn').trigger('click')
      await flush()

      // Banner still there (setBootFromDisk failed, bootFromDisk didn't change, display condition still true)
      expect(w.find('.installation-banner').exists()).toBe(true)
      expect(w.get('.banner-error').text()).toBe('disk is busy')
    })

    it('backend message empty → show translated Chinese fallback (kvmEjectFailed), not key name', async () => {
      api.getVMList.mockResolvedValue({
        data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: false, iso: '/data/alpine.iso' })],
        total: 1,
      })
      api.setBootFromDisk.mockRejectedValue(new Error(''))
      const w = mountPage()
      await flush()

      await w.get('.banner-btn').trigger('click')
      await flush()

      const err = w.get('.banner-error')
      expect(err.text()).toBe('弹出安装介质失败')
      expect(err.text()).not.toContain('kvmEjectFailed')
    })

    it('click button again clears previous error first (won\'t stay stuck in error state)', async () => {
      api.getVMList.mockResolvedValue({
        data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: false, iso: '/data/alpine.iso' })],
        total: 1,
      })
      api.setBootFromDisk.mockRejectedValueOnce(new Error('first failure'))
      const w = mountPage()
      await flush()

      await w.get('.banner-btn').trigger('click')
      await flush()
      expect(w.get('.banner-error').text()).toBe('first failure')

      // Second click succeeds: bootFromDisk becomes true, banner disappears entirely, error disappears with it
      // (not by "clear errorKey but banner still there" middle state, but display condition itself becomes false).
      api.setBootFromDisk.mockResolvedValueOnce(undefined)
      api.getVMList.mockResolvedValue({
        data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: true, iso: '/data/alpine.iso' })],
        total: 1,
      })
      await w.get('.banner-btn').trigger('click')
      await flush()
      expect(w.find('.installation-banner').exists()).toBe(false)
    })
  })

  // Review Important #2 (second review): lastError is a single ref shared by runAction/toggleAutostart/remove/
  // ejectInstallMedia. Old pattern (await eject completes then read s.lastError.value) has "cross-talk" risk —
  // while eject in progress, if **another power action on same VM** (here: pause) happens to fail in this window
  // and write lastError, eject itself succeeded but might read that unrelated error. Here we deliberately
  // **don't switch VM** (avoid triggering ejectError's "reset on VM switch" logic, which would mask the real issue —
  // even without reset, return value shouldn't be polluted), follow real interleaved path: eject sends request but hasn't
  // resolved → pause fails at same moment → eject finally resolves.
  describe('Review Important #2: eject and other actions interleaved without cross-talk (real interleaved path, not sequential)', () => {
    // ⚠️ Probe records (first version of this test lesson): initially just suspended setBootFromDisk, pause failure
    // happened during "eject in progress" then resolveEject, found that even if we revert KvmPage.vue to old pattern
    // of reading shared lastError, this test still all green — isn't actually catching the bug. Reason: `ejectInstallMedia`
    // itself does `lastError.value = ''` clear right after setBootFromDisk succeeds, this happens **before** calling
    // `fetchVMs()` full table refresh; if interleaved pause failure happens **before** eject's own clear, then eject's
    // subsequent clear overwrites lastError back to '', KvmPage reading shared ref or return value both result in '' —
    // two patterns can't distinguish. Real window to read "cross-talk" is **after eject clears lastError itself, before
    // eject's promise actually resolves** (i.e., during its own `await fetchVMs()`) — only if interleaving happens in
    // this window does old pattern (read shared ref after eject) read value polluted by other actions. Here we suspend
    // second getVMList (full refresh triggered after eject succeeds) too, precisely locking interleave point in this window.
    it('after eject internally clears lastError, before its own full refresh completes, another action pollutes lastError → after eject succeeds banner shouldn\'t show that unrelated error', async () => {
      // bootFromDisk stays false throughout — this way eject "succeeds" but banner still meets display condition,
      // so we can check afterward if it showed error line (if bootFromDisk became true, banner disappears directly,
      // can't assert "banner showed no error", see same comment in "click again" test above).
      const fixture = {
        data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: false, iso: '/data/alpine.iso' })],
        total: 1,
      }
      api.getVMList.mockResolvedValueOnce(fixture) // initial mount fetchVMs, normal return
      let resolveRefetch: () => void = () => {}
      // Each subsequent getVMList (eject's own full refresh after success) suspends, manual release by this test —
      // this is concrete implementation of "after eject clears lastError itself, before it truly resolves" window.
      api.getVMList.mockImplementation(() => new Promise((r) => { resolveRefetch = () => r(fixture) }))
      let resolveEject: () => void = () => {}
      api.setBootFromDisk.mockImplementation(() => new Promise<void>((r) => { resolveEject = () => r(undefined) }))
      api.pauseVM.mockRejectedValue(new Error('unrelated pause failure'))
      const w = mountPage()
      await flush()
      expect(w.find('.installation-banner').exists()).toBe(true)

      // 1) eject sends request (setBootFromDisk suspended).
      await w.get('.banner-btn').trigger('click')

      // 2) release setBootFromDisk — eject proceeds internally: first clear lastError to '', then call
      //    fetchVMs() to send second getVMList, but that call is also suspended, so eject stalls in its own
      //    fetchVMs(), hasn't truly resolved yet.
      resolveEject()
      await flush()

      // 3) exactly this window — interleave trigger completely unrelated action (pause), fail it and repollute
      //    shared lastError. This step completes fully, happens between eject's own clear and resolve,
      //    is the real point exposing "cross-talk" (not sequential call).
      await w.findAll('.action-btn')[1].trigger('click') // open overflow menu
      await w.findAll('.dropdown-item').find((b) => b.text().includes('暂停'))!.trigger('click')
      await flush()
      expect(api.pauseVM).toHaveBeenCalledTimes(1) // confirm pause definitely completed (failed, polluted lastError)

      // 4) now release eject's own full refresh request, let it truly resolve — eject itself throughout
      //    is successful, shouldn't be affected by step 3's pause failure.
      resolveRefetch()
      await flush()

      // Banner still there (bootFromDisk unchanged throughout), but shouldn't show "unrelated pause failure" —
      // old pattern (read shared lastError after eject) would fail here, because shared ref now holds
      // step 3's polluted value, not eject's own result.
      expect(w.find('.installation-banner').exists()).toBe(true)
      expect(w.find('.banner-error').exists()).toBe(false)
    })
  })

  // ⚠️ These SPICE tests all need getVNC mock updated too: running VMs auto-connect VNC
  // (Task 6 wiring), after successful connect useVncConsole's onSpicePorts callback overrides
  // vm.spicePort with getVNC's return (per Vue2 connectVNC keepalive merge, spicePreserve.ts).
  // beforeEach's default getVNC mock returns spicePort:0, if not changed here spicePort:5901
  // gets overridden back to 0 by this "keepalive merge", condition becomes false, won't show —
  // probe process see task-8-report.md.
  it('spicePort>0 and bootFromDisk → show SPICE info bar, build correct connection string', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: true, spicePort: 5901 })],
      total: 1,
    })
    api.getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0 })
    const w = mountPage()
    await flush()
    const bar = w.find('.spice-info-bar')
    expect(bar.exists()).toBe(true)
    expect(bar.get('code').text()).toBe(`spice://${window.location.hostname}:5901`)
  })

  it('spicePort<=0 → don\'t show SPICE info bar (even if already booting from disk)', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: true, spicePort: 0 })],
      total: 1,
    })
    const w = mountPage()
    await flush()
    expect(w.find('.spice-info-bar').exists()).toBe(false)
  })

  it('click SPICE info bar close button hides it', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: true, spicePort: 5901 })],
      total: 1,
    })
    api.getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0 })
    const w = mountPage()
    await flush()
    expect(w.find('.spice-info-bar').exists()).toBe(true)
    await w.get('.spice-info-close').trigger('click')
    expect(w.find('.spice-info-bar').exists()).toBe(false)
  })

  // vi.useFakeTimers() must be opened **before** mountPage() — component's watch selectedVM.id
  // setTimeout(...,180000) is called after initial fetchVMs from onMounted resolves, if we mount with real clock
  // first then switch to fake, that setTimeout is already scheduled with real impl, vi.advanceTimersByTime can't
  // move it (hard constraint: can't really wait 180s, must fake clock take over from start).
  it('SPICE info bar auto-disappears after 180s (vi.useFakeTimers, not actually waiting)', async () => {
    vi.useFakeTimers()
    try {
      api.getVMList.mockResolvedValue({
        data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: true, spicePort: 5901 })],
        total: 1,
      })
      api.getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0 })
      const w = mountPage()
      await vi.advanceTimersByTimeAsync(0) // let fetchVMs promise chain + watch first trigger complete
      expect(w.find('.spice-info-bar').exists()).toBe(true)

      await vi.advanceTimersByTimeAsync(180_000)
      expect(w.find('.spice-info-bar').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('when switching VM, SPICE info bar reappears and restarts timer (old timer cleared, won\'t prematurely hide new VM\'s bar)', async () => {
    vi.useFakeTimers()
    try {
      api.getVMList.mockResolvedValue({
        data: [
          VM({ id: 'vm-1', state: 'running', bootFromDisk: true, spicePort: 5901 }),
          VM({ id: 'vm-2', name: 'vm-two', state: 'running', bootFromDisk: true, spicePort: 5902 }),
        ],
        total: 2,
      })
      // Both VMs use same getVNC mock when connect(), whether overridden spicePort is 5901
      // or 5902 doesn't matter — this test only asserts "bar there or not", not connection string value.
      api.getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0 })
      const w = mountPage()
      await vi.advanceTimersByTimeAsync(0)
      expect(w.find('.spice-info-bar').exists()).toBe(true) // vm-1's bar, will hide after 180s (t=180)

      await vi.advanceTimersByTimeAsync(100_000) // t=100s, vm-1's bar still there (not to 180s yet)
      expect(w.find('.spice-info-bar').exists()).toBe(true)

      const items = w.findAll('.vm-list-item')
      await items[1].trigger('click') // switch to vm-2 (t=100s), reset timer → new 180s from now
      await vi.advanceTimersByTimeAsync(0)
      expect(w.find('.spice-info-bar').exists()).toBe(true) // after switch bar reappears (vm-2's)

      // wait another 90s (total t=190s). If vm-1's old timer wasn't cleared, it fires at t=180s,
      // at t=190s bar should (incorrectly) be hidden — asserting it's still there proves old timer was cleared.
      await vi.advanceTimersByTimeAsync(90_000)
      expect(w.find('.spice-info-bar').exists()).toBe(true)

      // wait another 90s (total t=280s = 180s after switch), this is when vm-2's new timer should fire.
      await vi.advanceTimersByTimeAsync(90_000)
      expect(w.find('.spice-info-bar').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  // Review Important #2 additional test: the "restart timer" test above never set spiceDismissed
  // to true (only verified timer clearing), brief Step 3 explicitly requires "reset dismissed on VM switch"
  // — this half sentence completely uncovered — review independently mutated deleting `spiceDismissed.value = false`
  // line in KvmPage.vue, `pnpm vitest run src/kvm/` still all green, confirms this is a gap. Add it here:
  // first close bar on vm-1 (dismissed=true), then switch to vm-2, assert bar reappears — this path
  // must rely on "reset dismissed" to pass, timer clearing alone can't save it (if dismissed not reset,
  // even if timer reschedules hiding after 180s, bar still won't show during that 180s window because
  // dismissed is still true).
  it('after closing SPICE info bar on vm-1, switch to vm-2, bar should reappear (dismissed flag is reset)', async () => {
    api.getVMList.mockResolvedValue({
      data: [
        VM({ id: 'vm-1', state: 'running', bootFromDisk: true, spicePort: 5901 }),
        VM({ id: 'vm-2', name: 'vm-two', state: 'running', bootFromDisk: true, spicePort: 5902 }),
      ],
      total: 2,
    })
    api.getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0 })
    const w = mountPage()
    await flush()
    expect(w.find('.spice-info-bar').exists()).toBe(true)

    await w.get('.spice-info-close').trigger('click') // close on vm-1
    expect(w.find('.spice-info-bar').exists()).toBe(false)

    const items = w.findAll('.vm-list-item')
    await items[1].trigger('click') // switch to vm-2
    await flush()
    expect(w.find('.spice-info-bar').exists()).toBe(true) // should reappear, not continue vm-1's closed state
  })
})

// Required ① (full branch final review): Vue2's six power actions + toggleAutoStart + deleteVM +
// handleInstallationFinished all pop buefy toast on success, New-UI has none — unreported deviation.
// Lock down "success really pops toast, exact text match Vue2". At least cover start / autostart
// toggle both states / delete / eject four types (minimum set task dispatch specifies), don't test failure
// path (that's existing convention of inline lastError display, task explicitly says "don't change to toast").
describe('KvmPage Required ①: success toast (full branch final review)', () => {
  it('after power-on success, pop toast "sp9-alpine-test 已启动"', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.startVM.mockResolvedValue(undefined)
    const w = mountPage()
    await flush()

    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('开机'))!.trigger('click')
    await flush()

    expect(useToast().toasts.map((x) => x.text)).toContain('sp9-alpine-test 已启动')
  })

  it('pause/resume/force restart/force shutdown on success also each pop corresponding text toast', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    api.pauseVM.mockResolvedValue(undefined)
    api.resumeVM.mockResolvedValue(undefined)
    api.restartVM.mockResolvedValue(undefined)
    api.stopVM.mockResolvedValue(undefined)
    const w = mountPage()
    await flush()
    const toast = useToast()

    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('暂停'))!.trigger('click')
    await flush()
    expect(toast.toasts.map((x) => x.text)).toContain('sp9-alpine-test 已暂停')

    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('恢复'))!.trigger('click')
    await flush()
    expect(toast.toasts.map((x) => x.text)).toContain('sp9-alpine-test 已恢复')

    // restart needs two clicks (in-place double confirmation)
    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('强制重启'))!.trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('你确定吗？'))!.trigger('click')
    await flush()
    expect(toast.toasts.map((x) => x.text)).toContain('sp9-alpine-test 已重启')

    // SP16 Task 10: title always promised force shutdown, test body never clicked it — api.stopVM
    // mocked long ago but never triggered, so title reads "covered" but actually not. Add it.
    // Same in-place double confirmation as restart (OverflowMenu.vue:91 isPending('stop') branch).
    // Text from zh_cn.sp9.ts:437 literal kvmToastStopped('已停止'), not guessed from title.
    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('强制关机'))!.trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('你确定吗？'))!.trigger('click')
    await flush()
    expect(api.stopVM).toHaveBeenCalledWith('vm-1')
    expect(toast.toasts.map((x) => x.text)).toContain('sp9-alpine-test 已停止')
  })

  it('autostart toggle two states: on → toast contains "开", click again off → toast contains "已关闭"', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running', autostart: false })], total: 1 })
    api.setAutostart.mockResolvedValue(undefined)
    const w = mountPage()
    await flush()
    const toast = useToast()

    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('自动启动'))!.trigger('click')
    await flush()
    expect(toast.toasts.map((x) => x.text)).toContain('sp9-alpine-test 自动启动 开')

    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('自动启动'))!.trigger('click')
    await flush()
    expect(toast.toasts.map((x) => x.text)).toContain('sp9-alpine-test 自动启动 已关闭')
  })

  it('delete (double confirmation passed) on success pop toast "sp9-alpine-test 已删除"', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.deleteVM.mockResolvedValue(undefined)
    const w = mountPage()
    await flush()

    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('删除'))!.trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('你确定吗？'))!.trigger('click')
    await flush()

    expect(useToast().toasts.map((x) => x.text)).toContain('sp9-alpine-test 已删除')
  })

  it('eject installation media on success pop toast (Vue2 fixed whole sentence, not spliced with vm name)', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: false, iso: '/data/alpine.iso' })],
      total: 1,
    })
    api.setBootFromDisk.mockResolvedValue(undefined)
    const w = mountPage()
    await flush()

    await w.get('.banner-btn').trigger('click')
    await flush()

    expect(useToast().toasts.map((x) => x.text)).toContain(
      '光盘已弹出，虚拟机将在下次重启时从硬盘引导。',
    )
  })

  it('on failure don\'t pop toast (continue following existing lastError inline display convention)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.startVM.mockRejectedValue(new Error('domain busy'))
    const w = mountPage()
    await flush()

    await w.findAll('.action-btn')[1].trigger('click')
    await w.findAll('.dropdown-item').find((b) => b.text().includes('开机'))!.trigger('click')
    await flush()

    expect(useToast().toasts).toEqual([])
    expect(w.get('.console-hint.is-error').text()).toBe('domain busy')
  })
})

// P6 Task 8: Create flow wiring — Add VM enabled / empty list auto-open / OsSelector linked / createVM submit /
// ISO download three events toast. Dialogs all use KvmDialog (reka-ui DialogPortal), uniformly Teleport
// to real document.body, can only assert with document.body.querySelector, must use attachTo:
// document.body + await nextTick() (hard constraint 8, pitfalls hit and fixed by first four tasks).
describe('KvmPage create flow wiring (P6 Task 8)', () => {
  // Click downloaded official template card (button text="select"). Multiple tests reuse, write as small tool
  // instead of repeating same querySelector logic in each test.
  const clickSelectAlpine = () => {
    const btn = [...document.body.querySelectorAll('.os-action-btn')]
      .find((b) => b.textContent?.trim() === '选择') as HTMLElement
    btn.click()
  }
  const fillName = (value: string) => {
    const el = document.body.querySelector('input[name="name"]') as HTMLInputElement
    el.value = value
    el.dispatchEvent(new Event('input'))
  }

  // Review Important #2: "Add VM" button → dialog lands (reka-ui teleport needs one nextTick,
  // hard constraint 8) sequence was copied verbatim six times. Split into two helpers not one —
  // "only open create dialog" and "open create dialog then click ISO row to open OsSelector" are
  // two different test premises, not all tests need clicking ISO row (e.g. "click Add VM to pop create dialog"),
  // forcing one helper would make unnecessary tests also run irrelevant steps.
  const openCreateDialog = async (w: VueWrapper): Promise<void> => {
    await w.get('.add-vm-btn').trigger('click')
    await flush()
    await w.vm.$nextTick()
  }
  const openCreateAndPickIso = async (w: VueWrapper): Promise<void> => {
    await openCreateDialog(w)
    // ⚠️ .cv-iso-btn is inside CreateVmDialog's Teleport content, not on KvmPage's own render tree —
    // `w.get()`/`w.find()` can't find teleported nodes (hard constraint 8 pit, all first four tasks hit),
    // must use real document query then native `.click()` (same as CreateVmDialog.test.ts `q(...).click()` style).
    ;(document.body.querySelector('.cv-iso-btn') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()
  }

  it('when VM list is empty, auto-open create dialog (per Vue2 :901, P5 used empty placeholder)', async () => {
    api.getVMList.mockResolvedValue({ data: [], total: 0 })
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    expect(document.body.querySelector('.create-vm-title')?.textContent).toContain('创建新虚拟机')
    w.unmount()
  })

  it('when list non-empty, don\'t auto-open', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    expect(document.body.querySelector('.create-vm-title')).toBeNull()
    w.unmount()
  })

  // autoOpenedCreate one-time flag's real coverage (hard constraint 4/5): only test "first pull empty opens" /
  // "first pull non-empty doesn't open" these two, delete this flag (becomes "open every time if !loading && vms.length===0")
  // still all green — both tests only mount once, only go through fetchVMs() once. Add one here that makes
  // "delete one-time flag" mutation really fail: after manual close dialog, trigger one MessageBus-event-caused
  // full refresh (`kvm:vm_deleted` without vm_id makes useVmList take full `fetchVMs()` refresh branch),
  // still pulls empty list — without one-time flag, this refresh would re-pop the dialog, "resurrecting" user's
  // just-closed dialog. Mutation verification see task report.
  it('after manual close, subsequent refresh even pulling empty list again won\'t re-open (autoOpenedCreate one-time flag)', async () => {
    api.getVMList.mockResolvedValue({ data: [], total: 0 })
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    expect(document.body.querySelector('.create-vm-title')).not.toBeNull()

    ;(document.body.querySelector('.create-vm-close') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()
    expect(document.body.querySelector('.create-vm-title')).toBeNull()

    emitBus('kvm:vm_deleted', {}) // no vm_id → useVmList takes full fetchVMs() refresh branch
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.create-vm-title')).toBeNull()
    w.unmount()
  })

  it('click "Add VM" to open create dialog', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 }) // non-empty list, exclude auto-open unrelated branch
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    expect(document.body.querySelector('.create-vm-title')).toBeNull()

    await openCreateDialog(w)

    expect(document.body.querySelector('.create-vm-title')?.textContent).toContain('创建新虚拟机')
    w.unmount()
  })

  it('click ISO row in create dialog → OsSelector opens (z-index 920 stacks on top)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()

    await openCreateAndPickIso(w)

    // KvmDialog's wrapper class (.create-vm-modal/.create-vm-title) is same set for all dialogs
    // (create dialog + OsSelector both mounted now), can't just query first — use z-index to precisely
    // locate OsSelector's one (920 stacked over create dialog's 900, per Vue2 b-modal stacking order).
    const modals = [...document.body.querySelectorAll('.create-vm-modal')] as HTMLElement[]
    expect(modals).toHaveLength(2)
    const osModal = modals.find((m) => m.style.zIndex === '921') // DialogContent = zBase+1
    expect(osModal).toBeTruthy()
    expect(osModal!.querySelector('.create-vm-title')?.textContent).toContain('选择操作系统')
    w.unmount()
  })

  it('OsSelector select → create dialog ISO row shows path', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    api.getISOList.mockResolvedValue([ISO_ALPINE])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()

    await openCreateAndPickIso(w)

    clickSelectAlpine()
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.cv-iso-btn')?.textContent)
      .toContain('/DATA/KVM/isos/alpine-319.iso')
    // Select then close (per Vue2 selectOS → close): OsSelector's own title shouldn't still be there.
    const titles = [...document.body.querySelectorAll('.create-vm-title')].map((el) => el.textContent)
    expect(titles.some((t) => t?.includes('选择操作系统'))).toBe(false)
    w.unmount()
  })

  it('submit success → close dialog + toast "VM create success" + refresh list', async () => {
    api.getVMList.mockResolvedValueOnce({ data: [VM()], total: 1 })
    api.getISOList.mockResolvedValue([ISO_ALPINE])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()

    await openCreateAndPickIso(w)
    clickSelectAlpine()
    await flush()
    await w.vm.$nextTick()

    fillName('p6-throwaway')
    await w.vm.$nextTick()

    api.createVM.mockResolvedValue({ id: 'new-1' })
    api.getVMList.mockResolvedValue({ data: [VM(), VM({ id: 'vm-2', name: 'vm-two' })], total: 2 })

    ;(document.body.querySelector('.cv-primary-btn') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()

    expect(api.createVM).toHaveBeenCalledWith(expect.objectContaining({
      name: 'p6-throwaway',
      iso: '/DATA/KVM/isos/alpine-319.iso',
      os: 'Alpine',
      osType: 'linux',
    }))
    expect(document.body.querySelector('.create-vm-title')).toBeNull() // 关弹窗
    expect(useToast().toasts.map((x) => x.text)).toContain('虚拟机创建成功')
    expect(api.getVMList).toHaveBeenCalledTimes(2) // mounted 一次 + create 成功后刷新一次
    w.unmount()
  })

  it('提交失败 → 弹窗不关,内联显示后端 message', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    api.getISOList.mockResolvedValue([ISO_ALPINE])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()

    await openCreateAndPickIso(w)
    clickSelectAlpine()
    await flush()
    await w.vm.$nextTick()

    fillName('p6-throwaway')
    await w.vm.$nextTick()

    api.createVM.mockRejectedValue(new Error('domain name already exists'))
    ;(document.body.querySelector('.cv-primary-btn') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.create-vm-title')?.textContent).toContain('创建新虚拟机') // 没关
    expect(document.body.querySelector('.cv-error')?.textContent).toBe('domain name already exists')
    expect(useToast().toasts).toEqual([]) // 硬约束 3:弹窗内报错不许 toast
    w.unmount()
  })

  // 评审补测(报告里主动申报的缺口):create() 的 errText fallback 分支(rejection 不是
  // Error 实例、拿不到 message 时落回 i18n 键名 'kvmFailedToCreate')此前只在
  // useVmList.test.ts 里验证过"返回的字符串是键名",没有一条用例走到 KvmPage 这一层——
  // onCreateSubmit 里 `err && te(err) ? t(err) : err` 那道判定专门是为了不把键名裸传进
  // .cv-error,这里补上覆盖,避免这道判定成为"写了但没人验证过"的代码。
  it('提交失败且后端 rejection 非 Error 值(拿不到 message)→ 内联显示翻译后的中文,不是键名', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    api.getISOList.mockResolvedValue([ISO_ALPINE])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()

    await openCreateAndPickIso(w)
    clickSelectAlpine()
    await flush()
    await w.vm.$nextTick()

    fillName('p6-throwaway')
    await w.vm.$nextTick()

    api.createVM.mockRejectedValue('boom') // 非 Error 值 reject → useVmList.errText() 走 fallback 键名
    ;(document.body.querySelector('.cv-primary-btn') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()

    const err = document.body.querySelector('.cv-error')?.textContent
    expect(err).toBe('创建虚拟机失败') // kvmFailedToCreate 翻译后的中文,不是键名本身
    expect(err).not.toContain('kvmFailedToCreate')
    w.unmount()
  })

  // 评审 Important #1:`onCreateSubmit` 里 `creating.value = true/false` 此前零判别力覆盖——
  // 整行删掉现有测试套件一条不会翻红。这里补上:让 `api.createVM` 返回一个手动控制的
  // pending Promise,验证提交进行中按钮 disabled/is-loading、二次点击不会让 `createVM`
  // 被调第二次、落定后按钮恢复可用。用**拒绝**而不是成功来落定——成功会让
  // `onCreateSubmit` 顺带把 `createOpen` 也置为 false、弹窗关闭卸载,DOM 节点被摘掉后
  // "按钮恢复可用"这条断言就没有意义了;失败分支弹窗留着,能在弹窗仍存在时验证按钮
  // 状态真的复位。
  //
  // ⚠️ Global Constraint #15「被混淆的断言」自查(评审点名的坑,Task 7 已经栽过一次):
  // 表单必须是**合法的**(已 `openCreateAndPickIso` + `clickSelectAlpine` + `fillName` 填好
  // name/iso/os),否则 `validateCreateVm` 会独立挡住第二次点击、emit 不出 submit,分不清
  // 挡住第二次调用的到底是 `creating` 守卫还是校验——用合法表单排除这个混淆因素,第二次
  // 点击如果真的没有让 `api.createVM` 被调用,只能归因于 `creating` 守卫。
  it('提交进行中按钮 disabled/is-loading,二次点击不会重复调用 createVM,落定后恢复可用', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    api.getISOList.mockResolvedValue([ISO_ALPINE])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()

    await openCreateAndPickIso(w)
    clickSelectAlpine()
    await flush()
    await w.vm.$nextTick()
    fillName('p6-throwaway') // 合法表单——上面注释解释了为什么这一步不能省
    await w.vm.$nextTick()

    let rejectCreate: (e: unknown) => void = () => {}
    api.createVM.mockReturnValue(new Promise((_resolve, reject) => { rejectCreate = reject }))

    const btn = document.body.querySelector('.cv-primary-btn') as HTMLButtonElement
    btn.click() // 第一次点击,createVM 挂起未落定
    await flush()
    await w.vm.$nextTick()

    expect(api.createVM).toHaveBeenCalledTimes(1)
    expect(btn.disabled).toBe(true)
    expect(btn.classList.contains('is-loading')).toBe(true)

    // 第二次点击:原生 `disabled` 属性本身会挡掉 `.click()`(jsdom 与真实浏览器一致,
    // CreateVmDialog.test.ts 已用最小复现脚本验证过),必须用 `dispatchEvent` 绕开平台级
    // 拦截,才能真的测到 `onSubmit()` 内部 `if (props.creating) return` 这道 JS 守卫,
    // 而不是被浏览器的 disabled 语义顺手挡住(那样测的就不是这道守卫了)。
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
    await w.vm.$nextTick()
    expect(api.createVM).toHaveBeenCalledTimes(1) // 仍然只有第一次那一次

    rejectCreate(new Error('boom')) // 用失败落定,弹窗留着,才能在按钮还存在时断言它复位
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.create-vm-title')).not.toBeNull() // 弹窗还开着
    expect(btn.disabled).toBe(false)
    expect(btn.classList.contains('is-loading')).toBe(false)
    w.unmount()
  })

  // 评审修复的真缺陷回归测试:KvmGlobalSettingsDialog 与 KvmPage 各自持有一份独立的
  // useKvmHostInfo() 实例(Task 2 的隔离设计,见 KvmGlobalSettingsDialog.vue 顶部与
  // KvmPage.vue `@saved` 处的注释)。保存全局设置成功后,如果 KvmPage 那份 hostInfo
  // 不重新 fetch,创建弹窗的默认值会停在保存前的旧值——这里走完整的真实路径验证修复。
  //
  // ⚠️ Global Constraint #15「被混淆的断言」自查:断言的是"点保存前 vs 点保存后"
  // `api.getSettings` 调用次数的变化(2 → 3),而不是笼统地"调用过 getSettings"——
  // 调用 #1 来自 mounted 时 KvmPage 自己那份 hostInfo.fetch(),调用 #2 来自打开全局设置
  // 弹窗时它自己那份 host.fetch()(这两次都发生在"点保存"**之前**,先用中间断言把它们
  // 显式记下来、排除掉,不让它们混进"点保存导致的那一次"里)。这条测试期间没有触发任何
  // MessageBus 事件、没有切换选中 VM——没有别的已知机制会在这个窗口里调用 getSettings,
  // 唯一能让计数从 2 变成 3 的就是 `@saved` 触发的那次 fetch。
  it('评审修复:保存全局设置后,创建弹窗的默认值跟着刷新(不再停在旧值)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    expect(api.getSettings).toHaveBeenCalledTimes(1) // mounted:KvmPage 自己那份 hostInfo

    await w.get('.kvm-settings-btn').trigger('click') // 打开全局设置弹窗
    await flush()
    await w.vm.$nextTick()
    expect(api.getSettings).toHaveBeenCalledTimes(2) // 弹窗自己那份 useKvmHostInfo() 又 fetch 一次

    const vcpuInput = document.body.querySelector('input[name="defaultVcpu"]') as HTMLInputElement
    vcpuInput.value = '4'
    vcpuInput.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()

    // 模拟后端保存后已经落盘:此后的 getSettings 调用返回新值。
    api.getSettings.mockResolvedValue({
      autostart: false, availableDiskGB: 263, availableMemoryMB: 9234, cpuCores: 6,
      defaultDiskSize: 20, defaultMemory: 2048, defaultVcpu: 4,
      networkInterfaces: ['enp2s0', 'enp4s0', 'wlp1s0'], storagePath: '/DATA/KVM',
    })
    api.updateSettings.mockResolvedValue({})

    ;(document.body.querySelector('.cv-primary-btn') as HTMLElement).click() // 全局设置弹窗自己的保存按钮
    await flush()
    await w.vm.$nextTick()

    // 基础断言:又被调了一次,且只能由 @saved 触发的 hostInfo.fetch() 解释(见上面注释)。
    expect(api.getSettings).toHaveBeenCalledTimes(3)
    expect(document.body.querySelector('.create-vm-title')).toBeNull() // 保存成功自动关闭全局设置弹窗

    // 更强的断言:打开创建弹窗,CPU 预填反映的是刚保存的新值 4,不是保存前的旧值 2。
    await openCreateDialog(w)

    const activeCpuBtns = [...document.body.querySelectorAll('.cv-cpu-btn')]
      .filter((b) => b.classList.contains('active'))
    expect(activeCpuBtns).toHaveLength(4)
    w.unmount()
  })

  it('ISO 下载完成 → toast「Debian 已下载」(拼法照 Vue2 :165 `${os.name} ${$t("downloaded")}`)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    api.getISOList.mockResolvedValue([ISO_DEBIAN()])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()

    emitBus('kvm:iso_download_complete', { iso_id: 'debian-13' })
    await flush()

    expect(useToast().toasts.map((x) => x.text)).toContain('Debian 已下载')
    w.unmount()
  })

  // 全分支评审修复 A3(此前 toast「下载失败」被 OS 选择器自己的遮罩挡住,用户看不见——
  // 已改成 OsSelector 内联展示,不再走 toast):打开创建弹窗 → 打开 OsSelector(此时它
  // 的遮罩正盖在屏幕上,与真实用户盯着下载百分比的场景一致)→ 收到下载失败事件 →
  // 内联 `.cv-error` 显示,不弹 toast。
  it('ISO 下载失败 → OsSelector 内联 .cv-error 显示「下载失败」,不弹 toast(A3)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    api.getISOList.mockResolvedValue([ISO_DEBIAN()])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openCreateAndPickIso(w)
    expect(document.body.querySelector('.cv-error')).toBeNull() // 排除混淆:此刻确实还没有报错

    emitBus('kvm:iso_download_failed', { iso_id: 'debian-13' })
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.cv-error')?.textContent).toBe('下载失败')
    expect(useToast().toasts).toEqual([])
    w.unmount()
  })

  // 全分支评审修复 A3:新一轮下载开始前清掉上一次的失败报错——不清的话,下载同一个/
  // 另一个 ISO 重试时,旧的红字会一直挂在那里,即便这次下载本身还没有结果。
  it('新一轮下载开始前清掉上一次的失败报错残留(A3)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    api.getISOList.mockResolvedValue([ISO_DEBIAN()])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openCreateAndPickIso(w)

    emitBus('kvm:iso_download_failed', { iso_id: 'debian-13' })
    await flush()
    await w.vm.$nextTick()
    expect(document.body.querySelector('.cv-error')?.textContent).toBe('下载失败') // 先确认报错确实还在

    const dlBtn = document.body.querySelector('.os-action-btn') as HTMLElement
    dlBtn.click()
    await flush()
    await w.vm.$nextTick()

    expect(api.downloadISO).toHaveBeenCalled() // 下载调用本身没有被这层包装吞掉
    expect(document.body.querySelector('.cv-error')).toBeNull() // 旧报错已清空
    w.unmount()
  })

  // 全分支评审修复 A3:关闭选择器时清掉报错残留——不清的话,下次(哪怕是给设置弹窗)
  // 重新打开会带出上一次已经不相关的旧报错。
  it('关闭 OsSelector 后重新打开不会带出上一次的下载失败报错(A3)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    api.getISOList.mockResolvedValue([ISO_DEBIAN()])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openCreateAndPickIso(w)

    emitBus('kvm:iso_download_failed', { iso_id: 'debian-13' })
    await flush()
    await w.vm.$nextTick()
    expect(document.body.querySelector('.cv-error')?.textContent).toBe('下载失败')

    // 关闭 OsSelector(点它的 ✕),再从创建弹窗重新打开一次。
    const closeBtns = [...document.body.querySelectorAll('.create-vm-close')]
    ;(closeBtns[closeBtns.length - 1] as HTMLElement).click() // 最上层(z 920)的那个是 OsSelector
    await flush()
    await w.vm.$nextTick()

    ;(document.body.querySelector('.cv-iso-btn') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.cv-error')).toBeNull()
    w.unmount()
  })

  it('点正在下载的卡片 → toast「请等待下载完成」', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    api.getISOList.mockResolvedValue([ISO_DEBIAN({ status: 'downloading', progress: 42 })])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()

    await openCreateAndPickIso(w)

    const btn = document.body.querySelector('.os-action-btn') as HTMLElement
    btn.click()
    await flush()
    await w.vm.$nextTick()

    expect(useToast().toasts.map((x) => x.text)).toContain('请等待下载完成')
    // 硬约束(OsSelector.vue handleAction):点正在下载的卡片只 emit need-wait,不该
    // 顺带把弹窗关了或触发别的动作——间接验证:创建弹窗还在。
    expect(document.body.querySelector('.create-vm-title')?.textContent).toContain('创建新虚拟机')
    w.unmount()
  })
})

// P6 Task 9:VM 设置弹窗接线——齿轮解禁 → 弹窗回填 → 保存成功/失败 → OsSelector 路由到
// 设置弹窗而不是创建弹窗(osSelectorTarget,与创建流程共用同一个 OsSelector 实例)。
describe('KvmPage VM 设置弹窗接线(P6 Task 9)', () => {
  const openSettings = async (w: VueWrapper): Promise<void> => {
    await w.get('.action-btn').trigger('click') // 齿轮是 console-actions 里第一个 action-btn
    await flush()
    await w.vm.$nextTick()
  }

  it('齿轮点击后弹出 VM 设置弹窗,标题与 General 表单回填选中 VM 的当前值', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', name: 'sp9-alpine-test', state: 'stopped', vcpu: 2, memory: 1024 })],
      total: 1,
    })
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    expect(document.body.querySelector('.create-vm-title')).toBeNull()

    await openSettings(w)

    expect(document.body.querySelector('.create-vm-title')?.textContent).toContain('虚拟机设置 - sp9-alpine-test')
    expect((document.body.querySelector('input[name="name"]') as HTMLInputElement).value).toBe('sp9-alpine-test')
    w.unmount()
  })

  it('保存成功 → 调用 updateVM(id, patch)、关弹窗、弹 toast「设置已保存」,选中 VM 的可见字段被回写', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', name: 'sp9-alpine-test', state: 'stopped' })],
      total: 1,
    })
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSettings(w)

    const nameInput = document.body.querySelector('input[name="name"]') as HTMLInputElement
    nameInput.value = 'renamed-vm'
    nameInput.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()

    // P6 Task 10 起:`.cv-primary-btn` 不再唯一——快照 tab 默认内容(真实 SnapshotsTab)
    // 里"创建"按钮也是这个类且 v-show 不移出 DOM,裸选择器会先命中它。限定在
    // `.create-vm-foot` 容器内才是 General tab 的"保存"按钮。
    ;(document.body.querySelector('.create-vm-foot .cv-primary-btn') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()

    expect(api.updateVM).toHaveBeenCalledWith('vm-1', expect.objectContaining({ name: 'renamed-vm' }))
    expect(document.body.querySelector('.create-vm-title')).toBeNull() // 关弹窗
    expect(useToast().toasts.map((x) => x.text)).toContain('设置已保存')
    // 回写生效的直接证据:控制台头的标题(读 s.selectedVM.value.name)跟着变了,
    // 不需要手动刷新页面——这是 useVmList.update() 成功后 Object.assign 回写的效果。
    expect(w.get('.console-title h3').text()).toBe('renamed-vm')
    w.unmount()
  })

  it('保存失败 → 弹窗不关,内联显示后端 message(不弹 toast)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.updateVM.mockRejectedValue(new Error('domain name already exists'))
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSettings(w)

    // 同上一条注释:限定在 `.create-vm-foot` 容器内,避免误点快照 tab 默认内容里的
    // "创建"按钮。
    ;(document.body.querySelector('.create-vm-foot .cv-primary-btn') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.create-vm-title')?.textContent).toContain('虚拟机设置') // 没关
    expect(document.body.querySelector('.cv-error')?.textContent).toBe('domain name already exists')
    expect(useToast().toasts).toEqual([])
    w.unmount()
  })

  // osSelectorTarget 路由的真实覆盖:设置弹窗与创建弹窗共用同一个页面级 OsSelector 实例,
  // 从设置弹窗打开 OsSelector 选中的结果必须落进设置弹窗自己的 iso 行,不能串到创建
  // 弹窗那边(创建弹窗此刻甚至从未打开过)。
  it('设置弹窗里点 ISO 行打开 OsSelector,选中结果落进设置弹窗(不是创建弹窗)', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', state: 'stopped', iso: '', bootFromDisk: true })],
      total: 1,
    })
    api.getISOList.mockResolvedValue([ISO_ALPINE])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSettings(w)
    expect(document.body.querySelector('.cv-iso-btn')?.textContent).toContain('未挂载 ISO')

    ;(document.body.querySelector('.cv-iso-btn') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()

    const pickBtn = [...document.body.querySelectorAll('.os-action-btn')]
      .find((b) => b.textContent?.trim() === '选择') as HTMLElement
    pickBtn.click()
    await flush()
    await w.vm.$nextTick()

    // OsSelector 选中即关,此刻只应剩设置弹窗一个 .create-vm-modal(创建弹窗从未打开过)。
    expect([...document.body.querySelectorAll('.create-vm-modal')]).toHaveLength(1)
    expect(document.body.querySelector('.create-vm-title')?.textContent).toContain('虚拟机设置')
    expect(document.body.querySelector('.cv-iso-btn')?.textContent)
      .toContain('/DATA/KVM/isos/alpine-319.iso')
    w.unmount()
  })

  // 全分支评审修复 A2:vmSettingsOpen 是独立于 `v-if="s.selectedVM.value"` 的一个 ref。
  // 选中的 VM 在别处被删除时(另一浏览器标签页/CLI/另一用户),v-if 会卸载弹窗,但
  // vmSettingsOpen 本身留在 true——下次选中任意一台别的 VM,v-if 转真,弹窗会带着这个
  // 陈旧的 true 自己弹出来。判别力设计:先证明"不选中新 VM 之前,弹窗确实已经因为
  // v-if 卸载消失了"(排除"弹窗从来没关过"这个混淆因素),再选中新 VM 断言它没有
  // 自己重新出现。
  it('评审修复 A2:VM 在别处被删除后,选中另一台 VM 时设置弹窗不会带着陈旧状态自己弹出来', async () => {
    api.getVMList.mockResolvedValue({
      data: [
        VM({ id: 'vm-1', name: 'vm-x', state: 'stopped' }),
        VM({ id: 'vm-2', name: 'vm-y', state: 'stopped' }),
      ],
      total: 2,
    })
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    // 自动选中列表第一台(vm-1),打开它的设置弹窗。
    await openSettings(w)
    expect(document.body.querySelector('.create-vm-title')?.textContent).toContain('虚拟机设置')

    // vm-1 在别处被删除——带 vm_id,useVmList 直接把 selectedVM 置 null,不会自动重选
    // 别的 VM(useVmList.ts:141-149)。
    emitBus('kvm:vm_deleted', { vm_id: 'vm-1' })
    await flush()
    await w.vm.$nextTick()
    // 先确认:此刻弹窗确实已经消失(v-if 卸载),不是"从来没关过"。
    expect(document.body.querySelector('.create-vm-title')).toBeNull()

    // 选中另一台 VM(此刻列表只剩 vm-2 一条)。
    const items = w.findAll('.vm-list-item')
    expect(items).toHaveLength(1)
    await items[0].trigger('click')
    await flush()
    await w.vm.$nextTick()

    // 断言:设置弹窗没有带着陈旧的 vmSettingsOpen=true 自己弹出来。
    expect(document.body.querySelector('.create-vm-title')).toBeNull()
    w.unmount()
  })
})

describe('KvmPage 快照 tab 接线(P6 Task 10)', () => {
  const openSettings = async (w: VueWrapper): Promise<void> => {
    await w.get('.action-btn').trigger('click') // 齿轮是 console-actions 里第一个 action-btn
    await flush()
    await w.vm.$nextTick()
  }
  const openSnapshotsTab = async (w: VueWrapper): Promise<void> => {
    await openSettings(w)
    ;([...document.body.querySelectorAll('.settings-tab')][1] as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()
  }

  // 照 Vue2 :250 点 tab 才拉:齿轮打开后(General tab)不应该已经调用 getSnapshots,
  // 点了快照 tab 之后才调用,且列表渲染出来。
  it('点快照 tab → 调用 getSnapshots(vmId),渲染出列表', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.getSnapshots.mockResolvedValue([
      { id: 'snap-1', vmId: 'vm-1', name: 'before-upgrade', description: '升级前备份', state: 'complete', createdAt: '2026-08-03T10:00:00Z' },
    ])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSettings(w)
    expect(api.getSnapshots).not.toHaveBeenCalled() // General tab 不应该已经拉取

    await openSnapshotsTab(w)
    expect(api.getSnapshots).toHaveBeenCalledWith('vm-1')
    expect(document.body.querySelector('.cv-snapshot-name')?.textContent).toContain('before-upgrade')
    w.unmount()
  })

  it('创建快照成功 → 调用 createSnapshot、弹 toast「快照创建成功」、列表刷新一遍', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.getSnapshots
      .mockResolvedValueOnce([]) // 点 tab 时第一次拉:空
      .mockResolvedValueOnce([ // create 成功后再拉一遍:非空
        { id: 'snap-new', vmId: 'vm-1', name: 'after-create', description: '', state: 'complete', createdAt: '' },
      ])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSnapshotsTab(w)
    expect(document.body.querySelector('.cv-empty-state')?.textContent).toContain('暂无快照')

    const nameInput = document.body.querySelector('input[name="snapshotName"]') as HTMLInputElement
    nameInput.value = 'before-upgrade'
    nameInput.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    ;(document.body.querySelector('.snapshots-body .cv-primary-btn') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()

    expect(api.createSnapshot).toHaveBeenCalledWith('vm-1', { name: 'before-upgrade', description: '' })
    expect(api.getSnapshots).toHaveBeenCalledTimes(2) // 点 tab 一次 + create 成功后再一次
    expect(useToast().toasts.map((x) => x.text)).toContain('快照创建成功')
    expect(document.body.querySelector('.cv-snapshot-name')?.textContent).toContain('after-create')
    w.unmount()
  })

  it('创建快照失败 → 内联显示后端 message,不弹 toast', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.createSnapshot.mockRejectedValue(new Error('disk quota exceeded'))
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSnapshotsTab(w)

    const nameInput = document.body.querySelector('input[name="snapshotName"]') as HTMLInputElement
    nameInput.value = 'x'
    nameInput.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    ;(document.body.querySelector('.snapshots-body .cv-primary-btn') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.snapshots-body .cv-error')?.textContent).toBe('disk quota exceeded')
    expect(useToast().toasts).toEqual([])
    expect(document.body.querySelector('.create-vm-title')).not.toBeNull() // 弹窗没关
    w.unmount()
  })

  it('删除二次确认通过 → 挂进度遮罩(标题/正文照 Vue2 拼法),完成后摘遮罩、成功弹 toast「name 已删除」,列表本地过滤', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.getSnapshots.mockResolvedValue([
      { id: 'snap-1', vmId: 'vm-1', name: 'before-upgrade', description: '', state: 'complete', createdAt: '' },
    ])
    let resolveDelete: () => void = () => {}
    api.deleteSnapshot.mockImplementation(() => new Promise<void>((r) => { resolveDelete = () => r(undefined) }))
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSnapshotsTab(w)

    const delBtn = () => document.body.querySelector('.cv-btn-delete') as HTMLElement
    delBtn().click() // 第一次:只变确认文字
    await w.vm.$nextTick()
    delBtn().click() // 第二次:真正触发
    await w.vm.$nextTick()

    // 此刻 deleteSnapshot 的 promise 还没 resolve,遮罩应该已经挂上了。
    const overlay = document.body.querySelector('.kvm-progress-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay!.querySelector('.kvm-progress-title')?.textContent).toContain('正在删除快照')
    expect(overlay!.querySelector('.kvm-progress-msg')?.textContent).toBe('before-upgrade 删除中...')

    resolveDelete()
    await flush()
    await w.vm.$nextTick()
    expect(document.body.querySelector('.kvm-progress-overlay')).toBeNull()
    expect(api.deleteSnapshot).toHaveBeenCalledWith('vm-1', 'snap-1')
    expect(useToast().toasts.map((x) => x.text)).toContain('before-upgrade 已删除')
    expect(document.body.querySelector('.cv-empty-state')?.textContent).toContain('暂无快照') // 本地过滤后为空
    w.unmount()
  })

  // 评审修复:delete/restore 失败原先走 toast,但全局 toast 是 z-index:60
  // (src/components/AppToast.vue:12 `.toast-stack`),KVM 弹窗遮罩是 z-index:900、
  // 内容 901(KvmDialog.vue:23 默认 zBase:900 + :33/:36),60 < 900——删除/恢复只可能在
  // 设置弹窗打开时发生,toast 会被弹窗遮罩完全盖住,用户看不见。改成内联显示在
  // SnapshotsTab 自己的 `.cv-error`(经 KvmPage 的 snapCreateError → VmSettingsDialog 的
  // snapshotSubmitError prop → SnapshotsTab 的 submitError prop 透传)。
  it('删除失败 → .cv-error 内联显示后端 message,设置弹窗不关,不弹 toast', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.getSnapshots.mockResolvedValue([
      { id: 'snap-1', vmId: 'vm-1', name: 'before-upgrade', description: '', state: 'complete', createdAt: '' },
    ])
    api.deleteSnapshot.mockRejectedValue(new Error('snapshot is in use'))
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSnapshotsTab(w)
    // 先确认无错误时 .cv-error 不存在——这样下面出现的那条红字只能由这次删除失败解释,
    // 不会跟"页面本来就带着一条不相关的 .cv-error"这种混淆因素搞混。
    expect(document.body.querySelector('.cv-error')).toBeNull()

    const delBtn = () => document.body.querySelector('.cv-btn-delete') as HTMLElement
    delBtn().click()
    await w.vm.$nextTick()
    delBtn().click()
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.kvm-progress-overlay')).toBeNull()
    expect(document.body.querySelector('.cv-error')?.textContent).toBe('snapshot is in use')
    expect(document.body.querySelector('.create-vm-title')).not.toBeNull() // 弹窗没关
    expect(useToast().toasts).toEqual([]) // 失败不弹 toast
    w.unmount()
  })

  it('恢复失败 → .cv-error 内联显示后端 message,设置弹窗不关,不弹 toast', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.getSnapshots.mockResolvedValue([
      { id: 'snap-1', vmId: 'vm-1', name: 'before-upgrade', description: '', state: 'complete', createdAt: '' },
    ])
    api.restoreSnapshot.mockRejectedValue(new Error('domain snapshot not found'))
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSnapshotsTab(w)
    expect(document.body.querySelector('.cv-error')).toBeNull() // 同上,排除混淆

    const restoreBtn = () => document.body.querySelector('.cv-btn-restore') as HTMLElement
    restoreBtn().click()
    await w.vm.$nextTick()
    restoreBtn().click()
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.kvm-progress-overlay')).toBeNull()
    expect(document.body.querySelector('.cv-error')?.textContent).toBe('domain snapshot not found')
    expect(document.body.querySelector('.create-vm-title')).not.toBeNull() // 弹窗没关(与成功分支的"关弹窗"相对)
    expect(useToast().toasts).toEqual([])
    w.unmount()
  })

  it('恢复二次确认通过(VM 已停止)→ 挂进度遮罩(标题/正文照 Vue2 拼法),成功弹 toast「name 已恢复」且关闭整个设置弹窗', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.getSnapshots.mockResolvedValue([
      { id: 'snap-1', vmId: 'vm-1', name: 'before-upgrade', description: '', state: 'complete', createdAt: '' },
    ])
    let resolveRestore: () => void = () => {}
    api.restoreSnapshot.mockImplementation(() => new Promise<void>((r) => { resolveRestore = () => r(undefined) }))
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSnapshotsTab(w)

    const restoreBtn = () => document.body.querySelector('.cv-btn-restore') as HTMLElement
    restoreBtn().click() // 第一次:只变确认文字(恢复按钮此刻 vmState==='stopped',可点)
    await w.vm.$nextTick()
    restoreBtn().click() // 第二次:真正触发
    await w.vm.$nextTick()

    const overlay = document.body.querySelector('.kvm-progress-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay!.querySelector('.kvm-progress-title')?.textContent).toContain('正在恢复快照')
    expect(overlay!.querySelector('.kvm-progress-msg')?.textContent).toBe('before-upgrade 恢复中...')

    resolveRestore()
    await flush()
    await w.vm.$nextTick()
    expect(document.body.querySelector('.kvm-progress-overlay')).toBeNull()
    expect(api.restoreSnapshot).toHaveBeenCalledWith('vm-1', 'snap-1')
    expect(useToast().toasts.map((x) => x.text)).toContain('before-upgrade 已恢复')
    // 恢复成功后关掉整个设置弹窗(照 Vue2 :1282)。
    expect(document.body.querySelector('.create-vm-title')).toBeNull()
    w.unmount()
  })

  // P6 Task 11 收尾补的回归测试(评审 Minor d):KvmPage.vue 的 case 'settings' 分支里有
  // 一句 `snapCreateError.value = ''`,清掉上一轮快照操作留下的报错残留——这句本身没有
  // 单测覆盖过。判别力设计:先在**不关闭**设置弹窗的情况下确认那条 `.cv-error` 确实还在
  // (与上面「删除失败」那条用例是同一断言,不是新写法),这样才能排除"错误本来就会自己
  // 消失"这个混淆因素;再关闭弹窗、重新打开并切到快照 tab,断言旧的 `.cv-error` 不再
  // 出现——如果把 `snapCreateError.value = ''` 那一行删掉,这条用例会失败(旧错误残留)。
  it('设置弹窗重新打开会清掉上一轮快照操作的报错残留(评审 Minor d)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.getSnapshots.mockResolvedValue([
      { id: 'snap-1', vmId: 'vm-1', name: 'before-upgrade', description: '', state: 'complete', createdAt: '' },
    ])
    api.deleteSnapshot.mockRejectedValue(new Error('snapshot is in use'))
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSnapshotsTab(w)

    const delBtn = () => document.body.querySelector('.cv-btn-delete') as HTMLElement
    delBtn().click() // 第一次:只变确认文字
    await w.vm.$nextTick()
    delBtn().click() // 第二次:真正触发删除,后端拒绝
    await flush()
    await w.vm.$nextTick()

    // 先确认:不关弹窗的话,这条错误确实还留在页面上——排除"错误本来就会自己消失"
    // 这个混淆因素,下面重新打开后的"消失了"才能归因于 case 'settings' 那句清空。
    expect(document.body.querySelector('.cv-error')?.textContent).toBe('snapshot is in use')

    ;(document.body.querySelector('.create-vm-close') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()
    expect(document.body.querySelector('.create-vm-title')).toBeNull() // 弹窗确实关了

    await openSnapshotsTab(w)
    expect(document.body.querySelector('.cv-error')).toBeNull() // 旧报错没有跟着重新打开露出来
    w.unmount()
  })
})

describe('SP16 Task 6:重开 OS 选择器时列表要刷新', () => {
  it('每次打开都重拉 ISO 列表(Vue2 每次 visible:true 都拉)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    const w = mountPage()
    await flush()
    const before = api.getISOList.mock.calls.length

    // 直接驱动页面自己的开关 ref —— 打开 OS 选择器的入口藏在创建弹窗内部,
    // 经它点进去会把「创建流程」也拖进这条用例,断言的东西就不纯粹了。
    const page = w.vm as unknown as { osSelectorOpen: boolean }
    page.osSelectorOpen = true
    await flush()
    page.osSelectorOpen = false
    await flush()
    page.osSelectorOpen = true
    await flush()

    expect(api.getISOList.mock.calls.length).toBeGreaterThan(before + 1)
    w.unmount()
  })
})

describe('SP16 Task 7:eject 失败不能弹成功提示', () => {
  it('eject 在途时离开页面,之后失败不再弹「已弹出」', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: false, iso: '/data/alpine.iso' })],
      total: 1,
    })
    let reject!: (e: unknown) => void
    api.setBootFromDisk.mockReturnValue(new Promise((_, rj) => { reject = rj }))
    const w = mountPage()
    await flush()
    const toast = useToast()

    await w.get('.banner-btn').trigger('click')  // eject 发出,还没 resolve
    w.unmount()                                  // 请求在途时整页跳走
    reject(new Error('boom'))                    // 之后才失败
    await flush()

    // 文案取自 zh_cn.sp9.ts:458 的字面量(kvmEjectSuccess),不是自己编的。
    // toast 容器挂在 App.vue 层、比本页活得久 ⇒ 这条提示用户真的看得见。
    expect(toast.toasts.map((x) => x.text))
      .not.toContain('光盘已弹出，虚拟机将在下次重启时从硬盘引导。')
  })
})
