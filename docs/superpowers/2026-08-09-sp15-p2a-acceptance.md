# SP15-P2a 验收清单 —— 智能视图手动加/移/恢复照片,已收官,真机验收未跑

**状态**:4 个任务全部完成(机主拍板的轻流程:合并任务,不做逐任务评审,只做收尾)。
收尾六门全绿(控制器亲自复跑)。第 4 任务顺带修掉一个 P1 遗留的可见缺陷(见下方)。
**未部署、未推 origin、未合 master。真机验收一步没跑。**

分支 `sp15-photos-moments`(接着 P1 往下做,不另开分支)。
计划:`docs/superpowers/plans/2026-08-09-sp15-p2a-smartview-manual-assets.md`
设计:`docs/superpowers/specs/2026-08-09-sp15-p2a-smartview-manual-assets-design.md`
台账:`.superpowers/sdd/2026-08-09-sp15-p2a-smartview-manual-assets/`(4 份简报 + 4 份实现报告 + progress.md)

收尾门(控制器亲自复跑,工作树干净时):

| 门 | 结果 |
|---|---|
| `pnpm exec vue-tsc --noEmit` | clean(exit 0,零输出) |
| `pnpm test` | **682 文件 / 10849 例全绿**(known flake 噪声若干,见下) |
| `pnpm exec vitest run src/i18n/parity.test.ts` | **1 文件 / 9 例全绿** |
| `node oss/export.mjs --out <tmp> --no-commit --allow-dirty-oss` | 零真实泄漏(DELETE 78 · REPLACE 4 · PATCH 258;3 个二进制文件按预期跳过内容扫描) |
| `pnpm build` | ✓ 37.73s(仅既有的 chunk-size 提示,与本期无关) |
| `pnpm exec vitest run src/styles`(color-guard) | **4 文件 / 1075 例全绿** |

> **本次复跑踩到一次真失败,已就地修掉**:第一轮 `pnpm test` 与 `oss` 门都因 Task 4
> 新增的 `src/views/__tests__/PhotosMomentDetail.selectionHighlight.test.ts` 而红——
> 相册区的视图测试清单是逐个文件枚举的(`oss/manifest.mjs`),这份测试没登记,产物树上
> 因此保留了一个 import `src/photos/**`(已被整体剥离)的文件,`vue-tsc` 在产物树上报
> `Cannot find module`。这正是 Task 3 报告里记录的同一类遗漏的第四次。修法同前例:把
> 这一个文件路径加进 `VIEW_DELETE` 枚举表。补丁提交(`64e8486`)之后六门全部重跑到干净。

> **`oss` 门有个前置条件容易踩**:它断言工作树干净。台账 `progress.md` 只要有未提交改动,
> 这门就会在检查阶段直接报「工作树不干净」并跳过泄漏扫描。先提交台账再跑,**不要 stash 绕过**。

已知 flake(出现但与本期无关,不追):jsdom `Not implemented: navigation` 噪声(`favorites.test.ts`
的导出跳转、路由测试的整页跳转)、`DesktopContextMenu.test.ts` 单跑时失败、`persist.test.ts:55`
偶发红。本次全量跑没有撞见后两个,第一个照常出现但不影响 682/682 通过计数。

## CSS 注释自查

`grep -n '\*/' <文件>` 逐条读过本期改动的每一个文件(`oss/manifest.mjs`、
`packages/service/src/photos.ts`、两个 i18n 分片、`PhotosLibraryPicker.vue`、
`smartViews.ts`、`assetToPhoto.ts`、`PhotosAlbumDetail.vue`、`PhotosAlbums.vue`、
`PhotosMomentDetail.vue`、`PhotosSmartViewDetail.vue`,以及 4 个测试文件)。
**每一处 `*/` 都紧跟在完整语句/完整中文句末尾,没有一处「`*` 紧贴 `/`」提前把注释腰斩**——
逐条读下来,注释内容与其后的规则/代码都是连贯的,没有断句证据。

---

## 🔴 第 0 步(必做,否则「已排除」分节永远不会出现)

