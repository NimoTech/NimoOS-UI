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

// ⚠️ Use braces, do not chain-return the mock (it gets treated as a teardown callback → Unknown Error, we got burned by this before)
beforeEach(() => {
  setActivePinia(createPinia())
  getMembers.mockReset()
  getMembers.mockResolvedValue([])
  createMember.mockReset()
  createMember.mockResolvedValue(ALICE)
  deleteUser.mockReset()
  deleteUser.mockResolvedValue(undefined)
})

// AlertDialog goes through reka Portal teleport → attachTo body and query document, and must be explicitly cleaned up (B4)
let mountedWrappers: Array<{ unmount: () => void }> = []
afterEach(() => {
  for (const w of mountedWrappers) {
    try { w.unmount() } catch { /* already unmounted */ }
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

describe('MembersSection —— maps to the lower half of Vue2 state 1 (:664-712)', () => {
  it('title "Members" + an "Add" button on the right', async () => {
    const w = mountSection()
    await flush()
    expect(w.find('.set-mem-title').text()).toBe(zh.settingsAccMembers)
    expect(w.find('[data-test="acc-member-add"]').text()).toContain(zh.settingsAccAdd)
  })

  it('fetches the member list on mount; the real shape on this machine is an empty array → shows "no members"', async () => {
    const w = mountSection()
    await flush()
    expect(getMembers).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="acc-members-empty"]').text()).toBe(zh.settingsAccNoMembers)
    expect(w.findAll('[data-test="acc-member-row"]')).toHaveLength(0)
  })

  it('when members exist, renders the username + "N folders · created at: <time>"', async () => {
    getMembers.mockResolvedValue([ALICE])
    const w = mountSection()
    await flush()
    const row = w.find('[data-test="acc-member-row"]')
    expect(row.find('.set-mem-name').text()).toBe('alice')
    // The time is computed by the same pure function; don't hand-write a date string in the assertion (timezones will bite you)
    expect(row.find('.set-mem-meta').text()).toContain(`2 ${zh.settingsAccFoldersUnit}`)
    expect(row.find('.set-mem-meta').text()).toContain(formatMemberDate(ALICE.created_at))
  })

  it('does not filter by role —— other admins are listed too (backend user.go:694-697 only hides the caller themselves)', async () => {
    getMembers.mockResolvedValue([ALICE, { ...ALICE, id: 4, username: 'root2', role: 'admin' }])
    const w = mountSection()
    await flush()
    expect(w.findAll('[data-test="acc-member-row"]')).toHaveLength(2)
  })

  it('fetching the list fails → shows an error row instead of disguising it as "no members" (plan C14)', async () => {
    getMembers.mockImplementation(async () => { throw new Error('boom') })
    const w = mountSection()
    await flush()
    expect(w.find('[data-test="acc-members-load-error"]').text()).toBe(zh.settingsAccMembersLoadFailed)
    expect(w.find('[data-test="acc-members-empty"]').exists()).toBe(false)
  })

  it('clicking "Add" expands the inline form, and the empty-state hint disappears with it (Vue2 v-if\'s && !showAddMember)', async () => {
    const w = mountSection()
    await flush()
    expect(w.find('[data-test="acc-member-form"]').exists()).toBe(false)
    await w.find('[data-test="acc-member-add"]').trigger('click')
    expect(w.find('[data-test="acc-member-form"]').exists()).toBe(true)
    expect(w.find('[data-test="acc-members-empty"]').exists()).toBe(false)
  })

  it('all three inputs are wrapped in .set-net-field (C7)', async () => {
    const w = mountSection()
    await flush()
    await w.find('[data-test="acc-member-add"]').trigger('click')
    for (const k of ['acc-member-username', 'acc-member-password', 'acc-member-confirm']) {
      expect(w.find(`[data-test="${k}"]`).element.closest('.set-net-field')).not.toBeNull()
    }
  })

  it('validation: empty field → errors and does not send a request', async () => {
    const w = mountSection()
    await flush()
    await openAddAndFill(w, '', 'pw1234', 'pw1234')
    await w.find('[data-test="acc-member-submit"]').trigger('click')
    await flush()
    expect(w.find('[data-test="acc-member-error"]').text()).toBe(zh.settingsAccFillAllFields)
    expect(createMember).not.toHaveBeenCalled()
  })

  it('validation: password shorter than 6 characters → errors and does not send a request', async () => {
    const w = mountSection()
    await flush()
    await openAddAndFill(w, 'bob', 'pw123', 'pw123')
    await w.find('[data-test="acc-member-submit"]').trigger('click')
    await flush()
    expect(w.find('[data-test="acc-member-error"]').text()).toBe(zh.settingsAccPwdMin6)
    expect(createMember).not.toHaveBeenCalled()
  })

  it('validation: the two passwords do not match → errors and does not send a request', async () => {
    const w = mountSection()
    await flush()
    await openAddAndFill(w, 'bob', 'pw1234', 'pw4321')
    await w.find('[data-test="acc-member-submit"]').trigger('click')
    await flush()
    expect(w.find('[data-test="acc-member-error"]').text()).toBe(zh.settingsAccPwdMismatch)
    expect(createMember).not.toHaveBeenCalled()
  })

  it('add succeeds → closes the form + refetches the list + panel-level toast (B5 reads useToast().msg)', async () => {
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

  it('add fails → inline error prefers the backend message, form stays open, inputs are not cleared', async () => {
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

  it('the button is disabled while submitting (B6: assert the attribute)', async () => {
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

  it('clicking "Cancel" closes the form; the three inputs are already cleared when reopened (Vue2 openAddMember resets every time)', async () => {
    const w = mountSection()
    await flush()
    await openAddAndFill(w, 'bob', 'pw1234', 'pw1234')
    await w.find('[data-test="acc-member-cancel"]').trigger('click')
    expect(w.find('[data-test="acc-member-form"]').exists()).toBe(false)
    await w.find('[data-test="acc-member-add"]').trigger('click')
    expect((w.find('[data-test="acc-member-username"]').element as HTMLInputElement).value).toBe('')
    expect((w.find('[data-test="acc-member-password"]').element as HTMLInputElement).value).toBe('')
  })

  it('clicking delete pops the confirmation dialog, copy contains the member name, confirm button is .ui-btn.danger (B4: query document)', async () => {
    getMembers.mockResolvedValue([ALICE])
    const w = mountSection()
    await flush()
    await w.find('[data-test="acc-member-delete"]').trigger('click')
    await flush()
    const msg = document.querySelector('.ui-alert-msg')
    expect(msg?.textContent).toContain('alice')
    expect(document.querySelector('.ui-btn.danger')).not.toBeNull()
  })

  it('⛔ deleteUser is never called if confirm is not clicked', async () => {
    getMembers.mockResolvedValue([ALICE])
    const w = mountSection()
    await flush()
    await w.find('[data-test="acc-member-delete"]').trigger('click')
    await flush()
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('clicking confirm deletes by id + refetches the list + toast', async () => {
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

  it('delete fails → panel-level toast reports the failure (this is a panel-level action, a toast is the right call)', async () => {
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

  it('clicking a row\'s "settings" button → emits open-member with that member', async () => {
    getMembers.mockResolvedValue([ALICE])
    const w = mountSection()
    await flush()
    await w.find('[data-test="acc-member-settings"]').trigger('click')
    expect(w.emitted('open-member')).toEqual([[ALICE]])
  })

  it('unmounting while the list fetch is in flight does not write back (in-place generation guard; this component has a second trigger point, so the guard is not a no-op)', async () => {
    let resolve!: (v: unknown) => void
    getMembers.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = mountSection()
    w.unmount()
    resolve([ALICE])
    await flush()
    // Should not throw after unmount, and should not trigger a render update
    expect(getMembers).toHaveBeenCalledTimes(1)
  })

  it('while a refetch triggered by add is in flight, the previous stale result must not overwrite the new one (the real path for the generation guard)', async () => {
    // The first fetch is stuck; add succeeding triggers a second fetch that returns immediately; the first must not be allowed to overwrite once it settles
    let resolveFirst!: (v: unknown) => void
    getMembers
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockImplementationOnce(async () => [ALICE])
    const w = mountSection()
    await openAddAndFill(w, 'bob', 'pw1234', 'pw1234')
    await w.find('[data-test="acc-member-submit"]').trigger('click')
    await flush()
    resolveFirst([]) // stale result: an empty list
    await flush()
    expect(w.findAll('[data-test="acc-member-row"]')).toHaveLength(1)
  })
})
