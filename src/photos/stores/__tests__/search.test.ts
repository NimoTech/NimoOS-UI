import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const smartSearchApi = vi.fn()

vi.mock('@nimotech/nimoos-service', () => ({
  service: { photos: { smartSearch: (...a: unknown[]) => smartSearchApi(...a) } },
}))

import { usePhotosSearch } from '../search'

// 照 usePersonDetail.test.ts 的手法:可控 deferred promise 精确摆布竞态时序。
function makeDeferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve()
}
// 裸资产 fixture——assetToPhoto 对缺失字段都有兜底,这里只需要区分 id。
function assets(n: number, prefix = 'p'): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }))
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('smartSearch', () => {
  it('空/全空格 query 走 clear() 语义,底层 smartSearch 未被调用', async () => {
    const s = usePhotosSearch()
    await s.smartSearch('   ')
    expect(smartSearchApi).not.toHaveBeenCalled()
    expect(s.results).toEqual([])
    expect(s.isSearchMode).toBe(false)
  })

  it('首页成功:results 长度=返回长度、isSearchMode 真、query 是 trim 后的、offset 0、返回 50 条 exhausted 假、ms 是精确差值', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50))
    const nowSpy = vi.spyOn(performance, 'now')
    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1234)
    const s = usePhotosSearch()
    await s.smartSearch('  cat  ')
    expect(s.results).toHaveLength(50)
    expect(s.isSearchMode).toBe(true)
    expect(s.query).toBe('cat')
    expect(s.offset).toBe(0)
    expect(s.exhausted).toBe(false)
    expect(s.ms).toBe(234)
    nowSpy.mockRestore()
  })

  it('首页返 49 条(<50)→ exhausted 真', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(49))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    expect(s.exhausted).toBe(true)
  })

  it('失败(§7e-12 修复守卫):reject → isSearchMode 真、results 空、query 是新词、exhausted 真 ⇒ matchesQuery(新词) 真(视图落空态而非永久 loading)', async () => {
    smartSearchApi.mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSearch()
    await s.smartSearch('dog')
    expect(s.isSearchMode).toBe(true)
    expect(s.results).toEqual([])
    expect(s.query).toBe('dog')
    expect(s.exhausted).toBe(true)
    expect(s.matchesQuery('dog')).toBe(true)
    errSpy.mockRestore()
  })

  it('竞态·后发先回:搜 A(慢)→ 搜 B(快)→ B 先回填 → A 姗姗来迟被丢弃 → 最终 query===B', async () => {
    const dA = makeDeferred<unknown[]>()
    const dB = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dA.promise)
    smartSearchApi.mockImplementationOnce(() => dB.promise)
    const s = usePhotosSearch()
    const pA = s.smartSearch('A')
    const pB = s.smartSearch('B')
    dB.resolve(assets(1, 'b'))
    await flush()
    await pB
    expect(s.query).toBe('B')
    dA.resolve(assets(1, 'a'))
    await flush()
    await pA
    expect(s.query).toBe('B') // A 迟到的响应没有覆盖 B
  })

  it('竞态·先发先回:A 快 B 慢 → 最终仍是 B(A 的 seq 已落后,resolve 时被整体丢弃)', async () => {
    const dA = makeDeferred<unknown[]>()
    const dB = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dA.promise)
    smartSearchApi.mockImplementationOnce(() => dB.promise)
    const s = usePhotosSearch()
    const pA = s.smartSearch('A')
    const pB = s.smartSearch('B')
    dA.resolve(assets(1, 'a'))
    await flush()
    await pA
    // A 先回但 seq 已落后于 B,守卫拦下整段写入——此刻 B 仍在途,query 还是初始空串
    expect(s.query).toBe('')
    dB.resolve(assets(1, 'b'))
    await flush()
    await pB
    expect(s.query).toBe('B')
  })

  it('clear() 后在途响应不回填(新增 seq bump 的主守卫,Vue2 没有这层防护)', async () => {
    const dA = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dA.promise)
    const s = usePhotosSearch()
    const pA = s.smartSearch('A')
    s.clear()
    dA.resolve(assets(1, 'a'))
    await flush()
    await pA
    expect(s.results).toEqual([])
    expect(s.isSearchMode).toBe(false)
  })

  it('失败响应也可能过期:搜 A(慢,最终 reject)→ 搜 B(快,成功)→ A 的失败姗姗来迟 → 不覆盖 B 的成功状态', async () => {
    const dA = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dA.promise)
    smartSearchApi.mockResolvedValueOnce(assets(1, 'b'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSearch()
    const pA = s.smartSearch('A')
    await s.smartSearch('B') // 立即成功,写入 query='B'
    expect(s.query).toBe('B')
    dA.reject(new Error('boom')) // A 现在才失败——已经过期,不该把 query 推进成 'A'/exhausted 等
    await flush()
    await pA.catch(() => {}) // pA 本身不会抛(catch 里吞了),这里只是等它跑完
    expect(s.query).toBe('B')
    expect(s.results).toHaveLength(1)
    expect(errSpy).not.toHaveBeenCalled() // 过期失败不该被 log(避免噪声/误导运维)
    errSpy.mockRestore()
  })

  it('E3 用例:搜索 A 在途 → smartSearch("")(空查询)→ 让 A 响应 resolve → results 仍空、isSearchMode 仍假', async () => {
    const dA = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dA.promise)
    const s = usePhotosSearch()
    const pA = s.smartSearch('A')
    await s.smartSearch('   ') // 空查询早退到 clear(),bump 了 seq
    dA.resolve(assets(1, 'a'))
    await flush()
    await pA
    expect(s.results).toEqual([])
    expect(s.isSearchMode).toBe(false)
  })
})

