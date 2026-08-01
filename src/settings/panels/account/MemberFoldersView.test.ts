import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../../i18n/zh_cn.sp9'
import MemberFoldersView from './MemberFoldersView.vue'
import { formatMemberDate } from '../../util/memberFormat'

const getMemberFolders = vi.fn()
const grantMemberFolder = vi.fn()
const revokeMemberFolder = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getMemberFolders: (...a: unknown[]) => getMemberFolders(...a),
      grantMemberFolder: (...a: unknown[]) => grantMemberFolder(...a),
      revokeMemberFolder: (...a: unknown[]) => revokeMemberFolder(...a),
    },
  },
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
const flush = () => new Promise((r) => setTimeout(r, 0))

const MEMBER = { id: 3, username: 'alice', role: 'user', folder_count: 1, created_at: 'x' }
const PERM_R = { id: 11, user_id: 3, path: '/DATA/Downloads', permission: 'read', created_at: '2026-07-01T10:20:30Z' }
const PERM_W = { id: 12, user_id: 3, path: '/DATA/Docs', permission: 'write', created_at: '2026-07-02T10:20:30Z' }

// ⚠️ 花括号、不要链式返回 mock(会被当 teardown 回调 → Unknown Error,本期栽过)
beforeEach(() => {
  setActivePinia(createPinia())
  getMemberFolders.mockReset()
  getMemberFolders.mockResolvedValue([])
  grantMemberFolder.mockReset()
  grantMemberFolder.mockResolvedValue(PERM_R)
  revokeMemberFolder.mockReset()
  revokeMemberFolder.mockResolvedValue(undefined)
})

let mountedWrappers: Array<{ unmount: () => void }> = []
afterEach(() => {
  for (const w of mountedWrappers) {
    try { w.unmount() } catch { /* 已 unmount 过 */ }
  }
  mountedWrappers = []
  document.body.innerHTML = ''
})

