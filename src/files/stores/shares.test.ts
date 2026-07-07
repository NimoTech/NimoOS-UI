import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { listShares, createShare, deleteShare } = vi.hoisted(() => ({
  listShares: vi.fn(),
  createShare: vi.fn(async () => {}),
  deleteShare: vi.fn(async () => {}),
}))
vi.mock('@nimotech/nimoos-service', async () => {
  const actual = await vi.importActual<typeof import('@nimotech/nimoos-service')>('@nimotech/nimoos-service')
  return { ...actual, service: { samba: { listShares, createShare, deleteShare } } }
})
import { useSharesStore } from './shares'

describe('useSharesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    listShares.mockReset(); createShare.mockReset(); deleteShare.mockReset()
    createShare.mockResolvedValue(undefined); deleteShare.mockResolvedValue(undefined)
  })

  it('load 把 {id,path} 映射成含末段 name 的行', async () => {
    listShares.mockResolvedValue([{ id: 1, path: '/DATA/Documents' }])
    const s = useSharesStore()
    await s.load()
    expect(s.items).toEqual([{ id: 1, path: '/DATA/Documents', name: 'Documents' }])
  })

  it('create 用原始 realPath 数组调 createShare 并回 true', async () => {
    listShares.mockResolvedValue([])
    const s = useSharesStore()
    const ok = await s.create(['/DATA/a', '/DATA/b'])
    expect(createShare).toHaveBeenCalledWith(['/DATA/a', '/DATA/b'])
    expect(ok).toBe(true)
  })

  it('create 空数组不打网络、回 false', async () => {
    const s = useSharesStore()
    expect(await s.create([])).toBe(false)
    expect(createShare).not.toHaveBeenCalled()
  })

  it('remove 调 deleteShare(id) 并重载', async () => {
    listShares.mockResolvedValue([])
    const s = useSharesStore()
    await s.remove(7)
    expect(deleteShare).toHaveBeenCalledWith(7)
  })
})
