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
import { isNotFound } from '../util/httpErrors'

const LS_CONFIDENCE = 'nimo_people_confidence'
const LS_SHOW_SINGLETONS = 'nimo_people_show_singletons'
const CONFIDENCE_ALLOWED = [50, 60, 70, 80, 90, 95]
const PURGE_DELAY_MS = 5000

// 撤销清除的挂起项。定时器与快照不可序列化,照 Vue2 放模块作用域(photos.js:230-231),不进 state。
// key 一律 String(id)(铁律:后端 id 可能是数字、路由参数恒是字符串)。
interface PurgeEntry { timer: ReturnType<typeof setTimeout>; snapshot: Person | null; idx: number; committed: boolean }
const _purgeTimers = new Map<string, PurgeEntry>()

// Task 7 (Plan D, SP7-P5 人物): 隐藏请求在途期间的临时守卫 —— 防止一次竞态的 fetchPeople
// 把刚乐观移除的人物又拉回来(照 Vue2 hidePersonAction 的 _pendingPersonRemovals 窗口:
// 发请求前加入、finally 移除,photos.js:1592-1607)。不复用 _purgeTimers:那个 Map 存的是
// 撤销闭包需要的 snapshot/idx/timer,语义上属于"5 秒可撤销清除";隐藏没有那个窗口,只需要
// 覆盖这一次 HTTP 往返,用独立的小 Set 更清楚,也不会跟 purge 的"复用首次 idx"分支互相干扰。
const _pendingHides = new Set<string>()

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

  // Task 7 (Plan D): Hidden people 分区状态(照 Vue2 photos.js:392-399)。
  const hiddenPeople = ref<Person[]>([])
  const hiddenPeopleLoaded = ref(false)
  // 假定 true 直到一次真实 404 证明后端还没有隐藏功能(S4 之前的旧后端)—— People 页用它
  // 整体隐藏"Hidden people"分区与"Hide person"菜单项,不弹错误 toast(照 Vue2 :396-399)。
  const hiddenPeopleSupported = ref(true)

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
      // 撤销窗口期内的人物、以及隐藏请求在途期间的人物都要从重拉结果里滤掉,否则「删了/
      // 隐藏了又冒出来」(Vue2 mutation SET_PEOPLE :507,724-726 用的是同一个
      // _pendingPersonRemovals 集合;这里 _purgeTimers 与 _pendingHides 分属两套独立机制,
      // 见 _pendingHides 声明处的注释)。
      people.value = (_purgeTimers.size || _pendingHides.size)
        ? mapped.filter((p) => !_purgeTimers.has(key(p.id)) && !_pendingHides.has(key(p.id)))
        : mapped
      // 未登记偏离(评审必修 3,补登记):这里的 `!== undefined` 照的是 Vue2 **mutation**
      // 层(:509)的判定,但 Vue2 **action** 层(fetchPeople :1085)总是把
      // `data.facesIndexedUpTo || null` 传给 mutation——成功路径永远是"有值或 null",
      // 从不是 undefined,所以 Vue2 的真实行为其实是「响应缺这个字段就把本地值重置成
      // null」,只有失败分支(commit 时压根不带这个键)才会落到"不覆盖"这条路径。
      // 这里没有 action/mutation 两层包装,直接照 mutation 的语义实现:字段缺席就保留旧值,
      // 不reset 成 null——判定这样更好(响应体正常但漏字段时不该丢用户已看到的旧值),
      // 保留,不改回 Vue2。顺带 `||` → `??`:Vue2 会把空字符串 `''` 当 falsy 归一成 null,
      // 这里 `?? null` 只处理 null/undefined,空字符串会原样保留。
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
  //
  // T14 评审必修 1(纯加性修正,不改任何既有行为):返回类型补上 `| undefined`,**不再**用
  // `?? null` 把"字段缺席"压成 null。原来那个 `?? null` 把上面这行小心区分出来的两种情况
  // 又在返回值上合并了 —— 调用方(详情页容器)拿到 null 无法分辨「后端说要清空封面」与
  // 「后端根本没提封面」,无条件 patch 就会在后端返回 `200 {}` 时把本地 coverFaceId 抹成
  // null,详情页 hero 当场退化成渐变兜底(PersonHero.vue:76 的 isFallback 立刻为真)。
  // 现在语义在整条边界上一致:undefined = 字段缺席(调用方应保持原值),null = 显式清空。
  // 既有三条 store 测试不受影响(「字段缺席」那条不断言返回值,「显式 null」那条仍得 null)。
  async function setPersonCover(
    id: string | number, assetId: string | number,
  ): Promise<string | number | null | undefined> {
    try {
      const res = (await service.photos.setPersonCover(id, assetId)) as
        { coverFaceId?: string | number | null } | undefined
      const coverFaceId = res?.coverFaceId
      if (coverFaceId !== undefined) patchPerson(id, { coverFaceId })
      return coverFaceId
    } catch (e) {
      console.error('[photos-people] setPersonCover', e)
      throw e
    }
  }

  // 非乐观(照 Vue2 :1133-1142)。assetId 传 null = 回退到人脸缩略图,后端字段传空串。
  // 未登记偏离(评审必修 3,补登记):Vue2 :1136-1137 用的是 `assetId || ''`(发后端)和
  // `assetId || null`(写本地)——falsy 判定,若 assetId 恰好是数字 `0` 或空串 `''` 这类
  // "合法但 falsy" 的值,会被误判成"清空"。这里改用 `?? ''` 只处理 null/undefined,并把
  // 本地 patch 直接写原始 assetId(不做 `|| null` 归一)——在 assetId 为 `0`/`''` 时与
  // Vue2 行为分叉:Vue2 会清空,这里会保留原值。判定这里更好(id 语义上 falsy 值可能是
  // 合法 id,不该被静默清空),保留,不改回 Vue2。
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

    // 评审修正(必修 2):entry 是本次 purge 的身份令牌。同一 id 在 committed(已发出
    // DELETE、请求仍在途)期间被再次触发是合法场景(上面 existing 分支处理),会换成一条
    // 新 entry;此时旧 entry 对应的 timer 回调与 undo 闭包必须能分辨"我已经被换下了",
    // 不能凭 key 还在 map 里就误删/误插新 entry 的状态——一律用 `_purgeTimers.get(k) === entry`
    // 的引用相等判断"当前 map 里这一条还是不是我自己",而不是只判断 key 是否存在。
    // 这也让原来单独维护的 `cancelled` 标志变得多余:第一次 undo() 会把 entry 从 map 里
    // delete,同一个 undo 被连点第二次时 `_purgeTimers.get(k)` 已经不是它自己,天然 no-op。
    const entry: PurgeEntry = {
      timer: undefined as unknown as ReturnType<typeof setTimeout>,
      snapshot,
      idx,
      committed: false,
    }

    const undo = (): void => {
      if (_purgeTimers.get(k) !== entry) return   // 不是当前这一条(已被连点吞掉,或被新一轮 purge 换下)
      if (entry.committed) return                  // 窗口已过(定时器已触发)→ no-op,照 Vue2
      _purgeTimers.delete(k)
      clearTimeout(entry.timer)
      if (entry.snapshot) insertPersonAt(entry.snapshot, entry.idx)
    }

    entry.timer = setTimeout(() => {
      if (_purgeTimers.get(k) !== entry) return    // 已被连点撤销,或已被新一轮 purge 换下
      // 修正 1(Vue2 :1198 早于 :1201):Vue2 在发请求**之前**就把 entry 摘掉,网络在途这段窗口里
      // 若有一次 fetchPeople,被删的人物会「诈尸」重现。这里改成:先标记 committed(让 undo 失效,
      // 保住「过期不可撤销」语义),entry 留到请求 settle 后才在 finally 里摘除,过滤窗口因此不留缝。
      // 回归测试见 people.test.ts「committed 但 purgePerson 仍在途」两条(评审必修 1)。
      entry.committed = true
      void service.photos
        .purgePerson(id)
        .catch((e: unknown) => {
          console.error('[photos-people] purgePersonWithUndo', e)
          // 失败即把快照插回原位;不 fetchPeople —— 此刻服务端可能仍返回旧视图,会把刚插回的又冲掉
          // (照 Vue2 :1204-1205 的注释与做法)。
          if (entry.snapshot) insertPersonAt(entry.snapshot, entry.idx)
        })
        .finally(() => {
          // 评审修正(必修 2):删之前先确认 map 里还是自己这条,不能无脑 delete(k)。
          // 场景:committed 后(DELETE 请求在途)同一 id 被再次触发,旧 entry 已被换成新
          // entry2;若这里无条件 delete(k),请求 1 settle 时会把 entry2 一起删掉——entry2
          // 的 timer2 到点发现 `get(k) === undefined` 直接 return,第二轮清除永远发不出去,
          // 它的 undo 也失效(死引用)。
          if (_purgeTimers.get(k) === entry) _purgeTimers.delete(k)
        })
    }, PURGE_DELAY_MS)

    _purgeTimers.set(k, entry)
    return undo
  }

  // 合并建议:先乐观移除建议,失败重拉建议列表纠正(照 Vue2 :1224-1246)。
  // accept 的 finally 无条件 fetchPeople(合并会改变人物列表);reject 不动人物列表。
  async function acceptMergeSuggestion(suggestionId: string | number): Promise<void> {
    const s = mergeSuggestions.value.find((m) => key(m.id as string | number) === key(suggestionId))
    mergeSuggestions.value = mergeSuggestions.value.filter((m) => key(m.id as string | number) !== key(suggestionId))
    // 修正(评审必修 3):brief 快照把 `finally { fetchPeople() }` 放在 `if (s)` 外面,
    // suggestionId 在本地找不到(已被别处消费/过期)时也会白打一次 listPersons——Vue2
    // :1227-1234 的 try/catch/finally 整段都在 `if (s)` 里面,找不到就什么都不做。这里
    // 收进 if(s) 对齐 Vue2:没有真正发生合并就没有理由重拉人物列表,减少一次无意义请求。
    if (s) {
      try {
        await service.photos.mergePersons(s.fromId as string | number, s.intoId as string | number)
      } catch (e) {
        console.error('[photos-people] acceptMergeSuggestion', e)
        void fetchMergeSuggestions()
        throw e
      } finally {
        void fetchPeople()
      }
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

  // ── 隐藏人物(Task 7,Plan D)。照 Vue2 hidePersonAction/fetchHiddenPeople/unhidePerson
  // (photos.js:1585-1633)——三条动作分工与 Vue2 一一对应,不合并。

  // 即时隐藏,无确认弹窗:非破坏性、随时可从"Hidden people"分区里 unhidePerson 撤销
  // (照 Vue2 :1585-1591 的注释)。乐观 REMOVE_PERSON + 失败快照回滚,手法同
  // purgePersonWithUndo 的 snapshot/idx(去掉了那边独有的 5 秒 undo 定时器 —— 隐藏没有
  // 那个撤销窗口,不需要)。返回成功与否,交给调用方(视图层)决定要不要 toast/导航。
  async function hidePerson(id: string | number): Promise<boolean> {
    const k = key(id)
    const idx = people.value.findIndex((p) => key(p.id) === k)
    const snapshot = idx >= 0 ? { ...people.value[idx] } : null
    removePerson(id)
    _pendingHides.add(k)
    try {
      await service.photos.hidePerson(id)
    } catch (e) {
      console.error('[photos-people] hidePerson', e)
      if (snapshot) insertPersonAt(snapshot, idx)
      return false
    } finally {
      _pendingHides.delete(k)
    }
    return true
  }

  // 拉隐藏人物列表。特性探测:老后端没有隐藏功能,GET /persons/hidden 会 404 —— 命中就把
  // hiddenPeopleSupported 翻成 false,让视图整体隐藏"Hidden people"分区/菜单项,不弹错误
  // toast(照 Vue2 :1608-1623)。
  async function fetchHiddenPeople(): Promise<void> {
    try {
      const list = (await service.photos.listHiddenPersons()) as Record<string, unknown>[] | undefined
      hiddenPeople.value = Array.isArray(list) ? list.map(toPerson) : []
      hiddenPeopleLoaded.value = true
      hiddenPeopleSupported.value = true
    } catch (e) {
      if (isNotFound(e)) {
        hiddenPeopleSupported.value = false
      } else {
        console.error('[photos-people] fetchHiddenPeople', e)
      }
    }
  }

  // Unhide 复用 restorePerson(与撤销删除同一个端点)—— 隐藏和删除在服务端都只是把人物
  // 移出可见列表(照 Vue2 :1624-1633)。无论成败都重拉两份列表对账(照 Vue2 unconditional
  // finally dispatch,不像别的写入路径那样区分成功/失败分支)。
  async function unhidePerson(id: string | number): Promise<void> {
    try {
      await service.photos.restorePerson(id)
    } catch (e) {
      console.error('[photos-people] unhidePerson', e)
    } finally {
      void fetchPeople()
      void fetchHiddenPeople()
    }
  }

  function __resetForTest(): void {
    for (const entry of _purgeTimers.values()) clearTimeout(entry.timer)
    _purgeTimers.clear()
    _pendingHides.clear()
    people.value = []
    peopleLoaded.value = false
    facesIndexedUpTo.value = null
    mergeSuggestions.value = []
    filter.value = readFilter()
    hiddenPeople.value = []
    hiddenPeopleLoaded.value = false
    hiddenPeopleSupported.value = true
  }

  return {
    people, peopleLoaded, facesIndexedUpTo, filter, mergeSuggestions,
    hiddenPeople, hiddenPeopleLoaded, hiddenPeopleSupported,
    named, unnamed, visibleUnnamed, namedCount, unnamedCount, hiddenSingletonCount,
    personById, patchPerson,
    fetchPeople, fetchMergeSuggestions, setConfidence, setShowSingletons,
    renamePerson, setPersonRelation, setPersonFavorite, setPersonCover, setPersonHero,
    mergePersonInto, purgePersonWithUndo,
    acceptMergeSuggestion, rejectMergeSuggestion, dismissAllMerges,
    fetchHiddenPeople, hidePerson, unhidePerson,
    __resetForTest,
  }
})
