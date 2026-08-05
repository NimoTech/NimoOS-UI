# SP8-P3b Task 5 报告 —— AddSkillModal.vue

## 逐文件改动

### 新增

- `src/ai/components/settings/skills/AddSkillModal.vue`(1:1 移植自 Vue2
  `src/views/AI/Skills/AddSkillModal.vue`,188 行)。
- `src/ai/components/settings/skills/AddSkillModal.test.ts`(13 条用例)。

### 改动(协调者预先解掉的三处里的第 1 处,属于改动 P2b 共享组件,已按公共约束 §2 三件套申报)

- `src/ai/components/settings/SkModal.vue`
  - `defineSlots` 加一个可选的 `footerLeft?: () => unknown`。
  - 模板:`.sk-modal-foot` 的 `v-if` 改为 `slots.footer || slots.footerLeft`(纯增量,
    覆盖「只传 footerLeft 不传 footer」这个逻辑上必须自洽的分支,即使本期没有消费方
    这么用);`.sk-modal-foot` 内先渲染 `<slot name="footerLeft" />`,再是原来的
    `<div class="right"><slot name="footer" /></div>`。
  - 头注释新增一段说明本次改动的动机与向后兼容性。
  - **向后兼容验证**:现有三个消费方(`ChannelsSection.vue` 两处 `<SkModal>`、
    `McpTokensSection.vue` 一处)全部只传 `#footer`,不传 `#footerLeft` ——
    `<slot name="footerLeft" />` 在未传入时不渲染任何内容,`.right` 的结构/内容
    与改动前逐字节一致。全量测试跑过,这三处相关的既有用例(ChannelsSection.test.ts
    24 条、McpTokensSection.test.ts 全量)在改动后仍全绿,零改动。
- `src/ai/components/settings/SkModal.test.ts`
  - 新增两条用例(既有 6 条一字未改):
    1. `footerLeft 插槽渲染成 .right 的前置兄弟节点(左右两栏并存)` —— 同时传
       `footerLeft`+`footer`,断言两者都渲染、且 `footerLeft` 内容在 DOM 顺序上
       先于 `.right`、且不落在 `.right` 内部。
    2. `只传 footerLeft、不传 footer 时仍渲染 .sk-modal-foot` —— 钉住「条件逻辑
       自洽」这一要求,即使本期没有消费方这么用。
- `src/ai/styles/sk-shared.scss`
  - 在 `.sk-field-hint` 后新增 `.sk-field-err`(先例 `.chan-field-err`,
    `settings-styles.scss:234`,值逐字同款):
    `margin: 0 0 6px; font-size: 12px; color: var(--danger); line-height: 1.5;`。
- `src/ai/styles/settingsStyles.test.ts`
  - 在既有 `describe('sk-shared.scss', ...)` 块(约 :175)内新增一条守卫用例,断言
    `.sk-field-err` 存在、`color: var(--danger)`、且不含裸色字面量(`#hex`/`rgba?()`)。
    未改动该 describe 块内任何既有断言。

## Vue2 → New-UI 对照(逐段)

