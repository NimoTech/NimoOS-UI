## Task 11: `channelsFormat` 纯函数

**Files:**
- Create: `src/ai/util/channelsFormat.ts`
- Create: `src/ai/util/channelsFormat.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ChannelBinding {
    id: string | number; external_username?: string; external_user_id?: string
    instance_name?: string; channel_type?: string; default_model?: string | null; download_dir?: string
  }
  export function bindingLabel(b: ChannelBinding, noLabelText: string): string
  export function fillPairInstructions(template: string, bot: string, code: string): string
  export function fillTokenTail(template: string, tail: string): string
  ```
  Task 12 消费全部三项。

- [ ] **Step 1: 写失败的测试**

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/ai/util/channelsFormat.test.ts` → FAIL（模块不存在）

- [ ] **Step 3: 实现**

```ts
// SP8-P2b Task 11 —— 1:1 取自 Vue2 src/views/AI/Settings/sections/ChannelsSection.vue
// 的 bindingLabel(:281-284)与 pairInstructions computed(:121-127),以及模板里
// channelsBotTokenTail 的 split/join 填充(:36)。
//
// 抽成纯函数与 Task 9 同理:Vue2 既有测试直调 methods,<script setup> 不可借 this。
// 三个函数都不碰 i18n —— 文案由调用方 t() 出来再传进来,这样纯函数可脱离 vue-i18n 测试。
export interface ChannelBinding {
  id: string | number
  external_username?: string
  external_user_id?: string
  instance_name?: string
  channel_type?: string
  default_model?: string | null
  download_dir?: string
}

export function bindingLabel(b: ChannelBinding, noLabelText: string): string {
  if (b.external_username) return `@${b.external_username}`
  return b.external_user_id || noLabelText
}

export function fillPairInstructions(template: string, bot: string, code: string): string {
  return template.split('{bot}').join(bot).split('{code}').join(code)
}

export function fillTokenTail(template: string, tail: string): string {
  return template.split('{tail}').join(tail)
}
```

- [ ] **Step 4: 跑测试确认通过（7 例）+ 全量测试门 + 提交**

```bash
pnpm test src/ai/util/channelsFormat.test.ts
pnpm test && pnpm exec vue-tsc --noEmit && pnpm build
git add src/ai/util/channelsFormat.ts src/ai/util/channelsFormat.test.ts
git commit -m "SP8-P2b Task 11: channelsFormat 纯函数(绑定标签/配对指引/token 尾号)"
git show --stat HEAD && git status
```

---

