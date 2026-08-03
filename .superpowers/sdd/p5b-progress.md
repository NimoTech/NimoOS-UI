# SDD ledger — plan: NimoOS-UI/docs/superpowers/plans/2026-08-01-vue3-migration-sp8-p5b-indexops.md

SP8-P5b 索引运维 · subagent-driven
Repos: `NimoOS-UI`(只读共享检出 `docs/vue3-migration-sp3`) / `.sp8/NimoOS-New-UI`(`sp8-ai`,唯一可写) / `.sp8/NimoOS-Service`(`sp8-ai`,本期零改动)
起点 BASE: New-UI `sp8-ai`@`d8efb0e`
**实测基线(协调者 2026-08-01 跑,以此为准)**: `pnpm test` → **313 文件 / 2872 例全绿**,exit 0
验收: `:5288`(pid 2699152,dev server 已在跑)
派发链: T0 → T1 → … → T10(单车道,不并发)

## 协调者开工前的计划扫查(3 条,已自行裁定,未阻塞)

- **F1 · 附录 B 里的「T4 已做 / 承 T11 先例 / 照 T10/T12 先例」全是 P5a 的任务号,不是本期 T4/T10/T11/T12。**
  裁定:凡附录 B/§2 里提到「T4 已做」「T11 先例」「T10/T12 先例」,一律读作「P5a 的同名任务已经做过,现状已在 `knowledge.scss` 里,本期**不要重复改**」。落地判据只有一条:**下笔前 grep 现状文件**,已存在即不动。
- **F2 · T2 第 4 条与附录 B.2 对两个 token 的归属自相矛盾。**
  T2 说「本段用到 `--success-soft-border` / `--purple-soft` / `--danger-hover`,`--danger-soft-faint` 留 T6」;但 B.2(T2 段)的 `:1417` 明确映射 `--danger-soft-faint`,而 `--purple-soft` 在 B.2 里一处没有(它出现在 B.3 = T6 段的 `:1894`)。
  裁定:**以「只声明真正用到的」这条硬规则为准,附录 B 的逐行映射表是权威,T2 第 4 条的那句枚举是笔误。** T0 要在 `p5b-common-constraints.md` §6 里按 B.2/B.3 逐行核过之后,写死「哪个 token 在哪个任务声明」的表,并显式登记本条勘误。
- **F3 · 附录 C 的 fixture 抓取没有挂在任何任务下,但 §9 规定「任务的 mock 从 `p5b-fixtures/` 取,禁手编」。**
  裁定:**并进 T0**(它本来就是全批权威源任务)。T0 跑 **C.1 全部 + C.2 全部**,逐字落盘;**C.3 破坏性一条都不跑**(留到验收阶段用户在场时再逐条点头)。

---

## 任务流水

### T0 — 治理文件 + 三份附录 + fixture(opus)

- BASE `d8efb0e` → commit `866979a`(23 文件全在 `.superpowers/sdd/`,显式 pathspec,零越界)
- 产出:`p5b-common-constraints.md`(13 节)· 附录 A(**100 键**)· 附录 B(32 行 / 39 处)· 附录 D(85 类)· `p5b-fixtures/`(C.1 13 + 追加 1 + C.2 3 + README;**C.3 一条未跑**)
- **T0 查出计划书 10 条勘误 + 2 条守卫缺口 + 2 条真实缺口新增(K20 `aiKbStatusIndexing` / N13 `.k-status-badge-cn`)。opus 评审逐条独立回权威源复核 → 全部成立,附录 A/B/D 的每个行号、值、类名零错。**
- 评审结论:spec ❌(漏 1 项)· 质量不通过 —— **2 Critical + 1 规格漏项 + 1 Important,全是「漏写」不是「写错」**:
  - **C1** 蓝本 `QueueView.vue:87` failed 桶空态的 3 处**模板内联**渐变色字面量没进附录 B,而附录 B 自称覆盖全部 39 处 → T5 只能停下问或硬编码;且 `color-guard.test.ts:44-56` 对 `.vue` 只扫 `<style>` 块,**模板 `style=` 属性是守卫盲区**
  - **C2** `statusBadgeMap.en` 一物两用(蓝本 `:195` 原始英文给 `:title` / `:197` 走 `$t()` 给徽标文字)只写在 T0 报告里没进治理文件 → T9 大概率合并成一个字段,tooltip 静默回归,且计划书 T9 的 DoD 没要求断言 `title`
  - **I1/spec❌** 计划书 §4「全期零改动」文件清单(`KnowledgeLayout`/`DashboardView`/`KIcon.vue`/`util/{indexedFiles,dashboardHelpers}.ts`)+ 设计 §2.1「19 个 glyph 已核实都在 KIcon」两条没搬
  - **I2** 附录 A 主表 #84 的「与 #95 同值」是计划书旧编号残留,T0 重编号后 #95 已是别的键,应为 #24
  - Minor:M1 ⚠️N「8 处 vs 9 行」自相矛盾(实为 9 行 / 7 组)+ 3 行裸 `⚠️N` 无理由 · M2 附录 D §D.6 行号范围不精确 · M3 报告引的 `p5b-baseline-test.log` 不存在 · M4 `parserDeleteJob` 禁了两个错答案没给对答案 · M5 `tokens.scss` 两档块行号范围偏窄
- **协调者对评审 5 条 ⚠️ 的裁定**:
  - ⚠️1 `.k2-cc` 历史归因 —— 技术结论(套不套 `String()` 渲染一致)已从 Vue3 `patchAttr` 源码独立证实,「逐处照抄蓝本」的口径成立,历史归因不影响落地,**不追**
  - ⚠️2 基线 —— **协调者实测 313/2872 全绿(2026-08-01 12:33,exit 0)**,以此为准;T0 报告那句无凭据引用改掉即可(M3)
  - ⚠️3 `--danger-hover` 两档十六进制 —— **设计稿 §6.2 是上位权威,照它给的确切值,禁下游重算**,不需用户拍板
  - ⚠️4 C1 的处置方向 —— **协调者定:照 P5a 处理同一个类 `.k-empty-illust`(`knowledge.scss:452-461`)的 `color-mix` 先例派生,不升级为用户决策**;并要求把「模板 `style=` 属性是 color-guard 盲区」登记成守卫缺口③,由 T5 自己补一条定向断言兜底
  - ⚠️5 per-task 模型档位 / DoD / RED 探针未进治理文件 —— **设计如此**:计划书由协调者持有并据它逐任务写 brief,T0 不需要搬
- **K20(新键 99 → 100)与 N13 协调者确认收下**:`IndexedFilesView.vue:197` 是两蓝本唯一一处非字面量 `$t()`,展开出的 `Indexing` 不在 Vue2 语言包,而本机 8 行里 5 行是 `indexing` —— 真实缺口,按 K16 同模具两档同填英文正确
- **修复轮 1/5**(`866979a`..`317b8da`,5 文件):**9/9 全部 ADDRESSED**,opus 定向再评审逐条回权威源独立复核(蓝本模板复扫 / 两档 token 存在性与取值 / P5a `.k-empty-illust` 先例 / 行号订正 / 19 glyph / axios 空体 204 / `tokens.scss` 块边界 / 语言包分号宽度),结论零错;对附录 A 100 键、附录 B 既有 39 行、附录 D 85 类做机器比对 → **既有内容零破坏**。
  - C1 → 附录 B 新开 §B.0,3 处 `color-mix` 映射 + 「留在模板 `style=` 照抄蓝本结构」(挪进 scss 必然要造蓝本没有的类 → 撞 N10/N13 同一个坑)+ 守卫缺口③ + T5 定向断言要求 + 39→42 全文改齐
  - C2 → 治理 §3.5 新开 **N14**(map 四字段骨架 + 硬要求 T9 四个状态 `title` 断言 + 反向 + 兜底);**行号订正:`:title` 在蓝本 `:191`,不是我给的 `:195`(那是 KIcon 的 `:size`)** —— 上文台账 C2 那条按此更正
  - I1 → 治理 §1.1 零改动清单 6 项 + §1.2 列 19 glyph(核实 19/19 在 `KIcon.vue`);额外发现 **`tomb` 在模板里无字面量 `name="tomb"`,只经 `statusBadgeMap.icon` 动态取到**(与 K20 同款「grep 扫不到」的坑)
  - I2 → #84 改 `与 #24`,并复扫全表 `#` 引用;M1–M5 全部照做;勘误升到 **E-1 ~ E-12**,守卫缺口三条并列成表(②标注「无法修,靠人肉」)
- **deferred minor(不进修复轮,已挂账,由下游落地时顺手校正)**:
  - 🔴 **DM1(要带进 T5 的任务书)**:附录 B §B.0.4 给 T5 的断言骨架里用了 `__dirname`,但本仓 `"type":"module"`,ESM 下不可用(须 `fileURLToPath(import.meta.url)`);同段 `stripFns(...)` 是不存在的辅助函数。**会当场报错不会静默假通过**,但骨架不能直接照抄。
  - DM2 多处对 `color-guard.test.ts` / `knowledgeStyles.test.ts` 的行号引用偏 3~8 行(`styleLines()` 实际 `:47-60`;`knowledgeStyles.test.ts` 那个 `it()` 实际 `:271-278`)—— 引用的正则与结论都对,只是行号。
  - DM3 §B.0.3 把 `rgba(0,122,255,0.1)`→`--accent-soft` 记作「§B.2 已接受」,该行实际在 §B.3(T6 段 `:1891`)。
  - DM4 `p5b-task-0-report.md` 内部仍有「勘误 10 条」与重排前的 ⚠️N 编号残留 —— 报告不进下游读物链,不修。
- **Task 0: complete (commits `d8efb0e`..`317b8da`, 修复轮 1 后 review clean, 4 deferred minors)**

### T1 — i18n:100 条新键 + 守卫扩本批圈(sonnet)

- BASE `317b8da`
- commit `60dfa8a`(5 文件:3 源文件 + 逐码点脚本 + 报告,纯新增 944 行零删除)· 三门 313 文件 / **2878 例**全绿 · tsc 0 · build 0(+0 文件 / +6 例)
- opus 评审 **spec ✅ / 质量通过**,且**不采信实现者的 95/95,自己写脚本重做了全部比对**:
  - `zh_cn.ts` ↔ 附录 A zh 列 **100/100**;`en_us.ts` ↔ 附录 A en 列 **100/100**;`zh_cn.ts` ↔ Vue2 `zh_CN.json` **95/95**;A.2/A.4 那 5 条「无源」回查确认 5/5 真的查无此串。**MISMATCH 0 条。**
  - 陷阱逐个复核:`aiKbShowingFirstN` 分号 = **U+003B 半角** vs `aiKbShowingFirst200` = **U+FF1B 全角**(A.3 警告的那对)· `×`=U+00D7 · `–`=U+2013 en dash · `…`=U+2026 · `「」`=U+300C/D
  - ⚠️N 九行照抄不改 9/9(类型 / 向量数×2 / 下一步 / 上一张 / 恢复 / 已启用 / 累计完成×2),无一处「顺手改对」
  - 全角例外双向 diff 15↔15 零差且确为 `toBe` 强断言;占位符双向 diff 20↔20 零差;死键 2 条确未落;A.0 九条复用键未重复定义、既有键 `removed=[] changed=[]`
  - 守卫「只圈本批」是真的:三条都对本批字面量列表 `for…of`,`aiResTurn`/`aiResFilesInTurns` 不在任何列表里 —— 不红是因为真圈了本批,不是断言写松
  - 评审自做 3 次变异并还原(`git status --short` 空)
