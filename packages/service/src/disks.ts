import type { AxiosInstance } from 'axios'
import { unwrap } from './unwrap.js'

// Fields copied from NimoOS-LocalStorage route/v1/disk.go (GET /v1/disks, verified 2026-08-11 via real-device curl).
// The raid field comes from an mdadm superblock scan —— note that array_name/created_at/updated_at are **strings taken from the superblock**,
// which any inserted disk can control the content of, so the frontend must render them only as untrusted text (template interpolation), never concatenate them into HTML.
export interface DiskRaidInfo {
  // member = a member of an array running/registered on this machine, **must never** be selectable as a new/replacement disk (the backend has already excluded them from avail);
  // residue = a superblock left over from a foreign/abandoned array, appears in avail, selecting it requires wipe_raid_residue: true.
  role: 'member' | 'residue'
  array_name: string
  array_uuid: string
  level: string // a lowercase string like "raid10"
  md_device?: string // may be absent
  registered: boolean
  active: boolean
  created_at?: string // only present for residue (mdadm's raw text, e.g. "Thu Aug  6 21:54:49 2026")
  updated_at?: string // only present for residue
}

// A partition/child-device row (disk.children[]).
export interface DiskChild {
  name: string
  size: number
  format: string
  supported: boolean
  mount_point?: string // "" or absent when not mounted
  used_bytes?: number // only present when mounted
}

// A physical disk (data.disks[] and data.avail[] share this shape). health is the string "true"/"false"
// (always an empty string in avail, a backend assignment-order defect, see src/storage/util/storageMap.ts mapAvailDisks).
export interface Drive {
  name: string
  size: number
  model: string
  serial: string
  disk_by_id?: string // added 2026-08, may be ""
  health: string
  temperature: number
  power_on_time: number
  disk_type: string
  need_format: boolean
  path: string
  children?: DiskChild[]
  raid?: DiskRaidInfo // absent for a clean disk
  [k: string]: unknown
}

export interface DiskListData {
  disks: Drive[]
  avail: Drive[]
}

export function createDisks(http: AxiosInstance) {
  return {
    // GET /v1/disks — physical disk list (envelope Data = {disks, avail}).
    // Older backends may return a bare array directly, this branch passes it through as-is —— the type is declared per the real-device envelope shape.
    async getDiskList(params?: Record<string, unknown>): Promise<DiskListData> {
      const res = await http.get('/disks', { params })
      const d = res.data
      return (Array.isArray(d) ? d : unwrap<DiskListData>(d)) as DiskListData
    },
    // DELETE /v1/disks — unmount a disk (body passed through, same shape as Vue2 disks.umount)
    async umount(data: unknown): Promise<unknown> {
      const res = await http.delete('/disks', { data })
      return unwrap<unknown>(res.data)
    },
    // GET /v1/disks/usb — USB device list
    async getUsbs(): Promise<unknown> {
      const res = await http.get('/disks/usb')
      const d = res.data
      return Array.isArray(d) ? d : unwrap<unknown>(d)
    },
    async umountUsb(mountPoint: string): Promise<void> {
      await http.delete('/disks/usb', { data: { mount_point: mountPoint } })
    },
    async list(): Promise<unknown> {
      const res = await http.get('/disks')
      const d = res.data
      return Array.isArray(d) ? d : unwrap<unknown>(d)
    },
  }
}
