# P5e fixtures —— 后端实测响应体(T0 产出)

> 实测于 **2026-08-05**,设备 = 本机。**具体计数有保质期**(治理 §13-2)——
> 下面每一节都附了取数命令,用之前先现测一遍。
>
> 🔴 **纪律(记忆 `newui-fixture-from-imagination-trap`,本档已栽三次)**:
> - 文件名后缀 **`.REAL.json`** = 端到端真抓,逐字节原样落盘,**可直接抄进测试**。
> - 文件名后缀 **`.REPLAYED.json`** = **真数据 + 权威代码路径重放**(见 §3 为什么必须这样)。
> - 文件名后缀 **`.CONSTRUCTED.json`** = **按接口构造的最小样本**(D-6 模具)。用它必须
>   在测试注释里写明「本机无真样本 + 字段形状的权威源 `file:line`」。
> - **用法照 P5c §4.4**:抄进测试 + 注释标出处 + 程序化逐字节等价校验,
>   **不许在运行时读 `.superpowers/`**(那个目录不进构建产物)。
> - 🔴 **抄进测试时删掉所有 `_` 前缀的键**(台账元数据,后端从不下发)—— 见 §3.3。
> - 🔴 **复现看 `replay.md`**;改完 fixture 必须跑 `scripts/verify-fixtures.mjs`(exit 0)。

---

## 0. 文件清单

| 文件 | 端点 | 性质 |
|---|---|---|
| `F0a-parser-embed.REAL.json` | `POST :8283/v1/parser/embed` | REAL —— 真 bge-m3 向量(落盘后重放不依赖模型权重) |
| `F0-qdrant-points.REAL.json` | `POST :6333/collections/text_chunks/points/query` | REAL —— **全部 40 个原始点、payload 零截断**(`F5` 的原料;`F5` 每条 hit 都能溯回这里) |
| `F0b-qdrant-scroll-source-points.REAL.json` | `POST :6333/…/points/scroll`(全量翻页) | REAL —— `F5b` 的 8 个源点,payload 零截断 |
| `F0c-qdrant-chunkwindow-source-points.REAL.json` | 同上,`filter: file_id` | REAL —— `F6`/`F6b` 的源点,payload 零截断 |
| `F1-search-text.empty.REAL.json` | `POST /v1/search/text` | REAL —— 空结果信封(**本机 100% 的真机路径**) |
| `F2-search-text.rerank-true.empty.REAL.json` | 同上,`rerank:true` | REAL |
| `F3-search-text.filtered.empty.REAL.json` | 同上,带 `mime_prefix` + `mtime_after_ms` | REAL |
| `F4-search-text.no_accessible_roots.REAL.json` | 同上,`filters.root_ids` 交集为空 | REAL —— **唯一真抓到的 `warnings` 非空样本** |
| `F5-search-text.nonempty.REPLAYED.json` | 同上 | REPLAYED —— 单文件 8 chunk,**零人工成分**、正文零截断 |
| `F5b-search-text.multifile.REPLAYED.json` | 同上 | REPLAYED(**含 2 处已申报人工成分**)—— 4 文件 / 8 chunk / relLevel 高中低各有(T3/T7 首选) |
| `F6-search-chunk.window.REPLAYED.json` | `GET /v1/search/chunk` | REPLAYED —— **满窗口 5 条 `2385..2389`,anchor 2387 居中**(T5 测 prev/next 首选) |
| `F6b-search-chunk.window-multi.REPLAYED.json` | 同上 | REPLAYED —— **4 条 `0..3`,anchor 1 贴着下界 ⇒ 条数 < 2W+1**(钉住「不保证条数」) |
| `F7-distill.REAL.json` | `:8282/agent/notes/distill/*` | REAL(成功 POST 那一条除外,见 §6) |
| `F8-v3file.REAL.json` | `GET /v3/file` | REAL —— **401,含 K50 阻塞点的全部证据** |
| `F9-parser-and-roots.REAL.json` | Parser / 核心 / Qdrant | REAL —— 设备现状全景 |
| `F10-page-branch.CONSTRUCTED.json` | `POST /v1/search/text` | CONSTRUCTED —— `cite.page` 非空(含 `page: 0` 陷阱) |
| `F11-rerank-warning.CONSTRUCTED.json` | 同上 | CONSTRUCTED —— `warnings:["rerank_unavailable"]` |
| `F12-search-chunk.anchor-absent.CONSTRUCTED.json` | `GET /v1/search/chunk` | CONSTRUCTED —— **anchor 不在 `chunks` 里**(补评审 Minor-7;`FileDetailDrawer.vue:157` 兜底分支的唯一样本) |

