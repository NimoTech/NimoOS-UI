# P5d · T3 任务 brief —— util 两份(`notesViewHelpers.ts` + `noteEditHelpers.ts`)

> **权威优先级:`p5d-coordinator-rulings-T0.md`(R1–R15)> `p5d-appendix-A-i18n.md` / `p5d-appendix-B-tokens.md`
> > `p5d-common-constraints.md` + P5a/P5b/P5c 治理 > `p5d-plan.md` > 本 brief。**
> 🔴 **T0/T1 已查实治理文件有 15 处错(E-31 ~ E-45)。凡治理与裁定书/附录冲突,信后者。**

## 0. 必读顺序

1. `.superpowers/sdd/p5d-coordinator-rulings-T0.md` 全文(**最高,先读**)
2. `p5a-common-constraints.md` → `p5b-` → `p5c-` → **`p5d-common-constraints.md`** 全文
3. `p5d-plan.md` 的 **§0 开工必读** 与 **§T3**
4. 🔴 **`p5d-appendix-B-tokens.md`**(K40 那 4 个渐变 token 名的**唯一权威**)+ **`p5d-appendix-A-i18n.md`**
   (`relativeTime` 用哪几个键;T1 已把 92 键落进语言包)
5. 本 brief

路径相对 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/`。**计划书 §T3 的 DoD 1–6 是你的验收口径。**

## 1. 坐标与基线

| | 值 |
|---|---|
| 可写仓 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai` |
| **起点 HEAD** | **`f128450`**(T0 `cc6d7c8`+`03db682` · T1 `56f8849` · T2 `f128450`,三刀均已关账、评审 clean) |
| 蓝本 | `NimoOS-UI`@**`7a6ee6b7`**,一律 `git -C /home/nimo/NimoTech/NimoOS-UI show 7a6ee6b7:<path>` 读。**禁读该仓工作树**(签出的是 07-15 旧分支,没有这两个文件)· **永远禁 `checkout`/`stash`/`reset`** |
| **新建 4 个文件** | `src/ai/knowledge/util/notesViewHelpers.ts` + `notesViewHelpers.test.ts` · `src/ai/knowledge/util/noteEditHelpers.ts` + `noteEditHelpers.test.ts` |
| 文件数 | **326 → 328**(+2 测试文件)· **零 `.vue` 新增** → `.vue` 仍 **179**、color-guard 不变 |
| 🔴 **三门基线(T2 后)** | **326 文件 / `3551` 例** · `vue-tsc` 0 · `vite build` 0。**不是计划书写的 3515** |
| 其它基线 | 全表键数 **1595 / 1595** · `aiKb*` **387** · `KIcon.PATHS` **42**(E-35) |
| 蓝本内容 | `notesViewHelpers.js` **50 行**(`NOTE_TYPES` / `noteTypeMeta` / `NOTE_SOURCES` / `noteSourceMeta` / `statusBadge` / `applyFilters` / `relativeTime`)· `noteEditHelpers.js` **11 行**(`parseTags` / `conflictMessage`)。**行数 T0 已核 5/5 全对。** |

## 2. 🔴 本刀四个「照做会假绿」的陷阱(**逐条都是计划书点名的**)

### ① K40:`.ts` 里的渐变**完全裸奔** —— `color-guard.test.ts` 压根不扫 `.ts`

- `NOTE_TYPES[*].color` 从蓝本的色字面量改成 **`'var(--grad-note-*)'` 字符串**(**token 名以附录 B 为准,不许自选**)。
- 🔴 **`color-guard.test.ts` 的 glob 只有 `../**/*.vue` 与 `../**/*.css`** —— **既不扫 `.ts` 也不扫 `.scss`**
  (这是 T0 修复轮查实的 M-1)。→ **你必须自己补一条定向断言**:四个 `color` 值都形如 `var(--…)`,
  零 `#` / `rgb(` / `rgba(` / 具名色。
- 🔴 **必配 RED 探针**:把某个值临时改成色字面量 → 断言必须报红 → 还原。
  **这是「产品代码对、守卫为零」的预防式堵法**,不是事后补。

### ② `relativeTime` 的时间单位是**秒**,喂毫秒会让全部用例假绿

- 🔴 **`unixSec` 是秒不是毫秒**(蓝本注释 `:41`)—— **喂毫秒会让所有输入都落进第 5 档**,
  于是 4 个边界的用例全部「通过」但什么都没测到。
- **4 个边界(60 / 3600 / 86400 / 86400×30 **秒**)两侧都要用例**;
  **第 5 档走 `toLocaleDateString()` → 断言不许钉死具体字符串**(输出依赖环境 locale/TZ),
  用「等于 `new Date(unixSec*1000).toLocaleDateString()`」**同式比对**。
- 🔴 **测试必须用 vitest 假时钟,禁真实时间**(治理 §9.8)。
- `if (!unixSec) return ''` 那条早退:**`0` / `undefined` / `null` 三个输入都要用例。**

### ③ `relativeTime` 必须用 `i18n.global.t(...)`,不许改用 `useI18n()`

- 先例 `indexedFilesView.ts:31/51-58`。**`useI18n()` 不在组件 setup 上下文里会抛。**
- 🔴 **T1 已按 K42 新建了 4 个相对时间键**(占位符是 **`{n}`**;**不许**复用 `aiKbMinAgo`/`aiKbHrAgo`/`aiKbDaysAgo`
  —— 它们的占位符是 `{m}`/`{h}`/`{d}`)。**键名去附录 A 查,别猜。**
