import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'
import { shareName } from '../util/sambaPath'

export interface ShareRow { id: number; path: string; name: string }

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
    } catch {
      toast.show(t('filesShareFailed'))
      return false
    }
  }

  async function remove(id: number): Promise<boolean> {
    try {
      await service.samba.deleteShare(id)
      await load()
      toast.show(t('filesUnshareDone'))
      return true
    } catch {
      toast.show(t('filesShareFailed'))
      return false
    }
  }

  return { items, loading, load, create, remove }
})
