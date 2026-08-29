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
  refreshAccessToken: vi.fn().mockResolvedValue('token'),
}))
// The view only calls router.push('/') from the back button; a spy router keeps
// the test free of the full route table.
const push = vi.fn()
vi.mock('vue-router', async (orig) => ({ ...(await orig<object>()), useRouter: () => ({ push }) }))
// Keep decodeOsc52 real; only the clipboard write is stubbed (jsdom has no execCommand).
const copyText = vi.fn()
vi.mock('./osc52', async (orig) => ({ ...(await orig<object>()), writeClipboard: (text: string) => copyText(text) }))

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
  copyText.mockReset().mockResolvedValue(undefined)
})

// Mount attached to the document so jsdom gives the iframe a real (about:blank)
// contentWindow/contentDocument, then plant ttyd's `window.term` shape on it.
async function mountReady(selection: string) {
  createSession.mockResolvedValue({ mode: 'off', idle_minutes: 15 })
  const w = mount(TerminalView, { attachTo: document.body })
  await flushPromises()
  const frame = w.find('iframe').element as HTMLIFrameElement
  const win = frame.contentWindow as (Window & { term?: unknown })
  const osc: { cb?: (data: string) => boolean | Promise<boolean>; dispose: ReturnType<typeof vi.fn> } = { dispose: vi.fn() }
  const term = {
    getSelection: vi.fn(() => selection),
    focus: vi.fn(),
    parser: { registerOscHandler: vi.fn((_id: number, cb: (data: string) => boolean | Promise<boolean>) => { osc.cb = cb; return { dispose: osc.dispose } }) },
  }
  win.term = term
  await w.find('iframe').trigger('load')
  return { w, doc: win.document, term, osc }
}
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))

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

  it('renders back-home and the window tabs in one header row, with no page title', async () => {
    createSession.mockResolvedValue({ mode: 'off', idle_minutes: 15 })
    const w = mount(TerminalView)
    await flushPromises()
    const head = w.find('header.term-head')
    expect(head.find('[data-test="term-back"]').exists()).toBe(true)
    expect(head.findAll('[data-test="win-tab"]')).toHaveLength(1)
    expect(w.find('.term-title').exists()).toBe(false)
    expect(w.find('h2').exists()).toBe(false)
    await head.find('[data-test="term-back"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/')
  })

  it('copies the xterm selection on mouseup inside the iframe and shows what was copied', async () => {
    const { w, doc, term } = await mountReady('ls -la /DATA')
    doc.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }))
    await flushPromises()
    expect(copyText).toHaveBeenCalledWith('ls -la /DATA')
    expect(term.focus).toHaveBeenCalled()
    const pill = w.find('[data-test="term-copied"]')
    expect(pill.exists()).toBe(true)
    expect(pill.text()).toContain('ls -la /DATA')
    w.unmount()
  })

  it('does nothing on mouseup when xterm has no selection or the button is not primary', async () => {
    const { w, doc, term } = await mountReady('')
    doc.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }))
    await flushPromises()
    expect(copyText).not.toHaveBeenCalled()
    expect(w.find('[data-test="term-copied"]').exists()).toBe(false)
    term.getSelection = vi.fn(() => 'secret')
    doc.dispatchEvent(new MouseEvent('mouseup', { button: 2, bubbles: true }))
    await flushPromises()
    expect(copyText).not.toHaveBeenCalled()
    w.unmount()
  })

  it('stays quiet when the clipboard write fails', async () => {
    copyText.mockRejectedValue(new Error('no clipboard'))
    const { w, doc } = await mountReady('echo hi')
    doc.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }))
    await flushPromises()
    expect(copyText).toHaveBeenCalledWith('echo hi')
    expect(w.find('[data-test="term-copied"]').exists()).toBe(false)
    w.unmount()
  })

  it('hooks OSC 52 on the xterm parser and copies what tmux sends on a mouse-drag release', async () => {
    const { w, term, osc } = await mountReady('')
    expect(term.parser.registerOscHandler).toHaveBeenCalledWith(52, expect.any(Function))
    expect(osc.cb!('c;' + b64('cat /etc/os-release'))).toBe(true)
    await flushPromises()
    expect(copyText).toHaveBeenCalledWith('cat /etc/os-release')
    expect(term.focus).toHaveBeenCalled()
    expect(w.find('[data-test="term-copied"]').text()).toContain('cat /etc/os-release')
    w.unmount()
    expect(osc.dispose).toHaveBeenCalled()
  })

  it('ignores OSC 52 clipboard queries and empty payloads', async () => {
    const { w, osc } = await mountReady('')
    expect(osc.cb!('c;?')).toBe(false)
    expect(osc.cb!('c;')).toBe(false)
    await flushPromises()
    expect(copyText).not.toHaveBeenCalled()
    expect(w.find('[data-test="term-copied"]').exists()).toBe(false)
    w.unmount()
  })
})
