# SP8-P5f · T0 报告(探测刀)

> 实现者:T0 fresh implementer · 日期 **2026-08-06** · 工作区 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI` @ `sp8-ai`
> **本刀不碰 `src/`**(§13 有自证)。产出:三份附录 + `p5f-fixtures/` + 本报告。

---

## 0. 起点 commit 实测(订正三处文档不一致)

```
$ git log --oneline -1
6d67b7b docs(p5f): 治理 + 计划书(十刀 T0-T8,含 T1b 债务刀)
$ git branch --show-current
sp8-ai
```

🔴 **勘误 E-66 —— 起点 commit 三份文档互相矛盾,全部作废,以实测为准**:

| 出处 | 写的起点 | 实测 |
|---|---|---|
| `p5f-plan.md` 表格 | `bae5d44` | ❌ |
| `p5f-common-constraints.md` §1-1 | `bae5d44` | ❌ |
| `p5f-kickoff-prompt.md` §0 表 | `4c0eaad` | ❌ |
| **实测** | — | ✅ **`6d67b7b`** |

原因:那三份文档是**协调者在落盘自己之前**写的,写的是「预期的下一个 sha」;
`6d67b7b` 就是把这三份文档落盘的那个提交本身。**无害,但下游一律引 `6d67b7b`。**

---

## 1. U-2 —— SSH fetch 真远端 + 逐文件比对(DoD 1)

```
$ git -C ../../NimoOS-UI fetch git@github.com:NimoTech/NimoOS-UI.git main
From github.com:NimoTech/NimoOS-UI
 * branch              main       -> FETCH_HEAD
FETCH_EXIT=0
$ git -C ../../NimoOS-UI rev-parse FETCH_HEAD
2608bf9b370b8b0c073f160177a8c0d496256075
```

- **远端 `main` sha = `2608bf9b370b8b0c073f160177a8c0d496256075`**
- **本期蓝本锁 = `7a6ee6b7`(U-2,P5 全期不换)**
- **SSH 通道有效**(记忆 `github-fetch-via-ssh` 兑现:未试 HTTPS,直接走 SSH,一次成功)

### 1.1 逐文件 md5 比对(锁 vs 远端)

| 蓝本文件 | 锁 `7a6ee6b7` md5 | 远端 `FETCH_HEAD` md5 | 结论 |
|---|---|---|---|
| `src/views/AI/Knowledge/WikiView.vue` | `ad9b2073b6a3da5bd2b2a4b1528264fb` | 同 | ✅ **SAME** |
| `src/views/AI/Knowledge/RootsView.vue` | `dc68c80667fc63ff5c4241efc89126d7` | 同 | ✅ **SAME** |
| `src/views/AI/Knowledge/AllowlistView.vue` | `b4294e003b3090e77bfd0d55af4df512` | 同 | ✅ **SAME** |
| `src/views/AI/Knowledge/wikiViewHelpers.js` | `1b2c6026aee9f9b803297a07ced385f8` | 同 | ✅ **SAME** |
| `src/views/AI/Knowledge/styles/knowledge.scss` | `10a418f58f7913e1b1fa606807a9f45d` | `a0df1b09758e329db223a63b0addbd7b` | ⚠️ **DIFF(仅注释)** |

🔴 **路径订正**:治理与计划书多处把 scss 写作「`knowledge.scss`」而未给全路径。
**实测全路径 = `src/views/AI/Knowledge/styles/knowledge.scss`**(带 `styles/` 一层)。
第一次比对我按 `src/views/AI/Knowledge/knowledge.scss` 取,得到 md5 `d41d8cd98f...`
—— 那是**空串的 md5**,即「文件不存在,`git show` 返回空」。**已修正后重测。**
⚠️ **这正是治理 §0.4「混了会读到空文件」的同款陷阱,下游取 scss 一律带 `styles/`。**

### 1.2 `knowledge.scss` 的唯一差异 —— 逐字给出

```diff
$ diff -u lock.scss remote.scss
@@ -1672,7 +1672,7 @@
   }
 }

