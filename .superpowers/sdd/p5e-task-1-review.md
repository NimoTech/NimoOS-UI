# P5e · Task 1 独立评审(i18n 63 键 + 债务票 D-3 / D-9)

> 评审者:独立 agent(**零采信实现者报告** —— 每个数字都回权威源自测)
> 日期:2026-08-05 · 被审提交 `40c98e0`(产品)+ `669f605`(报告补充)· 当前 HEAD `277dd9c`
> 权威顺序:上级设计 > `p5-master-plan.md` > `p5e-coordinator-rulings-T0.md`(**R11/R12/R13**) > 附录 > 治理 > 计划书

## 判定

| 严重度 | 条数 |
|---|---|
| **Critical** | **0** |
| **Important** | **0** |
| Minor | **3** |

🔴 **结论:T1 可以关账,进 T2。** 三条 Minor 均不阻塞(两条是文档口径、一条是覆盖面加固建议),
R13 防复活守卫是**协调者裁定后新增的整改项**,按 §5 列为「待整改轮补」,**不计 T1 缺陷**。

本刀是 P5c/P5d 以来第一次**没有**被「缺口猎」猎中产品码对/守卫为零的刀:
26 条新用例逐条实跑、E-45 陷阱被正面处理、撞车扫描的**输出集合本身**被钉住。

---

## 1. 我自己实测的数字(vs T1 自报)

| 量 | 我实测 | T1 自报 | 一致 |
|---|---|---|---|
| zh / en 全表键数(**真实模块导入**) | **1648 / 1648**,双向差集均空 | 1648 / 1648 | ✅ |
| `aiKb*` 家族 | **441** | 441 | ✅ |
| `aiCfgKnowledgeSoon` 是否已从两档删除 | **两档均 false** | 已删 | ✅ |
| 落地 `.ts` ↔ Vue2 权威语言包 逐码点 | **63/63 零差异** | 54/54 + 9/9 | ✅ |
| 附录 A 表格值 ↔ 权威语言包 | **零差异** | 63/63 | ✅ |
| R10:本批 en 覆盖值 ≠ JSON key | **0 / 63** | 0/63 | ✅ |
| 全角标点 `/[，；：？！（）]/` 命中(zh) | **恰 5 条** | 5 条 | ✅ |
| 同扫 en 侧 | **0 条** | 0 条 | ✅ |
| 占位符键 / 双占位符键 | **6 / 1**(`aiKbFdSummary`) | 6 / 1 | ✅ |
| 词干 `aiKbSr*` / `aiKbFd*` / `aiKbFv*` | **37 / 16 / 1** | 37/16/1 | ✅ |
| 撞车 方向1 / 方向2 | **3 / 2** | 3 / 2 | ✅ |
| 撞车 两轴同撞 | **15 对 / 10 组 @54 键;26 对 / 12 组 @63 键** | 26 对 / 12 组 | ✅ **口径差,非分歧**(见 §3) |
| 三门 | **Test Files 331 / Tests 3984 / 0 红 · tsc exit 0 · build exit 0** | 同 | ✅ |
| `.vue` / `color-guard` 用例 | **182 / 184** | 182 / 184 | ✅ |
| P5e 块用例数(`--reporter=verbose` 实数) | **26,逐条打印、全在执行** | +26 | ✅ |
| `package.json` / `pnpm-lock.yaml` / `color-guard.test.ts` / `parity.test.ts` | **`973a9b8..HEAD` 提交数均 = 0** | 零改动 | ✅ |

**零不一致项。** 唯一数字差是撞车「两轴同撞」的统计口径(§3),两边都对。

### 1.1 我自己的校验器(不复用 T1 的脚本)

`scratchpad/rev/myverify.mjs` —— 自己解析附录 A 的两张表取 (key, `$t` 串) 映射 →
从 `git -C ../../NimoOS-UI show 7a6ee6b7:src/assets/lang/{zh_CN,en_US}.json` 取权威值 →
与**真实模块导入**的落地 `.ts` 逐码点比。结果:**PART A 0 处差异 · PART B 0 处差异**。

🔴 **P5a-T8 教训(附录零差异、手抄进 TS 引入 5 处全角错)已按要求分两段比**:
① 语言包 ↔ 落地 `.ts`(**主判据**,零差异)② 附录 ↔ 语言包(零差异)。**两段都比过。**

