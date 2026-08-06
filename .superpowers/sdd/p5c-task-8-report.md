# SP8-P5c Task 8 报告 —— `SettingsView.vue` 上半 + 守卫缺口 ③′

**状态**:`DONE_WITH_CONCERNS`(唯一顾虑 = 下面 §3 那条 §2 授权的 bug 修正需要协调者追认编号)
**起点**:`sp8-ai`@`b28d00c`(brief §0 写的 `c22eb37` 是它自己那个提交的父提交,纯 markdown 差异 → **E-21**)
**产出**:新建 `src/ai/knowledge/views/SettingsView.vue`(**307** 行)· `SettingsView.test.ts`(57 例)·
改 `src/ai/styles/knowledgeStyles.test.ts`(**只加缺口 ③′ 一条守卫**,+21 例)·
台账 `p5c-task-8-fixture-verify.mjs` + 本报告(`git add -f`)

## 1. 三门终值(全量,完整落盘,无 `| tail`)

| 门 | 命令 | 结果 |
|---|---|---|
| 测试 | `pnpm test > /tmp/p5c-t8-test.log` | **exit=0** · `Test Files 326 passed (326)` · `Tests 3459 passed (3459)` |
| 类型 | `pnpm exec vue-tsc --noEmit > /tmp/p5c-t8-tsc.log` | **exit=0**(零输出) |
| 构建 | `pnpm build > /tmp/p5c-t8-build.log` | **exit=0** · `✓ built in 12.70s` |

- **红项 0 条**;已知噪声(`persist.test.ts` 的 IndexedDB flaky / `AgentComposer.test.ts` 的 vue-i18n teardown)**这轮没出现**,零复跑,干净单轮。
- 算术核对:文件数 **325 → 326**(+1 = `SettingsView.test.ts`)✅;
  例数 **3380 → 3459**(+79 = `SettingsView.test.ts` **57** + `knowledgeStyles.test.ts` **+21** + `color-guard` **+1**)✅;
  `find src -name '*.vue' | wc -l` = **179**(本期收官值)✅。
- `knowledgeStyles.test.ts` 用例数 **23 → 44**(改前 `git show HEAD:… | grep -cE '^\s+it\('` = 23;现 24 个 `it(` + 2 个 `it.each` × 10 文件 = 44)(缺口 ③′ 一条清单断言 + 两组 `it.each` × 10 文件)——
  brief §5 提示的「③′ 会让这个文件用例数变化」实测就是 +21。
- 中途一次 `vue-tsc` exit=2(`SettingsView.test.ts(559,41) TS7006: Parameter 'c' implicitly has an 'any' type`,
  `vi.spyOn` 返回类型在 helper 形参上推不出来)→ 把 helper 形参标成 `{ mock: { calls: unknown[][] } }` 后 exit=0;
  修完**重跑了全量测试**(不是只跑单文件),上表是修后的终值。

## 2. 逐条对照(蓝本 `SettingsView.vue` → New-UI,**New-UI 行号全部脚本重算**)

重算命令(逐个 needle 取模板区内首个命中,输出见执行记录):
`python3` 逐行扫 `src/ai/knowledge/views/SettingsView.vue`,`<template>` 起点 `:209`、`<script setup>` 起点 `:119`、总 **307** 行(`wc -l`)。

| 蓝本 | 内容 | New-UI |
|---|---|---|
| `:2-4` | `.k-view` → `.k-scroll` → `.k-scroll-inner` 三层壳 | `:210-212` |
| `:7-19` | 服务卡整块(`.k-set-card.k-set-svc`) | `:215` 起 |
| `:9` | `.k-svc-light` 的 `:data-state` 三元 | `:217` |
| `:11-12` | `⏸ Paused` / `✅ Running` + 副行两句 | `:219-220` |
| `:14-17` | `:class="['k-btn', … 'primary' : 'outline']"` + `play`/`pause` 图标 + `Resume`/`Pause` | `:222-225` |
| `:22-61` | 运行档卡整块 | `:229` 起 |
| `:23-34` | 并发行(标题/中文行/描述 + 三个数字按钮) | `:230-243` |
| `:30-32` | `v-for="n in [1, 2, 4]"` + `:data-on="String(...)"` + `{{ n }}` | `:239-241` |
| `:36-49` | 设备行 | `:245-259` |
| `:41` | `{{ $t('Currently using:') }} <b>{{ deviceLabel }}</b>` | `:250` |
| `:45` / `:46` / `:47` | 三档 `data-on`(auto / **cuda‖gpu** / cpu) | `:255` / `:256` / `:257` |
| `:51-60` | OCR 行 | `:261-271` |
| `:56` | `<span class="warn">…</span>. {{ … }}`(句号在 span 外) | `:266` |
| `:59` | `.k-sw` + `String(!!controlState.ocr_enabled)` | `:270` |
| `:159-166` | 沙盒入口 `.k-sandbox-link` | `:275-281` |
| `:163` | 副行(内联 `color: var(--text-secondary)`) | `:279` |
| `:169-186` | 危险区 `.k-section` | `:284-302` |
| `:171` | `⚠️` 标题 + 内联 `color: var(--danger)` | `:287` |
| `:177` | `.k-set-soon` 徽标 | `:293` |
| `:181` | `<button class="k-btn danger" disabled>` | `:297` |
| `:215` | computed `controlState`(**K1 降层点**) | `:131` |
| `:216-223` | computed `deviceLabel` 四分支 | `:140-147` |
| `:282-289` | `togglePause` | `:155-165` |
| `:290-297` | `setConcurrency` | `:167-174` |
| `:298-306` | `setDevice` | `:182-190` |
| `:307-315` | `toggleOcr` | `:193-201` |
| `:316-319` | `goSandbox` | `:204-206` |

