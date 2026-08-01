# P5b · T0 报告 —— 治理文件、三份附录、fixture 抓取

- 日期:2026-08-01
- 起点:New-UI `sp8-ai`@`d8efb0e`(工作树干净,`git log -1` 已核)
- 蓝本:`NimoOS-UI` `main`@`7a6ee6b7`,全程 `git show main:`,**在那个仓里零改动零提交**

---

## 1. 产出清单

| 文件 | 行数 | 内容 |
|---|---|---|
| `.superpowers/sdd/p5b-common-constraints.md` | 471 | 12 节骨架(13 个 `^## `,含 §3.5),只写与 `p5a-common-constraints.md` 的差异 |
| `.superpowers/sdd/p5b-appendix-A-i18n.md` | 266 | i18n 键表:A.0 复用 9 / A.1 主表 95 / A.2 新造 4 / A.3 订正对照 / A.4 T0 追加 1 / A.5 全角例外 15 / A.6 占位符 20 / A.7 死键 2 / A.8 计数自检 |
| `.superpowers/sdd/p5b-appendix-B-tokens.md` | — | F1/F2 硬规则 · 4 个新 token 归属表 · B.2(T2,19 行/22 处)· B.3(T6,13 行/17 处)· B.4 两处并档 · B.5 守卫正则缺口 · B.6 计数订正 · B.7 自检命令 |
| `.superpowers/sdd/p5b-appendix-D-classes.md` | — | D.0 计数订正(102→134→187)· D.1 32 类 · D.2 53 类 · D.3 属性态逐处表(含 `String()` 列)· D.3.1 Vue3 `patchAttr` 源码依据 · D.4 未定义类 2 个 · D.5 死规则 2 条 · D.6 S6 落地提示 |
| `.superpowers/sdd/p5b-fixtures/*.json` `*.http` | 17 个 | C.1 13 条 + 追加 1 条 + C.2 3 条 |
| `.superpowers/sdd/p5b-fixtures/README.md` | — | 文件 → curl → 抓取时间 → 关键形状备注;mock 层次表;未实测端点的源码推定形状;C.3 未跑说明 |

DoD 自检:
```
grep -c "^## " p5b-common-constraints.md          → 13   (要求 ≥ 11)  ✅
附录 A 主表行数(A.1)                              → 95   (+A.2 的 4 +A.4 的 1 = 100)
附录 D 类数                                        → 32 + 53 = 85               ✅
「大概 / 待定 / TODO」                              → 0 命中                      ✅
p5b-fixtures/ 条数                                 → C.1 13 + 追加 1 + C.2 3 + README ✅
```

⚠️ **附录 A 的总数是 100 不是 brief DoD 写的 99** —— 因为回源核出计划书整条漏了一个键(见 E-2)。
主表仍是 95 行,与 brief 的「99 + 表头」差的正是这 1 条。**这是本报告最要紧的一条,见 §4。**

---

## 2. 逐条回源复核的结果

**方法**:不采信计划书任何数字。三份附录的每一条都用脚本从权威源重新导出,再与计划书做**双向 diff**。

### 2.1 i18n(附录 A)

- 用脚本解析计划书 A.1 的 95 行,取出 (键名, 英文源串),再从 `git show main:src/assets/lang/zh_CN.json`
  取 zh 值,与计划书写的 zh 值**逐 `codePointAt` 比对**。
  → **89 条有源的:89/89 完全一致,零差异**(计划书这部分抄得很准)。
  → 6 条标「Vue2 无源」的:**语言包里全都有**,其中 3 条值不同(E-1)。
- 又反向扫两个蓝本 `.vue` 的全部 `$t('字面量')`:distinct **105**;
  加 `i18n.t('{n} months ago')`(只在 script)+ 动态展开的 `Indexing` = **distinct 107**
  = 9 复用 + 95 主表 + 2 死键 + 1 `Indexing` ✅ 闭合。
