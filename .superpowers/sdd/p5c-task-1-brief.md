# SP8-P5c · Task 1 —— i18n(99 新键 + 10 复用)

## 必读(按序,**不许跳**)

1. `.superpowers/sdd/p5c-common-constraints.md` —— **全文**。尤其 **§7(i18n)**、§3 的 K1–K30、§3.5 的 **N15–N22**(**N21 / N22 是本刀的核心**)、§8(测试门)、§10(报告契约)
2. `.superpowers/sdd/p5c-appendix-A-i18n.md` —— **本刀的值表,逐字照抄的来源**
3. `.superpowers/sdd/p5b-common-constraints.md` §7 与 `p5a-common-constraints.md` §7(沿用条款)
4. `.superpowers/sdd/p5c-plan.md` 的 **T1 节**
5. 参考实现:`.superpowers/sdd/p5b-task-1-i18n-verify.mjs`(**照它写本期的脚本,别自己发明**)

**权威优先级:治理文件 + 附录 A > 本 brief > 计划书。** 冲突以治理文件/附录为准,并在报告里指出来。

---

## 1. 协调者裁定 A-1(**覆盖附录 A 的计数,本刀必须落地**)

附录 A 原本把「推理设备的自动档」复用到既有键 **`aiKbOriginAuto`**。**协调者裁定:不复用,新建 `aiKbDeviceAuto`。**

- 依据:`aiKbOriginAuto` 现值 = `Auto` / `自动`(`src/i18n/en_us.ts:1548` / `src/i18n/zh_cn.ts:1562`),
  **复用渲染完全一致**;但该键语义是「沉淀任务来源(manual/auto)」,与「推理设备自动档」无关
  —— 将来改沉淀文案会静默改掉设备下拉。成本只有 2 行 × 2 文件。
- **新键**:`aiKbDeviceAuto`,zh = `自动`,en = `Auto`(**zh 值仍以 `zh_CN.json` 里 `"Auto"` 的权威值为准,回源核一遍**)。
- 该键服务**三处**调用点,仍是**一个**键:`SettingsView.vue:47`(设备单选「自动」按钮)·
  `SettingsView.vue:222`(`deviceLabel` 的 `d === 'auto'` 分支里那个 `$t('Auto')`… **回源确认它到底是
  `$t('Auto (currently {r})')` 还是另有一个裸 `$t('Auto')`**)· `SettingsView.vue:262`(`setDevice` toast 的
  `d === 'auto' ? this.$t('Auto')`)· `ParserStatus.vue` 的 `deviceOptions`。
  → 🔴 **你要回源把「`Auto` 这个英文原串在两个蓝本里一共出现在哪几处」数清**,写进报告。

**因此本刀的计数是**:
| | 值 |
|---|---|
| 新增键 | **99**(附录 A 的 98 + `aiKbDeviceAuto`) |
| 复用键 | **10**(附录 A 的 11 − `aiKbOriginAuto`) |
| distinct 合计 | **109**(不变) |
| Vue2 有权威 zh 值 | **99**(本期新造 0) |
| 死键 | **0** |

🔴 **附录 A 里出现 `98` 的三处、以及 `11 条复用` 的表述,你要在附录 A 里就地订正成 99 / 10**
(附录是下游权威,不订正会让 T6–T9 按错数字施工)。订正处要留一行说明「协调者裁定 A-1,2026-08-03」。

---

## 2. 交付

**改**:`src/i18n/zh_cn.ts` · `src/i18n/en_us.ts` · `src/i18n/messageSyntax.test.ts` · `p5c-appendix-A-i18n.md`(订正计数)
**新建**:`.superpowers/sdd/p5c-task-1-i18n-verify.mjs`
**零 `.vue` 新增、零测试文件新增** → 三门文件数仍应是 **319**

---

## 3. DoD(逐条,报告里逐条给证据)

### 3.1 键值本身
1. **99 键同时进两档**(`src/i18n/zh_cn.ts` + `src/i18n/en_us.ts`)。`parity.test.ts` 自动断言键集一致,**不要改它**。
2. **zh 值逐字照抄** `git -C /home/nimo/NimoTech/NimoOS-UI show main:src/assets/lang/zh_CN.json`。
   🔴 **不许自己翻译、不许改标点、不许「顺手改对」。** T0 已实测 109 个串在语言包里 **100% 命中**,本期零自造。
3. **en 值 = 蓝本里 `$t()` 的英文原串**,逐字(含 `–` U+2013 / `×` U+00D7 / `…` U+2026 这类非 ASCII)。
4. 🔴 **前缀与词干**(治理 §7):全部 `aiKb*`,内部按页分 `aiKbSet*`(设置页)/ `aiKbPr*`(ParserStatus)/
   `aiKbPt*`(ParserTest)/ `aiKbFb*`(FolderBrowser),两页共用的通用词走无词干 `aiKb*`。
   **不许另开 `aiPs*` / `aiPt*` 第三个前缀家族。**