**蓝本 `:63-156`(笔记区 + 迁移弹窗)与 `:203-213` / `:224-226` / `:228-281` 的对应 script 一行都没写 —— 归 T9。**

### 2.1 「下半归 T9」自证(剥注释后 grep,零命中)

`FolderBrowser` 0 · `k-modal` 0 · `kn-mig` 0 · `kn-picked` 0 · `kn-pick` 0 · `kn-badge` 0 · `kn-checkline` 0 ·
`notesSettings` 0 · `rootPicker` 0 · `dirProbe` 0 · `migrat` 0 · `Migrate` 0 · `DialogRoot` 0 · `DialogPortal` 0 ·
`service.notes` 0 · `notesApi` 0 · `browserRoots` 0 · `pickerRoots` 0 · `openRootPicker` 0 · `onPick` 0 ·
`toggleAutoExtract` 0 · `applyRoot` 0 · `📝` 0 · `k-section-body` 0。
含注释的原文里 `notesSettings` / `rootPicker` 各 1 次 —— **只在文件头「下半归 T9」那句说明里**,
所以断言必须先剥注释(治理 §9 第九条)。测试里**没有**为这条写用例:那会变成 T9 的地雷(T9 一加就红)。

### 2.2 「本页未上路由 = 预期」

`knowledgeRoutes.ts` 的 `settings` 仍指 `KnowledgeDeferred`(`DEFERRED_TABS` 含 `'settings'`),T10 才反转;
沙盒入口跳的 `/ai/parser/test` 同样仍是占位页。→ **浏览器里看不到本页、跳过去看到占位页,都是预期**,
本刀零路由改动(`knowledgeRoutes.ts` / `deferred.ts` 都没碰)。

## 3. 🔴 唯一的顾虑 —— `togglePause` 的成功 toast:蓝本两档全反(按治理 §2 修 + 申报,请追认编号)

**蓝本 `:282-288`**:
```js
await this.store.actions.setControl(this.controlState.paused ? 'resume' : 'pause')
this.store.actions.toast(this.controlState.paused ? this.$t('Resumed') : this.$t('Paused'))
```
`setControl` 内部 `await this.loadOverview()`(蓝本 `knowledgeStore.js:311-314`,本仓 `knowledgeStore.ts:425-428`
逐字同构)会**把 `controlState` 换成后端刷新后的新值** → 第二次读到的 `paused` 是**动作之后**的状态:

| 用户操作 | 发出的 action | 刷新后 `paused` | 蓝本弹的 toast | 应该弹 |
|---|---|---|---|---|
| 点「恢复」 | `resume` | `false` | **已暂停** ❌ | 已继续 |
| 点「暂停」 | `pause` | `true` | **已继续** ❌ | 已暂停 |

- **判据(治理 §2)**:「是在修一个**可复现的错误行为**吗?」—— 是,用户可见、两档都错。
- **它是漏改而不是设计的证据**:同一文件另外三个动作**都是先把意图存下来再发** ——
  `setConcurrency` 用形参 `n`、`setDevice` 用形参 `d`、`toggleOcr` 用 `:308` 的 `const next = !ocr_enabled`。
  **四个动作三个对一个错。**
- **本仓改法(最小)**:`const wasPaused = controlState.value.paused` 放在 `await` **之前**,两处都用它。
  DOM / class / 图标 / 文案 / 请求载荷**零变化**,只有 toast 文案由反的变成对的。
- **三件套齐全**:① 代码注释(`SettingsView.vue` 文件头「偏离,§2」整节 + `togglePause` 上方 JSDoc)
  ② 本报告本节 ③ 台账由协调者据此登记。**请追认一个 K 编号(建议 K35)。**
- **回退成本**:改回蓝本 = 删 `wasPaused` 一行 + 把 toast 里的 `wasPaused` 换回
  `controlState.value.paused`。若协调者判「照抄」,顺带把 §4 那两条用例的期望值对调即可。
- **对应用例**(RED 探针 C-7 已实证:改回蓝本写法 → 这两条精确报红):
  `🔴 恢复 → 「已继续」…` / `🔴 暂停 → 「已暂停」…`。两条都**让第二发 `parserState` 返回翻转后的状态**
  (后端真的执行了),这正是蓝本出错的必要前提 —— 如果 mock 两发都返回同一个 `paused`,
  蓝本写法会**碰巧**通过,用例就没有判别力了。

