# SP8-P4 Task 1 报告 —— 样式底座 `mcp-styles.scss`

## 读取顺序

按公共约束要求的顺序读完:
1. `.sp8/NimoOS-New-UI/.superpowers/sdd/p4-common-constraints.md`
2. `NimoOS-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p4-mcp-design.md`
3. 任务书 `p4-task-1-brief.md`

三者关于 Task 1 的内容(D10 对照表、18 个类清单、`.mcp-test-detail` 完整代码)完全一致,**无冲突可申报**。

## 文件改动

### 新增:`src/ai/styles/mcp-styles.scss`

逐行移植自 `NimoOS-UI/src/views/AI/MCP/mcp-styles.scss`(91 行,只读蓝本,未改动)。

### 修改:`src/ai/views/SettingsPage.vue`

在 `import '../styles/skills-styles.scss'` 之后追加一行:
```ts
import '../styles/mcp-styles.scss'
```
`git diff --stat`:1 file changed, 1 insertion(+)。

## Vue2 → New-UI 逐类对照

| # | 类名 | Vue2 行号 | 处理 |
|---|---|---|---|
| 1 | `.mcp-transport`(基础) | `:3-6` | 逐字照抄 |
| 2 | `.mcp-transport[data-t="http"]` | `:7` | 背景改 token(D10),文字色 `var(--teal)` 不变 |
| 3 | `.mcp-transport[data-t="sse"]` | `:8` | 背景改 token(D10),文字色 `var(--purple)` 不变 |
| 4 | `.mcp-transport[data-t="stdio"]` | `:43`(原分开写) | 背景改 token(D10),文字色 `var(--success)` 不变;**组织上合并进 `.mcp-transport` 嵌套**(见下方「组织调整」) |
| 5 | `.mcp-config` | `:11` | 逐字照抄 |
| 6 | `.mcp-config-row`(+ `.lbl` / `.lbl .sub` / `.val`) | `:12-19` | 逐字照抄 |
| 7 | `.mcp-code` | `:20-24` | 逐字照抄 |
| 8 | `.mcp-kv` | `:27` | 逐字照抄 |
| 9 | `.mcp-kv-row`(+ `input`) | `:28-29` | 逐字照抄 |
| 10 | `.mcp-kv-del`(+ `:hover`) | `:30-35` | 逐字照抄 |
| 11 | `.mcp-kv-add` | `:36-39` | 逐字照抄 |
| 12 | `.mcp-kv-hint` | `:40` | 逐字照抄 |
| 13 | `.mcp-args`(+ `:focus`) | `:46-60` | 逐字照抄 |
| 14 | `.sk-section-head .mcp-test-btn` | `:63` | 逐字照抄 |
| 15 | `.mcp-test-hint` | `:66` | 逐字照抄 |
| 16 | `.mcp-test-result`(基础) | `:67-73` | 逐字照抄 |
| 17 | `.mcp-test-result[data-ok="true"]` | `:74` | 背景/边框改 token(D10),文字色 `var(--success)` 不变 |
| 18 | `.mcp-test-result[data-ok="false"]` | `:75` | 背景/边框改 token(D10),文字色 `var(--danger)` 不变 |
| 19 | `.mcp-test-line` | `:76` | 逐字照抄 |
| 20 | `.mcp-test-tools` | `:77` | 逐字照抄 |
| 21 | `.mcp-tool-chip` | `:78-85` | 逐字照抄 |
| 22 | `.mcp-quickadd-row`(+ `input` / `.sk-btn`) | `:88-90` | 逐字照抄 |
| 23 | `.mcp-quickadd-err` | `:91` | 逐字照抄 |
| — | `.mcp-test-detail` | 无(Vue2 没有) | **本期新增,偏离 D8**,任务书 Step 4 给的代码逐字抄入,未改动一个字符 |

计数:18 个 Vue2 既有类(`.mcp-transport` 含 3 变体记 1 类,`.mcp-test-result` 含 2 变体记 1 类)+ 1 个本期新增 `.mcp-test-detail` = 19 个规则块,与任务书「18 个类 + 本期新增 1 个」的口径一致。

## 组织调整(非行为改变,协调者裁定 #1)

Vue2 `.mcp-transport[data-t="stdio"]` 单独写在文件 `:43`(原作者后补的),与 `:7`(http)`:8`(sse)两个变体分开。本档把三个变体合并写进 `.mcp-transport` 的嵌套选择器 `&[data-t="..."]` 里 —— **渲染出的 CSS 规则与 Vue2 分开写完全等价**,只是组织方式不同(已在文件头注释里写明)。不属于行为偏离。

## 偏离 D10(6 处 rgba → token)逐条确认

任务书给的对照表全部逐条核实,**未凭空信任务书,自己 grep 了 `tokens.scss`**:

| Vue2 位置 | 改前语义 | 改成的 token | 浅色档取值(`tokens.scss` 行号) | 暗色档取值(`tokens.scss` 行号) |
|---|---|---|---|---|
| `:7` `.mcp-transport[data-t="http"]` 背景 | 青色约 14% 透明度 | `--teal-soft` | `:149` `rgba(48, 176, 199, 0.12)` | `:316` `rgba(48, 176, 199, 0.2)` |
| `:8` `.mcp-transport[data-t="sse"]` 背景 | 紫色约 12% 透明度 | `--purple-soft` | `:133` `rgba(175, 82, 222, 0.1)` | `:310` `rgba(175, 82, 222, 0.18)` |
| `:43` `.mcp-transport[data-t="stdio"]` 背景 | 绿色约 14% 透明度 | `--success-soft` | `:129` `rgba(46, 158, 84, 0.12)` | `:306` `rgba(79, 184, 112, 0.18)` |
| `:74` `.mcp-test-result[data-ok="true"]` 背景 | 绿色约 10% 透明度 | `--success-soft`(同上复用) | 同上 | 同上 |
| `:74` `.mcp-test-result[data-ok="true"]` 边框 | 绿色约 30% 透明度 | `--success-soft-border` | `:130` `rgba(46, 158, 84, 0.2)` | `:307` `rgba(79, 184, 112, 0.28)` |
| `:75` `.mcp-test-result[data-ok="false"]` 背景 | 红色约 10% 透明度 | `--danger-soft` | `:131` `rgba(215, 73, 59, 0.1)` | `:308` `rgba(240, 119, 107, 0.16)` |
| `:75` `.mcp-test-result[data-ok="false"]` 边框 | 红色约 30% 透明度 | `--danger-soft-border` | `:132` `rgba(215, 73, 59, 0.16)` | `:309` `rgba(240, 119, 107, 0.24)` |

**6/6 token 在浅色与暗色两档都有明确取值,新增 token 数 = 0**(与任务书「预期新增 token 数 = 0」一致,未触发 `NEEDS_CONTEXT`)。

未改动的现存颜色 token(逐字保留,未纳入 D10):`var(--bg-chip)` / `var(--text-tertiary)` / `var(--line-faint)` / `var(--bg-sunken)` / `var(--text-primary)` / `var(--text-secondary)` / `var(--danger)` / `var(--accent)` / `var(--accent-softer)` / `var(--r-sm)` / `var(--line)` / `var(--bg-elevated)` / `var(--success)` / `var(--teal)` / `var(--purple)`。其中 `--teal`/`--purple` 经核实是刻意「主题无关色」(`tokens.scss:148` 注释:「same convention as --purple itself not being redefined in dark」),两档均取相同值,非缺失。

## 偏离 D8(`.mcp-test-detail` 新增)

Vue2 无对应物,是 T7(测试连接错误呈现)预留的新控件,用户 2026-07-31 拍板授权。已在文件里用注释标注「本期新增,Vue2 无对应物 —— 偏离 D8」。任务书 Step 4 给的 SCSS 逐字抄入,未做任何"改进"。

## Step 2 潜在歧义裁定确认

- **裁定 #1**(stdio 合并写法):已按裁定执行,见上「组织调整」节。
- **裁定 #2**(`.mcp-quickadd` 无规则):已核实 Vue2 `mcp-styles.scss` 全文(91 行)确无 `.mcp-quickadd` 规则,本档同样不补。只保留 `.mcp-quickadd-row` / `.mcp-quickadd-err` 两条既有规则。
- **裁定 #3**(`.mcp-test-detail` 逐字抄):已逐字抄,与任务书 Step 4 代码块字符级一致(含缩进、注释、`▸`/`▾` 字符)。

## Step 7:颜色自查(命令 + 完整输出)

```bash
$ grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|(^|[^-a-z])(white|black|red|green|blue|gray|grey)([^-a-z]|$)' src/ai/styles/mcp-styles.scss; echo "exit=$?"
exit=1
```

`grep` 无匹配返回 exit=1,即输出为空 —— **零命中**,包括注释行(文件头注释里的颜色描述全部改写成「引 Vue2 `file:line` + 中文描述颜色」的形式,未出现任何 Vue2 原始色字面量)。

## Step 6:三门完整终值

```bash
$ pnpm test > /tmp/p4-t1-test.log 2>&1; echo "exit=$?"
exit=0
$ pnpm exec vue-tsc --noEmit > /tmp/p4-t1-tsc.log 2>&1; echo "exit=$?"
exit=0
$ pnpm build > /tmp/p4-t1-build.log 2>&1; echo "exit=$?"
exit=0
```

汇总:
```
 Test Files  296 passed (296)
      Tests  2574 passed (2574)
```
`vue-tsc --noEmit` 输出为空(0 错误)。`pnpm build` 成功,`✓ built in 23.90s`,仅既有的 `>500KB chunk` 警告(与基线一致,非本任务引入)。

与基线 **296 文件 / 2574 例绿 · tsc 0 · build 0** 完全一致 —— 本任务未新增 `.vue`,`color-guard.test.ts` 用例数不变,符合预期(Task 1 不改变测试数量)。

无红项,无需复跑噪声用例。

## §3 已授权偏离命中情况

本任务命中:
- **D8**(`.mcp-test-detail` 新增)—— 已处理,见上。
- **D10**(6 处 rgba → token)—— 已处理,见上,逐条核实浅/暗两档取值。

其余 D1-D7、D9、D11 不涉及本任务(纯 CSS 文件,无逻辑/取数/弹窗代码)。

## §3.5 「照抄不改」5 条命中情况

本任务不涉及 N1-N5(均为组件逻辑层偏离判断,本任务只产出 CSS)。

## 提交

```
git add src/ai/styles/mcp-styles.scss src/ai/views/SettingsPage.vue
git commit -m "feat(ai): SP8-P4 T1 MCP 分区样式底座(18 类,6 处 rgba 换 token)"
```

`git status --short` 提交前确认只有这两个文件改动(1 新增 + 1 修改),无其它漂移。
