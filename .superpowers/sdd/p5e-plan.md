# SP8-P5e 计划书 —— 知识库**搜索区**(`SearchView` + `FileDetailDrawer` + `KFileViewer` + `searchAggregate`)

> 🔴 **权威优先级**:
> **上级设计**(`NimoOS-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p5-knowledge-design.md`)
> **> `p5-master-plan.md`(全期重算,含 P5e 的 52 个 scss 类逐类清单)
> > `p5e-coordinator-rulings-T0.md`(T0 后产出)> `p5e-common-constraints.md` + 附录 A/B/D
> > 本计划书 > 任务 brief。**
> ⚠️ 凡**用户明示裁定**的压过上级设计(已发生 2 次,见 `p5-master-plan.md` §4)。

| | |
|---|---|
| 可写仓 | `.sp8/NimoOS-New-UI` @ `sp8-ai`,起点 **`a67e380`**(T0 自己 `git log` 现测确认) |
| 蓝本锁 | `NimoOS-UI` @ **`7a6ee6b7`**(P5 全期不换,用户 2026-08-04 拍板 = **U-2**)· 一律 `git show 7a6ee6b7:<path>` 读 |
| 验收 | dev server **`:5288`**(pid 1159107,已在监听,服务 `.sp8` 工作树)· 🔴 **禁 `deploy.sh`** |
| 禁令 | **禁部署 · 禁 push · 禁合 master** · Service 仓**零改动** · **零新依赖** |
| 三门起点 | `Test Files 331` / `Tests 3958` / `vue-tsc` 0 / `vite build` 0(**T0 自己重跑确认**) |
| 车道 | **单车道 T0 → T8(9 刀)**,每刀 = 一个实现者 subagent + 一个**独立**评审 subagent(最低 sonnet,禁 haiku) |

---

## 0. 本期体量(`p5-master-plan.md` §5 的实测值)

**≈ 1245 蓝本行**,不是 kickoff 与上级设计 §4 写的 820(**E-50:没算 scss**)。

| 块 | 量 | 落点 |
|---|---|---|
| `SearchView.vue` | **401** | `src/ai/knowledge/views/SearchView.vue` |
| `FileDetailDrawer.vue` | **220** | `src/ai/knowledge/components/FileDetailDrawer.vue` |
| `KFileViewer.vue` | **120**(`<style>` 51,其中 **21 行按 K46 不搬**) | `src/ai/knowledge/components/KFileViewer.vue` |
| `searchAggregate.js` | **79** | `src/ai/knowledge/util/searchAggregate.ts` |
| 🔴 **`knowledge.scss` 52 个类** | **≈ 425** | `src/ai/styles/knowledge.scss` |
| i18n | **63** distinct(53 静态 + 9 动态 + 1 util) | `zh_cn.ts` / `en_us.ts` |
| Vue2 spec 承接 | `searchAggregate.spec.js`(46 行/2 例)· `fileDetailDrawerDistill.spec.js`(23 行/1 例,**测法必须改**) | — |

**逐类清单在 `p5-master-plan.md` §2.4** —— T0 的附录 D 以它为核对基准,不许另起一套。

## 0.1 🔴 上级设计给 P5e 的两条开工前置(T0 必须先答,答不了不许进 T1)

### 前置① —— `/v1/ai/search/text` 的真实代价

上级设计 §4 P5e 原文:
> **实测 `/v1/ai/search/text` 可用性(paused 模式下查询时仍会懒加载 BGE-M3,内存涨到 ~2.8 GB;首次调用约 16.7 s)。**

三个后果全要落地:
1. 🔴 **验收时第一次搜索要等约 17 秒** —— **不写进验收清单,机主必然当卡死报 bug**。
2. 🔴 **内存峰值 ~2.8 GB** —— T0 探测前先看余量(上级设计 §6.1 记当时余 9.8 G),并在报告里写清。
3. 🔴 **这属「会改设备状态」的探测**(模型驻留内存)→ 报告必须写「怎么恢复」。
   ⚠️ 上级设计 §6.1 已证 `workers.py:84` 的 `pause()`/`start()` 之间无 await 让出点 →
   **队列不会解冻、11.3 G 峰值不会出现**,可安全探测。

### 前置② —— distill 链路在设备上到底通不通

上级设计 §6.4 原文:设备容器里 `main.py` **2765 行、`notes/distill` 命中 0 次**;仓库源码 **2922 行、4 条 distill 路由**
→ **`FileDetailDrawer` 的 distill 按钮真机恒 404**。

⚠️ 协调者记忆记「Python agent 2026-08-01 已重部署,distill 接口真机可用」——
🔴 **必须由 T0 实测坐实,不许采信记忆**(直连 `:8282` + `X-User-Id`,验 `GET /agent/notes/distill/status` 与 `/jobs`)。
- **通** → distill 按钮列入真机验收项(⚠️ 会真的塞队列 + 可能生成 `.md`,标红 + 写恢复)。
- **不通** → 按 **D1 政策**:界面做完整、逻辑照抄、**不列真机验收项**、**不为打不通的接口编造 fixture**
  (对应 fixture 用「按接口构造的最小样本」并在 README 登记,同 P5d 的 D-6 模具)。

## 0.2 🔴 本期六个最容易翻车的点(每一刀的 brief 都要带)

1. **24 个蓝本死代码类不许搬**(`p5-master-plan.md` §2.2)。
   P5e 要搬的 `.k-hero-suggest`(`:351`)/ `.k-suggest-chip`(`:357`)**紧夹在 `.k-hero-search-kbd`(`:343`)
   与 `.k-stat`(`:380`)中间** —— 「整段搬」会一次带进 18 个死类。
   🔴 **「没有搬多」白名单报红时,先回查那份清单,不许改白名单。**
2. **K46 —— `KFileViewer` 的 21 行 `::v-deep` 补丁不许照搬,但 `.k-fileviewer-host` 的 `fixed` 必须保留。**
   蓝本那三条是补 **Vue2** viewer 依赖 `.file-panel .modal-card .overlay` 祖先链的;本仓 `DocViewer`/`ExcelViewer`
   **自带 `ViewerShell`**、不渲染那三个类(实测)。**这与上级设计 §5.4「顺带解掉的风险 2」同向** ——
   上级设计原文就写「`KFileViewer` 复用 `src/files/viewers/**`(它们吃全局 token),与周围同族」。
   ⚠️ **反过来**:`ViewerShell.vue:24` 是 `position: absolute; inset: 0` → **需要 host 提供铺满视口的定位祖先**。
   **照搬 = 复制不存在的问题;顺手清理 host 的 `fixed` = 预览器塌进文档流。两个方向都是 bug。**
3. **K50 —— 文件字节流必须走 `getHttp().get('/v3/file', {responseType:'blob'})`。**
   `service.file.getBytes()` 返 ArrayBuffer **丢 Content-Type**(新标签页变下载);
   `service.file.fileUrl()` 把 token 拼进 URL(**蓝本 `:346-350` 注释明令要避免**)。
   **两种错法都不会让三门变红,只在真机上错。**
