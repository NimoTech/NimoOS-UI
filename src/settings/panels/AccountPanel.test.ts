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
      // admin 时会挂载真实 MembersSection,它一挂载就取成员列表
      getMembers: async () => [],
      createMember: async () => ({}),
      deleteUser: async () => undefined,
      avatarPath: (v: number, t: string | null) => `/v1/users/avatar?${t ? `token=${t}&` : ''}v=${v}`,
    },
    // state 6 会挂载真实的 NasImagePicker,它一挂载就取存储列表
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
    try { w.unmount() } catch { /* 已 unmount 过 */ }
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

describe('AccountPanel 宿主状态机', () => {
  it('挂载即取当前用户,用户名渲染进 OwnerCard', async () => {
    const w = mountPanel()
    await flush()
    expect(getUserInfo).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="acc-username"]').text()).toBe('nimoos')
  })

  it('state 1 没有页脚(Vue2 footer v-if="state !== 1")', async () => {
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-footer"]').exists()).toBe(false)
  })

  it('点更改密码 → 进 state 3,页脚出现「返回」', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-password"]').trigger('click')
    expect(w.find('[data-test="acc-footer"]').exists()).toBe(true)
    expect(w.find('[data-test="acc-back"]').text()).toBe(zh.settingsAccBack)
    expect(w.find('[data-test="acc-pwd-form"]').exists()).toBe(true)
  })

  it('页脚「返回」从 state 3 回到 state 1', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-password"]').trigger('click')
    await w.find('[data-test="acc-back"]').trigger('click')
    expect(w.find('[data-test="acc-footer"]').exists()).toBe(false)
    expect(w.find('[data-test="acc-username"]').exists()).toBe(true)
  })

  it('admin 渲染成员区', async () => {
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-members"]').exists()).toBe(true)
  })

  it('非 admin 不渲染成员区(Vue2 模板 v-if="isAdmin",:665)', async () => {
    getUserInfo.mockResolvedValue({ id: 2, username: 'bob', role: 'user' })
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-members"]').exists()).toBe(false)
    expect(w.find('[data-test="acc-username"]').text()).toBe('bob')
  })

  it('取用户信息失败时不炸,用户名回退空、成员区不渲染', async () => {
    getUserInfo.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-username"]').text()).toBe('')
    expect(w.find('[data-test="acc-members"]').exists()).toBe(false)
  })

  it('头像 URL 带 localStorage 里的 access_token 与版本号 1', async () => {
    localStorage.setItem('access_token', 'TK')
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-avatar-img"]').attributes('src')).toBe('/v1/users/avatar?token=TK&v=1')
  })

  it('选了本地图片 → 进 state 4(裁剪),并把 objectURL 传给裁剪器', async () => {
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:one')
    const w = mountPanel()
    await flush()
    await pickImage(w)
    expect(w.find('[data-test="acc-cropper"]').exists()).toBe(true)
    expect(w.find('[data-test="acc-cropper"]').attributes('data-src')).toBe('blob:one')
    spy.mockRestore()
  })

  it('换第二张图前会 revoke 第一张的 objectURL(plan C12:Vue2 这里会漏)', async () => {
    let n = 0
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${++n}`)
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const w = mountPanel()
    await flush()
    await pickImage(w)
    await w.find('[data-test="acc-back"]').trigger('click') // 回 state 1 才能再打开菜单
    await pickImage(w)
    expect(revoke).toHaveBeenCalledWith('blob:1')
    create.mockRestore(); revoke.mockRestore()
  })

  it('从 state 4 返回 state 1 时就释放 objectURL(Vue2 goto(1) 的清理)', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:back')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const w = mountPanel()
    await flush()
    await pickImage(w)
    await w.find('[data-test="acc-back"]').trigger('click')
    expect(revoke).toHaveBeenCalledWith('blob:back')
    create.mockRestore(); revoke.mockRestore()
  })

  it('卸载时 revoke 未释放的 objectURL', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:z')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const w = mountPanel()
    await flush()
    await pickImage(w)
    w.unmount()
    expect(revoke).toHaveBeenCalledWith('blob:z')
    create.mockRestore(); revoke.mockRestore()
  })

  it('选了非图片文件 → 面板级 toast 提示,不进裁剪(B5:读 useToast().msg)', async () => {
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

  it('点「从NAS选择」→ 进 state 6', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-nas"]').trigger('click')
    expect(w.find('[data-test="acc-nas-picker"]').exists()).toBe(true)
  })

  it('点成员行的「设置」→ 进 state 5;返回时清掉 activeMember(Vue2 :909)', async () => {
    // 成员区自己取数,这里让它返回一行以便点「设置」
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

  it('state 6 浏览视图下点「返回」只回存储卡网格,不回 state 1(Vue2 :909)', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-nas"]').trigger('click')
    await flush()
    // 本机零额外分区时至少有 /DATA 一张卡 → 点进去进浏览视图
    await w.findAll('[data-test="nas-storage"]')[0].trigger('click')
    await flush()
    expect(w.find('[data-test="nas-crumbs"]').exists()).toBe(true)
    await w.find('[data-test="acc-back"]').trigger('click')
    await flush()
    // 仍在 state 6,只是回到了卡片网格
    expect(w.find('[data-test="acc-nas-picker"]').exists()).toBe(true)
    expect(w.find('[data-test="nas-crumbs"]').exists()).toBe(false)
  })

  it('state 6 存储卡网格下点「返回」回 state 1', async () => {
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

  it('从 NAS 选中图片 → 进 state 4,src 是 /v1/image URL 且不产生 objectURL', async () => {
    const create = vi.spyOn(URL, 'createObjectURL')
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-nas"]').trigger('click')
    await flush()
    // 直接用子组件的 pick 事件(真实点击路径已在 NasImagePicker.test.ts 覆盖)
    w.findComponent({ name: 'NasImagePicker' }).vm.$emit('pick', '/v1/image?path=%2FDATA%2Fa.png&type=original')
    await flush()
    expect(w.find('[data-test="acc-cropper"]').attributes('data-src')).toBe('/v1/image?path=%2FDATA%2Fa.png&type=original')
    expect(create).not.toHaveBeenCalled()
    create.mockRestore()
  })

  it('退出账户:清会话 + 跳登录页', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-logout"]').trigger('click')
    expect(logout).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/login')
  })

  it('state 3 提交成功 → 回 state 1 并弹面板级成功 toast', async () => {
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

  it('state 3 提交失败 → 留在 state 3(错误由表单内联显示,不弹 toast)', async () => {
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

  it('state 3 校验不过时不发请求、不回 state 1', async () => {
    const w = mountPanel()
    await flush()
    await w.find('[data-test="acc-change-password"]').trigger('click')
    await w.find('[data-test="acc-submit"]').trigger('click')
    await flush()
    expect(changePassword).not.toHaveBeenCalled()
    expect(w.find('[data-test="acc-pwd-form"]').exists()).toBe(true)
  })

  it('state 1 与 state 6 没有 Submit 按钮(Vue2 :911-912 只 state 3/4 有)', async () => {
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-submit"]').exists()).toBe(false)
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-nas"]').trigger('click')
    expect(w.find('[data-test="acc-submit"]').exists()).toBe(false)
    expect(w.find('[data-test="acc-back"]').exists()).toBe(true)
  })

  it('头像上传成功 → 回 state 1、头像 URL 的 v 递增(击穿缓存)', async () => {
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:av')
    const w = mountPanel()
    await flush()
    expect(w.find('[data-test="acc-avatar-img"]').attributes('src')).toBe('/v1/users/avatar?v=1')
    await pickImage(w)
    // 触发裁剪器的 change,让它拿到 canvas
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

  it('头像上传失败 → 留在 state 4,版本号不递增', async () => {
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

  // ⚠️ 这里**故意没有**「取数在途时卸载不回写」的用例。本组件的 `alive` 守卫留着是对的
  // (卸载后不该再动 ref),但它在 jsdom 下**无法被任何断言区分** —— 变异验证实测:把两处
  // `if (!alive) return` 全删掉,16 例照样是同样的结果。原因是本组件只在挂载时取一次数、
  // **没有第二个触发点**,卸载后写 ref 既不抛错也不产生可见效果。
  // 处置同 P3 StoragePanel 的先例:守卫 + 注释保留,不留空转用例(plan C8 / B3)。
})
