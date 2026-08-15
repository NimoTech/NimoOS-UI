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
  // P6 Task 9: VM settings dialog wiring needs updateVM.
  updateVM: vi.fn(),
  // P6 Task 10: snapshots tab wiring needs four methods.
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
    await stopBtn.trigger('click') // first click: only change confirmation text
    await w.findAll('.dropdown-item').find((b) => b.text().includes('你确定吗？'))!.trigger('click') // second click: actually trigger

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
    api.startVM.mockRejectedValue(new Error('domain busy')) // create residual lastError
    api.getVNC.mockRejectedValue(new Error('irrelevant')) // any connect() will fail
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
    expect(document.body.querySelector('.create-vm-title')).toBeNull() // close dialog
    expect(useToast().toasts.map((x) => x.text)).toContain('虚拟机创建成功')
    expect(api.getVMList).toHaveBeenCalledTimes(2) // mounted once + refresh once after create success
    w.unmount()
  })

  it('submit fails → dialog stays open, show backend message inline', async () => {
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

    expect(document.body.querySelector('.create-vm-title')?.textContent).toContain('创建新虚拟机') // not closed
    expect(document.body.querySelector('.cv-error')?.textContent).toBe('domain name already exists')
    expect(useToast().toasts).toEqual([]) // hard constraint 3: inline error inside a dialog must not toast
    w.unmount()
  })

  // Review additional test (gap reported in findings): create()'s errText fallback branch (rejection not
  // Error instance, can't get message falls back to i18n key 'kvmFailedToCreate') previously only
  // verified in useVmList.test.ts "returned string is key", no test reached KvmPage layer —
  // `err && te(err) ? t(err) : err` decision in onCreateSubmit specifically to not pass bare key to
  // .cv-error, add coverage here, avoid this decision becoming "written but never verified" code.
  it('submit fails with backend rejection non-Error value (can\'t get message) → show translated Chinese inline, not key name', async () => {
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

    api.createVM.mockRejectedValue('boom') // non-Error value reject → useVmList.errText() takes fallback key
    ;(document.body.querySelector('.cv-primary-btn') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()

    const err = document.body.querySelector('.cv-error')?.textContent
    expect(err).toBe('创建虚拟机失败') // kvmFailedToCreate translated Chinese, not key name itself
    expect(err).not.toContain('kvmFailedToCreate')
    w.unmount()
  })

  // Review Important #1: `creating.value = true/false` in `onCreateSubmit` previously had zero discriminative power —
  // deleting the whole line current test suite still all green. Add here: let `api.createVM` return manually
  // controlled pending Promise, verify mid-submit button disabled/is-loading, second click won't call `createVM`
  // twice, after resolution button resumes enabled. Use **rejection** not success to resolve — success would make
  // `onCreateSubmit` also set `createOpen` to false, close/unmount dialog, after DOM nodes removed "button resumes"
  // assertion has no meaning; failure branch leaves dialog, can verify button state truly resets while dialog exists.
  //
  // ⚠️ Global Constraint #15 "confused assertion" self-check (review-named pit, Task 7 already hit once):
  // form must be **valid** (already `openCreateAndPickIso` + `clickSelectAlpine` + `fillName` filled
  // name/iso/os), otherwise `validateCreateVm` independently blocks second click, doesn't emit submit,
  // can't tell if second call was blocked by `creating` guard or validation — use valid form exclude this confusion,
  // if second click doesn't actually call `api.createVM`, can only attribute to `creating` guard.
  it('mid-submit button disabled/is-loading, second click won\'t repeat call createVM, after resolution resumes enabled', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    api.getISOList.mockResolvedValue([ISO_ALPINE])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()

    await openCreateAndPickIso(w)
    clickSelectAlpine()
    await flush()
    await w.vm.$nextTick()
    fillName('p6-throwaway') // valid form — comment above explains why can't skip
    await w.vm.$nextTick()

    let rejectCreate: (e: unknown) => void = () => {}
    api.createVM.mockReturnValue(new Promise((_resolve, reject) => { rejectCreate = reject }))

    const btn = document.body.querySelector('.cv-primary-btn') as HTMLButtonElement
    btn.click() // first click, createVM suspended not resolved
    await flush()
    await w.vm.$nextTick()

    expect(api.createVM).toHaveBeenCalledTimes(1)
    expect(btn.disabled).toBe(true)
    expect(btn.classList.contains('is-loading')).toBe(true)

    // second click: native `disabled` attribute itself blocks `.click()` (jsdom same as real browser,
    // CreateVmDialog.test.ts verified with minimal repro script), must use `dispatchEvent` bypass platform-level
    // interception, to really test `if (props.creating) return` JS guard inside `onSubmit()`,
    // not blocked by browser's disabled semantics (that wouldn't test this guard).
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
    await w.vm.$nextTick()
    expect(api.createVM).toHaveBeenCalledTimes(1) // still only first time

    rejectCreate(new Error('boom')) // use failure to resolve, dialog stays, can assert button resets while it exists
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.create-vm-title')).not.toBeNull() // dialog still open
    expect(btn.disabled).toBe(false)
    expect(btn.classList.contains('is-loading')).toBe(false)
    w.unmount()
  })

  // Review regression test for real bug fixed: KvmGlobalSettingsDialog and KvmPage each hold independent
  // useKvmHostInfo() instances (Task 2 isolation design, see KvmGlobalSettingsDialog.vue top and
  // KvmPage.vue `@saved` comment). After save global settings succeeds, if KvmPage's hostInfo
  // doesn't refetch, create dialog defaults stay at pre-save old values — here walk complete real path to verify fix.
  //
  // ⚠️ Global Constraint #15 "confused assertion" self-check: asserts "before vs after click save"
  // `api.getSettings` call count change (2 → 3), not just "called getSettings" —
  // call #1 from KvmPage's own hostInfo.fetch() at mount, call #2 from its own host.fetch() when opening global
  // settings dialog (both happen **before** "click save", use mid assertion explicitly note them, exclude them,
  // don't let them mix into "save-caused call"). This test period no MessageBus events, no VM selection switch —
  // no other known mechanism calls getSettings in this window, only thing lets count go 2→3 is `@saved`-triggered fetch.
  it('review fix: after save global settings, create dialog defaults refresh (no longer stuck at old)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    expect(api.getSettings).toHaveBeenCalledTimes(1) // mount: KvmPage's own hostInfo

    await w.get('.kvm-settings-btn').trigger('click') // open global settings dialog
    await flush()
    await w.vm.$nextTick()
    expect(api.getSettings).toHaveBeenCalledTimes(2) // dialog's own useKvmHostInfo() fetches again

    const vcpuInput = document.body.querySelector('input[name="defaultVcpu"]') as HTMLInputElement
    vcpuInput.value = '4'
    vcpuInput.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()

    // simulate backend save already persisted: subsequent getSettings calls return new value.
    api.getSettings.mockResolvedValue({
      autostart: false, availableDiskGB: 263, availableMemoryMB: 9234, cpuCores: 6,
      defaultDiskSize: 20, defaultMemory: 2048, defaultVcpu: 4,
      networkInterfaces: ['enp2s0', 'enp4s0', 'wlp1s0'], storagePath: '/DATA/KVM',
    })
    api.updateSettings.mockResolvedValue({})

    ;(document.body.querySelector('.cv-primary-btn') as HTMLElement).click() // global settings dialog's own save button
    await flush()
    await w.vm.$nextTick()

    // basic assertion: called one more time, can only be explained by @saved-triggered hostInfo.fetch() (see comment above).
    expect(api.getSettings).toHaveBeenCalledTimes(3)
    expect(document.body.querySelector('.create-vm-title')).toBeNull() // save success auto-closes global settings dialog

    // stronger assertion: open create dialog, CPU prefill reflects just-saved new value 4, not old 2 before save.
    await openCreateDialog(w)

    const activeCpuBtns = [...document.body.querySelectorAll('.cv-cpu-btn')]
      .filter((b) => b.classList.contains('active'))
    expect(activeCpuBtns).toHaveLength(4)
    w.unmount()
  })

  it('ISO download complete → toast「Debian 已下载」(text matches Vue2 :165 `${os.name} ${$t("downloaded")}`)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    api.getISOList.mockResolvedValue([ISO_DEBIAN()])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()

    emitBus('kvm:iso_download_complete', { iso_id: 'debian-13' })
    await flush()

    expect(useToast().toasts.map((x) => x.text)).toContain('Debian 已下载')
    w.unmount()
  })

  // Full-branch review fix A3 (previously the "download failed" toast was hidden behind OS selector's own
  // overlay, invisible to the user — changed to inline display inside OsSelector instead of a toast): open
  // the create dialog → open OsSelector (its overlay is now covering the screen, matching the real
  // scenario of a user watching download progress) → receive the download-failed event →
  // inline `.cv-error` shows, no toast.
  it('ISO download failed → OsSelector inline .cv-error shows「下载失败」, no toast (A3)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    api.getISOList.mockResolvedValue([ISO_DEBIAN()])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openCreateAndPickIso(w)
    expect(document.body.querySelector('.cv-error')).toBeNull() // exclude confusion: confirm no error yet at this point

    emitBus('kvm:iso_download_failed', { iso_id: 'debian-13' })
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.cv-error')?.textContent).toBe('下载失败')
    expect(useToast().toasts).toEqual([])
    w.unmount()
  })

  // Full-branch review fix A3: clear the previous failure error before starting a new download — otherwise
  // retrying the same/another ISO would leave the old red text stuck there, even though this download
  // itself hasn't produced a result yet.
  it('clears the previous download-failure error residue before starting a new download (A3)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    api.getISOList.mockResolvedValue([ISO_DEBIAN()])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openCreateAndPickIso(w)

    emitBus('kvm:iso_download_failed', { iso_id: 'debian-13' })
    await flush()
    await w.vm.$nextTick()
    expect(document.body.querySelector('.cv-error')?.textContent).toBe('下载失败') // first confirm the error really is still there

    const dlBtn = document.body.querySelector('.os-action-btn') as HTMLElement
    dlBtn.click()
    await flush()
    await w.vm.$nextTick()

    expect(api.downloadISO).toHaveBeenCalled() // the download call itself wasn't swallowed by this wrapper layer
    expect(document.body.querySelector('.cv-error')).toBeNull() // old error has been cleared
    w.unmount()
  })

  // Full-branch review fix A3: clear the error residue when closing the selector — otherwise reopening it
  // next time (even for the settings dialog) would carry over the previous, now-irrelevant old error.
  it('reopening OsSelector after closing it doesn\'t carry over the previous download-failure error (A3)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM()], total: 1 })
    api.getISOList.mockResolvedValue([ISO_DEBIAN()])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openCreateAndPickIso(w)

    emitBus('kvm:iso_download_failed', { iso_id: 'debian-13' })
    await flush()
    await w.vm.$nextTick()
    expect(document.body.querySelector('.cv-error')?.textContent).toBe('下载失败')

    // Close OsSelector (click its ✕), then reopen it once from the create dialog.
    const closeBtns = [...document.body.querySelectorAll('.create-vm-close')]
    ;(closeBtns[closeBtns.length - 1] as HTMLElement).click() // the topmost one (z 920) is OsSelector
    await flush()
    await w.vm.$nextTick()

    ;(document.body.querySelector('.cv-iso-btn') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.cv-error')).toBeNull()
    w.unmount()
  })

  it('clicking a card that is currently downloading → toast「请等待下载完成」', async () => {
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
    // Hard constraint (OsSelector.vue handleAction): clicking a card that is currently downloading should
    // only emit need-wait, and must not also close the dialog or trigger any other action — indirect
    // verification: the create dialog is still there.
    expect(document.body.querySelector('.create-vm-title')?.textContent).toContain('创建新虚拟机')
    w.unmount()
  })
})

