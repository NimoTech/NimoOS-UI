# 注释英文化 · 交接（2026-08-14，08-15 续写）

第一轮分支 `chore/english-comments` 已合入 master（`6c4236af`）。
第二轮在 `chore/english-comments-2`，检查点提交 `778b7ad6`。

## 范围（机主 08-13 拍板，未变）

翻：**代码注释、测试标题（`it`/`describe`）、开发者可见的断言消息**，以及 4 个 README
（根 / `oss/README.md` / `oss/files/README.md` / `scripts/tmlab/README.md`）。

不翻：

- `docs/`、`.superpowers/` 下的台账 / plan / spec / handoff / roadmap —— 一律留中文
- 本仓 `CLAUDE.md`（属"文档"，机主未要求）
- 界面文案。已核实模板里 **0 处**写死中文，UI 全走 i18n，默认 zh_cn
- 测试里断言界面文案的值（`expect(...).toBe('已保存')`）、fixture 数据、
  CJK 本身是被测对象的（多字节截断、中文文件名、非英文查询）
- 4 个 SVG：中文在 `id="图层_1"` 上，被 `clip-path="url(#…)"` 引用，改了图标会裂
- `MCP_ERR_RE` 之类匹配后端中文错误串的正则 —— 那是数据不是文案

`design-export/` 三个 HTML 的删除态按机主指示保留。

## 进度

| | 文件 | 中文行 |
|---|---|---|
| 第一轮起始 | 1073 | 40,764 |
| 第二轮起始（含 SP15 合入带回的量） | 552 | 15,100 |
| 第三轮起始 | 313 | 4,149 |
| 现在（提交 `0ac3d417`） | **299** | **2,270** |

`src/` / `packages/` / `scripts/` 三棵树的**注释英文化实质完成**。剩余 2,270 行
**绝大部分是"有意保留"**，不是没做完的活：

- 断言值 / fixture（`toBe('已暂停')`、`name: '张三'`）
- i18n 词条与组件内联 locale 表（`{ zh_cn: '简体中文' }`）
- **CJK 本身是被测对象**：多字节截断（`'中'.repeat(85)`）、中文文件名往返、
  单字中文查询高亮（税/猫）、本地化相对时间（`刚刚` / `5 分钟前`）、中文 IME 合成
- **中文是反面靶子**：`PhotosFilterPopover.test.ts` 有条测试守护"按钮文案必须走 i18n key、
  不许在模板里写死 `应用`/`提交`/`取消`"，翻掉那几个词守卫自我失效
- 引用了被断言 UI 串的测试标题（引号内保持中文，只翻外围叙述）

第三轮 44 批全部收官，包括前两轮反复被额度中断的两个大件：
`knowledgeStyles.test.ts`（732 → 0）、`knowledge.scss`（316 → 0）。

## 🔴 头等大事之零：断言值里的标点是有意义的

第三轮才补进指令的一条，**回报最高**。两条规则，别混：

**(A) 断言值 / fixture 里，标点一个字节都不许动。** 全角与半角是**不同字符**：

| 保持原样 | 绝不"规范化"成 |
|---|---|
| `，` `。` `：` `；` | `,` `.` `:` `;` |
| `！` `？` | `!` `?` |
| `（` `）` | `(` `)` |
| `、` | `,` |
| `…`（单字符 U+2026） | `...`（三个点） |
| `“ ” ‘ ’ 「 」` | `" " ' '` |

`toBe('迁移完成！')` 与 `toBe('迁移完成!')` 是两个不同断言，其中一个必红。
**永远不要手打中文串，只能复制**；改完含中文串的行要回读确认没变。
实测命中：`AppPathDialog.test.ts` 的 `'迁移完成！'`、`PhotosSearchGrid.test.ts` 的
`'正在加载更多…'`、`ParserTest.test.ts` 的 `（N 字符）`。

**(B) 自己写的英文散文用 ASCII 标点。** 撇号会截断单引号字符串（见下 #1），
优先改写而不是转义。绝不把全角引号写进代码位置（见下 #3）。

**边界**：测试标题引用被断言 UI 串时，**引号内保持中文原样（含标点），只翻外围叙述** ——
否则标题会声称在断言一个不存在的值。

