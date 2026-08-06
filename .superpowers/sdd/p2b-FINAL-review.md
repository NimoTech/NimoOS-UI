# SP8-P2b 全支线终审(whole-branch, cross-cutting)

范围 = P2b 的 14 个提交(`868b3df` … `efcd6f3`,New-UI)+ Service 侧 `c8f1919`。
**已从交错的 P2a 提交(`a21a0b2`/`fe235b0`/`3760271`/`a21270a`/`5dd39dd`/`7a1c71f`)中剔除。**
`SettingsPage.vue` / `SettingsPage.test.ts` / `SectionPlaceholder.vue` / `router/index.ts` /
`sections/{Models,Providers,Privacy,ThinkingDefaults}Section.*` 属 P2a,不评审。

判定:**SHIP —— 附两处 ≤5 行的合流前修复**(一条测试递归、一条删除失败文案统一)。
零 Critical、零 Important。七个分区的功能行为、i18n、样式、资源收尾在聚合层面都成立。

---

## 0. 我自己实测的三门(不采信任何报告)

| 门 | 结果 |
|---|---|
| `pnpm test`(第 1 次) | **285 files / 2290 tests 全绿**,exit 0;stderr 打印一条 `Exception in PromiseRejectCallback: RangeError: Maximum call stack size exceeded` |
| `pnpm test`(第 2 次,已打接线探针) | 285 / 2290 全绿 |
| `pnpm exec vitest run --sequence.shuffle` | 285 / 2290 全绿(seed 1785252838039)—— **文件顺序无关,不存在跨档污染** |
| `pnpm exec vue-tsc --noEmit` | 零输出 |
| `pnpm exec vite build` | 成功,仅既有 `>500 kB chunk` 警告 |
| `src/files/upload/persist.test.ts` | 三次全量均未红(已知 IndexedDB flaky 本轮没触发) |

## 1. 探针清单(全部已还原,`git status` / `git diff` 均为空)

1. **`MemorySection.test.ts:253-257`** —— 给用例 13 的 `mockImplementation` 加计数器并在第 3 次
   截断递归 + `console.log`。结果:打印 3 条 `PROBE putMemorySettings call# 3`,RangeError 消失。
   **证实递归机制**(见发现 F1)。已 `cp` 还原。
2. **`src/ai/util/apiError.ts`** —— 删掉 `response.data.message` 分支。结果:**10 条用例红,横跨
   6 个分区档 + util 档**(Blacklist / Execution / Search / Memory / McpTokens / Channels),
   证明共享助手在这 6 个分区里真的承重;**ObservabilitySection 保持绿**(见 F7)。已还原。
3. **`src/ai/views/SettingsPage.vue`** —— 按 `p2b-deferred-wiring.md` 逐字执行 7 条 import + 7 行
   映射表替换(**这是 P2a 在途文件,仅作只读探针,未提交、已 `cp` 还原,`git status` 干净**)。
   结果:`vue-tsc` 清、`SettingsPage.test.ts` 29/29、全量 285/2290 全绿。见第 5 节。

---

## 2. 发现(按严重度)

### F1 · MINOR(建议合流前修,1 行测试改动)
`src/ai/components/settings/sections/MemorySection.test.ts:253-257`

用例 13 的 mock 内部调 `w.find('.set-input.num').setValue('99999')`。VTU 的 `setValue` 对
`INPUT` 是 `element.value = v; trigger('input'); return trigger('change')`
(`@vue/test-utils/dist/vue-test-utils.cjs.js:7324-7328`)—— 而组件监听的正是
`@change="saveContextWindow"`(`MemorySection.vue:172`)。`dispatchEvent` 是**同步**的,于是:
`change → saveContextWindow → putMemorySettings → mockImplementation → setValue → change → …`
**无界同步递归 → `RangeError: Maximum call stack size exceeded`**;该 RangeError 在 async 函数里
变成 rejected promise,最外层 catch 把 `contextWindow` 还原成快照值 `'8192'`,所以断言照样通过。

