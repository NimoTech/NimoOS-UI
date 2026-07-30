// 从 NimoOS-UI/src/utils/raidUtils.js 逐字移植(P4);故障模拟器 survival()/rebuildable() 推迟。
// 迁移范围:RAID_LEVELS(min/tolerance/read/write/cost/desc/usecase/capacity()/layout(),raidUtils.js:1-76)、
// recommendRaidLevel(raidUtils.js:158-166)、isDiskAtRisk(raidUtils.js:108-110)。
// 混规格分组配色(groupDisksBySpec L148-156 + assignGroupColors/GROUP_COLOR_COUNT L168-178)改造为
// groupColorKey:输出分组语义 key('group-a'..'group-e'),不输出字面色 —— 由组件层再映射到 --nrm-*/--accent 等 token。
// 未迁移(有意推迟,故障模拟器):survival()、rebuildable()。

// 本地最小磁盘视图类型,对齐 Vue2 disk.path/size/disk_type/health/temperature/power_on_time/model 读法
//(raidView.ts 未导出等价类型)。字段名保持后端 /v1/disks 的原文命名,以便 AvailDisk 结构上直接可赋值。
export interface RaidDisk {
  path: string
  size: number
  disk_type?: string
  health?: string
  temperature?: number
  power_on_time?: number
  model?: string
}

export type RaidRole = 'data' | 'mirror' | 'parity' | 'parity2'

export interface RaidLevelSpec {
  id: number
  name: string
  min: number
  tolerance: string
  read: number
  write: number
  cost: number
  desc: string
  usecase: string
  capacity: (n: number, sizeBytes: number) => number
  layout: (n: number) => RaidRole[]
}

export const RAID_LEVELS: RaidLevelSpec[] = [
  {
    id: 0,
    name: 'RAID 0',
    min: 2,
    // Vue2 原始 tolerance 为数字 0(raidUtils.js:4)。
    tolerance: '0',
    read: 5,
    write: 5,
    cost: 5,
    desc: 'RAID 0 Description',
    usecase: 'Video scratch disks, caches, render farms',
    capacity: (n, s) => n * s,
    layout: (n) => Array.from({ length: n }, () => 'data'),
  },
  {
    id: 1,
    name: 'RAID 1',
    min: 2,
    // Vue2 原始 tolerance 为函数 (n) => n - 1(raidUtils.js:15)。
    tolerance: 'n-1',
    read: 4,
    write: 2,
    cost: 1,
    desc: 'RAID 1 Description',
    usecase: 'Photo library, personal NAS, boot volumes',
    capacity: (_n, s) => s,
    layout: (n) => Array.from({ length: n }, (_, i) => (i === 0 ? 'data' : 'mirror')),
  },
  {
    id: 5,
    name: 'RAID 5',
    min: 3,
    tolerance: '1',
    read: 4,
    write: 3,
    cost: 3,
    desc: 'RAID 5 Description',
    usecase: 'General NAS, media servers, small business',
    capacity: (n, s) => Math.max(0, (n - 1) * s),
    layout: (n) => Array.from({ length: n }, (_, i) => (i === n - 1 ? 'parity' : 'data')),
  },
  {
    id: 6,
    name: 'RAID 6',
    min: 4,
    tolerance: '2',
    read: 4,
    write: 2,
    cost: 3,
    desc: 'RAID 6 Description',
    usecase: 'Large arrays, archives, anything important',
    capacity: (n, s) => Math.max(0, (n - 2) * s),
    layout: (n) =>
      Array.from({ length: n }, (_, i) => (i === n - 1 ? 'parity' : i === n - 2 ? 'parity2' : 'data')),
  },
  {
    id: 10,
    name: 'RAID 10',
    min: 4,
    // Vue2 原始 tolerance 为字符串 'half'(raidUtils.js:50)。
    tolerance: 'half',
    read: 5,
    write: 4,
    cost: 2,
    desc: 'RAID 10 Description',
    usecase: 'Databases, virtualization, heavy-write loads',
    capacity: (n, s) => Math.floor(n / 2) * s,
    layout: (n) => {
      const pairs = Math.floor(n / 2)
      const arr: RaidRole[] = []
      for (let p = 0; p < pairs; p++) {
        arr.push('data')
        arr.push('mirror')
      }
      return arr
    },
  },
]

// raidUtils.js:158-166,简化为纯盘数决策(不含 groupDisksBySpec 的混规格/长度校验,由调用方在选盘阶段处理)。
export function recommendRaidLevel(n: number): number {
  if (n === 2) return 1
  if (n === 3) return 5
  return n % 2 === 0 ? 10 : 5
}

