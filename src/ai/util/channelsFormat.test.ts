// SP8-P2b Task 11 — 见 channelsFormat.ts 头注释:这 7 例直接依据 Vue2
// ChannelsSection.vue 的 bindingLabel(:304-307)/pairInstructions(:185-190)/
// channelsBotTokenTail 模板填充(:29)源码行为编写(brief Step 1 原样落地),
// 而非承接自 NimoOS-UI ChannelsSection.spec.js —— 该 spec 对这两个方法没有
// 直接断言(genCode 测试注释明确说明未测 {bot}/{code} 替换)。
import { describe, it, expect } from 'vitest'
import { bindingLabel, fillPairInstructions, fillTokenTail } from './channelsFormat'

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
