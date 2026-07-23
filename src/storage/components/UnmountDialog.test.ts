import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UnmountDialog from './UnmountDialog.vue'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('UnmountDialog', () => {
  it('open 时渲染密码框,确认键无密码时禁用', async () => {
    const w = mount(UnmountDialog, { props: { open: true, name: 'Storage1' } })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.ud-input')
    expect(input).toBeTruthy()
    const okBtn = document.body.querySelector<HTMLButtonElement>('.ud-btn.danger')
    expect(okBtn?.disabled).toBe(true)
  })
  it('输入密码点确认 emit confirm(password)', async () => {
    const w = mount(UnmountDialog, { props: { open: true, name: 'Storage1' } })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.ud-input')!
    input.value = 'secret'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.ud-btn.danger')!.click()
    expect(w.emitted('confirm')![0]).toEqual(['secret'])
  })
})
