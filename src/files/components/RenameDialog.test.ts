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
