// 1:1 ported from Vue2 src/views/AI/Agent/tabs/SystemTab.vue:38-53(metrics computed).
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
  it('4 tiles\' label/value/sub with complete data (normal values)', () => {
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

  it('Vue2 bug fix (SystemTab.vue:40-42): cpu.percent as scalar (not array) should also display, not fall to "—"', () => {
    // Vue2's original `sm.cpu.percent.length ? ... : '—'` treats the scalar as array using `.length` check,
    // but the backend (NimoOS route/v1/system.go GetSystemUtilization,
    // route/periodical.go SendAllHardwareStatusBySocket) always sends cpu.percent as
    // pure float64, never an array —— `(number).length` is always undefined, Vue2's CPU tile
    // never displayed the actual usage rate, always "—". Here changed to directly read the number, which is this period's "logic and correctness"
    // policy-required fix, not just copying Vue2's literal behavior.
    const tiles = systemTiles({ cpu: { percent: 0 }, mem: null, disk: null, gpu: null, net: null, usb: null })
    expect(tiles[0].value).toBe('0%')
  })

  it('cpu.percent absent (null/undefined) → falls to "—"', () => {
    expect(systemTiles({ cpu: null, mem: null, disk: null, gpu: null, net: null, usb: null })[0].value).toBe('—')
    expect(systemTiles({ cpu: {}, mem: null, disk: null, gpu: null, net: null, usb: null })[0].value).toBe('—')
    expect(systemTiles(null)[0].value).toBe('—')
  })

  it('mem converted to GB (/1e9), when total absent sub is empty string (not "—", exact alignment with Vue2:44)', () => {
    const tiles = systemTiles({ cpu: null, mem: { used: 1_234_000_000 }, disk: null, gpu: null, net: null, usb: null })
    expect(tiles[1].value).toBe('1.2 GB')
    expect(tiles[1].subKey).toBeUndefined()
    expect(tiles[1].subText).toBe('')
  })

  it('mem completely absent → value falls to "—"', () => {
    const tiles = systemTiles({ cpu: null, mem: null, disk: null, gpu: null, net: null, usb: null })
    expect(tiles[1].value).toBe('—')
  })

  it('net not array/empty array/speed is falsy(0) → "—"(Vue2:45 `sm.net[0].speed || "—"`)', () => {
    expect(systemTiles(u({ cpu: null, mem: null, disk: null, gpu: null, net: null, usb: null }))[2].value).toBe('—')
    expect(systemTiles(u({ cpu: null, mem: null, disk: null, gpu: null, net: [], usb: null }))[2].value).toBe('—')
    expect(systemTiles(u({ cpu: null, mem: null, disk: null, gpu: null, net: [{ speed: 0 }], usb: null }))[2].value).toBe('—')
    // Network tile's sub is always aiSysLan, does not change with data (Vue2:50 literal 'LAN')
    expect(systemTiles(u({ cpu: null, mem: null, disk: null, gpu: null, net: null, usb: null }))[2].subKey).toBe('aiSysLan')
  })

  it('cpu.temperature absent → "—"; Temp tile\'s sub is always aiSysCpu (Vue2:51 literal "CPU")', () => {
    const tiles = systemTiles({ cpu: {}, mem: null, disk: null, gpu: null, net: null, usb: null })
    expect(tiles[3].value).toBe('—')
    expect(tiles[3].subKey).toBe('aiSysCpu')
  })
})
