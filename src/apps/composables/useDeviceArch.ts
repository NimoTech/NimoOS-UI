import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

// 模块级单例:全应用一份;localStorage 'arch' 与 Vue2 同 key(同源共享缓存,AppPanel.vue:378 同款)
const arch = ref('')
let started = false

export function useDeviceArch(): {
  arch: Ref<string>
  archLabel: ComputedRef<string>
  isCompatible: (architectures?: string[]) => boolean
} {
  if (!started) {
    started = true
    const cached = localStorage.getItem('arch')
    if (cached) {
      arch.value = cached
    } else {
      service.sys
        .hardwareInfo()
        .then((h) => {
          if (typeof h.arch === 'string' && h.arch) {
            arch.value = h.arch
            localStorage.setItem('arch', h.arch)
          }
        })
        .catch((e) => console.warn('[apps] hardwareInfo', e))
    }
  }

  /** Vue2 unuseable 同语义:应用未声明架构 or 本机 arch 未知 → 不禁用(宽容) */
  function isCompatible(architectures?: string[]): boolean {
    if (!arch.value || !Array.isArray(architectures) || !architectures.length) return true
    return architectures.includes(arch.value)
  }

  // Vue2 archTitle 对齐:arm 的用户可见名是 armv7
  const archLabel = computed(() => (arch.value === 'arm' ? 'armv7' : arch.value))

  return { arch, archLabel, isCompatible }
}

export function __resetDeviceArchForTest() {
  arch.value = ''
  started = false
}