- 9 条复用键:逐个 `grep src/i18n/{zh_cn,en_us}.ts` 核过行号与值,与语言包逐字相同。
- 100 个新键与现有 96 个 `aiKb*` **零重名**(脚本比对)。
- 占位符两档一致性:20 条有占位符,zh/en 集合**零差异**(脚本比对)。全表无字面 `@`。
- 全角标点:对最终 100 个值实扫 `/[，；：？！（）]/` → **15 条**(计划书写 11 条,见 E-3)。

### 2.2 色值(附录 B)

- 对 T2 的 7 段与 T6 的 1 段**独立重扫**色字面量(正则含 hex / rgb(a) / 8 个具名色,
  用 `(?<![\w-])…(?![\w-])` 边界避开 `white-space` 这类假阳性 —— 这个修法是 P5a T11 留下的)。
  → 命中的**行**与计划书 B.2/B.3 列的**完全一致,一行不多一行不少**;所有值逐字相符。
  → 只有「处数」错(E-4)。
- `:241 :247 :253 :735 :770 :771 :774 :778 :779 :839 :840 :843 :844 :845 :846 :847 :848 :899 :958`
  `:1296 :1298 :1316 :1335 :1341 :1398 :1405 :1417 :1418 :1484 :1499 :1675 :1703 :1705 :1844-1847`
  `:1857 :1860 :1862 :1890-1895 :1899 :1941 :1972 :1973 :2022 :2031 :2036-2039`
  —— 逐个 `sed -n '<L>p'` 打开核过。**只有 `&.danger` 的起止偏 1 行**(E-10)。
- 4 个新 token 的 6 个 `tokens.scss` 行号(307/130/314/145/310/133)逐行打开核过,**值逐字相同**。
  `--danger-hover` 全仓 `grep` 确认**真的无源**。`theme.css:281 --success: #15754c` 与
  `theme.css:219 --toast-danger-fg: #c0392b` 核过。
- 现状文件 `src/ai/styles/knowledge.scss` 的既有 token 全部 `grep` 过一遍,
  确认 `--danger-soft` / `--danger-soft-border` / `--success-soft` / `--warning-soft(-border)` /
  `--modal-scrim` / `--bg-chip` / `--purple` 等**两档都在**,4 个新的**两档都不在**。

### 2.3 CSS 类(附录 D)

- 从两个蓝本模板程序化抽类(`class="…"` + `:class` 里的字符串字面量)→ **97 个 `k*` 类**。
- 从 T2 七段 / T6 一段的 scss 抽 `.k…` 选择器 → 34 / 54 个。
- 与计划书 D.1(32)/ D.2(53)双向 diff:
  - `D.1 ∖ scss = ∅`,`scss ∖ D.1 = {k-btn, k-scroll}`(两者都已在 `WHITELIST_102`)✅
  - `D.2 ∖ scss = ∅`,`scss ∖ D.2 = {k-btn}` ✅
  - `(D.1 ∪ D.2) ∖ 模板用到的类 = ∅` —— **没有死类** ✅
- 差集 `模板 ∖ (WHITELIST_102 ∪ D.1 ∪ D.2 ∪ {k-empty-btn})` → **`k-status-badge-cn`**(E-7)。
- 属性态:把两个模板里全部 `data-*` 绑定与 scss 里全部 `[data-*=…]` 选择器都列出来对了一遍(E-9)。
- `WHITELIST_102` 数组实测 102 项(E-6)。

### 2.4 后端契约

- `NimoOS-Parser/parser/{db.py, repo_jobs.py, service_reindex.py, service_files.py, routes/jobs.py}`
  与 `NimoOS-AI/agent/main.py:2749-2819` 逐段读过,K18 三条证据、两个上限常量、
  `delete_job` / `clear_failed` / distill cancel 的语义与响应体全部核实。
