# SP8-P5c · Task 10 评审 + **全期终审**

**被评审**:`1847c763`(4 产品/测试文件 + 报告)· 基线 `5e33f60` · 全期起点 `63a0b0d`
**治理版本**:`p5c-common-constraints.md`@`ec289cb`(含 §9.5 与 §12.6/E-25)
**结论**:**Ready to merge** —— Critical **0** · Important **1** · Minor **4**
**评审收尾 `git status` 干净**(工作树零残留;`dist/` 被 `.gitignore:2` 盖住,不计入)

---

## 0. 结论摘要

| 维度 | 结论 |
|---|---|
| 三处反转 | ✅ 全对(含 import 路径、文件头注释格式、`'allowlist'` 留存、`KnowledgeTabId` 未动) |
| K7 机制 | ✅ 活着,且**独立复现**了反向探针(P4) |
| 构建管线门(E-13)四项 | ✅ **四项全过**,用选择器感知判据(E-25 已复现:朴素 grep 确实会得出假 Critical) |
| §1.3.1 环境自查 | ✅ 用**比报告更强**的判据(强制干净 outDir 重建)复核通过 |
| 全期零改动清单 | ✅ 20 项逐个 `0 0`;全期总 diff 24 个文件逐个归因,**除三处授权例外零改动** |
| 收官算术 | ✅ 326 / 3515 / `.vue` 179 / color-guard 181 / `aiKb*` 295 / 新增键 99 / 死键 0 |
| K/N 抽审 | ✅ K21/K22/K23/K31/K35/K36 与 N15/N17/N19/N21/N22/§3.6 各回源核过,**零「顺手修正」** |
| 三屏可达冒烟 | ✅ 三条路由真指真组件,三组件各有 `mount()` 用例(245 例全绿) |

---

## 1. 三门(评审独立复跑,全量、完整落盘)

```
pnpm test                  → exit 0   Test Files  326 passed (326)
                                      Tests       3515 passed (3515)
                                      Duration    68.44s
pnpm exec vue-tsc --noEmit → exit 0   (日志 0 行)
pnpm build                 → exit 0   ✓ built in 12.52s
```
- **干净单轮、零红、零复跑**;两条已登记噪声(`persist.test.ts > dropPersisted …` /
  `AgentComposer.test.ts` vue-i18n teardown)本轮均未出现。
- 🔴 **`Tests` 汇总行已成功解析**(治理「工具会造假红」的有效性前提满足)。
- 与报告的 326 / 3515 **逐字相同**。
- CSS 产物哈希 `dist/assets/index-CPhsuLE1.css` **与报告同一个哈希** → 构建可复现。

---

## 2. 本刀专查 ①:三处反转

| 核什么 | 权威源实测 | 结论 |
|---|---|---|
| `deferred.ts` 摘 `'settings'` | `DEFERRED_TABS` = `['search','wiki','notes','roots','allowlist']` = **5 项** | ✅ |
| 🔴 `'allowlist'` 仍在 | 在,且**探针 P6 证明它被守住**(摘掉即报红) | ✅ |
| 🔴 `KnowledgeTabId` 类型未动 | `:17-26` 仍 **9 项含 `'settings'`**;diff 里该 union **零改动**(只在其上方加注释) | ✅ |
| `settings` → `SettingsView` | `:75` `component: SettingsView` | ✅ |
| `/ai/parser` → `ParserStatus` | `:78` | ✅ |
| `/ai/parser/test` → `ParserTest` | `:79` | ✅ |
| 🔴 import 路径 | `./views/SettingsView.vue` · **`./parser/ParserStatus.vue`** · **`./parser/ParserTest.vue`** —— 三个文件 `ls` 实测都在那个路径上,与治理 §5.1 逐字一致 | ✅ |
| `path` / `name` / 数组顺序 / `KnowledgeDeferred` import | 全未动(`:13-28` 两条既有断言仍绿) | ✅ |
| 文件头注释格式 | `knowledgeRoutes.ts` 序列 = R8 → T12 → P5b T5「再次」→ P5b T10「第三次」→ **P5c T10「第四次」**;`deferred.test.ts` 序列 = P5b T5 → P5b T10「再次」→ **P5c T10「第三次」**。**两处序数各自内部自洽,格式照前三次先例** | ✅ |

**brief 行号 `:59`/`:62`/`:63` 复核**:反转前坐标确实如此(diff 的 `-` 行位置吻合)→ brief 这三个 **3/3 正确**。

---

## 3. 本刀专查 ②:K7 机制 + 🔴 **反向探针独立复现**

`knowledgeRoutes.test.ts:190-199` 的钉子(评审逐行读源,不采信报告引文):

```ts
const migrated = ['', 'queue', 'indexed-files', 'settings']
const stillDeferred = knowledgeRoutes[0].children!
  .filter((c) => !migrated.includes(c.path)).map((c) => c.component)
expect(knowledgeRoutes[0].children!.filter((c) => !migrated.includes(c.path)).map((c) => c.path))
  .toEqual(['search', 'wiki', 'roots', 'allowlist', 'notes'])
expect(stillDeferred).toHaveLength(5)
for (const c of stillDeferred) expect(c).toBe(KnowledgeDeferred)
```

- **是反转不是删**:改前 19 行原文整段留成注释(`:143-168`),一条既有断言未删 ✅
- **仍有断言证明剩下 5 个子路由指 `KnowledgeDeferred`** ✅,且**多一条 `path` 集合断言**(比 P5b 版更强,堵住「同时迁一条又漏摘 `migrated`」的窗口)
- 🔴 **探针 P4(K7 反向)独立复现成功**:把仍占位的 `search` 换成真组件 →
  `AssertionError: expected { __name: 'SettingsView' } to be { __name: 'KnowledgeDeferred' }` ·
  `Tests 1 failed | 5 passed (6)` → **报红**。**这是「机制真被守住」的唯一证据,已由评审自己拿到,不依赖报告。**
