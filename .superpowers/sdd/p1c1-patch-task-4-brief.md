# P1c-1 验收补丁 Task 4 — @ 提及词改为「状态跟踪」,修掉名字含空格/斜杠就丢面板

## 用户复验反馈(2026-07-27 第 2 轮)

`/` 已通过。`@` **仍未修好**。用户完整复现:

> `@` 之后 tab 两次到一个文件夹,这时候弹窗还是开着的,我点到其他页面,之后回来的时候只有输入框中保留
> `@System (/DATA)/.system_data/`,没有选择栏也没有变成插入文件那样的图标。

(末句是预期行为:只 Tab 钻层、没按 Enter/空格选中,所以本来就不该有 chip;要修的是"面板没回来"。)

## 根因(读代码定死,非猜测)

`src/ai/util/composerText.ts:48-67` 的 `scanMention` 是**从光标往前找 `@`** 的发现式扫描,其中
`:63` `if (/\s/.test(ch)) break` —— 一遇空白就放弃(Vue2 `shell/AgentComposer.vue:331` 原样如此,
注释写着"mention 路径不含空格")。

而 NimoOS 的挂载点显示名是 `System (/DATA)` —— **既含空格又含斜杠**。于是:

1. **空格**:钻进去后文本成 `@System (/DATA)/.system_data/`,往前扫到 `(` 前的空格即 break →
   `{open:false}` → 面板不开。补丁 Task 1 新加的 focus/click 同步调的正是这个函数,所以对这条路径无效。
2. **斜杠**:即便绕过空格,按文本 `split('/')` 反推层级也会把 `System (/DATA)` 切成
   `System (` + `DATA)` 两级,`MentionPopover.currentAbsolute` 拿 `segments[0]` 去匹配挂载点名会失配。

因此**任何"从文字反推提及状态"的路径,在名字含空格/斜杠时都必然出错**。钻取当时之所以正常,是因为
`drillIn` 直接把 `segments` 写进组件状态、没有反推。这也意味着:即使不切页面,**钻完再多敲一个字符**
(`onInput` → 同一个扫描)面板同样会关 —— Vue2 一样有这个缺陷。

按本项目移植纪律(**界面照 Vue2,逻辑按正确的来**,用户 2026-07-27 拍板),这属于要修的缺陷。

## 目标设计:提及词 = 状态拥有,不再靠反推

- **层级(segments)由钻取动作决定**,是权威值(`drillIn`/`popSegment` 写入),永不从文字反推。
- 文字只用来:①发现一个**新**的 `@` 词(仍用 `scanMention`,保留"@ 必须在开头或空白后""不跨空格"
  的发现规则,避免正常句子里的 `@` 误触发);②取用户在已写入前缀之后敲的**筛选词**。
- **失焦只隐藏面板,不销毁提及词状态**;只有"真正结束"才重置(见下)。

## 要改的文件

- 改:`src/ai/util/composerText.ts` + `src/ai/util/composerText.test.ts`
- 改:`src/ai/components/shell/AgentComposer.vue` + `src/ai/components/shell/AgentComposer.test.ts`

## 纯函数(先做,带单测)

```ts
/** 钻取写进文本的前缀:'@' + segments.join('/') + '/'(与 buildDrillText 的写法必须一致)。 */
export function mentionPrefix(segments: string[]): string

/**
 * 判断"已记录的提及词"在当前文本里是否仍然成立,并取出其后的筛选词。
 * 成立条件:start >= 0、text.slice(start, start + prefix.length) === prefix、caret >= start + prefix.length。
 * 返回 { active: true, query: text.slice(start + prefix.length, caret) };否则 { active: false, query: '' }。
 */
export function parseActiveMention(
  text: string, start: number, segments: string[], caret: number,
): { active: boolean; query: string }
```

**`mentionPrefix` 必须成为唯一来源**:`buildDrillText` / `buildPopText` 里拼前缀的地方改为调用它
(它们现有行为不能变 —— 现有单测必须继续全绿,这只是去重)。

单测(至少):
- `mentionPrefix([])` → `'@'`;`mentionPrefix(['System (/DATA)','.system_data'])` → `'@System (/DATA)/.system_data/'`
- `parseActiveMention` 对**用户实际路径** `'@System (/DATA)/.system_data/'`、start=0、
  segments=`['System (/DATA)','.system_data']`、caret=末尾 → `{ active: true, query: '' }`
