# P1c-1 验收补丁 Task 1 — 报告

commit: `e0bc7ac` (branch `sp8-ai`)

## 抽取的函数 + 两个新处理器

```ts
/**
 * P1c1 验收补丁 Task 1(见文件头「Vue2 缺陷修复」新增项 (c)):抽出 onInput 里
 * `scanMention` 那段——扫描光标处是否在一个有效的 `@` 词内,是则(重)开面板并
 * 还原层级/查询词,否则关闭面板。抽出来的原因是 onFocus/onClick 两个新处理器
 * 要复用同一份逻辑,不能各写一份(避免两份实现漂移)。**未改动扫描规则本身**,
 * 逐字保留原来 onInput 里的分支。
 */
function syncMentionFromCaret() {
  const v = text.value
  const el = ta.value
  const caret = el ? (el.selectionStart ?? v.length) : v.length

  const scan = scanMention(v, caret)
  if (scan.open) {
    mentionStart.value = scan.start
    mentionSegs.value = scan.segments
    mentionQuery.value = scan.query
    mentionOpen.value = true
    updateAnchor()
    return
  }
  closeMention()
}
```

`onInput()` now just does the grow() + slash-at-start check, then calls
`syncMentionFromCaret()` instead of inlining the scan.

```ts
/**
 * P1c1 验收补丁 Task 1 —— 修 Vue2 缺陷 (c):Vue2 `shell/AgentComposer.vue`
 * 的 textarea(45-53)只绑了 `@input`/`@keydown`/`@blur`,没有 `@focus`。
 * `onBlur`(343-346)会在 180ms 后调 `closeMention()`,而唯一能重开面板的路径
 * 是 `onInput` 里的扫描——于是切标签页/点页面别处再切回来,面板永久消失,直到
 * 用户再敲一个字符。这不是 UI 差异,是逻辑缺陷;按项目 2026-07-27 移植纪律
 * (界面照 Vue2、逻辑按正确的来)在此修:重新聚焦时,
 *   1) 先清掉挂起的 blur 关闭定时器——否则"点面板条目→输入框重获焦点"这个
 *      既有交互会被自己刚排的 180ms 定时器紧接着关掉;
 *   2) 再用 syncMentionFromCaret() 按光标位置决定面板开/关——层级/查询词由
 *      scanMention 从文本本身还原,天然保持已钻入的层级,不需要额外状态。
 * 不触发斜杠菜单:那是 Task 3 的范围,且 `/` 的触发条件(整串正好是 '/')不同,
 * 重新聚焦本身不该触发它。
 */
function onFocus() {
  if (blurTimer.value !== null) {
    clearTimeout(blurTimer.value)
    blurTimer.value = null
  }
  syncMentionFromCaret()
}

/**
 * P1c1 验收补丁 Task 1 续,同一缺陷 (c) 的另一半:用户可能在已有文本里点一下,
 * 把光标移进/移出一个 `@` 词,面板要跟着开/关(而不是只在打字时响应)。与
 * onFocus 调用同一个幂等函数 `syncMentionFromCaret()`——点击输入框时 focus 和
 * click 两个事件都会触发,重复调用无副作用。
 */
function onClick() {
  syncMentionFromCaret()
}
```

Template: added `@focus="onFocus"` and `@click="onClick"` to the textarea
(alongside existing `@input`/`@keydown`/`@blur`).

File-header comment block got a new item `(c)` alongside the existing
`(a)`/`(b)` Vue2-defect entries, citing Vue2 `shell/AgentComposer.vue:45-53`
(no `@focus` binding) and `:343-346` (`onBlur`'s 180ms close).

## RED (before implementation)

```
 ❯ src/ai/components/shell/AgentComposer.test.ts (30 tests | 3 failed) 392ms
     × 失焦→重新聚焦会重开面板 16ms
     × 点击把光标移出 @ 词会关闭面板 7ms
     × 聚焦会取消挂起的 blur 关闭 13ms

 FAIL  ... 失焦→重新聚焦会重开面板
AssertionError: expected false to be true // Object.is equality
 FAIL  ... 点击把光标移出 @ 词会关闭面板
AssertionError: expected false to be true // Object.is equality
 FAIL  ... 聚焦会取消挂起的 blur 关闭
AssertionError: expected false to be true // Object.is equality

 Test Files  1 failed (1)
      Tests  3 failed | 27 passed (30)
```

(The 4th new test, "重新聚焦时不重开无关面板", passed trivially even before
the fix — with no focus handler at all the panel simply stays closed, which
happens to satisfy that assertion. It's kept because it pins the correct
behavior post-fix too, and would catch a regression that reopens on any
focus unconditionally.)

## GREEN (after implementation)

```
 Test Files  1 passed (1)
      Tests  30 passed (30)
```

`pnpm exec vue-tsc --noEmit` → 0 errors/no output.

## Noticed but left alone

- `src/i18n/en_us.ts` and `src/i18n/zh_cn.ts` were modified by the concurrent
  agent (SlashPopover Task 2 — `aiSlashNoCommand`/`aiSlashKbdNav`/etc keys).
  Confirmed via `git diff` these are not my changes; left unstaged/uncommitted,
  only `AgentComposer.vue` + `AgentComposer.test.ts` were staged and committed.
- Did not touch `MentionPopover.vue` or anything slash-related, per brief
  constraints.
- No new i18n keys added; no color/style changes.