- `NimoOS-Service/src/{ai.ts, notes.ts}` 读过,确认 parser 系**零转换**、notes 系**已 camelCase 归一化**
  —— 这是本期 mock 最容易搞反的一层,已写进治理文件 §4.2 与 fixtures README。
- New-UI `knowledgeStore.ts` 的 13 个 action 行号(`loadAllJobs:336` / `loadIndexedFiles:415` /
  `loadDistillJobs:558` / `DISTILL_JOBS_LIMIT:187` / `fmtAgo:190`)逐个核过 ✅ 与设计 §2.1 一致。
- K11 的等价性:把 store 的 `fmtAgo` 与蓝本 `QueueView.vue:405-414` 逐行比过,
  差别只有 `Math.max(0, …)`,K11 的论证成立 ✅。

### 2.5 起点基线

独立复核:`p5b-baseline-test.log` = **Test Files 313 passed (313) / Tests 2872 passed (2872)**,
与协调者给的实测基线一致 ✅。

---

## 3. 🔴 计划书勘误(10 条,治理文件 §12 是权威版本)

| # | 计划书原文 | 权威源实际 | 我的处置 |
|---|---|---|---|
| **E-1** | §6 A.1 有 6 条标 `**Vue2 无 →**`,zh 值自拟;设计 §6.3「新建 · Vue2 语言包没有 **6**」 | 语言包里**6 条全有**;3 条值不同:`没有沉淀失败的任务。`(非「没有失败的沉淀任务。」)· `仅展示前 {n} 条;缩小筛选范围可查看其余记录。`(非「…；缩小筛选范围可看到其余。」,且**分号是半角 U+003B**)· `该任务已无法取消。`(非「这个任务已经不能取消了。」) | 附录 A 主表一律用语言包值,分类改「95 条全部有权威源」;§A.3 给了对照表 |
| **E-2** | 附录 A 共 **99** 条新增 | 🔴 **漏 1 条 → 100**。蓝本 `IndexedFilesView.vue:197` 是全批唯一一处 `$t()` 传非字面量,`statusBadgeMap.indexing.en='Indexing'`;`Indexing` 既不在附录 A、也不在 Vue2 语言包(vue-i18n 回落显英文) | 新增 **K20** + `aiKbStatusIndexing`(两档同填 `Indexing`,K16 同模具);「exactly N keys」用 **100**。见 §4 |
| **E-3** | T1 第 4(a) 给 **11** 条全角例外 | 实扫 = **15** 条:1 条假阳性(`aiKbClearFailedConfirmBody` 只含 `。`)+ 5 条漏(`aiKbOverExplicitCap` `aiKbPollTip` `aiKbRebuildCapHint` `aiKbTombstonedTip` `aiKbLoadErrorBody`)+ 3 条理由写错 | 附录 A §A.5 给实扫表。照计划书写守卫会当场红 5 条 |
| **E-4** | 「40 处」/ T2「18 处」/ T6「22 处」 | **T2 19 行/22 处;T6 13 行/17 处;合计 32 行/39 处**(18 与 22 疑似写反) | 附录 B §B.6 订正表。**行号与映射一条都没错** |
| **E-5** | T2 第 4 条枚举:T2 用 `--purple-soft`,`--danger-soft-faint` 留 T6 | 与 B.2/B.3 逐行表**自相矛盾**:`--purple-soft` 只在 T6 段 `:1894`;`--danger-soft-faint` T2 段 `:1417` 就用到 | **F2 裁定**:逐行表是权威,枚举是笔误。归属表落治理文件 §6.2 / 附录 B §B.1 |
| **E-6** | 白名单 **101 → 186**;T2 → 133 | 常量就叫 `WHITELIST_102`,实测 102 项 | **102 → 134 → 187**,常量名跟着改 |
| **E-7** | D.4 只登记 1 个未定义类 | 差集扫出**第 2 个**:`.k-status-badge-cn`(`IndexedFilesView.vue:197`) | 新增 **N13**,与 N10 同处理 |
| **E-8** | §10 A-1 / 设计 §7.3-3「1 行 `indexing`」 | 实测 **indexing 5 / ok 3 / error 0 / tombstoned 0** | 治理文件 §4.5 + fixtures README 都登记;连带列出「error/tombstoned/zerohint 真机全验不了」 |
| **E-9** | D.3「所有布尔属性必须套 `String()`…P5a T12 在 `.k2-cc` 上栽过」 | 蓝本 IFV **5 处没套**;读 Vue3 `patchAttr` 源码确认套不套**渲染完全一致**;`.k2-cc` 那次的真实教训是**属性名错**(`data-active` vs `data-on`) | **裁定:逐处照抄蓝本**;断言口径统一 `toBe('true')/'false'`,禁 `toBeUndefined()`。附录 D §D.3/§D.3.1 |
| **E-10** | T2 第 1 条「`&.danger`(蓝本 `:844-848`)」 | `&.danger {` 在 `:843`,闭合在 `:847`;`:848` 已是 `&:disabled {` | 正确是 **`:843-847`** |

