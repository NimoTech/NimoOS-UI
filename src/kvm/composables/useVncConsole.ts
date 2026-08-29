import { ref } from 'vue'
import type { Ref } from 'vue'
import RFB from '@novnc/novnc'
import { service } from '@nimotech/nimoos-service'
import type { KvmVM, KvmVncInfo } from '@nimotech/nimoos-service'

// noVNC console lifecycle. Character-for-character matches the Vue 2 panel's src/components/KVM/KVMFullPage.vue
// disconnectVNC(:944-954)/connectVNC(:956-1018)/toggleModifier(:1020-1029)/
// releaseModifiers(:1031-1040)/sendKey(:1042-1046)/sendCtrlAltDel(:1048-1053)
// (verified 2026-08-02, brief draft line numbers slightly off).
//
// `rfb` is intentionally a bare variable in closure, not wrapped in ref() — same reason as Vue2
// putting rfbInstance outside component data as a module-level plain variable: RFB internally
// holds complex, frequently-changing objects like WebSocket/canvas; no consumer needs it reactive,
// wrapping only makes Vue try deep-proxying internal structure, pure overhead.

type Modifiers = { ctrl: boolean; alt: boolean; shift: boolean; win: boolean }
type SpicePorts = { spicePort: number; spiceTlsPort: number }

const MODIFIER_KEYSYM: Record<keyof Modifiers, number> = {
  ctrl: 0xffe3,
  alt: 0xffe9,
  shift: 0xffe1,
  win: 0xffeb,
}

