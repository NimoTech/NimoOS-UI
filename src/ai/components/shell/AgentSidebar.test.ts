import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../../i18n/zh_cn'
import AgentSidebar from './AgentSidebar.vue'

const push = vi.fn()
const go = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push, go }),
}))

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

const sessions = [
  { id: 's1', title: '第一段对话', snippet: '最近一条消息摘要' },
  { id: 's2', title: '', snippet: '' },
]

describe('AgentSidebar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockClear(); go.mockClear()
    localStorage.clear()
  })

  it('渲染会话列表:标题/摘要,空标题回落 (未命名)', () => {
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

  it('active 会话打上 data-active', () => {
    const w = mount(AgentSidebar, {
      props: { sessions, activeId: 's1' },
      global: { plugins: [i18n] },
    })
    const items = w.findAll('.chat-item')
    expect(items[0].attributes('data-active')).toBe('true')
    expect(items[1].attributes('data-active')).toBe('false')
  })

  it('无会话时展示空态文案', () => {
    const w = mount(AgentSidebar, {
      props: { sessions: [], activeId: null },
      global: { plugins: [i18n] },
    })
    expect(w.text()).toContain('暂无对话')
  })

  // reka-ui 的 AlertDialogAction 是 DialogClose:点击真实确认按钮时先派发
  // update:open(false) 再派发 @click 里的 confirm。deleteDlg 把 open 与待删 id
  // 打包在同一个 ref、v-model:open 只改 .open 不碰 .id,故 confirm 处理器仍能读到
  // 正确的 id(同 InstalledAppsPage.test.ts 的 SP5-P1 回归用例复现手法:真实挂载 +
  // 真实 reka 弹窗 + attachTo document.body,不 mock reka)。
  it('点击会话行 emit select;点删除只弹 AlertDialog,confirm 后才 emit delete', async () => {
    const w = mount(AgentSidebar, {
      props: { sessions, activeId: 's1' },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    const items = w.findAll('.chat-item')
    await items[0].trigger('click')
    expect(w.emitted('select')?.[0]).toEqual(['s1'])

    await items[0].find('.delete-btn').trigger('click')
    await nextTick() // reka 把 AlertDialogContent Portal 到 document.body 是异步的

    // Not emitted yet — only the confirm dialog should be open.
    expect(w.emitted('delete')).toBeUndefined()
    expect(document.body.textContent).toContain('删除这段对话?')

    const confirmBtn = Array.from(document.body.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === '删除')
    expect(confirmBtn).toBeTruthy()

    confirmBtn!.click() // 真实 DOM click:先触发 reka 内部 onOpenChange(false),再触发 confirm
    await nextTick()

    expect(w.emitted('delete')?.[0]).toEqual(['s1'])
    w.unmount()
  })

  it('collapsed 态只渲染图标按钮,emit new/open-settings', async () => {
    const w = mount(AgentSidebar, {
      props: { sessions, activeId: null, collapsed: true },
      global: { plugins: [i18n] },
    })
    expect(w.find('.sidebar-head').exists()).toBe(false)
    const buttons = w.findAll('.icon-btn')
    await buttons[0].trigger('click')
    expect(w.emitted('new')).toBeTruthy()
    await buttons[1].trigger('click')
    expect(w.emitted('open-settings')).toBeTruthy()
  })

  it('goBack:有历史则 router.go(-1)', async () => {
    const historySpy = vi.spyOn(window.history, 'length', 'get').mockReturnValue(2)
    const w = mount(AgentSidebar, {
      props: { sessions, activeId: null },
      global: { plugins: [i18n] },
    })
    await w.find('.side-back').trigger('click')
    expect(go).toHaveBeenCalledWith(-1)
    historySpy.mockRestore()
  })

  it('头像:无 token 时落默认图;设置了 access_token 时拼 avatar URL', () => {
    localStorage.setItem('access_token', 'tok-1')
    const w = mount(AgentSidebar, {
      props: { sessions, activeId: null },
      global: { plugins: [i18n] },
    })
    const img = w.find('.avatar img')
    expect(img.attributes('src')).toContain('v1/users/avatar?token=tok-1')
  })

  it('用户名读 localStorage.user(nickname 优先),否则回落 User', () => {
    localStorage.setItem('user', JSON.stringify({ nickname: '阿田', role: 'admin' }))
    const w = mount(AgentSidebar, {
      props: { sessions, activeId: null },
      global: { plugins: [i18n] },
    })
    expect(w.find('.user-name').text()).toBe('阿田')
    expect(w.find('.user-meta').text()).toBe('admin')
  })
})
