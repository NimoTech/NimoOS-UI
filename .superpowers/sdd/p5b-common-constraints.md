# SP8-P5b —— 公共约束(实现者与评审者都必须先读)

**本文件只写与 `p5a-common-constraints.md` 的差异,P5a 那份的每一条都继续生效。**
读法:先读 `p5a-common-constraints.md` 全文,再读本文件;**同一节里本文件说了什么,就以本文件为准。**

- **优先级**:设计文档 > 本文件 > 任务 brief > 计划书。
  🔴 **本期特例:计划书 `2026-08-01-…-sp8-p5b-indexops.md` 已被回源核出 12 处错(见 §12),
  下游任务一律不读计划书原文,只读本文件与三份附录。** 附录里的数字与计划书冲突时,以附录为准。
- 设计:`NimoOS-UI/docs/superpowers/specs/2026-08-01-vue3-migration-sp8-p5b-indexops-design.md`
  (上级设计 `2026-07-31-…-sp8-p5-knowledge-design.md` 的 §5/§7/§8 继续生效)
- 附录(只用路径引用,不要把内容复制进任务 brief):
  - i18n 键表 → `.superpowers/sdd/p5b-appendix-A-i18n.md`(**100** 条新增 + 9 条复用)
  - 色值映射表 → `.superpowers/sdd/p5b-appendix-B-tokens.md`(**42 处** = scss 39 + 模板内联 3,后者见 §B.0)
  - CSS 类白名单 → `.superpowers/sdd/p5b-appendix-D-classes.md`(85 类,102 → 187)
  - 后端实测 fixture → `.superpowers/sdd/p5b-fixtures/`(先读那里的 `README.md`)

---

## 1. 工作区(与 P5a 的差异)

P5a §1 全部继续生效,**外加/订正这 5 条**:

1. 🔴 **可写仓只有一个**:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`,起点 `d8efb0e`)。
   **`.sp8/NimoOS-Service` 本期零改动** —— 因此**不需要**跨仓 `pnpm build`,**也不需要**消费仓 `pnpm install`
   (与 P5a 相反;设计 §2.3 已 grep 实证两个视图用到的 15 个 `parser*` + 4 条 distill 端点全在包内)。
2. 🔴 **蓝本的真实路径是 `src/views/AI/Knowledge/…`**,不是任何 brief 里可能写的 `src/pages/AI/knowledge/…`。
   本期三个蓝本文件(`git show main:` 读,`main`@`7a6ee6b7`):
   - `src/views/AI/Knowledge/QueueView.vue` —— **417 行**
   - `src/views/AI/Knowledge/IndexedFilesView.vue` —— **826 行**
   - `src/views/AI/Knowledge/styles/knowledge.scss` —— **2561 行**
   - (参考)`src/views/AI/Knowledge/store/knowledgeStore.js`、`src/assets/lang/zh_CN.json`
3. `/home/nimo/NimoTech/NimoOS-UI` **只读**,且是**多个会话共享的检出**,工作树在 `docs/vue3-migration-sp3` 旧分支上、
   还有别的会话的未提交改动。**一律 `git show main:<path>`,禁止 `cat`/`Read` 工作树文件取蓝本,
   本期任何任务都不在那里提交任何东西**(spec/plan/roadmap 由协调者提)。
4. **禁碰**:`/home/nimo/NimoTech/NimoOS-New-UI`(SP6/SP9)、`/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7)。
5. 禁 `git add -A` / `git add .`(只许显式列路径);禁 rebase / reset / stash / merge / push;
   不跑 `./scripts/deploy.sh`,不写 `/var/lib`,不改任何后端仓。
   一个任务 = 一个语义提交,提交后 `git show --stat HEAD` + `git status` 自查。
   `.superpowers/sdd/` 被 `.gitignore` 盖住 → 台账/报告文件要 **`git add -f <显式路径>`**。

**验收 dev server 已在 `:5288`,不另起端口**;每次提交后由协调者 kill 重起(承 P3a「用户验到陈旧代码」教训)。

### 1.1 🔴 全期零改动文件清单(计划书 §4,任何任务都不许碰)

| 文件 | 口径 |
|---|---|
| `src/ai/knowledge/views/KnowledgeLayout.vue` | **全期零改动** |
| `src/ai/knowledge/views/DashboardView.vue` | **全期零改动**(60 秒骨架照旧不修 = N3) |
| `src/ai/knowledge/components/KIcon.vue` | **全期零改动** —— 见 §1.2,本期用到的 glyph 已逐个核实都在,**不许往里加** |
| `src/ai/knowledge/util/indexedFiles.ts` | **全期零改动**(`anyIndexing` / `buildListParams`,P5a 已迁完,直接 import) |
| `src/ai/knowledge/util/dashboardHelpers.ts` | **全期零改动** |
| `src/ai/knowledge/stores/knowledgeStore.ts` | **只有 T3 能改,且只加 K15 的 epoch 守卫** —— 其它任务一行都不许动 |
| `.sp8/NimoOS-Service/**` | **全期零改动**(§1.1 第 1 条) |

需要改上面任何一个 → **停下写 `NEEDS_CONTEXT`**,不要自己动。

### 1.2 🔴 `KIcon` 的 19 个 glyph 已核实全在(不许往 `KIcon.vue` 里加)

设计 §2.1 声明「本期用到的 19 个 glyph 逐个 grep 确认在 `KIcon.vue` 的 `PATHS` 里」。
**T0 与独立评审各核一遍,19/19 全在**(`src/ai/knowledge/components/KIcon.vue`,`PATHS` 共 42 个键):

```
folder  x  file  spinner  sort  arrowDown  danger  layers  check  tomb
refresh  chevDown  chevLeft  chev  drive  hourglass  rocket  info  trash
```

⚠️ **其中 `tomb` 在模板里没有字面量 `name="tomb"`** —— 它只通过
`:name="statusBadgeMap[file.status].icon"`(蓝本 `IndexedFilesView.vue:193-195`)动态取到,
`statusBadgeMap.tombstoned.icon === 'tomb'`。**这和 `Indexing`(K20)是同一个动态取值坑**,
grep 字面量的脚本都扫不到它。另 18 个都是字面量。

→ **若某个任务一时找不到某个 glyph:先回头 grep 一次 `KIcon.vue`(它一定在),
不要往 `KIcon.vue` 里加新 glyph,也不要退回 `AgentIcon`(K4:六个同名图标异形)。**

## 2. 移植纪律(沿用 P5a §2,本期额外强调 3 条)

P5a §2 原文全部生效(界面/视觉/交互严格 1:1;逻辑/bug 不照抄但必须**三件套**:代码注释 + 报告申报 + 台账登记;
未申报的偏离本身就是缺陷;禁无关重构)。本期额外:

- 🔴 **「顺手把蓝本写法统一一下」是本期最大的诱惑,一律禁。** 本期蓝本里有大量**同一件事两种写法**
  (`String()` 套不套、`fmtAgo` 与 `fmtRel` 两个相似函数、`Total done` 与 `Total done:` 两个同值键、
  两条几乎一样但标点不同的 `Showing first …`)。**判据不变:这条改动是在修一个可复现的错误行为吗?
  不是 → 照 Vue2。** 统一 = 界面不 1:1 = 回归。
- 🔴 **本期唯一「用户可见文案与 Vue2 不同」的地方是 K18 的三处重试 toast**(设计 §5.3 给了完整证据链)。
  除此之外任何文案差异都是缺陷。评审别把 K18 误报成回归,也别放过 K18 之外的文案漂移。
- **brief / 计划书里标了「已核」的数据,评审仍须回权威源复核** —— 本期已核出计划书 **12 处**错(§12)。

## 3. 本期已授权的偏离(K1–K8 沿用 + **K9–K20**)

P5a §3 的 **K1–K8 与 P1–P4 全部继续生效**,不再重复。本批新增:

