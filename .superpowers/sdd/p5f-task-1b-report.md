# SP8-P5f Task 1b 报告 —— 债务刀(I-1 / M-1 / M-2 / M-4)+ T1 评审两条订正

> **状态**:🟢 完成。**纯加测试 + 文档订正,产品码零改动**(逐文件 md5 + `git diff --stat` 双证)。
> **起点**:`sp8-ai` @ **`0f4e406`**(现测确认,见 §0)。
> **范围**:brief 允许的 5 个文件,一个没多、一个没少。

---

## 0. 起点确认(自己现测,未照抄 brief)

```
$ git log --oneline -3
0f4e406 docs(p5f): T1 独立评审 —— Critical 0 / Important 1 / Minor 4,三条申报全部成立
e9cea74 feat(p5f-t1): 知识库最后三页 i18n 键(复用 11 / 新增 79,两档)
8289a1a docs(p5f): 裁定 R13-R16 —— M-2 反转 / 附录禁令解除
$ git branch --show-current
sp8-ai
$ git status --short        →(空)
```

**三门起点基线(本刀自己重跑一遍,未照抄)**:

```
$ pnpm test  > /tmp/p5f-t1b-baseline.log   → exit=1
 Test Files  1 failed | 334 passed (335)
      Tests  1 failed | 4301 passed (4302)
 FAIL  src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget
```
⇒ **`Test Files 335` / `Tests 4302` 与 brief 给的基线逐字一致**;唯一红项是治理 §8 已登记的
IndexedDB flaky 噪声(**未动它**)。

---

## 1. 逐文件改了什么(五个文件,全部只加不改)

| 文件 | 动作 | `git diff --numstat` |
|---|---|---|
| `src/ai/knowledge/views/SearchView.test.ts` | 末尾追加 I-1 断言块(1 个 describe / 8 例) | **97 增 / 0 删** |
| `src/ai/knowledge/components/FileDetailDrawer.test.ts` | 末尾追加 M-1 断言块(1 个 describe / 3 例) | **63 增 / 0 删** |
| `src/ai/knowledge/util/searchAggregate.test.ts` | 末尾追加 M-2 断言块(1 个 describe / 6 例) | **58 增 / 0 删** |
| `src/i18n/messageSyntax.test.ts` | M-4 订正注释,**只加注释,零断言改动** | **9 增 / 0 删** |
| `.superpowers/sdd/p5f-appendix-A-i18n.md` | §A.0 两行 + §A.2 标题 + §A.6 三行的订正记号 | 见 §5 |
| `.superpowers/sdd/p5f-task-1-report.md` | D-4 口径 `62/79 → 53/79` 订正块 | 见 §5 |

### 1.1 🔴 「既有每一行未动」的逐行自证(治理 §1.1 极窄解禁的硬性要求)

**判据 = `git diff` 的删除行数必须为 0,且 hunk 只有一个、位置在文件末尾(或 M-4 那处注释内)。**

```
$ for f in <四个文件>; do git diff -U0 -- $f | grep -E '^@@'; \
    echo "删除行数: $(git diff -U0 -- $f | grep -c '^-[^-]')"; done

--- src/ai/knowledge/views/SearchView.test.ts
@@ -1432,0 +1433,97 @@ describe('SearchView —— T7:两个子组件可同时挂载 + N41(…
   删除行数: 0
--- src/ai/knowledge/components/FileDetailDrawer.test.ts
@@ -654,0 +655,63 @@ describe('FileDetailDrawer —— T5 DoD-12:自动上膛守卫(…
   删除行数: 0
--- src/ai/knowledge/util/searchAggregate.test.ts
@@ -669,0 +670,58 @@ describe('fileVM.name 兜底 — aiKbSrUntitled', () => {
   删除行数: 0
--- src/i18n/messageSyntax.test.ts
@@ -1014,0 +1015,9 @@ describe('i18n message syntax', () => {
   删除行数: 0
```

