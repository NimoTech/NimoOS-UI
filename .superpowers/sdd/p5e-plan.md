# SP8-P5e 计划书 —— 知识库**搜索区**迁移(`SearchView` + `FileDetailDrawer` + `KFileViewer` + `searchAggregate`)

**权威优先级:`p5e-coordinator-rulings-T0.md`(T0 后产出)> `p5e-common-constraints.md` + 附录 A/B/D > 本计划书 > 任务 brief。**

| | |
|---|---|
| 可写仓 | `.sp8/NimoOS-New-UI` @ `sp8-ai`,起点 **`cbcebf9`**(P5d 关账;T0 自己 `git log` 现测确认) |
| 蓝本锁 | `NimoOS-UI` @ **`7a6ee6b7`**(P5 全期不换,用户 2026-08-04 拍板)· 一律 `git show 7a6ee6b7:<path>` 读 |
| 验收 | dev server **`:5288`**(pid 1159107,已在监听,服务 `.sp8` 工作树)· 🔴 **禁 `deploy.sh`** |
| 禁令 | **禁部署 · 禁 push · 禁合 master** · Service 仓**零改动** · **零新依赖** |
| 三门起点 | `Test Files 331 passed (331)` / `Tests 3958 passed (3958)` / `vue-tsc` 0 / `vite build` 0(**T0 自己重跑确认**) |
| 车道 | **单车道 T0 → T9(10 刀)**,每刀 = 一个实现者 subagent + 一个**独立**评审 subagent |

---

## 0. 本期体量与已知坑(协调者 2026-08-05 实测)

### 0.1 蓝本体量

| 蓝本文件 | 行数 | 落点 |
|---|---|---|
| `views/AI/Knowledge/SearchView.vue` | **401** | `src/ai/knowledge/views/SearchView.vue` |
| `views/AI/Knowledge/components/FileDetailDrawer.vue` | **220** | `src/ai/knowledge/components/FileDetailDrawer.vue` |
| `views/AI/Knowledge/components/KFileViewer.vue` | **120**(其中 `<style>` 51 行) | `src/ai/knowledge/components/KFileViewer.vue` |
| `views/AI/Knowledge/searchAggregate.js` | **79** | `src/ai/knowledge/util/searchAggregate.ts` |
| **`styles/knowledge.scss`** 的两段 | 🔴 **kickoff 漏算(E-50)** —— Search page 段(约 `:457-733`,**扣掉已搬的 `.k-seg`/`.k-empty*`/`.k-skel`**)+ `:1540-1674`(match pill + detail drawer,扣掉已搬的 `.k-btn.text`)+ KFileViewer 的 51 行 → **初估 300-400 行,T0 给终值** | `src/ai/styles/knowledge.scss` |
| **合计** | **≈ 820 + scss** | |

Vue2 既有 spec 要承接 **2 份**:`searchAggregate.spec.js`(2 例)· `fileDetailDrawerDistill.spec.js`(1 例,**测法必须改**,见 N43)。
🔴 **`notesMapper.spec.js` 不在本期**(治理 §0.4 / 勘误 E-49,转独立票)。

### 0.2 🔴 本期五个最容易翻车的点(每一刀的 brief 都要带)

1. **K46 —— `KFileViewer` 的 `::v-deep` 补丁不许照搬,但 `.k-fileviewer-host` 的 `fixed` 必须保留。**
   蓝本那三条 `::v-deep` 是补 **Vue2** viewer 依赖 `.file-panel .modal-card .overlay` 祖先链的;
   本仓 `DocViewer`/`ExcelViewer` **自带 `ViewerShell`**、不渲染那三个类。
   但 `ViewerShell.vue:24` 是 **`position: absolute; inset: 0`** → **需要 host 提供铺满视口的定位祖先**。
   **照搬 = 复制不存在的问题;顺手清理 host 的 fixed = 预览器塌进文档流。两个方向都是 bug。**
2. **K50 —— 文件字节流必须走 `getHttp().get('/v3/file', {responseType:'blob'})`。**
   用 `service.file.getBytes()` 会丢 Content-Type(新标签页变下载);
   用 `service.file.fileUrl()` 会把 token 拼进 URL(**蓝本注释 `:346-350` 明令要避免**)。
   **两种错法都不会让三门变红,只在真机上错。**
3. **`mtimeMs` 是毫秒 —— 与 P5d 的 `relativeTime(unixSec)` 是秒完全相反。**
   喂错单位静默产出 1970 年。**两侧都要用例**(承 P5d-T3 的秒↔毫秒探针教训)。
4. **§6.2 的「半搬」类**:`.k-suggest-chip` 只有一条后代覆盖(`knowledge.scss:2198`)、**基类缺失**;
   `.k-skel-rcard` / `.k-hero-suggest` 完全未搬。**搬错顺序会让级联反掉、而三门全绿。**
5. **K49 的三处 `v-html`** 是本期唯一 XSS 面。`highlight()` 先 escape 再插 `<mark>`,
   **删掉 escape 那步三门不会红** —— 必须有注入用例 + RED 探针。

### 0.3 P5d 交下来的债务票,本期怎么落

| 票 | 裁定 | 刀 |
|---|---|---|
| **D-3** 全表键数快照跨期陷阱 | 改**下限断言**留原地(治理 §0.1) | **T1** |
| **D-9** `aiCfgKnowledgeSoon` 死键 | **删键**,两档同步(治理 §0.2) | **T1** |
| **D-5 + D-7 + §0.3 位置③④** 四个颜色守卫缺口 | **合并一刀**,范围钉死(治理 §0.3) | **T4** |
| **M-4** `knowledgeStyles.test.ts:399` 用例名过宽 | 顺手改准标题 | **T2** |
| **M-5** `knowledgeRoutes.ts:49-51` 现在时注释 | 顺手订正 | **T9** |
| **D-4** 68 条键值只有存在性断言 | **本期不改**(全仓策略题),但本期新键照同一模式、T1 报告要写清条数 | — |
| `openNoteInNewTab` / A-8 票 / 票 3c / 票 3e / `AllowlistView` | **继续挂账** | — |
| 🔴 **新开独立票** | Agent 语义搜索卡补 `notes` 分组 | **不在本期** |

---

## 1. 十刀(T0 → T9)

> **每刀通用 DoD**(不再逐刀重复):三门全绿并落盘完整日志 · 报告按治理 §10 写全并 `git add -f` ·
> 命中的 K/N 条目逐条显式申报 · 🔴 **每条「守卫/断言」类 DoD 都要配 RED 探针**
> (`cp` → 行首锚定注入 → 先证注入落盘 → 报红 → `cp` 还原 → `md5sum` 逐字节比对;**禁 `git checkout/restore/stash`**)·
> 🔴 **带 🔴 的「复跑/复扫/独立复核」项不许采信上一刀的结论,要跳过必须先停下写 `NEEDS_CONTEXT`**。

