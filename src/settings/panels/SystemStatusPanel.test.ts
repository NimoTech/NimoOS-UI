import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SystemStatusPanel from './SystemStatusPanel.vue'

const getGatewayComponents = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { sys: { getGatewayComponents: (...a: unknown[]) => getGatewayComponents(...a) } },
}))

// i18n 用项目既有的测试桩写法(照抄 src/settings/panels/panels.test.ts 里的 global.plugins)
import { i18n } from '../../i18n'

const REAL = [
  { name: 'Gateway', category: 'service', version: '1.9.3-alpha1+28.g0dc16d6', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },
  { name: 'User Service', category: 'service', version: '', status: 'offline', error: 'unexpected status Internal Server Error', probed_at: '2026-08-01T02:15:55Z' },
  { name: 'Qdrant', category: 'external', version: '1.18.1', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },
]

const mountPanel = () => mount(SystemStatusPanel, { global: { plugins: [i18n] } })

describe('SystemStatusPanel', () => {
  beforeEach(() => { getGatewayComponents.mockReset() })

  it('挂载即取数并按组渲染', async () => {
    getGatewayComponents.mockResolvedValue(REAL)
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-comp-row')).toHaveLength(3)
    expect(w.text()).toContain('Gateway')
    expect(w.text()).toContain('Qdrant')
  })

  it('离线项显示离线态与版本占位', async () => {
    getGatewayComponents.mockResolvedValue(REAL)
    const w = mountPanel()
    await flushPromises()
    const rows = w.findAll('.set-comp-row')
    expect(rows[1].find('.set-comp-dot').classes()).toContain('is-offline')
    expect(rows[1].find('.set-comp-ver').text()).toBe('—')
    expect(rows[1].find('.set-comp-state').attributes('title'))
      .toContain('unexpected status Internal Server Error')
  })

  it('刷新按钮重新取数', async () => {
    getGatewayComponents.mockResolvedValue(REAL)
    const w = mountPanel()
    await flushPromises()
    await w.find('.set-comp-refresh').trigger('click')
    await flushPromises()
    expect(getGatewayComponents).toHaveBeenCalledTimes(2)
  })

  it('接口失败时清空并显示空态,不白屏', async () => {
    getGatewayComponents.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-comp-row')).toHaveLength(0)
    expect(w.text()).toContain('暂无数据')
  })

  // 过期守卫(约束 #2,brief 未列,评审要求就地实现 + 交错测试证明):
  // 先发起的挂载请求被挂住(deferred),期间点刷新发起第二次请求并让它先落地,
  // 随后再放行第一次的旧结果——旧结果必须被丢弃,不能覆盖新结果。
  // 若组件按「谁后落定就用谁」写(即没有代际守卫),这条会翻红:第一次的旧
  // REAL2(只有 1 条)会覆盖第二次的 REAL(3 条),行数断言会失败。
  it('旧请求晚于新请求落定时不覆盖新结果(过期守卫)', async () => {
    let resolveFirst!: (v: typeof REAL) => void
    const first = new Promise<typeof REAL>((resolve) => { resolveFirst = resolve })
    const REAL2 = [REAL[0]] // 旧结果:只有 1 条,便于跟新结果(3 条)区分

    getGatewayComponents.mockReturnValueOnce(first)
    const w = mountPanel()
    await flushPromises() // 让挂载的 onMounted/load 跑到 await 处并挂住

    // 第二次(刷新)请求先落定
    getGatewayComponents.mockResolvedValueOnce(REAL)
    await w.find('.set-comp-refresh').trigger('click')
    await flushPromises()
    expect(w.findAll('.set-comp-row')).toHaveLength(3)

    // 现在才放行第一次的旧结果
    resolveFirst(REAL2)
    await flushPromises()

    expect(w.findAll('.set-comp-row')).toHaveLength(3) // 仍是新结果,没被旧结果覆盖
    expect(w.text()).toContain('Gateway')
  })
})