- `deferred.test.ts` 侧:两条既有机制钉子(`isDeferred` 对每个已列 tab 返回 true / 判定来源是
  `DEFERRED_TABS` 本身,即 P4 I2 那条)**一字未动** ✅,新增 `expect(isDeferred('settings')).toBe(false)`。

---

## 4. 🔴 评审自做的 RED 探针(**6 条,全部报红并逐字节还原**)

**手法严格照 §9.5**:先存副本 → 注入 → `grep -n` 自证落盘 → **用副本 `cp` 覆盖回来** → md5 比对。
**全程零 `git checkout --` / 零 `git restore` / 零 `git stash`。**
注入锚定用**保行版剥注释**(`//` 后置空、保留换行)后再 `count()==1` 断言,防「注入撞注释」(§9 第七条)。

基准 md5:`knowledgeRoutes.ts` = `da12cb564be2a5e498f0d58d6b29e6af` ·
`deferred.ts` = `33acf83a515a8b5d4ca0cf12ea8fb8f6`
🔴 **这两个值与报告 §5 贴的**逐字相同** → 顺带独立证实了报告那次 `git checkout` 事故后的重做是零差异的。**

| 探针 | 注入 | 落盘自证 | 结果(`Tests` 汇总行) | 还原 |
|---|---|---|---|---|
| **P1** | `settings` → `KnowledgeDeferred` | `:75` grep 命中 | `1 failed \| 5 passed (6)`;`expected {KnowledgeDeferred} to be {SettingsView}` | md5 一致 ✅ |
| **P2** | `/ai/parser` → 占位页 | `:78` | `1 failed \| 5 passed`;`… to be {ParserStatus}` | ✅ |
| **P3** | `/ai/parser/test` → 占位页 | `:79` | `1 failed \| 5 passed`;`… to be {ParserTest}` | ✅ |
| **P4** 🔴 | **K7 反向**:`search` → 真组件 | `:68` | `1 failed \| 5 passed`;`expected {SettingsView} to be {KnowledgeDeferred}` | ✅ |
| **P5** | `DEFERRED_TABS` 塞回 `'settings'` | `:33` | `1 failed \| 5 passed`;`[…(3)] to deeply equal […(2)]` | ✅ |
| **P6** 🔴 | `DEFERRED_TABS` **摘掉 `'allowlist'`** | `:33` | `1 failed \| 5 passed`;`['notes','roots','search','wiki'] to deeply equal [...]` | ✅ |

基线对照:未注入时同两文件 = `Test Files 2 passed` / `Tests 6 passed (6)`。
**6/6 报红,零「假 GREEN」;收尾两文件 md5 与注入前逐字节相同。**

> P6 是评审新增的:治理只要求守「`'settings'` 被摘」,没要求守「`'allowlist'` 仍在」。
> 实测**已被既有集合相等断言天然守住**,无需补码 —— 记录为「已有判别力」的正面结论。

---

## 5. 🔴 构建管线门(E-13)—— 四项独立复核,**选择器感知判据**

**先验证判据本身能区分该区分的东西**(§12.6/E-25 的纪律):把压缩 CSS 用括号配平切成
2851 条「选择器 → 声明列表」,再按**选择器精确相等**取块,而不是子串。

### (1) 两个页面类都在产物里 ✅
```
'parser-status-page' 出现 32 次      'parser-test-page' 出现 53 次
```
→ `parser-styles.scss` **第一次真进构建管线**(E-13 的因果链闭合;T2b/T6/T7 达不到不是缺陷)。

### (2) `.parser-app` **自己那个块** = K22 三行,零颜色、零 `--x:` ✅
「选择器**恰为** `.parser-app`」的规则:**全 CSS 仅 1 条**。
```
.parser-app { height:100vh ; height:100dvh ; overflow-y:auto }
声明数 3 · K22 三行齐全 True · --x: 声明 [] · 颜色属性 [] · 色字面量 []
```
🔴 **E-25 已由评审独立复现**:提到 `.parser-app` 的规则共 **88 个不同选择器**,其中
```
.knowledge-app,.parser-app{ …几十个 --x: token… }                          ← K21 暗档
:root[data-theme=light] .knowledge-app,:root[data-theme=light] .parser-app{ … } ← K21 浅档
.parser-app{ …K22 三行… }                                                   ← parser-styles.scss
```
brief §4 那条 `grep -oE "\.parser-app\{[^}]*\}"` 会**同时命中前两条** → 按字面读得出
「`.parser-app` 里有几十个 `--x:`」的**假 Critical**。**判据必须选择器感知,报告的处置正确。**

### (3) 🔴 K31 证据:后代命中、复合 **0 处** ✅
按「同一 compound selector sequence 内是否同时含两个类」判定(不是子串):

| 页 | COMPOUND `.parser-app.parser-x-page` | DESCENDANT `.parser-app .parser-x-page` |
|---|---|---|
| `parser-status-page` | **0** | **32** |
| `parser-test-page` | **0** | **53** |

裸子串交叉验证同结论(`0 / 32`、`0 / 53`)。**与报告的 32 / 53 逐字相同。**
源码侧同证:`parser-styles.scss` 第 0 列选择器**恰好 3 个** ——
`.parser-app {`(`:68`)· `.parser-app .parser-status-page {`(`:75`)· `.parser-app .parser-test-page {`(`:162`),零顶层裸选择器。

### (4) `SettingsView` 用到的类都在产物里 ✅
`.k-set-card` 1 条规则 · `.k-sw` 4 条 · `.kn-checkline` 2 条 · `.k-modal-head` 1 条
(选择器感知计数;`k-modal-head` 裸子串 2 次,报告未说明第二次来源 → Minor-3,不影响达标)。

---

## 6. 🔴 §1.3.1 环境自查 —— 独立复核(判据比报告更强)

