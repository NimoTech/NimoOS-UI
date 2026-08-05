# P5f Task 1 独立评审报告

- **被评审提交**:`e9cea74`(起点 `8289a1a`),分支 `sp8-ai`
- **评审日期**:2026-08-06
- **评审纪律**:治理 §11-7「评审须自读源文件、自己 grep、自做 RED 探针,不许采信实现者报告」——
  本报告**每一条结论都是评审自己跑出来的**,T1 报告只用来定位「要验什么」,一个数字都没有直接采信。
- **探针纪律**:全部 `cp` 备份 → 注入 → 证明落盘 → 跑 → `cp` 还原 → `md5sum` 逐字节比对。
  **全程零 `git checkout` / `git restore` / `git stash` / `git reset` / `--amend`。**
  终局 `git status --short` 为空,三个被探针碰过的文件 md5 与基线逐字节一致(见 §6)。

## 结论

| 级别 | 条数 |
|---|---|
| **Critical** | **0** |
| **Important** | **1** |
| **Minor** | **4** |

**可以进 T1b。** 产品侧(两档 locale)与守卫侧都经得起独立复核:79 个新键与蓝本**逐码点双射**、
双向撞车扫描**独立复现完全一致**、8 个 RED 探针全部按预期报红/放行。
唯一的 Important 是**报告里的一个统计数错了 9 条**(D-4 口径),**零代码影响、方向是低估自己的覆盖**,
但按裁定 **R24**「算术叙述错会让下一刀误判基线」必须订正。

---

## 0. 评审自建的独立工具链(不复用 T1 的脚本)

T1 的 `p5f-task-1-i18n-verify.mjs` 用 `new Function` 切对象字面量来读 locale;
本评审**另起一套**:`esbuild` bundle `src/i18n/*.ts` → 写临时 `.mjs` → `await import()`,
即**真实模块导入**(治理 §7.1 明令「用真实模块导入计键数,文本解析会少算」)。

蓝本一律 `git show 7a6ee6b7:...`(**从未在 `../../NimoOS-UI` 里 checkout/stash/commit**)。

```
$ node audit/load.mjs               # 当前 HEAD
zh keys: 1727   en keys: 1727   aiKb* zh: 520   aiKb* en: 520

$ node audit/basecount.mjs          # git show 8289a1a:src/i18n/*.ts
zh_cn total 1648 aiKb* 441
en_us total 1648 aiKb* 441
```

---

## 1. 🔴 第一必查项(计划书 T1「评审第一必查项」)

### 1.1 三个新键各改坏一个字符 / 占位符名 → 证明有断言报红

**探针 1 —— 改坏一个字符**(`aiKbAlNoRules` 句尾 `。` U+3002 → `.` U+002E):

```
===== PROBE: P1_zh_char =====
PROBE1 injected: aiKbAlNoRules trailing U+3002 -> U+002E
--- injection landed (file differs from backup) ---
vitest exit=1
 × ... > P5f Task 1 aiKb* keys ... > pins the codepoint-level characters the full-width scan cannot see
AssertionError: expected '还没有规则。点右上角 [+ 添加规则] 开始.' to be '还没有规则。点右上角 [+ 添加规则] 开始。'
 Test Files  1 failed (1)      Tests  1 failed | 135 passed (136)
--- restore md5 check ---
4a4d4a9a85bccb4959e7aa165de34f08  .../src/i18n/zh_cn.ts     ← 与基线一致
```

**探针 2 —— 改坏 en 侧占位符名**(`aiKbAlNowIndexing` `{ext}` → `{e}`):

```
vitest exit=1   Tests  3 failed | 133 passed (136)
 × the placeholder-name set across this batch is exactly {ext, group, h, n, path, t}
     AssertionError: expected [ 'e', 'ext', 'group', 'h', 'n', …(2) ] to deeply equal [ 'ext', … ]
 × zh_cn and en_us use the same set of {…} placeholder names for each of these keys
 × E-45 … > aiKbAlNowIndexing interpolates {"ext":".log"} into the exact rendered string in both locales
     AssertionError: expected 'Now indexing ' to be 'Now indexing .log'
--- restore md5: 5602793e93d156b598d505ed634424ce = 基线 ---
```

**探针 3 —— 改坏 zh 侧占位符名**(`aiKbRtScanEvery` `{h}` → `{hh}`):

```
vitest exit=1   Tests  3 failed | 133 passed (136)
 × the placeholder-name set across this batch is exactly {ext, group, h, n, path, t}
 × zh_cn and en_us use the same set of {…} placeholder names for each of these keys
 × E-45 … > aiKbRtScanEvery interpolates {"h":6} …
     AssertionError: expected '每  小时扫描' to be '每 6 小时扫描'
--- restore md5: 4a4d4a9a85bccb4959e7aa165de34f08 = 基线 ---
```

🟢 **三个探针全部报红。** 尤其探针 2/3 的第三条失败 —— 断言拿到的是 `'Now indexing '` / `'每  小时扫描'`
(占位符被**静默置空**),**证明 E-45 那个「零判别力」的坑真的被绕开了**:
若按「渲染结果不含 `{ext}` 字面量」写,这两个探针会**全绿**。见 §4.1。

