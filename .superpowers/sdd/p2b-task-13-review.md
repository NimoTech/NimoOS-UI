# SP8-P2b Task 13 —— 收口审计的评审

坐标核对:`sp8-ai` HEAD = `efcd6f3`,`git status` clean,`git diff HEAD -- src/ai/views/` 为空 —— Task 13 确实没有碰 `SettingsPage.vue`/`SettingsPage.test.ts`,没有提交任何东西。产出仅为 `.superpowers/sdd/p2b-deferred-wiring.md` 与 `.superpowers/sdd/p2b-acceptance-checklist.md` 两份文档(均在 `.superpowers/` 下,报告称受 `.gitignore` 覆盖 —— 未逐一核实 `.gitignore` 规则本身,但 `git status` clean 已经是充分证据)。

## 判定 1:spec compliance —— ✅ PASS

调整后范围(五项审计 + 两份交接文档,跳过 SettingsPage 接线)完全遵守。没有修改生产代码/测试代码/i18n 文件,没有提交。

## 判定 2:task quality —— Approved(4 条低严重度发现,均不影响任何 PASS 结论)

### 我自己独立复算的结果

- **i18n 覆盖**:自己从 7 个分区文件重新提取 `t('key')` 字面量 = 145 个,加 `memoryLabels.ts` 的 6 个动态 key(kindLabel ×3 + sourceLabel ×3)= **151**,与报告一致。逐一检查过没有其它动态 key 构造方式(模板字符串拼 key、`SkModal` 内部 `t()`、`:class` 之外的动态属性)——确认没有漏。
- **两档语言包总键数**:第一次数出 1020(bare `key:` 正则漏了一个带点号的加引号 key `'ai.searchMyNas'`),补上后 = **1021**,与报告一致;zh/en 键集 `diff` 为空、各自 `uniq -d` 零重复,与报告一致。
- **本期新增键**:按 7 个 Task 的标记块逐块数 = **136**,与报告一致;`comm -23` 校验 136 个新增 key 全部被引用,零孤儿,与报告一致。
- **结论:报告的 151/1021/136/0 四个数字全部复核通过,无出入。**

### 值逐字复核

自选 11 个 key(覆盖报告点名的全部 6 个含 `@`/`{` 的 key:`aiCfgRecalledTimes`/`aiCfgInotifyRecommended`/`aiCfgMcpInstructionTemplate`/`aiCfgChannelsBotTokenTail`/`aiCfgChannelsPairInstructions`/`aiCfgChannelsBotTokenTelegramHint`,另加 5 个长句/标点密集的 key:`aiCfgBlacklistDesc`/`aiCfgMemoryOffBanner`/`aiCfgObservabilityBanner`/`aiCfgPhoenixStopConfirm`/`aiCfgPhoenixInstallConfirm`),用 Python 直接按 key 取值(不是子串搜索,避免误命中 Vue2 语言包里同时存在的「英文字面量本身作 key」的历史条目)逐字符 diff 权威源 `NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json`,**11/11 全部逐字符一致,零发现**。

### CSS 类审计

重新从 7 个分区模板提取 `class="..."` 静态类,得到 **85** 个(报告称 84,差 1,见下方发现)+ 1 个动态类 `never`(`McpTokensSection.vue:274` 的 `:class="{ never: !tk.last_used_at }"`,确认这是模板里**唯一**的动态 `:class` 绑定,没有数组/对象语法的其它实例)。逐个用真实正则 `grep -E "\.<class>([^a-zA-Z0-9_-]|$)"` 核对三档 scss,**86 个里只有 `.set-page-head` 未命中**,与报告结论一致(未发现报告漏查的类)。

### 配色守卫 + SkModal 作用域

`pnpm test src/styles/color-guard.test.ts` 161 例全绿;`SkModal.vue:21-22` 与 `SettingsPage.vue:351` 的行号/内容与报告引用逐字核对一致。

### 测试门

自己重跑:
```
pnpm test                    → 285 files / 2290 tests,全绿
pnpm exec vue-tsc --noEmit   → 无输出
pnpm build                   → 成功,仅有既定 >500KB chunk 警告
pnpm vitest run McpTokensSection.test.ts ChannelsSection.test.ts → 41/41 全绿
```
与报告数字完全一致,无红项。

### deferred-wiring.md 可执行性核查(本次评审的重点)

