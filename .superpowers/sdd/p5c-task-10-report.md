# SP8-P5c · Task 10 报告 —— 路由反转 ×3 + 占位摘项 + 收官(本期最后一刀)

**状态**:完成,零 `NEEDS_CONTEXT`。
**起点** `5e33f60`(工作树干净)· **改动恰好 4 个产品/测试文件**,零新增文件、零新增 `.vue`。

---

## 1. 三门(全量,完整落盘,未 `| tail`)

| 门 | 命令 | 结果 |
|---|---|---|
| 测试 | `pnpm test > /tmp/p5c-t10-test.log` | **exit 0** · `Test Files 326 passed (326)` · `Tests 3515 passed (3515)` |
| 类型 | `pnpm exec vue-tsc --noEmit > /tmp/p5c-t10-tsc.log` | **exit 0**(日志 0 行) |
| 构建 | `pnpm build > /tmp/p5c-t10-build.log` | **exit 0** · `✓ built in 12.55s` |

- **干净单轮、零红、零复跑** —— 两条已登记噪声(`persist.test.ts > dropPersisted …` / `AgentComposer.test.ts`
  的 vue-i18n teardown 竞态)**本轮都没出现**。`grep -cE "✕|FAIL"` = **0**。
- 用例数与协调者给的基线**逐字相同**(3515):本刀只**反转既有断言**,未新增 `it`,故用例数不变。
- 关键守卫文件都在本轮清单里并全绿(`vitest list --filesOnly` 实测 326 个文件):
  `src/i18n/parity.test.ts` · `src/i18n/messageSyntax.test.ts` · `src/styles/color-guard.test.ts` ·
  `src/ai/styles/knowledgeStyles.test.ts` · `src/ai/styles/parserStyles.test.ts` ·
  `src/ai/knowledge/knowledgeRoutes.test.ts` · `src/ai/knowledge/deferred.test.ts`。

---

## 2. 三处反转:改前 / 改后

### 2.1 `deferred.ts` —— `DEFERRED_TABS` 摘 `'settings'`(6 → 5)

```diff
   'roots',
   'allowlist',
-  'settings',
 ] as const satisfies readonly KnowledgeTabId[]
```
- 🔴 **`'allowlist'` 留着**(用户 2026-08-03 明示 `AllowlistView` 移出本期,治理 §2.2)。
- 🔴 **`KnowledgeTabId` 类型一个字未动**(仍含 `'settings'`)—— 它是 rail 的 9 项 tab 全集,与「哪些落占位页」是两件事。
- 🔴 **两条 parser 路由不在 `DEFERRED_TABS` 里**(顶层路由,不是 rail tab)→ 这里**无对应项可摘**,已写进文件头注释。

**文件头追加**(承 P5b T5 / P5b T10 两次摘项注释的格式):
```
// 【SP8-P5c Task 10,2026-08-04】'settings' 已迁(SettingsView.vue,T8 上半 + T9
// 下半 + knowledgeRoutes.ts 反转),从这里摘掉 → DEFERRED_TABS 由 6 项变 5 项。
// 🔴 'allowlist' **留着**:上级设计原把 AllowlistView 算在 P5c,用户 2026-08-03
// 明示移出本期(治理 §2.2),本期不做,仍落占位页。
// 🔴 同刀反转的 `/ai/parser` 与 `/ai/parser/test` 是**顶层路由、不是 rail tab**,
// 从来不在 DEFERRED_TABS 里,故这里无对应项可摘(治理 §5.1 / T10 brief §2)。
// K7 占位机制本身不变(承 P4 I2 的教训,见下方 KnowledgeTabId 注释与 deferred.test.ts)。
```

### 2.2 `knowledgeRoutes.ts` —— 三处 `component` 反转

```diff
+import SettingsView from './views/SettingsView.vue'
+import ParserStatus from './parser/ParserStatus.vue'
+import ParserTest from './parser/ParserTest.vue'
@@
-      { path: 'settings', name: 'KnowledgeSettings', component: KnowledgeDeferred },
+      { path: 'settings', name: 'KnowledgeSettings', component: SettingsView },
     ],
   },
-  { path: '/ai/parser', name: 'AIParser', component: KnowledgeDeferred },
-  { path: '/ai/parser/test', name: 'AIParserTest', component: KnowledgeDeferred },
+  { path: '/ai/parser', name: 'AIParser', component: ParserStatus },
+  { path: '/ai/parser/test', name: 'AIParserTest', component: ParserTest },
```
- **行号回源核过**:反转前 `settings` 在 `:59`、`/ai/parser` 在 `:62`、`/ai/parser/test` 在 `:63`
  —— 与 brief §2 的表**逐个对上**(brief 这三个行号 3/3 正确)。
