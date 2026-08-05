# SP8-P5f 计划书 —— 知识库**最后三页**(`WikiView` + `RootsView` + `AllowlistView` + `wikiViewHelpers`)

> 🔴 **权威优先级**:
> **上级设计**(`git -C ../../NimoOS-UI show 6a8f7825:docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p5-knowledge-design.md`)
> **> `p5-master-plan.md` > `p5e-coordinator-rulings-T0.md`(跨期常驻部分)> `p5f-coordinator-rulings-T0.md`(T0 后产出)
> > 三份 `p5f-` 附录 > `p5f-common-constraints.md` > 本计划书 > 任务 brief。**
> ⚠️ 凡**用户明示裁定**的压过上级设计(已发生 4 次)。
>
> 🔴 **干净上下文从 `p5f-kickoff-prompt.md` 开始读。**
> 🔴 **跨区影响与 4 张后端票在 `docs/superpowers/2026-08-05-sp8-p5-cross-area-impacts.md`**(进 git)。

| | |
|---|---|
| 可写仓 | `.sp8/NimoOS-New-UI` @ `sp8-ai`,起点 **`bae5d44`**(T0 自己 `git log` 现测确认) |
| 蓝本锁 | `NimoOS-UI` @ **`7a6ee6b7`**(P5 全期不换 = **U-2**)· `src/**` 用 `git show 7a6ee6b7:`、`docs/**` 用 `6a8f7825:` |
| 验收 | dev server **`:5288`**(服务 `.sp8` 工作树)· 🔴 **禁 `deploy.sh`** |
| 禁令 | **禁部署 · 禁 push · 禁合 master** · Service 仓**零改动** · **零新依赖** · **禁 `amend`/`stash`/`reset`/`rebase`** |
| 三门起点 | `Test Files 335` / `Tests 4254` / `vue-tsc` 0 / `vite build` 0(**T0 自己重跑确认**) |
| 其它基线 | `.vue` **185** · color-guard **187** · `aiKb*` **441/441** · 全表 **1648/1648** · `WHITELIST_348` · `NON_K_HELPER_CLASSES` **19** |
| 车道 | **单车道 T0 → T8(10 刀,含 T1b)**,每刀 = 一个 fresh 实现者 + 一个**独立**评审(最低 sonnet,禁 haiku) |

---

## 0. 本期体量(协调者 2026-08-06 实测)

| 块 | 量 | 落点 |
|---|---|---|
| `WikiView.vue` | **314** | `src/ai/knowledge/views/WikiView.vue` |
| `wikiViewHelpers.js` | **95** | `src/ai/knowledge/util/wikiViewHelpers.ts` |
| `RootsView.vue` | **289**(含 `<style scoped>` **66** 行) | `src/ai/knowledge/views/RootsView.vue` |
| `AllowlistView.vue` | **249** | `src/ai/knowledge/views/AllowlistView.vue` |
| **小计** | **947** | |
| 🔴 `knowledge.scss` **67 类** | **≈ 344** | `:985-1160` + `:1342-1400`(Allowlist)· `:2453-2561`(Wiki) |
| 🔴 **`kr-*` 9 类**(K53 / **勘误 E-63**) | **66** | 从 `RootsView.vue` 的 `<style scoped>` 搬进 `knowledge.scss` |
| i18n | **83+** distinct(**`wikiViewHelpers` 实测 0**,见 E-65) | `zh_cn.ts` / `en_us.ts`,前缀 `aiKb*` |
| **合计** | 🔴 **≈ 1357 蓝本行**(kickoff 写 1291,**没算 E-63 的 66 行**) | |

**Vue2 spec 承接**:`wikiViewHelpers.spec.js`(119)· `wikiRoots.spec.js`(73)·
`knowledgeStoreRoots.spec.js`(65,**T0 判归属**)· `dashboardWikiViews.spec.js`(118,**部分归 P5a,T0 判边界**)。

## 0.1 🔴 本期七个最容易翻车的点(**每一刀的 brief 都要带**)

1. 🔴🔴 **整段搬陷阱比 P5e 更直接**:**`.k-progress-*` 六个死类在 `:1152-1160`,而 Allowlist 段是 `:985-1160`
   —— 死类正好压在段尾。** 按「整段搬」会直接带进 6 个零引用死类。
   🔴 **P5e-T2 已配断言钉住 24 个死类零出现(`knowledgeStyles.test.ts:491`)⇒ 搬多了会报红。
   报红时先回查死类清单,不许改白名单、不许放宽断言。**
2. 🔴 **「先搬者得」不许重复搬**:`.k-adv-toggle`(`:498`)+ 嵌套 `.chev`(`:509`)**P5e-T2 已搬**;
   `.k-seg` / `.k-btn.text` / `.k-empty*` / `.k-skel` / `.k-modal*` / `.k-btn` / `.k-scroll` / `.k-row-action` /
   `.k-set-card` / `.k-set-row` / `.k-sw` / `.k-radio-group` / `.k2-tag` **均已搬**。
   ⚠️ `knowledgeStyles.test.ts` 有**锚定在区间内的计数断言**,重复搬会报红 —— **这是有意的**。
   🔴 **本期要搬的、前几期故意没搬的**:**`.k-section-body`(`:985`,E-3)** · **`.k-frow`(`:1077`)**。
   ⚠️ 🔴 **协调者的粗匹配显示本仓有「3 处 `k-section-body` / 25 处 `k-frow`」,几乎肯定是 `\b` 词边界的假阳性
   (`k-frow-path` 会被 `k-frow\b` 命中 = E-25 原坑)—— T0 必须用「class 属性完整 token 精确匹配」复核。**
3. 🔴 **N46 —— 同一个域两种命名风格,本期最容易搞错的一点**:
   Wiki 的 `WikiRoot`/`CreateArgs` **无 json tag** ⇒ 响应 **PascalCase**、POST body 必须用 **Go 字段名**
   (Go 解码器大小写不敏感但**下划线不匹配**,`watch_mode` 会被**静默丢弃**);
   而 `/tree`、`/node`、`/raw` 是 **snake_case**。**归一化在共享包里 ⇒ 本期只消费,不再归一化一次。**
   🔴 **T0 必须给「store 出口到底是什么形状」的实测结论**,mock 一律照它。
4. 🔴 **K55 —— `AllowlistView` 的三个 `linear-gradient` 在 `.ts` 常量里,而 `color-guard` 压根不扫 `.ts`**
   (票 B 位置④,变异实测「注释注入 hex 全量全绿」)⇒ **改坏了三门全绿**。必须定向断言 + RED 探针。
5. 🔴 **K53/K54 —— `RootsView` 自带 `<style scoped>` 66 行 9 个 `kr-*` 类,差集法看不到它们(E-63)**,
   且里面有 **2 处 `var(--x, rgba(...))` 兜底字面量**必须去掉。
   ⚠️ **`--bg-tertiary` / `--border` 这两个 token 名在本仓映射层里可能不存在 ⇒ T0 实测后附录 B 定死。**
