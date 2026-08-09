// Ported from Vue2 NimoOS-UI src/store/modules/photos.js:
//   mutations :487-501 (ADD_SMART_VIEW/UPDATE_SMART_VIEW/DELETE_SMART_VIEW/
//              RESTORE_SMART_VIEW/SET_SMART_VIEWS)
//   actions   :998-1075 (fetchSmartViews/createSmartView/updateSmartView/
//              deleteSmartView/restoreSmartView/duplicateSmartView)
//   PhotosSmartViewsView.vue:366-382 (refreshPreview)
//   PhotosSmartViewDetail.vue:409-423 (loadDetail)
// Backend contract (NimoOS-Photos/service/smartview.go:21-34 SmartView,
// :727-734 SmartViewActivity) — 已回源核对,json tag 与本文件归一函数逐字段一致。
// Photos v1 无标准信封,列表一律 `?? []` 兜底(Go nil slice → null)。
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { assetToPhoto, type Photo } from '../util/assetToPhoto'
// 跨区 import,刻意不搬文件/不抄这 6 行(控制器决策,fix round 1 · C1):它带一条实打实
// 的守卫——本设备典型是 HTTP LAN 地址,非安全上下文下 `crypto.randomUUID` 是 undefined,
// SP4-P3a 曾因丢这个守卫让上传整功能挂掉。搬文件会动 SP4 文件区的消费方,抄一份会让这条
// 守卫存在两处副本。既有跨区引用先例:PhotosSidebar.vue 引 files/util/format、
// PhotoInfoPanel.vue 引 files/util/clipboard。
import { safeRandomUUID } from '../../files/upload/uuid'

export interface SmartView {
  id: string
  name: string
  description: string
  conds: string[]
  threshold: number
  live: boolean
  includeVideos: boolean
  count: number
  addedThisWeek: number
  seeds: string[]
  median: number
  storageBytes: number
  distribution: number[]
  evaluatedAt: string
}

export interface SmartViewActivity {
  id: string
  eventType: string
  detail: string
  assetIds: string[]
  occurredAt: string
}

export interface SmartViewPreview {
  count: number
  seeds: string[]
  thresholdActive: boolean
}

export interface CreateSmartViewInput {
  name: string
  // T5(创建弹窗)决定:可选,不是 string——照搬 Vue2 confirmCreate :431 的
  // `description: this.draft.desc.trim() || undefined`(后端 omitempty 语义,空描述不
  // 传字段而不是传空串)。调用方必须能传 undefined,故此处收紧为可选。
  description?: string
  conds: string[]
  threshold: number
  live: boolean
  includeVideos: boolean
}

export interface DeletedSmartView {
  sv: SmartView
  index: number
}

const EMPTY_PREVIEW: SmartViewPreview = { count: 0, seeds: [], thresholdActive: true }
// 照搬 Vue2 PhotosSmartViewDetail.vue:413-415 的三个数字 —— 不要改。
const MATCHED_LIMIT = 60
const RECENT_LIMIT = 12
const ACTIVITY_LIMIT = 10
// refreshPreview 的 debounce 节奏,照搬 Vue2 PhotosSmartViewsView.vue:368。
const PREVIEW_DEBOUNCE_MS = 300

// 照 places.ts 的 toPlaceDetail 体例:逐字段归一 + 兜底。distribution 的判据是**刻意
// 收紧**,不是照搬 Vue2:真源 PhotosSmartViewDetail.vue:316(不是 PhotosSmartViewsView.vue)
// 是 `distribution && distribution.length ? … : new Array(10).fill(0)`——只要非空就原样
// 保留,`[1,2]` 这种长度不足 10 的数组会被直接透传给图表。这里改成 `=== 10` 的严格校验:
// 本仓的分布图是固定 10 根柱子的图表,长度不对的数组会让柱子与桶位错位(第 3 根柱子
// 实际画的是"桶 1"的数据),刻意比 Vue2 更严格地整体回落成全 0,而不是继续照抄 Vue2
// 那个会喂错位数据给图表的兜底口径。
function toSmartView(raw: unknown): SmartView {
  const r = (raw ?? {}) as Record<string, unknown>
  const distribution = Array.isArray(r.distribution) ? (r.distribution as number[]) : []
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    description: String(r.description ?? ''),
    conds: Array.isArray(r.conds) ? (r.conds as string[]) : [],
    threshold: Number(r.threshold ?? 0),
    live: Boolean(r.live),
    includeVideos: Boolean(r.includeVideos),
    count: Number(r.count ?? 0),
    addedThisWeek: Number(r.addedThisWeek ?? 0),
    seeds: Array.isArray(r.seeds) ? (r.seeds as string[]) : [],
    median: Number(r.median ?? 0),
    storageBytes: Number(r.storageBytes ?? 0),
    distribution: distribution.length === 10 ? distribution : new Array(10).fill(0),
    evaluatedAt: String(r.evaluatedAt ?? ''),
  }
}

