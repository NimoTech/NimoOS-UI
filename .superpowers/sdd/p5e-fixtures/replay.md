# P5e fixtures —— 复现手册(T0b 补写,承评审 Important-1)

> 🔴 **本文件是 `F0*` / `F5` / `F5b` / `F6` / `F6b` / `F12` 的唯一复现路径。**
> T0 第一版的 README §3 引用了本文件但**根本没写**(评审 Important-1),现补齐。
>
> **一条命令全量重跑**:
> ```bash
> cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
> node .superpowers/sdd/p5e-fixtures/scripts/replay-fixtures.mjs      # 重写 F0a/F0/F0b/F0c/F5/F5b/F6/F6b/F12
> node .superpowers/sdd/p5e-fixtures/scripts/verify-fixtures.mjs      # 逐字段自查,exit 0 = 通过
> ```
> `--dry` 只打印不写文件;`--reembed` 强制重新调 Parser 算 embedding。
>
> ⚠️ **本文件里凡标「手工」的步骤都明写了「这一步是手工的」** —— 不许把手工步骤当命令读。

---

## 0. 为什么是「重放」而不是端到端抓

本机 `/v1/ai/search/text` **对任何查询词都返回 `hits: []`**:Qdrant 里 5592 个向量的 `root_ids`
全是 `dfcd1840f5dab439cd9d7050aa5bafd0`,而核心 `search-roots` 只返 `["photos"]`,交集恒空。
详见 `README.md` §3 与协调者裁定 **R2**(用户已拍板:结果半区不列真机验收项,🔴 **禁开 root grant**)。

⇒ 非空响应体只能靠「**真数据 + 权威 Go 代码路径逐行重放**」。
重放的每一行都对着 `NimoOS-Search` 的源码写,坐标逐个标在 `scripts/replay-fixtures.mjs` 里:

| Go 源 | 行 | 重放位置 |
|---|---|---|
| `service/search.go` `buildHitFromPayload` | `:298-337` | `buildHitFromPayload()` |
| `service/search.go` `stringOrNilFromAny`(`""` → `nil`) | `:339-347` | `strOrNil()` |
| `service/search.go` `asInt64` | `:355-367` | `asInt()` |
| `service/search.go` 排序 / 分组 / topK / maxChunks | `:205-231` | `assemble()` |
| `service/search.go` `paths`+`mime` 回填(**真 Parser**) | `:243-259` | `assemble()` 里那次 `jget` |
| `service/search.go` `files[]` 组装(`grp.Score = grp.Chunks[0].Score`) | `:263-290` | `assemble()` |
| `service/authz.go` `GetChunkWindow` | `:103-149` | `chunkWindow()` |

---

## 1. 环境前提

```bash
# Parser(固定端口)与 Qdrant(HTTP)必须在跑
curl -s http://127.0.0.1:8283/v1/parser/stats
curl -s -X POST http://127.0.0.1:6333/collections/text_chunks/points/count \
     -H 'Content-Type: application/json' -d '{"exact":true}'
```

**T0b 实跑时的设备状态(2026-08-05,与 T0 首轮逐字相同)**:
```
control/state : {"paused":true,"concurrency":2,"device":"auto","ocr_enabled":false,"resolved_device":"cpu"}
stats         : queue_depth {"pending":339,"running":1,"failed":0,"done":9}
                indexed_files 7 · total_vectors_text 5592
points/count  : {"result":{"count":5592}}
```
🔴 **`total_vectors_text` 变了 ⇒ 重放结果会变**(Parser 现在是 `paused`,所以不会变;
一旦有人 resume 队列,339 个 pending job 会往 Qdrant 里灌新向量,`F0` 的命中集就漂了)。
届时请连 `F0*` 一起重跑,不要只重跑 `F5*`。

---

## 2. F0a —— 真 bge-m3 embedding(命令)

```bash
curl -s -X POST http://127.0.0.1:8283/v1/parser/embed \
  -H 'Content-Type: application/json' \
  -d '{"model":"bge-m3","input_type":"text","text":"404 not found error in the parser upsert log"}'
```
响应 = `{ dense: number[1024], sparse: {indices, values}, dim: 1024, model_version: "bge-m3/v1" }`。

🔴 **为什么要把它落盘成 `F0a-parser-embed.REAL.json`**:同一个 dense 向量 ⇒ 同一批 Qdrant 命中。
落盘后重放**不依赖模型权重**,任何时候跑都得到同一个 `F0`。
`replay-fixtures.mjs` 默认复用它;加 `--reembed` 才重新调 Parser。

