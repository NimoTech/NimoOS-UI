## Task 5: 相册详情 ⋯ 菜单五项 + fixed 定位

**Files:**
- Modify: `src/views/PhotosAlbumDetail.vue`（`aside.sv-detail-side` 顶部）
- Test: `src/views/__tests__/PhotosAlbumDetail.test.ts`

**Vue2 源码坐标:** `33b05636:src/views/Photos/PhotosAlbumDetail.vue:212-283`（五项菜单全文）

**本任务自建 `.sv-side-actions` 容器**（pre-flight 修正：原计划让 T4 建空壳，改由这里连内容一起建），
位置在 `aside.sv-detail-side` 顶部、About 节之上。New-UI 只放 ⋯ 菜单一个按钮
（Slideshow 不做，spec §1.2），容器仍用 `flex-wrap` 形态以便与 SV 详情侧一致。

**Interfaces:**
- Consumes: T1 的 `useFixedMenuPosition(open, btnRef)`；T2 的 `exportAlbumZipUrl` / `duplicateAlbum`

**五项（顺序照靶子，不可调换）:** Rename · Duplicate · Download as ZIP · Convert · Delete

| 项 | 主标题 | desc | 行为 |
|---|---|---|---|
| Rename | `photosMenuRename` | `photosMenuRenameAlbumHint` | 关菜单 + `startTitleEdit()` |
| Duplicate | `photosMenuDuplicate` | `photosMenuDuplicateHint` | T2 的 `duplicateAlbum` |
| Download as ZIP | `photosMenuDownloadZip` | `photosMenuZipHint`（`{n}` = 张数，`{mb}` = `Math.round(count * 3.2)`） | 导航到 T2 的 URL |
| Convert | `photosMenuConvert` | `photosMenuConvertToSmartHint` | 现有 `openConvertModal`，`smartViewDisabled` 时置灰 + title 提示 |
| Delete | `photosMenuDelete` | `photosMenuDeleteAlbumHint` | 现有 `askConfirmDelete`，danger 配色 |

**适配点:**
- 主标题**改短**（`Rename album`→`Rename` 等），desc 行保留原文案区分语境 —— 这是 `#117` 的明确改动。
- Convert 的置灰提示句复用 New-UI 已有的智能视图关闭提示键，**不要新造近义文案**（Vue2 注释明写此意）。
- danger 配色：Vue2 用 `#FF6B5C` 内联，New-UI 用 `.sv-export-item-danger`（本文件 SV 详情侧已有同款）。
- `~{mb} MB` 的 3.2 是 Vue2 写死的每张估算 MB 数，**照抄这个常量**并在注释里登记它是估算而非真实体积。
- ⋯ 按钮需要两个 ref：`morePopRef`（click-outside 判定，已有）与新的 `moreBtnRef`（给 composable 取 rect）。
  **两个都要保留** —— composable 只管定位，不管 click-outside。

- [ ] **Step 1: 写失败测试**

```ts
describe('P2c album more menu', () => {
  it('renders exactly five entries in the target order', async () => {
    const titles = w.findAll('.sv-export-title').map((n) => n.text())
    expect(titles).toEqual(['重命名', '复制', '下载为 ZIP', '转换', '删除'])
  })

  it('duplicates the album and closes the menu', async () => {})

  it('does not fire a second duplicate while the first is in flight', async () => {})

  it('navigates to the zip url built by the service', async () => {})

  it('shows the estimated size in the zip entry description', async () => {
    // 10 photos -> "10 张照片 · 约 32 MB"
  })

  it('disables Convert and shows the smart-views-off title when the feature is off', async () => {})

  it('keeps Convert clickable when the feature is on', async () => {})

  it('applies the fixed position style to the menu when it opens', async () => {
    expect(w.find('.sv-export-menu').attributes('style')).toContain('position: fixed')
  })

  it('closes the menu when clicking outside it', async () => {
    // regression: morePopRef must still work now that the menu is position:fixed
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现菜单五项 + 接线 composable**

- [ ] **Step 4: 跑测试确认通过** — `pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/parity.test.ts src/styles`

- [ ] **Step 5: 变异验证**

1. 调换 Duplicate 与 Download as ZIP 的顺序 → 「five entries in the target order」应红
2. 去掉 `smartViewDisabled` 的 `:disabled` → 「disables Convert」应红
3. 不把 `menuStyle` 绑到菜单根节点 → 「applies the fixed position style」应红

- [ ] **Step 6: 类型检查 + 提交**

```bash
pnpm exec vue-tsc --noEmit
git add src/views/PhotosAlbumDetail.vue src/views/__tests__/PhotosAlbumDetail.test.ts src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "feat(photos): align the album menu on the five-entry shape"
```

