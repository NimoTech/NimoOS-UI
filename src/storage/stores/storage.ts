import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { i18n } from '../../i18n'
import { useToast } from '../../stores/toast'
import { mapVolumes, mapDrives, type StorageVolume, type PhysicalDrive } from '../util/storageMap'

export const useStorageStore = defineStore('storage', () => {
  const volumes = ref<StorageVolume[]>([])
  const drives = ref<PhysicalDrive[]>([])
  const loading = ref(false)
  const t = i18n.global.t

  async function loadVolumes() {
    try {
      // raid.list 兜底空数组:老后端无 /v2/raid 时卷列表照常工作
      const [storageRes, raidRes] = await Promise.all([
        service.storage.list({ system: 'show' }),
        service.raid.list().catch(() => [] as unknown[]),
      ])
      const raidMounts = new Set(
        (Array.isArray(raidRes) ? raidRes : [])
          .map((r) => (r as { mount_point?: string })?.mount_point)
          .filter((m): m is string => !!m),
      )
      volumes.value = mapVolumes(storageRes, raidMounts)
    } catch (e) {
      console.warn('[storage] volumes load failed', e)
      volumes.value = []
    }
  }

  async function loadDrives() {
    try {
      const res = (await service.disks.getDiskList()) as { disks?: unknown } | null
      drives.value = mapDrives(res?.disks)
    } catch (e) {
      console.warn('[storage] drives load failed', e)
      drives.value = []
    }
  }

  async function loadAll() {
    loading.value = true
    try {
      await Promise.all([loadVolumes(), loadDrives()])
    } finally {
      loading.value = false
    }
  }

  async function unmount(diskPath: string, password: string): Promise<boolean> {
    const toast = useToast()
    try {
      // 契约:DELETE /v1/disks {path: 父盘路径, password}(Vue2 StorageItem 同款)
      await service.disks.umount({ path: diskPath, password })
      toast.show(t('storageUnmountSuccess'))
      await loadAll()
      return true
    } catch (e) {
      console.warn('[storage] unmount failed', e)
      toast.show(t('storageUnmountFailed'))
      return false
    }
  }

  return { volumes, drives, loading, loadVolumes, loadDrives, loadAll, unmount }
})
