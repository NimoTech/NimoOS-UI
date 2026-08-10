## Task 6: 网格三态渲染（骨架 / 占位 / 已渲染，暂不含 IO）

**Files:**
- Modify: `src/photos/util/assetToPhoto.ts:408-413`（`Month` 加三个可选字段）
- Modify: `src/photos/components/PhotosGrid.vue`
- Test: `src/photos/components/__tests__/PhotosGrid.test.ts`（追加）

**Interfaces:**
- Consumes: T3 `skeletonItemCount` / `estimateSectionBodyHeight` / `MONTH_HEAD_HEIGHT`
- Produces:
  - `Month` 新增 `loaded?: boolean`、`count?: number`、`videoCount?: number`
  - `PhotosGrid` 新增 emit `(e: 'need-bucket', key: string)`（本任务只声明并在骨架出现时**不**发，
    T7 接 IO 后才发）
  - 骨架 DOM：`.month-skeleton[data-test="month-skeleton"]`，行内 `height`

**这一步要修三个「首屏什么都看不到」的现成陷阱**（都已取证，别漏）：
1. `PhotosGrid.vue:273` 空态条件是 `filteredMonths.every(m => m.filtered.length === 0)` ——
   分桶模式首屏所有月份都还没加载 ⇒ 直接显示「没有照片」。
2. `:283` 月份容器 `v-if="m.filtered.length > 0"` ⇒ 未加载月份连容器都不渲染，
   跳月锚点与滚动条长度全没了。
3. `:342` 刻度尺 `v-if` 与 `:257` `onMounted` 取首月都用同一个「有照片」判据。

- [ ] **Step 1: 写失败测试**

```ts
// 追加到 src/photos/components/__tests__/PhotosGrid.test.ts
function bucketMonth(key: string, title: string, count: number, videoCount = 0): Month {
  return { key, title, loc: '', photos: [], loaded: false, count, videoCount }
}

describe('PhotosGrid bucket-mode skeletons', () => {
  it('renders a sized skeleton for an unloaded month instead of the empty state', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12, 3)], tab: 'photo' } })
    await nextTick()
    expect(w.find('[data-test="empty-state"]').exists()).toBe(false)
    const sk = w.find('[data-test="month-skeleton"]')
    expect(sk.exists()).toBe(true)
    expect(Number.parseFloat(sk.attributes('style')?.match(/height:\s*([\d.]+)px/)?.[1] ?? '0')).toBeGreaterThan(0)
  })

  it('keeps the month head visible on a skeleton, with the estimated count', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12, 3)], tab: 'photo' } })
    await nextTick()
    expect(w.find('.month-title').text()).toBe('August 2026')
    // photo tab estimate = count - videoCount = 9
    expect(w.find('.month-count').text()).toContain('9')
  })

  it('renders the month container so jump anchors exist before anything loads', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12)], tab: 'photo' } })
    await nextTick()
    expect(w.find('#m-2026-08').exists()).toBe(true)
  })

  it('keeps the scrubber visible while every month is still a skeleton', async () => {
    const w = mount(PhotosGrid, {
      props: { months: [bucketMonth('2026-08', 'August 2026', 12), bucketMonth('2026-07', 'July 2026', 4)], tab: 'photo' },
    })
    await nextTick()
    expect(w.find('.scrubber').exists()).toBe(true)
    expect(w.findAll('.scrubber-tick').length).toBeGreaterThan(0)
  })

  it('hides an unloaded month on the doc tab, which has no directory counter', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12, 3)], tab: 'doc' } })
    await nextTick()
    expect(w.find('[data-test="month-skeleton"]').exists()).toBe(false)
    expect(w.find('[data-test="empty-state"]').exists()).toBe(true)
  })

  it('still shows the empty state when there are no months at all', async () => {
    const w = mount(PhotosGrid, { props: { months: [], tab: 'photo' } })
    await nextTick()
    expect(w.find('[data-test="empty-state"]').exists()).toBe(true)
  })

  it('renders real tiles once a month is loaded', async () => {
    const m: Month = { key: '2026-08', title: 'August 2026', loc: '', photos: [photo('a1')], loaded: true, count: 1, videoCount: 0 }
    const w = mount(PhotosGrid, { props: { months: [m], tab: 'photo' } })
    await nextTick()
    expect(w.findAll('.tile')).toHaveLength(1)
    expect(w.find('[data-test="month-skeleton"]').exists()).toBe(false)
  })

  it('leaves legacy month groups (no loaded field) rendering exactly as before', async () => {
    const w = mount(PhotosGrid, { props: { months: [month('2026-08', 'August 2026', [photo('a1')])], tab: 'photo' } })
    await nextTick()
    expect(w.findAll('.tile')).toHaveLength(1)
    expect(w.find('[data-test="month-skeleton"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/photos/components/__tests__/PhotosGrid.test.ts`
Expected: FAIL —— 首例就红（现在渲染的是空态）。

- [ ] **Step 3: 扩 `Month` 类型**

`src/photos/util/assetToPhoto.ts` 的 `Month` 接口加三个可选字段：

```ts
export interface Month {
  key: string
  title: string
  loc: string
  photos: Photo[]
  // SP15-P3 bucket metadata. Absent on legacy timeline groups and on every
  // synthetic group (search results, favorites, place assets) — `loaded`
  // undefined must be read as "already loaded", never as "pending".
  loaded?: boolean
  count?: number
  videoCount?: number
}
```