describe('loadMore', () => {
  it('未搜过(query 空)→ 底层未被调', async () => {
    const s = usePhotosSearch()
    await s.loadMore()
    expect(smartSearchApi).not.toHaveBeenCalled()
  })

  it('exhausted 真 → 底层未被调', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(10)) // <50 → exhausted 真
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    smartSearchApi.mockClear()
    await s.loadMore()
    expect(smartSearchApi).not.toHaveBeenCalled()
  })

  it('loadingMore 真 → 重入被短路,底层未被调', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    const dMore = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dMore.promise)
    const p1 = s.loadMore()
    smartSearchApi.mockClear()
    const p2 = s.loadMore() // 重入
    expect(smartSearchApi).not.toHaveBeenCalled()
    dMore.resolve(assets(50, 'q'))
    await flush()
    await p1
    await p2
  })

  it('正常:参数是 (query, 50, 50, filtersPayload);全新 50 条 → offset 变 50、exhausted 假', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat', { year: 2024 })
    smartSearchApi.mockResolvedValueOnce(assets(50, 'q'))
    await s.loadMore()
    expect(smartSearchApi).toHaveBeenLastCalledWith('cat', 50, 50, { year: 2024 })
    expect(s.offset).toBe(50)
    expect(s.exhausted).toBe(false)
    expect(s.results).toHaveLength(100)
  })

  it('去重:新页含一条与首页重复的 id → 结果长度只 +(新页长度-1)', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p')) // p0..p49
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    const dup = [...assets(49, 'q'), { id: 'p0' }] // 50 条,含 1 条与首页重复
    smartSearchApi.mockResolvedValueOnce(dup)
    await s.loadMore()
    expect(s.results).toHaveLength(50 + 49)
  })

  it('fresh.length===0(整页全重复)→ exhausted 真', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p')) // 全部与首页重复
    await s.loadMore()
    expect(s.exhausted).toBe(true)
    expect(s.results).toHaveLength(50)
  })

  it('新页返 30 条(<50)→ exhausted 真', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    smartSearchApi.mockResolvedValueOnce(assets(30, 'q'))
    await s.loadMore()
    expect(s.exhausted).toBe(true)
  })

  it('loadMore 期间用户改了搜索词(新 smartSearch 跑完)→ 旧页响应不 concat、不污染 offset', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    const dMore = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dMore.promise)
    const pMore = s.loadMore()
    smartSearchApi.mockResolvedValueOnce(assets(10, 'dog'))
    await s.smartSearch('dog') // 覆盖式重搜,offset/results 已被 SET_SEARCH 换成新的
    dMore.resolve(assets(50, 'q')) // 旧 loadMore 的响应姗姗来迟
    await flush()
    await pMore
    expect(s.query).toBe('dog')
    expect(s.results).toHaveLength(10)
    expect(s.offset).toBe(0)
  })

  it('E4 用例(控制器裁定新增 seq 守卫):搜 abc → loadMore 在途 → 再搜一次同样的 abc → 旧页响应 resolve → 不 concat、offset 不变(查询串比对单独在此场景会误判通过)', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('abc')
    const dMore = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dMore.promise)
    const pMore = s.loadMore()
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p2'))
    await s.smartSearch('abc') // 同样的查询串——查询串比对通过,只靠 seq 守卫拦截
    dMore.resolve(assets(50, 'stale'))
    await flush()
    await pMore
    expect(s.results).toHaveLength(50) // 只有第二次 smartSearch 的首页结果
    expect(s.offset).toBe(0) // 没被旧 loadMore 拨到 50
  })

  it('loadMore 失败 → loadingMore 复位为假(finally 守卫)', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    smartSearchApi.mockRejectedValueOnce(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await s.loadMore()
    expect(s.loadingMore).toBe(false)
    errSpy.mockRestore()
  })
})

describe('clear', () => {
  it('复位全部 8 个字段', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(10))
    const s = usePhotosSearch()
    await s.smartSearch('cat', { year: 2024 })
    s.clear()
    expect(s.results).toEqual([])
    expect(s.query).toBe('')
    expect(s.filtersPayload).toEqual({})
    expect(s.offset).toBe(0)
    expect(s.exhausted).toBe(false)
    expect(s.loadingMore).toBe(false)
    expect(s.ms).toBe(0)
    expect(s.isSearchMode).toBe(false)
  })
})

describe('matchesQuery', () => {
  it('搜过 abc → matchesQuery(abc)/matchesQuery(" abc ") 真、matchesQuery(abd) 假;未搜过恒假', async () => {
    const s = usePhotosSearch()
    expect(s.matchesQuery('abc')).toBe(false)
    smartSearchApi.mockResolvedValueOnce(assets(1))
    await s.smartSearch('abc')
    expect(s.matchesQuery('abc')).toBe(true)
    expect(s.matchesQuery(' abc ')).toBe(true)
    expect(s.matchesQuery('abd')).toBe(false)
  })
})
