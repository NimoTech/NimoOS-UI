import { describe, it, expect, afterEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import RenameDialog from './RenameDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const opts = { global: { plugins: [i18n] }, attachTo: document.body }

// reka-ui Dialog teleports its content to <body>, outside the mounted
// wrapper's own DOM subtree (see NewItemDialog.test.ts / Task 4's
// Dialog.test.ts) — query via a DOMWrapper around document.body.
const body = () => new DOMWrapper(document.body)

// Each mount (attachTo: document.body) teleports fresh markup into <body>
// without tearing down the previous test's; clear it so `body().find(...)`
// always resolves the current test's own dialog.
afterEach(() => { document.body.innerHTML = '' })

describe('RenameDialog', () => {
  it('预填当前名', async () => {
    mount(RenameDialog, { props: { open: true, name: 'old.txt' }, ...opts })
    await nextTick()
    expect((body().find('input').element as HTMLInputElement).value).toBe('old.txt')
  })
  it('确认发出新名', async () => {
    const w = mount(RenameDialog, { props: { open: true, name: 'old.txt' }, ...opts })
    await nextTick()
    await body().find('input').setValue('new.txt')
    await body().find('.ui-confirm-btn').trigger('click')
    expect(w.emitted('confirm')?.[0]).toEqual(['new.txt'])
  })
})

// Same gap as NewItemDialog's, but worse: useFileOps.rename() has no length
// check at all, so an over-long rename used to reach the backend and come back
// as the bare literal "Fail", which errMsg() flattens into the generic
// "operation failed" — a completely different (and content-free) answer from
// the one creating the same name gives. Renaming is where a 255-byte ceiling is
// most likely to be hit, since the user starts from an existing long name.
describe('RenameDialog 名称长度实时校验', () => {
  it('超长名字内联报错并禁用确认按钮', async () => {
    mount(RenameDialog, { props: { open: true, name: 'old.txt' }, ...opts })
    await nextTick()
    await body().find('input').setValue('a'.repeat(256))
    const err = body().find('.ui-field-error')
    expect(err.exists()).toBe(true)
    expect(err.text()).toBe('名称过长(最多 255 字节)')
    expect(body().find('.ui-confirm-btn').attributes('disabled')).toBeDefined()
  })

  it('超长时点确认不发 confirm、也不关闭对话框', async () => {
    const w = mount(RenameDialog, { props: { open: true, name: 'old.txt' }, ...opts })
    await nextTick()
    await body().find('input').setValue('a'.repeat(256))
    await body().find('.ui-confirm-btn').trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('超长时敲回车同样不发 confirm', async () => {
    const w = mount(RenameDialog, { props: { open: true, name: 'old.txt' }, ...opts })
    await nextTick()
    await body().find('input').setValue('a'.repeat(256))
    await body().find('input').trigger('keyup.enter')
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('改回合法长度后错误消失、按钮恢复、可以确认', async () => {
    const w = mount(RenameDialog, { props: { open: true, name: 'old.txt' }, ...opts })
    await nextTick()
    const input = body().find('input')
    await input.setValue('a'.repeat(256))
    expect(body().find('.ui-field-error').exists()).toBe(true)
    await input.setValue('new.txt')
    expect(body().find('.ui-field-error').exists()).toBe(false)
    expect(body().find('.ui-confirm-btn').attributes('disabled')).toBeUndefined()
    await body().find('.ui-confirm-btn').trigger('click')
    expect(w.emitted('confirm')?.[0]).toEqual(['new.txt'])
  })

  it('边界按字节算:255 字节放行,256 字节拦截;中文 85/86 字同理', async () => {
    mount(RenameDialog, { props: { open: true, name: 'old.txt' }, ...opts })
    await nextTick()
    const input = body().find('input')
    await input.setValue('a'.repeat(255))
    expect(body().find('.ui-field-error').exists()).toBe(false)
    await input.setValue('a'.repeat(256))
    expect(body().find('.ui-field-error').exists()).toBe(true)
    await input.setValue('中'.repeat(85))
    expect(body().find('.ui-field-error').exists()).toBe(false)
    await input.setValue('中'.repeat(86))
    expect(body().find('.ui-field-error').exists()).toBe(true)
  })
})