---

## 2. en 侧权威性:R10 / E-44 的复发检查(§B-2)

**T1 自报「R10 实测 0/63 覆盖」= 本批恰好全都 en === key。我复核这个 0/63,并追查它是否被写成了前提:**

1. ✅ **是真测量,不是前提。** 我自己的脚本从 `en_US.json` 读 `enJson[$t串]`,再与落地 `.ts` 比 —— 得 0/63。
2. 🔴 **反证「en=key」不是全局真理**:整份 `en_US.json` **2676** 条里,**308 条**覆盖值 ≠ key。
   所以「本批 0/63」是这 63 条的**局部事实**,把它当通用假设会立刻错在别处 —— T1 的注释正确写成了 MEASURED。
3. ✅ **T1 的 PART 4 溯源探针真的报红**(我亲跑 `node .superpowers/sdd/p5e-task-1-i18n-verify.mjs`,exit 0):
   它把内存里 `en_US.json` 的一条改掉后输出
   `MISMATCH aiKbSrEmptyTitle — codepoint diff vs Vue2 source "No results found"` +
   `SUMMARY: 0/1 MATCH` + `PART 4 OK: the probe went RED as required`。
   ⇒ **E-44 那个 bug(用 key 顶替 en 值)不成立**,PART 1/2 确实在跟 `en_US.json` 比。
4. **交叉验证**:T1 脚本给 54/54 + 9/9 + 63/63 MATCH、R10 0/63 —— 与我自己的脚本逐项吻合。

### 2.2 `FILE_TYPES` 不进 i18n(§B-4)—— ✅ 成立

蓝本 `SearchView.vue:194-200` 是裸字面量;模板 **`:37` 是 `{{ t.label }}`,没过 `$t()`**;
同文件 `:47` 的 `$t(m.label)`(MTIMES)与 `:90` 的 `$t(s)`(SAMPLE_QUERIES)才过。**三张常量表口径确实不同。**
另查:`PDF`/`Markdown`/`TXT`/`DOC`/`Code` 五个值在本仓 `aiKb*` 家族里**一个都没出现** ⇒ 没有误进 i18n。

---

## 3. 撞车扫描:我独立重跑(§F)

自写 `scratchpad/rev/collide.mjs`,**真实模块导入**、双向扫描。

- **方向 1(zh 撞车 / en 不同)= 3 对**,与 T1 与附录**逐对相同**:
  `aiKbSrAdvOn↔aiSkEnable`(Enabled≠Enable)· `aiKbSrRelMid↔appsSettingsCpuMedium`(Mid≠Medium)·
  `aiKbSrRelMid↔aiThinkingMedium`(Mid≠Medium)。
- **方向 2(en 撞车 / zh 不同)= 2 对**,逐对相同:
  `aiKbSrAdvOn↔aiCfgChannelsEnabled`(启用≠已启用)· `aiKbSrAdvanced↔appsSettingsSectionAdvanced`(高级筛选≠高级)。
- **两轴同撞**:我在 **54 新键**口径得 **15 对 / 10 组**;在 **63 全批**口径得 **26 对 / 12 组**。
  🔴 **T1 的 26/12 是 63 键口径**(报告 §5 原文「对本批 **63** 个键 × 全表 1648 键」),差的 11 对全部来自
  两个**复用**键:`aiKbClose`↔7 个 + `aiKbSearch`↔4 个,组 +2。
  ⇒ **不是分歧,是口径。两个数都对**,附录 §A.1.2 也是按 63 列的。

> 前四刀「每刀都扫出协调者不知道的撞车对」,本刀确实**零新增** —— 我按要求格外用力核了,
> 而且 T1 把**扫描输出集合本身**钉成了断言(`messageSyntax.test.ts:1256`),所以「将来别处新增一轴同值键」
> 会报红而非静默出现。**这一条比前四刀更强。**

### 3.1 复用的 9 个键(§F-2)—— ✅ 全在 `aiKb*` 家族,零 A-1 违规

