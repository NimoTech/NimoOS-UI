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

  const detail = ref<StoreAppInfo | null>(null)
  const detailLoading = ref(false)
  const detailError = ref(false)

  async function loadCatalog(category: string = ALL, authorType: string = ALL) {
    lastQuery = { category, authorType }
    loading.value = true
    error.value = false
    try {
      const params: { category?: string; authorType?: string } = {}
      if (category !== ALL) params.category = category
      if (authorType !== ALL) params.authorType = authorType
      const [cats, catalog] = await Promise.all([
        categories.value.length ? Promise.resolve(null) : service.appstore.categories(),
        service.appstore.listApps(params),
      ])
      if (cats) categories.value = cats.filter((c) => (c.count ?? 0) > 0)
      list.value = catalog.list
      installed.value = catalog.installed
      catalogLoaded.value = true
    } catch (e) {
      error.value = true
      console.warn('[appstore] loadCatalog', e)
    } finally {
      loading.value = false
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
