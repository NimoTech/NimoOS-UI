import { describe, it, expect, vi } from 'vitest'
import { blockedBySnapshotView, performSnapshotRestore } from './snapshotRestore'

describe('blockedBySnapshotView', () => {
  it('不在快照里 → 放行,不吐 toast', () => {
    const toast = vi.fn()
    expect(blockedBySnapshotView(false, toast, 'nope')).toBe(false)
    expect(toast).not.toHaveBeenCalled()
  })
  it('在快照里 → 拦截并吐 toast', () => {
    const toast = vi.fn()
    expect(blockedBySnapshotView(true, toast, '只读')).toBe(true)
    expect(toast).toHaveBeenCalledWith('只读')
  })
})

const INFO = { mount: '/DATA', snapshotName: 'snap1' }
const VOLS = [{ volume_uuid: 'u-data', mount: '/DATA' }]

describe('performSnapshotRestore', () => {
  it('把快照侧绝对路径映射回卷相对路径再提交', async () => {
    const restore = vi.fn().mockResolvedValue({ restored_path: '/DATA/Photos/a.jpg.restored-1' })
    const r = await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/Photos/a.jpg' },
      info: INFO,
      listVolumes: async () => VOLS,
      restore,
    })
    expect(restore).toHaveBeenCalledWith({ volume_uuid: 'u-data', snapshot: 'snap1', path: 'Photos/a.jpg' })
    expect(r).toEqual({ ok: true, restoredPath: '/DATA/Photos/a.jpg.restored-1' })
  })
  it('兼容后端把 restored_path 包在 data 里的情形', async () => {
    const r = await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS,
      restore: async () => ({ data: { restored_path: '/DATA/a.txt.restored-1' } }),
    })
    expect(r).toEqual({ ok: true, restoredPath: '/DATA/a.txt.restored-1' })
  })
  it('info 为 null / item 无 path → invalid,且不发请求', async () => {
    const restore = vi.fn()
    expect(await performSnapshotRestore({ item: { path: '/x' }, info: null, listVolumes: async () => VOLS, restore }))
      .toEqual({ ok: false, reason: 'invalid' })
    expect(restore).not.toHaveBeenCalled()
  })
  it('路径不在快照里 → invalid', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/Photos/a.jpg' }, info: INFO, listVolumes: async () => VOLS, restore: async () => ({}),
    })).toEqual({ ok: false, reason: 'invalid' })
  })
  it('快照根自身(relPath 为空)→ invalid', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1' }, info: INFO, listVolumes: async () => VOLS, restore: async () => ({}),
    })).toEqual({ ok: false, reason: 'invalid' })
  })
  it('卷列表里找不到该挂载点 → invalid', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => [{ volume_uuid: 'u-other', mount: '/OTHER' }], restore: async () => ({}),
    })).toEqual({ ok: false, reason: 'invalid' })
  })
  it('卷列表请求失败 → error', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => { throw new Error('boom') }, restore: async () => ({}),
    })).toEqual({ ok: false, reason: 'error' })
  })
  it('后端 404 → not-found', async () => {
    const err = Object.assign(new Error('gone'), { code: 404 })
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS, restore: async () => { throw err },
    })).toEqual({ ok: false, reason: 'not-found' })
  })
  it('后端 400 → invalid', async () => {
    const err = Object.assign(new Error('bad'), { code: 400 })
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS, restore: async () => { throw err },
    })).toEqual({ ok: false, reason: 'invalid' })
  })
  it('其它错误 → error', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS, restore: async () => { throw new Error('boom') },
    })).toEqual({ ok: false, reason: 'error' })
  })
  it('响应里没有 restored_path → error(不能谎报成功)', async () => {
    expect(await performSnapshotRestore({
      item: { path: '/DATA/.snapshots/snap1/a.txt' }, info: INFO,
      listVolumes: async () => VOLS, restore: async () => ({}),
    })).toEqual({ ok: false, reason: 'error' })
  })
})
