import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import KvmGlobalSettingsDialog from './KvmGlobalSettingsDialog.vue'
import { i18n } from '../../i18n'

const api = { getSettings: vi.fn(), updateSettings: vi.fn() }
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))

// Review Important #2: need to observe outside the component whether useKvmHostInfo()'s returned settings ref has been
// polluted—but the component doesn't expose this internal composable instance via props/emit. Here we use vi.mock
// to wrap a thin shell "forward to real implementation but record each call's return value" (not replacing behavior,
// is the real useKvmHostInfo logic itself, just with an added "side-channel observation point" available for test
// assertions); no need to modify production code (don't add test-only hooks like defineExpose).
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
// Hard constraint 5: the `mk` in brief's verbatim text is a sync function. Testing with reka-ui 2.10 (this repo's
// existing version) shows that DialogPortal/DialogContent on first mount requires waiting for the next microtask
// (nextTick) to actually mount content into document.body—consistent with the established pattern in
// KvmDialog.test.ts / src/components/ui/Dialog.test.ts. Here we make `mk` async and `await nextTick()` after mount;
// all assertions remain unchanged.
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
  it('opens and fetches settings, fills four fields', async () => {
    const wr = await mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    expect(api.getSettings).toHaveBeenCalledTimes(1)
    expect((q('input[name="storagePath"]') as HTMLInputElement).value).toBe('/DATA/KVM')
    expect((q('input[name="defaultVcpu"]') as HTMLInputElement).value).toBe('2')
    expect((q('input[name="defaultMemory"]') as HTMLInputElement).value).toBe('2048')
    expect(q('.cv-switch input')!.hasAttribute('checked') ||
      (q('.cv-switch input') as HTMLInputElement).checked).toBe(false)
  })

  it('title displays translated "system settings" (Vue2 key Settings, zh_CN.json translation)', async () => {
    await mk(); await new Promise((r) => setTimeout(r))
    expect(q('.create-vm-title').textContent).toContain('系统设置')
  })

  it('clicking save → sends only 4 writable fields → emits update:open=false + saved (review fix: notify parent to re-fetch its own useKvmHostInfo)', async () => {
    const wr = await mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    ;(q('.cv-primary-btn') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    expect(api.updateSettings).toHaveBeenCalledWith({
      storagePath: '/DATA/KVM', defaultVcpu: 2, defaultMemory: 2048, autostart: false,
    })
    expect(wr.emitted('update:open')).toEqual([[false]])
    expect(wr.emitted('saved')).toHaveLength(1)
  })

  // Review fix companion: failure branch shouldn't emit saved (no new value to backfill, parent also shouldn't
  // unnecessarily fetch again)—same discriminative power problem (hard constraint Global Constraint #15): without
  // separately asserting the failure branch, just the above "success → emit saved" can't prove this emit only fires "on success".
  it('save failure doesn\'t emit saved', async () => {
    api.updateSettings.mockRejectedValue(new Error('storage path not writable'))
    const wr = await mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    ;(q('.cv-primary-btn') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    expect(wr.emitted('saved')).toBeUndefined()
  })

  it('save failure → dialog inline .cv-error displays backend message, dialog stays open (hard constraint 7)', async () => {
    api.updateSettings.mockRejectedValue(new Error('storage path not writable'))
    const wr = await mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    ;(q('.cv-primary-btn') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    expect(q('.cv-error').textContent).toContain('storage path not writable')
    expect(wr.emitted('update:open')).toBeUndefined()
  })

  it('save success shows global toast "settings saved"', async () => {
    const { useToast } = await import('../../stores/toast')
    const wr = await mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    ;(q('.cv-primary-btn') as HTMLButtonElement).click()
    await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    expect(useToast().toasts.map((x) => x.text)).toContain('设置已保存')
  })

  // Review Important #1: the above "opens and fetches settings, fills four fields" test asserts autostart:false,
  // but checkbox defaults to unchecked when not wired with v-model—that assertion can't distinguish "wired correctly"
  // from "not wired at all". Here we use autostart:true fixture to assert the switch actually flips to checked.
  it('review Important #1: autostart:true fills switch as checked (distinguish "wired correctly" from "not wired at all")', async () => {
    api.getSettings.mockResolvedValue({ ...REAL, autostart: true })
    const wr = await mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()
    expect((q('.cv-switch input') as HTMLInputElement).checked).toBe(true)
  })

  // Review Important #2: brief Step 5 explicitly requires "form editing uses local copy, don't directly two-way bind
  // useKvmHostInfo()'s settings ref"—reason is Task 7 (create dialog) needs settings as default values; edit values here
  // then cancel, dirty values shouldn't pollute shared state. Previously only implemented isolation without test proof; here
  // we add it: edit input field → click close (don't click save) → assert useKvmHostInfo()'s returned settings ref is still
  // the original fetched value, not polluted by this edit.
  it('review Important #2: edits values but canceling (don\'t save) doesn\'t pollute shared settings state', async () => {
    const wr = await mk(); await new Promise((r) => setTimeout(r)); await wr.vm.$nextTick()

    const input = q('input[name="storagePath"]') as HTMLInputElement
    input.value = '/tmp/somewhere-else'
    input.dispatchEvent(new Event('input'))
    await wr.vm.$nextTick()
    expect(input.value).toBe('/tmp/somewhere-else') // confirm edit actually took effect, exclude false positive of "didn't edit at all"

    ;(q('.create-vm-close') as HTMLButtonElement).click() // trigger close, bypass save
    await wr.vm.$nextTick()

    expect(lastHostInfo?.settings.value.storagePath).toBe('/DATA/KVM')
  })
})
