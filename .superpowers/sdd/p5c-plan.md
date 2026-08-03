# SP8-P5c 实施计划 —— 知识库配置页 + Parser 两页

**权威优先级:上级设计 > `p5c-common-constraints.md` + 附录 A/B/D > 本计划书 > 任务 brief。**
🔴 **本计划书不重复治理文件的内容**,只定「切几刀 / 什么顺序 / 每刀的 DoD 与依赖」。
下游任务**必读治理文件与三份附录**,本计划书只当路线图看。

- 治理:`.superpowers/sdd/p5c-common-constraints.md`(K21–K30 · N15–N22 · §6.1 C-3 裁定 · §6.4 五处守卫改动 · §8.1 算术 · §13 验收纪律)
- 附录:`p5c-appendix-A-i18n.md` · `p5c-appendix-B-tokens.md` · `p5c-appendix-D-classes.md`
- fixture:`p5c-fixtures/`(14 份真机响应体 + README 的重抓命令)
- T0 报告:`p5c-task-0-report.md`(含 brief 勘误 E-1~E-7)

## 坐标与基线

| | 值 |
|---|---|
| 可写仓 | `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai` |
| 起点 | `63a0b0d`(T0 之前);**T0 产出已在 `b01e889`** |
| Service 仓 | `sp8-ai`@`15c2eba`,**全期零改动**(T0 逐方法实证 11/11)→ 不跨仓 build、不 `pnpm install` |
| 三门基线 | **319 文件 / 3153 例全绿** · `vue-tsc` 0 · `vite build` 0(协调者与 T0 各实测一次,逐字一致) |
| 验收 | dev server `:5288`(PID 85265)。**每刀提交后由协调者 kill 重起**(P3a 教训) |
| 收官目标 | **326 文件**(+7 测试文件)· color-guard **+4 例**(4 个新 `.vue`,`.vue` 总数 175 → 179) |

## 协调者裁定(2026-08-03,补治理文件)

- **A-1 新建 `aiKbDeviceAuto`,不复用 `aiKbOriginAuto`。**
  `aiKbOriginAuto` 现值 = `Auto` / `自动`(`en_us.ts:1548` / `zh_cn.ts:1562`),**复用渲染完全一致**,
  但键名语义是「沉淀任务来源」,与「推理设备自动档」无关 —— 将来改沉淀文案会静默改掉设备下拉。
  → **附录 A 的三个 `98` 全部改 `99`;复用 11 → 10;distinct 合计 109 不变。**
  该键服务三处调用点(`SettingsView` 设备单选、`SettingsView.deviceLabel`、`ParserStatus.deviceOptions`),
  仍是**一个**键。「exactly N keys」防漂移断言用 **99**。
- **A-2 T0 顾虑 1(浅色档指示灯偏深)按 T0 的裁定执行:保全站一致,不开小灶。**
  浅档 `--warning` `#92600c` / `--success` `#15754c` 比 Vue2 的 `#f5a623` / `#2ecc71` 肉眼可见地深
  (卡片底 / `--danger` / 描边几乎一致,只有这两个指示灯不一致)。
  → **不新造「亮橙 / 亮绿」token**(那是为两个 8px 小圆点破坏全站色板一致性)。
  → **必须写进验收清单当显式确认项**,请用户看实物后拍板;用户若要改,那是独立的 token 决策票,不夹在本期。
- **A-3 T0 顾虑 2(K22)接受,已在治理 §3 登记。** 评审按 K22 判,不按 1:1 报。
- **A-4 T0 顾虑 5(DM9 转 P5d)接受。** 不为一个用例名去碰 P5b 收官产物。
- **A-5 T0 新开的 2 条后端票接受**,登记进 roadmap 挂账,本期照抄前端、不绕、不修。

---

## 切刀(单车道 T1 → T10,共 10 刀)

**单车道**:每刀独立 subagent → 独立评审(**最低 sonnet,禁 haiku**)→ 必要时修复轮 → 协调者 kill 重起 `:5288`。
**一刀 = 一个语义提交。** 每刀提交前三门全过(治理 §8)。

### 依赖链