---

## 1. 🔴 走得通的取数路径(治理 §4.2 要求写进本 README)

**结论:两个搜索端点都要绕过网关、绕过 NimoOS-AI,直连 Search 服务并自己带 `X-NimoOS-User-ID`。**

| 想打 | 实际怎么打 | 依据 |
|---|---|---|
| `POST /v1/ai/search/text` | `POST http://127.0.0.1:<search端口>/v1/search/text` + `X-NimoOS-User-ID: 1` | NimoOS-AI 的 `SearchProxy.Proxy`(`NimoOS-AI/route/v2/search_proxy.go:24-33`)把 `/v1/ai/search/<rest>` **原样改写成 `/v1/search/<rest>`**,只转发 `X-NimoOS-User-ID` / `X-NimoOS-User-Name` 两个头 |
| `GET /v1/ai/search/chunk` | `GET http://127.0.0.1:<search端口>/v1/search/chunk?file_id=…&kind=…&chunk_no=…&window=…` + 同一个头 | 同上。🔴 **是 GET + query,不是 POST** —— 治理 §4.2 把它写成 `POST /v1/ai/search/chunk body={…}` 是错的(勘误 **E-54**);后端 `NimoOS-Search/route/v1/chunk.go:13` 是 `e.GET`,共享包 `NimoOS-Service/src/ai.ts:584-586` 也是 `http.get(..., { params })` |

**为什么不能经网关 / 不能直接打 AI**:
- `curl http://127.0.0.1:<ai端口>/v1/ai/search/text` → **HTTP 400 `{"message":"missing or malformed jwt"}`**(实测)。
  上级设计 §6.5 已写明 **NimoOS-AI 对 localhost 也强制 JWT**。
- 网关**不注入** `X-NimoOS-User-ID`(记忆 `gateway-no-userid-injection`;顶层 `CLAUDE.md` 那句是错的)。
- Search 服务**自己不校 JWT**,只读上游注入的 `X-NimoOS-User-ID`(`route/v1/text.go:33`)→ 直连即可。

```bash
# 端口现测(随机端口,每次重启都变)
SEARCH=$(cat /var/run/nimoos/search.url)     # 例:http://127.0.0.1:38839
NIMOOS=$(cat /var/run/nimoos/nimoos.url)     # 例:http://127.0.0.1:37659
AI=$(cat /var/run/nimoos/ai.url)
PARSER=http://127.0.0.1:8283                 # 固定端口
AGENT=http://127.0.0.1:8282                  # 固定端口

# F1 / F2 / F3 / F4
curl -s -m 180 -X POST "$SEARCH/v1/search/text" \
  -H 'Content-Type: application/json' -H 'X-NimoOS-User-ID: 1' \
  -d '{"query":"figure skating","filters":{},"top_k":10,"rerank":false,"group_by_file":true,"max_chunks_per_file":8}'

# F6 —— 注意是 GET
curl -s -m 60 -H 'X-NimoOS-User-ID: 1' \
  "$SEARCH/v1/search/chunk?file_id=<file_id>&kind=body&chunk_no=0&window=2"

# F7
curl -s -H 'X-User-Id: 1' "$AGENT/agent/notes/distill/status"
curl -s -H 'X-User-Id: 1' "$AGENT/agent/notes/distill/jobs?limit=3"

# F9
curl -s "$PARSER/v1/parser/control/state"; curl -s "$PARSER/v1/parser/stats"
curl -s "$NIMOOS/v1/nimoos/search-roots?user_id=1"
curl -s -X POST 'http://127.0.0.1:6333/collections/text_chunks/points/count' \
  -H 'Content-Type: application/json' -d '{"exact":true}'
```

---

## 2. 🔴 六个必答的字段级问题 —— 逐个回答