## 🔴 头等大事：翻译会引入四类语法级破坏（第二轮在 master 上逮到 13 处）

**中文原文里这些都不存在，是英文化本身的副产品。** 已在 `778b7ad6` 全部修掉，
但**后续每一批都会继续制造，必须每批都查**。

| 类型 | 表现 | 本轮处数 |
|---|---|---|
| 英文所有格撇号 | `it('...blueprint's...')` 撇号截断单引号字符串 | 11 |
| `*/` 嵌进 JSDoc | `` `/* */` `` 提前关闭外层块，后续 prose 变活代码 | 4 |
| 全角引号 | `<script setup lang=”ts”>` 整个 SFC 解析失败 | 1 |
| `;` 进 `theme-exception` | 配色守卫豁免窗口提前关闭，被保护的声明被判违规 | 4 |

`*/` 那几处，中文原作者**特意写成 `` `/* *\/` `` 转义过**，翻译时把反斜杠弄丢了。
修法就是把反斜杠加回去。撇号那类用 `\'` 转义，或改写掉所有格。

第四类的机制：配色守卫见 `theme-exception` 开启豁免、**见第一个 `;` 或 `}` 就关闭**。
中文原注释是**单行、用全角 `，` 分句**，窗口一直活到被保护的声明；英文 prose 爱用分号，
翻译既引入了 `;` 又把单行注释拆成多行 ⇒ 窗口提前关闭。修法：标记与被保护声明之间
**不许出现 `;`**（改用破折号/逗号），且**不要把单行标记注释拆行**。

## 🔴 还有一类不炸语法、但会让守卫变红：注释里的 CSS 具名色

配色守卫（`knowledgeStyles.test.ts` / `parserStyles.test.ts` / `kvmStyles.test.ts`）
**连注释文本一起扫**具名色。中文"三级灰"翻成 `tertiary gray`、🔴 翻成 `Red flag` 都会触发。

注释里改用色调词：`muted` / `light` / `dark` / `danger-toned` / `amber-toned` /
`accent-toned` / `success-toned`，🔴 用 `Critical:`。

**扫描surface 各区不同**（第三轮实测，别一刀切）：
- `src/styles/color-guard.test.ts` 只扫 `.vue` 的 `<style>` 块与 `.css`，**只匹配 hex/rgb/hsl**
- 具名色词扫描只在 `knowledgeStyles` / `parserStyles` / `kvmStyles` 里，作用于各自的 `.scss`
- **知识库区额外扫 `.vue` 的 `<template>` 块** —— settings 区安全的写法进 `src/ai` 就翻车

## 🔴 已翻成英文、但保留了中文全角引号的残留

第三轮清理时发现 97 行属于此类（96 行已无中文）。不影响语法，但违反"自己写的英文用
ASCII 标点"。清理脚本必须**跳过仍含中文的行**——那些行上的全角标点可能是断言值里
有意义的字符。注意 `<!-- -->` 块注释的续行不以 `*` 开头，简单的注释状态机会漏掉
（`SkillDetail.vue` 文件头 28 处就是这么漏的）。

## 🔴 头等大事之二：语法坏了的测试文件伪装成"通过"

**`Tests: no tests` 不是绿灯，是文件根本没加载。** 失败数为 0，`pnpm test` 的汇总里
看起来一片绿。

本轮修好语法后，立刻暴露出 master 上早已存在、但一直隐形的缺陷：

- `SettingsView.test.ts` —— **44 例**断言值被翻成英文（`"⏸ Paused"` / `"Resume"` /
  `"Auto (currently CPU)"`），实际渲染仍是中文
- `ParserTest.test.ts` —— **8 例**同类
- `NoteEditPane.test.ts` —— `'保存中…'` 被翻成 `'Saving…'`（本轮已改回）

⇒ 第一轮交接里写的"定向测试 435 例全过"**结论不可靠**：那些文件压根没跑。

## 🔴 头等大事之三：翻 `.scss` 注释会撞配色守卫

本仓的配色守卫（`parserStyles.test.ts` / `kvmStyles.test.ts` / `knowledgeStyles.test.ts`）
**明确连注释一起扫** CSS 具名颜色。中文注释"三级灰"翻成 `tertiary gray` 之后，
`gray` 命中守卫 —— `parser-styles.scss` 一个文件就触发 12 处，现在 master 上是红的。

