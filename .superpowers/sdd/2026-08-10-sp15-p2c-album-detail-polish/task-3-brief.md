## Task 3: 相册详情骨架换血 + 编辑态底部浮条

**Files:**
- Modify: `src/views/PhotosAlbumDetail.vue`（模板 `:520-690`、CSS `:949-952`/`:1013-1026`、脚本 `coverBgImage` 等）
- Test: `src/views/__tests__/PhotosAlbumDetail.test.ts`

**Vue2 源码坐标:** `33b05636:src/views/Photos/PhotosAlbumDetail.vue:1-130`（顶栏 + 双栏骨架 + sv-header + 动作排 + 网格）

**这一步删掉的:**
- `.album-hero` / `.album-hero-bg` / `.album-hero-inner` / `.album-hero-text` / `.album-hero-badge` /
  `.album-hero-sub` / `.album-hero-actions` 整块（模板 `:522-629`）及其全部 CSS
- `coverBgImage` computed（脚本 `:112-120`）—— 删后 grep 确认 `--album-cover-fallback` token
  在 `PhotosAlbums.vue` 还有消费者，**token 本身不要删**
- `.album-toolbar` 整条横带（模板 `:631-690`）及 `.album-toolbar-muted`/`-spacer`/`-group` 三条 CSS
- `photosAlbumItemsShown` 键的使用（"{n} items shown" 与 stats 行的 "N items" 字面重复，Vue2 明确删掉）

**这一步建立的:**
- `.sv-detail-bar`：左 back「相册」（`photosAlbumBack`，P2b 已有），右 `photosDetailCreatedAt`
  （`createdLabel` 为占位符时整个 span 不渲染）
- `.sv-detail-layout` > `.sv-detail-main`（`.sv-header` + `.album-photos-wrap`）+ `aside.sv-detail-side`
- `.sv-header`：`<h1>`（标题 span 可点改名 / input 编辑态 / 日期胶囊 `.sv-cond` 同行）+ `.sv-header-stats`
- `.sv-actions`：`Sort:` 文案 + `.order-pill` 排序胶囊 + 分隔线 + Edit·Done + 分隔线 + 密度二钮
  - **Sort 与密度只在 `!edit` 时渲染；Edit·Done 常驻**
  - 两条 `.album-detail-actions-sep` 分隔线，只在相邻的 Sort/density 实际渲染时才带出
- **编辑态底部浮条 `.sv-select-bar`**（原 T6，pre-flight 并入本任务）：`.album-toolbar` 被删后
  「移除选中 / 添加照片」两个按钮的新家。形态与 SV 详情一致
  （**New-UI 参照物：`src/views/PhotosSmartViewDetail.vue` 的 `sv-select-bar`，E6，P2a 建**）。
  - SV 详情那份是 scoped ⇒ **自写一份 CSS**（延续 P2b 的 KEEP THE DUPLICATION 裁定），
    CSS 块上写一条登记注释指明与 `PhotosSmartViewDetail.vue` 同源
  - **保留既有的 `removing` 重入守卫**（`:69`，P2b 终审 Minor 6 加的），搬家时不要丢
  - 选中数为 0 时浮条不渲染（照 SV 详情既有行为）
  - 离开编辑态要清空选择态 —— P1 终审逮到过同类形状（「切 id 只清资产不清选择态 ⇒
    把 A 的照片 id 发给 B 的接口」）

**E5 重锚（关键，无自动门可见）:** 现有两条兄弟选择器

```
:1021  .album-toolbar[data-edit="true"] ~ .album-detail-body .tile[data-cover="true"]::after { display: none; }
:1026  .album-toolbar[data-edit="true"] ~ .album-detail-body .tile { outline: 1px dashed var(--card-border); outline-offset: -1px; }
```

靶子的做法是把编辑态标记打在网格容器自己身上：`<div class="album-photos-wrap" :data-edit="edit">`。
⇒ 两条改写成 `.album-photos-wrap[data-edit="true"] .tile…`，**不再是兄弟选择器**。
改完后 grep 全文件确认没有别的规则还以 `.album-toolbar` 或 `.album-detail-body` 为锚。

**适配点（New-UI 与 Vue2 的差异）:**
- Vue2 用内联 `style="…"` 写 h1 编辑态 input 的样式（含 `font-family:var(--font-display)`）。
  **本仓没有 `--font-display`**（P1 已登记）⇒ 用 `.sv-header h1` 已有的字体设定，input 只补必要的
  背景/边框/圆角，全部走 token，不写内联颜色。