- ⚠️ **T1 实测的 E-45**:**vue-i18n 对不匹配的占位符是静默替换成空串,不是留字面量 `{m}`** ——
  所以「渲染出字面量 `{n}` 就报红」这种反向断言**零判别力**。
  **要断言的是:渲染结果里出现了真实数字**(例如 `t(key,{n:5})` 的结果 `.toContain('5')`)。

### ④ `statusBadge` **全仓零生产消费者** —— 照抄导出 + 照抄 3 条用例,**不许因为「没人用」就删**

- K7 同族(反转不删)。**报告要显式写「零消费者已知,故意保留,依据治理 §4.3」。**

## 3. 承接 Vue2 既有 spec 的行为(治理 §4.3;**T0 已核实本期只有这 2 份**)

- **`notesView.spec.js` 3 条** → `statusBadge` 三分支 + `applyFilters` 的 type/status **独立** + `'active'` 语义。
  **`applyFilters` 三档 status 语义**:`''` = 全部 · `'active'` = 非 archived · 其余 = **精确匹配**。**三档都要用例。**
- **`noteEditHelpers.spec.js` 2 条** → `parseTags` 的分割/去空格/去重 + `conflictMessage` **只认 409**。
  - **`parseTags` 分隔符是 `/[,\s]+/`** —— **逗号与空白都算**:`' a, b ,a  c,'` → `['a','b','c']`。
  - 🔴 **N23:`conflictMessage` 的英文串照抄成裸字符串、不进 i18n**(它只当布尔谓词用),
    **但 `.toContain(rev)` 那条行为要承接**(串里必须出现 revision)→ **不许简化成 `return true`**。
  - ⚠️ **T0 已回后端源码坐实 409 的字段名是 `current_revision`**(`agent/main.py:2870-2872`),
    治理担心的「revision undefined」**不成立**。
- **`noteTypeMeta` / `noteSourceMeta` 的兜底分支**(`|| NOTE_TYPES.note` / `|| NOTE_SOURCES.human`)——
  **未知 type / 未知 createdBy / `undefined` 三个输入都要用例。**
- ⚠️ **不在本期**:`notesMapper.spec.js`(归 P5e)· `notesService.spec.js`(归上游,T0 已核上游承接 5/6,
  缺的两条已登记成上游票 **U-1**)。

## 4. 移植纪律

- **界面/行为严格 1:1**;**Vue2 的 bug/竞态/吞错不照抄**,改正确逻辑并按治理 §3 申报登记;**禁无关重构**。
- **零 `any`**;`vue-tsc` 0。
- 只有治理 **K1–K45** 登记过的偏离才许做;**照抄不改**的是 **N1–N32**。其余**先申报再做**;
  拿不准写 `NEEDS_CONTEXT` 并**停下**。

## 5. 明确不做的

- **零 `.vue`**(组件归 T4/T6/T7/T8)· 不碰 `src/i18n/**`(T1 已关账)· 不碰 `src/ai/styles/**`(T2 已关账)·
  **不装依赖**(tiptap 归 T4)· 不碰 `openInApp.ts`(归 T5)。
- 🔴 **禁部署**、禁写 `/var/lib`、禁 `git push`/`rebase`/`reset`/`stash`/`merge`、禁 `git add -A`/`git add .`。
- 🔴 别碰 `/home/nimo/NimoTech/NimoOS-New-UI` 与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(**并发会话**)。
- `.sp8/NimoOS-Service` 零改动;**不需要跨仓 `pnpm build`**(裁定 R12)。

## 6. 三门

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5d-t3-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5d-t3-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5d-t3-build.log 2>&1; echo "exit=$?"
```

**全量,输出完整落盘,不许 `| tail`。** 报告贴 `Test Files` / `Tests` 两行 +
**「326 + 2 = 328 文件」与「3551 + 本刀新增 N = 实测值」两个算式**。
**已知噪声**(只它们红才复跑一次并说明,**不要顺手改**):`src/files/upload/persist.test.ts > … dropPersisted …`
(IndexedDB flaky)· `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。包管理器 **`pnpm`**。

## 7. 报告契约

- 全文写 `.superpowers/sdd/p5d-task-3-report.md`。**返回给协调者 ≤ 20 行。**
- 必须含:§T3 DoD **1–6 逐条** · **K40 定向断言的 RED 探针两段输出**(报红 + 还原后转绿)+ `md5` 比对 +
  `git status` 干净 · **`statusBadge` 零消费者的显式声明** · 四个渐变 token 名与附录 B 的对应 ·
  `relativeTime` 用的键名(引附录 A)· **命中的每一条 K/N 编号申报** · 三门两个算式。
- 🔴 **探针还原禁用 `git checkout -- <path>` / `git restore`** —— 只许「先 `cp` 存副本 → 注入 →
  用副本覆盖 → `md5sum` 逐字节比对」;**注入要行首锚定并先证注入真落盘**。
- 🔴 **常驻纪律**:**凡 DoD 里带 🔴 的「复跑 / 复扫 / 独立复核」项,不许用「采信上一刀的结论」替代;
  要跳过必须先停下写 `NEEDS_CONTEXT` 申报 —— 事后在报告里写一句不算申报。**

## 8. 提交

一刀 = 一个语义提交(`feat(kb): P5d T3 …`)。台账 `git add -f` 具体路径。
提交后 `git show --stat HEAD` + `git status` 自查。
