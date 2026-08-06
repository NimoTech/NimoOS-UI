# SP8-P3b Task 2 —— 实现报告

工作区:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,起点 `f613947`。

## 逐文件改了什么

- **新建** `src/ai/util/sandboxRun.ts`——纯函数 `initSandboxState()` / `reduceSandboxEvent(s, ev, elapsedMs)`。
  对齐 Vue2 `NimoOS-UI/src/views/AI/Skills/TestPanel.vue:158-172`(`run()` 里的 `onEvent` 回调)。
- **新建** `src/ai/util/sandboxRun.test.ts`——15 个用例(见下方 RED→GREEN 与用例清单)。
- **新建** `src/ai/util/skillsErrorKey.ts`——`createSkillErrorKey(e)` / `validateSkillForm(name, description)`。
  形状照 `src/ai/util/channelsFormat.ts:65-76`(`addBotErrorKey`)。
- **新建** `src/ai/util/skillsErrorKey.test.ts`——33 个用例。
- **改** `src/i18n/zh_cn.ts` / `src/i18n/en_us.ts`——新增一段 `// >>> SP8-P3b Task 2` … `// <<< SP8-P3b Task 2` 标记块,74 个新键(逐字照任务书 §2.3 表格,含两处尖括号转义)。
- **改** `src/i18n/messageSyntax.test.ts`——补一个 `describe('aiSkScriptsHint and aiSkErrDescAngle keys …')`,4 个渲染回归用例,钉死两条尖括号文案的最终渲染结果。

## Vue2 file:line → New-UI 对照

| Vue2 | New-UI |
|---|---|
| `TestPanel.vue:158-172`(`onEvent` 回调,SSE 事件分派) | `sandboxRun.ts` 的 `reduceSandboxEvent` |
| `TestPanel.vue:162`(`output.steps.push(ev.content)`,每片单独一行) | 【偏离 D2,见下】改为累积到同一 text 步 |
| `TestPanel.vue:165`(`ev.tool \|\| ev.name \|\| 'tool'`) | `(ev.tool as …) ?? (ev.name as …) ?? 'tool'` |
| `TestPanel.vue:167`(`this.error = ev.content \|\| this.$t('Run failed')`) | `error = String(ev.content ?? '')`(按任务书表格逐字要求,不落回 `aiSkTestFailed`——纯函数不碰 i18n,由调用方决定空 error 串怎么显示) |
| `TestPanel.vue:70-73`(`output.tokens != null` 分支) | 不移植,`SandboxState` 无 `tokens` 字段 |
| `AddSkillModal.vue:137-139`(仅查非空) | `validateSkillForm` 【偏离①】 |
| `AddSkillModal.vue:164-167`(`continue` 静默丢弃 >1MiB 文件) | 【偏离⑦】新增 `aiSkFilesSkippedTooBig` 文案(本任务只加键,消费在后续 Task) |
| `SkillDetail.vue:161`(承诺可从内置目录重装) | 【偏离 D3】`aiSkUninstallBody` 改为说实话 |
| （无对应 UI,`skills_runtime.go:57`) | 【偏离 D4】`aiSkTryDisabledTitle/Body/EnableAndTry` |

## 承接了 Vue2 哪些行为

- `message_delta`/`message`/`text` 三种事件类型统一归为文本步、`tool_call` 单独一行的**分类逻辑**照抄。
- `tool_call` 的 `tool ?? name ?? 'tool'` 回落顺序照抄。
- `done` 写 `ms`(仅计时来源从 `Date.now() - startedAt` 改为调用方传入的 `elapsedMs`,以保持纯函数可测——不是行为偏离,是纯函数化的必然重构)。
- `validateSkillForm` 的字段级判定顺序(name 先于 description;description 内部先查空、再长度、再单行、再尖括号、再控制符)照抄后端 `validateSkillDescription` 的判定顺序。

## 偏离显式申报(§3 12 条清单命中项)

