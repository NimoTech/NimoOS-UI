import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn.sp9'
import OwnerCard from './OwnerCard.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// This component attaches a click listener on document (maps to Vue2 mounted/destroyed); not unmounting would leak across tests.
let mountedWrappers: Array<{ unmount: () => void }> = []
afterEach(() => {
  for (const w of mountedWrappers) {
    try { w.unmount() } catch { /* already unmounted */ }
  }
  mountedWrappers = []
})

function mountCard(username = 'nimoos', avatarSrc = '/v1/users/avatar?v=1') {
  const w = mount(OwnerCard, { props: { username, avatarSrc }, global: { plugins: [i18n] } })
  mountedWrappers.push(w)
  return w
}

function setFiles(el: Element, file: File) {
  Object.defineProperty(el, 'files', { value: [file], configurable: true })
}

describe('OwnerCard — maps to the top half of Vue2 AccountPanel state 1 (:630-662)', () => {
  it('shows the "local owner account" label + the username', () => {
    const w = mountCard()
    expect(w.text()).toContain(zh.settingsAccOwnerLabel)
    expect(w.find('[data-test="acc-username"]').text()).toBe('nimoos')
  })

  it('three buttons: change password / change avatar / log out', () => {
    const w = mountCard()
    expect(w.find('[data-test="acc-change-password"]').text()).toContain(zh.settingsAccChangePassword)
    expect(w.find('[data-test="acc-change-avatar"]').text()).toContain(zh.settingsAccChangeAvatar)
    expect(w.find('[data-test="acc-logout"]').text()).toContain(zh.settingsAccLogout)
  })

  it('clicking "change password" emits the change-password event', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-change-password"]').trigger('click')
    expect(w.emitted('change-password')).toHaveLength(1)
  })

  it('clicking "log out" emits the logout event', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-logout"]').trigger('click')
    expect(w.emitted('logout')).toHaveLength(1)
  })

  it('the avatar source menu is collapsed by default, and only expands on clicking "change avatar" (Vue2 toggleAvatarMenu)', async () => {
    const w = mountCard()
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(false)
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.settingsAccUploadFromDevice)
    expect(w.text()).toContain(zh.settingsAccChooseFromNas)
  })

  it('clicking "change avatar" again collapses the menu (toggle semantics)', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(false)
  })

  it('clicking "choose from NAS" emits choose-from-nas and collapses the menu', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-nas"]').trigger('click')
    expect(w.emitted('choose-from-nas')).toHaveLength(1)
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(false)
  })

  it('clicking anywhere in the document collapses the menu (Vue2 document click listener)', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(true)
    document.dispatchEvent(new MouseEvent('click'))
    await w.vm.$nextTick()
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(false)
  })

  it('clicking a button inside the card does not get incidentally closed by the document listener (the @click.stop layer)', async () => {
    const w = mountCard()
    // Directly clicking the "change avatar" button: the event bubbles up to
    // .set-acc-avatar-picker where it gets stopped, never reaching document → menu stays open.
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(true)
  })

  it('non-image files are rejected: emits invalid-file instead of pick-local-file', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    const input = w.find('[data-test="acc-file-input"]')
    setFiles(input.element, new File(['x'], 'doc.pdf', { type: 'application/pdf' }))
    await input.trigger('change')
    expect(w.emitted('invalid-file')).toHaveLength(1)
    expect(w.emitted('pick-local-file')).toBeUndefined()
  })

  it('a valid image emits pick-local-file, with an objectURL', async () => {
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-0')
    const w = mountCard()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    const input = w.find('[data-test="acc-file-input"]')
    setFiles(input.element, new File(['x'], 'a.png', { type: 'image/png' }))
    await input.trigger('change')
    expect(w.emitted('pick-local-file')).toEqual([['blob:fake-0']])
    spy.mockRestore()
  })

  it('this component does not revoke the objectURL itself — lifecycle belongs to the host (plan C12)', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:z')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const w = mountCard()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    const input = w.find('[data-test="acc-file-input"]')
    setFiles(input.element, new File(['x'], 'a.png', { type: 'image/png' }))
    await input.trigger('change')
    w.unmount()
    expect(revoke).not.toHaveBeenCalled()
    create.mockRestore(); revoke.mockRestore()
  })

  it('falls back to the initial-letter block when the avatar <img> fails to load (on real hardware, /v1/users/avatar was observed returning 404)', async () => {
    const w = mountCard('nimoos')
    expect(w.find('[data-test="acc-avatar-img"]').exists()).toBe(true)
    await w.find('[data-test="acc-avatar-img"]').trigger('error')
    expect(w.find('[data-test="acc-avatar-img"]').exists()).toBe(false)
    expect(w.find('[data-test="acc-avatar-fallback"]').text()).toBe('N')
  })

  it('the initial-letter block does not blow up when the username is empty (shape of a failed data fetch)', async () => {
    const w = mountCard('')
    await w.find('[data-test="acc-avatar-img"]').trigger('error')
    expect(w.find('[data-test="acc-avatar-fallback"]').text()).toBe('')
  })

  it('retries loading the image when avatarSrc changes (version +1), clearing the previous failure state', async () => {
    const w = mountCard('nimoos', '/v1/users/avatar?v=1')
    await w.find('[data-test="acc-avatar-img"]').trigger('error')
    expect(w.find('[data-test="acc-avatar-fallback"]').exists()).toBe(true)
    await w.setProps({ avatarSrc: '/v1/users/avatar?v=2' })
    expect(w.find('[data-test="acc-avatar-img"]').exists()).toBe(true)
  })
})