### (a) `.sp8/NimoOS-Service/dist/`
```
git status(Service 仓)      → 空          git ls-files dist → 0        dist 文件数 → 54
备份 → pnpm build → diff -r  → DIR IDENTICAL
54 文件 md5 before/after     → ALL 54 MD5 IDENTICAL
grep -rn "pathX" dist/       → 0          (T9 修的那处污染没有复发)
```
🔴 **评审加做了报告没做的一步 —— 排除「增量编译跳过写盘」这个反例**:
`tsconfig.json` **无 `incremental`**、全仓**零 `*.tsbuildinfo`**,再做
```
pnpm exec tsc -p tsconfig.json --outDir <全新空目录>   → exit 0,54 文件
diff -r <全新空目录> dist                              → FRESH DIR IDENTICAL TO SHIPPED dist
```
→ **`dist/` 确定是 committed `src/` 的产物**,不是「因为 tsc 没写盘所以看起来一样」。
消费仓传导:`dist/wiki.d.ts` 与 `NimoOS-New-UI/node_modules/@nimotech/nimoos-service/dist/wiki.d.ts`
**inode `24780363`、nlink 2(硬链)** → 同一个文件,结论直接传导。
🔴 **`git status` 全程未被当作任何还原证据。**

### (b) `node_modules/.vite/deps/`
```
node_modules/.vite/          → 只有 vitest/
node_modules/.vite/deps/     → 目录不存在
.vite 下唯一文件             → vitest/…/results.json(29840 B),精确扫「nimoos-service」 → NO HIT
```
根因侧仍关着:`vite.config.ts:41-43` 的 `optimizeDeps.exclude: ['@nimotech/nimoos-service']` 在,
`src/viteOptimizeDepsGuard.test.ts` 在 326 文件那轮里全绿。
**扫残留用的是精确串 + 文件枚举,不是宽松正则**(避开协调者那次 `PREFIX` 假阳性)。

---

## 7. 🔴 全期零改动清单 —— `numstat` 逐个(`63a0b0d` → HEAD **含工作树**)

**20 个受管文件逐个 `0 0`**(P5b §1.1 ∪ P5c §1.1):
`KnowledgeLayout.vue` · `DashboardView.vue` · `KIcon.vue` · `QueueView.vue` · `IndexedFilesView.vue` ·
`QueueView.test.ts` · `IndexedFilesView.test.ts` · `DashboardView.test.ts` · `KIcon.test.ts` ·
`indexedFiles.ts` · `indexedFilesView.ts` · `queueView.ts` · `dashboardHelpers.ts` ·
**`knowledgeStore.ts`** · `agent-styles.scss` · `settings-styles.scss` · `skills-styles.scss` ·
`sk-shared.scss` · `tokens.scss` · `theme.css`
🔴 `knowledgeStore.ts` **实测 0** —— 治理预留的「T-settings 可加 `controlState` 最小改动」额度**没用到**。

**更强的一步:不靠清单,把全期总 diff 逐个文件归因**(`git diff --numstat 63a0b0d -- . ':!.superpowers'` = **24 个文件**):

| 类别 | 个数 | 明细 |
|---|---|---|
| 纯新增(删除行 = 0)| **14** | 4 个 `.vue`(FolderBrowser/ParserStatus/ParserTest/SettingsView)· `parserStore.ts` · `folderBrowser.ts` · `parser-styles.scss` · 7 个测试文件 |
| 纯新增(i18n)| **3** | `zh_cn.ts +126/-0` · `en_us.ts +113/-0` · `messageSyntax.test.ts +186/-0` |
| 本刀(T10)| **4** | `deferred.ts 7/1` · `deferred.test.ts 20/2` · `knowledgeRoutes.ts 19/3` · `knowledgeRoutes.test.ts 67/11` |
| 治理授权例外 | **3** | 见下 |

**三处授权例外,`-` 行逐行核过:**

| 文件 | numstat | 核验 |
|---|---|---|
| `knowledgeStore.parser.test.ts` | `17 / 3` | 🔴 **恰 3 个 `-` 行,逐字落在 §8.3 授权的三行上**:`parserDeleteJob.mockResolvedValue({})` → `('')` · `setControl('set_concurrency', { concurrency: 4 })` → `{ n: 4 }` · 同款断言。17 个 `+` 行全是申报注释 ✅ |
| `knowledgeStyles.test.ts` | `267 / 13` | 13 个 `-` 行**全在 §6.4 的 1/2/3/4 内**:`DARK_/LIGHT_TOKEN_SELECTOR` 2 行 · `nonKClassNames` 排除行 1 行 · `WHITELIST_187`→`226` 的常量名/计数/用例名 7 行 · 「没有搬多」正则 1 行 · describe 名 1 行 · Set 去重断言 1 行。**中央 ③′ 守卫确实是纯新增**(E-19)✅ |
| `SettingsView.test.ts` | `1945 / 0` | 全期口径**纯新增**;E-22/E-23 那 4 处是 T9 在 T8 同期内改的,已由 T9 逐处 `-` 行自证 ✅ |

**另一个非零改动**:`knowledge.scss` `374 / 6` —— 该文件**不在**零改动清单里(§1.1 明写「本期必须改」)。
6 个 `-` 行核过:**2 行是 K21 的 token 选择器**(§6.4-1 授权),**4 行是「K17 留 P5c」的陈旧头注释**
(`:9` 与 `:301-303`)—— 本期 K17 已兑现,那 4 行若留着就是**主动错误信息**,改成「已由 P5c-T2a 段兑现」是正确处置。
**token 块内容零字节改动**已由 §6.1 落地约束 3 的守卫(`declBlockRange` 行首锚定)+ 本轮 P1-P6 之外的全量测试保证。

🔴 **除上述之外零改动 → 无 Critical。**

---