4. **`mtimeMs` 是毫秒 —— 与 P5d 的 `relativeTime(unixSec)` 是秒完全相反。**
   喂错单位静默产出 1970 年。**两侧都要用例**(承 P5d-T3 的秒↔毫秒探针教训)。
5. **`.k-suggest-chip` 是 P5a 的跨期漏搬(E-52)**,New-UI 现在只有 `knowledge.scss:2198` 那条后代覆盖。
   **基类必须搬在那条覆盖之前**(蓝本源序),否则级联反掉而**三门全绿**。
6. **K49 的三处 `v-html` 是本期唯一 XSS 面。** `highlight()` 先 escape 再插 `<mark>`,
   **删掉 escape 那步三门不会红** —— 必须有注入用例 + RED 探针。

## 0.3 🔴 为什么**没有**「守卫债刀」(与我的第一版差异,须用户知情)

P5d 交接单说「**P5e 一写 `<style>` 块就零保护**」,据此我第一版排了一刀 T4 修 D-5 + D-7 + §0.3 位置③④。
**重新按蓝本与本仓实测后,这一刀砍掉,理由三条:**

1. 🔴 **前提不成立**:P5e 按 **K44 纪律** `.vue` 侧**零 `<style>` 块**(scss 全进 `knowledge.scss`),
   而 `knowledge.scss` 由 `knowledgeStyles.test.ts` 做**全文含注释色扫**(覆盖最完整的一处)。
   `searchAggregate.ts` 无任何颜色。→ **D-5 / D-7 / 位置③④ 一条都不危及 P5e 自己的产出。**
2. 🔴 **上级设计 §10 已记账为「建议独立一期」**(原文:「`color-guard` 三个盲区收口:不扫 `.scss` ·
   不认 `white`/`black` 具名色 · `sk-shared.scss:52` 存量。P3a 起已记账,**建议独立一期**」)。
   D-7(`.css` 侧 `?raw` 恒空致空壳)是 P5d 终审新发现的**第四个同族盲区**,应并入那张票,不是塞进 P5e。
3. **改的是全仓守卫本身**,「改弱了没人看得出来」——它值得一期专门的 RED 探针矩阵,
   而不是当成搜索区迁移的搭头。

→ **D-5 / D-7 / §0.3 位置③④ 一并并入 `p5-master-plan.md` §6-1 那张独立票。**
⚠️ **但 D-3 与 D-9 仍在本期 T1 做** —— 它们不是守卫盲区,是**会直接让本期变红 / 已成死键**的具体债(见 §0.4)。

## 0.4 P5d 交下来的债务票,本期怎么落

| 票 | 裁定 | 刀 |
|---|---|---|
| **D-3** 全表键数快照是跨期陷阱(`SettingsView.test.ts:1887-1888`) | 改 **`toBeGreaterThanOrEqual`** 留原地。精确键集一致性已由 `parity.test.ts` 更强地守着(它断**键集完全相等**);快照唯一多出的价值 = 「键数不下降」,下限断言恰好只留这个。挪走 = 换个地方保留同一个陷阱;删 = 违「反转不删」 | **T1** |
| **D-9** `aiCfgKnowledgeSoon` 死键 | **删键**,两档同步。「反转不删」保护的是决策历史,而历史已完整留在 `SettingsPage.vue:187` 的注释里;留零消费键会污染所有后续死键审计(P5d 终审就撞到它、查不到来历) | **T1** |
| **D-5 / D-7 / §0.3 位置③④** | 🔴 **转独立票**(§0.3) | — |
| **D-4** 68 条键值只有存在性断言 | **本期不改** —— P5a–P5d 的既定全仓模式,单方面反转会让本期与前四期不同源。本期新键照同一模式,T1 报告写清条数 | — |
| **M-4** `knowledgeStyles.test.ts:399` 用例名过宽 | 顺手改准标题(只改用例名,不动断言) | **T2** |
| **M-5** `knowledgeRoutes.ts:49-51` 现在时注释 | 顺手订正成带时点的历史记录 | **T8** |
| `openNoteInNewTab` | 🔴 **本期仍无调用点**(实测:三个新 `.vue` 零引用)→ **继续不补,转 P5f**。补了就是死代码 | — |
| **clipboard 票** | 🔴 **注意方向相反**:`FileDetailDrawer.copy()` **蓝本自带 `execCommand` 兜底**(`:171-179`)→ **照抄那个兜底**,别按笔记区(P5d 无兜底)的 N 系列口径拒绝 | **T5** |
| D-6 / A-8 票 / 票 3c / 票 3e / `AllowlistView` / Wiki 运维 / notes 分组 | **继续挂账**(归属见 `p5-master-plan.md` §6) | — |

---

## 1. 九刀(T0 → T8)

> **每刀通用 DoD**(不再逐刀重复):三门全绿并落盘完整日志(**不许 `| tail`**)· 报告按治理 §10 写全并 **`git add -f`** ·
> 命中的 K/N 条目逐条显式申报 · 🔴 **每条「守卫/断言」类 DoD 都要配 RED 探针**
> (`cp` → 行首锚定注入 → 先证注入落盘 → 报红 → `cp` 还原 → `md5sum` 逐字节比对;**禁 `git checkout/restore/stash`**)·
> 🔴 **带 🔴 的「复跑/复扫/独立复核」项不许采信上一刀的结论,要跳过必须先停下写 `NEEDS_CONTEXT`**。

### T0 —— 探测 + 三份附录 + fixtures(**不碰 `src/`**)

**产出**:`p5e-appendix-A-i18n.md` · `p5e-appendix-B-tokens.md` · `p5e-appendix-D-classes.md` ·
`p5e-fixtures/`(含 `README.md`)· `p5e-task-0-report.md`。

1. 🔴 **U-2:SSH fetch 真远端**(`git fetch git@github.com:NimoTech/NimoOS-UI.git main`,HTTPS 无凭据必失败)
   \+ 逐个比对本期 5 个蓝本文件 → 报告写「远端 sha + 比对结果 + 本期锁 `7a6ee6b7`」。
   **比出非注释的功能性差异 → 停下问用户。**
   ⚠️ 已知:`65cfda58` 对三个 `.vue` 各 3/1/1 处**注释**中→英、`searchAggregate.js` 逐字相同(P5c §4.4 比过)→ **复核即可**。
