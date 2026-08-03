// Ported (behavior unchanged, types added) from Vue2 NimoOS-UI
// views/Photos/PhotosSettings.vue:234-297 (data + two watchers), :387-486
// (five actions + loadStorage/loadAbout), :500-526 (mounted initial fetches)
// and store/modules/photos.js:1249-1306 (setAiFaces/setAiFeatures/
// fetchAiFeatures) + :1413-1438 (fetchTrashRetention/setTrashRetention/
// fetchScanInterval/setScanInterval).
//
// This store is the shared config/storage/about cache for the settings page
// (Tasks 3-6). It also folds in retention/scanInterval — duplicated on
// purpose against trash.ts's own fetchRetention/setRetention (that copy
// stays; the trash view is out of scope here, see task report "concerns").
//
// IMPORTANT (brief-vs-shared-package discrepancy, resolved in favor of the
// shared package's actual signature — see task report): the shared package's
// `updateConfig` is NOT `updateConfig(patch: object)`. Its real signature
// (.sp7/NimoOS-Service/src/photos.ts:48-62) is positional:
//   updateConfig(watchDirs: string[], retentionDays?, facesEnabled?, extra?)
// `watchDirs` is unconditionally included in the request body (no way to
// omit it), and the backend rejects an empty watchDirs list. Vue2 handles
// this by re-reading getConfig() immediately before every updateConfig call
// and re-sending the current watchDirs (setAiFaces :1249-1256, setAiFeatures
// :1281-1291, setTrashRetention :1419-1425, setScanInterval :1432-1438) —
// every write in this store follows that same read-then-write shape.
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

export interface PhotosAiFeatures {
  faces: boolean
  scenes: boolean
  ocr: boolean
  smartview: boolean
}

export interface PhotosStorageInfo {
  diskTotalBytes: number
  diskFreeBytes: number
  prunableBytes: number
  photosBytes: number
  videosBytes: number
  rawBytes: number
  cacheBytes: number
  aiBytes: number
}

export interface PhotosAboutInfo {
  version: string
  deviceName: string
  indexCoverage: number
  indexLastBuilt: string
  librarySince: string
}

const ALL_ON: PhotosAiFeatures = { faces: true, scenes: true, ocr: true, smartview: true }

// Vue2 store/modules/photos.js:1297-1302 的读法:**只有显式 false 才关**,缺字段/请求失败
// 一律按开启处理(宁可多显示一个入口,也不要因为一次配置读取抖动就把功能藏起来吓用户)。
// 真实后端是扁平字段(`facesEnabled`/`scenesEnabled`/`ocrEnabled`/`smartViewEnabled`,注意
// smartViewEnabled 的驼峰与其它三个不同),直接挂在 getConfig() 的返回体上,没有 `aiFeatures`
// 嵌套键 —— 这里同时兼容测试夹具使用的 `{ aiFeatures: {...} }` 嵌套形状与短字段名。
function readAiFeatures(cfg: Record<string, unknown> | null | undefined): PhotosAiFeatures {
  const ai = (cfg?.aiFeatures ?? cfg ?? {}) as Record<string, unknown>
  const on = (v: unknown): boolean => v !== false
  return {
    faces: on(ai.faces ?? ai.facesEnabled),
    scenes: on(ai.scenes ?? ai.scenesEnabled),
    ocr: on(ai.ocr ?? ai.ocrEnabled),
    smartview: on(ai.smartview ?? ai.smartViewEnabled),
  }
}

