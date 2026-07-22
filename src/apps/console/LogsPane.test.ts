import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import zh from '../../i18n/zh_cn'

const { logsMock } = vi.hoisted(() => ({ logsMock: vi.fn() }))
vi.mock('@nimotech/nimoos-service', () => ({ service: { compose: { logs: logsMock } } }))
import LogsPane from './LogsPane.vue'

const i18n = createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn: zh } })

beforeEach(() => {
  vi.useFakeTimers()
  logsMock.mockReset().mockResolvedValue('line1\nline2')
})
afterEach(() => vi.useRealTimers())

describe('LogsPane', () => {
  it('挂载后拉日志展示;卸载停止轮询', async () => {
    const w = mount(LogsPane, { props: { appId: 'a1' }, global: { plugins: [i18n] } })
    await flushPromises()
    expect(logsMock).toHaveBeenCalledWith('a1', { lines: 1000 })
    expect(w.find('[data-test="logs-pre"]').text()).toBe('line1\nline2')
    w.unmount()
    logsMock.mockClear()
    await vi.advanceTimersByTimeAsync(10000)
    expect(logsMock).not.toHaveBeenCalled()
  })

  it('手动刷新按钮触发再拉', async () => {
    const w = mount(LogsPane, { props: { appId: 'a1' }, global: { plugins: [i18n] } })
    await flushPromises()
    logsMock.mockClear()
    await w.find('[data-test="logs-refresh"]').trigger('click')
    await flushPromises()
    expect(logsMock).toHaveBeenCalledTimes(1)
  })

  it('无日志时显示空态文案', async () => {
    logsMock.mockResolvedValue('')
    const w = mount(LogsPane, { props: { appId: 'a1' }, global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('[data-test="logs-pre"]').text()).toBe('暂无日志')
  })

  it('日志按纯文本渲染 —— HTML 不被解释(Vue2 v-html 隐患的回归锁)', async () => {
    logsMock.mockResolvedValue('<img src=x onerror=alert(1)>')
    const w = mount(LogsPane, { props: { appId: 'a' }, global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).toContain('<img src=x onerror=alert(1)>')
  })
})
