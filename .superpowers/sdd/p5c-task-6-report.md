# SP8-P5c Task 6 报告 —— `ParserStatus.vue`(路由 `/ai/parser`)

**状态**:`DONE_WITH_CONCERNS`(唯一顾虑 = brief §5 那条 `dist` 额外门在本刀**不可能**命中,
原因是**任务书前提有误**而非产品有缺陷;已用探针给出决定性证据,详见 §7)。

- 起点:`sp8-ai`@**`091ce5e`**(⚠️ brief §0 写的 `e0c2d54` 已过期一个提交 —— `091ce5e` 就是
  「T6 任务书」那个纯 markdown 提交本身。产品代码坐标不变,三门基线不受影响。登记为 **E-9**)
- 新建 2 个文件,**零既有文件改动**(含路由 / scss / i18n / store,全部零 diff)

---

## 1. 交付物

| 文件 | 行数 | 说明 |
|---|---|---|
| `src/ai/knowledge/parser/ParserStatus.vue` | 305 | 新建。100 行文件头注释 + `<script setup>` + `<template>`,**零 `<style>` 块** |
| `src/ai/knowledge/parser/ParserStatus.test.ts` | 849 | 新建。**47 个用例** |
| `.superpowers/sdd/p5c-task-6-fixture-verify.mjs` | 60 | 新建(台账,`git add -f`)。fixture 抄本的程序化等价校验器 |
| `.superpowers/sdd/p5c-task-6-report.md` | — | 本文件(`git add -f`) |

**零改动实证**:`git status --porcelain` 收敛到只有 `?? src/ai/knowledge/parser/`;
`git diff --stat -- src/ai/knowledge/knowledgeRoutes.ts` 为空;`parser-styles.scss` /
`parserStyles.test.ts` / `knowledge.scss` / `knowledgeStyles.test.ts` / `src/i18n/*` /
`parserStore.ts` / `FolderBrowser.vue` / `folderBrowser.ts` / `deferred.ts` 全部零 diff。

---

## 2. 逐条对照:蓝本 164 行 → New-UI(全覆盖)

蓝本 = `git -C NimoOS-UI show main:src/views/AI/Parser/ParserStatus.vue`(main@`7a6ee6b7`,164 行)。

| 蓝本 | 内容 | New-UI `ParserStatus.vue` | 备注 |
|---|---|---|---|
| `:1` | `<template>` | `:189` | |
| `:2` | `<div class="parser-status-page">` | `:190-195` | 🔴 **K31 拆两层**(见 §3) |
| `:3-9` | `<header class="page-header">`:`h2` + `.header-actions`(`.test-link` + `.refresh-btn`) | `:196-204` | `:6` 的 `🧪` 在 `t()` 外(N16);`:7` 的 `@click`/`:disabled` 顺序照抄 |
| `:11-14` | `.card.unreachable` + `<br />` + `<small>{{ error }}</small>` | `:206-210` | ⚠️ brief 写「蓝本 `:12-15`」**偏了一行**,真实是 `:11-14`(登记 **E-10**) |
| `:16` | `<template v-else>` | `:212` | 整块 4 张卡与警示卡二选一 |
| `:17-18` | `<!-- 控制卡 -->` + `.card.control-card` | `:213-214` | |
| `:19-29` | 状态灯行:`.status-text` + `.dot`(`:class="{paused}"`)+ `.pause-btn` | `:215-226` | `:27` 的 `▶ `/`⏸ ` → 本仓 `:224`,script 侧拼接(N16) |
| `:30-40` | `.concurrency-row`:`label` + 三个 `.radio` | `:227-238` | `:38` 数组下标取 i18n → 本仓 `:236`,**照抄**(N17) |
| `:41-55` | `.device-row`:`label` + 三个 `.radio`(`v-for opt in deviceOptions`)+ `.resolved-hint` | `:239-253` | `:53` 的 `toUpperCase()` 照抄 |
| `:56-65` | OCR 行:`.checkbox` + `.resolved-hint` | `:254-263` | `:61` 取值链加了 TS 断言(见 §2 表下的「类型安全机械改写」) |
| `:66` | `</div>` 控制卡收尾 | `:264` | |
| `:68-76` | `<!-- 队列卡 -->` + `.queue-card` 六个 `.kv` | `:266-274`(六格 `:268-273`) | 六个 emoji 全在 `t()` 外(N16) |
| `:78-89` | `<!-- 文件夹卡 -->` + `h3`(双占位符)+ `.empty` 空态 + `.folder-list` | `:276-288` | `:86` 的 `:style="{width: barWidth(...)+'%'}"` 照抄 |
| `:91-102` | `<!-- 失败卡 -->` + `.toggle` + `<ul v-show v-if>` | `:289-301`(`.toggle` `:291-293` · `<ul>` `:295`) | 🔴 **N19 两指令都照抄** |
| `:103-105` | `</template></div></template>` | `:302-305` | K31 多一个 `</div>`(`:303` + `:304`) |
| `:107-108` | `<script>` + `import { parserStore }` | `:101-105` | K26:改 `import { useParserStore } from '../stores/parserStore'` |
| `:110-117` | `name` + `data()`(`store` / `failedOpen`) | `:107-115`(`t`/`store` `:107-108` · `failedOpen` `:112` · `timer` `:115`) | `<script setup>` 无 `name`;`store` 变 `useParserStore()`、`failedOpen` 变 `ref(false)` |
| `:118-126` | computed `deviceOptions` | `:119-123` | `Auto` → `aiKbDeviceAuto`;另两串硬编码 |
| `:127-132` | `mounted()`:`loadAll()` + `setInterval(…, 5000)` + `document.hidden` | `:127-132` | N20 |
| `:133-135` | `beforeDestroy()`:`clearInterval` | `:135-137` | → `onBeforeUnmount` |
| `:136-137` | `reload()` | `:140-142` | |
| `:138-142` | `togglePause()` 三元 | `:151-153` | 三元表达式语句**逐字照抄**(未改写成 if/else) |
| `:143-145` | `setConcurrency` / `setDevice` / `setOcr` | `:156-164` | 纯转调 |
| `:146-149` | `formatCursor(ms)` | `:167-170` | `!ms → '—'`(U+2014) |
| `:150-153` | `barWidth(count)` | `:177-180`(`|| 1` 在 `:178`) | 🔴 `\|\| 1` 兜底保留 |
| `:154-157` | `truncateErr(s)` | `:183-186` | 严格 `> 120`;`…` = U+2026 |
| `:162-164` | `<style lang="scss" scoped>@import './parser-styles.scss'` | `:105`(JS 侧 `import`) | K24 |

