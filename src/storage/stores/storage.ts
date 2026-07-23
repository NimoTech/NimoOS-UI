import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { i18n } from '../../i18n'
import { useToast } from '../../stores/toast'
import { mapVolumes, mapDrives, mapAvailDisks, type StorageVolume, type PhysicalDrive, type AvailDisk } from '../util/storageMap'

export const useStorageStore = defineStore('storage', () => {
  const volumes = ref<StorageVolume[]>([])
  const drives = ref<PhysicalDrive[]>([])
  const availDisks = ref<AvailDisk[]>([])
  const raidNames = ref<string[]>([])
  const loading = ref(false)
  const unmounting = ref(false)
  const creating = ref(false)
  const formatting = ref(false)
  const t = i18n.global.t

  async function loadVolumes() {
    try {
      // raid.list 兜底空数组:老后端无 /v2/raid 时卷列表照常工作
      const [storageRes, raidRes] = await Promise.all([
        service.storage.list({ system: 'show' }),
        service.raid.list().catch(() => [] as unknown[]),
      ])
      const raidArr = Array.isArray(raidRes) ? raidRes : []
      const raidMounts = new Set(
        raidArr
          .map((r) => (r as { mount_point?: string })?.mount_point)
          .filter((m): m is string => !!m),
      )
      raidNames.value = raidArr
        .map((r) => (r as { name?: string })?.name)
        .filter((n): n is string => !!n)
      volumes.value = mapVolumes(storageRes, raidMounts)
    } catch (e) {
      console.warn('[storage] volumes load failed', e)
      volumes.value = []
    }
  }

  async function loadDrives() {
    try {
      const res = (await service.disks.getDiskList()) as { disks?: unknown; avail?: unknown } | null
      drives.value = mapDrives(res?.disks)
      availDisks.value = mapAvailDisks(res?.avail)
    } catch (e) {
      console.warn('[storage] drives load failed', e)
      drives.value = []
      availDisks.value = []
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
    if (unmounting.value) return false
    unmounting.value = true
    const toast = useToast()
    try {
      // 契约:DELETE /v1/disks {path: 父盘路径, password}(Vue2 StorageItem 同款)
      await service.disks.umount({ path: diskPath, password })
      toast.show(t('storageUnmountSuccess'))
      await loadAll()
      return true
    } catch (e) {
      // 只记 message:AxiosError 携带请求体(含明文密码),不可整个打日志
      console.warn('[storage] unmount failed', (e as Error)?.message)
      toast.show(t('storageUnmountFailed'))
      return false
    } finally {
      unmounting.value = false
    }
  }

  async function createStorage(payload: { path: string; name: string; format: boolean }): Promise<boolean> {
    if (creating.value) return false
    creating.value = true
    const toast = useToast()
    let ok = false
    try {
      // 契约:POST /v1/storage {path, name, format} 仅三字段(Vue2 submitCreate 同款)
      await service.storage.create(payload)
      toast.show(t('storageCreateSuccess'))
      ok = true
    } catch (e) {
      console.warn('[storage] create failed', (e as Error)?.message)
      toast.show(t('storageCreateFailed'))
    } finally {
      creating.value = false
    }
    await loadAll() // Vue2 语义:成败都刷新
    return ok
  }

  async function formatVolume(payload: { path: string; volume: string; password: string }): Promise<boolean> {
    if (formatting.value) return false
    formatting.value = true
    const toast = useToast()
    try {
      // 契约:PUT /v1/storage {path: 分区路径, volume: 挂载点, password}(Vue2 StorageItem formatStorage 同款)
      await service.storage.format(payload)
      toast.show(t('storageFormatSuccess'))
      await loadAll() // Vue2 语义:格式化仅成功刷新
      return true
    } catch (e) {
      // 只记 message:请求体含明文密码
      console.warn('[storage] format failed', (e as Error)?.message)
      toast.show(t('storageFormatFailed'))
      return false
    } finally {
      formatting.value = false
    }
  }

  return {
    volumes,
    drives,
    availDisks,
    raidNames,
    loading,
    creating,
    formatting,
    unmounting,
    loadVolumes,
    loadDrives,
    loadAll,
    unmount,
    createStorage,
    formatVolume,
  }
})
