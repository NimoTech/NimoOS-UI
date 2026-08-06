# SP8-P2b —— 每个任务都适用的公共约束(实现者与评审者都必须读)

本文件是 SP8-P2b 全期的公共约束 + 对账既定事实。**任务 brief 与本文件冲突时,以本文件为准**
(本文件的内容来自 Task 0 对账实测 + 用户拍板,brief 写在对账之前)。

## 1. 工作区与并发(最容易翻车的一条)

- 可写:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(branch `sp8-ai`,主战场)、
  `/home/nimo/NimoTech/.sp8/NimoOS-Service`(branch `sp8-ai`,仅 Task 6 动一行类型)。
- **另一个 Claude 会话正在同一个 worktree 里跑 SP8-P2a,并往同一个分支提交。** 它拥有:
  `src/ai/views/SettingsPage.vue`、`src/ai/views/SettingsPage.test.ts`、
  `src/ai/components/settings/SectionPlaceholder.vue`、`src/router/index.ts`、`src/i18n/*.ts`、
  `src/ai/components/settings/sections/ModelsSection.*`、`ProvidersSection.*`、`PrivacySection.*`、
  `ThinkingDefaultsSection.*`。**一律不许改 / 不许 revert / 不许 stash / 不许提交**;也不许
  `git add` 任何不是你自己创建的路径。HEAD 会在你干活期间前进 —— 直接在上面提交即可,
  **绝对不要 rebase / reset / merge / stash**。
- 禁碰:`/home/nimo/NimoTech/NimoOS-New-UI`(SP6 会话)、`/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7 会话)。
- `/home/nimo/NimoTech/NimoOS-UI`(Vue2 老仓)**只读** —— 读蓝本源码与语言包,永不写。
- **不碰真机**:不跑 `./scripts/deploy.sh`,不写 `/var/lib`。
- `git add -A` / `git add .` **全期禁用**,只许显式列路径;提交后 `git show --stat HEAD` + `git status` 自查。

## 2. 七个分区一律**跳过** `SettingsPage.vue` 接线(用户 2026-07-28 指令)

brief 里「把分区接进 `SECTION_COMPONENTS` 映射表 + 加 import」那一步**整步跳过**,
`src/ai/views/SettingsPage.vue` 连打开都不要打开 —— 那是 P2a 在途文件,它自己还在改同一张映射表。
协调者维护「推迟的接线清单」,等 P2a 收官后统一补。分区组件靠自己的单测直接挂载验证。

## 3. i18n(与 P2a 会话共享的写入点,程序固定)

1. **写之前先双向 grep**:工作区文件 + `git show HEAD:src/i18n/zh_cn.ts`。P2a 会独立创建通用键
   (`aiCfgSave`/`aiCfgSaved`/`aiCfgSaveFailed`/`aiCfgDelete`/`aiCfgDeleteFailed`/`aiCfgEnabled`/
   `aiCfgAdd`/`aiCfgEdit`/`aiCfgDeleted` …)。**同名键定义两次 = 重复属性 TS 错误**,
   已存在(且值相同)就复用,只补真正缺的;报告里列清「复用了哪些 / 新增了哪些」。
2. 新键**同时**加进 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`(`parity.test.ts` 断言键集完全一致),
   值**逐字照抄 brief 的表**(brief 已回查 Vue2 生产语言包),**不许自己翻译**。
3. 追加位置:导出对象**最末尾、闭合 `}` 之前**,用标记行包起来:
   ```
     // >>> SP8-P2b Task N —— <分区名>
     aiCfgXxx: '…',
     // <<< SP8-P2b Task N
   ```
4. **永远不要对 i18n 文件跑 `git add`。** 先 `.superpowers/sdd/p2b-stage-i18n.sh --check` 看将要暂存什么,
   再 `.superpowers/sdd/p2b-stage-i18n.sh` 真正写 index(它把标记块移植到 HEAD 版本,
   这样 P2a 的在途键永远不会被卷进 P2b 的提交)。提交后 `git status` 可能仍显示 i18n 被修改 ——
   **那是对的**,是对方会话的在途工作,不要"顺手清理"。
5. 提交前自查**自洽性**:组件里每一个 `t('…')` 键,要么在 `git show HEAD:src/i18n/{zh_cn,en_us}.ts` 里,
   要么在你自己的标记块里。若某个键只存在于对方会话的**未提交**工作区,不许默默依赖 —— 报告里点名。
6. i18n **值**里的字面 `@` 必须写成 `{'@'}`(vue-i18n 9 当链接语法,`src/i18n/messageSyntax.test.ts` 拦)。
   模板里的字面 `@`(如 `@{{ inst.bot_username }}`)不需要转义。
