# SP8-P3b Task 4 报告 —— TestPanel.vue

## 文件改动

1. **新建** `src/ai/components/settings/skills/TestPanel.vue`(1:1 移植 Vue2
   `src/views/AI/Skills/TestPanel.vue`,182 行)。
2. **新建** `src/ai/components/settings/skills/TestPanel.test.ts`(17 条用例)。
3. **修改** `src/ai/styles/skills-styles.scss` —— 在 `.sk-test-result .label` 块里,
   紧跟既有 `&[data-state="running"] .bullet` 之后,新增
   `&[data-state="failed"]` 分支(13 行,+13/-0)。这是本任务唯一改动的既有文件,
   `git diff` 已核对,只含这一段。

## Vue2 file:line → New-UI 对照

| Vue2 | New-UI | 说明 |
|---|---|---|
| `TestPanel.vue:1-8`(section 头) | `<div class="sk-section">` 段 | 逐字 1:1,`$t('Test in sandbox')`→`t('aiSkTestTitle')`,值相同(见下 i18n 表) |
| `:9-23`(`.sk-test-head`) | 同结构,`SkillIcon`→无(该区无图标) | pill/标题/副标题/off 角标 1:1 |
| `:26-36`(input+按钮) | 同结构 | `color="white"`→`color="currentColor"`(机械改动,见组件头注释) |
| `:39-55`(示例区) | 同结构 | 条件表达式改用 `sandbox.steps.length`/`sandbox.error` 代替 `output.steps.length`/`error` |
| `:57-65`(running) | 同结构 | `data-state="running"` 原样保留 |
| `:67-90`(done 成功) | 同结构 | 去掉 `output.tokens != null` 死分支(见下偏离说明);`s`(字符串)→`s.text`(SandboxStep) |
| `:92-98`(done 失败) | 同结构 | 内联 `:style` → `data-state="failed"` + scss 静态规则(见偏离说明) |
| `data()/computed/watch/beforeDestroy/methods`(:104-182) | `<script setup>` | 见下逐项对照 |
| `:124-126 canRun` | `canRun` computed | 逐字 |
| `:127-131 placeholder` | `placeholder` computed | 逐字,`this.$t`→`t()` |
| `:133-141 watch('skill.id')` | `watch(() => props.skill.id, …)` | 保留复位逻辑(1:1),额外 `ctrl?.abort()`(见下) |
| `:142-144 beforeDestroy` | `onBeforeUnmount` | 真正兜底清理点(见下说明,:key 重建场景) |
| `:146-151 onKeydown` | `onKeydown` | 逐字 |
| `:152-179 run()` | `run()`(async) | 改用 T3 `runSkillTest` 的 Promise 形状,弃 Vue2 `{onEvent,onClose}=>{close}` 回调协议 |

## 承接的 Vue2 行为(1:1)

- DOM 结构、class 名、文案键、`rows="2"`、`data-state` 值集合(`running`/新增
  `failed`)、示例区可见性条件的四个子条件、`Cmd/Ctrl+Enter` 触发运行而普通
  `Enter` 不触发、running 时按钮文案与禁用态、失败态标签文字固定为 `aiSkTestFailed`
  (「运行失败」)而实际错误文本另起一行、`skill.id` 变化时的状态复位。

## 偏离申报(逐条,按公共约束 §2 三件套)

### 1. D2 —— 文本累积渲染(公共约束 §3.1,预授权)
- **Vue2 问题**:`TestPanel.vue:159-163` 每收到一片 `message`/`message_delta`/
  `text` 就 `push` 一个新字符串到 `output.steps`。后端 `message_delta` 逐词发送
  (`NimoOS-AI/agent/agent.py:1266,1284`),照抄会炸出大量单字/单词独立行。
- **本仓做法**:本组件不自己做归约,只渲染 T2 `reduceSandboxEvent` 已归约好的
  `sandbox.steps`(连续文本合并成同一个 `{kind:'text'}` 步骤,`tool_call` 单独一行)。
- **代码位置**:`TestPanel.vue` 文件头注释「偏离 D2」段;渲染处
  `v-for="(s,i) in sandbox.steps"` → `s.text`。
- **RED→GREEN**:见下方证据(用例「多个 message_delta 渲染成一行」)。

### 2. D5 —— 计数只在成功完成时 emit(公共约束 §3.4,预授权)
- **Vue2 问题**:`SkillsSection.vue:204-214` 一点运行就 +1;而后端
  `service/skills.go:352 RecordRun` 全仓零调用点,沙箱 SSE 又必 422(见
  `skillTestTransport.ts` 头注「已知后端票」)——两者叠加是双重谎报。
- **本仓做法**:`run()` 末尾 `if (state.value === 'done' && !sandbox.value.error)
  emit('test')`,只在真正跑完且无 error 时才 emit。
- **代码位置**:`TestPanel.vue` 文件头注释「偏离 D5」段 + `run()` 函数内该行。
- **RED→GREEN**:见下方证据。

### 3. HTTP 层失败不回显后端 body(公共约束 §4 承 P2b,预授权)
- `onError(e)` 只区分「有无 `status` 字段」两种情形,分别落到 `aiSkTestHttpFailed`
  (带状态码)或 `aiSkTestFailed`(通用兜底),**从不读取/渲染 `e.body`**。
- 用例「HTTP 失败显示带状态码的本地化串,且不回显后端 body 内容」直接构造
  `{status:500, body:{detail:'super secret internal path'}}` 断言渲染文本既不含
  `detail` 也不含该字符串,只含 `500`。