实测频率:单独跑该档 6 次,**3 次复现 3 次不复现**;全量跑 3 次里 1 次复现。
用例本身**并非空转**(把快照语义换成"读当前值"仍会红,因为末次 setValue 留下的是 `'99999'`),
但它是靠一次栈溢出走到断言的。

为什么要修:① 整个 suite 的 stderr 被污染;② Node 的 `PromiseRejectCallback` 自己抛
RangeError 时会**吞掉同一批次里其它真实的 unhandled rejection 上报**,等于把全仓的
unhandled-rejection 告警变成不可靠信号;③ vitest 日后若把 unhandled error 升为失败,这条会
直接变红。修法:mock 里改成 `(w.find(...).element as HTMLInputElement).value = '99999'` +
`await w.find(...).trigger('input')`(只驱动 v-model,不再触发 `change`),行为等价、不再递归。

**同时关闭台账两条悬账**:P2a 终审的 M3(「全量跑会打印 RangeError,非 P2a 引入」)与
P2b Task 3 记的「MemorySection.test.ts 间歇泄漏」是同一件事,根因至此定性 —— **是 P2b 引入的**。

### F2 · MINOR(跨分区一致性,建议合流前修,3 处 1 词)
同一个「删除失败」语义,七个分区用了**三种**文案:

| 位置 | 兜底键 | 渲染 |
|---|---|---|
| `BlacklistSection.vue:62` | `aiCfgDelete` | **「删除」/「Delete」**(裸名词进 danger toast) |
| `MemorySection.vue:117` | `aiCfgSaveFailed` | 「保存失败」/「Save failed」(**删除**操作却说保存) |
| `McpTokensSection.vue:146`、`ChannelsSection.vue:223`、`ChannelsSection.vue:276` | `aiCfgDeleteFailed` | 「删除失败」/「Delete failed」✅ |

`aiCfgDeleteFailed`(zh 删除失败 / en Delete failed)已在 HEAD 两档语言包里(我已核),
是三处唯一正确的兜底。Vue2 侧:`BlacklistSection.vue:100` 是裸 `e.message`(没有兜底),
`MemorySection.vue:153-155` 是**完全静默**,所以两处都没有「必须照 Vue2」的约束 ——
纯粹是三个任务各自选串、无人对齐。台账 Task 4 Minor ③ 已记「`aiCfgDeleteFailed` 是更正确的
兜底,可留作后续快跟修」,但一直没人跟。**这就是本次终审最典型的"聚合才看得见"缺陷。**

### F3 · MINOR(未申报偏离,§7 本身即缺陷)
`src/ai/components/settings/sections/ObservabilitySection.vue:145` / `:148`

`onToggle` 在**打开确认弹窗时**就把 `enabled.value = v` 乐观置好。Vue2
(`ObservabilitySection.vue:118-146`)**不写 `enabled`** —— 而两仓的 `SetSwitch` 都是**全受控**
组件(`:data-on="modelValue"`,自己不留内部态,Vue2 `SetSwitch.vue:3` / 本仓 `SetSwitch.vue:33`),
所以 Vue2 里点开关后**开关视觉原地不动**,直到流程真的完成。

可见后果两条:
- 停用路径:开关先视觉拨到关 → 模板 `v-if="phoenixStatus === 'running' && !enabled"` 立刻为真 →
  **「Phoenix 正在运行但监控未开启。」警告条在确认弹窗还开着的时候就冒出来**(Vue2 不会)。
- 安装路径:弹窗在问「现在下载并安装?」,而开关已经显示为**开**。

