import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import DropPage from './DropPage.vue'
import { useDropStore } from '../stores/drop'
import { i18n } from '../../../i18n'

vi.mock('../serverConnection', () => ({ ServerConnection: class { connect = vi.fn(); destroy = vi.fn(); send = vi.fn() } }))
vi.mock('../peersManager', () => ({ PeersManager: class { handleServerMessage = vi.fn(); sendFiles = vi.fn(() => true); destroy = vi.fn() } }))
vi.mock('@nimotech/nimoos-service', () => ({ refreshAccessToken: vi.fn(async () => {}), service: {} }))

const router = createRouter({ history: createWebHashHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div/>' } }] })

describe('DropPage', () => {
  let pinia: ReturnType<typeof createPinia>
  beforeEach(() => { pinia = createPinia(); setActivePinia(pinia) })
  const mountPage = () => mount(DropPage, { global: { plugins: [pinia, i18n, router], stubs: { FilesShell: { template: '<div><slot/></div>' }, FilesSidebar: true } } })

  it('mount 调 store.init,unmount 调 destroy', async () => {
    const s = useDropStore()
    const initSpy = vi.spyOn(s, 'init')
    const destroySpy = vi.spyOn(s, 'destroy')
    const w = mountPage()
    await flushPromises()
    expect(initSpy).toHaveBeenCalledOnce()
    w.unmount()
    expect(destroySpy).toHaveBeenCalledOnce()
  })
  it('渲染 peers(self 标记)与接收卡挂载点', async () => {
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
  it('侧栏 @navigate 事件跳转到目标路径', async () => {
    const w = mount(DropPage, {
      global: {
        plugins: [pinia, i18n, router],
        stubs: {
          FilesShell: { template: '<div><slot/></div>' },
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
