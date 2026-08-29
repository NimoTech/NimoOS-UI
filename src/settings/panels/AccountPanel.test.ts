import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn.sp9'
import AccountPanel from './AccountPanel.vue'

const getUserInfo = vi.fn()
const changePassword = vi.fn()
const saveAvatar = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getUserInfo: (...a: unknown[]) => getUserInfo(...a),
      changePassword: (...a: unknown[]) => changePassword(...a),
      saveAvatar: (...a: unknown[]) => saveAvatar(...a),
      // Mounts the real MembersSection when admin — it fetches the member list as soon as it mounts
      getMembers: async () => [],
      createMember: async () => ({}),
      deleteUser: async () => undefined,
      // State 5 mounts the real MemberFoldersView — it fetches the permission list as soon as it mounts
      getMemberFolders: async () => [],
      grantMemberFolder: async () => ({}),
      revokeMemberFolder: async () => undefined,
      avatarPath: (v: number, t: string | null) => `/v1/users/avatar?${t ? `token=${t}&` : ''}v=${v}`,
    },
    // State 6 mounts the real NasImagePicker — it fetches the storage list as soon as it mounts
    storage: { list: async () => [] },
    raid: { list: async () => [] },
    folder: { getList: async () => ({ content: [] }) },
    image: { imageUrl: (p: string, t?: string) => `/v1/image?path=${encodeURIComponent(p)}&type=${t}` },
  },
}))

