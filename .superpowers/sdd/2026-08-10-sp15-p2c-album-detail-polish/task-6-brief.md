## Task 6: SV 详情头部动作排重排 + Sort/密度新建

**Files:**
- Modify: `src/views/PhotosSmartViewDetail.vue`（`.sv-actions` `:663-705`）
- Test: `src/views/PhotosSmartViewDetail.test.ts`（或该页现有的测试文件，以实际文件名为准）

**Vue2 源码坐标:** `33b05636:src/views/Photos/PhotosSmartViewDetail.vue:45-90`

**⚠️ E7：New-UI 的 SV 详情完全没有 Sort 与密度控件 —— 本任务是新建，不是搬家。**

**终态头部 `.sv-actions` 排布:**
`Sort:` + 排序胶囊（`!edit`）→ 分隔线 → **Pause/Resume**（常驻）→ **Edit·Done**（常驻）→ 分隔线 → 密度二钮（`!edit`）

**排序选项（SV 侧只有两项，与相册侧的三项不同）:** `Match score`(`photosSortScore`) / `Date taken`(`photosSortTaken`)

**密度枚举值必须与相册侧一致**（T3 已确定沿用 New-UI 现值 `'comfortable'` / `'compact'`，
而不是 Vue2 的 `'comfort'`）。两页不一致会让共享的 `.density` CSS 与 `data-active` 判定各写一套。

**搬走的（去向 T7）:** Refine in search、⋯ 菜单
**改形态的:** Add photos + Select → 由 Edit·Done 一个按钮进出编辑态；Add photos 落到编辑态底部浮条

**适配点:**
- P2a 建的 `selecting` 状态与 `sv-select-bar` 已存在 ⇒ Edit·Done 复用 `selecting` 语义还是新建 `edit`，
  由实现者读完现有代码决定，**并在注释里登记选择理由**。若复用，注意按钮文案从「选择/取消」变成
  「编辑/完成」，对应键从 `photosPersonSelect`/`photosCancel` 换成 `photosSvEdit` 一类 ——
  **文案键换了，就要 grep 旧键是否还有别的消费者**。
- P2a 的既有测试会因选择器/文案变化而红：**逐条搬家，不是删除**，报告里逐条点名（同 T3 Step 4）。

- [ ] **Step 1: 写失败测试**

```ts
it('renders sort and density in the header outside edit mode', async () => {})
it('offers match score and date taken as the two sort options', async () => {})
it('keeps pause and edit visible in edit mode while sort and density disappear', async () => {})
it('no longer renders refine-in-search in the header', async () => {})
it('enters and leaves edit mode from the single edit toggle', async () => {})
it('shows add-photos in the bottom select bar rather than the header', async () => {})
```

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 搬家 P2a 既有测试，逐条点名**
- [ ] **Step 5: 跑测试确认通过**
- [ ] **Step 6: 变异验证** —— 让 Sort 在编辑态也渲染 → 对应用例应红；把 Refine 留在头部 → 「no longer renders」应红
- [ ] **Step 7: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/views/PhotosSmartViewDetail.vue src/views/PhotosSmartViewDetail*.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): rebuild the smart-view header actions with sort and density"
```

---

