## Task 3: 详情页交互 —— 加照片 / 多选移除 / pin 角标 / 已排除

**Files:**
- Modify: `src/views/PhotosSmartViewDetail.vue`
- Test: `src/views/PhotosSmartViewDetail.assets.test.ts`（新建；既有该页测试文件不动）
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `store.pinAssets` / `removeAssets` / `restoreAssets` / `loadExcluded` / `excluded` / `assetBusy`（Task 1）· `PhotosLibraryPicker`（Task 2）· `useToast`
- Produces: 无新导出

**新增 i18n 键**（两个 locale 都加；中文取自 Vue2 `zh_CN.json`，**不要自己译**）：

| 键 | zh_cn | en_us |
|---|---|---|
| `photosSvAddPhotos` | `加照片` | `Add photos` |
| `photosSvRemoveFromView` | `从此视图移除` | `Remove from this view` |
| `photosSvRemovedNFromView` | `已从此视图移除 {n} 张` | `Removed {n} from this view` |
| `photosSvExcludedN` | `已排除（{n}）` | `Excluded ({n})` |
| `photosSvAlreadyInView` | `已在此视图` | `Already in this view` |
| `photosSvPinnedNToView` | `已钉住 {n} 张到此视图` | `Pinned {n} to this view` |
| `photosSvRestoreFailed` | `恢复失败` | `Restore failed` |
| `photosSvRemoveFailed` | `移除失败` | `Remove failed` |
| `photosSvAddFailed` | `添加失败` | `Add failed` |
| `photosSvShow` | `显示` | `Show` |
| `photosSvHide` | `隐藏` | `Hide` |
| `photosSvRestore` | `恢复` | `Restore` |

**必须复用、不要新建的既有键**（写作本计划时已逐个 grep 核对，取值如下）：

| 用途 | 键 | 现有中文取值 | 注意 |
|---|---|---|---|
| Select 按钮 | `photosPersonSelect` | `选择` | P1 的 `PhotosMomentDetail.vue` 用的就是这个 |
| Cancel 按钮 | `photosCancel` | `取消` | |
| 「{n} 已选」 | `photosSelectedCount` | `已选择 {count} 项` | **参数名是 `count` 不是 `n`** —— 传 `{ count: … }`，传 `n` 会渲染出字面量 |
| picker 标题 | `photosAlbumPickerTitle` | `添加照片到「{name}」` | Vue2 本来就是一个字符串喂两个 picker |
| picker 提交按钮 | `photosAlbumPickerAdd` | `添加({count})` | 走**函数形态**，见下 |

`submitLabel` 必须传函数（照 `src/views/PhotosAlbums.vue:171-173` 的既有写法，那样计数才会
跟着选择动）:

```ts
function pickerSubmitLabel(count: number): string {
  return t('photosAlbumPickerAdd', { count })
}
```

- [ ] **Step 1: 写失败的测试**

新建 `src/views/PhotosSmartViewDetail.assets.test.ts`：

```ts
// SP15-P2a-T3: the manual asset interactions on the smart view detail page.
// Target is Vue 2 899af59b:src/views/Photos/PhotosSmartViewDetail.vue.
// Note the device reality this cannot cover: producing an excluded row requires
// removing an *automatically matched* asset, and every smart view on the test
// device is semantic, paused and never evaluated — see the design doc's §2.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string, size: string) => `mock://${id}/${size}`),
    listSmartViews: vi.fn(async () => []),
    getSmartView: vi.fn(async () => ({})),
    getSmartViewAssets: vi.fn(async () => []),
    getSmartViewActivity: vi.fn(async () => []),
    getSmartViewExcluded: vi.fn(async () => []),
    pinSmartViewAssets: vi.fn(async () => ({ added: 0 })),
    removeSmartViewAssets: vi.fn(async () => ({ unpinned: 0, excluded: 0 })),
    restoreSmartViewAssets: vi.fn(async () => ({ restored: 0 })),
    listAlbums: vi.fn(async () => []),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosSmartViewDetail from './PhotosSmartViewDetail.vue'
import { usePhotosSmartViews } from '../photos/stores/smartViews'
import { useToast } from '../stores/toast'

