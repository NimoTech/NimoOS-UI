import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { KvmVM } from '@nimotech/nimoos-service'

// ⚠️ Required correction to brief draft (pure vitest mechanism issue, not logic deviation):
// brief's approach was to declare `class FakeRFB {...}` at file top level and reference it
// with `vi.mock` separately. But vi.mock() gets hoisted to the very top of the file by vitest
// (before other imports/top-level statements), and class declarations don't hoist like function
// declarations do — the hoisted vi.mock factory function will try to read the `FakeRFB`
// identifier before the `class FakeRFB` line actually executes, throwing directly:
// "Cannot access 'FakeRFB' before initialization" (verified with the original approach).
// Fix: put both the class and the array for collecting instances into `vi.hoisted()` — its
// callback body is also hoisted, but executes as a single synchronized unit, so there's no
// cross-statement timing issue. Assertions, behavior, and test cases are unchanged.
// Review Important #1 addition: need to allow "constructing RFB" itself to throw
// (simulating real scenarios like `new WebSocket('ws://…')` throwing SecurityError on HTTPS
// pages), so added a controllable exception switch to FakeRFB that "auto-clears after one use",
// also in vi.hoisted() (closure variable, no TDZ issue when constructor references it — the
// actual read happens during test execution, when the module is already fully evaluated).
const { instances, FakeRFB, setRfbConstructError } = vi.hoisted(() => {
  let constructError: Error | null = null
  class FakeRFB {
    handlers: Record<string, (() => void)[]> = {}
    disconnected = false
    // On real RFB these three are **accessor properties that can only be set after
    // construction** (core/rfb.js:345-371); the constructor only recognizes
    // credentials/shared/repeaterID/wsProtocols, ignoring everything else (:28-32). So this
    // stub makes them instance fields too, with defaults matching the real library (:299-302
    // are all false) — this way "passing them in constructor params" (the invalid approach)
    // will be caught by the test — that's what caught us on 2026-08-03 device acceptance.
    showDotCursor = false
    scaleViewport = false
    resizeSession = false
    sent: [number, boolean | null][] = []
    cad = 0
    constructor(public el: unknown, public url: string, public opts: unknown) {
      if (constructError) {
        const e = constructError
        constructError = null // Consume once then clear, don't pollute subsequent tests
        throw e
      }
      instances.push(this)
    }
    addEventListener(ev: string, cb: () => void) { (this.handlers[ev] ||= []).push(cb) }
    fire(ev: string) { (this.handlers[ev] || []).forEach((h) => h()) }
    disconnect() { this.disconnected = true }
    sendKey(k: number, _c: unknown, down: boolean | null = null) { this.sent.push([k, down]) }
    sendCtrlAltDel() { this.cad++ }
  }
  const instances: InstanceType<typeof FakeRFB>[] = []
  return { instances, FakeRFB, setRfbConstructError: (e: Error | null) => { constructError = e } }
})
vi.mock('@novnc/novnc', () => ({ default: FakeRFB }))

const getVNC = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return { getVNC } } } }))

import { useVncConsole } from './useVncConsole'

const VM = (over: Partial<KvmVM> = {}) => ({ id: 'vm-1', state: 'running', ...over } as KvmVM)
const host = () => ref(document.createElement('div'))
// tsconfig lib is ES2020, no Array.prototype.at (same reason as existing code in
// RaidDriveBay.test.ts / RaidMatrix.test.ts), so brief's `.at(-1)` is equivalently replaced here.
const last = <T,>(arr: T[]): T => arr[arr.length - 1]

beforeEach(() => {
  instances.length = 0
  setRfbConstructError(null)
  getVNC.mockReset()
  getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 5700, spicePort: 5901, spiceTlsPort: 0 })
})