// ── 磁盘健康结论(health 字段的真实取值,2026-07-30 真机 curl 逐字核实)────────────────
// `curl -s http://127.0.0.1/v1/disks` 的三种真实取值:
//   · data.avail[*].health = ""       ← 建 RAID 向导的候选盘来源,恒为空串
//   · data.disks[*].health = "true"   ← SMART 通过
//   · 同上                  "false"   ← SMART 未过(strconv.FormatBool,必小写)
// avail 恒为空串是后端缺陷:NimoOS-LocalStorage/route/v1/disk.go:152-157 把 disk **值拷贝**
// append 进 avail,而 disk.Health = strconv.FormatBool(...) 在那之后才执行,拿到的是零值。
// 前端因此在 mapAvailDisks 里按 path 从 disks 列表补齐 health(见 storageMap.ts),
// 使这里能收到真实结论;补不上时保持空串 = 结论未知。
// ⚠️ 空串不等于"健康",也不等于"风险":它是"后端没给结论"。故三态而非二元 ——
// Vue2(raidUtils.js:108-110)只有 `=== 'false'` 一句,把空串静默当健康;此处按正确逻辑拆开
// (界面表现不变:未知与健康都不画风险边框),依据记忆 vue2-port-visual-only-fix-logic。
// ⚠️ 不要"顺手"把 service/disk.go 那套表示(Health="OK" 通过 / "" 未过)混进来:那套里空串
// 含义正好相反,而它不经由 /v1/disks,不在本组件的数据契约内。
export type DiskHealthState = 'good' | 'bad' | 'unknown'

export function diskHealthState(disk: RaidDisk): DiskHealthState {
  if (disk.health === 'false') return 'bad'
  if (disk.health === 'true') return 'good'
  return 'unknown'
}

export function isDiskAtRisk(disk: RaidDisk): boolean {
  return diskHealthState(disk) === 'bad'
}

// ── 健康信息展示(Vue2 raidUtils.js:112-149 逐字移植)──────────────────────────────
// 用途 = 选盘卡片本身的常规信息展示(容量行健康色点 + 悬浮提示的温度/通电时间/健康分),
// **与故障模拟器无关** —— 后者是 RaidMatrix 里另一个弹窗(survival()/rebuildable()),仍不在范围内。
export type HealthTone = 'good' | 'warn' | 'bad'

// raidUtils.js:112-115。真机假盘 temperature=38 → "38°C";缺值/0/负数 → "-"。
export function tempDisplay(t?: number): string {
  if (t == null || t <= 0) return '-'
  return `${t}°C`
}

// raidUtils.js:117-119。
export function tempTone(t?: number): HealthTone {
  const v = t ?? 0
  return v >= 46 ? 'bad' : v >= 42 ? 'warn' : 'good'
}

// raidUtils.js:122-126。真机假盘 power_on_time=0 → "-";系统盘 1381 → "0.2yr"(1000 起按 8760 折年)。
export function pohDisplay(hours?: number): string {
  if (!hours || hours <= 0) return '-'
  if (hours < 1000) return `${hours}h`
  return `${(hours / 8760).toFixed(1)}yr`
}

// raidUtils.js:128-131。
export function pohTone(hours?: number): HealthTone {
  if (!hours) return 'good'
  return hours >= 35000 ? 'bad' : hours >= 18000 ? 'warn' : 'good'
}

// raidUtils.js:135-144。100 分起扣:SMART 未过直接 0;温度 42/46 扣 15/30;通电 18000/35000 扣 15/30。
// 结论未知(空串)时不扣分 —— 与 Vue2 一致:这个分数表达的是温度/通电时长反映的状态,
// 不是 SMART 结论本身;SMART 结论由色点/风险边框那条路径表达。
export function diskHealthScore(disk: RaidDisk): number {
  if (diskHealthState(disk) === 'bad') return 0
  let score = 100
  const temp = disk.temperature ?? 0
  const poh = disk.power_on_time ?? 0
  if (temp >= 46) score -= 30
  else if (temp >= 42) score -= 15
  if (poh >= 35000) score -= 30
  else if (poh >= 18000) score -= 15
  return Math.max(0, score)
}

// raidUtils.js:146-149。
export function diskHealthTone(score: number): HealthTone {
  if (score >= 85) return 'good'
  if (score >= 60) return 'warn'
  return 'bad'
}

// raidUtils.js groupDisksBySpec(L148-156):分组键 = `${size}|${disk_type}`。
export function diskSpecKey(disk: RaidDisk): string {
  return `${disk.size}|${disk.disk_type ?? ''}`
}

// 与 Vue2 assignGroupColors 的 GROUP_COLOR_COUNT(=5,raidUtils.js:168)对齐的分组语义 key 表,
// 循环复用;组件层负责把这些 key 映射到具体 theme token(如 --nrm-a/--nrm-b/--accent 等)。
const GROUP_KEYS = ['group-a', 'group-b', 'group-c', 'group-d', 'group-e'] as const

// 输入磁盘 + 已知分组列表(每组以 diskSpecKey 格式的 key 标识),按分组在列表中的位置(mod 5)
// 返回分组语义 key —— 绝不返回字面色,只返回 token 语义标识供组件层再映射。
export function groupColorKey(disk: RaidDisk, groups: Array<{ key: string }>): string {
  const key = diskSpecKey(disk)
  const idx = groups.findIndex((g) => g.key === key)
  const safeIdx = idx < 0 ? 0 : idx
  return GROUP_KEYS[safeIdx % GROUP_KEYS.length]
}