🔴 **四个文件全部是 `-X,0 +Y,N` 形态的纯插入 hunk**(`,0` = 原文件在该位置删了 0 行),
**删除行数逐个为 0** ⇒ **既有每一行逐字未动**,且**没有一条既有断言被放宽**(§9.10 满足:
本刀原则上一条既有断言都没改,实际也确实一条没改)。

前三个文件的插入点都在**文件末尾**(行号 = 原行数 + 1);`messageSyntax.test.ts` 的插入点在
`:1014` 之后、`it(...)` 之前的**注释区内**,插入的 9 行**全是 `//` 注释**(见 §4)。

### 1.2 🔴 产品码零改动自证

```
$ git diff --stat -- src/ai/knowledge/views/SearchView.vue \
    src/ai/knowledge/components/FileDetailDrawer.vue \
    src/ai/knowledge/util/searchAggregate.ts \
    src/ai/knowledge/components/KFileViewer.vue src/i18n/zh_cn.ts src/i18n/en_us.ts
(无输出 = 零改动)

$ md5sum(探针还原后) vs 基线 /tmp/p5f-t1b-md5-baseline.txt
189df8a9d6397286672d99921387d2c0  src/ai/knowledge/views/SearchView.vue          ✅ 一致
df5951f718129cb199c6205fc45acad4  src/ai/knowledge/components/FileDetailDrawer.vue ✅ 一致
3466dd7de6465ef2c2f2340add577a81  src/ai/knowledge/util/searchAggregate.ts        ✅ 一致
4a4d4a9a85bccb4959e7aa165de34f08  src/i18n/zh_cn.ts                               ✅ 一致
```

`git status --short` 里只有那 4 个 `.test.ts` + 2 个 `.md`,**零 `.vue` / 零产品 `.ts`**。

---

## 2. 四条债务的落地与 RED 探针

### 2.1 I-1 —— `runSearch` 的 `topK` / `rerank`(`SearchView.test.ts`)

🔴 **入参真实来源由本刀自己回读 `SearchView.vue` 确认,未照抄 brief 的措辞**:

| 入参 | 来源 | 坐标 |
|---|---|---|
| `topK` | `const topK = ref(10)`;高级面板第 4 个 `.k-adv-field` 的 `[5,10,20,50]` 四个按钮 `@click="topK = n"` | `SearchView.vue:108` / `:432-441` / 调用处 `:223` `topK: topK.value` |
| `rerank` | `const quality = ref<'fast'\|'accurate'>('fast')`;第 3 个 `.k-adv-field` 两个按钮 | `:107` / `:421-426` / 调用处 `:224` `rerank: quality.value === 'accurate'` |

⚠️ **注意 `rerank` 传的是布尔,不是 `quality` 字符串本身** —— 断言按布尔钉(`toBe(false)` / `toBe(true)`),
并加了 `typeof call.topK === 'number'`(防「按钮文本字符串直传」的形态)。

**新增 8 例**(1 个 describe):
`fast → rerank===false` · `accurate → rerank===true` · 默认 `topK===10` ·
4 条参数化(点第 1/2/3/4 档 → `topK===5/10/20/50`,带**防空循环**断言 `topkButtons.length===4` 与按钮文本核对)·
1 条「两个入参同时非默认」防串。

#### RED 探针 ①(把 `rerank` 反转)

```
$ cp src/ai/knowledge/views/SearchView.vue /tmp/p5f-t1b-SearchView.vue.bak
$ sed -i "224s/^      rerank: quality\.value === 'accurate',$/      rerank: quality.value !== 'accurate',/" …
=== 注入落盘自证 ===
      topK: topK.value,
      rerank: quality.value !== 'accurate',
224c224
<       rerank: quality.value === 'accurate',
>       rerank: quality.value !== 'accurate',

$ pnpm exec vitest run src/ai/knowledge/views/SearchView.test.ts --reporter=verbose   → exit=1
 × … 债务 I-1 … > quality="fast"(默认)→ rerank === false(布尔 false,不是 "fast"/undefined)
 × … 债务 I-1 … > 🔴 quality="accurate" → rerank === true(反转即报红)
 × … 债务 I-1 … > 🔴 两个入参同时非默认 → 一次调用里 topK 与 rerank 各自独立正确(防「串了一个」)
 Test Files  1 failed (1)
      Tests  3 failed | 75 passed (78)
```
🔴 **「真报红」而不是「跑挂了」的证据**:`75 passed` —— 套件正常执行完毕,
红的是**三条具名断言**(不是 Startup Error;R13 同族的教训已避开,全程 `--reporter=verbose`)。

