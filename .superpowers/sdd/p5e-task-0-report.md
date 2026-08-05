# SP8-P5e Task 0 报告 —— 探测 + 三份附录 + fixtures

**状态:`NEEDS_CONTEXT`**(2 项,见 §0)· 其余 12 项 DoD 全部完成
**日期**:2026-08-05 · **可写仓**:`.sp8/NimoOS-New-UI` @ `sp8-ai` · **起点 HEAD** `ec6a000`
**产出**:`p5e-appendix-A-i18n.md` · `p5e-appendix-B-tokens.md` · `p5e-appendix-D-classes.md` ·
`p5e-fixtures/`(README + 13 个 fixture + 8 个复现脚本)· 本报告
**`src/` 零改动**(自证见 §12)· **`.sp8/NimoOS-Service` 零改动** · **零新依赖** · 未部署 / 未 push / 未合 master

---

## 0. 🔴🔴 两条 `NEEDS_CONTEXT`(必须先由协调者/用户裁定,T1 之后的刀会撞上)

### NC-1 🔴 **K50 规定的落法在真机上必然 401 —— `/v3/file` 只认 `?token=` query,不读 `Authorization` 头**

**治理 K50 原文**:
> **本仓等价落法 = `getHttp().get('/v3/file', { params, responseType: 'blob' })`** …
> 🔴 **不许用 `service.file.getBytes()`**(丢 Content-Type)· 🔴 **不许用 `service.file.fileUrl()`**(token 进 URL)

**实测事实**(命令与响应全部落在 `p5e-fixtures/F8-v3file.REAL.json`):

| 请求 | 结果 |
|---|---|
| `curl -H 'Authorization: <任意>' "$NIMOOS/v3/file?path=/etc/hostname"` | **HTTP 401 `{"message": "token not found"}`** |
| `curl "$NIMOOS/v3/file?path=/etc/hostname&token=bogus"` | HTTP 401 `{"message": "validation failure"}`(过了存在性检查) |

**源码坐标**:`/v3/file` 由 `NimoOS/route/v2.go:237-266` 的 `route.InitFile()` 提供 ——
一个**裸 `http.HandlerFunc`,没有任何 JWT 中间件**(`NimoOS/main.go:137` 挂进 `HandlerMultiplexer` 的
`"v3"` 键,`main.go:190` 以 `route.V3FilePath` 注册到网关)。它的第一行就是:
```go
token := r.URL.Query().Get("token")
if len(token) == 0 { … 401 "token not found" … }   // 在读任何 header 之前就返回了
```
**全函数没有任何一处读 `Authorization` 头。**

而 `getHttp()` 只设 header、**从不往 query 拼 token**(`NimoOS-Service/src/http.ts:59-61`)。
→ **K50 的落法 = 100% 401。**

**更要紧的是:蓝本自己也是错的。** 蓝本 `SearchView.vue:346-355` 的注释原文说
「auth travels in the Authorization header, so the session token never appears in a URL」,
用的是 Vue2 的 `instance.get('/v3/file', …)`,而 Vue2 那个 axios 实例
(`src/service/service.js:33-45`)**同样只设 `Authorization` 头**。
⇒ **Vue2 搜索区的「打开原文件」与「下载」在这个后端上从来就是坏的**(既有缺陷,非本期引入)。

**K50 禁的两条恰好是本仓唯一能用的两条**:

| API | 打到哪 | 认证 | 本仓现有消费点 |
|---|---|---|---|
| `service.file.fileUrl(path)` | `/v3/file?token=…&path=…` | ✅ **正是这个端点唯一接受的形式** | `useFileOps.ts:93`(下载)· `ImageViewer.vue:16` · `MediaViewer.vue:27` |
| `service.file.getBytes(path)` | **`/v1/file`**(另一个端点,`GetDownloadSingleFile` + `http.ServeContent`,走 JWT header)| ✅ 可用 | `useOfficeBytes.ts:36` · `PdfViewer.vue:55` |

⚠️ K50 说 `getBytes` 「丢 Content-Type」—— **这一条是对的**(包里只 `return res.data as ArrayBuffer`,
不回传 `res.headers`),所以拿它做「新标签页预览」确实会退化成下载。
⚠️ K50 说 `fileUrl` 「token 进 URL → 进访问日志/历史/Referer」—— **这一条也是对的**,
但这是**该端点的设计约束**,不是可以绕开的选择。

🔴 **我不自行拍板**(治理 §10 申报纪律 + 裁定 R16)。可选方案摆出如下,请协调者/用户定:

| 方案 | 做法 | 代价 |
|---|---|---|
| **A** | 改 K50:`fetchBlobUrl` 走 `getHttp().get(service.file.fileUrl(fullPath) + '&inline=1', { responseType:'blob' })`,即**保留 blob URL 的隐私收益(最终 URL 是 `blob:`,不含 token),只在那一次内部请求里带 token** | token 仍会出现在一次 XHR 的 query 里(→ 服务端访问日志);但**不进浏览器地址栏/历史/Referer**(因为打开的是 `blob:` URL)。**改动 = 附录 + K50 文字,代码只多一行** |
| **B** | 照本仓文件区先例:「打开原文件」直接 `window.open(service.file.fileUrl(path) + '&inline=1')`,放弃 blob | 最简单、与文件区一致;但 token 进**地址栏与历史**,正是蓝本注释明令要避免的 |
| **C** | 照抄 K50 原文,接受真机 401 | 「打开原文件」「下载」两个按钮真机必坏。**与「逻辑照正确」纪律冲突** |
| **D** | 改后端给 `/v3/file` 加 header 认证 | 🔴 **越界**(本期禁动后端) |

**我的建议是 A**(隐私收益基本保住 + 真机可用 + 改动最小),但**等裁定**。
在裁定前 **T7 不能开工**(它就是写 `fetchBlobUrl` 的那一刀)。

---

### NC-2 🔴 **本机搜索恒零结果 ⇒ P5e 的「结果半区」整体无法真机验收,验收政策需要用户拍板**

**实测(全部程序化坐实,证据在 `p5e-fixtures/README.md` §3 + `F9`)**:

| 事实 | 值 |
|---|---|
| Qdrant `text_chunks` 总点数 | **5592** |
| 其中 `root_ids` 含 `dfcd1840f5dab439cd9d7050aa5bafd0` | **5592**(全部) |
| 其中 `root_ids` 含 `photos` | **0** |
| 核心 `GET /v1/nimoos/search-roots?user_id=<任意>` | **`{"root_ids":["photos"]}`** |

链路:`NimoOS-Search/route/v1/text.go:34` 拿 `allowed=["photos"]` → `service.ApplyScope` 求交集
(用户未传 `root_ids` 时返回 `allowed` 全集 → **非空,不会短路、不会有 warning**)
→ Qdrant 按 `root_ids ANY ["photos"]` 过滤 → **命中 0** → `total_candidates: 0`、`warnings: []`。

成因:授权表由 **Wiki 侧对账**写入(`NimoOS/route/v1/rootgrants.go` 的 `UpsertGrant` 把 `source`
写死成 `"wiki"`),而 Wiki 后端按 **D1** 本期不动、当前打不通(Parser 日志仍在刷
`wiki fetch failed: ; backing off 60.0s`)→ 除 `NimoOS/main.go:96` 播种的虚拟根 `"photos"`,零真实 root。

