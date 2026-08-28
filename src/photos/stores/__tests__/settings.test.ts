// Test doubles for the shared HTTP package. Photos v1 backend has no standard
// envelope, so `service.photos.*` already resolve to bare bodies (see
// the shared HTTP client's src/photos.ts) — mocks below mirror that.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePhotosSettingsStore } from '../settings'

vi.mock('@nimotech/nimoos-service', () => ({
  service: {
    photos: {
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      getStorage: vi.fn(),
      getAbout: vi.fn(),
      pruneCache: vi.fn(),
      rebuildIndex: vi.fn(),
      triggerScan: vi.fn(),
      reclusterFaces: vi.fn(),
    },
  },
}))
import { service } from '@nimotech/nimoos-service'
// Cross-store mock idiom follows trash.test.ts's precedent (mock the whole
// `../timeline` module rather than a real Pinia store instance). Unlike
// trash.test.ts's fire-and-forget `fetchTimeline`, rebuildIndex's 409 branch
// actually *reads* `tasks` after calling `fetchTasks()` — so the mock's
// `fetchTasks` populates `tasks` as a side effect (mirroring the real
// timeline store's fetchTasks() populating its own `tasks` ref), letting a
// mutation test that deletes the `await timeline.fetchTasks()` call catch it
// (tasks would stay empty instead of being populated).
vi.mock('../timeline', () => ({ useTimelineStore: vi.fn() }))
import { useTimelineStore } from '../timeline'

describe('photosSettings store · aiFeatures', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('missing fields default to enabled (Vue2\'s `d.xEnabled !== false` rule)', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    expect(s.aiFeatures).toEqual({ faces: true, scenes: true, ocr: true, smartview: true })
    expect(s.aiFeaturesLoaded).toBe(true)
  })

  it('only an explicit false turns it off', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({
      aiFeatures: { faces: false, scenes: true, ocr: 0, smartview: null },
    })
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    // Neither ocr: 0 nor smartview: null is an explicit false ⇒ treated as enabled
    expect(s.aiFeatures).toEqual({ faces: false, scenes: true, ocr: true, smartview: true })
  })

  it('the real backend shape (flat xxxEnabled fields, not nested under aiFeatures) must also be read correctly', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({
      watchDirs: ['/DATA/Gallery'],
      retentionDays: 30,
      facesEnabled: false,
      scenesEnabled: true,
      ocrEnabled: false,
      smartViewEnabled: true,
    })
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    expect(s.aiFeatures).toEqual({ faces: false, scenes: true, ocr: false, smartview: true })
  })

  it('fetch failure: treated as all-enabled, and aiFeaturesLoaded stays false (distinguishable from "confirmed all-off")', async () => {
    vi.mocked(service.photos.getConfig).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    expect(s.aiFeatures).toEqual({ faces: true, scenes: true, ocr: true, smartview: true })
    expect(s.aiFeaturesLoaded).toBe(false)
  })
})

// P8a-T6: the sidebar (a component shared across the whole Photos area) and each view
// now call fetchAiFeatures() in their own onMounted — the store is a singleton, so
// multiple consumers mounting within the same frame will call it concurrently. These two
// cases lock in the two required behaviors of "in-flight dedup": dedup takes effect + it
// is not a permanent cache.
describe('photosSettings store · fetchAiFeatures in-flight dedup (P8a-T6)', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('fetchAiFeatures concurrent dedup: two consumers mounting simultaneously only issue one getConfig', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
    const s = usePhotosSettingsStore()
    const [a, b] = await Promise.all([s.fetchAiFeatures(), s.fetchAiFeatures()])
    expect(service.photos.getConfig).toHaveBeenCalledTimes(1)
    // Both concurrent callers get the result of the same fetch — not a requirement that
    // they're the same return-value object identity, but the values must match.
    expect(a).toEqual(b)
  })

  it('dedup is not a permanent cache: calling again after the previous fetch has settled issues a new request', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    await s.fetchAiFeatures()
    expect(service.photos.getConfig).toHaveBeenCalledTimes(2)
  })

  it('three concurrent callers likewise only issue one request (not an implementation that happens to only work for "exactly 2")', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
    const s = usePhotosSettingsStore()
    await Promise.all([s.fetchAiFeatures(), s.fetchAiFeatures(), s.fetchAiFeatures()])
    expect(service.photos.getConfig).toHaveBeenCalledTimes(1)
  })
})

