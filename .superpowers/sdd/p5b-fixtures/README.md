# P5b fixtures —— 后端真实响应体(逐字落盘)

**抓取时间:2026-08-01 13:03:27 +08:00** · 抓取人:T0 · 设备:本机

> 🔴 **这批文件是 T5 / T8 / T9 / T10 的 mock 唯一来源。禁手编。**
> (记忆 `newui-fixture-from-imagination-trap`:裸信封 unwrap 已栽三次、mdadm 丢 faulty 行一次。)
> 🔴 **一律直连 Parser `:8283` / Python agent `:8282`。走 `/v1/ai/*` 必 400**
> —— NimoOS-AI 对 localhost 也强制 JWT(顶层 CLAUDE.md 里那句「网关注入 `X-NimoOS-User-ID`」对本路径不成立)。
> 🔴 **计划书附录 C.3(破坏性)一条都没跑**,见本文末尾。

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
| `service.ai.parser*`(7 个方法) | **本目录 `.json` 的原样 snake_case** | `NimoOS-Service/src/ai.ts:591-640` 七个方法都只 `return res.data`,**零转换** |
| `service.notes.listDistillJobs()` | **camelCase**:`{ jobs: [{ filePath, status, origin, attempts, lastError, enqueuedAt, updatedAt }], counts: { pending, running, failed } }` | `NimoOS-Service/src/notes.ts:186-207` 的 `normalizeDistillJobs` 已在包内归一化 |
| `service.notes.getDistillStatus()` | **camelCase**:`{ pending, distilled, quotaRemaining, backgroundModel }` | `NimoOS-Service/src/notes.ts:299-308` |

→ **`distill-*.json` 是 HTTP 层的原文,不能直接当 `service.notes.*` 的 mock 用**,要按上表换成 camelCase。
Parser 那批可以原样用。

---

## C.1 只读(13 条,全部跑过)

| 文件 | 原始 curl | 关键形状备注 |
|---|---|---|
| `stats.json` | `curl -s "$P/stats"` | `{"queue_depth":{pending:338,running:1,failed:0,done:9},"indexed_files":8,"total_vectors_text":5592,"total_vectors_visual":0,"last_cursor_ms":…,"models":[…]}`。**无 `rate_per_min` / `done_last_10m` / `eta_s`**(P5a N2,概览页速率/ETA 恒 0 就是这个原因) |
| `jobs-pending.json` | `curl -s "$P/jobs?status=pending&limit=3"` | `{"jobs":[…3 行…]}`。行字段:`id root_id path op sub_modality priority attempts last_error locked_until created_at picked_at done_at`。🔴 **没有 `file_id`**(K18 证据①)。`op` 有 `index` 与 `delete` 两种值 |
| `jobs-running.json` | `curl -s "$P/jobs?status=running&limit=3"` | 1 行。`attempts: 5`、`locked_until` 非 null、`picked_at` 非 null —— running 行的判据就是 `locked_until > now` |
| `jobs-failed.json` | `curl -s "$P/jobs?status=failed&limit=3"` | **`{"jobs":[]}`** —— 本机 failed 桶为空。failed 桶的表格行、`{n}× retried`、`last_error` 只能 mock |
| `files-default.json` | `curl -s "$P/files?limit=3&offset=0&sort=indexed_at&order=desc&tombstoned=alive"` | `{"total":8,"limit":3,"offset":0,"files":[…]}`。行字段见下方「file 行形状」 |
| `files-has-error.json` | `curl -s "$P/files?limit=3&has_error=true"` | **`{"total":0,…,"files":[]}`** —— 本机没有 error 行 |
| `files-tombstoned.json` | `curl -s "$P/files?limit=3&tombstoned=tombstoned"` | **`{"total":0,…,"files":[]}`** —— 本机没有 tombstoned 行 |
| `files-path-prefix.json` | `curl -s "$P/files?limit=3&path_prefix=/DATA/"` | 与 `files-default.json` 同内容(8 个文件全在 `/DATA/` 下) |
| `files-mime-prefix-legacy.json` | `curl -s "$P/files?limit=3&mime_prefix=application/legacy-office/"` | **`{"total":0,…,"files":[]}`** —— 「旧 .doc」快捷 chip 点下去就是这个空态,**真机可验** |
| `files-sort-size-asc.json` | `curl -s "$P/files?limit=3&sort=size&order=asc"` | 排序真的生效(251 → 13174 → 61392 字节),`total` 仍是 8 |
| `distill-jobs.json` | `curl -s -H "$H" "$A/notes/distill/jobs?limit=500"` | **`{"jobs":[],"counts":{"pending":0,"running":0,"failed":0}}`**。🔴 **没有 `done`、没有 `total`** —— store 的 `d.done` 来自 `/distill/status` 的 `distilled`、`d.total = rows.length`(N5) |
| `distill-jobs-failed.json` | `curl -s -H "$H" "$A/notes/distill/jobs?status=failed&limit=500"` | 同上,空 |
| `distill-status.json` | `curl -s -H "$H" "$A/notes/distill/status"` | `{"pending":0,"distilled":0,"quota_remaining":50,"background_model":""}` |

