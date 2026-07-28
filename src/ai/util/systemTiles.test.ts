// 1:1 移植自 Vue2 src/views/AI/Agent/tabs/SystemTab.vue:38-53(metrics computed)。
import { describe, it, expect } from 'vitest'
import type { Utilization } from '@nimotech/nimoos-service'
import { systemTiles } from './systemTiles'

// `Utilization.net` is typed as `UtilSection` (a bare `Record<string, unknown>
// | null`) in the shared package, but the real runtime payload (both the HTTP
// `/sys/utilization` response and the socket `sys_net` push, see
// systemTiles.ts's header comment) is always an *array* of net-interface
// objects — the package's type is just looser than reality. This helper casts
// test fixtures through `unknown` so the array shape used everywhere below
// type-checks without weakening `systemTiles.ts`'s own signature.
function u(v: Record<string, unknown>): Utilization {
  return v as unknown as Utilization
}

describe('systemTiles(SystemTab.vue:38-53 metrics)', () => {
  it('4 个磁贴在完整数据下的 label/value/sub(正常值)', () => {
    const tiles = systemTiles(u({
      cpu: { percent: 37.4, temperature: 45.6, model: 'intel' },
      mem: { used: 8_500_000_000, total: 16_000_000_000 },
      disk: null,
      gpu: null,
      net: [{ speed: 1000 }],
      usb: null,
    }))
    expect(tiles).toEqual([
      { labelKey: 'aiSysCpu', value: '37%', subText: 'intel' },
      { labelKey: 'aiSysMemory', value: '8.5 GB', subKey: 'aiSysOf', subParams: { n: '16' } },
      { labelKey: 'aiSysNetwork', value: '1000', subKey: 'aiSysLan' },
      { labelKey: 'aiSysTemp', value: '45.6°C', subKey: 'aiSysCpu' },
    ])
  })

  it('Vue2 缺陷修复(SystemTab.vue:40-42):cpu.percent 是纯数字(非数组)时也要显示,不落 "—"', () => {
    // Vue2 原文 `sm.cpu.percent.length ? ... : '—'` 把标量当数组用 `.length` 判断,
    // 而后端(NimoOS route/v1/system.go GetSystemUtilization、
    // route/periodical.go SendAllHardwareStatusBySocket)发的 cpu.percent 永远是
    // 纯 float64,从不是数组 —— `(number).length` 恒为 undefined,Vue2 的 CPU 磁贴
    // 因此从未显示过真实占用率,永远是 "—"。这里改成直接读数字,是本期"逻辑跟正确
    // 性"政策要求的修复,不是照抄 Vue2 的字面行为。
    const tiles = systemTiles({ cpu: { percent: 0 }, mem: null, disk: null, gpu: null, net: null, usb: null })
    expect(tiles[0].value).toBe('0%')
  })

  it('cpu.percent 缺失(null/undefined)→ 落 "—"', () => {
    expect(systemTiles({ cpu: null, mem: null, disk: null, gpu: null, net: null, usb: null })[0].value).toBe('—')
    expect(systemTiles({ cpu: {}, mem: null, disk: null, gpu: null, net: null, usb: null })[0].value).toBe('—')
    expect(systemTiles(null)[0].value).toBe('—')
  })

  it('mem 换算 GB(/1e9),缺 total 时 sub 为空字符串(非 "—",逐字对齐 Vue2:44)', () => {
    const tiles = systemTiles({ cpu: null, mem: { used: 1_234_000_000 }, disk: null, gpu: null, net: null, usb: null })
    expect(tiles[1].value).toBe('1.2 GB')
    expect(tiles[1].subKey).toBeUndefined()
    expect(tiles[1].subText).toBe('')
  })

  it('mem 完全缺失 → value 落 "—"', () => {
    const tiles = systemTiles({ cpu: null, mem: null, disk: null, gpu: null, net: null, usb: null })
    expect(tiles[1].value).toBe('—')
  })

  it('net 非数组/空数组/speed 为假值(0)→ "—"(Vue2:45 `sm.net[0].speed || "—"`)', () => {
    expect(systemTiles(u({ cpu: null, mem: null, disk: null, gpu: null, net: null, usb: null }))[2].value).toBe('—')
    expect(systemTiles(u({ cpu: null, mem: null, disk: null, gpu: null, net: [], usb: null }))[2].value).toBe('—')
    expect(systemTiles(u({ cpu: null, mem: null, disk: null, gpu: null, net: [{ speed: 0 }], usb: null }))[2].value).toBe('—')
    // Network 磁贴的 sub 恒为 aiSysLan,不随数据变化(Vue2:50 字面量 'LAN')
    expect(systemTiles(u({ cpu: null, mem: null, disk: null, gpu: null, net: null, usb: null }))[2].subKey).toBe('aiSysLan')
  })

  it('cpu.temperature 缺失 → "—";Temp 磁贴 sub 恒为 aiSysCpu(Vue2:51 字面量 "CPU")', () => {
    const tiles = systemTiles({ cpu: {}, mem: null, disk: null, gpu: null, net: null, usb: null })
    expect(tiles[3].value).toBe('—')
    expect(tiles[3].subKey).toBe('aiSysCpu')
  })
})
