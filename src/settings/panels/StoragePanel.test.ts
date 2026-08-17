import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import StoragePanel from './StoragePanel.vue'
import { i18n } from '../../i18n'

const list = vi.fn()
vi.mock('@nimotech/nimoos-service', () => ({
  service: { storage: { list: (...a: unknown[]) => list(...a) }, raid: { list: () => Promise.resolve([]) } },
}))
const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

// Real-device fixture (2026-08-01 curl GET /v1/storage?system=show, verbatim)
const RAW = [{
  disk_name: 'System', size: 512110190592, path: '/dev/nvme0n1', type: 'nvme',
  children: [{
    uuid: 'da0e4da3-4a51-4655-8d89-d0f761d08c0a', mount_point: '/', size: '512110190592',
    avail: '333092294144', used: '179017896448', type: 'ext4', path: '/dev/nvme0n1p7',
    drive_name: 'nvme0n1p7', label: 'NimoOS-HD', persisted_in: 'none',
  }],
}]

const mountPanel = () => mount(StoragePanel, { global: { plugins: [i18n] } })

describe('StoragePanel (entry card)', () => {
  beforeEach(() => { list.mockReset(); push.mockReset(); list.mockResolvedValue(RAW) })

  it('renders the capacity overview: total and available amounts use the real values', async () => {
    const w = mountPanel()
    await flushPromises()
    // 512110190592 B → renderSize actually outputs 476.94 GB (the 476.95 GB the brief
    // wrote is a rounding discrepancy; the assertion was changed to match renderSize's
    // actual output, renderSize itself was not changed).
    // 333092294144 B → 310.22 GB (matches the brief).
    expect(w.text()).toContain('476.94 GB')
    expect(w.text()).toContain('310.22 GB')
  })

  it('system-disk usage is split into "system" and "files" segments by an 8% heuristic; the two segments\' widths never add up to more than 100%', async () => {
    const w = mountPanel()
    await flushPromises()
    // Discriminating power: size*0.08 (40968815247.36) < usedSize (179017896448), so os
    // hits min()'s first branch and osPct is always exactly 8% — if the formula were
    // broken (e.g. mistakenly using usedSize instead of size*0.08, or min/max swapped),
    // os would no longer be 8 and this assertion would go red.
    const os = parseFloat((w.find('.set-store-seg-os').attributes('style') || '').replace(/\D+([\d.]+).*/, '$1'))
    const data = parseFloat((w.find('.set-store-seg-data').attributes('style') || '').replace(/\D+([\d.]+).*/, '$1'))
    expect(os).toBeCloseTo(8, 1)
    expect(os + data).toBeLessThanOrEqual(100)
  })

  it('clicking the entry card navigates to /storage', async () => {
    const w = mountPanel()
    await flushPromises()
    await w.find('.set-store-entry').trigger('click')
    expect(push).toHaveBeenCalledWith('/storage')
  })

  // Reviewer Important #3: while the fetch is in flight, it must not fall through to
  // the v-else branch and render the overview card — that would show a bogus reading
  // (0 bytes available + an empty progress bar), not a neutral empty state. This test
  // pins that down with a manually-resolved pending promise: renders the skeleton
  // before it settles, and only renders the real overview after it settles.
  it('renders the loading skeleton while the fetch is in flight, not a fake 0-value reading; renders the real overview only after it settles', async () => {
    let resolve!: (v: typeof RAW) => void
    const pending = new Promise<typeof RAW>((res) => { resolve = res })
    list.mockReturnValueOnce(pending)
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(true)
    expect(w.find('.set-store-overview').exists()).toBe(false)

    resolve(RAW)
    await flushPromises()
    expect(w.find('.set-skeleton').exists()).toBe(false)
    expect(w.find('.set-store-overview').exists()).toBe(true)
    expect(w.text()).toContain('476.94 GB')
  })

  it('still renders the entry card when the API fails (the overview shows an empty state)', async () => {
    list.mockRejectedValue(new Error('boom'))
    const w = mountPanel()
    await flushPromises()
    expect(w.find('.set-store-entry').exists()).toBe(true)
    expect(w.text()).toContain('未找到存储')
  })

  // No interleaved test for the "stale guard": tried it (mount → unmount → the pending
  // request only resolves at that point) — under jsdom, even with the alive guard in
  // the component ripped out entirely, this case would still stay green. Once a
  // component is unmounted, Vue's reactive side effects have already stopped, so
  // writing back to a ref nobody reads anymore neither throws nor produces any
  // observable difference — the assertion can't go red, making it a no-op test case.
  // The guard code itself is kept (see the comment on the alive line in
  // StoragePanel.vue: it guards against "the component gets unmounted while a request
  // is in flight, and the late result writes back into an already-unmounted
  // component's ref"), but no test case is forced in just to have one that can't
  // actually catch anything.
})
