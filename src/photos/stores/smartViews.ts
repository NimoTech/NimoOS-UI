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
  description: string
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

// 照 places.ts 的 toPlaceDetail 体例:逐字段归一 + 兜底。distribution 的兜底口径照搬
// Vue2 PhotosSmartViewsView.vue:316 —— 后端 fillStats 恒 `make([]int, 10)`
// (smartview.go:213),但响应体带 `omitempty` 可能整体缺失或(理论上)长度不足,
// 一律回落成长度 10 全 0 的数组,不信任后端长度。
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

  // 照 Vue2 createSmartView :1013-1025,但**不**照抄两处偏离(登记 4):
  //   1. id 由后端生成,不再像 Vue2 `sv.id`(前端用 'sv-' + Date.now().toString(36)
  //      自造)那样自己造——Date.now() 精度是毫秒,两个客户端同毫秒建智能视图会撞 id;
  //      后端 createSmartView 的响应本就带 id,没有理由不用它。
  //   2. Vue2 :1018-1021 的 catch 里仍 commit('ADD_SMART_VIEW', sv)——把一个后端上
  //      根本不存在的本地对象塞进列表("乐观撒谎"),刷新页面就会消失,用户会以为
  //      自己丢了一个智能视图。这里改成 rethrow,交给视图层 catch → toast。
  async function createSmartView(input: CreateSmartViewInput): Promise<SmartView | null> {
    if (createBusy.value) return null
    createBusy.value = true
    try {
      const raw = await service.photos.createSmartView({
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
  async function deleteSmartView(id: string): Promise<DeletedSmartView | null> {
    if (deleteBusy.value) return null
    const index = smartViews.value.findIndex(s => String(s.id) === String(id))
    if (index < 0) return null
    deleteBusy.value = true
    try {
      await service.photos.deleteSmartView(id)
      const [sv] = smartViews.value.splice(index, 1)
      return { sv, index }
    } catch (e) {
      console.error('[photos-smartviews] deleteSmartView', e)
      throw e
    } finally {
      deleteBusy.value = false
    }
  }

  // 照 Vue2 restoreSmartView :1047-1058 + RESTORE_SMART_VIEW mutation(:497-498)
  // 的钳制写法。**这里要带原 id**——这是与 createSmartView 刻意不同的语义:
  // createSmartView 是"新建"，id 该由后端分配；restoreSmartView 是"撤销刚才的删除"，
  // 语义是恢复同一个智能视图，必须让后端沿用原 id，否则撤销出来的是一个新智能视图
  // (旧的匹配统计/活动流历史全部对不上)。因此这里不走 createSmartView() 包装
  // (它的请求体故意不带 id)，而是直接调用底层 service.photos.createSmartView。
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
    preview,
    createBusy, patchBusy, deleteBusy, duplicateBusy, exportBusy,
    byId,
    fetchSmartViews, createSmartView, updateSmartView, deleteSmartView, restoreSmartView,
    duplicateSmartView, loadDetail, refreshPreview, exportAlbum,
    __resetForTest,
  }
})
