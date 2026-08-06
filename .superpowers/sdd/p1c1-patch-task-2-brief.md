# P1c-1 验收补丁 Task 2 — `SlashPopover.vue`:与 @ 面板同款的斜杠命令面板

## 背景(用户验收反馈 2026-07-27)

现在的 `SlashMenu.vue`(1:1 移植自 Vue2)是一个**全屏遮罩 + 居中卡片 + 单选按钮列表**,用户明确否掉:

> `/` 命令就和 at 做成一样的,claude code、codex 那样的,不要做成一个单独的风格很割裂的东西,
> 现在里面只有一个 init,也不能上下选也不能 enter,甚至不点击还不能退出。

用户拍板的三项决策:
1. **形态**:和 `@` 面板一样 —— 贴附在输入框上方的内联面板,↑↓ 选、Enter 确认、Esc 关。
2. **选目录**:选中 `/init` 后**在同一面板里接着列出已授权目录**(像 `@` 钻下一层),Esc 退回上一层。
3. **触发**:输入框**开头**的 `/` 才弹,并且能边敲边筛(`/in` → 筛到 `/init`)。

本任务只做**面板组件**;composer 侧的触发/接线/删除旧组件是 Task 3。

## 要改的文件

- 新建:`src/ai/components/shell/SlashPopover.vue`
- 新建:`src/ai/components/shell/SlashPopover.test.ts`
- 可能改:`src/ai/components/shell/MentionPopover.vue` + 新建共享样式(见"视觉一致"一节)
- 改:`src/i18n/zh_cn.ts` + `src/i18n/en_us.ts`(新键,两边都要加,parity 测试卡)

## 对外契约(Task 3 依赖,不可改名)

```ts
// props
open: boolean
stage: 'command' | 'target'        // 'command' = 选命令;'target' = 选目录
query: string                     // 当前阶段的筛选词(不含 '/' 和命令名)
folders: Array<{ id?: string | number; path: string }>   // target 阶段的候选(= 已授权目录)
anchorRect: DOMRect | null        // 定位锚(composer 传,与 MentionPopover 同款)

// emits
'pick-command': (name: string) => void   // 选中命令(当前只有 'init')
'pick-target':  (path: string) => void   // 选中目录 → Task 3 会据此发 sendInit
'back':         () => void               // target 阶段要求退回 command 阶段
'close':        () => void               // 关闭整个面板
```

## 行为要求

**命令清单**:模块内常量,当前仅一项 `{ name: 'init', descKey: 'aiSlashInitDesc' }`。
渲染成 `/init` + 描述。清单为常量数组,将来加命令只加一行(不要写死成单条 DOM)。

**筛选**:`query` 非空时按命令名过滤,复用 `MentionPopover` 的打分方式(`startsWith` 计 2 分、
`includes` 计 1 分、0 分丢弃,按分数降序)——直接读 `MentionPopover.vue` 的 `filtered` 计算属性照做,
保持两个面板筛选手感一致。target 阶段同法,按目录 `path` 过滤。

**键盘**(与 `MentionPopover` 完全一致的做法:`open` 为真时在 `window` 上注册 **capture 阶段**
`keydown`,`open` 变假与 `onBeforeUnmount` 时摘除;监听必须**同步挂载**,不能挂在 await 之后
—— MentionPopover 曾因此漏出一个永不摘除的监听,别重犯):
- `ArrowDown` / `ArrowUp`:移动高亮项(索引 clamp 在 `[0, list.length-1]`),`preventDefault`
- `Enter`:command 阶段 → `pick-command`;target 阶段 → `pick-target`;`preventDefault`
- `Tab`:同 `Enter`(与 `@` 面板的"Tab 选中"手感一致),`preventDefault`
- `Escape`:command 阶段 → `close`;target 阶段 → `back`;`preventDefault`
- `Backspace`:**仅当 `query` 为空且处于 target 阶段** → `back`,`preventDefault`(与 `@` 面板
  用 Backspace 退层同构);其余情况不拦截,让字符正常删除
- `open` 变化、`stage` 变化、`query` 变化时高亮项重置为 0(与 MentionPopover 的三个 watcher 同款)
- 高亮项变化时把该行 `scrollIntoView({ block: 'nearest' })`,调用点要写成 `?.()`(jsdom 无实现)

**鼠标**:整个面板根元素 `@mousedown.prevent`(防止 textarea 失焦把面板关掉 —— 与 MentionPopover
同款);行 `@mouseenter` 更新高亮;行 `@click` 等价于 Enter。

**头部**:显示当前上下文,与 `@` 面板的面包屑同构 —— command 阶段显示 `/`;target 阶段显示
`/init >`(命令名 + 分隔箭头,箭头用 `AgentIcon name="chev"`),并在右侧显示候选数量。