-/* ===== 已收录文件 · Indexed Files page (from Claude Design "Nimo Knowledge") ===== */
+/* ===== Indexed Files page (from Claude Design "Nimo Knowledge") ===== */
 .k-confirm-icon {
```

**行数两侧都是 2561,唯一 hunk 在 `:1675`。**

🔴 **判定:不需要停下问用户。** 两条独立理由:
1. **它是注释**(`/* … */`),删掉的只是「已收录文件 · 」这个中文前缀 ⇒ **零功能性差异**;
2. **它在 `:1675`,不在本期要搬的任何一段里** —— 本期三段是 `:985-1160` / `:1342-1400` / `:2453-2561`,
   `1675` 落在 `1400` 与 `2453` 之间的**空隙**。

⇒ **U-2 判定:本期 4 个蓝本文件 + 三个 scss 段与真远端逐字节一致,锁 `7a6ee6b7` 继续有效。**

---

## 2. 四门起点基线 —— 自己重跑(DoD 2)

**全量、落盘、无 `| tail`。**

```
$ pnpm test                  > /tmp/p5f-t0-test.log 2>&1
   Test Files  335 passed (335)
        Tests  4254 passed (4254)
     Duration  74.48s
   TEST_EXIT=0        ← 零红项(grep -cE '^ *(FAIL|×)' = 0)

$ pnpm exec vue-tsc --noEmit > /tmp/p5f-t0-tsc.log 2>&1     TSC_EXIT=0
$ pnpm build                 > /tmp/p5f-t0-build.log 2>&1    BUILD_EXIT=0
$ pnpm exec sass --no-source-map src/ai/styles/knowledge.scss /dev/null
                             > /tmp/p5f-t0-sass.log 2>&1     SASS_EXIT=0
```

⚠️ 治理 §8 点名的两个已知 flaky(`persist.test.ts` / `AgentComposer.test.ts`)**本次一次跑全绿,零复跑。**

### 2.1 其它基线核对 —— 逐个实测

| 基线 | brief 给的 | 实测 | 取数命令 |
|---|---|---|---|
| `Test Files` | 335 | ✅ **335** | `pnpm test` |
| `Tests` | 4254 | ✅ **4254** | 同上 |
| `.vue` 总数 | 185 | ✅ **185** | `find src -name '*.vue' \| wc -l` |
| `color-guard` 用例数 | 187 | ✅ **187** | 见 §2.2 |
| `WHITELIST_348` 长度 | 348 | ✅ **348** | 见附录 D |
| `NON_K_HELPER_CLASSES` | 19 | ✅ **19** | 见附录 D |
| `aiKb*` 键数 | 441/441 | ✅ **441/441** | 见附录 A |
| 全表键数 | 1648/1648 | ✅ **1648/1648** | 见附录 A |

🔴 **全部对得上,无需申报偏差。**

---

*(报告分段落盘中 —— 后续小节陆续追加)*

## 3. Wiki API 现状复测(DoD 3 / §0.2 前置)

🔴 **取数路径**:**绕开网关,直连 Wiki 服务** `http://127.0.0.1:41373`
(取自 `/var/run/nimoos/wiki.url`,兑现记忆 `gateway-no-userid-injection`)。
**Parser 走 `:8283` 直连**(NimoOS-AI 对 localhost 也强制 JWT,不能走 `/v1/ai/*`)。
🔴 **全程只读,零写请求**(`POST/DELETE allowlist/*` 与 `createRoot/deleteRoot/rescanRoot` 一律未发)。

| 端点 | 状态码 | 耗时 | 响应体 | 判定 |
|---|---|---|---|---|
| `GET /v1/wiki/roots` | **000** | **90.003 s** | **0 字节** | 🔴 **超时**(curl exit 28) |
| `GET /v1/wiki/candidates` | **200** | 0.001 s | `[]`(3 字节) | 🟢 **200 但空** |
| `GET /v1/wiki/tree` | **000** | **90.002 s** | **0 字节** | 🔴 **超时** |
| `GET /v1/wiki/node?path=/DATA` | **000** | **90.003 s** | **0 字节** | 🔴 **超时** |
| `GET /v1/wiki/raw?path=/DATA` | **200** | 0.003 s | **3430 字节真 `.wiki.md`** | 🟢 **200,已抓 `.REAL`** |
| `GET /v1/ai/parser/allowlist/extensions`(直连 `:8283/v1/parser/allowlist/extensions`) | **200** | 0.005 s | 45 个扩展名 | 🟢 **已抓 `.REAL`** |
| `GET /v1/ai/parser/allowlist/folders`(同上) | **200** | 0.005 s | `{"rules":[]}` | 🟢 **已抓 `.REAL`** |

### 3.1 🔴 结论:**Wiki 没有被修好 ⇒ D1 政策按默认假设执行,不需要停下问用户**

判据是计划书 §0.2 / DoD 3 定的那条:「**`/roots` 与 `/tree` 都 200** → 停下问用户」。
**实测两者都是 90 秒超时、0 字节** ⇒ **条件不成立**,D1 默认分支继续有效。
⇒ **本期 Wiki 相关不列真机验收项;非空样本一律 `.CONSTRUCTED`。**

### 3.2 🔴 「怎么确认这是真的空/超时,而不是取法错」(§9.18-3 / R9 要求)

**A. 证明「超时」不是路径写错 —— 未知路由秒回 404:**
```
$ curl -sS -m 10 -w 'HTTP %{http_code} in %{time_total}s\n' http://127.0.0.1:41373/v1/wiki/NOSUCHROUTE
{"message":"Not Found"}
HTTP 404 in 0.000814s
```
⇒ 服务活着、Echo 路由表对**不存在的路径 0.8 毫秒就回 404**。
**那么 `/v1/wiki/tree` 挂满 90 秒只能说明:该路由存在,且 handler 卡在 DB 上。**
(与上级设计 §6.3 的根因一致:`file_events` 1.42 亿行 + `pkg/db/db.go:29 SetMaxOpenConns(1)`。)

**B. 证明 `/candidates` 的 `[]` 是真响应体 —— 连打三次、每次全新输出文件:**
```
#1 HTTP 200 0.000735s bytes=3   body=[[]]
#2 HTTP 200 0.000757s bytes=3   body=[[]]
#3 HTTP 200 0.000722s bytes=3   body=[[]]
```
⇒ `size_download=3` = `[]\n`,三次一致。**是真的空,不是取法错。**

**C. 🔴 我自己踩到的一个「假数据」并主动纠正(R9 同款向量,必须留痕):**

我第一版探测脚本用了**固定的 `-o /tmp/p5f-body.txt`**。curl 在**收到 0 字节时不会创建/清空该文件**,
于是 `/tree` 与 `/node` 那两段日志里印出来的 `--- body ---` 显示成 `[]`、`body bytes: 3`
—— **那是上一条 `/candidates` 的陈旧残留,不是 `/tree` 的响应。**

**用全新文件重测坐实:**
```
$ rm -f /tmp/tree_fresh
$ curl -sS -m 20 -o /tmp/tree_fresh -w 'HTTP %{http_code} %{time_total}s size_download=%{size_download}\n' \
        http://127.0.0.1:41373/v1/wiki/tree
curl: (28) Operation timed out after 20002 milliseconds with 0 bytes received
HTTP 000 20.002376s size_download=0
$ wc -c < /tmp/tree_fresh
/bin/bash: /tmp/tree_fresh: No such file or directory      ← 文件压根没被创建
```
⇒ **`/tree` 与 `/node` 的真实响应体是「0 字节 / 文件未创建」,上表已按真值填写。**
🔴 **登记为本期第一条自查纠正** —— 这正是 R9「取数没取全 = 和凭想象编造一样危险,而且更难发现」的同族:
**如果我没复核,附录与 fixtures 会把 `[]` 当成 `/tree` 的真机形状写进去。**

---

## 4. 零新依赖逐项实证(DoD 4 / 治理 §14 逐行)

| 能力 | 坐标(实测) | 结论 |
|---|---|---|
| `FolderBrowser` 的 `defineExpose({reset})` | `src/ai/knowledge/components/FolderBrowser.vue:97` | ✅ 在 |
| `pickerRoots` | `src/ai/knowledge/util/folderBrowser.ts` | ✅ 在 |
| store `loadRoots` | `stores/knowledgeStore.ts:654` | ✅(签名 `(opts?: {silent?: boolean})`) |
| store `loadCandidates` | `:670` | ✅ |
| store `createRoot` | `:680`(`(body: Record<string, unknown>)`) | ✅ |
| store `deleteRoot` | `:687`(`(id: string, purge?: boolean)`) | ✅ |
| store `rescanRoot` | `:693` | ✅ |
| store `loadWikiTree` | `:700`(`(rootId?) => Promise<WikiTreeNode[]>`) | ✅ |
| store `loadWikiNode` | `:715`(`=> Promise<WikiNode \| null>`) | ✅ |
| store `loadWikiRaw` | `:725`(`=> Promise<string \| null>`) | ✅ |
| store `setRootEnabled` | `:736` | ✅ **9 个 wiki action 全在** |
| store `loadAllowlist` | `:385` | ✅ |
| store `toggleExtension` | `:400` | ✅ |
| store `addFolderRule` | `:406` | ✅ |
| store `deleteFolderRule` | `:417` | ✅ **4 个 allowlist action 全在** |
| `store.toast` | `:312` | ✅(内部 `useToast().show(msg, 2400)`,R27/E-62) |
| `fmtAgo` | `stores/knowledgeStore.ts:190`,**吃毫秒** | ✅ 已导出 |
| `renderMarkdown` | `src/ai/markdown/renderMarkdown.ts` | ✅ 在 |
| `openFileInNewTab` / `openDirInNewTab` | `src/ai/services/openInApp.ts` | ✅ 在 |
| reka Dialog 原语 | `reka-ui`(`SettingsView.vue` 有先例) | ✅ 在 |

### 4.1 🔴 `createRootBody` —— 导出坐标与签名(DoD 4 点名)

```ts
// ../NimoOS-Service/src/wiki.ts:136-145         (再由 src/index.ts:28 re-export)
export function createRootBody(a: { path: string; watchMode?: string; scanIntervalH?: number; mirror?: boolean })
  : Record<string, unknown> {
  const { path, watchMode = 'auto', scanIntervalH = 6, mirror = false } = a
  return {
    Path: path,
    Level: 'space',
    WatchMode: watchMode,
    StorageMode: mirror ? 'mirror' : 'inline',
    ScanIntervalS: Math.max(1, Math.round(scanIntervalH)) * 3600,
  }
}
```
- **导出坐标**:`@nimotech/nimoos-service` → `src/index.ts:28` → `src/wiki.ts:136`。
- 🔴 **给 T5 的落地要点**:入参是 **camelCase**(`watchMode`/`scanIntervalH`/`mirror`),
  出参是 **Go 字段名 PascalCase**;**`mirror` 不是一个出参字段,它映射成 `StorageMode: 'mirror'|'inline'`**。
  ⇒ 计划书 T5-3 要求「钉住 `watchMode`/`scanIntervalH`/`mirror` 三个入参传到位」,
  **断言必须落在出参的 `WatchMode` / `ScanIntervalS` / `StorageMode` 上**(不存在名叫 `mirror` 的出参字段)。
- **`ScanIntervalS` 至少 1 小时**(`Math.max(1, …) * 3600`),包内已有单测 `wiki.test.ts:113-123` 钉住。

### 4.2 🔴 `setRootEnabled`(store action)vs `patchRootEnabled`(包内)—— 关系实测

**不是同一层的两个名字,是「store action 包着包内方法」:**

```ts
// src/ai/knowledge/stores/knowledgeStore.ts:736-747
async function setRootEnabled(id: string, enabled: boolean): Promise<void> {
  const root = wikiRoots.value.find((r) => r.id === id)
  if (!root) return
  const prev = root.enabled
  root.enabled = enabled                       // ← 乐观就地改
  try {
    await service.wiki.patchRootEnabled(id, enabled)   // ← 包内方法,发 PATCH
  } catch (e) {
    root.enabled = prev                        // ← 失败回滚
    throw e
  }
}
```
- **`setRootEnabled`** = store action(页面调它)· **`patchRootEnabled`** = 共享包 `service.wiki` 上的 HTTP 方法。
- 🔴 **它是「乐观更新 + 失败回滚」** —— 这一点是第 14 节 `toggle()` 判定的关键依据。
- ✅ 与蓝本 `knowledgeStore.js:297-307` **逐行等价**(已逐字比对)。

### 4.3 🔴 `KIcon` glyph 逐个实测(治理 §1.2,缺一个就要 NEEDS_CONTEXT)

`KIcon.vue:14` 的 `PATHS` 实测 **42 个键**(✅ 坐实 E-35/E-51 的订正,**不是 43**):

```
plus folder search chev check x play pause trash settings edit file drive history
refresh home grid user arrowRight download hourglass spinner danger test rocket eye
info target clock code chevDown chevLeft arrowDown sort tomb layers sparkle bot copy
paperclip upload funnel
```

**本期三页用到的 15 个 glyph 逐个核**:

| glyph | 用处 | 在 42 个里? |
|---|---|---|
| `file` | Allowlist 分组图标 / Wiki 子项 | ✅ |
| `edit` | Allowlist `text` 组 | ✅ |
| `code` | Allowlist `code` 组 | ✅ |
| `check` | Allowlist chip 勾 / 允许 / 保存 | ✅ |
| `x` | 弹窗关闭 / 拒绝 | ✅ |
| `plus` | 新增 | ✅ |
| `settings` | 高级选项 | ✅ |
| `drive` | 库图标 / Manage roots | ✅ |
| `trash` | 删除 | ✅ |
| `info` | 提示行 | ✅ |
| `folder` | 空态 / 打开文件夹 | ✅ |
| `refresh` | 重扫(**协调者标的「新面孔?」**) | ✅ **在** |
| `chev` | 折叠箭头 / 面包屑 | ✅ |
| `danger` | `kr-error` | ✅ |
| `layers` | `kw-pending-orb`(**协调者标的「新面孔?」**) | ✅ **在** |

🔴 **15/15 全在 ⇒ 不需要 `NEEDS_CONTEXT`,`KIcon.vue` 维持零改动。**

### 4.4 🔴 N46 定案 —— store 出口是 **camelCase**(mock 一律照它)

| 层 | 形状 | 坐标 |
|---|---|---|
| Wiki 后端 `/roots` 响应 | **PascalCase**(`ID`/`Path`/`WatchMode`/`ScanIntervalS`/`LastScanAt`/`Enabled`) | `NimoOS-Wiki/service/repo/models.go:3-18`(**struct 无 json tag**) |
| Wiki 后端 `/tree`·`/node`·`/raw` | **snake_case**(`ai_label`/`last_modified`/`child_map`/`recent_changes`) | `NimoOS-Wiki/route/v1/wiki.go:16-42,127-132` |
| POST body(`CreateArgs`) | **Go 字段名 PascalCase** | `NimoOS-Wiki/service/roots/manager.go:173-179`(**无 json tag**) |
| 🔴 **共享包归一化后(= store 出口 = 页面看到的)** | 🔴 **一律 camelCase** | `NimoOS-Service/src/wiki.ts:85`(`normalizeRoot`)· `:102`(`normalizeTreeNode`)· `:112`(`normalizeNode`) |

⇒ 🔴 **页面只会看到 camelCase**(`r.watchMode` / `r.scanIntervalS` / `r.lastScanAt` / `r.enabled` /
`n.aiLabel` / `n.lastModified` / `node.childMap` / `node.recentChanges` / `c.isOpaque` / `c.fileCount`)。
**双向归一化已在包里,本期只消费,不许再归一化一次。**
✅ 蓝本 `wikiViewHelpers.js:79` 的注释「roots are the store's **camelCase** wikiRoots」独立佐证这个结论。

**顺带坐实一个单位问题(避免下游误判成 bug)**:`WikiRoot.lastScanAt` 是 **unix 毫秒**
(`NimoOS-Wiki/main.go:266` `UpdateLastScanAt(root.ID, time.Now().UnixMilli())`),
而 `fmtAgo` 吃毫秒 ⇒ 蓝本 `RootsView:28` 的 `fmtAgo(r.lastScanAt)` **单位正确,照抄不改**。


---

## 5. 附录 A(i18n)—— 摘要,详见 `p5f-appendix-A-i18n.md`

| 项 | 终值 |
|---|---|
| distinct 键 | 🔴 **90**(静态 83 + `OP_LABEL_KEYS` 4 + `labelKey` 3) |
| zh 权威命中 | 🟢 **90/90 —— 零条需自造中文** |
| en 权威命中 | 🟢 **90/90** |
| 可复用既有 `aiKb*` | **14**(其中 3 条建议按 A-1 改新建 → 11) |
| 需新增 | **76**(或 79) |
| `wikiViewHelpers` i18n | 🟢 **0**(E-65 结案:全文 95 行零 `$t(`) |
| 占位符 | `{ext} {group} {h} {n} {path} {t}` = **6 个**,9 条键,两档逐条一致 |
| 全角标点例外 | **9 条**(§A.5 逐条 `toBe` 钉死) |
| 撞车 | **28 条**(§A.3 双向表;协调者点名的 23 项已全覆盖) |

### 5.1 🔴 「en = key」本期恰好成立 —— 但**规则仍必须遵守**(重要)

实测 **90/90 的 `en_US.json` 覆盖值等于 key 本身**。⚠️ **这是巧合**:
同一份 `en_US.json` 全表 **2676 键里 308 条(11.5%)值 ≠ 键**(样例:`lang_name → "English"`)。
⇒ 🔴 **`p5f-task-1-i18n-verify.mjs` 的 en 侧仍必须从 `en_US.json` 读**,不许写 `en === key`。
**本期即使写错也测不出来 —— 所以更要按规则写。**

### 5.2 🔴 「不进 i18n」逐个确认(**比协调者点的多一个**)

协调者点了 `kw-sec-en` 的 `Contents`(`:101`)/ `Recent changes`(`:123`)。
🔴 **T0 实扫另发现同类一个:`WikiView.vue:59` 的 `<span class="k2-tag" …>TREE</span>`**
—— 蓝本未过 `$t()` 的装饰标签。**T7 不许顺手 i18n 化。**
另有 4 个 `placeholder=` / 1 个数据兜底 `'any'` / 1 个尾缀 ` →` / glyph 名,§A.4 逐个列了。

### 5.3 🔴 本期内部撞车(协调者未点,T1 必须知道)

`AllowlistView` 的 **`enabled`**(计数后缀)与 `RootsView` 的 **`Root enabled`**(toast)
**zh 值都是「已启用」、en 值不同** ⇒ **必须是两个独立键,不许合并。**

---

## 6. 附录 B(色值)—— 摘要,详见 `p5f-appendix-B-tokens.md`

| 块 | 结论 |
|---|---|
| **K55** 三个渐变 | 🆕 新建 `--grad-ext-docs/-text/-code`,**两档同值**(同 `--grad-note-*` 模具)。①的值与既有 `--grad-note-note`/`--grad-sandbox` 逐字同值,**仍另建新名**(P5d 立的规矩) |
| **K54** 两处兜底 | `--bg-tertiary` 🔴 **全仓不存在** → `.kr-badge` 用 **`--bg-chip`**;`--border` 🔴 **不在本档映射层**(只在全局 `:root`)→ `.kr-input` 用 **`--line`**(依据:蓝本自己的 `.k-field select:1350` 就写 `var(--line)`) |
| **`color="white"`** | 🔴 **三处**(不是协调者说的一处)→ 全部 **`var(--text-on-accent)`** |
| 三个段内 hex/rgba | Allowlist A **6 处** · 弹窗 **3 处** · **Wiki 0 处(已实扫)** |
| 新建 token 总数 | 🔴 **只有 3 个**(§B.6),其余全部复用既有 |

### 6.1 🔴 `--on-accent` vs `--text-on-accent` —— 记忆那条警告的精确落点

| token | 暗档 | 亮档 | 能用? |
|---|---|---|---|
| `--on-accent`(`theme.css:48`/`:186`) | **`#16203a` 深蓝黑** | `#ffffff` | 🔴 **不能** —— 暗档是深色 |
| **`--text-on-accent`**(`knowledge.scss:177`/`:370`) | `#ffffff` | `#ffffff` | ✅ **两档恒白** |

**既定先例**:`knowledge.scss:2181-2183` 的 `.kn-inbox-icon` + `:2144` 注释原文
**「压在渐变实底上的纯白字」** ⇒ **本期三处照同一份,零发明。**

### 6.2 🔴 我差点误判的假阳性(必须留痕)

Wiki 段初扫命中 6 行「white」,逐行回读**全部是 `white-space` 属性名**
(`\bwhite\b` 在 `white-space` 里成立,`-` 是非单词字符)。**Wiki 段真色字面量 = 0 处。**
🔴 **这是 E-25 的同族**,且它给 T2 留了个坑:**色扫守卫别用 `\bwhite\b`,否则每个
`white-space` 都报红。**

### 6.3 🔴 我对 K54 论证前提的订正(显式申报)

治理 K54-③ 要求「报告要证明改后渲染语义等价(兜底只在 token 缺失时生效,而映射层保证不缺
⇒ 兜底本是死代码)」。**实测推翻了一半这个前提**:
- `--border`:全局 `:root` 有值 ⇒ **兜底确实是死代码**,论证成立 ✅
- 🔴 **`--bg-tertiary`:全仓零声明 ⇒ 兜底一直在生效**,改成 `--bg-chip` **是可见变化**,
  **不是「等价替换」**。它仍在 K54 授权范围内(「rgba 一律禁止」),且 `--bg-chip` 是蓝本
  自己对同类 999px 药丸的首选(蓝本 8 次 / 本仓 7 次居首),但 **T2 不许照抄 K54 原文那句
  「兜底本是死代码」当论证** —— 对这一处它是错的。

---

## 7. 附录 D(类清单)—— 摘要,详见 `p5f-appendix-D-classes.md`

| 项 | 值 |
|---|---|
| 三段 distinct class token | **81** |
| 死类命中 | **6**(`.k-progress-*`) |
| 已搬(不许重复搬) | **6** |
| 半搬 | **0** |
| 🔴 **本期必搬(scss 侧)** | **69** |
| 🔴 **K53 的 `kr-*`** | **9** |
| 🔴 **合计新增类** | **78** |

### 7.1 🔴 `.k-section-body` / `.k-frow` 的三态复核(协调者结论不可采信,已重做)

| 类 | 精确 class-token 扫 `.vue` | `\b` 粗扫 | 剥注释前扫 scss | **剥注释后** | 三态 |
|---|---|---|---|---|---|
| `k-section-body` | 0 个文件 | 0 次 | 3 次 | 🔴 **0** | **未搬** |
| `k-frow` | 0 个文件 | 20 次 | 4 次 | 🔴 **0** | **未搬** |

🔴 **协调者说的「3 处 / 25 处」是 scss 里的命中,而且全在注释里**
(前几期「为什么故意不搬」的说明)—— **不是 `\b` 假阳性,是注释假阳性**。
方向判对了,根因说错了。**计划书「本期要搬这两个」的结论成立,不变。**
(`k-frow` 的 `\b` 粗扫那 20 次确实也是假阳性,来自 `IndexedFilesView` 的 `k-frow-f` 一族。)

### 7.2 🔴 勘误 E-67 ——「67」与实测「69」的差 2

差的正是 `.k-section-body` 与 `.k-frow`。~~`p5-master-plan.md` **§2.1 主表记 67**,
这两个由 **§2.3「跨期漏搬」单独登记给 P5f**。⇒ `67 + 2 = 69`,两份口径一致。~~ **下游用 69。**

> 🔴 **订正(T0b · 裁定 §三 M-5)**:**结论保留(69),理由整条改写。**
> 原理由假定「§2.3 的条目天然在 §2.1 主表计数之外」,被 `.k-suggest-chip` 反例证伪
> (它同时出现在 §2.3 与 §2.4 的 P5e 52 类清单里)⇒ **那句已删,不许当通用规则用。**
> **真因**:§2 的差集法是「蓝本 693 选择器 − 本仓 293 选择器」,而本仓这两个类
> **以「为什么不搬」的注释形式存在** ⇒ 提取时若没剥注释,会被当成「本仓已有」而掉出 149 差集 → 67 而非 69。
> **完整论证见附录 D §D.0.2。**

### 7.3 🔴🔴 段边界两处必须订正(**按治理原文整段搬会出错**)

| 段 | 治理写 | 🔴 实测应取 | 为什么 |
|---|---|---|---|
| Allowlist A | `:985-1160` | 🔴 **`:985-1141`** | `:1142` `.k-set-card` 与 `:1159` `.k-set-row` **已搬**、`:1152-1157` 是 **6 个死类** —— 三者**交错**压在段尾 |
| Allowlist 弹窗 | `:1342-1400` | 🔴 **`:1342-1396`** | 🔴 **`:1398` 起是 `.k-confirm-body`,P5b-T2 早已搬(本仓 `:1541`)** ⇒ 按 `:1400` 搬会**重复定义** |
| Wiki | `:2453-2561` | ✅ 不变 | |

🔴 **计划书 §0.1-1 只说了「死类压在段尾」,漏了「已搬的 `.k-set-card`/`.k-set-row` 夹在死类两侧」
和「弹窗段尾越界到已搬的 `.k-confirm-body`」两件事。**
**T2 不许「整段搬再删死类」** —— 那样仍会带进两处重复定义。

### 7.4 🔴🔴 `NEW_RE` 实测:**`kr-*` 与 `kw-*` 都不被认**(计划书只预料到 `kr-*`)

`k(?:2|n)?-` 只接受 `k-`/`k2-`/`kn-`。**`kr-` 的 `r` 与 `kw-` 的 `w` 都不匹配。**
⇒ **41 个 `kw-*` + 9 个 `kr-*` + `cur` = 51 个类会一次性掉进 `nonKClassNames`**,
把那条**集合相等**断言打红。

**两个落法与算式**(附录 D §D.6.2):

| | 方案 A(计划书假设) | 方案 B(`fb`/`nme` 同款先例) |
|---|---|---|
| `WHITELIST_348` | **375** | **425** |
| `NON_K_HELPER_CLASSES` | **70** | **20** |

🔴 **T0 建议方案 B**(三条依据:① 那条断言的名字原文就是「防清单变垃圾桶」;
② `fb-*` 是逐字同款先例 —— P5c-T2a 从 `<style scoped>` 搬 8 个类,做法就是**加 `NEW_RE` 分支 +
进 `WHITELIST` + 加排除条件**;③ 扩 `NEW_RE` 是**加固**,本仓做过两次,配「严格超集自证」即可,
T0 已预跑 `old ⊆ new` 成立)。

🔴 **但这不是实现细节 —— 它改的是全仓守卫的扫描范围 ⇒ 列为 `NEEDS_CONTEXT`,请协调者裁定后 T2 才能开工。**

### 7.5 ✅「348 ≠ 347」那 1 差已确认真因,不许修平

`knowledge-app` 在白名单里但 `NEW_RE` 扫不到它(`k` → `n` → 需要 `-` 却是 `o`)。**正常。**

### 7.6 🔴 `kr-*` 前缀全仓唯一性(K53 落地判据④)

```
$ grep -rEc "kr-" src/ --include=*.vue --include=*.ts --include=*.scss --include=*.css | grep -v ":0"
(无输出)
```
⇒ **全仓 `kr-` 出现 = 0**(子串口径,比完整 token 更宽)⇒ **9 个类逐个无碰撞,丢 `scoped` 无害。**

---

## 8. `.CONSTRUCTED` / `.REAL` 样本(DoD 8)—— 详见 `p5f-fixtures/README.md`

| 文件 | 标签 | 说明 |
|---|---|---|
| `allowlist-extensions.REAL.json` | `.REAL` | **45 条**,🔴 **坐实 `enabled` 是整数**(类型集合 `{int}`,取值集合 `{1}`) |
| `allowlist-extensions.REPLAYED.json` | `.REPLAYED` | 🔴 **真机全是 `1`,抓不到 `0`** ⇒ 要测 chip 翻转必须用这份 |
| `allowlist-folders.REAL.json` | `.REAL` | `{"rules":[]}` |
| `wiki-candidates.REAL.json` | `.REAL` | `[]`(3 字节,连打三次一致) |
| `wiki-raw-DATA.REAL.md` | 🟢 **`.REAL`** | **3430 字节真 `.wiki.md`** —— `renderMarkdown` 的真输入 |
| `wiki-roots.CONSTRUCTED.json` | `.CONSTRUCTED` | HTTP 原始 **PascalCase**,只用于论证 N46 |
| `wiki-roots.normalized.CONSTRUCTED.json` | `.CONSTRUCTED` | 🔴 **store 出口 camelCase —— T5/T6 的 mock 用这份** |
| `wiki-tree.CONSTRUCTED.json` | `.CONSTRUCTED` | 🔴 **五种拓扑**:normal / **crossLevel** / **missingParent** / duplicate / **unsorted** |
| `wiki-node.CONSTRUCTED.json` | `.CONSTRUCTED` | `child_map`(含 omitempty 缺键项)+ **12 条** `recent_changes`(含未知 op / 空 `at` / 越前缀项) |
| `wiki-candidates.CONSTRUCTED.json` | `.CONSTRUCTED` | 非空候选 |

**构造依据的 Go 坐标**:`repo/models.go:3-18`(`WikiRoot`,无 tag)· `roots/manager.go:173-179`(`CreateArgs`,无 tag)·
`route/v1/wiki.go:16-42`(node DTO,snake_case)· `route/v1/wiki.go:126-132`(tree DTO)· `roots/candidates.go`。

---

## 9. Vue2 spec 归属判定(DoD 9)—— 🔴 **两份的初判都要订正**

🔴 **实扫蓝本 `__tests__/` 全 15 个文件**,`allowlist` 相关 spec **一个都没有**
(`AllowlistView` 在 Vue2 就零测试)。

| Vue2 spec | 行 | 真实被测对象 | 🔴 结论 |
|---|---|---|---|
| `wikiViewHelpers.spec.js` | 119 | `buildWikiTree`/`trailFor`/`opToType`/`parseTs`/`baseName`/`rootForPath`/`renderWikiMarkdown` | ✅ **属本期(T3)**,行为全部承接 |
| **`wikiRoots.spec.js`** | 73 | 🔴 **不是 `RootsView`** —— 是 `normalizeRoot`/`normalizeTreeNode`/`normalizeNode`/`createRootBody` | 🔴 **已被承接,不属本期** —— 共享包 `NimoOS-Service/src/wiki.test.ts:68` 的 describe 原文就叫 **「wiki 纯函数(移植 Vue2 wikiRoots.spec.js)」**,7 条用例一一对应 |
| **`knowledgeStoreRoots.spec.js`** | 65 | store 的 `loadRoots`/`setRootEnabled`/`createRoot` | 🔴 **已被 P5a 承接** —— 本仓 `knowledgeStore.notesWiki.test.ts:184` 的 describe 原文就叫 **「wiki 索引根(移植 Vue2 knowledgeStoreRoots.spec.js)」**,**12 条用例**(比 Vue2 的 4 条更细,含两条过期守卫)。**零缺口** |
| `dashboardWikiViews.spec.js` | 118 | **3 条,分属两期** | 见下 |

**`dashboardWikiViews.spec.js` 逐条三态**:

| # | 用例 | 归属 |
|---|---|---|
| 1 | `DashboardView (v2)` —— 骨架 → 四个界面 → 空态 | ✅ **已被 P5a 承接**(`DashboardView.test.ts:132,145,272,286,321,549`,且更细) |
| 2 | `WikiView` 渲染树 + 完整文章 | 🔴 **属本期 —— T6 + T7** |
| 3 | `WikiView` raw 404 → 「无摘要」态 + 重扫按钮 | 🔴 **属本期 —— T7**(计划书 T7-3 已覆盖) |

🔴 **治理 §4.3 把 `wikiRoots.spec.js` 的被测对象写成「`RootsView`」并判「✅ P5f,行为承接」是错的**
—— 登记为 **勘误 E-68**。**T5 不需要承接它**(它测的东西在共享包里,而共享包本期零改动)。
🔴 **我没有改任何 store / Dashboard 的测试**(都在零改动清单上);**两处缺口均为零,无需协调者裁定归属。**

---

## 10. §9.17 可点性清单实测(DoD 10,9 项)

| # | 屏 / 元素 | 条件 | 🔴 本机实测判定 |
|---|---|---|---|
| 1 | `RootsView` 根列表 | `roots.length` | 🔴 **不可达** —— `/roots` 90 s 超时 ⇒ `wikiRoots` 恒 `[]`,只能看到 `kr-empty` |
| 2 | `RootsView` 新增弹窗 | 点「添加根目录」 | 🟢 **可达**(纯前端);但 `FolderBrowser` 候选恒空(`/candidates` 实测 `[]`) |
| 3 | `RootsView` `kr-error` / 镜像按钮 | 409 响应 | 🔴 **不可达** —— 请求是超时不是 409。**不列真机验收项** |
| 4 | `WikiView` 左树 | `treeRoots.length` | 🔴 **恒走 `treeError`**(`/tree` 90 s 超时)⇒ 只能验「加载失败 + 重试」 |
| 5 | `WikiView` 空树 onboarding(`kw-pending`) | `!treeError && !treeRoots.length` | 🔴 **不可达**(是 error 不是 empty)。**不列真机验收项** |
| 6 | `WikiView` 文章/目录/最近变更/查看源码 | `sel` 非空 | 🔴 **全不可达** |
| 7 | `AllowlistView` 两个分区 | Parser 可用 | 🟢 **全部可达,且是写操作** ⇒ 逐个列真机验收项 + **标红 + 恢复步骤** |
| 8 | `AllowlistView` 「无规则」空态 | `folderRules.length === 0` | 🟢 **本机初始就是这个态**(实测 `{"rules":[]}`) |
| 9 | `AllowlistView` 自定义扩展名区 | `v-if="customOpen"` | 🟢 **可达**,要先点「高级:自定义扩展名」 |

🔴 **协调者原表 9 项全部实测坐实,零订正。**

### 10.1 🔴 补一条协调者表里没有的(验收清单要写)

**`AllowlistView` 的三个分组标题(Documents / Text / Code)本机全部会渲染** ——
~~实测 45 个扩展名里 docs 组命中 9 个、text 组 13 个、code 组 20 个~~,**三组都非空**
⇒ `filter(g => g.exts.length > 0)` **不会隐藏任何一组**,三个 chip 区都可点。
⚠️ **但 45 条全是 `enabled: 1`** ⇒ **「取消勾选」可验,「勾上」需要先取消再勾回**(恢复步骤要写)。

### 🔴🔴 10.1.1 订正块(T0b · 裁定 **R6** / 评审 **I-3**)—— **三个命中数全错,且漏报 `.wps`**

**原缺陷**:上面那三个数字(9 / 13 / 20)**全部是错的**,且遗漏了本机唯一一条**三组都不匹配**的扩展名。

🔴 **T0b 自己实算的结果**(拿 `p5f-fixtures/allowlist-extensions.REAL.json` 的 45 条,
逐条过蓝本 `AllowlistView.vue:161/163/165` 三张 `match` 表;命令与完整输出见 `p5f-task-0b-report.md` §3):

```
REAL total = 45
  docs matches 11
  text matches 12
  code matches 21
  sum shown = 44
  UNMATCHED(页面不渲染): ['.wps(enabled:1)']
```

| 项 | T0 原写 | 🔴 **订正终值** |
|---|---|---|
| docs 组命中 | ~~9~~ | **11** |
| text 组命中 | ~~13~~ | **12** |
| code 组命中 | ~~20~~ | **21** |
| 三组合计**显示** | ~~42~~ | **44** |
| **未命中任何组** | ~~未报~~ | 🔴 **1 条:`.wps`(`enabled: 1`)** |

**「三组都非空、都可点」这条结论不变** ✅(11/12/21 全 > 0)。

### 🔴🔴 10.1.2 `.wps` —— **N54 的本机真实命中,是蓝本行为不是缺陷**

`GROUPS_TEMPLATE` 只有 `docs` / `text` / `code` **三张写死的 `match` 表**(共 50 项,见附录 D §D.3.2 / E-74),
**没有「其它」兜底组**。本机 Parser 认了 45 个扩展名,其中 **`.wps` 不属于三组中的任何一组**
⇒ 它在白名单页上**根本不渲染**:**既显示不出、也开不了、也关不了**。

⇒ **页面只显示 44 个,Parser 认 45 个。**

🔴 **这是 N54 逐字照抄蓝本三张表的必然后果 = 蓝本行为,不是 P5f 引入的缺陷。**
🔴 **改它就是改蓝本行为,违「界面严格 1:1」** ⇒ **不在 P5f 范围**(已按 R6-③ 开成**票 E**,
见 `p5f-coordinator-rulings-T0.md` §四)。

🔴 **收官验收清单必须写这一条**,原文照下面这个意思写:

> 「Parser 认了 **45** 个扩展名,白名单页只显示 **44** 个 —— `.wps` 虽然是启用状态,
> 但它不属于 Documents / Text / Code 三个分组中的任何一组,所以页面上看不到它。
> **这是 Vue2 蓝本本来就有的行为(N54),不是本期迁移的缺陷**,请不要当 bug 报。」

⚠️ **为什么必须主动写进验收清单**:不写,机主一定会数出「45 vs 44」并当成迁移丢了数据。
⚠️ **具体计数有保质期**(治理 §13-2):验收清单要附现测命令
`curl -s http://127.0.0.1:8283/v1/parser/allowlist/extensions | python3 -m json.tool | grep -c '"ext"'`,
**别把 45 / 44 钉死成永久数字**。

---

## 11. `openNoteInNewTab` 判定(DoD 11)—— 🟢 **复核结案:继续不补**

```
WikiView.vue        : 0 处
RootsView.vue       : 0 处
AllowlistView.vue   : 0 处
wikiViewHelpers.js  : 0 处
```
**且本仓 `src/ai/services/openInApp.ts` 压根没有这个导出**(只有 `openPhotoInNewTab` /
`openFileInNewTab` / `openDirInNewTab` / `openPhotoSetInNewTab` / `openAgentSessionInNewTab`)。
🔴 **协调者初测正确。补了就是死代码 ⇒ 本期继续不补,转下一期。**
`WikiView` 用的是 **`openFileInNewTab`(`:290`)与 `openDirInNewTab`(`:293`)**,两个本仓都有。

---

## 12. K58 的既定错误映射坐标(DoD 12)

🔴 **实测结论:本仓没有「错误映射函数」,既定做法是一个模具**:
**catch 里丢掉 `e.message`,直接用一个固定 i18n 键。**

| 形态 | 坐标 | 用法 |
|---|---|---|
| **A. 固定键,无前缀拼接**(主流) | `QueueView.vue:212-217` · `:241-246` | `catch { store.toast(t('aiKbCancelFailed')) }` |
| 同上 | `IndexedFilesView.vue:592-593` · `:612-613` | `catch { store.toast(t('aiKbRebuildFailed')) }` |
| 同上 | `NoteEditPane.vue:461,474,488,501` | `aiKbOpFailed` 模具(P5a 起) |
| **B. 保留蓝本固有的「前缀 + 第二句」**(仅当第二句是**固定 i18n 串**) | `QueueView.vue:271-275` + 文件头 `:39-48` | `t('aiKbCancelFailed') + ': ' + t('aiKbCannotCancel')`(409 分支) |

🔴 **判据(`IndexedFilesView.vue:193-196` 注释原文)**:
> 「`aiKbRebuildFailed`,**无第二句可拼故不留 `': '` 前缀** —— 与 T5 在 `QueueView.vue` 里
> bulkCancel/cancelOne 等 catch 分支同一模具」

⇒ **本期落法(T4 的 5 处 + T5 的非 409 分支)**:
蓝本是 `$t('Save failed') + ': ' + (e.message || e)`,**第二句正是 K5 禁止回显的 `e.message`**
⇒ **没有第二句可拼** ⇒ 🔴 **用固定键、不留 `': '` 前缀**,形态 A。
**`RootsView` 的 409 分支(N50)例外**:那是蓝本固有的**固定文案**,照抄(形态 B 的同族)。

🔴 **找到了既定做法,不需要协调者裁定,也不许各页自造第二套。**

---

## 13. `src/` 零改动自证(DoD 13)

```
$ git diff --name-only -- src/
(空)
$ git status --porcelain -- src/
(空)
```
✅ **本刀零 `src/` 改动。** 产出全部落在 `.superpowers/sdd/`(gitignore 覆盖,已 `git add -f`)。

---

## 14. 🔴 `RootsView.vue:163-173` 的 `toggle()` 判定(协调者点名)

### 结论:**不是蓝本 bug。照抄,不许「改正确」。**

**蓝本原文**:
```js
async toggle(r) {
  await this.store.actions.setRootEnabled(r.id, !r.enabled)
  this.store.actions.toast(r.enabled ? this.$t('Root enabled') : this.$t('Root disabled'))
}
```

**表面看**:调的是 `!r.enabled`,toast 却读 `r.enabled` —— 像是反了。
**实际不是**,依据是 `setRootEnabled` 的**乐观就地更新**:

```js
// 蓝本 knowledgeStore.js:297-307(本仓 knowledgeStore.ts:736-747 逐行等价)
async setRootEnabled(id, enabled) {
  const root = state.wikiRoots.find(r => r.id === id)
  if (!root) return
  const prev = root.enabled
  root.enabled = enabled          // ← 乐观:await 之前就把同一个对象改了
  try { await wiki.patchRootEnabled(id, enabled) }
  catch (e) { root.enabled = prev; throw e }
}
```

**逐步推演**:
1. `!r.enabled` 在**调用那一刻同步求值** → 目标值(设原为 `true`,则传 `false`);
2. `roots` computed 返回的就是 `store.state.wikiRoots`,`v-for` 里的 `r` 与
   `find(r => r.id === id)` 找到的 **`root` 是同一个对象引用**;
3. `setRootEnabled` 在 `await` **之前**执行 `root.enabled = enabled` ⇒ **`r.enabled` 已变成新值**;
4. `await` 成功返回后,`r.enabled` === 新值;
5. toast 读 `r.enabled` ⇒ **读到的是新值** ⇒ `false → 'Root disabled'` ✅ **正确**;
6. 失败路径:`setRootEnabled` 回滚 `root.enabled = prev` **并 `throw`** ⇒ 走 `catch`,**根本不执行那行 toast** ✅。

⇒ **两条路径都正确。** 这不是 bug,是「依赖乐观更新的就地可变性」的写法
—— 可读性差,但**行为对**。

### 🔴 给 T5 的落地要求(比「照抄」多一层)

本仓 `knowledgeStore.ts:736-747` 与蓝本**逐行等价**(乐观更新 + 回滚 + 上抛都在)⇒ **照抄成立。**
🔴 **但这条正确性完全挂在「store 就地改的是同一个对象」上**,而本仓 store 是 Pinia `ref<WikiRoot[]>`
—— 若将来 `loadRoots` 改成整体替换数组,这里会**静默变错**。
⇒ 🔴 **T5 必须配一条钉住这个不变量的用例**:
「`setRootEnabled` 成功后 toast 文案是**新**状态」+「**失败时不弹成功 toast**」两侧,
**判据:把 store 的 `root.enabled = enabled` 挪到 `await` 之后 → 第一条必须报红。**
**不许只断「调用了 setRootEnabled(id, !enabled)」** —— 那测不出 toast 方向。

⚠️ **计划书 T5-7 写的「实现者必须自己判定这是不是蓝本 bug:若是 ⇒ 改正确 + 三件套」**
—— **T0 判定为「不是 bug」**,故 **T5 走「论证为什么不是」那一支**,并按上面加守卫。

---

## 15. 🔴 NEEDS_CONTEXT —— 请协调者裁定(**T2 开工前必须有结论**)

### N-1 🔴🔴 `kw-*` / `kr-*` 都不被 `NEW_RE` 认 ⇒ 守卫落点二选一(**影响 T2 的两个数字**)

见 §7.4 与附录 D §D.6。**方案 A:`WHITELIST` 375 / `NON_K` 70** · **方案 B:`WHITELIST` 425 / `NON_K` 20**。
**T0 建议 B**(`fb-*` 逐字同款先例 + 那条断言原文就是「防清单变垃圾桶」+ `old ⊆ new` 已预跑成立)。
🔴 **它改的是全仓守卫的扫描范围,不是实现细节** ⇒ **不许实现者自选。**

### N-2 🔴 P5b 判的 `.k-frow` `@media` 死规则,**前提在本期到期**

见附录 D §D.9。P5b 的判据原文是「**两个模板里没有任何元素用 `class="k-frow"`**」——
而 `AllowlistView.vue:69,75` **用的正是 `class="k-frow"`**。
⇒ 蓝本 `:1500-1503` 的窄屏列宽覆盖在蓝本里是**活规则**,New-UI 会缺 ⇒ **窄屏下列宽与 Vue2 不一致**。
🔴 **它不在本期三个段里(治理只授权三段),且要动 P5b 的 `@media` 块** ⇒ **T0 不自行决定。**
**建议:搬**(否则「界面 1:1」在窄屏这档不成立,且这是 P5f 引入 `k-frow` 的直接连带)。

### N-3 ⚠️ `Delete` / `Auto` / `Removed` 三条「同值但语义域不同」的复用判断

见附录 A §A.2 末。**T0 建议按 A-1 新建**(`aiKbRtDelete` / `aiKbRtWatchAuto` / `aiKbWkOpRemoved`),
则「可复用 14 / 新增 76」→「可复用 11 / 新增 79」。**T1 拍板并显式申报即可,不阻塞 T2。**

---

## 16. 🔴 勘误汇总(本期新增,编号续 E-63)

| # | 出处原文 | 实测 | 处置 |
|---|---|---|---|
| **E-66** | 起点 commit:计划书/治理写 `bae5d44`、kickoff 写 `4c0eaad` | 🔴 **实测 `6d67b7b`** | 下游一律引 `6d67b7b`(§0) |
| **E-67** | `p5-master-plan.md` §2.1 给 P5f 记 **67 类** | 🔴 **实测差集 69** —— 差的 2 个(`.k-section-body`/`.k-frow`)被 §2.3 单独登记 | `67 + 2 = 69`,**下游用 69**(§7.2) |
| **E-68** | 治理 §4.3 把 `wikiRoots.spec.js` 的被测对象写成「`RootsView`」并判「✅ P5f,行为承接」 | 🔴 **它测的是 `normalizeRoot`/`normalizeTreeNode`/`normalizeNode`/`createRootBody`**,已由共享包 `wiki.test.ts:68` 承接 | **T5 不需要承接它**(§9) |
| **E-69** | 治理 §6.1 / 计划书 T2-1 的段边界 `:985-1160` 与 `:1342-1400` | 🔴 **应取 `:985-1141` 与 `:1342-1396`** | 已搬类与死类**交错**压在段尾;弹窗段尾**越界到已搬的 `.k-confirm-body`**(§7.3) |
| **E-70** | 计划书 §5.1 / §13-4 写「rail 第 **7/6/3** 项(Allowlist/Roots/Wiki)」 | 🔴 **实测 `KnowledgeLayout.vue:55-63`:wiki=**3** · roots=**7** · allowlist=**8**(settings=9) | **验收清单按 3 / 7 / 8 写**(§17) |
| **E-71** | 治理 §6.3 只把 `color="white"` 记成 `AllowlistView.vue:30` **一处** | 🔴 **实测三处**:模板 `:30` + scss `:1003`(`.k-extgroup-icon`)+ scss `:1045` | 三处全部 → `--text-on-accent`(附录 B §B.3) |
| **E-72** | 治理 K54 表头写「**3 处** `var(--x, <字面量>)` 兜底」,正文写「两处」 | 🔴 **实测 2 处**(`:243` `:254`) | 以 **2 处**为准(附录 B §B.2) |
| **E-73** | 治理 K54-③ 论证「兜底只在 token 缺失时生效,而映射层保证不缺 ⇒ 兜底本是死代码」 | 🔴 **对 `--border` 成立;对 `--bg-tertiary` 不成立**(全仓零声明 ⇒ 兜底一直在生效) | **T2 不许照抄那句当论证**(§6.3) |
| 🔴 **E-74**(T0b 补) | 治理 §3.5 N54 / 计划书 T4-4 写扩展名表「**12+13+24**」 | 🔴 **实测 `12+13+25 = 50`**(T0b 程序化数蓝本 `AllowlistView.vue:161/163/165`) | T4 brief 用 **50**;三条断言 `toBe(12)/toBe(13)/toBe(25)`。逐项清单见**附录 D §D.3.2** |
| 🔴 **E-75**(T0b 补,**反转登记**) | 评审 `p5f-task-0-review.md` §6 **M-2** 主张 `p5e-fixtures/scripts/sim-r8r9.mjs`「不存在」,并据此指控 `p5e-handoff-to-p5f.md:70` 那句不成立 | 🔴 **实测该脚本存在、被 git 跟踪、在 HEAD 里、`exit=0` 且复现出 348 vs 347 基线** ⇒ **M-2 的事实前提不成立** | **附录 D §D.6.4 的命令不改**;`p5e-handoff-to-p5f.md:70` **成立**。详见**附录 D §D.6.4.1** |
| 🔴 **E-76**(T0b 补) | T0 报告 §10.1 写三组真机命中「docs 9 / text 13 / code 20」 | 🔴 **实测 11 / 12 / 21**,合计显示 **44**;另有 **`.wps`(`enabled:1`)三组都不匹配 ⇒ 页面不渲染** | 订正见 **§10.1.1**;`.wps` 是 **N54 蓝本行为不是缺陷**,**收官验收清单必写**(§10.1.2),已开**票 E** |
| 🔴 **E-77**(T0b 补) | T0 附录 A §A.3.1 只枚举了「不可复用」的 7 行,读起来像是**全部**单侧撞车 | 🔴 **实测另有 5 行单侧撞车未列**,其中 **`Removed` 有 en 单侧撞车 `addPanelRemovedToast`** | 补齐见**附录 A §A.3.0 / §A.3.1a**;🔴 **T1 仍必须自己重跑双向扫描**(治理 §7.1) |

## 17. 🔴 rail 序号现测(E-70)

```
KnowledgeLayout.vue:55-63
 1 dashboard   2 search   3 wiki   4 notes   5 indexed-files
 6 queue       7 roots    8 allowlist        9 settings
```
⇒ **本期三屏 = 左栏第 3(Wiki)/ 第 7(索引目录)/ 第 8(白名单)项。**
**验收清单第一项的导航路径按这个写**,不是计划书的 3/6/7。
`DEFERRED_TABS` 实测仍是 `['wiki','roots','allowlist']` **3 项**,与计划书一致 ✅。

## 18. 命中的 K / N 条目申报

**本刀不改产品码,故只申报「调查结论影响到的」条目:**

| 条目 | T0 的结论 |
|---|---|
| **K53** | 9 个 `kr-*` 已逐个登记(附录 D §D.5);前缀全仓唯一性已证 |
| **K54** | 🔴 **2 处**(不是 3);`--bg-tertiary` 不存在 → `--bg-chip`,`--border` 不在本档层 → `--line`;**论证前提订正见 E-73** |
| **K55** | 三个渐变 → 3 个新建 token,两档同值;定向断言判据已给 |
| **K56 / K57 / K59** | 本刀未涉及,无订正 |
| **K58** | 🔴 **既定做法已找到**(§12),形态 A;**不需要裁定,不许自造** |
| **N46** | 🔴 **store 出口 = camelCase**,三层命名已逐层给坐标(§4.4) |
| **N47** | 🔴 **`enabled` 是整数**,`.REAL` 已坐实;**但真机全 `1`** ⇒ 翻转测试须用 `.REPLAYED` |
| **N50 / N51** | 本机 409 与 404 分支:409 **不可达**(超时),404 **不可达**(超时,不是 404)—— §10 已登记 |
| **N58** | `childPath` 的恒等式与 `opToType` 兜底已在样本里埋了对应形态 |
| **E-65** | 🟢 **复核结案:`wikiViewHelpers` i18n = 0** |
