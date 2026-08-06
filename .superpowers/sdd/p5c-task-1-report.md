# SP8-P5c Task 1 报告 —— i18n(99 新键 + 10 复用)

**状态**:`DONE`
**分支 / 起点**:`sp8-ai` @ `c209ed1`(工作树干净)
**蓝本坐标**:`NimoOS-UI` `main` @ `7a6ee6b72b4b8184f0045c200371899a44653478`(与治理 §1 第 3 条一致)
**权威源取法**:全程 `git -C /home/nimo/NimoTech/NimoOS-UI show main:<path>`,零 `cat`/`Read` 那个工作树。

---

## 0. 计数(报告契约必填)

| 项 | 值 |
|---|---|
| 复用既有键 | **10** |
| 新增键 | **99** |
| 其中 Vue2 有权威 zh 值 | **99**(100%) |
| 本期新造(Vue2 无源) | **0** |
| 判定死键 | **0** |
| distinct `$t()` 串合计 | **109** = 10 复用 + 99 新增 + 0 死键 |
| `$t(非字面量)` | **0 处**(独立复测,见 §1) |

**死键 0 条**的理由:本期 K30(HTTP 失败不回显后端 detail)只是不做字符串拼接,
`aiKbOpFailed` 与 `aiKbSwitchFailed` 两个键都仍有调用点;99 个新键每一个都在 4 个蓝本的 `$t()` 里有对应位置。

---

## 1. 逐文件改了什么

| 文件 | 改动 | 行数变化 |
|---|---|---|
| `src/i18n/zh_cn.ts` | 尾部新增 `// >>> SP8-P5c Task 1` … `// <<< SP8-P5c Task 1` 标记块:27 行块注释 + **99 行键值** | 1625 → 1751 |
| `src/i18n/en_us.ts` | 同上,英文块注释 13 行 + **99 行键值** | 1611 → 1724 |
| `src/i18n/messageSyntax.test.ts` | 新增 `describe('P5c Task 1 aiKb* keys — punctuation and placeholder guards')`,7 条 `it` | 476 → 659 |
| `.superpowers/sdd/p5c-appendix-A-i18n.md` | 裁定 A-1 的**就地订正**,14 个位置(见 §4) | +/− 见 diff |
| `.superpowers/sdd/p5c-task-1-i18n-verify.mjs` | **新建**(`git add -f`) | 320 行 |

**零 `.vue` 新增、零测试文件新增** → 三门文件数仍是 **319** ✅(实测,见 §6)。

### 1.1 键值不是手抄的

承 P5a T8 教训(附录表零差异,**手抄进 TS 时引入 5 处全角标点错**),99 行 TS 键值**不是手打的**:
用脚本从 `git show main:src/assets/lang/zh_CN.json` / `en_US.json` 里按「英文原串 → 值」直接导出并写入文件。
`p5c-task-1-i18n-verify.mjs` 随后**独立地**再从同一权威源重新取值做逐码点比对(不读附录 markdown、不读生成中间产物)。

### 1.2 抽取的独立复测(不信 brief、也不信附录的结论)

用 `/\$t\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g` **扫整个 `.vue` 文件**(不是只扫 `<template>`,
承附录 §A.4 的实操要求)对 4 个蓝本取数:

```
total occurrences = 123
distinct          = 109
$t(非字面量)      = 0 处   ← 逐行比对 /\$t\(/g 的命中数与 /\$t\(\s*['"]/g 的命中数,零差值
```

再与附录 A(§A.1 的 11 行 + §A.2 的 98 行 = 109)做**集合相等**比对:

```
in extracted not appendix: []
in appendix not extracted: []
```

进一步对全部 109 条回权威源核:

```
zh_CN.json 缺条目            = 0
en_US.json 覆写英文原串      = 0     ← 「en 值 = 英文原 key」这条口径实测成立
附录 zh 列 vs zh_CN.json 差异 = 0     ← 附录表本身干净,与 T0 声称一致
```

---

## 2. 蓝本 `file:line` → New-UI 键名对照

完整 99 行对照见 `p5c-appendix-A-i18n.md` §A.2(本刀已把它订正成 99 行并整表重编号 1–99),
不在此重复抄一遍。此处只给**本刀实际回源核过、且 brief / 治理文件与实际有差异**的几处:

| 蓝本 | 实际 | 落成的键 |
|---|---|---|
| `SettingsView.vue:45` | `{{ $t('Auto') }}`(设备单选「自动」按钮) | `aiKbDeviceAuto` |
| `SettingsView.vue:301` | `d === 'auto' ? this.$t('Auto') : …`(`setDevice` toast) | `aiKbDeviceAuto` |
| `ParserStatus.vue:121` | `{ value: 'auto', label: this.$t('Auto') }`(`deviceOptions`) | `aiKbDeviceAuto` |
| `SettingsView.vue:219` | `this.$t('Auto (currently {r})', { r: … })` | `aiKbSetDeviceAutoCurrent`(**独立键**) |
| `ParserStatus.vue:53` | `$t('→ actual {device}', …)` —— `→` 在 `$t()` **里面** | `aiKbPrResolvedHint`(值含 `→`) |
| `SettingsView.vue:11` | `controlState.paused ? $t('⏸ Paused') : $t('✅ Running')` —— emoji 在 `$t()` **里面** | `aiKbSetSvcPausedLine` / `aiKbSetSvcRunningLine`(值含 emoji) |
| `ParserStatus.vue:27` | `('▶ ' + $t('Resume'))` / `('⏸ ' + $t('Pause'))` —— emoji 在 script 里拼接 | `aiKbResume` / `aiKbPause`(值**不含** emoji) |