### 1.2 独立复跑双向撞车扫描 + 全表键数(**真实模块导入**)

自写 `audit/collide.mjs`,对 **79 个新键 × 全表 1727 键**双向扫:

```
--- 79 NEW keys (batch) x whole table: keys=79
    both-axes collision pairs: 27
    one-axis divergent pairs : 21
```

**21 对逐条与 T1 钉进测试的表比对 —— 完全一致,一条不多一条不少**(评审输出的 21 行 sorted 列表
与 `messageSyntax.test.ts` 的 `divergent` 数组逐字相同,含唯一那条 zh 单侧
`aiKbWkOpRemoved|addPanelRemovedToast|zh`)。

**全表键数**:1727 / 1727(zh/en),`aiKb*` 520 / 520;起点 1648 / 441。**Δ = +79 / +79。**

```
$ node audit/delta.mjs
zh_cn: added=79 removed=0 changed=0
en_us: added=79 removed=0 changed=0
added set identical: true      added count: 79
stem counts: Al= 35 Rt= 22 Wk= 20 stemless= 2
```
🟢 **零删除、零既有值被改动** —— 这同时是 §1.3「不许动别期的键」的程序化证据。

**「假定 T1 的表也不完整」(治理 §7.1)**:评审把扫描范围从 79 扩到 **90**(含 11 条复用键)重扫,
多出 3 对(`aiKbColAction` ↔ `aiKbColType` / `aiTypeLabel` / `filesColType`)——
**这 3 对全部是本刀之前就存在的**(两个键在 `8289a1a` 就都在表里),**不是本批新造**,
且附录 §A.3.1a 的 `Action` 行已完整登记。**⇒ 没有扫出 T1 漏掉的新撞车。**

**T1 自称的两项「附录没有的发现」,评审逐项复核:**

| T1 申报 | 评审复核 | 判定 |
|---|---|---|
| `Root deleted` ↔ `Removed` 是**本期内部第二对**撞车,附录只点名了 `enabled` ↔ `Root enabled` | 评审扫描确有 `aiKbRtRootDeleted|aiKbWkOpRemoved|en` 与其镜像;`grep` 附录 §A.3.1 / §A.3.1a / §A.2 三处,**两个方向都没有这一对** | 🟢 **属实,是真发现** |
| 4 条复用行的 both 撞车集合比附录登记的大 | 评审扫描复现(如 `Cancel` 的 both 集合含 `filesCancel` `startAppCancel` `appsCancel` `appsSettingsCancel` `aiCancel` `aiCfgCancel` `aiKbCancel`,附录只写 `aiKbCancel`) | 🟢 **属实**,风险确为低(每行只有一个 `aiKb*` 候选) |

### 1.3 🔴 D-3 / D-9 同族越权核查 —— `git diff 8289a1a e9cea74 -- src/` 逐行读

```
$ git diff --stat 8289a1a e9cea74
 .superpowers/sdd/p5f-task-1-i18n-verify.mjs | 603 ++++++
 .superpowers/sdd/p5f-task-1-report.md       | 488 ++++++
 src/i18n/en_us.ts                           |  96 +++++
 src/i18n/messageSyntax.test.ts              | 454 ++++++-
 src/i18n/zh_cn.ts                           | 100 +++++
```

- **`src/` 只碰了 3 个文件**,全部在治理 §1.1 的 🟢 允许列上(`zh_cn.ts` / `en_us.ts` /
  `messageSyntax.test.ts`)。**`color-guard.test.ts`、`knowledge.scss`、任何 `.vue`、
  `package.json` 一律零改动。**
- **两个 locale 文件:纯新增,零删除**(`git diff` 无 `-` 行;程序化 `removed=0 changed=0`)。
- **`messageSyntax.test.ts` 共 3 个 hunk、4 行删除**,`grep "^-"` 全文:

```
-    describe('P5e Task 1 §9.2/§9.3 bidirectional collision scan — the 5 one-axis-divergent pairs', () => {
-      it('covers exactly the 5 one-axis-divergent pairs found by this task's own scan', () => {
-        expect(divergent.length).toBe(5)
-      it('the scan over the whole table finds exactly these 5 one-axis-divergent pairs (…§7.1)', () => {
```

**4 行全部落在 P5e 那一处**(标题 ×3 + 计数 ×1),**没有任何一行触到 P5a/P5b/P5c/P5d 的键或断言**。
🟢 **无越权。** 这一处的性质裁断见 §2.a。

---

## 2. 🔴 对 T1 三条申报的独立裁断

### (a) §9.10:动了 P5e 已过评审的断言(5 → 6)—— **裁断:申报成立,确系纯加固**

§9.10 明令「被迫改上一刀已过评审的断言时,必须**程序化**证明是加固,**自我声明不算证明**」。
评审**不采信** T1 的四条论证,自己造了两个方向的判别力探针:

**探针 5 ——「这一项是不是必需的?」**(把新登记的那一对从表里删掉,计数改回 5):