1. **D2(沙箱输出累积)**——命中。`reduceSandboxEvent` 对连续文本事件追加到同一 `SandboxStep`,而非 Vue2 逐片单独 push。代码注释已加在 `sandboxRun.ts` 头部。
2. **D3(卸载文案说实话)**——命中。`aiSkUninstallBody` 值改为「无法恢复,需要重装系统或手工把技能目录放回」,注释已加。
3. **D4(停用技能先提示)**——命中(仅本任务加键:`aiSkTryDisabledTitle`/`Body`/`aiSkTryEnableAndTry`;实际弹窗逻辑在后续消费任务)。
4. **偏离①(前端预校验)**——命中,`validateSkillForm` 新建。
5. **偏离⑦(>1MiB 不静默丢弃)**——命中(本任务只新增 `aiSkFilesSkippedTooBig` 键,未消费)。
6. 其余 8 条(D1/D5/⑧⑨⑩⑪⑫)本任务未涉及组件/样式/SSE 消费,不命中。

「不实现 `tokens`」不是新偏离——是任务书 §2.1 明确指示的处理方式(死分支不移植,留 RED 探针钉死),已按要求做。

## RED → GREEN 证据

**探针 1:破坏 sandboxRun 的文本累积逻辑**(把 `if (last.kind==='text') 追加 else push` 改成无条件 `push`):
```
FAIL  src/ai/util/sandboxRun.test.ts > sandboxRun > text and message also participate in the same accumulation
AssertionError: expected [ { kind: 'text', text: 'A' }, …(2) ] to deeply equal [ { kind: 'text', text: 'ABC' } ]
 Tests  2 failed | 13 passed (15)
```
复原后:
```
Test Files  1 passed (1)
     Tests  15 passed (15)
```
`diff` 确认还原后文件与探针前逐字节一致。

**探针 2:禁用 skillsErrorKey 的尖括号错误分支**(`if (s.includes('are not allowed') && s.includes('<'))` → `if (false)`):
```
FAIL  src/ai/util/skillsErrorKey.test.ts > createSkillErrorKey > maps "invalid skill description: '<' and '>' are not allowed"
AssertionError: expected 'aiSkErrCreateFailed' to be 'aiSkErrDescAngle'
 Tests  1 failed | 32 passed (33)
```
复原后:
```
Test Files  1 passed (1)
     Tests  33 passed (33)
```
`diff` 确认逐字节一致还原。

## 三门完整终值

```
pnpm test:                  Test Files  293 passed (293) · Tests  2470 passed (2470) · exit=0
pnpm exec vue-tsc --noEmit: exit=0(无输出)
pnpm build:                 exit=0,仅既有 >500KB chunk 警告(index-kz3nBTao.js 3.1MB / ExcelViewer 1.68MB 等),无新增警告
```
无红项。

**算术**:基线 291 文件 / 2418 例 → 本任务 293 文件(+2:`sandboxRun.test.ts`、`skillsErrorKey.test.ts`,无新 `.vue`,color-guard 用例数不变)/ 2470 例(+52 = 15 + 33 + 4,4 为 `messageSyntax.test.ts` 新增的尖括号渲染回归)。逐项核对无误。

## i18n 复用/新增键清单

**复用(7 个,均已核对存在)**:`aiCancel`、`aiCfgRefresh`、`aiSkDescription`、`aiSkTrigger`、`aiSkTagManual`、`aiCopied`、`aiSkPaused`/`aiSkActive`。

