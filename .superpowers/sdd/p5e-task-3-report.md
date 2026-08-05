# P5e · T3 报告 —— `util/searchAggregate.ts` + `searchAggregate.test.ts`

起点 HEAD `8943d9e`(`git status` 干净,两个目标文件此前不存在,已现测确认)。
产出提交见文末。**只新建两个文件,其它零改动**(`git diff --stat` 自证见文末)。

## 1. 逐函数对照(蓝本 `file:line` → New-UI)

| 蓝本 | New-UI | 说明 |
|---|---|---|
| `searchAggregate.js:5-12 kindFromMime` | `searchAggregate.ts` `kindFromMime` | 逐字移植,六分支顺序不变 |
| `searchAggregate.js:14-17 basename` | `basename` | 逐字移植 |
| `searchAggregate.js:19-23 dirname` | `dirname` | 逐字移植 |
| `searchAggregate.js:25-36 chunkVM`(私有) | `chunkVM`(私有,不导出,与蓝本一致) | 逐字移植 |
| `searchAggregate.js:38-49 fileVM`(私有) | `fileVM`(私有) | 逐字移植,`i18n.t('(Untitled)')` → `i18n.global.t('aiKbSrUntitled')` |
| `searchAggregate.js:51-62 groupHits`(私有) | `groupHits`(私有) | 逐字移植,保序注释原样保留 |
| `searchAggregate.js:64-72 toFileResults` | `toFileResults` | 逐字移植,入参类型收窄为 `SearchTextResponseRaw \| null \| undefined` |
| `searchAggregate.js:74-76 chunkCount` | `chunkCount` | 逐字移植 |
| `SearchView.vue:317-321`(`relLevel` if 链)/ `FileDetailDrawer.vue:199`(三元) | `relLevel` | K48 去重,数值同一(`0.65`/`0.50`(`0.5`)) |
| `SearchView.vue:322-326` / `FileDetailDrawer.vue:200` | `relLabel` | K48 去重,`i18n.global.t('aiKbSrRelHigh'/'Mid'/'Low')` |
| `SearchView.vue:333-343` / `FileDetailDrawer.vue:205-215` | `highlight` | K48 去重,先 escape 再 `<mark>`(K49) |
| `SearchView.vue:344-347` / `FileDetailDrawer.vue:201-204` | `fmtMtime` | K48 去重,手工 `getFullYear/getMonth/getDate` 拼串原样保留 |

**承接的 Vue2 行为**:蓝本 `__tests__/searchAggregate.spec.js` 的两条用例(files 优先映射字段级断言 · hits 兜底聚合)已在新测试里以真实 F5b 数据承接并加细(见 §3)。

## 2. K/N 命中显式申报

- **K1**(单层取数):不适用于本刀本身(`toFileResults` 本就直接消费 store 层已给到的裸响应体,无额外 `.data` 剥离需求),但类型声明遵循 K1 的既定口径(消费侧看到的是后端裸响应体,camel/snake 边界画在 `toFileResults` 出口)。
- **K41**(零 any):`service.ai.searchText`/`searchChunk` 返回 `Promise<unknown>`(`NimoOS-Service/src/ai.ts:579,584` 已现测确认)。本文件声明 `SearchTextResponseRaw`/`FileGroupRaw`/`ChunkHitRaw`/`CiteRaw`/`PreviewRaw`/`PathRaw` 六个窄类型,字段依据逐个引 `NimoOS-Search/service/search.go`(`Cite:46-53`、`SearchResponse:68-73`、分组组装`:263-290`、`preview.text:55-58,339-347`)。消费侧(T6/T7)在拿到 `store.runSearch()` 的 `unknown` 结果后一次性 `as SearchTextResponseRaw`——本刀不改包,零运行时行为,`grep -n '\bany\b' searchAggregate.ts searchAggregate.test.ts` 只命中注释里的文字"零 any"字样,零真实 `any` 类型用法(见 §6 证据)。
- **K48**(四函数去重):`highlight`/`fmtMtime`/`relLevel`/`relLabel` 从两份复制粘贴的蓝本拷贝抽进本文件并导出。等价性依据 T0 的 `p5e-fixtures/scripts/k48-equiv.mjs`(`p5e-task-0-report.md` §9 DoD-9:534 次比对,0 处不等价)——本刀文件头注释显式引用该证明坐标,未重做等价性验证(遵守 R3.2 的复用许可)。`relLabel` 用 `i18n.global.t`,不用 `useI18n()`。两个组件(T5/T6-T7)之后统一从这里 import,本文件是唯一定义处(`grep -c 'function highlight' -r src/ai/knowledge/` = 1,见 §6)。
- **K49**(XSS 唯一面):`highlight()` 先 escape `& < > "` 再插 `<mark>`。两条注入用例(`<script>alert(1)</script>` / `<img src=x onerror=1>`)+ RED 探针(见 §4)。
- **N45**(`toFileResults` 分支 + 保序 + score 三档):三件事拆成三个独立 `describe` 块,各自独立用例,详见 §3。

