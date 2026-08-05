# P5b · T10 任务书 —— 第 3 刀:多选收口 + 重建 + 双上限 + 弹窗 + 动作条 + 轮询 + 路由反转

## 你在哪

NimoOS 的 Vue2 → Vue3 整库迁移,第 8 期(SP8,AI 区)第 5 阶段第 b 批(P5b)。
**你是 T10,本批最后一个任务,也是最难的一个。**

「已收录文件」页蓝本 826 行,分三刀:T8 → T9 → **T10(你)**。三刀叠加同一个 `.vue` 文件。

- **T8 已落**:骨架 · 过滤条 7 件 · 表头 meta · 错误横幅(K14/K19)· 骨架屏 · 空态(蓝本 `:1-142`)
- **T9 已落**:表头行 + 文件行 · 行内详情面板 · 分页(蓝本 `:146-317`),**外加**(见下「T9 已经替你做掉的部分」)
- **你落**:重建 · 双上限 · 确认弹窗 · 底部动作条 · 轮询收口 · **路由反转** + 补齐多选的测试覆盖

本任务是**本期收官刀**:做完这一刀,「已收录文件」页才第一次真正可用。

## 🔴 T9 已经替你做掉的部分(别重复做,但要核实并补测试)

计划书把「多选」整块划给你,但那几段模板行落在 T9 的区间内、物理上不可拆,所以 T9 已经落地了:

| 项 | T9 落在哪(自己 grep 确认现状行号) | 你要做什么 |
|---|---|---|
| `toggleRow` / `toggleAll` | `:439-444` / `:446-455` | **核实完整可用**,不要重写 |
| `selectablePageIds`(排除 tombstoned) | `:295-297` | 核实 |
| `allSelected` | `:298-301` | 核实 |
| `someSelected` | `:302-304` | 核实 |
| 全选 checkbox 的 `indeterminate` 双 `watch` + `selectAllRef` | `:326-333` + `:175` / `:689` | 🔴 **这 10 行是「已落地但零测试覆盖」的活代码 —— 你的 DoD 里那条「`indeterminate` 四种组合各一条用例」正好补它** |
| tombstoned 行 checkbox 禁用 + title | `:721` / `:723` | 核实 |

**`rebuildRow` 的函数体 T9 留空占位**(因为它第 4 步要写 `doneSet`,而 T9 只读不写)——**由你补全**。

## 前面九个任务给你铺好的东西

| 任务 | 产出 | 你怎么用 |
|---|---|---|
| T0 | 治理文件 + 附录 A/B/D + `p5b-fixtures/` | 你的全部权威源 |
| T1 | 100 条 `aiKb*` i18n 键(两档) | 直接 `$t('aiKbXxx')`,**不许新增键** |
| T2 + T6 | scss 全部两段(85 类,白名单 187) | 你用到的类**已经全部存在**,不许自己写 `<style>` |
| T3 | store 三个 action 的 epoch 过期守卫 | 轮询 + 手动触发并存不会串号 |
| T5 | **队列页的 K7 reka 弹窗 + 路由反转的活样板** | 🔴 `git show 7014b22` —— **你的弹窗和路由反转照它写** |
| T7 | `util/indexedFilesView.ts` 五个纯函数 | 直接 import |
| T8 + T9 | `IndexedFilesView.vue` 前两刀 + 测试脚手架 | 你在它上面叠加 |

🔴 **你不需要写任何 scss、不需要加任何 i18n 键、不需要改 store、不需要改 util。**
发现少了一个类或一个键 → **停下返回 `NEEDS_CONTEXT` 问我**。

## 你的权威输入

