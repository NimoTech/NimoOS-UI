# SP8-P5c · Task 6 独立评审 —— `ParserStatus.vue`

**被评审对象**:`6078a7d`(4 文件全新增)· 基线 `091ce5e` · 治理最新版 `39f6769`(已含 E-9~E-14)
**评审方式**:全部结论回权威源自核,**零采信实现者报告**;9 条自做 RED 探针 + 1 次独立复做的临时路由探针 + 1 份独立编写的 fixture 等价校验脚本(含变异验证)。
**结论:`Ready to merge`** —— **Critical 0 / Important 1(测试守卫缺口,产品代码正确)/ Minor 3**。
收尾 `git status` **干净**(见 §9)。

---

## 1. 蓝本 164 行 1:1 —— 我的独立判据(不是抽查)

我没有肉眼逐行对,而是**写了一个规范化 diff**:把实现的 `<template>` 按**四条已申报的偏离**做机械回推,再与蓝本模板做逐字节 diff。

回推的四条(全部是治理已授权/已申报项,除此之外**不许有任何差异**):
1. `t('aiKbXxx')` → `$t('<en_us.ts 里该键的值>')`(i18n 键 → 蓝本的英文原串)
2. `store.X` → `store.state.X`(K1 降层)
3. 删掉外层 `<div class="parser-app">` 包裹(K31)
4. `($event.target as HTMLInputElement).checked` → `$event.target.checked`(报告已申报的 TS 机械改写)

```
$ node ...(见下方脚本)... && diff -u a.txt b.txt; echo "DIFF_EXIT=$?"
written
DIFF_EXIT=0
```

🔴 **`DIFF_EXIT=0` = 回推后与蓝本模板逐字节相同。** 这一条同时钉死了本刀的全部界面 1:1 判据:
**DOM 顺序 · 元素与类名 · 属性名与属性顺序 · 全部文案 · 全部 emoji/符号的位置 · 全部 `:disabled` / `:checked` / `v-if` / `v-else` / `v-show` / `v-for` / `:key` / `:style` 条件**。
(注:若有任何一个 i18n 键的值与蓝本英文原串不符,脚本会渲染成 `??<key>` 从而必然 diff 报错 → 26 个键的**值**也一并被这条证明。)

script 半我逐函数回源核(蓝本 `:110-158` vs 本仓 `:101-186`),9 个成员**逐条对上且形状照抄**:
`deviceOptions`(三档顺序/`Auto` 走 i18n/另两串硬编码)· `onMounted`(先 `loadAll()` 再 `setInterval(…,5000)` 带 `document.hidden` 守卫)· `onBeforeUnmount`(`if (timer) clearInterval`)· `reload` · `togglePause`(**三元表达式语句**,未改写成 `if/else`)· `setConcurrency`/`setDevice`/`setOcr`(纯转调)· `formatCursor` / `barWidth` / `truncateErr`。

标点/码点实测:`—` = **U+2014**、`…` = **U+2026**,两侧(蓝本/本仓)一致。

**覆盖度独立判断:蓝本 164 行 100% 覆盖,零遗漏、零私自"改进"。**

---

## 2. K1 逐处降层 —— 我自己数的,并做了反向探针

不采信报告的 31/8。我用**保注释空白化**(不删行)后逐字段计数,两侧对照:

| 字段 | 蓝本 `store.state.X` | 本仓 `store.X` |
|---|---|---|
| `controlState` | 10 | 10 |
| `stats` | 6 | 6 |
| `folders` | 5 | 5 |
| `loading` | 5 | 5 |
| `failedJobs` | 3 | 3 |
| `error` | 1 | 1 |
| `unreachable` | 1 | 1 |
| **合计 state** | **31** | **31** |
| **合计 action** | **8**(`store.actions.*`) | **8**(`loadAll`×3 · `pause`/`resume`/`setConcurrency`/`setDevice`/`setOcr` 各 1) |

**代码里 `.state.` 残留 = 0、`store.actions` 残留 = 0**(唯一命中在头注释里,是解释文字)。
→ **报告的 31/8 与我的独立计数逐字段吻合。**

🔴 **反向探针 P1(见 §7)**:加回**一处** `.state.` → `vue-tsc` 直接 `TS2551` 报错 + 单文件 44/47 用例报红。**漏一处不可能溜过任何一道门。**

⚠️ **M-1(Minor)**:交付的 `.vue` **头注释 `:42` 写「共 20 处」**,与报告 §4.1/§4.3 的 31/8 和我的实测都不符。产品行为无影响,但源码注释里的这个数会误导下一个读者(P5c 治理 §8.3 刚立过「把不精确数据留在代码里 = 定时炸弹」的纪律)。建议改成 `31 处 state + 8 处 action`。

