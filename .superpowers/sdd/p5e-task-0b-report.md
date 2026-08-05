# SP8-P5e Task 0b 报告 —— T0 整改轮(Important 1/2/3 + 6 条 Minor)

**状态:DONE_WITH_CONCERNS**(顾虑见 §7,无阻塞)
**日期**:2026-08-05 · 仓 `.sp8/NimoOS-New-UI` @ `sp8-ai`,整改前 HEAD `a3f5187`
**依据**:`p5e-coordinator-rulings-T0.md`(R1–R8)· `p5e-task-0-review.md`(C0 / I3 / M9)
**边界遵守**:只改 `p5e-fixtures/**` 与三份附录 + 本报告 ·
🔴 **未 `git add`、未 `git commit`**(T1 并发在同一工作树上跑三门)·
🔴 **未跑 `pnpm test` / `pnpm build` / `vue-tsc`** · 未碰任何 dev server · 未碰 `src/` ·
`NimoOS-UI` 全程只 `git show` / `git ls-tree`(零 checkout / stash / commit)。

---

## 0. 一页速览

| # | 事 | 结果 |
|---|---|---|
| **Imp-1** | `replay.md` 不存在 | ✅ **已补写**(310 行)+ 新增 `scripts/replay-fixtures.mjs`(一条命令全量重跑) |
| **Imp-2** | `.REPLAYED` 有未申报加工 | ✅ **选方案(甲)去掉加工**;README §3 重写成完整人工成分清单;🔴 **自查又发现第 4 类**(见 §2.3) |
| **Imp-3** | 8 脚本 7 个 ENOENT | ✅ **10/10 可跑,exit 全 0**(新增共享输入层 `scripts/_inputs.mjs`,输入全部自取) |
| Minor-1 | §A.0 的 bash 跑出 466 | ✅ 换成 `scan-i18n2.mjs`,并写明原命令为什么错 |
| Minor-2 | E-53 的理由不成立 | ✅ 按裁定 R4 改成「差异原因未查明,不影响本期」+ 穷举口径表 |
| Minor-3 | `:103-119` 会丢 `:102` 的 `}` | ✅ 附录 B §B.4 与 D §D.2 都改成 **`:102-119`** |
| Minor-4 | E-55 漏算 `.path` | ✅ 改成「漏列 **3** 个」,并把 `.path` 补进漏列表 |
| Minor-5 | §D.0「52 个全落 TO-MOVE」不成立 | ✅ 改成「53 个里 51 个落 TO-MOVE,另 2 个归 §D.4 / §D.6;**一律以 §D.1 的 TO-MOVE 清单为准**」 |
| Minor-6 | `.k-modal-bg` z-index 没给终值 | ✅ 照抄评审结论:**蓝本 `:1302` 与本仓 `:1146` 都是 1100,与 host 并列是蓝本原生 ⇒ K46 无需任何决定** |
| Minor-7 | anchor 缺席无 fixture | ✅ 新增 **`F12-search-chunk.anchor-absent.CONSTRUCTED.json`**,D-6 模具登记 |
| Minor-9 | 「348≠347」的理由错 | ✅ 改成真因 **`knowledge-app` 匹配不上 `NEW_RE`**(数字与「不许修平」不动) |

**未动的**:Minor-8(三门日志落 `/tmp`)—— 那是「后续刀把日志落进仓里」的建议,不在本轮授权范围
(本轮禁跑三门);已在 §7 顾虑里转给协调者。

---

## 1. Imp-1 —— `replay.md` 补写

**新增两个文件**:

| 文件 | 内容 |
|---|---|
| `p5e-fixtures/replay.md` | 8 节:为什么必须重放 · 环境前提(含设备状态基线)· F0a 的 curl · F0+F5 的 curl + Go 路径对照表 · **F0b+F5b 的 2 处手工成分逐条申报** · F0c+F6/F6b 的窗口取数 · F12 的构造依据 · **T0 第一版 4 类问题的留痕** · 10 个脚本的跑法 |
| `p5e-fixtures/scripts/replay-fixtures.mjs` | **一条命令重跑 F0a/F0/F0b/F0c/F5/F5b/F6/F6b/F12**;`--dry` 只打印;`--reembed` 强制重算 embedding |

🔴 **「任何人照着它能从零重跑出 F5/F5b/F6/F6b」的证据**:本轮就是照它跑出来的,输出逐字贴在
`replay.md` §3.3 / §4.3 / §5.1,与落盘文件一致。

