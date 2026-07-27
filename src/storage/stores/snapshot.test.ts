import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const listVolumes = vi.fn()
const listMock = vi.fn()
const getPolicy = vi.fn()
const patchPolicy = vi.fn()
const togglePolicy = vi.fn()
const createMock = vi.fn()
const removeMock = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    snapshot: {
      listVolumes: (...a: unknown[]) => listVolumes(...a),
      list: (...a: unknown[]) => listMock(...a),
      getPolicy: (...a: unknown[]) => getPolicy(...a),
      patchPolicy: (...a: unknown[]) => patchPolicy(...a),
      togglePolicy: (...a: unknown[]) => togglePolicy(...a),
      create: (...a: unknown[]) => createMock(...a),
      remove: (...a: unknown[]) => removeMock(...a),
    },
  },
}))
const toastShow = vi.fn()
vi.mock('../../stores/toast', () => ({ useToast: () => ({ show: toastShow }) }))
vi.mock('../../i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))

import { useSnapshotStore } from './snapshot'

const VOL = { volume_uuid: 'u1', mount: '/DATA', supported: true, enabled: true, count: 2, last_at: '2026-07-27T01:00:00Z' }

beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('loadVolume', () => {
  it('按 volume_uuid 命中本卷,收窄成视图对象', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'other' }, VOL])
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    expect(s.volume?.volume_uuid).toBe('u1')
    expect(s.volume?.count).toBe(2)
    expect(s.volumeLoading).toBe(false)
  })
  it('列表里没有本卷 → volume=null(面板落 unsupported 态)', async () => {
    listVolumes.mockResolvedValue([{ volume_uuid: 'other' }])
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    expect(s.volume).toBeNull()
  })
  it('端点 404/抛错 → volume=null、loading 释放、只记 message 不记整个 error', async () => {
    listVolumes.mockRejectedValue(Object.assign(new Error('boom'), { config: { data: 'secret' } }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    expect(s.volume).toBeNull()
    expect(s.volumeLoading).toBe(false)
    expect(warn).toHaveBeenCalled()
    expect(JSON.stringify(warn.mock.calls)).not.toContain('config')
  })
})

describe('loadSnapshots', () => {
  it('取回列表;非数组响应归一为空数组', async () => {
    listMock.mockResolvedValue([{ name: 'a', created_at: '2026-07-27T00:00:00Z' }])
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(listMock).toHaveBeenCalledWith('u1')
    expect(s.snapshots).toHaveLength(1)
    listMock.mockResolvedValue(null)
    await s.loadSnapshots('u1')
    expect(s.snapshots).toEqual([])
    expect(s.listLoading).toBe(false)
  })
  it('抛错 → 列表清空、loading 释放', async () => {
    listMock.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(s.snapshots).toEqual([])
    expect(s.listLoading).toBe(false)
  })
})

describe('toggle', () => {
  it('成功:调 togglePolicy(uuid, enabled)、本地 enabled 跟随、出成功 toast、单飞', async () => {
    listVolumes.mockResolvedValue([VOL])
    togglePolicy.mockResolvedValue(undefined)
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    await Promise.all([s.toggle('u1', false), s.toggle('u1', false)]) // 并发第二发被守卫吞掉
    expect(togglePolicy).toHaveBeenCalledTimes(1)
    expect(togglePolicy).toHaveBeenCalledWith('u1', false)
    expect(s.volume?.enabled).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('snapToggleOff')
    expect(s.toggling).toBe(false)
  })
  it('失败:本地回滚到原值 + 失败 toast', async () => {
    listVolumes.mockResolvedValue([VOL])           // enabled: true
    togglePolicy.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadVolume('u1')
    await s.toggle('u1', false)
    expect(s.volume?.enabled).toBe(true)
    expect(toastShow).toHaveBeenCalledWith('snapToggleFailed')
  })
})

