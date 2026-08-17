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
// Fix (fixture missing field, see comment at top of component "brief test code issue" #2):
// alpine-319 is the default SelectedOs.id produced by the OS() factory. In the real flow,
// this id must be able to find the same record in the page-level isos list (OsSelector's
// SelectedOs.id is selected from isos in the first place) — watch(osTemplate) relies on
// this record to re-derive osType/firmware/os display names consistently. The brief draft
// used OS() in two places but left isos empty, causing osTemplate linking to fail to find
// the template and be forced into the "no-op if not found" branch (1:1 mirrors Vue2 :731
// behavior), leaving form.os/osType stuck at values set elsewhere. Among all tests, only
// the following one asserts os/osType by full value equality (toEqual), so this fixture
// must be completed for that test to be meaningful.
const ISO_ALPINE: KvmISO = {
  id: 'alpine-319', name: 'Alpine', version: '3.19', category: 'linux', size: '60 MB',
  status: 'downloaded', progress: 0, path: '/DATA/KVM/isos/alpine-319.iso',
  recommendedVcpu: 1, recommendedMemory: 512, minMemory: 256, minDisk: 2,
}

let w: VueWrapper | null = null
// Fix (brief test code defect #3, reported): the brief draft had `mk` as a synchronous
// function, querying document.body immediately after mounting. The reka-ui 2.10
// DialogPortal/DialogContent in this repo requires waiting for the next microtask (nextTick)
// before content actually lands in document.body. Tasks 1 (KvmDialog.test.ts) /
// Task 2 (KvmGlobalSettingsDialog.test.ts) / Task 5 (OsSelector.test.ts) all hit this same
// issue and changed it to `async mk + await nextTick()`. Following the same pattern here,
// no assertion content is reduced, and no checks are weakened.
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
  it('shows title "Create New VM" and placeholder text on ISO row when not selected', async () => {
    await mk()
    expect(q('.create-vm-title').textContent).toContain('创建新虚拟机')
    expect(q('.cv-iso-btn').textContent).toContain('选择 ISO 镜像')
  })

  it('CPU core grid count = host.cpuCores (6 on real device), highlights cells where n <= vcpu', async () => {
    const wr = await mk()
    const cells = qa('.cv-cpu-btn')
    expect(cells).toHaveLength(6)
    expect(cells.filter((c) => c.classList.contains('active')).length).toBe(2) // defaultVcpu=2
    cells[3].click(); await wr.vm.$nextTick()
    expect(qa('.cv-cpu-btn').filter((c) => c.classList.contains('active')).length).toBe(4)
  })

  it('does not render grid when host.cpuCores=0 (settings not yet returned, spec §12 #6, avoids flashing 16)', async () => {
    await mk({ host: { ...HOST, cpuCores: 0 } })
    expect(qa('.cv-cpu-btn')).toHaveLength(0)
  })

  it('network dropdown = NAT + one "bridge to xxx" option per network card', async () => {
    await mk()
    const opts = qa('.cv-select-native option').map((o) => o.textContent?.trim())
    expect(opts).toEqual(['NAT', '桥接到 enp2s0', '桥接到 wlp1s0'])
  })

  it('pre-fills vcpu/memory with global defaults on open, disk with defaultDiskSize (mirrors Vue2 :1155-1188)', async () => {
    await mk()
    expect((q('input[name="memory"]') as HTMLInputElement).value).toBe('2048')
    expect((q('input[name="disk"]') as HTMLInputElement).value).toBe('20')
  })

  it('clicking ISO row emits open-os-selector', async () => {
    const wr = await mk(); q('.cv-iso-btn').click(); await wr.vm.$nextTick()
    expect(wr.emitted('open-os-selector')).toHaveLength(1)
  })

  it('after selecting OS, ISO row shows path and vcpu/memory update to recommended specs', async () => {
    const wr = await mk()
    await wr.setProps({ selectedOs: OS({ recommendedVcpu: 4, recommendedMemory: 4096 }) })
    expect(q('.cv-iso-btn').textContent).toContain('/DATA/KVM/isos/alpine-319.iso')
    expect((q('input[name="memory"]') as HTMLInputElement).value).toBe('4096')
    expect(qa('.cv-cpu-btn').filter((c) => c.classList.contains('active')).length).toBe(4)
  })

  it('firmware buttons can toggle (different from disabled version in VM settings dialog)', async () => {
    const wr = await mk()
    const [uefi, bios] = qa('.cv-firmware-btn')
    expect(bios.classList.contains('active')).toBe(true)
    uefi.click(); await wr.vm.$nextTick()
    expect(qa('.cv-firmware-btn')[0].classList.contains('active')).toBe(true)
  })

  it('OS template dropdown appears only for local ISO (mirrors Vue2 :476)', async () => {
    const wr = await mk()
    expect(qa('select[name="osTemplate"]')).toHaveLength(0)
    await wr.setProps({ selectedOs: OS({ isLocal: true, id: 'local', name: 'custom.iso' }) })
    expect(qa('select[name="osTemplate"]')).toHaveLength(1)
  })

  // Fix (brief test code defect #1, reported): the draft only called setVal for disk, never
  // filled in the VM name. validateCreateVm's validation order is "name → OS → disk minimum"
  // (createVmValidate.ts mirrors Vue2 :1451 exactly), so with an empty name it will always
  // report kvmErrNoName first, and the expected disk error text in the assertion never arrives.
  // This test was actually asserting an unreachable branch — a typo-style "missed one setVal".
  // Added the name field.
  it('validation failure shows error message and params inline in .cv-error, does not emit submit (hard constraint 7)', async () => {
    const wr = await mk({ selectedOs: OS({ minDisk: 2 }) })
    await setVal(wr, 'input[name="name"]', 'x')
    await setVal(wr, 'input[name="disk"]', '4')
    q('.cv-primary-btn').click(); await wr.vm.$nextTick()
    expect(q('.cv-error').textContent).toContain('磁盘大小必须至少为 8 GB')
    expect(wr.emitted('submit')).toBeUndefined()
  })

  // Fix (brief test code defect #2, reported, see ISO_ALPINE comment at file top): added
  // matching record in isos, changed expected vcpu from 2 to 1. OS() factory default is
  // recommendedVcpu:1; the rule "if recommended value exists after OS selection, override
  // vcpu/memory" (watch(selectedOs) reads os.recommendedVcpu directly) treats vcpu and
  // memory identically. The draft had memory correct per the recommended value (512) but
  // vcpu was a typo left at the default 2. Both fields should follow the same rule and
  // produce the same result, values should not differ.
  it('validation passes and emits submit, payload excludes osTemplate/autostart (backend does not accept, spec §1.15)', async () => {
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

  it('when bridge network card selected, networkMode=bridge and networkInterface=card name (mirrors Vue2 :1478-1479)', async () => {
    const wr = await mk({ selectedOs: OS(), isos: [ISO_ALPINE] })
    await setVal(wr, 'input[name="name"]', 'x')
    await setVal(wr, 'input[name="disk"]', '8')
    const sel = q('.cv-select-native') as HTMLSelectElement
    sel.value = 'enp2s0'; sel.dispatchEvent(new Event('change')); await wr.vm.$nextTick()
    q('.cv-primary-btn').click(); await wr.vm.$nextTick()
    expect(wr.emitted('submit')![0][0]).toMatchObject({ networkMode: 'bridge', networkInterface: 'enp2s0' })
  })

  // Fix (review Important, defect #4 from brief, reported): the draft had an empty form
  // on mount (never filled in the name). If the `creating` guard were deleted entirely,
  // validateCreateVm would independently reject due to "empty name" and also not emit submit.
  // The `expect(...).toBeUndefined()` passes in both "guard exists" and "guard deleted" cases,
  // so it has no discriminatory power; only the is-loading assertion is truly effective.
  // Solution: first prove that the same valid form actually emits on creating=false (ruling
  // out the "form itself is invalid" confounding factor), then prove that the same valid
  // form does not emit on creating=true. Only then can non-emission be uniquely attributed
  // to this duplicate-submit-prevention guard.
  it('primary button shows is-loading and does not respond when creating=true (duplicate-submit prevention, uses valid form to exclude validation confusion)', async () => {
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
    // Using dispatchEvent instead of `.click()` — the native `disabled` attribute itself
    // blocks `.click()` (jsdom behavior matches real browsers, verified with minimal
    // repro script). This guard tests the `if (props.creating) return` line inside
    // `onSubmit()`, not the `disabled` attribute itself. Must use a method that bypasses
    // the native blocking to actually test this internal guard (mutation validation
    // required by review, see task report).
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await busy.vm.$nextTick()
    expect(busy.emitted('submit')).toBeUndefined()
  })

  it('submitError passed from parent shows in same .cv-error slot', async () => {
    await mk({ submitError: 'domain name already exists' })
    expect(q('.cv-error').textContent).toContain('domain name already exists')
  })

  // Full-branch review fix B1: ISO selected via local file browser (isLocal:true, id
  // falls to 'local' because IsoBrowser's strict matcher cannot recognize the filename
  // 'alpine-standard-3.19.1-x86_64.iso' which lacks the complete template id 'alpine-319').
  // After CreateVmDialog receives it, a more lenient family-prefix matcher should be applied
  // as a fallback, recognizing the family prefix 'alpine' → matching the alpine-319 template,
  // recommended specs take effect (vcpu/memory overridden by template, not keeping defaults
  // of 2/2048), osTemplate is the real template id (not generic-linux).
  it('local file browser selecting ISO with family prefix → family matcher hits real template, recommended specs take effect (B1)', async () => {
    const wr = await mk({ isos: [ISO_ALPINE] })
    await wr.setProps({
      selectedOs: {
        isLocal: true, id: 'local', name: 'alpine-standard-3.19.1-x86_64.iso',
        path: '/DATA/alpine-standard-3.19.1-x86_64.iso',
      },
    })
    // Recommended specs come from ISO_ALPINE (vcpu:1, memory:512), not defaults of 2/2048.
    expect((q('input[name="memory"]') as HTMLInputElement).value).toBe('512')
    expect(qa('.cv-cpu-btn').filter((c) => c.classList.contains('active')).length).toBe(1)
    // Indirect evidence of osTemplate linking taking effect: "OS Version" dropdown has the real template id selected, not generic-linux.
    const osTemplateSelect = q('select[name="osTemplate"]') as HTMLSelectElement
    expect(osTemplateSelect.value).toBe('alpine-319')
  })

  it('form resets when reopened (mirrors Vue2 showCreateVM rebuilding newVM each time)', async () => {
    const wr = await mk()
    await setVal(wr, 'input[name="name"]', 'dirty')
    await wr.setProps({ open: false }); await wr.setProps({ open: true })
    expect((q('input[name="name"]') as HTMLInputElement).value).toBe('')
  })
})
