# bug.txt 批量缺陷修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `bug.txt` 中报告的 7 个前端缺陷(#2–#8;#1 已被 HEAD commit 39fe7a93 修复,仅在验收中确认),验收跑在已启动的 dev server `http://localhost:5277/app/` 上。

**Architecture:** 全部改动在本 worktree(Vue 3 前端)内完成,不碰后端 Go 仓、不碰 `packages/service/`(因此 5277 的 vite dev server 全程 HMR 生效,无需重启)。每个 bug 一个独立 task,TDD:先写红测试再改实现。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript strict · Pinia · vitest(jsdom)· 手写 CSS + theme token。

## Global Constraints

- 工作目录:`/home/nimo/NimoTech/NimoOS-New-UI/.claude/worktrees/acceptance-bugfixes`,分支 `acceptance-bugfixes`。所有命令在此目录执行。
- 包管理器 **pnpm**(勿用 yarn/npm)。跑单测:`pnpm vitest run <file>`;全量:`pnpm test`;类型检查:`pnpm exec vue-tsc --noEmit`。
- **Commit message 一律英文**,imperative subject,body 讲 why。
- **新增 i18n key 必须同时加进 `src/i18n/zh_cn.base.ts` 和 `src/i18n/en_us.base.ts`**(`src/i18n/parity.test.ts` 强制两边 key 一致,漏一边即红)。
- **禁止写死颜色字面量**,一切颜色用 `var(--…)` token(见仓库 CLAUDE.md 主题约定)。
- 新写注释跟随所在文件的既有语言风格(本仓现状多为中文注释);commit 保持英文。
- 不修改 `packages/service/` 下任何文件(避免 dev server 需要重启的坑)。
- 测试必须在前台运行并把输出贴进报告,不得丢后台。

---

### Task 1: Bug 3 — "清空"按钮改为"取消选择"

选中文件后工具栏的"清空"(清空选择)会被理解成"清空文件夹"。Vue2 老仓无同款按钮,最接近语感是 `cancel-all: 全部取消`;采用"取消选择"。

**Files:**
- Modify: `src/i18n/zh_cn.base.ts:23`(`filesClearSel: '清空'`)
- Modify: `src/i18n/en_us.base.ts:23`(`filesClearSel: 'Clear'`)
- Modify: `src/files/components/SelectionToolbar.test.ts`(第 8 行附近的内联 mock messages 里有 `filesClearSel: '清空'`,以及任何按 `'清空'` 文本断言的用例)

**Interfaces:**
- Consumes: i18n key `filesClearSel`(使用处:`src/files/components/SelectionToolbar.vue:12`、`src/files/snapshot/SnapshotSelectionToolbar.vue:28` —— 两处共用同一 key,语义都是"取消选择",**不需要**改这两个组件)
- Produces: 无新接口

- [ ] **Step 1: 改 i18n 两个文件**

`src/i18n/zh_cn.base.ts:23`:`filesClearSel: '清空',` → `filesClearSel: '取消选择',`
`src/i18n/en_us.base.ts:23`:`filesClearSel: 'Clear',` → `filesClearSel: 'Deselect',`

- [ ] **Step 2: 同步测试 mock 与断言**

打开 `src/files/components/SelectionToolbar.test.ts`,把 mock messages 里的 `filesClearSel: '清空'` 改为 `filesClearSel: '取消选择'`;`grep -n "清空" src/files/ -r` 检查是否还有按文本查询的断言,一并更新。

- [ ] **Step 3: 跑相关测试确认全绿**

Run: `pnpm vitest run src/files/components/SelectionToolbar.test.ts src/i18n/parity.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/files/components/SelectionToolbar.test.ts
git commit -m "fix(files): reword clear-selection button so it cannot read as emptying a folder"
```

---

### Task 2: Bug 8 — 深色主题原生 select 弹出列表白底白字(console-svc)+ 守卫补洞

全仓唯一漏网的原生 `<select>` 是 `src/apps/views/AppConsolePage.vue:105` 的 `.console-svc`:背景 `var(--chip-bg)` 在深色主题是半透明白渐变,Chrome 把作者背景带进原生弹出列表 → 近白底 + `--fg: #ffffff` 白字。守卫测试 `src/styles/selectPopup.test.ts:140` 的正则 `/<select\b[^>]*>/g` 被该元素属性 `v-if="serviceNames.length > 1"` 里的 `>` 截断,拿不到 class 而静默跳过 —— 这是它漏网的原因。先修守卫(测试变红),再修样式(变绿)。

**Files:**
- Modify: `src/styles/selectPopup.test.ts:140`(select 标签提取正则)
- Modify: `src/apps/views/AppConsolePage.vue`(scoped style,`.console-svc:focus` 规则在 152 行,其后加 option 规则)

**Interfaces:**
- Consumes: 既有 token `--set-option-bg` / `--set-option-fg`(定义在 `src/styles/theme.sp9.css:108-109`(深)与 `:186-187`(浅),两套主题都有值,与已修复的 6 处 select 用法一致)
- Produces: 无新接口

- [ ] **Step 1: 修守卫正则(quote-aware)**

`src/styles/selectPopup.test.ts:140`:

```ts
// 旧
for (const m of template.matchAll(/<select\b[^>]*>/g)) {
// 新:属性值里可以有 >(如 v-if="a.length > 1"),必须跳过引号内内容再找标签闭合
for (const m of template.matchAll(/<select\b(?:"[^"]*"|'[^']*'|[^>])*>/g)) {
```

并在上方注释里补一句为什么(属性内 `>` 截断导致 console-svc 漏扫了一个发布周期)。

- [ ] **Step 2: 跑守卫,确认它现在逮到 console-svc(红)**

Run: `pnpm vitest run src/styles/selectPopup.test.ts`
Expected: FAIL,失败信息里列出 `AppConsolePage.vue  class="console-svc"`(若没红,说明正则没生效,停下排查,不许直接进 Step 3)

- [ ] **Step 3: 给 console-svc 钉住 option 实心底色**