```
===== PROBE: P5_9_10_remove_entry =====
vitest exit=1
 × P5e Task 1 … > the scan over the whole table finds exactly these 6 one-axis-divergent pairs (…§7.1)
AssertionError: expected [ …(6) ] to deeply equal [ …(5) ]
 Tests  1 failed | 134 passed (135)
--- restore md5: 6c48a8ee283f6632c18d3062fa642229 = 基线 ---
```
⇒ **P5e 那条守卫是被 `aiKbAlFileTypes` 真真切切逼红的**,登记不是可选动作。
**T1 没有「为了让测试变绿而放宽」,它是按守卫自己写明的用途(「a newly created one-axis
collision has to be **registered**」)执行了那个动作。**

**探针 6 ——「本该被抓的撞车,改后还抓不抓得到?」**(把 `aiKbAlFileTypes.en` 从
`'File types'` 改成 `'File type'`,即真的塌成 P5e 那个键):

```
===== PROBE: P6_9_10_real_collapse =====
vitest exit=1   Tests  4 failed | 132 passed (136)
 × P5e … > aiKbSrFileType must not collapse onto aiKbAlFileTypes on the en axis
     AssertionError: aiKbSrFileType.en must differ from aiKbAlFileTypes.en: expected 'File type' not to be 'File type'
 × P5e … > the scan over the whole table finds exactly these 6 …
     AssertionError: expected [ …(5) ] to deeply equal [ …(6) ]
 × P5f … > aiKbAlFileTypes must not collapse onto aiKbSrFileType on the en axis
 × P5f … > the scan over the whole table finds exactly these 21 …
     AssertionError: expected [ …(20) ] to deeply equal [ …(21) ]
--- restore md5: 5602793e93d156b598d505ed634424ce = 基线 ---
```
⇒ **新登记的那一项带着一条真断言**,而且**两侧(P5e 侧 + P5f 侧)各响一次**。
它不是记账条目。

**探针 7 ——「新出现的、没登记的一轴撞车会不会溜过去?」**
(把 `aiKbRtSubtitle.zh` 改成 `取消`,人为造出一对未登记的 zh 撞 / en 分歧):

```
===== PROBE: P7_unregistered_collision =====
vitest exit=1
 × P5f … > the scan over the whole table finds exactly these 21 one-axis-divergent pairs
AssertionError: expected [ …(28) ] to deeply equal [ …(21) ]
--- restore md5 = 基线 ---
```

**逐条核「有没有被改弱」:**

| 判据形态 | 改前 | 改后 | 结论 |
|---|---|---|---|
| 表项数 | 5 | 6(**+1**) | 只增 |
| 参数化真断言条数 | 5 | 6(**+1**,`--reporter=verbose` 实数,见 §4.4) | 只增 |
| 计数断言 | `toBe(5)` | `toBe(6)` | 仍是**精确 `toBe`**,没换成 `>=` / 长度 / 子集 |
| 全表重扫断言 | `expect(found.sort()).toEqual(...)` | **一字未改** | 仍是精确 `toEqual` |
| 既有 5 条表项 | — | **一字未改**(`git diff` 无相关删除行) | 未动 |

🟢 **裁断:申报(a)成立。这是「守卫按设计触发 → 登记」,是加固,不是放宽。**
且这与 D-3 那个跨期陷阱**不同族**:D-3 是「精确的全表键数」(与本期无关的键增长也会红),
这里是「本批键的撞车对集合」(本来就必须精确,否则新撞车静默溜走),
**红了的正确修法是登记,不是改数字** —— T1 的处置正确。

### (b) R18:全角扫描用全角正则而非 brief 字面的半角版 —— **裁断:申报成立,判据确实更强**

先坐实 brief 的字面(逐码点读 `p5f-common-constraints.md:413`):

```
0x2f /  0x5b [  0x2c ,  0x3b ;  0x3a :  0x3f ?  0x21 !  0x28 (  0x29 )  0x5d ]  0x2f /
```
⇒ brief 确实写的是**半角**,但标题叫「**全角**标点扫描」——**brief 自相矛盾**。

**两个正则在本批 79 条文案上各命中什么(评审实跑 `audit/r18.mjs`):**

```
HALF-WIDTH /[,;:?!()]/ (brief 字面)  zh_cn: 5/79 hits
     aiKbRtDeleteTitle   = "删除索引目录?"
     aiKbRtReadOnly      = "该目录只读——可改用镜像模式添加(wiki 数据存放在中央目录)。"
     aiKbRtScanInterval  = "扫描间隔(小时)"
     aiKbWkEmptySub      = "添加知识根后,Wiki 导航会自动从你的目录生成。"
     aiKbWkRenderNote    = "本页由 {path} 渲染,索引服务在目录变化后自动重写"
HALF-WIDTH /[,;:?!()]/ (brief 字面)  en_us: 8/79 hits
     aiKbAlAdvancedCustom / aiKbAlExampleHint / aiKbAlPathHint / aiKbAlPriorityFull /
     aiKbAlPriorityHint / aiKbRtDeleteHint / aiKbRtDeleteTitle / aiKbRtScanInterval

FULL-WIDTH /[，；：？！（）]/ (T1 采用)  zh_cn: 9/79 hits   ← 恰是 T1 钉死的 9 条例外
FULL-WIDTH /[，；：？！（）]/ (T1 采用)  en_us: 0/79 hits   ← 恰是 T1 断言的 0
```

**判一判「判据是不是真的更强」(R18 的要求):**

