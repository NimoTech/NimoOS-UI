# SP15-P2c 整支终审 · 修复轮报告（FINAL fix wave）

分支 `sp15-photos-moments`，代码提交 `136582d`，台账提交见文末。
本轮是**唯一一轮**整支终审修复，终审提出的 6 条（Important 1-5 + Minor 6-9）全部处理。

---

## 一、逐条：改了什么、改在哪

### Important 1 —— 相册页的「排序菜单卡住」缺陷（智能视图页早已修好）

**根因**：排序药丸整组在 `<template v-if="!edit">` 里，弹层只靠 document 上的 `mousedown`
关闭；用**键盘**（Space/Enter）激活「编辑」按钮只发 `click`、不发 `mousedown`，于是
`sortMenuOpen` 保持 `true` 而药丸被卸载 —— 一退出编辑态，弹层就在没有可见触发点的情况下
自己弹回来。

**改动**：
- `src/views/PhotosAlbumDetail.vue` · `toggleEditMode()` 末尾加 `sortMenuOpen.value = false`
  （与 `PhotosSmartViewDetail.vue` 的 `toggleEdit()` 同款），并把智能视图页那段解释根因的
  注释按本页语境重写了一份。
- `src/views/__tests__/PhotosAlbumDetail.test.ts` 新增 describe
  `P2c whole-branch review fixes` → 用例
  `does not leave the sort menu stuck open after toggling edit mode via the Edit button`，
  从智能视图页 `PhotosSmartViewDetail.test.ts` 那条移植而来（VTU 的 `.trigger('click')`
  本身就不带合成 mousedown，形状与真实键盘激活一致，不需要额外事件铺设）。

**变异验证（做了）**：删掉 `sortMenuOpen.value = false` 一行 → 该用例**变红**：

```
expect(w.find('[data-test="album-sort-menu"]').exists()).toBe(false)
 Test Files  1 failed (1)
      Tests  1 failed | 82 skipped (83)
```

已还原（还原后与变异前文件逐字节 `diff` 相同，已确认）。

---

### Important 2 —— Convert 菜单项渲染了弹窗的副标题

靶子里这是**两句不同的文案**：
- 菜单项 desc：`Turn into a Smart Album that keeps updating`（`33b05636` `PhotosAlbumDetail.vue:266`，
  中文见同 commit `zh_CN.json:2836`）
- 转换弹窗副标题：`Nimo keeps adding matches automatically`（同文件 `:375`）

New-UI 只有后者一个键（`photosAlbumConvertToSmartHint`），菜单项一直指着它。
计划的 i18n 表里其实**写了**这个新键（`docs/superpowers/plans/2026-08-10-sp15-p2c-album-detail-polish.md:94`），
只是从未创建。

**改动**：
- 新增键（见下方 §二）；`src/views/PhotosAlbumDetail.vue:912` 一带的 `sv-export-desc`
  改指新键。
- `src/photos/components/AlbumConvertToSmartDialog.vue:126`（弹窗副标题）**未动** —— 它是
  旧键的合法消费方。
- 新增断言（`PhotosAlbumDetail.test.ts`，`P2c album more menu` describe 内）：
  `describes the Convert entry with the menu string, not the convert modal subtitle`
  —— 读的是**渲染出来的 desc 文本**并同时断言它**不等于**弹窗副标题（只断言键名的话两边都能过）。

---

### Important 3 —— 编辑态浮条宣传了它自己没有的能力

`editHintText` 复用了 `tileHintTitle` 的键，于是浮条上出现「· ★ 设为封面」，而浮条上
根本没有设封面这个动作（那是单张照片的 tooltip）。靶子把两者**刻意分开**：
浮条 `33b05636:PhotosAlbumDetail.vue:330`，tooltip 在 `tileTitle()` `:799-800`；
`zh_CN.json` 四句各有其键。智能视图页的浮条本来就用的是纯 `photosSvClickToSelect`，
所以这同时是一处跨页不对称。

**改动**：
- `editHintText` 改为：手动排序分支 → 新键 `photosAlbumHintSelectDrag`；
  其余分支 → 复用已存在的 `photosSvClickToSelect`（与智能视图页同键、且已逐字承载靶子的
  `Click to select`）。`tileHintTitle` 保持不变，仍用两个 `*Cover` 键。
