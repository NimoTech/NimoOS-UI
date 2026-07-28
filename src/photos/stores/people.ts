// Ported from Vue2 NimoOS-UI src/store/modules/photos.js:
//   state      :277-292   (people / peopleLoaded / facesIndexedUpTo / peopleFilter / mergeSuggestions)
//   mutations  :350-361, :503-529
//   actions    :1079-1099 (fetch/filter), :1100-1120 (rename/relation/fav),
//              :1121-1132 (cover), :1143-1153 (merge), :1171-1211 (purge+undo), :1224-1248 (suggestions)
// Photos v1 后端无信封:listPersons 是 { persons, facesIndexedUpTo } 对象包裹体,包内不解包,这里自己解。
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import {
  toPerson, namedOf, unnamedOf, visibleUnnamedOf, hiddenSingletonCountOf,
  type Person, type PeopleFilter,
} from '../util/peopleView'

const LS_CONFIDENCE = 'nimo_people_confidence'
const LS_SHOW_SINGLETONS = 'nimo_people_show_singletons'
const CONFIDENCE_ALLOWED = [50, 60, 70, 80, 90, 95]
const PURGE_DELAY_MS = 5000

// 撤销清除的挂起项。定时器与快照不可序列化,照 Vue2 放模块作用域(photos.js:230-231),不进 state。
// key 一律 String(id)(铁律:后端 id 可能是数字、路由参数恒是字符串)。
interface PurgeEntry { timer: ReturnType<typeof setTimeout>; snapshot: Person | null; idx: number; committed: boolean }
const _purgeTimers = new Map<string, PurgeEntry>()

function readFilter(): PeopleFilter {
  // 照 Vue2 photos.js:283-291 的 IIFE:白名单校验 + 严格 '1' 比较 + 整体 try 兜底(隐私模式/SSR)。
  const def: PeopleFilter = { confidence: 80, showSingletons: false }
  try {
    const c = parseInt(localStorage.getItem(LS_CONFIDENCE) ?? '', 10)
    if (CONFIDENCE_ALLOWED.includes(c)) def.confidence = c
    def.showSingletons = localStorage.getItem(LS_SHOW_SINGLETONS) === '1'
  } catch {
    /* localStorage 不可用时保持默认值 */
  }
  return def
}

