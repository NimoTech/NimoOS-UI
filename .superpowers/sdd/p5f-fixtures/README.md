# P5f 后端样本(T0 产出,2026-08-06)

> 🔴 **用法照 P5c §4.4**:**抄进测试文件 + 注释标出处 + 程序化逐字节等价校验**;
> **不许在运行时读 `.superpowers/`**(它不在构建产物里,`?raw` 在 vitest 下恒空 —— 铁律)。
> 🔴 **三级出处标签必须写进测试注释**(裁定 R3 约束 1)。

## 0. 三级出处标签的口径

| 标签 | 含义 | 本期哪些 |
|---|---|---|
| **`.REAL`** | **本机真机抓的原始响应,一字未改** | `allowlist-extensions` · `allowlist-folders` · `wiki-candidates`(空)· `wiki-raw-DATA` |
| **`.REPLAYED`** | **真机响应的形状,只改了值**(字段名/类型/枚举一字未动) | `allowlist-extensions.REPLAYED` |
| **`.CONSTRUCTED`** | **接口打不通,按 Go 结构体逐字段构造** | 全部 `wiki-roots` / `wiki-tree` / `wiki-node` / `wiki-candidates.CONSTRUCTED` |

🔴 **`.CONSTRUCTED` 不许被说成「真机数据」,也不许拿它去推翻 N46 的命名结论**
(§9.18-2:命名依据只能来自 Go 源码或共享包的归一化代码)。

## 1. 取数条件(2026-08-06 实测,**有保质期**)

| 端点 | 取法 | 结果 |
|---|---|---|
| `/v1/wiki/*` | **直连** `http://127.0.0.1:41373`(`/var/run/nimoos/wiki.url`),**不经网关** | `roots`/`tree`/`node` **90 s 超时 0 字节**;`candidates`/`raw` 200 |
| Parser allowlist | **直连** `http://127.0.0.1:8283/v1/parser/allowlist/{extensions,folders}` | 200 |

🔴 **为什么绕开网关和 `/v1/ai/*`**:记忆 `gateway-no-userid-injection`(网关不注入 `X-NimoOS-User-ID`)
\+ **NimoOS-AI 对 localhost 也强制 JWT** ⇒ 走 `/v1/ai/parser/*` 会 401。**直连 Parser 是唯一取法。**

**现测命令**(数字会漂,以现测为准):
```bash
W=$(cat /var/run/nimoos/wiki.url)
curl -sS -m 90 -w '\nHTTP %{http_code} %{time_total}s size=%{size_download}\n' "$W/v1/wiki/roots"
curl -sS -m 20 -w '\nHTTP %{http_code} %{time_total}s size=%{size_download}\n' "$W/v1/wiki/candidates"
curl -sS -m 20 http://127.0.0.1:8283/v1/parser/allowlist/extensions | python3 -m json.tool | head
```
⚠️ **`wiki.url` 的端口每次 Wiki 服务重启都会变**(随机端口 + 文件发现),别把 `41373` 写死进任何脚本。

## 2. 文件清单

| 文件 | 标签 | 形状层 | 给谁用 |
|---|---|---|---|
| `allowlist-extensions.REAL.json` | `.REAL` | HTTP 原始 | T4 —— **坐实 `enabled` 是整数**(45 条,实测 `enabled` 取值集合 = `{1}`、类型集合 = `{int}`) |
| `allowlist-extensions.REPLAYED.json` | `.REPLAYED` | HTTP 原始 | T4 —— 🔴 **真机全是 `1`,抓不到 `0`** ⇒ 要测 chip 翻转必须用这份 |
| `allowlist-folders.REAL.json` | `.REAL` | HTTP 原始 | T4 空态(`{"rules":[]}`) |
| `wiki-candidates.REAL.json` | `.REAL` | HTTP 原始(透传) | T5 —— 空候选态(`[]`) |
| `wiki-candidates.CONSTRUCTED.json` | `.CONSTRUCTED` | HTTP 原始(透传) | T5 —— **非空** `FolderBrowser` 候选 |
| `wiki-raw-DATA.REAL.md` | `.REAL` | 纯文本 | 🔴 **T7 的 `renderMarkdown` 真输入**(3430 字节真 `.wiki.md`) |
| `wiki-roots.CONSTRUCTED.json` | `.CONSTRUCTED` | **HTTP 原始 PascalCase** | 只用于论证 N46,**不要拿它 mock 页面** |
| `wiki-roots.normalized.CONSTRUCTED.json` | `.CONSTRUCTED` | 🔴 **store 出口 camelCase** | **T5 / T6 的 mock 一律用这份** |
| `wiki-tree.CONSTRUCTED.json` | `.CONSTRUCTED` | HTTP 原始 snake_case | T3 —— 五种拓扑(§9.16) |
| `wiki-node.CONSTRUCTED.json` | `.CONSTRUCTED` | HTTP 原始 snake_case | T7 —— `child_map` / `recent_changes` |

