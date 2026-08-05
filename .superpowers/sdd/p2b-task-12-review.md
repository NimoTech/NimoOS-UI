# SP8-P2b Task 12 评审 —— ChannelsSection(聊天渠道)

提交:`efcd6f34205dc5c529e8358014aa5efb001d3698`

## 1. 1:1 视觉/交互 fidelity

逐行对照 Vue2 `NimoOS-UI/src/views/AI/Settings/sections/ChannelsSection.vue`(410 行)
与新组件模板:

- 三个 `.sk-section`(管理员机器人配置 `v-if="isAdmin"` / 配对聊天账号 / 我已绑定的账号)、
  两个弹窗(加机器人 / 配对码明文)、两个确认对话框(删机器人 / 解绑),元素顺序、字段、
  按钮文案、disabled 条件(`!newToken.trim() || adding`)、空态文案、机器人行的
  `@username` + token 尾号 + 邀请链接(`target=_blank rel=noopener`,仅 `invite_url` 存在时
  渲染)、启用开关是原生 `<input type="checkbox">` 包 `<label class="chan-switch">`(未
  "顺手统一"成 SetSwitch,如 Vue2 :34-37)——均一一对应,未发现遗漏或多余元素。
- 两处 `SkModal` 在模板里被移到三个 section 之后(Vue2 是内联穿插),但 `SkModal` 用
  `DialogPortal :to defer` 做 Teleport,视觉渲染位置与模板书写顺序无关,不构成可见差异。
- 用到的每个类都 grep 确认存在于 `settings-styles.scss`(`tok-row/ic/body/name/meta/del`、
  `sk-section*`、`set-note/rows/row/input`、`sep`、`set-copy/copybtn`、`sk-field*`、`sk-btn`
  等)。`set-page-head` 未在任何 scss 里落样式,但这是全部 7 个兄弟分区(Blacklist/
  Execution/Memory/…)共用的既定写法,非本任务引入的新问题,不算 Task 12 缺陷。

结论:视觉/交互 1:1,无未申报偏离。

## 2. 样式完整性

- Vue2 `<style scoped>` 9 条 `.chan-*` 规则(`.chan-x`/`.chan-x:hover` 已收编进 `SkModal`
  的 `.sk-x`,不搬)逐字迁入 `settings-styles.scss:207-226`,值本来就是 `var(--…)`,无需摘
  裸色。
- RED 探针:删掉这 9 条规则、只留注释块 → `settingsStyles.test.ts` 的新断言精确报红
  (`toContain('.chan-bot {')` 等失败),证明断言选择器紧跟 `{` 且抓真实声明
  (`border-color: var(--accent)`),不会被注释里提到的类名撞对——Task 10 二次评审那个
  "删规则留注释仍通过"的漏洞在这里没有复现。已还原,`git status` 干净。

## 3. i18n

- 30 条新值逐字符核对 `NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json`(用 python 直接读
  JSON 比对全部 31 行,含标点/省略号/引号),**全部一致**,复用键 `aiCfgChannels` 等 12 个
  均在 HEAD 两档语言包内且无重复定义(grep 确认)。
- 三处 `@`/大括号敏感键手动渲染验证(用真实 `createI18n` + 真实 `zh_cn.ts`,非 stub):
  `t('aiCfgChannelsBotTokenTelegramHint')` → `'Token 来自 Telegram 的 @BotFather。'`、
  `t('aiCfgChannelsPairInstructions')` → `'打开 Telegram，给 @{bot} 发送：/pair {code}'`、
  `t('aiCfgChannelsBotTokenTail')` → `'token ···{tail}'` —— 三者均逐字复原,未被 vue-i18n
  当命名插值吃空。模板里的 `@{{ inst.bot_username }}` 是纯 HTML 插值,不经 i18n,无需转义,
  组件也确未转义。
- `messageSyntax.test.ts`/`parity.test.ts` 单独跑通过(169 例)。

## 4. 承接 Vue2 spec.js 8 条

| # | Vue2 断言(`w.vm.*`/mock 参数) | New-UI 断言(DOM/mock) | 同一事实? |
|---|---|---|---|
| 1 | `pairable.length===1`、`listChannelInstances` 未调、`isAdmin===false` | `.set-row` 数=1、内容含 fam、`listChannelInstances` 未调、文本不含"机器人配置" | 是 |
| 2 | `isAdmin===true`、`listChannelInstances` 已调 | 文本含"机器人配置"、mock 已调 | 是 |
| 3 | `revealedCode`/`showCode`/`codeInstance.bot_username` | 明文码在 `.sk-modal` 只读输入框、弹窗文本含 `fam_bot` | 是 |
| 4 | `b.default_model` 直接赋值 | `ModelPicker` 真实挂载,`selectedKey` prop 更新 + `.model-pill-name` 显示新名 | 是(更强,经过真实子组件往返) |
| 5 | `b.download_dir` 直接赋值 | 输入框 `.value` 更新为新值 | 是 |
| 6 | `bindings.map(id)` | `.tok-row` 行数减少、该行消失 | 是 |
| 7 | `createChannelInstance` 调用参数 | 同(唯一一条本来就走 mock 断言) | 是 |
| watch:isAdmin | 未列为编号,Vue2 :192-195 | 未移植,已在组件头/commit message 三处声明 | 见下 |

