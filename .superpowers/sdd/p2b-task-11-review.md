# SP8-P2b Task 11 review — channelsFormat 纯函数

## 判定

- **规格合规:✅**
- **任务质量:Approved**（无需改动；下方为核实过程与两条建议性观察，非缺陷）

## 逐项核对

### 1. 行为对照（Vue2 `ChannelsSection.vue` 逐字符核对）

- `bindingLabel`（Vue2 :304-307）：
  ```js
  bindingLabel(b) {
    if (b.external_username) return '@' + b.external_username
    return b.external_user_id || this.$t('(no label)')
  }
  ```
  New-UI：`if (b.external_username) return \`@${b.external_username}\`; return b.external_user_id || noLabelText`。
  逐分支比对一致：有用户名→`@`+用户名；无用户名有 id→id；两者皆无（或空串,因为 JS 真值判断）→兜底文案。**行号引用准确**（注释写 :304-307，实测吻合，且已修正了 brief 里错误的 :281-284）。

- `pairInstructions` computed（Vue2 :185-190，brief 原写 :121-127 是错的,已被实现者独立纠正）：
  ```js
  pairInstructions() {
    const bot = (this.codeInstance && this.codeInstance.bot_username) || ''
    return this.$t('channelsPairInstructions').split('{bot}').join(bot).split('{code}').join(this.revealedCode)
  }
  ```
  New-UI `fillPairInstructions(template, bot, code)` = `template.split('{bot}').join(bot).split('{code}').join(code)`。split/join 顺序、无空白差异，逐字符一致。`codeInstance && codeInstance.bot_username || ''` 的兜底逻辑有意留给 Task 12 调用方(此函数只接收已算好的 `bot` 参数),与接口签名设计一致,不是遗漏。

- 模板内联 `channelsBotTokenTail`（Vue2 :29）：`$t('channelsBotTokenTail').split('{tail}').join(inst.token_tail)` → `fillTokenTail(template, tail)`，逐字符一致。

- 生产语言包核对（`NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json`）：`channelsPairInstructions` = `"打开 Telegram，给 @{bot} 发送：/pair {code}"` / `"Open Telegram, message @{bot}, and send: /pair {code}"`——`@` 紧邻 `{bot}`，`channelsBotTokenTail` = `"token ···{tail}"` 无 `@`。头注释里给出的转义方案与这两条生产文案的字符实况完全匹配。

### 2. 承接断言的核心声明——独立验证

自行完整读完 `NimoOS-UI/src/views/AI/Settings/__tests__/ChannelsSection.spec.js`（121 行，8 个 `it`）：全部断言都是对 `w.vm.*`（组件实例状态）或 mock 调用参数的断言，**没有任何一处**渲染/查询 DOM 文本（无 `.text()`/`.html()`/`wrapper.find(...).text()`），也没有任何字符串直接提及 `bindingLabel`/`pairInstructions`。唯一相关的 `genCode` 测试只断言 `w.vm.codeInstance.bot_username`，其注释明确承认未测 `{bot}/{code}` 替换。**独立核实结论：报告「0/7」的说法准确，无断言被遗漏或削弱。** 7 个新例反而把 Vue2 测试套件里完全空白的这两个函数补上了分支覆盖（username 有/无、id 有/无、空串真值判断、正常替换、bot 为空边界、tail 替换），非空转——每例都用具体计算结果断言，没有「删掉实现还能过」的空转用例。

### 3. Task 12 交接注记判定

头注释与 test 文件顶部注释一致地写明：Task 12 加 `channelsPairInstructions`/`channelsBotTokenTail` 键时必须把 `{bot}`/`{code}`/`{tail}` 转义为 `{'{'}bot{'}'}` 等，`channelsPairInstructions` 的字面 `@` 需转义为 `{'@'}`。**判定：指令准确且无歧义**——已用生产语言包验证转义对象与位置正确；注释显式要求转义后的字符串必须「逐字包含」三个裸占位符供 split/join 二次替换，覆盖了 `{code}` 不会被遗漏转义的隐患。**交接风险**：这条护栏仅存在于代码注释里，无自动化测试强制 Task 12 遵守，是纯人工交接——但已按 §7 移植纪律要求「三件套」申报清楚（代码注释 + 报告 + 台账待补），且与 Task 10 已验证的机制一致，风险可控，不构成质量扣分项。

### 4. 确定性

三个函数均为无日期/无时区的字符串 split/join + 真值判断，`TZ=UTC` 与 `TZ=Asia/Shanghai` 双跑全量测试结果一致（均 284 files / 2264 tests 全绿），符合报告「无需按 TZ 复跑」的自我判断，予以复核确认。

### 5. RED 探针（已还原）

1. 破坏 `bindingLabel`：`return \`@${b.external_username}\`` → `return \`${b.external_username}\``（去掉 `@`）。`pnpm exec vitest run src/ai/util/channelsFormat.test.ts` → 精确报红 1 例：`bindingLabel 有用户名时加 @ 前缀`（期望 `@nimo`，实得 `nimo`），其余 6 例仍绿。已改回。
2. 破坏 `fillPairInstructions`：删掉 `.split('{code}').join(code)` 一段。→ 精确报红 2 例：`fillPairInstructions 替换 {bot} 与 {code}`（期望 `/pair ABC123`，实得 `/pair {code}`）与 `fillPairInstructions bot 为空时不产出 undefined`（期望 `发 X`，实得 `发 {code}`），其余 5 例仍绿。已改回。
3. 还原后 `git status --porcelain` / `git diff` 均为空，工作区干净，无残留改动。

### 6. 提交纯净性

`git show --stat d799d31`：仅 `src/ai/util/channelsFormat.ts` + `channelsFormat.test.ts` 两个新文件，88 行新增，无 i18n hunk，无 P2a 在途文件卷入。与报告一致，独立核实通过。

### 7. 测试门实测

- `pnpm exec vitest run src/ai/util/channelsFormat.test.ts`：7/7 通过。
- `pnpm test`（全量，`TZ=UTC`）：284 files / 2264 tests 全绿。
- `pnpm test`（全量，`TZ=Asia/Shanghai`）：284 files / 2264 tests 全绿（两档 TZ 结果一致，无已知噪声复现——`persist.test.ts` flake 与 `MemorySection.test.ts` 间歇 RangeError 本次均未出现，无需归属处理）。
- `pnpm exec vue-tsc --noEmit`：0 错误。
- `pnpm build`：成功，仅既有第三方 chunk 体积警告（`ExcelViewer`/`index-CLWmH3Np` 等），与本任务无关。

## 结论

无发现需要登记。实现与 Vue2 源码逐分支/逐字符一致，测试补齐了 Vue2 测试套件的空白且无空转，Task 12 交接注记准确无歧义，提交纯净，全部测试门通过（双 TZ 验证），两次 RED 探针精确命中并已还原。