| # | 偏离 | 依据 |
|---|---|---|
| **K9** | 蓝本 `:1705-2022`(T6 段)与 `:2031-2039`(T2 的 S7 段)**从顶层裸选择器重新嵌套进 `.knowledge-app`** | 设计 §2.2 订正②;先例 = P5a T11 搬 `:2282-2452`。不嵌套会 ① 泄漏到全站 ② 拿不到本档 token。🔴 计划书只提了 `:1705-2022`,**`:2031-2039` 同样是顶层裸选择器**(T0 已核),也要嵌套 |
| **K10** | **丢弃 `:1675-1703` 的 confirm 死重复段** | 设计 §2.2 订正③:与 `:1398-1430` 嵌套版声明逐字等价,级联上 (0,2,0) 完胜 (0,1,0) → Vue2 里就没生效过。两份都搬会让「不许重复定义」断言当场红 |
| **K11** | `QueueView` **复用 `knowledgeStore.ts` 导出的 `fmtAgo`**,不照抄蓝本 `QueueView.vue:405-414` 的本地副本 | T0 已逐行比对两份:store 版(`knowledgeStore.ts:190-199`)多一个 `Math.max(0, …)` 钳制,负 diff 下 `m < 1` 同样成立 → 输出相同。蓝本那份是复制粘贴 |
| **K12** | **纯展示函数抽 `util/`**:`util/queueView.ts`(`distillIconState`/`basename`/`dirname`)· `util/indexedFilesView.ts`(`fmtBytes`/`fmtRel`/`fmtAbs`/`simplifyMime`/`topSegment`) | 用户 E1;先例 `util/indexedFiles.ts`、`util/dashboardHelpers.ts` |
| **K13** | **删 `selTick`/`expTick`/`doneTick` 三个计数器**,`selSet`/`expSet`/`doneSet` 直接用 `ref(new Set())`、写时整体替换 | Vue 2 侦测不到 `Set` 变更才要 tick;Vue 3 `ref` 替换即触发。等价物,同 P1 模具 |
| **K14** | **rebuild-all 400 不回显后端 `detail`**,警示条只留 `400 Bad Request` + 蓝本自带那行 i18n 解释(`aiKbRebuildCapHint`) | 用户 E5,K5 命中点 |
| **K15** | `loadIndexedFiles` / `loadAllJobs` / `loadDistillJobs` **各加 store 实例局部 epoch 过期守卫**,inline 写不抽公共 guard | 用户 E3;「New-UI 异步过期守卫」纪律**第 6 次命中**(P5a `loadRoots`@`3d8c9bc` 是第 5 次) |
| **K16** | `QueueView.vue:96` 两句硬编码英文改走 i18n 键,**两档同填英文原文** | 用户 E2:渲染与 Vue2 逐字相同(界面 1:1 成立),同时模板零硬编码文案 |
| **K17** | `.k-modal-head` / `.k-modal-title` / `.k-modal-x` / `.k-modal-body`(蓝本 `:1318-1334`)**本期不搬** | 本期两个视图都不用;留 P5c。守「没有搬多」那条断言 |
| **K18** | **failed 桶三个重试入口(`retryOne`/`bulkRetry`/`retryAllFailed`)都真发 `store.retryFailed(null)`,toast 统一 `aiKbRetriedAllFailed`(不报数)** | 用户 E6;后端证据链见 §4.3。**DOM / 按钮 / 禁用条件 / 图标 / 排版零变动** |
| **K19** | **加载错误横幅不回显 `e.message`**,改固定 i18n 串 `aiKbLoadErrorBody` | K5 一致性:同一个 `.k-banner` 里 400 分支已按 E5 不回显,load-error 分支再回显自相矛盾。P5a T7 已把 `Operation failed + e.message` 换成 `aiKbOpFailed`,同一模具 |
| **K20** | 🔴 **T0 新增**:`statusBadgeMap.indexing.en = 'Indexing'` 在 Vue2 语言包里**没有对应条目**(vue-i18n 回落显示英文原串)。本期新建 `aiKbStatusIndexing`,**两档同填 `Indexing`**,渲染与 Vue2 逐字相同 | K16 的同一个模具。蓝本 `IndexedFilesView.vue:197` 是全批唯一一处 `$t()` 传非字面量,计划书的抽取脚本扫不到 → 附录 A 整条漏掉。**本机 8 个文件里 5 个是 `indexing`,漏了页面上五行全坏**。详见附录 A §A.4。**连带看 §3.5 N14**:`statusBadgeMap.en` 一物两用,`en` 与 `key` 必须两个字段并存 |

**除 K1–K20 之外的任何偏离都要先申报再做**;拿不准写 `NEEDS_CONTEXT` 并停下。

> **弹窗纪律(P5a §3 那条「说明」预告的、本批正式生效)**:
> 🔴 **弹窗一律 reka 原语 + `DialogPortal` 的 `to` 指向知识库容器**(K7 同族,SP8 已爆三次)。
> 本期两处弹窗:`QueueView.vue:190-208`(清空失败确认)与 `IndexedFilesView.vue:356-381`(整库重建确认)。
> 测 reka Teleport 组件:挂载后先 `await nextTick()` 再查 `document`,且 portal 目标要在测试里备好。

## 3.5 明确「照抄、不改」的条目(N1–N8 沿用 + **N9–N14**)

P5a §3.5 的 **N1–N8 全部继续生效**(尤其 **N4** 无过滤刷三桶 / 有过滤只刷该桶、**N5** `d.total = rows.length`
当截断判据、**N7** `(x || [])` 兜底不许删)。本批新增:

- **N9** `onPathPrefixInput`(蓝本 `IndexedFilesView.vue:633-636`)/ `onMimePrefixInput`(`:643-646`)
  **每敲一键就整发重载,无 debounce**(T0 已逐行核:函数体只有「写 filters + `this._applyFilter()`」两行)。
  **K15 只修「先发后至覆盖」的正确性,不改触发频率。** 加 debounce = 未申报偏离。
- **N10** `.k-empty-btn`(蓝本 `IndexedFilesView.vue:139`)—— 蓝本 `knowledge.scss` 里**根本没有这个类**
  (`git grep k-empty-btn main` 只命中这一行模板)。渲染成无样式按钮,Vue2 就是这样。
  **类名照抄**,`knowledgeStyles.test.ts` 白名单**不加**它,T8 报告显式说明。
- **N11** `.k-file-detail { animation: fade-in 160ms ease }`(蓝本 `:1941`)—— 蓝本**只有 `k-fade-in`,
  没有 `fade-in`**(T0 已核:`@keyframes` 全表在 `:1511/1515/1519/1523/1527/1531/1535/1541/1542/1844/2440/2441`,
  没有裸 `fade-in`),animation-name 悬空 = 不播动画。**照抄**(改成 `k-fade-in` 会凭空多出一个 Vue2 没有的淡入 = 界面不 1:1)。
  T6 要给 `knowledgeStyles.test.ts` 的 keyframes 存在性守卫**登记这一条例外**并注明理由。
- **N12** `statusViewLocal` 的 `active` ↔ `alive` 反向映射(蓝本 `:496-501` 读、`:658-664` 写,
  自带注释「API uses 'alive' but UI shows 'active'」)。三个 UI 值 `active`/`tombstoned`/`all`,
  API 值 `alive`/`tombstoned`/`all`。**照抄两个方向。**
- **N13** 🔴 **T0 新登记**:`.k-status-badge-cn`(蓝本 `IndexedFilesView.vue:197`)—— 与 N10 完全同族,
  蓝本 scss 里**没有定义**(`git grep k-status-badge-cn main` 只命中这一行模板)。
  **类名照抄、不进白名单、不许为它凭空写规则**,T9 报告显式说明。
