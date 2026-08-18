import { ref } from 'vue'
import type { Ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

// KVM global settings data layer. GET /kvm/settings single-layer envelope (shared package kvmUnwrap
// already unwrapped), one request split into "read-only host specs" (host) and "writable global settings"
// (settings) halves — both are different field subsets of same backend object, not two requests. This
// composable not only consumed by Task 2 (global settings dialog) itself, but also foundation for
// Task 7 (create dialog defaults/host specs display) and Task 9 (VM settings dialog), return signature
// must be character-for-character match with brief's Interfaces block.
//
// Follow Vue2 KVMFullPage.vue showGlobalSettings (:1075-1088)/saveGlobalSettings (:1090-1106).

export interface KvmHostReadonly {
  cpuCores: number
  availableMemoryMB: number
  availableDiskGB: number
  networkInterfaces: string[]
  defaultDiskSize: number
}

export interface KvmWritableSettings {
  storagePath: string
  defaultVcpu: number
  defaultMemory: number
  autostart: boolean
}

export function useKvmHostInfo() {
  // Authorized deviation (spec §12 #6, declared): Vue2 hostInfo initial value is hardcoded fake
  // (cpuCores:16 / availableMemoryMB:11673 / availableDiskGB:959, KVMFullPage.vue:619-627) —
  // residual from placeholder writing back then, causes CPU core grid to flash 16 then change to
  // real 6 on first frame (device 2026-08-03 testing showed cpuCores actually 6). Changed to all
  // 0/[] here — before fetch completes, renders "0 cores" not flashing fake number, safer for
  // consumers (Task 7/9).
  const host: Ref<KvmHostReadonly> = ref({
    cpuCores: 0,
    availableMemoryMB: 0,
    availableDiskGB: 0,
    networkInterfaces: [],
    defaultDiskSize: 0,
  })

  const settings: Ref<KvmWritableSettings> = ref({
    storagePath: '',
    defaultVcpu: 0,
    defaultMemory: 0,
    autostart: false,
  })

  const loaded = ref(false)

  // In-place stale guard (hard constraint 5: don't extract common guard tool). dispose() sets false,
  // after fetch await check alive before writing ref — responses arriving after unmount don't pollute
  // view state that no longer exists. save() doesn't write any shared ref, doesn't need this guard,
  // see top comment of that function (review Important #3).
  let alive = true

  async function fetch(): Promise<void> {
    // Follow Vue2's showGlobalSettings (:1077-1087) .catch(() => {}): swallow error, don't write
    // lastError, don't change loaded (stays false).
    try {
      const res = await service.kvm.getSettings()
      if (!alive) return // stale guard: component unmounted, this late response doesn't write state
      host.value = {
        cpuCores: res.cpuCores,
        availableMemoryMB: res.availableMemoryMB,
        availableDiskGB: res.availableDiskGB,
        networkInterfaces: res.networkInterfaces,
        defaultDiskSize: res.defaultDiskSize,
      }
      settings.value = {
        storagePath: res.storagePath,
        defaultVcpu: res.defaultVcpu,
        defaultMemory: res.defaultMemory,
        autostart: res.autostart,
      }
      loaded.value = true
    } catch {
      // Swallow error, don't write any state — loaded stays false, host/settings keep previous (or initial) value.
    }
  }

  // Return value ('' = success, non-empty = this call's failure text): follow established contract
  // per P5 ejectInstallMedia, avoid caller reading shared lastError causing crosstalk (this composable
  // currently has one consumer, but unified contract better aids Task 7/9 reusing same pattern).
  // Failure text prioritizes backend Error.message original (hard constraint 7), empty falls back to
  // i18n key name, caller's te()/t() decides.
  //
  // Review fix (Important #3): save() doesn't write any shared ref itself (doesn't touch
  // host/settings/loaded, just sends request, returns result as string), so it doesn't need stale guard —
  // previously both branches had `if (!alive) return ''`, mixing "component unmounted" with "this call
  // really failed" into same '', equivalent to lying that failure branch succeeded. Guard belongs to
  // **caller** deciding whether to adopt return value (see `if (!alive) return` check in
  // KvmGlobalSettingsDialog.onSave), not save()'s responsibility — it just honestly returns true result.
  async function save(next: KvmWritableSettings): Promise<string> {
    try {
      await service.kvm.updateSettings({
        storagePath: next.storagePath,
        defaultVcpu: next.defaultVcpu,
        defaultMemory: next.defaultMemory,
        autostart: next.autostart,
      })
      return ''
    } catch (e) {
      return (e instanceof Error && e.message) || 'kvmFailedToSaveSettings'
    }
  }

  function dispose(): void {
    alive = false
  }

  return { host, settings, loaded, fetch, save, dispose }
}