**附带订正(brief / 环境层,治理文件 §12.1)**:蓝本路径是 `src/views/AI/Knowledge/…` 不是 `src/pages/AI/knowledge/…` ·
`tokens.scss` 在 `src/ai/styles/` 不在 `src/styles/`,且它的 `:60-150` 是浅色块 `:280-320` 是暗色块(与 `.knowledge-app` 相反) ·
设计 §6.3 的「去重 106」实测是 107 · 蓝本 `:1500-1503` 的 `.k-frow` 是死规则(模板没人用)不搬 ·
后端把 `len(file_ids) < 1` 与 `> 500` 用了同一条 400 消息。

**T0 主动补的两条守卫缺口**(不是计划书错,是现有测试的洞):

1. **`knowledgeStyles.test.ts:95` 的「没有搬多」正则 `/\.k2?-[a-z0-9-]+/g` 扫不到 `.kn-badge`**
   (`k2?` 吃掉 `k` 后要求 `-`,而这里是 `n`)。T2 恰好要搬 `.kn-*` 前缀的 S7 段,而蓝本
   `:2023-2281` 还有几十个 `.kn-*` 属于 P5d —— **多搬了现有守卫一条都抓不到**。
   已要求 T2 扩成 `/\.k(?:2|n)?-[a-z0-9-]+/g` 并做 RED 探针(附录 B §B.5 / D §D.0.1 / 治理 §6.4)。
2. **T6 的 `@media` 落点**:S6 的两条规则在蓝本里是 `@media (max-width: 860px)` 块内部的,
   现状文件已有这个块 —— 要加进既有块,不要另起(附录 D §D.6)。

---

## 4. 🔴 需要协调者拍板的一条(我已按 K16 先例落地,可一键回退)

**`aiKbStatusIndexing`(E-2)把本批新键从 99 变成 100。**

- 事实链(全部已核):蓝本 `:197` = `$t(statusBadgeMap[file.status].en)`;`statusBadgeMap`(`:573-580`)
  的 `indexing.en = 'Indexing'`;`'Indexing'` **不在** Vue2 `zh_CN.json`(Vue2 里 vue-i18n 回落显英文原串);
  **也不在**计划书附录 A。本机 8 个文件里 **5 个是 `indexing`**。
- 我的处置:按 **K16(用户 E2)完全相同的模具** —— 建 `aiKb*` 键、**两档同填英文原文**,
  渲染与 Vue2 逐字相同,模板零硬编码文案。登记为 **K20**。
- **若协调者裁定不加**(例如让 T9 直接输出原始英文串):只需删附录 A §A.4 一节 + 治理文件 K20 一行,
  并把「exactly N keys」从 100 改回 99。**改动面就这两处**,不影响其它任何一条。