```
T1 i18n(99 键)
  └─ T2a knowledge.scss 段 + K21 + 4 token + 守卫①③′④
       ├─ T2b parser-styles.scss + parserStyles.test.ts(守卫②⑤)
       │    ├─ T6 ParserStatus.vue
       │    └─ T7 ParserTest.vue
       ├─ T3 util/folderBrowser.ts
       │    └─ T4 FolderBrowser.vue
       │         └─ T9 SettingsView 下半(笔记根 + reka 弹窗)
       ├─ T5 parserStore.ts
       │    └─ T6
       └─ T8 SettingsView 上半
            └─ T9
                 └─ T10 路由反转 + 收官
```

实际派活顺序(单车道,前一刀评审过了才发下一刀):
**T1 → T2a → T2b → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10**

---

### T1 · i18n(99 新键 + 10 复用)

**改**:`src/i18n/zh_cn.ts` · `src/i18n/en_us.ts` · `src/i18n/messageSyntax.test.ts`
**新建**:`.superpowers/sdd/p5c-task-1-i18n-verify.mjs`
**零 `.vue`、零测试文件新增** → 文件数仍 **319**

**DoD**
1. 99 键**同时**进两档(`parity.test.ts` 自动断言键集一致)。zh 值**逐字照抄** `git show main:src/assets/lang/zh_CN.json`,**不许自己翻译、不许改标点**。
2. 🔴 **跑 `p5c-task-1-i18n-verify.mjs`**(照 `p5b-task-1-i18n-verify.mjs` 写):对 99 条逐 `codePointAt` 比对语言包 → **99/99 MATCH**;另对 10 条复用键做「现值未被改动」比对 → **10/10 MATCH**。**两段输出贴进报告。**(P5a T8 教训:附录零差异,手抄进 TS 时引入 5 处全角标点错。)
3. `messageSyntax.test.ts` 三条守卫**只圈本批 99 键**,不许全量生效:(a) 全角标点例外 = 附录 A §A.5 的 18 条,一律 `toBe` 钉死确切值的强断言,其余 81 条必须扫不出;(b) 带占位符 9 条两档名称集合一致;(c) 「exactly **99** keys」。
   ⚠️ `。` `「」` `·` `—` `–` `…` `×` **都不在**那个正则里,别按「看着像全角」判。
4. **N21 四组撞车 / 错译一律照抄**(`Resume`→恢复 与 `aiKbRebuild`→恢复 撞车 · `Test Sandbox`/`Test sandbox` 两键同 zh · `Power-saving`/`Full power` 不许复用 `aiKbCcPowerSaver`/`aiKbCcFullSpeed`(en 不同)· `aiKbPrOcrHint` 的「真实索引的扫描件」语义错)。**统一 = 界面不 1:1 = 回归。**
5. **N22 的技术标识符不许补 i18n 键**(`rerank top-20` / `dense [0:8]:` / `target_tokens` / `cos` / `rr` / `chunk #` …)。
6. 报告列清「复用 10 / 新增 99 / Vue2 有权威 zh 值 99 / 本期新造 0 / **死键 0**」。

---

### T2a · `knowledge.scss` 新增段 + K21 + 4 个新 token + 守卫 ①③′④

**改**:`src/ai/styles/knowledge.scss` · `src/ai/styles/knowledgeStyles.test.ts`
**零 `.vue`、零测试文件新增** → 文件数仍 **319**

**搬**(附录 D 是权威,行号已 T0 逐个核准):
- K17 四类 `.k-modal-head`(:1317)`-title`(:1321)`-x`(:1322)`-body`(:1330) —— **交接项 #1 兑现**
- 设置页整段(`.k-set-card` :1142 起 …… `.k-sandbox-icon` :1284),**含 `:1252` 的 `.k-set-danger .k-set-row-title`**(危险区标题变红全靠它,C-7 漏登记)
- `.k-section` 四类 —— 🔴 **只搬 `:969-984`,不搬 `:985-991` 的 `.k-section-body`**(E-3:按 `:988` 切会截断规则 → sass 报错)
- `kn-*` 段 **`:2250-2263`**(顶层裸选择器 → **K9 嵌套进 `.knowledge-app`**),含 `:2252` 的 `.kn-picked code`
- `.fb-*` 段(蓝本在 `FolderBrowser.vue` 自己的 `<style scoped>` 里)
- 🔴 **N15:`.k-progress-*` 六类(`:1152-1157`)不搬**,「没有搬多」断言要守住