---

## 3. 🔴 A-1 落地证明

### 3.1 新键已建

```
src/i18n/zh_cn.ts:  aiKbDeviceAuto: '自动',
src/i18n/en_us.ts:  aiKbDeviceAuto: 'Auto',
```

- zh 值 `自动` **不是自己译的**,是 `zh_CN.json["Auto"]` 的权威值(逐码点比对 MATCH,见 §5 PART 1 第 2 行)。
- **未复用 `aiKbOriginAuto`**:该键仍在两档里、值未被本刀改动(`zh_cn.ts:1562` / `en_us.ts:1548`,`自动` / `Auto`),
  P5b 的 distill origin 徽标继续用它。
- **前缀判定**:`aiKbDeviceAuto` 被 `SettingsView` 与 `ParserStatus` **两页共用** → 按治理 §7 / 附录 §A.2.1
  走**无词干 `aiKb*`**,**不**带 `Set` / `Pr` 词干,也**没有**另开 `aiPs*` / `aiPt*` 第三个前缀家族。

### 3.2 🔴 `Auto` 这个英文原串在两个蓝本里的出现处清单(brief §1 点名要数清)

`grep -n "'Auto'"` 于 4 个蓝本(`git show main:` 取的副本):

```
SettingsView.vue:45 :  <button :data-on="String(controlState.device === 'auto')" @click="setDevice('auto')">{{ $t('Auto') }}</button>
SettingsView.vue:301:  const label = d === 'auto' ? this.$t('Auto') : (d === 'cpu' ? 'CPU' : 'GPU')
ParserStatus.vue:121:  { value: 'auto', label: this.$t('Auto') },
```

→ **裸 `$t('Auto')` 恰好 3 处,一个键服务这 3 处。** `ParserTest.vue` / `FolderBrowser.vue` **零处**。

🔴 **brief §1 那个疑问的答案**:brief 问「`SettingsView.vue:222`(`deviceLabel` 的 `d === 'auto'` 分支)
到底是 `$t('Auto (currently {r})')` 还是另有一个裸 `$t('Auto')`」——
**实际在 `:219`(brief 的行号偏了 3),内容是 `this.$t('Auto (currently {r})', { r: (r || '').toUpperCase() })`,
是带占位符的独立串,不是裸 `$t('Auto')`。** 因此 `aiKbDeviceAuto` 服务的是 **3 处**,不是 4 处。
brief 列的 4 个坐标里,`SettingsView.vue:47` 应为 `:45`、`:222` 是另一个键、`:262` 应为 `:301`;
`ParserStatus.vue` 的 `deviceOptions` 在 `:121` ✅。**附录 §A.1 原表列的 `:45` / `:301` / `:121` 三处是对的。**

### 3.3 附录 A 的 98→99 / 11→10 已就地订正

**14 个位置**(brief §1 说「附录 A 里出现 `98` 的三处」是低估的 —— 实扫 `98` 有 7 处、`11` 相关 7 处):

| # | 位置 | 订正 |
|---|---|---|
| ① | 文件标题 | 新增 **98 → 99**、复用 **11 → 10**,并加一段裁定 A-1 说明(署「协调者裁定 A-1,2026-08-03,由 T1 落地」) |
| ② | §A.0 第 3 条 | 「11 条可以复用」→ 「11 条现值相同 / 裁定 A-1 后实际复用 **10** 条」 |
| ③ | §A.1 标题 | 复用既有键(**10 条**) |
| ④ | §A.1 表 | 删掉 `aiKbOriginAuto` 行(10 行);表上方新增裁定 A-1 说明 + 三个调用点 + T1 的回源核实结论 |
| ⑤ | §A.1 表下引注 | `11/11 全部 ✅` → `10/10`,「不要重写这 11 条」→ 「10 条」,并加 PART 2 的 10/10 MATCH 结论 |
| ⑥ | §A.1 那条「`aiKbOriginAuto` 之所以仍然复用」的理由 | **作废**(标明被裁定 A-1 覆盖),原「两条要额外说明的复用」变一条 |
| ⑦ | §A.2 标题 | 新增主表(**99** 条)+ 订正说明 |
| ⑧ | §A.2 表体 | 插入第 2 行 `aiKbDeviceAuto`(标记「🔴 裁定 A-1 新建,**不复用 `aiKbOriginAuto`**」)+ **整表重编号 1–99**(脚本重编,不是手改) |
| ⑨ | §A.2.1 零重名结论 | 加一条:99 个新键 vs 现有 196 个 `aiKb*` 零重名、99 个之间零重名(T1 实测),并写明 `aiKbDeviceAuto` 走无词干 |
| ⑩ | §A.5 引言 | 「本批 **98** 键」→ 「本批 **99** 键」 |
| ⑪ | §A.5 引言 | 「其余 **80** 条必须扫不出」→ 「其余 **81** 条」+ 注明例外仍 18 条是 T1 独立重扫实测 |
| ⑫ | §A.6 引注 | 「守卫只圈本批 **98** 键」→ 「**99** 键」 |
| ⑬ | §A.8 计数自检块 | `A.1 复用 11 → 10`、`A.2 主表 98 → 99`、`新增合计 98 → 99`、`distinct 合计 = 109 = 11 复用 + 98 新增` → `= 10 复用 + 99 新增` |
| ⑭ | §A.8 校验脚本段 | `98 条新键` → `99 条`、`DoD = 98/98` → `99/99`、`11 条复用` → `10 条`、`11/11` → `10/10`,并加 block-coverage 前置校验说明 |

