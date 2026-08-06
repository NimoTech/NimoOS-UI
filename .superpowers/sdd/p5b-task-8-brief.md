# P5b · T8 任务书 —— `IndexedFilesView.vue` 第 1 刀:骨架 + 过滤条 + 表头 + 错误横幅 + 骨架屏 + 空态

## 你在哪

NimoOS 的 Vue2 → Vue3 整库迁移,第 8 期(SP8,AI 区)第 5 阶段第 b 批(P5b):把知识库的
**「已收录文件」页**与**「任务队列」页**从 Vue2 迁到 New-UI。T0–T10 单车道串行。

「任务队列」页(417 行)已由 T5 搬完并接进路由。
**「已收录文件」页是 826 行,分三刀:T8(你)→ T9 → T10。三刀叠加同一个 `.vue` 文件,物理上不能并发。**

🔴 **你这一刀留半成品会让 T9 的 diff 失真** —— 所以本刀范围内的 DOM 必须**完整**,不许留半个标签、
不许留 `TODO`、不许留「T9 补」的空壳。范围外的东西**一个都不要提前搬**。

## 前面七个任务给你铺好的东西

| 任务 | 产出 | 你怎么用 |
|---|---|---|
| T0 | 治理文件 + 附录 A/B/D + `p5b-fixtures/` | 你的全部权威源 |
| T1 | 100 条 `aiKb*` i18n 键(两档) | 模板里直接 `$t('aiKbXxx')`,**不许新增键** |
| T2 + T6 | scss 全部两段(32 + 53 = 85 个新类,白名单 187) | 你用到的类**已经全部存在**,不许自己写 `<style>` |
| T3 | store 三个 action 的 epoch 过期守卫 | 每敲一键整发重载(N9)不会串号,你可以放心测 |
| T5 | 队列页 + 路由反转的活样板 | `git show 7014b22` 看组件怎么写、测试脚手架怎么搭 |
| T7 | `util/indexedFilesView.ts` 五个纯函数 | `import { fmtBytes, fmtRel, fmtAbs, simplifyMime, topSegment } from '../util/indexedFilesView'` |

🔴 **你不需要写任何 scss、不需要加任何 i18n 键、不需要改 store、不需要改 util。**
发现少了一个类或一个键 → **停下返回 `NEEDS_CONTEXT` 问我**,那说明上游漏了,不是让你就地补。

## 你的权威输入