- **N14** 🔴 **T0 新登记**:`statusBadgeMap` 的 `en` 字段是**一物两用**,拆开搬时不许合并。
  蓝本 `IndexedFilesView.vue`:
  - **`:191`** `:title="statusBadgeMap[file.status] ? statusBadgeMap[file.status].en : file.status"`
    ← **未翻译的原始英文**(tooltip 显示 `Indexed` / `Indexing` / `Error` / `Removed`)
  - **`:197`** `{{ statusBadgeMap[file.status] ? $t(statusBadgeMap[file.status].en) : file.status }}`
    ← **翻译后的中文**(徽标文字显示「已收录」/`Indexing`/「错误」/「已删除」)

  即 **tooltip 是英文、徽标文字是中文,同一个字段两种用法**(Vue2 靠「英文原串即 i18n key」这个巧合做到)。
  New-UI 的键是 `aiKb*`,这个巧合不成立 → **`statusBadgeMap` 每个状态必须同时留两个字段**:

  ```ts
  // 蓝本 :573-580;`en` 只给 :191 的 title(原始英文,不翻译),`key` 只给 :197 的徽标文字
  const statusBadgeMap = {
    ok:         { en: 'Indexed',  key: 'aiKbStatusIndexed',  icon: 'check',   cls: 'ok' },
    indexing:   { en: 'Indexing', key: 'aiKbStatusIndexing', icon: 'spinner', cls: 'indexing' },
    error:      { en: 'Error',    key: 'aiKbStatusError',    icon: 'x',       cls: 'error' },
    tombstoned: { en: 'Removed',  key: 'aiKbStatusRemoved',  icon: 'tomb',    cls: 'tombstoned' },
  }
  ```

  🔴 **把 `en` 直接换成键名两处共用 = tooltip 变成中文或键名本身 = 界面不 1:1。**
  🔴 **计划书 T9 的 DoD 只要求断言 `data-s` + 图标名 + 中文文案三项,没有 `title`,测试抓不到。**
  → **本治理文件硬加一条:T9 必须对四个状态的 `title` 各下一条断言**,
  断言值是**英文原串**(`toBe('Indexed')` / `toBe('Indexing')` / `toBe('Error')` / `toBe('Removed')`),
  并且**至少一条反向断言**「`title` 不等于对应的中文、也不等于 `aiKb*` 键名」。
  连带:`icon` 与 `cls` 四个状态也各要断言(`cls` → `data-s`,`icon` → KIcon 的 `name`)。
  另注意 `statusBadgeMap[file.status]` 取不到时的兜底:`title` 与文字都回落成 `file.status` 原串、
  `data-s` 回落 `'ok'`、`icon` 回落 `'check'`(蓝本 `:190`/`:194`),**这个兜底分支也要有用例**。

- 另有 **Vue2 语言包自身的错译 / 同值撞车:9 行 / 7 组**(附录 A 主表里带 `⚠️N` 标记的
  #18 #24 #47 #48 #55 #84 #85 #91 #92 —— 其中 (#24, #84) 同为「向量数」、(#91, #92) 同为「累计完成」
  各算一组撞车,故 **5 个单独错译 + 2 组撞车 = 7 个独立问题**)。
  **照抄、不许统一、不许「顺手改对」**(同 P5a N8 的模具)。**每一行附录 A 里都写了理由**,评审按理由逐条判。
  (计划书 §6 A.1 脚注写「共 8 处」却列了 9 个编号,两种口径下都对不上,已订正。)

## 4. 数据契约(**2026-08-01 实测**,取代 P5a §4 里的估算)

P5a §4 的三分来源表(`/v1/ai/parser/*` 经 NimoOS-AI 反代到 Parser `:8283`、
`/v1/ai/agent/notes/*` 到 Python agent `:8282`、`/v1/wiki/*` 直达)继续生效。
**K1 单层取数继续生效**:共享包所有方法都 `return res.data`,视图/store 里**没有 `.data` 这一层**。

🔴 **所有 mock 一律取 `.superpowers/sdd/p5b-fixtures/` 里的真响应体,禁手编**
(记忆 `newui-fixture-from-imagination-trap`:裸信封 unwrap 已栽三次)。
**「同一方法在两个测试文件里被 mock 成不同形状」= red flag。**

### 4.1 Parser —— `service.ai.parser*` 的返回 = fixture 里的**原样 snake_case JSON**

T0 已读包源码确认(`NimoOS-Service/src/ai.ts:591-640`):`parserStats` / `parserFiles` / `parserJobs` /
`parserReindexFiles` / `parserRetryJobs` / `parserClearFailedJobs` / `parserDeleteJob` 七个方法**都只 `return res.data`,
零转换**。→ **fixture 文件的内容就是 mock 该写的东西,一字不改。**

```
parserStats()  → stats.json
  {"queue_depth":{"pending":338,"running":1,"failed":0,"done":9},"indexed_files":8,
   "total_vectors_text":5592,"total_vectors_visual":0,"last_cursor_ms":1784775953391,"models":[…]}
  ⚠️ 无 rate_per_min / done_last_10m / eta_s(P5a N2)

parserJobs({status,limit}) → jobs-{pending,running,failed}.json
  {"jobs":[{id,root_id,path,op,sub_modality,priority,attempts,last_error,
            locked_until,created_at,picked_at,done_at}]}
  🔴 **没有 file_id 列**(见 §4.3)。`limit` 后端约束 ge=1 le=500。

parserFiles(params) → files-*.json
  {"total","limit","offset","files":[{file_id,paths:[{root_id,path,mtime_ms}],sha256_full,
    size,mime,modalities_done,parser_version,indexed_at,tombstoned_at,vector_count,last_error,status}]}

parserReindexFiles(body) → reindex-one.http
  成功 {"queued":1,"tombstoned":1,"job_ids":[349],"skipped":[]}     ← 蓝本读 res.queued,字段确实存在
  400  {"detail":"too many file_ids (max 500)"}                     ← 实测,见 §4.4

parserRetryJobs(body) → jobs-retry-empty.http:{"retried":0}
parserClearFailedJobs() → {"cleared": n}                            ← 源码推定,未实测(C.3 不跑)
parserDeleteJob(id)     → **HTTP 204,响应体为空**;404 {"detail":"job {id} not found"};
                          409 {"detail":"cannot cancel a running job"}   ← 源码推定,未实测
```

🔴 `parserDeleteJob` 是 **204 空体**(`routes/jobs.py:42-50` 的 `status_code=204` + `return None`)。
包里是 `return res.data`(`ai.ts:637-640`),而 **axios 1.18.1 对空体的 `res.data` 给的是 `''`(空字符串)**
—— `axios.cjs:2118` 的守卫是 `if (data && utils.isString(data) && …)`,空串是 falsy → 直接跳过 JSON 解析原样返回。
→ **正确 mock:`vi.fn().mockResolvedValue('')`。** mock 成 `{}` / `{ok:true}` / `undefined` / `null`
都是把幻觉编码进断言。(蓝本 `cancelOne` / `bulkCancel` 也确实不读返回值,只 catch 异常。)

### 4.2 Distill —— `service.notes.*` **已在包里 camelCase 归一化**,与 fixture 的 snake_case **不同**

T0 已读包源码(`NimoOS-Service/src/notes.ts:186-207` 的 `normalizeDistillJobs`):

| 原始 HTTP(fixture 里的样子) | 包归一化后(**store/组件看到的、mock 该写的**) |
|---|---|
| `{"jobs":[{file_path,status,origin,attempts,last_error,enqueued_at,updated_at}],"counts":{pending,running,failed}}` | `{ jobs: [{ filePath, status, origin, attempts, lastError, enqueuedAt, updatedAt }], counts: { pending, running, failed } }` |
| `{"pending","distilled","quota_remaining","background_model"}` | `{ pending, distilled, quotaRemaining, backgroundModel }` |

→ **mock `service.notes.listDistillJobs` / `getDistillStatus` 用右列(camelCase);
mock `service.ai.parser*` 用 fixture 原文(snake_case)。搞反了就是缺陷。**
蓝本模板与 store 里读的都是 `row.filePath`(不是 `file_path`),这是对的。

