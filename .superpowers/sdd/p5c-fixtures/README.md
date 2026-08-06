# P5c fixtures —— 后端真实响应体(逐字落盘)

**抓取时间:2026-08-03 13:22 ~ 13:24 +08:00** · 抓取人:T0 · 设备:本机

> 🔴 **这批文件是本期所有 mock 的唯一来源。禁手编。**
> (记忆 `newui-fixture-from-imagination-trap`:裸信封 unwrap 已栽三次、mdadm 丢 faulty 行一次。)
> 🔴 **Parser 与 Python agent 一律直连 `:8283` / `:8282`。走 `/v1/ai/*` 必 400**
> —— NimoOS-AI 对 localhost 也强制 JWT(顶层 `CLAUDE.md` 那句「网关注入 `X-NimoOS-User-ID`」对本路径不成立)。
> ✅ **例外:`/v1/folder` 走网关 `:80` 无需 JWT**(NimoOS core 对 localhost 免验,实测 200)。

公共变量:

```bash
P=http://127.0.0.1:8283/v1/parser
A=http://127.0.0.1:8282/agent
H='X-User-Id: 1'
```

---

## 🔴 用之前先搞清楚 mock 的层次(最容易翻车的一点)

| 你要 mock 的东西 | 形状 | 依据 |
|---|---|---|
| `service.ai.parserStats` / `parserState` / `parserFolders` / `parserJobs` / `parserControl` / `parserTestAnalyze` | **本目录 `.json` / `.http` 的原样 snake_case** | `NimoOS-Service/src/ai.ts:591-680`,六个方法都只 `return res.data`,**零转换** |
| `service.notes.getSettings` / `putSettings` | 🔴 **camelCase 且只有两个字段**:`{ notesRoot, autoExtract }` | `notes.ts:252-262` 走 `normalizeSettings`(`notes.ts:131-137`)。**`notes-settings.json` 里的 `distill_roots` / `distill_daily_cap` / `background_model` 三个字段被包丢掉了 —— mock 里不许出现** |
| `service.notes.dirInfo` | `{ exists: boolean, empty: boolean }` | `notes.ts:264-267`(`!!` 归一) |
| `service.folder.getList` | 🔴 **`unwrap()` 后的单层** `{ content: FolderEntry[] }`,`FolderEntry = { name, path, is_dir }` | `folder.ts:7-10` + `types.ts:26-33`。**不是** `folder-list-DATA.json` 那个三层信封 |
| `service.wiki.getCandidates` | 已归一化数组;本机是 `[]` | `wiki.ts:154-156` |

→ **`notes-settings.json` 与 `folder-list-DATA.json` 是 HTTP 层的原文,不能直接当包方法的 mock 用**,要按上表换层。
Parser 那批可以原样用。

---

## C.1 只读(8 条,全部跑过)

