import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSnapshots } from './useSnapshots'
import type { KvmSnapshot } from '@nimotech/nimoos-service'

const api = {
  getSnapshots: vi.fn(), createSnapshot: vi.fn(), deleteSnapshot: vi.fn(), restoreSnapshot: vi.fn(),
}
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))

// 造非空列表时字段照后端 NimoOS-KVM/model/snapshot.go(brief 指定),不是手编。
const SNAP = (over: Partial<KvmSnapshot> = {}): KvmSnapshot => ({
  id: 'snap-1', vmId: 'vm-1', name: 'before-upgrade', description: '升级前备份',
  state: 'complete', createdAt: '2026-08-03T10:00:00Z', ...over,
})

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()) })

describe('useSnapshots', () => {
  // 真机 2026-08-03 curl 数据(brief 指定,fixture 不手编):两层信封,共享包已剥好,
  // 这里拿到的是 []。
  it('fetch 成功填列表(真机 fixture:空数组)', async () => {
    api.getSnapshots.mockResolvedValue([])
    const s = useSnapshots()
    await s.fetch('vm-1')
    expect(api.getSnapshots).toHaveBeenCalledWith('vm-1')
    expect(s.snapshots.value).toEqual([])
  })

  it('fetch 成功填非空列表', async () => {
    api.getSnapshots.mockResolvedValue([SNAP()])
    const s = useSnapshots()
    await s.fetch('vm-1')
    expect(s.snapshots.value).toEqual([SNAP()])
  })

  // 照 Vue2 fetchSnapshots(:1232-1234):失败只 console.warn,保留旧列表——这里先用一次
  // 成功 fetch 垫一份非空列表,再让第二次 fetch 失败,断言列表没被清空/替换。
  it('fetch 失败保留旧列表,只 console.warn(有意照抄 Vue2)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    api.getSnapshots.mockResolvedValueOnce([SNAP()])
    const s = useSnapshots()
    await s.fetch('vm-1')
    expect(s.snapshots.value).toEqual([SNAP()])

    api.getSnapshots.mockRejectedValueOnce(new Error('network down'))
    await s.fetch('vm-1')
    expect(s.snapshots.value).toEqual([SNAP()]) // 没被清空
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  // create 成功后自己再 fetch 一遍(照 Vue2 :1251),不是本地拼接一条。
  it('create 成功后自己再 fetch 一遍并返回 ""', async () => {
    api.createSnapshot.mockResolvedValue(SNAP())
    api.getSnapshots.mockResolvedValue([SNAP({ id: 'snap-2', name: 'after-create' })])
    const s = useSnapshots()
    const err = await s.create('vm-1', 'before-upgrade', '升级前备份')
    expect(err).toBe('')
    expect(api.createSnapshot).toHaveBeenCalledWith('vm-1', { name: 'before-upgrade', description: '升级前备份' })
    expect(api.getSnapshots).toHaveBeenCalledWith('vm-1')
    // 断言列表是「再 fetch 一遍」的结果,不是本地拼接进去的那份——否则这条用例在
    // "本地 push 一条,不调用 getSnapshots"的坏实现下也会看似通过(create 返回的
    // SNAP() 与 fetch 返回的 SNAP({id:'snap-2',...}) 刻意用不同的 id/name 区分)。
    expect(s.snapshots.value).toEqual([SNAP({ id: 'snap-2', name: 'after-create' })])
  })

  it('create 失败返回后端 message', async () => {
    api.createSnapshot.mockRejectedValue(new Error('disk quota exceeded'))
    const s = useSnapshots()
    expect(await s.create('vm-1', 'x', '')).toBe('disk quota exceeded')
    expect(api.getSnapshots).not.toHaveBeenCalled() // 失败不该再去 fetch
  })

  // remove 成功后本地过滤掉那一条(照 Vue2 :1307),不重新 fetch。
  it('remove 成功后本地过滤掉那一条,不重新 fetch', async () => {
    api.getSnapshots.mockResolvedValue([SNAP({ id: 'snap-1' }), SNAP({ id: 'snap-2', name: 'other' })])
    const s = useSnapshots()
    await s.fetch('vm-1')
    expect(s.snapshots.value).toHaveLength(2)

    api.deleteSnapshot.mockResolvedValue(undefined)
    api.getSnapshots.mockClear()
    const err = await s.remove('vm-1', 'snap-1')
    expect(err).toBe('')
    expect(s.snapshots.value).toEqual([SNAP({ id: 'snap-2', name: 'other' })])
    expect(api.getSnapshots).not.toHaveBeenCalled() // 不重新 fetch
  })

  it('remove 失败返回后端 message,列表不变', async () => {
    api.getSnapshots.mockResolvedValue([SNAP()])
    const s = useSnapshots()
    await s.fetch('vm-1')
    api.deleteSnapshot.mockRejectedValue(new Error('snapshot is in use'))
    expect(await s.remove('vm-1', 'snap-1')).toBe('snapshot is in use')
    expect(s.snapshots.value).toEqual([SNAP()]) // 失败不过滤
  })

  it('restore 成功返回 ""', async () => {
    api.restoreSnapshot.mockResolvedValue(undefined)
    const s = useSnapshots()
    expect(await s.restore('vm-1', 'snap-1')).toBe('')
    expect(api.restoreSnapshot).toHaveBeenCalledWith('vm-1', 'snap-1')
  })

  it('restore 失败返回后端 message', async () => {
    api.restoreSnapshot.mockRejectedValue(new Error('VM must be stopped'))
    const s = useSnapshots()
    expect(await s.restore('vm-1', 'snap-1')).toBe('VM must be stopped')
  })

  // 三个写方法失败都返回后端 message(合并成一条,逐一核对 fallback 不会盖过真实 message)。
  it('三个写方法失败都优先返回后端 message,而不是 i18n fallback 键名', async () => {
    api.createSnapshot.mockRejectedValue(new Error('create boom'))
    api.deleteSnapshot.mockRejectedValue(new Error('delete boom'))
    api.restoreSnapshot.mockRejectedValue(new Error('restore boom'))
    const s = useSnapshots()
    expect(await s.create('vm-1', 'x', '')).toBe('create boom')
    expect(await s.remove('vm-1', 'snap-1')).toBe('delete boom')
    expect(await s.restore('vm-1', 'snap-1')).toBe('restore boom')
  })

  // dispose 后落定不写 state(交错路径)。remove 是唯一一个"成功后本地写 state"的
  // 分支(fetch 已经在专门那条覆盖过),这里用 remove 演示:请求在途时 dispose,
  // 随后放行成功结果,断言列表没有被过滤(证明守卫真的挡住了写入)。
  it('dispose 后 remove 落定(即使成功)也不再本地过滤列表(过期守卫;交错路径)', async () => {
    api.getSnapshots.mockResolvedValue([SNAP({ id: 'snap-1' })])
    const s = useSnapshots()
    await s.fetch('vm-1')

    let release: (v: unknown) => void = () => {}
    api.deleteSnapshot.mockReturnValue(new Promise((r) => { release = r }))
    const p = s.remove('vm-1', 'snap-1')
    s.dispose() // 请求在途时组件卸载
    release(undefined)
    expect(await p).toBe('') // 守卫短路仍然返回 ''(不是错误,只是没地方消费这个结果了)
    expect(s.snapshots.value).toEqual([SNAP({ id: 'snap-1' })]) // 没被过滤掉
  })

  it('dispose 后 fetch 落定也不再写列表(过期守卫;交错路径)', async () => {
    let release: (v: unknown) => void = () => {}
    api.getSnapshots.mockReturnValue(new Promise((r) => { release = r }))
    const s = useSnapshots()
    const p = s.fetch('vm-1')
    s.dispose()
    release([SNAP()])
    await p
    expect(s.snapshots.value).toEqual([]) // 初值,没被迟到的响应写入
  })
})
