import { describe, it, expect } from 'vitest'
import type { HardwareInfo } from '@nimotech/nimoos-service'
import { toDeviceInfoView, osVersionLabel } from './deviceInfo'

// Verified via curl 2026-07-31 GET /v1/sys/hardware (real values from this machine; note hardware_name and drive_model are both empty strings)
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

describe('toDeviceInfoView (matches DeviceInfoPanel.vue computed properties line by line)', () => {
  it('platform: hardware_name takes priority, falls back to hardware_id when empty', () => {
    expect(toDeviceInfoView(HW, 'dc1').platform).toBe('nimoos-standard-v1')
    expect(toDeviceInfoView({ ...HW, hardware_name: 'ZimaCube Pro' }, 'dc1').platform).toBe('ZimaCube Pro')
  })

  it('gives --- when both are empty', () => {
    expect(toDeviceInfoView({ ...HW, hardware_name: '', hardware_id: '' }, 'dc1').platform).toBe('---')
  })

  it('deviceId gives --- when missing', () => {
    expect(toDeviceInfoView(HW, null).deviceId).toBe('---')
    expect(toDeviceInfoView(HW, '').deviceId).toBe('---')
    expect(toDeviceInfoView(HW, '2389ab5a').deviceId).toBe('2389ab5a')
  })

  it('cpuFreq: >=1000MHz converts to ~x.x GHz', () => {
    expect(toDeviceInfoView(HW, 'd').cpuFreq).toBe('~4.6 GHz')
  })

  it('cpuFreq: <1000MHz stays in MHz', () => {
    expect(toDeviceInfoView({ ...HW, cpu_freq: 800 }, 'd').cpuFreq).toBe('800 MHz')
  })

  it('cpuFreq: 0 or missing gives ---', () => {
    expect(toDeviceInfoView({ ...HW, cpu_freq: 0 }, 'd').cpuFreq).toBe('---')
    expect(toDeviceInfoView({ ...HW, cpu_freq: undefined }, 'd').cpuFreq).toBe('---')
  })

  it('cpuThreads = core count × 2 (that is how Vue2 calculated it, not an actual hyperthread read)', () => {
    expect(toDeviceInfoView(HW, 'd').cpuThreads).toBe(12)
    expect(toDeviceInfoView({ ...HW, cpu_cores: undefined }, 'd').cpuThreads).toBe(0)
  })

  // The pure function returns the empty string as-is; the "detecting" placeholder copy
  // is filled in by the template via i18n (placeholder rendering is covered by
  // DeviceInfoDialog.test.ts, not asserted here)
  it('cpuModel returns the empty string as-is when missing, without inserting placeholder copy', () => {
    expect(toDeviceInfoView({ ...HW, cpu_model: '' }, 'd').cpuModel).toBe('')
    expect(toDeviceInfoView({ ...HW, cpu_model: undefined }, 'd').cpuModel).toBe('')
  })

  it('ramDetail rounds to whole GiB', () => {
    expect(toDeviceInfoView(HW, 'd').ramDetail).toBe('RAM 15 GB total')
  })

  it('ramDetail gives 0 GB when ram_total is missing (does not produce NaN)', () => {
    expect(toDeviceInfoView({ ...HW, ram_total: undefined }, 'd').ramDetail).toBe('RAM 0 GB total')
  })

  it('ramFreq / ramType give --- when missing', () => {
    const v = toDeviceInfoView({ ...HW, ram_speed: '', ram_type: undefined }, 'd')
    expect(v.ramFreq).toBe('---')
    expect(v.ramType).toBe('---')
  })

  it('gpuList gives an empty array when missing', () => {
    expect(toDeviceInfoView({ ...HW, gpu_list: undefined }, 'd').gpuList).toEqual([])
    expect(toDeviceInfoView(HW, 'd').gpuList).toHaveLength(1)
  })

  it('all fields have a safe placeholder without throwing when hw is null (not loaded yet)', () => {
    const v = toDeviceInfoView(null, null)
    expect(v.platform).toBe('---')
    expect(v.cpuCores).toBe(0)
    expect(v.gpuList).toEqual([])
  })
})

describe('osVersionLabel', () => {
  it('uses hardware.version', () => {
    expect(osVersionLabel(HW)).toBe('1.9.3-alpha1+25.gc8d7d14-dirty')
  })
  it('falls back to 1.0.0 when missing (matches Vue2 SettingsPanel.vue:90)', () => {
    expect(osVersionLabel({ ...HW, version: '' })).toBe('1.0.0')
    expect(osVersionLabel(null)).toBe('1.0.0')
  })
})
