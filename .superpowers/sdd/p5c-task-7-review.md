# SP8-P5c · Task 7 独立评审 —— `ParserTest.vue`(Parser 测试沙盒)

**被评审提交 `1d589e0`** · 基线 `5ccb287` · 治理最新版 `91ea87b`(含 **K34** + K31 订正,已按最新版核)

## 结论

**`Ready to merge`** —— 产品代码(`ParserTest.vue`)与测试(`ParserTest.test.ts`)**零缺陷**:
template + script 242 行经我自建的规范化 diff 证明**逐字节 1:1**,K1/K24/K27/K31/N16/N18/N22 全部落地,
三门实测与报告逐字相符,fixture 6/6 等价 + 6/6 变异被抓,§9.2 en 档同族对**零遗漏**。

唯一 Important 是**报告文档自身的行号/行数全面陈旧**(不涉产品代码,改文档即可)。

| 级别 | 条数 |
|---|---|
| Critical | **0** |
| Important | **1**(I-1,纯文档) |
| Minor | **2** |

---

## Critical:0 条

逐条核过、**未发现**:回归 `.k-*` 设计语言 · N15–N22 被「顺手修正」 · mock 层次搞反 ·
零改动清单被碰 · 路由/`deferred.ts` 被改 · i18n 被改 · 新增键 · 手编 fixture。

---

## Important

### I-1 报告的 **New-UI 侧行号与行数全面陈旧**,下游照它查会落到错行

报告 §1 表、§2.1、§2.2、§3.2、§4 的 New-UI 坐标与实际文件**系统性不符**(偏移方向还不一致):

| 报告写 | 实测 | 偏差 |
|---|---|---|
| `.vue` **415 行** | **471** 行(非空 436) | −56 |
| `.test.ts` **1046 行** | **1373** 行(非空 1261) | −327 |
| §2.1 `<template>` `:283` · `.parser-app` `:284` · `.parser-test-page` `:289` | `:292` · `:293` · `:298` | **−9** |
| §2.2 `import { service }` `:134` | `:119` | **+15** |
| §2.2 `data()` 10 项 `:194-211` | `:173-188` | **+21** |
| §2.2 `onDrop` `:217-221` | `:194-198` | **+23** |
| §2.2 `submit()` `:263-289` | `:239-266` | **+24** |
| §2.2 `fmtBytes` `:309-313` | `:285-289` | **+24** |
| §4 N16 表 `←` 在 `:293` · `×` 在 `:329` | `:302` · `:336` | +7~9 |
| §2.3 静态 class「蓝本 48 → 新 49」 | 我实测 **44 → 45**(**增量 +1 且只多 `parser-app`,结论一致**) | 计数口径不同 |

**蓝本侧行号我逐个抽查过,全对**(`:115` N18 · `:208-215` FormData · `:222-223` 取值链 · `:236-240` fmtBytes)。
错的只有 New-UI 侧 —— 像是报告表格写在某个中间稿上、之后注释增删未回填。

**为什么算 Important**:治理 §10 报告契约明令要「Vue2 `file:line` → New-UI 的对照」,
而这正是本期已栽九次的**「在文件里找某段文本/行号」同族**。T8 / T10 / 协调者拿这张表定位必落错行。
**处置:报告就地重算(产品代码不动、不需要重跑三门)。**

---

## Minor

### M-1 K34-1 / K34-2 / K34-3 并非字面意义的「零行为变化」,且与 K34-4 的自我论证互相矛盾

四处**机械必需性我已实证成立**(见下方 K34 判断),但「零行为变化」这半句要打折:

- K34-1 `fileInput?.click()` · K34-2 `files?.[0]` · K34-3 `e.dataTransfer &&`
  —— 三处都把蓝本会抛的 **TypeError 变成静默 no-op**。
- 只有 **K34-3 的头注释把这一点写明了**(「蓝本在 `dataTransfer` 为 null 时会抛 TypeError」),
  K34-1 / K34-2 的注释只写了机械理由,没写这个语义差。
- 🔴 **内部不一致**:K34-4 的注释自己论证得很好 ——「`?.` 会把它悄悄变成回空串,那是行为改动」,
  所以选了非空断言 `!`。**同一条道理逐字适用于 K34-2 / K34-3**,那里存在保抛语义的替代写法
  (`($event.target as HTMLInputElement).files![0]` / `e.dataTransfer!.files`),却用了 `?.` / `&&`。

