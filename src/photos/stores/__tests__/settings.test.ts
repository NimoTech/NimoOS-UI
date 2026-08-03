// Test doubles for the shared HTTP package. Photos v1 backend has no standard
// envelope, so `service.photos.*` already resolve to bare bodies (see
// ../../../../../NimoOS-Service/src/photos.ts) — mocks below mirror that.
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

describe('photosSettings store · aiFeatures', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('缺字段一律按开启(Vue2 `d.xEnabled !== false` 口径)', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    expect(s.aiFeatures).toEqual({ faces: true, scenes: true, ocr: true, smartview: true })
    expect(s.aiFeaturesLoaded).toBe(true)
  })

  it('只有显式 false 才关', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({
      aiFeatures: { faces: false, scenes: true, ocr: 0, smartview: null },
    })
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    // ocr: 0 与 smartview: null 都不是显式 false ⇒ 按开启
    expect(s.aiFeatures).toEqual({ faces: false, scenes: true, ocr: true, smartview: true })
  })

  it('真实后端形状(扁平 xxxEnabled 字段,非 aiFeatures 嵌套)也要读对', async () => {
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

  it('取数失败:按全开处理,且 aiFeaturesLoaded 保持 false(可与「确认全关」区分)', async () => {
    vi.mocked(service.photos.getConfig).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    expect(s.aiFeatures).toEqual({ faces: true, scenes: true, ocr: true, smartview: true })
    expect(s.aiFeaturesLoaded).toBe(false)
  })
})

describe('photosSettings store · setAiFeature', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('保存成功:开关落到新值', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
    vi.mocked(service.photos.updateConfig).mockResolvedValue(undefined)
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    const ok = await s.setAiFeature('faces', false)
    expect(ok).toBe(true)
    expect(s.aiFeatures.faces).toBe(false)
  })

  it('写回时把当前 watchDirs/retentionDays 随同回传(共享包 updateConfig 是位置参数,watchDirs 必填且后端非空校验)', async () => {
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

  it('保存失败:开关回滚到上一个已知好值(Vue2 :274-278 的回滚语义)', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
    vi.mocked(service.photos.updateConfig).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    const ok = await s.setAiFeature('ocr', false)
    expect(ok).toBe(false)
    expect(s.aiFeatures.ocr).toBe(true) // 回滚
  })

  it('乐观更新:await 之前开关已是新值(UI 立即响应,不等网络)', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
    let release: (() => void) | undefined
    vi.mocked(service.photos.updateConfig).mockImplementation(
      () => new Promise<void>((res) => { release = res }),
    )
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    const p = s.setAiFeature('scenes', false)
    expect(s.aiFeatures.scenes).toBe(false) // 在途已生效,写回前还有一次 getConfig() 微任务才到 updateConfig
    await vi.waitFor(() => { if (!release) throw new Error('updateConfig not yet called') })
    release?.()
    await p
  })
})

describe('photosSettings store · storage & about', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('取数成功:storage 落值、storageError 假', async () => {
    vi.mocked(service.photos.getStorage).mockResolvedValue({
      diskTotalBytes: 2e12, diskFreeBytes: 1e12, prunableBytes: 5e8,
      photosBytes: 3e11, videosBytes: 2e11, rawBytes: 1e11, cacheBytes: 1e10, aiBytes: 5e9,
    })
    const s = usePhotosSettingsStore()
    await s.fetchStorage()
    expect(s.storage?.diskTotalBytes).toBe(2e12)
    expect(s.storageError).toBe(false)
  })

  it('取数失败:storage 置 null 且 storageError 为真(Vue2 :387-397 的两分支)', async () => {
    vi.mocked(service.photos.getStorage).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await s.fetchStorage()
    expect(s.storage).toBeNull()
    expect(s.storageError).toBe(true)
  })

  it('后端返空体也算失败态(Vue2 :391 的 storageError = !this.storage)', async () => {
    vi.mocked(service.photos.getStorage).mockResolvedValue(null as never)
    const s = usePhotosSettingsStore()
    await s.fetchStorage()
    expect(s.storageError).toBe(true)
  })

  it('fetchAbout 成功落值', async () => {
    vi.mocked(service.photos.getAbout).mockResolvedValue({
      version: '1.2.3', deviceName: 'NAS', indexCoverage: 80,
      indexLastBuilt: '2026-08-01T00:00:00Z', librarySince: '2020-01-01T00:00:00Z',
    })
    const s = usePhotosSettingsStore()
    await s.fetchAbout()
    expect(s.about?.deviceName).toBe('NAS')
  })

  it('fetchAbout 失败置 null', async () => {
    vi.mocked(service.photos.getAbout).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await s.fetchAbout()
    expect(s.about).toBeNull()
  })
})