2. 🔴 **三门起点基线自己重跑**(不许照抄 331/3958),并核 `.vue` 总数 = **182**、`color-guard` 用例数 = **184**、`KIcon.PATHS` = **42**。
3. 🔴 **前置①**:`/v1/ai/search/text` 实测(§0.1)—— 可用性 · **首次调用耗时** · **内存峰值** · 怎么恢复。
4. 🔴 **前置②**:distill 链路实测(§0.1)—— 通 / 不通,并给出对应的验收与 fixture 策略。
5. **附录 A**(i18n):**63 distinct 的终值复核**(协调者初测 53 静态 + 9 动态 + 1) ·
   逐条 zh 值(权威 `zh_CN.json`,🔴 **N/N 命中数 + 几条 Vue2 无源需自造**)·
   逐条 en 值(🔴 **权威 = `en_US.json` 的覆盖值**,承 E-31/R10,**不许假设「en = key」**)·
   复用判定表(只认 `aiKb*` 家族,其余按 A-1 拒绝)· 全角标点例外实扫 ·
   占位符清单(🔴 **含唯一的双占位符键** `{n}`+`{query}`)· 🔴 **双向撞车扫描表**
   (协调者点名 14 个高危同值:`Download`/`Close`/`Modified`/`Search`/`Results`/`Copied`/`High`/`Mid`/`Low`/
   `Similarity`/`files`/`matches`/`Advanced`/`Enabled`/`Fast`)。
   🔴 **`FILE_TYPES` 的 5 个 label 蓝本没过 `$t()` → 明写「不进 i18n」。**
   ⚠️ **上级设计 §2.4 记 461、协调者按 `$t('…')` 单引号扫得 408 —— 这是扫法差异,不许先判成勘误**
   (P5d 吃过「凭想象补一个不存在的问题、烧 46 万 token」的教训);用同口径复扫并给终值。
6. **附录 B**(色值):逐处「蓝本 `file:line` → 字面量 → 本仓 token(既有/新建)」。
   🔴 **三处必须定死,实现者不许自选**:`.k-rcard-tag[data-kind]` 五个实底
   (`#FF3B30`/`#1a1a1a`/`#007AFF`/`#34C759`/`#AF52DE`)· `.k-rel[data-level]` 三组 `rgba` 底 + 三个实字色 ·
   🔴 **`.k-chunk-content mark` 的 `rgba(255,235,0,.4)`(高亮黄,`:1660`,全仓大概率零同值先例)**。
   ⚠️ `.k-rcard-snippet mark`(`:653`)与 `.k-chunk-item-preview mark`(`:1645`)**用的是 token,不是字面量** —— 别一起改。
   🔴 **`.k-rcard-tag` 上的文字色**若压在实底上 → 附录 B 定死用哪个(记忆:**`--on-accent` 只在 accent 实底上可用**)。
   🔴 **`#1a1a1a`(MD 黑底)在暗色档单独标注** → 进验收拍板项。
7. **附录 D**(类清单):**以 `p5-master-plan.md` §2.4 的 52 个为核对基准**,逐个给「已搬 / 未搬 / 半搬」三态
   (不许只给总数,承 E-39)。另含:
   🔴 **24 个死代码类清单逐字抄进来**(§0.2-1)· **E-52 `.k-suggest-chip` 的级联处置** ·
   `.k-adv-toggle`/`.chev` 的「P5e 先搬者得,P5f 不许重复搬」交接项 ·
   三个**嵌套零引用规则**(`.h-md` `:660` / `mark` ×3)随父块整体搬的登记 ·
   `WHITELIST_293` / `NON_K_HELPER_CLASSES(16)` 的**本期终值 + 算式 + 复现命令**
   (🔴 **以程序化实测为准**;`p5d-gen-r8r9-sim.mjs` 硬编码旧常量名,要先改或对副本跑)·
   K46 的 z-index 关系(`.k-fileviewer-host` 1100 vs 蓝本 `.k-drawer-bg` `:1572` 实际值)。
8. 🔴 **`@vue-office` 在 jsdom 下的可测性结论**(治理 §9.12):能不能真挂 `DocViewer`;不能则 mock 边界画在哪
   (**保留 `item`/`list` props 与 `close`/`download` emit 的契约形状**);
   **必须去读本仓既有先例** `panelMap.test.ts` / `useViewer.test.ts` / `useOfficeBytes.test.ts`。
   **不给结论 = 计划失败。**
9. 🔴 **K48 的等价性程序化证明**:把蓝本 `SearchView.vue:317-345` 与 `FileDetailDrawer.vue:199-217`
   两份 `highlight`/`fmtMtime`/`relLevel`/`relLabel` 各自逐字移植成临时函数,对同一批输入
   (escape 边界 / 多词 / 空 query / 正则元字符)跑,**证明输出全等**。
   🔴 **不等价 → 停下写 `NEEDS_CONTEXT`,不许自行选一份。**
10. 🔴 **fixtures 实测**(治理 §4.2):`/v1/ai/search/text`(rerank 两态)· `/v1/ai/search/chunk` ·
    `/v3/file`(带/不带 `inline=1`)· distill。**逐个落真响应体。**
    **必答的六个字段级问题**:顶层有 `files[]` 还是只有 `hits[]` · `paths[0].mtime_ms` 单位 ·
    `mime` 真实取值分布(决定 N35 的筛选是否真生效)· `cite.page` 为空时是 null 还是缺字段 ·
    `score` 量纲(决定 `relLevel` 的 0.65/0.50 在真机上分不分得开档)· `warnings` 里 `rerank_unavailable` 是否真会出现。
    🔴 **`inline=1` 后端是否真支持** —— 不支持则「打开原文件」在新标签页会变成下载。
    🔴 **取数不许经网关**(承 E-37 + 记忆 `gateway-no-userid-injection`;上级设计 §6.5:
    **NimoOS-AI 对 localhost 也强制 JWT,`curl /v1/ai/*` 必 400**)→ 绕到 Parser `:8283` / agent `:8282` 直连。
11. **§9.11 可点性清单实测补全**(11 项):本机索引里有没有 pdf/md · 有没有 **docx|xls|xlsx|csv**
    (决定 `KFileViewer` 整屏可达)· 有没有 **doc|ppt|pptx**(决定「请下载」toast)· rerank 真机可不可用 ·
    给一个「本机必然搜不到」的词。
12. **`src/` 零改动自证**(`git diff --name-only -- src/` 为空)。

**评审第一必查项**:🔴 附录 A 的 zh/en 值有没有**自己译的**(P5d 的 C-1 就是这个)——
**程序化逐码点比对**附录与语言包,不许目视。另核附录 D 的 52 个是否与 `p5-master-plan.md` §2.4 **逐个对齐**。

---

### T1 —— i18n 键(+ D-3 + D-9)

**改**:`src/i18n/{zh_cn,en_us}.ts` · `messageSyntax.test.ts` ·
`SettingsView.test.ts`(**极窄:只 `:1887-1888` + 注释**)· `SettingsPage.vue`(**只 `:187` 一条注释**)。

1. 附录 A 的全部新键**同时**进两档,零遗漏零多余。`parity.test.ts` 绿。
2. 🔴 **跑 `p5e-task-1-i18n-verify.mjs`**(照 `p5d-task-1-i18n-verify.mjs`):**N/N 逐码点 MATCH** + 复用键 **M/M 未被改动**。
   🔴 **en 侧不许假设「en = JSON key」**(E-44 那个 bug)。