**追加 1 条(不在计划书 C.1 清单里,T0 判断有用)**

| 文件 | 原始 curl | 为什么加 |
|---|---|---|
| `files-all-8.json` | `curl -s "$P/files?limit=100"` | 一次拿全 8 行,用来统计真实状态分布(见下)。T8/T9 的列表 mock 从这里裁 |

### file 行形状(`files-*.json` 里 `files[]` 的每一项)

```
file_id          32 位 hex(= sha256_full 的前 32 位)
paths            [{ root_id, path, mtime_ms }]     ← 数组;蓝本只取 paths[0].path
sha256_full      64 位 hex
size             字节数(number)
mime             例:"text/plain" / "application/octet-stream"
modalities_done  {} 或 { "text": "bge-m3/v1" }
parser_version   "parser/0.2.0"
indexed_at       毫秒时间戳
tombstoned_at    null（本机没有非 null 的）
vector_count     number
last_error       null（本机没有非 null 的）
status           "ok" | "indexing"（本机只有这两种；契约上还有 "error" / "tombstoned"）
```

### 🔴 本机真实状态分布(与计划书 §10 / 设计 §7.3 写的不同)

```
总数 8
  indexing  5      ← 计划书写「1 行 indexing」,是错的
  ok        3
  error     0
  tombstoned 0
vector_count === 0 的行:1 个（就是那个 application/octet-stream 的,但它 status 是 indexing）
```

**连带结论(写进验收清单当预期行为,不是缺陷)**:
- `error` / `tombstoned` 两种状态徽标、`.k-frow-errhint`、tombstoned 行禁选与 title —— **真机全验不了**,只能 mock。
- `zerohint` 需要 `status === 'ok' && vector_count === 0` 两个条件同时成立 —— **本机没有这种行**,只能 mock。
- 分页恒 `1 / 1`(只有 8 个文件),「上一步 / 下一张」的**禁用态**可验、翻页本身验不了。
- 「自动刷新 · 30s」提示与 30 秒轮询**可真验**(有 5 行 indexing);轮询自停要等那些行转 `ok`。

---

## C.2 幂等写(3 条,全部跑过)

| 文件 | 原始命令 | 响应 |
|---|---|---|
| `reindex-one.http` | `FID=$(python3 -c "import json;print(json.load(open('files-all-8.json'))['files'][0]['file_id'])")`<br>`curl -s -i -X POST "$P/files/reindex" -H 'Content-Type: application/json' -d "{\"file_ids\":[\"$FID\"],\"reason\":\"p5b fixture\"}"` | `HTTP/1.1 200` + `{"queued":1,"tombstoned":1,"job_ids":[349],"skipped":[]}`<br>🔴 **蓝本读 `res.queued`,字段确认存在。** 副作用:那个文件被墓碑后重新入队(pending 338 → 339),可忽略 |
| `jobs-retry-empty.http` | `curl -s -i -X POST "$P/jobs/retry" -H 'Content-Type: application/json' -d '{}'` | `HTTP/1.1 200` + `{"retried":0}`(failed 桶为空 → 空操作) |
| `reindex-cap-400.http` | 见下(计划书那条 shell 里的 python fallback 是坏的,T0 改对了) | `HTTP/1.1 400 Bad Request` + `{"detail":"too many file_ids (max 500)"}` |

计划书 C.2 最后一条的 shell 里 `python3 -c 'print(json.dumps(...))'` **没有 `import json`**,
必然抛异常走 `|| echo '[]'` 的 fallback,发出去的是空数组 —— **求不到想要的形状**。T0 改成:

```bash
python3 -c "
import json
open('/tmp/cap-probe.json','w').write(json.dumps({'file_ids':[str(i) for i in range(501)],'reason':'cap probe'}))"
curl -s -i -X POST "$P/files/reindex" -H 'Content-Type: application/json' \
     --data-binary @/tmp/cap-probe.json
```

(顺带:空数组那条 fallback 其实也会返 400、且**是同一条消息** —— 后端
`service_reindex.py:46-49` 的判据是 `len(file_ids) < 1 or len(file_ids) > 500`,两种错误共用一条 detail。)

---

## 未实测 · 源码推定的形状(下游 mock 需要,不许自己编别的)

以下端点**本期一条都没发过请求**(要么在 C.3 破坏性清单里、要么本机触发不了),
形状全部来自后端源码逐行阅读。**下游若真的需要 mock 这些,照抄这里,并在报告里注明「源码推定」。**

