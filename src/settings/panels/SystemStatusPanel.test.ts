import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SystemStatusPanel from './SystemStatusPanel.vue'

const getGatewayComponents = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { sys: { getGatewayComponents: (...a: unknown[]) => getGatewayComponents(...a) } },
}))

// i18n uses the project's existing test-stub pattern (copied from global.plugins in src/settings/panels/panels.test.ts)
import { i18n } from '../../i18n'

const REAL = [
  { name: 'Gateway', category: 'service', version: '1.9.3-alpha1+28.g0dc16d6', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },
  { name: 'User Service', category: 'service', version: '', status: 'offline', error: 'unexpected status Internal Server Error', probed_at: '2026-08-01T02:15:55Z' },
  { name: 'Qdrant', category: 'external', version: '1.18.1', status: 'online', error: '', probed_at: '2026-08-01T02:15:55Z' },
]

const mountPanel = () => mount(SystemStatusPanel, { global: { plugins: [i18n] } })

describe('SystemStatusPanel', () => {
  beforeEach(() => { getGatewayComponents.mockReset() })

  it('fetches data on mount and renders grouped by category', async () => {
    getGatewayComponents.mockResolvedValue(REAL)
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-comp-row')).toHaveLength(3)
    expect(w.text()).toContain('Gateway')
    expect(w.text()).toContain('Qdrant')
  })

  it('offline items show the offline state and a version placeholder', async () => {
    getGatewayComponents.mockResolvedValue(REAL)
    const w = mountPanel()
    await flushPromises()
    const rows = w.findAll('.set-comp-row')
    expect(rows[1].find('.set-comp-dot').classes()).toContain('is-offline')
    expect(rows[1].find('.set-comp-ver').text()).toBe('—')
    expect(rows[1].find('.set-comp-state').attributes('title'))
      .toContain('unexpected status Internal Server Error')
  })

  it('the refresh button refetches the data', async () => {
    getGatewayComponents.mockResolvedValue(REAL)
    const w = mountPanel()
    await flushPromises()
    await w.find('.set-comp-refresh').trigger('click')
    await flushPromises()
    expect(getGatewayComponents).toHaveBeenCalledTimes(2)
  })

  it('clears and shows the empty state when the API fails, without a blank screen', async () => {
    getGatewayComponents.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flushPromises()
    expect(w.findAll('.set-comp-row')).toHaveLength(0)
    expect(w.text()).toContain('暂无数据')
  })

  // Stale-response guard (constraint #2, not listed in the brief, review required an
  // in-place implementation plus an interleaved test to prove it):
  // the initial mount request is suspended (deferred); while it hangs, clicking refresh
  // fires a second request and lets it land first; only afterward is the first, stale
  // result released -- the stale result must be discarded and must not overwrite the
  // fresh result.
  // If the component were written as "whichever resolves last wins" (i.e. with no
  // generation guard), this test would fail: the stale first REAL2 (only 1 item) would
  // overwrite the second REAL (3 items), and the row-count assertion would fail.
  it('a stale request that resolves after the fresh one does not overwrite the fresh result (stale-response guard)', async () => {
    let resolveFirst!: (v: typeof REAL) => void
    const first = new Promise<typeof REAL>((resolve) => { resolveFirst = resolve })
    const REAL2 = [REAL[0]] // stale result: only 1 item, to make it easy to distinguish from the fresh result (3 items)

    getGatewayComponents.mockReturnValueOnce(first)
    const w = mountPanel()
    await flushPromises() // let the mounted onMounted/load run to its await and hang there

    // the second (refresh) request resolves first
    getGatewayComponents.mockResolvedValueOnce(REAL)
    await w.find('.set-comp-refresh').trigger('click')
    await flushPromises()
    expect(w.findAll('.set-comp-row')).toHaveLength(3)

    // only now release the first, stale result
    resolveFirst(REAL2)
    await flushPromises()

    expect(w.findAll('.set-comp-row')).toHaveLength(3) // still the fresh result, not overwritten by the stale one
    expect(w.text()).toContain('Gateway')
  })
})