function toActivity(raw: unknown): SmartViewActivity {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    id: String(r.id),
    eventType: String(r.eventType ?? ''),
    detail: String(r.detail ?? ''),
    assetIds: Array.isArray(r.assetIds) ? (r.assetIds as unknown[]).map(String) : [],
    occurredAt: String(r.occurredAt ?? ''),
  }
}

export const usePhotosSmartViews = defineStore('photosSmartViews', () => {
  const smartViews = ref<SmartView[]>([])
  // 空态门控,照 places.ts 的 placesLoaded 手法:只在成功路径置 true,失败留 false 可重试。
  const listLoaded = ref(false)
  const listLoading = ref(false)

  const matchedAssets = ref<Photo[]>([])
  const recentAssets = ref<Photo[]>([])
  const activity = ref<SmartViewActivity[]>([])
  const detailLoading = ref(false)
  // loadDetail 的 seq 竞态守卫,手法照 places.ts loadDetail。三个并行请求
  // (matchedAssets/recentAssets/activity)共用同一把锁——它们是同一次"打开详情"
  // 触发的一组请求,理应作为一个整体被下一次打开作废,拆成三把锁没有意义。
  let detailSeq = 0

  const preview = ref<SmartViewPreview>({ ...EMPTY_PREVIEW })
  // refreshPreview 的 debounce 计时器 + 独立 seq 守卫,均为模块级、不进 state
  // (纯内部机制,视图不需要读它们)。与 detailSeq 是两把互不相关的锁:创建/编辑弹窗的
  // 实时预览与详情页的三请求是完全独立的两条数据流,共用一把计数器会让一边的请求
  // 把另一边的"过期"判断带偏。
  let previewTimer: ReturnType<typeof setTimeout> | null = null
  let previewSeq = 0

  // SP15-P2a: the excluded list belongs here rather than in the view, alongside the
  // three asset collections this page already reads from the store — splitting one
  // page's data across two owners is what makes staleness bugs possible.
  const excluded = ref<Photo[]>([])
  const excludedLoading = ref(false)
  // Staleness guard for loadExcluded, same shape as detailSeq: switching smart views
  // can leave an older request in flight, and it must not overwrite the newer list.
  let excludedSeq = 0
  // Which view the list currently on screen belongs to. Only used to decide whether a load
  // has to blank the band before awaiting — see loadExcluded.
  let excludedFor = ''
  // Mutual exclusion across the three manual write actions: they all mutate the same
  // membership of the same view, so letting two run at once would race the refetch.
  const assetBusy = ref(false)

  const createBusy = ref(false)
  const patchBusy = ref(false)
  // deleteSmartView / restoreSmartView 共用一把锁——同一份资源(该智能视图在列表中
  // 的存在与否)上的互斥写操作,撤销删除时不该允许并发的真删除把状态搅乱。
  const deleteBusy = ref(false)
  const duplicateBusy = ref(false)
  const exportBusy = ref(false)

  // byId 是本期的核心修复(§7e-2 / 偏离登记 4):Vue2 详情页把整个 sv 对象作为 prop
  // 持有,列表侧 UPDATE_SMART_VIEW/DELETE_SMART_VIEW 之类的 mutation 只改 state 里的
  // 数组项,不会去同步详情页手里那份已经拿到的对象引用——编辑/删除后详情页仍展示
  // 陈旧数据,直到用户重新导航。这里改成"详情页只存 id,每次渲染都从 byId(id) 现取",
  // 数据来源只有一份(smartViews 数组本身),结构性地消灭了引用陈旧的可能性。
  // 删码验证登记:`String(s.id)` 这层是防御性的——store 内每一处写入 smartViews.value
  // 的路径(fetch/create/update/duplicate)都经过 toSmartView 归一,id 落地前恒为
  // string,因此单测删掉这层 String() 不会变红(不构成可证伪的删码用例)。保留是为了
  // 防止未来某个写入路径(如误绕过 toSmartView 直接 push)悄悄破坏这个不变量。
  function byId(id: string): SmartView | null {
    return smartViews.value.find(s => String(s.id) === String(id)) ?? null
  }

  // 照 Vue2 fetchSmartViews :998-1005。成功才置 listLoaded = true(照 places.ts 的
  // placesLoaded 手法,失败留 false 可重试);偏离登记:Vue2 没有 finally 复位
  // loading(Vue2 store 压根没有 loading 字段),这里补上。
  async function fetchSmartViews(): Promise<void> {
    listLoading.value = true
    try {
      const raw = (await service.photos.listSmartViews()) ?? []
      smartViews.value = (raw as unknown[]).map(toSmartView)
      listLoaded.value = true
    } catch (e) {
      console.error('[photos-smartviews] fetchSmartViews', e)
    } finally {
      listLoading.value = false
    }
  }

  // 照 Vue2 createSmartView :1013-1025,但**不**照抄一处偏离(登记 4):Vue2 :1018-1021
  // 的 catch 里仍 commit('ADD_SMART_VIEW', sv)——把一个后端上根本不存在的本地对象塞进
  // 列表("乐观撒谎"),刷新页面就会消失,用户会以为自己丢了一个智能视图。这里改成
  // rethrow,交给视图层 catch → toast。
  //
  // fix round 1 · C1(Critical,真 bug,已回源实证):id **必须由前端生成并传给后端**——
  // 与本文件最初实现「id 由后端生成,不传」相反。后端 `Create`
  // (NimoOS-Photos/service/smartview.go:65-68)对空 id 直接 `return nil, ErrInvalidInput`
  // → route handler 转成 400;handler(route/v1/smartviews.go Create)只 bind + 校验
  // Name,从不生成 id;全仓唯一生成 id 的 `newSVID` 只被 `Duplicate` 内部调用。不传 id
  // 在真机上点"创建智能视图"会 100% 返 400。改用 `safeRandomUUID()` 生成
  // `sv-<uuid>`(不用 `Date.now().toString(36)`——那是 Vue2 的写法,毫秒精度,两个
  // 客户端同毫秒建视图会撞 id;uuid 实际上不会撞)。
  async function createSmartView(input: CreateSmartViewInput): Promise<SmartView | null> {
    if (createBusy.value) return null
    createBusy.value = true
    try {
      const raw = await service.photos.createSmartView({
        id: `sv-${safeRandomUUID()}`,
        name: input.name,
        description: input.description,
        condsRaw: input.conds,
        threshold: input.threshold,
        live: input.live,
        includeVideos: input.includeVideos,
      })
      const created = toSmartView(raw)
      smartViews.value.unshift(created)
      return created
    } catch (e) {
      console.error('[photos-smartviews] createSmartView', e)
      throw e
    } finally {
      createBusy.value = false
    }
  }

  // 照 Vue2 updateSmartView :1026-1035。请求体字段改名 conds → condsRaw(Vue2
  // :1027-1028)。响应有 body 用 toSmartView 整体替换(splice 保持顺序),无 body
  // 就地合并 patch——patch 本身用的是 CreateSmartViewInput 的字段名(conds,不是
  // condsRaw),与 SmartView 的字段名一致,合并不需要再转一次名。
  // 偏离登记(同 createSmartView):Vue2 :1032-1033 的 catch 里仍 commit 本地 patch
  // (乐观撒谎),这里 rethrow,不照抄。
  async function updateSmartView(id: string, patch: Partial<CreateSmartViewInput>): Promise<void> {
    if (patchBusy.value) return
    patchBusy.value = true
    try {
      const body: Record<string, unknown> = { ...patch }
      if ('conds' in body) {
        body.condsRaw = body.conds
        delete body.conds
      }
      const res = await service.photos.updateSmartView(id, body)
      const i = smartViews.value.findIndex(s => String(s.id) === String(id))
      if (i === -1) return
      if (res) {
        smartViews.value.splice(i, 1, toSmartView(res))
      } else {
        smartViews.value.splice(i, 1, { ...smartViews.value[i], ...patch })
      }
    } catch (e) {
      console.error('[photos-smartviews] updateSmartView', e)
      throw e
    } finally {
      patchBusy.value = false
    }
  }

  // 照 Vue2 deleteSmartView :1036-1046,但**不**照抄 Vue2 :1042-1043 的 catch 后
  // `return null`——那会把失败(网络错误/后端拒绝)伪装成"本来就没找到这一项"，
  // 视图层无从分辨该不该弹 toast。这里 rethrow。
  //
  // fix round 1 · I1(Important,真 bug,评审用交错场景实测复现):下标**必须在
  // await 之后重算**,不能用 await 之前算好的下标直接 splice——`deleteBusy` 只互斥
  // 删除↔删除/撤销,不挡 `fetchSmartViews`;删除在途时若 fetchSmartViews 把列表整体
  // 重排/插入(如另一个客户端建了新视图排到前面),await 之前的下标就指向了别的项,
  // 会删错、返回的撤销 payload 也会指向错误的项。Vue2 `photos.js:493-495` 的
  // DELETE_SMART_VIEW 是按 id filter,天然免疫这个坑——plan 原定的"await 前算好下标"
  // 顺序把 id 语义降级成了下标语义,是 plan 的错,不是刻意实现。
  async function deleteSmartView(id: string): Promise<DeletedSmartView | null> {
    if (deleteBusy.value) return null
    // 早退检查:本地列表里根本没有这一项,不发请求(承担"避免打无意义的请求"这一半)。
    // 注意这个下标只用于早退判断,**不能**带进下面的 splice——真正删除时必须重算。
    if (smartViews.value.findIndex(s => String(s.id) === String(id)) < 0) return null
    deleteBusy.value = true
    try {
      await service.photos.deleteSmartView(id)
      // 必须在 await 之后重算:in-flight 期间 fetchSmartViews 可能已重排/插入,用
      // await 之前的下标 splice 会删掉别人(Vue2 :493 是按 id filter,不吃这个坑)。
      const idx = smartViews.value.findIndex(s => String(s.id) === String(id))
      if (idx < 0) return null
      const [sv] = smartViews.value.splice(idx, 1)
      return { sv, index: idx }
    } catch (e) {
      console.error('[photos-smartviews] deleteSmartView', e)
      throw e
    } finally {
      deleteBusy.value = false
    }
  }

  // 照 Vue2 restoreSmartView :1047-1058 + RESTORE_SMART_VIEW mutation(:497-498)
  // 的钳制写法。**这里要带原 id、且不能走 createSmartView() 包装**——这是与
  // createSmartView 刻意不同的语义:两者现在都会给后端传非空 id(后端 Create 硬性要求,
  // 见 createSmartView 上方注释的 C1 回源记录),但**id 的来源不同**——createSmartView
  // 是"新建"，每次都要生成一个全新的随机 id；restoreSmartView 是"撤销刚才的删除"，
  // 语义是恢复同一个智能视图，必须让后端沿用**原 id**，否则撤销出来的是一个 id 不同的
  // 新智能视图(旧的匹配统计/活动流历史全部对不上,即便界面上名字/条件看着一样)。
  // 因此这里不走 createSmartView() 包装(它每次都会生成新 id,拿不到"沿用原 id"的效果),
  // 而是直接调用底层 service.photos.createSmartView,显式传 payload.sv.id。
  async function restoreSmartView(payload: DeletedSmartView): Promise<void> {
    if (deleteBusy.value) return
    deleteBusy.value = true
    try {
      await service.photos.createSmartView({
        id: payload.sv.id,
        name: payload.sv.name,
        description: payload.sv.description,
        condsRaw: payload.sv.conds,
        threshold: payload.sv.threshold,
        live: payload.sv.live,
        includeVideos: payload.sv.includeVideos,
      })
      const i = Math.max(0, Math.min(payload.index, smartViews.value.length))
      smartViews.value.splice(i, 0, payload.sv)
    } catch (e) {
      console.error('[photos-smartviews] restoreSmartView', e)
      throw e
    } finally {
      deleteBusy.value = false
    }
  }

  // 照 Vue2 duplicateSmartView :1059-1069。**偏离登记**:brief 原文写"unshift 进
  // 列表"，但回源核对 Vue2 :1064-1066 实际是 `commit('RESTORE_SMART_VIEW', { sv:
  // copy, index: i + 1 })`——插在原件紧后面，不是插到最前。这不是"重新 fetch 或
  // unshift"二选一，是第三种写法(brief 记录有误，以真源为准，此处登记)。插在原件
  // 后面是有意义的 UX(复制品出现在原件旁边，而不是跳到列表最前打断视觉连续性)，
  // 因此按真实源码实现：`findIndex` 未命中时为 -1，+1 = 0，等价于 unshift，
  // 天然覆盖"本地列表还没这一项"的边界情况，不需要额外分支。
  async function duplicateSmartView(id: string): Promise<void> {
    if (duplicateBusy.value) return
    duplicateBusy.value = true
    try {
      const raw = await service.photos.duplicateSmartView(id)
      const copy = toSmartView(raw)
      const i = smartViews.value.findIndex(s => String(s.id) === String(id))
      smartViews.value.splice(i + 1, 0, copy)
    } catch (e) {
      console.error('[photos-smartviews] duplicateSmartView', e)
      throw e
    } finally {
      duplicateBusy.value = false
    }
  }

  // 照 Vue2 PhotosSmartViewDetail.vue loadDetail :409-423,补 seq 竞态守卫
  // (偏离登记 9,§7e-7):三个请求 Promise.all 并行，成功路径与清空都要过 seq 门控。
  async function loadDetail(id: string): Promise<void> {
    const mine = ++detailSeq
    detailLoading.value = true
    // 成功路径也要先清旧数据 —— 否则第二次加载时骨架门控已过，会继续渲染上一个
    // 智能视图的照片与活动流(P6b 终审 I2 的同型缺陷，清空必须在 await 之前)。
    matchedAssets.value = []
    recentAssets.value = []
    activity.value = []
    try {
      const [all, recent, act] = await Promise.all([
        service.photos.getSmartViewAssets(id, { limit: MATCHED_LIMIT, offset: 0 }),
        service.photos.getSmartViewAssets(id, { limit: RECENT_LIMIT, offset: 0, recent: true }),
        service.photos.getSmartViewActivity(id, ACTIVITY_LIMIT),
      ])
      if (mine !== detailSeq) return
      matchedAssets.value = ((all as unknown[]) ?? []).map(a => assetToPhoto(a as Record<string, unknown>))
      recentAssets.value = ((recent as unknown[]) ?? []).map(a => assetToPhoto(a as Record<string, unknown>))
      activity.value = ((act as unknown[]) ?? []).map(toActivity)
    } catch (e) {
      console.error('[photos-smartviews] loadDetail', e)
    } finally {
      if (mine === detailSeq) detailLoading.value = false
    }
  }

  // Refetch one smart view and replace it in the list. Vue 2 needed an in-place
  // field merge here to preserve the object identity its detail page held as a prop
  // (#82's MERGE_SMART_VIEW_STATS). That problem does not exist here: the detail
  // page reads `byId(id)` as a computed, so replacing the array item is enough and
  // both the header and the list card follow automatically.
  //
  // Deliberately swallows its own failure: the caller's write already succeeded, and
  // reporting a stats refresh error as a write error would be a lie.
  async function refreshStats(id: string): Promise<void> {
    try {
      const raw = await service.photos.getSmartView(id)
      if (!raw) return
      const i = smartViews.value.findIndex((s) => String(s.id) === String(id))
      if (i === -1) return
      smartViews.value.splice(i, 1, toSmartView(raw))
    } catch (e) {
      console.error('[photos-smartviews] refreshStats', e)
    }
  }

  // The stats refetch lives inside each of the three write actions rather than at
  // the call sites. Vue 2 put it at the call sites and shipped #82 to fix the one it
  // forgot; keeping it here means a caller cannot forget.
  //
  // The empty-list early return is not defensive padding — the backend rejects an
  // empty assetIds with 400 ("assetIds is required").
  //
  // ★ Final-review finding 5: "nothing was asked for" and "this call was dropped" must not
  // return the same value. All three actions used to answer 0 (or zeroes) for both, so a
  // call swallowed by `assetBusy` still looked like a completed write to the view — it
  // announced "pinned 0 photos to this view" and closed the picker, discarding a selection
  // that had never been sent anywhere. `null` is the dropped-because-busy sentinel and is
  // deliberately distinct from the zero an empty list still returns; every caller must treat
  // it as "no result" rather than as a count. The busy check therefore comes *first* — with
  // the two guards merged it is impossible to tell which one fired.
  async function pinAssets(id: string, assetIds: string[]): Promise<number | null> {
    if (assetBusy.value) return null
    if (!assetIds.length) return 0
    assetBusy.value = true
    try {
      const res = await service.photos.pinSmartViewAssets(id, assetIds)
      const added = typeof res.added === 'number' ? res.added : 0
      await refreshStats(id)
      return added
    } catch (e) {
      console.error('[photos-smartviews] pinAssets', e)
      throw e
    } finally {
      assetBusy.value = false
    }
  }

  // Removal is tiered on the backend — a pinned row is deleted, an automatically
  // matched row is flagged excluded — so both counters come back and the caller
  // needs both to phrase its confirmation.
  // `null` when dropped because another write is in flight — see pinAssets above.
  async function removeAssets(id: string, assetIds: string[]): Promise<{ unpinned: number; excluded: number } | null> {
    if (assetBusy.value) return null
    if (!assetIds.length) return { unpinned: 0, excluded: 0 }
    assetBusy.value = true
    try {
      const res = await service.photos.removeSmartViewAssets(id, assetIds)
      const out = {
        unpinned: typeof res.unpinned === 'number' ? res.unpinned : 0,
        excluded: typeof res.excluded === 'number' ? res.excluded : 0,
      }
      await refreshStats(id)
      return out
    } catch (e) {
      console.error('[photos-smartviews] removeAssets', e)
      throw e
    } finally {
      assetBusy.value = false
    }
  }

  // `null` when dropped because another write is in flight — see pinAssets above.
  async function restoreAssets(id: string, assetIds: string[]): Promise<number | null> {
    if (assetBusy.value) return null
    if (!assetIds.length) return 0
    assetBusy.value = true
    try {
      const res = await service.photos.restoreSmartViewAssets(id, assetIds)
      const restored = typeof res.restored === 'number' ? res.restored : 0
      await refreshStats(id)
      return restored
    } catch (e) {
      console.error('[photos-smartviews] restoreAssets', e)
      throw e
    } finally {
      assetBusy.value = false
    }
  }

  // Failure is swallowed rather than rethrown: the excluded band is a secondary
  // section, and an error there must not take down the matched grid above it.
  //
  // ★ Final-review finding 6: this used to blank the list unconditionally before awaiting,
  // so a transient 500 made the whole "已排除(N)" band disappear — the user was told the
  // exclusions were gone when they were still on the server, and nothing said otherwise.
  // The blank is now conditional on the id actually changing, which is the only case it was
  // ever needed for (showing view A's exclusions under view B's heading, the same rule
  // loadDetail states above). Refetching the *same* view keeps the list on screen until the
  // new one lands, so a failure leaves the band exactly as it was.
  //
  // This does not weaken the staleness guard: `excludedSeq` is what stops a late-landing
  // older response from overwriting a newer one, and it is untouched — the two mechanisms
  // answer different questions ("is this response still wanted" vs "may the previous view's
  // data stay on screen") and do not conflict.
  async function loadExcluded(id: string): Promise<void> {
    const mine = ++excludedSeq
    excludedLoading.value = true
    if (excludedFor !== String(id)) {
      excluded.value = []
      excludedFor = String(id)
    }
    try {
      const raw = await service.photos.getSmartViewExcluded(id)
      if (mine !== excludedSeq) return
      excluded.value = (raw ?? []).map((a) => assetToPhoto(a as Record<string, unknown>))
    } catch (e) {
      console.error('[photos-smartviews] loadExcluded', e)
    } finally {
      if (mine === excludedSeq) excludedLoading.value = false
    }
  }

  // 照 Vue2 refreshPreview :366-382,节奏(300ms debounce)照搬，seq 守卫是新增
  // (偏离登记 9)。thresholdActive 的判据照搬 Vue2 :378:`!res || res.thresholdActive
  // !== false`(即缺字段视为生效)。失败只 console.error，不清空 preview——照搬
  // Vue2 的 catch 行为，预览失败时保留上一次的计数比闪成 0 好。
  function refreshPreview(input: Omit<CreateSmartViewInput, 'name' | 'live'>): void {
    if (previewTimer) clearTimeout(previewTimer)
    previewTimer = setTimeout(() => {
      const mine = ++previewSeq
      service.photos.previewSmartView({
        condsRaw: input.conds,
        description: input.description,
        threshold: input.threshold,
        includeVideos: input.includeVideos,
      }).then((res: unknown) => {
        if (mine !== previewSeq) return
        const r = res as { count?: number, seeds?: string[], thresholdActive?: boolean } | undefined
        preview.value = {
          count: r?.count ?? 0,
          seeds: r?.seeds ?? [],
          thresholdActive: !r || r.thresholdActive !== false,
        }
      }).catch((e: unknown) => {
        if (mine !== previewSeq) return
        console.error('[photos-smartviews] refreshPreview', e)
      })
    }, PREVIEW_DEBOUNCE_MS)
  }

  // T5(创建弹窗)新增,控制器授权(brief §「前序任务带下来的硬事实」2):Vue2 从无对应
  // 方法(它靠整页 beforeDestroy 里的 clearTimeout,弹窗只是页面内一块 v-if,组件不会真的
  // 卸载/重建)。New-UI 的创建弹窗是常驻挂载 + prop 控制显隐,关闭弹窗时若已排好的 300ms
  // debounce 定时器还没触发、或请求已在途,不清掉的话:①还没触发的定时器会在弹窗关闭后
  // 悄悄发出一个不再需要的请求;②已在途的请求回来后会用「已关闭的这次编辑」的结果覆盖
  // preview,污染下一次打开(可能是另一个草稿)时的展示。做法照 places.ts clearDetail 的
  // 思路:递增 previewSeq 使任何已在途的响应在回调时 `mine !== previewSeq` 而被丢弃
  // (不需要单独维护"已取消"标志),同时清掉尚未触发的定时器。
  function cancelPreview(): void {
    if (previewTimer) {
      clearTimeout(previewTimer)
      previewTimer = null
    }
    previewSeq += 1
  }

  // 导出 ZIP 不进 store(它是纯浏览器下载行为：带 Authorization 头 fetch + blob +
  // <a download>，由视图层 T8 实现，见 plan Global Constraints §7e-1)。这里只负责
  // 触发后端生成导出相册并 rethrow 失败，让视图层分流 toast 文案。
  async function exportAlbum(id: string): Promise<void> {
    if (exportBusy.value) return
    exportBusy.value = true
    try {
      await service.photos.exportSmartViewAlbum(id)
    } catch (e) {
      console.error('[photos-smartviews] exportAlbum', e)
      throw e
    } finally {
      exportBusy.value = false
    }
  }

  function __resetForTest(): void {
    smartViews.value = []
    listLoaded.value = false
    listLoading.value = false
    matchedAssets.value = []
    recentAssets.value = []
    activity.value = []
    detailLoading.value = false
    excluded.value = []
    excludedLoading.value = false
    excludedFor = ''
    assetBusy.value = false
    // 有意不重置 detailSeq/previewSeq:若此刻还有一个 __resetForTest 之前发出的
    // 请求仍在途，把 seq 拨回 0 会让重置后的下一次调用重新落在同一个 mine 值上，
    // 与那个本该作废的旧请求产生别名冲突(同 places.ts __resetForTest 的既有理由)。
    if (previewTimer) {
      clearTimeout(previewTimer)
      previewTimer = null
    }
    preview.value = { ...EMPTY_PREVIEW }
    createBusy.value = false
    patchBusy.value = false
    deleteBusy.value = false
    duplicateBusy.value = false
    exportBusy.value = false
  }

  return {
    smartViews, listLoaded, listLoading,
    matchedAssets, recentAssets, activity, detailLoading,
    excluded, excludedLoading, assetBusy,
    preview,
    createBusy, patchBusy, deleteBusy, duplicateBusy, exportBusy,
    byId,
    fetchSmartViews, createSmartView, updateSmartView, deleteSmartView, restoreSmartView,
    duplicateSmartView, loadDetail, refreshPreview, cancelPreview, exportAlbum,
    pinAssets, removeAssets, restoreAssets, loadExcluded,
    __resetForTest,
  }
})
