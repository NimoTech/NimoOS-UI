# SP8-P5c · Task 8 —— `SettingsView.vue` 上半 + 守卫缺口 ③′

**本刀范围 = 蓝本 `SettingsView.vue` 的这几块**(行号自己回源核):
服务卡(约 `:7-20`)· 运行档三行(并发 `:24-37` / 设备 `:39-52` / OCR `:54-64`)·
沙盒入口(约 `:161-170`)· 危险区(约 `:173-190`)· 对应 script(`controlState` / `deviceLabel` /
`togglePause` / `setConcurrency` / `setDevice` / `toggleOcr` / `goSandbox`)。

🔴 **下半(笔记根目录 + 迁移弹窗)归 T9** —— **本刀模板里那两块直接不写**(不留占位符、不留注释桩),T9 插进去。

## 必读(按序,**不许跳**)

1. `.superpowers/sdd/p5c-common-constraints.md` —— **全文最新版**(已被协调者订正 22 次)。尤其
   §1.1 零改动清单 + **§1.3(探针可临时写零改动文件)**、§3 的 **K1 / K27 / K30 / K34**、
   **§3.5 的 N16 / N21**、§4.1、**§4.3(本机数据现状)**、**§4.4(fixture 抄本)**、§5.1、**§8.1 台账**、
   §9(**第七/八/九条纪律**)+ **§9.1 / §9.2**、**§9 缺口表的 ③′(本刀负责)**、§10、§11、**§13(验收纪律)**
2. `.superpowers/sdd/p5c-appendix-A-i18n.md` —— `aiKbSet*` 与通用 `aiKb*`(**T1 已落地,不许新增**)
3. `.superpowers/sdd/p5c-appendix-D-classes.md` —— 设置页类名(**T2a 已把 scss 搬完过评审**)
4. `.superpowers/sdd/p5c-fixtures/parser-control-state.json` · `notes-settings.json`
5. `.superpowers/sdd/p5c-plan.md` 的 **T8 节**
6. **先例**:`src/ai/knowledge/parser/ParserStatus.vue` + `.test.ts`(T6:en 档强断言 / fixture 抄本 / 模板零裸色)·
   `src/ai/knowledge/parser/ParserTest.vue`(T7:K34 保抛写法的统一口径)· `QueueView.test.ts`(P5b)

**权威优先级:治理文件 + 附录 > 本 brief > 计划书。**
🔴 **本 brief 会出错**(T0 核出 7 处 · T3 一处 · T5 一处 · T6 六处 · T7 两处)——
**每个行号自己回源核**,核出错登记编号(上一个编号是 **E-16**)。

---

## 0. 起点

- 可写仓 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,起点 **`c22eb37`**(工作树干净)
- 三门基线(**协调者刚实测,以此为准**):
  **`Test Files 325 passed (325)` / `Tests 3380 passed (3380)`** · `vue-tsc` 0 · `vite build` 0 · `.vue` **178**
- **本刀新增 1 个 `.vue` + 1 个测试文件** → 文件数 **325 → 326**;`.vue` **178 → 179**(收官值)→ `color-guard` **+1**
- **改 1 个既有文件**:`src/ai/styles/knowledgeStyles.test.ts`(**只为缺口 ③′**,见 §5)
- 🔴 蓝本 `git -C /home/nimo/NimoTech/NimoOS-UI show main:src/views/AI/Knowledge/SettingsView.vue`(322 行)。
  **禁 `cat`/`Read` 那个仓的工作树;禁在那里 checkout / stash / 提交。**

---

## 1. 交付

**新建**:`src/ai/knowledge/views/SettingsView.vue` · `src/ai/knowledge/views/SettingsView.test.ts`
**改**:`src/ai/styles/knowledgeStyles.test.ts`(**仅缺口 ③′**)
**不改其它任何文件。** 🔴 尤其 `knowledge.scss`(T2a 已收官)· `parser-styles.scss` / `parserStyles.test.ts` ·
两个 Parser 页 · `parserStore.ts` · `knowledgeStore.ts` 本体 · `FolderBrowser*` · `src/i18n/*` · **路由**(归 T10)。

---

## 2. 结构

