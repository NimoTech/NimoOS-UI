# P5e · 协调者裁定(T0 之后,2026-08-05)

> **本文件对 T0 交付物与治理文件的冲突处具有权威性**:
> **上级设计 > `p5-master-plan.md` > 本文件 > 三份 `p5e-` 附录 + `p5e-fixtures/README` > `p5e-common-constraints.md` > `p5e-plan.md` > 任务 brief。**
> ⚠️ **凡用户明示裁定的压过上级设计**(P5 全期已发生 2 次 = U-1 / U-2,本文件再加 2 次 = **R1 / R2**)。
> **下游每一刀(T1–T8)都必须读本文件。** 裁定编号 **R1 起**。

---

## 一、🔴 用户 2026-08-05 明示裁定(压过治理原文,不许重新讨论)

### R1 —— NC-1 `/v3/file` 取字节:**批准方案 A**,追认偏差编号 **K52**,**K50 的禁令部分作废**

**事实(T0 实测 + 协调者独立复核,三处源码都亲自读过)**:

| 事实 | 坐标 | 复核 |
|---|---|---|
| `/v3/file` 是**裸 `http.HandlerFunc`,零 JWT 中间件**;第一行就读 `r.URL.Query().Get("token")`,**为空直接 401,在读任何 header 之前返回**;**全函数零处读 `Authorization`** | `NimoOS/route/v2.go:237-266`(`InitFile()`) | ✅ 协调者亲自读过 |
| `getHttp()` 只设 `cfg.headers.Authorization`,**从不往 query 拼 token** | `.sp8/NimoOS-Service/src/http.ts:55-61` | ✅ 亲自读过 |
| `service.file.fileUrl(path)` → `/v3/file?token=…&path=…`,**正是该端点唯一接受的形式** | `src/file.ts:65`;测试 `file.test.ts:58-65` | ✅ 亲自读过 |
| `service.file.getBytes()` 打的是**另一个端点** `/v1/file`(header 认证可用),但 `return res.data as ArrayBuffer` **不回传 `res.headers`** ⇒ **确实丢 `Content-Type`** | `src/file.ts:52-58` | ✅ 亲自读过,**K50 这半句是对的** |
| 🔴 **`inline=1` 后端真支持** | `route/v2.go:257-261`:`if r.URL.Query().Get("inline") == "1" { disposition = "inline" }` | ✅ 亲自读过 —— **治理 §4.2 那个「必须坐实」的问号:支持** |

⇒ **治理 K50 规定的落法 = 100% 401**(实测 `{"message":"token not found"}`)。
🔴 **且蓝本自己也是坏的**:蓝本 `SearchView.vue:346-355` 的注释说「auth travels in the Authorization header,
so the session token never appears in a URL」,但 Vue2 那个 axios 实例(`src/service/service.js:33-45`)
**同样只设 header** ⇒ **Vue2 搜索区的「打开原文件」与「下载」在这个后端上从来就是坏的**(既有缺陷,非本期引入)。

### 裁定(用户 2026-08-05 选定方案 A)

**落法定死如下,实现者不许自选**:

```ts
// K52 —— 蓝本 SearchView.vue:346-355 的注释想要的是「token 不进浏览器可见的 URL」,
// 而它用的 header 认证在本后端上恒 401(/v3/file 只读 ?token= query,
// 见 NimoOS/route/v2.go:239)。方案 A 保住注释的实质意图、同时真机可用。
const url = service.file.fileUrl(file.fullPath) + (inline ? '&inline=1' : '')
const resp = await getHttp().get(url, { responseType: 'blob' })
const blobUrl = URL.createObjectURL(resp.data)
```

**四条落地判据(T7 逐条自证,评审逐条复核)**:

1. 🔴 **`responseType: 'blob'` 必须钉死断言**(判据:改 `'arraybuffer'` → 必须报红;理由:blob 会从响应
   `Content-Type` 带上类型,arraybuffer 丢类型 ⇒ 新标签页变下载而非预览)。**K50 这一条的实质完整保留。**
2. 🔴 **`window.open` 打开的必须是 `URL.createObjectURL()` 产出的 `blob:` 地址,不许是 `fileUrl()` 本身**
   —— 这是隐私收益的落点:**地址栏 / 浏览历史 / Referer 里都不含 token**。
   **配反向断言:`window.open` 的实参不含 `token=`**(判据:改成直接 open `fileUrl()` → 必须报红)。