在 `src/apps/views/AppConsolePage.vue` scoped style 的 `.console-svc:focus` 规则后加:

```css
/* Chrome 会把作者背景带进原生弹出列表:半透明渐变叠在默认白底上 ⇒ 深色主题下白底白字。
   与 .set-select 等 6 处同款修法:option 钉实心 token 底色。 */
.console-svc option,
.console-svc optgroup { background-color: var(--set-option-bg); color: var(--set-option-fg); }
```

- [ ] **Step 4: 跑守卫确认绿**

Run: `pnpm vitest run src/styles/selectPopup.test.ts`
Expected: PASS(含"至少扫到 10 个 select"的防空转用例)

- [ ] **Step 5: Commit**

```bash
git add src/styles/selectPopup.test.ts src/apps/views/AppConsolePage.vue
git commit -m "fix(apps): pin solid option colors on the console service select

The select-popup guard tokenized tags with /<select\b[^>]*>/ which is cut
short by '>' inside attribute values (v-if=\"... > 1\"), so console-svc was
silently skipped. Make the extractor quote-aware and fix the one select it
had been missing."
```

---

### Task 3: Bug 7 — 已共享文件夹被误判"受保护"而删不掉

`src/files/util/protect.ts:44` 的 `canOperate` 把"已被 Samba 共享"(`isAlreadyShared`)当作不可删除/剪切/重命名。这是 New-UI 把 Vue2 里仅用于隐藏右键菜单项的判断提升成了操作闸门 —— 后端本来就支持删除共享文件夹并自行清理共享记录(`NimoOS/route/v1/file.go:1039-1057` 删除后调 `DeleteShareByPath`;重命名有 `RewriteSharePathPrefix`),Vue2 从不拦截。RAID 机器上共享文件夹密集,于是表现为"未知原因删不掉"。修法:从 `canOperate` 移除 shared 这一条(系统默认文件夹、挂载点两条保留)。

**Files:**
- Modify: `src/files/util/protect.ts`(删除第 44 行 `if (isAlreadyShared(entry)) return false` 及第 2 行 import)
- Modify: `src/files/util/protect.test.ts`(现有用例把"已分享不可操作"固化为期望,需反转)
- Test: `src/views/__tests__/Files.deleteGate.test.ts`、`src/files/composables/useFileOps.test.ts`(检查是否有依赖 shared-block 行为的用例,一并更新)

**Interfaces:**
- Consumes: `isAlreadyShared`(`src/files/util/shareGate.ts:12-14`)—— **保留该文件**,它仍被分享菜单状态使用;只是 `protect.ts` 不再 import。
- Produces: `canOperate(entry)` 语义变更:shared 条目返回 `true`。所有调用方(`FileContextMenu.vue`、`useFileOps.ts`、`Files.vue askDelete`)自动放行,无需改动。

- [ ] **Step 1: 反转测试期望(红)**

在 `src/files/util/protect.test.ts` 中找到断言 shared 条目 `canOperate === false` 的用例,改为断言 `true`,并把用例名改成说明性的,例如:

```ts
it('已共享目录可以删除/剪切/重命名(后端会自行清理共享记录,Vue2 也从不拦截)', () => {
  const shared = { name: 'aaa', path: '/media/RAID_x/aaa', is_dir: true, extensions: { share: { shared: 'true' } } } as unknown as FileEntry
  expect(canOperate(shared)).toBe(true)
})
```

Run: `pnpm vitest run src/files/util/protect.test.ts`
Expected: FAIL(实现还没改)

- [ ] **Step 2: 改实现**

`src/files/util/protect.ts`:删除 `import { isAlreadyShared } from './shareGate'` 与 `canOperate` 里的 `if (isAlreadyShared(entry)) return false // 已分享` 行,原位补注释:

```ts
// 已分享 ≠ 受保护(bug.txt #7):后端删除时自行清理共享记录(DeleteShareByPath)、
// 重命名有 RewriteSharePathPrefix;Vue2 也只在右键菜单里隐藏入口、从不拦截操作。
// 曾把它列入本闸门,导致 RAID 上的共享文件夹"未知原因删不掉"。
```

- [ ] **Step 3: 跑测试并清理连带断言**

Run: `pnpm vitest run src/files/util/protect.test.ts src/views/__tests__/Files.deleteGate.test.ts src/files/composables/useFileOps.test.ts`
Expected: PASS。若 deleteGate/useFileOps 里有 shared-block 用例,按新语义更新(shared 条目应进入删除确认弹窗而不是被 toast 拦截)。

- [ ] **Step 4: Commit**

```bash
git add src/files/util/protect.ts src/files/util/protect.test.ts src/views/__tests__/Files.deleteGate.test.ts src/files/composables/useFileOps.test.ts
git commit -m "fix(files): stop treating shared folders as protected

canOperate() blocked delete/cut/rename on any Samba-shared entry, which the
backend fully supports (it cleans up share records itself on delete and
rewrites share paths on rename). Vue2 only hid context-menu entries and
never gated the operation. On RAID machines, where large volumes are where
shares live, this surfaced as folders that could not be deleted at all."
```

---

### Task 4: Bug 5 — 拖应用上桌不查重,重复图标

`useAddPanel.ts:34` 的 `dupWidget` 只覆盖 `widget`/`appwidget` 两种 kind,`app`(和 `folder`)一律放行 → 同一 app 可无限次上桌;另外 `layout.ts:193` 的 `autoPin` 只看 `seen` 集合、不看 `items` 里是否已有同 key 磁贴,手动 pin 过一个未进 `seen` 的应用后,下一轮 autoPin 会再加一个。两处都补。

**Files:**
- Modify: `src/home/composables/useAddPanel.ts:32-53`
- Modify: `src/home/stores/layout.ts:193-198`(autoPin 的 push 分支)
- Modify: `src/i18n/zh_cn.base.ts` / `src/i18n/en_us.base.ts`(`addPanelWidgetExists` 附近,zh 约 320 行,新增 2 个 key)
- Test: `src/home/composables/useAddPanel.test.ts`、`src/home/stores/layout.test.ts`(autoPin describe 在 176 行起)

