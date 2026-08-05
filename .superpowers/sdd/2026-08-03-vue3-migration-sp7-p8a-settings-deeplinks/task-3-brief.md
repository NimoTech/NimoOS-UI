## Task 3: 存储卡组件 `PhotosStorageCard.vue`

**Files:**
- Create: `src/photos/util/storagePalette.ts`
- Create: `src/photos/components/PhotosStorageCard.vue`
- Test: `src/photos/components/__tests__/PhotosStorageCard.test.ts`
- Modify: `src/styles/theme.css`、`docs/THEMING.md`(若新增 token)

**Interfaces:**
- Consumes: T1 的 `usePhotosSettingsStore()`(`storage` / `storageError` / `retentionDays` / `scanIntervalMinutes` / `fetchStorage` / `setRetention` / `setScanInterval` / `pruneCache` / `triggerScan`);T2 的 `photosSettings*` 键。
- Produces: `<PhotosStorageCard @toast="(payload: { icon: string; text: string }) => void" />` —— 卡片自己不弹 toast,**统一由 T5 的容器承接**(Vue2 那边 toast 归容器 `PhotosSettings.vue:487-491`,照此)。

**回源坐标**:Vue2 `PhotosSettings.vue:39-126`(模板)、`:299-331`(computed:`capGB`/`freeGB`/`usedGB`/`prunableBytes`/`scanIntervalOptions`/`breakdown`/`pctOf`)、`:382`(`fmt`)、`:405-457`(`fmtBytes`/`clearCache`/`rescanNow`/`setScanInterval`)。

**逐条 1:1 契约(每条都要有断言)**

1. **容量条 6 段 + free 段**。`breakdown`(`:313-330`)的段序固定为 photos → videos → raw → thumbs → ai →(other,仅当 `usedGB - 已知段合计 > 0.05` 时追加)。宽度 `pctOf(gb) = capGB > 0 ? gb/capGB*100 : 0`。
2. **`fmt`**(`:382`):`g >= 100 ? g.toFixed(0) : g.toFixed(1)`。
3. **`fmtBytes`**(`:405-413`):单位表 `['B','KB','MB','GB','TB']`,`while (v >= 1024 && i < len-1)`,输出 `v >= 100 ? toFixed(0) : toFixed(1)` + 空格 + 单位;`b <= 0` 返 `'0 B'`。
4. **retention 5 档**:`[7, 15, 30, 60, 90]`,当前档 `data-active`。
5. **scanInterval 5 档**(`:304-311`):`0`(→ `photosSettingsScanIntervalOff`)/ `360`(`6h`)/ `720`(`12h`)/ `1440`(`24h`)/ `10080`(`7d`)。**`6h`/`12h`/`24h`/`7d` 这四个 label 在 Vue2 是裸字面量、不过 `$t`** —— 照搬为字面量(它们是单位缩写,不是需要翻译的句子),在注释里登记。
6. **缓存清理按钮的三态**:`busy`(转圈 + `photosSettingsClearing`)/ `cleared`(对勾 + `photosSettingsCleared`,2000ms 后自动退回)/ 常态(垃圾桶图标 + `photosSettingsClearCache` + ` (` + `fmtBytes(prunableBytes)` + `)`)。`:disabled="busy || !prunableBytes"`。
7. **`storageError` 时**:大数字位显示 `—`(Vue2 `:52` 的 `&mdash;`),副行显示 `photosSettingsStorageUnavailable`。
8. **`clearCache` 成功后要重拉 storage**(`:423` 的 `await this.loadStorage()`)。

**颜色处理(硬约束)**

Vue2 的 6 段色是内联字面量:photos = `var(--accent)`、videos = `#5e94ff`、raw = `#FF9AC2`、thumbs = `var(--success)`、ai = `#FF9F0A`、other = `rgba(var(--ink),0.25)`。按 D5 / `PLACE_PALETTE`(P5-T12)/ `placesMapThemes.ts`(P6a)的既有先例:**这是数据可视化调色板**,写进 `src/photos/util/storagePalette.ts` 常量并进 `docs/THEMING.md` 第三类例外清单。

