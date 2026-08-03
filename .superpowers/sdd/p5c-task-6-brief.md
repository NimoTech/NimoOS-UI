# SP8-P5c · Task 6 —— `ParserStatus.vue`(路由 `/ai/parser`,蓝本 164 行)

## 必读(按序,**不许跳**)

1. `.superpowers/sdd/p5c-common-constraints.md` —— **全文最新版**(已被协调者订正 14 次)。尤其
   §3 的 **K1 / K21 / K22 / K23 / K24 / K25 / K27 / K31**、**§3.5 的 N16 / N17 / N19 / N20 / N22**、
   §4.1(mock 层次)、**§4.3(本机数据现状)**、**§4.4(fixture 抄本)**、§5.1(落点/相对路径)、
   §8(测试门)、**§8.1 的 `.vue` 台账**、§9(测试质量 + 守卫缺口 **③**)+ §9.1、§10、§11、**§13(验收纪律)**
2. `.superpowers/sdd/p5c-appendix-A-i18n.md` —— `aiKbPr*` 词干那批键(**T1 已落地,直接用,不许新增**)
3. `.superpowers/sdd/p5c-appendix-D-classes.md` §D.2 —— 本页的裸类名清单
4. `.superpowers/sdd/p5c-fixtures/` —— `parser-stats.json` · `parser-control-state.json` ·
   `parser-folders-pending-20.json` · `parser-jobs-failed-5.json`
5. `.superpowers/sdd/p5c-plan.md` 的 **T6 节**
6. **先例**(照它们抄,别自己发明):`src/ai/knowledge/stores/parserStore.ts`(T5 刚落地)·
   `src/ai/knowledge/views/QueueView.vue` + `QueueView.test.ts`(P5b:轮询 / `document.hidden` / 模板零裸色断言写法)·
   `src/ai/knowledge/components/FolderBrowser.vue` + 其测试(T3:fixture 抄本 + `FIXTURE-COPY` 标记写法)

**权威优先级:治理文件 + 附录 > 本 brief > 计划书。** 冲突以治理/附录为准并在报告里指出。
🔴 **本 brief 已被证明会出错**(T0 核出 7 处、T3 核出 E-8、T5 核出 K26 措辞错)—— **每个行号自己回源核。**

---

## 0. 起点

- 可写仓 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,起点 **`e0c2d54`**(工作树干净)
- 三门基线(**T5 三轮收官后实测**):
  **`Test Files 323 passed (323)` / `Tests 3246 passed (3246)`** · `vue-tsc` 0 · `vite build` 0
- **本刀新增 1 个 `.vue` + 1 个测试文件** → 文件数 **323 → 324**;
  `.vue` **176 → 177**(治理 §8.1 台账)→ `color-guard` **+1 例**
- 🔴 蓝本 `git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Parser/ParserStatus.vue`(**164 行**)。
  **禁 `cat`/`Read` 那个仓的工作树;禁在那里 checkout / stash / 提交。**

---

## 1. 交付

**新建**:`src/ai/knowledge/parser/ParserStatus.vue` · `src/ai/knowledge/parser/ParserStatus.test.ts`
**不改任何既有文件。** 🔴 尤其 `parser-styles.scss` / `parserStyles.test.ts`(T2b 已收官)、
`parserStore.ts`(T5 已收官)、scss、`src/i18n/*`、**路由**(`knowledgeRoutes.ts` / `deferred.ts` 归 T10)。

---

## 2. 结构与作用域(K31 / K22 / K24)

🔴 **根元素必须是两层**(K31 —— 协调者裁定,`.parser-app` 是**外层包裹**、页面根类在**内层**):

```html
<div class="parser-app">
  <div class="parser-status-page">
    …蓝本 :2-108 的内容…
  </div>
</div>
```

- **为什么两层**:`.parser-app` 带 `height:100vh/100dvh; overflow-y:auto`(K22,因为 `theme.css:318` 是
  `body{overflow:hidden}`,顶层路由页不自建滚动容器**内容永远看不到**);而 `.parser-status-page` 是
  `max-width:900px; margin:0 auto`。**同一元素会让滚动条落在 900px 列右缘(宽屏上约在屏幕中间)**,
  而 Vue2 是整页滚动、滚动条在视口最右缘 → **两层才是 1:1**。
- 样式:`import '../../styles/parser-styles.scss'`(**JS 侧 import,零 `<style>` 块**;
  先例 `KnowledgeLayout.vue:43` / `AgentPage.vue:72` / `SettingsPage.vue:70`)。