**K21**(§6.1):`knowledge.scss` 的两个 token 声明块选择器各扩一个逗号项 →
`.knowledge-app, .parser-app { … }` / `:root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app { … }`。
🔴 **只改这两行选择器,块内容一个字节都不许动**(评审会 `git diff` 逐行看)。
🔴 **`.parser-app` 块里零颜色属性、零 `--x:` 声明**;`.parser-app` 只带 K22 那三行结构属性(在 T2b 的文件里)。

**4 个新 token**(§6.3,**全部有仓内逐字同值出处,零凭空造**):
`--grad-sandbox`(= `tokens.scss:236` 的 `--grad-sk-blue`,**改名不改值**,`-sk-` 是技能区命名)·
`--switch-thumb`(`:201`/`:345`)· `--switch-thumb-shadow`(`:202`/`:346`)· `--gloss-inset-dot`(`:162`/`:321`)

**守卫**(§6.4)
1. `DARK_TOKEN_SELECTOR`(:245)/ `LIGHT_TOKEN_SELECTOR`(:246)跟着 K21 改。🔴 `declBlockRange` 用**行首行尾锚定** → **选择器必须写在一行**。**RED 探针**:scss 改回单个 `.knowledge-app {` → 精确报红 → 还原。
2. `nonKClassNames`(:196-199)加 `&& c !== 'parser-app'`(与 `knowledge-app` 同款处理,**`NON_K_HELPER_CLASSES` 保持 9 项**)+ 在 `:203` 集合相等断言上做 RED 探针。
3. 白名单 `WHITELIST_187` → **`WHITELIST_N`**(准确增量见附录 D §D.0,常量名跟数字改)。
4. **缺口①**:「没有搬多」正则 `/\.k(?:2|n)?-[a-z0-9-]+/g` → `/\.(?:k(?:2|n)?|fb)-[a-z0-9-]+/g` + RED 探针(临时塞 `.fb-foo { }` → 报红 → 还原)。**扩正则 = 扫描范围变大,不是放宽断言。**
5. **缺口④** 见上第 2 条。

**额外门**:`pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` exit 0
**注**:缺口 ③′(模板零裸色守卫的贪婪化)归 **T8**,不在本刀。

---

### T2b · `parser-styles.scss` 新建 + `parserStyles.test.ts` 新建(守卫 ②⑤)

**新建**:`src/ai/styles/parser-styles.scss` · `src/ai/styles/parserStyles.test.ts`
→ 文件数 **319 → 320**

**内容**:蓝本两处 scss 共 **199 行**(`parser-styles.scss` 74 + `ParserTest.vue:245-369` 的 125)。
- 🔴 **K23 两页各自作用域,不合并**:`.parser-app.parser-status-page { … }` 与 `.parser-app.parser-test-page { … }`。C-2 实测:`.card` / `.page-header` / `.page-header h2` 三条逐字相同,但 `.row` / `h3` / `li` / `.hint` **各不相同** → 合并 = 界面不 1:1。**东西在哪儿就搬到哪儿。**
- 🔴 **K22**:`.parser-app { height: 100vh; height: 100dvh; overflow-y: auto }` —— Vue2 没有这三行,但 `theme.css:318` 是 `body{overflow:hidden}`,顶层路由页不自建滚动容器**内容永远看不到**。这是修可复现的错误行为。
- 🔴 **19 个 `var(--ns-color-*, fallback)` 全部渲染回退值**(全仓零 `--ns-color-x:` 声明,T0 复核)→ **附录 B 按回退值建映射**,不是按 token 名猜语义。
- 零色字面量(`white`/`black` 具名色也算;`transparent` 是关键字不算)。

**`parserStyles.test.ts` 四条**(§6.4-5,`parser-styles.scss` 既不受 `color-guard`(不扫 `.scss`)也不受 `knowledgeStyles.test.ts`(只读 `knowledge.scss`)约束 = **裸奔**):
(a) 全文零色字面量 ·(b) 零顶层裸选择器(第 0 列只许是那三个)·(c) `.parser-app` 块零颜色属性零 `--x:` 声明 ·(d) `.card` / `.page-header` 在**两个**作用域下各有一份(堵 K23)
🔴 **读源文件一律 `node:fs`,不许 `?raw`**(CSSEnablerPlugin 会换成空串 → 对空字符串假通过)。**每条都要 RED 探针。**

**额外门**:`pnpm exec sass --no-source-map src/ai/styles/parser-styles.scss /dev/null` exit 0
**注**:`grep -o "parser-status-page" dist/assets/*.css` 命中这条 DoD **归 T6**(要先有 `.vue` import 它才会进构建产物)。