7. 反直觉键值(不得统一):组名 `aiCfgGroupChannel` 中文「聊天通道」,分区名 `aiCfgChannels` 中文「聊天渠道」。
   `aiFailed` 是「已失败/Failed」,**不是**「加载失败。」,不要复用。
   7 个分区的 h1 全部复用 P2a 既有导航键:`aiCfgFilesystem`/`aiCfgExecutionSteps`/`aiCfgSearch`/
   `aiCfgMemory`/`aiCfgObservability`/`aiCfgMcpTokens`/`aiCfgChannels` —— **不要为 h1 另建键**。

## 4. 分区组件的既定范式(Task 0 对账 + 已评审通过的三个兄弟件)

- 已评审通过、可直接照抄风格的样板:`src/ai/components/settings/sections/BlacklistSection.vue`、
  `ExecutionSection.vue`、`MemorySection.vue`(+ 各自 `.test.ts`)。
- 根节点**就是** `<div class="set-inner">`,内层 `<div class="sk-section">`,**不要再套布局容器**
  (页面壳自己会包 `<section class="set-stack-item" :data-section-id>`)。
- 真实存在的类名:`.sk-section` / `.sk-section-head` / `.sk-section-title` / `.sk-section-hint` /
  `.sk-section-body` / `.sk-btn`(+`.ghost`/`.primary`/`.danger`)/ `.set-h1` / `.set-desc` / `.set-rows` /
  `.set-row`(内 `.lbl`/`.sub`/`.val`/`.val.end`)/ `.set-input`(+`.mono`/`.num`/`.full`)/ `.set-chips` /
  `.set-chip` / `.set-actions` / `.set-copy` / `.set-copybtn` / `.tok-row`;弹窗用 `.sk-modal*` / `.sk-field*`
  (P2b Task 1 已移植)。**`sk-sec-head` / `sk-row` / `sk-chip` 不存在**(plan/brief 写错了)。
  **用到的每一个类都要先 grep `src/ai/styles/settings-styles.scss` / `sk-shared.scss` 确认真实存在** ——
  凭空造的类会渲染成无样式,而单测永远抓不到。目标是**零 `<style>` 块**(三个兄弟件都做到了)。
- import 一律相对路径(本仓无 `@/` 别名先例)。从 `src/ai/components/settings/sections/` 出发:
  ai store → `../../../stores/…`,应用级 store(toast/session)→ `../../../../stores/…`,
  图标 → `../../icons/AgentIcon.vue`,util → `../../../util/…`,弹窗外壳 → `../SkModal.vue`。
- `useI18n()` from `'vue-i18n'`;后端走 `import { service } from '@nimotech/nimoos-service'`。
- toast 真签名:`show(text: string, duration = 1500, tier: 'info' | 'warning' | 'danger' = 'info')`
  (`src/stores/toast.ts:18-27`)—— 默认 duration 是 1500,要 3000 就显式传。
- 开关用 `src/ai/components/settings/SetSwitch.vue`(双 emit `update:modelValue` + `change`);
  输入型确认框用 `src/ai/components/settings/PromptDialog.vue`;后端错误文案统一走
  `apiErrorMessage(e, fallback)`(`src/ai/util/apiError.ts`,P2b Task 4 建),不要各自再写一遍提取链。
- **D2(每个分区在组件头注释里申报一句)**:除 `blacklist` 外,状态一律**组件本地 `ref`**,
  不塞 `settingsStore`/`agentStore`,也不新建 store(用户 2026-07-28 拍板;Vue2 里就在组件 `data`)。
- `service.ai.*` 返回 **body 原样**:不许多剥一层 `.data`,也不许删掉 Vue2 那些
  `res && res.data && …` 的防御性兜底(后端返回形状确实不统一)。
- 测试里的 mock 用 `vi.hoisted()`(裸 `const` 放 `vi.mock` 之前会因 ESM 提升抛 TDZ ReferenceError;
  先例 `src/ai/stores/agentStore.test.ts:4-19`)。测 reka Teleport 组件时,挂载后必须先
  `await nextTick()` 再查 `document`(reka `useMounted()` 门,P2a Task 6 已实证)。

## 5. 共享包真实方法名(对账实测,brief 有几处写错)

- `putMaxTurns(maxTurns: number)`(**不是** `setMaxTurns`)、`getMaxTurns()`
- `listMCPTokens()` / `createMCPToken(data)` / `deleteMCPToken(id)`(**MCP 全大写**)
- Channels 十个:`listChannelInstances` / `createChannelInstance` / `setChannelInstanceEnabled` /
  `deleteChannelInstance` / `listPairableChannelInstances` / `createChannelPairingCode` /
  `listChannelBindings` / `deleteChannelBinding` / `setChannelBindingModel` / `setChannelBindingDownloadDir`
- `getSearchSettings` / `putSearchSettings(patch)` / `getFileindexStatus` / `rescanFileindex`
- `getMemorySettings` / `putMemorySettings(payload)`(三个字段**总是全带**,未传的发 `undefined`,
  只改一个字段要么先读后合并、要么照 Vue2 全量发)/ `listUserMemory` / `deleteUserMemory`