⚠️ 两条踩过的坑:
- `color-guard.test.ts` **不剥 CSS 注释** ⇒ 该文件是 `.ts` 不是 `.css`,不受 color-guard 扫描,但**别在任何 `.vue` 的 `<style>` 块里(含注释)写这些色值**。
- 段色是铺在卡片背景上的**内容色**(非 chrome/surface),照 P6a 的控制器裁定:内容色须新增精确常量,不要就近拿既有 token 凑。

`--success` 与 `--accent` 两个既有 token 直接引用;三个字面量色(videos/raw/ai)与 other 的 `rgba(var(--ink),0.25)` 写进 palette 常量。

- [ ] **Step 1: 写失败测试 —— 纯函数与分段**

```ts
// src/photos/components/__tests__/PhotosStorageCard.test.ts
import { describe, it, expect } from 'vitest'
import { fmtGB, fmtBytes, buildBreakdown } from '../../util/storagePalette'

describe('storage 卡纯函数', () => {
  it('fmtGB:>=100 取整,否则一位小数(Vue2 :382)', () => {
    expect(fmtGB(100)).toBe('100')
    expect(fmtGB(99.94)).toBe('99.9')
    expect(fmtGB(0)).toBe('0.0')
  })

  it('fmtBytes:逐级进位,>=100 取整(Vue2 :405-413)', () => {
    expect(fmtBytes(0)).toBe('0 B')
    expect(fmtBytes(-1)).toBe('0 B')
    expect(fmtBytes(512)).toBe('512 B')          // 512 >= 100 ⇒ 取整
    expect(fmtBytes(1536)).toBe('1.5 KB')
    expect(fmtBytes(1024 ** 4 * 2)).toBe('2.0 TB')
    // 单位表到 TB 为止,更大的值继续用 TB 表示(while 的 i < len-1 上界)
    expect(fmtBytes(1024 ** 5)).toBe('1024 TB')
  })

  it('buildBreakdown:段序固定,other 仅在剩余 > 0.05 GB 时追加(Vue2 :327)', () => {
    const GB = 1024 ** 3
    const segs = buildBreakdown(
      { photosBytes: 3 * GB, videosBytes: 2 * GB, rawBytes: GB, cacheBytes: 0, aiBytes: 0 },
      10, // usedGB
    )
    expect(segs.map((s) => s.key)).toEqual(['photos', 'videos', 'raw', 'thumbs', 'ai', 'other'])
    expect(segs.find((s) => s.key === 'other')!.gb).toBeCloseTo(4, 5)
  })

  it('buildBreakdown:剩余恰好 0.05 GB 不追加 other(边界是严格大于)', () => {
    const GB = 1024 ** 3
    const segs = buildBreakdown(
      { photosBytes: GB, videosBytes: 0, rawBytes: 0, cacheBytes: 0, aiBytes: 0 },
      1.05,
    )
    expect(segs.map((s) => s.key)).not.toContain('other')
  })

  it('buildBreakdown:负数字节按 0 处理(Vue2 :317 的 Math.max(0, b))', () => {
    const segs = buildBreakdown(
      { photosBytes: -1, videosBytes: 0, rawBytes: 0, cacheBytes: 0, aiBytes: 0 },
      0,
    )
    expect(segs.find((s) => s.key === 'photos')!.gb).toBe(0)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm exec vitest run src/photos/components/__tests__/PhotosStorageCard.test.ts --reporter=verbose`
Expected: FAIL — 找不到 `../../util/storagePalette`

- [ ] **Step 3: 实现 `storagePalette.ts`**