#### RED 探针 ②(把 `topK` 焊死成 10)

```
$ cp /tmp/p5f-t1b-SearchView.vue.bak … ; md5 = 189df8a9… ✅ 与基线一致(还原确认)
$ sed -i '223s/^      topK: topK\.value,$/      topK: 10,/' …
=== 注入落盘自证 ===  223c223  <  topK: topK.value,  >  topK: 10,

$ pnpm exec vitest run … --reporter=verbose   → exit=1
 × … 🔴 点第 1 个档位(5)→ topK === 5(焊死成 10 时,非 10 的三档必须报红)
 × … 🔴 点第 3 个档位(20)→ topK === 20(…)
 × … 🔴 点第 4 个档位(50)→ topK === 50(…)
 × … 🔴 两个入参同时非默认 → 一次调用里 topK 与 rerank 各自独立正确(防「串了一个」)
 Test Files  1 failed (1)
      Tests  4 failed | 74 passed (78)
```

**还原确认(禁 `git checkout`,一律 `cp` + `md5sum` 逐字节比对)**:
```
$ cp /tmp/p5f-t1b-SearchView.vue.bak src/ai/knowledge/views/SearchView.vue
$ md5sum src/ai/knowledge/views/SearchView.vue → 189df8a9d6397286672d99921387d2c0
  基线                                         → 189df8a9d6397286672d99921387d2c0   ✅ 逐字节一致
$ git diff --stat -- src/ai/knowledge/views/SearchView.vue → (空)
```

### 2.2 M-1 —— `loadChunkContext` 的 `window: 2`(`FileDetailDrawer.test.ts`)

**新增 3 例**:① `arg.window === 2` 且 `typeof === 'number'`;
② 四个入参整体 `toEqual({fileId, kind, chunkNo, window: 2})`;
③ 切到第二个 chunk 后重发 —— `chunkNo` 跟着变而 `window` 仍是 2(证明不是只有首发才对)。

🔴 **加固申报(裁定 R22 / 治理 §9.10)**:brief 的 DoD 只要求钉 `window: 2`;
本刀顺手把**另外三个入参**一并钉住(它们同属那一次 `mock.calls` 覆盖缺口,决定这一发打向哪个 chunk)。
**这是加固,不是放宽** —— 断言只增不减,既有断言零改动。

#### RED 探针 ③(`window: 3`)

```
$ cp src/ai/knowledge/components/FileDetailDrawer.vue /tmp/p5f-t1b-FileDetailDrawer.vue.bak
$ sed -i '120s/^      window: 2,$/      window: 3,/' …
=== 注入落盘自证 ===
      chunkNo: c.chunkNo,
      window: 3,
120c120  <  window: 2,  >  window: 3,

$ pnpm exec vitest run src/ai/knowledge/components/FileDetailDrawer.test.ts --reporter=verbose → exit=1
 × … 债务 M-1 … > 🔴 window === 2(数值 2,不是字符串/未传;改成 3 即报红)
 × … 债务 M-1 … > 🔴 四个入参整体形状:fileId / kind / chunkNo 取自当前 chunk,window 恒 2
 × … 债务 M-1 … > 🔴 切到第二个 chunk 后重新发起:chunkNo 跟着变,window 仍是 2(不是只有首发才对)
 Test Files  1 failed (1)
      Tests  3 failed | 37 passed (40)      ← 37 passed ⇒ 真报红,不是跑挂

$ cp … .bak 还原;md5sum → df5951f718129cb199c6205fc45acad4 = 基线 ✅
```

### 2.3 M-2 —— `highlight` 的长度门(`searchAggregate.test.ts`)