1. **半角版命中的那 5 条 zh,全部是蓝本原文里合法的半角字符**(半角逗号夹在中文句子里、
   半角问号、半角括号)—— 它们**必须原样保留**。半角版会把它们全体逼进例外清单 ⇒ **纯噪声**。
2. **半角版在 en 侧命中 8 条正常英文标点** ⇒ 又是 8 条纯噪声例外。
3. **半角版抓不到要防的那类错误**:本守卫存在的理由是 P5a-T8 的教训「附录零差异,
   **手抄进 TS 时引入 5 处全角标点错**」—— 即「把半角 `:` 顺手规整成全角 `：`」。
   规整后的值含 `：`,**不在半角字符类里** ⇒ 半角版**恒绿**。
   评审探针 8 用全角版实测**报红**:
   ```
   ===== PROBE: P8_fullwidth_scan =====   (aiKbRtSubtitle 加入全角 （）)
   × should not contain full-width ，；：？！（） in any zh_cn value from this batch …
   AssertionError: Found full-width ，；：？！（） in P5f Task 1 zh_cn values …
   ```
4. **本仓既定做法**:`grep` `messageSyntax.test.ts` 里全部 9 处 `fullWidthPunctuation = /…/`,
   **P5a/P5b/P5c/P5d/P5e 五刀全是全角** `0xff0c 0xff1b 0xff1a 0xff1f 0xff01 0xff08 0xff09`。
5. **附录 A §A.5 本身也写的是全角正则**,并且它列的 9 条例外与评审实扫的 9 条**逐条一致**。
6. **半角版真正该防的那 5 条,T1 另用码点级 `toBe` / `includes` 钉死了**(探针 1 报红)——
   **覆盖面严格大于任一单个正则**。

🟢 **裁断:申报(b)成立。brief §7(a) 的半角字面是笔误,应订正为 `/[，；：？！（）]/`。**

### (c) 附录 §A.6 复用判定列与 R3 相反 —— **裁断:申报成立;落地服从 R3;建议订正附录**

**落地是否服从 R3(权威序:裁定书 > 附录)**:

```
$ grep -n "^| [0-9]" p5f-appendix-A-i18n.md | grep -E "\| (Delete|Auto|Removed) \|"
265:| 50 | `Delete`  | Rt | 删除   | Delete  | 🟢 **可复用** `aiKbNtDelete` |
269:| 54 | `Auto`    | Rt | 自动   | Auto    | 🟢 **可复用** `aiKbOriginAuto` / `aiKbDeviceAuto` |
304:| 89 | `Removed` | Wk | 已删除 | Removed | 🟢 **可复用** `aiKbStatusRemoved` |
```
而 T1 **新建了** `aiKbRtDelete` / `aiKbRtWatchAuto` / `aiKbWkOpRemoved`(评审在 `zh_cn.ts` /
`en_us.ts` 的 marked block 里逐个确认存在),并保留 `aiKbNtDelete` / `aiKbOriginAuto` /
`aiKbDeviceAuto` / `aiKbStatusRemoved` 原样不动(`changed=0`)。
verify 脚本 PART 5 把这个**决定**钉成断言(评审自跑,输出 `OK aiKbRtDelete is its own key, not
aiKbNtDelete — aiKbNt* = Notes page; …` 共 4 行),PART 3 对三行打 `NOTE` 而非静默通过:

```
NOTE      aiKbRtDelete ("Delete") — appendix §A.6 says 可复用, ruling R3 overrides it to 新建 …
NOTE      aiKbRtWatchAuto ("Auto") — …
NOTE      aiKbWkOpRemoved ("Removed") — …
SUMMARY (PART 3): 90/90 MATCH against §A.6's own columns
```
🟢 **服从 R3,处置正确。**

**附录该不该订正 —— 建议:该,见 Minor-3。**

---

## 3. 🔴 逐条重算 T1 自报的数字(全部自己跑,零采信)

### 3.1 三门(全量、落盘、未 `| tail`)

```
$ npx vitest run                    → Test Files 335 passed (335)   Tests 4302 passed (4302)   EXIT=0
$ npx vue-tsc --noEmit              → EXIT=0(零输出)
$ npx vite build                    → ✓ built in 13.70s             EXIT=0
```
🟢 **335 / 4302 / 0 / 0 与 T1 一致。**

### 3.2 `+48` 的归因表自洽性(裁定 R24)

不能 checkout 起点,改用**执行计数**推导(`--reporter=verbose`,单文件跑):

```
$ npx vitest run src/i18n/messageSyntax.test.ts --reporter=verbose
Tests  136 passed (136)
$ grep -c "P5f Task 1 aiKb" msgsyntax_verbose.txt      → 47   （P5f 新块实际执行的用例数）
```
P5f 新块 **47** 条 + P5e 块因新登记一对而**多出 1** 条参数化 `it`(探针 5 删掉那一项后单文件降为
**135**,反证这一条确实是新增的)= **48**。
`4302 − 48 = 4254` ⇒ 🟢 **起点 4254 与 +48 归因自洽。**

### 3.3 键账

