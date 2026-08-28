// White-glass snapshot settings modal, ported
// from the Vue 2 panel's SnapshotSettingsModal.vue (see tests/snapshotSettingsModal.test.js
// there, 638 lines) -- this file re-derives that test's assertion intent against this rebuild's
// own stack (Pinia store + reka-ui dialog primitives + real i18n, not shallowMount/Buefy
// stubs). Reuses the same mocking technique TimeMachineStage.test.ts and
// SnapshotSettingsDialog.test.ts (also deleted)
// already established: stub @nimotech/nimoos-service and the router singleton so mounting
// pulls in zero real network/navigation.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SnapshotSettingsModal from './SnapshotSettingsModal.vue'
import { useSnapshotBrowseStore } from '../stores/snapshotBrowse'
import zh from '../../i18n/zh_cn'

const listVolumesMock = vi.fn()
const getPolicyMock = vi.fn()
const patchPolicyMock = vi.fn()
const togglePolicyMock = vi.fn()
const createMock = vi.fn()
const listMock = vi.fn()
const removeMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    snapshot: {
      listVolumes: () => listVolumesMock(),
      getPolicy: (u: string) => getPolicyMock(u),
      patchPolicy: (u: string, p: unknown) => patchPolicyMock(u, p),
      togglePolicy: (u: string, e: boolean) => togglePolicyMock(u, e),
      create: (d: unknown) => createMock(d),
      list: (u: string) => listMock(u),
      remove: (n: string, u: string) => removeMock(n, u),
      restore: vi.fn(),
    },
    folder: { getList: vi.fn() },
  },
}))
vi.mock('../../router', () => ({ router: { push: vi.fn(), replace: vi.fn() } }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const VOLUME_UUID = 'u-data'

function snapshotItem(overrides: Record<string, unknown> = {}) {
  return { id: 1, name: 'a', type: 'manual', label: '', created_at: new Date().toISOString(), ...overrides }
}

const mountIt = (props: Record<string, unknown> = {}) =>
  mount(SnapshotSettingsModal, {
    props: { open: true, volumeUuid: VOLUME_UUID, mount: '/DATA', ...props },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })

// Instances mounted with attachTo: document.body will not auto-unmount between tests (dialog
// content is Teleported to body via reka-ui Portal, decoupled from wrapper root) -- clear body
// in beforeEach, same pattern the rest of this directory's dialog tests already use.
const flush = async (w: ReturnType<typeof mountIt>) => {
  await flushPromises()
  await w.vm.$nextTick()
  await w.vm.$nextTick()
}
const body = () => document.body.textContent ?? ''

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  document.body.innerHTML = ''
  listVolumesMock.mockResolvedValue([{ volume_uuid: VOLUME_UUID, mount: '/DATA', supported: true, enabled: true, count: 3, last_at: null, paused_reason: '' }])
  getPolicyMock.mockResolvedValue({ hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
  listMock.mockResolvedValue([])
})

describe('SnapshotSettingsModal — identity + three-block rendering', () => {
  it('shows the volume mount point', async () => {
    const w = mountIt({ mount: '/media/RAID_0' })
    await flush(w)
    expect(document.querySelector('.ssm-mount')?.textContent).toBe('/media/RAID_0')
  })

  it('renders Block A (Protection & Schedule), Block B (Manual Snapshot), Block C (Snapshot History) when enabled', async () => {
    const w = mountIt()
    await flush(w)
    expect(body()).toContain('保护与策略')
    expect(document.querySelector('.ssm-switch')).not.toBeNull()
    expect(document.querySelectorAll('.ssm-fields-grid input').length).toBe(3)
    expect(body()).toContain('手动快照')
    expect(document.querySelector('.ssm-manual-row')).not.toBeNull()
    expect(body()).toContain('快照历史')
    expect(document.querySelector('.ssm-history')).not.toBeNull()
  })

  it('does not flash "unsupported" while the volume is still loading (fix ④)', async () => {
    listVolumesMock.mockImplementation(() => new Promise(() => {})) // never resolves
    const w = mountIt()
    await w.vm.$nextTick()
    expect(body()).not.toContain('不支持快照')
    expect(document.querySelector('.ssm-switch')).toBeNull()
  })

  it('unsupported volume shows only the explainer, no switch/fields', async () => {
    listVolumesMock.mockResolvedValue([{ volume_uuid: VOLUME_UUID, mount: '/DATA', supported: false, enabled: false, count: 0, last_at: null, paused_reason: '' }])
    const w = mountIt()
    await flush(w)
    expect(body()).toContain('不支持快照')
    expect(document.querySelector('.ssm-switch')).toBeNull()
  })

  it('disabled volume with no history: switch renders, fields/manual/history do not', async () => {
    listVolumesMock.mockResolvedValue([{ volume_uuid: VOLUME_UUID, mount: '/DATA', supported: true, enabled: false, count: 0, last_at: null, paused_reason: '' }])
    const w = mountIt()
    await flush(w)
    expect(document.querySelector('.ssm-switch')).not.toBeNull()
    expect(document.querySelector('.ssm-fields')).toBeNull()
    expect(document.querySelector('.ssm-manual-row')).toBeNull()
    expect(document.querySelector('.ssm-history')).toBeNull()
  })

  it('disabled volume with existing history: kept message + history section still show', async () => {
    listVolumesMock.mockResolvedValue([{ volume_uuid: VOLUME_UUID, mount: '/DATA', supported: true, enabled: false, count: 2, last_at: null, paused_reason: '' }])
    const w = mountIt()
    await flush(w)
    expect(body()).toContain('关闭保护后,已有快照仍会保留')
    expect(document.querySelector('.ssm-history')).not.toBeNull()
  })

  it('surfaces paused_reason as a warning while enabled', async () => {
    listVolumesMock.mockResolvedValue([{ volume_uuid: VOLUME_UUID, mount: '/DATA', supported: true, enabled: true, count: 1, last_at: null, paused_reason: 'disk usage above threshold' }])
    const w = mountIt()
    await flush(w)
    expect(document.querySelector('.ssm-paused-row')?.textContent).toContain('disk usage above threshold')
  })
})

describe('SnapshotSettingsModal — policy save (read-modify-write)', () => {
  it('pre-fills the form from the fetched policy', async () => {
    getPolicyMock.mockResolvedValue({ hourly_keep: 48, daily_keep: 14, weekly_keep: 8, pause_threshold_pct: 80 })
    const w = mountIt()
    await flush(w)
    const values = [...document.querySelectorAll('.ssm-fields-grid input')].map((el) => (el as HTMLInputElement).value)
    expect(values).toEqual(['48', '14', '8'])
  })

  it('Save calls patchPolicy with the full merged form object (spy — not a partial PUT)', async () => {
    const w = mountIt()
    await flush(w)
    ;(document.querySelector('.ssm-save') as HTMLElement).click()
    await flush(w)
    expect(patchPolicyMock).toHaveBeenCalledWith(VOLUME_UUID, { hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
  })

  it('invalid field: does not submit, shows the error, backend not called', async () => {
    const w = mountIt()
    await flush(w)
    const input = document.querySelector('.ssm-fields-grid input') as HTMLInputElement
    input.value = '0'
    input.dispatchEvent(new Event('input'))
    await flush(w)
    ;(document.querySelector('.ssm-save') as HTMLElement).click()
    await flush(w)
    expect(patchPolicyMock).not.toHaveBeenCalled()
    expect(body()).toContain('大于 0')
  })

  it('toggle calls togglePolicy with the flipped value', async () => {
    const w = mountIt()
    await flush(w)
    ;(document.querySelector('.ssm-switch') as HTMLElement).click()
    await flush(w)
    expect(togglePolicyMock).toHaveBeenCalledWith(VOLUME_UUID, false)
  })
})

describe('SnapshotSettingsModal — manual snapshot', () => {
  it('creates a snapshot with a trimmed label and emits snapshot-created', async () => {
    createMock.mockResolvedValue({})
    const w = mountIt()
    await flush(w)
    const label = document.querySelector('.ssm-label-input') as HTMLInputElement
    label.value = '  before upgrade  '
    label.dispatchEvent(new Event('input'))
    await flush(w)
    ;(document.querySelector('.ssm-create') as HTMLElement).click()
    await flush(w)
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: VOLUME_UUID, label: 'before upgrade' })
    expect(w.emitted('snapshot-created')).toHaveLength(1)
  })

  it('omits the label field entirely when left blank', async () => {
    createMock.mockResolvedValue({})
    const w = mountIt()
    await flush(w)
    ;(document.querySelector('.ssm-create') as HTMLElement).click()
    await flush(w)
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: VOLUME_UUID })
  })
})

