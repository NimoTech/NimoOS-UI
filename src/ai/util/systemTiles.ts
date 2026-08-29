// 1:1 ported from Vue2 src/views/AI/Agent/tabs/SystemTab.vue:38-53 (metrics computed).
//
// SystemTab.vue (component) is responsible for rendering labelKey/subKey into copy via t() — this pure
// function only produces i18n key names + pre-formatted value strings, does not depend on vue-i18n context
// (same "return key names not translations" convention as docErrorKey() in attachmentMeta.ts / relativeTime()
// in stagedGroups.ts).
//
// Vue2 bug fix (project decision 2026-07-27 "migration discipline: UI mirrors Vue2, logic fixed") —
// SystemTab.vue:40-42 original:
//   const cpuPct = sm.cpu && sm.cpu.percent != null
//     ? sm.cpu.percent.length ? sm.cpu.percent[0].toFixed(0) + '%' : '—'
//     : '—'
// This treats `cpu.percent` as an array using `.length` / `[0]` indexing, but the backend (NimoOS
// route/v1/system.go:343-363 GetSystemUtilization and route/periodical.go:50-58
// SendAllHardwareStatusBySocket) both paths send `cpu.percent` as the product of
// `GetCpuPercent() float64` — always a pure number, never an array.
// `(number).length` is always `undefined`, falsy, so Vue2's CPU tile always displays "—"
// regardless of the actual CPU usage. This is a real bug, not design intent, fixed here by reading the number directly.
//
// F3 declaration (final review by Opus, this file previously declared only the above cpu.percent bug
// fix) — three places: `mem.used`/`mem.total`/`cpu.temperature`. Vue2 SystemTab.vue uses `!= null` for
// null check (`sm.mem.used != null`), here changed to `typeof x === 'number'`. Under the current backend
// contract the two are equivalent (the three fields are declared type number, never string numbers); but
// if the backend changes to send string numbers someday, behavior will diverge: Vue2 will render the
// string as a number, here it will fall to `—`. Type narrowing itself is correct (field type declaration
// is number), here we just add this deviation to the declaration list without changing code behavior.
import type { Utilization } from '@nimotech/nimoos-service'

export interface SystemTile {
  labelKey: string
  value: string
  /** i18n key for static translatable copy (e.g. aiSysLan, reusing aiSysCpu for Temp tile's "CPU" literal). */
  subKey?: string
  /** Interpolation parameters needed by subKey (currently only Memory tile's aiSysOf uses {n}). */
  subParams?: Record<string, unknown>
  /** Raw dynamic text from original data, not translatable (e.g. cpu.model), mutually exclusive with subKey. */
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
