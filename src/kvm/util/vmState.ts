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