**哪些步骤当时是手工的**(replay.md 里逐条标了,不装成命令):
- `F5b` 的 8 个 `score` —— 手工选的档位值(`replay.md` §4.2 表格第 (1) 行)。
- `F5b` 的「4 文件 × 每文件 2 chunk」场景 —— 手工设计的选点规则(§4.2 第 (2) 行)。
- `F0` 的 `limit: 40` —— 手工的参数选择(§3.1 有说明为什么是 40)。
- 其余全部是脚本里的机械规则(含 `F6b` 的 anchor 挑选 = 「第一个窗口内 ≥4 条的 chunk_no」)。

---

## 2. Imp-2 🔴 —— 选 **方案(甲)去掉加工**

### 2.1 为什么选甲(理由,按 brief 要求说明)

| | 甲(去掉加工) | 乙(保留 + 逐项申报) |
|---|---|---|
| 声明可信度 | **重新成立**:`.REPLAYED` 回到「除申报项外每个字段都有真实出处」 | 每个 fixture 永久挂一条「正文被截断过」的星号 |
| 代价 | fixture 从 19.8 KB → 53.5 KB(F5)/ 18.4 → 54.5 KB(F5b)—— **台账目录,可接受** | 零 |
| 对 K49(唯一 XSS 面)的影响 | 🔴 **正面**:评审点名「用裁到 400 字的样本做注入用例,覆盖面比真机窄(真机 2300 字里可能有更多 `&<>"`)」→ 甲直接消掉这个风险 | 风险留着 |
| 长期成本 | 零(脚本天然不截断) | 每次改 fixture 都要维护那段申报文字 |
| 顺带收益 | 🔴 **逼出了第 4 类问题**(§2.3)—— 重放一遍才发现 scroll 没翻页 | 发现不了 |

⇒ **甲更省、更真。** 已落地。

### 2.2 落地内容

1. **`F0` 从 6 个点 → 全部 40 个点**(124 KB)。这解决了评审证据 B:原来 `F5` 的 `hits[6]/[7]`
   (`chunk_no` 1667/3094)溯不回 `F0`,**真因不是造假,是 `F0` 只落了 40 个点里的前 6 个**。
2. **正文零截断**:`preview.text` / `chunks[].text` 与源点**逐字节相同**(2296/2333/… 而不是齐刷刷的 400)。
3. **新增三个 `.REAL` 源点文件**,让每一条都可溯:
   `F0a-parser-embed.REAL.json`(真 bge-m3 向量,落盘后重放不依赖模型权重)·
   `F0b-qdrant-scroll-source-points.REAL.json`(F5b 的 8 个源点)·
   `F0c-qdrant-chunkwindow-source-points.REAL.json`(F6/F6b 的源点)。
4. **`stats` 改成真实测量**:`embed_ms` / `vector_search_ms` / `expand_ms` 都是**本次重放的真实耗时**,
   `total_candidates = len(F0.result.points)`。
   🔴 这修掉了一个评审没抽查到的项:原 `F5.stats.expand_ms = 12` 是**我编的**
   (四个真抓的 `.REAL` 全是 `expand_ms: 0`)。
5. **README §3 完全重写**成 §3.1「人工成分完整清单(5 条,一条不漏)」+ §3.2「T0 第一版被查实的 4 类
   未申报加工」+ §3.3「抄进测试必须删 `_` 前缀键」。
   🔴 原来那句「**这一处、且仅这一处是人工选值**」已删,换成 5 行表格。
6. **三级标签体系不变**;`F10`/`F11`/`F12` 仍是 D-6 模具。

### 2.3 🔴 全量自查发现的**第 4 类**未申报加工(主动报出)

**`F6` 的「窗口里只有 anchor 一条」与 `F6b` 的「chunk_no 不连续 = 4,5,6,8」是 Qdrant scroll 分页假象。**

- T0 第一版用**单次** `POST /points/scroll {"limit":1000}`,而目标文件有 **3448** 个点
  → 只拿到第一页,`2385/2386/2388/2389` 全在后面的页里。
- T0b 加了 `scrollAll()`(跟着 `next_page_offset` 翻到底)后实测:
  该文件 **3448 个 body chunk,`chunk_no` 0…3447,`连续=true`**。
- ⇒ `F6` 现在是**满窗口 5 条 `2385..2389`**(anchor 2387 居中,prev/next 两侧都能测);
  `F6b` 换成 anchor=1 → `0..3`,**演示「anchor 贴着下界时条数 < 2W+1」**这个真实边界。
