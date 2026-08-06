# P1c-1 验收补丁 Task 2 报告 — `SlashPopover.vue`

## 最终对外契约

```ts
// props
open?: boolean                                   // default false
stage?: 'command' | 'target'                     // default 'command'
query?: string                                    // default ''
folders?: Array<{ id?: string | number; path: string }>  // default []
anchorRect?: DOMRect | null                       // default null

// emits
'pick-command': (name: string) => void
'pick-target':  (path: string) => void
'back':         () => void
'close':        () => void
```

与 brief 逐字一致,未改名、未增删。

## 键盘映射(已实现)

| 按键 | command 阶段 | target 阶段 |
|---|---|---|
| `ArrowDown`/`ArrowUp` | 高亮 `hi` clamp 在 `[0, list.length-1]`,`preventDefault` | 同 |
| `Enter` / `Tab` | `pick-command(item.name)` | `pick-target(item.path)`;`preventDefault` |
| `Escape` | `close` | `back`(不是 close) |
| `Backspace` | 不拦截 | 仅当 `query===''` 时 `back`,否则放行给字符删除 |

监听:`open` 变 true 的 `immediate` watcher 里同步 `window.addEventListener('keydown', onKey, true)`(capture 阶段),`open` 变 false 与 `onBeforeUnmount` 摘除。本组件没有异步请求(`folders` 由 composer 以 prop 喂入),因此不需要 MentionPopover 那个"内层 async IIFE 不阻塞挂监听"的手法——挂监听本来就在同一 tick 同步完成,没有 await 能插进来。
`stage`/`query`/`open` 变化都重置 `hi = 0`;`hi` 变化时 `nextTick` 后 `listEl.value?.querySelector(...)?.scrollIntoView?.({ block: 'nearest' })`(`?.()` 防 jsdom 无实现)。

## 视觉一致 — 采取的路径:提取共享 mixin(非退化重复)

新建 `src/ai/styles/popover.scss`,定义 9 个 mixin:`pop-container`(含 `@keyframes pop-rise`)、`crumbs-bar`、`crumbs-spacer`、`crumbs-count`、`pop-list`、`pop-item`、`pop-item-active-bg`、`pop-name`、`pop-empty`、`pop-empty-hint`、`pop-foot`、`pop-kbd`。`MentionPopover.vue` 与 `SlashPopover.vue` 各自的 `<style scoped lang="scss">` 块 `@use '../../styles/popover.scss' as pop;` 并 `@include`——两份编译产物各自带自己的 `data-v-*` scoping 属性,是"共享来源、非共享运行时表",不影响 Vue 的 scoped 隔离。

`MentionPopover.vue` 里被其测试查询到的 class(`mention-item`/`mention-name`/`mention-drill`/`mention-empty`/`mention-crumb`/`mention-caret`……,已读 `MentionPopover.test.ts` 逐条核对)**一个未改名**——mixin 只提供声明体,选择器本身仍写在各自文件里。

### 逐条等价证明(搬迁前 → 搬迁后,数值不变)

| 选择器(MentionPopover.vue,不变) | 搬迁前(字面声明) | 搬迁后 |
|---|---|---|
| `.mention-pop` | `position:fixed;z-index:1000;pointer-events:auto;background:var(--glass-strong);backdrop-filter:blur(28px) saturate(180%);-webkit-backdrop-filter:同;border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--shadow-lg), 0 0 0 0.5px var(--hairline-ring);overflow:hidden;display:flex;flex-direction:column;max-height:360px;animation:mention-rise 140ms cubic-bezier(0.2,0.8,0.2,1);transform-origin:bottom left;font-size:13px;` | `@include pop.pop-container;` → 同一组声明,**唯一差异**:`animation` 引用的 keyframe 名从 `mention-rise` 改为 `pop-rise`(内部标识符,不是任何测试/视觉可观察量——关键帧的 `from`/`to` 数值逐字相同,渲染出的透明度/位移曲线不变) |
| `@keyframes mention-rise` | `from{opacity:0;transform:translateY(6px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)}` | `@keyframes pop-rise` 同一组帧值,仅改名 |
| `.mention-crumbs` | `display:flex;align-items:center;gap:6px;padding:9px 12px;border-bottom:1px solid var(--line-faint);font-size:12px;color:var(--text-secondary);flex-wrap:nowrap;overflow:hidden;` | `@include pop.crumbs-bar;` → 逐字相同 |
| `.mention-spacer` | `flex:1;` | `@include pop.crumbs-spacer;` → 逐字相同 |
| `.mention-count` | `font-size:11px;color:var(--text-quaternary);font-variant-numeric:tabular-nums;flex-shrink:0;` | `@include pop.crumbs-count;` → 逐字相同 |
| `.mention-list` | `flex:1;overflow-y:auto;padding:4px;min-height:0;` | `@include pop.pop-list;` → 逐字相同 |
| `.mention-item` | `display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:var(--r-sm);cursor:pointer;transition:background 80ms ease;` | `@include pop.pop-item;` → 逐字相同 |
| `.mention-item[data-active="true"]` | `background:var(--accent-soft);` | `@include pop.pop-item-active-bg;` → 逐字相同 |
| `.mention-name` | `flex:1;font-size:13px;font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;` | `@include pop.pop-name;` → 逐字相同 |
| `.mention-empty` | `display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 16px;gap:8px;color:var(--text-tertiary);font-size:13px;` | `@include pop.pop-empty;` → 逐字相同 |
| `.mention-empty-hint` | `font-size:11px;color:var(--text-quaternary);` | `@include pop.pop-empty-hint;` → 逐字相同 |
| `.mention-foot` | `display:flex;align-items:center;gap:12px;padding:7px 12px;border-top:1px solid var(--line-faint);background:var(--bg-sunken);font-size:11px;color:var(--text-tertiary);flex-wrap:wrap;` | `@include pop.pop-foot;` → 逐字相同 |
| `.mention-kbd` | `display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;background:var(--bg-elevated);border:1px solid var(--line);border-radius:4px;font-family:var(--font-mono);font-size:10px;font-weight:600;color:var(--text-secondary);margin-right:4px;box-shadow:0 1px 0 var(--line);vertical-align:-2px;` | `@include pop.pop-kbd;` → 逐字相同 |