3. `messageSyntax.test.ts` 三条:(a) 全角标点扫描 + `toBe` 钉死的例外清单 ·
   (b) 占位符集合一致(**含唯一的双占位符键**)· (c)「exactly N keys」防漂移。
   🔴 **占位符反向断言不许写成「渲染结果含 `{x}` 字面量」**(E-45:vue-i18n 静默置空 = 零判别力)。
4. 🔴 **自己重跑双向撞车扫描** + 用**真实模块导入**计全表键数(§0.4 的 D-9 要删 1 个键 → **实测,别用算式**)。
5. 🔴 **D-3 落地**:`toHaveLength(1595)` ×2 → `toBeGreaterThanOrEqual(<实测值>)`;旧两行留成注释、
   **引条目编号不引行号**;**RED 探针 = 删 3 个 zh 键 → 必须报红**;
   🔴 **`SettingsView.test.ts` 其余一字未动的 `git diff` 逐行自证。**
6. 🔴 **D-9 落地**:两档各删 `aiCfgKnowledgeSoon`;`SettingsPage.vue:187` 注释补一句「该键已于 P5e 依治理 §0.2 删除」;
   自证 `grep -rw aiCfgKnowledgeSoon src/` 改后**只命中那条注释**。
7. **报告列清**「复用 X / 新增 N / Vue2 有权威 zh 值 M / 本期新造 K / 死键 0(或列出并说明)」+ **D-4 口径**条数。

**评审第一必查项**:🔴 任选 3 个新键各改坏一个字符/占位符名,证明有断言报红;
**独立复跑**双向撞车扫描 + 全表键数;**D-3/D-9 的越权核查**(两个文件都在零改动清单上,逐行核额度)。

---

### T2 —— `knowledge.scss` 52 个类(**本期最大的一刀,≈425 行**)+ M-4

**改**:`src/ai/styles/knowledge.scss` · `knowledgeStyles.test.ts`。**产品 `.vue` 零改动。**

1. 按 `p5-master-plan.md` §2.4 + 附录 D **逐段搬 52 个类**:
   `:351-360`(2)· `:458-680`(24,含嵌套 `.chev`/`mark`/`.h-md`)· `:726-733`(1)· `:1540-1674`(26,扣 K45 已搬的 2 行)·
   \+ KFileViewer 的 `<style>` 内容(K44 落点,**K46 砍掉 21 行 `::v-deep`**)。
   🔴 **一律嵌进 `.knowledge-app`**(K9);必须顶层的走 K44 的**具名例外**机制
   (那条「顶层裸选择器集合恰等于 `['.nme-content .ProseMirror']`」的**集合相等**断言要加成员,**不是放宽正则**)。
2. 🔴 **24 个死代码类一个都不许搬**(§0.2-1 / `p5-master-plan.md` §2.2)。
   🔴 **必配一条断言**:那 24 个类名在 `knowledge.scss` 里**零出现**(判据:加进任一 → 报红)。
   🔴 **报告必须写明「白名单报红时先回查死类清单,不许改白名单」这条已被自己遵守。**
3. 🔴 **不许重复搬**:`.k-seg`(K43)· `.k-btn.text`(K45,`:813-822`)· `.k-empty*` · `.k-skel` 基类 ·
   `.k-modal-x` · `.k-row-action` · `.k-scroll` · `.k-btn`。
   ⚠️ `knowledgeStyles.test.ts` 有一条**锚定在 `.k-btn { … }` 区间内**的「`&.text` 恰好 2 次」计数断言,
   重复搬会报红 —— **这是有意的**。
4. 🔴 **E-52 `.k-suggest-chip` 基类**:搬在 New-UI `knowledge.scss:2198` 那条 `.k2-suggest .k-suggest-chip` 覆盖
   **之前**(蓝本源序)。🔴 **必配断言钉住相对顺序**(判据:调换 → 报红),
   并在注释里写明「P5a 只搬了覆盖、基类漏搬 = E-52,本刀补」。
5. 🔴 **配色**:按附录 B 逐处映射;新建 token **两档都显式写值** + 声明处注释写明蓝本 `file:line`;
   **附录 B 表里没有的一律 `NEEDS_CONTEXT`**。
   🔴 **全文色扫**:token 声明层之外,**含注释**零 hex/rgb/rgba/hsl/具名色。
   ⚠️ 三个 `mark` 规则里**只有 `:1660` 是字面量**,另两个是 token,别一起改。
6. 🔴 **K46 落地**:保留 `.k-fileviewer-host` 的 `position: fixed` + `inset: 0` + `z-index: 1100`,
   **三个属性各有断言**(判据:拿掉任一 → 报红),注释里引 `ViewerShell.vue:24` 说明为什么必须 fixed。
   🔴 **不搬那三条 `::v-deep`**,并配断言证明 `.overlay`/`.v-container`/`.doc-container`
   在 `knowledge.scss` 里**零出现**(判据:加回任一 → 报红)。
7. 🔴 **守卫更新**:「没有搬多」白名单(`WHITELIST_293` → 本期终值,常量名跟着数字改)·
   `NON_K_HELPER_CLASSES` 集合相等断言 · 🔴 **开工前先独立复现附录 D 给的三个数再动手**。
8. **M-4 顺手修**:`knowledgeStyles.test.ts:399` 用例名改准(只改标题,不动断言)。
9. **额外门**:`pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` exit 0。
10. 🔴 **逐段对蓝本 `git show` 比对**:结构 / 顺序 / 嵌套逐字、边界无截断、无重复定义。

**评审第一必查项**(🔴 **上级设计 §9-1 明令:scss 任务的评审要专做逐行色扫**):
逐行色扫全部新增段 · 🔴 **亲手验「24 个死类零出现」那条断言真报红** ·
🔴 **亲手调换 `.k-suggest-chip` 与 `:2198` 覆盖的顺序验证报红** · **自己重跑那三个数字的模拟器**(不许信报告)。

---

### T3 —— `util/searchAggregate.ts`(蓝本 79 行 + K48 抽出的 4 个函数)

**改**:新建 `src/ai/knowledge/util/searchAggregate.ts` + `searchAggregate.test.ts`。**其它零改动。**

1. 逐字移植 `kindFromMime`/`basename`/`dirname`/`chunkVM`/`fileVM`/`groupHits`/`toFileResults`/`chunkCount`
   (蓝本 `:5-79`)。🔴 **`i18n.t('(Untitled)')` → `i18n.global.t(...)`**(不在 setup 上下文;
   先例 `notesViewHelpers.ts` 的 `relativeTime`;用 `useI18n()` 会抛)。
2. 🔴 **K48**:`highlight`/`fmtMtime`/`relLevel`/`relLabel` 也放这里并导出;`relLabel` 用 `i18n.global.t`。
   **必须引 T0 的等价性证明**,文件头注释写明「蓝本在两个 `.vue` 里各有一份逐字/等价拷贝,依据治理 K48 去重」。