export function useVncConsole(hostEl: Ref<HTMLElement | null>) {
  const connected = ref(false)
  const errorKey = ref('')
  const modifiers = ref<Modifiers>({ ctrl: false, alt: false, shift: false, win: false })

  let rfb: RFB | null = null
  // Generation counter. Each connect() increments and records myGen; after await, compare if
  // gen is still from this invocation, else discard result.
  //
  // ⚠️ Deviation from Vue2 (SP9-P5 logged): Vue2's connectVNC (:956-1018) connects immediately
  // after /vnc response, with no generation check. On quick VM switch, the earlier request might
  // arrive after the later one, attaching VM A's display to container already switched to B (and
  // B's freshly-built RFB gets overwritten by A's late result). Generation guard added here:
  // stale results discarded entirely, no side effects (no connection, no error, untouched
  // errorKey/connected — those fields belong to "the newer" call at this moment, stale arrivals
  // have no right to override).
  let gen = 0

  let spiceCb: ((vmId: string, ports: SpicePorts) => void) | null = null
  /** Spice ports passed to caller (KvmPage/useVmList) only via this callback, composable doesn't touch vms list
   * — maintains established "data layer managed by data layer" convention (same pattern as useVmList's onVncShouldConnect). */
  function onSpicePorts(cb: (vmId: string, ports: SpicePorts) => void): void {
    spiceCb = cb
  }

  /** Destroy old RFB instance + clear leftover canvas from container, don't touch
   * modifiers/connected/errorKey — corresponds to lines before `new RFB` in Vue2's connectVNC
   * (:995-998). These lines just make room for the "about to build" new connection, not a true
   * disconnect, so not equivalent to the full disconnect() below. */
  function destroyRfb(): void {
    if (rfb) {
      rfb.disconnect()
      rfb = null
    }
    hostEl.value?.querySelectorAll('canvas').forEach((c) => c.remove())
  }

  /** Follow Vue2's releaseModifiers (:1031-1040): send release events for each currently-pressed modifier key. */
  function releaseModifiers(): void {
    if (!rfb) return
    ;(Object.keys(modifiers.value) as (keyof Modifiers)[]).forEach((k) => {
      if (modifiers.value[k]) {
        rfb!.sendKey(MODIFIER_KEYSYM[k], null, false)
        modifiers.value[k] = false
      }
    })
  }

  /** Follow Vue2's disconnectVNC (:944-954): release modifiers first (else they stay pressed),
   * then destroy connection.
   *
   * ⚠️ Deviation from Vue2 (SP9-P5 logged, generation guard extension): also advance gen here.
   * Vue2 has no generation concept; disconnectVNC just cleans up "already established"
   * connections. But here disconnect() is called externally too (VM stop event, component
   * unmount's dispose()), and if a connect() is mid-await-getVNC() at that moment, without
   * advancing gen it will see gen unchanged later, thinking it's "still the latest", reattaching
   * display after user explicitly requested disconnect. Advancing gen makes late-arriving
   * connect() get discarded at guard inside connect() below. */
  function disconnect(): void {
    releaseModifiers()
    gen += 1
    destroyRfb()
    connected.value = false
    errorKey.value = ''
  }

  async function connect(vm: KvmVM): Promise<void> {
    // 1: If not running state, disconnect and return directly (Vue2 :960-963).
    if (vm.state !== 'running') {
      disconnect()
      return
    }

    // 2: Increment generation, record this call's unique generation number.
    const myGen = ++gen
    errorKey.value = '' // Vue2 :965

    let info: KvmVncInfo
    try {
      // 3
      info = await service.kvm.getVNC(vm.id)
    } catch {
      // Late-arriving failure shouldn't override state written by later caller (same generation guard logic).
      if (myGen !== gen) return
      disconnect()
      errorKey.value = 'kvmVncFetchFailed'
      return
    }

    // 4: Generation guard — see top of file comment, necessary fix for Vue2 bug.
    if (myGen !== gen) return

    // 5: Pass spice ports only via callback, don't directly modify vms list here (brief contract).
    spiceCb?.(vm.id, { spicePort: info.spicePort, spiceTlsPort: info.spiceTlsPort })

    // 6: Brief draft said `wsPort ?? vncPort`, but backend returns 0 (not null/undefined) when
    // vncWebsocketPort missing, and ?? won't fallback from 0, producing `ws://host:0`. Following
    // Vue2 original (:991-993 ternary, truthy check) use `||`, 0 correctly yields to vncPort.
    const wsPort = info.vncWebsocketPort
    const vncPort = info.vncPort
    if (!wsPort && !vncPort) {
      disconnect()
      errorKey.value = 'kvmVncPortUnavailable'
      return
    }

    // 7: ⚠️ Browser connects directly to host port, not via gateway, no auth (local ws port is 5700).
    const wsUrl = `ws://${window.location.hostname}:${wsPort || vncPort}`

    // 8: Destroy old RFB + clear leftover canvas, then build new connection (Vue2 :995-1004).
    destroyRfb()
    const host = hostEl.value
    if (!host) {
      // Review Minor: normal flow has ConsoleStage already mounted, this branch shouldn't trigger
      // in theory — but if it does, old connection is already destroyed by destroyRfb() above,
      // and silent failure means "silent disconnect, no explanation". Add warn so at least we
      // can see the reason during troubleshooting (don't write to errorKey, this isn't a user-facing
      // error they can understand/handle via UI copy, it's front-end mounting timing issue).
      console.warn('[KVM] connect(): host element missing, skip RFB construction')
      return
    }

    // Review Important #1: Vue2's connectVNC (:999-1013) wraps `new RFB(...)` + both
    // addEventListeners in try/catch, on failure sets `this.vncError = e.message`. Missing this
    // layer was undeclared deviation — on HTTPS pages `new WebSocket('ws://…')` throws
    // SecurityError **synchronously** (mixed content policy), invalid URLs same. Without try/catch,
    // this connect() caller (both places in KvmPage are `void vnc.connect(...)`, no one catches
    // rejection) gets an unhandled promise rejection, user sees blank placeholder, no clues.
    // Add per Vue2.
    //
    // errorKey here holds **raw exception message** (e.message), not i18n key — ConsoleStage
    // render uses `te(errorKey) ? t(errorKey) : errorKey`, te() naturally returns false for any
    // illegal key string, raw exception displays as-is, won't be misinterpreted as key name.
    try {
      rfb = new RFB(host, wsUrl)

      // Declared deviation (user decision after 2026-08-03 device acceptance, both rules at once) —
      //
      // ⚠️ Key premise: RFB constructor **only reads** credentials / shared / repeaterID / wsProtocols
      // (:core/rfb.js:28-32), silently ignores everything else; scaleViewport / resizeSession /
      // showDotCursor are all accessor properties that only work post-construction (:345-371),
      // default all false (:299-302). Vue2 (:1001-1004) passed scaleViewport:true / resizeSession:false
      // in constructor params, so **these never worked in old UI**. Probe (real noVNC to real device
      // port 5700): following Vue2's approach, scaleViewport stays false after connection, canvas
      // style.cursor stays "none". So don't pass the options object that gets ignored, assign each
      // post-construction instead.
      //
      // ① Cursor: when guest doesn't send cursor image (QEMU + Alpine text console does),
      //    noVNC at connection moment (:577-578, calls _refreshCursor right after attach) updates
      //    with empty image, takes w/h===0 branch in core/util/cursor.js:80 → clear() → writes
      //    inline `cursor: none` to canvas, disappears when mouse enters black frame, hard to aim
      //    even 80px right edge for toolbar. Setting true makes noVNC draw a small dot; when guest
      //    draws its own, _shouldShowDotCursor() (:3033) returns false, uses guest's, no double
      //    cursor.
      // ② Scale: Vue2 passing true meant scaling to fit window (just didn't work), making it really
      //    work here so high-res guest display doesn't overflow frame showing only top-left corner.
      // ③ resizeSession explicitly set false: consistent with Vue2 intent (don't require guest
      //    resolution change), value itself is noVNC default, writing it out for all three switches
      //    visible together.
      rfb.showDotCursor = true
      rfb.scaleViewport = true
      rfb.resizeSession = false

      // 9: Add event listeners for connection state
      rfb.addEventListener('connect', () => { connected.value = true })
      rfb.addEventListener('disconnect', () => { connected.value = false })
    } catch (e) {
      rfb = null
      errorKey.value = e instanceof Error ? e.message : String(e)
    }
  }

  /** Follow Vue2's toggleModifier (:1020-1029). */
  function toggleModifier(name: keyof Modifiers): void {
    if (!rfb) return
    const next = !modifiers.value[name]
    rfb.sendKey(MODIFIER_KEYSYM[name], null, next)
    modifiers.value[name] = next
  }

  /** Follow Vue2's sendKey (:1042-1046): swallow RFB exceptions, only warn, don't bubble. */
  function sendKey(keysym: number): void {
    if (!rfb) return
    try {
      rfb.sendKey(keysym, null)
    } catch (e) {
      console.warn('[KVM] sendKey failed:', e)
    }
  }

  /** Follow Vue2's sendCtrlAltDel (:1048-1053): clear all modifier state first, then call dedicated method. */
  function sendCtrlAltDel(): void {
    if (!rfb) return
    modifiers.value = { ctrl: false, alt: false, shift: false, win: false }
    try {
      rfb.sendCtrlAltDel()
    } catch (e) {
      console.warn('[KVM] sendCtrlAltDel failed:', e)
    }
  }

  function dispose(): void {
    disconnect()
  }

  return {
    connected,
    errorKey,
    modifiers,
    connect,
    disconnect,
    toggleModifier,
    sendKey,
    sendCtrlAltDel,
    onSpicePorts,
    dispose,
  }
}