| # | 问题 | 答案 | 权威源 |
|---|---|---|---|
| ① | 顶层到底有 `files[]` 还是只有 `hits[]`?**N45 哪条分支是真机路径?** | **两个都有,但 `files` 带 `omitempty`。** `hits` 恒存在(无 `omitempty`);`files` **只在 `group_by_file:true` 且有结果时出现**。`knowledgeStore.runSearch` 恒发 `group_by_file:true`(`knowledgeStore.ts:554`)→ **有结果时 `resp.files` 分支是真机路径;零结果时 `files` 整键消失、走 `groupHits(resp.hits\|\|[])` 得 `[]`**。⚠️ 后端注释明写「consumers should prefer Files when present (len > 0)」,与蓝本 `(resp.files && resp.files.length) ? resp.files : groupHits(...)` 完全同源 | `NimoOS-Search/service/search.go:68-73`(`SearchResponse`)、`:263-290`(分组组装)、`:293` 的注释 |
| ② | `paths[0].mtime_ms` 字段名与**单位** | 字段名就是 **`mtime_ms`**,单位 **毫秒**(Go `int64`)。真实值样本 `1784424392240`(= 2026-07 的毫秒时间戳;当秒解读会落到 1970-01-21)。🔴 **与 P5d 的 `relativeTime(unixSec)` 是秒完全相反** | `NimoOS-Search/service/parser_client.go:139-143`(`FilePath`)+ `F9` 的真实值 |
| ③ | `mime` 的真实取值分布 → **N35 的筛选真生效吗?** | 🔴 **本机 7 个已收录文件 `mime` 全是 `text/plain`**,`application/pdf` / `text/markdown` / `text/x-source` / `text/markdown+docling/*` **一条都没有**。→ `MIME_PREFIXES` 里只有 `txt: ['text/plain']` 这一条在本机能命中;取消勾选 TXT 以外任何一类都不会改变(空的)结果集。**N35「不许补全 docling 变体」照抄不改的结论不变**(那是后端 mime 取值的既有事实) | `F9._all_7_indexed_files` / `F9._mime_distribution` |
| ④ | `chunks[].cite.chunk_no` / `cite.page` 是否存在?`page` 为空时是 **null 还是缺字段**? | **`/v1/search/text` 侧**:`chunk_no` 是 `int`(**恒存在,`0` 是合法值**);`page` 是 `*int` 且 **无 `omitempty`** → **键恒存在,空时是 `null`**。**`/v1/search/chunk` 侧相反**:`page`/`offset_start`/`offset_end` 都带 `omitempty` → **空时整个键消失**。🔴 两个端点口径不同,mock 别互抄 | `service/search.go:46-53`(`Cite`)vs `service/authz.go:88-101`(`ChunkContextChunk`) |
| ⑤ | `chunks[].preview.text` 字段名 | **`preview.text`**,类型 `*string`,**无 `omitempty` → 键恒存在**,空串/缺失时是 `null`(`stringOrNilFromAny` 把 `""` 也变成 `nil`)。同层还有恒存在的 `preview.thumbnail_url`(本机恒 `null`) | `service/search.go:55-58`、`:339-347` |
| ⑥ | `score` 的量纲 → **`relLevel` 的 0.65 / 0.50 在真机上分得开档吗?** | **分得开。** score = bge-m3 **dense 余弦相似度**(sparse 只做 prefetch,最终 `Using: "dense"`)。本机实测:切题查询 **0.7340–0.7380**(→ high),完全不相关的查询 **0.4666–0.4824**(→ low),中间档可达。三档都可达 | `service/qdrant_client.go:53-88` + 本 README §5 的实测 |
| 附 | `warnings` 真会出现 `rerank_unavailable` 吗? | **本机不会**(见 §4)。真抓到的唯一非空 `warnings` 是 **`no_accessible_roots`**(`F4`) | `service/search.go:176-181`、`route/v1/text.go:39-43` |
| 附 | `chunks[]` / `anchor_chunk_no` 的真实形状 + **anchor 不在 chunks 里的兜底** | `{file_id, kind, anchor_chunk_no, chunks:[{chunk_no, text, page?, offset_start?, offset_end?}]}`。`anchor_chunk_no` **就是请求里传的 `chunk_no` 原样回显**,后端**不保证它出现在 `chunks` 里**(只按 `[chunk_no-window, chunk_no+window]` 且 `kind` 相同过滤,升序;🔴 **条数不保证 = 2W+1** —— anchor 贴着 `chunk_no` 边界时会少,见 `F6b` 的 `0..3`。⚠️ T0 第一版写的「真机 chunk_no 不连续(4,5,6,8)」是 **Qdrant scroll 未翻页造成的假象**,实测该文件 `chunk_no` **0…3447 完全连续**,详见 `replay.md` §7)。anchor 缺席时蓝本 `fetchFull` 的 `(r.chunks\|\|[]).find(...)` 得 `undefined` → 落到 `c.snippet \|\| ''`(`FileDetailDrawer.vue:156-157`),**这条兜底是可达的,要有用例** —— 本机两个真窗口都含 anchor ⇒ 用 **`F12`(CONSTRUCTED)** | `service/authz.go:103-149` |