- 🔴 **连带订正**:README §2 附 那句「chunk_no **不连续**,见 `F6b` 的 `4,5,6,8`」已改写。
  ⚠️ **`p5e-task-0-report.md:529` 也有同一句错话** —— 按「反转不删」**原文保留**,已在该报告末尾
  加了一节《订正:见 p5e-task-0b-report.md》指过来。

**除此之外没有第 5 类。** 覆盖面见 §3 的 `verify-fixtures.mjs`。

### 2.4 逐字段自查的程序化证据

新增 `scripts/verify-fixtures.mjs`,**4 大类断言、exit 0**:

```
=== 1. 溯源:每条 hit / chunk 都能在 .REAL 源点里找到 ===
  PASS  F5: 8 条 hit 全部溯到源点(缺 0 条)
  PASS  F5b: 8 条 hit 全部溯到源点(缺 0 条)
  PASS  F6: 5 条 chunk 全部溯到源点(缺 0 条)
  PASS  F6b: 4 条 chunk 全部溯到源点(缺 0 条)

=== 2. 零截断:正文与源点逐字节相同 ===
  PASS  F5: preview.text 与源点逐字节相同(不同 0 条);长度 2296,2333,2295,2294,2297,2296,2295,2296
  PASS  F5b: preview.text 与源点逐字节相同(不同 0 条);长度 2342,2317,2285,2361,2336,2379,2271,2156
  PASS  F6: chunks[].text 与源点逐字节相同(不同 0 条);长度 2396,2343,2296,2343,2397
  PASS  F6b: chunks[].text 与源点逐字节相同(不同 0 条);长度 2342,2317,2347,2354
  PASS  F5/F5b/F6/F6b: 长度不是「齐刷刷的整百」(旧版 400/320/600 就是这样被逮到的)

=== 3. 字段全集:与 Go struct 的 JSON tag 逐个对齐 ===
  PASS  顶层键 = files,hits,stats,warnings                         (search.go:68-73)
  PASS  每条 hit 的键集与 Hit struct 一致                            (:32-44)
  PASS  每个 cite 的键集一致(page/offset_* 无 omitempty ⇒ 键恒存在)  (:46-53)
  PASS  每个 preview 的键集一致 / thumbnail_url 恒 null              (:55-58)
  PASS  stats 键集一致                                              (:60-66)
  PASS  每个 files[] 的键集与 FileGroup struct 一致                   (:23-30)
  PASS  hits[].paths 已回填且每项键集 = FilePath struct              (parser_client.go:139-143)
  PASS  files[].score === chunks[0].score                          (:287)
  PASS  files[].paths === chunks[0].paths                          (:284)
  PASS  collection 恒为 text_chunks / payload_extra 恒为 {}          (:328 / :334)
  PASS  未 rerank ⇒ score === raw_score                            (:326-327)
  PASS  hits 按 score 降序 / topK≤10 / maxChunksPerFile≤8           (:206 / :208-224)
  PASS  F6/F6b: 顶层键 = anchor_chunk_no,chunks,file_id,kind         (authz.go:96-101)
  PASS  F6/F6b: page 带 omitempty ⇒ 本机 text/plain 下整键消失
  PASS  F6/F6b: chunks 按 chunk_no 升序 / 全部落在 [anchor-2, anchor+2](:145 / :124)

=== 4. 三级标签 + 出处说明 ===
  (17 个 json 逐个:文件名带三级标签 · 有 _provenance · _provenance 声明的等级 == 文件名的等级)
  PASS  F1–F4 是纯真抓响应体,零 _ 前缀键(显式白名单 PURE_REAL,防悄悄变长)

=== 结果:全部通过 ✅ ===     exit=0
```

🔴 **第 2 类里那条「长度不许是齐刷刷整百」是新加的常驻断言** —— 它就是把评审逮我的那个判据
钉进脚本,防复发。

---

## 3. Imp-3 —— 10/10 脚本可跑

### 3.1 修法

新增 **`scripts/_inputs.mjs`** 共享输入层,每个输入**自己现取**:

| 输入 | 怎么取 |
|---|---|
| 蓝本文件(`src/**`) | `git -C <NimoOS-UI> show 7a6ee6b7:<path>`,缓存进 `os.tmpdir()`。🔴 **只读 git object,永不 checkout**(那个仓被 SP7/SP9 并发会话共用) |
| 蓝本 Knowledge/Parser 文件清单 | `git ls-tree -r --name-only 7a6ee6b7 …` |
| 本仓文件 | 直接读工作树 |
| **i18n 全表** | 🔴 **esbuild 转译 `src/i18n/*.ts` 后真实模块导入**(治理 §9.3-2:文本解析会少算)。esbuild 取自 `node_modules/.pnpm/node_modules/.bin/esbuild` |
| 中间产物(`p5e-values.json` / `p5e-keys.json`) | 🔴 **取消** —— 改成脚本之间 `import` 函数直接串联,不再落易失文件 |

`NimoOS-UI` 路径自动在 `../../NimoOS-UI` 找,可用 `NIMOOS_UI_DIR=` 覆盖;找不到时给**明确报错**而不是 ENOENT 堆栈。

### 3.2 「10/10 可跑」的证据

```
$ for s in scan-p5e lookup propose collide classes2 sim-r8r9 scan-i18n2 k48-equiv verify-fixtures replay-fixtures; do …
scan-p5e.mjs           exit=0   63  "Type anything in plain language — …
lookup.mjs             exit=0     en: "Type anything in plain language — …
propose.mjs            exit=0  ✅ 本批 63 个键名在当前语言包里全部存在(T1 已落地)
collide.mjs            exit=0  有撞车的值:14 / 63
classes2.mjs           exit=0     实际是 HALF-MOVED(E-52)。选择器级的扫描器分不出这个
sim-r8r9.mjs           exit=0  => NON_K_HELPER_CLASSES 终值 = 19
scan-i18n2.mjs         exit=0  🔴 没有任何口径给出 461 —— 见裁定 R4 的 E-53 结案
k48-equiv.mjs          exit=0    score=0.4666 -> low / T<Low>
verify-fixtures.mjs    exit=0  === 结果:全部通过 ✅ ===
replay-fixtures.mjs    exit=0  === done ===        (--dry)
```
**10 个脚本全部 exit 0**(T0 交付时是 8 个里只有 1 个能跑;本轮新增 `_inputs.mjs` / `replay-fixtures.mjs` /
`verify-fixtures.mjs` 三个文件,`_inputs.mjs` 是被 import 的库、不单独计入)。

### 3.3 🔴 `sim-r8r9.mjs` 复现出 347 / 348 / 19(与评审自写模拟器一致)

```
=== 「没有搬多」白名单正则 ===
现状        : 292 类
追加 P5e 后 : 347 类
新增 55 个:  k-adv-chip … k-skel-rcard
丢失(必须为空): (none)
常量 WHITELIST_293 现长度 293;其中已含本期新类 0 个
=> 常量终值 = 293 + 55 = 348
=== NON_K_HELPER_CLASSES ===
现状 16: ["danger","dot","ghost","lbl","mono","outline","primary","right","second","sep","spacer","spin","suffix","text","warn","wide"]
追加后 19: [… + "chev","h-md","path"]
=> NON_K_HELPER_CLASSES 终值 = 19
```
`classes2.mjs` 同样复现 **74 token = TO-MOVE 54 / ALREADY-MOVED 17 / NO-RULE 3**。

🔴 **新增基线守卫**:T2 一旦把本期段落搬进 `knowledge.scss`,`sim-r8r9.mjs` 会打印红字警告并提示
用 `P5E_SCSS=<T2 之前版本的副本>` 重跑 —— 否则「追加后」的数字会**双算**。
(本轮实跑时 `knowledge.scss` 仍是 2380 行、零本期类,基线干净。)

⚠️ **`collide.mjs` / `propose.mjs` 读的是当前工作树的 i18n** —— T1 已落地,全表现在是 **1648**
(= 1595 + 54 − 1,与附录 A 预测值逐字一致 ✅)。`collide.mjs` **默认排除本批自己的 63 个键**,
否则 T1 落地后每条都会跟自己撞车、复现不出 T0 当时的测量;加 `--include-batch` 可看不排除的样子。

---

## 4. 六条 Minor 的落地位置

