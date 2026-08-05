## Task 1: `photosSettings` store

这是 P7a 留的三项 config 挂账的共同基建,后面 4 个任务都依赖它。

**Files:**
- Create: `src/photos/stores/settings.ts`
- Test: `src/photos/stores/__tests__/settings.test.ts`

**Interfaces:**
- Consumes: 共享包 `service.photos.{getConfig,updateConfig,getStorage,getAbout,pruneCache,rebuildIndex,triggerScan,reclusterFaces}`(签名见 `.sp7/NimoOS-Service/src/photos.ts`);`src/photos/stores/timeline.ts` 的 `tasks` 数组(读 `rebuild` 类型任务的进度,**不要另建一份任务轮询**)。
- Produces:
  ```ts
  export interface PhotosAiFeatures { faces: boolean; scenes: boolean; ocr: boolean; smartview: boolean }
  export interface PhotosStorageInfo {
    diskTotalBytes: number; diskFreeBytes: number; prunableBytes: number
    photosBytes: number; videosBytes: number; rawBytes: number; cacheBytes: number; aiBytes: number
  }
  export interface PhotosAboutInfo {
    version: string; deviceName: string; indexCoverage: number
    indexLastBuilt: string; librarySince: string
  }
  export const usePhotosSettingsStore: StoreDefinition<'photos-settings', {
    aiFeatures: Ref<PhotosAiFeatures>          // 默认全 true(失败/缺字段一律按开启,不吓用户)
    aiFeaturesLoaded: Ref<boolean>             // 仅成功路径置真
    storage: Ref<PhotosStorageInfo | null>
    storageError: Ref<boolean>
    about: Ref<PhotosAboutInfo | null>
    retentionDays: Ref<number>                 // 默认 30
    scanIntervalMinutes: Ref<number>           // 默认 1440
  }, {}, {
    fetchAiFeatures(): Promise<PhotosAiFeatures>
    setAiFeature(id: keyof PhotosAiFeatures, on: boolean): Promise<boolean>  // 返回是否保存成功;失败已自行回滚
    fetchStorage(): Promise<void>
    fetchAbout(): Promise<void>
    fetchRetention(): Promise<void>
    setRetention(days: number): Promise<boolean>
    fetchScanInterval(): Promise<void>
    setScanInterval(minutes: number): Promise<boolean>
    pruneCache(): Promise<number>              // 返回 freedBytes
    rebuildIndex(): Promise<string>            // 返回 taskId;409 时返回运行中任务的 id
    triggerScan(): Promise<boolean>
    reclusterFaces(): Promise<boolean>
    reset(): void
  }>
  ```

**回源坐标**(Vue2):`src/views/Photos/PhotosSettings.vue:234-297`(data + 两个 watch)、`:500-526`(mounted 取数)、`:414-486`(五个动作);`src/store/modules/photos.js` 的 `fetchAiFeatures`(:1290-1306)/ `setAiFeatures` / `fetchTrashRetention` / `setTrashRetention` / `fetchScanInterval` / `setScanInterval` / `reclusterFaces`。

**关键行为(逐条都要有断言)**

1. **`aiFeatures` 默认全开、失败按开启**。Vue2 `fetchAiFeatures`(`store/modules/photos.js:1298-1302`)的读法是 `d.ocrEnabled !== false` 这种**「只有显式 false 才关」**,缺字段按开启。`aiFeaturesLoaded` 只在成功路径置真(照 `favorites.ts:44` 的既有口径注释)。
2. **`setAiFeature` 失败要回滚**,照 Vue2 `:263-281` 的 `features` deep watcher:保存失败时把开关退回上一个已知好值。**Vue2 用 `_suppressFeaturesWatch` + `$nextTick` 这套 watcher 抑制标志,New-UI 改成显式 action 调用(无 watcher)⇒ 抑制标志整套不需要,删掉并注释登记**(这不是无关重构,是 Vue2 的 watcher 写法在 Vue3 显式 action 下的直接对应物)。
3. **`rebuildIndex` 的 409 分支**:Vue2 `:458-473` —— 409 表示已有重建在跑,此时拉一次任务列表、绑定到 `type === 'rebuild'` 的运行中任务上显示进度,**不弹错误**。非 409 才报错。
4. **`setRetention` / `setScanInterval` 失败要把值退回去**(Vue2 `:447-457` 的 `setScanInterval` 有 `prev` 回滚;`:254-262` 的 retention watcher **没有**回滚,只弹 toast —— 那是 Vue2 缺陷,**按铁律改成两者都回滚并注释登记**)。
5. **`updateConfig` 的省略字段语义**:共享包 `photos.ts:47` 注释写明「extra: `{scenesEnabled, ocrEnabled, smartViewEnabled, scanInterval}` — 省略的字段后端保持现值」。写单个开关时**要把 4 个开关的当前值一起发**,否则后端把未发的字段当保持现值(实际语义要回源复核共享包实现,若确为「保持现值」则可只发一个;**实施时用 `sed -n '43,70p' ../NimoOS-Service/src/photos.ts` 逐字读一遍再定**)。