**⇒ 后果(附录 D §D.10 有 23 项逐条表)**:`phase === 'results'` 整条分支不可达 →
**结果卡 / 五个类型色标签 / 相关度徽标 / 「还有 N 段」/ 详情抽屉 / chunk 列表 / chunk 阅读器 /
「沉淀成笔记」/ in-app 预览器 / 「打开原文件」/ 「下载」/ 「复制内容」/ rerank 警示条 —— 全都点不到。**
本机只有 **idle / loading / empty / error 四态 + 高级面板**可验。

🔴 **有一条完全可逆的解法,但属「写后端」,我没有做**:
核心有一个 **loopback-only** 写端点可以把 Parser 那个 root 登记成「已启用检索根」:
```bash
NIMOOS=$(cat /var/run/nimoos/nimoos.url)
# 开(会让 /DATA/.system_data 下的系统日志变得可被语义搜索)
curl -X PUT "$NIMOOS/v1/nimoos/_internal/root-grants/dfcd1840f5dab439cd9d7050aa5bafd0" \
     -H 'Content-Type: application/json' -d '{"path":"/DATA/.system_data","enabled":true}'
# 关(恢复)
curl -X DELETE "$NIMOOS/v1/nimoos/_internal/root-grants/dfcd1840f5dab439cd9d7050aa5bafd0"
# 复核
curl -s "$NIMOOS/v1/nimoos/search-roots?user_id=1"
```
**没做的理由**:① 它会**改设备授权状态**(让系统日志对所有登录用户可搜),超出「探测」范畴;
② Search 侧 `NimoOSClient` 有 **cacheTTL 缓存**,开/关都有一个生效延迟窗口;
③ **可能有我没查全的连带效应**(Search 的 `fileindex` 文件名索引 watcher 也按授权根扫,
可能往 `/var/lib/nimoos/db/search.db` 写入 `/DATA/.system_data` 下的文件名行,那部分不像 DELETE 一样干净可逆);
④ 治理明写「拿不准就写 `NEEDS_CONTEXT` 并停下,不许自行拍板」。

🔴 **请裁定**:
- **(a)** 接受现状 → **P5e 的结果半区按 D1 同款政策处理**(界面做完整、逻辑照抄、**不列真机验收项**、
  以单测 + 逐行对标 + 明暗两档走查为准);验收清单只写 idle/loading/empty/error/高级面板 + `?q=` 深链。
- **(b)** 由**用户本人**在验收当天临时开一次 root grant(上面两条命令),验完立刻 DELETE,
  这样结果半区可以真机眼验一次。**⚠️ 但即便开了,`.k-rcard-tag` 也只会出现 `TXT` 一种颜色**
  (本机 7 个文件 mime 全是 `text/plain`),且 **distill 按钮仍不渲染**(`.log`/`.json` 都不在 `DISTILL_EXTS` 里),
  **`KFileViewer` 仍不可达**(零 docx/xls/xlsx/csv)。
- **(c)** 另开一张「搜索链路授权根缺失」后端票(与 Wiki 运维票同族)。

**我不推荐 (b) 单独使用** —— 它只能点亮「结果卡 + 抽屉 + 相关度徽标」三样,其余仍不可达;
若要真机验全,还需要往某个已授权根里放一批 pdf/md/docx 并等 Parser 索引(**而 Parser 现在是 `paused`**)。

---

## 1. DoD-1 🔴 U-2 蓝本源复核(SSH fetch + 逐文件比对)

```
$ git fetch git@github.com:NimoTech/NimoOS-UI.git main
From github.com:NimoTech/NimoOS-UI
 * branch              main       -> FETCH_HEAD
$ git rev-parse FETCH_HEAD
65cfda583f2e1029dfc66f17903f0a180d9ecadc
$ git rev-parse 7a6ee6b7
7a6ee6b72b4b8184f0045c200371899a44653478
```
**远端 sha = `65cfda58`**(与 `p5-master-plan.md` §4 的 U-2 记载一致)。

### 逐文件比对(行数是我自己 `git show | wc -l` 实测的,不是照抄)

| 蓝本文件 | `7a6ee6b7` 行数 | `65cfda58` 行数 | diff 行数 | 差异性质 |
|---|---|---|---|---|
| `SearchView.vue` | **401** ✅ | 401 | 8(4 改) | **纯注释**中→英:`:329-330`(highlight 的两行说明)· `:357`(打开原文件)· `:381`(下载文件) |
| `components/FileDetailDrawer.vue` | **220** ✅ | 220 | 4(2 改) | **纯注释**:`:77` `"跳到原文位置"` → `"Jump to source location"`;`:80` `"打开原文件"` → `"Open file"`(都在 `<!-- -->` 里) |
| `components/KFileViewer.vue` | **120** ✅ | 120 | 2(1 改) | **纯注释**:`:32` `"请下载"` → `"please download"` |
| `searchAggregate.js` | **79** ✅ | 79 | **0** | 逐字节相同 |
| `styles/knowledge.scss` | **2561** ✅ | 2561 | 2(1 改) | **纯注释**:`:1675` 段头 `/* ===== 已收录文件 · Indexed Files page … */` → `/* ===== Indexed Files page … */`(⚠️ **在 P5b 的地盘,不在 P5e 的 6 段范围内**) |

🔴 **五个文件的行数与协调者给的 401 / 220 / 120 / 79 / 2561 逐个吻合。**
🔴 **零非注释差异 → 不需要停下问用户。本期蓝本锁 `7a6ee6b7` 不换。**

复现:
```bash
cd /home/nimo/NimoTech/NimoOS-UI
for f in src/views/AI/Knowledge/SearchView.vue \
         src/views/AI/Knowledge/components/FileDetailDrawer.vue \
         src/views/AI/Knowledge/components/KFileViewer.vue \
         src/views/AI/Knowledge/searchAggregate.js \
         src/views/AI/Knowledge/styles/knowledge.scss; do
  echo "== $f  locked=$(git show 7a6ee6b7:$f|wc -l) remote=$(git show 65cfda58:$f|wc -l)"
  diff <(git show 7a6ee6b7:$f) <(git show 65cfda58:$f)
done
```

---