## 8. 🔴 收官算术(评审自跑核终值)

| 项 | 治理/brief 口径 | 评审实测 | |
|---|---|---|---|
| 测试文件数 | **326** | `326 passed (326)`;`git ls-files` 计 `*.{test,spec}.*` = **326** | ✅ |
| 用例数 | 实测终值 | **3515 passed (3515)** | ✅ |
| `.vue` | **179** | `git ls-files '*.vue'` = **179**;`find src -name '*.vue'` = **179** | ✅ |
| `.vue` 台账 | 175 → 176(T3)→ 177(T6)→ 178(T7)→ **179**(T8) | 与实测吻合;T5 评审那个「180」是算错,治理已裁定 | ✅ |
| `color-guard` **+4** | 起点 177(175 `.vue` + 2 `.css`)→ **181** | 单跑 `color-guard.test.ts` = **`Tests 181 passed (181)`** = 179 + 2 ✅ | ✅ |
| `aiKb*` **295** | P5a 96 + P5b 100 + P5c 99 | 🔴 **真实模块导入**计(§9.3-2,非文本解析):`zhAiKb 295 / enAiKb 295` | ✅ |
| 全表键数 | ~1503 | `zhTotal 1503 / enTotal 1503`,**键集逐字相等 True** | ✅ |
| 本期新增键 | **99** | 全期 diff 只数真键行:zh **99** / en **99**,**两侧新增键集逐字一致** | ✅ |
| 死键 | **0** | 99 个新键逐个在产品代码(排除 `src/i18n/` 与 `*.test.ts`)找调用点 → **死键 0** | ✅ |
| `exactly 99 keys` 守卫 | 在 | `messageSyntax.test.ts:502` `covers exactly the 99 keys this task added` | ✅ |
| tsc / build | 0 / 0 | exit 0 / exit 0 | ✅ |

---

## 9. 🔴 K1–K36 抽审(6 条,含指定的 K21/K22/K23/K31/K35/K36)

| # | 申报内容 | 回源核验 | 判定 |
|---|---|---|---|
| **K21** | 只把 `knowledge.scss` 两个 token 块的选择器各扩一项 `.parser-app`,**零 token 复制**,且**写在一行** | `:130` = `.knowledge-app, .parser-app {`;`:249` = `:root[data-theme="light"] .knowledge-app, :root[data-theme="light"] .parser-app {` —— 各**一行**,与守卫常量 `knowledgeStyles.test.ts:312-313` 逐字对上。`parser-styles.scss` 全文 **`--x:` 声明 = 0** → 零复制成立 | ✅ **只做了申报的** |
| **K22** | `.parser-app` 只带 `height:100vh` / `height:100dvh` / `overflow-y:auto` | 源码 `:68-72` **恰这三行**;产物侧「选择器恰为 `.parser-app`」的唯一规则声明数 **3**、零颜色、零 `--x:` | ✅ |
| **K23** | 两页各自作用域,`.card`/`.page-header` **各写一份不合并** | 按嵌套块解析:status 域 `.card` 1 / `.page-header` 1;test 域 `.card` 1 / `.page-header` 1。且 `h3`(1 vs 2)、`li`(1 vs 0)、`.hint`(0 vs 2)**两域确实不同** → 没有被「顺手统一」 | ✅ |
| **K31** | 复合 → 后代,页面根类挪到内层 | 源码第 0 列三个选择器全是后代式;产物复合 **0 / 0**、后代 **32 / 53**;`ParserStatus.test.ts:248-262` 另有「根元素只有 `.parser-app`」「`.parser-status-page` 是直接子元素、两者各恰一个」两条 DOM 断言 | ✅ |
| **K35** | `togglePause` 用 `await` **之前**的 `wasPaused` 快照;**文案键 / DOM / 按钮 / 调用顺序全不动** | `SettingsView.vue:387-390`:`const wasPaused = controlState.value.paused` → `setControl(wasPaused ? 'resume' : 'pause')` → `toast(wasPaused ? t('aiKbResumed') : t('aiKbPaused'))`。范围确实只有判据换成快照;`SettingsView.test.ts:548-559` 有专用用例并写明「换回蓝本写法即报红」的判据 | ✅ **范围未越界** |
| **K36** | `DialogTitle as-child` 套在蓝本自己的 `.k-modal-title` 上,**不加** `VisuallyHidden` | `:583-585` = `<DialogTitle as-child><div class="k-modal-title">…</div></DialogTitle>`;全文**零 `VisuallyHidden`** → DOM 不比蓝本多节点 ✅。⚠️ **但 a11y 契约(`aria-labelledby` 真指向那个可见标题)只有 T9 报告里那次一次性实测,`SettingsView.test.ts` 里零常驻断言** → **Minor-1** | ✅(带 Minor) |

**结论:抽审 6 条,申报的偏离都只做了申报的那些,零范围外改动。**

---

## 10. 🔴 N1–N22 + §3.6 抽审(6 条,含指定的 N15/N17/N19/N21/N22)