## 3. 🔴 mock 层次(§4.1 的表,T0 实测终值)

| mock 什么 | 形状 | 依据 |
|---|---|---|
| `store.state.wikiRoots` | 🔴 **camelCase** | `NimoOS-Service/src/wiki.ts:85 normalizeRoot` |
| `store.loadWikiTree()` | **扁平数组**,camelCase(`aiLabel`/`lastModified`) | `wiki.ts:102 normalizeTreeNode` |
| `store.loadWikiNode(p)` | `WikiNode \| null`,camelCase(`childMap`/`recentChanges`/`isOpaque`/`fileCount`) | `wiki.ts:112 normalizeNode`;**404 → null**(N48) |
| `store.loadWikiRaw(p)` | `string \| null`;**404 → null** | `knowledgeStore.ts:725` |
| `store.state.wikiCandidates` | 🔴 **原样透传,不归一化**(`path`/`type`/`size?`/`label?`) | `wiki.ts:154-157` |
| `store.state.extensions` | **已归一化**(`enabled` 已 `!!` 成 boolean) | `knowledgeStore.ts:395` |
| `store.state.folderRules` | 原样(`{id, root_id, path_glob, action}`) | `knowledgeStore.ts:396` |
| `store.createRoot(body)` | 入参 = `createRootBody(...)` 出参 = **Go 字段名 PascalCase** | `wiki.ts:136` |

## 4. 🔴 构造依据的 Go 坐标(§9.18-1 要求逐份写明)

| 样本 | Go 坐标 | 命名风格 |
|---|---|---|
| `wiki-roots` | `NimoOS-Wiki/service/repo/models.go:3-18`(`WikiRoot`,**无 json tag**) | **PascalCase** |
| POST body(`createRoot`) | `NimoOS-Wiki/service/roots/manager.go:173-179`(`CreateArgs`,**无 json tag**) | **PascalCase** |
| `wiki-tree` | `NimoOS-Wiki/route/v1/wiki.go:126-132`(匿名 `sk`) | **snake_case** |
| `wiki-node` | `NimoOS-Wiki/route/v1/wiki.go:16-42`(`nodeResponse`/`nodeChildEntry`/`nodeRecentEntry`) | **snake_case** |
| `wiki-candidates` | `NimoOS-Wiki/service/roots/candidates.go`(`Candidate`) | **snake_case**,`Size`/`Label` 带 `omitempty` |

🔴 **同一个域两种命名风格是本期最容易搞错的一点(N46)** —— 归一化在共享包里,**本期只消费**。

## 5. 🔴 构造时刻意埋进去的「会分辨错实现」的形态

| 样本 | 埋了什么 | 服务于 |
|---|---|---|
| `wiki-tree.crossLevel` | `/a` 与 `/a/b/c` 在、`/a/b` **不在** ⇒ 父必须是 `/a` | §9.16-② · **判据:`findParent` 换成「只切一级」→ 必须报红** |
| `wiki-tree.missingParent` | 只有 `/x/y/z` ⇒ 成为根且 `name` 是**全路径** | §9.16-① |
| `wiki-tree.duplicate` | 两行同 `path` ⇒ `byPath` 去重分支 | §9.16-③ |
| `wiki-tree.unsorted` | `/u/b` 排在 `/u` **前面** | §9.16-④ · **判据:删掉 `sort` → 必须报红** |
| `wiki-node.child_map[3]` | `Archive` **省掉** `file_count`/`last_modified`/`is_opaque` 三键(omitempty 零值) | N49 的 `\|\| 0` / `!!` 兜底 |
| `wiki-node.recent_changes` | **12 条** + 一个未知 op `chmod` + 一条 `at: ""` + 一条**不在 root 前缀下**的 `/outside/a6.md` | T7 的 `.slice(0,10)` 上限 · `opToType` 兜底(N58)· `c.at ? … : ''` · **前缀剥离的两侧** |
| `allowlist-extensions.REPLAYED` | `enabled` 有 `0` 也有 `1` | N47 —— 真机全 `1`,不造就测不到翻转 |

## 6. ⚠️ 已知局限(不许当成真机结论)

1. **`wiki-candidates` 的非空形态从未经真机验证** —— 共享包类型注释自己就写了这句
   (`wiki.ts:25-36`:「完全靠蓝本注释 + 后端源码推导」)。
2. **`wiki-node` 的 `summary` 后端当前恒 `null`**,非 null 形态无从取样。
3. **`allowlist` 的 `source` 实测只有 `"default"` 一个值** —— 自定义扩展名加进去之后是什么值,
   **本期未验**(T0 只读,不发 `POST`)。T4 若需要该分支,按 `.CONSTRUCTED` 另标。
4. **所有真机计数有保质期**(45 个扩展名 / `rules: []`)—— 验收清单按治理 §13-2 写现测命令。