## 4. 测试清单(57 例,分组)

| 组 | 例数 | 覆盖 |
|---|---|---|
| 三层壳 | 2 | `.k-view > .k-scroll > .k-scroll-inner` 逐层 + 四块直挂 + **不挂 `.parser-app`** |
| 服务卡两态 | 3 | `data-state` 两侧 · 两行文案 · 按钮 class `primary`/`outline` · 图标 `play`/`pause` · N16 emoji 位置 |
| 并发行 | 4 | 三行文案 · **按钮文字就是数字**(+ 反向:整页零档位名) · `data-on` 三档 × concurrency 2/1/4 |
| 设备行 | 6 | 三档文案(裸 GPU/CPU 源码断言) · `data-on` 四种 device(auto/cuda/**gpu**/cpu) + 未知档全 false |
| `deviceLabel` | 7 | 四分支 + `resolved_device` **空串**与**缺字段**两种边界 |
| OCR 行 | 4 | 标题/中文行/`.warn` 行(句号位置) · `data-on` 两侧 · **`!!` 兜底**(缺字段 → `"false"`) |
| 四个动作载荷 | 5 | `resume`/`pause` · `set_concurrency {n}` · `set_device {device}` ×3 · `set_ocr {enabled}` 两侧 |
| 成功 toast | 6 | 5 个键 + 「真的落进全局 toast 栈」 |
| **K30 排除式** | 5 | 四个 catch 各一条 + 一条源码侧(零 `.message`/`.response`/`.detail` + 四个无参 `catch {`) |
| 沙盒入口 | 3 | 图标/文案/副行/chev · `router.push` · `@click.prevent` |
| 危险区 | 3 | 区头 · **按钮 disabled + `.k-set-soon` 徽标** · 点它什么都不发生 |
| **§9.2 en 档** | 7 | 4 对同族的正/反向 + 切回 zh 无污染 + **A-1 调用形状** |
| 零 `<style>` / 零色 | 2 | 全文件色扫(比只扫模板更严) |

## 5. fixture(§4.4)

| fixture | 用法 | mock 层次(§4.1) |
|---|---|---|
| `p5c-fixtures/parser-control-state.json` | **整份逐字抄**进 `FIXTURE-COPY` 块 → `service.ai.parserState` | **HTTP 原样 snake_case**(`ai.ts:596` 只 `return res.data`) |
| `p5c-fixtures/parser-stats.json` | **整份逐字抄**(含 `models`,`dim: null` 原样) | 同上(`ai.ts:591`) |
| `service.ai.parserControl` | `mockResolvedValue({})` | 与 `parserStore.test.ts:207` / `knowledgeStore.parser.test.ts:136` / `ParserStatus.test.ts:182` **逐字一致** |
| `p5c-fixtures/notes-settings.json` | 🔴 **不抄** | 笔记那半整个归 T9,本刀组件零 `service.notes.*` 调用(§2.1 已 grep 自证)。治理 §4.4:用不到就不抄 |
| 其余 11 份 fixture | 不用 | 本页不调那些端点 |

**程序化逐字节等价校验**(`.superpowers/sdd/p5c-task-8-fixture-verify.mjs`,治理 §4.4 禁肉眼比):
```
FIXTURE-COPY 块数 = 2(期望 2)
MATCH    parser-control-state.json  bytes=91/91 byteEq=true deepEq=true
MATCH    parser-stats.json  bytes=312/312 byteEq=true deepEq=true
结果:ALL MATCH                                            exit=0
```
**变异验证**(`--mutate`,把抄本里 `"concurrency": 2` 改成 `3`)—— 证明脚本不是空转:
```
*** 变异模式:抄本里 "concurrency": 2 → 3 ***
MISMATCH parser-control-state.json  bytes=91/91 byteEq=false deepEq=false
   抄本: {"paused":true,"concurrency":3,…}
   原文: {"paused":true,"concurrency":2,…}
MATCH    parser-stats.json  …
结果:1 处不符                                              exit=1
```
⚠️ `STATS` 走 `as unknown as ParserStats`:`models[1].dim` 真机是 `null`,而 `ParserModel.dim` 是
`dim?: number`(`knowledgeStore.ts:76`;T5 的 `parserStore.ts:78` 放宽成 `number | null`)。
**fixture 原文优先** —— 不许为了迁就类型改数据(注释已写在抄本块里)。

## 6. §9.2 en 档比对(**本页全部 33 个键 × 全表 1499 键重扫**)

扫法:把 `zh_cn.ts` / `en_us.ts` 解析成键值表,对本页每个键找出**所有 zh 值逐字相同**的其它键,
再看它们的 en 是否不同。实测 **zh 撞车 15 对**,其中 **en 不同 4 对**(其余 11 对 en 也相同 → 零判别力问题):