| 项 | T1 报 | 评审实测 | 判 |
|---|---|---|---|
| 复用 | 11 | 11(§A.2 的 14 减 R3 的 3) | 🟢 |
| 新增 | 79 | **79**(`added=79 removed=0 changed=0`,两档 added 集合相同) | 🟢 |
| Vue2 权威 zh 值 | 79/79 | **90/90**(含 11 复用行,见 §3.4) | 🟢 |
| 本期新造 | 0 | **0**(90 条蓝本源全部被覆盖,零 leftover) | 🟢 |
| 死键 | 0 | **0**(双射,无 leftover 亦无 over-consume) | 🟢 |
| 全表 1648 → 1727 | ✅ | **1648 → 1727**(真实模块导入) | 🟢 |
| `aiKb*` 441 → 520 | ✅ | **441 → 520** | 🟢 |
| 词干分布 | 35/22/20/2 | **Al=35 Rt=22 Wk=20 stemless=2** | 🟢 |
| **D-4 只有存在性断言** | **62/79** | 🔴 **53/79**(值级断言 **26** 条,非 17) | ❌ **见 Important-1** |

### 3.4 🔴 逐码点比对(程序化,非目视)—— 兼查「有没有自己译的」

评审**不用 T1 的手写映射表**,改走一条完全独立的取数路径:

1. 从蓝本三个 `.vue` 里正则抽出全部 `$t('…')` 字面量 → **83 条 distinct**;
2. 加上两处动态键源(`WikiView.vue` 的 `OP_LABEL_KEYS = {create:'Added', modify:'Updated',
   delete:'Removed', rename:'Renamed'}` + `AllowlistView` 的 3 个 `labelKey: Documents/Text/Code`)
   → 7 条,与静态集**零重叠** ⇒ **union = 90 distinct**(独立复现 R10 的「90 distinct」);
3. 每条源串去 `zh_CN.json` / `en_US.json` 取 `(zh, en)`;
4. 与本仓 90 个键(79 新 + 11 复用)的 `(zh, en)` 做**多重集双射**:

```
$ node audit/valuematch.mjs
batch size: 90
=== batch keys whose (zh,en) pair has NO byte-exact Vue2 source === 0
=== Vue2 sources not covered by any batch key === 0 []
```

**再证这个双射是唯一的(否则可能出现「键接错源串」而双射仍成立):**
```
$ node audit/misc.mjs
duplicate (zh,en) pairs among the 90 sources: 0 []
new keys sharing an identical (zh,en) pair: []
key-stem vs source-page mismatches: 0 []
```
🟢 **90 条源串两两不同值 ⇒ 双射唯一 ⇒ 每个键都绑在正确的蓝本源串上。**
🟢 **零「自己译的」**(P5d 的 C-1 那一类:任何自译值都不可能与 `zh_CN.json` 逐字节相等)。
🟢 **词干与来源页 100% 对得上**(`aiKbAl*` 只来自 `AllowlistView`,依此类推;
两个无词干键 `aiKbAdd` / `aiKbRescanStarted` 确实是**多页共用**,符合治理 §7 的词干规则)。

**顺带核「不进 i18n 的那两类」有没有被顺手加进去**(计划书点名的必查项):
```
A.4 literal "TREE" leaked as a value: no
A.4 literal ".log, .ini, .conf …" leaked as a value: no
A.4 literal "DATA / Backup / Media / any" leaked as a value: no
A.4 literal "/Downloads/*" leaked as a value: no
A.4 literal "/DATA" leaked as a value: no
values containing " →": []
```
⚠️ **`aiKbWkContents` / `aiKbWkRecentChanges` 看着像违规,实测不是。** 评审回读蓝本:
```
WikiView.vue:100  <span class="kw-sec-title">{{ $t('Contents') }}</span>       ← 过 $t(),必须进 i18n
WikiView.vue:101  <span class="kw-sec-en">Contents</span>                      ← 未过 $t(),不许进
WikiView.vue:122  <span class="kw-sec-title">{{ $t('Recent changes') }}</span> ← 过 $t()
WikiView.vue:123  <span class="kw-sec-en">Recent changes</span>                ← 未过 $t()
```
🟢 **T1 加的是 `:100`/`:122` 那一对,正确。** 🔴 **提醒 T7:`:101` / `:123` 的装饰 span
绝不许换成 `$t(aiKbWkContents)`** —— 两者在蓝本里就挨着,是本期最容易踩的一脚。

### 3.5 🔴 en 侧没有犯 E-44 —— **读脚本源码确认,不靠结果反推**

先坐实「结果反推为什么不行」:评审独立测得**本批 90/90 恰好 en === key**
(`en_US.json overrides (value != key): 0` 于这 90 条),⇒ 就算脚本写死用 key,结果也一样全对。

**读源码**(`p5f-task-1-i18n-verify.mjs:211-247`):
```js
export function vue2Json(file) {
  const raw = execFileSync('git', ['show', `${BLUEPRINT_SHA}:src/assets/lang/${file}`], …)
  return JSON.parse(raw)
}
…
const vue2En = enPack[english]   // R10: this — NOT `english` — is the en authority.
```
🟢 **确实从 `en_US.json` 取值,不是拿 key 冒充。**