- **Important I-1(进修复轮)**:`messageSyntax.test.ts:320` 的 `p5bTask1Keys` **只钉数组长度,不钉这 100 个键真的存在于 locale 里**。评审实测:把 `aiKbColFile` 从两档同时删掉 → `pnpm test` 仍 **313/2878 全绿**。链条每一环都漏(parity 只比两档键集相等、同删仍相等;长度断言只看数组字面量;主扫描 `typeof value !== 'string'` 静默 continue;`toBe` 只覆盖 15 条例外)。**性质是 P3b/P5a 先例形状的既有盲区,不是 T1 引入的缺陷,也不违反计划书「照 P3b/P5a 同款写法」** —— 但 T5/T8-T10 直接依赖这 100 个键存在,补一条 5 行断言就堵上,协调者判定值得修。
- Minor(不修):M-1 逐码点脚本用 `indexOf('{')` 截对象字面量,将来加 import 会静默截错(一次性工具不进 CI)· M-2 脚本只覆盖 zh 的 95 条(评审已独立补齐 en 与新造 5 条,全 MATCH)· M-3 +6 而非 +3~5 的构成核实无误,3 条纯长度钉子是 P3b/P5a 既有形状且非恒真
- **修复轮 1/5**(`60dfa8a`..`8a934db`,2 文件,纯插入):**1/1 ADDRESSED**。sonnet 定向再评审读断言实现(不看结果)确认真的两档独立判、真的查「存在且是 string」、圈的是本批 100 键字面量数组而非全量遍历;并**自己另做两次变异**:两档同删 `aiKbColPath` → 精确 1 条红报出键名;单档删 → 新断言与 `parity.test.ts` **各自精确报红同一个键、不冲突不连带**;两次均已还原(`git status --short` 空)。既有 100 键值 / 15 例外表 / 20 占位符表 / 三条既有守卫零触碰。
- 三门(再评审复跑):**313 文件 / 2879 例**全绿 · tsc 0 · build 0(基线 +0 文件 / +7 例)
- **Task 1: complete (commits `317b8da`..`8a934db`, 修复轮 1 后 review clean, 3 deferred minors)**

### T2 — scss A:共享底座段(opus)

- BASE `8a934db` · 基线 **313 文件 / 2879 例**
- commit `4c18508`(3 文件:`knowledge.scss` + `knowledgeStyles.test.ts` + 报告)· 三门 313 文件 / **2882 例**全绿 · tsc 0 · build 0 · `sass` 单编 0(+3 例 / +0 文件)· 白名单 102→**134**
- opus 评审 **spec ✅ / 质量通过**,全程自己动手不采信报告:
  - **7 段逐段核**:脚本按附录 B.2 做映射替换 + 剥注释折空白 + 子串断言 → **10/10 OK**;规则数蓝本↔落地逐段相等;段序与蓝本一致(连局部邻接都对)
  - **反向核「有没有多搬」**:306 行非注释新增中只有 35 行不逐字命中蓝本 —— 9 行文件头注释 + 6 行 token 两档声明 + **20 行全部是「唯一差别 = 一处色字面量换 token」**。**零发明、零多搬**;删除行 6 行全是过时注释,无断言/规则删除
  - K17 四类确未搬(编译产物 grep 零规则)但 `.k-modal-foot .right` 搬了;K10 顶层重复段确丢弃且段头注释写了理由;`.k-btn` 基类与其余变体 **零改动行**,只在 `&.primary` 与 `&:disabled` 之间插了 `&.danger`
  - **逐行色扫**:声明块边界实测暗 `:84-180` / 浅 `:183-262` → 规则段落 **0 命中**(注释也 0),`theme-exception` 0;22 处映射与附录 B.2 逐字相同,表外字面量 0
  - **`var()` 闭环**:规则段落引用的 56 个 token 逐个查两档,3 个新 token 两档都在;未在浅档重声明的全是非颜色结构量或已登记例外 `--accent-soft-2`。`--danger-hover` 两档值与设计 §6.2 逐字相同**未重算**;`--purple-soft` 未声明(归属 T6),符合归属表
  - **重名**:32 个新类对 `src/` 下全部 `.scss`/`.css` 跑边界正则 → **零命中**
  - **评审自做 4 组 5 次 RED 探针**,含关键的缺口① 双向验证:塞白名单外 `.kn-foo` → 现行正则精确报红;把正则**临时改回**旧版 → **19 例全绿**(实证缺口曾真实存在)。全部还原,`git status --short` 空
- **实现者两条 concern 评审均判成立**:
  - ① 任务书原写的探针 4(「删 `.kn-badge`」)确实隔离不出缺口① —— 白名单存在性断言**完全不经过扫描正则**,删类报红的是存在性断言。实现者改用「塞白名单外的 `.kn-foo`」是正确的隔离方向
  - ② 落点必须写进**既有**壳段而非追加新顶层块 —— 评审端到端验:`sass` 产物基础 `.k-row` 在 `:790`、`@media` 覆写在 `:1076`;生产包 `dist/assets/index-*.css` 偏移 277715 vs 282572,顺序与蓝本一致。**若追加到文件末尾,S6 窄屏覆写会因同优先级 (0,2,0) 后写者胜而被静默吃掉 → T5 窄屏布局失效。**正则修法 `/\.k(?:2|n)?-/` 是旧版**严格超集**,是扩范围不是放宽
- **deferred minor(不进修复轮)**:
  - DM5 报告 §1.1 引的编译产物行号 `:792`/`:1084` 应为 `:790`/`:1076`(结论不受影响)
  - 🔴 **DM6(要带进 T6 的任务书)守卫缺口④**:`.k-modal-foot` 内的 `.right`(`knowledge.scss:783`)**既不在白名单、也不进扫描正则**(两者都只收 `k*` 前缀)→ 将来本文件里冒出任意 `.right` 规则没有任何断言说话。**不是 T2 的偏离**(附录 D.1 本就没列 `right`,治理白名单口径本就是 `k*`),搬运本身是 K17 明令要做的。
- **Task 2: complete (commits `8a934db`..`4c18508`, review clean 零 Critical 零 Important, 2 deferred minors)**

### T3 — store 三处 epoch 过期守卫(sonnet)

- BASE `4c18508` · 基线 **313 文件 / 2882 例**
- commit `2e48e42`(3 文件:`knowledgeStore.ts` + 新建 `knowledgeStore.staleGuard.test.ts` + 报告;store 侧 50 增 3 删,3 处删除全是被扩写的注释头 + 那行 `s.loading = false`)· 三门 **314 文件 / 2888 例**全绿 · tsc 0 · build 0(+1 文件 / +6 例)
- opus 评审 **spec ✅ / 质量通过**,全程自己动手:
  - 三个计数器都在 `defineStore` setup 闭包内(`:261`/`:284`/`:297`)= **实例局部**,inline 未抽公共 guard;过期分支不写共享 state / 不归位 loading / 不弹 toast;`loadIndexedFiles` 的 `finally` 归位**确实受守卫约束**(`:461`)
  - **评审自做 8 次变异,6 次被精确咬住**:删守卫 ×3(各自精确红 1 例、其余两组 5 例仍绿 = 各咬各的)· 「判了但不 return」· 「`++epoch` 挪到 `await` 之后」· 「`finally` 改回无条件归位」(证明 brief 点名那条**有独立判别力**,不是被别的断言顺带盖住)· 「守卫恒真 `if (true) return`」→ **两组反向对照都红**,证明反向对照不是凑数
  - **交错是真交错**(读实现不采信报告):手写 `deferred()` executor,两发**同步发起且都不 await**,先 resolve 第二发断言、再 resolve 第一发断言;没有「先 await 第一发再发第二发」的偷懒,没有 mock 掉 epoch 变量
  - **mock ↔ fixture 逐字段比对**:9 组常量逐字命中 `jobs-pending/running/failed.json` 与 `files-default/mime-prefix-legacy/sort-size-asc.json`;`notes.*` 的 camelCase 归一化层数正确(没写成 HTTP 层 snake_case、没多剥少剥一层),且与既有 `knowledgeStore.notesWiki.test.ts` 同模具 —— **无裸信封 unwrap 事故**
  - 实现者报告的三次探针报红文本与行号,评审独立重跑**逐字复现**,未造假;三门独立复跑数字一字不差
- **Important I-1(进修复轮)**:`knowledgeStore.ts:458` 的 **catch 分支守卫是全套 5 个守卫点里唯一一处「删掉全绿」的** —— 三组交错用例全走成功路径,没有任何一处 `reject`。实现对,但**没有任何测试能证明它对**,正好落在本仓复发模式里。真实后果:过期那发失败(请求中止 / 后端 500)而最新发已成功写入时,会把 `s.error` 叠在正确数据之上多出一条错误横幅。
- Minor:M-1 「计数器必须实例局部」这条 DoD 无回归保护(变异 M6 提到模块级 → 52 例全绿;但实现确为实例局部,且 P5a `loadRoots` 先例也没有这类测试)· **M-2 `{ id: 999 }` 是自造残缺行、不来自任何 fixture 且报告溯源表没登记它**(本机 failed 桶为空取不到真行,但同表行形状在 `jobs-pending.json` 里实测过)· M-3 三处 `expect(toastShow).not.toHaveBeenCalled()` 是恒真断言(这三个 action 任何路径都不调 toast),来自 brief 字面要求,保留但不算守卫生效证据
- **修复轮 1/5**(`2e48e42`..`90b0cd9`,2 文件,`knowledgeStore.ts` **零 diff**):**2/2 ADDRESSED**。sonnet 定向再评审读实现确认新增例是**真交错**(两发同步发起都不 await,先 resolve 第二发断言,再 reject 第一发再断言),三项断言(`error` 仍 null / `files` 是第二发结果 / `loading===false`)全覆盖;`POISON_FAILED_ROW` 逐字段核对 `jobs-pending.json` 的 `jobs[2]`(id 346)**11 个字段全部逐字符一致**,报告溯源表已补
  - **评审自做两次变异**:删 `:458` 那一行 → 唯一红新增例(`expected 'boom' to be null`)、其余 52 例仍绿;**反向确认**把新增例的 `reject` 改回 `resolve`(守卫仍删着)→ **7 passed 不再报红**,证明这一例的判别力确实来自失败路径本身,不是被别的断言碰巧盖住。两次均已还原(`git status --short` / `git diff --stat` 皆空)
  - 原有 6 例断言未被触碰;M-1 / M-3 未被顺手"修"(范围外),报告已明确挂账
- 三门(再评审复跑):**314 文件 / 2889 例**全绿 · tsc 0 · build 0(基线 +1 文件 / +7 例)
- **Task 3: complete (commits `4c18508`..`90b0cd9`, 修复轮 1 后 review clean, 2 deferred minors)**

### T4 — `util/queueView.ts` 三个纯函数(sonnet)

- BASE `90b0cd9` · 基线 **314 文件 / 2889 例**
- commit `9a98106`(3 文件:`util/queueView.ts` 43 行 + `queueView.test.ts` 98 行 + 报告)· 三门 **315 文件 / 2905 例**全绿 · tsc 0 · build 0(+1 文件 / +16 例)
- sonnet 评审 **spec ✅ / 质量通过 · 零 Critical 零 Important 零 Minor,一轮过**:
  - 自己 `git show main:` 拉蓝本 `:393-404` 逐语句比对 → **逐字等价零差异**;唯一附加是 TS 类型标注,不改运行时行为,**未多加防御**
  - `—` 逐码点核实为 **U+2014**(非 U+2013、非半角)
  - 分支覆盖表 16 条用例 ↔ 函数体真实分支**一一对应**,无恒真断言、无重复覆盖、无零覆盖分支;实现者多写那 1 例覆盖的 `pop() || p` 兜底(纯斜杠路径)经核实**分支真实存在且用例真的走到**
  - **评审自做 4 次 RED 探针**(比要求多 1 次):删 `running` 分支 · 删 `filter(Boolean)` · **把 `dirname` 单段路径"改对"成 `'/'`** → 两条照抄用例精确报红(证明照抄条真被钉住不只是注释)· **把 `basename` 空值从 `'—'` 改半角 `'-'`** → 精确报红(证明破折号宽度被 `toBe` 钉死)。全部还原,`git status --short` 空
  - K11 核实:`fmtAgo` 未被抽过来,`queueView.ts` 里零实现;零改动清单 `indexedFiles.ts`/`dashboardHelpers.ts` **0 行差异**;文件组织/导出风格/测试写法逐行对齐既有先例,未自创
- **Task 4: complete (commits `90b0cd9`..`9a98106`, review clean 零问题, 0 deferred minors)**

### T5 — `QueueView.vue` + 路由反转(sonnet)