## 2. DoD-2 🔴 三门起点基线(**自己重跑,未照抄 331/3958**)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                  > /tmp/p5e-t0-test.log  2>&1 ; echo exit=$?   # exit=0
pnpm exec vue-tsc --noEmit > /tmp/p5e-t0-tsc.log   2>&1 ; echo exit=$?   # exit=0
pnpm build                 > /tmp/p5e-t0-build.log 2>&1 ; echo exit=$?   # exit=0
```

| 门 | 结果 |
|---|---|
| `pnpm test` | 🟢 **`Test Files  331 passed (331)`** / **`Tests  3958 passed (3958)`** · `Duration 145.33s` · **exit 0** |
| `pnpm exec vue-tsc --noEmit` | 🟢 **exit 0**,日志 **0 行** |
| `pnpm build` | 🟢 **exit 0**,`✓ built in 13.79s`(唯一告警 = 既有的 `chunks are larger than 500 kB`) |

**红项:零。**(已知噪声 `persist.test.ts > dropPersisted…` 与 `AgentComposer.test.ts` 的 vue-i18n teardown
本次**都没有出现** → 没有复跑。)
→ **与协调者给的 331 / 3958 / 0 / 0 完全一致,基线确认。**

### 三个附加核数

| 项 | 协调者给 | T0 实测 | |
|---|---|---|---|
| `src/**/*.vue` 总数 | 182 | **182** | ✅ `find src -name '*.vue' \| wc -l` |
| `color-guard.test.ts` 用例数 | 184 | **184** | ✅ `Tests 184 passed (184)`;`--reporter=verbose` 数 `✓`/`×` 行也是 184 |
| `KIcon.PATHS` 键数 | **42**(E-35/E-51) | **42** | ✅ 逐键列出:`plus folder search chev check x play pause trash settings edit file drive history refresh home grid user arrowRight download hourglass spinner danger test rocket eye info target clock code chevDown chevLeft arrowDown sort tomb layers sparkle bot copy paperclip upload funnel` |

🔴 **治理 §1.2 的 13 个 glyph 复核:13/13 全在** ——
`search x settings chev play target edit folder check danger`(SearchView 10)
`+ download arrowRight`(FileDetailDrawer)`+ file`(KFileViewer)。**不需要往 `KIcon.vue` 加任何图标。**

---

## 3. DoD-3 🔴 前置① —— `/v1/ai/search/text` 的真实代价

**可用性:✅ 端点通,HTTP 200。**(路径见 §10 的取数结论:必须绕到 Search 直连。)

| 场景 | 实测 |
|---|---|
| 探测前 `free -m` | total 15579 / used 7082 / **available 8497** |
| 探测前 Parser RSS | **1 295 536 KB**(≈1.29 GB,模型已驻留) |
| **当天首次调用** | **5.036 s**(`stats.embed_ms = 5027`) |
| 之后**不同**查询词 | **0.376 s** / **0.234 s** |
| **同一**查询词重复 | **0.179 s** → **0.0013 s**(Search 侧 `EmbedCache`,`HashQuery`) |
| 探测后 Parser RSS | **1 315 040 KB**(**+19 MB**) |
| 探测后 `free -m` | available **10 264**(反而变多,是别的进程释放) |

🔴 **没有出现上级设计 §6.1 记的 +2.8 GB 尖峰,也没有 16.7 s** ——
因为 Parser 自 08-04 10:10 起一直在跑、BGE-M3 已经驻留内存。
**上级设计那两个数字对应「Parser 冷进程」**,仍然有效,只是当前状态不是冷的。

🔴 **验收清单必须写成条件句**(已写进附录 D §D.10.1):
- Parser 不重启 → 首搜 **≈5 s**,之后 **<1 s**;
- Parser 刚重启过 → 回到 **≈16.7 s + RSS 涨到 ≈2.8 GB**。

**怎么恢复:不需要恢复。** 本项探测全是读操作。设备状态前后逐字相同:
```
control/state : {"paused":true,"concurrency":2,"device":"auto","ocr_enabled":false,"resolved_device":"cpu"}
stats         : queue_depth {"pending":339,"running":1,"failed":0,"done":9} · indexed_files 7 · total_vectors_text 5592
```
(上级设计 §6.1 已证 `workers.py:84` 的 `pause()`/`start()` 之间无 await 让出点 → 队列不解冻,实测印证。)

⚠️ **但结果恒空** —— 见 §0 的 NC-2。

---

## 4. DoD-4 🔴 前置② —— distill 链路(**实测坐实,未采信记忆**)

**结论:通。** 直连 `:8282` + `X-User-Id: 1`(响应体逐字落在 `p5e-fixtures/F7-distill.REAL.json`):

| 端点 | HTTP | 响应体 |
|---|---|---|
| `GET /agent/notes/distill/status` | **200** | `{"pending":0,"distilled":0,"quota_remaining":50,"background_model":""}` |
| `GET /agent/notes/distill/jobs?limit=3` | **200** | `{"jobs":[],"counts":{"pending":0,"running":0,"failed":0}}` |
| `GET /agent/notes/settings` | **200** | `{"notes_root":"/DATA/Notes","auto_extract":true,"distill_roots":[],"distill_daily_cap":50,"background_model":""}` |

→ 上级设计 §6.4 记的「容器里 `main.py` 2765 行、`notes/distill` 命中 0 次、四条路由全 404」**已不成立**;
协调者记忆「Python agent 2026-08-01 已重部署」**经实测为真**。
🔴 **但我是先实测再看结论的,没有采信记忆**(证据 = 上面三行真响应)。

### 🔴 但 distill 按钮在本机**仍然不可达**(两个独立原因,与链路通不通无关)

1. **抽屉打不开** —— `phase === 'results'` 不可达(NC-2)。
2. **即使抽屉打开,按钮也不渲染** —— `canDistill = isDistillableName(file.name)`,
   而 `DISTILL_EXTS`(`NimoOS-Service/src/notes.ts:175-178`)=
   `.md .txt .rst .pdf .docx .doc .wps .pptx .ppt .xlsx .xls .odt .html .htm`;
   本机 7 个已收录文件的扩展名是 **`.log` ×6 / `.json` ×1**,**一个都不在里面**。

🔴 **⇒ distill 按钮不列真机验收项**(按 D1 政策),理由**不是**「接口不通」,而是「界面元素在本机数据下
不渲染成可点元素」(治理 §13-1 那条铁律)。**这一条要在验收清单里写明原因,别让机主以为是漏了。**

**fixture 策略**:错误阶梯(403 / 404)**真抓**;成功体 `{"queued": true}` **按 D-6 模具从权威源写**
(`NimoOS-AI/agent/main.py:2746`),并在 `F7` 的 `_provenance` 里登记。
🔴 **这是对 DoD-10 的一处主动申报偏离** —— 理由与恢复步骤见 `p5e-fixtures/README.md` §6
(成功 POST 会往 `notes_distill_jobs` 插一行不可干净回收的记录;而治理 §4.1 明写这个 mock「mock 成什么都行」,
真抓与照源写对 T5 的判别力完全等价)。

**已做的 3 次 POST 都被挡在写库之前**,探测后 `/distill/jobs` 与探测前逐字相同(`{"jobs":[],"counts":{…0…}}`)。

---

## 5. DoD-5 附录 A(i18n)—— 摘要

**完整表在 `p5e-appendix-A-i18n.md`。** 关键结论:

| 项 | 结论 |
|---|---|
| **63 distinct 终值** | ✅ **精确成立**。组成 = 三个 `.vue` 静态 `$t()` 去重 **53** + `searchAggregate.js` 的 `i18n.t('(Untitled)')` **1** + 动态 9(`MTIMES` 4 + `SAMPLE_QUERIES` 5) |
| 各文件静态数 | SearchView **35** · FileDetailDrawer **23** · KFileViewer **2** · searchAggregate **1**(7 处交叠 → 并集 53) |
| **zh 命中** | 🔴 **63/63 全命中 `zh_CN.json`,零自造** |
| **en 命中** | 🔴 **63/63 全有 `en_US.json` 覆盖条目**;其中 en 覆盖值 **≠** key 的:**0 条** —— 这是**实测结论**,verify 脚本仍必须从 `en_US.json` 读,不许假设「en = key」(E-31/R10/E-44) |
| **复用** | **9 个**,全在 `aiKb*` 家族:5 个 `aiKbSample*` + `aiKbTry` + `aiKbSearch` + `aiKbClose` + `aiKbStatusIndexed` |
| **新增** | **54 个**(`aiKbSr*` 37 / `aiKbFd*` 16 / `aiKbFv*` 1) |
| **拒绝复用** | 13 组同值键,逐条理由在附录 A §A.1.2。🔴 **`Mid` 那组连 en 值都不同**(`Medium` ≠ `Mid`)—— 复用会直接改掉界面文案 |
| **全角标点例外** | 命中 `/[，；：？！（）]/` 的 zh 值 **恰好 5 条**(1 个 `：` + 4 个 `，`),逐条列在 §A.2.1 |
| 不在正则里但必须逐字照抄 | `—`(em dash)· `「」` ×2 · `…` · `。` ×2 · 🔴 **`aiKbFdCopyFailed` 的 zh 用的是半角逗号 `,`**,不许改全角 |
| **占位符** | 6 个键带 `{n}`;🔴 **`aiKbFdSummary` 是本期唯一的双占位符键**(`{n}` + `{query}`)。全批零 `@` 零 `\|` → 不需要 `{'@'}` 转义 |
| **`FILE_TYPES` 5 个 label** | 🔴 **不进 i18n** —— 蓝本 `:194-200` 是裸字面量、模板 `:37` 是 `{{ t.label }}` **没过 `$t()`**。照抄字面量。⚠️ 同文件的 `MTIMES` 与 `SAMPLE_QUERIES` **过了** `$t(变量)`,别搞混 |
| 起点全表 | **zh 1595 / en 1595**(真实模块导入),`aiKb*` 家族 **387** |
| T1 的键总数预期 | 1595 + 54 − 1(§0.2 删 `aiCfgKnowledgeSoon`)= **1648** —— 🔴 **仅供对账,T1 必须实测** |

### 🔴 E-53 复扫结论:**上级设计的 461 是对的,不是勘误**

同口径(`$t('…')` 单引号)复扫蓝本 `views/AI/{Knowledge,Parser}` 全部 16 个 `.vue`,
取「至少出现在一个 `.vue` 里」的去重集 → **462**;放宽到三种引号 → 465;含 `.js` helper → 469/472。
→ **462 与 461 只差 1 条,量级完全吻合**;协调者那个 **408 是扫法欠计**
(漏了跨行 `$t(\n '…')`、`$t('…', {…})` 的多行写法、以及 `.js` helper 的 `i18n.t()`)。
🔴 **登记为「协调者口径欠计」,上级设计 §2.4 无需订正。下游不许把 461 当勘误引。**
(承 P5d「凭想象补一个不存在的问题、烧 46 万 token」的教训 —— 这里只做了复扫,**没有升级任何 finding**。)

### 双向撞车扫描

方法:**真实模块导入** `src/i18n/{zh_cn,en_us}` → 建 value→keys 反查表 → 本批 63 个值**双向**查
(zh 撞车看 en 是否不同 + en 撞车看 zh 是否不同)。脚本 `p5e-fixtures/scripts/collide.mjs`。
🔴 **协调者点名的 14 个高危同值逐条复核结果**:

| 值 | 扫描结果 |
|---|---|
| `Download` | 3 个同值键(`filesDownload` / `filesCtxDownload` / `aiResDownload`),全在别区 → 拒绝 |
| `Close` | 8 个同值键,其中 **`aiKbClose` 在家族内** → **复用它** |
| `Modified` | 🔴 **零同值键**(协调者点名但实际没撞车)→ 直接新建 `aiKbSrModified` |
| `Search` | 4 个同值键,其中 `aiKbSearch` / `aiKbNavSearch` 在家族内 → **选 `aiKbSearch`**(动作按钮语义) |
| `Results` | 🔴 **零同值键** |
| `Copied` | 2 个(`filesShareCopied` / `aiCopied`),全在别区 → 拒绝 |
| `High` | 2 个(`appsSettingsCpuHigh` / `aiThinkingHigh`)→ 拒绝 |
| `Mid` | 2 个 zh 同值但 **en 是 `Medium`**(`appsSettingsCpuMedium` / `aiThinkingMedium`)→ 🔴 **拒绝,复用会改文案** |
| `Low` | 2 个 → 拒绝 |
| `Similarity` | 1 个(`aiSimilarity`)→ 拒绝 |
| `files` | 🔴 **零同值键**(zh `个文件`) |
| `matches` | 1 个(`aiMatchesLabel`,zh `条匹配`)→ 拒绝 |
| `Advanced` | en 同值 1 个(`appsSettingsSectionAdvanced`)但 **zh 不同**(`高级` vs `高级筛选`)→ 拒绝 |
| `Enabled` | zh/en 双同 1 个(`aiCfgEnabled`)→ 拒绝(AI 设置区) |
| `Fast` | 🔴 **零同值键** |

🔴 **另外扫出协调者不知道的 4 组**(印证治理 §7.1「假定协调者的表不完整」):
`(Untitled)`→`aiUntitled` · `Copy failed — please select manually`→`aiCfgCopyFailed` ·
`Search failed`→`aiCfgSearchFailed` · `Indexed`→**`aiKbStatusIndexed`(家族内,复用)**。
以及 **5 个 `SAMPLE_QUERIES` 全部已有 `aiKbSample*` 键**(P5a 为仪表盘建的,同一份 5 个词)——
这一条协调者初测的「63 distinct 全是新键」隐含假设不成立,**实际只需新增 54 个**。

---

## 6. DoD-6 附录 B(色值)—— 摘要

**完整表在 `p5e-appendix-B-tokens.md`。**

| 项 | 结论 |
|---|---|
| **色字面量总数** | 🔴 **17 处**(含注释、含具名色;已剔 4 处 `white-space:` 假阳性)。协调者点名 3 组共 12 处 + K47 的 1 处 = 13,**T0 另查出 4 处** |
| 协调者未点名的 4 处 | `knowledge.scss:599` `.k-rcard-icon { background: **white** }`(具名色!)· `:616` `.k-rcard-tag { color: **white** }`(= 协调者要求实读的「tag 文字色」)· `:1574` `.k-drawer-bg` 的 `rgba(15,20,30,0.32)` · `:1582` `.k-drawer` 的 `rgba(15,20,30,0.18)` |
| 根因 | 🔴 **`p5-master-plan.md` §2.4 的 52 类清单漏了 `.k-drawer-bg`(`:1572`)与 `.k-drawer`(`:1579`)** = 勘误 **E-55**,见附录 D §D.2 |
| **新建 token** | **7 个**:`--rtag-pdf` `--rtag-md` `--rtag-doc` `--rtag-txt` `--rtag-code` `--shadow-drawer` `--mark-hl-bg`,**两档都定死了值** |
| **本档尚未声明但可复用的既有 token** | **1 个**:`--paper-surface`(`tokens.scss:193`/`:342`,`#ffffff` 两档同值)—— T2 需在两档各补一份 |
| **纯复用** | `--text-on-accent` · `--success/-soft` · `--warning/-soft` · `--danger/-soft` · `--modal-scrim` · `--bg-canvas` |
| 三处必须定死的 | ✅ 全部定死(5 个实底 → `--rtag-*` · 3 组 rel → success/warning/danger 家族 · mark 黄 → `--mark-hl-bg`) |
| `.k-rcard-tag` 文字色 | 🔴 **实读结果 = `color: white`**(具名色,`:616`)→ **`--text-on-accent`**。依据:本文件 `.k-type-legacy` 的注释原文「实底警告色胶囊上的纯白字 → `--text-on-accent`」;5 个 `[data-kind]` 底**都是不透明实底** ⇒ 记忆「`--on-accent` 只在 accent 实底上可用」的前提成立 |
| **验收拍板项** | 🔴 **2 个**:`--rtag-md`(`#1a1a1a`,暗档比 `--bg-elevated: #242426` 还暗)· `--mark-hl-bg`(暗档我定 `rgba(255,235,0,0.22)`,浅档照蓝本 `0.4`) |
| **模板 `style=`/`:style=`/`color=`** | 🔴 **显式记数 26 处**(SearchView **16** · FileDetailDrawer **9** · KFileViewer **1**),含颜色 11 处,🔴 **色字面量 0 处**(全是 `var(--…)`)。⚠️ 协调者「SearchView 6 处」欠计,「FileDetailDrawer 9 处」精确 |

