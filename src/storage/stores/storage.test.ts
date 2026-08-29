import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const storageList = vi.fn()
const raidList = vi.fn()
const raidGetStatus = vi.fn()
const raidGetUsage = vi.fn()
const listTasks = vi.fn()
const getTask = vi.fn()
const getDiskList = vi.fn()
const umount = vi.fn()
const createMock = vi.fn()
const formatMock = vi.fn()
const raidCreateMock = vi.fn()
const raidRemoveMock = vi.fn()
const raidReplaceDiskMock = vi.fn()
const raidRecoverMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    storage: {
      list: (...a: unknown[]) => storageList(...a),
      create: (...a: unknown[]) => createMock(...a),
      format: (...a: unknown[]) => formatMock(...a),
    },
    raid: {
      list: (...a: unknown[]) => raidList(...a),
      getStatus: (...a: unknown[]) => raidGetStatus(...a),
      getUsage: (...a: unknown[]) => raidGetUsage(...a),
      listTasks: (...a: unknown[]) => listTasks(...a),
      getTask: (...a: unknown[]) => getTask(...a),
      create: (...a: unknown[]) => raidCreateMock(...a),
      remove: (...a: unknown[]) => raidRemoveMock(...a),
      replaceDisk: (...a: unknown[]) => raidReplaceDiskMock(...a),
      recover: (...a: unknown[]) => raidRecoverMock(...a),
    },
    disks: { getDiskList: (...a: unknown[]) => getDiskList(...a), umount: (...a: unknown[]) => umount(...a) },
  },
}))
const toastShow = vi.fn()
vi.mock('../../stores/toast', () => ({ useToast: () => ({ show: toastShow }) }))
vi.mock('../../i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

import { useStorageStore } from './storage'

const GROUPS = [
  { disk_name: 'System', path: '/dev/nvme0n1', children: [{ label: 'NimoOS-HD', mount_point: '/', size: '100', avail: '40', type: 'ext4', drive_name: 'p7', path: '/dev/nvme0n1p7', uuid: 'u1' }] },
  { disk_name: 'S1', path: '/dev/sda', children: [{ label: 'raidvol', mount_point: '/mnt/r0', size: '10', avail: '5', type: 'ext4', drive_name: 'sda1', path: '/dev/sda1', uuid: 'u2' }] },
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('loadVolumes', () => {
  it('storage+raid fetched in parallel, RAID mount points excluded', async () => {
    storageList.mockResolvedValue(GROUPS)
    raidList.mockResolvedValue([{ id: 1, mount_point: '/mnt/r0' }])
    const s = useStorageStore()
    await s.loadVolumes()
    expect(storageList).toHaveBeenCalledWith({ system: 'show' })
    expect(s.volumes).toHaveLength(1)
    expect(s.volumes[0].name).toBe('NimoOS-HD')
  })
  it('raid.list failure does not affect the volume list', async () => {
    storageList.mockResolvedValue(GROUPS)
    raidList.mockRejectedValue(new Error('404'))
    const s = useStorageStore()
    await s.loadVolumes()
    expect(s.volumes).toHaveLength(2)
  })
  it('storage.list failure clears to empty, does not throw', async () => {
    storageList.mockRejectedValue(new Error('boom'))
    raidList.mockResolvedValue([])
    const s = useStorageStore()
    await expect(s.loadVolumes()).resolves.toBeUndefined()
    expect(s.volumes).toEqual([])
  })
  it('failure resets raidNames, no stale value left from the last success', async () => {
    storageList.mockResolvedValue(GROUPS)
    raidList.mockResolvedValue([{ id: 1, mount_point: '/mnt/r0', name: 'raid0' }])
    const s = useStorageStore()
    await s.loadVolumes()
    expect(s.raidNames).toEqual(['raid0'])
    storageList.mockRejectedValue(new Error('boom'))
    await s.loadVolumes()
    expect(s.raidNames).toEqual([])
  })
})

describe('loadDrives', () => {
  it('maps the disks field', async () => {
    getDiskList.mockResolvedValue({ disks: [{ name: 'nvme0n1', model: 'M', size: 100, disk_type: 'SSD', health: 'true', temperature: 35 }], avail: [] })
    const s = useStorageStore()
    await s.loadDrives()
    expect(s.drives).toHaveLength(1)
    expect(s.drives[0].healthy).toBe(true)
  })
  it('failure clears to empty, does not throw', async () => {
    getDiskList.mockRejectedValue(new Error('x'))
    const s = useStorageStore()
    await expect(s.loadDrives()).resolves.toBeUndefined()
    expect(s.drives).toEqual([])
  })
})

describe('unmount', () => {
  it('success: sends {path,password}, shows success toast copy, reloads, returns true', async () => {
    umount.mockResolvedValue({})
    storageList.mockResolvedValue([])
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [] })
    const s = useStorageStore()
    const ok = await s.unmount('/dev/sda', 'pw')
    expect(umount).toHaveBeenCalledWith({ path: '/dev/sda', password: 'pw' })
    expect(toastShow).toHaveBeenCalledWith('storageUnmountSuccess')
    expect(storageList).toHaveBeenCalled()
    expect(ok).toBe(true)
  })
  it('failure: shows failure toast copy, returns false, does not throw', async () => {
    umount.mockRejectedValue(new Error('wrong password'))
    const s = useStorageStore()
    const ok = await s.unmount('/dev/sda', 'bad')
    expect(toastShow).toHaveBeenCalledWith('storageUnmountFailed')
    expect(ok).toBe(false)
  })
})