实跑值:`embed_ms = 345`(热进程)。⚠️ 冷进程会是十几秒(裁定 R5)。

---

## 3. F0 + F5 —— 真向量查询 → 单文件多 chunk(命令)

### 3.1 取真命中

```bash
# body 里的 query 就是 F0a 的 dense(1024 个 float),这里用 jq 拼
curl -s -X POST http://127.0.0.1:6333/collections/text_chunks/points/query \
  -H 'Content-Type: application/json' \
  -d "$(jq -c '{query: .response.dense, using: "dense", limit: 40, with_payload: true}' \
        .superpowers/sdd/p5e-fixtures/F0a-parser-embed.REAL.json)"
```
- `limit: 40` = `service/search.go:121-130` 在 `GroupByFile` 下算出的 candidates 上界
  (`min(topK*maxChunks, 100)`,本期 `topK=10` / `maxChunks=8` → 80,取 40 足够覆盖 8 条 hit;
  🔴 **这是唯一一处参数选择**,已写在 `F0._request` 里)。
- `using: "dense"` = `service/qdrant_client.go:72-74`(sparse 只做 prefetch,最终打分用 dense)。

**T0b 实跑**:40 个点,score `0.737986 … 0.730946`,全部来自 **同一个 file_id**
(`dce79e8ea5d48719cd4ad16fe48da843` = 一个 3448 chunk 的 docker json 日志)。
⇒ 这就是为什么 `F5` 只有 1 个 file group、而多文件场景必须另造(`F5b`)。

### 3.2 走 Go 路径

`replay-fixtures.mjs` 的 `assemble()`。中间那次**真 Parser 回填**是:
```bash
curl -s "http://127.0.0.1:8283/v1/parser/_internal/files?file_ids=dce79e8ea5d48719cd4ad16fe48da843"
```
输出(逐字,也落在 `F9-parser-and-roots.REAL.json` 里):
```json
{"files":[{"file_id":"dce79e8ea5d48719cd4ad16fe48da843",
 "paths":[{"root_id":"dfcd1840f5dab439cd9d7050aa5bafd0",
   "path":"/DATA/.system_data/.docker/containers/26be4bc.../26be4bc...-json.log",
   "mtime_ms":1784424392240}],
 "mime":"text/plain","modalities_done":{"text":"bge-m3/v1"},
 "parser_version":"parser/0.2.0","indexed_at":1784424393143,"tombstoned_at":null}],
 "missing":[]}
```

### 3.3 T0b 实跑输出

```
Qdrant query: 40 points, scores 0.737986 … 0.730946
wrote F0-qdrant-points.REAL.json  124715 bytes
wrote F5-search-text.nonempty.REPLAYED.json  53467 bytes
F5: files=1 hits=8 preview lens=2296,2333,2295,2294,2297,2296,2295,2296
```
🔴 **`preview lens` 是 2296/2333/… 而不是 T0 第一版那种齐刷刷的 400** —— 那 400 是 T0 未申报的人工截断,
T0b 已按整改方案 **(甲)** 去掉,见 `README.md` §3 与 `../p5e-task-0b-report.md` §2。

---

## 4. F0b + F5b —— 多文件场景(**含 2 处手工设计,逐条申报**)

### 4.1 取全量真点(命令)

```bash
# 🔴 必须翻页翻到底 —— 单次 limit 只回一页。T0 第一版就是在这里栽的(见 §7)
OFFSET=null
curl -s -X POST http://127.0.0.1:6333/collections/text_chunks/points/scroll \
  -H 'Content-Type: application/json' \
  -d '{"limit":1000,"with_payload":true,"with_vector":false}'
# 响应里的 result.next_page_offset 非 null ⇒ 带 {"offset": <它>} 再发一次,直到为 null
```
脚本里的 `scrollAll()` 就是这个循环。**T0b 实跑:5592 点 / 7 个 file_id**(翻 6 页)。

### 4.2 🔴 手工成分(2 处,一条不漏)

