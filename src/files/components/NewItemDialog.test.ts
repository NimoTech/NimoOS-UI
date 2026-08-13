import { describe, it, expect, afterEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import NewItemDialog from './NewItemDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const opts = { global: { plugins: [i18n] }, attachTo: document.body }

// reka-ui Dialog teleports its content to <body> outside the mounted wrapper's
// own DOM subtree, so `wrapper.find()` cannot see it (see Dialog.test.ts from
// Task 4). Query via a DOMWrapper around document.body instead, after one
// nextTick for the teleported content to land in jsdom.
const body = () => new DOMWrapper(document.body)

// Each mount (attachTo: document.body) teleports fresh markup into <body>
// without tearing down the previous test's; clear it so `body().find(...)`
// always resolves the current test's own dialog.
afterEach(() => { document.body.innerHTML = '' })

describe('NewItemDialog', () => {
  it('输入过滤斜杠', async () => {
    mount(NewItemDialog, { props: { open: true, mode: 'folder' }, ...opts })
    await nextTick()
    const input = body().find('input')
    await input.setValue('a/b/c')
    expect((input.element as HTMLInputElement).value).toBe('abc')
  })
  it('确认发出 confirm(name) 并请求关闭', async () => {
    const w = mount(NewItemDialog, { props: { open: true, mode: 'file' }, ...opts })
    await nextTick()
    await body().find('input').setValue('note.txt')
    await body().find('.ui-confirm-btn').trigger('click')
    expect(w.emitted('confirm')?.[0]).toEqual(['note.txt'])
    // tsconfig `lib` is ES2020 (no Array.prototype.at) — index from the end manually.
    const openEvents = w.emitted('update:open')
    expect(openEvents?.[(openEvents?.length ?? 1) - 1]).toEqual([false])
  })
  it('空名不发 confirm', async () => {
    const w = mount(NewItemDialog, { props: { open: true, mode: 'file' }, ...opts })
    await nextTick()
    await body().find('input').setValue('')
    await body().find('.ui-confirm-btn').trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
  })
})

// Bug 4: the length limit used to be enforced only after the dialog had already
// closed — useFileOps' createBlocked fired a toast and the typed name was gone,
// so the user had to retype 255 characters to find out where the ceiling was.
// The check belongs here, live, and the message belongs INSIDE the dialog:
// toasts sit at z-index 60 under the dialog's blurred 1000 overlay
// (memory: newui-dialog-error-not-toast).
describe('NewItemDialog 名称长度实时校验', () => {
  it('超长名字内联报错并禁用确认按钮', async () => {
    mount(NewItemDialog, { props: { open: true, mode: 'folder' }, ...opts })
    await nextTick()
    await body().find('input').setValue('a'.repeat(256))
    const err = body().find('.ui-field-error')
    expect(err.exists()).toBe(true)
    expect(err.text()).toBe('名称过长(最多 255 字节)')
    expect(body().find('.ui-confirm-btn').attributes('disabled')).toBeDefined()
  })

  it('超长时点确认不发 confirm、也不关闭对话框', async () => {
    const w = mount(NewItemDialog, { props: { open: true, mode: 'folder' }, ...opts })
    await nextTick()
    await body().find('input').setValue('a'.repeat(256))
    await body().find('.ui-confirm-btn').trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('超长时敲回车同样不发 confirm', async () => {
    const w = mount(NewItemDialog, { props: { open: true, mode: 'folder' }, ...opts })
    await nextTick()
    await body().find('input').setValue('a'.repeat(256))
    await body().find('input').trigger('keyup.enter')
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('改回合法长度后错误消失、按钮恢复、可以确认', async () => {
    const w = mount(NewItemDialog, { props: { open: true, mode: 'folder' }, ...opts })
    await nextTick()
    const input = body().find('input')
    await input.setValue('a'.repeat(256))
    expect(body().find('.ui-field-error').exists()).toBe(true)
    await input.setValue('ok')
    expect(body().find('.ui-field-error').exists()).toBe(false)
    expect(body().find('.ui-confirm-btn').attributes('disabled')).toBeUndefined()
    await body().find('.ui-confirm-btn').trigger('click')
    expect(w.emitted('confirm')?.[0]).toEqual(['ok'])
  })

  it('边界按字节算:255 字节放行,256 字节拦截', async () => {
    mount(NewItemDialog, { props: { open: true, mode: 'folder' }, ...opts })
    await nextTick()
    const input = body().find('input')
    await input.setValue('a'.repeat(255))
    expect(body().find('.ui-field-error').exists()).toBe(false)
    await input.setValue('a'.repeat(256))
    expect(body().find('.ui-field-error').exists()).toBe(true)
  })

  it('中文按 3 字节/字算:85 字放行,86 字拦截', async () => {
    mount(NewItemDialog, { props: { open: true, mode: 'folder' }, ...opts })
    await nextTick()
    const input = body().find('input')
    await input.setValue('中'.repeat(85))
    expect(body().find('.ui-field-error').exists()).toBe(false)
    await input.setValue('中'.repeat(86))
    expect(body().find('.ui-field-error').exists()).toBe(true)
  })

  it('尾随空格不算进长度(确认时本来就会 trim)', async () => {
    mount(NewItemDialog, { props: { open: true, mode: 'folder' }, ...opts })
    await nextTick()
    await body().find('input').setValue('a'.repeat(255) + '   ')
    expect(body().find('.ui-field-error').exists()).toBe(false)
  })
})
