import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service, type AppCategory, type StoreAppInfo } from '@nimotech/nimoos-service'

/** 前端兜底的「全部」哨兵——不是后端分类;=ALL 时对应参数不发(Vue2 同语义) */
export const ALL = 'All'

export const useAppstoreStore = defineStore('appstore', () => {
  const categories = ref<AppCategory[]>([])
  const list = ref<Record<string, StoreAppInfo>>({})
  const installed = ref<string[]>([])
  const featured = ref<Record<string, StoreAppInfo>>({})
  const loading = ref(false)
  const error = ref(false)
  const catalogLoaded = ref(false)
  let lastQuery: { category: string; authorType: string } = { category: ALL, authorType: ALL }
  // 请求序号:多次 loadCatalog 并发(如快速切换分类/作者)时,只有"最新发出的那次"的响应
  // 才允许写入 list/installed/catalogLoaded/error,以及在 finally 里翻转 loading——
  // 否则一个更早发出但更晚返回的响应会用陈旧数据覆盖后一次已经生效的新状态。
  let seq = 0

  const detail = ref<StoreAppInfo | null>(null)
  const detailLoading = ref(false)
  const detailError = ref(false)

  async function loadCatalog(category: string = ALL, authorType: string = ALL) {
    lastQuery = { category, authorType }
    const mySeq = ++seq
    loading.value = true
    error.value = false
    const params: { category?: string; authorType?: string } = {}
    if (category !== ALL) params.category = category
    if (authorType !== ALL) params.authorType = authorType

    // categories() 与 listApps() 解耦结算:分类拉取失败只应降级 chip 栏(留空/沿用缓存),
    // 不该连累已经成功的 listApps 结果被打成全局错误态——因此把 categories() 的失败
    // 在这里自行吞掉,不让它使下面的 Promise.all 整体 reject。
    const categoriesPromise = categories.value.length
      ? Promise.resolve(null)
      : service.appstore.categories().catch((e) => {
          console.warn('[appstore] loadCatalog categories', e)
          return null
        })

    try {
      const [cats, catalog] = await Promise.all([categoriesPromise, service.appstore.listApps(params)])
      if (mySeq !== seq) return // 更新的请求已经在跑/已经写入,这次陈旧响应静默丢弃
      if (cats) categories.value = cats.filter((c) => (c.count ?? 0) > 0)
      list.value = catalog.list
      installed.value = catalog.installed
      catalogLoaded.value = true
      error.value = false
    } catch (e) {
      if (mySeq !== seq) return
      error.value = true
      console.warn('[appstore] loadCatalog', e)
    } finally {
      if (mySeq === seq) loading.value = false
    }
  }

  function retry() {
    return loadCatalog(lastQuery.category, lastQuery.authorType)
  }

  /** Featured 失败静默置空:推荐带缺失不该挡住浏览主链路(spec §7.5 同容忍度) */
  async function loadFeatured() {
    try {
      const catalog = await service.appstore.listApps({ recommend: true })
      featured.value = catalog.list
    } catch (e) {
      featured.value = {}
      console.warn('[appstore] loadFeatured', e)
    }
  }

  async function loadDetail(id: string) {
    detailLoading.value = true
    detailError.value = false
    detail.value = null
    try {
      const info = await service.appstore.getApp(id)
      if (info) detail.value = info
      else detailError.value = true
    } catch (e) {
      detailError.value = true
      console.warn('[appstore] loadDetail', e)
    } finally {
      detailLoading.value = false
    }
  }

  const isInstalled = (id: string) => installed.value.includes(id)

  return {
    categories, list, installed, featured, loading, error, catalogLoaded,
    detail, detailLoading, detailError,
    loadCatalog, retry, loadFeatured, loadDetail, isInstalled,
  }
})
