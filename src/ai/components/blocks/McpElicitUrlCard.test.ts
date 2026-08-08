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
      confirmId: 'c1', server: 'notion', message: '请授权',
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

  it('点「打开并授权」:带 noopener,noreferrer 开新标签页并立刻 accept', async () => {
    const w = mountCard()
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(open).toHaveBeenCalledWith('https://auth.example.com/oauth?x=1', '_blank', 'noopener,noreferrer')
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'accept', null)
    expect(w.text()).toContain('已在新标签页打开')
  })

  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,<h1>hi'],
    ['blob:https://evil.example/x'],
    ['myapp://launch'],
  ])('scheme 白名单拦下 %s:不打开、不发请求', async (url) => {
    const w = mountCard({ url })
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(open).not.toHaveBeenCalled()
    expect(resolveElicitation).not.toHaveBeenCalled()
    expect(w.find('.mcc-err').text()).toContain('只允许 http 与 https')
  })

  it('http(非 https)允许打开,但 insecure 警告要在', async () => {
    const w = mountCard({ url: 'http://plain.example.com/x', host: 'plain.example.com', insecure: true })
    expect(w.text()).toContain('不是 HTTPS')
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(open).toHaveBeenCalled()
  })

  it('host 高亮:整条 URL 都在,host 单独成一段', () => {
    const w = mountCard()
    expect(w.find('.mcc-url .host').text()).toBe('auth.example.com')
    expect(w.find('.mcc-url').text()).toContain('https://')
    expect(w.find('.mcc-url').text()).toContain('/oauth?x=1')
  })

  it('host 在 URL 里找不到时整条落到 after,不崩', () => {
    const w = mountCard({ host: 'nowhere.example' })
    expect(w.find('.mcc-url .host').text()).toBe('')
    expect(w.find('.mcc-url').text()).toContain('https://auth.example.com/oauth?x=1')
  })

  it('punycode 警告;有 hostAscii 时并排显示 punycode 拼法', () => {
    const w = mountCard({ punycode: true, hostAscii: 'xn--80ak6aa92e.com' })
    expect(w.find('.mcc-alarm').text()).toContain('国际化域名')
    expect(w.find('.mcc-alarm .ascii').text()).toContain('xn--80ak6aa92e.com')
  })

  it('punycode 为真但 hostAscii 为空时不渲染并排行', () => {
    const w = mountCard({ punycode: true, hostAscii: '' })
    expect(w.find('.mcc-alarm').exists()).toBe(true)
    expect(w.find('.mcc-alarm .ascii').exists()).toBe(false)
  })

  it('409 之后整卡折叠,不留按钮', async () => {
    resolveElicitation.mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 409 } }))
    const w = mountCard()
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('确认已过期')
    expect(w.findAll('button')).toHaveLength(0)
  })

  it('「取消」发 cancel', async () => {
    const w = mountCard()
    await w.findAll('button.mcc-btn')[1].trigger('click')
    await flushPromises()
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'cancel', null)
    expect(open).not.toHaveBeenCalled()
  })
})
