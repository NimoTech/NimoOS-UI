# SP8-P4 Task 5 评审 —— `McpServerGroup.vue`

独立评审者,未采信实现者报告,逐项自行核实。

## 判定

1. **规范符合(Spec)**:✅
2. **任务质量(Quality)**:通过

## 对标方法与证据

### ① Vue2 逐行对标
读 `/home/nimo/NimoTech/NimoOS-UI/src/views/AI/MCP/McpServerGroup.vue`(47 行)与新组件逐行比对:
- 根 `div` → `.sk-group-label[:data-collapsed]`(chev span + label span + count span)→ `template v-if="!collapsed"` 包裹的 `.sk-item` v-for(SkillTile + `.sk-item-body`{`.sk-item-head`{name, `.mcp-transport[data-t]`}, `.sk-item-desc`, `.sk-item-meta`{条件 `.sk-item-off`}})—— **DOM 层级、class、属性顺序、v-if/v-for 位置逐字一致**。
- `data-active`/`data-disabled` 照 Vue2 :10-11 写成三元字符串 `'true'/'false'`(非布尔),`data-collapsed` 照 Vue2 用裸布尔绑定(DOM 层一样被字符串化)——两处**不同写法都各自照抄**,不是不一致缺陷。
- `SkillTile` 收到 `:color="serverColor(s.name)"` `:icon="glyph"`(glyph=`SERVER_GLYPH`),`AgentIcon` 用 `name="chevDown" :size="11"` —— 与 Vue2 `:12`/`:4` 等价(方法体转发到 T2 util,行为一致)。

### ② CSS 类真实存在(自行 grep,非采信报告)
`skills-styles.scss`:`.sk-group-label:61` `.sk-group-chev:70` `.sk-group-count:77` `.sk-item:95` `.sk-tile:112` `.sk-item-body/-head/-name/-desc/-meta/-off:127-170` —— 全部存在。
`mcp-styles.scss`:`.mcp-transport`(含 `data-t="http"/"sse"/"stdio"` 三态)存在。组件文件内零 `<style>` 块,确认无误。

### ③ i18n `aiSkOff`
`src/i18n/zh_cn.ts:1210` = `'已关闭'`,`en_us.ts:1207` = `'Off'`;权威源 `NimoOS-UI/src/assets/lang/zh_CN.json:817` = `"已关闭"`,`en_US.json:824` = `"Off"` —— **逐字相同**。组件头注释已申报「跨域复用,非新增」。模板内无任何硬编码中/英文文案。

### ④ 测试判别力
- `data-active`/`data-disabled` 两项对照用例齐全(brief 已内置,非实现者临时补)。
- 无单元素数组上的弱判别断言;无 `not.toBeNull()`/纯存在性弱断言。
- `aiSkOff` 断言用 `zh.aiSkOff`(动态取实际词典值)而非硬编码字面量,避免假通过。
- 未发现空转用例。

### ⑤ 接口契约
`props: { label: string; items: McpServer[]; activeId: number | null }`,`emit: pick(id: number)` —— 与 brief/T9 消费签名完全一致。

### ⑥ 与既有先例(`skills/SkillGroup.vue`)一致性
`<script setup>` 写法、ref 折叠状态、defineProps/defineEmits 风格、`.sk-group-*`/`.sk-item*` 用法逐一比对,未引入第三种模式。

## 三门(自己实测,非报告数字)

```
pnpm test                  → Test Files  299 passed (299)  Tests  2627 passed (2627)  exit=0
pnpm exec vue-tsc --noEmit → exit=0(空输出)
pnpm build                 → exit=0(仅既有 >500KB chunk 警告)
```
算术核对:T4 收尾基线 298 文件/2619 例(已核对 `.superpowers/sdd/p4-task-4-report.md` 落盘数字)。`color-guard.test.ts` 用 `import.meta.glob('../**/*.vue', {eager:true})` 动态枚举,本任务新增 1 个 `.vue` → +1 文件/+1 用例(自行读 `src/styles/color-guard.test.ts:15` 确认为 glob 机制,非手写清单)。组件自带 7 条测试。298+1=299 文件,2619+1(color-guard)+7(组件)=2627 —— 吻合。

## 提交范围

`git show --stat HEAD` 只含 `McpServerGroup.vue` + `McpServerGroup.test.ts` 两个新文件,165 行新增,无越界改动。

## 独立 RED 探针(非复述实现者的 data-active 探针)

**破坏**:把 `<template v-if="!collapsed">` 临时改成 `<template v-if="true">`(去掉折叠对渲染的实际控制)。
**结果**:
```
FAIL  ...McpServerGroup.test.ts > 点标题折叠/展开(Vue2 :3 的 collapsed 开关)
AssertionError: expected [...] to have a length of +0 but got 2
Test Files  1 failed (1)  Tests  1 failed | 6 passed (7)
```
精确命中折叠测试,其余 6 例不受影响 —— 判别力确认。
**还原**:改回 `v-if="!collapsed"`,复跑 `Test Files 1 passed / Tests 7 passed`;`git status`/`git diff --stat` 均干净。

## 发现

无(Critical/Important/Minor 均无)。DOM/class/props/emit/i18n/CSS 全部对标通过,三门与算术吻合,提交范围干净,RED 探针判别力确认。
