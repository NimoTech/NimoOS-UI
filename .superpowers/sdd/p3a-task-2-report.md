# SP8-P3a Task 2 报告 —— 类型 / `skillsFormat.ts` / 30 个 i18n 键

## 逐文件改了什么

### `src/ai/types/skill.ts`(新)
逐字照后端 `NimoOS-AI/service/skills.go:10-32` 的 `Skill`/`SkillFile` struct json tag,
字段名、顺序、类型一一对应,不增不减。`trigger_human` 字段保留(如实描述后端契约),
字段注释里写明本仓弃用、不得渲染,并指向 `skillsFormat.ts` 的 `triggerLabel()`
(brief §2.1、公共约束 §3 偏离 4)。

### `src/ai/util/skillsFormat.ts`(新)
三个纯函数,不 import `vue-i18n`:
- `triggerLabel(trigger, name)`:`'auto'` → `{key:'aiSkTriggerAutomatic'}`;
  `'slash'` → `{key:'aiSkTriggerSlash', params:{name}}`;`'manual'` → `{key:'aiSkTagManual'}`
  (**复用左栏短标签键,不新建**,brief §2.2 明确要求);其它 → `null`。
- `authorLabel(author)`:`'You'`(区分大小写)→ `{key:'aiSkAuthorYou'}`;其它 → `null`。
- `fileSizeLabel(size)`:`/^\((\d+) files?\)$/` → `{key:'aiSkNFiles', params:{n}}`;
  不匹配(含 `"12 B"`/`"1.0 KB"`/空串)→ `null`。

头注释登记后端产出坐标:`skills.go:191-199`(trigger→trigger_human 映射)、
`:184-190`(author 兜底 `"You"`)、`:138-148`(`humanSize`,字节单位格式化)——
均照 brief §2.2 给的坐标逐字抄录。并按 brief 要求引用了「界面永不回显后端原文」
这条用户约定的先例 `channelsFormat.addBotErrorKey`。

### `src/i18n/{zh_cn,en_us}.ts`(改)
各追加 30 个 `aiSk*` 键,写在 `// >>> SP8-P3a` / `// <<< SP8-P3a` 标记行之间、
文件导出对象最末尾(`aiCfgChannelsPairInstructions` 之后)。

## Vue2 file:line → New-UI 对照

| New-UI | Vue2 坐标 |
|---|---|
| `Skill`/`SkillFile` 字段 | `NimoOS-AI/service/skills.go:10-32`(后端 DTO,非 Vue2 前端文件 —— 本任务不移植组件) |
| `triggerLabel` | `skills.go:191-199`(`manifestToSkill` 的 trigger switch) |
| `authorLabel` | `skills.go:184-190`(`manifestToSkill` 的 author 兜底) |
| `fileSizeLabel` | `skills.go:138-148`(`humanSize`,及 `:162-180 listBundleFiles` 的 `"(N files)"` 拼接,brief 坐标只给了 humanSize 段,已照抄) |
| 30 个 i18n 值 | `NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json` 对应英文 key(brief §2.3 表,协调者已导出) |

本任务不涉及 Vue2 组件级迁移(那是后续任务),因此没有 DOM/class/交互层面的「承接 Vue2
行为」条目——承接的是**后端契约**与**已有译文**。

## i18n 复核证据

用 Python 脚本逐字节比对 brief §2.3 表格(30 行)与写入后的 `zh_cn.ts`/`en_us.ts` 提取值:
```
checked 30 keys
ALL MATCH
```
过程中发现并修正一处自造偏差:`aiSkEmpty` 中文值第一次写成全角逗号「，」,
brief 表格原文是半角逗号「,」(`还没有技能,点击 + 添加一个。`)——已改正为半角,
复核脚本确认现已逐字符匹配。这不是「偏离」,是我自己录入时的笔误,已在写入后
用脚本核对并修正,报告里如实记录。

写入前 `grep aiSk` 确认两档均无既有同名键;写入后 `grep -oP` 去重检查确认
30 个键各自只出现一次、两档键数相等(30/30)。

## RED → GREEN 证据(判别力弱的断言)

对 `skillsFormat.test.ts` 里判别力较弱的 4 组断言逐一做了破坏 → 观察精确报红 → 复原 → 确认绿的验证(每次只改一处,`git status` 全程只有预期的 i18n 两文件改动,`skillsFormat.ts` 复原后与破坏前完全一致):

