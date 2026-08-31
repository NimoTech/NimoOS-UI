// Ported from Vue2 sections/__tests__/ObservabilitySection.spec.js (5 cases),
// original test used `w.vm.turnOn()` / `w.vm.onToggle(...)` direct instance method calls,
// mocked `$buefy.dialog.confirm`. `<script setup>` doesn't expose internal methods externally,
// here changed to DOM-driven (toggle switch `.sw`, click confirm/cancel in AlertDialog),
// assertions changed to call assertions on service mock, behavior unchanged.
// Line-by-line correspondence (Vue2 spec case → this file case):
//   1. loads current state (enabled + running)                     → case 1
//   2. turning on when installed+running just persists enabled     → case 2
//   3. turning on when not installed installs via embedded compose → case 3
//   4. turning off disables and stops the container                → case 4
//   5. onToggle with absent phoenix calls $buefy.dialog.confirm     → case 5
//      (changed assertion "AlertDialog rendered", equivalent to "confirm called once")
//
// The Vue2 spec's container.getMyAppListV2() returns a three-layer { data: { data: {...} } } envelope;
// New-UI's service.compose.list() is already unwrapped and returns a flat
// Record<string, ComposeAppWithStoreInfo> directly — the composeList mock resolves the flat
// object directly, no longer wrapped in two layers of data (see p2b-common-constraints §5).
//
// Polling in tests stays controllable: composeList mock directly returns "target state" universally,
// letting pollStatus's pred hit after first refreshStatus() round, never actually goes to
// `setTimeout(intervalMs)` branch — thus no need vi.useFakeTimers() (brief recommended way);
// pure Promise chain uses once `flushPromises()` (queued as setImmediate macro task, Node exhausts
// entire micro task chain first) stabilizing to flush await chain. Only unmount guard case (19)
// uses real timer, intentionally suspends internal promise there, manually resolve, not relying on time passing.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'
import ObservabilitySection from './ObservabilitySection.vue'
import AgentIcon from '../../icons/AgentIcon.vue'

const h = vi.hoisted(() => ({
  getTracingSetting: vi.fn(),
  putTracingSetting: vi.fn(),
  getObservabilityCompose: vi.fn(),
  composeList: vi.fn(),
  composeInstall: vi.fn(),
  composeSetStatus: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    ai: {
      getTracingSetting: h.getTracingSetting,
      putTracingSetting: h.putTracingSetting,
      getObservabilityCompose: h.getObservabilityCompose,
    },
    compose: {
      list: h.composeList,
      install: h.composeInstall,
      setStatus: h.composeSetStatus,
    },
  },
}))

// Hand-written minimal MessageBus mock: records each event's current handler set, `fire()` simulates
// socket event push, unsubscribe (closure returned by useMessageBus().on) deletes itself from Set.
// Case 17 proves onUnmounted truly calls unsubscribe closure by checking Set becomes empty after unsubscribe.
const busState = vi.hoisted(() => ({
  handlers: {} as Record<string, Set<(p: unknown) => void>>,
}))
vi.mock('../../../../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on: (event: string, cb: (p: unknown) => void) => {
      if (!busState.handlers[event]) busState.handlers[event] = new Set()
      busState.handlers[event].add(cb)
      return () => { busState.handlers[event]?.delete(cb) }
    },
  }),
}))
function fire(event: string, props: unknown) {
  busState.handlers[event]?.forEach((cb) => cb(props))
}

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountSection = () => mount(ObservabilitySection, { global: { plugins: [i18n] }, attachTo: document.body })
const flush = async () => { await flushPromises(); await nextTick() }

function entry(status?: string) {
  return { 'arize-phoenix': { status } }
}
function findButtonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll('button'))
    .find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined
}

