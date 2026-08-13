import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  setStatus: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue('up to date'),
  uninstall: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: { compose: svc } }))

import { useInstalledAppsStore, mapInstalled, PENDING_TIMEOUT_MS } from './installedApps'

// Shape verified on a real device (curl GET /v2/app_management/compose)
const RAW = {
  store_info: {
    title: { en_US: 'Actual Budget' }, icon: 'https://cdn/icon.svg',
    port_map: '15006', index: '/', scheme: 'http', hostname: null,
  },
  status: 'running', update_available: true, is_uncontrolled: false,
}

describe('mapInstalled', () => {
  it('映射真机信封:title 容忍大写 en_US、webUrl 拼当前主机、旗标透传', () => {
    const a = mapInstalled('actualbudget', RAW as never, 'nas.local')
    expect(a).toEqual({
      id: 'actualbudget', title: 'Actual Budget', icon: 'https://cdn/icon.svg',
      status: 'running', updateAvailable: true, isUncontrolled: false,
      webUrl: 'http://nas.local:15006/',
    })
  })
  it('store_info 缺失(uncontrolled 残骸)不炸:title 退 id,webUrl null,status 退 unknown', () => {
    const a = mapInstalled('ghost', { status: '' } as never, 'h')
    expect(a.title).toBe('ghost')
    expect(a.webUrl).toBeNull()
    expect(a.status).toBe('unknown')
  })
})

describe('installedApps store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    svc.list.mockReset().mockResolvedValue({ b: { ...RAW }, a: { ...RAW, status: 'exited' } })
    svc.setStatus.mockClear(); svc.update.mockClear(); svc.uninstall.mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('refresh 拉列表并按 title 排序', async () => {
    const s = useInstalledAppsStore()
    await s.refresh()
    expect(s.apps.map((x) => x.id)).toEqual(['a', 'b']) // stable by id when titles are equal
    expect(s.loading).toBe(false)
  })

  it('refresh 过滤系统幕后容器(nimoos.system=true,如 AI agent / Photos ML)', async () => {
    svc.list.mockResolvedValue({
      jellyfin: { ...RAW },
      'nimoos-agent': { ...RAW, compose: { services: { main: { labels: { 'nimoos.system': 'true' } } } } },
    })
    const s = useInstalledAppsStore()
    await s.refresh()
    expect(s.apps.map((x) => x.id)).toEqual(['jellyfin']) // system containers are hidden
  })

  it('setStatus:置 pending → 受理后仍 pending(后端 go func 异步),end 事件才收敛', async () => {
    const s = useInstalledAppsStore()
    await s.refresh()
    const p = s.setStatus('a', 'start')
    expect(s.pending['a']).toBe('start')
    await p
    // POST is acceptance only: do not converge early, or the list stays stale forever if the end event is lost (buffer=1)
    expect(s.pending['a']).toBe('start')
    expect(svc.setStatus).toHaveBeenCalledWith('a', 'start')
    expect(svc.list).toHaveBeenCalledTimes(1)
    s.onAppEvent('app:start-end', { 'app:name': 'a' })
    expect(s.pending['a']).toBeUndefined()
    await vi.waitFor(() => expect(svc.list).toHaveBeenCalledTimes(2))
  })

  it('setStatus 受理后事件丢失 → 30s 兜底重拉收敛', async () => {
    const s = useInstalledAppsStore()
    await s.refresh()
    await s.setStatus('a', 'stop')
    expect(s.pending['a']).toBe('stop')
    await vi.advanceTimersByTimeAsync(PENDING_TIMEOUT_MS + 10)
    expect(s.pending['a']).toBeUndefined()
    expect(svc.list).toHaveBeenCalledTimes(2)
  })

  it('setStatus POST 失败 → 清 pending 且抛错(不留假处理中)', async () => {
    svc.setStatus.mockRejectedValueOnce(new Error('boom'))
    const s = useInstalledAppsStore()
    await s.refresh()
    await expect(s.setStatus('a', 'start')).rejects.toThrow('boom')
    expect(s.pending['a']).toBeUndefined()
  })

  it('uninstall 显式透传 deleteConfigFolder,受理后仍 pending;uninstall-end 立即 evict + 重拉', async () => {
    const s = useInstalledAppsStore()
    await s.refresh()
    await s.uninstall('a', false)
    expect(svc.uninstall).toHaveBeenCalledWith('a', { deleteConfigFolder: false })
    // Returns on acceptance: uninstall still runs in the background, "processing" state kept
    expect(s.pending['a']).toBe('uninstall')
    expect(s.apps.find((x) => x.id === 'a')).toBeDefined()
    s.onAppEvent('app:uninstall-end', { 'app:name': 'a' })
    // end event: icon disappears immediately (evict), no waiting for the refetch round-trip
    expect(s.apps.find((x) => x.id === 'a')).toBeUndefined()
    expect(s.pending['a']).toBeUndefined()
    await vi.waitFor(() => expect(svc.list).toHaveBeenCalledTimes(2))
  })

  it('onAppEvent:begin 置 pending,end 清 pending 并重拉', async () => {
    const s = useInstalledAppsStore()
    await s.refresh()
    s.onAppEvent('app:update-begin', { 'app:name': 'b' })
    expect(s.pending['b']).toBe('update')
    s.onAppEvent('app:update-end', { 'app:name': 'b' })
    expect(s.pending['b']).toBeUndefined()
    await vi.waitFor(() => expect(svc.list).toHaveBeenCalledTimes(2))
  })

  it('onAppEvent 容忍垃圾输入(非 app:* 事件名 / props 缺 app:name)', async () => {
    const s = useInstalledAppsStore()
    s.onAppEvent('docker:image:pull-progress', {})
    s.onAppEvent('app:start-begin', null)
    expect(s.pending).toEqual({})
  })

  it('pending 30s 无事件 → 兜底重拉并清 pending(MessageBus 丢消息不永久卡)', async () => {
    const s = useInstalledAppsStore()
    await s.refresh()
    s.onAppEvent('app:start-begin', { 'app:name': 'a' })
    expect(s.pending['a']).toBe('start')
    await vi.advanceTimersByTimeAsync(PENDING_TIMEOUT_MS + 10)
    expect(s.pending['a']).toBeUndefined()
    expect(svc.list).toHaveBeenCalledTimes(2)
  })

  it('evict 立即移除条目并清 pending(容器 destroy / 卸载完成)', async () => {
    const s = useInstalledAppsStore()
    await s.refresh()
    s.onAppEvent('app:uninstall-begin', { 'app:name': 'a' })
    s.evict('a')
    expect(s.apps.find((x) => x.id === 'a')).toBeUndefined()
    expect(s.pending['a']).toBeUndefined()
  })

  it('markApplying sets pending and app:apply-changes-end resolves it', async () => {
    const s = useInstalledAppsStore()
    s.markApplying('syncthing')
    expect(s.pending['syncthing']).toBe('apply-changes')
    s.onAppEvent('app:apply-changes-end', { 'app:name': 'syncthing' })
    expect(s.pending['syncthing']).toBeUndefined()
  })

  it('app:apply-changes-begin from another client also marks pending', () => {
    const s = useInstalledAppsStore()
    s.onAppEvent('app:apply-changes-begin', { 'app:name': 'jellyfin' })
    expect(s.pending['jellyfin']).toBe('apply-changes')
  })
})