`status` 取值:`pending` / `running` / `failed` / **`skipped`**(后端把 `failed` 与 `skipped` 折成一个 `failed` 桶下发,
但**行上保留原始 status** 好让 UI 分开打徽标)。`origin` 取值:`manual` / `auto`(缺省归一成 `auto`)。

⚠️ **响应里没有 `done` 也没有 `total`** —— store 的 `loadDistillJobs`(`knowledgeStore.ts:558-573`)是这样凑的:
`d.done = status.distilled`、`d.total = rows.length`。**N4 / N5,照抄别改。**

⚠️ **本机 distill 队列当前为空**(`distill-jobs.json` = `{"jobs":[],"counts":{...0}}`)→
沉淀 scope 的表格行、`Manual`/`Auto` 徽标、重试与取消按钮**真机验不了**,单测必须靠 mock。
行的字段名以上表右列为准(源自后端 SQL 的 `SELECT file_path, status, origin, attempts, last_error, enqueued_at, updated_at`,
`NimoOS-AI/agent/main.py:2790-2792`)。

### 4.3 🔴 K18 的完整证据链(T0 已逐行回源核过,三条全部成立)

1. `parse_jobs` 表**没有 `file_id` 列**(`NimoOS-Parser/parser/db.py:30-42`;
   `GET /v1/parser/jobs` 直接 `dict(row)` 下发 → fixture `jobs-pending.json` 里确实没有 `file_id`)。
2. `retry_failed_jobs()` 的 `file_ids` 是**死形参**(`NimoOS-Parser/parser/repo_jobs.py:107-121`,
   源码注释原文 `# file_ids param reserved for §B; for MVP retry all failed`):
   SQL 无条件 `UPDATE … WHERE done_at IS NOT NULL AND last_error IS NOT NULL`,**传什么都重试全部**。
3. 蓝本三个入口的真实行为:

| 蓝本调用点 | 蓝本行 | 实际发生 |
|---|---|---|
| `retryOne(row)` → `retryFailed([row.file_id \|\| row.id])` | `:312-318` | `file_id` 恒 undefined → 传 job id → 后端忽略 → **重试整桶** |
| `bulkRetry()` → `rows.filter(…).map(r => r.file_id).filter(Boolean)` | `:337-349` | **恒为空数组** → `if (fileIds.length)` 恒 false → **一个请求都不发**,却弹「已重试 {n} 条」 |
| `retryAllFailed()` → `retryFailed(null)` | `:320-328` | 唯一语义正确的一条 |

→ **K18**:三个入口都真发 `retryFailed(null)`,toast 统一 `aiKbRetriedAllFailed`。
代码里三处各留注释指明蓝本行号 + `repo_jobs.py:107-121` 的死形参。
→ 连带:`Retrying {n} failed jobs` 与 `Retried {n} selected jobs` **成为死键,不入语言包**(附录 A §A.7)。
→ 后端 §B(按 file_ids 重试)另开票,不进 P5b。

### 4.4 上限常量(T0 已回源码 + 实测 400)

| 后端常量 | 值 | 源码 | 蓝本常量 | 前端行为 |
|---|---|---|---|---|
| `MAX_REINDEX_FILE_IDS` | **500** | `service_reindex.py:26`,判据 `len(file_ids) < 1 or len(file_ids) > 500` | `EXPLICIT_REBUILD_CAP = 500`(`IndexedFilesView.vue:392`) | 前端拦(`overExplicitCap` = `selectedCount > 500`,`:485`),按钮禁用 + 动作条警告 |
| `MAX_REINDEX_BY_FILTER` | **10000** | `service_files.py:205`,判据 `n > 10000`(先 `count_*` 再 400,不物化行) | `FILTER_REBUILD_CAP = 10000`(`:393`) | 前端**只警告不拦**,真拦在后端 → 400 走 **K14** |

**400 响应体形状**:
- `file_ids` 超限 —— **已实测**(`reindex-cap-400.http`):`HTTP/1.1 400` + `{"detail":"too many file_ids (max 500)"}`。
  ⚠️ 后端把「空数组」和「>500」用了**同一条消息**(`len < 1` 也走这个分支)。
- filter 超限 —— **未实测,源码推定**(本机只有 8 个文件,触发不了):
  `{"detail":"filter matches {n} files (> 10000); narrow it or raise max_reindex_by_filter"}`。

🔴 **K14 的落地判据**:400 分支渲染出来的 DOM **必须不包含**上面这两串后端 `detail` 文本。
T10 要写一条 `expect(html).not.toContain('too many file_ids')` 这类**排除式**断言。

### 4.5 本机数据现状(写进验收清单当**预期行为**,不是缺陷)

T0 实测(`files-all-8.json` / `stats.json`):

| 事实 | 影响 |
|---|---|
| 已收录文件共 **8** 个;`limit` 默认远大于 8 → **分页恒 `1 / 1`** | 「上一步 / 下一张」的**禁用态**可验,翻页本身验不了 |
| 状态分布:**`indexing` 5 个 / `ok` 3 个 / `error` 0 / `tombstoned` 0** | 🔴 计划书 §10 A-1 与设计 §7.3 写的「1 行 indexing」**是错的**(见 §12 E-8)。`error` 与 `tombstoned` 两种徽标、`errhint`、`zerohint`、tombstoned 行禁选 **真机全验不了**,只能靠 mock |
| `vector_count === 0` 的行:只有那 1 个 `application/octet-stream` 的 | `zerohint` 需要 `status==='ok' && vector_count===0` 两个条件同时成立 → **本机没有这种行**,只能 mock |
| 队列 `pending 338 / running 1 / failed 0 / done 9` | pending 桶的「仅展示前 200 条」截断提示可真验(338 ≥ 200 ✅);failed 桶未造数据前「重试所有失败的 / 清空失败记录」**恒禁用是正确行为** |
| distill 队列全空,`quota_remaining: 50` | 沉淀 scope 只能 mock 验 |
| Wiki 相关**零验收项**(D1);`DashboardView` 60 秒骨架照旧(N3) | |

## 5. 代码范式(P5a §5 全部沿用,补本期的相对路径表)

- `<script setup lang="ts">`;`useI18n()` from `'vue-i18n'`;后端一律 `import { service } from '@nimotech/nimoos-service'`。
- **import 一律相对路径**(本仓无 `@/` 别名先例)。本期新增文件的落点与相对路径:

```
src/ai/knowledge/
  views/       QueueView.vue(T5)· IndexedFilesView.vue(T8/T9/T10)
  util/        queueView.ts(T4)· indexedFilesView.ts(T7)
  stores/      knowledgeStore.ts(只有 T3 能改,且只加守卫)
```

| 从 | 到 | 写法 |
|---|---|---|
| `views/*.vue` | 本期 util | `import { fmtBytes } from '../util/indexedFilesView'` |
| `views/*.vue` | P5a 既有 util | `import { anyIndexing, buildListParams } from '../util/indexedFiles'` |
| `views/*.vue` | store(含 `fmtAgo` / `DISTILL_JOBS_LIMIT`) | `import { useKnowledgeStore, fmtAgo, DISTILL_JOBS_LIMIT } from '../stores/knowledgeStore'` |
| `views/*.vue` | 图标 | `import KIcon from '../components/KIcon.vue'` |
| `views/*.vue` | 全局 toast | `import { useToast } from '../../../stores/toast'` |
| `util/*.ts` | i18n(**只有 `fmtRel` 需要**) | `import i18n from '…'` 后 `i18n.global.t(...)` —— **照 `stores/knowledgeStore.ts:190-199` 的 `fmtAgo` 既有写法逐字复用**,别自己发明 |
| 任何位置 | service 包 | `import { service } from '@nimotech/nimoos-service'`(包名导入,非相对路径) |

- 全局 toast 真实签名(`src/stores/toast.ts:21`):
  `show(text: string, duration = 1500, tier: 'info'|'warning'|'danger' = 'info')`。
  K3/P4 的 2400ms 须**显式传** `useToast().show(msg, 2400)`(store 的 `toast()` action 已经这么做了,直接调它)。
