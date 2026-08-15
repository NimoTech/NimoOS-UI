import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SnapshotPanel from './SnapshotPanel.vue'
import zh from '../../i18n/zh_cn'

const listVolumes = vi.fn()
const getPolicy = vi.fn()
const listMock = vi.fn().mockResolvedValue([])
const togglePolicy = vi.fn().mockResolvedValue(undefined)
const patchPolicy = vi.fn()
const createSnap = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    snapshot: {
      listVolumes: (...a: unknown[]) => listVolumes(...a),
      getPolicy: (...a: unknown[]) => getPolicy(...a),
      list: (...a: unknown[]) => listMock(...a),
      togglePolicy: (...a: unknown[]) => togglePolicy(...a),
      patchPolicy: (...a: unknown[]) => patchPolicy(...a),
      create: (...a: unknown[]) => createSnap(...a),
      remove: vi.fn(),
    },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountPanel = () => mount(SnapshotPanel, { props: { volumeUuid: 'u1' }, global: { plugins: [i18n] } })
const flush = async (w: ReturnType<typeof mountPanel>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  getPolicy.mockResolvedValue({ hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
  // vi.clearAllMocks() only clears call records and does not restore mockImplementation: the "toggle in flight"
  // case swaps togglePolicy for a never-resolving promise; without resetting it here it leaks into later cases.
  togglePolicy.mockResolvedValue(undefined)
  patchPolicy.mockResolvedValue(null)
  createSnap.mockResolvedValue(undefined)
})

describe('SnapshotPanel three states', () => {
  it('endpoint 404 (listVolumes throws) → unsupported state: shows an explanation, no switch, and does not fetch the policy', async () => {
    listVolumes.mockRejectedValue(new Error('404'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-unsupported').exists()).toBe(true)
    expect(w.find('.sp-switch').exists()).toBe(false)
    expect(getPolicy).not.toHaveBeenCalled()
  })
  it('supported=false → unsupported state', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: false }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-unsupported').exists()).toBe(true)
  })
  it('disabled state: has a switch (unchecked) + explanation line, no status line/no policy summary', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('false')
    expect(w.find('.sp-status').exists()).toBe(false)
    expect(w.find('.sp-policy-summary').exists()).toBe(false)
    expect(getPolicy).not.toHaveBeenCalled()
  })
  it('the switch has an accessible name (aria-label), not dependent on a sibling relationship with the nearby .sp-key', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-switch').attributes('aria-label')).toBe(zh.snapTitle)
  })
  it('disabled but still has historical snapshots → shows an extra "existing snapshots are still retained" line', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 3 }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-kept').exists()).toBe(true)
  })
  it('enabled state: switch checked + status summary + retention promise + policy summary (and the policy is fetched only once)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 5, last_at: '2026-07-27T01:00:00Z' }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('true')
    expect(w.find('.sp-status').text()).toContain('5')
    expect(w.find('.sp-kept').exists()).toBe(true)
    expect(w.find('.sp-policy-summary').text()).toContain('24')
    expect(getPolicy).toHaveBeenCalledTimes(1)
  })
  it('enabled but zero snapshots → status line shows "no snapshots yet"', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 0, last_at: '' }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-status').text()).toBe(zh.snapNoneYet)
  })
  it('paused_reason non-empty → shows a paused warning line whose content includes the reason', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 1, last_at: '2026-07-27T01:00:00Z', paused_reason: '磁盘使用率 95%' }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-paused').text()).toContain('磁盘使用率 95%')
  })
  it('no paused_reason → no paused line', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 1 }])
    const w = mountPanel(); await flush(w)
    expect(w.find('.sp-paused').exists()).toBe(false)
  })
})