**Interfaces:**
- Consumes: `LayoutItem`(`src/home/grid/types.ts`:`kind: 'widget'|'app'|'folder'|'photo'|'appwidget'`,`key: string`,folder 另有 `path?: string`);`layout.pin` / `layout.items` / `ui.showToast` / `i18n.global.t`。
- Produces: `useAddPanel()` 返回值中 `pinToFree(desc): boolean` / `spawnPlace(desc, tc, tr): boolean` 语义变更:desc 为已上桌的 app(按 `kind==='app' && key` 判等)或 folder(按 `kind==='folder' && path` 判等)时返回 `false` 并 toast。新增 i18n key:`addPanelAppExists`、`addPanelFolderExists`。

- [ ] **Step 1: 写红测试**

在 `src/home/composables/useAddPanel.test.ts` 中新增(照文件里现有用例的 setup 惯例,含 `__resetAddPanelForTest`):

```ts
it('同一 app 第二次 pinToFree 被拒并 toast', () => {
  const { pinToFree } = useAddPanel(dims)
  expect(pinToFree({ kind: 'app', key: 'jellyfin', w: 1, h: 1 })).toBe(true)
  expect(pinToFree({ kind: 'app', key: 'jellyfin', w: 1, h: 1 })).toBe(false)
  expect(layout.items.filter((i) => i.kind === 'app' && i.key === 'jellyfin')).toHaveLength(1)
})

it('同一 folder(按 path 判等)第二次 spawnPlace 被拒', () => {
  const { spawnPlace } = useAddPanel(dims)
  const desc = { kind: 'folder' as const, key: 'docs', path: '/DATA/docs', w: 1, h: 1 }
  expect(spawnPlace(desc, 1, 1)).toBe(true)
  expect(spawnPlace(desc, 2, 1)).toBe(false)
})
```

在 `src/home/stores/layout.test.ts` 的 autoPin describe 中新增:

```ts
it('autoPin 不重复添加桌面上已有的同 key app 磁贴(手动 pin 后未进 seen 的场景)', () => {
  const s = useLayoutStore()
  s.pin({ kind: 'app', key: 'jellyfin', c: 1, r: 1, w: 1, h: 1 }) // 手动上桌,不进 seen
  s.autoPin([{ key: 'jellyfin' }], dims)
  expect(s.items.filter((i) => i.kind === 'app' && i.key === 'jellyfin')).toHaveLength(1)
  // seen 要补记,否则下一轮还会尝试
})
```

(具体 `dims`/store 初始化照各测试文件现有惯例;`autoPin` 的 decl 形状参考同 describe 现有用例。)

Run: `pnpm vitest run src/home/composables/useAddPanel.test.ts src/home/stores/layout.test.ts`
Expected: FAIL(新用例红,旧用例必须仍绿)

- [ ] **Step 2: 实现 useAddPanel 查重**

`src/home/composables/useAddPanel.ts`,替换 32-35 行的判重块:

```ts
const widgetUsed = (key: string) => layout.items.some((it) => it.kind === 'widget' && it.key === key)
const appWidgetUsed = (key: string) => layout.items.some((it) => it.kind === 'appwidget' && it.key === key)
const appUsed = (key: string) => layout.items.some((it) => it.kind === 'app' && it.key === key)
const folderUsed = (path: string) => layout.items.some((it) => it.kind === 'folder' && it.path === path)
// 查重覆盖 widget/appwidget/app/folder 四种 kind(photo 允许重复添加)。
// folder 按 path 判等:不同盘下允许同名文件夹并存。
const isDuplicate = (desc: Desc) =>
  (desc.kind === 'widget' && widgetUsed(desc.key)) ||
  (desc.kind === 'appwidget' && appWidgetUsed(desc.key)) ||
  (desc.kind === 'app' && appUsed(desc.key)) ||
  (desc.kind === 'folder' && folderUsed(desc.path ?? ''))
const existsMsgKey = (kind: Desc['kind']) =>
  kind === 'app' ? 'addPanelAppExists' : kind === 'folder' ? 'addPanelFolderExists' : 'addPanelWidgetExists'
```

`pinToFree` 第一行 `if (dupWidget(desc)) return false` 改为:

```ts
if (isDuplicate(desc)) { ui.showToast(i18n.global.t(existsMsgKey(desc.kind))); return false }
```

`spawnPlace` 第一行改为:

```ts
if (isDuplicate(desc)) { ui.showToast(i18n.global.t(existsMsgKey(desc.kind))); return false }
```

`toggleWidget` 里的 `dupWidget(...)` 改名为 `isDuplicate(...)`(行为等价:它只传 widget desc)。注意 `toggleWidget` 的非重复分支调用 `pinToFree`,此时 `isDuplicate` 必为 false,不会双重 toast。

- [ ] **Step 3: 实现 autoPin 查重**

`src/home/stores/layout.ts` autoPin 的 push 分支(193-198 行)改为:

```ts
if (!items.value.some((it) => it.kind === 'app' && it.key === d.key)) {
  const pos = firstFree(1, 1, items.value, dims)
  if (pos) items.value = [...items.value, tag({ kind: 'app', key: d.key, c: pos.c, r: pos.r, w: 1, h: 1 })]
}
if (d.widget && !items.value.some((it) => it.kind === 'appwidget' && it.key === d.key)) {
  const wpos = firstFree(d.widget.w, d.widget.h, items.value, dims)
  if (wpos) items.value = [...items.value, tag({ kind: 'appwidget', key: d.key, c: wpos.c, r: wpos.r, w: d.widget.w, h: d.widget.h })]
}
```

(`seen.value.add(d.key)` 与 `changed = true` 保持原样 —— 手动 pin 过的 app 借此补记进 seen。)

- [ ] **Step 4: 加 i18n key**

`src/i18n/zh_cn.base.ts`(`addPanelWidgetExists` 下一行):