## 3. fixture 使用与 mock 层次

- **`.superpowers/sdd/p5e-fixtures/F5b-search-text.multifile.REPLAYED.json`**(首选,三级出处标签 = **REPLAYED**):4 文件 × 2 chunk,score 区间覆盖 high/mid/low 三档。测试文件里的 `FILES_BRANCH_TWO_REAL_FILES`(前 2 个真实文件组)与 `HITS_ONLY_EIGHT_REAL_HITS`(全部 8 条真实 hits)均逐字段取自这份 fixture(`file_id`/`score`/`mime`/`cite`/`mtime_ms`/`paths` 全部真实值)。
- **R9-3 合规**(只留 1-2 条完整正文):全文件仅 `FIRST_CHUNK_FULL_TEXT` 一处完整正文(取自 `F5b.files[0].chunks[0].preview.text`,长度 2342,`sha256=fe4f68aa570a1ad127811d38a3d87f3845523f0ff0cb53c4f9baad6327bade1b`,验证命令见测试文件头注释),其余 preview.text 全部截到真实前 50 字符(仍是真实数据的真实前缀,不是手编内容)。
- **`REORDERED_FOUR_REAL_HITS`**:同一批真实记录(4 个文件各取真实首个 chunk),仅调整数组元素顺序以区分「保序」与「按 score 重排」两个假设——字段值仍是真数据,顺序改动已在注释里显式申报。
- **档 2/档 3(`fileVM.score` 三档中的后两档)** 与 `chunkVM` 边界(cite 缺失/`chunk_no` 非数字/`preview` 缺失等)用最小构造样本(D-6 同款模具),因为真实 `F5b`/`F5` 的 `files[]` 恒带 `score` 且字段齐全,无法自然触发这些防御分支——已在用例描述里显式标注"构造样本"。
- **`ZZZZ-must-not-appear`**(files 优先负控测试里的假 hits 记录):明确标注为负控构造,不代表任何真实后端行为,仅用于证明 `toFileResults` 在 `files` 非空时确实不消费 `hits`。
- **mock 层次**:本刀不涉及 `store.runSearch`/`loadChunkContext` 的 mock(那是 T6/T7/T5 的活),`toFileResults` 直接吃 `SearchTextResponseRaw` 形状的裸对象(snake_case),与治理 §4.1 一致。

## 4. RED 探针(三组,逐一贴两段输出 + md5sum 还原确认)

### 4.0 独立复核发现并订正的一处 brief 措辞(未采信原文,已作出更正)

