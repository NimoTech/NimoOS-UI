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
  it('busy 时确认与取消按钮均禁用', async () => {
    const w = mount(UnmountDialog, { props: { open: true, name: 'A', busy: true } })
    await w.vm.$nextTick()
    const btns = document.body.querySelectorAll<HTMLButtonElement>('.ud-btn')
    expect(btns.length).toBeGreaterThan(0)
    expect(Array.from(btns).every((b) => b.disabled)).toBe(true)
  })
  it('弹窗关闭时清空密码(P1 债③:取消后明文不驻留,不重新打开也须已清空)', async () => {
    const w = mount(UnmountDialog, { props: { open: true, name: 'A' } })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.ud-input')!
    input.value = 'secret'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.vm.$nextTick()
    // 故意不重新打开:只有「关闭本身清空」这条被修复的路径才能让此断言通过——
    // 旧的 `if (o) password.value = ''` 实现在此处仍残留明文 'secret'。
    expect(document.body.querySelector<HTMLInputElement>('.ud-input')!.value).toBe('')
  })
})