| Vue2 (`AddSkillModal.vue`) | New-UI |
|---|---|
| `:1-2` 裸 `.sk-modal-bg` + `@click.self` | `<SkModal>`(reka Dialog,P2b 既定先例,不重复申报) |
| `:11-23` 名称字段 | 同结构 `.sk-field`,`aiSkFieldName`/`aiSkNamePlaceholder`/`aiSkNameHint` |
| `:25-34` 描述字段 | 同结构,`aiSkDescription`(复用)/`aiSkDescPlaceholder`/`aiSkDescFormHint` |
| `:36-51` 触发方式三选项 | `triggerOptions` 数组 + `.sk-trig-option[:data-active]`,`aiSkTrigger`(复用)标签 |
| `:53-65` 颜色圆点(`:style="{background:c.bg}"`) | `.sk-color-dot[:data-color][:data-active]`(偏离 1,见下) |
| `:67-77` SKILL.md(可选,内联 style 是尺寸/字体) | 逐字照抄,含内联 `style="min-height:110px;font-family:var(--font-mono);font-size:12.5px"` |
| `:79-94` 脚本文件 `<input type=file multiple>` + hint + 已选列表 | 同结构,>1 MiB 不再静默丢弃(偏离 3) |
| `:96-108` footer:左 `.save-note` + check 图标,右取消/创建 | `SkModal` 的 `#footerLeft` + `#footer` 两个插槽 |
| `:113-135` `data()`/`mounted()` 聚焦名称框 | `ref` 状态 + `watch(open)` 里 `setTimeout` 显式聚焏(见下「reka 焦点实测」) |
| `:137-139` `valid` 只查两字段非空 | 逐字照抄语义(`valid` computed) |
| `:140-148` `colors`/`triggerOptions`/`mdPlaceholder` computed | 对应 `triggerOptions` 常量 + `mdPlaceholder` computed |
| `:154-157` `scriptsHint`(拼字符串当 key 用) | 直接 `t('aiSkScriptsHint')`(T2 已建好这个键,字面值与 Vue2 拼出来的字符串一致) |
| `:160-172` `onFilesPicked`(>1 MiB `continue`) | `onFilesPicked`,累计 `skippedCount`(偏离 3) |
| `:173-185` `submit()` 只查 `valid` | `submit()` 先查 `valid`,再跑 `validateSkillForm`(偏离 2) |

## 四条偏离(逐条三件套)

### 偏离 A —— SkModal 加 `footerLeft` 插槽(改动 P2b 共享组件)

- **① 代码注释**:`SkModal.vue` 头注释 + `v-if` 行内注释,均已写明动机(Vue2
  `AddSkillModal.vue:96-108` 两栏底栏 vs. 现有 SkModal 把 footer 整个塞进 `.right`)
  与向后兼容性论证。
- **② 本节即申报**。
- **③ 台账**:留给协调者据本报告登记。

### 偏离 1 —— 颜色圆点不用内联 `:style`

- Vue2 `:61` `:style="{ background: c.bg }"`。本仓硬约束禁内联颜色(公共约束 §6)。
- 改 `:data-color="id"` + T1 已埋进 `skills-styles.scss:717-723` 的 7 条
  `[data-color=…]` 规则(值为 P3a Task 1 建的 `--grad-sk-*` token)。
- 用例钉住:`7 个颜色点渲染,data-color 顺序与 SKILL_COLOR_IDS 一致…` 显式断言
  `dots.forEach((d) => expect(d.getAttribute('style')).toBeNull())`。

### 偏离 2 —— 提交前本地校验

- Vue2 `:173-174` `submit()` 只查 `!this.valid`(两字段非空),填完一整屏才被后端一句
  英文顶回来。
- `submit()` 先跑 T2 的 `validateSkillForm(name, description)`,非 `null` 则渲染进
  `.sk-field-err`(落在 `.sk-modal-body` 顶部,不发请求、不 emit `save`)。
  `valid`(按钮禁用条件)保持 Vue2 语义,不塞完整校验。
- 用例钉住:「名称非法…行内错误且不 emit save」「描述超过 256…」两条。

### 偏离 3 —— `>1 MiB` 文件不再静默丢弃

- Vue2 `:164-167` 直接 `continue`,用户看不到文件消失。
- 改为累计 `skippedCount`,>0 时追加一条 `.sk-field-hint`,文案
  `aiSkFilesSkippedTooBig`。
- 用例钉住:「>1 MiB 文件被跳过且出现行内提示;≤1 MiB 的正常读入」+ 边界用例
  「恰好 1 MiB 的文件不算超限」。
- **RED→GREEN 证据**(见下方测试质量小节)。

## reka 初始焦点实测结论

任务书要求先实测、不要照猜。实测分两步,均用 SkModal 现有 `.set-app` host 挂载手法:

1. **默认焦点落在哪**:mount 一个内含 `<input>` 的 SkModal(`open: true`),连续
   `await nextTick()` 三次后查 `document.activeElement`。结果:**落在 SkModal 内置的
   `.sk-x` 关闭按钮**(`BUTTON.sk-x`),不是名称输入框——reka Dialog 的
   `FocusScope` 默认把 mount-auto-focus 给 `DialogContent` 内**第一个可聚焦元素**,
   而 `.sk-x` 在 DOM 顺序上先于本组件的字段(它在 `.sk-modal-head` 里,先于
   `.sk-modal-body` 的插槽内容)。**结论:与 Vue2 `:133-135` 不一致,需要显式聚焏。**