6. 🔴 **D1 —— Wiki 打不通,大半个 `WikiView` 与整个 `RootsView` 列表本机不可达**;
   **`AllowlistView` 是唯一可真机验的整页,而且整页都是写操作**(§0.2 / §9.17)。
   **不为打不通的接口编造 fixture** —— 一律 `.CONSTRUCTED` 并逐个登记。
7. 🔴 **`DEFERRED_TABS` 剩 3 项(`wiki`/`roots`/`allowlist`)全归本期,清空后机制必须保留**(K8 / 承 P4 I2);
   **`deferred.test.ts` 的「机制钉子」用例一字不许动**。

## 0.2 🔴 上级设计给 P5f 的开工前置(T0 必须先答,答不了不许进 T1)

**唯一一条 = Wiki API 现状复测**(上级设计 §6.3 / D1)。
- **仍超时** → 按 D1 政策执行(本计划的默认假设)。
- 🔴 **已被修好**(`/roots` 与 `/tree` 都 200)→ **停下问用户是否改验收政策**,不许自己决定。

---

## 1. 十刀(T0 → T8)

> **每刀通用 DoD**(不再逐刀重复):三门全绿并落盘完整日志(**不许 `| tail`**)·
> 报告按治理 §10 写全并 **`git add -f`**(**每刀提交时就做**)· 命中的 K/N 条目逐条显式申报 ·
> 🔴 **每条「守卫/断言」类 DoD 都要配 RED 探针**
> (`cp` → 行首锚定注入 → 先证注入落盘 → 报红 → `cp` 还原 → `md5sum` 逐字节比对;
> **禁 `git checkout/restore/stash`**)·
> 🔴 **带 🔴 的「复跑/复扫/独立复核」项不许采信上一刀结论,要跳过必须先停下写 `NEEDS_CONTEXT`** ·
> 🔴 **分段落盘**(每完成一节存一次)· 🔴 **brief 的 RED 判据只是提示,实测不成立时以「能真报红」为准并申报**(R18)。

### T0 —— 探测 + 三份附录 + 样本(**不碰 `src/`**)

**产出**:`p5f-appendix-A-i18n.md` · `p5f-appendix-B-tokens.md` · `p5f-appendix-D-classes.md` ·
`p5f-fixtures/`(含 `README.md`)· `p5f-task-0-report.md`。

1. 🔴 **U-2:SSH fetch 真远端**(`git fetch git@github.com:NimoTech/NimoOS-UI.git main`,HTTPS 无凭据必失败)
   \+ 逐个比对本期 **4 个蓝本文件 + `knowledge.scss` 的三个段** → 报告写「远端 sha + 比对结果 + 本期锁 `7a6ee6b7`」。
   🔴 **比出非注释的功能性差异 → 停下问用户。**
2. 🔴 **三门起点基线自己重跑**(不许照抄 335/4254),并核 `.vue` 总数 = **185** · `color-guard` 用例数 = **187** ·
   `WHITELIST_348` = 348 · `NON_K_HELPER_CLASSES` = 19 · `aiKb*` = 441/441 · 全表 = 1648/1648。
3. 🔴 **前置:Wiki API 现状复测**(§0.2)—— `/v1/wiki/{roots,candidates,tree,node,raw}` 逐条实测
   (**耗时 + 状态码 + 响应体**)。**只读,不发写请求。**
   🔴 **取数不许经网关**(记忆 `gateway-no-userid-injection`);**NimoOS-AI 对 localhost 也强制 JWT** ⇒
   `/v1/ai/*` 要绕到 Parser `:8283` 直连。
   🔴 **实测为「空 / 超时」的,必须写明怎么确认这是真的而不是取法错**(命令 + 原始输出,§9.18-3)。
4. 🔴 **零新依赖逐项实证**(治理 §14 的表**逐行**跑一遍):
   `FolderBrowser` 的 `defineExpose({reset})` · store 九个 wiki action + 四个 allowlist action ·
   `fmtAgo` · `renderMarkdown` · `openFileInNewTab`/`openDirInNewTab` · **`createRootBody` 的导出坐标与签名** ·
   reka Dialog · 🔴 **`KIcon` 本期用到的 glyph 逐个实测**(治理 §1.2,**缺任何一个 → `NEEDS_CONTEXT`**)。
   🔴 **另核 `setRootEnabled`(store action)与 `patchRootEnabled`(包内方法)的关系。**
5. **附录 A**(i18n):**83+ 终值复核**(逐页分组)· 逐条 zh 值(权威 `zh_CN.json`,🔴 **N/N 命中数 + 几条需自造**)·
   逐条 en 值(🔴 **权威 = `en_US.json` 的覆盖值**,**不许假设「en = key」**)· 复用判定表(只认 `aiKb*` 家族)·
   全角标点例外实扫 · 占位符清单(`{ext}`/`{group}`/`{h}`/`{n}`/`{t}`/`{path}` 终值)·
   🔴 **双向撞车扫描表**(治理 §7.1 点名 23 个高危同值)。
   🔴 **必须明确写出「不进 i18n」的两类**:`kw-sec-en` 的 `Contents` / `Recent changes`(蓝本未过 `$t()`)·
   **T0 逐个确认还有没有同类**。
   🔴 **`wikiViewHelpers` 的 i18n 数按 E-65 复核并结案(协调者读全文 = 0)。**
   🔴 **`OP_LABEL_KEYS` 4 个值与 `GROUPS_TEMPLATE` 的 3 个 `labelKey` 是动态过 `$t()` 的,必须进。**
6. **附录 B**(色值):逐处「蓝本 `file:line` → 字面量 → 本仓 token(既有/新建)」。
   🔴 **四块必须定死,实现者不许自选**:
   ① **K55** 三个 `linear-gradient`(6 个 hex);
   ② **K54** 两处 `var(--x, rgba(127,127,127,…))` 兜底 —— 🔴 **先实测 `--bg-tertiary` / `--border`
   在 `.knowledge-app` 映射层里存不存在**,**存在→直接用;不存在→映射到语义最近的既有 token,不许新建**;
   ③ **`AllowlistView:30` 的 `color="white"`** 压在 `.k-ext-chip-mark` 实底上 → 定死用哪个 token
   (记忆:**`--on-accent` 只在 accent 实底上可用**);
   ④ `knowledge.scss` 三个段内的一切 hex/rgba **逐处实扫并给终值**(🔴 **不许写「0 处」而不实扫**,承 E-11)。
   🔴 **新建 token 一律两档都显式写值** + 声明处注释写明蓝本 `file:line`;**附录 B 表里没有的一律 `NEEDS_CONTEXT`**。