- **import 路径按治理 §5.1**:`SettingsView` 在 `./views/`,`ParserStatus`/`ParserTest` 在 **`./parser/`**;
  沿用本仓既有的**顶部 eager import** 风格(文件头偏离 2 已登记),不改成懒加载。
- **`path` / `name` / 数组顺序 / `KnowledgeDeferred` 的 import 全部未动**(K7 机制保留)。

**文件头追加**(承 T12 / P5b T5 / P5b T10 三次同款先例的格式):见文件 `:39-53`,写清了
① 反转哪三条 ② **这是 `parser-styles.scss` 第一次被入口可达地 import**(E-13 的因果链)
③ **剩下 5 个子路由**仍指 `KnowledgeDeferred`、`allowlist` 是用户明示移出本期而非漏迁。

### 2.3 反转后的路由现状(11 条不变)

| 位置 | component | 备注 |
|---|---|---|
| 父路由 `/ai/knowledge` | `KnowledgeLayout` | R8 已接 |
| `''` / `queue` / `indexed-files` / **`settings`** | `DashboardView` / `QueueView` / `IndexedFilesView` / **`SettingsView`** | 4 个真组件 |
| `search` · `wiki` · `roots` · `allowlist` · `notes` | `KnowledgeDeferred` | **K7 仍活着(5 条)** |
| `/ai/parser` · `/ai/parser/test` | **`ParserStatus` / `ParserTest`** | 顶层路由,**已无占位页残留** |

---

## 3. `knowledgeRoutes.test.ts` 断言反转(**反转,不删**)

照该文件 `:26-63` 的既有模板(P5a T12 / P5b T5 / P5b T10 三次同款先例都在里面):
**改前原文整段留成注释 + 写清为什么反转 + 改后一句话小结**,一条既有断言都没删。

```diff
+  // 【SP8-P5c Task 10,2026-08-04,第四次反转(不是删除)】上面这条断言把 `settings`
+  // 子路由**与两条 parser 路由**都算进「仍是占位页」的 8 条里 —— 本刀一次反转三条:…
+  // 🔴 **本刀之后两条 parser 顶层路由再无占位页残留** → `stillDeferred` 的取数不再
+  // 拼 `knowledgeRoutes[1]/[2]`,改为**只取子路由**,另加两条正向断言分别钉住它们…
+  // 🔴 **K7 占位机制仍被本条用例证明活着**:剩下 **5** 个子路由…仍钉成 KnowledgeDeferred
+  // (承 P4 I2 的教训 —— 清空后要仍有用例证明它有能力,而不是只剩一段没人测的代码)。
+  //
+  // 改前(P5b T10 原文,反转前):
+  //   it('父路由(布局位)是 KnowledgeLayout,"" 是 DashboardView,… 其余 6 个子路由 + 2 条 parser 路由仍是占位页 KnowledgeDeferred', () => {
+  //     …(19 行原文逐字保留,含 `expect(stillDeferred).toHaveLength(8)`)…
+  //   })
-  it('… 其余 6 个子路由 + 2 条 parser 路由仍是占位页 KnowledgeDeferred', () => {
+  it('父路由(布局位)是 KnowledgeLayout,"" / "queue" / "indexed-files" / "settings" 四个子路由与两条 parser 路由都是真组件,其余 5 个子路由仍是占位页 KnowledgeDeferred', () => {
@@ 新增的正向断言(三条)
+    const settingsChild = knowledgeRoutes[0].children!.find((c) => c.path === 'settings')
+    expect(settingsChild?.component).toBe(SettingsView)
+    expect(settingsChild?.component).not.toBe(KnowledgeDeferred)
+
+    expect(knowledgeRoutes[1].component).toBe(ParserStatus)
+    expect(knowledgeRoutes[1].component).not.toBe(KnowledgeDeferred)
+    expect(knowledgeRoutes[2].component).toBe(ParserTest)
+    expect(knowledgeRoutes[2].component).not.toBe(KnowledgeDeferred)
@@ K7 机制钉子(反转,不删)
-    const migrated = ['', 'queue', 'indexed-files']
-    const stillDeferred = [
-      ...knowledgeRoutes[0].children!.filter((c) => !migrated.includes(c.path)).map((c) => c.component),
-      knowledgeRoutes[1].component,
-      knowledgeRoutes[2].component,
-    ]
-    expect(stillDeferred).toHaveLength(8)
+    // K7 机制钉子:剩下 5 个子路由仍必须指向占位页(承 P4 I2)。
+    const migrated = ['', 'queue', 'indexed-files', 'settings']
+    const stillDeferred = knowledgeRoutes[0]
+      .children!.filter((c) => !migrated.includes(c.path))
+      .map((c) => c.component)
+    expect(
+      knowledgeRoutes[0].children!.filter((c) => !migrated.includes(c.path)).map((c) => c.path),
+    ).toEqual(['search', 'wiki', 'roots', 'allowlist', 'notes'])
+    expect(stillDeferred).toHaveLength(5)
     for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
```