| Minor | 改了哪 |
|---|---|
| **M-1** | 附录 A §A.0 复现命令段:换成 `scan-i18n2.mjs`,并写明原 bash 为什么跑出 466(去重带了 `$t(` 前缀) |
| **M-2** | 附录 A §A.0 的 E-53 小节整段重写:标题改「结案:不判勘误;差异原因未查明」+ 穷举口径表(407/424/462/465,**没有 461**)+ 裁定 R4 的定案措辞逐字引用 + 「不许再追 461」 |
| **M-3** | 附录 B §B.4 表格第 3 行 `:103-119` → **`:102-119`**(并写明 `:102` 是 `.k-fileviewer-host` 的闭合 `}`);§B.4 抬头也补了范围;附录 D §D.2 末尾同改 |
| **M-4** | 附录 D §D.2 的漏列表加第 3 行 **`.path`**(蓝本 `:670`,`SearchView.vue:148` + `FileDetailDrawer.vue:20` 都在用,归 `NON_K_HELPER_CLASSES` 不进白名单);抬头改「漏列的是 **3 个**」 |
| **M-5** | 附录 D §D.2 抬头:「52 个全落 TO-MOVE」→「§2.4 解析出 **53** 个真类,其中 **51** 个落 TO-MOVE,另 2 个(`k-suggest-chip` / `h-md`)各归 §D.4 / §D.6;🔴 **一律以 §D.1 的 TO-MOVE 清单为准**」 |
| **M-6** | 附录 B §B.4.1 表格 `.k-modal-bg` 那一行填终值 **1100**(蓝本 `:1302` / 本仓 `:1146`)+ 「与 host 并列是蓝本原生 ⇒ **K46 无需任何决定**」;结论句也补了一行 |
| **M-7** | 新增 `F12-search-chunk.anchor-absent.CONSTRUCTED.json`(anchor 2387,chunks `[2386, 2388]`);README §0 清单 + §2 附 + §7 的 T5 行都指向它;`replay.md` §6 写了构造依据(为什么后端真会产生这个响应) |
| **M-9** | 附录 D §D.7.1:真因改成 **`knowledge-app` 匹配不上 `NEW_RE`**(`k(?:2|n)?-` 要求 `k-`/`k2-`/`kn-`,而它是 `kn`+`o`),并贴实测 `whitelist items not in NEW_RE hits = ['knowledge-app']` / `with no rule in css = []`;数字 348 与「不许修平」不动 |

---

## 5. 改动清单(**未 add / 未 commit**,由协调者提交)

| 文件 | 动作 |
|---|---|
| `p5e-fixtures/replay.md` | 🆕 新增(Imp-1) |
| `p5e-fixtures/scripts/replay-fixtures.mjs` | 🆕 新增 |
| `p5e-fixtures/scripts/verify-fixtures.mjs` | 🆕 新增 |
| `p5e-fixtures/scripts/_inputs.mjs` | 🆕 新增(Imp-3 共享输入层) |
| `p5e-fixtures/F0a-parser-embed.REAL.json` | 🆕 新增 |
| `p5e-fixtures/F0b-qdrant-scroll-source-points.REAL.json` | 🆕 新增 |
| `p5e-fixtures/F0c-qdrant-chunkwindow-source-points.REAL.json` | 🆕 新增 |
| `p5e-fixtures/F12-search-chunk.anchor-absent.CONSTRUCTED.json` | 🆕 新增(M-7) |
| `p5e-fixtures/F0-qdrant-points.REAL.json` | ♻️ 重写(6 点 → 40 点全量) |
| `p5e-fixtures/F5-…REPLAYED.json` · `F5b-…` · `F6-…` · `F6b-…` | ♻️ 重写(零截断 + 可溯源 + `_provenance`) |
| `p5e-fixtures/README.md` | ✏️ §0 清单 / §2 附 / **§3 整段重写** / §3.1–3.3 新增 / §7 的 T5 行 / 顶部纪律块 |
| `p5e-fixtures/scripts/{scan-p5e,lookup,propose,collide,classes2,sim-r8r9,scan-i18n2}.mjs` | ♻️ 重写(改用 `_inputs.mjs`,零手工准备) |
| `p5e-appendix-A-i18n.md` | ✏️ M-1 / M-2 / §A.8 加时点 / §A.9 换命令 |
| `p5e-appendix-B-tokens.md` | ✏️ M-3 / M-6 |
| `p5e-appendix-D-classes.md` | ✏️ M-3 / M-4 / M-5 / M-9 / §D.7.3 换命令 |
| `p5e-task-0-report.md` | ✏️ **末尾加一节《订正》**指向本报告(原文一字未删,守「反转不删」) |
| `p5e-task-0b-report.md` | 🆕 本文件 |
| 🔴 `src/**` · `p5e-common-constraints.md` · `p5e-plan.md` · `p5e-kickoff-prompt.md` · `p5e-coordinator-rulings-T0.md` | **零改动** |

