// 从 NimoOS-UI/src/utils/raidUtils.js 逐字移植(2026-08-11,commit 0623ce20/69ea4798/b6cffd6c):
// findReplaceTarget(L190-213)+ filterReplacementCandidates(L219-227)。行为保持一致,
// 包括「无实时成员视图 → null」的守卫;只加 TS 类型,不改判定逻辑。
//
// 背景(2026-08-11 事故):拔盘换新后,被拔盘腾出的设备字母(/dev/sdb)会被新盘复用 ——
// 被拔盘在 DB 里缓存的 device_path_cache 从此指向一块**别的**物理盘。按 path 识别/过滤
// 会把候选盘列表清空、请求体里点错盘。所以:在位故障盘(faulty)path 可信、直接用;
// 拔掉的盘只能按 serial 匹配,它的陈旧缓存路径绝不当作盘本身暴露出去。
import type { DiskRaidInfo, RaidMemberDiskRow } from '@nimotech/nimoos-service'

export interface ReplaceTarget {
  // 在位故障盘的实时路径;拔掉的盘为 ''(陈旧缓存路径不暴露)
  path: string
  serial: string
  // 展示用:在位盘是 path,拔掉的盘是 serial(再兜底缓存路径)
  label: string
}

// findReplaceTarget 吃 status.members 的行(path/state/serial),字段全可缺席以兼容老后端。
export interface LiveMemberLike {
  path?: string
  state?: string
  serial?: string
}

// 候选盘输入:store.availDisks(AvailDisk)结构上满足;path 缺席时退 name(Vue2 同款)。
export interface CandidateDiskLike {
  path?: string
  name?: string
  size?: number
  serial?: string
  raid?: DiskRaidInfo | null
}

export interface ReplacementCandidate {
  path: string
  size: number
  serial: string
  // residue 信息透传:换盘弹窗靠它打警告标 + 弹清除确认
  raid: DiskRaidInfo | null
}

// 识别降级阵列里被换掉的成员。
// 打了 faulty 标的盘还在位,实时 path 可信;拔掉的盘只剩 DB 成员行,按 serial 匹配,
// 陈旧缓存路径不作为盘身份暴露。后端不报成员 serial 时保留按 path 检测的回退。
export function findReplaceTarget(
  liveMembers: LiveMemberLike[] | null | undefined,
  memberDisks: RaidMemberDiskRow[] | null | undefined,
): ReplaceTarget | null {
  const live = (liveMembers || []).filter((m) => m && m.path)
  // 完全没有实时视图(status 还没拉到,或 mdadm 不可达)是「没有信息」,
  // 不是「所有成员都不见了」—— 没有这道守卫,第一块健康盘会被当成故障盘端出来。
  if (!live.length) return null
  const faulty = live.find((m) => m.state === 'faulty')
  if (faulty) {
    return { path: faulty.path as string, serial: faulty.serial || '', label: faulty.path as string }
  }
  const liveSerials = new Set(live.map((m) => m.serial).filter(Boolean))
  const livePaths = new Set(live.map((m) => m.path))
  const bySerial = liveSerials.size > 0
  const missing = (memberDisks || []).find((m) => {
    if (bySerial && m.disk_serial) return !liveSerials.has(m.disk_serial)
    return !!m.device_path_cache && !livePaths.has(m.device_path_cache)
  })
  if (!missing) return null
  return {
    path: '',
    serial: missing.disk_serial || '',
    label: missing.disk_serial || missing.device_path_cache || '',
  }
}

// 过滤替换候选盘:被换的盘自己绝不出现在候选里。
// 双方都有 serial 时按 serial 匹配 —— 热插拔后新盘可能正坐在被拔盘的旧路径上,
// 这种路径撞车不能把候选盘列表清空。
export function filterReplacementCandidates(
  disks: CandidateDiskLike[] | null | undefined,
  target: ReplaceTarget | null | undefined,
): ReplacementCandidate[] {
  return (disks || [])
    .map((d) => ({ path: d.path || d.name || '', size: d.size || 0, serial: d.serial || '', raid: d.raid || null }))
    .filter((d) => {
      if (!target) return true
      if (target.serial && d.serial) return d.serial !== target.serial
      return !target.path || d.path !== target.path
    })
}
