import type { KvmVM } from '@nimotech/nimoos-service'

// Power action availability derivatives. Exactly matching Vue2 components/KVM/KVMFullPage.vue:674-706
// computed (canEditSettings/canWakeUp/canPowerOn/canShutDown/canRestart/canPause/canResume/
// canDelete/showDeleteDivider).
// Extracted as pure functions (Vue2 are computed properties bound to selectedVM)—behavior identical,
// but testable in isolation, and list items and menus can share the same set of rules.
type MaybeVM = Pick<KvmVM, 'state'> | null | undefined

const is = (vm: MaybeVM, ...states: string[]) => !!vm && states.includes(vm.state)

export const canPowerOn = (vm: MaybeVM) => is(vm, 'stopped', 'crashed')
export const canShutDown = (vm: MaybeVM) => is(vm, 'running')
export const canRestart = (vm: MaybeVM) => is(vm, 'running', 'paused')
export const canPause = (vm: MaybeVM) => is(vm, 'running')
export const canResume = (vm: MaybeVM) => is(vm, 'paused')
export const canWakeUp = (vm: MaybeVM) => is(vm, 'suspended')
export const canDelete = (vm: MaybeVM) => is(vm, 'stopped', 'crashed', 'missing')
/** Settings can only be changed when powered off (Vue2 canEditSettings). Settings button is always disabled in P5, this derivative is reserved for P6. */
export const canEditSettings = (vm: MaybeVM) => is(vm, 'stopped', 'crashed')

/** Whether to draw a divider line above the delete item: draw only when can delete and there's at least one power action above. */
export const showDeleteDivider = (vm: MaybeVM) =>
  canDelete(vm) &&
  (canPowerOn(vm) || canShutDown(vm) || canRestart(vm) || canPause(vm) || canResume(vm) || canWakeUp(vm))

// Vue2's getStateLabel(KVMFullPage.vue:1628) only maps these five, crashed / missing fall to the
// `|| state` branch to display the original backend text directly. Copied verbatim—don't add extra
// mappings on my own initiative (UI 1:1).
const LABEL: Record<string, string> = {
  running: 'kvmStateRunning',
  stopped: 'kvmStateStopped',
  paused: 'kvmStatePaused',
  suspended: 'kvmStateSuspended',
  error: 'kvmStateError',
}

/** Returns i18n key; unknown states return original state string, callers decide whether to call t() after checking with te(). */
export const stateLabelKey = (state: string) => LABEL[state] ?? state

/** Whether the SPICE hint bar should show virtio-win hint (otherwise show spice-vdagent hint).
 * Following Vue2 isWindowsGuest computed (KVMFullPage.vue:711-714): `os` contains 'win'
 * (case-insensitive). ⚠️ Difference from Vue2 (not a new deviation this time, but an inevitable
 * result determined by type shape, verified and registered at T0): Vue2 that computed also checked
 * an additional `selectedVM.osType` field as fallback (`os.toLowerCase().includes('win') ||
 * osType.toLowerCase().includes('win')`). New-UI's KvmVM type (kvm.d.ts) only has `os` one field—
 * the backend Go struct field name is OSType, but the json tag is `os`, after serialization there's
 * only one key, Vue2 checking two fields is checking two possible names of the same data, here one
 * field covers all information sources, not a missed check. */
export const isWindowsGuest = (vm: Pick<KvmVM, 'os'> | null | undefined): boolean =>
  !!vm && vm.os.toLowerCase().includes('win')
