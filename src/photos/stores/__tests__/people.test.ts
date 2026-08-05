import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      listPersons: vi.fn(() => Promise.resolve({ persons: [], facesIndexedUpTo: null })),
      mergeSuggestions: vi.fn(() => Promise.resolve([])),
      updatePerson: vi.fn(() => Promise.resolve({})),
      setPersonCover: vi.fn(() => Promise.resolve({})),
      purgePerson: vi.fn(() => Promise.resolve({})),
      mergePersons: vi.fn(() => Promise.resolve({})),
      rejectMergeSuggestion: vi.fn(() => Promise.resolve({})),
    },
  },
}))
import { service } from '@nimotech/nimoos-service'
import { usePhotosPeople } from '../people'

const LS_CONFIDENCE = 'nimo_people_confidence'
const LS_SHOW_SINGLETONS = 'nimo_people_show_singletons'

function rawPerson(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'p1',
    name: '',
    confidence: 0.9,
    count: 3,
    favorite: false,
    relation: '',
    coverFaceId: null,
    heroAssetId: null,
    firstSeen: null,
    lastSeen: null,
    placesCount: 0,
    ...over,
  }
}

describe('photosPeople store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })
  // 关键隔离:_purgeTimers 是模块作用域单例,不随 setActivePinia(createPinia()) 重置。
  // 撤销/清除测试里凡是没有把窗口跑完(既没 advanceTimers 到触发、也没调 undo())的用例,
  // 会在 _purgeTimers 里留一条悬挂 entry,污染下一个用例的 fetchPeople 过滤逻辑与
  // purgePersonWithUndo 的"复用首次 idx"分支——本文件的测试夹具(id/name)在各用例间
  // 恰好取值相同,污染当前不会翻出错误断言,但极脆弱、一旦改夹具就会「莫名其妙地红」
  // (task brief 明文警告的场景)。用 afterEach 兜底清空,而不是 beforeEach——
  // 本 store 的 filter 在 setup() 里读一次 localStorage,若在 beforeEach 里提前
  // 实例化 store 会锁死那几条"预置 localStorage 再首次取 store"的初始化测试。
  afterEach(() => {
    usePhotosPeople().__resetForTest()
  })

  describe('fetchPeople', () => {
    it('解 {persons, facesIndexedUpTo} 包裹体;成功后 peopleLoaded===true', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({
        persons: [rawPerson({ id: 1, name: 'Alice' })],
        facesIndexedUpTo: '2026-07-01',
      })
      const s = usePhotosPeople()
      await s.fetchPeople()
      expect(s.people).toHaveLength(1)
      expect(s.people[0]).toMatchObject({ id: 1, name: 'Alice' })
      expect(s.facesIndexedUpTo).toBe('2026-07-01')
      expect(s.peopleLoaded).toBe(true)
    })
    it('persons 为 null → 空数组不炸', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: null, facesIndexedUpTo: null })
      const s = usePhotosPeople()
      await s.fetchPeople()
      expect(s.people).toEqual([])
      expect(s.peopleLoaded).toBe(true)
    })
    it('persons 字段缺失 → 空数组不炸', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({})
      const s = usePhotosPeople()
      await s.fetchPeople()
      expect(s.people).toEqual([])
      expect(s.peopleLoaded).toBe(true)
    })
    it('reject → peopleLoaded 仍为 false、既有 people 不被清空、console.error 被调用(偏离登记 2 的回归)', async () => {
      const s = usePhotosPeople()
      // 直接种入既有数据(不经 fetchPeople),peopleLoaded 保持初始 false —— 精确复现
      // "首次尚未确认加载成功、但本地已有数据" 的状态,验证失败分支既不清空 people 也不动 peopleLoaded。
      s.people.push(...[rawPerson({ id: 1 })].map((r) => ({ ...r } as any)))
      expect(s.peopleLoaded).toBe(false)

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.listPersons as any).mockRejectedValueOnce(new Error('net'))
      await s.fetchPeople()
      expect(s.peopleLoaded).toBe(false) // 失败分支不置位
      expect(s.people).toHaveLength(1) // 未被清空(偏离登记 2:不照 Vue2 清空成 [])
      expect(errSpy).toHaveBeenCalled()
      errSpy.mockRestore()
    })
    it('reject（已通过成功路径加载过一次)→ peopleLoaded 仍保持 true(不被失败分支复位)、既有 people 不清空', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1 })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      expect(s.peopleLoaded).toBe(true)

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.listPersons as any).mockRejectedValueOnce(new Error('net'))
      await s.fetchPeople()
      expect(s.peopleLoaded).toBe(true)
      expect(s.people).toHaveLength(1)
      expect(errSpy).toHaveBeenCalled()
      errSpy.mockRestore()
    })
    it('facesIndexedUpTo 字段缺席时不覆盖旧值', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [], facesIndexedUpTo: '2026-07-01' })
      const s = usePhotosPeople()
      await s.fetchPeople()
      expect(s.facesIndexedUpTo).toBe('2026-07-01')

      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [] }) // 无 facesIndexedUpTo 键
      await s.fetchPeople()
      expect(s.facesIndexedUpTo).toBe('2026-07-01') // 未被覆盖
    })
  })

  // 评审 Issue 6 顺带补的两条便宜覆盖之一:fetchMergeSuggestions 之前完全没有直接测试。
  describe('fetchMergeSuggestions', () => {
    it('成功 → mergeSuggestions 填充为返回的数组', async () => {
      ;(service.photos.mergeSuggestions as any).mockResolvedValueOnce([{ id: 's1', fromId: 1, intoId: 2 }])
      const s = usePhotosPeople()
      await s.fetchMergeSuggestions()
      expect(s.mergeSuggestions).toEqual([{ id: 's1', fromId: 1, intoId: 2 }])
    })
    it('返回非数组(如 null)→ 兜底为 []', async () => {
      ;(service.photos.mergeSuggestions as any).mockResolvedValueOnce(null)
      const s = usePhotosPeople()
      await s.fetchMergeSuggestions()
      expect(s.mergeSuggestions).toEqual([])
    })
    // 偏离登记回归(同 fetchPeople):Vue2 :1095-1098 失败会把 mergeSuggestions 清空成 []；
    // 这里保留旧数据。种入旧值(不经网络请求)是为了让这条断言真正有区分力。
    it('reject → 保留旧数据 + console.error 被调(偏离登记回归)', async () => {
      const s = usePhotosPeople()
      s.mergeSuggestions.push({ id: 's1', fromId: 1, intoId: 2 })
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.mergeSuggestions as any).mockRejectedValueOnce(new Error('net'))
      await s.fetchMergeSuggestions()
      expect(s.mergeSuggestions).toEqual([{ id: 's1', fromId: 1, intoId: 2 }])
      expect(errSpy).toHaveBeenCalled()
      errSpy.mockRestore()
    })
  })

  describe('computed: named/unnamed/visibleUnnamed/unnamedCount 随 filter 变化', () => {
    it('随 filter 重算', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({
        persons: [
          rawPerson({ id: 1, name: 'Alice', confidence: 0.95, count: 5 }), // named
          rawPerson({ id: 2, name: '', confidence: 0.9, count: 5 }),   // unnamed, visible at conf=80
          rawPerson({ id: 3, name: '', confidence: 0.6, count: 1 }),   // unnamed, singleton + low conf
        ],
      })
      const s = usePhotosPeople()
      await s.fetchPeople()
      expect(s.named).toHaveLength(1)
      expect(s.unnamed).toHaveLength(2)
      expect(s.visibleUnnamed.map((p) => p.id)).toEqual([2])
      expect(s.unnamedCount).toBe(1)

      s.setConfidence(50)
      s.setShowSingletons(true)
      // 数字 id 用默认 .sort() 是字典序(风格清理:虽然 [2,3] 单位数巧合不出错,统一改数值比较避免误导)。
      expect(s.visibleUnnamed.map((p) => p.id).sort((a, b) => Number(a) - Number(b))).toEqual([2, 3])
      expect(s.unnamedCount).toBe(2)
    })
  })

  describe('过滤条件持久化', () => {
    it('setConfidence(90) 写 localStorage', () => {
      const s = usePhotosPeople()
      s.setConfidence(90)
      expect(localStorage.getItem(LS_CONFIDENCE)).toBe('90')
      expect(s.filter.confidence).toBe(90)
    })
    it('setShowSingletons(true)/(false) 写 "1"/"0"', () => {
      const s = usePhotosPeople()
      s.setShowSingletons(true)
      expect(localStorage.getItem(LS_SHOW_SINGLETONS)).toBe('1')
      s.setShowSingletons(false)
      expect(localStorage.getItem(LS_SHOW_SINGLETONS)).toBe('0')
    })
  })

  describe('store 初始化读 localStorage', () => {
    it("非法值 '77' → 回落默认 80", () => {
      localStorage.setItem(LS_CONFIDENCE, '77')
      const s = usePhotosPeople()
      expect(s.filter.confidence).toBe(80)
    })
    it("非法值 'abc' → 回落默认 80", () => {
      localStorage.setItem(LS_CONFIDENCE, 'abc')
      const s = usePhotosPeople()
      expect(s.filter.confidence).toBe(80)
    })
    it("合法值 '95' → 采用 95", () => {
      localStorage.setItem(LS_CONFIDENCE, '95')
      const s = usePhotosPeople()
      expect(s.filter.confidence).toBe(95)
    })
    it("showSingletons==='1' → true", () => {
      localStorage.setItem(LS_SHOW_SINGLETONS, '1')
      const s = usePhotosPeople()
      expect(s.filter.showSingletons).toBe(true)
    })
    it("showSingletons==='true'（非严格 '1'）→ false", () => {
      localStorage.setItem(LS_SHOW_SINGLETONS, 'true')
      const s = usePhotosPeople()
      expect(s.filter.showSingletons).toBe(false)
    })
  })

  describe('renamePerson', () => {
    it('乐观改名', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, name: 'Old' })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      let resolveFn: (v: unknown) => void
      ;(service.photos.updatePerson as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolveFn = resolve }),
      )
      const p = s.renamePerson(1, 'New')
      expect(s.personById(1)?.name).toBe('New')
      resolveFn!({})
      await p
    })
    it('后端 reject → fetchPeople 被调 + 抛出', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, name: 'Old' })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.updatePerson as any).mockRejectedValueOnce(new Error('x'))
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, name: 'Old' })] })
      await expect(s.renamePerson(1, 'New')).rejects.toThrow('x')
      expect(service.photos.listPersons).toHaveBeenCalledTimes(2) // setup fetch + rename-triggered refetch
      errSpy.mockRestore()
    })
  })

  describe('setPersonRelation', () => {
    it('失败 → relation 回滚到原值 + 抛出', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, relation: 'friend' })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.updatePerson as any).mockRejectedValueOnce(new Error('x'))
      await expect(s.setPersonRelation(1, 'family')).rejects.toThrow('x')
      expect(s.personById(1)?.relation).toBe('friend')
      errSpy.mockRestore()
    })
    it('成功 → relation 落地为新值', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, relation: 'friend' })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      await s.setPersonRelation(1, 'family')
      expect(s.personById(1)?.relation).toBe('family')
    })
  })

  describe('setPersonFavorite', () => {
    it('本地列表为空(深链场景)时仍调 updatePerson', async () => {
      const s = usePhotosPeople()
      await s.setPersonFavorite(1, true)
      expect(service.photos.updatePerson).toHaveBeenCalledWith(1, { favorite: true })
    })
    it('失败 → 本地回滚 + 抛出', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, favorite: false })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.updatePerson as any).mockRejectedValueOnce(new Error('x'))
      await expect(s.setPersonFavorite(1, true)).rejects.toThrow('x')
      expect(s.personById(1)?.favorite).toBe(false)
      errSpy.mockRestore()
    })
    it('成功且命中本地 → favorite 落地为新值', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, favorite: false })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      await s.setPersonFavorite(1, true)
      expect(s.personById(1)?.favorite).toBe(true)
    })
  })

  describe('setPersonCover', () => {
    it('后端带 coverFaceId → 返回并 patch 本地', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, coverFaceId: null })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      ;(service.photos.setPersonCover as any).mockResolvedValueOnce({ coverFaceId: 'f9' })
      const result = await s.setPersonCover(1, 'asset9')
      expect(result).toBe('f9')
      expect(s.personById(1)?.coverFaceId).toBe('f9')
    })
    it('后端不带该字段 → 不 patch', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, coverFaceId: 'orig' })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      ;(service.photos.setPersonCover as any).mockResolvedValueOnce({})
      await s.setPersonCover(1, 'asset9')
      expect(s.personById(1)?.coverFaceId).toBe('orig')
    })
    // T14 评审必修 1:「字段缺席」必须以 undefined 出栈,不能被 `?? null` 压成 null ——
    // 否则调用方分不清「后端说要清空封面」(显式 null,见下一条测试)与「后端根本没提封面」,
    // 无条件 patch 会在后端返回 `200 {}` 时把本地封面抹掉、详情页 hero 退化成渐变兜底。
    it('后端不带该字段 → 返回 undefined(与"显式 null"必须可区分)', async () => {
      ;(service.photos.setPersonCover as any).mockResolvedValueOnce({})
      const s = usePhotosPeople()
      expect(await s.setPersonCover(1, 'asset9')).toBeUndefined()
    })
    it('reject → 抛出', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.setPersonCover as any).mockRejectedValueOnce(new Error('x'))
      const s = usePhotosPeople()
      await expect(s.setPersonCover(1, 'a9')).rejects.toThrow('x')
      errSpy.mockRestore()
    })
    // Vue2 保真回归(逐行核对 :1123-1125 发现出入):Vue2 用 `!== undefined` 判定是否写入——
    // 哪怕后端显式返回 coverFaceId: null 也会 patch 成 null(清空本地封面)。若这里误用
    // `res?.coverFaceId ?? null` 把"显式 null"和"字段缺席"归一成同一个值,本测试会挂红
    // (期望 null,误实现会保留 'orig' 不写)。
    it('Vue2 保真:后端显式返回 coverFaceId: null 时仍写入(清空本地封面)', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, coverFaceId: 'orig' })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      ;(service.photos.setPersonCover as any).mockResolvedValueOnce({ coverFaceId: null })
      const result = await s.setPersonCover(1, 'asset9')
      expect(result).toBeNull()
      expect(s.personById(1)?.coverFaceId).toBeNull()
    })
  })

  describe('setPersonHero', () => {
    it('assetId=null → updatePerson(id, { heroAssetId: "" })', async () => {
      const s = usePhotosPeople()
      await s.setPersonHero(1, null)
      expect(service.photos.updatePerson).toHaveBeenCalledWith(1, { heroAssetId: '' })
    })
    it('成功 → 本地 heroAssetId 落地', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1, heroAssetId: null })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      await s.setPersonHero(1, 'a5')
      expect(s.personById(1)?.heroAssetId).toBe('a5')
    })
    it('reject → 抛出', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.updatePerson as any).mockRejectedValueOnce(new Error('x'))
      const s = usePhotosPeople()
      await expect(s.setPersonHero(1, 'a5')).rejects.toThrow('x')
      errSpy.mockRestore()
    })
  })

  describe('mergePersonInto', () => {
    it('成功 → listPersons 与 mergeSuggestions 都被重拉', async () => {
      const s = usePhotosPeople()
      await s.mergePersonInto(1, 2)
      expect(service.photos.mergePersons).toHaveBeenCalledWith(1, 2)
      expect(service.photos.listPersons).toHaveBeenCalledTimes(1)
      expect(service.photos.mergeSuggestions).toHaveBeenCalledTimes(1)
    })
    it('失败 → 仍重拉两份数据 + 抛出', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      ;(service.photos.mergePersons as any).mockRejectedValueOnce(new Error('x'))
      const s = usePhotosPeople()
      await expect(s.mergePersonInto(1, 2)).rejects.toThrow('x')
      expect(service.photos.listPersons).toHaveBeenCalledTimes(1)
      expect(service.photos.mergeSuggestions).toHaveBeenCalledTimes(1)
      errSpy.mockRestore()
    })
  })

  describe('purgePersonWithUndo：5 秒可撤销的彻底清除', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    async function seeded3() {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({
        persons: [rawPerson({ id: 1, name: 'A' }), rawPerson({ id: 2, name: 'B' }), rawPerson({ id: 3, name: 'C' })],
      })
      const s = usePhotosPeople()
      await s.fetchPeople()
      return s
    }

    it('①调用后立即从 people 消失;purgePerson 未被调用', async () => {
      const s = await seeded3()
      s.purgePersonWithUndo(2)
      expect(s.people.map((p) => p.id)).toEqual([1, 3])
      expect(service.photos.purgePerson).not.toHaveBeenCalled()
    })

    it('②5 秒后 purgePerson 被调用一次', async () => {
      const s = await seeded3()
      s.purgePersonWithUndo(2)
      await vi.advanceTimersByTimeAsync(5000)
      expect(service.photos.purgePerson).toHaveBeenCalledTimes(1)
      expect(service.photos.purgePerson).toHaveBeenCalledWith(2)
    })

    it('③5 秒内 undo() → 按原索引插回(中间位置),purgePerson 永不调用', async () => {
      const s = await seeded3()
      const undo = s.purgePersonWithUndo(2)
      await vi.advanceTimersByTimeAsync(2000)
      undo()
      expect(s.people.map((p) => p.id)).toEqual([1, 2, 3]) // 原索引 1(中间)
      await vi.advanceTimersByTimeAsync(5000)
      expect(service.photos.purgePerson).not.toHaveBeenCalled()
    })

    it('④计时器已触发后再 undo() → no-op(不重复插回)', async () => {
      const s = await seeded3()
      const undo = s.purgePersonWithUndo(2)
      await vi.advanceTimersByTimeAsync(5000)
      expect(service.photos.purgePerson).toHaveBeenCalledTimes(1)
      undo()
      expect(s.people.map((p) => p.id)).toEqual([1, 3]) // 未被插回
    })

    // 评审必修 1:上面④只验证了"finally 已经跑完之后"的 no-op,没有覆盖"committed 已置位、
    // 但 purgePerson 请求还没 settle"这段窗口——之前 advanceTimersByTimeAsync(5000) 会连着
    // 把微任务队列一起冲掉,mock 的 purgePerson 在同一个 await 里就 resolve 了,所以旧版的
    // ④根本没踩到这段窗口,删掉"修正 1"(committed 标志 + .finally 延迟删除)也全绿。这里
    // 用手动可控的 pending Promise 卡住 purgePerson,专门卡在"计时器已同步触发、committed
    // 已置位、但请求尚未 settle"这一刻做断言,才是唯一能证明"修正 1"确实生效的测试。
    it('committed 但 purgePerson 仍在途:窗口过滤在请求 settle 前不能失效(回归修正 1)', async () => {
      const s = await seeded3()
      let resolvePurge: (v: unknown) => void = () => {}
      ;(service.photos.purgePerson as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolvePurge = resolve }),
      )
      s.purgePersonWithUndo(2)
      // 同步推进(非 …Async):只让 setTimeout 回调本身跑完,不等待/冲掉它内部触发的
      // purgePerson() 返回的 Promise——这样才能停在"committed=true 但请求未 settle"这一刻。
      vi.advanceTimersByTime(5000)
      expect(service.photos.purgePerson).toHaveBeenCalledTimes(1)

      ;(service.photos.listPersons as any).mockResolvedValueOnce({
        persons: [rawPerson({ id: 1, name: 'A' }), rawPerson({ id: 2, name: 'B' }), rawPerson({ id: 3, name: 'C' })],
      })
      await s.fetchPeople()
      expect(s.people.map((p) => p.id)).toEqual([1, 3]) // 仍必须被过滤掉,不能诈尸

      resolvePurge({}) // 收尾:让 .finally 跑完,避免把 pending entry 悬挂给下一个用例
      await vi.advanceTimersByTimeAsync(0)
    })

    it('committed 但 purgePerson 仍在途:undo() 是 no-op,不能把服务端正在删的人插回来(回归修正 1)', async () => {
      const s = await seeded3()
      let resolvePurge: (v: unknown) => void = () => {}
      ;(service.photos.purgePerson as any).mockImplementationOnce(
        () => new Promise((resolve) => { resolvePurge = resolve }),
      )
      const undo = s.purgePersonWithUndo(2)
      vi.advanceTimersByTime(5000)
      expect(service.photos.purgePerson).toHaveBeenCalledTimes(1)

      undo()
      expect(s.people.map((p) => p.id)).toEqual([1, 3]) // 未被插回

      resolvePurge({})
      await vi.advanceTimersByTimeAsync(0)
    })

    it('窗口期过滤:挂起期间 fetchPeople 仍含该人物 → people 里不出现', async () => {
      const s = await seeded3()
      s.purgePersonWithUndo(2)
      ;(service.photos.listPersons as any).mockResolvedValueOnce({
        persons: [rawPerson({ id: 1, name: 'A' }), rawPerson({ id: 2, name: 'B' }), rawPerson({ id: 3, name: 'C' })],
      })
      await s.fetchPeople()
      expect(s.people.map((p) => p.id)).toEqual([1, 3])
    })

    it('窗口期过滤:undo() 之后再 fetchPeople → 该人物正常出现', async () => {
      const s = await seeded3()
      const undo = s.purgePersonWithUndo(2)
      undo()
      ;(service.photos.listPersons as any).mockResolvedValueOnce({
        persons: [rawPerson({ id: 1, name: 'A' }), rawPerson({ id: 2, name: 'B' }), rawPerson({ id: 3, name: 'C' })],
      })
      await s.fetchPeople()
      expect(s.people.map((p) => p.id).sort((a, b) => Number(a) - Number(b))).toEqual([1, 2, 3])
    })

    it('重复触发复用首次 idx:删中间位置的人 → 未撤销再次触发 → undo() 后仍插回原始索引', async () => {
      const s = await seeded3()
      s.purgePersonWithUndo(2) // 第一次触发,idx=1 记入 map
      const undo2 = s.purgePersonWithUndo(2) // 同一 id 再次触发(此刻 people 里已经没有 id=2 了)
      undo2()
      expect(s.people.map((p) => p.id)).toEqual([1, 2, 3]) // 仍是原始索引 1,不是末尾追加
      await vi.advanceTimersByTimeAsync(5000)
      expect(service.photos.purgePerson).not.toHaveBeenCalled()
    })

    it('数字/字符串 id 交叉:后端数字 id,用字符串 id 调 purgePersonWithUndo 命中并可 undo', async () => {
      const s = await seeded3()
      const undo = s.purgePersonWithUndo('2') // 字符串 id,后端存的是数字 2
      expect(s.people.map((p) => p.id)).toEqual([1, 3])
      undo()
      expect(s.people.map((p) => p.id)).toEqual([1, 2, 3])
    })

    it('purgePerson 失败 → 插回原位,不 fetchPeople', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const s = await seeded3()
      ;(service.photos.purgePerson as any).mockRejectedValueOnce(new Error('x'))
      s.purgePersonWithUndo(2)
      const callsBefore = (service.photos.listPersons as any).mock.calls.length
      await vi.advanceTimersByTimeAsync(5000)
      expect(s.people.map((p) => p.id)).toEqual([1, 2, 3]) // 插回原位
      expect((service.photos.listPersons as any).mock.calls.length).toBe(callsBefore) // 未 fetchPeople
      errSpy.mockRestore()
    })
  })

  describe('数字 id / 字符串 id 交叉(铁律回归,非 purge 路径)', () => {
    it('personById / patchPerson 全部按 String 归一命中', async () => {
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 42, name: 'Num' })] })
      const s = usePhotosPeople()
      await s.fetchPeople()
      expect(s.personById('42')?.name).toBe('Num')
      s.patchPerson('42', { name: 'Renamed' })
      expect(s.personById(42)?.name).toBe('Renamed')
    })
    // 评审 Issue 6 顺带补的两条便宜覆盖之二:personById 未命中的返回值之前没有断言过。
    it('personById 未命中 → 返回 null', () => {
      const s = usePhotosPeople()
      expect(s.personById('does-not-exist')).toBeNull()
    })
  })

  describe('合并建议', () => {
    it('acceptMergeSuggestion:乐观移除建议 + 调 mergePersons(fromId,intoId) + finally 重拉人物', async () => {
      const s = usePhotosPeople()
      s.mergeSuggestions = [{ id: 's1', fromId: 1, intoId: 2 }]
      const p = s.acceptMergeSuggestion('s1')
      expect(s.mergeSuggestions).toEqual([]) // 乐观立即移除
      await p
      expect(service.photos.mergePersons).toHaveBeenCalledWith(1, 2)
      expect(service.photos.listPersons).toHaveBeenCalledTimes(1)
    })
    it('acceptMergeSuggestion 失败 → 重拉建议 + 抛出', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const s = usePhotosPeople()
      s.mergeSuggestions = [{ id: 's1', fromId: 1, intoId: 2 }]
      ;(service.photos.mergePersons as any).mockRejectedValueOnce(new Error('x'))
      await expect(s.acceptMergeSuggestion('s1')).rejects.toThrow('x')
      expect(service.photos.mergeSuggestions).toHaveBeenCalledTimes(1)
      errSpy.mockRestore()
    })
    // 回归(评审必修 3):suggestionId 在本地找不到时,acceptMergeSuggestion 不应打任何后端
    // 请求——brief 快照的 finally 在 if(s) 外面会在这里多打一次 listPersons;Vue2 :1227-1234
    // 整段 try/finally 都在 if(s) 里,找不到就什么都不做。
    it('acceptMergeSuggestion:suggestionId 本地找不到 → 不调 mergePersons、不调 listPersons', async () => {
      const s = usePhotosPeople()
      s.mergeSuggestions = [{ id: 's1', fromId: 1, intoId: 2 }]
      await s.acceptMergeSuggestion('does-not-exist')
      expect(s.mergeSuggestions).toEqual([{ id: 's1', fromId: 1, intoId: 2 }]) // filter 对没有的 id 是 no-op
      expect(service.photos.mergePersons).not.toHaveBeenCalled()
      expect(service.photos.listPersons).not.toHaveBeenCalled()
    })
    it('rejectMergeSuggestion:不重拉人物列表', async () => {
      const s = usePhotosPeople()
      s.mergeSuggestions = [{ id: 's1', fromId: 1, intoId: 2 }]
      await s.rejectMergeSuggestion('s1')
      expect(service.photos.rejectMergeSuggestion).toHaveBeenCalledWith(1, 2)
      expect(service.photos.listPersons).not.toHaveBeenCalled()
    })
    it('dismissAllMerges:纯本地清空,不发请求', () => {
      const s = usePhotosPeople()
      s.mergeSuggestions = [{ id: 's1', fromId: 1, intoId: 2 }]
      s.dismissAllMerges()
      expect(s.mergeSuggestions).toEqual([])
      expect(service.photos.rejectMergeSuggestion).not.toHaveBeenCalled()
      expect(service.photos.mergePersons).not.toHaveBeenCalled()
    })
  })

  describe('__resetForTest', () => {
    // 风格清理:用 describe 级 beforeEach/afterEach 切换 fake timers,而不是在 it() 内联
    // vi.useFakeTimers()/vi.useRealTimers()——跟文件里其余用到 fake timers 的 describe 一致。
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('清空定时器与状态,不跨用例泄漏', async () => {
      const s = usePhotosPeople()
      ;(service.photos.listPersons as any).mockResolvedValueOnce({ persons: [rawPerson({ id: 1 })] })
      await s.fetchPeople()
      s.purgePersonWithUndo(1)
      s.__resetForTest()
      expect(s.people).toEqual([])
      expect(s.peopleLoaded).toBe(false)
      expect(s.facesIndexedUpTo).toBeNull()
      expect(s.mergeSuggestions).toEqual([])
      await vi.advanceTimersByTimeAsync(5000)
      expect(service.photos.purgePerson).not.toHaveBeenCalled() // 定时器已被清
    })
  })
})