5. **零重名**:T0 已核 98 键与现有 **196** 个 `aiKb*` 零重名;你**加上 `aiKbDeviceAuto` 后再核一遍**
   (重复属性 = TS 错误,`vue-tsc` 会抓,但你要主动 grep 确认而不是靠报错发现)。

### 3.2 🔴 程序化逐码点比对脚本(**本刀最硬的一条 DoD**)
照 `p5b-task-1-i18n-verify.mjs` 写 `.superpowers/sdd/p5c-task-1-i18n-verify.mjs`:
- 读 `git show main:src/assets/lang/zh_CN.json` 与新写的 `src/i18n/zh_cn.ts`
- 对 **99 条新键**逐 `codePointAt` 比对 → DoD **99/99 MATCH**
- 对 **10 条复用键**做「现值未被本刀改动」比对 → DoD **10/10 MATCH**
- 逐条输出 `MATCH` / `MISMATCH`(不许只输出汇总)

🔴 **两段完整输出贴进报告。**
**理由(P5a T8 血的教训)**:附录表本身零差异,**手抄进 TS 时引入了 5 处全角标点错**,三门全绿没抓到。

### 3.3 `messageSyntax.test.ts` 三条守卫(**只圈本批 99 键,不许全量生效**)
既有 `aiResTurn` / `aiResFilesInTurns` 的两档占位符不一致是**有意设计**(`{s}` 是英文复数后缀),
全量生效会当场红。

- **(a) 全角标点扫描** `/[，；：？！（）]/` —— 例外清单 = **附录 A §A.5 实扫出的 18 条**,
  一律写成 `toBe` **钉死确切值的强断言**,不是「跳过扫描」的松形式。**其余 81 条必须扫不出全角标点。**
  ⚠️ `。`(U+3002)、`「」`、`·`(U+00B7)、`—`(U+2014)、`–`(U+2013)、`…`(U+2026)、`×`(U+00D7)
  **都不在**那个正则里 —— **不许按「看着像全角」判**,一律用正则实扫的结果。
  🔴 **你要自己重跑一次实扫**(附录 A 的 18 条是 T0 扫的,但你加了 `aiKbDeviceAuto`;
  `自动` 不含全角标点,预期仍是 18 条 —— **实测确认,别推定**)。
- **(b) 占位符** —— 附录 A §A.6 的 **9 条**,两档占位符名称集合一致(T0 已核零差异,你复核)。
- **(c) 「exactly 99 keys」** 防漂移断言(照 P3b/P5a/P5b 同款)。