- **用到的每一个 CSS 类都要先 `grep` 确认真实存在**(白名单见附录 D)。目标:组件里**零 `<style>` 块**。
- 页面级瞬态(展开行、选中集、确认弹窗开关)一律组件本地 `ref`,不塞 store;
  **例外:`filters` 仍在 store 里**(`indexedFiles.filters`,蓝本如此,P5a 治理文件 §5 已定「照抄」)—— 组件直接写
  `store.indexedFiles.filters.xxx`。
- **路由反转的写法**(T5 与 T10 各一次):`knowledgeRoutes.ts` 里把对应子路由的 `component` 换掉,
  `deferred.ts` 的 `DEFERRED_TABS` 摘掉对应 id。
  🔴 `knowledgeRoutes.test.ts` 里那条「其余子路由仍是 `KnowledgeDeferred`」的断言 **反转,不删**
  ——把改前原文留成注释、写清为什么反转(承 P5a R8 与 T12 的既有先例,那个文件 `:26-63` 就是模板,照它抄)。

## 6. 配色(P5a §6 全部沿用,本期新增 4 个 token)

P5a §6 每一条继续生效,尤其:

- 一切可见颜色必须是 `var(--…)`,**禁 `#hex` / `rgb()` / `rgba()` / 具名色**(`white`/`black` 也算)。
  `transparent` 是关键字不是配色,照抄不算违规(P5a T11 评审已按此口径放行 3 处)。
- **token 声明层豁免**:只有 `.knowledge-app { --… }`(暗档)与 `:root[data-theme="light"] .knowledge-app { --… }`(浅档)
  两个块内允许字面量,**块外全文零字面量,注释里也不许有**(R5,改「蓝本行号 + 中文描述」)。
- ⚠️ **`color-guard.test.ts` 不扫 `.scss`** → `knowledge.scss` 除声明层外**只有 `knowledgeStyles.test.ts` +
  人肉评审两道防线**。T2/T6 的评审必须**逐行**扫这个文件。
- 禁 `theme-exception` 逃逸。
- **落笔前 grep 重名**:新类名与 `agent-styles.scss` / `settings-styles.scss` / `skills-styles.scss` / `sk-shared.scss`
  零重名(嵌套作用域串号单测与 color-guard 都抓不到,只能人肉)。

### 6.1 🔴 F1 —— 计划书里的 `T4 / T10 / T11 / T12` 全是 **P5a** 的任务号

计划书附录 B 与 §2 里凡出现「T4 已做」「承 T11 先例」「照 T10/T12 先例」,指的都是 **P5a 的任务编号**,
**不是本期的 T4 / T10**。一律读作:**「P5a 已经做过,现状就在 `src/ai/styles/knowledge.scss` 里,本期不要重复改。」**

**唯一落地判据(硬规则):下笔前 `grep` 现状文件,已存在即不动。**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
grep -n "text-on-accent\|accent-soft-2" src/ai/styles/knowledge.scss
grep -nE "^\s*--(danger-hover|purple-soft|success-soft-border|danger-soft-faint):" src/ai/styles/knowledge.scss
```

T0 已代跑一次:`.k-btn` 基类连 `&.ghost` / `&.outline` / `&.primary` / `&:disabled` **都已在**现状文件里
(`--text-on-accent`、`--accent-soft-2` 已到位)→ **T2 只在既有 `.k-btn { … }` 块内、
`&.primary` 与 `&:disabled` 之间插入 `&.danger`,不要重写整块。**

### 6.2 🔴 F2 勘误 + 4 个新 token 的归属表(**权威**)

计划书 §2 T2 第 4 条写「本段用到 `--success-soft-border` / `--purple-soft` / `--danger-hover`,
`--danger-soft-faint` 留 T6」。**T0 按附录 B.2/B.3 逐行核过,这句枚举把两个 token 的归属写反了**:
`--purple-soft` 在 T2 段**一处都没有**(只在 T6 段 `:1894`);`--danger-soft-faint` 在 T2 段 `:1417` 就已用到。

**裁定:「只声明真正用到的」是硬规则;附录 B 的逐行映射表是权威;T2 第 4 条那句枚举是笔误。**

| token | 在哪个任务声明 | 暗档值(基础块) | 浅档值(`:root[data-theme="light"] .knowledge-app`) | 被哪几行用到 | 值的出处 |
|---|---|---|---|---|---|
| `--success-soft-border` | **T2** | `rgba(79, 184, 112, 0.28)` | `rgba(46, 158, 84, 0.2)` | 蓝本 `:2038` | `src/ai/styles/tokens.scss:307` / `:130` |
| `--danger-hover` | **T2** | `#E35F52` | `#A83226` | 蓝本 `:846` | **全仓无源,本期新造**(设计 §6.2 给定,**禁止重算**) |
| `--danger-soft-faint` | **T2** | `rgba(240, 119, 107, 0.1)` | `rgba(215, 73, 59, 0.06)` | 蓝本 `:1417`(T2)**与** `:1972`(T6) | `src/ai/styles/tokens.scss:314` / `:145` |
| `--purple-soft` | **T6** | `rgba(175, 82, 222, 0.18)` | `rgba(175, 82, 222, 0.1)` | 蓝本 `:1894` | `src/ai/styles/tokens.scss:310` / `:133` |

上面 6 个 `tokens.scss` 行号 T0 已逐行打开核过,值逐字相同。
注意 **`tokens.scss` 的正确路径是 `src/ai/styles/tokens.scss`**(不是 `src/styles/tokens.scss`),
且**该文件的两个块与 `.knowledge-app` 的档次相反**(T0 已核选择器与闭合大括号):
**浅色块 = `.agent-app, .ai-toast-scope { … }` = `:31-247`**;
**暗色块 = `.agent-app[data-theme="dark"], .ai-toast-scope[data-theme="dark"] { … }` = `:249-365`**。
→ `:130`/`:133`/`:145` 在浅色块、`:307`/`:310`/`:314`(与 `:282`)在暗色块,与上表方向一致。

**`--danger-hover` 的两个值不许重算。** 设计 §6.2 的派生描述(「亮度 −9%」)T0 实测**复算不出**给定的十六进制;
**以设计给出的十六进制为准**,规则描述只是说明性文字。

**除这 4 个之外不许新造 token。** 附录 B(§B.0 + §B.2 + §B.3)覆盖了**全部 42 处**色字面量
(scss 39 + 模板内联 3),**表里没有的一律 `NEEDS_CONTEXT`**
(承 P5a T11 R9 教训:自行发明 `color-mix` 蒙版比例本该先问)。

### 6.3 两处 `[data-theme="dark"]` 并档(K2)

蓝本 `:1862`(`.k-status-badge[data-s="ok"]` 的 `color`)与 `:1895`(`.k-type-tag[data-kind="md"]` 的 `background`)
在 Vue2 与 New-UI **都永不命中**(New-UI `<html>` 只可能无属性或 `data-theme="light"`,从不置 `"dark"`)。
**两条选择器整条删除**,让基础块直接取 `var(--success)` / `var(--bg-chip)`,天然分档。
代码注释里注明「蓝本 `file:line` 的 `[data-theme="dark"]` 两边都不命中,按 K2 并进两档」,
**注释里不许写出被删的色字面量**。详见附录 B §B.4。

### 6.4 `knowledgeStyles.test.ts` 的扩法(T2 / T6)

- 白名单 **102 → 134(T2)→ 187(T6)**(不是计划书说的 101/133/186,见附录 D §D.0)。
  常量名跟着数字改(`WHITELIST_102` → `WHITELIST_134` → `WHITELIST_187`)。
- 🔴 **T2 必须把「没有搬多」的扫描正则从 `/\.k2?-[a-z0-9-]+/g` 扩成覆盖 `kn-` 的形式**
  (如 `/\.k(?:2|n)?-[a-z0-9-]+/g`)—— 现有正则**扫不到 `.kn-badge`**,而蓝本 `:2023-2281` 还有几十个
  `.kn-*` 是 P5d 的,多搬了没人抓。**扩正则 = 扫描范围变大,不是放宽断言**;要配 RED 探针。