🔴 **为什么另起 `--rtag-*` 而不借 `tokens.scss` 的 `--kind-*`**:`--kind-txt` 是 `#8E8E93`(灰),
而蓝本 TXT 标签是 `#34C759`(绿)—— **同名异值是评审地雷**;txt 那一员必须换名 ⇒ 五个必须同前缀。
承 `--grad-sk-blue → --grad-sandbox` 的改名先例。**每个都诚实登记了仓内同值出处**(4/5 有,`--rtag-code` 与 `--purple` 同值)。

🔴 **`.k-rcard-snippet mark`(`:653`)与 `.k-chunk-item-preview mark`(`:1645`)用的是 token,不是字面量 —— 已确认,不动它们。**

---

## 7. DoD-7 附录 D(类清单)—— 摘要

**完整表在 `p5e-appendix-D-classes.md`。**

| 项 | 结论 |
|---|---|
| 核对基准 | **蓝本三个模板真正用到的 class token 全集 = 74 个**(比 §2.4 的 52 更完整) |
| 三态 | **TO-MOVE 54** · **ALREADY-MOVED 17** · **NO-RULE-EITHER-SIDE 3**(KFileViewer 的三个 `k-fileviewer-*`) |
| §2.4 的 52 个 | ✅ **全部落在 TO-MOVE 里,零错判** |
| 🔴 **§2.4 漏列(勘误 E-55)** | **`.k-drawer-bg`**(`:1572-1578`,全屏遮罩 + `z-index: 1050` + blur)· **`.k-drawer`**(`:1579-1586`,抽屉主体 + 宽度 + 投影)。另漏 **2 个 `@keyframes`**(`k-drawer-fade` / `k-drawer-in`,`:1541-1545`)与 **1 个 `@media (max-width:720px)` 块**(`:1666-1672`,5 条移动端覆盖) |
| 🔴 **HALF-MOVED** | **`k-suggest-chip` = E-52**(只有 `:2198` 的后代覆盖,基类缺失)。**这正是「不许只给总数」的价值** —— 按总数看它是「已搬」 |
| 24 个死类 | 逐字抄进附录 §D.3。**T0 现测:24 个在 `knowledge.scss` 里 0 个出现、在 `WHITELIST_293` 里 0 个出现** ✅ 起点干净 |
| T2 的实际搬运范围 | **6 段**,逐段给了起止行与「到哪一行为止 + 为什么」:S1 `351-367` · S2 `457-549` · S3 `573-681` · S4 `726-732` · S5 `1540-1563` · S6 `1571-1673`(**跳过 `:1564-1570`**)+ KFileViewer `:71-76`/`:103-119` |
| 🔴 **`.k-btn.outline` 不许再搬** | 本仓 `:792-797` 已有逐字等价声明;蓝本 `:1564-1568` 是重复段 |
| `WHITELIST` 终值 | 🔴 **293 → 348**(`NEW_RE` 扫出数 292 → 347,**新增 55 个类逐字列出**);常量名 `WHITELIST_293` → **`WHITELIST_348`**。**零丢失自证:现状 292 个在追加后一个不少** |
| `NON_K_HELPER_CLASSES` 终值 | 🔴 **16 → 19**,新增 **`chev` / `path` / `h-md`**,逐条出处已写。现状实测 16 与裁定 R8 逐字一致 ✅ |
| 复现 | 未用 `p5d-gen-r8r9-sim.mjs`(硬编码旧常量名会抛)→ 把 `stripComments` / `NEW_RE` / `nonKClassNames` **逐字复制**成 `p5e-fixtures/scripts/sim-r8r9.mjs` |
| K46 的 z-index 关系 | `.k-drawer-bg` = **1050**(蓝本 `:1577`)· `.k-fileviewer-host` = **1100**(蓝本 `KFileViewer.vue:74`,行尾注释原文 `/* above the detail drawer (1050) */`)→ **`1100 > 1050`,两个数字都原样搬**。`ViewerShell .overlay` 的 200 是 host 内部 stacking context 的局部层,不参与比较 |
| K44 顶层例外 | 例外集合 = `['.nme-content .ProseMirror']`(裁定 R4);现状顶层裸选择器 = **1**。**P5e 一个都不许新增**,`bareTopLevelSelectors()` 那条断言一字不改 |
| 交接项 | `.k-adv-toggle` + `.chev` → **P5e 先搬者得,P5f 不许重复搬** · `.k-section-body`(E-3)与 `.k-frow` → **P5f** · `.k-seg`(K43)/`.k-btn.text`(K45)/`.k-btn.outline` → 已搬,不许重复 · `openNoteInNewTab` → 实测三个蓝本文件 **0/0/0 命中** → 继续不补,转 P5f |
| 三个嵌套零引用规则 | `.h-md`(`:660`,蓝本自身零 class 引用)+ `mark` ×3(`:653`/`:1645`/`:1660`)→ **随父块整体搬**,已登记 |

