# SP8-P4 Task 5 报告 —— `McpServerGroup.vue`

## 产出

- `src/ai/components/settings/mcp/McpServerGroup.vue`(新建)
- `src/ai/components/settings/mcp/McpServerGroup.test.ts`(新建,brief Step 1 逐字照抄)

## 逐行对照表(Vue2 `McpServerGroup.vue`,47 行 → New-UI)

| Vue2 | New-UI | 说明 |
|---|---|---|
| `:1` 根 `<div>` | 模板根 `<div>` | 同构 |
| `:2` `.sk-group-label` `:data-collapsed` `@click` | 同 | class/属性/事件逐字 |
| `:4` `<SkillIcon name="chevDown" :size="11" />` | `<AgentIcon name="chevDown" :size="11" />` | **偏离 D3**,见下 |
| `:3` `.sk-group-chev` 包裹 | 同 | |
| `:5` `<span>{{ label }}</span>` | `<span>{{ props.label }}</span>` | `<script setup>` 惯例显式 `props.` |
| `:6` `.sk-group-count` `{{ items.length }}` | `.sk-group-count` `{{ props.items.length }}` | 同 |
| `:8` `v-if="!collapsed"` | 同 | |
| `:9` `v-for="s in items"` `:key="s.id"` | `v-for="s in props.items"` `:key="s.id"` | 同 |
| `:9-10` `.sk-item` `:data-active` `:data-disabled` | 同(字符串 `'true'`/`'false'`,非布尔) | 对齐 skills-styles.scss 属性选择器写法 |
| `:11` `@click="$emit('pick', s.id)"` | `@click="emit('pick', s.id)"` | Options API `$emit` → `<script setup>` `emit()` |
| `:12` `<SkillTile :color="color(s.name)" :icon="glyph" />` | `<SkillTile :color="serverColor(s.name)" :icon="glyph" />` | `color()`/`glyph` 方法/data 字段 → 直接函数调用/局部常量,行为等价 |
| `:13` `.sk-item-body` | 同 | |
| `:14` `.sk-item-head` | 同 | |
| `:15` `.sk-item-name` `{{ s.name }}` | 同 | |
| `:16` `.mcp-transport` `:data-t="s.transport"` `{{ label2(s.transport) }}` | `.mcp-transport` `:data-t="s.transport"` `{{ transportLabel(s.transport) }}` | `label2()` 方法 → 直接调用 `transportLabel`(T2 util) |
| `:18` `.sk-item-desc` `{{ s.url }}` | 同 | |
| `:19` `.sk-item-meta` | 同 | |
| `:20` `<span v-if="!s.enabled" class="sk-item-off">{{ $t('Off') }}</span>` | `<span v-if="!s.enabled" class="sk-item-off">{{ t('aiSkOff') }}</span>` | i18n 键跨域复用,见下 |
| `:33-45` Options API(`data()`/`methods`/`components`) | `<script setup lang="ts">` + `ref`/`props`/`emit`/直接函数调用 | 框架惯用法迁移,行为不变 |

DOM 层级与 Vue2 完全一致:根 `div` → `.sk-group-label`(chev + label span + count span)+ `template v-if` 包裹的 `.sk-item` 循环(tile + body{head{name, transport}, desc, meta{off}})。

## CSS 类 grep 证据(每个类的定义位置)

```
skills-styles.scss:61   .sk-group-label {
skills-styles.scss:70   .sk-group-chev {
skills-styles.scss:75   .sk-group-label[data-collapsed="true"] .sk-group-chev { ... }
skills-styles.scss:77   .sk-group-count {
skills-styles.scss:95   .sk-item {
skills-styles.scss:112  .sk-tile {          （SkillTile 自身用,非本组件直接引用,间接经由 SkillTile.vue）
skills-styles.scss:127  .sk-item-body { flex: 1; min-width: 0; }
skills-styles.scss:128  .sk-item-head { display: flex; align-items: center; gap: 6px; }
skills-styles.scss:129  .sk-item-name { ... }
skills-styles.scss:153  .sk-item-desc { ... }
skills-styles.scss:163  .sk-item-meta { ... }
skills-styles.scss:170  .sk-item-off { ... }
mcp-styles.scss:23-30   .mcp-transport { ... &[data-t="http"] ... &[data-t="sse"] ... &[data-t="stdio"] ... }
```

零 `<style>` 块:组件文件内无任何 CSS,全部类引用既有 scss。

## 偏离申报

- **D3(公共约束 §3 第 3 条)**:`SkillIcon.vue`(Vue2 `:29` import,`:4` 使用)不移植,统一用 `../../icons/AgentIcon.vue`。已在组件文件头注释里注明,与 T2/T1/`SkillGroup.vue` 同一条既有偏离,非本任务新引入判断,仅是命中既有已授权项。
- **i18n 复用(非偏离,按公共约束要求申报复用/新增清单)**:`aiSkOff`(值「已关闭」)——Vue2 `$t('Off')` 的等价键,属于 skills 域既有键的跨域复用,不是本任务新增键。已在文件头注释与任务书要求处注明。本任务**零新增 i18n 键**。

本任务未命中 §3 其余 D1/D2/D4-D11(那些属于容器/详情/弹窗任务 T6/T7/T9 的范围),也未命中 §3.5 的 N1-N5(同样属于表单/搜索逻辑,不在本组件职责内)。

## RED → GREEN 证据

**Step 2(初始 RED,组件不存在前的预期状态)**:未单独截图存证——组件与测试同批写入;补做的是判别力 RED 验证(公共约束 §9 要求)。

**RED 探针**:临时把 `:data-active="s.id === props.activeId ? 'true' : 'false'"` 改成恒 `'false'`,验证判别力测试确实抓得住:

```
FAIL  src/ai/components/settings/mcp/McpServerGroup.test.ts > McpServerGroup > 只有 id 命中 activeId 的那一项带 data-active=true
AssertionError: expected 'false' to be 'true'
Test Files  1 failed (1)
     Tests  1 failed | 6 passed (7)
```

**还原后 GREEN**:

```
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

`git status` 干净,还原确认无遗留改动。

## 三门完整终值

```
pnpm test                    → Test Files  299 passed (299)  ·  Tests  2627 passed (2627)  · exit=0
pnpm exec vue-tsc --noEmit   → exit=0(空输出)
pnpm build                   → exit=0(仅既有 >500KB chunk 警告,无新增第三方警告)
```

**算术核对**:本任务新增 1 个 `.vue`(`McpServerGroup.vue`,零 `<style>` 块但仍会被 color-guard 动态生成一条用例)。
实测:临时移出本任务两个新文件后跑全量 → `298 files / 2619 tests`(post-T4 基线);恢复后 → `299 files / 2627 tests`。
差值:**文件 +1**(color-guard 新增 1 条用例)、**测试 +8**(组件自身 7 条 + color-guard 动态 +1 条)。与公共约束 §8 的算术规则(每新增一个 `.vue` 全量 +1)吻合。

无红项。

## §3.5「照抄不改」

本任务不涉及 N1-N5(表单校验/粘贴解析/搜索行为,均在其它任务范围),故无对应判断项。

## 日志落盘

`/tmp/p4-t5-test-final.log`、`/tmp/p4-t5-tsc.log`、`/tmp/p4-t5-build.log`(完整,未 `| tail`)。