### T0 —— 探测 + 三份附录 + fixtures(**不碰 `src/`**)

**产出**:`p5e-appendix-A-i18n.md` · `p5e-appendix-B-tokens.md` · `p5e-appendix-D-classes.md` ·
`p5e-fixtures/`(含 `README.md`)· `p5e-task-0-report.md`。

**DoD**

1. 🔴 **SSH fetch 真远端**(`git fetch git@github.com:NimoTech/NimoOS-UI.git main`)+ 逐个比对本期 5 个蓝本文件,
   把「远端 sha + 比对结果 + 本期锁 `7a6ee6b7`」写进报告。**比出非注释的功能性差异 → 停下问用户。**
2. 🔴 **三门起点基线自己重跑**(不许照抄 P5d 的 331/3958),并核 `.vue` 总数 = 182、
   `color-guard` 当前用例数 = 184。
3. **附录 A**:i18n 全表。distinct 串终值(协调者初测 ≈ 63,含 `MTIMES` 4 + `SAMPLE_QUERIES` 5)·
   逐条 zh 值(权威 = `zh_CN.json`)· 逐条 en 值(🔴 **权威 = `en_US.json` 的覆盖值**,承 E-31/R10)·
   复用判定表(只认 `aiKb*` 家族)· 全角标点例外实扫清单 · 占位符清单(含**唯一的双占位符键** `{n}`+`{query}`)·
   🔴 **双向撞车扫描表**(zh 撞车看 en / en 撞车看 zh),协调者已点名 14 个高危同值(治理 §7.1)。
   🔴 **`FILE_TYPES` 的 5 个 label 蓝本没过 `$t()` → 明确写「不进 i18n」。**
4. **附录 B**:色值映射表。逐处列「蓝本 `file:line` → 字面量 → 本仓 token(既有 / 新建)」。
   🔴 **`.k-rcard-tag` 5 个 `data-kind` 实底 + `.k-rel` 3 组 `rgba` 底 + 3 个实字色 + `KFileViewer` 的 `#fff`**
   逐个定死,**实现者不许自选**。新建 token 必须两档都给值。
   🔴 **`--on-accent` 的坑**:`.k-rcard-tag` 上的文字色若压在实底渐变上,附录 B 里定死用哪个
   (记忆:`--on-accent` 只在 accent 实底上可用)。
   🔴 **`#1a1a1a`(MD 黑底)在暗色档的取值单独标注**,进验收拍板项。
5. **附录 D**:CSS 类清单。🔴 **必须是「已搬 / 未搬 / 半搬」三态表,逐个类**,不许只给总数(承 E-39)。
   半搬的要写清既存覆盖在哪一行、搬进去后级联怎么走。
   另含:`WHITELIST_293` / `NON_K_HELPER_CLASSES(16)` 的**本期终值 + 算式 + 复现命令**
   (🔴 **以程序化实测为准**;`p5d-gen-r8r9-sim.mjs` 硬编码旧常量名,要先改或对副本跑)·
   K46 的 z-index 关系(`.k-fileviewer-host` 1100 vs 蓝本 `.k-drawer-bg` 实际值)·
   本期新增的非 `k*` 类(若有)的处置。
6. 🔴 **`@vue-office` 在 jsdom 下的可测性结论**(治理 §9.12):能不能真挂 `DocViewer`;
   不能则 mock 边界画在哪(**保留 `item`/`list` props 与 `close`/`download` emit 契约形状**);
   **必须去读本仓既有先例** `panelMap.test.ts` / `useViewer.test.ts` / `useOfficeBytes.test.ts`。
   **不给结论 = 计划失败。**
7. 🔴 **K48 的等价性程序化证明**:把蓝本 `SearchView.vue:317-345` 与 `FileDetailDrawer.vue:199-217`
   两份 `highlight`/`fmtMtime`/`relLevel`/`relLabel` 各自逐字移植成两个临时函数,
   对同一批输入(含 escape 边界、多词、空 query、正则元字符)跑,**证明输出全等**。
   🔴 **若不等价 → 停下写 `NEEDS_CONTEXT`,不许自行选一份。**
8. 🔴 **fixtures 实测**(治理 §4.2):`/v1/ai/search/text`(rerank 两态)· `/v1/ai/search/chunk` ·
   `/v3/file`(带/不带 `inline=1`)· distill。**逐个落真响应体。**
   🔴 **必答的六个字段级问题**:顶层有 `files[]` 还是只有 `hits[]` · `paths[0].mtime_ms` 单位 ·
   `mime` 真实取值分布(决定 N35 的筛选是否真生效)· `cite.page` 为空时是 null 还是缺字段 ·
   `score` 量纲(决定 `relLevel` 的 0.65/0.50 在真机上分不分得开档)· `warnings` 里 `rerank_unavailable` 是否真会出现。
   🔴 **`inline=1` 后端是否真支持** —— 不支持则「打开原文件」在新标签页会变成下载,**要写进报告与验收清单**。
   🔴 **凡会写后端的探测,写清怎么恢复**(distill 会塞队列 + 可能生成 `.md`)。
   🔴 **取数不许经网关**(承 E-37 + 记忆 `gateway-no-userid-injection`),T0 实测哪条路走得通并写进 README。
9. **§9.11 可点性清单实测补全**(协调者已点名 11 项):本机 Parser 索引里到底有没有
   pdf / md / **docx|xls|xlsx|csv**(决定 `KFileViewer` 整屏可达性)/ **doc|ppt|pptx**(决定「请下载」toast);
   rerank 真机可不可用;给一个「本机必然搜不到」的词。
10. **`src/` 零改动自证**(`git diff --name-only -- src/` 为空)。

**评审第一必查项**:附录 A 的 zh/en 值有没有**自己译的**(P5d 的 C-1 就是这个,附录内部两处自相矛盾)——
要**程序化逐码点比对**附录与语言包,不许目视。

---

### T1 —— i18n 键(+ D-3 + D-9)

**改**:`src/i18n/zh_cn.ts` · `en_us.ts` · `src/i18n/messageSyntax.test.ts` ·
`src/ai/knowledge/views/SettingsView.test.ts`(**极窄:只 `:1887-1888` + 注释**)·
`src/ai/views/SettingsPage.vue`(**只 `:187` 一条注释**)。

**DoD**

1. 附录 A 的全部新键**同时**进两档,零遗漏零多余。`parity.test.ts` 绿。
2. 🔴 **跑 `p5e-task-1-i18n-verify.mjs`**(照 `p5d-task-1-i18n-verify.mjs`),
   DoD = **N/N 逐码点 MATCH** + 复用键 **M/M 未被改动**。
   🔴 **en 侧不许假设「en = JSON key」**(E-44 的 bug),权威是 `en_US.json` 覆盖值。
