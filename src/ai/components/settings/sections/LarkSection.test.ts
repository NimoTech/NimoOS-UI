import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../../i18n/zh_cn'

const h = vi.hoisted(() => ({
  getLarkBinding: vi.fn(),
  startLarkBinding: vi.fn(),
  deleteLarkBinding: vi.fn(),
}))
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    ai: {
      getLarkBinding: h.getLarkBinding,
      startLarkBinding: h.startLarkBinding,
      deleteLarkBinding: h.deleteLarkBinding,
    },
  },
}))
const pushMock = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }))

import LarkSection from './LarkSection.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const mountSection = () =>
  mount(LarkSection, {
    props: { pollIntervalMs: 1 },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
const flush = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}

describe('LarkSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    h.getLarkBinding.mockReset()
    h.startLarkBinding.mockReset()
    h.deleteLarkBinding.mockReset()
    pushMock.mockReset()
    const host = document.createElement('div')
    host.className = 'set-app'
    document.body.appendChild(host)
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('unbound state shows the bind CTA', async () => {
    h.getLarkBinding.mockResolvedValue({ phase: 'unbound' })
    const w = mountSection()
    await flush()
    expect(w.find('[data-test="lark-bind"]').exists()).toBe(true)
    expect(w.text()).toContain('绑定飞书账号')
  })

  it('bind click starts the flow, shows the verify URL, and polls to bound', async () => {
    h.getLarkBinding
      .mockResolvedValueOnce({ phase: 'unbound' })
      .mockResolvedValueOnce({
        phase: 'await_verify',
        verify_url: 'https://open.feishu.cn/verify?code=x',
      })
      .mockResolvedValue({
        phase: 'bound',
        identity: { onBehalfOf: { userName: 'Nimo' }, tenant_key: 't1' },
      })
    h.startLarkBinding.mockResolvedValue({ phase: 'starting' })
    const w = mountSection()
    await flush()
    await w.find('[data-test="lark-bind"]').trigger('click')
    await new Promise((r) => setTimeout(r, 20))
    await flush()
    expect(h.startLarkBinding).toHaveBeenCalled()
    expect(w.find('[data-test="lark-identity"]').text()).toBe('Nimo · t1')
  })

  it('resumes polling when mounted mid-flow and renders the verify link', async () => {
    h.getLarkBinding
      .mockResolvedValueOnce({
        phase: 'polling',
        verify_url: 'https://open.feishu.cn/verify?code=y',
      })
      .mockResolvedValue({ phase: 'bound', identity: {} })
    const w = mountSection()
    await flush()
    const input = w.find('[data-test="lark-verify-url"]')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toContain('open.feishu.cn')
    await new Promise((r) => setTimeout(r, 10))
    await flush()
    expect(w.text()).toContain('已绑定')
  })

  it('unbind flows through the AlertDialog confirm', async () => {
    h.getLarkBinding.mockResolvedValue({ phase: 'bound', identity: { name: 'N' } })
    h.deleteLarkBinding.mockResolvedValue({})
    const w = mountSection()
    await flush()
    await w.find('[data-test="lark-unbind"]').trigger('click')
    await flush()
    const confirmBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent && b.textContent.includes('解绑') && b.closest('[role="alertdialog"]'),
    )
    expect(confirmBtn, 'AlertDialog confirm button should render').toBeTruthy()
    confirmBtn!.click()
    await flush()
    expect(h.deleteLarkBinding).toHaveBeenCalled()
    expect(w.find('[data-test="lark-bind"]').exists()).toBe(true)
  })

  it('failed state with a not-installed error links to the toolbox section', async () => {
    h.getLarkBinding.mockResolvedValue({
      phase: 'failed',
      error: 'lark-cli is not installed',
      log: 'npm ERR',
    })
    const w = mountSection()
    await flush()
    expect(w.find('[data-test="lark-error"]').text()).toContain('not installed')
    await w.find('.lark-tb-link').trigger('click')
    expect(pushMock).toHaveBeenCalledWith({
      path: '/ai/settings',
      query: { section: 'toolbox' },
    })
    expect(w.text()).toContain('最近一次 CLI 输出')
  })
})