describe('SnapshotSettingsModal — Snapshot History (day-grouped, 2 most recent days default-expanded)', () => {
  it('fetches the list on open and renders one item per snapshot, grouped by day', async () => {
    listMock.mockResolvedValue([
      snapshotItem({ id: 1, name: 'a', type: 'manual', label: 'before upgrade' }),
      snapshotItem({ id: 2, name: 'b', type: 'auto-hourly' }),
    ])
    const w = mountIt()
    await flush(w)
    expect(listMock).toHaveBeenCalledWith(VOLUME_UUID)
    expect(document.querySelectorAll('.ssm-history-item')).toHaveLength(2)
    expect(document.querySelector('.ssm-history-group-count')?.textContent).toBe('2')
    expect(body()).toContain('before upgrade')
  })

  it('shows the empty state with the create-your-first-snapshot hint when the list is empty', async () => {
    const w = mountIt()
    await flush(w)
    expect(document.querySelector('.ssm-history-empty')).not.toBeNull()
    expect(body()).toContain('创建第一个快照')
  })

  it('the two most recent day groups start expanded, older ones start collapsed', async () => {
    const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString() }
    listMock.mockResolvedValue([
      snapshotItem({ id: 1, name: 'today', created_at: day(0) }),
      snapshotItem({ id: 2, name: 'yesterday', created_at: day(1) }),
      snapshotItem({ id: 3, name: 'old', created_at: day(5) }),
    ])
    const w = mountIt()
    await flush(w)
    // 3 day groups, but only the 2 newest (today, yesterday) are expanded by default -- the
    // 5-day-old group's items must not be in the DOM until its header is clicked.
    expect(document.querySelectorAll('.ssm-history-group')).toHaveLength(3)
    expect(document.querySelectorAll('.ssm-history-item')).toHaveLength(2)
  })

  it('collapses/expands a day group when its header is clicked', async () => {
    listMock.mockResolvedValue([snapshotItem()])
    const w = mountIt()
    await flush(w)
    expect(document.querySelectorAll('.ssm-history-item')).toHaveLength(1)

    ;(document.querySelector('.ssm-history-group-header') as HTMLElement).click()
    await flush(w)
    expect(document.querySelectorAll('.ssm-history-item')).toHaveLength(0)

    ;(document.querySelector('.ssm-history-group-header') as HTMLElement).click()
    await flush(w)
    expect(document.querySelectorAll('.ssm-history-item')).toHaveLength(1)
  })

  it('refreshes the history list after a manual snapshot is created', async () => {
    createMock.mockResolvedValue({})
    const w = mountIt()
    await flush(w)
    expect(listMock).toHaveBeenCalledTimes(1)

    listMock.mockResolvedValueOnce([snapshotItem({ id: 9, name: 'fresh' })])
    ;(document.querySelector('.ssm-create') as HTMLElement).click()
    await flush(w)

    expect(listMock).toHaveBeenCalledTimes(2)
    expect(document.querySelectorAll('.ssm-history-item')).toHaveLength(1)
  })
})

