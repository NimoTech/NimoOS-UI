import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import VmSettingsDialog from './VmSettingsDialog.vue'
import { i18n } from '../../i18n'
import type { SelectedOs } from './OsSelector.vue'
import type { KvmVM } from '@nimotech/nimoos-service'

// Real device 2026-08-03 curl data (brief-specified, not hand-coded).
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
// Same pattern as CreateVmDialog.test.ts / KvmGlobalSettingsDialog.test.ts: in reka-ui 2.10,
// DialogPortal/DialogContent on first mount requires waiting for the next microtask (nextTick)
// before the content is actually rendered into document.body.
const mk = async (props: Record<string, unknown> = {}) => {
  w = mount(VmSettingsDialog, {
    props: {
      open: true, vm: VM(), host: HOST, selectedOs: null, saving: false, submitError: '',
      // P6 Task 10: Three props required by the default slot content of snapshots tab (real SnapshotsTab).
      snapshots: [], snapshotsBusy: false, snapshotSubmitError: '',
      ...props,
    },
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
  // Coverage point 1: title
  it('Title is "VM Settings - <vm.name>"', async () => {
    await mk({ vm: VM({ name: 'sp9-alpine-test' }) })
    expect(q('.create-vm-title').textContent).toContain('虚拟机设置 - sp9-alpine-test')
  })

  // Coverage point 2: two tabs, general highlighted by default; clicking snapshots emits tab-change and renders snapshots slot
  it('Two tab buttons, general highlighted by default; clicking snapshots emits tab-change and renders snapshots slot content', async () => {
    const wr = mount(VmSettingsDialog, {
      props: {
        open: true, vm: VM(), host: HOST, selectedOs: null, saving: false, submitError: '',
        snapshots: [], snapshotsBusy: false, snapshotSubmitError: '',
      },
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
    // v-show does not remove the element from DOM, only toggles display — use style.display to assert visibility,
    // cannot use querySelector presence check (querySelector finds elements with display:none too).
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

  // Coverage point 3: General refill (name/disk/memory/vcpu/networkMode/firmware), networkMode mapping
  it('General refill: name/disk/memory/vcpu grid/firmware from props.vm', async () => {
    await mk({ vm: VM({ name: 'my-vm', disk: 16, memory: 2048, vcpu: 3, firmware: 'uefi' }) })
    expect((q('input[name="name"]') as HTMLInputElement).value).toBe('my-vm')
    expect((q('input[name="disk"]') as HTMLInputElement).value).toBe('16')
    expect((q('input[name="memory"]') as HTMLInputElement).value).toBe('2048')
    // Assert total grid count (=host.cpuCores=6) rather than just active count — combined with the
    // "no grids rendered when cpuCores=0" test below, this truly distinguishes between "correctly
    // render by host.cpuCores" and "hardcoded grid count" implementations (otherwise the cpuCores=0
    // test would falsely pass on any broken implementation that always renders 0 grids).
    expect(qa('.cv-cpu-btn')).toHaveLength(6)
    expect(qa('.cv-cpu-btn').filter((c) => c.classList.contains('active')).length).toBe(3)
    // Firmware assertion uses uefi (non-default value bios) — avoid tautology assertion "default is bios" (hard constraint 15).
    const [uefiBtn, biosBtn] = qa('.cv-firmware-btn')
    expect(uefiBtn.classList.contains('active')).toBe(true)
    expect(biosBtn.classList.contains('active')).toBe(false)
  })

  it('networkMode mapping: bridge+networkInterface → refill NIC name; bridge+empty networkInterface → refill nat; nat → refill nat (per Vue2 :1215)', async () => {
    const bridged = await mk({ vm: VM({ networkMode: 'bridge', networkInterface: 'enp2s0' }) })
    expect((q('.cv-select-native') as HTMLSelectElement).value).toBe('enp2s0')
    bridged.unmount()

    const bridgedNoIface = await mk({ vm: VM({ networkMode: 'bridge', networkInterface: '' }) })
    expect((q('.cv-select-native') as HTMLSelectElement).value).toBe('nat')
    bridgedNoIface.unmount()

    await mk({ vm: VM({ networkMode: 'nat', networkInterface: 'virbr0' }) })
    expect((q('.cv-select-native') as HTMLSelectElement).value).toBe('nat')
  })

  // Coverage point 4: disk input disabled, label shows used percentage; both 0 and non-0 values
  it('Disk input disabled, shows Math.round(diskUsedPercent)% used next to it', async () => {
    const wr = await mk({ vm: VM({ diskUsedPercent: 0 }) })
    expect((q('input[name="disk"]') as HTMLInputElement).disabled).toBe(true)
    expect(q('.cv-hint').textContent).toContain('0% 已使用')
    wr.unmount()

    await mk({ vm: VM({ diskUsedPercent: 42.6 }) })
    expect(q('.cv-hint').textContent).toContain('43% 已使用')
  })

  // Coverage point 5: ISO row shows path/placeholder, clicking emits open-os-selector
  it('ISO row: shows path when set, shows placeholder when empty; clicking emits open-os-selector', async () => {
    const withIso = await mk({ vm: VM({ iso: '/DATA/KVM/isos/alpine-319.iso' }) })
    expect(q('.cv-iso-btn').textContent).toContain('/DATA/KVM/isos/alpine-319.iso')
    withIso.unmount()

    const noIso = await mk({ vm: VM({ iso: '', bootFromDisk: true }) })
    expect(q('.cv-iso-btn').textContent).toContain('未挂载 ISO')
    q('.cv-iso-btn').click()
    await noIso.vm.$nextTick()
    expect(noIso.emitted('open-os-selector')).toHaveLength(1)
  })

  // Coverage point 6: eject/mount dual-state button
  it('bootFromDisk=false shows "Eject" button, clicking toggles to disk boot and clears iso', async () => {
    const wr = await mk({ vm: VM({ bootFromDisk: false, iso: '/DATA/KVM/isos/alpine-319.iso' }) })
    const eject = q('.cv-iso-eject')
    expect(eject.getAttribute('aria-label')).toBe('弹出 ISO')
    eject.click()
    await wr.vm.$nextTick()
    // After bootFromDisk flips, button should change to "Mount" state and ISO row shows placeholder (iso cleared) —
    // these two observable effects together prove that both `bootFromDisk=true; iso=''` were executed.
    expect(q('.cv-iso-eject').getAttribute('aria-label')).toBe('挂载 ISO')
    expect(q('.cv-iso-btn').textContent).toContain('未挂载 ISO')
  })

  it('bootFromDisk=true shows "Mount" button, clicking emits open-os-selector', async () => {
    const wr = await mk({ vm: VM({ bootFromDisk: true, iso: '' }) })
    const mountBtn = q('.cv-iso-eject')
    expect(mountBtn.getAttribute('aria-label')).toBe('挂载 ISO')
    mountBtn.click()
    await wr.vm.$nextTick()
    expect(wr.emitted('open-os-selector')).toHaveLength(1)
  })

  // Coverage point 7: after selecting OS, iso becomes new path, bootFromDisk becomes false
  it('After selecting OS, iso becomes new path, bootFromDisk becomes false (per Vue2 :1380-1381)', async () => {
    const wr = await mk({ vm: VM({ bootFromDisk: true, iso: '' }) })
    expect(q('.cv-iso-eject').getAttribute('aria-label')).toBe('挂载 ISO') // Starting point: disk boot state
    await wr.setProps({ selectedOs: OS({ path: '/DATA/KVM/isos/debian-13.iso' }) })
    expect(q('.cv-iso-btn').textContent).toContain('/DATA/KVM/isos/debian-13.iso')
    expect(q('.cv-iso-eject').getAttribute('aria-label')).toBe('弹出 ISO') // bootFromDisk changed back to false
  })

  // Coverage point 8: both firmware buttons disabled, active class correctly reflects vm.firmware
  it('Both firmware buttons disabled, active correctly reflects vm.firmware (using non-default value uefi, avoid tautology)', async () => {
    await mk({ vm: VM({ firmware: 'uefi' }) })
    const [uefiBtn, biosBtn] = qa('.cv-firmware-btn')
    expect(uefiBtn.hasAttribute('disabled')).toBe(true)
    expect(biosBtn.hasAttribute('disabled')).toBe(true)
    expect(uefiBtn.classList.contains('active')).toBe(true)
    expect(biosBtn.classList.contains('active')).toBe(false)
  })

  // Coverage point 9: submit payload
  it('Submit emits submit, payload contains 8 writable fields, networkMode calculation per Vue2 :1499-1500', async () => {
    const wr = await mk({ vm: VM({
      name: 'sp9-alpine-test', vcpu: 2, memory: 1024, disk: 8,
      iso: '/DATA/KVM/isos/alpine-319.iso', bootFromDisk: false, firmware: 'bios',
      networkMode: 'nat', networkInterface: 'virbr0',
    }) })
    await setVal(wr, 'input[name="name"]', 'renamed-vm')
    const sel = q('.cv-select-native') as HTMLSelectElement
    sel.value = 'enp4s0'; sel.dispatchEvent(new Event('change')); await wr.vm.$nextTick()
    // P6 Task 10 onwards: `.cv-primary-btn` is no longer unique — the "Create" button in the snapshots-body default slot
    // (real SnapshotsTab) also has this class, and v-show doesn't remove from DOM, so bare `.cv-primary-btn`
    // hits it first (DOM order before footer). Must qualify within `.create-vm-foot` container to target
    // the General tab "Save" button.
    q('.create-vm-foot .cv-primary-btn').click()
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

  // Coverage point 10: when saving=true, save button is is-loading and unclickable (use valid form to exclude validation failure confusion —
  // component has no validation failure branch, but first prove saving=false can submit, excluding "form itself broken"
  // confusion, then prove saving=true on same form doesn't submit, solely attributing to this guard).
  it('When saving=true, main button is is-loading and unclickable (prevent double submit)', async () => {
    const ok = await mk({ saving: false })
    // Same as coverage point 9 note: qualify within footer container, avoid accidentally clicking
    // SnapshotsTab "Create" button in snapshots-body default slot (also .cv-primary-btn).
    q('.create-vm-foot .cv-primary-btn').click()
    await ok.vm.$nextTick()
    expect(ok.emitted('submit')).toHaveLength(1)
    ok.unmount()

    const busy = await mk({ saving: true })
    const btn = q('.create-vm-foot .cv-primary-btn') as HTMLButtonElement
    expect(btn.classList.contains('is-loading')).toBe(true)
    // Native disabled already blocks `.click()` — use dispatchEvent to bypass native interception,
    // to test the JS-level guard `if (props.saving) return` inside onSubmit().
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await busy.vm.$nextTick()
    expect(busy.emitted('submit')).toBeUndefined()
  })

  // Coverage point 11: submitError shown inline, dialog doesn't close
  it('submitError shown in .cv-error, dialog stays open (hard constraint 7)', async () => {
    const wr = await mk({ submitError: 'domain name already exists' })
    expect(q('.cv-error').textContent).toContain('domain name already exists')
    expect(wr.emitted('update:open')).toBeUndefined()
  })

  // Coverage point 12: when reopening, form refills from props.vm, no stale values retained
  it('When reopening, form refills from props.vm (no stale values from previous session)', async () => {
    const wr = await mk({ vm: VM({ name: 'original-name' }) })
    await setVal(wr, 'input[name="name"]', 'dirty-value')
    await wr.setProps({ open: false })
    await wr.setProps({ open: true })
    expect((q('input[name="name"]') as HTMLInputElement).value).toBe('original-name')
  })

  // Coverage point 13: no CPU grids rendered when host.cpuCores=0
  it('No CPU grids rendered when host.cpuCores=0', async () => {
    await mk({ host: { ...HOST, cpuCores: 0 } })
    expect(qa('.cv-cpu-btn')).toHaveLength(0)
  })

  // Global Constraint #16: component holds local edit copy (form), and useVmList.update after success writes
  // back to selected VM object — so "edit → cancel (no submit)" must never pollute props.vm.
  it('Global Constraint #16: after edit but clicking ✕ cancel, props.vm is not polluted', async () => {
    const vm = VM({ name: 'untouched-name', memory: 1024 })
    const wr = await mk({ vm })
    await setVal(wr, 'input[name="name"]', 'edited-but-cancelled')
    expect((q('input[name="name"]') as HTMLInputElement).value).toBe('edited-but-cancelled') // Verify edit took effect
    q('.create-vm-close').click() // Trigger ✕ close, not through save
    await wr.vm.$nextTick()
    expect(vm.name).toBe('untouched-name') // Shared object not polluted
    expect(vm.memory).toBe(1024)
  })

  // Review Important convention (repo convention): footer shown only in general tab (per Vue2 :387).
  // From P6 Task 10 onwards: assertions qualified within `.create-vm-foot` container — bare `.cv-primary-btn`
  // would hit the "Create" button of SnapshotsTab in snapshots-body (v-show does not remove from DOM, so
  // after switching to snapshots tab that button still exists); only the footer container itself
  // disappears entirely via `v-if="activeTab==='general'"`.
  it('Footer buttons disappear when switching to snapshots tab', async () => {
    const wr = await mk()
    expect(q('.create-vm-foot .cv-primary-btn')).not.toBeNull()
    qa('.settings-tab')[1].click()
    await wr.vm.$nextTick()
    expect(q('.create-vm-foot .cv-primary-btn')).toBeNull()
  })

  // P6 Task 10: snapshots-body default slot content is the real SnapshotsTab, five props/emit
  // pass through as-is. This only verifies "pass-through wiring is correct" (props reach target, emit forwards
  // correctly); SnapshotsTab's own behavior is covered in SnapshotsTab.test.ts, not repeated here.
  describe('P6 Task 10: snapshots slot default content = real SnapshotsTab, props/emit pass through as-is', () => {
    it('snapshots/snapshotsBusy/snapshotSubmitError reach SnapshotsTab corresponding props', async () => {
      const wr = await mk({
        vm: VM({ state: 'stopped' }),
        snapshots: [{ id: 's1', vmId: 'e939191c-2bd2-4f14-88c9-0bf05d3b4d40', name: 'snap-a', description: '', state: 'complete', createdAt: '2026-08-03T10:00:00Z' }],
        snapshotsBusy: true,
        snapshotSubmitError: 'boom',
      })
      qa('.settings-tab')[1].click()
      await wr.vm.$nextTick()
      // vmState='stopped' reaches SnapshotsTab → restore button clickable (not disabled).
      expect((q('.cv-btn-restore') as HTMLButtonElement).disabled).toBe(false)
      // snapshots reaches target → renders one item, not empty state.
      expect(q('.cv-empty-state')).toBeNull()
      expect(q('.cv-snapshot-name')!.textContent).toContain('snap-a')
      // snapshotsBusy reaches SnapshotsTab's busy prop → create button is-loading.
      expect(q('.snapshots-body .cv-primary-btn')!.classList.contains('is-loading')).toBe(true)
      // snapshotSubmitError reaches submitError prop → shown inline.
      expect(q('.snapshots-body .cv-error')!.textContent).toBe('boom')
    })

    it('SnapshotsTab emit create/confirm-delete/confirm-restore pass through as-is to create-snapshot/confirm-delete-snapshot/confirm-restore-snapshot', async () => {
      const snap = { id: 's1', vmId: 'e939191c-2bd2-4f14-88c9-0bf05d3b4d40', name: 'snap-a', description: '', state: 'complete', createdAt: '' }
      const wr = await mk({ vm: VM({ state: 'stopped' }), snapshots: [snap] })
      qa('.settings-tab')[1].click()
      await wr.vm.$nextTick()

      await setVal(wr, 'input[name="snapshotName"]', 'new-snap')
      q('.snapshots-body .cv-primary-btn').click()
      await wr.vm.$nextTick()
      expect(wr.emitted('create-snapshot')![0]).toEqual([{ name: 'new-snap', description: '' }])

      q('.cv-btn-delete').click() // First click: enter pending-confirm state
      await wr.vm.$nextTick()
      q('.cv-btn-delete').click() // Second click: actually trigger
      await wr.vm.$nextTick()
      expect(wr.emitted('confirm-delete-snapshot')![0]).toEqual([snap])

      q('.cv-btn-restore').click()
      await wr.vm.$nextTick()
      q('.cv-btn-restore').click()
      await wr.vm.$nextTick()
      expect(wr.emitted('confirm-restore-snapshot')![0]).toEqual([snap])
    })
  })
})