describe('SnapshotPanel protection switch', () => {
  it('clicking the switch → togglePolicy(uuid, target value); local state follows after the toggle', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 1 }])
    const w = mountPanel(); await flush(w)
    await w.find('.sp-switch').trigger('click')
    await flush(w)
    expect(togglePolicy).toHaveBeenCalledWith('u1', false)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('false')
  })
  it('the switch is disabled while the toggle is in flight (prevents double-clicking)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
    let release: (v?: unknown) => void = () => {}
    togglePolicy.mockImplementation(() => new Promise((r) => { release = r }))
    const w = mountPanel(); await flush(w)
    await w.find('.sp-switch').trigger('click')
    await w.vm.$nextTick()
    expect((w.find('.sp-switch').element as HTMLButtonElement).disabled).toBe(true)
    release(); await flush(w)
    expect((w.find('.sp-switch').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('Required-4 seam test: after disabled→enabled, watch(state) triggers loadPolicy once', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
    const w = mountPanel(); await flush(w)
    expect(getPolicy).not.toHaveBeenCalled()
    await w.find('.sp-switch').trigger('click')
    await flush(w)
    expect(togglePolicy).toHaveBeenCalledWith('u1', true)
    expect(getPolicy).toHaveBeenCalledTimes(1)
    expect(getPolicy).toHaveBeenCalledWith('u1')
  })
})

describe('SnapshotPanel advanced policy form', () => {
  const enabledVol = [{ volume_uuid: 'u1', supported: true, enabled: true, count: 2, last_at: '2026-07-27T01:00:00Z' }]

  it('clicking "Advanced settings" → the form expands with the current policy as initial values, the summary line gives way', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    expect(w.find('.sp-advanced').exists()).toBe(true)
    expect(w.find('.sp-policy-summary').exists()).toBe(false)
    expect((w.find('.sp-in-hourly').element as HTMLInputElement).value).toBe('24')
    expect((w.find('.sp-in-pct').element as HTMLInputElement).value).toBe('90')
  })

  it('when the policy is missing (getPolicy throws) the form falls back to defaults 24/7/4/90', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    getPolicy.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    expect((w.find('.sp-in-daily').element as HTMLInputElement).value).toBe('7')
    expect((w.find('.sp-in-weekly').element as HTMLInputElement).value).toBe('4')
  })

  it('invalid input → shows per-field errors and does not send the request', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    await w.find('.sp-in-hourly').setValue('0')
    await w.find('.sp-in-pct').setValue('101')
    await w.find('.sp-save').trigger('click'); await flush(w)
    expect(w.find('.sp-err-hourly').text()).toBe(zh.snapErrPositiveInt)
    expect(w.find('.sp-err-pct').text()).toBe(zh.snapErrPercent)
    expect(patchPolicy).not.toHaveBeenCalled()
    expect(w.find('.sp-advanced').exists()).toBe(true)   // form stays open
  })

  it('valid input → patchPolicy receives the four fields as numbers (not strings), the form collapses after success', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    patchPolicy.mockResolvedValue(null)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    await w.find('.sp-in-hourly').setValue('12')
    await w.find('.sp-in-daily').setValue('5')
    await w.find('.sp-in-weekly').setValue('3')
    await w.find('.sp-in-pct').setValue('80')
    await w.find('.sp-save').trigger('click'); await flush(w)
    expect(patchPolicy).toHaveBeenCalledWith('u1', { hourly_keep: 12, daily_keep: 5, weekly_keep: 3, pause_threshold_pct: 80 })
    expect(w.find('.sp-advanced').exists()).toBe(false)
    expect(w.find('.sp-policy-summary').text()).toContain('12')
  })

  it('cancel → collapses the form, clears errors, does not send the request', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-advanced-btn').trigger('click')
    await w.find('.sp-in-hourly').setValue('0')
    await w.find('.sp-save').trigger('click'); await flush(w)
    expect(w.find('.sp-err-hourly').exists()).toBe(true)
    await w.find('.sp-cancel-adv').trigger('click')
    expect(w.find('.sp-advanced').exists()).toBe(false)
    expect(patchPolicy).not.toHaveBeenCalled()
    await w.find('.sp-advanced-btn').trigger('click')
    expect(w.find('.sp-err-hourly').exists()).toBe(false)   // no leftover error on reopen
  })
})