---

## 4. 🔴 §3.2 程序化逐码点比对脚本 —— 两段完整输出

脚本:`.superpowers/sdd/p5c-task-1-i18n-verify.mjs`(照 `p5b-task-1-i18n-verify.mjs` 的写法,
未自行发明结构)。它做三件事:

1. **BLOCK-COVERAGE 前置校验**(本期新增,堵 P5b 脚本的一个盲区):脚本里的 99 键映射是手写的
   —— 英文原串**打错**会自证(`zh_CN.json` 查不到 → MISMATCH),但**漏写一条**不会。
   所以先把 `>>> SP8-P5c Task 1` … `<<<` 标记块里真实存在的 key 集合与映射做**集合相等 + 零重复**比对,两档都查。
2. **PART 1** —— 99 条新键,zh 对 `git show main:src/assets/lang/zh_CN.json` 逐 `codePointAt`;
   同一轮里 en 也对英文原串逐码点(并断言 `en_US.json` 对该串零覆写)。
3. **PART 2** —— 10 条复用键做「现值未被本刀改动、仍等于 Vue2 语言包」比对。

`node .superpowers/sdd/p5c-task-1-i18n-verify.mjs` → **exit 0**。完整输出:

```
BLOCK-COVERAGE OK: zh_cn.ts marked block has exactly the 99 mapped keys, zero duplicates
BLOCK-COVERAGE OK: en_us.ts marked block has exactly the 99 mapped keys, zero duplicates

===== PART 1 — 99 new keys (Appendix A §A.2 98 rows + aiKbDeviceAuto per ruling A-1) =====
MATCH     aiKbConcurrencyLevel
MATCH     aiKbDeviceAuto
MATCH     aiKbFbEmpty
MATCH     aiKbFbLoadFailed
MATCH     aiKbFbLoading
MATCH     aiKbFbNoVolumes
MATCH     aiKbFbVolumes
MATCH     aiKbInferenceDevice
MATCH     aiKbPause
MATCH     aiKbPrCcFullPower
MATCH     aiKbPrCcPowerSaving
MATCH     aiKbPrDetailsTitle
MATCH     aiKbPrFoldersTitle
MATCH     aiKbPrIndexedVectors
MATCH     aiKbPrNoPending
MATCH     aiKbPrOcrHint
MATCH     aiKbPrOcrLabel
MATCH     aiKbPrQueueDone
MATCH     aiKbPrQueueRunning
MATCH     aiKbPrRecentFailures
MATCH     aiKbPrResolvedHint
MATCH     aiKbPrTestLink
MATCH     aiKbPrUnreachable
MATCH     aiKbPtAsWellAs
MATCH     aiKbPtBackLink
MATCH     aiKbPtChooseFile
MATCH     aiKbPtChunksTitle
MATCH     aiKbPtDefaults
MATCH     aiKbPtDoclingToggle
MATCH     aiKbPtDragDrop
MATCH     aiKbPtHelp1
MATCH     aiKbPtHelpNoWrite
MATCH     aiKbPtHelpPreviewOnly
MATCH     aiKbPtMaxSize
MATCH     aiKbPtOcr
MATCH     aiKbPtOverlapNote
MATCH     aiKbPtProcessing
MATCH     aiKbPtQueryPlaceholder
MATCH     aiKbPtReset
MATCH     aiKbPtRun
MATCH     aiKbPtScoredTitle
MATCH     aiKbPtSupports
MATCH     aiKbPtTitle
MATCH     aiKbPtTooBig
MATCH     aiKbPtViaDocling
MATCH     aiKbPtZeroChunks
MATCH     aiKbResume
MATCH     aiKbResumed
MATCH     aiKbSetAutoCapture
MATCH     aiKbSetAutoCaptureCn
MATCH     aiKbSetAutoCaptureDesc
MATCH     aiKbSetAutoCaptureOff
MATCH     aiKbSetAutoCaptureOffWarn
MATCH     aiKbSetAutoCaptureOn
MATCH     aiKbSetChange
MATCH     aiKbSetChecking
MATCH     aiKbSetConcurrencyDesc
MATCH     aiKbSetConcurrencySet
MATCH     aiKbSetConcurrentFiles
MATCH     aiKbSetCurrentlyUsing
MATCH     aiKbSetDangerZone
MATCH     aiKbSetDeviceAutoCurrent
MATCH     aiKbSetDeviceCn
MATCH     aiKbSetDeviceSet
MATCH     aiKbSetDirEmptyMigratable
MATCH     aiKbSetDirNotEmpty
MATCH     aiKbSetMigrateAck
MATCH     aiKbSetMigrateNotEmpty
MATCH     aiKbSetMigrateReq1
MATCH     aiKbSetMigrateReq2
MATCH     aiKbSetMigrateReq3
MATCH     aiKbSetMigrateStart
MATCH     aiKbSetMigrateTitle
MATCH     aiKbSetMoveFiles
MATCH     aiKbSetNotesFolder
MATCH     aiKbSetNotesFolderCn
MATCH     aiKbSetNotesFolderDesc
MATCH     aiKbSetNotesFolderUpdated
MATCH     aiKbSetNotesSection
MATCH     aiKbSetNotesSectionHint
MATCH     aiKbSetOcrCn
MATCH     aiKbSetOcrOff
MATCH     aiKbSetOcrOn
MATCH     aiKbSetOcrOnlyScanned
MATCH     aiKbSetOcrTitle
MATCH     aiKbSetOcrWarn
MATCH     aiKbSetPickNote
MATCH     aiKbSetPointToExisting
MATCH     aiKbSetRebuildAll
MATCH     aiKbSetRebuildAllDesc
MATCH     aiKbSetRebuildEllipsis
MATCH     aiKbSetSandboxHint
MATCH     aiKbSetSandboxTitle
MATCH     aiKbSetSelected
MATCH     aiKbSetSvcPausedDesc
MATCH     aiKbSetSvcPausedLine
MATCH     aiKbSetSvcRunningDesc
MATCH     aiKbSetSvcRunningLine
MATCH     aiKbSwitchFailed

SUMMARY (PART 1 — 99 new keys (Appendix A §A.2 98 rows + aiKbDeviceAuto per ruling A-1)): 99/99 MATCH

===== PART 2 — 10 reused keys (Appendix A §A.1 minus aiKbOriginAuto), unchanged by this task =====
MATCH     aiKbCcBalanced
MATCH     aiKbCancel
MATCH     aiKbDeferredTitle
MATCH     aiKbFailed
MATCH     aiKbLastSynced
MATCH     aiKbOpFailed
MATCH     aiKbPaused
MATCH     aiKbPending
MATCH     aiKbRefresh
MATCH     aiKbRunning

SUMMARY (PART 2 — 10 reused keys (Appendix A §A.1 minus aiKbOriginAuto), unchanged by this task): 10/10 MATCH
```