**空态**:
- command 阶段无匹配 → 文案键 `aiSlashNoCommand`(zh `没有匹配的命令` / en `No matching command`)
- target 阶段 `folders` 为空 → **复用现有键 `aiSlashNoFolders`**(先确认该键在两个 locale 里的
  现值读起来仍通顺;它的中文含 `{'@'}` 转义,渲染出来是字面 `@`)

**底部键位提示**:与 `@` 面板同款的 `.…-kbd` 小键帽风格,列出 ↑↓ 导航 / Enter 选择 / esc 关闭
(target 阶段把 esc 的说明改成"返回")。文案要新键(见下)。

**定位**:`position: fixed`,按 `anchorRect` 贴在输入框上方 —— 直接照 `MentionPopover.vue` 的
`popStyle` 计算(无 `anchorRect` 时的兜底值也照抄),保证两个面板出现在同一位置、同一宽度。
`pointer-events: auto` 必须有(祖先 `.composer-wrap` 是 `pointer-events: none`)。

## 视觉一致(用户的核心要求)

两个面板**必须看起来是同一个东西**:同样的玻璃背景、圆角、阴影、发丝环、行高、hover/选中态、
字号、间距、动效(`mention-rise` 那条入场动画)。

做法要求:把面板"外壳"样式(容器/列表/行/空态/底部键帽/面包屑)提取成**一份共享来源**,
两个组件都用它 —— 例如新建 `src/ai/styles/popover.scss` 提供 mixin,两个组件的 scoped 样式块各自
`@use` 并 include。硬约束:
- 提取过程中 **`MentionPopover` 渲染出来的样式必须逐条不变**(纯搬迁,不许改任何数值);
  在报告里逐条列出"搬迁前 → 搬迁后"证明等价。
- **不要改 `MentionPopover.vue` 里任何被它的测试查询到的 class 名**(先读 `MentionPopover.test.ts`
  确认哪些 class 被查),否则会打断已通过评审的 13 个用例。
- 若你判断提取会带来无法证明等价的风险,可以退化为"SlashPopover 自带一份 scoped 样式",但必须
  在文件头注释 + 报告里写明是有意重复、并说明为什么不提取(留给后续期收口)。

## 主题硬约束

所有颜色走 `var(--…)` Agent token(`src/ai/styles/tokens.scss`,`.agent-app` 作用域;
浅色块与 `[data-theme="dark"]` 块都要有值)。**禁止任何 `#hex` / `rgb()` / `rgba()` / 具名色**。
需要新语义就加 token 并在两个主题块都给值。做完自查:
`grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/SlashPopover.vue` 必须无输出。

## i18n

新键同时进 `src/i18n/zh_cn.ts` 与 `src/i18n/en_us.ts`(zh 中文 / en 英文,`parity.test.ts` 卡):
`aiSlashNoCommand`、以及底部键位提示所需的键(命名沿用 `aiSlash*`,可参考 `aiMentionKbd*` 系列
的现有命名与文案风格)。**文案里若含 `@` 字符必须写成 `{'@'}`** —— vue-i18n 9 会把裸 `@` 当链接
消息语法(本期已踩过这个坑,`src/i18n/messageSyntax.test.ts` 会把违规拦下来)。

## 测试要求(TDD:先写、先看红)

`SlashPopover.test.ts`,约定沿用仓内既有风格(中文用例名、`createI18n({legacy:false})` 挂真实
`zh_cn` 文案、`attachTo: document.body`、键盘用 `window.dispatchEvent(new KeyboardEvent('keydown', …))`):

1. command 阶段渲染 `/init` 一行;`query='in'` 仍匹配,`query='zzz'` 显示无匹配空态
2. ↑↓ 移动高亮(断言 `data-active`),`Enter` 触发 `pick-command('init')`
3. `Tab` 与 `Enter` 等效
4. command 阶段 `Escape` → `close`;**target 阶段 `Escape` → `back`(不是 close)**
5. target 阶段渲染传入的 `folders`,`Enter` 触发 `pick-target('<选中的 path>')`
6. target 阶段 `folders` 为空 → 显示 `aiSlashNoFolders` 空态
7. target 阶段 `query` 为空时 `Backspace` → `back`;`query` 非空时 `Backspace` **不**触发 `back`
8. 行 `@click` 等价于 Enter
9. `stage` 或 `query` 变化后高亮重置为第 0 项
10. **卸载后 window keydown 不再触发任何 emit**(证明 capture 监听已摘除)

## 约束

- 不要在本任务里改 `AgentComposer.vue`、不要删旧的 `SlashMenu.vue`(Task 3 负责)。
- 不加 Vue2 没有、用户也没要求的功能(例如命令的模糊拼音搜索、命令图标动画)。
- `pnpm test -- src/ai/components/shell/SlashPopover.test.ts src/ai/components/shell/MentionPopover.test.ts src/i18n/`
  与 `pnpm exec vue-tsc --noEmit` 必须全绿。