const SV = {
  id: 'sv1', name: 'Hiking', description: '', conds: ['a'], threshold: 80,
  live: true, includeVideos: false, count: 3, addedThisWeek: 0, seeds: [],
  median: 0, storageBytes: 0, distribution: new Array(10).fill(0), evaluatedAt: '',
}

async function mountPage() {
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
      { path: '/photos/smart-views/:id', name: 'photos-smart-view-detail', component: PhotosSmartViewDetail },
    ],
  })
  await router.push('/photos/smart-views/sv1')
  await router.isReady()
  const w = mount(PhotosSmartViewDetail, { global: { plugins: [router] } })
  await new Promise((r) => setTimeout(r, 0))
  return { w, router }
}

function seed() {
  const s = usePhotosSmartViews()
  s.smartViews = [{ ...SV }]
  s.listLoaded = true
  s.matchedAssets = [
    { id: 'a1', pinned: true }, { id: 'a2', pinned: false },
  ] as never
  return s
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('pin badge', () => {
  it('marks only the pinned tiles', async () => {
    seed()
    const { w } = await mountPage()
    expect(w.findAll('[data-test="sv-pin-tag"]')).toHaveLength(1)
  })
})

describe('add photos', () => {
  it('opens the picker, pins what it confirms, and reports the count it was told', async () => {
    const s = seed()
    const pin = vi.spyOn(s, 'pinAssets').mockResolvedValue(2)
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountPage()

    await w.find('[data-test="sv-add-photos"]').trigger('click')
    w.findComponent({ name: 'PhotosLibraryPicker' }).vm.$emit('confirm', ['x', 'y'])
    await new Promise((r) => setTimeout(r, 0))

    expect(pin).toHaveBeenCalledWith('sv1', ['x', 'y'])
    expect(show).toHaveBeenCalled()
  })

  it('reports a failure and keeps the picker open so the user can retry', async () => {
    const s = seed()
    vi.spyOn(s, 'pinAssets').mockRejectedValue(new Error('nope'))
    const toast = useToast(); const show = vi.spyOn(toast, 'show')
    const { w } = await mountPage()
    await w.find('[data-test="sv-add-photos"]').trigger('click')
    w.findComponent({ name: 'PhotosLibraryPicker' }).vm.$emit('confirm', ['x'])
    await new Promise((r) => setTimeout(r, 0))
    expect(show).toHaveBeenCalledWith(expect.any(String), expect.anything(), 'danger')
    expect(w.findComponent({ name: 'PhotosLibraryPicker' }).props('open')).toBe(true)
  })

  it('hands the picker the ids already in the view, String()-normalised', async () => {
    const s = seed()
    s.matchedAssets = [{ id: 5 }] as never
    const { w } = await mountPage()
    await w.find('[data-test="sv-add-photos"]').trigger('click')
    const ids = w.findComponent({ name: 'PhotosLibraryPicker' }).props('existingIds') as Set<string>
    expect([...ids]).toContain('5')
  })
})

describe('selection and removal', () => {
  it('suppresses the lightbox while selecting, and shows the count', async () => {
    seed()
    const { w } = await mountPage()
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    expect(w.find('[data-test="sv-select-bar"]').text()).toContain('1')
  })

  it('removes the selection, then leaves selection mode', async () => {
    const s = seed()
    const remove = vi.spyOn(s, 'removeAssets').mockResolvedValue({ unpinned: 1, excluded: 0 })
    const { w } = await mountPage()
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    await w.find('[data-test="sv-remove-selected"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(remove).toHaveBeenCalledWith('sv1', ['a1'])
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(false)
  })

  it('keeps the selection on failure so the user can retry', async () => {
    const s = seed()
    vi.spyOn(s, 'removeAssets').mockRejectedValue(new Error('nope'))
    const { w } = await mountPage()
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    await w.find('[data-test="sv-remove-selected"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(true)
  })

  it('leaving selection mode clears what was selected', async () => {
    seed()
    const { w } = await mountPage()
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.findAll('[data-test="sv-all-tile"]')[0].trigger('click')
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    await w.find('[data-test="sv-select-toggle"]').trigger('click')
    expect(w.find('[data-test="sv-select-bar"]').exists()).toBe(false)
  })
})

describe('excluded section', () => {
  it('stays hidden when nothing is excluded', async () => {
    seed()
    const { w } = await mountPage()
    expect(w.find('[data-test="sv-excluded-head"]').exists()).toBe(false)
  })

  it('appears with a count once there are excluded assets, collapsed by default', async () => {
    const s = seed()
    s.excluded = [{ id: 'e1' }, { id: 'e2' }] as never
    const { w } = await mountPage()
    expect(w.find('[data-test="sv-excluded-head"]').text()).toContain('2')
    expect(w.find('[data-test="sv-excluded-grid"]').exists()).toBe(false)
  })

  it('expands on click and restores a photo when one is clicked', async () => {
    const s = seed()
    s.excluded = [{ id: 'e1' }] as never
    const restore = vi.spyOn(s, 'restoreAssets').mockResolvedValue(1)
    const { w } = await mountPage()
    await w.find('[data-test="sv-excluded-head"]').trigger('click')
    await w.find('[data-test="sv-excluded-tile"]').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(restore).toHaveBeenCalledWith('sv1', ['e1'])
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/views/PhotosSmartViewDetail.assets.test.ts --reporter=verbose`
Expected: FAIL —— `[data-test="sv-add-photos"]` 找不到

- [ ] **Step 3: 先加 i18n 键，再改页面**

先在两个 locale 文件加上表格里的键（放在既有 `photosSv*` 块内，新起一段注释
`// ── SP15-P2a: manual asset actions ──`）。

`src/views/PhotosSmartViewDetail.vue` 的 `<script setup>` 追加：

```ts
import PhotosLibraryPicker from '../photos/components/PhotosLibraryPicker.vue'

const pickerOpen = ref(false)
const selecting = ref(false)
const selectedIds = ref<string[]>([])
const excludedOpen = ref(false)

// The ids the picker must show as already-in. Normalising with String() here is
// load-bearing: album/asset ids arrive from the API as numbers on some paths while
// timeline photo ids are strings, and a mismatch silently un-dims every tile.
const viewAssetIds = computed(() => new Set(store.matchedAssets.map((p) => String(p.id))))

function toggleSelecting(): void {
  selecting.value = !selecting.value
  if (!selecting.value) selectedIds.value = []
}

function toggleSelect(id: string): void {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((x) => x !== id)
    : [...selectedIds.value, id]
}

async function onPickPhotos(assetIds: Array<string | number>): Promise<void> {
  const ids = assetIds.map(String)
  try {
    const n = await store.pinAssets(svId.value, ids)
    toast.show(t('photosSvPinnedNToView', { n }))
    pickerOpen.value = false
    await store.loadDetail(svId.value)
  } catch (e) {
    console.error('[photos-smartviews] pinAssets', e)
    // The picker deliberately stays open on failure — the user still has their
    // selection and can retry without re-picking.
    toast.show(t('photosSvAddFailed'), 2500, 'danger')
  }
}

async function removeSelected(): Promise<void> {
  const ids = selectedIds.value.slice()
  if (!ids.length) return
  try {
    const r = await store.removeAssets(svId.value, ids)
    toast.show(t('photosSvRemovedNFromView', { n: r.unpinned + r.excluded }))
    // Cleared only on success, matching Vue 2: on failure the selection is what the
    // user needs in order to retry.
    selecting.value = false
    selectedIds.value = []
    await Promise.all([store.loadDetail(svId.value), store.loadExcluded(svId.value)])
  } catch (e) {
    console.error('[photos-smartviews] removeAssets', e)
    toast.show(t('photosSvRemoveFailed'), 2500, 'danger')
  }
}

async function restoreOne(id: string): Promise<void> {
  try {
    await store.restoreAssets(svId.value, [id])
    await Promise.all([store.loadDetail(svId.value), store.loadExcluded(svId.value)])
  } catch (e) {
    console.error('[photos-smartviews] restoreAssets', e)
    toast.show(t('photosSvRestoreFailed'), 2500, 'danger')
  }
}
```

`onTileClick` 改成选择态优先（**照 Vue2**：选择态下点瓦片只切选中，不开灯箱）：
在函数最前面加

```ts
  if (selecting.value) { toggleSelect(String(p.id)); return }
```

在 `onMounted` 与 `watch(svId, …)` 里，除既有的 `store.loadDetail(...)` 之外追加
`void store.loadExcluded(svId.value)`；切 `:id` 时同时重置 `selecting` / `selectedIds` /
`pickerOpen` / `excludedOpen`（**P1 终审在同型问题上逮到过跨条目误删** —— 选择态跨
智能视图存活会把 A 的照片 id 发给 B 的移除接口）。

模板改动：

- 工具条那一行（`sv-action-pause` 所在的按钮组）里追加两个按钮：
  `data-test="sv-add-photos"`（`t('photosSvAddPhotos')`，点击 `pickerOpen = true`）与
  `data-test="sv-select-toggle"`（`selecting ? t('photosCancel') : t('photosPersonSelect')`，
  点击 `toggleSelecting`）
- 两个网格的 `<div class="tile">` 上：加 `:data-selected="selecting && selectedIds.includes(String(p.id))"`；
  内部加 `<div v-if="p.pinned" class="sv-pin-tag" data-test="sv-pin-tag">`（pin 图标）与
  选中态的勾选角标
- 「全部匹配」网格之后插入「已排除」分节：

```vue
          <template v-if="store.excluded.length">
            <div class="sv-section-head sv-excluded-head" data-test="sv-excluded-head" @click="excludedOpen = !excludedOpen">
              {{ t('photosSvExcludedN', { n: store.excluded.length }) }}
              <span class="pill">{{ excludedOpen ? t('photosSvHide') : t('photosSvShow') }}</span>
            </div>
            <div v-if="excludedOpen" class="sv-grid-photos sv-excluded-grid" data-test="sv-excluded-grid">
              <div
                v-for="p in store.excluded" :key="p.id" class="tile"
                data-test="sv-excluded-tile" @click="restoreOne(String(p.id))"
              >
                <img :src="service.photos.thumbnailUrl(p.id, 'large')" alt="" loading="lazy">
                <div class="sv-restore-hint">{{ t('photosSvRestore') }}</div>
              </div>
            </div>
          </template>
```

- 选择栏（照 Vue2 `sv-select-bar`）：

```vue
    <div v-if="selecting && selectedIds.length" class="sv-select-bar" data-test="sv-select-bar">
      <span>{{ t('photosSelectedCount', { count: selectedIds.length }) }}</span>
      <button type="button" class="sv-action-btn" data-test="sv-remove-selected" :disabled="store.assetBusy" @click="removeSelected">
        {{ t('photosSvRemoveFromView') }}
      </button>
    </div>
```

- 页面末尾挂 picker：

```vue
    <PhotosLibraryPicker
      :open="pickerOpen"
      :title="t('photosAlbumPickerTitle', { name: sv?.name ?? '' })"
      :existing-ids="viewAssetIds"
      :existing-label="t('photosSvAlreadyInView')"
      :submit-label="pickerSubmitLabel"
      :submitting="store.assetBusy"
      @update:open="pickerOpen = $event"
      @confirm="onPickPhotos"
    />
```

样式照 Vue2 `photos-smartview.scss` 的 `#79` 增量（`.sv-pin-tag` / `.sv-tile-check` /
`.sv-excluded-head` / `.sv-restore-hint` / `.sv-select-bar`），**颜色一律 token**；压在照片上的
角标前景色照 `PhotosMomentDetail.vue` 的 pin 角标先例写 `theme-exception`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/views/PhotosSmartViewDetail.assets.test.ts src/views/__tests__/PhotosSmartViewDetail.test.ts src/i18n/parity.test.ts --reporter=verbose`
Expected: PASS，**且既有该页测试条数不减**

> 既有页面测试若因为新增的 `getSmartViewExcluded` 调用而打印吞掉的错误，
> 给那个文件的 service mock 补上 `getSmartViewExcluded: vi.fn(async () => [])`
> —— 只补这一行，别动它的断言（P1 的 Task 5 是同款处置）。

- [ ] **Step 5: 类型检查、样式守卫与提交**

```bash
pnpm exec vue-tsc --noEmit
pnpm exec vitest run src/styles
```

```bash
git add src/views/PhotosSmartViewDetail.vue src/views/PhotosSmartViewDetail.assets.test.ts \
        src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): let a smart view's photos be pinned, removed and restored

A smart view is generated from conditions, so the manual actions are annotations
on top of that: pinning adds a photo the conditions missed, removing either
unpins one or excludes it, and the excluded band is what makes the second case
reversible rather than silent.

The excluded band stays collapsed until asked for. It is a record of past
decisions, not part of the view."
```

---

