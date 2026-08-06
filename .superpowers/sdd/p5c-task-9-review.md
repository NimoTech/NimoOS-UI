# SP8-P5c Task 9 独立评审 —— `SettingsView.vue` 下半(笔记根目录 + reka 迁移弹窗)

**结论:`Ready to merge`(0 Critical / 1 Important / 6 Minor)**

| | |
|---|---|
| 被评审对象 | `440c1bf`,基线 `d438cbf` |
| 评审时 HEAD | `396469c`(协调者在评审期间又推了 `c497b00` 治理订正 + `396469c` T10 任务书;与本刀无关) |
| 治理版本 | `p5c-common-constraints.md`@`c497b00`(含 §1.3.1 / K36 追认 / §12.5 的 E-22·E-23) |
| 评审 `git status` 收尾 | **干净**(New-UI 与 `.sp8/NimoOS-Service` 两仓都干净;13 条探针全部 md5 逐字节还原) |

Important 那一条**不是产品缺陷、不影响合并**,是「一条被 brief 点名要求的用例实际零判别力 +
报告把它挂到了一条无关的探针上」。修法是改用例名 + 补两行报告,不动产品代码。

---

## 0. 我实际做了什么(不采信报告的部分)

| 动作 | 手段 |
|---|---|
| 三门复跑 | `pnpm test` / `pnpm exec vue-tsc --noEmit` / `pnpm build` 各一次,全量落盘 |
| 下半逐行 1:1 | 自写规范化 diff 脚本(i18n 键→en 原串 / K1 / K27 / K34 / K29 reka 逆变换 / K36 as-child)对蓝本逐字节 |
| K36 a11y | 自写临时 vitest 探针渲染真弹窗,读 `role` / `aria-labelledby` / 标题 `id` / 隐藏节点数 / `outerHTML`,用完删除 |
| 双向 en 扫 | 自写 vite SSR 真实模块导入脚本,29 键 × 1503 全表双向重扫 |
| fixture 等价 | 自写校验脚本(不看实现者的 `.mjs`),从 Service **committed src** 逐字读归一函数原文再推导 + 变异验证 |
| RED 探针 | **13 条**,自建跑批(注入落盘自证 → 解析 `Tests` 汇总行 → md5 还原) |
| 缺口猎 | 2 条(mock 字段数 / `normalizeSettings` 跨仓变异) |
| `dist` 污染 | 全目录 md5 快照 → 重建 → `diff -r` + md5 逐文件比对 |

---

## 1. 三门(独立复跑,§1.3.1 口径)

```
$ pnpm test
exit=0
 Test Files  326 passed (326)
      Tests  3514 passed (3514)
   Duration  69.18s

$ pnpm exec vue-tsc --noEmit   → tsc exit=0,日志 0 字节
$ pnpm build                   → build exit=0,✓ built in 12.30s
$ find src -name '*.vue' | wc -l → 179
```

- **与报告逐字吻合**(326 / 3514 / 179 / 三门 0)。
- 🔴 **我这一轮是干净单轮:零红、零复跑。** 报告称首轮只红已登记噪声
  `persist.test.ts > dropPersisted…`(IndexedDB flaky)、复跑全绿 —— 该说法与我的实测**一致**
  (我这轮它没红),属治理 §8 已登记噪声,可信。`AgentComposer.test.ts` 的 vue-i18n teardown 竞态本轮也未出现。
- **算术自核**:`git show d438cbf:…test.ts | grep -c "it("` = **57**;
  `git show 440c1bf:…` = **112** → **+55**;3459 + 55 = **3514** ✅。零新增 `.vue` → `color-guard` 用例数不变。

## 2. 提交范围 / 零改动清单

`git diff --name-only d438cbf..440c1bf` = **恰好 4 个文件**:
`SettingsView.vue` · `SettingsView.test.ts` · `.superpowers/sdd/p5c-task-9-report.md` ·
`.superpowers/sdd/p5c-task-9-fixture-verify.mjs`。