- 测试：`shows the select bar in edit mode even before anything is selected` 与
  `clears the selection when leaving edit mode…` 两处断言改指新键，并补了一条
  `.not.toContain('★')`。

**顺带改正的一处措辞漂移（请评审看一眼）**：靶子 `zh_CN.json` 里三句都写「拖**动**排序」，
而 New-UI 既有的 `photosAlbumHintSelectDragCover` 写的是「拖**拽**排序」。新键按铁律取靶子
原值（拖动），若不同时把既有那条对齐，**同一个页面上会同时出现「拖动排序」和「拖拽排序」
两种说法**，所以把 `photosAlbumHintSelectDragCover` 的中文一并对齐成靶子原值。
这条严格说超出终审那 6 条的字面范围（终审的「不许修」清单里列的是
`photosAlbumNameExists`/`photosAlbumDeleteHint` 那对，不含这条，且这条的消费方就是本页本期
代码），改动 1 行、无消费方之外的影响。**如果评审认为不该动，回退这一行即可**，新键本身
不受影响。

---

### Important 4 —— 相册「⋯」菜单没有开合动画，且记录在案的理由是错的

`PhotosSmartViewDetail.vue:966-970` 原注释称「相册页没有 transition，以靶子为准」。
**这句话对靶子的陈述是错的**：`33b05636:src/views/Photos/PhotosAlbumDetail.vue:223`/`:278`
把相册菜单包在**一模一样**的 `<transition name="sv-menu">` 里。

**改动**：
- `PhotosAlbumDetail.vue`：菜单外包 `<Transition name="sv-menu">`，并在本文件 scoped
  `<style>` 里补上 `.sv-menu-enter-active/.sv-menu-leave-active` 与
  `.sv-menu-enter-from/.sv-menu-leave-to` 两条（scoped 样式不跨文件，只能各写一份；
  取值与 `PhotosSmartViewDetail.vue:1393-1394` 逐字相同，源自
  `photos-smartview.scss:454-455`）。
- `PhotosSmartViewDetail.vue:966-970`：**按要求改正而不是删除**那段注释 —— 保留推理链，
  把「靶子的相册页没有 transition」这句事实改成「有，且已经补齐，两页现在动画一致」。

`<Transition>` 包裹不影响既有断言：jsdom 里没有 CSS 过渡时长，Vue 的 leave 同步完成，
`w.find('[data-test="album-menu"]').exists()` 仍能在关闭后立刻读到 `false`
（智能视图页的同款菜单本来就带 `<Transition>`，其关闭断言一直是绿的，这是先例）。

---

### Minor 6 —— 清理孤儿键 `photosSvAddedThisWeek`

**先 grep 确认**（按此前清扫的做法）：

```
$ grep -rn "photosSvAddedThisWeek" src/ oss/ docs/
src/i18n/en_us.photos.ts:653
src/i18n/zh_cn.photos.ts:660
src/i18n/zh_cn.photos.ts:1011   ← 只是一句「中文取自它」的注释引用，不是消费方
docs/superpowers/plans/2026-08-09-sp15-p1-photos-moments.md:987  ← 计划文档
```

`src/` 里零 `t('photosSvAddedThisWeek')` 消费方（原消费方 `SmartViewCard.vue` 已于 Task 10
删除）。两个 locale 各删 1 行，并把 `zh_cn.photos.ts:1011` 那句悬空引用改写（它引用的键
已不存在）。

---

### Minor 7 —— 对勾图标 1:1 修复此前两页都没有回归覆盖

**改动**：两页各加一条同形用例
`gives every sort option a check slot and the glyph only to the active one`
（`PhotosAlbumDetail.test.ts` 的 `P2c whole-branch review fixes` describe /
`PhotosSmartViewDetail.test.ts` 的 Task 6 describe），各断言两半：
1. 每个选项**恰好一个** `.album-sort-check` / `.sv-sort-check` 槽位；
2. 只有 `data-active="true"` 那一项的槽位是 `svg`（其余是空 `span`）；
3. 附带断言 active 项恰好一个。

