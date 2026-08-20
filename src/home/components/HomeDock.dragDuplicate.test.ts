import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useAppsStore } from '../stores/apps'
import { __resetDockForTest } from '../composables/useDock'
import { useLayoutStore } from '../stores/layout'
import { useToast } from '../../stores/toast'
import { i18n } from '../../i18n'
import HomeDock from './HomeDock.vue'

// Coverage note (spec's Testing section, finding 8 of the batch review):
// HomeDock.test.ts mocks useAddPanel wholesale -- a deliberately narrow mock,
// see its own comment -- so the duplicate-refusal path inside spawnPlace is
// never exercised from a real dock drag there. This file mounts HomeDock with
// the real useAddPanel/useLayoutStore instead, purely to prove the duplicate
// toast fires end to end from a dock-to-desktop drag. It is a separate test
// file (its own module registry, its own vi.mock scope) specifically so it
// adds nothing to and changes nothing about HomeDock.test.ts's narrow mock or
// its existing assertions.
vi.mock('../../router', () => ({ router: { push: vi.fn() } }))

beforeEach(() => {
  setActivePinia(createPinia()); localStorage.clear(); __resetDockForTest()
  Object.defineProperty(window, 'location', { configurable: true, value: { hostname: 'h', set href(_v: string) {}, get href() { return '' } } })
})

const gridStub = () => {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({ left: 200, top: 100, right: 200 + 12 * 76, bottom: 100 + 8 * 76, width: 12 * 76, height: 8 * 76, x: 200, y: 100, toJSON: () => ({}) })
  return el
}

describe('HomeDock drag-to-desktop — duplicate refusal (real useAddPanel)', () => {
  it('raises the "already on the desktop" toast instead of placing a second copy', async () => {
    useAppsStore()
    const layout = useLayoutStore()
    // Seed the desktop with "settings" already placed, so spawnPlace's own
    // isDuplicate() check refuses the drop.
    layout.pin({ kind: 'app', key: 'settings', c: 0, r: 0, w: 1, h: 1 })

    const w = mount(HomeDock, { props: { cell: 60, gap: 16, cols: 12, rows: 8, gridEl: gridStub() } })
    await w.get('.dock-toggle').trigger('click')
    ;(w.get('nav').element as HTMLElement).setPointerCapture = (() => {}) as never
    await w.get('.dock-app[data-app="settings"]').trigger('pointerdown', { pointerId: 9, clientX: 100, clientY: 500 })
    const move = new Event('pointermove') as PointerEvent
    Object.assign(move, { pointerId: 9, clientX: 230, clientY: 130 }) // over the grid stub
    window.dispatchEvent(move)
    await w.vm.$nextTick()
    const up = new Event('pointerup') as PointerEvent
    Object.assign(up, { pointerId: 9, clientX: 230, clientY: 130 })
    window.dispatchEvent(up)
    await w.vm.$nextTick()

    // No second copy was pinned...
    expect(layout.items.filter((it) => it.kind === 'app' && it.key === 'settings').length).toBe(1)
    // ...and the refusal was surfaced, not silent.
    const toast = useToast()
    expect(toast.toasts.length).toBeGreaterThan(0)
    expect(toast.toasts[toast.toasts.length - 1].text).toBe(i18n.global.t('addPanelAppExists'))
  })
})