| 端点 | 形状 | 源码位置 |
|---|---|---|
| `POST /v1/parser/files/reindex`(filter 模式超限) | `HTTP 400` + `{"detail":"filter matches {n} files (> 10000); narrow it or raise max_reindex_by_filter"}`<br>**未实测,源码推定** —— `MAX_REINDEX_BY_FILTER = 10000`,本机只有 8 个文件触发不了 | `parser/service_files.py:205`(常量)+ `parser/service_reindex.py:53-58`(判据 `n > 10000`,先 count 再 400,不物化行) |
| `DELETE /v1/parser/jobs/{job_id}` | 成功 **HTTP 204,响应体为空**(`return None`)<br>404 `{"detail":"job {id} not found"}`<br>409 `{"detail":"cannot cancel a running job"}` | `parser/routes/jobs.py:42-50` + `parser/repo_jobs.py:130-140`(不存在抛 `JobNotFound`、`locked_until > now` 抛 `JobRunning`,否则 DELETE) |
| `POST /v1/parser/jobs/clear-failed` | `{"cleared": n}` | `parser/routes/jobs.py:53-56` |
| `POST /agent/notes/distill` | `{...}`(生成笔记,消耗当日配额) | `NimoOS-AI/agent/main.py`(distill 入队) |
| `POST /agent/notes/distill/jobs/cancel` | 成功 `{"cancelled": true}`<br>409 `{"detail":"no pending job for this path"}`(不存在 / 不是你的 / 已被领走 / 已终态 —— **一个答案**) | `NimoOS-AI/agent/main.py:2803-2819` |
| distill job **行**的字段(队列非空时) | HTTP 层:`{file_path, status, origin, attempts, last_error, enqueued_at, updated_at}`<br>包归一化后:`{filePath, status, origin, attempts, lastError, enqueuedAt, updatedAt}`<br>`status` ∈ `pending`/`running`/`failed`/**`skipped`**;`origin` ∈ `manual`/`auto` | `NimoOS-AI/agent/main.py:2789-2792` 的 SQL SELECT(逐字);`NimoOS-Service/src/notes.ts:190-199` 的归一化 |

**其它后端约束(源码,已核)**:
- `GET /v1/parser/jobs` 的 `limit` 是 `Query(50, ge=1, le=500)`(`routes/jobs.py:27`)。
  蓝本 `loadJobs(status, limit = 200)` 的 200 在范围内;UI 上「仅展示前 200 条」是**前端设的**上限。
- `GET /agent/notes/distill/jobs` 的 `limit` 被 `max(1, min(int(limit), 500))` 钳到 500(`main.py:2775`)
  —— 与 `DISTILL_JOBS_LIMIT = 500` 对上,所以 `rows.length >= 500` 当截断判据(N5)成立。
- `status=failed` 时后端 `WHERE status IN ('failed','skipped')`(`main.py:2781-2785`),
  **行上保留原始 status** 好让 UI 分开打 `Skipped` / `Failed` 徽标。

---

## C.3 破坏性 —— **一条都没跑**

计划书 §9 C.3 的 4 条,**T0 一条都没执行**(brief 明令 🔴 禁跑):

| 命令 | 为什么没跑 |
|---|---|
| `DELETE "$P/jobs/<pending job id>"` | 破坏性,brief 明令禁;形状已从源码记录(见上表) |
| `POST "$P/jobs/clear-failed"` | 同上;且本机 failed 桶本来就空,跑了也拿不到有内容的形状 |
| `POST "$A/notes/distill"` | 真生成笔记 + 耗当日配额 + 触发后台 LLM |
| `POST "$A/notes/distill/jobs/cancel"`(求 409) | 破坏性清单内 |

设计 §7.2 的 **E4(用户已授权造 2-3 条 distill 行 + 2-3 条 failed job)属于「验收准备」,归收官阶段的协调者**,
不属于 T0 的 fixture 抓取。造完数据后建议**重跑一次本目录的 C.1**,把非空的 `jobs-failed.json` 与
`distill-jobs.json` 覆盖上去,那时 T5 的 mock 才有真行可对。

⚠️ 造 failed job 需要 **Parser 短暂 resume 再 pause**(现为 paused 模式,job 不会被领走也就不会失败);
会唤醒 BGE-M3,内存 151 MB → ~2.8 GB。`parser_state.paused` 持久化,重启保持。

---

## 完整性自检

```
C.1 只读        13/13 已跑   (stats · jobs×3 · files×6 · distill×3)
C.1 追加         1/1  已跑   (files-all-8.json)
C.2 幂等写       3/3  已跑   (reindex-one · jobs-retry-empty · reindex-cap-400)
C.3 破坏性       0/4  未跑   (brief 明令禁;形状全部源码推定,见上表)
```