### 🔴 「K7 机制仍被用例证明活着」的那条断言(brief §3 的硬要求)

```ts
// K7 机制钉子:剩下 5 个子路由仍必须指向占位页(承 P4 I2)。
const migrated = ['', 'queue', 'indexed-files', 'settings']
const stillDeferred = knowledgeRoutes[0]
  .children!.filter((c) => !migrated.includes(c.path))
  .map((c) => c.component)
expect(
  knowledgeRoutes[0].children!.filter((c) => !migrated.includes(c.path)).map((c) => c.path),
).toEqual(['search', 'wiki', 'roots', 'allowlist', 'notes'])
expect(stillDeferred).toHaveLength(5)
for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
```
**比 P5b 版本多了一条 `path` 集合断言** —— 理由:原版只钉「剩下的都是占位页 + 个数」,
若将来有人**同时**迁一条又漏摘 `migrated`,个数仍可能对得上;钉住**具体是哪 5 条**才没有这个窗口。
**判别力由探针 E 实证**(§5)。

### `deferred.test.ts`(存在,先 grep 确认后改)

同款反转:改前原文留成注释,`toEqual` 由 6 项改 **5 项**(`['allowlist','notes','roots','search','wiki']`),
新增一条 `expect(isDeferred('settings')).toBe(false)`,**既有两条用例(`isDeferred` 对每个已列 tab 返回 true /
判定来源是 `DEFERRED_TABS` 本身)一字未动** —— 后者正是 P4 I2 那条「机制钉子」,收官时仍在。
⚠️ `DEFERRED_TABS[0]` 仍是 `'search'`,那条用例不受摘项影响。

---

## 4. 🔴 构建管线门(E-13,从 T6 挪来)—— 四项**全过**,原始输出

`pnpm build` exit 0。CSS 产物 = `dist/assets/index-CPhsuLE1.css`。

### (1) 两个页面类都命中 ✅
```
$ grep -o "parser-status-page" dist/assets/*.css | head
dist/assets/index-CPhsuLE1.css:parser-status-page      ← ×10(head 截断)
$ grep -o "parser-test-page" dist/assets/*.css | head
dist/assets/index-CPhsuLE1.css:parser-test-page        ← ×10(head 截断)
```
**这是 `parser-styles.scss` 真进构建管线的唯一证据** —— T2b/T6/T7 三刀都达不到(E-13,不是缺陷)。
连带 JS 侧也已进图:`grep -o "ParserStatus\|ParserTest" dist/assets/*.js` → `index-C_oqzC0p.js:ParserStatus` / `:ParserTest`。

