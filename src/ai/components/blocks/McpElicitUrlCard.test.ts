import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import McpElicitUrlCard from './McpElicitUrlCard.vue'

const resolveElicitation = vi.fn(async () => {})
vi.mock('../../composables/useProvidedAgentStore', () => ({
  useProvidedAgentStore: () => ({ resolveElicitation }),
}))

function mountCard(props: Record<string, unknown> = {}) {
  return mount(McpElicitUrlCard, {
    props: {
      confirmId: 'c1', server: 'notion', message: 'Please authorize',
      url: 'https://auth.example.com/oauth?x=1', host: 'auth.example.com',
      hostAscii: '', punycode: false, insecure: false, ...props,
    },
  })
}

describe('McpElicitUrlCard', () => {
  let open: ReturnType<typeof vi.fn>
  beforeEach(() => {
    resolveElicitation.mockClear(); resolveElicitation.mockResolvedValue(undefined)
    open = vi.fn()
    vi.stubGlobal('open', open)
  })

  it('clicking "open and authorize": open new tab with noopener,noreferrer and accept immediately', async () => {
    const w = mountCard()
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(open).toHaveBeenCalledWith('https://auth.example.com/oauth?x=1', '_blank', 'noopener,noreferrer')
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'accept', null)
    expect(w.text()).toContain('opened in new tab')
  })

  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,<h1>hi'],
    ['blob:https://evil.example/x'],
    ['myapp://launch'],
  ])('scheme whitelist blocks %s: does not open or send request', async (url) => {
    const w = mountCard({ url })
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(open).not.toHaveBeenCalled()
    expect(resolveElicitation).not.toHaveBeenCalled()
    expect(w.find('.mcc-err').text()).toContain('only allow http and https')
  })

  it('http(not https) is allowed to open, but insecure warning must be present', async () => {
    const w = mountCard({ url: 'http://plain.example.com/x', host: 'plain.example.com', insecure: true })
    expect(w.text()).toContain('is not HTTPS')
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(open).toHaveBeenCalled()
  })

  it('host highlight: entire URL is present, host is separate segment', () => {
    const w = mountCard()
    expect(w.find('.mcc-url .host').text()).toBe('auth.example.com')
    expect(w.find('.mcc-url').text()).toContain('https://')
    expect(w.find('.mcc-url').text()).toContain('/oauth?x=1')
  })

  it('when host is not found in URL, entire string goes to after, does not crash', () => {
    const w = mountCard({ host: 'nowhere.example' })
    expect(w.find('.mcc-url .host').text()).toBe('')
    expect(w.find('.mcc-url').text()).toContain('https://auth.example.com/oauth?x=1')
  })

  it('punycode warning; when hostAscii present, display punycode spelling side-by-side', () => {
    const w = mountCard({ punycode: true, hostAscii: 'xn--80ak6aa92e.com' })
    expect(w.find('.mcc-alarm').text()).toContain('internationalized domain name')
    expect(w.find('.mcc-alarm .ascii').text()).toContain('xn--80ak6aa92e.com')
  })

  it('when punycode is true but hostAscii is empty, does not render side-by-side row', () => {
    const w = mountCard({ punycode: true, hostAscii: '' })
    expect(w.find('.mcc-alarm').exists()).toBe(true)
    expect(w.find('.mcc-alarm .ascii').exists()).toBe(false)
  })

  it('after 409, entire card collapses, no buttons left', async () => {
    resolveElicitation.mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 409 } }))
    const w = mountCard()
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('confirmation expired')
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('clicking "cancel" sends cancel', async () => {
    const w = mountCard()
    await w.findAll('button.mcc-btn')[1].trigger('click')
    await flushPromises()
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'cancel', null)
    expect(open).not.toHaveBeenCalled()
  })
})
