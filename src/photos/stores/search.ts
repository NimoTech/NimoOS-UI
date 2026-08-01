// Ported from Vue2 NimoOS-UI src/store/modules/photos.js:
//   :19-22   (SEARCH_PAGE_LIMIT)
//   :24-27   (smartSearchSeq 声明+文档注释;"任何一次 dispatch(含清空)都使在途
//             旧响应作废——序号递增必须先于早退分支" 那句 verbatim 引自 :655,
//             不在 :24-27 这段文档注释里——上一轮报告曾误引成 :29-31,已改正)
//   :241-259 (state: searchResults/searchQuery/searchFilters/searchOffset/
//             searchExhausted/searchLoadingMore/searchMs/isSearchMode)
//   :365-401 (mutations: SET_SEARCH / SET_SEARCH_LOADING_MORE / APPEND_SEARCH_RESULTS / CLEAR_SEARCH)
//   :654-696 (actions: smartSearch / loadMoreSearchResults / clearSearch)
// searchStateMatchesQuery 是纯函数,已被 T10 落进 util/searchSort.ts,这里直接复用不重写。
// 体例照 stores/places.ts(setup store + service 直连 + __resetForTest)。
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { service } from '@nimotech/nimoos-service'
import { assetToPhoto, type Photo } from '../util/assetToPhoto'
import { searchStateMatchesQuery } from '../util/searchSort'

// 照搬 Vue2 :19-22 连注释:既是首页大小,也是 loadMore 的增量。深页(offset>0)
// 后端契约保证全部 belowCut=true,只会落进"更多结果"档(search-cut-tiering 设计)。
export const SEARCH_PAGE_LIMIT = 50

