# Review package — Task 1 (a6e0493..df9cc07)

## Commits
df9cc07 feat(photos): photosSettings store(P8a-T1)

## Stat
 src/photos/stores/__tests__/settings.test.ts | 312 +++++++++++++++++++++++++++
 src/photos/stores/settings.ts                | 267 +++++++++++++++++++++++
 2 files changed, 579 insertions(+)

## Diff (-U10)
```diff
diff --git a/src/photos/stores/__tests__/settings.test.ts b/src/photos/stores/__tests__/settings.test.ts
new file mode 100644
index 0000000..1166f0b
--- /dev/null
+++ b/src/photos/stores/__tests__/settings.test.ts
@@ -0,0 +1,312 @@
+// Test doubles for the shared HTTP package. Photos v1 backend has no standard
+// envelope, so `service.photos.*` already resolve to bare bodies (see
+// ../../../../../NimoOS-Service/src/photos.ts) — mocks below mirror that.
+import { describe, it, expect, vi, beforeEach } from 'vitest'
+import { setActivePinia, createPinia } from 'pinia'
+import { usePhotosSettingsStore } from '../settings'
+
+vi.mock('@nimotech/nimoos-service', () => ({
+  service: {
+    photos: {
+      getConfig: vi.fn(),
+      updateConfig: vi.fn(),
+      getStorage: vi.fn(),
+      getAbout: vi.fn(),
+      pruneCache: vi.fn(),
+      rebuildIndex: vi.fn(),
+      triggerScan: vi.fn(),
+      reclusterFaces: vi.fn(),
+    },
+  },
+}))
+import { service } from '@nimotech/nimoos-service'
+
+describe('photosSettings store · aiFeatures', () => {
+  beforeEach(() => {
+    setActivePinia(createPinia())
+    vi.clearAllMocks()
+  })
+
+  it('缺字段一律按开启(Vue2 `d.xEnabled !== false` 口径)', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    expect(s.aiFeatures).toEqual({ faces: true, scenes: true, ocr: true, smartview: true })
+    expect(s.aiFeaturesLoaded).toBe(true)
+  })
+
+  it('只有显式 false 才关', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({
+      aiFeatures: { faces: false, scenes: true, ocr: 0, smartview: null },
+    })
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    // ocr: 0 与 smartview: null 都不是显式 false ⇒ 按开启
+    expect(s.aiFeatures).toEqual({ faces: false, scenes: true, ocr: true, smartview: true })
+  })
+
+  it('真实后端形状(扁平 xxxEnabled 字段,非 aiFeatures 嵌套)也要读对', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({
+      watchDirs: ['/DATA/Gallery'],
+      retentionDays: 30,
+      facesEnabled: false,
+      scenesEnabled: true,
+      ocrEnabled: false,
+      smartViewEnabled: true,
+    })
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    expect(s.aiFeatures).toEqual({ faces: false, scenes: true, ocr: false, smartview: true })
+  })
+
+  it('取数失败:按全开处理,且 aiFeaturesLoaded 保持 false(可与「确认全关」区分)', async () => {
+    vi.mocked(service.photos.getConfig).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    expect(s.aiFeatures).toEqual({ faces: true, scenes: true, ocr: true, smartview: true })
+    expect(s.aiFeaturesLoaded).toBe(false)
+  })
+})
+
+describe('photosSettings store · setAiFeature', () => {
+  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
+
+  it('保存成功:开关落到新值', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
+    vi.mocked(service.photos.updateConfig).mockResolvedValue(undefined)
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    const ok = await s.setAiFeature('faces', false)
+    expect(ok).toBe(true)
+    expect(s.aiFeatures.faces).toBe(false)
+  })
+
+  it('写回时把当前 watchDirs/retentionDays 随同回传(共享包 updateConfig 是位置参数,watchDirs 必填且后端非空校验)', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({
+      watchDirs: ['/DATA/Gallery', '/DATA/Media'],
+      retentionDays: 45,
+      facesEnabled: true, scenesEnabled: true, ocrEnabled: true, smartViewEnabled: true,
+    })
+    vi.mocked(service.photos.updateConfig).mockResolvedValue(undefined)
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    await s.setAiFeature('ocr', false)
+    expect(service.photos.updateConfig).toHaveBeenCalledWith(
+      ['/DATA/Gallery', '/DATA/Media'],
+      45,
+      true,
+      { scenesEnabled: true, ocrEnabled: false, smartViewEnabled: true },
+    )
+  })
+
+  it('保存失败:开关回滚到上一个已知好值(Vue2 :274-278 的回滚语义)', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
+    vi.mocked(service.photos.updateConfig).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    const ok = await s.setAiFeature('ocr', false)
+    expect(ok).toBe(false)
+    expect(s.aiFeatures.ocr).toBe(true) // 回滚
+  })
+
+  it('乐观更新:await 之前开关已是新值(UI 立即响应,不等网络)', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ aiFeatures: {} })
+    let release: (() => void) | undefined
+    vi.mocked(service.photos.updateConfig).mockImplementation(
+      () => new Promise<void>((res) => { release = res }),
+    )
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    const p = s.setAiFeature('scenes', false)
+    expect(s.aiFeatures.scenes).toBe(false) // 在途已生效,写回前还有一次 getConfig() 微任务才到 updateConfig
+    await vi.waitFor(() => { if (!release) throw new Error('updateConfig not yet called') })
+    release?.()
+    await p
+  })
+})
+
+describe('photosSettings store · storage & about', () => {
+  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
+
+  it('取数成功:storage 落值、storageError 假', async () => {
+    vi.mocked(service.photos.getStorage).mockResolvedValue({
+      diskTotalBytes: 2e12, diskFreeBytes: 1e12, prunableBytes: 5e8,
+      photosBytes: 3e11, videosBytes: 2e11, rawBytes: 1e11, cacheBytes: 1e10, aiBytes: 5e9,
+    })
+    const s = usePhotosSettingsStore()
+    await s.fetchStorage()
+    expect(s.storage?.diskTotalBytes).toBe(2e12)
+    expect(s.storageError).toBe(false)
+  })
+
+  it('取数失败:storage 置 null 且 storageError 为真(Vue2 :387-397 的两分支)', async () => {
+    vi.mocked(service.photos.getStorage).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await s.fetchStorage()
+    expect(s.storage).toBeNull()
+    expect(s.storageError).toBe(true)
+  })
+
+  it('后端返空体也算失败态(Vue2 :391 的 storageError = !this.storage)', async () => {
+    vi.mocked(service.photos.getStorage).mockResolvedValue(null as never)
+    const s = usePhotosSettingsStore()
+    await s.fetchStorage()
+    expect(s.storageError).toBe(true)
+  })
+
+  it('fetchAbout 成功落值', async () => {
+    vi.mocked(service.photos.getAbout).mockResolvedValue({
+      version: '1.2.3', deviceName: 'NAS', indexCoverage: 80,
+      indexLastBuilt: '2026-08-01T00:00:00Z', librarySince: '2020-01-01T00:00:00Z',
+    })
+    const s = usePhotosSettingsStore()
+    await s.fetchAbout()
+    expect(s.about?.deviceName).toBe('NAS')
+  })
+
+  it('fetchAbout 失败置 null', async () => {
+    vi.mocked(service.photos.getAbout).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await s.fetchAbout()
+    expect(s.about).toBeNull()
+  })
+})
+
+describe('photosSettings store · retention & scanInterval 回滚', () => {
+  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
+
+  it('setRetention 失败要回滚 —— Vue2 的 retention watcher 只弹 toast 不回滚,是缺陷,本期改正', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ retentionDays: 30 })
+    vi.mocked(service.photos.updateConfig).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await s.fetchRetention()
+    const ok = await s.setRetention(90)
+    expect(ok).toBe(false)
+    expect(s.retentionDays).toBe(30)
+  })
+
+  it('setScanInterval 失败要回滚(Vue2 :447-457 本就有 prev 回滚)', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ scanInterval: 1440 })
+    vi.mocked(service.photos.updateConfig).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await s.fetchScanInterval()
+    const ok = await s.setScanInterval(0)
+    expect(ok).toBe(false)
+    expect(s.scanIntervalMinutes).toBe(1440)
+  })
+
+  it('scanInterval 允许 0(关闭自动重扫)—— 不能被 `|| 1440` 之类的假值兜底吃掉', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({ scanInterval: 0 })
+    const s = usePhotosSettingsStore()
+    await s.fetchScanInterval()
+    expect(s.scanIntervalMinutes).toBe(0)
+  })
+
+  it('setScanInterval 写回时把 scanInterval 放进 extra 参数,watchDirs/retention 用当前值回传', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({
+      watchDirs: ['/DATA/Gallery'], retentionDays: 30, scanInterval: 1440,
+    })
+    vi.mocked(service.photos.updateConfig).mockResolvedValue(undefined)
+    const s = usePhotosSettingsStore()
+    await s.setScanInterval(360)
+    expect(service.photos.updateConfig).toHaveBeenCalledWith(
+      ['/DATA/Gallery'], 30, undefined, { scanInterval: 360 },
+    )
+  })
+})
+
+describe('photosSettings store · rebuildIndex 的 409 分支', () => {
+  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
+
+  it('正常路径返回新 taskId', async () => {
+    vi.mocked(service.photos.rebuildIndex).mockResolvedValue({ taskId: 't-1' })
+    const s = usePhotosSettingsStore()
+    await expect(s.rebuildIndex()).resolves.toBe('t-1')
+  })
+
+  it('409 = 已有重建在跑:不抛错,返回运行中那条 rebuild 任务的 id(Vue2 :464-468)', async () => {
+    vi.mocked(service.photos.rebuildIndex).mockRejectedValue({ response: { status: 409 } })
+    const s = usePhotosSettingsStore()
+    // 运行中的任务由 timeline store 的 tasks 提供;store 接受一个查找回调避免跨 store 硬依赖
+    await expect(s.rebuildIndex(() => 't-running')).resolves.toBe('t-running')
+  })
+
+  it('非 409 错误照常抛出', async () => {
+    vi.mocked(service.photos.rebuildIndex).mockRejectedValue({ response: { status: 500 } })
+    const s = usePhotosSettingsStore()
+    await expect(s.rebuildIndex()).rejects.toBeTruthy()
+  })
+})
+
+describe('photosSettings store · pruneCache / triggerScan / reclusterFaces', () => {
+  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
+
+  it('pruneCache 返回 freedBytes', async () => {
+    vi.mocked(service.photos.pruneCache).mockResolvedValue({ freedBytes: 12345 })
+    const s = usePhotosSettingsStore()
+    await expect(s.pruneCache()).resolves.toBe(12345)
+  })
+
+  it('pruneCache 空体按 0 处理', async () => {
+    vi.mocked(service.photos.pruneCache).mockResolvedValue(null as never)
+    const s = usePhotosSettingsStore()
+    await expect(s.pruneCache()).resolves.toBe(0)
+  })
+
+  it('pruneCache 失败向上抛(视图层负责 toast,同 Vue2 各动作)', async () => {
+    vi.mocked(service.photos.pruneCache).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await expect(s.pruneCache()).rejects.toBeTruthy()
+  })
+
+  it('triggerScan 成功返回 true', async () => {
+    vi.mocked(service.photos.triggerScan).mockResolvedValue(undefined)
+    const s = usePhotosSettingsStore()
+    await expect(s.triggerScan()).resolves.toBe(true)
+  })
+
+  it('triggerScan 失败向上抛', async () => {
+    vi.mocked(service.photos.triggerScan).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await expect(s.triggerScan()).rejects.toBeTruthy()
+  })
+
+  it('reclusterFaces 成功返回 true', async () => {
+    vi.mocked(service.photos.reclusterFaces).mockResolvedValue(undefined)
+    const s = usePhotosSettingsStore()
+    await expect(s.reclusterFaces()).resolves.toBe(true)
+  })
+
+  it('reclusterFaces 失败向上抛', async () => {
+    vi.mocked(service.photos.reclusterFaces).mockRejectedValue(new Error('boom'))
+    const s = usePhotosSettingsStore()
+    await expect(s.reclusterFaces()).rejects.toBeTruthy()
+  })
+})
+
+describe('photosSettings store · reset', () => {
+  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
+
+  it('reset 恢复所有字段到文档默认值', async () => {
+    vi.mocked(service.photos.getConfig).mockResolvedValue({
+      aiFeatures: { faces: false }, retentionDays: 90, scanInterval: 0,
+    })
+    vi.mocked(service.photos.getStorage).mockResolvedValue({
+      diskTotalBytes: 1, diskFreeBytes: 1, prunableBytes: 1,
+      photosBytes: 1, videosBytes: 1, rawBytes: 1, cacheBytes: 1, aiBytes: 1,
+    })
+    const s = usePhotosSettingsStore()
+    await s.fetchAiFeatures()
+    await s.fetchRetention()
+    await s.fetchScanInterval()
+    await s.fetchStorage()
+    s.reset()
+    expect(s.aiFeatures).toEqual({ faces: true, scenes: true, ocr: true, smartview: true })
+    expect(s.aiFeaturesLoaded).toBe(false)
+    expect(s.retentionDays).toBe(30)
+    expect(s.scanIntervalMinutes).toBe(1440)
+    expect(s.storage).toBeNull()
+    expect(s.storageError).toBe(false)
+    expect(s.about).toBeNull()
+  })
+})
diff --git a/src/photos/stores/settings.ts b/src/photos/stores/settings.ts
new file mode 100644
index 0000000..a87067e
--- /dev/null
+++ b/src/photos/stores/settings.ts
@@ -0,0 +1,267 @@
+// Ported (behavior unchanged, types added) from Vue2 NimoOS-UI
+// views/Photos/PhotosSettings.vue:234-297 (data + two watchers), :387-486
+// (five actions + loadStorage/loadAbout), :500-526 (mounted initial fetches)
+// and store/modules/photos.js:1249-1306 (setAiFaces/setAiFeatures/
+// fetchAiFeatures) + :1413-1438 (fetchTrashRetention/setTrashRetention/
+// fetchScanInterval/setScanInterval).
+//
+// This store is the shared config/storage/about cache for the settings page
+// (Tasks 3-6). It also folds in retention/scanInterval — duplicated on
+// purpose against trash.ts's own fetchRetention/setRetention (that copy
+// stays; the trash view is out of scope here, see task report "concerns").
+//
+// IMPORTANT (brief-vs-shared-package discrepancy, resolved in favor of the
+// shared package's actual signature — see task report): the shared package's
+// `updateConfig` is NOT `updateConfig(patch: object)`. Its real signature
+// (.sp7/NimoOS-Service/src/photos.ts:48-62) is positional:
+//   updateConfig(watchDirs: string[], retentionDays?, facesEnabled?, extra?)
+// `watchDirs` is unconditionally included in the request body (no way to
+// omit it), and the backend rejects an empty watchDirs list. Vue2 handles
+// this by re-reading getConfig() immediately before every updateConfig call
+// and re-sending the current watchDirs (setAiFaces :1249-1256, setAiFeatures
+// :1281-1291, setTrashRetention :1419-1425, setScanInterval :1432-1438) —
+// every write in this store follows that same read-then-write shape.
+import { defineStore } from 'pinia'
+import { ref } from 'vue'
+import { service } from '@nimotech/nimoos-service'
+
+export interface PhotosAiFeatures {
+  faces: boolean
+  scenes: boolean
+  ocr: boolean
+  smartview: boolean
+}
+
+export interface PhotosStorageInfo {
+  diskTotalBytes: number
+  diskFreeBytes: number
+  prunableBytes: number
+  photosBytes: number
+  videosBytes: number
+  rawBytes: number
+  cacheBytes: number
+  aiBytes: number
+}
+
+export interface PhotosAboutInfo {
+  version: string
+  deviceName: string
+  indexCoverage: number
+  indexLastBuilt: string
+  librarySince: string
+}
+
+const ALL_ON: PhotosAiFeatures = { faces: true, scenes: true, ocr: true, smartview: true }
+
+// Vue2 store/modules/photos.js:1297-1302 的读法:**只有显式 false 才关**,缺字段/请求失败
+// 一律按开启处理(宁可多显示一个入口,也不要因为一次配置读取抖动就把功能藏起来吓用户)。
+// 真实后端是扁平字段(`facesEnabled`/`scenesEnabled`/`ocrEnabled`/`smartViewEnabled`,注意
+// smartViewEnabled 的驼峰与其它三个不同),直接挂在 getConfig() 的返回体上,没有 `aiFeatures`
+// 嵌套键 —— 这里同时兼容测试夹具使用的 `{ aiFeatures: {...} }` 嵌套形状与短字段名。
+function readAiFeatures(cfg: Record<string, unknown> | null | undefined): PhotosAiFeatures {
+  const ai = (cfg?.aiFeatures ?? cfg ?? {}) as Record<string, unknown>
+  const on = (v: unknown): boolean => v !== false
+  return {
+    faces: on(ai.faces ?? ai.facesEnabled),
+    scenes: on(ai.scenes ?? ai.scenesEnabled),
+    ocr: on(ai.ocr ?? ai.ocrEnabled),
+    smartview: on(ai.smartview ?? ai.smartViewEnabled),
+  }
+}
+
+export const usePhotosSettingsStore = defineStore('photos-settings', () => {
+  const aiFeatures = ref<PhotosAiFeatures>({ ...ALL_ON })
+  // 仅成功路径置真 —— 与 favorites.ts:44 同一口径:一次取数失败必须与「确认全关」可区分,
+  // 否则以 !loaded 为重取判据的消费方会把真实配置永久掩在默认值后面。
+  const aiFeaturesLoaded = ref(false)
+  const storage = ref<PhotosStorageInfo | null>(null)
+  const storageError = ref(false)
+  const about = ref<PhotosAboutInfo | null>(null)
+  const retentionDays = ref(30)
+  const scanIntervalMinutes = ref(1440)
+
+  async function fetchAiFeatures(): Promise<PhotosAiFeatures> {
+    try {
+      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
+      aiFeatures.value = readAiFeatures(cfg)
+      aiFeaturesLoaded.value = true
+    } catch (e) {
+      aiFeatures.value = { ...ALL_ON }
+      console.error('[photos-settings] fetchAiFeatures', e)
+    }
+    return aiFeatures.value
+  }
+
+  // Vue2 :263-281 是一个 features 的 deep watcher,靠 _suppressFeaturesWatch + $nextTick
+  // 抑制「从后端同步初值」时的回写。New-UI 改成显式 action(点开关才调),**没有 watcher,
+  // 那套抑制标志整套不需要** —— 这不是重构掉功能,是同一意图在显式调用模型下的直接对应物。
+  // 乐观更新 + 失败回滚:与 Vue2 一致(:274-275 把 features 退回 _lastGoodFeatures)。
+  //
+  // 写回前重读一次 getConfig() 取当前 watchDirs/retentionDays 随同回传 —— 见文件头注释,
+  // 共享包 updateConfig 的 watchDirs 是必填位置参数,后端对空 watchDirs 有非空校验
+  // (同 Vue2 setAiFeatures :1281-1291)。
+  async function setAiFeature(id: keyof PhotosAiFeatures, on: boolean): Promise<boolean> {
+    const prev = { ...aiFeatures.value }
+    aiFeatures.value = { ...prev, [id]: on }
+    try {
+      const next = aiFeatures.value
+      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
+      const watchDirs = (cfg?.watchDirs as string[] | undefined) ?? []
+      const retention = cfg?.retentionDays as number | undefined
+      await service.photos.updateConfig(watchDirs, retention, next.faces, {
+        scenesEnabled: next.scenes,
+        ocrEnabled: next.ocr,
+        smartViewEnabled: next.smartview,
+      })
+      return true
+    } catch (e) {
+      aiFeatures.value = prev
+      console.error('[photos-settings] setAiFeature', id, e)
+      return false
+    }
+  }
+
+  async function fetchStorage(): Promise<void> {
+    try {
+      const res = (await service.photos.getStorage()) as unknown as PhotosStorageInfo | null
+      storage.value = res ?? null
+      // Vue2 :391 —— 后端返空体也算失败态(裸 JSON 直出,Photos v1 无信封,204 空体是可能的)
+      storageError.value = !storage.value
+    } catch (e) {
+      storage.value = null
+      storageError.value = true
+      console.error('[photos-settings] fetchStorage', e)
+    }
+  }
+
+  async function fetchAbout(): Promise<void> {
+    try {
+      const res = (await service.photos.getAbout()) as unknown as PhotosAboutInfo | null
+      about.value = res ?? null
+    } catch (e) {
+      about.value = null
+      console.error('[photos-settings] fetchAbout', e)
+    }
+  }
+
+  async function fetchRetention(): Promise<void> {
+    try {
+      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
+      const d = Number(cfg?.retentionDays)
+      if (d > 0) retentionDays.value = d
+    } catch (e) {
+      console.error('[photos-settings] fetchRetention', e)
+    }
+  }
+
+  // Vue2 :254-262 的 retention watcher 保存失败**只弹 toast、不回滚** ⇒ UI 上停在用户选的档位
+  // 而后端还是旧值,下次打开设置又跳回去。按铁律「Vue2 的 bug 不照抄」补回滚,与同文件
+  // :447-457 的 setScanInterval(本就有 prev 回滚)口径对齐。
+  async function setRetention(days: number): Promise<boolean> {
+    const prev = retentionDays.value
+    retentionDays.value = days
+    try {
+      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
+      const watchDirs = (cfg?.watchDirs as string[] | undefined) ?? []
+      await service.photos.updateConfig(watchDirs, days)
+      return true
+    } catch (e) {
+      retentionDays.value = prev
+      console.error('[photos-settings] setRetention', e)
+      return false
+    }
+  }
+
+  // scanInterval 允许 0(= 关闭自动重扫,见 Vue2 :306 的 scan_interval_off 档),
+  // 所以判据用 Number.isFinite 而不是真值判断 —— `cfg.scanInterval || 1440` 会把 0 吃成 1440。
+  async function fetchScanInterval(): Promise<void> {
+    try {
+      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
+      const v = Number(cfg?.scanInterval)
+      if (Number.isFinite(v) && v >= 0) scanIntervalMinutes.value = v
+    } catch (e) {
+      console.error('[photos-settings] fetchScanInterval', e)
+    }
+  }
+
+  async function setScanInterval(minutes: number): Promise<boolean> {
+    const prev = scanIntervalMinutes.value
+    scanIntervalMinutes.value = minutes
+    try {
+      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
+      const watchDirs = (cfg?.watchDirs as string[] | undefined) ?? []
+      const retention = cfg?.retentionDays as number | undefined
+      await service.photos.updateConfig(watchDirs, retention, undefined, { scanInterval: minutes })
+      return true
+    } catch (e) {
+      scanIntervalMinutes.value = prev
+      console.error('[photos-settings] setScanInterval', e)
+      return false
+    }
+  }
+
+  // 取数失败保守默认(0),失败已 console.error 登记;动作类(pruneCache/triggerScan/
+  // reclusterFaces/rebuildIndex 非 409 分支)失败**向上抛**,视图层负责弹 toast,
+  // 与 Vue2 各动作方法里 showToast 的位置一致(store 只做数据/回滚,不做 UI 提示)。
+  async function pruneCache(): Promise<number> {
+    const res = (await service.photos.pruneCache()) as { freedBytes?: number } | null
+    return res?.freedBytes ?? 0
+  }
+
+  // 409 = 后端已有一个重建在跑。Vue2 :464-468 此时拉一次任务列表、绑定到运行中那条
+  // type==='rebuild' 的任务上继续显示进度,**不报错**。这里用回调注入查找逻辑,避免
+  // settings store 硬依赖 timeline store(任务列表的所有权在 timeline,不复制第二份轮询)。
+  async function rebuildIndex(findRunningId?: () => string | undefined): Promise<string> {
+    try {
+      const res = (await service.photos.rebuildIndex()) as { taskId?: string } | null
+      return res?.taskId ?? ''
+    } catch (e) {
+      const status = (e as { response?: { status?: number } })?.response?.status
+      if (status === 409) return findRunningId?.() ?? ''
+      throw e
+    }
+  }
+
+  async function triggerScan(): Promise<boolean> {
+    await service.photos.triggerScan()
+    return true
+  }
+
+  async function reclusterFaces(): Promise<boolean> {
+    await service.photos.reclusterFaces()
+    return true
+  }
+
+  function reset(): void {
+    aiFeatures.value = { ...ALL_ON }
+    aiFeaturesLoaded.value = false
+    storage.value = null
+    storageError.value = false
+    about.value = null
+    retentionDays.value = 30
+    scanIntervalMinutes.value = 1440
+  }
+
+  return {
+    aiFeatures,
+    aiFeaturesLoaded,
+    storage,
+    storageError,
+    about,
+    retentionDays,
+    scanIntervalMinutes,
+    fetchAiFeatures,
+    setAiFeature,
+    fetchStorage,
+    fetchAbout,
+    fetchRetention,
+    setRetention,
+    fetchScanInterval,
+    setScanInterval,
+    pruneCache,
+    rebuildIndex,
+    triggerScan,
+    reclusterFaces,
+    reset,
+  }
+})
```