export const usePhotosPeople = defineStore('photosPeople', () => {
  const people = ref<Person[]>([])
  // New-UI 增:空态门控。只在 fetchPeople 成功路径置 true,失败留 false 可重试
  // (P3 血泪:无条件置位会让瞬时失败与「确认零人物」不可区分)。Vue2 的 peopleLoaded 是只写不读的死字段。
  const peopleLoaded = ref(false)
  const facesIndexedUpTo = ref<string | null>(null)
  const filter = ref<PeopleFilter>(readFilter())
  const mergeSuggestions = ref<Array<Record<string, unknown>>>([])

  const named = computed(() => namedOf(people.value))
  const unnamed = computed(() => unnamedOf(people.value))
  const visibleUnnamed = computed(() => visibleUnnamedOf(unnamed.value, filter.value))
  const namedCount = computed(() => named.value.length)
  // 侧栏/顶栏计数与网格必须同一口径:未命名计数用「可见的」而不是全部(Vue2 photos.js:344 注释强调)。
  const unnamedCount = computed(() => visibleUnnamed.value.length)
  const hiddenSingletonCount = computed(() => hiddenSingletonCountOf(unnamed.value, filter.value))

  const key = (id: string | number): string => String(id)
  function personById(id: string | number): Person | null {
    return people.value.find((p) => key(p.id) === key(id)) ?? null
  }

  // ── 本地写入(对应 Vue2 的四个 mutation)──
  function patchPerson(id: string | number, patch: Partial<Person>): void {
    const i = people.value.findIndex((p) => key(p.id) === key(id))
    if (i >= 0) people.value.splice(i, 1, { ...people.value[i], ...patch })  // 找不到静默无操作,照 Vue2 :514-517
  }
  function removePerson(id: string | number): void {
    people.value = people.value.filter((p) => key(p.id) !== key(id))
  }
  function insertPersonAt(person: Person, idx: number): void {
    const arr = [...people.value]
    const clamped = idx >= 0 && idx <= arr.length ? idx : arr.length   // 越界/负数回落末尾追加,照 Vue2 :521-526
    arr.splice(clamped, 0, person)
    people.value = arr
  }

  // ── 读取 ──
  async function fetchPeople(): Promise<void> {
    try {
      const raw = (await service.photos.listPersons()) as
        { persons?: unknown; facesIndexedUpTo?: unknown } | undefined
      const list = Array.isArray(raw?.persons) ? (raw?.persons as Record<string, unknown>[]) : []
      const mapped = list.map(toPerson)
      // 撤销窗口期内的人物要从重拉结果里滤掉,否则「删了又冒出来」(Vue2 mutation SET_PEOPLE :507)。
      people.value = _purgeTimers.size ? mapped.filter((p) => !_purgeTimers.has(key(p.id))) : mapped
      if (raw?.facesIndexedUpTo !== undefined) {
        facesIndexedUpTo.value = (raw.facesIndexedUpTo as string | null) ?? null
      }
      peopleLoaded.value = true
    } catch (e) {
      // 偏离登记:Vue2(photos.js:1086-1089)在这里把列表清空成 [],一次网络抖动就抹掉已加载数据。
      // 这里只记日志、保留上一次数据;peopleLoaded 不置位(首次失败留 false 可重试)。
      console.error('[photos-people] fetchPeople', e)
    }
  }

  async function fetchMergeSuggestions(): Promise<void> {
    try {
      const list = (await service.photos.mergeSuggestions()) as Array<Record<string, unknown>> | undefined
      mergeSuggestions.value = Array.isArray(list) ? list : []
    } catch (e) {
      // 同上:Vue2 :1095-1098 失败清空,这里保留上一次数据。
      console.error('[photos-people] fetchMergeSuggestions', e)
    }
  }

  // ── 过滤条件(写 localStorage,照 Vue2 mutation :350-361)──
  function setConfidence(v: number): void {
    filter.value = { ...filter.value, confidence: v }
    try { localStorage.setItem(LS_CONFIDENCE, String(v)) } catch { /* 忽略写入失败 */ }
  }
  function setShowSingletons(v: boolean): void {
    filter.value = { ...filter.value, showSingletons: !!v }
    try { localStorage.setItem(LS_SHOW_SINGLETONS, v ? '1' : '0') } catch { /* 忽略写入失败 */ }
  }

  // ── 写入(乐观策略逐个保真,注意每个都不一样)──

  // 乐观 patch;失败不精确回滚,而是 fetchPeople 用服务端真值纠正(照 Vue2 renameCluster :1100-1103)。
  // 抛出:视图层要弹失败 toast 并还原输入框(Vue2 吞错=用户看不到失败,属偏离登记 1 的同类)。
  async function renamePerson(id: string | number, name: string): Promise<void> {
    patchPerson(id, { name })
    try {
      await service.photos.updatePerson(id, { name })
    } catch (e) {
      console.error('[photos-people] renamePerson', e)
      void fetchPeople()
      throw e
    }
  }

  // 偏离登记 4:Vue2(PhotosPersonDetail.vue:951-955)fire-and-forget 且不回滚详情页本地值。
  // 这里乐观 patch + 失败精确回滚 + rethrow,视图层 catch → toast。
  async function setPersonRelation(id: string | number, relation: string): Promise<void> {
    const prev = personById(id)?.relation ?? ''
    patchPerson(id, { relation })
    try {
      await service.photos.updatePerson(id, { relation })
    } catch (e) {
      console.error('[photos-people] setPersonRelation', e)
      patchPerson(id, { relation: prev })
      throw e
    }
  }

  // 偏离登记 3:Vue2(photos.js:1113-1120)本地列表找不到该 person 就 return,一个请求都不发
  // (深链直接进详情页时 people 是空的),而详情页无条件翻转本地 favorite —— UI 说已收藏、后端毫不知情。
  // 这里不依赖本地命中:总是打后端;命中才顺带 patch;失败回滚 + rethrow。
  async function setPersonFavorite(id: string | number, next: boolean): Promise<void> {
    const hit = personById(id)
    if (hit) patchPerson(id, { favorite: next })
    try {
      await service.photos.updatePerson(id, { favorite: next })
    } catch (e) {
      console.error('[photos-people] setPersonFavorite', e)
      if (hit) patchPerson(id, { favorite: !next })
      throw e
    }
  }

  // 非乐观:等后端回来才写本地(照 Vue2 :1121-1132)。返回新的 coverFaceId 供视图刷新头像。
  // 逐行核对 Vue2 :1123-1125 发现出入:Vue2 用 `!== undefined` 判定是否写入 —— 哪怕后端显式
  // 返回 coverFaceId: null 也会 patch 成 null(清空本地封面);brief 快照用 `res?.coverFaceId ?? null`
  // 把"显式 null"和"字段缺席"归一成了同一个值,会让显式清空的响应被误判成"没带字段"从而
  // 不写,留着陈旧封面。以 Vue2 源为准,改成对原始字段做 `!== undefined` 判定。
  async function setPersonCover(id: string | number, assetId: string | number): Promise<string | number | null> {
    try {
      const res = (await service.photos.setPersonCover(id, assetId)) as
        { coverFaceId?: string | number | null } | undefined
      const coverFaceId = res?.coverFaceId
      if (coverFaceId !== undefined) patchPerson(id, { coverFaceId })
      return coverFaceId ?? null
    } catch (e) {
      console.error('[photos-people] setPersonCover', e)
      throw e
    }
  }

  // 非乐观(照 Vue2 :1133-1142)。assetId 传 null = 回退到人脸缩略图,后端字段传空串。
  async function setPersonHero(id: string | number, assetId: string | number | null): Promise<void> {
    try {
      await service.photos.updatePerson(id, { heroAssetId: assetId ?? '' })
      patchPerson(id, { heroAssetId: assetId })
    } catch (e) {
      console.error('[photos-people] setPersonHero', e)
      throw e
    }
  }

  // 照 Vue2 mergeClusterInto :1143-1153:抛出给调用方,且 finally 无条件重拉两份数据(成功失败都要)。
  async function mergePersonInto(fromId: string | number, intoId: string | number): Promise<void> {
    try {
      await service.photos.mergePersons(fromId, intoId)
    } catch (e) {
      console.error('[photos-people] mergePersonInto', e)
      throw e
    } finally {
      void fetchPeople()
      void fetchMergeSuggestions()
    }
  }

  // 5 秒可撤销的彻底清除。返回 undo 闭包(照 Vue2 purgeClusterWithUndo :1171-1211),两处时序修正见注释。
  function purgePersonWithUndo(id: string | number): () => void {
    const k = key(id)
    const existing = _purgeTimers.get(k)
    // 修正 2(Vue2 :1178-1180):同一 id 在窗口内被再次触发时,Vue2 会用「已经移除过一次的列表」重算 idx,
    // 撤销后插回的位置就不是原位了。这里复用首次的 snapshot 与 idx。
    const idx = existing ? existing.idx : people.value.findIndex((p) => key(p.id) === k)
    const snapshot = existing ? existing.snapshot : (idx >= 0 ? { ...people.value[idx] } : null)
    if (existing) { clearTimeout(existing.timer); _purgeTimers.delete(k) }

    removePerson(id)

    let cancelled = false
    const undo = (): void => {
      const pending = _purgeTimers.get(k)
      if (!pending || pending.committed) return   // 窗口已过(定时器已触发)→ no-op,照 Vue2
      if (cancelled) return                        // 同一个 undo 被连点两次的防护,照 Vue2 :1186
      cancelled = true
      clearTimeout(pending.timer)
      _purgeTimers.delete(k)
      if (snapshot) insertPersonAt(snapshot, idx)
    }

    const timer = setTimeout(() => {
      const entry = _purgeTimers.get(k)
      if (!entry || cancelled) return
      // 修正 1(Vue2 :1198 早于 :1201):Vue2 在发请求**之前**就把 entry 摘掉,网络在途这段窗口里
      // 若有一次 fetchPeople,被删的人物会「诈尸」重现。这里改成:先标记 committed(让 undo 失效,
      // 保住「过期不可撤销」语义),entry 留到请求 settle 后才在 finally 里摘除,过滤窗口因此不留缝。
      entry.committed = true
      void service.photos
        .purgePerson(id)
        .catch((e: unknown) => {
          console.error('[photos-people] purgePersonWithUndo', e)
          // 失败即把快照插回原位;不 fetchPeople —— 此刻服务端可能仍返回旧视图,会把刚插回的again冲掉
          // (照 Vue2 :1204-1205 的注释与做法)。
          if (snapshot) insertPersonAt(snapshot, idx)
        })
        .finally(() => { _purgeTimers.delete(k) })
    }, PURGE_DELAY_MS)

    _purgeTimers.set(k, { timer, snapshot, idx, committed: false })
    return undo
  }

  // 合并建议:先乐观移除建议,失败重拉建议列表纠正(照 Vue2 :1224-1246)。
  // accept 的 finally 无条件 fetchPeople(合并会改变人物列表);reject 不动人物列表。
  async function acceptMergeSuggestion(suggestionId: string | number): Promise<void> {
    const s = mergeSuggestions.value.find((m) => key(m.id as string | number) === key(suggestionId))
    mergeSuggestions.value = mergeSuggestions.value.filter((m) => key(m.id as string | number) !== key(suggestionId))
    try {
      if (s) await service.photos.mergePersons(s.fromId as string | number, s.intoId as string | number)
    } catch (e) {
      console.error('[photos-people] acceptMergeSuggestion', e)
      void fetchMergeSuggestions()
      throw e
    } finally {
      void fetchPeople()
    }
  }

  async function rejectMergeSuggestion(suggestionId: string | number): Promise<void> {
    const s = mergeSuggestions.value.find((m) => key(m.id as string | number) === key(suggestionId))
    mergeSuggestions.value = mergeSuggestions.value.filter((m) => key(m.id as string | number) !== key(suggestionId))
    try {
      if (s) await service.photos.rejectMergeSuggestion(s.fromId as string | number, s.intoId as string | number)
    } catch (e) {
      console.error('[photos-people] rejectMergeSuggestion', e)
      void fetchMergeSuggestions()
      throw e
    }
  }

  // 纯本地清空:后端没有「全部忽略」端点,下次 fetchMergeSuggestions 建议会重新出现(照 Vue2 :1248 的注释)。
  function dismissAllMerges(): void { mergeSuggestions.value = [] }

  function __resetForTest(): void {
    for (const entry of _purgeTimers.values()) clearTimeout(entry.timer)
    _purgeTimers.clear()
    people.value = []
    peopleLoaded.value = false
    facesIndexedUpTo.value = null
    mergeSuggestions.value = []
    filter.value = readFilter()
  }

  return {
    people, peopleLoaded, facesIndexedUpTo, filter, mergeSuggestions,
    named, unnamed, visibleUnnamed, namedCount, unnamedCount, hiddenSingletonCount,
    personById, patchPerson,
    fetchPeople, fetchMergeSuggestions, setConfidence, setShowSingletons,
    renamePerson, setPersonRelation, setPersonFavorite, setPersonCover, setPersonHero,
    mergePersonInto, purgePersonWithUndo,
    acceptMergeSuggestion, rejectMergeSuggestion, dismissAllMerges,
    __resetForTest,
  }
})
