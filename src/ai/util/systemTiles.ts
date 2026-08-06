// 1:1 移植自 Vue2 src/views/AI/Agent/tabs/SystemTab.vue:38-53(metrics computed)。
//
// SystemTab.vue(组件)负责把 labelKey/subKey 通过 t() 渲染成文案 —— 这个纯函数
// 只产出 i18n 键名 + 已格式化好的数值字符串,不依赖 vue-i18n 上下文(与
// attachmentMeta.ts 的 docErrorKey()/stagedGroups.ts 的 relativeTime() 同款
// "返回键名而非译文" 约定)。
//
// Vue2 缺陷修复(项目 2026-07-27 拍板"移植纪律·界面照 Vue2 逻辑照正确")——
// SystemTab.vue:40-42 原文:
//   const cpuPct = sm.cpu && sm.cpu.percent != null
//     ? sm.cpu.percent.length ? sm.cpu.percent[0].toFixed(0) + '%' : '—'
//     : '—'
// 这把 `cpu.percent` 当成数组用 `.length`/`[0]` 取值,但后端(NimoOS
// route/v1/system.go:343-363 GetSystemUtilization、route/periodical.go:50-58
// SendAllHardwareStatusBySocket)两条路径发的 `cpu.percent` 都是
// `GetCpuPercent() float64` 的产物 —— 从来都是纯数字,不是数组。
// `(number).length` 恒为 `undefined`,falsy,于是 Vue2 的 CPU 磁贴无论真实占用率
// 是多少,永远显示 "—"。这是一个真实缺陷,不是设计意图,这里直接读数字修复。
//
// F3 申报(终审 opus 复查,本文件头之前只申报了上面 cpu.percent 那一处缺陷
// 修复)—— `mem.used`/`mem.total`/`cpu.temperature` 三处,Vue2 SystemTab.vue 用
// `!= null` 判空(`sm.mem.used != null`),这里换成了 `typeof x === 'number'`。
// 两者在当前后端契约下等价(三个字段声明类型就是 number,永远不会是字符串数字)；
// 但若后端某天改发字符串数字,行为会分叉:Vue2 会把字符串当数字渲染出来,这里会
// 落 `—`。类型收窄本身是对的(字段类型声明即 number),这里只是把这个偏离补进
// 申报清单,不改代码行为。
import type { Utilization } from '@nimotech/nimoos-service'

export interface SystemTile {
  labelKey: string
  value: string
  /** 静态可译文案的 i18n 键(如 aiSysLan、复用 aiSysCpu 给 Temp 磁贴的 "CPU" 字面量)。 */
  subKey?: string
  /** subKey 需要的插值参数(目前只有 Memory 磁贴的 aiSysOf 用到 {n})。 */
  subParams?: Record<string, unknown>
  /** 来自原始数据、不可译的动态文本(如 cpu.model),与 subKey 互斥。 */
  subText?: string
}

interface CpuSection { percent?: number; temperature?: number; model?: string }
interface MemSection { used?: number; total?: number }
interface NetItem { speed?: number }

export function systemTiles(data: Utilization | null | undefined): SystemTile[] {
  const cpu = (data?.cpu ?? null) as unknown as CpuSection | null
  const mem = (data?.mem ?? null) as unknown as MemSection | null
  const netArr = Array.isArray(data?.net) ? (data?.net as unknown as NetItem[]) : null

  const cpuPct = cpu && typeof cpu.percent === 'number' ? cpu.percent.toFixed(0) + '%' : '—'
  const memUsed = mem && typeof mem.used === 'number' ? (mem.used / 1e9).toFixed(1) + ' GB' : '—'
  const memTotalGB = mem && typeof mem.total === 'number' ? (mem.total / 1e9).toFixed(0) : null
  // Vue2:45 `sm.net[0].speed || '—'` — falsy speed (0/undefined) also falls back.
  const rawSpeed = netArr && netArr.length > 0 ? netArr[0]?.speed : undefined
  const netSpeed = rawSpeed ? String(rawSpeed) : '—'
  const cpuTemp = cpu && typeof cpu.temperature === 'number' ? cpu.temperature + '°C' : '—'

  const memTile: SystemTile = memTotalGB != null
    ? { labelKey: 'aiSysMemory', value: memUsed, subKey: 'aiSysOf', subParams: { n: memTotalGB } }
    : { labelKey: 'aiSysMemory', value: memUsed, subText: '' }

  return [
    { labelKey: 'aiSysCpu', value: cpuPct, subText: cpu?.model || '' },
    memTile,
    { labelKey: 'aiSysNetwork', value: netSpeed, subKey: 'aiSysLan' },
    { labelKey: 'aiSysTemp', value: cpuTemp, subKey: 'aiSysCpu' },
  ]
}
