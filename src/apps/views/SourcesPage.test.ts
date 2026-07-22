import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'

const svc = vi.hoisted(() => ({
  appstore: {
    listSources: vi.fn(),
    registerSource: vi.fn(),
    unregisterSource: vi.fn(),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))
vi.mock('../../composables/useMessageBus', () => ({
  useMessageBus: () => ({ on: vi.fn(() => () => {}) }),
}))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ name: 'apps-sources', fullPath: '/apps/sources' }),
}))

import SourcesPage from './SourcesPage.vue'

const OFFICIAL = { id: 0, url: 'https://github.com/NimoTech/NimoOS-AppStore/archive/main.zip' }
const THIRD = { id: 1, url: 'https://github.com/WisdomSky/CasaOS-Coolstore/archive/main.zip' }

function mountPage() {
  const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })
  const pinia = createPinia()
  return mount(SourcesPage, { global: { plugins: [i18n, pinia] } })
}

describe('SourcesPage', () => {
  beforeEach(() => {
    localStorage.clear() // 注册中状态落盘,防上一用例的 pending 被新 pinia 恢复
    vi.clearAllMocks()
    svc.appstore.listSources.mockResolvedValue([OFFICIAL, THIRD])
  })

  it('渲染源列表:官方源带徽章无移除按钮,第三方源有移除按钮', async () => {
    const w = mountPage()
    await flushPromises()
    const items = w.findAll('.src-item')
    expect(items).toHaveLength(2)
    expect(items[0].find('.src-badge').exists()).toBe(true)
    expect(items[0].find('.src-remove').exists()).toBe(false)
    expect(items[1].find('.src-badge').exists()).toBe(false)
    expect(items[1].find('.src-remove').exists()).toBe(true)
    expect(items[1].text()).toContain('WisdomSky')
  })

  it('非 http(s) 输入:添加按钮禁用', async () => {
    const w = mountPage()
    await flushPromises()
    await w.find('.src-input').setValue('ftp://x/y.zip')
    expect((w.find('.src-add-btn').element as HTMLButtonElement).disabled).toBe(true)
    await w.find('.src-input').setValue('https://example.com/s.zip')
    expect((w.find('.src-add-btn').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('提交调 store.register(trim 后),输入清空;同步错误就地展示', async () => {
    const w = mountPage()
    await flushPromises()
    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await w.find('.src-input').setValue(' https://example.com/s.zip ')
    await w.find('form.src-add').trigger('submit')
    await flushPromises()
    expect(svc.appstore.registerSource).toHaveBeenCalledWith('https://example.com/s.zip')
    expect((w.find('.src-input').element as HTMLInputElement).value).toBe('')
    expect(w.find('.src-pending').exists()).toBe(true) // 注册中行可见
    // 注册中输入框不锁(可先备好下一个地址),只锁提交
    expect((w.find('.src-input').element as HTMLInputElement).disabled).toBe(false)
    expect((w.find('.src-add-btn').element as HTMLButtonElement).disabled).toBe(true)

    // 同步 409 就地展示(新 mount,干净 store)
    localStorage.clear() // 上面的注册已落盘,清掉防 w2 恢复 pending 撞 busy 守卫
    const w2 = mountPage()
    await flushPromises()
    svc.appstore.registerSource.mockRejectedValueOnce({ response: { data: { message: 'already exists' } } })
    await w2.find('.src-input').setValue('https://dup.example.com/s.zip')
    await w2.find('form.src-add').trigger('submit')
    await flushPromises()
    expect(w2.find('.src-form-error').text()).toContain('already exists')
  })

  it('移除:确认弹窗 confirm 后调 store.unregister(id)', async () => {
    const w = mountPage()
    await flushPromises()
    svc.appstore.unregisterSource.mockResolvedValueOnce(undefined)
    await w.find('.src-remove').trigger('click')
    // reka AlertDialog 挂 portal,直接调组件暴露的 confirm 路径:
    const dialog = w.findComponent({ name: 'AlertDialog' })
    dialog.vm.$emit('confirm')
    await flushPromises()
    expect(svc.appstore.unregisterSource).toHaveBeenCalledWith(1)
  })
})
