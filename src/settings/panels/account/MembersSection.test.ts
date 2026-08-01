import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn.sp9'
import MembersSection from './MembersSection.vue'
import { formatMemberDate } from '../../util/memberFormat'

const getMembers = vi.fn()
const createMember = vi.fn()
const deleteUser = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getMembers: (...a: unknown[]) => getMembers(...a),
      createMember: (...a: unknown[]) => createMember(...a),
      deleteUser: (...a: unknown[]) => deleteUser(...a),
    },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const flush = () => new Promise((r) => setTimeout(r, 0))

const ALICE = { id: 3, username: 'alice', role: 'user', folder_count: 2, created_at: '2026-07-01T10:20:30Z' }

// ⚠️ 花括号、不要链式返回 mock(会被当 teardown 回调 → Unknown Error,本期栽过)
beforeEach(() => {
  setActivePinia(createPinia())
  getMembers.mockReset()
  getMembers.mockResolvedValue([])
  createMember.mockReset()
  createMember.mockResolvedValue(ALICE)
  deleteUser.mockReset()
  deleteUser.mockResolvedValue(undefined)
})

// AlertDialog 经 reka Portal teleport → attachTo body 并查 document,且必须显式清理(B4)
let mountedWrappers: Array<{ unmount: () => void }> = []
afterEach(() => {
  for (const w of mountedWrappers) {
    try { w.unmount() } catch { /* 已 unmount 过 */ }
  }
  mountedWrappers = []
  document.body.innerHTML = ''
})

function mountSection() {
  const w = mount(MembersSection, { global: { plugins: [i18n] }, attachTo: document.body })
  mountedWrappers.push(w)
  return w
}

async function openAddAndFill(w: ReturnType<typeof mountSection>, u: string, p: string, c: string) {
  await w.find('[data-test="acc-member-add"]').trigger('click')
  await w.find('[data-test="acc-member-username"]').setValue(u)
  await w.find('[data-test="acc-member-password"]').setValue(p)
  await w.find('[data-test="acc-member-confirm"]').setValue(c)
}

