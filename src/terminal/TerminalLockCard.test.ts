import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TerminalLockCard from './TerminalLockCard.vue'

describe('TerminalLockCard', () => {
  it('emits submit with the typed password on enter and on the unlock button', async () => {
    const w = mount(TerminalLockCard, { props: { pwError: false, frozenSeconds: 0 } })
    await w.find('[data-test="pw-input"]').setValue('s3cret')
    await w.find('[data-test="pw-input"]').trigger('keyup.enter')
    await w.find('[data-test="pw-submit"]').trigger('click')
    expect(w.emitted('submit')).toEqual([['s3cret'], ['s3cret']])
  })

  it('shows the wrong-password line only when pwError', async () => {
    const w = mount(TerminalLockCard, { props: { pwError: true, frozenSeconds: 0 } })
    expect(w.find('[data-test="pw-error"]').exists()).toBe(true)
    await w.setProps({ pwError: false })
    expect(w.find('[data-test="pw-error"]').exists()).toBe(false)
  })

  it('freeze disables input and button and shows the countdown', () => {
    const w = mount(TerminalLockCard, { props: { pwError: false, frozenSeconds: 42 } })
    expect((w.find('[data-test="pw-input"]').element as HTMLInputElement).disabled).toBe(true)
    expect((w.find('[data-test="pw-submit"]').element as HTMLButtonElement).disabled).toBe(true)
    expect(w.find('[data-test="pw-frozen"]').text()).toContain('42')
  })

  it('carries the session-resume subtitle (backend boundary ③)', () => {
    const w = mount(TerminalLockCard, { props: { pwError: false, frozenSeconds: 0 } })
    expect(w.find('[data-test="lock-resume"]').exists()).toBe(true)
  })
})
