import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service, getHttp } from '@nimotech/nimoos-service'

export interface DiskRoot { name: string; path: string; usb: boolean }

export const useFoldersStore = defineStore('home-folders', () => {
  const cache = ref<Record<string, { name: string; path: string }[]>>({})
  // Selectable disk roots (NimoOS-HD, USB drives). The folder picker starts here —
  // never at the raw filesystem root `/` (which would expose server internals).
  const disks = ref<DiskRoot[]>([])

  async function loadFolder(path: string) {
    try {
      const data = await service.folder.getList(path)
      const content = (data && data.content) || []
      cache.value[path] = content.filter((x) => x.is_dir).map((x) => ({ name: x.name, path: x.path }))
    } catch (e) { console.warn('[home] folder load failed', path, e); cache.value[path] = [] }
  }

  // GET /v1/storage?system=show → disk groups; each child partition has a
  // mount_point + label. The system disk reports mount_point "/" + label
  // "NimoOS-HD" — remap it to /DATA so we never browse from `/`.
  async function loadDisks() {
    try {
      const res = await getHttp().get('/storage', { params: { system: 'show' } })
      const groups: any[] = res?.data?.data || []
      const out: DiskRoot[] = []
      const seen = new Set<string>()
      for (const g of groups) {
        const usb = g?.type === 'usb'
        for (const child of (g?.children || [])) {
          let mp: string = child?.mount_point || ''
          let label: string = child?.label || ''
          if (mp === '/') { mp = '/DATA'; if (!label) label = 'NimoOS-HD' }
          if (!mp || seen.has(mp)) continue
          if (!label) label = mp.split('/').filter(Boolean).pop() || mp
          seen.add(mp)
          out.push({ name: label, path: mp, usb })
        }
      }
      disks.value = out
    } catch (e) { console.warn('[home] disk load failed', e); disks.value = [] }
  }

  return { cache, disks, loadFolder, loadDisks }
})
