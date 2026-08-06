# SP8-P3b Task 8 —— `SkillsSection.vue` 接线,独立评审

评审者:独立评审 agent(sonnet)。工作目录 `/home/nimo/NimoTech/.sp8/NimoOS-New-UI`,分支 `sp8-ai`,被审提交 `5fd5f19`,BASE `19b7f6e`。**未采信实现者报告的任何数字或结论,全部回源复核。**

## 判定

- **① 规格合规:✅**(brief 逐条要求均已落地,取数口径/删除条件/弹窗常挂写法/`+`按钮配色/console.error 不照抄/onTest 乐观本地值 全部对齐)。
- **② 代码质量:通过,但有一条测试质量 Important 需修**(见下)。

## 严重度统计

- Critical:0
- Important:1
- Minor:2

## 逐条发现

1. **[Important] 测试质量 —— `SkillsSection.test.ts:405-421`「删的不是当前选中项时 activeId 不变」用例无判别力**。测试数据是 `[a(选中), b]`,删除 `b` 后剩余列表 `[a]`,`skills.value[0]?.id` 恰好也是 `'a'`——因此无论实现是「只有删的是当前选中项才回落」的正确条件分支,还是「删除后无条件回落到剩余第一项」的错误实现,断言 `.sk-name span` 仍是 `'Skill A'` 都会通过。**已用 RED 探针证实**:把 `onDelete` 里的
   ```ts
   if (activeId.value === id) { activeId.value = skills.value[0]?.id ?? null }
   ```
   改成无条件的 `activeId.value = skills.value[0]?.id ?? null`(即删掉这条 brief 明确点名要钉住的分支),重跑 `SkillsSection.test.ts` 仍是 **23/23 全绿**,包括这条用例本身。已还原,`git diff --stat`/`git status --porcelain` 均为空。要让这条用例真正有判别力,需要构造「删除后剩余列表的第一项 ≠ 当前 `activeId`」的数据(例如三项 `a/b/c`,选中最后一项 `c`,删除非选中的 `a`,剩余 `[b, c]`,`skills[0]` 是 `b` ≠ `c`,此时正确实现应仍显示 `c`,错误实现会跳到 `b`)。当前用例形同空转,brief 要求钉住的这个条件事实上**没有回归网**。
2. **[Minor] 实现者报告的用例计数与实际不符**:报告称新增「17 条」用例,正文列举与 diff 实际 `it(` 数量都是 **12 条**(点击 `+`/toggle 成功/单层反证/busy 生命周期/toggle 失败/删除成功/删除非选中/删除失败/创建成功/创建失败 409/取消后清错/onTest,共 12)。算术核对(2542 → 2554,+12)与 12 条吻合,说明「17」是报告行文口误,不影响实际交付,但报告数字失实本身应订正。
3. **[Minor] 跨组件联动缺整合测试**:D4「启用并试用」→ `onToggle` 成功 → 列表项被替换 → `SkillDetail` 收到新 `skill` prop → `watch(enabled)` 关弹窗+跳转,这条链路的两端(`SkillsSection.onToggle` 的单层取数替换 / `SkillDetail` 的 `watch` 关闭逻辑)各自都有扎实的单测(`SkillsSection.test.ts` 的「toggle 成功…原地替换」+ Task 7 `SkillDetail.test.ts` 用 `setProps` 模拟父组件行为的 5+ 条 D4 用例),但**没有一条测试挂载真实的 `SkillsSection`→`SkillDetail` 全树、走真实点击「启用并试用」→ mock `updateSkill` resolve → 断言弹窗真的关闭**。逐行读代码确认耦合本身是对的(`skills.value.splice(idx,1,updated)` 触发响应式 → `activeSkill` computed 重算 → 新 prop 下传 → `watch(() => props.skill?.enabled)` 命中),风险主要是回归网薄而非当前有缺陷,故定为 Minor 而非 Critical/Important。

## 三个动作取数口径核查结论

回源 `NimoOS-AI/route/v2/skills.go` 逐行确认:
- `PATCH /skills/:id`(`Update`,:112-131)→ `SetEnabled` 落库后调 `h.Get(c)` → **200 裸 `sk` 对象**(`:52`),无信封。
- `DELETE /skills/:id`(`Delete`,:133-145)→ `c.NoContent(http.StatusNoContent)` → **204 无内容**。
- `POST /skills`(`Create`,:75-105)→ **201 裸 `sk` 对象**(`:105`)。
`SkillsSection.vue` 的 `onToggle`/`onCreate` 均为单层 `(await service.ai.xxx(...)) as Skill | undefined`,`onDelete` 不读返回值——三处均与后端真实形状及公共约束 §4 一致。「喂 `{data:skill}` → 断言列表项未被替换成信封对象」的反向用例(`:196-210`)本身有判别力,已用报告贴出的 RED 证据复核逻辑一致(改回 Vue2 双层取数 → 精确报红 2 条、其余 21 条不受影响)。**结论:三处取数口径正确,反向用例有效。**

## 双重 cast 独立判定