```ts
  addPanelAppExists: '该应用已在主页',
  addPanelFolderExists: '该文件夹已在主页',
```

`src/i18n/en_us.base.ts` 同位置:

```ts
  addPanelAppExists: 'This app is already on the home screen',
  addPanelFolderExists: 'This folder is already on the home screen',
```

- [ ] **Step 5: 跑测试确认绿**

Run: `pnpm vitest run src/home/composables/useAddPanel.test.ts src/home/stores/layout.test.ts src/i18n/parity.test.ts src/home/components/AddPanel.test.ts src/home/components/AddPanel.spawn.test.ts src/home/components/AddPanel.spawn-place.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/home/composables/useAddPanel.ts src/home/stores/layout.ts src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/home/composables/useAddPanel.test.ts src/home/stores/layout.test.ts
git commit -m "fix(home): prevent duplicate app/folder tiles on the desktop

The add-panel dedup only covered widget kinds, so dragging the same app in
repeatedly stacked identical tiles; autoPin additionally trusted the seen
set alone and would re-add an app the user had already pinned manually."
```

---

### Task 5: Bug 6 — 文件夹图标溢出格子相互重叠

`theme.css`(约 703 行)的方形约束规则 `.kind-app .app-ic, .kind-folder .folder-ic, .kind-folder .folder-tile { flex:1 1 auto; min-height:0; width:auto; height:auto; aspect-ratio:1; }` 被 `FolderTile.vue:26` 的 scoped 规则 `.folder-ic { width:100%; height:100% }` 同分后置压掉(theme.css 在 main.ts 最先 import,SFC 样式后注入,特异度同为 0,2,0 时后者胜)。`.folder-ic` 是 `FileThumb` 的 inline-flex 根,内部 `<img>` 的固有尺寸(folder svg 多为 64×64)把内容最小宽度钉在 ~64px,窄窗口下格子缩到 60-75px 时溢出单格压到邻格。修法:删掉 scoped 覆盖,让 theme.css 方形规则生效,并给该规则补 `min-width: 0` 斩断替换元素的最小宽度下限。**只动 folder 侧;`AppTile.vue:46` 的 `.app-ic` 覆盖保持原样**(应用图标现状无 bug,动它属于无关视觉变更,验收时若发现 folder/app 尺寸失调再回来评估)。

**Files:**
- Modify: `src/home/components/FolderTile.vue`(删 26 行 scoped 规则)
- Modify: `src/styles/theme.css`(~703 行的方形规则加 `min-width: 0;` —— 动手前先读该行确认选择器原文)
- Create: `src/home/components/tileSizing.test.ts`(源码级守卫)

**Interfaces:**
- Consumes: theme.css 既有方形规则;`FileThumb.vue` 根元素(inline-flex,注释声明"尺寸由父级类名给到本组件根元素")。
- Produces: 无新接口;`.folder-ic` 尺寸自此完全由 theme.css 决定。

- [ ] **Step 1: 写红守卫测试**

Create `src/home/components/tileSizing.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import folderSrc from './FolderTile.vue?raw'
import themeSrc from '../../styles/theme.css?raw'

// bug.txt #6:FolderTile 的 scoped `.folder-ic { width:100%; height:100% }` 与
// theme.css 的方形规则(aspect-ratio:1)特异度同分,SFC 样式后注入而胜出,方形
// 规则整条变死规则;.folder-ic 内部 <img> 的 64px 固有宽度进而把磁贴撑出格子。
// 守卫:SFC 不得再对 .folder-ic 声明 width/height;theme.css 方形规则必须带
// min-width:0(替换元素 min-width:auto 的下限就是当年撑爆格子的元凶)。
describe('desktop tile sizing (bug.txt #6)', () => {
  const style = folderSrc.slice(folderSrc.indexOf('<style'))
  it('FolderTile scoped style must not redeclare .folder-ic width/height', () => {
    expect(style).not.toMatch(/\.folder-ic[^{]*\{[^}]*(width|height)\s*:/)
  })
  it('theme.css square-tile rule keeps aspect-ratio and min-width:0', () => {
    const rule = themeSrc.match(/\.kind-folder \.folder-ic[^{]*\{[^}]*\}/)?.[0] ?? ''
    expect(rule).toMatch(/aspect-ratio\s*:\s*1/)
    expect(rule).toMatch(/min-width\s*:\s*0/)
  })
})
```

Run: `pnpm vitest run src/home/components/tileSizing.test.ts`
Expected: FAIL(两条都红)

- [ ] **Step 2: 改实现**

1. `src/home/components/FolderTile.vue`:删除 `.folder-ic { width: 100%; height: 100%; }` 一行,并把 23 行注释改为:`/* .kind-folder 列布局 + .folder-ic 尺寸(方形 aspect-ratio 规则)全在全局 theme.css —— 不要在此覆盖 width/height,同分后置会压掉方形规则(bug.txt #6) */`
2. `src/styles/theme.css` ~703 行:先 Read 确认原文,在该规则的声明块里 `min-height: 0;` 后加 `min-width: 0;`。

- [ ] **Step 3: 跑守卫与既有测试**

Run: `pnpm vitest run src/home/components/tileSizing.test.ts src/home/components/FolderTile.test.ts src/home/components/GridItem.edit.test.ts src/home/components/GridCanvas.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/home/components/FolderTile.vue src/styles/theme.css src/home/components/tileSizing.test.ts
git commit -m "fix(home): keep folder tiles inside their grid cell

FolderTile's scoped .folder-ic { width/height: 100% } outranked (same
specificity, later injection) the theme.css square-tile rule, reviving the
inner <img>'s 64px intrinsic min-width; on narrow windows cells shrink
below that and folder tiles overlapped their neighbours. Drop the scoped
override and add min-width:0 to the square rule, with a source-level guard
so the override cannot come back."
```

> 注:jsdom 无布局,真实宽度只能在 Task 8 的真机截图里复核(重点看窄窗口下 folder 磁贴)。