| # | 该照抄的 | 回源核验 | 判定 |
|---|---|---|---|
| **N15** | `.k-progress-card/-row/-label/-nums/-bar/-fill` **不搬** | 全仓 `src/ai/styles/*.scss` 里 6 个类的**真选择器 0 处**;`.k-progress-card` 仅出现在 `knowledge.scss:61` 与 `:896` **两条注释**(都写明「N15 显式不搬」)。「没有搬多」守卫剥注释后扫不到它们 | ✅ **不搬 ≠ 忘搬**,登记齐全 |
| **N17** | 数组下标取 i18n,**照抄写法**,不许改 computed 表 | New-UI `ParserStatus.vue:239` = `{{ [t('aiKbPrCcPowerSaving'), t('aiKbCcBalanced'), t('aiKbPrCcFullPower')][[1,2,4].indexOf(n)] }} ({{ n }})`;Vue2 `:38` = `{{ [$t('Power-saving'), $t('Balanced'), $t('Full power')][[1,2,4].indexOf(n)] }} ({{ n }})` → **结构逐字同构**,只换 `$t('字面量')`→`t('键')` | ✅ |
| **N19** | `v-show` + `v-if` **两个指令都照抄** | `ParserStatus.vue:298` = `<ul v-show="failedOpen" v-if="store.failedJobs.length" class="failure-list">`;Vue2 `:96` = `<ul v-show="failedOpen" v-if="store.state.failedJobs.length" class="failure-list">` → 两指令、顺序、类名全同,只有 K1 降层 | ✅ **没被合并成单指令** |
| **N21 + §3.6** | 7 对撞车键**各自独立存在、值照抄、不许统一** | 逐对实测(真值取自 `zh_cn.ts`/`en_us.ts`):`aiKbResume`(恢复/Resume) vs `aiKbRebuild`(恢复/Rebuild)· `aiKbSetSandboxTitle`(测试沙盒/Test Sandbox) vs `aiKbPrTestLink`(测试沙盒/Test sandbox)· `aiKbPrCcPowerSaving`(省电/Power-saving) vs `aiKbCcPowerSaver`(省电/Power saver)· `aiKbPrCcFullPower`(全力/Full power) vs `aiKbCcFullSpeed`(全力/Full speed)· `aiKbDeviceAuto`(自动/Auto) vs `aiCfgAutoPlaceholder`(自动/auto)· `aiKbSwitchFailed`(切换失败/Switch failed) vs `aiCfgToggleFailed`(切换失败/Toggle failed)· **镜像方向** `aiKbResume`(恢复/Resume) vs `filesUploadResume`(继续/Resume)。**7/7 两键都存在、zh 撞车保留、en 各不相同** | ✅ **零「顺手统一」** |
| **§9.2 的 en 档守卫** | 「不许复用键 B」必须有 **en 正 + 反**断言 | 实测都在:`ParserStatus.test.ts:471-475`(`not.toContain('Power saver')`/`('Full speed')`)· `SettingsView.test.ts:827-828`(`toBe('🧪 Test Sandbox')` + `not.toContain('Test sandbox')`)· `:841-847`(`toBe('Auto')` + `not.toBe('auto')` + 钉 `aiCfgAutoPlaceholder === 'auto'`)· `:860-861`(`'Switch failed'` + `not…('Toggle failed')`) | ✅ |
| **N22** | 技术标识符**不许补 i18n 键** | `rerank top-20` / `Reranker error:` / `dense [0:8]:` / `sparse top:` / `target_tokens` / `overlap_tokens` / `min_tokens` / `chunker=` / `tokens · offset` 在 `ParserTest.vue` 里都是裸串;在 `zh_cn.ts` 里的「1 次命中」经复核**全部落在 `:1648-1649` 那条 N22 声明注释里**,**零真键** | ✅ |

**结论:抽审 6 条,该照抄的都照抄了,没有被顺手修正。**

---

## 11. 🔴 三屏首次可达 —— 冒烟核(不启 dev server,用单测/产物证据)

| 屏 | 路由指向 | 到达路径(评审回源核) | 挂载证据 |
|---|---|---|---|
| `/ai/knowledge/settings` | `SettingsView` ✅ | rail **第 9 项**「系统设置」:`KnowledgeLayout.vue:63` `{ id:'settings', en:'Settings', labelKey:'aiKbNavSettings' }`(NAV 共 9 项,settings 第 9)→ `:221` `href="#/ai/knowledge/settings"` + `:222` `@click.prevent="navigate('settings')"` → `:170-173` `router.push('/ai/knowledge/settings')`。🔴 **`navigate()` 里没有 `isDeferred` 拦截**,不会被占位机制挡住 | `SettingsView.test.ts` **3 处 `mount()`** |
| `/ai/parser` | `ParserStatus` ✅ | 🔴 **无直接导航入口** —— 唯一入口是 `ParserTest.vue:314` 的 `← 返回详情` router-link。**Vue2 完全相同**(`git show main:` 实测:全 Vue2 仓只有 `ParserTest.vue:5` 那一条 `to="/ai/parser"`)→ **1:1,不是缺陷**。完整链路:rail 第 9 项 → 沙盒卡 → `/ai/parser/test` → 返回详情 → `/ai/parser`(或直接敲 `#/ai/parser`) | `ParserStatus.test.ts` **8 处 `mount()`** |
| `/ai/parser/test` | `ParserTest` ✅ | `SettingsView.vue:436` `goSandbox()` → `router.push('/ai/parser/test')`(沙盒卡)· 以及 `ParserStatus.vue:204` 的 `🧪 测试沙盒` router-link。与 Vue2 `SettingsView.vue:318` / `ParserStatus.vue:6` 逐字对应 | `ParserTest.test.ts` **2 处 `mount()`** |

三个测试文件合跑:**`Test Files 3 passed (3)` / `Tests 245 passed (245)`** → 三组件都真能挂载。

---

## 12. 🔴 §13 验收清单输入(协调者直接取用)

> **所有数字实测于 2026-08-04(评审现测),数字会漂,以下每项都附现测命令。**
> 取数环境:`P=http://127.0.0.1:8283/v1/parser`;`A=http://127.0.0.1:8282/agent`;`H='X-User-Id: 1'`

### 12.1 本机现测基线(2026-08-04,评审重抓)