3. `messageSyntax.test.ts` 三条:(a) 全角标点扫描 + `toBe` 钉死的例外清单 ·
   (b) 占位符集合一致(**含唯一的双占位符键**)· (c) 「exactly N keys」防漂移。
   🔴 **占位符的反向断言不许写成「渲染结果含 `{x}` 字面量」**(E-45:vue-i18n 静默置空,零判别力)。
4. 🔴 **自己重跑双向撞车扫描**(不许采信 T0 的表)+ 用**真实模块导入**计全表键数。
   扫出协调者不知道的撞车对 → 照 N21 登记,en 档配正/反向断言。
5. 🔴 **D-3 落地**(治理 §0.1):`toHaveLength(1595)` ×2 → `toBeGreaterThanOrEqual(<实测值>)`;
   旧两行留成注释、引条目编号不引行号;**RED 探针 = 删 3 个 zh 键 → 必须报红**;
   🔴 **`SettingsView.test.ts` 其余一字未动的 `git diff` 逐行自证。**
6. 🔴 **D-9 落地**(治理 §0.2):两档各删 `aiCfgKnowledgeSoon`;`SettingsPage.vue:187` 注释补一句;
   自证 `grep -rw aiCfgKnowledgeSoon src/` 改后**只命中那条注释**。
7. **报告列清**「复用 X / 新增 N / Vue2 有权威 zh 值 M / 本期新造 K / 死键 0(**或列出并说明**)」
   + **D-4 口径**:本期 N 条里有几条只有存在性断言。

**评审第一必查项**:🔴 **变异测试** —— 任选 3 个新键,各改坏一个字符/一个占位符名,证明有断言报红;
并**独立复跑**双向撞车扫描 + 全表键数。**D-3 / D-9 的越权核查**(两个文件都在零改动清单上,逐行核额度)。

---

### T2 —— `knowledge.scss`(**本期最大的一刀**)+ M-4

**改**:`src/ai/styles/knowledge.scss` · `src/ai/styles/knowledgeStyles.test.ts`。**产品 `.vue` 零改动。**

**DoD**

1. 按附录 D 的三态表**逐段搬**:Search page 段 + `:1540-1674` 段 + KFileViewer 的 `<style>` 内容(K44 落点惯例)。
   🔴 **一律嵌进 `.knowledge-app`**(K9);若某段必须顶层 → **走 K44 的具名例外机制**
   (`knowledgeStyles.test.ts` 那条「顶层裸选择器集合恰等于 `['.nme-content .ProseMirror']`」的
   **集合相等**断言要加成员,**不是放宽正则**)。
2. 🔴 **不许重复搬**(治理 §6.2):`.k-seg`(K43)· `.k-btn.text`(K45)· `.k-empty*` · `.k-skel` 基类 ·
   `.k-modal-x` · `.k-row-action` · `.k-scroll` · `.k-btn`。
   ⚠️ `knowledgeStyles.test.ts` 有一条锚定在 `.k-btn { … }` 区间内的「`&.text` 恰好 2 次」计数断言,
   重复搬 `.k-btn.text` 会报红 —— **这是有意的**。
3. 🔴 **必搬的三个「半搬/未搬」**:`.k-skel-rcard` · **`.k-hero-suggest`** ·
   **`.k-suggest-chip` 基类**(要搬在 `:2198` 那条 `.k2-suggest .k-suggest-chip` 覆盖**之前**,蓝本源序)。
   🔴 **必配一条断言钉住基类与那条覆盖的相对顺序**(判据:调换顺序 → 报红)。
4. 🔴 **配色**:按附录 B 逐处映射;新建 token **两档都显式写值** + 声明处注释写明蓝本 `file:line`;
   **附录 B 表里没有的一律 `NEEDS_CONTEXT`**。
   🔴 **全文色扫**:token 声明层之外,**含注释**零 hex/rgb/rgba/hsl/具名色。
5. 🔴 **K46 的 `.k-fileviewer-host` 断言**:`position: fixed` + `inset: 0` + `z-index: 1100`
   三个属性各有断言(判据:拿掉任一 → 报红),并在注释里引 `ViewerShell.vue:24` 说明为什么必须是 fixed。
   🔴 **不搬那三条 `::v-deep` 规则**,并配一条断言证明 `.overlay` / `.v-container` / `.doc-container`
   在 `knowledge.scss` 里**零出现**(判据:加回任一 → 报红)。
6. 🔴 **守卫更新**:「没有搬多」白名单(`WHITELIST_293` → 本期终值,常量名跟着数字改)·
   `NON_K_HELPER_CLASSES` 集合相等断言 · 🔴 **开工前先独立复现附录 D 给的三个数**再动手
   (兑现「不许采信上一刀结论」)。
7. **M-4 顺手修**:`knowledgeStyles.test.ts:399` 的用例名改准(只改标题,不动断言)。
8. **额外门**:`pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` exit 0。
9. 🔴 **逐段对蓝本 `git show` 比对**:结构 / 顺序 / 嵌套逐字、边界无截断、无重复定义。

**评审第一必查项**:🔴 **「半搬」那三个的级联** —— 自己读 `knowledge.scss` 确认
`.k-suggest-chip` 基类真的在覆盖之前,并**亲手调换顺序验证报红**;
另**逐行对蓝本比对**至少 3 个随机段;**自己重跑那三个数字的模拟器**(不许信报告)。

---

### T3 —— `util/searchAggregate.ts`(蓝本 79 行 + K48 抽出的 4 个函数)

**改**:新建 `src/ai/knowledge/util/searchAggregate.ts` + `searchAggregate.test.ts`。**其它零改动。**

**DoD**

1. 逐字移植 `kindFromMime` / `basename` / `dirname` / `chunkVM` / `fileVM` / `groupHits` /
   `toFileResults` / `chunkCount`(蓝本 `searchAggregate.js:5-79`)。
   🔴 **`i18n.t('(Untitled)')` → `i18n.global.t('(Untitled)')`**(不在 setup 上下文,先例
   `notesViewHelpers.ts` 的 `relativeTime`;用 `useI18n()` 会抛)。
2. 🔴 **K48**:把 `highlight` / `fmtMtime` / `relLevel` / `relLabel` 也放这里并导出。
   `relLabel` 用 `i18n.global.t`。**必须引 T0 的等价性证明**(附录 D),并在文件头注释里
   写明「蓝本在两个 `.vue` 里各有一份逐字/等价的拷贝,依据治理 K48 去重」。
