## Task 8: `Photos.vue` 接线（保留未加载月份 / 按需请求 / 死刻度）

**Files:**
- Modify: `src/views/Photos.vue:75-79`（`gridMonths`）、模板上的 `<PhotosGrid>`
- Modify: `src/photos/components/PhotosGrid.vue`（刻度尺 `data-disabled`）
- Test: `src/views/__tests__/Photos.buckets.test.ts`（**新建 → 必须登记 `oss/manifest.mjs`**）

**Interfaces:**
- Consumes: T5 `store.fetchBucket`；T7 `need-bucket`
- Produces: 无新导出

- [ ] **Step 1: 写失败测试**

新建 `src/views/__tests__/Photos.buckets.test.ts`。**mock 形状照
`src/views/__tests__/Photos.integration.test.ts` 现成的那套抄**（它已经把
`@nimotech/nimoos-service`、router、MessageBus 都 mock 好了）—— 先读那个文件，照它的
`beforeEach` 与 mock 清单建同款骨架，只把断言换成下面这些：

```ts
  it('keeps unloaded months in gridMonths so the grid can render skeletons', async () => {
    // store in bucket mode with one unloaded month -> the view must not filter it
    // out; Photos.vue:78's `.filter(m => m.photos.length > 0)` would have.
  })
  it('drops unloaded months once an EXIF filter is active', async () => {
    // Registered limitation (spec 5.1): an unloaded month's membership is
    // unknown, so it is hidden rather than guessed at.
  })
  it('forwards need-bucket to the store', async () => {
    // expect(timeline.fetchBucket).toHaveBeenCalledWith('2026-07')
  })
```

三例都要写成可跑的完整代码（照 integration 测试的 mount 方式），不要留注释占位。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/views/__tests__/Photos.buckets.test.ts`
Expected: FAIL。

- [ ] **Step 3: 改 `Photos.vue`**

```ts
// 分桶模式下未加载的月份 photos 恒为空数组,不能被这条 filter 吃掉 —— 它是 PhotosGrid
// 画骨架、也是滚动条长度与跳月锚点的来源。
// 一旦 EXIF 筛选生效就恢复原样丢弃:未加载月份里到底有没有符合筛选的照片,前端无从得知
// (spec §5.1 已登记为遗留限制,真正的修法是后端筛选)。
const exifFilterActive = computed(() => {
  const f = exifFilter.value
  return f.years.length > 0 || f.places.length > 0 || f.cameras.length > 0
})
const gridMonths = computed(() =>
  store.months
    .map((m) => ({ ...m, photos: applyExifFilters(m.photos, exifFilter.value) }))
    .filter((m) => m.photos.length > 0 || (m.loaded === false && !exifFilterActive.value)),
)
```

模板给 `<PhotosGrid>` 加一行：

```html
            @need-bucket="(k: string) => store.fetchBucket(k)"
```

`filteredCount` 不动（它数的是真实照片数，未加载月份贡献 0 —— 与「顶部统计用目录精确值」
是两回事，本任务不改它，若评审认为该改，登记成后续票）。

- [ ] **Step 4: 刻度尺死刻度置灰**

`PhotosGrid.vue` 的 `scrubberTicks` 现在从 `props.months` 走、与模板的 `filteredMonths`
两套判据，会出现「点了没反应」的死刻度。改成从**同一个** `filteredMonths` 取，
并给不显示的月份打 `disabled`：

```ts
const scrubberTicks = computed(() => {
  const ticks: Array<{ label: string; major: boolean; key: string; disabled: boolean }> = []
  const seenYears = new Set<string>()
  // Read the same array the template's v-if reads, so a tick's disabled state can
  // never disagree with whether that month actually renders.
  for (const m of filteredMonths.value) {
    if (!m.key || m.key === 'unknown' || m.key === 'search' || !m.key.includes('-')) continue
    const [year, mo] = m.key.split('-')
    if (!seenYears.has(year)) {
      seenYears.add(year)
      // Year ticks are never disabled — they are not click targets to begin with.
      ticks.push({ label: year, major: true, key: `y-${year}`, disabled: false })
    }
    const abbr = new Date(+year, +mo - 1).toLocaleString('en', { month: 'short' })
    ticks.push({ label: abbr, major: false, key: m.key, disabled: !hasContent(m) })
  }
  return ticks
})
```

模板：

```html
          :data-major="tk.major" :data-active="tk.key === activeMonth" :data-disabled="tk.disabled"
          :style="{ top: tickTop(i), cursor: (tk.major || tk.disabled) ? 'default' : 'pointer' }"
          @click="!tk.major && !tk.disabled && jumpTo(tk.key)"
```

样式：

```css
/* A month hidden by the current tab or filter has no anchor to jump to. */
.scrubber-tick[data-disabled="true"] { opacity: 0.35; }
```

追加一例到 `PhotosGrid.test.ts`：

```ts
  it('disables the tick of a month the current tab hides', async () => {
    const w = mount(PhotosGrid, {
      props: { months: [bucketMonth('2026-08', 'August 2026', 12, 3)], tab: 'doc' },
    })
    await nextTick()
    const tick = w.findAll('.scrubber-tick').find((t) => t.attributes('data-major') !== 'true')
    expect(tick?.attributes('data-disabled')).toBe('true')
  })
```

注意：`doc` tab 下该月不显示 ⇒ `anyContent` 为假 ⇒ 刻度尺整块 `v-if` 不渲染，这一例会
拿不到刻度。**所以这个用例要给两个月份**：一个在 doc tab 下有内容（放一张 `hasOcr: true`
的照片、`loaded: true`），一个是未加载的分桶月份 ⇒ 刻度尺渲染、且后者的刻度 disabled。
写测试时按这个形状构造，别照抄上面那段的单月份版本。

- [ ] **Step 5: 登记开源清单**

`oss/manifest.mjs` 的视图测试段（`'src/views/__tests__/Photos.route.test.ts'` 附近）
按字母序插入一行，并在旁边写一句为什么：

```js
  // SP15-P3: bucket-mode wiring test for Photos.vue.
  'src/views/__tests__/Photos.buckets.test.ts',
```

- [ ] **Step 6: 跑测试确认通过**

Run: `pnpm test src/views/__tests__/Photos.buckets.test.ts src/photos/components/__tests__/PhotosGrid.test.ts && pnpm test oss && pnpm exec vue-tsc --noEmit`
Expected: 全绿（`oss/photosStripCoverage.test.mjs` 会验刚加的那行）。

- [ ] **Step 7: 提交**

```bash
git add src/views/Photos.vue src/views/__tests__/Photos.buckets.test.ts src/photos/components/PhotosGrid.vue src/photos/components/__tests__/PhotosGrid.test.ts oss/manifest.mjs
git commit -m "feat(photos): wire bucket loading into the timeline view

The view used to drop every month with no photos in it, which in bucket mode is
every month that has not been scrolled to yet — so the filter now keeps unloaded
months unless an EXIF filter is active, where a month's membership genuinely is
unknown. The scrubber also stopped deriving its ticks from a different array
than the template renders from, which is what let it offer ticks that jump
nowhere."
```

---

