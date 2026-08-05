### Task 5: `PlacesRail.vue` —— 左侧城市 rail

**Files:**
- Create: `src/photos/components/PlacesRail.vue`
- Create: `src/photos/components/__tests__/PlacesRail.test.ts`
- Read-only 参考: `PhotosPlacesView.vue:762-825`(模板)、`photos-places.scss:39-190`(样式,**跳过 `:80-95` 的 `.rail-segments`/`.rail-seg` 死 CSS**)

**Interfaces:**
- Consumes: `type Place`, `type RegionCount`, `regionLabelKey`, `groupByRegion`, `searchPlaces`(T2);T4 的键
- Produces:
  ```ts
  // props
  {
    places: Place[]          // 已过滤(时间/数量/大洲/当前行程)但未搜索的地点
    regions: RegionCount[]   // 后端大洲顺序 —— rail 的分组顺序以它为准,不自己排
    collapsed: string[]      // store.railCollapsed
    activeId: string | null
    totalPhotos: number
    countryCount: number
    loaded: boolean          // store.placesLoaded,用于空态门控
  }
  // emits
  (e: 'pick', id: string): void            // 点城市行
  (e: 'toggle-fold', regionId: string): void
  ```
- 搜索词是 rail **组件内部状态**(照 Vue2 `search` 留在视图内,但 Vue2 是整页共享;New-UI 只有 rail 用它,**收进 rail 更内聚 —— 偏离登记:Vue2 的 `search` 在 view 级 data,New-UI 收进组件,因为 `searched` 只被 `grouped` 消费,地图侧用的是 `visiblePlaces` 而非 `searched`(核 Vue2 `:229`、`:237` 确认地图不吃搜索)**)。

**结构规格(逐段照 Vue2,漏渲染元素是最高频缺陷 —— 对着 `:762-825` 从头扫到尾再动手):**