3. **承接 Vue2 `searchAggregate.spec.js` 的 2 条行为**,并按本仓标准加细:
   - `kindFromMime` **六个分支各一条**(pdf / `text/markdown` / `text/x-source` / docx|pptx|xlsx / plain / 兜底 doc)
     + 空值兜底。🔴 **注意分支顺序有语义**:`includes('pdf')` 在 `=== 'text/markdown'` 之前 →
     `text/markdown+docling/pdf` 会被判成 **pdf 不是 md**。**必须有一条用例钉死这个顺序**
     (判据:调换两个分支 → 报红)。
   - `basename` / `dirname` 的边界:空串 · 无斜杠 · 尾斜杠 · 根路径 · 多重斜杠。
     🔴 `dirname('/a/b.md')` 是 **`'/a/'`**(带尾斜杠)、`dirname('b.md')` 是 **`'/'`** —— 两条都要断。
   - `chunkVM`:`cite` 缺失 · `chunk_no` 非数字(`typeof` 判断)· `page` 为 `undefined` vs `null`
     (蓝本 `cite.page != null ? … : null`,**`0` 是合法页号必须保留**)· `preview.text` 缺失 → `''`。
     🔴 **`id` 的拼法 `${fileId}:${kind}:${chunkNo}` 要逐字断**(它是 drawer 里 `activeId` 的比对键)。
   - **N45 的两件事各自独立用例**:`resp.files` 优先 · `groupHits` **保序** · `fileVM.score` 取
     `group.score || 首 chunk.score || 0` 三档。
4. 🔴 **K49 的注入用例**(在这里,不在组件里):`highlight('<script>alert(1)</script>', 'alert')` →
   断言输出含 `&lt;script&gt;`、**不含裸 `<script`**、且 `alert` 被 `<mark>` 包住;
   再来一条 `<img src=x onerror=1>`。🔴 **RED 探针:删掉 `esc` 那步 → 两条必须报红。**
   另加:正则元字符 query(`a.b*c`)不许抛、空 query 原样返回 escape 结果。
5. 🔴 **`fmtMtime` 的毫秒/时区两条**(治理 §9.13):`fmtMtime(0)` → `'—'`(蓝本 `if (!ms)`)·
   毫秒 vs 秒两侧都要用例(**判据:把 `new Date(ms)` 改成 `new Date(ms*1000)` → 必须报红**)·
   **同式比对或固定 TZ**,不许裸钉死字符串。
6. **`relLevel` / `relLabel` 的三档 + 两个边界两侧**(`0.65` 与 `0.649…`、`0.50` 与 `0.499…`)。
7. 🔴 **零 `any`。** 类型从 fixtures 的真实形状推(snake_case 入、camelCase 出)。
   包侧 `searchText`/`searchChunk` 返回 `unknown` → 按 **K41** 同款在消费侧补窄类型 + 断言式收窄,
   并在文件头登记「包侧类型 → 本仓收窄 + 字段依据(蓝本哪一行读了这个字段)」。

**评审第一必查项**:🔴 **代码膨胀逐行判定**(蓝本 79 + 两份拷贝约 45 → 产出会明显更多)——
逐行判哪些是 TS 类型/申报注释(正当)、哪些是**未申报的新逻辑 / 被「修正」的行为 / 顺手抽的抽象**。
🔴 **亲手跑三组探针**:`kindFromMime` 分支顺序 · `esc` 删除 · 毫秒→秒。

---

### T4 —— 守卫债合并刀(D-5 + D-7 + §0.3 位置③④)

**改**:`src/styles/color-guard.test.ts` · `src/ai/styles/knowledgeStyles.test.ts`。
🔴 **`src/` 下非测试文件零改动**(报告要自证)。

**DoD**

1. 🔴 **D-7**:`color-guard.test.ts` 的 `.css` 分支改 **`node:fs`**(铁律:`?raw` 恒空)
   **且同时**修 `:65` 的 `theme.css` 跳过判断(Vite 把同目录 glob key 归一成 `./theme.css`,
   `rel === 'styles/theme.css'` **从未生效**)。🔴 **两步必须同时做** —— 只改一半会从「空壳」变成「大面积误报」。
   🔴 **判据三条**:① **改前** DIAG 探针复现 `EMPTY=2 [viewers.css, ./theme.css]`(自己跑,不许信 P5d 终审)·
   ② 改后往 `viewers.css` 注入 `color: #f00` → **必须精确报红在该文件** ·
   ③ 改后 `theme.css` **仍不报红**,且**是因为跳过判断生效**而不是因为内容为空
   (证法:临时让判断失效 → theme.css 必须报红)。
   ⚠️ **若 `viewers.css` 改完就报红(既有违规)→ 停下写 `NEEDS_CONTEXT`**,不许自己改 `src/files/`。
2. 🔴 **D-5**:`.vue` 的 `<style>` 块补**具名色**扫描。复用 P5d-T5 那条「按属性值位置」的判据形态
   (只在 `color:`/`background:`/`background-color:`/`border-color:`/`border:`/`box-shadow:`/`fill:`/`stroke:` 的**值**里找)。
   🔴 **两头验**:① 注入 `color: white` → 报红 · ② **同行真实 `white-space: nowrap` → 不报红**
   (这是 P5c §6.5 已点名的假阳性坑,`QueueView.vue:474` 就有)。
   🔴 **范围只覆盖本档清单,不许扩全仓**(承 P5d-T5 的教训:扩范围会扫出别期违规 = `NEEDS_CONTEXT`)。
3. 🔴 **位置③**:`.vue` 的 `<script>` 注释里的**具名色**。R17 那条只断 hex/rgb/hsl。
   范围**只加 `KNOWLEDGE_VUE_FILES`(13)**。两头验(注入 `white`/`black` → 报红;
   引 `file:line` 的正常申报注释 → 不报红)。
4. 🔴 **位置④**:`.ts` 文件。**新建一份 `KNOWLEDGE_TS_FILES` 显式清单**(不是 glob 全仓),
   扫注释与字符串里的 hex/rgb/hsl/具名色。形态照 P5d-T3 的 K40 定向断言。
   🔴 **RED 探针**:往 `notesViewHelpers.ts` 与本期的 `searchAggregate.ts` 各注入一次 → 各自报红。
   ⚠️ **`NOTE_TYPES[*].color = 'var(--grad-note-*)'` 不许被误报**(它是 `var()`,合法)。
5. 🔴 **参数化守卫防空循环**(治理 §9.14-4):用 `--reporter=verbose` 证明
   **N 条独立用例真在执行**(不是清单读取失败、循环体一次没跑)。
6. 🔴 **重画 §9.10 的守卫地图**:四个位置 ×(hex / 具名色 / 覆盖范围),**每一格给证据**:
   ✅ 必须有 RED 探针输出,❌ 必须写清为什么这一期不补。
7. 🔴 **`color-guard` 用例数「改前 → 改后」的构成拆解**(治理 §8.1)——
   下游 T5–T9 要用新数对账,别让他们拿旧算式。
8. 🔴 **不许放宽任何既有判据。** 报告要逐条对照改前改后的正则/范围,证明每一处都是**严格超集**
   (照 P5c §6.4.1 第 1 条的做法:程序化证明 `old ⊆ new`)。
   ⚠️ **P5d-T0 的教训**:「严格超集」在现状文件上可能**零可观测**(`old 225 / new 225`)→
   **RED 探针是唯一判别力证据,不许省。**

