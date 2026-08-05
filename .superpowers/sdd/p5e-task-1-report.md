# P5e Task 1 报告 —— i18n 键(63 distinct)+ 债务票 D-3 / D-9

> 实现者报告,写于 **2026-08-05**。起点 HEAD **`a3f5187`**(现测确认)。分支 `sp8-ai`。
> 蓝本锁 `NimoOS-UI@7a6ee6b7`(只读,全程 `git show`,未 checkout/stash/commit)。
> 治理依据:`p5e-coordinator-rulings-T0.md`(R1–R8) > `p5e-appendix-A-i18n.md` > 上级设计 §7/§8/§9-2 >
> `p5e-common-constraints.md` §0.1/§0.2/§1.1/§7/§7.1/§8/§9.10/§9.14/§10/§13/§14 > `p5e-plan.md` §T1 > 任务 brief。

---

## 0. 一句话结论

**DONE_WITH_CONCERNS**(顾虑 2 条,均为已申报的口径抉择,见 §9;无缺陷、无越权、无阻塞)。

54 个新键 + 9 个复用键落地,`aiCfgKnowledgeSoon` 删键,D-3 改下限断言。
三门全绿:`Test Files 331 passed (331)` / `Tests 3984 passed (3984)` / `vue-tsc` exit 0 / `vite build` exit 0,**零红项**。

---

## 1. 逐文件改了什么(额度内,零越权)

| 文件 | 改动 | 额度依据 |
|---|---|---|
| `src/i18n/zh_cn.ts` | +54 键(`>>> SP8-P5e Task 1` 标记块,含 33 行块头注释)· **−1 行** `aiCfgKnowledgeSoon` | §1.1 「本期加键(§7)+ 删 `aiCfgKnowledgeSoon` 一行(§0.2)」 |
| `src/i18n/en_us.ts` | +54 键(标记块,含 27 行块头注释,其中 `aiKbSrIdleSub` 按本仓既有风格折行)· **−1 行** `aiCfgKnowledgeSoon` | 同上 |
| `src/i18n/messageSyntax.test.ts` | +1 个 `describe` 块(**26 条用例**),含 (a)(b)(c) 三条守卫 + 码点级钉死 + E-45 插值组 + §9.2/§9.3 双向撞车组 | DoD-3 |
| `src/ai/knowledge/views/SettingsView.test.ts` | **只改 `:1887-1888` 两行 + 相邻注释**(−2 / +10,其中 8 行是注释) | §1.1 极窄解禁 + §0.1 |
| `src/ai/views/SettingsPage.vue` | **只在 `:187` 那条注释后补 2 行**(注释本身未删) | §1.1 「只许改 `:187` 那条注释」+ §0.2 ② |
| `.superpowers/sdd/p5e-task-1-i18n-verify.mjs` | **新建**(469 行,4 个 PART) | DoD-2 |
| `.superpowers/sdd/p5e-task-1-report.md` | 本文件 | §10 |

**零改动核实**:`src/styles/color-guard.test.ts` 一行未动(§0.3 铁律)· `.sp8/NimoOS-Service` 零改动 ·
`package.json` / `pnpm-lock.yaml` 零改动(§14,**零新依赖 ⇒ 未碰任何 dev server**)· `KIcon.vue` / `knowledgeStore.ts` /
`src/files/viewers/**` / `searchMapper.ts` / `theme.css` 等全期零改动清单文件一律未碰 ·
**未部署 · 未 push · 未合 master · 未跑 `deploy.sh`**。

`git show --stat HEAD` 见 §8。

---

## 2. DoD-1 —— 63 个键同时进两档,零遗漏零多余

### 2.1 🔴 值不是手抄的 —— 由脚本直接从权威 JSON 生成

承 §5-1 的教训(**P5a-T8:附录本身逐字正确,手抄进 `.ts` 时引入 5 处全角标点错**)。
本刀**根本不走手抄路径**:一次性生成器(scratchpad,不入库)`import { NEW_KEYS, vue2Json }` 自
`p5e-task-1-i18n-verify.mjs`,对 54 个「蓝本 `$t` 串」逐个查
`git show 7a6ee6b7:src/assets/lang/{zh_CN,en_US}.json` 并输出 TS 行 → 直接插入两档。
**人手只写了「键名 → 英文原串」这一层映射**,值一个字符都没经过人手,全角标点错这一整类错误在结构上消失。

**其后再用 verify 脚本对「落盘后的 TS」逐码点回比**(防生成后被编辑器/换行处理污染),见 §2.3。

### 2.2 落地清单

- **复用 9 / 新增 54 / distinct 63**(附录 A §A.0 终值,已由 T0 评审逐码点复核 0 mismatch)。
- **其中 Vue2 有权威 zh 值:63/63(M = 63)**;**本期新造 K = 0**;**死键 0**。
  实测(verify 脚本尾行):`Vue2 coverage: zh_CN.json 63/63, en_US.json 63/63 (0 self-invented copy required)`。
- 词干分布(测试内断言,非只在报告里声明):`aiKbSr*` **37** / `aiKbFd*` **16** / `aiKbFv*` **1** = 54,复用 9 个无词干 `aiKb*`。
- 🔴 **`FILE_TYPES` 的 5 个 label(`PDF`/`Markdown`/`TXT`/`DOC`/`Code`)不进 i18n** —— 蓝本 `SearchView.vue:194-200`
  是裸字面量、模板 `:37` 的 `{{ t.label }}` 没过 `$t()`(附录 §A.5)。**本刀零键与它们相关**;两档块头注释已写明,
  供 T6 照抄字面量时对账。同一文件的 `MTIMES`(过 `$t(m.label)`)与 `SAMPLE_QUERIES`(过 `$t(s)`)才进 i18n,
  已进(4 个 `aiKbSrMtime*` + 5 个复用的 `aiKbSample*`)。
