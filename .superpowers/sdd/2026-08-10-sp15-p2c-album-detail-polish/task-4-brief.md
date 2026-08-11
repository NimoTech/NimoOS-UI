## Task 4: 相册详情侧栏三节

**Files:**
- Modify: `src/views/PhotosAlbumDetail.vue`（`aside.sv-detail-side` 内，现 `:731-760`）
- Test: `src/views/__tests__/PhotosAlbumDetail.test.ts`

**Vue2 源码坐标:** `33b05636:src/views/Photos/PhotosAlbumDetail.vue:145-300`（侧栏三节）
+ `:591-613`（`placesAgg`/`placesLabel`/`placesTitle`）+ `timeSpanLabel`

**建立:**
- About 节：`.sv-side-section` > `h3` + 四行 `.mo-about-row`（Type / Created / Time span / Place）
- Stats 节：**从 4 格裁到 2 格**（Photos / Videos），删掉 Span 与 Created 两格
- 按月直方图：**保持不动**（P2b Task 6 已建）

**新增 computed（照靶子实现，不要自创）:**
- `timeSpanLabel`：优先 `album.dateRange`；缺失时按已加载成员 `takenAt` 现算最早/最晚；都没有用占位符
- `placesAgg`：对已加载成员的 `p.place` 计频，按频次降序（E9：字段存在）
- `placesLabel`：前 3 个用 ` · ` 连接，多出的写 `+N`；空则占位符
- `placesTitle`：全部地点带计数，`name (count)` 用 ` · ` 连接；空则空串（给 `:title` 用）

**适配点:**
- Vue2 的占位符是字面量 `'—'`。New-UI 若已有占位符常量则复用；没有就用同一个 em dash，
  并让 T3 的「createdLabel 为占位符时不渲染 created span」与它判定一致 ——
  **两处必须用同一个来源**，否则改一处会静默漏另一处。

- [ ] **Step 1: 写失败测试**

```ts
describe('P2c detail sidebar', () => {
  it('renders the About section with type, created, time span and place rows', async () => {
    const w = await mountDetail()
    const rows = w.findAll('.sv-side-section .mo-about-row')
    expect(rows).toHaveLength(4)
  })

  it('shows the top three places joined by a middle dot and a +N remainder', async () => {
    // 5 distinct places -> "A · B · C +2", ordered by frequency not by first appearance
  })

  it('orders places by frequency, not by the order they appear in the asset list', async () => {
    // a place appearing once first and a place appearing three times later -> the frequent one leads
  })

  it('puts every place with its count in the title attribute', async () => {
    expect(w.find('[data-test="album-about-place"] b').attributes('title')).toBe('Paris (3) · Rome (1)')
  })

  it('falls back to the placeholder when no member has a place', async () => {
    // and the title attribute must be empty, not the placeholder
  })

  it('derives the time span from loaded members when the album carries no dateRange', async () => {
  })

  it('renders exactly two stat cells, photos and videos', async () => {
    const cells = w.findAll('.sv-stat-grid .sv-stat-cell')
    expect(cells).toHaveLength(2)
  })

  it('keeps the monthly histogram section', async () => {
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — `pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts`

- [ ] **Step 3: 实现侧栏三节 + 三个 computed**

- [ ] **Step 4: 跑测试确认通过** — 同上 + `src/i18n/parity.test.ts src/styles`

- [ ] **Step 5: 变异验证**

1. 把 `placesAgg` 的降序排序去掉 → 「orders places by frequency」应红
2. 把 Stats 恢复成 4 格 → 「exactly two stat cells」应红
3. 空地点时返回占位符而非空串给 `:title` → 「title attribute must be empty」应红

- [ ] **Step 6: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/views/PhotosAlbumDetail.vue src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): give the album detail sidebar an About section and trim its stats"
```

---

