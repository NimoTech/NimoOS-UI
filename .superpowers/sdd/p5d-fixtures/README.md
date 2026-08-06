# P5d fixtures —— 后端真实响应体(逐字节落盘)

**抓取时间:2026-08-04 18:05 ~ 18:12 +08:00** · 抓取人:T0 · 设备:本机

> 🔴 **这批文件是本期所有 mock 的唯一来源。禁手编。**(记忆 `newui-fixture-from-imagination-trap`)
> 🔴 **用法照 P5c §4.4:抄进测试 + 注释标出处 + 程序化逐字节等价校验,不许运行时 `node:fs` 读本目录**
> —— `.superpowers/` 被 `.gitignore` 盖着(SP7 曾整个丢过一次),`src/` 下的测试跨界依赖它会在合并后神秘挂掉。

## 🔴 0. 取数路径 —— 治理 §4.2 写错了

治理 §4.2 写「T0 要实测并落盘的端点(**全部经网关 `:80`,localhost 免 JWT**)」。**实测不成立:**

```
$ curl -s -m10 "http://127.0.0.1/v1/ai/agent/notes/settings"
{"message":"missing or malformed jwt"}      ← HTTP 400
$ curl -s -m20 "http://127.0.0.1/v1/ai/agent/notes?limit=200"
{"message":"missing or malformed jwt"}      ← HTTP 400
```

**NimoOS-AI 对 localhost 也强制 JWT**(顶层 `CLAUDE.md` 明写「Exception: NimoOS-AI enforces JWT even on
localhost」;`p5c-fixtures/README.md` 开头也已登记过同一条)。
→ **正确取数路径 = 直连 Python agent `:8282` 并带 `X-User-Id` 头**:

```bash
A=http://127.0.0.1:8282/agent
H='X-User-Id: 1'
```

## 1. 重抓命令(**数字会漂,验收前现测**)

```bash
A=http://127.0.0.1:8282/agent ; H='X-User-Id: 1'

# 只读 —— 随便跑
curl -s -H "$H" "$A/notes?limit=200"                    # → notes-list-200.json
curl -s -H "$H" "$A/notes?status=draft&limit=200"       # → notes-list-draft-200.json
curl -s -H "$H" "$A/notes?type=note&limit=200"          # → notes-list-type-note-empty.http(本机 {"notes":[]})
curl -s -H "$H" "$A/notes/<id>"                         # → notes-get-one.json
curl -s -H "$H" "$A/notes/<id>/backlinks"               # → notes-backlinks-empty.json
curl -s -H "$H" "$A/notes/settings"                     # → notes-settings.json

# 🔴 写操作 —— 会在 /DATA/Notes/1/ 里真的建/改/删 .md 文件。只操作你自己新建的那条!
curl -s -H "$H" -H 'Content-Type: application/json' -X POST "$A/notes" \
  -d '{"title":"PROBE — delete me","content":"# probe","note_type":"note","tags":["probe"],"source_refs":[],"description":"probe"}'
curl -s -H "$H" -H 'Content-Type: application/json' -X PUT "$A/notes/<id>" -d '{"expected_revision":999,"content":"x"}'   # → 409
curl -s -H "$H" -X POST "$A/notes/<id>/curate"
curl -s -H "$H" -X POST "$A/notes/<id>/archive"
curl -s -H "$H" -X DELETE "$A/notes/<id>"
```

## 2. 🔴 mock 的层次(最容易翻车的一点)—— 含一条治理勘误

