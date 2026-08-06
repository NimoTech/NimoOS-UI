# SP8-P2b Task 13 —— 收口(审计 + 验收清单)报告

坐标:`sp8-ai` 分支 HEAD = `efcd6f3`(Task 12: ChannelsSection),working tree clean。
**本任务未修改任何生产代码 / 测试代码 / i18n 文件**——按用户 2026-07-28 标准指令,brief 的
「把七个分区接进 `SettingsPage.vue` 的 `SECTION_COMPONENTS`」这一步整步跳过,
`SettingsPage.vue`/`SettingsPage.test.ts` 全程只读(未 `Edit`/`Write`)。

唯一产出:`.superpowers/sdd/p2b-deferred-wiring.md`、
`.superpowers/sdd/p2b-acceptance-checklist.md`(均在 `.gitignore` 覆盖的 `.superpowers/`
下,`git status` 确认无变更可提交,无需也无法提交)。

## 审计 1:i18n 全量核查

- 提取范围:`BlacklistSection.vue`/`ExecutionSection.vue`/`MemorySection.vue`/
  `SearchSection.vue`/`ObservabilitySection.vue`/`McpTokensSection.vue`/
  `ChannelsSection.vue` 七个分区的全部 `t('key')` 字面调用(145 处唯一 key)+
  `MemorySection.vue` 里两处动态调用 `t(kindLabel(...))`/`t(sourceLabel(...))`
  间接引用的 6 个 key(`aiCfgMemKind*` ×3、`aiCfgMemSource*` ×3),合计 151 个唯一
  key。`SkModal.vue` 自身不调用 `t()`(title/message 由调用方传入,已覆盖在上面 7 个
  分区里);`mcpConnect.ts`/`channelsFormat.ts`/`apiError.ts`/`memoryLabels.ts` 四个
  util 均为纯函数,`memoryLabels.ts` 输出的是 key 名字符串(已计入上面 6 个),其余三个
  不涉及 i18n。
- **151 个 key 全部在 `git show HEAD:src/i18n/zh_cn.ts` 与 `HEAD:src/i18n/en_us.ts`
  两档都存在**(`comm -23` 比对,零缺口)。
- **两档文件各自零重复键**:用 `grep -oE` 提取顶层键名后 `sort | uniq -d`,zh/en 各
  1021 个键、零重复。
- **两档键集完全一致**:`diff` 两份排序后的键名列表,输出为空。
- **零孤儿键**:提取本期(P2b Task 4/5/6/7/8/10/12)在 `zh_cn.ts`/`en_us.ts` 里新增的
  136 个标记块内 key,逐个与上面 151 个「被引用」key 集合比对,`comm -23` 结果为空 ——
  136 个新增 key 无一未被引用(Task 9/11 是纯函数任务,未新增 i18n key)。

结论:**PASS,零缺陷。**

## 审计 2:i18n 值逐字复核 + brace/@ 转义实测

对照权威源 `/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json`,抽样
21 个 key(超过要求的 12 个),覆盖全部 7 个分区,且**全部 6 个含 `@` 或 `{` 的 key 都在
样本里**(`aiCfgRecalledTimes`/`aiCfgInotifyRecommended`/`aiCfgMcpInstructionTemplate`/
`aiCfgChannelsBotTokenTail`/`aiCfgChannelsPairInstructions`/
`aiCfgChannelsBotTokenTelegramHint`):

- 21 个 key 的中/英文值与 Vue2 生产语言包**逐字符一致**(含标点、省略号、破折号 —— 与 em
  dash `—`、全角标点均核对无误)。
- 2 个样本(`aiCfgPhoenixStopConfirm`/`aiCfgObservabilityBanner`)在 `en_US.json` 里查
  不到对应条目 —— 复核后确认这是 **Vue2 自身的既有缺口**:这两处 Vue2 用的是「英文字面量
  本身作 `$t()` 的 key」写法(而不是自定义短 key),Vue2 从未把这类字面量键显式写进
  `en_US.json`,英文环境下 vue-i18n 缺键时回落到 key 本身 = 恰好等于正确英文,不是真的
  「没有英文翻译」。New-UI 两档文件都手动补齐了这两个 key 的英文值(与 Vue2 源码里的英文
  字面量逐字一致),**不算 New-UI 缺陷**,如实记录以免被误读成本审计的疏漏。