describe('createStorage', () => {
  it('POST /storage request body matches {path,name,format} verbatim, success toast + returns true', async () => {
    createMock.mockResolvedValue({})
    storageList.mockResolvedValue([])
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [], avail: [] })
    const s = useStorageStore()
    const ok = await s.createStorage({ path: '/dev/sdb', name: 'Main-storage', format: true })
    expect(ok).toBe(true)
    expect(createMock).toHaveBeenCalledWith({ path: '/dev/sdb', name: 'Main-storage', format: true })
    expect(toastShow).toHaveBeenCalledWith('storageCreateSuccess')
  })
  it('failure returns false + failure toast, and both success and failure refresh the list (Vue2 semantics)', async () => {
    createMock.mockRejectedValue(new Error('boom'))
    storageList.mockResolvedValue([])
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [], avail: [] })
    const s = useStorageStore()
    const ok = await s.createStorage({ path: '/dev/sdb', name: 'a', format: false })
    expect(ok).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('storageCreateFailed')
    expect(storageList).toHaveBeenCalled() // loadAll reaches storage.list
  })
  it('in-flight guard: calling again while create is in progress returns false directly, without re-sending the request', async () => {
    let resolve!: (v: unknown) => void
    createMock.mockReturnValue(new Promise((r) => (resolve = r)))
    storageList.mockResolvedValue([])
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [], avail: [] })
    const s = useStorageStore()
    const p1 = s.createStorage({ path: '/dev/sdb', name: 'a', format: true })
    const p2 = s.createStorage({ path: '/dev/sdb', name: 'a', format: true })
    await expect(p2).resolves.toBe(false)
    expect(createMock).toHaveBeenCalledTimes(1)
    resolve({})
    await expect(p1).resolves.toBe(true)
  })
  it('the failure-path guard holds across the refresh: calling again inside the refresh pending window still returns false, only one request is sent', async () => {
    createMock.mockRejectedValue(new Error('boom'))
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [], avail: [] })
    let resolveList!: (v: unknown) => void
    storageList.mockReturnValue(new Promise((r) => (resolveList = r)))
    const s = useStorageStore()
    const p1 = s.createStorage({ path: '/dev/sdb', name: 'a', format: true })
    // Let create()'s reject settle and enter the pending window of loadAll in finally (storage.list not yet resolved)
    await Promise.resolve()
    await Promise.resolve()
    const p2 = s.createStorage({ path: '/dev/sdb', name: 'a', format: true })
    await expect(p2).resolves.toBe(false)
    expect(createMock).toHaveBeenCalledTimes(1)
    resolveList([])
    await expect(p1).resolves.toBe(false)
  })
})