- 7 条 import 路径 `../components/settings/sections/*.vue`:核对 `SettingsPage.vue` 位于 `src/ai/views/`,7 个分区组件确实都在 `src/ai/components/settings/sections/` 下且文件名与 import 语句逐一吻合,与 P2a 现有 `ModelsSection` 等四个 import 同一相对路径写法——**可直接照抄,无问题**。
- `SECTION_COMPONENTS` HEAD 现状引用(:70-84)逐字核对与 `SettingsPage.vue` 实际内容**完全一致**(13 个 key、注释文字、缩进都对得上)。
- `SectionId` 全集与 `sections.ts` 交叉核对一致(13 个 id,`DEFERRED_SECTIONS`/`SPLIT_SECTIONS` 均为 `['skills','mcp']`,与文档「明确不动」的声明一致)。
- it(10)/it(11)/it(12)/it(14)/it(16) 五条用例的引用文本、行号、断言内容逐一核对 `SettingsPage.test.ts` **完全吻合**。
- **发现(低严重度)**:文档第 4 节写「`grep -n "SectionPlaceholder" src/ai/views/SettingsPage.test.ts` 只命中两处注释性文字」——实测该精确命令**零命中**(`grep -c` = 0),不是两处。文档里真正的两处「占位」相关注释来自 grep `"占位"`(中文字符串),不是 `"SectionPlaceholder"`。结论本身(现有测试没有一条断言字面检查 `SECTION_COMPONENTS→SectionPlaceholder`)仍然正确、甚至因为是零命中而更站得住,但**引用的验证命令与其输出不对应**,执行者若真的照着跑一遍会发现证据对不上,可能怀疑文档其它部分的可信度。建议协调者收官前改成准确的引用(如改成 grep `"占位"` 或如实写「零命中」)。
- 其余四条建议/守卫(不动 `DEFERRED_SECTIONS`/`SPLIT_SECTIONS`、`export SECTION_COMPONENTS` 的最小改动理由、mock 缺口提示、验证命令)均可执行、无发现问题。

### acceptance-checklist.md 覆盖度核查

对照我被要求核实的清单(两个 SkModal 弹窗视口居中+主题跟色、agent 组并发首挂、scroll-spy、管理员/非管理员 Channels、Phoenix 装/停端到端、纯 HTTP 剪贴板)逐项在文档里定位到:第 0 节(双主题总纲)、第 1 节步骤 1(agent 组并发首挂)、第 5 节(Phoenix 全流程,含卸载守卫)、第 6 节步骤 4(MCP 令牌弹窗三视觉点)、第 7 节步骤 3(配对码弹窗同三视觉点,且明确写「不能只验一次就假设另一个也对」)、第 8 节(scroll-spy)、第 7 节管理员/非管理员分栏、第 3/6/7 节三处剪贴板(均明确要求纯 HTTP 环境验证,不能只信任 localhost)、第 9 节汇总。**未发现清单里有遗漏项**;第 9 节的清单条目与我逐项定位到的六大风险点一一对应。检查过文档全文没有出现「已验证」「已确认通过」这类倒填结果的措辞——清单本身通篇是面向人工执行者的指令句,不构成对视觉效果的预先断言。

### 其它低严重度发现

- 报告称 CSS 审计「84 个类」,我独立复算得 **85**(净差 1,`never` 单独计,不含在 84/85 内)。逐个核对后确认这 1 个差额不是被报告漏查的类——它同样能在 scss 里命中,不影响「只有 `.set-page-head` 未命中」的结论。计数口径小误差,非缺陷。
- 报告称「2 个样本(`aiCfgPhoenixStopConfirm`/`aiCfgObservabilityBanner`)属于 Vue2「英文字面量本身作 key」导致 en_US.json 无对应条目」的非缺陷模式——我核实发现同一模式下还有第 3 个:`aiCfgPhoenixInstallConfirm`(Vue2 key 字面量 `'Agent monitoring needs the Phoenix app (Docker). Download and install it now?'`,en_US.json 同样没有独立条目)。New-UI 该 key 的英文值我已核对与 Vue2 字面量逐字一致,**不是缺陷**,只是报告叙述用「2 处」低估了这个模式的出现次数。
- brief Step 3「跨任务一致性 grep」(`useSettingsStore` 只归 Blacklist、`defineStore` 计数为 0、裸 `.sk-modal-bg` 计数为 0、6 个分区直调 `service.ai`)在报告的五项审计里**没有被作为独立一项显式跑出结果并汇报**(只在审计 3 里顺带提了一句「brief Step 3 举的例子」,指的是另一件事)。我自己补跑:`defineStore` 在 `src/ai/components/settings/` 下 0 命中;`sk-modal-bg` 2 命中但都在 `McpTokensSection.vue`/`ChannelsSection.vue` 的 D1 申报注释里引用 Vue2 写法,不是真实用法;`useSettingsStore` 只有 `BlacklistSection.*` 命中(P2b 范围内)。**结论仍是 PASS**,但报告本身没有把这条检查显式跑出来交代,是审计完整性上的一处疏漏。

### RED 探针

未做——本任务无生产代码可破坏,我对每条数字/事实性声明都用独立的重新提取/直接取值/重跑命令方式验证,没有需要靠“故意破坏再还原”才能验证的声明。仓库全程只读,`git status` 结束时仍 clean。

## 汇总

- 5 项审计的 PASS 结论:**全部独立复核通过**,数字口径完全对得上(i18n 151/1021/136/0;CSS 84~85/1 missing;color-guard 161;测试门 285/2290/tsc clean/build clean)。
- 两份交接文档:`p2b-acceptance-checklist.md` **无遗漏**;`p2b-deferred-wiring.md` **可直接执行**,但第 4 节有一处引用证据(grep 命令输出)与实测不符,建议协调者要求执行者收官时先重新跑一次那条 grep 核实,而不是照抄文档字面数字。
- 无阻断级或高severity发现。
