import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SetSwitch from './SetSwitch.vue'

// SP8-P2a Task 6 —— 移植自 Vue2
// `src/views/AI/Settings/__tests__/SetSwitch.spec.js`(2 条断言,一条不丢)。
// Vue2 那两条是直接 .call() 组件的 methods;本仓改成真挂载 + 触发 DOM 事件,
// 判别力只增不减(它还顺带覆盖了模板上的 data-on / aria 绑定)。

describe('SetSwitch', () => {
  it('点击时同时 emit update:modelValue 与 change,值取反', async () => {
    const w = mount(SetSwitch, { props: { modelValue: false } })
    await w.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[true]])
    expect(w.emitted('change')).toEqual([[true]])
  })

  it('disabled 时点击什么都不发', async () => {
    const w = mount(SetSwitch, { props: { modelValue: true, disabled: true } })
    await w.trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(w.emitted('change')).toBeUndefined()
  })

  it('data-on 与 aria-checked 跟随 modelValue', async () => {
    const w = mount(SetSwitch, { props: { modelValue: false } })
    expect(w.attributes('data-on')).toBe('false')
    expect(w.attributes('aria-checked')).toBe('false')
    await w.setProps({ modelValue: true })
    expect(w.attributes('data-on')).toBe('true')
    expect(w.attributes('aria-checked')).toBe('true')
  })

  it('role=switch 且 disabled 反映在 aria-disabled 上', () => {
    const w = mount(SetSwitch, { props: { modelValue: false, disabled: true } })
    expect(w.attributes('role')).toBe('switch')
    expect(w.attributes('aria-disabled')).toBe('true')
  })

  it('title 透传', () => {
    const w = mount(SetSwitch, { props: { modelValue: false, title: '启用' } })
    expect(w.attributes('title')).toBe('启用')
  })
})