翻 `.scss` / `<style>` 注释时，避开 `gray/grey/white/black/red/green/blue/orange` 这些词，
改用 `muted` / `tertiary text` / `neutral` 之类不撞名的说法。

## 验证现状（`778b7ad6`）

- `vue-tsc --noEmit` —— **exit 0**
- **但 vue-tsc 不足以把关**：`ParserTest.test.ts` 那处 `*/` 嵌套，vue-tsc 报 0 错误，
  是 esbuild（跑 vitest 时）才抓到的。**每批收尾必须真的跑一次 vitest**，
  哪怕只跑改动文件自己的测试。
- 定向测试：改动区 379 文件 / 7,138 例，**11 文件 / 85 例失败**。经逐个核对，
  **全部是 master 上的既有缺陷**（上面三条的产物），本轮改动未新增失败。
  未修，因为修 44 例断言值 + 12 处配色词是独立的一票活。
- **全量 `pnpm test` 未跑**（295 秒，机主定的规矩：只跑局部）

## 派活方法（复用这套，别重新发明）

- 指令模板见 `/tmp/.../scratchpad/BRIEF.md`（内容已并入本文档"范围"节 + 下面的硬规则）
- **单批 ≤10 文件 / ≤260 中文行**。第一轮试过 800 行/18 文件，haiku 跑到一半就没劲；
  第二轮用 sonnet + 10 文件上限，完成率好很多
- 超过 ~350 中文行的单文件需要单跑并明确要求"分块推进、不许中途停"
- 指令里必须写死这几条，否则会踩：
  1. **不许跑全量测试**（有 agent 自作主张跑 `pnpm test`，白等 295 秒）
  2. **不许翻 fixture 数据和 `expect(...)` 里的值**（本轮两个被中断的 agent 就是栽在这，
     `ParserTest.test.ts` 一个文件翻崩 8 例）
  3. **保持原有折行**
  4. **禁止任何改动工作树的 git 命令**（`stash`/`checkout`/`reset`/`restore`/`clean`）
     —— 20 个 agent 共写一棵树，一次 `git stash` 会把**别人**的在途改动一并回滚。
     本轮真实发生过，至少 6 个 agent 报告"文件被静默回滚"，各自重写才救回来。
- agent 会**高估自己的完成度**。唯一可信的是中心化扫描：

```bash
grep -rIl -P '[\x{4e00}-\x{9fff}]' src packages oss scripts \
  --exclude-dir=node_modules --exclude-dir=.superpowers --exclude-dir=i18n
```

- 并发上限 20（`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` 可调高）
- **额度是真实约束**：本轮 20 个并发 agent 在约 25 分钟内耗尽个人额度，
  一次性全部 `Connection lost` 中断。Edit 是原子写不会写坏文件，但**会留下半成品**
  （翻了一半的测试文件 = 断言值中英混杂 = 一堆假失败）。
  中断后必须逐个核对被中断文件，宁可 `git checkout HEAD --` 回退重来。

## 🔴 OSS 导出锚点打漂（未动，收尾必做）

`oss/manifest.mjs` 的 279 条 `PATCH`，132 条 `find:` 锚点是中文源码文本，覆盖 45 个文件。
`oss/apply.mjs:87-95` 逐字匹配，失配即 `throw Anticipated no match` —— **硬失败不静默**。

当前打漂 **36 条**（第一轮结束时 54 条，第二轮起始复测为 36，全翻完会更多）。

```bash
node oss/check-anchors.mjs   # 列出所有失配锚点 + find 前 100 字符
```

收尾必须：按清单把锚点重新对到英文文本上，然后
`node oss/export.mjs`（**不带 `--publish`**，只写 `/tmp/nimoos-web-preview`，碰不到公开仓）
跑通作为硬验证。

顺带：源码英文化之后 `oss/forbidden.mjs` 那道"中文软禁词"闸的误报面变小，
清单里若干纯为洗白中文措辞而存在的 PATCH 可能变成冗余 —— 优化项，非必须。

## 未合并冲突预警

台账记过：`files-bugfix-batch-merged` 那批与本翻译分支有 **14 个文件重叠**，合 master 前
要处理冲突。
