import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import FormatDialog from './FormatDialog.vue'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('FormatDialog', () => {
  it('renders the name-interpolated message and password field on open; confirm is disabled without a password', async () => {
    const w = mount(FormatDialog, { props: { open: true, name: 'Storage1' } })
    await w.vm.$nextTick()
    const msg = document.body.querySelector<HTMLParagraphElement>('.fd-msg')
    expect(msg?.textContent).toContain('Storage1')
    const input = document.body.querySelector<HTMLInputElement>('.fd-input')
    expect(input).toBeTruthy()
    const okBtn = document.body.querySelector<HTMLButtonElement>('.fd-btn.danger')
    expect(okBtn?.disabled).toBe(true)
  })
  it('typing a password and clicking confirm emits confirm(password)', async () => {
    const w = mount(FormatDialog, { props: { open: true, name: 'Storage1' } })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.fd-input')!
    input.value = 'secret'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.fd-btn.danger')!.click()
    expect(w.emitted('confirm')![0]).toEqual(['secret'])
  })
  it('pressing Enter submits and emits confirm(password)', async () => {
    const w = mount(FormatDialog, { props: { open: true, name: 'A' } })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.fd-input')!
    input.value = 'secret'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    expect(w.emitted('confirm')![0]).toEqual(['secret'])
  })
  it('disables both confirm and cancel buttons while busy', async () => {
    const w = mount(FormatDialog, { props: { open: true, name: 'A', busy: true } })
    await w.vm.$nextTick()
    const btns = document.body.querySelectorAll<HTMLButtonElement>('.fd-btn')
    expect(btns.length).toBeGreaterThan(0)
    expect(Array.from(btns).every((b) => b.disabled)).toBe(true)
  })
  it('does not submit on Enter while busy', async () => {
    const w = mount(FormatDialog, { props: { open: true, name: 'A', busy: true } })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.fd-input')!
    input.value = 'secret'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    expect(w.emitted('confirm')).toBeUndefined()
  })
  it('clears the password when the dialog closes (plaintext must not linger after cancel, even without reopening)', async () => {
    const w = mount(FormatDialog, { props: { open: true, name: 'A' } })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.fd-input')!
    input.value = 'secret'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.vm.$nextTick()
    // Deliberately does not reopen: this assertion only passes when the "clearing on
    // close itself" code path is implemented — the old `if (o) password.value = ''`
    // implementation still leaves the plaintext 'secret' here.
    expect(document.body.querySelector<HTMLInputElement>('.fd-input')!.value).toBe('')
  })
})