### (2) `.parser-app` 结构块 = K22 那三行,零颜色属性、零 `--x:` 声明 ✅
```
$ grep -oE "\.parser-app\{[^}]*\}" dist/assets/*.css | head -3
.parser-app{--bg-app: #1C1C1E; … color-scheme:dark}          ← ⚠️ 见 E-25,这是 K21 的分组选择器
.parser-app{--bg-app: var(--bg); … color-scheme:light}        ← ⚠️ 同上(浅档)
.parser-app{height:100vh;height:100dvh;overflow-y:auto}       ← ★ parser-styles.scss 的那一条
```
**选择器感知的复核**(不是行首 grep,见 E-25):
```
$ grep -oE "[^{}]{0,80}\.parser-app\{" dist/assets/index-CPhsuLE1.css
.knowledge-app,.parser-app{                                            ← knowledge.scss,K21 暗档 token
:root[data-theme=light] .knowledge-app,:root[data-theme=light] .parser-app{  ← K21 浅档 token
.parser-app{                                                           ← parser-styles.scss,唯一「选择器恰为 .parser-app」的规则
```
对**唯一那条**做程序化解析:
```
RULE: .parser-app{height:100vh;height:100dvh;overflow-y:auto}
declarations: ['height:100vh', 'height:100dvh', 'overflow-y:auto']   count: 3
零 --x: 声明 : True
零颜色属性(非 height/overflow-y 的声明): NONE
".parser-app{height" 出现次数: 1
```
→ **K22 三行齐全、零颜色、零 token 声明** ✅;两个带 token 的 `.parser-app` 规则是
**K21 的共享选择器**(`.knowledge-app, .parser-app`)被压缩器保留分组后的形态,**正是治理 §6.1 的设计**,不是违规。

### (3) 🔴 K31 证据:后代选择器命中、复合形式 **0 处** ✅
```
$ grep -c "\.parser-app\.parser-status-page" dist/assets/*.css      → 全部 9 个 css 文件均 0
$ grep -c "\.parser-app\.parser-test-page"   dist/assets/*.css      → 全部 9 个 css 文件均 0
$ grep -c "\.parser-app \.parser-status-page" dist/assets/index-CPhsuLE1.css   → 1(该行含 32 处)
$ grep -c "\.parser-app \.parser-test-page"   dist/assets/index-CPhsuLE1.css   → 1(该行含 53 处)
$ grep -o "\.parser-app \.parser-status-page" … | wc -l → 32
$ grep -o "\.parser-app \.parser-test-page"   … | wc -l → 53
```
(压缩后整个 CSS 是一行,故 `grep -c` 只能给 0/1;occurrence 数用 `grep -o | wc -l`。)
抽样确认两个作用域各自成段、且 **K23 的「`.card` / `.page-header` 两作用域各一份」在产物里成立**:
```
.parser-app .parser-status-page / … .page-header / … .page-header h2 / … .refresh-btn / … .test-link / … .card
.parser-app .parser-test-page   / … .page-header / … .page-header h2 / … .back-link  / … .card / … .help-card p
```

### (4) `SettingsView` 用到的类都在产物里 ✅
`k-set-card` 1 · `k-sw` **4** · `kn-checkline` **2** · `k-modal-head` 1 · `k-set-row-desc` ✓ ·
`k-sandbox-icon` ✓ · `k-svc-light` ✓(`grep -o … | wc -l`)。

---

## 5. RED 探针(**5 条,全部报红并逐字节还原**)

纪律照治理 §9(探针必须先证明注入真的落盘、锚定唯一)与 §1.3(md5 是唯一还原证据)。
**注入脚本一律先 `assert s.count(old)==1`(锚定唯一),再 `grep -n` 证明落盘,最后从
`/tmp/.../scratchpad/t10-backup/` 的副本 `cp` 回来并核 md5。**

基准 md5:`knowledgeRoutes.ts` = `da12cb564be2a5e498f0d58d6b29e6af` · `deferred.ts` = `33acf83a515a8b5d4ca0cf12ea8fb8f6`

| 探针 | 注入 | 落盘证明 | 结果 | 还原 |
|---|---|---|---|---|
| **A** | `settings` 路由改回 `KnowledgeDeferred` | `:75` grep 命中 | `AssertionError: expected { __name: 'KnowledgeDeferred' } to be { __name: 'SettingsView' }` · `Tests 1 failed \| 2 passed` | md5 `da12cb56…` ✅ |
| **B** | `/ai/parser` 改回占位页 | `:78` | `expected { __name: 'KnowledgeDeferred' } to be { __name: 'ParserStatus' }` · 1 failed | ✅ |
| **C** | `/ai/parser/test` 改回占位页 | `:79` | `expected { __name: 'KnowledgeDeferred' } to be { __name: 'ParserTest' }` · 1 failed | ✅ |
| **D** | `DEFERRED_TABS` 塞回 `'settings'` | `:34` | `expected [ 'allowlist','notes','roots', …(3) ] to deeply equal [ 'allowlist','notes','roots', …(2) ]` · 1 failed | md5 `33acf83a…` ✅ |
| **E** | 🔴 **K7 反向探针**:把仍是占位页的 `search` 也换成真组件 | `:68` | `expected { __name: 'SettingsView' } to be { __name: 'KnowledgeDeferred' }` · 1 failed | ✅ |

