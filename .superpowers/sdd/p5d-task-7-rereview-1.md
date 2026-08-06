# P5d T7 修复轮 1 —— 范围收窄复审(BASE ad2d600 → HEAD 76dcd8b)

复审者:范围收窄复审(仅两条 finding + 修复 diff 本身的破坏检测)。禁改仓库、禁提交、
禁 kill/重起 dev server。全程 `cp` 备份 + 行首锚定注入 + md5 逐字节比对还原,禁
`git checkout -- <path>` / `git restore`。

## Finding 1 —— 2 处注释色字面量(§0.3,R17):**ADDRESSED**

- `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\('` 对**改后当前全文**（不是 diff）跑
  `NoteEditPane.vue`、`NotesView.vue` 两文件,均 exit=1(零命中)。全文通读也未见其它注释里
  夹带色值。
- 两处都是**替换**,不是删光:
  - `NoteEditPane.vue:127-128` 改后 = 「唯一一处内联色在蓝本 `:152`(冲突弹窗头图标底色,
    附录 B §B.4 第 35 行是权威映射)」—— 保留蓝本 `file:line`,新增附录 B 行号,删掉的只是
    `rgba(255,149,0,.14)` 这个字面量本身。
  - `NotesView.vue:55-60` 改后 = 「蓝本 `:85` 的草稿计数底色字面量……附录 B §B.4 第 34 行是
    权威映射」——同样保留蓝本 `:85` 引用 + 附录 B 行号,只丢了旧版顺带写的「/126」这个次要
    行号(不影响权威映射本身)。下游映射依据未丢失。
- `NotesView.vue` 本轮**确实只改了这一处**:自跑 `git diff ad2d600..76dcd8b -- .../NotesView.vue`,
  输出只有 1 个 hunk,恰好是这段注释,其余逐行未动。

## Finding 2 —— 新增 `<script>` 块注释色字面量守卫:**ADDRESSED**

- 范围钉死 `KNOWLEDGE_VUE_FILES`(13 项,与既有守卫同一常量),用 `readFileSync`
  (`node:fs`,非 `?raw`)读取 `kbDir2 = resolve(__dirname, '../knowledge')` 下的文件。

**RED(自己换文件,非实现者用过的 `NotesMarkdownEditor.vue`)**:在 `QueueView.vue`
`<script setup>` 首行注入 `// PROBE-INJECT-REREVIEW-1: 假设这里写了 rgba(255,149,0,.14)…`
（md5 落盘前 `ff6bd0d…`→注入后 `c09b298…`，证真落盘）→ 复跑该 describe:精确报红
`views/QueueView.vue —— <script> 块注释里发现 rgb()/hsl() 色字面量`，其余 12 个文件仍绿
（`1 failed | 12 passed | 281 skipped`）。cp 覆盖还原，md5 复核回到 `ff6bd0d…`，
`git status --porcelain` 空。

**GREEN(主动注入,非被动观察)**:同一文件注入一条全新申报注释
`// K39:蓝本 knowledge.scss:2060,附录 B §B.1 是权威`（md5 `a2870c3…`）→ 复跑:
`13 passed`，`views/QueueView.vue` 该条不报红 —— 不误报。cp 还原，md5 复核回到
`ff6bd0d…`，`git status` 空。

**另核三件事**：
1. `node:fs` 真用了：`readFileSync` 来自文件顶部 `node:fs` import（非 `?raw`）。
2. `transparent` 不误判：在 `SettingsView.vue` 注入
   `// PROBE-TRANSPARENT-CHECK: background is transparent here, not a color literal`
   （md5 `b5f8473…`→`a...`）→ 复跑 `13 passed`，`views/SettingsView.vue` 不报红。cp 还原，
   md5 复核回到 `b5f8473…`，`git status` 空。
3. 范围未扩全仓：`KNOWLEDGE_VUE_FILES` 数组实测仍是 13 项，未见 glob/常量被替换。

**13/13 非空循环**：单独跑 `knowledgeStyles.test.ts -t "块注释"`，`--reporter=verbose`
逐条列出 13 个不同文件名的独立 test case（各自 `%s —— <script> 块注释…`），
`Tests 13 passed | 281 skipped (294)` —— 每个文件各求值一次，不是空转。

## 三门/算式复核

自己独立跑 `pnpm exec vitest run`（全量，非采信报告日志）：`Test Files 331 passed (331)`、
`Tests 3923 passed (3923)`。diff 里只新增 13 条 `it.each` 用例（对应清单 13 个文件各 +1
条新守卫断言组），`3910 + 13 = 3923` 算式成立，未新增测试文件（仍 331）。

## 产品代码改动是否仅注释

`git diff ad2d600..76dcd8b -- .../NoteEditPane.vue .../NotesView.vue` 两文件各只有 1 个
hunk，全部落在文件头 HTML 注释块内；`<script>`/`<template>` 逐行核对未变。确认仅注释改动。

## 修复 diff 内新引入的破坏

无。diff 只涉及 3 个源文件：两个 `.vue` 仅注释文本替换（无代码行改动），
`knowledgeStyles.test.ts` 只新增一个独立 describe 块（纯增量，追加在既有描述块之后），
未删除/未减弱任何既有 `expect`。

## 范围外观察（不延长本轮）

- `KNOWLEDGE_VUE_FILES` 常量在文件里出现两次定义位置一致性良好；新 describe 复用同一
  `kbDir2`（等价 `kbDir`），未引入第二套目录解析逻辑，风格与既有 3 个守卫一致。
- 新守卫的行注释正则 `/\/\/.*$/gm` 对同一物理行内「代码后跟注释」的场景会把整行都当注释扫
  （只影响误报方向，不影响本轮判定，供后续留意）。
