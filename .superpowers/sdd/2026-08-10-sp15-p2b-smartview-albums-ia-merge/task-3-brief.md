## Task 3: Albums 页混排网格 + AI 停更横幅 ← 逐任务评审

**Files:**
- Modify: `src/views/PhotosAlbums.vue`
- Modify: `src/views/__tests__/PhotosAlbums.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`（+1 键）

**Interfaces:**
- Consumes: `buildMixedAlbums` / `sortMixed` / `MixedAlbumItem` / `MixedSortId`（T2）、
  `usePhotosSmartViews`、`usePhotosSettingsStore`、`SmartViewCard`
- Produces（T4 依赖）：`PhotosAlbums.vue` 里的 `aiSmartViewOff` computed、
  `createOpen` / `newAlbumTitle` / `newAlbumSource` refs

**回源**：`git -C /home/nimo/NimoTech/NimoOS-UI show 939a7d3a:src/views/Photos/PhotosAlbumsView.vue`
的 `:39-133`（banner + body + 混排 section）、`:320-393`（computed）。

---

- [ ] **Step 1: 写失败测试**

在 `src/views/__tests__/PhotosAlbums.test.ts` 追加（mock 形态照该文件既有用例，
**smartViews store 也要 seed**）：

```ts
  it('renders smart albums and manual albums in one grid', async () => {
    // 2 manual + 1 smart => 3 cards plus the create tile.
    const w = await mountAlbums({
      albums: [{ id: 'u1', name: 'A' }, { id: 'u2', name: 'B' }],
      smartViews: [{ id: 's1', name: 'S', seeds: ['x'], conds: [], count: 4 }],
    })
    expect(w.findAll('[data-test="album-card"]')).toHaveLength(2)
    expect(w.findAll('[data-test="sv-card"]')).toHaveLength(1)
  })

  it('counts both kinds in the header total', async () => {
    const w = await mountAlbums({ albums: [{ id: 'u1', name: 'A' }], smartViews: [{ id: 's1', name: 'S' }] })
    expect(w.text()).toContain('2')
  })

  it('opens the smart view detail route when a smart card is clicked', async () => {
    const w = await mountAlbums({ albums: [], smartViews: [{ id: 's1', name: 'S' }] })
    await w.find('[data-test="sv-card"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/photos/smart-views/s1')
  })

  it('shows the smart-views-off banner only when the backend says it is off', async () => {
    const off = await mountAlbums({ albums: [], aiFeatures: { smartview: false } })
    expect(off.find('[data-test="albums-ai-banner"]').exists()).toBe(true)
    // Missing field and fetch failure both mean "on" -- never scare the user.
    const unknown = await mountAlbums({ albums: [], aiFeatures: {} })
    expect(unknown.find('[data-test="albums-ai-banner"]').exists()).toBe(false)
  })

  it('swaps the section subtitle for the nothing-yet copy when both kinds are empty', async () => {
    const empty = await mountAlbums({ albums: [], smartViews: [] })
    expect(empty.text()).toContain('还没有相册')
    const some = await mountAlbums({ albums: [{ id: 'u1', name: 'A' }], smartViews: [] })
    expect(some.text()).not.toContain('还没有相册')
  })

  it('keeps the manual grid alive when the smart view fetch fails', async () => {
    // fetchSmartViews swallows its own errors (store contract); the page must not gate
    // the manual half on it.
    const w = await mountAlbums({ albums: [{ id: 'u1', name: 'A' }], smartViewsFails: true })
    expect(w.findAll('[data-test="album-card"]')).toHaveLength(1)
  })
```

> `data-test="sv-card"` 是 `SmartViewCard.vue` 根节点上的既有标记 —— 先
> `grep -n 'data-test' src/photos/components/SmartViewCard.vue` 核实它的真实值，
> **用真实值，不要用本计划猜的**。若该组件没有 `data-test`，就在本任务里给它加一个
> （根节点，值 `sv-card`），并在报告里登记。

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts
```

- [ ] **Step 3: 加 1 个 i18n 键**

两个 locale 各加一行（按字母序插进 `photosAlbums*` 一族）：

```ts
  photosAlbumsNoneYetHint: '还没有相册——手动创建一个，或者让 Nimo 建一个会自动保持更新的智能相册。',
```

```ts
  photosAlbumsNoneYetHint: 'No albums yet — create one manually, or let Nimo build a Smart Album that keeps itself updated.',
```

- [ ] **Step 4: 改 `PhotosAlbums.vue` 的 script**

新增 import 与 store：

```ts
import SmartViewCard from '../photos/components/SmartViewCard.vue'
import { usePhotosSmartViews } from '../photos/stores/smartViews'
import { usePhotosSettingsStore } from '../photos/stores/settings'
import { buildMixedAlbums, sortMixed, type MixedSortId } from '../photos/util/mixedAlbums'
```

```ts
const smartViews = usePhotosSmartViews()
const settings = usePhotosSettingsStore()
```

`SortId` 类型换成 `MixedSortId`（删掉本文件里自己那份联合类型），`sort` 初值已在 T2
改成 `'created'`。`sortOptions` 五项（label/hint 沿用既有键，`created` 那项已存在）。

把 `views` computed 换成：

```ts
// SP15-P2b (Vue2 939a7d3a:PhotosAlbumsView.vue:391-393): one grid for both kinds, ranked
// by the single Sort control -- smart albums are no longer pinned to the front.
const mixedItems = computed(() =>
  sortMixed(
    buildMixedAlbums(
      albums.albums.map((a) => albumToView(a, t('photosAlbumUntitled'))),
      smartViews.smartViews,
    ),
    sort.value,
  ),
)
```

`isEmpty` 改成同时看两类；并加 AI 开关 computed：

```ts
const isEmpty = computed(() => albums.albumsLoaded && mixedItems.value.length === 0)