- **探针 E 是「K7 机制仍被证明活着」的判别力证据**:剩下那 5 条一旦被悄悄换掉,断言立刻报红。
- **A/B/C/D 是 brief §7 要求的两条(反转改回 → 报红;`DEFERRED_TABS` 塞回 → 报红)的完整版**(反转三条各一个探针)。
- 收尾 `git status` **只有本刀那 4 个 `M`**,零残留;两个被注入过的文件 md5 与注入前**逐字节相同**。

### ⚠️ 过程事故与自证(主动申报)

第一轮探针 A 我用了 `git checkout -- <file>` 做还原 —— 它**把文件恢复到 HEAD**,
于是把我尚未提交的 T10 编辑一起抹掉了(治理禁 reset/stash,`checkout -- <path>` 属同族,是我的错)。
**处置**:立刻改用「副本 `cp` 还原」,并把 `knowledgeRoutes.ts` 的两处编辑**重新施加**;
重做后 md5 = `da12cb564be2a5e498f0d58d6b29e6af`,**与被抹掉前那一版逐字节相同**(基准 md5 在事故前已打印在同一份日志里),
证明重做没有引入任何差异。此后**再未使用任何 git 还原命令**。

---

## 6. 收官核对(brief §5,逐项)

### 6.1 三门终值
**326 文件 / 3515 例全绿** · `vue-tsc` **0** · `vite build` **0** · **`.vue` 179**(`git ls-files '*.vue' | wc -l`)。
`color-guard.test.ts` 单跑 **181 例**(= 179 `.vue` + 2 个 `.css`)→ **P5a 起点 175 的 +4 已体现在产物里**。

### 6.2 🔴 `.vue` 台账收官(治理 §8.1)
起点 **175** → T3 `FolderBrowser.vue` **176** → T6 `ParserStatus.vue` **177** → T7 `ParserTest.vue` **178** →
T8 `SettingsView.vue` **179**。**实测 179 ✅ 与台账吻合**(T5 评审 M-4 那个 180 是算错,治理已裁定以台账为准)。
**本刀零新增 `.vue`、零新增文件** → 326 / 179 都不变。

### 6.3 🔴 §1.3.1 环境自查(收官刀的责任)

**(a) `.sp8/NimoOS-Service/dist/` 与 committed `src/` 一致** —— 沿用 T9 的**「重建可复现性」**判据
(不用宽松正则,避开协调者那次 `PREFIX` 假阳性):
```
dist 文件数: 54                       Service 仓 git status: (空)      git ls-files dist: 0
$ pnpm build            → exit 0
$ diff -r <dist-before> dist          → DIR IDENTICAL
$ diff <54 文件 md5 before> <after>   → ALL 54 MD5 IDENTICAL
$ grep -rn "pathX" dist/ | wc -l      → 0        (T9 修掉的那处污染没有复发)
$ 重建后 git status                    → (空)
```
→ **重建结果与现状逐字节相同 ⇒ 现状就是 committed `src/` 的产物 ⇒ 不可能有残留。**
**消费仓吃的是同一 inode**(`24780363`,nlink=2):
`.sp8/NimoOS-Service/dist/wiki.d.ts` 与 `.sp8/NimoOS-New-UI/node_modules/@nimotech/nimoos-service/dist/wiki.d.ts`
inode 相同 → 结论直接传导到消费仓。
⚠️ 这次 `pnpm build` **产物零变化**,因此**没有改动任何东西**(与 T9 那次「修复」不同),备份在
`/tmp/.../scratchpad/dist-before`。

**(b) `node_modules/.vite/deps/` 无陈旧 `nimoos-service` 产物**:
```
$ ls node_modules/.vite            → 只有 vitest/    (deps/ 目录根本不存在)
$ ls node_modules/.vite/deps       → (空/不存在)
$ grep -rl "nimoos-service" node_modules/.vite/  → 零命中
```
根因侧也仍被守住:`vite.config.ts:41-43` 的 `optimizeDeps.exclude: ['@nimotech/nimoos-service']` 在,
`src/viteOptimizeDepsGuard.test.ts` 这轮全绿 → **P5b T11 那个「dev server 喂旧代码」的坑关着**。