brief 原文声称「把 `mime === 'text/markdown'` 挪到 `includes('pdf')` 之前 → `text/markdown+docling/pdf` 的用例必须报红」。**亲手跑探针后发现不成立**:
```
$ node -e "... 交换后 kindFromMime('text/markdown+docling/pdf') ..."
pdf   # 与交换前相同,未报红
```
原因:`=== 'text/markdown'` 是精确相等,`'text/markdown+docling/pdf'` 因为多了后缀永远不可能精确等于 `'text/markdown'`,与任何 `includes()` 子串分支在结构上互斥,调换顺序对这个输入零影响。真正顺序敏感的是**两个 `includes()` 子串分支之间**(如 `pdf` 与 `plain` 同时命中时,先到先得)。已在生产代码与测试文件的注释里登记这一订正(同 E-56 的"独立复核后措辞订正"先例),原有"docling 变体→pdf"断言保留(它仍是真实、有效的行为断言,只是不该被当作顺序敏感的证据)。

### 4.1 探针 A —— `kindFromMime` 真正顺序敏感处(`includes('pdf')` vs `includes('plain')`)

注入(cp 副本→行首锚定 python 脚本替换→先证注入落盘):
```
-  if (mime.includes('pdf')) return 'pdf'          # 移到 plain 检查之后
+  if (mime.includes('plain')) return 'txt'         # 移到 pdf 检查之前(注入)
```
落盘确认(md5 变化):`4b50226c…` → `3466dd7d…`(注入其它必要的 K41/K49 文件头订正后的基线)→ 本次注入产生新 md5。
```
$ pnpm exec vitest run searchAggregate.test.ts
 × 🔴 分支顺序真正有语义之处:两个 includes() 子串分支之间("pdf" 与 "plain" 同时出现时,先到先得)
   → expected 'txt' to be 'pdf'
 Tests  1 failed | 73 passed (74)
```
还原:`cp` 回基线副本,`md5sum` 核对 = `3466dd7de6465ef2c2f2340add577a81`(与注入前一致),重跑转绿 74/74。

### 4.2 探针 B —— K49:删掉 `esc` 那一步

注入:`const esc = String(text).replace(/[&<>"]/g, ...)` → `const esc = String(text) // K49 RED probe: esc step removed`。
```
$ pnpm exec vitest run searchAggregate.test.ts
 × 空 query(空字符串)→ 原样返回 escape 后的文本  → expected 'hello & world' to be 'hello &amp; world'
 × 🔴 <script> 注入  → Received: '<script><mark>alert</mark>(1)</script>'（裸 <script 原样出现)
 × 🔴 <img onerror> 注入  → Received: '<img src=x <mark>onerror</mark>=1>'（裸 <img 原样出现)
 × 引号也被转义  → Received: 'a & b < c > d "e"'（未转义)
 Tests  4 failed | 70 passed (74)
```
还原:md5 核对回到 `3466dd7de6465ef2c2f2340add577a81`,重跑转绿 74/74。

### 4.3 探针 C —— 毫秒 → 秒(`new Date(ms)` → `new Date(ms * 1000)`)

注入:`const d = new Date(ms)` → `const d = new Date(ms * 1000) // K48/§9.13 RED probe`。
```
$ pnpm exec vitest run searchAggregate.test.ts
 × 🔴 真实毫秒值(F5b …mtime_ms=1784424392240)→ 与"同式比对"结果一致
   → expected '58516-02-28' to be '2026-07-19'
 Tests  1 failed | 73 passed (74)
```
还原:md5 核对回到 `3466dd7de6465ef2c2f2340add577a81`,重跑转绿 74/74。`diff` 逐字节确认与基线一致。

## 5. 三门完整终值

```
pnpm test:       Test Files  332 passed (332)   Tests  4100 passed (4100)   exit=0
pnpm exec vue-tsc --noEmit:  exit=0(零输出)
pnpm build:      exit=0(dist 产出,一条 chunk-size 警告,与本刀无关)
```
起点(HEAD `8943d9e`,brief 给定基线):331 文件 / 4026 例。落地后 332 文件(+1,`searchAggregate.test.ts`)、4100 例(+74,含 §4.0 订正后新增的 1 条顺序敏感用例)。零红项、零噪声命中(本刀未触及 `persist.test.ts`/`AgentComposer.test.ts` 的已知噪声用例)。

