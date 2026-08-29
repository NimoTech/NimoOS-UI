import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'
import { useToast } from '../../../stores/toast'

const blob: Record<string, unknown> = {}
const state = { usb: false, usbCalls: [] as unknown[], usbFail: false, driveModel: '' }

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => ({ ...blob }),
      setCustomStorage: async (_k: string, d: Record<string, unknown>) => { Object.assign(blob, d) },
    },
    sys: {
      getUsbStatus: async () => state.usb,
      toggleUsbAutoMount: async (p: { state: string }) => {
        state.usbCalls.push(p)
        if (state.usbFail) throw new Error('boom')
      },
      hardwareInfo: async () => ({ arch: 'arm64', drive_model: state.driveModel }),
    },
  },
}))

import UsbAutoMountRow from './UsbAutoMountRow.vue'
import SwitchRow from './SwitchRow.vue'
// Use "import the component itself" instead of findComponent({name:'AlertDialog'}):
// AlertDialog.vue has no defineOptions({name}), and it's a shared file that sp7/sp8 also touch,
// so changing it just for the test would needlessly widen the merge-conflict surface.
import AlertDialog from '../../../components/ui/AlertDialog.vue'
import { __resetSystemConfigQueue } from '../../util/systemConfig'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })

beforeEach(() => {
  setActivePinia(createPinia())
  for (const k of Object.keys(blob)) delete blob[k]
  state.usb = false; state.usbCalls = []; state.usbFail = false; state.driveModel = ''
  __resetSystemConfigQueue()
})