1. **治理文件**:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-common-constraints.md`
   —— **先通读全文**。尤其 §1(工作区 + §1.1 零改动清单)· §2(移植纪律)·
   §3(K9–K20,**你落 K13 / K14 / K19**)· §3.5(N9–N14,**N10 / N12 是你的**)·
   §4(数据契约)· §5(代码范式 + `views/` 出发的相对路径表)· §6(配色)· §7(i18n)·
   §8(测试门)· §9(测试质量)· §10(报告契约)
2. **附录 A**:`.sp8/.../p5b-appendix-A-i18n.md`(键名 + 确切中文值,只查不改)
3. **附录 D**:`.sp8/.../p5b-appendix-D-classes.md` —— **§D.2 是本页的 53 类** · **§D.3 属性态清单** ·
   **§D.4 `.k-empty-btn`(N10)** 是你这一刀的
4. **后端 fixture**:`.sp8/.../p5b-fixtures/` + 其 `README.md`
   🔴 **mock 形状一律从这里取,禁手编**(本仓「裸信封 unwrap」已栽三次)
5. **Vue2 蓝本**:仓库 `/home/nimo/NimoTech/NimoOS-UI`,`git show main:<IndexedFilesView.vue 路径>`
   **只读,禁止改 / 提交 / checkout / stash / restore**
6. **T5 的活样板**:`git show 7014b22`(本仓)—— 组件写法、reka 弹窗、测试脚手架、属性态断言形式
7. **既有先例**(本仓,**只读不改**):`views/KnowledgeLayout.vue` + `KnowledgeLayout.test.ts` ·
   `views/QueueView.vue` + `QueueView.test.ts` · `components/KIcon.vue`

## 新建哪两个文件

- `src/ai/knowledge/views/IndexedFilesView.vue`
- `src/ai/knowledge/views/IndexedFilesView.test.ts`

**只这两个。** 🔴 **本刀不做路由反转**(那是 T10);`knowledgeRoutes.ts` / `deferred.ts` 一个字都不许改。

## 本刀范围(蓝本 `:1-142` 模板 + 对应脚本)

| 区块 | 蓝本行 | 要点 |
|---|---|---|
| 骨架 | — | `.k-view` / `.k-scroll` / `.k-scroll-inner` |
| **过滤条 7 件** | `:6-57` | 见下表 |
| 表头 meta | `:60-90` | `{n} indexed files` + `statusSuffix` · `isAnyIndexing` 时的「自动刷新 · 30s」· 排序下拉 + 升降序按钮(`transform: rotate(180deg)` 内联) |
| **错误横幅** | `:93-103` | **K14** 400 分支**不回显 `detail`**;**K19** load-error 分支**不回显 `e.message`**,改 `aiKbLoadErrorBody` |
| 骨架屏 | `:106-132` | |
| 空态 | `:135-142` | 含 **N10** 的 `.k-empty-btn` —— 见下 |

**过滤条 7 件**(`:6-57`):

1. **Root 下拉** —— `derivedRoots` 从当前页路径首段派生(用 T7 的 `topSegment`),`rootSelect` **反向映射**
2. **路径前缀输入 + 清除**
3. **类型前缀输入 + 清除 + 「旧 .doc」快捷 chip**
4. **状态下拉** —— 🔴 **N12**:`statusViewLocal` 的 `active` ↔ `alive` **反向映射**
   (蓝本自带注释「原型写 active,API 要 alive」)。**照抄这个映射,不许"统一"**
5. **「仅看失败」勾选**
6. **「清除」按钮** —— `filtersDirty` 控禁用

🔴 **N9(治理 §3.5 照抄条)**:`onPathPrefixInput` / `onMimePrefixInput` **每敲一键整发重载,蓝本无 debounce**。
**照抄触发频率,不许加 debounce。** 竞态的正确性 T3 已经用 epoch 守卫解决了。

## 五条点名要求

### 1. K13 —— `selSet` / `expSet` / `doneSet` 用 `ref(new Set())`,写时整体替换

🔴 **删掉蓝本的 `selTick` / `expTick` / `doneTick`**(那是 Vue2 强制刷新的土办法,Vue 3 不需要)。
本刀只用到 `selSet`(`_applyFilter` 里清空)。

### 2. N10 —— `.k-empty-btn` 是蓝本自身的未定义类,照抄

蓝本 `:139` 的模板用了 `.k-empty-btn`,但**蓝本 `knowledge.scss` 里根本没有这个类**
(全仓 `git grep k-empty-btn main` 只命中这一行模板)。渲染成无样式按钮,Vue2 就是这样。

- **类名照抄**
- 🔴 **不许加进 `knowledgeStyles.test.ts` 的白名单**(它不是 scss 类)
- **报告里显式说明这一条**

### 3. N12 —— 状态下拉的 `active` ↔ `alive` 反向映射

见上「过滤条 7 件」第 4 条。**照抄,不许"统一成一个名字"。**

### 4. K14 / K19 —— 错误横幅不回显后端串

- **K14**:400 分支**不回显后端的 `detail`**
- **K19**:load-error 分支**不回显 `e.message`**,改用 `aiKbLoadErrorBody`

🔴 **测试里要有「断言横幅文案里 *不包含* 后端 detail 串 / `e.message`」的反向断言**,
不然将来有人"顺手恢复"回显不会有人报红。

### 5. `filters` 仍在 store 里

`store.indexedFiles.filters.xxx` —— P5a 治理文件 §5 已定「照抄」,**不要把 filters 搬进组件本地状态**。

## 生命周期与 `_applyFilter` 语义

- `created` → `refresh()`(先 `loadIndexedFiles`,后 `startIndexedPolling`)
- `_applyFilter` 语义(四件事,一件都不能少):
  **offset 归零** + **清选择**(`selSet`)+ **清 errorBanner** + **重载**

## 测试脚手架(前车之鉴,照做)

- 需要**真 router**(如本刀用到 `$route.query`)。🔴 **照 `KnowledgeLayout.test.ts` / `QueueView.test.ts`
  的既有写法,别自己造** —— P5a T10 自己造的 `makeRouter` 曾**自递归致 DOM / 生命周期翻倍**
- 🔴 **必须 mock `@nimotech/nimoos-service`**,否则 `onMounted` 会真发请求
- 异步断言用 `flushPromises()`
- 🔴 **`afterEach` 必须 unmount 所有挂载过的 wrapper**(T5 的 M-4 教训:
  组件里有 30 秒轮询 `setInterval`,不 unmount 会逐例泄漏定时器,将来污染 `toHaveBeenCalledTimes` 断言)
- 🔴 **读 `.vue` 源文件一律用 `node:fs`,不要用 Vite 的 `?raw`**(本仓 `?raw` 恒返空串,color-guard 曾因此空转);
  也不要用 `__dirname`(本仓 `"type":"module"`,ESM 下不可用),用 `fileURLToPath(import.meta.url)`

## 颜色

附录 B 已核实 **`IndexedFilesView.vue` 模板零内联色字面量**(与 `QueueView.vue:87` 不同),
所以本刀**不需要**附录 B §B.0 那套 `color-mix` 映射。

但 🔴 **守卫缺口③(color-guard 只扫 `<style>` 块,模板 `style=` 属性是盲区)对这个新 `.vue` 同样存在**,
而 T9 / T10 还会继续往这个模板里加东西(含 `transform: rotate(180deg)` 这类内联样式)。
**请照 T5 在 `QueueView.test.ts` 里的同款做法,给 `IndexedFilesView.vue` 也补一条定向断言**:
断言 `<template>` 块里零色字面量。(T5 那条实现可直接参考,`git show 7014b22`。)

## 测试门(提交前必须三门全过)

```
pnpm test                      # 全量
pnpm exec vue-tsc --noEmit     # 0 错
pnpm build                     # 通过
```

**基线(协调者实测)**:见本文件末尾「起点」。
预期增量:**+1 文件**(测试文件)· **+2 例**(新 `.vue` → color-guard 动态发现)· **+40 例左右**。
实测多少报多少,差了要解释。

已知噪声(只它们红才复跑一次并说明,别去修):
`src/files/upload/persist.test.ts > dropPersisted …`(既有 IndexedDB flaky)· `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。

