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
// ⚠️ **Must use braces here, not `beforeEach(() => mock.mockReset().mockResolvedValue(x))`** —
// that chained form makes the mock function itself get **returned to vitest as the teardown
// callback** (beforeEach supports returning a cleanup function), so after every test vitest
// **calls this mock a second time**; if that test swapped the implementation to "throw", that
// extra call produces a rejected promise nobody awaits → surfaces as `Unknown Error: <msg>`,
// even though the assertions all actually passed.
// This file's three false failures came from exactly this, and took a few rounds to track down.
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

describe('ChangePasswordForm — maps to Vue2 state 3 (:723-744) + savePassword (:415-440)', () => {
  it('three password-type inputs, placeholder copy matches Vue2', () => {
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

  it('all three inputs are wrapped in .set-net-field (C7: otherwise they inherit .set-input\'s 92px)', () => {
    const w = mountForm()
    for (const k of ['acc-pwd-ori', 'acc-pwd-new', 'acc-pwd-cfm']) {
      expect(w.find(`[data-test="${k}"]`).element.closest('.set-net-field')).not.toBeNull()
    }
  })

  it('has an autocomplete=username honeypot (Vue2 :725, prevents the browser from autofilling elsewhere)', () => {
    expect(mountForm().find('input[autocomplete="username"]').exists()).toBe(true)
  })

  it('mismatched new passwords → inline error, and no request is sent at all', async () => {
    const w = mountForm()
    await fill(w, 'old', 'aaaaaa', 'bbbbbb')
    expect(await submitOf(w)).toBe(false)
    await w.vm.$nextTick()
    expect(w.find('.set-danger').text()).toBe(zh.settingsAccPwdMismatch)
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('any field left empty → inline error, no request sent', async () => {
    const w = mountForm()
    await fill(w, '', 'aaaaaa', 'aaaaaa')
    expect(await submitOf(w)).toBe(false)
    expect(changePassword).not.toHaveBeenCalled()
    expect(w.find('.set-danger').text()).toBe(zh.settingsAccFillAllFields)
  })

  it('an empty confirm field is blocked too (Vue2 marks all three fields required)', async () => {
    const w = mountForm()
    await fill(w, 'old', 'aaaaaa', '')
    expect(await submitOf(w)).toBe(false)
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('on success, calls the shared package with (old_password, password) in that order, and returns true', async () => {
    const w = mountForm()
    await fill(w, 'old-pw', 'new-pw', 'new-pw')
    expect(await submitOf(w)).toBe(true)
    expect(changePassword).toHaveBeenCalledWith('old-pw', 'new-pw')
  })

  it('clears all three inputs on success (Vue2 :429-431)', async () => {
    const w = mountForm()
    await fill(w, 'old-pw', 'new-pw', 'new-pw')
    await submitOf(w)
    await w.vm.$nextTick()
    for (const k of ['acc-pwd-ori', 'acc-pwd-new', 'acc-pwd-cfm']) {
      expect((w.find(`[data-test="${k}"]`).element as HTMLInputElement).value).toBe('')
    }
  })

  it('on failure, prefers the backend message, shown inline via .set-danger instead of a toast (C6)', async () => {
    changePassword.mockImplementation(async () => { throw Object.assign(new Error('Request failed'), { response: { data: { message: '原密码错误' } } }) })
    const w = mountForm()
    await fill(w, 'bad', 'new-pw', 'new-pw')
    expect(await submitOf(w)).toBe(false)
    await w.vm.$nextTick()
    expect(w.find('.set-danger').text()).toBe('原密码错误')
  })

  it('falls back to axios\'s message when the backend gives none', async () => {
    changePassword.mockImplementation(async () => { throw new Error('Network Error') }) // A network error with no response
    const w = mountForm()
    await fill(w, 'a', 'new-pw', 'new-pw')
    await submitOf(w)
    await w.vm.$nextTick()
    expect(w.find('.set-danger').text()).toBe('Network Error')
  })

  it('input is not cleared after a failure (lets the user tweak one character and retry)', async () => {
    changePassword.mockImplementation(async () => { throw new Error('X') })
    const w = mountForm()
    await fill(w, 'bad', 'new-pw', 'new-pw')
    await submitOf(w)
    await w.vm.$nextTick()
    expect((w.find('[data-test="acc-pwd-ori"]').element as HTMLInputElement).value).toBe('bad')
  })

  it('all three fields are disabled while submit is in flight, and no second request is produced', async () => {
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

  it('resubmitting clears the previous error message', async () => {
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