🔴 **本刀自己回读 `searchAggregate.ts:258` 确认真实判据**(brief 的 `>= 1` 只是提示,R18):

```ts
const terms = String(query).trim().split(/\s+/).filter((s) => s.length >= 1)
```
⇒ 门槛 = **每个 term 长度 ≥ 1**。
⚠️ **重要实测事实**:`trim()` 之后 `split(/\s+/)` 在**非空串**上**永远不会产出空串**,
唯一能产出长度 0 term 的输入是**空 / 全空白 query**(`''.split(/\s+/) === ['']`)
⇒ 「差一个字符 = 长度 0」这一侧**只能**由空/全空白 query 到达(已写进注释与用例)。

**新增 6 例**:门槛侧 3 条(单字中文 `税` / 单字符 ASCII `b` / 多词里混一个单字)·
门槛下一侧 2 条(空 query / 全空白 query,零 `<mark>`)· 1 条「长度 1 与长度 3 行为一致」
(证明判据是长度门而不是特例分支)。

#### RED 探针 ④(`>= 1` → `>= 2`)

```
$ cp src/ai/knowledge/util/searchAggregate.ts /tmp/p5f-t1b-searchAggregate.ts.bak
$ sed -i '258s/s\.length >= 1/s.length >= 2/' …
=== 注入落盘自证 ===  258c258  <  … >= 1)  >  … >= 2)

$ pnpm exec vitest run src/ai/knowledge/util/searchAggregate.test.ts --reporter=verbose → exit=1
 × … 债务 M-2 … > 🔴 单字中文 query(长度 1)→ 必须高亮(门槛收紧成 >= 2 即报红)
 × … 债务 M-2 … > 🔴 单字符 ASCII query(长度 1)→ 必须高亮
 × … 债务 M-2 … > 🔴 多词 query 里混着一个单字 term → 长短两个 term 都要高亮(不许只留长的)
 × … 债务 M-2 … > 长度 1 与长度 3 的 term 在同一份文本上行为一致(证明判据是长度门,不是特例分支)
 Test Files  1 failed (1)
      Tests  4 failed | 77 passed (81)
```

#### 🔴 附加探针 ④b(反方向 `>= 0`)—— 兑现注释里那句话,不留空口断言

注释里写了「相反方向由 K49 块既有两条捕获」。**空口声明不算证明**,所以实跑了:
```
$ sed -i '258s/s\.length >= 1/s.length >= 0/' …    → exit=1
 × highlight — K49 XSS 注入用例 > 空 query(空字符串)→ 原样返回 escape 后的文本,不含 <mark>
 × highlight — K49 XSS 注入用例 > 空 query(全空白)→ 同上
 × highlight — 债务 M-2 … > 空 query(长度 0 的唯一到达方式)→ 零 <mark>,原样返回 escape 后的文本
 × highlight — 债务 M-2 … > 全空白 query(trim 后长度 0)→ 零 <mark>
      Tests  4 failed | 77 passed (81)
```
⇒ **两个方向都有牙**(收紧 → M-2 新块红;放松 → K49 既有两条 + M-2 新块共 4 条红)。

```
$ cp … .bak 还原;md5sum → 3466dd7de6465ef2c2f2340add577a81 = 基线 ✅
```

### 2.4 M-4 —— `messageSyntax.test.ts` 的订正注释

🔴 **行号自己现测**:那句旧理由在 **`:1013-1014`**(与 P5e 终审记的一致,但本刀是自己 grep 定位的):
```
$ grep -n "deliberately not named here" src/i18n/messageSyntax.test.ts   → 1013
$ grep -n "aiCfgKnowledgeSoon"          src/i18n/messageSyntax.test.ts   → 1039, 1040(R13 守卫)
```

**落地**:在 `:1014` 之后插入 9 行 `//` 注释,**引条目编号 `P5e-R13` / `D-9`,不引 `file:line`**,
说明「上面那句的**理由**已被 P5e-R13 作废(R13 判定该两难是假的:既定死键 grep 口径本来就排除
`*.test.ts`),该键确实在下方几个 `it` 里被 R13 防复活守卫具名引用 —— **以那条守卫为准,不以这句话为准**」。
🔴 **原文一句未删**(守「反转不删」);🔴 **零断言改动**。

