# SP8-P3a Task 4 报告 —— `SkillGroup.vue`

## 产出文件

- `src/ai/components/settings/skills/SkillGroup.vue`(新建)
- `src/ai/components/settings/skills/SkillGroup.test.ts`(新建)

## 逐文件改了什么

`SkillGroup.vue`:`<script setup lang="ts">`,props `label: string` / `items: Skill[]` /
`activeId: string | null`,emit `pick(id: string)`。本地 `collapsed = ref(false)`(默认展开)。
模板结构、class、属性顺序与 Vue2 蓝本逐行对应。

## Vue2 `file:line` → New-UI 对照

蓝本:`/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/SkillGroup.vue`(64 行)。

| Vue2 | New-UI | 说明 |
|---|---|---|
| `:4-11` 组标题 `.sk-group-label` + `SkillIcon('chevDown')` + `.sk-group-count` | 模板同结构,`SkillIcon` → `AgentIcon`(偏离 2) | `chevDown` 图标在 `AgentIcon.vue:19` 已有 |
| `:5` `:data-collapsed="collapsed"` | `:data-collapsed="collapsed"`(布尔直传) | Vue3 对非枚举布尔属性同样走 `setAttribute` 隐式转字符串,渲染出的 DOM 属性值与 Vue2 一致(`"true"`/`"false"`),不是功能性偏离 |
| `:12-38` `v-if="!collapsed"` + `v-for` 条目 | 同结构 | — |
| `:16-18` `.sk-item` + `data-active`/`data-disabled` 三元字符串 | 原样保留字符串三元(未改布尔) | brief 明确要求保留 |
| `:21` `SkillTile` | 原样引用同目录 `./SkillTile.vue`(Task 3 产物) | — |
| `:25-27` `.sk-item-tag[data-kind]` + `triggerLabel(s.trigger)` | `data-kind="triggerKind(s.trigger)"` + `t(triggerTagKey(s.trigger))` | 短键映射,见下方偏离说明 |
| `:31` `{{ s.author }}` | `{{ displayAuthor(s.author) }}` | 过 `authorLabel()` |
| `:33` `$t('{count} runs', {count: Number(s.calls||0).toLocaleString()})` | `t('aiSkNRuns', {count: Number(calls||0).toLocaleString()})` | 键名对齐已有 i18n(`aiSkNRuns`) |
| `:34` `v-if="!s.enabled"` + `$t('Off')` | 同结构,键换成 `aiSkOff` | — |
| `:56` `triggerKind(t)` | `triggerKind(trigger)`,同一三元兜底逻辑(非 auto/slash 落 manual) | 逐字对照 |
| `:57-61` `triggerLabel(t)` 用长文案 `$t('Auto')`/`$t('Slash')`/`$t('Manual')` | `triggerTagKey(trigger)` 用短键 `aiSkTagAuto`/`aiSkTagSlash`/`aiSkTagManual` | 见 brief 明确要求;Vue2 生产语言包里这组短文案（左栏 tag）与右栏详情长文案本就是不同键位（`aiSkTagAuto`/`aiSkTagSlash`/`aiSkTagManual` vs `aiSkTriggerAutomatic`/`aiSkTriggerSlash`），不合并 |

## 承接了 Vue2 哪些行为

- 折叠默认展开、点击标题切换、折叠时隐藏全部条目。
- `data-active`/`data-disabled` 均为字符串 `'true'`/`'false'`(不是布尔),供 CSS 属性选择器 `.sk-item[data-active="true"]` 命中(`skills-styles.scss:83-89`)。
- `triggerKind` 非 auto/slash 一律落 `manual`(不会出现第三种以外的 `data-kind`)。
- 作者字段 `'You'` 本地化,其余人名原样透传。
- `{count} 次运行` 用 `toLocaleString()`,`calls` 缺省/假值当 `0`。
- 禁用技能显示「已关闭」徽标,启用的不显示。

## RED → GREEN 证据

