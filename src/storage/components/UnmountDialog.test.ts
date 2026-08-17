import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UnmountDialog from './UnmountDialog.vue'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('UnmountDialog', () => {
  it('renders the password field when open; confirm button is disabled without a password', async () => {
    const w = mount(UnmountDialog, { props: { open: true, name: 'Storage1' } })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.ud-input')
    expect(input).toBeTruthy()
    const okBtn = document.body.querySelector<HTMLButtonElement>('.ud-btn.danger')
    expect(okBtn?.disabled).toBe(true)
  })
  it('entering a password and clicking confirm emits confirm(password)', async () => {
    const w = mount(UnmountDialog, { props: { open: true, name: 'Storage1' } })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.ud-input')!
    input.value = 'secret'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.ud-btn.danger')!.click()
    expect(w.emitted('confirm')![0]).toEqual(['secret'])
  })
  it('disables both the confirm and cancel buttons while busy', async () => {
    const w = mount(UnmountDialog, { props: { open: true, name: 'A', busy: true } })
    await w.vm.$nextTick()
    const btns = document.body.querySelectorAll<HTMLButtonElement>('.ud-btn')
    expect(btns.length).toBeGreaterThan(0)
    expect(Array.from(btns).every((b) => b.disabled)).toBe(true)
  })
  it('clears the password when the dialog closes (P1 debt item 3: the plaintext must not linger after cancel, even without reopening)', async () => {
    const w = mount(UnmountDialog, { props: { open: true, name: 'A' } })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.ud-input')!
    input.value = 'secret'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.vm.$nextTick()
    // Deliberately not reopening: only the fixed "clearing on close itself" path
    // makes this assertion pass — the old `if (o) password.value = ''`
    // implementation would still leave the plaintext 'secret' here.
    expect(document.body.querySelector<HTMLInputElement>('.ud-input')!.value).toBe('')
  })
})