**设备状态**:全程只读探测(Parser embed / Qdrant query+scroll / Parser `_internal/files`)。
探测前后逐字相同:`points/count = 5592` · `paused=true` · `queue_depth {"pending":339,"running":1,"failed":0,"done":9}` ·
`indexed_files 7` · `total_vectors_text 5592`。🔴 **未执行任何 root grant**(裁定 R2 第 3 条)。

---

## 6. 命中的裁定条目申报

| 条目 | 怎么命中 |
|---|---|
| **R3** | `.REPLAYED` 的三条约束全部落地:三级标签在文件名 + `_provenance` 里双写 · `F10`/`F11`/`F12` 明标 D-6 模具 · Go 映射的行号坐标写进 `replay.md` 的对照表 |
| **R3.1 M-1/M-2/M-3/M-4** | 见 §4(附录 B/D 的 `:102-119`、§D.0 的「以 §D.1 为准」、`.k-modal-bg` = 1100、A §A.0 的 466 口径瑕疵) |
| **R4(E-53)** | 附录 A §A.0 逐字采用裁定的定案措辞;🔴 **本轮没有再去追 461** |
| **R8** | `sim-r8r9.mjs` 独立复现 347 / 348 / 19,与评审自写模拟器一致;附录 D §D.7.1 的错理由已改;「不许修平」原样保留 |
| **R2** | README §3 / `replay.md` §0 都写明「禁开 root grant」;本轮零 root grant 操作 |
| **R5 / R6** | 未改动(它们落在验收清单与 T5,不在本轮范围) |
| **§9.5(探针还原)** | 本轮**没有做需要还原的探针** —— 改的都是本轮该改的产出文件,不是「临时改了再还原」。故未使用 `git checkout/restore/stash`(禁令遵守),`cp`+`md5sum` 也无适用场景 |
| **§9.10(守卫只许加固)** | `verify-fixtures.mjs` 是**新增**守卫(4 大类断言),零放宽;`PURE_REAL` 白名单是显式常量并配了「防腐烂」断言 |

---

## 7. 顾虑

1. **fixture 体积涨了 ~4 倍**(`F5` 19.8→53.5 KB、`F5b` 18.4→54.5 KB、`F0` 18.6→124.7 KB,
   加三个新源点文件共 ~79 KB)。台账目录不进构建产物,评审已认「体积换真实性」值得;
   但 T3/T5 **抄进测试时请只抄需要的那几条 chunk**,不要把 2300 字正文整段贴进 `.test.ts`
   —— 建议在测试里只保留 1–2 条完整正文(K49 注入用例需要长文本),其余截短**并在测试注释里申报**。
2. **Minor-8 未处理**(三门日志落 `/tmp`)—— 本轮禁跑三门,无法重新落盘。
   建议协调者把「三门日志落进 `.superpowers/sdd/`」写进 T1 起的通用 DoD。
3. 🔴 **`F6b` 的语义变了**:原来是「chunk_no 不连续」的样本,现在是「anchor 贴着下界 ⇒ 条数 < 2W+1」。
   **附录里凡引用 F6b 的地方我都改了**,但如果协调者已经把「不连续」写进了 T5 的 brief,请一并改。
4. **`_provenance` 键会跟着 fixture 一起被抄进测试**(如果实现者没读 README §3.3)。
   已在三处提醒(README 顶部纪律块 / §3.3 / 每个文件的 `_provenance` 末行),
   但这条只能靠 T5 评审兜住 —— 建议写进 T3/T5 的 brief。
5. **`replay-fixtures.mjs` 依赖活着的 Parser + Qdrant**。Parser 一旦 resume 队列(现在 `paused`),
   339 个 pending job 会灌新向量,`F0` 的命中集就漂了。`replay.md` §1 已写明「届时请连 `F0*` 一起重跑」。
6. 我**没有**给 `F10`(CONSTRUCTED)的 `files[].chunks[].paths: null` 做订正 ——
   真实的 Go 路径会给所有 hit 回填 `paths`(`search.go:250`),所以那个 `null` 严格说不像真机。
   它是 CONSTRUCTED 且只用于测 `cite.page` 分支(`chunkVM` 不读 `paths`),**改不改都不影响判别力**;
   若协调者要求一致性,一行的事 —— **等指示,本轮没自行改**。
