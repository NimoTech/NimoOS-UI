import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePhotosSmartViews } from '../smartViews'

const listSmartViews = vi.fn()
const createSmartViewApi = vi.fn()
const updateSmartViewApi = vi.fn()
const deleteSmartViewApi = vi.fn()
const duplicateSmartViewApi = vi.fn()
const getSmartViewAssets = vi.fn()
const getSmartViewActivity = vi.fn()
const previewSmartViewApi = vi.fn()
const exportSmartViewAlbumApi = vi.fn()
const convertAlbumToSmartApi = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listSmartViews: (...a: unknown[]) => listSmartViews(...a),
      createSmartView: (...a: unknown[]) => createSmartViewApi(...a),
      updateSmartView: (...a: unknown[]) => updateSmartViewApi(...a),
      deleteSmartView: (...a: unknown[]) => deleteSmartViewApi(...a),
      duplicateSmartView: (...a: unknown[]) => duplicateSmartViewApi(...a),
      getSmartViewAssets: (...a: unknown[]) => getSmartViewAssets(...a),
      getSmartViewActivity: (...a: unknown[]) => getSmartViewActivity(...a),
      previewSmartView: (...a: unknown[]) => previewSmartViewApi(...a),
      exportSmartViewAlbum: (...a: unknown[]) => exportSmartViewAlbumApi(...a),
      convertAlbumToSmart: (...a: unknown[]) => convertAlbumToSmartApi(...a),
    },
  },
}))

/* 回源核对(NimoOS-Photos/service/smartview.go:21-34 SmartView 结构体):
   id/name/description/conds/threshold/live/includeVideos/count/addedThisWeek/seeds
   恒在(count/addedThisWeek/conds/seeds 无 omitempty),median/storageBytes/distribution/
   evaluatedAt 带 omitempty 可缺。 */