- R2 的 `*-soft` token 两档断言数组扩到本段新声明的那几个。
- 浅色档 token **集合式**覆盖断言(P5a 终审 ⑦ 的写法)自动覆盖新 token;**例外清单不许扩**。
- `var()` 闭环守卫自动覆盖;若报「两档都找不到」说明漏声明,**停下查,不要放宽**。
- keyframes 存在性守卫:T6 新增 `@keyframes row-done`(放文件末尾全局区,照现状 `:814-815` 的先例);
  **`k-pulse` 已存在,不要重复定义**;**N11 的悬空 `fade-in` 要登记成例外**,并做一次反向确认
  ——「删掉 `k-fade-in` 仍要报红」(证明例外没把整条守卫捅穿)。
- **扩,不是删断言、不是放宽正则。**

## 7. i18n

- 新键前缀 **`aiKb*`**;T0 已核**本期 100 个新键与现有 96 个 `aiKb*` 零重名**(重复属性 = TS 错误)。
- 值表见 `.superpowers/sdd/p5b-appendix-A-i18n.md`(**100 条新增 + 9 条复用**)。
  **逐字照抄,不许自行翻译、不许改标点。**
- 新键**同时**加进 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`(`parity.test.ts` 自动断言键集一致,无需改它)。
- 🔴 **必须跑程序化逐码点比对脚本**(P5a T8 教训:附录表本身零差异,手抄进 TS 时引入了 **5 处全角标点错**)。
  脚本读 `git show main:src/assets/lang/zh_CN.json` 与新写的 `zh_cn.ts`,对 **95 条有 Vue2 源的键**
  逐 `codePointAt` 比对,输出 `MATCH/MISMATCH` 逐条,DoD 是 **95/95 MATCH**。
- `messageSyntax.test.ts` 的两条守卫**只圈本批 100 键**,🔴 **不许全量生效**
  (既有 `aiResTurn` / `aiResFilesInTurns` 的两档占位符不一致是有意设计,`{s}` 是英文复数后缀):
  - (a) 全角标点扫描 `/[，；：？！（）]/`,**例外清单见附录 A §A.5(15 条,不是计划书的 11 条)**,
    例外一律写成 `toBe` 钉死确切值的**强断言**,不是「跳过扫描」的松形式。
  - (b) 本批带占位符的键(附录 A §A.6,20 条),两档占位符名称集合一致(T0 已核零差异)。
  - (c) 补一条「exactly **100** keys」防漂移(照 P3b/P5a 同款)。
- 判定为死键、**不入语言包**的 2 条见附录 A §A.7,T1 报告要显式说明为什么不落。
- 报告里列清「复用 9 / 新增 100 / 其中 Vue2 有权威 zh 值 95 + 本期新造 4 + T0 追加 1 / 判定死键不落 2」。

## 8. 测试门(每个任务提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5b-tN-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5b-tN-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5b-tN-build.log 2>&1; echo "exit=$?"
```

- **全量,不许只跑 `src/ai/` 子集**(守卫散落在 `src/styles/color-guard.test.ts` 与
  `src/i18n/{parity,messageSyntax}.test.ts`,只有全量能抓)。
- **输出完整落盘,不许 `| tail`**(P2b 教训:一条红被 `tail -6` 截掉,失败用例名永久丢失)。
  报告里贴 `Test Files` / `Tests` 两行汇总 + 任何红项的**完整用例名**。
- 🔴 **起点基线(协调者与 T0 各测一次,一致)**:`sp8-ai`@`d8efb0e` = **313 文件 / 2872 例全绿**,
  `vue-tsc` exit 0,`vite build` exit 0。**每个任务以协调者给的实测基线为准,不要用计划书 §5 的预测数。**
- **算术**:`color-guard.test.ts` 按 `**/*.vue` 动态生成用例 → **每新增一个 `.vue` 全量 +1 例**。
  本批新增 **2 个 `.vue`**(T5 `QueueView.vue`、T8 `IndexedFilesView.vue`)→ color-guard **+2 例**。
  本批新增 **5 个测试文件**(T3/T4/T5/T7/T8 各一;T9/T10 只扩 T8 那份)→ **收官 318 文件**。
- **本期 Service 仓零改动** → **不需要** `cd ../NimoOS-Service && pnpm build`,**也不需要** `pnpm install`
  (P5a §8 那条只对动了包的批次生效)。
- 已知噪声(只它们红就复跑一次并说明,不要顺手去改):
  `src/files/upload/persist.test.ts > dropPersisted removes record + blob and frees budget`(既有 IndexedDB flaky)·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- `pnpm build` 只允许既有第三方包警告 + >500KB chunk 警告。
- T2 / T6 额外:`pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null` exit 0
  (T0 已确认 `sass` 1.101.6 可用)。
- T6 额外:`pnpm build` 后 `grep k-frow-f dist/assets/*.css` 命中(证明真进了构建管线)。

## 9. 测试质量(P5a §9 全部沿用,本期额外 4 条)

P5a §9 每一条继续生效(禁空转用例;无判别力的断言要做 RED 验证并贴两段输出;
「A 与 B 二选一」两边都要有对照用例;mock 骨架用 `vi.hoisted()`;异步断言用 `flushPromises()`;
不许削弱或删除既有断言)。本期额外:

- 🔴 **「在文件里找某段文本」的判据必须整行/行首锚定 + 先排除注释** —— P5a 六次同族事故,
  全部只有 RED 探针能发现(`\b` 在 `-` 前也成立、`indexOf` 被头注释撞对、剥注释时机、import 撞对…)。
- 🔴 **属性态断言一律直接比字符串值,两侧都比**:`expect(el.attributes('data-x')).toBe('true')` /
  `.toBe('false')`,**不许写 `toBeUndefined()`**(Vue 3 的 `patchAttr` 对 `data-*` 只在 `null`/`undefined` 时删属性,
  `false` 会渲染成 `"false"` —— 源码 `@vue/runtime-dom@3.5.39 runtime-dom.cjs.js:560-577`)。
  详见附录 D §D.3.1。
- 🔴 **每个档位/阈值两侧都要有边界断言**:`fmtBytes`(1023/1024、10239/10240、10485759/10485760、
  1073741823/1073741824)· `fmtRel`(44/45 秒、59/60 分、23/24 时、29/30 天)· 两个上限(500/501、10000/10001)。
  承 P5a T6 教训:`fmtAgo` 的 `h < 24` 改成 `h < 48` 曾 **16/16 全绿**。
- **测试脚手架**:需要真 router 的用例(`$route.query` + `$router.replace`)**照 `KnowledgeLayout.test.ts`
  的既有写法**,别自己造 —— P5a T10 的 `makeRouter` 曾自递归致 DOM/生命周期翻倍,
  且缺 `@nimotech/nimoos-service` mock 会让 `onMounted` 真发请求。
- 🔴 **T5 必须补一条「模板 `<template>` 块零裸色」的定向断言**(堵守卫缺口③,写法与 RED 探针要求见
  附录 B §B.0.4)。T8 建议照抄同一条。**读源文件一律 `node:fs`,不许用 Vite 的 `?raw`**
  (vitest 的 CSSEnablerPlugin 会把样式源整体替换成空串 → 断言对空字符串「假通过」;
  先例见 `knowledgeStyles.test.ts` 头注释 ③)。