---

### Task 6: Bug 4 — 空文件夹拖拽上传被静默丢弃

上传管线只有"文件"一种实体:`dropEntries.ts` 的 `walk()` 只收集文件,空目录在遍历中消失;`Files.vue onDrop:332` 对空结果直接 `return`,连提示都没有。修法:`walk` 额外产出空目录相对路径,落点处逐个调 `service.folder.create`(容忍业务码 20001「目录已存在」)。注:`webkitdirectory` 文件选择器按浏览器规范拿不到空目录,该入口无法修,属平台限制,代码注释里写明。

**Files:**
- Modify: `src/files/upload/dropEntries.ts`(walk 收集空目录;返回类型改为 `{ files, emptyDirs }`)
- Create: `src/files/upload/emptyDirs.ts`(建目录 util,容忍已存在)
- Modify: `src/views/Files.vue`(`onDrop` ~324-334 行、`commitSelectedFiles` ~237-301 行)
- Modify: `src/i18n/zh_cn.base.ts` / `en_us.base.ts`(新增 `filesEmptyDirsCreated`)
- Test: `src/files/upload/dropEntries.test.ts`(15 行有 createReader fake 可直接扩)、Create `src/files/upload/emptyDirs.test.ts`

**Interfaces:**
- Consumes: `service.folder.create(path)`(`POST /v1/folder`,来自 `@nimotech/nimoos-service`;失败时 `unwrap` 抛 `Error & { code?: number; detail?: string }`,`code` 为业务码,**20001 = DIR_ALREADY_EXISTS 视为成功**);`joinPath`(`src/files/util/pathOps`);`splitProtectedUploads`(`src/files/util/protect.ts:15`,接受 `{ relativePath }[]`)。
- Produces:
  - `readDroppedEntries(dt): Promise<{ files: DroppedFile[]; emptyDirs: string[] }>`(**破坏性签名变更**,改前 `grep -rn "readDroppedEntries" src/` 找齐所有调用方一并更新 —— 已知 `src/views/Files.vue:331` 与 `src/files/upload/dropEntries.test.ts`)
  - `createEmptyDirs(relPaths: string[], targetPath: string): Promise<{ created: number; failed: string[] }>`
  - `commitSelectedFiles(entries, emptyDirs?: string[])` 追加可选参数,缺省 `[]`,旧调用方(`handleSelectedFiles`、`onPaste`)不受影响。
  - i18n key `filesEmptyDirsCreated`。

- [ ] **Step 1: 写红测试(dropEntries)**

在 `src/files/upload/dropEntries.test.ts` 用现有 fake 惯例新增(所有既有用例的返回值断言同步改成 `.files`):

```ts
it('空目录被收进 emptyDirs 而不是消失', async () => {
  const dt = fakeDataTransfer([dirEntry('empty', [])])
  const r = await readDroppedEntries(dt)
  expect(r.files).toEqual([])
  expect(r.emptyDirs).toEqual(['empty'])
})
it('只含空子目录的目录:收叶子空目录(父目录由后端 MkdirAll 顺带创建)', async () => {
  const dt = fakeDataTransfer([dirEntry('a', [dirEntry('a/b', [])])])
  const r = await readDroppedEntries(dt)
  expect(r.emptyDirs).toEqual(['a/b'])
})
it('有文件的目录不进 emptyDirs', async () => {
  const dt = fakeDataTransfer([dirEntry('d', [fileEntry('d/x.txt')])])
  const r = await readDroppedEntries(dt)
  expect(r.files.map((f) => f.relativePath)).toEqual(['d/x.txt'])
  expect(r.emptyDirs).toEqual([])
})
```

(fake 构造器名按该测试文件现有写法适配。)
Run: `pnpm vitest run src/files/upload/dropEntries.test.ts` — Expected: FAIL

- [ ] **Step 2: 实现 dropEntries**

`src/files/upload/dropEntries.ts`:

```ts
export interface DroppedTree { files: DroppedFile[]; emptyDirs: string[] }

async function walk(entry: FsEntry | null, out: DroppedFile[], emptyDirs: string[]): Promise<void> {
  if (!entry) return
  if (entry.isFile) {
    const f = await entryToFile(entry)
    if (f) out.push({ file: f, relativePath: stripLead(entry.fullPath || entry.name) })
    return
  }
  if (entry.isDirectory && entry.createReader) {
    const children = await readAllEntries(entry.createReader())
    // 空目录:整条管线只有"文件"实体,目录本是文件落盘的副作用;不在这里记下相对
    // 路径,空目录就从上传里消失(bug.txt #4)。只记叶子:父链由后端 MkdirAll 补齐。
    // webkitdirectory 选择器按规范拿不到空目录,那个入口无法修,只有拖拽走得到这里。
    if (!children.length) { emptyDirs.push(stripLead(entry.fullPath || entry.name)); return }
    for (const child of children) await walk(child, out, emptyDirs)
  }
}
```

`readDroppedEntries` 返回 `{ files, emptyDirs }`(两条分支与 fallback 相应调整;fallback flat 列表 `emptyDirs` 恒为 `[]`)。

- [ ] **Step 3: 写红测试(emptyDirs util)**

Create `src/files/upload/emptyDirs.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@nimotech/nimoos-service', () => ({ service: { folder: { create: vi.fn() } } }))
import { service } from '@nimotech/nimoos-service'
import { createEmptyDirs } from './emptyDirs'

const create = service.folder.create as ReturnType<typeof vi.fn>
beforeEach(() => create.mockReset())

describe('createEmptyDirs', () => {
  it('对每个相对路径调 folder.create(target + rel)', async () => {
    create.mockResolvedValue(undefined)
    const r = await createEmptyDirs(['a/b', 'c'], '/DATA/Documents')
    expect(create).toHaveBeenCalledWith('/DATA/Documents/a/b')
    expect(create).toHaveBeenCalledWith('/DATA/Documents/c')
    expect(r).toEqual({ created: 2, failed: [] })
  })
  it('业务码 20001(已存在)按成功计——合并进已有文件夹是正常场景', async () => {
    create.mockRejectedValue(Object.assign(new Error('Fail'), { code: 20001 }))
    const r = await createEmptyDirs(['a'], '/DATA')
    expect(r).toEqual({ created: 1, failed: [] })
  })
  it('其他错误进 failed', async () => {
    create.mockRejectedValue(Object.assign(new Error('Fail'), { code: 500 }))
    const r = await createEmptyDirs(['a'], '/DATA')
    expect(r).toEqual({ created: 0, failed: ['a'] })
  })
})
```