### 🔴 E-52 的诚实处置(**这一条我改了协调者的判据**)

治理 §6.3 与计划书 §0.2-5 都写「基类必须搬在覆盖之前,**否则级联反掉而三门全绿**」。
**T0 实测:后半句在本例里不成立。**

| 选择器 | 特异度 | 声明的属性 |
|---|---|---|
| `.knowledge-app .k-suggest-chip`(基类) | (0,2,0) | padding/background/border/radius/font-size/color/cursor/transition + `:hover` |
| `.knowledge-app .k2-suggest .k-suggest-chip`(覆盖,`:2198`) | (0,3,0) | **只有 `white-space`** |

① 特异度 (0,3,0) > (0,2,0) → **顺序颠倒也不会反掉**;② 两者**属性集完全不相交**。

🔴 **所以 T2 的断言必须钉「源序纪律」本身,不许编造一个不存在的级联后果**
(否则就是「零判别力 + 事实错误」的用例名,评审会逮到)。附录 D §D.4 已给出允许/禁止的断言形态。
**「基类必须插在覆盖之前」这条要求本身照旧执行**(蓝本源序纪律),只是理由要写对。

---

## 8. DoD-8 🔴 `@vue-office` 在 jsdom 下的可测性结论

**完整结论在附录 D §D.9(含 mock 代码骨架与三条断言的变异判据)。**

探针放在**仓根**(`p5e-t0-vueoffice-probe.test.ts`),**不在 `src/` 下**;跑完已删除(§12 自证)。

| # | 问题 | 答案 |
|---|---|---|
| ① | 能静态 import `DocViewer.vue` / `ExcelViewer.vue` 吗? | ✅ **能** |
| ② | 能真挂载 `DocViewer` 吗? | ✅ **能,且干净** —— 实测渲染出 `ViewerShell > .overlay > … > .vue-office-docx > .vue-office-docx-main`,零报错 |
| ③ | 能真挂载 `ExcelViewer` 吗? | 🔴 **能挂载,但会让整个 vitest run `exit 1` 而 0 个用例失败** |

**③ 的实测输出(逐字)**:
```
stderr | full ExcelViewer html
Error: Not implemented: HTMLCanvasElement.prototype.getContext (without installing the canvas npm package)
    at new e (@vue-office/excel/lib/index.js:1:73232)

⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
TypeError: Cannot read properties of null (reading 'scale')
 ❯ new e node_modules/.../@vue-office/excel/lib/index.js:1:73275

 Test Files  1 passed (1)
      Tests  2 passed (2)
     Errors  1 error
EXIT=1
```
`@vue-office/excel` 内部是 **x-spreadsheet**,构造时无条件 `canvas.getContext('2d')`;
jsdom 返回 `null` → 读 `null.scale` → unhandled rejection → vitest 记 `Errors 1 error` 并把退出码变成 **1**。
🔴 **这正是记忆「5908 例零失败但 vitest exit 1」那一类的同款成因。**