- brace/@ 转义实测:未新写探针脚本,而是直接跑
  `pnpm vitest run src/ai/components/settings/sections/McpTokensSection.test.ts
  src/ai/components/settings/sections/ChannelsSection.test.ts`(41 例全绿)。两个测试
  文件都用真实 `createI18n({ legacy: false, locale: 'zh_cn', messages: { zh_cn:
  zh } })`(从 `../../../../i18n/zh_cn` 真实导入,非 mock)挂载组件,且断言点覆盖了三个
  高风险串的渲染结果:
  - `aiCfgMcpInstructionTemplate`:9/10 号用例确认常驻/明文两处文本框都渲染出
    `<YOUR_TOKEN>`(若 `{token}` 转义失效,vue-i18n 会把裸 `{token}` 当具名插值吃掉,
    `buildMcpInstruction` 的 `split('{token}').join(...)` 就找不到子串可换,断言必红)。
  - `aiCfgChannelsBotTokenTail`:13 号用例确认渲染文本含 `token ···ab12`(同理证明
    `{tail}` 子串在 t() 解析后仍然存在)。
  - `aiCfgChannelsPairInstructions`:20 号用例确认弹窗提示文本同时包含 `@fam_bot`
    与配对码 `87654321`(证明 `{'@'}` 与 `{'{'}bot{'}'}`/`{'{'}code{'}'}` 两层转义都
    没有被吃空)。

结论:**PASS,零缺陷**(附带记录 2 处 Vue2 自身既有的、非缺陷性 en_US.json 缺口)。

## 审计 3:CSS 类审计

提取 7 个分区模板里出现的全部静态 class(84 个去重后)+ 1 个动态绑定类(`:class="{
never: ... }"` → `never`),逐个用 `grep -E "\.<class>([^a-zA-Z0-9_-]|$)"` 在
`settings-styles.scss`/`sk-shared.scss`/`tokens.scss` 三档核实存在,并对若干短/通用类名
(`.d`/`.v`/`.k`/`.state`/`.sub`/`.box`/`.code`/`.err`/`.warn`/`.top`/`.hint`)手工核对
上下文选择器是否与模板里的父子结构匹配(逐条列在下方结论)。

- **84 个类里 83 个都能在三档 scss 里找到匹配规则**,且逐条核对上下文(如 `.diag-row .k`
  对应模板的 `.diag .diag-row .k`、`.px-status .state .d` 对应 `.px-status .state .d`)
  均吻合,不是巧合命中。
- **唯一未命中:`.set-page-head`**。核查其状态:New-UI 的 11 个分区(P2a 4 个 + P2b 本期
  7 个)全部用了这个 class,但 `settings-styles.scss`/`sk-shared.scss`/`tokens.scss`
  三档都没有为它写规则。**回查 Vue2 蓝本 `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/
  Settings/sections/*.vue` 与其全局 `settings-styles.scss`,Vue2 自己也从未给
  `.set-page-head` 写过任何 CSS 规则**(`grep -rn "set-page-head {"` 全仓零命中)——
  这正是 brief Step 3 自己举的「已核实为无 Vue2 规则,不算缺陷」的例子。**结论:非缺陷,
  1:1 对齐 Vue2 的既有空白。**
- 另检查了 `SearchSection.vue` 里两处**独立**(不带 `set-banner`)使用的
  `<span class="warn">`/`<p class="warn">`(diagnostics 区)——`settings-styles.scss`
  只定义了复合选择器 `.set-banner.warn`,单独 `.warn` 不会命中任何规则。回查 Vue2
  `SearchSection.vue:45/132` 是**完全同款的裸 `class="warn"` 用法**,Vue2 的
  `settings-styles.scss` 同样只有 `.set-banner.warn` 一条规则 —— **1:1 对齐,非
  New-UI 引入的回归,非缺陷**。

结论:**PASS,零缺陷**(两处标记为「已核实非缺陷」而非直接略过,避免被误读为漏查)。

