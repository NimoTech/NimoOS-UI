import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn.sp9'
import OwnerCard from './OwnerCard.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

// 本组件在 document 上挂 click 监听(对位 Vue2 mounted/destroyed),不 unmount 会串味。
let mountedWrappers: Array<{ unmount: () => void }> = []
afterEach(() => {
  for (const w of mountedWrappers) {
    try { w.unmount() } catch { /* 已 unmount 过 */ }
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

describe('OwnerCard —— 对位 Vue2 AccountPanel state 1 上半(:630-662)', () => {
  it('显示「本机所有者账户」小标 + 用户名', () => {
    const w = mountCard()
    expect(w.text()).toContain(zh.settingsAccOwnerLabel)
    expect(w.find('[data-test="acc-username"]').text()).toBe('nimoos')
  })

  it('三个按钮:更改密码 / 更改头像 / 退出账户', () => {
    const w = mountCard()
    expect(w.find('[data-test="acc-change-password"]').text()).toContain(zh.settingsAccChangePassword)
    expect(w.find('[data-test="acc-change-avatar"]').text()).toContain(zh.settingsAccChangeAvatar)
    expect(w.find('[data-test="acc-logout"]').text()).toContain(zh.settingsAccLogout)
  })

  it('点「更改密码」发 change-password 事件', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-change-password"]').trigger('click')
    expect(w.emitted('change-password')).toHaveLength(1)
  })

  it('点「退出账户」发 logout 事件', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-logout"]').trigger('click')
    expect(w.emitted('logout')).toHaveLength(1)
  })

  it('头像来源菜单默认收起,点「更改头像」才展开(Vue2 toggleAvatarMenu)', async () => {
    const w = mountCard()
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(false)
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(true)
    expect(w.text()).toContain(zh.settingsAccUploadFromDevice)
    expect(w.text()).toContain(zh.settingsAccChooseFromNas)
  })

  it('再点一次「更改头像」收起菜单(toggle 语义)', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(false)
  })

  it('点「从NAS选择」发 choose-from-nas 并收起菜单', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    await w.find('[data-test="acc-nas"]').trigger('click')
    expect(w.emitted('choose-from-nas')).toHaveLength(1)
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(false)
  })

  it('点文档任意处收起菜单(Vue2 document click 监听)', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(true)
    document.dispatchEvent(new MouseEvent('click'))
    await w.vm.$nextTick()
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(false)
  })

  it('点卡片内的按钮不会被 document 监听顺手关掉菜单(@click.stop 那层)', async () => {
    const w = mountCard()
    // 直接点「更改头像」按钮:事件会冒泡到 .set-acc-avatar-picker 被 stop 住,
    // 不会到 document → 菜单保持打开。
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    expect(w.find('[data-test="acc-avatar-menu"]').exists()).toBe(true)
  })

  it('非图片文件被拒:发 invalid-file 而不是 pick-local-file', async () => {
    const w = mountCard()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    const input = w.find('[data-test="acc-file-input"]')
    setFiles(input.element, new File(['x'], 'doc.pdf', { type: 'application/pdf' }))
    await input.trigger('change')
    expect(w.emitted('invalid-file')).toHaveLength(1)
    expect(w.emitted('pick-local-file')).toBeUndefined()
  })

  it('合法图片发 pick-local-file,带一个 objectURL', async () => {
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-0')
    const w = mountCard()
    await w.find('[data-test="acc-change-avatar"]').trigger('click')
    const input = w.find('[data-test="acc-file-input"]')
    setFiles(input.element, new File(['x'], 'a.png', { type: 'image/png' }))
    await input.trigger('change')
    expect(w.emitted('pick-local-file')).toEqual([['blob:fake-0']])
    spy.mockRestore()
  })

  it('本组件不自己 revoke objectURL —— 生命周期归宿主(plan C12)', async () => {
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

  it('头像 <img> 加载失败时回退成首字母块(真机 /v1/users/avatar 实测 404)', async () => {
    const w = mountCard('nimoos')
    expect(w.find('[data-test="acc-avatar-img"]').exists()).toBe(true)
    await w.find('[data-test="acc-avatar-img"]').trigger('error')
    expect(w.find('[data-test="acc-avatar-img"]').exists()).toBe(false)
    expect(w.find('[data-test="acc-avatar-fallback"]').text()).toBe('N')
  })

  it('用户名为空时首字母块也不炸(取数失败的形态)', async () => {
    const w = mountCard('')
    await w.find('[data-test="acc-avatar-img"]').trigger('error')
    expect(w.find('[data-test="acc-avatar-fallback"]').text()).toBe('')
  })

  it('avatarSrc 变化(版本号 +1)时重新尝试加载图片,清掉上次的失败状态', async () => {
    const w = mountCard('nimoos', '/v1/users/avatar?v=1')
    await w.find('[data-test="acc-avatar-img"]').trigger('error')
    expect(w.find('[data-test="acc-avatar-fallback"]').exists()).toBe(true)
    await w.setProps({ avatarSrc: '/v1/users/avatar?v=2' })
    expect(w.find('[data-test="acc-avatar-img"]').exists()).toBe(true)
  })
})