**DoD:99/99 MATCH ✅ · 10/10 MATCH ✅**

### 4.1 脚本自身的 RED 探针(3 条,全部还原)

| 探针 | 做法 | 结果 |
|---|---|---|
| **A** —— P5a T8 那个失效模式本体 | 把 `aiKbPtDefaults` 里 `target=600, overlap` 的半角逗号改成全角 `，` | `MISMATCH aiKbPtDefaults`,首个差异点报 `zh [codepoint 13] new-ui=U+FF0C (，) vue2=U+002C (,)`,PART 1 掉到 **98/99**,脚本 **exit 1** |
| **B** —— 复用键被本刀悄悄改掉 | `aiKbOpFailed` 的 zh 从 `操作失败` 改 `操作失败了` | `MISMATCH aiKbOpFailed`,PART 2 掉到 **9/10**,**exit 1** |
| **C** —— 标记块少一条键 | 从 `zh_cn.ts` 删掉 `aiKbSwitchFailed` 那一行 | `FAIL: zh_cn.ts marked block key set != NEW_KEYS map` / `in map but not in block: aiKbSwitchFailed`,**exit 1** |

三条探针后都用备份文件还原,复跑 → `BLOCK-COVERAGE OK` ×2 + `99/99` + `10/10`,exit 0。

---

## 5. §3.3 `messageSyntax.test.ts` 三条守卫(只圈本批 99 键)

新增 `describe('P5c Task 1 aiKb* keys — punctuation and placeholder guards')`,7 条 `it`:

| # | 断言 | 值 |
|---|---|---|
| 1 | `covers exactly the 99 keys this task added` | `p5cTask1Keys.length` **toBe 99**(§3.3-c 的防漂移) |
| 2 | `every key in this batch is present as a string in both locales` | 继承 P5b 评审 I-1 的补洞(见下) |
| 3 | `registers exactly the 18 full-width-punctuation exceptions from Appendix A §A.5` | **toBe 18** |
| 4 | `pins the exact zh_cn value … for each of the 18 registered exceptions` | 18 条 **`toBe` 钉死确切值**(§3.3-a 的强断言要求) |
| 5 | `should not contain full-width ，；：？！（） … (except the 18 registered exceptions)` | 其余 **81** 条扫不出 |
| 6 | `covers exactly the 9 keys … that carry interpolation placeholders` | **toBe 9** |
| 7 | `zh_cn and en_us use the same set of {…} placeholder names` | 9 条两档占位符集合一致 |

**第 2 条为什么加**:P5b T1 评审的 Important I-1 已证明「length-only 检查」是盲区 —— 从两档同时删一个键,
`parity.test.ts`(只比两档互相相等)与 length 断言都不红,punctuation 循环还会 `continue` 跳过非字符串值。
P5b 已在自己的块里补了这条,本批**沿用而不是重新踩一次**。

**守卫范围只圈本批 99 键**,没有全量化 —— 既有 `aiResTurn` / `aiResFilesInTurns` 的两档占位符不一致
(`{s}` 是英文复数后缀)是有意设计,全量会当场红。块注释里写明了这一点。