3. **承接 Vue2 `searchAggregate.spec.js` 的 2 条行为**并加细:
   - `kindFromMime` **六分支各一条** + 空值兜底。🔴 **分支顺序有语义**:`includes('pdf')` 在
     `=== 'text/markdown'` **之前** → `text/markdown+docling/pdf` 判成 **pdf 不是 md**。
     **一条用例钉死顺序**(判据:调换两分支 → 报红)。
   - `basename`/`dirname` 边界:空串 · 无斜杠 · 尾斜杠 · 根路径 · 多重斜杠。
     🔴 `dirname('/a/b.md')` = **`'/a/'`**(带尾斜杠)、`dirname('b.md')` = **`'/'`** —— 两条都要断。
   - `chunkVM`:`cite` 缺失 · `chunk_no` 非数字(`typeof` 判断)· `page` 为 `undefined` vs `null`
     (🔴 **`0` 是合法页号必须保留**)· `preview.text` 缺失 → `''`。
     🔴 **`id` 的拼法 `${fileId}:${kind}:${chunkNo}` 逐字断**(它是 drawer 里 `activeId` 的比对键)。
   - **N45 三件事各自独立用例**:`resp.files` 优先 · `groupHits` **保序** ·
     `fileVM.score` 取 `group.score || 首 chunk.score || 0` 三档。
4. 🔴 **K49 注入用例**(在这里,不在组件里):`highlight('<script>alert(1)</script>','alert')` →
   输出含 `&lt;script&gt;`、**不含裸 `<script`**、`alert` 被 `<mark>` 包住;再一条 `<img src=x onerror=1>`。
   🔴 **RED 探针:删掉 `esc` 那步 → 两条必须报红。**
   另加:正则元字符 query(`a.b*c`)不许抛 · 空 query 原样返回 escape 结果。
5. 🔴 **`fmtMtime` 的毫秒/时区两条**(治理 §9.13):`fmtMtime(0)` → `'—'` ·
   **毫秒 vs 秒两侧都要用例**(判据:`new Date(ms)` → `new Date(ms*1000)` → 必须报红)·
   🔴 **同式比对或固定 TZ**(`getMonth()` 是本地时区,同一毫秒在不同 TZ 下日期可能差一天),不许裸钉死字符串。
6. **`relLevel`/`relLabel` 三档 + 两个边界两侧**(`0.65` 与 `0.649…`、`0.50` 与 `0.499…`)。
7. 🔴 **零 `any`。** 包侧 `searchText`/`searchChunk` 返回 `unknown` → 按 **K41** 同款在消费侧补窄类型 +
   断言式收窄,文件头登记「包侧类型 → 本仓收窄 + 字段依据(蓝本哪一行读了这个字段)」。

**评审第一必查项**:🔴 **代码膨胀逐行判定**(蓝本 79 + 两份拷贝约 45)—— 逐行判哪些是 TS 类型/申报注释(正当)、
哪些是**未申报的新逻辑 / 被「修正」的行为 / 顺手抽的抽象**。
🔴 **亲手跑三组探针**:`kindFromMime` 分支顺序 · `esc` 删除 · 毫秒→秒。

---

### T4 —— `KFileViewer.vue`

**改**:新建 `components/KFileViewer.vue` + `KFileViewer.test.ts` · `knowledgeStyles.test.ts` **+1 行**(登记新 `.vue`)。

1. 逐字移植蓝本 `:1-68`。🔴 **K44:`.vue` 侧零 `<style>` 块**(内容已由 T2 搬进 `knowledge.scss`)。
2. 🔴 **K46 三条自证**:① `grep` 证明本仓 `DocViewer.vue`/`ExcelViewer.vue` 模板
   **零 `.overlay`/`.v-container`/`.doc-container`**(它们渲染 `ViewerShell > .office-body > .office-scroll`)·
   ② 引 `ViewerShell.vue:24` 证明「host 提供定位上下文」的前提为真 ·
   ③ `.k-fileviewer-host` 类名真的应用在根节点(断言)。
   **T2 已把三个属性的断言放进 `knowledgeStyles.test.ts`,本刀不重复,但报告要指出那条断言的坐标。**
3. **`VIEWER_MAP` 五个扩展名各一条**(`docx`/`wps` → DocViewer;`xls`/`xlsx`/`csv` → ExcelViewer)+
   **fallback 分支**(未知扩展名 → `.k-fileviewer-fallback` 那屏,含「Preview not supported」文案与下载按钮)。
   🔴 **大小写不敏感**(蓝本 `.toLowerCase()`)—— 一条 `A.DOCX` 用例。
4. **`item` computed** = `{ path: file.fullPath, name: file.name, is_dir: false }`。
   🔴 **`FileEntry` 只必需 `name`/`path`/`is_dir`**(实测 `src/files/stores/files.ts:8-16`)→ 类型直接对得上,**不许 `as any`**。
5. 🔴 **N41 Esc**:`mounted`/`beforeDestroy` → `onMounted`/`onBeforeUnmount`。**两条**:按 Esc 发 `close` ·
   **卸载后再按 Esc 不再发**(判据:删掉 `removeEventListener` → 后一条必须报红)。
6. **`download` emit 转发**一条。⚠️ 蓝本 fallback 那个按钮发的是 **`file`** 而不是 `item`(`:18`)——
   **照抄这个不一致**,并在注释里点明。
7. 🔴 **按 T0 的 §9.12 结论决定 mock 边界**。走 stub 路线则**第 3/5/6 条各附变异证据**,证明不是零判别力用例。

**评审第一必查项**:🔴 **K46 的三条前提自己验**(自己 grep 两个 viewer 的模板、自己读 `ViewerShell.vue`,别信报告)·
🔴 判断这批用例是真空壳还是「空壳但将来有牙」(承 P5d-T5 那 45/70 的判定先例)。

---

### T5 —— `FileDetailDrawer.vue`

**改**:新建 `components/FileDetailDrawer.vue` + `FileDetailDrawer.test.ts` · `knowledgeStyles.test.ts` **+1 行**。

1. 逐字移植蓝本 `:1-220`。🔴 **K44:`.vue` 侧零 `<style>` 块。**
2. 🔴 **emit 契约照抄**:`close` / `open`(载荷 `{ file }`)/ `download`(载荷 `file`)/ **`toast`**(载荷 message)。
   **不许让本组件直接调 `useToast()`** —— 蓝本 `:186-190` 注释明写「本组件的约定是 emit `toast`,由父组件转发」,改了就是改组件契约。
3. **`activeId` 初值** = 首个 chunk 的 id 或 `null`;`cur`/`curIndex` 的兜底(`find` 落空 → 首个 → `{}`);
   `select`/`step(±1)` 边界(首/尾不越界);`k-chunk-nav-count` 的 `curIndex+1 / total` 一条。