---

### T3 · `util/folderBrowser.ts`(纯函数 34 行)

**新建**:`src/ai/knowledge/util/folderBrowser.ts` · `src/ai/knowledge/util/folderBrowser.test.ts`
→ 文件数 **320 → 321**

三个纯函数 `dirEntries` / `pickerRoots` / `crumbsFor`(蓝本 `folderBrowser.js:3-34`)。
- `dirEntries`:过滤 `e.is_dir && !e.name.startsWith('.')` → map `{name, path}` → `localeCompare` 排序。**`FolderEntry = { name, path, is_dir }`(`Service/src/types.ts:26-30`)与蓝本字段逐字对上,零改动移植。**
- `pickerRoots`:空/无候选时兜底三根 `System (/DATA)` / `/media` / `/mnt`(**本机 `wiki/candidates` 实测 `[]` → 真机走的就是这条**)。
- `crumbsFor`:首项 `{label: rootLabel, path: ''}` + 逐段累加。

**DoD**:每个函数的**每个分支**都有用例;边界两侧都要断言(空数组 / 无 `is_dir` 项 / 全是隐藏项 / `path=''` / 单段 / 多段 / 前后多余 `/`)。用 fixture `folder-list-DATA.json` 的**真实 18 项**做一条端到端用例(`is_dir` 过滤后 12 个目录,`.snapshots`/`.system_data`/`.wiki.md` 被滤掉)。

---

### T4 · `FolderBrowser.vue`

**新建**:`src/ai/knowledge/components/FolderBrowser.vue` · `FolderBrowser.test.ts`
→ 文件数 **321 → 322**;`.vue` **175 → 176**,color-guard **+1**

- **K27/K28**:`folder.getList` → `service.folder.getList`,🔴 **单层取数** `(await service.folder.getList(path)).content || []`(蓝本 `:66` 是 `r.data.data.content` 三层)。mock 用**单层** `{ content: FolderEntry[] }`,**不是** fixture 里那个三层信封(§4.1)。
- **§5.2 `_seq` 竞态守卫**照抄(蓝本 `:57-72`:`reset()` 递增 `_seq`、`go()` 里 `const seq = ++this._seq`、三处 `if (seq !== this._seq) return`)。Vue3 里 `_seq` 是组件本地 `let`/`ref`。**回归测试必须走交错路径**(记忆 `newuiasync-stale-guard`:别抽公共 guard,过早抽象)。
- `:data-last="String(i === crumbs.length - 1)"` **照抄 `String()`**(P5b E-9 裁定);断言 `toBe('true')` / `toBe('false')`,**禁 `toBeUndefined()`**。
- 暴露 `reset()` 给父组件(蓝本靠 `$refs.fb.reset()`)→ Vue3 用 `defineExpose({ reset })`。
- **缺口③**:补一条「`<template>` 块零裸色」定向断言。

---

### T5 · `parserStore.ts` + 交接项 #2

**新建**:`src/ai/knowledge/stores/parserStore.ts` · `parserStore.test.ts`
**改**:`src/ai/knowledge/stores/knowledgeStore.parser.test.ts`(**只改那一行 mock**)
→ 文件数 **322 → 323**

- **K26**:`Vue.observable` → Pinia setup store;`_timer` 句柄**移出 state** 成模块级 `let`。
- **K27**:5 处 `api.*('/ai/parser/…')` → `service.ai.parserStats/parserState/parserFolders/parserJobs/parserControl`。
- `loadAll()` 的 `Promise.all` 四发 + catch 置 `unreachable=true` + `error=e.message` + finally 清 `loading` —— **照抄**(蓝本 `:24-45`)。
  ⚠️ 蓝本 `failedJobs = (failed.data && failed.data.jobs) || []` 的 `|| []` 兜底**不许删**(N7)。
- 五个控制动作(`pause`/`resume`/`setConcurrency`/`setDevice`/`setOcr`)都是 `await parserControl(...)` 后 `await loadAll()` —— 照抄。
- 🔴 **交接项 #2**:`knowledgeStore.parser.test.ts:85` 的 `parserDeleteJob` mock `{}` → **`''`**(axios 1.18.1 对 204 空体给空串,P5b 治理 §4.1 有源码依据)。报告显式申报「P5b 授权外、由 P5c 治理文件派活」。
- mock 一律 fixture 原文 **snake_case**(`parser-stats.json` / `parser-control-state.json` / `parser-folders-pending-20.json` / `parser-jobs-failed-5.json`)。
- **DoD**:`unreachable` 两个方向都要用例(四发里任一 reject → true;恢复 → false 且 `error=null`)。