describe('photosSettings store · retention & scanInterval 回滚', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('setRetention 失败要回滚 —— Vue2 的 retention watcher 只弹 toast 不回滚,是缺陷,本期改正', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ retentionDays: 30 })
    vi.mocked(service.photos.updateConfig).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await s.fetchRetention()
    const ok = await s.setRetention(90)
    expect(ok).toBe(false)
    expect(s.retentionDays).toBe(30)
  })

  it('setScanInterval 失败要回滚(Vue2 :447-457 本就有 prev 回滚)', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ scanInterval: 1440 })
    vi.mocked(service.photos.updateConfig).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await s.fetchScanInterval()
    const ok = await s.setScanInterval(0)
    expect(ok).toBe(false)
    expect(s.scanIntervalMinutes).toBe(1440)
  })

  it('scanInterval 允许 0(关闭自动重扫)—— 不能被 `|| 1440` 之类的假值兜底吃掉', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({ scanInterval: 0 })
    const s = usePhotosSettingsStore()
    await s.fetchScanInterval()
    expect(s.scanIntervalMinutes).toBe(0)
  })

  it('setScanInterval 写回时把 scanInterval 放进 extra 参数,watchDirs/retention 用当前值回传', async () => {
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

describe('photosSettings store · rebuildIndex 的 409 分支', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('正常路径返回新 taskId', async () => {
    vi.mocked(service.photos.rebuildIndex).mockResolvedValue({ taskId: 't-1' })
    const s = usePhotosSettingsStore()
    await expect(s.rebuildIndex()).resolves.toBe('t-1')
  })

  it('409 = 已有重建在跑:不抛错,返回运行中那条 rebuild 任务的 id(Vue2 :464-468)', async () => {
    vi.mocked(service.photos.rebuildIndex).mockRejectedValue({ response: { status: 409 } })
    const s = usePhotosSettingsStore()
    // 运行中的任务由 timeline store 的 tasks 提供;store 接受一个查找回调避免跨 store 硬依赖
    await expect(s.rebuildIndex(() => 't-running')).resolves.toBe('t-running')
  })

  it('非 409 错误照常抛出', async () => {
    vi.mocked(service.photos.rebuildIndex).mockRejectedValue({ response: { status: 500 } })
    const s = usePhotosSettingsStore()
    await expect(s.rebuildIndex()).rejects.toBeTruthy()
  })
})

describe('photosSettings store · pruneCache / triggerScan / reclusterFaces', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('pruneCache 返回 freedBytes', async () => {
    vi.mocked(service.photos.pruneCache).mockResolvedValue({ freedBytes: 12345 })
    const s = usePhotosSettingsStore()
    await expect(s.pruneCache()).resolves.toBe(12345)
  })

  it('pruneCache 空体按 0 处理', async () => {
    vi.mocked(service.photos.pruneCache).mockResolvedValue(null as never)
    const s = usePhotosSettingsStore()
    await expect(s.pruneCache()).resolves.toBe(0)
  })

  it('pruneCache 失败向上抛(视图层负责 toast,同 Vue2 各动作)', async () => {
    vi.mocked(service.photos.pruneCache).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await expect(s.pruneCache()).rejects.toBeTruthy()
  })

  it('triggerScan 成功返回 true', async () => {
    vi.mocked(service.photos.triggerScan).mockResolvedValue(undefined)
    const s = usePhotosSettingsStore()
    await expect(s.triggerScan()).resolves.toBe(true)
  })

  it('triggerScan 失败向上抛', async () => {
    vi.mocked(service.photos.triggerScan).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await expect(s.triggerScan()).rejects.toBeTruthy()
  })

  it('reclusterFaces 成功返回 true', async () => {
    vi.mocked(service.photos.reclusterFaces).mockResolvedValue(undefined)
    const s = usePhotosSettingsStore()
    await expect(s.reclusterFaces()).resolves.toBe(true)
  })

  it('reclusterFaces 失败向上抛', async () => {
    vi.mocked(service.photos.reclusterFaces).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await expect(s.reclusterFaces()).rejects.toBeTruthy()
  })
})

describe('photosSettings store · reset', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('reset 恢复所有字段到文档默认值', async () => {
    vi.mocked(service.photos.getConfig).mockResolvedValue({
      aiFeatures: { faces: false }, retentionDays: 90, scanInterval: 0,
    })
    vi.mocked(service.photos.getStorage).mockResolvedValue({
      diskTotalBytes: 1, diskFreeBytes: 1, prunableBytes: 1,
      photosBytes: 1, videosBytes: 1, rawBytes: 1, cacheBytes: 1, aiBytes: 1,
    })
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    await s.fetchRetention()
    await s.fetchScanInterval()
    await s.fetchStorage()
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
