import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = { blob: undefined as unknown, getCalls: 0, setCalls: [] as unknown[] }

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => { store.getCalls++; return store.blob },
      setCustomStorage: async (_k: string, data: unknown) => {
        store.setCalls.push(data)
        // Real backend semantics: overwrite the whole blob
        store.blob = JSON.parse(JSON.stringify(data))
      },
    },
  },
}))

import {
  SYSTEM_DEFAULTS, readSystemConfig, patchSystemConfig, __resetSystemConfigQueue,
} from './systemConfig'

beforeEach(() => {
  store.blob = undefined
  store.getCalls = 0
  store.setCalls = []
  __resetSystemConfigQueue()
})

describe('readSystemConfig', () => {
  it('falls back to defaults when the server value is empty', async () => {
    store.blob = ''
    expect(await readSystemConfig()).toEqual(SYSTEM_DEFAULTS)
  })

  it('parses when the server returns a JSON string (the backend really does this)', async () => {
    store.blob = JSON.stringify({ timezone: 'Asia/Shanghai' })
    expect((await readSystemConfig()).timezone).toBe('Asia/Shanghai')
  })

  it('does not throw on bad JSON, falls back to defaults', async () => {
    store.blob = '{不是 json'
    expect(await readSystemConfig()).toEqual(SYSTEM_DEFAULTS)
  })

  it('server fields override defaults, unknown fields pass through unchanged', async () => {
    store.blob = { rss_switch: true, some_future_key: 42 }
    const c = await readSystemConfig()
    expect(c.rss_switch).toBe(true)
    expect(c.disk_standby).toBe(SYSTEM_DEFAULTS.disk_standby)
    expect(c.some_future_key).toBe(42)
  })

  it('degrades to defaults instead of throwing when the request fails (the settings page must not white-screen over this)', async () => {
    store.blob = undefined
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.users, 'getCustomStorage').mockRejectedValueOnce(new Error('boom'))
    expect(await readSystemConfig()).toEqual(SYSTEM_DEFAULTS)
  })
})

describe('patchSystemConfig serialization (discipline #3: lost-write race)', () => {
  it('concurrent patches to different fields both survive in the final result', async () => {
    store.blob = {}
    const [a, b] = await Promise.all([
      patchSystemConfig({ timezone: 'UTC' }),
      patchSystemConfig({ rss_switch: true }),
    ])
    // Whichever patch finishes last sees the merged full result
    const last = b.timezone ? b : a
    expect(last.timezone).toBe('UTC')
    expect(last.rss_switch).toBe(true)
    expect(store.blob).toMatchObject({ timezone: 'UTC', rss_switch: true })
  })

  it('each entry in the serialized queue re-reads instead of using the caller-supplied stale snapshot', async () => {
    store.blob = { timezone: 'UTC' }
    await Promise.all([
      patchSystemConfig({ rss_switch: true }),
      patchSystemConfig({ recommend_switch: false }),
    ])
    // Each of the two patches reads once (2) — no extra reads
    expect(store.getCalls).toBe(2)
    expect(store.blob).toMatchObject({ timezone: 'UTC', rss_switch: true, recommend_switch: false })
  })

  it('three toggles flipped in quick succession (simulating a fast-clicking user) lose none of them', async () => {
    store.blob = {}
    await Promise.all([
      patchSystemConfig({ rss_switch: true }),
      patchSystemConfig({ recommend_switch: false }),
      patchSystemConfig({ disk_standby: '30m' }),
    ])
    expect(store.blob).toMatchObject({ rss_switch: true, recommend_switch: false, disk_standby: '30m' })
  })

  it('one failure in the queue does not jam up subsequent patches (otherwise a single network blip would permanently break the settings page)', async () => {
    store.blob = {}
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.users, 'setCustomStorage').mockRejectedValueOnce(new Error('boom'))
    await expect(patchSystemConfig({ rss_switch: true })).rejects.toThrow('boom')
    spy.mockRestore()
    await expect(patchSystemConfig({ timezone: 'UTC' })).resolves.toMatchObject({ timezone: 'UTC' })
  })

  it('patch does not wipe out unknown fields', async () => {
    store.blob = { some_future_key: 'keep me' }
    await patchSystemConfig({ timezone: 'UTC' })
    expect(store.blob).toMatchObject({ some_future_key: 'keep me', timezone: 'UTC' })
  })
})
