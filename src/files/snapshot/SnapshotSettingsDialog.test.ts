import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SnapshotSettingsDialog from './SnapshotSettingsDialog.vue'
import zh from '../../i18n/zh_cn'

const listVolumesMock = vi.fn()
const getPolicyMock = vi.fn()
const patchPolicyMock = vi.fn()
const togglePolicyMock = vi.fn()
const createMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { snapshot: {
    listVolumes: () => listVolumesMock(), getPolicy: (u: string) => getPolicyMock(u),
    patchPolicy: (u: string, p: unknown) => patchPolicyMock(u, p),
    togglePolicy: (u: string, e: boolean) => togglePolicyMock(u, e),
    create: (d: unknown) => createMock(d), list: vi.fn().mockResolvedValue([]), remove: vi.fn(),
  } },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = (props = {}) =>
  mount(SnapshotSettingsDialog, {
    props: { open: true, volumeUuid: 'u-data', mountPoint: '/DATA', ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
const flush = async (w: ReturnType<typeof mountIt>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}
const body = () => document.body.textContent ?? ''

// Instances mounted with attachTo: document.body will not auto-unmount between tests
// (Dialog content is Teleported to body via reka-ui Portal, decoupled from wrapper root) —
// TimeMachineOverlay.test.ts and RaidDeleteDialog.test.ts in this directory both clear body
// in beforeEach, and we follow the same pattern here.
// Intentionally different from the component form's default values
// (hourly_keep:24/daily_keep:7/weekly_keep:4/pause_threshold_pct:90) — if we delete the
// "sync local form after policy lands" logic entirely, the component would stay at default
// values on submit; comparing against this backend set would expose the bug. All four fields
// are offset from defaults, leaving no field a chance to "guess right" by accident.
const BACKEND_POLICY = { enabled: true, hourly_keep: 12, daily_keep: 3, weekly_keep: 8, pause_threshold_pct: 75 }

beforeEach(() => {
  setActivePinia(createPinia()); vi.clearAllMocks(); document.body.innerHTML = ''
  listVolumesMock.mockResolvedValue([{ volume_uuid: 'u-data', mount: '/DATA', supported: true, enabled: true, count: 3 }])
  getPolicyMock.mockResolvedValue({ ...BACKEND_POLICY })
})

describe('SnapshotSettingsDialog', () => {
  it('fetch volume and policy on open', async () => {
    const w = mountIt(); await flush(w)
    expect(listVolumesMock).toHaveBeenCalled()
    expect(getPolicyMock).toHaveBeenCalledWith('u-data')
  })
  it('show mount point so user knows which volume is being modified', async () => {
    const w = mountIt(); await flush(w)
    expect(body()).toContain('/DATA')
  })
  // Review fix (Important): during loadVolume network round-trip (store.volumeLoading
  // initially true), should not prematurely show "snapshot not supported" conclusion text —
  // store.volume is still null (or carries old value from before switching volume) at this
  // point; resolveSnapshotState(null) === 'unsupported', and without volumeLoading guarding
  // it, wrong text would flash first.
  it('snapUnsupported text does not appear when loadVolume is not yet resolved (prevent flashing wrong conclusion during network round-trip)', async () => {
    listVolumesMock.mockImplementation(() => new Promise(() => {})) // never resolves
    const w = mountIt()
    await w.vm.$nextTick()
    expect(body()).not.toContain('不支持快照')
    expect(document.querySelector('.snap-set-fields')).toBeNull()
    // Review re-check (Minor, round 2): the `v-else-if="!store.volumeLoading"` gate had no
    // test coverage before — changing it back to `v-else` left all 12 tests in this file
    // still green, the only surviving mutation from the previous round. The toggle button
    // (.snap-set-toggle) lives in the v-else branch, at the same level as policy fields
    // (.snap-set-fields) but not inside the same v-if block; adding this assertion:
    // before volumeLoading lands, the toggle also should not be visible (store.volume is
    // still null/old value, toggle state would flash wrong enabled value first).
    expect(document.querySelector('.snap-set-toggle')).toBeNull()
  })
  it('unsupported volumes show only a note, no form', async () => {
    listVolumesMock.mockResolvedValue([{ volume_uuid: 'u-data', mount: '/DATA', supported: false }])
    const w = mountIt(); await flush(w)
    expect(body()).toContain('不支持快照')
    expect(document.querySelector('.snap-set-fields')).toBeNull()
  })
  it('when enabled, 4 policy fields are always visible (not collapsed)', async () => {
    const w = mountIt(); await flush(w)
    expect(document.querySelectorAll('.snap-set-fields input').length).toBe(4)
  })
  it('form is initialized from backend policy, not from default values', async () => {
    const w = mountIt(); await flush(w)
    const values = [...document.querySelectorAll('.snap-set-fields input')].map((el) => (el as HTMLInputElement).value)
    expect(values).toEqual(['12', '3', '8', '75'])
  })
  it('save uses patchPolicy (read-modify-write, not constructing PUT from scratch), submitting backend-persisted current values', async () => {
    const w = mountIt(); await flush(w)
    await (document.querySelector('.snap-set-save') as HTMLElement).click()
    await flush(w)
    expect(patchPolicyMock).toHaveBeenCalledWith('u-data', expect.objectContaining({
      hourly_keep: BACKEND_POLICY.hourly_keep, daily_keep: BACKEND_POLICY.daily_keep,
      weekly_keep: BACKEND_POLICY.weekly_keep, pause_threshold_pct: BACKEND_POLICY.pause_threshold_pct,
    }))
  })
  it('when field is invalid, do not submit and show error', async () => {
    const w = mountIt(); await flush(w)
    const input = document.querySelector('.snap-set-fields input') as HTMLInputElement
    input.value = '0'; input.dispatchEvent(new Event('input')); await flush(w)
    await (document.querySelector('.snap-set-save') as HTMLElement).click(); await flush(w)
    expect(patchPolicyMock).not.toHaveBeenCalled()
    expect(body()).toContain('大于 0')
  })
  it('toggle calls togglePolicy', async () => {
    const w = mountIt(); await flush(w)
    await (document.querySelector('.snap-set-toggle') as HTMLElement).click(); await flush(w)
    expect(togglePolicyMock).toHaveBeenCalledWith('u-data', false)
  })
  it('disabled state shows hint text, no policy fields', async () => {
    listVolumesMock.mockResolvedValue([{ volume_uuid: 'u-data', mount: '/DATA', supported: true, enabled: false, count: 0 }])
    const w = mountIt(); await flush(w)
    expect(body()).toContain('自动为此卷创建快照')
    expect(document.querySelector('.snap-set-fields')).toBeNull()
  })
  it('create snapshot now: submit with label and emit snapshot-created', async () => {
    createMock.mockResolvedValue({})
    const w = mountIt(); await flush(w)
    const label = document.querySelector('.snap-set-label') as HTMLInputElement
    label.value = '升级前'; label.dispatchEvent(new Event('input')); await flush(w)
    await (document.querySelector('.snap-set-create') as HTMLElement).click(); await flush(w)
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: 'u-data', label: '升级前' })
    expect(w.emitted('snapshot-created')).toHaveLength(1)
  })
  it('when label is empty, do not include label field', async () => {
    createMock.mockResolvedValue({})
    const w = mountIt(); await flush(w)
    await (document.querySelector('.snap-set-create') as HTMLElement).click(); await flush(w)
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: 'u-data' })
  })
})
