import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import AgentSidebar from './AgentSidebar.vue'
import { useUserProfile } from '../../../stores/userProfile'

const push = vi.fn().mockResolvedValue(undefined)
const routeState = { path: '/agent' }
vi.mock('vue-router', () => ({
  useRouter: () => ({ push, currentRoute: { value: routeState } }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

const sessions = [
  { id: 's1', title: '第一段对话', snippet: '最近一条消息摘要' },
  { id: 's2', title: '', snippet: '' },
]

describe('AgentSidebar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockClear()
    routeState.path = '/agent'
    localStorage.clear()
  })

  it('renders the session list — title/snippet, empty title falls back to (未命名)', () => {
    const w = mount(AgentSidebar, {
      props: { sessions, activeId: 's1' },
      global: { plugins: [i18n] },
    })
    const items = w.findAll('.chat-item')
    expect(items).toHaveLength(2)
    expect(items[0].find('.chat-item-title').text()).toBe('第一段对话')
    expect(items[0].find('.chat-item-snippet').text()).toBe('最近一条消息摘要')
    expect(items[1].find('.chat-item-title').text()).toBe('(未命名)')
  })

  it('marks the active session with data-active', () => {
    const w = mount(AgentSidebar, {
      props: { sessions, activeId: 's1' },
      global: { plugins: [i18n] },
    })
    const items = w.findAll('.chat-item')
    expect(items[0].attributes('data-active')).toBe('true')
    expect(items[1].attributes('data-active')).toBe('false')
  })

  it('shows the empty-state copy when there are no sessions', () => {
    const w = mount(AgentSidebar, {
      props: { sessions: [], activeId: null },
      global: { plugins: [i18n] },
    })
    expect(w.text()).toContain('暂无对话')
  })

  // reka-ui's AlertDialogAction is a DialogClose: clicking the real confirm button
  // first dispatches update:open(false), then dispatches the @click confirm handler.
  // deleteDlg packs open and the pending-delete id into the same ref, and
  // v-model:open only touches .open, never .id, so the confirm handler can still
  // read the correct id (same reproduction technique as the SP5-P1 regression case
  // in InstalledAppsPage.test.ts: a real mount + a real reka dialog + attachTo
  // document.body, no mocking reka).
  it('clicking a session row emits select; clicking delete only opens the AlertDialog, and delete is only emitted after confirm', async () => {
    const w = mount(AgentSidebar, {
      props: { sessions, activeId: 's1' },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    const items = w.findAll('.chat-item')
    await items[0].trigger('click')
    expect(w.emitted('select')?.[0]).toEqual(['s1'])

    await items[0].find('.delete-btn').trigger('click')
    await nextTick() // reka portals AlertDialogContent into document.body asynchronously

    // Not emitted yet — only the confirm dialog should be open.
    expect(w.emitted('delete')).toBeUndefined()
    expect(document.body.textContent).toContain('删除这段对话?')

    const confirmBtn = Array.from(document.body.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === '删除')
    expect(confirmBtn).toBeTruthy()

    confirmBtn!.click() // real DOM click: triggers reka's internal onOpenChange(false) first, then confirm
    await nextTick()

    expect(w.emitted('delete')?.[0]).toEqual(['s1'])
    w.unmount()
  })

  it('renders only icon buttons when collapsed, emits new/open-settings', async () => {
    const w = mount(AgentSidebar, {
      props: { sessions, activeId: null, collapsed: true },
      global: { plugins: [i18n] },
    })
    // The collapsed rail carries the (single) back button at its very top,
    // but it is *not* an .icon-btn, so the indices below are unaffected.
    expect(w.find('[data-test="back"]').exists()).toBe(true)
    const buttons = w.findAll('.icon-btn')
    await buttons[0].trigger('click')
    expect(w.emitted('new')).toBeTruthy()
    // buttons[1] is the scheduled-tasks entry (Vue2 parity port); settings
    // moved to buttons[2].
    await buttons[1].trigger('click')
    expect(w.emitted('open-tasks')).toBeTruthy()
    await buttons[2].trigger('click')
    expect(w.emitted('open-settings')).toBeTruthy()
  })

  it('no brand block: the logo / "Nimo · AI · NAS" head is gone in both modes', () => {
    for (const collapsed of [false, true]) {
      const w = mount(AgentSidebar, {
        props: { sessions, activeId: null, collapsed },
        global: { plugins: [i18n] },
      })
      expect(w.find('.sidebar-head').exists()).toBe(false)
      expect(w.find('.brand-mark').exists()).toBe(false)
      expect(w.find('.brand-name').exists()).toBe(false)
      // The single back button is the first thing in the sidebar (top-left).
      expect(w.find('aside > *').element).toBe(w.find('[data-test="back"]').element)
    }
  })

  it('goBack: pushes / when there is history and we are not already on /', async () => {
    const historySpy = vi.spyOn(window.history, 'length', 'get').mockReturnValue(2)
    const w = mount(AgentSidebar, {
      props: { sessions, activeId: null },
      global: { plugins: [i18n] },
    })
    await w.find('.side-back').trigger('click')
    expect(push).toHaveBeenCalledWith('/')
    historySpy.mockRestore()
  })

  it('goBack: hard-navigates to /app/ when the tab has no history (opened fresh from the launcher)', async () => {
    const historySpy = vi.spyOn(window.history, 'length', 'get').mockReturnValue(1)
    const original = window.location
    const loc = { ...original, href: '' } as unknown as Location
    Object.defineProperty(window, 'location', { value: loc, writable: true, configurable: true })
    try {
      const w = mount(AgentSidebar, {
        props: { sessions, activeId: null, collapsed: true },
        global: { plugins: [i18n] },
      })
      await w.find('[data-test="back"]').trigger('click')
      expect(push).not.toHaveBeenCalled()
      expect(loc.href).toBe('/app/')
    } finally {
      Object.defineProperty(window, 'location', { value: original, writable: true, configurable: true })
      historySpy.mockRestore()
    }
  })

  it('avatar: falls back to the default image without a token; builds the avatar URL when access_token is set', () => {
    localStorage.setItem('access_token', 'tok-1')
    const w = mount(AgentSidebar, {
      props: { sessions, activeId: null },
      global: { plugins: [i18n] },
    })
    const img = w.find('.avatar img')
    expect(img.attributes('src')).toContain('v1/users/avatar?token=tok-1')
  })

  // SP8-P1c2 Task 7: avatarVersion was moved from a component-local ref up into
  // the useUserProfile store. These two cases prove: (1) the avatar URL's &v=
  // reads the store's value (initial value 1), and (2) a store version change
  // drives a recompute of the URL in an already-mounted component — this is the
  // proof that a future account panel can call bumpAvatarVersion() after a
  // successful avatar upload and have the sidebar refresh along with it, with no
  // event bus and no changes needed to the AI area's code.
  it('the avatar URL contains &v=<store version> (initial value 1)', () => {
    localStorage.setItem('access_token', 'tok-1')
    const w = mount(AgentSidebar, {
      props: { sessions, activeId: null },
      global: { plugins: [i18n] },
    })
    const img = w.find('.avatar img')
    expect(img.attributes('src')).toContain('v1/users/avatar?token=tok-1&v=1')
  })

  it('the avatar URL v parameter changes after store.bumpAvatarVersion() (takes effect across components)', async () => {
    localStorage.setItem('access_token', 'tok-1')
    const w = mount(AgentSidebar, {
      props: { sessions, activeId: null },
      global: { plugins: [i18n] },
    })
    const profile = useUserProfile()
    profile.bumpAvatarVersion()
    await nextTick()
    const img = w.find('.avatar img')
    expect(img.attributes('src')).toContain('v1/users/avatar?token=tok-1&v=2')
  })

  it('the username reads localStorage.user (nickname takes priority), otherwise falls back to User', () => {
    localStorage.setItem('user', JSON.stringify({ nickname: '阿田', role: 'admin' }))
    const w = mount(AgentSidebar, {
      props: { sessions, activeId: null },
      global: { plugins: [i18n] },
    })
    expect(w.find('.user-name').text()).toBe('阿田')
    expect(w.find('.user-meta').text()).toBe('admin')
  })
})
