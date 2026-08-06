# SP8-P3b Task 4 评审 —— TestPanel.vue

工作区 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,提交 `af1cdc0`(BASE `e1a53c7`)。
评审方法:自己打开 Vue2 蓝本逐项对标 · 自己 grep CSS 类 · 自己跑测试 · 自己做 RED 探针,不采信实现者报告。

## 判定

① **规格合规:✅**
② **代码质量:通过**

Critical: 0 条。Important: 0 条。Minor: 1 条。

## 逐项核查

### 1. DOM/交互 1:1

逐行对比 Vue2 `NimoOS-UI/src/views/AI/Skills/TestPanel.vue`(182 行)与新文件模板:
- `.sk-section` 段头、`.sk-test`/`.sk-test-head`(pill/标题/副标题/`sk-item-off` 角标)/`.sk-test-body`
  (textarea `rows="2"` + 按钮)结构、class、顺序逐一致。
- 四种显示态的 `v-if` 条件逐字核对:idle 示例区条件
  `skill.examples && skill.examples.length && state === 'idle' && sandbox.steps.length === 0 && !sandbox.error`
  与 Vue2 `output.steps.length === 0 && !error` 语义等价(仅变量换名);running/done-成功/done-失败
  三态条件同样逐一致。
- `canRun` = `prompt.trim() 非空 && state!=='running'`、`onKeydown` 的
  `e.key==='Enter' && (e.metaKey||e.ctrlKey)` 逐字照抄。
- 文案键 `aiSkTest*` 全部复用(零新增),回 Vue2 生产语言包 `zh_CN.json` 逐字符核对全部一致
  (标题/hint/pill/试用文案/off 角标/running/示例/completed/closed/failed 等)；英文档取 Vue2 key
  字面量(en_US.json 本就缺这些键,回落显示 key 本身),与仓内既有约定一致。

### 2. CSS 类真实存在,零 `<style>` 块

`grep` 逐个确认 `sk-section*`(`sk-shared.scss`)、`sk-test*`/`sk-item-off`/`sk-test-result`/`.label`/
`.bullet`/`.ex`/`.step-row`/`.footer-note`(`skills-styles.scss`)均存在。组件文件确认零 `<style>` 块。
`AgentIcon` 的 `play`/`sparkle`/`check` 三个图标名均存在于 `AgentIcon.vue`。

### 3. 配色

模板内零内联颜色字面量(仅尺寸/布局用的 `style="flex:1;..."` 等,不受限)。Run 按钮 `color="white"`→
`color="currentColor"` 已核实按钮容器有 `color: var(--text-on-accent)` 承载,视觉等价。失败态:Vue2
`:93-95` 的内联 `style` + `rgba(255,59,48,0.18)` 字面量已改为 `data-state="failed"` +
`skills-styles.scss:521-527` 的 `&[data-state="failed"]` 规则,发光圈 `color-mix(in srgb, var(--danger)
18%, transparent)`,与同文件 `:506-509` 既有 success 态发光圈同一手法、同一 18% 比例。三件套齐全
(代码注释点名 Vue2 `:92-98` + 报告显式申报)。

**Minor**:`skills-styles.scss:517` 与 `TestPanel.vue` 头注释里,为说明失败态样式偏离,把 Vue2 原始
`rgba(255,59,48,0.18)` 字面量原样敲进了注释文本。这段虽不触发 color-guard(该守卫只扫 `.vue` 的
`<style>` 块,本文件零 `<style>` 块;`.scss` 本身无守卫)、也不影响渲染,但与紧邻两行之上、同一文件里
既有 success 态注释(`:506-509`,刻意写「iOS 绿色约 18% 透明度」而不写字面值)确立的"描述颜色用中文
+ file:line,不复述字面量"惯例不一致。建议改成"约 18% 透明度的红色发光圈"式描述。不影响功能,不阻塞。

### 4. 三条已授权偏离——三件套核查

| 偏离 | 代码注释(file:line) | 报告显式申报 | 钉住的用例 | 结论 |
|---|---|---|---|---|
| D2 文本累积 | `TestPanel.vue` 头注释 + `sandboxRun.ts` 头注均点名 Vue2 `:160-163` 逐片 push 的问题 | 报告「偏离申报 1」 | `多个 message_delta 渲染成一行(钉住偏离 D2),tool_call 单独一行` | 齐全。渡染层确认只调用 `reduceSandboxEvent`(T2),自己未重复实现归约逻辑 |
| D5 计数 | `TestPanel.vue` 头注释 + `run()` 内注释均点名 Vue2 `SkillsSection.vue:204-214` | 报告「偏离申报 2」 | `失败时不 emit(test)` + `HTTP 失败(而非 SSE error 事件)时也不 emit(test)` | 齐全,双路径(SSE error / HTTP 失败)均有用例钉住 |
| 失败态样式 | `TestPanel.vue` 头注释 + `scss:515-520` 均点名 Vue2 `:92-98` 的内联 rgba | 报告「偏离申报 4」 | RED 探针(见下)证实 `data-state="failed"` 是渲染判据 | 齐全 |

