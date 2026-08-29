import type { KvmISO } from '@nimotech/nimoos-service'
import type { KvmHostReadonly } from '../composables/useKvmHostInfo'
import { formatHostMem } from './format'

export interface CreateVmForm {
  name: string
  vcpu: number
  memory: number
  disk: number
  iso: string
  os: string
  osType: string
  networkMode: string
  firmware: string
}

/** Create-VM form validation. Mirrors Vue2 KVMFullPage.vue:createVM (:1451-1472) rule by rule;
 * validation order copied verbatim: name → OS → disk min → memory min → disk max → memory max → vCPU max.
 * Returns null on pass; otherwise { key, arg }, where key is an i18n key and arg is appended
 * after the message (matching Vue2's `${$t('Disk size must be at least')} ${os.minDisk} GB` concatenation).
 *
 * Deviation record (deliberate fix, not a copied bug): for the disk minimum, Vue2 only checks
 * `os.minDisk` (:1458). On a real device alpine-319.minDisk=2, but the backend
 * NimoOS-KVM/service/vm_service.go:286-310 hard-requires disk>=8 — Vue2 would let through a value
 * the backend is guaranteed to reject (user clicks Create, backend returns 400; the experience is
 * "passed frontend validation but still failed"). Changed here to Math.max(8, os.minDisk). */
export function validateCreateVm(
  form: CreateVmForm,
  os: KvmISO | null,
  host: KvmHostReadonly,
): { key: string; arg: string } | null {
  if (!form.name.trim()) {
    return { key: 'kvmErrNoName', arg: '' }
  }
  if (!os) {
    return { key: 'kvmErrNoOs', arg: '' }
  }

  // Deliberate fix: see the comment at the top of this function. Vue2 was `if (os.minDisk && vm.disk < os.minDisk)`.
  const minDisk = Math.max(8, os.minDisk)
  if (form.disk < minDisk) {
    return { key: 'kvmErrDiskMin', arg: `${minDisk} GB` }
  }
  if (os.minMemory && form.memory < os.minMemory) {
    return { key: 'kvmErrMemoryMin', arg: `${os.minMemory} MB` }
  }
  // A host value of 0 means GET /settings has not returned yet (Task 2 initial values 0/[]) — truthiness check; never treat 0 as an upper bound that rejects users.
  if (host.availableDiskGB && form.disk > host.availableDiskGB) {
    return { key: 'kvmErrDiskMax', arg: `${host.availableDiskGB} GB` }
  }
  if (host.availableMemoryMB && form.memory > host.availableMemoryMB) {
    return { key: 'kvmErrMemoryMax', arg: formatHostMem(host.availableMemoryMB) }
  }
  if (host.cpuCores && form.vcpu > host.cpuCores) {
    return { key: 'kvmErrVcpuMax', arg: `${host.cpuCores}` }
  }

  return null
}