describe('formatVolume', () => {
  it('PUT /storage request body matches {path,volume,password} verbatim, only refreshes on success', async () => {
    formatMock.mockResolvedValue({})
    storageList.mockResolvedValue([])
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [], avail: [] })
    const s = useStorageStore()
    const ok = await s.formatVolume({ path: '/dev/sdb1', volume: '/mnt/a', password: 'pw' })
    expect(ok).toBe(true)
    expect(formatMock).toHaveBeenCalledWith({ path: '/dev/sdb1', volume: '/mnt/a', password: 'pw' })
  })
  it('failure logs only the message (not the whole error, to avoid leaking the plaintext password)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    formatMock.mockRejectedValue(Object.assign(new Error('bad'), { config: { data: 'password=pw' } }))
    const s = useStorageStore()
    const ok = await s.formatVolume({ path: '/dev/sdb1', volume: '/mnt/a', password: 'pw' })
    expect(ok).toBe(false)
    for (const call of warn.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('password=pw')
    }
    warn.mockRestore()
  })
})

describe('unmount in-flight guard (P1 debt #1)', () => {
  it('calling again while in progress returns false and only sends one request', async () => {
    let resolve!: (v: unknown) => void
    umount.mockReturnValue(new Promise((r) => (resolve = r)))
    const s = useStorageStore()
    const p1 = s.unmount('/dev/sda', 'pw')
    const p2 = s.unmount('/dev/sda', 'pw')
    await expect(p2).resolves.toBe(false)
    expect(umount).toHaveBeenCalledTimes(1)
    resolve({})
    await expect(p1).resolves.toBe(true)
  })
})

describe('loadDrives candidate disks', () => {
  it('avail field maps into availDisks', async () => {
    getDiskList.mockResolvedValue({ disks: [], avail: [{ path: '/dev/sdb', name: 'sdb', need_format: 'true' }] })
    const s = useStorageStore()
    await s.loadDrives()
    expect(s.availDisks).toHaveLength(1)
    expect(s.availDisks[0].needFormat).toBe(true)
  })
})

describe('loadRaid', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('list + per-array getStatus populates raidArrays/raidStatusMap', async () => {
    raidList.mockResolvedValue([{ id: 1, name: 'md0', level: 1, state: 'active' }])
    raidGetStatus.mockResolvedValue({ live_state: 'active', state: 'active', rebuild_pct: 0, total_bytes: 100, used_bytes: 40, free_bytes: 60, members: [] })
    const store = useStorageStore()
    await store.loadRaid()
    expect(store.raidArrays.length).toBe(1)
    expect(store.raidArrays[0].name).toBe('md0')
    expect(store.raidStatusMap['1'].used_bytes).toBe(40)
  })

  it('raid.list failure → raidArrays resets to empty, does not throw', async () => {
    raidList.mockRejectedValue(new Error('boom'))
    const store = useStorageStore()
    await store.loadRaid()
    expect(store.raidArrays).toEqual([])
  })

  it('a single getStatus failure does not take down the whole table', async () => {
    raidList.mockResolvedValue([{ id: 1, name: 'a', level: 1, state: 'active' }, { id: 2, name: 'b', level: 1, state: 'active' }])
    raidGetStatus.mockImplementation((id: number) => id === 1 ? Promise.reject(new Error('x')) : Promise.resolve({ live_state: 'active', members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0, rebuild_pct: 0 }))
    const store = useStorageStore()
    await store.loadRaid()
    expect(store.raidArrays.length).toBe(2)
    expect(store.raidStatusMap['2']).toBeTruthy()
    expect(store.raidStatusMap['1']).toBeUndefined()
  })

  it('in-flight guard: the second concurrent loadRaid call bails out early', async () => {
    let resolve1: (v: unknown) => void = () => {}
    raidList.mockReturnValue(new Promise((r) => { resolve1 = r }))
    const store = useStorageStore()
    const p1 = store.loadRaid()
    const p2 = store.loadRaid() // should bail early
    resolve1([])
    await Promise.all([p1, p2])
    expect(raidList).toHaveBeenCalledTimes(1)
  })
})

