# SP8-P3a Task 5 报告 —— `SkillDetail.vue`(只读半)

状态:DONE
提交:`e5cf0ca6eb017c506e2f794f089c09b824b16b4e`(`sp8-ai` 分支)

## 产出文件

- `src/ai/components/settings/skills/SkillDetail.vue`(新建,200 行)
- `src/ai/components/settings/skills/SkillDetail.test.ts`(新建,212 行,19 例)

## 逐文件改了什么 / Vue2 file:line → New-UI 对照

蓝本:`/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/SkillDetail.vue`(271 行)。

| Vue2 坐标 | New-UI 对应 | 说明 |
|---|---|---|
| `:1-13` 空态 | 模板 `.sk-detail-empty` 块 | `.orb`/`empty-title`(`aiSkPickLeft`)/`empty-sub`(`aiSkPickLeftSub`) 1:1 |
| `:15-32` 顶部条(SkillTile/name/试用按钮) | `.sk-detail-bar` 块 | 只取到 `.sk-pill-try` 为止;`:21-56` 的 `.sw` 开关与 `.sk-pill-more`+`.sk-menu` 整段不取(§5.2) |
| `:61-94` 四格元信息 | `.sk-meta-grid` 块 | 状态/触发方式/来源/上次运行,逐格对照见下 |
| `:64-73` 状态圆点内联 rgba | `.val[data-disabled]` + `.dot`(纯 class,零内联样式) | 偏离,见下方偏离清单 |
| `:78-80` 触发方式 `trigger_human \|\| trigger` | `triggerText` computed 走 `triggerLabel()` | 偏离 4,见下 |
| `:81-84` 来源 `skill.author` | `authorText` computed 走 `authorLabel()` | `authorLabel('You')→'你'`,其余原样 |
| `:85-93` 上次运行 + 累计次数 | `.sk-meta-cell` 第四格 | `skill.last_used \|\| '—'` 原样;`aiSkNTotal` 参数化 |
| `:96-106` 描述段 | `.sk-section`(Description) | 1:1 |
| `:108-112` `TestPanel` | 模板注释占位(未渲染任何 DOM) | §5.2 明确不取,注释登记回插点 |
| `:114-124` SKILL.md 段 | `.sk-section`(SKILL.md) | `renderMarkdown(skill.md \|\| '')` → `v-html` |
| `:126-151` 附带文件段 | `.sk-section`(Bundled files) | 逐行 `.sk-file-row`;size 走 `fileSizeLabel()`;空态 `aiSkNoBundledFiles` |
| `:155-184` 删除确认弹窗 | 不移植 | §5.2 |
| `:189-271` `<script>`(menuOpen/confirm/docListener/copyMarkdown/exportSkill/runTest/doDelete) | 不移植 | §5.2,一个方法都没写 |
| `:240-242` `tryInChat` | `tryInChat()` | `router.push({ path: '/ai/agent', query: { skill: skill.id } })` 逐字对齐 |

## 承接了 Vue2 哪些行为

- 空态两行文案、顶部条三元素(tile/name+code/试用按钮)、四格元信息的展示逻辑与顺序、
  描述/SKILL.md/附带文件三段的结构与顺序、`(skill.files || [])` 与
  `!skill.files || skill.files.length === 0` 两处 nil-slice 防御(公共约束 §4,一字不改保留)、
  `tryInChat` 的路由跳转参数。

## 偏离清单(每条都已在代码注释里登记)

1. **偏离 2(公共约束 §3 预授权)**:`SkillIcon.vue` 不移植,顶部条「在对话中试用」按钮的
   sparkle 图标改用 `../../icons/AgentIcon.vue`。
2. **偏离 4(公共约束 §3 预授权)**:弃用 `skill.trigger_human`,`triggerText` 改由
   `triggerLabel(skill.trigger, skill.name)` 映射;命中返回 `t(key, params)`
   (slash 分支渲染出 `/{name}`),未命中原样显示 `skill.trigger`。**本文件全程未读
   `skill.trigger_human` 字段**——测试用例 `trigger_human 陷阱` 专门构造
   `trigger:'auto'` + `trigger_human:'WRONG'` 钉住这一点。
3. **颜色改动(公共约束 §6 第 5 条点名本文件)**:Vue2 `:64-73` 状态圆点的内联
   `:style` `rgba(...)` 改成 `.val` 上的 `data-disabled="true"/"false"` 属性 +
   Task 1 已在 `skills-styles.scss:280-316` 写好的静态 CSS(`.dot` 本身不再携带
   任何内联样式或颜色相关 data 属性)。这条本质上是 §6 强制项而非自选偏离,但因
   brief §5.1 与约束 §6 都点名了本文件,单独列出存证。