`aiKbClose` · `aiKbSampleContract` · `aiKbSampleSkating` · `aiKbStatusIndexed` · `aiKbSampleIphone` ·
`aiKbSamplePythonAsync` · `aiKbSearch` · `aiKbSampleThyroid` · `aiKbTry` —— **9/9 前缀 `aiKb`**。
**零个来自 `filesViewer*` / `photosSearch*` / `searchDialog*` / `aiCfg*` 等别区** ⇒ 无需动用 `aiCfgYou` 那类前期批准例外。

### 3.2 `High`/`Mid`/`Low`(§F-3)—— ✅ 三个全部新建为 `aiKbSr*`

`aiKbSrRelHigh` / `aiKbSrRelMid` / `aiKbSrRelLow`,**没有**复用 `appsSettingsCpu*` / `aiThinking*`。
`aiKbSrRelMid` 还额外被两条分歧轴断言保护(`Mid` ≠ `Medium`)。
⇒ 「`relLabel` 在 util 里走 `i18n.global.t`、选错键两个组件同时静默错」这个最高危点已封住。

### 3.3 §F-4 抽验(我实测 4 个,超出要求的 2 个)

| 值 | zh 同值键 | en 同值键 |
|---|---|---|
| `Modified` / 修改时间 | (none) | (none) |
| `Results` / 结果列表 | (none) | (none) |
| `files` / 个文件 | (none) | (none) |
| `Fast` / 快 | (none) | (none) |

⇒ T1 的「全表零同值键」成立。

---

## 4. D-3 与 D-9 的越权核查(§D / §E)

### 4.1 D-3 —— ✅ 零越权,额度用尽而未超

- `git show 40c98e0 --numstat` = **−2 / +10**,**单个 hunk** `@@ -1884,8 +1884,16 @@`。
- 🔴 **逐行核过改前的 `:1887-1888` 到底是什么**:`git show 40c98e0^:…` 的旧 1887/1888 **正是**
  `expect(Object.keys(zh)).toHaveLength(1595)` 与 `…(en)…`。**改的就是授权的那两行 + 相邻注释,其余一字未动**
  (文件 1951 → 1959 行,净 +8 = +10 −2)。
- ✅ 旧两行**留成注释**(`:1889-1890`),守「反转不删」。
- ✅ 注释**只引条目编号**(`裁定 R15 / 勘误 E-43 / 治理 §0.1 / 债务票 D-3`)与文件名 `src/i18n/parity.test.ts`,
  **零 `file:line`**。
- ✅ **1648 是实测值**:我用真实模块导入独立量得 **1648 / 1648、双向差集空**。
  (⚠️ 算式 `1595 − 1 + 54` 也 = 1648,所以数字本身证不了「实测」—— 我是**另跑一次导入**证的,不是核算式。)
- ✅ **补偿控制真实存在**:`parity.test.ts:9` 是 `expect(enKeys).toEqual(zhKeys)`,**键集完全相等**,
  确实比「两个数相等」强。D-3 注释的说法成立。
- ✅ **跨期陷阱真被拆掉**:全仓再无对全表键数的精确断言(唯二命中是那两行**被注释掉**的历史)。
  两处全表断言(`SettingsView.test.ts:1895-1896` + `messageSyntax.test.ts:1017-1018`)**都是下限**。

### 4.2 D-9 —— ✅ 落地正确

- 两档各删 `aiCfgKnowledgeSoon` **一行**(zh/en 删除行各 1,已逐行看过 diff)。
- `SettingsPage.vue` **只 +2 行注释**,原注释块**一字未删**(守「反转不删」)。
- ✅ **既定死键口径自证**:
  `grep -rlw --include='*.vue' --include='*.ts' -e aiCfgKnowledgeSoon src/ | grep -v '^src/i18n/' | grep -v '\.test\.ts$'`
  → **只命中 `src/ai/views/SettingsPage.vue`** 那条历史注释。R13 第 2 条的「两个目标零妥协同时成立」得到验证。

### 4.3 R12 的双轨口径 —— ✅ 完全合规

| 断言 | 落法 | R12 要求 | 判定 |
|---|---|---|---|
| 本批 54 键 | `expect(p5eTask1Keys.length).toBe(54)` + 词干 `toBe(37/16/1)` | **精确** | ✅ |
| 全表 1648(messageSyntax) | `toBeGreaterThanOrEqual(1648)` ×2 | **下限** | ✅ |
| 全表 1648(SettingsView / D-3) | `toBeGreaterThanOrEqual(1648)` ×2 | **下限** | ✅ |

