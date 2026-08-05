# P5b · T9 任务书 —— `IndexedFilesView.vue` 第 2 刀:表格 + 行内详情 + 分页

## 你在哪

NimoOS 的 Vue2 → Vue3 整库迁移,第 8 期(SP8,AI 区)第 5 阶段第 b 批(P5b)。T0–T10 单车道串行。

「已收录文件」页蓝本 826 行,**分三刀:T8(已完成)→ T9(你)→ T10**。三刀叠加同一个 `.vue` 文件。

- **T8 已落**:骨架 · 过滤条 7 件 · 表头 meta · 错误横幅 · 骨架屏 · 空态(蓝本 `:1-142`)
- **你落**:表头行 + 文件行 · 行内详情面板 · 分页(蓝本 `:146-317`)
- **T10 落**:多选 · 重建 · 确认弹窗 · 底部动作条 · 30 秒轮询 · 路由反转

🔴 **你这一刀留半成品会让 T10 的 diff 失真** —— 本刀范围内的 DOM 必须**完整**,范围外的东西**一个都不要提前搬**。

## 前面八个任务给你铺好的东西

| 任务 | 产出 | 你怎么用 |
|---|---|---|
| T0 | 治理文件 + 附录 A/B/D + `p5b-fixtures/` | 你的全部权威源 |
| T1 | 100 条 `aiKb*` i18n 键(两档) | 模板里直接 `$t('aiKbXxx')`,**不许新增键** |
| T2 + T6 | scss 全部两段(85 个新类,白名单 187) | 你用到的类**已经全部存在**,不许自己写 `<style>` |
| T3 | store 三个 action 的 epoch 过期守卫 | 分页 / 过滤触发的并发重载不会串号 |
| T7 | `util/indexedFilesView.ts` 五个纯函数 | `fmtBytes` / `fmtRel` / `fmtAbs` / `simplifyMime` / `topSegment` 直接 import,**不要重新实现** |
| T8 | `IndexedFilesView.vue` 第 1 刀 + 测试脚手架 | 你在它上面叠加;测试脚手架(真 router / service mock / `afterEach` unmount)直接沿用 |

🔴 **你不需要写任何 scss、不需要加任何 i18n 键、不需要改 store、不需要改 util。**
发现少了一个类或一个键 → **停下返回 `NEEDS_CONTEXT` 问我**。

## 你的权威输入