```ts
// src/photos/util/storagePalette.ts
//
// 存储条的分段调色板。照 D5 / PLACE_PALETTE(P5-T12)/ placesMapThemes.ts(P6a)的既定先例:
// **数据可视化调色板**归 docs/THEMING.md 第三类例外 —— 色值集中在 .ts 常量里、进例外清单,
// 而不是散落在 <style> 块里(那会被 color-guard 判红,且 color-guard 不剥注释)。
// photos 段与 thumbs 段直接引用既有语义 token;其余三段是 Vue2 内联的品牌区分色,
// 在本仓无对应语义 token,作为可视化调色板保留。
export const STORAGE_SEG_COLORS = {
  photos: 'var(--accent)',
  videos: 'var(--photos-seg-video)',
  raw: 'var(--photos-seg-raw)',
  thumbs: 'var(--success)',
  ai: 'var(--photos-seg-ai)',
  other: 'var(--photos-seg-other)',
} as const

export type StorageSegKey = keyof typeof STORAGE_SEG_COLORS

export interface StorageSeg { key: StorageSegKey; gb: number; color: string }

export interface StorageBytes {
  photosBytes: number; videosBytes: number; rawBytes: number
  cacheBytes: number; aiBytes: number
}

// Vue2 PhotosSettings.vue:382
export function fmtGB(g: number): string {
  return g >= 100 ? g.toFixed(0) : g.toFixed(1)
}

// Vue2 PhotosSettings.vue:405-413
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const
export function fmtBytes(b: number): string {
  if (!b || b <= 0) return '0 B'
  let i = 0
  let v = b
  while (v >= 1024 && i < BYTE_UNITS.length - 1) { v /= 1024; i++ }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${BYTE_UNITS[i]}`
}

// Vue2 PhotosSettings.vue:313-330 —— 段序固定;other 段只在「已用总量减去已知段合计」
// 严格大于 0.05 GB 时追加(小于这个量的零头不值得画一段)。
const OTHER_THRESHOLD_GB = 0.05
export function buildBreakdown(bytes: StorageBytes, usedGB: number): StorageSeg[] {
  const gb = (b: number): number => Math.max(0, b) / 1024 ** 3
  const segs: StorageSeg[] = [
    { key: 'photos', gb: gb(bytes.photosBytes), color: STORAGE_SEG_COLORS.photos },
    { key: 'videos', gb: gb(bytes.videosBytes), color: STORAGE_SEG_COLORS.videos },
    { key: 'raw', gb: gb(bytes.rawBytes), color: STORAGE_SEG_COLORS.raw },
    { key: 'thumbs', gb: gb(bytes.cacheBytes), color: STORAGE_SEG_COLORS.thumbs },
    { key: 'ai', gb: gb(bytes.aiBytes), color: STORAGE_SEG_COLORS.ai },
  ]
  const known = segs.reduce((a, s) => a + s.gb, 0)
  const other = Math.max(0, usedGB - known)
  if (other > OTHER_THRESHOLD_GB) segs.push({ key: 'other', gb: other, color: STORAGE_SEG_COLORS.other })
  return segs
}
```

在 `src/styles/theme.css` 的**两套主题块**里都加 `--photos-seg-video` / `--photos-seg-raw` / `--photos-seg-ai` / `--photos-seg-other` 四个 token(取值:深色照 Vue2 原值,浅色按可读性微调),并在 `docs/THEMING.md` 第三类例外清单登记 4 条。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm exec vitest run src/photos/components/__tests__/PhotosStorageCard.test.ts --reporter=verbose`
Expected: PASS 5/5

- [ ] **Step 5: 写组件的失败测试**

