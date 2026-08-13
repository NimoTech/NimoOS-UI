// SP8-P2b Task 8 — ported from Vue2 sections/__tests__/ObservabilitySection.spec.js (5 cases),
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
// Vue2 spec 里 container.getMyAppListV2() 返回 { data: { data: {...} } } 三层信封;
// New-UI 的 service.compose.list() 已经剥好,直接返回 Record<string, ComposeAppWithStoreInfo>
// ——composeList mock 直接 resolve 平铸对象,不再套两层 data(见 p2b-common-constraints §5)。
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
    h.composeList.mockResolvedValueOnce({}) // load() 时看到 absent
    h.getObservabilityCompose.mockResolvedValue('name: arize-phoenix')
    h.putTracingSetting.mockResolvedValue({ enabled: true })
    h.composeInstall.mockResolvedValue(undefined)
    const w = mountSection()
    await flush()
    expect(w.find('.px-status .state').text()).toContain('未安装')

    h.composeList.mockResolvedValue(entry('running')) // 装完后 pollStatus 首轮即命中

    await w.find('.sw').trigger('click')
    await nextTick() // AlertDialog Portal 挂载是异步的
    const confirmBtn = findButtonByText('下载并安装')
    expect(confirmBtn).toBeTruthy()
    confirmBtn!.click()
    await flush()

    expect(h.putTracingSetting).toHaveBeenCalledWith({ enabled: true }) // 乐观先置
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
    expect(w.find('.sw').attributes('data-on')).toBe('true') // enabled 仍照常回填,没被这处异常连带破坏
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
    // Vue2 :135-142 弹确认框前不碰 this.enabled，确认框开着期间开关应保持原值(开)。
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

  // final review Fix 4 — 直接证明「Phoenix running but monitoring off」警告条不再在
  // 确认框打开期间短暂冒出来:running 且 enabled=true 时拨关，确认框打开期间警告条的
  // 显示条件是 `phoenixStatus === 'running' && !enabled`，乐观写会让它满足、真实行为
  // 不该满足(enabled 尚未真正改变)。
  it('20. 运行中拨开关到关时，确认框打开期间警告条不应提前出现（enabled 尚未真正改变）', async () => {
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

  it('14. app:install-progress 事件渲染进度百分比;忽略其它 app 的同名事件', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValue({})
    h.putTracingSetting.mockResolvedValue({ enabled: true })
    h.getObservabilityCompose.mockImplementation(() => new Promise(() => { /* 挂起,不让 confirmInstall 走完 */ }))
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await nextTick()
    findButtonByText('下载并安装')!.click()
    await flush() // turnOn() 已完成、installing=true,卡在 getObservabilityCompose 的挂起 promise 上

    fire('app:install-progress', { 'app:name': 'other-app', 'app:progress': '99' })
    await nextTick()
    expect(w.find('.px-msg').text()).toBe('正在安装 Phoenix… 0%') // 未被其它 app 的事件改变

    fire('app:install-progress', { 'app:name': 'arize-phoenix', 'app:progress': '42' })
    await nextTick()
    expect(w.find('.px-msg').text()).toBe('正在安装 Phoenix… 42%')
    w.unmount()
  })

  it('15. app:install-error 事件 → 显示错误消息、putTracingSetting(false) 回滚、开关回关', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValue({})
    h.putTracingSetting.mockResolvedValue({ enabled: true }) // turnOn() 那次乐观置起先成功
    h.getObservabilityCompose.mockImplementation(() => new Promise(() => {}))
    const w = mountSection()
    await flush()
    await w.find('.sw').trigger('click')
    await nextTick()
    findButtonByText('下载并安装')!.click()
    await flush()
    expect(w.find('.sw').attributes('data-on')).toBe('true')

    h.putTracingSetting.mockResolvedValue({ enabled: false }) // 回滚请求
    fire('app:install-error', { 'app:name': 'arize-phoenix', message: '装不上' })
    await flush()

    expect(w.find('.px-msg.err').text()).toBe('装不上')
    expect(h.putTracingSetting).toHaveBeenCalledWith({ enabled: false })
    expect(w.find('.sw').attributes('data-on')).toBe('false')
    w.unmount()
  })

  it('16. app:install-end 事件 → 退出安装态并重新 load()(getTracingSetting 第二次被调)', async () => {
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
    expect(w.find('.px-msg').exists()).toBe(true) // installing 中

    h.composeList.mockResolvedValue(entry('running')) // 重新 load 时看到已装好
    fire('app:install-end', { 'app:name': 'arize-phoenix' })
    await flush()

    expect(h.getTracingSetting).toHaveBeenCalledTimes(2)
    expect(w.find('.px-msg').exists()).toBe(false)
    expect(w.find('.px-status .state').text()).toContain('运行中')
    w.unmount()
  })

  it('17. 卸载后再来事件不再改状态(证明退订生效:handler 已从订阅表移除)', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValue(entry('running'))
    const w = mountSection()
    await flush()
    expect(busState.handlers['app:install-progress']?.size).toBe(1)
    w.unmount()
    expect(busState.handlers['app:install-progress']?.size).toBe(0)
    // 退订后再 fire 不应抛错、也没有任何东西可写(handler 集合已空,fire 是空操作)
    expect(() => fire('app:install-progress', { 'app:name': 'arize-phoenix', 'app:progress': '77' })).not.toThrow()
  })

  it('18. 点「打开 Phoenix」→ window.open 收到 URL 与 _blank', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: true })
    h.composeList.mockResolvedValue(entry('running'))
    const spy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const w = mountSection()
    await flush()
    await w.find('.px-open').trigger('click')
    expect(spy).toHaveBeenCalledWith(`http://${window.location.hostname}:6006/`, '_blank')
    w.unmount()
  })

  // SP8-P2b 验收反馈(2026-07-30,用户拍板的申报级偏离)—— Vue2 ObservabilitySection.vue:29
  // 在这个按钮里用的是 `download` 图标(向下箭头 + 底线),语义是「下载」,而按钮的行为是
  // 「在新标签页打开 Phoenix 界面」。用户验收时反馈①图标像「加载/下载」②按钮极浅的
  // accent-softer 底色在浅色主题下「看不出有按钮」。拍板改为实底强调色 + 外链图标。
  // 这是**有意偏离 Vue2 视觉 1:1**(移植纪律要求申报+登记),不是移植走样。
  it('20. 「打开 Phoenix」按钮用外链图标(不是 download),Vue2 :29 的申报级偏离', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: true })
    h.composeList.mockResolvedValue(entry('running'))
    const w = mountSection()
    await flush()
    const icons = w.find('.px-open').findAllComponents(AgentIcon)
    expect(icons).toHaveLength(1)
    expect(icons[0].props('name')).toBe('external')
    w.unmount()
  })

  it('19. 卸载守卫:轮询途中卸载,composeList 之后才 resolve 也不再继续写状态/发请求', async () => {
    h.getTracingSetting.mockResolvedValue({ enabled: false })
    h.composeList.mockResolvedValueOnce(entry('exited')) // load() 用:非 absent、非 running → 拨开关走 start+poll 分支
    h.composeSetStatus.mockResolvedValue(undefined) // start 立即成功
    const w = mountSection()
    await flush()

    let resolveList!: (v: unknown) => void
    h.composeList.mockImplementation(() => new Promise((r) => { resolveList = r })) // pollStatus 里再调就卡住

    await w.find('.sw').trigger('click') // exited !== absent && !== running → turnOnFlow: start 成功后进入 pollStatus
    await nextTick()
    expect(h.composeSetStatus).toHaveBeenCalledWith('arize-phoenix', 'start')

    const putCallsBefore = h.putTracingSetting.mock.calls.length
    w.unmount() // 轮询还卡在 refreshStatus() 里,此刻卸载
    resolveList(entry('running')) // 卸载之后,悬着的 composeList 才 resolve
    await flush()

    // alive 守卫拦在 refreshStatus 与 pollStatus 各自的 await 之后,turnOn()(→putTracingSetting)
    // 不应该被继续调用——这是文件头「逻辑修正」declares 的卸载守卫,证明它真的生效。
    expect(h.putTracingSetting.mock.calls.length).toBe(putCallsBefore)
  })

  // final review Fix 6 — ObservabilitySection.vue:245 是 apiErrorMessage 唯一没有测试
  // 覆盖后端消息路径的调用点(最终评审破坏 apiErrorMessage 实测:6 个分区 10 个用例
  // 变红,唯独本分区全绿)。composeInstall 失败且带 response.data.message 时,
  // confirmInstall() 的 catch 必须把该消息(不是兜底文案)渲染进 .px-msg.err。
  it('21. compose.install() 失败且带后端 message → .px-msg.err 显示后端消息（而非兜底文案，证明走了 apiErrorMessage）', async () => {
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