**再跑它自带的 PART 4 反证**(把内存里 `en_US.json` 的一条改坏,要求必须报红):
```
$ node .superpowers/sdd/p5f-task-1-i18n-verify.mjs        EXIT=0
MISMATCH  aiKbWkTreeError — codepoint diff vs Vue2 source "Failed to load the wiki tree"
          [R10: en_US.json overrides … -> "Failed to load the wiki tree MUTATED-BY-PROBE"]
SUMMARY (PART 4 probe run …): 0/1 MATCH
PART 4 OK: the probe went RED as required → PART 1/2 really compare against en_US.json's value
```
**评审另核脚本引用的全局数**(自跑,不采信):
```
en_US.json entries: 2676   overrides(value!=key): 308     zh_CN.json entries: 2757
```
🟢 **`308/2676` 属实**,⇒ 脚本坚持读 JSON 是有实际必要的,不是形式主义。
🟢 **PART 1 79/79 MATCH · PART 2 11/11 MATCH · PART 3 90/90 MATCH · PART 5 4/4 OK,评审自跑复现。**

---

## 4. 🔴 缺口猎(治理 §11-1:常规动作)

### 4.1 占位符反向断言是不是零判别力(E-45)—— 🟢 **不是**

T1 **没有**写「渲染结果含 `{x}` 字面量」。它写的是**过真实 vue-i18n 渲染并 `toBe` 全串**:
```js
expect(zhI18n().global.t('aiKbAlNowIndexing', { ext: '.log' })).toBe('已收录 .log')
```
评审探针 2/3 拿掉产品侧的占位符名后,**这条正是报红的那一条**(`'Now indexing '` ≠
`'Now indexing .log'`)。**若按零判别力写法,这两个探针会全绿。** 🟢 **无缺口。**
另有一条把 E-45 那个「静默置空」的行为本身钉成活断言
(`t('aiKbAlNowIndexing', { wrongName })` → `toBe('已收录 ')`),vue-i18n 升级改行为会响。

### 4.2 「exactly N keys」是本批精确还是全表精确(裁定 R12)—— 🟢 **双轨正确**

```js
expect(p5fTask1Keys.length).toBe(79)                       // 本批:精确 toBe ✅
expect(Object.keys(zh).length).toBeGreaterThanOrEqual(1727) // 全表:下限 ✅
expect(Object.keys(en).length).toBeGreaterThanOrEqual(1727)
```
🟢 **没有精确的全表数,没有重建 D-3 的跨期陷阱。**

### 4.3 全角例外清单是 `toBe` 钉死还是宽松包含 —— 🟢 **`toBe` 钉死**

`fullWidthExceptions` 是 `Record<string,string>`,并有
`expect(Object.keys(fullWidthExceptions).length).toBe(9)`(**加一条例外就红**)+
`expect(zh[key]).toBe(value)` 逐条精确。**没有 `toContain` / 正则宽松形态。**

### 4.4 参数化守卫防空循环(§9.14-4)—— 🟢 **N 条独立用例真在跑**

`--reporter=verbose` 实数(不是靠「N 个键全绿」推断):
```
P5f 块实际执行用例:47
其中 "must not collapse onto" 参数化用例(P5f 段):21 条,逐条列名
其中 "interpolates {…}" 参数化用例(P5f 段):9 条,逐条列名
```
且每个参数化列表都有**长度 + 集合**双钉:
`cases` 有 `toHaveLength(9)` **且** `cases.map(c=>c.key).sort()).toEqual(placeholderKeys…)`;
`divergent` 有 `toBe(21)` + `axis==='zh'` 1 条 / `axis==='en'` 20 条 + 全表重扫 `toEqual`。
**清单读取失败 / 循环体一次没跑 ⇒ 长度断言先红。无空循环风险。**

### 4.5 D-4 的「只有存在性断言」是否照既定模式、有没有开第二套 —— 🟢 **照旧,无第二套**

评审探针 4(改坏一个**只有存在性断言**的键 `aiKbWkContents` 的 zh 值):
```
===== PROBE: P4_D4_existence_only =====
vitest exit=0     Test Files 1 passed (1)     Tests 136 passed (136)
--- restore md5 = 基线 ---
```
⇒ **值漂移确实测不出来,由一次性 verify 脚本兜底** —— 这与 P5a–P5e **完全同款**
(`grep "fullWidthPunctuation = /"` 显示五刀结构一致,均为「例外 `toBe` + 其余只扫标点」)。
🟢 **没有开第二套模式。** ❌ **但条数报错了,见 Important-1。**

### 4.6 其它已查、未发现问题的点

- **`namesOf` 里 `/g` 正则的 `lastIndex` 复用陷阱**:`while(exec()!==null)` 每次都跑到 `null`
  才退出,`lastIndex` 自动归零 ⇒ 🟢 **无跨调用污染**(经典坑已避开)。
- **P5a–P5d 的守卫会不会也被本批逼红**:`grep` 全文,**只有 P5e 和 P5f 有「全表重扫 + `toEqual`」**
  这种会被外部新键逼红的形态,P5a–P5d 是固定对表 ⇒ 🟢 **不存在「本该红却没红」的第二处**。
- **`aiKbAlEnabledSuffix` ↔ `aiKbStatusActive`(zh 同「已启用」)等跨期一轴撞车**:
  已在 P5f 自己的表里逐条登记(评审扫描逐条对上),🟢 **没有漏登记的**。
