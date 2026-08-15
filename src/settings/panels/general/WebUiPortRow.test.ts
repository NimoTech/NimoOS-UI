import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn'
import zhSp9 from '../../../i18n/zh_cn.sp9'

const state = {
  port: '80',
  editCalls: [] as unknown[],
  editFail: false,
  // Only for the interleaving test below ("user already edited while mounting" case): when
  // non-null, getServerPort returns this instead of state.port, so we can manually control
  // when onMounted's await resolves. Other cases leave this unset and behave as before.
  portPromise: null as Promise<string> | null,
}
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      getServerPort: async () => (state.portPromise ? state.portPromise : state.port),
      editServerPort: async (p: { port: string }) => {
        state.editCalls.push(p)
        if (state.editFail) throw new Error('boom')
      },
    },
  },
}))

import WebUiPortRow from './WebUiPortRow.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
// navigate is an optional prop (not passed in production → real navigation); tests pass a spy.
// Not using defineExpose to open a test-only backdoor — that would be a production API existing only for tests.
const mountRow = (navigate?: (url: string) => void) =>
  mount(WebUiPortRow, { props: navigate ? { navigate } : {}, global: { plugins: [i18n] } })

beforeEach(() => {
  setActivePinia(createPinia())
  state.port = '80'
  state.editCalls = []
  state.editFail = false
  state.portPromise = null
  vi.useFakeTimers()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('WebUiPortRow', () => {
  it('fills in the current port after mounting', async () => {
    const w = mountRow()
    await flushPromises()
    expect((w.find('input').element as HTMLInputElement).value).toBe('80')
  })

  // Interleaving-guard regression test (a 4th behaviour beyond porting rule #4: the initial
  // async load must not stomp on a user edit).
  // Key point: must exercise the "edit first, resolve second" interleaving path, and the
  // snapshot used to resolve must be captured *before* the edit — otherwise the "stale value"
  // would actually equal what the user just typed, and the test would pass even with no guard
  // in place, proving nothing.
  it('user has already edited while mounting: onMounted\'s stale port must not overwrite the user\'s input (interleaving guard)', async () => {
    let resolveLoad!: (v: string) => void
    state.portPromise = new Promise<string>((resolve) => { resolveLoad = resolve })
    const w = mountRow()
    await flushPromises()
    // While the load hasn't resolved yet, the user edits the input first
    await w.find('input').setValue('9999')
    // Only now let onMounted's await proceed — using the '80' snapshot captured before the edit
    resolveLoad('80')
    await flushPromises()
    expect((w.find('input').element as HTMLInputElement).value).toBe('9999')
  })

  it('does not show the submit button when the port is unchanged (maps to Vue2 portChanged)', async () => {
    const w = mountRow()
    await flushPromises()
    expect(w.find('.wpr-submit').exists()).toBe(false)
  })

  it('the submit button appears after a change', async () => {
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    expect(w.find('.wpr-submit').exists()).toBe(true)
  })

  it('out-of-range port: shows an error and sends no request', async () => {
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('79')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    expect(state.editCalls).toEqual([])
    expect(w.text()).toContain('端口范围为 80-65535')
  })

  it('valid port: sends port as a string', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down') }))
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    expect(state.editCalls).toEqual([{ port: '8080' }])
  })

  it('save config fails: stays put with an error, does not enter probing', async () => {
    state.editFail = true
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('navigates to the current page on the new port once probing succeeds (porting rule #5)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: 200, data: '8080' }) })))
    const assign = vi.fn()
    const w = mountRow(assign)
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1500)
    await flushPromises()
    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign.mock.calls[0][0]).toContain(':8080')
  })

  it('still unreachable after hitting the probe limit: stops the timer + prompts manual navigation, does not probe forever (porting rule #4)', async () => {
    const fetchSpy = vi.fn(async () => { throw new TypeError('down') })
    vi.stubGlobal('fetch', fetchSpy)
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(1500 * 45)
    await flushPromises()
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(40)
    expect(w.text()).toContain('新端口没有响应')
  })

  it('stops the timer after unmount (leaves no dangling timer)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down') }))
    const w = mountRow()
    await flushPromises()
    await w.find('input').setValue('8080')
    await w.find('.wpr-submit').trigger('click')
    await flushPromises()
    w.unmount()
    const before = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    await vi.advanceTimersByTimeAsync(1500 * 5)
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before)
  })
})