4. 🔴 **`fetchFull()` 的过期守卫(N42:蓝本自带 `reqId`,照抄)**:
   ① **逻辑**交错(选 A → 选 B → B 先回 → A 后回,断言 `fullText` 是 B 的)·
   ② 🔴 **「两实例交错」守作用域**(判据:`activeId` 挪到模块级 → 必须报红)·
   ③ **catch 分支也有 `reqId` 判断**(`:159`)—— 一条「失败的旧请求不覆盖新内容」·
   ④ `finally` 里的 `loading` 也带判断(`:162`)· 🔴 **`chunkNo == null` 早退**(`:147`)一条。
5. 🔴 **mock 形状 = 后端原始 snake_case**:`{ chunks:[{chunk_no,text}], anchor_chunk_no }`;
   anchor 找不到 → 兜底 `c.snippet`(`:157`)。**搞成 camelCase 按 Critical 报。**
6. 🔴 **`copy()` 两条路径都要用例**(蓝本 `:165-181`):① `navigator.clipboard.writeText` 成功 → emit `Copied` ·
   ② 🔴 **`navigator.clipboard` 不存在(HTTP-IP 非安全上下文)→ 走 `execCommand` 兜底**;
   返 true → 仍 emit `Copied`,返 false → emit `Copy failed…`。
   🔴 **这个兜底是蓝本自带的、与笔记区(P5d 无兜底)不同源 —— 照抄,不许按 N 系列拒绝。**
   ⚠️ `plain` 是剥标签后复制(`.replace(/<[^>]+>/g,'')`),一条用例。
7. 🔴 **N43 承接 `fileDetailDrawerDistill.spec.js`**:行为承接、**测法必须改**
   (`<script setup>` 无 `methods` 对象,蓝本 `.methods.distillToNote.call(ctx)` 不可移植)→
   **真挂载 + mock `service.notes.distillFile`**,断言 🔴 **传的是 `file.fullPath` 而不是 `file.path`(dirname)**。
   **判据:改成 `file.path` → 必须报红。** 成功 → emit `Queued for note distillation`;失败 → emit `Could not queue this file`。
   ⚠️ **按 T0 前置②的结论**:distill 真机不通则 fixture 用「按接口构造的最小样本」并在 README 登记(D-6 模具)。
8. 🔴 **N44 `canDistill`**:用包内 `isDistillableName`(从 `@nimotech/nimoos-service` import),
   **不许在本仓重定义扩展名表**。两条:`.pdf` → 按钮渲染;`.png` → **按钮不渲染**(§9.11 可点性)。
9. 🔴 **K49 组件层注入用例**:喂含 `<script>` 的 snippet → 渲染 DOM 里 `querySelector('script')` 为 null、`<mark>` 在。
10. 🔴 **N41 Esc**:`created` → `onMounted` 注册、`onBeforeUnmount` 移除。两条(同 T4 第 5 条)。
11. **四个函数一律从 `util/searchAggregate` import**(K48)—— 🔴 报告自证本文件零重复定义(`grep -c 'function highlight'` = 0)。
12. 🔴 **自动上膛守卫**:父组件 `SearchView.vue` 还不存在 → 加一条**文件系统条件断言**
    「若 `views/SearchView.vue` 存在,则它必须 import 本组件」——**现在惰性通过,T6 一创建文件立刻上膛**。
    两条判据(惰性证明:`--reporter=verbose` 见于 passed 列表且**非 skip/todo**;上膛证明:临时创建 → 报红 → 删除还原 → 转绿,
    **临时文件不许提交**)+ **两种偏态各一条独立断言**。

**评审第一必查项**:🔴 **`copy()` 的兜底分支是不是真跑到了** —— jsdom 下 `navigator.clipboard` 与
`document.execCommand` 都要显式 stub,极易写成「两条用例其实走同一条路」。
**自己删掉 `execCommand` 整段 → 第 ②③ 条必须报红。**
🔴 另核 `fetchFull` 的四条守卫**各自独立报红**(不是只有其中一条在起作用)。

---

### T6 —— `SearchView.vue` 上半(搜索框 + 高级面板 + `run()` + 四态)

**改**:新建 `views/SearchView.vue` + `SearchView.test.ts` · `knowledgeStyles.test.ts` **+1 行**。

**范围**:模板 `:1-119` + `:158-162`(error 态)+ script 常量块 · `advEnabled`/`totalChunks` ·
`clear`/`quickSearch`/`toggleSet`/`buildFilters`/`run` · `$route.query.q` 的 watch。
🔴 **不写**:结果卡列表(`:121-156`)· 两个子组件挂载(`:164-172`)· `fetchBlobUrl`/`openOriginal`/`downloadFile`/`onDrawerToast`
→ **全归 T7**。⚠️ **不许为了「能看见」提前写结果卡 markup。**

1. 逐字移植上述范围。🔴 **K44:`.vue` 侧零 `<style>` 块。**
2. 🔴 **N34/N35/N36 各有用例**:
   - **N34** `advEnabled` 的 `types.size < FILE_TYPES.length`(**全选=未启用**)—— 四个 or 分支各一条 + 全选侧一条。
   - **N35** `MIME_PREFIXES` 逐字。全选 → **不发 `mime_prefix`**;取消一类 → 发,且**前缀顺序与声明顺序一致**。
     🔴 **不许「补全」缺的 docling 变体。**
   - **N36** `1w`/`1m`/`1y` 三档在**假时钟**下各钉死 `mtime_after_ms` 确切值(`1m`=30 天、`1y`=365 天,非日历);`any` → 不发。
3. 🔴 **K51 `toggleSet`**:照抄「复制新 Set 再整体赋值」。**判据:一条「toggle 后 `advEnabled` 跟着翻转」的用例**
   (证明响应性真的通了)。🔴 **不许改成 `reactive(new Set())` 就地 `add/delete`。**
4. 🔴 **`run()` 的过期守卫(治理 §5.2 —— 蓝本无、本期必加,K15 同族第 9 次)**:
   并发入口 3 个(`run()` / `quickSearch()` / `query.q` watch);先发后至会用更旧结果覆盖 `results`/`ms`/`phase`,
   而 `phase` 直接驱动整屏 → **用户可见**。
   ① **逻辑**交错用例 · ② 🔴 **「两实例交错」**(判据:epoch 挪模块级 → 必须报红)。🔴 **inline 写,不抽公共 guard。**
5. **`run()` 分支**:空 query → `'idle'` 且**不发请求** · 有结果 → `'results'` · 零结果 → `'empty'` ·
   抛错 → `'error'` 且 `errorMsg` 取 `e.response.data.error || e.message || String(e)` **三档各一条**。
   🔴 **N37**:catch 里**不设 `ms`** —— 一条用例证明上次的 `ms` 保留(**不许「顺手清零」**)。
6. 🔴 **`showRerankWarn`(N38)**:`warnings` 含 `rerank_unavailable` → `true`;
   **`vi.useFakeTimers()` 推进 5000ms → 变回 `false`**。🔴 **不加 `onBeforeUnmount` 清理**;用例必须用假时钟。
