import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SetSwitch from './SetSwitch.vue'

// SP8-P2a Task 6 — ported from Vue2
// `src/views/AI/Settings/__tests__/SetSwitch.spec.js` (2 assertions, keep all).
// Vue2's two are direct .call() on component methods; this repo changed to real mount + trigger DOM events,
// asserting power only increases (it also incidentally covers data-on / aria bindings on template).

describe('SetSwitch', () => {
  it('clicking emits update:modelValue and change at once, value inverted', async () => {
    const w = mount(SetSwitch, { props: { modelValue: false } })
    await w.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[true]])
    expect(w.emitted('change')).toEqual([[true]])
  })

  it('when disabled, clicking doesn\'t emit anything', async () => {
    const w = mount(SetSwitch, { props: { modelValue: true, disabled: true } })
    await w.trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(w.emitted('change')).toBeUndefined()
  })

  it('data-on and aria-checked follow modelValue', async () => {
    const w = mount(SetSwitch, { props: { modelValue: false } })
    expect(w.attributes('data-on')).toBe('false')
    expect(w.attributes('aria-checked')).toBe('false')
    await w.setProps({ modelValue: true })
    expect(w.attributes('data-on')).toBe('true')
    expect(w.attributes('aria-checked')).toBe('true')
  })

  it('role=switch and disabled reflect on aria-disabled', () => {
    const w = mount(SetSwitch, { props: { modelValue: false, disabled: true } })
    expect(w.attributes('role')).toBe('switch')
    expect(w.attributes('aria-disabled')).toBe('true')
  })

  it('title is passed through', () => {
    const w = mount(SetSwitch, { props: { modelValue: false, title: 'Enable' } })
    expect(w.attributes('title')).toBe('Enable')
  })
})
