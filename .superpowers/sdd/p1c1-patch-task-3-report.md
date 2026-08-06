# P1c-1 验收补丁 Task 3 报告 — composer 侧接 SlashPopover + 退役 SlashMenu

## 状态机(实现)

`AgentComposer.vue` 新增 `slashStage: 'command'|'target'`、`slashQuery: string`、
`slashDismissedText: string|null`(既有 `slashOpen` 复用)。核心是一个纯函数
`deriveSlashState()`,每次调用只看当前 `text.value` + 当前 `slashStage`,不依赖调用历史:

- `v` 为空或 `v[0] !== '/'`:强制关闭、回 command 阶段、清空 query、**清掉**
  `slashDismissedText`(对应 brief"文本清空或首字符不再是 `/` 时清记忆")。
- `slashStage==='target'`:`v` 仍以 `/init `(命令名+一个空格)开头 → 停留 target,
  `query = v.slice('/init '.length)`;否则退回 command 阶段,落到下面按 command 规则重推(例如
  用户把 `/init ` 删成 `/in` → 回到 command 阶段并筛到 `init`)。
- command 阶段:`/` 之后不含空白 → 打开,`query = v.slice(1)`;一旦出现空白 → 关闭(仍留在
  command 阶段 —— 进 target 阶段只能靠 `pick-command`,不是打空格)。

**Esc 记忆**:`close` emit → `onSlashPopClose()` 记 `slashDismissedText = text.value`,
`slashOpen=false`,回 command 阶段,**不清空文本**。真正打开的判定收在
`openSlashIfNotDismissed(v)`:仅当 `slashDismissedText !== v` 才置 `slashOpen=true`;文本
不变则保持关闭。onInput/onFocus/onClick 三条路径都走同一个 `deriveSlashState()`,所以
"focus/click 不复活被 Esc 关掉的面板"是同一份逻辑的自然结果,没有另开分支。

**`@`/`/` 互斥**:新函数 `syncPanelsFromText()` 是三条输入路径(onInput/onFocus/onClick)的唯一
入口——先 `deriveSlashState()`,若 `slashOpen` 为真则强制 `closeMention()`(若还开着)并 return,
不再推导提及;否则走原有 `syncMentionFromCaret()`。无论切换方向(斜杠→提及 或 提及→斜杠)都在
这一处收口,不会出现两者同时 open。

**键盘**:`onKeydown` 在既有 `if (mentionOpen.value) return` 之后补
`if (slashOpen.value) return`,两者互斥故顺序不敏感,均在 Enter 发送逻辑之前。

## 三个 emit 处理

- `pick-command(name)` → `onSlashPickCommand`:`text = \`/${name} \``,`slashStage='target'`,
  `slashQuery=''`,`nextTick` 里 focus+光标到末尾+`grow()`。不发任何请求。
- `pick-target(path)` → `onSlashPickTarget`:清空 `text`、`slashOpen=false`、回 command 阶段、
  清 `slashDismissedText`、`nextTick(grow)`,再 `emit('send-init', path)`(`AgentPage.vue` 侧
  `store.sendInit` 接线未动)。
- `back()` → `onSlashBack`:从当前 `` `/${cmd} <query>` `` 文本按第一个空格切出 `cmd`,
  `text = \`/${cmd}\``,`slashStage='command'`,再调 `deriveSlashState()` 重推(自然产出正确的
  `slashQuery`),光标移到末尾。
- 原生 `close` → `onSlashPopClose`:见上方 Esc 记忆段落。

`activeSessionId` watcher 追加:`slashOpen=false`、回 command 阶段、清 `slashDismissedText`
(与已有 `closeMention()` 并列,整体重置而非记一次 dismiss)。

## i18n 键删除

仅删 `aiSlashInitialize`(旧 SlashMenu"初始化"按钮专用),`zh_cn.ts`/`en_us.ts` 同时删。
`grep -rn "aiSlashInitialize" src/` 删除前后各跑一次,删除后零命中(退出码 1)。
`aiSlashInitDesc`/`aiSlashNoFolders`/`aiCancel` 均确认仍被 SlashPopover.vue / 别处引用,未删。
`pnpm test -- src/i18n/` 3 files / 9 tests 全绿(含 parity.test.ts)。

## 删除清单 及 为何不违反"删除推迟到 SP10"

删除 `SlashMenu.vue` + `SlashMenu.test.ts`(4 例)、`AgentComposer.vue` 里的 `import SlashMenu`/
模板挂载/`onInit()` 函数、`AgentComposer.test.ts` 里唯一一条针对旧组件+旧触发规则("整串正好一个
`/`")的测试用例(该用例断言的行为正是本补丁替换掉的东西,留着必然变红,其覆盖面已被新增的 10 例
中的 1/2/4/5/8 完全取代)。"删除一律推迟到 SP10"这条铁律管的是 **Vue2 老仓**的迁移遗留代码;
这里删的是 **New-UI 本期(SP8)自己刚写、又在验收第 1 轮被用户否掉**的返工产物,不在该铁律约束
范围,brief 原文也明确写了这一点。

## RED

新增 10 例 + 删除旧例后先跑:`Test Files 1 failed (1) / Tests 10 failed | 29 passed (39)` ——
10 个新用例全部因 `SlashPopover` 尚未接入(`Cannot call vm/props on an empty VueWrapper`,以及
Enter 未被拦截误发 `send`)而失败,29 个既有用例(其中含刚删掉 1 例后的 29 = 30-1)全绿。

## GREEN

接线完成后:`AgentComposer.test.ts` → `Test Files 1 passed (1) / Tests 39 passed (39)`
(= 30 基线 - 1 条被替换的旧用例 + 10 条新用例)。

全量 `pnpm test`(改动前基线,任务开始时先跑过一次确认):**245 files / 1637 tests**。
改动后:**244 files / 1641 tests 全绿**(−1 file 为 `SlashMenu.test.ts` 整体删除;composer 测试
文件净 +9 例[−1 条旧用例 +10 条新用例],其余文件不变,与 245/1637 → 244/一千六百四十一 的算术
有 1 的出入,已定位:全量跑的第一次里 `src/files/upload/persist.test.ts` 出现过一次因跨用例
IndexedDB 状态污染导致的既存 flake——单独跑该文件 14/14 全绿,连续复跑全量套件后是
`244 files / 1641 tests` 全绿且无 flake 复现,与本任务改动无关,不在本任务范围)。

`pnpm exec vue-tsc --noEmit`:0 错误。
`grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/AgentComposer.vue`:
无输出。

## 未改动但留意到的点

- `SlashPopover.vue`/`SlashPopover.test.ts` 未动(按要求只读)。
- `tokens.scss`、`en_us.ts`/`zh_cn.ts` 里仍有几处提到 "SlashMenu" 的**历史注释**(记录
  `--modal-scrim-soft` token 是为它加的、i18n 键分组注释等)——这些是文档记录,不是代码引用,
  未删改,`grep -rln SlashMenu src/` 之后只剩这些注释性文件(SlashPopover.vue 头注释、
  AgentComposer.test.ts 本文件的说明注释、tokens.scss、两个 i18n 文件),均确认为文字记录而非
  死引用。
- `AgentComposer.vue` 文件头 Task 9/10/11 的历史叙述段落原样保留(准确记录当时状态),只在
  `visibleFolders` computed 旁的过期注释("SlashMenu 的 folders prop")上做了最小修正,新增一段
  "SP8-P1c1 验收补丁 Task 3" 记录本次改动,未触碰 Task 9-11 段落本身。