**评审第一必查项**:🔴 **改弱排查** —— 这一刀改的是**守卫本身**,「改弱了没人看得出来」。
逐条核每个 `-` 行;**亲手把四条新守卫各注入一次**证明都有牙;
并**自己抽 2–3 个易冤枉写法**(`border-left: 1px solid var(--line)` / `background-image: url(...)` /
类名或注释含 `white`/`whitesmoke` / `grayscale()`)试探**不许误报**。

---

### T5 —— `KFileViewer.vue`

**改**:新建 `src/ai/knowledge/components/KFileViewer.vue` + `KFileViewer.test.ts` ·
`knowledgeStyles.test.ts` **+1 行**(登记新 `.vue` 进 `KNOWLEDGE_VUE_FILES`)。

**DoD**

1. 逐字移植蓝本 `:1-68`。🔴 **K44:`.vue` 侧零 `<style>` 块**(内容已由 T2 搬进 `knowledge.scss`)。
2. 🔴 **K46 三条自证**(治理 §3):① `grep` 证明本仓 `DocViewer.vue`/`ExcelViewer.vue` 模板
   **零 `.overlay`/`.v-container`/`.doc-container`** · ② 引 `ViewerShell.vue:24` 证明 host 提供定位上下文的前提为真 ·
   ③ `.k-fileviewer-host` 类名真的应用在根节点上(断言)。
   **T2 已把三个属性的断言放进 `knowledgeStyles.test.ts`,本刀不重复,但要在报告里指出那条断言的坐标。**
3. **`VIEWER_MAP` 五个扩展名的映射各一条用例**(`docx`/`wps` → DocViewer;`xls`/`xlsx`/`csv` → ExcelViewer)
   + **fallback 分支**(未知扩展名 → `.k-fileviewer-fallback` 那一屏,含「Preview not supported」文案与下载按钮)。
   🔴 **大小写不敏感**(蓝本 `.toLowerCase()`)—— 一条 `A.DOCX` 用例。
4. **`item` computed** = `{ path: file.fullPath, name: file.name, is_dir: false }`。
   🔴 **`FileEntry` 只必需 `name`/`path`/`is_dir`**(已实测 `src/files/stores/files.ts:8-16`)→ 类型直接对得上,
   **不许 `as any`**。
5. 🔴 **N41 的 Esc 监听**:`mounted` 注册 / `beforeDestroy` 移除 → Vue3 `onMounted`/`onBeforeUnmount`。
   **两条用例**:按 Esc 发 `close` · **卸载后再按 Esc 不再发**(判据:删掉 `onBeforeUnmount` 的 `removeEventListener`
   → 后一条必须报红)。
6. **`download` emit 转发**一条用例。⚠️ 蓝本 fallback 那个按钮发的是 **`file`** 而不是 `item`
   (`:18` `@click="$emit('download', file)"`)—— **照抄这个不一致**,并在注释里点明。
7. 🔴 **按 T0 的 §9.12 结论决定 mock 边界**。若走 stub 路线,**上面第 3/5/6 条各附变异证据**
   证明不是零判别力用例。
8. **自动上膛守卫**(治理 §9.14-2):本刀不需要(它没有「等下一刀的组件」)。

**评审第一必查项**:🔴 **K46 的三条前提自己验**(别信报告:自己 grep 两个 viewer 的模板、自己读 `ViewerShell.vue`)。
🔴 **判断这批用例是真空壳还是「空壳但将来有牙」**(承 P5d-T5 那 45/70 的判定先例)。

---

### T6 —— `FileDetailDrawer.vue`

**改**:新建 `src/ai/knowledge/components/FileDetailDrawer.vue` + `FileDetailDrawer.test.ts` ·
`knowledgeStyles.test.ts` **+1 行**。

**DoD**

1. 逐字移植蓝本 `:1-220`。🔴 **K44:`.vue` 侧零 `<style>` 块。**
2. 🔴 **emit 契约照抄**(治理 §5.1):`close` / `open`(载荷 `{ file }`)/ `download`(载荷 `file`)/
   **`toast`(载荷 message)**。**不许让本组件直接调 `useToast()`** —— 蓝本 `:186-190` 的注释明写
   「本组件的约定是 emit `toast`,由父组件转发」,改了就是改组件契约。
3. **`activeId` 初值** = 首个 chunk 的 id 或 `null`;`cur` / `curIndex` 的兜底(`find` 落空 → 首个 → `{}`);
   `select` / `step(±1)` 的边界(首/尾不越界)。**`k-chunk-nav-count` 的 `curIndex+1 / total` 一条。**
4. 🔴 **`fetchFull()` 的过期守卫**(**N42:蓝本自带 `reqId`,照抄**):
   ① **逻辑**交错用例(选 A → 选 B → B 先回 → A 后回,断言 `fullText` 是 B 的)·
   ② 🔴 **「两实例交错」用例守作用域**(判据:把 `activeId` 挪到模块级 → 必须报红)·
   ③ **catch 分支也有 `reqId` 判断**(蓝本 `:159`)—— 一条「失败的旧请求不覆盖新内容」用例 ·
   ④ `finally` 里的 `loading` 也带判断(`:162`)。
   🔴 **`chunkNo == null` 早退**(`:147`)一条。
5. 🔴 **`fetchFull` 的 mock 形状是后端原始 snake_case**(治理 §4.1):
   `{ chunks: [{ chunk_no, text }], anchor_chunk_no }`;anchor 找不到 → 兜底 `c.snippet`(`:157`)。
   **搞成 camelCase 按 Critical 报。**
6. 🔴 **`copy()` 两条路径都要用例**(蓝本 `:165-181`):
   ① `navigator.clipboard.writeText` 成功 → emit `Copied` ·
   ② 🔴 **`navigator.clipboard` 不存在(HTTP-IP 非安全上下文)→ 走 `execCommand` 兜底**,
   `document.execCommand` 返回 true → 仍 emit `Copied`;返回 false → emit `Copy failed…`。
   🔴 **这个兜底是蓝本自带的,与笔记区(P5d 无兜底)不同源 —— 照抄那个兜底,不许按 N 系列拒绝。**
   ⚠️ `plain` 是 `(fullText || cur.snippet || '').replace(/<[^>]+>/g, '')` —— **剥标签后复制**,一条用例。
7. 🔴 **N43 承接 `fileDetailDrawerDistill.spec.js`**:行为承接、**测法必须改**
   (`<script setup>` 无 `methods` 对象,蓝本那份 spec 的 `.methods.distillToNote.call(ctx)` 不可移植)。
   → **真挂载 + mock `service.notes.distillFile`**,断言 🔴 **传的是 `file.fullPath` 而不是 `file.path`**。
   **判据:改成 `file.path` → 必须报红。** 成功 → emit `Queued for note distillation`;失败 → emit `Could not queue this file`。
8. 🔴 **N44 `canDistill`**:用包内 `isDistillableName`(从 `@nimotech/nimoos-service` import),
   **不许在本仓重定义扩展名表**。两条:`.pdf` → 按钮渲染;`.png` → **按钮不渲染**(§9.11 的可点性)。