### 6.4 全期零改动清单复核(`63a0b0d` → HEAD **+ 工作树**,`git diff --numstat 63a0b0d -- <file>`)

**20 个受管文件逐个 `0 0`(unchanged)**:
`KnowledgeLayout.vue` · `DashboardView.vue` · `KIcon.vue` · `QueueView.vue` · `IndexedFilesView.vue` ·
`QueueView.test.ts` · `IndexedFilesView.test.ts` · `indexedFiles.ts` · `indexedFilesView.ts` · `queueView.ts` ·
`dashboardHelpers.ts` · **`knowledgeStore.ts`** · `agent-styles.scss` · `settings-styles.scss` ·
`skills-styles.scss` · `sk-shared.scss` · `tokens.scss` · `theme.css` · `DashboardView.test.ts` · `KIcon.test.ts`
(P5b §1.1 与 P5c §1.1 两份清单的并集)。
🔴 **`knowledgeStore.ts` 实测 0 改动** —— 治理曾预留「只有 T-settings 那一刀能改、且只许加 `controlState`
相关最小改动」,**实际没用到这个额度**,更干净。

**三处授权例外,逐个核 `-` 行都落在授权范围内**:

| 文件 | numstat | `-` 行核验 |
|---|---|---|
| `knowledgeStore.parser.test.ts` | `17 / 3` | **3 个 `-` 行恰为 §8.3 授权的三行**:`parserDeleteJob.mockResolvedValue({})`(`:85`)· `setControl('set_concurrency', { concurrency: 4 })`(`:149`)· 同款断言(`:150`)。其余 17 行是新增的申报注释 |
| `knowledgeStyles.test.ts` | `267 / 13` | 13 个 `-` 行**全在 §6.4 的 1/2/3/4 四项内**:`DARK_TOKEN_SELECTOR` / `LIGHT_TOKEN_SELECTOR` 两行(§6.4-1,K21)· `nonKClassNames` 的 `knowledge-app` 排除行(§6.4-2)· `WHITELIST_187` → `226` 的常量名/计数/用例名 7 行(§6.4-3)· 「没有搬多」正则那行(§6.4-4)。**中央 ③′ 守卫(E-19)确实是纯新增** |
| `SettingsView.test.ts` | `1945 / 0` | 本期新建文件 → 全期口径是**纯新增**;E-22/E-23 那 4 处是 T9 在 T8 同期内的改动,已由 T9 逐处 `-` 行自证 |

**除这三处之外零改动 ✅** —— 无 Critical。

### 6.5 i18n 收官
**真实模块导入**计数(治理 §9.3-2,不用文本解析):
```
aiKb* : zh_cn 295 / en_us 295   ← = P5a 96 + P5b 100 + P5c 99 ✅   键集逐字一致 ✅
全表  : zh_cn 1503 / en_us 1503 ← 与 T9 评审实测的 1503 吻合
```
**本刀新增 0**:`git diff --numstat HEAD -- src/i18n/` → **零文件改动**。
全期 `src/i18n/` 只有 `zh_cn.ts +126 / en_us.ts +113 / messageSyntax.test.ts +186`,**删除行全为 0**。
`parity.test.ts` / `messageSyntax.test.ts` 本轮**全绿**(在 326 文件的干净单轮里)。
**死键 0 条**(治理 §7 口径;本刀未动任何键与任何调用点)。

---

## 7. 命中的偏离 / 照抄条目

- 🔴 **K7(占位机制)** —— 本刀的主角:**反转 ≠ 删除**。`KnowledgeDeferred` 仍被 **5 个**子路由使用,
  `deferred.ts` 的机制与 `deferred.test.ts` 的两条机制钉子(含 P4 I2 那条「判定来源是 `DEFERRED_TABS` 本身」)
  一字未动,判别力由探针 D/E 实证。
- **K1–K36 其余各条本刀均未新增命中**(不写样式、不取数、不碰 i18n、不动模板)。
  与本刀**结果相关**但由前刀落地的:**K21/K22/K23/K24/K31** —— 它们的产物证据第一次能被观测到,
  §4 已逐条核过(K31 的「复合 0 处」是本刀独有的验证点)。
- **N1–N22**:本刀不触碰任何模板/文案/emoji/技术标识符,**无「顺手修正」的机会,也未做任何改动**。
- **fixture**:本刀零 mock、零 fixture 使用(纯路由装配与断言反转)。

---

## 8. 提交

