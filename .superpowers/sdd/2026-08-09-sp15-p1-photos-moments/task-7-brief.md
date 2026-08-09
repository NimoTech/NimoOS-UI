## Task 7: 路由 + 详情页骨架

**Files:**
- Modify: `src/router/index.ts`
- Create: `src/views/PhotosMomentDetail.vue`
- Test: `src/views/PhotosMomentDetail.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`

**Interfaces:**
- Consumes: `usePhotosMoments`（Task 3）· `relTime`（既有 `src/photos/util/relTime.ts`）
- Produces: 路由 `photos-moment-detail` at `/photos/moments/:id`；组件内部 `momentAssetCount` / `places` 等状态给 Task 8/9/10 续接

**新增 i18n 键**（节选，其余见 Step 3 表）：`photosMoBackToAll` · `photosMoLastUpdated` · `photosMoNotFound` · `photosMoAbout` · `photosMoStats` · `photosMoType` · `photosMoTime` · `photosMoPlace` · `photosMoByMonth` · `photosMoSpan` · `photosMoSpanDays` · `photosMoLastUpdate` · `photosMoPhotos` · `photosMoFeatured`

- [ ] **Step 1: 写失败的测试**

新建 `src/views/PhotosMomentDetail.test.ts`：

```ts
// SP15-P1-T7: 时刻详情页骨架。靶子 Vue2 899af59b:PhotosMomentDetail.vue:1-121(顶栏 +
// 两栏 + About/Stats/By month)与 :203-291(computed)。
// ★ 本页是 New-UI 独有的**路由页**(Vue2 是内联子组件),因此多出一条 Vue2 不存在的路径:
//   冷深链 —— 后端没有 GET /moments/:id,必须回落到拉全量列表再按 id 查。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHashHistory } from 'vue-router'
import zh from '../i18n/zh_cn'
import en from '../i18n/en_us'

const svc = vi.hoisted(() => ({
  photos: {
    thumbnailUrl: vi.fn((id: string, size: string) => `mock://${id}/${size}`),
    listMoments: vi.fn(async () => []),
    getMomentAssets: vi.fn(async () => []),
  },
}))
vi.mock('@nimotech/nimoos-service', () => ({ service: svc }))

import PhotosMomentDetail from './PhotosMomentDetail.vue'
import { usePhotosMoments, type Moment } from '../photos/stores/moments'

const RAW = {
  id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', cover_asset_id: 'c1',
  asset_count: 42, time_from: '2016-11-20T00:00:00Z', time_to: '2016-11-22T00:00:00Z',
  place: 'Bozeman', recipe_key: 'trip:1', featured_asset_ids: ['f1'],
  added_this_week: 3, cover_ratio: 1.5,
}

function makeMoment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1', title: 'Bozeman', subtitle: 'Nov 2016', place: 'Bozeman',
    recipeKey: 'trip:1', coverAssetId: 'c1', featuredAssetIds: ['f1'],
    assetCount: 42, addedThisWeek: 3, coverRatio: 1.5,
    timeFrom: '2016-11-20T00:00:00Z', timeTo: '2016-11-22T00:00:00Z', updatedAt: '', ...over,
  }
}

async function mountDetail(id = 'm1', locale: 'zh_cn' | 'en_us' = 'en_us') {
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/photos/smart-views', name: 'photos-smart-views', component: { template: '<div/>' } },
      { path: '/photos/moments/:id', name: 'photos-moment-detail', component: PhotosMomentDetail },
    ],
  })
  await router.push('/photos/moments/' + id)
  await router.isReady()
  const i18n = createI18n({ legacy: false, locale, messages: { zh_cn: zh, en_us: en } })
  const w = mount(PhotosMomentDetail, { global: { plugins: [i18n, router] } })
  await new Promise((r) => setTimeout(r, 0))
  return { w, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('冷深链(New-UI 独有路径 —— 后端无 GET /moments/:id)', () => {
  it('store 为空时拉全量列表再按 id 查出这一条', async () => {
    svc.photos.listMoments.mockResolvedValueOnce([RAW])
    const { w } = await mountDetail('m1')
    expect(svc.photos.listMoments).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('Bozeman')
  })

  it('store 已有该条时不再拉列表', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment()]
    s.listLoaded = true
    await mountDetail('m1')
    expect(svc.photos.listMoments).not.toHaveBeenCalled()
  })

  it('列表拉完仍查无此条时渲染"时刻不存在",不是空白页', async () => {
    svc.photos.listMoments.mockResolvedValueOnce([])
    const { w } = await mountDetail('nope')
    expect(w.find('[data-test="mo-not-found"]').exists()).toBe(true)
  })
})

