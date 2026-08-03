import { describe, it, expect } from 'vitest'
import type { HardwareInfo } from '@nimotech/nimoos-service'
import { toDeviceInfoView, osVersionLabel } from './deviceInfo'

// curl 实证 2026-07-31 GET /v1/sys/hardware(本机真实值,注意 hardware_name 与 drive_model 都是空串)
const HW: HardwareInfo = {
  arch: 'amd64',
  cpu_cores: 6,
  cpu_freq: 4600,
  cpu_model: 'Intel(R) Core(TM) 5 320',
  drive_model: '',
  gpu_list: ['Intel Corporation Wildcat Lake [Intel Graphics] (rev 01)'],
  hardware_id: 'nimoos-standard-v1',
  hardware_name: '',
  ram_speed: '8533 MT/s',
  ram_total: 16335863808,
  ram_type: 'LPDDR5',
  version: '1.9.3-alpha1+25.gc8d7d14-dirty',
}

describe('toDeviceInfoView(逐条对位 DeviceInfoPanel.vue 的 computed)', () => {
  it('platform:hardware_name 优先,空串回退 hardware_id', () => {
    expect(toDeviceInfoView(HW, 'dc1').platform).toBe('nimoos-standard-v1')
    expect(toDeviceInfoView({ ...HW, hardware_name: 'ZimaCube Pro' }, 'dc1').platform).toBe('ZimaCube Pro')
  })

  it('两者都空时给 ---', () => {
    expect(toDeviceInfoView({ ...HW, hardware_name: '', hardware_id: '' }, 'dc1').platform).toBe('---')
  })

  it('deviceId 缺失给 ---', () => {
    expect(toDeviceInfoView(HW, null).deviceId).toBe('---')
    expect(toDeviceInfoView(HW, '').deviceId).toBe('---')
    expect(toDeviceInfoView(HW, '2389ab5a').deviceId).toBe('2389ab5a')
  })

  it('cpuFreq:>=1000MHz 换算成 ~x.x GHz', () => {
    expect(toDeviceInfoView(HW, 'd').cpuFreq).toBe('~4.6 GHz')
  })

  it('cpuFreq:<1000MHz 保留 MHz', () => {
    expect(toDeviceInfoView({ ...HW, cpu_freq: 800 }, 'd').cpuFreq).toBe('800 MHz')
  })

  it('cpuFreq:0 或缺失给 ---', () => {
    expect(toDeviceInfoView({ ...HW, cpu_freq: 0 }, 'd').cpuFreq).toBe('---')
    expect(toDeviceInfoView({ ...HW, cpu_freq: undefined }, 'd').cpuFreq).toBe('---')
  })

  it('cpuThreads = 核数 × 2(Vue2 就是这么算的,不是真的读超线程)', () => {
    expect(toDeviceInfoView(HW, 'd').cpuThreads).toBe(12)
    expect(toDeviceInfoView({ ...HW, cpu_cores: undefined }, 'd').cpuThreads).toBe(0)
  })

  // 纯函数如实返回空串,「检测中」占位文案由模板用 i18n 补
  // (占位渲染由 DeviceInfoDialog.test.ts 覆盖,不在这里断言)
  it('cpuModel 缺失时如实返回空串,不自己塞占位文案', () => {
    expect(toDeviceInfoView({ ...HW, cpu_model: '' }, 'd').cpuModel).toBe('')
    expect(toDeviceInfoView({ ...HW, cpu_model: undefined }, 'd').cpuModel).toBe('')
  })

  it('ramDetail 按 GiB 取整', () => {
    expect(toDeviceInfoView(HW, 'd').ramDetail).toBe('RAM 15 GB total')
  })

  it('ramDetail 在 ram_total 缺失时给 0 GB(不产出 NaN)', () => {
    expect(toDeviceInfoView({ ...HW, ram_total: undefined }, 'd').ramDetail).toBe('RAM 0 GB total')
  })

  it('ramFreq / ramType 缺失给 ---', () => {
    const v = toDeviceInfoView({ ...HW, ram_speed: '', ram_type: undefined }, 'd')
    expect(v.ramFreq).toBe('---')
    expect(v.ramType).toBe('---')
  })

  it('gpuList 缺失给空数组', () => {
    expect(toDeviceInfoView({ ...HW, gpu_list: undefined }, 'd').gpuList).toEqual([])
    expect(toDeviceInfoView(HW, 'd').gpuList).toHaveLength(1)
  })

  it('hw 为 null(还没加载出来)时全字段都有安全占位,不抛', () => {
    const v = toDeviceInfoView(null, null)
    expect(v.platform).toBe('---')
    expect(v.cpuCores).toBe(0)
    expect(v.gpuList).toEqual([])
  })
})

describe('osVersionLabel', () => {
  it('用 hardware.version', () => {
    expect(osVersionLabel(HW)).toBe('1.9.3-alpha1+25.gc8d7d14-dirty')
  })
  it('缺失时回退 1.0.0(Vue2 SettingsPanel.vue:90 的写法)', () => {
    expect(osVersionLabel({ ...HW, version: '' })).toBe('1.0.0')
    expect(osVersionLabel(null)).toBe('1.0.0')
  })
})