function mountView() {
  const w = mount(MemberFoldersView, {
    props: { member: MEMBER },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  mountedWrappers.push(w)
  return w
}

async function openGrantAndFill(w: ReturnType<typeof mountView>, path: string, perm?: 'read' | 'write') {
  await w.find('[data-test="acc-perm-add"]').trigger('click')
  await w.find('[data-test="acc-perm-path"]').setValue(path)
  if (perm) await w.find('[data-test="acc-perm-permission"]').setValue(perm)
}

describe('MemberFoldersView —— 对位 Vue2 state 5(:849-901)', () => {
  it('顶部说明由三段拼成:前缀 + 成员名 + 后缀(Vue2 :850-852)', async () => {
    const w = mountView()
    await flush()
    const txt = w.find('[data-test="acc-perm-intro"]').text()
    expect(txt).toContain(zh.settingsAccFoldersAccessiblePrefix.trim())
    expect(txt).toContain('alice')
    expect(txt).toContain(zh.settingsAccSystemDiskBlocked.trim())
  })

  it('挂载即按 member.id 取授权列表;空列表 → 显示「未授权任何文件夹」', async () => {
    const w = mountView()
    await flush()
    expect(getMemberFolders).toHaveBeenCalledWith(3)
    expect(w.find('[data-test="acc-perm-empty"]').text()).toBe(zh.settingsAccNoFoldersGranted)
  })

  it('取列表失败 → 显示错误行,而不是伪装成「未授权任何文件夹」(plan C14)', async () => {
    getMemberFolders.mockImplementation(async () => { throw new Error('boom') })
    const w = mountView()
    await flush()
    expect(w.find('[data-test="acc-perm-load-error"]').text()).toBe(zh.settingsAccFoldersLoadFailed)
    expect(w.find('[data-test="acc-perm-empty"]').exists()).toBe(false)
  })

  it('每行渲染等宽路径 + 权限徽标 + 时间', async () => {
    getMemberFolders.mockResolvedValue([PERM_R])
    const w = mountView()
    await flush()
    const row = w.find('[data-test="acc-perm-row"]')
    expect(row.find('.set-perm-path').text()).toBe('/DATA/Downloads')
    expect(row.find('[data-test="acc-perm-badge"]').text()).toBe(zh.settingsAccReadOnly)
    expect(row.find('.set-mem-meta').text()).toContain(formatMemberDate(PERM_R.created_at))
  })

  it('write 渲染成「读写」,其它值(含后端理论上不该出现的)都走「只读」分支', async () => {
    getMemberFolders.mockResolvedValue([PERM_W, { ...PERM_R, id: 13, permission: 'weird' }])
    const w = mountView()
    await flush()
    const badges = w.findAll('[data-test="acc-perm-badge"]').map((n) => n.text())
    expect(badges).toEqual([zh.settingsAccReadWrite, zh.settingsAccReadOnly])
  })

  it('点「添加文件夹」展开表单:路径输入 placeholder 与 Vue2 逐字一致,权限默认只读', async () => {
    const w = mountView()
    await flush()
    await w.find('[data-test="acc-perm-add"]').trigger('click')
    expect(w.find('[data-test="acc-perm-path"]').attributes('placeholder')).toBe('/DATA/Downloads')
    expect((w.find('[data-test="acc-perm-permission"]').element as HTMLSelectElement).value).toBe('read')
    // Vue2 :875 的 v-if="!showGrantFolder" —— 表单打开时「添加」按钮消失
    expect(w.find('[data-test="acc-perm-add"]').exists()).toBe(false)
  })

  it('输入框与下拉都包在 .set-net-field 里(C7)', async () => {
    const w = mountView()
    await flush()
    await w.find('[data-test="acc-perm-add"]').trigger('click')
    expect(w.find('[data-test="acc-perm-path"]').element.closest('.set-net-field')).not.toBeNull()
    expect(w.find('[data-test="acc-perm-permission"]').element.closest('.set-net-field')).not.toBeNull()
  })

  it('路径为空或只有空白 → 内联报错,不发请求', async () => {
    const w = mountView()
    await flush()
    await openGrantAndFill(w, '   ')
    await w.find('[data-test="acc-perm-submit"]').trigger('click')
    await flush()
    expect(w.find('[data-test="acc-perm-error"]').text()).toBe(zh.settingsAccEnterFolderPath)
    expect(grantMemberFolder).not.toHaveBeenCalled()
  })

  it('授权成功:路径经过 trim,默认权限 read,关表单 + 重新取列表 + toast', async () => {
    const { useToast } = await import('../../../stores/toast')
    const w = mountView()
    await flush()
    await openGrantAndFill(w, '  /DATA/Downloads  ')
    await w.find('[data-test="acc-perm-submit"]').trigger('click')
    await flush()
    expect(grantMemberFolder).toHaveBeenCalledWith(3, '/DATA/Downloads', 'read')
    expect(w.find('[data-test="acc-perm-form"]').exists()).toBe(false)
    expect(getMemberFolders).toHaveBeenCalledTimes(2)
    expect(useToast().msg).toBe(zh.settingsAccFolderGranted)
  })

  it('选了「读写」时第三个参数是 write', async () => {
    const w = mountView()
    await flush()
    await openGrantAndFill(w, '/DATA/Docs', 'write')
    await w.find('[data-test="acc-perm-submit"]').trigger('click')
    await flush()
    expect(grantMemberFolder).toHaveBeenCalledWith(3, '/DATA/Docs', 'write')
  })

  it('授权失败 → 内联报错优先后端 message,表单不关', async () => {
    grantMemberFolder.mockImplementation(async () => {
      throw Object.assign(new Error('req'), { response: { data: { message: '路径不存在' } } })
    })
    const w = mountView()
    await flush()
    await openGrantAndFill(w, '/DATA/X')
    await w.find('[data-test="acc-perm-submit"]').trigger('click')
    await flush()
    expect(w.find('[data-test="acc-perm-error"]').text()).toBe('路径不存在')
    expect(w.find('[data-test="acc-perm-form"]').exists()).toBe(true)
  })

  it('授权在途时提交按钮 disabled(B6:断属性)', async () => {
    let resolve!: (v: unknown) => void
    grantMemberFolder.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = mountView()
    await flush()
    await openGrantAndFill(w, '/DATA/X')
    await w.find('[data-test="acc-perm-submit"]').trigger('click')
    await w.vm.$nextTick()
    expect(w.find('[data-test="acc-perm-submit"]').attributes('disabled')).toBeDefined()
    resolve(PERM_R)
    await flush()
  })

  it('点撤销弹确认框,文案含该路径,确认键是 .ui-btn.danger(B4:查 document)', async () => {
    getMemberFolders.mockResolvedValue([PERM_R])
    const w = mountView()
    await flush()
    await w.find('[data-test="acc-perm-revoke"]').trigger('click')
    await flush()
    expect(document.querySelector('.ui-alert-msg')?.textContent).toContain('/DATA/Downloads')
    expect(document.querySelector('.ui-btn.danger')).not.toBeNull()
  })

  it('⛔ 不点确认时 revokeMemberFolder 一次都不会被调用', async () => {
    getMemberFolders.mockResolvedValue([PERM_R])
    const w = mountView()
    await flush()
    await w.find('[data-test="acc-perm-revoke"]').trigger('click')
    await flush()
    expect(revokeMemberFolder).not.toHaveBeenCalled()
  })

  it('点确认后按 (memberId, permId) 撤销 + 重新取列表 + toast', async () => {
    const { useToast } = await import('../../../stores/toast')
    getMemberFolders.mockResolvedValue([PERM_R])
    const w = mountView()
    await flush()
    await w.find('[data-test="acc-perm-revoke"]').trigger('click')
    await flush()
    ;(document.querySelector('.ui-btn.danger') as HTMLButtonElement).click()
    await flush()
    expect(revokeMemberFolder).toHaveBeenCalledWith(3, 11)
    expect(getMemberFolders).toHaveBeenCalledTimes(2)
    expect(useToast().msg).toBe(zh.settingsAccAccessRevoked)
  })

  it('撤销失败 → 面板级 toast 提示失败', async () => {
    const { useToast } = await import('../../../stores/toast')
    getMemberFolders.mockResolvedValue([PERM_R])
    revokeMemberFolder.mockImplementation(async () => { throw new Error('nope') })
    const w = mountView()
    await flush()
    await w.find('[data-test="acc-perm-revoke"]').trigger('click')
    await flush()
    ;(document.querySelector('.ui-btn.danger') as HTMLButtonElement).click()
    await flush()
    expect(useToast().msg).toBe(zh.settingsAccRevokeFailed)
  })

  it('授权后重新取数在途时,前一次的旧结果不许覆盖新结果(代际守卫的真实路径)', async () => {
    let resolveFirst!: (v: unknown) => void
    getMemberFolders
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockImplementationOnce(async () => [PERM_R])
    const w = mountView()
    await openGrantAndFill(w, '/DATA/Downloads')
    await w.find('[data-test="acc-perm-submit"]').trigger('click')
    await flush()
    resolveFirst([]) // 旧结果:空列表
    await flush()
    expect(w.findAll('[data-test="acc-perm-row"]')).toHaveLength(1)
  })
})