describe('ObservabilitySection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    Object.keys(busState.handlers).forEach((k) => busState.handlers[k].clear())
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Vue2 5 cases ported ──

  it('1. after mount fills enabled on, state text "running"', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: true })
    h.composeList.mockResolvedValue(entry('running'))
    const w = mountSection()
    await flush()
    expect(w.find('.sw').attributes('data-on')).toBe('true')
    expect(w.find('.px-status .state').text()).toContain('运行中')
    w.unmount()
  })

  it('2. when installed and running, toggle switch on → only calls putTracingSetting, not compose.install', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValue(entry('running'))
    h.putTracingSetting.mockResolvedValue({ enabled: true })
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await flush()
    expect(h.putTracingSetting).toHaveBeenCalledWith({ enabled: true })
    expect(h.composeInstall).not.toHaveBeenCalled()
    w.unmount()
  })

  it('3. when not installed, toggle switch on → after clicking "download and install" optimistically set enabled, fetch compose, install container', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValueOnce({}) // load() sees absent
    h.getObservabilityCompose.mockResolvedValue('name: arize-phoenix')
    h.putTracingSetting.mockResolvedValue({ enabled: true })
    h.composeInstall.mockResolvedValue(undefined)
    const w = mountSection()
    await flush()
    expect(w.find('.px-status .state').text()).toContain('未安装')

    h.composeList.mockResolvedValue(entry('running')) // once installed, pollStatus hits on its first round

    await w.find('.sw').trigger('click')
    await nextTick() // AlertDialog Portal mounting is async
    const confirmBtn = findButtonByText('下载并安装')
    expect(confirmBtn).toBeTruthy()
    confirmBtn!.click()
    await flush()

    expect(h.putTracingSetting).toHaveBeenCalledWith({ enabled: true }) // set optimistically first
    expect(h.getObservabilityCompose).toHaveBeenCalled()
    expect(h.composeInstall).toHaveBeenCalledWith('name: arize-phoenix')
    w.unmount()
  })

  it('4. when running, toggle switch off → after clicking "continue" putTracingSetting(false) and stop container', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: true })
    h.composeList.mockResolvedValueOnce(entry('running')) // see running at load(), trigger stop confirm dialog
    h.composeList.mockResolvedValue(entry('exited')) // turnOff's pollStatus hits !==running on first round
    h.putTracingSetting.mockResolvedValue({ enabled: false })
    h.composeSetStatus.mockResolvedValue(undefined)
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await nextTick()
    const confirmBtn = findButtonByText('继续')
    expect(confirmBtn).toBeTruthy()
    confirmBtn!.click()
    await flush()
    expect(h.putTracingSetting).toHaveBeenCalledWith({ enabled: false })
    expect(h.composeSetStatus).toHaveBeenCalledWith('arize-phoenix', 'stop')
    w.unmount()
  })

  it('5. when absent, toggle switch on → show install confirm dialog (equivalent to Vue2 confirm called once)', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValueOnce({})
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await nextTick()
    expect(document.body.textContent).toContain('Agent 监控需要 Phoenix 应用')
    w.unmount()
  })

  // ── new cases ──

  it('6a. exited → state text "stopped"', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValue(entry('exited'))
    const w = mountSection()
    await flush()
    expect(w.find('.px-status .state').text()).toContain('已停止')
    w.unmount()
  })

  it('6b. other non-running states (like created) → state text also "stopped"', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValue(entry('created'))
    const w = mountSection()
    await flush()
    expect(w.find('.px-status .state').text()).toContain('已停止')
    w.unmount()
  })

  it('7. compose.list() no arize-phoenix key → absent (not installed)', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValue({})
    const w = mountSection()
    await flush()
    expect(w.find('.px-status .state').text()).toContain('未安装')
    w.unmount()
  })

  it('8. has key but status missing → exited (stopped)', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValue({ 'arize-phoenix': {} })
    const w = mountSection()
    await flush()
    expect(w.find('.px-status .state').text()).toContain('已停止')
    w.unmount()
  })

  it('9. compose.list() reject → keep current state (absent initial), don\'t throw', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: true })
    h.composeList.mockRejectedValue(new Error('boom'))
    const w = mountSection()
    await flush()
    expect(w.find('.px-status .state').text()).toContain('未安装')
    expect(w.find('.sw').attributes('data-on')).toBe('true') // enabled is still filled back in as usual, not knocked out by this exception
    w.unmount()
  })

  it('10. getTracingSetting() reject → don\'t throw, still continue to fetch container state', async () => {
    h.getTracingSetting.mockRejectedValue(new Error('boom'))
    h.composeList.mockResolvedValue(entry('running'))
    const w = mountSection()
    await flush()
    expect(h.composeList).toHaveBeenCalled()
    expect(w.find('.px-status .state').text()).toContain('运行中')
    expect(w.find('.sw').attributes('data-on')).toBe('false') // default, not changed to something else by exception
    w.unmount()
  })

  it('11a. running and enabled=false → render warning banner', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValue(entry('running'))
    const w = mountSection()
    await flush()
    expect(w.find('.set-banner.warn').exists()).toBe(true)
    expect(w.find('.set-banner.warn').text()).toBe('Phoenix 正在运行但监控未开启。开启后才会记录追踪。')
    w.unmount()
  })

  it('11b. running and enabled=true → not render warning banner (control group)', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: true })
    h.composeList.mockResolvedValue(entry('running'))
    const w = mountSection()
    await flush()
    expect(w.find('.set-banner.warn').exists()).toBe(false)
    w.unmount()
  })

  it('12. install confirm dialog click cancel → switch stays off throughout, don\'t send any requests (final review Fix 4: don\'t optimistically write enabled while confirm open, align with Vue2 :124-131)', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValue({})
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await nextTick()
    // Vue2 :124-131 don't touch this.enabled before popping confirm dialog, SetSwitch is controlled component,
    // switch should keep original value (off) while confirm open, shouldn't jump to "on" first then back
    // (optimistic write Vue2 :124-131 reverted by final review Fix 4).
    expect(w.find('.sw').attributes('data-on')).toBe('false')
    const cancelBtn = findButtonByText('取消')
    expect(cancelBtn).toBeTruthy()
    cancelBtn!.click()
    await flush()
    expect(w.find('.sw').attributes('data-on')).toBe('false')
    expect(h.putTracingSetting).not.toHaveBeenCalled()
    expect(h.composeInstall).not.toHaveBeenCalled()
    w.unmount()
  })

  it('13. stop confirm dialog click cancel → switch stays on throughout, don\'t send requests (final review Fix 4: don\'t optimistically write enabled while confirm open, align with Vue2 :135-142)', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: true })
    h.composeList.mockResolvedValue(entry('running'))
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await nextTick()
    // Vue2 :135-142 doesn't touch this.enabled before popping the confirm dialog; the switch should keep its original value (on) while the confirm dialog is open.
    expect(w.find('.sw').attributes('data-on')).toBe('true')
    const cancelBtn = findButtonByText('取消')
    expect(cancelBtn).toBeTruthy()
    cancelBtn!.click()
    await flush()
    expect(w.find('.sw').attributes('data-on')).toBe('true')
    expect(h.putTracingSetting).not.toHaveBeenCalled()
    expect(h.composeSetStatus).not.toHaveBeenCalled()
    w.unmount()
  })

  // final review Fix 4 — directly proves the "Phoenix running but monitoring off" warning banner
  // no longer briefly flashes up while the confirm dialog is open: running and enabled=true,
  // toggling off — the warning banner's render condition is
  // `phoenixStatus === 'running' && !enabled`; an optimistic write would satisfy it, but the
  // real behavior shouldn't (enabled hasn't actually changed yet).
  it('20. toggling off while running: the warning banner must not prematurely appear while the confirm dialog is open (enabled has not actually changed yet)', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: true })
    h.composeList.mockResolvedValue(entry('running'))
    const w = mountSection()
    await flush()
    expect(w.find('.set-banner.warn').exists()).toBe(false)
    await w.find('.sw').trigger('click')
    await nextTick()
    expect(w.find('.set-banner.warn').exists()).toBe(false)
    w.unmount()
  })

  it('14. app:install-progress event renders the progress percentage; ignores the same-name event from other apps', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValue({})
    h.putTracingSetting.mockResolvedValue({ enabled: true })
    h.getObservabilityCompose.mockImplementation(() => new Promise(() => { /* stays pending, so confirmInstall never finishes */ }))
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await nextTick()
    findButtonByText('下载并安装')!.click()
    await flush() // turnOn() has finished, installing=true, stuck on getObservabilityCompose's pending promise

    fire('app:install-progress', { 'app:name': 'other-app', 'app:progress': '99' })
    await nextTick()
    expect(w.find('.px-msg').text()).toBe('正在安装 Phoenix… 0%') // unaffected by other apps' events

    fire('app:install-progress', { 'app:name': 'arize-phoenix', 'app:progress': '42' })
    await nextTick()
    expect(w.find('.px-msg').text()).toBe('正在安装 Phoenix… 42%')
    w.unmount()
  })

  it('15. app:install-error event → shows the error message, rolls back with putTracingSetting(false), switch turns back off', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValue({})
    h.putTracingSetting.mockResolvedValue({ enabled: true }) // turnOn()'s optimistic write succeeds first
    h.getObservabilityCompose.mockImplementation(() => new Promise(() => {}))
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await nextTick()
    findButtonByText('下载并安装')!.click()
    await flush()
    expect(w.find('.sw').attributes('data-on')).toBe('true')

    h.putTracingSetting.mockResolvedValue({ enabled: false }) // rollback request
    fire('app:install-error', { 'app:name': 'arize-phoenix', message: '装不上' })
    await flush()

    expect(w.find('.px-msg.err').text()).toBe('装不上')
    expect(h.putTracingSetting).toHaveBeenCalledWith({ enabled: false })
    expect(w.find('.sw').attributes('data-on')).toBe('false')
    w.unmount()
  })

  it('16. app:install-end event → exits the installing state and reloads via load() (getTracingSetting is called a second time)', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValue({})
    h.putTracingSetting.mockResolvedValue({ enabled: true })
    h.getObservabilityCompose.mockImplementation(() => new Promise(() => {}))
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await nextTick()
    findButtonByText('下载并安装')!.click()
    await flush()
    expect(w.find('.px-msg').exists()).toBe(true) // currently installing

    h.composeList.mockResolvedValue(entry('running')) // on reload, sees it's already installed
    fire('app:install-end', { 'app:name': 'arize-phoenix' })
    await flush()

    expect(h.getTracingSetting).toHaveBeenCalledTimes(2)
    expect(w.find('.px-msg').exists()).toBe(false)
    expect(w.find('.px-status .state').text()).toContain('运行中')
    w.unmount()
  })

  it('17. after unmount, further events no longer change state (proves unsubscribe took effect: the handler has been removed from the subscriber set)', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValue(entry('running'))
    const w = mountSection()
    await flush()
    expect(busState.handlers['app:install-progress']?.size).toBe(1)
    w.unmount()
    expect(busState.handlers['app:install-progress']?.size).toBe(0)
    // firing after unsubscribe shouldn't throw, and there's nothing left to write to (the handler set is already empty, so fire is a no-op)
    expect(() => fire('app:install-progress', { 'app:name': 'arize-phoenix', 'app:progress': '77' })).not.toThrow()
  })

  it('18. clicking "open Phoenix" → window.open receives the URL and _blank', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: true })
    h.composeList.mockResolvedValue(entry('running'))
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const w = mountSection()
    await flush()
    await w.find('.px-open').trigger('click')
    expect(spy).toHaveBeenCalledWith(`http://${window.location.hostname}:6006/`, '_blank')
    w.unmount()
  })

  // Feedback from an earlier review (a declared deviation signed off by the user) —
  // Vue2 ObservabilitySection.vue:29 uses a `download` icon (down arrow + baseline) on this
  // button, whose semantics are "download", while the button's actual behavior is "open the
  // Phoenix UI in a new tab". At acceptance the user flagged that ① the icon reads as
  // "loading/download" and ② the button's very faint accent-softer background makes it
  // "not look like a button" in the light theme. Decision: switch to a solid accent color +
  // an external-link icon. This is **a deliberate deviation from Vue2's visual 1:1 parity**
  // (porting discipline requires declaring + recording it), not a porting slip.
  it('20. the "open Phoenix" button uses an external-link icon (not download), a declared deviation from Vue2 :29', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: true })
    h.composeList.mockResolvedValue(entry('running'))
    const w = mountSection()
    await flush()
    const icons = w.find('.px-open').findAllComponents(AgentIcon)
    expect(icons).toHaveLength(1)
    expect(icons[0].props('name')).toBe('external')
    w.unmount()
  })

  it('19. unmount guard: unmounting mid-poll, composeList only resolving after unmount no longer continues to write state or send requests', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValueOnce(entry('exited')) // used by load(): neither absent nor running → toggling on takes the start+poll branch
    h.composeSetStatus.mockResolvedValue(undefined) // start succeeds immediately
    const w = mountSection()
    await flush()

    let resolveList!: (v: unknown) => void
    h.composeList.mockImplementation(() => new Promise((r) => { resolveList = r })) // gets stuck when called again inside pollStatus

    await w.find('.sw').trigger('click') // exited !== absent && !== running → turnOnFlow: after start succeeds, enters pollStatus
    await nextTick()
    expect(h.composeSetStatus).toHaveBeenCalledWith('arize-phoenix', 'start')

    const putCallsBefore = h.putTracingSetting.mock.calls.length
    w.unmount() // polling is still stuck inside refreshStatus() when unmount happens here
    resolveList(entry('running')) // the pending composeList only resolves after unmount
    await flush()

    // the alive guard sits right after each of refreshStatus's and pollStatus's own await; turnOn()
    // (→ putTracingSetting) should not be invoked again — this is the unmount guard the file
    // header's "logic fix" note declares, proving it genuinely works.
    expect(h.putTracingSetting.mock.calls.length).toBe(putCallsBefore)
  })

  // final review Fix 6 — ObservabilitySection.vue:245 is the one apiErrorMessage call site with
  // no test covering the backend-message path (breaking apiErrorMessage in the final review showed
  // 10 cases across 6 sections turning red, with this section the only one that stayed all green).
  // When composeInstall fails with response.data.message, confirmInstall()'s catch must render
  // that message (not the fallback copy) into .px-msg.err.
  it('21. compose.install() fails with a backend message → .px-msg.err shows the backend message (not the fallback copy, proving it goes through apiErrorMessage)', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValueOnce({})
    h.getObservabilityCompose.mockResolvedValue('name: arize-phoenix')
    h.putTracingSetting.mockResolvedValue({ enabled: true })
    h.composeInstall.mockRejectedValue({ response: { data: { message: '磁盘空间不足' } } })
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await nextTick()
    findButtonByText('下载并安装')!.click()
    await flush()
    expect(w.find('.px-msg.err').text()).toBe('磁盘空间不足')
    w.unmount()
  })
})