**⇒ mock 边界(T4/T5 照此执行)**:
把 `DocViewer.vue` 与 `ExcelViewer.vue` **两个都 `vi.mock` 成 stub**,
🔴 **保留 `item` / `list` 两个 props 与 `close` / `download` 两个 emit 的契约形状**
(依据 `DocViewer.vue:9-10` / `ExcelViewer.vue:9-10` 的 `defineProps`/`defineEmits`)。
`DocViewer` 本来可以不 mock,但**两个必须一致 mock**,否则同一批用例出现两套挂载语义。

**走 stub 后三条断言的落点与变异判据**(治理 §9.12 明令,附录 D §D.9.4 有表):
`VIEWER_MAP` 五扩展名映射(判据:删掉 `wps` → 必红)· fallback 分支(判据:把 `|| null` 改成 `|| 'DocViewer'` → 必红)·
Esc 监听注册/注销(判据落在**同一函数引用**上,删 `onBeforeUnmount` 的 remove → 必红)。

**本仓既有先例(已读)**:
`ViewerHost.vue:10-19` 七个 viewer **全部 `defineAsyncComponent(() => import(...))` 懒加载**
→ **全仓零「静态 import `@vue-office`」先例**,`KFileViewer` 是第一次;
`panelMap.test.ts` / `useViewer.test.ts` 都只测纯函数/composable、**根本不挂载 viewer**;
`useOfficeBytes.test.ts` mock `service.file.getBytes`。
⇒ **D.9.3 的 stub 路线是新建做法,T5 报告必须显式申报并贴 D.9.2 的输出当依据。**

⚠️ 顺带查实一个 T4 必须知道的差异(**不是要改**):蓝本 `VIEWER_MAP` 把 **`wps`→DocViewer / `xls`→ExcelViewer**,
而本仓 `panelMap.ts:16-18` 把这两个送 **`pdf-viewer`**(后端 LibreOffice 转 PDF)。
`@vue-office` 只吃 OOXML → 蓝本这两个会落到 viewer 自己的 `state === 'error'`。
🔴 **按 N 系列照抄,不许「顺手改成 pdf-viewer」**;但验收清单要说明。

---

## 9. DoD-9 🔴 K48 等价性程序化证明

把蓝本 `SearchView.vue:317-345`(A)与 `FileDetailDrawer.vue:199-217`(B)的
`relLevel` / `relLabel` / `highlight` / `fmtMtime` **各自逐字移植**成两组临时函数
(`$t` 换成两侧同一个 identity stub,以隔离逻辑),对同一批输入跑并逐个 `JSON.stringify` 比对。

脚本:`p5e-fixtures/scripts/k48-equiv.mjs`

```
$ node k48-equiv.mjs
# relLevel / relLabel over 27 inputs (incl. NaN/Infinity/null/undefined/string/bool)
# fmtMtime over 16 inputs
# highlight over 16 × 29 = 464 combos

RESULT: 534 comparisons, 0 mismatches → EQUIVALENT ✅

K49 premise spot-check:
  highlight("<script>alert(1)</script>", "script") = &lt;<mark>script</mark>&gt;alert(1)&lt;/<mark>script</mark>&gt;
  highlight("<img src=x onerror=1>", "img")        = &lt;<mark>img</mark> src=x onerror=1&gt;

relLevel/relLabel on real device score range:
  score=0.738 -> high / T<High>
  score=0.734 -> high / T<High>
  score=0.6   -> mid  / T<Mid>
  score=0.4824-> low  / T<Low>
  score=0.4666-> low  / T<Low>
```

**输入覆盖**:
- `relLevel`/`relLabel`:阈值两侧(`0.5-ε` / `0.5` / `0.5+ε` / `0.65-ε` / `0.65` / `0.65+ε`)+ 负数 + `NaN` +
  `±Infinity` + `null` + `undefined` + 字符串 + 布尔 = **27 个输入 × 2 函数**
- `fmtMtime`:`0` / `null` / `undefined` / `NaN` / `''` / `false` / `1` / 真机毫秒值 ×2 / 负数 / 小数 /
  `Date.UTC` ×2 / `8.64e15` / 字符串数字 = **16 个**