---

### T6 · `ParserStatus.vue`

**新建**:`src/ai/knowledge/parser/ParserStatus.vue` · `ParserStatus.test.ts`
→ 文件数 **323 → 324**;`.vue` **176 → 177**,color-guard **+1**

- **零 KIcon**(E-2 补登记:两个 Parser 页蓝本零 KIcon,**不许顺手换成 KIcon**,N16)。
- **N16 emoji 逐字照抄且位置不许挪**:`⏳ 📦 📍 ✅ ❌ 🔄` 在 `$t()` **外面**;`▶ ` / `⏸ ` 由 script 拼接(`:27` `('▶ ' + $t('Resume'))`);`🧪 {{ $t('Test sandbox') }}`。
- **N17**:`[$t('Power-saving'), $t('Balanced'), $t('Full power')][[1,2,4].indexOf(n)]` **照抄这个写法**,不许改成 computed 映射表。
- **N19**:`<ul v-show="failedOpen" v-if="failedJobs.length">` **两个指令都照抄**(`v-if` 优先级高,空数组时整个 `<ul>` 不渲染,`v-show` 是死的)。
- **N20**:5 秒轮询 + `document.hidden` 守卫 + `onBeforeUnmount` 清定时器,频率/守卫/时机照抄。
- `formatCursor` 用 `new Date(ms).toLocaleString()`、`barWidth` 用 `reduce` 求 max、`truncateErr` 120 字符 —— 照抄。**测 `barWidth` 要覆盖 max=0 时的 `|| 1` 兜底**。
- 样式:`import '../../styles/parser-styles.scss'`(JS 侧 import,**零 `<style>` 块**),根元素 `class="parser-app parser-status-page"`。
- **缺口③**:补「`<template>` 块零裸色」定向断言。
- **额外门**:`pnpm build` 后 `grep -o "parser-status-page" dist/assets/*.css` **命中**(证明 T2b 的新文件真进了构建管线)。

---

### T7 · `ParserTest.vue`(本期最大一刀,369 行)

**新建**:`src/ai/knowledge/parser/ParserTest.vue` · `ParserTest.test.ts`
→ 文件数 **324 → 325**;`.vue` **177 → 178**,color-guard **+1**

- **K27**:`api.post('/ai/parser/test/analyze', fd, {headers, timeout})` → `service.ai.parserTestAnalyze(fd)`。
  🔴 **包里已带 multipart 头 + 120s 超时**(`ai.ts:673-680`,注释写明与蓝本 `:207-219` 逐字对齐)→ **调用方不许再传第二个参数**。
- FormData 九个字段的**顺序与值**照抄(`file` / `query`(仅非空时)/ `embed:'true'` / `rerank` / `ocr` / 三个 `String(params.*)`)。
- 30MB 前端拦(`onFile`:超限只设 `error`、**不清 `file`**、不发请求)· `onDrop` 取 `dataTransfer.files[0]` · `clearFile` 三清 —— 照抄。
- **N18**:`result.scored.indexOf(s) + 1` 当排名序号,**照抄**(O(n²) 但 `scored` ≤20,不是可复现错误)。
- **N22**:`rerank top-20` / `⚠ Reranker error:` / `dense [0:8]:` / `sparse top:` / `chunk #` / `cos` / `rr` / 三个参数 `<label>` / `chunker=…, target=…` / `{{ c.token_count }} tokens · offset …` —— **全部不进 i18n**。
- **fixture 用 §4.2 的六份**:`parser-test-analyze-md-ok.json`(无 `docling_markdown`、`scored` 无 `rerank_score`、`.md` 的 `overlap_tokens` 被后端改写成 0)· `-txt-rerank.json` · 四份 `.http`(400 越界 / 400 坏扩展名 / **422 `detail` 是数组** / 200 空文件)。
- 🔴 **422 那条分支 UI 到不了**(`:76` 的 `:disabled="!file || loading"` 挡住)→ **照抄 `detail || e.message || String(e)` 取值链,不许加数组分支处理,也不许为它写单测**(测 UI 到不了的路径 = 空转)。
- 根元素 `class="parser-app parser-test-page"`,`import '../../styles/parser-styles.scss'`,零 `<style>` 块。
- **缺口③**:补「`<template>` 块零裸色」定向断言。

