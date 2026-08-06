# SP8-P3a 验收后追加 —— 「已挂载技能」提示条 · 独立评审

评审范围:`c834bb1..HEAD`(单提交 `e5bfb20`),分支 `sp8-ai`,工作区
`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`。

依据实现者报告独立复核,**未采信**任何未经自验的报告断言;所有结论均基于本人
`git show`/`grep`/`Read`/实测测试与两次 RED 探针。

## 1. 提交范围 / 禁区

`git show --stat HEAD` 只含 4 个文件:`AgentComposer.vue`、`AgentComposer.test.ts`、
`src/i18n/en_us.ts`、`src/i18n/zh_cn.ts`。逐行读完 diff,确认:

- **未碰** `AgentPage.vue` / `agentStore.ts` / 技能分区任何文件。
- **未做**方案②(`router.replace` 清 `?skill=`)——diff 里无任何路由操作。
- **未做**方案③(技能停用/删除提示)——diff 里无相关条件分支。
- 关闭按钮语义唯一:`@click="store.pendingSkillId = null"`,不做别的。
- 未加 prop / emit;`AgentComposer.vue:159` 附近确认 `useProvidedAgentStore()`
  已存在,组件直接读写 `store.pendingSkillId`(`agentStore.ts:172` 定义、
  `agentStore.ts:1196` 导出、`agentStore.ts:925-927` 才是真正消费点,本组件未涉足)。

**结论:禁区干净。**

## 2. 落点

`grep -n` 确认新 `<div class="pending-skill">`(行 1083)在 `<div class="composer">`
(行 1080)之内、`composer-chips` 那行(行 1098)之前,符合 brief §2.1 逐字要求。

## 3. 行为核对

1. 有值渲染 / 无值不渲染:`v-if="store.pendingSkillId"`,单一 `v-if`,无额外条件。
2. 关闭按钮:仅 `store.pendingSkillId = null`,无 URL 操作、无其他副作用。
3. 发送后自动消失:确认 `AgentComposer.vue` 自身 `submit()`(行 993-1007)只
   `emit('send', …)` 交给父组件,不直接碰 `pendingSkillId`——真正的清空逻辑在
   `agentStore.ts:925-927`(`send()` 内部),不在本组件职责内。测试第 4 例只钉住
   "外部清空后 v-if 自然消失、组件侧无需额外代码" 这一半,并在注释里说明另一半
   因为职责边界不在此文件而不测——**这个解释是真实的**(已用 grep 核实
   `submit()` 内容),不是逃避测试。

## 4. 配色(硬约束)

`AgentComposer.vue` 新增 `<style scoped>` 规则(`.pending-skill` 及子类)逐行读过,
**零 `#hex`、零 `rgb(`/`rgba(`、零具名色、零 `theme-exception`**。

逐个 token 回 `src/ai/styles/tokens.scss` 核实取值:

| token | 浅色块(行) | 暗色块(行) |
|---|---|---|
| `--accent-softer` | 65(有) | 272(有) |
| `--accent-soft` | 64(有) | 271(有) |
| `--text-tertiary` | 57(有) | 261(有) |
| `--bg-elevated` | 43(有) | 249(有) |
| `--text-primary` | 55(有) | 259(有) |
| `--r-pill` | 104(结构量,单块) | 同上,共享 |
| `--font-mono` | 115(结构量,单块) | 同上,共享 |

`--r-pill`/`--font-mono` 是非颜色结构量(圆角/字体族),按公共约束只需在 `:root`
一处定义,符合规则,不是缺陷。所有颜色 token 浅色/暗色两块均有值,**无单档缺失**。

`AgentIcon` 用法 `color="var(--accent)"` 与既有先例
(`KindIcon.vue:76`、`SearchFileDrawer.vue:103`)逐值一致。

## 5. i18n

`grep -n` 确认两键在 `zh_cn.ts`/`en_us.ts` 各出现且仅出现一次(`grep -c` = 2,
含键名两次:声明各 1 次,无重复定义)。值逐字符比对 brief §2.4:

- `aiSkPendingBanner` zh: `已挂载技能 {name},将应用于下一条消息` —— 完全一致。
- `aiSkPendingBanner` en: `Skill {name} is attached — it will apply to your next message`
  (含 em dash `—`)—— 完全一致。
- `aiSkPendingDetach` zh/en:`取消挂载` / `Detach skill` —— 完全一致。

`<i18n-t keypath="aiSkPendingBanner" tag="span">` + `<template #name><code>…</code></template>`,
i18n 值本身不含 `<code>`、未用 `v-html`,与既有先例
(`ResourcesTab.vue:165-172` 的 `#at`、`MentionPopover.vue:328` 的 `#query`)写法一致。
无字面 `@`,不触发转义规则。

## 6. 既有测试完整性

diff 里 `AgentComposer.test.ts` **只有新增行(`+`),零删除(`-`)**——公共约束 §9
"不许削弱或删除既有断言" 未违反。新增一个 `describe` 块共 4 例,插在文件末尾
既有 `describe` 块之后,不与其他 `describe` 交叉。

（旁注:报告里"81 例"vs"56 例"的更正——协调者 brief 里写的基线数字是外部粗略
`grep`,与本任务范围无关,不影响本次评审判定,仅供协调者更新台账参考。）

## 7. RED 探针(本人独立操作,均已还原,`git status` 干净)

**探针 1**:关闭按钮改成 `@click="() => {}"`(不清空 store)。
```
FAIL AgentComposer.test.ts > … > 点关闭按钮把 store.pendingSkillId 置 null,提示条消失
AssertionError: expected 'duplicate-sweeper' to be null
Test Files  1 failed (1)
     Tests  1 failed | 59 passed (60)
```
精确命中该用例、不误伤其余 59 例。还原后单独跑本文件:60/60 绿。

**探针 2**:`v-if="store.pendingSkillId"` 改成 `v-if="true"`(强制常显）。
```
FAIL … > pendingSkillId 为 null 时整条不渲染
FAIL … > 点关闭按钮把 store.pendingSkillId 置 null,提示条消失
FAIL … > pendingSkillId 被清空后(模拟 send() 消费一次的效果),提示条自然消失
Test Files  1 failed (1)
     Tests  3 failed | 57 passed (60)
```
精确命中用例 2/3/4(用例 1 本就断言渲染,不受影响故仍绿）。还原后
`git status` 干净,单独跑本文件 60/60 绿。

两次探针均证明新增 4 例具备判别力,非空转断言。

## 8. 三门(本人独立实测,非转抄报告)

```
pnpm test                    → exit=0 · Test Files 291 passed (291) · Tests 2416 passed (2416)
pnpm exec vue-tsc --noEmit   → exit=0(空输出)
pnpm build                   → exit=0 · 仅既有 >500KB chunk 警告(ExcelViewer/index-BJgEjpSL 等),无新增警告/报错
```
与实现者报告的终值一致。

## 9. 三件套申报

① 代码注释:`AgentComposer.vue` 文件头新增段落(说明 Vue2 无此元素、用户当面
授权、背景问题、不做的两条、放置理由）+ 模板内紧贴 `<div>` 的行内注释,均已读过,
内容属实、指向准确(`agentStore.ts:925-927`、`.superpowers/sdd/…brief.md`）。
② 报告第 6 节单列偏离,内容与代码注释一致。
③ 台账登记留待协调者,不在本次评审范围。

**三件套齐全。**

## 10. 判定

- **规格符合**:✅ —— 落点、数据来源、行为、i18n、样式、测试覆盖、禁区均按
  brief 逐条核实通过。
- **代码质量**:通过 —— 无空转用例、无既有断言删减、token 使用规范、注释翔实、
  职责边界清晰(未越界碰 agentStore.ts 内部消费逻辑）。

**未发现 Critical / Important 级问题。**

无发现项列表为空——本次复核未在规格符合性或代码质量上找到需要报告的缺陷。