🔴 **没有任何一处把全表写成精确值** ⇒ **未重建 D-3 刚拆掉的跨期陷阱。**

### 4.4 守卫圈定范围(§C-4)—— ✅ 只圈本批,未误扩全表

P5e 块的 **26 条**全部以 `p5eTask1Keys`(54)为遍历域;撞车扫描是 `p5eTask1Keys × 全表`,
**只产出含本批键的对**。全文件唯一的全表级用例是 `bare @ guard`(`:1276`),**P3b 起的既有用例,T1 一行未动**。
⇒ 没有把别期既有违规卷进来、没有该报 `NEEDS_CONTEXT` 的情况。

---

## 5. R13 防复活守卫 —— 🔴 **待整改轮补**(不计 T1 缺陷)

**T1 提交时该守卫不存在,协调者 R13 裁定「换回」在其后** ⇒ 按 brief 不报成 T1 缺陷。
但我**实证了缺口是真的**(探针 5,见 §6):

- `grep -rn 'aiCfgKnowledgeSoon' --include='*.test.ts' src/` → **零命中**,守卫确实不存在。
- **把该键复活进 zh + en 两档(键数 1649/1649)→ 全量 331 文件 / 3984 例 全绿、零红。**
  `parity.test.ts` 对「两档同增」无感(键集仍相等),下限断言只管不下降 ⇒ **无任何守卫报红**。

### 我建议的落点与判据(供整改轮)

**落点**:`src/i18n/messageSyntax.test.ts` 的 **P5e Task 1 块内**(与本批其它守卫同处,便于 T8 收官复核)。
理由:R13 明示「守卫写在 `.test.ts` 里」,而既定死键 grep 口径本就排除 `*.test.ts` ⇒ D-9 自证仍只命中那条注释。

**建议形状**(不要写成字符串 grep,直接断键):

```ts
// 治理 §0.2 / 债务票 D-9 + 裁定 R13:该键已在 P5e-T1 删除(零生产消费点),
// 决策历史留在 src/ai/views/SettingsPage.vue 的注释里。这里防「有人把它加回来」——
// parity.test.ts 对「两档同时加回」无感(键集仍相等),全表下限断言也只管不下降。
it('D-9: aiCfgKnowledgeSoon stays deleted from both locales (anti-revival)', () => {
  expect('aiCfgKnowledgeSoon' in zh).toBe(false)
  expect('aiCfgKnowledgeSoon' in en).toBe(false)
})
```

**判据(整改轮必须自证)**:把该键加回 **zh 单档** → 报红;加回 **两档** → **也必须报红**
(🔴 后者才是本缺口的真形态 —— 我已实证两档同加时现状全绿)。

---

## 6. 我做的 RED / 变异探针(全部 `cp` 备份 → 锚定注入 → **先证注入落盘** → 副本覆盖 → `md5sum` 逐字节比对;**全程禁 `git checkout/restore/stash`**)

基线:`zh_cn.ts = 9970eb90e3cb278dcbe0e718eb0742bf` · `en_us.ts = a71c8de0606d315e4ed53ec04d4815b2`

