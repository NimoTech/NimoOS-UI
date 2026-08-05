# SP8-P3b Task 7 修复轮 1 —— 复审 1

范围:`d8078aa..19b7f6e`(单提交 `19b7f6e`)。
复审文件:`src/ai/components/settings/skills/SkillDetail.vue`、`.test.ts`。
工作区:`/home/nimo/NimoTech/.sp8/NimoOS-New-UI`(分支 `sp8-ai`,未提交/未改仓库)。

---

## Finding 1(Important):弹窗提前关闭,违背设计 §9.4 —— ADDRESSED

设计文档原文(`NimoOS-UI/docs/superpowers/specs/2026-07-30-vue3-migration-sp8-p3b-skills-write-design.md` §9.4):

> 「启用并试用」(先 `toggle(id, true)`,**成功才跳转**;失败则留在弹窗 + danger toast,不跳转)

代码 diff 与该原话逐字对齐(`SkillDetail.vue:297-331`):

- `confirmEnableAndTry()`(:302-307)不再 `tryModalOpen.value = false`,只记挂号 + emit,弹窗保持打开。
- `watch(() => props.skill?.enabled, …)` 成功分支(:326-330)在**同一个回调、同步的三条语句**里完成
  「清挂号 → 关弹窗 → push」——「同一步」成立。
- 失败路径:父组件不改 `enabled` → watch 不触发 → `tryModalOpen` 保持 `true` → 弹窗天然留在原地,
  不需要额外分支。danger toast 由 T8 `SkillsSection.onToggle` 负责,本组件未重复发,已在注释里声明。

三条判定要点逐一核实:
① 设计原文与实现描述比对一致(如上)。
② 成功路径「同一步」——test「父组件把 enabled 真的改成 true…弹窗关闭 + push 同一步发生」
   (`.test.ts:601-613`)断言 `push` 已调用且 `.sk-modal` 已消失,两者在同一次 `setProps`+`flush`
   之后一起断言,吻合。
③ 失败路径弹窗仍开——test「D4:toggle 失败(父组件不改 enabled)→ 弹窗仍开、永不 push」
   (`.test.ts:653-669`,行号以拆分后为准)在 `setProps({ enabled: false })` 之后新增
   `expect(host.querySelector('.sk-modal-title')?.textContent).toBe('该技能已停用')`,钉住弹窗未关。
   点击确认后立即（未等父组件响应）那条(`.test.ts:576-587`)也断言 modal-title 仍在。

`busy[skill.id]` disabled:实现者自主追加,注释明确声明「顺带(自主判断范围,非设计文档强制)」
并给出理由(防止请求飞行中重复点击叠加发出多条 toggle)。判断合理、注释到位；`busy` 是父组件已有
的既定字段（`.sw` 开关已用同一字段），复用没有引入新概念。**未见对应的专项测试**（现有
`busy[id] 为真时开关禁用` 用例只测 `.sw`，没有覆盖 D4 确认按钮），但这属于实现者自选的加固项、
非本轮四个 finding 之一，不计入本轮 NOT ADDRESSED，仅记录备查。

**结论:ADDRESSED。**

---

## Finding 2(Important):`pendingTry` 两道防线零测试覆盖 —— ADDRESSED

自行重做两次 RED 探针(未采信报告贴的输出):

**探针 A —— 删除成功分支里的 `pendingTryId.value = null`**(只留 `tryModalOpen.value = false` +
`router.push`):
```
pnpm exec vitest run SkillDetail.test.ts -t "push 总次数仍是 1"
FAIL ... D4:成功跳转一次后,同一技能之后被手动开关多次,push 总次数仍是 1(...)
AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times
 ❯ SkillDetail.test.ts:623:18
```
精确报红。已用 Edit 精确还原,`git diff --stat` 确认该文件无残留改动。

**探针 B —— 删除 `if (enabled === true)` 判断**(改成 id 匹配后无条件清挂号+关弹窗+push):
```
pnpm exec vitest run SkillDetail.test.ts -t "钉住"
FAIL ... D4:挂号后 watcher 第一次真正触发时 enabled 是 false(不是 true)→ 不 push(钉住 `if (enabled === true)` 判断)
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
Received: [{ path: "/ai/agent", query: { skill: "sk-9" } }]
 ❯ SkillDetail.test.ts:649:22
```
精确报红。已用 Edit 精确还原,`git diff --stat` 确认该文件无残留改动。

两次破坏各只命中新增的对应用例（其余用例在探针 A 里保持 47 passed / 1 failed，探针 B 里
46 skipped(用 `-t` 过滤)+ 1 passed + 1 failed，未见连带误报或误绿），判别力干净。

**结论:ADDRESSED。**

---

## Finding 3(Minor,已判定 skipped):`s.id !== pendingTryId.value` 结构性不可达

维持原状,协调者指示不写依赖 Vue 内部 effect 调度顺序的伪造测试。代码与报告 §6 附加说明/§11
Minor 段一致,如实申报未假称已被 RED 验证。**判定:skipped(按指示),不计入 NOT ADDRESSED。**

---

## 修复 diff 内的新破坏

逐行核对 diff(`.vue` + `.test.ts`)未发现削弱/删除既有断言的情况:

- 被替换的旧断言(`expect(host.querySelector('.sk-modal')).toBeNull()` 紧跟点击之后)对应的是
  「发了就关」这个**已被判定为违反设计的旧行为**,新断言反向要求弹窗仍开——是行为修正后的
  必然翻转,不是判别力被削弱。
- 「toggle 失败」用例只在原有基础上**追加**一行断言(modal-title 仍存在),未删除任何原断言。
- 新增两条用例均使用 `flush()`(`flushPromises()` + `nextTick()`),未见单个 `await nextTick()`
  的假通过写法。
- 无空转用例:两条新用例均已用 RED 探针验证判别力(见上)。

**结论:无新破坏。**

---

## 实测数字

- `SkillDetail.test.ts` 单独跑:48/48 绿(与报告 §11 末段一致)。
- 全量 `pnpm test`:`Test Files 296 passed (296)` / `Tests 2542 passed (2542)`,exit=0
  (`/tmp/p3b-rereview-test.log`)。与报告称「2539→2542,+3」一致。
- `vue-tsc --noEmit` / `pnpm build` 未在本轮重跑(任务要求全量测试可选,已用报告贴出的记录佐证 +
  上面独立跑通的 `pnpm test` 作为主要验证)。

---

## 总判定

Finding 1:ADDRESSED。Finding 2:ADDRESSED(两次独立 RED 探针均报红,已精确还原)。
Finding 3:skipped(按指示,非缺陷)。修复 diff 内未发现新破坏或断言削弱。**本轮修复通过复审。**