1. **治理文件**:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-common-constraints.md`
   —— **先通读全文**。尤其 §1(工作区 + §1.1 零改动清单)· §2(移植纪律)·
   §3(K9–K20,**你落 K7 / K13 / K14**)· §3.5(N9–N14)· §4(数据契约,**尤其两个上限常量与 400 响应形状**)·
   §5(代码范式)· §6(配色)· §7(i18n)· §8(测试门)· §9(测试质量)· §10(报告契约)· §11.2(评审专查项)
2. **附录 A**:`.sp8/.../p5b-appendix-A-i18n.md`(键名 + 确切中文值;**注意带 `⚠️N` 的 9 行**)
3. **附录 D**:`.sp8/.../p5b-appendix-D-classes.md`(**§D.3 属性态清单** —— `.k-files-actionbar` 的 `data-active` 是你的)
4. **后端 fixture**:`.sp8/.../p5b-fixtures/` + 其 `README.md`
   🔴 **mock 形状一律从这里取,禁手编**
5. **Vue2 蓝本**:仓库 `/home/nimo/NimoTech/NimoOS-UI`,`git show main:<IndexedFilesView.vue 路径>`
   **只读,禁止改 / 提交 / checkout / stash / restore**
6. **T5 / T8 / T9 的三个 commit**:`git show 7014b22`(队列页 + 路由反转)·
   `git show 855cc39`(第 1 刀含修复轮)· `git show <T9 的最终 commit>`;
   并读 `p5b-task-9-report.md` 的「给 T10 的交接项」一节

## 改哪四个文件

- **改**:`src/ai/knowledge/views/IndexedFilesView.vue` · `src/ai/knowledge/views/IndexedFilesView.test.ts`(扩)
- **改**:`src/ai/knowledge/knowledgeRoutes.ts` · `src/ai/knowledge/deferred.ts`
- 🔴 **路由反转会连带要改 `knowledgeRoutes.test.ts` / `deferred.test.ts`**(那两条断言住在里面)——
  这是**必要的**,T5 已有先例,照它做。

## 本刀范围

### 1. 重建(蓝本 `:760-809`)

- **`rebuildRow`**(单行):T9 留了空占位,**由你补全**。成功后 `_flashDone` **2200 ms 绿闪**
- **`rebuildSelected`**:`overExplicitCap` 时**直接 return**
- **`openRebuildAllConfirm`** / **`doRebuildAll`**:从 filters 组 `filterObj`,
  🔴 **`tombstoned !== 'all'` 才带这个字段**

🔴 **`doRebuildAll` 的蓝本范围是 `:791-809`** —— T8 报告里写的 `:791-808` 差 1 行
(`:808` 只是内层 `catch` 的闭合,函数自身的 `},` 在 `:809`)。**顺手把那处注释订正掉。**

### 2. 双上限

| 常量 | 值 | 语义 |
|---|---|---|
| `EXPLICIT_REBUILD_CAP` | **500** | **前端拦**:按钮禁用 + 动作条警告 |
| `FILTER_REBUILD_CAP` | **10000** | **前端只警告,真拦在后端** → 400 走 **K14** 的警示条 |

两个常量 T8 已声明(`:91` / `:92`),核实值与治理 §4 一致。

### 3. 确认弹窗(蓝本 `:356-381`)

🔴 **reka 原语 + `DialogPortal` `to` 指向知识库容器**(**K7**,SP8 已在这上面爆过三次)。
**照 T5 在 `QueueView.vue` 里的写法**(`DialogRoot > DialogPortal to=".knowledge-app" defer >
DialogOverlay.k-modal-bg > DialogContent.k-modal`,含 reka a11y 必需的 `VisuallyHidden > DialogTitle`)。
不许用裸 `<div class="k-modal-bg">` 手搓,不许 `Teleport to="body"`。

`total > FILTER_REBUILD_CAP` 时**内嵌超限横幅**。

### 4. 底部粘性动作条(蓝本 `:323-353`)

`data-active="selectedCount > 0"`(🔴 **套 `String()`**,照抄蓝本)· 两个按钮的禁用条件与 title。

### 5. 30 秒轮询收口

`refresh()` 后 `startIndexedPolling()`;`onBeforeUnmount` → `stopIndexedPolling()`。
🔴 **T8 已经做了 `created → refresh()`(含 `startIndexedPolling`)与 `onUnmounted` 停轮询** ——
**核实现状,不要重复添加**;若 T8 的实现已完整,报告里说明「本项 T8 已完成,本刀零改动」即可。

### 6. 路由反转

- `knowledgeRoutes.ts`:`indexed-files` 子路由的 `component` 改成 `IndexedFilesView`
- `deferred.ts`:`DEFERRED_TABS` 摘掉 `'indexed-files'`
- 🔴 P5a T5 那条「剩余子路由 `component` 仍是 `KnowledgeDeferred`」的断言 **再反转一次,不删**
  (旧文本留成注释;T5 已经反转过一次,你这次是第二次)。照 T5 的做法:**反转 + 增加新断言**,不削弱任何既有断言

## 测试门(提交前必须三门全过)

```
pnpm test                      # 全量
pnpm exec vue-tsc --noEmit     # 0 错
pnpm build                     # 通过
```

**基线(协调者实测)**:见本文件末尾「起点」。预期增量:**+0 文件,+20 例左右**
(但你还要补 `indeterminate` 四种组合,实际可能更多)。实测多少报多少,差了要解释。

已知噪声(只它们红才复跑一次并说明,别去修):
`src/files/upload/persist.test.ts > dropPersisted …`(既有 IndexedDB flaky)· `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。

## DoD

- 三门全绿
- 🔴 **整页 DOM 完整** —— 这是收官刀,蓝本 826 行到这一刀必须**全部落地**,不留任何 TODO / 空壳 /
  空函数体(`rebuildRow` 必须补全)
- 🔴 **`indeterminate` 四种组合各一条用例**:全不选 / 部分选 / 全选 / **可选行为 0**
- 🔴 **两个上限的阈值两侧各一条**:**500 / 501** · **10000 / 10001**
- 🔴 **`_flashDone` 的 2200 ms 用 fake timers 断言「加」与「撤」两侧**
- 🔴 **`doRebuildAll` 的 `filterObj` 组装:四个条件各一条 + 全空一条**
- 🔴 **K14 的 400 分支断言「不包含后端 `detail` 串」**(T8 已有这条反向断言,**别削弱它**,
  本刀要补的是**真实入口**那一半 —— T8 当时没有 `doRebuildAll` 只能用 `wrapper.vm` 驱动,
  **你有了真实入口,请补一条走真实入口的用例**)