| # | 探针 | 注入落盘证据 | 结果 | 还原 |
|---|---|---|---|---|
| **1** | **`aiKbFdCopyFailed` zh:半角 `,` → 全角 `，`** | `:1902 复制失败，请手动选择` · md5 变 `24bcab44…` | 🔴 **3 例报红**:全角扫描 · 码点级钉死 · **撞车扫描输出集合**(它不再与 `aiCfgCopyFailed` 同 zh ⇒ 变成一轴撞车对) | `md5sum -c` **OK** |
| **2** | **`aiKbSrPlaceholder` zh:`…`(U+2026) → 三个半角点** | `:1941 搜你的文档...` · md5 变 `9798f331…` | 🔴 **1 例报红**:码点级钉死(§A.2.2) | **OK** |
| **3** | 🔴 **占位符名探针(必选项)**:`aiKbFdSummary` **仅 en 一档** `{query}` → `{q}` | `:1892 … for "{q}", …`(zh 档 `:1914` 仍是 `{query}`)· md5 变 `ebae0e0c…` | 🔴 **3 例报红**:占位符集合两档一致 · **E-45 全量插值 `toBe`** · 码点级钉死 | **OK** |
| **4** | **D-3**:删 3 个 zh 键(`aiKbSrTopK`/`aiKbSrQuality`/`aiKbSrFileType`),实测降到 **1645** | 导入实测 `zh keys = 1645` | 🔴 **报红**:`AssertionError: expected 1645 to be greater than or equal to 1648` @ `SettingsView.test.ts:1895` | **OK** |
| **5** | **R13 缺口取证**:`aiCfgKnowledgeSoon` 复活进**两档**(1649/1649) | `zh_cn.ts:629` + `en_us.ts:620` 均已落盘 | ⚠️ **全量 331/3984 全绿、零红 ⇒ 缺口确证** | **OK** |
| **E-45** | **独立复现**(不改仓库):用仓内 **vue-i18n 9.14.5** 直接渲染探针 3 的坏 en 档 | — | `渲染结果 = 'Found 3 matching sections for "", ranked by similarity'` ⇒ **`not.toContain('{query}')` 会通过 = 零判别力**;`not.toContain('{q}')` **也**通过;**全量 `toBe` 报红 = 有判别力** | 无需还原 |

🔴 **最终还原确认**:`md5sum -c baseline.md5` → `src/i18n/zh_cn.ts: OK` / `src/i18n/en_us.ts: OK`;
`git status --short` **空**。**仓库零残留、零提交、零 `--amend`。**

⚠️ **探针 5 第一次注入失败并被我抓住**:锚点 `aiCfgKnowledgeBase` 在本仓不存在,`grep` 验证零命中
⇒ 换锚点 `aiCfgPlaceholderBody` 重做。**这正是「先证注入落盘」这条纪律的价值 ——
若不验证,我会把「注入没生效导致的全绿」误读成「守卫存在」,得出与事实相反的结论。**

### 6.1 E-45 的处置评价(§C-2 / §I-2)——本刀最容易藏空转的地方,**T1 处理正确**

- **真守卫**是 `:1184-1197` 的 **6 条全量插值 `toBe`**(5 个 `{n}` + 1 个双占位符),我的探针 3 证明它们**真报红**。
- `:1206` 那条 `not.toContain('{query}')` **不是**守卫 —— 它与 `:1205` 的
  `expect(rendered).toBe('为「」找到 3 段相关内容，按相似度排序')` 同处一条用例,
  作用是**把 E-45 的行为本身钉成活断言**(将来 vue-i18n 若改成保留字面量,这条会红并提示重审注释)。
  ⇒ **不是零判别力用例混进来,而是把「为什么不能那样写」固化成可执行证据。判为良好实践。**

### 6.2 参数化守卫的空循环风险(§I-1)—— ✅ 26 条真在跑

`--reporter=verbose` 逐条打印 **26 条 P5e 用例**(编号 1–26 已核),含
E-45 循环生成的 **5 条独立 `it`** 与撞车循环生成的 **5 条独立 `it`** ⇒ **零空循环**。
清单长度也被钉住:`54` / `5`(全角例外)/ `6`(占位符)/ `5`(分歧对)/ `9`(复用键)。
**唯一未钉长度的是 `singleN`(5 条)** —— 见 Minor-1。

### 6.3 D-4 口径(§I-3)—— ✅ 报告写清了

报告 §「D-4 口径」明写:54 条**全部**有存在性 + 两档 string 断言;其上 **16 条**有值级断言
(5 全角 `toBe` · 7 码点级 · 6 真插值 · 3 分歧轴,并集程序化算出 16 并列出键名)⇒
**「vitest 侧只有存在性断言」= 38 条**,与 P5a–P5d 同一模式,**本期未反转**。符合附录 A §A.4-5 的要求。

### 6.4 「只许加固、不许放宽」(§I-4)—— ✅ 无违规

全期唯一被改的既有守卫是 D-3 那两行,且**是裁定明令的改法**:
判据从「精确 1595」变成「下限 1648」——**下限值反而从 1595 抬到 1648**,
「键数不下降」这一保留价值上**比改前更紧**;失去的「侦测任何增长」正是 D-3 要拆的跨期陷阱本身,
且键集一致性由 `parity.test.ts` 更强地覆盖。**不构成放宽。**