2. **朴素的显式 `focus()` 是否管用**:在一个探针组件里用
   `watch(() => props.open, async (v) => { if (v) { await nextTick(); input.focus() } })`
   （即直接照抄 Vue2 `mounted()` 里 `$nextTick` 再 `focus()` 的手法),挂载后连续
   3 次 `nextTick()`,结果**仍然是 `.sk-x`**——reka `FocusScope` 自己的
   `watchEffect(async () => { await nextTick(); …dispatchMountAutoFocus… })` 与
   我们的 `nextTick()` 是同一微任务级时序在赛跑,实测这次是 reka 的分派后跑、抢回了
   焦点。改成宏任务级延迟后重测,`setTimeout(fn, 0)` / `requestAnimationFrame` /
   `nextTick().then(() => setTimeout(fn, 0))` 三种写法都**稳定命中名称输入框**,
   不再被 reka 抢走。

   最终实现选择最简单的 `setTimeout(() => nameInputEl.value?.focus(), 0)`,写在
   `watch(() => props.open, ...)` 里(见 `AddSkillModal.vue` 头注释「reka 初始焦点
   实测结论」段与实现处注释)。**不修改 `SkModal.vue` 本身的默认聚焦逻辑**——只在
   `AddSkillModal` 内部用更晚的时机覆盖它,`ChannelsSection`/`McpTokensSection` 两个
   既有消费方的默认聚焦行为不受影响(它俩没有主动聚焦需求,继续吃 reka 默认值)。

   回归用例:`打开时焦点最终落在名称输入框(覆盖 reka 默认聚焦到 .sk-x 关闭按钮)`。

## 非偏离但需要说明的实现细节:关闭时复位表单

Vue2 每次打开这个弹窗都是父级 `v-if` 重新创建一份组件实例(`mounted()` 天然只跑
一次,表单永远从空白开始)。本组件走 `SkModal` 的 `open` prop 控制可见性,组件
实例本身常驻,不会随每次打开/关闭重新创建 —— 若不显式复位,「取消」后再次打开会
看到上一次残留的输入,这是架构差异导致的**新问题**,不是「照 Vue2 1:1」要保留的
行为。`watch(open)` 在 `v === false` 时复位全部字段(含把 `<input type=file>`
原生 DOM 值清空),让「每次打开都是空表单」这条 Vue2 可见行为在新架构下继续成立。
不作为「拍板偏离」单独申报(它是在还原 Vue2 行为,不是偏离它),但仍附带一条用例
`关闭后重新打开:表单复位为初始值`。

## i18n 复用 / 新增

**零新增**——T2 已把本任务需要的全部 `aiSk*` 键建好,逐一 grep 核对 `zh_cn.ts` /
`en_us.ts` 均存在且成对:

- 复用公共约束 §7 点名的键:`aiCancel`、`aiSkDescription`、`aiSkTrigger`、
  `aiSkTagManual`(用作「手动」触发选项的名称,与技能列表标签同一个词,对齐
  Vue2 `:147` 用的也是 `$t('Manual')`)。
- 消费(均为 T2 已建,非本任务新增):`aiSkAddTitle`、`aiSkFieldName`、
  `aiSkNamePlaceholder`、`aiSkNameHint`、`aiSkDescPlaceholder`、`aiSkDescFormHint`、
  `aiSkTrigOptAuto`、`aiSkTrigDescAuto`、`aiSkTrigOptSlash`、`aiSkTrigDescSlash`、
  `aiSkTrigDescManual`、`aiSkFieldColor`、`aiSkOptional`、`aiSkScriptFiles`、
  `aiSkScriptsHint`、`aiSkSavedLocally`、`aiSkCreating`、`aiSkCreate`、
  `aiSkFilesSkippedTooBig`、`aiSkMdPlaceholderHead`、`aiSkMdPlaceholderBody`、
  `aiSkErrBadId`/`aiSkErrDescRequired`/`aiSkErrDescTooLong`/`aiSkErrDescSingleLine`/
  `aiSkErrDescAngle`/`aiSkErrDescControl`(经 `validateSkillForm` 返回键消费,
  非本组件直接查表)。
