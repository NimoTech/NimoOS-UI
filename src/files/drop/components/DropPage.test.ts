import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory, createMemoryHistory } from 'vue-router'
import DropPage from './DropPage.vue'
import { useDropStore } from '../stores/drop'

// NOTE: i18n is installed globally for every mount in vitest.setup.ts
// (config.global.plugins). Passing the shared `i18n` instance here again used
// to double-install it on top of that, emitting a hidden [Vue warn] on every
// test in this file. Fixed while touching this file for Task 13 -- do not
// re-add `i18n` to any `global.plugins` array below.

vi.mock('../serverConnection', () => ({ ServerConnection: class { connect = vi.fn(); destroy = vi.fn(); send = vi.fn() } }))
vi.mock('../peersManager', () => ({ PeersManager: class { handleServerMessage = vi.fn(); sendFiles = vi.fn(() => true); destroy = vi.fn() } }))
vi.mock('@nimotech/nimoos-service', () => ({ refreshAccessToken: vi.fn(async () => {}), service: {} }))

const router = createRouter({ history: createWebHashHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div/>' } }] })

describe('DropPage', () => {
  let pinia: ReturnType<typeof createPinia>
  beforeEach(() => { pinia = createPinia(); setActivePinia(pinia) })
  const mountPage = () => mount(DropPage, { global: { plugins: [pinia, router], stubs: { AreaShell: { template: '<div><slot/></div>' }, FilesSidebar: true } } })

  it('mount calls store.init, unmount calls destroy', async () => {
    const s = useDropStore()
    const initSpy = vi.spyOn(s, 'init')
    const destroySpy = vi.spyOn(s, 'destroy')
    const w = mountPage()
    await flushPromises()
    expect(initSpy).toHaveBeenCalledOnce()
    w.unmount()
    expect(destroySpy).toHaveBeenCalledOnce()
  })
  // Task 13: the beforeunload half of the leave guard is unit-tested in
  // isolation in leaveGuard.test.ts, but nothing there proves DropPage
  // actually wires it up in onMounted/onBeforeUnmount. Drive a real
  // `beforeunload` event through `window` to prove it.
  it('warns on window close while a transfer is running, and stops after unmount', async () => {
    const s = useDropStore()
    s.hasActiveTransfers = () => true
    const w = mountPage()
    await flushPromises()

    const whileMounted = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(whileMounted)
    expect(whileMounted.defaultPrevented).toBe(true)

    w.unmount()

    const afterUnmount = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(afterUnmount)
    expect(afterUnmount.defaultPrevented).toBe(false)
  })
  it('renders peers (self flag) and receive card mount point', async () => {
    const s = useDropStore()
    s.peers.push(
      { id: 'me', name: { model: 'desktop', deviceName: 'd', displayName: 'Me' }, rtcSupported: true },
      { id: 'b', name: { model: 'tablet', deviceName: 'd', displayName: 'Pad' }, rtcSupported: true },
    )
    s.selfId = 'me'
    const w = mountPage()
    await flushPromises()
    expect(w.findAllComponents({ name: 'DropItem' }).length).toBe(2)
    expect(w.text()).toContain('Pad')
  })
  it('tells the store which kind of stop each device event is', async () => {
    // Both events land on cancelTransfer, but only the menu item is the user
    // choosing to stop. A watchdog stall has to arrive as 'timeout' or the toast
    // tells the user they cancelled something they did not touch.
    const s = useDropStore()
    s.peers.push({ id: 'b', name: { model: 'tablet', deviceName: 'd', displayName: 'Pad' }, rtcSupported: true })
    const calls: unknown[][] = []
    s.cancelTransfer = (...args: unknown[]) => { calls.push(args) }
    const w = mountPage()
    await flushPromises()
    const item = w.findComponent({ name: 'DropItem' })

    item.vm.$emit('cancel-transfer')
    item.vm.$emit('transfer-stalled')

    expect(calls).toEqual([['b'], ['b', 'timeout']])
  })
  it('sidebar @navigate event navigates to target path', async () => {
    const w = mount(DropPage, {
      global: {
        plugins: [pinia, router],
        stubs: {
          AreaShell: { template: '<div><slot/></div>' },
          FilesSidebar: { template: '<button class="nav-stub" @click="$emit(\'navigate\', \'TestDisk/docs\')" />' },
        },
      },
    })
    await router.isReady()
    await flushPromises()
    w.find('.nav-stub').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/files/TestDisk/docs')
  })
})

// Task 13: leave-guard wiring. This suite drives a real navigation through a
// dedicated memory-history router so onBeforeRouteLeave (a Task-13 first for
// this repo) actually fires, rather than merely asserting it was registered.
describe('DropPage leave guard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  async function mountAtDropRoute() {
    const memRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/files/drop', component: DropPage },
        { path: '/elsewhere', component: { template: '<div>elsewhere</div>' } },
      ],
    })
    memRouter.push('/files/drop')
    await memRouter.isReady()
    const wrapper = mount(
      { template: '<router-view />' },
      { global: { plugins: [memRouter], stubs: { AreaShell: { template: '<div><slot/></div>' }, FilesSidebar: true } } },
    )
    await flushPromises()
    return { router: memRouter, wrapper }
  }

  it('lets navigation through untouched when no transfer is running', async () => {
    const { router: memRouter } = await mountAtDropRoute()
    const drop = useDropStore()
    drop.hasActiveTransfers = () => false

    await memRouter.push('/elsewhere')
    await flushPromises()

    expect(memRouter.currentRoute.value.path).toBe('/elsewhere')
  })

  it('holds navigation on the drop page until the user confirms', async () => {
    const { router: memRouter, wrapper } = await mountAtDropRoute()
    const drop = useDropStore()
    drop.hasActiveTransfers = () => true

    const nav = memRouter.push('/elsewhere')
    await flushPromises()
    expect(memRouter.currentRoute.value.path).toBe('/files/drop') // still held

    wrapper.findComponent({ name: 'AlertDialog' }).vm.$emit('confirm')
    await nav
    await flushPromises()
    expect(memRouter.currentRoute.value.path).toBe('/elsewhere')
  })

  it('stays on the page when the user backs out', async () => {
    const { router: memRouter, wrapper } = await mountAtDropRoute()
    const drop = useDropStore()
    drop.hasActiveTransfers = () => true

    const nav = memRouter.push('/elsewhere')
    await flushPromises()
    wrapper.findComponent({ name: 'AlertDialog' }).vm.$emit('update:open', false)
    await nav
    await flushPromises()

    expect(memRouter.currentRoute.value.path).toBe('/files/drop')
  })
})