describe('顶栏与头部', () => {
  it('返回按钮回智能视图页', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w, router } = await mountDetail()
    await w.find('[data-test="mo-back"]').trigger('click')
    expect(router.currentRoute.value.path).toBe('/photos/smart-views')
  })

  it('后端不发 updated_at ⇒ 顶栏与 Stats 的更新时间都显示占位符', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-last-updated"]').text()).toContain('—')
  })

  it('addedThisWeek 为 0 时不渲染绿色徽标', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment({ addedThisWeek: 0 })]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('.mo-week-badge').exists()).toBe(false)
  })
})

describe('About 侧栏', () => {
  it('时间窗:首尾同日时只显示一个日期', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ timeFrom: '2016-11-20T01:00:00Z', timeTo: '2016-11-20T09:00:00Z' })]
    s.listLoaded = true
    const { w } = await mountDetail()
    const txt = w.find('[data-test="mo-about-time"]').text()
    expect(txt).not.toContain('–')
  })

  it('时间窗缺失时回落 subtitle,subtitle 也没有才用占位符', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ timeFrom: '', timeTo: '', subtitle: 'Nov 2016' })]
    s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-about-time"]').text()).toContain('Nov 2016')
  })

  it('places 非空时取前三个城市名,超出三个补 +N', async () => {
    svc.photos.getMomentAssets.mockResolvedValue({
      assets: [], members: [],
      places: [{ name: 'A', count: 9 }, { name: 'B', count: 8 }, { name: 'C', count: 7 }, { name: 'D', count: 1 }],
    })
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-about-place"]').text()).toBe('A · B · C +1')
  })

  it('places 为空时回落 moment.place', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment({ place: 'Bozeman' })]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-about-place"]').text()).toBe('Bozeman')
  })

  it('places 与 place 都没有时,行仍然渲染并显示占位符(不整行隐藏)', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment({ place: '' })]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-about-place"]').text()).toBe('—')
  })
})

describe('Stats 与月份分布', () => {
  it('跨度按首尾日期算,含头含尾', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ timeFrom: '2016-11-20T00:00:00Z', timeTo: '2016-11-22T00:00:00Z' })]
    s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-stat-span"]').text()).toContain('3')
  })

  it('缺时间窗时跨度显示占位符', async () => {
    const s = usePhotosMoments(); s.moments = [makeMoment({ timeFrom: '', timeTo: '' })]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-stat-span"]').text()).toContain('—')
  })

  it('月份直方图按 YYYY-MM 分桶并升序;无 takenAt 的照片被跳过', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, featured: boolean) =>
      featured ? { assets: [], members: [], places: [] }
        : [
          { id: 'a', takenAt: '2016-12-02T00:00:00Z' },
          { id: 'b', takenAt: '2016-11-20T00:00:00Z' },
          { id: 'c', takenAt: '2016-11-21T00:00:00Z' },
          { id: 'd' },
        ],
    )
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    const bars = w.findAll('[data-test="mo-dist-bar"]')
    expect(bars).toHaveLength(2)
    expect(bars[0].attributes('title')).toContain('2')  // 11 月两张,排在前
  })

  it('没有任何 takenAt 时整个 By month 分节不渲染', async () => {
    svc.photos.getMomentAssets.mockImplementation(async (_id: string, featured: boolean) =>
      featured ? { assets: [], members: [], places: [] } : [{ id: 'a' }])
    const s = usePhotosMoments(); s.moments = [makeMoment()]; s.listLoaded = true
    const { w } = await mountDetail()
    expect(w.find('[data-test="mo-dist"]').exists()).toBe(false)
  })
})