describe('SnapshotPanel manual snapshot creation', () => {
  const enabledVol = [{ volume_uuid: 'u1', supported: true, enabled: true, count: 2, last_at: '2026-07-27T01:00:00Z' }]

  it('after filling in a note and clicking create → create receives {volume_uuid,label}, the input clears after success', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    createSnap.mockResolvedValue(undefined)
    const w = mountPanel(); await flush(w)
    await w.find('.sp-label-input').setValue('升级前')
    await w.find('.sp-create').trigger('click'); await flush(w)
    expect(createSnap).toHaveBeenCalledWith({ volume_uuid: 'u1', label: '升级前' })
    expect((w.find('.sp-label-input').element as HTMLInputElement).value).toBe('')
  })

  it('creation failure → the note is retained (to make retrying easier)', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    createSnap.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mountPanel(); await flush(w)
    await w.find('.sp-label-input').setValue('升级前')
    await w.find('.sp-create').trigger('click'); await flush(w)
    expect((w.find('.sp-label-input').element as HTMLInputElement).value).toBe('升级前')
  })

  it('creation in flight: both the button and the input are disabled', async () => {
    listVolumes.mockResolvedValue(enabledVol)
    let release: (v?: unknown) => void = () => {}
    createSnap.mockImplementation(() => new Promise((r) => { release = r }))
    const w = mountPanel(); await flush(w)
    await w.find('.sp-create').trigger('click'); await w.vm.$nextTick()
    expect((w.find('.sp-create').element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('.sp-label-input').element as HTMLInputElement).disabled).toBe(true)
    release(); await flush(w)
    expect((w.find('.sp-create').element as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('SnapshotPanel volume switch (Required-1 critical regression)', () => {
  // Repro path: under the same pinia instance mount A first (has count, enabled=true), then switch the prop to B
  // (B's volume data differs: enabled=false/count=0). Without reset()+watch(volumeUuid),
  // the singleton store keeps the panel showing A's switch/count while sending protection-toggle and retention-policy writes for B.
  it('after switching to B, the switch/count from A no longer lingers, B re-fetches its volume', async () => {
    listVolumes.mockResolvedValueOnce([{ volume_uuid: 'A', supported: true, enabled: true, count: 7, last_at: '2026-07-27T01:00:00Z' }])
    const w = mount(SnapshotPanel, { props: { volumeUuid: 'A' }, global: { plugins: [i18n] } })
    await flush(w)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('true')
    expect(w.find('.sp-status').text()).toContain('7')
    expect(getPolicy).toHaveBeenCalledWith('A')

    listVolumes.mockResolvedValueOnce([{ volume_uuid: 'B', supported: true, enabled: false, count: 0 }])
    await w.setProps({ volumeUuid: 'B' })
    await flush(w)

    expect(listVolumes).toHaveBeenCalledTimes(2)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('false')
    // disabled state has no status row —— if A's render still lingered, "7" would still show here
    expect(w.find('.sp-status').exists()).toBe(false)
  })

  it('switching to B, which is also enabled → getPolicy is called again with B (not continuing to use the policy from A)', async () => {
    listVolumes.mockResolvedValueOnce([{ volume_uuid: 'A', supported: true, enabled: true, count: 7 }])
    getPolicy.mockResolvedValueOnce({ hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
    const w = mount(SnapshotPanel, { props: { volumeUuid: 'A' }, global: { plugins: [i18n] } })
    await flush(w)
    expect(getPolicy).toHaveBeenCalledWith('A')

    listVolumes.mockResolvedValueOnce([{ volume_uuid: 'B', supported: true, enabled: true, count: 2 }])
    getPolicy.mockResolvedValueOnce({ hourly_keep: 1, daily_keep: 1, weekly_keep: 1, pause_threshold_pct: 50 })
    await w.setProps({ volumeUuid: 'B' })
    await flush(w)

    expect(getPolicy).toHaveBeenCalledWith('B')
    expect(w.find('.sp-policy-summary').text()).toContain('1')
  })
})

describe('SnapshotPanel embedded timeline visibility (1:1 match with Vue2)', () => {
  it('enabled → the timeline appears', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: true, count: 0 }])
    const w = mountPanel(); await flush(w)
    expect(w.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(true)
  })
  it('disabled but has historical snapshots → the timeline still appears (honors the "snapshots are still retained" promise)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 3 }])
    const w = mountPanel(); await flush(w)
    expect(w.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(true)
  })
  it('disabled with no history → no timeline; unsupported → no timeline', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: true, enabled: false, count: 0 }])
    const w1 = mountPanel(); await flush(w1)
    expect(w1.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(false)
    listVolumes.mockResolvedValue([{ volume_uuid: 'u1', supported: false }])
    const w2 = mountPanel(); await flush(w2)
    expect(w2.findComponent({ name: 'SnapshotTimeline' }).exists()).toBe(false)
  })
})
