import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service, type AppCategory, type StoreAppInfo } from '@nimotech/nimoos-service'

/** Frontend fallback "All" sentinel -- not a backend category; when =ALL the parameter is omitted (same semantics as Vue2) */
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
  // Request sequence number: when multiple loadCatalog calls run concurrently (e.g. rapidly
  // switching category/author), only the most recently issued request may write
  // list/installed/catalogLoaded/error and flip loading in its finally block --
  // otherwise an earlier request that returns later would overwrite fresh state with stale data.
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

    // categories() and listApps() settle independently: a failed category fetch should only
    // degrade the chip bar (leave empty / keep cache), not mark an otherwise successful
    // listApps result as a global error state -- so swallow categories() failures here
    // instead of letting them reject the whole Promise.all below.
    const categoriesPromise = categories.value.length
      ? Promise.resolve(null)
      : service.appstore.categories().catch((e) => {
          console.warn('[appstore] loadCatalog categories', e)
          return null
        })

    try {
      const [cats, catalog] = await Promise.all([categoriesPromise, service.appstore.listApps(params)])
      if (mySeq !== seq) return // A newer request is running / has written; silently drop this stale response
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

  /** On featured failure, silently clear: a missing recommendation strip must not block the main browsing flow (same tolerance as spec §7.5) */
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

  /** After a store source is added/removed the catalog has changed: seq++ orphans any in-flight
   *  loadCatalog (prevents a stale response reviving the cache), clears the categories cache
   *  (loadCatalog has a length guard, so without clearing it would never refetch) and resets catalogLoaded;
   *  loading is reset too -- the orphaned request's finally won't flip it since mySeq !== seq.
   *  featured is refetched on every mount with no cache guard, so no clearing needed. */
  function invalidate() {
    seq++
    loading.value = false
    categories.value = []
    catalogLoaded.value = false
  }

  const isInstalled = (id: string) => installed.value.includes(id)

  return {
    categories, list, installed, featured, loading, error, catalogLoaded,
    detail, detailLoading, detailError,
    loadCatalog, retry, loadFeatured, loadDetail, invalidate, isInstalled,
  }
})