```ts
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import PhotosStorageCard from '../PhotosStorageCard.vue'
import { usePhotosSettingsStore } from '../../stores/settings'

const GB = 1024 ** 3
function mountCard(overrides: Record<string, unknown> = {}) {
  const wrapper = mount(PhotosStorageCard, {
    global: { plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: true })] },
  })
  const s = usePhotosSettingsStore()
  s.storage = {
    diskTotalBytes: 100 * GB, diskFreeBytes: 40 * GB, prunableBytes: 512 * 1024 * 1024,
    photosBytes: 30 * GB, videosBytes: 20 * GB, rawBytes: 5 * GB, cacheBytes: 2 * GB, aiBytes: GB,
    ...overrides,
  }
  return { wrapper, s }
}

describe('PhotosStorageCard', () => {
  it('storageError 时大数字位显示破折号 + 不可用副行', async () => {
    const { wrapper, s } = mountCard()
    s.storage = null
    s.storageError = true
    await nextTick()
    expect(wrapper.get('[data-test="storage-headline"]').text()).toContain('—')
    expect(wrapper.text()).toContain('不可用') // 照 json 实际文案调整
  })

  it('retention 5 档,当前档带 data-active', async () => {
    const { wrapper, s } = mountCard()
    s.retentionDays = 30
    await nextTick()
    const btns = wrapper.findAll('[data-test="retention-seg"] button')
    expect(btns).toHaveLength(5)
    expect(btns.filter((b) => b.attributes('data-active') === 'true')).toHaveLength(1)
    expect(btns[2].attributes('data-active')).toBe('true') // [7,15,30,60,90] 的第三档
  })

  it('点 retention 档位调 setRetention;失败时 emit toast', async () => {
    const { wrapper, s } = mountCard()
    vi.mocked(s.setRetention).mockResolvedValue(false)
    await wrapper.findAll('[data-test="retention-seg"] button')[4].trigger('click')
    expect(s.setRetention).toHaveBeenCalledWith(90)
    await flushPromises()
    expect(wrapper.emitted('toast')).toBeTruthy()
  })

  it('scanInterval 5 档,off 档的值是 0 且走 i18n(其余四档是单位缩写字面量)', async () => {
    const { wrapper } = mountCard()
    const btns = wrapper.findAll('[data-test="scan-seg"] button')
    expect(btns).toHaveLength(5)
    expect(btns.map((b) => b.text())).toEqual([
      expect.not.stringMatching(/^\d/), '6h', '12h', '24h', '7d',
    ])
  })

  it('缓存按钮:prunableBytes 为 0 时禁用', async () => {
    const { wrapper, s } = mountCard()
    s.storage = { ...s.storage!, prunableBytes: 0 }
    await nextTick()
    expect(wrapper.get('[data-test="clear-cache"]').attributes('disabled')).toBeDefined()
  })

  it('清缓存成功后重拉 storage(Vue2 :423)', async () => {
    const { wrapper, s } = mountCard()
    vi.mocked(s.pruneCache).mockResolvedValue(1024 * 1024)
    await wrapper.get('[data-test="clear-cache"]').trigger('click')
    await flushPromises()
    expect(s.fetchStorage).toHaveBeenCalled()
  })

  it('容量条段数 = breakdown 段数 + 1 个 free 段', async () => {
    const { wrapper } = mountCard()
    await nextTick()
    expect(wrapper.findAll('[data-test="bar-seg"]').length).toBeGreaterThanOrEqual(5)
    expect(wrapper.findAll('[data-test="bar-free"]')).toHaveLength(1)
  })
})
```

- [ ] **Step 6: 运行确认失败,实现组件**

组件用 `<script setup lang="ts">`。样式落在组件的 `<style scoped>` 里,**颜色全部走 token / palette 常量**。分段器按钮的 `[data-active]` 变体**必须自带 `:hover` 规则**(本区已栽四次)。

- [ ] **Step 7: 运行组件测试 + hover 级联守卫**

新增一条守卫,用 `src/photos/components/__tests__/cssCascade.ts` 算优先级,断言 `[data-active]` 变体的 hover 背景胜出且胜出选择器含 `:hover`:

```ts
import { winningDeclaration } from './cssCascade'
it('分段器 data-active 变体自带 hover 背景,且胜出选择器含 :hover(本区已栽四次)', () => {
  const css = readComponentStyle('PhotosStorageCard.vue') // 用 node:fs 读,并断言非空
  expect(css.length).toBeGreaterThan(0)
  const win = winningDeclaration(css, ['seg-btn', 'seg-btn'], 'background', { hover: true, dataActive: true })
  expect(win.selector).toContain(':hover')
  expect(win.selector).toContain('[data-active]')
})
```

- [ ] **Step 8: 变异验证 + Commit**

变异验证:①把 `OTHER_THRESHOLD_GB` 的 `>` 改成 `>=` → 边界用例应变红 ②删掉 `fetchStorage()` 重拉 → 对应用例应变红 ③删掉 `[data-active]:hover` 规则 → 级联守卫应变红。

```bash
git add src/photos/util/storagePalette.ts src/photos/components/PhotosStorageCard.vue \
        src/photos/components/__tests__/PhotosStorageCard.test.ts src/styles/theme.css docs/THEMING.md
git commit -m "feat(photos): 设置页存储卡(P8a-T3)"
```

---