### 3.4 🔴 N21 四组撞车 / 错译 —— **一律照抄,不许统一、不许「顺手改对」**
(逐条理由在治理 §3.5 N21 与附录 A 主表里,**按理由逐条判**)
1. `Resume` → **恢复**,与既有 `aiKbRebuild`(`Rebuild` → **恢复**,P5b ⚠️N #55 已登记的错译)**zh 撞车**。
   两个键都要存在,zh 都是「恢复」。**Vue2 把 `Rebuild` 译成「恢复」才是错的,`Resume`→「恢复」是对的。**
2. `Test Sandbox`(SettingsView `:162`)与 `Test sandbox`(ParserStatus `:6`)—— **只差首字母大小写**,
   zh 都是「测试沙盒」。**两个独立键**(`aiKbSetSandboxTitle` / `aiKbPrTestLink`),en 不同、zh 相同。
3. `Power-saving` → **省电** 与既有 `aiKbCcPowerSaver`(`Power saver` → 省电)zh 撞车;
   `Full power` → **全力** 与既有 `aiKbCcFullSpeed`(`Full speed` → 全力)zh 撞车。
   🔴 **en 不同 → 绝对不能复用既有键**(复用会让英文档渲染成 `Power saver`/`Full speed`,与 Vue2 不同 = 界面不 1:1)。
4. `aiKbPrOcrHint` zh = **慢 5-10x,只对真实索引的扫描件有用** —— 英文原串是
   `5–10× slower, only useful for truly scanned documents`(truly **scanned**),
   中文译成「真实**索引**的扫描件」是**语义错**;且英文用 `–`/`×`、中文用 ASCII `-`/`x`。**照抄。**

### 3.5 🔴 N22 技术标识符不许补 i18n 键
`rerank top-20` · `⚠ Reranker error:` · `dense [0:8]:` · `sparse top:` · `chunk #` · `cos` / `rr` ·
`target_tokens` / `overlap_tokens` / `min_tokens` 三个 `<label>` · `chunker=…, target=…, overlap=…, min=…` ·
`{{ c.token_count }} tokens · offset …`
→ Vue2 **刻意没进 i18n**(技术标识符/参数名)。**补了就是凭空多出 Vue2 没有的键,且两档一填英文 = 纯噪音。**
报告里要显式列出「判定不入语言包的硬编码串」清单并说明。

### 3.6 N16 提示(本刀相关的那半)
emoji / 特殊符号**有的在 `$t()` 里面、有的在外面**:
- **里面**:`⏸ Paused` / `✅ Running`(`SettingsView.vue:11`)→ **键值本身要含 emoji**
- **外面**:`🧪 {{ $t('Test sandbox') }}` / `⏳ {{ $t('Pending') }}` / `🔄` / `✅` / `❌` / `📦` / `📍` /
  `▼` / `▶` / `← {{ $t('Back to details') }}` / `📝` / `⚠️` → **键值里不许含这些 emoji**
- **script 拼接**:`('▶ ' + $t('Resume'))`(`ParserStatus.vue:27`)→ 键值是纯 `Resume`

🔴 **一个都不许挪进/挪出 `$t()`。** 你要逐处回源确认每个 emoji 在括号内还是括号外。

---

## 4. 测试门(提交前必须全过)

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                      > /tmp/p5c-t1-test.log  2>&1; echo "exit=$?"
pnpm exec vue-tsc --noEmit     > /tmp/p5c-t1-tsc.log   2>&1; echo "exit=$?"
pnpm build                     > /tmp/p5c-t1-build.log 2>&1; echo "exit=$?"
```

- **全量,不许只跑 `src/i18n/` 子集**;**输出完整落盘,不许 `| tail`**(P2b 教训:红项用例名被截掉永久丢失)。
- 🔴 **起点基线**(协调者与 T0 各实测一次,逐字一致):`sp8-ai`@`63a0b0d` =
  **`Test Files 319 passed (319)` / `Tests 3153 passed (3153)`** · `vue-tsc` exit 0 · `vite build` exit 0。
- **本刀零 `.vue` 新增** → **文件数仍应是 319**;用例数会因 `messageSyntax.test.ts` 新断言而增加,
  **报告给实测终值,不要预测**。
- 已知噪声(只它们红就复跑一次并说明,**不要顺手改**):
  `src/files/upload/persist.test.ts > persist > dropPersisted removes record + blob and frees budget`(IndexedDB flaky)·
  `AgentComposer.test.ts` 的 vue-i18n teardown 竞态。
- **本期 Service 仓零改动** → **不需要** `cd ../NimoOS-Service && pnpm build`,**也不需要** `pnpm install`。

---

## 5. 硬约束

- **可写仓只有** `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`,起点 `c209ed1`)。
- `/home/nimo/NimoTech/NimoOS-UI` **只读**,工作树在旧分支上、有别的会话未提交改动
  → 🔴 **取蓝本/语言包一律 `git -C /home/nimo/NimoTech/NimoOS-UI show main:<path>`,禁 `cat`/`Read` 工作树文件。
  禁在那个仓里 checkout / stash / 提交任何东西。**
- **禁碰** `/home/nimo/NimoTech/NimoOS-New-UI`(SP6/SP9)与 `/home/nimo/NimoTech/.sp7/NimoOS-New-UI`(SP7,有并发会话)。
- 禁 `git add -A` / `git add .`(只许显式列路径);禁 rebase / reset / stash / merge / push;
  不跑 `./scripts/deploy.sh`;不写 `/var/lib`;不改任何后端仓;**不动 `:5288` 的 dev server**。
- **一个任务 = 一个语义提交**,提交后 `git show --stat HEAD` + `git status` 自查。
- `.superpowers/sdd/` 被 gitignore 盖着 → 台账/报告/脚本要 **`git add -f <显式路径>`**。
- 🔴 **§1.1 全期零改动清单**(治理文件)里的文件一行都不许动:`KnowledgeLayout.vue` · `DashboardView.vue` ·
  `KIcon.vue` · `util/indexedFiles.ts` · `util/indexedFilesView.ts` · `util/dashboardHelpers.ts` ·
  `.sp8/NimoOS-Service/**`。需要改 → **停下写 `NEEDS_CONTEXT`**。

---

## 6. 报告契约

完整报告写 `.superpowers/sdd/p5c-task-1-report.md`(**`git add -f`**),至少含(治理 §10):
- 逐文件改了什么 · 蓝本 `file:line` → New-UI 键名的对照 ·
- 🔴 **比对脚本的两段完整输出**(99/99 + 10/10)· RED→GREEN 证据 · `git status` 干净证明
- 三门完整终值(`Test Files` / `Tests` 两行 + 任何红项完整用例名与归属)
- **计数**:复用 10 / 新增 99 / Vue2 有权威 zh 值 99 / 本期新造 0 / **死键 0**
- **A-1 的落地证明**:`aiKbDeviceAuto` 已建 + 附录 A 的 98→99 / 11→10 已订正 + `Auto` 在两个蓝本里的出现处清单
- **§3 的 K1–K30 里本刀命中的每一条显式申报**(至少 K25 无关、**N21/N22/N16 要说明确实照抄了**)
- **全角标点实扫结果**(你自己重跑那一次)与附录 A §A.5 的 18 条是否一致
- 拿不准的一律 `NEEDS_CONTEXT` 列出来,**不要自己拍**

返回给协调者 **≤15 行**:状态(`DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED`)·
提交 sha · 一行三门结果 · 计数一行 · 顾虑。