| # | 手工的是什么 | 落在哪里申报 |
|---|---|---|
| **(1)** | **8 个 `score`** = `[0.7380, 0.7354, 0.6118, 0.6002, 0.5127, 0.5044, 0.4824, 0.4666]` —— 从本机实测区间 **0.4666–0.7380** 里取的档位代表值,目的是让 `relLevel` 三档(high/mid/low)在同一个 fixture 里都有样本。**真值分布见 `F0`:40 个点全部落在 0.7340–0.7380,三档分不开。** | `F5b._provenance` 人工成分 (1) · `README.md` §3 · 本节 |
| **(2)** | **「4 个文件 × 每文件 2 chunk」这个场景本身** —— 选点规则 = 「按 scroll 返回顺序取前 4 个 `file_id`,每个取 `chunk_no` 最小的 2 个点」。这是**设计**,不是查询结果。 | `F0b._selection` · `F5b._provenance` 人工成分 (2) · 本节 |

**除这 2 处之外**:`cite` / `mime` / `kind` / `file_id` / `preview.text` / `paths` **全部**来自真 payload
或真 Parser 回填,零截断。
`stats.total_candidates` = 源点数(8),`embed_ms` / `vector_search_ms` 沿用 §3 那次真查询的耗时
—— 🔴 **这一条也在 `F5b._provenance` 里写明了**(它不是某次真查询的候选数)。

### 4.3 T0b 实跑输出

```
Qdrant scroll (全量翻页): 5592 points across 7 file_ids
wrote F0b-qdrant-scroll-source-points.REAL.json  25202 bytes
wrote F5b-search-text.multifile.REPLAYED.json  54493 bytes
F5b: files=4 scores=0.738,0.6118,0.5127,0.4824 preview lens=2342,2317,2285,2361,2336,2379,2271,2156
```
relLevel 分布:**high 1 / mid 2 / low 1**(按 `relLevel` 的 0.65 / 0.50 两个阈值)。

---

## 5. F0c + F6 / F6b —— `GetChunkWindow`(命令)

```bash
# 取该 file_id 的全部 body chunk(同样必须翻页翻到底)
curl -s -X POST http://127.0.0.1:6333/collections/text_chunks/points/scroll \
  -H 'Content-Type: application/json' \
  -d '{"limit":1000,"with_payload":true,
       "filter":{"must":[{"key":"file_id","match":{"value":"dce79e8ea5d48719cd4ad16fe48da843"}}]}}'
```
然后按 `service/authz.go:118-145` 过滤:`kind` 相同 **且** `chunk_no ∈ [anchor-W, anchor+W]`,升序。

- **`F6`**:`anchor = 2387`(= `F5` 首个文件首个 chunk 的 `chunk_no`),`W = 2` → 取到 **5 条 `2385..2389`**。
- **`F6b`**:`anchor = 1`(挑选规则 = **第一个「窗口内 ≥4 条」的 `chunk_no`**,机械规则,非手工挑),
  `W = 2` → 窗口 `[-1, 3]` 但 `chunk_no` 从 0 起 → 只取到 **4 条 `0..3`**
  ⇒ 正好钉住「后端只按区间过滤 + 升序,**不保证条数 = 2W+1**」。

### 5.1 T0b 实跑输出

```
Qdrant scroll (file_id=dce79e8ea5d4…, 全量翻页): 3448 points
  body chunk_no: 3448 个, 0…3447, 连续=true
wrote F0c-qdrant-chunkwindow-source-points.REAL.json  28822 bytes
F6:  anchor=2387 chunk_nos=[2385,2386,2387,2388,2389] text lens=[2396,2343,2296,2343,2397]
F6b: anchor=1    chunk_nos=[0,1,2,3]                  text lens=[2342,2317,2347,2354]
```
🔴 **`连续=true`** —— 见 §7 的第 4 类未申报加工:T0 第一版写的「真机 `chunk_no` 不连续(4,5,6,8)」是**错的**。

---

## 6. F12 —— anchor 缺席(CONSTRUCTED,补评审 Minor-7)

本机**没有**真样本:`F6`(anchor 2387 ∈ chunks)与 `F6b`(anchor 1 ∈ chunks)两个真窗口都包含 anchor。
`F12` 按 **D-6 模具**构造:`anchor_chunk_no = 2387`,`chunks = [2386, 2388]`(邻居在、anchor 不在)。

**为什么这是后端真会产生的响应**(构造依据,不是凭想象):
`GetChunkWindow` 把请求里的 `chunk_no` **原样回显**成 `anchor_chunk_no`(`authz.go:146-148`),
而 `chunks` 只保留「`kind` 相同 且 落在窗口内」的点(`:120-125`)——
若 anchor 那一条被 re-chunk / tombstone 掉而邻居还在,anchor 就不在 `chunks` 里。
⇒ 蓝本 `FileDetailDrawer.vue:156` 的 `find(x => x.chunk_no === r.anchor_chunk_no)` 得 `undefined`
→ 落到 `:157` 的 `(anchor && anchor.text) || c.snippet || ''`。**这是那条兜底分支的唯一样本。**