按 K34 落地要求 ② 严格读,这三处该**单独申报为「行为变化(浏览器不可达路径)」**而不是挂 K34。
**不阻塞**的理由:三条路径浏览器均不可达(`drop` 必带 `dataTransfer`;file input 恒渲染;
`chunkText` 只在 `v-if="result"` 内),四处都 TS 强制,且已在文件头披露。

### M-2 N22 的子串扫描用了过于通用的针,未来可能**假报红**

`TECH` 里 `'cos '` / `'rr '` / `' chunks ·'` 是**全语言包子串**扫描。当前 3006 个值**零命中**(我独立复核),
但将来任一无关新键(含这些子串)会让这条**冤枉报红**——正是治理 §9 第九条「否定式撞文本」的同族风险。
建议 T8 若复制此写法,改成「不许存在**值恰好等于**该串的键」或限定 `aiKbPt*` 前缀。**本期不必改。**

---

## 我自做的 RED 探针(13 条 + 4 条 tsc,全部先断言注入落盘、事后 md5 逐字节还原)

🔴 **harness 自身先栽后修(值得记账)**:第一版用了 vitest 4 **不存在的** `--reporter=basic`
→ 加载 reporter 就崩 → **exit=1 是假红**,差点把 R1 读成「守卫无判别力」。
已加自检「必须解析到 `Tests …` 汇总行,否则拒绝下结论」,并先在干净树跑出 **79 passed** 基线。
另有一次探针在 `[2]` 断言处中断把文件留在改动态,已 `git checkout --` 还原并核 md5(见收尾)。
之后给 harness 加了 `try/finally`,保证任何异常都还原。

| # | 探针 | 结果 |
|---|---|---|
| R1 | **K27**:`parserTestAnalyze(fd)` 再传第二参 `{headers,timeout}` | ✅ 1 红 |
| R2 | **FormData**:`query` 改成**无条件** append | ✅ 1 红 |
| R3 | **K31**:压回单元素(两类合并到外层 div) | ✅ **2 红**(与报告一致) |
| R4 | N18:`rank-no` 改成裸下标(渲染变化版) | ✅ 2 红 |
| **R4b** | 🔴 **N18 忠实改写**:`v-for="(s, i)"` + `i + 1`(**渲染完全等价**) | ✅ **1 红** —— 证明源码形状断言对**渲染等价**的改写仍有判别力(比报告探针 G 更强的判据) |
| R5 | **§9.2**:`t('aiKbPtProcessing')` → 被禁键 `t('appsWorking')` | ✅ **2 红**(en 正向 + 反向断言都抓到) |
| R6 | **缺口③**:模板**最后一个内容行**塞 `#abcdef` | ✅ 1 红(独立复现报告探针 A) |
| R7 | 缺口猎:`embed` 从恒 `'true'` 改成跟开关走 | ✅ 1 红 |
| R8 | 缺口猎:`fmtBytes` KB 档 `toFixed(1)`→`(2)` | ✅ 2 红 |
| R9 | 缺口猎:catch 取值链砍掉 `\|\| data.error` | ✅ 1 红 |
| R10 | 缺口猎:30 MB 超限「顺手清 file」 | ✅ 1 红 |
| R11 | 缺口猎:`truncate` 边界 `>` 改 `>=` | ✅ 1 红 |
| R12 | 缺口猎:拿掉 K34-3 的 `e.dataTransfer &&` | ⚪ **79/79 全绿**(见缺口猎结论) |
| R13 | 缺口猎:`result.value!` → `result.value?.` | ⚪ **79/79 全绿**(同上) |
| T1-T4 | **K34 机械必需性**:四处各回退成蓝本原样 → `vue-tsc` | ✅ **4/4 硬报错**(见下) |

### K34 四处的独立判断

**① 真机械必需吗 —— 是,4/4 实证**(回退成蓝本写法,`vue-tsc` 立刻 exit 2):

```
K34-1  ParserTest.vue(329,46) TS18046: '__VLS_ctx.$refs.fileInput' is of type 'unknown'.
K34-2  ParserTest.vue(327,34) TS18047: '$event.target' is possibly 'null'.
       ParserTest.vue(327,48) TS2339: Property 'files' does not exist on type 'EventTarget'.
K34-3  ParserTest.vue(196,13) TS18047: 'e.dataTransfer' is possibly 'null'.  (+ 196,37 同款)
K34-4  ParserTest.vue(270,13) TS18047: 'result.value' is possibly 'null'.
```