7. **附录 D**(类清单):**两部分**——
   ① 以 `p5-master-plan.md` §2 的 **67 类**为核对基准,逐个给「已搬 / 未搬 / 半搬」三态
   (🔴 **不许只给总数**,承 E-39;🔴 **一律「class 属性完整 token 精确匹配」,禁 `\b`**,承 E-25);
   ② 🔴 **K53 的 9 个 `kr-*` 单列一节**(勘误 E-63),并**逐类证明前缀在全仓唯一 ⇒ 丢 `scoped` 无害**。
   另含:**24 死类清单逐字抄进来** · **不许重复搬清单**(§0.1-2)·
   `WHITELIST_348` → 本期终值 + 算式 + **复现命令**(🔴 **以程序化实测为准**;可跑
   `node .superpowers/sdd/p5e-fixtures/scripts/sim-r8r9.mjs` 复现基线)·
   `NON_K_HELPER_CLASSES` 本期终值(`kr-*` 是 k 前缀?🔴 **实测 `NEW_RE` 认不认 `kr-`** —— 它的分支是
   `k(?:2|n)?-`,**`kr-` 不匹配** ⇒ 大概率要进 `NON_K_HELPER_CLASSES`,**T0 给结论与算式**)·
   `@media` / `@keyframes` 段的处置。
   ⚠️ **「常量长度 348 ≠ 扫出数 347」那 1 差是正常的,不许去「修平」**(真因:`knowledge-app` 匹配不上 `NEW_RE`)。
8. 🔴 **`.CONSTRUCTED` 样本产出**(治理 §4.2 / §9.18):按 **Go 结构体**逐字段构造
   `wiki/roots` · `wiki/tree`(**含跨级与父缺位两种拓扑**,给 §9.16 的三个样本用)· `wiki/node`
   (含 `child_map` / `recent_changes` / `ai_label` / `last_modified`)· `wiki/candidates`;
   🔴 **尽量抓一份真的 `.wiki.md` 原文(`/raw` 实测 200)当 `.REAL`** —— 它是 `renderMarkdown` 的真输入。
   🔴 **Parser 的 `allowlist/{extensions,folders}` 抓 `.REAL`**(坐实 `enabled` 的 0/1 整数)。
   🔴 **每份样本标三级出处标签 + 写明构造依据的 Go 坐标。**
9. **Vue2 spec 归属判定**(治理 §4.3):四份逐个给结论;
   🔴 **`knowledgeStoreRoots.spec.js` 与 `dashboardWikiViews.spec.js` 给「已被 P5a 承接 / 属本期 / 无人承接」三态
   + 坐标**;**不许自行改 store 或 Dashboard 的测试**(都在零改动清单上)——有缺口就列出来交协调者裁定。
   🔴 **实扫蓝本 `__tests__/` 全目录,别漏 allowlist 相关 spec。**
10. **§9.17 可点性清单实测补全**(9 项):逐个给「本机可达 / 不可达 + 原因」。
11. 🔴 **`openNoteInNewTab` 判定**(治理 §0.3):本期三页有没有调用点。**协调者初测:没有** ⇒ 复核后结案。
12. 🔴 **K58 的既定错误映射坐标**:去读 `QueueView.vue` / `IndexedFilesView.vue` 怎么把后端错误转 i18n 键,
    **给出那个函数/模式的坐标**。**找不到既定做法 → 写进报告让协调者裁定**(不许各页自造第二套)。
13. **`src/` 零改动自证**(`git diff --name-only -- src/` 为空)。

**评审第一必查项**:🔴 附录 A 的 zh/en 值有没有**自己译的**(P5d 的 C-1 就是这个)——**程序化逐码点比对**,不许目视。
🔴 **附录 D 的 67 类是否与 `p5-master-plan.md` §2 逐个对齐**,且 `.k-section-body` / `.k-frow` 的三态判定
**自己用精确匹配复核一遍**(协调者的粗匹配结论**不可采信**)。
🔴 **自己独立复现 `WHITELIST_348` / `NON_K_HELPER_CLASSES` 的本期终值**(不许信报告)。

---

### T1 —— i18n 键(83+ 键,两档)

**改**:`src/i18n/{zh_cn,en_us}.ts` · `messageSyntax.test.ts`。

1. 附录 A 的全部新键**同时**进两档,零遗漏零多余。`parity.test.ts` 绿。
2. 🔴 **写 `p5f-task-1-i18n-verify.mjs`**(照 `p5e-task-1-i18n-verify.mjs`):**N/N 逐码点 MATCH** + 复用键 **M/M 未被改动**。
   🔴 **en 侧不许假设「en = JSON key」**(E-44 那个 bug)。
3. `messageSyntax.test.ts` 三条:(a) 全角标点扫描 + `toBe` 钉死的例外清单 ·
   (b) 占位符集合一致 · (c)「exactly N keys」防漂移。
   🔴 **占位符反向断言不许写成「渲染结果含 `{x}` 字面量」**(E-45:vue-i18n 静默置空 = 零判别力),
   要断**真实插值出来的值**。
4. 🔴 **键数断言双轨(R12)**:**本批 N 用精确 `toBe`;全表用 `toBeGreaterThanOrEqual`。**
   **绝不许写精确的全表数。**
5. 🔴 **自己重跑双向撞车扫描** + 用**真实模块导入**计全表键数(**实测,别用算式**)。
6. **报告列清**「复用 X / 新增 N / Vue2 有权威 zh 值 M / 本期新造 K / 死键 0(或列出并说明)」+ **D-4 口径**条数。

**评审第一必查项**:🔴 任选 3 个新键各改坏一个字符/占位符名,证明有断言报红;
**独立复跑**双向撞车扫描 + 全表键数;核**「不进 i18n」的那两类**有没有被顺手加进去。

---

### T1b —— 债务刀(I-1 / M-1 / M-2 / M-4)**纯加测试,零产品码改动**

**改**:`SearchView.test.ts`(**只新增**)· `FileDetailDrawer.test.ts`(**只新增**)·
`searchAggregate.test.ts`(**只新增**)· `messageSyntax.test.ts`(**只补一条订正注释**)。

🔴 **四个文件都在全期零改动清单上,本刀极窄解禁**(治理 §1.1)——
**每个文件都要给「既有每一行未动」的 `git diff` 逐行自证。**
🔴 **`SearchView.vue` / `FileDetailDrawer.vue` / `searchAggregate.ts` 的产品码一行不许动**
(P5e 终审已逐字核为正确,这四条都是**纯覆盖缺口**)。

