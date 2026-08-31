import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import StorageRaidDetail from './StorageRaidDetail.vue'
import zh from '../i18n/zh_cn'

const raidList = vi.fn().mockResolvedValue([{ id: 7, name: 'md7', level: 5, state: 'active', mount_point: '/DATA', uuid: 'u-7' }])
const raidGetStatus = vi.fn().mockResolvedValue({ live_state: 'active', state: 'active', rebuild_pct: 0, total_bytes: 100, used_bytes: 40, free_bytes: 60, members: [{ path: '/dev/sda', state: 'active sync', number: 0 }] })
const raidGetUsage = vi.fn().mockResolvedValue({ filesystem: 'btrfs', btrfs_usage: { free_estimated_bytes: 55, cached_at: 1700000000 } })
// avail holds one free disk: it's the source for the replace-disk dropdown's candidates (the avail field from GET /v1/disks)
const getDiskList = vi.fn().mockResolvedValue({
  disks: [],
  avail: [{ path: '/dev/sdd', name: 'sdd', model: 'scsi_debug', size: 536870912 }],
})
// The degraded RAID5's member shape is taken from a real device on 2026-07-28: one empty slot + one faulty disk.
// serial was added by the backend on 2026-08-11 (the status endpoint carries it per member); the replace request body uses it to identify the disk being replaced.
const degradedStatus = {
  live_state: 'clean, degraded', state: 'degraded', rebuild_pct: -1,
  total_bytes: 100, used_bytes: 40, free_bytes: 60,
  members: [
    { path: '', state: 'removed', number: 0, slot: 0 },
    { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1, serial: 'S-B' },
    { path: '/dev/sdc', state: 'active sync', number: 3, slot: 2, serial: 'S-C' },
    { path: '/dev/sda', state: 'faulty', number: 0, slot: -1, serial: 'S-A' },
  ],
}
const raidReplaceDisk = vi.fn().mockResolvedValue(undefined)
const snapListVolumes = vi.fn().mockResolvedValue([])
const snapList = vi.fn().mockResolvedValue([])
vi.mock('@nimotech/nimoos-service', () => ({ service: {
  storage: { list: vi.fn().mockResolvedValue([]) }, disks: { getDiskList: (...a: unknown[]) => getDiskList(...a) },
  raid: { list: (...a: unknown[]) => raidList(...a), getStatus: (...a: unknown[]) => raidGetStatus(...a), getUsage: (...a: unknown[]) => raidGetUsage(...a), replaceDisk: (...a: unknown[]) => raidReplaceDisk(...a) },
  snapshot: {
    listVolumes: (...a: unknown[]) => snapListVolumes(...a),
    list: (...a: unknown[]) => snapList(...a),
    getPolicy: vi.fn().mockResolvedValue({}),
    patchPolicy: vi.fn(),
    togglePolicy: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
} }))
vi.mock('../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: () => vi.fn() }) }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const Stub = defineComponent({ render: () => null })
const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/storage/raid/:id', name: 'storage-raid-detail', component: StorageRaidDetail },
  { path: '/storage/raid', name: 'storage-raid', component: Stub }, { path: '/', component: Stub },
] })

// Auto-unmount the wrapper between test cases. Many places in this file use attachTo:
// document.body + manually clear body; without unmounting, a live component left behind by the
// previous test case gets re-rendered when a later test case changes the store, patching a node
// that has already detached from the DOM and throwing "Cannot read properties of null (reading
// 'nextSibling')".
enableAutoUnmount(afterEach)