---

## 7. §G git 事故的独立核损(只核不修)

| # | 核查 | 我的独立结论 |
|---|---|---|
| **G-1** | 裁定文件 blob 是否同一 hash | 🟡 **substance 成立,协调者的措辞已过期**。`28d6185` 与 `57fdd3a` 的 `p5e-coordinator-rulings-T0.md` **同为 `6e787af43902b75f743e9a464404fb8dc1eec9e0`,逐字节相同 ⇒ amend 零内容丢失**。但 R11 表里写的「`28d6185` 与 **HEAD** 逐字节相同」**在当前 HEAD 上不再成立**(`HEAD:` 该文件 = `e4ff21d3…`)—— 原因是**协调者自己随后提交了 `277dd9c`**(该文件 **+66 / −0**,我已核**零删除行**、纯新增 R11-R13)。⇒ **实质判断正确,只是把 `57fdd3a` 写成了「HEAD」,现在 HEAD 变了。见 Minor-2。** |
| **G-2** | `40c98e0` 的 7 文件是否完整、`src/` 5 个是否就是授权的 5 个 | 🟢 **完整无损**。7 文件 = `p5e-task-1-i18n-verify.mjs` · `p5e-task-1-report.md` · `SettingsView.test.ts` · `SettingsPage.vue` · `en_us.ts` · `messageSyntax.test.ts` · `zh_cn.ts`。**与计划书 §T1「改」清单逐个吻合,零多余文件。** `src/` 侧合计 **+542 / −4**,与协调者核损数字**逐字相符**。 |
| **G-3** | 有没有别的东西被 amend 吃掉 | 🟢 **没有**。`git diff --numstat 28d6185 57fdd3a` = **仅** `.superpowers/sdd/p5e-task-1-report.md` **+13 / −0**,别无一物;两者**父提交同为 `40c98e0`**、**提交信息逐字相同**;`28d6185` 仍 `git cat-file -t` = `commit`,未丢。 |

🔴 **协调者的「零内容丢失」结论成立**(G-1 实质 + G-2 + G-3 三面独立坐实)。**未发现任何一处不成立。**
我**没有**执行任何 `reset` / `rebase` / `amend`。

---

## 8. Minor 三条

**Minor-1 —— `singleN` 是 P5e 块里唯一未钉长度的参数化清单**
`messageSyntax.test.ts:1171-1181` 的 `singleN`(5 条)驱动 `:1183-1188` 的 `for … it(…)`。
本块其它每张清单都配了长度断言(`54` / `5` / `6` / `5` / `9`),**只有它没有**。
影响:将来有人从 `singleN` 删掉一条,**该键的插值 `toBe` 静默消失、三门全绿**。
(部分被 `:1126` 那条「占位符键集合从落盘值反推 = 恰好 6」缓解 —— 但那条只保证**键仍带占位符**,
不保证它**仍有插值断言**。)
**建议**(T8 收官刀顺手,1 行):`expect(singleN.length + 1).toBe(placeholderKeysWithInterpolation.length)`
或直接 `expect(singleN.length).toBe(5)`。

**Minor-2 —— R11 核损表的「HEAD」措辞已过期,建议改写成 sha**
`p5e-coordinator-rulings-T0.md` 的 R11 表写「`28d6185` 与 `HEAD` 逐字节相同」。
写下时 HEAD = `57fdd3a`,成立;协调者随后提交 `277dd9c`(+66/−0)后,该句在字面上不再可复现。
**建议**(守「反转不删」,加订正块不改原文):把比对对象写成 **`28d6185` == `57fdd3a`,blob `6e787af4…`**,
并注明「`277dd9c` 之后 HEAD 该文件为纯增内容」。这条纯属**将来读史者能否复现**的问题,不影响任何裁定。

**Minor-3 —— 1648 这个数字现在有两处独立下限,建议在 T8 登记归属**
`SettingsView.test.ts:1895-1896`(D-3 残留,归属 P5c-T9 那条用例)与
`messageSyntax.test.ts:1017-1018`(本批自己的全表钉子)。
两处都是**下限**,**不会**给后续加键的期造成任何陷阱(下限只在缩水时报红),因此**不是缺陷**;
但同一个数字散在两个文件里,将来改动时容易只改一处。
**建议**:T8 收官时在两处互相加一句交叉引用注释,说明「另一处也有同值下限,二者独立、都只管不下降」。