describe('loadRaidDetail', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
  it('getStatus + getUsage populate raidDetail', async () => {
    raidList.mockResolvedValue([{ id: 7, name: 'md7', level: 5, state: 'active' }])
    raidGetStatus.mockResolvedValue({ live_state: 'active', members: [], total_bytes: 9, used_bytes: 3, free_bytes: 6, rebuild_pct: 0 })
    raidGetUsage.mockResolvedValue({ filesystem: 'btrfs', btrfs_usage: { free_estimated_bytes: 5, cached_at: 123 } })
    const store = useStorageStore()
    await store.loadRaid()
    await store.loadRaidDetail(7)
    expect(store.raidDetail?.array.name).toBe('md7')
    expect(store.raidDetail?.status?.used_bytes).toBe(3)
    expect((store.raidDetail?.usage as { filesystem?: string })?.filesystem).toBe('btrfs')
  })
})

describe('create task detection/polling', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('detectCreatingTask picks up a task in creating state', async () => {
    listTasks.mockResolvedValue([{ task_id: 't1', name: 'md0', level: 5, disk_count: 3, status: 'done' }, { task_id: 't2', name: 'md1', level: 1, disk_count: 2, status: 'creating', step: 2, progress: 20 }])
    const store = useStorageStore()
    await store.detectCreatingTask()
    expect(store.creatingTask?.taskId).toBe('t2')
    expect(store.creatingTask?.status).toBe('creating')
  })

  it('creatingTask stays null when there is no creating task', async () => {
    listTasks.mockResolvedValue([{ task_id: 't1', status: 'done' }])
    const store = useStorageStore()
    await store.detectCreatingTask()
    expect(store.creatingTask).toBeNull()
  })

  it('pollCreateTaskOnce: status=done → stops and loadRaid, clears the card after 1000ms', async () => {
    vi.useFakeTimers()
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    getTask.mockResolvedValue({ task_id: 't2', status: 'done', step: 6, progress: 100 })
    raidList.mockResolvedValue([])
    const store = useStorageStore()
    await store.detectCreatingTask()
    await store.pollCreateTaskOnce()
    expect(store.creatingTask?.status).toBe('done')
    expect(raidList).toHaveBeenCalled() // done triggers loadRaid
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.creatingTask).toBeNull() // cleared after 1000ms
    vi.useRealTimers()
  })

  it('pollCreateTaskOnce: status=failed → the card is kept', async () => {
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    getTask.mockResolvedValue({ task_id: 't2', status: 'failed', error: 'boom', step: 3 })
    const store = useStorageStore()
    await store.detectCreatingTask()
    await store.pollCreateTaskOnce()
    expect(store.creatingTask?.status).toBe('failed')
    expect(store.creatingTask?.error).toBe('boom')
  })

  it('pollCreateTaskOnce: getTask 404 (envelope shape {code:404}) → clears the card + loadRaid', async () => {
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    const err = Object.assign(new Error('nf'), { code: 404 }) // service unwrap writes success into .code
    getTask.mockRejectedValue(err)
    raidList.mockResolvedValue([])
    const store = useStorageStore()
    await store.detectCreatingTask()
    await store.pollCreateTaskOnce()
    expect(store.creatingTask).toBeNull()
  })

  it('pollCreateTaskOnce: getTask 404 (real axios shape, code=string + response.status) → clears the card + loadRaid', async () => {
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    // Real AxiosError: .code is a non-numeric string ('ERR_BAD_REQUEST'); the numeric status code is at .response.status —— a ?? chain would misjudge it as non-404
    const err = Object.assign(new Error('nf'), { code: 'ERR_BAD_REQUEST', response: { status: 404 } })
    getTask.mockRejectedValue(err)
    raidList.mockResolvedValue([])
    const store = useStorageStore()
    await store.detectCreatingTask()
    await store.pollCreateTaskOnce()
    expect(store.creatingTask).toBeNull()
  })

  it('pollCreateTaskOnce: done-clear timer identity guard — a new task swapped in during the window is not mistakenly cleared', async () => {
    vi.useFakeTimers()
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    getTask.mockResolvedValue({ task_id: 't2', status: 'done', step: 6, progress: 100 })
    raidList.mockResolvedValue([])
    const store = useStorageStore()
    await store.detectCreatingTask()
    await store.pollCreateTaskOnce()
    expect(store.creatingTask?.status).toBe('done') // done timer (clears t2) is queued but has not fired yet
    store.startCreateTask({
      taskId: 't3',
      name: 'y',
      level: 5,
      filesystem: 'btrfs',
      diskCount: 3,
      step: 1,
      stepName: '',
      progress: 10,
      elapsedSeconds: 0,
      error: '',
      status: 'creating',
    })
    await vi.advanceTimersByTimeAsync(1000)
    // The old timer only recognizes t2; it must not clear the newly attached t3
    expect(store.creatingTask).not.toBeNull()
    expect(store.creatingTask?.taskId).toBe('t3')
    vi.useRealTimers()
  })

  it('pollCreateTaskOnce: when getTask returns a sparse payload, keeps the current name/level/filesystem/diskCount (not cleared)', async () => {
    listTasks.mockResolvedValue([{ task_id: 't2', name: 'md-a', level: 5, filesystem: 'btrfs', disk_count: 4, status: 'creating', step: 1, progress: 10 }])
    getTask.mockResolvedValue({ task_id: 't2', status: 'creating', step: 2, progress: 30 }) // no name/level/filesystem/disk_count
    const store = useStorageStore()
    await store.detectCreatingTask()
    expect(store.creatingTask?.name).toBe('md-a')
    await store.pollCreateTaskOnce()
    expect(store.creatingTask?.name).toBe('md-a')
    expect(store.creatingTask?.level).toBe(5)
    expect(store.creatingTask?.filesystem).toBe('btrfs')
    expect(store.creatingTask?.diskCount).toBe(4)
    expect(store.creatingTask?.progress).toBe(30) // confirms the new payload was actually used, not that merging never happened
  })

  it('dismissCreateTask clears the card', async () => {
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    const store = useStorageStore()
    await store.detectCreatingTask()
    store.dismissCreateTask()
    expect(store.creatingTask).toBeNull()
  })
})

