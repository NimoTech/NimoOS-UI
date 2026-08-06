# P1c-1 验收补丁 Task 3 — composer 侧接 SlashPopover + 退役旧 SlashMenu

## 背景

Task 2 已建好 `src/ai/components/shell/SlashPopover.vue`(与 `@` 面板同款外壳/键位/筛选,两阶段
command → target)。本任务把它接进输入框、按用户拍板的触发规则驱动它,并退役旧的
`SlashMenu.vue`(全屏遮罩+居中卡片,用户已否掉)。

用户拍板(2026-07-27 验收第 1 轮):
1. 形态照 `@` 面板(Task 2 已实现)
2. 选中 `/init` 后**同一面板内接着选目录**,Esc 退回上一层
3. 触发 = **输入框开头的 `/`**,且**能边敲边筛**(`/in` → 筛到 `/init`);现状"整个输入框只有一个 `/` 才弹、敲第二个字就失效"必须改掉

## 要改的文件

- 改:`src/ai/components/shell/AgentComposer.vue`
- 改:`src/ai/components/shell/AgentComposer.test.ts`(追加 describe)
- 删:`src/ai/components/shell/SlashMenu.vue`、`src/ai/components/shell/SlashMenu.test.ts`
- 改:`src/i18n/zh_cn.ts` + `src/i18n/en_us.ts`(**仅**删除因退役而不再被引用的键)

## SlashPopover 的对外契约(Task 2 已定,按此接线)

```ts
props:  open: boolean · stage: 'command' | 'target' · query: string ·
        folders: Array<{ id?: string|number; path: string }> · anchorRect: DOMRect | null
emits:  'pick-command'(name: string) · 'pick-target'(path: string) · 'back'() · 'close'()
```
接线前**先读 `SlashPopover.vue` 与 `SlashPopover.test.ts` 确认最终 props/emits 名**,以文件为准。

## 状态机(实现要求)

组件内新增状态:`slashOpen: boolean`、`slashStage: 'command' | 'target'`、
`slashQuery: string`、以及一个"已被 Esc 关掉、不要立刻自动重开"的记忆值(见下)。

**触发与筛选(取代 Vue2 307-310 那条"整串只有一个 `/`"的规则)**
每次 `onInput` 里(以及 Task 1 新增的 focus/click 同步路径中)重新推导:
- command 阶段:文本以 `/` 开头、且 `/` 之后**不含空白字符** → `slashOpen = true`,
  `slashQuery = text.slice(1)`。一旦出现空白(用户敲空格)或首字符不再是 `/` → 关闭并回到
  command 阶段。
- target 阶段:文本以 `/init `(命令名 + 一个空格)开头 → 保持打开,
  `slashQuery = text.slice('/init '.length)`(用于按目录 path 筛选)。若文本不再以 `/init` 开头
  → 退回 command 阶段重新推导。
- **Esc 关闭后不要立刻自动重开**:`close` 时记下当时的文本(例如 `slashDismissedText`),
  只有当文本变成**与之不同**的、仍满足触发条件的值时才重新打开。文本被清空或首字符不再是 `/`
  时清掉这个记忆值。
- `@` 与 `/` 互不打架:`slashOpen` 为真时跳过 mention 同步(Task 1 的 `syncMentionFromCaret`);
  反之 mention 打开时不推导斜杠。两者不得同时 open。

**键盘**:`onKeydown` 的第一行现在是 `if (mentionOpen) return`(面板自己吃键)。补上
`if (slashOpen) return` —— 让 SlashPopover 的 capture 监听独占 ↑↓/Enter/Tab/Esc/Backspace。
注意顺序:两个 return 都必须在 Enter 发送逻辑之前。

**三个 emit 的处理**
- `pick-command(name)`:目前只有 `'init'`。把文本规范化为 `` `/${name} ` ``(命令名 + 一个空格),
  `slashStage = 'target'`,`slashQuery = ''`,`nextTick` 里把光标移到文本末尾并 `grow()`。
  **不要**在这一步发任何请求。
- `pick-target(path)`:清空文本(`text = ''`)、关闭面板并回到 command 阶段、`nextTick(grow)`,
  然后 `emit('send-init', path)`。(这与 Vue2 `onInit` 613-617 的"关菜单 + 清输入 + 发 send-init"
  等价;`send-init` 已由 `AgentPage.vue` 接到 `store.sendInit`,不要改那一侧。)