**② 真零行为变化吗 —— K34-4 是(`!` 纯类型层);K34-1/2/3 严格说不是**(抛 → no-op),
但三条路径浏览器不可达 → 见 **M-1**。
**③ 报告列全了吗 —— 列全了**(§15 四条 + 文件头逐条登记),措辞见 M-1。

---

## 我做的缺口猎:猎了 7 处,**未猎到「产品代码对、守卫为零」的真缺口**

猎中过的三次(T2b `--x:` 逃逸 · T3 守卫变量作用域 · T6 键选纪律)在本刀**未复现**:

- ✅ **有守卫**:`embed` 恒 `'true'`(R7)· `fmtBytes` 三档小数位(R8)· 取值链 `|| data.error` 档(R9)·
  30 MB「只 return 不清 file」语义(R10)· `truncate` 严格 `>` 边界(R11)· N18 渲染等价改写(R4b)。
- ✅ **§6.1(a) 那条被否决的路也堵住了**:根元素断言是 `className).toBe('parser-app')` **精确相等**
  → 谁往外层加 `.knowledge-app` 借 token 都会立刻报红(我核了断言形式,不是 `toContain`)。
- ⚪ **两处「测试抓不到」但不构成缺口**:R12(K34-3 守卫)与 R13(`!`→`?.`)都是 **79/79 全绿**。
  原因是**被守的路径本身不可达**(`drop` 必带 `dataTransfer`;`chunkText` 只在 `v-if="result"` 内)
  —— **没有可断言的用户可见行为,属于 `vue-tsc` 的辖区**(上面 T1-T4 已证明 tsc 确实兜住)。
  这不是「守卫为零」,而是「无物可守」。R13 另有一层意思:`?.` 也能全绿,说明实现者选 `!`
  **不是被逼的、是主动选了更忠实的那个** —— 加分项。

---

## template + script 242 行覆盖度 —— 我的独立判断:**242/242,逐字节 1:1**

**不是抽查。** 自建规范化 diff 脚本(只做已授权回推),两半各自跑到「零 diff」:

### template(蓝本 `:1-152`)—— **逐字节相同** ✅

```
# i18n 键映射条数: 23
# 模板里用到的 aiKbPt 键: 22          (第 23 个 aiKbPtTooBig 在 script)
# 蓝本 template(剥注释后)行数: 147
# 规范化后 New-UI template 行数: 147
# 逐字节相同: true
$ diff -u bp-template.txt nu-template-norm.txt   → exit 0(零输出)
```

授权回推共 4 类:① 去 K31 外层 `.parser-app` 并反缩进 2 空格 · ② `t('aiKbPtX')` → `$t('<en 原串>')`
(键值取自 `en_us.ts`)· ③ K34-1/K34-2 反推 · ④ 一处折行归一(K34-2 让 `<input ref="fileInput">`
超长被折成两行 —— 纯排版,零渲染影响)。**剥注释在两侧对称做(整行注释行一律丢弃)**,
避免治理 §9 第七/八/九条那类撞注释事故。

### script(蓝本 `:154-243`)—— **63 语义行逐行对齐**,残差全部可归因 ✅

`submit()` **整段(含 FormData 九字段 + catch 取值链)零差异**:

```
fd.append('file', this.file)                              ← 两侧逐字
if (this.query) fd.append('query', this.query)            ← 有条件 append,逐字
fd.append('embed', 'true')                                ← 恒 'true',逐字
fd.append('rerank', this.rerank ? 'true' : 'false')
fd.append('ocr', this.ocr ? 'true' : 'false')
fd.append('target_tokens', String(this.params.target_tokens))    ← 三处 String() 逐字
fd.append('overlap_tokens', String(this.params.overlap_tokens))
fd.append('min_tokens', String(this.params.min_tokens))
const detail = e.response && e.response.data && (e.response.data.detail || e.response.data.error)
this.error = detail || e.message || String(e)             ← 🔴 取值链一字未改,零数组分支
```

