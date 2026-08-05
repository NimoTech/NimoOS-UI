# SP8-P5f Task 1b 独立评审

> **评审者**:独立复核,不采信实现者报告的任何结论——每一条自己动手复核。
> **对象提交**:`181ee7f`(起点 `0f4e406`,分支 `sp8-ai`,工作区 `.sp8/NimoOS-New-UI`)。
> **结论**:**Critical 0 / Important 0 / Minor 1**。**可以进 T2。**

---

## 0. 第一必查项(全部自己动手,零采信)

### 0.1 产品码零改动

```
$ git diff 0f4e406 181ee7f -- src/ai/knowledge/views/SearchView.vue \
    src/ai/knowledge/components/FileDetailDrawer.vue src/ai/knowledge/util/searchAggregate.ts
(空)
```
✅ **确认为空。**

### 0.2 四个 `.test.ts` 既有每一行未动(逐行读 + `git diff -U0`)

```
SearchView.test.ts          @@ -1432,0 +1433,97 @@   deletions: 0
FileDetailDrawer.test.ts    @@ -654,0 +655,63 @@    deletions: 0
searchAggregate.test.ts     @@ -669,0 +670,58 @@    deletions: 0
messageSyntax.test.ts       @@ -1014,0 +1015,9 @@   deletions: 0
```
四个文件全部单一 `-X,0 +Y,N` 纯插入 hunk,**逐行读过新增内容**,`messageSyntax.test.ts` 的 9 行确认
全部是 `//` 注释(`grep -c "it(\|expect("` on added lines = 0)。**§9.10 满足:零放宽,只有加固。**

### 0.3 四条断言各自独立报红(自己做探针,`--reporter=verbose`,禁 `git checkout`)

| 探针 | 注入 | 结果(自己跑) | 还原(md5) |
|---|---|---|---|
| **I-1①** `rerank` 反转 | `SearchView.vue:224` `=== 'accurate'` → `!== 'accurate'` | **3 failed / 75 passed**(具名:`quality="fast"…`/`quality="accurate"…`/`两个入参同时非默认…`) | ✅ `189df8a9…` 逐字节一致,`git diff --stat` 空 |
| **I-1②** `topK` 焊死 10 | `SearchView.vue:223` `topK.value` → `10` | **4 failed / 74 passed**(第 1/3/4 档位 + 组合用例) | ✅ 一致 |
| **M-1** `window: 2`→`3` | `FileDetailDrawer.vue:120` | **3 failed / 37 passed**(全部 3 条债务用例) | ✅ `df5951f7…` 一致 |
| **M-2** `>=1`→`>=2` | `searchAggregate.ts:258` | **4 failed / 77 passed** | ✅ `3466dd7d…` 一致 |

每次都核到**具名 failed 用例**且同跑里有大量 **passed**(不是 Startup Error,R13 同族陷阱已避开)。
全程 `cp` + 行首锚定 `sed` 注入 → 落盘自证 → 报红 → `cp` 还原 → `md5sum` 逐字节比对,**零 `git checkout/restore/stash`**。

**结论:四条断言全部真报红,独立复核成立。**

---

## 1. 全量三门(自己重跑,落盘,未 `| tail`)

```
$ pnpm test              exit=0   Test Files 335 passed (335) / Tests 4319 passed (4319)
$ pnpm exec vue-tsc --noEmit  exit=0  (0 行输出)
$ pnpm build              exit=0   ✓ built in 13.87s
```

**独立复现起点基线**(用临时 `git worktree add --detach <tmp> 0f4e406` 跑一遍,而非采信报告的「起点」推算数,跑完立即 `git worktree remove`):
```
$ (worktree @ 0f4e406) pnpm exec vitest run   →  Test Files 335 passed (335) / Tests 4302 passed (4302)
```
✅ **4319 − 4302 = 17,与归因表 `8+3+6+0 = 17` 逐字对上(裁定 R24 满足)。**
四文件单独一起跑:`78 + 40 + 81 + 136 = 335`,与全量四文件小计一致。

---

## 2. 缺口猎

### 2.1 M-2「两侧用例」是否真的走两条不同路径 —— **发现:否,是本刀唯一的实质缺口**