describe('photosSettings store · setAiFeature', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('save succeeds: the toggle lands on the new value', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
    vi.mocked(service.photos.updateConfig).mockResolvedValue(undefined)
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    const ok = await s.setAiFeature('faces', false)
    expect(ok).toBe(true)
    expect(s.aiFeatures.faces).toBe(false)
  })

  it('writes back the current watchDirs/retentionDays alongside (the shared package\'s updateConfig takes positional args, watchDirs is required and the backend rejects empty)', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({
      watchDirs: ['/DATA/Gallery', '/DATA/Media'],
      retentionDays: 45,
      facesEnabled: true, scenesEnabled: true, ocrEnabled: true, smartViewEnabled: true,
    })
    vi.mocked(service.photos.updateConfig).mockResolvedValue(undefined)
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    await s.setAiFeature('ocr', false)
    expect(service.photos.updateConfig).toHaveBeenCalledWith(
      ['/DATA/Gallery', '/DATA/Media'],
      45,
      true,
      { scenesEnabled: true, ocrEnabled: false, smartViewEnabled: true },
    )
  })

  it('save fails: the toggle rolls back to the last known-good value (Vue2 :274-278\'s rollback semantics)', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
    vi.mocked(service.photos.updateConfig).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    const ok = await s.setAiFeature('ocr', false)
    expect(ok).toBe(false)
    expect(s.aiFeatures.ocr).toBe(true) // rolled back
  })

  it('optimistic update: the toggle is already the new value before awaiting (UI responds immediately, does not wait on the network)', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
    let release: (() => void) | undefined
    vi.mocked(service.photos.updateConfig).mockImplementation(
      () => new Promise<void>((res) => { release = res }),
    )
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    const p = s.setAiFeature('scenes', false)
    expect(s.aiFeatures.scenes).toBe(false) // already in effect while in flight — there's still a getConfig() microtask before updateConfig is reached
    await vi.waitFor(() => { if (!release) throw new Error('updateConfig not yet called') })
    release?.()
    await p
  })
})

describe('photosSettings store · storage & about', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('fetch succeeds: storage lands, storageError is false', async () => {
    vi.mocked(service.photos.getStorage).mockResolvedValue({
      diskTotalBytes: 2e12, diskFreeBytes: 1e12, prunableBytes: 5e8,
      photosBytes: 3e11, videosBytes: 2e11, rawBytes: 1e11, cacheBytes: 1e10, aiBytes: 5e9,
    })
    const s = usePhotosSettingsStore()
    await s.fetchStorage()
    expect(s.storage?.diskTotalBytes).toBe(2e12)
    expect(s.storageError).toBe(false)
  })

  it('fetch fails: storage is set to null and storageError is true (Vue2 :387-397\'s two branches)', async () => {
    vi.mocked(service.photos.getStorage).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await s.fetchStorage()
    expect(s.storage).toBeNull()
    expect(s.storageError).toBe(true)
  })

  it('an empty response body from the backend also counts as a failure state (Vue2 :391\'s storageError = !this.storage)', async () => {
    vi.mocked(service.photos.getStorage).mockResolvedValue(null as never)
    const s = usePhotosSettingsStore()
    await s.fetchStorage()
    expect(s.storageError).toBe(true)
  })

  it('fetchAbout succeeds and lands its value', async () => {
    vi.mocked(service.photos.getAbout).mockResolvedValue({
      version: '1.2.3', deviceName: 'NAS', indexCoverage: 80,
      indexLastBuilt: '2026-08-01T00:00:00Z', librarySince: '2020-01-01T00:00:00Z',
    })
    const s = usePhotosSettingsStore()
    await s.fetchAbout()
    expect(s.about?.deviceName).toBe('NAS')
  })

  it('fetchAbout failure sets it to null', async () => {
    vi.mocked(service.photos.getAbout).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await s.fetchAbout()
    expect(s.about).toBeNull()
  })
})