`(await service.ai.createSkill(payload as unknown as Record<string, unknown>))`。回源 `/home/nimo/NimoTech/.sp8/NimoOS-Service/dist/ai.d.ts:77`:`createSkill(data: Record<string, unknown>): Promise<unknown>`。`SkillFormPayload` 是 `interface`(非 mapped type),TypeScript 不会给它隐式索引签名;`interface` 变量直接赋给带索引签名的参数类型,两个方向的结构兼容性检查都不成立(`SkillFormPayload` 缺索引签名、`Record<string, unknown>` 也不保证具备 `SkillFormPayload` 的具名字段),单层 `as Record<string, unknown>` 会被 TS 判定为「转换可能是错误」(TS2352)而拒绝,`as unknown as X` 是绕过该检查的标准写法——这是 TypeScript 接口类型系统的已知限制,不是绕过一个真实的运行时不兼容:payload 运行时字段(`name/title/description/trigger/color/md/examples/scripts[].{path,content}`)与后端 `skillCreateBody`(`route/v2/skills.go:58-73`)逐字段吻合。**结论:双重 cast 是必要且合理的类型层转型,没有掩盖真实契约不匹配**;若想更「干净」,唯一替代是把共享包签名改成泛型或给 `SkillFormPayload` 加索引签名,但这两者都会动共享包/破坏其他消费者,超出本任务范围,现状是合适选择。

## 跨组件联动(D4 弹窗依赖 onToggle 成功替换列表项)核查结论

逐行读 `SkillDetail.vue:322-331` 的 `watch(() => props.skill?.enabled, …)` 与 `SkillsSection.vue` 的 `onToggle`(`skills.value.splice(idx, 1, updated)`)确认:只要 `onToggle` 成功时用后端返回的裸 `skill`(其 `enabled` 已被 `SetEnabled` 落库为 `true`)整项替换列表,Vue 响应式链路(`skills` → `activeSkill` computed → `SkillDetail` 的 `skill` prop → watch)天然会在同一步里把 `enabled` 从 `false` 变为 `true`,触发弹窗关闭 + 跳转;`onToggle` 失败时不改列表,`enabled` 保持 `false`,弹窗天然留在原地,由父组件发 danger toast(已确认 `catch { toast.show(t('aiSkUpdateFailed'), 3000, 'danger') }`)。**逻辑链正确**,但如上「发现 3」所述,缺一条端到端整合测试锚定这条链路整体,判定为 Minor 覆盖缺口(非缺陷)。

## RED 探针 + 已还原

探针(本评审独立实施,非报告里的探针):把 `onDelete` 里 `if (activeId.value === id) { activeId.value = skills.value[0]?.id ?? null }` 改成无条件 `activeId.value = skills.value[0]?.id ?? null`,重跑 `pnpm exec vitest run src/ai/components/settings/sections/SkillsSection.test.ts`,结果 **23/23 全绿**(含目标用例本身)——证实该用例无判别力(详见发现 1)。已用 `Edit` 精确还原原条件分支,`git diff --stat` 与 `git status --porcelain` 均输出为空,确认仓库干净。

另核对了报告自带的单层取数 RED 证据(改 `onToggle` 回 Vue2 双层取数 → 2 条精确报红、21 条不受影响)——描述与代码逻辑一致,未重复实跑,采信。

## 算术核对结论

`diff --stat` 确认本次提交只改 4 个既有文件(`SkillsSection.vue`/`SkillsSection.test.ts`/`AddSkillModal.vue`/`src/ai/types/skill.ts`),**零新增 `.vue`**,与 brief「本任务不新增 `.vue`」一致 → `color-guard.test.ts` 全量用例数不变。新增测试用例实际为 12 条(见发现 2),2542 → 2554 的 +12 与之吻合,算术正确;报告文字「17 条」的措辞是笔误,不影响真实交付物。

## 其余复核事项(通过,无异议)

- `SkillFormPayload`/`SkillScript` 从 `AddSkillModal.vue` 搬到 `src/ai/types/skill.ts`:逐字段对比,纯搬移未改一字;`AddSkillModal.vue` 改成 `import type` 引用,该组件自身 `.test.ts` 未改动(diff 中未出现),未受影响。
- `+` 按钮:`AgentIcon name="plus" :size="15"` 不传 `color`,`grep` 确认 `.set-app .sk-add-btn { … color: var(--text-on-accent); … }`(`skills-styles.scss:183-198`)供色,两套主题下 `--text-on-accent` 均有值(沿用既有 token,未新增)。
- 弹窗写法:`v-model:open="adding"` 常挂,`AddSkillModal` 自身 `watch(open)` 负责 `!v` 时复位字段;父组件 `watch(adding, v => { if (!v) createError.value = '' })` 负责清行内错误——责任边界清晰,已用「创建失败后取消关闭再打开」用例验证。
- `console.error` 未在四个新方法中出现(grep 确认),失败态统一走 toast/行内错误。
- 配色:组件模板/脚本零 `#hex`/`rgb()`/具名色;`.sk-add-btn` scss 规则逐行人肉扫描无色字面量。
- i18n:`aiSkAddSkill`/`aiSkEnabledToast`/`aiSkPausedToast`/`aiSkUpdateFailed`/`aiSkUninstalledName`/`aiSkDeletedName`/`aiSkDeleteFailed`/`aiSkAddedName`/`aiSkErrDuplicate`/`aiCfgRefresh`/`aiSkAddTitle`/`aiCancel` 在 `zh_cn.ts`/`en_us.ts` 各恰好出现一次,无新增、无重复键。
- 既有断言:diff 中「只读半」describe 块无删除/削弱,仅新增 mock 重置与 `.set-app` host 装配;P3a 遗留断言原样保留。

## 未实测项

未重新跑全量三门(`pnpm test`/`vue-tsc`/`build`),采信实现者报告的终值(296 文件/2554 例、tsc 0、build 0),仅对涉及本任务文件的单测子集(`SkillsSection.test.ts`)独立重跑并做 RED/GREEN 验证。