describe('SnapshotSettingsModal — Browse', () => {
  it('clicking Browse calls snapshotBrowse store switchTo(name) and closes the modal', async () => {
    listMock.mockResolvedValue([snapshotItem({ name: '20260713T061955Z_manual' })])
    const w = mountIt()
    await flush(w)
    const browse = useSnapshotBrowseStore()
    const spy = vi.spyOn(browse, 'switchTo').mockResolvedValue()

    ;(document.querySelector('.ssm-history-browse') as HTMLElement).click()
    await flush(w)

    expect(spy).toHaveBeenCalledWith('20260713T061955Z_manual')
    expect(w.emitted('update:open')).toBeTruthy()
    expect(w.emitted('update:open')![0]).toEqual([false])
  })
})

describe('SnapshotSettingsModal — Snapshot History delete (must confirm)', () => {
  it('clicking Delete opens a confirm dialog and does not call remove until confirmed', async () => {
    listMock.mockResolvedValue([snapshotItem({ name: 'a' })])
    const w = mountIt()
    await flush(w)

    ;(document.querySelector('.ssm-history-delete') as HTMLElement).click()
    await flush(w)

    expect(body()).toContain('删除快照')
    expect(removeMock).not.toHaveBeenCalled()

    // Confirm via the AlertDialog's own confirm action.
    const confirmBtn = [...document.querySelectorAll('button')].find((b) => b.textContent === '删除' && b.className.includes('ui-btn'))
    expect(confirmBtn).toBeTruthy()
    ;(confirmBtn as HTMLElement).click()
    await flush(w)

    expect(removeMock).toHaveBeenCalledWith('a', VOLUME_UUID)
    expect(w.emitted('snapshot-deleted')).toBeTruthy()
  })
})

describe('SnapshotSettingsModal — Esc closes only this modal (fix ②, T6 guard)', () => {
  it('Escape emits update:open(false) without touching any store/service method', async () => {
    const w = mountIt()
    await flush(w)
    vi.clearAllMocks()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flush(w)

    expect(w.emitted('update:open')).toBeTruthy()
    expect(patchPolicyMock).not.toHaveBeenCalled()
    expect(togglePolicyMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
    expect(removeMock).not.toHaveBeenCalled()
  })
})

describe('SnapshotSettingsModal — close is a true no-op / re-seeds on reopen', () => {
  it('unsaved field edits do not survive a close+reopen cycle', async () => {
    const w = mountIt()
    await flush(w)
    const input = document.querySelector('.ssm-fields-grid input') as HTMLInputElement
    input.value = '999'
    input.dispatchEvent(new Event('input'))
    await flush(w)

    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await flush(w)

    const reopened = document.querySelector('.ssm-fields-grid input') as HTMLInputElement
    expect(reopened.value).toBe('24')
    expect(patchPolicyMock).not.toHaveBeenCalled()
  })
})
