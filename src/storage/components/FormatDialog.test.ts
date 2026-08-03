import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import FormatDialog from './FormatDialog.vue'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('FormatDialog', () => {
  it('open 时渲染 name 插值消息与密码框,确认键无密码时禁用', async () => {
    const w = mount(FormatDialog, { props: { open: true, name: 'Storage1' } })
    await w.vm.$nextTick()
    const msg = document.body.querySelector<HTMLParagraphElement>('.fd-msg')
    expect(msg?.textContent).toContain('Storage1')
    const input = document.body.querySelector<HTMLInputElement>('.fd-input')
    expect(input).toBeTruthy()
    const okBtn = document.body.querySelector<HTMLButtonElement>('.fd-btn.danger')
    expect(okBtn?.disabled).toBe(true)
  })
  it('输入密码点确认 emit confirm(password)', async () => {
    const w = mount(FormatDialog, { props: { open: true, name: 'Storage1' } })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.fd-input')!
    input.value = 'secret'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('.fd-btn.danger')!.click()
    expect(w.emitted('confirm')![0]).toEqual(['secret'])
  })
  it('回车提交 emit confirm(password)', async () => {
    const w = mount(FormatDialog, { props: { open: true, name: 'A' } })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.fd-input')!
    input.value = 'secret'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    expect(w.emitted('confirm')![0]).toEqual(['secret'])
  })
  it('busy 时确认与取消按钮均禁用', async () => {
    const w = mount(FormatDialog, { props: { open: true, name: 'A', busy: true } })
    await w.vm.$nextTick()
    const btns = document.body.querySelectorAll<HTMLButtonElement>('.fd-btn')
    expect(btns.length).toBeGreaterThan(0)
    expect(Array.from(btns).every((b) => b.disabled)).toBe(true)
  })
  it('busy 时回车不提交', async () => {
    const w = mount(FormatDialog, { props: { open: true, name: 'A', busy: true } })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.fd-input')!
    input.value = 'secret'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
    expect(w.emitted('confirm')).toBeUndefined()
  })
  it('弹窗关闭时清空密码(取消后明文不驻留,不重新打开也须已清空)', async () => {
    const w = mount(FormatDialog, { props: { open: true, name: 'A' } })
    await w.vm.$nextTick()
    const input = document.body.querySelector<HTMLInputElement>('.fd-input')!
    input.value = 'secret'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.vm.$nextTick()
    // 故意不重新打开:只有「关闭本身清空」这条路径被实现时此断言才通过——
    // 旧的 `if (o) password.value = ''` 实现在此处仍残留明文 'secret'。
    expect(document.body.querySelector<HTMLInputElement>('.fd-input')!.value).toBe('')
  })
})
