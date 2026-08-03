# SP8-P5c —— 公共约束(实现者与评审者都必须先读)

**本文件只写与 `p5b-common-constraints.md` 的差异,P5a / P5b 那两份的每一条都继续生效。**
读法:先读 `p5a-common-constraints.md` 全文 → 再读 `p5b-common-constraints.md` 全文 → 再读本文件;
**同一节里本文件说了什么,就以本文件为准。**

- **权威优先级**:P5a/P5b 治理文件 + 本文件 + 三份附录 **>** 任务 brief **>** 上级设计的 P5c 章节。
  🔴 **本期特例:上级设计 `2026-07-31-…-sp8-p5-knowledge-design.md` §4 把 `AllowlistView.vue` 算在 P5c,
  用户 2026-08-03 已明示移出本期**(见 §2.2)。设计文档在这一点上过期,以本文件为准。
  🔴 **本期没有计划书。** T0 的对手是协调者的 `p5c-task-0-brief.md`,已回权威源核出 **7 处错**(见 §12)。
- 附录(只用路径引用,不要把内容复制进任务 brief):
  - i18n 键表 → `.superpowers/sdd/p5c-appendix-A-i18n.md`(**99** 条新增 + **10** 条复用)
    🔴 **协调者裁定 A-1(2026-08-03,见 `p5c-plan.md`)**:新建 `aiKbDeviceAuto`,不复用 `aiKbOriginAuto`
    → 计数由 98/11 改为 **99/10**(distinct 109 不变)。**附录 A 已就地订正 14 处;本节以下的 99 / 10 / 81 / `exactly 99 keys` 均已同步。**
  - 色值映射表 → `.superpowers/sdd/p5c-appendix-B-tokens.md`(**57 行 / 60 处**)
  - CSS 类白名单 → `.superpowers/sdd/p5c-appendix-D-classes.md`(`WHITELIST_187` → **191**,另建 `parserStyles.test.ts`)
  - 后端实测 fixture → `.superpowers/sdd/p5c-fixtures/`(**14 份**,先读那里的 `README.md`)

---

## 1. 工作区(与 P5b 的差异)

P5b §1 的 5 条继续生效(可写仓只有 `.sp8/NimoOS-New-UI`;`NimoOS-UI` 只读且一律 `git show main:`;
禁碰 `NimoOS-New-UI` 与 `.sp7/NimoOS-New-UI`;禁 `git add -A`/rebase/reset/stash/merge/push;
`.superpowers/sdd/` 要 `git add -f`)。**订正/新增 3 条**:

1. 🔴 **起点 commit 是 `63a0b0d`,不是 brief 写的 `cc6df78`**(E-1)。`cc6df78` 之后又有 3 个
   **纯 markdown** 提交(`b6d1db2` / `e4fa834` / `63a0b0d`,全在 `.superpowers/sdd/` 下)。
   **产品代码坐标仍是 `820d426`** —— `git diff --name-only 820d426..63a0b0d -- src/` 为空。
   三门基线因此不受影响(T0 实测已验证,见 §8)。
2. 🔴 **`.sp8/NimoOS-Service` 本期零改动 —— 已按方法名逐个回源核实(E-0 复核 ✅)。**
   因此**不需要**跨仓 `pnpm build`,**也不需要**消费仓 `pnpm install`。实测行号:

   | 包方法 | 文件:行 | 返回形状 |
   |---|---|---|
   | `service.ai.parserStats` | `ai.ts:591` | `return res.data`(原样 snake_case) |
   | `service.ai.parserState` | `ai.ts:596` | 同上 |
   | `service.ai.parserFolders` | `ai.ts:607` | 同上 |
   | `service.ai.parserJobs` | `ai.ts:612` | 同上 |
   | `service.ai.parserControl` | `ai.ts:617` | 同上 |
   | `service.ai.parserTestAnalyze` | `ai.ts:673` | 同上;**包内已带 `multipart/form-data` 头 + `timeout: 120000`**,注释写明「与 Vue2 `ParserTest.vue:207-219` 逐字对齐」 |
   | `service.notes.getSettings` | `notes.ts:252` | `normalizeSettings(res.data)` → **camelCase** |
   | `service.notes.putSettings` | `notes.ts:257` | 同上 |
   | `service.notes.dirInfo` | `notes.ts:264` | `{ exists: !!…, empty: !!… }` |
   | `service.wiki.getCandidates` | `wiki.ts:154` | `(res.data as …) \|\| []` |
   | `service.folder.getList` | `folder.ts:7` | `unwrap<FolderListing>(res.data)` → **单层** `{ content }` |

3. 蓝本真实路径(`git show main:`,`main`@`7a6ee6b7`,行数 T0 逐个核对 ✅ 全部与 brief 一致):
   `src/views/AI/Knowledge/SettingsView.vue`(**322**)· `src/components/common/FolderBrowser.vue`(**143**)·
   `src/components/common/folderBrowser.js`(**34**)· `src/views/AI/Parser/ParserStatus.vue`(**164**)·
   `src/views/AI/Parser/ParserTest.vue`(**369**)· `src/views/AI/Parser/parser-styles.scss`(**74**)·
   `src/views/AI/Parser/store/parserStore.js`(**65**)· 参考 `src/views/AI/Knowledge/styles/knowledge.scss`(**2561**)·
   参考 `src/views/AI/Knowledge/__tests__/settingsViewRootPicker.spec.js`(**38**)。

**验收 dev server 已在 `:5288`,不另起端口**;每次提交后由协调者 kill 重起。

### 1.1 🔴 全期零改动文件清单(P5b §1.1 全部继续生效,本期再加 1 条)