1. 🔴 **I-1**:`runSearch` 的 `topK` / `rerank` 两入参零守卫。
   **落地**:断言 `store.runSearch` 被调用时的实参里 `topK` 取自组件的 `topK` ref、`rerank` 取自 `quality`
   (🔴 **实现者自己回读 `SearchView.vue` 确认这两个入参的真实来源与字段名,不许照抄本行**)。
   🔴 **判据 = P5e 终审的两个探针必须报红**:**把 `rerank` 反转** → 必须红;**把 `topK` 焊死成 10** → 必须红。
   **贴两段输出 + `md5sum` 还原确认。**
2. 🔴 **M-1**:`loadChunkContext` 的 `window: 2` 零守卫。断言调用实参含 `window: 2`。
   **判据:改成 `window: 3` → 必须报红。**
3. 🔴 **M-2**:`highlight` 的 `>= 1` 长度门零守卫(单字查询会全不高亮)。
   🔴 **实现者先回读 `searchAggregate.ts` 的 `highlight` 确认那个长度门的真实判据**,再写**两侧用例**
   (刚好达到门槛 → 高亮;差一个字符 → 不高亮)。**判据:把 `>= 1` 改成 `>= 2` → 必须报红。**
4. **M-4**:`messageSyntax.test.ts:1013` 那条旧理由已被 **R13** 作废(D-9 的 grep 口径已放宽)⇒
   **补一条订正注释**(引条目编号 **R13**,🔴 **不引 `file:line`** —— 行号会随后续改动失效)。
   **只改注释,不动断言。**

**评审第一必查项**:🔴 **四条断言各自独立报红**(自己做探针,不许信报告)·
🔴 **产品码真的零改动**(自己 `git diff -- src/ai/knowledge/views/SearchView.vue …`)·
🔴 **既有断言有没有被「顺手放宽」**(§9.10,违者按 Critical 报)。

---

### T2 —— `knowledge.scss`(**本期最大的一刀,67 + 9 类 ≈ 410 行**)

**改**:`src/ai/styles/knowledge.scss` · `knowledgeStyles.test.ts`。**产品 `.vue` 零改动。**

1. 按附录 D **逐段搬**:`:985-1160`(**扣掉段尾 `:1152-1160` 的 6 个死类**)· `:1342-1400` · `:2453-2561`
   \+ **K53 的 9 个 `kr-*`**(从 `RootsView.vue` 的 `<style scoped>` `:223-289` 搬)。
   🔴 **一律嵌进 `.knowledge-app`**(K9);必须顶层的走 K44 的**具名例外**机制
   (那条「顶层裸选择器集合恰等于 `[...]`」的**集合相等**断言要加成员,**不是放宽正则**)。
2. 🔴 **24 个死代码类一个都不许搬**(治理 §6.2)。
   🔴 **`knowledgeStyles.test.ts:491` 那条断言已存在** ⇒ **不许改它,报红就回查死类清单。**
   🔴 **报告必须写明「白名单报红时先回查死类清单,不许改白名单」这条已被自己遵守。**
3. 🔴 **不许重复搬**(§0.1-2 的清单)。⚠️ 区间锚定的计数断言重复搬会报红 —— **这是有意的**。
4. 🔴 **K54 落地**:两处 `var(--x, rgba(...))` 兜底**按附录 B 改成纯 token**;
   报告要论证**渲染语义等价**(兜底只在 token 缺失时生效,而映射层保证不缺 ⇒ 兜底本是死代码),
   并**逐个证明该 token 在两档都有值**。
5. 🔴 **配色**:按附录 B 逐处映射;新建 token **两档都显式写值** + 声明处注释写明蓝本 `file:line`;
   **附录 B 表里没有的一律 `NEEDS_CONTEXT`**。
   🔴 **全文色扫**:token 声明层之外,**含注释**零 hex/rgb/rgba/hsl/具名色。
6. 🔴 **守卫更新**:`WHITELIST_348` → 本期终值(**常量名跟着数字改**,本档习惯)·
   `NON_K_HELPER_CLASSES` 集合相等断言(🔴 **`kr-*` 归哪一侧按附录 D 的结论**)·
   🔴 **开工前先独立复现附录 D 给的那几个数再动手**(不许信附录)。
7. 🔴 **K53 的两条自证**:① `RootsView.vue` 尚未创建 ⇒ 本刀只搬内容,**T5 建文件时必须零 `<style>` 块**
   → 🔴 **加一条「自动上膛」条件断言**:「若 `views/RootsView.vue` 存在,则它必须**不含** `<style`」
   (`node:fs` 读,**自带防空转断言**;两条判据:**惰性证明**见于 passed 列表且非 skip/todo ·
   **上膛证明**临时创建带 `<style>` 的文件 → 报红 → 删除还原 → 转绿,**临时文件不许提交**);
   ② 逐类证明 `kr-*` 前缀在全仓唯一(丢 `scoped` 无害)。
   🔴 **按 §9.19 论证这条守卫与 T5 范围不冲突**(T5 本来就不许写 `<style>`)。
8. **额外门**:`pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` exit 0。
9. 🔴 **逐段对蓝本 `git show` 比对**:结构 / 顺序 / 嵌套逐字、边界无截断、无重复定义。
   ⚠️ `:2453-2561` 段内含 `@media` 与 `.knowledge-app` 段头 —— **按附录 D 的处置,不许自己发明**。

**评审第一必查项**(🔴 **上级设计 §9-1 明令:scss 任务的评审要专做逐行色扫**):
逐行色扫全部新增段(**含注释**)· 🔴 **亲手把一个死类加进 `knowledge.scss` 验那条断言真报红** ·
🔴 **亲手验第 7 条的上膛守卫两种偏态** · **自己重跑白名单/非 k* 两个数字**(不许信报告)·
🔴 **核 K54 有没有把兜底字面量「照抄」进来**(自己 grep `rgba(` 与 `127,`)。

---

### T3 —— `util/wikiViewHelpers.ts`(蓝本 95 行)

**改**:新建 `src/ai/knowledge/util/wikiViewHelpers.ts` + `wikiViewHelpers.test.ts`。**其它零改动。**

1. 逐字移植 `baseName` / `buildWikiTree` / `findParent`(模块私有)/ `trailFor` / `opToType` / `parseTs` /
   `rootForPath` / `renderWikiMarkdown`。
   🔴 **`renderMarkdown` 的 import 层数自己现测**(`src/ai/markdown/renderMarkdown.ts`)。
   🔴 **零 `any`**(承 K41):给扁平节点、树节点、root 各写窄接口,文件头登记「字段依据 = 蓝本哪一行读了它」。