- BASE `9a98106` · 基线 **315 文件 / 2905 例**
- commit `d9d1827`(7 文件:`QueueView.vue` + `QueueView.test.ts` + `knowledgeRoutes.ts` + `deferred.ts` + 连带 `knowledgeRoutes.test.ts` / `deferred.test.ts` + 报告)· 三门 **316 文件 / 2959 例**全绿 · tsc 0 · build 0(+1 文件 / +54 例)
- opus 评审 **spec ✅ / 质量通过**,全程自己动手:
  - **八个区块逐块回蓝本核 → 零漏零多**;机械核对 `KIcon` 的 `name`+`size` 序列蓝本 23 对 ↔ 落地 23 对逐对相同;模板 41 个类在 scss 里全部有规则,且 **37/37 出现在 `dist/assets/index-*.css`**(评审自己跑 build 后 grep);`.k-empty-btn`/`.k-status-badge-cn`(N10/N13)零出现,`theme-exception` 零,`<style>` 块零个
  - 六条点名要求全部落实:**K7** = `DialogRoot > DialogPortal to=".knowledge-app" defer > DialogOverlay.k-modal-bg > DialogContent.k-modal`,全仓 grep 无裸 `k-modal-bg` div、无 `Teleport`,宿主真实存在;**K18** 三处都是 `retryFailed(null)` + 统一 toast,**界面零变动**逐字核过(class / `:disabled` / KIcon 尺寸 / 文案键全同蓝本);**K16/K11** 对;**内联渐变**留在模板 `style=` 且 3 条 `color-mix` 与 §B.0.1 逐字一致;**守卫缺口③ 的定向断言用 `node:fs` + `fileURLToPath`,没踩 `?raw` 和 `__dirname` 两个坑**;**路由反转**两条断言反转不删、旧文本留注释、各自还**增加**了新断言
  - **属性态 8 组逐条核 → 每个宿主都有精确值断言**(`data-state` 两个宿主各有、`data-tone` 两类宿主各有、`data-on` 五个宿主一次性比数组),**一律直接比 `attributes('data-x')` 的字符串值**,无一处用属性存在性代替值比较 —— P5a T12「4 个宿主只覆盖 1 个」的事故模式不成立
  - **评审自做 7 次 RED 探针**(远超要求的 4 次):`>=`→`>` · `bulkRetry` 改回蓝本空请求版 · **模板 `style=` 塞 `#ff0000` → 新断言精确报红而同批 `color-guard.test.ts` 全绿**(实证守卫缺口③ 确是它抓不到、被新断言堵上的)· `color-mix` 换回 `rgba()` · 三处属性态同时变异 3 红 · `data-selecting`+两个 `data-state` 宿主 4 红 · `kn-badge` 映射对调 8 红。全部还原
  - **mock ↔ fixture 逐字段比对**:`PENDING_JOBS`/`RUNNING_JOBS` 与 fixture 逐字段相同;`parserDeleteJob` 正确 mock 成 `''`(**治理点名的 204 空体坑没踩**);`notes.*` camelCase 与 `ai.parser*` snake_case **两条口径没搞反**;`FAILED_JOBS` 是人工构造但合规(§4.5 已登记 failed 桶真机恒空),字段 schema 与真 fixture 同一套无臆造
- **实现者两条 concern 评审均判成立**:
  - ① 摘 `String()` 不报红**是预期**:评审自己读 `@vue/runtime-dom@3.5.39` 的 `patchAttr`(`:560-577`)—— `data-*` 不在 `isSpecialBooleanAttr` 里 → `false` 走 `setAttribute` 被字符串化成 `"false"`。评审做了**比实现者更强的实证**:把模板全部 **7 处** `String()` 一次摘干净,53/53 仍全绿。**任务书那条探针本身设计错了,不是缺陷**(与治理 §9 / 附录 D §D.3.1 / 勘误 E-9 三处已登记裁定一致)。照抄纪律另核:蓝本 7 处 ↔ 落地 7 处,一处不多一处不少
  - ② 多改两个测试文件**必要不越界**:治理 §5 明文要求反转的那条断言就住在那里;逐行核 diff **除反转本身零夹带**,且两处都是**增加**断言,`deferred.test.ts` 另两条用例一字未动,**无任何断言被削弱**
- **四条 Minor(协调者判定一并进修复轮 —— M-1 是文案 1:1 的破口,其余三条现在补比留到终审便宜)**:
  - **M-1** `QueueView.vue:278` 的 `cancelDistillRow` 409 分支**丢了蓝本的 `Cancel failed: ` 前缀**(蓝本 `:388-390` 是 `$t('Cancel failed') + ': ' + msg`)。K5 授权的是「不回显后端 body / `e.message`」,而 **409 那句是固定 i18n 串不是后端 body**,砍前缀是纯文案裁剪;治理 §2 又写着「本期唯一用户可见文案与 Vue2 不同的地方是 K18 的三处重试 toast」。**协调者裁定:恢复前缀。**
  - **M-2** `QueueView.test.ts:627` 的 `expect(hasTable !== hasEmpty).toBe(true)` 是**恒真断言**(模板是 `v-if`/`v-else-if`/`v-else` 三选一,结构上永远恰好渲染一个);且这 6 条组合用例的 mock 让六种组合全部有行,**空态侧一次都没走到**
  - **M-3** 弹窗**背景点击关闭没有用例**(蓝本靠 `.k-modal-bg` 的 `@click` + `.k-modal` 的 `@click.stop`,落地换 reka 后由 `pointerDownOutside` 提供等价行为,机制正确但没钉住)
  - **M-4** 测试**从不 `unmount`**,每个用例留下一个真实 `setInterval(…, 10000)`(`QueueView.vue:285`)。当前整文件 ~1 秒跑完不会 flaky,但定时器持有 store/router 引用,将来用例变慢会污染后续 `toHaveBeenCalledTimes` 断言
- **⚠️ 评审登记的「无法核实」**:真机视觉 1:1(尤其 `.k-empty-illust` 暗档色相微偏 = §B.0.3 已登记的取舍、reka 遮罩观感)· **distill scope 的一切**(本机沉淀队列与 failed 桶恒空,`kn-badge` / Manual-Auto / `{n}× retried` 全靠人工 mock,真机验不了)· reka Dialog 的 Escape 关闭是多出来的能力(非界面不 1:1,但未验快捷键冲突)
- **修复轮 1/5**(`d9d1827`..`7014b22`):**4/4 ADDRESSED**。sonnet 定向再评审逐条核 + **自做 4 组变异复验**:
  - M-1 → 409 分支恢复 `` `${t('aiKbCancelFailed')}: ${t('aiKbCannotCancel')}` ``,回蓝本 `:388-390` 核确认原文恒为 `+ ': ' +`;附录 A 核实拼接结果精确等于「取消失败: 该任务已无法取消。」(全角句号 / 半角冒号加空格);两条用例用 `toHaveBeenCalledWith` 钉死 409 / 非 409 **两侧的完整精确字符串**(非 `toContain`);非 409 分支仍按 K5 不回显 `e.message`。变异:再砍一次前缀 → 精确报红
  - M-2 → 恒真那句已删,六条组合换成 `toHaveLength` + 首行内容 / 徽标 `data-s` 断言,另加独立空态用例。变异:`v-for` 改 `indexRows.slice(1)` → **三条判别性断言全部精确报红**(3→2 / 1→0 / 2→1);`rowsEmpty` 恒 false → 空态用例报红
  - M-3 → 补了「点遮罩关 / 点内部不关」两侧对照用例
  - M-4 → `mountedWrappers` 数组 + `afterEach` 循环 pop-unmount。变异:`vi.spyOn(window,'clearInterval')` + 挂两次 → **实测 clearInterval 被调 2 次**,证明不是只 unmount 最后一个
  - **第一轮探针证明有效的 `data-on` 断言原样保留未被 M-2 改写连带削弱**;K7 三条既有用例未触碰;零新破坏
- **实现者的 open question 评审判「成立,不是缺陷」**:M-3 字面探针(`DialogOverlay` 换普通 `div`)确实不报红。评审去读了 `reka-ui@2.10.1` 的 `DismissableLayer.vue` 与 `DismissableLayer/utils.ts` —— `data-dismissable-layer` 挂在 `DismissableLayer` 自身(被 `DialogContentImpl` 包着),`DialogOverlay` 是**另一个不携带该属性的独立组件**;`usePointerDownOutside` 判定 outside 的唯一依据是 `target.closest('[data-dismissable-layer]')`,**与遮罩元素是不是 reka 组件无关**。评审两次独立变异与源码结论吻合:换 Overlay 不影响判定,**在 `DialogContent` 上 `@pointer-down-outside.prevent` 才会破坏判定 → 那次精确报红**,证明新用例对关闭机制确有判别力,只是判别点正确地落在 `DialogContent` 而非 Overlay 元素
- **协调者复核三门**(自己跑,不采信任何报告):HEAD `7014b22` → `pnpm test` **316 文件 / 2963 例全绿**,`git status --short` 空
- **Task 5: complete (commits `9a98106`..`7014b22`, 修复轮 1 后 review clean, 0 open)**

### T6 — scss B:已收录文件段(opus)

- BASE `7014b22` · 基线 **316 文件 / 2963 例**
- commit `15a8b76`(3 文件)· 三门 **316 文件 / 2966 例**全绿 · tsc 0 · build 0 · sass 单编 0 · `dist/assets/index-*.css` grep 到 `k-frow-f`(+3 例 / +0 文件)· 白名单 134→**187**
- opus 评审 **spec ✅ / 质量通过 · 零 Critical 零 Important**,方法是**编译级结构等价**(不看 diff 文字):蓝本 `:1705-2022` 单独编译 vs 落地段包壳编译,剥注释归一缩进剥前缀后逐行 diff
  - 蓝本 **96** 个选择器 → 落地 **92**;`bp only` 恰好 4 项(`0%`/`100%`/两条 `[data-theme=dark]`),**`new only` = 空集**,共有选择器**相对顺序完全一致**
  - **反向核零多搬**:归一 diff 里除值替换外**零 `+property` 行**,scss 侧 **0 条删除行**(纯插入);落地段 54 个 `.k…` 选择器 = D.2 的 53 + 已在白名单的 `k-btn`,与 D.2 双向差集为空;`.k-frow` 死规则零命中;`:1675-1703` 未搬且段头注释写明
  - **级联另核**:唯一跨段冲突 `.k-btn` —— 蓝本 `(0,2,0)` 靠源码序取胜 → 落地 `(0,3,0)` 靠特异度取胜,**结果相同,无级联翻转**
  - **逐行色扫**:80 行色字面量**全部落在 `:97-200`(暗)与 `:203-285`(浅)两个声明块内**,块外含注释 0 命中;`theme-exception` 0;§B.3 的 13 行 **17/17 逐行命中一处不多不少**,3 处 `transparent` 照抄
  - **`var()` 闭环**:本段 30 个 token 逐个 grep 两档 —— 26 个颜色 token 两档各 1 份,4 个 light=0 的全是 `--font-*`/`--r-*` 结构量(约定只放基础块)。`--purple-soft` 归属正确(T2 未声明),两档值与 `tokens.scss:310/:133` 逐字相同
  - **评审自做 7 次 RED 探针**:塞 `#ff0000` · 删 `@keyframes row-done`(指名) · 删浅档 `--purple-soft`(集合式指名) · 🔴**反向确认:删真实存在的 `@keyframes k-fade-in` → 仍然指名报红**(证明 N11 豁免的只是 `fade-in` 这一个名字,守卫本体没被捅穿) · 塞 `.k-foo` · 塞 `.bar`(缺口④ 两条同红) · 把 `animation: fade-in` 改成 `k-fade-in` → **「N11 被违反」精确报红**。全部还原,`md5sum` 回原值
  - 白名单前 134 项与 `7014b22` **逐字节相同、零删除**;测试侧 11 条删除行全是常量重命名/标题数字/过滤器扩写,**无任何断言被削弱**;扫描正则仍是 T2 扩过的版本未放宽;53 个新类与四档既有 scss **零重名**(评审自己 grep)
