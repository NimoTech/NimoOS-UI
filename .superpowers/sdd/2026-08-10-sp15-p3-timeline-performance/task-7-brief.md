## Task 7: `IntersectionObserver` 窗口化 + 实测高度 + jsdom 降级

**Files:**
- Modify: `src/photos/components/PhotosGrid.vue`
- Test: `src/photos/components/__tests__/PhotosGrid.test.ts`（追加）

**Interfaces:**
- Consumes: T6 的 `hasContent` / `sectionBodyHeight` / `isLoaded`
- Produces: `need-bucket` 真正开始发；DOM 上 `.month-placeholder[data-test="month-placeholder"]`

**行为契约：**
- 窗口内（视口前后各 2 屏）且 `loaded` ⇒ 真实瓷砖
- 窗口外且**量过**真实高度 ⇒ `.month-placeholder`，行内高度 = 实测值
- 窗口外且没量过、或 `!loaded` ⇒ T6 的 `.month-skeleton`
- 进入窗口且 `loaded === false` ⇒ `emit('need-bucket', key)`（同一 key 每次进入都可以发，
  store 侧已按 key 去重）
- `IntersectionObserver` 不存在（jsdom）或容器宽度为 0 ⇒ **全部视为在窗口内**（等于改动前行为）

- [ ] **Step 1: 写失败测试**

```ts
// 追加到 src/photos/components/__tests__/PhotosGrid.test.ts
class FakeIO {
  static instances: FakeIO[] = []
  cb: IntersectionObserverCallback
  targets: Element[] = []
  constructor(cb: IntersectionObserverCallback) { this.cb = cb; FakeIO.instances.push(this) }
  observe(el: Element) { this.targets.push(el) }
  unobserve(el: Element) { this.targets = this.targets.filter((t) => t !== el) }
  disconnect() { this.targets = [] }
  takeRecords(): IntersectionObserverEntry[] { return [] }
  fire(el: Element, isIntersecting: boolean) {
    this.cb(
      [{ target: el, isIntersecting } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
}

describe('PhotosGrid windowing', () => {
  beforeEach(() => {
    FakeIO.instances = []
    ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIO
  })
  afterEach(() => {
    delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver
  })

  const loadedMonth = (key: string, ids: string[]): Month => ({
    key, title: key, loc: '', photos: ids.map((id) => photo(id)), loaded: true, count: ids.length, videoCount: 0,
  })

  it('observes every month container', async () => {
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1']), loadedMonth('2026-07', ['a2'])], tab: 'photo' } })
    await nextTick()
    expect(FakeIO.instances[0].targets).toHaveLength(2)
  })

  it('asks for a bucket when an unloaded month enters the window', async () => {
    const w = mount(PhotosGrid, { props: { months: [bucketMonth('2026-08', 'August 2026', 12)], tab: 'photo' } })
    await nextTick()
    const io = FakeIO.instances[0]
    io.fire(w.find('#m-2026-08').element, true)
    await nextTick()
    expect(w.emitted('need-bucket')?.[0]).toEqual(['2026-08'])
  })

  it('never asks for a bucket for a group that has no bucket at all', async () => {
    // Favorites and place-assets feed synthetic groups: loaded is undefined.
    const w = mount(PhotosGrid, { props: { months: [month('2026-08', 'August 2026', [photo('a1')])], tab: 'photo' } })
    await nextTick()
    FakeIO.instances[0].fire(w.find('#m-2026-08').element, true)
    await nextTick()
    expect(w.emitted('need-bucket')).toBeUndefined()
  })

  it('swaps a rendered month for a measured placeholder when it leaves the window', async () => {
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1', 'a2'])], tab: 'photo' } })
    await nextTick()
    const el = w.find('#m-2026-08').element as HTMLElement
    const io = FakeIO.instances[0]
    io.fire(el, true)
    await nextTick()
    // jsdom reports offsetHeight 0; stub it so the measurement path is exercised.
    Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 321 })
    io.fire(el, false)
    await nextTick()
    expect(w.findAll('.tile')).toHaveLength(0)
    const ph = w.find('[data-test="month-placeholder"]')
    expect(ph.exists()).toBe(true)
    expect(ph.attributes('style')).toContain('321px')
  })

  it('renders tiles again when the month comes back into the window', async () => {
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1'])], tab: 'photo' } })
    await nextTick()
    const el = w.find('#m-2026-08').element as HTMLElement
    const io = FakeIO.instances[0]
    io.fire(el, true); await nextTick()
    io.fire(el, false); await nextTick()
    io.fire(el, true); await nextTick()
    expect(w.findAll('.tile')).toHaveLength(1)
  })

  it('renders everything when IntersectionObserver is missing', async () => {
    delete (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1']), loadedMonth('2026-07', ['a2'])], tab: 'photo' } })
    await nextTick()
    expect(w.findAll('.tile')).toHaveLength(2)
    expect(w.find('[data-test="month-placeholder"]').exists()).toBe(false)
  })

  it('disconnects the observer on unmount', async () => {
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1'])], tab: 'photo' } })
    await nextTick()
    const io = FakeIO.instances[0]
    w.unmount()
    expect(io.targets).toHaveLength(0)
  })

  it('observes a month that appears after a directory refresh', async () => {
    const w = mount(PhotosGrid, { props: { months: [loadedMonth('2026-08', ['a1'])], tab: 'photo' } })
    await nextTick()
    await w.setProps({ months: [loadedMonth('2026-08', ['a1']), bucketMonth('2026-07', 'July 2026', 4)] })
    await nextTick()
    expect(FakeIO.instances[0].targets).toHaveLength(2)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/photos/components/__tests__/PhotosGrid.test.ts`
