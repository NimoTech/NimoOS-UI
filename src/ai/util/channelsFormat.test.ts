// SP8-P2b Task 11 — 见 channelsFormat.ts 头注释:这 7 例直接依据 Vue2
// ChannelsSection.vue 的 bindingLabel(:304-307)/pairInstructions(:185-190)/
// channelsBotTokenTail 模板填充(:29)源码行为编写(brief Step 1 原样落地),
// 而非承接自 NimoOS-UI ChannelsSection.spec.js —— 该 spec 对这两个方法没有
// 直接断言(genCode 测试注释明确说明未测 {bot}/{code} 替换)。
import { describe, it, expect } from 'vitest'
import { bindingLabel, fillPairInstructions, fillTokenTail, addBotErrorKey } from './channelsFormat'

describe('channelsFormat', () => {
  it('bindingLabel 有用户名时加 @ 前缀', () => {
    expect(bindingLabel({ id: 1, external_username: 'nimo' }, '(无标签)')).toBe('@nimo')
  })

  it('bindingLabel 无用户名时回落到外部用户 id', () => {
    expect(bindingLabel({ id: 1, external_user_id: '12345' }, '(无标签)')).toBe('12345')
  })

  it('bindingLabel 两者都无时用传入的兜底文案', () => {
    expect(bindingLabel({ id: 1 }, '(无标签)')).toBe('(无标签)')
  })

  it('bindingLabel 空字符串用户名不算有值（Vue2 是真值判断）', () => {
    expect(bindingLabel({ id: 1, external_username: '', external_user_id: '9' }, '(无标签)')).toBe('9')
  })

  it('fillPairInstructions 替换 {bot} 与 {code}', () => {
    expect(fillPairInstructions('给 @{bot} 发送:/pair {code}', 'nimobot', 'ABC123'))
      .toBe('给 @nimobot 发送:/pair ABC123')
  })

  it('fillPairInstructions bot 为空时不产出 undefined', () => {
    expect(fillPairInstructions('给 @{bot} 发 {code}', '', 'X')).toBe('给 @ 发 X')
  })

  it('fillTokenTail 替换 {tail}', () => {
    expect(fillTokenTail('token ···{tail}', '8f2c')).toBe('token ···8f2c')
  })
})

// 【SP8-P2b 验收第 3 轮,用户 2026-07-30 拍板】添加机器人失败时界面上直接出现了后端原文
// `{"detail":"bot token rejected"}`。用户要求:换成人看得懂的话、不许把 JSON 糊上去、
// 而且要多语言。故新增本映射:把后端 detail 归一成 **i18n 键**(纯函数不碰 t(),与本档
// 其余函数同一分工),调用方再 t() 出当前语言的文案。后端(NimoOS-AI/agent/main.py:417-424)
// 这个接口一共只有三种 422 detail,逐一映射;其余一律落到通用兜底键,**永不回显后端原文**。
describe('addBotErrorKey —— 后端 detail → i18n 键', () => {
  it('bot token rejected → 专用键', () => {
    expect(addBotErrorKey({ response: { data: { detail: 'bot token rejected' } } }))
      .toBe('aiCfgChannelsErrTokenRejected')
  })

  it('bot_token required → 专用键', () => {
    expect(addBotErrorKey({ response: { data: { detail: 'bot_token required' } } }))
      .toBe('aiCfgChannelsErrTokenRequired')
  })

  it('unsupported channel_type → 专用键', () => {
    expect(addBotErrorKey({ response: { data: { detail: 'unsupported channel_type' } } }))
      .toBe('aiCfgChannelsErrUnsupportedType')
  })

  it('大小写/前后空白不影响匹配', () => {
    expect(addBotErrorKey({ response: { data: { detail: '  BOT TOKEN REJECTED ' } } }))
      .toBe('aiCfgChannelsErrTokenRejected')
  })

  it('Go 服务风格的 message 字段也参与匹配(同一入口两种后端)', () => {
    expect(addBotErrorKey({ response: { data: { message: 'bot token rejected' } } }))
      .toBe('aiCfgChannelsErrTokenRejected')
  })

  it('认不出的后端文案 → 通用兜底键(而不是把原文/JSON 回显出去)', () => {
    expect(addBotErrorKey({ response: { data: { detail: '机器人名额已满' } } }))
      .toBe('aiCfgChannelsAddBotFailed')
    expect(addBotErrorKey({ response: { data: { code: 42, hint: 'x' } } }))
      .toBe('aiCfgChannelsAddBotFailed')
    expect(addBotErrorKey(new Error('Network Error'))).toBe('aiCfgChannelsAddBotFailed')
    expect(addBotErrorKey(null)).toBe('aiCfgChannelsAddBotFailed')
    expect(addBotErrorKey(undefined)).toBe('aiCfgChannelsAddBotFailed')
  })
})