- `SKILL.md` 字面标签文本不走 i18n(Vue2 模板里也是硬编码字面量,只有周围
  `(optional)` 走翻译),照抄。

## §3 末三处回源复核 —— 本任务命中的一处

> 「Task 5 的行内错误类名是否真实存在(grep,先例 `.chan-field-err`)」

已 grep 复核:`.chan-field-err` 定义在 `src/ai/styles/settings-styles.scss:234`
（`margin: 0 0 6px; font-size: 12px; color: var(--danger); line-height: 1.5;`）。
brief 里「若不存在,在 T1 的 scss 里加过就用,否则报告 NEEDS_CONTEXT 停下」—— 经检查
`.sk-field-err` 本身**不存在**（`grep -rn "sk-field-err" src/ai/styles/` 在改动前
零匹配),且不属于「T1 已经加过」的情况,所以按 brief 指示的另一分支:比照
`.chan-field-err` 新建同款的 `.sk-field-err` 放进 `sk-shared.scss`(`.sk-field*`
家族本来就在这个档),不是 `NEEDS_CONTEXT`。

其余两处回源复核（技能 ID 正则、Task 1 色字面量扫描）不在本任务范围,T1/T2 报告
已各自处理。

## 测试质量:RED→GREEN 证据

### 1. 偏离 3(>1 MiB 不静默丢弃)

**RED**(把跳过阈值从 `1024*1024` 改成 `99999*1024*1024`,几乎不可能触发):

```
❯ src/ai/components/settings/skills/AddSkillModal.test.ts (13 tests | 1 failed)
  × >1 MiB 文件被跳过且出现行内提示;≤1 MiB 的正常读入(钉住偏离 3)
AssertionError: expected '...small.py — 100 Bbig.bin — 1048577 B...' not to contain 'big.bin'
Tests  1 failed | 12 passed (13)
```

**GREEN**(还原):

```
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

### 2. 偏离 A(SkModal `footerLeft` 插槽的 `v-if` 条件)

**RED**(把 `v-if="slots.footer || slots.footerLeft"` 还原成旧的
`v-if="slots.footer"`):

```
❯ src/ai/components/settings/SkModal.test.ts (8 tests | 1 failed)
  × 只传 footerLeft、不传 footer 时仍渲染 .sk-modal-foot(条件逻辑要自洽,本期暂无消费方这么用)
AssertionError: expected null not to be null
Tests  1 failed | 7 passed (8)
```

**GREEN**(还原):

```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

两次探测均已用 `git status`/内容对比确认改动已完整还原,工作树在探测前后一致
（探测期间产生的临时文件已清理,不在最终提交里)。

## 三门完整终值

```
pnpm test:                296 files passed / 2513 tests passed, exit=0
pnpm exec vue-tsc --noEmit: exit=0(无输出)
pnpm build:                exit=0(只有既有的 >500KB chunk 警告,无新增第三方警告)
```

无红项,无需归属噪声条目(`persist.test.ts` 那条已知 flaky 本次全绿,未触发)。

## 算术核对

本任务新增 1 个 `.vue` 文件(`AddSkillModal.vue`)——`color-guard.test.ts` 按
`**/*.vue` 动态生成用例,全量应 **+1**。协调者给的基线是 291 文件/2418 例(2026-07-30
复跑确认),本次全量结果是 296 文件/2513 例——文件数 +5、用例数 +95,说明分支上
除本任务外还有其他任务(T1-T4 等)的产出已经落地在同一工作树里,不是本任务独占的
增量;本任务自身引入的变化只有:新增 `AddSkillModal.vue`(+1 color-guard 用例)、
新增 `AddSkillModal.test.ts`(13 例)、`SkModal.test.ts` +2 例、
`settingsStyles.test.ts` +1 例,合计本任务贡献 13+2+1+1(color-guard)= 17 例。

## 组件零 `<style>` 块

`AddSkillModal.vue` 全文无 `<style>` 块,全部样式类均先 grep 确认存在于
`sk-shared.scss` / `skills-styles.scss`(`.sk-field*`、`.sk-trig-*`、
`.sk-color-*`、`.sk-btn*`、`.sk-modal-foot .save-note`)。
