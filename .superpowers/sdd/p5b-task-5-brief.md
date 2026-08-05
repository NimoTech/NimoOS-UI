# P5b · T5 任务书 —— `QueueView.vue` + 路由反转

## 你在哪

NimoOS 的 Vue2 → Vue3 整库迁移,第 8 期(SP8,AI 区)第 5 阶段第 b 批(P5b):把知识库的
**「已收录文件」页**与**「任务队列」页**从 Vue2 迁到 New-UI。T0–T10 单车道串行。

**你是 T5,搬「任务队列」页整页 + 把它接进路由。** 这是本批第一个真正的组件任务。

排在这个位置的理由:**先跑通便宜的那半** —— `QueueView.vue` 只有 417 行、依赖面窄,
把「i18n → scss → util → view → 路由反转」这整条链的坑先在这里暴露,再上 826 行那半(T8-T10)。

## 前面五个任务已经给你铺好的东西

| 任务 | 产出 | 你怎么用 |
|---|---|---|
| T0 | 治理文件 + 附录 A/B/D + `p5b-fixtures/` | 你的全部权威源 |
| T1 | 100 条 `aiKb*` i18n 键(两档) | 模板里直接 `$t('aiKbXxx')`,**不许新增键** |
| T2 | scss 共享底座段(32 个新类) | 你模板里用到的类**已经全部存在**,不许自己写 `<style>` |
| T3 | store 三个 action 的 epoch 过期守卫 | 切 pill / 切 scope 不会串桶,你可以放心测 |
| T4 | `util/queueView.ts` 三个纯函数 | `import { distillIconState, basename, dirname } from '../util/queueView'` |

🔴 **你不需要写任何 scss、不需要加任何 i18n 键、不需要改 store。**
如果你发现少了一个类或一个键 —— **停下返回 `NEEDS_CONTEXT` 问我**,那说明上游漏了,不是让你就地补。

## 你的权威输入