**新增 74 个**(zh_cn/en_us 键集逐一比对完全一致,`parity.test.ts` 绿):
```
aiSkAddSkill aiSkDisable aiSkEnable aiSkDisableTemporarily aiSkCopyMd aiSkExport
aiSkUninstall aiSkDeleteSkill aiSkDelete aiSkUninstallTitle aiSkDeleteTitle
aiSkUninstallBody aiSkDeleteBody aiSkNPrevRuns aiSkEnabledToast aiSkPausedToast
aiSkUpdateFailed aiSkUninstalledName aiSkDeletedName aiSkDeleteFailed aiSkAddedName
aiSkAddTitle aiSkFieldName aiSkNamePlaceholder aiSkNameHint aiSkDescPlaceholder
aiSkDescFormHint aiSkFieldColor aiSkOptional aiSkScriptFiles aiSkScriptsHint
aiSkSavedLocally aiSkCreating aiSkCreate aiSkTrigOptAuto aiSkTrigDescAuto
aiSkTrigOptSlash aiSkTrigDescSlash aiSkTrigDescManual aiSkMdPlaceholderHead
aiSkMdPlaceholderBody aiSkFilesSkippedTooBig aiSkErrDuplicate aiSkErrBadId
aiSkErrDescRequired aiSkErrDescTooLong aiSkErrDescSingleLine aiSkErrDescAngle
aiSkErrDescControl aiSkErrBadPath aiSkErrBundleTooLarge aiSkErrMdTooLarge
aiSkErrCreateFailed aiSkTestTitle aiSkTestHint aiSkTestPill aiSkTestTryName
aiSkTestDiscard aiSkTestOffTitle aiSkTestOffBadge aiSkTestRun aiSkTestRunning
aiSkTestExamples aiSkTestRunningLabel aiSkTestBootstrapping aiSkTestCompleted
aiSkTestClosed aiSkTestFailed aiSkTestPlaceholderEx aiSkTestPlaceholder
aiSkTestHttpFailed aiSkTryDisabledTitle aiSkTryDisabledBody aiSkTryEnableAndTry
```
(74 个,与任务书 §2.3 表格逐行核对一致——programmatic diff 空。)

**「Vue2 没有的新文案」标注结论(与任务书表述有出入,已如实核对,见下方「与任务书的一处数字分歧」)**:
逐字符 `grep '\*\*'` 扫描 `p3b-task-2-brief.md` 原文,**表格里实际加粗的行只有 6 条**,不是任务书 §2.4 验收标准写的「9 条」:
`aiSkUninstallBody`、`aiSkFilesSkippedTooBig`、`aiSkTestHttpFailed`、`aiSkTryDisabledTitle`、`aiSkTryDisabledBody`、`aiSkTryEnableAndTry`。
**与任务书的一处数字分歧**:任务书 2.4 节写「标出加粗那 9 条新文案」,但 §2.3 表格本身只标了 6 行粗体。已按实际表格内容(grep 可复现)执行,以 6 条为准并在此显式申报这处数字不一致,供评审/协调者裁定是否要追加其它 3 条到"新文案"名单(若是,需要协调者指出具体哪 3 条,因为表格本身没有标记它们)。

## 正则回权威源核对结论