头注释确实提到「本仓的开关在 `onToggle` 里已经乐观视觉置关了」,但那是作为
`onStopCancel` 的**前提**陈述,不是把「引入乐观置位」本身当偏离申报(三件套缺 ①②③ 各一半),
台账零登记。而且这条偏离**根本没必要**:照 Vue2 不写 `enabled`,`onInstallCancel` /
`onStopCancel` 两个函数就都成了空函数,与 Vue2 `onCancel` 逐字一致。

### F4 · MINOR(未申报偏离,已在台账、此处确认)
`src/ai/components/settings/sections/SearchSection.vue:107-111` 的 `markSaved()` 2 秒自动隐藏,
修的是与 `ExecutionSection` 完全同一个 Vue2 缺陷(`SearchSection.vue:199/212` 的 `savedAt`
置上永不清)。**ExecutionSection 头注释「逻辑修正 2」明确申报,SearchSection 的头注释只列了
1/2/3(catch / rescanTimer / clipboard),漏了这条**,实现者报告也没写。

一致性本身没问题(我核过:Vue2 里只有这两个分区有 `savedAt` 型指示器,两处都修了、修法相同;
Memory / Observability / McpTokens / Channels / Blacklist 都没有这类常驻指示器)。缺的只有申报。
修法零代码:补头注释 + 台账一行。

### F5 · LOW(申报理由与事实不符)
`src/stores/session.ts:20-33` 的注释写「登录/切换用户都走整页重载,不存在'写了不刷新'的中间态」。
**事实相反**:`src/views/Login.vue:44` 用 `router.push(target)` 完成登录,**没有整页重载**
(`onAuthFail` 也只是 hash 路由跳 `/app/#/login`)。

因为 `user` 是**零响应式依赖**的 `computed`(只读 `localStorage`),它会把首次求值结果缓存到
Pinia 单例的生命周期结束。于是「管理员退出 → 同一页登录成另一个非管理员 → 再进聊天渠道」
会读到**陈旧的 `isAdmin`**,`ChannelsSection.vue:313` 的管理员机器人配置段会错显/错隐。
目前 `session.user` / `session.isAdmin` 的唯一消费者就是 ChannelsSection(我全仓 grep 确认),
所以触发窗口很窄;但注释给出的安全性论证是错的,后续阶段(P3/P4)照着它用会踩坑。
最小修法:去掉 `computed`,改成普通函数;或让 `setUser` 同时写一个 `ref`。

### F6 · LOW(未申报的微加固)
`src/ai/components/settings/sections/MemorySection.vue:75` 给 `listUserMemory()` 加了 `|| []`;
Vue2 `MemorySection.vue:108` 是裸 `this.memories = await ai.listUserMemory()`,后端给 `null`
时会让模板 `memories.length` 抛错。改得对,但三件套一条都没写。

### F7 · LOW(聚合覆盖缺口,探针实证)
把 `apiErrorMessage` 的 `response.data.message` 分支拆掉后,10 条用例红、覆盖 6 个分区,
**唯独 `ObservabilitySection` 全绿** —— 它唯一的 `apiErrorMessage` 调用点
(`ObservabilitySection.vue:229`,安装失败 → 行内 `.px-msg.err`)没有任何用例断言"后端消息优先"
这条路径。与台账 Task 8 Minor ①(用例 9 判别力弱)同源。

### F8 · LOW(测试收尾三种写法并存)
- `McpTokensSection.test.ts:87` / `ChannelsSection.test.ts:102`:`afterEach` 只 `document.body.innerHTML = ''`,**从不 `unmount()`** → Vue 应用实例带着脱离文档的 DOM 活到档尾。
- `ObservabilitySection.test.ts:90`:反过来 —— 每例 `w.unmount()`,`afterEach` 不清 body。
- `SkModal.test.ts:19`:清 body。
- `Blacklist/Execution/Memory/Search.test.ts`:两者都不做。

今天无害(vitest 默认按档隔离环境,我已用 `--sequence.shuffle` 实测全绿),但正是本期
要消灭的那种"兄弟件各写一套"。假定时器两处(`ExecutionSection.test.ts:33`、
`SearchSection.test.ts:61`)都有 `vi.useRealTimers()` 收尾,**没有遗留的 fake timer**。