- 🔴 **本期三个已登记的守卫缺口,各有指定的堵法,不许当「不可测」放过**:

  | # | 缺口 | 谁堵 | 怎么堵 |
  |---|---|---|---|
  | ① | `knowledgeStyles.test.ts:95` 的 `/\.k2?-[a-z0-9-]+/g` **扫不到 `.kn-` 前缀** | **T2** | 扩成 `/\.k(?:2\|n)?-[a-z0-9-]+/g` + RED 探针(附录 B §B.5) |
  | ② | `color-guard.test.ts` **不扫 `.scss`**(P3a RED 探针实证) | 无法修 | 靠 `knowledgeStyles.test.ts` + **T2/T6 评审逐行人肉色扫**两道防线 |
  | ③ | `color-guard.test.ts:44-56` 的 `styleLines()` 对 `.vue` **只取 `<style>` 块 → 模板 `style="…"` 属性零扫描** | **T5** | 新增 `<template>` 块零裸色断言 + RED 探针(附录 B §B.0.4) |

## 10. 报告契约(实现者)

完整报告写进 `.superpowers/sdd/p5b-task-N-report.md`(**`git add -f`**),至少包含:

逐文件改了什么 · Vue2 `file:line` → New-UI 的对照 · 承接了 Vue2 哪些行为 ·
RED→GREEN 证据(含 RED 探针的两段输出与还原确认,`git status` 必须干净)·
三门完整终值(含红项完整用例名与归属)· i18n 复用/新增键清单 ·
**§3 的 K1–K20 里本任务命中的每一条显式申报** ·
**§3.5 的 N1–N14 里本任务命中的,要说明确实照抄了** ·
**用了哪几个 fixture 文件、mock 形状取自哪一份**(snake_case 还是 camelCase,见 §4.2)。

返回给协调者的只有 **≤15 行**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
提交 sha · 一行测试结果 · 顾虑。

## 11. 评审者附加要求(P5a §11 全部沿用,本期额外 5 条)

P5a §11 每一条继续生效(**最低 sonnet、禁 haiku**;不许采信实现者报告;自己打开蓝本逐项对标记/类名/顺序/
禁用条件;i18n 值逐字符复核;用到的每个 CSS 类自己 grep;至少做一次独立 RED 验证并还原;
检查空转/削弱/提交范围;**不许改仓库、不许提交任何东西**;评审全文写 `.superpowers/sdd/p5b-task-N-review.md`,
返回 ≤25 行)。本期额外:

1. 🔴 **两个 scss 任务(T2 / T6)的评审必须逐行色扫**(`color-guard` 不扫 `.scss`),
   并**自做 RED 探针**(至少:规则段落塞字面量 → 报红;删一个新类的规则 → 报红;
   删浅色档一个新 token → 集合式断言指名报红)。
2. 🔴 **专查 §3.5 的 N1–N14 有没有被「顺手修正」** —— 改了就是回归,按 Critical 报。
   本期最容易被误修的:N9(加 debounce)、N10/N13(给未定义类补样式)、N11(把 `fade-in` 改成 `k-fade-in`)、
   **N14(把 `statusBadgeMap.en` 换成键名两处共用 → tooltip 变中文)**、
   `⚠️N` 的**错译 9 行 / 7 组**(「类型 / 下一步 / 上一张 / 恢复 / 已启用」+ 两组同值撞车,
   逐行理由见附录 A 主表)、两条 `Showing first …` 的**半角/全角分号**差异。
3. 🔴 **K18 的三处 toast 与 Vue2 不同是有意的**(§4.3 有完整证据链),别误报成回归;
   但要核「按钮 / 禁用条件 / 图标 / 排版**零变动**」这半句是否真做到。
4. 🔴 **核 mock 形状的层次**:`service.ai.parser*` 用 snake_case(= fixture 原文),
   `service.notes.*` 用 camelCase(包内已归一化)。搞反了按 Critical 报。
   **「同一方法在两个测试文件里被 mock 成不同形状」= red flag**。
5. **计划书已被证明有 12 处错(§12,E-1 ~ E-12)** —— 评审看到任何与本文件/附录不符的数字,
   先信本文件与附录,再自己回权威源核一次;核出第 13 处就登记进 §12。

---

## 12. 计划书勘误(T0 回源核出,**下游一律以本节为准**)

计划书 = `NimoOS-UI/docs/superpowers/plans/2026-08-01-vue3-migration-sp8-p5b-indexops.md`。
下面每一条都给了「计划书原文 / 权威源实际 / 处置」。**结构性结论:行号引用几乎全对(T0 逐个打开核过,
只有 1 处偏 1 行),错的集中在「数量统计」「分类判断」与「漏项」上。**
**共 12 条:E-1 ~ E-10(T0 首轮)+ E-11 / E-12(修复轮 1,独立 opus 评审指出,见 §12.2)。**

| # | 计划书原文 | 权威源实际(T0 实测) | 处置 |
|---|---|---|---|
| **E-1** | §6 A.1 里 6 条标 `**Vue2 无 →**`,zh 值由计划书自拟;设计 §6.3 也写「新建 · Vue2 语言包没有 **6**」 | `git show main:src/assets/lang/zh_CN.json` 里 **6 条全都有**;其中 3 条自拟值与语言包不同:`No failed distillation jobs.` → **没有沉淀失败的任务。**(计划书写「没有失败的沉淀任务。」)· `Showing first {n} — …` → **仅展示前 {n} 条;缩小筛选范围可查看其余记录。**(计划书写「…条；缩小筛选范围可看到其余。」,且**分号是半角 `;`(U+003B) 不是全角**)· `This job can no longer be cancelled.` → **该任务已无法取消。**(计划书写「这个任务已经不能取消了。」) | 附录 A 主表**一律用语言包实际值**;分类改成「95 条全部有 Vue2 权威源」;对照表见附录 A §A.3 |
| **E-2** | 附录 A 共 99 条新增 | 🔴 **漏了 1 条 → 应为 100 条**。蓝本 `IndexedFilesView.vue:197` 是全批唯一一处 `$t()` 传非字面量(`$t(statusBadgeMap[file.status].en)`),`statusBadgeMap.indexing.en = 'Indexing'`;`Indexing` 既不在计划书附录 A、也不在 Vue2 语言包里 | 新增 **K20** + `aiKbStatusIndexing`(两档同填 `Indexing`,与 K16 同模具)。**「exactly N keys」防漂移断言用 100**。详见附录 A §A.4。⚠️ **本机 8 个文件里 5 个是 `indexing`,漏了页面上五行全坏** |
| **E-3** | §2 T1 第 4(a) 条给了 11 条全角标点例外 | 用正则 `/[，；：？！（）]/` 对最终 100 个 zh 值实扫 = **15 条**。计划书那份有 **1 条假阳性**(`aiKbClearFailedConfirmBody` 只含 `。`,不在正则里)+ **5 条漏**(`aiKbOverExplicitCap` / `aiKbPollTip` / `aiKbRebuildCapHint` / `aiKbTombstonedTip` / `aiKbLoadErrorBody`,都含 `，`);另有 3 条理由写错(`aiKbNoMatchSub` 命中的是 `，` 不是「全角引号」,`「」` 不在正则里;`aiKbRebuildAllBody1/2` 命中的是 `，` 不是「全角句号」) | 附录 A §A.5 给了实扫出来的 15 条完整表。照计划书那份写守卫会当场红 5 条 |
| **E-4** | §7 「色值映射表(**40 处**)」· B.2「T2 段,**18 处**」· B.3 / §2 T6「**22 处**」 | 独立重扫:**T2 段 19 行 / 22 处字面量;T6 段 13 行 / 17 处;合计 32 行 / 39 处**。看起来 18 与 22 被写反了 | 附录 B §B.6 给了订正表。**行号一条都没错、映射一条都没错**,只有处数统计错 |
| **E-5** | §2 T2 第 4 条:「本段用到 `--success-soft-border` / `--purple-soft` / `--danger-hover`,`--danger-soft-faint` 留 T6」 | 与附录 B.2/B.3 的逐行表**自相矛盾**:`--purple-soft` 只在 B.3(T6 段 `:1894`),`--danger-soft-faint` 在 B.2(T2 段 `:1417`)就已用到、T6 `:1972` 再用一次 | **F2 裁定**:逐行映射表是权威,那句枚举是笔误。归属表见 §6.2 / 附录 B §B.1。T2 声明 3 个(`--success-soft-border` / `--danger-hover` / `--danger-soft-faint`),T6 声明 1 个(`--purple-soft`) |
| **E-6** | §8 「白名单 **101** → **186**」· T2「→ **133** 类」 | `knowledgeStyles.test.ts:41` 的常量就叫 `WHITELIST_102`,数组实测 **102** 项(P5a T11 已把 103 订正成 102) | **102 → 134(T2)→ 187(T6)**。附录 D §D.0 |
| **E-7** | §8 D.4 只登记 1 个「蓝本自身的未定义类」(`.k-empty-btn`) | 用「模板抽类 ∖ (白名单 ∪ D.1 ∪ D.2)」差集扫出**第 2 个**:`.k-status-badge-cn`(`IndexedFilesView.vue:197`),`git grep` 确认蓝本 scss 里同样没有定义 | 新增 **N13**,与 N10 同处理(类名照抄 / 不进白名单 / 不许补样式)。附录 D §D.4 |
| **E-8** | §10 验收 A-1「共 8 个文件,其中 **1 行 `indexing`**」;设计 §7.3-3 同 | 实测(`p5b-fixtures/files-all-8.json`):**`indexing` 5 个 / `ok` 3 个 / `error` 0 / `tombstoned` 0** | 验收清单改 5 行 indexing;并登记「`error` / `tombstoned` 徽标、`errhint`、`zerohint`、tombstoned 禁选**真机全验不了**」。见 §4.5 |
| **E-9** | §8 D.3 脚注「🔴 所有布尔属性在模板里**必须套 `String()`**…P5a T12 在 `.k2-cc` 上栽过」 | 蓝本 `QueueView.vue` 7 处套了 `String()`、`IndexedFilesView.vue` **5 处没套**(`:174` `:176` `:231` `:253` `:323`)。且读 Vue 3 源码(`@vue/runtime-dom@3.5.39` `patchAttr`)确认:`data-*` 非特殊布尔属性 → `false` **照样渲染成 `"false"`**,套不套**渲染完全一致**。P5a `.k2-cc` 那次的真实教训是**属性名错**(附录写 `[data-active]`,蓝本是 `[data-on]`),不是 `String()` | **裁定:逐处照抄蓝本**(改写 = 与需求无关的顺手改动,禁)。断言口径统一 `toBe('true')` / `toBe('false')`,禁 `toBeUndefined()`。逐处表 + 源码依据见附录 D §D.3 / §D.3.1 |
| **E-10** | §2 T2 第 1 条「只在它内部补 `&.danger`(蓝本 `:844-848`)」 | `&.danger {` 在 **`:843`**,闭合 `}` 在 **`:847`**;`:848` 已经是 `&:disabled {` | 正确范围是 **`:843-847`**。偏 1 行,不影响搬运内容(内部三行 `:844`/`:845`/`:846` 引用无误),但按 pathspec 复制会多带一行 |

