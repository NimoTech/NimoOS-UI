import { describe, it, expect } from 'vitest'
import { apiErrorMessage } from './apiError'

describe('apiErrorMessage', () => {
  it('优先取 response.data.message', () => {
    const e = { response: { data: { message: '后端说不行' } }, message: 'axios 说不行' }
    expect(apiErrorMessage(e, '兜底')).toBe('后端说不行')
  })

  it('response.data 是字符串时直接用', () => {
    expect(apiErrorMessage({ response: { data: 'plain text 错误' } }, '兜底')).toBe('plain text 错误')
  })

  it('response.data 是没有 message 的对象时 JSON 序列化（Vue2 BlacklistSection.vue:82 同款行为）', () => {
    expect(apiErrorMessage({ response: { data: { code: 42 } } }, '兜底')).toBe('{"code":42}')
  })

  it('没有 response 时退到 error.message', () => {
    expect(apiErrorMessage(new Error('网络断了'), '兜底')).toBe('网络断了')
  })

  it('什么都没有时用 fallback', () => {
    expect(apiErrorMessage({}, '兜底')).toBe('兜底')
    expect(apiErrorMessage(null, '兜底')).toBe('兜底')
    expect(apiErrorMessage(undefined, '兜底')).toBe('兜底')
  })

  it('空字符串不算有效消息，退到下一级', () => {
    expect(apiErrorMessage({ response: { data: '' }, message: 'axios 说不行' }, '兜底')).toBe('axios 说不行')
    expect(apiErrorMessage({ message: '' }, '兜底')).toBe('兜底')
  })
})