| 文件 | 原始 curl | 关键形状备注 |
|---|---|---|
| `parser-control-state.json` | `curl -s "$P/control/state"` | `{"paused":true,"concurrency":2,"device":"auto","ocr_enabled":false,"resolved_device":"cpu"}` —— 🔴 **只有这 5 个字段**;**设备当前是暂停态** |
| `parser-stats.json` | `curl -s "$P/stats"` | `queue_depth {pending:339, running:1, failed:0, done:9}` · `indexed_files:7` · `total_vectors_text:5592` · `total_vectors_visual:0` · `last_cursor_ms:1784775953391` · `models:[{name,version,modality,dim}]×2`(`bge-m3` text/1024 + `bge-reranker-v2-m3` rerank/**`dim: null`**)。⚠️ **无 `rate_per_min`/`done_last_10m`/`eta_s`**(P5a N2) |
| `parser-folders-pending-20.json` | `curl -s "$P/folders/pending?limit=20"` | `{"folders":[20 项],"total_groups":119}` —— 🔴 **`total_groups` 字段确实存在**(蓝本 `ParserStatus.vue:80` 读它)。项字段 = `{root_id, folder, count}`(**只有 3 个**)。`count` 递减 18→…;路径全是 `/DATA/.system_data/…` 超长(**省略号可验**) |
| `parser-jobs-failed-5.json` | `curl -s "$P/jobs?status=failed&limit=5"` | **`{"jobs":[]}`** —— 失败桶为空。见「本机数据现状」的连带结论 |
| `notes-settings.json` | `curl -s -H "$H" "$A/notes/settings"` | `{"notes_root":"/DATA/Notes","auto_extract":true,"distill_roots":[],"distill_daily_cap":50,"background_model":""}` —— 🔴 后三个字段包里会丢 |
| `notes-dir-info-notes.json` | `curl -s -H "$H" "$A/notes/dir-info?path=/DATA/Notes"` | `{"exists":true,"empty":false}` → 选它只能「仅指向」,「搬文件」按钮**是灰的** |
| `wiki-candidates.json` | `curl -s --max-time 20 "http://127.0.0.1/v1/wiki/candidates"` | **`[]`**(HTTP 200,秒回)→ `pickerRoots([])` 走兜底三根:`System (/DATA)` / `/media` / `/mnt`。⚠️ **只有 `/candidates` 是活的**,`/roots`/`/tree`/`/node` 仍打死(D1) |
| `folder-list-DATA.json` | `curl -s "http://127.0.0.1/v1/folder?path=/DATA"` | 🔴 **三层信封** `{"success":200,"message":"ok","data":{"content":[…18 项…],"total":18,"index":1,"size":100000}}`。项字段 = `name / size / is_dir / is_symlink / modified / sign / thumb / type / path / date / extensions`。**`is_dir` / `name` / `path` 三个都在,与 `folderBrowser.js:5-7` 的过滤条件逐字对上** |

### 🔴 `folder-list-DATA.json` 的三层 → 单层换算(K28 的落地依据)

```
HTTP 原文(fixture)      : { success, message, data: { content: [...], total, index, size } }
axios res.data          : ↑ 整个对象
unwrap(res.data)        : { content: [...], total, index, size }        ← service.folder.getList 返回这一层
蓝本 FolderBrowser.vue:66: r.data && r.data.data && r.data.data.content  ← 三层
New-UI                  : (await service.folder.getList(path)).content   ← 单层
```
本机 18 项里 `is_dir: true` 的 15 个,减掉 `.snapshots` / `.system_data`(`startsWith('.')` 被 `dirEntries` 滤掉)
→ **`dirEntries()` 后剩 13 个**:`Amalfi Coast` `AppData` `Documents` `Downloads` `Gallery` `Image` `KVM`
`Media` `NIMO` `Notes` `lost+found` `todo-widget` …(按 `localeCompare` 排序)。
非目录的 `.wiki.md` / `nimo.tar.gz` / `todo-widget.html` / `我如何高效的使用claudecode.md` 也被 `is_dir` 滤掉。

---

## C.2 `POST /v1/parser/test/analyze` —— **T0 首次实测,6 份 fixture**

⚠️ **Parser 当前是 `paused: true`**。**实测结论:paused 不影响 analyze** —— embed 正常跑、模型已加载,
**ParserTest 页在本机完全可真机验**(3.1s / 6.5s 返回)。brief 里那条「若 analyze 在 paused 下不可用」的担心**不成立**。
⚠️ **一律用几十字节的临时文件,别传 PDF**(会触发 ~200 MB 模型首次下载)。

| 文件 | 原始命令 | 响应 |
|---|---|---|
| `parser-test-analyze-md-ok.json` | 见下 ①(`.md`,query 有,rerank=false) | **200**,`chunk_count:1` · `params_used.chunker:"markdown"` · 🔴 **`overlap_tokens` 回 0(传的是 80)** · 有 `query`+`scored` · **无 `docling_markdown`** · **无 `rerank_error`** · `scored[0]` 只有 `{chunk_no, cos_sim}`,**无 `rerank_score`** |
| `parser-test-analyze-txt-rerank.json` | 见下 ②(`.txt`,query 有,**rerank=true**) | **200**,`params_used.chunker:"plain"` · **`overlap_tokens` 回 10(原样)** · 🔴 **`"rerank_error":"XLMRobertaTokenizer has no attribute prepare_for_model"`** · `scored[0]` **仍无 `rerank_score`** |
| `parser-test-analyze-200-empty-file.http` | `-F "file=@/tmp/p5c-empty.md" -F "embed=false"` | **200** + `{…,"chunk_count":0,"chunks":[],"params_used":{…}}` —— **无 `query`、无 `scored`** → 蓝本 `:129` 的「解析出 0 块」空态 **真机可验** ✅ |
| `parser-test-analyze-400-target-tokens.http` | `-F "file=@…md" -F "target_tokens=1"` | **400** + `{"detail":"target_tokens must be in [50, 4000]"}` —— `detail` 是**字符串** |
| `parser-test-analyze-400-bad-ext.http` | `-F "file=@/tmp/p5c-probe.bin"` | **400** + `{"detail":"extension '.bin' not supported in test sandbox; use .md / source code / .txt / .html / .json / .csv / .log / .pdf / .docx / .pptx / .xlsx"}` |
| `parser-test-analyze-422-no-file.http` | 完全不传 `file` | 🔴 **422** + `{"detail":[{"type":"missing","loc":["body","file"],"msg":"Field required","input":null}]}` —— **`detail` 是数组**(FastAPI 校验错误),与其它端点的字符串 `detail` **契约不一致**。**但 UI 到不了这个分支**(`ParserTest.vue:76` 的 `:disabled="!file \|\| loading"` 挡住了)→ **照抄蓝本取值链,不许为它加数组分支、不许为它写单测**(治理 §4.2) |

```bash
# ① markdown 样本
printf 'Sandbox probe A.\n\nSecond paragraph for chunk two.\n' > /tmp/p5c-probe.md   # 50 bytes
curl -s -X POST "$P/test/analyze" \
  -F "file=@/tmp/p5c-probe.md" -F "query=probe" -F "embed=true" -F "rerank=false" -F "ocr=false" \
  -F "target_tokens=600" -F "overlap_tokens=80" -F "min_tokens=2"

# ② plain-text 样本 + rerank
printf 'Alpha beta gamma delta epsilon. Zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega.\nSecond line about vector search and embeddings for the sandbox probe.\n' > /tmp/p5c-probe.txt
curl -s -X POST "$P/test/analyze" \
  -F "file=@/tmp/p5c-probe.txt" -F "query=vector search" -F "embed=true" -F "rerank=true" -F "ocr=false" \
  -F "target_tokens=50" -F "overlap_tokens=10" -F "min_tokens=2"
```

### 成功响应的完整字段表(蓝本模板真读到的每一项)

```
mime              "text/markdown" | "text/plain" | …        ← ParserTest.vue:82
filename          原文件名(模板未用)
size              字节数                                      ← :81 fmtBytes(result.size)
text_length       抽出的纯文本长度(模板未用)
chunk_count       切块数                                      ← :80 / :128
chunks[]          .chunk_no  .text  .token_count  .offset_start  .offset_end
                  .dense_preview   number[8]                  ← :139-141(v-if 守卫)
                  .sparse_top_terms [{token_id, weight}]       ← :143-145(v-if + length 守卫)
params_used       .chunker .target_tokens .overlap_tokens .min_tokens   ← :83-88(v-if 守卫)
query             回显(模板未用)
scored[]          .chunk_no  .cos_sim                         ← :113-121
                  .rerank_score  🔴 本机永不下发(见下)        ← :117-118(v-if 双守卫)
rerank_error      🔴 本机 rerank=true 时恒有                   ← :109-111
docling_markdown  🔴 只有 pdf/docx/pptx/xlsx 才有              ← :98-103
```

🔴 **四条必须进验收清单的实测事实**:
1. `.md`/`.txt` **不产生 `docling_markdown`** → docling 卡整块不渲染。要看它得传 `.docx`/`.pptx`/`.xlsx`(**别传 `.pdf`**)。
2. `scored[]` **没有 `rerank_score`** → `rr {…}` 永不渲染。
3. 🔴 **本机 reranker 是坏的**(`XLMRobertaTokenizer has no attribute prepare_for_model`)→
   勾「rerank top-20」只能验 `⚠ Reranker error:` 警告条。**已记后端票,本期不修不绕。**
4. `params_used.overlap_tokens` 会被后端按 chunker 改写(markdown → 0,plain → 原样)——
   **正好对上蓝本 `:56` 那句 `<em>` 提示**,不是前端 bug。

---

## C.3 破坏性 —— **一条都没跑**

| 没跑的 | 为什么 |
|---|---|
| `POST $P/control {action:pause\|resume}` | 会真的改设备索引状态(resume 会唤醒 BGE-M3,内存 151 MB → ~2.8 GB;`parser_state.paused` 持久化、重启保持)。**形状:蓝本只 `await` 不读返回值,不需要 fixture** |
| `POST $P/control {action:set_concurrency\|set_device\|set_ocr}` | 同上,会改持久化状态。⚠️ **`device=cuda` 在无 GPU 机器上会硬失败**(顶层 `CLAUDE.md` 已记),**绝对不要试** |
| `PUT $A/notes/settings` | 会真的改笔记根目录 / 自动捕获开关。⚠️ `mode=migrate` 会**移动磁盘上的文件** |
| `POST $P/jobs/clear-failed` · `DELETE $P/jobs/{id}` | 本期两个 Parser 页与设置页**都不调它们** → 治理 §8.2 交接项 #8 登记「不依赖」,**不为它编 fixture** |

→ 这些端点的 mock 一律 **`mockResolvedValue(undefined)` 或按蓝本「只 catch 不读返回值」的用法写**;
**不许凭空编一个响应体**。`putSettings` 例外:蓝本 `SettingsView.vue:257`/`:273` **读返回值**
(`this.notesSettings = await notesApi.putSettings(...)`)→ mock 成 **camelCase 的 `{ notesRoot, autoExtract }`**
(与 `getSettings` 同一形状,见上表)。

---

## 重抓命令(数字会漂,验收前现测)

```bash
P=http://127.0.0.1:8283/v1/parser ; A=http://127.0.0.1:8282/agent ; H='X-User-Id: 1'
curl -s "$P/control/state" ; echo
curl -s "$P/stats" | python3 -m json.tool
curl -s "$P/folders/pending?limit=20" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("folders",len(d["folders"]),"total_groups",d["total_groups"])'
curl -s "$P/jobs?status=failed&limit=5" ; echo
curl -s -H "$H" "$A/notes/settings" ; echo
curl -s -H "$H" "$A/notes/dir-info?path=/DATA/Notes" ; echo
curl -s --max-time 20 "http://127.0.0.1/v1/wiki/candidates" ; echo
curl -s "http://127.0.0.1/v1/folder?path=/DATA" | python3 -c 'import json,sys;d=json.load(sys.stdin)["data"]["content"];print(len(d),"entries,",sum(1 for e in d if e["is_dir"]),"dirs")'
```

🔴 **写验收清单时:「实测于 2026-08-03,数字会漂,以上列命令现测为准」**,别钉死数字
(承 P5b 验收第 1 轮的教训 2)。

## 完整性自检

```
C.1 只读                8/8  已跑   (control/state · stats · folders · jobs-failed · notes-settings · dir-info · wiki-candidates · folder)
C.2 test/analyze        6/6  已跑   (md-ok · txt-rerank · empty-200 · 400×2 · 422)   ← brief 要求的那两条都拿到了
C.3 破坏性              0/N  未跑   (会改设备持久化状态;蓝本用法不需要响应体)
```