---

## 7. 🔴 T0 第一版的 4 类问题与 T0b 的处置(留痕,别再犯)

| # | 问题 | T0b 处置 |
|---|---|---|
| 1 | `replay.md` 根本不存在(评审 Imp-1) | 本文件 |
| 2 | 正文被齐刷刷截断成 400/320/600 字,**未申报**(评审 Imp-2 证据 A) | **方案(甲)**:重放不截断;`verify-fixtures.mjs` 加了一条「长度不许是齐刷刷整百」的断言钉住 |
| 3 | `F5` 的 `hits[6]/[7]` 在 `F0` 里无对应项(评审 Imp-2 证据 B) | 真因:`F0` 当时只存了 40 个点里的**前 6 个**。现在 `F0` 存**全部 40 点** ⇒ 8 条 hit 全部可溯 |
| 4 | 🔴 **T0b 自查新发现**:`F6` 的窗口只有 1 条、`F6b` 是 `[4,5,6,8]`,并据此在 README §2 与附录 D 写了「真机 `chunk_no` 不连续」 | **纯属 Qdrant scroll 分页假象** —— T0 用单次 `limit:1000`,只拿到该文件 3448 个点的第一页。现在 `scrollAll()` 翻页到底,实测 `chunk_no` **0…3447 完全连续**。README §2 与附录 D 的相应表述已订正 |

**T0b 未再发现第 5 类。** 逐字段自查见 `scripts/verify-fixtures.mjs`(4 大类 60+ 条断言,exit 0)。

---

## 8. 分析脚本(非 fixture)—— 10/10 可跑

`scripts/_inputs.mjs` 是 T0b 新增的共享输入层:蓝本走 `git -C <NimoOS-UI> show 7a6ee6b7:<path>`
(**只读 git object,永不 checkout**),本仓文件直接读工作树,i18n 全表用 **esbuild 转译后真实模块导入**
(治理 §9.3-2:文本解析会少算)。⇒ **从干净检出 `node <script>` 即可跑通,零手工准备。**

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI/.superpowers/sdd/p5e-fixtures/scripts
node scan-p5e.mjs        # 63 distinct(53 静态并集 + 1 util + 9 动态)
node lookup.mjs          # zh 63/63 · en 覆盖 63/63 · en != key 的 0 条
node propose.mjs         # 复用 9 / 新增 54 · aiKbSr* 37 / aiKbFd* 16 / aiKbFv* 1 · 名字问题 0
node collide.mjs         # 双向撞车:14 / 63 个值有撞车(已排除本批自己的 63 个键)
node classes2.mjs        # 74 token = TO-MOVE 54 / ALREADY-MOVED 17 / NO-RULE 3
node sim-r8r9.mjs        # 292->347 · 常量 293->348 · NON_K 16->19(+chev/path/h-md)
node scan-i18n2.mjs      # i18n 规模各口径:407 / 424 / 462 / 465(**没有 461**)
node k48-equiv.mjs       # 534 次比对 0 处不等价
node verify-fixtures.mjs # fixture 逐字段自查,exit 0
node replay-fixtures.mjs --dry   # 重放(dry run)
```

🔴 **两个环境依赖**(缺了会给出明确报错而不是 ENOENT 堆栈):
① 只读蓝本仓 `NimoOS-UI`(自动在 `../../NimoOS-UI` 找,可用 `NIMOOS_UI_DIR=` 覆盖);
② `node_modules/.pnpm/node_modules/.bin/esbuild`(仓根 `pnpm install` 后即有)。

⚠️ **`sim-r8r9.mjs` 有基线守卫**:T2 一旦把本期段落搬进 `knowledge.scss`,它会打印红字警告并告诉你
用 `P5E_SCSS=<T2 之前版本的副本>` 重跑 —— 否则「追加后」的数字会双算。
⚠️ **`collide.mjs` / `propose.mjs` 读的是当前工作树的 i18n**:T1 落地后全表是 **1648**(1595+54−1),
`collide.mjs` 默认把本批 63 个键排除掉才能复现 T0 当时的测量;加 `--include-batch` 可看不排除的样子。
