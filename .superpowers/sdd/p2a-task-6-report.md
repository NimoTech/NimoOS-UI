# SP8-P2a Task 6 — 实现者报告:SetSwitch + PromptDialog 两个 UI 原语

commit: `70f4d38f9bcfa0ad7fb8eb2439e1f0ddf759d2a6`

## 做了什么

- 新建 `src/ai/components/settings/SetSwitch.vue` —— 1:1 移植自 Vue2
  `src/views/AI/Settings/SetSwitch.vue`(25 行)。`<script setup>` +
  `withDefaults(defineProps<...>(), ...)`(只调用一次 `defineProps`)。
  框架 API 差异(非行为改动,注释里已说明一次):Vue2 `$emit('input', v)` →
  Vue3 `emit('update:modelValue', v)`,同时保留 `emit('change', v)`,调用点
  `@change="v => ..."` 写法不用改。
- 新建 `src/ai/components/settings/SetSwitch.test.ts` —— brief Step 1 给的
  5 条测试,逐字落地,未改动。
- 新建 `src/components/ui/PromptDialog.vue` —— New-UI 没有带输入框的确认
  对话框,替代 Vue2 `$buefy.dialog.prompt`。结构照抄
  `src/components/ui/AlertDialog.vue` 的 reka-ui `AlertDialog*` 系列,加了
  `<input v-model="value">`(`@keydown.enter="onConfirm"`)。`watch(() =>
  props.open, (o) => { if (o) value.value = props.initialValue ?? '' })`
  处理"重开清空"(D2 同类的组件常驻残留问题)。`onConfirm()` 里
  `emit('confirm', value.value)` 不 trim(trim 交调用方,与 Vue2
  `ProvidersSection.vue:230` 一致)。样式 `<style scoped>` 复制
  `AlertDialog.vue` 的 `.ui-dialog-overlay/-content/-title/-footer` +
  `.ui-btn`(未含 `.danger` 变体,因为 PromptDialog 的 props 接口本身就没有
  `destructive`),去掉了 `AlertDialog.vue` 里 `var(--popup-bg,
  rgba(20,23,35,0.95))` 这类"token + 裸色兜底"写法的兜底部分,只留 token;
  新增 `.ui-dialog-input` 全部走既有全局 token(`--chip-border` /
  `--chip-bg-hi` / `--fg`),未新增 token(全局 `theme.css` 里已有的
  `--overlay-bg` / `--overlay-blur` / `--popup-bg` / `--card-border` /
  `--fg` / `--card-shadow-hi` / `--fg-muted` / `--chip-border` / `--chip-bg`
  / `--chip-bg-hi` 已够用)。
- 新建 `src/components/ui/PromptDialog.test.ts` —— brief Step 2 给的 6 条
  测试,内容/断言与 brief 原文完全一致,但有 4 处补了一次 `await
  nextTick()`(见下方「偏离」一节,已申报)。
- 在 `src/ai/styles/sk-shared.scss` 末尾追加 `.sw` 规则(见下方查证)。
- 在 `src/ai/styles/tokens.scss` 新增两个 token:`--switch-thumb` /
  `--switch-thumb-shadow`(light + dark 两块都给值,见下方「新增 token」)。

## `.sw` 规则的查证结果

跑了 brief 指定的 grep:

```
$ grep -rn "^\.sw\b\|\.sw\[data-on\|\.sw " /home/nimo/NimoTech/NimoOS-UI/src/views/AI/
/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/skills-styles.scss:235:.sw {
```

真实出处是 `NimoOS-UI/src/views/AI/Skills/skills-styles.scss:235-249`(iOS
风格开关,`.sw` + `.sw::after` + `.sw[data-on="true"]`)。Task 2 抽 6 条
`sk-*` 通用类到 `sk-shared.scss` 时按行号范围 `338-353,698-726` 摘录,没有
覆盖到 235-249 这一段,所以确实漏收了 —— 本仓 `sk-shared.scss` /
`agent-styles.scss` 之前都没有这段规则(逐一 grep 过,确认无重复)。

已按 Task 2 的同款做法把这几条规则**追加**到 `sk-shared.scss` 末尾(不重排
既有内容),带来源注释「来源:NimoOS-UI(Vue2)
`src/views/AI/Skills/skills-styles.scss:235-249`」。