### 🔴 `inline=1` 后端到底支不支持

**支持。** `NimoOS/route/v2.go:256-262`:
```go
disposition := "attachment"
if r.URL.Query().Get("inline") == "1" { disposition = "inline" }
w.Header().Add("Content-Disposition", disposition+"; filename*=utf-8''"+url.PathEscape(fileName))
```
`Content-Type` 由 `http.ServeFile` 按扩展名嗅探设置。→ 蓝本「打开原文件」传 `inline` 是对的,**照抄**。

### 🔴🔴 但 `/v3/file` 的**认证方式**让 K50 的落法必然 401

见 `F8`。`/v3/file` 由 `route.InitFile()`(`NimoOS/route/v2.go:237-266`)提供,是一个**裸 `http.HandlerFunc`、没有任何 JWT 中间件**,它**只读 `?token=` query 参数**:

| 请求 | 结果(实测) |
|---|---|
| 只带 `Authorization` 头 | **401 `{"message": "token not found"}`** |
| 带 `?token=bogus` | 401 `{"message": "validation failure"}`(过了存在性检查) |

→ **K50 规定的 `getHttp().get('/v3/file', { params, responseType:'blob' })` 在真机上恒 401** ——
`getHttp()` 只设 `Authorization` 头(`NimoOS-Service/src/http.ts:59-61`),**从不往 query 拼 token**。
K50 明令禁用的 `service.file.fileUrl()`(`src/file.ts:65-68`)拼出来的 `/v3/file?token=…&path=…`
**恰好是这个端点唯一接受的形式**;本仓文件区的下载/图片/媒体三处(`useFileOps.ts:93` / `ImageViewer.vue:16` /
`MediaViewer.vue:27`)全都用它。**这件事不是 T0 能拍板的 → 已在 T0 报告里报 `NEEDS_CONTEXT`。**

---

## 3. 🔴🔴 为什么 `.REPLAYED` 而不是端到端真抓 —— 本期最重要的一条

**本机 `/v1/ai/search/text` 对任何查询词都返回 `hits: []`,与查询内容无关。** 已程序化坐实:

| 事实 | 值 | 取数命令 |
|---|---|---|
| Qdrant `text_chunks` 总点数 | **5592** | `POST :6333/…/points/count {"exact":true}` |
| 其中 `root_ids` 含 `dfcd1840f5dab439cd9d7050aa5bafd0` | **5592**(全部) | 同上 + `filter.must[0] = {key:"root_ids", match:{any:["dfcd…"]}}` |
| 其中 `root_ids` 含 `photos` | **0** | 同上,`any:["photos"]` |
| 核心告诉 Search「这个用户被授权的 root」 | **`["photos"]`**(user_id 传什么都一样) | `GET $NIMOOS/v1/nimoos/search-roots?user_id=1` |

链路:`route/v1/text.go:34` 拿 `allowed=["photos"]` → `service.ApplyScope` 求交集(用户没传 `root_ids` 时
返回 `allowed` 全集,**非空 → 不会短路**)→ 交给 Qdrant 做 `root_ids ANY ["photos"]` 过滤 → **命中 0**
→ `total_candidates: 0`、`warnings: []`。**没有任何 warning 提示,看起来就像「没搜到」。**

成因:授权表由 **Wiki 侧对账**写入(`NimoOS/route/v1/rootgrants.go` 的 `UpsertGrant` 把 `source` 写死成
`"wiki"`),而 Wiki 后端按 **D1** 本期不动、当前打不通(Parser 日志里还在刷
`wiki fetch failed: ; backing off 60.0s`)→ 除了 `main.go:96` 播种的虚拟根 `"photos"`,一条真实 root 都没登记。

**这不是前端问题,也不是 P5e 引入的**,是 **D1(Wiki 后端不动)在搜索链路上的直接连带后果**。