破坏点:把 `:data-active="s.id === props.activeId ? 'true' : 'false'"` 改成恒定 `:data-active="'true'"`。

RED(仅跑本文件):
```
 ❯ src/ai/components/settings/skills/SkillGroup.test.ts (9 tests | 1 failed) 89ms
     × data-active 只在匹配 activeId 的那一条为 true,其余为 false 9ms
AssertionError: expected [ 'true', 'true', 'true' ] to deeply equal [ 'false', 'true', 'false' ]
 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)
```

还原(`cp` 回原文件)后:
```
 Test Files  1 passed (1)
      Tests  9 passed (9)
```
还原后 `git diff --stat src/ai/components/settings/skills/SkillGroup.vue` 无输出(干净)。

其余测试(折叠切换隐藏/展示、pick 携带多条目里非首项的 id、三种 trigger 的 data-kind/文案、未知 trigger 兜底、author 本地化 vs 原样、运行次数格式化)全部使用多条目数组构造数据（3 条为主）并逐条断言，避免公共约束 §9 点名的单元素数组 `.some`/`.every` 判别力陷阱；未对这些额外做单独 RED 探针,但断言方式(`.map(...).toEqual([...])` 精确逐位比对)本身就排除了「只判断存在性」的空转风险。

## 三门完整终值

```
pnpm test:        Test Files  289 passed (289) / Tests  2375 passed (2375) — exit=0
pnpm exec vue-tsc --noEmit:  exit=0(无输出)
pnpm build:       exit=0(仅既有 >500KB chunk 警告,无新增错误)
```

基线 288 文件/2365 例 + 本任务新增 1 个测试文件(+1)+ 9 个用例(+9)+ color-guard 自动 +1 = 289 文件 / 2375 例,与预期完全吻合。

## i18n 复用/新增键清单

**零新增键** —— 本任务全部复用 Task 1/既有语言包已有的键:
`aiSkTagAuto` / `aiSkTagSlash` / `aiSkTagManual` / `aiSkNRuns` / `aiSkOff` / `aiSkAuthorYou`。
均已在 `src/i18n/zh_cn.ts`(:1206-1210,1228)与 `src/i18n/en_us.ts`(:1203-1207,1225)对称存在,未做任何改动。

## 偏离清单(逐条申报)

1. **偏离 2(公共约束 §3 已授权)**:`SkillIcon.vue` 不移植,统一用 `AgentIcon`(`../../icons/AgentIcon.vue`)。命中本任务。
2. **触发标签短键 vs 长文案分流**(brief 明确指名,非公共约束 §3 清单内但 brief 本身要求):`SkillGroup.vue` 不复用 `skillsFormat.ts` 的 `triggerLabel()`(那是右栏详情长文案 `aiSkTriggerAutomatic`/`aiSkTriggerSlash`),自己在组件内写 `triggerTagKey()` 映射到短键 `aiSkTagAuto`/`aiSkTagSlash`/`aiSkTagManual`。已在代码注释与本报告双重申报。
3. **`data-collapsed` 保留布尔直传**(未改成显式字符串三元,尽管 `data-active`/`data-disabled` 改成了字符串)—— 这不是行为偏离:Vue3 对未识别为枚举布尔属性的 attr(`data-collapsed` 不在 `isSpecialBooleanAttr` 列表内)走 `el.setAttribute(key, value)`,浏览器对布尔值隐式 `toString()`,渲染出的 DOM 属性值与 Vue2 完全一致(`"true"`/`"false"`),`scss` 选择器 `[data-collapsed="true"]` 照常命中。测试里也是从真实 DOM 读回字符串断言,与显式三元写法结果无区别。此为说明性备注,非需要登记的功能偏离。

除以上外未发现其它偏离;未使用公共约束 §3 清单里的偏离 1/3/4/5/6(与本组件无关)。

## 自查

`git status --short`(提交前):
```
?? src/ai/components/settings/skills/SkillGroup.test.ts
?? src/ai/components/settings/skills/SkillGroup.vue
```
无其它文件被误改。
