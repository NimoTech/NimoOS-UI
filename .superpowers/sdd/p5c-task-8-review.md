# SP8-P5c Task 8 独立评审 —— `SettingsView.vue` 上半 + 缺口 ③′ 中央守卫

**结论:`Ready to merge`**(Critical 0 · Important 0 · Minor 4)
**被评审对象**:`562f397`(5 文件 / 1784 insertions / 零删除),基线 `b28d00c`,治理最新版 `5fa2fbf`
**评审纪律**:全部结论回权威源自核,零采信实现者报告;自做 **11 条** RED 探针,逐条 md5 逐字节还原;
收尾 `git status` **干净**(见 §9)。

---

## 1. 提交范围(§14)—— ✅ 全部干净

`git diff --name-only b28d00c..562f397 -- src/` 只有 **3 个**文件:
`SettingsView.vue` · `SettingsView.test.ts` · `knowledgeStyles.test.ts`(+ `.superpowers/sdd/` 两份台账)。

逐个 `git diff --numstat` 实测 **零改动**(全部返回 0 行):
`knowledge.scss` · `parser-styles.scss` · `parserStyles.test.ts` · `ParserStatus.vue` · `ParserTest.vue` ·
`ParserStatus.test.ts` · `ParserTest.test.ts` · `parserStore.ts` · `knowledgeStore.ts` · `FolderBrowser.vue` ·
`FolderBrowser.test.ts` · `QueueView.test.ts` · `IndexedFilesView.test.ts` · `knowledgeRoutes.ts` ·
`src/i18n/*` · `deferred.ts` / `KnowledgeDeferred.vue`。

🔴 **§1.1 那 5 个 per-view 测试文件确实一行未动** —— `git diff --numstat` 对五个文件合计输出 **0 行**。
`knowledgeStyles.test.ts` 的 diff 是**单一末尾 hunk**(`@@ -745,3 +745,163 @@`),`160 insertions / 0 deletions`
→ `WHITELIST_226`(`:69`)· `NON_K_HELPER_CLASSES`(`:219`)· 「没有搬多」正则 · token 选择器常量 · 既有断言
**一个字节都没动**,实现者的说法成立。

## 2. K35 的落地与范围(本刀最实质一条)—— ✅ bug 是真的,修法严格限定

**① 回源确认 bug 真实存在。** 蓝本 `git show main:…/SettingsView.vue` `:284-285` 逐字为
`await this.store.actions.setControl(this.controlState.paused ? 'resume' : 'pause')` 然后
`toast(this.controlState.paused ? $t('Resumed') : $t('Paused'))`;本仓 `knowledgeStore.ts:424-427` 实测:

```
async function setControl(action: string, extra: Record<string, unknown> = {}): Promise<void> {
  await service.ai.parserControl({ action, ...extra })
  await loadOverview()          ← 刷新 controlState
}
```

→ `await` 返回时 `paused` 已翻转 → **两档 toast 全反**。**协调者的追认成立,这是真用户可见 bug。**

**② 修法范围严格限定** —— 我对模板做了逐字节规范化 diff(§8):文案键 / DOM / class / 图标 / 按钮 /
`setControl` 载荷 / 调用顺序**零变化**;`wasPaused` 只是把判据换成 `await` 之前的快照。
第一行也从 `controlState.value.paused` 换成 `wasPaused` —— 同一 tick 内刚赋值,**行为完全等价**,
且报告 §3「两处都用它」已显式申报,在 K35 授权范围内。探针 1 也实证载荷仍是 `{action:'resume'}` / `{action:'pause'}`。

**③ 三件套齐全**:代码注释(文件头「偏离,§2」整节 `:52-68` + `togglePause` 上方 JSDoc `:149-154`)·
报告 §3 · 治理 `5fa2fbf` 已登记 K35。✅

**④ 我的反向探针(必做项)** —— 见 §7 探针 1:把判据换回 `await` **之后**读 `store.controlState.paused`
→ **精确报红 2 条**(两档各一条),`Received` 显示的正是翻转后的值。**这条修正被牢牢钉住,改回去会被抓。**

## 3. 缺口 ③′ 中央守卫(E-19)—— ✅ 解法比 brief 更好,判别力经我独立复现