- 根元素 `<div class="k-view">` → `<div class="k-scroll">` → `<div class="k-scroll-inner">`(蓝本 `:2-4`,**逐层照抄**)。
  ⚠️ **本页在 `KnowledgeLayout` 下**(rail 第 9 项),**不是**顶层路由 → **没有 K22/K31 那套 `.parser-app` 外壳问题**,
  也**不需要**自建滚动容器(`.k-scroll` 已有 `overflow-y:auto`,T2a/P5a 已就位)。
- **零 `<style>` 块** —— 设置页整段 scss(`.k-set-*` / `.k-svc-*` / `.k-radio-group` / `.k-sw` / `.k-section*` /
  `.k-sandbox-*` / `.k-set-danger` / `.k-set-soon`)**T2a 已搬进 `knowledge.scss` 并过评审**。
  🔴 **用到的每个类先 grep 确认真实存在**(附录 D 是白名单权威,现 **226** 项)。
- `KIcon`:本刀用到 `play` / `pause` / `danger` / `test` / `chev`(**11 个 glyph 已核实全在,不许往 `KIcon.vue` 加、
  不许退回 `AgentIcon`**,K4)。

---

## 3. 逐条照抄要点(**每条回源核行号**)

### 3.1 服务卡
- `.k-svc-light` 的 `:data-state="controlState.paused ? 'paused' : 'running'"` —— **属性值照抄**。
- 文案:`controlState.paused ? $t('⏸ Paused') : $t('✅ Running')` —— 🔴 **emoji 在 `$t()` 里面**(N16),
  键值本身含 `⏸` / `✅`。**T1 已落地,回附录 A 核准键名。**
- 副行:`paused ? $t('New files will not be indexed automatically') : $t('Continuously monitoring and indexing new files')`。
- 按钮:`:class="['k-btn', controlState.paused ? 'primary' : 'outline']"` + `<KIcon :name="paused ? 'play' : 'pause'" :size="12"/>`
  + `paused ? $t('Resume') : $t('Pause')`。
  🔴 **`Resume` 用 `aiKbResume`**;⚠️ **N21 #1**:它与既有 `aiKbRebuild` **zh 都是「恢复」**(Vue2 把 `Rebuild` 错译成
  「恢复」)—— **两键并存,不许统一**;**这对只有 en 能判别 → §9.2 要求 en 档强断言**(见 §4.2)。

### 3.2 运行档三行
- **并发**:`v-for="n in [1, 2, 4]"`,`:data-on="String(controlState.concurrency === n)"`,`@click="setConcurrency(n)"`,
  按钮文字就是 `{{ n }}`(**这一行没有档位名称** —— 档位名 `Power-saving`/`Balanced`/`Full power` 在 **ParserStatus**,
  不在本页。**别把 ParserStatus 的写法搬过来。**)
- **设备**:三个按钮 —— `String(device === 'auto')` / `String(device === 'cuda' || device === 'gpu')`(🔴 **两个值**)/
  `String(device === 'cpu')`;文字 `$t('Auto')` / 裸 `GPU` / 裸 `CPU`。
  🔴 `$t('Auto')` 用 **`aiKbDeviceAuto`**(协调者裁定 **A-1**,**不是** `aiKbOriginAuto`)。
  `GPU` / `CPU` 是**硬编码不进 i18n**(蓝本如此)。
- **`deviceLabel` computed**(约 `:219`)四分支:`auto` → `$t('Auto (currently {r})', { r: (resolved_device || '').toUpperCase() })` ·
  `cuda`/`gpu` → 裸 `'GPU (CUDA)'` · `cpu` → 裸 `'CPU'` · 兜底 → 返回 `d` 原串。
  🔴 **四分支全覆盖用例**,含 `resolved_device` 为空时 `(… || '')` 的兜底(渲染 `Auto (currently )`)。
- **OCR**:`<button class="k-sw" :data-on="String(!!controlState.ocr_enabled)" @click="toggleOcr"/>` ——
  🔴 **`!!` 双取反照抄**;描述行里 `<span class="warn"><KIcon name="danger" :size="11"/> …</span>` + 句号 + 后半句(**标点位置照抄**)。
- 🔴 **`data-on` 全部照抄 `String()`**(P5b E-9 裁定);断言一律 `toBe('true')` / `toBe('false')`,**禁 `toBeUndefined()`**。