### F9 · INFO(噪声,但七档一致)
`vitest.setup.ts:24-26` 已经全局装了应用 i18n,七个分区档又各自 `createI18n` 从
`global.plugins` 传一份 → 每次挂载打印 7 行 `[Vue warn] Component "i18n-t" has already been
registered in target app.`。全量跑累计数千行 stderr。行为正确(后装的本地实例胜出,断言的
就是它的 zh_cn 值),七档写法一致,故不算"分歧",只记噪声。

---

## 3. 聚合层面**核过且成立**的部分(证据)

### 3.1 七个分区的风格一致性
- **根标记**:七个全部 `<div class="set-inner">` → `<div class="set-page-head">`(`h1.set-h1` + `p.set-desc`)→ 若干 `<div class="sk-section">`。零例外。
- **零 `<style>` 块**:七个 `.vue` 里真实 `<style` 标签数 = 0(grep 命中的都是头注释里的文字)。`SkModal.vue` 有一个 scoped 块,收编 Vue2 `.mcp-x` / `.chan-x` 两份重复,合理。
- **D2 申报**:七个头注释各有一句,Blacklist 申报"唯一用 store"、其余六个申报"本地 ref"。全仓 `defineStore` 新增 **0**;七个分区里 `useSettingsStore` 只出现在 Blacklist(`ModelsSection`/`PrivacySection`/`ProvidersSection` 是 P2a 的,不算)。
- **错误处理 idiom**:六个分区的失败路径统一 `toast.show(apiErrorMessage(e, t(...)), 3000, 'danger')`;复制失败统一 `toast.show(t('aiCfgCopyFailed'), 3000, 'warning')`;复制成功统一 `toast.show(t('aiCopied'))`(默认 1500 info)。Observability 不弹 toast、走行内 `.px-msg.err` —— **与 Vue2 一致**(Vue2 该分区也只有 `this.error`)。
- **挂载失败一律不弹 toast**:Blacklist 静默(申报)、Execution 静默、Search 静默、Memory 行内 `.set-note`、Observability 静默 → **五个分区同时挂载时不会 toast 糊屏**,BlacklistSection 头注释的那条论证在聚合层成立。
- **弹窗**:三处明文/表单弹窗全部走 `SkModal`,裸 `.sk-modal-bg` div **0** 处;确认框全部走共享 `AlertDialog`,输入框走 `PromptDialog`。
- **零 `theme-exception`**,七个分区零裸色。

### 3.2 「同一个 Vue2 bug,是否每个分区都修了」
| Vue2 缺陷 | 出现在 | P2b 处理 |
|---|---|---|
| 保存路径无 catch → 静默失败 | Execution `:66-79`、Search `:188-219`、Memory `:115-156`(含 remove) | 三个分区全部补 catch + danger toast,三件套齐(Memory/Execution 完整,Search 见 F4) |
| `savedAt` 永不清 → 「已保存」常驻 | Execution `:73`、Search `:199/212` | 两处都补 2s 自动消失 + `onUnmounted` 清定时器;**Execution 申报、Search 未申报(F4)** |
| `navigator.clipboard` 明文 HTTP 下静默 no-op | 仅 Search `:220-222` | 改走 `copyText`(McpTokens/Channels 的 Vue2 原文**本来就有** execCommand 兜底 + 成功/失败 toast,所以那两处是 1:1 而非漏修 —— 我逐行核过 Vue2 `McpTokensSection.vue:218-233` 与 `ChannelsSection.vue:365-380`) |
| 卸载后定时器/轮询继续写 state | Search `:217`、Observability `:110-117` | Search 加 `rescanTimer` + 清理;Observability 加 `alive` 门 + `onUnmounted`。两处都申报 |
| 删除失败无提示 / 文案不当 | Blacklist `:100`、Memory `:153-155` | 都补了,但**文案没对齐**(F2) |