describe('MembersSection —— 对位 Vue2 state 1 下半(:664-712)', () => {
  it('标题「成员」+ 右侧「添加」按钮', async () => {
    const w = mountSection()
    await flush()
    expect(w.find('.set-mem-title').text()).toBe(zh.settingsAccMembers)
    expect(w.find('[data-test="acc-member-add"]').text()).toContain(zh.settingsAccAdd)
  })

  it('挂载即取成员列表;本机真实形态是空数组 → 显示「暂无成员」', async () => {
    const w = mountSection()
    await flush()
    expect(getMembers).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="acc-members-empty"]').text()).toBe(zh.settingsAccNoMembers)
    expect(w.findAll('[data-test="acc-member-row"]')).toHaveLength(0)
  })

  it('有成员时渲染用户名 + 「N 个文件夹 · 创建于: <时间>」', async () => {
    getMembers.mockResolvedValue([ALICE])
    const w = mountSection()
    await flush()
    const row = w.find('[data-test="acc-member-row"]')
    expect(row.find('.set-mem-name').text()).toBe('alice')
    // 时间用同一个纯函数算,别在断言里手写日期串(时区会咬人)
    expect(row.find('.set-mem-meta').text()).toContain(`2 ${zh.settingsAccFoldersUnit}`)
    expect(row.find('.set-mem-meta').text()).toContain(formatMemberDate(ALICE.created_at))
  })

  it('不按 role 过滤 —— 其它管理员也照样列出(后端 user.go:694-697 只隐藏调用者本人)', async () => {
    getMembers.mockResolvedValue([ALICE, { ...ALICE, id: 4, username: 'root2', role: 'admin' }])
    const w = mountSection()
    await flush()
    expect(w.findAll('[data-test="acc-member-row"]')).toHaveLength(2)
  })

  it('取列表失败 → 显示错误行,而不是伪装成「暂无成员」(plan C14)', async () => {
    getMembers.mockImplementation(async () => { throw new Error('boom') })
    const w = mountSection()
    await flush()
    expect(w.find('[data-test="acc-members-load-error"]').text()).toBe(zh.settingsAccMembersLoadFailed)
    expect(w.find('[data-test="acc-members-empty"]').exists()).toBe(false)
  })

  it('点「添加」展开内联表单,空态提示随之消失(Vue2 v-if 的 && !showAddMember)', async () => {
    const w = mountSection()
    await flush()
    expect(w.find('[data-test="acc-member-form"]').exists()).toBe(false)
    await w.find('[data-test="acc-member-add"]').trigger('click')
    expect(w.find('[data-test="acc-member-form"]').exists()).toBe(true)
    expect(w.find('[data-test="acc-members-empty"]').exists()).toBe(false)
  })

  it('三个输入框都包在 .set-net-field 里(C7)', async () => {
    const w = mountSection()
    await flush()
    await w.find('[data-test="acc-member-add"]').trigger('click')
    for (const k of ['acc-member-username', 'acc-member-password', 'acc-member-confirm']) {
      expect(w.find(`[data-test="${k}"]`).element.closest('.set-net-field')).not.toBeNull()
    }
  })

  it('校验:空字段 → 报错且不发请求', async () => {
    const w = mountSection()
    await flush()
    await openAddAndFill(w, '', 'pw1234', 'pw1234')
    await w.find('[data-test="acc-member-submit"]').trigger('click')
    await flush()
    expect(w.find('[data-test="acc-member-error"]').text()).toBe(zh.settingsAccFillAllFields)
    expect(createMember).not.toHaveBeenCalled()
  })

  it('校验:密码短于 6 位 → 报错且不发请求', async () => {
    const w = mountSection()
    await flush()
    await openAddAndFill(w, 'bob', 'pw123', 'pw123')
    await w.find('[data-test="acc-member-submit"]').trigger('click')
    await flush()
    expect(w.find('[data-test="acc-member-error"]').text()).toBe(zh.settingsAccPwdMin6)
    expect(createMember).not.toHaveBeenCalled()
  })

  it('校验:两次密码不一致 → 报错且不发请求', async () => {
    const w = mountSection()
    await flush()
    await openAddAndFill(w, 'bob', 'pw1234', 'pw4321')
    await w.find('[data-test="acc-member-submit"]').trigger('click')
    await flush()
    expect(w.find('[data-test="acc-member-error"]').text()).toBe(zh.settingsAccPwdMismatch)
    expect(createMember).not.toHaveBeenCalled()
  })

  it('添加成功 → 关表单 + 重新取列表 + 面板级 toast(B5 读 useToast().msg)', async () => {
    const { useToast } = await import('../../../stores/toast')
    const w = mountSection()
    await flush()
    await openAddAndFill(w, 'bob', 'pw1234', 'pw1234')
    await w.find('[data-test="acc-member-submit"]').trigger('click')
    await flush()
    expect(createMember).toHaveBeenCalledWith('bob', 'pw1234')
    expect(w.find('[data-test="acc-member-form"]').exists()).toBe(false)
    expect(getMembers).toHaveBeenCalledTimes(2)
    expect(useToast().msg).toBe(zh.settingsAccMemberAdded)
  })

  it('添加失败 → 内联报错优先后端 message,表单保持打开、输入不清空', async () => {
    createMember.mockImplementation(async () => {
      throw Object.assign(new Error('req'), { response: { data: { message: '用户名已存在' } } })
    })
    const w = mountSection()
    await flush()
    await openAddAndFill(w, 'bob', 'pw1234', 'pw1234')
    await w.find('[data-test="acc-member-submit"]').trigger('click')
    await flush()
    expect(w.find('[data-test="acc-member-error"]').text()).toBe('用户名已存在')
    expect(w.find('[data-test="acc-member-form"]').exists()).toBe(true)
    expect((w.find('[data-test="acc-member-username"]').element as HTMLInputElement).value).toBe('bob')
  })

  it('提交在途时按钮 disabled(B6:断属性)', async () => {
    let resolve!: () => void
    createMember.mockReturnValue(new Promise((r) => { resolve = r as () => void }))
    const w = mountSection()
    await flush()
    await openAddAndFill(w, 'bob', 'pw1234', 'pw1234')
    await w.find('[data-test="acc-member-submit"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="acc-member-submit"]').attributes('disabled')).toBeDefined()
    resolve()
    await flush()
  })

  it('点「取消」关表单;再打开时三个输入已清空(Vue2 openAddMember 每次重置)', async () => {
    const w = mountSection()
    await flush()
    await openAddAndFill(w, 'bob', 'pw1234', 'pw1234')
    await w.find('[data-test="acc-member-cancel"]').trigger('click')
    expect(w.find('[data-test="acc-member-form"]').exists()).toBe(false)
    await w.find('[data-test="acc-member-add"]').trigger('click')
    expect((w.find('[data-test="acc-member-username"]').element as HTMLInputElement).value).toBe('')
    expect((w.find('[data-test="acc-member-password"]').element as HTMLInputElement).value).toBe('')
  })

  it('点删除弹确认框,文案含成员名,确认键是 .ui-btn.danger(B4:查 document)', async () => {
    getMembers.mockResolvedValue([ALICE])
    const w = mountSection()
    await flush()
    await w.find('[data-test="acc-member-delete"]').trigger('click')
    await flush()
    const msg = document.querySelector('.ui-alert-msg')
    expect(msg?.textContent).toContain('alice')
    expect(document.querySelector('.ui-btn.danger')).not.toBeNull()
  })

  it('⛔ 不点确认时 deleteUser 一次都不会被调用', async () => {
    getMembers.mockResolvedValue([ALICE])
    const w = mountSection()
    await flush()
    await w.find('[data-test="acc-member-delete"]').trigger('click')
    await flush()
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('点确认后按 id 删除 + 重新取列表 + toast', async () => {
    const { useToast } = await import('../../../stores/toast')
    getMembers.mockResolvedValue([ALICE])
    const w = mountSection()
    await flush()
    await w.find('[data-test="acc-member-delete"]').trigger('click')
    await flush()
    ;(document.querySelector('.ui-btn.danger') as HTMLButtonElement).click()
    await flush()
    expect(deleteUser).toHaveBeenCalledWith(3)
    expect(getMembers).toHaveBeenCalledTimes(2)
    expect(useToast().msg).toBe(zh.settingsAccDeleted)
  })

  it('删除失败 → 面板级 toast 提示失败(这是面板级操作,用 toast 是对的)', async () => {
    const { useToast } = await import('../../../stores/toast')
    getMembers.mockResolvedValue([ALICE])
    deleteUser.mockImplementation(async () => { throw new Error('nope') })
    const w = mountSection()
    await flush()
    await w.find('[data-test="acc-member-delete"]').trigger('click')
    await flush()
    ;(document.querySelector('.ui-btn.danger') as HTMLButtonElement).click()
    await flush()
    expect(useToast().msg).toBe(zh.settingsAccDeleteFailed)
  })

  it('点某行的「设置」按钮 → emit open-member 带该成员', async () => {
    getMembers.mockResolvedValue([ALICE])
    const w = mountSection()
    await flush()
    await w.find('[data-test="acc-member-settings"]').trigger('click')
    expect(w.emitted('open-member')).toEqual([[ALICE]])
  })

  it('取列表在途时卸载不回写(就地代际守卫;本组件有第二个触发点,守卫非空转)', async () => {
    let resolve!: (v: unknown) => void
    getMembers.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = mountSection()
    w.unmount()
    resolve([ALICE])
    await flush()
    // 卸载后不该抛,也不该有渲染更新
    expect(getMembers).toHaveBeenCalledTimes(1)
  })

  it('添加后重新取数在途时,前一次的旧结果不许覆盖新结果(代际守卫的真实路径)', async () => {
    // 第一次取数卡住,添加成功触发第二次取数并立刻返回;第一次后落定不许覆盖
    let resolveFirst!: (v: unknown) => void
    getMembers
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockImplementationOnce(async () => [ALICE])
    const w = mountSection()
    await openAddAndFill(w, 'bob', 'pw1234', 'pw1234')
    await w.find('[data-test="acc-member-submit"]').trigger('click')
    await flush()
    resolveFirst([]) // 旧结果:空列表
    await flush()
    expect(w.findAll('[data-test="acc-member-row"]')).toHaveLength(1)
  })
})