- `back()`:`slashStage = 'command'`;把文本收回成 `` `/${命令名}` ``(去掉尾部空格),
  据此重新推导 `slashQuery`(于是 command 列表会高亮/筛到该命令);光标移到末尾。
- `close()`:`slashOpen = false`、`slashStage = 'command'`、记下 `slashDismissedText`。
  **不清空文本**(用户可能想继续编辑),这与 `closeMention` 的语义一致。

**target 阶段的候选**:沿用现有 `visibleFolders` 计算属性(= `chips` 里 `kind === 'folder'` 的项,
Vue2 257-259),作为 `:folders` 传入。

**切会话**:现有 `activeSessionId` watcher 里已有 `closeMention()`;在同一处补上关闭斜杠面板
(回到 command 阶段、清 dismissed 记忆),避免切会话后残留半截状态。

## 退役旧组件

- 删掉 `SlashMenu.vue` 与 `SlashMenu.test.ts`,并移除 composer 里对它的 import/挂载。
- 删除**仅**被旧组件引用的 i18n 键:先 `grep -rn "<key>" src/` 逐个确认零引用,再从
  `zh_cn.ts` 与 `en_us.ts` 同时删。预期候选:`aiSlashInitialize`(旧卡片的"初始化"按钮)。
  `aiSlashInitDesc` / `aiSlashNoFolders` 仍被 SlashPopover 使用 —— **不要删**。`aiCancel` 别处也在用
  —— **不要删**。删完 `pnpm test -- src/i18n/` 必须绿。
- 注:本仓的"删除全部推迟到 SP10"铁律只针对 **Vue2 老仓**;New-UI 里本期自己刚建、又被用户否掉的
  组件属于本期返工,直接删除即可(在报告与提交信息里说明)。

## 测试要求(TDD:先写、先看红)

在 `AgentComposer.test.ts` 追加 describe(现有 30 例必须全绿):

1. **开头的 `/` 才弹**:`setValue('/')` → SlashPopover 的 `open` 为 true、`stage='command'`;
   而 `setValue('hi /')`(句中的斜杠)→ 不弹
2. **边敲边筛**:`setValue('/in')` → `open` 仍为 true 且传入的 `query` 为 `'in'`
   (这正是旧实现做不到的:旧规则敲第二个字就失效)
3. **敲空格关闭**:`setValue('/init ')` 在 command 阶段 → 关闭(注意:这是 command 阶段的规则;
   进入 target 阶段是由 `pick-command` 驱动的,不是靠打空格)
4. **两阶段流程**:`setValue('/')` → 面板 `pick-command('init')` → 断言文本变成 `'/init '`、
   `stage='target'`、`folders` 收到的是已授权目录里 `kind==='folder'` 的那些
5. **选目录即发送**:接上一步 → 面板 `pick-target('/DATA/docs')` → 断言 `emitted('send-init')`
   为 `[['/DATA/docs']]` 且 textarea 已清空
6. **Esc 退层再退出**:target 阶段 `back()` → `stage` 回到 `'command'`、文本为 `'/init'`;
   再 `close()` → 面板关闭
7. **关掉后不自动重开**:`close()` 之后不改文本、再触发一次 `onInput`(或 focus 同步)→ 面板保持关闭;
   把文本改成 `'/i'` → 重新打开
8. **面板打开时 Enter 不发送**:`setValue('/')` 后在 textarea 上 `keydown Enter` → 不 emit `send`
9. **`@` 与 `/` 不同时开**:`setValue('/')` 打开斜杠后 `setValue('@doc')` → 斜杠关闭、mention 打开
10. **切会话关闭斜杠面板**:`setValue('/')` 打开 → 改 `store.activeSessionId` → 面板关闭

## 约束

- 颜色零改动、零裸色(本任务不写样式;若确需微调布局,颜色必须走 token)。
- 不新增 i18n 键(只删)。文案里若要写 `@` 必须 `{'@'}`(`messageSyntax.test.ts` 会拦)。
- 不改 `SlashPopover.vue`、`MentionPopover.vue`、store、`AgentPage.vue`。
  若发现 `SlashPopover` 契约缺东西(例如需要一个 prop 才能接线),**停下并报告 NEEDS_CONTEXT**,
  不要自行改它。
- 验证:`pnpm test`(全量,基线 30 例 composer + 全仓 1622+)、`pnpm exec vue-tsc --noEmit`、
  `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/AgentComposer.vue` 无输出。