- 🔴 **零 KIcon**(T0 勘误 E-2 补登记:两个 Parser 页蓝本零 KIcon,**不许顺手换成 KIcon**,N16 同族)。

---

## 3. 逐条照抄要点(**每条都回源核行号**)

### 3.1 N16 —— emoji / 符号是文案的一部分,位置不许挪
- **在 `$t()` 外面**:`🧪 {{ $t('Test sandbox') }}`(约 `:6`)· `⏳ {{ $t('Pending') }}` · `🔄` · `✅` · `❌` · `📦` · `📍`(队列卡 6 格)
- **由 script 拼接**:`('▶ ' + $t('Resume'))` / `('⏸ ' + $t('Pause'))`(约 `:27`)—— 键值是纯 `Resume` / `Pause`
- **折叠箭头**:`{{ failedOpen ? '▼' : '▶' }}`(约 `:96`)
- 🔴 **一个都不许挪进/挪出 `$t()`,也不许换成图标组件。**

### 3.2 N17 —— 并发档的数组下标取 i18n,**照抄这个写法**
```
{{ [$t('Power-saving'), $t('Balanced'), $t('Full power')][[1,2,4].indexOf(n)] }} ({{ n }})
```
🔴 **不许改成 computed 映射表**(与需求无关的顺手改动)。
⚠️ i18n 键:`Power-saving` / `Full power` 是 **T1 新建的 `aiKbPrCcPowerSaving` / `aiKbPrCcFullPower`**
(**不能**复用 `aiKbCcPowerSaver` / `aiKbCcFullSpeed` —— en 不同);`Balanced` **复用** `aiKbCcBalanced`(en+zh 双双一致)。
**回附录 A 核准键名,别自己猜。**

### 3.3 N19 —— 失败卡的 `v-show` + `v-if` **同挂一个 `<ul>`,两个指令都照抄**
```
<ul v-show="failedOpen" v-if="store.failedJobs.length" class="failure-list">
```
Vue 里 `v-if` 优先级高于 `v-show` → `failedJobs` 为空时整个 `<ul>` 不渲染、`v-show` 是死的。
🔴 **照抄两个指令**(合并成单一指令 = 改 DOM 结构)。
⚠️ **本机 `failedJobs` 实测 `[]`** → 折叠按钮**能点**(它无条件渲染,文案「最近失败 (0)」),
但**点开后列表整个不渲染,这是正确行为**(治理 §13 已点名)。

### 3.4 N20 —— 5 秒轮询 + `document.hidden` 守卫 + 卸载清理
蓝本 `:127-135`:`mounted()` 先 `loadAll()`,再 `setInterval(() => { if (!document.hidden) loadAll() }, 5000)`;
`beforeDestroy()` → **Vue3 用 `onBeforeUnmount`** 清 `clearInterval`。
🔴 **频率(5000)、`document.hidden` 守卫、清理时机全照抄。** 定时器句柄是**组件本地**变量。
⚠️ **定时器归本刀**(T5 的 `parserStore` 里零定时器,那是对的)。

### 3.5 N22 —— 三个纯函数照抄
- `formatCursor(ms)`:`if (!ms) return '—'` → `new Date(ms).toLocaleString()`
- `barWidth(count)`:`reduce` 求 max,**`|| 1` 兜底**(max=0 时防除零)→ `Math.round(count / max * 100)`
- `truncateErr(s)`:`if (!s) return ''`;`s.length > 120 ? s.slice(0,120) + '…' : s`
🔴 **`barWidth` 的 `|| 1` 兜底必须有用例**(max=0 的情形);`truncateErr` 的 **120/121 两侧**都要断言。

### 3.6 其余
- `deviceOptions` computed:`[{value:'auto', label: $t('Auto')}, {value:'cuda', label:'GPU (CUDA)'}, {value:'cpu', label:'CPU'}]`
  —— 🔴 `$t('Auto')` 用 **T1 新建的 `aiKbDeviceAuto`**(协调者裁定 A-1,**不是** `aiKbOriginAuto`);
  `'GPU (CUDA)'` 与 `'CPU'` 是**硬编码不进 i18n**(蓝本如此,N22)。
- `unreachable` 警示卡(蓝本 `:12-15`):`{{ $t('Parser service is not running or unreachable.') }}<br /><small>{{ store.error }}</small>`
  —— 🔴 **这里回显 `store.error` 是蓝本行为,照抄**(K5/K30 管的是「不回显后端 body 到 toast」,这条不是同一件事;
  若你判断冲突,**写 `NEEDS_CONTEXT` 停下**,别自己删)。