- 🔴 **值里零字面 `@` 零 `|`** → **不需要 `{'@'}` 转义**。实测:对 63 个键 × zh/en 两档扫 `/[@|]/` → **0 命中**;
  且全仓既有的 `bare @ guard` 用例(`messageSyntax.test.ts` 末尾)本刀后仍绿。

### 2.3 `parity.test.ts` 与全表键数

- `pnpm exec vitest run src/i18n/` → **3 files / 91 tests passed**,`parity.test.ts` 绿(它断言 zh/en 键集完全相等)。
- **全表键数用真实模块导入现测,不用算式**(§9.3 第 2 条:文本解析会少算):

| 时点 | zh | en | zh−en 差集 | en−zh 差集 | `aiKb*` 家族 |
|---|---|---|---|---|---|
| 起点(本刀前,自测,非采信) | **1595** | **1595** | 空 | 空 | 387 |
| 落地后 | **1648** | **1648** | 空 | 空 | **441** |

对账:1595 + 54 − 1 = 1648 ✅(**算式只用于对账,数字来自实测**;`aiKb*` 387 + 54 = 441 ✅)。
取数命令 = 附录 §A.9 的 `p5e-dump.test.ts` 临时用例(跑完即删,**未提交**)。
⚠️ **具体计数有保质期**(§13-2),复现请重跑该命令。

---

## 3. DoD-2 —— `p5e-task-1-i18n-verify.mjs`:N/N 逐码点 MATCH

照 `p5d-task-1-i18n-verify.mjs` 的模具,**并修掉它的祖先在 P5c 留下的 E-44 那个 bug**。终值:

```
BLOCK-COVERAGE OK: zh_cn.ts marked block has exactly the 54 mapped keys, zero duplicates
BLOCK-COVERAGE OK: en_us.ts marked block has exactly the 54 mapped keys, zero duplicates
REUSE OK: zh_cn.ts marked block re-declares none of the 9 reused keys
REUSE OK: en_us.ts marked block re-declares none of the 9 reused keys
SUMMARY (PART 1 — 54 new keys (Appendix A §A.1 新增)): 54/54 MATCH
SUMMARY (PART 2 — 9 reused keys (Appendix A §A.1 复用 / §A.1.1), unchanged by this task): 9/9 MATCH
SUMMARY (PART 3): 63/63 MATCH against the appendix's own columns
SUMMARY (PART 4 probe run — expected to go RED on exactly 1 key): 0/1 MATCH
R10 MEASUREMENT: 0/63 en_US.json entries override the $t() key (Appendix A §A.0 measured 0)
Vue2 coverage: zh_CN.json 63/63, en_US.json 63/63 (0 self-invented copy required)
RESULT: PASS (all 4 parts)
```

完整输出:`/tmp/p5e-t1-verify.log`。**DoD 的两个数达成:新增 54/54 MATCH · 复用 9/9 未被改动。**

### 3.1 🔴 en 侧没有假设「en = JSON key」(E-31 / R10 / E-44)

- **每一处 en 比较读的都是 `enPack[english]`**,即 `en_US.json` 的**覆盖值**,不是 `english`(= `$t()` 的 key)。
- 「本批 en === key 63/63」在脚本里是**一行 MEASUREMENT 输出 + 一条 `!== 0 则 FAIL` 的漂移警报**,
  **不是任何比较的前提**。T0 评审实测 63/63,本刀独立复测同值(`R10 MEASUREMENT: 0/63 ... override`)。
- 🔴 **附录 §A.4-3 指出「本批恰好全等 ⇒ 没有 en≠key 的反向断言素材」,并要求把反向断言换成
  「把 JSON 里某个键的值临时改掉 → 脚本必须报红」。已实现为 PART 4**(脚本自带、每次运行都跑,
  不是一次性人工探针):把内存里 `en_US.json` 的 `"No results found"` 改成
  `"No results found MUTATED-BY-PROBE"` → 该键的 en 比较**必须报 MISMATCH**;若保持 GREEN 就说明脚本读的是 key
  而不是 JSON(= E-44),脚本会打印
  `FAIL: the probe stayed GREEN — this script is NOT reading en from en_US.json (that is E-44)` 并置 exit 1。
  实测输出:`PART 4 OK: the probe went RED as required`(逐码点 diff 打出了 17 个多出来的字符)。

### 3.2 PART 3 —— 对「附录自己的 zh/en 两列」的独立交叉核对(比模具多出来的一层)

PART 1/2 有一个残余盲区:**若我人手写的「键名→英文原串」映射把某个键映到了另一个恰好也存在于
`zh_CN.json` 里的英文串,PART 1 会照样 54/54 全绿**(值来自那个错串,自洽)。
PART 3 用**另一个artifact**堵它:解析 `git show a3f5187:.superpowers/sdd/p5e-appendix-A-i18n.md` 的
§A.1 两张表(6 格行),取它自己的「蓝本 `$t` 串 / zh / en」三列,与落盘值逐码点比 + 与我的映射比英文原串。
结果 **63/63 MATCH,键集双向差集为空,解析到恰好 63 行**。

🔴 **附录读的是 pinned sha `a3f5187` 的 blob,不是工作树** —— 有另一个 agent 正在并发整改
`.superpowers/sdd/` 下的 fixtures 与附录,读工作树会让这个脚本将来无故报红。

---

## 4. DoD-3 —— `messageSyntax.test.ts` 三条守卫(只圈本批键,未全量生效)

新增 **26 条用例**(`--reporter=verbose` 逐条见于 passed 列表,**零 skip / 零 todo**,
承 §9.14-4「参数化守卫要防空循环」:26 条是独立用例,不是一条循环)。

### (a) 全角标点扫描 + `toBe` 钉死的例外清单