自己把长度门整个改成 `>= 2`(M-2 实际债务的方向,即"收紧"):
```
Tests 4 failed | 77 passed (81)
 × 单字中文 query(长度 1)→ 必须高亮
 × 单字符 ASCII query(长度 1)→ 必须高亮
 × 多词 query 里混着一个单字 term …
 × 长度 1 与长度 3 的 term … 行为一致
 ✓ 空 query(长度 0 的唯一到达方式)→ 零 <mark> …        ← 仍然绿!
 ✓ 全空白 query(trim 后长度 0)→ 零 <mark>              ← 仍然绿!
```
**「门槛下一侧」的两条(空 query / 全空白 query)在 M-2 实际的收紧方向上完全不报红** ——
因为 `''.split(/\s+/) === ['']`,长度 0 的 term 在 `>= 1` 和 `>= 2` 下都被过滤掉,两个阈值下行为完全相同。

进一步自己验证反方向(整个拿掉长度门,改成 `>= 0`):
```
Tests 4 failed | 77 passed (81)
 × K49 既有「空 query(空字符串)」
 × K49 既有「空 query(全空白)」
 × M-2 新增「空 query(长度 0 的唯一到达方式)」
 × M-2 新增「全空白 query」
```
**这 4 条只在 `>= 0` 这一个方向上同时报红** —— 说明 M-2 新增的「门槛下一侧」两条与 K49 **既有**的两条
判据完全相同(空/全空白 query → 零 `<mark>`),只是喂的文本字面量不同(`hello & world`/`hello world`
vs `个人所得税申报表`),**逻辑上是同一条断言的重复实例**,且**对 M-2 真正想守的「收紧方向」零判别力**。

实现者报告在 §6-2 的自辩「判据是它们从不同方向表达同一个门」**经实测不成立** —— 两个方向表达的其实
是**同一个方向**(松到 `>=0`),而不是门槛的两侧。「门槛侧」真正有判别力的是另外 4 条(单字中文/单字符
ASCII/混合/一致性),它们已经完整覆盖了 M-2 要求的收紧方向。

**判定:Minor**(不影响本刀的产品码正确性,也未违反 §9.10——四条新断言都不放宽任何既有断言,
只是「门槛下一侧」这 2 条相对于 K49 已有的 2 条是**零增量**)。建议:要么删除这 2 条改引用 K49 块
说明覆盖已足够,要么把注释里「不同方向表达同一个门」改成准确表述(它们不表达门槛的另一侧,只是用不同
输入复现 K49 已验证的空输入行为)。**不要求本刀返工**,登记即可。

### 2.2 I-1 断言钉的是"实参来自组件状态"还是"某个固定值"

自己读断言实现:每条用例都先 `trigger('click')` 真实按钮(如 `qualityButtons[1].trigger('click')` /
`topkButtons[idx].trigger('click')`),并在点击前后核对 `data-on` 属性翻转,再断言 `spy.mock.calls[0][0]`
里的值随之改变。**不是钉固定值** —— 若产品码把 `rerank`/`topK` 写死成任意常量,点击后 `data-on` 仍会翻转
但 `runSearch` 实参不变,断言会失败(已用探针①②验证)。**判定:有判别力,无问题。**

### 2.3 M-4 是否只改注释

```
$ git diff 0f4e406 181ee7f -- src/i18n/messageSyntax.test.ts | grep '^+' | grep -c "it(\|expect("
0
```
✅ **确认零断言改动**,新增 9 行全部 `//` 注释,内容准确引用 P5e-R13(与 P5f 自己的 R13 未混淆)。

### 2.4 参数化/新增用例空转检查

I-1 的 `for (let idx...)` 循环生成 4 条 `it(...)`,`--reporter=verbose` 输出逐条列出「点第 1/2/3/4 个
档位」四个独立具名用例且各自单独 pass/fail(见 §0.3 探针②的输出),**不是循环体一次没跑**。
`topkButtons.length===4` 的防空循环断言也确认按钮真渲染。**无空转问题。**

---

## 3. 两条自报事项裁断

### (a) 附录 A §A.0 顺手订正

**核对算术**:R10 终值表写「复用 11 / 新增 79」;`p5f-appendix-A-i18n.md` 原文 §A.0 写「可复用 14 /
需新增 76」。T1b 的订正把这两行改成 `→ 🔴 订正:11` / `→ 🔴 订正:79`,`90 − 11 = 79` 算术正确,
与 R10 终值一致。**订正内容对。**