1. **`triggerLabel('manual', …)` 分支** —— 改成误返回 `aiSkTagAuto`:
   ```
   FAIL  triggerLabel > manual → reuses aiSkTagManual (not a dedicated manual-detail key)
   AssertionError: expected { key: 'aiSkTagAuto' } to deeply equal { key: 'aiSkTagManual' }
   ```
   复原后:15 passed。

2. **`fileSizeLabel` 单复数正则** —— 去掉 `?` 变成必须复数 `files`:
   ```
   FAIL  fileSizeLabel > "(1 file)" (singular, no trailing s) → aiSkNFiles with n=1
   AssertionError: expected null to deeply equal { key: 'aiSkNFiles', params: { n: 1 } }
   ```
   复原后:15 passed。

3. **`authorLabel` 大小写** —— 改成 `author.toLowerCase() === 'you'`:
   ```
   FAIL  authorLabel > is case-sensitive: "you" (lowercase) is not the sentinel → null
   AssertionError: expected { key: 'aiSkAuthorYou' } to be null
   ```
   复原后:15 passed。

4. **`fileSizeLabel` 字节单位透传** —— 正则放宽成任意含数字 `/(\d+)/`:
   ```
   FAIL  fileSizeLabel > "12 B" byte-unit string passes through untouched → null
   FAIL  fileSizeLabel > "1.0 KB" byte-unit string passes through untouched → null
   (2 failed, 13 passed)
   ```
   复原后:15 passed。

四次探针均精确命中预期用例、未误伤其它用例,复原后 `git diff -- src/ai/util/skillsFormat.ts`
为空。

## 三门完整终值

```
pnpm test                   exit=0
  Test Files  287 passed (287)
  Tests       2350 passed (2350)

pnpm exec vue-tsc --noEmit  exit=0   (无输出)

pnpm build                  exit=0
  (! 仅既有第三方包 chunk 体积告警,无新增错误/警告)
```

基线 286 文件/2335 例 → 现 287 文件/2350 例(新增 1 个测试文件、15 个用例,
与 `skillsFormat.test.ts` 的用例数一致)。无红项,无需归属既有 flaky
(`src/files/upload/persist.test.ts` 本次未见异常)。

## i18n 键清单

**复用(未重复定义)**:`aiCfgRefresh`、`aiCfgSkills`(brief §2.3 明确指出的可复用键,
本任务未在 30 键列表中重复出现,已 grep 确认原有定义各只有一处)。

**新增 30 个**(`aiSk` 前缀,两档逐字一致,值见上文复核证据):
`aiSkSearchPlaceholder`、`aiSkBuiltIn`、`aiSkYours`、`aiSkNoMatch`、`aiSkEmpty`、
`aiSkLoadFailed`、`aiSkTagAuto`、`aiSkTagSlash`、`aiSkTagManual`、`aiSkNRuns`、
`aiSkOff`、`aiSkPickLeft`、`aiSkPickLeftSub`、`aiSkTryInChat`、`aiSkStatus`、
`aiSkActive`、`aiSkPaused`、`aiSkTrigger`、`aiSkAddedBy`、`aiSkLastRun`、
`aiSkNTotal`、`aiSkDescription`、`aiSkDescHint`、`aiSkMdHint`、`aiSkBundledFiles`、
`aiSkNFiles`、`aiSkNoBundledFiles`、`aiSkTriggerAutomatic`、`aiSkAuthorYou`、
`aiSkTriggerSlash`。

近义串 `aiSkTagAuto`(自动 / 左栏短标签)与 `aiSkTriggerAutomatic`(自动触发 / 右栏详情)
按 brief 要求**未合并**,各自独立定义、独立使用。

## 偏离申报

- 本任务未命中公共约束 §3 列出的 6 条已授权偏离中的任何一条新增行为(偏离 4
  `trigger_human` 弃用是 Task 2 的**既定契约**而非本任务新造的偏离,`triggerLabel`
  正是该契约的实现,已在 `types/skill.ts`/`skillsFormat.ts` 注释里对应说明)。
- 未发现与「brief 权威表格」冲突之处,唯一订正是上文所述的全角/半角逗号笔误,
  已用脚本核对修正,不构成需要申报的「偏离」(未改变 brief 规定的值,只是我
  录入时打错标点、已按权威表格改正)。
- 无 `NEEDS_CONTEXT` 项。

## 自查(提交前)

- `git status` 提交前只包含本任务应改的 4 个文件(2 改 2 新增),无 `.scss` 改动
  (未触碰 Task 1 产出)。