裸色处理:Vue2 原值里 `.sw` 本身(`background: var(--line-strong)`)与
`&[data-on="true"]`(`background: var(--success)`)两个 token 名字与本仓
`tokens.scss` 现有 token 完全同名,直接沿用,无需改动。只有滑块圆点
(`::after`)的 `background: white` 与 `box-shadow: 0 2px 4px
rgba(0,0,0,0.18)` 是真正的裸色字面量 —— `sk-shared.scss`/
`settings-styles.scss` 头部注释虽登记了"整档移植沿用 Vue2 原值"的豁免,但
同时明确写了「不许再往本档塞新裸色」。`color-guard.test.ts` 实际只
`import.meta.glob` 了 `.vue` 和 `.css`,不扫 `.scss`,所以技术上不会因为
这两处裸色报红;但为了不违反该文件自己登记的"不许再塞新裸色"这条纪律,
我新增了两个主题不变(light/dark 同值)的 token 来承接这两处颜色,而不是
直接照抄字面量。

## Step 3(红)输出

```
 RUN  v4.1.9 /home/nimo/NimoTech/.sp8/NimoOS-New-UI

 ❯ src/ai/components/settings/SetSwitch.test.ts (0 test)
 ❯ src/components/ui/PromptDialog.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/components/ui/PromptDialog.test.ts [ src/components/ui/PromptDialog.test.ts ]
Error: Failed to resolve import "./PromptDialog.vue" from "src/components/ui/PromptDialog.test.ts". Does the file exist?
...
 FAIL  src/ai/components/settings/SetSwitch.test.ts [ src/ai/components/settings/SetSwitch.test.ts ]
Error: Failed to resolve import "./SetSwitch.vue" from "src/ai/components/settings/SetSwitch.test.ts". Does the file exist?
...
 Test Files  2 failed (2)
      Tests  no tests
```

两个文件都按预期 FAIL(import 解析不到)。

## Step 7(绿)输出

```
 RUN  v4.1.9 /home/nimo/NimoTech/.sp8/NimoOS-New-UI

 ✓ src/ai/components/settings/SetSwitch.test.ts > SetSwitch > 点击时同时 emit update:modelValue 与 change,值取反 10ms
 ✓ src/ai/components/settings/SetSwitch.test.ts > SetSwitch > disabled 时点击什么都不发 2ms
 ✓ src/ai/components/settings/SetSwitch.test.ts > SetSwitch > data-on 与 aria-checked 跟随 modelValue 3ms
 ✓ src/ai/components/settings/SetSwitch.test.ts > SetSwitch > role=switch 且 disabled 反映在 aria-disabled 上 1ms
 ✓ src/ai/components/settings/SetSwitch.test.ts > SetSwitch > title 透传 1ms
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > 打开时渲染标题、说明与输入框 60ms
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > 确认时把输入框当前值原样带出(不 trim —— trim 交调用方) 14ms
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > 回车等同于确认 12ms
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > 重新打开会清掉上次的输入(组件常驻,不清会残留) 22ms
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > initialValue 作为打开时的预填值 12ms
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > 取消不 emit confirm 12ms

 Test Files  2 passed (2)
      Tests  11 passed (11)
```

5 + 6 = 11 条全 PASS,与预期一致。

## Step 8 RED 验证(两段真实输出)

把 `PromptDialog.vue` 里的重置行临时注释掉:

```diff
 watch(() => props.open, (o) => {
-  if (o) value.value = props.initialValue ?? ''
+  // TEMP RED-VERIFICATION: if (o) value.value = props.initialValue ?? ''
 })
```

**第一段(红)**:

```
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > 打开时渲染标题、说明与输入框 58ms
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > 确认时把输入框当前值原样带出(不 trim —— trim 交调用方) 13ms
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > 回车等同于确认 12ms
 × src/components/ui/PromptDialog.test.ts > PromptDialog > 重新打开会清掉上次的输入(组件常驻,不清会残留) 23ms
   → expected 'stale' to be '' // Object.is equality
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > initialValue 作为打开时的预填值 12ms
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > 取消不 emit confirm 12ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/components/ui/PromptDialog.test.ts > PromptDialog > 重新打开会清掉上次的输入(组件常驻,不清会残留)
AssertionError: expected 'stale' to be '' // Object.is equality
...
 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```

只有目标用例红,其余 5 条不受影响 —— 判别力精准命中"重开不清空"这一条。

复原重置行后:

**第二段(绿)**:

```
 ✓ src/ai/components/settings/SetSwitch.test.ts > SetSwitch > 点击时同时 emit update:modelValue 与 change,值取反 12ms
 ✓ src/ai/components/settings/SetSwitch.test.ts > SetSwitch > disabled 时点击什么都不发 2ms
 ✓ src/ai/components/settings/SetSwitch.test.ts > SetSwitch > data-on 与 aria-checked 跟随 modelValue 2ms
 ✓ src/ai/components/settings/SetSwitch.test.ts > SetSwitch > role=switch 且 disabled 反映在 aria-disabled 上 1ms
 ✓ src/ai/components/settings/SetSwitch.test.ts > SetSwitch > title 透传 1ms
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > 打开时渲染标题、说明与输入框 57ms
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > 确认时把输入框当前值原样带出(不 trim —— trim 交调用方) 13ms
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > 回车等同于确认 11ms
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > 重新打开会清掉上次的输入(组件常驻,不清会残留) 20ms
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > initialValue 作为打开时的预填值 11ms
 ✓ src/components/ui/PromptDialog.test.ts > PromptDialog > 取消不 emit confirm 11ms

 Test Files  2 passed (2)
      Tests  11 passed (11)
```

## Vue2 `SetSwitch.spec.js` 的 2 条断言是否都被覆盖

Vue2 原测试(`src/views/AI/Settings/__tests__/SetSwitch.spec.js`)直接 `.call()`
`methods.toggle`,断言两条:
1. `toggle()` 用取反值同时 `$emit('input', v)` 和 `$emit('change', v)`。
2. `disabled` 时 `toggle()` 是 no-op(`$emit` 完全不调用)。

本仓测试用真挂载 + 触发 DOM `click` 事件覆盖:
1. 对应「点击时同时 emit update:modelValue 与 change,值取反」—— 断言
   `update:modelValue`(Vue3 v-model 落地事件名,取代 Vue2 的 `input`)与
   `change` 都发、值都是取反后的 `true`。**语义完全对应**,只是事件名按
   框架约定改名(brief 已声明这是框架 API 差异,非行为改动)。
2. 对应「disabled 时点击什么都不发」—— 断言两个事件都
   `toBeUndefined()`,与 Vue2 的「`$emit` 完全不调用」等价(未 emit 任何
   事件是 `emitted('x')` 为 `undefined` 的充要条件)。

另外 3 条(`data-on`/`aria-checked` 跟随、`role`/`aria-disabled`、`title`
透传)是新增覆盖,不影响原 2 条的覆盖判定。**结论:2 条 Vue2 断言均被覆盖,
判别力只增不减,brief 的说法成立。**

## 新增 theme token

新增在 `src/ai/styles/tokens.scss`(`.agent-app` 作用域,不是全局
`src/styles/theme.css` —— `.sw` 是 AI 区组件,理应走 AI 区自己的 token 表):

| 键名 | light 块 | dark 块 |
|---|---|---|
| `--switch-thumb` | `#ffffff` | `#ffffff`(同值) |
| `--switch-thumb-shadow` | `0 2px 4px rgba(0, 0, 0, 0.18)` | `0 2px 4px rgba(0, 0, 0, 0.18)`(同值) |

理由:iOS 风格开关的滑块圆点历来不随明暗主题变化(恒白 + 固定投影),与
`tokens.scss` 里已经登记的 `--paper-surface`/`--scrim-dark`/`--gloss-inset`
等"主题不变的皮肤无关细节"同属一类,两块都给了相同的值,注释里指回了
Vue2 原文行号与理由。

`PromptDialog.vue` 侧**未新增任何 token** —— 全局 `src/styles/theme.css`
里已有的 `--overlay-bg`/`--overlay-blur`/`--popup-bg`/`--card-border`/
`--fg`/`--card-shadow-hi`/`--fg-muted`/`--chip-border`/`--chip-bg`/
`--chip-bg-hi` 已够搭出这个对话框,逐一核对过 `theme.css` 里两个主题块都有
值。

## 全量门三条命令结果

```
$ pnpm test
 Test Files  266 passed (266)
      Tests  1951 passed (1951)
   Duration  54.19s

$ pnpm exec vue-tsc --noEmit
(无输出,类型检查通过)

$ pnpm build
...
(!) Some chunks are larger than 500 kB after minification. [既有警告,与本任务无关的 pdf/office viewer chunk]
✓ built in 12.44s
```

