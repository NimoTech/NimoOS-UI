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
  it('I2 用例:先搜出非空结果,再传空/全空格 query → 真正走 clear() 语义,复位所有字段(而非"本来就是空")', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(3))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    // 先确认真的搜出了东西,下面的"清空后复位"才有意义(否则这些断言在全新
    // store 上恒真,测不出 clear() 到底有没有被调用)。
    expect(s.results).toHaveLength(3)
    expect(s.isSearchMode).toBe(true)
    expect(s.ms).toBeGreaterThanOrEqual(0)
    smartSearchApi.mockClear()

    await s.smartSearch('   ') // 空/全空格 query
    expect(smartSearchApi).not.toHaveBeenCalled() // 底层未被调
    expect(s.results).toEqual([])
    expect(s.query).toBe('')
    expect(s.isSearchMode).toBe(false)
    expect(s.exhausted).toBe(false)
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

  it('M6 用例:后端 Go nil slice 序列化成 null → ?? [] 兜底,走成功路径而非 throw-进-catch', async () => {
    smartSearchApi.mockResolvedValueOnce(null)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = usePhotosSearch()
    await expect(s.smartSearch('cat')).resolves.toBeUndefined()
    expect(s.results).toEqual([])
    expect(s.isSearchMode).toBe(true)
    expect(s.exhausted).toBe(true) // 0 条 < LIMIT
    // 判别性断言:若没有 `?? []` 兜底,`null.map(...)` 会 throw、被 catch 接住,
    // §7e-12 的失败兜底恰好落到同一个终态(isSearchMode=true/results=[]/exhausted=true),
    // 光看上面三条断言测不出 `?? []` 被删——真正的区别是"这算不算一次真实错误"。
    expect(errSpy).not.toHaveBeenCalled()
    errSpy.mockRestore()
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

  it('失败响应也可能过期(M5:日志仍要打,状态不能被覆盖):搜 A(慢,最终 reject)→ 搜 B(快,成功)→ A 的失败姗姗来迟 → console.error 照打、但不覆盖 B 的成功状态', async () => {
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
    // M5:过期失败也是一次真实的后端错误,日志纪律(每个 catch 都要 console.error)
    // 不能因为"响应已过期"就被跳过——丢日志=丢诊断信号。
    expect(errSpy).toHaveBeenCalledWith('[photos-search] smartSearch', expect.any(Error))
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
    // M10:只断言长度测不出 concat 的方向——把 fresh.concat(results.value) 写反成
    // results.value.concat(fresh) 的反面(即前插而非追加)也能通过长度断言。这里
    // 钉住首页在头、次页在尾、且首尾相接顺序不变。
    expect(s.results[0].id).toBe('p0')
    expect(s.results[49].id).toBe('p49')
    expect(s.results[50].id).toBe('q0')
    expect(s.results[99].id).toBe('q49')
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

  it('I1 用例(Vue2→Vue3 铁律):首页含 number 型 id、新页含同值 string 型 id → 仍判定为重复,不能被当成两条不同记录', async () => {
    smartSearchApi.mockResolvedValueOnce([{ id: 7 }, ...assets(49, 'p')]) // 首页含 1 条 number id
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    expect(s.results[0].id).toBe(7) // 首页原样保留 number 类型(assetToPhoto 不做归一)
    const dup = [{ id: '7' }, ...assets(49, 'q')] // 新页含同值但类型是 string 的 id
    smartSearchApi.mockResolvedValueOnce(dup)
    await s.loadMore()
    // 若 Set 未做 String() 归一,'7' 与 7 会被当成两个不同的键,dup 整页 50 条都判"新",
    // 结果长度变成 50+50=100;归一后应识别为重复,只新增 49 条。
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

  it('M6 用例:loadMore 深页后端返回 null(Go nil slice)→ ?? [] 兜底,exhausted 正确置真、不 throw', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat')
    smartSearchApi.mockResolvedValueOnce(null)
    await expect(s.loadMore()).resolves.toBeUndefined()
    expect(s.results).toHaveLength(50) // 没有新增
    expect(s.exhausted).toBe(true) // 0 条 < LIMIT,该停止翻页,而不是反复重发同一页
    expect(s.loadingMore).toBe(false)
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

  it('M8 用例:loadMore#1 在途 → 重搜成功(复位 offset/loadingMore)→ loadMore#2 在途 → loadMore#1 的过期响应到达 → 不该误将 loadingMore 复位为假、不该放行重入请求', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat')

    const dMore1 = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dMore1.promise)
    const pMore1 = s.loadMore() // loadMore#1 在途,nextOffset=50

    smartSearchApi.mockResolvedValueOnce(assets(50, 'q'))
    await s.smartSearch('cat') // 覆盖式重搜:offset 归 0、loadingMore 归 false、seq 前进

    const dMore2 = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dMore2.promise)
    const pMore2 = s.loadMore() // loadMore#2 在途,基于重搜后 offset=0,nextOffset=50
    expect(s.loadingMore).toBe(true)

    // loadMore#1 的响应现在才姗姗来迟——它的查询串比对会通过(前后都是 'cat'),
    // 但 seq 已经落后,应该被 seq 守卫拦下;关键是它的 finally 不该顺手把
    // loadingMore 复位为假(那会抹掉"loadMore#2 仍在途"这个事实)。
    dMore1.resolve(assets(50, 'stale'))
    await flush()
    expect(s.loadingMore).toBe(true) // 核心断言:未被过期响应的 finally 误复位

    smartSearchApi.mockClear()
    await s.loadMore() // 此刻应仍被 loadingMore=true 短路,不应放行重入
    expect(smartSearchApi).not.toHaveBeenCalled()

    dMore2.resolve(assets(50, 'q2'))
    await flush()
    await pMore1
    await pMore2
    expect(s.loadingMore).toBe(false)
    expect(s.offset).toBe(50) // loadMore#2 的合法 offset,没被重入请求污染
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
  it('复位全部 8 个字段(M9:offset/loadingMore 前置到非默认值,让复位断言真正有区分力)', async () => {
    // M9 之前的版本只做了 smartSearch,此时 offset 本就是 0、loadingMore 本就是
    // false——那两条断言在 clear() 被删掉的情况下也会通过。这里先跑完一次
    // loadMore() 把 offset 顶到非零,再在第二次 loadMore() 在途期间(loadingMore
    // 此刻真的是 true)调用 clear(),两条断言才测得出 clear() 有没有真正执行。
    smartSearchApi.mockResolvedValueOnce(assets(50, 'p'))
    const s = usePhotosSearch()
    await s.smartSearch('cat', { year: 2024 })
    smartSearchApi.mockResolvedValueOnce(assets(50, 'q'))
    await s.loadMore() // offset: 0 → 50(完整跑完,不再是默认值)

    const dMore = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dMore.promise)
    const pMore = s.loadMore() // 在途:此刻 loadingMore 真的是 true
    expect(s.loadingMore).toBe(true)

    s.clear()
    expect(s.results).toEqual([])
    expect(s.query).toBe('')
    expect(s.filtersPayload).toEqual({})
    expect(s.offset).toBe(0) // 曾经是 50,证明真的被复位而不是"本来就是 0"
    expect(s.exhausted).toBe(false)
    expect(s.loadingMore).toBe(false) // 曾经是 true,证明真的被复位而不是"本来就是 false"
    expect(s.ms).toBe(0)
    expect(s.isSearchMode).toBe(false)

    // 收尾:让在途的 loadMore 落地,避免遗留悬空 promise 污染下一个用例。
    dMore.resolve(assets(50, 'stale'))
    await flush()
    await pMore
  })
})

describe('__resetForTest', () => {
  it('M7 用例:复位全部 8 个字段', async () => {
    smartSearchApi.mockResolvedValueOnce(assets(10))
    const s = usePhotosSearch()
    await s.smartSearch('cat', { year: 2024 })
    s.__resetForTest()
    expect(s.results).toEqual([])
    expect(s.query).toBe('')
    expect(s.filtersPayload).toEqual({})
    expect(s.offset).toBe(0)
    expect(s.exhausted).toBe(false)
    expect(s.loadingMore).toBe(false)
    expect(s.ms).toBe(0)
    expect(s.isSearchMode).toBe(false)
  })

  it('M7 用例:不引入 seq 别名冲突 —— 重置前的过期请求不会污染重置后的新搜索(手法照 places.test.ts:643 同款)', async () => {
    const dStale = makeDeferred<unknown[]>()
    smartSearchApi.mockImplementationOnce(() => dStale.promise)
    const s = usePhotosSearch()
    const stale = s.smartSearch('stale') // 在途,不等待

    s.__resetForTest() // 若这里把 searchSeq 拨回 0,下面的新搜索会与这个在途请求别名冲突

    smartSearchApi.mockResolvedValueOnce(assets(1, 'fresh'))
    await s.smartSearch('fresh') // 重置后的新搜索
    expect(s.query).toBe('fresh')

    dStale.resolve(assets(1, 'stale')) // 重置前的旧请求现在才姗姗来迟
    await flush()
    await stale
    expect(s.query).toBe('fresh') // 不该被过期请求覆盖
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
