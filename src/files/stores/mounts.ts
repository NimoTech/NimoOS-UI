import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { service } from '@nimotech/nimoos-service'
import { useFilesStore } from './files'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'
import { driverIconUrl } from '../util/cloudAuth'

export interface MountEntry {
  kind: 'network' | 'usb' | 'cloud'
  id?: number
  name: string
  realPath: string
  icon?: string
}

export const useMountsStore = defineStore('mounts', () => {
  const network = ref<MountEntry[]>([])
  const cloud = ref<MountEntry[]>([])
  const loading = ref(false)
  const files = useFilesStore()
  const toast = useToast()
  const t = i18n.global.t

  async function loadMounts(): Promise<void> {
    loading.value = true
    const names: Record<string, string> = {}
    try {
      const conns = await service.samba.listConnections()
      network.value = conns.map((c) => ({ kind: 'network' as const, id: c.id, name: c.host, realPath: c.mountPoint }))
      for (const c of conns) names[c.mountPoint] = c.host
    } catch (e) {
      network.value = []
      console.warn('[mounts] samba load failed', e)
    }
    try {
      const clouds = await service.cloud.list()
      const origin = window.location.origin
      cloud.value = clouds.map((c) => ({ kind: 'cloud' as const, name: c.name, realPath: c.mountPoint, icon: driverIconUrl(c.icon, origin) }))
      for (const c of clouds) names[c.mountPoint] = c.name
    } catch (e) {
      cloud.value = []
      console.warn('[mounts] cloud load failed', e)
    }
    // Network + cloud mount points are uniformly registered in displayNames to avoid leaking real mount paths (P5a IMP1).
    files.setMountNames(names)
    loading.value = false
  }

  // USB is directly derived from filesStore.disks (no duplicate requests); hot-insertion is triggered by Files.vue's socket to update files.loadRoots().
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

  async function ejectCloud(mountPoint: string): Promise<boolean> {
    try {
      await service.cloud.umount(mountPoint)
      await loadMounts()
      toast.show(t('filesMountEjectSuccess'))
      return true
    } catch {
      toast.show(t('filesMountEjectFailed'))
      return false
    }
  }

  return { network, usb, cloud, loading, loadMounts, ejectNetwork, ejectUsb, ejectCloud }
})