- 正则 `/[，；：？！（）]/`(**只这 6 个字符**)。
- 🔴 **例外条数是我自己实测的,不是采信协调者/T0**:对落盘后的 54 个 zh 值扫 → **恰好 5 条**,
  与附录 §A.2.1 逐条一致(`aiKbFdSummary` / `aiKbSrEmptySub` / `aiKbSrIdleSub` / `aiKbSrNoPreviewToast` / `aiKbSrRerankWarn`)。
  5 条一律 `toBe` 钉死确切值(不是「跳过扫描」的松形式),另加一条 `Object.keys(...).length === 5` 防清单漂移。
- **加了一条 en 侧同扫**(实测 0 命中)—— 附录只要求 zh 侧;en 侧同扫是纯加固,不放宽任何既有判据。
- 🔴 **另加一条「码点级」用例**,钉死那些**不在正则里、但同样必须逐字照抄**的字符(§A.2.2/§A.2.3):
  - `aiKbFdCopyFailed` 的 **半角逗号 U+002C**(正向 `toBe` + `includes(',') === true` + `includes('，') === false`
    —— 这条是本批最容易被「顺手规整成全角」的一处);
  - `aiKbSrMoreHint` 的 **` — `**(U+2014 两侧各一个半角空格);
  - `aiKbSrEmptyTipAllowlist` / `aiKbFdSummary` 的 **「」**(U+300C/U+300D);
  - `aiKbSrPlaceholder` 结尾的 **`…`**(U+2026 单字符;并断言 `endsWith('...') === false`,zh/en 两档);
  - `aiKbSrIdleSub` 的 **两个 `。`**(用 split 计数钉死「恰好 2 个」);
  - en 侧 4 个键的 em dash(§A.2.3);`aiKbFdSummary` en 的**两个半角双引号**。

### (b) 占位符集合两档一致 + 🔴 真插值断言(E-45)

- 🔴 **占位符键清单也是实测的**:扫 54 个值(zh ∪ en)→ **恰好 6 个**带 `{…}`
  (`aiKbFdPage` / `aiKbFdSection` / `aiKbFdSummary` / `aiKbSrMatchPill` / `aiKbSrMatchTitle` / `aiKbSrMoreHint`)。
  **本期唯一的双占位符键 = `aiKbFdSummary`(`{n}` + `{query}`)** ✅。
- 除了「长度 = 6」,**另加一条从落盘值反推清单的用例**:全扫 54 个键,要求带占位符的键集**恰好等于**那 6 个
  —— 否则「第 7 个键加了占位符」会让长度断言照样绿、而新键永远拿不到 parity 检查。
- 🔴 **反向断言不写成「渲染结果含 `{x}` 字面量」**(E-45:vue-i18n 对未匹配占位符是**静默置空**,
  `not.toContain('{n}')` = 零判别力)。改为:**过真 vue-i18n 渲染 + `toBe` 钉死完整插值结果**,两档各一条。
  例:`t('aiKbFdSummary', { n: 3, query: '甲状腺' })` 的 zh 必须逐字等于
  `为「甲状腺」找到 3 段相关内容，按相似度排序`;en 必须逐字等于
  `Found 3 matching sections for "thyroid", ranked by similarity`。
- **E-45 本身也落成一条活断言**(不是注释里的声明):`t('aiKbFdSummary', { n: 3 })`(**故意不传 `query`**)
  的结果必须是 `为「」找到 3 段相关内容，按相似度排序` —— 即**空串替换**。
  🔴 探针 3(§6)实测证明:同一处若写 `not.toContain('{query}')` 会**保持绿**,而本条写法**报红**。

### (c) 「exactly N keys」防漂移

- `expect(p5eTask1Keys.length).toBe(54)` + 三条词干计数(37/16/1)。
- 🔴 **附录 §A.4-2(c) 与 brief 对 N 的口径不同**(附录算到 1648 = 全表;brief 写「N = 你实测的本批键数」)
  —— 处置见 §9 顾虑 1:**两个都做了**,全表那个做成**下限**(理由同 D-3,避免亲手重建刚被 D-3 拆掉的跨期陷阱)。
- 另沿用 P5b 评审 I-1 的加固:**「本批 54 键在两档都作为 string 存在」**(长度断言只钉本文件里的字面量数组,
  不看语言包);并**新增一条**「本批依赖的 9 个复用键仍存在于两档」——
  防将来有人清理笔记区/仪表盘时把 `aiKbTry` 之类删掉、静默清空搜索区界面。

---

## 5. DoD-4 —— 🔴 自己重跑的双向撞车扫描(假定协调者的表不完整)

方法:真实模块导入两档 → 对本批 **63** 个键 × **全表 1648** 键做双向比对
(方向 1 = zh 撞车看 en 是否不同;方向 2 = en 撞车看 zh 是否不同;并单列「两轴都撞」)。
脚本 = scratchpad 的 `collide.mjs`(**不入库**,逻辑已固化成测试内的常驻断言,见 §5.3)。

### 5.1 方向 1(§9.2)zh 撞车 / en 不同 —— **3 对**

| 本批键 | zh | 撞车键 | en 差异 |
|---|---|---|---|
| `aiKbSrAdvOn` | 启用 | `aiSkEnable` | `Enabled` ≠ `Enable` |
| `aiKbSrRelMid` | 中 | `appsSettingsCpuMedium` | `Mid` ≠ `Medium` |
| `aiKbSrRelMid` | 中 | `aiThinkingMedium` | `Mid` ≠ `Medium` |

### 5.2 方向 2(§9.3)en 撞车 / zh 不同 —— **2 对**

| 本批键 | en | 撞车键 | zh 差异 |
|---|---|---|---|
| `aiKbSrAdvOn` | Enabled | `aiCfgChannelsEnabled` | 启用 ≠ 已启用 |
| `aiKbSrAdvanced` | Advanced | `appsSettingsSectionAdvanced` | 高级筛选 ≠ 高级 |

### 5.3 两轴都撞 —— **26 对 / 12 组**(无可断言的分歧轴)