describe('路由参数变化', () => {
  it('只改 :id 不重挂载时也要重新拉数据(watch 盯 route.params.id)', async () => {
    const s = usePhotosMoments()
    s.moments = [makeMoment({ id: 'm1' }), makeMoment({ id: 'm2', title: 'Other' })]
    s.listLoaded = true
    const { w, router } = await mountDetail('m1')
    svc.photos.getMomentAssets.mockClear()
    await router.push('/photos/moments/m2')
    await new Promise((r) => setTimeout(r, 0))
    expect(w.text()).toContain('Other')
    expect(svc.photos.getMomentAssets).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts --reporter=verbose`
Expected: FAIL —— 找不到 `./PhotosMomentDetail.vue`

- [ ] **Step 3: 实现**

新增 i18n 键（两侧都加）：

| 键 | zh_cn | en_us |
|---|---|---|
| `photosMoBackToAll` | `全部时刻` | `All Moments` |
| `photosMoLastUpdated` | `最后更新 {time}` | `Last updated {time}` |
| `photosMoNotFound` | `找不到这个时刻` | `This moment no longer exists` |
| `photosMoAbout` | `关于` | `About` |
| `photosMoStats` | `统计` | `Stats` |
| `photosMoType` | `类型` | `Type` |
| `photosMoTime` | `时间` | `Time` |
| `photosMoPlace` | `地点` | `Place` |
| `photosMoByMonth` | `按月份` | `By month` |
| `photosMoSpan` | `跨度` | `Span` |
| `photosMoSpanDays` | `{n} 天` | `{n} days` |
| `photosMoLastUpdate` | `最后更新` | `Last update` |
| `photosMoPhotos` | `照片` | `Photos` |
| `photosMoFeatured` | `精选` | `Featured` |

新建 `src/views/PhotosMomentDetail.vue`。要点（完整实现照下述结构写）：

```vue
<script setup lang="ts">
// SP15-P1-T7: PhotosMomentDetail.vue —— 时刻详情页(路由 /photos/moments/:id)。
// 逐段照 Vue2 NimoOS-UI 899af59b:src/views/Photos/PhotosMomentDetail.vue 移植;
// 复用 PhotosSmartViewDetail.vue 已有的 sv-detail-* 两栏骨架与样式类(Vue2 那边就是
// 这么复用的,顶栏注释原话 "same as sv-detail-bar")。
//
// ★★★ 与 Vue2 的结构性差异,读完再改 ★★★
// Vue2 这页是 PhotosSmartViewsView 的内联子组件,moment 对象由父组件当 prop 传进来,
// 所以它没有、也不需要"查无此条"这条路径。New-UI 是真路由:用户手改地址栏、点旧书签、
// 分区隐藏时直接访问,都会走到这里。而**后端没有 GET /moments/:id**
// (NimoOS-Photos/route/router.go 只有 GET /moments 全量与 GET /moments/:id/assets),
// 所以冷深链只能拉全量列表再按 id 查 —— 这就是 ensureLoaded() + byId() 的由来。
//
// 偏离登记:
//  1) 「查无此条」空态是 New-UI 新增(理由见上),Vue2 无对应物。
//  2) 后端 momentResponse **不含 updated_at**(已回源核对 route/v1/moments.go:39-73),
//     所以 Vue2 的 lastUpdated 恒为 '—'。这里保持同样的渲染结果,不引入永远不会命中的
//     relTime 分支;字段留在类型里是为后端将来补上时无需改类型。
//  3) 关闭 more 菜单的 document mousedown 监听照抄 Vue2 mounted/beforeDestroy,
//     换成 onMounted/onBeforeUnmount。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AreaShell from '../components/shell/AreaShell.vue'
import PhotosSidebar from '../photos/components/PhotosSidebar.vue'
import { usePhotosMoments, type MomentMember, type MomentPlace } from '../photos/stores/moments'
import type { Photo } from '../photos/util/assetToPhoto'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const store = usePhotosMoments()

const momentId = computed(() => String(route.params.id ?? ''))
const moment = computed(() => store.byId(momentId.value))
const notFound = computed(() => store.listLoaded && !moment.value)

const featuredAssets = ref<Photo[]>([])
const allAssets = ref<Photo[]>([])
const allLoading = ref(false)
const manualIds = ref<Set<string>>(new Set())
const places = ref<MomentPlace[]>([])

// 过期守卫(Global Constraints §6):切 :id 时旧请求可能后返回。
let loadEpoch = 0

async function load(): Promise<void> {
  const epoch = ++loadEpoch
  await store.ensureLoaded()
  if (epoch !== loadEpoch || !moment.value) return
  allLoading.value = true
  try {
    const [detail, all] = await Promise.all([
      store.loadDetail(momentId.value),
      store.loadAll(momentId.value),
    ])
    if (epoch !== loadEpoch) return
    featuredAssets.value = detail.assets
    manualIds.value = new Set(detail.members.filter((m: MomentMember) => m.manual).map((m) => m.assetId))
    places.value = detail.places
    allAssets.value = all
  } catch (e) {
    console.error('[photos-moments] load detail', e)
  } finally {
    if (epoch === loadEpoch) allLoading.value = false
  }
}

onMounted(load)
// 只改 query/params 不 remount —— 必须 watch,不能只写在 onMounted 里(本仓既有教训)。
watch(momentId, () => { void load() })
</script>
```

模板与 computed 的其余部分逐条照 Vue2：
- `momentAssetCount` = `moment.assetCount`（Task 3 已把它收进 store，不再是本地副本）
- `typeLabel` / `timeWindowLabel` / `spanDays` / `spanLabel` / `monthBuckets` / `distMax` / `distStyle` / `placesLabel` / `placesTitle` —— 全部照 Vue2 `:203-291` 与 `:418-421`，**locale 一律传 BCP-47 标签**
- 直方图每根柱子加 `data-test="mo-dist-bar"` 与 `:title="b.label + ' · ' + b.count"`
- 顶栏返回按钮 `data-test="mo-back"` → `router.push('/photos/smart-views')`
- About / Stats 各行加 `data-test="mo-about-time"` / `mo-about-place"` / `mo-stat-span"` / `mo-last-updated"`
- 「查无此条」块 `data-test="mo-not-found"`
- 样式照 `photos-smartview.scss:269-290`（`.mo-about-row` 三行键值对），发际线用 `--divider`，橙色类型胶囊用 `--warn-bg` / `--warn-fg`

`src/router/index.ts` —— **只追加，不重排**（照 SP7-P8a-T5 的既有约束，`router/index.test.ts` 会断言顺序）：

```ts
  { path: '/photos/moments/:id', name: 'photos-moment-detail', component: PhotosMomentDetail },
```

插在 `/photos/smart-views/:id` 之后、`/photos/search` 之前。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/views/PhotosMomentDetail.test.ts src/router --reporter=verbose`
Expected: PASS，17 个详情页用例 + 路由测试全绿

- [ ] **Step 5: 提交**

```bash
git add src/views/PhotosMomentDetail.vue src/views/PhotosMomentDetail.test.ts src/router/index.ts src/i18n/zh_cn.photos.ts src/i18n/en_us.photos.ts
git commit -m "feat(photos): add the moment detail page as a route

Vue 2 renders this inline inside the smart views page and receives the moment
as a prop, so it never has to answer \"what if that id does not exist\". A real
route does, and the backend has no GET /moments/:id — only the full list and
the per-moment assets — so a cold deep link falls back to fetching the list and
looking the id up, and renders an explicit not-found state instead of a blank
page when that fails.

The last-updated line always renders a dash. momentResponse carries no
updated_at field, so Vue 2's relative-time branch could never fire either; the
field stays in the type for when the backend adds it, without dead code to
format it."
```

---