**本机既有的 9 个智能视图全部是语义(`semantic`)条件、`live=0`、从未评估过**,
`smart_view_matches` 是 **0 行**。这 9 个是 SP7 验收期反复点击留下的测试数据。

五种条件类型(`person`/`place`/`date`/`semantic`/`ocr`)里,**只有 `semantic` 走 CLIP 文本
向量**,而 CLIP 文本侧撞的是本机已知的模型缺陷(BE-1,`text.token_embedding.weight` 缺失)。
`date` 条件走纯 SQL,不依赖 CLIP。

⇒ **验收前必须先在界面上新建一个「日期」条件的智能视图并置为 live**,等它评估出真正的
自动匹配行,才能验到下面第 6 步「已排除」相关的内容。

## 🔴 第 1 行提示:「已排除(N)」在旧的 9 个视图上永远不会出现

后端 `RemoveAssets` 是**分层**的(`service/smartview.go`,资产上的 `origin` 字段:
0=自动匹配 / 1=手动钉住 / 2=已排除):

| 被移除的行 | 结果 |
|---|---|
| `origin=1`(手动钉住) | **直接 DELETE**(取消钉住),返回 `unpinned+1` |
| `origin=0`(自动匹配) | `UPDATE origin=2`(排除),返回 `excluded+1` |

⇒ **只有移除一张「自动匹配」的照片才会产生一条排除行。** 在旧的 9 个视图上手动加进去再
移除,走的永远是「取消钉住」那条分支,**「已排除」分节不会出现——这是数据不足,不是本期
缺陷。** 只有在第 0 步新建的那个日期视图上,评估出的自动匹配照片被移除,才能撞见这条路径。

---

## 验收步骤

### A. 加照片(`sv-add-photos` 按钮 → picker → 确认)

1. 打开一个智能视图详情页,点顶栏「加照片」按钮,应弹出照片库选择器,标题带视图名
   (「添加照片到「{name}」」)。已在该视图里的照片应是禁用/置灰状态,不可重复选。
2. 选几张,点提交(「添加(N)」,N 跟着已选数字变化,不是写死文案)。
   成功后应关闭 picker,弹「已添加」类 toast,**张数变化要同时体现在**:
   - 详情页头部的统计条(`sv-stat-count`)
   - 回到列表页后对应视图的卡片上的张数
3. **加照片失败**(断网重试):应弹失败 toast(`danger` 档),**picker 保持打开**,
   不应把用户已经选好的照片扔掉重来一遍。

### B. Pin 角标

4. 手动加进去的照片,在「最近添加」与「全部匹配」**两个网格**里都应能看到 pin 角标——
   这与 moments 详情页不同(那边角标只在 Featured 段出现,这里两个网格都有,已按此实现)。
5. 自动匹配、从未手动钉住的照片不应有 pin 角标。

### C. 选择态与移除

6. 点「选择」(`sv-select-toggle`)进入选择态,点几张瓦片,底部应出现选择栏
   (`sv-select-bar`)显示已选数量。
   **选择态下点瓦片只切换选中,不应打开灯箱**——非选择态下点同一张瓦片应正常打开灯箱。
7. 选好之后点「从此视图移除」:
   - **成功**:退出选择态、清空已选,选择栏消失;张数相应减少;若移除的是自动匹配的照片
     (前提是第 0 步的日期视图),应在下方出现「已排除(N)」分节。
   - **失败**(断网重试):**应保持选择态与已选不变**,让用户能直接重试,不应把选择清空。

### D. 已排除分节(**前提:已完成第 0 步**)

8. 分节默认**折叠**,标题条上有「N 已排除」+ 一个「展开/收起」的小标签。
9. 点标题条展开,应看到一个独立的网格,每张缩略图叠着「恢复」提示文字。
10. 点其中一张,应立即恢复(无二次确认)——恢复后:
    - 该照片应从「已排除」网格里消失,**回到「全部匹配」网格**
    - 若已排除分节因此变空,分节应整体消失(不留空壳)