- Go:`NimoOS-AI/service/skills_store.go:86`
  ```go
  var skillIDRe = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$`)
  ```
- Python:`NimoOS-AI/agent/main.py`(sandbox-run 端点,`re.match` 那行)
  ```python
  re.match(r"^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$", req.skill_id)
  ```
- **结论:两处字面完全一致**,无分歧。`skillsErrorKey.ts` 里的 `SKILL_ID_RE` 采用该字面。
- **边界推算**(用于自查 `.test.ts` 的边界用例):首字符 1 + 中间 `{0,62}` 最多 62 + 末字符 1 = **总长上限 64**,合法区间 `65` 即非法。Go 侧文档注释(`skills_store.go:88`)也写明「≤64 chars」,与此一致。任务书 §2.2 末尾写「63 字符边界」——经回源验证,**实际边界是 64/65,不是 63**;`.test.ts` 里用的是回源验证后的 64(合法)/ 65(非法),已在测试注释里说明依据 skillIDRe 直接推算,不是套用任务书原话。

## 尖括号渲染实测结论与最终写法

用最小 `createI18n` 探针分别渲染裸字面 `<name>`/`< 和 >` 与转义写法 `{'<'}name{'>'}`/`{'<'} 和 {'>'}`:
- **两种写法解析结果完全相同**,均不抛错。
- **区别**:裸字面会在 stderr 打一条 `[intlify] Detected HTML in '...' message. Recommend not using HTML messages to avoid XSS.` 警告;转义写法不触发该警告。
- **最终选择:转义写法**(`{'<'}`/`{'>'}`)——渲染结果与裸字面完全一致,但没有 intlify 的 XSS 检测噪声,且与本仓已有的 `{'@'}` 转义惯例一致,风格统一、无副作用。
- 已在 `messageSyntax.test.ts` 补 4 条渲染回归用例(zh_cn/en_us × `aiSkScriptsHint`/`aiSkErrDescAngle`),钉死解析后的字面值。

## 测试质量

- mock 无需 `vi.hoisted()`(两个 util 都是纯函数,无外部依赖需要 mock)。
- 无 `nextTick`/`flushPromises` 场景(同步纯函数)。
- 未削弱/删除任何既有断言;`messageSyntax.test.ts` 原有 5 个用例逐字未动,只新增一个 `describe` 块。

## 提交

单次提交,只含本任务 6 个文件(4 新建 + 2 修改的 i18n + 1 修改的 messageSyntax.test.ts,共 7 个 diff 条目):
`src/ai/util/sandboxRun.ts`、`src/ai/util/sandboxRun.test.ts`、
`src/ai/util/skillsErrorKey.ts`、`src/ai/util/skillsErrorKey.test.ts`、
`src/i18n/zh_cn.ts`、`src/i18n/en_us.ts`、`src/i18n/messageSyntax.test.ts`。

---

## 追加:评审 T2 后的修复(Important ×1 + Minor ×1,Minor ×1 记账不动)

评审判定 ❌,以下逐条处置。

### Important(已修)—— `aiSkUninstallTitle`/`aiSkDeleteTitle` 全角问号

**根因**:`src/i18n/zh_cn.ts` 里这两个键的问号打成了全角 `？`(U+FF1F),权威源
`/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/zh_CN.json:931-932` 与任务书表格都是
半角 `?`(U+003F)。违反「不许改标点」硬约束,且当时无任何断言覆盖这两个键的具体
内容(只覆盖了尖括号那两条),只能靠人工逐字符 diff 抓到。

**改了什么**:
1. **码点核对**:用 `python3` 按码点逐一打印确认改前是 `0xff1f`(全角)、改后是
   `0x3f`(半角),不靠肉眼看:
   ```
   改前: aiSkUninstallTitle '卸载这个技能？' [..., '0xff1f']
   改前: aiSkDeleteTitle    '删除这个技能？' [..., '0xff1f']
   改后: aiSkUninstallTitle '卸载这个技能?' [..., '0x3f']
   改后: aiSkDeleteTitle    '删除这个技能?' [..., '0x3f']
   ```
   `src/i18n/zh_cn.ts` 两行改为半角 `?`。
2. **补自动化守卫**(`src/i18n/messageSyntax.test.ts` 新增
   `describe('P3b Task 2 aiSk* keys — no accidental full-width punctuation')`,3 个用例):
   - 先扫了本期新增的全部 74 个 `aiSk*` 值,确认除这两处外**没有其它意外全角标点**——
     命中的全角字符只有省略号 `…`(`aiSkCreating`/`aiSkMdPlaceholderBody`/
     `aiSkTestRunning`/`aiSkTestRunningLabel`/`aiSkTestBootstrapping`),这些逐字照
     任务书表格,是**故意**用省略号,不在本次修复范围。
   - **范围收窄到本期新增的 74 个键**(硬编码键名列表,附一条用例断言列表长度
     恰为 74,防止清单本身漂移),断言这些键的 zh_cn 值里不出现全角 `？`/`！`/`：`。
     **有意不扩到全量 `zh_cn.ts`**:既有键（P3a 及更早）没有逐一回权威源核对过每种
     标点是否都是半角,贸然扩大断言面等于把未经核对的假设编码成断言、可能对既有
     合法用法产生误报(遵协调者「若判断会冲突就退回窄断言」的备选指示,这里没有
     发现冲突,但主动收窄到"本期新增+确认过的" 范围,理由同上)。
   - 另加一条对 `aiSkUninstallTitle`/`aiSkDeleteTitle` 的精确内容断言,直接
     `codePointAt` 校验末字符是 `0x3f`,把评审这次靠人工发现的问题钉死成程序化门槛。
   - **RED→GREEN**:临时把 `aiSkUninstallTitle` 改回全角 `？`,新守卫 2 个用例精确
     报红(`should not contain full-width …` + `end with a half-width "?"`
     两条,附完整用例名与断言输出);`cp`/`diff` 确认还原后文件逐字节一致;复跑绿。

### Minor(已修)—— `skillsErrorKey.test.ts` 编造的字节数

**根因**:`SKILL.md exceeds 32768 bytes (got 40000)` 里的 `32768`/`40000` 是编的,
真实常量 `MaxSkillMDBytes = 50 * 1024 = 51200`
(`NimoOS-AI/service/skills_store.go:118-121`,错误串本身在 `:155`/`:229`:
`fmt.Errorf("SKILL.md exceeds %d bytes (got %d)", MaxSkillMDBytes, size)`)。
改为 `'SKILL.md exceeds 51200 bytes (got 60000)'`(限制用真实常量,"got" 用一个明显
超限的示例值,前缀匹配逻辑本身不受数值影响,只是这次不再是手编的假串)。

### Minor(记账不动,按协调者指示)

`validateSkillForm` 的多重违规优先级判定方式未改动——协调者已定性为"单一违规场景
与后端一致、已被测试覆盖,只在多重违规同时出现的极端组合下可能分类不同",并明确
指示本任务不处理,记入台账延后。

### 跑了哪些测试 / 命令 / 输出

```bash
cd /home/nimo/NimoTech/.sp8/NimoOS-New-UI

