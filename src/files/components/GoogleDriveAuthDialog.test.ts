import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import GoogleDriveAuthDialog from './GoogleDriveAuthDialog.vue'
import { useToast } from '../../stores/toast'

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({
  service: { driver: { googleDriveCustomAuth: authMock } },
}))

const i18n = createI18n({
  legacy: false,
  locale: 'zh_cn',
  messages: {
    zh_cn: {
      filesGdriveTitle: '绑定 Google 云端硬盘',
      filesGdriveHint: '填入在你自己的 Google Cloud 项目中创建的 OAuth 凭据。',
      filesGdriveGuide: '如何获取?',
      filesGdriveClientId: 'Client ID',
      filesGdriveClientSecret: 'Client Secret',
      filesGdriveFailed: '发起授权失败',
      filesCancel: '取消',
      filesMountConnect: '连接',
      filesMountConnecting: '连接中…',
    },
  },
})

function mountDlg(open = true) {
  return mount(GoogleDriveAuthDialog, {
    props: { open },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
}

function q<T extends Element>(sel: string): T {
  const el = document.body.querySelector<T>(sel)
  if (!el) throw new Error(`not found: ${sel}`)
  return el
}

async function type(sel: string, value: string) {
  const input = q<HTMLInputElement>(sel)
  input.value = value
  input.dispatchEvent(new Event('input'))
  await nextTick()
}

beforeEach(() => {
  setActivePinia(createPinia())
  document.body.innerHTML = ''
  authMock.mockReset()
})

describe('GoogleDriveAuthDialog', () => {
  it('渲染标题/提示/指引链接(指向本应用自带的 guide 页)', async () => {
    mountDlg()
    await nextTick()
    expect(document.body.textContent).toContain('绑定 Google 云端硬盘')
    const a = q<HTMLAnchorElement>('.gdrive-hint a')
    expect(a.getAttribute('href')).toBe(window.location.origin + import.meta.env.BASE_URL + 'guide/google-drive.html')
    expect(a.getAttribute('target')).toBe('_blank')
  })

  it('空值/仅空格时连接按钮 disabled,不调 service', async () => {
    mountDlg()
    await nextTick()
    const btn = q<HTMLButtonElement>('.ui-btn.primary')
    expect(btn.disabled).toBe(true)
    await type('input[name="client_id"]', '   ')
    await type('input[name="client_secret"]', '  ')
    expect(btn.disabled).toBe(true)
    expect(authMock).not.toHaveBeenCalled()
  })

  it('填两项(带首尾空格)→ 连接:trim 后调 service,成功 emit auth-url + 关框', async () => {
    authMock.mockResolvedValue('https://auth?state=${HOST}x')
    const w = mountDlg()
    await nextTick()
    await type('input[name="client_id"]', '  my-id.apps.googleusercontent.com ')
    await type('input[name="client_secret"]', ' GOCSPX-sec ')
    const btn = q<HTMLButtonElement>('.ui-btn.primary')
    expect(btn.disabled).toBe(false)
    btn.click()
    await flushPromises()
    expect(authMock).toHaveBeenCalledWith('my-id.apps.googleusercontent.com', 'GOCSPX-sec')
    expect(w.emitted('auth-url')).toEqual([['https://auth?state=${HOST}x']])
    expect(w.emitted('update:open')).toEqual([[false]])
  })

  it('失败透出后端 message;取不到用通用键;框不关', async () => {
    authMock.mockRejectedValueOnce({ response: { data: { message: '凭据无效' } } })
    const w = mountDlg()
    await nextTick()
    const toast = useToast()
    await type('input[name="client_id"]', 'a')
    await type('input[name="client_secret"]', 'b')
    q<HTMLButtonElement>('.ui-btn.primary').click()
    await flushPromises()
    expect(toast.msg).toBe('凭据无效')
    expect(w.emitted('update:open')).toBeUndefined()

    authMock.mockRejectedValueOnce(new Error('boom'))
    q<HTMLButtonElement>('.ui-btn.primary').click()
    await flushPromises()
    expect(toast.msg).toBe('发起授权失败')
  })

  it('open 翻真时重置字段', async () => {
    const w = mountDlg()
    await nextTick()
    await type('input[name="client_id"]', 'leftover')
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await nextTick()
    expect(q<HTMLInputElement>('input[name="client_id"]').value).toBe('')
    expect(q<HTMLButtonElement>('.ui-btn.primary').disabled).toBe(true)
  })
})