逐个核了 brief §6 + 治理 §1.1 的 23 个受管文件(`knowledge.scss` · `knowledgeStyles.test.ts` ·
`parser-styles.scss` · `parserStyles.test.ts` · 两个 Parser 页及其测试 · `parserStore.ts` ·
`knowledgeStore.ts` · `FolderBrowser.vue` / `folderBrowser.ts` / `FolderBrowser.test.ts` ·
`src/i18n/*` · `knowledgeRoutes.ts` / `deferred.ts` · `KnowledgeLayout.vue` / `DashboardView.vue` /
`KIcon.vue` / `QueueView.vue` / `IndexedFilesView.vue` / `QueueView.test.ts` / `theme.css`)
—— **全部 unchanged**(提交只有 4 文件,其余天然为零)。✅ **零越界。**

## 3. 🔴 下半逐行 1:1 —— 我的独立判断:**逐字节相同**

自写 `oneToOne.py`,回推动作只允许 brief 授权的那几类,输出:

```
① 笔记区模板 (蓝本 :63-118 → 本仓 :505-571)   蓝本 54 行 / 本仓 54 行
  >>> 逐字节相同 ✅
② 迁移弹窗模板 (蓝本 :120-156 → 本仓 :573-620,K29/K36 已逆变换)   蓝本 36 行 / 本仓 36 行
  >>> 逐字节相同 ✅
```

（②的逆变换:`DialogRoot`→`<div v-if="migrating" class="k-modal-bg" @click="closeMigrate">` ·
`DialogPortal`/`DialogOverlay` 两层剥掉 · `DialogContent`→`<div class="k-modal" @click.stop …>` ·
`DialogTitle as-child` 外壳剥掉 · `<input>` 属性顺序回推。**除此之外一个字节都没动就对上了。**)

script 下半逐方法比对(`script1to1.py`,9 个方法/块),差异**全部**落在已申报的机械改写上:

| 方法 | 判定 |
|---|---|
| `data()` 五项 → 5 个 `ref` | K34,零行为变化;`dirProbe` 的联合类型是蓝本 `:208` 注释原文的类型化 |
| `browserRoots` | **`store.wikiCandidates`**(K1 第二处降层)+ computed 单行,余逐字 |
| `created` → `onMounted` | 逐字;`catch (e) {}` → `catch {}`(K30 的「零读 e」,有源码侧断言钉住) |
| `openRootPicker` | **逻辑逐字节相同**(仅 `nextTick` 回调换行);`if (fb) fb.reset()` 那个 `if` 确是蓝本 `:238` 自己的守卫 |
| **`onPick`** | 🔴 **两处过期守卫逐字节照抄,一处不缺**(成功侧 `!==` return / catch 侧 `===` 才置 error) |
| `toggleAutoExtract` | 仅 K30(catch 只弹固定键),余逐字 |
| `closeMigrate` / `doMigrate` | **逐字节相同**(两个 state 都清 · 先关后发) |
| `applyRoot` | 仅 K30 + 载荷换行,余逐字 |

**⚠️ brief 行号(E-17 系统性偏移)**:我一律以蓝本实际为准,已核 brief §3 引的
「`:66-124` / `:126-160` / `:206-211` / `:227-236` / `:238-249` / `:271-281`」对应的真实区间是
`:63-118` / `:120-156` / `:204-212` / `:232-240` / `:241-253` / `:271-281` —— **内容全对,只是边界偏 1–4 行**,
报告已按实际落地,不算缺陷。

## 4. 🔴 K36 的 a11y 契约 —— 独立核准**成立**

自写临时探针渲染真弹窗(不看源码、只读渲染结果),原始输出:

```
### role            = dialog
### aria-labelledby = "reka-dialog-title-v-0"
### .k-modal-title  id = "reka-dialog-title-v-0" tag= DIV text= "迁移笔记文件?"
### aria-describedby= null
### 指向同一元素     = true
### 隐藏节点数       = 0 []
```

- 🔴 **`aria-labelledby` 真的指向那个可见的 `.k-modal-title`**(`host.querySelector('#'+labelledby) === title`
  返回 `true`),不是指向别的节点、也不是空 —— **契约成立。**