| 文件 | 口径 |
|---|---|
| `src/ai/knowledge/views/KnowledgeLayout.vue` | **全期零改动**(承 P5b) |
| `src/ai/knowledge/views/DashboardView.vue` | **全期零改动**(60 秒骨架 = N3,D1 拍板不修;交接项 #6 的 fail-fast 注释瑕疵**也不修**) |
| `src/ai/knowledge/components/KIcon.vue` | **全期零改动** —— 本期用到的 11 个 glyph 已逐个核实都在(§1.2),**不许加、不许退回 `AgentIcon`(K4)** |
| `src/ai/knowledge/views/QueueView.vue` · `IndexedFilesView.vue` | **全期零改动**(P5b 产出,本期不碰) |
| `src/ai/knowledge/util/indexedFiles.ts` · `indexedFilesView.ts` · `queueView.ts` · `dashboardHelpers.ts` | **全期零改动** |
| `src/ai/knowledge/stores/knowledgeStore.ts` | **只有 T-settings 那一刀能改**,且只许加 `controlState` 相关的最小改动;**新的 `parserStore.ts` 是独立文件,不许合并进 `knowledgeStore.ts`** |
| `src/ai/styles/agent-styles.scss` · `settings-styles.scss` · `skills-styles.scss` · `sk-shared.scss` · `tokens.scss` | **全期零改动**(只读它们取 token 值与先例) |
| `src/styles/theme.css` | **全期零改动** —— 本期不往全局 `:root` 加 token(理由见 §6.1) |
| `.sp8/NimoOS-Service/**` | **全期零改动**(§1 第 2 条已逐方法实证) |
| `src/ai/knowledge/views/QueueView.test.ts` · `IndexedFilesView.test.ts` | 不碰(只读 `withHost()` 先例) |

需要改上面任何一个 → **停下写 `NEEDS_CONTEXT`**,不要自己动。
**例外**:`src/ai/styles/knowledge.scss` 与 `src/ai/styles/knowledgeStyles.test.ts` **本期必须改**(§6.1 / §6.4),
`src/ai/knowledge/stores/knowledgeStore.parser.test.ts` **本期必须改一行**(交接项 #2,见 §8.2)。

### 1.2 🔴 `KIcon` 本期用到的 glyph 已核实全在(11 个,不许往 `KIcon.vue` 里加)

`KIcon.vue` 的 `PATHS` 共 **42** 个键。本期用到:

```
SettingsView : play  pause  folder  upload  danger  x  arrowRight  check  test  chev   (10)
FolderBrowser: drive  chev  folder                                                     (+1 新面孔 drive)
```

**去重合计 11 个**(`chev` / `folder` 两页共用)——brief C-6 写的「12 个」是按出现次数数的,
**去重是 11**(E-2,不影响结论)。T0 逐个 `grep -cE "^\s+<name>:"` = 1/1 命中 ✅ **11/11 全在**。

🔴 **`ParserStatus.vue` / `ParserTest.vue` 一个 KIcon 都不用** —— 它们用 emoji(`⏳🔄✅❌📦📍▼▶`)与
纯文字按钮(`▶ Resume` / `⏸ Pause` / `×`)。**不许"顺手换成 KIcon"**(界面不 1:1),见 N16。

## 2. 移植纪律(P5a §2 + P5b §2 全部沿用,本期额外 3 条)

- 🔴 **Parser 两页的口径 = 照抄老样子(用户 2026-08-03 两次拍板,最终版)。**
  > **版式 / 间距 / 结构 / 文案 / DOM 顺序 / 按钮位置,全部逐字照蓝本 1:1。
  > 唯一改的是颜色的写法**(仓内 `CLAUDE.md` 禁色字面量是强制约束)。
  > 每个 hex/rgba 换成语义最接近的既有 token,**浅色档肉眼与 Vue2 一致**;
  > 暗色档跟着 token 自然变深 —— **这一条按 K25 显式申报为偏离**(Vue2 只有浅色一套,暗色本无「原样」可抄)。

  🔴 **用户先说过「改按知识库设计语言重做」,随后改回「照抄以前的吧」。任何把 Parser 两页改成
  `.k-*` 设计语言的做法都是回归,按 Critical 报。**
- 🔴 **「顺手把两份 scss 统一一下」一律禁**(承 P5b §2)。C-2 实测:两份里同名类的**声明并不都相同**
  (`.row` / `h3` / `li` / `.hint` 都因父卡片不同而不同),详见附录 B §B.1 与 §6.2 的裁定。
- **brief 标了「已核」的数据,评审仍须回权威源复核** —— 本期已核出 brief **7 处**错(§12)。

## 3. 本期已授权的偏离(K1–K20 沿用 + **K21–K30**)

P5a §3 的 **K1–K8 / P1–P4** 与 P5b §3 的 **K9–K20** 全部继续生效,不再重复。本批新增:

| # | 偏离 | 依据 |
|---|---|---|
| **K21** | 🔴 **Parser 两页新建 `.parser-app` token 作用域**,token 声明**不复制**,改把 `knowledge.scss` 两个 token 声明块的选择器扩成 `.knowledge-app, .parser-app { … }` / `:root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app { … }` | **§6.1 有完整依据链。** 先例 = `tokens.scss:31-32` 的 `.agent-app, .ai-toast-scope { … }`(一份 token 声明供两个作用域,其中 `.ai-toast-scope` 就是个不带布局的纯 token 消费方) |
| **K22** | 🔴 **`.parser-app` 额外带 `height: 100vh; height: 100dvh; overflow-y: auto`**(Vue2 没有这三行) | `src/styles/theme.css:318` 是 `body { overflow: hidden }` → 顶层路由页若不自建滚动容器,超出视口的内容**永远看不到**。先例:`AreaShell.vue` 的 `.area-shell{height:100vh;height:100dvh}` + `.area-body{overflow:auto}`、`knowledge.scss` 的 `.k-scroll{overflow-y:auto}`。**这是修一个可复现的错误行为(内容不可达),按 §2 判据必须改** |
| **K23** | **两个 Parser 页各自一个作用域**:`.parser-app.parser-status-page { … }` 与 `.parser-app.parser-test-page { … }`,**不合并**同名类 | C-2 实测:`.card` / `.page-header` / `.page-header h2` 三条**逐字相同**,但 `.row` / `h3` / `li` / `.hint` 各不相同。合并 = 界面不 1:1。**东西在哪儿就搬到哪儿**(承 P5b §B.0.2) |
| **K24** | **`parser-styles.scss` 落成独立文件 `src/ai/styles/parser-styles.scss`,不并进 `knowledge.scss`** | `knowledgeStyles.test.ts:180-207` 的守卫缺口④ 用**集合相等**把「非 `k*` 前缀类」钉死在 9 项;Parser 两页有 **60+ 个**非 `k*` 裸类,并进去会让那条断言当场炸。另建 `parserStyles.test.ts`(§6.4) |
| **K25** | 🔴 **Parser 两页暗色档与 Vue2 不同**(Vue2 只有一套浅色) | 用户 2026-08-03 口径原文;与 P5b §B.0.3 的取舍同族。评审**不要**按「暗档与蓝本像素不同」报缺陷 |
| **K26** | **`Vue.observable` 的 `parserStore` → Pinia setup store**;`_timer` 句柄移出 state 成模块级 `let` | 同 P1 / P2 模具(第 N 次机械替换) |
| **K27** | **`parserStore` 里 5 处直调 `api.*('/ai/parser/…')` → `service.ai.parser*`**;`FolderBrowser` 的 `folder.getList` → `service.folder.getList`;`SettingsView` 的 `notesApi.*` → `service.notes.*` | P3 既定「REST 一律走包」 |
| **K28** | 🔴 **`FolderBrowser` 单层取数**:蓝本 `FolderBrowser.vue:66` 写 `(r.data && r.data.data && r.data.data.content) \|\| []`(**三层**),本仓写 `(await service.folder.getList(path)).content \|\| []`(**单层**) | **K1 同族第 N 次。** `folder.ts:7-10` 已 `unwrap()`;`FolderEntry` 实测字段 = `{ name, path, is_dir }`(`Service/src/types.ts:26-30`),与 `folderBrowser.js:5-7` 的 `e.is_dir` / `e.name` 逐字对上 |
| **K29** | **迁移确认弹窗转 reka 原语 + `DialogPortal` `to` 指向 `.knowledge-app`** | K7 同族。蓝本 `SettingsView.vue:121-156` 是裸 `.k-modal-bg` + `@click="closeMigrate"` + `@click.stop`。SettingsView 在 `.knowledge-app` 下,宿主天然存在;**写测试要自己在 body 备宿主**(先例 `QueueView.test.ts:127-130` 的 `withHost()`) |
| **K30** | **HTTP 失败不回显后端 body**:`applyRoot` 的 catch 里蓝本读 `e.response.data.detail` 拼进 toast(`SettingsView.vue:278-279`),本仓只弹 `aiKbOpFailed` | **K5 命中点。** 承 P5a T7 / P5b K19 同一模具。🔴 **落地判据**:400 分支的 DOM/toast **必须不包含**后端 detail 文本,要写**排除式**断言 |

| **K31** | 🔴 **协调者裁定(2026-08-03,T2b 顾虑① 触发)**:`.parser-app` 改成**外层包裹元素**,页面根类留在**内层元素**上 → 选择器由复合 `.parser-app.parser-status-page` 改成后代 `.parser-app .parser-status-page`(测试页同)。两页模板变成 `<div class="parser-app"><div class="parser-status-page">…</div></div>`,**比蓝本多一层 DOM** | **K22 的二阶后果修正。** T2b 把作用域根与页面根做成同一元素,而该元素同时是 `max-width:900px; margin:0 auto` → `overflow-y:auto` 让**滚动条落在 900px 居中列的右缘(宽屏上约在屏幕中间)**,而 Vue2 是整页滚动、滚动条在视口最右缘 → **这一条本身就是「界面不 1:1」**,必须修。🔴 **K22 引的两个先例本来就是两元素**:`AreaShell.vue` 的 `.area-shell`(100vh)+ `.area-body`(overflow:auto)· `knowledge.scss` 的 `.knowledge-app` 外壳 + `.k-scroll` 内滚动器。**多这一层 DOM 用户不可见,滚动条位置用户可见** —— 取后者。连带:`parserStyles.test.ts` 的断言 (b) 允许的第 0 列选择器改成 `.parser-app` / `.parser-app .parser-status-page` / `.parser-app .parser-test-page`,断言 (d) 的两作用域判据同步改;`.parser-app` 仍**只带 K22 那三行结构属性 + 零颜色 + 零 `--x:`** |

| **K32** | **模板里写 `props.roots` 而非裸 `roots`**(`FolderBrowser.vue`) | T3 报告 §8.5 已申报,渲染等价(Vue 3 `<script setup>` 两种写法都合法);T3 评审 M-2 判「留着」。**协调者追认编号,不要求改回** |

| **K33** | 🔴 **协调者预先授权(2026-08-03)**:`parserStore.loadAll()` **加 store 实例局部 epoch 过期守卫**(inline,**不抽公共 guard**) | **K15 同族第 2 次**(P5b 那次是用户 E3 授权给 `knowledgeStore` 三个 loader)。蓝本 `loadAll` 有 **8 个并发入口**:`mounted()` · 5 秒轮询(`ParserStatus.vue:129-131`)· 刷新按钮 `reload()`(`:137`)· 5 个控制动作各自 `await this.loadAll()`(`parserStore.js:48-64`)。两个并发在飞时:① 先发后至会用**更旧的**数据覆盖新数据;② 更要紧的是 **`finally` 里 `loading = false` 会被先完成的那个提前清掉**,而 `loading` 直接驱动刷新按钮的 `:disabled`(`ParserStatus.vue:7`)→ **按钮提前解禁,用户可见**。按 §2 判据这是「修一个可复现的错误行为」。🔴 **范围严格限定**:只加守卫,`Promise.all` 四发 / catch 置 `unreachable` / `|| []` 兜底(N7)/ 五个动作「先 control 再 loadAll」全部照抄不动 |

**除 K1–K33 之外的任何偏离都要先申报再做**;拿不准写 `NEEDS_CONTEXT` 并停下。

## 3.5 明确「照抄、不改」的条目(N1–N14 沿用 + **N15–N22**)

P5a §3.5 的 N1–N8 与 P5b §3.5 的 N9–N14 全部继续生效。本批新增:

- **N15** **`.k-progress-card` / `-row` / `-label` / `-nums` / `-bar` / `-fill`(蓝本 `knowledge.scss:1152-1157`,
  夹在 Settings 段正中间)—— 本期两页都不用,New-UI 也没有 → 不搬。**
  T0 已逐行核准:6 个类恰好在 `:1152`–`:1157` 六行上,头注释在 `:1151`。
  **不搬 ≠ 忘搬**:附录 D 的「没有搬多」断言要能守住这 6 个类不出现。
- **N16** **Parser 两页的 emoji / 特殊符号是文案的一部分,位置不许挪。**
  `⏸ Paused` / `✅ Running` 在 `$t()` **里面**(`SettingsView.vue:11`);
  `🧪 {{ $t('Test sandbox') }}` / `⏳ {{ $t('Pending') }}` / `🔄` / `✅` / `❌` / `📦` / `📍` /
  `▼` / `▶` / `← {{ $t('Back to details') }}` / `✓` / `⚠ Reranker error:` / `×` 在 `$t()` **外面**;
  `▶ ` / `⏸ ` 由 script 里的字符串拼接产生(`ParserStatus.vue:27` `('▶ ' + $t('Resume'))`)。
  `📝` / `🧪` / `⚠️` 在 SettingsView 模板里(`:67` / `:162` / `:171`)。**逐字照抄,一个都不许挪进/挪出 `$t()`。**
- **N17** **`ParserStatus.vue:38` 的数组下标取 i18n**:`[$t('Power-saving'), $t('Balanced'), $t('Full power')][[1,2,4].indexOf(n)]`
  —— **照抄这个写法**(它是三个字面量 `$t()`,不是动态 key,附录 A 已全部收录)。
  改写成 `computed` 映射表 = 与需求无关的顺手改动,禁。
- **N18** **`ParserTest.vue:115` 的 `result.scored.indexOf(s) + 1`** 当排名序号 —— O(n²) 且依赖对象同一性。
  蓝本如此,**照抄**(本机 `scored` 最多 20 条,不是可复现的错误行为)。
- **N19** **`ParserStatus.vue:96` 的 `v-show="failedOpen" v-if="store.state.failedJobs.length"` 同时挂在一个 `<ul>` 上**
  —— Vue 里 `v-if` 优先级高于 `v-show`,`failedJobs` 为空时整个 `<ul>` 不渲染,`v-show` 是死的。
  **照抄两个指令**(改成单一指令会改变 DOM 结构)。连带见 §13 的高危可点性清单。
- **N20** **`ParserStatus.vue` 的 5 秒轮询 + `document.hidden` 守卫**(`:129-131`)与
  **`beforeDestroy` 清定时器**(`:133-135`,Vue3 里是 `onBeforeUnmount`)—— 频率、守卫、清理时机照抄。
- **N21** **Vue2 语言包自身的错译 / 同值撞车,本期新增 4 组,一律照抄不许「顺手改对」**(同 P5a N8 / P5b ⚠️N 模具):
  1. `Resume` → **恢复**,与既有 `aiKbRebuild`(`Rebuild` → **恢复**,P5b ⚠️N #55 已登记的错译)**zh 值撞车**。
     两个键都要存在,zh 都是「恢复」。**Vue2 把 `Rebuild` 译成「恢复」才是错的,`Resume`→「恢复」是对的**;不许统一。
  2. `Test Sandbox`(SettingsView `:162`)与 `Test sandbox`(ParserStatus `:6`)—— **只差首字母大小写,zh 都是「测试沙盒」**。
     两个独立键(`aiKbSetSandboxTitle` / `aiKbPrTestLink`),渲染的 en 不同、zh 相同。同 P5b #91/#92 模具。
  3. `Power-saving` → **省电** 与既有 `aiKbCcPowerSaver`(`Power saver` → **省电**)zh 撞车;
     `Full power` → **全力** 与既有 `aiKbCcFullSpeed`(`Full speed` → **全力**)zh 撞车。
     **en 不同 → 不能复用既有键**(复用会让英文档渲染成 `Power saver` / `Full speed`,与 Vue2 不同 = 界面不 1:1)。
  4. `aiKbPrOcrHint` zh = **慢 5-10x,只对真实索引的扫描件有用** —— 英文原串是
     `5–10× slower, only useful for truly scanned documents`(truly **scanned**),
     中文译成「真实**索引**的扫描件」是语义错;且英文用 `–`(U+2013)/`×`(U+00D7)、中文用 ASCII `-`/`x`。**照抄。**
- **N22** **`ParserTest.vue` 的三处硬编码非 i18n 文案照抄**:`rerank top-20`(`:66`)、
  `⚠ Reranker error: {{ result.rerank_error }}`(`:110`)、`dense [0:8]:` / `sparse top:`(`:140` / `:144`)、
  `chunk #{{ … }}`(`:119` / `:135`)、`cos {{ … }}` / `rr {{ … }}`(`:116` / `:118`)、
  `target_tokens` / `overlap_tokens` / `min_tokens` 三个 `<label>`(`:41` / `:45` / `:49`)、
  `chunker=…, target=…, overlap=…, min=…`(`:84-87`)、`{{ c.token_count }} tokens · offset …`(`:136`)。
  🔴 **这些是技术标识符/参数名,Vue2 刻意没进 i18n。不许"顺手补 i18n 键"**(会多出 Vue2 没有的键,
  且 en/zh 两档一填英文 = 纯噪音)。**唯一例外见 K16 模具:本期不新开这类例外。**

## 4. 数据契约(**2026-08-03 实测**)

P5a §4 的三分来源表继续生效。**K1 单层取数继续生效。**
🔴 **所有 mock 一律取 `.superpowers/sdd/p5c-fixtures/` 里的真响应体,禁手编**
(记忆 `newui-fixture-from-imagination-trap`)。**「同一方法在两个测试文件里被 mock 成不同形状」= red flag。**

### 4.1 🔴 mock 的层次(本期最容易翻车的一点)

| 你要 mock 的 | 形状 | 依据 |
|---|---|---|
| `service.ai.parserStats/parserState/parserFolders/parserJobs/parserControl/parserTestAnalyze` | **HTTP 原样 snake_case** = fixture 原文,一字不改 | `ai.ts:591-680` 六个方法都只 `return res.data`,零转换 |
| `service.notes.getSettings` / `putSettings` | 🔴 **camelCase `{ notesRoot, autoExtract }`,只有这两个字段** | `notes.ts:252-262` 走 `normalizeSettings`(`notes.ts:131-137`)。**HTTP 层是 `notes_root`/`auto_extract`,且还多带 `distill_roots`/`distill_daily_cap`/`background_model` 三个字段 —— `normalizeSettings` 把它们全丢掉了**。mock 写成 snake_case 或多带字段都是错的 |
| `service.notes.dirInfo` | `{ exists: boolean, empty: boolean }`(包内 `!!` 归一) | `notes.ts:264-267` |
| `service.folder.getList` | 🔴 **`unwrap()` 后的单层 `{ content: FolderEntry[] }`**,`FolderEntry = { name, path, is_dir }` | `folder.ts:7-10` + `types.ts:26-33`。**不是** fixture 里那个三层信封 |
| `service.wiki.getCandidates` | 已归一化数组(空时 `[]`) | `wiki.ts:154-156` |

⚠️ **`normalizeSettings` 的 `autoExtract: r.auto_extract !== false`** —— `undefined` 归一成 `true`。
蓝本 `data()` 的默认值也是 `autoExtract: true`(`SettingsView.vue:206`)。一致,照抄。

### 4.2 `POST /v1/parser/test/analyze` 的真实形状(T0 首次实测,4 种响应全部落盘)

**成功(200)** —— fixture `parser-test-analyze-md-ok.json` / `-txt-rerank.json`:
```
{ mime, filename, size, text_length, chunk_count,
  chunks: [{ chunk_no, text, token_count, offset_start, offset_end,
             dense_preview: number[8], sparse_top_terms: [{ token_id, weight }] }],
  params_used: { target_tokens, overlap_tokens, min_tokens, chunker },
  query?, scored?: [{ chunk_no, cos_sim }], rerank_error?, docling_markdown? }
```
🔴 **四条实测出来的、与蓝本模板直接相关的事实(必须进验收清单当预期行为,不是缺陷)**:
1. **`.md` / `.txt` 不产生 `docling_markdown`** → 蓝本 `:98` 的 `v-if="result.docling_markdown"` 整卡不渲染。
   要看到 docling 卡只能传 `.pdf/.docx/.pptx/.xlsx` —— 🔴 **brief 明令别传 PDF(会触发 ~200MB 模型下载)**。
2. **`scored[]` 里没有 `rerank_score`** → 蓝本 `:117-118` 的 `rr {…}` 一直不渲染。
3. 🔴 **本机 reranker 是坏的**:`rerank=true` 实测返回
   `"rerank_error": "XLMRobertaTokenizer has no attribute prepare_for_model"`。
   → 「rerank top-20」勾选后能看到的**只有 `⚠ Reranker error:` 警告条**,永远看不到 `rr` 分数。
   **这是后端缺陷,记后端票,本期不修、不绕。**(好处:`rerank_error` 分支**真机可验**。)
4. **`params_used.overlap_tokens` 会被后端改写**:`.md` 走 `chunker: "markdown"` → 无论传什么 overlap
   都回 **0**;`.txt` 走 `chunker: "plain"` → overlap 原样回。**正好对上蓝本 `:56` 那句 `<em>` 提示。**

**失败** —— 四份 `.http` fixture:

| 情形 | 状态 | 体 | 蓝本怎么显示 |
|---|---|---|---|
| `target_tokens=1`(越界) | **400** | `{"detail":"target_tokens must be in [50, 4000]"}` | `.error-box` 显示这句字符串 |
| `.bin`(不支持的扩展名) | **400** | `{"detail":"extension '.bin' not supported in test sandbox; use .md / source code / .txt / …"}` | 同上 |
| 不传 file | **422** | 🔴 `{"detail":[{"type":"missing","loc":["body","file"],"msg":"Field required","input":null}]}` —— **`detail` 是数组** | 见下 N/K 说明 |
| 空文件 | **200** | `{…,"chunk_count":0,"chunks":[],"params_used":{…}}`,**无 `query`/`scored`** | 走 `:129` 的 `.empty` 空态 → **真机可验** |

🔴 **422 那条的 `detail` 是数组**,蓝本 `:222-223` 的 `this.error = detail` 会把数组塞进 `{{ error }}`。
**但这个分支 UI 到不了**(`:76` 的 `:disabled="!file || loading"` 挡住了没选文件的情况)。
→ **登记成 N 系列级别的「不可达分支」:照抄蓝本的 `detail || e.message || String(e)` 取值链,不许为它加数组分支处理**
(那会是凭空多出的逻辑)。**同时不许为它写单测**(测一条 UI 到不了的路径 = 空转)。

### 4.3 本机数据现状(**实测于 2026-08-03 13:22**,数字会漂,取数命令见 fixture README)

| 事实 | 影响 |
|---|---|
| `control/state` = `{paused:true, concurrency:2, device:"auto", ocr_enabled:false, resolved_device:"cpu"}` | 🔴 **设备当前是暂停态** → 设置页服务卡显示 `⏸ Paused` + 橙灯(`[data-state="paused"]`)、按钮是 `primary` 档的「恢复」;ParserStatus 显示 `⏸ Paused` + `▶ 恢复`。**「运行中/绿灯」那一档要点一次「恢复」才能看到(会真的恢复索引,点完记得点回暂停)** |
| `device: "auto"` + `resolved_device: "cpu"` | 设置页 `deviceLabel` 渲染 `自动(当前 CPU)`;ParserStatus 的 `.resolved-hint` 渲染 `→ actual CPU` |
| `ocr_enabled: false` | `.k-sw[data-on="false"]` 灰档 + `.warn` 提示行**可见**(`v-if="!notesSettings.autoExtract"` 是另一条,见下) |
| `stats` = `pending 339 / running 1 / failed 0 / done 9` · `indexed_files 7` · `total_vectors_text 5592` · `models[2]` | ParserStatus 队列卡 6 格全可验;**`❌ Failed` 恒 0** |
| `jobs?status=failed&limit=5` = `{"jobs":[]}` | 🔴 **失败卡展开后列表整个不渲染**(N19)。见 §13 高危项 |
| `folders/pending?limit=20` = 20 项,`total_groups: 119` | `total_groups` 字段**确实存在** ✅;标题渲染「待处理文件夹(top 20 / 共 119 组)」;路径全是 `/DATA/.system_data/…` 超长 → **可验省略号**;走 `v-else` 列表分支,`v-if="!folders.length"` 空态验不到 |
| `notes/settings` = `{notes_root:"/DATA/Notes", auto_extract:true, distill_roots:[], distill_daily_cap:50, background_model:""}` | `autoExtract: true` → 自动捕获开关是**绿档**,`.warn`「已停用」提示行**不渲染** |
| `notes/dir-info?path=/DATA/Notes` = `{exists:true, empty:false}` | 选 `/DATA/Notes` 只能「仅指向」→ **「搬文件到新目录…」按钮是灰的**。见 §13 |
| `wiki/candidates` = `[]`(HTTP 200,秒回) | `pickerRoots([])` 走兜底三根:`System (/DATA)` / `/media` / `/mnt` ✅ **真机可验** |
| `GET /v1/folder?path=/DATA` 走网关 **无需 JWT**(localhost 免验),18 项 | FolderBrowser 真机可用;`is_dir` 过滤后可见 12 个目录、`.snapshots`/`.system_data`/`.wiki.md` 被 `startsWith('.')` 滤掉 |
| Wiki `/roots` 仍打死(D1) | **本期零 Wiki 验收项**;`DashboardView` 60 秒骨架照旧(N3) |

## 5. 代码范式(P5a §5 + P5b §5 全部沿用,补本期落点)

### 5.1 落点(**本文件定死,覆盖 brief 的建议**)

```
src/ai/knowledge/
  views/       SettingsView.vue                  ← rail 第 9 项
  components/  FolderBrowser.vue
  parser/      ParserStatus.vue · ParserTest.vue ← 上级设计 §5.1 的 src/ai/knowledge/parser/
  stores/      parserStore.ts
  util/        folderBrowser.ts
src/ai/styles/
  parser-styles.scss        ← K24,独立文件
  parserStyles.test.ts      ← K24,新建
```

相对路径表:

| 从 | 到 | 写法 |
|---|---|---|
| `views/SettingsView.vue` | FolderBrowser | `import FolderBrowser from '../components/FolderBrowser.vue'` |
| `views/SettingsView.vue` | 图标 | `import KIcon from '../components/KIcon.vue'` |
| `views/SettingsView.vue` | store | `import { useKnowledgeStore } from '../stores/knowledgeStore'` |
| `views/SettingsView.vue` | util | `import { pickerRoots } from '../util/folderBrowser'` |
| `components/FolderBrowser.vue` | 图标 / util | `./KIcon.vue` / `../util/folderBrowser` |
| `parser/*.vue` | store | `import { useParserStore } from '../stores/parserStore'` |
| `parser/*.vue` | 样式 | `import '../../styles/parser-styles.scss'`(JS 侧 import,**零 `<style>` 块**;先例 `KnowledgeLayout.vue:43`、`AgentPage.vue:72`、`SettingsPage.vue:70`) |
| 任何位置 | service 包 | `import { service } from '@nimotech/nimoos-service'` |
| 任何位置 | 全局 toast | `import { useToast } from '../../../stores/toast'`(层数按实际目录数) |

- `<script setup lang="ts">`;`useI18n()` from `'vue-i18n'`;**import 一律相对路径**(本仓无 `@/` 别名先例)。
- 页面级瞬态(`failedOpen` / `doclingOpen` / `dragActive` / `file` / `params` / `rootPicker` / `dirProbe` /
  `migrating` / `migrateAck`)一律组件本地 `ref`,不塞 store。
- **`parserStore` 与 `knowledgeStore` 是两个独立 store。** 蓝本也是两份
  (`store/parserStore.js` 与 `store/knowledgeStore.js`),**不许合并**。
  ⚠️ 两者都持有 `controlState`,**这是 Vue2 现状,照抄两份**(N 系列口径:不是可复现的错误行为)。
- 🔴 **`parserStore.loadAll()` 必须加 epoch 过期守卫**(承 K15,「New-UI 异步过期守卫」纪律**第 7 次命中**):
  5 秒轮询 + 手动 `reload()` + 五个 `setXxx()` 各自 `await this.loadAll()` → 并发极易先发后至。
  inline 写,不抽公共 guard。**这一条按 K15 已授权,不另开编号。**

### 5.2 `FolderBrowser` 的 `_seq` 竞态守卫

蓝本 `FolderBrowser.vue:50/61/65/68/72` 已有 `_seq` 守卫,`created()` 里 `this._seq = 0`。
**照抄这套语义**(Vue3 里写成模块外的组件本地 `let seq = 0`),**不许换成 K15 的 epoch 写法** ——
它已经是正确的过期守卫,换写法 = 无关重构。
🔴 **但 `reset()` 里 `this._seq++`(`:50`)在 `created()` 之前被调用会得到 `NaN`** —— 实际调用点是
`SettingsView.vue:238` 的 `$nextTick` 里,`created` 早已跑过,**不可达**。照抄,不修,不测。

## 6. 配色(P5a §6 + P5b §6 全部沿用)

一切可见颜色必须是 `var(--…)`;**禁 `#hex` / `rgb()` / `rgba()` / 具名色**(`white`/`black` 也算);
`transparent` 是关键字不算(本期 4 处:`knowledge.scss` 段 2 处 + `FolderBrowser` 2 处,照抄)。
禁 `theme-exception` 逃逸。注释里也不许出现色字面量(R5)。

### 6.1 🔴 **C-3 裁定 —— Parser 两页的作用域与 token 收口(本期最大的架构决定)**

**结论:走 brief 的 (b) 路,但用「共享选择器」实现,零 token 复制。**

```scss
/* src/ai/styles/knowledge.scss —— 只改这两行选择器,块内一个字都不动 */
.knowledge-app, .parser-app {                                     /* 原 .knowledge-app {  (:97) */
:root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app {   /* 原 :203 */
```
```scss
/* src/ai/styles/parser-styles.scss —— K22/K23/K24 */
.parser-app { height: 100vh; height: 100dvh; overflow-y: auto; }  /* K22,Vue2 没有 */
.parser-app.parser-status-page { padding: 16px; max-width: 900px; margin: 0 auto; /* …蓝本 :1-5 */ }
.parser-app.parser-test-page   { padding: 16px; max-width: 900px; margin: 0 auto; /* …蓝本 :246-250 */ }
```
```html
<!-- ParserStatus.vue --><div class="parser-app parser-status-page">
<!-- ParserTest.vue   --><div class="parser-app parser-test-page">
```

**为什么 (a)「页面根同时挂 `.knowledge-app`」被否决 —— 硬证据:**

`src/ai/styles/knowledge.scss` 里 `.knowledge-app` 有 **3 个**裸块(T0 用括号配平算出边界):

| 块 | 范围 | 内容 |
|---|---|---|
| `:97-200` | 纯 token 声明 + `color-scheme: dark` | **零布局属性** |
| `:290-1344` | 🔴 **外壳** | `display: grid; grid-template-columns: 232px 1fr; grid-template-rows: minmax(0,1fr); height: 100vh; width: 100vw; overflow: hidden;` + 全部 `.k-*` 嵌套规则 |
| `:1440-1607` | 仪表盘 `k2-*` 段 | 只有嵌套规则 |

(另有 `:203-285` 的 `:root[data-theme="light"] .knowledge-app` 浅档 token 块。)

→ **token 与外壳共用同一个选择器,拿不到「只要 token 不要外壳」。**
挂 `.knowledge-app` 会把 Parser 页变成 **100vh × 100vw、两列(232px + 1fr)、`overflow: hidden`** 的栅格 ——
内容被塞进 232px 的第一列并被裁掉。而 `.parser-status-page { padding/max-width/margin }` **改不掉这五条**
(属性不同名,不是级联问题)。**(a) 出局。**

**为什么 `SettingsPage` 的「挂 `.agent-app` 借 token」先例不能照搬:**

`SettingsPage.vue:383` 确实是 `<div class="agent-app set-app">`,`settings-styles.scss:5-10` 头注释也写明
「token 由 `.agent-app` 提供」。但 T0 实测两条否决理由:
1. `agent-styles.scss:8` 的 `.agent-app { … }` **同样带外壳**
   (`display: grid; grid-template-columns: 260px 1fr 360px; height: 100vh; width: 100vw; overflow: hidden`)。
   `SettingsPage` 之所以没事,是因为 `.set-app`(`settings-styles.scss:17-28`)**自己也是个满屏外壳**,
   把那五条逐条覆写了。**Parser 两页是普通文档流页面(`padding:16px; max-width:900px; margin:0 auto`),
   不是外壳** → 借 `.agent-app` 就得再逐条 reset 五个属性,是纯 hack。
2. 🔴 **`.agent-app .card` 串号**:`agent-styles.scss:529-535` 有
   `.agent-app .card { background; border; border-radius; overflow: hidden; box-shadow: var(--shadow-xs) }`。
   Parser 两页 `.card` 用了 **9 次**。`.agent-app .card`(0,2,0) 与 `.parser-status-page .card`(0,2,0) **同权**,
   而 `overflow` / `box-shadow` 我这边根本不声明 → **无论源序怎样都会漏进来**,阴影是肉眼可见的 1:1 破口。
   (T0 把 Parser 两页 + FolderBrowser + SettingsView 的**全部** 80 个类名/元素名逐个对
   `agent-styles.scss` / `settings-styles.scss` / `skills-styles.scss` / `sk-shared.scss` / `theme.css` 扫过,
   落在 `.agent-app` 下的只有这一处;`settings-styles.scss:126` 的 `.set-actions .hint` 与
   `skills-styles.scss:365` 的 `.sk-meta-cell .val .dot` 都需要额外祖先,不会命中。详见附录 D §D.5。)

**为什么不走「全局 `theme.css` 的 `:root` token」这条第四条路:**

`theme.css` 的 `:root`(`:18-174`)/ `:root[data-theme="light"]`(`:175-302`)**没有 `--danger`、
没有 `--warning`、没有 `--text-primary/secondary/tertiary/quaternary`、没有 `--line*`、
没有 `--bg-elevated`**;`--card-bg` 是一层玻璃渐变、`--success` 是薄荷绿 `#5fe3b0`。
Parser 两页需要的正是 danger / warning / 三级灰 / 平面白卡 —— 走全局就得往 `theme.css` 新造 danger/warning,
那是**改全站主题基座**,远超本期范围(§1.1 已把 `theme.css` 列为全期零改动)。

**为什么共享选择器优于「复制一份 token 声明」:**

- 先例是现成的:`tokens.scss:31-32` = `.agent-app, .ai-toast-scope { … }` —— **一份 token 声明供两个作用域,
  其中 `.ai-toast-scope` 就是个不带任何外壳的纯 token 消费方**,与 `.parser-app` 的定位一字不差。
- 零复制 = 零漂移。复制一份要抄 ~18 个 token × 2 档,是第三份副本(tokens.scss / knowledge.scss / parser-styles.scss),
  治理文件历来把「双份维护」当风险点。
- `color-scheme` 免费到手:两个 token 块**已经**分别声明了 `color-scheme: dark` / `light`
  → **P2b 教训自动满足**,`.parser-app` 不需要也**不许**自己再声明一次(重复声明 = `knowledgeStyles.test.ts:312` 那条断言的语义被稀释)。
- 档位机制免费到手:`.knowledge-app` 是「暗档为基础块 + `:root[data-theme="light"]` 覆写」,跟随 `<html data-theme>`。
  → **`.parser-app` 不需要绑 `:data-theme`**(不像 `.agent-app` 要自己维护容器态)。

**落地约束(硬规则):**

1. `.parser-app` **只许**出现 K22 那三行结构属性,**一个颜色属性都不许有**、**一个 `--x:` 声明都不许有**。
2. 两个 Parser 页各自的作用域根写成 `.parser-app.parser-status-page` / `.parser-app.parser-test-page`
   (连写,同一元素)。**页内所有规则嵌进对应根**(K9 同族),`parser-styles.scss` 里**零顶层裸选择器**。
3. `knowledge.scss` 里**只改那两行选择器**,块内容一个字节都不动。选择器**写在一行**
   (`.knowledge-app, .parser-app {`),否则 `knowledgeStyles.test.ts` 的行首锚定 helper 直接失效(§6.4)。
4. `SettingsView.vue` 与 `FolderBrowser.vue` 在 `.knowledge-app` 下(rail 第 9 项 / 它的子组件),
   **不挂 `.parser-app`**;它们的 scss 段照旧进 `knowledge.scss`。

### 6.2 附录 B 是权威 —— 三处来源 + 一处「不是来源」

| 来源 | 行数 | 含字面量行 / 处数 | 去哪 |
|---|---|---|---|
| `parser-styles.scss`(蓝本 74 行) | 74 | **12 / 12** | `src/ai/styles/parser-styles.scss` 的 `.parser-app.parser-status-page` 段 |
| `ParserTest.vue:245-369` 的内联 `<style lang="scss" scoped>`(**125 行**) | 125 | **31 / 33** | 同文件的 `.parser-app.parser-test-page` 段 |
| `FolderBrowser.vue:82-143` 的 `<style scoped>` | 62 | **5 / 5** | `knowledge.scss` 的 `.fb-*` 段(嵌进 `.knowledge-app`) |
| `knowledge.scss` 本期要搬的 10 段(共 187 行) | 187 | **9 / 10** | `knowledge.scss` 原位 |
| **模板 `style=` / `:style=` / `color=`** | — | **0 / 0**(T0 已把 4 个蓝本模板逐行复扫) | — |
| **合计** | | 🔴 **57 行 / 60 处** | |

**模板内联那一栏必须显式记「0」**:P5b 的 E-11 就是漏了这一类。本期 T0 实测
`SettingsView.vue` 的 `style="border-top: 1px dashed var(--line)"`、`color="var(--warning)"`、
`style="color: var(--danger)"`、`style="color: var(--text-tertiary)"`、
`:color="… ? 'var(--danger)' : 'var(--success)'"` **全部已经是 `var()`,零字面量**;
`ParserStatus` / `ParserTest` / `FolderBrowser` 模板里 `style=` 全是布局/尺寸。

🔴 **C-2 裁定(重名类的合并问题)**:T0 把两份 scss 全展开成「完整选择器路径 → 声明列表」逐条 diff:

- **完整路径相同的只有 3 条,且声明逐字相同**:`.card` · `.page-header` · `.page-header h2`。
- **其余同名类的完整路径都不同、声明也不同**:
  `.row`(`.control-card .row` gap 16px + padding 6px 0 **vs** `.upload-card .row` gap 12px + margin 8px 0)·
  `h3`(`.folders-card h3` **多一条 `font-weight: 500`**)· `li`(`.failures-card … li` padding 6px + `#e1e4e8` 虚线
  **vs** `.scored-card … li` padding 8px + `#eee` 虚线)·
  `.hint`(**同一个文件里就有两份不同的**:`.upload-card .dropzone .hint` 有 `margin-left: 8px` / font 12px,
  `.chunks-card .chunk-head .hint` font 11px)· `.empty` / `.toggle`(声明相同但父卡片不同)。
- → **按 K23 两页各自作用域,那 3 条逐字相同的规则各写一份。** 合并成一份共享段 = 界面不 1:1 的入口。

### 6.3 新 token(**4 个,全部有仓内逐字同值的出处,零「凭空造」**)

声明位置:`knowledge.scss` 的两个 token 块(K21 扩选择器后仍是那两个块)。

| token | 暗档值 | 浅档值 | 用在 | 值的出处(T0 逐行核过,逐字相同) |
|---|---|---|---|---|
| `--switch-thumb` | `#ffffff` | `#ffffff` | 蓝本 `knowledge.scss:1217` `.k-sw::after { background: white }` | `src/ai/styles/tokens.scss:201`(浅)/ `:345`(暗) —— 注释原文就写着「Vue2 source `skills-styles.scss:235-249` 的 `background: white` + `box-shadow: 0 2px 4px rgba(0,0,0,0.18)` 圆形拨钮」,**和 `.k-sw` 是同一个 iOS 开关拨钮**,theme-invariant |
| `--switch-thumb-shadow` | `0 2px 4px rgba(0, 0, 0, 0.18)` | 同左 | 蓝本 `:1218` | `tokens.scss:202` / `:346` —— **与蓝本 `0 2px 4px rgba(0,0,0,0.18)` 逐字同值** |
| `--gloss-inset-dot` | `inset 0 0 0 0.5px rgba(255, 255, 255, 0.2)` | 同左 | 蓝本 `:1292` `.k-sandbox-icon` 的 inset 高光 | `tokens.scss:162` / `:321` —— **与蓝本逐字同值**(注释解释了它为什么与 `--gloss-inset` 的 0.18 分开:保 Vue2 的确切 0.2) |
| `--grad-sandbox` | `linear-gradient(135deg, #5AC8FA, #007AFF)` | 同左 | 蓝本 `:1287` `.k-sandbox-icon` 底色 | `tokens.scss:236` 的 `--grad-sk-blue` **与蓝本逐字同值**(`linear-gradient(135deg, #5AC8FA, #007AFF)`)。**改名不改值**:`-sk-` 前缀是技能区专用命名,知识库区借它的名字会误导;值有出处,不是新造 |

🔴 **C-7 的 ⚠️ 已解答:`.k-sandbox-icon` 的渐变有仓内逐字同值先例(`tokens.scss:236`),不需要
`NEEDS_CONTEXT`、不需要发明 `color-mix` 比例。** 但 `--grad-sandbox` 是**新名字**,T0 已 grep 全仓零重名。
- **这 4 个都是 theme-invariant(两档同值)**,与 `.knowledge-app` 里既有的 `--purple`/`--pink`/`--teal`
  (「两档同值,tokens.scss 暗色块未重定义」)同族。🔴 **浅档必须显式写一份**(不许留空靠继承 ——
  `knowledge.scss` 头注释 `:69-75` 已论证过「靠继承」不成立),但要进
  `knowledgeStyles.test.ts:475` 那条「例外清单恰好 11 个」里吗?**不进** —— 它们两档都声明了,
  集合式断言天然通过,例外清单 **保持 11 项不变**。
- **除这 4 个之外不许新造 token。** 附录 B 覆盖全部 60 处,**表里没有的一律 `NEEDS_CONTEXT`**。

### 6.4 `knowledgeStyles.test.ts` / 新建 `parserStyles.test.ts`(**本期必须动的 5 处**)

1. 🔴 **`DARK_TOKEN_SELECTOR`(`:245`)与 `LIGHT_TOKEN_SELECTOR`(`:246`)必须跟着 K21 改**:
   `'.knowledge-app {'` → `'.knowledge-app, .parser-app {'`;
   `':root[data-theme="light"] .knowledge-app {'` → `':root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app {'`。
   `declBlockRange`(`:229-238`)用的是 `new RegExp('^' + escaped + '$', 'm')` **行首行尾锚定** →
   **选择器必须写在一行**,否则整条断言 `expect(m).not.toBeNull()` 直接红。
   🔴 **改完必须做 RED 探针**:把 scss 里的选择器改回单个 `.knowledge-app {` → 常量对不上 → 精确报红 → 还原。
2. 🔴 **`nonKClassNames`(`:196-199`)会把 `parser-app` 扫出来**(它排除的是 `^k(2|n)?-` 与
   硬编码的 `'knowledge-app'`)。→ 在那行的排除条件里加 `&& c !== 'parser-app'`,
   **并在 `:203` 那条「登记表恰好等于文件里真实存在的非 k* 类」的集合相等断言上做 RED 探针**
   (`NON_K_HELPER_CLASSES` 保持 9 项不变;若改成往登记表里塞 `'parser-app'` 也可以,
   但那会让 9 → 10、语义变味 —— **裁定:走排除条件,与 `knowledge-app` 同款处理**)。
3. **白名单 `WHITELIST_187` → `WHITELIST_226`**(**+39**,准确增量与常量改名见附录 D §D.0)。常量名跟着数字改是本档既定习惯。
   🔴 **T2a 订正(2026-08-03,已落地 `4212163`)**:本条初稿写的 `WHITELIST_191`(+4)**是错的** ——
   那只数了 K17 四个 `.k-modal-*`,漏了设置页整段 / `.k-section` 四类 / `kn-*` 段 / `.fb-*` 段。
   **附录 D §D.0 的 226 才是权威。** 连带 `NON_K_HELPER_CLASSES` **9 → 10**(只加 `warn`,
   `.k-set-row-desc .warn` 是本期真新增的非 `k*` 类);**`parser-app` 仍走排除条件不进登记表** ——
   §6.4-2 的「保持 9 项」指的是「不许塞 `parser-app`」,**不是「禁止任何新增」**。
4. 🔴 **「没有搬多」的扫描正则(`:160`)本期要扩**:现在是 `/\.k(?:2|n)?-[a-z0-9-]+/g`,
   扫不到本期要搬进 `knowledge.scss` 的 **`.fb-*`** 段 → 要扩。
   🔴 **实际落地版见 §6.4.1 第 1 条** —— 这里给的字面版 `/\.(?:k(?:2|n)?|fb)-[a-z0-9-]+/g` **漏了裸 `.fb`**,不要照抄。
   **扩正则 = 扫描范围变大,不是放宽断言**;必配 RED 探针(临时塞一条 `.fb-foo { }` → 报红 → 还原)。
5. 🔴 **新建 `src/ai/styles/parserStyles.test.ts`**(K24)—— `parser-styles.scss` 不受
   `color-guard.test.ts`(不扫 `.scss`)也不受 `knowledgeStyles.test.ts`(只读 `knowledge.scss`)约束,
   **裸奔**。最低要有 4 条:
   (a) 全文零色字面量(正则同 `color-guard` 的口径 + `white`/`black` 具名色);
   (b) 零顶层裸选择器 —— 文件里每一条规则都嵌在 `.parser-app` / **`.parser-app .parser-status-page`** /
       **`.parser-app .parser-test-page`** 之下(判据:第 0 列开头的选择器只许是这三个)。
       🔴 **K31 已把复合选择器改成后代选择器**(`.parser-app.parser-x` → `.parser-app .parser-x`),以本条为准;
   (c) `.parser-app` 块里零颜色属性、零 `--x:` 声明(堵 §6.1 落地约束 1);
   (d) 两个页面作用域各自存在、且 `.card` / `.page-header` 在**两个**作用域下各有一份(堵 K23)。
   🔴 **读源文件一律 `node:fs`,不许用 Vite 的 `?raw`**(vitest 的 CSSEnablerPlugin 会把样式源换成空串
   → 断言对空字符串「假通过」;先例见 `knowledgeStyles.test.ts` 头注释 ③)。
   每条都要 RED 探针。

## 7. i18n

- **新键前缀 `aiKb*`(全部,不另开第三个前缀家族)**,内部按页分三个可 grep 的词干:
  **`aiKbSet*`**(设置页)· **`aiKbPr*`**(ParserStatus)· **`aiKbPt*`**(ParserTest)· **`aiKbFb*`**(FolderBrowser)·
  两页共用的通用词走无词干的 `aiKb*`(如 `aiKbPause` / `aiKbResume` / `aiKbConcurrencyLevel` / `aiKbInferenceDevice`)。
  理由:`/ai/parser` 两条路由在 `knowledgeRoutes.ts` 里、由知识库设置页唯一入口进入,是知识库区的一部分;
  再开 `aiPs*`/`aiPt*` 前缀会让同一区出现三套家族。
- 🔴 **零重名**(重复属性 = TS 错误):T0 已核 98 个新键与现有 196 个 `aiKb*` 键零重名;
  **A-1 追加 `aiKbDeviceAuto` 后共 99 个,T1 与其评审各复核一次,仍零重名**(评审实测 `aiKb*` 295 个 / 全表 1502 键零重复)。
  现有 `aiKb*` 实测 **196** 个(`en_us.ts` / `zh_cn.ts` 各 196)= P5a 96 + P5b 100 ✅,brief 的「96+100」对。
- **zh 值一律以 `git show main:src/assets/lang/zh_CN.json` 为权威,逐字照抄,不许自己翻译、不许改标点。**
  🔴 **T0 实测:109 个串在语言包里 100% 命中,本期零「Vue2 无源、需要自造」的键。**
  (这一点与 P5b 的 E-1 教训方向一致:凭英文原串猜中文必错。)
- 值表见 `.superpowers/sdd/p5c-appendix-A-i18n.md`(**99 条新增 + 10 条复用**,含 A-1 的 `aiKbDeviceAuto`)。
  10 条复用**已逐条核过 New-UI 现值 == Vue2 语言包值(zh 与 en 都相同)** → 复用安全,**不要重写**。
- 🔴 **必须跑程序化逐码点比对脚本**(P5a T8 教训:附录零差异,手抄进 TS 时引入 5 处全角标点错)。
  照 `.superpowers/sdd/p5b-task-1-i18n-verify.mjs` 写 `p5c-task-1-i18n-verify.mjs`:
  读 `git show main:src/assets/lang/zh_CN.json` 与新写的 `zh_cn.ts`,对 **99 条**逐 `codePointAt` 比对,
  DoD 是 **99/99 MATCH**;另对 10 条复用键做「现值未被改动」的比对(**10/10 MATCH**)。
  ✅ **T1 已交付 `p5c-task-1-i18n-verify.mjs` 并达标(99/99 + 10/10),评审独立复跑确认。**
- 新键**同时**加进 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`(`parity.test.ts` 自动断言键集一致)。
- `messageSyntax.test.ts` 的守卫**只圈本批 99 键**,🔴 **不许全量生效**:
  - (a) 全角标点扫描 `/[，；：？！（）]/`,**例外清单 = 附录 A §A.5 实扫出的 18 条**,
    一律写成 `toBe` 钉死确切值的**强断言**,不是「跳过扫描」的松形式。其余 81 条必须扫不出全角标点。
    ⚠️ `。`(U+3002)、`「」`、`·`(U+00B7)、`—`(U+2014)、`–`(U+2013)、`…`(U+2026)、`×`(U+00D7)
    **都不在**那个正则里,不要按「看着像全角」判。
  - (b) 带占位符的键 = 附录 A §A.6 的 **9 条**,两档占位符名称集合一致(T0 已核**零差异**)。
  - (c) 补一条「exactly **99** keys」防漂移(照 P3b/P5a/P5b 同款)。**T1 已落地为 99,不许改回 98。**
- **本期零死键**(P5b 那两条死键的成因是 K18 砍掉了调用点;本期 K30 只是不拼接后端 detail,
  `aiKbOpFailed` 与 `aiKbSwitchFailed` 两个键都仍有调用点)。报告里要显式写「死键 0 条」。
- 报告里列清「复用 10 / 新增 99 / 其中 Vue2 有权威 zh 值 99 / 本期新造 0 / 死键 0」。

## 8. 测试门(每个任务提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5c-tN-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5c-tN-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5c-tN-build.log 2>&1; echo "exit=$?"
```

- **全量,不许只跑 `src/ai/` 子集**;**输出完整落盘,不许 `| tail`**(P2b 教训)。
  报告里贴 `Test Files` / `Tests` 两行 + 任何红项的**完整用例名**。
- 🔴 **起点基线(协调者与 T0 各实测一次,逐字一致)**:`sp8-ai`@`63a0b0d` =
  **`Test Files 319 passed (319)` / `Tests 3153 passed (3153)`**,`vue-tsc` exit 0,`vite build` exit 0。
  T0 那一轮是**干净单轮**(零红、零复跑)。
- 已知噪声(只它们红就复跑一次并说明,不要顺手改):
  `src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget`(IndexedDB flaky)·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- **本期 Service 仓零改动** → **不需要** `cd ../NimoOS-Service && pnpm build`,**也不需要** `pnpm install`。
- scss 任务额外:`pnpm exec sass --no-source-map src/ai/styles/parser-styles.scss /dev/null` exit 0
  与 `… src/ai/styles/knowledge.scss /dev/null` exit 0。
- scss 任务额外:`pnpm build` 后 `grep -o "parser-status-page" dist/assets/*.css` 命中
  (证明真进了构建管线 —— 承 P5b T6 的同款要求;`parser-styles.scss` 是**新文件**,
  必须有生产 `.vue` import 它,否则编译不出任何 CSS)。

### 8.1 🔴 下游算术(收官应是几文件几例)

- `color-guard.test.ts` 按 `**/*.vue` 动态生成用例 → **每新增一个 `.vue` 全量 +1 例**。
  当前 `.vue` 总数实测 **175**。本批新增 **4 个 `.vue`**:`SettingsView.vue` · `FolderBrowser.vue` ·
  `ParserStatus.vue` · `ParserTest.vue` → color-guard **+4 例**,`.vue` 总数 → 179。
- 新增测试文件(每个 +1 文件):`SettingsView.test.ts` · `FolderBrowser.test.ts` · `folderBrowser.test.ts`(util)·
  `parserStore.test.ts` · `ParserStatus.test.ts` · `ParserTest.test.ts` · `parserStyles.test.ts`
  → **+7 文件**(具体切刀由计划书定,总数以此为准)。
- **起点 319 文件 / 3153 例 → 收官 326 文件 / (3153 + 4 + 新用例数) 例。**
  🔴 **协调者写计划书时按这个算术给每刀的 DoD 数字;实现者以协调者给的实测基线为准,不要用预测数。**

### 8.2 交接项归属(P5b 交下来的 8 条,本文件逐条派活)

| # | 事 | 本期归属 |
|---|---|---|
| 1 | **K17 四个 `.k-modal-*` 类**(蓝本 `:1317-1334`)本期搬 + 同步扩白名单 | **归 scss 那一刀**。T0 复核:New-UI `knowledge.scss` 里这 4 个类真选择器 **0 处**(只有 `:811-813` 的注释提到)→ 交接项 #2 的「未搬」结论 ✅ 成立 |
| 2 | 🔴 **`knowledgeStore.parser.test.ts:85` 的 `parserDeleteJob` mock 从 `{}` 改 `''`** | **归 `parserStore` 那一刀**(它是本期唯一会碰 parser 相关 store 测试的任务)。权威依据 = P5b 治理 §4.1(axios 1.18.1 对 204 空体给 `''`)。改完在报告里显式申报「P5b 授权外、由 P5c 治理文件派活」 |
| 3 | `DialogPortal to=".knowledge-app"` 只认第一个同名宿主 | **归设置页那一刀**(K29)。写弹窗测试自己在 body 备宿主,先例 `QueueView.test.ts:127-130` 的 `withHost()` |
| 4 | 模板零裸色守卫的脆弱锚定 | **归设置页那一刀**,见 §9 缺口③′ |
| 5 | **DM9** `indexedFilesView.test.ts:128-139` 用例名过度声明 | 🔴 **明确挂账,本期不修** —— `indexedFilesView.ts` 与它的测试都在 §1.1 全期零改动清单里,为一个用例名去碰 P5b 的收官产物不值。转 P5d |
| 6 | `DashboardView.vue` 的【N3】fail-fast 注释论证不成立 | 🔴 **不修**(D1 拍板)。`DashboardView.vue` / `KnowledgeLayout.vue` / `KIcon.vue` 全期零改动 |
| 7 | `loadRoots(opts?: {silent?})` 只有后台预取传 `silent` | 本期不涉及 `loadRoots` |
| 8 | **后端票**:`parserClearFailedJobs` / `parserDeleteJob` 的 404/409 仍是源码推定 | 🔴 **本期不依赖这两个形状**(两个 Parser 页与设置页都不调它们)→ 登记「不依赖」,**不为它编 fixture** |

**本期新开的后端票(2 条)**:
- 🔴 **Parser reranker 在本机是坏的**:`POST /v1/parser/test/analyze` 带 `rerank=true` 恒返
  `rerank_error: "XLMRobertaTokenizer has no attribute prepare_for_model"`(T0 2026-08-03 实测)。
  → 「rerank top-20」这个功能对用户不可用。**本期照抄前端、不绕,记票。**
- **`POST /v1/parser/test/analyze` 缺 file 时返 422 且 `detail` 是数组**(不是其它端点那种字符串),
  前端取值链会把数组塞进模板。UI 到不了这个分支,但契约不一致值得记一票。

## 9. 测试质量(P5a §9 + P5b §9 全部沿用,本期额外 3 条)

- 🔴 **属性态断言一律直接比字符串值,两侧都比**(P5b 那条继续生效)。本期属性态清单见附录 D §D.3,
  其中 `data-on` 在蓝本里**套了 `String()`**(`SettingsView.vue:31/45/46/47/59/115`、`FolderBrowser.vue:5` 的
  `:data-last="String(...)"`)—— **逐处照抄蓝本**(P5b E-9 已裁定:套不套渲染一致,改写 = 无关重构)。
- 🔴 **「点某个东西」的用例必须先确认该元素在本机/mock 数据下真渲染成可点元素**(P5b B18 教训,见 §13)。
- 🔴 **新增(T2b 实证,2026-08-03):做 RED 探针时,「往文件里注入破坏的那段脚本」本身也必须行首锚定。**
  T2b 第一版探针用 `s.replace('.parser-app .parser-status-page {', …, 1)` 改 scss,
  **命中的是头注释里那一处、真选择器没被改到** → 测试照样全绿 → 差点把「探针假失效」读成「守卫抓不到」。
  🔴 **危害比断言自身撞注释更大**:断言撞注释是「假 GREEN」,注入撞注释是**伪造出一个「守卫无效」的假结论**,
  会导致下游去「加强」一条本来就好的守卫,或反过来放弃一条本来有效的守卫。
  → **纪律:探针必须「先断言注入真的落盘」再看测试结果**(diff / md5 / grep 真选择器三者任一),
  注入脚本与断言两侧**都**用 `^选择器 {$` 行首行尾锚定 + 先 `stripComments`。
  这是 P5a 那六次「在文件里找某段文本」同族事故的**第七次**,也是第一次发生在**写**侧而不是**读**侧。
- 🔴 **新增(T2b 实证,同族第八次):报行号的断言不许用「删除式」剥注释。**
  `stripComments()` 把多行注释整段删掉 → **换行也被吃掉** → 报出来的行号偏移几十行,
  把评审/下游引到**错误的行**去查(本文件 49 行头注释就足以造成这种偏移)。
  → **纪律:凡断言消息里要报行号的守卫,剥注释必须用「保行版」**
  (`blankComments()`:把注释内容换成等量空格、**保留所有换行**),
  并**用 `grep -n` 的行号做一次交叉验证**(T2b 的探针 G 实测 `L76` 与 `grep -n` 逐字一致)。
  ⚠️ 现有 `knowledgeStyles.test.ts` 的断言都不报行号,**暂无影响**;但新写守卫一律照本条。
- 🔴 **守卫缺口清单(本期从 4 条变 6 条,各有指定堵法)**:

  | # | 缺口 | 谁堵 | 怎么堵 |
  |---|---|---|---|
  | ① | 「没有搬多」正则扫不到 `.fb-` 前缀 | scss 那一刀 | 扩成 `/\.(?:k(?:2\|n)?\|fb)-[a-z0-9-]+/g` + RED 探针(§6.4-4) |
  | ② | `color-guard.test.ts` **不扫 `.scss`** | 无法修 | `knowledgeStyles.test.ts` + **新建 `parserStyles.test.ts`**(§6.4-5)+ 评审逐行人肉色扫 |
  | ③ | `color-guard.test.ts:44-56` 的 `styleLines()` 对 `.vue` 只取 `<style>` 块 → 模板 `style=` 属性零扫描 | 4 个新 `.vue` 各一刀 | 每个新 `.vue` 补一条「`<template>` 块零裸色」定向断言 |
  | ③′ | 🔴 **交接项 #4:上面那条断言现有写法靠「`</template>` 在第 0 列」这个隐式锚定**,`QueueView.vue` / `IndexedFilesView.vue` 各有 7/12 个嵌套 `<template>` | 设置页那一刀**统一改掉,别再复制** | 改成**贪婪匹配到最后一个第 0 列 `</template>`**(`/^<template>\n([\s\S]*)\n<\/template>/m` 取最后一个,或直接 `src.lastIndexOf('\n</template>')`)+ **覆盖度自检**:断言抽出的片段**包含模板最后一行的一个特征串**(证明没被第一个嵌套 `</template>` 提前截断)。🔴 必配 RED 探针:在模板**最后一行**塞一个裸色 → 必须报红 |
  | ④ | `knowledgeStyles.test.ts` 的非 `k*` 类登记表是**集合相等** | scss 那一刀 | 加 `parser-app` 排除条件(§6.4-2),`NON_K_HELPER_CLASSES` 保持 9 项 + RED 探针 |
  | ⑤ | 🔴 **新增**:`parser-styles.scss` 完全没有守卫 | scss 那一刀 | 新建 `parserStyles.test.ts` 四条断言(§6.4-5) |

## 10. 报告契约(实现者)

完整报告写进 `.superpowers/sdd/p5c-task-N-report.md`(**`git add -f`**),至少包含:
逐文件改了什么 · Vue2 `file:line` → New-UI 的对照 · 承接了 Vue2 哪些行为 ·
RED→GREEN 证据(含 RED 探针的两段输出与还原确认,`git status` 必须干净)·
三门完整终值(含红项完整用例名与归属)· i18n 复用/新增键清单 ·
**§3 的 K1–K30 里本任务命中的每一条显式申报** ·
**§3.5 的 N1–N22 里本任务命中的,要说明确实照抄了** ·
**用了哪几个 fixture 文件、mock 形状取自哪一层**(§4.1 的五行表,snake_case 还是 camelCase)。

返回给协调者的只有 **≤15 行**:状态 · 提交 sha · 一行测试结果 · 顾虑。

## 11. 评审者附加要求(P5a §11 + P5b §11 全部沿用,本期额外 5 条)

1. 🔴 **scss 那一刀的评审必须逐行色扫两个文件**(`knowledge.scss` 新增段 + `parser-styles.scss` 全文),
   并**自做 RED 探针**(至少:规则段落塞字面量 → 报红;`.parser-app` 里塞一个颜色属性 → 报红;
   把 `knowledge.scss` 的 token 选择器改回单个 `.knowledge-app` → `DARK_TOKEN_SELECTOR` 精确报红)。
2. 🔴 **专查 §3.5 的 N15–N22 有没有被「顺手修正」**,改了按 Critical 报。本期最容易被误修的:
   **N16**(把 emoji 挪进/挪出 `$t()`、或换成 KIcon)· **N17**(数组下标取 i18n 改成 computed 表)·
   **N19**(`v-show` + `v-if` 合并成一个)· **N21**(把撞车的 zh 值「统一」或复用 `aiKbCcPowerSaver`)·
   **N22**(给技术标识符补 i18n 键)。
3. 🔴 **K25 是有意的**(Parser 两页暗档与 Vue2 不同,Vue2 只有浅色一套)。别误报成回归;
   但要核「**浅色档肉眼与 Vue2 一致**」这半句是否真做到 —— 逐处对附录 B 的映射表看语义,
   并核「版式 / 间距 / 结构 / 文案 / DOM 顺序 / 按钮位置逐字照抄」这半句。
4. 🔴 **核 mock 形状的层次**(§4.1 五行表)。`service.notes.getSettings` 用 camelCase 且**只有两个字段**,
   `service.ai.parser*` 用 fixture 原文 snake_case,`service.folder.getList` 用**单层** `{content}`。
   搞反了按 Critical 报。
5. 🔴 **`.parser-app` 的三条约束逐条核**(§6.1 落地约束):只有 K22 那三行结构属性 · 两页各自作用域 ·
   `knowledge.scss` 只改了那两行选择器(用 `git diff` 逐行看,块内容一个字节都不许动)。

---

## 12. brief 勘误(T0 回权威源核出,**下游一律以本节为准**)

brief = `.superpowers/sdd/p5c-task-0-brief.md`。
**结构性结论:brief 的行号引用几乎全对**(§2.1 的 7 个文件行数 7/7 全对;C-4 的 11 个包方法行号 11/11 全对;
C-7 的 34 个 `knowledge.scss` 行号 34/34 全对;C-9 的 3 个路由行号 3/3 全对;C-10 的 7 个端点 7/7 全对)。
**错的集中在「范围边界」「计数」与「一处架构判断的前提」上。共 7 条。**

| # | brief 原文 | 权威源实际(T0 实测) | 处置 |
|---|---|---|---|
| **E-1** | §1「起点:New-UI `sp8-ai`@`cc6df78`(工作树干净)」 | HEAD 实测是 **`63a0b0d`**;`cc6df78` 之后还有 `b6d1db2` / `e4fa834` / `63a0b0d` 三个提交 | 三个都是 `.superpowers/sdd/` 下的**纯 markdown**(`git diff --name-only cc6df78..63a0b0d -- src/` 为空),三门基线不受影响。**起点写 `63a0b0d`,产品代码坐标仍是 `820d426`**(§1) |
| **E-2** | C-6「复核一遍 **12 个** 全在」 | 去重后是 **11 个**(`chev` / `folder` 被 SettingsView 与 FolderBrowser 共用,被数了两次) | 结论不变(11/11 全在),计数改 11(§1.2)。**顺带补一条 brief 没提的**:`ParserStatus`/`ParserTest` **零 KIcon**,不许顺手换(N16) |
| **E-3** | §2.2「蓝本 scss `:969-988` 那段…`.k-section-body`(`:985+`)是 Allowlist 专用」 | 头注释在 **`:969`**;要搬的 4 个类是 **`:970-984`**;`.k-section-body` 是 **`:985-991`**(闭合 `}` 在 `:991`,不是 `:988`)。`:988` 落在 `.k-section-body` 块中间 | 正确范围:**搬 `:969-984`(注释 + 4 类),不搬 `:985-991`。** 按 brief 那个边界复制会**截断** `.k-section-body`,吐出半条规则 → sass 编译报错。附录 D §D.1 |
| **E-4** | C-3「协调者实测它(`.knowledge-app`)在 `knowledge.scss:97` / `:290` / `:1440` 有三个块」+ 把 (a)(b) 摆成两条待选路 | 三个行号 ✅ 全对(New-UI `src/ai/styles/knowledge.scss`)。但 brief 把 (a) 当成「白拿整个 token 层」的**可选项**,而 `:290` 那个块正是**满屏外壳**(`display:grid; grid-template-columns:232px 1fr; height:100vh; width:100vw; overflow:hidden`)——**token 与外壳共用同一选择器,(a) 从一开始就不成立** | (a) **出局**,不是「要核一下有没有副作用」而是「有决定性副作用」。裁定见 §6.1。**连带否决**「照 `SettingsPage` 挂 `.agent-app`」这条 brief 没提但看着最像的路(`agent-styles.scss:8` 同样带外壳,且 `.agent-app .card` 串号) |
| **E-5** | §4「蓝本里 `$t()` 传**非字面量**的地方,抽取脚本扫不到…协调者已看到至少这些」,列了 4 处 | 那 4 处**全都是字面量参数**的 `$t()`,只是位置特殊(数组字面量里 / script 的 computed 里 / 当函数实参)。T0 用 `\$t\(\s*['"]` 全文件扫描(不限模板)**全部命中**。**本期真正的 `$t(非字面量)` = 0 处** | 结论:**本期零 K20 风险**。但 brief 的实操要求(这 4 处要进附录 A)**已满足** —— 关键是扫描要**扫整个文件而不是只扫 `<template>`**,否则 script 里那 3 处会漏。附录 A §A.4 |
| **E-6** | §2.2「`.k-progress-card` / `-row` / `-label` / `-nums` / `-bar` / `-fill`(蓝本**约** `:1152-1157`)」 | **精确就是 `:1152`–`:1157` 六行**,一行一个类,头注释在 `:1151` | 「约」可以去掉。登记成 **N15**(§3.5) |
| **E-7** | C-7 的 ⚠️「`.k-sandbox-icon` 那条渐变…P5a 有没有同族先例?有 → 照先例;没有 → 写 `NEEDS_CONTEXT`」 | **有,而且是逐字同值**:`src/ai/styles/tokens.scss:236` 的 `--grad-sk-blue` = `linear-gradient(135deg, #5AC8FA, #007AFF)`,与蓝本 `:1287` **一个字节都不差**。同时另外 3 处也各有逐字同值先例:`--switch-thumb`(`tokens.scss:201`/`:345`)· `--switch-thumb-shadow`(`:202`/`:346`)· `--gloss-inset-dot`(`:162`/`:321`),**而且 `--switch-thumb*` 的注释原文说的就是同一个 iOS 开关拨钮** | **不需要 `NEEDS_CONTEXT`,不需要发明 `color-mix` 比例。** 4 个新 token 全部有出处,见 §6.3。唯一自主决定:`--grad-sk-blue` **改名**成 `--grad-sandbox`(值不动)—— `-sk-` 是技能区命名 |

### 12.1 附带订正(不是 brief 的错,一并登记)

- **C-7 漏了 3 个选择器**(不影响结论,但按 brief 那份清单搬会漏东西):
  `.k-set-row-title` 在 **`:1167` 与 `:1252` 两处**(后者是 `.k-set-danger .k-set-row-title { color: var(--danger) }`,
  危险区标题变红全靠它);`.kn-picked` 在 **`:2251` 与 `:2252` 两处**(后者是 `.kn-picked code`);
  `kn-*` 段的头注释在 **`:2250`**(`/* ---- settings: picker actions + migrate modal ---- */`),
  段的完整范围是 **`:2250-2263`**。
- **C-1 的第二半已实测**:`--border` / `--bg-tertiary` 在 Vue2 `src/` 下**零声明**
  (唯一的 `--border:` 声明在 `public/guide/google-drive.html:9`,是独立静态页,作用域无关)
  → `FolderBrowser.vue:85/95/96` 真实渲染的是回退值 `rgba(127,127,127,0.25)` / `0.18` / `0.06`。
  而 `--text-primary` / `--text-secondary` / `--text-tertiary` / `--danger` **在 Vue2 有声明**
  (`knowledge.scss:18-31` 的 `.knowledge-app` 块 + `Agent/tokens.scss`),FolderBrowser 只在
  `.knowledge-app` 下被用到 → 那几个 `var()` 真的解析成 knowledge 的值。**两类要分开对待**,见附录 B §B.3。
- **`--ns-color-*` 全仓零声明已复核 ✅**:`git grep -- "--ns-color-" main` 只命中
  `src/views/AI/Parser/ParserTest.vue`(10 次)与 `src/views/AI/Parser/parser-styles.scss`(9 次),
  **零处 `--ns-color-x:` 声明** → 19 个 `var(--ns-color-*, fallback)` **全部渲染回退值**。附录 B 按回退值建映射。
- **C-2 的块范围已复核 ✅**:`ParserTest.vue` 的 `<template>` `:1-152` · `<script>` `:154-243` ·
  `<style lang="scss" scoped>` `:245-369`(**125 行**),且**不 `@import './parser-styles.scss'`**
  (只有 `ParserStatus.vue:162-164` 那个 `<style>` 块 `@import`)。本期 scss 实际 **74 + 125 = 199 行** ✅。
- **C-5 的字段名已实测,不是推定**:`GET /v1/folder?path=/DATA` 每项字段是
  `name / size / is_dir / is_symlink / modified / sign / thumb / type / path / date / extensions`;
  包里 `FolderEntry = { name: string; path: string; is_dir: boolean }`(`Service/src/types.ts:26-30`)
  → `folderBrowser.js:5-7` 的 `e.is_dir` / `e.name` / `e.path` **逐字对上,零改动移植**。
- **C-10 的数字已漂**(设备后台索引一直在跑):`indexed_files` 8 → **7**、`pending` 339、`total_groups` **119**。
  按 §13 第 2 条,验收清单写「实测于 2026-08-03,数字会漂,以下列命令现测为准」并附命令,**别钉死数字**。

### 6.4.1 🔴 T2a 落地时的两条订正(2026-08-03,`4212163`,**下游以此为准**)

1. **缺口① 的正则** —— §6.4-4 给的字面版 `/\.(?:k(?:2|n)?|fb)-[a-z0-9-]+/g` **漏了裸 `.fb`**
   (它要求 `fb` 后面必须跟 `-`,而 `.fb` 是 `FolderBrowser.vue` 根元素的真实类名,见 `knowledge.scss:1647`
   与蓝本 `FolderBrowser.vue:2` 的 `class="fb"`,且 `fb` 是附录 D §D.1 的 39 个类之一)。
   漏了它会**同时躲过本条扫描、又掉进缺口④ 报错**。
   → **实际落地版 = `/\.(?:k(?:2|n)?-[a-z0-9-]+|fb(?:-[a-z0-9-]+)?)/g`**,T2a 已程序化证明是字面版的
   **严格超集**(`gov ⊆ mine`,零断言放宽)。**评审不要拿字面版来对,以本条为准。**
2. **附录 B 取舍②(浅档 `--warning` 比 Vue2 的 `#f5a623` 明显更深)从 T2a 起就已生效,不只 Parser 两页** ——
   `.k-svc-light[data-state="paused"]` 的橙灯与 `.k-set-row-desc .warn` 都吃这个 token。
   → 🔴 **协调者裁定 A-2 的适用范围据此扩大:设置页(T8/T9)的验收清单也要写这条显式确认项**,
   不要等 Parser 页才提。同理浅档 `--success`(`#15754c` vs Vue2 `#2ecc71`)吃在 `.k-svc-light` 的绿灯上。

### 6.4.2 已登记但**本期不修**的守卫债务(T2a 评审 M-3,2026-08-03)

`knowledgeStyles.test.ts` 的 `nonKClassNames` 排除条件用 `/^fb(?:-|$)/`(区分大小写),
而「没有搬多」的扫描正则字符集只含 `[a-z0-9-]` → **理论上 `.fb-Foo` 这种带大写的类名两边都躲得过**
(既不被扫描抓、又被排除条件放过)。
🔴 **这不是本期引入的**:既有 `^k(2|n)?-` 有**一模一样的对称缺口**,早于 P5a。
**裁定:本期不修。** 理由:① 本仓 scss 类名全是 kebab 小写惯例,现实中不会写出 `.fb-Foo`;
② 为它改既有守卫属于「禁无关重构」;③ 改动会同时影响 P5a/P5b 的收官产物。
→ **转 P5d 顺手收紧**(改法:两处字符集同时加 `A-Z`,或给扫描正则加 `i` 标志并同步排除条件,**必配 RED 探针**)。

### 6.4.3 🔴 T2b 评审猎出的残留缺口(2026-08-03,**本期收,不转下期**)

`parserStyles.test.ts` 断言 (c) 的扫描范围是「`.parser-app` 块内零颜色属性、零 `--x:` 声明」——
**只扫那个块**。评审做「缺口猎」探针实测:把 `--sneaky-token: …` 写进**页面作用域**(`.parser-app .parser-status-page`)
→ **18/18 全绿,逃过所有守卫**。

- **实现者无过错**:治理 §6.4-5(c) 原文写的就是「`.parser-app` 块里」,他达标了。
- **但 K21 的语义没闭合**:K21 的意思是「token 声明层只在 `knowledge.scss`,`parser-styles.scss` 零 token 声明」,
  不是「只有 `.parser-app` 块零 token 声明」。
- **裁定:把 (c) 的 `--x:` 扫描范围扩到全文**(颜色属性那半仍只针对 `.parser-app` 块 —— 页面作用域当然要写颜色属性)。
  **扩范围 = 扫描变大,不是放宽**;必配 RED 探针,且**评审探针 G 必须从「18/18 全绿」翻成报红**(那是唯一的判别力证据)。

**另两条登记不改**:① 具名色扫描大小写敏感 —— 与 `knowledgeStyles.test.ts` 同款,评审另跑大小写不敏感全扫 **0 命中**,
且本仓 scss 全小写惯例(同 §6.4.2 的取舍);② 报告 §8.1/§5.3 的行号在 K31 后陈旧(`60/67/154` → `68/75/162`、
浅档块 `:249-345` → `:249-340`),**结论不受影响**,随本轮就地订正。

### 4.4 🔴 fixture 的用法:**抄进测试 + 注明出处**,不许运行时读台账目录

(协调者裁定 2026-08-03,T3 顾虑 3 触发;**沿用 P5b 的既有写法**)

- **反面做法**:测试用 `node:fs` 运行时读 `.superpowers/sdd/p5c-fixtures/*.json`。
- **风险(不是风格偏好)**:
  1. `.superpowers/` 被 `.gitignore` 盖着,靠 `git add -f` 才进版本库 ——
     🔴 **这个目录在 SP7 整个丢过一次**(记忆 `sp7-photos-migration-progress`:gitignore 导致 git 救不回)。
  2. 本分支将来要合 master。`src/` 下的测试**跨界依赖一个 gitignore 目录**,一旦合并没带上、
     或有人跑 `git clean -X`,测试会以「找不到文件」的形式**神秘挂掉**,排查的人想不到去看台账目录。
- **正确做法**:数据**逐字**抄进测试文件,注释写明「取自 `p5c-fixtures/<file>`(YYYY-MM-DD 真机抓取)」。
  🔴 **抄完做一次程序化逐字节等价校验**(写一次性脚本比对,把输出贴进报告)—— **不许肉眼比**。
  降层动作(如 K28 的三层 → 单层)在注释里保留,那是偏离的落地证据。
- 🔴 **「不许手编 fixture」的本意是「别凭想象编数据」,不是「必须运行时读」。** 两者别混。

### 12.2 brief 勘误追加(T3 核出,2026-08-03)

- **E-8**:T3 brief §6 写「`dist` 里搜不到 `.fb-` 是正常的(被 tree-shake)」—— **把 CSS 与 JS 混为一谈了**。
  实测:`.fb-crumb` 等 **CSS 确实在 `dist/assets/index-*.css` 里**(T2a 把 `.fb-*` 搬进 `knowledge.scss`,
  而 `knowledge.scss` 由 `KnowledgeLayout.vue` import,早就进构建管线);
  **被 tree-shake 掉的只有组件 JS**(`FolderBrowser` 此刻全仓零 import)。
  → **正确口径:`dist` 的 CSS 里应能搜到 `.fb-`,JS 里搜不到 `fb-crumbs` 才是预期。** 评审按本条核。

### 9.1 🔴 「过期守卫」必须同时守两件事(T3 评审 M-1 猎出,2026-08-03)

记忆 `newui-async-stale-guard` 那条纪律(异步写共享 state 必带过期守卫)在本仓**已被评审逮到四次**。
T3 评审猎出它的**第二半从来没人守**:

| 要守的 | 现状 |
|---|---|
| ① 守卫**逻辑**对不对(先发后至不覆盖) | T3 有三条交错用例,拿掉任一处守卫都报红 ✅ |
| ② 守卫**变量的作用域**对不对(必须组件本地,不能模块级) | 🔴 **零用例**。评审探针实测:`seq` 挪到真模块级 → **19 passed,零报红** |

→ **纪律:凡带 epoch/seq/uuid 过期守卫的组件,除交错用例外,必须另有一条「两实例交错」用例**
——挂载两个实例、让各自的异步请求交错在飞,断言**两个实例各自拿到自己的结果、互不覆盖**。
**验收判据:把守卫变量挪到模块级,这条用例必须报红。**
(T3 已按本条补齐;下游任何新写的过期守卫照本条办。)

## 13. 验收清单纪律(**下游与协调者都受约束**)

P5b 验收第 1 轮得来的两条,逐字生效:

1. 🔴 **凡「点某个东西」的项,必须先确认该元素在本机数据下真的渲染成可点元素。**
   `v-if="x > 0"` 这类数据依赖的可点性是高发区(P5b 的 B18 就是把 `failed===0` 时根本不是按钮的磁贴
   当成可验项,用户白找一轮)。
   🔴 **本期已知的高危点(协调者写验收清单时必须点名,数据依据见 §4.3)**:
   - **ParserStatus 失败卡**:`<button class="toggle">` **无条件渲染**(文案「最近失败(0)」)→ **能点**;
     但 `<ul v-show="failedOpen" v-if="failedJobs.length">` 在本机 `failedJobs === []` 时
     **`v-if` 先判掉、整个列表不渲染**(N19)→ **点开后什么都不出现,这是正确行为**。
     清单要写成「点开后确认列表区为空 = 预期」,不要写成「点开看失败列表」。
   - **ParserStatus 文件夹卡**:本机 20 组 → 走 `v-else` 列表分支;
     `v-if="!folders.length"` 的 `No pending` 空态 **本机验不到**。
   - **设置页「搬文件到新目录…」按钮**:`:disabled="!rootPicker.path || (dirProbe.state==='done' && !dirProbe.migratable)"`
     —— 选 `/DATA/Notes`(实测 `{exists:true, empty:false}`)时**是灰的**。要点开它必须先在选择器里
     走到一个**空目录或不存在的目录**(`/DATA/Downloads` 之类多半非空;`/mnt` 下大概率是空的,现场试)。
   - **设置页「重建全部索引」按钮**:蓝本 `SettingsView.vue:181` 硬编码 `disabled`,**永远不可点**。
     清单只能验「它是灰的 + 旁边有『即将上线』徽标」。
   - **设置页自动捕获的 `.warn` 提示行**:`v-if="!notesSettings.autoExtract"`,本机 `auto_extract: true`
     → **不渲染**。要看到它得先点一下开关(会真的改后端设置,点完记得点回来)。
   - **设置页服务卡的绿灯/「运行中」档**:本机 `paused: true` → 默认只能看到橙灯 + `⏸ Paused`。
     点「恢复」会**真的恢复后台索引**(内存会从 151 MB 涨到 ~2.8 GB) → 清单要写明「验完点回暂停」。
   - **ParserTest 的 `rr` 分数**:§4.2 已实测本机 reranker 坏 → **永远看不到**;
     勾 rerank 只能验 `⚠ Reranker error:` 警告条。
   - **ParserTest 的 docling 卡**:`.md`/`.txt` 不产生 `docling_markdown` → **不渲染**;
     要看到它得传 `.docx`/`.pptx`/`.xlsx`(**别传 `.pdf`**,会触发 ~200 MB 模型下载)。
   - **ParserTest 的「解析出 0 块」空态**:传一个**空文件**就能验(实测 200 + `chunks: []`)✅。
2. **具体计数有保质期。** 清单里写「**实测于 2026-08-03,数字会漂,以下列命令现测为准**」+ 附取数命令
   (见 `p5c-fixtures/README.md` 的「重抓命令」一节),**别钉死数字**。
3. 🔴 **本期新增第 3 条:凡「会写后端 / 会改设备状态」的验收项,必须在清单里标红并写「验完怎么恢复」。**
   本期至少 4 处:恢复/暂停索引 · 改并发档位 · 改推理设备 · 开关 OCR · 开关自动捕获 · 改笔记目录。
   P5b 全是只读页,这个问题第一次出现在本期(设置页与 ParserStatus 都是**控制面板**)。
