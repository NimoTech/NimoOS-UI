## Task 5: For You 专页 + 侧栏标签 + 回链改道

**Files:**
- Modify: `src/views/PhotosSmartViews.vue`
- Modify: `src/photos/components/PhotosSidebar.vue`
- Modify: `src/views/PhotosSmartViewDetail.vue`（**只改 3 处回链与文案**，其余留 T8）
- Modify: `src/views/PhotosSearch.vue`（1 处回链）
- Modify: `src/views/__tests__/PhotosSmartViews.test.ts`
- Modify: `src/i18n/zh_cn.photos.ts` · `src/i18n/en_us.photos.ts`（+2 键，−3 死键）

**Interfaces:**
- Consumes: 无新增
- Produces: `/photos/smart-views` 路由此后**只渲染 Moments**；`photosSvAllSmartViews` 不再存在

**回源**：`939a7d3a:src/views/Photos/PhotosSmartViewsView.vue` 全文（317 行）、
`939a7d3a:PhotosSidebar.vue:115-122`。

---

- [ ] **Step 1: 写失败测试**

```ts
  it('renders the Moments band as the page\'s only hero', async () => {
    const w = await mountSmartViews({ moments: [{ id: 'm1', title: 'T' }] })
    expect(w.find('h1').text()).toContain('时刻')
    // Everything the smart-view list used to own is gone from this page.
    expect(w.find('[data-test="sv-hero-create"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-create-card"]').exists()).toBe(false)
    expect(w.find('[data-test="sv-skeleton"]').exists()).toBe(false)
    expect(w.findAll('[data-test="sv-card"]')).toHaveLength(0)
  })

  it('shows the slim settings hint instead of the band when smart views are off', async () => {
    const w = await mountSmartViews({ moments: [{ id: 'm1' }], aiFeatures: { smartview: false } })
    expect(w.find('[data-test="mo-section"]').exists()).toBe(false)
    expect(w.find('[data-test="mo-off-hint"]').exists()).toBe(true)
  })

  it('shows neither the band nor the hint when there are simply no moments', async () => {
    // The real device has zero rows in the moments table, so this is the everyday state.
    const w = await mountSmartViews({ moments: [] })
    expect(w.find('[data-test="mo-section"]').exists()).toBe(false)
    expect(w.find('[data-test="mo-off-hint"]').exists()).toBe(false)
  })

  it('no longer fetches the smart view list on this page', async () => {
    await mountSmartViews({ moments: [] })
    expect(fetchSmartViews).not.toHaveBeenCalled()
  })
```

侧栏与回链各一条：

```ts
  // PhotosSidebar.test.ts
  it('labels the smart-views entry For You after the IA merge', () => {
    expect(mountSidebar().find('[data-nav-id="smart-views"]').text()).toContain('为你推荐')
  })
```

```ts
  // PhotosSmartViewDetail.test.ts
  it('sends the back button to Albums, where smart albums now live', async () => {
    const w = await mountDetail({ sv: { id: 's1', name: 'S' } })
    await w.find('[data-test="sv-detail-back"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/photos/albums')
  })
```

> `data-test="sv-detail-back"` 现在**不存在**（`:547` 那个按钮没有标记）。本任务给三个
> 返回入口各加一个 `data-test`，值分别 `sv-detail-back` / `sv-not-found-back`（已有）/
> 删除后的跳转无 DOM（用 `push` 断言）。

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 加 2 键、删 3 死键**

加 `photosMoForYou`、`photosMoFollowsSmartViewSetting`。
删 `photosSvSavedSearchesStayLive`、`photosSvDescribeWantSetQuality`、
`photosSvAllSmartViews`（两个 locale 各删 3 行）。

- [ ] **Step 4: 瘦身 `PhotosSmartViews.vue`**

删掉：`SmartViewCard` / `SmartViewCreateDialog` 两个 import 与用法、`usePhotosSmartViews`
store 与 `store.fetchSmartViews()`、`createOpen` / `openCreate` / `onCardOpen` /
`onCreated` / `defineExpose({ createOpen })`、`.sv-hero` 整块、骨架屏整块、
`.sv-grid` 智能视图网格与新建卡整块，以及它们的全部样式规则
（`.sv-hero*` / `.sv-create-btn*` / `.sv-create-card*` / `.sv-skel-card`）。
`.sv-grid` 本体**保留** —— `.mo-grid` 与它并存叠加。