⚠️ 🔴 **两个「R13」没搞混**:本条引的是 **P5e 的 R13**(D-9 grep 口径放宽 + 守卫加进 `.test.ts`),
**不是** P5f 的 R13(`sim-r8r9.mjs` 存在 / 评审 M-2 反转)—— 注释里写死了 `P5e-R13` 前缀。

---

## 3. 三门(全量、落盘、未 `| tail`)

```
$ pnpm test                  > /tmp/p5f-t1b-test.log  2>&1   → exit=0
 Test Files  335 passed (335)
      Tests  4319 passed (4319)

$ pnpm exec vue-tsc --noEmit > /tmp/p5f-t1b-tsc.log   2>&1   → exit=0(日志 0 行)

$ pnpm build                 > /tmp/p5f-t1b-build.log 2>&1   → exit=0(✓ built in 13.73s)
```

**已知噪声**:起点基线那一跑里 `src/files/upload/persist.test.ts > dropPersisted …` 红了一次
(IndexedDB flaky,治理 §8 已登记);**收官这一跑它自己绿了**,未做任何改动。

### 3.1 🔴 用例数归因(裁定 R24 —— 必须与总数自洽)

| 文件 | 起点(= 落地后 − Δ) | **落地后(实测)** | Δ(新增 `it` 数,逐条可数) | 内容 |
|---|---|---|---|---|
| `SearchView.test.ts` | 70 | **78** | **+8** | I-1:2(rerank)+ 1(默认 topK)+ 4(参数化档位)+ 1(组合) |
| `FileDetailDrawer.test.ts` | 37 | **40** | **+3** | M-1:window / 整体形状 / 切 chunk 后重发 |
| `searchAggregate.test.ts` | 75 | **81** | **+6** | M-2:门槛侧 3 + 门槛下侧 2 + 一致性 1 |
| `messageSyntax.test.ts` | 136 | **136** | **0** | M-4 纯注释,零用例 |
| 四文件小计 | 318 | **335** | **+17** | |
| **全量** | **4302** | **4319** | **+17** | **8 + 3 + 6 + 0 = 17 ✅ 与 4319 − 4302 逐字对上** |

**落地后每文件实测**(单独跑,`Tests N passed`):
```
src/ai/knowledge/views/SearchView.test.ts          -> 78
src/ai/knowledge/components/FileDetailDrawer.test.ts -> 40
src/ai/knowledge/util/searchAggregate.test.ts      -> 81
src/i18n/messageSyntax.test.ts                     -> 136
四文件一起跑:Test Files 4 passed (4) / Tests 335 passed (335)  = 78+40+81+136 ✅
```
🔴 **口径说明**:「起点」一列是 `落地后 − Δ` **推算**的(起点那一跑用的是默认 reporter,
不打每文件计数)。Δ 本身是**可逐条数的新增 `it` 数**(无 `it.each`;唯一的 `for` 循环长度
被 `expect(TOPK_BUTTONS.length)` 钉死为 4),且**全量差 17 与四文件小计差 17 互证**。

**`Test Files` 335 → 335 不变**(本刀零新建测试文件,brief 允许的 5 个文件里 4 个是既有 `.test.ts`)。
**`.vue` 总数不变 ⇒ `color-guard` 用例数不变**(本刀零新增 `.vue`)。

---

## 4. T1 评审的两条订正(brief §2-5)

### 4.1 附录 A 的复用判定列(评审 Minor-3)

**问题**:`p5f-appendix-A-i18n.md` §A.6 第 **50 / 54 / 89** 行的「复用判定」列仍写 🟢 可复用
`aiKbNtDelete` / `aiKbOriginAuto` / `aiKbStatusRemoved`,**与裁定 R3(按 A-1 新建)直接相反**;
§A.2 标题也仍写「14 条」,而 R10 终值表是 11 条。