4. **last_used 不做映射**:照 Vue2 `:88` 原样 `skill.last_used || '—'`。已在组件头部
   注释登记「若后端将来写入英文相对时间串,此处需要补一层本地化映射」,当前不做是
   因为该字段目前后端契约就是任意字符串或空串。

**没有命中**§3 里的偏离 1/3/5/6(分别属于 reload()/toast/`.sk-col-actions`/`.sk-col-title`,
均与本组件无关)。

**没有超出 brief 范围的额外偏离** —— `busy` prop、`.sw`、`.sk-pill-more`/`.sk-menu`、
删除确认弹窗、`TestPanel`、`copyMarkdown`/`exportSkill`/`runTest`/`doDelete`/`closeAnd`、
`menuOpen`+document mousedown 监听、`watch('skill.id')` 复位逻辑——一个都没写。

## RED→GREEN 证据

三处专门做了破坏性验证(备份 `/tmp/SkillDetail.vue.bak`,验证后逐一还原,`git status` 干净):

**1. 偏离 4 的钉子(trigger_human 陷阱)**——把 `triggerText` 改成
`s.trigger_human || (ref ? t(...) : s.trigger)`:
```
✕ 三种 trigger 在详情格的显示… — expected 'WRONG' to be '自动触发'
✕ 未知 trigger 原样显示… — expected 'WRONG' to be 'some-future-trigger'
✕ trigger_human 陷阱… — expected 'WRONG' to be '自动触发'
Tests  3 failed | 16 passed (19)
```
还原后:`Tests  19 passed (19)`。

**2. 目录尺寸本地化**——把 `fileSize()` 改成直接 `return size`(不再调用
`fileSizeLabel()`):
```
✕ 目录尺寸 "(3 files)" 被本地化… — expected '(3 files)' to be '3 个文件'
Tests  1 failed | 18 passed (19)
```
还原后:`Tests  19 passed (19)`。

两次还原后都用 `pnpm exec vitest run .../SkillDetail.test.ts` 复跑确认全绿,
且最终 `git status` 显示 working tree clean(改动只在提交前的临时验证阶段发生,
提交内容是还原后的原始版本)。

## 三门完整终值

```
pnpm test:       Test Files  290 passed (290)  /  Tests  2395 passed (2395)  exit=0
pnpm exec vue-tsc --noEmit:                                                  exit=0
pnpm build:      ✓ built in 12.07s                                          exit=0
```
- 基线 289 文件/2375 例 → 本任务 +1 文件(SkillDetail.test.ts)/+20 例
  (19 条本组件用例 + color-guard 自动 +1 例)。
- build 唯一警告是既有的 `chunk 大小超 500KB` 提示(ExcelViewer/index-Caue1y3_ 等),
  与本任务无关,约束 §8 允许。
- 完整日志落盘:`/tmp/p3a-t5-test.log`、`/tmp/p3a-t5-tsc.log`、`/tmp/p3a-t5-build.log`。

## i18n

**全部复用,零新增。** 所需的键(`aiSkPickLeft`/`aiSkPickLeftSub`/`aiSkTryInChat`/
`aiSkStatus`/`aiSkActive`/`aiSkPaused`/`aiSkTrigger`/`aiSkAddedBy`/`aiSkLastRun`/
`aiSkNTotal`/`aiSkDescription`/`aiSkDescHint`/`aiSkMdHint`/`aiSkBundledFiles`/
`aiSkNFiles`/`aiSkNoBundledFiles`/`aiSkTriggerAutomatic`/`aiSkTriggerSlash`/
`aiSkAuthorYou`/`aiSkTagManual`)在 `zh_cn.ts`/`en_us.ts` 里已全部存在(推测由更早的
Task 2/brief 计划一次性预埋),`grep` 确认后未做任何改动。

## 测试清单(19 例,SkillDetail.test.ts)

空态两行文案;顶部条内容+不渲染写操作控件;四格内容(启用态);状态格停用态;
状态圆点零内联样式;三种 trigger(auto/manual/slash,slash 断言出
`/weekly-report`);未知 trigger 原样兜底;trigger_human 陷阱(钉偏离 4);
author='You'本地化 vs 真实人名;last_used 空串显示 `—`;描述原样显示;
TestPanel 占位不渲染;SKILL.md 渲染出真实 HTML(`<strong>`);SKILL.md 空串不抛错;
附带文件列表(name/size);目录尺寸`"(3 files)"`本地化;附带文件空数组空态;
`files: null`(nil slice)防御;「在对话中试用」push 路由对象校验。

## 顾虑

无阻塞项。TestPanel 回插点仅有模板注释标记,P3b 实现者需要确认注释位置与
brief `:108-112` 是否仍然吻合(本任务未改动周边结构,应该一致)。