9. 🔴 **K49**:两处 `v-html`(`.k-chunk-item-preview` / `.k-chunk-content`)——
   T3 已在 util 层做了注入用例,**本刀再加一条组件层的**:喂含 `<script>` 的 snippet,
   断言渲染出的 DOM 里**没有 `<script>` 元素**(`querySelector('script')` 为 null)、但 `<mark>` 在。
10. 🔴 **N41 的 Esc**:`created` → `onMounted` 注册、`onBeforeUnmount` 移除。两条用例(同 T5 第 5 条)。
11. **`highlight`/`fmtMtime`/`relLevel`/`relLabel` 一律从 `util/searchAggregate` import**(K48)——
    🔴 **报告要自证本文件内零重复定义**(`grep -c 'function highlight'` = 0)。
12. 🔴 **自动上膛守卫**(治理 §9.14-2):本刀的父组件 `SearchView.vue` 还不存在 →
    **不需要占位**(本组件是被动的、不依赖父)。但**必须加一条**:
    「若 `views/SearchView.vue` 存在,则它必须 import 本组件」——
    **现在惰性通过,T7 一创建文件立刻上膛**。两条判据(惰性证明 + 上膛证明)+ 两种偏态各一条独立断言。

**评审第一必查项**:🔴 **`copy()` 的兜底分支是不是真跑到了** —— jsdom 下 `navigator.clipboard` 与
`document.execCommand` 都需要显式 stub,极易写成「两条用例其实走的同一条路」。
**自己删掉 `execCommand` 那整段 → 第 ②③ 条必须报红。**
🔴 **另核 `fetchFull` 的四条守卫各自独立报红**(不是只有其中一条在起作用)。

---

### T7 —— `SearchView.vue` 上半(搜索框 + 高级面板 + `run()` + 四个状态态)

**改**:新建 `src/ai/knowledge/views/SearchView.vue` + `SearchView.test.ts` ·
`knowledgeStyles.test.ts` **+1 行**。

**范围**:模板 `:1-119`(sticky 搜索框 / 高级面板 / idle / loading / empty 三态)+ `:158-162`(error 态)+
script 的常量块 · `advEnabled` / `totalChunks` · `clear` / `quickSearch` / `toggleSet` / `buildFilters` / `run` ·
`$route.query.q` 的 watch。
🔴 **不写**:结果卡列表(`:121-156`)· `FileDetailDrawer`/`KFileViewer` 的挂载(`:164-172`)·
`relLevel`/`relLabel`/`highlight`/`fmtMtime`(已在 util)· `fetchBlobUrl`/`openOriginal`/`downloadFile`/`onDrawerToast`。
→ **全部归 T8。**
⚠️ **`phase === 'results'` 那块归 T8** → 本刀的 `run()` 成功路径只能断到 `phase` 值与 `results` 长度,
**不许为了「能看见」提前写结果卡 markup**。

**DoD**

1. 逐字移植上述范围。🔴 **K44:`.vue` 侧零 `<style>` 块。**
2. 🔴 **N34 / N35 / N36 逐条照抄并各有用例**:
   - **N34**:`advEnabled` 的 `types.size < FILE_TYPES.length` —— 全选=未启用。
     **两侧**:全选 → `false`;取消一类 → `true`;`mtime`/`quality`/`topK` 三个各自也能让它 `true`(**四个 or 分支各一条**)。
   - **N35**:`MIME_PREFIXES` 逐字。`buildFilters` 里 `types` 全选 → **不发 `mime_prefix`**;
     取消一类 → 发,且**前缀顺序与 `MIME_PREFIXES` 的声明顺序一致**(蓝本双层 for 的顺序)。
   - **N36**:`1w`/`1m`/`1y` 三档在**假时钟**下各钉死 `mtime_after_ms` 的确切值(治理 §9.13)。
     `any` → **不发 `mtime_after_ms`**。
3. 🔴 **K51 `toggleSet`**:照抄「复制新 Set 再整体赋值」。
   **判据:一条「toggle 后 `advEnabled` 跟着翻转」的用例**(证明响应性真的通了)。
   🔴 **不许改成 `reactive(new Set())` 就地 `add/delete`。**
4. 🔴 **`run()` 的过期守卫(治理 §5.2 —— 蓝本无、本期必加,K15 同族第 9 次)**:
   ① **逻辑**交错用例(A 先发 B 后发、B 先回 A 后回 → `results`/`ms`/`phase` 都是 B 的)·
   ② 🔴 **「两实例交错」用例**(判据:epoch 变量挪模块级 → 必须报红)。
   🔴 **inline 写,不抽公共 guard**(既定纪律)。
5. **`run()` 的分支**:空 query → `phase='idle'` 直接 return(不发请求)·
   成功有结果 → `'results'` · 成功零结果 → `'empty'` · 抛错 → `'error'` 且
   `errorMsg` 取 `e.response.data.error || e.message || String(e)` **三档各一条**。
   🔴 **N37**:catch 里**不设 `ms`** —— 一条用例证明上次的 `ms` 保留(**不许「顺手清零」**)。
6. 🔴 **`showRerankWarn`(N38)**:响应 `warnings` 含 `rerank_unavailable` → `true`;
   **`vi.useFakeTimers()` 推进 5000ms → 变回 `false`**。
   🔴 **不加 `onBeforeUnmount` 清理**(N38);但用例必须用假时钟(真实 5 秒会超时)。
7. 🔴 **N40 `?q=` 深链**:`watch(() => route.query.q, handler, { immediate: true })`。
   **三条**:① 挂载时 query 已有 → 立即搜(immediate 生效)· ② **挂载后改 query → 再搜**
   (🔴 **判据:降级成只在 `onMounted` 读一次 → 这条必须报红**,记忆 `newui-router-query-only-no-remount`)·
   ③ 条件 `v && v !== q` —— query 与当前 `q` 相同时**不重复搜**。
   🔴 **第 ③ 条要防治理 §9.14-3 的坑**:回写值必须与初始值不同,否则 Vue watch 的 `Object.is`
   前置去重让回调压根不执行 = **零判别力**。
8. 🔴 **`store.runSearch` 的 mock 形状 = 后端原始 snake_case**(治理 §4.1),
   fixture 逐字出自 `p5e-fixtures/`,并做程序化逐字节等价校验。
9. **N33 `SAMPLE_QUERIES`**:五个词照抄且过 `$t()`;`quickSearch($t(s))` 一条用例
   (点 chip → `q` 变成**译文**、且触发 `run()`)。
10. **N39 `clear()`**:清 `q`/`phase`/`results`,🔴 **以及 `openFile`/`viewerFile`**
    (这两个 ref 本刀就要声明,即使消费点在 T8)—— 一条用例。