🔴 **行号自己现测**(改前):`grep -n '^| 50 |\|^| 54 |\|^| 89 |\|^## A.2'` → `52 / 265 / 269 / 304`。

**落地(守「反转不删」:原文保留 + 订正记号,引条目编号 R3,不引 `file:line`)**:

| 处 | 改法 |
|---|---|
| §A.2 标题 | `(14 条 → 🔴 **订正:11 条**,…)` + 紧随其后一个 **订正块**(引 **R3** / **R10**,并说明 `messageSyntax.test.ts` 的 `reused` 清单实测就是 11) |
| §A.6 第 50 / 54 / 89 行 | 原判定用 `~~删除线~~` **保留原字**,后接 `→ 🔴 **订正(裁定 R3):新建 aiKbRtDelete / aiKbRtWatchAuto / aiKbWkOpRemoved**(原文保留,见 §A.2 订正块)` |
| §A.0 终值表两行 | 🔴 **申报的顺手扩展(R22)**:`可复用 14` / `需新增 76` 同样与 R3 矛盾,而 §A.0 是全附录最先被读的「终值」表。各加同款 `→ 🔴 订正:11 / 79`。**brief 只点了三行 + 标题,这两行是本刀主动加的,故此处显式申报。** |

**为什么不按评审建议的「删掉旧数字」**:brief 明写「守『反转不删』:原文保留 + 订正块」
⇒ 以 brief 为准,原字一律保留(与治理 §12.1 / 计划书 §0.0 的订正块形态一致)。

### 4.2 `p5f-task-1-report.md` 的 D-4 口径(评审 Important-1)

🔴 **自己复算了一遍,未直接抄评审的数**(算式与集合全部本刀独立列出):

```
全角例外 toBe         : 9   (fullWidthExceptions 的键集)
码点块 toBe/toContain : 12  (zh 侧 10 键 + en em dash 循环带进的 aiKbRtBackendTooOld / aiKbRtEmpty)
E-45 插值 toBe        : 9   (= placeholderKeysWithInterpolation 全集,且该块自带
                             "covers exactly the 9 placeholder-bearing keys" 的集合相等断言)
重叠:全角∩码点 = 3(aiKbAlDeletedCleaning / aiKbRtBackendTooOld / aiKbRtEmpty)
      码点∩E-45 = 1(aiKbWkRenderNote)· 全角∩E-45 = 0
UNION = 26          只有存在性断言 = 79 − 26 = 53
```
**结论与评审一致(26 / 53),但根因描述本刀更细**:原报告的「码点级钉死 8(+1)= 9」也少记 3 条;
不过那 3 条**都已在全角例外的 9 条里**,⇒ **UNION 两种算法都是 26**,原报告真正的错只在
「去重后 = 17」那一步把 **E-45 整组 9 条漏掉**。

🔴 **口径界定**:统计的是**值级断言**(`toBe` / `toContain` / 插值 `toBe` 钉住**值本身**)。
撞车扫描块用的是 `not.toBe(另一个键的值)` 这类**关系式**断言,**不钉值** ⇒ 按既定口径**不计入**。

**实证复核(本刀自己做的探针 ⑤,不是采信评审)**:
```
$ cp src/i18n/zh_cn.ts /tmp/p5f-t1b-zh_cn.ts.bak
$ sed -i "2026s/'每 {h} 小时扫描'/'每 {hour} 小时扫描'/" src/i18n/zh_cn.ts
=== 注入落盘自证 === 2026c2026  <  aiKbRtScanEvery: '每 {h} 小时扫描',  >  … '每 {hour} 小时扫描',
$ pnpm exec vitest run src/i18n/messageSyntax.test.ts --reporter=verbose  → exit=1
 × … > the placeholder-name set across this batch is exactly {ext, group, h, n, path, t}
 × … > zh_cn and en_us use the same set of {…} placeholder names for each of these keys
 × … > E-45 … > aiKbRtScanEvery interpolates {"h":6} into the exact rendered string in both locales
      Tests  3 failed | 133 passed (136)
$ cp … .bak 还原;md5sum → 4a4d4a9a85bccb4959e7aa165de34f08 = 基线 ✅;git diff --stat → 空
```
⇒ `aiKbRtScanEvery` **只属于 E-45 那一组**,却报红 3 条 ⇒ 它确有值级断言,
原报告把它算进「只有存在性断言」的 62 条是错的。**订正成立。**

