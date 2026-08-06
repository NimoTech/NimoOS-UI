# SP8-P4 Task 1 评审 —— 样式底座 `mcp-styles.scss`

评审者:独立评审(sonnet),未采信实现者报告,逐项自查。

## 输入核对

- 任务书 `p4-task-1-brief.md`、公共约束 `p4-common-constraints.md`、设计文档
  `NimoOS-UI/docs/superpowers/specs/2026-07-31-vue3-migration-sp8-p4-mcp-design.md`
  (`:22,109,120,128,230`)三者关于 T1 的内容(18 类清单、D10 六条对照表、`.mcp-test-detail`
  代码块)完全一致,无冲突需裁决。

## Vue2 蓝本逐行对照

自己打开 `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/MCP/mcp-styles.scss`(91 行)与
`src/ai/styles/mcp-styles.scss`(139 行,含新增注释与 `.mcp-test-detail`)逐条比对:

- 非颜色声明(尺寸/间距/圆角/字号/`font-family`/`flex`/`grid`/伪类/伪元素)**逐字一致**,
  包括 `.mcp-config-row`/`.lbl`/`.lbl .sub`/`.val`、`.mcp-code`、`.mcp-kv*` 五条、`.mcp-args`
  (+`:focus`)、`.mcp-test-*` 五条、`.mcp-tool-chip`、`.mcp-quickadd-*` 两条 —— 未发现任何
  数值、选择器、声明顺序偏差。
- 唯一结构性调整:Vue2 把 `.mcp-transport[data-t="stdio"]`(`:43`)单独写在文件后段,
  New-UI 合并进 `.mcp-transport` 的嵌套 `&[data-t="..."]` 里。渲染出的选择器/优先级/声明
  与分开写完全等价(嵌套 `&[data-t=...]` 编译后就是同一个复合选择器,顺序未变、无其它
  规则夹在中间会被交叉覆盖),判定为组织调整非行为偏离,报告已如实申报。
- 6 处 D10 rgba→token 替换与任务书对照表逐条核对无误(见下)。
- Step 4 的 `.mcp-test-detail` 与任务书给的代码块字符级比对(含缩进、`▸`/`▾`、注释)完全
  相同,未做任何"改进"。

## Token 独立核实(自己 grep,不采信报告行号)

```
$ grep -n "success-soft\|danger-soft\|purple-soft\|teal-soft" src/ai/styles/tokens.scss
```
浅色块(默认 `.agent-app`/`.ai-toast-scope`,`:129-149`)与暗色块(`[data-theme="dark"]`,
`:306-316`)各给出 `--success-soft`/`--success-soft-border`/`--danger-soft`/
`--danger-soft-border`/`--purple-soft`/`--teal-soft` 六个 token 的值,**两档均有定义,与
D10 对照表六条一一对应,新增 token 数 = 0**。`--teal`/`--purple` 文字色两档共用同值,
`tokens.scss:148` 注释确认是有意的"主题无关色"惯例,非缺失。

## 接线顺序

`src/ai/views/SettingsPage.vue:66-70`:`tokens.scss` → `sk-shared.scss` →
`settings-styles.scss` → `skills-styles.scss` → `mcp-styles.scss`(新增,最后一行)——
层叠顺序正确,`.mcp-*` 能覆盖 `skills-styles.scss` 的外壳类。

## 颜色扫描(自己跑,不止信报告)

```
$ grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|(^|[^-a-z])(white|black|red|green|blue|gray|grey|teal|purple)([^-a-z]|$)' src/ai/styles/mcp-styles.scss
exit=1（无输出,零命中，含 var(--teal)/var(--purple) 均未被误判)
```
文件头注释(D10 六条对照、组织调整说明)逐条改写为「引 Vue2 `file:line` + 中文描述颜色」,
未出现任何 Vue2 原始 rgba/hex 字面量。

## 提交范围

```
$ git show --stat HEAD
 src/ai/styles/mcp-styles.scss | 139 ++
 src/ai/views/SettingsPage.vue |   1 +
 2 files changed, 140 insertions(+)
$ git status --short
（空，无漂移）
```
只含本任务两个文件,无夹带。

## RED 探针(独立设计,验证「color-guard 不扫 .scss」这条硬约束是否属实)

破坏:把 `.mcp-args:focus` 的 `border-color: var(--accent);` 改成
`border-color: #ff0000;`(纯色字面量,人肉一眼可见的违规)。

```
$ pnpm test > /tmp/red-probe-test.log 2>&1; echo exit=$?
exit=0
 Test Files  296 passed (296)
      Tests  2574 passed (2574)
```
**全绿,零红。** 证实 `color-guard.test.ts` 确实不扫 `.scss`,本文件的配色纪律没有任何
自动回归网,人工评审是唯一防线——与公共约束 §6 的警告一致。

还原:
```
$ git checkout -- src/ai/styles/mcp-styles.scss
$ diff src/ai/styles/mcp-styles.scss <备份> → IDENTICAL
$ git status --short → 空
```
精确还原确认,仓库无残留改动。

## 独立三门复测(自己跑,不采信报告数字)

```
pnpm test                  → exit=0, Test Files 296 passed (296), Tests 2574 passed (2574)
pnpm exec vue-tsc --noEmit → exit=0, 输出 0 行
pnpm build                 → exit=0, ✓ built in 21.08s,仅既有 >500KB chunk 警告
git status --short         → 空
```
与基线 296/2574 完全一致,与报告数字吻合。

## §3.5「照抄不改」检查

N1-N5 均为组件逻辑层偏离判据,本任务只产出 CSS,不涉及,报告如实注明未命中。核实无误
(纯 scss 文件不含任何表单校验/解析/清空/搜索逻辑)。

## YAGNI / 多余改动检查

未发现无关重构、改名、换库。唯一"多余"的是 stdio 变体的组织合并,已判定为非行为偏离且
已如实申报,不计违规。

## 发现

无。逐行比对、token 复核、颜色扫描、提交范围、RED 探针、三门复测均未发现任何偏差。

## 判定

1. **规范符合(Spec)**:✅ —— 任务书 8 个 Step 全部做到,无 YAGNI 违规,唯一结构调整
   (stdio 合并)已判定为等价组织调整并如实申报。
2. **任务质量(Quality)**:**通过**