```
git add src/ai/knowledge/deferred.ts src/ai/knowledge/deferred.test.ts \
        src/ai/knowledge/knowledgeRoutes.ts src/ai/knowledge/knowledgeRoutes.test.ts
git add -f .superpowers/sdd/p5c-task-10-report.md
```
**禁用项全部遵守**:未 `git add -A`/`git add .` · 未 rebase/reset/stash/merge/push ·
未跑 `./scripts/deploy.sh` · 未写 `/var/lib` · 未改任何后端仓(Service 仓那次 `pnpm build` 产物零变化、
`git status` 干净、`dist` 不受 git 跟踪)· 未动 `:5288` 的 dev server ·
未碰 `/home/nimo/NimoTech/NimoOS-New-UI` 与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`。
(唯一的例外是 §5 那次 `git checkout -- <path>` 事故,已申报并自证零后果。)

---

## 9. brief 勘误(新增 **E-25**,上一个是 E-24)

| # | brief 原文 | 权威源实际(T10 实测) | 处置 |
|---|---|---|---|
| **E-25** | 🔴 brief §4 的第 3 条 grep `grep -oE "\.parser-app\{[^}]*\}" dist/assets/*.css \| head -3`,配要求「`.parser-app{...}` 里 K22 那三行在,且**零颜色属性、零 `--x:` 声明**」 | 该 grep **无法区分**两种规则:压缩后 CSS 里「选择器恰为 `.parser-app`」的规则(parser-styles.scss,结构 3 行)与 **K21 的分组选择器** `.knowledge-app,.parser-app{…}` / `:root[data-theme=light] …`(knowledge.scss 的 token 块)。三条命中里**有两条塞满 token 与色值** —— 按 brief 字面读,会得出「K21/K22 被违反」的**假 Critical** | **要求本身成立、结论不变**(K22 三行齐全、零颜色、零 `--x:`),但**判据必须选择器感知**:先用 `grep -oE "[^{}]{0,80}\.parser-app\{"` 看清每条规则的完整选择器,再对「选择器恰为 `.parser-app`」那一条解析声明列表(§4-(2) 已按此做)。**同族**:记忆 `sp9-p6-kvm-create-wrapup` 的「选择器感知解析,非简单行首 grep」;也与治理 §9 那串「在文件里找某段文本」事故同族 —— 这次发生在**读产物**侧 |

**结构性结论**:brief 的行号 3/3 全对(`:59`/`:62`/`:63`),计数(326/179/295/6→5)全对,
唯一的错仍落在**「某个东西会不会出现在产物里、以什么形态出现」**这一类断言上 ——
与 T6 那轮的 E-13、T3 那轮的 E-8 **完全同族**(治理 §12.3 的结构性结论第三次被验证)。

---

## 10. 顾虑 / 交接(**均不阻塞,不自行处置**)

1. **三处注释随本刀过期**(都在「不许碰」的文件里,**我没动**):
   `SettingsView.vue:123-124`「本页此刻未上路由 = 预期 …`DEFERRED_TABS` 含 `'settings'`,**T10 才反转**」·
   `ParserTest.vue:37-38`「本页此刻零生产 import …T10 才反转」· `parserStore.ts:5`「本刀落地时全仓零 import 是预期的」。
   三处都是**带时点的历史陈述**(「此刻」/「本刀落地时」),读起来仍成立;但下期若有人只读注释会被误导。
   → **建议转 P5d 的一行注释债**,或由协调者判「留作历史记录」。
2. **`deferred.ts` 在生产代码里零消费者** —— `isDeferred` / `DEFERRED_TABS` 全仓只被
   `deferred.test.ts` 引用(`KnowledgeDeferred.vue:8` 只是注释提到)。**这是 P5a 起的既有状态、不是本刀造成**,
   且治理明确要求「机制本身保留 + 用例证明它有能力」(P4 I2),用例齐全。
   → 登记为观察项:**P5f 清空 `DEFERRED_TABS` 时要一起决定这个模块的去向**。
3. **本刀不做真机验收** —— 反转完成后 `/ai/knowledge/settings` · `/ai/parser` · `/ai/parser/test` 三屏
   **第一次可达**。dev server(`:5288`)按治理 §1 由**协调者 kill 重起**,我没动它。
   验收清单请照治理 §13 三条(尤其 9 个高危可点性点 + 6 处会写后端的项要写「验完怎么恢复」)。