```
control/state   {"paused":true,"concurrency":2,"device":"auto","ocr_enabled":false,"resolved_device":"cpu"}
stats           queue_depth {pending:339, running:1, failed:0, done:9} · indexed_files 7 · models 2
folders/pending folders 20 · total_groups 119
jobs?failed     {"jobs":[]}
notes/settings  {"notes_root":"/DATA/Notes","auto_extract":true,"distill_roots":[],"distill_daily_cap":50,"background_model":""}
notes/dir-info?path=/DATA/Notes   {"exists":true,"empty":false}
wiki/candidates []                (HTTP 200,秒回 → pickerRoots 走兜底三根 System(/DATA) / /media / /mnt)
folder?path=/DATA  18 项 · is_dir 14 · **可见(非 dot)目录 12**
```
→ **与治理 §4.3(2026-08-03)逐项一致,九个高危点的前提全部仍然成立。**

### 12.2 「点某个东西」但在本机数据下**不可点 / 不渲染**的项(§13 点名 9 个,评审逐个复核)

| # | 项 | 2026-08-04 复核 | 清单该怎么写 |
|---|---|---|---|
| 1 | ParserStatus 失败卡 toggle | `<button class="toggle">`(`:294`)**无条件渲染 → 能点**;`<ul v-show="failedOpen" v-if="store.failedJobs.length">`(`:298`)在 `failedJobs=[]` 时 `v-if` 先判掉 → **整个列表不渲染**(N19) | 「点开后确认**列表区为空** = 预期」,**别**写「点开看失败列表」 |
| 2 | ParserStatus 文件夹卡空态 | 20 组 → 走 `v-else` 列表分支;`v-if="!folders.length"` 的 `No pending` **本机验不到** | 只验列表分支 + 超长路径省略号(路径全是 `/DATA/.system_data/…`) |
| 3 | 设置页「搬文件到新目录…」 | `:disabled="!rootPicker.path \|\| (dirProbe.state==='done' && !dirProbe.migratable)"`;选 `/DATA/Notes`(`{exists:true,empty:false}`)→ **灰的** ✅ | 见下 **🔴 12.3 的重要更正** |
| 4 | 设置页「重建全部索引」 | `:645` 是**字面 `disabled`**,永远不可点;旁边 `:641` 有 `.k-set-soon` 徽标(`aiKbDeferredTitle`) | 只验「是灰的 + 有『即将上线』徽标」 |
| 5 | 设置页自动捕获 `.warn` 行 | `auto_extract: true` → `v-if="!notesSettings.autoExtract"` **不渲染** | 要看到它得先点开关(**会真写后端**,见 12.4) |
| 6 | 设置页服务卡绿灯 / 「运行中」 | `paused: true` → 默认只能看到橙灯 + `⏸ Paused` | 点「恢复」才能看到绿档(**会真恢复索引**,见 12.4) |
| 7 | ParserTest 的 `rr` 分数 | 🔴 **评审现测复现**:`rerank=true` → `rerank_error: "XLMRobertaTokenizer has no attribute prepare_for_model"`,`scored[0]` 只有 `{chunk_no, cos_sim}`(**无 `rerank_score`**)→ `rr` **永远看不到** | 勾 rerank 只能验 `⚠ Reranker error:` 警告条(**这条真机可验** ✅) |
| 8 | ParserTest 的 docling 卡 | 现测 `.txt` → `docling_markdown` **不存在** → 整卡不渲染 | 要看到它得传 `.docx/.pptx/.xlsx`;🔴 **别传 `.pdf`**(触发 ~200 MB 模型下载) |
| 9 | ParserTest「解析出 0 块」空态 | 现测空文件 → `chunk_count 0` / `chunks []` / **无 `query`、无 `scored`** → `.empty` 空态渲染 ✅ | **传一个空文件即可验** ✅ |

### 12.3 🔴 对 §13 第 3 项的**重要更正**(评审现测,治理的建议会把机主引进死路)

治理 §13 写「要点开『搬文件』按钮必须先走到一个空目录或不存在的目录(`/DATA/Downloads` 之类多半非空;
**`/mnt` 下大概率是空的,现场试**)」。**现测结论相反:**

```
/DATA/Downloads   HTTP 200  {"exists":true,"empty":true}    ← 🔴 这个才是能用的
/DATA/Documents   HTTP 200  {"exists":true,"empty":false}
/mnt              HTTP 400  {"detail":"path must be under /DATA"}
/media            HTTP 400  {"detail":"path must be under /DATA"}
```

- **`/mnt` / `/media` 会 400** → `dirProbe.state = 'error'`(`SettingsView.vue:320`)。
  而按钮的 disabled 表达式**只在 `state==='done'` 时才禁**(`:541`)→ **error 档下按钮反而变成可点**,
  且 `:530-532` 三个徽标分支**都不匹配 'error'** → **既没有徽标、按钮还亮着**;点下去走迁移会被后端同样 400 挡掉,
  只弹一个泛化 toast(K30 不回显后端 detail)。
- 🔴 **这是 Vue2 逐字同款行为**(同一个 disabled 表达式、同样没有 error 徽标分支)→ **不是本期缺陷、不要改**,
  但清单**必须**把目标目录写成 **`/DATA/Downloads`**,并注明「`pickerRoots` 兜底给的 `/media` / `/mnt` 两根走不通(后端只收 `/DATA` 下),
  选它们会看到『按钮亮着但没徽标』—— 那是预期」。

### 12.4 🔴 会**真写后端 / 改设备状态**的项(**7 处**)+ 逐项恢复法

统一回读命令:`curl -s http://127.0.0.1:8283/v1/parser/control/state; echo`
                `curl -s -H 'X-User-Id: 1' http://127.0.0.1:8282/agent/notes/settings; echo`

