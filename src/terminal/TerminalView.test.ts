import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const createSession = vi.fn()
const keepalive = vi.fn()
const deleteSession = vi.fn()
const listWindows = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    terminal: {
      createSession: (pw?: string) => createSession(pw),
      keepalive: () => keepalive(),
      deleteSession: () => deleteSession(),
      listWindows: () => listWindows(),
      newWindow: vi.fn(),
      selectWindow: vi.fn(),
      closeWindow: vi.fn(),
      renameWindow: vi.fn(),
    },
  },
}))
// The view only calls router.push('/') from the back button; a spy router keeps
// the test free of the full route table.
const push = vi.fn()
vi.mock('vue-router', async (orig) => ({ ...(await orig<object>()), useRouter: () => ({ push }) }))

import TerminalView from './TerminalView.vue'

function httpErr(status?: number, data?: unknown) {
  const e = new Error('http') as Error & { response?: { status: number; data: unknown } }
  if (status !== undefined) e.response = { status, data }
  return e
}

beforeEach(() => {
  createSession.mockReset()
  keepalive.mockReset().mockResolvedValue(undefined)
  deleteSession.mockReset().mockResolvedValue(undefined)
  listWindows.mockReset().mockResolvedValue([{ index: 0, name: 'zsh', active: true }])
  push.mockReset()
})

describe('TerminalView', () => {
  it('renders the forbidden hint on 403', async () => {
    createSession.mockRejectedValue(httpErr(403))
    const w = mount(TerminalView)
    await flushPromises()
    expect(w.find('[data-test="term-forbidden"]').exists()).toBe(true)
    expect(w.find('iframe').isVisible()).toBe(false)
  })

  it('renders the error hint with a retry button that re-provisions', async () => {
    createSession.mockRejectedValueOnce(httpErr())
    const w = mount(TerminalView)
    await flushPromises()
    expect(w.find('[data-test="term-error"]').exists()).toBe(true)
    createSession.mockResolvedValue({ mode: 'off', idle_minutes: 15 })
    await w.find('[data-test="term-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('iframe').isVisible()).toBe(true)
  })

  it('when ready, shows the iframe pointed at the ticket-gated proxy and the window tabs', async () => {
    createSession.mockResolvedValue({ mode: 'off', idle_minutes: 15 })
    const w = mount(TerminalView)
    await flushPromises()
    const frame = w.find('iframe')
    expect(frame.attributes('src')).toBe('/v1/terminal/')
    expect(w.findAll('[data-test="win-tab"]')).toHaveLength(1)
  })

  it('shows the lock card when the policy demands a password', async () => {
    createSession.mockRejectedValue(httpErr(401, { password_required: true, mode: 'on_open', idle_minutes: 15 }))
    const w = mount(TerminalView)
    await flushPromises()
    expect(w.find('[data-test="pw-input"]').exists()).toBe(true)
  })

  it('returns the on_open ticket when unmounted', async () => {
    createSession.mockResolvedValue({ mode: 'on_open', idle_minutes: 15 })
    const w = mount(TerminalView)
    await flushPromises()
    w.unmount()
    expect(deleteSession).toHaveBeenCalledTimes(1)
  })
})