- **零额外 DOM 已与蓝本逐节点比过**:`outerHTML` 的元素结构与蓝本 `:122-155` **节点对节点一致**
  (`.k-modal` > `.k-modal-head`(`.k-modal-title` div + `button.k-modal-x`)> `.k-modal-body`
  (`.kn-mig-path` / `ul.kn-mig-req` 3×`li` / `label.kn-checkline`+`input`)> `.k-modal-foot` 2 按钮)。
  reka 只往**已有元素**上加属性(`data-dismissable-layer` / `tabindex="-1"` / `id=""` / `role` /
  `aria-labelledby` / `data-state="open"` / `pointer-events:auto`;`.k-modal-title` 只多一个 `id`),
  **一个新元素都没有**。而两个先例的 `VisuallyHidden > DialogTitle` 会实打实多两个节点。
  → **K36 的落法确实比照抄先例更贴 1:1,协调者的追认站得住。** 顾虑 ② 可关。
- `VisuallyHidden` 确认**未 import**(import 列表只有 5 个 Dialog 原语)。
- 结构与先例逐字同构:`DialogRoot > DialogPortal to=".knowledge-app" defer > DialogOverlay .k-modal-bg
  > DialogContent .k-modal + :aria-describedby="undefined"`,与 `QueueView.vue:560-563` /
  `IndexedFilesView.vue:1135-1141` 一致。`withHost()` 与 `QueueView.test.ts:141-146` **逐字相同**。

## 5. 🔴 我自做的 13 条 RED 探针(全部注入落盘自证 + 解析到 `Tests` 汇总行 + md5 还原)

基线:`SettingsView.test.ts` 单文件 **112 passed (112)**。

| # | 变异 | 结果 | 判定 |
|---|---|---|---|
| **R1** | mock `notes.getSettings` 改成 **snake_case**(`{notes_root, auto_extract}`) | `3 failed / 109` | **RED ✅** —— 层次搞反真的会被抓 |
| **R2** | mock 在 camelCase 之上**多带** `distill_roots` / `distill_daily_cap` / `background_model` | **`112 passed`** | 🔴 **GREEN ❌ 缺口(见 §7)** |
| **R3** | `onPick` **成功分支**守卫整行删掉 | `1 failed / 111` | RED ✅ `交错路径…(成功分支那处守卫)` |
| **R4** | `onPick` **catch 侧**守卫删掉 | `1 failed / 111` | RED ✅ `交错路径 · catch 侧…` |
| **R5** | K30 · `applyRoot` catch 拼回 `e.response.data.detail` | `3 failed / 109` | RED ✅ 源码侧 + 两条排除式断言 |
| **R6** | K30 · `toggleAutoExtract` catch 拼回 `e.message` | `2 failed / 110` | RED ✅ |
| **R7** | 「搬文件」`:disabled` 删掉第二个条件 | `1 failed / 111` | RED ✅ `done + 不可迁移 → 「搬文件」灰` |
| **R8** | `migratable` 判据 `!exists \|\| empty` → `&&` | `20 failed / 92` | RED ✅ 两档 curated 全塌 |
| **R9** | `withHost()` 不把宿主挂进 `body` | `12 failed / 100` | RED ✅ **全部弹窗用例**(证明真依赖宿主) |
| **R10** | **§9.1** `rootPicker` 挪到**真模块级**(另开 `<script>` 块导出共享 `ref`) | `19 failed / 93` | RED ✅ |
| **R10b** | 同上,`-t 两实例交错` 单独跑 | `1 failed \| 111 skipped` | **RED ✅ 精确命中那一条** |
| **R11a** | 往 `src/i18n/*` 注入「zh 撞车 / en 不同」的键 | `× 方向 1(§9.2)` | RED ✅ |
| **R11b** | 注入「en 撞车 / zh 不同」的键 | `2 failed / 110`,含 `× 方向 2(§9.3)` | RED ✅ |
| **R12** | `doMigrate` 顺序反转(先发请求再关弹窗) | `1 failed / 111` | RED ✅ 「先关后发」真被守住 |
| **R13** | 把「9 对撞车确实存在」里 `filesCancel` 换成一个不撞车的键 | `1 failed / 111` | RED ✅ 防空转那条**不是**恒真 |

**探针自身纪律**:R1 一版最初锚点在 Service 仓的 `autoExtract: r.auto_extract !== false,` 上,
`grep -c` 得 **2**(`normalizeSettings` 与 `normalizeNotesSettings` 各一处)→ **脚本自我停机拒绝注入**,
改成整段函数体行首锚定后才落地。这正是治理 §9 第七条要防的事,记在此处备案。