- `.k-files-actionbar` 的 `data-active` **两侧都断言**,直接比 `attributes('data-active')` 的值
- 路由反转:反转后的断言 + 新增断言都在,**旧文本留成注释**
- mock 形状逐个说明取自哪个 fixture 文件

## 🔴 RED 探针(至少 5 次,每次贴「改了什么 → 哪个用例报红 → 报红文本」,然后**改回来**并确认 `git status --short` 干净)

1. `overExplicitCap` 的 `>` 改成 `>=` → 精确报红(证明 500/501 两侧被钉住)
2. `_flashDone` 的 `setTimeout` 删掉 → 精确报红
3. `filterObj` 里的 `tombstoned !== 'all'` 判据删掉 → 精确报红
4. K14 改回回显后端 `detail` → 反向断言报红
5. **`indeterminate` 专项**:把两个 `watch` 里的赋值删掉(或把 `someSelected` 改成恒 `false`)
   → 确认那四条组合用例里该报红的报红
6. **建议再加**:动作条的 `data-active` 摘掉 `String()` 之外的条件(比如改成恒 `true`)→ 报红

## 硬约束(治理文件有全文,这里只挑最要命的)

- 可写仓只有 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)
- `/home/nimo/NimoTech/NimoOS-UI` **只读,且是多会话共享的检出**,只能 `git show main:<path>`
- `NimoOS-New-UI`(SP6/SP9)与 `.sp7/NimoOS-New-UI`(SP7)**禁碰**
  —— 🔴 注意 `.sp7` 现在有另一个并发会话在写 SP7 相册,**一个字都不要动那里**
- 治理 §1.1 的**全期零改动清单**一个都不许碰
- 禁 `git add -A` / `git add .` —— **只用显式 pathspec**;禁 rebase / reset / stash / merge / push
- 🔴 **不部署、不合 master**;不跑 `./scripts/deploy.sh`,不写 `/var/lib`
- 🔴 **颜色一律走 token,零色字面量**;T8 已给本文件补了「`<template>` 块零裸色」的定向断言,
  你新加的内联 `style=` 也受它约束
- 🔴 **界面 1:1 照抄 Vue2,文案也 1:1**。附录 A 里带 `⚠️N` 的 9 行**照抄、不许统一、不许"顺手改对"**
  (T9 撞上 5 行都照抄对了,治理 §11.2 要求评审专查)
- 🔴 **不许削弱 T8 / T9 已有的任何断言**(`filtersDirty` 七条 / N12 六条 / K14+K19 反向 /
  模板零裸色定向断言 / 过滤条文案集合式断言 / 四态徽标三项 + N14 的 `title` 四条 / 属性态 7 宿主 /
  分页边界)。合法的跟随订正是允许的(T9 就有一处),但**必须在报告里申报,且只能是增强不能是削弱**
- 弹窗内的错误提示**不要用 toast**(toast 是 z-index 60、弹窗遮罩 1000 还带 blur,会被压住 + 糊掉)
- 蓝本自身的未定义类 / 悬空动画 / 反向映射属**照抄条**(治理 §3.5)。
  遇到治理文件**没登记过**的同类情况,**停下返回 `NEEDS_CONTEXT` 问我**,别自己拍

## 提交

`git add -f` 逐个显式路径(四个源文件 + 连带的两个测试文件 + 报告),**一次 commit**。

## 报告契约

**完整报告写进** `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-task-10-report.md`:
本刀各区块落在哪 · **「T9 已替你做掉的部分」逐项核实结果**(完整可用?有没有重复实现?)·
`rebuildRow` 补全后的四步 · 双上限的落点与阈值 · K7 弹窗的 reka 结构 · 动作条 ·
轮询收口(T8 已做的说明)· 路由反转前后的断言文本 · **`indeterminate` 四种组合的用例位置** ·
两个上限阈值两侧的用例位置 · `_flashDone` fake timers 两侧 · `filterObj` 五条用例 ·
K14 真实入口那条用例 · 属性态覆盖 · 每个 mock 取自哪个 fixture · RED 探针的原始报红文本 ·
三门实测数字 · **整页 DOM 完整性的自证**(蓝本 826 行是否全部落地,给可核的数字)·
遗留疑问 + **给验收 / P5c 的交接项**。

**返回给我的正文 5 行以内**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
commit 短哈希 · 三门一行数字 · 整页是否完整落地 · 最要紧的 1–2 个 concern。
**不要把报告正文贴回来。**

## 起点

分支 `sp8-ai` · **BASE 与实测基线由协调者在派发时另行告知**(以那个为准)。