- `resolved-hint`:`v-if="device === 'auto' && resolved_device"` → `$t('→ actual {device}', { device: resolved_device.toUpperCase() })`
  —— 占位符键名回附录 A 核。
- 三个控制入口:`togglePause()`(三元调 `resume()`/`pause()`)· `setConcurrency(n)` · `setDevice(v)` · `setOcr(checked)`
  —— 都只是**转调 store**,照抄。`@change="setOcr($event.target.checked)"` 的取值方式照抄。
- **K1 单层取数**:store 已是 Pinia,模板读 `store.stats.queue_depth.pending` 这类,**没有 `.state.` 那一层**
  (蓝本是 `store.state.xxx`,Vue2 的 `Vue.observable` 结构)。🔴 **逐处降层,别漏。**

---

## 4. 测试要求

### 4.1 mock 与 fixture
- 🔴 **§4.4:fixture 数据「抄进测试 + 注释标出处」,不许运行时读 `.superpowers/`**
  (照 T3/T5 的 `FIXTURE-COPY-BEGIN/END` 做法)。**抄完做程序化逐字节等价校验,贴输出,不许肉眼比。**
- 🔴 `service.ai.parser*` 一律 mock 成 **fixture 原样 snake_case**;
  **与 `parserStore.test.ts` / `knowledgeStore.parser.test.ts` 的同名方法形状必须一致**(red flag 自查)。
- ⚠️ 本页数据全部经 `parserStore` 拿 —— 你可以 mock `service.ai.parser*`(走真 store)**或** mock store。
  **选一种并说明理由**;若 mock store,仍要有**至少一条**走真 store 的集成用例(证明降层与字段名真的对得上)。

### 4.2 本机数据当预期(治理 §4.3,写进用例)
`paused: true` · `concurrency: 2` · `device: 'auto'` · `resolved_device: 'cpu'` · `ocr_enabled: false` ·
`queue_depth {pending:339, running:1, failed:0, done:9}` · `total_vectors_text: 5592` ·
`folders` 20 项 / `total_groups: 119` · **`failedJobs: []`**

### 4.3 必须有的用例(至少)
- 队列卡 6 格各自的取值 · 文件夹卡列表 20 行 + 标题的 `{top}` / `{total}` 占位符 · **`v-if="!folders.length"` 空态**(mock 造)
- `unreachable` 两态(警示卡出现/不出现;出现时 `store.error` 回显)
- `paused` 两态(灯的 `.paused` 类 + 按钮文案 `▶ 恢复` / `⏸ 暂停`)
- 三个 radio / checkbox 的 `:checked` 与 `:disabled="loading"`(**两侧都断言**,禁 `toBeUndefined()`)
- **N19**:`failedJobs` 为空 → `<ul>` 不渲染;非空 + `failedOpen` → 渲染;非空 + 未展开 → `v-show` 隐藏(**三态**)
- **N20**:轮询 5 秒触发(假定时器)· `document.hidden = true` 时**跳过**· `onBeforeUnmount` 后**不再触发**(三条)
- `barWidth` max=0 兜底 · `truncateErr` 120/121 边界 · `formatCursor(0)` → `'—'`

### 4.4 缺口 ③
补一条「`<template>` 块零裸色」定向断言。**照现状写法**(③′ 的贪婪化统一改造归 **T8**),
报告里写一句「沿用现状写法,③′ 归 T8」。🔴 **读源文件用 `node:fs`,不许 `?raw`**。必配 RED 探针。

### 4.5 治理 §9 的通用纪律(本刀相关)
- 禁空转;无判别力的断言要 RED 验证并贴两段输出。
- 🔴 **注入脚本本身要行首/整段锚定,先断言注入真的落盘**(`grep -n`/`md5sum` + `assert count==1`)——
  本期已有**两次**「注入撞注释 / 锚串凭记忆写错」事故。
- 🔴 **报行号的断言用「保行版」剥注释**(§9 第八条)。
- 属性态断言直接比字符串值两侧都比,**禁 `toBeUndefined()`**。

---