**蓝本行号自查结论**:brief 里 6 个行号引用,**4 对 2 错** ——
`:6`(🧪)✅ · `:27`(`▶ `/`⏸ `)✅ · `:38`(N17)✅ · `:127-135`(N20)✅ ·
🔴 **`:96`「折叠箭头」错** —— `▼`/`▶` 三元在 **`:94`**,`:96` 是那个 `<ul>`(登记 **E-11**);
🔴 **`:12-15`「unreachable 卡」错** —— 真实是 **`:11-14`**(登记 **E-10**)。
另 brief §3.5 把「三个纯函数」挂在 **N22** 名下,但治理 §3.5 的 N22 讲的是
**`ParserTest.vue` 的硬编码技术标识符**,与纯函数无关 —— 措辞错,不影响要求(登记 **E-12**)。
brief §3.6 提「`'GPU (CUDA)'` / `'CPU'` 硬编码不进 i18n(N22)」这一处引用 **是对的**(同族口径)。

---

## 3. 🔴 K31 —— 两层根元素的落地与理由

**落地**(`ParserStatus.vue:190-304`;`<template>` 自身 `:189-305`):

```html
<div class="parser-app">          <!-- 外层:K22 滚动容器 -->
  <!-- 注释 -->
  <div class="parser-status-page"> <!-- 内层:蓝本的 900px 居中列 -->
    …蓝本 :3-102 的全部内容…
  </div>
</div>
```

**为什么必须两层(用户可见 vs 用户不可见的取舍)**:

1. `src/styles/theme.css:318` 是 `body { overflow: hidden }`,而 `/ai/parser` 是**顶层路由**
   (`knowledgeRoutes.ts:62`,不在 `KnowledgeLayout` 之下)→ 不自建滚动容器,超出视口的内容
   **永远看不到**。这就是 K22 给 `.parser-app` 加 `height:100vh/100dvh; overflow-y:auto` 的原因。
2. 但蓝本页面根自带 `max-width: 900px; margin: 0 auto`。**若把滚动容器与页面根压成同一元素**,
   `overflow-y:auto` 的滚动条就落在那条 900px 居中列的**右缘**(宽屏上约在屏幕中间),
   而 Vue2 是整页滚动、滚动条在**视口最右缘** → **这本身就是「界面不 1:1」**。
3. 取舍:**多一层 DOM 用户不可见,滚动条位置用户可见** → 取后者。
4. K22 引的两个先例本来就是两元素:`AreaShell.vue` 的 `.area-shell`(100vh)+ `.area-body`
   (`overflow:auto`)· `knowledge.scss` 的 `.knowledge-app` 外壳 + `.k-scroll` 内滚动器。
5. T2b 已按 K31 把 scss 改成**后代**选择器(`parser-styles.scss:75` 的
   `.parser-app .parser-status-page`,不是复合 `.parser-app.parser-status-page`)—— 模板与它对齐。

**守卫**:`ParserStatus.test.ts` 的 `describe('K31 两层根元素')` 两条 ——
① 根元素 `className` 恰好 `'parser-app'`(不含 `parser-status-page`);
② `.parser-app > .parser-status-page` 存在、两个类各恰好 1 个、内容真在内层。
**RED 探针 E 实证**:把两个类挂回同一个 div → **这两条同时报红**(§8 探针 E)。

**⚠️ 与计划书冲突并已按权威优先级处理**:`p5c-plan.md:204` 仍写着
「根元素 `class="parser-app parser-status-page"`」(单元素),那是 K31 裁定**之前**的文字。
治理文件 §3 K31 明确覆盖它,**治理 + 附录 > brief > 计划书** → 按 K31 做,并在此显式指出冲突。

`dist` CSS 反查(探针态):`.parser-app .parser-status-page{…}` 命中 1、
复合形式 `.parser-app.parser-status-page` 命中 **0** ✅。

---

## 4. 🔴 K1 降层的逐处证明

蓝本 store 是 `Vue.observable({ state: {…} })`,`ParserStatus.vue` 里处处写 `store.state.X`;
T5 落地的 `parserStore.ts` 是 Pinia setup store,**`state` 那一层整个消失**。

### 4.1 state 字段:**31 处** `store.state.X` → `store.X`

| 字段 | 蓝本 `store.state.X` 处数 | 本仓 `store.X` 处数 | 蓝本行号 |
|---|---|---|---|
| `controlState` | 10 | 10 | `:21` `:22` `:27` `:35` `:46` `:51`×2 `:53` `:59` `:139` |
| `stats` | 6 | 6 | `:70` `:71` `:72` `:73` `:74` `:75` |
| `loading` | 5 | 5 | `:7` `:26` `:36` `:47` `:60` |
| `folders` | 5 | 5 | `:80`×2 `:81` `:83` `:151` |
| `failedJobs` | 3 | 3 | `:94` `:96` `:97` |
| `unreachable` | 1 | 1 | `:11` |
| `error` | 1 | 1 | `:13` |
| **合计** | **31** | **31** ✅ | |

取数命令与实测输出:

```
# 蓝本
$ git -C NimoOS-UI show main:src/views/AI/Parser/ParserStatus.vue \
    | grep -o "store\.state\.[a-zA-Z_]*" | sort | uniq -c | sort -rn
     10 store.state.controlState
      6 store.state.stats
      5 store.state.loading
      5 store.state.folders
      3 store.state.failedJobs
      1 store.state.unreachable
      1 store.state.error      →  总计 31

# 本仓(只数 <script setup> 起(:101)之后的正文)
$ awk 'NR>=101' src/ai/knowledge/parser/ParserStatus.vue \
    | grep -o "store\.[a-zA-Z_]*" | sort | uniq -c | sort -rn
     10 store.controlState
      6 store.stats
      5 store.loading
      5 store.folders
      3 store.loadAll        ← action
      3 store.failedJobs
      2 store.error          ← 其中 1 处是模板注释里的说明文字(:206),代码只 1 处(:209)
      1 store.unreachable
      1 store.setOcr / setDevice / setConcurrency / resume / pause   ← 各 1,action
```

→ state 字段代码处数 = 10+6+5+5+3+1+1 = **31**,与蓝本**逐字段等数** ✅

### 4.2 零残留证明

```
$ awk 'NR>=101' src/ai/knowledge/parser/ParserStatus.vue | grep -c "store\.state\."
0                     ← 正文里 0 处
$ awk 'NR<101'  src/ai/knowledge/parser/ParserStatus.vue | grep -c "store\.state\."
1                     ← 仅文件头注释里 1 处说明性提及(:41,解释降层这件事本身)
```

### 4.3 action:**8 处** `store.actions.Y()` → `store.Y()`