| # | 本页用的键 | (en / zh) | 撞车的键 | 它的 en | 治理登记 |
|---|---|---|---|---|---|
| ① | `aiKbResume` | Resume / 恢复 | `aiKbRebuild` | **Rebuild** | N21 #1 ✅ |
| ② | `aiKbSetSandboxTitle` | Test Sandbox / 测试沙盒 | `aiKbPrTestLink` | **Test sandbox** | N21 #2 ✅ |
| ③ | `aiKbDeviceAuto` | Auto / 自动 | `aiCfgAutoPlaceholder` | **auto**(小写) | 🔴 **本刀新发现** |
| ④ | `aiKbSwitchFailed` | Switch failed / 切换失败 | `aiCfgToggleFailed` | **Toggle failed** | 🔴 **本刀新发现** |

**四对全部配了 en 档强断言**(正向逐字 + 反向不等于被禁值),且各有 RED 探针(§7 探针 C-①~④,全部精确报红)。
③④ 是治理文件没点名的 —— 与 T7 那轮「自己扫出一对协调者不知道的」同族,**建议协调者补进 N21**。

**A-1(`aiKbDeviceAuto` vs `aiKbOriginAuto`)**:两键 **en 与 zh 双双逐字相同** → 渲染断言零判别力,
守卫落在**源码调用形状**上:`toContain("t('aiKbDeviceAuto')")` + `not.toMatch(/\bt\(\s*['"]aiKbOriginAuto['"]/)`,
且**先 `blankComments()` 剥注释**(治理 §9 第九条:本页文件头就写着「不复用 `aiKbOriginAuto`」,
钉裸标识符会撞注释 → 假报红,T6 栽过)。用例里还顺带断言 `zh.aiKbDeviceAuto === zh.aiKbOriginAuto` 与
en 同款,把「为什么只能靠源码守」实证在断言里。

**其余 11 对 en 也相同的**(`aiResume`/`filesUploadPause`/`aiCfgMemSourceAuto`/`aiSkTagAuto`/`aiKbOriginAuto`/
`filesOpFailed`/`filesShareFailed`/`aiResumed`/`filesUploadPaused`/`appsStatusPaused`/`aiSkPaused`)——
**渲染完全一致,不构成 §9.2 风险**,不需要断言。→ **已比对,余零同族对。**

**本刀零新增 i18n 键**(33 个全部是 T1 已落地的);**零死键**。

## 7. 🔴 RED 探针(**22 条,全部报红后逐字节还原**)

### 探针 A(10 条)—— 缺口 ③′ 中央守卫:**每一个**被扫 `.vue` 在模板最后一行塞裸色
注入方式**行首锚定**(只改「整行恰好是 `</template>`」那一行,治理 §9 第七条),注入后先 `grep -c` 断言落盘=1:
```
RED-OK   components/FolderBrowser.vue   (Tests  1 failed | 43 passed (44))  md5 还原 ✅ 2fd53dfbe5e2f9a268e5525b4b9ab1f6
RED-OK   components/KIcon.vue           (Tests  1 failed | 43 passed (44))  md5 还原 ✅ 09db982fceefb4e735acf879db0f4b2e
RED-OK   parser/ParserStatus.vue        (Tests  1 failed | 43 passed (44))  md5 还原 ✅ 3b745501b4d293f3f0f0a95e8f20036a
RED-OK   parser/ParserTest.vue          (Tests  1 failed | 43 passed (44))  md5 还原 ✅ 15ef96ec88b272ef9e08d03984b5239a
RED-OK   views/DashboardView.vue        (Tests  1 failed | 43 passed (44))  md5 还原 ✅ 20cce6e3e8c22559e2a4ee86968d18d8
RED-OK   views/IndexedFilesView.vue     (Tests  1 failed | 43 passed (44))  md5 还原 ✅ aad1b1315e4345f7e66645dcaed6b06d
RED-OK   views/KnowledgeDeferred.vue    (Tests  1 failed | 43 passed (44))  md5 还原 ✅ 31c1cbcd155a7838a58d9906c55b4fb2
RED-OK   views/KnowledgeLayout.vue      (Tests  1 failed | 43 passed (44))  md5 还原 ✅ 7d138ca6137bc3437726dd90fb5b0f56
RED-OK   views/QueueView.vue            (Tests  1 failed | 43 passed (44))  md5 还原 ✅ ff6bd0da032bf62d888f105decd5f4f3
RED-OK   views/SettingsView.vue         (Tests  1 failed | 43 passed (44))  md5 还原 ✅ 5a007e862337bf5a1f25d2937136da5f
=== 探针 A:RED-OK 10 / 问题 0
```
每条的报红消息都**精确指名文件**(`views/QueueView.vue:模板里有裸 hex 色`)。
其中 5 个文件在治理 §1.1 全期零改动清单里 —— 按 **§1.3** 的三条前提办:md5 逐字节还原 ✅ ·
不在提交里 ✅ · 收尾 `git status` 干净 ✅(见 §9)。

