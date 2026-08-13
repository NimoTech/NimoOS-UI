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
  it('filters forward slashes in input', async () => {
    mount(NewItemDialog, { props: { open: true, mode: 'folder' }, ...opts })
    await nextTick()
    const input = body().find('input')
    await input.setValue('a/b/c')
    expect((input.element as HTMLInputElement).value).toBe('abc')
  })
  it('emits confirm(name) on confirmation and requests close', async () => {
    const w = mount(NewItemDialog, { props: { open: true, mode: 'file' }, ...opts })
    await nextTick()
    await body().find('input').setValue('note.txt')
    await body().find('.ui-confirm-btn').trigger('click')
    expect(w.emitted('confirm')?.[0]).toEqual(['note.txt'])
    // tsconfig `lib` is ES2020 (no Array.prototype.at) — index from the end manually.
    const openEvents = w.emitted('update:open')
    expect(openEvents?.[(openEvents?.length ?? 1) - 1]).toEqual([false])
  })
  it('does not emit confirm for empty name', async () => {
    const w = mount(NewItemDialog, { props: { open: true, mode: 'file' }, ...opts })
    await nextTick()
    await body().find('input').setValue('')
    await body().find('.ui-confirm-btn').trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
  })
})
