# SP8-P5d · T0 独立评审(T0 评审者,2026-08-04)

**评审对象**:`cc6d7c8`(BASE `23515cd`),18 文件全在 `.superpowers/sdd/`
**权威源**:`NimoOS-UI`@`7a6ee6b7`(一律 `git show`)· `.sp8/NimoOS-Service/src/notes.ts` ·
`NimoOS-AI/agent/main.py` · 活体后端 `:8282` · 本仓 `src/`
**口径**:治理 > 计划书 > brief > 报告。报告的任何「实测 = X」我都回权威源自己测了一遍。

---

## 0. 两个独立判定

| | 判定 |
|---|---|
| ① **规格符合(DoD 0–8)** | ❌ —— **7/9 兑现,DoD 2 与 DoD 4 部分兑现**(两处都是局部可修,见 §1) |
| ② **任务质量** | ✅ **通过** —— 12 条新勘误**逐条独立复核全部成立**,其中 5 条(E-31/32/34/37/38)是治理文件自身的错、照着做会真出事;缺口猎命中的都是局部遗漏,不是方法错误 |

**结论一句话**:这是一刀高质量的 T0。**但附录 A §A.4 里有 5 个 zh 值是自己译的、与同一份附录的 §A.2 自相矛盾**
(§A.2 是对的),而 §A.4 与 §A.2 都被声明为「T1 的唯一值来源」→ **必须在 T1 开工前修掉**。
附录 D 另缺治理 §6.2 明令的 K44 顶层例外一节。

---

## 1. DoD 0–8 逐条