**与报告的 16 条对账**:凡我复现的(P1↔R3 · P2↔R4 · P3↔R5 · P4↔R6 · P5↔R7 · P6↔R8 · P7↔R9 ·
P9↔R12 · P15↔R10)**报红位置与代表红项逐条吻合**;报告的绝对数比我少 1 是因为它跑在
**111 个用例**的基线上(第 112 条是 P10b 自捕后补的那条),内部自洽 ✅。

**§5.2 / §9.1 的交错测试是真交错**:三条都用 `makeDeferred<DirInfo>()` 可控 promise,
**两个请求同时在飞、按相反顺序兑现**,不是顺序 `await`。两实例那条是挂两个组件实例、各自 pick、
交错回、断言两边各自的 `.kn-picked code` 与徽标档位 —— 判别力已由 R10b 精确证明。

## 6. 🔴 双向 en 重扫 —— 我的独立结论与报告**完全一致**

自写 vite SSR **真实模块导入**脚本(不做文本解析),原始输出:

```
en keys = 1503  zh keys = 1503
KEYS scanned = 29
DIR1 zh-collide pairs = 9   → DIR1 FAMILY (zh same, en differ) = 0 []
DIR2 en-collide pairs = 9   → DIR2 FAMILY (en same, zh differ) = 0 []
```

9 对逐条与报告列的**同一个集合**:`aiKbCancel` × {`filesCancel`, `startAppCancel`, `appsCancel`,
`appsSettingsCancel`, `aiCancel`, `aiCfgCancel`} · `aiKbSetChange` × `aiChange` ·
`aiKbOpFailed` × {`filesOpFailed`, `filesShareFailed`} —— **两档都同值 → 本刀余零同族对 ✅**。
键数 **1503** 与治理 §9.3 第 2 条口径一致。

那 3 条常驻断言**都有判别力**(R11a / R11b / R13 三条探针逐条报红,含防空转那条)。
**T8 那四对 en 档断言(N21 #1/#2 + §3.6 两对)一字未动** —— `git diff` 的 `-` 行里没有它们(见 §8)。

## 7. 🔴 缺口猎结果(治理 §9.2 常规动作)—— 猎中 2 条,1 条真、1 条假警报

### 猎中①(真):`NOTES_SETTINGS` 的「只有两个字段」在测试套件里**零常驻守卫**

**探针 R2**:mock 保持 camelCase 但额外带上 HTTP 层那三个字段(`distill_roots` /
`distill_daily_cap` / `background_model`)→ **`112 passed (112)`,全绿逃过所有守卫。**

- **实现者无过错**:治理 §4.1 要求的是「mock 写成两个字段」,他做到了;而且 R1 证明
  **「层次搞反(snake_case)」这一半是有守卫的**。
- **但「不许多带字段」这一半只靠 `p5c-task-9-fixture-verify.mjs` 的深度相等守**,
  那个脚本在 `.superpowers/` 下、**不进三门**、将来合 master 也不会跑。
  → 与治理 §8.3 那条纪律同族(「mock 里的形状与真实契约不符 = 定时炸弹,不让测试变红但会误导下一个读它的人」)。
- **修法一行**,建议随 T10 顺手收(不阻塞合并):
  ```ts
  expect(Object.keys(NOTES_SETTINGS)).toEqual(['notesRoot', 'autoExtract'])
  ```
- 同族已知第 5 次「产品代码对、守卫为零」(前四次:T2b `--x:` 逃逸 · T3 守卫变量作用域 · T6 禁用键复用 · 本条)。

### 猎中②(假警报,反而澄清了一条 Important):`undefined → true` 的归一

跨仓变异探针:把 `NimoOS-Service/src/notes.ts` 的 `normalizeSettings` 改成
`autoExtract: r.auto_extract === true`(整段函数体锚定,命中 1),重建 `dist`:

```
### 1) Service 仓 notes.test.ts:
     × normalizeSettings 的默认值(auto_extract 缺省为 true)
      Tests  1 failed | 19 passed (20)
### 2) New-UI SettingsView.test.ts:
      Tests  112 passed (112)
```

→ **该不变量确实被守住了,守在正确的层**(`NimoOS-Service/src/notes.test.ts:198-203`
断言 `normalizeSettings({}).autoExtract === true`)。**不是缺口。**
但它同时证明了 New-UI 侧那条用例零判别力 —— 见 §9 的 Important-1。
（还原:`git checkout -- src/notes.ts` + 重建 + `diff -r` 全目录 + 54 个文件 md5 逐一比对,**全部一致**。)