### 5.1 🔴 全角标点实扫结果(自己重跑那一次)

**没有沿用附录 §A.5 的 18 条,而是自己对 99 条新键的 zh 值重跑了 `/[，；：？！（）]/`**:

```
full-width hits = 18
  aiKbPrFoldersTitle        待处理文件夹（top {top} / 共 {total} 组）
  aiKbPrOcrHint             慢 5-10x，只对真实索引的扫描件有用
  aiKbPrRecentFailures      最近失败（{n}）
  aiKbPtChunksTitle         切块结果（{n} 块）
  aiKbPtDefaults            默认 target=600, overlap=80, min=2（沙盒宽松值；生产用 600/80/5–20）。
  aiKbPtDoclingToggle       docling 转出的 markdown（{n} 字符）
  aiKbPtHelp1               上传一个文件，看 Parser 怎么处理它（切块 + 嵌入 + 评分）。
  aiKbPtMaxSize             最大 30 MB。PDF 首次会触发模型权重下载（~200 MB，一次性）。
  aiKbPtOcr                 OCR（扫描 PDF）
  aiKbPtOverlapNote         overlap 只对 plain 文本生效；markdown/source 按段落或函数边界切。
  aiKbPtQueryPlaceholder    （可选）输入 query，会计算每个 chunk 的余弦相似度
  aiKbPtScoredTitle         Query 相似度排名（top {n}）
  aiKbPtTooBig              文件超过 30 MB，沙盒不支持
  aiKbPtViaDocling          （经 docling 转 markdown）
  aiKbSetCurrentlyUsing     当前用：
  aiKbSetDeviceAutoCurrent  自动（当前 {r}）
  aiKbSetDeviceSet          推理设备：{label}
  aiKbSetSandboxHint        单文件试解析，不写入索引
```

与附录 §A.5 的 18 条做集合比对:

```
identical set? true
a5 only:  []
mine only: []
```

→ **实扫 18 条,与附录 §A.5 逐键一致**;`aiKbDeviceAuto` 的值「自动」不含 `/[，；：？！（）]/` 里的字符,
所以加了这个键后**例外仍是 18 条 —— 实测确认,不是推定**(brief §3.3 点名要求实测)。
⚠️ 按 brief 的提醒,`。`(U+3002)、`「」`、`·`(U+00B7)、`—`(U+2014)、`–`(U+2013)、`…`(U+2026)、
`×`(U+00D7)、`→`(U+2192) **都不在那个正则里**,一律按正则实扫结果判,没有按「看着像全角」加例外。

### 5.2 占位符实扫

同样自己重扫了 99 条:**9 条带 `{…}`,两档占位符名称集合逐条相同、零差异**,与附录 §A.6 一致。

```
aiKbPrFoldersTitle       [zh:top,total] [en:top,total] OK
aiKbPrRecentFailures     [zh:n]         [en:n]         OK
aiKbPrResolvedHint       [zh:device]    [en:device]    OK
aiKbPtChunksTitle        [zh:n]         [en:n]         OK
aiKbPtDoclingToggle      [zh:n]         [en:n]         OK
aiKbPtScoredTitle        [zh:n]         [en:n]         OK
aiKbSetConcurrencySet    [zh:n]         [en:n]         OK
aiKbSetDeviceAutoCurrent [zh:r]         [en:r]         OK
aiKbSetDeviceSet         [zh:label]     [en:label]     OK
```

另外全批实扫确认:**零字面 `@`**(所以不需要 `{'@'}` 转义,文件末尾的全量 bare-@ 守卫不会红)、
**零 `|`**、**零 `'`**、**零 `<` / `>`**、**零 `\`** → 99 行都能安全写成单引号 TS 字符串字面量。

### 5.3 RED 探针(6 条,全部还原)

| 探针 | 做法 | 报红的用例 |
|---|---|---|
| **1** | 给非例外键 `aiKbPrIndexedVectors` 的 zh 值尾部加一个全角 `：` | `× should not contain full-width ，；：？！（） in any zh_cn value from this batch (except the 18 registered exceptions)` |
| **2** | 把例外键 `aiKbSetCurrentlyUsing` 的全角 `：` 改成半角 `:` | `× pins the exact zh_cn value … for each of the 18 registered exceptions` / `AssertionError: expected '当前用:' to be '当前用：'` |
| **3** | `en_us.ts` 里把 `aiKbSetConcurrencySet` 的 `{n}` 改名 `{count}`(只改一档) | `× zh_cn and en_us use the same set of {…} placeholder names for each of these keys` |
| **4** | 从**两档同时**删掉 `aiKbPtRun` | `× every key in this batch is present as a string in both locales` / `expected [ 'aiKbPtRun' ] to deeply equal []` |
| **5** | 从测试文件的键数组里删掉 `'aiKbSwitchFailed'` | `× covers exactly the 99 keys this task added` / `expected 98 to be 99` |
| **6** | 从例外表里删掉 `aiKbSetSandboxHint` | `× registers exactly the 18 …` (`expected 17 to be 18`) **且** `× should not contain full-width …`(它随即被扫出来)—— 两条同时红,证明例外表与扫描是**互相咬合**的,不是各自空转 |

每条探针后都从备份还原,`git status` 回到只有本刀的 4 个文件改动(见 §7)。

---

## 6. 三门完整终值

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI
pnpm test                  > /tmp/p5c-t1-test.log  2>&1   # exit=0
pnpm exec vue-tsc --noEmit > /tmp/p5c-t1-tsc.log   2>&1   # exit=0(日志 0 行)
pnpm build                 > /tmp/p5c-t1-build.log 2>&1   # exit=0
```