**因此**:非空响应体无法端到端抓。`F5/F5b/F6/F6b` 的做法是 **把权威 Go 代码路径逐行重放在真数据上**:
- chunk 级字段 ← **真 Qdrant payload**(`F0`,`POST :6333/…/points/query` + 真 bge-m3 向量)
- 经 `buildHitFromPayload`(`service/search.go:298-337`)逐字段映射
- 排序 / 分组 / topK / maxChunks ← `service/search.go:205-231`
- `paths` / `mime` 回填 ← **真 Parser** `GET :8283/v1/parser/_internal/files?file_ids=…`(`service/search.go:243-259`)
- `files[]` 组装(含 `grp.Score = grp.Chunks[0].Score`)← `service/search.go:263-290`

**复现:`replay.md`(T0b 补写)+ `scripts/replay-fixtures.mjs`(一条命令全量重跑)+
`scripts/verify-fixtures.mjs`(逐字段自查,exit 0)。**

### 3.1 🔴 人工成分 —— **完整清单,一条不漏**(T0b 重写,承评审 Important-2)

⚠️ **T0 第一版这里写的是「`F5b` 的 8 个 score …… 这一处、且仅这一处是人工选值,其余每个字段都来自真响应」
—— 那句话不成立**,评审逐项查实了另外 3 类未申报加工。**本节是订正后的完整清单。**
处置采用**方案(甲)= 去掉加工**:重放不再截断、`hits` 全部可溯源;下表是**去掉之后仍然剩下的**人工成分。

| # | 哪个文件 | 人工的是什么 | 为什么保留 | 申报落点 |
|---|---|---|---|---|
| **1** | **`F5b` 独有** | **8 个 `score`** = `[0.7380, 0.7354, 0.6118, 0.6002, 0.5127, 0.5044, 0.4824, 0.4666]`,取自本机实测区间 **0.4666–0.7380** | 真值分布见 `F0`:40 个点全落在 **0.7340–0.7380**,`relLevel` 三档分不开。不造档位就没有 mid/low 样本 | `F5b._provenance` 人工成分 (1) · `replay.md` §4.2 · 本表 |
| **2** | **`F5b` 独有** | **「4 文件 × 每文件 2 chunk」这个场景本身**(选点规则 = 按 scroll 顺序取前 4 个 `file_id`,每个取 `chunk_no` 最小的 2 个点) | 本机真查询的 40 个 top hit **全在同一个文件里** ⇒ 多文件聚合没有真样本 | `F0b._selection` · `F5b._provenance` 人工成分 (2) · `replay.md` §4.2 · 本表 |
| **3** | **`F5b` 独有** | `stats.total_candidates` = **源点数 8**(不是某次真查询的候选数);`embed_ms` / `vector_search_ms` **沿用 `F5` 那次真查询的耗时** | `F5b` 的源是 scroll 不是 query,不存在诚实的 `total_candidates` | `F5b._provenance` 倒数第 2 行 · 本表 |
| **4** | `F0` | `limit: 40` 这个参数选择(`service/search.go:121-130` 的 candidates 上界是 80,取 40 足够覆盖 8 条 hit) | 减小 fixture 体积,不影响任何字段形状 | `F0._request` · `replay.md` §3.1 |
| **5** | `F6b` | `anchor = 1` 的**挑选规则**(第一个「窗口内 ≥4 条」的 `chunk_no`) | 机械规则、可复现,**不是手挑数字** | `F0c._windows` · `replay.md` §5 |

**`F5` / `F6` / `F6b` 的每一个字段都来自真响应或上表那条 Go 路径,零人工成分。**
`F5b` 除上表 3 条之外的每个字段(`cite` / `mime` / `kind` / `file_id` / `preview.text` / `paths`)同样如此。

### 3.2 🔴 T0 第一版被查实的 4 类未申报加工(留痕,别再犯)

