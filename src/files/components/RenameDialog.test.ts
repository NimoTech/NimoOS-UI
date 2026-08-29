import { describe, it, expect, afterEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import RenameDialog from './RenameDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const opts = { global: { plugins: [i18n] }, attachTo: document.body }

// reka-ui Dialog teleports its content to <body>, outside the mounted
// wrapper's own DOM subtree (see NewItemDialog.test.ts / Dialog.test.ts) —
// query via a DOMWrapper around document.body.
const body = () => new DOMWrapper(document.body)

// Each mount (attachTo: document.body) teleports fresh markup into <body>
// without tearing down the previous test's; clear it so `body().find(...)`
// always resolves the current test's own dialog.
afterEach(() => { document.body.innerHTML = '' })

describe('RenameDialog', () => {
  it('prefills with current name', async () => {
    mount(RenameDialog, { props: { open: true, name: 'old.txt' }, ...opts })
    await nextTick()
    expect((body().find('input').element as HTMLInputElement).value).toBe('old.txt')
  })
  it('emits new name on confirmation', async () => {
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
describe('RenameDialog live name-length validation', () => {
  it('reports an over-long name inline and disables the confirm button', async () => {
    mount(RenameDialog, { props: { open: true, name: 'old.txt' }, ...opts })
    await nextTick()
    await body().find('input').setValue('a'.repeat(256))
    const err = body().find('.ui-field-error')
    expect(err.exists()).toBe(true)
    expect(err.text()).toBe('名称过长(最多 255 字节)')
    expect(body().find('.ui-confirm-btn').attributes('disabled')).toBeDefined()
  })

  it('neither emits confirm nor closes the dialog while the name is over-long', async () => {
    const w = mount(RenameDialog, { props: { open: true, name: 'old.txt' }, ...opts })
    await nextTick()
    await body().find('input').setValue('a'.repeat(256))
    await body().find('.ui-confirm-btn').trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
    expect(w.emitted('update:open')).toBeUndefined()
  })

  it('does not emit confirm on Enter either while the name is over-long', async () => {
    const w = mount(RenameDialog, { props: { open: true, name: 'old.txt' }, ...opts })
    await nextTick()
    await body().find('input').setValue('a'.repeat(256))
    await body().find('input').trigger('keyup.enter')
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('clears the error, re-enables the button and confirms once the name fits again', async () => {
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

  it('measures the boundary in bytes: 255 passes and 256 is blocked, likewise 85 vs 86 Chinese characters', async () => {
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