11. **恢复失败**(断网):应弹失败 toast,该照片留在已排除网格里不消失。

### E. 浅色与深色两套主题(jsdom 完全照不出,必须真机看)

12. **切 `data-theme` 看两遍**,重点看两处压在照片内容之上、写死 `#fff` + 附
    `theme-exception` 注释的地方:
    - pin 角标图标颜色(`.sv-pin-tag`,固定深色圆底 + 白色图钉图标)
    - 已排除网格里的「恢复」提示文字(`.sv-restore-hint`)
    两处的理由都是「压在不可预测的照片内容之上,底是固定深色徽章,不能跟着浅色主题变浅」——
    看清楚浅色主题下这两处有没有意外被主题切换影响、白字有没有被非固定底色的地方糊掉。
13. 选中态的 accent 描边 + 蒙版(`.tile[data-selected="true"]`)在两套主题下都应可见——
    蒙版是 `color-mix(in srgb, var(--accent) 20%, transparent)`,浅色主题下 accent 本身
    偏浅,确认蒙版不会浅到几乎看不出选中态。

### F. Task 4 顺带修的一个 P1 遗留缺陷 —— moments 详情页的选择高亮

14. **本步验的不是本期新功能,是 P1 遗留、本期顺手修的一个真缺陷**:打开一个时刻
    (`/app/#/photos/moments/<id>`),点「Select」进入选择态,点几张瓦片选中。
    **修前**:瓦片左上角会出现选中打勾角标,但瓦片本身**没有任何高亮**(无描边、无蒙版)——
    因为模板上的 `:data-selected` 从一开始就没有一条能命中它的 CSS 规则(唯二存在的
    `[data-selected]` 规则分别锁在 `PhotosGrid.vue`/`PersonAssetGrid.vue`/
    `PhotosLibraryPicker.vue` 各自的**局部作用域**样式里,没有一条覆盖这一页自己的瓦片)。
    **修后**:选中的瓦片应有一圈 accent 描边 + 淡淡的 accent 色蒙版,与智能视图详情页选中
    态视觉一致。

---

## 本期对 Vue2 的有意偏离(界面 1:1,逻辑改正确)

登记在 `src/views/PhotosSmartViewDetail.vue` 文件头,摘要:

| 偏离 | 理由 |
|---|---|
| picker 关闭责任方从子组件改为父组件 | Vue 3 的 `emit()` 拿不到 handler 返回值,「失败不关」只能由父组件在成功分支显式关闭 |
| 切视图 `:id` 时重置选择态/已选/picker/已排除展开 四个状态 | New-UI 走真路由、组件不重建,不重置会把上一个视图的选择带进下一个 |
| `removeSelected` 不额外重刷统计 | 三个写 action 已在 store 内部内置回拉,调用处再刷一次是多发请求 |
| 失败 toast 走本仓既有 `danger` 变体 + 2500ms | 不照抄 Vue2 的珊瑚红字面量 |
| pin 图标复用本文件已有的轮廓图钉路径 | 不引入 Vue2 独立的实心水滴 `pin` 图标,同 `PhotosMomentDetail.vue` 的既有处置 |

---

## 已知挂账(不在本期修)

- **本期在真机上如果第 0 步走不通,「已排除 + 恢复」两条路径整体挂账**,不假装验过
  ——参照 SP14 `#136`/`#141` 的先例。
- **移除按钮的 `:disabled` 绑的是 `store.assetBusy`**,三个写 action 共用同一把锁,
  这也同时挡住了「移除在途时点 picker 提交」——这是 Task 1 的既有设计,值得真机确认
  这个耦合是不是想要的行为,不是本期新引入的缺陷。
- 三个功能提交(`e702f2c`/`f8000b6`/`ba3c0ec` 一组)与本次收尾提交均**未推 origin、未部署**。
- P1 遗留的 `PhotosMomentDetail.vue` 抽 grid 子组件的独立票依旧挂着,本期同样没有碰这个决定
  (Task 4 对该文件的改动只是补一条 CSS 规则 + 一份测试,不涉及结构重构)。
