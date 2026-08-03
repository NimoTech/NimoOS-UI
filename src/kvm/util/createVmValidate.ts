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

/** 创建 VM 表单校验。逐条对 Vue2 KVMFullPage.vue:createVM(:1451-1472),校验顺序
 * 照抄:名字 → OS → 磁盘下限 → 内存下限 → 磁盘上限 → 内存上限 → vCPU 上限。
 * 返回 ''=通过(实为 null)· 否则 { key, arg },key 是 i18n 键,arg 拼在文案后面
 * (照 Vue2 `${$t('Disk size must be at least')} ${os.minDisk} GB` 的拼法)。
 *
 * 偏离登记(改正确,非照抄 bug):磁盘下限 Vue2 只判 `os.minDisk`(:1458)。真机
 * alpine-319.minDisk=2,但后端 NimoOS-KVM/service/vm_service.go:286-310 硬性要求
 * disk>=8——Vue2 会放行一个后端必拒的值(用户点创建后端 400,体验是"过了前端校验
 * 还是失败")。这里改成 Math.max(8, os.minDisk),两者取较大值。 */
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

  // 改正确:见函数顶部注释。Vue2 是 `if (os.minDisk && vm.disk < os.minDisk)`。
  const minDisk = Math.max(8, os.minDisk)
  if (form.disk < minDisk) {
    return { key: 'kvmErrDiskMin', arg: `${minDisk} GB` }
  }
  if (os.minMemory && form.memory < os.minMemory) {
    return { key: 'kvmErrMemoryMin', arg: `${os.minMemory} MB` }
  }
  // host 值为 0 表示 GET /settings 还没回来(Task 2 初值 0/[])——真值判断,不拿 0 当上限拒人。
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