`aiKbFdCopied`↔{`filesShareCopied`,`aiCopied`} · `aiKbFdCopyFailed`↔`aiCfgCopyFailed` ·
`aiKbFdDownload`↔{`filesDownload`,`filesCtxDownload`,`aiResDownload`} · `aiKbSrAdvOn`↔`aiCfgEnabled` ·
`aiKbSrCountMatches`↔`aiMatchesLabel` · `aiKbSrErrorTitle`↔`aiCfgSearchFailed` ·
`aiKbSrRelHigh`↔{`appsSettingsCpuHigh`,`aiThinkingHigh`} · `aiKbSrRelLow`↔{`appsSettingsCpuLow`,`aiThinkingLow`} ·
`aiKbSrSimilarity`↔`aiSimilarity` · `aiKbSrUntitled`↔`aiUntitled` ·
`aiKbClose`↔7 个(`filesViewerClose`/`filesUploadClose`/`searchClose`/`aiCfgClose`/`aiLightboxClose`/`aiMentionKbdClose`/`aiSlashKbdClose`)·
`aiKbSearch`↔4 个(`topbarSearch`/`aiCfgSearch`/`aiCfgSearchBtn`/`aiKbNavSearch`)。

**这 12 组两轴同值 ⇒ 任何断言都无法区分「用对了键」和「用错了键」**(改成撞车键渲染结果一模一样)。
⇒ **本刀不为它们编造零判别力断言**;真正的守卫落在 **T6/T7 的组件侧**:那两刀必须断言组件用的是
`aiKb*` 键(选择器/调用形状感知的 grep,不是裸子串)。**此处显式交接给 T6/T7。**

### 5.4 落成常驻断言的部分

- §5.1+§5.2 的 **5 对**,每对一条用例,断言在**必须分歧的那一轴**上(zh-only 断言 = 零判别力,承 P5c-T6 的 I-1)。
- 🔴 **另加一条「把扫描结果本身钉住」的用例**:测试内对 54 键 × 全表重跑双向扫描,要求「一轴撞车一轴分歧」的
  对集**恰好等于**上面 5 对。⇒ 将来别处新增一个与本批一轴同值的键时,**必须按 A-1/N21 登记**,而不是静默出现。

### 5.5 🔴 复核结论:协调者点名的 14 个高危值,本刀独立复扫**未发现新撞车对**

**这是本期与 P5c(连续三刀)/ P5d(一刀)不同的地方 —— 那几刀每刀都扫出协调者不知道的对,本刀没有。**
逐值实测(独立于 §5.1-5.3 的成对循环,另写一段按值反查,防循环本身有 bug):

| 值 | 本批键 | 撞车键 |
|---|---|---|
| Download | `aiKbFdDownload` | 3 个,两轴 |
| Close | `aiKbClose` | 7 个,两轴 |
| **Modified** | `aiKbSrModified`(修改时间) | **(none)** |
| Search | `aiKbSearch` | 4 个,两轴 |
| **Results** | `aiKbFdResults`(结果列表) | **(none)** |
| Copied | `aiKbFdCopied` | 2 个,两轴 |
| High | `aiKbSrRelHigh` | 2 个,两轴 |
| **Mid** | `aiKbSrRelMid` | 2 个,**仅 zh 轴**(en `Medium`≠`Mid`) |
| Low | `aiKbSrRelLow` | 2 个,两轴 |
| Similarity | `aiKbSrSimilarity` | 1 个,两轴 |
| **files** | `aiKbSrCountFiles`(个文件) | **(none)** |
| matches | `aiKbSrCountMatches` | 1 个,两轴 |
| **Advanced** | `aiKbSrAdvanced` | 1 个,**仅 en 轴**(zh 高级筛选≠高级) |
| Enabled | `aiKbSrAdvOn` | 3 个(1 两轴 + 1 仅 zh + 1 仅 en) |
| **Fast** | `aiKbSrQualityFast`(快) | **(none)** |

⇒ 与附录 §A.1.2 **逐条吻合、零新增**;并顺手查明 **14 个点名值里有 4 个(`Modified`/`Results`/`files`/`Fast`)
在当前全表里根本没有同值键** —— 点名表偏保守,无害,**不判勘误**(承 R4/E-53 的口径:不升级 finding)。

### 5.6 🔴 `High`/`Mid`/`Low` —— 最高危那三条的处置

三条一律**新建**(`aiKbSrRelHigh` / `aiKbSrRelMid` / `aiKbSrRelLow`),**拒绝复用**
`appsSettingsCpu*`(应用区 CPU 档)与 `aiThinking*`(Agent 思考强度档)。
理由逐字同 **A-1**:**键名语义属于别的区,将来那个区改文案会静默改掉搜索区**;
且 `relLabel()` 在 util 里走 `i18n.global.t` ⇒ **键选错会让 `SearchView` 与 `FileDetailDrawer` 同时静默错**。
`Mid` 这条更硬:`aiThinkingMedium` / `appsSettingsCpuMedium` 的 **en 是 `Medium` ≠ `Mid`**,复用会**直接改掉英文界面文案**
—— 已落成探针 4 的报红对象(§6)。
其余高危诱惑(`filesViewerDownload*` / `filesViewerLoading` / `photosSearch*` / `searchDialog*`)**一个都没复用**:
本批 54 个新键全部 `aiKb*` 前缀,9 个复用键全部在 `aiKb*` 家族内且经 §A.1.1 逐条语义核准。

---

## 6. RED 探针 —— 5 个,全部报红,全部逐字节还原

**协议**(§9.5 / brief §0):`cp` 存副本 → 行首锚定注入 → **先证注入落盘** → 跑测试 → 副本覆盖 → `md5sum` 逐字节比对。
🔴 **全程禁用 `git checkout/restore/stash`。** 基线 md5(`/tmp/p5e-t1-bak/BASELINE.md5`):