- [ ] **Step 1: 写失败测试 —— aiFeatures 的默认与失败语义**

```ts
// src/photos/stores/__tests__/settings.test.ts
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

  it('取数失败:按全开处理,且 aiFeaturesLoaded 保持 false(可与「确认全关」区分)', async () => {
    vi.mocked(service.photos.getConfig).mockRejectedValue(new Error('boom'))
    const s = usePhotosSettingsStore()
    await s.fetchAiFeatures()
    expect(s.aiFeatures).toEqual({ faces: true, scenes: true, ocr: true, smartview: true })
    expect(s.aiFeaturesLoaded).toBe(false)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run src/photos/stores/__tests__/settings.test.ts --reporter=verbose`
Expected: FAIL — `Failed to resolve import "../settings"`

- [ ] **Step 3: 写 store 的 aiFeatures 部分**

回源复核 `src/store/modules/photos.js:1290-1306` 的字段名映射(`facesEnabled`/`scenesEnabled`/`ocrEnabled`/`smartViewEnabled` → `faces`/`scenes`/`ocr`/`smartview`),**注意 `smartViewEnabled` 的驼峰与其它三个不同**。

```ts
// src/photos/stores/settings.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { service } from '@nimotech/nimoos-service'

export interface PhotosAiFeatures {
  faces: boolean
  scenes: boolean
  ocr: boolean
  smartview: boolean
}

const ALL_ON: PhotosAiFeatures = { faces: true, scenes: true, ocr: true, smartview: true }

// Vue2 store/modules/photos.js:1298-1302 的读法:**只有显式 false 才关**,缺字段/请求失败
// 一律按开启处理(宁可多显示一个入口,也不要因为一次配置读取抖动就把功能藏起来吓用户)。
// 注意后端字段名 smartViewEnabled 的驼峰与其它三个不同(facesEnabled/scenesEnabled/ocrEnabled)。
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

  function reset(): void {
    aiFeatures.value = { ...ALL_ON }
    aiFeaturesLoaded.value = false
  }

  return { aiFeatures, aiFeaturesLoaded, fetchAiFeatures, reset }
})
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm exec vitest run src/photos/stores/__tests__/settings.test.ts --reporter=verbose`
Expected: PASS 3/3,零 `[Vue warn]`

- [ ] **Step 5: 写失败测试 —— setAiFeature 的写回与回滚**

```ts
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
    expect(s.aiFeatures.scenes).toBe(false) // 在途已生效
    release?.()
    await p
  })
})
```

- [ ] **Step 6: 运行确认失败**

Run: `pnpm exec vitest run src/photos/stores/__tests__/settings.test.ts -t setAiFeature --reporter=verbose`
Expected: FAIL — `s.setAiFeature is not a function`

- [ ] **Step 7: 实现 setAiFeature**

**先** `sed -n '43,70p' ../NimoOS-Service/src/photos.ts` 逐字读 `updateConfig` 的入参形状与「省略字段保持现值」的实现,再决定是发单字段还是发全部 4 个。下面按「发全部 4 个」写(更安全,与 Vue2 `dispatch('photos/setAiFeatures', {...v})` 发整个对象一致);若共享包确实支持单字段增量,改成单字段并在注释里写明依据。