**没有发现"一个分区修了、另一个同款 bug 原样留着"的情况。**

### 3.3 聚合资源行为
智能体组是 `stack: true`(`sections.ts:47-58`),**五个分区一次性同时挂载**,各自的 mount 请求:

Blacklist `listBlacklist` · Execution `getMaxTurns` · Search `getSearchSettings` + `getFileindexStatus`
· Memory `getMemorySettings` + `listUserMemory` · Observability `getTracingSetting` + `compose.list`
= **8 个请求,零重复调用**。(Channels / McpTokens 在 `stack: false` 的组里,不与它们同时挂载。)

- **无两个分区写同一个后端设置**:我把七个分区 + `settingsStore` 的所有 `service.ai.*` / `service.compose.*` 调用点做了频次统计 —— `putTracingSetting` 出现 4 次全在 Observability 内部,其余写方法各 1 处。
- **`putMemorySettings` 全字段**:`MemorySection.vue:55-61` 的 `payload()` 三字段总是全带,与 Vue2 `:117-121/:128-132/:140-144` **逐字一致**(Vue2 也是三处各发全量)。因此不存在"某分区把另一分区的字段清掉"——它只可能覆盖**自己**的字段,而这个隐患(load 失败后本地默认值被写回后端)Vue2 一模一样,**是 1:1 忠实,不是 P2b 引入**。
- **`putSearchSettings` 是 patch**:`saveParams` 发 5 个检索键、`saveFileindex` 发 3 个索引键,**两组键完全不相交**,与 Vue2 `:192-198/:205-209` 逐字一致 → 两个按钮互不覆盖。
- **定时器 / 订阅收尾**:`savedTimer`(Execution+Search)、`rescanTimer`(Search)全部 `onUnmounted` 清;三个 MessageBus 订阅经 `offs.forEach(off => off())` 全退订;`pollStatus` 三处调用**都有上限**(12×1500 / 40×2000 / 10×1500),不存在无界轮询。
- 已知并接受的代价(D4 已申报):全仓两处独立订阅 `app:install-*`(本分区 + 应用区 `installProgress` store);`useMessageBus` 的模块级 socket 从不 `disconnect` —— **P1 既有,不是 P2b 引入**。

### 3.4 共享助手无重复实现
`apiErrorMessage`(唯一)· `copyText`(复用 `src/files/util/clipboard.ts`,AI 区**没有**第二份
`navigator.clipboard`/`execCommand` 实现,`TerminalCard.vue:102` 是 P1 既有)·
`formatEpochMs`(唯一,`-` 兜底)· `channelsFormat` 三函数 · `memoryLabels` 两函数 · `SkModal` 外壳。
`mcpConnect` / `channelsFormat` 都不碰 i18n,模板串由调用方 `t()` 出来再传入 —— 机制统一。

### 3.5 i18n 聚合(**全量机检,非抽查**)
- 两档各 **1020 键**,键集完全一致,**零重复键**(台账写 1021,差 1,口径问题,无实质)。
- P2b 标记块共 **136 键**(7 个块),**零孤儿**(逐个回 grep,全被引用)。
- **值保真:136/136 全部回 Vue2 生产 `zh_CN.json`/`en_US.json` 逐字符比对,零不一致。**
  - 119 键的 en 值直接命中 Vue2 的键或值,zh 值逐字符相同。
  - 13 键(Observability 12 + `aiCfgMcpInstructionTemplate`)的 en 值在 `en_US.json` 里**查不到** —— 因为 Vue2 用英文字面量当键、`en_US.json` 没收录(英文渲染就回落成键本身),而 `zh_CN.json` **全都有**。我逐条比对这 13 条的 zh 值(含 `mcpAgentInstructionTemplate` 那条带全角「，」「：」和 `\n` 的长模板):**13/13 逐字符命中**。
  - 4 个用双引号写的键(`aiCfgBlacklistDesc`/`aiCfgMemoryDesc`/`aiCfgSearchDesc`/`aiCfgRetrievalBanner`,值里含 `'`)单独复核:4/4 命中。