```
 Test Files  319 passed (319)
      Tests  3160 passed (3160)
```

- **红项:0 条**(单轮干净,零复跑;已知噪声 `persist.test.ts` 的 IndexedDB flaky 与 `AgentComposer.test.ts`
  的 vue-i18n teardown 竞态本轮都没触发)。
- **文件数 319 → 319**(本刀零 `.vue`、零测试文件新增)✅ 与 brief §4 的预期一致。
- **用例数 3153 → 3160,+7**(`messageSyntax.test.ts` 的 7 条新 `it`)。实测终值,不是预测。
- `vue-tsc --noEmit` exit 0、日志空 → **零重复属性**(重复 key 会是 TS 错误)。
- `pnpm build` exit 0(唯一输出是既有的 chunk >500 kB 警告,与本刀无关)。
- **Service 仓零改动** → 按治理 §8 未跑跨仓 `pnpm build`、未跑 `pnpm install`。

### 6.1 零重名的主动核查(不靠报错发现)

```
src/i18n/zh_cn.ts : aiKb* = 295   (= 既有 196 + 本批 99)   全文件 key 1502,distinct 1502 → 零重复
src/i18n/en_us.ts : aiKb* = 295                            全文件 key 1502,distinct 1502 → 零重复
grep -n "aiKbDeviceAuto" 于改动前的两档 → 零命中(键名可用)
```

---

## 7. `git status` 干净证明

提交前:

```
 M .superpowers/sdd/p5c-appendix-A-i18n.md
 M src/i18n/en_us.ts
 M src/i18n/messageSyntax.test.ts
 M src/i18n/zh_cn.ts
```

外加 `git add -f .superpowers/sdd/p5c-task-1-i18n-verify.mjs` 与本报告(`.superpowers/sdd/` 被 gitignore 盖着)。
**未用 `git add -A` / `git add .`**,全部显式列路径;未 rebase / reset / stash / merge / push;
未跑 `deploy.sh`;未写 `/var/lib`;未改任何后端仓;未动 `:5288` 的 dev server;
**`/home/nimo/NimoTech/NimoOS-UI` 全程只读(只 `git show main:`),零 checkout / stash / commit。**

---

## 8. §3 的 K1–K30 逐条申报(本刀命中的)

本刀**只动 i18n 键值 + 一个测试文件 + 台账**,不落地任何 `.vue` / scss / store,因此 K21–K30
里绝大多数与本刀无关。逐条:

| 编号 | 本刀是否命中 | 说明 |
|---|---|---|
| **K16 模具**(P5b「硬编码英文改走 i18n」) | ❌ **本期不新开这类例外**(治理 §3.5 N22 末句明写) | 见 §9 的 N22 清单 |
| **K25** | 🔴 **明确无关** | K25 是「Parser 两页暗色档与 Vue2 不同」,是配色偏离;本刀零样式改动。**按报告契约显式申报:K25 与本刀无关。** |
| **K21 / K22 / K23 / K24** | ❌ 无关 | scss 作用域 / token 收口 / 独立文件,归 T2a·T2b |
| **K26 / K27 / K28** | ❌ 无关 | store 与取数层,归 T3·T4·T5 |
| **K29** | ❌ 无关 | reka 迁移弹窗,归 T9 |
| **K30** | ⚠️ **间接相关,已核** | K30(不回显后端 detail)决定了 `aiKbOpFailed` / `aiKbSwitchFailed` **不被砍成死键** —— 本刀据此判「死键 0 条」(附录 §A.7)。落地在 T8/T9,本刀只做计数判定。 |
| **K1–K20**(P5a/P5b 沿用) | ❌ 无关 | 取数层次 / 组件行为,本刀不涉及 |

**除上述之外没有任何偏离**;没有出现需要 `NEEDS_CONTEXT` 的判断。

---

## 9. §3.5 的 N1–N22 逐条申报 —— **确实照抄了**

### 9.1 🔴 N21 四组撞车 / 错译:一律照抄,零「顺手改对」

