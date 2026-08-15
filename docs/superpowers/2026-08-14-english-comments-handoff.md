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
| 现在 | — | **10,741** |

第二轮清掉约 4,359 行 / 51 文件。剩余 10,741 行**不全是待翻的活**——相当一部分是
"有意保留"（界面文案断言、CJK 被测对象、i18n 词条），永远不会归零。

未开工的按区（第二轮 96 批里已派 30 批，**剩 66 批**）：

```
src/ai        ← knowledge 区若干中型文件 + knowledgeStyles.test.ts(872) / knowledge.scss(547) 两个巨型
src/views     ← Photos 各页
src/settings  ← 104 文件，最碎
src/storage
src/styles
packages/service
oss           ← manifest.mjs 的 find/replace 载荷，见下
```

## 🔴 头等大事：翻译会引入三类语法级破坏（本轮实测，master 上已有 13 处）

**中文原文里这些都不存在，是英文化本身的副产品。** 已在 `778b7ad6` 全部修掉，
但**后续每一批都会继续制造，必须每批都查**。

| 类型 | 表现 | 本轮处数 |
|---|---|---|
| 英文所有格撇号 | `it('...blueprint's...')` 撇号截断单引号字符串 | 11 |
| `*/` 嵌进 JSDoc | `` `/* */` `` 提前关闭外层块，后续 prose 变活代码 | 4 |
| 全角引号 | `<script setup lang=”ts”>` 整个 SFC 解析失败 | 1 |

`*/` 那几处，中文原作者**特意写成 `` `/* *\/` `` 转义过**，翻译时把反斜杠弄丢了。
修法就是把反斜杠加回去。撇号那类用 `\'` 转义，或改写掉所有格。

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