describe('photosSettings store · retention & scanInterval rollback', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('setRetention failure must roll back — Vue2\'s retention watcher only pops a toast and never rolls back, which is a defect this phase fixes', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ retentionDays: 30 })
    vi.mocked(service.photos.updateConfig).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await s.fetchRetention()
    const ok = await s.setRetention(90)
    expect(ok).toBe(false)
    expect(s.retentionDays).toBe(30)
  })

  it('setScanInterval failure must roll back (Vue2 :447-457 already had a prev rollback)', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ scanInterval: 1440 })
    vi.mocked(service.photos.updateConfig).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await s.fetchScanInterval()
    const ok = await s.setScanInterval(0)
    expect(ok).toBe(false)
    expect(s.scanIntervalMinutes).toBe(1440)
  })

  it('scanInterval allows 0 (disables auto rescan) — must not be swallowed by a falsy fallback like `|| 1440`', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ scanInterval: 0 })
    const s = usePhotosSettingsStore()
    await s.fetchScanInterval()
    expect(s.scanIntervalMinutes).toBe(0)
  })

  it('setScanInterval writes scanInterval into the extra param, and passes watchDirs/retention back with their current values', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({
      watchDirs: ['/DATA/Gallery'], retentionDays: 30, scanInterval: 1440,
    })
    vi.mocked(service.photos.updateConfig).mockResolvedValue(undefined)
    const s = usePhotosSettingsStore()
    await s.setScanInterval(360)
    expect(service.photos.updateConfig).toHaveBeenCalledWith(
      ['/DATA/Gallery'], 30, undefined, { scanInterval: 360 },
    )
  })
})

describe('photosSettings store · rebuildIndex\'s 409 branch', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('the normal path returns a new taskId', async () => {
    vi.mocked(service.photos.rebuildIndex).mockResolvedValue({ taskId: 't-1' })
    const s = usePhotosSettingsStore()
    await expect(s.rebuildIndex()).resolves.toBe('t-1')
  })

  it('409 = a rebuild is already running: doesn\'t throw, calls timeline.fetchTasks() once to refresh, then returns the id of the running rebuild task (Vue2 :458-473)', async () => {
    vi.mocked(service.photos.rebuildIndex).mockRejectedValue({ response: { status: 409 } })
    // The fetchTasks mock implementation is responsible for filling tasks in with its
    // "post-refresh" shape — this asserts that rebuildIndex genuinely called
    // fetchTasks() to obtain this task, rather than reading pre-seeded static state
    // (see the file-header comment).
    const timeline = { tasks: [] as Array<{ id: string; type: string }>, fetchTasks: vi.fn() }
    timeline.fetchTasks.mockImplementation(async () => {
      timeline.tasks = [{ id: 't-running', type: 'rebuild' }]
    })
    vi.mocked(useTimelineStore).mockReturnValue(timeline as never)
    const s = usePhotosSettingsStore()
    await expect(s.rebuildIndex()).resolves.toBe('t-running')
    expect(timeline.fetchTasks).toHaveBeenCalledTimes(1)
  })

  it('409, but the refreshed task list has no rebuild-type task: returns an empty string', async () => {
    vi.mocked(service.photos.rebuildIndex).mockRejectedValue({ response: { status: 409 } })
    const timeline = { tasks: [] as Array<{ id: string; type: string }>, fetchTasks: vi.fn() }
    timeline.fetchTasks.mockImplementation(async () => {
      timeline.tasks = [{ id: 'u-1', type: 'upload' }]
    })
    vi.mocked(useTimelineStore).mockReturnValue(timeline as never)
    const s = usePhotosSettingsStore()
    await expect(s.rebuildIndex()).resolves.toBe('')
  })

  it('a non-409 error is thrown as usual', async () => {
    vi.mocked(service.photos.rebuildIndex).mockRejectedValue({ response: { status: 500 } })
    const s = usePhotosSettingsStore()
    await expect(s.rebuildIndex()).rejects.toBeTruthy()
  })
})