## 8. 🔴 E-22 / E-23 —— `-` 行逐个核准:**T8 只动了那 4 处,一处不多**

`git diff d438cbf..440c1bf` 的**全部** `-` 行(我自己抓的原始输出):

**`SettingsView.vue` —— 8 条**:7 条是文件头「T9 将来会做」的注释(落地后已成假话,就地订正),
产品代码**只有 1 行**:`-import { computed } from 'vue'` → 扩成
`import { computed, nextTick, onMounted, ref } from 'vue'`。
🔴 **T8 的 DOM / `controlState` / `deviceLabel` / `togglePause` / `setConcurrency` / `setDevice` /
`toggleOcr` / `goSandbox` 一个字节都没动,其余全是 `+` 行插入。** ✅ 与报告一致。

**`SettingsView.test.ts` —— 11 条**:7 条头注释 + 4 条代码:

| `-` 行 | 触点 | 我的判定 |
|---|---|---|
| `vi.mock(… { service: { ai } })` | ① | 必需:组件下半真调 `notes`/`wiki`/`folder`,不加当场 TypeError |
| `it('源码侧:四个 catch 一个都不读 e …'` | ④ | 用例**名**改了 |
| `// 四个 catch 都是无参 catch {` | ④ | 注释 |
| `expect((code.match(/\}\s*catch\s*\{/g) …).toBe(4)` | ④ | 🔴 **这是唯一一个变了的 `expect` 值**(4→8) |
| `const head = w.find('.k-section .k-section-head')` | ③ | **定位器**,不是断言值;三条 `expect` 的值一字未动 |

- **`mockAllOk()` 是纯插入**(diff 里零 `-` 行涉及它)—— 报告说「+5 行,零改动既有 3 行」✅ 属实。
- **结论:T8 的 57 条用例里,只有触点④ 的一个数字变了。** ✅ E-22 / E-23 的申报**完全属实**。
- 唯一措辞瑕疵:报告说「其余 56 条一字未动」—— 危险区那条用例的**定位器行**其实也换了(值没变),
  §3 表格行 ③ 已如实交代,只是那句汇总把它省了(Minor-3)。

## 9. 缺陷清单

### Critical:0

### Important:1

**I-1 —— 「后端漏 `auto_extract` 字段」那条用例零判别力,且报告把它挂到了一条无关探针上**

- brief §2 明令:「**要有「后端漏字段」的用例**(T8 评审的教训:只喂空串/正常值的边界用例是**假判别力**)」,
  报告 §10 对账表把它列为「✅ 4 条」并把探针栏填成 **P11**。
- 实际:`SettingsView.test.ts:1132` 那条喂的是 `{ notesRoot: '/DATA/Notes', autoExtract: true }`
  —— 🔴 **mock 打在包边界上,`normalizeSettings` 根本不进回路**,所以这条断言与 `:1096`
  那条(`mockAllOk` 也给 `autoExtract: true`)**在实现写错时的红/绿表现完全相同,零新增覆盖**。
  用例名承诺的是「包内 `r.auto_extract !== false` 归一成 true」,它一个字节都没验到。
  用例注释自己写着「这里喂的就是那个归一结果」,是坦白的,但**用例名与报告对账表都在过度声明**。
- 而 **P11 探针验的是模板里的 `String(!!…)`**(`:1121` 那条),与归一函数无关 —— **探针归属填错了**。
- 🔴 **我做了 brief 要求的那条探针**(见 §7 猎中②):`normalizeSettings` 变异 → New-UI 侧 **112/112 全绿**,
  证实零判别力;同时证明该不变量**真的被守住了**,守在 `NimoOS-Service/src/notes.test.ts:198-203`。
- **为什么不是 Critical / 也不必开修复轮**:① 产品代码正确(照抄蓝本默认值 + 走包内归一);
  ② `normalizeSettings` **没有从包 `index.ts` 导出**(我核过:`src/index.ts` 只 re-export
  `isDistillableName` / `DISTILL_EXTS` + 类型),New-UI 侧**根本没法 import 它来断言** ——
  要补就得改 Service 仓,而它是全期零改动。所以**在本仓这条要求在字面上不可满足**,
  brief §3.1 对 §9.1 给过的那条口径(「若判不需要,报告要写明理由 —— 不是「跳过」,是「论证不适用」」)
  才是正解。
