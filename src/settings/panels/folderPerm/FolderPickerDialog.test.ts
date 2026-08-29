import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn.sp9'
import FolderPickerDialog from './FolderPickerDialog.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

const ROOTS = [
  { path: '/DATA', label: 'System (/DATA)' },
  { path: '/media', label: '/media' },
  { path: '/mnt', label: '/mnt' },
]

// B4: the Dialog teleports via reka's DialogPortal → must attachTo body and query document.
// ⚠️ Same lesson as P3 AppPathDialog.test.ts:49-87: when a mount with attachTo body isn't
// explicitly unmounted, the Portal content leaks into document, and the next test case's
// querySelector picks up the **previous** node (the first version of this file tripped
// over exactly this: the root button count came out to 18 = 6 mounts × 3).
let mountedWrappers: Array<{ unmount: () => void }> = []
afterEach(() => {
  for (const w of mountedWrappers) {
    try { w.unmount() } catch { /* test already unmounted it */ }
  }
  mountedWrappers = []
  document.body.innerHTML = ''
})

function mountDialog(open = true) {
  const w = mount(FolderPickerDialog, {
    props: { open, title: zh.settingsFpAddFolder, roots: ROOTS },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  mountedWrappers.push(w)
  return w
}

describe('FolderPickerDialog', () => {
  it('renders nothing while closed', () => {
    mountDialog(false)
    expect(document.querySelector('[data-test="fp-picker-body"]')).toBeNull()
  })

  it('lists the three built-in roots when open (this sprint\'s candidates are always empty → pickerRoots\' fallback shape)', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    const labels = [...document.querySelectorAll('[data-test="fp-picker-root"]')].map((n) => n.textContent?.trim())
    expect(labels).toEqual(['System (/DATA)', '/media', '/mnt'])
  })

  it('passes the title through', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    expect(document.querySelector('.ui-dialog-title')?.textContent).toBe(zh.settingsFpAddFolder)
  })

  it('the manual-entry field exists and is wrapped in a .set-net-field container (C7: otherwise it inherits .set-input\'s 92px)', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    const field = document.querySelector('[data-test="fp-picker-field"]')
    expect(field).not.toBeNull()
    expect(field?.classList.contains('set-net-field')).toBe(true)
    expect(field?.querySelector('input')).not.toBeNull()
  })

  it('the "Add" button is always disabled this sprint — writes are disabled under policy 3 (B6: check the attribute, don\'t trigger it)', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    const add = document.querySelector('[data-test="fp-picker-add"]') as HTMLButtonElement
    expect(add).not.toBeNull()
    expect(add.disabled).toBe(true)
  })

  it('"Add" stays disabled even when a valid absolute path is entered', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    const input = document.querySelector('[data-test="fp-picker-field"] input') as HTMLInputElement
    input.value = '/DATA/Docs'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    expect((document.querySelector('[data-test="fp-picker-add"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('the root buttons are disabled too — no list-directory request is sent this sprint', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    const roots = [...document.querySelectorAll('[data-test="fp-picker-root"]')] as HTMLButtonElement[]
    expect(roots).toHaveLength(3)
    expect(roots.every((b) => b.disabled)).toBe(true)
  })

  it('the cancel button sets open back to false', async () => {
    const w = mountDialog()
    await w.vm.$nextTick()
    ;(document.querySelector('[data-test="fp-picker-cancel"]') as HTMLButtonElement).click()
    await w.vm.$nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('reopening clears the previously entered path (Vue2 openAdd resets newPath every time)', async () => {
    const w = mountDialog(false)
    await w.setProps({ open: true })
    await w.vm.$nextTick()
    const input = document.querySelector('[data-test="fp-picker-field"] input') as HTMLInputElement
    input.value = '/DATA/X'
    input.dispatchEvent(new Event('input'))
    await w.vm.$nextTick()
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await w.vm.$nextTick()
    expect((document.querySelector('[data-test="fp-picker-field"] input') as HTMLInputElement).value).toBe('')
  })
})