// P6 Task 9: VM settings dialog wiring — gear icon unlocks → dialog pre-fills → save success/failure →
// OsSelector routes to the settings dialog instead of the create dialog (osSelectorTarget, sharing the
// same OsSelector instance with the create flow).
describe('KvmPage VM settings dialog wiring (P6 Task 9)', () => {
  const openSettings = async (w: VueWrapper): Promise<void> => {
    await w.get('.action-btn').trigger('click') // the gear icon is the first action-btn inside console-actions
    await flush()
    await w.vm.$nextTick()
  }

  it('clicking the gear pops the VM settings dialog, title and General form pre-fill the selected VM\'s current values', async () => {
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

  it('save success → calls updateVM(id, patch), closes the dialog, toasts「设置已保存」, selected VM\'s visible fields are written back', async () => {
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

    // Since P6 Task 10: `.cv-primary-btn` is no longer unique — the snapshots tab's default content
    // (the real SnapshotsTab) also has a "create" button with this class, and v-show doesn't remove it
    // from the DOM, so a bare selector would hit it first. Scoping to inside the `.create-vm-foot`
    // container is what makes it the General tab's "save" button.
    ;(document.body.querySelector('.create-vm-foot .cv-primary-btn') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()

    expect(api.updateVM).toHaveBeenCalledWith('vm-1', expect.objectContaining({ name: 'renamed-vm' }))
    expect(document.body.querySelector('.create-vm-title')).toBeNull() // dialog closed
    expect(useToast().toasts.map((x) => x.text)).toContain('设置已保存')
    // Direct evidence the write-back took effect: the console header's title (reads s.selectedVM.value.name)
    // updates along with it, no manual page refresh needed — this is the effect of useVmList.update()'s
    // Object.assign write-back after success.
    expect(w.get('.console-title h3').text()).toBe('renamed-vm')
    w.unmount()
  })

  it('save failure → dialog stays open, shows backend message inline (no toast)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.updateVM.mockRejectedValue(new Error('domain name already exists'))
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSettings(w)

    // Same as the comment above: scope to inside the `.create-vm-foot` container, to avoid mis-clicking
    // the "create" button in the snapshots tab's default content.
    ;(document.body.querySelector('.create-vm-foot .cv-primary-btn') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.create-vm-title')?.textContent).toContain('虚拟机设置') // not closed
    expect(document.body.querySelector('.cv-error')?.textContent).toBe('domain name already exists')
    expect(useToast().toasts).toEqual([])
    w.unmount()
  })

  // Real coverage of osSelectorTarget routing: the settings dialog and the create dialog share the same
  // page-level OsSelector instance. Opening OsSelector from the settings dialog and picking a result must
  // land in the settings dialog's own iso row, not leak over to the create dialog (which hasn't even been
  // opened at this point).
  it('clicking the ISO row in the settings dialog opens OsSelector, selection lands in the settings dialog (not the create dialog)', async () => {
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

    // OsSelector closes itself on selection, so at this point only the settings dialog's one
    // .create-vm-modal should remain (the create dialog was never opened).
    expect([...document.body.querySelectorAll('.create-vm-modal')]).toHaveLength(1)
    expect(document.body.querySelector('.create-vm-title')?.textContent).toContain('虚拟机设置')
    expect(document.body.querySelector('.cv-iso-btn')?.textContent)
      .toContain('/DATA/KVM/isos/alpine-319.iso')
    w.unmount()
  })

  // Full-branch review fix A2: vmSettingsOpen is a ref independent of `v-if="s.selectedVM.value"`.
  // When the selected VM is deleted elsewhere (another browser tab / CLI / another user), v-if unmounts
  // the dialog, but vmSettingsOpen itself stays true — next time any other VM is selected, v-if turns true
  // again and the dialog pops back up on its own, carrying this stale true. Discriminative design: first
  // prove that "before a new VM is selected, the dialog has indeed already disappeared because v-if
  // unmounted it" (excluding the confound of "the dialog was never actually closed"), then select a new
  // VM and assert it doesn't reappear on its own.
  it('review fix A2: after the VM is deleted elsewhere, selecting another VM doesn\'t pop the settings dialog back up with stale state', async () => {
    api.getVMList.mockResolvedValue({
      data: [
        VM({ id: 'vm-1', name: 'vm-x', state: 'stopped' }),
        VM({ id: 'vm-2', name: 'vm-y', state: 'stopped' }),
      ],
      total: 2,
    })
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    // Auto-selects the first VM in the list (vm-1), open its settings dialog.
    await openSettings(w)
    expect(document.body.querySelector('.create-vm-title')?.textContent).toContain('虚拟机设置')

    // vm-1 is deleted elsewhere — with vm_id, useVmList sets selectedVM straight to null and doesn't
    // auto-reselect another VM (useVmList.ts:141-149).
    emitBus('kvm:vm_deleted', { vm_id: 'vm-1' })
    await flush()
    await w.vm.$nextTick()
    // First confirm: at this point the dialog has indeed already disappeared (v-if unmounted it) —
    // it wasn't "never actually closed".
    expect(document.body.querySelector('.create-vm-title')).toBeNull()

    // Select another VM (only vm-2 remains in the list now).
    const items = w.findAll('.vm-list-item')
    expect(items).toHaveLength(1)
    await items[0].trigger('click')
    await flush()
    await w.vm.$nextTick()

    // Assert: the settings dialog didn't pop back up on its own carrying the stale vmSettingsOpen=true.
    expect(document.body.querySelector('.create-vm-title')).toBeNull()
    w.unmount()
  })
})

describe('KvmPage snapshots tab wiring (P6 Task 10)', () => {
  const openSettings = async (w: VueWrapper): Promise<void> => {
    await w.get('.action-btn').trigger('click') // the gear icon is the first action-btn inside console-actions
    await flush()
    await w.vm.$nextTick()
  }
  const openSnapshotsTab = async (w: VueWrapper): Promise<void> => {
    await openSettings(w)
    ;([...document.body.querySelectorAll('.settings-tab')][1] as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()
  }

  // Following Vue2 :250, the fetch only happens on tab click: right after the gear opens (General tab),
  // getSnapshots shouldn't have been called yet — it's only called after clicking the snapshots tab, and
  // then the list renders.
  it('clicking the snapshots tab → calls getSnapshots(vmId), renders the list', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.getSnapshots.mockResolvedValue([
      { id: 'snap-1', vmId: 'vm-1', name: 'before-upgrade', description: '升级前备份', state: 'complete', createdAt: '2026-08-03T10:00:00Z' },
    ])
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSettings(w)
    expect(api.getSnapshots).not.toHaveBeenCalled() // General tab shouldn't have fetched yet

    await openSnapshotsTab(w)
    expect(api.getSnapshots).toHaveBeenCalledWith('vm-1')
    expect(document.body.querySelector('.cv-snapshot-name')?.textContent).toContain('before-upgrade')
    w.unmount()
  })

  it('create snapshot success → calls createSnapshot, toasts「快照创建成功」, list refreshes once', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.getSnapshots
      .mockResolvedValueOnce([]) // first fetch on tab click: empty
      .mockResolvedValueOnce([ // fetches again after create succeeds: non-empty
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
    expect(api.getSnapshots).toHaveBeenCalledTimes(2) // one call from clicking the tab + one more after create succeeds
    expect(useToast().toasts.map((x) => x.text)).toContain('快照创建成功')
    expect(document.body.querySelector('.cv-snapshot-name')?.textContent).toContain('after-create')
    w.unmount()
  })

  it('create snapshot failure → shows backend message inline, no toast', async () => {
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
    expect(document.body.querySelector('.create-vm-title')).not.toBeNull() // dialog not closed
    w.unmount()
  })

  it('delete double-confirmation passed → shows progress overlay (title/body text matches Vue2), overlay removed on completion, success toasts「name 已删除」, list filtered locally', async () => {
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
    delBtn().click() // first click: only changes the confirmation text
    await w.vm.$nextTick()
    delBtn().click() // second click: actually triggers
    await w.vm.$nextTick()

    // At this point deleteSnapshot's promise hasn't resolved yet, the overlay should already be mounted.
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
    expect(document.body.querySelector('.cv-empty-state')?.textContent).toContain('暂无快照') // empty after local filtering
    w.unmount()
  })

  // Review fix: delete/restore failures used to go through toast, but the global toast is z-index:60
  // (src/components/AppToast.vue:12 `.toast-stack`), while the KVM dialog overlay is z-index:900, content
  // 901 (KvmDialog.vue:23 default zBase:900 + :33/:36), 60 < 900 — delete/restore can only happen while the
  // settings dialog is open, so the toast would be completely covered by the dialog overlay, invisible to
  // the user. Changed to display inline in SnapshotsTab's own `.cv-error` (threaded through via KvmPage's
  // snapCreateError → VmSettingsDialog's snapshotSubmitError prop → SnapshotsTab's submitError prop).
  it('delete failure → .cv-error shows backend message inline, settings dialog stays open, no toast', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.getSnapshots.mockResolvedValue([
      { id: 'snap-1', vmId: 'vm-1', name: 'before-upgrade', description: '', state: 'complete', createdAt: '' },
    ])
    api.deleteSnapshot.mockRejectedValue(new Error('snapshot is in use'))
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSnapshotsTab(w)
    // First confirm .cv-error doesn't exist when there's no error — this way the red text that appears
    // below can only be explained by this delete failure, and won't get confused with the confound of
    // "the page already had an unrelated .cv-error to begin with".
    expect(document.body.querySelector('.cv-error')).toBeNull()

    const delBtn = () => document.body.querySelector('.cv-btn-delete') as HTMLElement
    delBtn().click()
    await w.vm.$nextTick()
    delBtn().click()
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.kvm-progress-overlay')).toBeNull()
    expect(document.body.querySelector('.cv-error')?.textContent).toBe('snapshot is in use')
    expect(document.body.querySelector('.create-vm-title')).not.toBeNull() // dialog not closed
    expect(useToast().toasts).toEqual([]) // failure doesn't toast
    w.unmount()
  })

  it('restore failure → .cv-error shows backend message inline, settings dialog stays open, no toast', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.getSnapshots.mockResolvedValue([
      { id: 'snap-1', vmId: 'vm-1', name: 'before-upgrade', description: '', state: 'complete', createdAt: '' },
    ])
    api.restoreSnapshot.mockRejectedValue(new Error('domain snapshot not found'))
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSnapshotsTab(w)
    expect(document.body.querySelector('.cv-error')).toBeNull() // same as above, excludes confusion

    const restoreBtn = () => document.body.querySelector('.cv-btn-restore') as HTMLElement
    restoreBtn().click()
    await w.vm.$nextTick()
    restoreBtn().click()
    await flush()
    await w.vm.$nextTick()

    expect(document.body.querySelector('.kvm-progress-overlay')).toBeNull()
    expect(document.body.querySelector('.cv-error')?.textContent).toBe('domain snapshot not found')
    expect(document.body.querySelector('.create-vm-title')).not.toBeNull() // dialog not closed (contrasts with the success branch's "dialog closes")
    expect(useToast().toasts).toEqual([])
    w.unmount()
  })

  it('restore double-confirmation passed (VM stopped) → shows progress overlay (title/body text matches Vue2), success toasts「name 已恢复」and closes the entire settings dialog', async () => {
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
    restoreBtn().click() // first click: only changes the confirmation text (the restore button is clickable here since vmState==='stopped')
    await w.vm.$nextTick()
    restoreBtn().click() // second click: actually triggers
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
    // Closes the entire settings dialog after restore succeeds (per Vue2 :1282).
    expect(document.body.querySelector('.create-vm-title')).toBeNull()
    w.unmount()
  })

  // Regression test added at the tail end of P6 Task 11 (review Minor d): KvmPage.vue's case 'settings'
  // branch has a line `snapCreateError.value = ''` that clears the error residue left over from the
  // previous snapshot operation — this line itself was never covered by a unit test. Discriminative
  // design: first confirm the `.cv-error` is indeed still there **without closing** the settings dialog
  // (the same assertion as the "delete failure" test above, not a new pattern), so the confound of "the
  // error would disappear on its own anyway" can be excluded; then close the dialog, reopen it, switch to
  // the snapshots tab, and assert the old `.cv-error` no longer appears — deleting the
  // `snapCreateError.value = ''` line would make this test fail (old error residue).
  it('reopening the settings dialog clears the error residue from the previous snapshot operation (review Minor d)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'stopped' })], total: 1 })
    api.getSnapshots.mockResolvedValue([
      { id: 'snap-1', vmId: 'vm-1', name: 'before-upgrade', description: '', state: 'complete', createdAt: '' },
    ])
    api.deleteSnapshot.mockRejectedValue(new Error('snapshot is in use'))
    const w = mount(KvmPage, { global: { plugins: [i18n] }, attachTo: document.body })
    await flush()
    await openSnapshotsTab(w)

    const delBtn = () => document.body.querySelector('.cv-btn-delete') as HTMLElement
    delBtn().click() // first click: only changes the confirmation text
    await w.vm.$nextTick()
    delBtn().click() // second click: actually triggers the delete, backend rejects it
    await flush()
    await w.vm.$nextTick()

    // First confirm: without closing the dialog, this error really is still on the page — this excludes
    // the confound of "the error would disappear on its own anyway", so the "disappeared" after reopening
    // below can be attributed to the case 'settings' clear line.
    expect(document.body.querySelector('.cv-error')?.textContent).toBe('snapshot is in use')

    ;(document.body.querySelector('.create-vm-close') as HTMLElement).click()
    await flush()
    await w.vm.$nextTick()
    expect(document.body.querySelector('.create-vm-title')).toBeNull() // dialog really did close

    await openSnapshotsTab(w)
    expect(document.body.querySelector('.cv-error')).toBeNull() // old error didn't resurface after reopening
    w.unmount()
  })
})

describe('SP16 Task 6: the list must refresh when reopening the OS selector', () => {
  it('refetches the ISO list every time it opens (Vue2 fetches every time visible:true)', async () => {
    api.getVMList.mockResolvedValue({ data: [VM({ id: 'vm-1', state: 'running' })], total: 1 })
    const w = mountPage()
    await flush()
    const before = api.getISOList.mock.calls.length

    // Drive the page's own toggle ref directly — the entry point for opening the OS selector is hidden
    // inside the create dialog, and clicking through it would drag the "create flow" into this test too,
    // making the assertion less pure.
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

describe('SP16 Task 7: eject failure must not pop a success toast', () => {
  it('leaving the page while eject is in flight, a later failure no longer toasts「已弹出」', async () => {
    api.getVMList.mockResolvedValue({
      data: [VM({ id: 'vm-1', state: 'running', bootFromDisk: false, iso: '/data/alpine.iso' })],
      total: 1,
    })
    let reject!: (e: unknown) => void
    api.setBootFromDisk.mockReturnValue(new Promise((_, rj) => { reject = rj }))
    const w = mountPage()
    await flush()
    const toast = useToast()

    await w.get('.banner-btn').trigger('click')  // eject sent, not resolved yet
    w.unmount()                                  // whole page navigates away while the request is in flight
    reject(new Error('boom'))                    // fails only afterward
    await flush()

    // Text is taken from the literal in zh_cn.sp9.ts:458 (kvmEjectSuccess), not made up.
    // The toast container is mounted at the App.vue level and outlives this page ⇒ this message would
    // really be visible to the user.
    expect(toast.toasts.map((x) => x.text))
      .not.toContain('光盘已弹出，虚拟机将在下次重启时从硬盘引导。')
  })
})