### 探针 B(2 条)—— 证明「贪婪 + 覆盖度自检」**这次改动本身**有判别力
构造缺口 ③′ 描述的那种输入:把 `QueueView.vue` 第一个**嵌套** `</template>`(`:366`)顶到第 0 列,
并在它**之后**塞一个裸色(落盘自查:第 0 列 `</template>` 出现在 `:366` 与 `:586`,裸色命中 1)。
```
B1 现行贪婪(lastIndexOf) → Tests 1 failed | 43 passed (44)
   AssertionError: views/QueueView.vue:模板里有裸 hex 色 …            ← 抓到 ✅
B2 换成非贪婪(indexOf)   → Tests 1 failed | 43 passed (44)
   × views/QueueView.vue —— 贪婪抽取成功 + 覆盖度自检(片段一直延伸到模板最后一行)
   AssertionError: views/QueueView.vue:抽出的模板片段没延伸到最后一行 …  ← 覆盖度自检抓到 ✅
   ⚠️ 而**色断言在 B2 变绿了** —— 这正是缺口 ③′ 的危害:脆弱写法静默少扫一段、三门全绿。
还原:QueueView md5 ff6bd0da… → ff6bd0da…;guard md5 f59fba5d… → f59fba5d…
```
🔴 **探针 B 顺手抓出我自己第一版守卫的假判别力**:第一版覆盖度自检写的是
「`tmpl` 要 `toContain` 模板最后一行 **trim 后的文本**」—— 而最后一行几乎总是 `</div>`,
截断后的片段里到处都是它 → **B2 当时 44/44 全绿**。改成
① `tmpl.endsWith(最后 3 行原文含缩进)` ② `tmpl === 逐行独立推导` 两条,B2 才翻成报红。
(与治理 §9 第七/八/九条同族:**「在文件里找某段文本」的断言必须先证明那段文本是独特的**。)

### 探针 C(10 条)—— `SettingsView.test.ts` 的关键守卫逐条变异
每条:变异产品代码 → 断言落盘 → 跑测试 → 打印失败用例名 → md5 还原(基线 `5a007e862337bf5a1f25d2937136da5f`)。
```
RED-OK ① 恢复按钮键换成被禁的 aiKbRebuild            → × ①正向:en 档恢复按钮逐字 `Resume`…                    (1 failed | 55 passed)
RED-OK ② 沙盒标题键换成 aiKbPrTestLink               → × ②正向:en 档沙盒标题逐字 `Test Sandbox`…               (1 failed | 55 passed)
RED-OK ③ 设备「自动」键换成 aiCfgAutoPlaceholder      → × ③正向:en 档设备第一档逐字 `Auto`…                     (1 failed | 55 passed)
RED-OK ④ setDevice 失败键换成 aiCfgToggleFailed      → × ④正向:en 档 setDevice 失败 toast 逐字 `Switch failed`… (1 failed | 55 passed)
RED-OK ⑤ A-1:换成 aiKbOriginAuto(en/zh 双双同值)   → × 🔴 A-1:模板用 `t('aiKbDeviceAuto')`,零 `t('aiKbOriginAuto')` 调用
                                                       ⚠️ 注意其余 55 条**全绿** —— 实证「渲染断言对 A-1 零判别力」
RED-OK ⑥ K30:togglePause 的 catch 回显 e.message    → × catch① togglePause…  + × 源码侧:四个 catch 一个都不读 `e`  (2 failed)
RED-OK ⑦ togglePause 改回蓝本「await 之后再读」       → × 🔴 恢复 → 「已继续」… + × 🔴 暂停 → 「已暂停」…            (2 failed)
RED-OK ⑧ OCR 去掉 `!!` 双取反                        → × 🔴 `!!` 双取反照抄…                                   (1 failed | 55 passed)
RED-OK ⑨ 设备第二档去掉 `|| device === 'gpu'`         → × 🔴 第二档吃 `cuda` **和** `gpu` 两个值…                 (1 failed | 55 passed)
RED-OK ⑩ deviceLabel 去掉 `(r || '')` 兜底           → × 🔴 分支①边界 —— 后端漏 `resolved_device` 字段时…        (1 failed | 56 passed)
=== 探针 C:RED-OK 10 / 10(md5 全部 ✅ 还原)
```
🔴 **探针 ⑩ 第一版也没判别力**:原本边界用例只喂 `resolved_device: ''`,而 `''.toUpperCase()` 本来就合法
→ 删掉 `(r || '')` 兜底后**全绿**。补了一条「后端**漏字段**」用例(`undefined.toUpperCase()` 会抛)才报红。
两条边界都留着(空串是真实值,缺字段是兜底真正要挡的)。

## 3′. 缺口 ③′ 的落地(交接项 #4)