**变异验证（做了）**：把两页模板里的空 `<span v-else class="...-sort-check" />` 各删掉 →
**两条都变红**：

```
 Test Files  2 failed (2)
      Tests  2 failed | 179 skipped (181)
```

已还原（还原方式见下方「一处操作事故」）。

---

### Minor 8 —— 本期新写代码里的失效引用

`src/photos/stores/albums.ts:223`：`albumToView.ts:61` → `albumView.ts:61`
（函数名叫 `albumToView`，文件名是 `albumView.ts`；行号 61 本身是对的，已核 —— 该行确为
`title: (a.name as string) || (a.title as string) || untitled,`）。
全仓再 grep 一遍 `albumToView`，其余出现处都是**函数名**引用，不是文件名，无需改。

---

### Important 5 + Minor 9 —— 验收清单（保持中文）

`docs/superpowers/2026-08-10-sp15-p2c-acceptance.md`。

**（a）第 36 行的「先塞照片」指错步骤**：那段说明在**第 10 步开头**的引用块，不是第 9 步
（第 9 步是相册→智能相册转换）。已改指第 10 步，并把「这是最容易被跳过的前置条件、跳过会
让好页面看起来什么都没发生」写进正文。

**（b）第 71 行的共同起点漏列**：原文只列 3/4/5/6/7/8。已改为列全
（2/3/4/5/6/7/8 + 第 12 步最后一项），并给这个相册起了名字「**相册 A**」，让后面所有引用
有一个可指代的对象。

**（c）第 9 步会把第 13 步的起点吃掉 —— 本轮的决策**

> **决策：采用「第 9 步改用第二张相册」这一支，同时把第 12/13 两步对调。**

理由：
- 终审给的两个选项里，「第 9 步后移到第 13 步之后」只能解决 9→13 这一处，**解决不了我另外
  发现的一处同类冲突**：原第 12 步（智能视图 → 普通相册）会把**第 10 步那个已塞过照片的
  智能视图**冻结掉，而原第 13 步（灯箱顺序）的起点正是「第 10 步的页面（已塞过照片）」。
  也就是说原文档里有**两处**「前面的步骤销毁后面步骤的起点」，终审只点出了其中一处。
- 「第 9 步改用相册 B」保住了相册 A（第 1 步那个共同起点），编号与结果表都不用动；
- 「12/13 对调」让**灯箱顺序（不销毁任何东西）排在反向转换（销毁智能视图）之前**，
  这样两处冲突一起消失，且第 10 步「接第 9 步」的叙事流不被打断。

具体改动：
- 第 9 步：加醒目警告「这一步会把源相册消耗掉，不要用相册 A」，点击路径改为「回到
  `/app/#/photos/albums` 另点一张手动相册（相册 B）」。
- 第 12 步 ← 原第 13 步（灯箱顺序），并在开头加一段「顺序说明」讲清为什么它排在反向转换
  之前；最后一项明确写「回到相册 A，即第 1 步那个页面 …（相册 A 此刻仍在 —— 第 9 步用的
  是相册 B）」。
- 第 13 步 ← 原第 12 步（反向转换），点击路径改为「第 10 步的页面（第 12 步验完后仍停在
  这里）」，收尾那条「删掉中间产物」由「第 9 步和第 12 步」改成「第 9 步和第 13 步」，并
  写明是哪两个产物。
- 结果表 12/13 两行随之对调。

**（d）改完后逐条重查的每一处交叉引用**（`grep -n "第 [0-9]* 步"` 全量过了一遍）：