### 3.3 沙盒入口
`<a class="k-sandbox-link" @click.prevent="goSandbox">` + `.k-sandbox-icon` 里 `<KIcon name="test" :size="20"/>` +
`🧪 {{ $t('Test Sandbox') }}` + 副行 + 末尾 `<KIcon name="chev" :size="14" color="var(--text-tertiary)"/>`。
🔴 **`Test Sandbox`(首字母大写 S)是 `aiKbSetSandboxTitle`**;ParserStatus 那个 `Test sandbox`(小写 s)是
`aiKbPrTestLink` —— **N21 #2:两键并存、zh 都是「测试沙盒」、只有 en 能判别 → §9.2 要求 en 档强断言**。
`goSandbox()` → `router.push('/ai/parser/test')`(蓝本 `:315-318`)。
⚠️ **那条路由此刻仍指占位页(T10 才反转)→ 跳过去看到占位页是预期**,别改路由。

### 3.4 危险区
`.k-section` + `.k-section-head` + `.k-section-title`(**内联 `style="color: var(--danger)"`**,已是 `var()` 不是字面量)+
`.k-section-hint` 的 `$t('Coming soon')`;卡片 `.k-set-card.k-set-danger`,行内 `.k-set-soon` 徽标 +
按钮 `<button class="k-btn danger" disabled>`。
🔴 **按钮硬编码 `disabled`,永远不可点**(蓝本如此)—— 用例只能验「是灰的 + 旁边有『即将上线』徽标」(治理 §13)。

### 3.5 K1 降层 + K27 + K30
- **K1**:蓝本 `this.store.state.controlState` → 本仓 `store.controlState`(Pinia,**无 `.state.` 那层**)。**逐处降,别漏。**
- **K27**:`this.store.actions.setControl(...)` → `store.setControl(...)`;`store.actions.toast(...)` → store 的 `toast`
  或全局 `useToast()`(**照 P5a/P5b 既有写法,别自己发明**;`toast` 的 2400ms 若需要要显式传)。
- 🔴 **K30**:四个 catch 里蓝本拼 `e.message`(`$t('Operation failed') + ': ' + (e.message || e)`),
  **本仓只弹固定 `aiKbOpFailed`(设备那个是 `aiKbSwitchFailed`)**,**不回显后端文本**。
  🔴 **落地判据 = 排除式断言**:让 `setControl` reject 一个带可识别文本的错误(如 `new Error('BACKEND-SECRET-123')`),
  断言 toast/DOM **`not.toContain('BACKEND-SECRET-123')`**。
  ⚠️ **注意 §9 第九条**:否定式断言要先剥注释、别撞上注释里写的那个词 —— **探针文本别在源码注释里出现**。
- 五个动作各自的成功 toast 键(`aiKbResumed` / `aiKbPaused` / `aiKbConcurrencySet`(带 `{n}`)/
  `aiKbInferenceDevice`(带 `{label}`)/ `aiKbOcrEnabled` / `aiKbOcrDisabled`)—— **回附录 A 核准**。
  `setDevice` 的 `label` 三元:`auto → $t('Auto')` / `cpu → 'CPU'` / 否则 `'GPU'`(**照抄**)。

---

## 4. 测试要求

### 4.1 fixture(§4.4)
🔴 **抄进测试 + 注释标出处,不许运行时读 `.superpowers/`**;抄完做**程序化逐字节等价校验 + 变异验证**,贴输出。
`parser-control-state.json`(snake_case 原文)· `notes-settings.json`
⚠️ **`notes-settings.json` 本刀大概只需要不需要** —— 笔记那半归 T9。**用不到就不抄**(别为凑数抄)。
mock 层次:`service.ai.parserControl` = snake_case;**与 `parserStore.test.ts` / `knowledgeStore.parser.test.ts` 形状一致**(自查)。

### 4.2 🔴 §9.2 en 档强断言(**本刀 DoD,本页至少两对同族**)
- **N21 #1**:`aiKbResume`(`Resume`)vs 既有 `aiKbRebuild`(`Rebuild`)—— **zh 都是「恢复」**。
  → en locale 挂载,断言恢复按钮**逐字**渲染 `Resume`,**并反向断言不等于 `Rebuild`**。