describe('photosSettings store · pruneCache / triggerScan / reclusterFaces', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('pruneCache returns freedBytes', async () => {
    vi.mocked(service.photos.pruneCache).mockResolvedValue({ freedBytes: 12345 })
    const s = usePhotosSettingsStore()
    await expect(s.pruneCache()).resolves.toBe(12345)
  })

  it('pruneCache treats an empty body as 0', async () => {
    vi.mocked(service.photos.pruneCache).mockResolvedValue(null as never)
    const s = usePhotosSettingsStore()
    await expect(s.pruneCache()).resolves.toBe(0)
  })

  it('pruneCache failure propagates up (the view layer is responsible for the toast, same as every other Vue2 action)', async () => {
    vi.mocked(service.photos.pruneCache).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await expect(s.pruneCache()).rejects.toBeTruthy()
  })

  it('triggerScan success returns true', async () => {
    vi.mocked(service.photos.triggerScan).mockResolvedValue(undefined)
    const s = usePhotosSettingsStore()
    await expect(s.triggerScan()).resolves.toBe(true)
  })

  it('triggerScan failure propagates up', async () => {
    vi.mocked(service.photos.triggerScan).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await expect(s.triggerScan()).rejects.toBeTruthy()
  })

  it('reclusterFaces success returns true', async () => {
    vi.mocked(service.photos.reclusterFaces).mockResolvedValue(undefined)
    const s = usePhotosSettingsStore()
    await expect(s.reclusterFaces()).resolves.toBe(true)
  })

  it('reclusterFaces failure propagates up', async () => {
    vi.mocked(service.photos.reclusterFaces).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await expect(s.reclusterFaces()).rejects.toBeTruthy()
  })
})

describe('photosSettings store · reset', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('reset restores every field to its documented default', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({
      aiFeatures: { faces: false }, retentionDays: 90, scanInterval: 0,
    })
    vi.mocked(service.photos.getStorage).mockResolvedValue({
      diskTotalBytes: 1, diskFreeBytes: 1, prunableBytes: 1,
      photosBytes: 1, videosBytes: 1, rawBytes: 1, cacheBytes: 1, aiBytes: 1,
    })
    vi.mocked(service.photos.getAbout).mockResolvedValue({
      version: '1.0.0', deviceName: 'test-nas', indexCoverage: 42,
      indexLastBuilt: '2026-01-01T00:00:00Z', librarySince: '2020-01-01T00:00:00Z',
    })
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    await s.fetchRetention()
    await s.fetchScanInterval()
    await s.fetchStorage() // storage non-null, storageError false
    await s.fetchAbout()   // about non-null (fix Minor 3: never fetched before this, so the null check was trivially true)
    // storage/storageError are set together by the same fetchStorage call in this store,
    // so there's no real call path where "storage is non-null and storageError is true"
    // both hold — writing the ref directly to a non-default value here is purely to keep
    // the storageError assertion after reset() from being trivially true (fix Minor 3), it
    // doesn't represent a real call path.
    s.storageError = true
    // Pre-reset sentinel: proves the reset() assertions below aren't vacuously starting from the default values
    expect(s.about).not.toBeNull()
    expect(s.storage).not.toBeNull()
    expect(s.storageError).toBe(true)
    s.reset()
    expect(s.aiFeatures).toEqual({ faces: true, scenes: true, ocr: true, smartview: true })
    expect(s.aiFeaturesLoaded).toBe(false)
    expect(s.retentionDays).toBe(30)
    expect(s.scanIntervalMinutes).toBe(1440)
    expect(s.storage).toBeNull()
    expect(s.storageError).toBe(false)
    expect(s.about).toBeNull()
  })
})