🔴 **先说一处 brief/治理的事实性错误(E-19)**:治理 §9 缺口表说那条「模板零裸色」守卫在
`knowledgeStyles.test.ts` 里 —— **它不在那儿**。改前实测 `git show HEAD:src/ai/styles/knowledgeStyles.test.ts | grep -c template` = **0**;
那条守卫实际分散在 **5 个 per-view 测试文件**里:
`QueueView.test.ts:894` · `IndexedFilesView.test.ts:833` · `FolderBrowser.test.ts:408` ·
`ParserStatus.test.ts:886` · `ParserTest.test.ts:1355`。
而这 5 个文件(及它们被测的 `.vue`)**全部在治理 §1.1 / 本刀 brief §6 的零改动清单里**。

**处置(不越界、又真的「统一改掉」)**:在 `knowledgeStyles.test.ts` **新建一条中央上位守卫**,
扫 `src/ai/knowledge/**/*.vue` 的**全部 10 个**文件:

1. **贪婪抽取** —— `src.lastIndexOf('\n</template>')`,取**最后一个**第 0 列 `</template>`。
2. **覆盖度自检两条**(见探针 B 的教训,单条 `toContain` 不够):
   ① `tmpl.endsWith(模板最后 3 行原文)` ② `tmpl === 逐行独立推导`(字符串 `lastIndexOf` vs 从末尾扫行,
   **两条独立代码路径**)。
3. **文件清单集合相等** —— `KNOWLEDGE_VUE_FILES`(10 项)必须等于目录实扫结果 → 新增视图不进清单就报红。
4. **色断言** —— 剥 `var()` / `color-mix()`(逐字符配对括号,同 `color-guard` 的 `stripVar` 手法)后
   零 `#hex` / 零 `rgb()|hsl()`。
5. **五个既有 per-view 守卫原样留着**(零改动清单) —— 本条是它们的**上位守卫**:
   即使那 5 条被截断到毫无判别力,本条仍扫全模板。
   🔴 **本刀之后新加视图一律靠本条,不再复制那个脆弱正则** —— `SettingsView.test.ts` 就没有复制它,
   它用的是更严的等价写法:**本文件零 `<style>` 块 → 直接全文件色扫**(是「模板零裸色」的严格超集,
   而且完全不需要 `<template>` 边界锚定 —— 从根上绕开缺口 ③′ 的成因)。
6. `knowledgeStyles.test.ts` **其余一行没动**(`git diff --stat` = `1 file changed, 160 insertions(+)`,**零删除、零修改行**):`WHITELIST_226` / `NON_K_HELPER_CLASSES`(10)/
   「没有搬多」正则 / token 选择器常量 / keyframes 守卫全部原样(`git diff` 只有末尾新增块 + 顶部零改动)。

**实测嵌套 `</template>` 数量**(顺带订正 **E-20**):`QueueView.vue` **12** 个、`IndexedFilesView.vue` **7** 个
—— 治理 §9 缺口表写的「7/12」把两个文件对调了,数字本身对。

## 8. 偏离与「照抄」申报

### 命中的 K 编号

| 编号 | 落地 |
|---|---|
| **K1** | 蓝本 `this.store.state.controlState`(`:215`)→ `store.controlState`(`SettingsView.vue:131`)。本刀范围内的 `.state.` 降层点 **1 处**,它是模板 **12 处** `controlState.xxx` 读取的唯一入口(`paused` ×6 / `concurrency` ×1 / `device` ×3 / `ocr_enabled` ×1 / `resolved_device` ×1,后两处经 `deviceLabel`)。测试**不 mock store、走真 `knowledgeStore` + 真 service mock**,所以漏降一层或字段名错一个字母,对应那格立刻空 → 每条渲染断言都是降层的集成断言。蓝本 `:225` 的 `browserRoots`(第 2 处 `.state.`)归 T9 |
| **K27** | `this.store.actions.setControl(...)` → `store.setControl(...)`(**4 处**);`this.store.actions.toast(...)` → `store.toast(...)`(**8 处** = 4 成功 + 4 catch)。`store.toast` 转调全局 `useToast().show(msg, 2400)`(`knowledgeStore.ts:311-313`),2400ms 与蓝本一致;**不直接用 `useToast()`**,照 `QueueView.vue` 既有写法。有一条用例真的去读全局 toast 栈,证明这条链没断 |
| **K30**(K5 同族) | 四个 catch 蓝本都拼 `': ' + (e.message \|\| e)`(`:287`/`:295`/`:304`/`:313`),本仓只弹固定键 `aiKbOpFailed` ×3 / `aiKbSwitchFailed` ×1。**排除式断言**:让 `parserControl` reject `new Error('PROBE-BACKEND-DETAIL-7c41f9')`,断言 toast 调用参数、全局 toast 栈文本、`w.text()`、`w.html()` 四处都 `not.toContain` 那段文本,且 toast **逐字**等于固定键值。**探针文本只在测试文件里,故意不出现在 `SettingsView.vue` 的注释里**(治理 §9 第九条)。另加一条源码侧断言:剥注释后零 `.message` / `.response` / `.detail`,且四个 catch 都是无参 `catch {` |
| **K34** | 三处机械改写,**零行为变化**:`this.$t(...)` → `t(...)`(`useI18n()`;`<script setup>` 无 `this`)· `this.$router.push(...)` → `router.push(...)`(`useRouter()`)· Options API `computed: {}` → `computed(() => …)`。**保抛口径(T7 评审 M-1)**:本刀**零 `?.`、零 `&&` 守卫、零 `!` 非空断言** —— 一处都不需要,所以不存在「同一文件两套相反判断」的问题。`deviceLabel` 里的 `(r \|\| '')` **是蓝本自己写的**兜底(`resolved_device` 在 `ParserControlState` 里是必填 `string`,不是 TS 逼出来的),照抄不动 |
| **🔴 待追认(建议 K35)** | `togglePause` 的成功 toast 修正,见 §3 |

