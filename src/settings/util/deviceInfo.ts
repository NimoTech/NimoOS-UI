import type { HardwareInfo } from '@nimotech/nimoos-service'

/**
 * Maps to Vue2 DeviceInfoPanel.vue's computed block (L~100-140).
 * Extracted as pure functions so these conversions can be unit-tested -- in Vue2 they
 * are mixed into the component and untestable.
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
    // hardware_name is an empty string on this machine (verified) -> must fall back to hardware_id
    platform: s(hw?.hardware_name) || s(hw?.hardware_id) || DASH,
    deviceId: s(deviceId) || DASH,
    // Empty string is returned as-is; the template decides to show the "detecting" placeholder
    cpuModel: s(hw?.cpu_model),
    cpuCores: cores,
    cpuFreq: mhz === 0 ? DASH : mhz >= 1000 ? `~${(mhz / 1000).toFixed(1)} GHz` : `${mhz} MHz`,
    // Vue2 is literally cores*2 -- not a real hyperthread count read; kept 1:1
    cpuThreads: cores * 2,
    ramDetail: `RAM ${(ram / (1024 * 1024 * 1024)).toFixed(0)} GB total`,
    ramFreq: s(hw?.ram_speed) || DASH,
    ramType: s(hw?.ram_type) || DASH,
    gpuList: Array.isArray(hw?.gpu_list) ? (hw.gpu_list as string[]) : [],
  }
}

/** Vue2 SettingsPanel.vue:90 / :254 -- `v{hardwareInfo.version || '1.0.0'}` */
export function osVersionLabel(hw: HardwareInfo | null): string {
  return s(hw?.version) || '1.0.0'
}
