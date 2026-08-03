import type { HardwareInfo } from '@nimotech/nimoos-service'

/**
 * 对位 Vue2 DeviceInfoPanel.vue 的 computed 块(L~100-140)。
 * 抽成纯函数是为了能单测这些换算 —— Vue2 那边混在组件里没法测。
 */
export interface DeviceInfoView {
  platform: string
  deviceId: string
  cpuModel: string
  cpuCores: number
  cpuFreq: string
  cpuThreads: number
  ramDetail: string
  ramFreq: string
  ramType: string
  gpuList: string[]
}

const DASH = '---'
const s = (v: unknown): string => (typeof v === 'string' ? v : '')
const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function toDeviceInfoView(hw: HardwareInfo | null, deviceId: string | null): DeviceInfoView {
  const cores = n(hw?.cpu_cores)
  const mhz = n(hw?.cpu_freq)
  const ram = n(hw?.ram_total)
  return {
    // hardware_name 在本机实测是空串 → 必须回退 hardware_id
    platform: s(hw?.hardware_name) || s(hw?.hardware_id) || DASH,
    deviceId: s(deviceId) || DASH,
    // 空串照实返回,由模板决定显示「检测中」占位
    cpuModel: s(hw?.cpu_model),
    cpuCores: cores,
    cpuFreq: mhz === 0 ? DASH : mhz >= 1000 ? `~${(mhz / 1000).toFixed(1)} GHz` : `${mhz} MHz`,
    // Vue2 就是 cores*2 —— 不是真读超线程数,1:1 照留
    cpuThreads: cores * 2,
    ramDetail: `RAM ${(ram / (1024 * 1024 * 1024)).toFixed(0)} GB total`,
    ramFreq: s(hw?.ram_speed) || DASH,
    ramType: s(hw?.ram_type) || DASH,
    gpuList: Array.isArray(hw?.gpu_list) ? (hw.gpu_list as string[]) : [],
  }
}

/** Vue2 SettingsPanel.vue:90 / :254 —— `v{hardwareInfo.version || '1.0.0'}` */
export function osVersionLabel(hw: HardwareInfo | null): string {
  return s(hw?.version) || '1.0.0'
}