export const usePhotosSettingsStore = defineStore('photos-settings', () => {
  const aiFeatures = ref<PhotosAiFeatures>({ ...ALL_ON })
  // 仅成功路径置真 —— 与 favorites.ts:44 同一口径:一次取数失败必须与「确认全关」可区分,
  // 否则以 !loaded 为重取判据的消费方会把真实配置永久掩在默认值后面。
  const aiFeaturesLoaded = ref(false)
  const storage = ref<PhotosStorageInfo | null>(null)
  const storageError = ref(false)
  const about = ref<PhotosAboutInfo | null>(null)
  const retentionDays = ref(30)
  const scanIntervalMinutes = ref(1440)

  async function fetchAiFeatures(): Promise<PhotosAiFeatures> {
    try {
      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
      aiFeatures.value = readAiFeatures(cfg)
      aiFeaturesLoaded.value = true
    } catch (e) {
      aiFeatures.value = { ...ALL_ON }
      console.error('[photos-settings] fetchAiFeatures', e)
    }
    return aiFeatures.value
  }

  // Vue2 :263-281 是一个 features 的 deep watcher,靠 _suppressFeaturesWatch + $nextTick
  // 抑制「从后端同步初值」时的回写。New-UI 改成显式 action(点开关才调),**没有 watcher,
  // 那套抑制标志整套不需要** —— 这不是重构掉功能,是同一意图在显式调用模型下的直接对应物。
  // 乐观更新 + 失败回滚:与 Vue2 一致(:274-275 把 features 退回 _lastGoodFeatures)。
  //
  // 写回前重读一次 getConfig() 取当前 watchDirs/retentionDays 随同回传 —— 见文件头注释,
  // 共享包 updateConfig 的 watchDirs 是必填位置参数,后端对空 watchDirs 有非空校验
  // (同 Vue2 setAiFeatures :1281-1291)。
  async function setAiFeature(id: keyof PhotosAiFeatures, on: boolean): Promise<boolean> {
    const prev = { ...aiFeatures.value }
    aiFeatures.value = { ...prev, [id]: on }
    try {
      const next = aiFeatures.value
      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
      const watchDirs = (cfg?.watchDirs as string[] | undefined) ?? []
      const retention = cfg?.retentionDays as number | undefined
      await service.photos.updateConfig(watchDirs, retention, next.faces, {
        scenesEnabled: next.scenes,
        ocrEnabled: next.ocr,
        smartViewEnabled: next.smartview,
      })
      return true
    } catch (e) {
      aiFeatures.value = prev
      console.error('[photos-settings] setAiFeature', id, e)
      return false
    }
  }

  async function fetchStorage(): Promise<void> {
    try {
      const res = (await service.photos.getStorage()) as unknown as PhotosStorageInfo | null
      storage.value = res ?? null
      // Vue2 :391 —— 后端返空体也算失败态(裸 JSON 直出,Photos v1 无信封,204 空体是可能的)
      storageError.value = !storage.value
    } catch (e) {
      storage.value = null
      storageError.value = true
      console.error('[photos-settings] fetchStorage', e)
    }
  }

  async function fetchAbout(): Promise<void> {
    try {
      const res = (await service.photos.getAbout()) as unknown as PhotosAboutInfo | null
      about.value = res ?? null
    } catch (e) {
      about.value = null
      console.error('[photos-settings] fetchAbout', e)
    }
  }

  async function fetchRetention(): Promise<void> {
    try {
      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
      const d = Number(cfg?.retentionDays)
      if (d > 0) retentionDays.value = d
    } catch (e) {
      console.error('[photos-settings] fetchRetention', e)
    }
  }

  // Vue2 :254-262 的 retention watcher 保存失败**只弹 toast、不回滚** ⇒ UI 上停在用户选的档位
  // 而后端还是旧值,下次打开设置又跳回去。按铁律「Vue2 的 bug 不照抄」补回滚,与同文件
  // :447-457 的 setScanInterval(本就有 prev 回滚)口径对齐。
  async function setRetention(days: number): Promise<boolean> {
    const prev = retentionDays.value
    retentionDays.value = days
    try {
      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
      const watchDirs = (cfg?.watchDirs as string[] | undefined) ?? []
      await service.photos.updateConfig(watchDirs, days)
      return true
    } catch (e) {
      retentionDays.value = prev
      console.error('[photos-settings] setRetention', e)
      return false
    }
  }

  // scanInterval 允许 0(= 关闭自动重扫,见 Vue2 :306 的 scan_interval_off 档),
  // 所以判据用 Number.isFinite 而不是真值判断 —— `cfg.scanInterval || 1440` 会把 0 吃成 1440。
  async function fetchScanInterval(): Promise<void> {
    try {
      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
      const v = Number(cfg?.scanInterval)
      if (Number.isFinite(v) && v >= 0) scanIntervalMinutes.value = v
    } catch (e) {
      console.error('[photos-settings] fetchScanInterval', e)
    }
  }

  async function setScanInterval(minutes: number): Promise<boolean> {
    const prev = scanIntervalMinutes.value
    scanIntervalMinutes.value = minutes
    try {
      const cfg = (await service.photos.getConfig()) as Record<string, unknown>
      const watchDirs = (cfg?.watchDirs as string[] | undefined) ?? []
      const retention = cfg?.retentionDays as number | undefined
      await service.photos.updateConfig(watchDirs, retention, undefined, { scanInterval: minutes })
      return true
    } catch (e) {
      scanIntervalMinutes.value = prev
      console.error('[photos-settings] setScanInterval', e)
      return false
    }
  }

  // 取数失败保守默认(0),失败已 console.error 登记;动作类(pruneCache/triggerScan/
  // reclusterFaces/rebuildIndex 非 409 分支)失败**向上抛**,视图层负责弹 toast,
  // 与 Vue2 各动作方法里 showToast 的位置一致(store 只做数据/回滚,不做 UI 提示)。
  async function pruneCache(): Promise<number> {
    const res = (await service.photos.pruneCache()) as { freedBytes?: number } | null
    return res?.freedBytes ?? 0
  }

  // 409 = 后端已有一个重建在跑。Vue2 :464-468 此时拉一次任务列表、绑定到运行中那条
  // type==='rebuild' 的任务上继续显示进度,**不报错**。这里用回调注入查找逻辑,避免
  // settings store 硬依赖 timeline store(任务列表的所有权在 timeline,不复制第二份轮询)。
  async function rebuildIndex(findRunningId?: () => string | undefined): Promise<string> {
    try {
      const res = (await service.photos.rebuildIndex()) as { taskId?: string } | null
      return res?.taskId ?? ''
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 409) return findRunningId?.() ?? ''
      throw e
    }
  }

  async function triggerScan(): Promise<boolean> {
    await service.photos.triggerScan()
    return true
  }

  async function reclusterFaces(): Promise<boolean> {
    await service.photos.reclusterFaces()
    return true
  }

  function reset(): void {
    aiFeatures.value = { ...ALL_ON }
    aiFeaturesLoaded.value = false
    storage.value = null
    storageError.value = false
    about.value = null
    retentionDays.value = 30
    scanIntervalMinutes.value = 1440
  }

  return {
    aiFeatures,
    aiFeaturesLoaded,
    storage,
    storageError,
    about,
    retentionDays,
    scanIntervalMinutes,
    fetchAiFeatures,
    setAiFeature,
    fetchStorage,
    fetchAbout,
    fetchRetention,
    setRetention,
    fetchScanInterval,
    setScanInterval,
    pruneCache,
    rebuildIndex,
    triggerScan,
    reclusterFaces,
    reset,
  }
})
