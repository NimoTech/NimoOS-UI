import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useFilesStore } from './files'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'

export interface MountEntry {
  kind: 'network' | 'usb'
  id?: number
  name: string
  realPath: string
}

export const useMountsStore = defineStore('mounts', () => {
  const network = ref<MountEntry[]>([])
  const loading = ref(false)
  const files = useFilesStore()
  const toast = useToast()
  const t = i18n.global.t

  async function loadMounts(): Promise<void> {
    loading.value = true
    try {
      const conns = await service.samba.listConnections()
      network.value = conns.map((c) => ({ kind: 'network' as const, id: c.id, name: c.host, realPath: c.mountPoint }))
      // 注册 /mnt/<host> → host 的显示名,使网络挂载路径也能走 toVirtualPath/toRealPath,
      // 不把 /mnt/* 真实路径泄漏到 URL/面包屑/剪贴板(spec §3.3)。
      files.setMountNames(Object.fromEntries(conns.map((c) => [c.mountPoint, c.host])))
    } catch (e) {
      network.value = []
      files.setMountNames({})
      console.warn('[mounts] loadMounts failed', e)
    } finally {
      loading.value = false
    }
  }

  // USB 直接派生自 filesStore.disks(不重复请求);热插由 Files.vue 的 socket 触发 files.loadRoots() 更新。
  const usb = computed<MountEntry[]>(() =>
    files.disks.filter((d) => d.usb).map((d) => ({ kind: 'usb' as const, name: d.name, realPath: d.path })),
  )

  async function ejectNetwork(id: number): Promise<boolean> {
    try {
      await service.samba.deleteConnection(id)
      await loadMounts()
      toast.show(t('filesMountEjectSuccess'))
      return true
    } catch {
      toast.show(t('filesMountEjectFailed'))
      return false
    }
  }

  async function ejectUsb(realPath: string): Promise<boolean> {
    try {
      await service.disks.umountUsb(realPath)
      toast.show(t('filesMountEjectSuccess'))
      return true
    } catch {
      toast.show(t('filesMountEjectFailed'))
      return false
    }
  }

  return { network, usb, loading, loadMounts, ejectNetwork, ejectUsb }
})