**落地**:`p5f-task-1-report.md` §1 汇总表那行 + §2.4 标题各加 `→ 🔴 订正:53 / 79`,
§2.4 顶部插入完整**订正块**(含上面的独立复算、重叠集合、实证、**理由引裁定 R24**),
并在「去重后 = 17 / 62」那两行后面补一句「按顶部订正块作废」。**原文一句未删。**

---

## 5. 治理条款命中申报

| 条款 | 命中情况 |
|---|---|
| §1.1 **极窄解禁** | 5 个文件全部在零改动清单上;**逐个给了「删除行数 0」的 `git diff` 自证**(§1.1) |
| §9.10 **只许加固不许放宽** | **一条既有断言都没改**(纯插入 hunk 已证);M-1 的「另三个入参」是**加固**并已申报 |
| §9.5 / 探针纪律 | 全部 `cp` → **行首锚定 `sed`** 注入 → **先证注入落盘**(`diff` + `sed -n`)→ 报红 → `cp` 还原 → **`md5sum` 逐字节比对**;**全程零 `git checkout/restore`** |
| **R13 同族(探针要真报红)** | 全部 `--reporter=verbose`,每次都核到**具名 failed 用例**,且**同跑里有 passed 例**证明不是 Startup Error |
| **R18**(brief 判据只是提示) | M-2 的长度门自己回读产品码确认;**并补了 brief 没要求的反方向探针 ④b**,因为注释里那句话不能空口留着 |
| **R22**(连小整理也要申报) | ① M-1 多钉的三个入参;② 附录 A **§A.0 两行**的顺手订正(brief 只点了 §A.2 标题 + §A.6 三行)。**两条都在上文显式申报** |
| **R24**(归因表与总数自洽) | §3.1 给了 `8+3+6+0 = 17`,与 `4319 − 4302` 逐字对上 |
| **R11 / R26**(git 禁令) | **零 `amend` / 零 `stash` / 零 `reset` / 零 `rebase`**;stash 栈**一条都没碰**;台账用 `git add -f` 在本刀提交时一并落 |
| 治理 §13-1(先确认是可点元素) | I-1 的 quality/topK 用例、M-1 的第二个 chunk 用例都先断了 `length` 与 `data-on`,**防空循环** |
| 禁令 | **零部署 · 零 push · 零合 master · 零 Service 仓改动 · 零依赖变更**(`package.json` / `pnpm-lock.yaml` 未动) |

---

## 6. 顾虑 / 交给协调者的知情项

1. 🔴 **I-1 的 `rerank` 只在「快速/精确」两态间钉死** —— 若将来蓝本加第三档 quality,
   现有断言不会自动覆盖它。**这是既定形态(蓝本只有两档),登记为信息项,不建议现在扩。**
2. **M-2 的「门槛下一侧」与 K49 块既有的两条空 query 用例判据相同、措辞不同**(已在注释里写明是有意成对)。
   若评审认为重复,**判据是它们从不同方向表达同一个门** —— 删任何一侧都会削弱可读性,**建议保留**。
3. **`persist.test.ts > dropPersisted` 这条 flaky 在起点跑红、收官跑绿**,与本刀零关系(治理 §8 已登记)。
   ⚠️ 但它意味着**任何一刀的 `exit` 码都可能被它单独翻成 1**,后续刀看到 `exit=1` 先核用例名。
4. **附录 A §A.0 的顺手订正**(§4.1 表末行)是 brief 之外的动作,**已申报,请协调者确认是否接受**;
   若不接受,回退只需删那两处 `→ 🔴 订正:…` 文字(原文完好)。
5. **D-4 仍按治理 §0.3 继续挂账**,本刀只订正条数(**26 / 53**),**未反转 D-4 本身**。