- 同上但 caret 在末尾又敲了 `re` → `query: 're'`
- 前缀被改动(例如把 `@` 删了、或中间字符变了)→ `{ active: false }`
- caret 落在前缀内部(小于前缀末尾)→ `{ active: false }`
- 名字含空格**且**含斜杠仍正确(这正是 `scanMention` 做不到的点,要有一条对照用例注明)

## 组件改造(`AgentComposer.vue`)

1. **拆分"隐藏"与"重置"**:
   - `hideMentionPanel()`:只 `mentionOpen = false`,**保留** `mentionStart` / `mentionSegs` / `mentionQuery`。
   - `resetMention()`:`mentionOpen=false`、`mentionStart=-1`、`mentionSegs=[]`、`mentionQuery=''`
     (即现有 `closeMention` 的语义)。
   - `onBlur` 的 180ms 延迟回调改调 **`hideMentionPanel()`**(这是本轮修复的关键)。
2. **`syncMentionFromCaret()`(Task 1 抽出的函数)改为两级判定**:
   - 先用 `parseActiveMention(text, mentionStart, mentionSegs, caret)`;`active` 为真 →
     `mentionQuery = query`、`mentionOpen = true`、`updateAnchor()`,**直接返回**(不再跑发现式扫描)。
   - 否则跑现有 `scanMention` 发现新词:命中 → 写入 start/segs/query 并打开;未命中 → `resetMention()`。
   - `onInput`、`@focus`、`@click` 三条入口继续共用它(Task 1 已收口,别再拆)。
3. **哪些动作要 `resetMention()`**(逐一落实,并在代码里注明理由):
   - 面板 `close`(Esc):重置。否则下一次 focus 会立刻按"活动词"重开,用户按 Esc 就白按了。
   - `pickItem` 选中后(已 strip 掉 `@` token):重置。
   - `submit()` 发送后(文本清空):重置。
   - `activeSessionId` watcher:重置(现有代码调的是 `closeMention`,改为 `resetMention`)。
   - `onSlashPickTarget` 等清空文本的路径:重置。
   - 斜杠面板打开时:`syncPanelsFromText` 的互斥分支里对 mention 侧调 `resetMention()`
     (不能只 hide,否则斜杠关掉后 mention 会诈尸)。
4. `drillIn` / `popSegment` 保持现状(它们已经把权威 `segments` 写进状态)。
5. **不要**放宽 `scanMention` 的发现规则(不许删那条空格 break)——正常句子里的 `@` 不能误触发。

## 组件测试(TDD:先写、先看红)

在 `AgentComposer.test.ts` 追加(现有 39 例必须全绿):

1. **用户原始复现**:文本置为 `@System (/DATA)/.system_data/`、`mentionStart=0`、
   `mentionSegs=['System (/DATA)','.system_data']`(通过真实交互制造:`setValue('@Sys')` →
   面板 `drill-in` 两次,分别给 name `System (/DATA)` 与 `.system_data`)→ `blur` → 推进 200ms
   → 断言面板关闭 → `focus` → **断言面板重开,且传给 MentionPopover 的 `segments` 仍是那两级、
   `query` 为空**
2. **钻完再敲字符面板不掉**:接上一步,在末尾输入 `re` → 断言面板仍开、`query === 're'`
   (旧实现会因为空格 break 而关闭 —— 这条用例必须能在修复前失败)
3. **Esc 之后 focus 不复活**:面板开着 → 触发面板 `close` → `focus` → 断言面板仍关闭
4. **发现规则不放宽**:`setValue('me@host')` → 不开;`setValue('hi @ x')` → 不开
5. **切会话重置**:钻两级后改 `store.activeSessionId` → 断言面板关闭,且随后 `focus` 不会重开
   (证明是 reset 而非 hide)
6. **发送后重置**:钻两级 → 再输入文字 → 点发送 → 断言文本清空且随后 `focus` 不重开面板

## 约束

- 只改上列四个文件。不改 `MentionPopover.vue`、`SlashPopover.vue`、store、`AgentPage.vue`。
- 零裸色(本任务不写样式)。不新增 i18n 键。
- `pnpm test`(全量,基线 244 文件 / 1641 例)、`pnpm exec vue-tsc --noEmit` 必须全绿。
- 现有 `composerText.test.ts` 与 `AgentComposer.test.ts` 的所有既有用例不得删改(只允许追加);
  若某条既有用例与新行为冲突,**停下并报告**,不要自行改断言。
