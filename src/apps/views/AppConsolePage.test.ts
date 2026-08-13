import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import zh from '../../i18n/zh_cn'
import { useToast } from '../../stores/toast'

const svc = vi.hoisted(() => ({
  compose: { containers: vi.fn(), list: vi.fn().mockResolvedValue({}) },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

const routerMock = vi.hoisted(() => ({ push: vi.fn() }))
// Reactive so tests can mutate `.params.name` in place to simulate an in-place route-param
// change (same route name `apps-console`, vue-router reuses the component instance) — this
// is what drives AppConsolePage's `watch(id, load)` without a remount.
const routeMock = reactive({ params: { name: 'demo' } })
vi.mock('vue-router', async (orig) => ({
  ...(await orig()),
  useRoute: () => routeMock,
  useRouter: () => routerMock,
}))

// TerminalPane/LogsPane are self-managed (real xterm socket / 5s polling) and already
// unit-tested in their own files (T5/T6) — here we only need to assert the props
// AppConsolePage passes them and their mount/visibility lifecycle. Mocking the whole SFC
// module (rather than just VTU `stubs`) matters: AppConsolePage.vue statically imports
// TerminalPane.vue, and `stubs` only swaps the render output — it does NOT stop the real
// module (and its `@xterm/xterm` import, which touches canvas at load time under jsdom)
// from being evaluated. vi.mock intercepts the import itself, so the real xterm/socket
// code never runs and the test stays quiet (no jsdom "canvas not implemented" noise).
const { TerminalStub, LogsStub } = vi.hoisted(() => ({
  TerminalStub: { name: 'TerminalPane', props: ['containerId'], template: '<div class="term-stub" />' },
  LogsStub: { name: 'LogsPane', props: ['appId'], template: '<div class="logs-stub" />' },
}))
vi.mock('../console/TerminalPane.vue', () => ({ default: TerminalStub }))
vi.mock('../console/LogsPane.vue', () => ({ default: LogsStub }))

import AppConsolePage from './AppConsolePage.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
let pinia: Pinia

// routeMock is a shared reactive object (see above) — without auto-unmount, a wrapper left
// mounted from an earlier test keeps its `watch(id, load)` alive and reacts to a later test's
// `routeMock.params.name = ...` mutation too, double-firing containers() calls across tests.
enableAutoUnmount(afterEach)

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  vi.clearAllMocks()
  svc.compose.list.mockResolvedValue({})
  routeMock.params.name = 'demo' // routeMock is shared/mutable across tests (regression test below mutates it) — reset each run
})

const mk = () =>
  mount(AppConsolePage, {
    global: {
      plugins: [i18n, pinia],
      stubs: {
        AreaShell: { template: '<div><slot /></div>' },
        AppsSidebar: true,
      },
    },
  })

describe('AppConsolePage', () => {
  it('Single-service app: do not show service selector, terminal tab is active by default', async () => {
    svc.compose.containers.mockResolvedValue({ main: 'app', containers: { app: { ID: 'c1' } } })
    const w = mk()
    await flushPromises()
    expect(w.find('[data-test="console-svc-select"]').exists()).toBe(false)
    expect(w.findComponent({ name: 'TerminalPane' }).props('containerId')).toBe('c1')
    expect(w.find('[data-test="console-tab-terminal"]').attributes('aria-selected')).toBe('true')
  })

  it('Multi-service app: show selector, default select main; after switching, TerminalPane gets new container id', async () => {
    svc.compose.containers.mockResolvedValue({
      main: 'web',
      containers: { db: { ID: 'cdb' }, web: { ID: 'cweb' } },
    })
    const w = mk()
    await flushPromises()
    const sel = w.find('[data-test="console-svc-select"]')
    expect(sel.exists()).toBe(true)
    expect((sel.element as HTMLSelectElement).value).toBe('web')
    expect(w.findComponent({ name: 'TerminalPane' }).props('containerId')).toBe('cweb')
    await sel.setValue('db')
    expect(w.findComponent({ name: 'TerminalPane' }).props('containerId')).toBe('cdb')
  })

  it('Logs tab lazy mount: LogsPane appears only when switched to, returning to terminal does not destroy logs polling component (v-show keeps it alive)', async () => {
    svc.compose.containers.mockResolvedValue({ main: 'app', containers: { app: { ID: 'c1' } } })
    // v-show toggling is asserted via isVisible(), which reads getComputedStyle — that only
    // reflects real inline styles when the element is connected to the live document (an
    // unattached wrapper's getComputedStyle() returns empty defaults, so display:none would
    // read as "visible"). attachTo: document.body + explicit unmount (PreInstallTips/
    // AppSettingsPage conflict-dialog tests use the same pattern) makes isVisible() meaningful.
    const w = mount(AppConsolePage, {
      global: {
        plugins: [i18n, pinia],
        stubs: { AreaShell: { template: '<div><slot /></div>' }, AppsSidebar: true },
      },
      attachTo: document.body,
    })
    await flushPromises()
    expect(w.findComponent({ name: 'LogsPane' }).exists()).toBe(false)

    await w.find('[data-test="console-tab-logs"]').trigger('click')
    const logs = w.findComponent({ name: 'LogsPane' })
    expect(logs.exists()).toBe(true)
    expect(logs.isVisible()).toBe(true)
    expect(w.findComponent({ name: 'TerminalPane' }).isVisible()).toBe(false)

    await w.find('[data-test="console-tab-terminal"]').trigger('click')
    // Still exists (hidden with v-show, not unmounted and remounted) — LogsPane's 5s polling
    // is not interrupted by tab switch
    expect(w.findComponent({ name: 'LogsPane' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'LogsPane' }).isVisible()).toBe(false)
    expect(w.findComponent({ name: 'TerminalPane' }).isVisible()).toBe(true)
    w.unmount()
  })

  it('Change service selector while on logs tab: force switch back to terminal tab (hidden mount will lock new TerminalPane\'s fit at 80×24)', async () => {
    svc.compose.containers.mockResolvedValue({
      main: 'web',
      containers: { db: { ID: 'cdb' }, web: { ID: 'cweb' } },
    })
    const w = mount(AppConsolePage, {
      global: {
        plugins: [i18n, pinia],
        stubs: { AreaShell: { template: '<div><slot /></div>' }, AppsSidebar: true },
      },
      attachTo: document.body, // isVisible() needs to be mounted on real document to read inline styles of v-show
    })
    await flushPromises()

    await w.find('[data-test="console-tab-logs"]').trigger('click')
    expect(w.find('[data-test="console-tab-logs"]').attributes('aria-selected')).toBe('true')
    expect(w.findComponent({ name: 'LogsPane' }).isVisible()).toBe(true)

    const sel = w.find('[data-test="console-svc-select"]')
    await sel.setValue('db')

    // Service selector's @change forces tab back to 'terminal': new container = new :key = TerminalPane
    // remounted. If still on logs tab, this remount happens hidden under v-show="tab==='terminal'".
    // FitAddon.fit() is a no-op on hidden host, so connection uses xterm default 80×24 size
    // (PTY does not support post-resize).
    expect(w.find('[data-test="console-tab-terminal"]').attributes('aria-selected')).toBe('true')
    expect(w.findComponent({ name: 'TerminalPane' }).props('containerId')).toBe('cdb')
    expect(w.findComponent({ name: 'TerminalPane' }).isVisible()).toBe(true)
    expect(w.findComponent({ name: 'LogsPane' }).isVisible()).toBe(false)
    w.unmount()
  })

  it('While switching app (route name change) on logs tab: load() itself resets tab to terminal, not triggered twice by select\'s @change', async () => {
    svc.compose.containers.mockResolvedValueOnce({
      main: 'web',
      containers: { db: { ID: 'cdb' }, web: { ID: 'cweb' } },
    })
    const w = mk()
    await flushPromises() // onMounted's load() (id="demo")

    await w.find('[data-test="console-tab-logs"]').trigger('click')
    expect(w.find('[data-test="console-tab-logs"]').attributes('aria-selected')).toBe('true')

    // Switch app: load() internally has tab.value = 'terminal' hardcoded before try — this path
    // completely skips the service selector's @change handler, avoiding “load already reset +
    // @change resets again” double-trigger.
    svc.compose.containers.mockResolvedValueOnce({ main: 'app', containers: { app: { ID: 'c-other' } } })
    routeMock.params.name = 'other-app'
    await flushPromises()

    expect(w.find('[data-test="console-tab-terminal"]').attributes('aria-selected')).toBe('true')
    expect(w.findComponent({ name: 'TerminalPane' }).props('containerId')).toBe('c-other')
    // Single-service app, selector not rendered — incidentally confirm there is no leftover
    // state from previous app's multi-service selector
    expect(w.find('[data-test="console-svc-select"]').exists()).toBe(false)
  })

  it('App does not exist (containers→undefined): toast + jump back to /apps', async () => {
    svc.compose.containers.mockResolvedValue(undefined)
    const toast = useToast()
    mk()
    await flushPromises()
    expect(routerMock.push).toHaveBeenCalledWith({ name: 'apps' })
    expect(toast.toasts.length).toBe(1)
  })

  it('After quickly switching apps (A→B), A\'s stale response arrives: do not overwrite B\'s state, do not mistakenly toast/navigate', async () => {
    // Two controllable deferred promises — containers() call #1 (for app A, "demo") resolves
    // LAST with app B's own stale-invalid-app shape (empty containers, the 404-ish branch),
    // call #2 (for app B, "other") resolves FIRST with valid data. Regression: without the
    // seq guard, A's late resolution would win, toast + router.push({name:'apps'}) firing and
    // yanking the user off B's now-current, valid console.
    let resolveA!: (v: unknown) => void
    let resolveB!: (v: unknown) => void
    const pA = new Promise((res) => { resolveA = res })
    const pB = new Promise((res) => { resolveB = res })
    svc.compose.containers.mockImplementationOnce(() => pA)
    svc.compose.containers.mockImplementationOnce(() => pB)

    const toast = useToast()
    const w = mk()
    await flushPromises() // onMounted's load() (id="demo") issues call #1, awaiting pA

    routeMock.params.name = 'other' // in-place route-param change — watch(id, load) fires, issues call #2, awaiting pB
    await flushPromises()

    // B resolves first (in flight order), with valid single-container data
    resolveB({ main: 'app', containers: { app: { ID: 'c-b' } } })
    await flushPromises()
    expect(w.findComponent({ name: 'TerminalPane' }).props('containerId')).toBe('c-b')

    // A's stale call resolves last with the invalid-app shape (empty containers) — must be a no-op
    resolveA({ main: '', containers: {} })
    await flushPromises()

    expect(w.findComponent({ name: 'TerminalPane' }).props('containerId')).toBe('c-b') // still B's container — not overwritten
    expect(routerMock.push).not.toHaveBeenCalled() // stale invalid-app branch must NOT redirect
    expect(toast.toasts.length).toBe(0) // ...and must NOT toast
  })
})