3. 🔴 **报告要引 `.sp8/NimoOS-Service/src/http.ts` 的 `withVersion()` 证明 `/v3/file?…` 不会被改写成
   `/v1/v3/file`**(`/^\/v[1-9]/` 原样放行)—— 承 K50 原有的这条自证要求,**不因换落法而免除**。
4. 🔴 **`inline` 参数照抄蓝本语义**:`{inline:true}` → URL 含 `&inline=1`;否则 **URL 里没有 `inline`**(两条用例)。
   ✅ 后端**真支持**(上表),所以「打开原文件」在新标签页是**预览**不是下载。

**K50 的处置(精确到句,不许扩大解释)**:

| K50 原文 | 处置 |
|---|---|
| 「走 `getHttp()`,不改 Service 包」 | ✅ **继续有效**(方案 A 仍走 `getHttp()`;Service 仓仍零改动) |
| 「`responseType: 'blob'`」 | ✅ **继续有效,且是硬断言** |
| 「🔴 不许用 `service.file.getBytes()`」 | ✅ **继续有效**(理由成立:丢 `Content-Type`) |
| 🔴 「不许用 `service.file.fileUrl()`」 | 🔴 **本条作废** —— 它是该端点唯一接受的形式。**改为:不许把 `fileUrl()` 的结果直接交给 `window.open` / `<a href>`;只许把它当那一次 XHR 的 URL。** |
| 「测试侧 mock 形态照 `src/files/stores/files.test.ts:17`」 | ✅ 继续有效 |

**已知代价(用户已知情并接受)**:token 会出现在**那一次后台 XHR 的 query** ⇒ 进**服务端访问日志**。
本仓已有同族欠账(记忆:「终端 WS token 进访问日志」后端票),**不新开票,并入那张**。
**不进**浏览器地址栏 / 历史 / Referer。

**登记**:偏差 **K52**(K46–K51 已占用)· 勘误 **E-59**(治理 K50 的 `fileUrl` 禁令基于「该端点接受 header 认证」这个
**不成立的前提**)· 影响刀 = **T7**(唯一写 `fetchBlobUrl` 的刀)。**T1–T6 不受影响。**

---

### R2 —— NC-2 本机搜索恒零结果:**批准 (a) + (c)** —— 结果半区**不列真机验收项**,另开后端票

**事实(T0 实测 + 协调者复核 README §3 的证据链)**:

| 事实 | 值 |
|---|---|
| Qdrant `text_chunks` 总点数 | **5592** |
| 其中 `root_ids` 含 `dfcd1840f5dab439cd9d7050aa5bafd0` | **5592**(全部) |
| 其中 `root_ids` 含 `photos` | **0** |
| 核心 `GET /v1/nimoos/search-roots?user_id=<任意>` | **`{"root_ids":["photos"]}`** |

链路:`NimoOS-Search/route/v1/text.go:34` 拿 `allowed=["photos"]` → `service.ApplyScope` 求交集
(用户未传 `root_ids` 时返回 `allowed` 全集 ⇒ **非空,不会短路、不会有 warning**)
→ Qdrant 按 `root_ids ANY ["photos"]` 过滤 → 命中 0 → `total_candidates: 0`、`warnings: []`。
**看起来就是「没搜到」,没有任何提示。**

🔴 **根因 = 用户已拍板的 D1(Wiki 后端本期不动)在搜索链路上的连带后果** ——
授权表由 Wiki 侧对账写入(`NimoOS/route/v1/rootgrants.go` 的 `UpsertGrant` 把 `source` 写死成 `"wiki"`),
Wiki 打不通 ⇒ 除 `NimoOS/main.go:96` 播种的虚拟根 `"photos"`,零真实 root 被登记。
**不是前端问题,也不是 P5e 引入的。**

### 裁定(用户 2026-08-05 选定 (a)+(c))

1. 🔴 **结果半区按 D1 同款政策处理**:**界面做完整 · 逻辑照抄 · 不列真机验收项 · 不为打不通的链路编造 fixture**
   (非空 fixture 用 T0 的 `.REPLAYED`,见下 R3)。
   验收 = **单测 + 逐行对标蓝本 + 明暗两档界面走查**。
2. **验收清单只写本机真可达的**:`idle` / `loading` / **`empty`(无结果态,本机 100% 的真机路径)** /
   `error` 四态 + **高级面板**(点「Advanced」)+ **`?q=` 深链** + rail 第 2 项导航路径。
   🔴 **不许列**:结果卡 · 五个类型色标签 · 相关度徽标 · 「还有 N 段」· 详情抽屉 · chunk 列表 · chunk 阅读器 ·
   「沉淀成笔记」· in-app 预览器 · 「打开原文件」· 「下载」· 「复制内容」· rerank 警示条。
   ⚠️ **验收清单必须写明「这些屏本机不可达的原因是 D1 的连带后果,不是缺陷」** —— 否则机主会当 bug 报。
