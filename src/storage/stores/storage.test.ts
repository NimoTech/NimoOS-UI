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
  it('storage+raid 并取,RAID 挂载点被排除', async () => {
    storageList.mockResolvedValue(GROUPS)
    raidList.mockResolvedValue([{ id: 1, mount_point: '/mnt/r0' }])
    const s = useStorageStore()
    await s.loadVolumes()
    expect(storageList).toHaveBeenCalledWith({ system: 'show' })
    expect(s.volumes).toHaveLength(1)
    expect(s.volumes[0].name).toBe('NimoOS-HD')
  })
  it('raid.list 失败不影响卷列表', async () => {
    storageList.mockResolvedValue(GROUPS)
    raidList.mockRejectedValue(new Error('404'))
    const s = useStorageStore()
    await s.loadVolumes()
    expect(s.volumes).toHaveLength(2)
  })
  it('storage.list 失败置空,不抛', async () => {
    storageList.mockRejectedValue(new Error('boom'))
    raidList.mockResolvedValue([])
    const s = useStorageStore()
    await expect(s.loadVolumes()).resolves.toBeUndefined()
    expect(s.volumes).toEqual([])
  })
  it('失败复位 raidNames,不残留上次成功值', async () => {
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
  it('取 disks 字段映射', async () => {
    getDiskList.mockResolvedValue({ disks: [{ name: 'nvme0n1', model: 'M', size: 100, disk_type: 'SSD', health: 'true', temperature: 35 }], avail: [] })
    const s = useStorageStore()
    await s.loadDrives()
    expect(s.drives).toHaveLength(1)
    expect(s.drives[0].healthy).toBe(true)
  })
  it('失败置空不抛', async () => {
    getDiskList.mockRejectedValue(new Error('x'))
    const s = useStorageStore()
    await expect(s.loadDrives()).resolves.toBeUndefined()
    expect(s.drives).toEqual([])
  })
})