describe('UsbAutoMountRow', () => {
  const mountIt = () => mount(UsbAutoMountRow, { global: { plugins: [i18n] } })

  it('after mount, the switch reflects the backend state ("True" is already normalized to a boolean inside the package)', async () => {
    state.usb = true
    const w = mountIt()
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('mounting **does not** send a toggle (loading ≠ user action)', async () => {
    state.usb = true
    mountIt()
    await flushPromises()
    expect(state.usbCalls).toEqual([])
  })

  it('switching on sends state:on, and optimistically flips immediately', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(state.usbCalls).toEqual([{ state: 'on' }])
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('switching off sends state:off', async () => {
    state.usb = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(state.usbCalls).toEqual([{ state: 'off' }])
  })

  it('the switch snaps back to its original state when the request fails (Vue2 is fire-and-forget, so the UI lies on failure)', async () => {
    state.usbFail = true
    const toast = useToast()
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
    // Review fix round 2 · Important: previously this only verified the switch snapped back, not that the user was actually notified —
    // omitting toast.show(...) or getting the i18n key wrong wouldn't fail the assertion above.
    expect(toast.toasts).toHaveLength(1)
    expect(toast.msg).toBe(i18n.global.t('settingsSaveFailed'))
  })

  it('gives a boot-failure warning on Raspberry Pi + when switching on (ports Vue2 L1791-1797)', async () => {
    state.driveModel = 'Raspberry Pi 5 Model B'
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    // The Vue2 translation reads "Raspberry Pi", not the Chinese name — the assertion follows the translation
    expect(w.text()).toContain('Raspberry Pi')
  })

  it('gives no warning on non-Raspberry-Pi', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Raspberry Pi')
  })

  it('gives no warning on Raspberry Pi either when switching off (the warning only applies to "on")', async () => {
    state.driveModel = 'Raspberry Pi 5'
    state.usb = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain('Raspberry Pi')
  })

  // Interleaving-guard regression test (not in the brief, but explicitly required by the outer task description): under real network latency,
  // a slow initial load must not, upon resolving, stomp on a flip the user has already made.
  // Both pitfalls must be avoided: ① don't flushPromises to let the load settle before flipping (that would prove nothing);
  // ② the "old value" must be a snapshot taken at the moment the load was kicked off, not read from the shared mock state after the user has already flipped
  // (otherwise it's no longer an "old" value, and the test would pass even without the guard).
  it('interleaving guard: onMounted\'s getUsbStatus resolving later than the user flip does not overwrite it (USB)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    let resolveLoad: (v: boolean) => void = () => {}
    const pending = new Promise<boolean>((res) => { resolveLoad = res })
    // The server snapshot at the moment the load was kicked off is false — capture this value **before** the user flips
    const staleValue = state.usb // false
    vi.spyOn(svc.service.sys, 'getUsbStatus').mockReturnValueOnce(pending)
    const w = mountIt()
    // Don't flushPromises to let the load settle — the load is still pending, the user flips the switch first
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(state.usbCalls).toEqual([{ state: 'on' }])
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
    // Only now let the "slow" load resolve with the old value captured before the flip — simulating a delayed network response
    resolveLoad(staleValue)
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })
})

describe('SwitchRow —— recommended apps (no confirmation)', () => {
  const mountIt = () => mount(SwitchRow, {
    props: { field: 'recommend_switch', labelKey: 'settingsRecommendApps' },
    global: { plugins: [i18n] },
  })

  it('reflects the server value after mount, default true (ports Vue2 L942)', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('flipping persists directly, writing only its own single field', async () => {
    blob.rss_switch = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(blob.recommend_switch).toBe(false)
    expect(blob.rss_switch).toBe(true)
  })

  it('snaps back when persisting fails', async () => {
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.users, 'setCustomStorage').mockRejectedValueOnce(new Error('boom'))
    const toast = useToast()
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
    // Review fix round 2 · Important: previously this only verified the switch snapped back, not that the user was actually notified.
    expect(toast.toasts).toHaveLength(1)
    expect(toast.msg).toBe(i18n.global.t('settingsSaveFailed'))
  })

  // Interleaving-guard regression test (same as the UsbAutoMountRow one, not in the brief but explicitly required by the outer task description).
  it('interleaving guard: onMounted\'s readSystemConfig resolving later than the user flip does not overwrite it (recommended apps)', async () => {
    const svc = await import('@nimotech/nimoos-service')
    let resolveLoad: (v: Record<string, unknown>) => void = () => {}
    const pending = new Promise<Record<string, unknown>>((res) => { resolveLoad = res })
    // The server snapshot at the moment the load was kicked off is an empty blob (recommend_switch = true after merging defaults) —
    // capture this "old" snapshot **before** the user flips
    const staleSnapshot = { ...blob }
    vi.spyOn(svc.service.users, 'getCustomStorage').mockReturnValueOnce(pending)
    const w = mountIt()
    // Don't flushPromises to let the load settle — the load is still pending, the user turns off the switch first (default on)
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(blob.recommend_switch).toBe(false)
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
    // Only now let the "slow" load resolve with the old snapshot captured before the flip
    resolveLoad(staleSnapshot)
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })
})

describe('SwitchRow —— news feed (turning on requires confirmation, ports Vue2 rssConfirm L1696-1715)', () => {
  const mountIt = () => mount(SwitchRow, {
    props: {
      field: 'rss_switch', labelKey: 'settingsNewsFeed',
      confirmTitleKey: 'settingsNewsFeedTitle',
      confirmMsgKey: 'settingsNewsFeedConfirm',
      confirmOkKey: 'settingsAccept',
    },
    global: { plugins: [i18n] },
  })

  it('defaults to off (ports Vue2 L944 rss_switch:false)', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('switching on first pops a confirmation; nothing persists and the switch doesn\'t flip before confirming', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.findComponent(AlertDialog).props('open')).toBe(true)
    expect(blob.rss_switch).toBeUndefined()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  it('only persists and flips on after confirming', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    w.findComponent(AlertDialog).vm.$emit('confirm')
    await flushPromises()
    expect(blob.rss_switch).toBe(true)
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('cancel the confirmation: stays off and doesn\'t persist', async () => {
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    w.findComponent(AlertDialog).vm.$emit('update:open', false)
    await flushPromises()
    expect(blob.rss_switch).toBeUndefined()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
  })

  // Review fix round 2 · Minor: previously onToggle set touched to true as soon as the confirmation dialog opened,
  // regardless of whether the user actually confirmed. Scenario: the server has rss_switch=true, hydrate hasn't returned yet (the row shows
  // its default off first), the user switches on to trigger the confirmation dialog and then cancels — cancelling shouldn't leave touched stuck; a late
  // hydrate must still be able to pull the row to the real server value (true), instead of staying stuck forever at an off the user never confirmed.
  it('interleaving guard: cancelling the confirmation dialog does not leave touched stuck, a late hydrate still takes effect', async () => {
    const svc = await import('@nimotech/nimoos-service')
    let resolveLoad: (v: Record<string, unknown>) => void = () => {}
    const pending = new Promise<Record<string, unknown>>((res) => { resolveLoad = res })
    // Real server value: rss_switch = true. Captured when the load is kicked off, used when hydrate arrives late.
    const staleSnapshot = { rss_switch: true }
    vi.spyOn(svc.service.users, 'getCustomStorage').mockReturnValueOnce(pending)

    const w = mountIt()
    // hydrate is still stuck pending; the user switches on first (triggers the confirmation dialog, doesn't persist, doesn't flip)
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.findComponent(AlertDialog).props('open')).toBe(true)

    // The user cancels the confirmation
    w.findComponent(AlertDialog).vm.$emit('update:open', false)
    await flushPromises()
    expect(blob.rss_switch).toBeUndefined()

    // hydrate finally returns the real server value, belatedly
    resolveLoad(staleSnapshot)
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('switching off **doesn\'t** pop a confirmation, persists directly (ports Vue2: saveData is called directly when !rss_switch)', async () => {
    blob.rss_switch = true
    const w = mountIt()
    await flushPromises()
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.findComponent(AlertDialog).props('open')).toBe(false)
    expect(blob.rss_switch).toBe(false)
  })
})
