# SP8-P2b Task 11 report — channelsFormat 纯函数

## 文件改动

- **新建** `src/ai/util/channelsFormat.ts`：`ChannelBinding` 接口 + 三个纯函数
  `bindingLabel` / `fillPairInstructions` / `fillTokenTail`，brief 给出的实现原样落地
  （逐行核对与 Vue2 一致，见下表）。
- **新建** `src/ai/util/channelsFormat.test.ts`：brief Step 1 的 7 例原样落地。

## Vue2 file:line → New-UI 对照

| Vue2 | New-UI | 说明 |
|---|---|---|
| `ChannelsSection.vue:304-307` `bindingLabel(b)` | `bindingLabel(b, noLabelText)` | 1:1；兜底文案由方法内 `this.$t('(no label)')` 改成调用方传参 |
| `ChannelsSection.vue:185-190` `pairInstructions` computed | `fillPairInstructions(template, bot, code)` | 1:1；`this.$t('channelsPairInstructions')` 与 `this.codeInstance.bot_username` / `this.revealedCode` 均改成显式参数 |
| `ChannelsSection.vue:29` 模板内联 `$t('channelsBotTokenTail').split('{tail}').join(inst.token_tail)` | `fillTokenTail(template, tail)` | 1:1，抽出内联表达式 |

## 承接 Vue2 断言（0/7 —— 如实申报）

逐条读完 `NimoOS-UI/src/views/AI/Settings/__tests__/ChannelsSection.spec.js`（121 行全文）：
该 spec **对 `bindingLabel`/`pairInstructions` 没有任何直接断言**。唯一相关的是
`genCode` 测试里的注释，明确写着「codeInstance drives the pairing instructions
({bot}/{code} substitution is **not asserted** here: the i18n mock returns the key
verbatim, so the template has no real {bot}/{code} tokens to substitute)」——即 Vue2
测试作者当时就因为 i18n mock 限制放弃了这条断言。因此本任务的 7 个测试例并非「承接」
自 spec.js，而是 brief 依据 Vue2 **源码行为**（非测试）新写的，头注释里已如实声明。

## i18n 占位符替换机制的决策（brief 提示的 i18n 陷阱）

本文件三个函数本身不碰 i18n，只做「模板字符串」的 split/join。但为 Task 12（消费方）
把决策想清楚并写进头注释：**采用方案二 —— 自行 split/join + i18n 值里转义大括号**
（与 Task 9 `mcpConnect.ts` 的 `buildMcpInstruction`、Task 10 `aiCfgMcpInstructionTemplate`
同一机制），而非方案一 vue-i18n 命名插值 `t(key, {bot, code})`。原因：Task 10 已实证
vue-i18n v9 在 `t(key)` 不传 params 时会把裸 `{bot}`/`{code}` 当命名插值解析、找不到值
就吃掉变空串。Task 12 加 `channelsPairInstructions`/`channelsBotTokenTail` 键时必须把
`{bot}`/`{code}`/`{tail}` 转义成 `{'{'}bot{'}'}` 等，且 `channelsPairInstructions` 的字面
`@` 也要转义成 `{'@'}`（两者叠加：`{'@'}{'{'}bot{'}'}`）。本任务未新增/改动任何 i18n
文件（未涉及范围，也未运行 `p2b-stage-i18n.sh`）。

## 偏离申报

无逻辑偏离——brief 的实现与 Vue2 源码逐行核对完全一致，未发现 bug 需要修正。唯一的
「偏离」是测试断言溯源方式的澄清（上文「承接 Vue2 断言」一节），非代码行为偏离。

## 确定性

本文件三个函数都不含日期/时区相关逻辑（纯字符串 split/join + 真值判断），无需按
TZ 复跑验证；已运行全量测试门一次，通过。

## 测试结果

- `pnpm exec vitest run src/ai/util/channelsFormat.test.ts`：**7/7 通过**。
- `pnpm test`（全量）：**284 files / 2264 tests 全绿**，无红项，无 flake 复现。
- `pnpm exec vue-tsc --noEmit`：**0 错误**。
- `pnpm build`：**成功**，仅既有第三方包 chunk 体积警告（非本任务引入）。

## i18n 复用/新增

无（本任务未创建/修改任何 i18n 键）。

## 提交纯净性

`git show --stat d799d31`：仅 2 个文件（`channelsFormat.ts` + `channelsFormat.test.ts`，
88 行新增）。`git status` 提交后 clean，未卷入任何 P2a 在途文件。

---

状态：DONE
提交 sha：`d799d31`
测试结果：channelsFormat.test.ts 7/7；全量 284 files / 2264 tests 全绿；vue-tsc 0 错误；build 成功（仅既有 chunk 警告）
承接 Vue2 断言：0/7（spec.js 对这两个方法无直接断言，7 例依据源码行为新写，已在头注释与本报告申报）
顾虑：无（i18n 转义机制已在头注释里为 Task 12 交接清楚，避免其踩 Task 10 同款陷阱）