任务开始前(Task 5 完成后)本会话报告的基线是 264 文件 / 1938 例;本任务
新增 2 个测试文件(`SetSwitch.test.ts` 5 条 + `PromptDialog.test.ts` 6 条 =
11 条),266 文件与之吻合;测试总数从 1938 到 1951(+13,比预期的 +11 多
2)。核对过并非本任务引入 —— 逐个跑过新增的两个文件确认恰好新增 11 条,
差的 2 条来自与本任务无关的既有测试(会话间偶发的用例数波动,常见于
IndexedDB 相关文件,未见任何失败/红项)。全程无 IndexedDB flaky 复跑需求
(没遇到)。**无红项**,门通过。

## 偏离与原因(未申报的偏离即缺陷,这里显式申报)

**唯一偏离**:`PromptDialog.test.ts` 里 6 条用例中的 4 条(「打开时渲染标题、
说明与输入框」「确认时把输入框当前值原样带出」「回车等同于确认」「取消不
emit confirm」)在 brief 原文里是 `mount(..., { props: { ..., open: true }
})` 后**立即同步**查 `document.querySelector`,本仓在这 4 处各补了一行
`await nextTick()`(并把第一条从非 async 改成 async)。

原因:reka-ui@2.10.1 的 `Teleport` 组件
(`node_modules/reka-ui/dist/Teleport/Teleport.js`)用 `@vueuse/core` 的
`useMounted()` 做 SSR 安全闸 —— 首次同步渲染时 `isMounted` 恒为 `false`,
模板只吐一个 `<!--v-if-->` 占位注释;`onMounted` 把它翻 `true` 触发的
重渲染要等 Vue 调度器的下一个 microtask 才真正把内容搬进
`document.body`。这不是 `PromptDialog.vue` 实现引入的问题 —— 用完全相同
的手法(`mount(AlertDialog, { props: { open: true, ... }, attachTo:
document.body })` 后不等 tick 直接断言)复现了已上线、已过评审的
`src/components/ui/AlertDialog.vue` 在同等条件下同样断言失败
(`expected '' to contain '确定删除 1 项?'`);`AlertDialog.test.ts` 自己
的测试也是先 `await nextTick()` 才断言(`AlertDialog.test.ts:14`,注释写明
"reka-ui teleports AlertDialogContent to <body> asynchronously (Presence);
one tick is enough")。这是 brief Step 2 测试代码本身的一处遗漏(brief 里
另外两条本就先 `await w.setProps({ open: true })` 才查 DOM,天然带了一个
await 点,侥幸没暴露这个坑),不是我对需求的主观改写。补的这行不改变任何
断言的内容或顺序,只是让 DOM 真正落地后再断言。已在测试文件头部写了详细
注释(含 file:line 依据),此处报告与台账都登记。

**其余无偏离**:`.sw` 的两个新 token 属于 brief Step 6 明确要求"若发现
本仓已有 token 语义缺失就新增"的情形下的合理延伸(brief 原文本身没有点名
要不要新增 token,但 `sk-shared.scss`/`tokens.scss` 头部已有的"不许再塞新
裸色"纪律要求这样做),已在上面「新增 token」一节详细说明,不算行为偏离
(纯样式实现细节,视觉 1:1)。

## `git show --stat HEAD`

```
commit 70f4d38f9bcfa0ad7fb8eb2439e1f0ddf759d2a6
Author: Tiansanchuan <1312528051@qq.com>
Date:   Tue Jul 28 17:08:23 2026 +0800

    SP8-P2a Task 6: SetSwitch + PromptDialog 两个 UI 原语
    (完整正文见 commit message)

 src/ai/components/settings/SetSwitch.test.ts | 44 +++++++++++++
 src/ai/components/settings/SetSwitch.vue     | 40 ++++++++++++
 src/ai/styles/sk-shared.scss                 | 33 ++++++++++
 src/ai/styles/tokens.scss                    | 13 ++++
 src/components/ui/PromptDialog.test.ts       | 91 +++++++++++++++++++++++++++
 src/components/ui/PromptDialog.vue           | 94 ++++++++++++++++++++++++++++
 6 files changed, 315 insertions(+)
```

`git status` 提交后为 clean(`nothing to commit, working tree clean`),
未混入其他文件。
