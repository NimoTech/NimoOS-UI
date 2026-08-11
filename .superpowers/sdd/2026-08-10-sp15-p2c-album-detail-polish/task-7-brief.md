## Task 7: SV 详情侧栏动作节 + ⋯ 菜单五项统一

**Files:**
- Modify: `src/views/PhotosSmartViewDetail.vue`（`aside.sv-detail-side` `:850+`、原菜单 `:705-780`）
- Test: `src/views/PhotosSmartViewDetail.test.ts`

**Vue2 源码坐标:** `33b05636:src/views/Photos/PhotosSmartViewDetail.vue:127-225`

**Interfaces:** Consumes T1 的 `useFixedMenuPosition`

**⚠️ 五项菜单在两页是「同一形态、不同后端」，不要跨页复用 T2 的相册版实现:**

| 菜单项 | 相册详情（T5） | 智能视图详情（本任务） |
|---|---|---|
| Duplicate | T2 新写的 `albums.duplicateAlbum` | **已有的 `smartViews.duplicateSmartView`**（`smartViews.ts:342`），不要改用相册版 |
| Download as ZIP | T2 新写的 `exportAlbumZipUrl`（`/albums/:id/export`） | **SV 页现有的 `downloadZip`**（走 `/smart-views/:id/export`），只搬位置不换端点 |
| Convert | 转成智能相册 | 转成普通相册（现有 `askConvertToAlbum`） |

两页的 Convert 是**方向相反**的两件事，共用的只有菜单里的位置与文案键。

**做:**
- 侧栏顶部新建 `.sv-side-actions`：**Refine in search**（从头部搬来）+ ⋯ 菜单按钮
- ⋯ 菜单从「Export 区两项 + 更多区四项」合并成**统一五项**：
  Rename · Duplicate · Download as ZIP · Convert · Delete
  - 原 Export 区的 ZIP（`sv-export-zip`）并入第三项
  - 原 Export 区的「存为静态相册」（`sv-export-album`）—— **打开靶子核对它在终态里是否还存在**；
    Vue2 的第四项 Convert 语义是"转为普通相册"，与"存为静态相册"可能是同一件事的两个入口。
    若是同一件事，合并并在注释里登记；若不是，报告里说明并保留。**不要凭本计划的猜测直接删。**
- 接 T1 的 fixed 定位

- [ ] **Step 1: 写失败测试**

```ts
it('renders the sidebar action section with refine and the more button', async () => {})
it('renders exactly five menu entries in the target order', async () => {})
it('no longer renders a separate export section in the menu', async () => {})
it('applies the fixed position style when the menu opens', async () => {})
it('still closes the menu on an outside click', async () => {})
it('keeps the convert-to-album confirmation flow working from the new entry', async () => {})
```

> 最后一条是防 P2b 那条 Important 复发（转换确认框的主行动配色 + Escape 守卫，E10）。

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: 变异验证** —— 不绑 `menuStyle` → fixed 用例应红；打乱顺序 → 顺序用例应红
- [ ] **Step 6: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/views/PhotosSmartViewDetail.vue src/views/PhotosSmartViewDetail*.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): move the smart-view actions into the sidebar and unify its menu"
```

---