7. 🔴 **N40 `?q=` 深链**:`watch(() => route.query.q, handler, { immediate: true })`。**三条**:
   ① 挂载时 query 已有 → 立即搜(immediate 生效)· ② **挂载后改 query → 再搜**
   (🔴 **判据:降级成只在 `onMounted` 读一次 → 这条必须报红**,记忆 `newui-router-query-only-no-remount`)·
   ③ 条件 `v && v !== q` —— query 与当前 `q` 相同时**不重复搜**。
   🔴 **第 ③ 条要防治理 §9.14-3 的坑**:回写值必须与初始值不同,否则 Vue watch 的 `Object.is`
   前置去重让回调压根不执行 = **零判别力**。
8. 🔴 **`store.runSearch` 的 mock 形状 = 后端原始 snake_case**,fixture 逐字出自 `p5e-fixtures/` + 程序化逐字节等价校验。
9. **N33 `SAMPLE_QUERIES`**:五个词照抄且过 `$t()`;`quickSearch($t(s))` 一条(点 chip → `q` 变成**译文**且触发 `run()`)。
10. **N39 `clear()`**:清 `q`/`phase`/`results` 🔴 **以及 `openFile`/`viewerFile`**(两个 ref 本刀就要声明)—— 一条。
11. **模板内零裸色**(缺口③′ 会扫;本文件加进 `KNOWLEDGE_VUE_FILES`)。
    ⚠️ `:26`/`:124`/`:149`/`:151` 的内联 `color=` 已是 `var()` → 照抄;`:84`/`:97`/`:100-105` 是纯尺寸/排版(N24 同族)→ 照抄。
12. 🔴 **自动上膛守卫**:T5 那条现在**上膛**(本文件已存在)→ 报告要写明它现在走「已存在」分支且已满足。
    另加本刀自己的一条:「若本文件模板出现 `<FileDetailDrawer`,则必须同时出现 `@close`/`@open`/`@download`/`@toast` 四个监听」
    —— **现在惰性通过(markup 归 T7),T7 一写 markup 立刻上膛强制接全四个 emit**。两条判据。

**评审第一必查项**:🔴 第 4 条两条过期守卫用例**各自独立报红** ·
🔴 第 7 条三条深链用例 —— 尤其第 ③ 条**是不是零判别力**(把守卫整个拿掉,它仍绿?→ Critical)·
另**自己算一遍 `buildFilters` 三个假时钟值**(别信报告)。

---

### T7 —— `SearchView.vue` 下半(结果卡 + 接线 + 文件字节流)

**改**:`views/SearchView.vue`(续写)· `SearchView.test.ts`(续写)。**零新建文件。**

1. 逐字移植模板 `:121-156` + `:164-172` + script `:341-398` + `:186-190` 的两个 ext 常量集。
2. 🔴 **K50 `fetchBlobUrl`**:`getHttp().get('/v3/file', { params, responseType: 'blob' })` → `URL.createObjectURL(resp.data)`。
   🔴 **三条自证**:① 报告引 `http.ts:6-10` 的 `withVersion()` 证明 `/v3/file` **不会**被改写成 `/v1/v3/file` ·
   ② **断言钉死 `responseType: 'blob'`**(判据:改 `'arraybuffer'` → 报红,理由:丢 Content-Type)·
   ③ 🔴 **反向断言 `service.file.fileUrl` 的 mock 零调用**(理由:token 不许进 URL —— 蓝本 `:346-350` 注释)。
   `inline`:`{inline:true}` 时 `params.inline === 1`,否则 **`params` 里没有 `inline` 键**(两条)。
   ⚠️ **按 T0 结论**:后端不支持 `inline` → **仍照抄传参**,把真实行为写进报告与验收清单。
3. 🔴 **`openOriginal` 三条路由分支各一条**(蓝本 `:361-380`):
   - ext ∈ `{docx,wps,xls,xlsx,csv}` → 设 `viewerFile`,**不发请求**(判据:`getHttp` mock 零调用)
   - ext ∈ `{doc,ppt,pptx}` → toast `No preview for this format — please download`,**不发请求**
   - 其余 → `fetchBlobUrl(inline:true)` + `window.open(url,'_blank','noopener,noreferrer')`;
     🔴 **`window.open` 返 null(弹窗被拦)→ toast `Popup blocked by browser`** 一条 ·
     🔴 **`setTimeout(revokeObjectURL, 60000)`** 一条(假时钟)
   - `!file.fullPath` → toast `File path unavailable`,不发请求 · 抛错 → toast `Open failed: <msg>`
   🔴 **ext 提取是 `(file.name||'').split('.').pop().toLowerCase()`** —— 无扩展名的文件名会把整个名字当 ext,
   **照抄**并加一条用例点明。
4. 🔴 **`downloadFile`**:`fetchBlobUrl`(**不带 inline**)→ 造 `<a>` + `download` + `rel` → `appendChild` → `click` →
   `removeChild` → 60s `revokeObjectURL`。**逐步都要断**,尤其
   🔴 `a.download = file.name || 'download'` 的兜底 · 🔴 **`removeChild` 真的被调用**(否则 DOM 泄漏)·
   `rel="noopener noreferrer"`。失败 → toast `Download failed: <msg>`。
5. **结果卡列表**:`:key="r.id"` · 点卡 → `openFile = r` · `k-rcard-tag` 的 `:data-kind` + `.toUpperCase()` ·
   🔴 **`k-match-pill` 的 `:title` 与可见文案是两个不同的键**(`{n} matching sections` vs `{n} matches`,蓝本 `:135-136`,**不许合并**)·
   `k-rel` 的 `:data-level` 与 `:title`(含 `(score*100).toFixed(0)%`)·
   🔴 **`k-more-hint` 的 `v-if="r.chunks.length > 1"` 且文案用 `chunks.length - 1`**(两侧用例)·
   `k-rcard-meta` 三段。🔴 **`:data-*` 一律 `String(...)`,测试侧断 `'true'`/`'false'` 字符串。**
6. **`k-result-count`**:`results.length` / `totalChunks`(= `chunkCount(results)`)/ `lastQuery` /
   `v-if="ms"` 的 ` · {{ms}} ms`(**`ms === 0` 时不渲染** —— 一条)。
7. 🔴 **两个子组件接线**:`FileDetailDrawer` **四个监听全接**(T6 的自动上膛守卫强制这一点,
   报告要写明它现在因 markup 出现而上膛且已满足)· `KFileViewer` 的 `@close`/`@download` ·
   🔴 `onDrawerToast(msg)` → 全局 `useToast()` ·
   🔴 **两者可同时挂载**(`openFile` 与 `viewerFile` 都非空)一条用例,连带验 **N41**:此时按 Esc **两个都关**。
8. 🔴 **K49 组件层注入用例**:`.k-rcard-snippet` 的 `v-html` 喂含 `<script>` 的 snippet →
   `querySelector('script')` 为 null、`<mark>` 在。