describe('savePolicy', () => {
  const form = { hourly_keep: 12, daily_keep: 5, weekly_keep: 3, pause_threshold_pct: 80 }
  it('走 patchPolicy(读-改-写)传整个表单;成功返回 true', async () => {
    patchPolicy.mockResolvedValue(null)
    const s = useSnapshotStore()
    const ok = await s.savePolicy('u1', form)
    expect(patchPolicy).toHaveBeenCalledWith('u1', form)
    expect(ok).toBe(true)
    expect(toastShow).toHaveBeenCalledWith('snapPolicySaved')
  })
  it('后端 PUT 返回 null 时,本地 policy 用刚保存的表单值(Vue2 此处会显示 undefined,不照抄)', async () => {
    getPolicy.mockResolvedValue({ volume_uuid: 'u1', enabled: true, hourly_keep: 24, daily_keep: 7, weekly_keep: 4, pause_threshold_pct: 90 })
    patchPolicy.mockResolvedValue(null)
    const s = useSnapshotStore()
    await s.loadPolicy('u1')
    await s.savePolicy('u1', form)
    expect(s.policy?.hourly_keep).toBe(12)
    expect(s.policy?.pause_threshold_pct).toBe(80)
    expect(s.policy?.enabled).toBe(true)      // 未在表单里的字段保持原值
  })
  it('失败 → 返回 false + 失败 toast + busy 复位', async () => {
    patchPolicy.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    expect(await s.savePolicy('u1', form)).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('snapPolicySaveFailed')
    expect(s.policySaving).toBe(false)
  })
})

describe('createSnapshot', () => {
  it('有备注:body = {volume_uuid, label}(label 前后空白被 trim)', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL])
    listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    expect(await s.createSnapshot('u1', '  升级前  ')).toBe(true)
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: 'u1', label: '升级前' })
    expect(toastShow).toHaveBeenCalledWith('snapCreated')
  })
  it('无备注:body 里不得出现 label 字段', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL])
    listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    await s.createSnapshot('u1', '   ')
    expect(createMock).toHaveBeenCalledWith({ volume_uuid: 'u1' })
    expect(Object.keys(createMock.mock.calls[0][0] as object)).toEqual(['volume_uuid'])
  })
  it('成功后刷新卷摘要与快照列表', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL])
    listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    await s.createSnapshot('u1', '')
    expect(listVolumes).toHaveBeenCalled()
    expect(listMock).toHaveBeenCalledWith('u1')
  })
  it('单飞:并发第二发被吞;失败出失败 toast 且 busy 复位', async () => {
    createMock.mockResolvedValue(undefined)
    listVolumes.mockResolvedValue([VOL]); listMock.mockResolvedValue([])
    const s = useSnapshotStore()
    await Promise.all([s.createSnapshot('u1', ''), s.createSnapshot('u1', '')])
    expect(createMock).toHaveBeenCalledTimes(1)
    createMock.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await s.createSnapshot('u1', '')).toBe(false)
    expect(toastShow).toHaveBeenCalledWith('snapCreateFailed')
    expect(s.creatingSnapshot).toBe(false)
  })
})

describe('removeSnapshot', () => {
  it('调 remove(name, uuid) —— 参数顺序不可颠倒;成功后本地摘除该条并刷新卷摘要', async () => {
    listMock.mockResolvedValue([
      { name: 'snap-a', created_at: '2026-07-27T00:00:00Z' },
      { name: 'snap-b', created_at: '2026-07-26T00:00:00Z' },
    ])
    listVolumes.mockResolvedValue([VOL])
    removeMock.mockResolvedValue(undefined)
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(await s.removeSnapshot('u1', 'snap-a')).toBe(true)
    expect(removeMock).toHaveBeenCalledWith('snap-a', 'u1')
    expect(s.snapshots.map(x => x.name)).toEqual(['snap-b'])
    expect(listVolumes).toHaveBeenCalled()
    expect(toastShow).toHaveBeenCalledWith('snapDeleted')
    expect(s.deletingName).toBeNull()
  })
  it('删除中再点(同一/另一条)被守卫吞掉', async () => {
    listMock.mockResolvedValue([{ name: 'snap-a', created_at: '2026-07-27T00:00:00Z' }])
    listVolumes.mockResolvedValue([VOL])
    removeMock.mockResolvedValue(undefined)
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    await Promise.all([s.removeSnapshot('u1', 'snap-a'), s.removeSnapshot('u1', 'snap-a')])
    expect(removeMock).toHaveBeenCalledTimes(1)
  })
  it('失败 → 返回 false、列表不变、失败 toast、守卫复位', async () => {
    listMock.mockResolvedValue([{ name: 'snap-a', created_at: '2026-07-27T00:00:00Z' }])
    removeMock.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s = useSnapshotStore()
    await s.loadSnapshots('u1')
    expect(await s.removeSnapshot('u1', 'snap-a')).toBe(false)
    expect(s.snapshots).toHaveLength(1)
    expect(toastShow).toHaveBeenCalledWith('snapDeleteFailed')
    expect(s.deletingName).toBeNull()
  })
})