**未命中**:K21–K26 / K28 / K29 / K31–K33(Parser 两页 / `FolderBrowser` / 弹窗 / `parserStore` 的事)· K2–K20 里本刀不涉及的。
特别地 **K22/K31 不适用** —— 本页在 `KnowledgeLayout` 之下,`.k-scroll` 已有 `overflow-y:auto`,**不挂 `.parser-app`**
(治理 §6.1 落地约束 4),有一条用例专门钉这一点。

### 命中的 N 编号(照抄,一个字没改)

| 编号 | 落地 |
|---|---|
| **N16** | `⏸` / `✅` 在 `t()` **里面**(键值 `aiKbSetSvcPausedLine` = `⏸ Paused` / `⏸ 已暂停`);`🧪`(`:162`)· `⚠️`(`:171`)在 `t()` **外面**。`📝`(`:67`)是笔记区的,归 T9。有一条专门的核对用例(读语言包原值 + 反向断言按钮那两个键零 emoji) |
| **N21 #1** | `aiKbResume` 与既有 `aiKbRebuild` **zh 都是「恢复」**,两键并存不统一 → en 档强断言 |
| **N21 #2** | `aiKbSetSandboxTitle`(`Test Sandbox`)与 `aiKbPrTestLink`(`Test sandbox`)并存 → en 档强断言 |
| **N15 同族** | 并发那三个按钮的文字**就是 `{{ n }}`** —— 档位名 `Power-saving`/`Balanced`/`Full power` 在 **ParserStatus**(蓝本 `:38`),不在本页。用例里有反向断言:整页不出现「省电/平衡/全力」与那三个英文串(防有人把 ParserStatus 的 N17 写法搬过来) |
| **N22 同族** | 裸 `GPU` / `CPU`(`:46-47`)与 `deviceLabel` 的 `'GPU (CUDA)'` / `'CPU'`(`:220-221`)是技术标识符,**不补 i18n 键**;源码断言钉住它们是裸字面量 |
| **P5b E-9** | 六个 `data-on` **逐处照抄 `String()`**(本刀 5 处:并发 1 + 设备 3 + OCR 1;第 6 处是笔记开关 `:115`,归 T9);断言一律 `toBe('true')`/`toBe('false')`,**零 `toBeUndefined()`** |
| **治理 §13** | 危险区按钮硬编码 `disabled` 照抄 → 用例只验「是灰的 + 有『即将上线』徽标 + 点它什么都不发生」 |

### 附录 D §D.3 属性态覆盖自查

| 宿主 | 属性 | 真侧 | 假侧 |
|---|---|---|---|
| `.k-svc-light` | `data-state` | `paused` ✅ | `running` ✅ |
| 并发 3 按钮 | `data-on` | ✅(2/1/4 三种 fixture) | ✅ |
| 设备 3 按钮 | `data-on` | ✅(auto/cuda/**gpu**/cpu/未知 五种) | ✅ |
| `.k-sw`(OCR) | `data-on` | ✅ | ✅ + **缺字段 → `"false"`** |

(`.kn-badge[data-s]` 与 `.fb-crumb[data-last]` 不在本刀范围。)

## 9. 提交自查

- `git status --short` 收尾:仅 `M src/ai/styles/knowledgeStyles.test.ts` · `?? SettingsView.vue` · `?? SettingsView.test.ts`
  (+ `.superpowers/sdd/` 两份台账,`git add -f`)。**22 条探针的所有临时改动全部 md5 逐字节还原,零残留。**
- 零 `git add -A` / `git add .`;零 rebase/reset/stash/merge/push;没跑 `deploy.sh`;没碰 `/var/lib`;
  没碰后端仓;没动 `:5288` 的 dev server;没碰 `NimoOS-New-UI` 与 `.sp7/NimoOS-New-UI`;
  `NimoOS-UI` 只用 `git show main:` 读(零 checkout/stash/commit)。
- **Service 仓零改动** → 没跑跨仓 `pnpm build` / `pnpm install`。

## 10. brief 勘误(接 E-16,本刀核出 **E-17 ~ E-21**)