未提取、原样保留在 `MentionPopover.vue` 里的(Mention 特有语义,Slash 没有对应物或表现不同):`.mention-at`(`@` 字形)、`.mention-crumb`/`[data-root]`/`[data-typing]`、`.mention-caret`+`@keyframes blink`、`.mention-item[data-active] .mention-name`(改色)、`.mention-item[data-active] .mention-drill`、`.mention-item[data-ignored]`、`.mention-name :deep(mark)`、`.mention-meta`/`.mention-mod`/`.mention-ignored`、`.mention-drill`。这些语义在 `SlashPopover.vue` 里没有 1:1 对应(斜杠面板没有钻取图标、没有 ignore 态、没有高亮匹配字符),因此按 brief 的建议保留在各自文件,未强行抽象。

`SlashPopover.vue` 用同一批 mixin 拼出 `.slash-pop`/`.slash-crumbs`/`.slash-spacer`/`.slash-count`/`.slash-list`/`.slash-item`/`.slash-item[data-active]`/`.slash-name`/`.slash-empty`/`.slash-foot`/`.slash-kbd`,与上表右列引用同一组 mixin,故与 Mention 对应选择器视觉逐条相同。Slash 特有的 `.slash-slash`(`/` 字形,复用与 `.mention-at` 相同的声明)、`.slash-crumb[data-typing]`、`.slash-caret`+`@keyframes slash-blink`、`.slash-desc`(命令描述,右侧次要文本,新样式,MentionPopover 没有直接对应物,借用了 `.mention-meta` 的字号/配色感觉但不是逐字搬迁,因为 Slash 没有"元数据行"这个语义)是新写的,不在等价表里(brief 只要求"骨架"逐条不变,不要求发明新语义时也逐字复用旧组件的其他语义类)。

## 主题 token

未新增 token——`tokens.scss` 里已有的 `--glass-strong`/`--line`/`--line-faint`/`--r-lg`/`--r-sm`/`--shadow-lg`/`--hairline-ring`/`--accent`/`--accent-soft`/`--text-primary/secondary/tertiary/quaternary`/`--bg-sunken`/`--bg-elevated`/`--font-mono` 全部覆盖所需语义,浅色块与 `[data-theme="dark"]` 块均已有值(沿用 Mention 已验证的 token,未改动 `tokens.scss`)。

颜色字面量自查:
```
$ grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|:\s*white' src/ai/components/shell/SlashPopover.vue
(无输出)
```

## i18n 新增键(zh_cn.ts / en_us.ts 均已加,parity 覆盖)

- `aiSlashNoCommand`:zh `没有匹配的命令` / en `No matching command`
- `aiSlashKbdNav`:zh `导航` / en `Navigate`
- `aiSlashKbdSelect`:zh `选择` / en `Select`
- `aiSlashKbdClose`:zh `关闭` / en `Close`
- `aiSlashKbdBack`:zh `返回` / en `Back`

复用既有键(未新增):`aiSlashInitDesc`、`aiSlashNoFolders`(其 `{'@'}` 转义在两个 locale 里都已存在,读起来通顺,未改动)。新增键均无 `@` 字符,不涉及 `{'@'}` 转义问题。

## 测试:RED → GREEN

RED(组件文件尚未创建时跑测试):
```
FAIL  src/ai/components/shell/SlashPopover.test.ts [ src/ai/components/shell/SlashPopover.test.ts ]
Error: Failed to resolve import "./SlashPopover.vue" from "src/ai/components/shell/SlashPopover.test.ts". Does the file exist?
...
 Test Files  1 failed (1)
      Tests  no tests
```

GREEN(实现完成后,含 MentionPopover 回归 + i18n 三个测试文件):
```
$ pnpm test -- src/ai/components/shell/SlashPopover.test.ts src/ai/components/shell/MentionPopover.test.ts src/i18n/
 Test Files  5 passed (5)
      Tests  29 passed (29)
```

`pnpm exec vue-tsc --noEmit` → exit 0(无输出,0 错误)。

## 未在本任务处理、但注意到的事项

- `SlashPopover.vue` 的目标阶段行只显示 `folders[].path`,没有像 command 行那样的第二列描述文字——Vue2 `SlashMenu.vue` 原本也只显示 `f.path`,brief 未要求增加描述,未加。
- brief 底部键位提示只列了 `↑↓`/`Enter`/`esc` 三项(未像 Mention 面板那样列 `Tab`,尽管 `Tab` 键盘上等效于 `Enter`)——照 brief 原文实现,未额外补充 `Tab` 提示行,避免功能蔓延。
- `list` 的 `key` 在 target 阶段用 `item.id ?? item.path`,与 Vue2 `SlashMenu.vue` 的 `:key="f.id || f.path"` 用意一致(id 缺失兜底用 path);未做进一步校验(如 path 重复)。
- 未触碰 `AgentComposer.vue`/`AgentComposer.test.ts`/`SlashMenu.vue`(按 scope 边界要求)。