| 你要 mock 的 | 形状 | 依据 |
|---|---|---|
| `service.notes.list(p?)` | **已归一化的 `Note[]`**(camelCase),**不是** `{notes:[…]}` 信封 | `Service/src/notes.ts:211-215` |
| `service.notes.get/create/update/curate/archive` | **单个 `Note`**(camelCase) | `:217-246`,全部 `normalizeNote(res.data)` |
| `service.notes.remove(id)` | 🔴 **HTTP body 本身** = `{"status":"deleted","id":"<id>"}` | `:232-235` 是 **`return res.data`** —— 治理 §4.1 写「包**不剥不归一**,直接 `return res`(整个 axios 响应)」**是错的**(见报告 E-33)。⚠️ 蓝本 `NotesView.vue:261` 不读返回值,但 mock 形状仍要对(P5c §8.3:与真实契约不符的 mock 是定时炸弹) |
| `service.notes.backlinks(id)` | **数组**,空时 `[]`(不是 `{backlinks:[…]}`) | `:247-250`;类型 `unknown[]` → K41 |
| `service.notes.getSettings()` | **camelCase `{ notesRoot, autoExtract }`,只有这两个字段** | `:252-255` 走 `normalizeSettings`;HTTP 层那 3 个 distill 字段被包丢掉 |

`Note` 的 camelCase 键(`notes.ts:21-35`):
`id · title · description · type? · status? · tags: unknown[] · sourceRefs: unknown[] · createdBy ·
revision? · updatedAt · path · body?`
—— HTTP 的 `source_refs` / `created_by` / `updated_at` / `user_id`(**`user_id` 被丢掉**)。

## 3. 文件清单

| 文件 | 状态码 | 关键形状 |
|---|---|---|
| `notes-list-200.json` | 200 | `{"notes":[ 23 条 ]}`。每条 **13 个字段**:`id user_id path title description type status created_by revision created_at updated_at source_refs tags` —— 🔴 **列表里没有 `body`** |
| `notes-list-draft-200.json` | 200 | `?status=draft` → **同样 23 条**(本机全是 draft) |
| `notes-list-type-note-empty.http` | 200 | `?type=note` → **`{"notes":[]}`** → 类型筛选空态**真机可验** ✅ |
| `notes-get-one.json` | 200 | 单条 = 列表字段 **+ `body`**(实测 457 字符) |
| `notes-backlinks-empty.json` | 200 | **`{"backlinks":[]}`** → 侧栏「被引用」卡本机**不渲染** |
| `notes-settings.json` | 200 | `{"notes_root":"/DATA/Notes","auto_extract":true,"distill_roots":[],"distill_daily_cap":50,"background_model":""}` —— 后 3 个字段包里会丢 |
| `notes-create-201.json` | 🔴 **201** | 新建后 `status` = **`curated`**(不是 draft!)· `created_by` = **`human`** · `revision` = **1** · `path` = `1/<slug>-<id前8>.md` · **回包带 `body`** |
| `notes-update-200.json` | 200 | `revision` 1 → **2**;`tags` 按传入顺序 |
| `notes-update-409-conflict.http` | 🔴 **409** | **`{"detail":"revision conflict","current_revision":1}`** —— 🔴 **`current_revision` 字段名坐实存在** ✅ |
| `notes-curate-200.json` | 200 | `revision` 2 → **3**;`status` 仍 `curated`;⚠️ **`tags` 顺序被后端重排**(`["p5d-probe","edited"]` → `["edited","p5d-probe"]`);⚠️ **`body` 末尾多了一个 `\n`** |
| `notes-archive-200.json` | 200 | `status` → **`archived`**;`revision` → **4** |
| `notes-delete-200.http` | 🔴 **200**(**不是 204**) | **`{"status":"deleted","id":"<id>"}`**,64 字节,`content-type: application/json` |
| `notes-get-404.http` | 404 | `{"detail":"not found"}` |

### 3.1 🔴 `DELETE` 是 **200 + JSON 体**,不是 204 空体

治理 §4.2 / 计划 DoD 5 都按「204 空体 → axios 给 `''`」预设(那是 P5b 的 `parserDeleteJob` 契约)。
**本端点实测 `HTTP/1.1 200` + `content-length: 64` + `{"status":"deleted","id":"…"}`。**
→ `service.notes.remove` 的 mock 应是 **`{ status: 'deleted', id: '<id>' }`**,**不是 `''`**。

### 3.2 🔴 409 契约成立 —— `conflictMessage` 不需要任何兜底讨论

