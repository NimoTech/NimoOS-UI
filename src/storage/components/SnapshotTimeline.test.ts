import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import SnapshotTimeline from './SnapshotTimeline.vue'
import { useSnapshotStore } from '../stores/snapshot'
import zh from '../../i18n/zh_cn'

const listMock = vi.fn()
const removeMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { snapshot: {
    list: (...a: unknown[]) => listMock(...a),
    listVolumes: vi.fn().mockResolvedValue([]), getPolicy: vi.fn(), patchPolicy: vi.fn(),
    togglePolicy: vi.fn(), create: vi.fn(),
    remove: (...a: unknown[]) => removeMock(...a),
  } },
}))

const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountIt = () => mount(SnapshotTimeline, { props: { volumeUuid: 'u1' }, global: { plugins: [i18n] } })
const flush = async (w: ReturnType<typeof mountIt>) => {
  await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
}
const day = (d: number, h: number) => new Date(2026, 6, d, h, 0).toISOString()

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); document.body.innerHTML = '' })

describe('SnapshotTimeline', () => {
  it('fetches the list by volume as soon as it mounts', async () => {
    listMock.mockResolvedValue([])
    const w = mountIt(); await flush(w)
    expect(listMock).toHaveBeenCalledWith('u1')
  })
  it('shows the skeleton while loading, hides it once loaded', async () => {
    let release: (v: unknown) => void = () => {}
    listMock.mockImplementation(() => new Promise((r) => { release = r }))
    const w = mountIt(); await w.vm.$nextTick()
    expect(w.find('.st-skeleton').exists()).toBe(true)
    release([]); await flush(w)
    expect(w.find('.st-skeleton').exists()).toBe(false)
  })
  it('empty list → shows the two empty-state lines', async () => {
    listMock.mockResolvedValue([])
    const w = mountIt(); await flush(w)
    expect(w.find('.st-empty').text()).toContain(zh.snapNoneYet)
    expect(w.find('.st-empty').text()).toContain(zh.snapEmptyHint)
  })
  it('grouped by day: group header carries the group name and count, the most recent two groups are expanded by default, the third is collapsed', async () => {
    listMock.mockResolvedValue([
      { id: 1, name: 'a', type: 'auto-hourly', created_at: day(27, 9) },
      { id: 2, name: 'b', type: 'manual', label: '升级前', created_at: day(27, 20) },
      { id: 3, name: 'c', type: 'preop', created_at: day(26, 8) },
      { id: 4, name: 'd', type: 'auto-daily', created_at: day(20, 8) },
    ])
    const w = mountIt(); await flush(w)
    const headers = w.findAll('.st-group-header')
    expect(headers).toHaveLength(3)
    expect(headers[0].find('.st-group-count').text()).toBe('2')
    // the most recent 2 groups are expanded by default = 3 items visible (2 + 1), the third group is collapsed
    expect(w.findAll('.st-item')).toHaveLength(3)
  })
  it('clicking the group header toggles collapse/expand', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    expect(w.findAll('.st-item')).toHaveLength(1)
    await w.find('.st-group-header').trigger('click')
    expect(w.findAll('.st-item')).toHaveLength(0)
    await w.find('.st-group-header').trigger('click')
    expect(w.findAll('.st-item')).toHaveLength(1)
  })
  it('an item renders the clock/category badge/note, the category dot carries a category modifier class', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', label: '升级前', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    const item = w.find('.st-item')
    expect(item.find('.st-time').text()).toBe('09:00')
    expect(item.find('.st-badge').text()).toBe(zh.snapTypeManual)
    expect(item.find('.st-label').text()).toBe('升级前')
    expect(item.find('.st-dot').classes()).toContain('manual')
  })
  it('does not render the [browse] entry (deferred to the Files-area snapshot suite); the actions area has only a delete button', async () => {
    listMock.mockResolvedValue([{ id: 1, name: 'a', type: 'manual', created_at: day(27, 9) }])
    const w = mountIt(); await flush(w)
    // The .st-browse class never appears in the implementation, so the original assertion was a vacuous one (always true);
    // changed it to a real constraint on the number of action-area buttons — only one delete button — which is
    // the check that would actually fail if the "browse entry not rendered" claim were false.
    expect(w.findAll('.st-actions button')).toHaveLength(1)
    expect(w.text()).not.toContain(zh.filesTitle ?? '文件')
  })
  it('switching volumes → resets the expanded state and refetches (does not carry over the expanded set from the old volume)', async () => {
    // Old volume: a single entry, on a date completely different from the new volume (2026-07-15), expanded by default.
    // New volume: 3 groups (2+1+1), the default-expand rule is "the most recent 2 groups" — if switching volumes does not reset
    // expandedKeys/expandInitialized, the old volume's expand key ('2026-07-15') finds no match in the new
    // volume's grouping, causing all three of the new volume's groups to stay "collapsed" (0 items visible), instead of the
    // default-expand result the new volume should actually have (2 items + 1 item = 3 items visible, third group collapsed).
    listMock
      .mockResolvedValueOnce([{ id: 1, name: 'old', type: 'manual', created_at: day(15, 9) }])
      .mockResolvedValueOnce([
        { id: 2, name: 'a', type: 'auto-hourly', created_at: day(27, 9) },
        { id: 3, name: 'b', type: 'manual', label: '新卷', created_at: day(27, 20) },
        { id: 4, name: 'c', type: 'preop', created_at: day(26, 8) },
        { id: 5, name: 'd', type: 'auto-daily', created_at: day(20, 8) },
      ])
    const w = mountIt(); await flush(w)
    expect(w.findAll('.st-item')).toHaveLength(1)   // old volume: a single entry, expanded by default
    listMock.mockClear()
    await w.setProps({ volumeUuid: 'u2' }); await flush(w)
    expect(listMock).toHaveBeenCalledWith('u2')
    expect(w.findAll('.st-group-header')).toHaveLength(3)
    // The new volume renders with the most recent 2 groups expanded by default (2 items + 1 item = 3 items visible, third group collapsed) —
    // this is the direct evidence that the expanded state was reset and the default expansion recomputed for the new volume.
    expect(w.findAll('.st-item')).toHaveLength(3)
  })
})