11. **模板内零裸色**(缺口③′ 守卫会扫;本文件加进 `KNOWLEDGE_VUE_FILES` 清单)。
    ⚠️ 蓝本 `:26`/`:124`/`:149`/`:151` 的内联 `color=` 已经是 `var()` → 照抄;
    `:84`/`:97`/`:100-105` 的内联 `style=` 是**纯尺寸/排版**(N24 同族)→ 照抄。
12. 🔴 **自动上膛守卫**:T8 要补的两个挂载点(`FileDetailDrawer` / `KFileViewer`)本刀不写 →
    **不许放 TODO 注释**,要放**文件系统条件断言**:「本文件必须已 import
    `../components/FileDetailDrawer.vue` 与 `../components/KFileViewer.vue`」——
    ⚠️ 这两个组件 **T5/T6 已存在** → **这条现在就上膛**,本刀必须**真的 import 并挂载**它们?
    🔴 **不是** —— 挂载 markup 归 T8。**正确写法**:断言「若本文件的模板里出现 `<FileDetailDrawer`,
    则必须同时出现 `@close` / `@open` / `@download` / `@toast` 四个监听」,
    **现在惰性通过(markup 不存在),T8 一写 markup 立刻上膛强制接全四个 emit**。
    两条判据(惰性证明 + 上膛证明:临时插入不带监听的 markup → 必须报红)。

**评审第一必查项**:🔴 **第 4 条的两条过期守卫用例各自独立报红**;
🔴 **第 7 条的三条深链用例** —— 尤其第 ③ 条**是不是零判别力**(把守卫整个拿掉,它是否仍绿?若仍绿 = Critical)。
另核 **`buildFilters` 的三个假时钟值算得对不对**(自己算一遍,别信报告)。

---

### T8 —— `SearchView.vue` 下半(结果卡 + 抽屉/预览器接线 + 文件字节流)

**改**:`src/ai/knowledge/views/SearchView.vue`(续写)· `SearchView.test.ts`(续写)。**零新建文件。**

**DoD**

1. 逐字移植模板 `:121-156`(结果卡列表)+ `:164-172`(两个子组件挂载)+
   script `:341-398`(`fetchBlobUrl` / `openOriginal` / `downloadFile` / `onDrawerToast`)+
   `:186-190` 的两个 ext 常量集。
2. 🔴 **K50 —— `fetchBlobUrl` 的落法**:
   `getHttp().get('/v3/file', { params, responseType: 'blob' })` → `URL.createObjectURL(resp.data)`。
   🔴 **三条自证**:① 报告要引 `http.ts:6-10` 的 `withVersion()` 证明 `/v3/file` **不会**被改写成 `/v1/v3/file` ·
   ② **一条断言钉死 `responseType: 'blob'`**(判据:改成 `'arraybuffer'` → 报红,理由:丢 Content-Type)·
   ③ **一条断言钉死没走 `service.file.fileUrl`**(反向断言:`fileUrl` 的 mock **零调用**,
   理由:token 不许进 URL —— 蓝本 `:346-350` 注释)。
   `inline` 参数:`{inline:true}` 时 `params.inline === 1`,否则 **`params` 里没有 `inline` 键**(两条)。
   ⚠️ **按 T0 的实测结论**:若后端不支持 `inline` → **仍照抄传参**,并在报告与验收清单里写明真实行为。
3. 🔴 **`openOriginal` 的三条路由分支各一条用例**(蓝本 `:361-380`):
   - ext ∈ `{docx, wps, xls, xlsx, csv}` → 设 `viewerFile`,**不发请求**(判据:`getHttp` 的 mock 零调用)
   - ext ∈ `{doc, ppt, pptx}` → toast `No preview for this format — please download`,**不发请求**
   - 其余 → `fetchBlobUrl(inline:true)` + `window.open(url,'_blank','noopener,noreferrer')`
     🔴 **`window.open` 返回 null(弹窗被拦)→ toast `Popup blocked by browser`** 一条 ·
     🔴 **`setTimeout(() => URL.revokeObjectURL(url), 60000)`** 一条(假时钟)
   - `!file.fullPath` → toast `File path unavailable`,不发请求
   - 抛错 → toast `Open failed: <msg>`
   🔴 **ext 提取是 `(file.name||'').split('.').pop().toLowerCase()`** —— 无扩展名的文件名会把整个名字当 ext,
   **照抄这个行为**并加一条用例点明。
4. 🔴 **`downloadFile`**:`fetchBlobUrl`(**不带 inline**)→ 造 `<a>` + `download` + `rel` →
   `appendChild` → `click` → `removeChild` → 60s `revokeObjectURL`。
   **逐步都要断**(尤其 🔴 **`a.download = file.name || 'download'` 的兜底**、
   🔴 **`removeChild` 真的被调用**(否则 DOM 泄漏)、**`rel="noopener noreferrer"`**)。
   失败 → toast `Download failed: <msg>`。
5. **结果卡列表**:`v-for` 的 `:key="r.id"` · 点卡 → `openFile = r` ·
   `k-rcard-tag` 的 `:data-kind` 与 `.toUpperCase()` · `k-match-pill` 的 `:title` 与文案(**两个不同的键**:
   `{n} matching sections` 是 title、`{n} matches` 是可见文案 —— 蓝本 `:135-136`,**不许合并**)·
   `k-rel` 的 `:data-level` 与 `:title`(含 `(score*100).toFixed(0)%`)·
   🔴 **`k-more-hint` 的 `v-if="r.chunks.length > 1"` 且文案用 `chunks.length - 1`**(两侧用例)·
   `k-rcard-meta` 三段(path / `Modified` + `fmtMtime` / `Indexed`)。
   🔴 **`:data-*` 一律 `String(...)`,测试侧断 `'true'`/`'false'` 字符串**(承 P5d 的既定口径)。
6. **`k-result-count`**:`results.length` / `totalChunks`(= `chunkCount(results)`)/ `lastQuery` /
   `v-if="ms"` 的 ` · {{ms}} ms`(**`ms === 0` 时不渲染** —— 一条用例)。
7. 🔴 **两个子组件的接线**:
   - `FileDetailDrawer` 的 **四个监听全接**:`@close="openFile = null"` · `@open="openOriginal"` ·
     `@download="downloadFile"` · `@toast="onDrawerToast"` —— **T7 的自动上膛守卫会强制这一点**,
     报告要写明「该守卫现在因 markup 出现而上膛,且已满足」。
   - `KFileViewer` 的 `@close="viewerFile = null"` · `@download="downloadFile"`。
   - 🔴 **`onDrawerToast(msg)` → 全局 `useToast()`**(治理 §5.1:子组件 emit、父组件转发)。
   - 🔴 **两者可同时挂载**(`openFile` 与 `viewerFile` 都非空)—— 一条用例,并连带验 **N41**:
     此时按 Esc **两个都关**(与旧版一致,写进验收清单)。