## 5. 测试门(提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5c-t6-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5c-t6-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5c-t6-build.log 2>&1; echo "exit=$?"
```

🔴 **本刀独有的一条额外门(T2b 挂到本刀的)**:
```bash
grep -o "parser-status-page" dist/assets/*.css | head
```
**必须命中** —— 证明 T2b 新建的 `parser-styles.scss` 真的进了构建管线
(它是新文件,在本刀之前**没有任何 `.vue` import 它**,所以 `dist` 里搜不到是预期;本刀 import 后必须出现)。
⚠️ 顺带核 `.parser-app` 的 K22 三行也在 `dist` 的 CSS 里。

- **全量,不许只跑子集**;**输出完整落盘,不许 `| tail`**。报告贴 `Test Files` / `Tests` 两行 + 红项完整用例名。
- **算术**:文件数 **323 → 324**;`.vue` **176 → 177** → `color-guard` **+1**;再加你新写的用例数。**报告给实测终值。**
- 已知噪声(只它们红就复跑一次并说明,**不要顺手改**):
  `src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget` ·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- **Service 仓零改动** → 不需要跨仓 `pnpm build` / `pnpm install`。

---

## 6. 硬约束

- 禁 `git add -A` / `git add .`;禁 rebase / reset / stash / merge / push;不跑 `./scripts/deploy.sh`;
  不写 `/var/lib`;不改任何后端仓;**不动 `:5288` 的 dev server**。
- **一个任务 = 一个语义提交**,提交后 `git show --stat HEAD` + `git status` 自查。报告 **`git add -f`**。
- **禁碰** `/home/nimo/NimoTech/NimoOS-New-UI`(SP6/SP9)与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7,有并发会话)。
- 🔴 **§1.1 全期零改动清单**一行都不许动:`KnowledgeLayout.vue` · `DashboardView.vue` · `KIcon.vue` ·
  `util/indexedFiles.ts` · `util/indexedFilesView.ts` · `util/dashboardHelpers.ts` · `knowledgeStore.ts` · `.sp8/NimoOS-Service/**`。
- 🔴 **本刀额外零改动**:`parser-styles.scss` · `parserStyles.test.ts` · `knowledge.scss` · `knowledgeStyles.test.ts` ·
  `src/i18n/*` · `parserStore.ts` · `FolderBrowser.vue` / `folderBrowser.ts` · **`knowledgeRoutes.ts` / `deferred.ts`**。
  需要改 → **停下写 `NEEDS_CONTEXT`**。
- 🔴 **不许新增 i18n 键**(T1 已全落地)。缺键 = T1 漏了 → **写 `NEEDS_CONTEXT` 停下**,不要自己加。
- ⚠️ **本页此刻还没上路由**(`/ai/parser` 仍指占位页,T10 才反转)→ **用户此刻在浏览器里看不到它,这是预期**。
  别为此去改路由。

---

## 7. 报告契约

完整报告写 `.superpowers/sdd/p5c-task-6-report.md`(**`git add -f`**),至少含(治理 §10):
- 逐条对照:**蓝本 `ParserStatus.vue:行` → New-UI `:行`**(164 行全覆盖)
- 🔴 **K1 降层的逐处证明**(蓝本 `store.state.xxx` → 本仓 `store.xxx`,数一共几处)
- 🔴 **K31 两层根元素**的落地 + 为什么(滚动条位置)
- 🔴 **`dist` 里 `parser-status-page` 命中的原始输出**(T2b 挂过来的那条门)
- **§4.4 抄本 + 程序化等价校验输出**
- **mock 策略的选择与理由**(mock service 还是 mock store;若 mock store,那条走真 store 的集成用例是哪条)
- **N16 emoji 逐处位置核对表**(哪些在 `$t()` 内、哪些外、哪些 script 拼接)
- **RED 探针的两段输出**(至少 3 条:模板塞裸色 / 拿掉 `document.hidden` 守卫 / `barWidth` 去掉 `|| 1`)+ 还原 + `git status` 干净
- 三门 + 额外门完整终值(含红项完整用例名与归属)
- **§3 的 K1–K33 里本刀命中的每一条显式申报**(至少 K1 / K21 / K22 / K23 / K24 / K25 / K27 / K31)
- **§3.5 的 N1–N22 里本刀命中的**(至少 **N16 / N17 / N19 / N20 / N22**),逐条说明确实照抄了
- **i18n**:用了哪些 `aiKbPr*` / 复用键,**新增 0 个**
- **「本页此刻未上路由是预期」**的说明
- 拿不准的一律 `NEEDS_CONTEXT` 列出来,**不要自己拍**

返回给协调者 **≤15 行**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
提交 sha · 一行三门结果 · `dist` 额外门是否命中 · 等价校验结果 · RED 探针几条全过 · 顾虑。