1. **治理文件**:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-common-constraints.md`
   —— **先通读全文**。尤其 §1(工作区 + §1.1 零改动清单)· §2(移植纪律)· §3(K9–K20,**你落 K13**)·
   §3.5(N9–N14,🔴 **N13 / N14 是你的**)· §4(数据契约)· §5(代码范式)· §6(配色)· §7(i18n)·
   §8(测试门)· §9(测试质量)· §10(报告契约)· §11.2(评审专查项)
2. **附录 A**:`.sp8/.../p5b-appendix-A-i18n.md`(键名 + 确切中文值,只查不改;**注意带 `⚠️N` 的 9 行**)
3. **附录 D**:`.sp8/.../p5b-appendix-D-classes.md` —— **§D.3 属性态清单**(本刀是重头)· **§D.4 未定义类**
4. **后端 fixture**:`.sp8/.../p5b-fixtures/` + 其 `README.md`
   🔴 **mock 形状一律从这里取,禁手编**
5. **Vue2 蓝本**:仓库 `/home/nimo/NimoTech/NimoOS-UI`,`git show main:<IndexedFilesView.vue 路径>`
   **只读,禁止改 / 提交 / checkout / stash / restore**
6. **T8 的那一刀 + 它的交接项**:`git show <T8 的 commit>`(本仓)与 `p5b-task-8-report.md` 的「给 T9 的交接项」一节
7. **T5 的活样板**(队列页,已通过):`git show 7014b22`

## 改哪两个文件

`src/ai/knowledge/views/IndexedFilesView.vue` · `src/ai/knowledge/views/IndexedFilesView.test.ts`(扩)

**只这两个。** 🔴 **本刀不做路由反转**(T10 的活);`knowledgeRoutes.ts` / `deferred.ts` 一个字都不许改。

## 本刀范围

### 1. 表头行 + 文件行(蓝本 `:146-259`)

| 要点 | 说明 |
|---|---|
| 三组属性态 | `data-selected` / `data-status` / `data-done`(宿主是 `.k-frow-f`) |
| **`statusBadgeMap` 四个状态** | 🔴 见下「N14」——**一物两用,不许合并字段** |
| 路径单元格 | 含 `error` 行的 `errhint` 与 **`ok && vector_count === 0`** 的 `zerohint` |
| 类型标签 | `simplifyMime`(T7 的)+ `Legacy` 角标 |
| 大小 / 时间 | `fmtBytes` / `fmtRel`,**`title` 是 `fmtAbs`** |
| 向量数 | `data-zero` |
| 重建按钮 | 禁用条件 `status !== 'ok' && status !== 'error'`,**三种 title** |
| 展开按钮 | `data-open` |

### 2. 行内详情面板(蓝本 `:261-293`)

5 个字段格(**`tombstoned_at` 条件出现**)+ `last_error` 条。

### 3. 分页(蓝本 `:298-317`)

`currentPage` / `pageCount` / `pageFrom` / `pageTo` 四个计算 · 每页条数 4 档 · 上下页禁用条件。

### 两条实现要点

- `toggleExpand` 用 **`expSet`**(K13:`ref(new Set())`,写时整体替换;
  🔴 **不要引入蓝本的 `expTick`**)
- 🔴 **`justDone` / `doneSet` 本刀只读不写** —— 写在 T10。
  即:模板里可以读 `data-done`,但**不要**搬 `_flashDone` 那套(它属 T10)

## 三条点名要求

### 1. 🔴 N14 —— `statusBadgeMap.en` 一物两用,**两个字段都要留,不许合并**

蓝本:

- **`:191`** `:title="statusBadgeMap[file.status] ? statusBadgeMap[file.status].en : file.status"`
  ← **未翻译的原始英文**(tooltip 显示 `Indexed`)
- **`:197`** `{{ statusBadgeMap[file.status] ? $t(statusBadgeMap[file.status].en) : file.status }}`
  ← **翻译后的中文**(徽标文字显示「已收录」)

即:**同一个字段两种用法**。map 定义在蓝本 **`:573-580`**,四个状态的 `{en, icon, cls}` 是
`Indexed/check/ok` · `Indexing/spinner/indexing` · `Error/x/error` · `Removed/tomb/tombstoned`。

**落地要求**:map 里**同时保留 `en`(原始英文,只给 `:title`)与 i18n 键(只给徽标文字)**,
不许把 `en: 'Indexed'` 直接换成 `en: 'aiKbStatusIndexed'` 两处共用 —— 那样 tooltip 会变中文或键名,界面不 1:1。

🔴 **DoD 里硬要求:四个状态的 `title` 两侧都要断言**(是英文原串,不是中文、不是键名)。

**另注**:`indexing` 状态的 i18n 键是 **`aiKbStatusIndexing`(K20)** —— 蓝本 `$t('Indexing')` 在 Vue2 语言包里
**查无此串**(T0 查实的第 100 个键),T1 已按 K16 同模具落成两档同填英文。

### 2. 🔴 N13 —— `.k-status-badge-cn` 是蓝本自身的未定义类,照抄

蓝本 `:197` 用了这个类,但蓝本 `knowledge.scss` 里**没有定义**。

- **类名照抄**
- 🔴 **不许加进 `knowledgeStyles.test.ts` 的白名单**(它不是 scss 类;白名单应保持 **187**)
- **报告里显式说明**(与 T8 的 `.k-empty-btn`(N10)同款处理)

### 3. `tomb` glyph 只经 `statusBadgeMap.icon` 动态取到

治理 §1.2 已核实本期用到的 19 个 KIcon glyph **全部存在**;其中 **`tomb` 在模板里没有字面量
`name="tomb"`**,只经 map 动态取到。**不要因为 grep 不到就以为它缺失,更不要去改 `KIcon.vue`**
(它在治理 §1.1 的零改动清单里)。

## 测试脚手架

沿用 T8 已建好的(真 router / `@nimotech/nimoos-service` mock / `flushPromises()` /
`afterEach` unmount 所有 wrapper)。**不要另造一套。**

🔴 T8 修复轮已把 `FILES_ALL_8` 里 3 个被缩写的 docker 路径补成 fixture 真值 ——
**你渲染 `.k-frow-pathcell` / `.k-frow-pathtxt` 时正好靠它验超长路径的截断表现,别再改短它。**

## 测试门(提交前必须三门全过)

```
pnpm test                      # 全量
pnpm exec vue-tsc --noEmit     # 0 错
pnpm build                     # 通过
```

**基线(协调者实测)**:见本文件末尾「起点」。预期增量:**+0 文件,+35 例左右**。
实测多少报多少,差了要解释。

已知噪声(只它们红才复跑一次并说明,别去修):
`src/files/upload/persist.test.ts > dropPersisted …`(既有 IndexedDB flaky)· `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。

## DoD

- 三门全绿
- 🔴 **本刀范围内 DOM 完整**(不留半个标签 / TODO / 空壳);**范围外一个都没提前搬**
  (多选 / 重建 / 弹窗 / 动作条 / 轮询 / 路由反转全是 T10 的)