**是否该追认**:brief 只点了 §A.2 标题 + §A.6 三行,§A.0 两行确系 brief 之外的顺手动作,但
① 已按 R22 显式申报(§4.1 表末行明写「brief 只点了三行 + 标题,这两行是本刀主动加的,故此处显式申报」);
② 严格遵守「反转不删」——原文「14 条」「76」逐字保留,只是追加 `→ 🔴 订正:…`;
③ 零代码/零风险,是文档一致性的自然延伸(§A.0 是全附录最先被读的「终值」表,留着与 R10 矛盾的数字
本身就是隐患)。**裁断:内容正确,应予追认,不要求回退。**

### (b) M-2「门槛下一侧」两条 vs K49 既有两条

已在 §2.1 用两个方向的探针实测坐实:**这两条对 M-2 真正要守的收紧方向零判别力,且与 K49 既有两条
判据完全相同**(空/全空白 query → 零 `<mark>`),只是喂的文本不同。**裁断:属重复用例 / 零增量**,
按 Minor 报(见 §2.1),建议合并或删除并改引用 K49,不要求本刀返工。

---

## 4. D-4 口径独立复算

自己读 `messageSyntax.test.ts:1341-1757` 的 P5f Task 1 block,逐类列出值级断言覆盖的 key 集合:

```
全角例外 toBe (9)  : aiKbAlAdvancedCustom, aiKbAlDeletedCleaning, aiKbAlExampleHint, aiKbAlPathHint,
                      aiKbAlPriorityFull, aiKbAlPriorityHint, aiKbRtBackendTooOld, aiKbRtDeleteHint,
                      aiKbRtEmpty
码点块 toBe/toContain (12): aiKbWkEmptySub, aiKbWkRenderNote, aiKbRtDeleteTitle, aiKbRtScanInterval,
                      aiKbRtReadOnly, aiKbWkCollapsed, aiKbAlSavedCleaning, aiKbAlDeletedCleaning,
                      aiKbAlNoRules, aiKbAlLibraryHint, aiKbRtBackendTooOld, aiKbRtEmpty
E-45 插值 toBe (9) : aiKbAlAddedExt, aiKbAlAllDeselected, aiKbAlAllSelected, aiKbAlNowIndexing,
                      aiKbAlStoppedIndexing, aiKbRtScanEvery, aiKbWkItemCount, aiKbWkRenderNote,
                      aiKbWkSummaryUpdated

全角∩码点 = 3(aiKbAlDeletedCleaning / aiKbRtBackendTooOld / aiKbRtEmpty)
码点∩E-45 = 1(aiKbWkRenderNote) · 全角∩E-45 = 0 · 三集合交集 = 0
UNION = 9 + 12 + 9 − 3 − 1 − 0 = 26
```
**我自己算出的数字 = 26 条值级断言 / 53 条只有存在性断言,与 T1b 报告的订正数字一致。**
`撞车扫描`块（§9.2/§9.3 一轴撞车 21 对）用的是 `not.toBe(...)` 关系式断言，不钉具体值，按既定口径不计入 ——
已核实该 describe 的实现（`:1680-1757`）确实全部是 `not.toBe`，排除正确。

**结论:不一致时以我自己的数字为准 —— 本次一致,26/53 成立,D-4 订正正确。**

---

## 5. 硬纪律核查

- 全程 `cp` + `md5sum`,零 `git checkout/restore/stash/reset/rebase/amend`。
- `git worktree add --detach` 用于只读跑基线测试,跑完 `git worktree remove --force`,**未触碰当前工作树 HEAD/index**,`git status --short` 全程干净,`git stash list` 两条历史条目原样未动。
- 未部署、未 push、未合 master。

---

## 6. 结论

| 级别 | 计数 |
|---|---|
| Critical | 0 |
| Important | 0 |
| Minor | 1(M-2「门槛下一侧」两条对实际收紧方向零判别力,与 K49 既有两条重复;不要求返工,登记即可) |

**四条债务(I-1/M-1/M-2/M-4)全部落地正确、产品码零改动、既有断言零放宽、三门全绿、归因表自洽。
可以进 T2。**
