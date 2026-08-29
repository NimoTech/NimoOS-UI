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
  it('after mount fetch and display logs; after unmount stop polling', async () => {
    const w = mount(LogsPane, { props: { appId: 'a1' }, global: { plugins: [i18n] } })
    await flushPromises()
    expect(logsMock).toHaveBeenCalledWith('a1', { lines: 1000 })
    expect(w.find('[data-test="logs-pre"]').text()).toBe('line1\nline2')
    w.unmount()
    logsMock.mockClear()
    await vi.advanceTimersByTimeAsync(10000)
    expect(logsMock).not.toHaveBeenCalled()
  })

  it('manual refresh button triggers fetch again', async () => {
    const w = mount(LogsPane, { props: { appId: 'a1' }, global: { plugins: [i18n] } })
    await flushPromises()
    logsMock.mockClear()
    await w.find('[data-test="logs-refresh"]').trigger('click')
    await flushPromises()
    expect(logsMock).toHaveBeenCalledTimes(1)
  })

  it('show empty state copy when no logs', async () => {
    logsMock.mockResolvedValue('')
    const w = mount(LogsPane, { props: { appId: 'a1' }, global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('[data-test="logs-pre"]').text()).toBe('暂无日志')
  })

  it('logs rendered as plain text — HTML not interpreted (Vue2 v-html hazard regression lock)', async () => {
    logsMock.mockResolvedValue('<img src=x onerror=alert(1)>')
    const w = mount(LogsPane, { props: { appId: 'a' }, global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).toContain('<img src=x onerror=alert(1)>')
  })
})