describe('connect', () => {
  it('build ws url from vncWebsocketPort, direct connect to location.hostname', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(instances[0].url).toBe(`ws://${window.location.hostname}:5700`)
  })

  // Declared deviation (user decision after 2026-08-03 device acceptance, both rules at once) —
  //
  // ⚠️ Key premise: RFB constructor only reads credentials / shared / repeaterID / wsProtocols
  // (core/rfb.js:28-32), **silently ignores everything else**. scaleViewport / resizeSession /
  // showDotCursor are all accessor properties that only work after construction (:345-371).
  // Vue2 (:1001-1004) passed scaleViewport / resizeSession in constructor params, so **these
  // two never worked in the old UI**; my first fix made the same mistake (passing
  // showDotCursor in constructor), and device retesting still showed no effect. Probe
  // (real noVNC to real device port 5700): following Vue2's approach, scaleViewport stays
  // false after connection.
  //
  // ① showDotCursor: when guest doesn't send cursor image (QEMU + Alpine text console does
  //    this), noVNC at connection moment (:577-578 right after attach, calls _refreshCursor)
  //    uses empty image to update, takes the w/h===0 path in core/util/cursor.js:80 →
  //    clear() → writes inline `cursor: none` to canvas, mouse disappears in black frame.
  //    Setting true makes it draw a small dot; when guest draws its own cursor,
  //    _shouldShowDotCursor() (:3033) returns false, uses guest's cursor, no double cursor.
  // ② scaleViewport: Vue2's intent was to scale to fit the window (it passed true, just
  //    didn't work), now making it really work via property assignment. High-res guest
  //    display scales to fit completely inside frame.
  //
  // These three assertions guard "assign on instance, not in constructor params",
  // don't reflexively change it back.
  it('all three RFB switches assigned to instance after construction (noVNC silently ignores constructor params)', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(instances[0].showDotCursor).toBe(true)
    expect(instances[0].scaleViewport).toBe(true)
    expect(instances[0].resizeSession).toBe(false)
  })

  it('fallback to vncPort when websocket port unavailable', async () => {
    getVNC.mockResolvedValue({ vncPort: 5900, vncWebsocketPort: 0, spicePort: 0, spiceTlsPort: 0 })
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(instances[0].url).toBe(`ws://${window.location.hostname}:5900`)
  })

  it('both ports unavailable → report port unavailable, skip connection', async () => {
    getVNC.mockResolvedValue({ vncPort: 0, vncWebsocketPort: 0, spicePort: 0, spiceTlsPort: 0 })
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(instances).toHaveLength(0)
    expect(c.errorKey.value).toBe('kvmVncPortUnavailable')
  })

  it('getVNC fails → report fetch failed', async () => {
    getVNC.mockRejectedValue(new Error('404'))
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(c.errorKey.value).toBe('kvmVncFetchFailed')
    expect(c.connected.value).toBe(false)
  })

  it('when VM is not running, skip connection', async () => {
    const c = useVncConsole(host())
    await c.connect(VM({ state: 'stopped' }))
    expect(getVNC).not.toHaveBeenCalled()
    expect(instances).toHaveLength(0)
  })

  it('sync connected when RFB fires connect/disconnect events', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    instances[0].fire('connect'); expect(c.connected.value).toBe(true)
    instances[0].fire('disconnect'); expect(c.connected.value).toBe(false)
  })

  it('repeated connect destroys previous RFB first', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    await c.connect(VM())
    expect(instances[0].disconnected).toBe(true)
    expect(instances).toHaveLength(2)
  })

  it('clear leftover canvas elements from container before connecting', async () => {
    const h = host()
    h.value!.appendChild(document.createElement('canvas'))
    const c = useVncConsole(h)
    await c.connect(VM())
    expect(h.value!.querySelectorAll('canvas')).toHaveLength(0)
  })

  it('pass spice ports via callback (composable does not directly modify list)', async () => {
    const c = useVncConsole(host())
    const onSpice = vi.fn()
    c.onSpicePorts(onSpice)
    await c.connect(VM())
    expect(onSpice).toHaveBeenCalledWith('vm-1', { spicePort: 5901, spiceTlsPort: 0 })
  })

  // Review Important #1: Vue2's connectVNC (:999-1013) wraps `new RFB(...)` in try/catch,
  // writes e.message to error state on failure. On HTTPS pages `new WebSocket('ws://…')`
  // throws SecurityError synchronously (mixed content), and the previous version lacked this
  // try/catch layer, turning it into an unhandled rejection, leaving users with a blank
  // placeholder.
  it('when RFB construction throws (e.g. mixed content SecurityError), follow Vue2 and write reason to error state, no blank placeholder', async () => {
    setRfbConstructError(new Error('Mixed Content: The page was loaded over HTTPS...'))
    const c = useVncConsole(host())
    await c.connect(VM())
    expect(c.errorKey.value).toBe('Mixed Content: The page was loaded over HTTPS...')
    expect(c.connected.value).toBe(false)
    expect(instances).toHaveLength(0) // construction threw, no "half-formed" instance left
  })
})

