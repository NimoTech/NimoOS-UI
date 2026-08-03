import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = { blob: undefined as unknown, getCalls: 0, setCalls: [] as unknown[] }

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    users: {
      getCustomStorage: async () => { store.getCalls++; return store.blob },
      setCustomStorage: async (_k: string, data: unknown) => {
        store.setCalls.push(data)
        // 真实后端语义:整块覆写
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
  it('服务端空值时给默认值', async () => {
    store.blob = ''
    expect(await readSystemConfig()).toEqual(SYSTEM_DEFAULTS)
  })

  it('服务端返回 JSON 字符串也能解(后端确实会这样返)', async () => {
    store.blob = JSON.stringify({ timezone: 'Asia/Shanghai' })
    expect((await readSystemConfig()).timezone).toBe('Asia/Shanghai')
  })

  it('坏 JSON 不抛,退回默认值', async () => {
    store.blob = '{不是 json'
    expect(await readSystemConfig()).toEqual(SYSTEM_DEFAULTS)
  })

  it('服务端字段覆盖默认值,未知字段原样保留', async () => {
    store.blob = { rss_switch: true, some_future_key: 42 }
    const c = await readSystemConfig()
    expect(c.rss_switch).toBe(true)
    expect(c.disk_standby).toBe(SYSTEM_DEFAULTS.disk_standby)
    expect(c.some_future_key).toBe(42)
  })

  it('请求失败时降级到默认值而不是抛(设置页不能因此白屏)', async () => {
    store.blob = undefined
    const svc = await import('@nimotech/nimoos-service')
    vi.spyOn(svc.service.users, 'getCustomStorage').mockRejectedValueOnce(new Error('boom'))
    expect(await readSystemConfig()).toEqual(SYSTEM_DEFAULTS)
  })
})

describe('patchSystemConfig 串行性(纪律 #3:丢写竞态)', () => {
  it('并发 patch 不同字段,两个都留在最终结果里', async () => {
    store.blob = {}
    const [a, b] = await Promise.all([
      patchSystemConfig({ timezone: 'UTC' }),
      patchSystemConfig({ rss_switch: true }),
    ])
    // 后完成的那次看到的是合并后的全量
    const last = b.timezone ? b : a
    expect(last.timezone).toBe('UTC')
    expect(last.rss_switch).toBe(true)
    expect(store.blob).toMatchObject({ timezone: 'UTC', rss_switch: true })
  })

  it('串行队列内每次都重新读,不用调用方传进来的旧快照', async () => {
    store.blob = { timezone: 'UTC' }
    await Promise.all([
      patchSystemConfig({ rss_switch: true }),
      patchSystemConfig({ recommend_switch: false }),
    ])
    // 两次 patch 各读一次(2)+ 无额外读
    expect(store.getCalls).toBe(2)
    expect(store.blob).toMatchObject({ timezone: 'UTC', rss_switch: true, recommend_switch: false })
  })

  it('三个开关连点(模拟用户快速拨)不丢任何一个', async () => {
    store.blob = {}
    await Promise.all([
      patchSystemConfig({ rss_switch: true }),
      patchSystemConfig({ recommend_switch: false }),
      patchSystemConfig({ disk_standby: '30m' }),
    ])
    expect(store.blob).toMatchObject({ rss_switch: true, recommend_switch: false, disk_standby: '30m' })
  })

  it('队列中一次失败不卡死后续(否则一次网络抖动会让设置页永久失灵)', async () => {
    store.blob = {}
    const svc = await import('@nimotech/nimoos-service')
    const spy = vi.spyOn(svc.service.users, 'setCustomStorage').mockRejectedValueOnce(new Error('boom'))
    await expect(patchSystemConfig({ rss_switch: true })).rejects.toThrow('boom')
    spy.mockRestore()
    await expect(patchSystemConfig({ timezone: 'UTC' })).resolves.toMatchObject({ timezone: 'UTC' })
  })

  it('patch 不会把未知字段洗掉', async () => {
    store.blob = { some_future_key: 'keep me' }
    await patchSystemConfig({ timezone: 'UTC' })
    expect(store.blob).toMatchObject({ some_future_key: 'keep me', timezone: 'UTC' })
  })
})