- Vue2 的 `photos-icon` 组件 → New-UI 用内联 `<svg>`（照本文件既有 svg 的写法）。
- Vue2 `density === 'comfort'`，New-UI 现有值是 `'comfortable'`。**保持 New-UI 现值**，不要为了
  1:1 去改内部枚举（那是不可见的内部命名，改了会波及既有测试且无视觉收益）。

- [ ] **Step 1: 写失败测试**

```ts
// src/views/__tests__/PhotosAlbumDetail.test.ts — 新增一组
describe('P2c detail skeleton', () => {
  it('renders the detail bar with a back button and the created date', async () => {
    const w = await mountDetail()
    expect(w.find('.sv-detail-bar').exists()).toBe(true)
    expect(w.find('.sv-detail-bar .back').exists()).toBe(true)
  })

  it('omits the created date entirely when the album has no creation timestamp', async () => {
    // createdLabel falls back to the em-dash placeholder -> the span must not render at all
  })

  it('no longer renders the cover hero or the toolbar band', async () => {
    const w = await mountDetail()
    expect(w.find('.album-hero').exists()).toBe(false)
    expect(w.find('.album-toolbar').exists()).toBe(false)
  })

  it('renders the two-column layout with the main column and the sidebar', async () => {
    const w = await mountDetail()
    expect(w.find('.sv-detail-layout .sv-detail-main .sv-header').exists()).toBe(true)
    expect(w.find('.sv-detail-layout > .sv-detail-side').exists()).toBe(true)
  })

  it('puts the date range pill on the h1 row, not in a separate chips row', async () => {
    const w = await mountDetail({ dateRange: '2026-01 – 2026-03' })
    expect(w.find('.sv-header h1 .sv-cond').text()).toBe('2026-01 – 2026-03')
  })

  it('shows the items count and hides the videos count when there are no videos', async () => {
    // videoCount 0 -> only one stat span
  })

  it('hides sort and density in edit mode but keeps Edit/Done', async () => {
    const w = await mountDetail()
    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    expect(w.find('.order-pill').exists()).toBe(false)
    expect(w.find('.density').exists()).toBe(false)
    expect(w.find('[data-test="album-edit-toggle"]').exists()).toBe(true)
  })

  it('marks the photo grid wrapper with the edit flag so the cover badge and tile outline rules can key off it', async () => {
    const w = await mountDetail()
    await w.find('[data-test="album-edit-toggle"]').trigger('click')
    expect(w.find('.album-photos-wrap').attributes('data-edit')).toBe('true')
  })

  it('still opens the lightbox from a tile click outside edit mode', async () => {
    // regression guard: the grid moved into a new container, the click path must survive
  })

  // ── 编辑态底部浮条（原 T6，pre-flight 并入）──
  it('shows the select bar only in edit mode with at least one selection', async () => {})
  it('removes the selected photos and keeps the guard against a double click', async () => {})
  it('opens the library picker from the select bar', async () => {})
  it('hides the select bar again after leaving edit mode', async () => {})
  it('clears the selection when leaving edit mode so a later edit session starts empty', async () => {})
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts`

- [ ] **Step 3: 改模板 + CSS + 脚本**

按上面「删掉的 / 建立的 / E5 重锚 / 适配点」四段执行。**打开靶子源码逐段比对**，不要照本计划的散文重建。

- [ ] **Step 4: 搬家既有测试**

`.album-toolbar` / `.album-hero` 的既有断言会红。**逐条搬家，不是删除** —— 每条断言在新结构里找到对应
落点。搬完后在任务报告里**逐条点名**列出：原断言 → 新家。
（依据：P1 Task 9 的 Step 0 搬走 8 条断言，报告说全部 re-home，评审逐条点名才发现第 8 条真丢了。）

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/parity.test.ts src/styles`

- [ ] **Step 6: 变异验证**

1. 把 `.album-photos-wrap` 的 `:data-edit="edit"` 删掉 → 「marks the photo grid wrapper」应红
2. 让 Sort/density 在编辑态也渲染 → 「hides sort and density in edit mode」应红
3. 把日期胶囊挪回独立 chips 行 → 「puts the date range pill on the h1 row」应红
4. 去掉 `removing` 重入守卫 → 「keeps the guard against a double click」应红
5. 离开编辑态不清选择态 → 「clears the selection when leaving edit mode」应红

- [ ] **Step 7: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/views/PhotosAlbumDetail.vue src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "refactor(photos): rebuild the album detail on the smart-view skeleton"
```

---