# 1) 先跑受影响的三档,确认修复生效
pnpm exec vitest run src/i18n/messageSyntax.test.ts src/i18n/parity.test.ts src/ai/util/skillsErrorKey.test.ts
# → Test Files  3 passed (3) · Tests  48 passed (48)

# 2) RED 探针:临时把 aiSkUninstallTitle 改回全角问号
pnpm exec vitest run src/i18n/messageSyntax.test.ts
# → Test Files  1 failed (1) · Tests  2 failed | 10 passed (12)
#   FAIL "should not contain full-width ？，！ or ： in any zh_cn value from this batch"
#   FAIL "aiSkUninstallTitle and aiSkDeleteTitle end with a half-width "?" (U+003F) ..."

# 3) 还原(diff 确认逐字节一致)后复跑
pnpm exec vitest run src/i18n/messageSyntax.test.ts
# → Test Files  1 passed (1) · Tests  12 passed (12)

# 4) 全量三门
pnpm test                      > /tmp/p3b-t2-fix-test.log  2>&1; echo "exit=$?"   # exit=0
pnpm exec vue-tsc --noEmit     > /tmp/p3b-t2-fix-tsc.log   2>&1; echo "exit=$?"   # exit=0
pnpm build                     > /tmp/p3b-t2-fix-build.log 2>&1; echo "exit=$?"   # exit=0
```

**全量终值**:`Test Files 293 passed (293)` · `Tests 2473 passed (2473)`
(比修复前 +3:新增守卫的 3 条用例,无新增 `.vue`,color-guard 用例数不变)·
tsc 无输出 exit=0 · build 仅既有 >500KB chunk 警告,exit=0。无红项。

### 修复涉及的文件

`src/i18n/zh_cn.ts`(改 2 行标点)、`src/i18n/messageSyntax.test.ts`(新增 1 个
`describe` / 3 个用例)、`src/ai/util/skillsErrorKey.test.ts`(改 1 行字节数,连带
用例标题里的数字)。均在原提交 `b8357ee` 基础上新开一次提交,未 rebase/amend。
