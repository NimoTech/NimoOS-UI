import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

// Module-level singleton: one per app; localStorage 'arch' uses the same key as Vue2 (shared cache across origins, same as AppPanel.vue:378)
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

  /** Same semantics as Vue2 isCompatible: if the app declares no architectures or device arch is unknown → allow it (lenient). */
  function isCompatible(architectures?: string[]): boolean {
    if (!arch.value || !Array.isArray(architectures) || !architectures.length) return true
    return architectures.includes(arch.value)
  }

  // Aligned with Vue2 archTitle: arm's user-visible name is armv7
  const archLabel = computed(() => (arch.value === 'arm' ? 'armv7' : arch.value))

  return { arch, archLabel, isCompatible }
}

export function __resetDeviceArchForTest() {
  arch.value = ''
  started = false
}