## 审计 4:配色守卫 + reka 弹窗 token 作用域

- `pnpm test src/styles/color-guard.test.ts` → **161 例全绿**。
- 7 个分区组件**零 `<style>` 块**(`grep -c "^<style"` 逐一确认为 0),`SkModal.vue`
  唯一的 `<style scoped>` 块只有 `var(--text-secondary)`/`var(--bg-chip)`/
  `var(--text-primary)` 三个 token 引用,零裸色。
- 7 个分区 + `SkModal.vue` 全部 `grep -rn "theme-exception"` 零命中。
- `SkModal.vue:21-22`:`portalTo` prop 默认值 `'.set-app'`(`{ portalTo: '.set-app' }`),
  未变。
- `SettingsPage.vue:351`(只读确认,未编辑):根元素仍是
  `<div class="agent-app set-app" :data-theme="aiTheme.theme">`,与 `SkModal` 的默认
  portal 目标一致,token 作用域未漂移。

结论:**PASS,零缺陷,D1 的作用域约束仍成立。**

## 审计 5:全量测试门 + 构建 + dev server

```
pnpm test                    → 285 files passed / 2290 tests passed(56.22s)
pnpm exec vue-tsc --noEmit   → 无输出,类型检查干净
pnpm build                   → 构建成功,仅有的告警是既有的 >500KB chunk 体积警告
```

- 已知噪声按约定复核:`src/files/upload/persist.test.ts` 本次运行**未出现**红/flake;
  `MemorySection.test.ts` 出现了两条 `RangeError: Maximum call stack size exceeded`
  的**未处理 Promise rejection 打印**(vitest 控制台 stderr,不是断言失败,不计入红项),
  与约定描述的「间歇性未处理 RangeError、仍是绿」现象一致,测试结果仍是全绿(285/285
  files、2290/2290 tests,无失败用例)。
- 端口 5288:`ss -ltnp | grep 5288` 确认已有 `node` 进程监听,`curl -o /dev/null -w
  '%{http_code}' http://127.0.0.1:5288/app/` 返回 `200`。**判断这是另一个会话(P2a)已在
  跑的 dev server,本任务未启动新进程、未产生端口冲突,也未执行任何停止操作**(该 server
  不是本任务启动的,没有义务也不应该去关它)。

结论:**PASS。** 全量测试 285/285 文件、2290/2290 例通过,零本任务归属的红项。

## i18n 复用/新增

本任务**零新增 i18n key**(纯审计任务,未触碰 `zh_cn.ts`/`en_us.ts`)。已核对的
151 个引用 key 与 136 个 Task 4/5/6/7/8/10/12 新增 key 均如上文列出,未发现需要补的
缺失键。

## 偏离声明

- 唯一偏离:遵照本任务 prompt 里「用户 2026-07-28 标准指令」的明确要求,**跳过** brief
  Step 1(把 `SECTION_COMPONENTS` 接线进 `SettingsPage.vue` + 补测试断言)——理由是
  `SettingsPage.vue`/`SettingsPage.test.ts` 是另一个正在运行的 P2a 会话的在途文件,接线
  会让对方的占位断言变红。已将机械化的接线步骤写进
  `.superpowers/sdd/p2b-deferred-wiring.md`,留给 P2a 收官后执行。
- 未发现任何需要立即改代码修复的真实缺陷(五项审计均 PASS)。两处「已核实非缺陷」
  (`.set-page-head` 无样式、`SearchSection` 裸 `.warn`)与两处「已核实非缺陷」的
  `en_US.json` 缺口在报告正文中显式说明,均为 1:1 对齐 Vue2 既有状态,不构成偏离。

## 未覆盖风险(留给人工验收)

见 `.superpowers/sdd/p2b-acceptance-checklist.md` 第 9 节汇总:agent 组 5 分区并发首挂、
Phoenix 安装/停止端到端真实流程、两个敏感弹窗的真实视口居中与主题跟随、纯 HTTP 环境下的
三处剪贴板路径、管理员/非管理员 Channels 视角差异、Discord/Telegram 真实联调。