2. **承接 Vue2 `wikiViewHelpers.spec.js` 的全部行为**并加细:
   - `baseName`:空/非字符串 → `''` · 单字符 `/` · 尾斜杠(`'/a/b/'` → `'b'`)· 无斜杠 · **`slice(i+1) || s` 的兜底分支**。
   - 🔴 **`buildWikiTree` 按治理 §9.16 的三个样本 + 乱序一条**(取自 T0 的 `.CONSTRUCTED` 拓扑样本):
     ① **父缺位** ⇒ 成为根且 `name` 是**全路径** · ② **跨级** ⇒ 父是 `/a` 不是 `/a/b`
     (🔴 **判据:把 `findParent` 换成「只切一级」→ 这条必须报红**)· ③ **重复行**去重 ·
     ④ **乱序输入**(🔴 **判据:删掉 `sort` → 必须报红**)。
   - `trailFor`:`'/a/b/c'` → 三个已知节点 · 中间节点缺位时**被过滤掉** · 空/非字符串 → `[]`。
   - `opToType` **四分支 + 未知值兜底**(`modify` 与任何未知值都 → `'mod'`,N58)。
   - `parseTs`:空串 → `0` · 非法串 → `0`(`Number.isFinite` 分支)· 合法 RFC3339 → 毫秒。
     🔴 **返回的是毫秒**(下游 `fmtAgo(ms)` 吃毫秒)—— **秒/毫秒两侧都要用例**
     (承 P5d-T3 与 P5e §9.13 的教训:**喂错单位静默产出 1970 年**)。
   - `rootForPath`:**最长前缀取胜**(两个 root 都匹配时取长的)· 精确相等 · 尾斜杠归一 ·
     非前缀但同名开头(`/data2` 不该匹配 `/data`)🔴 **这条是真陷阱,必须有** · 空 roots → `null`。
   - `renderWikiMarkdown`:一条「就是转发 `renderMarkdown`」的断言。
     🔴 **XSS 用例归 T7 的组件层**(治理 §9.15:**禁止 mock 掉 `renderMarkdown` 之后还声称验过 XSS**)。
3. 🔴 **自动上膛守卫**:`views/WikiView.vue` 还不存在 → 加一条**文件系统条件断言**
   「若 `views/WikiView.vue` 存在,则它必须 import `../util/wikiViewHelpers`」——
   **现在惰性通过,T6 一创建文件立刻上膛**。两条判据(惰性证明 + 上膛证明)+ 🔴 **自带防空转断言**。
   🔴 **按 §9.19 论证与 T6 范围不冲突**(T6 建文件时就写 imports)。

**评审第一必查项**:🔴 **代码膨胀逐行判定**(蓝本 95 行)—— 逐行判哪些是 TS 类型/申报注释(正当)、
哪些是**未申报的新逻辑 / 被「修正」的行为 / 顺手抽的抽象**(裁定 R22:连提常量也要申报)。
🔴 **亲手跑两组探针**:`findParent` 只切一级 · 删 `sort`。
🔴 **核 `rootForPath` 的「同名开头不该匹配」用例是不是零判别力**(把 `.replace(/\/+$/,'') + '/'` 去掉 → 必须红)。

---

### T4 —— `AllowlistView.vue`(蓝本 249 行)

**改**:新建 `views/AllowlistView.vue` + `AllowlistView.test.ts` · `knowledgeStyles.test.ts` **+1 行**(登记新 `.vue`)。

1. 逐字移植蓝本 `:1-249`。🔴 **K44:`.vue` 侧零 `<style>` 块。**
2. 🔴 **K55 落地**:`GROUPS_TEMPLATE` 的三个 `bg` 字段改 `var(--…)`(附录 B 定死);
   🔴 **必须补 K40 同款定向断言**(照 `knowledgeStyles.test.ts` 里 P5d-T3 的 `NOTE_TYPES` 断言形态):
   钉「这三个 `bg` 只含 `var(--…)`、零 hex/rgb/具名色」——
   🔴 **判据:注入一个 hex → 必须报红**(贴两段输出 + `md5sum` 还原)。
   ⚠️ **`color-guard` 不扫 `.ts`/`.vue` 的 `<script>` 常量 ⇒ 这条断言是唯一防线。**
3. 🔴 **`AllowlistView:30` 的 `color="white"`** → 按附录 B 换 token。**一条用例钉住它不是具名色。**
4. 🔴 **N54 三张扩展名表逐字照抄**(12 + 13 + 24 项)。**三条用例**:
   分组正确 · `localeCompare` 排序 · **空组整组不渲染**(`filter(g => g.exts.length > 0)`)。
   🔴 **不许「补全」任何扩展名** —— 改了会静默隐藏/显示扩展名。
5. 🔴 **N47**:`:data-on="String(e.enabled)"` 照抄,测试断 `'true'`/`'false'` **字符串**。
   一条「`enabled` 是 0/1 整数时 chip 也能正确翻转」的用例(mock 用 T0 的 `.REAL` 样本)。
6. 🔴 **N52 `setAllInGroup`**:串行 `for` + `await` + `if (e.enabled !== on)` 跳过。
   **两条**:已是目标态的**不发请求** · 顺序是串行(🔴 **判据:改成 `Promise.all` → 必须报红**;
   实现者自己设计能分辨串并的断言,如按调用顺序 + 每次 mock 延迟)。
7. 🔴 **N53 `addCustom` 三条**:`log` → `.log` · `.LOG` → `.log` · 空串 → **不发请求**。
   \+ 成功后 `customExt` 清空一条。
8. 🔴 **K57 新增规则弹窗转 reka**:`DialogRoot`/`DialogPortal to=".knowledge-app" defer`/`DialogOverlay class="k-modal-bg"`/
   `DialogContent class="k-modal"` + `<DialogTitle as-child>` 套在既有 `.k-modal-title` 上。
   **三条**:打开 · 关闭 · **点遮罩关闭**(`pointerDownOutside` 等价)。
   🔴 **不许再写 `@click.stop`**;报告说明 `DialogPortal to` 只认第一个同名宿主为何在此安全。
9. 🔴 **`saveRule` / `removeRule`**:成功 → `store.toast(...)` 且**表单重置成 `{root_id:'any', path_glob:'/Downloads/*', action:'deny'}`**
   (照抄 `:234` 的重置值)· 失败 → **K58 的错误映射**(不回显后端 body)。
   🔴 **`:disabled="!form.path_glob.trim()"` 两侧用例。**
10. 🔴 **`store.toast(...)` 一律走 store**(裁定 R27 / E-62 —— **直调 `useToast()` 会丢掉蓝本的 2400ms**)。
11. **空态**:`folderRules.length === 0` → 那段提示;非空 → `k-frow-head` + 行。**两侧用例。**
12. **模板内零裸色**(缺口③′ 会扫;本文件加进 `KNOWLEDGE_VUE_FILES`)。

**评审第一必查项**:🔴 **亲手往三个 `bg` 里注入一个 hex 验第 2 条断言真报红** ·
🔴 **N52 的串行断言是不是零判别力**(改成 `Promise.all` 仍绿?→ Critical)·
🔴 **N54 的三张表与蓝本逐字比对**(自己 `git show`,别信报告)· 🔴 **核 §9.10 有没有被违反**。

---