残差 5 类,全部合规:① 4 处 K34;② TS 类型标注;③ prettier 的 `(x) =>` 括号;
④ `name: 'ParserTest'` 选项消失(`<script setup>` 由文件名派生,标准做法);
⑤ `params` 三值 `600/80/2` 逐字相同(仅我的归一器两侧前缀不对称)。

**结论:零遗漏、零未授权新增。** 蓝本 369 行的 `<style>` `:245-369` 属 T2b,已按 brief 不计入本刀。

---

## 逐条专查项核准

| # | 专查项 | 结论 |
|---|---|---|
| 1 | template+script 逐行 1:1 | ✅ 见上,逐字节 |
| 2 | **K27 单参 + K1 无 `.data`** | ✅ 回源 `NimoOS-Service/src/ai.ts:673-680`:`parserTestAnalyze(body: FormData)` **只收 1 参**,内部补 multipart 头 + `timeout:120000`,`return res.data`。测试 `mock.calls[0]` 长度恰 1 + 三条否定式(**剥注释后**)。**R1 探针报红** |
| 3 | **FormData 九字段** | ✅ 顺序与值逐字(见上代码块)。`fd.has('query')===false` 那条**确实在**(`:606`)+ `getAll('query')).toEqual([])` + 键序列 `toEqual`。**R2 探针报红** |
| 4 | **K31 两层根元素** | ✅ `<div class="parser-app"><div class="parser-test-page">`,与 `parser-styles.scss:162` 的**后代**选择器 `.parser-app .parser-test-page` 对齐。**未**照计划书那行旧单元素写法。**R3 探针 2 红** |
| 5 | **N18 照抄** | ✅ `#{{ result.scored.indexOf(s) + 1 }}` + `v-for="s in result.scored"`。**R4b 忠实(渲染等价)探针报红** |
| 6 | **N22 十五串零补键** | ✅ **我独立重扫**(真实模块导入,非正则):两档各 **1503** 键 = 3006 值,十五串**总命中 0**;且十五串在模板里逐串是**裸文本**(1~3 次命中,全在 `t()` 外)。见 M-2 的健壮性提醒 |
| 7 | **N16 + E-15 勘误** | ✅ **E-15 成立**:`git show main:` 实测蓝本 `ParserTest.vue` **零 `🧪`**;`🧪` 在 `ParserStatus.vue:6` 与 `SettingsView.vue:162`(逐字命中)。**brief 错、实现者对。** 其余符号我做了程序化「t() 外/内」计数比对:`← × ✓ ·(×5) ▼ ▶ ⚠` **7 个符号两侧计数完全一致**;`…` 与 `–` 从模板字面量迁进**键值**(`aiKbPtProcessing`=`处理中…`/`Processing…`、`aiKbPtDefaults` 含 `5–20` U+2013,两档均已核)—— 这正是 N16「在 t() 里面(键值自带)」的预期 |
| 8 | **§4.2 四条事实各有用例** | ✅ ①`docling-card` 不渲染(`.md`+`.txt` 两侧)+ mock 造带值验渲染/折叠两态;②`rr` 不渲染 + 有值侧 + `null` 侧;③`⚠ Reranker error:` 警告条(真机坏 reranker,fixture 原文)+ 缺席侧;④ ok-hint 回显**后端 `params_used`**(`.md` 传 80 回 **0**、`.txt` 回 **10** 两半都有),并同时断言「前端确实传了 80」——**判别力充分** |
| 9 | **422 不测 + 取值链未改** | ✅ 未写 422 用例(正确);取值链**一字未改**、**零数组分支**(规范化 diff 逐字证明);422 响应体逐字抄在头注释并说明双挡。实际测了 5 条可达失败路径 |
| 10 | **§4.4 fixture 抄本** | ✅ `src/` **零运行时读 `.superpowers/`**(全仓 grep 只有注释引用);**我独立写了校验脚本**(不复用报告那个):**6/6 MATCH**,字节数 664/888/194/48/150/89 **与报告逐字相符**;`--mutate` **6/6 被抓** |
| 11 | **§9.2 en 档比对** | ✅ **独立重扫(真实模块)**:`aiKbPtProcessing`↔`appsWorking` 是**唯一 EN-DIFF**(zh 都「处理中…」,en `Processing…` vs `Working…`)—— 报告对(`appsWorging` 只是报告里的笔误,实为 `appsWorking`);2 对 EN-SAME(`aiKbPtReset`↔`filesViewerReset`、`aiKbPtRun`↔`aiSkTestRun`);🔴 **我另扫了镜像方向**(en 撞车而 zh 不同)= **0 对** → **零遗漏同族对**。补的断言**有判别力**:R5 探针换成禁用键 → **2 红** |
| 12 | **K34 四处** | ✅ 见上「K34 四处的独立判断」+ M-1 |
| 13 | **缺口③ 模板零裸色** | ✅ 沿用现状写法(③′ 归 T8,未按「该用贪婪匹配」报缺陷);`node:fs` 读源、**未用 `?raw`**;覆盖度自检含首/尾特征串。**R6 独立复现:塞在模板最后一个内容行仍精确报红** |
| 14 | **i18n 零改动** | ✅ `git diff 5ccb287..1d589e0 -- src/i18n/` **空**;23 个 `aiKbPt*` 键 T1 已落地,新增 **0** |
| 15 | **三门 + 算术** | ✅ **我自己复跑**:`pnpm test` **Test Files 325 / Tests 3379,exit 0,零红项**(两条已知噪声本轮未触发);`vue-tsc --noEmit` **exit 0 零输出**;`pnpm build` **exit 0**。`.vue` = **178** ✅(治理 §8.1 台账)。算术:T6 基线 324/3299(已回 T6 报告核对)→ +1 文件、**+80 例 = 79 新 `it()`(我 grep 实测 79)+ 1 color-guard** ✅ |
| 16 | **`dist` 无 `parser-test-page`** | ✅ 实测 `dist/assets/*.css` **全 0 命中**、`grep -rl dist/` 零文件 —— E-13 预期;`knowledgeRoutes.ts:62-63` 两条路由**仍指 `KnowledgeDeferred` 占位页**,**未为凑门改路由或任何别的文件** |
| 17 | **提交范围** | ✅ `git diff --name-only 5ccb287..1d589e0` = 恰好 4 个:`ParserTest.vue` · `ParserTest.test.ts` · `p5c-task-7-report.md` · `p5c-task-7-fixture-verify.mjs`。**零改动清单全部未碰**(`parser-styles.scss` / `parserStyles.test.ts` / `ParserStatus.*` / `parserStore.ts` / `knowledge.scss` / `knowledgeStyles.test.ts` / `src/i18n/*` / `FolderBrowser*` / `knowledgeRoutes.ts` / `deferred.ts`) |

