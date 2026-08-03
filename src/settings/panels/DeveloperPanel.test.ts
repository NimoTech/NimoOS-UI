import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import zh from '../../i18n/zh_cn'
import zhSp9 from '../../i18n/zh_cn.sp9'
import { useToast } from '../../stores/toast'

const state = { ssl: { enabled: false, port: '443', domain: 'nimoos.local', cert_type: 'auto', effective_time: '', expiration_time: '' }, setCalls: [] as unknown[], setFail: false }
vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    sys: {
      getSSLConfig: async () => ({ ...state.ssl }),
      setSSLConfig: async (c: unknown) => { state.setCalls.push(c); if (state.setFail) throw new Error('boom') },
      uploadSSLCert: async () => {},
    },
  },
}))

import DeveloperPanel from './DeveloperPanel.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: { ...zh, ...zhSp9 } } })
const mountIt = () => mount(DeveloperPanel, { global: { plugins: [i18n] } })

// 同 WebUiHttpsDialog.test.ts:交错路径守卫要用一个可控 Promise 卡住服务端读取,
// resolve 时用提前拍好的旧快照,而不是 resolve 时刻再读共享 state。
function createDeferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  setActivePinia(createPinia())
  state.ssl = { ...state.ssl, enabled: false, cert_type: 'auto' }
  state.setCalls = []; state.setFail = false
})

describe('DeveloperPanel', () => {
  it('用返回按钮而不是标题,点它 emit open-tab general(P0 行为不变)', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.set-section-title').exists()).toBe(false)
    await w.find('.set-back').trigger('click')
    expect(w.emitted('open-tab')).toEqual([['general']])
  })

  it('P0 的空态占位已拆掉', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
  })

  it('渲染 HTTPS 开关,状态来自服务端', async () => {
    state.ssl.enabled = true
    const w = mountIt(); await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })

  it('关闭时不显示配置入口行(对位 Vue2 v-if="sslEnabled")', async () => {
    const w = mountIt(); await flushPromises()
    expect(w.find('.dp-config').exists()).toBe(false)
  })

  it('开启时显示配置入口行', async () => {
    state.ssl.enabled = true
    const w = mountIt(); await flushPromises()
    expect(w.find('.dp-config').exists()).toBe(true)
  })

  it('拨开 HTTPS:下发 enabled:true 并补齐 domain/port/cert_type 兜底值', async () => {
    const w = mountIt(); await flushPromises()
    await w.find('[role="switch"]').trigger('click'); await flushPromises()
    expect(state.setCalls).toEqual([{ enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto' }])
  })

  it('服务端字段为空时用 Vue2 的兜底值(nimoos.local / 443 / auto)', async () => {
    state.ssl = { ...state.ssl, domain: '', port: '', cert_type: '' }
    const w = mountIt(); await flushPromises()
    await w.find('[role="switch"]').trigger('click'); await flushPromises()
    expect(state.setCalls[0]).toEqual({ enabled: true, domain: 'nimoos.local', port: '443', cert_type: 'auto' })
  })

  it('下发失败时开关弹回(对位 Vue2 sslEnabled = !val)', async () => {
    state.setFail = true
    const toast = useToast()
    const w = mountIt(); await flushPromises()
    await w.find('[role="switch"]').trigger('click'); await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('false')
    // 评审 fix round 2 · Important:此前只验证了开关弹回,没验证真的提示了用户。
    expect(toast.toasts).toHaveLength(1)
    expect(toast.msg).toBe(i18n.global.t('settingsSaveFailed'))
  })

  it('点配置入口打开弹窗', async () => {
    // .dp-config 作为 class 传给 SettingsRow 落在其根 wrapper(.set-row-wrap)上,
    // 不在内部可点的 <button>(.set-list-item)上 —— 点 wrapper 不会触发 click。
    // 在测试里定位到内部按钮,不改共用的 SettingsRow(brief 拍板:取前者)。
    state.ssl.enabled = true
    const w = mountIt(); await flushPromises()
    await w.find('.dp-config .set-list-item').trigger('click')
    expect(w.findComponent({ name: 'WebUiHttpsDialog' }).props('open')).toBe(true)
  })

  it('弹窗 saved 后重新拉配置(对位 Vue2 modal close → getSSLConfig)', async () => {
    state.ssl.enabled = true
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.sys, 'getSSLConfig')
    const w = mountIt(); await flushPromises()
    const before = spy.mock.calls.length
    w.findComponent({ name: 'WebUiHttpsDialog' }).vm.$emit('saved')
    await flushPromises()
    expect(spy.mock.calls.length).toBeGreaterThan(before)
  })

  // 交错路径守卫(newui-async-stale-guard):挂载时 getSSLConfig 还没返回,用户已经拨了
  // 开关(且下发成功)。迟到的加载结果(旧的 enabled:false)不能把开关弹回去 ——
  // 那会让界面撒谎,说成用户的操作没生效。
  it('挂载时加载还没返回,用户已经拨了开关且下发成功,迟到的加载结果不能把开关弹回去(交错路径守卫)', async () => {
    const staleSnapshot = { ...state.ssl } // enabled: false,挂载/操作之前拍下的旧快照
    const svc = await import('@nimotech/nimoos-service')
    const deferred = createDeferred<typeof state.ssl>()
    vi.spyOn(svc.service.sys, 'getSSLConfig').mockReturnValueOnce(deferred.promise)

    const w = mountIt()
    // 此时 onMounted 里的 load() 还卡在 deferred,用户已经点了开关(setSSLConfig 走的是
    // 另一个不受 deferred 影响的 mock,会正常 resolve):
    await w.find('[role="switch"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
    // 加载才姗姗来迟地返回(用提前拍好的旧快照,而不是当下的 state.ssl):
    deferred.resolve(staleSnapshot)
    await flushPromises()

    expect(w.find('[role="switch"]').attributes('aria-checked')).toBe('true')
  })
})
