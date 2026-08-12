import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'
import { shareName } from '../util/sambaPath'

export interface ShareRow { id: number; path: string; name: string }

// 透出后端错误消息(如「已共享」),取不到则回退通用文案。仿 NetworkStorageDialog。
function errMsg(e: unknown): string | undefined {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message
}

export const useSharesStore = defineStore('shares', () => {
  const items = ref<ShareRow[]>([])
  const loading = ref(false)
  const toast = useToast()
  const t = i18n.global.t

  async function load(): Promise<void> {
    loading.value = true
    try {
      const raw = await service.samba.listShares()
      items.value = raw.map((s) => ({ id: s.id, path: s.path, name: shareName(s.path) }))
    } catch (e) {
      items.value = []
      console.warn('[shares] load failed', e)
    } finally {
      loading.value = false
    }
  }

  async function create(paths: string[]): Promise<boolean> {
    if (!paths.length) return false
    try {
      await service.samba.createShare(paths)
      await load()
      toast.show(paths.length > 1 ? t('filesShareBatchDone', { count: paths.length }) : t('filesShareDone'))
      return true
    } catch (e) {
      toast.show(errMsg(e) || t('filesShareFailed'))
      return false
    }
  }

  async function remove(id: number): Promise<boolean> {
    try {
      await service.samba.deleteShare(id)
      await load()
      toast.show(t('filesUnshareDone'))
      return true
    } catch (e) {
      toast.show(errMsg(e) || t('filesShareFailed'))
      return false
    }
  }

  // Batch unshare. The backend only has a per-id DELETE endpoint, so fan out
  // concurrently and settle all: one reload, one toast, failed ids returned so
  // the page can keep them selected for retry.
  async function removeMany(ids: number[]): Promise<{ failedIds: number[] }> {
    if (!ids.length) return { failedIds: [] }
    const results = await Promise.allSettled(ids.map((id) => service.samba.deleteShare(id)))
    const failedIds = ids.filter((_, i) => results[i].status === 'rejected')
    await load()
    const ok = ids.length - failedIds.length
    if (!failedIds.length) {
      toast.show(t('filesUnshareBatchDone', { count: ok }))
    } else if (!ok) {
      const first = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
      toast.show(errMsg(first?.reason) || t('filesShareFailed'))
    } else {
      toast.show(t('filesUnshareBatchPartial', { ok, fail: failedIds.length }))
    }
    return { failedIds }
  }

  return { items, loading, load, create, remove, removeMany }
})
