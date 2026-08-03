import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useIsoList } from './useIsoList'

const api = { getISOList: vi.fn(), downloadISO: vi.fn() }
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))

// MessageBus 假实现:能手动派发事件、能断言退订。
const handlers: Record<string, ((props: unknown) => void)[]> = {}
const offCalls: string[] = []
vi.mock('../../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on(ev: string, cb: (p: unknown) => void) {
      ;(handlers[ev] ||= []).push(cb)
      return () => { offCalls.push(ev); handlers[ev] = handlers[ev].filter((h) => h !== cb) }
    },
  }),
}))
const fire = (ev: string, props: unknown) => (handlers[ev] || []).forEach((h) => h(props))

// 真机 curl 的两条(alpine 已下载带 path,debian 可下载无 path)。
const LIST = [
  { id: 'alpine-319', name: 'Alpine', version: '3.19', category: 'linux', size: '60 MB', status: 'downloaded', progress: 0, path: '/DATA/KVM/isos/alpine-319.iso', recommendedVcpu: 1, recommendedMemory: 512, minMemory: 256, minDisk: 2 },
  { id: 'debian-13', name: 'Debian', version: '13 (Trixie)', category: 'linux', size: '676 MB', status: 'available', progress: 0, recommendedVcpu: 2, recommendedMemory: 2048, minMemory: 512, minDisk: 8 },
]

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  Object.keys(handlers).forEach((k) => delete handlers[k])
  offCalls.length = 0
  api.getISOList.mockResolvedValue(LIST)
  api.downloadISO.mockResolvedValue(undefined)
})

describe('useIsoList', () => {
  it('fetch 把 status 映射成 _downloaded / _downloading(照 Vue2 :236-241)', async () => {
    const s = useIsoList(); await s.fetch()
    expect(s.isos.value[0]).toMatchObject({ id: 'alpine-319', _downloaded: true, _downloading: false })
    expect(s.isos.value[1]).toMatchObject({ id: 'debian-13', _downloaded: false, _downloading: false })
  })

  it('status=downloading 时继承 progress(重开弹窗要能看到已有进度)', async () => {
    api.getISOList.mockResolvedValue([{ ...LIST[1], status: 'downloading', progress: 42 }])
    const s = useIsoList(); await s.fetch()
    expect(s.isos.value[0]).toMatchObject({ _downloading: true, _progress: 42 })
  })

  it('download 先乐观置 _downloading 再发请求(body 是 {id},共享包已封)', async () => {
    const s = useIsoList(); await s.fetch()
    const p = s.download('debian-13')
    expect(s.isos.value[1]._downloading).toBe(true)
    expect(s.isos.value[1]._progress).toBe(0)
    await p
    expect(api.downloadISO).toHaveBeenCalledWith('debian-13')
  })

  it('download 请求失败只记日志、不回滚 _downloading(照 Vue2 :282-284)', async () => {
    api.downloadISO.mockRejectedValue(new Error('nope'))
    const s = useIsoList(); await s.fetch()
    await s.download('debian-13')
    expect(s.isos.value[1]._downloading).toBe(true)
  })

  it('progress 事件更新进度与已下载字节(载荷在 Properties,useMessageBus 已剥)', async () => {
    const s = useIsoList(); await s.fetch()
    await s.download('debian-13')
    fire('kvm:iso_download_progress', { iso_id: 'debian-13', progress: '37.5', downloaded: '1048576' })
    expect(s.isos.value[1]._progress).toBe(37.5)
    expect(s.isos.value[1]._downloadedBytes).toBe(1048576)
  })

  it('progress 事件只对正在下载的条目生效(照 Vue2 :153 的 _downloading 守卫)', async () => {
    const s = useIsoList(); await s.fetch()
    fire('kvm:iso_download_progress', { iso_id: 'debian-13', progress: '37.5' })
    expect(s.isos.value[1]._progress).toBe(0)
  })

  it('progress 事件里 iso_id 缺失或 progress 不是数字时整条忽略', async () => {
    const s = useIsoList(); await s.fetch()
    await s.download('debian-13')
    fire('kvm:iso_download_progress', { progress: '50' })
    fire('kvm:iso_download_progress', { iso_id: 'debian-13', progress: 'abc' })
    expect(s.isos.value[1]._progress).toBe(0)
  })

  it('complete 事件置 _downloaded 并回调(视图层据此弹 toast)', async () => {
    const s = useIsoList(); await s.fetch()
    const done: string[] = []
    s.onDownloadDone((row) => done.push(row.name))
    await s.download('debian-13')
    fire('kvm:iso_download_complete', { iso_id: 'debian-13' })
    expect(s.isos.value[1]).toMatchObject({ _downloading: false, _downloaded: true, _progress: 100 })
    expect(done).toEqual(['Debian'])
  })

  it('failed 事件清 _downloading 并回调', async () => {
    const s = useIsoList(); await s.fetch()
    const failed: string[] = []
    s.onDownloadFailed((row) => failed.push(row.id))
    await s.download('debian-13')
    fire('kvm:iso_download_failed', { iso_id: 'debian-13' })
    expect(s.isos.value[1]._downloading).toBe(false)
    expect(failed).toEqual(['debian-13'])
  })

  it('dispose 退订三个事件', () => {
    const s = useIsoList(); s.dispose()
    expect(offCalls.sort()).toEqual([
      'kvm:iso_download_complete', 'kvm:iso_download_failed', 'kvm:iso_download_progress',
    ])
  })

  it('dispose 后 fetch 落定不写 state(过期守卫;交错路径)', async () => {
    let release: (v: unknown) => void = () => {}
    api.getISOList.mockReturnValue(new Promise((r) => { release = r }))
    const s = useIsoList()
    const p = s.fetch()
    s.dispose()
    release(LIST)
    await p
    expect(s.isos.value).toEqual([])
  })

  it('dispose 后事件到达不再写 state', async () => {
    const s = useIsoList(); await s.fetch()
    await s.download('debian-13')
    s.dispose()
    fire('kvm:iso_download_complete', { iso_id: 'debian-13' })
    expect(s.isos.value[1]._downloaded).toBe(false)
  })
})