| # | 加工 | T0b 处置 |
|---|---|---|
| 1 | `preview.text` / `chunks[].text` 被齐刷刷截断成 **400 / 320 / 600** 字,而 `buildHitFromPayload`(`search.go:298-337`)与 `GetChunkWindow`(`authz.go:126`)**全链路零截断** | **不再截断**。`verify-fixtures.mjs` 加了一条「长度不许是齐刷刷整百」的常驻断言 |
| 2 | `F5` 的 `hits[6]`/`hits[7]`(`chunk_no` 1667/3094)在 `F0` 里**无对应项** | 真因:`F0` 当时只落了 40 个点里的**前 6 个**。现在 `F0` 落**全部 40 点**,8 条 hit 全部可溯(`verify-fixtures.mjs` §1 钉死) |
| 3 | `stats.expand_ms` 曾被写成 `12`,而真抓的四个 `.REAL` 全是 `0` | 现在 `expand_ms` / `vector_search_ms` / `embed_ms` 都是**本次重放的真实耗时**,`total_candidates` = `len(F0.result.points)` |
| 4 | 🔴 **T0b 自查新发现**:`F6` 的窗口只有 1 条、`F6b` 是 `[4,5,6,8]`,并据此在 §2 与附录 D 写了「真机 `chunk_no` 不连续」 | **纯属 Qdrant scroll 未翻页的假象**(T0 用单次 `limit:1000`,只拿到该文件 3448 点的第一页)。`scrollAll()` 翻页到底后实测 `chunk_no` **0…3447 完全连续**;`F6` 变成满窗口 5 条。§2 与附录 D 的表述已订正 |

**T0b 未再发现第 5 类。** 自查覆盖面见 `scripts/verify-fixtures.mjs`(4 大类断言:溯源 / 零截断 /
与 Go struct 的键集逐个对齐 / 三级标签与出处说明),`exit 0`。

### 3.3 🔴 抄进测试时必须删掉 `_` 前缀的键

`.REPLAYED` / `.CONSTRUCTED` 与 `F0*` 里的 `_provenance` / `_request` / `_selection` / `_windows` 等
**都是台账元数据,后端从不下发**。抄进测试当 mock 时**必须删掉**。
⚠️ 例外:`F1`–`F4` 四个是**端到端逐字节真抓的纯响应体**,故意零 `_` 前缀键,可以原样抄
(`verify-fixtures.mjs` 里有显式白名单 `PURE_REAL` 钉住这一点)。

---

## 4. rerank:真机不可用,但那条 warning 仍然到不了前端

- `POST :8283/v1/parser/rerank` → **HTTP 500**(实测 0.07 s 返回)。
  根因(`journalctl -u nimoos-parser.service`):
  `parser/model_reranker.py:50` → `FlagEmbedding/.../AbsReranker.compute_score` →
  **`AttributeError: XLMRobertaTokenizer has no attribute prepare_for_model`**
  = Parser venv 里 `transformers` 与 `FlagEmbedding` 版本不兼容。**既有后端缺陷,与 P5e 无关,建议另开票。**
- **但**:`service/search.go:176` 是 `if req.Rerank && len(hits) > 0`,而本机 `len(hits)` 恒 0
  → rerank 分支根本不进,`warnings` 永远不会出现 `rerank_unavailable`。
  → `.k-rerank-warn` **在本机不可达**(见治理 §9.11 与附录 D §D.7)。fixture 用 `F11`(CONSTRUCTED)。

---

## 5. `/v1/ai/search/text` 的真实代价(前置① 的落地数据)

实测于 2026-08-05,Parser 自 08-04 10:10 起一直在跑、BGE-M3 已驻留:

| 场景 | 耗时 | 说明 |
|---|---|---|
| 当天第一次调用 | **5.04 s**(`stats.embed_ms = 5027`) | 懒加载路径 warm-up,**不是**上级设计记的 16.7 s |
| 之后每个**不同**查询词 | **0.23 – 0.38 s** | |
| **重复同一个查询词** | **0.0013 s** | Search 侧 `EmbedCache`(`HashQuery`)进程内缓存 |

内存:Parser RSS **1 295 MB → 1 315 MB**(+20 MB),`free` 可用量 8.5 G → 10.2 G(基本不变)。
**没有出现 +2.8 GB 的尖峰** —— 因为模型早已驻留。

🔴 **验收清单要写成条件句**:
- Parser **不重启**:第一次搜索 ~5 s,之后 <1 s。
- Parser **刚重启过**(冷进程):回到上级设计 §6.1 记的 **≈16.7 s 首调 + RSS 涨到 ≈2.8 GB**。
  验收前先 `curl $PARSER/v1/parser/stats` 探一下,或直接用一个查询预热。