**附加交叉核**:模板静态 class 集合 蓝本 **44** → New-UI **45**,**多出的只有 `parser-app`、缺少 0 个**;
且 New-UI 模板用到的 **45 个类在 `parser-styles.scss:162-295` 的 test-page 段里全部有规则**(零悬空类)。

---

## 与报告不符之处

1. 🔴 **I-1**:New-UI 侧行号/行数全面陈旧(详见上)。蓝本侧行号抽查全对。
2. §2.3 静态 class 计数「48 → 49」我复现为「**44 → 45**」;**增量与结论一致**(只多 `parser-app`),
   属计数口径差异,并入 I-1。
3. §10 表里 `appsWorging` 是笔误,实为 **`appsWorking`**(brief 已提示,此处确认;测试代码里写法正确)。
4. 报告 §12 探针 G 的 N18 改写是**渲染会变**的版本;我补做的 **R4b 渲染等价版**同样报红 ——
   报告的结论成立且**比它自己声称的更强**,登记为「优于报告」。

**其余每一条我都回权威源核过、与报告一致**(未采信报告任何未复核的断言)。

---

## 收尾

- `git status --short` **空(干净)**;`git log -1` 仍是 `91ea87b`,**未提交任何东西**。
- 探针涉及的 `ParserTest.vue` md5 = `ef6019c620eef7489c44142c9e36ddb7`,与全部探针前的原值**逐字节一致**;
  `ParserTest.test.ts` 全程只读(md5 `d134849df6fb902566b0612b6e5a5b21`)。
- 中途一次探针异常把文件留在改动态,已 `git checkout -- <该文件>` 还原并核 md5 一致;此后 harness 加了 `try/finally`。
- 未 checkout / stash / 提交 `NimoOS-UI`(蓝本一律 `git show main:`)。
- 我的脚本全部写在 scratchpad,**未落进本仓**(本文件除外)。