const FULL_SV = {
  id: 'sv-1', name: 'Foo', description: 'Bar',
  conds: ['a', 'b'], threshold: 80, live: true, includeVideos: false,
  count: 40, addedThisWeek: 3, seeds: ['s1'],
  median: 55, storageBytes: 1024, distribution: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  evaluatedAt: '2026-01-01T00:00:00Z', createdAt: '2025-12-31T00:00:00Z',
}
const MINIMAL_SV = {
  id: 7, name: 'X', conds: null, threshold: 50, live: true, includeVideos: false,
  count: 1, addedThisWeek: 0,
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('fetchSmartViews', () => {
  it('后端返 null → [] 且 listLoaded 为 true', async () => {
    listSmartViews.mockResolvedValue(null)
    const s = usePhotosSmartViews()
    expect(s.listLoaded).toBe(false)
    await s.fetchSmartViews()
    expect(s.smartViews).toEqual([])
    expect(s.listLoaded).toBe(true)
  })

  it('返两条 → 长度 2、id 已 String() 化', async () => {
    listSmartViews.mockResolvedValue([FULL_SV, MINIMAL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews).toHaveLength(2)
    expect(s.smartViews.map(v => v.id)).toEqual(['sv-1', '7'])
  })

  it('抛错 → smartViews 保持原值(不清空)、listLoaded 仍 false、console.error 被调', async () => {
    listSmartViews.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews).toEqual([])
    expect(s.listLoaded).toBe(false)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('抛错时保留上一次已加载的数据', async () => {
    listSmartViews.mockResolvedValueOnce([FULL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    listSmartViews.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await s.fetchSmartViews()
    expect(s.smartViews).toHaveLength(1)
    expect(s.listLoaded).toBe(true)
    spy.mockRestore()
  })
})

describe('toSmartView 兜底', () => {
  it('省略 median/storageBytes/distribution/evaluatedAt → 0/0/长度10全0数组/""', async () => {
    listSmartViews.mockResolvedValue([MINIMAL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    const v = s.smartViews[0]
    expect(v.median).toBe(0)
    expect(v.storageBytes).toBe(0)
    expect(v.distribution).toEqual(new Array(10).fill(0))
    expect(v.evaluatedAt).toBe('')
  })

  it('conds: null → []', async () => {
    listSmartViews.mockResolvedValue([MINIMAL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews[0].conds).toEqual([])
  })

  it('seeds 缺 → []', async () => {
    listSmartViews.mockResolvedValue([MINIMAL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews[0].seeds).toEqual([])
  })

  it('distribution 长度不足 10 时也整体回落成全 0(刻意收紧,不是照搬 Vue2 PhotosSmartViewDetail.vue:316 —— 那里 [1,2] 会原样保留)', async () => {
    listSmartViews.mockResolvedValue([{ ...MINIMAL_SV, distribution: [1, 2] }])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews[0].distribution).toEqual(new Array(10).fill(0))
  })

  it('完整字段原样归一(数字→字符串 id,数值/布尔透传)', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews[0]).toEqual({
      id: 'sv-1', name: 'Foo', description: 'Bar',
      conds: ['a', 'b'], threshold: 80, live: true, includeVideos: false,
      count: 40, addedThisWeek: 3, seeds: ['s1'],
      median: 55, storageBytes: 1024, distribution: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      evaluatedAt: '2026-01-01T00:00:00Z', createdAt: '2025-12-31T00:00:00Z',
    })
  })

  it('createdAt is normalised off the wire and falls back to an empty string when absent', async () => {
    // The backend has always returned it (NimoOS-Photos service/smartview.go:23); the
    // front-end type simply never carried it until the global album sort needed it.
    listSmartViews.mockResolvedValue([
      { ...MINIMAL_SV, createdAt: '2026-01-02T03:04:05Z' },
      MINIMAL_SV,
    ])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews[0].createdAt).toBe('2026-01-02T03:04:05Z')
    expect(s.smartViews[1].createdAt).toBe('')
  })
})

describe('byId(§7e-2 结构性修复)', () => {
  it('后端 id 是数字 7 时 byId(\'7\') 命中(String 归一主守卫)', async () => {
    listSmartViews.mockResolvedValue([MINIMAL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.byId('7')?.name).toBe('X')
  })

  it('不存在 → null', async () => {
    listSmartViews.mockResolvedValue([MINIMAL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.byId('does-not-exist')).toBeNull()
  })
})

describe('createSmartView', () => {
  const input = {
    name: 'New', description: 'd', conds: ['a'],
    threshold: 70, live: true, includeVideos: false,
  }

  // fix round 1 · C1(Critical,回源实证):后端 Create(smartview.go:65-68)对空 id
  // 直接 400,route handler 从不生成 id——原先「不含 id」的断言把一个 100% 会在真机
  // 上失败的错契约焊死了。改成断言请求体**必须**带一个 `sv-` 前缀的 id。
  it('请求体含 condsRaw 且不含 conds、且带 sv- 前缀的 id(C1 回源修复)', async () => {
    createSmartViewApi.mockResolvedValue({ ...FULL_SV, id: 'sv-new' })
    const s = usePhotosSmartViews()
    await s.createSmartView(input)
    expect(createSmartViewApi).toHaveBeenCalledTimes(1)
    const arg = createSmartViewApi.mock.calls[0][0] as Record<string, unknown>
    expect(arg).toEqual(expect.objectContaining({ condsRaw: ['a'] }))
    expect(arg).not.toHaveProperty('conds')
    expect(String(arg.id)).toMatch(/^sv-/)
  })

  it('连续两次 create 生成的 id 不相同(C1:不用 Date.now(),用 uuid,避免同毫秒撞 id)', async () => {
    createSmartViewApi.mockResolvedValue({ ...FULL_SV, id: 'sv-new' })
    const s = usePhotosSmartViews()
    await s.createSmartView(input)
    await s.createSmartView(input)
    const id1 = (createSmartViewApi.mock.calls[0][0] as Record<string, unknown>).id
    const id2 = (createSmartViewApi.mock.calls[1][0] as Record<string, unknown>).id
    expect(id1).not.toBe(id2)
  })

  it('成功 → 新项在数组首位', async () => {
    createSmartViewApi.mockResolvedValue({ ...FULL_SV, id: 'sv-new', name: 'New' })
    const s = usePhotosSmartViews()
    listSmartViews.mockResolvedValue([FULL_SV])
    await s.fetchSmartViews()
    await s.createSmartView(input)
    expect(s.smartViews[0].id).toBe('sv-new')
    expect(s.smartViews).toHaveLength(2)
  })

  it('createBusy 期间二次调用直接返回 null 且底层只被调一次', async () => {
    createSmartViewApi.mockReturnValue(new Promise(() => {})) // 永不 settle
    const s = usePhotosSmartViews()
    void s.createSmartView(input)
    const second = await s.createSmartView(input)
    expect(second).toBeNull()
    expect(createSmartViewApi).toHaveBeenCalledTimes(1)
  })

  it('失败 → rethrow 且数组长度不变(反向断言 Vue2 的乐观撒谎没被照抄)', async () => {
    createSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await expect(s.createSmartView(input)).rejects.toThrow('boom')
    expect(s.smartViews).toHaveLength(0)
    spy.mockRestore()
  })

  it('createBusy 失败后复位,紧接着的调用能正常发起', async () => {
    createSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await expect(s.createSmartView(input)).rejects.toThrow('boom')
    createSmartViewApi.mockResolvedValueOnce({ ...FULL_SV, id: 'sv-2' })
    await s.createSmartView(input)
    expect(createSmartViewApi).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe('updateSmartView', () => {
  it('patch.conds 被改名成 condsRaw 发出', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    updateSmartViewApi.mockResolvedValue(undefined)
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await s.updateSmartView('sv-1', { conds: ['x', 'y'] })
    expect(updateSmartViewApi).toHaveBeenCalledTimes(1)
    const [id, body] = updateSmartViewApi.mock.calls[0] as [string, Record<string, unknown>]
    expect(id).toBe('sv-1')
    expect(body).toEqual(expect.objectContaining({ condsRaw: ['x', 'y'] }))
    expect(body).not.toHaveProperty('conds')
  })

  it('响应带 body → 列表项被整体替换且位置不变(原位在 index 1 的项改完仍在 index 1)', async () => {
    listSmartViews.mockResolvedValue([FULL_SV, { ...MINIMAL_SV, id: 'sv-2' }])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    const updated = { ...FULL_SV, id: 'sv-2', name: 'Renamed' }
    updateSmartViewApi.mockResolvedValue(updated)
    await s.updateSmartView('sv-2', { name: 'Renamed' })
    expect(s.smartViews[1].id).toBe('sv-2')
    expect(s.smartViews[1].name).toBe('Renamed')
    expect(s.smartViews).toHaveLength(2)
  })

  it('响应无 body → 就地合并 patch', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    updateSmartViewApi.mockResolvedValue(undefined)
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await s.updateSmartView('sv-1', { name: 'Merged Name' })
    expect(s.smartViews[0].name).toBe('Merged Name')
    expect(s.smartViews[0].id).toBe('sv-1')
    expect(s.smartViews[0].conds).toEqual(['a', 'b']) // 未被 patch 的字段不受影响
  })

  it('失败 → rethrow 且列表项未被本地改动', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    updateSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await expect(s.updateSmartView('sv-1', { name: 'Should Not Apply' })).rejects.toThrow('boom')
    expect(s.smartViews[0].name).toBe('Foo')
    spy.mockRestore()
  })

  it('patchBusy 期间二次调用短路,底层只被调一次', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    updateSmartViewApi.mockReturnValue(new Promise(() => {}))
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    void s.updateSmartView('sv-1', { name: 'a' })
    void s.updateSmartView('sv-1', { name: 'b' })
    expect(updateSmartViewApi).toHaveBeenCalledTimes(1)
  })

  it('patchBusy 失败后复位为 false', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    updateSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await expect(s.updateSmartView('sv-1', { name: 'x' })).rejects.toThrow()
    updateSmartViewApi.mockResolvedValueOnce(undefined)
    await s.updateSmartView('sv-1', { name: 'y' })
    expect(updateSmartViewApi).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe('deleteSmartView / restoreSmartView', () => {
  it('删不存在的 id → null 且底层未被调', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    const r = await s.deleteSmartView('nope')
    expect(r).toBeNull()
    expect(deleteSmartViewApi).not.toHaveBeenCalled()
  })

  it('删成功 → 返回 { sv, index } 且数组移除', async () => {
    listSmartViews.mockResolvedValue([FULL_SV, { ...MINIMAL_SV, id: 'sv-2' }])
    deleteSmartViewApi.mockResolvedValue(undefined)
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    const r = await s.deleteSmartView('sv-1')
    expect(r).toEqual({ sv: expect.objectContaining({ id: 'sv-1' }), index: 0 })
    expect(s.smartViews).toHaveLength(1)
    expect(s.smartViews[0].id).toBe('sv-2')
  })

  // fix round 1 · I1(Important,评审用交错场景实测复现):deleteBusy 不挡
  // fetchSmartViews,删除在途时列表若被整体重排/插入,await 之前算好的下标会指向
  // 别的项。必须按 id 重算下标,交错路径:发 delete(sv-2)→ 在其 await 未 resolve
  // 前先让 fetchSmartViews 把列表重排(别的客户端建了新视图插到最前)→ delete 的
  // 网络调用才 resolve。断言消失的必须是 sv-2(用户点的那一项),不是重排后错位到
  // 原下标 1 的 sv-1;返回的 { sv, index } 也必须对应 sv-2 在重排后列表里的真实位置。
  it('并发交错:delete 在途时 fetchSmartViews 重排列表,删除的必须仍是按 id 命中的那一项', async () => {
    listSmartViews.mockResolvedValueOnce([
      { ...FULL_SV, id: 'sv-1' }, { ...FULL_SV, id: 'sv-2' }, { ...FULL_SV, id: 'sv-3' },
    ])
    let resolveDelete: () => void = () => {}
    deleteSmartViewApi.mockReturnValueOnce(new Promise<void>((r) => { resolveDelete = r }))
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    expect(s.smartViews.map(v => v.id)).toEqual(['sv-1', 'sv-2', 'sv-3'])

    const pDelete = s.deleteSmartView('sv-2') // 用户点的是 sv-2(当前下标 1)

    // delete 的网络请求还没 resolve 时,另一个客户端建了新视图、fetchSmartViews 把
    // sv-2 重排到下标 2(不再是下标 1)。
    listSmartViews.mockResolvedValueOnce([
      { ...FULL_SV, id: 'sv-0' }, { ...FULL_SV, id: 'sv-1' },
      { ...FULL_SV, id: 'sv-2' }, { ...FULL_SV, id: 'sv-3' },
    ])
    await s.fetchSmartViews()
    expect(s.smartViews.map(v => v.id)).toEqual(['sv-0', 'sv-1', 'sv-2', 'sv-3'])

    resolveDelete()
    const result = await pDelete

    // 必须删掉 sv-2(用户点的那一项),不是重排后落在旧下标 1 上的 sv-1。
    expect(s.smartViews.map(v => v.id)).toEqual(['sv-0', 'sv-1', 'sv-3'])
    expect(result?.sv.id).toBe('sv-2')
    expect(result?.index).toBe(2) // sv-2 在重排后列表里的真实下标,不是最初的 1
  })

  it('restore 把它插回原 index,请求体带 id', async () => {
    listSmartViews.mockResolvedValue([FULL_SV, { ...MINIMAL_SV, id: 'sv-2' }])
    deleteSmartViewApi.mockResolvedValue(undefined)
    createSmartViewApi.mockResolvedValue(undefined)
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    const deleted = await s.deleteSmartView('sv-1')
    expect(deleted).not.toBeNull()
    await s.restoreSmartView(deleted!)
    expect(s.smartViews.map(v => v.id)).toEqual(['sv-1', 'sv-2'])
    const arg = createSmartViewApi.mock.calls[0][0] as Record<string, unknown>
    expect(arg.id).toBe('sv-1')
  })

  it('index 超界(如 99)→ 插到末尾(钳制)', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    createSmartViewApi.mockResolvedValue(undefined)
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await s.restoreSmartView({ sv: { ...FULL_SV, id: 'sv-late' }, index: 99 })
    expect(s.smartViews.map(v => v.id)).toEqual(['sv-1', 'sv-late'])
  })

  // 删码验证登记(§⑥):`Math.min(index, length)` 本身对"超界(如 99)"这条用例不是
  // 可证伪的——JS 原生 `Array.prototype.splice` 对 start 参数本就有"大于数组长度时
  // 钳到数组长度"的内建语义(`[1].splice(99,0,'x')` 等价于 `splice(1,0,'x')`),删掉
  // Math.min 这条用例仍然绿。真正有必要的是 `Math.max(0, …)`——splice 对**负数**
  // start 的语义是"从末尾倒数"而不是钳到 0(`[1,2,3].splice(-1,0,'y')` 会插在倒数
  // 第二个位置,不是插在最前面),这条诚实的替代用例钉住 Math.max。
  it('index 为负数 → 钳到 0(插到最前),而非按 splice 原生的"从末尾倒数"语义', async () => {
    listSmartViews.mockResolvedValue([FULL_SV, { ...MINIMAL_SV, id: 'sv-2' }])
    createSmartViewApi.mockResolvedValue(undefined)
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await s.restoreSmartView({ sv: { ...FULL_SV, id: 'sv-early' }, index: -1 })
    expect(s.smartViews.map(v => v.id)).toEqual(['sv-early', 'sv-1', 'sv-2'])
  })

  it('deleteBusy 期间二次 delete 调用直接返回 null,底层只被调一次(共用锁)', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    deleteSmartViewApi.mockReturnValue(new Promise(() => {}))
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    void s.deleteSmartView('sv-1')
    const second = await s.deleteSmartView('sv-1')
    expect(second).toBeNull()
    expect(deleteSmartViewApi).toHaveBeenCalledTimes(1)
  })

  it('deleteSmartView 失败 → rethrow(不吞错)', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    deleteSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await expect(s.deleteSmartView('sv-1')).rejects.toThrow('boom')
    expect(s.smartViews).toHaveLength(1) // 未被移除
    spy.mockRestore()
  })

  it('deleteBusy 失败后复位为 false', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    deleteSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await expect(s.deleteSmartView('sv-1')).rejects.toThrow()
    deleteSmartViewApi.mockResolvedValueOnce(undefined)
    const r = await s.deleteSmartView('sv-1')
    expect(r).not.toBeNull()
    expect(deleteSmartViewApi).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe('duplicateSmartView', () => {
  it('duplicateBusy 期间二次调用短路,底层只被调一次', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    duplicateSmartViewApi.mockReturnValue(new Promise(() => {}))
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    void s.duplicateSmartView('sv-1')
    void s.duplicateSmartView('sv-1')
    expect(duplicateSmartViewApi).toHaveBeenCalledTimes(1)
  })

  it('成功后把返回对象插入列表', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    duplicateSmartViewApi.mockResolvedValue({ ...FULL_SV, id: 'sv-1-copy', name: 'Foo (copy)' })
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await s.duplicateSmartView('sv-1')
    expect(s.smartViews.map(v => v.id)).toContain('sv-1-copy')
    expect(s.smartViews).toHaveLength(2)
  })

  it('失败 → rethrow,duplicateBusy 复位', async () => {
    duplicateSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await expect(s.duplicateSmartView('sv-1')).rejects.toThrow('boom')
    duplicateSmartViewApi.mockResolvedValueOnce({ ...FULL_SV, id: 'sv-1-copy2' })
    await s.duplicateSmartView('sv-1')
    expect(duplicateSmartViewApi).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe('convertFromAlbum', () => {
  it('unshifts the new smart view and returns it', async () => {
    convertAlbumToSmartApi.mockResolvedValue({ id: 'sv-new', name: 'N', createdAt: '2026-02-01T00:00:00Z' })
    const s = usePhotosSmartViews()
    const sv = await s.convertFromAlbum('al-1', { description: 'sunsets', threshold: 80 })
    expect(sv.id).toBe('sv-new')
    expect(s.smartViews[0].id).toBe('sv-new')
  })

  it('rethrows so the caller can keep its dialog open', async () => {
    convertAlbumToSmartApi.mockRejectedValueOnce(new Error('boom'))
    const s = usePhotosSmartViews()
    await expect(s.convertFromAlbum('al-1', { description: 'x', threshold: 80 })).rejects.toBeTruthy()
    expect(s.smartViews).toHaveLength(0)
  })
})

describe('loadDetail 三请求并行 + seq 竞态守卫', () => {
  it('三个请求的参数逐字断言', async () => {
    getSmartViewAssets.mockResolvedValue([])
    getSmartViewActivity.mockResolvedValue([])
    const s = usePhotosSmartViews()
    await s.loadDetail('sv-1')
    expect(getSmartViewAssets).toHaveBeenNthCalledWith(1, 'sv-1', { limit: 60, offset: 0 })
    expect(getSmartViewAssets).toHaveBeenNthCalledWith(2, 'sv-1', { limit: 12, offset: 0, recent: true })
    expect(getSmartViewActivity).toHaveBeenCalledWith('sv-1', 10)
  })

  // fix round 1 · I2(Important,评审变异实验实测:把 assetIds 兜底删掉 +
  // occurredAt 写死 'MUTATED' 后 46 例全绿,说明 toActivity 此前零区分力)。后端
  // SmartViewActivity.AssetIDs(smartview.go:731)带 omitempty,Go nil slice ⇒ 整个
  // 字段在响应体里缺失;T8 的活动流会 v-for 这个数组,undefined 直接崩组件。
  it('toActivity 归一:字段全缺 + id 是数字 → 逐字段兜底(钉住 detail/assetIds/occurredAt 的兜底,防止被悄悄削弱)', async () => {
    getSmartViewAssets.mockResolvedValue([])
    getSmartViewActivity.mockResolvedValue([{ id: 9, eventType: 'matched' }])
    const s = usePhotosSmartViews()
    await s.loadDetail('sv-1')
    expect(s.activity).toEqual([
      { id: '9', eventType: 'matched', detail: '', assetIds: [], occurredAt: '' },
    ])
  })

  it('后发先回:A(id=1)慢、B(id=2)快 → 最终是 B 的数据', async () => {
    let resolveAllA: (v: unknown) => void = () => {}
    let resolveAllB: (v: unknown) => void = () => {}
    getSmartViewAssets
      .mockReturnValueOnce(new Promise((r) => { resolveAllA = r })) // A all
      .mockResolvedValueOnce([]) // A recent
      .mockReturnValueOnce(new Promise((r) => { resolveAllB = r })) // B all
      .mockResolvedValueOnce([]) // B recent
    getSmartViewActivity.mockResolvedValue([])
    const s = usePhotosSmartViews()

    const pA = s.loadDetail('1')
    const pB = s.loadDetail('2')
    // B(后发)先回
    resolveAllB([{ id: 'b1' }])
    await pB
    expect(s.matchedAssets.map(p => p.id)).toEqual(['b1'])
    // A(先发)后回 —— 必须被丢弃
    resolveAllA([{ id: 'a1' }])
    await pA
    expect(s.matchedAssets.map(p => p.id)).toEqual(['b1'])
  })

  it('先发先回:A 先发且快、B 后发且慢 → A 的 finally 不得把仍在途的 detailLoading 提前拨回 false,最终结果是 B 的数据且 detailLoading 最终为 false(钉住 finally 里的 mine === seq 门控)', async () => {
    let resolveAllB: (v: unknown) => void = () => {}
    getSmartViewAssets
      .mockResolvedValueOnce([{ id: 'a1' }]) // A all(立即 resolve)
      .mockResolvedValueOnce([]) // A recent
      .mockReturnValueOnce(new Promise((r) => { resolveAllB = r })) // B all(挂起)
      .mockResolvedValueOnce([]) // B recent
    getSmartViewActivity.mockResolvedValue([])
    const s = usePhotosSmartViews()

    // A、B 背靠背发出(B 在 A 的 Promise.all 落定前就已发出,detailSeq 已推进到 B)。
    const pA = s.loadDetail('1')
    const pB = s.loadDetail('2')
    // A 先落定,但此刻 mine(A) !== detailSeq(已被 B 推进)—— A 的 finally 必须
    // 放弃复位,detailLoading 应仍为 true(B 仍在途),不能被 A 提前拨回 false。
    await pA
    expect(s.detailLoading).toBe(true)
    expect(s.matchedAssets).toEqual([]) // A 的数据也不得被写入(mine !== detailSeq)

    resolveAllB([{ id: 'b1' }])
    await pB
    expect(s.matchedAssets.map(p => p.id)).toEqual(['b1'])
    expect(s.detailLoading).toBe(false)
  })

  it('清旧数据:发第二次 loadDetail 时,在其 await 未 resolve 前 matchedAssets 已是 []', async () => {
    getSmartViewAssets
      .mockResolvedValueOnce([{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }])
      .mockResolvedValueOnce([])
    getSmartViewActivity.mockResolvedValue([])
    const s = usePhotosSmartViews()
    await s.loadDetail('1')
    expect(s.matchedAssets).toHaveLength(3)

    let resolveAllSecond: (v: unknown) => void = () => {}
    getSmartViewAssets.mockReturnValueOnce(new Promise((r) => { resolveAllSecond = r }))
    const p2 = s.loadDetail('2')
    // 尚未 await —— 清空必须已经发生
    expect(s.matchedAssets).toEqual([])
    expect(s.recentAssets).toEqual([])
    expect(s.activity).toEqual([])
    resolveAllSecond([])
    await p2
  })

  it('失败时 console.error 被调、detailLoading 复位', async () => {
    getSmartViewAssets.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await s.loadDetail('1')
    expect(spy).toHaveBeenCalled()
    expect(s.detailLoading).toBe(false)
    spy.mockRestore()
  })
})

describe('refreshPreview 300ms debounce + seq 守卫', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('连续调 3 次只发 1 个请求(debounce)', async () => {
    previewSmartViewApi.mockResolvedValue({ count: 1, seeds: [], thresholdActive: true })
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    s.refreshPreview({ description: '', conds: ['a', 'b'], threshold: 50, includeVideos: false })
    s.refreshPreview({ description: '', conds: ['a', 'b', 'c'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    expect(previewSmartViewApi).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('两次相隔超过 300ms 且前一次响应更慢时,旧响应不覆盖新结果(seq 守卫)', async () => {
    let resolveA: (v: unknown) => void = () => {}
    let resolveB: (v: unknown) => void = () => {}
    previewSmartViewApi
      .mockReturnValueOnce(new Promise((r) => { resolveA = r }))
      .mockReturnValueOnce(new Promise((r) => { resolveB = r }))
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    s.refreshPreview({ description: '', conds: ['b'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    // B(后发)先回
    resolveB({ count: 2, seeds: ['s2'], thresholdActive: true })
    await Promise.resolve()
    await Promise.resolve()
    expect(s.preview.count).toBe(2)
    // A(先发)后回 —— 必须被丢弃
    resolveA({ count: 999, seeds: ['s1'], thresholdActive: false })
    await Promise.resolve()
    await Promise.resolve()
    expect(s.preview.count).toBe(2)
    vi.useRealTimers()
  })

  it('响应缺 thresholdActive → thresholdActive === true', async () => {
    previewSmartViewApi.mockResolvedValue({ count: 1, seeds: [] })
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    expect(s.preview.thresholdActive).toBe(true)
    vi.useRealTimers()
  })

  it('显式 false → false', async () => {
    previewSmartViewApi.mockResolvedValue({ count: 1, seeds: [], thresholdActive: false })
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    expect(s.preview.thresholdActive).toBe(false)
    vi.useRealTimers()
  })

  it('失败时 preview 保留上一次的值', async () => {
    previewSmartViewApi.mockResolvedValueOnce({ count: 5, seeds: ['x'], thresholdActive: true })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    expect(s.preview.count).toBe(5)

    previewSmartViewApi.mockRejectedValueOnce(new Error('boom'))
    s.refreshPreview({ description: '', conds: ['b'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    expect(s.preview.count).toBe(5) // 没被清空
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
    vi.useRealTimers()
  })
})

// T5(创建弹窗)新增,控制器授权:关闭弹窗时清掉未触发的定时器 + 让已在途的响应作废,
// 详见 smartViews.ts cancelPreview 上方的注释。
describe('cancelPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('定时器尚未触发时调用 → 定时器被清,底层请求根本不发', async () => {
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    s.cancelPreview()
    await vi.advanceTimersByTimeAsync(300)
    expect(previewSmartViewApi).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('请求已在途时调用 → 响应回来后不回填 preview(关闭后在途响应不覆盖)', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    previewSmartViewApi.mockReturnValueOnce(new Promise((r) => { resolveFn = r }))
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    expect(previewSmartViewApi).toHaveBeenCalledTimes(1)
    // 请求已发出、仍在途——此时关闭弹窗。
    s.cancelPreview()
    resolveFn({ count: 999, seeds: ['stale'], thresholdActive: false })
    await Promise.resolve()
    await Promise.resolve()
    expect(s.preview).toEqual({ count: 0, seeds: [], thresholdActive: true })
    vi.useRealTimers()
  })

  it('之后再调 refreshPreview 仍能正常工作(seq 计数器没被破坏)', async () => {
    const s = usePhotosSmartViews()
    s.refreshPreview({ description: '', conds: ['a'], threshold: 50, includeVideos: false })
    s.cancelPreview()
    previewSmartViewApi.mockResolvedValueOnce({ count: 7, seeds: ['x'], thresholdActive: true })
    s.refreshPreview({ description: '', conds: ['b'], threshold: 50, includeVideos: false })
    await vi.advanceTimersByTimeAsync(300)
    await Promise.resolve()
    await Promise.resolve()
    expect(s.preview.count).toBe(7)
    vi.useRealTimers()
  })
})

describe('exportAlbum', () => {
  it('exportBusy 期间二次调用短路,底层只被调一次', async () => {
    exportSmartViewAlbumApi.mockReturnValue(new Promise(() => {}))
    const s = usePhotosSmartViews()
    void s.exportAlbum('sv-1')
    void s.exportAlbum('sv-1')
    expect(exportSmartViewAlbumApi).toHaveBeenCalledTimes(1)
  })

  it('失败 → rethrow(视图层分流 toast 文案),exportBusy 复位', async () => {
    exportSmartViewAlbumApi.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSmartViews()
    await expect(s.exportAlbum('sv-1')).rejects.toThrow('boom')
    exportSmartViewAlbumApi.mockResolvedValueOnce(undefined)
    await s.exportAlbum('sv-1')
    expect(exportSmartViewAlbumApi).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe('__resetForTest', () => {
  it('复位所有 ref', async () => {
    listSmartViews.mockResolvedValue([FULL_SV])
    getSmartViewAssets.mockResolvedValue([{ id: 'a1' }])
    getSmartViewActivity.mockResolvedValue([{ id: 'act1', eventType: 'created', occurredAt: '2026-01-01' }])
    const s = usePhotosSmartViews()
    await s.fetchSmartViews()
    await s.loadDetail('sv-1')

    s.__resetForTest()

    expect(s.smartViews).toEqual([])
    expect(s.listLoaded).toBe(false)
    expect(s.listLoading).toBe(false)
    expect(s.matchedAssets).toEqual([])
    expect(s.recentAssets).toEqual([])
    expect(s.activity).toEqual([])
    expect(s.detailLoading).toBe(false)
    expect(s.preview).toEqual({ count: 0, seeds: [], thresholdActive: true })
    expect(s.createBusy).toBe(false)
    expect(s.patchBusy).toBe(false)
    expect(s.deleteBusy).toBe(false)
    expect(s.duplicateBusy).toBe(false)
    expect(s.exportBusy).toBe(false)
  })
})