- **实现者两条 concern + 缺口④ 处置的裁决**:
  - ① `@keyframes row-done` 放顶层全局区而非文件末行 —— **成立无需改**:keyframes 是全局命名空间与源码顺序无关,全文与 dist 里各 1 处唯一;编译核过落地 `:1386` 顶层零缩进、dist 里是裸 `@keyframes` 无作用域前缀污染;与 P5a `k2pulse`/`k2spin` 同族。「文件末尾」是版式偏好不是 CSS 语义
  - ② 注释挪进子规则 = 零声明改动 —— **声明部分成立**(编译级 diff 证实);但那句理由只落实一半:落地后**仍有 8 条** `.knowledge-app { /* … */ }` 空规则。判**不是缺陷**(P5a/T2 沿用的既有版式 + dist 里 `.knowledge-app{}` 0 命中),只是报告表述得像已全面适用
  - ③ 缺口④ 的 A 路子 **判对了**:评审自己复算「非 `k*` 标识符恰好 9 个」= `ghost/outline/primary/danger/right/suffix/second/spin/mono`,全是真类名零假阳性(`0.5`/`1.4s`/`12.5px` 被 `[a-zA-Z]` 挡掉);`.mono` 回蓝本核过是 `:1957` 本来就有**不是发明**;集合相等的脆弱性是刻意设计(同文件既有「例外清单恰好 11 个」口径),探针 6 已验判别力且不宽松
- **deferred minor(不进修复轮)**:DM7 报告里两处行号漂移(`--purple-soft` 实际 `:191-196`、`row-done` 实际 `:1379-1387`,代码无误纯文档)· DM8 缺口④ 第一条用例被第二条严格蕴含(冗余;但评审也认为「给高频方向一条更可读的报错」这个理由站得住)
- **⚠️ 评审登记的「无法核实」**:视觉 1:1(消费这 53 个类的 `IndexedFilesView.vue` 要到 T8–T10 才有,K2 并档观感与 `.k-type-tag[data-kind="pdf"]` 从 `#d8362b` 换 `var(--danger)` 的色相偏移只能等 T10 后真机看)· `animation: fade-in` 的悬空是静态事实,跨文件若将来引入同名 keyframes 会突然活过来(无跨文件守卫)· N10/N13 那两个未定义类的「模板照抄类名」那一半要 T8/T9 核
- **Task 6: complete (commits `7014b22`..`15a8b76`, review clean 零 Critical 零 Important, 2 deferred minors)**

### T7 — `util/indexedFilesView.ts` 五个纯函数(sonnet)

- BASE `15a8b76` · 基线 **316 文件 / 2966 例**
- commit `dfc57ed`(3 文件)· 三门 **317 文件 / 3005 例**全绿 · tsc 0 · build 0(+1 文件 / +39 例)
- sonnet 评审 **spec ✅ / 质量通过 · 零 Critical 零 Important**:
  - 自己 `git show main:` 拉蓝本 `:396-444` 逐字比对五个函数 → **仅加类型注解,逻辑逐字相同**(含 `n == null` 宽松相等 / `toFixed` 条件式位数 / GB 恒 2 位 / 9 条 if 含 guard 的顺序 / `legacy:true` 只在两条 / 正则要第二个斜杠);**未顺手改对、未漏分支、未多加防御**;行号引用 10 处全部核实准确
  - **边界覆盖表 4 个档位切换点 + 两函数各 5 个特例,两侧全部有 `toBe` 钉死确切值断言,无一缺失**:`1023/1024` · **`10239/10240`(KB `toFixed` 切换)** · **`10485759/10485760`(MB `toFixed` 切换)** · `1073741823/1073741824`(MB→GB)· `44/45` `59/60` `23/24` `29/30`;`0`→`'0 B'` 带 `not.toBe('—')` 反向断言
  - `fmtRel` 断言的是**中文渲染文案**(`'刚刚'`/`'3 分钟前'`/`'1 个月前'` 等),值独立核 `zh_cn.ts` 与附录 A 逐字一致;**零新增 i18n 键**(5 键全复用);评审独立读 `knowledgeStore.ts:190-199` 确认 `fmtAgo` 是 4 档 ms 直接算分钟,与 `fmtRel` 5 档秒粒度**确实不同,未合并**
  - **评审自做 6 次 RED 探针**(比要求多 2 次),全部精确报红 1 failed / 38 passed:`s<45`→`s<90` · `simplifyMime` 前两条 if 互换 · `topSegment` 正则去尾斜杠 · 🔴**`toFixed` 位数改恒 1 → 精确报红**(P5a T6 栽过的同款回归,这次咬住了)· `n == null`→`n === null`(undefined 走漏算成 `NaN GB`)· `n<1024`→`n<1025`。全部还原
  - 🔴 **`fmtAbs` 时区**:评审用 `TZ=UTC` / `TZ=Asia/Tokyo` / `TZ=America/Los_Angeles`(额外加测负偏移)各跑一次,**三次全绿** —— 不会在别人机器上随机失败
  - +39 例(比预计多 9~14)逐条核实是真额外覆盖(OR 条件两分量各测 / 两处独立顺序陷阱 / `fmtAbs` 三档补零 / 辅助普通值),**不是拆碎凑数**
- **deferred minor**:DM9 `indexedFilesView.test.ts:128-139` 那个「`fmtRel` 与 `fmtAgo` 不是同一个函数」的 describe,断言与上方天/月边界用例(`:114-119`)完全重复(同输入同断言),且该块**没有真的导入 `fmtAgo` 做跨函数对照**
- **Task 7: complete (commits `15a8b76`..`dfc57ed`, review clean 零 Critical 零 Important, 1 deferred minor)**

### T8 — `IndexedFilesView.vue` 第 1 刀(sonnet)

- BASE `dfc57ed` · 基线 **317 文件 / 3005 例**
- commit `4781a34`(3 文件:`IndexedFilesView.vue` + `IndexedFilesView.test.ts` + 报告)· 三门 **318 文件 / 3058 例**全绿 · tsc 0 · build 0(+1 文件 / +53 例)
- opus 评审 **spec ✅ / 质量通过 · 零 Critical 零 Important**:
  - 六个区块逐块回蓝本核 → 差异只有 i18n 键替换 + 两处已授权偏离(K14 删 `· {{ errorBanner }}` 连带悬空的 `·`;K19 把 `{{ storeError }}` 换 `aiKbLoadErrorBody`);模板 34 个类 **33 命中 scss,只有 `k-empty-btn` 为 0** = 正是 N10 要求的状态
  - 🔴 **范围边界两个方向都干净**:① 无半成品 —— 剥注释统计开标签 **蓝本 `:2-142` = 89 节点 / 落地 = 89 节点**,逐标签名完全相等,`class` 字面量集合**差集为空**,`TODO|FIXME|v-if="false"` 零命中;② 无提前搬 —— 对 40 多个 T9/T10 标识符全量 grep,**8 处命中全在文件头注释里,零行代码**,`:454` 那行占位注释里没藏 DOM
  - 五条点名要求全部落实:K13(`ref(new Set())` + 整体替换,`selTick/expTick/doneTick` 仅注释命中)· N10(类名照抄 + 白名单实测仍 **187 项且不含 `k-empty-btn`**)· N12 两向 · K14/K19 两条反向断言 · filters 仍在 store(11 处写 6 处读,零本地别名)
  - 另核 **N9 无 debounce**(两个 handler 各两行直调 `_applyFilter`,全文无 `setTimeout`/`debounce`)· `_applyFilter` 四件事一件不少 · `created→refresh()` 先 load 后 start · `onUnmounted` 停轮询是蓝本 `beforeDestroy():599-601` 的直译不是自作主张
  - `filtersDirty` **7 个独立 `it`**(全默认 false + 六条各 true)· `statusViewLocal × statusSuffix` **6 个独立 `it`** 矩阵全覆盖,写方向那条**先把 store 摆成 `tombstoned` 再改**以排除「本来就是」的假绿
  - **评审自做 7 次 RED 探针**全部精确报红并还原(最后 `diff` 确认文件与 HEAD 逐字节相同):删 `derivedRoots.includes` · 删 `offset=0`(**恰好 11 条摆了 dirty 状态的用例集体红**)· N12 写方向直传 · N12 读方向直传(额外加)· K14 加回回显 · **模板塞 `#ff0000` → 守卫缺口③ 那条定向断言报红** · 删 `filtersDirty` 一个条件(证明六条件各咬各的)· K19 改回 `{{ storeError }}`
  - **mock ↔ fixture 全 8 行 × 全字段脚本比对**:`EMPTY_RESULT` 与 `files-has-error.json` 逐字符相同;`ALL_OK_FILES` 是真子集非新造;**信封层数没搞反**(只 mock `ai.parserFiles`,用 fixture 原样 snake_case 单层 body,完全没涉及 `notes.*` camelCase 那批)
- **实现者两条 concern 评审均判成立**:
  - ① 用 `wrapper.vm` 直驱 `errorBanner` **可接受不是假测试**:评审探针 4 实证「模板分支改回回显 → 那条用例精确报红」= 有真判别力;且评审自己核了 `errorBanner` 在蓝本唯一赋值点是 `doRebuildAll()` catch(蓝本 `:791-808`),UI 入口在 `:356-381`,**两者都在 T9/T10,本刀不存在可用的真实入口,硬造入口才是提前搬**;**K19 那一半确实走真实入口**(`mockRejectedValueOnce` → `loadIndexedFiles` catch → 模板),取舍是对的
  - ② +53 而非 +40:52 条本文件 + 1 条 color-guard 动态发现,算术闭合;多出 13 条是实打实覆盖,**无恒真断言**(所有分支断言都有对照的另一侧)
