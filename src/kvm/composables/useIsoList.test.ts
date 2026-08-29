import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useIsoList } from './useIsoList'

const api = { getISOList: vi.fn(), downloadISO: vi.fn() }
vi.mock('@nimotech/nimoos-service', () => ({ service: { get kvm() { return api } } }))

// MessageBus mock: can manually dispatch events and assert unsubscribe calls.
const handlers: Record<string, ((props: unknown) => void)[]> = {}
const offCalls: string[] = []
// Local switch (review request; re-review requirement): defaults to true, meaning
// unsubscribe actually removes the callback from handlers — normal primary behavior.
// Only set to false in the "unsubscribe ineffective" test case, simulating "off()
// is called but callback stays in the registry" — to isolate the alive guard in the
// event handler as a depth-defense layer, without weakening other tests' coverage of
// "unsubscribe actually works". Reset to true by beforeEach after each test.
let unsubEnabled = true
vi.mock('../../composables/useMessageBus', () => ({
  useMessageBus: () => ({
    on(ev: string, cb: (p: unknown) => void) {
      ;(handlers[ev] ||= []).push(cb)
      return () => {
        offCalls.push(ev)
        if (unsubEnabled) handlers[ev] = handlers[ev].filter((h) => h !== cb)
      }
    },
  }),
}))
const fire = (ev: string, props: unknown) => (handlers[ev] || []).forEach((h) => h(props))

// Two rows from live curl fixture (alpine already downloaded with path, debian available for download without path).
const LIST = [
  { id: 'alpine-319', name: 'Alpine', version: '3.19', category: 'linux', size: '60 MB', status: 'downloaded', progress: 0, path: '/DATA/KVM/isos/alpine-319.iso', recommendedVcpu: 1, recommendedMemory: 512, minMemory: 256, minDisk: 2 },
  { id: 'debian-13', name: 'Debian', version: '13 (Trixie)', category: 'linux', size: '676 MB', status: 'available', progress: 0, recommendedVcpu: 2, recommendedMemory: 2048, minMemory: 512, minDisk: 8 },
]

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  Object.keys(handlers).forEach((k) => delete handlers[k])
  offCalls.length = 0
  unsubEnabled = true
  api.getISOList.mockResolvedValue(LIST)
  api.downloadISO.mockResolvedValue(undefined)
})

describe('useIsoList', () => {
  it('fetch maps status to _downloaded / _downloading (mirrors Vue2 :236-241)', async () => {
    const s = useIsoList(); await s.fetch()
    expect(s.isos.value[0]).toMatchObject({ id: 'alpine-319', _downloaded: true, _downloading: false })
    expect(s.isos.value[1]).toMatchObject({ id: 'debian-13', _downloaded: false, _downloading: false })
  })

  it('status=downloading inherits progress (dialog reopen must show existing progress)', async () => {
    api.getISOList.mockResolvedValue([{ ...LIST[1], status: 'downloading', progress: 42 }])
    const s = useIsoList(); await s.fetch()
    expect(s.isos.value[0]).toMatchObject({ _downloading: true, _progress: 42 })
  })

  it('download optimistically sets _downloading before sending request (body is {id}, sealed by shared package)', async () => {
    const s = useIsoList(); await s.fetch()
    const p = s.download('debian-13')
    expect(s.isos.value[1]._downloading).toBe(true)
    expect(s.isos.value[1]._progress).toBe(0)
    await p
    expect(api.downloadISO).toHaveBeenCalledWith('debian-13')
  })

  it('download request failure logs only, does not rollback _downloading (mirrors Vue2 :282-284)', async () => {
    api.downloadISO.mockRejectedValue(new Error('nope'))
    const s = useIsoList(); await s.fetch()
    await s.download('debian-13')
    expect(s.isos.value[1]._downloading).toBe(true)
  })

  it('progress event updates progress and downloaded bytes (payload in Properties, useMessageBus already unwraps)', async () => {
    const s = useIsoList(); await s.fetch()
    await s.download('debian-13')
    fire('kvm:iso_download_progress', { iso_id: 'debian-13', progress: '37.5', downloaded: '1048576' })
    expect(s.isos.value[1]._progress).toBe(37.5)
    expect(s.isos.value[1]._downloadedBytes).toBe(1048576)
  })

  it('progress event only applies to items being downloaded (mirrors Vue2 :153 _downloading guard)', async () => {
    const s = useIsoList(); await s.fetch()
    fire('kvm:iso_download_progress', { iso_id: 'debian-13', progress: '37.5' })
    expect(s.isos.value[1]._progress).toBe(0)
  })

  it('progress event ignored when iso_id missing or progress is not a number', async () => {
    const s = useIsoList(); await s.fetch()
    await s.download('debian-13')
    fire('kvm:iso_download_progress', { progress: '50' })
    fire('kvm:iso_download_progress', { iso_id: 'debian-13', progress: 'abc' })
    expect(s.isos.value[1]._progress).toBe(0)
  })

  it('complete event sets _downloaded and fires callback (view layer pops toast on this)', async () => {
    const s = useIsoList(); await s.fetch()
    const done: string[] = []
    s.onDownloadDone((row) => done.push(row.name))
    await s.download('debian-13')
    fire('kvm:iso_download_complete', { iso_id: 'debian-13' })
    expect(s.isos.value[1]).toMatchObject({ _downloading: false, _downloaded: true, _progress: 100 })
    expect(done).toEqual(['Debian'])
  })

  it('failed event clears _downloading and fires callback', async () => {
    const s = useIsoList(); await s.fetch()
    const failed: string[] = []
    s.onDownloadFailed((row) => failed.push(row.id))
    await s.download('debian-13')
    fire('kvm:iso_download_failed', { iso_id: 'debian-13' })
    expect(s.isos.value[1]._downloading).toBe(false)
    expect(failed).toEqual(['debian-13'])
  })

  it('dispose unsubscribes from three events', () => {
    const s = useIsoList(); s.dispose()
    expect(offCalls.sort()).toEqual([
      'kvm:iso_download_complete', 'kvm:iso_download_failed', 'kvm:iso_download_progress',
    ])
  })

  it('after dispose, fetch response does not write state (expiry guard; interleaved path)', async () => {
    let release: (v: unknown) => void = () => {}
    api.getISOList.mockReturnValue(new Promise((r) => { release = r }))
    const s = useIsoList()
    const p = s.fetch()
    s.dispose()
    release(LIST)
    await p
    expect(s.isos.value).toEqual([])
  })

  it('after dispose, arriving events no longer write state (primary defense: dispose() synchronously unsubscribes — this test does not exercise the alive guard in the event handler since unsubscribe takes effect first; guard itself covered by the "unsubscribe ineffective" test below)', async () => {
    const s = useIsoList(); await s.fetch()
    await s.download('debian-13')
    s.dispose()
    fire('kvm:iso_download_complete', { iso_id: 'debian-13' })
    expect(s.isos.value[1]._downloaded).toBe(false)
  })

  it('when unsubscribe ineffective, alive guard in event handler alone blocks writes (real depth-defense test)', async () => {
    const s = useIsoList(); await s.fetch()
    await s.download('debian-13')
    // Manually disable primary mechanism: off() still gets called (offCalls still recorded),
    // but does not actually remove callback from handlers — simulating "unsubscribe
    // ineffective / callback remains in registry" abnormal case. Only the event handler's
    // internal `alive` check can block the write now.
    unsubEnabled = false
    s.dispose()
    fire('kvm:iso_download_complete', { iso_id: 'debian-13' })
    expect(s.isos.value[1]._downloaded).toBe(false)
  })
})