- 🔴 **四个状态徽标各一条用例,断言三项:`data-s` + 图标名 + 中文文案**
  —— 承 P5a T12 的 `tone: 'wiki'` 漏项事故(那条正是从「属性态只覆盖部分宿主」的缺口漏进去的)
- 🔴 **N14:四个状态的 `title` 各一条断言,是英文原串**(`Indexed` / `Indexing` / `Error` / `Removed`),
  外加**反向断言**(不等于中文、不等于键名)
- `simplifyMime` 的 **5 个 `data-kind` 各一条**用例
- **分页四个计算的边界**:`total = 0` / `total` 恰好整除 / 末页
- `errhint`(error 行)与 `zerohint`(`ok && vector_count === 0`)**两侧都有用例**
  ——🔴 注意:治理 §4.5 记了本机 8 个文件里 **`vector_count === 0` 那行的 status 是 `indexing` 不是 `ok`**,
  所以 `zerohint` 真机造不出,必须用构造数据,**并在报告里说明**
- 重建按钮的禁用条件 + **三种 title** 全覆盖
- 属性态按附录 §D.3 覆盖本刀范围内的**每一个宿主**,**直接比 `attributes('data-x')` 的值**
- N13 的 `.k-status-badge-cn` 照抄且**没进白名单**(白名单仍 187),报告显式说明
- mock 形状逐个说明取自哪个 fixture 文件

## 🔴 RED 探针(至少 4 次,每次贴「改了什么 → 哪个用例报红 → 报红文本」,然后**改回来**并确认 `git status --short` 干净)

1. `statusBadgeMap` 里换一个图标名(如 `check` → `x`)→ 精确报红
2. `pageTo` 的 `Math.min` 去掉 → 精确报红
3. 删掉 `data-zero` → 精确报红
4. 🔴 **N14 专项**:把 `:title` 改成读 i18n 键(即"合并字段")→ 确认那四条 `title` 断言精确报红
5. **建议再加**:把 `zerohint` 的判据从 `ok && vector_count === 0` 改成只判 `vector_count === 0`
   → 确认对应用例报红(证明两个条件都被钉住)

## 硬约束(治理文件有全文,这里只挑最要命的)

- 可写仓只有 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)
- `/home/nimo/NimoTech/NimoOS-UI` **只读,且是多会话共享的检出**,只能 `git show main:<path>`
- `NimoOS-New-UI`(SP6/SP9)与 `.sp7/NimoOS-New-UI`(SP7)**禁碰**
- 治理 §1.1 的**全期零改动清单**一个都不许碰;**本刀也不许碰 `knowledgeRoutes.ts` / `deferred.ts`**
- 禁 `git add -A` / `git add .` —— **只用显式 pathspec**;禁 rebase / reset / stash / merge / push
- 不跑 `./scripts/deploy.sh`,不写 `/var/lib`
- 🔴 **颜色一律走 token,零色字面量**;T8 已给本文件补了「`<template>` 块零裸色」的定向断言,
  你新加的内联 `style=` 也受它约束
- 🔴 **界面 1:1 照抄 Vue2,文案也 1:1**。附录 A 里带 `⚠️N` 的 9 行是 Vue2 语言包自身的错译 / 同值撞车
  (如 `Rebuild`→「恢复」、`Vectors`/`Vector count` 都译「向量数」),**照抄、不许统一、不许"顺手改对"**
  —— 本刀正好会撞上其中几条,治理 §11.2 要求评审专查
- 蓝本自身的未定义类 / 悬空动画 / 反向映射属**照抄条**(治理 §3.5)。
  遇到治理文件**没登记过**的同类情况,**停下返回 `NEEDS_CONTEXT` 问我**,别自己拍

## 提交

`git add -f` 逐个显式路径(两个源文件 + 报告),**一次 commit**。

## 报告契约

**完整报告写进** `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-task-9-report.md`:
本刀各区块落在哪 · **范围边界说明**(哪些蓝本行是 T10 的,本刀确实没碰)· 三条点名要求逐条回执 ·
四个状态徽标的三项断言 + N14 的 `title` 四条断言位置 · `simplifyMime` 5 个 `data-kind` 用例位置 ·
分页四个计算的边界覆盖表 · `errhint` / `zerohint` 覆盖(含 `zerohint` 为何必须构造数据)·
属性态覆盖表(对照附录 §D.3)· 每个 mock 取自哪个 fixture · RED 探针的原始报红文本 ·
三门实测数字 · 遗留疑问 + **给 T10 的交接项**。

**返回给我的正文 5 行以内**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
commit 短哈希 · 三门一行数字 · 本刀范围是否完整无半成品 · 最要紧的 1–2 个 concern。
**不要把报告正文贴回来。**

## 起点

分支 `sp8-ai` · **BASE 与实测基线由协调者在派发时另行告知**(以那个为准)。