## 6. 自证命令与输出

```
$ grep -n "\bany\b" src/ai/knowledge/util/searchAggregate.ts src/ai/knowledge/util/searchAggregate.test.ts
src/ai/knowledge/util/searchAggregate.ts:29:// 🔴 K41(零 any)—— 共享包 ...   ← 仅注释文字,零真实 any 类型
$ grep -rn "^export function highlight\|^function highlight" src/ai/knowledge/
src/ai/knowledge/util/searchAggregate.ts:255:export function highlight(...)   ← 唯一定义处
$ grep -rln "function fmtMtime\|function relLevel\|function relLabel" src/ai/knowledge/ | grep -v searchAggregate.ts
(无输出 —— 零第二份拷贝)
```

## 7. 代码膨胀自评

蓝本 79 行(`searchAggregate.js`)+ 两份拷贝约 45 行(K48 四函数在两个 `.vue` 里的合计,已去重)= 基准 ≈124 行。
本仓 `searchAggregate.ts` **306 行**。逐类归因(行数为近似,来自 `awk` 分段统计):

| 类别 | 约行数 | 说明(正当 vs 需警惕) |
|---|---|---|
| 文件头声明性注释(K48/K49/K41 依据登记,治理强制要求) | 43 | 🟢 正当 —— §10 报告契约与 K48/K49/K41 三条治理款项都要求文件头显式登记依据坐标 |
| K41 窄类型声明(`CiteRaw`/`PreviewRaw`/`PathRaw`/`ChunkHitRaw`/`FileGroupRaw`/`SearchTextResponseRaw`) | 47 | 🟢 正当 —— TS 静态类型层,蓝本 JS 无此需求,`any` 的替代方案,K41 明文要求 |
| `ChunkVM`/`FileVM` 返回值接口声明 | 24 | 🟢 正当 —— TS 强制要求命名返回类型,蓝本用 JS 对象字面量无需声明 |
| 每个函数的 JSDoc(逐个引蓝本 `file:line` + 行为提醒) | ~70 | 🟢 正当 —— 治理 §11-2 要求"专查 N 系列有没有被顺手修正",逐函数登记出处是自证手段,不是新逻辑 |
| 分节分隔注释(`// ─── … ───`) | ~12 | 🟢 正当 —— 纯排版,不含逻辑 |
| 实际函数体(12 个函数:8 个蓝本函数 + K48 四函数) | ~85 | 与蓝本逐字对应,零新增逻辑(§4.0 订正的那处注释措辞除外,不影响代码行为) |
| 空行 | ~30 | 排版 |

**结论**:超出基准(306 − 124 ≈ 182 行)的部分**全部是 TS 类型声明(71 行)+ 治理强制的申报注释(≈125 行)**,零未申报的新逻辑、零被"修正"的行为、零顺手抽的抽象。唯一的实质性偏离是 §4.0 记录的对 brief 措辞的订正(不影响产品代码或测试断言的正确性,只是把一条注释的因果关系表述改正确)。

## 8. NEEDS_CONTEXT / 申报纪律自查

- 未跳过任何带 🔴 的复核项;K48 等价性引用 T0 证明而非重做,属治理 R3.2 明确许可的复用,非"采信上一刀结论"式的跳过。
- §4.0 的发现按"独立复核后订正措辞"处理(同 E-56 先例),未构成需要停下问用户的决策分叉——production 代码本身不需要改变(它就是蓝本的逐字移植),只是测试设计与注释措辞需要对齐到真实可验证的顺序敏感点。

## 9. 提交自证

```
$ git show --stat HEAD
```
(见下方返回结果附带的 sha)——只包含 `src/ai/knowledge/util/searchAggregate.ts`、`src/ai/knowledge/util/searchAggregate.test.ts`、`.superpowers/sdd/p5e-task-3-report.md` 三个文件。