describe('RAID write actions', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('createRaid sends a POST body matching {name,level,disk_paths,chunk_kb:512,filesystem,enable_snapshots} verbatim; single-flight guard', async () => {
    raidCreateMock.mockResolvedValue({ data: { task_id: 't1' } })
    const s = useStorageStore()
    const body = { name: 'vault', level: 5, disk_paths: ['/dev/sda', '/dev/sdb', '/dev/sdc'], chunk_kb: 512 as const, filesystem: 'btrfs' as const, enable_snapshots: true, wipe_raid_residue: false }
    const p1 = s.createRaid(body)
    const p2 = s.createRaid(body) // second concurrent call swallowed by the guard
    const [r1, r2] = await Promise.all([p1, p2])
    expect(raidCreateMock).toHaveBeenCalledTimes(1)
    expect(raidCreateMock).toHaveBeenCalledWith(body)
    expect(r2).toBeNull() // single-flight: second call returns null directly
    expect(r1).not.toBeNull()
    expect(s.raidCreating).toBe(false) // released in finally
  })

  // Caught during on-device acceptance 07-28: for POST /v2/raid the backend returns bare {task_id,status} (no .data envelope,
  // see the shared service package's src/raid.ts create() comment + route/v2/raid.go:187-190).
  // Previously the store read one extra layer, res?.data?.task_id, got undefined → taskId became an empty string,
  // and the progress modal/polling watched an empty task id forever. This proves the bare shape also yields taskId correctly.
  it('createRaid also extracts taskId from the bare {task_id,status} shape (no .data)', async () => {
    raidCreateMock.mockResolvedValue({ task_id: 'abc', status: 'creating' })
    const s = useStorageStore()
    const r = await s.createRaid({ name: 'vault', level: 5, disk_paths: ['/dev/sda', '/dev/sdb'], chunk_kb: 512, filesystem: 'btrfs', enable_snapshots: false, wipe_raid_residue: false })
    expect(r?.taskId).toBe('abc')
  })

  it('createRaid failure → returns null, warn logs only the message, busy resets', async () => {
    raidCreateMock.mockRejectedValue(Object.assign(new Error('boom'), { config: { data: 'x' } }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useStorageStore()
    const r = await s.createRaid({ name: 'a', level: 0, disk_paths: ['/dev/sda', '/dev/sdb'], chunk_kb: 512, filesystem: 'ext4', enable_snapshots: false, wipe_raid_residue: false })
    expect(r).toBeNull()
    expect(warn).toHaveBeenCalled()
    // Assert the log does not carry the whole error object (no config)
    expect(JSON.stringify(warn.mock.calls)).not.toContain('config')
    expect(s.raidCreating).toBe(false)
    warn.mockRestore()
  })

  it('removeRaid sends DELETE {id} with no body; on success loadRaid refreshes, returns true', async () => {
    raidRemoveMock.mockResolvedValue(undefined)
    raidList.mockResolvedValue([]) // inside loadRaid
    const s = useStorageStore()
    const ok = await s.removeRaid(7)
    expect(raidRemoveMock).toHaveBeenCalledWith(7)
    expect(raidRemoveMock).toHaveBeenCalledTimes(1)
    expect(raidList).toHaveBeenCalled() // refresh happened
    expect(ok).toBe(true)
  })

  it('removeRaid failure → warn logs only the message (no config), finally still refreshes, busy resets', async () => {
    raidRemoveMock.mockRejectedValue(Object.assign(new Error('boom'), { config: { data: 'x' } }))
    raidList.mockResolvedValue([]) // inside loadRaid
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useStorageStore()
    const ok = await s.removeRaid(7)
    expect(ok).toBe(false)
    expect(warn).toHaveBeenCalled()
    expect(JSON.stringify(warn.mock.calls)).not.toContain('config')
    expect(s.raidRemoving).toBe(false) // released in finally
    warn.mockRestore()
  })

  it('replaceRaidDisk sends POST(id, {old_disk_path,old_disk_serial,new_disk_path,wipe_raid_residue}) verbatim', async () => {
    raidReplaceDiskMock.mockResolvedValue(undefined)
    raidList.mockResolvedValue([])
    const s = useStorageStore()
    const ok = await s.replaceRaidDisk(3, { old_disk_path: '/dev/sdb', old_disk_serial: 'S-B', new_disk_path: '/dev/sdd', wipe_raid_residue: false })
    expect(raidReplaceDiskMock).toHaveBeenCalledWith(3, { old_disk_path: '/dev/sdb', old_disk_serial: 'S-B', new_disk_path: '/dev/sdd', wipe_raid_residue: false })
    expect(ok).toBe(true)
  })

  it('replaceRaidDisk failure → warn logs only the message (no config), finally still refreshes, busy resets', async () => {
    raidReplaceDiskMock.mockRejectedValue(Object.assign(new Error('boom'), { config: { data: 'x' } }))
    raidList.mockResolvedValue([])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useStorageStore()
    const ok = await s.replaceRaidDisk(3, { old_disk_path: '/dev/sdb', old_disk_serial: 'S-B', new_disk_path: '/dev/sdd', wipe_raid_residue: false })
    expect(ok).toBe(false)
    expect(warn).toHaveBeenCalled()
    expect(JSON.stringify(warn.mock.calls)).not.toContain('config')
    expect(s.raidReplacing).toBe(false) // released in finally
    warn.mockRestore()
  })

  it('recoverRaid new contract (2026-08-12): Data={state,readded} is returned as-is; non-empty readded creates a reclaimTask', async () => {
    raidRecoverMock.mockResolvedValue({ state: 'rebuilding', readded: ['/dev/sdc'] })
    raidList.mockResolvedValue([{ id: 9, name: 'md9', level: 1, state: 'degraded' }])
    raidGetStatus.mockResolvedValue({ live_state: 'degraded', state: 'degraded', rebuild_pct: -1, total_bytes: 0, used_bytes: 0, free_bytes: 0, members: [{ path: '/dev/sdc', state: 'spare', number: 4 }] })
    const s = useStorageStore()
    const r = await s.recoverRaid(9)
    expect(raidRecoverMock).toHaveBeenCalledWith(9)
    expect(r).toEqual({ state: 'rebuilding', readded: ['/dev/sdc'] })
    // spare state → reclaimOutcome=pending, the task stays alive to hold polling through the spare→recovering transition window
    expect(s.reclaimTask).toEqual({ arrayId: '9', arrayName: '', paths: ['/dev/sdc'] })
  })

  it('recoverRaid is compatible with the old backend nested shape data.data.state; missing readded does not create a task', async () => {
    raidRecoverMock.mockResolvedValue({ data: { data: { state: 'rebuilding' } } })
    raidList.mockResolvedValue([])
    const s = useStorageStore()
    const r = await s.recoverRaid(9)
    expect(r).toEqual({ state: 'rebuilding', readded: [] })
    expect(s.reclaimTask).toBeNull()
  })

  it('recoverRaid failure → warn logs only the message (no config), finally still refreshes, busy resets', async () => {
    raidRecoverMock.mockRejectedValue(Object.assign(new Error('boom'), { config: { data: 'x' } }))
    raidList.mockResolvedValue([])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useStorageStore()
    const r = await s.recoverRaid(9)
    expect(r).toBeNull()
    expect(warn).toHaveBeenCalled()
    expect(JSON.stringify(warn.mock.calls)).not.toContain('config')
    expect(s.raidRecovering).toBe(false) // released in finally
    warn.mockRestore()
  })
})

describe('reclaiming member disks (reclaimRaidMembers / reclaimTask)', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  // right after --re-add returns, the member is still spare (not yet in a rebuilding state) — the task must stay alive, it is the polling switch
  const spareStatus = { live_state: 'degraded', state: 'degraded', rebuild_pct: -1, total_bytes: 0, used_bytes: 0, free_bytes: 0, members: [{ path: '/dev/sdc', state: 'spare', number: 4 }] }

  it('readded non-empty: toasts reclaimed, creates reclaimTask (before loadRaid, the name comes from the already-loaded list)', async () => {
    raidList.mockResolvedValue([{ id: 9, name: 'md9', level: 5, state: 'degraded' }])
    raidGetStatus.mockResolvedValue(spareStatus)
    raidRecoverMock.mockResolvedValue({ state: 'rebuilding', readded: ['/dev/sdc'] })
    const s = useStorageStore()
    await s.loadRaid() // the list must be loaded first for arrayName to resolve
    const ok = await s.reclaimRaidMembers(9)
    expect(ok).toBe(true)
    expect(raidRecoverMock).toHaveBeenCalledWith(9)
    expect(toastShow).toHaveBeenCalledWith('raidReclaimStarted')
    expect(s.reclaimTask).toEqual({ arrayId: '9', arrayName: 'md9', paths: ['/dev/sdc'] })
    expect(s.raidRecovering).toBe(false) // released in finally
  })

  it('readded empty: toasts nothing found to reclaim, does not create a task, still returns true', async () => {
    raidList.mockResolvedValue([])
    raidRecoverMock.mockResolvedValue({ state: 'degraded', readded: [] })
    const s = useStorageStore()
    const ok = await s.reclaimRaidMembers(9)
    expect(ok).toBe(true)
    expect(toastShow).toHaveBeenCalledWith('raidReclaimNothing')
    expect(s.reclaimTask).toBeNull()
  })

  it('failure: toasts reclaim failed, returns false, warn logs only the message, busy resets', async () => {
    raidRecoverMock.mockRejectedValue(Object.assign(new Error('boom'), { config: { data: 'x' } }))
    raidList.mockResolvedValue([])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useStorageStore()
    const ok = await s.reclaimRaidMembers(9)
    expect(ok).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('raidReclaimFailed')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('config')
    expect(s.raidRecovering).toBe(false)
    warn.mockRestore()
  })

  it('after reclaiming, all become active sync → loadRaid clears the task and toasts completion based on array health', async () => {
    raidList.mockResolvedValue([{ id: 9, name: 'md9', level: 5, state: 'degraded' }])
    raidGetStatus.mockResolvedValue(spareStatus)
    raidRecoverMock.mockResolvedValue({ state: 'rebuilding', readded: ['/dev/sdc'] })
    const s = useStorageStore()
    await s.reclaimRaidMembers(9)
    expect(s.reclaimTask).not.toBeNull() // spare state pending, the task is present
    // next tick: the array recovers to active, the reclaimed disk is active sync
    raidList.mockResolvedValue([{ id: 9, name: 'md9', level: 5, state: 'active' }])
    raidGetStatus.mockResolvedValue({ live_state: 'active', state: 'active', rebuild_pct: 0, total_bytes: 0, used_bytes: 0, free_bytes: 0, members: [{ path: '/dev/sdc', state: 'active sync', number: 4 }] })
    await s.loadRaid()
    expect(s.reclaimTask).toBeNull()
    expect(toastShow).toHaveBeenCalledWith('raidReclaimDoneHealthy')
  })

  it('reclaimed disk is active but the array is still degraded → toasts completion but not healthy (no false claims)', async () => {
    raidList.mockResolvedValue([{ id: 9, name: 'md9', level: 5, state: 'degraded' }])
    raidGetStatus.mockResolvedValue(spareStatus)
    raidRecoverMock.mockResolvedValue({ state: 'rebuilding', readded: ['/dev/sdc'] })
    const s = useStorageStore()
    await s.reclaimRaidMembers(9)
    raidGetStatus.mockResolvedValue({ live_state: 'degraded', state: 'degraded', rebuild_pct: 0, total_bytes: 0, used_bytes: 0, free_bytes: 0, members: [{ path: '/dev/sdc', state: 'active sync', number: 4 }, { path: '/dev/sdb', state: 'faulty', number: 1 }] })
    await s.loadRaid()
    expect(s.reclaimTask).toBeNull()
    expect(toastShow).toHaveBeenCalledWith('raidReclaimDoneStillDegraded')
  })

  it('array disappears from the list → the task is withdrawn and no completion is reported', async () => {
    raidList.mockResolvedValue([{ id: 9, name: 'md9', level: 5, state: 'degraded' }])
    raidGetStatus.mockResolvedValue(spareStatus)
    raidRecoverMock.mockResolvedValue({ state: 'rebuilding', readded: ['/dev/sdc'] })
    const s = useStorageStore()
    await s.reclaimRaidMembers(9)
    toastShow.mockClear()
    raidList.mockResolvedValue([])
    await s.loadRaid()
    expect(s.reclaimTask).toBeNull()
    expect(toastShow).not.toHaveBeenCalled()
  })

  it('dismissReclaimTask manually clears the task (escape hatch)', async () => {
    raidList.mockResolvedValue([{ id: 9, name: 'md9', level: 5, state: 'degraded' }])
    raidGetStatus.mockResolvedValue(spareStatus)
    raidRecoverMock.mockResolvedValue({ state: 'rebuilding', readded: ['/dev/sdc'] })
    const s = useStorageStore()
    await s.reclaimRaidMembers(9)
    expect(s.reclaimTask).not.toBeNull()
    s.dismissReclaimTask()
    expect(s.reclaimTask).toBeNull()
  })

  it('in-flight guard: shares raidRecovering with recoverRaid, so it never double-fires concurrently', async () => {
    let resolve!: (v: unknown) => void
    raidRecoverMock.mockReturnValue(new Promise((r) => (resolve = r)))
    raidList.mockResolvedValue([])
    const s = useStorageStore()
    const p1 = s.reclaimRaidMembers(9)
    const p2 = s.reclaimRaidMembers(9)
    const p3 = s.recoverRaid(9)
    await expect(p2).resolves.toBe(false)
    await expect(p3).resolves.toBeNull()
    expect(raidRecoverMock).toHaveBeenCalledTimes(1)
    resolve({ state: 'rebuilding', readded: [] })
    await p1
  })
})