未移植 watch 判定:本仓 `isAdmin` 是 `useSessionStore().user` 的 `computed`,只读
`localStorage`、不依赖任何响应式 ref;经查 `stores/session.ts` 头注释与实现,该 computed
在同一实例内**不会**因 `setUser` 之后重新求值(无响应式依赖可触发重算),而角色切换在本仓
架构上只能通过整页重载完成(新 Pinia 实例)。故 Vue2 watch 想捕捉的"同一组件实例内角色由
user 跳变为 admin"场景在本仓确实不可能发生,判定为真死代码,未移植处理得当,声明也到位。

## 5. Case #15(开关失败复原)RED 探针

在 `catch` 块里加回 `inst.enabled = enabled`(重新引入"失败也写"的缺陷)→ 用例 #15 精确
报红(`expect(...).toBe(true)` 收到 `false`)。原因:mock 对同一 `inst` 对象的引用在多次
`mount` 之间共享,失败路径的错误写入会残留到该对象上,重新挂载后即可观察到。证明"干净
重挂载断言数据源"这套写法**确实**能捕捉该缺陷,不是空转;已还原,`git status` 干净。

## 6. 建构块复用

- 两个弹窗都是 `SkModal`(非手写 `.sk-modal-bg`),两个确认都是 `AlertDialog`——D1 已在
  文件头/commit message 声明。
- `channelsFormat.ts`(`bindingLabel`/`fillPairInstructions`/`fillTokenTail`)、
  `apiError.ts`(`apiErrorMessage`)、`useSessionStore().isAdmin`、`AgentIcon`(name="user"
  用于绑定行图标)、`clipboard.ts` 的 `copyText` 均按预期复用,未重新实现。
- 对照 `NimoOS-Service/dist/ai.d.ts`:10 个 Channels 方法名(`listPairableChannelInstances`
  / `createChannelPairingCode`/…)与全大写 `listModels`/`listProviders` 等,组件调用逐一
  匹配,无拼写/大小写偏差。
- 无多剥 `.data`:`loadPairable`/`loadBindings`/`loadInstances` 直接读 `res.instances`/
  `res.bindings`(公共约束 §5,body 原样),`loadModels` 保留 Vue2 "models 或裸数组"防御性
  兜底结构,未删。

## 7. RED 探针(4 处不同区域,均已还原)

1. **管理员门控**:`isAdmin` 强制常量 `false` → 11/24 报红(涉及 #2/#7/#8/#13/#14/#15/#16/
   #17/#18/#19/#24* 等所有依赖管理员段的用例)。已还原。
2. **配对码流程**:`genCode` 里删掉 `showCode.value = true` → #3/#20/#21 报红(3/24)。已还原。
3. **删机器人确认框**:`confirmDeleteBot` 里删掉 `confirmDeleteBotOpen.value = true` →
   #16 报红(1/24,`clickAlertButton` 找不到按钮)。已还原。
4. **#15 复原逻辑**:见上节,加回缺陷 → #15 报红(1/24)。已还原。
5. **样式回归**(额外第五处):删 `.chan-*` 9 条规则留注释 → `settingsStyles.test.ts` 新增断言
   报红(1/10)。已还原。

`git status`/`git diff` 全程干净,五次探针均精确还原到探针前字节内容。

## 8. 空转/削弱抽查(8+ 例)

抽查 #4/#7/#13/#17/#18/#19/#22/#23/#24a/#24b(共 10 例)逐条推理:均断言具体可观察事实
(payload 精确值、prop 更新+子组件渲染文本、控件 disabled 态、表单复位后的字段值、双路径
错误文案、两个独立 try/catch 的隔离性、`toEqual` 精确结构比对),删掉对应行为均会导致
断言失真——未发现空转。#15 已单独用 RED 探针验证非空转(见上)。未发现被削弱/删除的既有
断言(7 条 spec.js 全部承接,且部分更严格,如 #4 经真实 `ModelPicker` 往返)。

## 9. 测试门(自己实测)

```
pnpm vitest run src/ai/components/settings/sections/ChannelsSection.test.ts   → 24/24 通过
pnpm test                                                                     → 285 files / 2290 tests 全绿(本次运行未见 persist.test.ts flake)
pnpm exec vue-tsc --noEmit                                                    → 无输出,干净
pnpm build                                                                    → 成功,仅第三方包 + >500KB chunk 既有警告
```

## 10. 提交纯净性

`git show --stat efcd6f3`:仅 6 个声明文件(`ChannelsSection.vue`/`.test.ts`、
`settings-styles.scss`、`settingsStyles.test.ts`、`zh_cn.ts`、`en_us.ts`)。i18n diff 仅含
Task 12 标记块(`>>> SP8-P2b Task 12` … `<<< SP8-P2b Task 12`),未见 P2a 在途文件被卷入。

## 结论

未发现 Critical / Important / Minor 级问题。样式落点偏离 brief(迁入 `settings-styles.scss`
而非组件内 `<style scoped>`)已按 constraints §4 的既定范式正确处理并三处声明,不算缺陷。