describe('unmount', () => {
  it('成功:发 {path,password}、toast 成功文案、重载、返回 true', async () => {
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
  it('失败:toast 失败文案、返回 false、不抛', async () => {
    umount.mockRejectedValue(new Error('wrong password'))
    const s = useStorageStore()
    const ok = await s.unmount('/dev/sda', 'bad')
    expect(toastShow).toHaveBeenCalledWith('storageUnmountFailed')
    expect(ok).toBe(false)
  })
})

describe('createStorage', () => {
  it('POST /storage 请求体逐字 {path,name,format},成功 toast + 返回 true', async () => {
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
  it('失败返回 false + 失败 toast,且成败都刷新列表(Vue2 语义)', async () => {
    createMock.mockRejectedValue(new Error('boom'))
    storageList.mockResolvedValue([])
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [], avail: [] })
    const s = useStorageStore()
    const ok = await s.createStorage({ path: '/dev/sdb', name: 'a', format: false })
    expect(ok).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('storageCreateFailed')
    expect(storageList).toHaveBeenCalled() // loadAll 触达 storage.list
  })
  it('在途守卫:创建进行中再调直接返回 false,不重复发请求', async () => {
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
  it('失败路径守卫跨刷新持有:刷新挂起窗口内再调仍返回 false,只发一次请求', async () => {
    createMock.mockRejectedValue(new Error('boom'))
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [], avail: [] })
    let resolveList!: (v: unknown) => void
    storageList.mockReturnValue(new Promise((r) => (resolveList = r)))
    const s = useStorageStore()
    const p1 = s.createStorage({ path: '/dev/sdb', name: 'a', format: true })
    // 让 create() 的 reject 落定、进入 finally 的 loadAll 挂起窗口(storage.list 未 resolve)
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
  it('PUT /storage 请求体逐字 {path,volume,password},仅成功刷新', async () => {
    formatMock.mockResolvedValue({})
    storageList.mockResolvedValue([])
    raidList.mockResolvedValue([])
    getDiskList.mockResolvedValue({ disks: [], avail: [] })
    const s = useStorageStore()
    const ok = await s.formatVolume({ path: '/dev/sdb1', volume: '/mnt/a', password: 'pw' })
    expect(ok).toBe(true)
    expect(formatMock).toHaveBeenCalledWith({ path: '/dev/sdb1', volume: '/mnt/a', password: 'pw' })
  })
  it('失败只记 message(不打整个 error,防明文密码)', async () => {
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

describe('unmount 在途守卫(P1 债①)', () => {
  it('进行中再调返回 false 且只发一次请求', async () => {
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

describe('loadDrives 候选盘', () => {
  it('avail 字段映射进 availDisks', async () => {
    getDiskList.mockResolvedValue({ disks: [], avail: [{ path: '/dev/sdb', name: 'sdb', need_format: 'true' }] })
    const s = useStorageStore()
    await s.loadDrives()
    expect(s.availDisks).toHaveLength(1)
    expect(s.availDisks[0].needFormat).toBe(true)
  })
})

describe('loadRaid', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('list + 逐阵列 getStatus 填 raidArrays/raidStatusMap', async () => {
    raidList.mockResolvedValue([{ id: 1, name: 'md0', level: 1, state: 'active' }])
    raidGetStatus.mockResolvedValue({ live_state: 'active', state: 'active', rebuild_pct: 0, total_bytes: 100, used_bytes: 40, free_bytes: 60, members: [] })
    const store = useStorageStore()
    await store.loadRaid()
    expect(store.raidArrays.length).toBe(1)
    expect(store.raidArrays[0].name).toBe('md0')
    expect(store.raidStatusMap['1'].used_bytes).toBe(40)
  })

  it('raid.list 失败 → raidArrays 复位空,不抛', async () => {
    raidList.mockRejectedValue(new Error('boom'))
    const store = useStorageStore()
    await store.loadRaid()
    expect(store.raidArrays).toEqual([])
  })

  it('单个 getStatus 失败不拖垮整表', async () => {
    raidList.mockResolvedValue([{ id: 1, name: 'a', level: 1, state: 'active' }, { id: 2, name: 'b', level: 1, state: 'active' }])
    raidGetStatus.mockImplementation((id: number) => id === 1 ? Promise.reject(new Error('x')) : Promise.resolve({ live_state: 'active', members: [], total_bytes: 0, used_bytes: 0, free_bytes: 0, rebuild_pct: 0 }))
    const store = useStorageStore()
    await store.loadRaid()
    expect(store.raidArrays.length).toBe(2)
    expect(store.raidStatusMap['2']).toBeTruthy()
    expect(store.raidStatusMap['1']).toBeUndefined()
  })

  it('在途守卫:loadRaid 并发时第二次早退', async () => {
    let resolve1: (v: unknown) => void = () => {}
    raidList.mockReturnValue(new Promise((r) => { resolve1 = r }))
    const store = useStorageStore()
    const p1 = store.loadRaid()
    const p2 = store.loadRaid() // 应早退
    resolve1([])
    await Promise.all([p1, p2])
    expect(raidList).toHaveBeenCalledTimes(1)
  })
})

describe('loadRaidDetail', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
  it('getStatus + getUsage 填 raidDetail', async () => {
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

describe('创建任务检测/轮询', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('detectCreatingTask 命中 creating 任务', async () => {
    listTasks.mockResolvedValue([{ task_id: 't1', name: 'md0', level: 5, disk_count: 3, status: 'done' }, { task_id: 't2', name: 'md1', level: 1, disk_count: 2, status: 'creating', step: 2, progress: 20 }])
    const store = useStorageStore()
    await store.detectCreatingTask()
    expect(store.creatingTask?.taskId).toBe('t2')
    expect(store.creatingTask?.status).toBe('creating')
  })

  it('无 creating 任务时 creatingTask 保持 null', async () => {
    listTasks.mockResolvedValue([{ task_id: 't1', status: 'done' }])
    const store = useStorageStore()
    await store.detectCreatingTask()
    expect(store.creatingTask).toBeNull()
  })

  it('pollCreateTaskOnce: status=done → 停并 loadRaid,1000ms 后清卡', async () => {
    vi.useFakeTimers()
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    getTask.mockResolvedValue({ task_id: 't2', status: 'done', step: 6, progress: 100 })
    raidList.mockResolvedValue([])
    const store = useStorageStore()
    await store.detectCreatingTask()
    await store.pollCreateTaskOnce()
    expect(store.creatingTask?.status).toBe('done')
    expect(raidList).toHaveBeenCalled() // done 触发 loadRaid
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.creatingTask).toBeNull() // 1000ms 后清
    vi.useRealTimers()
  })

  it('pollCreateTaskOnce: status=failed → 卡保留', async () => {
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    getTask.mockResolvedValue({ task_id: 't2', status: 'failed', error: 'boom', step: 3 })
    const store = useStorageStore()
    await store.detectCreatingTask()
    await store.pollCreateTaskOnce()
    expect(store.creatingTask?.status).toBe('failed')
    expect(store.creatingTask?.error).toBe('boom')
  })

  it('pollCreateTaskOnce: getTask 404(envelope 形状 {code:404}) → 清卡 + loadRaid', async () => {
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    const err = Object.assign(new Error('nf'), { code: 404 }) // service unwrap 把 success 写进 .code
    getTask.mockRejectedValue(err)
    raidList.mockResolvedValue([])
    const store = useStorageStore()
    await store.detectCreatingTask()
    await store.pollCreateTaskOnce()
    expect(store.creatingTask).toBeNull()
  })

  it('pollCreateTaskOnce: getTask 404(真实 axios 形状 code=字符串+response.status) → 清卡 + loadRaid', async () => {
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    // 真实 AxiosError:.code 是非数字字符串('ERR_BAD_REQUEST'),数字状态码在 .response.status —— ?? 链会误判非 404
    const err = Object.assign(new Error('nf'), { code: 'ERR_BAD_REQUEST', response: { status: 404 } })
    getTask.mockRejectedValue(err)
    raidList.mockResolvedValue([])
    const store = useStorageStore()
    await store.detectCreatingTask()
    await store.pollCreateTaskOnce()
    expect(store.creatingTask).toBeNull()
  })

  it('pollCreateTaskOnce: done 清卡定时器身份守卫 —— 窗口内换新任务不被误清', async () => {
    vi.useFakeTimers()
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    getTask.mockResolvedValue({ task_id: 't2', status: 'done', step: 6, progress: 100 })
    raidList.mockResolvedValue([])
    const store = useStorageStore()
    await store.detectCreatingTask()
    await store.pollCreateTaskOnce()
    expect(store.creatingTask?.status).toBe('done') // done 定时器(清 t2)已排队,尚未触发
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
    // 旧定时器只认 t2,不应清掉新挂上的 t3
    expect(store.creatingTask).not.toBeNull()
    expect(store.creatingTask?.taskId).toBe('t3')
    vi.useRealTimers()
  })

  it('pollCreateTaskOnce: getTask 返回稀疏 payload 时保留当前 name/level/filesystem/diskCount(不被清空)', async () => {
    listTasks.mockResolvedValue([{ task_id: 't2', name: 'md-a', level: 5, filesystem: 'btrfs', disk_count: 4, status: 'creating', step: 1, progress: 10 }])
    getTask.mockResolvedValue({ task_id: 't2', status: 'creating', step: 2, progress: 30 }) // 无 name/level/filesystem/disk_count
    const store = useStorageStore()
    await store.detectCreatingTask()
    expect(store.creatingTask?.name).toBe('md-a')
    await store.pollCreateTaskOnce()
    expect(store.creatingTask?.name).toBe('md-a')
    expect(store.creatingTask?.level).toBe(5)
    expect(store.creatingTask?.filesystem).toBe('btrfs')
    expect(store.creatingTask?.diskCount).toBe(4)
    expect(store.creatingTask?.progress).toBe(30) // 确认确实用了新 payload,不是压根没合并
  })

  it('dismissCreateTask 清卡', async () => {
    listTasks.mockResolvedValue([{ task_id: 't2', status: 'creating', name: 'x', level: 1, disk_count: 2 }])
    const store = useStorageStore()
    await store.detectCreatingTask()
    store.dismissCreateTask()
    expect(store.creatingTask).toBeNull()
  })
})

describe('RAID 写 action', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('createRaid 发 POST body 逐字 {name,level,disk_paths,chunk_kb:512,filesystem,enable_snapshots};单飞守卫', async () => {
    raidCreateMock.mockResolvedValue({ data: { task_id: 't1' } })
    const s = useStorageStore()
    const body = { name: 'vault', level: 5, disk_paths: ['/dev/sda', '/dev/sdb', '/dev/sdc'], chunk_kb: 512 as const, filesystem: 'btrfs' as const, enable_snapshots: true }
    const p1 = s.createRaid(body)
    const p2 = s.createRaid(body) // 并发第二发被守卫吞掉
    const [r1, r2] = await Promise.all([p1, p2])
    expect(raidCreateMock).toHaveBeenCalledTimes(1)
    expect(raidCreateMock).toHaveBeenCalledWith(body)
    expect(r2).toBeNull() // 单飞:第二发直接 null
    expect(r1).not.toBeNull()
    expect(s.raidCreating).toBe(false) // finally 释放
  })

  it('createRaid 失败 → 返回 null、warn 只记 message、busy 复位', async () => {
    raidCreateMock.mockRejectedValue(Object.assign(new Error('boom'), { config: { data: 'x' } }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useStorageStore()
    const r = await s.createRaid({ name: 'a', level: 0, disk_paths: ['/dev/sda', '/dev/sdb'], chunk_kb: 512, filesystem: 'ext4', enable_snapshots: false })
    expect(r).toBeNull()
    expect(warn).toHaveBeenCalled()
    // 断言日志不带整个 error 对象(不含 config)
    expect(JSON.stringify(warn.mock.calls)).not.toContain('config')
    expect(s.raidCreating).toBe(false)
    warn.mockRestore()
  })

  it('removeRaid 发 DELETE {id} 无 body;成功 loadRaid 刷新、返回 true', async () => {
    raidRemoveMock.mockResolvedValue(undefined)
    raidList.mockResolvedValue([]) // loadRaid 内部
    const s = useStorageStore()
    const ok = await s.removeRaid(7)
    expect(raidRemoveMock).toHaveBeenCalledWith(7)
    expect(raidRemoveMock).toHaveBeenCalledTimes(1)
    expect(raidList).toHaveBeenCalled() // 刷新发生
    expect(ok).toBe(true)
  })

  it('replaceRaidDisk 发 POST(id, {old_disk_path,new_disk_path}) 逐字', async () => {
    raidReplaceDiskMock.mockResolvedValue(undefined)
    raidList.mockResolvedValue([])
    const s = useStorageStore()
    const ok = await s.replaceRaidDisk(3, { old_disk_path: '/dev/sdb', new_disk_path: '/dev/sdd' })
    expect(raidReplaceDiskMock).toHaveBeenCalledWith(3, { old_disk_path: '/dev/sdb', new_disk_path: '/dev/sdd' })
    expect(ok).toBe(true)
  })

  it('recoverRaid 返回后端 data.state', async () => {
    raidRecoverMock.mockResolvedValue({ data: { data: { state: 'rebuilding' } } })
    raidList.mockResolvedValue([])
    const s = useStorageStore()
    const r = await s.recoverRaid(9)
    expect(raidRecoverMock).toHaveBeenCalledWith(9)
    expect(r).toEqual({ state: 'rebuilding' })
  })
})
