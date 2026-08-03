import { describe, it, expect, vi } from 'vitest'
import { emptySnapshot, execute, fetchSnapshot, WIRED } from './folderPermissionsSnapshot'

describe('folderPermissionsSnapshot —— 本期空实现(债务 D11)', () => {
  it('WIRED 是 false —— 界面据此显示「数据源待接入」说明条并禁用写操作', () => {
    expect(WIRED).toBe(false)
  })

  it('emptySnapshot 四个子系统全部标记为离线', () => {
    expect(emptySnapshot().offline).toEqual({ search: true, knowledge: true, ai: true, photos: true })
  })

  it('emptySnapshot 各列表为空、photos 非 auto 非 stale', () => {
    const s = emptySnapshot()
    expect(s.candidates).toEqual([])
    expect(s.searchRoots).toEqual([])
    expect(s.wikiRoots).toEqual([])
    expect(s.denyRules).toEqual([])
    expect(s.blacklist).toEqual([])
    expect(s.photos).toEqual({ auto: false, dirs: [], stale: false })
  })

  it('fetchSnapshot 不发任何网络请求', async () => {
    const spy = vi.spyOn(globalThis, 'fetch')
    await fetchSnapshot()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('fetchSnapshot 每次返回全新对象(消费方不会互相污染)', async () => {
    const a = await fetchSnapshot()
    const b = await fetchSnapshot()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  it('execute 一律拒绝执行(写操作在本期不许发生)', async () => {
    await expect(execute([{ svc: 'search', op: 'putRoots', roots: ['/DATA'] }])).rejects.toThrow(/not wired/i)
  })

  it('execute 连空计划也拒绝 —— 不给「其实调用了但恰好没动作」留缝', async () => {
    await expect(execute([])).rejects.toThrow(/not wired/i)
  })
})
