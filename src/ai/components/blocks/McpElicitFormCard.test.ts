import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import McpElicitFormCard from './McpElicitFormCard.vue'
import type { ElicitField } from '../../types/mcpElicit'

const resolveElicitation = vi.fn(async () => {})
vi.mock('../../composables/useProvidedAgentStore', () => ({
  useProvidedAgentStore: () => ({ resolveElicitation }),
}))

function field(over: Partial<ElicitField> = {}): ElicitField {
  return {
    key: 'name', type: 'string', title: '名字', description: '',
    required: true, default: null, format: null,
    min_length: null, max_length: null, minimum: null, maximum: null,
    options: null, min_items: null, max_items: null,
    ...over,
  }
}

function mountCard(props: Record<string, unknown> = {}) {
  return mount(McpElicitFormCard, {
    props: { confirmId: 'c1', server: 'brave', message: '请填写', fields: [field()], error: '', ...props },
    attachTo: document.body,
  })
}

function httpError(status: number) {
  return Object.assign(new Error('boom'), { response: { status } })
}

describe('McpElicitFormCard', () => {
  beforeEach(() => { resolveElicitation.mockClear(); resolveElicitation.mockResolvedValue(undefined) })

  it('填好后点「发送回答」:accept + 已填字段', async () => {
    const w = mountCard()
    await w.find('input.mcc-input').setValue('Ada')
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'accept', { name: 'Ada' })
    expect(w.text()).toContain('已把回答发给 brave')
  })

  it('浏览器校验门:reportValidity 为假时根本不发请求', async () => {
    const w = mountCard()
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => false
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).not.toHaveBeenCalled()
  })

  it('数组规则:min_items 不满足时写 submitError,不发请求', async () => {
    const w = mountCard({
      fields: [field({ key: 'tags', type: 'multi_enum', title: '标签', required: false, min_items: 1,
        options: [{ value: 'a', title: 'A' }] })],
    })
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => true
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).not.toHaveBeenCalled()
    expect(w.find('.mcc-err').text()).toContain('至少选 1 项')
  })

  it('空的可选字段整个不发送', async () => {
    const w = mountCard({ fields: [field({ required: false })] })
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => true
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'accept', {})
  })

  it('数字字段送出去的是 number 不是字符串', async () => {
    const w = mountCard({ fields: [field({ key: 'age', type: 'integer', title: '年龄', required: false })] })
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => true
    await w.find('input.mcc-input').setValue('42')
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'accept', { age: 42 })
  })

  it('「拒绝回答」发 decline 且 content 为 null', async () => {
    const w = mountCard()
    await w.findAll('button.mcc-btn')[1].trigger('click')
    await flushPromises()
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'decline', null)
    expect(w.text()).toContain('已拒绝回答 brave')
  })

  it('409 之后整卡折叠:不留任何按钮与表单', async () => {
    resolveElicitation.mockRejectedValueOnce(httpError(409))
    const w = mountCard()
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => true
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('确认已过期')
    expect(w.findAll('button')).toHaveLength(0)
    expect(w.find('form').exists()).toBe(false)
  })

  it('500 之后卡片仍可用,填的内容还在', async () => {
    resolveElicitation.mockRejectedValueOnce(httpError(500))
    const w = mountCard()
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => true
    await w.find('input.mcc-input').setValue('Ada')
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(w.find('form').exists()).toBe(true)
    expect((w.find('input.mcc-input').element as HTMLInputElement).value).toBe('Ada')
  })

  it('后端退回原因显示在卡上', () => {
    const w = mountCard({ error: 'name: must be at least 3 characters' })
    expect(w.find('.mcc-bounced').text()).toContain('must be at least 3 characters')
  })

  it('缺 confirmId 时点发送不发请求,只报无效', async () => {
    const w = mountCard({ confirmId: '' })
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => true
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).not.toHaveBeenCalled()
    expect(w.find('.mcc-err').text()).toContain('确认请求无效')
  })

  it('enum 渲染成 select,可选时首项是「（未作答）」', () => {
    const w = mountCard({
      fields: [field({ key: 'plan', type: 'enum', title: '套餐', required: false,
        options: [{ value: 'pro', title: 'Pro' }] })],
    })
    const opts = w.findAll('select.mcc-input option')
    expect(opts[0].text()).toBe('（未作答）')
    expect(opts[1].text()).toBe('Pro')
  })
})