- **N21 #2**:`aiKbSetSandboxTitle`(`Test Sandbox`)vs `aiKbPrTestLink`(`Test sandbox`)—— **zh 都是「测试沙盒」**,
  en 差首字母大小写。→ en 档断言**逐字**是 `Test Sandbox`(大写 S),**反向不等于 `Test sandbox`**。
- **A-1**:`aiKbDeviceAuto` vs `aiKbOriginAuto` —— 两者 **en/zh 双双同值** → 渲染断言零判别力,
  **改用「钉 `t()` 调用形状」**(照 T6 的做法,**别用 `not.toContain('aiKbOriginAuto')` 裸标识符** —— §9 第九条,T6 栽过)。
- 🔴 **另外自己把本页全部键 × 全表扫一遍**,找有没有别的「zh 撞车、只有 en 能判别」的对(T7 就扫出一对我不知道的)。
  **扫了没有也要在报告里写「已比对,余零同族对」。**
- **判据**:各配探针 —— 换成被禁键 → 新断言必须报红。

### 4.3 🔴 缺口 ③′(交接项 #4,**本刀统一改掉,别再复制**)
`knowledgeStyles.test.ts` 里「模板零裸色」守卫的 `<template>` 提取现在靠
**「`</template>` 在第 0 列」这个脆弱隐式锚定**;`QueueView.vue` / `IndexedFilesView.vue` 各有 **7 / 12** 个**嵌套** `<template>`。
现在正确,但换个 formatter 或手改缩进,非贪婪正则会**提前截断 → 静默少扫一段模板且三门不红**。

**要求**:
1. 改成**贪婪匹配到最后一个第 0 列 `</template>`**(或直接 `src.lastIndexOf('\\n</template>')`)。
2. 🔴 **加覆盖度自检**:断言抽出的片段**包含模板最后一行的一个特征串**(证明没被第一个嵌套 `</template>` 提前截断)。
3. 🔴 **必配 RED 探针**:在**每个**被扫 `.vue` 的**模板最后一行**塞一个裸色 → **必须报红**(逐个文件验,不是只验一个)。
4. **别再复制那个脆弱正则** —— 本刀之后新加视图一律用新写法。
5. ⚠️ **只改这一条守卫,`knowledgeStyles.test.ts` 其余一行不动**(白名单 226 / `NON_K` 10 / 那些正则都别碰)。

### 4.4 必须有的用例(至少)
服务卡两态(`paused` true/false:灯的 `data-state` + 按钮 class `primary`/`outline` + 图标名 + 文案)·
并发三档各自 `data-on` 两侧 · 设备三档 + **`cuda`/`gpu` 两个值都命中第二档** · `deviceLabel` 四分支 +
`resolved_device` 空兜底 · OCR 开关 `!!` 两态 + `.warn` 行 · 五个动作各自调对 `setControl(action, extra)`
(**键名核准**:并发是 `{ n }`)· 五个成功 toast 各自的键 · **K30 四个 catch 的排除式断言** ·
沙盒入口 `router.push('/ai/parser/test')` · 危险区按钮 `disabled` + `.k-set-soon` 徽标 · **模板零裸色**

### 4.5 治理 §9 的通用纪律(**本期同族事故已十次,别第十一次**)
- 🔴 注入脚本整段/行首锚定 + **先断言注入真的落盘**(`grep -n`/`md5sum` + `assert hits==1`)。
- 🔴 报行号的断言用**保行版**剥注释(第八条)。
- 🔴 **否定式断言先剥注释 + 钉调用形状,不钉裸标识符**(第九条)。
- 🔴 **工具/harness 自身也会造假红**(T7 评审用了 vitest 4 不存在的 `--reporter=basic` → exit 1 假红)——
  **跑测试要能解析到 `Tests` 汇总行才算有效结果**。
- **§1.3**:探针**允许**临时写零改动清单里的文件,只要 ① md5 证明还原 ② 不在提交里 ③ 收尾 `git status` 干净。
  **怕越界而跳过探针才是真问题。**

---