| # | 项 | 在哪 | 现值 | 影响 | 🔴 验完怎么恢复 |
|---|---|---|---|---|---|
| 1 | **恢复 / 暂停索引** | 设置页服务卡「恢复」按钮 · ParserStatus `▶ 恢复`(`:224`) | `paused: true` | **真的恢复后台索引**,内存 151 MB → ~2.8 GB;`pending 339` 会开始下降 | 验完**点回「暂停」**;回读 `paused` 应为 `true` |
| 2 | **并发档位** | 设置页运行档三格(1 / 2 / 4) | `concurrency: 2` | 写后端并发数 | 点回 **2**;回读 `concurrency:2` |
| 3 | 🔴🔴 **推理设备** | 设置页设备三格 `自动 / GPU / CPU`(`:486-488`) | `device: "auto"`,`resolved_device: "cpu"`(**本机无 GPU**) | 🔴 **点「GPU」会把 `device=cuda` 写进 Parser 的 SQLite,而 `device=cuda` 在无 GPU 机器上是硬失败、不静默回退 CPU**(顶层 CLAUDE.md + 治理 Parser 节)→ 可能让索引/服务起不来 | **强烈建议清单标「只验高亮态,不要点 GPU」**。若已点:`curl -s -X POST http://127.0.0.1:8283/v1/parser/control/device -H 'Content-Type: application/json' -d '{"device":"auto"}'` —— 🔴 **评审已用 auto→auto 幂等实测过这条命令:HTTP 200 `{"device":"auto","resolved_device":"cpu"}`,state 前后逐字未变**。服务起不来时改 SQLite:`UPDATE parser_state SET device='auto'`。(注:`POST /control {action:set_device}` 是 **404**,只有 `/control/device` 这条对) |
| 4 | **OCR 开关** | 设置页 `.k-sw` | `ocr_enabled: false` | 写后端;OCR 开了索引慢 5-10× | 点回**关**;回读 `ocr_enabled:false` |
| 5 | **自动捕获开关** | 设置页 `.k-sw`(`toggleAutoExtract`) | `auto_extract: true` | `PUT notes/settings` | 点回**开**;回读 `auto_extract:true`(顺带 `.warn` 行会重新消失) |
| 6 | **笔记目录「仅指向」** | 设置页 `applyRoot('adopt')` | `notes_root: "/DATA/Notes"` | 改后端 notes_root(**不搬文件**) | 重新选回 `/DATA/Notes` 点「仅指向」;回读 `notes_root` |
| 7 | 🔴🔴 **笔记目录「搬文件到新目录…」** | 设置页 `doMigrate()` → `applyRoot('migrate')` | 同上 | 🔴 **会真的把文件从 `/DATA/Notes` 搬到目标目录**,前端**无回滚**;`/DATA/Notes` 现为非空 | **建议清单标「只验按钮灰/亮 + 确认弹窗长相,不要真点确认」**。若已执行:只能手工把文件搬回 `/DATA/Notes` 并重新 `applyRoot('adopt')` 指回去 |

> 只读、无副作用、可放心点:ParserStatus 的「刷新」按钮 · 失败卡 toggle · 折叠区展开 ·
> ParserTest 的整套沙盒解析(`POST /test/analyze` **不写索引**,只吃 CPU;空文件/`.txt`/`.md` 都安全)。

### 12.5 🔴 A-2 —— 浅档指示灯色差(**必须作为显式确认项**,不是缺陷)

结构 1:1、只有颜色改成 token(K25 已授权暗档不同;**浅档「肉眼与 Vue2 一致」这半句在这两个 token 上做不到**):

| token | New-UI 浅档 | New-UI 暗档 | Vue2 参照 | 吃在哪 |
|---|---|---|---|---|
| `--warning` | **`#92600c`**(= `--toast-warn-fg`,深琥珀/棕) | `#E0A53B` | 设置页:`.knowledge-app` 的 **`#FF9500`**(亮橙,Vue2 `knowledge.scss:30`)· Parser 两页:**`#f5a623`**(`parser-styles.scss:37/88` 的 fallback) | `.k-svc-light[data-state="paused"]` 橙灯(`knowledge.scss:986+`)· `.k-set-row-desc .warn`(`:923`) |
| `--success` | **`#15754c`**(深绿) | `#4FB870` | 设置页:**`#34C759`**(亮绿,Vue2 `:29`)· Parser 两页:**`#2ecc71`**(`parser-styles.scss:36/66/95`) | `.k-svc-light` 绿灯 · ParserStatus `.ok-hint` / `.score` |

**清单写法**:「浅色档下服务卡指示灯(暂停=橙、运行=绿)与 `.warn` 提示行的颜色**比 Vue2 明显更深**,
这是本仓 token 体系的既定取舍(治理 §6.4.1-2 / 裁定 A-2),**请显式确认可接受**;
暗色档按 K25 本就与 Vue2 不同(Vue2 只有浅色一套)。」
⚠️ **顺带订正**:治理 §6.4.1-2 引的 Vue2 参照色 `#f5a623` / `#2ecc71` 是 **Parser 两页**的 fallback 字面量;
**设置页**同名灯的 Vue2 源是 `#FF9500` / `#34C759` → **实际色差比治理写的更大**(Minor-2)。

---

## 13. 缺陷清单

### Critical:**0**

### Important:**1**

**I-1 —— 4 处(报告说 3 处)带时点注释在本刀之后变成事实错误,其中两处会主动误导下游**

| 位置 | 原文要点 | 本刀之后的事实 |
|---|---|---|
| `SettingsView.vue:123-125` | 「【本页此刻未上路由 = 预期】…(`DEFERRED_TABS` 含 `'settings'`),**T10 才反转**;沙盒入口跳的 `/ai/parser/test` 同样仍是占位页。**浏览器里看不到本页,不是缺陷,不许改路由。**」 | 🔴 `DEFERRED_TABS` **已不含** `'settings'`;本页**已上路由、浏览器里看得到**;`/ai/parser/test` 已是真组件。**整段现在是反的**,且末句「不许改路由」会让下游拒绝正确的改动 |
| `ParserTest.vue:37-39` | 「本页此刻**零生产 import** …→ **`dist/assets/*.css` 里搜不到 `parser-test-page` 是预期**」 | 🔴 现在有生产 import;`parser-test-page` 在 `dist` CSS 里 **53 处**。这是一句会被当作判据引用的断言 |
| `SettingsView.vue:434` | 「复用既有 `/ai/parser/test` 页(**此刻仍是占位页**,T10 反转)」 | 🔴 已不是占位页。**报告漏计了这一处**(报告 §10 顾虑 1 只列 3 处) |
| `parserStore.ts:5` | 「**本刀落地时**全仓零 import 是预期的」 | ✅ **仍成立** —— 「本刀落地时」把时点锁死在 T5,是历史陈述,不需要改 |