Run: `pnpm vitest run src/files/upload/emptyDirs.test.ts` — Expected: FAIL(模块不存在)

- [ ] **Step 4: 实现 emptyDirs util**

Create `src/files/upload/emptyDirs.ts`:

```ts
import { service } from '@nimotech/nimoos-service'
import { joinPath } from '../util/pathOps'

// 为拖拽上传里的空目录补建文件夹。后端 POST /v1/folder 走 MkdirAll,父链自动补齐;
// 目录已存在时返回业务码 20001(unwrap 抛 Error{code:20001}),对"把文件夹合并进
// 已有同名文件夹"的上传语义而言就是成功,必须容忍。
const DIR_ALREADY_EXISTS = 20001

export async function createEmptyDirs(
  relPaths: string[],
  targetPath: string,
): Promise<{ created: number; failed: string[] }> {
  let created = 0
  const failed: string[] = []
  for (const rel of relPaths) {
    try { await service.folder.create(joinPath(targetPath, rel)); created++ }
    catch (e) {
      if ((e as { code?: number }).code === DIR_ALREADY_EXISTS) created++
      else failed.push(rel)
    }
  }
  return { created, failed }
}
```

Run: `pnpm vitest run src/files/upload/emptyDirs.test.ts` — Expected: PASS

- [ ] **Step 5: 接线 Files.vue**

1. `onDrop`(~324 行):

```ts
const dropped = await readDroppedEntries(e.dataTransfer)
if (!dropped.files.length && !dropped.emptyDirs.length) return
await commitSelectedFiles(dropped.files.map((d) => ({ file: d.file, relativePath: d.relativePath })), dropped.emptyDirs)
```

2. `commitSelectedFiles` 签名加 `emptyDirs: string[] = []`;在 snapshot 拦截之后、`if (!allowed.length) return`(279 行)之前不动 —— 在函数尾部(`addFilesToQueue` 之后)追加空目录处理,并把 279 行的早退改成"没有文件但有空目录时不早退":

```ts
if (!allowed.length && !dirsAllowed.length) return
```

具体:在 `splitProtectedUploads(normalized)` 后对空目录做同样的保护过滤:

```ts
const { accepted: dirsAllowed, rejected: dirsProtected } =
  splitProtectedUploads(emptyDirs.map((p) => ({ relativePath: p })))
for (const { relativePath } of dirsProtected.map((p) => ({ relativePath: p })))
  toast.show(t('filesUploadProtected', { name: relativePath }))
```

(注意 `splitProtectedUploads` 的 `rejected` 是 string[],直接 `for (const name of dirsProtected) toast.show(t('filesUploadProtected', { name }))`。)
函数尾部追加:

```ts
if (dirsAllowed.length) {
  const { created, failed } = await createEmptyDirs(dirsAllowed.map((d) => d.relativePath), targetPath)
  if (created) toast.show(t('filesEmptyDirsCreated', { count: created }))
  for (const name of failed) toast.show(t('filesUploadProtected', { name })) // 复用「已拒绝」样式?不——见下
  if (created && targetPath === files.currentPath) await files.load(files.currentPath)
}
```

失败提示不复用 filesUploadProtected(语义不对),改为 `toast.show(t('filesOpFailed'))`(失败聚合一条即可):`if (failed.length) toast.show(t('filesOpFailed'))`。
另注意:纯空目录批(`allowed.length === 0`)会跳过 conflicts/addFilesToQueue,直接走到尾部的目录创建 —— 确认代码路径上 275-301 行之间的每个 `return` 都考虑了 `dirsAllowed`(只需改 279 行与 287-290 行两处早退条件:`if (!resolved.accepted.length)` 分支在 `dirsAllowed.length` 时不 return,继续落到目录创建;实现时以控制流清晰为准,可把目录创建提成本地函数先行调用)。

3. i18n:

```ts
// zh_cn.base.ts(filesUploadSkipped 附近)
  filesEmptyDirsCreated: '已创建 {count} 个空文件夹',
// en_us.base.ts
  filesEmptyDirsCreated: 'Created {count} empty folder(s)',
```

- [ ] **Step 6: 跑文件区相关测试**

Run: `pnpm vitest run src/files/upload/dropEntries.test.ts src/files/upload/emptyDirs.test.ts src/views/Files.upload.test.ts src/views/__tests__/Files.uploadConflict.test.ts src/i18n/parity.test.ts`
Expected: PASS(`Files.upload.test.ts` 若 mock 了 `readDroppedEntries` 旧返回形状,按新形状更新)

- [ ] **Step 7: Commit**

```bash
git add src/files/upload/dropEntries.ts src/files/upload/emptyDirs.ts src/views/Files.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/files/upload/dropEntries.test.ts src/files/upload/emptyDirs.test.ts src/views/Files.upload.test.ts
git commit -m "fix(files): create empty folders from drag-drop uploads

The upload pipeline only modeled files; directories existed as a side
effect of file ingest, so an empty folder vanished during traversal with
no feedback at all. Collect leaf empty directories while walking the drop
and create them via POST /v1/folder, tolerating 20001 (already exists) as
success. The webkitdirectory picker never reports empty dirs (platform
limitation), so only the drag path can be fixed."
```

---

### Task 7: Bug 2 — 最深路径下新建/上传:前置校验 + 报错不再只有 "Fail"