- **转义陷阱**:`{'@'}` / `{'{'}` / `{'}'}` 反解后与 Vue2 原值一致;`messageSyntax.test.ts` + `parity.test.ts` 均绿。
- **"看起来重复其实不重复"的四个键,已回权威源判定为 1:1 忠实,不是 P2b 造的**:
  - `aiCfgLoadingDots`(加载中**...**)vs `aiCfgLoadingEllipsis`(加载中**…**)—— Vue2 `MemorySection.vue:54` 用 `Loading…`,`McpTokensSection.vue:70` 与 `ChannelsSection.vue:20/88/113` 用 `Loading...`,**Vue2 自己就是两个不同串**。
  - `aiCfgLoadFailed`(加载失败。)vs `aiCfgMemoryLoadFailed`(加载记忆失败。)—— 同理,Vue2 两个不同串。
  - 值撞车的两对 `aiCfgSaved`/`aiCfgMemSourceTool`(都是「已保存」)与 `aiCfgAutoPlaceholder`/`aiCfgMemSourceAuto`(都是「自动」)—— Vue2 的英文键分别是 `Saved`/`Saved`(源标签)与 `auto`/`Auto`,en 值不同(`auto` vs `Auto`),**不能合并**。
- 唯一遗留:`en_us.ts` 注释把 `aiFailed` 写成"已复用"而组件没调用它(台账 Task 7 Minor ②)。我确认 `aiFailed` 在七个分区里 **0 引用**,无重复/无缺键,纯注释笔误。

### 3.6 CSS 类
七个分区 + `SkModal` 模板里的 **134 个静态类**,逐个在 `src/ai/styles/*.scss` + `src/styles/*.css` 里
解析 —— 唯一找不到规则的是 `.set-page-head`,而 **Vue2 里同样没有任何规则**
(`grep -rn set-page-head NimoOS-UI/src --include=*.scss` 零命中),1:1 成立、非回归。
三处从 Vue2 scoped `<style>` 迁进 `settings-styles.scss` 的规则(`.px-msg` / `.mcp-*` / `.chan-*`)
我逐条对 Vue2 原文比对:**值与声明顺序逐字一致**,`.chan-x`/`.mcp-x` 正确地没搬(已被 `.sk-x` 收编),
`var(--danger, #d33)` 的裸色 fallback 已按配色约定摘掉。三处内联 `style=`
(`margin-left:auto` ×2、`width:220px`)与 Vue2 逐字相同。
`settingsStyles.test.ts` 的 `stripComments()` fixture 让新旧断言都不能被注释里的反引号类名假通过
(Task 10 fix round 2 已实证)。

### 3.7 共享包改动(`c8f1919`)
- diff = **`src/ai.ts` 一行类型 + 4 行注释**,`context_window?: number` → `number | null`。这是把类型
  修正成后端真实契约(Vue2 `MemorySection.vue:141` 留空就发 `null`,Vue2 测试也明确断言 `null`)。
- `dist/ai.d.ts:122` 已重新生成、与 `src` 同步(`dist/` 未被 git 跟踪 —— 本仓既有约定,新环境需 `pnpm build`)。
- 全包内 `context_window` 只有这一处类型定义;`src/ai.test.ts:548/637-644` 两条既有用例未受影响(传 number 仍合法)。
- **零调用点洗类型**:全仓 `putMemresettings` 三个调用点都直接传 `number | null`;P2b 的
  `components/settings/**` 与 `util/**` 里 `as unknown as` / `: any` / `@ts-ignore` / `@ts-expect-error` **全部 0 命中**(`systemTiles.ts` 的三处是 P1 既有)。