| 蓝本 | 处数 | 行号 | 本仓 |
|---|---|---|---|
| `store.actions.loadAll()` | 3 | `:128`(mounted)· `:130`(轮询)· `:137`(reload) | `store.loadAll()` ×3 |
| `store.actions.resume()` | 1 | `:140` | `store.resume()` |
| `store.actions.pause()` | 1 | `:141` | `store.pause()` |
| `store.actions.setConcurrency(n)` | 1 | `:143` | `store.setConcurrency(n)` |
| `store.actions.setDevice(device)` | 1 | `:144` | `store.setDevice(device)` |
| `store.actions.setOcr(enabled)` | 1 | `:145` | `store.setOcr(enabled)` |
| **合计** | **8** | | **8** ✅ |

**降层漏一处会怎样**:那一格渲染成空/`undefined`(如 `store.state.stats.queue_depth.pending`
在 Pinia store 上是 `undefined.queue_depth` → 运行时抛错)。本刀的 47 条用例**全部走真 store**
(§5),所以每一条渲染断言天然就是一条降层断言。

---

## 5. mock 策略的选择与理由

🔴 **选:mock 共享包 `service.ai.parser*`,走真 `parserStore`。不 mock store。**

**理由**:本页所有数据都要穿过 `parserStore` 的 K1 降层与 N7 兜底。mock store 会把
「降层与字段名到底对不对得上」这件本刀最容易翻车的事整个绕开;走真 store 则
**每一条渲染断言同时是一条集成断言** —— 模板里少降一层 `.state.`、或字段名写错一个字母,
对应那一格立刻变空。代价只是每个用例要 `flushPromises()` 等四发 `Promise.all` 落地。

→ 因此**不需要**另设「至少一条走真 store 的集成用例」:**47 条里凡涉及数据的全都是**。

### 5.1 mock 形状的层次(治理 §4.1 五行表)

| mock 的方法 | 形状 | 依据 | 与既有测试一致? |
|---|---|---|---|
| `service.ai.parserStats` | **HTTP 原样 snake_case** = fixture 原文 | `ai.ts:591` 只 `return res.data` | 与 `parserStore.test.ts` / `knowledgeStore.parser.test.ts` 一致 ✅ |
| `service.ai.parserState` | 同上 | `ai.ts:596` | ✅ |
| `service.ai.parserFolders` | 同上 | `ai.ts:607` | ✅ |
| `service.ai.parserJobs` | 同上(`{jobs:[…]}`) | `ai.ts:612` | ✅ |
| `service.ai.parserControl` | `{}` | `ai.ts:617`;本页不消费响应体 | 与 `parserStore.test.ts:207` / `knowledgeStore.parser.test.ts:136` **逐字一致** ✅ |

**本刀不涉及** `service.notes.*`(camelCase)/ `service.folder.getList`(单层 `{content}`)/
`service.wiki.getCandidates` —— 那三行归 T8/T9。

**red flag 自查**(治理 §4.1「同一方法在两个测试文件里被 mock 成不同形状」):
五个方法逐个对过 `parserStore.test.ts` 与 `knowledgeStore.parser.test.ts`,**零形状分歧**。

---

## 6. i18n:复用 / 新增 / 死键

**新增 0 个键**(T1 已全落地)。本页用到 **26 个键**,全部已存在于
`src/i18n/zh_cn.ts` 与 `en_us.ts`(逐键 `grep -c "^  <key>:"` = 1/1,26/26 全命中)。