保留并改动：
- 原 `svs-banner`（完整版）**移除**，换成精简提示（Vue2 `:26-31`）：

```html
        <div v-if="showMoments" class="mo-section" data-test="mo-section"> … 原样 … </div>
        <!-- Vue2 :26-31: with the band hidden this page is nearly blank, so a one-line
             pointer to Settings replaces it. The full stop-updates banner moved to the
             Albums page along with the smart albums; it is not duplicated here. -->
        <div v-else-if="aiSmartViewOff" class="mo-off-hint" data-test="mo-off-hint">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
          <span>
            {{ t('photosMoFollowsSmartViewSetting') }}
            <RouterLink class="mo-off-hint-link" to="/photos/settings?section=ai">{{ t('photosPeopleFacesOffLink') }}</RouterLink>
          </span>
        </div>
```

- `.mo-hero h2` → `h1`（Vue2 `:19`：升为页面唯一 h1，字号仍 32px 不变），样式选择器
  同步改成 `.mo-hero h1`
- `.mo-off-hint` 的琥珀色一律用 `--dem-fg/--dem-bg/--dem-bd` 家族（与原 `.svs-banner`
  同款，**不要**写字面量）

- [ ] **Step 5: 侧栏标签**

`src/photos/components/PhotosSidebar.vue:44`：

```ts
  // SP15-P2b (Vue2 939a7d3a:PhotosSidebar.vue:118): the page behind this entry is now a
  // Moments-only "For You" page -- the smart albums moved into Albums. Only the label
  // changes; id and route stay so the ?view=smart deep link and the hide-when-off filter
  // keep working.
  { id: 'smart-views', route: '/photos/smart-views', labelKey: 'photosMoForYou' },
```

- [ ] **Step 6: 回链改道 4 处**

`src/views/PhotosSmartViewDetail.vue` 的 `:361` / `:540` / `:547` 与
`src/views/PhotosSearch.vue:499`：`'/photos/smart-views'` → `'/photos/albums'`。
两个按钮的文案 `photosSvAllSmartViews` → `photosAlbumBack`。在 `:547` 上方写偏离登记：

```html
            <!-- Deviation from Vue 2, registered. 939a7d3a:PhotosSmartViewDetail.vue:5 still
                 labels this button "All Smart Views" even though #112 made its @back return to
                 the Albums list -- Vue 2 shipped a button whose label lies about where it goes.
                 A misleading label is a user-visible defect rather than a styling choice, so
                 this port keeps Vue 2's destination and fixes the label, reusing the album
                 detail page's existing photosAlbumBack (PhotosAlbumDetail.vue:433) rather than
                 adding a key. photosSvAllSmartViews is deleted in the same commit. -->
```

- [ ] **Step 7: 跑测试 + 类型检查 + color-guard，然后提交**

```bash
pnpm exec vitest run src/views/__tests__ src/photos/components/__tests__/PhotosSidebar.test.ts src/styles src/i18n/parity.test.ts
pnpm exec vue-tsc --noEmit
```

> ⚠ 全 `src/views/__tests__` 都要跑：删掉 `defineExpose({ createOpen })` 与创建入口会
> 让 `PhotosSmartViews.test.ts` 里若干旧用例失效，那些用例要**删掉**（对应功能已迁走），
> 不是改断言让它继续绿。在报告里列出删了哪几条、各自迁到了 T3/T4 的哪条。

```bash
git add -A
git commit -m "feat(photos): slim the smart-views page into Moments For You

The smart-view grid, its hero, the create tile and the create dialog all moved to
the Albums page in the previous commits, so this page keeps only the Moments band
and promotes its heading to the page's single h1. The full stop-updates banner
went to Albums with the smart albums; a one-line pointer to Settings stands in
here, because with the band hidden the page would otherwise be blank.

Three back links and the search page's 'view smart views' link now go to Albums.
Vue 2 left these labelled 'All Smart Views' while sending the user to the album
list -- a button whose label lies about its destination. The destination is Vue 2's;
the label is not, and photosSvAllSmartViews is deleted rather than reworded."
```

---