| # | 情形 | 本刀落地 | 逐条核过的证据 |
|---|---|---|---|
| 1 | `Resume` → 恢复 与既有 `aiKbRebuild`(`Rebuild` → 恢复)**zh 撞车** | **两个键都存在,zh 都是「恢复」** | `zh_cn.ts:1697 aiKbResume: '恢复'` + 既有 `zh_cn.ts:1573 aiKbRebuild: '恢复'`(未动);en 分别 `Resume` / `Rebuild`。**没有统一、没有改 `aiKbRebuild`** |
| 2 | `Test Sandbox`(SettingsView:162)/ `Test sandbox`(ParserStatus:6)只差首字母大小写 | **两个独立键** | `aiKbSetSandboxTitle` en=`Test Sandbox` · `aiKbPrTestLink` en=`Test sandbox`;两者 zh **都是「测试沙盒」**。英文档保留大小写差异 |
| 3 | 🔴 `Power-saving` / `Full power` 与既有 `aiKbCcPowerSaver` / `aiKbCcFullSpeed` zh 撞车但 **en 不同** | **新建 `aiKbPrCcPowerSaving` / `aiKbPrCcFullPower`,坚决未复用** | 回源实测既有值:`en_us.ts:1485 aiKbCcPowerSaver: 'Power saver'`、`en_us.ts:1487 aiKbCcFullSpeed: 'Full speed'` —— 与 Vue2 的 `Power-saving` / `Full power` **不同**。复用会让英文档渲染成 `Power saver` / `Full speed` = 界面不 1:1。zh 两边都是「省电」/「全力」,**没有统一**。(三档里只有 `Balanced` en 也相同 → 那一条**才**复用 `aiKbCcBalanced`) |
| 4 | `aiKbPrOcrHint` 中文是错译 + en/zh 标点不对称 | **逐码点照抄** | en `5–10× slower, only useful for truly scanned documents`(`–` U+2013 / `×` U+00D7)· zh `慢 5-10x，只对真实索引的扫描件有用`(ASCII `-` / `x` + 全角 `，`)。「truly **scanned**」被译成「真实**索引**的」**照抄不改**;`5–10×` **没有规范化成 ASCII**,`5-10x` **也没有升级成 `–`/`×`** |

⚠️ 附录 §A.3 末尾那条「另有一处 en/zh 标点不对称」也已照抄:`aiKbSetOcrWarn`
en=`Enabling this slows indexing 5–10×`(`–` + `×`)/ zh=`开启后速度慢 5-10×`(ASCII `-` + `×`);
`aiKbPtDefaults` 的 zh 里保留了 en 的 `5–20`(U+2013)。**全部由逐码点比对脚本背书。**

### 9.2 🔴 N16 emoji 位置:逐处回源确认,一个都没挪

`grep -nP` 扫 4 个蓝本里全部 emoji / 特殊符号行,逐行判定它在 `$t()` 内还是外:

| 蓝本行 | 原文 | 位置 | 本刀落地 |
|---|---|---|---|
| `SettingsView.vue:11` | `controlState.paused ? $t('⏸ Paused') : $t('✅ Running')` | 🔴 **`$t()` 里面** | `aiKbSetSvcPausedLine` = `⏸ Paused` / `⏸ 已暂停`;`aiKbSetSvcRunningLine` = `✅ Running` / `✅ 运行中` —— **键值本身含 emoji** ✅ |
| `ParserStatus.vue:53` | `$t('→ actual {device}', …)` | 🔴 **`$t()` 里面** | `aiKbPrResolvedHint` = `→ actual {device}` / `→ 实际 {device}` —— 值含 `→` ✅ |
| `ParserStatus.vue:6` | `🧪 {{ $t('Test sandbox') }}` | 外面 | `aiKbPrTestLink` = `Test sandbox` / `测试沙盒`,**不含 🧪** ✅ |
| `ParserStatus.vue:70–75` | `⏳` `🔄` `✅` `❌` `📦` `📍` + `{{ $t(...) }}` | 外面 | `aiKbPending`(复用)/ `aiKbPrQueueRunning` / `aiKbPrQueueDone` / `aiKbFailed`(复用)/ `aiKbPrIndexedVectors` / `aiKbLastSynced`(复用)—— **均不含 emoji** ✅ |
| `ParserStatus.vue:94` | `{{ failedOpen ? '▼' : '▶' }} {{ $t('Recent failures ({n})', …) }}` | 外面 | `aiKbPrRecentFailures` 不含 ▼/▶ ✅ |
| `ParserStatus.vue:27` | `('▶ ' + $t('Resume'))` / `('⏸ ' + $t('Pause'))` | **script 拼接** | `aiKbResume` = 纯 `Resume`/`恢复`;`aiKbPause` = 纯 `Pause`/`暂停` ✅ |
| `ParserTest.vue:5` | `← {{ $t('Back to details') }}` | 外面 | `aiKbPtBackLink` 不含 `←` ✅ |
| `ParserTest.vue:80` | `✓ {{ result.chunk_count }} chunks ·` | 外面(且整句非 i18n) | 不建键 ✅ |
| `ParserTest.vue:100` | `{{ doclingOpen ? '▼' : '▶' }}` | 外面 | 不建键 ✅ |
| `ParserTest.vue:110` | `⚠ Reranker error: {{ result.rerank_error }}` | 外面(且非 i18n,见 N22) | 不建键 ✅ |
| `ParserTest.vue:35` | `<button class="clear-btn" @click="clearFile">×</button>` | 外面(非 i18n) | 不建键 ✅ |
| `SettingsView.vue:67` | `📝 {{ $t('Knowledge notes') }}` | 外面 | `aiKbSetNotesSection` 不含 📝 ✅ |
| `SettingsView.vue:162` | `🧪 {{ $t('Test Sandbox') }}` | 外面 | `aiKbSetSandboxTitle` 不含 🧪 ✅ |
| `SettingsView.vue:171` | `⚠️ {{ $t('Danger zone') }}` | 外面 | `aiKbSetDangerZone` 不含 ⚠️ ✅ |
| `FolderBrowser.vue` | 零 emoji 命中 | — | — |

