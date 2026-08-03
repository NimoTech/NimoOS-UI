# SP8-P5c Task 1 独立评审 —— i18n(99 新键 + 10 复用)

**被评审对象**:`d2587df`(分支 `sp8-ai`,起点 `c209ed1`)
**评审日期**:2026-08-03 · **评审者**:独立评审(只读 + 自做 RED 探针后还原)
**结论:`Ready to merge`** —— Critical **0** · Important **1**(非 T1 责任,协调者动作)· Minor **3**

> 评审纪律声明:本文所有数字**一律不采信实现者报告**,全部回权威源自测。
> 蓝本与语言包一律 `git -C /home/nimo/NimoTech/NimoOS-UI show main:<path>`(`main`@`7a6ee6b7`),
> 未在那个仓做任何 checkout / stash / 提交。本仓只做了 6 次 RED 探针,每次都 `git checkout --` 还原,
> 收尾 `git status` 干净(§8)。

---

## 0. 一句话结论

**99 键的 en 值与 zh 值我都能从权威源独立复现,零差异;10 条复用键零改动;N16 / N21 / N22 逐条实证照抄,
零「顺手改对」;比对脚本与 7 条测试守卫都经我自己的 RED 探针证明有判别力(不是空转);
三门我复跑一致(319 / 3160 / tsc 0 / build 0);提交范围零越界。**

---

## 1. 提交范围(§1.1 全期零改动清单核查)

```
$ git show --stat d2587df
 .superpowers/sdd/p5c-appendix-A-i18n.md     | 263 +++++-----
 .superpowers/sdd/p5c-task-1-i18n-verify.mjs | 339 +++++++++++
 .superpowers/sdd/p5c-task-1-report.md       | 550 +++++++++++++++
 src/i18n/en_us.ts                           | 113 ++++
 src/i18n/messageSyntax.test.ts              | 186 ++++++
 src/i18n/zh_cn.ts                           | 126 ++++
 6 files changed, 1460 insertions(+), 117 deletions(-)
```

- ✅ **零 `.vue` 新增、零 `src/ai/` 改动**、零 `.sp8/NimoOS-Service/` 改动。
- ✅ §1.1 全期零改动清单(`KnowledgeLayout.vue` / `DashboardView.vue` / `KIcon.vue` / `QueueView*` /
  `IndexedFilesView*` / `util/*` / `knowledgeStore.ts` / 五个 scss / `theme.css` / Service 仓)**一个都没碰**。
- ✅ 两个 locale 文件是**纯追加**:`git show d2587df -- src/i18n/zh_cn.ts src/i18n/en_us.ts | grep -c '^-[^-]'` = **0**
  → 零删除行、零既有值被改写、零既有断言被削弱。
- ✅ `parity.test.ts` 未被改动(brief §3.1-1 要求)。
- ⚠️ 117 行删除全部在 `p5c-appendix-A-i18n.md`(整表重编号)——已逐条核对,见 §5。

---

## 2. i18n 值:我自己的独立复核(不复用实现者的脚本口径)

我另写了一份验证器(不读附录 markdown、不读实现者的 `NEW_KEYS` 映射),口径是**从产物反推权威源**:
对标记块里的每个键,取 `en_us.ts` 的值当 JSON key 去查 `zh_CN.json`,要求 `zh_cn.ts` 的值 `===` 查出来的值。

```
=== distinct $t() literals across 4 blueprints: 109
=== $t(non-literal) count: 0
=== locale key counts: zh 1502 en 1502  dupZh []  dupEn []
=== P5c block keys: zh 99  en 99  setEqual true
=== zh value vs zh_CN.json: 99/99 MATCH
=== en_US.json override/absent issues: 0
=== coverage: literals 109  covered 109  MISSING 0  EXTRA 0
=== full-width hits among block keys: 18
=== keys with placeholders: 9   (每条 zh/en 占位符集合 OK)
=== aiKb* total zh: 295  en: 295
=== other prefix families present? aiPs/aiPt: []
```

逐条落地:

| DoD | 我的实测 | 判定 |
|---|---|---|
| 99 键同进两档、键集相等 | zh 99 / en 99,`setEqual true`;全文件 1502 / 1502,零重复键 | ✅ |
| zh 值逐字照抄 `zh_CN.json` | **99/99**(严格 `===`,含 U+2013 / U+00D7 / U+2026 / U+00B7 / U+2014 / U+FF08 等) | ✅ |
| en 值 = 蓝本 `$t()` 英文原串 | 99 条 en 值**全部**是蓝本里真实出现过的 `$t()` 字面量(`EXTRA 0`);且 `en_US.json` 对这 99 个 key **零覆写** | ✅ |
| **零漏键** | 109 个 distinct 字面量 = 99 新增 + 10 复用,**`MISSING 0`** —— 没有任何一个蓝本文案被漏掉 | ✅ |
| **零凭空造键** | **`EXTRA 0`** —— 没有任何一个键的值不是蓝本 `$t()` 里的串(这同时是 N22 的硬证据) | ✅ |
| 前缀家族 | `aiKb*` 共 295 = 既有 196 + 本批 99;**零 `aiPs*` / `aiPt*`** 第三家族 | ✅ |
| 零重名 | 两档各 1502 键、distinct 1502 → 零重复属性(`vue-tsc` exit 0 亦背书) | ✅ |
| 零死键 | `aiKbOpFailed` / `aiKbSwitchFailed` 均有调用点(K30 只是不拼后端 detail) | ✅ |
| 无需转义字符 | 99 条 zh/en 值里**零 `@` / 零 `|` / 零 `\`** → 文件末尾的全量 bare-@ 守卫不会误红 | ✅ |

**`$t(非字面量)` = 0 处**,我用「整文件 `$t(` 计数 vs `$t(\s*['"]` 计数」逐文件复核,四个文件差值全为 0 →
附录 §A.4 / 治理 E-5 的结论**成立**,本期零 K20 漏键风险。

---

## 3. 🔴 N21 四组撞车 / 错译 —— 逐组实证「没被顺手改对」

先证明**撞车对象本体未被改动**(HEAD vs 起点 `c209ed1` 逐键 diff):

```
aiKbRebuild       zh HEAD 恢复      / BASE 恢复         en HEAD Rebuild      / BASE Rebuild        → 未动
aiKbCcPowerSaver  zh HEAD 省电      / BASE 省电         en HEAD Power saver  / BASE Power saver    → 未动
aiKbCcFullSpeed   zh HEAD 全力      / BASE 全力         en HEAD Full speed   / BASE Full speed     → 未动
aiKbCcBalanced    zh HEAD 平衡      / BASE 平衡         en HEAD Balanced     / BASE Balanced       → 未动
aiKbOriginAuto    zh HEAD 自动      / BASE 自动         en HEAD Auto         / BASE Auto           → 未动
```

| N21 组 | 要求 | 实测落地 | 判定 |
|---|---|---|---|
| ① `Resume` vs `Rebuild` | 两键并存、zh 都是「恢复」,不许统一 | `aiKbResume: '恢复'`/`'Resume'` 新建;`aiKbRebuild: '恢复'`/`'Rebuild'` **一字未动** | ✅ 照抄 |
| ② `Test Sandbox` / `Test sandbox` | 两个独立键,en 差首字母大小写、zh 相同 | `aiKbSetSandboxTitle` en=`Test Sandbox` · `aiKbPrTestLink` en=`Test sandbox`,zh 均「测试沙盒」 | ✅ 照抄 |
| ③ `Power-saving` / `Full power` | **绝对不许**复用 `aiKbCcPowerSaver` / `aiKbCcFullSpeed` | 新建 `aiKbPrCcPowerSaving`(`Power-saving`)/ `aiKbPrCcFullPower`(`Full power`);两个既有键未动 | ✅ 未复用 |
| ④ `aiKbPrOcrHint` | 保留「真实**索引**的扫描件」错译;en 用 `–`/`×`、zh 用 ASCII `-`/`x` | 我的符号扫描实测:en 值含 **U+2013 + U+00D7**;zh 值 `慢 5-10x，…` 是 **ASCII `-`(0x2D)+ `x`(0x78)**,「真实索引的扫描件」原样保留 | ✅ 逐码点照抄 |

附带一处(附录 §A.3 末尾):`aiKbSetOcrWarn` en=`5–10×`(U+2013+U+00D7)/ zh=`5-10×`(ASCII `-` + U+00D7);
`aiKbPtDefaults` zh 里保留 en 的 `5–20`(U+2013)。**我逐码点核过,均照抄,零规范化。**

### 3.1 🔴 我自己判的那一问:`Balanced` 该复用还是新建?

**判据(N21 组③的原文逆用)**:「en 不同 → 不能复用」→ 反之,**en 与 zh 双双与 Vue2 一致才配复用**。

我实测 `aiKbCcBalanced`:en=`'Balanced'` == Vue2 英文原串 `Balanced`;zh=`'平衡'` == `zh_CN.json['Balanced']` = `平衡`。
**双双一致 → 应当复用。实现者复用了 `aiKbCcBalanced`(未新建 `aiKbPrCcBalanced`)→ 结论正确。**
三档里恰好只有它满足复用条件,另两档必须新建 —— 处理方式内部自洽。

### 3.2 我把 10 条复用键逐条按「en+zh 双双一致」核了一遍

```
aiKbCcBalanced   en="Balanced"         zh="平衡"     pack_zh="平衡"     zhOK enOK  redefined=false
aiKbCancel       en="Cancel"           zh="取消"     pack_zh="取消"     zhOK enOK  redefined=false
aiKbDeferredTitle en="Coming soon"     zh="即将上线" pack_zh="即将上线" zhOK enOK  redefined=false
aiKbFailed       en="Failed"           zh="已失败"   pack_zh="已失败"   zhOK enOK  redefined=false
aiKbLastSynced   en="Last synced"      zh="上次同步" pack_zh="上次同步" zhOK enOK  redefined=false
aiKbOpFailed     en="Operation failed" zh="操作失败" pack_zh="操作失败" zhOK enOK  redefined=false
aiKbPaused       en="Paused"           zh="已暂停"   pack_zh="已暂停"   zhOK enOK  redefined=false
aiKbPending      en="Pending"          zh="待处理"   pack_zh="待处理"   zhOK enOK  redefined=false
aiKbRefresh      en="Refresh"          zh="刷新"     pack_zh="刷新"     zhOK enOK  redefined=false
aiKbRunning      en="Running"          zh="运行中"   pack_zh="运行中"   zhOK enOK  redefined=false
```

**10/10 全部满足复用条件,且 `redefined=false`(没有一条被在标记块里重复定义)** → 复用集合正确、无遗漏、无多余。

### 3.3 我加做的反向审计:有没有「本该复用却新建」的键?

对 99 个新键,拿 `(en, zh)` 去 `c209ed1` 的全量既有键里找完全相同的对:

- 命中 17 条,但**只有 1 条是同家族(`aiKb*`)**:`aiKbDeviceAuto` == `aiKbOriginAuto` ——
  **这正是协调者裁定 A-1 明文授权的**(语义是「沉淀任务来源」,不该被设备下拉借用)。
- 其余 16 条命中的都是**跨区家族**(`filesViewer*` / `dock*` / `topbar*` / `apps*` / `aiSk*` /
  `aiRes*` / `aiCfg*` / `aiMention*` / `aiProc*`,如 `Loading…` / `Done` / `Run` / `Reset` / `Change`)。
  按治理 §7 的「新键前缀 `aiKb*`(全部)」per-area 家族约定,跨区借键是架构错误,**不复用是对的**。
- 反向命中「zh 撞车但 en 不同」7 条,其中 3 条正是 N21 组①③点名的(`aiKbResume`/`aiKbRebuild`、
  `aiKbPrCcFullPower`/`aiKbCcFullSpeed`、`aiKbPrCcPowerSaving`/`aiKbCcPowerSaver`)→ **都正确地新建了**。

→ **复用/新建的每一个决策都能被判据推出来,零未授权重复、零本该复用却新建。**

---

## 4. 🔴 N16 emoji 位置 —— 我自己数了一遍

我不按报告的清单,自己对四个蓝本做**穷尽符号扫描**(所有 codepoint ≥ U+2010,排除 CJK / 全角形 /
排版标点 U+2010-2014,2018/2019,201C/201D,2026,00B7),逐行判在 `$t()` 内还是外:

**`$t()` 里面(共 3 处、对应 3 个键)**:
- `SettingsView.vue:11` `$t('⏸ Paused')`(U+23F8)→ `aiKbSetSvcPausedLine`
- `SettingsView.vue:11` `$t('✅ Running')`(U+2705)→ `aiKbSetSvcRunningLine`
- `ParserStatus.vue:53` `$t('→ actual {device}')`(U+2192)→ `aiKbPrResolvedHint`

**`$t()` 外面(11 处)**:`SettingsView.vue:67` 📝 · `:162` 🧪 · `:171` ⚠️(U+26A0+U+FE0F)·
`ParserStatus.vue:6` 🧪 · `:70` ⏳ · `:71` 🔄 · `:72` ✅ · `:73` ❌ · `:74` 📦 · `:75` 📍 · `:94` ▼/▶ ·
`ParserTest.vue:5` ← · `:80` ✓ · `:100` ▼/▶ · `:110` ⚠ · `:35` ×(U+00D7)。
**script 拼接**:`ParserStatus.vue:27` `('▶ ' + $t('Resume'))` / `('⏸ ' + $t('Pause'))`。
`FolderBrowser.vue` 唯一命中是 scss 里的 `content: '›'`(U+203A),与 i18n 无关。

再反向扫 99 个产物值(同一套排除口径):

```
ZH SYM aiKbPrResolvedHint      = → 实际 {device}   U+2192
ZH SYM aiKbSetSvcPausedLine    = ⏸ 已暂停         U+23F8
ZH SYM aiKbSetSvcRunningLine   = ✅ 运行中         U+2705
EN SYM aiKbPrResolvedHint      = → actual {device} U+2192
EN SYM aiKbSetSvcPausedLine    = ⏸ Paused         U+23F8
EN SYM aiKbSetSvcRunningLine   = ✅ Running        U+2705
```

→ **恰好 3 个键值含符号,与括号内的 3 处一一对应;`aiKbResume`/`aiKbPause` 是纯 `Resume`/`Pause`
(▶/⏸ 没被吸进键值),`aiKbPrTestLink`/`aiKbSetSandboxTitle`/`aiKbSetNotesSection`/`aiKbSetDangerZone`/
`aiKbPtBackLink`/`aiKbPrRecentFailures` 等一律干净。零挪进、零挪出。** 报告的「仅 3 个键」**属实**。

---

## 5. 🔴 N22 技术标识符 —— 零补键(硬证据)

1. **结构性证明**:我的 coverage 检查 `EXTRA 0` —— 99 个键的 en 值**全部**是蓝本 `$t()` 里真实存在的字面量。
   技术标识符不在 `$t()` 里 → 数学上不可能被建成键。
2. **定向证明**:对 12 个 N22 串(`rerank top-20` / `Reranker error` / `dense [0:8]:` / `sparse top:` /
   `chunk #` / `cos ` / `rr ` / `target_tokens` / `overlap_tokens` / `min_tokens` / `chunker=` /
   `tokens · offset`)在两档 99 个值里做 `includes` 扫描 → **`ZERO N22 identifier keys — OK`**。
3. **回源确认这些串确实在 `$t()` 外**:`ParserTest.vue:41/45/49`(三个 `<label>`)· `:65` `rerank top-20` ·
   `:84-87` `chunker=/target=/overlap=/min=` · `:110` `⚠ Reranker error:` · `:119/:135` `chunk #` ·
   `:136` `tokens · offset` · `:140/:144` `dense [0:8]:` / `sparse top:` —— 全是裸模板文本。

→ **N22 零违反。**

---

## 6. 比对脚本的判别力 —— 我自己跑 + 自做 RED 探针

### 6.1 GREEN 基线(我跑的)

```
$ node .superpowers/sdd/p5c-task-1-i18n-verify.mjs
BLOCK-COVERAGE OK: zh_cn.ts marked block has exactly the 99 mapped keys, zero duplicates
BLOCK-COVERAGE OK: en_us.ts marked block has exactly the 99 mapped keys, zero duplicates
SUMMARY (PART 1 …): 99/99 MATCH
SUMMARY (PART 2 …): 10/10 MATCH
exit=0
```

### 6.2 我的 RED 探针 1 —— 全角标点(brief 点名的那一招)

半角 `;` → 全角 `；`(`aiKbSetNotesFolderDesc`):

```
$ node -e '…replace("每个用户一个子目录;文件是纯","每个用户一个子目录；文件是纯")…'  → EDIT APPLIED
$ node .superpowers/sdd/p5c-task-1-i18n-verify.mjs ; echo exit=$?
MISMATCH  aiKbSetNotesFolderDesc  —  codepoint diff vs Vue2 source "Each user has a subfolder; files are plain Markdown."
            zh [codepoint 9] new-ui=U+FF1B (；)  vue2=U+003B (;)
SUMMARY (PART 1 …): 98/99 MATCH
exit=1
```
**同一处改动也让测试守卫红**(双重堵法):
```
 × should not contain full-width ，；：？！（） in any zh_cn value from this batch (except the 18 registered exceptions)
AssertionError: … aiKbSetNotesFolderDesc = "每个用户一个子目录；文件是纯 Markdown。"
      Tests  1 failed | 30 passed (31)
```
→ 还原,`git status` 干净。**精确到 codepoint 索引 —— 零空转。**

> ⚠️ 过程记录:我第一次用 `perl -CSD -i -pe` 做这个替换**静默 no-op**(`git diff --stat` 空),
> 差点得出「探针不报红 = 脚本空转」的错误结论。改用 `node` 写文件并断言「替换是否生效」后才成立。
> **教训:RED 探针必须先证明「注入真的落盘了」再看断言 —— 否则假 GREEN 会被读成假 RED。**

### 6.3 我的 RED 探针 2 —— 复用键被悄悄改掉

`aiKbCcBalanced` zh `平衡` → `均衡`:
```
SUMMARY (PART 1 …): 99/99 MATCH
MISMATCH  aiKbCcBalanced  —  codepoint diff vs Vue2 source "Balanced"
SUMMARY (PART 2 …): 9/10 MATCH        exit=1
```
→ PART 2 真的能守住「本刀没改既有 10 条」。还原。

### 6.4 我的 RED 探针 3 —— 「脚本映射漏键」这个盲区(评审要求专查)

**问:少映射一个键时,脚本会不会静默 99/99 通过?** 我从 `NEW_KEYS` 里删掉 `aiKbSetSelected: 'Selected',`:

```
FAIL: zh_cn.ts marked block key set != NEW_KEYS map
  in block but not in map: aiKbSetSelected
FAIL: en_us.ts marked block key set != NEW_KEYS map
  in block but not in map: aiKbSetSelected
SUMMARY (PART 1 …): 98/98 MATCH
FAIL: NEW_KEYS has 98 entries, expected 99
exit=1
```
→ **block-coverage 前置校验确实堵住了这个盲区**(报告的说法成立)。
⚠️ 注意 `SUMMARY` 行本身会变成「98/98 MATCH」——**只看 SUMMARY 会被骗**;
但脚本同时打 `FAIL` 两行 + `NEW_KEYS has 98` + `exit 1`,三重兜底,判别力足够。**评审口径:以 exit code 为准,不以 SUMMARY 行为准。** 还原。

### 6.5 我的 RED 探针 4 —— 标记块多出一个键

往两档标记块塞第 100 个键 `aiKbZzzProbe`:
```
FAIL: zh_cn.ts marked block key set != NEW_KEYS map
  in block but not in map: aiKbZzzProbe            exit=1
--- messageSyntax.test.ts + parity.test.ts:  Tests  34 passed (34)   ← 未察觉
```
→ **`.mjs` 抓得住;CI 里的测试抓不住**(见 Minor M-1)。还原,`git status` 干净。

---

## 7. `messageSyntax.test.ts` 的 7 条守卫 —— 逐条核 + 各做 RED 探针

### 7.1 圈定范围(评审要求专查「不许全量」)

守卫全部跑在**硬编码的 `p5cTask1Keys` 99 键数组**上(`for (const key of p5cTask1Keys)`),
**没有任何一条遍历整个 locale 对象** → 既有 `aiResTurn` / `aiResFilesInTurns` 的两档占位符
有意不一致**不会被卷进来**。我实测确认:`aiResTurn` / `aiResFilesInTurns` 均**不在**那个数组里,
且这两个键在本次 GREEN 全量 3160 例里零红。**圈定范围正确。**

### 7.2 逐条

| # | 断言 | 形式 | 我的核查 |
|---|---|---|---|
| 1 | `covers exactly the 99 keys this task added` | `expect(len).toBe(99)` | ✅ 数组实测 99 项,与标记块逐键相等(我自己 sort 后比对 `setEqual true`) |
| 2 | `every key … present as a string in both locales` | `expect(missing).toEqual([])` | ✅ 补 P5b 评审 I-1 的洞(两档同时删 → `parity.test.ts` 不红) |
| 3 | `registers exactly the 18 … exceptions` | `expect(len).toBe(18)` | ✅ |
| 4 | `pins the exact zh_cn value … for each of the 18` | **18 条 `toBe` 钉死确切值** | ✅ **是强断言,不是「跳过扫描」的松形式** —— 且它能抓「全角→ASCII」这个**扫描式守卫抓不到的反方向**(见探针 4) |
| 5 | `should not contain full-width … (except the 18)` | 扫描 `/[，；：？！（）]/`,`continue` 跳过 18 例外 | ✅ 覆盖 **99−18 = 81** 条,与 brief 的「其余 81 条」一致 |
| 6 | `covers exactly the 9 keys … placeholders` | `expect(len).toBe(9)` | ✅ |
| 7 | `zh_cn and en_us use the same set of {…} placeholder names` | 两档名称集合 `JSON.stringify` 比对 | ✅ 9 条两档一致(我独立重扫结果相同) |

**18 条例外集合与 9 条占位符集合我都独立重扫过**(§2 的输出),与附录 §A.5 / §A.6 **逐键一致**;
`aiKbDeviceAuto` 的值「自动」不含 `/[，；：？！（）]/` 字符 → 例外仍 18 条,**实测,非推定**。
`。`/`「」`/`·`/`—`/`–`/`…`/`×`/`→` 均**不在**该正则内,例外表里也确实**没有**因「看着像全角」被误加的键。

### 7.3 我自做的 RED 探针(4 条,与实现者报告里的 6 条不同键、独立设计)

| 探针 | 注入 | 报红用例 | 结果 |
|---|---|---|---|
| **P-a** | `aiKbSetNotesFolderDesc` 半角 `;` → 全角 `；`(非例外键) | `× should not contain full-width ，；：？！（）…` | ✅ 精确报出键名+值,`1 failed \| 30 passed` |
| **P-b** | `aiKbSetCurrentlyUsing` 全角 `：` → 半角 `:`(**例外键,反方向**) | `× pins the exact zh_cn value …` `AssertionError: expected '当前用:' to be '当前用：'` | ✅ **证明 `toBe` 钉死值有独立价值** —— 这个方向扫描式守卫永远抓不到 |
| **P-c** | `en_us.ts` 里 `aiKbSetDeviceSet` 的 `{label}` → `{name}`(只改一档) | `× zh_cn and en_us use the same set of {…} placeholder names …` `aiKbSetDeviceSet: zh=[label] en=[name]` | ✅ |
| **P-d** | 从**两档同时**删 `aiKbPtRun` | `× every key in this batch is present as a string in both locales` `expected [ 'aiKbPtRun' ] to deeply equal []` | ✅ 且 `parity.test.ts` 本轮**没红**(34 例全过前的对照)→ 证明第 2 条断言补的正是 parity 的盲区 |

每条探针后 `git checkout --` 还原,`git status` 干净。

---

## 8. A-1 落地 + 附录订正核查

### 8.1 `aiKbDeviceAuto` 已建 / `aiKbOriginAuto` 未动

- `aiKbDeviceAuto: '自动'` / `'Auto'` **已建**,zh 值 == `zh_CN.json['Auto']`(我的 99/99 里含它)。
- `aiKbOriginAuto` HEAD 与 `c209ed1` **逐字相同**(§3 的 diff)→ 未动、未被复用。

### 8.2 `Auto` 在两个蓝本里的出现处(brief 点名要数清)—— 我自己数

```
$ grep -nP "\$t\(\s*'Auto'\s*\)" 蓝本
ParserStatus.vue:121:        { value: 'auto', label: this.$t('Auto') },
SettingsView.vue:45:  … @click="setDevice('auto')">{{ $t('Auto') }}</button>
SettingsView.vue:301:        const label = d === 'auto' ? this.$t('Auto') : (d === 'cpu' ? 'CPU' : 'GPU')
```
→ **裸 `$t('Auto')` 恰好 3 处**;`SettingsView.vue:219` 是 `$t('Auto (currently {r})')`
(独立键 `aiKbSetDeviceAutoCurrent`),**不是**第 4 个裸 `Auto`。
另有 `Auto-capture insights` / `Auto-capture conversation insights` / `Auto-capture enabled` /
`Auto-capture disabled` 四个以 `Auto` 开头的独立串,均已各自建键。
→ **附录 §A.1 的 `:45` / `:301` / `:121` 是对的;brief §1 写的 `:47` / `:222` / `:262` 是错的
(实现者已按权威优先级以附录为准并在报告 §11 挂出)。**

### 8.3 附录 A 的 98→99 / 11→10:我 grep 残留

| 结构 | 我实测 | 判定 |
|---|---|---|
| §A.2 主表行数 | **99 行**,编号**连续 1–99 无缺口**(脚本逐行验) | ✅ |
| §A.1 复用表行数 | **10 行**(`aiKbOriginAuto` 行已删) | ✅ |
| §A.5 例外表行数 | **18 行** | ✅ |
| §A.6 占位符表行数 | **9 行** | ✅ |
| 残留 `98` / `11 条复用` / `80 条` | 仅出现在**显式标注为「原值 / T0 历史结论」的订正说明里**(:3-10 的订正清单、:28-29、:35、:41-43、:62、:69、:186-188、:279-280),`| 98 |` 是主表行号。**零处会让下游读到错数** | ✅ |
| 🔴 **附录 `file:line` 引用的真实性** | 我把 A.1 + A.2 **全部 123 条** `file:line` 拿去蓝本对应行做「该行是否真含这个英文原串」检查 → **A.2 106/106 命中、A.1 17/17 命中,零错** | ✅ **下游可放心照用** |

---

## 9. 三门 —— 我自己复跑

```
$ pnpm test                   → exit=0
 Test Files  319 passed (319)
      Tests  3160 passed (3160)
   Duration  81.20s
$ pnpm exec vue-tsc --noEmit  → exit=0   (日志 0 行)
$ pnpm build                  → exit=0   ✓ built in 12.46s (唯一输出是既有 chunk >500kB 警告)
```

- **红项 0 条,单轮干净,零复跑。** 两个已知噪声(`persist.test.ts` 的 IndexedDB flaky、
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态)本轮均未触发。
- 文件数 **319 → 319**(零 `.vue`、零测试文件新增)✅ 与 brief §4 一致。
- 用例数 **3153 → 3160,+7** = `messageSyntax.test.ts` 的 7 条新 `it`(我逐条数过,正好 7)。
- **与报告声称的数字逐字一致,零虚报。**

---

## 10. 缺陷清单

### Critical —— **0 条**

四组 N21、N22、N16、A-1、提交范围、既有断言完整性,全部逐条实证通过。

### Important —— **1 条**

**I-1(非 T1 责任,协调者动作):`p5c-common-constraints.md` §7 的计数仍是 98 / 11 / 80,
与已订正的附录 A(99 / 10 / 81)冲突,而治理文件在权威优先级里**与附录同级**。**

残留位置(我 grep 实测):
```
:12   i18n 键表 →(**98** 条新增 + **11** 条复用)
:463  值表见 …(**98 条新增 + 11 条复用**)
:464  11 条复用**已逐条核过…**
:467  对 **98 条**逐 codePointAt 比对,
:468  DoD 是 **98/98 MATCH**;另对 11 条复用键…(**11/11 MATCH**)
:470  守卫**只圈本批 98 键**
:472  其余 80 条必须扫不出全角标点。
:476  (c) 补一条「exactly **98** keys」防漂移
```

- **为什么不算 T1 的缺陷**:brief §1 只授权订正**附录 A**;治理文件不在 T1 的交付清单里,
  未经授权去改治理文件反而是越界。实现者的处置(只改附录 + 在报告 §11 挂出)是对的。
- **为什么仍要报 Important**:治理 §7 是 T2a–T10 的必读第一篇。下游实现者/评审读到
  §7:476「exactly **98** keys」而代码是 99,极可能(a)把守卫「改回」98,或(b)对 T1 误报一条 Critical。
  **建议协调者在 §7 与 §1 的附录引用处各加一行「计数已由裁定 A-1 订正为 99/10/81,以附录 A 为准」**,
  或授权某一刀顺带订正。**这是文档一致性动作,不需要改任何产品代码。**

### Minor —— **3 条**

- **M-1 `exactly 99 keys` 只钉测试文件自己的数组长度,不钉标记块内容。**
  我的探针 4 实证:往两档标记块塞第 100 个键后,`messageSyntax.test.ts` + `parity.test.ts`
  **34 例全过**(只有不在 CI 里的 `.mjs` 报红)。
  → **完全符合 brief §3.3-c 的「照 P3b/P5a/P5b 同款」要求,不是违规**;但这个模具本身有盲区。
  建议 P5d 考虑把键表改成从标记块正则**推导**(即把 `.mjs` 的 block-coverage 思路搬进 CI)。**本期不改。**
- **M-2 `placeholderPattern` 是 `describe` 作用域里的 `/g` 正则,被 `namesOf()` 复用。**
  只因每次 `while` 循环都跑到 `null`(把 `lastIndex` 归零)才安全 —— 若将来有人在中途 `break`,
  下一次调用会从残留的 `lastIndex` 开始,静默漏检。同样是沿用既有块的写法。**本期不改,登记。**
- **M-3 SUMMARY 行可被误读为绿。** `.mjs` 在「映射漏键」时打 `SUMMARY … 98/98 MATCH`(§6.4)。
  → 建议后续刀在报告里引用 `.mjs` 结论时**同时贴 exit code 与 BLOCK-COVERAGE 两行**,不要只贴 SUMMARY。

---

## 11. 我核出的「与报告不符之处」

**零处。** 我逐项复核的每一个数字都与报告一致:
99 / 10 / 109 / 0 非字面量 / 18 例外 / 9 占位符 / 81 其余 / 3 个含 emoji 的键 / 3 处裸 `$t('Auto')` /
295 个 `aiKb*` / 1502 键零重复 / 319 文件 / 3160 例 / +7 / tsc 0 / build 0 / 附录 14 处订正 /
N22 零补键。

报告主动挂出的 3 条 brief/治理勘误我也各自回源核了,**全部成立**:
1. brief §1 的 `:47`/`:222`/`:262` → 实为 `:45`/`:219`(且是另一个键)/`:301` ✅
2. brief §1「附录 A 里出现 98 的三处」低估 → 实需订正 14 处 ✅(我 grep 复核了那 14 处都已改)
3. 治理 §3.5 N22 写 `rerank top-20` 在 `:66` → 实测在 **`:65`**(`:66` 是 `</label>`)✅ 偏 1 行,不影响结论

---

## 12. `git status` 收尾

```
$ git status --short
(空)
$ git log --oneline -1
d2587df feat(i18n): SP8-P5c T1 —— 知识库配置页 + Parser 两页 + 目录选择器 99 新键 / 10 复用
```

**6 次 RED 探针(4 次改 locale / 1 次改 `.mjs` / 1 次改两档标记块)全部还原,工作树干净。**
本评审未做任何提交;本文件 `git add -f` 入暂存区,**由协调者决定何时提交**。
`/home/nimo/NimoTech/NimoOS-UI` 全程只用 `git show main:`,零 checkout / 零 stash / 零提交。