### 4. 失败态样式(协调者预先解歧义,任务书正文点名,预授权)
- **Vue2 问题**:`TestPanel.vue:92-98` 失败态靠模板内联样式:`.label` 上
  `style="color: var(--danger)"`,`.bullet` 上
  `style="background: var(--danger); box-shadow: 0 0 0 3px rgba(255,59,48,0.18)"`。
  `rgba()` 字面量违反配色硬约束(§6),内联颜色本身也违规。
- **本仓做法**:模板给失败态 `.label` 加 `data-state="failed"`,零内联颜色;颜色规则
  搬进 `skills-styles.scss` 的 `.sk-test-result .label` 块,新增
  `&[data-state="failed"]` 分支,发光圈用 `color-mix(in srgb, var(--danger) 18%,
  transparent)`,手法与既有 `:506-509` 的 success 态发光圈同族(同一文件,同 18%
  比例,已在新增注释里点名引用)。
- **RED→GREEN**:见下方证据。

### 5.(非编号,机械改动,非逻辑偏离)Run 按钮图标颜色
- Vue2 `:34` `<SkillIcon name="play" :size="11" color="white" />` 是具名色字面量,
  硬约束禁止一切可见颜色使用字面量(不限于 `<style>` 块,color-guard 扫描范围之外
  的地方同样受约束条文本身管辖)。按钮容器已在 `skills-styles.scss:478` 用
  `color: var(--text-on-accent)` 承载前景色(disabled 态 `:482` 另有
  `--text-quaternary`),改成 `color="currentColor"` 继承即可,视觉结果与 Vue2 一致
  (实底 accent 按钮上的浅色字)。手法同既有先例 `SkillTile.vue:57`。这不是「逻辑
  偏离」(不改变任何行为判定),按公共约束 §6 的强制性规则本身要求,不占用 12 条
  预授权名额,但仍在此处如实记录以备评审核对。

## RED→GREEN 证据

**探针 1 —— D5(emit 条件)**:把 `run()` 末尾改成无条件 `emit('test')`(去掉
`if` 判断)：
```
 FAIL  … TestPanel > 失败时不 emit(test)(钉住偏离 D5)
 FAIL  … TestPanel > HTTP 失败(而非 SSE error 事件)时也不 emit(test)
 Tests  2 failed | 15 passed (17)
```
还原后重跑：`Test Files  1 passed (1)` / `Tests  17 passed (17)`。

**探针 2 —— 失败态 `data-state="failed"`**:临时删掉模板里该属性：
```
 FAIL  … TestPanel > SSE error 事件原样显示后端人类可读文本
AssertionError: expected false to be true
 Tests  1 failed | 16 passed (17)
```
还原后重跑：`Test Files  1 passed (1)` / `Tests  17 passed (17)`。`git status`
两次探针后均确认干净(未探针期间以外无残留改动)。

## 三门完整终值

```
pnpm test                  → Test Files  295 passed (295) / Tests  2496 passed (2496)   exit=0
pnpm exec vue-tsc --noEmit → exit=0(无输出)
pnpm build                 → exit=0(仅既有第三方包 + >500KB chunk 警告,无新增警告)
```
无红项。算术:本任务新增 1 个 `.vue`(`TestPanel.vue`)→ `color-guard.test.ts`
应 +1(单独跑该文件确认 `166 passed`,与既有基线 165 一致 +1)。新增 1 个
`.test.ts` 贡献 17 条本组件用例。

## i18n 键清单

**全部复用,零新增**(与任务书「Consumes: T2 的 aiSkTest* 键」一致,已逐个
`grep` 确认存在于 `src/i18n/{zh_cn,en_us}.ts`,且回权威源 Vue2 生产语言包
`NimoOS-UI/src/assets/lang/zh_CN.json` 逐字核对值一致:`Test in sandbox`/
`Sandbox`/`Try {name} without affecting your NAS`/`Running…`/`Example prompts`/
`Running in sandbox…`/`Bootstrapping {name} environment…`/
`Sandbox closed. No files were modified.`/`Run failed`/
`Run the skill on a sample folder` 等值均逐字匹配):

`aiSkTestTitle` `aiSkTestHint` `aiSkTestPill` `aiSkTestTryName` `aiSkTestDiscard`
`aiSkTestOffTitle` `aiSkTestOffBadge` `aiSkTestRun` `aiSkTestRunning`
`aiSkTestExamples` `aiSkTestRunningLabel` `aiSkTestBootstrapping`
`aiSkTestCompleted` `aiSkTestClosed` `aiSkTestFailed` `aiSkTestPlaceholderEx`
`aiSkTestPlaceholder` `aiSkTestHttpFailed`。

未发现缺键,未新增任何键。

## §3 末三处回源复核

Task 4 不涉及技能 ID 正则、Task 1 色字面量扫描、Task 5 行内错误类名——三处均
不在本任务范围内,不适用,未做改动。

## 测试质量自查

- 无空转用例:每条用例都绑定一处生产代码行为(canRun 三态绑 computed、
  Cmd/Ctrl+Enter 绑 onKeydown、running 文案绑 state ref、D2/D5 两条已做 RED
  验证、HTTP body 不回显绑 onError 的字段读取范围、off 角标绑 `v-if="!skill.enabled"`、
  示例点击绑 `@click="prompt = ex"`、abort 绑 onBeforeUnmount)。
- mock 骨架用 `vi.hoisted()`(`h.runSkillTest`)。
- 异步断言全部 `await flushPromises()`,无单个 `await nextTick()`。
- 未削弱/删除任何既有断言(本任务未触碰其他测试文件)。
- 卸载测试直接读取真实 `AbortSignal.aborted`,不 mock `abort()` 方法本身,避免
  「断言 mock 被调用」这种弱判别力写法。

## 顾虑

- 无。三门全绿,两处 RED 探针均按预期变红/复原变绿,`git status` 干净,改动范围
  仅限本任务声明的 3 个文件。