- **11 条复用键被本批依赖但未重新声明**:T1 加了一条存在性守卫
  (「a later cleanup that decides 'nothing uses aiKbColPath any more'」),🟢 **想到了。**

---

## 5. 缺陷清单

### 🔴 Important-1 —— 报告 §2.4 的 D-4 条数错 9 条:**17/62 应为 26/53**

**事实**:报告 §2.4 与 §1 汇总表(`p5f-task-1-report.md:66`)写「值级断言 **17** 条 /
只有存在性断言 **62** 条」。它自己的分类表列的是 **9 + 9 + 8(+1)** 三类,
「去重后 = 17」这一步**把 E-45 那 9 条整组漏掉了**(9 + 8 = 17 恰好是漏掉 E-45 的结果)。

**评审程序化重算**(`audit/d4count.mjs`,按三段断言块分别匹配 79 个键名):
```
fullWidthExceptions value-pinned: 9
codepoint-block value-pinned    : 12
E-45 interpolation value-pinned : 9
UNION (keys with a value-level assertion): 26
existence-only: 53
```
**实证**:探针 3 改坏的 `aiKbRtScanEvery` **只属于 E-45 这一组**(不在 9 条全角例外里、
也不在码点块里),而它**报红了 3 条断言** ⇒ 它显然是「有值级断言」的键,
按报告的口径却被算进了「只有存在性断言的 62 条」。

**影响**:**零代码影响**,`src/` 一行都不用改;方向是**低估自己的覆盖率**(安全方向)。
但 D-4 是治理 §0.3 的跨期挂账项,**这个条数会被 T8 / 收官 / 下一期当基线引用**;
裁定 **R24** 明令「算术叙述错会让下一刀误判基线」。

**建议处置**:T1 在报告 §1 汇总表与 §2.4 就地订正为「值级断言 **26** / 只有存在性断言 **53**」,
并把分类表的「去重后」一行改成 `9 ∪ 12 ∪ 9 = 26`(重叠项:`aiKbWkRenderNote` 同时在 E-45 与码点块,
`aiKbAlDeletedCleaning` / `aiKbRtBackendTooOld` / `aiKbRtEmpty` 同时在例外与码点块)。
**不需要改任何测试代码。**

---

### Minor-1 —— P5e 块里两处注释仍写「5」,与已改成 6 的断言不一致

```
$ sed -n '1289,1294p' src/i18n/messageSyntax.test.ts
      // Pin the scan's OUTPUT, not just the hand-written table: re-run both directions over the
      // whole locale table for all 54 batch keys and demand the divergent-pair set is exactly
      // the 5 above.  ← 断言已经是 6
      it('the scan over the whole table finds exactly these 6 one-axis-divergent pairs …')
```
另 `:1243` 段首注释仍写「For these **5** pairs one axis genuinely diverges」。
T1 在正上方加了 15 行说明 5→6 的注释,读者不会被误导到出错,但**同一段里两个数字**
正是裁定 **R4** 点名过的「留着两个数字就还会被看错」的形态。
**建议**:把这两处的「5」改成「6」(或去掉数字),**只改注释,不动断言**。

### Minor-2 —— P5f 块注释「28 of the 90 blueprint strings collide …」与实测口径不符

评审实测:**90 条蓝本串里有 22 条**与批外的既有键撞车(zh 或 en 任一侧);
附录 §A.3 的「28」是**它自己表格的行数**(同一条文案撞多个键会占多行),**不是串数**。
```
blueprint zh strings that collide with a NON-batch key: 22 / 90
```
**影响**:纯注释措辞,不影响任何断言。**建议**:改成「附录 §A.3 登记了 28 行撞车(行数口径)」
或直接写 22 条串,别把两种单位混在一句里。

### Minor-3 —— 建议协调者订正附录 A:§A.6 的 50/54/89 三行 + §A.2 的标题「14 条」

- §A.6 第 **50** / **54** / **89** 行的「复用判定」列仍写 🟢 **可复用**,**与裁定 R3 直接相反**,
  且这三行**本身没有任何指向 R3 的记号**(R3 的说明只在 §A.2 的脚注里)。
  T0b 订正了 §A.3.x,**漏掉了 §A.6 这一列**。
- §A.2 的标题仍是「🟢 可复用的既有 `aiKb*` 键(**14 条**)」,而 R10 终值表是 **11 条**。
- **风险**:T4–T7 若照 §A.6 那一列写模板,会去引用 `aiKbNtDelete` / `aiKbOriginAuto` /
  `aiKbStatusRemoved`,**恰好就是 A-1 要防的静默串区**(而且因为值相同,**界面上看不出来**,
  三门也全绿)。**这不是 T1 的缺陷**(T1 落地正确并已申报),是**附录的遗留矛盾**。
- **建议**:① §A.6 三行改成「🔴 **新建**(裁定 R3)`aiKbRtDelete` / `aiKbRtWatchAuto` /
  `aiKbWkOpRemoved`」;② §A.2 标题改「14 条 → **11 条(R3 后)**」;③ 承 R4 的口径,
  **删掉旧数字而不是加脚注**。

### Minor-4 —— 「多加一个键」这个方向在测试层无守卫(既定模式,信息项)