### T5 —— `RootsView.vue`(蓝本 289 行,`<style>` 已由 T2 搬走)

**改**:新建 `views/RootsView.vue` + `RootsView.test.ts` · `knowledgeStyles.test.ts` **+1 行**。

1. 逐字移植蓝本 `:1-221`。🔴 **K44 / K53:`.vue` 侧零 `<style>` 块** ——
   **T2 那条「自动上膛」守卫现在上膛**,报告要写明它走「已存在」分支且已满足。
2. 🔴 **N46 落地**:页面读 `r.watchMode` / `r.scanIntervalS` / `r.lastScanAt` / `r.enabled` / `r.path` / `r.id`
   —— **按 T0 的实测结论确定 store 出口形状**,mock 一律照它。**搞反了按 Critical 报。**
3. 🔴 **`createRootBody` 从共享包 import**(D3 已进包),**不许在本仓重写**。
   一条用例断「传给 `store.createRoot` 的 body 是 `createRootBody(...)` 的产物」——
   🔴 **必须钉住 `watchMode` / `scanIntervalH` / `mirror` 三个入参真的传到位**
   (N46 的下划线陷阱:传错会被后端**静默丢弃**,真机无报错)。
4. 🔴 **`FolderBrowser` 接线**:`:roots="browserRoots"`(= `pickerRoots(store.state.wikiCandidates)`)·
   `@pick="onBrowsePick"` · 🔴 **`openAdd` 里的 `nextTick(() => fb.value?.reset())`**
   (蓝本 `:158` 的 `$nextTick` + `$refs.fb.reset()`)。
   **两条**:pick 回填 `form.path` · **`openAdd` 真的调了 `reset()`**(judged by spy;
   🔴 **判据:去掉 `nextTick` 或 `reset()` → 必须报红**)。
   ⚠️ **`FolderBrowser.vue` 在零改动清单上**,已核它 `defineExpose({ reset })`。
5. **`canSubmit` = `form.path.startsWith('/')`** 两侧用例;`submitting` 门一条(治理 §5.2)。
6. 🔴 **K59 `addError` 走弹窗内联**(不是 toast):**409 → 文案 + 「以镜像模式添加」按钮**(N50)·
   **非 409 → K58 映射文案且无按钮**。两条。
   🔴 **兑现记忆 `newui-dialog-error-not-toast`**(toast z-index 60 会被弹窗遮罩 1000 压住)。
7. 🔴 **N51 `toggle()` 的 404 专属文案**照抄(「Backend version too old — deploy the Wiki service update first.」)
   —— **这恰好是本机会命中的分支**。两条(404 / 其它错)。
   ⚠️ 🔴 **注意蓝本 `:166` 的 toast 文案与 `r.enabled` 的关系是「反的」**
   (`r.enabled ? '已启用' : '已停用'` —— 而它调的是 `setRootEnabled(!r.enabled)`)。
   🔴 **实现者必须自己判定这是不是蓝本 bug**:若是 ⇒ 按用户 2026-07-27 拍板的
   **「界面照 Vue2、逻辑照正确」** 改正确 + **三件套齐全**(注释引蓝本 `file:line` + 报告申报 + 台账登记);
   若判定不是 bug ⇒ 论证为什么。**两种结论都要有用例钉住最终行为。**
8. **`rescan()`** 成功/失败两条 · **`confirmDelete()`** 带 `purgeFiles` 两侧 + **删完 `deleting=null` / `purgeFiles=false`** 一条。
9. 🔴 **K57 两个弹窗转 reka**(新增 + 删除确认),各三条(打开 / 关闭 / 点遮罩关闭)。
10. **空态**:`!roots.length && !wikiRootsLoading` → `kr-empty`(**本机唯一可达态**,§9.17);
    非空 → `k-set-card` 列表。**两侧用例。**
11. **模板内零裸色**;`:15` 的 `color="var(--text-tertiary)"` **已是 token,照抄**。

**评审第一必查项**:🔴 **第 7 条的 toast 文案方向** —— 自己读蓝本 `:163-173` 判一遍,
**实现者的结论与你不同 → 按 Important 报**。
🔴 **第 3 条的三个入参真的有断言钉住吗**(N46 的静默丢弃是「三门全绿、只在真机上错」那一类)·
🔴 **第 4 条的 `reset()` 断言真报红吗**(自己去掉 `reset()` 试)。

---

### T6 —— `WikiView.vue` 上半(左树 + 选择 + 深链 + 文章骨架)

**改**:新建 `views/WikiView.vue` + `WikiView.test.ts` · `knowledgeStyles.test.ts` **+1 行**。

**范围**:模板 `:1-46`(左树三态 + 空树 onboarding)+ `:48-75`(面包屑 / 标题 / 打开文件夹 / 文章骨架)·
script 的 `visibleNodes` / `trail` / `crumbParents` / `selTreeNode` / `selName` / `selAiLabel` / `updatedFmt` /
`owningRoot` · `loadTree` / `isOpen` / `toggle` / `nodeClick` / `select` / `fetchArticle` / `openFolder` ·
`$route.query.path` 的 watch。
🔴 **不写**:`:76-141` 的 `kw-meta` 之后全部(摘要渲染 / 目录 / 最近变更 / 页脚 / 查看源码)· `html` / `changes` /
`childIsDir` / `childPath` / `childClick` / `rescan` / `fmtTs` / `OP_LABEL_KEYS` → **全归 T7**。
⚠️ **不许为了「能看见」提前写摘要区 markup。**

1. 逐字移植上述范围。🔴 **K44:零 `<style>` 块**;**T3 那条上膛守卫现在上膛**,报告写明已满足。
2. 🔴 **K56 面包屑**:`:key` 挪到 `<template v-for>` 自身,内部两元素不再各带 key。
   **一条用例断 DOM 序列**(`button, span('/')` 交替 + 末尾 `span.cur`)。
3. **左树三态各一条**:`treeLoading` → 6 个 `k-skel` · `treeError` → `kw-tree-note` + **重试按钮** ·
   `!treeRoots.length` → 「尚未生成」提示 · 有树 → `kw-node` 列表。
   🔴 **`treeLoading` 期间重试按钮不渲染**一条(治理 §5.2 第 2 行的论证需要它当守卫)。
4. 🔴 **`visibleNodes` 的展开/折叠**:`isOpen` / `toggle` / **`nodeClick` 的「选中并展开」**;
   **缩进 `paddingLeft: (8 + depth*14) + 'px'` 逐字**(一条断 style)。
   🔴 **`toggle` 的 `@click.stop` 必须保留**(点 chevron 不触发选中)—— 一条用例。
