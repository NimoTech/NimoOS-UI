import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn.sp9'
import ChangePasswordForm from './ChangePasswordForm.vue'

const changePassword = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { users: { changePassword: (...a: unknown[]) => changePassword(...a) } },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
// ⚠️ **必须用花括号、不能写成 `beforeEach(() => mock.mockReset().mockResolvedValue(x))`** ——
// 那种链式写法会把 mock 函数本身**当成 teardown 回调返回**给 vitest(beforeEach 支持返回清理函数),
// 于是每个测试结束后 vitest 会**再调一次这个 mock**;若该测试把实现换成了「抛错」,那次调用
// 产生的 rejected promise 没人 await → 报成 `Unknown Error: <msg>`,而断言其实全是过的。
// 本文件三条失败用例就是这么来的,排查花了几轮。
beforeEach(() => {
  changePassword.mockReset()
  changePassword.mockResolvedValue(undefined)
})

function mountForm() {
  return mount(ChangePasswordForm, { global: { plugins: [i18n] } })
}
type Exposed = { submit(): Promise<boolean> }
const submitOf = (w: ReturnType<typeof mountForm>) => (w.vm as unknown as Exposed).submit()

async function fill(w: ReturnType<typeof mountForm>, ori: string, pw: string, cfm: string) {
  await w.find('[data-test="acc-pwd-ori"]').setValue(ori)
  await w.find('[data-test="acc-pwd-new"]').setValue(pw)
  await w.find('[data-test="acc-pwd-cfm"]').setValue(cfm)
}

describe('ChangePasswordForm —— 对位 Vue2 state 3(:723-744)+ savePassword(:415-440)', () => {
  it('三个 password 类型输入框,占位文案与 Vue2 一致', () => {
    const w = mountForm()
    for (const [k, key] of [
      ['acc-pwd-ori', 'settingsAccOriPassword'],
      ['acc-pwd-new', 'settingsAccNewPassword'],
      ['acc-pwd-cfm', 'settingsAccConfirmNewPassword'],
    ] as const) {
      const el = w.find(`[data-test="${k}"]`)
      expect(el.attributes('type')).toBe('password')
      expect(el.attributes('placeholder')).toBe(zh[key])
    }
  })

  it('三个输入框都包在 .set-net-field 里(C7:否则吃到 .set-input 的 92px)', () => {
    const w = mountForm()
    for (const k of ['acc-pwd-ori', 'acc-pwd-new', 'acc-pwd-cfm']) {
      expect(w.find(`[data-test="${k}"]`).element.closest('.set-net-field')).not.toBeNull()
    }
  })

  it('有一个 autocomplete=username 的蜜罐(Vue2 :725,防浏览器自动填充打到别处)', () => {
    expect(mountForm().find('input[autocomplete="username"]').exists()).toBe(true)
  })

  it('两次新密码不一致 → 内联报错,且一次请求都不发', async () => {
    const w = mountForm()
    await fill(w, 'old', 'aaaaaa', 'bbbbbb')
    expect(await submitOf(w)).toBe(false)
    await w.vm.$nextTick()
    expect(w.find('.set-danger').text()).toBe(zh.settingsAccPwdMismatch)
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('任一框为空 → 内联报错,不发请求', async () => {
    const w = mountForm()
    await fill(w, '', 'aaaaaa', 'aaaaaa')
    expect(await submitOf(w)).toBe(false)
    expect(changePassword).not.toHaveBeenCalled()
    expect(w.find('.set-danger').text()).toBe(zh.settingsAccFillAllFields)
  })

  it('确认框为空也拦住(Vue2 三个框都是 required)', async () => {
    const w = mountForm()
    await fill(w, 'old', 'aaaaaa', '')
    expect(await submitOf(w)).toBe(false)
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('成功时按 (old_password, password) 顺序调共享包,并返回 true', async () => {
    const w = mountForm()
    await fill(w, 'old-pw', 'new-pw', 'new-pw')
    expect(await submitOf(w)).toBe(true)
    expect(changePassword).toHaveBeenCalledWith('old-pw', 'new-pw')
  })

  it('成功后清空三个输入框(Vue2 :429-431)', async () => {
    const w = mountForm()
    await fill(w, 'old-pw', 'new-pw', 'new-pw')
    await submitOf(w)
    await w.vm.$nextTick()
    for (const k of ['acc-pwd-ori', 'acc-pwd-new', 'acc-pwd-cfm']) {
      expect((w.find(`[data-test="${k}"]`).element as HTMLInputElement).value).toBe('')
    }
  })

  it('失败时优先显示后端 message,用内联 .set-danger 而不是 toast(C6)', async () => {
    changePassword.mockImplementation(async () => { throw Object.assign(new Error('Request failed'), { response: { data: { message: '原密码错误' } } }) })
    const w = mountForm()
    await fill(w, 'bad', 'new-pw', 'new-pw')
    expect(await submitOf(w)).toBe(false)
    await w.vm.$nextTick()
    expect(w.find('.set-danger').text()).toBe('原密码错误')
  })

  it('后端没给 message 时回退成 axios 的 message', async () => {
    changePassword.mockImplementation(async () => { throw new Error('Network Error') }) // 无 response 的网络错
    const w = mountForm()
    await fill(w, 'a', 'new-pw', 'new-pw')
    await submitOf(w)
    await w.vm.$nextTick()
    expect(w.find('.set-danger').text()).toBe('Network Error')
  })

  it('失败后输入不清空(方便用户改一个字重试)', async () => {
    changePassword.mockImplementation(async () => { throw new Error('X') })
    const w = mountForm()
    await fill(w, 'bad', 'new-pw', 'new-pw')
    await submitOf(w)
    await w.vm.$nextTick()
    expect((w.find('[data-test="acc-pwd-ori"]').element as HTMLInputElement).value).toBe('bad')
  })

  it('提交在途时三个框 disabled,且不会产生第二次请求', async () => {
    let resolve!: () => void
    changePassword.mockReturnValue(new Promise<void>((r) => { resolve = r }))
    const w = mountForm()
    await fill(w, 'a', 'new-pw', 'new-pw')
    const p = submitOf(w)
    await w.vm.$nextTick()
    expect(w.find('[data-test="acc-pwd-ori"]').attributes('disabled')).toBeDefined()
    expect(await submitOf(w)).toBe(false)
    expect(changePassword).toHaveBeenCalledTimes(1)
    resolve()
    await p
  })

  it('重新提交会清掉上一次的错误提示', async () => {
    changePassword.mockImplementationOnce(async () => { throw new Error('X') })
    const w = mountForm()
    await fill(w, 'a', 'new-pw', 'new-pw')
    await submitOf(w)
    await w.vm.$nextTick()
    expect(w.find('.set-danger').exists()).toBe(true)
    changePassword.mockResolvedValue(undefined)
    await submitOf(w)
    await w.vm.$nextTick()
    expect(w.find('.set-danger').exists()).toBe(false)
  })
})