---

### T8 · `SettingsView.vue` 上半 + 缺口 ③′

**新建**:`src/ai/knowledge/views/SettingsView.vue` · `SettingsView.test.ts`
**改**:`src/ai/styles/knowledgeStyles.test.ts`(缺口 ③′)
→ 文件数 **325 → 326**;`.vue` **178 → 179**,color-guard **+1**

**本刀范围**(蓝本 `SettingsView.vue` 的这几块):服务卡(`:7-20`)· 运行档三行(并发 `:24-37` / 设备 `:39-52` / OCR `:54-64`)· 沙盒入口(`:161-170`)· 危险区(`:173-190`)· 对应的 script(`controlState` / `deviceLabel` / `togglePause` / `setConcurrency` / `setDevice` / `toggleOcr` / `goSandbox`)。
**下半(笔记根目录 + 迁移弹窗)归 T9** —— 本刀模板里那两块先不写,**T9 补齐**(不留占位符,直接不写那些 DOM;T9 插进去)。

- **K30**:四个 catch 里蓝本拼 `e.message`,本仓只弹固定 `aiKbOpFailed` / `aiKbSwitchFailed`。**落地判据:排除式断言**,DOM/toast 必须不含后端文本。
- `data-on` 六处 **照抄 `String()`**(`:31/45/46/47/59`),断言 `toBe('true')`/`toBe('false')`。
- `deviceLabel` 四分支全覆盖(`auto` 带占位符 `{r}` 大写 / `cuda` / `gpu` / `cpu` / 兜底回 `d` 原串)。
  ⚠️ 设备单选第二个按钮的 `data-on` 是 `device === 'cuda' || device === 'gpu'` **两个值**,两侧都要用例。