export const usePhotosSearch = defineStore('photosSearch', () => {
  const results = ref<Photo[]>([])
  const query = ref('')
  // filtersPayload 管道照 1:1 搬(Vue2 :245 searchFilters,loadMore 复用同一份)。
  // 交接事实(报告里也登记):Vue2 全仓唯一 dispatch 点 PhotosTimeline.vue:652 从
  // 不传 filters(恒为 {}),6 个筛选 chip 是纯客户端 narrow(PhotosSearchView.vue:395
  // 注释写明),这条管道当前无人喂——T16 不要指望它承担 chip 筛选。
  const filtersPayload = ref<Record<string, unknown>>({})
  const offset = ref(0)
  const exhausted = ref(false)
  const loadingMore = ref(false)
  const ms = ref(0)
  const isSearchMode = ref(false)

  // smartSearch/loadMore/clear 共用同一把序号锁。smartSearchSeq 声明+文档注释
  // 在 Vue2 :24-27;下面这句是 verbatim 引自 smartSearch action 内部的注释(:655):
  // 任何一次 dispatch(含清空)都使在途旧响应作废——序号递增必须先于早退分支。
  let searchSeq = 0

  // 照 Vue2 CLEAR_SEARCH 的 clearSearch action(:392-401 + :694)。
  function clear(): void {
    results.value = []
    query.value = ''
    filtersPayload.value = {}
    offset.value = 0
    exhausted.value = false
    loadingMore.value = false
    ms.value = 0
    isSearchMode.value = false
    // 偏离登记(新增,报告 E3/结构规格 4):Vue2 CLEAR_SEARCH :392-401 没有这行——
    // clear() 之后若仍有在途的 smartSearch/loadMore 响应,Vue2 没有任何东西挡它把
    // 结果写回来。这里 bump seq,让任何在途响应的 `mine !== searchSeq` 判断失败
    // 而被丢弃。注意这是递增,不是拨回 0(拨回 0 会制造别名冲突,见 __resetForTest)。
    searchSeq++
  }

  // 照 Vue2 smartSearch action(:654-671,含 catch)+ catch 分支改法(§7e-12,见下)。
  async function smartSearch(q: string, filters: Record<string, unknown> = {}): Promise<void> {
    const trimmed = (q || '').trim()
    // 照搬 Vue2 :655-657 的空查询早退——但顺序上先落到 clear() 里去 bump seq。
    // Vue2 源码是"先 `const seq = ++smartSearchSeq` 后判断早退",这里写成
    // "先早退到 clear()(它自己 bump seq)后再 ++searchSeq"——两种写法在"clear()
    // 自己也 bump seq"这个前提下是等价的(controller 已核实此等价性,见报告 E3):
    // 任何一次空查询 dispatch 都会让在途旧响应的 seq 比对失败。
    if (!trimmed) { clear(); return }
    const mine = ++searchSeq
    const t0 = performance.now()
    try {
      const res = await service.photos.smartSearch(trimmed, SEARCH_PAGE_LIMIT, 0, filters)
      if (mine !== searchSeq) return // 在途窗口:旧响应作废(含被更新的搜索或 clear() 打断)
      const list = ((res as unknown[]) ?? []).map(a => assetToPhoto(a as Record<string, unknown>))
      results.value = list
      query.value = trimmed
      filtersPayload.value = filters
      ms.value = performance.now() - t0
      offset.value = 0
      exhausted.value = list.length < SEARCH_PAGE_LIMIT
      loadingMore.value = false
      isSearchMode.value = true
    } catch (e) {
      // 偏离登记(M5,评审必修):console.error 必须放在 seq 比对之前——即使这次
      // 失败已经过期(被更新的搜索/clear() 超越),它仍是一次真实发生的后端错误,
      // store 纪律要求"每个 catch 都 console.error",丢日志 = 丢诊断信号(偶发
      // 后端问题排查最需要的正是这条痕迹)。"避免噪声"不足以抵消这个代价。
      console.error('[photos-search] smartSearch', e)
      if (mine !== searchSeq) return // 过期:日志已打,但状态推进要挡住,不能覆盖更新的搜索结果
      // 偏离登记(§7e-12,新增第 12 条 Vue2 缺陷):Vue2 catch 分支(:669-671,
      // console.error 在 :670)失败时只 log,query/isSearchMode/results 全部不
      // 更新——下一次 matchesQuery(新词) 恒假(searchQuery 还是上一次成功的旧词),
      // 视图会永久停在"搜索中"的在途态,因为它无法区分"还没收到响应"和"收到了
      // 但失败了"。这里把状态推进到"这个词搜过了、零结果",让视图正确落到空态
      // 而不是永久 loading。
      results.value = []
      query.value = trimmed
      filtersPayload.value = filters
      ms.value = performance.now() - t0
      offset.value = 0
      exhausted.value = true
      loadingMore.value = false
      isSearchMode.value = true
    }
  }

  // 照 Vue2 loadMoreSearchResults action(:677-692)+ APPEND_SEARCH_RESULTS mutation(:384-391)。
  async function loadMore(): Promise<void> {
    if (loadingMore.value || exhausted.value || !query.value) return
    const capturedQuery = query.value
    // 偏离登记(E4,控制器裁定 —— 修 Vue2 真竞态,见报告):Vue2 :677-692 只有下面
    // 那行查询串比对(1:1 保留),没有 seq 守卫。漏洞:同词重搜(结果集已被新
    // smartSearch 换成新首页、offset 归 0)时,查询串比对会误判通过,旧 loadMore
    // 深页被 concat 进新结果集、offset 被拨到 50——结果集污染 + 分页错位。这里叠
    // 一把与 smartSearch/clear 共用的 seq 锁堵住这条漏洞。
    const mine = searchSeq
    const nextOffset = offset.value + SEARCH_PAGE_LIMIT
    loadingMore.value = true
    try {
      const res = await service.photos.smartSearch(
        capturedQuery, SEARCH_PAGE_LIMIT, nextOffset, filtersPayload.value,
      )
      // 照搬 Vue2 :686 的查询串比对(1:1 保留)。
      if (query.value !== capturedQuery) return
      // 叠加的 seq 守卫(E4 新增,见上方注释)。
      if (mine !== searchSeq) return
      const raw = ((res as unknown[]) ?? []).map(a => assetToPhoto(a as Record<string, unknown>))
      // Vue2→Vue3 铁律:Photo.id 是 string | number,Set 里混 1 与 '1' 会去重失败,
      // 建 Set 与查 Set 都要 String()。
      const seen = new Set(results.value.map(p => String(p.id)))
      const fresh = raw.filter(p => !seen.has(String(p.id)))
      results.value = results.value.concat(fresh)
      offset.value = nextOffset
      // 照搬 Vue2 :390 的双条件:results.length(=raw,本次新页的原始条数,去重前)
      // < LIMIT,或者去重后一条新增都没有(重复页/索引抖动)——避免死循环反复请求同一页。
      exhausted.value = raw.length < SEARCH_PAGE_LIMIT || fresh.length === 0
    } catch (e) {
      console.error('[photos-search] loadMore', e)
    } finally {
      // 偏离登记(M8,评审必修 —— 修 Vue2 :691 继承的时序缺陷):Vue2 finally 无
      // 条件复位 searchLoadingMore。Vue2 靠按钮点击触发,窗口很窄;T15 要做的是
      // 无限滚动 = 自动触发,同一时刻先后两次 loadMore 撞在一起的概率显著更高。
      // 时序:loadMore#1 在途 → 用户重搜成功(把 offset/loadingMore 都复位)→
      // loadMore#2 起飞(在途)→ loadMore#1 的过期响应才到达、被上面的 query/seq
      // 守卫拦下——但如果这里无条件复位,会把"loadMore#2 仍在途"这个事实抹掉,
      // 放行一次重入请求,而它算出的 nextOffset 与#2 完全相同(offset 还没被#2
      // 更新)⇒ 撞出重复页 ⇒ 去重后 fresh.length===0 ⇒ exhausted 被提前置真,
      // "还有更多"从界面消失。改成只在 `mine === searchSeq` 时才复位——手法照
      // places.ts:241 / usePersonDetail.ts:82 的同款 seq 守卫 finally。
      // 安全性:seq 只由 smartSearch 与 clear() 递增,而这两者的每条路径(成功
      // /catch/clear)都会把 loadingMore 显式置假,所以加这个条件不会让
      // loadingMore 永久卡在 true。
      if (mine === searchSeq) loadingMore.value = false
    }
  }

  // T10 纯函数复用,不重写。
  function matchesQuery(q: string): boolean {
    return searchStateMatchesQuery({ isSearchMode: isSearchMode.value, searchQuery: query.value }, q)
  }

  function __resetForTest(): void {
    results.value = []
    query.value = ''
    filtersPayload.value = {}
    offset.value = 0
    exhausted.value = false
    loadingMore.value = false
    ms.value = 0
    isSearchMode.value = false
    // 有意不重置 searchSeq(照 places.ts:426-429 同款理由):若此刻还有一个
    // __resetForTest 之前发出的 smartSearch/loadMore 请求仍在途,把 seq 拨回 0
    // 会让重置后的新请求与重置前仍在途的旧请求产生 mine 别名冲突,绕过
    // `mine !== searchSeq` 判断。seq 只增不减,天然保证任何新请求的 mine 值都
    // 严格大于此前所有已发出的请求。
  }

  return {
    results, query, filtersPayload, offset, exhausted, loadingMore, ms, isSearchMode,
    matchesQuery, smartSearch, loadMore, clear, __resetForTest,
  }
})