3. 🔴 **不许开 root grant** —— 用户否掉了 (b)。**任何一刀不得执行那条 `PUT /v1/nimoos/_internal/root-grants/…`**
   (会改设备授权状态、让系统日志对所有登录用户可搜,且文件名索引 watcher 的写入不像 DELETE 那样干净可逆)。
4. **另开后端票「搜索链路授权根缺失」**(与 Wiki 运维票同族)—— 见 §三。

**连带**:治理 §9.11 的 11 项可点性清单里,**只有 `k-adv-panel` / `k-empty`(无结果)/ `?q=` 深链 / 筛选真生效
四项在本机可验**;其余 7 项按本裁定第 2 条**从验收清单移除**(附录 D §D.10 的 23 项表同此口径)。

---

## 二、🔴 T0 交付物的可用性裁定

### R3 —— `.REPLAYED` fixtures **批准作为 T3/T5/T7 单测的地基**(条件:评审复核通过)

T0 无法端到端抓非空响应体(R2 的根因),改用「**真数据 + 权威 Go 代码路径逐行重放**」:
chunk 级字段 ← 真 Qdrant payload(`F0`,真 bge-m3 向量查询)→ 经 `NimoOS-Search/service/search.go` 的
`buildHitFromPayload`(`:298-337`)/ 排序分组(`:205-231`)/ `paths`+`mime` 回填(`:243-259`,**真 Parser**
`GET :8283/v1/parser/_internal/files?file_ids=…`)/ `files[]` 组装(`:263-290`)。

**批准理由**:它**不是手编 fixture**(记忆 `newui-fixture-from-imagination-trap` 管的是「凭想象造响应体」),
每个字段都有真实出处或权威代码路径;唯一人工选值(`F5b` 的 8 个 `score`,取自本机实测区间 0.4666–0.7380
的档位代表值,目的是让 `relLevel` 三档在同一 fixture 里都有样本)**已显式申报**。

🔴 **三条约束**:
1. **三级出处标签(`.REAL` / `.REPLAYED` / `.CONSTRUCTED`)在测试注释里必须逐个写明**,不许混用成「真机数据」。
2. `.CONSTRUCTED` 两个(`F10` `cite.page` 含 `page:0` 陷阱 · `F11` `rerank_unavailable`)是 **D-6 模具** ⇒
   🔴 **不许当成真机可达的依据**,对应验收项按 R2 第 2 条不列。
3. 🔴 **待 T0 评审对「Go 映射逐字段是否正确」的独立复核通过后本裁定才生效** —— 评审若报 Critical,本裁定随之收回。

### R4 —— 新勘误 E-54 ~ E-58:**待评审复核后逐条定案**(T1 不受阻)

T0 报了五条新勘误,协调者**暂不采信、等评审独立复核**(承 P5d「不许凭想象补一个不存在的问题、烧 46 万 token」的教训):

| # | T0 主张 | 影响刀 | 状态 |
|---|---|---|---|
| **E-54** | `/v1/search/chunk` 是 **GET** 不是治理 §4.2 写的 POST | T5 mock 形态 | ⏳ 待评审 |
| **E-55** | `p5-master-plan.md` §2.4 的 52 类**漏列 `.k-drawer-bg` / `.k-drawer`** | 🔴 **T2 的核对基准 + 白名单算式** | ⏳ 待评审(**最要紧的一条**) |
| **E-56** | **E-52 的「级联反掉」不成立** | T2 的 `.k-suggest-chip` 顺序断言 | ⏳ 待评审(⚠️ E-52 已当成「P5a 已交付产出里的真实视觉缺陷」写进跨区影响文档并告知用户) |
| **E-57** | `SearchView` 内联 style 实测 **16 处**、非协调者初测的 6 处 | T6/T7 的模板色扫 | ⏳ 待评审 |
| **E-58** | Python agent 已重部署 ⇒ distill 四条路由真机可用(**记忆经实测坐实**) | T5 fixture 策略 | ⏳ 待评审 |

**E-53 结案**(T0 主张):上级设计 §2.4 的 **461 是对的**,协调者按 `$t('…')` 单引号扫得的 **408 是扫法欠计**
⇒ **不判勘误**。✅ **方向正确**(正是 `p5e-kickoff-prompt.md` §5-1 要求的处置),**待评审复核终值后定案**。

### R5 —— 前置① 的结论订正:**验收清单写条件句,不写「17 秒」**