- **不是实现者的过错**:brief §1/§6 明令「不许改那 4 个新视图」「需要改 → 停下写 `NEEDS_CONTEXT`」,
  它选择**申报而不擅动**,是正确处置(报告 §10 顾虑 1)。
- **为什么算 Important 而不是 Minor**:两处不是「陈旧」而是**与本次提交的既成事实直接相反**,
  且一处是「dist 里搜不到 X 是预期」这类**会被下游当判据引用**的断言,另一处带「不许改路由」的祈使句。
  同族先例正是治理自己删掉的 `knowledge.scss:9/301-303` 那 4 行「K17 留 P5c」——**兑现后就地订正**是本档既定做法。
- **建议处置(协调者一句裁定即可,不阻塞合并)**:授权一个**注释-only** 补丁改这 4 处(≈8 行,零产品逻辑、
  零测试影响),或明确判「留作历史记录」并在 P5d 台账登记。**评审倾向前者** —— 代价比误导下游小得多。

### Minor:**4**

- **M-1 K36 的 a11y 契约无常驻守卫。** `SettingsView.test.ts` 全文零 `aria-labelledby` 断言;
  K36 的落地要求「报告要证明 `aria-labelledby` 真的指向那个可见标题」只由 T9 报告的一次性实测满足。
  先例现成:`IndexedFilesView.test.ts:1947-1949` 就是那条断言。→ **转 P5d 补一条**(3 行)。
  (与治理反复出现的「产品代码对、守卫为零」同族,已是本期第 6 次。)
- **M-2 治理 §6.4.1-2 引的 Vue2 参照色张冠李戴。** `#f5a623` / `#2ecc71` 出自 **Parser 两页**的
  `var(--ns-color-*, fallback)`(`parser-styles.scss:36/37/66/88/95`);**设置页**同名灯的 Vue2 源是
  `.knowledge-app` 的 `--warning:#FF9500` / `--success:#34C759`(Vue2 `knowledge.scss:29-30`)。
  **结论方向不变(浅档确实更深),但实际色差更大** → 验收清单按 12.5 的两套参照写。
- **M-3 报告 §4-(4) 的 `k-modal-head` 计数没交代清楚。** 报告写「`k-modal-head` 1」;
  评审选择器感知复核 = **1 条规则选择器**(达标),但**裸子串 2 次** —— 第二次的来源报告未说明。
  不影响该项达标,只是证据链不完整。
- **M-4 `deferred.ts` 在产品代码里零消费者。** `isDeferred` / `DEFERRED_TABS` 全仓只被
  `deferred.test.ts` 引用(`KnowledgeDeferred.vue:8` 只是注释提到,`KnowledgeLayout.vue:170-173` 的
  `navigate()` **不做 `isDeferred` 拦截**)。**评审独立复核:报告顾虑 2 的判断准确**,且是 P5a 起的既有状态、
  非本刀造成;治理(P4 I2)明确要求「机制保留 + 用例证明它有能力」,用例齐全(探针 P4/P5/P6 三条实证)。
  → 观察项:P5f 清空 `DEFERRED_TABS` 时一并决定该模块去向。

---

## 14. 与报告不符之处

| # | 报告 | 评审实测 | 影响 |
|---|---|---|---|
| 1 | §10 顾虑 1:「**三处**注释随本刀过期」 | **4 处** —— 漏了 `SettingsView.vue:434`「此刻仍是占位页」 | 计数偏低;已并入 **I-1** |
| 2 | §6.3(a):以「`pnpm build` 后 `diff -r` → `DIR IDENTICAL`」证明 dist 可复现 | 该判据**有一个反例没排除**:若 tsc 走增量/跳过写盘,结果也会 IDENTICAL。评审补做「`tsconfig` 无 `incremental` + 零 `tsbuildinfo` + 强制干净 outDir 重建 `diff -r`」→ **结论不变,证据链补全** | 结论一致,证据强度提升 |
| 3 | §4-(4) `k-modal-head` 计数 | 见 **M-3** | 无 |
| 4 | §5 事故申报:第一轮探针误用 `git checkout -- <file>` 抹掉未提交编辑,重做后 md5 = `da12cb56…` | 🔴 **评审独立证实**:本轮基线 md5 与报告贴的**两个值逐字相同**(`da12cb56…` / `33acf83a…`),且全期 diff 归因无异常 → **重做零差异,事故零后果**。§9.5 已就此立规 | 无 |

**其余全部相符**(326/3515/179/295/99/死键 0 · 32/53 occurrence · 复合 0 处 · CSS 哈希 `index-CPhsuLE1` · 20 项 numstat 0 · 三处授权例外的 `-` 行归属)。

---

## 15. 收尾

- **评审自做 RED 探针 6 条,6/6 报红**;还原**全部走「副本 `cp` + md5 比对」**,零 git 还原命令(§9.5)。
- 评审过程中临时建的 `src/__revcount.test.ts` 已删除;临时脚本全在 `/tmp` 与 scratchpad。
- Service 仓:`pnpm build` 产物零变化(54 文件 md5 全同)、`git status` 空、`dist` 不受 git 跟踪;
  另在 scratchpad 留了 `svc-dist-before` / `svc-dist-fresh` 两份对照。
- 🔴 **`git status` 收尾:干净**(零 `M`、零 `??`)。**本评审未提交任何东西。**