---

## 3. 逐条专查项的核准结果

| # | 专查项 | 我的核准 |
|---|---|---|
| 3 | **K31 两层根元素** | ✅ `:190` `<div class="parser-app">` + `:195` `<div class="parser-status-page">`,**不是**单元素。两条用例钉住(根 `className` 恰为 `'parser-app'`、`.parser-app > .parser-status-page` 存在、两者各恰好 1 个、内容真在内层)。**探针 P2 压回单元素 → 恰好那两条报红。** 我**没有**引 `p5c-plan.md:204`(E-14 已订正) |
| 4 | **N16 emoji/符号 13 处** | ✅ 逐处回源核:`🧪`(`:6`→`:201`)· `⏳🔄✅❌📦📍`(`:70-75`→`:268-273`)· `▼`/`▶` 折叠箭头(蓝本 **`:94`**,brief 的 `:96` 错=E-11 → `:292`)全在 `t()` **外**;`▶ `/`⏸ `(`:27`→`:224`)由 **script 拼接**;`→` 在**键值里**(`aiKbPrResolvedHint` = `→ actual {device}` / `→ 实际 {device}`);`—`/`…` 是 script 侧回退/截断号。**本页 `t()` 里面零 emoji**。§1 的字节级 diff 已把这 13 处的位置全部证明。**零 KIcon**:空白化后源码 `KIcon` 命中 **0**,另有专门用例断言无 `import KIcon` 且渲染后 `svg` 数为 0 |
| 5 | **N17 写法 + 键名** | ✅ `:236` 逐字是 `[t('aiKbPrCcPowerSaving'), t('aiKbCcBalanced'), t('aiKbPrCcFullPower')][[1,2,4].indexOf(n)]` —— **没被改成 computed 映射表**。键名回附录 A 核:`aiKbPrCcPowerSaving` en=`Power-saving` / `aiKbPrCcFullPower` en=`Full power`(T1 新建)✅;**未**复用 `aiKbCcPowerSaver`(en=`Power saver`)/`aiKbCcFullSpeed`(en=`Full speed`)✅;`Balanced` **复用** `aiKbCcBalanced`(en+zh 双双一致)✅ |
| 6 | **N19 三态** | ✅ `:295` `<ul v-show="failedOpen" v-if="store.failedJobs.length" class="failure-list">` 两个指令都在。三态用例齐:①空桶(按钮无条件渲染可点、点开后 `<ul>` 仍不存在=正确行为)②非空未展开(`<ul>` 存在但 `style.display === 'none'`)③非空展开(`display === ''` + 行内容)。**探针 P3 删掉 `v-show` → 态②精确报红** |
| 7 | **N20 轮询** | ✅ `5000` / `document.hidden` / `onBeforeUnmount` 三条各有用例:频率(4999ms 不发 + 1ms 发 + 再一拍证明是 `setInterval`)· hidden 跳过三拍再恢复 · 卸载后推 60s 零发。定时器句柄是 `<script setup>` 顶层 `let timer`(**编译后即组件实例本地**,不存在 §9.1 那种「挪到模块级」的风险,结构上就守住了)。**探针 P4 拿掉守卫 → 精确报红** |
| 8 | **三个纯函数** | ✅ 按「照抄 + 边界用例」判(**不按 N22**,E-12)。`formatCursor(0)` → `'—'`(U+2014)有用例;`barWidth` 的 **`|| 1`(max=0)** 有专门用例(两行全 0 → `width: 0%`,不是 `NaN%`),**探针 P5 删 `|| 1` → 精确报红**;`truncateErr` **120 原样 / 121 截成 120+U+2026 两侧**都断言,另有 `null → ''` |
| 9 | **`unreachable` 回显 `store.error`** | ✅ **照抄,我不按 K5/K30 报缺陷。** 蓝本行号我实测是 **`:11-14`**(brief 的 `:12-15` 偏 1 行 = E-10,报告已登记)。用例断言 `<small>` 文本 = `'parser down'`(即 `e.message`,网络层信息),并断言四张卡在 `v-else` 下整块不渲染、页头仍在 |
| 10 | **§4.4 fixture 抄本** | ✅ 见 §4(我自己写的脚本 + 变异验证)。`src/` 下**零运行时读 `.superpowers/`**(仅 3 处别处 `.vue` 的散文注释提到 brief 路径,非 fs 读)。mock 形状与 `parserStore.test.ts` / `knowledgeStore.parser.test.ts` **一致**:`parserStats/State/Folders/Jobs` 全是 fixture 原样 snake_case、`parserControl` 三处都是 `{}` |
| 11 | **`dist` 门 + 临时路由探针** | ✅ 见 §5(我独立复做了一遍) |
| 12 | **mock 策略** | ✅ mock 的是**共享包 `service.ai.parser*`,走真 `parserStore`** → 不存在「mock store 绕开降层」的问题,**每条渲染断言天然是 K1 降层的集成断言**(探针 P1 的 44/47 报红就是这一点的实证) |
| 13 | **缺口 ③** | ✅ 有「`<template>` 块零裸色」定向断言,照现状非贪婪写法(③′ 归 T8,我不按「该用贪婪匹配」报缺陷)。它另带**覆盖度自检**(断言抽出的片段同时含首部 `aiKbPrDetailsTitle` 与尾部 `truncateErr(j.last_error)`)。**探针 P8:往模板最后一个元素塞 `style="color: #ff0000"` → 精确报红** → 覆盖度自检不是空话。读源文件用 `node:fs`,全文零 `?raw` |
| 14 | **i18n** | ✅ `git diff 091ce5e..6078a7d -- src/i18n/` **为空**(新增 0 键)。本页用 **26** 个 distinct 键,回附录 A 归类:**复用 7**(`aiKbCcBalanced`/`aiKbFailed`/`aiKbLastSynced`/`aiKbPaused`/`aiKbPending`/`aiKbRefresh`/`aiKbRunning` —— A.1 的 10 条里另 3 条是 SettingsView 专用)+ **T1 新建 19** = 26。报告的「26 = 7 + 19」✅。26 个键的 en 值我逐条比过蓝本英文原串,**26/26 逐字相同**(且已被 §1 的字节级 diff 二次证明);`aiKbPrOcrHint` 的 zh 错译「真实**索引**的扫描件」+ en 的 `–`(U+2013)/`×`(U+00D7) **照抄未"修正"**(N21 #4)✅ |
| 16 | **提交范围** | ✅ `git diff --name-status 091ce5e..6078a7d` = 4 个 `A`(`ParserStatus.vue` / `.test.ts` / 报告 / fixture 校验脚本),**零既有文件改动**。逐个核零改动清单:`parser-styles.scss` · `parserStyles.test.ts` · `knowledge.scss` · `knowledgeStyles.test.ts` · `src/i18n/*` · `parserStore.ts` · `FolderBrowser.vue` · `folderBrowser.ts` · **`knowledgeRoutes.ts`** · `deferred.ts` —— **`git diff --stat` 全空**。`knowledgeRoutes.ts` 工作树 md5 `4b6c89b5…` == `git show 091ce5e:` 的 md5,逐字节一致 |

**附录 D §D.2 类名双向核准**(我自己抽的,不是抄报告):模板实际用到 **33** 个类 = D.2 的 ParserStatus 侧 **32** 个 + 作用域根 `parser-app`。
**「用了但未登记」= 空集,「登记但未用」= 空集** —— 双向零差集。

---

## 4. 我独立编写的 fixture 等价校验 + 变异验证

**没有复用**实现者的 `p5c-task-6-fixture-verify.mjs`。我自己写了 `/tmp/.../rv-fixture-check.mjs`:按 `const` 名从测试源里**括号配平**抽出对象字面量 → `Function` 求值 → 与 fixture 原文的 `JSON.parse` 结果做 `JSON.stringify` 直出比对(**同时钉住值与键序**)。

```
MATCH    STATS         <- p5c-fixtures/parser-stats.json               bytes=312/312
MATCH    STATE         <- p5c-fixtures/parser-control-state.json       bytes=91/91
MATCH    FOLDERS       <- p5c-fixtures/parser-folders-pending-20.json  bytes=3189/3189
MATCH    FAILED_EMPTY  <- p5c-fixtures/parser-jobs-failed-5.json       bytes=11/11
MATCH    FAILED_ROW    <- p5b-fixtures/jobs-pending.json [jobs[0]]     bytes=262/262
ALL 5/5 MATCH (key order + values byte-identical)
```

**变异验证**(证明脚本有判别力,不是空转)—— 注入行首锚定 + 先断言落盘:
```
BASE md5: 65af2cf954710e5998c16a6347c5bd11
anchor hit count = 1                    ← 先断言锚串恰好命中 1 处(治理 §9 第七条)
79:  "total_vectors_text": 5593,        ← 断言注入真的落盘
MUT  md5: dc067ec4157914b993fa9d6835131ed8
MISMATCH STATS  ...  total_vectors_text":5592 vs 5593
1 MISMATCH
RESTORED md5: 65af2cf954710e5998c16a6347c5bd11   ← 与 BASE 逐字节一致
```
**FOLDERS 20 项全抄、字段(`root_id`/`folder`/`count`)一个没精简、顺序一个没改** —— 由键序比对一并证明。
`FAILED_ROW` 借 P5b 的 pending 桶真行(本机 failed 桶实测为空),先例 `parserStore.test.ts` 的 `FAILED_ROW` 同款,**字段一个没改** ✅。

---

## 5. 我独立复做的「临时路由探针」

**先证 E-13 成立(基线态)**:`pnpm build` exit 0 后
```
dist/assets/*.css 里 "parser-status-page" 命中 = 0
dist/assets/*.css 里 "parser-app"          命中 = 2   ← 来自 knowledge.scss 的两个 token 块(K21 扩的选择器)
```
→ `parser-styles.scss` 确实**不在** Vite 模块图里,而 K21 那两行**是**。**E-13 独立坐实:本刀这道门不可能命中,不是缺陷。**

**再自己接一次路由**(行首锚定 + 先断言落盘 + md5 三重):
```
BASE md5: 4b6c89b5e3a7d18e438fbaa8c288fc48
ANCHOR HITS = 1 ; INJECTED OK
62:  { path: '/ai/parser', name: 'AIParser', component: () => import('./parser/ParserStatus.vue') },
MUT  md5: 509b3127e319b51b6f660f8cb57c8f61
build exit=0
parser-status-page                  : 32   ← 命中(独立生成 dist/assets/ParserStatus-DgU3oGuy.css)
.parser-app{height:100vh;height:100dvh;overflow-y:auto}          ← K22 三行,零颜色、零 --x:
".parser-app .parser-status-page"（后代）: 32
".parser-app.parser-status-page"（复合）:  0   ← K31 已生效
RESTORED md5: 4b6c89b5e3a7d18e438fbaa8c288fc48   ← 与 BASE 逐字节一致
git status --short → 空
```
🔴 **T6 的等效证据是真的**;`knowledgeRoutes.ts` **还原完整、干净**(`git diff` 空、md5 与基线一致)。

---

## 6. 三门 —— 我自己复跑

```
$ pnpm test
 Test Files  324 passed (324)
      Tests  3294 passed (3294)
   Duration  67.76s
exit=0                            ← 零红项,已知那两条噪声本轮也没红

$ pnpm exec vue-tsc --noEmit      → exit 0,输出 0 行
$ pnpm build                      → exit 0
$ find src -name "*.vue" | wc -l  → 177        ← 与治理 §8.1 台账的「T6 落地后 177」一致
$ grep -c "^  it(" ParserStatus.test.ts → 47
```
**算术核对**:文件 323 → **324**(+1)✅;用例 3246 + **47**(新)+ **1**(color-guard 按 `.vue` 动态生成)= **3294** ✅ **零误差**。
**报告的三门数字与我的复跑逐字一致。**

---

## 7. 我自做的 RED 探针清单(9 条,全部行首锚定 + 先断言落盘 + md5 还原)

| # | 破坏 | 结果 | 还原 |
|---|---|---|---|
| **P1** | 加回**一处** `.state.`(K1 反向) | 🔴 RED —— `vue-tsc` `TS2551` + **44 failed / 3 passed** | md5 一致 |
| **P2** | K31 压回单元素 `class="parser-app parser-status-page"` | 🔴 RED —— **恰好那 2 条** K31 用例 | md5 一致 |
| **P3** | N19 合并成单一指令(删 `v-show`) | 🔴 RED —— 态② `display: none` 那条 | md5 一致 |
| **P4** | 拿掉 `document.hidden` 守卫 | 🔴 RED —— hidden 跳拍那条 | md5 一致 |
| **P5** | 删 `barWidth` 的 `\|\| 1` 兜底 | 🔴 RED —— max=0 那条 | md5 一致 |
| **P8** | 往模板**最后一个元素**塞 `style="color: #ff0000"` | 🔴 RED —— 缺口③ 那条(证明非贪婪抽取真的覆盖到尾部) | md5 一致 |
| **P9** | 队列卡 `✅`/`❌` 两格**对调顺序** | 🔴 RED —— 3 条(DOM 顺序有守卫) | md5 一致 |
| **P6**(缺口猎) | N17 三档键换成复用 `aiKbCcPowerSaver`/`aiKbCcFullSpeed` | 🟢 **47/47 全绿 —— 无守卫**,见 I-1 | md5 一致 |
| **P7**(缺口猎) | N17 改成 `computed` 映射表 | 🟢 47/47 全绿(形状纪律无行为守卫),见 M-2 | md5 一致 |

⚠️ **P6 第一版锚串命中 2 处**(头注释里也有同一串),注入脚本的 `assert hits == 1` **当场 ABORT** —— 治理 §9 第七条那条纪律在本轮实战里救了一次,我改成锚 `{{ [t('aiKbPrCcPowerSaving')`(带模板插值前缀)后才恰好 1 处。**本轮零「注入撞注释」事故。**

---

## 8. 缺陷清单

### Critical:0

### Important:1

**I-1 —— N21 #3 的键选纪律零守卫(测试守卫缺口,产品代码本身正确)**
探针 P6 实测:把 `:236` 的三档键换成复用 `aiKbCcPowerSaver` / `aiKbCcFullSpeed` → **47/47 全绿**。
成因:并发档唯一的文案断言是 `['省电 (1)', '平衡 (2)', '全力 (4)']`,而两组键的 **zh 值逐字相同**,只有 **en 不同**(`Power-saving`/`Full power` vs `Power saver`/`Full speed`)→ zh 断言对这个替换**完全不敏感**。
这正是治理 §11-2 点名「最容易被误修」的那一条,也是 P5b #91/#92「zh 撞车 en 不同」的同族。
**影响面窄**(全仓只有本文件用这 4 个键,T7 不用),**不影响当前正确性** —— 我已回源核准产品代码用的是 T1 新建的正确两键。
**建议补丁(≈3 行,可折进 T7/T8)**:在那条 N16 键值断言组里加两行 en 档强断言,例如读 `en_us.ts` 表直接
`expect(enUs.aiKbPrCcPowerSaving).toBe('Power-saving')` / `expect(enUs.aiKbPrCcFullPower).toBe('Full power')`,
并顺带 `expect(src).toContain("t('aiKbPrCcPowerSaving')")` 钉住调用点用的是哪个键。补完必须以 P6 翻红为验收判据。

### Minor:3

- **M-1** 交付 `.vue` 头注释 `:42` 写「共 **20 处**」降层,实测/报告都是 **31 处 state + 8 处 action**。行为无影响,但违背 §8.3 立的「不精确数据留在代码里 = 定时炸弹」。建议就地改数。
- **M-2** N17 的「照抄数组下标写法、不许改 computed 映射表」是**形状纪律**,行为等价 → 无法用行为断言守(探针 P7 全绿)。治理 §11-2 已把它交给评审人肉核,**我已回源核准形状照抄** → 登记为「已知无守卫项」,**不要求补**(补它得写源码文本断言,脆弱度大于收益)。
- **M-3** OCR `:checked` 那条用例在**同一个 `it()` 中间**做 `setActivePinia(createPinia())` 再挂第二个实例,与本文件其余变体用例(靠 `beforeEach` 重建 pinia、一态一用例)的写法不一致。能过、无隐患,但拆成两个用例更一致。

### 与报告不符之处

**逐项核完,报告的实质结论零处不符** —— 31/8 降层计数、13 个符号位置表、26 键(7 复用 + 19 新建)、fixture 5/5 MATCH、三门 324/3294 + tsc 0 + build 0、E-10/E-11/E-13 的登记、零 KIcon、零 `<style>` 块,**我全部独立复现一致**。
唯一不一致是 **M-1**:报告正文写 31/8(对),但交付源码的头注释写 20(错)—— 属报告与自家代码注释之间的矛盾,不是报告对权威源的误述。

### 明确**不**按缺陷报的(治理已裁定,我核准适用)

`unreachable` 卡回显 `store.error`(蓝本行为,K5/K30 不适用)· K31 比蓝本多一层 DOM · K25 暗色档与 Vue2 不同 ·
`dist` 那道额外门本刀不命中(**E-13**,我已独立坐实)· 缺口③ 沿用非贪婪写法(③′ 归 T8)·
N19 空桶时点开无列表(正确行为)· `'GPU (CUDA)'`/`'CPU'` 硬编码不进 i18n。

---

## 9. 收尾

```
$ git status --short        → 空
$ git log --oneline -1      → 39f6769
$ 四个交付/零改动文件 工作树 md5 == git show HEAD: md5   → 4/4 SAME
$ dist 已在 .gitignore:2
```
**9 条探针全部逐字节还原,工作树干净。本评审文件将以 `git add -f` 落盘,不 commit。**