- 顺带:T9 移植 `statusBadgeMap` 时,map 里要**同时保留 `en`(给 `:title`,蓝本是**未翻译**的原始英文)
  与 `key`(给 `$t()`)两个字段** —— 蓝本 `:191` 与 `:197` 用的不是同一个东西,别合并。

---

## 5. fixture 抓取记录

**跑过的**(2026-08-01 13:03:27 +08:00,直连 `:8283` / `:8282`):

| 组 | 条数 | 结果 |
|---|---|---|
| C.1 只读 | **13/13** | 全部 200。`jobs-failed` / `files-has-error` / `files-tombstoned` / `files-mime-prefix-legacy` / `distill-jobs(-failed)` **六条是空集**(本机没有这些数据),其余有内容 |
| C.1 追加 | 1 | `files-all-8.json`(`limit=100` 一次拿全 8 行),用来统计真实状态分布 —— 正是靠它发现 E-8 |
| C.2 幂等写 | **3/3** | `reindex-one` 200 `{"queued":1,"tombstoned":1,"job_ids":[349],"skipped":[]}` ✅ 证实蓝本读的 `res.queued` 真存在;`jobs-retry-empty` 200 `{"retried":0}`;`reindex-cap-400` **400** `{"detail":"too many file_ids (max 500)"}` |

计划书 C.2 最后一条的 shell **确实是坏的**:`python3 -c 'print(json.dumps(...))'` 缺 `import json` →
必抛异常走 `|| echo '[]'` fallback → 发出去空数组。已改成写临时文件 + `--data-binary @file`,
并在 README 里贴了改对后的命令。

**没跑的**:

| 项 | 原因 |
|---|---|
| C.3 全部 4 条 | brief 🔴 明令禁。形状全部改用**源码逐行阅读**记录(`routes/jobs.py:42-56`、`repo_jobs.py:130-145`、`agent/main.py:2803-2819`),README 里逐条标了「未实测,源码推定」 |
| `MAX_REINDEX_BY_FILTER = 10000` 的 400 | 本机只有 8 个文件,**触发不了**。按 `service_reindex.py:53-58` 的 f-string 记录形状,标「未实测,源码推定」 |

副作用记录:`reindex-one` 让 1 个文件被墓碑后重新入队(pending 338 → 339)。可忽略,且是幂等的。

---

## 6. 遗留疑问 / 交接项

1. **E-2 的第 100 个键**需要协调者一句话确认(见 §4)。其余 9 条勘误都是纯事实订正,不需要拍板。
2. **验收准备(设计 §7.2 E4)不属于 T0**:造 2-3 条 distill 行 + 2-3 条 failed job 归收官阶段。
   造完建议**重跑一次 C.1**,把非空的 `jobs-failed.json` / `distill-jobs.json` 覆盖上去 ——
   在那之前,T5 的 distill scope 与 failed 桶 mock **只能按 fixtures README「源码推定」那节的字段名手写**,
   这是本期唯一一处「fixture 覆盖不到」的地方,评审要特别盯 mock 形状。
3. **本机数据不足以真机验的清单**(治理文件 §4.5 已登记,收官写验收清单时直接搬):
   `error` / `tombstoned` 徽标 · `errhint` · `zerohint`(需 `ok && vector_count===0`)· tombstoned 行禁选 ·
   翻页(恒 `1 / 1`)· distill scope 全部。
4. **`--danger-hover` 的派生规则复算不出给定的十六进制**(暗档尤其对不上)。已在附录 B / 治理 §6.2
   写死「以设计 §6.2 的十六进制为准,禁止下游重算」。若将来要收这个色,是独立一票。
5. **附录 A 的 `⚠️N` 是 9 行不是计划书说的「8 处」**(#1 #2 #41 #59 #63 #90 #91 #94 #95;90/91 与 94/95
   各是一组同值撞车)。数字口径差异,不影响执行,未单列成勘误条。