后端对超长路径(内核 ENAMETOOLONG)一路丢弃 error,新建返回字面 "Fail",tus 上传则在异步 ingest 阶段静默失败而前端已报成功。后端不在本分支范围;前端修两点:(1) 新建与上传前按 Linux 限制(单段 NAME_MAX 255 字节、全路径 PATH_MAX 4096 字节)前置校验并给出明确文案;(2) `useFileOps.errMsg` 换用 `folderListErrorMsg` 的取值顺序(detail → response.data.data → message)并把无信息量的字面 "Fail" 落回本地文案。

**Files:**
- Create: `src/files/util/pathLimits.ts` + `src/files/util/pathLimits.test.ts`
- Modify: `src/files/composables/useFileOps.ts`(`errMsg` 18-21 行;`createFolder`/`createFile` 42-52 行)
- Modify: `src/views/Files.vue` `commitSelectedFiles`(~269 行 `normalized` 之后插入过滤)
- Modify: `src/i18n/zh_cn.base.ts` / `en_us.base.ts`(新增 3 个 key)
- Test: `src/files/composables/useFileOps.test.ts`

**Interfaces:**
- Consumes: `joinPath`(`src/files/util/pathOps`);`folderListErrorMsg(e): string`(`src/files/util/folderListError.ts:8`,空串表示取不到);`files.currentPath` 是**真实路径**(非虚拟路径,见 Files.vue:257 注释)。
- Produces:
  - `nameTooLong(name: string): boolean`、`pathTooLong(path: string): boolean`、`createBlocked(dir: string, name: string): 'name' | 'path' | null`(均按 UTF-8 字节数,`TextEncoder`)
  - i18n key:`filesNameTooLong`、`filesPathTooLong`、`filesUploadPathTooLong`

- [ ] **Step 1: 写红测试(pathLimits)**

Create `src/files/util/pathLimits.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { nameTooLong, pathTooLong, createBlocked } from './pathLimits'

describe('pathLimits(Linux NAME_MAX=255 / PATH_MAX=4096 字节,UTF-8)', () => {
  it('255 字节名可用,256 字节名过长', () => {
    expect(nameTooLong('a'.repeat(255))).toBe(false)
    expect(nameTooLong('a'.repeat(256))).toBe(true)
  })
  it('多字节按字节数算:86 个中文字 = 258 字节 → 过长', () => {
    expect(nameTooLong('文'.repeat(85))).toBe(false) // 255 字节
    expect(nameTooLong('文'.repeat(86))).toBe(true)  // 258 字节
  })
  it('全路径超 4095 字节 → 过长', () => {
    expect(pathTooLong('/' + 'a'.repeat(4094))).toBe(false)
    expect(pathTooLong('/' + 'a'.repeat(4095))).toBe(true)
  })
  it('createBlocked:名字先判,再判拼接后的全路径', () => {
    expect(createBlocked('/DATA', 'x'.repeat(256))).toBe('name')
    expect(createBlocked('/' + 'd'.repeat(4000), 'x'.repeat(100))).toBe('path')
    expect(createBlocked('/DATA', 'ok')).toBe(null)
  })
})
```

Run: `pnpm vitest run src/files/util/pathLimits.test.ts` — Expected: FAIL(模块不存在)

- [ ] **Step 2: 实现 pathLimits**

Create `src/files/util/pathLimits.ts`:

```ts
import { joinPath } from './pathOps'

// Linux 限制:单个路径段 NAME_MAX = 255 字节;全路径 PATH_MAX = 4096 字节(含结尾 NUL,
// 可用 4095)。按 UTF-8 字节数算(中文 3 字节/字)。后端对 ENAMETOOLONG 一路丢 error、
// 只回字面 "Fail"(route/v1/file.go MkdirAll / service/system.go),tus 上传更是在异步
// ingest 里静默失败 —— 前端前置校验是唯一能给出明确文案的地方(bug.txt #2)。
const NAME_MAX = 255
const PATH_MAX = 4095
const bytes = (s: string) => new TextEncoder().encode(s).length

export function nameTooLong(name: string): boolean { return bytes(name) > NAME_MAX }
export function pathTooLong(path: string): boolean { return bytes(path) > PATH_MAX }

/** 在 dir 下以 name 新建是否会超限。'name' = 名字本身超长;'path' = 拼接后全路径超长。 */
export function createBlocked(dir: string, name: string): 'name' | 'path' | null {
  if (nameTooLong(name)) return 'name'
  if (pathTooLong(joinPath(dir, name))) return 'path'
  return null
}
```

Run: `pnpm vitest run src/files/util/pathLimits.test.ts` — Expected: PASS

- [ ] **Step 3: 接线 useFileOps(校验 + errMsg)**

`src/files/composables/useFileOps.ts`:

1. imports 加:`import { createBlocked } from '../util/pathLimits'` 与 `import { folderListErrorMsg } from '../util/folderListError'`。
2. `errMsg` 替换为:

```ts
function errMsg(e: unknown, fallback: string): string {
  // detail → response.data.data → message 的取值顺序与目录列表报错一致;后端把
  // 意外 errno(如 ENAMETOOLONG)映射成字面 "Fail",无信息量,落回本地文案。
  const m = folderListErrorMsg(e)
  return !m || m === 'Fail' ? fallback : m
}
```

3. `createFolder` 与 `createFile` 的 try 之前各加(两处相同):

```ts
const blocked = createBlocked(files.currentPath, name)
if (blocked) { toast.show(t(blocked === 'name' ? 'filesNameTooLong' : 'filesPathTooLong')); return }
```

- [ ] **Step 4: 上传前过滤超长路径**

`src/views/Files.vue` `commitSelectedFiles`,`const normalized = toSelectedFiles(wanted, targetPath)`(269 行)之后、`splitProtectedUploads` 之前插入:

