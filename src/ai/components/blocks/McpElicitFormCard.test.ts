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

  it('after filling in and clicking "send answer": accept + filled fields', async () => {
    const w = mountCard()
    await w.find('input.mcc-input').setValue('Ada')
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'accept', { name: 'Ada' })
    expect(w.text()).toContain('已把回答发给 brave')
  })

  it('browser validation gate: when reportValidity is false, no request is sent at all', async () => {
    const w = mountCard()
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => false
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).not.toHaveBeenCalled()
  })

  it('array rules: when min_items is not met, write submitError and don\'t send request', async () => {
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

  it('empty optional field is not sent at all', async () => {
    const w = mountCard({ fields: [field({ required: false })] })
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => true
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'accept', {})
  })

  it('number field is sent as number not string', async () => {
    const w = mountCard({ fields: [field({ key: 'age', type: 'integer', title: '年龄', required: false })] })
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => true
    await w.find('input.mcc-input').setValue('42')
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'accept', { age: 42 })
  })

  it('clicking "refuse to answer" sends decline and content is null', async () => {
    const w = mountCard()
    await w.findAll('button.mcc-btn')[1].trigger('click')
    await flushPromises()
    expect(resolveElicitation).toHaveBeenCalledWith('c1', 'decline', null)
    expect(w.text()).toContain('已拒绝回答 brave')
  })

  it('after 409, entire card collapses: no buttons or form left', async () => {
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

  it('after 500, card is still usable and filled content remains', async () => {
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

  it('backend rejection reason is shown on card', () => {
    const w = mountCard({ error: 'name: must be at least 3 characters' })
    expect(w.find('.mcc-bounced').text()).toContain('must be at least 3 characters')
  })

  it('multi_enum numeric default matches stringified options and is pre-checked (backend converts options to string but keeps default as-is)', () => {
    const w = mountCard({
      fields: [field({ key: 'tags', type: 'multi_enum', title: '标签', required: false,
        default: [1], options: [{ value: '1', title: 'One' }, { value: '2', title: 'Two' } ] })],
    })
    const boxes = w.findAll('.mcc-multi input[type="checkbox"]')
    expect((boxes[0].element as HTMLInputElement).checked).toBe(true)
    expect((boxes[1].element as HTMLInputElement).checked).toBe(false)
  })

  it('when confirmId is missing, clicking send doesn\'t make a request, only reports invalid', async () => {
    const w = mountCard({ confirmId: '' })
    const form = w.find('form').element as HTMLFormElement
    form.reportValidity = () => true
    await w.find('button.mcc-btn.primary').trigger('click')
    await flushPromises()
    expect(resolveElicitation).not.toHaveBeenCalled()
    expect(w.find('.mcc-err').text()).toContain('确认请求无效')
  })

  it('enum renders as select, when optional first item is "(unanswered)"', () => {
    const w = mountCard({
      fields: [field({ key: 'plan', type: 'enum', title: '套餐', required: false,
        options: [{ value: 'pro', title: 'Pro' }] })],
    })
    const opts = w.findAll('select.mcc-input option')
    expect(opts[0].text()).toBe('（未作答）')
    expect(opts[1].text()).toBe('Pro')
  })

  it('format:uri does not render type="url" (stricter than backend rules, would reject mailto: etc. that backend accepts)', () => {
    const w = mountCard({
      fields: [field({ key: 'contact', title: '联系方式', required: false, format: 'uri' })],
    })
    const input = w.find('input.mcc-input').element as HTMLInputElement
    expect(input.type).not.toBe('url')
    expect(input.type).toBe('text')
  })

  it('format:email/date/date-time each map to corresponding native input type', () => {
    const email = mountCard({
      fields: [field({ key: 'contact', title: '邮箱', required: false, format: 'email' })],
    })
    expect((email.find('input.mcc-input').element as HTMLInputElement).type).toBe('email')

    const date = mountCard({
      fields: [field({ key: 'day', title: '日期', required: false, format: 'date' })],
    })
    expect((date.find('input.mcc-input').element as HTMLInputElement).type).toBe('date')

    const dateTime = mountCard({
      fields: [field({ key: 'when', title: '时间', required: false, format: 'date-time' })],
    })
    expect((dateTime.find('input.mcc-input').element as HTMLInputElement).type).toBe('datetime-local')
  })
})