- **判定:最小正确改动,D5 的"推荐做法"落地无瑕疵。**

---

## 4. 台账「已推迟 / Minor」清单逐条裁定

| # | 台账条目 | 裁定 |
|---|---|---|
| T4-① | `apiError.test.ts` 缺 `response.data={message:''}` 分支 | **can ride** —— 空 message 走的是 `JSON.stringify(data)`,行为已被"对象无 message"那条覆盖大半 |
| T4-② | `8a55456` 单独 checkout 缺 `aiCfgDelete` | **can ride(已自愈)** —— 我核过 HEAD 两档 136 键全在、零缺键;bisect 期瞬态,不改历史 |
| T4-③ | 删除失败该用 `aiCfgDeleteFailed` | **MUST FIX** —— 即 F2,且范围要扩到 MemorySection |
| T5-① | literal `"0"` 无独立用例 | **can ride** —— 我复算过 `Number('0') \|\| 10 === 10`,与空串走同一条兜底,不存在可测的独立行为 |
| T7-① | SearchSection `markSaved()` 自动隐藏未申报 | **MUST FIX(仅申报,零代码)** —— 即 F4;§7 明文「未申报的偏离本身就是缺陷」 |
| T7-② | `en_us.ts` 注释误称复用 `aiFailed` | **can ride** —— 已核 0 引用、无重复无缺键 |
| T7-③ | `.set-page-head` 无 scss 规则 | **非问题,建议销账** —— Vue2 同样没有规则,我独立复核确认 |
| T8-① | 用例 9 删掉 try/catch 仍能过 | **can ride** —— 判别力弱但被测行为(静默 keep-current)本身就是 1:1 |
| T8-② | `pollStatus` 12/40/10 次数与间隔零覆盖 | **can ride** —— 需要重构成假定时器,收益低于风险;`alive` 门已有用例 17/20 覆盖 |
| T8-③ | `.px-msg` 改名属防御性 | **can ride / 销账** —— 改名有注释、无真实撞名 |
| T3-① | SkModal 6 例未覆盖 Esc / 遮罩点击 | **can ride** —— 我读了 reka 接线(`DismissableLayer → onOpenChange → emit`),两个消费方的三路径都汇到同一个 handler,× 按钮那条已覆盖同一代码路径 |
| T3-② | `MemorySection.test.ts` 间歇 RangeError | **MUST FIX** —— 即 F1,根因已定性 |
| T10-① | 守卫不能证明 `color: var(--danger)` 落在 `.mcp-reveal-warn` 块内 | **can ride** —— 值级 1:1 我已人肉逐字节复核 |
| T11-① | `{'@'}`/`{'{'}` 护栏只有注释、无自动化 | **can ride(建议后续独立一期)** —— 我全量机检 136 值反解后与 Vue2 一致,当前不变式成立 |
| T13-① | wiring 文档一条复核命令写错 | **已闭环** —— 文档已就地订正 |
| T13-② | 报告少算 1 例"英文原文当键" | **can ride** —— 我的机检给出准确数:13 条 |
| T13-③ | 跨任务一致性 grep 未列为独立审计项 | **can ride** —— 我复跑:`defineStore` 新增 0 / 裸 `.sk-modal-bg` 0 / `useSettingsStore` 七分区里只有 Blacklist / `theme-exception` 0 |
| P2a-M1 | `ModelsSection` 三处 `@click` 直调无 catch 的 action | **本期范围外** —— P2a 文件,建议独立一期 |
| P2a-M2 | `formatModelSize` 同名双实现 | **本期范围外** —— 两者分别忠实于 Vue2 两处,P2a 文件 |
| P2a-M3 | 全量跑打印 RangeError,来源不明 | **已定性 → 归入 F1** —— 是 P2b `MemorySection.test.ts` 引入的 |
| 全期 | 七个分区跳过 `SettingsPage.vue` 接线 | **按用户指令,非缺陷** —— 交接文档可执行,见第 5 节 |