describe('SnapshotTimeline delete', () => {
  const one = [{ id: 1, name: '20260727T090000Z_manual_升级前', type: 'manual', created_at: day(27, 9) }]

  it('an item has a delete button; clicking pops a confirm dialog (no request sent yet at this point)', async () => {
    listMock.mockResolvedValue(one)
    const w = mountIt(); await flush(w)
    expect(w.find('.st-delete').exists()).toBe(true)
    await w.find('.st-delete').trigger('click'); await flush(w)
    expect(document.body.querySelector('.sdd-ok')).not.toBeNull()
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('sends remove(name, uuid) only after confirming, the item disappears from the list on success', async () => {
    listMock.mockResolvedValue(one)
    removeMock.mockResolvedValue(undefined)
    const w = mountIt(); await flush(w)
    await w.find('.st-delete').trigger('click'); await flush(w)
    ;(document.body.querySelector('.sdd-ok') as HTMLButtonElement).click()
    await flush(w)
    expect(removeMock).toHaveBeenCalledWith('20260727T090000Z_manual_升级前', 'u1')
    expect(w.findAll('.st-item')).toHaveLength(0)
  })

  it('cancel → no request sent, the item is still there', async () => {
    listMock.mockResolvedValue(one)
    const w = mountIt(); await flush(w)
    await w.find('.st-delete').trigger('click'); await flush(w)
    ;(document.body.querySelector('.sdd-cancel') as HTMLButtonElement).click()
    await flush(w)
    expect(removeMock).not.toHaveBeenCalled()
    expect(w.findAll('.st-item')).toHaveLength(1)
  })
})

describe('browse button (SP6-P5 backfilled missing item)', () => {
  const SNAP = { id: 1, name: 'snap-a', label: '', type: 'manual', created_at: new Date().toISOString() }

  it('every snapshot item has a browse button', async () => {
    listMock.mockResolvedValue([SNAP])
    const w = mountIt(); await flush(w)
    useSnapshotStore().volume = { volume_uuid: 'u1', mount: '/DATA', supported: true, enabled: true } as never
    await w.vm.$nextTick()
    expect(w.findAll('.st-browse')).toHaveLength(1)
  })
  it('clicking browse navigates to a Files-area deep link, carrying the actual snapshot directory path', async () => {
    listMock.mockResolvedValue([SNAP])
    const w = mountIt(); await flush(w)
    useSnapshotStore().volume = { volume_uuid: 'u1', mount: '/DATA', supported: true, enabled: true } as never
    await w.vm.$nextTick()
    await w.find('.st-browse').trigger('click')
    expect(pushMock).toHaveBeenCalledWith({ path: '/files', query: { path: '/DATA/.snapshots/snap-a' } })
  })
  it('does not show the browse button when the volume mount point is unknown (jumping there would be meaningless)', async () => {
    listMock.mockResolvedValue([SNAP])
    const w = mountIt(); await flush(w)
    useSnapshotStore().volume = null
    await w.vm.$nextTick()
    expect(w.findAll('.st-browse')).toHaveLength(0)
  })
})