5. 🔴 **`select()` 三件事**:设 `sel` · **展开每一个祖先**(`trailFor` 循环)· `router.replace` 写 `?path=`。
   **`fromRoute: true` 时不写 query** 一条(防回环)。
   🔴 **按 §9.14-3 防坑:回写的值必须与初始值不同**,否则 Vue watch 的 `Object.is` 去重让回调压根不执行
   = **零判别力**。**判据永远是:拿掉产品代码的守卫,这条用例必须红。**
   🔴 **N57 的 `.catch(() => {})` 照抄**(vue-router 重复导航会 reject)。
6. 🔴 **N56 深链两半都要**:① `loadTree` 里读一次 `route.query.path` 决定初始选中
   (**query 命中 → 选它;未命中 → `roots[0]`;都没有 → `''`**,三条)·
   ② **watch 不是 `immediate`**、条件 `v && v !== sel && byPath[v]`(三条:切换生效 / 相同值不重复 / `byPath` 无此路径时不动)。
   🔴 **「挂载后改地址栏 query → 真的切换」必须有**(记忆 `newui-router-query-only-no-remount`;
   **判据:删掉 watch → 该用例必须报红**)。
   🔴 **不许把两半「统一」成 `immediate: true`**(N56 说明了为什么)。
7. 🔴 **N55 `fetchArticle` 的过期守卫照抄**(三处 `if (sel !== p)`):
   ① **逻辑**交错(选 A → 选 B → B 先回 → A 后回,断言是 B 的)·
   ② 🔴 **「两实例交错」守作用域**(**判据:把 `sel` 挪到模块级 → 必须报红**)·
   ③ **catch 分支也有守卫** · ④ **finally 的 `nodeLoading` 也带守卫**。**四条各自独立报红。**
   🔴 **`Promise.all([loadWikiNode, loadWikiRaw])` 照抄**;**N48**:404 → `null`,其余上抛 → 走 catch + toast。
8. **`updatedFmt` / `selName` / `selAiLabel` 的兜底**:`selTreeNode` 为 null 时 `selName` 退化成 `sel` 一条;
   `parseTs` 返 0 时 `updatedFmt` 为 `''` 一条。
9. **`openFolder()`** → `openDirInNewTab(sel)` 一条(mock `openInApp`)。
10. 🔴 **`created` 的 `if (!wikiRoots.length) loadRoots()`** 照抄(**有 roots 时不重复拉**)—— 两侧用例。
11. **模板内零裸色**;🔴 **`:59` 的 `--ly: var(--ly-wiki)` 已核两档都有值,照抄**。
12. 🔴 **自动上膛守卫**:加一条「若本文件模板出现 `kw-summary`(T7 的摘要区),则必须同时出现
    `showSource` 切换按钮」—— **现在惰性通过,T7 一写 markup 立刻上膛**。两条判据 + 防空转断言。
    🔴 **按 §9.19 论证与 T7 范围不冲突。**

**评审第一必查项**:🔴 **第 7 条四条守卫各自独立报红**(不是只有一条在起作用)·
🔴 **第 6 条的深链用例是不是零判别力**(尤其「相同值不重复」那条 —— §9.14-3 的 `Object.is` 坑)·
🔴 **第 5 条「展开每一个祖先」真的有断言吗**(去掉那个循环 → 必须红)。

---

### T7 —— `WikiView.vue` 下半(摘要 / 目录 / 最近变更 / 源码切换 / 重扫)

**改**:`views/WikiView.vue`(续写)· `WikiView.test.ts`(续写)。**零新建文件。**

1. 逐字移植模板 `:76-141` + script 的 `html` / `changes` / `childIsDir` / `childPath` / `childClick` /
   `rescan` / `fmtTs` / `OP_LABEL_KEYS`。**T6 那条上膛守卫现在上膛**,报告写明已满足。
2. 🔴 **§9.15 XSS(K49 同族第二次)**:`v-html="html"`。
   **必须挂载组件后查真实 DOM**:喂含 `<script>alert(1)</script>` 与 `<img src=x onerror=1>` 的 `raw` →
   `querySelector('script')` 为 **null**、`onerror` 属性不存在,正常 markdown 结构仍在。
   🔴 **禁止 mock 掉 `renderMarkdown` 之后还声称验过 XSS**(安慰剂测试)。
3. 🔴 **`raw !== null` vs `null` 两个分支**:非 null → `kw-rawsrc`(源码)/ `kw-summary`(渲染)按 `showSource` 二选一;
   null → `kw-pending` 那屏 + **`v-if="owningRoot"` 的重扫按钮**(🔴 **`owningRoot` 为 null 时按钮不渲染** —— §9.17 可点性)。
   **四条。**
4. 🔴 **`showSource` 切换**:`:137` 的按钮文案在 `Rendered view` / `View source` 之间翻转,
   且 **`fetchArticle` 每次都把 `showSource` 重置为 `false`**(`:264`)—— **两条**(翻转 + 换选中后回到渲染视图)。
5. 🔴 **`childMap` 目录区**:`v-if="node && node.childMap.length"`(**N49 的兜底照抄**)·
   `childIsDir` 决定图标与 `data-kind` · **`c.isOpaque` → 「已折叠」提示**(两侧)·
   `c.lastModified ? fmtTs(...) : ''` 两侧。
   🔴 **`childClick` 两分支**:`byPath[full]` 命中 → `select(full)`;未命中 → `openFileInNewTab(full)`。
   🔴 **`childPath` 的 `base === '' ? '' : base` 是恒等式(N58)** —— **照抄不化简,报告点明**;
   一条根路径用例(`sel === '/'` 时拼出的路径)。
6. 🔴 **`changes` 区**:`v-if="changes.length"` · **`.slice(0, 10)` 上限**(🔴 一条「12 条只渲染 10 条」用例)·
   **前缀剥离**(`root.path` 剥掉后显示相对路径;🔴 **两侧**:命中前缀 / 不命中时显示全路径)·
   `opToType` → `data-type` · **`OP_LABEL_KEYS` 四个键 + 未知 op 兜底 `Updated`**(五条或参数化)·
   `c.at ? fmtAgo(parseTs(c.at)) : ''` 两侧。
   🔴 **参数化守卫要防空循环**(§9.14-4):用 `--reporter=verbose` 确认 N 条独立用例真在执行。
7. 🔴 **`rescan()`**:`owningRoot` 为 null 或 `rescanBusy` 时**不发请求**(两条)· 成功/失败各一条 ·
   **`finally` 里 `rescanBusy=false`** 一条。
8. **`kw-foot`** 的 `v-if="raw !== null"` + 文案里的 `{path}` 插值(`sel + '/.wiki.md'`)一条。
9. **模板内零裸色**;`:69-73` 的内联尺寸样式照抄(N24 同族)。

**评审第一必查项**:🔴 **第 2 条的 XSS 用例是不是真的走了 `renderMarkdown`**
(检查有没有被 mock 掉;被 mock 还声称验过 → 按 Critical 报)·
🔴 **第 6 条的 `.slice(0,10)` 与前缀剥离各自有断言吗**(去掉 slice → 必须红)·
🔴 **第 5 条 `childClick` 两分支各自独立报红吗**。

