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

// ⚠️ Use braces, don't return a chained mock (it gets treated as a teardown callback →
// Unknown Error — this bit us during this milestone)
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
    try { w.unmount() } catch { /* already unmounted */ }
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

describe('MemberFoldersView — parity with Vue2 state 5 (:849-901)', () => {
  it('the intro line is assembled from three parts: prefix + member name + suffix (Vue2 :850-852)', async () => {
    const w = mountView()
    await flush()
    const txt = w.find('[data-test="acc-perm-intro"]').text()
    expect(txt).toContain(zh.settingsAccFoldersAccessiblePrefix.trim())
    expect(txt).toContain('alice')
    expect(txt).toContain(zh.settingsAccSystemDiskBlocked.trim())
  })

  it('fetches the permission list by member.id on mount; empty list → shows "no folders granted"', async () => {
    const w = mountView()
    await flush()
    expect(getMemberFolders).toHaveBeenCalledWith(3)
    expect(w.find('[data-test="acc-perm-empty"]').text()).toBe(zh.settingsAccNoFoldersGranted)
  })

  it('fetching the list fails → shows an error row instead of masquerading as "no folders granted" (plan C14)', async () => {
    getMemberFolders.mockImplementation(async () => { throw new Error('boom') })
    const w = mountView()
    await flush()
    expect(w.find('[data-test="acc-perm-load-error"]').text()).toBe(zh.settingsAccFoldersLoadFailed)
    expect(w.find('[data-test="acc-perm-empty"]').exists()).toBe(false)
  })

  it('each row renders a monospace path + permission badge + timestamp', async () => {
    getMemberFolders.mockResolvedValue([PERM_R])
    const w = mountView()
    await flush()
    const row = w.find('[data-test="acc-perm-row"]')
    expect(row.find('.set-perm-path').text()).toBe('/DATA/Downloads')
    expect(row.find('[data-test="acc-perm-badge"]').text()).toBe(zh.settingsAccReadOnly)
    expect(row.find('.set-mem-meta').text()).toContain(formatMemberDate(PERM_R.created_at))
  })

  it('write renders as "Read/write"; any other value (including ones the backend shouldn\'t send) goes through the "Read-only" branch', async () => {
    getMemberFolders.mockResolvedValue([PERM_W, { ...PERM_R, id: 13, permission: 'weird' }])
    const w = mountView()
    await flush()
    const badges = w.findAll('[data-test="acc-perm-badge"]').map((n) => n.text())
    expect(badges).toEqual([zh.settingsAccReadWrite, zh.settingsAccReadOnly])
  })

  it('clicking "Add folder" expands the form: the path input\'s placeholder matches Vue2 verbatim, permission defaults to read-only', async () => {
    const w = mountView()
    await flush()
    await w.find('[data-test="acc-perm-add"]').trigger('click')
    expect(w.find('[data-test="acc-perm-path"]').attributes('placeholder')).toBe('/DATA/Downloads')
    expect((w.find('[data-test="acc-perm-permission"]').element as HTMLSelectElement).value).toBe('read')
    // Vue2 :875's v-if="!showGrantFolder" — the "Add" button disappears once the form is open
    expect(w.find('[data-test="acc-perm-add"]').exists()).toBe(false)
  })

  it('both the input and the dropdown are wrapped in .set-net-field (C7)', async () => {
    const w = mountView()
    await flush()
    await w.find('[data-test="acc-perm-add"]').trigger('click')
    expect(w.find('[data-test="acc-perm-path"]').element.closest('.set-net-field')).not.toBeNull()
    expect(w.find('[data-test="acc-perm-permission"]').element.closest('.set-net-field')).not.toBeNull()
  })

  it('an empty or whitespace-only path → inline error, no request sent', async () => {
    const w = mountView()
    await flush()
    await openGrantAndFill(w, '   ')
    await w.find('[data-test="acc-perm-submit"]').trigger('click')
    await flush()
    expect(w.find('[data-test="acc-perm-error"]').text()).toBe(zh.settingsAccEnterFolderPath)
    expect(grantMemberFolder).not.toHaveBeenCalled()
  })

  it('grant succeeds: the path is trimmed, default permission is read, the form closes + the list is re-fetched + a toast shows', async () => {
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

  it('when "Read/write" is selected, the third argument is write', async () => {
    const w = mountView()
    await flush()
    await openGrantAndFill(w, '/DATA/Docs', 'write')
    await w.find('[data-test="acc-perm-submit"]').trigger('click')
    await flush()
    expect(grantMemberFolder).toHaveBeenCalledWith(3, '/DATA/Docs', 'write')
  })

  it('grant fails → the inline error prefers the backend message, the form stays open', async () => {
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

  it('the submit button is disabled while the grant is in flight (B6: attribute assertion)', async () => {
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

  it('clicking revoke pops a confirm dialog whose text includes the path; the confirm button is .ui-btn.danger (B4: querying document)', async () => {
    getMemberFolders.mockResolvedValue([PERM_R])
    const w = mountView()
    await flush()
    await w.find('[data-test="acc-perm-revoke"]').trigger('click')
    await flush()
    expect(document.querySelector('.ui-alert-msg')?.textContent).toContain('/DATA/Downloads')
    expect(document.querySelector('.ui-btn.danger')).not.toBeNull()
  })

  it('⛔ revokeMemberFolder is never called when confirm is not clicked', async () => {
    getMemberFolders.mockResolvedValue([PERM_R])
    const w = mountView()
    await flush()
    await w.find('[data-test="acc-perm-revoke"]').trigger('click')
    await flush()
    expect(revokeMemberFolder).not.toHaveBeenCalled()
  })

  it('clicking confirm revokes by (memberId, permId) + re-fetches the list + shows a toast', async () => {
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

  it('revoke fails → a panel-level toast reports the failure', async () => {
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

  it('while a re-fetch after a grant is in flight, the previous stale result must not overwrite the newer result (the generation guard\'s real-world path)', async () => {
    let resolveFirst!: (v: unknown) => void
    getMemberFolders
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockImplementationOnce(async () => [PERM_R])
    const w = mountView()
    await openGrantAndFill(w, '/DATA/Downloads')
    await w.find('[data-test="acc-perm-submit"]').trigger('click')
    await flush()
    resolveFirst([]) // Stale result: empty list
    await flush()
    expect(w.findAll('[data-test="acc-perm-row"]')).toHaveLength(1)
  })
})