```
9970eb90e3cb278dcbe0e718eb0742bf  src/i18n/zh_cn.ts
a71c8de0606d315e4ed53ec04d4815b2  src/i18n/en_us.ts
a68d12f90056862bee98854d38a85541  src/ai/knowledge/views/SettingsView.test.ts
d956cad407e6fc6b5e4767103e3abdae  src/i18n/messageSyntax.test.ts
708ef9af156c8de76fd1f976ff499f4a  src/ai/views/SettingsPage.vue
```

⚠️ `messageSyntax.test.ts` 与 `SettingsPage.vue` 在探针之后又各有一次**有意的**内容调整(§9 顾虑 2 / D-9 的 grep 口径),
所以这两行的 md5 与最终提交不同;**三个被注入过的文件(`zh_cn.ts` / `en_us.ts` / `SettingsView.test.ts`)
每次探针后都 `md5sum -c` 全 OK**,即注入零残留。

### 探针 1(D-3 强制项)—— zh 档删 3 个键 ⇒ 下限断言必须报红

注入落盘证明:`grep -cE '^  (aiKbSrTopK|aiKbSrQuality|aiKbSrFileType):' src/i18n/zh_cn.ts` → **0**;
删掉的三行原文:`aiKbSrTopK: '返回数量',` / `aiKbSrQuality: '排序质量',` / `aiKbSrFileType: '文件类型',`;
真实模块导入现测 zh = **1645**。

```
 FAIL  src/ai/knowledge/views/SettingsView.test.ts > SettingsView/T9 —— §9.2/§9.3 双向同族扫描:本刀余零对 > 本刀 29 个键在两档都存在(...)
AssertionError: expected 1645 to be greater than or equal to 1648
    1895|     expect(Object.keys(zh).length).toBeGreaterThanOrEqual(1648)
    1896|     expect(Object.keys(en).length).toBeGreaterThanOrEqual(1648)
 Test Files  1 failed (1)
      Tests  1 failed | 112 passed (113)
```

还原:`cp /tmp/p5e-t1-bak/zh_cn.ts src/i18n/zh_cn.ts` → `md5sum -c` → **5/5 OK**。
⇒ **下限方向仍有牙**(防批量误删这个唯一价值被完整保留)。

### 探针 2 —— `aiKbFdCopyFailed` 的半角逗号改成全角 ⇒ 3 条 vitest + verify 脚本报红

注入落盘:`1902:  aiKbFdCopyFailed: '复制失败，请手动选择',`

```
AssertionError: Found full-width ，；：？！（） in P5e Task 1 zh_cn values ...
aiKbFdCopyFailed = "复制失败，请手动选择"
AssertionError: expected '复制失败，请手动选择' to be '复制失败,请手动选择' // Object.is equality
AssertionError: expected [ …(6) ] to deeply equal [ …(5) ]      ← 例外清单反推用例
      Tests  3 failed | 84 passed (87)
--- verify 脚本 ---
MISMATCH  aiKbFdCopyFailed  —  codepoint diff vs Vue2 source "Copy failed — please select manually"
SUMMARY (PART 1 ...): 53/54 MATCH
RESULT: FAIL
```

还原 → `md5sum -c` 5/5 OK。**这正是 P5a-T8 那一类错误,现在有三层同时报红。**

### 探针 3 —— en 单档把 `{query}` 改名 `{q}` ⇒ 3 条报红,并实证 E-45

注入落盘:`1892:  aiKbFdSummary: 'Found {n} matching sections for "{q}", ranked by similarity',`

```
AssertionError: expected 'Found {n} matching sections for "{q}"…' to be 'Found {n} matching sections for "{que…'
AssertionError: Found mismatched {…} placeholder names between locales:
AssertionError: expected 'Found 3 matching sections for "", ran…' to be 'Found 3 matching sections for "thyroi…'
      Tests  3 failed | 84 passed (87)
```

🔴 **第三条的 `Received` 是 `Found 3 matching sections for "", ranked by similarity`** ——
**渲染结果里既没有 `{query}` 也没有 `thyroid`,只有一个空串**。
⇒ 若按 E-45 警告的错写法写成 `not.toContain('{query}')`,**这条会保持绿**。这是本刀那组「真插值 `toBe`」断言的存在理由的直接实证。
还原 → `md5sum -c` 5/5 OK。

### 探针 4 —— `aiKbSrRelMid.en` 由 `Mid` 改成 `Medium`(= 复用 `aiThinkingMedium` 会渲染出的值)⇒ 撞车守卫报红

注入落盘:`1927:  aiKbSrRelMid: 'Medium',`

```
AssertionError: aiKbSrRelMid.en must differ from appsSettingsCpuMedium.en: expected 'Medium' not to be 'Medium'
AssertionError: aiKbSrRelMid.en must differ from aiThinkingMedium.en: expected 'Medium' not to be 'Medium'
AssertionError: expected [ …(3) ] to deeply equal [ …(5) ]     ← 扫描结果集合被钉住的那条
      Tests  3 failed | 84 passed (87)
```

还原 → OK。⇒ §5.6 的「最高危复用」有真牙。

### 探针 5 —— **两档同时**删 `aiKbFdDownload`(`parity.test.ts` 仍会绿)⇒ 存在性守卫报红

注入落盘:`grep -c '^  aiKbFdDownload:'` → zh **0** / en **0**

```
AssertionError: expected [ 'aiKbFdDownload' ] to deeply equal []      ← 「本批键在两档都存在」
AssertionError: expected 1647 to be greater than or equal to 1648     ← 全表下限
      Tests  2 failed | 89 passed (91)
```

还原 → OK。⇒ 承 P5b 评审 I-1:**两档同删会让 `parity.test.ts` 保持绿**,必须有独立的存在性守卫。

---

## 7. DoD-5 / DoD-6 —— D-3 与 D-9 落地 + 越权自证

### 7.1 D-3(§0.1)

`src/ai/knowledge/views/SettingsView.test.ts` **完整 diff**(`git diff -U3`,逐行自证「其余一字未动」):