---

### T8 —— 收官刀(清空 `DEFERRED_TABS` + 三条路由反转 + 构建管线门 + 收官数字)

**改**:`deferred.ts` + `deferred.test.ts` · `knowledgeRoutes.ts` + `knowledgeRoutes.test.ts`。

1. **`DEFERRED_TABS` 3 → 0**(摘 `'wiki'` / `'roots'` / `'allowlist'`)。
   🔴 文件头按「反转不删」加**第六代块**:带时点 + 「三项已迁(P5f)」+
   🔴 **明写「P5 六批全部完成,占位清单已空;机制本身按 K8 / P4 I2 保留」**。
2. **`knowledgeRoutes.ts` 的三条子路由:`KnowledgeDeferred` → 真组件。**
   六条断言反转(每条路由一条正向 + 原文留注释),**改前原文留成注释**(承五代→第六代谱系)。
3. 🔴 **§9.20 落地**:
   - **`deferred.test.ts` 的「机制钉子」用例一字不许动**(报告给「该用例 diff 零命中」的自证);
     🔴 **变异验证**:`isDeferred` 硬编码 `return false` → **必须报红**。
   - 🔴 **清空后必须仍有用例证明机制**有能力工作:空数组下 `isDeferred(任意)` 为 `false`,
     **且要有一条用「临时非空清单」证明机制仍能判真的用例**(不许只断空数组)。
   - 🔴 **「路由改回占位 → 必须有断言报红」** —— 三门全绿说明这次反转根本没有守卫(**按 Important 报**)。
     **三条路由各试一次。**
4. 🔴 **构建管线门(顺序不许颠倒,先抓改前证据)**:
   ```
   改前: rm -rf dist && pnpm build && grep -o "kw-split\|AllowlistView\|RootsView\|WikiView" dist/assets/*.js  → 必须零输出
   改后: 同命令 → 必须命中
   ```
   🔴 **判据必须上下文感知**(承 E-25)—— 贴命中处上下文,证明只能来自真实编译代码
   (`defineComponent({__name:…})` / `createBaseVNode(…class:…)`)。
   🔴 **CSS 命中不作 JS 证据**(承 E-8)—— 本期 scss 从 T2 起就进产物,**要核的是 JS 侧**。
5. 🔴 **收官口径六个数字自己实测**:测试文件数 · 用例数 · `.vue` 总数 · `color-guard` 用例数 ·
   `aiKb*` 键数 · 全表键数(zh/en 各自独立量 + 差集均空)。
   🔴 **用例数归因表必须与总数自洽**(裁定 R24)。
6. 🔴 **死键核查**:本期新增全部键用**词边界** grep 逐键扫 `src/`
   (口径:`grep -rlw --include='*.vue' --include='*.ts' -e "$k" src/ | grep -v '^src/i18n/' | grep -v '\.test\.ts$'`),
   **列出零消费的键**。间接消费(写在常量 `label`/`labelKey` 字段上、由 `t(...)` 渲染)要逐条落地核实,不算死键。
7. **验收导航路径核实**:`/ai/settings` 顶栏「详情」→ `/ai/knowledge` → 左栏第 3 / 6 / 7 项**现在真能渲染**
   (🔴 **rail 序号自己现测**);给出可直接粘贴的 `?path=` 深链 URL。
   🔴 **报告要写明「rail 9 项现在零占位页」**。
8. 🔴 **交接:`openNoteInNewTab` 的最终处置**(按 T0 结论;仍无调用点 → 明写「继续不补,转下一期」)。

**评审第一必查项**:🔴 **自己重做一遍构建管线门的三步**
(当前命中 → 临时撤反转 + `rm -rf dist` 重建 → **必须搜不到** → `cp` 还原 + md5 → 再 build 恢复命中)——
**这条证明的价值全在顺序上。**
🔴 **用例数不变可能掩盖「删一条加一条」** → 逐条对比两个测试文件改前改后的用例名与断言。
🔴 **亲手把 `isDeferred` 改成 `return false` 验机制钉子真报红。**

---

## 2. 收官后的协调者动作

1. 🔴 **`git add -f` 全部台账文件并提交 —— 每刀就做,别攒到收官**(P5d 收官时发现 30 个文件从未被跟踪)。
2. **派全支终审(opus)**,要求它查逐刀评审看不到的四类:
   ① 跨刀一致性(三个新 `.vue` 写法 / K57 三个弹窗是否同源 / 本期新键死键核查)·
   ② 收官数字自测 + 三门自跑 · ③ 「产品代码对、守卫为零」最后一遍扫 · ④ 债务与遗留项完整性。
   🔴 **并要求它复核协调者本人的裁定**:E-63(K53 的 9 个 `kr-*`)· K54 的兜底去除 · K55 的定向断言 ·
   T1b 的四条债务 · **T5 第 7 条那个「toast 文案方向」的判定** · M-3/M-6 的「不做」。
3. **写验收清单**(`p5f-acceptance-checklist.md`),严格按治理 §13:
   第一项是**三屏各自的导航路径** · §9.17 的 9 项可点性逐个照抄 ·
   🔴 **Allowlist 与 Wiki/Roots 分开写**(前者列真机验收项且**逐项标红 + 恢复步骤**;后者只界面走查)·
   🔴 **必须主动告知的五条**(治理 §13-5)。
4. **不部署 · 不 push · 不合 master。**
5. 🔴 **收官时再向用户提一次两件事**:
   ① **`sp8-ai` 合 master 的时机与顺序**(非快进、4 个冲突文件、与 `sp7-photos` 压同一 base,**已积压两期**);
   ② **P5f 收官 = P5 六批全部完成** ⇒ 下一期是 **P6 cutover**(strangler `/ai` 前缀 + 回退 flag),
   还是先做 **4 张后端票 / 合并**?

## 3. 🔴 需要用户拍板的事(本期开工时)

| # | 事 | 我的建议 |
|---|---|---|
| 1 | **T1b 债务刀**(I-1 + M-1 + M-2 + M-4)排进本期 | **排**(kickoff §7 明写 I-1「别一直挂着」;四条同域、纯加测试、约 1 h) |
| 2 | **M-3 / M-6 不做** | **不做**(M-3 改的是全仓守卫范围、扩范围可能扫出别期存量;M-6 是零行为影响的风格瑕疵且文件在零改动清单上) |
| 3 | **K53/K54/K55 三条新偏离** | 照 §3 做(`kr-*` 进 `knowledge.scss` · 兜底字面量改纯 token · 三个渐变改 token 并定向断言) |
| 4 | **Wiki 若已被修好** | 🔴 **T0 实测后停下问你**是否改验收政策 |