- `getTracingSetting` / `putTracingSetting(payload)` / `getObservabilityCompose()`(只读)
- 容器编排(Phoenix 装/停)走 `service.compose.list()`(返回 `Record<string, ComposeAppWithStoreInfo>`,
  **已剥好信封,直接按 id 取键**)/ `service.compose.install(yaml, opts?)`(包里已带 yaml content-type)/
  `service.compose.setStatus(id, 'start'|'stop'|'restart')`。
- 权威签名源:`/home/nimo/NimoTech/.sp8/NimoOS-Service/dist/ai.d.ts`、`dist/compose.d.ts`。

## 6. 配色(color-guard 硬约束)

- 组件 `<style>` 块里一切可见颜色必须是 `var(--…)` token,**禁 `#hex` / `rgb()` / `rgba()` / 具名色**。
- `src/styles/color-guard.test.ts` **逐行扫且不跳注释行** —— 注释里也不许出现 Vue2 的原始色字面量,
  改用「引 Vue2 `file:line` + 中文描述颜色」。
- **禁止用 `theme-exception` 逃逸**(它的豁免会延续到下一个 `;` 或 `}`,会连带豁免后面真正的声明)。
- 新增 token 必须在浅色块与 `[data-theme="dark"]` 块**都**给值。

## 7. 移植纪律(用户 2026-07-27 拍板)

- **界面 / 视觉 / 交互严格 1:1 照 Vue2。**
- **逻辑 / bug 不照抄**:Vue2 的缺陷、竞态、吞错改成正确逻辑,但必须三件套齐全:
  ① 代码注释注明「Vue2 原文 `file:line` 是什么问题、此处改成什么」② 实现者报告里显式申报
  ③ 台账登记(协调者据报告写)。**未申报的偏离本身就是缺陷。**
- 判据:「这条改动是在修一个**可复现的错误行为**吗?是 → 改并登记;否 → 照 Vue2。」
- 禁止与需求无关的重构 / 改名 / 换库。brief 给的测试代码若与「1:1 照 Vue2」冲突,**是测试错**,
  不是实现让步(P2a Task 7 的教训);brief 给的数据/行号标了「已核」的,评审仍须回权威源复核
  (P2a Task 3 的教训:plan 作者臆测过译文)。

## 8. 测试门(每个任务提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      # 全量,**不许**只跑 src/ai/ 子集(守卫散落在 src/styles/ 与 src/i18n/)
pnpm exec vue-tsc --noEmit
pnpm build                     # 只允许既有第三方包警告 + >500KB chunk 警告
```

已知噪声:①`src/files/upload/persist.test.ts` 是既有 IndexedDB flaky,只它红就复跑一次并在报告里说明。
②总数会因对方会话不断落地而向上漂移。③**对方会话在途文件里的红是他们的**,如实归属、点名说明,
**绝不替他们修**;只有归属于本任务文件的红才算本任务的账。

## 9. 报告契约

完整报告写进 `.superpowers/sdd/p2b-task-N-report.md`,至少包含:逐文件改了什么 ·
Vue2 `file:line` → New-UI 的标记/行为对照 · 承接了 Vue2 哪些测试断言(若有)· RED→GREEN 证据 ·
全量测试终值(含红项归属)· i18n 复用/新增键清单 + 怎么暂存的 + 自洽性自查结果 ·
**每一条偏离显式申报**(含被跳过的 `SettingsPage.vue` 接线)。
返回给协调者的只有:状态(DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED)· 提交 sha ·
一行测试结果 · 顾虑,**≤15 行**。

## 10. 评审者附加要求(评审最低 sonnet,禁 haiku)

- **不许采信实现者报告**:自己打开 Vue2 蓝本逐项对标记/类名/顺序/禁用条件、自己 grep、自己跑测试。
- i18n 值回**Vue2 生产语言包**(`/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json`)
  逐字符复核,含标点与省略号;并确认组件用的每个键在 HEAD 两档语言包里都在、且没有被定义两次。
- 用到的每个 CSS 类自己 grep 确认存在。
- **至少做一次 RED 验证**:最小化破坏生产代码 → 确认对应用例精确报红 → 精确还原(`git status` 必须干净),
  并在评审里写明破坏了什么、已还原。
- 检查用例是否空转(把行为删掉还能过就是空转)、既有用例是否被削弱/删除。
- 检查提交纯净性:只含本任务文件,i18n hunk 只含本任务标记块,对方会话的文件零卷入。
- 不许改仓库(RED 探针除外且必须还原),不许提交任何东西。
- 评审全文写进 `.superpowers/sdd/p2b-task-N-review.md`;返回给协调者 ≤25 行:两个判定 ·
  每条发现一行(带严重度)· RED 探针 + 已还原 · 自己实测的测试数字(红项要归属)。