```diff
@@ -1884,8 +1884,16 @@ describe('SettingsView/T9 —— §9.2/§9.3 双向同族扫描:本刀余零对'
     // 依据协调者裁定 R15 / E-43(该快照与本用例被测对象——T9 自己的 29 个键——无关,
     // 只是恰好嵌在同一条用例里,每个后续加键的期都会撞上它一次;D-3 已挂账交 P5e 拍板
     // 是否改成下限断言,本次只订正数字,不重构这条守卫)。
-    expect(Object.keys(zh)).toHaveLength(1595)
-    expect(Object.keys(en)).toHaveLength(1595)
+    // P5c-T9 引入快照 → P5d-T1 订正 1503→1595(裁定 R15 / 勘误 E-43)→ P5e 依据治理 §0.1
+    // (债务票 D-3)改为下限断言。原两行:
+    //   expect(Object.keys(zh)).toHaveLength(1595)
+    //   expect(Object.keys(en)).toHaveLength(1595)
+    // 精确的键集一致性由 src/i18n/parity.test.ts 守(它断言 zh/en 键集完全相等,比「两个数字
+    // 相等」强);快照唯一多出的价值是「键总数不会下降」(防批量误删),下限断言恰好只保留
+    // 这个价值,同时让「每个加键的期都红在一个与该期毫不相干的文件里」的跨期陷阱永久归零。
+    // 下限值 = P5e Task 1 落地后的实测值(真实模块导入,治理 §9.3 第 2 条:文本解析会少算)。
+    expect(Object.keys(zh).length).toBeGreaterThanOrEqual(1648)
+    expect(Object.keys(en).length).toBeGreaterThanOrEqual(1648)
   })
```

- **这就是该文件的全部 diff**(`git diff --stat` = `12 +-`,即 −2/+10;**该文件其余每一行一字未动**)。
- 改的是 `:1887-1888` 两行 + 紧邻注释,**留在原地**(未挪去 `parity.test.ts`、未删)。
- ① 旧两行**留成注释** ✅;注释里**只引条目编号**(P5c-T9 / P5d-T1 / 裁定 R15 / 勘误 E-43 / 治理 §0.1 / 债务票 D-3),
  🔴 **零 `file:line`**(唯一提到的路径是 `src/i18n/parity.test.ts`,那是**文件名不是行号**,不会随改动失效)。
  P5d 留下的那段旧注释**未动**(它记录的是 P5d 当时的处置,属历史;守「反转不删」)。
- ② RED 探针见 §6 探针 1 ✅ ③ 越权自证如上 ✅
- ⚠️ `:1855` 的 describe 上方注释里有一句「全表(真实模块导入,1595 键 —— 订正历史见下方断言处的注释)」,
  **本刀未改**(它已把读者指向断言处,而断言处现在写清了 1595→下限的来历)。**这是有意不动,不是漏改。**

### 7.2 D-9(§0.2)

- ① 两档**各删 1 行**(`zh_cn.ts:629` / `en_us.ts:620`),`parity.test.ts` **仍绿** ✅
  diff 里两档各只有这一处删除:`-  aiCfgKnowledgeSoon: '知识库详情页将在后续阶段开启',` /
  `-  aiCfgKnowledgeSoon: 'The knowledge details page will be enabled in a later phase',`
- ② `SettingsPage.vue:187` 的注释**补了一句**(注释本身未删,`function onDetailsClick(){...}` 那三行原文完整保留):

```diff
 //   function onDetailsClick() {
 //     toast.show(t('aiCfgKnowledgeSoon'))
 //   }
+// 该键已于 P5e 依治理 §0.2(裁定 D-9)从 zh_cn.ts / en_us.ts 删除(零生产消费点;
+// 决策历史留在本注释里,本注释不删)。
 // `DEFERRED_SECTIONS` 占位机制本身不受影响,不许碰 —— 它在 `onSelect()` 里的
```

  **这就是该文件的全部 diff**(+2 行注释,零代码行)。
- ③ 自证:

```
$ grep -rnw aiCfgKnowledgeSoon src/
src/ai/views/SettingsPage.vue:187://     toast.show(t('aiCfgKnowledgeSoon'))
hits=1
```

  ⇒ **只命中那条注释** ✅(取舍说明见 §9 顾虑 2)。

---

## 8. 三门完整终值(全量,输出完整落盘,零 `| tail`)

| 门 | 命令 | exit | 终值 | 日志 |
|---|---|---|---|---|
| 测试 | `pnpm test` | **0** | **`Test Files  331 passed (331)`** / **`Tests  3984 passed (3984)`** | `/tmp/p5e-t1-test.log` |
| 类型 | `pnpm exec vue-tsc --noEmit` | **0** | 零输出(0 行) | `/tmp/p5e-t1-tsc.log` |
| 构建 | `pnpm build` | **0** | `✓ built in 13.51s` | `/tmp/p5e-t1-build.log` |

- **红项:0 条**(`grep -E '✕|Failed Tests|FAIL ' /tmp/p5e-t1-test.log` → 零输出)。
  **两条已知噪声(`persist.test.ts` 的 IndexedDB flaky · `AgentComposer.test.ts` 的 vue-i18n teardown 竞态)本次都没红**,未复跑、未碰。
- 对账起点基线(R4 §四 / T0 自测):`331 / 3958 / 0 / 0` → 本刀 **331 / 3984**:
  **测试文件数 +0**(未新建测试文件)· **用例数 +26**(全部在 `messageSyntax.test.ts`),算式干净。
- 🔴 **本刀不新增 `.vue`**,实测 `.vue` 总数仍 **182**、`color-guard` 用例数仍 **184**(§8.1 算式吻合)。
- 数用例条数时用 `--reporter=verbose`(`/tmp/p5e-t1-i18n-verbose.log`),确认 26 条独立用例真在执行、**无 skip/todo、
  通过用例的 stderr 里无 `[Vue warn]`**(承记忆 `vitest-reporter-hides-warnings`;
  且本刀测试**未另建 `createI18n` 全局安装**,只在用例内 `createI18n({legacy:false})` 取 `.global.t`,与既有块同款)。

