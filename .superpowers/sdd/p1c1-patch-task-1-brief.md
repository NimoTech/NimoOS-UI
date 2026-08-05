# P1c-1 验收补丁 Task 1 — @ 提及面板:失焦关闭后能自动回来

## 背景(用户验收反馈 2026-07-27)

用户操作:输入 `@` → 连续钻两级目录 → 切到别的页面/标签页 → 切回来。
现象:**输入的文字还在,但 @ 面板不见了**,而且点回输入框也不会回来,必须再敲一个字符。

根因(已核代码,非猜测):`src/ai/components/shell/AgentComposer.vue` 的 textarea 只绑了
`@input` / `@keydown` / `@blur`,**没有 `@focus`**。`onBlur` 会在 180ms 后调 `closeMention()`;
而唯一能重开面板的路径是 `onInput` 里的 `scanMention`。所以任何失焦(切标签页、点页面别处)
都会关掉面板,重新获得焦点时没有任何逻辑重开它。Vue2 同样缺这一环 —— 按本项目规则
(**界面照 Vue2,逻辑按正确的来**,用户 2026-07-27 拍板)这属于要修的缺陷。

## 目标

光标停在一个有效的 `@` 词里时,面板应当"该在就在":重新获得焦点、或在文本内点击移动光标到
`@` 词内部时,自动重开面板并保持已钻入的层级(segments)与查询词。

## 要改的文件

- 改:`src/ai/components/shell/AgentComposer.vue`
- 改:`src/ai/components/shell/AgentComposer.test.ts`(追加用例)

## 实现要求

1. 抽一个内部函数(例如 `syncMentionFromCaret()`)承载现有 `onInput` 里那段 mention 扫描逻辑
   —— 它已经在用 `scanMention(text, caret)`(来自 `src/ai/util/composerText.ts`)写
   `mentionOpen`/`mentionStart`/`mentionSegs`/`mentionQuery` + `updateAnchor()`。**不要重写扫描逻辑**,
   只把它提取出来,让 `onInput` 与新的事件处理器共用同一段代码(避免两份实现漂移)。
2. textarea 新增 `@focus` 处理:
   - 先取消挂起的 blur 关闭定时器(`blurTimer`)——否则"点面板条目→输入框重获焦点"的既有
     交互会被自己的定时器紧接着关掉;
   - 然后调 `syncMentionFromCaret()`:光标在 `@` 词内→重开面板(层级/查询词由 `scanMention`
     从文本还原,天然保持);不在→保持关闭。
3. textarea 新增 `@click` 处理:同样调 `syncMentionFromCaret()`。理由:用户可能在已有文本里
   点一下把光标移进/移出 `@` 词,面板要跟着开/关。
   - 注意:`@click` 会在点击输入框时与 `@focus` 都触发,两者都调同一个幂等函数,重复调用无副作用。
4. **不要**让 `@focus`/`@click` 触发斜杠菜单(那是 Task 3 的范围,且 `/` 的触发条件不同)。
5. 保持 `onBlur` 的 180ms 延迟关闭不变(它是为了让面板内条目的 click 先落地)。
6. 全部新增代码要有注释,注明 Vue2 `shell/AgentComposer.vue` 也缺这一环、这是按"逻辑照正确"
   规则修的缺陷。

## 测试要求(TDD:先写、先看红)

在 `AgentComposer.test.ts` 的合适 describe 里追加:

1. **失焦→重新聚焦会重开面板**:输入 `@doc` 打开面板 → 触发 `blur` → 用 fake timers 推进
   200ms 确认面板关闭(`MentionPopover` 的 `open` prop 为 false)→ 触发 `focus` → 断言面板重开
   且 `query` 仍为 `doc`。
2. **重新聚焦时不重开无关面板**:输入 `hello`(无 `@`)→ blur → focus → 断言面板保持关闭。
3. **点击把光标移出 `@` 词会关闭面板**:文本形如 `@Drive1/docs/ tail`,先让面板开着,把
   `selectionStart` 移到 ` tail` 内再触发 `click` → 断言面板关闭。
4. **聚焦会取消挂起的 blur 关闭**:输入 `@doc` → blur → 只推进 100ms(小于 180ms)→ 触发
   focus → 再推进 200ms → 断言面板**仍然开着**(证明挂起的定时器被取消了,而不是稍后又把面板关掉)。

现有 25 个 composer 用例必须全绿。

## 约束

- 只改上面两个文件。不改 `MentionPopover.vue`、不改 store、不动斜杠相关代码。
- 颜色/样式零改动(本任务不涉及)。
- 不新增 i18n 键。
- `pnpm test -- src/ai/components/shell/AgentComposer.test.ts` 与 `pnpm exec vue-tsc --noEmit` 必须通过。