// Vue2 :79-85 moved this banner from the smart-views page to here along with the smart
// albums themselves. `=== false` is load-bearing: a missing field and a failed fetch both
// mean "on" (settings.ts already encodes that), and only an explicit off should warn.
const aiSmartViewOff = computed(() => settings.aiFeatures.smartview === false)
```

`onMounted` 里补两个 fetch（并行发起，**不要**用 `Promise.all` 串一个深链等待 ——
New-UI 没有 Vue2 那套 `_applyRouteDeepLink`）：

```ts
onMounted(() => {
  void albums.fetchAlbums()
  // Both fetches are fire-and-forget: the two halves of the grid render independently,
  // so a smart-view failure must not gate the manual albums. Vue2 :414-417 awaited both
  // because its deep-link arbitration needed them together -- New-UI has no such
  // arbitration (usePhotosDeepLinks sends ?smartview= straight to the detail route).
  void smartViews.fetchSmartViews()
  void settings.fetchAiFeatures()
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onDocKeydown)
})
```

加智能卡片的打开函数：

```ts
function openSmartCard(id: string): void {
  router.push('/photos/smart-views/' + id)
}
```

- [ ] **Step 5: 改 `PhotosAlbums.vue` 的 template**

- 头部计数 `views.length` → `mixedItems.length`
- 在 `.albums-scroll` 内、`<section>` **之前**插 AI 横幅。**照 `PhotosSmartViews.vue:169-186`
  的既有 `.svs-banner` 标记与类名逐字复制过来**（含 `--dem-*` token 与那两条偏离登记
  注释的要点），`data-test` 改成 `albums-ai-banner`：

```html
        <div v-if="aiSmartViewOff" class="albums-ai-banner" data-test="albums-ai-banner">
          <div class="albums-ai-banner-icon">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
          </div>
          <div>
            <div class="albums-ai-banner-title">{{ t('photosSvSmartViewsAutoUpdate') }}</div>
            <div class="albums-ai-banner-desc">
              {{ t('photosSvTheseSavedSearchesStay') }}
              <RouterLink class="albums-ai-banner-link" data-test="albums-settings-link" to="/photos/settings?section=ai">{{ t('photosPeopleFacesOffLink') }}</RouterLink>
            </div>
          </div>
        </div>
```

- 分区副标题按空/非空二选一（Vue2 `:91-93`）：

```html
            <span class="albums-section-hint">
              {{ mixedItems.length ? t('photosAlbumsMineHint') : t('photosAlbumsNoneYetHint') }}
            </span>
```

- 网格 `v-for` 改成按 `kind` 分派（`album-create` 磁贴保持在最前，Vue2 `:96-100` 同位）：

```html
              <template v-for="item in mixedItems" :key="item.kind + '-' + item.id">
                <SmartViewCard v-if="item.kind === 'smart'" :sv="item.sv" @open="openSmartCard" />
                <div
                  v-else
                  class="album-card"
                  data-test="album-card"
                  :data-id="item.view.id"
                  @click="openCard(item.view)"
                >
                  <!-- 原有 album-card 内部结构整块保留,只把 view.xxx 换成 item.view.xxx -->
                </div>
              </template>
```

> ⚠ `:key` 必须带 kind 前缀（Vue2 `:104`/`:111` 同样用 `'sv-' + item.id` 与 `item.id`
> 两套 key）—— 手动相册的数字 id 与智能相册的字符串 id 可能撞。

- [ ] **Step 6: 补 `PhotosAlbums.vue` 的样式**

`.albums-ai-banner*` 四条规则从 `PhotosSmartViews.vue` 的 `.svs-banner*` 复制并改名。
**只改类名，取值一个字都不要动**（两页同一横幅，视觉必须一致）。另外：
`.album-grid` 的 `minmax(220px, 1fr)` 与 `SmartViewCard` 期待的 `minmax(320px, 1fr)`
不同 —— **不要改 `.album-grid`**。智能卡在 220px 列宽下会更窄，这是混排的既有代价，
Vue2 侧 `.album-grid-user` 也是同一处境（`photos.scss` 里两套网格各自独立）。
在样式块里就此写一条登记注释，说明为什么不统一列宽。

- [ ] **Step 7: 跑测试 + 类型检查 + color-guard**

```bash
pnpm exec vitest run src/views/__tests__/PhotosAlbums.test.ts src/styles src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
```

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "feat(photos): mix smart albums into the Albums grid

Smart albums now sit in the same grid as manual ones, ranked by the one Sort
control instead of being pinned to the front, and the smart-views-off banner
moves here with them.

The two fetches stay fire-and-forget. Vue 2 awaited both before applying deep
links because its album-vs-smartview arbitration needed them together; New-UI has
no such arbitration -- usePhotosDeepLinks sends ?smartview= straight to the detail
route -- so gating the manual half on the smart half would only mean a smart-view
outage blanks albums that loaded fine.

Grid keys carry a kind prefix: a manual album's numeric id and a smart album's
string id can otherwise collide."
```

---

