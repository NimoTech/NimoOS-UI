import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'

// vi.mock factories must return constructable functions (`new Terminal(...)` etc. in the
// component) — plain `function` expressions have [[Construct]], arrow functions don't.
const termMock = { open: vi.fn(), loadAddon: vi.fn(), dispose: vi.fn(), cols: 80, rows: 24 }
vi.mock('@xterm/xterm', () => ({ Terminal: vi.fn(function () { return termMock }) }))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: vi.fn(function () { return { fit: vi.fn(), dispose: vi.fn() } }) }))
vi.mock('@xterm/addon-attach', () => ({ AttachAddon: vi.fn(function () { return { dispose: vi.fn() } }) }))

let statusCb: ((s: string) => void) | null = null
const connectMock = vi.fn().mockResolvedValue(null)
const closeMock = vi.fn()
vi.mock('./terminalSocket', () => ({
  TerminalSocket: vi.fn(function (deps: { onStatus: (s: string) => void }) {
    statusCb = deps.onStatus
    return { connect: connectMock, close: closeMock }
  }),
  buildTerminalWsUrl: vi.fn(),
}))

import TerminalPane from './TerminalPane.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

describe('TerminalPane', () => {
  it('mount and connect; show reconnect button when disconnected, click to reconnect', async () => {
    const w = mount(TerminalPane, { props: { containerId: 'c1' }, global: { plugins: [i18n] } })
    await nextTick()
    expect(connectMock).toHaveBeenCalledTimes(1)
    statusCb?.('closed')
    await nextTick()
    const btn = w.find('[data-test="term-reconnect"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(connectMock).toHaveBeenCalledTimes(2)
  })

  it('unmount closes socket and releases xterm instance', async () => {
    const w = mount(TerminalPane, { props: { containerId: 'c2' }, global: { plugins: [i18n] } })
    await nextTick()
    w.unmount()
    expect(closeMock).toHaveBeenCalled()
    expect(termMock.dispose).toHaveBeenCalled()
  })

  it('fullscreen button toggles fullscreen class', async () => {
    const w = mount(TerminalPane, { props: { containerId: 'c3' }, global: { plugins: [i18n] } })
    await nextTick()
    expect(w.find('.term-wrap').classes()).not.toContain('fullscreen')
    await w.find('[data-test="term-fs"]').trigger('click')
    expect(w.find('.term-wrap').classes()).toContain('fullscreen')
  })
})