- 🔴 **缺口 ③′(交接项 #4)**:`knowledgeStyles.test.ts` 里「模板零裸色」的 `<template>` 提取现在靠「`</template>` 在第 0 列」这个**脆弱隐式锚定**(`QueueView.vue`/`IndexedFilesView.vue` 各有 7/12 个嵌套 `<template>`)。
  → **本刀统一改成贪婪匹配到最后一个第 0 列 `</template>`**(或 `src.lastIndexOf('\n</template>')`)+ **覆盖度自检**:断言抽出的片段包含模板**最后一行**的一个特征串。
  🔴 **必配 RED 探针:在模板最后一行塞一个裸色 → 必须报红。** 别再复制那个脆弱正则。
- **本机数据当预期行为**(§13):`paused:true` → 橙灯 + `⏸ Paused` + `primary` 档「恢复」;`device:auto`+`resolved:cpu` → `自动(当前 CPU)`;`ocr_enabled:false` → 开关灰档;「重建全部索引」**硬编码 disabled 永远不可点**。

---

### T9 · `SettingsView.vue` 下半(笔记根目录 + reka 迁移弹窗)

**改**:`SettingsView.vue` · `SettingsView.test.ts`
→ 文件数仍 **326**

**本刀范围**:笔记区(`:66-124`:notesRoot 展示 + `openRootPicker` 折叠区 + `FolderBrowser` 接入 + `onPick`/`dirProbe` 三档徽标 + 「仅指向」/「搬文件」两按钮 + 说明 note + 自动捕获开关)· 迁移确认弹窗(`:126-160`)· script 的 `notesSettings` / `rootPicker` / `dirProbe` / `migrating` / `migrateAck` / `created()` / `applyRoot` / `doMigrate` / `closeMigrate` / `toggleAutoExtract` / `browserRoots`。

- **K27**:`notesApi.getSettings/putSettings/dirInfo` → `service.notes.*`。
  🔴 **mock 用 camelCase 且只有 `{ notesRoot, autoExtract }` 两个字段**(`normalizeSettings` 把 HTTP 层的 `distill_roots`/`distill_daily_cap`/`background_model` 全丢掉了)。写成 snake_case 或多带字段都是错的(§4.1)。
  ⚠️ `autoExtract: r.auto_extract !== false` → `undefined` 归一成 `true`,与蓝本 `data()` 默认值一致,照抄。
- **`onPick` 的过期守卫照抄**(蓝本 `:236-238` 自带 `if (this.rootPicker.path !== path) return`,两处)。**回归测试走交错路径。**
- **K29 迁移弹窗转 reka + `DialogPortal to=".knowledge-app"`**;🔴 **交接项 #3:测试要自己在 body 备宿主**,先例 `QueueView.test.ts:127-130` 的 `withHost()`。
- **K30**:`applyRoot` 的 catch 里蓝本读 `e.response.data.detail`,本仓只弹 `aiKbOpFailed` + **排除式断言**。
- `openRootPicker` 的行为以蓝本为准,Vue2 既有单测 `settingsViewRootPicker.spec.js` 描述的两条**行为要承接**:重开时清掉上次的 `path`、再点一次关闭不抛错。
- **`migratable` 判据**:`!info.exists || info.empty`(不存在 **或** 空)。三档徽标 `loading`/`done&&migratable`/`done&&!migratable` + `error` 档(徽标都不出)全覆盖。
- **本机数据**:`/DATA/Notes` 实测 `{exists:true, empty:false}` → 「搬文件到新目录…」**是灰的**;`wiki/candidates` 实测 `[]` → 选择器根层是兜底三根。

---

### T10 · 路由反转 ×3 + 占位摘项 + 收官

**改**:`src/ai/knowledge/deferred.ts` · `src/ai/knowledge/knowledgeRoutes.ts` · `knowledgeRoutes.test.ts` · `deferred.test.ts`(若存在)
→ 文件数仍 **326**

1. `DEFERRED_TABS` 摘 `'settings'`:**6 → 5**(`'allowlist'` 留着,本期不做)。按 T5/T10 先例在文件头加本期注释。
2. `knowledgeRoutes.ts:59` `settings` → 真 `SettingsView`。
3. `knowledgeRoutes.ts:62` `/ai/parser` → 真 `ParserStatus`;`:63` `/ai/parser/test` → 真 `ParserTest`。
   🔴 **这两条是顶层路由、不在 `DEFERRED_TABS` 里,不用摘。**
4. 🔴 `knowledgeRoutes.test.ts` 里「其余子路由仍是 `KnowledgeDeferred`」的断言 **反转,不删**;改前原文留成注释 + 写清为什么(先例:该文件 `:26-63`、P5b T5/T10 两次同款)。**K7 占位机制本身保留**(承 P4 I2 教训:清空后要仍有用例证明它有能力)。
5. **收官三门**:应是 **326 文件 / (3153 + 4 + 各刀新增) 例全绿** · tsc 0 · build 0。
6. 报告里给**收官口径**:文件数 / 用例数 / 4 个新 `.vue` 的 color-guard +4 已体现。

---

## 每刀通用要求(治理文件里已有,这里只列最容易漏的)

- **三门全量**,输出**完整落盘不许 `| tail`**;报告贴 `Test Files` / `Tests` 两行 + 红项完整用例名。
- **提交前** `git show --stat HEAD` + `git status` 自查;台账/报告 **`git add -f`**;禁 `git add -A`/`.`。
- **报告要显式申报本刀命中的每一条 K1–K30 与 N1–N22**,以及**用了哪几个 fixture、mock 形状取自哪一层**。
- **RED 探针**:凡本计划书写了「必配 RED 探针」的,报告要贴**两段输出**(报红 + 还原后转绿)与 `git status` 干净证明。
- **评审最低 sonnet、禁 haiku**;评审不许采信实现者报告、不许改仓库、不许提交任何东西,全文写 `p5c-task-N-review.md`,返回 ≤25 行。
- **拿不准写 `NEEDS_CONTEXT` 并停下**,不要自己拍。

## 验收清单(T10 之后由协调者写)

必须遵守治理 §13 三条:
1. 「点某个东西」的项**先确认该元素在本机数据下真渲染成可点元素** —— §13 已点名 **9 个高危点**,逐个照抄进清单。
2. 具体计数写「**实测于 2026-08-03,数字会漂,以下列命令现测为准**」+ 附取数命令,别钉死数字。
3. 🔴 **凡会写后端 / 改设备状态的项标红 + 写「验完怎么恢复」** —— 本期至少 6 处(恢复/暂停索引、并发档、推理设备、OCR、自动捕获、笔记目录)。**P5b 全是只读页,这个问题第一次出现在本期。**
4. **A-2 的指示灯色差**必须写成显式确认项,请用户看实物拍板。
