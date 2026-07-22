import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const svc = vi.hoisted(() => ({
  appstore: {
    listSources: vi.fn(),
    registerSource: vi.fn(),
    unregisterSource: vi.fn(),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

// 捕获事件处理器,测试里手动触发
const busHandlers = vi.hoisted(() => new Map<string, (props: unknown) => void>())
const busOn = vi.hoisted(() =>
  vi.fn((ev: string, cb: (props: unknown) => void) => {
    busHandlers.set(ev, cb)
    return () => {}
  }),
)
vi.mock('../../composables/useMessageBus', () => ({ useMessageBus: () => ({ on: busOn }) }))

import { useSourcesStore } from './sources'
import { useAppstoreStore } from './appstore'
import { useToast } from '../../stores/toast'

const SRC = { id: 0, url: 'https://github.com/NimoTech/NimoOS-AppStore/archive/main.zip', store_root: 'NimoOS-AppStore-main' }
const THIRD = { id: 1, url: 'https://github.com/WisdomSky/CasaOS-Coolstore/archive/main.zip' }

describe('sources store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    busHandlers.clear()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('load 成功写 sources/loaded;失败置 error', async () => {
    const store = useSourcesStore()
    svc.appstore.listSources.mockResolvedValueOnce([SRC, THIRD])
    await store.load()
    expect(store.sources).toEqual([SRC, THIRD])
    expect(store.loaded).toBe(true)
    expect(store.error).toBe(false)

    svc.appstore.listSources.mockRejectedValueOnce(new Error('boom'))
    await store.load()
    expect(store.error).toBe(true)
  })

  it('register 受理:registeringUrl 置目标,service 收到 trim 后 URL', async () => {
    const store = useSourcesStore()
    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await store.register('  https://example.com/store.zip  ')
    expect(svc.appstore.registerSource).toHaveBeenCalledWith('https://example.com/store.zip')
    expect(store.registeringUrl).toBe('https://example.com/store.zip')
  })

  it('register 同步 409:抛后端 message,registeringUrl 复位', async () => {
    const store = useSourcesStore()
    svc.appstore.registerSource.mockRejectedValueOnce({
      response: { data: { message: 'appstore source already exists' } },
    })
    await expect(store.register('https://dup.example.com/s.zip')).rejects.toThrow('appstore source already exists')
    expect(store.registeringUrl).toBeNull()
  })

  it('register-end 事件收敛:清 pending + 重拉列表 + invalidate + toast', async () => {
    const store = useSourcesStore()
    const appstore = useAppstoreStore()
    const inv = vi.spyOn(appstore, 'invalidate')
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')

    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await store.register('https://example.com/store.zip')
    svc.appstore.listSources.mockResolvedValueOnce([SRC, THIRD])

    busHandlers.get('app-store:register-end')!({})
    // 断言全部同步可验:convergeRegistered 同步清 pending/调 invalidate/toast,load() 同步发起 listSources
    expect(store.registeringUrl).toBeNull()
    expect(inv).toHaveBeenCalled()
    expect(show).toHaveBeenCalled()
    expect(svc.appstore.listSources).toHaveBeenCalled()
  })

  it('register-error 事件:清 pending + toast 带后端 message,不重拉', async () => {
    const store = useSourcesStore()
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')
    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await store.register('https://bad.example.com/s.zip')

    busHandlers.get('app-store:register-error')!({ message: 'not an appstore' })
    expect(store.registeringUrl).toBeNull()
    expect(show).toHaveBeenCalledWith(expect.stringContaining('not an appstore'), expect.any(Number))
  })

  it('事件丢失兜底:15s 轮询 listSources 看到新 URL 即收敛(大小写不敏感)', async () => {
    const store = useSourcesStore()
    const appstore = useAppstoreStore()
    const inv = vi.spyOn(appstore, 'invalidate')
    svc.appstore.registerSource.mockResolvedValueOnce(undefined)
    await store.register('https://Example.com/Store.zip')

    // 第一轮:还没出现 → 仍 pending
    svc.appstore.listSources.mockResolvedValueOnce([SRC])
    await vi.advanceTimersByTimeAsync(15_000)
    expect(store.registeringUrl).not.toBeNull()

    // 第二轮:出现(后端存的小写)→ 收敛
    svc.appstore.listSources.mockResolvedValue([SRC, { id: 1, url: 'https://example.com/store.zip' }])
    await vi.advanceTimersByTimeAsync(15_000)
    expect(store.registeringUrl).toBeNull()
    expect(inv).toHaveBeenCalled()
  })

  it('unregister 成功:重拉 + invalidate;失败:toast 后端 message', async () => {
    const store = useSourcesStore()
    const appstore = useAppstoreStore()
    const inv = vi.spyOn(appstore, 'invalidate')
    const toast = useToast()
    const show = vi.spyOn(toast, 'show')

    svc.appstore.unregisterSource.mockResolvedValueOnce(undefined)
    svc.appstore.listSources.mockResolvedValueOnce([SRC])
    await store.unregister(1)
    expect(svc.appstore.unregisterSource).toHaveBeenCalledWith(1)
    expect(inv).toHaveBeenCalled()

    svc.appstore.unregisterSource.mockRejectedValueOnce({
      response: { data: { message: 'cannot unregister the last app store - need at least one app store' } },
    })
    await store.unregister(0)
    expect(show).toHaveBeenCalledWith(expect.stringContaining('cannot unregister the last app store'), expect.any(Number))
  })
})