1. `.map-rail-head`:`<h2>` 地点标题 + `.sub` 三段统计(`<b>城市数</b> 座城市 · <b>国家数</b> 个国家 · <b>照片数.toLocaleString()</b> 张照片)。**三个 `<b>` 都要有**。
2. `.map-search`:放大镜图标(14px)+ `<input>`,`placeholder` 走 `photosPlacesSearchPlaceholder`。
3. `.rail-list`:**按 `regions` 数组顺序**遍历(不是 `Object.keys(grouped)`),只渲染 `grouped[rId]` 非空的组。每组两个节点:
   - `.rail-region-head`(可点,`@click` → emit `toggle-fold`):左侧 `.rail-region-head-left` = chevron 图标(11px,折叠时加 `.is-collapsed` 转向)+ 大洲名;右侧 `<em>` = `photosPlacesCityCount`。**大洲名走 `regionLabelKey(rId)` 有键则 `t(key)`,无键回落 `regions.find(r => r.id === rId)?.label`**(偏离登记 3)。
   - `.rail-group-fold`(折叠时加 `.is-folded`)内嵌 `.rail-group-fold-inner` —— **`grid-template-rows: 1fr → 0fr` 的真高度折叠动画,行保持挂载**(照 Vue2 `:793-794` 的注释:留住懒加载缩略图的已加载状态)。**不要改成 `v-if`**。
   - 城市行 `.rail-place`(`activeId` 命中加 `.is-active`):`.thumb > img`(`loading="lazy"`,`src` = `service.photos.thumbnailUrl(p.coverAssetId || p.thumbs[0], 'large')`,**`coverAssetId` 与 `thumbs[0]` 都空时不渲染 `<img>`**,避免空 src 请求)+ `.body`(`.name` 城市 / `.meta` 国家 · 本地化后的 `lastDate`)+ `.count`。
4. **空态(偏离登记 9)**:`loaded && places.length === 0` → `photosPlacesEmpty` + `photosPlacesEmptyHint`;`loaded && places.length > 0 && 搜索后为空` → `photosPlacesSearchEmpty`({q});`!loaded` → 骨架(照 `PhotosAlbums.vue` 体例)。
5. **日期显示走 i18n locale**(偏离登记 2):`p.lastDate` 非空时用 `new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' })`;`lastDate` 为 null 时回落显示后端原串 `p.last`。

**样式要点:** `--text-1/2/3` → `--fg` / `--fg-muted` / `--fg-subtle`;`--surface-2` → `--chip-bg`;`--line` → `--card-border`;`--accent-soft` 直接有同名 token;`.rail-place.is-active .count` 的 `rgba(var(--accent-rgb), 0.22)` → `--accent-soft-2`,`--accent-ink` → `--accent-text`。**`.rail-place:hover` 与 `.rail-place.is-active` 都改背景 —— 按「基类 hover 压变体」铁律,`.is-active` 必须自带 `:hover` 规则**,并用 `cssCascade.ts` 断言 hover 态下 `.is-active` 的背景胜出。

- [ ] **Step 1: 写失败测试**

```ts
// src/photos/components/__tests__/PlacesRail.test.ts —— 必含用例(其余照结构规格补齐)
```
必须包含(每条一个 `it`):
- 统计头三个 `<b>` 都渲染,照片数走 `toLocaleString()`。
- **分组顺序跟 `regions` 数组,而不是字典序**:给 `regions` 传 `[europe, asia]`、地点两洲都有,断言 DOM 里 europe 组在前。
- `grouped[rId]` 为空的大洲不渲染分组头。
- 大洲名:`asia` → 中文「亚洲」(走 `regionLabelKey`);未知 id `atlantis` → 回落后端 `label`。
- 折叠:`collapsed` 含该 id 时分组容器有 `.is-folded`、chevron 有 `.is-collapsed`,**但城市行仍在 DOM 里**(不是 `v-if` —— 删掉这条断言就测不出「改成 v-if」的退化)。
- 点分组头 emit `toggle-fold` 带 region id;点城市行 emit `pick` 带 **`String()` 归一后的 id**(用数字 key 的 fixture 验)。
- `activeId` 为数字字符串、地点 id 由 int32 归一而来时 `.is-active` 命中(铁律)。
- 缩略图:有 `coverAssetId` 用它、无则用 `thumbs[0]`、两者都空时 `img` 不渲染;`src` 必须来自 `service.photos.thumbnailUrl`(mock 该方法并断言被调用参数,**不许断言字面 URL**)。
- 搜索:输入 `HANG` 命中 `Hangzhou`(大小写不敏感);**搜索非空时折叠被压过**(`collapsed` 含 asia 但仍展开 —— 这条断言的是 T3 `isRegionCollapsed` 的语义在组件里被正确消费,组件自己不许再实现一遍判断逻辑)。
- 空态三态:`!loaded` → 骨架;`loaded` 且零地点 → `photosPlacesEmpty`;搜索无果 → `photosPlacesSearchEmpty` 且文案里含查询词。
- 日期:`lastDate` 非空时不出现后端原串 `'Mar 7, 2026'`(证明走了本地化);`lastDate` 为 null 时**出现**原串(回落)。
- `cssCascade.ts`:hover 态下 `.rail-place.is-active` 的 background 归属变体规则,而非基类 `.rail-place:hover`。

- [ ] **Step 2: 跑测试确认失败** — `pnpm exec vitest run src/photos/components/__tests__/PlacesRail.test.ts`
- [ ] **Step 3: 实现**
- [ ] **Step 4: 跑测试确认通过 + 逐个删码验证**

删码清单(一次只删一处):①去掉 `regions` 顺序遍历改成 `Object.keys(grouped)` → 顺序用例红;②`regionLabelKey` 的回落分支删掉 → 未知 id 用例红;③`.rail-group-fold` 改 `v-if` → 「城市行仍在 DOM 里」红;④`pick` 的 `String()` 去掉 → 归一用例红;⑤空 src 守卫删掉 → 「两者都空时 img 不渲染」红;⑥`.is-active` 的 `:hover` 规则删掉 → cssCascade 用例红。

- [ ] **Step 5: Commit** — `feat(photos): P6a-T5 地点城市 rail(大洲分组折叠 + 搜索 + 激活态)`

---