---

## 9. 顾虑 / 已申报的口径抉择(**2 条,均非缺陷,但请协调者过目**)

### 顾虑 1 —— (c)「exactly N keys」的 N:附录说全表 1648,brief 说本批 54。**两个都做了,全表那个做成下限**

- **冲突原文**:附录 §A.4-2(c)「N 由 T1 自己用真实模块导入现测(起点 1595,本批 +54,§0.2 又 −1 → **预期 1648**)」
  = **全表**;而同节标题写「`messageSyntax.test.ts` **只圈本批键**」;brief DoD-3(c) 写「**N = 你实测的本批键数**」;
  本文件既有四期先例(P3b/P5a/P5b/P5c/P5d)一律是「covers exactly the N keys this task added」= **本批**。
- **处置**:(i) 本批口径落成 `toBe(54)` + 三条词干计数(照先例 + brief);
  (ii) 全表口径落成 **`toBeGreaterThanOrEqual(1648)`**(实测值),**不写成精确 1648**。
- **为什么不写精确**:同一份治理的 §0.1(D-3)刚刚认定「全表精确键数快照是跨期陷阱,每个加键的期都会红在
  一个与该期毫不相干的文件里」并据此把 `SettingsView.test.ts` 的精确断言改成下限。**在 `messageSyntax.test.ts` 里
  新写一个精确 1648,等于亲手把刚拆掉的陷阱重建在另一个文件里。** 下限完整保留了附录想要的「防批量误删 / 防漂移」价值。
- **风险**:若协调者本意确实是精确 1648,改回是一行的事(且探针 5 已证明下限在下降方向有牙)。**请裁定。**

### 顾虑 2 —— D-9 的 grep 口径 vs 「防复活守卫」:选了**服从 grep 口径**,放弃那条守卫

- 我一度写了一条 `it('aiCfgKnowledgeSoon stays deleted from both locales')`(断言两档都 `in === false`),
  防将来 merge 静默复活一个零消费键。
- 但它会让 `grep -rw aiCfgKnowledgeSoon src/` 多出 5 处命中,**与 §0.2 ③ 和 brief DoD-6 明写的
  「改后只命中那条注释」直接冲突**。
- **处置:删掉那条守卫**,并把相关注释改写成「the aiCfg* knowledge-details placeholder key」**不写字面键名**,
  使 grep 严格 = 1 命中(§7.2 已贴)。
- **代价(显式记账)**:两档同时重新加回该键**不会有任何守卫报红**(`parity.test.ts` 只比两档相等;
  全表下限只防减少)。**若协调者认为该防复活守卫更值,请裁定放宽 grep 口径为「只命中那条注释 + 断言其不存在的守卫」,
  我可以一行加回。** 未经裁定我不自行拍板(承 R16 / §10 申报纪律)。

---

## 10. 命中的治理条目逐条显式申报

### K1–K52(§3 已授权偏离)—— **本刀命中 0 条**

逐条核过与 i18n 相关的:**K42**(P5d 的 relativeTime 键不许复用 `aiKbMinAgo` 家族)是 P5d 的条目,
本批无 relativeTime 键;**K50/K52**(`/v3/file` 取字节)属 T7;**K46/K48**(viewer/scss)属 T2/T5/T7。
⇒ **本刀零偏离申报**:附录 A 把 63 个键名与值全部定死,我没有任何自选空间,也没有任何未申报的加工。

### N1–N45(§3.5 照抄不改)—— **本刀命中 3 条,均确实照抄**

| # | 条目 | 本刀怎么照抄的 |
|---|---|---|
| **N33** | `SAMPLE_QUERIES` 的 5 个查询词过 `$t(s)` ⇒ 进 i18n | 5 个词**复用 P5a 已有的 `aiKbSample*`**(§A.1.1 逐条语义核准:蓝本 `DashboardView:96` 与 `SearchView:192` 各写一份同值常量,P5a 已做成 5 个键)。值一字未改 |
| **N21**(同族) | Vue2 自带的撞车/误译一律照抄,不许「统一整理」 | 12 组两轴同值(§5.3)照抄不动;`aiKbFdCopyFailed` 的**半角逗号**照抄(不改全角)并落成码点断言;`aiKbSrAdvanced` 的 zh 是「高级筛选」而 `appsSettingsSectionAdvanced` 是「高级」,两个键并存 |
| **N32**(同族) | 撞车必须断在「会分歧的那一轴」 | §5.4 的 5 条断言全部断在分歧轴上;两轴同值的 12 组**不编造断言**,显式交接 T6/T7 |

### 附录 / 裁定条目

- **R10 / E-31 / E-44**(en 权威源 = `en_US.json` 覆盖值,脚本不许假设 en=key)—— §3.1,PART 4 程序化证明。
- **E-45**(vue-i18n 未匹配占位符静默置空)—— §4(b),落成活断言 + 探针 3 实证。
- **E-53 / R4**(461 vs 408/462)—— 🔴 **本刀一行都没去追**(裁定明写「不许任何一刀再去追 461」),
  i18n 依据只用附录的 **63 distinct** 终值。
- **M-4**(附录 §A.0 那条 bash 跑 466 是去重口径瑕疵)—— **未据 466 做任何 i18n 计算**;本刀的键集来自附录 §A.1 两张表 + 我自己的 63 行映射。
- **§0.1 / D-3 · §0.2 / D-9** —— §7。**§0.3(D-5/D-7 转独立票)** —— `color-guard.test.ts` 一行未动。
- **§9.10 守卫只许加固不许放宽** —— 本刀**未修改任何既有断言的判据或范围**,唯一改的既有断言是 D-3 那两行,
  而它是**治理明令**的改动,且已用探针 1 证明「下降方向仍报红」。新增的 en 侧同扫 / 反推清单 / 存在性 / 撞车集合
  四类断言**全部是净加固**。