8. 🔴 **K49 组件层注入用例**:`.k-rcard-snippet` 的 `v-html` 喂含 `<script>` 的 snippet →
   渲染 DOM 里 `querySelector('script')` 为 null、`<mark>` 在。
9. 🔴 **`r.chunks[0] && r.chunks[0].snippet` 的空数组兜底**(蓝本 `:142`)一条用例
   —— 零 chunk 的文件不许抛。

**评审第一必查项**:🔴 **K50 的三条自证**(尤其**反向断言 `fileUrl` 零调用** ——
这是「用错 API 三门全绿、只在真机上错」那一类,必须有守卫)。
🔴 **`downloadFile` 的 `removeChild` 与 `revokeObjectURL` 真的有断言吗**(最容易漏、且是资源泄漏)。
🔴 **T7 那条自动上膛守卫现在是「因为条件真被满足」而通过,还是被改宽了** —— 两种偏态各试一次
(只写 markup 不接监听 / 接了三个漏一个)。

---

### T9 —— 收官刀(路由反转 + `DEFERRED_TABS` + 构建管线门 + M-5)

**改**:`src/ai/knowledge/deferred.ts` + `deferred.test.ts` ·
`src/ai/knowledge/knowledgeRoutes.ts` + `knowledgeRoutes.test.ts`。

**DoD**

1. **`DEFERRED_TABS` 4 → 3**(摘 `'search'`)。
   🔴 **文件头注释按「反转不删」加第五代块**:带时点 + 「`'search'` 已迁(P5e,T5-T8 四刀)」+
   **逐项重申剩下 3 个的归属**(`wiki` / `roots` / `allowlist` → **P5f**)。
2. **`knowledgeRoutes.ts` 的 `search` 子路由:`KnowledgeDeferred` → 真 `SearchView`。**
   两条断言反转,**改前原文留成注释**(承四代→第五代谱系)。
3. 🔴 **`deferred.test.ts` 的「机制钉子」用例一字不许动**(承 P4 I2 的教训:占位清单摘空后
   仍须有用例证明该机制**有能力**工作)。
   🔴 **变异验证**:改坏 `isDeferred`(硬编码 `return false`)→ **必须报红**(证明不是空壳)。
   报告要给「该用例 diff 零命中」的自证。
4. 🔴 **「路由改回占位 → 必须有断言报红」** —— 若三门全绿,说明这次反转根本没有守卫(按 Important 报)。
5. 🔴 **构建管线门(顺序不许颠倒,先抓改前证据)**:
   ```
   改前: rm -rf dist && pnpm build && grep -o "k-rcard-tag\|FileDetailDrawer\|KFileViewer" dist/assets/*.js  → 必须零输出
   改后: 同命令 → 必须命中
   ```
   🔴 **判据必须上下文感知**(承 E-25:裸子串会同时命中注释与真代码)——
   贴出命中处的上下文,证明只能来自真实编译代码(Vue 编译器 hoist 的静态 class / `<script setup>` 的 `__name`)。
   🔴 **CSS 命中不作 JS 证据**(承 E-8)—— 本期 scss 从 T2 起就进产物,要核的是 JS 侧。
6. **M-5 顺手订正**:`knowledgeRoutes.ts:49-51` 那段用现在时说「剩 5 个」的旧注释 →
   改成带时点的历史记录(**只改注释**,报告给「非注释行改动为 0」的自证)。
7. 🔴 **收官口径六个数字自己实测**(不许照抄):测试文件数 · 用例数 · `.vue` 总数 ·
   `color-guard` 用例数(**用 T4 之后的新构成**)· `aiKb*` 键数 · 全表键数(zh/en 各自独立量 + 差集均空)。
8. 🔴 **死键核查**:本期新增的全部键,用**词边界** grep 逐键扫 `src/`
   (排除 `src/i18n/` 与 `.test.ts`),**报告要列出零消费的键**。
   ⚠️ 间接消费(写在常量的 `label` 字段上、由 `t(m.label)` 渲染)要逐条落地核实,不算死键。
9. **验收导航路径核实**:`/ai/settings` 顶栏「详情」→ `/ai/knowledge` → 左栏第 **2** 项「搜索」**现在真能渲染**;
   给出可直接粘贴的 `?q=` 深链 URL。

**评审第一必查项**:🔴 **自己重做一遍构建管线门的三步**
(当前命中 → 临时撤掉反转 + `rm -rf dist` 重建 → **必须搜不到** → `cp` 还原 + md5 → 再 build 恢复命中)
—— **这条证明的价值全在顺序上**。
🔴 **用例数不变可能掩盖「删一条加一条」** → 逐条对比两个测试文件改前改后的用例名与断言。

---

## 2. 收官后的协调者动作

1. 🔴 **`git add -f` 全部台账文件并提交** —— 每刀就做,别攒到收官(P5d 收官时发现 30 个文件从未被跟踪,
   正是 SP7 整目录丢失的同款向量;`.gitignore:6` 盖着 `.superpowers/`,`git status` 全程干净、零警告)。
2. **派全支终审**(opus),明确要求它查逐刀评审看不到的四类:
   ① 跨刀一致性(三个新 `.vue` 的写法 / K48 的去重是否留下第二份拷贝 / 本期新键的死键核查)·
   ② 收官数字自测 + 三门自跑 · ③ 「产品代码对、守卫为零」最后一遍扫
   (🔴 **重点复核 T4 那四条新守卫是否被后续刀悄悄放宽**)· ④ 债务与遗留项完整性。
   🔴 **并明确要求它复核协调者本人的裁定**(§0.1 D-3 / §0.2 D-9 / §0.3 合并刀 / §0.4 notes 分组转票)。
3. **写验收清单**(`p5e-acceptance-checklist.md`),严格按治理 §13:
   第一项是导航路径 · §9.11 的 11 项可点性逐个照抄 · **distill 标红 + 写怎么恢复** ·
   🔴 **两条主动告知**:Esc 同时关两层(N41)· `.k-rcard-tag` 五个类型色(尤其 MD 黑底)请看实物拍板。
4. **不部署 · 不 push · 不合 master。**

## 3. 🔴 本期不做、需要用户拍板或另开票的事

| # | 事 | 状态 |
|---|---|---|
| 1 | **Agent 语义搜索卡补 `notes` 分组**(`searchMapper.ts` 的 notes 分组 + `SemanticSearchCard`/`SearchFullResults` 的 notes tab + 2 份 Vue2 spec) | 🔴 **本期转独立票**(治理 §0.4 / 勘误 E-49)。**需要用户确认这个删减** |
| 2 | `sp8-ai` **未合 master** | 非快进、**4 个冲突文件**,且**与 `sp7-photos` 的合并顺序须用户决定**(P5d 已提出,仍待拍板) |
| 3 | **P5f** = `WikiView` 314 + `wikiViewHelpers` 95 + `RootsView` 289 + `AllowlistView` 249 = **947 行** + 清空 `DEFERRED_TABS` | 下一期 |