```ts
// 超长路径前置过滤:后端 tus ingest 对 ENAMETOOLONG 是异步静默失败,前端会先报
// "上传成功"(bug.txt #2)。relativePath 逐段查 NAME_MAX,拼接目标全路径查 PATH_MAX。
const fitsLimits = (rel: string) =>
  !rel.split('/').some(nameTooLong) && !pathTooLong(joinPath(targetPath, rel))
const withinLimits = normalized.filter((e) => fitsLimits(e.relativePath))
const tooLong = normalized.length - withinLimits.length
if (tooLong > 0) toast.show(t('filesUploadPathTooLong', { count: tooLong }))
```

后续 `splitProtectedUploads(normalized)` 改为 `splitProtectedUploads(withinLimits)`。imports 补 `nameTooLong, pathTooLong`(from `../files/util/pathLimits`)与 `joinPath`(若尚未引入,from `../files/util/pathOps`)。

4. i18n:

```ts
// zh_cn.base.ts(filesOpFailed 附近)
  filesNameTooLong: '名称过长(最多 255 字节)',
  filesPathTooLong: '路径过长,无法在此创建',
  filesUploadPathTooLong: '{count} 个文件路径过长,已跳过',
// en_us.base.ts
  filesNameTooLong: 'Name too long (max 255 bytes)',
  filesPathTooLong: 'Path too long to create here',
  filesUploadPathTooLong: 'Skipped {count} file(s): path too long',
```

- [ ] **Step 5: 补 useFileOps 行为测试**

在 `src/files/composables/useFileOps.test.ts` 按现有 mock 惯例新增:

```ts
it('createFolder:名字超 255 字节 → toast filesNameTooLong,不发请求', async () => {
  await ops.createFolder('x'.repeat(256))
  expect(folderCreateMock).not.toHaveBeenCalled()
  // 断言 toast 收到 filesNameTooLong 的文案(按该文件现有 toast 断言写法)
})
it('createFolder:后端 message 为字面 "Fail" → 显示本地 filesOpFailed 而非 "Fail"', async () => {
  folderCreateMock.mockRejectedValue(new Error('Fail'))
  await ops.createFolder('ok')
  // 断言 toast 文案 === zh_cn 的 '操作失败'
})
it('createFolder:错误带 detail → 显示 detail 原文', async () => {
  folderCreateMock.mockRejectedValue(Object.assign(new Error('Fail'), { detail: 'no space left on device' }))
  await ops.createFolder('ok')
  // 断言 toast 文案 === 'no space left on device'
})
```

Run: `pnpm vitest run src/files/composables/useFileOps.test.ts src/files/util/pathLimits.test.ts src/views/Files.upload.test.ts src/i18n/parity.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/files/util/pathLimits.ts src/files/util/pathLimits.test.ts src/files/composables/useFileOps.ts src/views/Files.vue src/i18n/zh_cn.base.ts src/i18n/en_us.base.ts src/files/composables/useFileOps.test.ts
git commit -m "fix(files): preflight NAME_MAX/PATH_MAX and surface real error detail

At maximum folder depth the backend drops the ENAMETOOLONG error and
answers with the literal string \"Fail\" for create, while tus uploads fail
silently in the async ingest step after the client already reported
success. Validate name (255 bytes) and full path (4096 bytes) up front
with clear copy, and route errMsg through folderListErrorMsg so a backend
detail wins over the useless \"Fail\" literal."
```

> 后端遗留(本分支不修,验收报告里挂账):`route/v1/file.go` MkdirAll/PostCreateFile 丢弃 error、`service/system.go:283` MkdirAll 返回值被丢、tus ingest 失败无前端可见信号(需要 task 状态轮询或事件)。

---

### Task 8: 全量验证 + 5277 端口验收

**Files:** 无新改动(只验证;发现问题回到对应 task 修)

- [ ] **Step 1: 全量测试 + 类型检查**

Run(前台,输出留证):
```bash
pnpm test 2>&1 | tail -20
pnpm exec vue-tsc --noEmit
```
Expected: 全绿、无类型错误。

- [ ] **Step 2: 确认 dev server 存活并已吃到改动**

```bash
curl -sf http://localhost:5277/app/ >/dev/null && echo alive
```
本计划不改 `packages/service/`,vite HMR 对 `src/` 改动即时生效,无需重启 dev server。

- [ ] **Step 3: 真机浏览器验收(无头 chromium + CDP,配方见记忆 newui-cdp-probe-auth-bypass:localStorage 连 version 一起塞,带 query 整页直达)**

逐项验收(能自动化的自动化,截图存 scratchpad,暗色 + 亮色各一轮):
1. **Bug 1(HEAD 已修,确认不回归)**:桌面编辑态删光所有磁贴 → 刷新 → 仍是空桌面(localStorage `[]` 生效)。
2. **Bug 3**:files 选中文件 → 工具栏第三个按钮文案为"取消选择"。
3. **Bug 5**:添加面板拖同一 app 上桌两次 → 第二次被拒并 toast"该应用已在主页",桌面仅 1 个磁贴。
4. **Bug 6**:窄窗口(如 900×700)下桌面放 2 个相邻文件夹磁贴 → 截图确认无重叠;`getComputedStyle(document.querySelector('.folder-ic')).aspectRatio === '1'`(或 width===height)。
5. **Bug 8**:进入任一多服务应用的控制台页(或直接检查)`getComputedStyle(console-svc 的 option).backgroundColor` 为实心 `--set-option-bg` 值(原生弹出列表截不了图,以 computed style 为证)。
6. **Bug 2**:在 files 新建对话框输入 300 字符名字 → toast"名称过长(最多 255 字节)",无网络请求。
7. **Bug 4/7**:拖拽空文件夹与 RAID 共享文件夹删除依赖真实文件系统/设备状态,CDP 模拟不了 DataTransfer 目录项 —— 单测已覆盖逻辑,真机手工项挂账给机主(见 Step 4)。

- [ ] **Step 4: 写验收报告**

汇总:每个 bug 修了什么、测试证据、5277 验收截图路径、挂账清单(机主手工项:空文件夹拖拽、RAID 共享文件夹删除、真实最深路径上传;后端遗留三条见 Task 7 尾注)。

