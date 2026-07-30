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

  // 【SP8-P2b 验收第 3 轮,用户 2026-07-30 报缺陷后改】原断言钉的是 Vue2
  // BlacklistSection.vue:82 的「对象就 JSON.stringify」行为 —— 用户在 Channels 添加机器人
  // 失败时因此在界面上看到了原文 `{"detail":"bot token rejected"}`,明确要求「不要直接把
  // 返回的 json 放上去」。**故意偏离 Vue2**:序列化整个响应体这条路彻底去掉,认不出就往下
  // 走到 error.message、最后落调用方的本地化兜底文案。
  it('response.data 是认不出的对象时不再 JSON 序列化,落到兜底(有意偏离 Vue2 :82)', () => {
    expect(apiErrorMessage({ response: { data: { code: 42 } } }, '兜底')).toBe('兜底')
    // 有 axios 自己的 message 时先走它(链路顺序不变)
    expect(apiErrorMessage({ response: { data: { code: 42 } }, message: 'Request failed' }, '兜底'))
      .toBe('Request failed')
  })

  // FastAPI(Python agent,`:8282`)把错误放在 `detail`,而 Go 服务用 `message`。
  // 原实现只认 message,于是 detail 一律掉进 JSON 序列化那条兜底 —— 这是本次缺陷的直接成因。
  it('认 FastAPI 的 detail 字段(Python agent 的错误形状)', () => {
    expect(apiErrorMessage({ response: { data: { detail: 'instance not found' } } }, '兜底'))
      .toBe('instance not found')
  })

  it('message 与 detail 同时存在时以 message 为先(Go 服务优先)', () => {
    expect(apiErrorMessage({ response: { data: { message: '来自 Go', detail: 'from py' } } }, '兜底'))
      .toBe('来自 Go')
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
