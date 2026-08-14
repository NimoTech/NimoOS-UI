# 注释英文化 · 交接（2026-08-14）

分支 `chore/english-comments`，4 个检查点提交，master 未动。

## 范围（机主 08-13 拍板）

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
| 起始 | 1073 | 40,764 |
| 现在已清干净 | 547 | — |
| 剩余 | 526 | 15,292 |

剩余 15,292 行**不全是待翻的活**：其中相当一部分是上面列的"有意保留"（界面文案断言、
CJK 被测对象、i18n 词条），永远不会归零。真正没开工的按区：

```
5087 行  92 文件  src/ai        ← knowledge 区几个巨型文件
3636 行  54 文件  src/views
2058 行 104 文件  src/settings
1285 行   6 文件  oss           ← manifest.mjs 的 find/replace 载荷，见下
 667 行  47 文件  src/storage
 488 行   7 文件  src/styles
 345 行  31 文件  packages/service
```

## 验证现状

- `vue-tsc --noEmit` —— **exit 0**（翻译前后都是 0）
- 定向测试 435 例全过（kvm useSnapshots + photos stores + KIcon）
- **全量 `pnpm test` 未跑**（295 秒，机主定的规矩：只跑局部）
- `KIcon.test.ts.snap` 的孤儿快照已用 `vitest -u` 修剪。全仓仅此一个快照文件；
  以后再翻带快照的测试标题，记得快照 key 会跟着改，要重新生成。

## 🔴 已知副作用：OSS 导出锚点打漂

`oss/manifest.mjs` 的 279 条 `PATCH`，有 132 条 `find:` 锚点是**中文源码文本**，覆盖 45 个
文件。`oss/apply.mjs:87-95` 逐字匹配，失配即 `throw Anticipated no match` —— 会**硬失败，
不会静默**（这点设计得好）。

翻译推进到现在已经打漂 **54 条**（起始 25 条，全翻完会更多）。

新增只读诊断脚本 `oss/check-anchors.mjs`：

```bash
node oss/check-anchors.mjs   # 列出所有失配锚点 + find 前 100 字符
```

收尾必须做：按这份清单把 132 条锚点重新对到英文文本上，然后
`node oss/export.mjs`（**不带 `--publish`**，只写 `/tmp/nimoos-web-preview`，碰不到公开仓）
跑通作为硬验证。

顺带：源码英文化之后，`oss/forbidden.mjs` 那道"中文软禁词"泄漏闸的误报面本来就小了，
清单里若干纯为洗白中文措辞而存在的 PATCH 可能变成冗余 —— 但那是优化，不是必须。

## 派活方法（复用这套，别重新发明）

- 指令模板 + 硬规则在 `BRIEF.md`（本次放在会话 scratchpad，内容已并入本文档"范围"节）
- **单批 ≤5 文件 / ≤260 中文行**。试过 800 行/18 文件，haiku 跑到一半就没劲，
  只完成 1/18；压到 5 文件后完成率明显好转
- 超过 ~350 中文行的单文件（`knowledgeStyles.test.ts` 1213 行、`knowledge.scss` 936 行、
  `KvmPage.test.ts` 511 行等 7 个）haiku 单跑也会中途放弃，需要按行段切开或换更强的模型
- 指令里必须写死三条，否则会踩：
  1. **不许跑全量测试**（有 agent 自作主张跑 `pnpm test`，白等 295 秒）
  2. **不许翻 fixture 数据和 `expect(...)` 里的值**（有 agent 顺手翻了快照描述）
  3. **保持原有折行**（有 agent 把多行注释压成一行超长文本）
- agent 会**高估自己的完成度**（自称"验证通过"同时承认 4 个文件没做）。
  唯一可信的是中心化的中文扫描：

```bash
grep -rIl -P '[\x{4e00}-\x{9fff}]' src packages oss scripts --exclude-dir=node_modules --exclude-dir=.superpowers --exclude-dir=i18n
```

- 并发上限 20（`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` 可调高）
- 跑到一半撞过一波 API `Connection lost mid-response`，8 个 agent 同时断。
  Edit 是原子写，**不会写坏文件**，只是做一半，重派即可。

## 未合并冲突预警

台账记过：`files-bugfix-batch-merged` 那批与本翻译分支有 **14 个文件重叠**，合 master 前
要处理冲突。
