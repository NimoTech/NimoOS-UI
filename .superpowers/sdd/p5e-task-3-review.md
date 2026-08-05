# P5e · T3 独立评审 —— `util/searchAggregate.ts` + `searchAggregate.test.ts`

评审者:独立 sonnet 评审(本刀由 R19/R20 标记为「双重降级」:实现 sonnet + 评审 sonnet）。
被审提交 `6117ac0`(HEAD 现为 `ecee816`，含协调者 R18/R19/R20 三条裁定，不改产品码）。
铁律遵守：全程 `cp` 副本 + 行首锚定注入 + 先证注入落盘（md5 变化）+ 报红 + `cp` 还原 + md5 核对回基线。
基线 md5（`searchAggregate.ts`）= `3466dd7de6465ef2c2f2340add577a81`，全部 5 组探针复原后逐次核对一致。

---

## §1 协调者三处抽验 —— 独立复核结论

| 抽验 | 协调者结论 | 我的独立复核 | 结论 |
|---|---|---|---|
| `grep ': any\|as any'` | 零命中 | `grep -n ': any\|as any' searchAggregate.ts` → 空（exit 1） | ✅ 一致 |
| `id` 拼法 `:154` | 与蓝本 `:32` 逐字相同 | 亲读本仓 `:154` = `` id: `${fileId}:${kind}:${chunkNo}` ``；亲读蓝本（`git show 7a6ee6b7:.../searchAggregate.js` `sed -n 25,36p` → 第 8 行 = 蓝本 `:32`）= 逐字相同 | ✅ 一致 |
| `page:0` 保留 `:157` | 与蓝本 `:35` 逐字相同 | 本仓 `:157` = `page: cite.page != null ? cite.page : null`；蓝本 `:35`（同一段第 11 行）逐字相同 | ✅ 一致 |

三处协调者抽验**全部独立确认成立，无需 Critical 上报**。

---

## §2 代码膨胀逐行判定（第一必查项）

蓝本 79 行 + 两份拷贝去重后约 45 行 = 基准 ≈124 行；本仓 306 行（`wc -l` 实测）。
自算：`blank=30`，`comment-ish(以 `//`/`*`/`/*` 起始)=115`，代码行 ≈161。

逐函数比对蓝本（`kindFromMime`/`basename`/`dirname`/`chunkVM`/`fileVM`/`groupHits`/`toFileResults`/`chunkCount`/`highlight`/`fmtMtime`/`relLevel`/`relLabel`，全部对照 `git show 7a6ee6b7:src/views/AI/Knowledge/searchAggregate.js` 与两个 `.vue` 片段逐行读过），六类归因：

| 类别 | 约行数 | 判定 |
|---|---|---|
| ① 逐字移植 | ~85 | 12 个函数体，与蓝本对应行为逐字/逐分支一致（含 K48 去重后的 4 个函数），已用 5 组变异测试交叉验证运行时行为未变 |
| ② TS 类型标注/断言式收窄 | ~83 | 6 个接口(`CiteRaw`/`PreviewRaw`/`PathRaw`/`ChunkHitRaw`/`FileGroupRaw`/`SearchTextResponseRaw`)+2 个返回值接口(`ChunkVM`/`FileVM`)+ 函数签名/局部变量的显式类型注解 + `chunks!.push` 断言式收窄 |
| ③ 偏差申报注释 | ~115 | 文件头 K48/K49/K41 依据登记 + 逐函数 JSDoc 引蓝本 file:line + 分节分隔线 |
| ④ 未申报的新逻辑 | **0** | 逐函数核对，未发现任何蓝本没有的分支/字段/副作用 |
| ⑤ 被「修正」的行为 | **0** | 5 组变异测试（含协调者未点名的 2 组，见 §6）证明生产代码的可观察行为与蓝本完全一致，无任何「顺手修对」的迹象 |
| ⑥ 顺手抽的抽象 | **1 处，Minor** | `HTML_ESCAPE_MAP` 从蓝本的行内对象字面量 `({'&':'&amp;',...}[c])` 提升为模块级具名常量（`:240-245`）。**未在报告里申报为「额外改动」**，但纯粹是零行为差异的字面量提升（复用同一张映射表，逐字符结果相同），不构成 Important。归入⑥仅为如实计数，不影响结论。 |

**结论**：④⑤ 均为 0，未发现未申报新逻辑或被静默修正的行为。⑥有 1 处未申报的微重构但零风险。**代码膨胀本身不构成 Critical/Important。**

---

## §3 E-61 独立复核

### 3.1 E-61 本身是否成立

自己起 node 脚本跑原序 vs 调换序（`=== 'text/markdown'` 与 `includes('pdf')` 互换），输入 `'text/markdown+docling/pdf'`：

```
orig:    pdf
swapped: pdf   （结果不变）
```

**结论：E-61 成立** —— 精确相等分支与含后缀输入结构互斥，调换顺序对该输入零影响，协调者的订正裁定正确。

### 3.2 真实行为断言是否保留

`searchAggregate.test.ts:87-88`：
```js
expect(kindFromMime('text/markdown+docling/pdf')).toBe('pdf')
expect(kindFromMime('text/markdown+docling/pdf')).not.toBe('md')
```
**保留，未被删除。** 连带核实 N35（`MIME_PREFIXES` 的 md 前缀不含 docling 变体）不会被此行为误判——该断言正确钉住「docling 变体落 pdf 桶」这一真实后端行为。

### 3.3 替换判据是否真有判别力

亲手做探针：把 `includes('plain')` 挪到 `includes('pdf')` 之前（保持子串分支间相对顺序反转），喂 `'text/plain;pdf-scan'`：

```
$ pnpm exec vitest run searchAggregate.test.ts
 × 🔴 分支顺序真正有语义之处… → expected 'txt' to be 'pdf'
 Tests  1 failed | 73 passed (74)
```
还原后 md5 = `3466dd7de6465ef2c2f2340add577a81`（与基线一致），复跑 74/74 绿。**判据真实有判别力。**

构造输入标注核实：测试文件 `:93-94` 明确写「这条输入是纯粹为区分…构造的边界样本（不代表任何真实后端 mime 取值，真机 mime 分布见 F9 §2③）」——**未把构造值伪装成真机取值，合规。**

**E-61 独立复核结论：成立。**

---

## §4 三组必做 RED 探针（亲手跑，含还原）

全部使用 `cp` 副本注入 → 先证 md5 变化（证明注入落盘）→ `pnpm exec vitest run` 报红 → `cp` 复原 → `diff`+`md5sum` 核对与探针前基线逐字节一致 → 复跑转绿。

| 探针 | 注入 | 落盘证据(md5变化) | 报红结果 | 还原核对 |
|---|---|---|---|---|
| A（真正顺序敏感）| `includes('plain')` 挪到 `includes('pdf')` 前 | `3466dd7d…`→`d15c7ca3…` | 1 failed / 73 passed | `diff` IDENTICAL，md5 回 `3466dd7d…`，复跑 74/74 |
| B（K49 esc 删除）| `const esc = String(text) // 删除转义` | `3466dd7d…`→`408e5cf3…` | **4 failed** / 70 passed（`<script>`注入/`<img onerror>`注入/引号转义/空query 四条全红）| `diff` IDENTICAL，md5 回 `3466dd7d…`，复跑 74/74 |
| C（毫秒→秒）| `new Date(ms)` → `new Date(ms*1000)` | `3466dd7d…`→`e6aa294b…` | 1 failed / 73 passed（`58516-02-28` vs `2026-07-19`）| `diff` IDENTICAL，md5 回 `3466dd7d…`，复跑 74/74 |

三组均与 T3 自报的输出逐字/逐数一致（B 组我实测 4 条失败，T3 报告也是 4 条，用例名核对一致）。

---

## §5 mock 层次 / 数据契约

- 亲读 `src/ai/knowledge/stores/knowledgeStore.ts:548-562`（`runSearch`）与 `:571-574`（`loadChunkContext`）：均是「组装固定字段 → 直接 `return service.ai.searchText(body)` / `service.ai.searchChunk(...)`」，**零归一化**。确认 `toFileResults` 才是 camelCase 出口，T3 的 `SearchTextResponseRaw` 全字段 snake_case，方向正确，**未搞反**。
- `/v1/search/chunk` 是 GET（E-54）—— T3 本刀不涉及该端点（那是 T5 的活），不适用。

---

## §6 行为逐条核 + 缺口猎（亲手变异测试，含还原）

### 6.1 N45 三件事

- ①`resp.files` 优先：负控用例（`ZZZZ-must-not-appear` 假 hits）证明确实未消费 `hits`，✅ 独立有效。
- ②`groupHits` 保序：亲手注入「按 score 降序排序」变异 → **报红**（1 failed，期望顺序与排序后顺序不同），md5 还原一致。✅ 保序断言真实有效。
- ③`fileVM.score` 三档：档 1（真实数据 group.score）/档 2（构造样本，group.score 缺失兜 chunks[0].score）/档 3（两者都缺兜 0）均有独立用例。

### 6.2 🔴 新发现的缺口（Important）—— `groupHits` 内部「取第一条 chunk 的 score」这一具体规则本身零判别力覆盖

蓝本 `groupHits`（`searchAggregate.js:51-62`）对同一 `file_id` 的分组对象只在**第一次遇到该 file_id 时**写入 `score: h.score`，之后同 file_id 的后续 chunk **不会**更新这个 score（无论后续 chunk 分数更高或更低）。本仓 `:205-216` 逐字移植了这个行为。

**问题**：F5b 真实数据里，每个文件组的第一个 chunk（`chunk_no:0`）**恰好总是分数最高的那个**（8 条 hits 全部如此，见下方我的复核）。因此现有测试无法区分「取第一条」与「取最高分」这两种不同实现。

亲手做变异证明：把 `groupHits` 改成「取分组内最高分」（`if ((h.score||0) > (byId[...].score||0)) byId[...].score = h.score`）：

```
$ pnpm exec vitest run searchAggregate.test.ts --reporter=verbose
 Test Files  1 passed (1)
      Tests  74 passed (74)
```
**全部 74 条仍然通过 —— 零判别力。** 还原后 md5 回 `3466dd7de6465ef2c2f2340add577a81`。

对照:另一变异「取最后一条 chunk 的 score」（每次覆盖）**确实会报红**（`toBe(0.738)` 变成 `0.7354`），说明测试套件能区分「首/末」但不能区分「首/最高」——因为真实数据里首条总是最高分。

**定级 Important**（非 Critical）：生产代码本身忠实移植蓝本、行为正确；这是一处「产品代码对、守卫为零」的测试覆盖缺口（治理 §11-1 明令的常规动作，本档第 N 次同类命中）。建议后续刀补一条构造样本：同一 `file_id` 下第一条 chunk 分数**低于**后续 chunk，断言 group 仍取第一条的分数。

### 6.3 chunkVM 边界

`cite` 缺失 / `chunk_no` 非数字 / `page` 缺失 vs 显式 `null` vs `0`(合法页号) / `preview.text` 缺失 / `preview` 整体缺失 / `kind` 缺失 / `score` 缺失 / `id` 拼法精确值 —— 逐条读过，均有对应独立用例。**唯一的文档瑕疵（Minor）**：T3 报告 §3 声称「chunkVM 边界…已在用例描述里显式标注『构造样本』」，但实读 `:414-471` 的 `it()` 标题**并未**逐条写「(构造样本)」字样（只有 N45(3) 档2/档3 两条用例标题里有）。不影响判别力，只是报告用词比代码实际更强,记 **Minor**。

### 6.4 basename/dirname 边界

空串/null/undefined/无斜杠/尾斜杠/根路径`/`/多重斜杠，逐条与蓝本行为核对一致（`dirname('/a/b.md')==='/a/'`、`dirname('b.md')==='/'` 两条关键断言均在）。

### 6.5 kindFromMime 六分支

六分支各一条 + 空值兜底（`null`/`undefined`/`''`）+ docling 变体行为断言 + 顺序敏感断言，共 11 条，覆盖完整。

---

## §7 K48 四条

1. 等价性：T0 的 `k48-equiv.mjs`(534 组/0 差异) 引用坐标核实存在（`p5e-fixtures/scripts/k48-equiv.mjs`）。我自己额外跑 10 组 `relLevel` 边界输入（含 `0.5`/`0.65` 两侧）对比 if-链 vs 三元两种写法，**0 处不等价**。
2. `relLabel` 用 `i18n.global.t`：`grep -n "i18n.global.t\|useI18n"` 确认，`useI18n` 仅出现在注释里，代码里零使用。
3. 无第二份拷贝：`grep -rn "function highlight\|function fmtMtime\|function relLevel\|function relLabel" src/ai/knowledge/` 只命中 `searchAggregate.ts` 一处各一次。
4. i18n 键：`grep -n "aiKbSrRelHigh\|aiKbSrRelMid\|aiKbSrRelLow\|aiKbSrUntitled" src/i18n/zh_cn.ts src/i18n/en_us.ts` 确认四个键在两档均存在且值正确（`高`/`中`/`低`/`(未命名)`；`High`/`Mid`/`Low`/`(Untitled)`）。

---

## §8 fixture 纪律

- 三级出处标签：文件头注释明确写 `.REPLAYED`,分级正确。
- `FIRST_CHUNK_FULL_TEXT` 完整正文：程序化核对 `sha256=fe4f68aa570a1ad127811d38a3d87f3845523f0ff0cb53c4f9baad6327bade1b`,`len=2342` —— 与 F5b 源文件 `files[0].chunks[0].preview.text` 逐字节一致（我自己用 python 重算，与测试文件头注释里的命令和哈希值完全吻合）。仅此 1 条完整正文，符合 R9-3。
- 50 字前缀:逐条比对 `FILES_BRANCH_TWO_REAL_FILES` 与 `HITS_ONLY_EIGHT_REAL_HITS` 里全部 8 条 preview.text 前缀、`file_id`、`score`、`chunk_no`、`mtime_ms`、`path` 与 F5b 源文件（`d['hits']`/`d['files']`）逐字段核对 —— **全部真实，零编造**。
- D-6 构造样本（档2/档3/chunkVM 边界）：均在 `it()` 描述或代码注释里标注"构造"字样(档2/档3 显式)，chunkVM 边界仅隐含（见 §6.3 Minor）。
- F10 未被引用为具名文件，T3 改用行内构造的 `page:0` 样本达到同等效果，未违反 R10-④(未把它当 paths/files 形状依据)。

---

## §9 三门与数字（独立复跑）

```
pnpm test        Test Files  332 passed (332)   Tests  4100 passed (4100)   exit=0
vue-tsc --noEmit exit=0（零输出）
pnpm build       exit=0（同一条 chunk-size 警告，与本刀无关）
```
与 T3 自报完全一致（331→332 文件 +1、4026→4100 例 +74）。

零改动文件独立核实（`git diff 8943d9e HEAD -- <file>` 全部空输出）：
`package.json`/`pnpm-lock.yaml`/`src/styles/color-guard.test.ts`/`src/ai/knowledge/stores/knowledgeStore.ts`/`src/ai/knowledge/stores/parserStore.ts`/`src/ai/styles/knowledgeStyles.test.ts`/`src/ai/styles/knowledge.scss` —— **全部零改动**。
`.vue` 总数 = 182（不变），`color-guard.test.ts` = 184 例（不变）。
提交 `6117ac0` 只含 3 个文件（`git show --stat` 核实）。
`--reporter=verbose` 确认 `searchAggregate.test.ts` 74 条 `it()` 全部真实执行（无 skip/todo，无循环空转 —— 本文件无 `it.each` 参数化用例）。

---

## §10 结论

- **Critical：0 条**
- **Important：1 条** —— §6.2：`groupHits` 「取分组内第一条 chunk 的 score」这一具体规则，在现有 74 条用例下**变异为「取最高分」仍全绿**（亲手验证），是真实的测试覆盖缺口，产品代码本身正确（忠实移植蓝本）。建议下一刀或收官刀补一条「首条非最高分」的构造样本。
- **Minor：2 条** —— ① `HTML_ESCAPE_MAP` 常量提升未在报告里申报为独立改动（零风险，§2）；② 报告声称 chunkVM 边界用例标题「已标注构造样本」，实读代码只有档2/档3两条有该字样，chunkVM 边界本身没有（§6.3）。

**探针清单**（全部 md5 还原确认，与基线 `3466dd7de6465ef2c2f2340add577a81` 完全一致）：
1. E-61 调换 `includes('pdf')` / `=== 'text/markdown'`（node 独立脚本，非注入生产文件，无需还原）
2. 替换判据探针：`includes('plain')` 挪到 `includes('pdf')` 前 → 1 failed/73 passed → 已还原
3. K49 `esc` 删除 → 4 failed/70 passed → 已还原
4. 毫秒→秒 → 1 failed/73 passed → 已还原
5.（自选,缺口猎）`groupHits` 排序变异(按 score 降序)→ 1 failed/73 passed → 已还原
6.（自选,缺口猎)`groupHits` 取最后一条 score → 1 failed/73 passed → 已还原
7.（自选,缺口猎,**唯一未报红**)`groupHits` 取最高分 score → **74/74 全绿(未报红)** → 已还原 → 即 §6.2 的 Important 依据

**实测数字对照**:T3 自报 332 文件/4100 例/tsc 0/build 0 —— 我独立复跑逐字一致,无出入。

**§1 三处协调者抽验独立确认**:三项全部一致(零 any 成立、id 拼法逐字相同、page:0 未被吞),**协调者的判据本身也复核无误**。

**E-61 独立复核结论**:**成立**(调换后 `text/markdown+docling/pdf` 仍判 pdf,协调者的订正正确;替换判据`includes('plain')`vs`includes('pdf')`真有判别力)。

## 一句结论

**T3 可以关账进 T4**——零 Critical,1 条 Important(测试覆盖缺口,非代码缺陷,建议后续刀顺手补一条用例)+2 条 Minor(报告措辞轻微失准),不构成阻塞。