## 5. 测试门(提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5c-t8-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5c-t8-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5c-t8-build.log 2>&1; echo "exit=$?"
```
- **全量,不许只跑子集**;**输出完整落盘,不许 `| tail`**;报告贴 `Test Files` / `Tests` 两行 + 红项完整用例名。
- **算术**:文件数 **325 → 326**;`.vue` **178 → 179**(**本期收官值**)→ `color-guard` **+1**;再加新用例数。
  ⚠️ **缺口 ③′ 改动可能让 `knowledgeStyles.test.ts` 的用例数变化** —— 报实测并说明。
- 已知噪声(只它们红就复跑一次并说明,**不要顺手改**):
  `src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget` ·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- **Service 仓零改动** → 不需要跨仓 `pnpm build` / `pnpm install`。
- ⚠️ **本页此刻未上路由**(rail「系统设置」仍是占位页,T10 才反转)→ 浏览器里看不到,**这是预期**。

---

## 6. 硬约束

- 禁 `git add -A` / `git add .`;禁 rebase / reset / stash / merge / push;不跑 `./scripts/deploy.sh`;
  不写 `/var/lib`;不改任何后端仓;**不动 `:5288` 的 dev server**。
- **一个任务 = 一个语义提交**,提交后 `git show --stat HEAD` + `git status` 自查。报告 **`git add -f`**。
- **禁碰** `/home/nimo/NimoTech/NimoOS-New-UI`(SP6/SP9)与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7,有并发会话)。
- 🔴 **§1.1 全期零改动清单**一行都不许动(`KnowledgeLayout.vue` · `DashboardView.vue` · `KIcon.vue` ·
  `util/indexedFiles.ts` · `util/indexedFilesView.ts` · `util/dashboardHelpers.ts` · `knowledgeStore.ts` · `.sp8/NimoOS-Service/**`)。
- 🔴 **本刀额外零改动**:`knowledge.scss` · `parser-styles.scss` / `parserStyles.test.ts` · 两个 Parser 页及其测试 ·
  `parserStore.ts` · `FolderBrowser*` · `src/i18n/*` · **`knowledgeRoutes.ts` / `deferred.ts`**。
  `knowledgeStyles.test.ts` **只许改缺口 ③′ 那一条**。需要更多 → **停下写 `NEEDS_CONTEXT`**。
- 🔴 **不许新增 i18n 键**。缺键 = T1 漏了 → **`NEEDS_CONTEXT` 停下**。
- 🔴 **不许写下半(笔记根目录 + 迁移弹窗)的任何 DOM / script**,连占位注释都不要 —— T9 会插进去。

---

## 7. 报告契约

完整报告写 `.superpowers/sdd/p5c-task-8-report.md`(**`git add -f`**),至少含(治理 §10):
- 逐条对照:**蓝本 `SettingsView.vue:行` → New-UI `:行`**(本刀范围全覆盖)。
  🔴 **New-UI 侧行号用脚本重算**(T7 那轮就是因为手写行号全面陈旧被评审报 Important)。
- 🔴 **K1 降层逐处证明**(几处)· **K27 走包** · **K30 四个 catch 的排除式断言**(含探针文本没撞注释的说明)
- 🔴 **§9.2 en 档比对**:两对已知同族的断言 + A-1 的调用形状守法 + **全表重扫结论**
- 🔴 **缺口 ③′ 的落地**:改法 + **覆盖度自检断言** + **逐个 `.vue` 在模板最后一行塞裸色的 RED 探针输出**
- **§4.4 抄本 + 等价校验 + 变异验证输出**(若本刀用不到某份 fixture,说明为什么不抄)
- **N16 emoji 位置核对表**(`⏸`/`✅` 在 `$t()` 内;`🧪`/`⚠️`/`📝` 在外)
- **RED 探针的两段输出**(至少 4 条)+ 还原确认 + `git status` 干净
- 三门完整终值(含红项完整用例名与归属)· `.vue` 应为 **179**
- **§3 的 K1–K34 里本刀命中的每一条显式申报** · **§3.5 的 N1–N22 里本刀命中的**(至少 **N16 / N21**)
- **「下半归 T9、本刀确实没写那两块」的自证**(grep 证明模板里没有 `FolderBrowser` / `k-modal` / `kn-mig` 之类)
- **「本页未上路由 = 预期」**的说明
- 拿不准的一律 `NEEDS_CONTEXT` 列出来,**不要自己拍**

返回给协调者 **≤15 行**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
提交 sha · 一行三门结果 · `.vue` 数 · en 档比对结论一行 · 缺口 ③′ 是否落地 + 探针结果 · RED 探针几条全过 · 顾虑。