- **建议修法(2 分钟,可随 T10 顺手,不阻塞合并)**:把用例名改成「`autoExtract: true` 落地成绿档
  (归一逻辑本身由 `NimoOS-Service/src/notes.test.ts:198-203` 守,mock 在包边界之外)」,
  报告 §10 那行探针栏由 `P11` 改成「不适用 + 引上游守卫」。

### Minor:6

- **M-1 —— 报告 §6 的还原 md5 对 `SettingsView.test.ts` 是陈旧值。**
  报告写 `7b54f9f880b2609ca7ef45bf5695a9f7`,而提交里那个文件实测
  **`81b3b91fbabea2abafe9cee714af0f85`**(`git show 440c1bf:…| md5sum` 与工作树一致)。
  成因是那份快照取在 P10b 自捕、补第 112 条用例**之前**。`.vue` 的
  `58e2cbf1d005af3a19aa89f72224836a` **完全正确**。还原本身没问题(我 13 条探针全部逐字节还原、
  `git status` 干净),但报告里这个数字**评审无法用来核**。→ 下游报告一律在**最终提交后**再取一次 md5。
- **M-2 —— `SettingsView.test.ts:13` 的头注释说 `mockAllOk()` 「+3 行默认值」,实际是 +5 行 mock。**
  报告 §3 表格写的 +5 是对的,是**文件内注释**与报告自相矛盾。
- **M-3 —— 报告 §3 汇总句「其余 56 条一字未动」略过了触点③ 那条用例的定位器行。**
  §3 表格已如实交代,只是汇总句省了;`expect` 值确实只变了一个。
- **M-4 —— 报告 §6 探针表的通过/失败总数内部不自洽。** 多数行(P1/P2/P5/P8/P9/P11–P14)
  是「1 failed / 110」(和 = 111),而 **P10a 写「2 failed / 110」(和 = 112)**、
  P10b 写「1 failed / 111 passed (112)」。基线在补第 112 条前后跨了,表里没标明是哪一轮。
- **M-5 —— 报告 §1.2 的几个 New-UI 区间**尾行号偏 1–5 行**:`onPick` 写 `:312-327`(实际 `312-322`)·
  `openRootPicker` 写 `:292-303`(实际 `292-302`)· `toggleAutoExtract` 写 `:329-338`(实际 `329-337`)。
  **所有单行锚点(`:317` 守卫① / `:320` 守卫② / `:270` browserRoots / `:509` / `:521` / `:524` /
  `:530-532` / `:535` / `:541` / `:545` / `:562` / `:568` / `:576` / `:577` / `:583-585` / `:597` /
  `:600` / `:611-616`)我逐个核过,全部精确。** 声称「行号由脚本重算」时区间尾也该由脚本给。
- **M-6(§7 猎中① 的票)—— `NOTES_SETTINGS` 的「恰好两个字段」零常驻守卫**(探针 R2 全绿),
  建议加一行 `expect(Object.keys(NOTES_SETTINGS)).toEqual(['notesRoot','autoExtract'])`。转 T10 或 P5d。

---

## 10. 各专查项逐条结论