→ **`$t()` 内含 emoji / 特殊符号的只有 3 个键**(`aiKbSetSvcPausedLine` · `aiKbSetSvcRunningLine` ·
`aiKbPrResolvedHint`),其余一律在括号外、键值里干净。**零挪进、零挪出。**

### 9.3 🔴 N22 判定不入语言包的硬编码串清单

Vue2 **刻意**没把这些进 i18n(技术标识符 / 参数名 / 后端字段名)。本刀**没有为它们补键** ——
补了就是凭空多出 Vue2 没有的键,且两档一填英文 = 纯噪音。清单(行号本刀逐条实核):

| 蓝本 `file:line` | 硬编码串 | 为什么不入 |
|---|---|---|
| `ParserTest.vue:41` / `:45` / `:49` | `target_tokens` · `overlap_tokens` · `min_tokens`(三个 `<label>`) | 后端表单字段名,`fd.append('target_tokens', …)`(`:213-215`)用的同一个串 |
| `ParserTest.vue:65` | `rerank top-20` | ⚠️ **治理 §3.5 N22 写的是 `:66`,实测在 `:65`**(偏 1 行;不影响结论) |
| `ParserTest.vue:84-87` | `chunker={{…}}, target={{…}}, overlap={{…}}, min={{…}}` | 参数回显,键名即后端字段名 |
| `ParserTest.vue:110` | `⚠ Reranker error:` | 技术错误标签(且 emoji 在外) |
| `ParserTest.vue:116` / `:118` | `cos {{…}}` / `rr {{…}}` | 余弦 / rerank 分数的缩写标识符 |
| `ParserTest.vue:119` / `:135` | `chunk #{{…}}` | 技术编号 |
| `ParserTest.vue:136` | `{{ c.token_count }} tokens · offset {{…}}-{{…}}` | 技术计量 |
| `ParserTest.vue:140` / `:144` | `dense [0:8]:` / `sparse top:` | 向量调试标签 |
| `ParserTest.vue:80-82` | `✓ {{…}} chunks ·` / `{{ fmtBytes(size) }}` / `{{ result.mime }}` | 结果摘要行,Vue2 也没进 i18n |
| `ParserTest.vue:35` | `×`(清除文件按钮) | 符号按钮 |
| `ParserTest.vue:145` | `` `${t.token_id}:${t.weight}` `` join | 纯数据 |
| `SettingsView.vue:46` / `:47` | `GPU` / `CPU`(设备单选按钮) | 缩写,`deviceLabel`(`:220-221`)返回的 `'GPU (CUDA)'` / `'CPU'` 也是硬编码 |
| `ParserStatus.vue:122` / `:123` | `'GPU (CUDA)'` / `'CPU'`(`deviceOptions` label) | 同上 |
| `ParserStatus.vue:147` | `'—'`(`formatCursor` 的空值兜底) | 占位符号 |

### 9.4 其余 N 系列

| 编号 | 与本刀的关系 |
|---|---|
| **N15**(`.k-progress-card` 6 个类不搬) | ❌ scss 范畴,归 T2a |
| **N17**(`ParserStatus.vue:38` 数组下标取 i18n 照抄) | ⚠️ **本刀已把那 3 个字面量 `$t()` 全部收录成键**:`aiKbPrCcPowerSaving` / `aiKbCcBalanced`(复用)/ `aiKbPrCcFullPower`。**写法照抄的落地在 T6**,本刀只保证「三个键都在、名字能被那个数组字面量直接用」 |
| **N18 / N19 / N20** | ❌ 组件行为,归 T6/T7 |
| **N1–N14**(P5a/P5b 沿用) | ❌ 本刀不涉及 |

---

## 10. 用了哪几个 fixture / mock 形状

🔴 **本刀零 fixture、零 mock** —— 它不碰任何取数路径,只改 i18n 键值 + 一个纯字符串断言的测试文件。
治理 §4.1 那张五行 mock 层次表**与本刀无关**,留给 T4–T9。

---

## 11. 顾虑 / 挂账

1. **brief §1 的坐标偏差(已在 §3.2 报出,不影响结论)**:brief 列的 `SettingsView.vue:47` / `:222` / `:262`
   实际是 `:45` / `:219`(且 `:219` 是**另一个键**)/ `:301`。附录 §A.1 原表的 `:45` / `:301` / `:121` 是对的。
   → **按权威优先级(治理文件 + 附录 A > brief)以附录为准**,并在附录里留了 T1 的核实结论。
2. **brief §1「附录 A 里出现 `98` 的三处」低估**:实扫 14 个位置需要订正(§3.3 已逐处列出并全部改完)。
   → 若只按 brief 改「三处」,T6–T9 仍会从 §A.2 标题 / §A.5 / §A.6 / §A.8 读到 `98`。
3. **治理 §3.5 N22 里 `rerank top-20` 的行号是 `:66`,实测 `:65`**(偏 1 行,不影响结论,已在 §9.3 标注)。
4. **无 `NEEDS_CONTEXT` 项。** 本刀所有判定都有权威源实证,没有需要用户 / 协调者拍板的地方。
5. **给 T2a–T10 的提示**:`messageSyntax.test.ts` 的 P5c 块是**按批圈定**的,后续刀**不要**把它扩成全量
   (会撞既有 `aiResTurn` / `aiResFilesInTurns` 的有意不一致);要覆盖新批次请照样另加一个 `describe`。