### 5. `tokens` 死分支

`grep tokens src/ai/components/settings/skills/TestPanel.vue` 仅命中 3 处注释,生产代码(`<script>`/
`<template>`)零引用。`SandboxState` 类型(T2 `sandboxRun.ts`)本身没有 `tokens` 字段,类型系统本身即
阻止误加。有钉住用例(`cap.onEvent({type:'done', tokens:999})` 断言渲染文本不含 `'999'`/`'tokens'`)。

### 6. 生命周期(`onBeforeUnmount` vs watcher)

代码确认 `ctrl?.abort()` 落在 `onBeforeUnmount`(非仅挂在 `skill.id` watcher 上),watcher 复位逻辑
(重置 prompt/state/sandbox + `ctrl?.abort()`)也保留,1:1 对齐 Vue2 `:133-141`。回读设计文档
`NimoOS-UI/docs/superpowers/specs/2026-07-30-vue3-migration-sp8-p3b-skills-write-design.md:199-201` 确认
「T7 挂载时带 `:key="skill.id"` → watcher 实际不触发 → 清理必须落 `onBeforeUnmount`」是计划既定架构,
非实现者自行编造。当前 `SkillDetail.vue` 尚未接入 TestPanel(占位注释在 `:166-167`,属未来 T7 任务),
本任务范围内无集成缺陷。

### 7. 错误显示两条路径

`onError(e)` 只读 `e.status`(数字则走 `aiSkTestHttpFailed` 带状态码,否则 `aiSkTestFailed` 通用兜底),
从不读 `e.body`;`onEvent` 的 `error` 事件走 `reduceSandboxEvent` 已设好的 `sandbox.error`(SSE 人类可读
文本)原样显示。用例分别覆盖:SSE error 原样显示、HTTP 失败显示状态码且不含 body/`detail` 字段字符串、
非 HTTP 形状错误落回通用兜底。三路径均有断言,无遗漏。

### 8. 测试质量

17 条用例覆盖 brief 要求的全部 12 项 + 5 条额外(ctrlKey 等价键、examples 为空不渲染、启用技能无角标、
非 HTTP 形状错误、tokens 死分支)。全部用 `vi.hoisted()` 起 mock、`await flushPromises()`(`grep
nextTick` 命中 0)。无空转用例:每条断言都绑定具体生产代码行为。

## RED 探针(均已还原,`git status` 干净)

**探针 1 —— `onBeforeUnmount` 清理是否真的承担卸载清理**:把 `onBeforeUnmount(() => { ctrl?.abort() })`
临时改成空函数体。结果:`卸载时调用 abort` 精确报红(`Tests 1 failed | 16 passed (17)`,
`expected false to be true` 在 `cap.signal.aborted` 断言处),其余 16 条不受影响。还原后重跑
`17 passed (17)`。`git status`/`git diff --stat` 均干净。

**探针 2 —— D5 emit 条件**:把 `run()` 末尾的
`if (state.value === 'done' && !sandbox.value.error) emit('test')` 改成无条件 `emit('test')`。结果:
精确命中两条钉住 D5 的用例——`HTTP 失败(而非 SSE error 事件)时也不 emit(test)` 与
`失败时不 emit(test)`——`Tests 2 failed | 15 passed (17)`,`expected [[]] to be undefined`。还原后重跑
`17 passed (17)`。`git status` 干净。

## 三门 + 算术

自己重跑(未采信报告数字):
- `pnpm vitest run src/ai/components/settings/skills/TestPanel.test.ts` → `17 passed (17)`。
- `pnpm vitest run src/styles/color-guard.test.ts` → `166 passed (166)`(上一任务基线 165,新增
  `TestPanel.vue` 恰好 +1,吻合)。
- `pnpm test`(全量) → `295 passed (295)` 文件 / `2496 passed (2496)` 例,exit 0。
- 算术核对:上一任务(P3b Task 3)报告终值 `294 文件 / 2478 例`;本任务 `295 文件 / 2496 例`。
  Δ文件 = +1(新增 `TestPanel.vue`,`TestPanel.test.ts` 不计入 color-guard 但计入 vitest 文件数);
  Δ用例 = +18 = 17(组件自带) + 1(color-guard 新增该 `.vue` 触发的用例)。与报告声称的算术完全吻合。
- `git show --stat HEAD`:仅 3 个文件(`TestPanel.test.ts` 新增、`TestPanel.vue` 新增、
  `skills-styles.scss` +13 行),无越界改动。

## 未采信之处

未对报告文字本身做任何采信——上述每一条(DOM/class/条件/键位/emit/清理时机/错误路径/死分支/CSS 存在性/
i18n 值)均自己回蓝本或自己 grep/跑测试后得出结论,报告仅作为核对索引使用。
