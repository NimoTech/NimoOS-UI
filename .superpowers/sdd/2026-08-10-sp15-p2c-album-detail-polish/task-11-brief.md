## Task 11: i18n 孤儿清理 + 收尾全量门

**Files:**
- Modify: `src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`
- 台账：`.superpowers/sdd/2026-08-10-sp15-p2c-.../`

**做:**

- [ ] **Step 1: 孤儿键清点**

对 T5/T7 换掉的旧键逐个 grep，**零消费者才删**：

```bash
for k in photosAlbumRename photosAlbumRenameHint photosAlbumConvertToSmart \
         photosAlbumConvertToSmartHint photosAlbumDelete photosAlbumDeleteHint \
         photosAlbumItemsShown photosFavExport photosSvSaveStaticAlbum \
         photosSvRename photosSvDuplicate photosSvConvertToAlbum photosSvDeleteSmartView; do
  echo "== $k: $(grep -rn "$k" src/ --include=*.vue --include=*.ts | grep -v 'src/i18n/' | wc -l) 处消费"
done
```

**注意 `photosMoPhotos` 这类被多页共用的键，删之前务必看清消费者是不是全在本期改动范围内。**

- [ ] **Step 2: 跑 parity** — `pnpm exec vitest run src/i18n/parity.test.ts`

- [ ] **Step 3: 提交 i18n 清理**

```bash
git add src/i18n/zh_cn.ts src/i18n/en_us.ts
git commit -m "chore(photos): drop the i18n keys the menu rework orphaned"
```

- [ ] **Step 4: 提交台账（先删 review-package 重建的 gitignore）**

```bash
rm -f .superpowers/sdd/.gitignore
git add -f .superpowers/sdd/
git commit -m "docs(sp15): record the P2c task ledger and per-task reports"
```

- [ ] **Step 5: 干净工作树上跑六门**

```bash
git status --short          # 必须为空，否则 oss 门报假红
pnpm exec vue-tsc --noEmit
pnpm test
pnpm exec vitest run src/i18n/parity.test.ts src/styles
pnpm exec vitest run oss/
pnpm build
git merge-tree --write-tree master HEAD | head -3
```

六门全绿才算 code-complete。任何一门红都要修到绿，**不要在报告里把红解释成"已知问题"**。

- [ ] **Step 6: 写真机验收清单**

产出 `docs/superpowers/2026-08-10-sp15-p2c-acceptance.md`。**第 0 步必须写明的预期行为**
（spec §5.3，这是 P2b 终审那条 Critical 的直接教训 —— 上一期的验收清单预先声明"空白是预期"，
机主照单验收就会签字通过一个真正坏掉的页面）：

- 真机数据：albums 5 / album_assets 40 / smart_views 9（全 paused，从未评估）/ moments 0
- **Place 行**：相册成员无 GPS 时显示占位符是预期，不是缺陷
- **但**：相册详情页面本身、头部、侧栏三节、⋯ 菜单**必须都能看见** ——
  若整页空白或某一节整块不出现，那是缺陷，不是"数据为空"

清单必须逐条写出**点击路径**（P4 的教训：面板内状态机/弹窗才能到达的屏，不写路径机主找不到）。
重点覆盖：**Download as ZIP 真机点一次**（jsdom 验不出来）· **短视口下侧栏 ⋯ 菜单向上翻转** ·
**编辑态底部浮条** · **Albums 页两种卡片等高**。

- [ ] **Step 7: 提交验收清单**

```bash
git add docs/superpowers/2026-08-10-sp15-p2c-acceptance.md
git commit -m "docs(sp15): write the P2c real-device acceptance checklist"
```

---

## 收尾整支终审

11 个任务全部关账后，对整支 `<base>..HEAD` 做一次 opus 整支终审。**终审人必须拿到的上下文:**

- 靶子是 `33b05636`，比对基准是 Vue2 源码不是本计划
- P2b 终审 8 个 Important 里 6 个是 1:1 视觉破绽（配色/文案/间距/尺寸），任何自动门看不见 ——
  终审要专门看这一类
- 本期删了 `.album-toolbar` 与 `.album-hero` 两个容器，**兄弟选择器与后代选择器的失效是重点**
- P1/P2a/P2b 的终审各逮到过「逐任务评审结构上看不见」的跨任务缺陷（重入守卫缺失、切 id 不清选择态、
  主行动丢配色），本期任务多、跨两个详情页，同类风险更高