describe('generation guard (fixes Vue2 bug: quick VM switch would attach old VM display to new container)', () => {
  it('late-arriving previous getVNC must not establish connection', async () => {
    let slowResolve: (v: unknown) => void = () => {}
    getVNC
      .mockImplementationOnce(() => new Promise((r) => { slowResolve = r }))
      .mockResolvedValueOnce({ vncPort: 0, vncWebsocketPort: 5701, spicePort: 0, spiceTlsPort: 0 })
    const c = useVncConsole(host())
    const slow = c.connect(VM({ id: 'a' }))
    await c.connect(VM({ id: 'b' }))
    slowResolve({ vncPort: 0, vncWebsocketPort: 5700, spicePort: 0, spiceTlsPort: 0 })
    await slow
    expect(instances).toHaveLength(1)
    expect(instances[0].url).toContain('5701')     // Only the later call takes effect
  })

  it('late-arriving getVNC after dispose does not establish connection', async () => {
    let r: (v: unknown) => void = () => {}
    getVNC.mockImplementationOnce(() => new Promise((x) => { r = x }))
    const c = useVncConsole(host())
    const p = c.connect(VM())
    c.dispose()
    r({ vncPort: 0, vncWebsocketPort: 5700, spicePort: 0, spiceTlsPort: 0 })
    await p
    expect(instances).toHaveLength(0)
  })

  // Review Important #2: generation guard also has one line in the catch(getVNC fails)
  // branch (useVncConsole.ts `catch { if (myGen !== gen) return; ... }`), but was
  // completely uncovered by tests before — review showed all 31 examples (this file +
  // KvmPage.test.ts) still pass after deleting it. This line is not defensive redundancy:
  // without it, VM A's late-arriving getVNC **failure** would call disconnect(), destroying
  // VM B's freshly-built RFB and showing "failed to fetch VNC info" — exactly the kind of
  // race condition this task fixes, just via the failure path instead of success path.
  it('when previous getVNC failure arrives late, must not disconnect established new connection or write error state', async () => {
    let slowReject: (e: unknown) => void = () => {}
    getVNC
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { slowReject = reject }))
      .mockResolvedValueOnce({ vncPort: 0, vncWebsocketPort: 5701, spicePort: 0, spiceTlsPort: 0 })
    const c = useVncConsole(host())
    const slow = c.connect(VM({ id: 'a' })) // sent first, will fail later
    await c.connect(VM({ id: 'b' })) // sent later, succeeds immediately
    expect(instances).toHaveLength(1)

    slowReject(new Error('404')) // a's late failure result arrives now
    await slow // connect() handles catch internally, won't throw, just wait for this round to finish

    // b's established connection must stay intact, error state must not be polluted by a's late failure.
    expect(instances).toHaveLength(1)
    expect(instances[0].disconnected).toBe(false)
    expect(c.errorKey.value).toBe('')
  })
})

describe('modifier keys and key events', () => {
  it('toggleModifier press then release, state toggles', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('ctrl')
    expect(c.modifiers.value.ctrl).toBe(true)
    expect(last(instances[0].sent)).toEqual([0xffe3, true])
    c.toggleModifier('ctrl')
    expect(c.modifiers.value.ctrl).toBe(false)
    expect(last(instances[0].sent)).toEqual([0xffe3, false])
  })

  it('keysym correct for all four modifier keys (Vue2 :1015-1035)', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('alt'); expect(last(instances[0].sent)[0]).toBe(0xffe9)
    c.toggleModifier('shift'); expect(last(instances[0].sent)[0]).toBe(0xffe1)
    c.toggleModifier('win'); expect(last(instances[0].sent)[0]).toBe(0xffeb)
  })

  it('on disconnect, release all pressed modifier keys (else they stay pressed)', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('ctrl'); c.toggleModifier('alt')
    const rfb = instances[0]
    c.disconnect()
    expect(rfb.sent.filter(([, d]) => d === false).map(([k]) => k).sort()).toEqual([0xffe3, 0xffe9].sort())
    expect(c.modifiers.value.ctrl).toBe(false)
    expect(c.modifiers.value.alt).toBe(false)
  })

  it('sendKey passes through directly', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.sendKey(0xff09)
    expect(last(instances[0].sent)).toEqual([0xff09, null])
  })

  it('sendCtrlAltDel calls RFB dedicated method and clears all modifier state', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    c.toggleModifier('ctrl')
    c.sendCtrlAltDel()
    expect(instances[0].cad).toBe(1)
    expect(c.modifiers.value.ctrl).toBe(false)
  })

  // Review Minor: this test's discrimination is indeed near zero (deleting `if (!rfb) return`
  // probably won't throw, just silently no-op or error differently). Keeping it because it
  // encodes the API contract "calling these methods before connect() must be safe no-op" into
  // an executable example — when ConsoleHeader/hotkeys eventually integrate and someone
  // accidentally triggers key send during VNC disconnection window, this serves as precedent.
  // Low discrimination doesn't mean no value; keep it, don't delete.
  it('when not connected, key calls are no-op, no throw', () => {
    const c = useVncConsole(host())
    expect(() => { c.sendKey(0xff09); c.sendCtrlAltDel(); c.toggleModifier('ctrl') }).not.toThrow()
  })

  it('RFB.sendKey exceptions are swallowed, no bubble (follow Vue2 try/catch)', async () => {
    const c = useVncConsole(host())
    await c.connect(VM())
    instances[0].sendKey = () => { throw new Error('socket closed') }
    expect(() => c.sendKey(0xff1b)).not.toThrow()
  })
})