| 蓝本行 | 英文原串 | 用的键 | 来源 |
|---|---|---|---|
| `:4` | `Parser details` | `aiKbPrDetailsTitle` | T1 新建 |
| `:6` | `Test sandbox` | `aiKbPrTestLink` | T1 新建(N21 #2:与 `aiKbSetSandboxTitle` 只差首字母大小写) |
| `:7` | `Refresh` | `aiKbRefresh` | **复用** |
| `:12` | `Parser service is not running or unreachable.` | `aiKbPrUnreachable` | T1 新建 |
| `:22` | `Paused` / `Running` | `aiKbPaused` / `aiKbRunning` | **复用** ×2 |
| `:27` | `Resume` / `Pause` | `aiKbResume` / `aiKbPause` | T1 新建 ×2(N21 #1:`aiKbResume` zh 与 `aiKbRebuild` 撞车,**不许统一**) |
| `:31` | `Concurrency level` | `aiKbConcurrencyLevel` | T1 新建 |
| `:38` | `Power-saving` | `aiKbPrCcPowerSaving` | 🔴 T1 新建,**不复用** `aiKbCcPowerSaver`(N21 #3:en 是 `Power saver`,不同) |
| `:38` | `Balanced` | `aiKbCcBalanced` | **复用**(三档里唯一 en+zh 双双一致的) |
| `:38` | `Full power` | `aiKbPrCcFullPower` | 🔴 T1 新建,**不复用** `aiKbCcFullSpeed`(en 是 `Full speed`) |
| `:42` | `Inference device` | `aiKbInferenceDevice` | T1 新建 |
| `:53` | `→ actual {device}` | `aiKbPrResolvedHint` | T1 新建(占位 `{device}`) |
| `:62` | `Enable OCR for scanned PDFs (RapidOCR)` | `aiKbPrOcrLabel` | T1 新建 |
| `:64` | `5–10× slower, only useful for truly scanned documents` | `aiKbPrOcrHint` | T1 新建(N21 #4:zh 是**错译**「真实索引的扫描件」,照抄) |
| `:70` | `Pending` | `aiKbPending` | **复用** |
| `:71` | `Processing` | `aiKbPrQueueRunning` | T1 新建 |
| `:72` | `Done` | `aiKbPrQueueDone` | T1 新建 |
| `:73` | `Failed` | `aiKbFailed` | **复用** |
| `:74` | `Indexed vectors` | `aiKbPrIndexedVectors` | T1 新建 |
| `:75` | `Last synced` | `aiKbLastSynced` | **复用** |
| `:80` | `Pending folders (top {top} of {total} groups)` | `aiKbPrFoldersTitle` | T1 新建(占位 `{top}` `{total}`) |
| `:81` | `No pending` | `aiKbPrNoPending` | T1 新建 |
| `:94` | `Recent failures ({n})` | `aiKbPrRecentFailures` | T1 新建(占位 `{n}`) |
| `:121` | `Auto` | `aiKbDeviceAuto` | 🔴 T1 新建(**裁定 A-1**,**不复用** `aiKbOriginAuto`) |

- **复用 7 条**:`aiKbRefresh` · `aiKbPaused` · `aiKbRunning` · `aiKbCcBalanced` ·
  `aiKbPending` · `aiKbFailed` · `aiKbLastSynced`(全部在附录 A §A.1 的 10 条复用集里)
- **T1 新建键中本页用到 19 条**(附录 A §A.2 的 `aiKbPr*` 14 条 + `aiKbDeviceAuto` /
  `aiKbConcurrencyLevel` / `aiKbInferenceDevice` / `aiKbPause` / `aiKbResume` 5 条无词干键)
- **本刀新增 0 条 · 本刀造成的死键 0 条**(所有 26 键都有本页调用点)
- **不进 i18n 的硬编码**:`'GPU (CUDA)'` / `'CPU'`(蓝本 `:123-124`,技术标识符,N22 同族)
  —— 用例「三档文案」直接断言源码里是裸字面量;并反查 `zh_cn` 里没有 `'GPU (CUDA)'`。
  ⚠️ **不能**反过来断言「语言包里搜不到 `'CPU'`」:本仓语言包里确实另有键的值恰好是 `'CPU'`
  (硬件相关文案,与本页无关)—— 第一版断言这么写栽了一次,已改成落在**本页源码**上。

---

## 7. 🔴 `dist` 额外门 —— **本刀不可能命中,brief 前提有误**(唯一顾虑)

### 7.1 交付态实测:**不命中**

```
$ pnpm build     # exit 0
$ grep -o "parser-status-page" dist/assets/*.css | head
(无输出)
$ grep -c "parser-status-page" dist/assets/index-*.css
0
```

### 7.2 根因(实测,不是推定)

```
$ grep -rn "ParserStatus" src/ --include=*.ts --include=*.vue | grep -v 注释/自身测试
(空)                    ← ParserStatus.vue 全仓零生产 import
$ grep -rn "parser-styles" src/ --include=*.vue
src/ai/knowledge/parser/ParserStatus.vue:105:import '../../styles/parser-styles.scss'
                        ← 唯一的生产 import 就在本文件里
```

`/ai/parser` 在 `knowledgeRoutes.ts:62` 仍是 `component: KnowledgeDeferred`(**T10 才反转**)
→ `ParserStatus.vue` 不在 Vite 的模块图里 → 它的 side-effect `import '…parser-styles.scss'`
**从未被求值** → 不产出任何 CSS。

**brief §5 的前提「它是新文件,在本刀之前没有任何 `.vue` import 它,所以 `dist` 里搜不到是预期;
本刀 import 后必须出现」少了一步**:一个 `.vue` 光「存在且写了 import」进不了产物,
**还得自己被 entry 可达地 import**。这与治理 §12.2 的 **E-8** 是同一个知识点的另一半 ——
E-8 说 `.fb-*` 的 CSS 在 `dist` 里,是因为它搬进了 `knowledge.scss`,而
`knowledge.scss` 由 `KnowledgeLayout.vue` import、后者挂在活路由上;
`FolderBrowser` 组件 **JS** 被 tree-shake 掉正是因为它同样零 import。
**`parser-styles.scss` 没有这条"搭便车"通道** —— 它的唯一入口就是这两个 Parser 页,
而两个页在 T10 之前都不在路由上。

对照实测(同一次 build):
```
$ grep -o "\.fb-crumb" dist/assets/*.css | head -3
dist/assets/index-X0hjF9vH.css:.fb-crumb    ← knowledge.scss 走 KnowledgeLayout 进了产物 ✅
```

→ **登记为 brief 勘误 E-13**:这条门**归 T10**(路由反转那一刀),不是 T6 能达标的。
建议协调者把它挪到 T10 的 DoD;T7(`ParserTest.vue`)同样达不到,原因一样。

### 7.3 探针给出的决定性证据:**wiring 是对的,缺的只是路由**

按治理 §9 第七条(注入必须行首锚定 + 先证落盘)做了一次**临时**探针:把
`knowledgeRoutes.ts:62` 的 `KnowledgeDeferred` 换成 `ParserStatus`(= T10 将要做的事),
重建后立刻命中,随后**完整还原**。

```
anchor1 hits = 1  anchor2 hits = 1        ← 两个锚串各恰好 1 处精确整行命中
landed: true
$ grep -n "ParserStatus" src/ai/knowledge/knowledgeRoutes.ts    ← 交叉验证落盘
45:import ParserStatus from './parser/ParserStatus.vue'
63:  { path: '/ai/parser', name: 'AIParser', component: ParserStatus },

$ pnpm build     # exit 0
$ grep -o "parser-status-page" dist/assets/*.css | head -3
dist/assets/index-CPhsuLE1.css:parser-status-page
dist/assets/index-CPhsuLE1.css:parser-status-page
dist/assets/index-CPhsuLE1.css:parser-status-page      ← ✅ 命中

# 顺带核 K22 三行(与 K21 的 token 块是两条不同规则)
$ grep -o "\.parser-app{height:[^}]*}" dist/assets/index-*.css
.parser-app{height:100vh;height:100dvh;overflow-y:auto}          ← ✅ K22 三行都在

# 顺带核 K31 后代选择器 + 反查复合形式
$ grep -o "\.parser-app \.parser-status-page{[^}]*}" dist/assets/index-*.css
.parser-app .parser-status-page{padding:16px;max-width:900px;margin:0 auto}   ← ✅
$ grep -c "\.parser-app\.parser-status-page" dist/assets/index-*.css
0                                                    ← ✅ 复合形式零处(K31 已生效)

# 两个作用域都进了产物
$ grep -c "parser-status-page" dist/assets/index-*.css   → 1
$ grep -c "parser-test-page"   dist/assets/index-*.css   → 1
```

**还原确认**:
```
$ md5sum src/ai/knowledge/knowledgeRoutes.ts
4b6c89b5e3a7d18e438fbaa8c288fc48      ← 与探针前快照逐字节相同
$ git diff --stat -- src/ai/knowledge/knowledgeRoutes.ts
(空)
$ git status --porcelain
?? src/ai/knowledge/parser/           ← 只剩本刀两个新文件
```
探针后已用交付态重新 `pnpm build`(exit 0),`dist` 不含探针内容。

**结论**:`parser-styles.scss` 的构建管线接线是**正确且已验证的**;`dist` 里此刻搜不到
纯粹因为「本页尚未上路由」这个**计划内**的状态。**未改任何路由文件。**

---

## 8. RED 探针(5 条,全部报红并还原)

注入器:`/tmp/.../scratchpad/red-probe.mjs` —— 治理 §9 第七条:**整行精确锚定**
(`line === anchor`)+ **`hits !== 1` 直接 abort** + md5 前后对比 + `grep -n` 交叉验证落盘,
**先证注入真的落盘再看测试结果**。

### 8.0 🔴 探针纪律当场救了一次(第一版探针 A 锚串写错)

第一次跑探针 A,`hits = 0` → 注入器**abort**,没有改文件:

```
======================= PROBE A =======================
probe=A anchor exact-line hits = 0
Error: ABORT: expected exactly 1 exact-line hit, got 0
vitest exit=0
 Tests  47 passed (47)          ← 若没有 abort 守卫,这里会被读成「守卫抓不到」
```

原因:锚串缩进按 10 个空格写(凭记忆),真实是 **14 个空格**(`grep -n | cat -A` 实测
`:298` 是 `              <div class="error">…`)。这正是治理 §9 第七条描述的
「注入撞不上 → 伪造出一个『守卫无效』的假结论」——**abort 守卫把它挡住了**。
改对锚串后探针 A 正常报红(下表)。

### 8.1 五条探针结果

| 探针 | 注入(整行替换) | 锚点行 | md5 前→后 | 结果 | 报红的完整用例名 |
|---|---|---|---|---|---|
| **A** 模板塞裸色 | `<div class="error">` → 加 `style="color: #ff0000"` | `:298` | `e833b1ac…` → `7da578c3…` | 🔴 **1 failed / 46 passed** | `ParserStatus —— 守卫缺口③:<template> 块零裸色字面量 > <template> 块内(剥离 var()/color-mix() 之后)不含任何裸 hex / rgb / hsl 字面量` |
| **B** 拿掉 `document.hidden` 守卫 | `if (!document.hidden) store.loadAll()` → `store.loadAll()` | `:130` | `e833b1ac…` → `876d44d2…` | 🔴 **1 failed / 46 passed** | `ParserStatus —— N20:… > 🔴 document.hidden 为 true 时跳过这一拍;转回 false 后恢复` |
| **C** 拿掉 `barWidth` 的 `\|\| 1` | `…, 0) \|\| 1` → `…, 0)` | `:178` | `e833b1ac…` → `b1e3a26a…` | 🔴 **1 failed / 46 passed** | `ParserStatus —— 文件夹卡(蓝本 :78-89) > 🔴 barWidth 的 \`\|\| 1\` 兜底:所有 count 都是 0 时宽度是 0%(不是 NaN%)` |
| **D** N19 两指令合并成一个(只留 `v-show`) | `<ul v-show="failedOpen" v-if="store.failedJobs.length" …>` → 删 `v-if` | `:295` | `e833b1ac…` → `3efdf719…` | 🔴 **1 failed / 46 passed** | `ParserStatus —— 失败卡 + N19 三态(蓝本 :91-102) > N19 态①:本机空桶 —— 折叠按钮无条件渲染且能点(「▶ 最近失败（0）」),但点开后 <ul> 整个不渲染` |
| **E** K31 压回单元素 | `<div class="parser-app">` → `<div class="parser-app parser-status-page">` | `:190` | `e833b1ac…` → `a2accb42…` | 🔴 **2 failed / 45 passed** | `ParserStatus —— K31 两层根元素… > 根元素只有 .parser-app(不带 .parser-status-page)` + `… > .parser-status-page 是 .parser-app 的直接子元素,且两者各恰好一个` |

探针 A 的失败断言原文(证明命中的是新注入的那处裸色):
```
AssertionError: expected '\n  <div class="parser-app">\n    <!-…' not to match /#[0-9a-fA-F]{3,8}\b/
```

### 8.2 还原确认

```
$ md5sum src/ai/knowledge/parser/ParserStatus.vue
e833b1ac482a405efc21f9abfd3e3728       ← 与五条探针前的原始 md5 逐字节相同
$ git status --porcelain
?? src/ai/knowledge/parser/            ← 干净:只有本刀的新目录
```

---

## 9. §4.4 fixture 抄本 + 程序化等价校验

**抄本**(`ParserStatus.test.ts` 的 5 个 `FIXTURE-COPY-BEGIN/END` 块,**由脚本从 fixture 直接生成,
零人工转写**):

| 常量 | fixture | 内容 |
|---|---|---|
| `STATS` | `p5c-fixtures/parser-stats.json` | 整份(含 `total_vectors_visual` / `models`) |
| `STATE` | `p5c-fixtures/parser-control-state.json` | 整份 5 字段(`paused: true` 本机暂停态) |
| `FOLDERS` | `p5c-fixtures/parser-folders-pending-20.json` | 整份 20 项 + `total_groups: 119` |
| `FAILED_EMPTY` | `p5c-fixtures/parser-jobs-failed-5.json` | 整份 `{"jobs":[]}` |
| `FAILED_ROW` | `p5b-fixtures/jobs-pending.json` 的 `jobs[0]` | 真行一行(id 348),12 字段全抄 |

**为什么借 pending 桶那一行**:本机 failed 桶实测为空,而 `/v1/parser/jobs` 是同一张表、
同一个序列化器,行形状与 status 无关 → 用它当 N19「非空桶」两态的真行。
**先例**:`parserStore.test.ts` 的 `FAILED_ROW` 与 `knowledgeStore.staleGuard.test.ts` 的
`POISON_FAILED_ROW` 同款做法(T3 修复轮 1 M-2 已认可)。

**校验器**:`.superpowers/sdd/p5c-task-6-fixture-verify.mjs` —— 从测试文件里按标记切出字面量 →
`JSON.parse` → `JSON.stringify`(**保留键序**)→ 与 fixture 走同一管道的结果做 `===` +
sha256 + 字节数三重比对。**输出原文**:

```
$ node .superpowers/sdd/p5c-task-6-fixture-verify.mjs
MATCH   STATS
         fixture: .superpowers/sdd/p5c-fixtures/parser-stats.json
         bytes  : copy=312  fixture=312
         sha256 : copy=5e10998e83c7b290…  fixture=5e10998e83c7b290…
MATCH   STATE
         fixture: .superpowers/sdd/p5c-fixtures/parser-control-state.json
         bytes  : copy=91  fixture=91
         sha256 : copy=f8e96af185ca65d3…  fixture=f8e96af185ca65d3…
MATCH   FOLDERS
         fixture: .superpowers/sdd/p5c-fixtures/parser-folders-pending-20.json
         bytes  : copy=3189  fixture=3189
         sha256 : copy=6ad769318b3eed37…  fixture=6ad769318b3eed37…
MATCH   FAILED_EMPTY
         fixture: .superpowers/sdd/p5c-fixtures/parser-jobs-failed-5.json
         bytes  : copy=11  fixture=11
         sha256 : copy=0a5796e93f9b57dd…  fixture=0a5796e93f9b57dd…
MATCH   FAILED_ROW
         fixture: .superpowers/sdd/p5b-fixtures/jobs-pending.json
         bytes  : copy=262  fixture=262
         sha256 : copy=eb4aabecff7d02ef…  fixture=eb4aabecff7d02ef…

5/5 MATCH
exit=0
```

**fixture 变体**(为覆盖本机看不到的档位,只改单个字段,每处都在用例里注明):
`{...STATE, paused:false}` · `{...STATE, concurrency:4}` · `{...STATE, device:'cpu'}` ·
`{...STATE, resolved_device:''}` · `{...STATE, ocr_enabled:true}` ·
`{...STATS, last_cursor_ms:0}` · `{folders:[], total_groups:0}`(空态)·
两项 `count:0` 的文件夹(barWidth 兜底)· `{...FAILED_ROW, last_error:'x'.repeat(120/121)}`。

---

## 10. N16 emoji 逐处位置核对表

| 符号 | 蓝本行 | 在 `t()` 里/外/script 拼接 | New-UI 落地 | 守卫 |
|---|---|---|---|---|
| `🧪` | `:6` | **外** | `:201` `🧪 {{ t('aiKbPrTestLink') }}` | 断言 `a.test-link` 文本 `'🧪 测试沙盒'`;并断言 `t('aiKbPrTestLink') === '测试沙盒'`(键值零 emoji) |
| `▶ ` | `:27` | **script 侧字符串拼接** | `:224` `('▶ ' + t('aiKbResume'))` | 断言 `.pause-btn` 文本 `'▶ 恢复'` + `t('aiKbResume') === '恢复'` |
| `⏸ ` | `:27` | **script 侧字符串拼接** | `:224` `('⏸ ' + t('aiKbPause'))` | 变体 `paused:false` 断言 `'⏸ 暂停'` + `t('aiKbPause') === '暂停'` |
| `⏳` | `:70` | **外** | `:268` | 六格文本逐字断言 + `t()` 键值零 emoji 断言 |
| `🔄` | `:71` | **外** | `:269` | 同上 |
| `✅` | `:72` | **外** | `:270` | 同上 |
| `❌` | `:73` | **外** | `:271` | 同上 |
| `📦` | `:74` | **外** | `:272` | 同上 |
| `📍` | `:75` | **外** | `:273` | 同上 |
| `▼` / `▶`(折叠箭头) | **`:94`**(brief 写 `:96`,错,见 E-11) | **外**(三元字面量) | `:292` `{{ failedOpen ? '▼' : '▶' }}` | N19 三态用例逐个断言 `'▶ 最近失败（0）'` / `'▼ …'` |
| `→` | `:53` | 🔴 **在键值里**(`→ actual {device}` / `→ 实际 {device}`) | 键 `aiKbPrResolvedHint` | 断言 `zhCn.aiKbPrResolvedHint === '→ 实际 {device}'` + DOM 文本 `'→ 实际 CPU'` |
| `—`(U+2014) | `:147` | script 侧回退值 | `:168`(`formatCursor`) | `last_cursor_ms:0` → `📍 上次同步 —` |
| `…`(U+2026) | `:156` | script 侧截断号 | `:185`(`truncateErr`) | 121 字符用例断言尾字符 |

🔴 **一个都没有挪进/挪出 `t()`,零 KIcon**(用例「零 KIcon」断言源码无 `import KIcon` 且
渲染后 `w.findAll('svg')` 长度为 0)。

**注意 emoji 的 UTF-16 宽度差**:`🔄`/`📦`/`📍` 是非 BMP 码点(各 2 个 UTF-16 单元),
`⏳`/`✅`/`❌` 是 BMP(各 1 个)—— 第一版断言用 `text().slice(0, 2)` 取首字符,
BMP 那三个会多切一个字符导致假报红,已改成带 `u` 标志的 `stringMatching(/^⏳ \S/u)`。

---

## 11. 守卫缺口 ③(治理 §9)

补了一条「`<template>` 块零裸色」定向断言(`ParserStatus.test.ts` 的
`describe('守卫缺口③:<template> 块零裸色字面量')`),做法与 `FolderBrowser.test.ts:414-455`
逐字同款:非贪婪 `/<template>([\s\S]*?)\n<\/template>/` + `stripCalls(['var(','color-mix('])`
剥壳 + 两条正则(`#hex` / `rgba?|hsla?(`)。

- **沿用现状写法;③′ 的贪婪化统一改造归 T8。**
- **覆盖度自检**:断言抽出的片段同时含首部特征串 `aiKbPrDetailsTitle` 与尾部特征串
  `truncateErr(j.last_error)` —— 本组件唯一的嵌套 `<template v-else>` **带属性**
  (不是裸 `<template>`)、其闭合标签也是缩进的 → 不会被提前截断。
- 🔴 **读源文件用 `node:fs`,不用 Vite 的 `?raw`**(vitest 的 CSSEnablerPlugin 会把样式源换成
  空串 → 对空字符串「假通过」)。
- **RED 探针 A 已实证有判别力**(§8.1)。
- 另附两条同族:「本文件零 `<style>` 块 + 确有 `import '…parser-styles.scss'`」·「零 KIcon」。

**踩过的一个坑并已修**:文件头那条 K31 说明注释第一版写在 `<template>` 的**第一个位置**,
导致组件多出一个**注释根节点**、VTU 的 `wrapper.element` 不再是那个 `div`
(`className` 变成 `''`)→ K31 两条断言假报红。注释已移进外层 `div` **内部**,
并在注释里就地记下这个原因,防下游复制时再踩。

---

## 12. §3 K1–K33 本刀命中的每一条(显式申报)

| # | 命中? | 本刀怎么落地 |
|---|---|---|
| **K1** | ✅ | **31 处** state + **8 处** action 逐处降层,零 `store.state.` 残留(§4 有逐字段计数) |
| **K5 / K30** | ⚠️ **明确不适用** | `:13` 的 `<small>{{ store.error }}</small>` 回显的是 `e.message \|\| String(e)`(网络层,`parserStore.ts:184`),**蓝本行为,照抄**。K5/K30 管的是「不把后端响应 body 的 `detail` 拼进 toast」,不是同一件事(brief §3.6 已就此显式裁定)。用例正向断言 `<small>` 文本 == `'parser down'` |
| **K9** | ✅(继承) | 所有 60+ 裸类名的 CSS 都收在 `parser-styles.scss` 的页面作用域下(T2b 已做);本刀模板只是使用者,零 `<style>` 块 |
| **K21** | ✅(消费方) | 本文件**零 token 声明**;`.parser-app` 的 token 来自 `knowledge.scss` 那两个被 T2a 扩了逗号项的声明块。`dist` 探针实测两档 token 块都命中 `.parser-app` |
| **K22** | ✅ | 外层 `.parser-app` 承载 `height:100vh/100dvh; overflow-y:auto`(scss 在 T2b);模板提供这个元素。`dist` 探针实测 `.parser-app{height:100vh;height:100dvh;overflow-y:auto}` |
| **K23** | ✅(消费方) | 用 `.parser-status-page` 这个**本页专属**作用域;不与测试页共享同名类段 |
| **K24** | ✅ | 样式走 **JS 侧 `import '../../styles/parser-styles.scss'`**(`:105`),**零 `<style>` 块**。先例 `KnowledgeLayout.vue:43` / `AgentPage.vue:72` / `SettingsPage.vue:70` |
| **K25** | ✅ 申报 | 本页暗色档与 Vue2 不同(Vue2 只有一套浅色)—— 用户 2026-08-03 口径,**有意的**,评审勿报回归 |
| **K26** | ✅ | `Vue.observable` → Pinia setup store 的消费侧:`data(){store}` → `useParserStore()`、`failedOpen` → `ref(false)`、`this._timer` → 组件本地 `let timer`、`beforeDestroy` → `onBeforeUnmount` |
| **K27** | ✅(继承) | 本文件零直调 REST,全部经 store 走共享包 |
| **K31** | ✅ | **两层根元素**(§3 有完整落地 + 理由 + 探针 E)。**并指出计划书 `:204` 与它冲突,按 K31 做** |
| **K33** | ✅(受益方) | 5 秒轮询 + 刷新按钮 + 五个控制动作共 8 个并发入口都打到 `store.loadAll()` 上,其 epoch 守卫由 T5 提供;本刀的「`:disabled="loading"` 两侧」用例正是它保护的那个用户可见后果(按钮提前解禁) |
| K2 / K3 / K4 / K6 / K7 / K8 / K10–K20 / K28 / K29 / K32 | — | 本刀不涉及(无 toast / 无弹窗 / 无 KIcon / 无 FolderBrowser / 无 props) |

## 13. §3.5 N1–N22 本刀命中的每一条(逐条说明确实照抄了)

| # | 命中? | 照抄的证据 |
|---|---|---|
| **N7** | ✅(继承) | `failedJobs` 的 `\|\| []` 兜底在 store 里(T5);本刀用例「`last_error` 为 `null` → 渲染空串」等间接覆盖 |
| **N16** | ✅ | **13 个符号逐处核对表见 §10**,一个都没挪进/挪出 `t()`;`▶ `/`⏸ ` 仍由 script 拼接;`→` 仍在键值里;**零 KIcon**(有专门用例) |
| **N17** | ✅ | `:236` 逐字照抄 `[t('aiKbPrCcPowerSaving'), t('aiKbCcBalanced'), t('aiKbPrCcFullPower')][[1,2,4].indexOf(n)]`。**没有改成 computed 映射表**。用例断言三档文案顺序 `['省电 (1)','平衡 (2)','全力 (4)']` |
| **N19** | ✅ | `:295` 逐字照抄 `<ul v-show="failedOpen" v-if="store.failedJobs.length" class="failure-list">`,**两个指令都在**。三态用例:空桶(`<ul>` 不存在,点开后仍不存在 = **正确行为**)· 非空未展开(`<ul>` 存在但 `display:none`)· 非空展开(可见)。**RED 探针 D** 实证合并成单指令即报红 |
| **N20** | ✅ | `:127-137`:`onMounted` 先 `loadAll()`、`setInterval(…, **5000**)`、内部 `if (!document.hidden)`、`onBeforeUnmount` 清 `clearInterval`;句柄是**组件本地 `let timer`**(不进 store)。三条用例:4999ms 不发 / 5000ms 发一轮 + 再一轮(证明是 interval 不是 timeout)· `hidden=true` 连跳三拍、转 false 恢复 · 卸载后推进 60s(12 拍)零发。**RED 探针 B** 实证拿掉守卫即报红 |
| **N21** | ✅ | 四组撞车/错译**一个都没「顺手改对」**:`aiKbResume`(zh 与 `aiKbRebuild` 撞车)· `aiKbPrTestLink`(与 `aiKbSetSandboxTitle` 只差首字母大小写)· `aiKbPrCcPowerSaving`/`aiKbPrCcFullPower`(**没有**复用 `aiKbCcPowerSaver`/`aiKbCcFullSpeed`)· `aiKbPrOcrHint`(「真实**索引**的扫描件」这个语义错译原样渲染,用例逐字断言) |
| **N22**(同族口径) | ✅ | `'GPU (CUDA)'` / `'CPU'` 保持**裸字面量**,**没有**顺手补 i18n 键;`formatCursor` 的 `—`、`truncateErr` 的 `…` 也不进 i18n |
| N1–N6 / N8–N15 / N18 | — | 本刀不涉及(N15 的 `.k-progress-*` 归 scss 那一刀;N18 归 T7) |

**三个纯函数的照抄**(brief §3.5 误挂在 N22 名下,见 E-12,但要求本身已满足):
`formatCursor` 的 `if (!ms) return '—'` · `barWidth` 的 `reduce` + **`\|\| 1`** ·
`truncateErr` 的严格 `> 120` + `slice(0,120) + '…'` —— 三条都没「改进」,
且各有专门用例(`formatCursor(0)` → `—` · max=0 → `0%`(**RED 探针 C**)· 120/121 两侧边界)。

---

## 14. 用例清单(47 条)与本机数据当预期

| describe | 条数 | 覆盖 |
|---|---|---|
| K31 两层根元素 | 2 | 根 `className` / 直接子元素 / 各恰好一个 / 内容真在内层 |
| 页头 | 4 | 标题·`🧪`链接+href·刷新文案 · 挂载即拉一次(四发参数)· 点刷新再拉 · 🔴 `:disabled` **两侧**(在飞 7 个 input + 按钮全禁 → 落地全解禁) |
| unreachable 两态 | 2 | 不出现(四张卡都在)/ 出现(`store.error` 回显 + 四张卡整块不渲染 + 页头仍在) |
| 控制卡 状态灯+按钮 | 4 | `paused:true` 本机档(`.paused` 类 + 「已暂停」+「▶ 恢复」)/ `paused:false` 变体(「运行中」+「⏸ 暂停」)/ 点击分派 resume / 点击分派 pause |
| 控制卡 并发档(N17) | 4 | 三档文案顺序 · `:checked` 两侧(concurrency 2)· `:checked` 两侧(变体 4)· `@change` 载荷键 `n` |
| 控制卡 推理设备 | 7 | 三档文案(含硬编码源码断言)· `:checked` 两侧 ×2 · `.resolved-hint` 渲染 `→ 实际 CPU` · `v-if` 前半不渲染 · `v-if` 后半不渲染 · `@change` 载荷 |
| 控制卡 OCR | 3 | 文案 + N21 错译提示逐字 · `:checked` 两侧 · `@change` 从 `$event.target.checked` 取 true/false |
| 队列卡 6 格 | 3 | 六格文本逐字(emoji 位置)· 六个 `<b>` 数字 · `formatCursor(0)` → `—` |
| 文件夹卡 | 5 | 标题双占位符(20 / 119)· 20 行内容 · barWidth 100% / 22% · 🔴 max=0 兜底 0% · `v-if` 空态 |
| 失败卡 + N19 三态 | 5 | 态①空桶(按钮能点、点开仍不渲染)· 态②非空未展开(`display:none`)· 态③非空展开 · truncateErr 120/121 · `last_error: null` |
| N20 轮询 | 3 | 5000ms 频率(4999 不发 / +1 发 / 再一拍)· `document.hidden` 跳过+恢复 · 卸载后零发 |
| N16 符号位置 | 2 | 键值零 emoji(10 键)+ `→` 在键值里 · 模板里「符号 + 空格 + 文案」 |
| 守卫缺口③ | 3 | `<template>` 零裸色(+覆盖度自检)· 零 `<style>` 块 + 确有 scss import · 零 KIcon |

**本机数据当预期(治理 §4.3,已写进用例)**:`paused:true` · `concurrency:2` · `device:'auto'` ·
`resolved_device:'cpu'` · `ocr_enabled:false` · `queue_depth{339,1,0,9}` ·
`total_vectors_text:5592` · folders 20 项 / `total_groups:119` · **`failedJobs: []`** ✅ 全部覆盖。

**治理 §13 的两个高危可点性项已按「预期行为」写死**:
① 失败卡折叠按钮**能点**(无条件渲染,「▶ 最近失败(0)」),但**点开后列表整个不渲染**——
用例名里就写着「这是正确行为」;② 文件夹卡本机走 `v-else` 列表分支,`No pending` 空态
**本机验不到**,靠 mock 覆盖(用例里注明)。

---

## 15. 三门 + 额外门(完整终值)

```
$ pnpm test                    > /tmp/p5c-t6-test.log
exit=0
 Test Files  324 passed (324)
      Tests  3294 passed (3294)
   Duration  68.39s

$ pnpm exec vue-tsc --noEmit   > /tmp/p5c-t6-tsc.log
exit=0        (输出为空)

$ pnpm build                   > /tmp/p5c-t6-build.log
exit=0        ✓ built in 12.41s
              (只有既有的 "Some chunks are larger than 500 kB" 提示,非本刀引入)
```

- **红项:0 条。零复跑**(两条已知噪声 `persist.test.ts > dropPersisted…` 与
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态**本轮都没红**)。
- **算术核对(全对)**:
  - 文件数 **323 → 324**(+1 = `ParserStatus.test.ts`)✅ 实测 324
  - `.vue` **176 → 177**(+1 = `ParserStatus.vue`)→ `color-guard` **+1 例**
  - 用例数 **3246 + 47(本刀新用例)+ 1(color-guard)= 3294** ✅ 实测 3294,**零误差**
- `.vue` 台账(治理 §8.1)更新:T6 落地后 `.vue` 总数 = **177**(下一刀 T7 → 178)。
- Service 仓零改动 → 未跑跨仓 `pnpm build` / `pnpm install`(治理 §8)。
- **额外门:不命中**(交付态 `grep -c` = 0)。**原因是 brief 前提有误、归 T10**,
  完整取证与探针见 **§7**。

---

## 16. 「本页此刻未上路由是预期」

`/ai/parser` 在 `knowledgeRoutes.ts:62` 仍是 `component: KnowledgeDeferred`,
`/ai/parser/test` 在 `:63` 同样是占位页 —— **T10 才反转**。
→ **用户此刻在浏览器 `:5288` 里点不到这一页,这是计划内的预期状态,不是缺陷。**
本刀**未改**任何路由文件(`knowledgeRoutes.ts` / `deferred.ts` 零 diff,md5 已实证)。

同一原因导致 §7 那条 `dist` 额外门此刻无法达标。

---

## 17. NEEDS_CONTEXT / 需协调者拍板

1. 🔴 **brief §5 的 `dist` 额外门归属**:请把它从 T6 挪到 **T10**(路由反转那一刀)。
   T6 与 T7 都不可能达标(两个 Parser 页在 T10 之前都不在路由上);
   本刀已用探针证明「接线正确、只缺路由」(§7.3)。**未自行改路由。**
2. **计划书 `p5c-plan.md:204`** 仍写着 K31 之前的单元素根 `class="parser-app parser-status-page"`,
   建议就地订正,免得 T7 照它写(T7 会有一模一样的选择)。

## 18. brief / 计划书勘误汇总(下游以本节为准)

| # | 出处 | 原文 | 权威源实际 | 影响 |
|---|---|---|---|---|
| **E-9** | brief §0 | 起点 `e0c2d54` | HEAD 是 **`091ce5e`**(= T6 任务书那个纯 markdown 提交) | 无(产品代码坐标不变,基线不受影响) |
| **E-10** | brief §3.6 | unreachable 警示卡「蓝本 `:12-15`」 | 真实是 **`:11-14`**(`:11` 是 `<div>`,`:14` 是 `</div>`;`:15` 是空行) | 无(内容描述对) |
| **E-11** | brief §3.1 | 折叠箭头「约 `:96`」 | 真实是 **`:94`**;`:96` 是那个 `<ul v-show v-if>` | 无(治理 §3.5 N19 引 `:96` 指 `<ul>`,是对的) |
| **E-12** | brief §3.5 | 把「三个纯函数照抄」挂在 **N22** 名下 | 治理 §3.5 的 N22 讲的是 **`ParserTest.vue` 的硬编码技术标识符**,与纯函数无关 | 无(要求本身已满足);brief §3.6 引 N22 说 `'GPU (CUDA)'`/`'CPU'` 那一处**是对的** |
| **E-13** | brief §5 / 计划书 T6 | 「本刀 import 后 `dist` 里**必须**出现 `parser-status-page`」 | 🔴 **不成立**:`.vue` 光「存在且写了 import」进不了产物,还得被 entry **可达地** import;而 `/ai/parser` 在 T10 之前指占位页 → 零 import → 模块不进 Vite 图 → scss 从未求值 | **这条门归 T10**;T7 同样达不到。见 §7 |
| **E-14** | 计划书 `:204` | 根元素 `class="parser-app parser-status-page"`(单元素) | 已被治理 **K31** 覆盖成两层 | 按 K31 做;建议就地订正计划书,免得 T7 照它写 |

---

## 19. 提交

单个语义提交,`.superpowers/sdd/` 三个文件用 `git add -f`(该目录被 gitignore 盖着):

```
git add src/ai/knowledge/parser/ParserStatus.vue \
        src/ai/knowledge/parser/ParserStatus.test.ts
git add -f .superpowers/sdd/p5c-task-6-report.md \
           .superpowers/sdd/p5c-task-6-fixture-verify.mjs
```

**禁用项自查**:未用 `git add -A` / `git add .`;未 rebase / reset / stash / merge / push;
未跑 `./scripts/deploy.sh`;未写 `/var/lib`;未改任何后端仓;未动 `:5288` 的 dev server;
未碰 `/home/nimo/NimoTech/NimoOS-New-UI` 与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`。