`p5fTask1Keys.length).toBe(79)` 只钉住**测试文件里那个字面数组**;
若有人往 `zh_cn.ts` 的 marked block 里再加第 80 个键,
`toBeGreaterThanOrEqual(1727)` 与 parity 都不会红,**只有一次性的 `verify.mjs`
(`markedBlockKeys` 比对)能发现**。
评审确认 **P5a–P5e 五刀全是同一形态** ⇒ 🟢 **不算 T1 的偏离**,登记为信息项,
供协调者判断要不要在收官刀统一补一条「marked block 键集 === 本批清单」的 `node:fs` 断言。

---

## 6. 探针还原自证(§9.5:禁 `git checkout`,一律 `cp` + `md5sum`)

共 8 个探针,全部 `cp` 备份 → `python3` 行首锚定注入 → `diff -q` **先证注入落盘**
(harness 里若文件未变则 `exit 8` 中止,避免「探针没生效却报绿」)→ 跑 vitest → `cp` 还原 → `md5sum`。

| # | 探针 | 预期 | 实测 |
|---|---|---|---|
| 1 | `aiKbAlNoRules` 句尾 `。`→`.` | RED | 🔴 1 failed |
| 2 | en `aiKbAlNowIndexing` `{ext}`→`{e}` | RED | 🔴 3 failed |
| 3 | zh `aiKbRtScanEvery` `{h}`→`{hh}` | RED | 🔴 3 failed |
| 4 | zh `aiKbWkContents` 值改坏(D-4 存在性键) | GREEN(记录缺口) | 🟢 136 passed |
| 5 | P5e `divergent` 删掉新登记项 + 计数回 5 | RED | 🔴 1 failed |
| 6 | en `aiKbAlFileTypes`→`'File type'`(真塌陷) | RED | 🔴 4 failed |
| 7 | zh `aiKbRtSubtitle`→`取消`(未登记新撞车) | RED | 🔴 1 failed |
| 8 | zh `aiKbRtSubtitle` 加全角 `（）` | RED | 🔴 1 failed |

**终局**:
```
$ git status --short           （空)
$ md5sum src/i18n/zh_cn.ts src/i18n/en_us.ts src/i18n/messageSyntax.test.ts
4a4d4a9a85bccb4959e7aa165de34f08  src/i18n/zh_cn.ts
5602793e93d156b598d505ed634424ce  src/i18n/en_us.ts
6c48a8ee283f6632c18d3062fa642229  src/i18n/messageSyntax.test.ts
（与探针前基线逐字节一致,亦与 T1 报告 §1 贴出的 md5 一致)
$ git log --oneline -1
e9cea74 feat(p5f-t1): 知识库最后三页 i18n 键(复用 11 / 新增 79,两档)
```

## 7. 「没看到 ≠ 不存在」的复证(裁定 R13)

本报告凡以「零命中」下结论处,均用**第二条独立口径**复证:

| 结论 | 口径 1 | 口径 2 |
|---|---|---|
| 别期的键/断言零改动 | `git diff -- src/` 逐行读(4 行删除全在 P5e 一处) | `esbuild` 真实模块导入做集合差 → `removed=0 changed=0` |
| 90 条源串零遗漏 | 蓝本 `.vue` 正则抽 `$t()` → 83 + 7 动态 = 90 | `(zh,en)` 多重集双射 → `leftover = 0` |
| 本批零自译 | `valuematch.mjs` 双射 0 不匹配 | 独立跑 T1 的 `verify.mjs` → PART 1 79/79 + PART 3 90/90 |
| A.4 硬编码零泄漏 | 逐个字面量在 79 个值里查 | 双射反向:90 个源全被覆盖且无 leftover ⇒ 不可能混进非源串 |
| 参数化守卫非空循环 | 长度断言 `toBe(21)` / `toHaveLength(9)` | `--reporter=verbose` 逐条列名实数 21 / 9 |
| 只有 P5e/P5f 有全表重扫守卫 | `grep "the scan over the whole table finds exactly"` → 2 处 | `grep "const p5.Task1Keys"` → 5 处清单,逐个回读用法 |

**⚠️ 本次评审自己也踩了一次 R13**:第一轮探针用 `--reporter=basic`,vitest 4 无此 reporter,
`exit=1` 其实是 **Startup Error** 而非测试报红 —— 若只看退出码就会误判「探针有效」。
已改 `--reporter=verbose` 并**逐条读失败断言文本**后重跑全部探针。**登记为教训:
探针「报红」必须看到具体的 `AssertionError` 与用例名,不许只看 exit code。**

---

## 8. 放行判断

- **Critical 0 / Important 1(纯报告数字,零代码影响,方向安全)/ Minor 4**;
- **三门全绿**(335 / 4302 / tsc 0 / build 0),**8 个探针判别力全部实证**;
- **三条申报全部成立**;
- **无越权、无守卫放宽、无 D-3 陷阱重建、无 E-44、无 E-45 零判别力**。

🟢 **可以进 T1b。** Important-1 与 Minor-1/2 建议由 T1 在 T1b 顺手订正
(**Minor-1/2 只改注释**,Important-1 只改报告)。**Minor-3 归协调者**(附录 A 订正)。