9. 🔴 **`r.chunks[0] && r.chunks[0].snippet` 的空数组兜底**(蓝本 `:142`)一条 —— 零 chunk 的文件不许抛。

**评审第一必查项**:🔴 **K50 三条自证**(尤其**反向断言 `fileUrl` 零调用** —— 这是「用错 API 三门全绿、只在真机上错」那一类)·
🔴 **`downloadFile` 的 `removeChild` 与 `revokeObjectURL` 真的有断言吗**(最容易漏、且是资源泄漏)·
🔴 **T6 那条自动上膛守卫现在是「因为条件真被满足」而通过,还是被改宽了** —— 两种偏态各试一次
(只写 markup 不接监听 / 接了三个漏一个)。

---

### T8 —— 收官刀(路由反转 + `DEFERRED_TABS` + 构建管线门 + M-5)

**改**:`deferred.ts` + `deferred.test.ts` · `knowledgeRoutes.ts` + `knowledgeRoutes.test.ts`。

1. **`DEFERRED_TABS` 4 → 3**(摘 `'search'`)。🔴 文件头按「反转不删」加第五代块:带时点 +
   「`'search'` 已迁(P5e,T4-T7 四刀)」+ **逐项重申剩下 3 个归 P5f**(`wiki`/`roots`/`allowlist`)。
2. **`knowledgeRoutes.ts` 的 `search` 子路由:`KnowledgeDeferred` → 真 `SearchView`。**
   两条断言反转,**改前原文留成注释**(承四代→第五代谱系)。
3. 🔴 **`deferred.test.ts` 的「机制钉子」用例一字不许动**(承 P4 I2:占位清单摘空后仍须有用例证明机制**有能力**工作)。
   🔴 **变异验证**:`isDeferred` 硬编码 `return false` → **必须报红**。报告给「该用例 diff 零命中」的自证。
4. 🔴 **「路由改回占位 → 必须有断言报红」** —— 三门全绿说明这次反转根本没有守卫(按 Important 报)。
5. 🔴 **构建管线门(顺序不许颠倒,先抓改前证据)**:
   ```
   改前: rm -rf dist && pnpm build && grep -o "k-rcard-tag\|FileDetailDrawer\|KFileViewer" dist/assets/*.js  → 必须零输出
   改后: 同命令 → 必须命中
   ```
   🔴 **判据必须上下文感知**(承 E-25)—— 贴命中处上下文,证明只能来自真实编译代码
   (Vue 编译器 hoist 的静态 class / `<script setup>` 的 `__name`)。
   🔴 **CSS 命中不作 JS 证据**(承 E-8)—— 本期 scss 从 T2 起就进产物,要核的是 JS 侧。
6. **M-5 顺手订正** `knowledgeRoutes.ts:49-51`(**只改注释**,报告给「非注释行改动为 0」的自证)。
7. 🔴 **收官口径六个数字自己实测**:测试文件数 · 用例数 · `.vue` 总数 · `color-guard` 用例数 ·
   `aiKb*` 键数 · 全表键数(zh/en 各自独立量 + 差集均空)。
8. 🔴 **死键核查**:本期新增全部键用**词边界** grep 逐键扫 `src/`(排除 `src/i18n/` 与 `.test.ts`),
   **列出零消费的键**。间接消费(写在常量的 `label` 字段上、由 `t(m.label)` 渲染)要逐条落地核实,不算死键。
9. **验收导航路径核实**:`/ai/settings` 顶栏「详情」→ `/ai/knowledge` → 左栏第 **2** 项「搜索」**现在真能渲染**;
   给出可直接粘贴的 `?q=` 深链 URL。

**评审第一必查项**:🔴 **自己重做一遍构建管线门的三步**
(当前命中 → 临时撤反转 + `rm -rf dist` 重建 → **必须搜不到** → `cp` 还原 + md5 → 再 build 恢复命中)——
**这条证明的价值全在顺序上。**
🔴 **用例数不变可能掩盖「删一条加一条」** → 逐条对比两个测试文件改前改后的用例名与断言。

---

## 2. 收官后的协调者动作

1. 🔴 **`git add -f` 全部台账文件并提交 —— 每刀就做,别攒到收官。**
   P5d 收官时发现 30 个文件从未被跟踪(含裁定书与整期台账),正是 SP7 整目录丢失的同款向量;
   `.gitignore:6` 盖着 `.superpowers/`,`git status` 全程干净、**零警告**。
2. **派全支终审(opus)**,要求它查逐刀评审看不到的四类:
   ① 跨刀一致性(三个新 `.vue` 写法 / K48 去重是否留下第二份拷贝 / 本期新键死键核查)·
   ② 收官数字自测 + 三门自跑 · ③ 「产品代码对、守卫为零」最后一遍扫 ·
   ④ 债务与遗留项完整性。
   🔴 **并要求它复核协调者本人的裁定**:D-3 / D-9 / **§0.3 砍掉守卫债刀** / notes 分组转票 /
   **`p5-master-plan.md` §2 那份 149 类归属实测**。
3. **写验收清单**(`p5e-acceptance-checklist.md`),严格按治理 §13:
   第一项是导航路径 · §9.11 的 11 项可点性逐个照抄 ·
   🔴 **必须主动告知的四条**(不说机主必然报 bug):
   - **第一次搜索约等 17 秒**(BGE-M3 懒加载,上级设计 §4 已实测)—— **不是卡死**
   - **按 Esc 会同时关掉 in-app 预览与详情抽屉**(N41,与旧版一致)
   - **`.k-rcard-tag` 五个文件类型色**(尤其 MD 的深黑底 `#1a1a1a`)在暗色档下的观感 → **请看实物拍板**
   - **distill 按钮**:通则标红 + 写「验完去笔记区把那条草稿删掉」;不通则按 D1 不列此项并说明原因
4. **不部署 · 不 push · 不合 master。**

## 3. 🔴 需要用户拍板的事

| # | 事 | 我的建议 |
|---|---|---|
| 1 | **Agent 语义搜索卡的 `notes` 分组**(`searchMapper.ts` 补 notes + `SemanticSearchCard`/`SearchFullResults` 加 tab + 2 份 Vue2 spec) | **转独立票,不在 P5e**(E-49:被改文件全在 P2a/P2b 地盘,与搜索页零耦合;两个大文件 957/718 行) |
| 2 | **守卫债刀砍掉**(D-5/D-7/§0.3 位置③④ 并入独立票) | **砍**(§0.3 三条理由:前提不成立 + 上级设计 §10 已记账为独立一期 + 值得专门一期) |
| 3 | **D-3 改下限断言 / D-9 删键** | 照 §0.4 做 |
| 4 | `sp8-ai` **合 master 的时机与顺序**(非快进、4 冲突文件、与 `sp7-photos` 压同一 base) | P5d 已提出,**仍待你拍板** |