`noteEditHelpers.js:9` 读的正是 `r.data.current_revision`,实测该字段**存在且是数字**
→ `conflictMessage()` 返回 `Note changed elsewhere (now revision 1) — reload and retry`(truthy)
→ `NoteEditPane.vue:293` 的 `if (conflictMessage(e) && !this.isNew)` 成立 → 冲突弹窗正常开。
**治理 §4.2 担心的「字段名不同 → revision undefined」不成立,不需要写进报告当风险。**

## 4. 🔴 本机数据现状(**实测 2026-08-04 18:05,数字会漂**)—— 直接影响 §9.9 可点性清单

| 事实 | 影响 |
|---|---|
| 笔记共 **23** 条 | 列表与工具栏正常渲染;`kn-list-foot` 显示「23 条笔记 · …」 |
| 🔴 **状态分布:`draft` 23 / `curated` 0 / `archived` 0** | ✅ 草稿收件箱**整块渲染**(23 条),「全部确认」「逐条审阅」「确认/删除」**全部可点**;<br>🔴 **「全部」pill 计数 = 23、「AI 草稿」= 23、「已确认」= 0、「已归档」= 0**;<br>🔴 **「归档」按钮每行都在**(`status !== 'archived'`);**「确认」按钮每行都在**(全是 draft);<br>🔴 **`.kn-badge[data-s="curated"]` / `[data-s="archived"]` 两种徽标真机验不到**,只能 mock |
| 🔴 **类型分布:`insight` 23 / 其它 0** | 类型下拉选 `笔记`/`摘要`/`摘录` 任一 → **筛选空态 `.kn-empty-filtered` 真机可验** ✅ |
| 🔴 **`created_by` 分布:`pipeline` 23 / 其它 0** | 来源徽标只看得到「自动沉淀」+ `sparkle` 图标;`user`/`bot` 两个图标真机验不到 |
| 🔴 **`source_refs` 每条都有 `[{session_id}]`** | ✅ **侧栏「来源」卡真机渲染**(治理 §9.9 猜「手写笔记通常零 source_refs → 不渲染」,**对 pipeline 笔记不成立**),走 `v-else-if="r.session_id"` 分支 → 「打开来源对话」按钮 → `openAgentSessionInNewTab` **真机可点** |
| `backlinks` = `[]` | 侧栏「被引用」卡**不渲染**(与治理预测一致) |
| `notes_root` = `/DATA/Notes`;磁盘 `/DATA/Notes/1/` 共 **25** 个文件 | = 23 条笔记 + **2 个非笔记文件 `index.md` / `log.md`**(不出现在列表里) |
| `revision` 数量级很大(实测最大 **24522**) | `Saved · rev {n}` 与 `基于 rev {n}` 会显示 5 位数,**排版要能容得下** |
| 新建笔记的 `status` 直接是 **`curated`** | 「新建 → 保存」后**不会**出现草稿横幅;要看草稿横幅只能点已有的 23 条之一 |

## 5. 🔴 T0 的写操作与清理(治理 §13 第 3 条)

**造了 1 条笔记,已删净,并复测确认。**

| 步 | 动作 | 结果 |
|---|---|---|
| 0 | `ls /DATA/Notes/1 \| sort > before.txt` | **25** 个文件 |
| 1 | `POST /notes` 建 `P5D T0 PROBE — delete me`(tag `p5d-probe`) | 201,`id=aac91828-…`,`path=1/p5d-t0-probe-delete-me-aac91828.md` |
| 2 | `PUT` with `expected_revision:999` | 409(**拿 409 fixture 的唯一目的**) |
| 3 | `PUT` with `expected_revision:1` → `POST /curate` → `POST /archive` | 200 / 200 / 200,rev 2→3→4 |
| 4 | `DELETE /notes/aac91828-…` | **200** `{"status":"deleted",…}` |
| 5 | `GET /notes/aac91828-…` | **404** `{"detail":"not found"}` ✅ |
| 6 | `GET /notes?limit=200` | **23 条**,`tags` 里含 `p5d-probe` 的 **0 条** ✅ |
| 7 | `ls /DATA/Notes/1 \| sort > after.txt; diff before after` | **零差异,25 个文件** ✅ |

🔴 **全程没有对那 23 条真实笔记做任何写操作**(curate / archive / delete / update 一次都没碰它们)。