### 12.2 修复轮 1 追加的两条(独立 opus 评审 2026-08-01 指出,T0 已回源核实)

| # | 计划书原文 | 权威源实际(T0 复核) | 处置 |
|---|---|---|---|
| **E-11** | §7 附录 B 只统计 `.scss` 里的色字面量,自称「覆盖了全部 40 处,表里没有的一律 `NEEDS_CONTEXT`」 | 🔴 蓝本模板 `style="…"` 属性里还有 **3 处**(`QueueView.vue:87` failed 桶空态的专属渐变:`rgba(255,255,255,0.5)` / `rgba(52,199,89,0.2)` / `rgba(0,122,255,0.2)`),附录 B 一条都没收 → T5 只有「停下来问」或「就地硬编码」两条路,而且**现有守卫一条都抓不到**(`color-guard` 的 `styleLines()` 对 `.vue` 只取 `<style>` 块)。T0 已把两个模板的全部 `style=` / `:style=` / `color=` 逐行复扫:**只有这一处**,`IndexedFilesView.vue` 零处 | 新开 **附录 B §B.0**:三处映射(照 P5a 同一个类 `.k-empty-illust` 的既有 `color-mix` 先例派生)· **落地位置裁定 = 留在模板 `style=` 里照抄蓝本结构**(挪进 scss 必然要造蓝本没有的类)· 暗档色相偏移的取舍显式登记 · **守卫缺口③** + T5 的定向断言与 RED 探针。总数 **39 → 42 处** |
| **E-12** | §2 T9 的 DoD 只要求「四个状态徽标各一条用例,断言 `data-s` + 图标名 + 中文文案三项」 | 🔴 漏了 `title`。蓝本 `IndexedFilesView.vue:191` 的 `:title` 用的是 `statusBadgeMap[…].en` 的**原始英文**、`:197` 的徽标文字用的是 `$t(同一个 en)` 的**中文** —— 同一字段两种用法(Vue2 靠「英文原串即 i18n key」的巧合)。New-UI 键名是 `aiKb*`,巧合不成立;若把 `en` 换成键名两处共用 → **tooltip 变中文或键名本身 = 界面不 1:1,而 DoD 里没有 `title` 断言、测试抓不到** | 新开 **N14**(§3.5):`statusBadgeMap` 每状态同时留 `en`(只给 `title`)与 `key`(只给徽标文字),给出完整代码骨架;并**硬加要求**:T9 对四个状态的 `title` 各一条断言(值是英文原串)+ 至少一条反向断言(≠中文、≠键名)+ 取不到时的兜底分支用例 |

> 另外修复轮修掉的 5 条 Minor(不单独编号):`⚠️N` 口径统一成「**9 行 / 7 组**」并给 3 行补全理由 ·
> 附录 D §D.6 的行号改精确(`> *:nth-child(6) { display: revert; }` 在 **`:1498` 单行**,
> 注释是 **`:1488-1494` 共 7 行**)· 报告 §2.5 的基线证据改引协调者实测 ·
> §4.1 补上 `parserDeleteJob` 该 mock 成什么(**`''`**)· `tokens.scss` 两个块的范围改对
> (浅 **`:31-247`** / 暗 **`:249-365`**)。

### 12.1 附带订正(不是计划书的错,是 brief / 环境的坑,一并登记)

- **蓝本路径**:任务 brief 写 `src/pages/AI/knowledge/…` 与 `src/pages/AI/styles/knowledge.scss`,
  **实际是 `src/views/AI/Knowledge/…` 与 `src/views/AI/Knowledge/styles/knowledge.scss`**(见 §1.2)。
- **两档色板路径**:brief 写「暗档 `src/styles/tokens.scss`」,**实际是 `src/ai/styles/tokens.scss`**;
  `src/styles/` 下只有 `theme.css` 与 `color-guard.test.ts`。
- **`tokens.scss` 的档次是反的**,且块范围比 T0 初稿写的更宽:**浅色块 `:31-247`
  (`.agent-app, .ai-toast-scope`)/ 暗色块 `:249-365`(`…[data-theme="dark"]`)**。
  所引 7 个行号都落在正确档内,结论不受影响。
- **设计 §6.3 的「去重 `$t()` 字符串 106」** 少算 1:T0 实测两个蓝本里 `$t('字面量')` distinct = **105**,
  加上只在 script 里的 `i18n.t('{n} months ago')` 与动态展开的 `Indexing`,**distinct 合计 107**
  (= 9 复用 + 95 主表 + 2 死键 + 1 `Indexing`)。
- **蓝本死规则(不搬)**:`:1500-1503` 的 `@media` 里 `.k-frow { … }` —— 两个模板里**没有任何元素用
  `class="k-frow"`**(文件表格行用 `.k-frow-f`)。既不在 D.1 也不在 D.2,不搬,**也不要"顺手改成 `.k-frow-f`"**。
  见附录 D §D.5。
- **`retry_failed_jobs` 的空数组分支**:后端把 `len(file_ids) < 1` 与 `> 500` 用了**同一条 400 消息**
  (`service_reindex.py:46-49`),不是两种错误。见 §4.4。
