import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { service } from '@nimotech/nimoos-service'
import type { KvmVM, KvmCreateVMRequest, KvmUpdateVMRequest } from '@nimotech/nimoos-service'
import { useMessageBus } from '../../composables/useMessageBus'
import { preserveSpice } from '../util/spicePreserve'

// KVM list data layer. Pure state + data fetching + MessageBus wiring; unrelated to visuals/interactions.
// Maps exactly to the Data Layer + sockets + power-action section of NimoOS-UI/src/components/KVM/KVMFullPage.vue.
// (Line numbers verified against current repo version; line numbers in brief drafts are typically a few lines earlier; comments below use verified line numbers.)

/** Extract error message text from err. Mirrors Vue2 getErrMsg(KVMFullPage.vue:841-844) minus the step to strip the leading `[xxx] ` prefix.
 * Does not apply $t() i18n (that is the view layer's job; here we return the raw text/i18n key, and the caller decides whether to call t()). */
function errText(e: unknown, fallback: string): string {
  const raw = (e instanceof Error && e.message) || fallback
  return raw.replace(/^\[.*?\]\s*/, '')
}

export function useVmList() {
  const vms: Ref<KvmVM[]> = ref([])
  const selectedVM: Ref<KvmVM | null> = ref(null)
  const isLoading = ref(false)
  const processing: Ref<Set<string>> = ref(new Set())
  const lastError = ref('')
  // Re-entrancy guard for ejectInstallMedia itself (review re-review fix; see comment inside ejectInstallMedia below) —
  // Not shared with processing; no reactivity needed (no UI consumes it); purely internal deduplication.
  const ejectingIds = new Set<string>()

  const runningCount: ComputedRef<number> = computed(
    () => vms.value.filter((v) => v.state === 'running').length,
  )

  // Mandatory ② (full-branch final review): coordinates "HTTP response vs kvm:vm_started event" race during restart —
  // see detailed comments in restart() and kvm:vm_started handler below. Not reactive; purely internal coordination.
  // No UI consumption needed; same pattern as ejectingIds (local Set, not extracted to shared guard).
  const restartPending = new Set<string>()

  // SP16 Task 8: restart deliberately hands reconnection to kvm:vm_started — when a VM just reboots, the VNC port
  // is typically not listening yet, so immediate reconnection fails and pins vncError permanently to screen
  // (see complete reasoning in restart() below). But when MessageBus goes offline, that event never arrives,
  // and after disconnect there is no one left to reconnect: console goes black with no UI explanation, users
  // can only guess to re-select the VM. This timer is the floor for that case.
  // It **deliberately does not reconnect** — reconnecting would invite back the failure the event-handoff was meant to avoid — it just reports to the page.
  const RECONNECT_STALL_MS = 20_000
  const stallTimers = new Map<string, ReturnType<typeof setTimeout>>()
  let stalledCb: (() => void) | undefined
  function onVncReconnectStalled(cb: () => void): void { stalledCb = cb }

  function clearStallTimer(id: string): void {
    const t = stallTimers.get(id)
    if (t) { clearTimeout(t); stallTimers.delete(id) }
  }

  // Inline generational guard: increments on each fetchVMs call, checks before write-back if still the latest call.
  // Remembering the lesson "don't extract a shared guard" — write it inline, don't abstract into a helper for reuse.
  let listEpoch = 0
  // fetchVM's own generational guard (review 5.2 addition): same principle, prevents late-arriving detail responses from
  // overwriting data already written when rapidly clicking multiple VMs or clicking the same VM twice. Manages its own segment separate from listEpoch; not merged into a shared guard.
  let vmFetchEpoch = 0
  let alive = true

  function findVm(id: string): KvmVM | undefined {
    return vms.value.find((v) => v.id === id)
  }

  // Single callback slot, not an array — only one consumer (ConsoleStage) for this task (explicit brief requirement).
  let connectCb: ((vm: KvmVM) => void) | null = null
  let disconnectCb: (() => void) | null = null
  function onVncShouldConnect(cb: (vm: KvmVM) => void) { connectCb = cb }
  function onVncShouldDisconnect(cb: () => void) { disconnectCb = cb }

  /** Mirrors Vue2 setVMState(KVMFullPage.vue:936-940): updates both the list item and selectedVM simultaneously.
   * vms holds an array of objects and selectedVM points to the same object reference inside the array, so we must update both vm and
   * selectedVM — they are the same object in most cases, but paths like selectVM detail merging don't guarantee the same reference,
   * so following Vue2's lead, updating both is safer. */
  function setVMState(id: string, state: KvmVM['state']) {
    const vm = findVm(id)
    if (vm) vm.state = state
    if (selectedVM.value?.id === id) selectedVM.value.state = state
  }

  async function fetchVMs(): Promise<void> {
    isLoading.value = true
    const myEpoch = ++listEpoch
    try {
      const res = await service.kvm.getVMList()
      if (!alive || myEpoch !== listEpoch) return // Staleness guard: a later call has already written; discard this late result
      const oldSelected = selectedVM.value
      vms.value = res.data
      if (oldSelected) {
        const fresh = findVm(oldSelected.id)
        selectedVM.value = fresh ? preserveSpice(fresh, oldSelected) : null
        if (fresh && selectedVM.value) {
          // preserveSpice may return a new object; swap it back into the list item to maintain the “same reference” contract.
          const idx = vms.value.findIndex((v) => v.id === fresh.id)
          if (idx !== -1) vms.value[idx] = selectedVM.value
        }
      } else if (vms.value.length > 0) {
        // ⚠️ Deviation from Vue2 (SP9-P5 logged, review verified): Vue2 fetchVMs(:898-899) here
        // calls this.selectVM(this.vms[0]), which triggers another fetchVM→getVM detail request. But the backend
        // ListVMs(NimoOS-KVM vm_service.go:245) and GetVM(:270) both return full model.VM copies with identical field sets —
        // merging does not drop any fields, so a second detail request is purely redundant network traffic.
        // Explicit user selection still follows Vue2's selectVM()→fetchVM() detail merge path (see selectVM below).
        // P5 has no create-wizard branch (:901 showCreateVM); empty list shows empty state; create dialog deferred to P6.
        selectedVM.value = vms.value[0]
      } else {
        selectedVM.value = null
      }
    } catch {
      if (!alive || myEpoch !== listEpoch) return // Staleness guard: a later call has already written; discard this late result
      vms.value = []
    } finally {
      if (alive && myEpoch === listEpoch) isLoading.value = false
    }
  }

  async function fetchVM(id: string): Promise<void> {
    const myVmEpoch = ++vmFetchEpoch
    try {
      const fresh = await service.kvm.getVM(id)
      if (!alive || myVmEpoch !== vmFetchEpoch) return // Staleness guard: a later fetchVM has already written; discard this late result
      const idx = vms.value.findIndex((v) => v.id === id)
      const target = idx !== -1 ? vms.value[idx] : (selectedVM.value?.id === id ? selectedVM.value : null)
      // Mirrors Vue2 fetchVM(:912-913 / :925-926): `Object.keys(fresh).forEach(key => { if
      // (key !== 'id') this.$set(...) })` — overwrites field-by-field but explicitly skips id. Here we likewise preserve
      // the original object's id, updating only fresh's other fields; cannot replace the entire object (else id gets overwritten by fresh.id;
      // fresh.id should theoretically equal the passed-in id, but we cannot assume the caller/backend guarantees consistency).
      const withId: KvmVM = target ? { ...fresh, id: target.id } : fresh
      const merged = preserveSpice(withId, target)
      if (idx !== -1) vms.value[idx] = merged
      if (selectedVM.value?.id === id) selectedVM.value = merged
    } catch (e) {
      // Vue2(:933) on failure only console.warn, does not clear selection or set lastError — preserving original behavior.
      console.warn('[KVM] Failed to refresh VM info:', e)
    }
  }

  async function selectVM(vm: KvmVM): Promise<void> {
    selectedVM.value = vm
    await fetchVM(vm.id)
  }

  // ===================== MessageBus events (mirrors Vue2 sockets:768-829) =====================
  const bus = useMessageBus()
  const unsubs: (() => void)[] = []

  function vmIdOf(props: unknown): string | undefined {
    if (props && typeof props === 'object') {
      const v = (props as Record<string, unknown>).vm_id
      if (typeof v === 'string' && v) return v
    }
    return undefined
  }

  unsubs.push(bus.on('kvm:vm_created', () => { void fetchVMs() }))

  unsubs.push(bus.on('kvm:vm_deleted', (props) => {
    const id = vmIdOf(props)
    if (id) {
      vms.value = vms.value.filter((v) => v.id !== id)
      if (selectedVM.value?.id === id) selectedVM.value = null
    } else {
      void fetchVMs()
    }
  }))

  unsubs.push(bus.on('kvm:vm_started', (props) => {
    const id = vmIdOf(props)
    if (id) {
      setVMState(id, 'running')
      if (selectedVM.value?.id === id) connectCb?.(selectedVM.value)
      // Mandatory ②: this event may signal "restart is complete" or may arrive earlier than the restart's own HTTP
      // response (backend RestartVMWithForce = StopVM+StartVM, each publishes events asynchronously, nearly concurrent with
      // HTTP response, order undefined — see complete explanation in restart() below). Either way,
      // as soon as reconnection succeeds here, clear the restartPending flag: tell restart()'s
      // onSuccess "no need to disconnect again; the screen is already fresh".
      restartPending.delete(id)
      clearStallTimer(id) // Reconnection succeeded; nothing to warn about
    } else {
      void fetchVMs()
    }
  }))

  unsubs.push(bus.on('kvm:vm_stopped', (props) => {
    const id = vmIdOf(props)
    if (id) {
      setVMState(id, 'stopped')
      if (selectedVM.value?.id === id) disconnectCb?.()
    } else {
      void fetchVMs()
    }
  }))

  unsubs.push(bus.on('kvm:vm_paused', (props) => {
    const id = vmIdOf(props)
    if (id) {
      setVMState(id, 'paused')
      if (selectedVM.value?.id === id) disconnectCb?.()
    } else {
      void fetchVMs()
    }
  }))

  unsubs.push(bus.on('kvm:vm_resumed', (props) => {
    const id = vmIdOf(props)
    if (id) {
      setVMState(id, 'running')
      if (selectedVM.value?.id === id) connectCb?.(selectedVM.value)
    } else {
      void fetchVMs()
    }
  }))

  unsubs.push(bus.on('kvm:vm_autostart_changed', () => { void fetchVMs() }))

  function dispose(): void {
    alive = false
    stallTimers.forEach((t) => clearTimeout(t))
    stallTimers.clear()
    unsubs.forEach((off) => off())
    unsubs.length = 0
  }

  // ===================== Power actions =====================
  // Template consistency: processing.add(id) → request → optimistic state change (+ VNC callback) → catch write lastError →
  // finally processing.delete(id). Mirrors Vue2 startVM/stopVM/pauseVM/resumeVM/wakeupVM
  // (KVMFullPage.vue:1530-1607) — toast text is the view layer's job; here we only leave lastError for the parent layer to display.

  // Return value (mandatory ①, full-branch final review addition): true = this call succeeded, false = failed or short-circuited after dispose.
  // Same reasoning as ejectInstallMedia — the caller (KvmPage.vue) needs to know "did this call actually succeed"
  // to decide whether to show a success toast; lastError is a single ref shared by multiple actions, and reading it after await risks
  // "cross-talk" (see comment at top of ejectInstallMedia; review re-review fix). Return value inherently belongs only to
  // "this call" and cannot be polluted by concurrent operations.
  async function runAction(
    vm: KvmVM,
    action: (id: string) => Promise<unknown>,
    onSuccess: (vm: KvmVM) => void,
    failFallback: string,
  ): Promise<boolean> {
    processing.value.add(vm.id)
    try {
      await action(vm.id)
      if (!alive) return false // Results arriving after dispose no longer write state or trigger VNC callbacks (review 3); for unmounted callers this is not "success"
      onSuccess(vm)
      lastError.value = ''
      return true
    } catch (e) {
      if (!alive) return false
      lastError.value = errText(e, failFallback)
      return false
    } finally {
      processing.value.delete(vm.id)
    }
  }

  async function start(vm: KvmVM): Promise<boolean> {
    return runAction(vm, (id) => service.kvm.startVM(id), (v) => {
      setVMState(v.id, 'running')
      if (selectedVM.value?.id === v.id) connectCb?.(selectedVM.value)
    }, 'kvmFailedToStart')
  }

  async function stop(vm: KvmVM): Promise<boolean> {
    return runAction(vm, (id) => service.kvm.stopVM(id), (v) => {
      setVMState(v.id, 'stopped')
      if (selectedVM.value?.id === v.id) disconnectCb?.()
    }, 'kvmFailedToStop')
  }

  async function restart(vm: KvmVM): Promise<boolean> {
    // ⚠️ Deviation from Vue2 (SP9-P5 logged): Vue2 restartVM(:1557-1571) immediately calls
    // disconnectVNC() + connectVNC() after the request returns. A freshly rebooted VM's VNC port is likely not listening yet, connect fails,
    // and vncError gets permanently pinned to the screen with no self-healing. Here we only disconnect; reconnection defers to the kvm:vm_started
    // event fallback (backend definitely sends it, NimoOS-KVM/common/constants.go:17). Visual behavior unchanged, just no longer stuck in error state.
    //
    // ⚠️ Mandatory ② (full-branch final review, 2026-08-02): the deviation above is correct in itself, but the original implementation
    // assumed "HTTP response always arrives before kvm:vm_started event" — that assumption is false. Final review checked the backend:
    // NimoOS-KVM/service/vm_service.go:575-583 RestartVMWithForce = StopVM + StartVM; each calls
    // `go PublishVMEvent`(:566/:535), events and HTTP response emit nearly simultaneously, order undefined.
    // If the event arrives first: the kvm:vm_started handler has already built a new connection with connectCb; if onSuccess here
    // still calls disconnectCb() unconditionally, it tears down the just-built connection — and vm_started fires only once,
    // no future event will trigger reconnection, user sees permanent black screen, can only re-select VM to recover.
    //
    // Fix: use the restartPending Set to coordinate "should this disconnect happen". On entering restart(),
    // record vm.id in it; the kvm:vm_started handler, once it successfully reconnects, removes id from this Set (see
    // that handler's comment). onSuccess disconnects only if vm.id **still** remains in restartPending (meaning the event hasn't arrived,
    // no one reconnected first) — if the event reconnected first, onSuccess here does nothing, preserving the event's
    // connection. Both arrival orders converge to the correct state "finally connected", with no path to tear down the new connection.
    restartPending.add(vm.id)
    try {
      return await runAction(vm, (id) => service.kvm.restartVM(id), (v) => {
        setVMState(v.id, 'running')
        if (restartPending.has(v.id) && selectedVM.value?.id === v.id) {
          disconnectCb?.()
          // Disconnected, and reconnection responsibility fully handed to kvm:vm_started ⇒ start a floor timer.
          clearStallTimer(v.id)
          stallTimers.set(v.id, setTimeout(() => {
            stallTimers.delete(v.id)
            if (alive && selectedVM.value?.id === v.id) stalledCb?.()
          }, RECONNECT_STALL_MS))
        }
      }, 'kvmFailedToRestart')
    } finally {
      restartPending.delete(vm.id)
    }
  }

  async function pause(vm: KvmVM): Promise<boolean> {
    return runAction(vm, (id) => service.kvm.pauseVM(id), (v) => {
      setVMState(v.id, 'paused')
      if (selectedVM.value?.id === v.id) disconnectCb?.()
    }, 'kvmFailedToPause')
  }

  async function resume(vm: KvmVM): Promise<boolean> {
    return runAction(vm, (id) => service.kvm.resumeVM(id), (v) => {
      setVMState(v.id, 'running')
      if (selectedVM.value?.id === v.id) connectCb?.(selectedVM.value)
    }, 'kvmFailedToResume')
  }

  async function wakeup(vm: KvmVM): Promise<boolean> {
    return runAction(vm, (id) => service.kvm.wakeupVM(id), (v) => {
      setVMState(v.id, 'running')
      if (selectedVM.value?.id === v.id) connectCb?.(selectedVM.value)
    }, 'kvmFailedToResume')
  }

  // Return value (mandatory ①, same as runAction): true = success (at this point vm.autostart is already the flipped new value,
  // caller can read vm.autostart directly to decide whether toast says "on" or "off"), false = failed/
  // short-circuited after dispose.
  async function toggleAutostart(vm: KvmVM): Promise<boolean> {
    // ⚠️ Deviation from Vue2 (SP9-P5 logged, review 2): Vue2 toggleAutoStart(:1516-1528) records
    // originalValue first, then writes vm.autostart = newValue(:1522) only after await succeeds, then in catch
    // changes vm.autostart back to originalValue(:1525). But with this write order, the failure branch never writes the new value —
    // vm.autostart is already originalValue, the catch “rollback” is dead code (copying this logic has no observable effect;
    // verified by deleting the test). Following “UI matches Vue2, logic is correct” we keep only the meaningful part:
    // on failure do not write autostart (it is already the original value), only set lastError; no “optimistic write then revert” rollback
    // (that would make the toggle flicker and snap back, a different visible behavior, violating 1:1 UI match).
    processing.value.add(vm.id)
    try {
      const next = !vm.autostart
      await service.kvm.setAutostart(vm.id, next)
      if (!alive) return false // Results arriving after dispose no longer write state (review 3)
      vm.autostart = next
      if (selectedVM.value?.id === vm.id) selectedVM.value.autostart = next
      lastError.value = ''
      return true
    } catch (e) {
      if (!alive) return false
      lastError.value = errText(e, 'kvmFailedToSaveSettings')
      return false
    } finally {
      processing.value.delete(vm.id)
    }
  }

  // Return value (mandatory ①, same as runAction): true = success, false = failed/short-circuited after dispose.
  async function remove(vm: KvmVM): Promise<boolean> {
    // Mirrors Vue2 deleteVM(:1609-1620).
    try {
      await service.kvm.deleteVM(vm.id)
      if (!alive) return false // Results arriving after dispose no longer write state (review 3)
      vms.value = vms.value.filter((v) => v.id !== vm.id)
      if (selectedVM.value?.id === vm.id) selectedVM.value = null
      lastError.value = ''
      return true
    } catch (e) {
      if (!alive) return false
      lastError.value = errText(e, 'kvmFailedToDelete')
      return false
    }
  }

  // Return value: '' = no error (success / re-entrancy blocked / short-circuited after dispose), non-empty = this call's failure message.
  // ⚠️ Review re-review fix (Important #2, 2026-08-02): previously only wrote results to shared `lastError`,
  // caller (KvmPage.vue) read `lastError.value` after await — but `lastError` is a single ref
  // **shared by runAction/toggleAutostart/remove/ejectInstallMedia**. If eject is in flight and user triggers a power action on
  // **a different VM**, and that action happens to resolve and write `lastError` in the microtask gap during this await,
  // eject itself is actually successful but reads an unrelated error — "cross-talk". Fix: return this call's result
  // **directly as the return value**; caller uses the return value, no longer reads shared ref;
  // error inherently belongs only to "this call", cannot be polluted by concurrent operations.
  // Still write `lastError` (consistent with other power actions, for the `consoleErrorKey` fallback display path
  // to consume — that path's semantics unchanged, just no longer the sole source for install-banner error display).
  async function ejectInstallMedia(vm: KvmVM): Promise<string> {
    // Mirrors Vue2 handleInstallationFinished(:862-877): refresh entire list after setBootFromDisk(true).
    // Adds the re-entrancy guard from Vue2 (:862-864) `if (!vm || this.finishingInstall) return` (review 4:
    // initial version omitted it; double-clicking triggers two concurrent setBootFromDisk + two full list refreshes).
    //
    // ⚠️ Review fix: re-entrancy guard **must be independent** from processing; cannot be reused. processing is
    // a state shared by runAction/toggleAutostart/remove, deduplicating only by vm.id. If eject reuses it,
    // two-way problems arise: (1) when a power action is in flight (processing already has this id) and eject is clicked,
    // it gets mislabeled "already in progress" and returns immediately — setBootFromDisk never sends, lastError not written,
    // user sees no response, and the block is cross-action and completely silent; (2) conversely, the power action's
    // finally { processing.value.delete(vm.id) } removes the id prematurely while eject is still in flight,
    // eject's own "in progress" state is cleared too early, re-entrancy guard fails. Vue2's finishingInstall
    // is already an independent flag, not shared with power-action state; here we similarly give eject its own Set.
    //
    // When re-entrancy is blocked, return '' (not an error — this call did nothing, no "error for this call" to speak of;
    // the actual in-flight call will return accurate results when it resolves; caller also has its own ejectBusy
    // guard to prevent actual concurrent invocation of this; this layer is belt-and-suspenders).
    if (ejectingIds.has(vm.id)) return ''
    ejectingIds.add(vm.id)
    try {
      await service.kvm.setBootFromDisk(vm.id, true)
      // Results arriving after dispose no longer write state or trigger full list refresh (review 3). Return '' —
      // component is likely already unmounted, nowhere to display this result, no need to pretend "error" or "no error".
      if (!alive) return ''
      lastError.value = ''
      await fetchVMs()
      return ''
    } catch (e) {
      if (!alive) return '' // Same as above; after dispose, stop worrying "is this actually an error", just short-circuit
      // Review fix (2026-08-02): fallback key changed from 'kvmFailedToEjectMedia' to 'kvmEjectFailed' —
      // translations are already identical (see i18n snippet comment); duplicate key from T3 aligning with the
      // shared "kvmFailedToXxx" naming family used by other power actions. Review required KvmPage to inline-display
      // this error using 'kvmEjectFailed'; switched fallback over too, making 'kvmFailedToEjectMedia' a true dead key,
      // already removed from both i18n snippets (no other references).
      const msg = errText(e, 'kvmEjectFailed')
      lastError.value = msg
      return msg
    } finally {
      ejectingIds.delete(vm.id)
    }
  }

  // P6 Task 8 (create flow wiring): mirrors Vue2 createVM(:1475-1492) success/failure branches — validation itself
  // has moved down inside CreateVmDialog's validateCreateVm (hard constraint 7: dialog inline, not at this layer);
  // here we only handle "send request → refresh list on success → return result".
  //
  // Return value contract ('' = success, non-empty = this call's failure message) mirrors remove/toggleAutostart/
  // ejectInstallMedia superficially, but **deliberately does not write shared `lastError`** — reason same as
  // useKvmHostInfo.save() (review Important #3 comment): create failure should only display in the create
  // dialog's own inline `.cv-error` (CreateVmDialog's submitError prop). If we also write `lastError` here,
  // when user has a VM selected with console normally displayed, opens create dialog, and creation fails,
  // this error unrelated to the console would flow through the `consoleErrorKey` fallback path (KvmPage.vue)
  // into the selected VM's console placeholder — pure visual pollution, not "cross-talk we can't prevent", but
  // something we should never write to shared state in the first place. `alive` guard still needed: after request sends,
  // component may have already dispose (e.g., entire page navigated away during submission), at which point
  // we should not trigger `fetchVMs()` again.
  async function create(payload: KvmCreateVMRequest): Promise<string> {
    try {
      await service.kvm.createVM(payload)
      if (!alive) return ''
      await fetchVMs()
      return ''
    } catch (e) {
      if (!alive) return ''
      return errText(e, 'kvmFailedToCreate')
    }
  }

  // P6 Task 9 (VM settings dialog wiring): mirrors Vue2 saveSettings(:1494-1514) success/failure branches —
  // form validation / networkMode folding has moved down inside VmSettingsDialog (hard constraint 7: dialog inline,
  // not at this layer); here we only handle "send request → write back visible fields on success → return result".
  //
  // Return value contract ('' = success, non-empty = this call's failure message) mirrors create superficially, but
  // **likewise deliberately does not write shared `lastError`** — reason same as create() top comment (review Important #3,
  // same reasoning): save failure should only display in the VM settings dialog's own inline `.cv-error` (submitError prop).
  // If we write `lastError` here too, it flows through consoleErrorKey's fallback path (KvmPage.vue) into
  // the currently selected VM's console placeholder — pure visual pollution, not "cross-talk we can't prevent", but
  // something we should never write to shared state in the first place.
  //
  // On success, Object.assign writes back "visible fields" (following Vue2 saveSettings :1503-1508 field set,
  // **excludes disk** — the disk input in the dialog is already disabled, value doesn't change, Vue2's write-back
  // statement also doesn't include disk). Write pattern follows existing setVMState/toggleAutostart convention: the `vm` parameter,
  // the item with same id in `vms` list, and `selectedVM` are theoretically often the same object reference, but
  // reference identity not guaranteed (see setVMState top comment); updating all three is safer — even if two are coincidentally
  // the same reference, repeated Object.assign is idempotent, no side effects.
  async function update(vm: KvmVM, patch: KvmUpdateVMRequest): Promise<string> {
    try {
      await service.kvm.updateVM(vm.id, patch)
      if (!alive) return '' // Results arriving after dispose no longer write state (existing convention from review 3)
      const visible: Partial<KvmVM> = {
        name: patch.name,
        vcpu: patch.vcpu,
        memory: patch.memory,
        iso: patch.iso,
        bootFromDisk: patch.bootFromDisk,
        firmware: patch.firmware,
        networkMode: patch.networkMode,
        networkInterface: patch.networkInterface,
      }
      Object.assign(vm, visible)
      const inList = findVm(vm.id)
      if (inList && inList !== vm) Object.assign(inList, visible)
      if (selectedVM.value && selectedVM.value.id === vm.id && selectedVM.value !== vm) {
        Object.assign(selectedVM.value, visible)
      }
      return ''
    } catch (e) {
      if (!alive) return ''
      return errText(e, 'kvmFailedToSaveSettings')
    }
  }

  return {
    vms,
    selectedVM,
    isLoading,
    runningCount,
    processing,
    lastError,
    fetchVMs,
    fetchVM,
    selectVM,
    start,
    stop,
    restart,
    pause,
    resume,
    wakeup,
    toggleAutostart,
    remove,
    ejectInstallMedia,
    create,
    update,
    onVncShouldConnect,
    onVncShouldDisconnect,
    onVncReconnectStalled,
    dispose,
  }
}
