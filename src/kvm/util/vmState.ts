import type { KvmVM } from '@nimotech/nimoos-service'

// 电源动作可用性派生。逐字对 Vue2 components/KVM/KVMFullPage.vue:674-706 的 computed
// (canEditSettings/canWakeUp/canPowerOn/canShutDown/canRestart/canPause/canResume/
// canDelete/showDeleteDivider)。
// 抽成纯函数(Vue2 是绑在 selectedVM 上的 computed)—— 行为一致,但能单测,且列表项
// 与菜单可以共用同一套判定。
type MaybeVM = Pick<KvmVM, 'state'> | null | undefined

const is = (vm: MaybeVM, ...states: string[]) => !!vm && states.includes(vm.state)

export const canPowerOn = (vm: MaybeVM) => is(vm, 'stopped', 'crashed')
export const canShutDown = (vm: MaybeVM) => is(vm, 'running')
export const canRestart = (vm: MaybeVM) => is(vm, 'running', 'paused')
export const canPause = (vm: MaybeVM) => is(vm, 'running')
export const canResume = (vm: MaybeVM) => is(vm, 'paused')
export const canWakeUp = (vm: MaybeVM) => is(vm, 'suspended')
export const canDelete = (vm: MaybeVM) => is(vm, 'stopped', 'crashed', 'missing')
/** 设置只能在关机态改(Vue2 canEditSettings)。P5 里 Settings 按钮恒禁用,这个派生留给 P6。 */
export const canEditSettings = (vm: MaybeVM) => is(vm, 'stopped', 'crashed')

/** 删除项上方要不要画分隔线:能删、且上面至少还有一个电源项时才画。 */
export const showDeleteDivider = (vm: MaybeVM) =>
  canDelete(vm) &&
  (canPowerOn(vm) || canShutDown(vm) || canRestart(vm) || canPause(vm) || canResume(vm) || canWakeUp(vm))

// Vue2 getStateLabel(KVMFullPage.vue:1628)只映射这五个,crashed / missing 落到 `|| state`
// 分支直接显示后端原文。照抄——不自作主张补映射(界面 1:1)。
const LABEL: Record<string, string> = {
  running: 'kvmStateRunning',
  stopped: 'kvmStateStopped',
  paused: 'kvmStatePaused',
  suspended: 'kvmStateSuspended',
  error: 'kvmStateError',
}

/** 返回 i18n key;未知状态返回原始 state 字符串,调用处用 te() 判断后决定是否 t()。 */
export const stateLabelKey = (state: string) => LABEL[state] ?? state

/** SPICE 提示条要不要显示 virtio-win 提示(否则显示 spice-vdagent 提示)。照 Vue2
 * isWindowsGuest computed(KVMFullPage.vue:711-714):`os` 含 'win'(大小写不敏感)。
 * ⚠️ 与 Vue2 的差异(非本次新造偏离,是类型形状决定的必然结果,T0 已核实登记):Vue2
 * 那条 computed 还多查了一个 `selectedVM.osType` 字段作为兜底(`os.toLowerCase().includes('win')
 * || osType.toLowerCase().includes('win')`)。New-UI 的 KvmVM 类型(kvm.d.ts)只有 `os`
 * 一个字段——后端 Go 结构体字段名是 OSType,但 json tag 就是 `os`,序列化后本来就只有
 * 一个 key,Vue2 查两个字段查的是同一份数据的两种可能命名,这里一个字段就覆盖了全部
 * 信息来源,不是漏查。 */
export const isWindowsGuest = (vm: Pick<KvmVM, 'os'> | null | undefined): boolean =>
  !!vm && vm.os.toLowerCase().includes('win')