| # | 专查项 | 结论 |
|---|---|---|
| 1 | mock 层次 | ✅ `notes.*` 是 camelCase 且恰好两字段 · `folder.getList` **单层 `{content:[]}`**,与 `FolderBrowser.test.ts:185` **逐字同形状**(我自己 grep 核过全部 8 处 `getList` mock;`:176` 那条三层信封是它刻意的反向判别用例)· `wiki.getCandidates` 数组。反向探针 R1 报红 ✅;R2 见 M-6 |
| 2 | `undefined → true` 用例 | ❌ 见 **I-1**(不变量真的被守住,但守在上游;本仓那条零判别力) |
| 3 | `onPick` 两守卫 + 交错 | ✅ 两处逐字照抄 · 三条交错用例都是**真交错**(可控 promise 反序兑现)· R3/R4 各精确报红 · R10b 独立复现「两实例交错」那条报红 |
| 4 | K29 + 交接项 #3 | ✅ `to=".knowledge-app" defer` · `withHost()` 与先例逐字 · 挂载后 `nextTick()`+`flushPromises()` 再查 `document` · **R9 拿掉宿主 → 12 条弹窗用例全红**(不是碰巧过) |
| 5 | K36 落地 + a11y | ✅ `as-child` 套在蓝本 `.k-modal-title` 上、零 `VisuallyHidden`;**`aria-labelledby` 实测指向同一元素**;`outerHTML` 与蓝本**节点对节点一致、零额外元素**(见 §4) |
| 6 | K30 两处 catch | ✅ 排除式断言查 **5 个面**(toast 参数 / 全局 toast 栈 / `w.text()` / `w.html()` / **`document.body.innerHTML`** —— 最后一个是给 portal 出去的弹窗准备的,思路对)。两个探针串在 `.vue` 全文(含注释)**零出现**(`grep -c` = 0)→ 无 §9 第九条假报红。R5/R6 各报红 ✅ |
| 7 | 「搬文件」两条件三组合 + `migratable` 三组合 | ✅ 四组合(无路径 / done+可迁移 / done+不可迁移 / loading 可点)+ error 档可点;`migratable` 三组合(不存在 / 存在且空 / 存在非空)。R7 / R8 各报红 ✅ |
| 8 | `dirProbe` 四态 | ✅ loading(`:1273`)/ done+migratable(`:1285`+`:1294` 两条来源)/ done+!migratable(`:1302`)/ **error 三档都不出但 `.kn-picked` 仍在**(`:1326`) |
| 9 | `openRootPicker` | ✅ 仅打开时清 `path` + 重置 `dirProbe` + `loadCandidates()`(有 `toHaveBeenCalledWith()` **显式钉零参数**,交接项 #7)+ `fb.reset()`(唯一一条用 stub,且验「收起那次不调」)。**Vue2 既有 spec 两条行为都承接成用例**(`:1206` 再点关闭不抛 / `:1217` 重开清 stale path,连带清徽标)。R? 报告 P12/P13/P14 我未逐条复现,但 1:1 diff 已证逻辑逐字节相同 |
| 10 | `doMigrate` / `closeMigrate` / `applyRoot` / `created` | ✅ 全部与蓝本逐字节相同(`doMigrate` 先关后发 · `closeMigrate` 清两个 state · 两个 `mode` 各有用例 · `created` catch 吞错保默认 + `\|\| '/DATA/Notes'` **两处**兜底都有用例)。R12 证「先关后发」真被守住 |
| 11 | E-22 / E-23 的 `-` 行 | ✅ 见 §8,**T8 只动了那 4 处**;`.vue` 侧产品代码只改 `import` 那一行 |
| 12 | 下半逐行 1:1 | ✅ 见 §3,**模板两段逐字节相同、script 九块差异全在已申报偏离上** |
| 13 | 双向 en 重扫 | ✅ 见 §6,29 键 × 1503 双向各 9 对、**零同族对**;3 条常驻断言全有判别力(R11a/R11b/R13) |
| 14 | fixture | ✅ 我的独立校验 ALL MATCH(①原文层 112/29/2 字节逐字节 · ②降层层从 **committed src** 逐字读归一函数原文再推导 · ③抄本恰好两个 camelCase 字段);变异验证 MISMATCH ✅。`src/` **零运行时读 `.superpowers/`**(只有注释引用) |
| 15 | `dist` 污染 | ✅ **真清干净了,且没有别的残留** —— 全目录 md5 快照(54 文件)→ `pnpm build` 重建 → `diff -r` **DIR IDENTICAL** + md5 逐文件 **全部一致**。`grep -rn pathX dist/` 零命中;`.pnpm` 里消费仓吃的那份是**同 inode 硬链**(`24780363`,nlink=2)→ 修复已传导;`node_modules/.vite/` 零 `pathX`。Service 仓 `git status` **干净**、`git ls-files dist` = **0**(`dist` 在 `.gitignore:2`)、该改动**不在 T9 的提交里**。🔴 **我没用宽松正则**:采用「重建可复现性」作判据(重建结果与现状逐字节相同 ⇒ 现状即 committed src 的产物 ⇒ 不可能有残留),这比任何标记扫描都强,也避开了协调者那次 `PREFIX` 假阳性 |
| 16 | 三门 | ✅ 见 §1,326 / 3514 / 179 / tsc 0 / build 0,算术自核吻合;我这轮**干净单轮零红**,已登记噪声的说法可信 |
| 17 | 提交范围 | ✅ 见 §2,恰好 4 文件,23 个受管文件逐个 unchanged |
| 18 | 三条预期(不报缺陷) | ✅ 全部确认为预期:① 本页未上路由(`deferred.ts` / `knowledgeRoutes.ts` 零改动,T10 才反转)· ② 本机 `/DATA/Notes` = `{exists:true,empty:false}` → 「搬文件」默认灰(测试里 `:1460` 就在验这一档,且打开弹窗的用例一律先换成可迁移目录 —— 治理 §13 的可点性前置确认做到了)· ③ `auto_extract:true` → `.warn` 不渲染(`:1106` 显式断言 false)· ④ `wiki/candidates` = `[]` → 兜底三根(`:1185` 断言 `System (/DATA)` / `/media` / `/mnt`) |

## 11. 与报告不符之处(汇总)

| 报告说 | 我实测 | 处置 |
|---|---|---|
| `SettingsView.test.ts` 还原 md5 `7b54f9f8…` | **`81b3b91f…`** | M-1(陈旧快照;`.vue` 的 md5 正确) |
| 文件内注释:`mockAllOk()` +3 行 | **+5 行 mock**(报告 §3 表格写的 +5 才对) | M-2 |
| 「T8 的 57 条其余 56 条一字未动」 | 触点③ 那条的定位器行也换了(值未变) | M-3(§3 表格已交代) |
| §10 对账表:「后端漏字段归一 true」← 探针 **P11** | P11 验的是模板 `!!`;那条用例对归一**零判别力**(我的跨仓变异探针实证) | **I-1** |
| §6 探针表 P10a「2 failed / 110」 | 与同表其它行的基线不一致(111 vs 112) | M-4 |
| §1.2 `onPick :312-327` 等区间尾 | 实际 `312-322` 等,偏 1–5 行 | M-5 |
| §12 顾虑 ①「只能证明重建后与 committed src 一致,证明不了之前只被改过这一处」 | 🔴 **重建可复现性其实就是那个证明**:重建结果与现状逐字节相同 ⇒ 现状 = committed src 的产物 ⇒ 零残留。顾虑可以直接关掉 | 澄清,非缺陷 |
| §12 顾虑 ②「K36 请评审拍板」 | **拍板:保持现状。** a11y 契约实测成立、零额外 DOM 实测成立,且协调者已追认 K36 | 关闭 |

## 12. 评审收尾

```
$ git -C /home/nimo/NimoTech/.sp8/NimoOS-New-UI status --short     → (空)
$ git -C /home/nimo/NimoTech/.sp8/NimoOS-Service status --short    → (空)
$ md5sum src/ai/knowledge/views/SettingsView.{vue,test.ts} src/i18n/{zh_cn,en_us}.ts
58e2cbf1d005af3a19aa89f72224836a  SettingsView.vue        ← 与提交一致
81b3b91fbabea2abafe9cee714af0f85  SettingsView.test.ts    ← 与提交一致
fe967ac8a4b7e4fa5953f2d46085e102  zh_cn.ts                ← R11a/R11b 后已还原
142b1130dfe72b92107864b099e719eb  en_us.ts                ← 同上
$ Service dist: diff -r 与重建前后 DIR IDENTICAL,54 文件 md5 全一致
$ 临时探针文件 __REVIEW_a11y_probe.test.ts 已 rm;零 *.probebak 残留
```

**总评**:本刀的移植质量是本期最高的一档 —— 下半模板**两段都逐字节对上蓝本**、`onPick` 两处守卫
逐字照抄、三条交错用例是真交错、K30 排除式断言查到 `document.body.innerHTML` 这一层、
K36 的 a11y 与「零额外 DOM」我独立核准都成立、报告自己捕到 P10b 的零判别力并补齐用例
(这正是治理反复要求的自查动作真的在起作用)。唯一的 Important 是一条**在本仓字面不可满足**的
brief 要求被答成了用例而不是「论证不适用」,加上探针归属填错 —— 改用例名 + 两行报告即可,
不动产品代码。**建议 `Ready to merge`,M-1~M-6 与 I-1 的文案修正随 T10 顺手收。**