1. **治理文件**:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-common-constraints.md`
   —— **先通读全文**。尤其 §1(工作区 + **§1.1 全期零改动清单** + §1.2 的 19 个 KIcon glyph)·
   §2(移植纪律)· §3(K9–K20,**你要落 K7 / K11 / K16 / K18**)· §3.5(N9–N14 照抄条)·
   §4(数据契约:**三个 action 的真实响应形状**)· §5(代码范式 + `views/` 出发的相对路径表)·
   §6(配色)· §7(i18n)· §8(测试门)· §9(测试质量)· §10(报告契约)
2. **附录 A**:`.sp8/.../p5b-appendix-A-i18n.md` —— 键名表(T1 已落,你只查不改)
3. **附录 B**:`.sp8/.../p5b-appendix-B-tokens.md` —— 🔴 **必读 §B.0**,那是**给你的**(见下「内联渐变」一节)
4. **附录 D**:`.sp8/.../p5b-appendix-D-classes.md` —— 类白名单 + **§D.3 属性态清单**(测试要两侧都覆盖)
5. **后端 fixture**:`.sp8/.../p5b-fixtures/` + 其 `README.md`
   🔴 **mock 形状一律从这里取,禁手编**(本仓「裸信封 unwrap」已栽三次)
6. **Vue2 蓝本**:仓库 `/home/nimo/NimoTech/NimoOS-UI`,`git show main:<QueueView.vue 路径>`
   **只读,禁止改 / 提交 / checkout / stash / restore**
7. **既有先例**(本仓,**只读不改**):`src/ai/knowledge/views/KnowledgeLayout.vue` 与
   `KnowledgeLayout.test.ts` · `views/DashboardView.vue` · `components/KIcon.vue`

## 改哪四个文件

- **新建**:`src/ai/knowledge/views/QueueView.vue` · `src/ai/knowledge/views/QueueView.test.ts`
- **改**:`src/ai/knowledge/knowledgeRoutes.ts` · `src/ai/knowledge/deferred.ts`

**只这四个。** 治理 §1.1 的全期零改动清单一个都不许碰。

## 要搬什么(蓝本 417 行,一次成型,双 scope)

| 区块 | 蓝本行 | 要点 |
|---|---|---|
| scope 切换 | `:6-13` | 两个 `.k-filter-pill`,`:data-on="String(scope === 'index')"` —— 🔴 **必须套 `String()`**(选择器是 `[data-on="true"]`) |
| 三桶 pill + 完成统计 | `:16-39` | failed 那颗带 `data-tone="danger"`;`counts` 来源**分两路**(index 走 `stats.queue_depth`,distill 走 `distillJobs.counts`) |
| 工具条(index) | `:44-75` | 未选中态:filter=failed 才出「重试所有失败的 / 清空失败记录」;选中态:filter=failed 才出「重试选中」,另有「取消选中 / 清空选中」与「取消」 |
| 工具条(distill) | `:76-82` | 只有一行 label,**无批量操作**(蓝本注释解释了原因) |
| 空态 | `:85-98` | failed 桶有专属插画与 🎉;**`:96` 两句改走 i18n(K16)**;`:87` 有内联渐变,见下 |
| index 表格 | `:100-140` | 全选 checkbox · 状态图标随 filter 变 · `{n}× retried` + `last_error` · 行操作(pending→取消 / failed→重试)· `rows.length >= 200` 截断提示 |
| distill 表格 | `:145-185` | `data-scope="distill"` 专属栅格 · **无 checkbox 列** · `kn-badge` 徽标(Manual/Auto + Skipped/Failed)· 截断提示读 `distillTruncated` |
| 清空确认弹窗 | `:190-208` | `.k-modal-bg` + `.k-confirm-*`;🔴 见下「K7 弹窗」 |

🔴 **落笔前先 `git show main:` 把 417 行整体读一遍**,别只看我这张表 —— 表是索引不是规格。

## 六条点名要求

### 1. K7 —— 弹窗一律 reka 原语 + `DialogPortal` `to` 指向知识库容器

**SP8 已经在这上面爆过三次。** 不许用裸 `<div class="k-modal-bg">` 手搓,不许 `Teleport to="body"`。
照本仓既有的 reka 弹窗写法(治理 §5 有范式;`src/ai/` 下已有先例,自己 grep `DialogPortal`)。

### 2. K18 —— 三个重试入口统一调 `store.retryFailed(null)`

`retryOne` / `bulkRetry` / `retryAllFailed` **三个都调 `store.retryFailed(null)`**,
toast 统一 `aiKbRetriedAllFailed`。

🔴 **按钮、禁用条件、图标、排版零变动** —— 界面还是蓝本那样,只有「点下去实际发什么请求 + 弹什么 toast」变了。
代码里**三处各留一条注释**指明蓝本行号 + `repo_jobs.py:107-121` 的死形参(治理 §3 的 K18 有全文依据)。

### 3. K16 —— 空态 `:96` 那两句硬编码英文改走 i18n

键名见附录 A(`aiKbQueueAllPendingDone` / `aiKbQueueNoRunningNow`,两档同填英文原文,
渲染结果与 Vue2 逐字相同)。

### 4. K11 —— `fmtAgo` 从 store import

`import { fmtAgo } from '../stores/knowledgeStore'`(**不是**从 `util/queueView`;T4 特意没抽它)。

### 5. 内联渐变 + 守卫缺口③(🔴 这一条只有你会碰到)

蓝本 `:87` 的 `.k-empty-illust` 带一个**写在模板 `style=` 属性里**的渐变,含 3 处色字面量。

- **映射照附录 B §B.0**(3 条 `color-mix`,T0 已定死;**留在模板 `style=` 里照抄蓝本结构**,不要挪进 scss)
- 🔴 **`color-guard.test.ts` 只扫 `.vue` 的 `<style>` 块,模板 `style=` 属性是它的盲区**
  → 治理文件把这个登记成**守卫缺口③**,并要求**你补一条定向断言**兜底:
  断言 `QueueView.vue` 的 `<template>` 块里零色字面量。
- 🔴 **附录 B §B.0.4 给你的那段断言骨架有两个坑,不能直接照抄**:
  - 它用了 `__dirname` —— 但本仓 `package.json` 是 `"type": "module"`,ESM 下 `__dirname` 不可用,
    须 `fileURLToPath(import.meta.url)`
  - 它调了 `stripFns(...)` —— **这个辅助函数不存在**
  照旁边的 `knowledgeStyles.test.ts` / `color-guard.test.ts` 的既有写法补对。
  🔴 **读 `.vue` 源文件一律用 `node:fs`,不要用 Vite 的 `?raw`**(本仓 `?raw` 恒返空串,
  color-guard 曾因此空转 —— 治理里有登记)。

### 6. 路由反转

- `knowledgeRoutes.ts`:`queue` 子路由的 `component` 从 `KnowledgeDeferred` 改成 `QueueView`
- `deferred.ts`:`DEFERRED_TABS` 里摘掉 `'queue'`
- 🔴 P5a T5 那条「11 条路由 `component` 全部 === `KnowledgeDeferred`」的断言 **反转,不删**
  (旧文本留成注释,承 P5a 的 T10/T12 先例)

## 深链契约

蓝本 `:231` + `:260-265`:

- `?scope=distill` → 沉淀桶;**其余(含缺省)→ 文件索引**
- `?filter=` **立即生效的 watcher**
- `DashboardView.vue:202` **已经在推 `?filter=failed`** —— 本任务闭合这条链
  (那个文件属零改动清单,**只读,别去改它**)

## 测试脚手架(前车之鉴,照做)

- 需要**真 router**(`$route.query` + `$router.replace`)
- 🔴 **照 `KnowledgeLayout.test.ts` 的既有写法,别自己造** ——
  P5a T10 自己造的 `makeRouter` 曾**自递归致 DOM / 生命周期翻倍**
- 🔴 **必须 mock `@nimotech/nimoos-service`**,否则 `onMounted` 会真发请求
- 异步断言用 `flushPromises()`

## 测试门(提交前必须三门全过)

```
pnpm test                      # 全量
pnpm exec vue-tsc --noEmit     # 0 错
pnpm build                     # 通过
```

**基线(协调者实测)**:见本文件末尾「起点」。
预期增量:**+1 文件**(测试文件;`.vue` 不计入 test files)· **+2 例**(新 `.vue` → color-guard)· **+45 例左右**。
实测多少报多少,差了要解释。

已知噪声(只它们红才复跑一次并说明,别去修):
`src/files/upload/persist.test.ts > dropPersisted …`(既有 IndexedDB flaky)· `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。

