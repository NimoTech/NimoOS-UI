import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { listShares, createShare, deleteShare } = vi.hoisted(() => ({
  listShares: vi.fn(),
  createShare: vi.fn(async () => {}),
  deleteShare: vi.fn(async (_id: number) => {}),
}))
vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return { ...actual, service: { samba: { listShares, createShare, deleteShare } } }
})
import { useSharesStore } from './shares'
import { useToast } from '../../stores/toast'

describe('useSharesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    listShares.mockReset(); createShare.mockReset(); deleteShare.mockReset()
    createShare.mockResolvedValue(undefined); deleteShare.mockResolvedValue(undefined)
  })

  it('load should map {id,path} to rows with name as the last segment', async () => {
    listShares.mockResolvedValue([{ id: 1, path: '/DATA/Documents' }])
    const s = useSharesStore()
    await s.load()
    expect(s.items).toEqual([{ id: 1, path: '/DATA/Documents', name: 'Documents' }])
  })

  it('create should call createShare with raw realPath array and return true', async () => {
    listShares.mockResolvedValue([])
    const s = useSharesStore()
    const ok = await s.create(['/DATA/a', '/DATA/b'])
    expect(createShare).toHaveBeenCalledWith(['/DATA/a', '/DATA/b'])
    expect(ok).toBe(true)
  })

  it('create with empty array should not make network call and return false', async () => {
    const s = useSharesStore()
    expect(await s.create([])).toBe(false)
    expect(createShare).not.toHaveBeenCalled()
  })

  it('remove should call deleteShare(id) and reload', async () => {
    listShares.mockResolvedValue([])
    const s = useSharesStore()
    await s.remove(7)
    expect(deleteShare).toHaveBeenCalledWith(7)
  })

  it('removeMany deletes every id, reloads once, toasts batch-done on full success', async () => {
    listShares.mockResolvedValue([])
    const s = useSharesStore()
    const { failedIds } = await s.removeMany([3, 7])
    expect(deleteShare).toHaveBeenCalledTimes(2)
    expect(deleteShare).toHaveBeenCalledWith(3)
    expect(deleteShare).toHaveBeenCalledWith(7)
    expect(listShares).toHaveBeenCalledTimes(1)
    expect(failedIds).toEqual([])
    expect(useToast().msg).toBe('已取消共享 2 项')
  })

  it('removeMany reports partial failure and returns the failed ids', async () => {
    listShares.mockResolvedValue([])
    deleteShare.mockImplementation(async (id: number) => {
      if (id === 7) throw new Error('boom')
    })
    const s = useSharesStore()
    const { failedIds } = await s.removeMany([3, 7, 9])
    expect(failedIds).toEqual([7])
    expect(listShares).toHaveBeenCalledTimes(1) // still reloads exactly once
    expect(useToast().msg).toBe('已取消共享 2 项,1 项失败')
  })

  it('removeMany surfaces the backend message when every id fails', async () => {
    listShares.mockResolvedValue([])
    deleteShare.mockRejectedValue({ response: { data: { message: 'smb busy' } } })
    const s = useSharesStore()
    const { failedIds } = await s.removeMany([3, 7])
    expect(failedIds).toEqual([3, 7])
    expect(useToast().msg).toBe('smb busy')
  })

  it('removeMany with empty ids is a no-op (no network, no toast)', async () => {
    const s = useSharesStore()
    const { failedIds } = await s.removeMany([])
    expect(failedIds).toEqual([])
    expect(deleteShare).not.toHaveBeenCalled()
    expect(listShares).not.toHaveBeenCalled()
    expect(useToast().msg).toBe('')
  })
})