- **扫描范围**:`KNOWLEDGE_VUE_FILES` **10 项**,与 `src/ai/knowledge/**` 实扫结果一致(我 `find` 实测 10 个 `.vue`)。
  清单是**集合相等**(`toEqual`)→ **探针 10 实证**:新建一个 `.vue` 立即报红「文件清单集合相等」。✅
- **贪婪** `lastIndexOf('\n</template>')` ✅;**两条**覆盖度自检 ✅
  (① `tmpl.endsWith(尾部 3 行原文)` ② `tmpl === 逐行从末尾独立推导` —— 确实是两条独立代码路径)。
- **探针 A ×3(必做项)**:在 `QueueView.vue` / `IndexedFilesView.vue` / `ParserTest.vue` 的模板**最后一行**
  各塞一个裸色 → **逐个精确指名报红**(`views/QueueView.vue:模板里有裸 hex 色` 等),3 failed / 41 passed。✅
- 🔴 **探针 B(最关键,必做项)**:我独立构造缺口 ③′ 描述的危险输入(把 `QueueView.vue:366` 的嵌套
  `</template>` 顶到第 0 列 + 在其后塞裸色),两侧对比:
  - **现行贪婪** → 色断言报红(抓到)✅
  - **换成非贪婪**(`lastIndexOf` → `indexOf`)→ **色断言变绿(泄漏!)**,
    **只有覆盖度自检报红**:`views/QueueView.vue:抽出的模板片段没延伸到最后一行 —— 被提前截断了`
  → **报告那句「主断言漏扫变绿,只有覆盖度自检报红」我独立复现,逐字成立。** 这是覆盖度自检唯一的判别力证据,它真的存在。
- **§9 第十条(特征串独特性)**:实现者自捕的问题真实 —— 我确认尾部特征串取「最后 3 行含缩进原文」+ `endsWith`
  后不再恒真(探针 B 的 `endsWith` 确实失败了)。
- **实测嵌套 `<template>` 计数**:`QueueView` **12 个开标签**(其中 7 个单行闭合)/ `IndexedFilesView` **7 个**
  → 注释与 E-20 的「12 / 7」**按开标签数是对的**;顺带实测**全部 10 个文件的第 0 列 `</template>` 都恰好 1 个**,
  所以既有非贪婪写法今天确实是「碰巧对的」—— 注释这句判断准确。

## 4. E-18 的后果核准 —— ✅ 33 个键逐个双向核准,全对

我把 `SettingsView.vue` 剥注释后抽出 `t()` 调用,得 **33 个键**,逐个对**附录 A** + **真实语言包模块**双向核准
(不是看键名像不像)。结果:**33/33 与附录 A 的键名、en 值、zh 值全部对上,零错**。要点:

- `aiKbInferenceDevice`(附录 A #8,`Inference device` / 推理设备)落在 **`:247` 的行标题**上 —— 位置正确;
  toast 用的是 **`aiKbSetDeviceSet`**(#64,`Inference device: {label}` / `推理设备:{label}`)。**E-18 的陷阱躲开了。**
- 另三个 toast:`aiKbSetConcurrencySet`(#58)· `aiKbSetOcrOn`(#83)· `aiKbSetOcrOff`(#82)—— 全对。
- 渲染文案与 Vue2 逐字一致:测试里 `toBe('推理设备:自动')` / `toBe('并发改为 4')` / `toBe('OCR 已开启')` 等
  都是钉死确切值的强断言,我复跑全绿。
- `aiKbDeferredTitle`(复用键,`Coming soon` / 即将上线)对应蓝本 `:172` 与 `:177` 两处 —— 与附录 A A.1 一致。

## 5. K30 四个 catch —— ✅ 排除式断言真实存在且有判别力

- 探针文本 `PROBE-BACKEND-DETAIL-7c41f9` 在 `SettingsView.vue` 中 **0 命中**(我 `grep -c` 实测)
  → **没撞注释**,§9 第九条(假报红)已规避。
- 排除式断言四处齐全:toast 调用参数 / 全局 toast 栈 / `w.text()` / `w.html()` 全部 `not.toContain`。
- **我的探针 3(必做项)**:把 `togglePause` 的 catch 改回蓝本的 `+ ': ' + (e.message || e)`
  → **报红 2 条**(行为侧 `catch① togglePause` + 源码侧「四个 catch 一个都不读 `e`」)。✅
- 源码侧断言先 `blankComments()` 再钉 `.message` / `.response` / `.detail` + 四个无参 `catch {` 计数 = 4,写法正确。

## 6. K1 逐处降层 + 其余专查项

- **K1**:我剥注释后实测 `store.state.` = **0 处**、`store.controlState` = **1 处**、
  `controlState.(value.)?xxx` 读取 = **16 处**(模板 12 + `deviceLabel` 2 + `togglePause` 1 + `toggleOcr` 1),
  与文件头申报一致。**反向探针 2**:加回 `store.state.controlState` → `vue-tsc` **TS2551 精确报错在 `:131`**。✅
- **§7 别搬 ParserStatus 的写法**:我剥注释后实测 `Power-saving` / `Balanced` / `Full power` /
  `aiKbPrCcPowerSaving` / `aiKbCcBalanced` / `aiKbPrCcFullPower` / `aiKbCcPowerSaver` / `aiKbCcFullSpeed` /
  `[1,2,4].indexOf` / `indexOf(n)` **全部 0 命中**;并发按钮文字就是 `{{ n }}`。测试还配了整页反向断言。✅ **没搬错。**
- **§8 设备档**:`cuda` **和** `gpu` **各有独立用例**命中第二档 —— **探针 6** 去掉 `|| device === 'gpu'`
  → 精确报红「gpu 也命中」。✅ `deviceLabel` 四分支齐全。
  🔴 **报告称「空串用例是假判别力、补了缺字段用例」—— 我独立核准这条修正成立**:**探针 4** 删掉 `(r || '')`
  → **只有「后端漏字段」那条报红,空串那条依然全绿**(`''.toUpperCase()` 合法)。**修正真的带来了判别力。**
- **§9 OCR**:`String(!!controlState.ocr_enabled)` 的 `!!` 照抄 —— **探针 5** 删掉 `!!` → 精确报红。✅
  `.warn` 行标点位置:蓝本 `:56` 的句号在 `</span>` **外面**,本仓 `:266` 逐字相同,测试用
  `toBe('开启后速度慢 5-10×. 只对扫描 PDF 有用。')` 钉死。✅
  危险区按钮**硬编码 `disabled`** + `.k-set-soon` 徽标 ✅(三条用例含「点它什么都不发生」)。
- **N16 emoji 位置**:实测 `🧪` 在 `:278`、`⚠️` 在 `:287`(均在 `t()` **外面**);
  `⏸` / `✅` **在 `.vue` 里 0 命中** —— 它们在键值 `aiKbSetSvcPausedLine` = `⏸ 已暂停` 内(`t()` **里面**);
  `📝` 0 命中(归 T9)。✅ **一个都没挪。**
- **K34 第四条(能保抛就保抛 + 内部一致)**:剥注释后实测 **`?.` = 0 · `!` 非空断言 = 0 · `&&` 守卫 = 0**;
  3 处 `||` **全是蓝本自带的**(`(r || '')` + 两处 `'cuda' || 'gpu'`)。
  → **不存在 T7 首版那种「同一文件两套相反判断」**,内部完全一致。✅

## 7. 我自做的 RED 探针清单(11 条,全部先断言注入落盘 + md5 还原)

每条都遵守 §9 第七条:**anchor 命中数先 `assert == 1`**,再 `grep -n` 确认落在**真代码行**(非注释),再跑测试。

| # | 探针 | 结果 |
|---|---|---|
| 1 | 🔴 **K35 反向**:判据换回 `await` 之后读 `controlState.value.paused` | **RED 2 条**(恢复/暂停两档各一)✅ |
| 2 | **K1 反向**:加回 `store.state.controlState` | **RED** `vue-tsc` TS2551 @ `:131`,exit=2 ✅ |
| 3 | **K30 反向**:catch 拼回 `e.message` | **RED 2 条**(行为侧 + 源码侧)✅ |
| 4 | 删 `deviceLabel` 的 `(r \|\| '')` 兜底 | **RED 1 条** —— **只有「缺字段」那条**,空串那条全绿 ✅ |
| 5 | 删 OCR 的 `!!` 双取反 | **RED 1 条** ✅ |
| 6 | 删设备第二档的 `\|\| device === 'gpu'` | **RED 1 条** ✅ |
| 7 | **4 个被禁键全部换上**(`aiKbRebuild` / `aiKbPrTestLink` / `aiCfgAutoPlaceholder` / `aiCfgToggleFailed`) | **RED 4 条**,每对各命中自己那条 en 断言;**zh 断言全绿**(实证 §9.2 前提)✅ |
| 8 | 🔴 **③′ 探针 A ×3**:`QueueView` / `IndexedFilesView` / `ParserTest` 模板**最后一行**各塞裸色 | **RED 3 条,逐个精确指名文件** ✅ |
| 9 | 🔴 **③′ 探针 B**:去缩进造危险输入 → 贪婪 vs 非贪婪 | 贪婪 **RED**(抓到);非贪婪 → **色断言变绿(泄漏)、只有覆盖度自检 RED** ✅ **报告结论独立复现** |
| 10 | 缺口猎:新建 `src/ai/knowledge/views/RevTmpProbe.vue` | **RED**「文件清单集合相等」→ 防漂移有效 ✅ |
| 11 | 缺口猎:模板 `style=` 里塞**具名色** `white` / `red` | 🔴 **全绿(282/282)** —— 见 §10 Minor-1 |

**还原证明**:`md5sum -c` 对三份产出文件 + 全部 10 个知识库 `.vue` 逐字节 **OK**;临时 `.vue` 已 `rm`。
`git status --porcelain` **空**。

## 8. 上半逐行 1:1 覆盖度的独立判断 —— ✅ 模板**零 diff**

我自建规范化 diff(照 T6/T7 评审做法,脚本 `/tmp/rev-normdiff.mjs`):
取蓝本 `:2-4` / `:6-19` / `:21-61` / `:158-166` / `:168-186` / `:188-190` 六个区间,
对本仓模板做**授权回推**(`t('aiKbXxx')` → `$t('<en_US.json 原串>')`,en 值取自 `en_us.ts` 实际解析),
再折叠空白 / 归一 ` />`,滤掉注释行:

```
blueprint picked lines: 83   new template lines: 83
===== TEMPLATE NORMALIZED DIFF =====
*** ZERO DIFF ***
```

🔴 **83 行对 83 行,逐字节相同。** 唯一的授权回推就是 i18n 键 → 英文原串;
**K1 / K34 / K35 都不落在模板上**,所以模板侧连回推都不需要。

**script 侧**逐段人工对照(`:215` / `:216-223` / `:282-289` / `:290-297` / `:298-306` / `:307-315` / `:316-319`)
→ 四分支 `deviceLabel`、`(r||'')` 兜底、`setDevice` 的嵌套三元(`auto` 走 i18n / `cpu` 裸 `'CPU'` / 其余裸 `'GPU'`)、
`toggleOcr` 的 `const next` 位置、`goSandbox` 的目标路径**全部 1:1**;
蓝本 `data()` / `created()` / `browserRoots` / `:63-156` **一行未写**(归 T9)——
我剥注释后复核报告 §2.1 那 24 个标识:**全部 0 命中,实现者的自证成立**
(含注释的原文里 `notesSettings` / `rootPicker` 各 1 次,只在文件头说明句里 —— 与报告一致)。

**E-17 已核**:brief 的六个区块行号确实系统性偏 1–4 行(如服务卡 brief `:7-20` vs 实际 `:7-19`,`:20` 是空行),
本评审一律用蓝本实测值。

## 9. 三门(我自己复跑)+ 算术拆账

| 门 | 我的实测 | 报告 | 一致 |
|---|---|---|---|
| `pnpm test` | `Test Files 326 passed (326)` / `Tests 3459 passed (3459)`,exit=0 | 同 | ✅ |
| `pnpm exec vue-tsc --noEmit` | exit=0,**零输出**(日志 0 行) | 同 | ✅ |
| `pnpm build` | exit=0,`✓ built in 12.35s` | `12.70s` | ✅ |

🔴 **零红项、零复跑、干净单轮** —— 两条已知噪声(`persist.test.ts` 的 IndexedDB flaky /
`AgentComposer.test.ts` 的 vue-i18n teardown)**这轮都没出现**,与报告一致。
(方法自查:确认解析到了 `Tests` 汇总行才算有效结果;未使用 vitest 4 不存在的 `--reporter=basic`。)

**算术自己拆账**(不采信报告):
- 文件 **325 → 326**:+1 = `SettingsView.test.ts`(`knowledgeStyles.test.ts` 早已存在)✅
- `SettingsView.test.ts` 用例 = **57**(`grep -cE '^\s*it(\.each)?\('` 实测 57)
- `knowledgeStyles.test.ts`:基线 `git show b28d00c:` 实测 **23** → 现 **44**(两文件合跑 101 - 57 = 44),**+21** ✅
- `color-guard` **+1**:`.vue` 总数 178 → **179**(`git ls-files '*.vue' | wc -l` 实测 **179** = 本期收官值)✅
- **合计 57 + 21 + 1 = 79**;**3380 + 79 = 3459** ✅ **逐项闭合,零缺口。**

## 10. 与报告不符之处 / Minor

**Critical:0 · Important:0 · Minor:4**

**Minor-1(我的缺口猎命中)** —— 中央 ③′ 守卫**不扫具名色**,只扫 `#hex` 与 `rgb()|hsl()`。
探针 11 实测:往 `QueueView.vue` 模板塞 `style="color: white; background: red"` →
**中央守卫 + QueueView 自己的 per-view 守卫 + `color-guard.test.ts` 三方全绿(282/282)**。
而治理 §6 与仓内 `CLAUDE.md` 明确把具名色算进禁令,且 T8 **自己的** `SettingsView.test.ts:828` 就做了具名色扫描
—— 中央守卫比它的本地断言弱了一档,而中央守卫正是「本刀之后新加视图一律靠本条」的指定机制。
🔴 **但三点让它只算 Minor,不构成修复轮**:① **当前零真实违规**(我逐文件扫全部 10 个模板,
唯一命中是 `QueueView.vue:474` 的 `white-space: nowrap` —— **我自己正则的假阳性**,不是颜色);
② `color-guard` 全仓本来就不扫具名色、5 条 per-view 守卫也都不扫 → **是继承缺口,不是 T8 引入的回归**;
③ 🔴 **朴素修法本身有坑**:直接加 `\b(white|black)\b` 会被 `white-space: nowrap` **假报红**
(`-` 是词边界)—— 需要 `(?<!-)\b…\b(?!-)` 或只在属性值里按「属性名是颜色属性」判。
→ **建议随 E-19 已登记的 `src/ai/components/**` 盲区一起转 P5d**,并把这个 `white-space` 陷阱写进票里。

**Minor-2** —— 报告 §6 写「全表 **1499** 键」。我用**真实模块导入** `Object.keys()` 实测
`zh_cn.ts` / `en_us.ts` 各 **1503** 键(文本行锚定正则只能数到 1502)。
→ 报告那个数是文本解析的低估。**结论完全不受影响**:我用真实导入独立重扫,得到的
**zh 撞车 15 对 / en 不同 4 对**与报告**逐字一致**(见 §11),两种方法互证。仅台账数字建议订正。

**Minor-3(§9.2 的扫描方向)** —— 报告只扫了「zh 撞车 → en 是否不同」**一个方向**。
我加扫了**镜像方向**(en 撞车 → zh 是否不同),实测 **1 对**:
`aiKbResume`(zh 恢复)vs `filesUploadResume`(zh **继续**),**en 双双 `Resume`**。
→ 该方向的风险(误用 `filesUploadResume` 则英文档看不出、中文档渲染成「继续」)
**已被既有的 zh 强断言 `toBe('恢复')` 天然挡住**(探针 7 也侧面印证 zh 断言在 en 撞车时是有效的那一半)。
**无需改代码**;建议把「双向扫」补进治理 §9.2 的标准动作描述。

**Minor-4** —— 报告 §5 的 fixture 校验输出写 `bytes=91/91` / `312/312`,是**该脚本自己的**口径;
我另写独立脚本(见 §11)按「值 + 键序 + 逐叶码点」三重比对,同样 **2/2 MATCH**。两者结论一致,仅口径不同,无实质问题。

**关于两条预期(§15)**:① 本页此刻未上路由(`knowledgeRoutes.ts` 零改动、`DEFERRED_TABS` 仍含 `'settings'`)·
② 沙盒入口跳过去是占位页 —— **我确认这两条都是预期,未报成缺陷**。
**T9 边界**:笔记根目录 + 迁移弹窗故意不写,**我未按「设置页没做完」计缺陷**;
且测试的定位小工具 `knobCard = findAll('.k-set-card')[1]` 在 T9 往「运行档卡」与「沙盒入口」之间插入笔记卡后
**仍指运行档卡**(笔记卡在其后),注释里的这条前瞻判断我核过成立。

## 11. 我独立的 en 档重扫 + fixture 校验

**en 档重扫**(真实模块导入 `zh_cn` / `en_us`,非读源码文本;本页 33 键 × 全表 1503 键):

```
KEYS USED (comments blanked): 33
TOTAL zh keys: 1503  en keys: 1503     MISSING from a locale: none
zh COLLISION pairs total=15  en-differ=4  en-same=11
--- zh collide + en DIFFER ---
  aiKbDeviceAuto      [en="Auto"]          VS aiCfgAutoPlaceholder [en="auto"]          zh both="自动"
  aiKbResume          [en="Resume"]        VS aiKbRebuild          [en="Rebuild"]        zh both="恢复"
  aiKbSetSandboxTitle [en="Test Sandbox"]  VS aiKbPrTestLink       [en="Test sandbox"]   zh both="测试沙盒"
  aiKbSwitchFailed    [en="Switch failed"] VS aiCfgToggleFailed    [en="Toggle failed"]  zh both="切换失败"
--- MIRROR (en collide, zh differ) count=1 ---
  aiKbResume [zh="恢复"] VS filesUploadResume [zh="继续"] en both="Resume"
```

**结论**:① 那 **4 对是真的**,与报告逐字一致 ✅;② **没有漏掉第 5 对** ✅
(11 对 en 也相同的与报告列的 11 个键名逐一对上);③ **镜像方向有 1 对**,已被 zh 断言覆盖(Minor-3);
④ **断言有判别力** —— 探针 7 把 4 个键全换成被禁键 → **4 条 en 断言各自精确报红,zh 断言全绿**。
A-1(`aiKbDeviceAuto` vs `aiKbOriginAuto`)两档双双同值,我实测确认渲染断言零判别力,
守卫落在源码 `t()` 调用形状 + 先 `blankComments()` 上,写法正确。

**fixture 独立等价校验 + 变异验证**(我自写脚本 `/tmp/rev-fixture-verify.mjs`,非实现者那份):

```
CLEAN:      parser-control-state.json MATCH (deepEq=true order=true leaves=5)
            parser-stats.json         MATCH (deepEq=true order=true leaves=16)   → 2 MATCH / 0 MISMATCH
MUTATE ctrl: parser-control-state.json MISMATCH  DIFF: value @paused: "true" vs "false"   (stats 仍 MATCH)
MUTATE stats: parser-stats.json        MISMATCH  DIFF: value @queue_depth.pending: "339" vs "340"
```

→ 抄本与 fixture 在**值、键序、逐叶码点**三个维度全等;**变异验证证明我的校验不是空转**,
且只有被变异的那一份报错(定位精确)。`dim: null` 原样保留 + `as unknown as ParserStats` 的取舍正确
(治理 §4.4「fixture 原文优先」)。

**§4.4「`notes-settings.json` 不抄」的判断 —— ✅ 正确**:本刀组件剥注释后
`service.notes` / `notesApi` **0 命中**,笔记那半整个归 T9,用不到就不抄,与治理 §4.4 一致。
mock 层次也对:`service.ai.parserStats` / `parserState` 是 **HTTP 原样 snake_case**(`ai.ts:591/596` 只 `return res.data`),
`parserControl` mock 成 `{}` 与 `parserStore.test.ts` / `knowledgeStore.parser.test.ts` / `ParserStatus.test.ts` 逐字一致。

## 12. 收尾

```
$ git status --porcelain
(空)
$ md5sum -c /tmp/rev-t8-baseline.md5      # 三份产出文件
src/ai/knowledge/views/SettingsView.vue: OK
src/ai/knowledge/views/SettingsView.test.ts: OK
src/ai/styles/knowledgeStyles.test.ts: OK
$ (cd src/ai/knowledge && md5sum -c /tmp/rev-kb-vue.md5)   # 全部 10 个 .vue
→ 零非 OK 行
```

**11 条探针的临时改动全部逐字节还原,零残留,零提交。**
本评审全程只读被评审仓 + `git show main:` 读 `NimoOS-UI`;
未在 `NimoOS-UI` 做任何 checkout / stash / commit;未 `git commit`。