| # | brief / 治理原文 | 权威源实际 | 处置 |
|---|---|---|---|
| **E-17** | brief §3 与计划书 T8 的区块行号:服务卡 `:7-20` · 并发 `:24-37` · 设备 `:39-52` · OCR `:54-64` · 沙盒 `:161-170` · 危险区 `:173-190` · `goSandbox` `:315-318` | 实测:服务卡 **`:7-19`**(`:20` 是空行)· 并发 **`:23-34`** · 设备 **`:36-49`** · OCR **`:51-60`** · 沙盒 **`:159-166`** · 危险区 **`:169-186`** · `goSandbox` **`:316-319`** | 系统性偏 1–4 行,**内容全对**(每个区块的起止元素都能对上)。按 §2 的最后一句:brief 标「约」的照 brief 无害,但本报告 §2 一律用实测值 |
| **E-18** | 🔴 brief §3.5 列的成功 toast 键:`aiKbConcurrencySet` / `aiKbInferenceDevice` / `aiKbOcrEnabled` / `aiKbOcrDisabled` | 附录 A 的真名是 **`aiKbSetConcurrencySet`**(#58)/ **`aiKbSetDeviceSet`**(#64)/ **`aiKbSetOcrOn`**(#83)/ **`aiKbSetOcrOff`**(#82)。brief 那四个里 **`aiKbInferenceDevice` 真实存在但是行标题**(值「推理设备」,#8)—— 照 brief 抄会让 toast 渲染成没有 `{label}` 的裸标题;另三个全仓不存在(`t()` 会回落成 key 原文) | **照附录 A**(brief 自己也写了「回附录 A 核准」)。这是本刀最容易翻车的一条:`aiKbInferenceDevice` 那个**编译期与运行期都不报错** |
| **E-19** | 治理 §9 缺口表 ③′ + brief §4.3:「`knowledgeStyles.test.ts` 里『模板零裸色』守卫的 `<template>` 提取…」 | 改前 `git show HEAD:src/ai/styles/knowledgeStyles.test.ts \| grep -c template` = **0** —— 那条守卫在 **5 个 per-view 测试文件**里(`QueueView.test.ts:894` / `IndexedFilesView.test.ts:833` / `FolderBrowser.test.ts:408` / `ParserStatus.test.ts:886` / `ParserTest.test.ts:1355`),而这 5 个文件全在零改动清单里 | 见 §3′:在 `knowledgeStyles.test.ts` **新建**中央上位守卫扫全部 10 个 `.vue`,5 条既有守卫原样不动。这样「统一改掉、别再复制」的意图达成,又不越零改动线。**新增视图的清单集合相等断言**替代了「每个视图复制一份」 |
| **E-20** | 治理 §9 缺口表:「`QueueView.vue` / `IndexedFilesView.vue` 各有 **7 / 12** 个嵌套 `<template>`」 | 实测 `QueueView` **12** 个 / `IndexedFilesView` **7** 个(两文件对调) | 数字本身对,结论不变 |
| **E-21** | brief §0:起点 `c22eb37` | HEAD 实测 **`b28d00c`**(= brief 自己那个提交);`git diff --name-only c22eb37..b28d00c -- src/` 为空 | 纯 markdown 差异,三门基线不受影响。协调者派活消息里给的 `b28d00c` 是对的 |

### 10.1 附带发现(不是 brief 的错,一并登记)

- 🔴 **§9.2 的同族对不止治理文件点名的两对** —— 全表重扫另得 **2 对**(`aiKbDeviceAuto`/`aiCfgAutoPlaceholder` ·
  `aiKbSwitchFailed`/`aiCfgToggleFailed`),见 §6。**建议协调者补进 N21**,并把「本页全部键 × 全表重扫」
  写成下游标准动作(T7 与本刀连续两轮各扫出新的)。
- 🔴 **「覆盖度自检」这类断言必须先证明特征串是独特的**(§7 探针 B 的教训):
  拿「模板最后一行 trim 后的文本」当特征串,而它是 `</div>` 这种通用闭合标签 → `toContain` 恒真、零判别力。
  与治理 §9 第七/八/九条同族,**建议补成第十条**。
- **边界用例要挑「兜底真正生效」的输入**(§7 探针 ⑩):`(r || '')` 的兜底对空串**验不到**
  (`''.toUpperCase()` 合法),必须喂**缺字段**。

## 11. `NEEDS_CONTEXT` / 待协调者拍板

1. 🔴 **§3 那条 `togglePause` toast 修正要一个 K 编号(建议 K35)**。已按治理 §2「修 + 三件套」落地并配 RED 探针;
   若协调者判「照抄蓝本」,回退成本 2 行 + 对调两条用例的期望值。
2. **建议把 §6 新发现的 2 对同族补进 N21**(纯登记,代码已按正确键落地)。
3. **建议给 §10.1 第 2 条开一条治理纪律编号**(§9 第十条)。
4. `knowledgeStyles.test.ts` 的中央 ③′ 守卫**只扫 `src/ai/knowledge/**`**;`src/ai/components/**`(Agent/技能/设置三区)
   的模板 `style=` 仍是缺口③ 的盲区(那不是本期范围)。→ **登记,建议转 P5d**。