- **五条 Minor(协调者判定一并进修复轮 —— 其中三条会顺着三刀叠加往下传)**:
  - 🔴 **M-1** `FILES_ALL_8` 报告称「逐字转录」但实测 **3 个 docker 容器路径被缩写**(fixture 的 64 位哈希 → mock 的 `26be4bc60729...`)。本刀无功能影响(只有 `topSegment` 读它),但 **T9 会用同一份常量渲染 `.k-frow-pathcell`/`.k-frow-pathtxt`**,缩写路径会掩盖真实超长路径的截断/省略号表现
  - 🔴 **M-2** 三处蓝本行号引用错:`FILTER_REBUILD_CAP` 写 `:391` 实为 **`:393`** · `EXPLICIT_REBUILD_CAP` 写 `:390` 实为 **`:392`** · `errorBanner` 写 `:392` 实为 **`:465`**;报告另有两处(`refresh/created` 实为 `:595-597`/`:619-622`、computed 段实为 `:473-581`)。**三刀叠加同一文件,注释行号是 T9/T10 唯一的坐标系**
  - 🔴 **M-3** 过滤条**文案零断言**:四个 `.k-filt-label` · 状态下拉三个 option 文字(**含 ⚠️N #85 的错译「已启用」**)· `aiKbFailedOnly`/`aiKbClear`/`aiKbLegacyDoc` 与 chip 的 `title` · 两个 `placeholder` —— 一条都没钉。将来有人把「已启用」顺手改对成「有效」,三门全绿。**佐证:测试 `:415` 的用例名把 option 写成「'有效'」,而界面实际渲染「已启用」—— 作者自己没在 DOM 层面确认过这三条文案**
  - **M-4** `IndexedFilesView.test.ts:715-746` 生命周期第 2 条:`vi.useFakeTimers()` 与 `w1`/`w2` 没走 `try/finally` 也没进 `mountedWrappers`,中间断言一抛错就泄漏假定时器 + 一个带 30s interval 的实例
  - **M-5** `:670` 的 `mockResolvedValueOnce(EMPTY_RESULT)` 是死行(直接改 `filters.has_error` 不触发重载,这个 `Once` 永不消耗),留着会误导读者
- **⚠️ 评审登记的「无法核实」**:浏览器实机观感(`.k-empty-btn` 按 N10 就该是无样式裸按钮,**验收时别当缺陷**)· K14 分支真机永远验不到(需 >10000 个匹配文件,本机 8 个)· `wrapper.vm` 读写 `<script setup>` 顶层 ref 依赖 Vue 实现细节非公开契约(当前 3.5.39 + VTU 实测可用)
- **修复轮 1/5**(`4781a34`..`855cc39`,3 文件):**5/5 ADDRESSED**。sonnet 定向再评审逐条独立复核:
  - M-1 → 再评审**自写脚本**把 `FILES_ALL_8` 解析回对象与 `files-all-8.json` 做**全 8 行 × 全 14 字段**比对 → **0 mismatch / 0 missing / 0 extra**,3 条路径改回完整 64 位哈希且其余字段未被带坏
  - M-2 → 5 个行号逐条 `git show main: | sed -n` 实测**全部精确**(`:393` / `:392` / `:465` / `:595-597` / `:619-622` / computed 段 `:473-581` 闭合确在 `:581`)
  - M-3 → 5 条新用例均 `toEqual` **集合式钉死**,覆盖四个 label / 三个 option / check+清除按钮 / chip 文字+title / 两个 placeholder;**⚠️N #85 的「已启用」确实被钉进断言值**(与附录 A 一致),没被顺手改对
  - M-4 → `w1`/`w2` 都 push 进 `mountedWrappers`,`useFakeTimers()` 之后整段包进 `try{…} finally { useRealTimers() }`
  - M-5 → 死行已删,该用例仍绿
  - **再评审自做 3 次变异**:① `aiKbStatusActive` 改「有效」→ 精确报红(与实现者贴的文本一致)· ② **键写串**(`aiKbRoot`→`aiKbTypePrefix`)→ 精确报红 · ③ 把某条路径再缩写一次 → **57/57 全绿无人咬住**(符合预期:本刀没有渲染路径的 DOM,**这条修的价值是给 T9 的守卫**)。全部还原
  - **范围边界重核**:`<template>` 剥注释开标签仍 **89 vs 89**;T9/T10 的 19 个标识符全量 grep **零行实码**(命中全在注释);白名单仍 **187 且不含 `k-empty-btn`**;第一轮探针证明有效的断言(`filtersDirty` 七条 / N12 六条 / K14+K19 反向 / 模板零裸色)全部健在
- 三门(再评审复跑):**318 文件 / 3063 例**全绿 · tsc 0(+5 例,与 M-3 新增 5 条吻合)
- **deferred minor**:DM10 修复轮新引入的 `doRebuildAll()` 蓝本行号仍差 1 行(写 `:791-808`,函数真实闭合 `},` 在 **`:809`**,`:808` 只是内层 catch 的闭合)—— **`doRebuildAll` 属 T10 范围,交给 T10 顺手订正**
- **Task 8: complete (commits `dfc57ed`..`855cc39`, 修复轮 1 后 review clean, 1 deferred minor)**

### T9 — `IndexedFilesView.vue` 第 2 刀:表格 + 行内详情 + 分页(sonnet)

- BASE `855cc39` · 基线 **318 文件 / 3063 例**
- commit `3eec77a`(3 文件)· 三门 **318 文件 / 3113 例**全绿 · tsc 0 · build 0(+0 文件 / +50 例)
- opus 评审 **spec ❌ / 质量不通过** —— 代码本体是近乎无瑕的 1:1 移植,但**两条明列的断言实际没落地(评审用变异证伪)**:
  - **机械核边界**:剥注释统计开标签 **蓝本 `:146-317` = 73 / 落地 `:683-887` = 73**,逐标签种类全等;属性清单逐名核对完全一致,**唯一差异 `:key` 4→3**(Vue3 `<template v-for>` 语法要求,代码注释已说明)
  - 三个区块逐块无差异:四态徽标(N14 拆 `en`+`key`)· `errhint`/`zerohint` 两个条件逐字 · `fmtBytes` + `(size||0).toLocaleString()+' bytes'` · 重建按钮禁用条件与三段 title 三元 · 详情 5 格 + `|| '—'` 三处回落 · 分页四个计算逐字 + `[50,100,200,500]`
  - **无半成品**:`TODO|FIXME|v-if="false"` 零命中;正则扫空函数体**只有 `rebuildRow` 一个**(唯一被允许的)
  - **T10 越界扫描**:14 个标识符/类名逐个 grep → **全部只命中文件头注释的「依然不做」清单,零行实码**
  - 三条点名要求全部落实:**N14** 四态各 `{en,key,icon,cls}`,`:730` 只读 `.en`、`:737` 只读 `t(.key)`,四条 `title` 断言是英文原串 + 反向断言(indexing 因 K20 下 title 与徽标文字巧合同为 `Indexing`,物理上只能排键名,注释已说明);**N13** 模板 38 个类逐个 grep scss,**只有 `k-status-badge-cn` 无定义**,白名单零改动仍 187;**`tomb`** 全文无字面量 `name="tomb"`,测试直接断言 `props('name')==='tomb'`
  - **⚠️N 专查**:24 个键的 zh 值逐字符对附录 A,**9 行 ⚠️N 里本刀撞上 5 行全部照抄未改对** —— `aiKbRebuild`=**恢复**(不是「重建」,测试 `toContain('恢复')` 钉住)· `aiKbColAction`=**类型**(与 Type 撞车,表头集合式断言里出现两个「类型」)· `aiKbColVectors`=向量数 · `aiKbPagerPrev`=**上一张** · `aiKbPagerNext`=**下一步**
  - **属性态 7 个宿主全覆盖**,一律直接比 `attributes()` 字符串值,**零 `toBeUndefined()`**;`.k-type-tag` 的 `data-kind` **5 值全齐**且 doc 另拆 legacy 两侧;多宿主检查:`.k-frow-fhead` 同带 `.k-frow-f` 类但蓝本本身不给它三个 `data-*`,落地一致,测试用 `:not(.k-frow-fhead)` 精确定位
  - **mock ↔ fixture**:`FILES_ALL_8` 与 `files-all-8.json` **`JSON.stringify` 全等**;🔴 **T8 修复轮补回的 3 条 docker 路径完整 64 位哈希没被改短**;信封层数与另两个 store 测试文件同族;人工构造的 4 行字段 schema 与 fixture 12 字段完全一致,且构造正当性回源核过(`files-has-error.json`/`files-tombstoned.json` 实测都是空数组,README 明写这几项真机全验不了)
  - T8 的 13 个 describe **一条都没被削弱**;diff 里对既有测试只有 1 处改动 = 骨架屏那条被 T9 合法新增内容证伪后的必要跟随订正(实为增强,已申报)
- **评审自做 10 次 RED 探针,其中 3 次证伪了假覆盖**:
  - 咬住的 7 次:换图标名 · 去 `pageTo` 的 `Math.min` · 删 `data-zero`(两侧都红)· **N14 合并字段 → 3 条精确报红** · `zerohint` 判据弱化(证明 `status==='ok'` 也被钉住)· 重建禁用条件改只判 `!== 'ok'` · 删 `data-selected`
  - 🔴 **没咬住的 3 次**:⑧ 把 `tombstoned_at` 整格换成 `WRONG` → **107 全绿** · ⑨ `parser_version`/`mime`/`modalities` 的 `—` 三处同时换常量 → **107 全绿** · ⑩ 徽标 icon 兜底 `'check'`→`'danger'` → **107 全绿**
- **Important(进修复轮)**:
  - **I-1** N14 兜底分支的 **icon 回落零覆盖,而用例名 `:1042` 声称「图标回落 check」** —— 用例体只断言 `data-s`/`title`/文案三项,没有 `props('name')`。治理 §3.5 N14 明列「这个兜底分支也要有用例」含 icon 回落
  - **I-2** 详情面板 `tombstoned_at` 的值断言 `:1451` 是**恒真断言**:`.k-fd-v.mono[title]` 这个选择器**同时命中 `.k-fd-sha`**(它本身就是 `k-fd-v mono k-fd-sha` 且带 title),所以只要详情面板渲染出来就永真,与 `tombstoned_at` 格无关。「条件出现」那半**是**覆盖的(`keys` 数组 4 项 vs 5 项已钉住),只有**值**没钉
- **I-3 越界 —— 协调者裁定:保留,不回退。** `someSelected`(`:302-304`)+ 两个 indeterminate `watch`(`:326-333`)对应蓝本 `:583-592`,落在 T9 区间外约 10 行。评审查实:协调者点名的四项**全部存在**,但 `selectablePageIds`/`allSelected`/tombstoned checkbox 禁用+title 分别被蓝本 `:154`/`:153`/`:182-184` **直接引用,而这三行在 T9 区间内**,brief 又硬要求区间内 DOM 完整 → **物理上不可拆**;真正可回退的只有那 10 行。实现者已在代码注释 `:129-135` + 报告三件套申报(状态 `DONE_WITH_CONCERNS` 正为此),**不是隐藏越界**。裁定理由:回退收益低于风险(`allSelected` 仍在,`someSelected` 只有 watch 一个消费者,拆开更难读),与评审判断一致
- Minor:M-1 报告三处与实测不符(探针②「恰好整除也报红」不成立 —— 那条 `Math.min` 是 no-op 故仍绿;「新增约 61 条」实为 **50**;两处落地行号偏 1)· M-2 两处已注释但未在报告申报的必要适配(`:key` 合并到 `<template v-for>` · `ms()` 类型转换 helper)· M-3 详情面板另三处值绑定 + 两处回落分支零覆盖
- **⚠️ 评审登记的「无法核实」**:`someSelected`/`watch` 的 indeterminate 在 jsdom 下无视觉且**当前零测试覆盖**(DoD 未要求,**记给 T10**)· 🔴 **`rebuildRow` 空函数体 = T9 状态下点「恢复」按钮什么都不发生**,若 T9→T10 之间有真机验收窗口要跳过这个按钮(本会话 T10 紧接其后,无窗口)· `.sp7/NimoOS-New-UI` 有 5+ dirty 文件 mtime 是今天凌晨,内容全是 SP7 相册文件 = **另一个并发会话在做 SP7-P6b,不是 T9 碰的**
- **修复轮 1/5**(`3eec77a`..`11f145a`,2 文件,`IndexedFilesView.vue` **零改动**):**5/5 ADDRESSED**。sonnet 定向再评审:
  - I-1 → `:1051` 补 `props('name')).toBe('check')`;**再评审重做证伪探针** `check`→`danger` → **精确 1 例报红**
  - I-2 → `:1294-1297` 改用 `fdValueFor(w,'tombstoned_at')` 按 `.k-fd-k` 文本定位兄弟 `.k-fd-v`,**同时比 `text()` 与 `title`**;再评审核实**不会二次命中 `.k-fd-sha`**(那格的 `.k-fd-k` 文本是 `sha256_full`);重做「整格换 `WRONG`」→ 精确报红,**再自己设计更刁的一次「只废 `title`、值保留」→ 仍精确命中 `:1297` 的 title 断言**,证明修的是真两侧不是换了个恒真断言
  - M-3 → `:1279-1280` + `:1312` 补三处断言;重做三处同时换常量 → 精确报红
  - M-1 → 三处订正逐一核验:探针②结论已改成「仅 `total=0` 与末页报红,恰好整除不报红」且再评审复现相符;`it(` 计数 `855cc39`=57 → 现 107 = **精确 +50**;两处落地行号 `grep -n` 核对精确
  - M-2 → 两处申报已补进报告 §14.5
  - **第一轮有效断言抽查复验**:删 `data-zero` → 报红;去 `pageTo` 的 `Math.min` → 末页用例精确报红。**都还咬得住**
  - **零新破坏**:`.vue` 本轮 diff 为空;T8 的 13 个 describe 在 hunk 范围外未被触碰
  - **T10 交接项属实**:再评审自己 grep 确认 `indeterminate` **零测试命中**,已如实记在报告 §14.7
- 三门(再评审复跑):**318 文件 / 3113 例**全绿 · tsc 0(用例数不变是因为补的是既有用例里的断言而非新 `it`)
- **Task 9: complete (commits `855cc39`..`11f145a`, 修复轮 1 后 review clean, I-3 越界 10 行按协调者裁定保留)**

### T10 — 收官刀:多选收口 + 重建 + 双上限 + 弹窗 + 动作条 + 轮询 + 路由反转(opus)

- BASE `11f145a` · 基线 **318 文件 / 3113 例**
- commit `541e363`(7 文件:4 源 + 2 连带测试 + 报告)· 三门 **318 文件 / 3152 例**全绿 · tsc 0 · build 0(+0 文件 / +39 例)
- opus 评审 **spec ✅ / 质量通过 · 零 Critical 零 Important**:
  - 🔴 **整页完整性(第一维度)**:评审自己剥注释统计两个 `<template>` 的开标签 → `KIcon 25/25` · `button 15/15` · `span 56/56` · `input/label/option/select/template/b/br` 全等;**`div` 60 vs 58 差 2 的解释评审回 reka 源码实证成立** —— `DialogOverlayImpl.js:15` 与 `DialogContentImpl.js:31` 的 `as` prop 无 default → 透传 `undefined` → `Primitive.js:18-21` 的 default 就是 `"div"`,故各渲染一个 div 且类名与蓝本 `:356`/`:357` 一字不差 → **58+2=60 精确对齐**;另核 `VisuallyHidden.js:31-44` 确实合并了 `position:absolute;width:1px;clip-path:inset(50%)` 整套隐藏样式,**标题不会在弹窗里显示两遍**
  - 占位扫描(评审自跑,剥注释):`TODO`/`FIXME`/`XXX`/`待补`/`占位`/`v-if="false"`/空函数体/空箭头 **全部 0**
  - **`rebuildRow` 已补全**:T9 版确实是空体,现 `:585-595` 与蓝本 `:760-770` **逐句对齐**四步,catch 走 K5,按钮 DOM 与调用点零改动
  - 越界/缺失标识符:评审自抽 64 个蓝本符号逐个 grep → 缺 5 个(`justDone` `selTick` `expTick` `doneTick` `expanded`),**正是治理 §3 K13 授权删的 Vue2 Set 侦测土办法**(蓝本 `:479-482` 的 `void this.xTick; return this.xSet` 代理 + `:460-462` 三个计数器);实现者报告措辞「唯一找不到的是 `justDone`」用词不严但同句已把 5 个一并列出并归 K13,**不构成缺陷**
  - 六个区块逐块无差异;**`doRebuildAll` 的 `:791-809` 订正评审自己数过蓝本 → 正确**;30 秒轮询**T8 已做本刀零改动**,本刀只在三入口各加一次 `startIndexedPolling()` 对应蓝本 `:764`/`:780`/`:803` 不多不少
  - **K7 弹窗结构与 T5 样板逐层同构**:`DialogRoot > DialogPortal to=".knowledge-app" defer > DialogOverlay.k-modal-bg > DialogContent.k-modal` + `VisuallyHidden as-child > DialogTitle`;`grep Teleport` / `grep '<div class="k-modal-bg"'` **只命中头注释里的禁令文字,模板零命中**;超限横幅内嵌在 `.k-confirm-body` 不是 toast;测试还额外钉了 `role="dialog"` + `aria-labelledby`
  - 模板 81 个类扫描 → 找不到的**只有 `k-empty-btn`(N10)与 `k-status-badge-cn`(N13)** = 正好两个登记例外;`.right` 在 `knowledge.scss:841` 核到
  - 🔴 **`indeterminate` 四种组合逐条核判别力 → 全部有牙齿、无一恒真**(每条都先经历相反状态,断言读的是 DOM 的 `indeterminate` 属性);评审探针把两个 `watch` 体换成 `void cb` → **4/4 全部报红**且报红点正是中间态的 `toBe(true)`;**实现者关于「初稿只有 1 个可选行导致中间态恒 false、改成 3 行」的说法判为真且是正确修正不是掩盖**
  - **双上限四个方向全钉**:500(`>`→`>=`)· 501(常量改 501)· 10000(弹窗 `>`→`>=`)· 10001(常量改 10001)四次变异各自精确报红;语义分工也核了 —— EXPLICIT 前端硬拦(单独删 `|| overExplicitCap.value` → 「绕过 disabled 也不发请求」精确报红)· FILTER 只警告不拦
  - **⚠️N 专查**:9 行错译逐个回 `zh_cn.ts` **一字未改**(i18n 两档根本不在本 commit);本刀新用 **15 个键零个带 ⚠️N** 且 zh 值与附录 A **逐字符 15/15 全等**(含全角 `（400）`、全角 `？`);N9/N10/N11/N13/N14 全部照抄;E-9 的「5 处不套 `String()`」一致
  - 🔴 **T8/T9 断言零削弱的硬证据**:`git diff 11f145a..541e363 -- IndexedFilesView.test.ts | grep '^-'` **只有 1 行删除**,是 `vi.hoisted` mock 对象被扩成含 `parserReindexFiles` 的版本。评审另抽 3 条变异验证(`filtersDirty` 七条 / N12 反向映射 / N14 title 英文原串)**全部还咬得住**
  - **评审自做 11 次实现变异 + 3 次既有断言变异,全部精确报红并还原**(`git status --short` / `git diff --stat` 皆空)
  - **mock ↔ fixture 脚本双向 diff**:`FILES_ALL_8` 8 行 × 14 字段**完全相等零差异**,🔴 **T8 补回的 3 条 64 位哈希没有又被改短**;`REINDEX_OK` 与 `reindex-one.http` 逐字;`CAP_400_FILE_IDS` 与 `reindex-cap-400.http` 逐字(**已实测**);`CAP_400_FILTER` 确实用的是 README 里「源码推定未实测」的形状且报告已注明;信封层数没搞反且与 `knowledgeStore.parser.test.ts` **跨文件形状一致**
  - **未部署未合 master 核实**:`git branch --contains 541e363` 只有 `sp8-ai`;reflog 12 条全是 commit 无 merge/rebase/reset/stash/push;无 `deploy.sh` 痕迹;`git show --name-only | grep -c sp7` = **0**
- **实现者两条 concern 评审均判成立 —— 错在任务书不在实现**:
  - 🔴 ① **`data-active` 不套 `String()` 是对的,是我的任务书 §4 写错了。** 评审四处独立核实:蓝本 `:323` 原文**没套** · 附录 D §D.3 标 **❌ 不套** · 治理 §12 **E-9** 裁定「逐处照抄蓝本(改写 = 与需求无关的顺手改动,禁)」并指出 P5a `.k2-cc` 事故的真实教训是**属性名错**而非 `String()` · 评审自读 `@vue/runtime-dom@3.5.39` 的 `patchAttr`(`:560`)确认 `data-active` 不在 `isSpecialBooleanAttr` 里 → `false` 走 `setAttribute` 渲染成 `"false"`,**套与不套渲染完全一致**。**实现者「治理+附录 > 任务 brief」的优先级判断正确且已显式申报**
  - ② `EXPLICIT_REBUILD_CAP` 确是本刀新增:评审 `git show 855cc39 | grep CAP` 实测 T8 **只声明了 `FILTER_REBUILD_CAP`**,且 T8 注释明写「`EXPLICIT_REBUILD_CAP` 本刀不声明,T9/T10 的动作条才用到」。我的任务书 §2 那句不实
- **两条 Minor(注释/报告层面,已带进末轮)**:M-1 `IndexedFilesView.test.ts:616` 注释仍写 `蓝本 :791-808`(`.vue` 已在 3 处订正成 `:809`,漏了这处 → 同一文件内两种行号并存)· M-2 报告 §99-101 写「13 个类」但列了 14 个(代码侧完全正确,仅散文计数笔误)
- **⚠️ 评审登记的「真机验收要注意的」**:🔴 **重建是真写操作**(文件墓碑后重新入队,pending 队列会涨)· 两个上限真机都触发不到(选不到 501 个、总数到不了 10001)→ `.k-ab-warn` 与弹窗内嵌超限横幅**真机看不到** · `error`/`tombstoned` 徽标 / `errhint` / `zerohint` / tombstoned 禁选 / 分页翻页(恒 1/1)真机全验不了(§4.5 已登记,**非缺陷**)· reka 走 `pointerDownOutside`(pointerdown)与蓝本 `@click` 有语义差,「按下拖出去再松手」只能真机感受(与 T5 同模具,T5 已过真机验收)· `_flashDone` 的 `setTimeout` 无卸载清理(照抄蓝本),真机「点恢复后 2.2 秒内切走」会留孤儿定时器,不持 DOM 引用可忽略 · `DialogPortal to=".knowledge-app"` 只认第一个同名宿主(生产由 `KnowledgeLayout` 提供唯一宿主,**P5c 写弹窗测试会再撞上**)
- **修复轮 1/5**(`541e363`..`2eacd43`)+ **修复轮 2/5**(`2eacd43`..`1f0022b`,纯 markdown):全部 ADDRESSED。
  - 修复轮 1:M-1 `test.ts:616` → `:791-809`(再评审自己 `sed` 核蓝本确认 `:808` 只是内层 catch 的闭合、函数 `},` 在 `:809`;`grep` 确认 `src/` 里唯一残留的 `:791-808` 是头注释里**记录这次订正本身**的元说明);M-2 类名重列成分组表(动作条 5 + 弹窗 7 + 复用 2 + 非 `k-*` 3 = 15);报告新增 §18「任务书勘误」登记 B-1/B-2 并写明 P5c 复用同模板会再撞上
  - 🔴 **再评审逮到实现者一处自述失准**:它自称「顺手删了 §11 里重复一遍的段」,实测**原报告那处本来只有一句**,它实际做的是「把证据换成可核的 `grep '^-'` + 顺手多写了一段近似重复」。关键结论「零削弱」原文完整保留、无信息损失,**不构成回归**;但协调者要求订正自述 —— **报告自述失准与代码注释行号写错是同一类问题,这一期从头到尾的纪律就是「申报要与实际一致」**
  - 修复轮 2:§1 摘要行「13 个类」→「15 个类」与 §5 对齐;新增 §20 把那句失准自述订正为实际做的两件事
- **Task 10: complete (commits `11f145a`..`1f0022b`, 修复轮 2 后 review clean, 0 open)**

---

## 🏁 整支线 opus 终审(`d8efb0e`..`1f0022b`,19 文件 / 7323 增 / 29 删)

**结论:Ready to merge · 零 Critical · 零 Important · 3 条 Minor 全部「带着合并 + 进 P5c 交接」。无需修复轮。**

终审自己复跑三门:**318 文件 / 3152 例全绿** · tsc 0 · build 0 · **两条已知噪声一次都没红**。起点 313/2872 → **+5 文件 / +280 例**,与逐任务增量闭合。

### 跨任务查了什么(终审的独特价值,不重复单任务评审)

- **A1 三刀接缝**:做了**机器化行号矛盾扫描**(把两个文件所有 `:NNN` citation 与同行反引号标识符配对,找「同一构件被引成两个行号」)→ 5 个候选全是启发式假阳性;抽 14 个区间逐个回蓝本核**首尾行全部精确命中**。类型标注松紧一致(19 个 computed **全部**带泛型、`any` **0 处**、4 个 `unknown` 全在有文档的收窄处、4 个 `!.` 全在 N14 三元保护内)
- **A2 死东西**:**死 i18n 键 0/100**(唯一无字面量 `t()` 的 `aiKbStatusIndexing` 是经 `statusBadgeMap.key` 动态取到)· **死 CSS 类 0/85**(终审第一遍裸 grep 踩了坑得 9 个假阳性 —— 注释里「本期不搬」的类名被当成真选择器,**剥注释后**才得 85 个真选择器,与附录 D 的 85、白名单 102→187 三方闭合)· **死代码 0**(105 个声明逐个查)· 两个 util 函数名零重叠、8 个导出全被消费 · **`fmtAgo`/`fmtRel` 全 `src/ai` 只有 2 处,K11 禁合并被遵守,无第三处**
- **A3 `var()` 闭环**:只取本批 added 行的 37 个 token(全文扫会把 P5a 既有算进来 → 12 个假「浅档缺失」)→ **31 个颜色 token 两档都在零缺失**,6 个只在基础块的全是 `--font-*`/`--r-*` 结构量;4 个新 token 两档齐、归属与治理 §6.2 一致;`theme-exception` 0;顶层裸 `.k*-` 选择器 0
- **A4 跨任务 mock 形状**:6 个测试文件全收集对比 → `notes.*` **三个文件全 camelCase,snake_case 泄漏 0 处**;`parserRetryJobs` 的 store 层两侧 vs 视图层恒 `null` 是**分层正确不是不一致**
- **A5 三件套核查 18/18 全齐**(K9–K20 十二条 + N9–N14 六条,每条都 ①落地 ②代码注释 ③报告申报,逐条给了实测判据)
- **A6 字符级比对**:⚠️N **9/9 COPIED-AS-IS,drift 0**(两组同值撞车仍撞车、`Total done:` vs `Total done` 的冒号差异也保留);**终审独立重做 100 键复核不采信 T1 的 95/95** → 95 个有 Vue2 源的**逐字符全等 MISMATCH 0**,余 5 个查无此串且构成与治理声明精确吻合(K19×1 / K16×2 / K18×1 / K20×1)
- **A7 「文本判据没锚定/没排除注释」第 7 例没有出现**:scss 色扫的**剥注释时机分工正确**(`:271` 那条跑在未剥注释的 `rawSource` 上、区间也用 rawSource 自算;类名/token 存在性才用剥过的),终审实证「往规则前塞一行含 `#d8362b` 的注释 → 精确报红」;所有读文件的守卫都用 `node:fs` + `fileURLToPath`,**零 `?raw`、零 `__dirname`**
- **终审自做 4 次跨任务变异全部精确报红并还原**:⚠️N #85「已启用」改对成「有效」→ 1 例红 · **两档同时**删 `aiKbColVectors` → 精确红并报出键名(**证明 T1 修复轮补的那 5 行断言真的堵上了原盲区**)· 注释里塞 `#d8362b` → 红 · N14 把 `:title` 从 `.en` 改成 `.key` → **4 例**红

### 完整性(终审独立重做的可核数字)

| 页 | 蓝本 | 落地 | 差 |
|---|---|---|---|
| IndexedFilesView(826 行) | KIcon 25 / span 56 / button 15 / option 9 / input 6 / label 5 / select 4 / b 3 / br 2 / template 7 | 全部 `=` | — |
| | div 60 | 58 | **−2** |
| QueueView(417 行) | KIcon 23 / span 36 / button 16 / input 2 / b 1 / template 12 | 全部 `=` | — |
| | div 35 | 33 | **−2** |

🔴 **两个文件完全同一个 pattern、同一个差值**:各 −2 个手搓 div、各 +6 个 reka 原语;`DialogOverlay`/`DialogContent` 运行时各渲染一个 div(`Primitive` 的 `as` default)→ 运行时 DOM 回到 60/35。**这是 K7 唯一的结构差且两页口径一致 = 强跨任务一致性信号。**

- **路由反转两次都完成**:`DEFERRED_TABS` 现剩 **6 项**;P5a 那条断言反转两次、**旧文本两块都留成注释**(`改前（P5a T12 原文）`+`改前（P5b T5 原文）`),`toHaveLength` 10→9→8 且每次都**增加**断言无削弱
- **深链闭合**:`DashboardView.vue:202` 推 `?filter=failed` → 路由已反转成 `QueueView` → `:134` 的 `immediate` watch 立即生效
- **产品可用性**:两个模板共 **43 个 handler 逐个解析到定义并数函数体行数 → 43/43 全部非空**(T9 那个空体 `rebuildRow` 已被 T10 补成 9 行);占位扫描在 7 个源文件上全 0。**用户视角没有断掉的东西**

### 卫生

全期零改动清单 6 项 `git diff --name-only` **全空**(`knowledgeStore.ts` 只有 T3 的 50 增 3 删)· `NimoOS-UI` 只读工作树零改动 · `git log --name-only` 里 `sp7|deploy|NimoOS-Service` 命中 **0** · `git branch --contains HEAD` 只有 `sp8-ai`(**未合 master、未部署**)· reflog 20 条全是 commit 零 merge/rebase/reset/stash/pull · 白名单 `WHITELIST_187` = 187 项且 102+32+53 三方闭合

### 终审的 3 条 Minor(全部「带着合并」+ 进 P5c 交接)

1. 🔴 **`knowledgeStore.parser.test.ts:85` 的 `parserDeleteJob` mock 成 `{}`,正是治理 §4.1 点名的错答案**(权威口径是 204 空体 → `mockResolvedValue('')`)。**不是 P5b 缺陷**:该文件 P5a 既有、本批零改动,且被「`knowledgeStore.ts` 只有 T3 能改」圈在授权外;store 的 `deleteJob` 不读返回值故当前零行为差异。**P5b 的治理文件是第一份识别出这个既有问题的文档** → 交 P5c
2. **模板零裸色守卫的 `<template>` 提取靠「`</template>` 在第 0 列」这个隐式锚定**:当前正确(终审实测两文件都覆盖到最后一行),但两文件各有 7/12 个**嵌套** `<template>`,哪天有人手改缩进或换 formatter,非贪婪正则会**提前截断 → 静默少扫一段模板且三门不红**。建议 P5c 加第三个视图时一并改成贪婪 + 覆盖度自检
3. **DM9 用例名过度声明**:`indexedFilesView.test.ts:128-139` 声称「用同一个 30 天差值验证 `fmtRel` 与 `fmtAgo` 行为不同」,但断言与 `:117` **同输入同断言完全重复**且该 block **没有 import `fmtAgo`**。**不是假绿**(断言为真且已覆盖),是用例名过度声明

---

## T11 — dev server 陈旧预打包坑(协调者收官阶段临时追加,sonnet)

**为什么临时加**:走到「重起 `:5288` 交验收」这一步时,协调者实测发现
`.sp8/NimoOS-New-UI/node_modules/.vite/deps/@nimotech_nimoos-service.js` 是 **2026-07-23** 的产物(10 天陈旧),
**缺 `listDistillJobs` / `getDistillStatus`** —— 正是 T5 的 `QueueView.vue` **沉淀 scope** 要用的两个方法。
用户一进沉淀 scope 就会 `TypeError` 被 catch 吞成「加载失败」。

**根因(本仓已有完整定论)**:`@nimotech/nimoos-service` 是 `file:../NimoOS-Service` 依赖,pnpm 把 dist 硬链进 `.pnpm`,
Vite 当普通依赖**预打包**;缓存失效判据是 lockfile / vite config / **版本号**(恒 `0.0.1`)、**不看内容**。
`vitest` 与 `vite build` 直读 node_modules 真实文件 → **只有 dev server 有这层缓存,三门全绿抓不到**。
**同一个坑 SP9-P1 已在主工作树栽过并修好**(当时表现为 4 个「保存配置失败」),用户笔记里也明写
「⚠️ `.sp7` / `.sp8` 两个 worktree 有各自的 `vite.config.ts` 与 `node_modules`,同一个坑还在那儿」。

- commit `820d426`(3 文件:`vite.config.ts` + 新建守卫测试 + 报告)· 三门 **319 文件 / 3153 例**全绿 · tsc 0 · build 0
- 修法照搬主工作树 SP9 先例(`optimizeDeps.exclude`);守卫测试用 `node:fs` + `fileURLToPath`(没踩 `?raw` 与 `__dirname` 两个坑)
- dev server **PID 85265 / 端口 5288**,`curl -sI /app/` → **200**;实现者称已追踪到浏览器实际拿到的是真实 `.pnpm/.../dist/notes.js` 而非陈旧 `.vite/deps` 产物,两个方法都在
- **实现者 concern(判断正确)**:先例守卫用的 `@types/node` 导入风格在 `.sp8` 行不通 —— 这个工作树**故意没有 `@types/node`**,
  它试着加之后打破了 **5 个既有已评审测试文件的 `@ts-expect-error` 抑制**(其中 4 个在 `src/ai/` = 它被禁止碰的区域),
  于是回退、改用本工作树自己的 `@ts-expect-error` 约定。**没有为了照搬先例去动已终审通过的产品代码,取舍对。**
- 🔴 **`.sp7` 那份 `vite.config.ts` 同坑仍在**(那边有并发会话,本期不碰)

---

## 🏁 P5b 编码收官(2026-08-02)

**坐标**:New-UI `sp8-ai`@`820d426` · Service `sp8-ai`@`15c2eba`(**本期零改动**)· roadmap `NimoOS-UI@f768a2c0`(分支 `docs/vue3-migration-sp3`,只提了 `docs/vue3-migration-roadmap.md` 一个文件)
**三门**:**319 文件 / 3153 例**全绿 · `vue-tsc` 0 · `vite build` 0(起点 313/2872 → **+6 文件 / +281 例**)
**状态**:**未部署、未合 master**。验收走 `:5288`(PID 85265),清单见 `p5b-acceptance.md`

### 12 个任务全部关账

| 任务 | commit | 轮次 |
|---|---|---|
| T0 治理文件 + 附录 A/B/D + fixture | `317b8da` | 修 1 轮(**查出计划书 12 处错**) |
| T1 i18n 100 键 | `8a934db` | 修 1 轮 |
| T2 scss A(32 类) | `4c18508` | **一轮过** |
| T3 store 三处 epoch 守卫 | `90b0cd9` | 修 1 轮 |
| T4 `util/queueView.ts` | `9a98106` | **零问题一轮过** |
| T5 队列页 + 路由反转① | `7014b22` | 修 1 轮 |
| T6 scss B(53 类) | `15a8b76` | **一轮过** |
| T7 `util/indexedFilesView.ts` | `dfc57ed` | **一轮过** |
| T8 文件页第 1 刀 | `855cc39` | 修 1 轮 |
| T9 第 2 刀 | `11f145a` | 修 1 轮(**两条假覆盖**) |
| T10 收官刀 + 路由反转② | `1f0022b` | 修 2 轮 |
| T11 dev 预打包坑(临时追加) | `820d426` | 待评审结论 |

### 这一期最值钱的东西

1. **T0 那一刀值回全部成本**:12 处计划书错里,两处会直接让下游做错 —— 「Vue2 无源的 6 条键」其实全都有(3 条中文值还不一样);**整整漏了一个键**(蓝本唯一一处非字面量 `$t()`,而本机 8 个文件里 5 个是那个状态)。这两处都是靠**差集/闭合验证**挖出来的,靠读计划书读不出来。
2. **「评审自己动手做变异」是这一期抓到真问题的唯一手段**。累计 60+ 次 RED 探针,逮到的两类真问题都是三门全绿、覆盖率好看、但断言空转:
   - **假覆盖 3 处**:T9 一条用例名写「图标回落 check」而断言里没有图标那项;一条想验某格的值而选择器同时命中旁边的哈希格(恒真);T3 的 catch 分支守卫删掉全绿,因三组交错用例**全走成功路径**
   - **文案 1:1 破口 1 处**:T5 把 409 分支的 `Cancel failed: ` 前缀砍了 —— K5 授权的是「不回显后端 body」,而那句是固定 i18n 串
3. **T10 按权威源否决了协调者的任务书**,并回 Vue 源码自证。**「治理+附录 > 任务 brief」这条优先级在这一期被实战检验过一次,是对的。**
4. **守卫缺口从 2 条识别到 4 条**,其中 ③(color-guard 不扫模板 `style=` 属性)是靠「附录 B 自称覆盖全部色字面量,但蓝本 `QueueView.vue:87` 有 3 处内联渐变不在表里」这个矛盾暴露的。
5. **T11 那个坑**说明一件事:三门全绿 ≠ 用户看到的是新代码。dev server 的预打包缓存是**只有实机验收才会暴露**的一层,而这一期是靠「交付前主动去 grep 缓存内容」而不是靠用户撞上来发现的。

### 给 P5c 的交接项

1. **治理沿用**:`p5b-common-constraints.md` + 附录 A/B/D + `p5b-fixtures/`(17 份真机响应体)**直接沿用**,新期只出 `p5c-` 版差异。**每批新增 scss 段要往 `knowledgeStyles.test.ts` 白名单加类**(现 187)。
2. **K17 留给 P5c 的四个类**:`.k-modal-head` / `.k-modal-title` / `.k-modal-x` / `.k-modal-body`(蓝本 `knowledge.scss:1318-1334`)本期确认**未搬**(终审验过真选择器 0 处),P5c 要弹窗头部时再搬并同步扩白名单。
3. **修 `knowledgeStore.parser.test.ts:85`** 的 `parserDeleteJob` mock:`{}` → `''`(权威依据是 P5b 治理 §4.1;该文件本期在授权外)。
4. **`DialogPortal to=".knowledge-app"` 只认第一个同名宿主** —— 生产由 `KnowledgeLayout` 提供唯一宿主,但**P5c 写弹窗测试要自己在 body 里备好宿主**(先例 `QueueView.test.ts:127-130` 的 `withHost()`)。
5. **模板零裸色守卫的隐式锚定**:靠「`</template>` 在第 0 列」;两个文件各有 7/12 个嵌套 `<template>`。P5c 加第三个视图时一并改成贪婪匹配 + 覆盖度自检,别再复制这个脆弱正则。
6. **DM9** `indexedFilesView.test.ts:128-139` 用例名过度声明。
7. 🔴 **`.sp7/NimoOS-New-UI` 的 `vite.config.ts` 同一个预打包坑仍在**(那边有并发会话,本期不碰)。
8. **后端票**:Parser `retry_failed_jobs()` 的 `file_ids` 是死形参(`repo_jobs.py:107-121`)→ K18 三入口只能全桶重试,「按 file_ids 精确重试」是后端 §B;`parserClearFailedJobs` 与 `parserDeleteJob` 的 404/409 响应体**仍是源码推定未实测**(C.3 破坏性 fixture 一条未跑),P5c 若依赖这些形状要先补实测。
9. **`⚠️N` 九行错译**若要修是**独立产品决策票**(要同时改 Vue2 与 New-UI 两侧),不能夹在迁移期里做。

### T11 评审结论(sonnet,通过)

**spec ✅ / 质量通过 · 零 Critical 零 Important · 1 条无关紧要的 Minor**(报告引先例行号偏 6 行)。

- **与先例逐字段对照**:`exclude` / `include` 数组内容、块上方 9 行说明注释、挂载位置、守卫断言正则 **全部逐字相同**;未加先例没有的、未漏先例有的
- 守卫用 `node:fs` + `path.dirname(fileURLToPath(import.meta.url))`,**没踩 `?raw` 与 `__dirname`**;断言是钉死正则不是松形式
- **评审自做 3 次 RED 探针**(删整块 / 换包名 / `exclude`→`excludeDeps`)全部精确报红并还原,**报红文本与实现者贴的逐字一致,不是编的**
- 🔴 **评审独立验证「坑真的被堵上了」**(全部贴了原始命令与输出):
  - `ls node_modules/.vite/deps/ | grep nimoos-service` → **空**(陈旧预打包产物已不存在)
  - `curl /app/src/main.ts` → import 的是真实 `.pnpm/.../dist/index.js`,**不是** `/app/node_modules/.vite/deps/@nimotech_nimoos-service.js`
  - 顺着 dev 模块图 curl 到 `dist/notes.js` → **`listDistillJobs`(`:185`)与 `getDistillStatus`(`:192`)都在**
  - `diff` dev 下发内容 vs node_modules 真实文件 → **只差一个剥 sourcemap 后的空行**,确认是喂真实文件而非冻结快照
  - `ss -ltnp` 确认 PID 85265 在听 5288,`curl -sI /app/` → **200**
- **`@types/node` 那条 concern 评审判「取舍正确」**:主工作树确实用裸导入(它有 `@types/node`)· `.sp8` 确实没装(`pnpm ls` 空)· 因果成立(`@ts-expect-error` 在错误消失后自身变成 TS2578)· **评审核实了报告点名的全部 5 个文件每个都已存在这条约定**,且 `settingsStyles.test.ts` 头注释写明是 SP8-P2a 的既定手法、`knowledgeStyles.test.ts` 明写「逐字照抄同样的解法」→ **是本仓被至少 4 个任务复用过的真实惯例,不是现造的**。唯一的第三条路(先把那 5 个文件的 `@ts-expect-error` 也迁掉)会牵扯改 `src/ai/` = 越界
- **越界与卫生**:`git show --name-only 820d426 | grep -i "src/ai"` → **空**;主工作树只有那 3 个既有 design-export staged 删除**零新增改动**(T11 确实只读没写);`.sp7` 工作树 `git status --short` **空**;`git branch --contains` 只有 `sp8-ai`
- 副作用核查:探针期间 dev server 因配置变更自动重启 4 次,每次 `server restarted.` 无报错、`curl -sI` 均 200 → **这条 `exclude` 规则本身表现正常**;生产构建不受影响(`optimizeDeps` 只影响 dev)
- **Task 11: complete (commit `820d426`, review clean 零 Critical 零 Important, 1 trivial minor)**

---

## 🔎 验收第 1 轮(2026-08-03)—— 未关账

**坐标**:New-UI `sp8-ai`@`e4a4220`(工作树干净)· Service `sp8-ai`@`15c2eba` · dev server PID 85265 / `:5288`(已跑 1d7h,`curl -sI /app/` 200)
**开工前复验**:`node_modules/.vite/deps/` 无 `nimoos-service` 残留 → T11 那个「dev 喂旧代码」的坑仍然堵着,用户看到的是真代码

### 走到哪儿

用户从 **A1 一路走到 B18**,**期间未报任何缺陷**;在 B18 卡住(找不到「失败」磁贴),随后转去追概览页 60 秒骨架的根因。
**B19–B21(沉淀 scope / 刷新保持 / 暗色第二轮)未走,验收未正式关账。**

### 发现 1 —— 🔴 清单漏项(不是代码缺陷)

**B18「从概览页点『失败』磁贴」在本机根本没有可点的东西。**
`DashboardView.vue:508-511`:`failed > 0` 才渲染 `<button class="k2-qchip" data-tone="danger">`(带 `→`);
`failed === 0` 渲染不可点的 `<span>`。本机 `failed: 0`,**照抄 Vue2,渲染成纯文字是正确行为**。
连带 `entries` 的 `badge: failed` + `:548` `v-if="(e.badge || 0) > 0"` → 「任务」项红色角标也不出现。

**根因是清单本身**:`p5b-acceptance.md` §二「本机数据不够真机看不到」列了 6 条,**漏了这一条**,
把一个数据依赖项当成了可验项。已修:§二 补第 7 条(含代码坐标 + 磁贴位置 + 替代验法)、B18 行改删除线。
**替代验法**(已验证机制存在,`QueueView.vue:131-135` `watch route.query.filter` + `immediate`):
直接敲 `…/app/#/ai/knowledge/queue?filter=failed`(及 `?filter=running`)—— 不用造数据就能验深链。

🔴 **给 P5c 的教训**:清单里凡是「点某个东西」的项,必须先确认**该元素在本机数据下真的渲染成可点元素**。
`v-if="x > 0"` 这类数据依赖的可点性,是「看起来能验其实验不了」的高发区。SP9-P4 已有同类教训
(「面板内状态机/弹窗才能到达的屏必须写点击路径」),这次是它的变种:**不只要写路径,还要确认路径上的元素存在**。

### 发现 2 —— 本机数据漂移,清单数字已过期

清单写于 08-02,后台索引一直在跑。08-03 实测(`/v1/parser/stats` + `/v1/parser/files?limit=20`):
`indexed_files: 7`(**4** indexing + **3** ok)· `pending: 339` · `running: 1` · `failed: 0` · `done: 9`。
原清单 A1 写「8 个 / 5 行索引中」、B14 写「338」→ 已在清单里就地校正并标注「数字对不上不是缺陷」。
另:**最小向量数现在是 1**(原先那行 `vector_count: 0` 的已索引完)→ 「无可搜索内容」提示比 08-02 时更验不到。

**给 P5c 的教训**:验收清单里的**具体计数**有保质期(本机后台索引持续在跑)。
交付清单时应写「实测于 YYYY-MM-DD,数字会漂,以下列命令现测为准」并附取数命令,而不是钉死数字。

### 发现 3 —— 概览页 60 秒骨架:根因下钻(用户要求查,查完仍**不修**)

**先声明**:60 秒这件事**不是本次新发现**。roadmap §566(2026-07-31 P5 规划会话)已完整记录
「`loadRoots()` 打死掉的 `/v1/wiki/roots`、共享包 axios `timeout: 60000`(`src/http.ts:50`)→ 整页骨架卡 60 秒」,
且 **D1 用户拍板不修**、已写进 P5a 验收清单当预期行为。本次是用户在验收间隙要求「往下查为什么」。

**本次新增的证据(roadmap 未记的部分)**:

1. **实测确认接口不是慢而是完全不回包**:`curl --max-time 70 http://127.0.0.1/v1/wiki/roots` → `http=000 time=70.002s`,零字节。
2. **Wiki 服务本身是活的**:同进程别的路径 `http=404 time=0.0039s` → 不是服务死了,是**这一个 handler 排不上队**。
3. **后端机制**:`NimoOS-Wiki/pkg/db/db.go:29` `SetMaxOpenConns(1)` —— 全服务同时只允许 1 个 DB 操作;
   `wiki.db` **36 GB**(`-shm`/`-wal` 尚在);进程 `nimoos-wiki` 已连续运行 **2d18h、CPU 稳定 20.3%**。
   → 某个长活儿霸占唯一那条连接不放,`/roots` 无限排队。**(具体是什么活儿未钉死 —— 日志需 root,且
   `/var/log/nimoos/nimoos-wiki.log` 最后写入停在 07-31 16:05。要挖到底须 `sudo journalctl -u nimoos-wiki`。)**
4. 🔴 **文件头【N3】注释里那条 fail-fast 论证在当前代码下不成立**:注释说 `Promise.all` 的 fail-fast
   能让「任一 reject → 立刻 settle」,并以此论证不该换 `allSettled`。但**三个 loader 各自内部都 try/catch 吞错**
   (`loadOverview` :332 · `loadRoots` :661 · `loadNotesSummary` :534)→ **没有一个会 reject** →
   `Promise.all` 在此处与 `allSettled` **行为完全等价**,fail-fast 永不触发;真悬挂时两者都出不来骨架。
   **这是注释的论证瑕疵,不是行为缺陷**(实际行为 = 等最慢的那个 = 60s,与注释描述的结果一致),
   故本期不动代码、不动注释。**P5c/P5d 若要碰 `DashboardView` 的 `onMounted` 或 `loadRoots`,先读这一条。**
5. **Vue2 蓝本行为完全相同**,已逐处比对:`DashboardView.vue:348-352` 同款 `Promise.all(...).finally(ready=true)`;
   `src/service/service.js:12` 同款 `timeout: 60000`;`src/service/wiki.js:72` 打同一个 `${PREFIX}/roots`。
   → **不是迁移引入的退化**,是继承的。

**给用户列过的四条路(A 不动 / B 给 `loadRoots` 单独短超时 / C 分区域渐进渲染 / D 修 Wiki 后端),
用户 2026-08-03 明示「先不修,先继续验收」→ 维持 D1 原判,B 方案记账不做。**

### 状态

**P5b 验收未关账**:剩 B19–B21 + 用户尚未给出通过结论。代码零改动(本轮只改两份台账/清单 markdown)。

---

## 🏁 P5b 收尾关账(2026-08-03,用户主动)

**用户指示**:「先不修(概览 60s)」→「全部完整这部分全部收尾」。**B19/B20/B21 未走即关账。**

**最终坐标**:New-UI `sp8-ai`@`cc6df78` · Service `sp8-ai`@`15c2eba`(整期零改动)· roadmap `NimoOS-UI@aff124e3`(分支 `docs/vue3-migration-sp3`,只提 `docs/vue3-migration-roadmap.md` 一个文件,带 pathspec;该分支被 SP7 并发会话共用,本次提交前 tip 是 SP7 的 `b1b58938`)

**三门口径**:沿用 **08-02 的 319 文件 / 3153 例全绿 · tsc 0 · build 0**。
本次未重跑 —— 依据是 `git diff --name-only 820d426..HEAD -- src/` **为空**,即最后一次产品代码提交(`820d426`)之后
只有两份 markdown 改动(`p5b-acceptance.md` / `p5b-progress.md`),`src/` 零改动。**不是「跑过了」,是「没有需要重跑的理由」。**

**验收实际覆盖**:A1–A13 + B14–B18 = **18 项**,用户未报任何缺陷。
**未覆盖**:B19(沉淀 scope 的 4 条可观察差异)· B20(沉淀 scope 刷新保持)· B21(暗色轮 2)· C 组全部(需造数据)。
放行依据:照 SP6-P3/P4/P5 先例(设备条件不足时以单测 + 每期终审为准)。
**这三项 + C 组的验收缺口,连同「7 列沉淀表格布局从未被人眼看过」这一条,一并交 P5c/P5d 若造了沉淀数据时顺带补验。**

**状态**:**未部署、未合 master**。`sp8-ai` 与 `sp7-photos` 压同一 base、非快进、4 个冲突文件,**合并顺序仍待用户拍板**。

**下一期**:**P5c 配置 + Parser 两页**(蓝本 `SettingsView.vue` 322 行 + `ParserStatus.vue` 164 行 +
`ParserTest.vue` 369 行 + `parser-styles.scss` 74 行 + `store/parserStore.js` 65 行;要反转 `DEFERRED_TABS`
摘 `'settings'` 6→5 + `knowledgeRoutes.ts:59` + `:62-63` 两条 parser 路由)。开工提示词已交付用户。