T0 实测:`/v1/ai/search/text` **通**;首搜**热态 5.04 s**(`embed_ms 5027`),之后 <1 s,Parser RSS 仅 **+19 MB**。
⇒ 上级设计 §4 的「**16.7 s / 2.8 GB**」对应的是**冷进程首次懒加载 BGE-M3**,当前进程已热。
🔴 **验收清单必须写条件句**:「若 Parser 刚重启过,第一次搜索可能要等十几秒(BGE-M3 懒加载),**不是卡死**;
已热的进程约 5 秒内返回」。**不许照抄「约 17 秒」当无条件事实,也不许因为实测 5 秒就把这条从清单里删掉。**
探测全程只读,设备状态前后逐字相同。

### R6 —— 前置② 的结论:distill **接口通、但按钮本机不可达**,**仍不列真机验收项**

T0 实测三条 GET 全 200 ⇒ **上级设计 §6.4 的 404 风险已解除,记忆「08-01 已重部署」经实测坐实**(E-58)。
🔴 **但按钮本机仍不渲染**:`canDistill = isDistillableName(file.name)`,而本机 7 个索引文件全是 `.log`/`.json`,
**一个都不在 `DISTILL_EXTS` 里**;叠加 R2(结果区整体不可达)⇒ **双重不可达**。
⇒ **不列真机验收项,理由写「元素不渲染(§9.11 可点性)」,不是「接口不通」** —— 两个理由的区别要写清,
否则将来有人以为是后端问题。**T5 的 distill fixture 用 `F7-distill.REAL.json`(真抓,成功 POST 那条除外)。**

---

## 三、本期记账(不在 P5e 范围,新开/并入)

| # | 事 | 处置 |
|---|---|---|
| **票 C(新)** | 🔴 **搜索链路授权根缺失** —— Qdrant 5592 向量全在 `dfcd1840…` 根下,而 `search-roots` 只返虚拟根 `["photos"]`,交集恒空 ⇒ **整机语义搜索恒零结果且无任何警告**。授权表只由 Wiki 对账写入(`rootgrants.go` 的 `source` 写死 `"wiki"`),Wiki 挂 ⇒ 零真实 root | **新开票**,与 **Wiki 数据库运维票**同族(用户 R2 批准)。⚠️ 建议与 Wiki 票**一起做**,因为修 Wiki 才是根因 |
| **票 D(新)** | 🔴 **Parser rerank 端点 500** —— `POST :8283/v1/parser/rerank` 实测 HTTP 500,根因 `parser/model_reranker.py:50` → `AttributeError: XLMRobertaTokenizer has no attribute prepare_for_model` = Parser venv 里 `transformers` 与 `FlagEmbedding` 版本不兼容。**既有后端缺陷,与 P5e 无关** | **新开票**。⚠️ 连带:`service/search.go:176` 是 `if req.Rerank && len(hits) > 0`,本机 `len(hits)` 恒 0 ⇒ rerank 分支根本不进 ⇒ `.k-rerank-warn` 双重不可达 |
| **并入既有票** | K52 的「token 进服务端访问日志」 | 并入记忆里那张「终端 WS token 进访问日志」后端票,**不新开** |
| 票 A / 票 B | Agent 语义搜索卡补 `notes` 分组 · `color-guard` 盲区收口 | **维持转独立票**(`docs/superpowers/2026-08-05-sp8-p5-cross-area-impacts.md` §1) |
| **A-1/A-2/A-3** | 把两张独立票 + 5 处上级设计订正 + P5a 视觉缺陷登记进 roadmap 与上级设计 | 🔴 **执行时机 = `sp8-ai` 合 master 那一刻**(仍待用户拍板)。**本期新增:票 C / 票 D / R1 的 E-59 也要一并登记** |

---

## 四、随本裁定生效的基线

- **三门起点**(T0 自测):`Test Files 331 passed (331)` / `Tests 3958 passed (3958)` / `vue-tsc` exit 0 / `vite build` exit 0,**零红项**。
- `.vue` 总数 **182** · `color-guard` 用例数 **184** · `KIcon.PATHS` **42**(本期用到的 13 glyph 全在,**不许往 `KIcon.vue` 里加**)。
- **`inline=1` 后端支持** ✅(R1 上表)—— 治理 §4.2 那个问号已答。
- **`/v1/search/chunk` 的动词以 E-54 的评审复核为准**(T5 开工前必须已定案)。
- **`src/` 零改动 · Service 仓零改动 · 零新依赖 · 未部署 · 未 push · 未合 master**(T0 已自证)。
