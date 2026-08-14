import type { AxiosInstance } from 'axios'
import { unwrap } from './unwrap.js'

// 字段抄自 NimoOS-LocalStorage route/v1/disk.go(GET /v1/disks,2026-08-11 真机 curl 核实)。
// raid 字段来自 mdadm 超块扫描 —— 注意 array_name/created_at/updated_at 是**超块里的字符串**,
// 任何插进来的盘都能控制其内容,前端只能当不可信文本渲染(模板插值),绝不能拼 HTML。
export interface DiskRaidInfo {
  // member = 本机运行/登记的阵列成员,**绝不可**被选为新盘/替换盘(后端已把它们从 avail 剔除);
  // residue = 外来/废弃阵列遗留的超块,出现在 avail 里,选用必须带 wipe_raid_residue: true。
  role: 'member' | 'residue'
  array_name: string
  array_uuid: string
  level: string // "raid10" 等小写串
  md_device?: string // 可能缺席
  registered: boolean
  active: boolean
  created_at?: string // residue 才有(mdadm 原文,如 "Thu Aug  6 21:54:49 2026")
  updated_at?: string // residue 才有
}

// 分区/子设备行(disk.children[])。
export interface DiskChild {
  name: string
  size: number
  format: string
  supported: boolean
  mount_point?: string // 未挂载时为 "" 或缺席
  used_bytes?: number // 仅挂载时才有
}

// 物理盘(data.disks[] 与 data.avail[] 同形)。health 是字符串 "true"/"false"
// (avail 里恒为空串,后端赋值顺序缺陷,见 src/storage/util/storageMap.ts mapAvailDisks)。
export interface Drive {
  name: string
  size: number
  model: string
  serial: string
  disk_by_id?: string // 2026-08 新增,可能为 ""
  health: string
  temperature: number
  power_on_time: number
  disk_type: string
  need_format: boolean
  path: string
  children?: DiskChild[]
  raid?: DiskRaidInfo // 干净盘缺席
  [k: string]: unknown
}

export interface DiskListData {
  disks: Drive[]
  avail: Drive[]
}

export function createDisks(http: AxiosInstance) {
  return {
    // GET /v1/disks — 物理盘列表(信封 Data = {disks, avail})。
    // 老后端可能直接回裸数组,该分支原样透传 —— 类型按真机信封形状声明。
    async getDiskList(params?: Record<string, unknown>): Promise<DiskListData> {
      const res = await http.get('/disks', { params })
      const d = res.data
      return (Array.isArray(d) ? d : unwrap<DiskListData>(d)) as DiskListData
    },
    // DELETE /v1/disks — 卸载盘(body 透传,Vue2 disks.umount 同形)
    async umount(data: unknown): Promise<unknown> {
      const res = await http.delete('/disks', { data })
      return unwrap<unknown>(res.data)
    },
    // GET /v1/disks/usb — USB 设备列表
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