**怎么恢复**:不需要恢复。本节探测只做了读操作;`paused=true` 未变、`queue_depth` 前后逐字相同
(`{"pending":339,"running":1,"failed":0,"done":9}`)、`indexed_files` 7、`total_vectors_text` 5592。
Search 的 EmbedCache 是**进程内**结构,无持久化。

---

## 6. 会写后端的探测 —— 做了什么、怎么恢复

| 探测 | 写不写后端 | 恢复 |
|---|---|---|
| `POST /v1/search/text` ×若干 | ❌ 只读 | — |
| `GET /v1/search/chunk` | ❌ 只读 | — |
| `POST :8283/v1/parser/embed` ×2 | ❌ 只读(模型驻留) | 不需要,见 §5 |
| `POST :8283/v1/parser/rerank` ×1 | ❌ 只读(且 500) | — |
| Qdrant `points/query` / `points/scroll` / `points/count` | ❌ 只读 | — |
| `GET :8282/agent/notes/distill/{status,jobs}` · `/settings` | ❌ 只读 | — |
| `POST :8282/agent/notes/distill` ×3 | ❌ **全部在写库之前就被挡回**(403 ×2 / 404 ×1;`main.go:2736-2739` 的两道门在 `enqueue()` 之前) | 不需要。探测后复核 `/distill/jobs` = `{"jobs":[],"counts":{"pending":0,"running":0,"failed":0}}`,与探测前逐字相同 |
| **成功的 `POST /agent/notes/distill`** | 🔴 **会写**(`notes_distill_jobs` 插一行 + 后台可能在 `/DATA/Notes` 生成 `.md`) | **本次刻意没做** —— 见下 |

🔴 **申报:DoD-10 要求「distill 逐个落真响应体」,成功那一条我没抓。** 理由三条:
1. 它会往 `notes_distill_jobs` 插一行**不可干净回收**的记录(`cancel` 只把 `status` 改成 `skipped`,行仍留着),
   并可能触发后台生成 `/DATA/Notes/*.md`;
2. 成功体的形状在权威源里是**一行字面量** `return {"queued": True}`(`NimoOS-AI/agent/main.py:2746`),
   零歧义;
3. 治理 §4.1 明写这个 mock **「mock 成什么都行」**(蓝本 `distillToNote` 只 `await`、不读返回值),
   真抓与照源写对 T5 的判别力完全等价。
→ 已按 **D-6 模具**登记在 `F7-distill.REAL.json` 的 `_provenance` 字段里。
**若协调者/用户要求真抓,恢复步骤**:`POST /agent/notes/distill/jobs/cancel {path}` →
`sqlite3 /var/lib/nimoos/ai/agent/agent.db "DELETE FROM notes_distill_jobs WHERE file_path='<path>'"` →
删掉 `/DATA/Notes` 下新生成的 `.md` 与笔记区那条草稿。

---

## 7. 每个 fixture 归哪一刀用

| 刀 | 用哪个 | 干什么 |
|---|---|---|
| **T3** `searchAggregate.ts` | `F5b`(首选)· `F5` · `F1`(空)· `F10`(page 分支 + `page:0` 陷阱) | `toFileResults` 两条分支 · `kindFromMime` 六分支 · `basename`/`dirname` · `chunkVM` 边界 · `fmtMtime` 毫秒 |
| **T5** `FileDetailDrawer.vue` | `F6`(满窗口 5 条,测 prev/next 首选)· `F6b`(条数 < 2W+1 的边界)· 🔴 **`F12`(anchor 缺席兜底的唯一样本,CONSTRUCTED)** · `F5b` · `F7`(distill,🔴 **GET 不是 POST,见 E-54**) | `fetchFull` 的 `r.chunks`/`r.anchor_chunk_no`/`x.chunk_no`/`anchor.text`(**全 snake_case**)· anchor 缺席兜底 · distill 传 `fullPath` |
| **T6/T7** `SearchView.vue` | `F1`(empty 态)· `F5b`(results 态)· `F11`(rerank warn)· `F4` | 四态 · `buildFilters` 三档 · 过期守卫交错 |

🔴 **mock 打在哪一层**(治理 §4.1,已复核为真):
`store.runSearch(...)` / `store.loadChunkContext(...)` **返回后端原始 snake_case**
(`knowledgeStore.ts:550-561` / `:571-574` 零归一化,直接 `return service.ai.searchText(body)`)。
**camelCase 只在 `toFileResults` 之后出现。搞反了按 Critical 报。**