## DoD

- 三门全绿
- 🔴 **本刀范围内 DOM 完整**(不留半个标签、不留 TODO、不留空壳);**范围外的东西一个都没提前搬**
- **7 件过滤器每件的「改动 → offset 归零 + 重载」都有用例**
- 🔴 **`filtersDirty` 六个条件每条单独一个用例**(`toBe(true)`),外加全默认时 `toBe(false)`
- 🔴 **`statusViewLocal` 三个值 × `statusSuffix` 三个输出全覆盖**(N12 的反向映射两个方向都要断言)
- K14 / K19 各有**反向断言**(不包含后端串)
- N10 的 `.k-empty-btn` 照抄且**没进白名单**,报告显式说明
- 属性态按附录 §D.3 覆盖本刀范围内的那些,**直接比 `attributes('data-x')` 的值**,不是只判属性存在
- mock 形状逐个说明取自哪个 fixture 文件
- 模板零色字面量的定向断言到位

## 🔴 RED 探针(至少 3 次,每次贴「改了什么 → 哪个用例报红 → 报红文本」,然后**改回来**并确认 `git status --short` 干净)

1. `rootSelect` 的 `derivedRoots.includes` 判据删掉 → 精确报红
2. `_applyFilter` 里的 `offset = 0` 删掉 → 精确报红
3. **N12 的 `active` ↔ `alive` 映射改成直传**(即"统一名字")→ 精确报红
4. **建议再加两次**:K14 改回回显后端 `detail` → 反向断言报红;
   往模板 `style=` 里塞一个 `#ff0000` → 你新补的定向断言报红

## 硬约束(治理文件有全文,这里只挑最要命的)

- 可写仓只有 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)
- `/home/nimo/NimoTech/NimoOS-UI` **只读,且是多会话共享的检出**,只能 `git show main:<path>`
- `NimoOS-New-UI`(SP6/SP9)与 `.sp7/NimoOS-New-UI`(SP7)**禁碰**
- 治理 §1.1 的**全期零改动清单**一个都不许碰;**本刀也不许碰 `knowledgeRoutes.ts` / `deferred.ts`**(T10 的活)
- 禁 `git add -A` / `git add .` —— **只用显式 pathspec**;禁 rebase / reset / stash / merge / push
- 不跑 `./scripts/deploy.sh`,不写 `/var/lib`
- 🔴 **颜色一律走 token,零色字面量**;禁 `theme-exception` 逃逸
- 🔴 **界面 1:1 照抄 Vue2,文案也 1:1**;Vue2 的 bug / 竞态 / 吞错**不照抄**,改正确并注释登记。
  蓝本自身的未定义类 / 错译 / 同值撞车 / 反向映射属**照抄条**(治理 §3.5)。
  遇到治理文件**没登记过**的同类情况,**停下返回 `NEEDS_CONTEXT` 问我**,别自己拍
- 弹窗内的错误提示**不要用 toast**(toast 是 z-index 60、弹窗遮罩 1000 还带 blur,会被压住 + 糊掉)

## 提交

`git add -f` 逐个显式路径(两个新文件 + 报告),**一次 commit**。

## 报告契约

**完整报告写进** `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5b-task-8-report.md`:
本刀各区块落在哪 · **范围边界说明**(哪些蓝本行是 T9/T10 的,本刀确实没碰)· 五条点名要求逐条回执 ·
7 件过滤器的用例位置 · `filtersDirty` 六条件 + `statusViewLocal`×`statusSuffix` 覆盖表 ·
K14/K19 反向断言的位置 · N10 的说明 · 属性态覆盖表 · 每个 mock 取自哪个 fixture ·
RED 探针的原始报红文本 · 三门实测数字 · 遗留疑问 + **给 T9 的交接项**。

**返回给我的正文 5 行以内**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
commit 短哈希 · 三门一行数字 · 本刀范围是否完整无半成品 · 最要紧的 1–2 个 concern。
**不要把报告正文贴回来。**

## 起点

分支 `sp8-ai` · **BASE = `dfc57ed`** · **实测基线 = 317 文件 / 3005 例全绿**,`vue-tsc` 0,`vite build` 0。