- **§9.14-4 参数化守卫防空循环** —— 26 条用例在 `--reporter=verbose` 里逐条见于 passed 列表(§8)。
- **§14 依赖纪律** —— 零新依赖,`package.json` / `pnpm-lock.yaml` 零改动,**未碰 `:5288` / `:5273` / `:5277` / `:5299` 任何 dev server**。
- **§13-2 计数保质期** —— §2.3 已写「数字会漂,以现测为准」+ 取数命令。

### fixture 与 mock

**本刀零 fixture 依赖、零 mock**(R3 明写「T1 / T2 不受 `.REPLAYED` 前置条件影响,可立即开工」)。
唯一的外部数据源是 `git show 7a6ee6b7:src/assets/lang/{zh_CN,en_US}.json`(**真权威源,`.REAL` 级**)。

---

## 11. Vue2 `file:line` → New-UI 对照(键的消费点,供 T6/T7 接线)

本刀只落语言包,**不落任何组件**。键与蓝本消费点的对照关系已由附录 A 的「用处」列定死
(SV = `SearchView.vue` / FD = `FileDetailDrawer.vue` / FV = `KFileViewer.vue` / AGG = `searchAggregate.js`),
其中 T6/T7 最容易接错的三处已写进两档块头注释:

- `aiKbFdDownload` **一个键两处消费**(`FileDetailDrawer` 与 `KFileViewer:19` 的「下载」按钮),
  **不为 KFileViewer 再造 `aiKbFvDownload`**(§A.7)。
- `aiKbSrRelHigh/Mid/Low` 由 **util 里的 `relLabel()` 经 `i18n.global.t` 消费**,两个组件共用。
- `aiKbSrUntitled` 由 **`searchAggregate` 的 `i18n.t('(Untitled)')`** 消费(不是组件模板)。

**D-4 口径(本期照 P5a–P5d 既定全仓模式,不在本期反转)**:
54 条新键里,**54 条**都有「存在性 + 两档 string」断言;在此之上另有:
**5 条**被 `toBe` 钉死确切 zh 值(全角例外)· **7 条**被码点级断言覆盖特殊字符 · **6 条**有真插值 `toBe`(zh/en 各一)·
**3 条**有撞车分歧轴断言 · **54/54** 由一次性 verify 脚本逐码点比对权威源。
⇒ 并集实测 **16** 条(程序化算的,不是估的):
`aiKbFdCopyFailed aiKbFdPage aiKbFdSection aiKbFdSummary aiKbSrAdvOn aiKbSrAdvanced aiKbSrEmptySub
aiKbSrEmptyTipAllowlist aiKbSrIdleSub aiKbSrMatchPill aiKbSrMatchTitle aiKbSrMoreHint aiKbSrNoPreviewToast
aiKbSrPlaceholder aiKbSrRelMid aiKbSrRerankWarn`
⇒ **「在 vitest 里只有存在性断言」的键 = 54 − 16 = 38 条**,与 P5a–P5d 同一模式,**未开第二套**。
(注:这 38 条并非「无值校验」—— 它们的值由 verify 脚本 54/54 逐码点比对权威源,只是那一层是一次性脚本、不是常驻 vitest。)

---

## 11.5 🔴 并发 agent 的提交 `973a9b8`(T0b 整改)与本刀的关系 —— 已核,零影响

开工时 HEAD = `a3f5187`;提交时发现并发 agent 已把 T0b 整改**提交**成 `973a9b8`(brief 说它「不提交」,
**实际提交了** —— 这里只记事实,不判缺陷),本刀的提交落在它之上。它动了 **Appendix A**,所以我逐条核过:

| 核查 | 结果 |
|---|---|
| §A.1 两张表的 **63 个 key/值行**是否被改 | 🔴 **一行未改**(`git diff a3f5187 HEAD -- <appendix>` 里筛「`\| 数字 \|`」开头的行 → **零命中**)⇒ 我落盘的 63 个值仍与现行附录一致 |
| 它改了什么 | 只有 **§A.0 的 E-53 段(散文,按裁定 R4 把「上级设计是对的」改成「差异原因未查明、不判勘误」)· §A.8/§A.9 的复现命令与保质期提示**。**其中 §A.8 新加的一句就是「T1 落地后已变成 1648 / 1648(1595 + 54 − 1)」,与本刀实测一致** |
| 我的 verify 脚本把附录 pin 在 `a3f5187` 会不会过期 | **不会**:临时把 `APPENDIX_SHA` 改成 `HEAD` 重跑 → **PART 3 仍 63/63 MATCH · RESULT: PASS**;随后 `cp` 还原,`md5sum` 一致(`2d8f71a0e08c9d66d09fb76396b9d9a6`)、`git status` 干净。**保留 pin 是有意的**:并发会话仍在改 `.superpowers/sdd/`,读工作树会让脚本将来无故报红 |
| 我有没有碰它的东西 | **没有**。`git show --stat HEAD` 里零个 `p5e-fixtures/**`、零个附录文件 |
| E-53 / 461 | 🔴 **本刀一行都没去追**(裁定明令),与它的订正方向一致 |

## 12. 收尾状态

- 一个语义提交,**只列自己改的 7 个文件路径**(禁 `git add -A`);台账/脚本/报告一律 `git add -f`(`.gitignore:6`)。
- 🔴 **未提交、未还原、未报错任何 `p5e-fixtures/**` 与三份附录的改动** —— 那是并发 agent 的工作面(brief §0)。
- 临时用例 `p5e-dump.test.ts` 跑完即删,**未提交**;scratchpad 的 `gen-block.mjs` / `collide.mjs` / `named14.mjs` / `scan-punct-ph.mjs`
  **不入库**(逻辑已固化进 verify 脚本与常驻测试)。
