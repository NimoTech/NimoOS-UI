// Fix wave C (toolbar redesign, owner-confirmed mockup: .superpowers/sdd/
// 2026-08-25-files-time-machine-vue2-parity/files-toolbar-mock.html): FilesNewMenu.vue collapses
// New folder/New file/Upload files/Upload folder into one accent-purple "New" dropdown. This
// component owns ONLY the menu chrome + emits -- Files.vue wires each emit to its own
// pre-existing handler (see Files.test.ts for that wiring's own coverage). Real reka-ui
// components are used throughout (no stubs): DropdownMenuContent teleports to document.body via
// Portal and only renders once open (no `forceMount`), same convention as ui/Dialog.test.ts.
import { describe, it, expect, afterEach } from 'vitest'
import { mount, DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'
import FilesNewMenu from './FilesNewMenu.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

function mountMenu() {
  return mount(FilesNewMenu, { global: { plugins: [i18n] }, attachTo: document.body })
}
const body = () => new DOMWrapper(document.body)

afterEach(() => { document.body.innerHTML = '' })

describe('FilesNewMenu', () => {
  it('closed by default: trigger shows the "New" label, no menu items in the document', () => {
    const w = mountMenu()
    expect(w.get('.tb-new-menu').text()).toContain(zh.filesNewMenu)
    expect(document.body.querySelector('.tb-new-folder')).toBeNull()
  })

  it('clicking the trigger opens the menu with all four items, in order, folder/file separated from upload/upload', async () => {
    const w = mountMenu()
    await w.get('.tb-new-menu').trigger('click')
    await nextTick()
    const items = body().findAll('.files-new-item')
    expect(items.map((it) => it.text())).toEqual([
      zh.filesNewFolder, zh.filesNewFile, zh.filesCtxUploadFile, zh.filesCtxUploadFolder,
    ])
    expect(body().find('.ui-ctx-sep').exists()).toBe(true)
  })

  it('the upload-folder item carries the empty-folder hover hint (title)', async () => {
    const w = mountMenu()
    await w.get('.tb-new-menu').trigger('click')
    await nextTick()
    expect(body().get('.tb-upload-folder').attributes('title')).toBe(zh.filesUploadFolderEmptyHint)
  })

  it('each item click emits its own event and closes the menu (reka-ui default select behavior)', async () => {
    const w = mountMenu()

    await w.get('.tb-new-menu').trigger('click')
    await nextTick()
    await body().get('.tb-new-folder').trigger('click')
    expect(w.emitted('new-folder')).toHaveLength(1)

    await w.get('.tb-new-menu').trigger('click')
    await nextTick()
    await body().get('.tb-new-file').trigger('click')
    expect(w.emitted('new-file')).toHaveLength(1)

    await w.get('.tb-new-menu').trigger('click')
    await nextTick()
    await body().get('.tb-upload-file').trigger('click')
    expect(w.emitted('upload-file')).toHaveLength(1)

    await w.get('.tb-new-menu').trigger('click')
    await nextTick()
    await body().get('.tb-upload-folder').trigger('click')
    expect(w.emitted('upload-folder')).toHaveLength(1)
  })

  it('caret reflects open state via the is-open class', async () => {
    const w = mountMenu()
    expect(w.get('.files-new-caret').classes()).not.toContain('is-open')
    await w.get('.tb-new-menu').trigger('click')
    await nextTick()
    expect(w.get('.files-new-caret').classes()).toContain('is-open')
  })
})