- `highlight`:16 段文本(空 / `null` / `0` / `false` / 含 `& < > "` / `<script>` / `<img onerror>` /
  正则元字符 `$5 (approx.) [see 1+1=2]` / 大小写混排 / 中文 / 已含 `<mark>` / tab+换行)
  × 29 个查询(空 / 全空格 / `null` / `undefined` / 单字符 / 多词 / 前后多空格 /
  `& < "` / `.*` / `\` / `^a` / `a$` / `a|b` / `a?` / `a{1}` / 中文 …)= **464 组**

🔴 **534 次比对,0 处不等价 → K48 的去重零行为变化,可以放心抽进 `util/searchAggregate.ts`。**
(A 用 `0.50`、B 用 `0.5` —— 数值同一;A 是 if 链、B 是三元 —— 行为同一。)

顺带坐实 **K49 的前提**:`highlight()` 确实**先 escape 再插 `<mark>`**,
`<script` / `onerror` 都被转义成 `&lt;…`,而 `<mark>` 仍出现 → K49 的注入用例判据成立。
🔴 **`relLevel` 三档在真机 score 区间(0.4666–0.7380)里全部可达**(附录 §2 ⑥)。

---

## 10. DoD-10 🔴 fixtures 实测

**13 个 fixture + README(含全部取数命令)在 `.superpowers/sdd/p5e-fixtures/`。**

### 走得通的取数路径(治理 §4.2 要求)

| 想打 | 实际怎么打 |
|---|---|
| `POST /v1/ai/search/text` | 🔴 **绕到 Search 直连**:`POST $(cat /var/run/nimoos/search.url)/v1/search/text` + `X-NimoOS-User-ID: 1` |
| `GET /v1/ai/search/chunk` | 同上,`/v1/search/chunk?file_id=…&kind=…&chunk_no=…&window=…`。🔴 **是 GET + query,不是 POST** |

- 直接打 AI:`curl $AI/v1/ai/search/text` → **HTTP 400 `{"message":"missing or malformed jwt"}`**(实测)
  —— 印证上级设计 §6.5「NimoOS-AI 对 localhost 也强制 JWT」。
- 网关**不注入** `X-NimoOS-User-ID`(记忆 `gateway-no-userid-injection`)→ 不能经网关。
- Search **自己不校 JWT**(`route/v1/text.go:33` 只读 `CtxUserIDKey`)→ 直连 + 自带头即可。
- 改写规则:`NimoOS-AI/route/v2/search_proxy.go:24-33`,`/v1/ai/search/<rest>` → `/v1/search/<rest>`,
  只转发 `X-NimoOS-User-ID` / `X-NimoOS-User-Name`。

🔴 **勘误 E-54**:治理 §4.2 把 chunk 端点写成 `POST /v1/ai/search/chunk body={file_id, …}` ——
**实际是 GET + query**(`NimoOS-Search/route/v1/chunk.go:13` 是 `e.GET`;共享包
`NimoOS-Service/src/ai.ts:584-586` 也是 `http.get(..., { params })`)。

### 六个必答的字段级问题 —— 全部回答(详表在 README §2)

| # | 答案(一句话) |
|---|---|
| ① `files[]` vs `hits[]` | **两个都有**;`hits` 恒存在,`files` 带 `omitempty` → **有结果时 `resp.files` 分支是真机路径**(store 恒发 `group_by_file:true`),零结果时 `files` 整键消失、走 `groupHits(resp.hits\|\|[])` 得 `[]`。**N45 两条分支都要有用例** |
| ② `paths[0].mtime_ms` | 字段名 `mtime_ms`,**单位毫秒**(Go `int64`),真值样本 `1784424392240`。🔴 与 P5d 的 `relativeTime(unixSec)` 是秒**完全相反** |
| ③ `mime` 分布 | 🔴 **本机 7 个文件全是 `text/plain`**,pdf/markdown/x-source/docling 变体**一条都没有** → `MIME_PREFIXES` 里只有 `txt` 那条能命中。**N35「不许补全 docling 变体」的结论不变** |
| ④ `cite.page` / `cite.chunk_no` | `/v1/search/text` 侧:`chunk_no` 恒存在(**`0` 合法**),`page` 是 `*int` **无 `omitempty` → 键恒存在,空时 `null`**。🔴 `/v1/search/chunk` 侧**相反**:`page`/`offset_*` 都带 `omitempty` → **空时整键消失**。两端口径不同,mock 别互抄 |
| ⑤ `preview.text` | 字段名就是 `preview.text`,`*string` 无 `omitempty` → **键恒存在**,空串也被 `stringOrNilFromAny` 变成 `null`。同层 `preview.thumbnail_url` 本机恒 `null` |
| ⑥ `score` 量纲 | **bge-m3 dense 余弦相似度**(sparse 只做 prefetch)。本机实测:切题 **0.7340–0.7380** / 完全不相关 **0.4666–0.4824** → 🔴 **`relLevel` 的 0.65/0.50 三档全部分得开** |
| 附 `warnings` | 🔴 **本机不会出现 `rerank_unavailable`**:`service/search.go:176` 是 `if req.Rerank && len(hits) > 0`,本机 `len(hits)` 恒 0。**唯一真抓到的非空 warnings 是 `no_accessible_roots`**(`F4`) |
| 附 `anchor` 兜底 | `anchor_chunk_no` = **请求里的 `chunk_no` 原样回显**;后端**不保证它在 `chunks` 里**(实测 chunk_no **不连续**:`F6b` 是 `4,5,6,8`)。缺席时蓝本落到 `c.snippet \|\| ''`(`:156-157`)—— **可达,要有用例** |

### 🔴 `inline=1` 坐实

**支持。** `NimoOS/route/v2.go:256-262`:`disposition := "attachment"; if …Get("inline")=="1" { disposition = "inline" }`。
`Content-Type` 由 `http.ServeFile` 嗅探。→ **蓝本传 `inline` 是对的,照抄。**
🔴 **但认证方式导致 K50 必然 401 → NC-1。**

### 🔴 为什么有 `.REPLAYED` 而不是全部端到端真抓

见 §0 的 NC-2:本机搜索恒零结果。非空响应体的做法是**把权威 Go 代码路径逐行重放在真数据上**:
真 Qdrant payload(`F0`)→ `buildHitFromPayload`(`search.go:298-337`)→ 排序/分组/topK/maxChunks
(`:205-231`)→ 真 Parser `_internal/files` 回填 paths/mime(`:243-259`)→ `files[]` 组装(`:263-290`)。
**唯一人工选值的地方是 `F5b` 的 8 个 score**(从实测区间 0.4666–0.7380 里取档位代表值,
目的是让 relLevel 三档在同一个 fixture 里都有样本);其余每个字段都来自真响应。
**三种性质用文件名后缀区分**:`.REAL` / `.REPLAYED` / `.CONSTRUCTED`(D-6 模具),README 顶部有纪律说明。

### 会写后端的探测 + 恢复

**全部只读,零恢复动作**(逐项表在 README §6)。3 次 distill POST **都被挡在写库之前**(403×2 / 404×1),
探测后 `/distill/jobs` 与探测前逐字相同。
🔴 **成功的 distill POST 刻意没做**(会插一行不可干净回收的 `notes_distill_jobs`),
已按 D-6 模具从权威源 `main.py:2746` 登记,**这是对 DoD-10 的一处主动申报偏离**(理由三条见 §4)。

---

## 11. DoD-11 §9.11 可点性清单实测补全

**23 项逐条表在附录 D §D.10**(比治理点名的 11 项更全)。要点:

| 问题 | 答案 |
|---|---|
| 本机索引里有 **pdf / md** 吗? | 🔴 **没有**。7 个文件是 `.log` ×6 / `.json` ×1,mime 全 `text/plain` |
| 有 **docx / xls / xlsx / csv** 吗? | 🔴 **没有** → **`KFileViewer` 整屏不可达** |
| 有 **doc / ppt / pptx** 吗? | 🔴 **没有** → **「请下载」toast 不可达** |
| rerank 真机可用吗? | 🔴 **不可用**:`POST :8283/v1/parser/rerank` → **HTTP 500**,根因 `parser/model_reranker.py:50` → FlagEmbedding → **`AttributeError: XLMRobertaTokenizer has no attribute prepare_for_model`**(Parser venv 里 `transformers`/`FlagEmbedding` 版本不兼容)。**既有后端缺陷,与 P5e 无关,建议另开票**。⚠️ 但 `.k-rerank-warn` 仍不可达(rerank 分支要求 `len(hits)>0`) |
| 「本机必然搜不到」的具体词 | 🔴 **任何词都搜不到**(NC-2)。若要一个确定的:**`zzqqxxvv不存在的词`** |
| 怎么造 error 态 + 恢复 | 🔴 **推荐浏览器侧**:DevTools Network 设 **Offline**,或对 `**/v1/ai/search/text` 设 **Block request URL** → 点搜索 → `phase='error'`;恢复 = 取消 Offline / 取消 block。**零设备风险**。设备侧造法(`systemctl stop nimoos-parser`)已标红并注明代价(重启后首搜回到 ≈16.7 s / +2.8 GB) |
| 导航路径 | `/ai/settings` 顶栏「详情」→ `/ai/knowledge` → 左栏 rail **第 2 项「搜索」**(收官刀反转 `search` 之后才成立) |
| `?q=` 深链 URL | `http://<设备IP>/app/#/ai/knowledge/search?q=甲状腺`(hash 路由 + `/app/` 前缀) |
| 首搜耗时 | 见 §3(条件句:热态 ≈5 s / 冷态 ≈16.7 s) |
| Esc 同时关两层 | N41 的行为**本机不可达**,但**验收清单仍要写明这是与旧版一致的预期** |
| 复制成功/失败的区别 | `FileDetailDrawer.copy()` **蓝本自带 `execCommand` 兜底**(`:171-179`)→ HTTP-IP 下应能成功;🔴 **与笔记区(P5d,无兜底、弹「操作失败」)行为不同,验收清单要写清** |

---

## 12. DoD-12 🔴 `src/` 零改动自证

```
$ cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
$ git diff --name-only -- src/
(空)

$ git status --porcelain
(空)                      ← .superpowers/ 被 .gitignore:6 盖着,产出不会在这里出现
```

**临时探针的还原自证**(治理 §9.5 / P5c §1.3.1:碰 gitignore 产物时 md5/diff 才是证据):
- 探针文件 `p5e-t0-vueoffice-probe.test.ts` 与 `p5e-t0-i18ndump.test.ts` 都放在**仓根**,
  **不在 `src/` 下**(vitest 默认 include 是 `**/*.{test,spec}.?(c|m)[jt]s?(x)`,仓根即可被收);
  用完 `rm -f`,`ls p5e-t0*` → `No such file or directory`。
- 两个探针都**没有修改任何既有文件** → 不需要 `cp` + `md5sum` 还原比对
  (那条纪律针对的是「改了既有文件再还原」;本次是「新建后删除」)。
- `git diff --name-only -- src/` 与 `git status --porcelain` **双双为空**,`src/` 与
  `package.json` / `pnpm-lock.yaml` / `vite.config.ts` 一字未动。
- `.sp8/NimoOS-Service`:**零改动**(本期无需跨仓 `pnpm build`,无需 `pnpm install`)。
- **dev server 全部没碰**:`:5288`(pid 1159107)· `:5273` · `:5277` · `:5299` 一个都没 kill/重起
  (本期零新依赖,不需要)。

---

## 13. 命中的 K / N 条目显式申报

| 条目 | 本刀怎么命中 |
|---|---|
| **K46** | 附录 B §B.4 + D §D.9:三条落地判据全部实测。🔴 **判据 ① 的表述必须改** —— `.overlay` **不是全仓零命中**(`ViewerShell.vue:9` 会渲染它);正确表述 = 「`DocViewer`/`ExcelViewer` **自身模板**零那三个类,且 `.overlay` 已由 `ViewerShell` 自带 scoped 规则(`:23-29`,`position:absolute; inset:0; z-index:200; display:flex; flex-direction:column`)定位好」。判据 ② 实测 `ViewerShell.vue:24` 确为 `position: absolute; inset: 0; z-index: 200` ✅ |
| **K47** | 附录 B §B.0 #17:净 1 处 `#fff`(`KFileViewer.vue:75`)→ **`var(--bg-canvas)`**,依据是蓝本自己的兄弟规则 `:106` 就用它 |
| **K48** | §9 的 534 次比对、0 处不等价 ✅ |
| **K49** | §9 顺带坐实 escape 先于插 `<mark>`,注入用例的判据成立 |
| **K50** | 🔴 **NC-1:落法在真机上必然 401,已停下申报,不自行拍板** |
| **K51** | 附录 A/D 未涉及;`toggleSet` 的照抄口径无新发现 |
| **N33** | 5 个 `SAMPLE_QUERIES` 确认过 `$t(s)`(蓝本 `:90`)→ 进 i18n,且 **P5a 已有同值 `aiKbSample*` 键可复用** |
| **N34** | 附录 D §D.10 #13/#14:`advEnabled` 的 `types.size < FILE_TYPES.length` 反直觉判据已写进可点性清单(全选 = 未启用 = 不发 `mime_prefix`) |
| **N35** | §10 ③:本机 mime 全是 `text/plain`,`MIME_PREFIXES` 只有 `txt` 那条能命中 → **「不许补全 docling 变体」的结论不变** |
| **N41** | 附录 D §D.10 #23:本机不可达,但验收清单仍要写明 |
| **N42** | §10 附:`anchor` 缺席兜底可达,要有用例 |
| **N44** | §4:`DISTILL_EXTS` 逐字读出(14 个扩展名),本机 7 个文件一个都不在里面 |
| **N45** | §10 ①:**两条分支都有真机含义**(有结果走 `files`,零结果走 `hits` 兜底得 `[]`),两条都要独立用例 |
| **A-1 / A-6** | 附录 A §A.1.2:13 组同值键逐条拒绝,理由逐字照 A-1 |
| **A-9** | 附录 B §B.1:`rel` 三组的 alpha 与既有 `*-soft` 差几个点 → 不开小灶,照 A-9 |
| **R4** | 附录 B §B.2.2:`--shadow-drawer` 两档颜色照 R4 的既定规则(暗 `rgba(0,0,0,…)` / 浅 `rgba(40,35,25,…)`) |
| **R8 / R9** | 附录 D §D.7:程序化实测 16 → 19 / 293 → 348,复现脚本自建(未用会抛的 `p5d-gen-r8r9-sim.mjs`) |
| **R10 / E-31 / E-44** | 附录 A:en 值**从 `en_US.json` 读**,并给出「本批恰好 63/63 en = key」的实测结论 + 替代反向断言方案 |
| **R17** | 附录 B §B.5-2:注释里不许出现色字面量,已写进落地要求 |
| **E-52** | 附录 D §D.4:🔴 **改了协调者的判据**(级联不会反掉),给出诚实的断言形态 |
| **§9.10** | 本刀零 `src/` 改动 → 未触碰任何守卫;附录 D §D.7.2 已说明 `NON_K_HELPER_CLASSES` 16→19 是**加固**(集合相等断言仍生效),T2 要贴前后两次输出 |
| **§9.12** | §8:结论已给,T5 不会「边写边试」 |
| **§13** | 附录 D §D.10:23 项可点性 + 导航路径 + 深链 URL + 首搜耗时 + error 造法与恢复,全部写全 |

### 本刀提出的新勘误

| # | 内容 |
|---|---|
| **E-54** | 治理 §4.2 把 chunk 端点写成 `POST /v1/ai/search/chunk body={…}` → **实际是 GET + query** |
| **E-55** | `p5-master-plan.md` §2.4 的 52 类清单**漏列 `.k-drawer-bg` 与 `.k-drawer`**,并连带漏 2 个 `@keyframes` + 1 个 `@media` 块;协调者「3 组共 12 处色字面量」也因此少算了 2 处 |
| **E-56** | 治理 §6.3 / 计划书 §0.2-5 的「`.k-suggest-chip` 顺序反了会级联反掉」**不成立**(特异度差 + 属性集不相交)。要求本身保留,理由要改(附录 D §D.4) |
| **E-57** | 治理 §6.1 的「模板 `style=`/`color=` SearchView 初测 6 处」**欠计,实测 16 处**(FileDetailDrawer 的 9 处精确正确) |
| **E-58** | 上级设计 §6.4 记的「设备 Python agent 落后、distill 四条路由全 404」**已不成立**(实测三条 GET 全 200) |
| **E-53(结案)** | 上级设计 §2.4 的 461 **是对的**,协调者的 408 是扫法欠计 → **不是勘误**,登记为口径差异 |

---

## 14. 顾虑

1. 🔴 **NC-1(K50 / `/v3/file` 认证)不裁定,T7 无法开工。** T1–T6 不受影响。
2. 🔴 **NC-2(本机搜索恒零结果)不裁定,协调者写不出正确的验收清单** ——
   照现状写就是「23 项里 14 项不可达」,机主会以为我们交了个残废;必须先讲清这是 D1 的连带后果。
3. **`.k-rcard-tag` 的 5 个类型色 + `--mark-hl-bg` 的暗档值只能靠单测 + 人肉评审**
   (真机看不到结果卡)。建议协调者按上级设计 §9-1 给 T2 单独派一个 scss 逐行色扫评审。
4. **Parser rerank 500(`XLMRobertaTokenizer has no attribute prepare_for_model`)** 是新发现的后端缺陷,
   建议与「Wiki 数据库运维票」同族另开票。它让「Accurate」档在真机上等价于「Fast」**且无任何提示**。
5. 附录 D §D.9.3 的 stub 路线是**全仓首个**「mock 掉 `src/files/viewers/*` 组件」的做法 ——
   与治理 §1.1「`src/files/viewers/**` 全期零改动」不冲突(只是 mock,不改源文件),但 T5 要显式申报。
6. `--rtag-*` 这个新家族名是我定的(理由在附录 B §B.2.1 有四条)。若协调者更偏好直接复用
   `tokens.scss` 的 `--kind-*` 名字,请注意 **`--kind-txt` 同名异值**这个雷,五个必须一起换口径。
