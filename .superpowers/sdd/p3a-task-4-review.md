# SP8-P3a Task 4 评审 —— `SkillGroup.vue`

评审者:独立评审(sonnet),未采信实现者报告结论,逐项自行核对 Vue2 蓝本、grep、跑测试。

## 对标方法

- Vue2 蓝本:`/home/nimo/NimoTech/NimoOS-UI/src/views/AI/Skills/SkillGroup.vue`(64 行,全文读取逐行比对)。
- Vue2 生产语言包:`/home/nimo/NimoTech/NimoOS-UI/src/assets/lang/{zh_CN,en_US}.json`(grep 逐值核对)。
- New-UI 实现:`src/ai/components/settings/skills/SkillGroup.vue`、`SkillGroup.test.ts`(全文读取)。
- 依赖文件独立核实:`src/ai/util/skillsFormat.ts`、`src/ai/types/skill.ts`、
  `src/ai/styles/skills-styles.scss`、`src/ai/components/settings/skills/SkillTile.vue`、
  `src/ai/components/icons/AgentIcon.vue`。

## 逐项核对结果

1. **DOM 结构 / class / 顺序**:逐行对照 Vue2 :3-39 与 New-UI 模板,完全一致
   ——`.sk-group-label`(chev + label + count)→ `v-if="!collapsed"` → `v-for` 条目
   `.sk-item`(`SkillTile` + `.sk-item-body`(`.sk-item-head`(name+tag)+ `.sk-item-desc` +
   `.sk-item-meta`(author → `.sep` → runs → 条件 off 徽标)))。顺序、嵌套、v-if 位置
   全部 1:1。`.sk-group-count` 显示 `items.length`,与蓝本 :10 一致。

2. **i18n 键选择**:grep 两个语言包确认
   `zh_CN.json`: `Auto`="自动" `Slash`="命令" `Manual`="手动" `{count} runs`="{count} 次运行"
   `Off`="已关闭" `You`="你";`en_US.json` 对应英文值全部一致。
   New-UI `zh_cn.ts`/`en_us.ts` 的 `aiSkTagAuto/Slash/Manual`、`aiSkNRuns`、`aiSkOff`、
   `aiSkAuthorYou` 逐字符匹配上述值,且与右栏详情键 `aiSkTriggerAutomatic`(="自动触发",
   与短标签"自动"确实是两个不同的串)、`aiSkTriggerSlash` 保持独立、未被误用。零新增键
   声明属实(本次提交未改动任何 i18n 文件)。

3. **`triggerKind()`**:与 Vue2 :56 `t==='auto'?'auto':t==='slash'?'slash':'manual'`
   逐字符一致;`data-kind` 输出即为该函数返回值。已用**独立于实现者的 RED 探针**验证
   (见下)。

4. **`authorLabel()` / `displayAuthor()`**:命中 `'You'` 走 `t('aiSkAuthorYou')`→"你";
   未命中(如 `'Bob Chen'`)原样透传 `author` 字符串,不显示空值或键名。已用真实人名
   fixture(`Bob Chen`)验证,测试断言精确到文本内容,非存在性判断。

5. **`Number(s.calls||0).toLocaleString()`**:实现完全照抄 Vue2 :33 的表达式,测试覆盖
   `1234`→"1,234"、`0`→"0"、`undefined`→"0"(通过 `||0` 兜底)三种边界,均通过全量测试
   验证。

6. **`data-active`/`data-disabled`**:模板里写死字符串三元 `'true'`/`'false'`(非布尔),
   与 Vue2 :17-18 逐字符一致。`data-collapsed` 保留布尔直传 `:data-collapsed="collapsed"`
   ——实测(非仅推理)`wrapper.attributes('data-collapsed')` 在 `collapsed=false` 时读到
   字符串 `'false'`(非 `undefined`/属性缺失),因为 `data-*` 不在 Vue3
   `isSpecialBooleanAttr` 特判列表内,走 `setAttribute(key, value)` 的隐式 `toString()`
   路径,与字符串三元写法结果一致。CSS 选择器 `[data-collapsed="true"]`
   (`skills-styles.scss:75`)因此能正常命中。此为报告如实描述,非需要整改的偏离。

7. **零 `<style>` 块**:组件确认无 `<style>` 段。逐个 grep 用到的类
   (`.sk-group-label`、`.sk-group-chev`、`.sk-group-count`、`.sk-item`、
   `.sk-item-body/-head/-name/-tag/-desc/-meta/-off`、`.sep`)均在
   `src/ai/styles/skills-styles.scss` 中存在定义(含 `.sep` 于 :168 行内嵌规则)。

8. **测试判别力**:9 个用例中除首个"默认展开"用 3 条目断言总数与 collapsed 状态外,
   其余关键判别性断言(active/disabled/trigger/pick id/作者)全部构造 **3 条目 或 2
   条目数组**并逐位 `.toEqual([...])` 精确比对,非单元素数组上测 `.some`/`.every`。
   本评审**独立做了一次 RED 探针**(见下),证实其判别力真实存在。

9. **提交纯净性**:`git show --stat HEAD` 确认仅 2 个新文件
   (`SkillGroup.vue` 107 行、`SkillGroup.test.ts` 136 行),无其它文件改动。

## 独立 RED 探针(与实现者报告不同的破坏点)

破坏点:`triggerKind()` 恒定返回 `'auto'`(实现者报告的 RED 探针是破坏 `data-active`
三元,本次改测 `triggerKind` 的兜底/映射逻辑,验证"三种 trigger"与"未知 trigger 落
manual"两个测试的真实判别力)。

```
 FAIL  …三种 trigger 各自映射到正确的 data-kind 与短标签文案
 -   "slash", "manual",
 +   "auto", "auto",
 FAIL  …未知 trigger 值落到 manual 分支(对齐 Vue2 :56 triggerKind 的兜底)
 AssertionError: expected 'auto' to be 'manual'
 Test Files  1 failed (1)
      Tests  2 failed | 7 passed (9)
```

还原后(`git diff` 精确改回一行):
```
 Test Files  1 passed (1)
      Tests  9 passed (9)
```
`git status --short` 输出为空,工作区干净。

## 自己实测的三门终值

```
pnpm test:                  Test Files  289 passed (289) / Tests  2375 passed (2375), exit=0
pnpm exec vue-tsc --noEmit: exit=0(无输出)
pnpm build:                 exit=0(仅既有 >500KB chunk 警告,无新增错误)
```
与实现者报告数字完全吻合(288/2365 基线 + 本任务 1 测试文件/9 用例 + color-guard 动态 +1
= 289/2375,与协调者已核实的口径一致)。

## 未发现的问题

- 未发现 DOM/class/顺序偏离。
- 未发现 i18n 误用(未见短标签误用长文案键,反之亦然)。
- 未发现空转测试、被削弱/删除的既有断言。
- 未发现凭空捏造的 CSS 类。
- 提交纯净,无越界改动。

## 轻微观察(非缺陷,不阻塞)

- `activeId` prop 在 New-UI 用 `defineProps<{ activeId: string | null }>()`(无
  `withDefaults` 兜底 `null`),比 Vue2 `default: null` 更严格 —— 调用方必须显式传
  `activeId`(哪怕传 `null`)。因为本任务尚无实际调用方接线,不构成可观察的行为偏离,
  仅记录供后续接线任务(SkillsPanel 或等价容器)注意需显式传参。

## 结论

- **规格符合**:✅
- **代码质量**:通过