顺手把 T2 里 `bucketToMonth` 的交叉返回类型收回成 `Month`。

- [ ] **Step 4: 改 `PhotosGrid.vue`**

script 里补：

```ts
import { estimateSectionBodyHeight, skeletonItemCount, MONTH_HEAD_HEIGHT } from '../util/gridMetrics'
```

emit 增加一项：

```ts
const emit = defineEmits<{
  (e: 'open', photo: Photo, list: undefined, startMs: number): void
  (e: 'toggle-select', id: string | number): void
  // Bucket mode: the grid knows which months are on screen, the parent owns the
  // store. Emitting keeps this component usable by the two consumers that have
  // no buckets at all (favorites, place assets).
  (e: 'need-bucket', key: string): void
}>()
```

`filteredMonths` 之后加派生量与三个 helper：

```ts
// Container width drives the column count (auto-fill/minmax), so it is read from
// the scroll wrap. It stays a ref rather than a getter because a resize has to
// re-run the estimates.
const wrapWidth = ref(0)
function measureWrap() { wrapWidth.value = wrapRef.value?.clientWidth ?? 0 }

function skeletonCountOf(m: Month & { filtered: Photo[] }): number {
  return skeletonItemCount({
    tab: props.tab,
    count: m.count,
    videoCount: m.videoCount,
    loaded: m.loaded,
    loadedLength: m.filtered.length,
  })
}
// A month is worth a container if it has tiles to show OR a non-zero estimate to
// stand in for. Without the second half, bucket mode's first paint would fall
// through to the empty state and no anchor would exist to scroll to.
function hasContent(m: Month & { filtered: Photo[] }): boolean {
  return m.filtered.length > 0 || skeletonCountOf(m) > 0
}
const anyContent = computed(() => filteredMonths.value.some(hasContent))
function sectionBodyHeight(m: Month & { filtered: Photo[] }): number {
  return estimateSectionBodyHeight({
    containerWidth: wrapWidth.value,
    density: props.density,
    itemCount: skeletonCountOf(m),
  })
}
function isLoaded(m: Month & { filtered: Photo[] }): boolean {
  return m.loaded !== false
}
```

`onMounted` 里改首月判据并量一次宽度：

```ts
onMounted(() => {
  measureWrap()
  const first = filteredMonths.value.find(hasContent)
  if (first) activeMonth.value = first.key
  onScroll()
})
```

模板三处改动：

```html
      <div v-if="!anyContent" class="empty-state" data-test="empty-state">
```

```html
        <template v-for="m in filteredMonths" :key="m.key">
          <div v-if="hasContent(m)" :id="'m-' + m.key" class="month-group">
            <div class="month-head">
              <div class="month-title">{{ m.key === 'unknown' ? t('photosUnknownDate') : m.title }}</div>
              <div class="month-count">
                {{ t('photosItemsCount', { count: isLoaded(m) ? m.filtered.length : skeletonCountOf(m) }) }}
              </div>
            </div>
            <div v-if="isLoaded(m)" class="grid" :data-density="density">
              <!-- 既有瓷砖循环整段不动 -->
            </div>
            <div
              v-else
              class="month-skeleton"
              data-test="month-skeleton"
              :style="{ height: sectionBodyHeight(m) + 'px' }"
            ></div>
          </div>
        </template>
```

```html
    <div v-if="anyContent" ref="scrubberRef" class="scrubber">
```

`<style scoped>` 里加骨架样式（**颜色只准用 token**）：

```css
/* Unloaded month placeholder. The gentle sweep is the only thing telling the
   user this block is still arriving rather than empty; it reuses the existing
   surface tokens so both skins stay correct. */
.month-skeleton {
  border-radius: 8px;
  background: var(--chip-bg);
  background-image: linear-gradient(90deg, transparent 0%, var(--hover) 50%, transparent 100%);
  background-size: 40% 100%;
  background-repeat: no-repeat;
  animation: month-skeleton-sweep 1.4s ease-in-out infinite;
}
@keyframes month-skeleton-sweep {
  0% { background-position: -40% 0; }
  100% { background-position: 140% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .month-skeleton { animation: none; }
}
```

这两个 token 已核过都在两套主题块里有值：`--chip-bg`（`theme.css` 三处定义）、
`--hover`（`:root` `:56` 与 light `:445`）。**注意不是 `--hover-bg`** —— 那个名字在本仓
不存在，写错会静默变成透明。别新造颜色字面量。

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm test src/photos/components/__tests__/PhotosGrid.test.ts && pnpm exec vue-tsc --noEmit`
Expected: PASS，且**既有 420 行用例一个都不能红**（回退/合成分组走 `loaded === undefined`
路径，行为与改动前一致）。

- [ ] **Step 6: 跑相册区全部测试，确认没有连带回归**

Run: `pnpm test src/photos src/views/__tests__`
Expected: 全绿。

- [ ] **Step 7: 提交**

```bash
git add src/photos/util/assetToPhoto.ts src/photos/components/PhotosGrid.vue src/photos/components/__tests__/PhotosGrid.test.ts
git commit -m "feat(photos): render unloaded months as sized skeletons

Bucket mode hands the grid months it has no photos for yet, and three existing
conditions read \"no tiles\" as \"nothing here\": the empty state, the month
container's v-if and the scrubber's. Left alone they would have made the first
paint of a bucketed library show \"no photos\" with no anchors to scroll to —
the exact opposite of the phase's goal. Each now also asks whether the month has
an estimate to stand in for."
```

---