```ts
  // Vue2 :263-281 是一个 features 的 deep watcher,靠 _suppressFeaturesWatch + $nextTick
  // 抑制「从后端同步初值」时的回写。New-UI 改成显式 action(点开关才调),**没有 watcher,
  // 那套抑制标志整套不需要** —— 这不是重构掉功能,是同一意图在显式调用模型下的直接对应物。
  // 乐观更新 + 失败回滚:与 Vue2 一致(:274-275 把 features 退回 _lastGoodFeatures)。
  async function setAiFeature(id: keyof PhotosAiFeatures, on: boolean): Promise<boolean> {
    const prev = { ...aiFeatures.value }
    aiFeatures.value = { ...prev, [id]: on }
    try {
      const next = aiFeatures.value
      await service.photos.updateConfig({
        facesEnabled: next.faces,
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
```

- [ ] **Step 8: 运行确认通过**

Run: `pnpm exec vitest run src/photos/stores/__tests__/settings.test.ts --reporter=verbose`
Expected: PASS 6/6

- [ ] **Step 9: 写失败测试 —— storage / about / retention / scanInterval / 四个动作**

```ts
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
```

- [ ] **Step 10: 运行确认失败,然后实现剩余部分**

Run: `pnpm exec vitest run src/photos/stores/__tests__/settings.test.ts --reporter=verbose`
Expected: 新增用例 FAIL

实现要点(每条都对应上面一个用例):

```ts
  const storage = ref<PhotosStorageInfo | null>(null)
  const storageError = ref(false)
  const about = ref<PhotosAboutInfo | null>(null)
  const retentionDays = ref(30)
  const scanIntervalMinutes = ref(1440)

  async function fetchStorage(): Promise<void> {
    try {
      const res = (await service.photos.getStorage()) as PhotosStorageInfo | null
      storage.value = res ?? null
      // Vue2 :391 —— 后端返空体也算失败态(裸 JSON 直出,Photos v1 无信封,204 空体是可能的)
      storageError.value = !storage.value
    } catch (e) {
      storage.value = null
      storageError.value = true
      console.error('[photos-settings] fetchStorage', e)
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

  // Vue2 :254-262 的 retention watcher 保存失败**只弹 toast、不回滚** ⇒ UI 上停在用户选的档位
  // 而后端还是旧值,下次打开设置又跳回去。按铁律「Vue2 的 bug 不照抄」补回滚,与同文件
  // :447-457 的 setScanInterval(本就有 prev 回滚)口径对齐。
  async function setRetention(days: number): Promise<boolean> {
    const prev = retentionDays.value
    retentionDays.value = days
    try {
      await service.photos.updateConfig({ retentionDays: days })
      return true
    } catch (e) {
      retentionDays.value = prev
      console.error('[photos-settings] setRetention', e)
      return false
    }
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
```

`fetchRetention` / `fetchAbout` / `pruneCache` / `triggerScan` / `reclusterFaces` 照同一形状写:取数失败 `console.error` + 保守默认;动作类失败**向上抛**(视图层负责弹 toast,与 Vue2 各动作方法里 `showToast` 的位置一致)。`pruneCache` 返回 `res?.freedBytes ?? 0`。

- [ ] **Step 11: 运行全部 store 测试 + 类型检查**

Run: `pnpm exec vitest run src/photos/stores/__tests__/settings.test.ts --reporter=verbose && pnpm exec vue-tsc --noEmit`
Expected: 全 PASS,零 `[Vue warn]`,tsc exit 0

- [ ] **Step 12: 变异验证**(计划书点名的不变量)

逐条临时改坏 → 确认变红 → 恢复,并把结果写进 task report:
1. 把 `on()` 从 `v !== false` 改成 `!!v` → 「缺字段按开启」与「ocr: 0 不算关」两条应变红
2. 删掉 `setAiFeature` 的 `aiFeatures.value = prev` → 回滚用例应变红
3. 把 `fetchScanInterval` 的判据改成 `if (v)` → 「允许 0」应变红
4. 删掉 `rebuildIndex` 的 409 分支 → 409 用例应变红
5. 把 `storageError.value = !storage.value` 改成只在 catch 里置真 → 「空体也算失败态」应变红

- [ ] **Step 13: Commit**

```bash
git add src/photos/stores/settings.ts src/photos/stores/__tests__/settings.test.ts
git commit -m "feat(photos): photosSettings store(P8a-T1)

相册区 config/storage/about 的唯一缓存,收编 P7a 留的三项 config 挂账。
按铁律修正的 Vue2 缺陷:retention 保存失败不回滚(:254-262)。
scanInterval 允许 0 档,判据用 Number.isFinite 而非真值判断。"
```

---