Expected: FAIL —— 没有 observer、也没有 `need-bucket`。

- [ ] **Step 3: 实现**

script 里加窗口状态与 observer：

```ts
// Month-section windowing. Far-away months keep their container (anchors and
// scroll length depend on it) but drop their tiles, so the DOM stays a constant
// size no matter how far the user scrolls. Which months count as near is left to
// the browser: rootMargin gives it two viewports of slack in both directions.
const WINDOW_MARGIN = '200% 0px'
const activeKeys = ref<Set<string>>(new Set())
// Measured heights survive a section being torn down, so a placeholder can keep
// the exact height its tiles had — this is what stops the scrollbar from jumping.
// Not reactive: it is only read while rendering a section that just changed.
const measuredHeights = new Map<string, number>()
let observer: IntersectionObserver | null = null
const windowingActive = ref(false)

function keyOf(el: Element): string { return (el.id || '').replace(/^m-/, '') }

function onIntersect(entries: IntersectionObserverEntry[]) {
  const next = new Set(activeKeys.value)
  for (const entry of entries) {
    const key = keyOf(entry.target)
    if (!key) continue
    if (entry.isIntersecting) {
      next.add(key)
      const m = filteredMonths.value.find((x) => x.key === key)
      // Only bucket-backed months have something to fetch; a synthetic group
      // (favorites, place assets) has loaded === undefined and must never emit.
      if (m && m.loaded === false) emit('need-bucket', key)
    } else {
      const el = entry.target as HTMLElement
      const h = el.offsetHeight
      // Record before dropping the tiles: once they are gone the height is the
      // placeholder's own, which would ratchet the section down over time.
      if (h > 0) measuredHeights.set(key, h)
      next.delete(key)
    }
  }
  activeKeys.value = next
}

function syncObserver() {
  if (!observer) return
  observer.disconnect()
  for (const m of filteredMonths.value) {
    if (!hasContent(m)) continue
    const el = document.getElementById(`m-${m.key}`)
    if (el) observer.observe(el)
  }
}

function isWindowed(m: Month & { filtered: Photo[] }): boolean {
  // Degraded environments (jsdom has no IntersectionObserver; a display:none
  // container reports width 0) render everything, which is exactly the
  // pre-windowing behaviour.
  if (!windowingActive.value) return true
  return activeKeys.value.has(m.key)
}
function placeholderHeight(m: Month & { filtered: Photo[] }): number | null {
  const h = measuredHeights.get(m.key)
  return h != null && h > 0 ? h : null
}
```

`onMounted` 末尾接上：

```ts
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(onIntersect, { root: wrapRef.value, rootMargin: WINDOW_MARGIN })
    windowingActive.value = true
    syncObserver()
  }
```

`watch` 区加一条（月份集合变化后重挂）：

```ts
watch(() => filteredMonths.value.map((m) => m.key).join('|'), () => {
  void nextTick().then(() => { measureWrap(); syncObserver() })
})
```

`onBeforeUnmount` 里补：

```ts
  observer?.disconnect()
  observer = null
```

模板把「已加载」那一支再分成两态：

```html
            <div v-if="isLoaded(m) && isWindowed(m)" class="grid" :data-density="density">
              <!-- 既有瓷砖循环 -->
            </div>
            <div
              v-else-if="isLoaded(m) && placeholderHeight(m) !== null"
              class="month-placeholder"
              data-test="month-placeholder"
              :style="{ height: placeholderHeight(m) + 'px' }"
            ></div>
            <div
              v-else
              class="month-skeleton"
              data-test="month-skeleton"
              :style="{ height: sectionBodyHeight(m) + 'px' }"
            ></div>
```

样式（占位不需要流光，它不是「在加载」）：

```css
/* A section that has been rendered once and scrolled away: same height, no
   content, no shimmer — nothing is pending here. */
.month-placeholder { border-radius: 8px; }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/photos/components/__tests__/PhotosGrid.test.ts && pnpm exec vue-tsc --noEmit`
Expected: PASS。

- [ ] **Step 5: 确认既有消费方零回归**

Run: `pnpm test src/photos src/views/__tests__`
Expected: 全绿 —— 既有用例都没装 `IntersectionObserver`，走降级路径（全渲染）。

- [ ] **Step 6: 提交**

```bash
git add src/photos/components/PhotosGrid.vue src/photos/components/__tests__/PhotosGrid.test.ts
git commit -m "feat(photos): window month sections with an IntersectionObserver

Loading on demand is not enough on its own: scrolling far enough still piles up
tens of thousands of tiles. Sections far from the viewport now keep their
container but drop their tiles, and the height they are replaced with is the one
that was measured while they were rendered — an estimate there would move the
scrollbar under the user. Deciding what is near is left to the browser, and when
no observer exists the component renders everything, which is what the two
consumers with no buckets and the whole existing test suite already expect."
```

---