describe('StorageRaidDetail', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
  it('loads detail: name + RAID level + usage + members + btrfs row', async () => {
    await router.push('/storage/raid/7'); await router.isReady()
    const store = (await import('../storage/stores/storage')).useStorageStore()
    await store.loadRaid() // populate raidArrays first so detail can find the array
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(w.text()).toContain('md7')
    expect(w.text()).toContain('RAID 5')
    expect(w.text()).toContain('/dev/sda')
    expect(raidGetUsage).toHaveBeenCalledWith('7')
  })
  it('write-action button boundary: header write buttons for an active array = [delete] (P4 T8 backfill: recover is absent)', async () => {
    // P3's final review added a hard count invariant (===2); P4 T6 added .rd-delete, so the
    // count necessarily changes -- switched to a semantic assertion: what should appear
    // (back + delete) appears, what should not (recover/replace) is absent.
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()
    expect(w.find('.rd-back').exists()).toBe(true)
    expect(w.find('.rd-delete').exists()).toBe(true)
    expect(w.find('.rd-recover').exists()).toBe(false)
    expect(w.find('.rd-replace').exists()).toBe(false)
  })
  it('write-action button boundary: header write buttons for a retrying array = [delete, recover]', async () => {
    // getStatus gets called twice: loadRaid() pulls list status once + loadRaidDetail() pulls detail status once -- both calls must return retrying
    const retryingStatus = { live_state: 'retrying', state: 'retrying', rebuild_pct: 0, total_bytes: 100, used_bytes: 40, free_bytes: 60, members: [] }
    raidGetStatus.mockResolvedValueOnce(retryingStatus).mockResolvedValueOnce(retryingStatus)
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()
    expect(w.find('.rd-delete').exists()).toBe(true)
    expect(w.find('.rd-recover').exists()).toBe(true)
    expect(w.find('.rd-replace').exists()).toBe(false)
  })
  it('recover button: also renders for failed; clicking calls store.recoverRaid(id) once; disabled while busy', async () => {
    const failedStatus = { live_state: 'failed', state: 'failed', rebuild_pct: 0, total_bytes: 100, used_bytes: 40, free_bytes: 60, members: [] }
    raidGetStatus.mockResolvedValueOnce(failedStatus).mockResolvedValueOnce(failedStatus)
    await router.push('/storage/raid/7'); await router.isReady()
    const store = (await import('../storage/stores/storage')).useStorageStore()
    const recoverSpy = vi.spyOn(store, 'recoverRaid').mockResolvedValue({ state: 'active', readded: [] })
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()
    const btn = w.find('.rd-recover')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(recoverSpy).toHaveBeenCalledTimes(1)
    expect(recoverSpy).toHaveBeenCalledWith('7')

    store.raidRecovering = true
    await w.vm.$nextTick()
    expect(w.find('.rd-recover').attributes('disabled')).toBeDefined()
  })
  // Reclaim member disk (2026-08-12 contract): when status carries reattachable_members, the
  // banner sits before the two-column area (the member list's replace-disk entry point) --
  // reclaiming this array's own disk is a cheap and correct remedy, shown ahead of replace.
  it('reattachable_members non-empty: renders the reclaim banner (serial shown), clicking calls store.reclaimRaidMembers(id)', async () => {
    const reattachStatus = {
      ...degradedStatus,
      reattachable_members: [
        { path: '/dev/sdc', serial: 'WD-XYZ123', role: 'Active device 1', last_update: 'Wed Aug 12 03:43:02 2026' },
      ],
    }
    raidGetStatus.mockResolvedValueOnce(reattachStatus).mockResolvedValueOnce(reattachStatus)
    await router.push('/storage/raid/7'); await router.isReady()
    const store = (await import('../storage/stores/storage')).useStorageStore()
    const reclaimSpy = vi.spyOn(store, 'reclaimRaidMembers').mockResolvedValue(true)
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    const card = w.find('.rrc-card')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('WD-XYZ123')
    // The banner sits before the member list (the replace-disk entry point)
    const html = w.html()
    expect(html.indexOf('rrc-card')).toBeLessThan(html.indexOf('rml-row'))
    await w.find('.rrc-btn').trigger('click')
    expect(reclaimSpy).toHaveBeenCalledTimes(1)
    expect(reclaimSpy).toHaveBeenCalledWith('7')
  })
  it('no reattachable_members (plain degraded) does not render the reclaim banner', async () => {
    raidGetStatus.mockResolvedValueOnce(degradedStatus).mockResolvedValueOnce(degradedStatus)
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(w.find('.rrc-card').exists()).toBe(false)
  })
  it('mounts the snapshot panel in the left column, and looks up the volume by this array uuid', async () => {
    snapListVolumes.mockResolvedValue([{ volume_uuid: 'u-7', supported: true, enabled: true, count: 1, last_at: '2026-07-27T01:00:00Z' }])
    await router.push('/storage/raid/7'); await router.isReady()
    const store = (await import('../storage/stores/storage')).useStorageStore()
    await store.loadRaid()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(w.findComponent({ name: 'SnapshotPanel' }).exists()).toBe(true)
    expect(w.find('.sp-switch').attributes('aria-checked')).toBe('true')
  })

  it('snapshot endpoint 404 → panel falls into an unsupported state, rest of the detail page still renders normally', async () => {
    snapListVolumes.mockRejectedValue(new Error('404'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await router.push('/storage/raid/7'); await router.isReady()
    const store = (await import('../storage/stores/storage')).useStorageStore()
    await store.loadRaid()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(w.find('.sp-unsupported').exists()).toBe(true)
    expect(w.text()).toContain('md7')          // array name still present
    expect(w.text()).toContain('/dev/sda')     // member list still present
    expect(w.find('.rd-delete').exists()).toBe(true)
  })

  // Cold deep-link disk-replace regression: when opening /storage/raid/:id directly (not
  // through the storage volumes / physical disks / create page), the candidate disk list must
  // be loaded by this page itself. Previously the detail page never called loadDrives(),
  // store.availDisks was empty, and the "Replace disk" dropdown was left with only a
  // placeholder item -- but RaidReplaceDialog.test.ts feeds availableDisks in directly as a
  // prop, so that layer's tests can never see this gap.
  it('cold deep-link into a degraded array: the replace-disk dropdown has candidate disks (the detail page loads avail itself)', async () => {
    document.body.innerHTML = ''
    raidGetStatus.mockResolvedValue(degradedStatus)
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { attachTo: document.body, global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()

    expect(getDiskList).toHaveBeenCalled()

    const replaceBtns = w.findAll('.rml-replace')
    expect(replaceBtns.length).toBe(1)
    await replaceBtns[0].trigger('click')
    await w.vm.$nextTick(); await w.vm.$nextTick()

    // reka-ui's DialogPortal teleports content to body, not inside the wrapper -- same
    // approach as RaidReplaceDialog.test.ts, querying from document.body.
    const select = document.body.querySelector<HTMLSelectElement>('.rrd-select')
    expect(select, 'the replace-disk dialog did not render').not.toBeNull()
    const values = [...select!.querySelectorAll('option')]
      .map((o) => o.getAttribute('value')).filter((v) => v)
    expect(values).toEqual(['/dev/sdd'])
  })

  it('cold deep link: when availDisks is empty the dropdown has only the placeholder item (guards the contrast for the assertion above)', async () => {
    document.body.innerHTML = ''
    raidGetStatus.mockResolvedValue(degradedStatus)
    getDiskList.mockResolvedValueOnce({ disks: [], avail: [] })
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { attachTo: document.body, global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    await w.findAll('.rml-replace')[0].trigger('click')
    await w.vm.$nextTick(); await w.vm.$nextTick()
    const select = document.body.querySelector<HTMLSelectElement>('.rrd-select')
    expect(select, 'the replace-disk dialog did not render -- the assertion below would pass vacuously').not.toBeNull()
    const values = [...select!.querySelectorAll('option')]
      .map((o) => o.getAttribute('value')).filter((v) => v)
    expect(values).toEqual([])
  })

  // After a successful disk-replace submission, go back to the list page to watch progress
  // (user-specified interaction). Rebuilding is a long-running job (can take hours on real
  // disks); the list page has a replace-progress kanban card + 5-second polling, so waiting on
  // the detail page has no point.
  it('disk-replace submission succeeds → closes the dialog + creates the replace kanban task + navigates back to the RAID list page', async () => {
    document.body.innerHTML = ''
    raidGetStatus.mockResolvedValue(degradedStatus)
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { attachTo: document.body, global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()

    await w.findAll('.rml-replace')[0].trigger('click')
    await w.vm.$nextTick(); await w.vm.$nextTick()
    const select = document.body.querySelector<HTMLSelectElement>('.rrd-select')!
    select.value = '/dev/sdd'
    select.dispatchEvent(new Event('change'))
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.rrd-ok')!.click()
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()

    // 2026-08-11 serial semantics: the request body carries old_disk_serial (for an in-place
    // faulty disk it's taken from the status member row); not a leftover new disk, so
    // wipe_raid_residue=false.
    expect(raidReplaceDisk).toHaveBeenCalledWith('7', {
      old_disk_path: '/dev/sda', old_disk_serial: 'S-A', new_disk_path: '/dev/sdd', wipe_raid_residue: false,
    })
    const store = (await import('../storage/stores/storage')).useStorageStore()
    expect(store.replaceTask).toMatchObject({ arrayId: '7', oldPath: '/dev/sda', newPath: '/dev/sdd' })
    expect(router.currentRoute.value.path).toBe('/storage/raid')
  })

  // Yanked-disk scenario (2026-08-11 incident shape): there's no faulty row, only an empty
  // slot; the pulled disk's device letter has already been reused by the new disk. The target
  // must be identified by serial (label=serial), old_disk_path is sent empty, and the candidate
  // disk list is not cleared just because the path collides.
  it('a pulled disk: identifies the target by serial, the dialog shows the serial, the request sends old_disk_path empty', async () => {
    document.body.innerHTML = ''
    const pulledStatus = {
      live_state: 'clean, degraded', state: 'degraded', rebuild_pct: -1,
      total_bytes: 100, used_bytes: 40, free_bytes: 60,
      members: [
        { path: '/dev/sda', state: 'active sync', number: 0, slot: 0, serial: 'OLD-1' },
        { path: '/dev/sdb', state: 'active sync', number: 1, slot: 1, serial: 'OLD-2' },
        { path: '/dev/sdc', state: 'active sync', number: 2, slot: 2, serial: 'OLD-3' },
        { path: '', state: 'removed', number: 3, slot: 3 },
      ],
    }
    const memberDisks = [
      { disk_by_id: 'i1', disk_serial: 'OLD-1', device_path_cache: '/dev/sda' },
      { disk_by_id: 'i2', disk_serial: 'OLD-2', device_path_cache: '/dev/sdb' },
      { disk_by_id: 'i3', disk_serial: 'OLD-3', device_path_cache: '/dev/sdc' },
      { disk_by_id: 'i4', disk_serial: 'OLD-4', device_path_cache: '/dev/sdd' }, // already pulled; path reused by the new disk
    ]
    // loadRaid runs twice in this test case (entering the page + the finally-block refresh after replace), both passes need to return the array with member_disks.
    raidList
      .mockResolvedValueOnce([{ id: 7, name: 'md7', level: 5, state: 'degraded', mount_point: '/DATA', uuid: 'u-7', member_disks: memberDisks }])
      .mockResolvedValueOnce([{ id: 7, name: 'md7', level: 5, state: 'degraded', mount_point: '/DATA', uuid: 'u-7', member_disks: memberDisks }])
    raidGetStatus.mockResolvedValue(pulledStatus)
    // The new disk sits at the pulled disk's old path /dev/sdd
    getDiskList.mockResolvedValue({ disks: [], avail: [{ path: '/dev/sdd', name: 'sdd', model: 'x', size: 536870912, serial: 'NEW-1' }] })
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { attachTo: document.body, global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()

    // The empty-slot row also has a replace entry point (a pulled disk has no faulty row)
    const replaceBtns = w.findAll('.rml-replace')
    expect(replaceBtns.length).toBe(1)
    await replaceBtns[0].trigger('click')
    await w.vm.$nextTick(); await w.vm.$nextTick()

    // The faulty disk displays its serial (the cached path may already belong to a different disk, so it is not shown as identity)
    expect(document.body.querySelector<HTMLInputElement>('.rrd-input')!.value).toBe('OLD-4')
    // The candidate disk list was not cleared just because the path collided
    const select = document.body.querySelector<HTMLSelectElement>('.rrd-select')!
    const values = Array.from(select.options).map((o) => o.value).filter(Boolean)
    expect(values).toEqual(['/dev/sdd'])

    select.value = '/dev/sdd'
    select.dispatchEvent(new Event('change'))
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.rrd-ok')!.click()
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()

    expect(raidReplaceDisk).toHaveBeenCalledWith('7', {
      old_disk_path: '', old_disk_serial: 'OLD-4', new_disk_path: '/dev/sdd', wipe_raid_residue: false,
    })
    const store = (await import('../storage/stores/storage')).useStorageStore()
    // The kanban card displays the fallback serial (old_disk_path is empty)
    expect(store.replaceTask).toMatchObject({ arrayId: '7', oldPath: 'OLD-4', newPath: '/dev/sdd' })
    // Restore getDiskList's default return, to avoid leaking into later test cases
    getDiskList.mockResolvedValue({ disks: [], avail: [{ path: '/dev/sdd', name: 'sdd', model: 'scsi_debug', size: 536870912 }] })
  })

  it('disk-replace API call fails → no kanban task is created, no navigation (stays on the detail page)', async () => {
    document.body.innerHTML = ''
    raidGetStatus.mockResolvedValue(degradedStatus)
    raidReplaceDisk.mockRejectedValueOnce(new Error('500'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { attachTo: document.body, global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()

    await w.findAll('.rml-replace')[0].trigger('click')
    await w.vm.$nextTick(); await w.vm.$nextTick()
    const select = document.body.querySelector<HTMLSelectElement>('.rrd-select')!
    select.value = '/dev/sdd'
    select.dispatchEvent(new Event('change'))
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.rrd-ok')!.click()
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick()

    const store = (await import('../storage/stores/storage')).useStorageStore()
    expect(store.replaceTask).toBeNull()
    expect(router.currentRoute.value.path).toBe('/storage/raid/7')
  })

  // ── Stale snapshot regression (found in on-device testing) ────────────────────────────────────
  // After replacing a disk, re-entering the detail page used to render the store's
  // **pre-replace** frame verbatim (empty slot + faulty disk, 4 member rows), which looked like
  // the replace hadn't taken effect. Entering the page has to run two serial requests before
  // that store state updates, and without clearing it in the meantime, it renders the stale
  // data.
  it('clears the stale snapshot on entering the page: shows a loading state while loading, does not render the previous member list', async () => {
    raidGetStatus.mockResolvedValue(degradedStatus)
    await router.push('/storage/raid/7'); await router.isReady()
    const store = (await import('../storage/stores/storage')).useStorageStore()
    // Pre-seed a stale "pre-replace" snapshot (4 member rows, including a faulty disk)
    store.raidDetail = {
      array: { id: 7, name: 'md7', level: 5, state: 'degraded' },
      status: degradedStatus,
      usage: null,
    } as never

    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await w.vm.$nextTick()
    // The request hasn't resolved yet: must be a loading state, must not display the stale /dev/sda (faulty disk)
    expect(w.find('.rd-loading').exists()).toBe(true)
    expect(w.findAll('.rml-row').length).toBe(0)

    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(w.find('.rd-loading').exists()).toBe(false)
    expect(w.findAll('.rml-row').length).toBeGreaterThan(0)
  })

  it('store holds detail for a different array → does not render (only honours the current :id)', async () => {
    raidGetStatus.mockResolvedValue(degradedStatus)
    await router.push('/storage/raid/7'); await router.isReady()
    const store = (await import('../storage/stores/storage')).useStorageStore()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    // Inject data impersonating a different array into the store
    store.raidDetail = {
      array: { id: 99, name: 'other-array', level: 1, state: 'active' },
      status: degradedStatus, usage: null,
    } as never
    await w.vm.$nextTick()
    expect(w.find('.rd-loading').exists()).toBe(true)
    expect(w.text()).not.toContain('other-array')
  })

  // When :id changes the component instance is reused by the router, onMounted never runs again -- without a watcher it would keep showing the previous array
  it(':id changes → refetches the detail for that array', async () => {
    raidGetStatus.mockResolvedValue(degradedStatus)
    raidList.mockResolvedValue([
      { id: 7, name: 'md7', level: 5, state: 'degraded', mount_point: '/DATA', uuid: 'u-7' },
      { id: 8, name: 'md8', level: 1, state: 'active', mount_point: '/DATA2', uuid: 'u-8' },
    ])
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(w.text()).toContain('md7')

    await router.push('/storage/raid/8')
    await w.vm.$nextTick()
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    expect(w.text()).toContain('md8')
    expect(w.text()).not.toContain('md7')
  })

  // The header count uses "rows that have a device path" rather than the total row count: an empty-slot placeholder row is not a disk.
  it('degraded RAID5: header writes 3 member disks (not 4 rows)', async () => {
    raidGetStatus.mockResolvedValue(degradedStatus)
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    // A single dropped disk gets merged into the faulty-disk row → 3 rows, header (3), no more "header says 3 but there are 4 rows"
    const title = w.findAll('.rd-card-title').map((n) => n.text()).find((x) => x.includes('成员磁盘'))
    expect(title).toBe('成员磁盘 (3)')
    expect(w.findAll('.rml-row').length).toBe(3)
    expect(w.findAll('.rml-path').map((n) => n.text())).toEqual(['槽位 0 · /dev/sda', '/dev/sdb', '/dev/sdc'])
  })

  it('healthy array: header does not mention empty slots, just writes the disk count', async () => {
    raidGetStatus.mockResolvedValue({
      live_state: 'clean', state: 'active', rebuild_pct: -1, total_bytes: 100, used_bytes: 40, free_bytes: 60,
      members: [
        { path: '/dev/sdb', state: 'active sync', number: 1, slot: 0 },
        { path: '/dev/sdc', state: 'active sync', number: 3, slot: 1 },
        { path: '/dev/sdd', state: 'active sync', number: 4, slot: 2 },
      ],
    })
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    const title = w.findAll('.rd-card-title').map((n) => n.text()).find((x) => x.includes('成员磁盘'))
    expect(title).toBe('成员磁盘 (3)')
    expect(w.findAll('.rml-row').length).toBe(3)
  })

  // RAID 6 can lose two disks at once → two empty slots, goes through the plural copy
  it('two empty slots: header writes out the empty-slot count', async () => {
    raidGetStatus.mockResolvedValue({
      live_state: 'clean, degraded', state: 'degraded', rebuild_pct: -1, total_bytes: 100, used_bytes: 40, free_bytes: 60,
      members: [
        { path: '', state: 'removed', number: 0, slot: 0 },
        { path: '', state: 'removed', number: 1, slot: 1 },
        { path: '/dev/sdc', state: 'active sync', number: 3, slot: 2 },
        { path: '/dev/sdd', state: 'active sync', number: 4, slot: 3 },
        { path: '/dev/sda', state: 'faulty', number: 0, slot: -1 },
        { path: '/dev/sdb', state: 'faulty', number: 1, slot: -1 },
      ],
    })
    await router.push('/storage/raid/7'); await router.isReady()
    const w = mount(StorageRaidDetail, { global: { plugins: [router, i18n] } })
    await new Promise((r) => setTimeout(r)); await w.vm.$nextTick(); await w.vm.$nextTick()
    // Two faults can't be uniquely paired → not merged, only now does the header need to write the empty-slot count
    const title = w.findAll('.rd-card-title').map((n) => n.text()).find((x) => x.includes('成员磁盘'))
    expect(title).toBe('成员磁盘 (4 块 · 2 个空槽位)')
    expect(w.findAll('.rml-row').length).toBe(6)
  })
})