## DoD

- 三门全绿
- **`pnpm build` 后能在 `dist/assets/*.css` 里 grep 到本任务用到的类**(证明真进了构建管线)
- **两个 scope × 三个 filter = 6 种组合的 DOM 都有对照用例**
- 🔴 **五组属性态两侧都要有断言**:`data-on` / `data-tone` / `data-scope` / `data-state` / `data-selected`
  —— P5a T12 的事故就是「只覆盖 4 个宿主里的 1 个」。
  **断言要直接比 `attributes('data-x')` 的值**,不是只判属性存在
- 附录 D §D.3 的属性态清单逐条对照,报告里给覆盖表
- 六条点名要求逐条在报告里回执
- mock 形状逐个说明取自哪个 fixture 文件

## 🔴 RED 探针(至少 3 次,每次贴「改了什么 → 哪个用例报红 → 报红文本」,然后**改回来**并确认 `git status --short` 干净)

1. 摘掉 `data-on` 的 `String()` → 报红
2. `distillTruncated` 的 `>=` 改成 `>` → 报红
3. 把 `bulkRetry` 改回蓝本的空请求版(即不走 K18 的 `retryFailed(null)`)→ 报红
4. **建议再加一次**:在模板 `style=` 里塞一个 `#ff0000` → 你新补的那条定向断言报红
   (证明守卫缺口③ 真的被堵上了,不是写了个空转的断言)

## 硬约束(治理文件有全文,这里只挑最要命的)

- 可写仓只有 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)
- `/home/nimo/NimoTech/NimoOS-UI` **只读,且是多会话共享的检出**,只能 `git show main:<path>`
- `NimoOS-New-UI`(SP6/SP9)与 `.sp7/NimoOS-New-UI`(SP7)**禁碰**
- 治理 §1.1 的**全期零改动清单**一个都不许碰
- 禁 `git add -A` / `git add .` —— **只用显式 pathspec**;禁 rebase / reset / stash / merge / push
- 不跑 `./scripts/deploy.sh`,不写 `/var/lib`
- 🔴 **颜色一律走 token,零色字面量**(除附录 B §B.0 那三条 `color-mix`);禁 `theme-exception` 逃逸
- 🔴 **界面 1:1 照抄 Vue2,文案也 1:1**;但 Vue2 的 bug / 竞态 / 吞错**不照抄**,改正确并注释登记。
  蓝本自身的未定义类 / 悬空 animation / 错译 / 同值撞车属**照抄条**(治理 §3.5)——
  遇到治理文件**没登记过**的同类情况,**停下返回 `NEEDS_CONTEXT` 问我**,别自己拍
- 弹窗内的错误提示**不要用 toast**(toast 是 z-index 60、弹窗遮罩 1000 还带 blur,会被压住 + 糊掉)

## 提交

`git add -f` 逐个显式路径(四个源文件 + 报告),**一次 commit**。

## 报告契约

**完整报告写进** `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-task-5-report.md`:
八个区块各自落在哪 · 六条点名要求逐条回执 · 属性态覆盖表(对照附录 D §D.3)· 6 种 scope×filter 组合的用例位置 ·
每个 mock 取自哪个 fixture · 路由反转前后的断言文本 · `dist/assets/*.css` 的 grep 证据 ·
RED 探针的原始报红文本 · 三门实测数字 · 遗留疑问。

**返回给我的正文 5 行以内**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
commit 短哈希 · 三门一行数字 · 属性态覆盖是否全 · 最要紧的 1–2 个 concern。**不要把报告正文贴回来。**

## 起点

分支 `sp8-ai` · **BASE = `9a98106`** · **实测基线 = 315 文件 / 2905 例全绿**,`vue-tsc` 0,`vite build` 0。