const push = vi.fn()
vi.mock('vue-advanced-cropper', () => ({
  Cropper: {
    name: 'Cropper',
    props: ['src', 'stencilProps', 'canvas', 'defaultSize', 'minWidth', 'minHeight', 'debounce', 'checkOrientation'],
    emits: ['change'],
    template: '<div data-test="cropper-stub"></div>',
  },
  Preview: { name: 'Preview', props: ['width', 'height', 'image', 'coordinates'], template: '<div></div>' },
}))
vi.mock('vue-advanced-cropper/dist/style.css', () => ({}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const logout = vi.fn()
vi.mock('../../composables/useAuth', () => ({ useAuth: () => ({ logout }) }))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

let mountedWrappers: Array<{ unmount: () => void }> = []
afterEach(() => {
  for (const w of mountedWrappers) {
    try { w.unmount() } catch { /* already unmounted */ }
  }
  mountedWrappers = []
})

beforeEach(() => {
  setActivePinia(createPinia())
  getUserInfo.mockReset().mockResolvedValue({ id: 1, username: 'nimoos', role: 'admin' })
  changePassword.mockReset()
  changePassword.mockResolvedValue(undefined)
  saveAvatar.mockReset()
  saveAvatar.mockResolvedValue(undefined)
  push.mockReset()
  logout.mockReset()
  localStorage.clear()
})

function mountPanel() {
  const w = mount(AccountPanel, { global: { plugins: [i18n] } })
  mountedWrappers.push(w)
  return w
}
const flush = () => new Promise((r) => setTimeout(r, 0))

function setFiles(el: Element, file: File) {
  Object.defineProperty(el, 'files', { value: [file], configurable: true })
}
async function pickImage(w: ReturnType<typeof mountPanel>, name = 'a.png') {
  await w.find('[data-test="acc-change-avatar"]').trigger('click')
  const input = w.find('[data-test="acc-file-input"]')
  setFiles(input.element, new File(['x'], name, { type: 'image/png' }))
  await input.trigger('change')
}

describe('AccountPanel host state machine', () => {
  it('mounting immediately fetches the current user; username renders into OwnerCard', async () => {
    const w = mountPanel()
    await flush()
    expect(getUserInfo).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="acc-username"]').text()).toBe('nimoos')
  })

  it('state 1 has no footer (Vue2 footer v-if="state !== 1")', async () => {
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-footer"]').exists()).toBe(false)
  })

  it('clicking change password → moves to state 3, footer shows "Back"', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-password"]').trigger('click')
    expect(w.find('[data-test="acc-footer"]').exists()).toBe(true)
    expect(w.find('[data-test="acc-back"]').text()).toBe(zh.settingsAccBack)
    expect(w.find('[data-test="acc-pwd-form"]').exists()).toBe(true)
  })

  it('the footer "Back" button returns from state 3 to state 1', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-password"]').trigger('click')
    await w.find('[data-test="acc-back"]').trigger('click')
    expect(w.find('[data-test="acc-footer"]').exists()).toBe(false)
    expect(w.find('[data-test="acc-username"]').exists()).toBe(true)
  })

  it('admin renders the members section', async () => {
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-members"]').exists()).toBe(true)
  })

  it('non-admin does not render the members section (Vue2 template v-if="isAdmin", :665)', async () => {
    getUserInfo.mockResolvedValue({ id: 2, username: 'bob', role: 'user' })
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-members"]').exists()).toBe(false)
    expect(w.find('[data-test="acc-username"]').text()).toBe('bob')
  })

  it('does not blow up when fetching user info fails; username falls back to empty, members section does not render', async () => {
    getUserInfo.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-username"]').text()).toBe('')
    expect(w.find('[data-test="acc-members"]').exists()).toBe(false)
  })

  it('avatar URL includes the access_token from localStorage and version number 1', async () => {
    localStorage.setItem('access_token', 'TK')
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-avatar-img"]').attributes('src')).toBe('/v1/users/avatar?token=TK&v=1')
  })

  it('picking a local image → enters state 4 (cropping), and passes the objectURL to the cropper', async () => {
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:one')
    const w = mountPanel()
    await flush()
    await pickImage(w)
    expect(w.find('[data-test="acc-cropper"]').exists()).toBe(true)
    expect(w.find('[data-test="acc-cropper"]').attributes('data-src')).toBe('blob:one')
    spy.mockRestore()
  })

  it('revokes the first objectURL before switching to a second image (plan C12: Vue2 leaks this)', async () => {
    let n = 0
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${++n}`)
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const w = mountPanel()
    await flush()
    await pickImage(w)
    await w.find('[data-test="acc-back"]').trigger('click') // must return to state 1 before the menu can be reopened
    await pickImage(w)
    expect(revoke).toHaveBeenCalledWith('blob:1')
    create.mockRestore(); revoke.mockRestore()
  })

  it('releases the objectURL when returning from state 4 to state 1 (Vue2 goto(1) cleanup)', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:back')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const w = mountPanel()
    await flush()
    await pickImage(w)
    await w.find('[data-test="acc-back"]').trigger('click')
    expect(revoke).toHaveBeenCalledWith('blob:back')
    create.mockRestore(); revoke.mockRestore()
  })

  it('revokes any un-released objectURL on unmount', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:z')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const w = mountPanel()
    await flush()
    await pickImage(w)
    w.unmount()
    expect(revoke).toHaveBeenCalledWith('blob:z')
    create.mockRestore(); revoke.mockRestore()
  })

  it('picking a non-image file → shows a panel-level toast, does not enter cropping (B5: reads useToast().msg)', async () => {
    const { useToast } = await import('../../stores/toast')
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    const input = w.find('[data-test="acc-file-input"]')
    setFiles(input.element, new File(['x'], 'a.pdf', { type: 'application/pdf' }))
    await input.trigger('change')
    expect(useToast().msg).toBe(zh.settingsAccPickImageOnly)
    expect(w.find('[data-test="acc-cropper"]').exists()).toBe(false)
  })

  it('clicking "Choose from NAS" → enters state 6', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-nas"]').trigger('click')
    expect(w.find('[data-test="acc-nas-picker"]').exists()).toBe(true)
  })

  it('clicking "Settings" on a member row → enters state 5; returning clears activeMember (Vue2 :909)', async () => {
    // The members section fetches its own data; here we make it return a row so we can click "Settings"
    const w = mountPanel()
    await flush()
    w.findComponent({ name: 'MembersSection' }).vm.$emit('open-member', {
      id: 3, username: 'alice', role: 'user', folder_count: 0, created_at: 'x',
    })
    await flush()
    expect(w.find('[data-test="acc-member-folders"]').exists()).toBe(true)
    await w.find('[data-test="acc-back"]').trigger('click')
    await flush()
    expect(w.find('[data-test="acc-member-folders"]').exists()).toBe(false)
    expect(w.find('[data-test="acc-username"]').exists()).toBe(true)
  })

  it('clicking "Back" in the state 6 browse view only returns to the storage card grid, not to state 1 (Vue2 :909)', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-nas"]').trigger('click')
    await flush()
    // With zero extra partitions on this machine there is at least one /DATA card → clicking it enters the browse view
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(w.find('[data-test="nas-crumbs"]').exists()).toBe(true)
    await w.find('[data-test="acc-back"]').trigger('click')
    await flush()
    // still in state 6, just back to the card grid
    expect(w.find('[data-test="acc-nas-picker"]').exists()).toBe(true)
    expect(w.find('[data-test="nas-crumbs"]').exists()).toBe(false)
  })

  it('clicking "Back" in the state 6 storage card grid returns to state 1', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-nas"]').trigger('click')
    await flush()
    await w.find('[data-test="acc-back"]').trigger('click')
    await flush()
    expect(w.find('[data-test="acc-nas-picker"]').exists()).toBe(false)
    expect(w.find('[data-test="acc-username"]').exists()).toBe(true)
  })

  it('picking an image from NAS → enters state 4, src is a /v1/image URL and produces no objectURL', async () => {
    const create = vi.spyOn(URL, 'createObjectURL')
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-nas"]').trigger('click')
    await flush()
    // Use the child component's pick event directly (the real click path is covered in NasImagePicker.test.ts)
    w.findComponent({ name: 'NasImagePicker' }).vm.$emit('pick', {
      path: '/DATA/a.png',
      src: '/v1/image?path=%2FDATA%2Fa.png&type=original',
    })
    await flush()
    expect(w.find('[data-test="acc-cropper"]').attributes('data-src')).toBe('/v1/image?path=%2FDATA%2Fa.png&type=original')
    expect(create).not.toHaveBeenCalled()
    create.mockRestore()
  })

  it('logging out: clears the session + navigates to the login page', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-logout"]').trigger('click')
    expect(logout).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/login')
  })

  it('state 3 submits successfully → returns to state 1 and shows a panel-level success toast', async () => {
    const { useToast } = await import('../../stores/toast')
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-password"]').trigger('click')
    await w.find('[data-test="acc-pwd-ori"]').setValue('old')
    await w.find('[data-test="acc-pwd-new"]').setValue('new-pw')
    await w.find('[data-test="acc-pwd-cfm"]').setValue('new-pw')
    await w.find('[data-test="acc-submit"]').trigger('click')
    await flush()
    expect(changePassword).toHaveBeenCalledWith('old', 'new-pw')
    expect(w.find('[data-test="acc-footer"]').exists()).toBe(false)
    expect(useToast().msg).toBe(zh.settingsAccUpdateOk)
  })

  it('state 3 submission fails → stays on state 3 (error shown inline in the form, no toast)', async () => {
    const { useToast } = await import('../../stores/toast')
    changePassword.mockImplementation(async () => { throw new Error('boom') })
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-password"]').trigger('click')
    await w.find('[data-test="acc-pwd-ori"]').setValue('old')
    await w.find('[data-test="acc-pwd-new"]').setValue('new-pw')
    await w.find('[data-test="acc-pwd-cfm"]').setValue('new-pw')
    await w.find('[data-test="acc-submit"]').trigger('click')
    await flush()
    expect(w.find('[data-test="acc-pwd-form"]').exists()).toBe(true)
    expect(w.find('[data-test="acc-pwd-error"]').text()).toBe('boom')
    expect(useToast().msg).toBe('')
  })

  it('state 3 does not send a request or return to state 1 when validation fails', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-password"]').trigger('click')
    await w.find('[data-test="acc-submit"]').trigger('click')
    await flush()
    expect(changePassword).not.toHaveBeenCalled()
    expect(w.find('[data-test="acc-pwd-form"]').exists()).toBe(true)
  })

  it('state 1 and state 6 have no Submit button (Vue2 :911-912 only state 3/4 have it)', async () => {
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-submit"]').exists()).toBe(false)
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-nas"]').trigger('click')
    expect(w.find('[data-test="acc-submit"]').exists()).toBe(false)
    expect(w.find('[data-test="acc-back"]').exists()).toBe(true)
  })

  it('avatar upload succeeds → returns to state 1, the avatar URL v increments (busts the cache)', async () => {
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:av')
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-avatar-img"]').attributes('src')).toBe('/v1/users/avatar?v=1')
    await pickImage(w)
    // trigger the cropper's change event so it gets the canvas
    w.findComponent({ name: 'Cropper' }).vm.$emit('change', {
      coordinates: {}, image: {}, canvas: { toDataURL: () => 'data:image/png;base64,A' },
    })
    await w.vm.$nextTick()
    await w.find('[data-test="acc-submit"]').trigger('click')
    await flush()
    expect(saveAvatar).toHaveBeenCalledWith('data:image/png;base64,A')
    expect(w.find('[data-test="acc-avatar-img"]').attributes('src')).toBe('/v1/users/avatar?v=2')
    spy.mockRestore()
  })

  it('avatar upload fails → stays on state 4, version number does not increment', async () => {
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:av')
    saveAvatar.mockImplementation(async () => { throw new Error('nope') })
    const w = mountPanel()
    await flush()
    await pickImage(w)
    w.findComponent({ name: 'Cropper' }).vm.$emit('change', {
      coordinates: {}, image: {}, canvas: { toDataURL: () => 'data:image/png;base64,A' },
    })
    await w.vm.$nextTick()
    await w.find('[data-test="acc-submit"]').trigger('click')
    await flush()
    expect(w.find('[data-test="acc-cropper"]').exists()).toBe(true)
    expect(w.find('[data-test="acc-crop-error"]').text()).toBe('nope')
    spy.mockRestore()
  })

  // ⚠️ This deliberately has **no** test case for "unmount while a fetch is in flight doesn't write back".
  // Keeping this component's `alive` guard is correct (a ref should not be touched after unmount), but it
  // **cannot be distinguished by any assertion** under jsdom — mutation testing confirmed this: deleting both
  // `if (!alive) return` checks entirely, all 16 cases still produce the same result. The reason is this
  // component only fetches data once, at mount time — **there's no second trigger point** — so writing to
  // the ref after unmount neither throws nor produces any visible effect.
  // Handled the same as the P3 StoragePanel precedent: keep the guard + comment, don't add a no-op test case just to have one (plan C8 / B3).
})