| 位置 | 引用 | 结论 |
|---|---|---|
| :36 | 「做法见第 10 步开头」 | 已改，正确 |
| :38 | 「第 10 步和第 12 步」（缺照片会看起来没反应的两步） | 新写，第 12 步现在是灯箱步，成立 |
| :45 | 「第 1 步给了点击路径」 | 未受影响 |
| :70 | 「第 0 步『⛔ 不允许为空』」 | 未受影响 |
| :73/:75/:76 | 相册 A 的共同起点 + 第 9 步用相册 B 的警告 | 新写 |
| :80/:94/:102/:122/:144/:159/:172 | 第 2/3/4/5/6/7/8 步「第 1 步的页面」 | 相册 A 未被消耗，全部仍成立 |
| :129 | 第 5 步菜单第 4 项 desc 里提到「不是第 9 步弹窗的副标题」 | 新写（Important 2 的配套） |
| :184 | 第 9 步「不是第 1 步那张」 | 新写 |
| :200 | 第 10 步「接第 9 步」 | 仍成立（第 9 步照样产出一个智能视图） |
| :203 | 「第 0 步第 3 条」 | 未受影响 |
| :214 | 「和第 2 步相册页那个下拉长得一模一样」 | 相册 A 仍在，成立 |
| :221 | 第 11 步「第 10 步的页面」 | 第 13 步（反向转换）在其后，成立 |
| :236 | 「第 5 步相册页的菜单」 | 相册 A 仍在，成立 |
| :241 | 第 12 步顺序说明引用第 13 步 | 新写 |
| :244 | 第 12 步「第 10 步的页面（已塞过照片）」 | 第 13 步在其后，成立 |
| :253/:255 | 第 12 步末项回到相册 A | 新写，成立 |
| :259 | 第 13 步「第 10 步的页面（第 12 步验完后仍停在这里）」 | 新写 |
| :267 | 「第 9 步和第 13 步产生的中间产物」 | 已从「第 12 步」改正 |
| :291/:293 | 第 15 步 | **原文「回到第 1 步和第 10 步两个详情页」在新顺序下已失效**（第 10 步那个智能视图第 13 步被转走了），改为「相册 A + 任意一个智能视图详情页」，并加注说明 |
| 结果表 | 12/13 两行 | 已对调 |
| 文末「六道门」 | 原指 `task-11-report.md` | 改为同时指向本报告与 task-11 报告 |

**（e）本轮代码改动带出的两处文案更新**（否则机主会照旧文案把新行为记成缺陷）：
- 第 4 步 `:103`：浮条提示由「点击选择 · 拖拽排序 · ★ 设为封面」改为「**点击选择 · 拖动排序**」，
  并写明「不含 ★ 设为封面，那句只在单张照片 tooltip 里」（Important 3）。
- 第 5 步菜单第 4 项：desc 由「Nimo 会自动持续加入匹配的新照片」改为
  「**转为持续自动更新的智能相册**」，并注明它**不是**第 9 步弹窗的副标题（Important 2）。

---

## 二、新增 / 删除的 i18n 键

全部取自靶子 `33b05636:src/assets/lang/zh_CN.json`，无自拟。

| 键 | en | zh（靶子出处） | 用途 |
|---|---|---|---|
| `photosAlbumMenuConvertHint` | `Turn into a Smart Album that keeps updating` | `转为持续自动更新的智能相册`（zh_CN.json:2836） | 相册「⋯」菜单 Convert 项的 desc（Important 2） |
| `photosAlbumHintSelectDrag` | `Click to select · Drag to reorder` | `点击选择 · 拖动排序`（zh_CN.json:2011 一带） | 编辑态浮条手动排序分支（Important 3） |

**改值**：`photosAlbumHintSelectDragCover` 中文 `点击选择 · 拖拽排序 · ★ 设为封面`
→ `点击选择 · 拖动排序 · ★ 设为封面`（对齐靶子，理由见 Important 3 段末）。

**删除**：`photosSvAddedThisWeek`（zh + en 各 1 行，Minor 6）。

> 计划表里给这个 desc 起的名字是 `photosMenuConvertToSmartHint`；本仓实际落地的同批键
> 全部走 `photosAlbum*` 前缀（`photosAlbumMenuConvert` / `photosAlbumDuplicateHint` …），
> 所以取名 `photosAlbumMenuConvertHint` 与已落地的兄弟键保持一致，**值**严格照计划表 = 照靶子。

---

## 三、门（每一门的实际数字）

### 3.1 指定的针对性测试（前台单次阻塞跑）