| DoD | 判定 | 我的独立取证 |
|---|---|---|
| **0** 三门基线 | ✅ 兑现 | `/tmp/p5d-t0-test.log` 有 `Test Files 326 passed (326)` / `Tests 3515 passed (3515)`;`tsc.log` **0 行**;`build.log` `✓ built in 25.81s`。我另自算 `find src -name '*.test.ts' \| wc -l` = **326**、`find src -name '*.vue' \| wc -l` = **179**,与基线逐字一致;`git status --porcelain` 空 |
| **1** 蓝本源核验 | ✅ 兑现 | `NimoOS-UI` 工作树**未被动过**:分支仍 `docs/vue3-migration-sp3`、HEAD 仍 `748d5359`、`main` 仍 `7a6ee6b7`、`FETCH_HEAD` = `65cfda58`。我对 12 个文件跑 `md5sum` 比对 `7a6ee6b7` vs `65cfda58`:**10 个 SAME**,2 个 DIFF 且都非功能性 —— `knowledge.scss:1675` 单行注释中→英、`package.json` 远端删 `rss-to-json`(**tiptap 依赖零变化**)。zh_CN/en_US **展平后 changed values 均 = 0**(zh 2823→2825、en 2742→2744,+18/−16)。→ 锁 `7a6ee6b7` 正确 |
| **2** 附录 A | ⚠️ **部分** | §A.1/§A.2/§A.5/§A.6/§A.7/§A.8 **全部独立复现为正确**(见 §3);🔴 **§A.4 的 zh 列 5/7 是错的**(Critical #1) |
| **3** 附录 B | ✅ 兑现 | 26 行/39 处**逐分段复现一致**;2 处模板内联显式在表;3 处 `#fff` 定死 `--text-on-accent` 且否决 `--on-accent` 的证据我复核成立;K39 诚实登记成立 |
| **4** 附录 D | ⚠️ **部分** | 65/291 + `NON_K_HELPER` 10→15 + 不搬清单 + §D.5 + §D.6 **全部正确**;🔴 **缺治理 §6.2 明令的 K44 顶层裸选择器例外一节**(Important #2);73 个模板类未逐个列出;白名单终值留成待拍板 |
| **5** fixture | ✅ 兑现 | 409 的 `current_revision` 与 DELETE 的 200+body **我从 agent 源码逐字坐实**;清理证据链**闭环**(见 §4);取数路径改直连是对的 |
| **6** tiptap 可测性 | ✅ 兑现 | **我把探针重跑了一遍**,4/5 通过、失败的那 1 个正是附录已诚实登记的写错探针。K38 两个 emit 与 §5.3 防回环**直接实证**;N29 只实证了前提(见 Important #3) |
| **7** 勘误 | ✅ 兑现 | E-26~E-30 复核成立;新增 E-31~E-42 **12/12 我独立确认** |
| **8** 行数与边界 | ✅ 兑现 | 5/5 行数 + 9/9 括号配平**我独立复现,零偏差**(见 §3) |

---

## 2. 发现(分级)

### 🔴 Critical

**C-1** `p5d-appendix-A-i18n.md:167-173`(§A.4 的 7 个 labelKey 汇总表)—— **zh 列 5 个值是自己译的**,
与**同一份附录 §A.2 里正确的值**自相矛盾。这正是治理 §7「不许自己翻译」+ 硬约束 §0.3-2 禁止的动作,
且 §A.4 与 §A.2 都被本文件开头声明为「T1 的唯一值来源」→ T1 从哪张表抄都合规,抄 §A.4 就错 5 条。

| labelKey | §A.4 写的 | `zh_CN.json`@`7a6ee6b7` 实际 |
|---|---|---|
| `Insight` | `洞察` | **`洞见`** |
| `Digest` | `摘录` | **`文摘`** |
| `Written by you` | `你写的` | **`手写`** |
| `Written by agent` | `agent 写的` | **`Agent 代写`** |
| `Auto-captured` | `自动沉淀` | **`AI 沉淀`** |

取证:
```bash
cd /home/nimo/NimoTech/NimoOS-UI
git show 7a6ee6b7:src/assets/lang/zh_CN.json | python3 -c "
import json,sys; d=json.load(sys.stdin)
for k in ['Note item','Summary','Insight','Digest','Written by you','Written by agent','Auto-captured']:
    print(repr(k),'->',repr(d[k]))"
# → 笔记 / 摘要 / 洞见 / 文摘 / 手写 / Agent 代写 / AI 沉淀
```
⚠️ **§A.2 第 58-64 行(那 7 个键的正式行)全部正确** —— 我对 §A.2 的 **92 行做了程序化逐字比对,
zh 与 en 双列零 mismatch**。所以修法是**只改 §A.4 的 zh 列**,别动 §A.2。
**修完建议在 §A.4 加一句「zh 值以 §A.2 为准,本表只为核对 labelKey 归属」**,消掉双源。

### 🟠 Important

**I-1** `p5d-appendix-D-classes.md` —— **完全没有 K44 / 治理 §6.2 的「顶层裸选择器例外」一节**。
治理 §6.2-2 明令要「为它加一条具名例外……断言『顶层裸选择器**恰好只有** `.nme-content .ProseMirror`
这一条』—— 集合相等式,必配 RED 探针」,治理 §11-5 还把它列为评审者必查项。附录 D 只处理了
`nonKClassNames` 与「没有搬多」两条守卫,对这一条零字。**连带缺两个 T2 必需的实测数**:

```bash
# ① 这条断言现在压根不存在(T2 是新建,不是修改):
grep -n "顶层\|裸选择器\|top-level" src/ai/styles/knowledgeStyles.test.ts   # → 只命中 K10 注释,无此断言
# ② 现状 depth-0 选择器 15 条,全是 .knowledge-app / :root[...] / @keyframes,
#    「裸选择器」实测 = 0 → 「恰好一条」的集合相等断言可行(我已算过)
```
→ **不阻塞 T1,阻塞 T2。** 建议协调者补一行口径:例外集合 = `['.nme-content .ProseMirror']`,基线 0。

**I-2** `p5d-appendix-D-classes.md:229-237`(§D.6.1)—— **三条高危行为里只有两条真被探针证过**。
我重跑探针:`update:modelValue` + `input` 双 emit ✅、同值 `setProps` → `setContent` 0 次 / 异值 1 次 ✅。
但 **N29 的链路(父组件 `tbActive()` 方法 + `tbTick` 假依赖 + `@transaction="tbTick++"` → `data-on` 翻转)
从未挂载过** —— 探针只有编辑器 SFC。前提成立(我实测一次 `insertContent` 触发 `transaction` **2 次**),
且蓝本 `NoteEditPane.vue:227-230` 的 `tbActive` 是**模板内调用的 method**(Vue 3 下渲染 effect 会追踪
`tbTick.value`,机制成立),所以风险低 —— 但 §D.6.1 那句「三条都能落在真行为层」对 N29 是**推理不是实证**。
→ **T4/T7 落地时必须自己补这条的变异证据,不能引 §D.6.1 当已证。**

**I-3** `p5d-appendix-D-classes.md:144-148`(§D.2.1)—— **白名单终值留成开放问题(291 还是 293)**。
brief 要求「`WHITELIST_226` 的新常量名与**准确增量**」。65/291 那一半我完全复现(见 §3),
但正则扩到 `ProseMirror` 后两个非 `k*` 类必须同时进白名单,附录把 291 vs 293 交回协调者。
**T2 开工前必须有这个数**(常量要改名)。T0 推荐 (a) 293,我技术上同意 —— 白名单语义是「本档允许存在的类」。

**I-4** `p5d-appendix-D-classes.md:24`(§D.0)—— **模板静态类的 73 个缺失类只给了计数,没有清单**。
brief 要求「完整待搬类表」。实际影响有限:我独立算过,98 个模板静态类里**只有 `nme` 与 `text` 两个
在蓝本任何 scss 与 New-UI 现状里都没有规则**(其余 71 个都能靠 §D.1 的 65 + New-UI 既有覆盖),
所以 T6/T7 不会真卡住;但「缺了就报」是本档纪律。

### 🔵 Minor

**M-1** `p5d-appendix-B-tokens.md:161`(§B.5)—— 称 `color-guard.test.ts`「只扫 `.vue` 的 `<style>` 块与
`.css`/`.scss`」。**它不扫 `.scss`**:`src/styles/color-guard.test.ts:15-16` 的 glob 只有 `../**/*.vue`
与 `../**/*.css`。承重结论(不扫 `.ts` → K40 裸奔)**正确**,但这句话会让下游误以为 `knowledge.scss`
有 color-guard 兜底(实际只有 `knowledgeStyles.test.ts` 的 §6 豁免登记守它)。

**M-2** `p5d-appendix-D-classes.md:202`(§D.5)—— 引 `KIcon.vue:58`;实际
`const pathHtml = computed(() => PATHS[props.name] || '')` 在 **`:71`**。结论(未知 name → 空 `<svg>`)正确。

**M-3** `p5d-appendix-D-classes.md:162`(§D.3)—— `.kn-tb-btn` 标 **`×7`**,但同行列出的 8 个行号
(`:43 :44 :45 :47 :48 :50 :51 :52`)是对的,实际是 **8 个**按钮(`grep -c 'kn-tb-btn.*data-on'` = 8)。
若 T7/T8 照「7」写计数断言会红。

**M-4** 报告 §1/DoD1 表写 `en_US.json` `2766→2768`;展平叶子实测 **2742→2744**(zh 侧报告写的 2823→2825
与我一致)。纯记账偏差,`changed values = 0` 的结论不变。

---

## 3. 反向复核报告声称「完全正确」的那批 —— **全部成立**

| 项 | 我的独立结果 |
|---|---|
| 5 个组件行数 | `271 / 338 / 47 / 50 / 11` ✅ 逐字一致(`git show 7a6ee6b7:src/views/AI/Knowledge/…`) |
| **scss 8 段 + `.k-seg` 的 9 处括号配平** | ✅ **9/9 净 0**,进入深度 A-H 全 0、**K43 = 1**(嵌在 `.knowledge-app` 内);每段首行精确落在段头注释、下一行精确是下一段段头(我用保行版 `blankComments` 逐段数 `{`/`}` 并算 depth) |
| 段行数算术 | 8 段 = **244** · +K43 21 +K44 7 = **272** · 组件 = **717** · 合计 = **989** ✅ |
| 色普查 26 行 / 39 处 | ✅ **逐分段全中**:A 4/7 · B 0/0 · C 6/10 · D 3/3 · E 2/3 · F 0/0 · G 2/2 · H 0/0 · K43 0/0 · K44 3/4 · JS 4/8 · 模板 **2/2**;39 = 6+23+8+2 核对通过 |
| distinct 99 / 复用 7 / 新增 92 | ✅ 字面量 distinct **92**(88 个 `$t` + 4 个 `i18n.t`)· 出现 **115** 次 · labelKey **7** · 合计 **99** · 语言包 **99/99 命中** |
| 动态 `$t()` 5 处 | ✅ 恰好 5,位置 `NotesView.vue:95/121/123` + `NoteEditPane.vue:86/113` 逐处吻合 |
| glyph 19/19 | ✅ 19 个全在 `PATHS`(且 `PATHS` = 42,见 E-35) |
| 键数 1503 / 1503 / `aiKb*` 295 | ✅ **真实模块导入**实测,键集完全一致 |
| **§A.7 撞车表完整性** | ✅ **我自己跑了一遍双向全扫:危险撞车恰好 11 组、全同重复恰好 21 组,与附录逐组相同** —— 附录没漏 |
| §A.2 的 92 行 | ✅ **zh 与 en 双列零 mismatch**、92 个键名互不重复、与 1503 键零重名(仅 7 个复用键「撞」= 预期) |
| §D.1 的 65 个类 | ✅ 我独立按选择器位置提取得 **67 个 `k*`/`fb*`**、已在白名单 **2**(`k-badge`/`kn-badge`)、新增 **65**,**与 §D.1 的 65 行集合逐一相同(零差异)** |
| 9 个新 token | ✅ 全部在 `knowledge.scss` 零出现;两个声明块实测 **`:130-246`** / **`:249-340`**,与 §B.6 逐字一致 |
| K39 诚实登记 | ✅ `--grad-sandbox`(`:242`/`:336`)= `linear-gradient(135deg, #5AC8FA, #007AFF)` 与蓝本 `NOTE_TYPES.note` **逐字节同值**;另 3 条渐变**全仓零同值先例**(端点色单独有 token,整条渐变没有) |
| `--on-accent` 否决证据 | ✅ `theme.css:48` = `#16203a`(暗)/ `:186` = `#ffffff`(浅);`knowledge.scss` **未声明** `--on-accent` → 会穿透;`--text-on-accent` `:145` = `#ffffff`、`:264` = `var(--on-accent)`(在 `[data-theme=light]` 下解析为 `#ffffff`)→ **两档纯白,选它正确** |
| §D.2.1 正则超集 | ✅ 对现状文件 `old ⊆ new` 成立,且两版**产出集合今天完全相同**(225 = 225)→ **附录要求配 RED 探针是必需的,否则这条改动零可观测** |
| 不搬清单 | ✅ 5 项在蓝本的行号全对(`.k-section-body :985` · `.k-progress-* :1152` · `:2250-2264` 的 6 个 `kn-*` · `.kn-badge :2031-2039`),且 New-UI 里**只在注释出现**(非规则)→ 确实没搬 |
| A-12 上游覆盖 | ✅ `notes.test.ts:25-71` 的表**只断言 `${verb} ${url}`**,`cancelDistillJob` 的 body 与返回值 unwrap 确实没测;`recorder` 的 `Call.body`(`:9-15`)确实已记录 body → 「补 2 行即可」成立 |

---

## 4. 「写操作已清净」—— 清理证据链**闭环**(我只做只读核验)

| 环 | 我的实测 |
|---|---|
| 探针笔记已消失 | `GET :8282/agent/notes?limit=200` → **23 条**,`title` 含 `PROBE` 的 **0 条**、`tags` 含 `p5d-probe` 的 **0 条** |
| 与 fixture 对得上 | fixture `notes-list-200.json` 的 **23 个 id 集合与活体逐一相同**(only-fixture 0 / only-live 0) |
| 磁盘无残留 | `ls /DATA/Notes/1/` = **25 个文件**,`grep -iE 'probe\|delete me'` **零命中** |
| settings 未被改 | `notes-settings.json` 与活体 `GET /notes/settings` **逐字节相同** |

→ **对那 23 条真实笔记零写操作**这一点,从「id 集合一致 + 磁盘文件数一致 + 无 probe 残留」三面互证成立。

---

## 5. E-31 ~ E-42 逐条(**12/12 确认,零推翻**)

1. **E-31 ✅ 确认** —— 我对全部 99 串扫 `en_US.json`:覆盖**恰好 2 条**,`this cannot be undone`→`this cannot be undone.`、`Note item`→`Note`。`src/plugins/i18n.js:9-10` 默认+fallback 都是 `en_us` → 英文界面渲染覆盖值。
2. **E-32 ✅ 确认** —— 92 个 zh 值扫 `/[，；：？！（）]/` **恰好 1 条**(`aiKbNtDeleteTitle` = `删除该笔记？`,`？`=U+FF1F);治理点名的 3 条逐码点为 `,`=U+002C、`(`/`)`=U+0028/0029 → **假阳性成立**。
3. **E-33 ✅ 确认** —— `Service/src/notes.ts:232-235` 实为 `const res = await http.delete(...); return res.data`。治理 §4.1「直接 return res」错。
4. **E-34 ✅ 确认** —— 我把 10 段拼进现状文件后**重跑真实 `nonKClassNames` 逻辑**:新扫出**恰好 7 个** = `dot lbl sep spacer wide` + `nme-content ProseMirror`。→ 登记表**必须 10→15**,A-10 的「保持 10 项」会让 `:262` 集合相等断言 T2 一提交就红。`nme` 确实扫不到(蓝本零选择器)→「2 个非 k* 新类」而非 3 个,成立。
5. **E-35 ✅ 确认** —— `PATHS` 程序化计数 = **42**,零重复键;P5c 记的 42 是对的,不存在「漂到 43」。
6. **E-36 / D-2 ✅ 确认** —— 蓝本 `package.json:74` = `"tiptap-markdown": "^0.8.10"`;`pnpm-lock.yaml` 解析 `tiptap-markdown@0.8.10`(peer `@tiptap/core ^2.0.3`)+ `@tiptap/*@2.10.3`。治理 K37/A-7 的 `^0.6.1` 错。
7. **E-37 ✅ 确认** —— `curl http://127.0.0.1/v1/ai/agent/notes/settings` → **HTTP 400** `{"message":"missing or malformed jwt"}`;`curl -H 'X-User-Id: 1' http://127.0.0.1:8282/agent/notes/settings` → **200**。治理 §4.2「localhost 免 JWT」错。
8. **E-38 ✅ 确认** —— **回 agent 源码坐实**:`NimoOS-AI/agent/main.py:2888` `return {"status": "deleted", "id": note_id}`(FastAPI 默认 200),不是 204 空体。连带 E-33 的 mock 形状成立。
9. **E-39 ✅ 确认** —— 67 / 已有 2 / 新增 **65** / 白名单 **291**,且 `WHITELIST_226` 数组实测**恰好 226 项零重复**;模板静态类实测 **98**。计划书的「66 / 21」两种口径下都不成立。
10. **E-40 / D-1 ✅ 确认(并被我扩展为「唯一性也成立」)** —— 蓝本 `knowledge.scss:1569-1570` 正是 `.k-btn.text {…}` + `:hover`,落在 `:1540` 起的 **P5e** 段内;`NotesView.vue:73` 与 `NoteEditPane.vue:174` 都写 `class="k-btn text"`;New-UI 的 `.k-btn` 只有 `ghost/outline/primary/danger`(`:716/722/728/735`)。🔴 **我另独立验证了「唯一缺口」这句**:98 个模板静态类里,在蓝本 scss 与 New-UI 现状**双双无规则**的只有 `nme`(蓝本也无 → N10 家族)与 `text` → **`.k-btn.text` 确实是本期唯一真缺口**。
11. **E-41 ✅ 确认** —— 活体 23 条:`status` 全 `draft`、`type` 全 `insight`、`created_by` 全 `pipeline`、**23/23 有非空 `source_refs`**。治理 §9.9 的四条预测确被反转。
12. **E-42 ✅ 确认** —— `NotesView.vue`:`watch:` 在 **`:208`**、handler `:209`、闭合 `:210`(治理写 `:210`);`confirmAll` 在 **`:238`**、`Promise.all` `:242`、toast `:243`(治理写 `:243`);`Service/src/notes.ts` 的 `Note` 接口是 **`:21-35`**(治理写 `:21-34`)。

**409 契约**(治理最担心的一条)—— 我也回源坐实:`agent/main.py:2870-2872`
`JSONResponse(status_code=409, content={"detail": "revision conflict", "current_revision": e.current_revision})`
→ **`current_revision` 字段名成立**,`conflictMessage` 按设计工作,治理担心的「revision undefined」**不成立**。

---

## 6. ⚠️ 我无法核验、需协调者跨刀上下文的

1. **DoD 0 的三门我没有重跑**(brief 明令不重跑)。我只核了落盘日志 + 自算 326 个测试文件 / 179 个 `.vue` / 工作树干净 / `src/` 零 diff。**若协调者要「零信任」口径,需自己复跑一次。**
2. **`.sp8/NimoOS-Service/dist/` 到底有没有被清过** —— 报告说没有、因此没跨仓 build。这是跨会话状态,我无从判定(P5c §1.3.1 那次污染就是 `git status` 全程干净)。建议协调者顺手 `diff` 一次 `dist/` 与 `src/` 的一致性。
3. **I-3 的白名单终值 291 vs 293**:哪个与后面 P5e/P5f 的白名单演进路线一致,只有协调者知道。
4. **D-1 若追认,`NON_K_HELPER_CLASSES` 的终值**:E-34 定 15、D-1 追认后 16。**两条必须合并成一个数交给 T2**,否则 T2 会拿到两个互斥的集合相等目标(`:262` 那条断言只认一个)。
5. **`.k-btn.text` 与 P5e 的段归属**:P5e 是否已经在别处规划了搬 `:1540-…` 整段 —— 若已规划,本期搬 2 行会与 P5e 冲突,需协调者裁。

---

## 7. 对 D-1 / D-2 的技术意见(**不替协调者拍板**)

### D-1 `.k-btn.text`

**技术事实(我全部独立核过)**:缺口真实、**且是本期唯一一个**(§5 第 10 条);蓝本规则 2 行、
**零色字面量**(`transparent` 关键字 + `--accent` + `--accent-soft`,后两个我确认**两档都已声明**);
不搬的后果是两个按钮从「无底色蓝字」变成浏览器默认灰底按钮 = 界面不 1:1,而这是本期唯一的
「Vue2 有样式、我们漏了」类型(与 `nme` 那种 N10「Vue2 也没样式」性质相反)。

**技术意见**:倾向**支持本期搬**。理由:① 代价是 2 行,不搬的代价是可见的视觉回归;
② 跨期重复的风险是**可守的** —— 「没有搬多」那条集合相等白名单断言天然会在 P5e 重复搬时报红,
只要在 P5e 交接项写明「P5d 已搬」;③ 附录建议的插入位置(`&.danger` 之后、`&:disabled` 之前)
与蓝本源序一致,不改级联。
**但两个前置条件必须由协调者给**:(a) 追认编号(附录建议 K45)—— 它确实是「扩大搬运范围」,
按治理 §3 末句必须先申报;(b) `NON_K_HELPER_CLASSES` 的**单一终值**(15 还是 16,见 §6-4)。

### D-2 `tiptap-markdown` 版本

**技术事实**:蓝本声明 `^0.8.10`、锁文件解析 `0.8.10`(peer `@tiptap/core: ^2.0.3`,被 `@tiptap/*@2.27.2` 满足);
`0.6.1` 是蓝本**从未跑过**的版本 —— 装它正好反转了 K37「不拿蓝本没验证过的 API 做 1:1 移植」的初衷。
**我重跑了 T0 的探针**(`@tiptap/*@2.27.2` + `tiptap-markdown@0.8.10`):`storage.markdown.getMarkdown()` /
`isActive` / `chain().focus()…run()` / `onUpdate` / `onTransaction` / `commands.setContent()` /
`<editor-content>` 真渲染 `.ProseMirror` / 双 emit / 防回环 / `destroy` **全部工作**。

**技术意见**:倾向 **`^0.8.10`**,且 **`0.8.10` 仍在 v2 线**(K37「锁 v2 不许 v3」的实质约束不破)。
**「四个包够用」我也复核成立**:蓝本另有 `@tiptap/core` / `extension-highlight` / `extension-typography`
三个直接依赖,但 `NotesMarkdownEditor.vue:8-19` 只 import `Editor/EditorContent` + `StarterKit` + `Markdown`,
**三个 P5d 蓝本文件里 `Highlight`/`Typography` 零引用** → 不需要多装;`@tiptap/core` 作为 peer 由 pnpm 自动装。
**落地时仍按治理 §14-2 核实真实解析版本**(要 `2.x` / `0.8.x`),并注意 §14-1 那句「四个都要是 `2.x`/`0.6.x`」
的期望值需随本裁定一起改成 `0.8.x`,否则 T4 会照旧口径把自己判红。

---

## 8. 修复建议(按优先级,给协调者派活)

| # | 事 | 阻塞谁 |
|---|---|---|
| 1 | **修 §A.4 的 5 个 zh 值**(Critical C-1),并加一句「zh 以 §A.2 为准」消双源 | 🔴 **T1** |
| 2 | 补附录 D 的 **K44 顶层例外一节**(例外集合 `['.nme-content .ProseMirror']`,基线:现状裸选择器 0,断言需新建) | T2 |
| 3 | 拍板**白名单终值**(291 / 293)与 **`NON_K_HELPER_CLASSES` 单一终值**(15 / 16) | T2 |
| 4 | 裁定 **D-1**(建议 K45)与 **D-2**(建议 `^0.8.10`,并同步改治理 §14-1 的期望版本串) | D-1→T2/T6/T7;D-2→T4 |
| 5 | 在 §D.6.1 标注 **N29 未被探针覆盖**,要求 T4/T7 自附变异证据 | T4 / T7 |
| 6 | 修 M-1 / M-2 / M-3 三处小错(`.scss` 那句、`KIcon.vue:71`、`.kn-tb-btn ×8`) | 低 |
| 7 | 可选:补 §D.0 那 73 个模板类清单(实际只有 `nme` / `text` 无规则,可只补这句结论) | 低 |