**必须合流前修(共 3 条,合计 ≤5 行 + 2 段注释)**:F1(T3-②)· F2(T4-③,3 处)· F4(T7-①,仅申报)。
建议顺手带上:F3 的申报补登(或直接照 Vue2 去掉乐观置位)· F5 的注释订正。

## 5. `p2b-deferred-wiring.md` 交接文档评估

**结论:可直接执行,一个新会话照它做能得到能用的设置区,且不会弄坏任何东西 —— 我实测验证过。**

我把文档第 1、2 节逐字执行成探针(7 条 import 插在 `import AgentIcon` 之前、7 行映射表替换、
`skills`/`mcp` 原样保留),然后:`pnpm exec vue-tsc --noEmit` 零输出 ·
`SettingsPage.test.ts` **29/29 绿** · 全量 **285 files / 2290 tests 全绿**。随后 `cp` 还原,
`git status` / `git diff` 均为空。文档核对无误的点:相对路径 `../components/settings/sections/*.vue`
正确 · 默认导出名与文件名一致 · 映射表现状(`SettingsPage.vue:79-93`)与文档引用逐字相符 ·
`placeholderProps()` 的 `!== SectionPlaceholder` 判等确实是动态的、换真组件后自动返回 `{}`
(`SettingsPage.vue:101`)· `DEFERRED_SECTIONS` / `SPLIT_SECTIONS` 确实都是 `['skills','mcp']`
且被 `sections.test.ts` 钉住 · 第 4 节"没有任何断言 literal 检查这 7 个 id 映射到
`SectionPlaceholder`"属实。

**两点该补进文档的缺口**:
1. 文档第 4/6 节把"若红"的排障方向**只指向** `@nimotech/nimoos-service` 的 mock 缺口,漏了
   `ObservabilitySection` 会调**真实**的 `useMessageBus()` —— 那是个模块级 socket.io 单例
   (`src/composables/useMessageBus.ts:25-30`),`ensureSocket()` 会真的 `io({...})` 且**从不
   disconnect**。`SettingsPage.test.ts` 现有 29 例都没让智能体组变成 active section,所以今天
   不会触发(我实测全绿);但任何后续给 `SettingsPage.test.ts` 加"渲染智能体组"用例的人都会
   撞上,文档应该加一句"必要时 `vi.mock('../composables/useMessageBus')`"。
2. 文档建议的收口守卫用例需要把 `SECTION_COMPONENTS` `export` 出来 —— 文档自己点明了这点,
   但没提这会让 `SettingsPage.vue` 的公开 API 面变大;建议改成在 `SettingsPage.test.ts` 里
   挂载后查渲染结果(而不是导出内部常量),判别力相同且不动生产文件的导出面。

文档其余部分(第 3 节 prop 自动收回、第 5 节"明确不动的东西"含 D1/D2/D4 别改回去、
第 6 节三门)都准确且必要。

## 6. RangeError 裁定(单独回答)

**必须在合流前修,但它是 1 行测试改动,不构成功能阻塞。**
根因已由探针定性(F1):不是"间歇泄漏"、不是环境问题,而是 `MemorySection.test.ts:253-257` 的
mock 里 `setValue` 触发的 `change` 事件与被测的 `@change` 处理器构成**同步无界递归**。
它之所以"间歇",只是栈溢出发生时 Node 的 `PromiseRejectCallback` 能不能完成记账;
用例本身**每次都在递归**。留着它的代价不是这一条用例,而是**整个仓库的
unhandled-rejection 告警从此不可信**(RangeError 会打断同批次的 rejection 上报),
以及 vitest 未来把 unhandled error 升格为失败时的即时变红。修了之后
P2a 终审 M3 与 P2b Task 3 的那条悬账可一并销账。