```
pnpm exec vitest run src/views/__tests__/PhotosAlbumDetail.test.ts \
  src/views/__tests__/PhotosSmartViewDetail.test.ts \
  src/views/PhotosSmartViewDetail.assets.test.ts \
  src/views/__tests__/PhotosAlbums.test.ts \
  src/i18n/parity.test.ts src/styles

 Test Files  9 passed (9)
      Tests  1330 passed (1330)
```

**文件数核对（按要求，不只看绿）**：显式点名 5 个文件 + `src/styles` 下 4 个
（`color-guard.test.ts` / `selectPopup.test.ts` / `theme.sp9.test.ts` / `wallpaper.css.test.ts`）
= **9**，与 `Test Files 9` 吻合，没有静默跳过。

### 3.2 类型检查

```
pnpm exec vue-tsc --noEmit   → 退出码 0，零输出
```

### 3.3 干净工作树上的其余门（两次提交落地后跑，前台单次阻塞）

| 门 | 命令 | 实际结果 |
|---|---|---|
| 工作树干净 | `git status --short` | **空输出**（代码提交 `136582d`、台账提交 `73ae2c3` 之后） |
| 全量测试 | `pnpm test` | **685 文件 / 10958 例全部通过**，耗时 174.44s，零失败零跳过 |
| 开源导出 | `pnpm exec vitest run oss/` | **8 文件 / 149 例通过**，15.23s |
| 构建 | `pnpm build` | **✓ built in 16.99s**（vue-tsc 先行、零类型错误；只有既有的 chunk >500kB 体积提示，非本轮引入） |
| 与 master 合并预演 | `git merge-tree --write-tree master HEAD` | 退出码 **0**，输出**单行 tree OID** `588ddf759d814b106bf6209cb9a898d3e4f7f3c8` ⇒ **与 master 无冲突** |
| 类型检查 | `pnpm exec vue-tsc --noEmit` | 退出码 0，零输出（见 §3.2） |

对比基线：Task 11 那次是 683 文件 / 10930 例一带（见 `task-11-report.md`）；本轮净增
的是新写的 3 条用例（相册页 2 条 + 智能视图页 1 条），其余增量来自 `pnpm test` 与
针对性子集的统计口径不同。

---

## 四、一处操作事故（记下来防复发）

做 Minor 7 的变异验证时，我用 `git checkout -- src/views/PhotosSmartViewDetail.vue` 还原被
删掉的空 `<span>`。这条命令把该文件还原到了 **HEAD**，顺手把本轮 Important 4 那段
**注释改正也一并抹掉了**（当时那处改动还没提交）。已重做并用 `git diff` 逐行确认该文件
最终只含注释改正这一处。

教训：**变异验证的还原，只能还原被变异的那一处**（备份该文件再 `cp` 回去，或反向 patch），
`git checkout --` 会连同本轮尚未提交的其它改动一起丢。相册页那一侧我恰好先 `cp` 了备份，
所以还原后能用 `diff` 证明与变异前逐字节相同；智能视图页那一侧没有备份，才踩了这一下。

---

## 五、没有修的（连同理由）

「明确不在本轮」清单里的 9 项全部**未动**：`photosAlbumNameExists`/`photosAlbumDeleteHint`
措辞漂移、智能视图 Duplicate 的「请求被丢弃却仍弹成功 toast」、12 处 `SmartViewCard.vue`
失效引用、`ExportToast.icon: 'plus'` 与 `exportSmartViewAlbum` 测试 mock 残留、
`.sv-action-btn:disabled` 0.45 vs 0.5、h1 的 `font-family`、`min-width: 32px` vs 36px、
路由 watcher 不重置 `convertOpen`/`confirmDelete`、智能视图 watcher 不重置
`titleEdit`/`titleDraft`、两页 Escape 语义差异。

**其中我认为有一条值得单独开票（但本轮按要求没改）**：智能视图页 Duplicate 的
「请求被守卫丢弃却照样弹成功 toast」是会**误导用户**的（用户以为复制成功，回列表却没有新
卡片）。它确实是本期之前就存在的问题、也确实需要自己的票，但它的用户可见性高于清单里其余
八条，建议开票时排在前面。其余八条我同意维持挂账。

---

## 补记

六道门的实际数字已回填进 §3.3，本报告无待补项。