---

## 9. 死键审计与交接表(§E-3)

🔴 **本批 54 个新键逐键用词边界 grep 扫 `src/`**(排除 `src/i18n/` 与 `*.test.ts`):
**54 / 54 零生产消费点。**

⚠️ **这是正常的、不是缺陷** —— 本刀是纯 i18n 刀,消费组件在 **T3–T7** 才写(计划书已定)。
按 brief 要求列出「哪些键等哪一刀」,**T8 收官刀必须复核这张表、届时应为零死键**:

| 消费点 | 落地刀 | 键数 | 键 |
|---|---|---|---|
| `util/searchAggregate.ts` | **T3** | 1 | `aiKbSrUntitled` |
| `components/KFileViewer.vue` | **T4** | 1(+1 共用) | `aiKbFvUnsupported`(+ `aiKbFdDownload`,与 T5 共用一个键,§A.7) |
| `components/FileDetailDrawer.vue` | **T5** | 16 | 全部 `aiKbFd*` |
| `views/SearchView.vue` 上/下半 | **T6 / T7** | 37 | 全部 `aiKbSr*`(含经 util `relLabel()` 走 `i18n.global.t` 的 `aiKbSrRelHigh/Mid/Low`) |
| 既有(复用键,已在别处消费) | — | 9 | `aiKbClose`(IndexedFilesView)· `aiKbSearch`/`aiKbTry`/5 个 `aiKbSample*`(DashboardView)· `aiKbStatusIndexed`(IndexedFilesView) |

⚠️ **间接消费提醒**:`aiKbSrMtime*` 4 条与 5 个 `aiKbSample*` 是写在常量 `label` 字段上、由 `$t(m.label)` / `$t(s)`
渲染的(蓝本 `:47` / `:90`)⇒ **T6 收尾时用裸键名 grep 会扫不到**,不能据此判死键。

---

## 10. 三门留痕核查(§H)

| 门 | 我自己复跑 | 落盘 | 截断 |
|---|---|---|---|
| `vitest run --reporter=verbose` | `Test Files 331 passed (331)` / `Tests 3984 passed (3984)` / **红项 0** / 69.52s | `scratchpad/rev/gate-test-verbose.log` | **无 `\| tail`** |
| `vue-tsc --noEmit` | **exit 0** | `gate-tsc.log` | 无 |
| `pnpm build` | **exit 0**,`✓ built in 13.45s` | `gate-build.log` | 无 |

🔴 **本刀我按要求跑了全量**(T1 加了 26 例且动了两个零改动清单上的文件,数字零信任)。
另核:`package.json` / `pnpm-lock.yaml` / `src/styles/color-guard.test.ts` / `src/i18n/parity.test.ts`
在 `973a9b8..HEAD` 区间**提交数均为 0**;提交只含授权文件;工作树干净。

---

## 11. 附录 A 可信度(§B-3)

`973a9b8` 确实动过附录 A(+40/−30),我核了它**没动 63 个 key/值行**:
`grep -E '^\| [0-9]+ \| \`aiKb' ` 取出的行在 `d79d922` 与 `HEAD` 两版**md5 完全相同**
(`4d576d15c282710d376391468e485a6e`,68 行)。
两个 hunk 分别落在 **§A.0 的 E-53 散文表**(`@@ -24,26 +24,34 @@`)与 **§A.8/§A.9**(`@@ -284,23 +292,25 @@`)。
⇒ **T1「63 个 key/值行一行未改」的声称成立。**

---

## 12. 给协调者的关账建议

**T1 可以关账,进 T2。** 三条 Minor 都可以**顺手带进 T8 收官刀**,不必单开整改轮。
唯一需要在**下一个整改点**明确安排的是 **§5 的 R13 防复活守卫**(裁定后新增项,落点与判据已在 §5 给出)。

**T2 开工前请注意**:R8 要求 T2 第一动作是独立复现 `347 / 348 / 19` 三个数。
本刀对 `knowledge.scss` / `knowledgeStyles.test.ts` **零改动**(已核),所以 T2 的基线未被本刀污染。
