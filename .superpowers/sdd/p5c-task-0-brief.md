# SP8-P5c · Task 0 —— 治理文件 + 三份附录 + fixture(回源核查那一刀)

**你是 T0。本期最值钱的一步。** P5b 的 T0 从计划书里查出 **12 处错**,直接避免了下游 10 个任务
按错数字施工。本期没有计划书(计划书要等你的产出才能写),所以你的对手是**协调者这份 brief 本身**
—— 下面每一条标了「协调者已核」的都要你**独立回权威源复核一遍**,核出错就登记。

---

## 0. 你要交付什么

在 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/` 下产出(全部 `git add -f`,一个语义提交):

| 文件 | 内容 |
|---|---|
| `p5c-common-constraints.md` | **只写与 `p5b-common-constraints.md` 的差异**(P5b 那份写法就是模板:开头一句「P5a/P5b 每一条继续生效」,然后逐节写差异)。含 K 系列新偏离编号、N 系列照抄条目、数据契约、测试门算术、勘误节 |
| `p5c-appendix-A-i18n.md` | i18n 键表:每条给「New-UI 键名 · zh 值 · en 值 · 蓝本 `file:line` · Vue2 语言包权威值出处」。含全角标点例外清单、占位符清单、死键清单 |
| `p5c-appendix-B-tokens.md` | **色字面量逐处映射表**:`蓝本 file:line` → 原字面量 → New-UI token → 依据。本期这张表是重头(见 §3) |
| `p5c-appendix-D-classes.md` | CSS 类白名单增量:哪些类从蓝本哪几行搬来、白名单从 187 扩到几、哪些是「蓝本自己没定义的类」(N10/N13 同族) |
| `p5c-fixtures/README.md` + `*.json` / `*.http` | 本期用到的后端真响应体,逐字落盘 + 抓取命令 |
| `p5c-task-0-report.md` | 报告(契约见 `p5b-common-constraints.md` §10) |

**不要写计划书**(协调者按你的产出写)。**不要碰 `src/`**(本任务零产品代码改动)。

---

## 1. 工作区与硬约束

- **可写仓只有** `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`)。
- `/home/nimo/NimoTech/NimoOS-UI` **只读**,且工作树在旧分支上、有别的会话的未提交改动 →
  🔴 **取蓝本一律 `git show main:<path>`,禁 `cat` / `Read` 工作树文件。禁在那里 checkout/stash/提交任何东西。**
- **禁碰** `/home/nimo/NimoTech/NimoOS-New-UI`(SP6/SP9)与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7,有并发会话)。
- 禁 `git add -A` / `git add .`;禁 rebase / reset / stash / merge / push;不跑 `./scripts/deploy.sh`;不写 `/var/lib`;不改任何后端仓。
- `.superpowers/sdd/` 被 gitignore 盖着 → **`git add -f <显式路径>`**。提交后 `git show --stat HEAD` + `git status` 自查。
- 起点:New-UI `sp8-ai`@`cc6df78`(工作树干净)· Service `sp8-ai`@`15c2eba`。
- dev server 在 `:5288`(PID 85265),**别动它**。

### 必读(按序)
1. `.superpowers/sdd/p5a-common-constraints.md` 全文
2. `.superpowers/sdd/p5b-common-constraints.md` 全文(**§3 K1–K20 / §3.5 N1–N14 是判断「这算缺陷还是照抄」的唯一权威**)
3. `p5b-appendix-A-i18n.md` / `-B-tokens.md` / `-D-classes.md`(**学它们的表格格式,本期附录照同样格式出**)
4. `p5b-fixtures/README.md`(**抓取配方在这里**:直连 `:8283` / `:8282`,走 `/v1/ai/*` 必 400)
5. `p5b-progress.md` 的「🏁 P5b 编码收官 → 给 P5c 的交接项」9 条 + 「🔎 验收第 1 轮」三条教训(前 400 行逐任务过程不用看)
6. 上级设计:`git -C /home/nimo/NimoTech/NimoOS-UI show docs/vue3-migration-sp3:docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p5-knowledge-design.md`

---

## 2. 本期范围(用户 2026-08-03 拍板,**已收窄,不是上级设计的原样**)

### 2.1 蓝本清单(前缀 `git -C /home/nimo/NimoTech/NimoOS-UI show main:`,`main`@`7a6ee6b7`)

| 蓝本 | 行数(协调者已核) | 落到 New-UI |
|---|---|---|
| `src/views/AI/Knowledge/SettingsView.vue` | 322 | `src/ai/knowledge/views/SettingsView.vue`,rail 第 9 项 |
| `src/components/common/FolderBrowser.vue` | 143 | `src/ai/knowledge/components/FolderBrowser.vue` |
| `src/components/common/folderBrowser.js` | 34 | `src/ai/knowledge/util/folderBrowser.ts` |
| `src/views/AI/Parser/ParserStatus.vue` | 164 | `src/ai/knowledge/parser/ParserStatus.vue`,路由 `/ai/parser` |
| `src/views/AI/Parser/ParserTest.vue` | 369(含内联 `<style>` `:245-369`) | `src/ai/knowledge/parser/ParserTest.vue`,路由 `/ai/parser/test` |
| `src/views/AI/Parser/parser-styles.scss` | 74 | `src/ai/styles/parser-styles.scss` |
| `src/views/AI/Parser/store/parserStore.js` | 65 | `src/ai/knowledge/stores/parserStore.ts` |
| (参考)`src/views/AI/Knowledge/__tests__/settingsViewRootPicker.spec.js` | 38 | Vue2 既有单测,**行为参考** |
| (参考)`src/views/AI/Knowledge/styles/knowledge.scss` | 2561 | 设置页的 scss 段在里面 |

**落点是协调者的建议,不是硬规定** —— 若你发现更贴合本仓既有结构的落点(尤其 `parser/` 这层目录:
上级设计 §5.1 写的是 `src/ai/knowledge/parser/`),在治理文件里定死并说明。

### 2.2 🔴 本期**不做**的(用户拍板)
- **`AllowlistView.vue`(249 行)不做** —— 上级设计 §4 把它算在 P5c,用户 2026-08-03 明示移出本期。
  `DEFERRED_TABS` 只摘 `'settings'`(**6 → 5**),`'allowlist'` 留着。
  连带:蓝本 scss `:969-988` 那段头注释写 `/* ---------- Allowlist page ---------- */`,但
  **SettingsView 只用到其中 4 个类**(`.k-section` / `-head` / `-title` / `-hint`),
  `.k-section-body`(`:985+`)是 Allowlist 专用 → **只搬那 4 个,不搬第 5 个**。你要回源核准确行号。
- `.k-progress-card` / `-row` / `-label` / `-nums` / `-bar` / `-fill`(蓝本约 `:1152-1157`,夹在 Settings 段中间)
  —— 本期两页都不用,New-UI 也还没有 → **不搬**。登记成 N 系列条目(「没有搬多」那条断言要能守住)。

### 2.3 🔴 Parser 两页的配色口径(用户 2026-08-03 两次拍板,最终 = **照抄老样子**)

用户先选了「改按知识库设计语言重做」,随后**改回「照抄以前的吧」**。**最终口径:**

> **版式 / 间距 / 结构 / 文案 / DOM 顺序 / 按钮位置,全部逐字照蓝本 1:1。
> 唯一改的是颜色的写法** —— 因为仓内 `CLAUDE.md` 是强制约束(禁色字面量)。
> 每个 hex/rgba 换成语义最接近的既有 token,**浅色档肉眼与 Vue2 一致**;
> 暗色档跟着 token 自然变深(Vue2 只有浅色一套,暗色本无「原样」可抄,**这一条要在治理文件里显式申报成偏离**)。

**这条是本期与 P5b 最不一样的地方,附录 B 是重头。** 见 §3。

---

## 3. 协调者已核的事实(**逐条独立复核,核出错就登记进勘误节**)

下面每条都写了协调者用的命令/依据。**「已核」不等于对,P5b 的 12 处错就是这么查出来的。**

### C-1 🔴 `--ns-color-*` 在 Vue2 里**零定义** → 回退 hex 才是真实渲染值
```bash
git -C /home/nimo/NimoTech/NimoOS-UI grep -n -- "--ns-color-" main -- 'src/**' | grep -v "views/AI/Parser"
# 协调者实测:零命中
```
→ `var(--ns-color-elevation, #fff)` 这类,**真实渲染的是 `#fff`**。
→ **附录 B 要按「真实渲染值」建映射,不是按 token 名猜语义。**
→ 顺带核:`--border` / `--bg-tertiary`(`FolderBrowser.vue` 的 `<style>` 里也用了带回退的 var)在 Vue2 里有没有定义?
  有定义 → 映射依据是那个值;没定义 → 同样按回退值映射。**必须实测,不许推定。**

### C-2 🔴 `ParserTest.vue` 自带 125 行内联 `<style lang="scss" scoped>`,**不 `@import` `parser-styles.scss`**
块范围 `:245-369`(协调者实测:`<template>` `:1-152` · `<script>` `:154-243` · `<style>` `:245-369`)。
→ 本期 scss 实际 ≈ **74 + 125 = 199 行**,不是提示词表里那个 74。
→ 两份里有**重名重复定义**(`.page-header` / `.card` / `.toggle` / `.empty` / `.hint` / `.row` / `.checkbox` / `h2` / `h3` …)。
  Vue2 靠 `scoped` 各自隔离,**声明未必逐字相同**。你要**逐个重名类做两份声明的 diff**,
  在附录 B/D 里给出「哪些真的同、哪些不同」——**不同就必须两页各自作用域,不许合并成一份**(合并 = 界面不 1:1)。

### C-3 🔴 两份 scss 全用**裸全局类名**,New-UI 全局 scss 必须重新收口
裸名清单(协调者初扫,你要补全):`.card` `.row` `.path` `.error` `.empty` `.toggle` `.hint` `.warn`
`.param` `.score` `.dot` `.radio` `.checkbox` `.small` `.page-header` 以及元素选择器 `h2` `h3` `p` `li` `pre` `code` `em` `input` `strong`。
→ **K9 同族偏离**:必须嵌套进容器作用域。**收口方案由你定死并给依据**,至少要回答:
  1. 用什么容器?蓝本页面根已有 `.parser-status-page` / `.parser-test-page` 两个类 —— 直接拿它们当作用域根是最小改动。
  2. 但这两页**不在 `KnowledgeLayout` 下**(路由 `/ai/parser`、`/ai/parser/test` 是顶层路由,见 `knowledgeRoutes.ts:62-63`)
     → **拿不到 `.knowledge-app` 的 token 层**。怎么给它们 token?两条路:
     (a) 页面根同时挂 `.knowledge-app`(白拿整个 token 层,但要核 `.knowledge-app` 自身有没有布局副作用 ——
         协调者实测它在 `knowledge.scss:97` / `:290` / `:1440` 有三个块,**你要逐块读完再判**);
     (b) 新建 `.parser-app` 作用域 + 自己的 token 映射层(照 D5 模具,但要复制一份 token 声明 = 双份维护)。
  3. `color-scheme` 必须由作用域自己声明并随档切换(**P2b 教训①**,上级设计 §5.4 有原文)。
  → **你给结论 + 依据,治理文件里定死。拿不准写 `NEEDS_CONTEXT`。**

### C-4 Service 仓零改动(协调者已 grep 实证,复核一遍)
`/home/nimo/NimoTech/.sp8/NimoOS-Service/src/` 里这些**都已存在**:
`ai.ts` → `parserStats`(:591)`parserState`(:596)`parserFolders`(:607)`parserJobs`(:612)`parserControl`(:617)
`parserTestAnalyze`(:673,**包里已带 multipart 头 + 单独 120s 超时**,注释写明「与 Vue2 `ParserTest.vue:207-219` 逐字对齐」)·
`notes.ts` → `getSettings`(:252)`putSettings`(:257)`dirInfo`(:264)· `wiki.ts` → `getCandidates`(:154)·
`folder.ts` → `getList`(:7)。
→ **结论:本期不需要跨仓 `pnpm build`、不需要消费仓 `pnpm install`。** 复核后在治理文件 §1 写死。

### C-5 🔴 取数层次(**本期最容易翻车的一点,同 P5b §4.2 那个坑**)
| 你要 mock 的 | 形状 | 依据 |
|---|---|---|
| `service.ai.parser*` | **HTTP 原样 snake_case**(= fixture 原文) | `ai.ts` 那几个方法都只 `return res.data`,零转换 |
| `service.notes.getSettings/putSettings` | **camelCase**(`notesRoot` / `autoExtract`) | `notes.ts:252-262` 走 `normalizeSettings(res.data)`;**HTTP 层是 `notes_root` / `auto_extract`**,协调者实测 |
| `service.notes.dirInfo` | `{ exists: boolean, empty: boolean }`(包里 `!!` 归一) | `notes.ts:264-267` |
| `service.folder.getList` | **`unwrap()` 后的单层**(`folder.ts:7-10`) | 🔴 **蓝本 `FolderBrowser.vue` 写的是 `r.data && r.data.data && r.data.data.content`(三层)** → New-UI 单层取 `.content`。**K1 同族偏离,要申报** |
| `service.wiki.getCandidates` | 已归一化数组 | `wiki.ts:154` |
→ **「同一方法在两个测试文件里被 mock 成不同形状」= red flag。** 你要把 `FolderListing` 的真实字段名
(`src/types.ts:32`)读出来写进附录,**别按 `is_dir` / `name` / `path` 推定** —— 蓝本 `folderBrowser.js:5-7`
过滤的是 `e.is_dir` 且 `!e.name.startsWith('.')`,你要核 New-UI 那个类型里到底叫什么。

### C-6 KIcon 10 个 glyph 全在(`KIcon.vue` 继续零改动)
`play pause folder upload danger x arrowRight check test chev` —— 协调者逐个 grep `^\s+<name>:` 命中。
`FolderBrowser` 另用 `drive` / `chev` / `folder`,也在。
→ **不许往 `KIcon.vue` 里加 glyph,也不许退回 `AgentIcon`(K4)。** 复核一遍 12 个全在。

### C-7 New-UI 现状:哪些类已有 / 哪些要新搬
协调者对 `src/ai/styles/knowledge.scss`(**1623 行**)逐类 grep 的结果:

**已在**(不许重复定义):`.k-modal-bg` `.k-modal` `.k-modal-foot` `.kn-badge`(含 `[data-s=draft|archived|curated|failed]` 四档)
`.k-btn`(含 `&.ghost/.outline/.primary/.danger/:disabled`)`.k-view` `.k-scroll` `.k-scroll-inner`

**要本期搬**(蓝本行号是协调者初核,**你要逐个打开核准**):
- **K17 兑现**:`.k-modal-head`(:1317)`.k-modal-title`(:1321)`.k-modal-x`(:1322)`.k-modal-body`(:1330)
  —— 交接项 #2 说 P5b 未搬,协调者复核确认:`knowledge.scss:811-813` 只有**注释**提到它们,真选择器 0 处 ✅
- 设置页整段:`.k-set-card`(:1142)`.k-set-row`(:1159)`-row-info`(:1166)`-row-title`(:1167)`-row-cn`(:1168)
  `-row-desc`(:1169,**内含 `.warn` 嵌套**)`.k-radio-group`(:1181)`.k-sw`(:1203)`.k-set-svc`(:1227)
  `.k-svc-state`(:1231)`.k-svc-light`(:1235)`.k-svc-name`(:1246)`.k-svc-cn`(:1247)`.k-set-danger`(:1249)
  `.k-set-soon`(:1254)`.k-sandbox-link`(:1267)`.k-sandbox-icon`(:1284)
- `.k-section`(:970)`-head`(:971)`-title`(:975)`-hint`(:981) —— **不含 `-body`(:985)**,见 §2.2
- `kn-*` 段(**顶层裸选择器,K9 要嵌套**):`.kn-picked`(:2251)`.kn-pick-actions`(:2253)`.kn-pick-note`(:2254)
  `.kn-mig-path`(:2255)`.kn-mig-req`(:2260,含 `li`)`.kn-checkline`(:2262,含 `input`)
- **`.fb-*` 段**:蓝本在 `FolderBrowser.vue` 自己的 `<style scoped>` 里,**不在 `knowledge.scss`**
  → 落到哪个 scss 文件、用什么作用域,你定死

**设置页段里的色字面量**(协调者初扫,你要逐行补全并进附录 B):
`.k-sw::after` 的 `background: white` + `box-shadow ... rgba(0,0,0,0.18)` · `.k-svc-light` 的 `rgba(52,199,89,0.18)`
与 `[data-state=paused]` 的 `rgba(255,149,0,0.2)` · `.k-set-danger` 的 `rgba(255,59,48,0.3)` / `rgba(255,59,48,0.04)` ·
`.k-sandbox-icon` 的 `linear-gradient(135deg, #5AC8FA, #007AFF)` + `color: white` + `rgba(255,255,255,0.2)`
→ ⚠️ **`.k-sandbox-icon` 那条渐变要特别对待**:P5a 有没有同族先例(仪表盘卡片图标渐变)?
  有 → 照先例;没有 → **写 `NEEDS_CONTEXT` 问协调者,不许自己发明 `color-mix` 比例**(P5a T11 R9 教训)。

### C-8 弹窗要转 reka(K7 同族偏离)
蓝本 `SettingsView.vue:126-160` 的迁移确认弹窗是**裸 `.k-modal-bg` + `@click="closeMigrate"` + `@click.stop`**,
不是 reka。治理「弹窗一律 reka 原语 + `DialogPortal` 的 `to` 指向知识库容器」→ **本期要转**,申报三件套。
连带交接项 #4:**`DialogPortal to=".knowledge-app"` 只认第一个同名宿主 → 写弹窗测试要自己在 body 备宿主**,
先例 `src/ai/knowledge/views/QueueView.test.ts:127-130` 的 `withHost()`。
🔴 但注意 §C-3:**这个弹窗在 SettingsView 里(在 `.knowledge-app` 下,没问题);
若 Parser 两页也需要 portal 宿主,`to` 指哪里是 C-3 收口方案的一部分。**

### C-9 路由与占位反转(三处,**行号协调者已核**)
- `src/ai/knowledge/deferred.ts`:`DEFERRED_TABS` 现 6 项 → 摘 `'settings'` → **5 项**
- `src/ai/knowledge/knowledgeRoutes.ts:59` `{ path: 'settings', … component: KnowledgeDeferred }` → 真 `SettingsView`
- `knowledgeRoutes.ts:62` `/ai/parser` → 真 `ParserStatus`;`:63` `/ai/parser/test` → 真 `ParserTest`
  🔴 **这两条是顶层路由、不是 rail 项**(不在 `DEFERRED_TABS` 里,不用摘)
→ `knowledgeRoutes.test.ts` 里那条「其余子路由仍是 `KnowledgeDeferred`」的断言 **反转,不删**;改前原文留成注释 +
  写清为什么(先例:该文件 `:26-63`,以及 P5b T5/T10 的两次同款操作)。

### C-10 后端实测(协调者 **2026-08-03** 直连抓的,**数字会漂,你要现测重抓并写进 fixture README**)
```bash
P=http://127.0.0.1:8283/v1/parser ; A=http://127.0.0.1:8282/agent ; H='X-User-Id: 1'
```
| 端点 | 协调者实测结果 |
|---|---|
| `GET $P/control/state` | `{"paused":true,"concurrency":2,"device":"auto","ocr_enabled":false,"resolved_device":"cpu"}` —— 🔴 **设备当前是暂停态** |
| `GET $P/stats` | `queue_depth {pending:339,running:1,failed:0,done:9}` · `indexed_files:7` · `total_vectors_text:5592` · `models[2]` |
| `GET $P/folders/pending?limit=20` | `{"folders":[20 项],"total_groups":N}` —— **`total_groups` 字段确实存在**;路径全是 `/DATA/.system_data/…` 超长(可验省略号) |
| `GET $P/jobs?status=failed&limit=5` | `{"jobs":[]}` —— **失败桶为空** |
| `GET -H "$H" $A/notes/settings` | `{"notes_root":"/DATA/Notes","auto_extract":true,"distill_roots":[],"distill_daily_cap":50,"background_model":""}` |
| `GET -H "$H" $A/notes/dir-info?path=/DATA/Notes` | `{"exists":true,"empty":false}` → 选它只能「仅指向」 |
| `GET http://127.0.0.1/v1/wiki/candidates` | `[]` → `pickerRoots([])` 走兜底三根:`System (/DATA)` / `/media` / `/mnt` |

🔴 **路径映射(协调者已读 NimoOS-AI 源码核实,你复核)**:蓝本/包打的是 `/ai/parser/{state,folders,control}`,
NimoOS-AI 在 `route/v2/parser_proxy.go` 里翻译成 Parser 的 `/v1/parser/control/state`、`/v1/parser/folders/pending`、
以及 `control` 的五个分身(`/control/{pause,resume,concurrency,device,ocr}`),**返回是 `c.Blob` 纯透传**
→ **直连 `:8283` 抓的 fixture 就是包返回的东西,一字不改。**(`route/v2.go:153-155` 注册,`parser_proxy.go:59-140` 实现。)

**你还要现抓的(协调者没抓)**:
- `GET $P/files` 之类本期用不到的**不要抓**
- 🔴 **`POST $P/test/analyze`** —— ParserTest 的唯一写…其实是**只读沙盒**(蓝本文案明写「Will not write to index」)。
  用一个**几十字节的临时 `.md`** 真跑一次,把成功响应体落盘(要含 `chunk_count` `size` `mime` `params_used`
  `chunks[]{chunk_no,token_count,offset_start,offset_end,text,dense_preview,sparse_top_terms}` `scored[]` `docling_markdown` `rerank_error` 这些**模板真读到的字段**)。
  再各抓一条**失败**响应(如超 30MB 由前端拦不发请求 → 抓不到;可试参数越界/空文件,拿到 `{"detail": …}` 形状)。
  ⚠️ Parser 现在是 **paused**,记忆里的口径是「paused 只是不自动索引,查询/embed 仍可用」——
  **实测为准**;若 analyze 在 paused 下不可用,如实登记「本期 ParserTest 真机验不了,只能 mock」。
  ⚠️ **别传 PDF**(会触发 ~200MB 模型首次下载)。
- `GET http://127.0.0.1/v1/folder?path=/DATA` —— FolderBrowser 的目录列表(**注意这条走网关、要不要 JWT 自己试**),
  落盘真响应体,**核清 `content[]` 每项的真实字段名**(`is_dir`?`name`?`path`?)。

---

## 4. 附录 A(i18n)的要求

- 新键前缀 **`aiKb*`**(设置页)。Parser 两页的键前缀你定 —— 但要**先 grep 现有 `aiKb*` 96+100 个键确认零重名**
  (重复属性 = TS 错误),并在治理文件里写死前缀规则。
- **zh 值一律以 `git show main:src/assets/lang/zh_CN.json` 为权威**,逐字照抄,**不许自己翻译、不许改标点**。
  语言包里没有的,才算「本期新造」,要单独列并说明。
- 🔴 **P5b 的 E-1 教训**:计划书自拟过 6 条 zh 值,回源发现语言包里 6 条全都有、其中 3 条与自拟值不同。
  **你没有计划书,但同样的坑在于「凭英文原串猜中文」。逐条 grep 语言包。**
- 🔴 **P5b 的 E-2/K20 教训**:蓝本里 `$t()` 传**非字面量**的地方,抽取脚本扫不到。
  本期要**逐处手工排查动态 `$t()`**,协调者已看到至少这些:
  - `ParserStatus.vue` 的 `[$t('Power-saving'), $t('Balanced'), $t('Full power')][[1,2,4].indexOf(n)]`(数组下标取值)
  - `ParserStatus.vue` 的 `deviceOptions` computed 里 `label: this.$t('Auto')`(script 里,不在模板)
  - `SettingsView.vue` 的 `deviceLabel` computed:`this.$t('Auto (currently {r})', {r})`(带占位符,script 里)
  - `FolderBrowser.vue` 的 `crumbsFor(this.current, this.$t('Volumes'))`(参数传 i18n)、`this.$t('Failed to load folders')`
  **全部要进附录 A。漏一条页面上就坏一行。**
- 🔴 **模板里的 emoji / 特殊符号是文案的一部分,逐字照抄**:`⏸ Paused` / `✅ Running` / `📝` / `🧪` / `⚠️` /
  `▶ ` / `⏸ ` / `▼` / `▶` / `⏳` / `🔄` / `✅` / `❌` / `📦` / `📍` / `←` / `✓` / `⚠` / `×` / `›` / `—` / `…`。
  注意有些在 `$t()` **里面**(`$t('⏸ Paused')`)、有些在**外面**(`🧪 {{ $t('Test sandbox') }}`)—— **位置不许挪**。
- 新键**同时**进 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`(`parity.test.ts` 会红)。
- 🔴 **必须给出程序化逐码点比对脚本**(P5a T8 教训:附录表本身零差异,手抄进 TS 时引入 5 处全角标点错)。
  先例:`.superpowers/sdd/p5b-task-1-i18n-verify.mjs`,照它写 `p5c-task-1-i18n-verify.mjs`。
- `messageSyntax.test.ts` 的两条守卫**只圈本批新键**,不许全量生效。附录 A 要给:
  (a) 全角标点例外清单(用正则 `/[，；：？！（）]/` **实扫**最终 zh 值得出,不许凭理由列);
  (b) 带占位符的键清单 + 两档占位符名称集合一致性核查;
  (c) 「exactly N keys」防漂移断言的 N。
- 死键(判定不入语言包的)单列并说明理由。

---

## 5. 附录 B(色字面量)的要求 —— **本期重头**

**范围 = 三处来源,一处都不许漏:**
1. `parser-styles.scss`(74 行)
2. `ParserTest.vue:245-369` 的内联 `<style>`(125 行)
3. `FolderBrowser.vue` 的 `<style scoped>`
4. `knowledge.scss` 里本期要搬的那些段(设置页段 + `kn-*` 段 + `.k-modal-head/-body` 段 + `.k-section*` 四类)
5. 🔴 **模板 `style="…"` / `:style="…"` / `color="…"` 属性**(**P5b E-11 就是这一类漏掉的**,
   `color-guard.test.ts` 的 `styleLines()` 对 `.vue` 只取 `<style>` 块 → 模板内联零扫描)。
   协调者初扫看到 `SettingsView.vue` 至少有:`style="border-top: 1px dashed var(--line)"`、
   `color="var(--warning)"`、`style="color: var(--danger)"`、`style="color: var(--text-tertiary)"`
   —— 这些**已经是 `var()`,不是字面量**,但你要**逐行复扫两个 Parser 页 + FolderBrowser + SettingsView 的全部
   `style=` / `:style=` / `color=`**,把真字面量找出来。

**每一处给一行**:`蓝本 file:line` → 原字面量 → 建议 token → **依据**(哪个文件哪一行定义了这个 token,值是什么,
为什么这是「语义最接近」)。

**硬规则:**
- 🔴 **优先复用既有 token,尽量不新造。** 要新造 → 单列一张「新造 token 表」,每个给暗档值 + 浅档值 + 值的出处;
  **凭空造的值必须写明「全仓无源,本期新造」并附派生规则**(参考 P5b `--danger-hover` 那条)。
- 🔴 **`white` / `black` 具名色也算字面量**;`transparent` 是关键字不算(P5a T11 已定口径)。
- token 声明层豁免:只有 `.knowledge-app { --… }` 与 `:root[data-theme="light"] .knowledge-app { --… }`
  两个块内允许字面量,**块外全文零字面量,注释里也不许有**(R5:注释改写「蓝本行号 + 中文描述」)。
- ⚠️ **`color-guard.test.ts` 不扫 `.scss`** → 新增的 scss 只有 `knowledgeStyles.test.ts` + 人肉评审两道防线。
  你要在治理文件里**点名要求 scss 任务的评审逐行色扫**。
- 🔴 **落笔前 grep 重名**:新类名与 `agent-styles.scss` / `settings-styles.scss` / `skills-styles.scss` /
  `sk-shared.scss` / `knowledge.scss` 零重名。**本期风险最高**(裸名 `.card` `.row` `.error` 之类),
  你要把重名扫描结果写进附录 D。

---

## 6. 附录 D(CSS 类)的要求

- 白名单从 **187** 扩到几?给准确数字 + 常量改名(`WHITELIST_187` → `WHITELIST_N`)。**协调者不给这个数,你实测。**
- 🔴 **交接项 #5 要一并办**:`knowledgeStyles.test.ts` 的「模板零裸色」守卫靠
  「`</template>` 在第 0 列」这个**脆弱隐式锚定**,两个既有文件各有 7/12 个嵌套 `<template>`。
  **本期加第三/第四/第五个视图,必须改成贪婪匹配 + 覆盖度自检**,别再复制那个正则。
  改法要配 **RED 探针**(证明改完仍能报红、且覆盖到文件最后一行)。
- 🔴 **「没有搬多」的扫描正则**:现在是 `/\.k(?:2|n)?-[a-z0-9-]+/g`。本期要搬 `.fb-*` 以及一堆裸名
  → **正则要扩到能扫到它们**,否则多搬了没人抓。扩正则 = 扫描范围变大,不是放宽断言,**要配 RED 探针**。
- **蓝本自己没定义的类**(N10/N13 同族)要用「模板抽类 ∖ (白名单 ∪ 已搬 ∪ 元素选择器)」**差集扫描**找出来,
  一律**类名照抄、不进白名单、不许为它凭空写规则**。
- `@keyframes` 存在性守卫:本期新增哪些?`.k-sw` 的 transition 不是 keyframes;
  但 `.k-modal-pop` 已在,**不要重复定义**。

---

## 7. 测试门(本任务自己也要过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5c-t0-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5c-t0-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5c-t0-build.log 2>&1; echo "exit=$?"
```
- **全量,不许只跑 `src/ai/` 子集**;**输出完整落盘,不许 `| tail`**(P2b 教训:红项用例名被截掉永久丢失)。
- 🔴 **起点基线**:提示词给的是 **319 文件 / 3153 例全绿 · tsc 0 · build 0**(沿用 08-02 口径)。
  **协调者正在并行实测一次;你也测一次,两边不一致就以实测为准并登记。**
- 本任务零产品代码改动 → 三门应与基线**逐字相同**。若有差异,停下查。
- 已知噪声(只它们红就复跑一次并说明,不要顺手改):
  `src/files/upload/persist.test.ts > dropPersisted removes record + blob and frees budget`(IndexedDB flaky)·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。

**治理文件里还要给下游算术**:本批新增几个 `.vue`(`color-guard.test.ts` 按 `**/*.vue` 动态生成 → **每新增一个 `.vue` 全量 +1 例**)、
新增几个测试文件 → 收官应是几文件几例。

---

## 8. 顺手要办的交接项(P5b 交下来的,**本期兑现**)

| # | 事 | 要求 |
|---|---|---|
| 1 | **K17 四个 `.k-modal-*` 类**(`knowledge.scss:1317-1334`)本期搬 | 同步扩白名单 |
| 2 | 🔴 **`knowledgeStore.parser.test.ts:85` 的 `parserDeleteJob` mock 从 `{}` 改 `''`** | 权威口径是 204 空体(P5b 治理 §4.1 有 axios 源码依据)。**P5b 授权外,挂到本期。** 由你在治理文件里指定归到哪个任务 |
| 3 | **`DialogPortal to=".knowledge-app"` 只认第一个同名宿主** | 写弹窗测试自己在 body 备宿主,先例 `QueueView.test.ts:127-130` 的 `withHost()` |
| 4 | **模板零裸色守卫的脆弱锚定** | 见 §6,本期必改 |
| 5 | **DM9** `indexedFilesView.test.ts:128-139` 用例名过度声明 | 顺手修,或明确挂账 |
| 6 | 🔴 **`DashboardView.vue` 的【N3】fail-fast 注释论证在当前代码下不成立** | 三个 loader 各自 try/catch 吞错 → 没有一个会 reject → `Promise.all` ≡ `allSettled`。**若本期要碰 `onMounted` 或 `loadRoots`,先读 `p5b-progress.md` 验收第 1 轮的发现 3。概览页 60 秒骨架 D1 拍板不修,别顺手改。** `DashboardView.vue` / `KnowledgeLayout.vue` / `KIcon.vue` 继续**全期零改动** |
| 7 | `loadRoots(opts?: {silent?})` | 只有后台预取传 `silent`,用户主动路径不传 |
| 8 | **后端票**:`parserClearFailedJobs` / `parserDeleteJob` 的 404/409 响应体**仍是源码推定未实测** | 本期若不依赖这些形状,登记「不依赖」即可,别为它编 fixture |

---

## 9. 验收清单纪律(**要写进治理文件,下游与协调者都受约束**)

P5b 验收第 1 轮新得的两条,**逐字进治理文件**:

1. 🔴 **凡「点某个东西」的项,必须先确认该元素在本机数据下真的渲染成可点元素。**
   `v-if="x > 0"` 这类数据依赖的可点性是高发区 —— P5b 的 B18 就是把 `failed===0` 时根本不是按钮的磁贴
   当成可验项,用户白找一轮。
   🔴 **本期已知的高危点**(你要在治理文件里点名):
   - Parser 详情页失败卡 `v-show="failedOpen" v-if="store.state.failedJobs.length"` —— **本机 `failed:[]`**
     → 展开按钮**能点**(它无条件渲染,文案「最近失败 (0)」),但**展开后列表整个不渲染**。
   - Parser 详情页文件夹卡 `v-if="!folders.length"` 空态 vs `v-else` 列表 —— 本机有 20 组,走 `v-else`。
   - 设置页「搬文件到新目录…」按钮 `:disabled="!rootPicker.path || (dirProbe.state==='done' && !dirProbe.migratable)"`
     —— 选 `/DATA/Notes`(非空)时**是灰的**,要找空目录才能点。
   - 设置页「重建全部索引」按钮**硬编码 `disabled`**(蓝本如此),永远不可点。
2. **具体计数有保质期**(设备后台索引一直在跑)。写「**实测于 2026-08-03,数字会漂,以下列命令现测为准**」
   + 附取数命令,**别钉死数字**。

---

## 10. 报告契约

完整报告写 `.superpowers/sdd/p5c-task-0-report.md`(`git add -f`),至少含:
- 四份交付物各自的产出摘要 + 关键决定
- 🔴 **勘误节**:本 brief 的 C-1 ~ C-10 逐条「复核结论」(✅ 成立 / ❌ 错在哪 / ⚠️ 部分对),
  **核出错的一律登记编号(E-1、E-2 …)**,并写「brief 原文 / 权威源实际 / 处置」三列
- 🔴 **C-3(Parser 两页的作用域与 token 收口)的结论 + 完整依据链** —— 这是本期最大的架构决定
- 抓了哪些 fixture、每份的原始 curl、关键形状备注
- 三门完整终值(`Test Files` / `Tests` 两行 + 任何红项完整用例名)
- `git show --stat HEAD` + `git status` 自查输出
- 拿不准的一律 `NEEDS_CONTEXT` 列出来,**不要自己拍**

返回给协调者 **≤15 行**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)· 提交 sha ·
一行三门结果 · **核出几处错** · C-3 的结论一句话 · 顾虑。

---

## 11. 最后一条(最重要)

**权威优先级:治理文件(P5a/P5b)+ 附录 > 本 brief。**
P5b 的 T10 就是按这条**否决了协调者的任务书**并回 Vue 源码自证正确 —— 那是被表扬的行为,不是越权。
**本 brief 里任何与 P5a/P5b 治理文件冲突的地方,以治理文件为准,并在报告里指出来。**
